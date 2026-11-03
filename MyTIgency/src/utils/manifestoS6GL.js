// Texto, imagens e grade de pontos da seção 6 do Manifesto em WebGL
// (utils/manifestoS6.js; portado do /lab/secao6/v11/gl.js).
//
// TEXTO — cada linha vira um quad com a própria textura, desenhada num canvas
// 2D nas posições que o DOM mediu (o DOM continua sendo o layout e a
// interface do editor por cima). As imagens entre as palavras ficam numa
// segunda textura do mesmo quad (mesmas coordenadas), então recebem exatamente
// o mesmo movimento das letras.
// Entrada (por pixel, a partir do progresso uE): as letras sobem de trás de uma
// máscara na base da linha, da esquerda para a direita, ondulando como na água,
// com rastro vermelho e saindo do desfoque; a linha começa curvada para trás
// nas pontas (vertex). A linha digitada não usa nada disso: só aparece até a
// ponta do cursor de texto (uRevealX), nítida.
// Imagens: em cor ou no dither de 4 cinzas do site (o mesmo da TV e do cursor
// 3D), em células de 3 px de tela. Texto: papel.
// "lendo": fica oca (contorno de 1,5 px, papel a 60% — a "promessas" da cena A).
// Também: lupa sob a bola do cursor, desfoque leve das linhas fora de foco,
// grão. A câmera em perspectiva é posta de modo que z = 0 caia 1:1 em px.
import * as THREE from 'three'
import { drawAll } from './warmup'

const FOV = 35
const STRETCH_KW = [[56, 'ultra-condensed'], [69, 'extra-condensed'], [81, 'condensed'], [94, 'semi-condensed'], [106, 'normal'], [119, 'semi-expanded'], [131, 'expanded']]

const GLSL_UTIL = /* glsl */ `
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float b2(vec2 p) { p = floor(p); return fract(p.x * 0.5 + p.y * p.y * 0.75); }
float b4(vec2 p) { return b2(p * 0.5) * 0.25 + b2(p); }
`

const VERT = /* glsl */ `
uniform float uBend;
uniform float uW;
varying vec2 vUv;
void main() {
  vUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  float x = position.x * 2.0;
  wp.z -= uBend * uW * 0.45 * x * x;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`

