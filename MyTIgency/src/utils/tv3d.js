// TV GLB com dither (port de TVdither/tv3d.js). Mesmo visual e mesma intro
// (pontos aparecendo + giro de entrada, a cada vez que entra na tela).
// Diferenças do original: sem OrbitControls (não arrasta — o giro virá do
// scroll lateral), reduced-motion entrega direto o estado final e há
// dispose() para o React desmontar sem vazar contexto WebGL.
//
// Durante o scroll (useManifestoHorizontal + DitherTV), três camadas:
//  - peso: giro e inclinação seguem o scroll por molas amortecidas — a TV
//    inclina contra o movimento lateral da trilha e balança ao parar;
//  - sintonia: a tela mostra chiado que entra em sintonia (setTune) até
//    travar no logo MyTi quando a TV fica de frente;
//  - foco: scroll rápido engrossa o dither (ponto maior, menos tons), que
//    volta a ficar nítido quando o scroll desacelera.
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js'
import { drawAll } from './warmup'

// Molas (k = rigidez, zeta = amortecimento; < 1 passa do ponto e volta).
// Giro: segue o alvo do scroll com um leve overshoot — sensação de massa.
const TURN_SPRING = { k: 70, zeta: 0.62 }
// Inclinação: mais solta, para balançar um pouco quando a trilha para.
const TILT_SPRING = { k: 48, zeta: 0.26 }
// rad de inclinação por (largura de tela / s) de velocidade lateral, e teto.
const TILT_GAIN = 0.06
const TILT_MAX = 0.13
// Esbarrão (bump): velocidade (rad/s) dada às molas por unidade de força.
const BUMP_TILT = 0.9
const BUMP_TURN = 2.8
// impacto: px extra do dither, tremor (unid. da cena) e quanto a tela perde a sintonia
const HIT_PX = 1.6
const HIT_SHAKE = 0.045
const HIT_DETUNE = 0.8
// Suavização (fração por frame a 60fps) das velocidades medidas por frame —
// o ticker do GSAP e o loop daqui não andam em fase, o delta bruto oscila.
const VEL_SMOOTH = 0.25
// Foco: velocidade de scroll (alturas de tela / s) em que o dither começa a
// engrossar e em que chega ao máximo; entra rápido e volta devagar.
const BLUR_SPEED = [1.4, 4.5]
const BLUR_ATTACK = 0.35
const BLUR_RELEASE = 0.06
const BLUR_PX = 1.2 // ponto chega a pixel × (1 + BLUR_PX)

// Vidro da tela, medido no tv.min.glb (raycast frontal, na escala em que a TV
// é normalizada — maior dimensão = 1.7, centrada, frente para +Z): retângulo
// ±HX × ±HY em torno de y = CY, abaulado z = Z0 − A·u² − B·v² + C·u²v² com
// u, v ∈ [−1, 1]. A imagem fica OFFSET à frente do vidro e passa MARGIN da
// borda — o excesso some atrás da moldura, que é mais alta que o vidro ali.
export const SCREEN = { CY: 0.1736, HX: 0.676, HY: 0.526, Z0: 0.7675, A: 0.135, B: 0.09, C: 0.045, OFFSET: 0.008, MARGIN: 1.03 }
const TV_SIZE = 1.7

const gltfs = {}
const load = (url) => (gltfs[url] ||= new GLTFLoader().loadAsync(url))

// Mola amortecida, Euler semi-implícito em passos fixos (estável com dt alto).
// targetVel: velocidade do alvo — o amortecimento age sobre a diferença de
// velocidade, então um alvo andando em ritmo constante é seguido sem atraso
// (só acelerações e impulsos fazem a mola passar do ponto e voltar).
function stepSpring(s, target, { k, zeta }, dt, targetVel = 0) {
  const c = 2 * zeta * Math.sqrt(k)
  const n = Math.ceil(dt * 120)
  const h = dt / n
  for (let i = 0; i < n; i++) {
    s.v += (k * (target - s.x) + c * (targetVel - s.v)) * h
    s.x += s.v * h
  }
  return Math.abs(target - s.x) > 0.0005 || Math.abs(s.v) > 0.002
}

