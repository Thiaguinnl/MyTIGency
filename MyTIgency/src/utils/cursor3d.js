// Cursor 3D do Manifesto (cursor.gltf, do hero-bitmap-cursor.html) em dither de 4 cinzas
// como a TV do site. Canvas do palco inteiro: o cursor nunca é cortado e a
// PONTA dele é a cabeça do traço vermelho — set(x, y, dir, settle) a cada
// scroll. Em viagem o eixo do cursor segue a tangente (corpo atrás da ponta); ao
// chegar (settle → 1) ele assenta na pose 3/4 e passa a reagir ao mouse.
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import cursorUrl from '../assets/cursor.gltf?url'

const TIP = new THREE.Vector3(-0.1533, 0.1533, 0) // ponta, nas coordenadas do modelo
const PALETTE = ['#141414', '#5f5f5f', '#b9b9b9', '#ffffff']
const FOV = 30
const CAM_Z = 8
const VIEW_H = 2 * CAM_Z * Math.tan((FOV / 2) * Math.PI / 180) // altura visível no plano z=0
const REST = { x: 0.35, y: -0.55, z: 0.1 } // 3/4, assentado na seção 3
const FLAT = { x: 0.12, y: -0.16, z: -0.2 } // quase chapado, de frente, borda esquerda vertical: cursor de interface real
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a))
const clamp = (v, a, b) => Math.min(b, Math.max(a, v))