const FRAG = /* glsl */ `
precision highp float;
uniform sampler2D uTex;
uniform vec2 uSize;
uniform vec3 uColor;
uniform vec3 uInk;
uniform vec3 uRed;
uniform float uAlpha, uE, uFx, uStag, uType, uRise, uBoxBot, uWave, uBlurMax, uTrail, uRgbMax, uRGB, uMotion, uDefocus;
uniform float uGrain, uTime, uInvX, uRevealX, uHollow, uDpr, uViewH, uImgMode;
uniform sampler2D uImg;
uniform vec3 uMouse;
uniform float uMouseR;
varying vec2 vUv;
${GLSL_UTIL}
vec4 T(vec2 uv) {
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return vec4(0.0);
  return texture2D(uTex, uv);
}
// cobertura das letras (as imagens moram em outra textura, uImg)
float A(vec2 uv) { return T(uv).a; }
vec4 TI(vec2 uv) {
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return vec4(0.0);
  return texture2D(uImg, uv);
}
// foco + movimento da câmera: disco de 16 amostras, alongado no y
float S(vec2 uv, vec2 px, float blur, float motion) {
  if (blur < 0.3 && motion < 0.3) return A(uv);
  float s = 0.0;
  for (int i = 0; i < 16; i++) {
    float fi = float(i);
    float ang = fi * 2.39996;
    float rr = sqrt((fi + 0.5) / 16.0);
    vec2 o = vec2(cos(ang), sin(ang)) * rr * blur * px;
    o.y += (fi / 15.0 - 0.5) * motion * px.y;
    s += A(uv + o);
  }
  return s / 16.0;
}
vec3 pal(float i) {
  return i < 0.5 ? vec3(0.078) : i < 1.5 ? vec3(0.373) : i < 2.5 ? vec3(0.725) : vec3(0.957, 0.953, 0.937);
}

void main() {
  if (vUv.x > uRevealX) discard;
  vec2 px = 1.0 / uSize;
  vec2 sp = vec2(gl_FragCoord.x, uViewH * uDpr - gl_FragCoord.y) / uDpr; // px de tela, do topo
  // progresso local: da esquerda para a direita; a linha digitada fica nítida
  float el = uType > 0.5 ? 1.0 : clamp(uE * (1.0 + uStag) - vUv.x * uStag, 0.0, 1.0);
  float k = pow(1.0 - el, 3.0) * uFx;
  vec2 uv = vUv;
  // lupa: o que está sob a bola incha
  if (uMouse.z > 0.001) {
    vec2 p = uv * uSize;
    vec2 d = p - uMouse.xy;
    float f = exp(-dot(d, d) / (uMouseR * uMouseR)) * uMouse.z;
    uv = (p - d * f * 0.45) / uSize;
  }
  // sobe de trás da máscara, ondulando como na água
  uv.y -= k * uRise;
  uv.y += sin(uv.x * 7.0 + uTime * 2.4) * k * uWave;
  uv.x += sin(uv.y * 9.0 - uTime * 1.7) * k * uWave * 0.12;

  float blur = k * uBlurMax + uDefocus;
  float ag = S(uv, px, blur, uMotion);
  // palavra oca: só o contorno (o que sobra quando se subtrai a letra encolhida)
  if (uHollow > 0.001) {
    float er = 1.0;
    for (int i = 0; i < 8; i++) {
      float ang = float(i) * 0.785398;
      er = min(er, A(uv + vec2(cos(ang), sin(ang)) * 1.5 * px));
    }
    ag = mix(ag, clamp(ag - er, 0.0, 1.0) * 0.6, uHollow);
  }
  float ar = ag;
  float ab = ag;
  float rgb = k * uRgbMax + uRGB;
  if (rgb > 0.2) {
    ar = S(uv + vec2(rgb * px.x, 0.0), px, blur, uMotion);
    ab = S(uv - vec2(rgb * px.x * 0.7, 0.0), px, blur, uMotion);
    if (uHollow > 0.001) { ar = mix(ar, ag, uHollow); ab = mix(ab, ag, uHollow); }
  }
  // rastro do movimento (para baixo, de onde a letra veio); o vermelho fica mais longo
  float tr = k * uTrail;
  if (tr > 0.0005) {
    float tg = 0.0;
    float trr = 0.0;
    for (int i = 1; i <= 8; i++) {
      float f = float(i) / 8.0;
      tg += A(uv + vec2(0.0, tr * f));
      trr += A(uv + vec2(0.0, tr * f * 1.8));
    }
    ag = max(ag, tg / 8.0 * 0.5);
    ab = max(ab, tg / 8.0 * 0.5);
    ar = max(ar, trr / 8.0 * 0.95);
  }
  vec3 base = vUv.x < uInvX ? uInk : uColor;
  vec3 col = base * ag + uRed * max(ar - ag, 0.0) + uColor * max(ab - ag, 0.0) * 0.5;
  float a = max(ag, max(ar, ab));

  // imagens: entram no dither de 4 cinzas do site (células de 3 px de tela) e se
  // revelam em cor célula a célula, na ordem da matriz de Bayer (uImgMode 0 → 1)
  vec4 ti = TI(uv);
  float ia = ti.a;
  if (ia > 0.001) {
    vec2 cell = floor(sp / 3.0);
    if (b4(cell) < uImgMode - 0.001) {
      col += ti.rgb * ia;
    } else {
      float lv = clamp(dot(ti.rgb, vec3(0.299, 0.587, 0.114)), 0.0, 1.0) * 3.0;
      float idx = floor(lv) + step(b4(cell), fract(lv));
      col += pal(min(idx, 3.0)) * ia;
    }
    a += ia;
  }

  // máscara na base da linha, só durante a entrada
  float mask = mix(1.0, smoothstep(uBoxBot - 0.004, uBoxBot + 0.012, vUv.y), smoothstep(0.0, 0.04, k));
  float fade = uFx > 0.5 ? smoothstep(0.0, 0.45, el) : el;
  float gr = 1.0 - uGrain * hash(gl_FragCoord.xy + fract(uTime) * 91.0);
  gl_FragColor = vec4(col, min(a, 1.0)) * uAlpha * gr * mask * fade;
}`