// Tela: chiado → sintonia → imagem travada. uTune 0..1 vem do scroll; o
// chiado anima no tempo (é o estado "sem sinal", não decoração). Valores em
// espaço de tela; sai com pow 2.2 porque o passe de dither aplica 1/2.2.
const screenFragment = `
  uniform sampler2D uMap; uniform float uTime, uTune;
  varying vec2 vUv;
  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  void main(){
    float s = 1. - uTune;
    vec2 uv = vUv;
    // V-hold: a imagem rola e desacelera até travar conforme sintoniza
    // (posição = função do scroll), com a faixa escura entre quadros.
    float roll = s * s * 2.6;
    uv.y = fract(uv.y + roll);
    float seam = roll > 0. ? smoothstep(.07, 0., min(uv.y, 1. - uv.y)) * min(1., s * 4.) : 0.;
    // H-hold: linhas deslocadas, cada vez menos.
    float row = floor(uv.y * 96.);
    uv.x += s * (sin(row * .7 + uTime * 7.) * .03 + (hash(vec2(row, floor(uTime * 18.))) - .5) * .12 * s);
    float img = dot(texture2D(uMap, clamp(uv, 0., 1.)).rgb, vec3(.299, .587, .114));
    float n = hash(floor(vUv * vec2(150., 116.)) + fract(uTime * 7.31) * 113.);
    float signal = smoothstep(.12, .9, uTune);
    float l = mix(n * 1.1, img, signal) + (n - .5) * .35 * (1. - signal) * signal * 2.;
    l *= 1. - seam * .85;
    l *= .9 + .1 * sin(vUv.y * 380.); // scanlines
    vec2 c = vUv - .5;
    l *= 1. - dot(c, c) * 1.1; // vinheta do tubo
    gl_FragColor = vec4(vec3(pow(clamp(l, 0., 1.), 2.2)), 1.);
  }`