/** size = altura do cursor em px (pode mudar a cada set()). */
/** before(now): chamado no começo de cada quadro, antes de renderizar. */
export async function mountCursor3D(canvas, { size = 200, before } = {}) {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false })
  renderer.setPixelRatio(1)
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 100)
  camera.position.set(0, 0, CAM_Z)
  const key = new THREE.DirectionalLight(0xffffff, 2.2)
  key.position.set(3, 4, 6)
  const fill = new THREE.DirectionalLight(0xffffff, 0.45)
  fill.position.set(-4, -2, 3)
  const rim = new THREE.DirectionalLight(0xff4438, 1.4) // borda vermelha
  rim.position.set(-3, 3, -4)
  scene.add(key, fill, rim, new THREE.AmbientLight(0xffffff, 0.35))

  const gltf = await new GLTFLoader().loadAsync(cursorUrl)
  const model = gltf.scene
  model.traverse((o) => { if (o.material) o.material.flatShading = true })
  const bbox = new THREE.Box3().setFromObject(model)
  const center = bbox.getCenter(new THREE.Vector3())
  const modelH = bbox.getSize(new THREE.Vector3()).y
  const AXIS = Math.atan2(TIP.y - center.y, TIP.x - center.x) // corpo → ponta
  model.position.copy(TIP).negate() // ponta na origem do pivô
  const pivot = new THREE.Group()
  pivot.add(model)
  scene.add(pivot)

  // cena → alvo → dither ordenado em 4 cinzas (células de 3px)
  const rt = new THREE.WebGLRenderTarget(1, 1, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter })
  const post = new THREE.ShaderMaterial({
    transparent: true,
    uniforms: { tMap: { value: rt.texture }, uRes: { value: new THREE.Vector2() }, uPal: { value: PALETTE.map((c) => new THREE.Color(c)) }, uReveal: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }',
    fragmentShader: `
      uniform sampler2D tMap; uniform vec2 uRes; uniform vec3 uPal[4]; uniform float uReveal;
      float b2(vec2 a){ a = floor(a); return fract(dot(a, vec2(.5, a.y * .75))); }
      float b4(vec2 a){ return b2(.5 * a) * .25 + b2(a); }
      float b8(vec2 a){ return b4(.5 * a) * .25 + b2(a); }
      void main(){
        vec2 cell = floor(gl_FragCoord.xy / 3.);
        vec4 c = texture2D(tMap, (cell + .5) * 3. / uRes);
        float t = b8(cell);
        float l = pow(dot(c.rgb, vec3(.299, .587, .114)), 1. / 2.2);
        float i = clamp(floor(l * 3. + t), 0., 3.);
        vec3 col = i < .5 ? uPal[0] : i < 1.5 ? uPal[1] : i < 2.5 ? uPal[2] : uPal[3];
        // a luz de borda vermelha vira acento (o resto é cinza)
        if (c.r - c.g > .22 && t < .7) col = vec3(1., .267, .22);
        gl_FragColor = vec4(col, step(.5, c.a) * step(t, uReveal * 1.001));
      }`,
  })
  const postScene = new THREE.Scene()
  postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), post))
  const postCam = new THREE.Camera()
  // compila antes do 1º quadro (com compilação paralela, sem travar): no 1º render a
  // espera pelos shaders caía no meio do scroll. A cena com o rt ligado: é o destino real
  renderer.setRenderTarget(rt)
  const sceneDone = renderer.compileAsync(scene, camera)
  renderer.setRenderTarget(null)
  await Promise.all([sceneDone, renderer.compileAsync(postScene, postCam)])

  let W = 1, H = 1, upp = 1 // unidades de mundo por px no plano z=0
  function resize() {
    W = canvas.clientWidth
    H = canvas.clientHeight
    renderer.setSize(W, H, false)
    rt.setSize(W, H)
    post.uniforms.uRes.value.set(W, H)
    camera.aspect = W / H
    camera.updateProjectionMatrix()
    upp = VIEW_H / H
  }
  resize()
  addEventListener('resize', resize)

  const goal = { x: -9999, y: 0, dir: Math.PI / 2, settle: 0, reveal: 0, size, flat: 0, aim: null }
  const mouse = { x: 0, y: 0, sx: 0, sy: 0 }
  const onMove = (e) => { mouse.x = (e.clientX / innerWidth) * 2 - 1; mouse.y = (e.clientY / innerHeight) * 2 - 1 }
  addEventListener('pointermove', onMove)
  let raf = 0, rz = 0, bank = 0, last = performance.now()
  const t0 = last
  // Sem cursor na tela o canvas sai da composição (visibility): um canvas
  // WebGL da tela inteira só limpo, sobre a Hero fixada + o cursor
  // contextual (mix-blend), deixava a página inteira preta.
  let hidden = true
  canvas.style.visibility = 'hidden'
  // canvas fora da viewport (mobile: ele fica no fluxo da página): não renderiza
  let inView = true
  const io = new IntersectionObserver(([e]) => { inView = e.isIntersecting })
  io.observe(canvas)
  function frame(now) {
    raf = requestAnimationFrame(frame)
    before?.(now)
    if (!inView) { last = now; return }
    // fora da tela: limpa uma vez e não renderiza (economiza o quadro do scroll)
    const m = goal.size * 2
    if (goal.x < -m || goal.x > W + m || goal.y < -m || goal.y > H + m) {
      if (!hidden) { canvas.style.visibility = 'hidden'; hidden = true }
      last = now
      return
    }
    if (hidden) { canvas.style.visibility = ''; hidden = false }
    const t = (now - t0) / 1000
    const dt = Math.min(0.1, (now - last) / 1000)
    last = now
    // amortecimento independente de fps (o mesmo "damp" de lerp das refs)
    const k = reduce ? 1 : 1 - Math.exp(-dt * 9)
    const s = goal.settle, fl = goal.flat
    const rest = { x: REST.x + (FLAT.x - REST.x) * fl, y: REST.y + (FLAT.y - REST.y) * fl, z: REST.z + (FLAT.z - REST.z) * fl }
    // posição presa ao traço (sem atraso), rotação com inércia
    pivot.position.set((goal.x - W / 2) * upp, -(goal.y - H / 2) * upp, 0)
    pivot.scale.setScalar((goal.size * upp) / modelH)
    const travel = goal.dir - AXIS // ponta na frente, corpo seguindo a linha
    const prev = rz
    const want = goal.aim ?? travel + wrap(rest.z - travel) * s // aim: giro pedido de fora
    rz += wrap(want - rz) * k
    // inclina para dentro da curva, como um avião de papel (velocidade angular)
    const turn = dt > 0 ? wrap(rz - prev) / dt : 0
    bank += (clamp(turn * 0.35, -0.7, 0.7) - bank) * k
    mouse.sx += (mouse.x - mouse.sx) * 0.06
    mouse.sy += (mouse.y - mouse.sy) * 0.06
    const live = (reduce ? 0 : 1) * (1 - fl) // na busca ele é um cursor de interface: parado
    const idle = Math.sin(t * 0.9) * 0.12 * live
    pivot.rotation.z = rz
    pivot.rotation.y = (rest.y + idle + mouse.sx * 0.35 * live) * s + (0.2 + bank) * (1 - s)
    pivot.rotation.x = (rest.x + mouse.sy * 0.25 * live) * s + 0.3 * (1 - s)
    post.uniforms.uReveal.value = reduce ? 1 : goal.reveal
    renderer.setRenderTarget(rt)
    renderer.render(scene, camera)
    renderer.setRenderTarget(null)
    renderer.render(postScene, postCam)
  }
  raf = requestAnimationFrame(frame)

  return {
    /** ponta em (x, y) px do canvas; dir = ângulo da tangente na tela (y para baixo). */
    set(x, y, dir, settle, reveal = 1, sz = goal.size, flat = 0, aim = null) { Object.assign(goal, { x, y, dir, settle, reveal, size: sz, flat, aim }) },
    /** giro (rad) em que o eixo corpo→ponta aponta para `dir`; e o giro da pose de interface */
    aimFor: (dir) => dir - AXIS,
    flatZ: FLAT.z,
    restZ: REST.z,
    /** centro do corpo relativo à ponta, em px (para centralizar o cursor). */
    body(sz = goal.size) { return [((center.x - TIP.x) * sz) / modelH, (-(center.y - TIP.y) * sz) / modelH] },
    dispose() {
      cancelAnimationFrame(raf)
      removeEventListener('pointermove', onMove)
      removeEventListener('resize', resize)
      io.disconnect()
      rt.dispose(); post.dispose(); renderer.dispose(); renderer.forceContextLoss()
    },
  }
}