const GRID_FRAG = /* glsl */ `
precision highp float;
uniform vec2 uRes;
uniform float uDpr, uReveal, uUi, uTime;
${GLSL_UTIL}
void main() {
  vec2 p = gl_FragCoord.xy / uDpr;
  p.y = uRes.y - p.y;
  float xr = p.x / uRes.x;
  // entrada: os pontos nascem tortos e ralos e vão se firmando,
  // da direita (que chega primeiro) para a esquerda
  float form = clamp(uReveal * 1.5 - (1.0 - xr) * 0.5, 0.0, 1.0);
  float wob = 1.0 - form;
  p.x += sin(p.y * 0.035 + uTime * 1.3 + floor(p.x / 32.0) * 1.7) * 5.0 * wob;
  p.y += sin(p.x * 0.03 - uTime * 1.1 + floor(p.y / 32.0) * 2.3) * 5.0 * wob;
  // canto esquerdo: os pontos incham e ficam instáveis, misturados ao fundo
  float left = 1.0 - smoothstep(0.16, 0.62, length(vec2(xr / 1.4, (p.y / uRes.y - 0.55) / 1.2)));
  vec2 d = abs(fract(p / 32.0 + 0.5) - 0.5) * 32.0;
  float w = mix(0.8, 3.4, left);
  float pt = 1.0 - smoothstep(0.0, w * 0.6 + 0.9, length(d));
  // e cada ponto acende aos poucos (opacidade), com o próprio atraso, junto da formação
  float lag = hash(floor(p / 32.0 + 0.5)) * 0.5;
  float a = pt * mix(0.22, 0.16, left) * smoothstep(lag, lag + 0.5, form);
  // o pisca: um limiar Bayer em células de 3 px que ferve a 12,5 quadros/s;
  // a densidade cresce com a formação, e no canto esquerdo fica rala para sempre
  float boil = floor(uTime * 12.5);
  float th = b4(floor(p / 3.0) + vec2(boil * 1.7, boil * 3.1));
  float dens = form * (1.0 - left * 0.8);
  a *= step(th + 0.001, dens) * (1.0 + left * 0.5);
  // a grade some junto com a interface
  float alpha = a * uUi;
  gl_FragColor = vec4(vec3(0.957, 0.953, 0.937) * alpha, alpha);
}`