function buildScreen(imageUrl, shape) {
  const { CX = 0, CY, HX, HY, Z0, A, B, C, OFFSET, MARGIN } = shape
  const geo = new THREE.PlaneGeometry(2 * HX * MARGIN, 2 * HY * MARGIN, 24, 18)
  const pos = geo.attributes.position
  for (let i = 0; i < pos.count; i++) {
    const u = pos.getX(i) / HX
    const v = pos.getY(i) / HY
    pos.setXYZ(i, pos.getX(i) + CX, pos.getY(i) + CY, Z0 - A * u * u - B * v * v + C * u * u * v * v + OFFSET)
  }
  // Imagem da sintonia: logo centrado num quadro escuro 4:3 (o vidro é ~1.29:1).
  const cv = document.createElement('canvas')
  cv.width = 256
  cv.height = 198
  const ctx = cv.getContext('2d')
  const W = cv.width, H = cv.height
  const map = new THREE.CanvasTexture(cv)
  let img = null
  let bootP = null // null = só a imagem (padrão); [early, logo] 0..1 = sequência de boot
  // cabe em 72% da altura e 80% da largura (logos largos não vazam do vidro)
  const drawLogo = (reveal = 1) => {
    if (!img?.naturalWidth || reveal <= 0) return
    const ar = img.naturalWidth / img.naturalHeight || 1
    const h = Math.min(H * 0.72, (W * 0.8) / ar)
    const w = h * ar
    ctx.save()
    ctx.beginPath()
    ctx.rect(0, 0, W, H * reveal) // varredura de cima para baixo
    ctx.clip()
    ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h)
    ctx.restore()
  }
  // Boot de CRT (setBoot): espera com cursor → ponto → linha → abre o quadro
  // → terminal mono busca set:mytigency.com com barra de progresso → limpa →
  // o logo entra por varredura. Tudo função do scroll, reversível.
  const ease = (t) => 1 - (1 - Math.min(1, Math.max(0, t))) ** 3
  const seg = (p, a, b) => Math.min(1, Math.max(0, (p - a) / (b - a)))
  const sineIO = (t) => (1 - Math.cos(Math.PI * Math.min(1, Math.max(0, t)))) / 2
  // Duas linhas do tempo: p = etapas antes do logo (cursor → CRT → terminal,
  // até o terminal sumir) e logo = a varredura do logo (curva suave). Quem
  // chama decide onde cada uma cai no scroll; elas se sobrepõem no fim.
  function drawBoot(p, logo) {
    ctx.fillStyle = '#0c0c0c'
    ctx.fillRect(0, 0, W, H)
    ctx.fillStyle = '#ececec'
    if (p <= 0.03 && logo <= 0) { // desligado: só o cursor de espera
      ctx.font = '500 18px "JetBrains Mono", monospace'
      ctx.fillText('_', 18, 34)
      return
    }
    // Camadas que se cruzam (nada corta seco para o preto — antes o clarão
    // cinza sumia de uma vez e parecia bug):
    // 1) CRT: ponto → linha → abre o quadro; o clarão se apaga devagar até o preto
    const on = seg(p, 0.03, 0.12), open = seg(p, 0.12, 0.24)
    const glow = 1 - ease(seg(p, 0.2, 0.44))
    if (glow > 0) {
      const lw = Math.max(3, W * ease(on)), lh = Math.max(2, H * ease(open))
      ctx.globalAlpha = glow
      ctx.fillRect((W - lw) / 2, (H - lh) / 2, lw, lh)
      ctx.globalAlpha = 1
    }
    // 2) terminal: entra por fade sobre o fim do clarão e sai por fade
    // fica em 100% de 0.84 até o tapa; no fim (p = 1) corta seco para o logo
    const term = sineIO(seg(p, 0.33, 0.45)) * (p < 1 ? 1 : 0)
    if (term > 0) {
      ctx.globalAlpha = term
      // elementos grandes: a textura tem 256px e passa pelo dither de 2px
      const x = 18
      ctx.font = '700 22px "JetBrains Mono", monospace'
      const q = '> mytigency.com'
      const typed = Math.round(q.length * seg(p, 0.38, 0.54))
      ctx.fillText(q.slice(0, typed) + (typed < q.length ? '_' : ''), x, 52)
      const k = sineIO(seg(p, 0.56, 0.84))
      if (p > 0.54) {
        const bw = W - x * 2, by = 80
        ctx.strokeStyle = '#ececec'
        ctx.lineWidth = 3
        ctx.strokeRect(x, by, bw, 30)
        ctx.fillRect(x + 6, by + 6, (bw - 12) * k, 18)
        ctx.font = '700 34px "JetBrains Mono", monospace'
        ctx.fillText(`${String(Math.round(k * 100)).padStart(3, '0')}%`, x, 162)
      }
      ctx.globalAlpha = 1
    }
    // 3) logo: varredura de cima para baixo, começando enquanto o terminal sai
    drawLogo(sineIO(logo))
  }
  function redraw() {
    if (bootP === null) {
      ctx.fillStyle = '#161616'
      ctx.fillRect(0, 0, W, H)
      drawLogo()
    } else drawBoot(...bootP)
    map.needsUpdate = true
  }
  redraw()
  if (imageUrl) {
    img = new Image()
    img.onload = redraw
    img.src = imageUrl
  }
  const mat = new THREE.ShaderMaterial({
    uniforms: { uMap: { value: map }, uTime: { value: 0 }, uTune: { value: 1 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
    fragmentShader: screenFragment,
  })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.dispose = () => { geo.dispose(); mat.dispose(); map.dispose() }
  const q400 = (v) => Math.round(Math.min(1, Math.max(0, v)) * 400) / 400
  mesh.setBoot = (p, logo) => {
    const v = p === null ? null : [q400(p), q400(logo)]
    if (v === bootP || (v && bootP && v[0] === bootP[0] && v[1] === bootP[1])) return
    bootP = v
    redraw()
  }
  return mesh
}

export function mountDitherTV(canvas, {
  url,
  palette, // 4 cores, escuro → claro
  pixel = 2, // tamanho do ponto em px CSS
  gap = 0.3, // grade de 1px entre os pontos (0 = sem grade)
  contrast = 1.35,
  bright = 0.02,
  restAngle = 0.6, // rad, vista 3/4
  // autoPlay: intro toca sozinha a cada entrada na tela (comportamento do
  // protótipo). false = começa escondida e só toca quando play() for chamado,
  // uma vez — quem chama decide o momento (ex.: entrada em combo da seção 2).
  autoPlay = true,
  revealDuration = 1.2, // s até os pontos aparecerem todos
  spinDuration = 1.8, // s do giro de entrada até o repouso
  screenImage = null, // url da imagem que a tela sintoniza
  tune: initialTune = 1, // 0 = chiado, 1 = sintonizada (ver setTune)
  // Por modelo (padrões = tv.min.glb): para onde a frente do GLB aponta
  // (rotação em Y que a vira para +Z), o vidro medido (ver SCREEN) e se a
  // tela da sintonia aparece (false = mostra a tela do próprio modelo).
  front = -Math.PI / 2,
  screenShape = SCREEN,
  showScreen = true,
  colorBoost = 2.5, // clareia o material (plástico escuro); modelo claro pede menos
  // false = o modelo como ele é: sem o dither (cor real, bordas suavizadas) e
  // sem mexer nos materiais (colorBoost/metalness ficam de fora)
  dither = true,
} = {}) {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true })
  // Mesmo teto do outro WebGL do projeto (asciiLogo.js) — o dither já é
  // deliberadamente blocado, então DPR nativo não acrescenta nitidez
  // perceptível, só custo de fill-rate por frame.
  renderer.setPixelRatio(1)

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100)
  camera.position.set(0, 0.9, 5.4)
  // O OrbitControls do original apontava a câmera para a origem no setup.
  camera.lookAt(0, 0, 0)
  const pmrem = new THREE.PMREMGenerator(renderer)
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
  scene.add(new THREE.HemisphereLight(0xffffff, 0x222222, 0.8))
  const key = new THREE.DirectionalLight(0xffffff, 2.8)
  key.position.set(3, 3, 5)
  scene.add(key)
  // Luz quente logo acima da tela: dá os pontos de brilho no vidro.
  const glare = new THREE.PointLight(0xffffff, 2.5, 3)
  glare.position.set(-0.2, 1.1, 1.2)
  scene.add(glare)

  // tilt (inclinação, eixo na base da TV) → pivot (giro em Y, centro).
  const tilt = new THREE.Group()
  scene.add(tilt)
  const pivot = new THREE.Group()
  tilt.add(pivot)
  let screen = null
  let screenScale = 1
  let screenVisible = showScreen
  let mixer = null
  let disposed = false
  let modelHolder = null
  const loaded = load(url).then(({ scene: src, animations }) => {
    if (disposed) return
    // SkeletonUtils: um clone simples quebra modelos com esqueleto
    const model = cloneSkinned(src)
    if (animations.length) {
      mixer = new THREE.AnimationMixer(model)
      animations.forEach((clip) => mixer.clipAction(clip).play())
    }
    const box = new THREE.Box3().setFromObject(model)
    const size = box.getSize(new THREE.Vector3())
    model.position.sub(box.getCenter(new THREE.Vector3()))
    // Plástico preto metálico vira mancha no dither; fosco e mais claro deixa o volume aparecer.
    model.traverse((o) => {
      if (!o.material || !dither) return
      for (const m of [].concat(o.material)) {
        Object.assign(m, { metalness: 0, metalnessMap: null })
        m.color?.setScalar(colorBoost)
      }
    })
    const holder = new THREE.Group()
    holder.add(model)
    modelHolder = holder
    holder.rotation.y = front
    pivot.add(holder)
    const scale = TV_SIZE / Math.max(size.x, size.y, size.z)
    pivot.scale.setScalar(scale)
    // Inclina pela base, como um objeto apoiado — não pelo centro.
    const base = (size.y * scale) / 2
    tilt.position.y = -base
    pivot.position.y = base
    screenScale = 1 / scale // SCREEN está na escala normalizada
    setScreenShape(screenShape)
    canvas.dispatchEvent(new Event('tv3d:loaded')) // malha pronta (projBox/hit funcionam)
  })

  function setScreenShape(shape) {
    screenShape = shape
    if (!screenScale || disposed || !pivot.children.length) return
    if (screen) { pivot.remove(screen); screen.dispose() }
    screen = buildScreen(screenImage, shape)
    if (boot !== null) screen.setBoot(...boot)
    screen.scale.setScalar(screenScale)
    screen.visible = screenVisible
    pivot.add(screen)
  }

  // Cena → render target → dither ordenado (Bayer 8×8) em paleta de 4 cores.
  // sem dither, o render target leva multisample (bordas suaves) e o passe só corrige a gama
  const rt = new THREE.WebGLRenderTarget(1, 1, dither ? {} : { samples: 4 })
  const post = new THREE.ShaderMaterial({
    transparent: true,
    uniforms: {
      tMap: { value: rt.texture }, uRes: { value: new THREE.Vector2() }, uRaw: { value: dither ? 0 : 1 },
      uPx: { value: 1 }, uReveal: { value: 0 }, uGap: { value: gap }, uGrid: { value: 0 },
      uLevels: { value: 3 },
      uContrast: { value: contrast }, uBright: { value: bright },
      uPal: { value: palette.map((c) => new THREE.Color(c)) },
    },
    vertexShader: 'void main(){ gl_Position = vec4(position.xy, 0., 1.); }',
    // uLevels: degraus de tom — 3 = as 4 cores (repouso), 1 = só os extremos.
    fragmentShader: `
      uniform sampler2D tMap; uniform vec2 uRes; uniform vec3 uPal[4];
      uniform float uPx, uReveal, uGap, uGrid, uLevels, uContrast, uBright, uRaw;
      float b2(vec2 a){ a = floor(a); return fract(dot(a, vec2(.5, a.y * .75))); }
      float b4(vec2 a){ return b2(.5 * a) * .25 + b2(a); }
      float b8(vec2 a){ return b4(.5 * a) * .25 + b2(a); }
      void main(){
        if (uRaw > .5) {
          vec4 r = texture2D(tMap, gl_FragCoord.xy / uRes);
          // a borda do multisample vem pré-multiplicada (sobre o fundo transparente):
          // desfaz, corrige a gama, e a mistura do material multiplica de novo
          gl_FragColor = vec4(pow(r.rgb / max(r.a, 1e-4), vec3(1. / 2.2)), r.a * step(.001, uReveal));
          return;
        }
        vec2 cell = floor(gl_FragCoord.xy / uPx);
        vec4 c = texture2D(tMap, (cell + .5) * uPx / uRes);
        float l = pow(dot(c.rgb, vec3(.299, .587, .114)), 1. / 2.2);
        l = clamp((l - .5) * uContrast + .5 + uBright, 0., 1.);
        float t = b8(cell);
        float k = clamp(floor(l * uLevels + t), 0., uLevels);
        float i = floor(k * 3. / uLevels + .5);
        vec3 col = i < .5 ? uPal[0] : i < 1.5 ? uPal[1] : i < 2.5 ? uPal[2] : uPal[3];
        vec2 f = mod(gl_FragCoord.xy, uPx);
        if (uGrid > .5 && (f.x < 1. || f.y < 1.)) col = mix(col, uPal[3], uGap);
        float a = step(.5, c.a) * step(t, uReveal * 1.001);
        gl_FragColor = vec4(col, a);
      }`,
  })
  const postScene = new THREE.Scene()
  const postQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), post)
  postScene.add(postQuad)
  const postCam = new THREE.Camera()

  // ready: modelo carregado, shaders compilados e texturas na GPU — sem isso, o
  // 1º quadro visível fazia tudo de uma vez no meio do scroll (utils/warmup.js).
  // A cena compila com o render target ligado: é com ele que ela é desenhada
  // (o programa muda com o destino), e o passe de post no canvas
  const ready = loaded.then(async () => {
    if (disposed) return
    renderer.setRenderTarget(rt)
    const sceneDone = renderer.compileAsync(scene, camera)
    renderer.setRenderTarget(null)
    await Promise.all([sceneDone, renderer.compileAsync(postScene, postCam)])
    if (disposed) return
    renderer.setRenderTarget(rt)
    drawAll(renderer, scene, camera) // sobe as texturas do modelo e usa cada shader (invisível: só o rt; ver utils/warmup.js)
    renderer.setRenderTarget(null)
    renderer.render(postScene, postCam) // (o passe de post também: o 1º uso dele travava)
  }).catch(() => {})

  let basePx = 1
  const applySize = () => {
    const { clientWidth: w, clientHeight: h } = canvas
    if (!w || !h) return
    renderer.setSize(w, h, false)
    const dpr = renderer.getPixelRatio()
    rt.setSize(w * dpr, h * dpr)
    post.uniforms.uRes.value.set(w * dpr, h * dpr)
    basePx = Math.max(1, Math.round(pixel * dpr))
    // grade só no tamanho de repouso — o ponto engrossado pelo foco não a ganha
    post.uniforms.uGrid.value = basePx > 2 ? 1 : 0
    camera.aspect = w / h
    camera.updateProjectionMatrix()
  }
  const resizeObserver = new ResizeObserver(applySize)
  resizeObserver.observe(canvas)
  // Resolução do render em relação ao tamanho do canvas (opcional; padrão 1). Para
  // quando o canvas é encolhido por um transform de fora: renderizar no tamanho em
  // que ele de fato aparece (LAB da transição 6 → Work)
  const setResolution = (r) => {
    if (Math.abs(renderer.getPixelRatio() - r) < 1e-3) return
    renderer.setPixelRatio(r)
    applySize()
  }

  // Intro: pontos dissolvem + giro até o repouso; render pausa fora da tela.
  // autoPlay: repete a cada entrada. Senão: escondida (introStart = +∞ → t
  // negativo) até o primeiro play(); chamadas seguintes não reiniciam.
  let introStart = reduceMotion || autoPlay ? -Infinity : Infinity
  let played = false
  let visible = false
  const play = () => {
    if (reduceMotion) { introStart = -Infinity; return }
    if (!autoPlay && played) return
    played = true
    introStart = performance.now()
  }
  const intersectionObserver = new IntersectionObserver(([e]) => {
    visible = e.isIntersecting
    if (visible && autoPlay) play()
  }, { threshold: autoPlay ? 0.4 : 0 })
  intersectionObserver.observe(canvas)
  const ease = (t) => 1 - Math.pow(1 - Math.min(Math.max(t, 0), 1), 3)

  // Renderiza menos durante scroll ativo — ver setScrolling(). Giro/uniforms
  // continuam atualizando todo frame (barato); só os dois render() caros
  // (cena 3D + passe de post-process) ficam de fora nos frames pulados.
  let isScrolling = false
  let frameCounter = 0
  // Entradas do scroll: giro (setTurn, deslocamento do ângulo em relação ao
  // repouso), deslocamento lateral da trilha (setShift, px) e posição do
  // scroll (setScroll, px). As velocidades saem da diferença entre frames.
  let turnTarget = 0
  let shift = 0
  let scroll = 0
  let lastShift = 0
  let lastScroll = 0
  let lastTurnTarget = 0
  let hasTurn = false
  let turnVel = 0 // rad / s do alvo do giro (suavizada como as outras)
  let shiftVel = 0 // larguras de tela / s
  let scrollVel = 0 // alturas de tela / s
  const turnS = { x: 0, v: 0 }
  const tiltS = { x: 0, v: 0 }
  // tranco do esbarrão, à parte do acompanhamento do scroll (alvo 0)
  const turnB = { x: 0, v: 0 }
  const tiltB = { x: 0, v: 0 }
  let hold = 0
  // pose dirigida de fora (setPose), somada ao resto: giro em Y e inclinação pela base
  let poseYaw = 0
  let posePitch = 0
  let blur = 0
  let hitAmt = 0 // impacto do esbarrão (1 → 0)
  let tune = reduceMotion ? 1 : initialTune
  let lastNow = 0

  renderer.setAnimationLoop((now) => {
    const dt = lastNow ? Math.min(0.1, (now - lastNow) / 1000) : 0
    lastNow = now
    // Fora da tela as posições continuam sendo acompanhadas — senão a volta
    // à tela leria todo o trajeto perdido como um único salto de velocidade.
    if (dt > 0) {
      const k = 1 - Math.pow(1 - VEL_SMOOTH, dt * 60)
      shiftVel += ((shift - lastShift) / dt / window.innerWidth - shiftVel) * k
      scrollVel += ((scroll - lastScroll) / dt / window.innerHeight - scrollVel) * k
      turnVel += ((turnTarget - lastTurnTarget) / dt - turnVel) * k
    }
    lastShift = shift
    lastScroll = scroll
    lastTurnTarget = turnTarget
    // Fora da tela o relógio da entrada também pausa: a TV desliza de fora
    // da tela (useManifestoS2Enter) e o play() vem antes dela aparecer — sem
    // isso os pontos terminavam de se formar invisíveis e ela já surgia pronta.
    if (!visible) { if (Number.isFinite(introStart)) introStart += dt * 1000; return }

    let moving = false
    if (!reduceMotion && dt > 0) {
      moving = stepSpring(turnS, turnTarget, TURN_SPRING, dt, turnVel)
      const lean = Math.max(-TILT_MAX, Math.min(TILT_MAX, shiftVel * TILT_GAIN))
      moving = stepSpring(tiltS, lean, TILT_SPRING, dt) || moving
      moving = stepSpring(turnB, 0, TURN_SPRING, dt) || moving
      moving = stepSpring(tiltB, 0, TILT_SPRING, dt) || moving
      const [s0, s1] = BLUR_SPEED
      const target = Math.min(1, Math.max(0, (Math.abs(scrollVel) - s0) / (s1 - s0)))
      blur += (target - blur) * (1 - Math.pow(1 - (target > blur ? BLUR_ATTACK : BLUR_RELEASE), dt * 60))
      if (blur < 0.001) blur = 0
      moving ||= blur > 0
      // impacto do esbarrão: decai em ~0.6s
      if (hitAmt > 0) { hitAmt *= Math.pow(0.004, dt); if (hitAmt < 0.002) hitAmt = 0; moving = true }
    }
    const t = (now - introStart) / 1000
    post.uniforms.uReveal.value = ease((t - 0.1) / revealDuration)
    // no impacto o dither "estoura" (pontos maiores) por um instante
    post.uniforms.uPx.value = Math.round(basePx * (1 + blur * BLUR_PX + hitAmt * HIT_PX))
    post.uniforms.uLevels.value = 3 - Math.round(blur * 2)
    // hold (setHold): perto do esbarrão a pose segue o scroll sem a massa
    // (giro exato do alvo, sem inclinação) — é a pose em que o toque foi
    // medido; o tranco (turnB/tiltB) continua por cima
    pivot.rotation.y = restAngle - 2 * (1 - ease(t / spinDuration)) + turnS.x + (turnTarget - turnS.x) * hold + turnB.x + poseYaw
    tilt.rotation.z = tiltS.x * (1 - hold) + tiltB.x
    tilt.rotation.x = posePitch
    // tremor curto e forte do impacto (além do balanço na mola)
    tilt.position.x = Math.sin(now * 0.09) * HIT_SHAKE * hitAmt
    if (mixer && dt > 0 && !reduceMotion) mixer.update(dt)
    if (screen) {
      screen.material.uniforms.uTime.value = now / 1000
      // tela perde a sintonia no impacto (rola, chia) e volta
      screen.material.uniforms.uTune.value = tune * (1 - hitAmt * HIT_DETUNE)
    }

    frameCounter++
    // em movimento, renderiza todo frame (senão o giro engasga)
    if (isScrolling && !moving && frameCounter % 3 !== 0) return

    renderer.setRenderTarget(rt)
    renderer.render(scene, camera)
    renderer.setRenderTarget(null)
    renderer.render(postScene, postCam)
  })

  function setScrolling(scrolling) {
    isScrolling = Boolean(scrolling)
  }

  function dispose() {
    disposed = true
    renderer.setAnimationLoop(null)
    mixer?.stopAllAction()
    resizeObserver.disconnect()
    intersectionObserver.disconnect()
    screen?.dispose()
    scene.environment.dispose()
    pmrem.dispose()
    rt.dispose()
    post.dispose()
    postQuad.geometry.dispose()
    renderer.dispose()
    // só dispose deixava o contexto vivo: 1 a mais a cada volta do contato (o Chrome
    // derruba a partir de ~16). O canvas é do React: só perde o contexto se saiu da
    // página — o StrictMode do dev remonta no mesmo canvas, e o contexto perdido voltaria
    if (!canvas.isConnected) renderer.forceContextLoss()
  }

  const setTurn = (offset) => { turnTarget = offset; if (!hasTurn) { lastTurnTarget = offset; hasTurn = true } }
  // A primeira leitura vira referência (não um salto a partir de 0).
  let hasShift = false
  let hasScroll = false
  const setShift = (px) => { shift = px; if (!hasShift) { lastShift = px; hasShift = true } }
  const setScroll = (px) => { scroll = px; if (!hasScroll) { lastScroll = px; hasScroll = true } }
  const setTune = (p) => { if (!reduceMotion) tune = Math.min(1, Math.max(0, p)) }
  // Boot da tela (opcional): null = só a imagem; (early, logo) 0..1 = etapas
  // antes do logo e varredura do logo. Só um valor (LAB antigo): a curva
  // única de antes — terminal some em 0.64, logo de 0.4 a 1.
  let boot = null
  const setBoot = (p, logo) => {
    boot = p === null ? null : logo === undefined ? [p / 0.64, (p - 0.4) / 0.6] : [p, logo]
    screen?.setBoot(...(boot ?? [null]))
  }
  // Esbarrão (opcional): impulso nas molas de inclinação (balança na base)
  // e de giro. s ~ -1..1 (sinal = lado do empurrão, módulo = força).
  const bump = (s) => {
    if (reduceMotion) return
    hitAmt = Math.min(1, hitAmt + Math.min(1, 0.55 + Math.abs(s) * 0.6))
    tiltB.v += s * BUMP_TILT
    // o empurrão gira a TV para a esquerda (a mola devolve): base fixa + um
    // pouco da força, para ser visível mesmo rolando devagar
    turnB.v -= Math.sign(s) * (BUMP_TURN + Math.abs(s) * BUMP_TURN * 0.5)
  }
  // 0..1: quanto a pose ignora a massa (ver hold no loop)
  const setHold = (w) => { hold = reduceMotion ? 0 : Math.min(1, Math.max(0, w)) }
  // Caixa do modelo projetada na tela (px CSS do canvas), com o giro atual —
  // para saber onde o PC está DESENHADO (o canvas é bem maior que ele).
  // turn (opcional): mede como se o giro fosse esse e a TV estivesse em pé,
  // sem tremor (a pose do esbarrão — ver hold)
  const withTurn = (turn, fn) => {
    // A câmera fica fora da cena: só o render atualiza a matriz dela. O GLB
    // costuma carregar antes do 1º render (a TV ainda entra de fora da tela),
    // e aí a medida saía com a câmera na origem — o toque ~1/3 do PC abaixo.
    camera.updateMatrixWorld()
    // idem a proporção, se o ResizeObserver ainda não rodou
    const aspect = canvas.clientWidth / canvas.clientHeight
    if (aspect && Math.abs(camera.aspect - aspect) > 1e-3) { camera.aspect = aspect; camera.updateProjectionMatrix() }
    if (turn == null) { scene.updateMatrixWorld(); return fn() }
    const keep = [pivot.rotation.y, tilt.rotation.z, tilt.position.x]
    pivot.rotation.y = restAngle + turn
    tilt.rotation.z = 0
    tilt.position.x = 0
    scene.updateMatrixWorld()
    const out = fn()
    ;[pivot.rotation.y, tilt.rotation.z, tilt.position.x] = keep
    scene.updateMatrixWorld()
    return out
  }
  const projBox = (turn) => withTurn(turn, () => {
    if (!modelHolder) return null
    const b = new THREE.Box3().setFromObject(modelHolder)
    const w = canvas.clientWidth, h = canvas.clientHeight
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
    for (let i = 0; i < 8; i++) {
      const v = new THREE.Vector3(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z).project(camera)
      const px = ((v.x + 1) / 2) * w, py = ((1 - v.y) / 2) * h
      x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py)
    }
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
  })
  // O pixel (px CSS do canvas) cai em cima do PC? Raycast na malha real.
  const ray = new THREE.Raycaster()
  const hit = (px, py, turn) => withTurn(turn, () => {
    if (!modelHolder) return false
    ray.setFromCamera(new THREE.Vector2((px / canvas.clientWidth) * 2 - 1, 1 - (py / canvas.clientHeight) * 2), camera)
    return ray.intersectObject(modelHolder, true).length > 0
  })
  const setScreenVisible = (v) => { screenVisible = v; if (screen) screen.visible = v }
  // O vidro (screenShape, sem a curva) projetado na tela, em frações do canvas —
  // para alinhar uma tela feita em DOM por cima dele (LAB da transição 6 → Work)
  const projScreen = (turn) => withTurn(turn, () => {
    if (!modelHolder) return null
    const { CX = 0, CY, HX, HY, Z0 } = screenShape
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
    for (const [u, v] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const p = pivot.localToWorld(new THREE.Vector3(CX + u * HX, CY + v * HY, Z0).multiplyScalar(screenScale)).project(camera)
      const px = (p.x + 1) / 2, py = (1 - p.y) / 2
      x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py)
    }
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
  })
  // Os 4 cantos do vidro na pose atual, em frações do canvas: [↖, ↗, ↘, ↙] —
  // para deformar a tela em DOM e mantê-la no vidro com o modelo girando
  const projScreenQuad = () => withTurn(undefined, () => {
    if (!modelHolder) return null
    const { CX = 0, CY, HX, HY, Z0 } = screenShape
    return [[-1, 1], [1, 1], [1, -1], [-1, -1]].map(([u, v]) => {
      const p = pivot.localToWorld(new THREE.Vector3(CX + u * HX, CY + v * HY, Z0).multiplyScalar(screenScale)).project(camera)
      return [(p.x + 1) / 2, (1 - p.y) / 2]
    })
  })
  // Pose dirigida de fora (opcional; rad): giro em Y e inclinação para trás pela
  // base. Vale já (as matrizes são atualizadas, projScreenQuad mede esta pose) e
  // o loop a mantém nos quadros seguintes.
  const setPose = (yaw, pitch) => {
    pivot.rotation.y += yaw - poseYaw
    tilt.rotation.x = pitch
    poseYaw = yaw
    posePitch = pitch
  }
  // Luz saindo da tela (opcional): uma luz pontual logo à frente do vidro, que
  // ilumina o próprio aparelho — a tela como a luz da sala escura (0 = apagada)
  let screenLight = null
  const setScreenLight = (intensity) => {
    if (!screenLight) {
      if (!modelHolder) return
      const { CX = 0, CY, Z0 } = screenShape
      screenLight = new THREE.PointLight(0xffffff, 0, 2.6)
      screenLight.position.set(CX, CY, Z0 + 0.35).multiplyScalar(screenScale)
      pivot.add(screenLight)
    }
    screenLight.intensity = intensity
  }

  return { ready, play, dispose, setScrolling, setTurn, setShift, setScroll, setTune, setScreenVisible, setScreenShape, setBoot, bump, setHold, projBox, hit, projScreen, projScreenQuad, setPose, setScreenLight, setResolution }
}