export function mountTextGL(canvas) {
  let renderer
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, premultipliedAlpha: true })
  } catch {
    return null
  }
  renderer.setClearColor(0x000000, 0)
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(FOV, 1, 1, 20000)
  const geo = new THREE.PlaneGeometry(1, 1, 96, 1)
  const lines = []
  const paper = new THREE.Color('#f4f3ef')
  const ink = new THREE.Color('#141414')
  const red = new THREE.Color('#ff4438')

  function resize(w, h) {
    const dpr = Math.min(2, devicePixelRatio || 1)
    renderer.setPixelRatio(dpr)
    renderer.setSize(w, h, false)
    for (const l of lines) { l.u.uDpr.value = dpr; l.u.uViewH.value = h }
    const dist = h / 2 / Math.tan((FOV * Math.PI) / 360)
    camera.aspect = w / h
    camera.position.set(w / 2, -h / 2, dist)
    camera.lookAt(w / 2, -h / 2, 0)
    camera.far = dist * 6
    camera.updateProjectionMatrix()
  }

  function addLine() {
    const cv = document.createElement('canvas')
    const ctx = cv.getContext('2d')
    const tex = new THREE.CanvasTexture(cv)
    tex.minFilter = THREE.LinearFilter
    tex.generateMipmaps = false
    // as imagens numa textura à parte (mesmo tamanho e mesmas coordenadas da do texto)
    const icv = document.createElement('canvas')
    const ictx = icv.getContext('2d')
    const itex = new THREE.CanvasTexture(icv)
    itex.minFilter = THREE.LinearFilter
    itex.generateMipmaps = false
    const num = (v) => ({ value: v })
    const u = {
      uTex: num(tex), uSize: num(new THREE.Vector2(1, 1)), uW: num(1), uBend: num(0),
      uColor: num(paper), uInk: num(ink), uRed: num(red),
      uAlpha: num(0), uE: num(0), uFx: num(1), uStag: num(0.6), uType: num(0), uRise: num(0), uBoxBot: num(0),
      uWave: num(0), uBlurMax: num(0), uTrail: num(0), uRgbMax: num(0), uRGB: num(0), uMotion: num(0), uDefocus: num(0),
      uGrain: num(0), uTime: num(0), uInvX: num(-1), uRevealX: num(2), uHollow: num(0), uDpr: num(1), uViewH: num(1),
      uMouse: num(new THREE.Vector3()), uMouseR: num(60),
      uImg: num(itex), uImgMode: num(0),
    }
    const mat = new THREE.ShaderMaterial({
      uniforms: u, vertexShader: VERT, fragmentShader: FRAG,
      transparent: true, depthTest: false, depthWrite: false, premultipliedAlpha: true,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.visible = false
    scene.add(mesh)
    const line = {
      u,
      /**
       * desenha a linha. glyphs [{ch, x, top, h}] e images [{x, top, w, h, src}] em px do .t
       * (src: canvas/imagem já carregada; a imagem é cortada em retângulo, como cover);
       * pad em px; res = px de textura por px css
       */
      draw({ width, height, font, glyphs, images = [], pad, res }) {
        const tw = Math.ceil((width + pad.x * 2) * res)
        const th = Math.ceil((height + pad.y * 2) * res)
        // o three reserva o espaço da textura uma vez só: mudou o tamanho, precisa recriar
        if (tw !== cv.width || th !== cv.height) { tex.dispose(); itex.dispose() }
        cv.width = tw
        cv.height = th
        ctx.setTransform(res, 0, 0, res, 0, 0)
        ctx.clearRect(0, 0, cv.width, cv.height)
        ctx.font = font
        ctx.fillStyle = '#fff'
        ctx.textBaseline = 'alphabetic'
        const m = ctx.measureText('Hg')
        const asc = m.fontBoundingBoxAscent
        const desc = m.fontBoundingBoxDescent
        for (const g of glyphs) ctx.fillText(g.ch, pad.x + g.x, pad.y + g.top + (g.h - (asc + desc)) / 2 + asc)
        icv.width = cv.width
        icv.height = cv.height
        ictx.setTransform(res, 0, 0, res, 0, 0)
        ictx.clearRect(0, 0, icv.width, icv.height)
        for (const im of images) ictx.drawImage(rect(im, res), pad.x + im.x, pad.y + im.top, im.w, im.h)
        tex.needsUpdate = true
        itex.needsUpdate = true
      },
      /** posição na tela (px do contêiner): centro, tamanho, giro (rad) */
      place(cx, cy, w, h, rot = 0) {
        mesh.position.set(cx, -cy, 0)
        mesh.scale.set(w, h, 1)
        mesh.rotation.z = -rot
        u.uSize.value.set(w, h)
        u.uW.value = w
      },
      show(on) { mesh.visible = on },
      dispose() { tex.dispose(); itex.dispose(); mat.dispose() },
    }
    lines.push(line)
    return line
  }

  return {
    resize,
    addLine,
    /** compila os shaders das linhas antes do 1º quadro e os usa uma vez (utils/warmup.js) */
    warm: () => renderer.compileAsync(scene, camera).then(() => { drawAll(renderer, scene, camera, { all: true }); renderer.clear() }),
    render(time) {
      for (const l of lines) l.u.uTime.value = time
      renderer.render(scene, camera)
    },
    dispose() {
      for (const l of lines) l.dispose()
      geo.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
    },
  }
}

// a imagem cortada em retângulo de canto quase vivo (como "cover"); a cor fica, o shader decide o dither
function rect({ w, h, src }, res) {
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(w * res))
  c.height = Math.max(1, Math.round(h * res))
  const x = c.getContext('2d')
  x.beginPath()
  x.roundRect(0, 0, c.width, c.height, c.height * 0.04)
  x.clip()
  const sw = src.naturalWidth || src.width
  const sh = src.naturalHeight || src.height
  const s = Math.max(c.width / sw, c.height / sh)
  x.drawImage(src, (c.width - sw * s) / 2, (c.height - sh * s) / 2, sw * s, sh * s)
  return c
}

/** placeholder enquanto a foto não chega: um degradê com manchas (o dither mostra o volume) */
export function placeholderImage(seed = 1) {
  const c = document.createElement('canvas')
  c.width = 600
  c.height = 300
  const x = c.getContext('2d')
  const g = x.createLinearGradient(0, 0, 600, 300)
  g.addColorStop(0, '#2a2a2a')
  g.addColorStop(1, '#bdbdbd')
  x.fillStyle = g
  x.fillRect(0, 0, 600, 300)
  let s = seed * 9301
  const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280 }
  for (let i = 0; i < 5; i++) {
    const rg = x.createRadialGradient(rnd() * 600, rnd() * 300, 0, rnd() * 600, rnd() * 300, 60 + rnd() * 160)
    rg.addColorStop(0, rnd() > 0.5 ? 'rgba(255,255,255,.85)' : 'rgba(0,0,0,.8)')
    rg.addColorStop(1, 'rgba(128,128,128,0)')
    x.fillStyle = rg
    x.fillRect(0, 0, 600, 300)
  }
  return c
}

/** a grade do fundo, num contexto próprio (fica atrás do DOM) */
export function mountGridGL(canvas) {
  let renderer
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, premultipliedAlpha: true })
  } catch {
    return null
  }
  renderer.setClearColor(0x000000, 0)
  const scene = new THREE.Scene()
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  const u = {
    uRes: { value: new THREE.Vector2(1, 1) }, uDpr: { value: 1 }, uReveal: { value: 0 }, uUi: { value: 1 },
    uTime: { value: 0 },
  }
  const mat = new THREE.ShaderMaterial({
    uniforms: u, fragmentShader: GRID_FRAG,
    vertexShader: 'void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }',
    transparent: true, depthTest: false, depthWrite: false, premultipliedAlpha: true,
    blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
  })
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat))
  let last = ''
  return {
    warm: () => renderer.compileAsync(scene, camera).then(() => { drawAll(renderer, scene, camera); renderer.clear() }),
    resize(w, h) {
      const dpr = Math.min(2, devicePixelRatio || 1)
      renderer.setPixelRatio(dpr)
      renderer.setSize(w, h, false)
      u.uRes.value.set(w, h)
      u.uDpr.value = dpr
      last = ''
    },
    /** reveal 0..1 (entrada), ui 0..1 (some no fim da seção, com a interface) */
    render(time, reveal, ui) {
      // o pontilhado "ferve" a 12,5 quadros/s: só redesenha quando algo muda
      const key = `${Math.floor(time * 12.5)}|${reveal.toFixed(4)}|${ui.toFixed(4)}`
      if (key === last) return
      last = key
      u.uTime.value = time
      u.uReveal.value = reveal
      u.uUi.value = ui
      renderer.render(scene, camera)
    },
    dispose() { mat.dispose(); renderer.dispose(); renderer.forceContextLoss() },
  }
}

/** "font" do canvas a partir do estilo calculado de uma letra do DOM */
export function canvasFont(cs) {
  const pct = parseFloat(cs.fontStretch) || 100
  const kw = (STRETCH_KW.find(([max]) => pct <= max) ?? STRETCH_KW.at(-1))[1]
  return { font: `${cs.fontStyle} ${cs.fontWeight} ${kw} ${cs.fontSize} ${cs.fontFamily}` }
}
