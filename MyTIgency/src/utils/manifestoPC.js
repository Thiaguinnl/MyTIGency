// Manifesto · fim da seção 6 → o PC → Trabalhos. Portado do /lab/secao6/v13
// (main.js), com a configuração aprovada fixa: o PC da seção 2 em imagem (sem
// dither), o wallpaper de colinas, dither → cor entrando do centro, texto papel,
// CRT alto; o entorno é a opção E (manifestoPCDesk.js: cartaz + mesa + folha).
//
// Tudo é função de p (useManifestoHorizontal), em alturas de tela a partir do fim
// da seção 6: HOLD0 com o cartaz parado, LEN de transição (T: 0 → 1, num capítulo
// com ímã: ver pcP) e TRAVEL.len da câmera inclinando até a folha (T2: 0 → 1). Uma
// transform só (o rig) leva a tela e o aparelho: começa cobrindo a viewport (o
// cartaz 1:1, igual ao fim da seção 6), encolhe até a tela 4:3 e dá o zoom out
// até o aparelho. O buraco da tela do aparelho cai exatamente na caixa do rig.
// A curva do tubo e as cores desalinhadas são o filtro SVG #pc-crt; scanlines,
// máscara, faixa, cintilação, grão, vinheta e vidro são camadas. O wallpaper é
// um shader: o preto se desfaz em dither (Bayer, os 4 cinzas do site) e o
// dither em cor, em 8 degraus — o mesmo idioma das fotos da seção 6.
// Lâmpada, degauss, cliques do cursor e molas andam em tempo real (rAF próprio,
// só com a cena ativa e na tela); cada camada só redesenha quando muda.
import * as THREE from 'three'
import { EDITOR, FIST, FIST_C, shadeOf, drawSprite, DCELL } from './ditherSprite'
import { mountPCDesk, TRAVEL } from './manifestoPCDesk'
import { drawAll } from './warmup'
import logoUrl from '../assets/logo.svg?url'
import pcUrl from '../assets/s6/pc/pc.png'
import wallUrl from '../assets/s6/pc/wallpaper.jpg'
import icoAlert from '../assets/s6/pc/ico-b-19.png'
import icoTxt from '../assets/s6/pc/ico-b-13.png'
import icoPc from '../assets/s6/pc/ico-b-17.png'
import icoBin from '../assets/s6/pc/ico-b-12.png'
import icoFolder from '../assets/s6/pc/ico-c-07.png'
import icoPrompt from '../assets/s6/pc/ico-b-11.png'

const clamp01 = (v) => Math.min(1, Math.max(0, v))
const ramp = (p, a, b) => clamp01((p - a) / (b - a))
const lerp = (a, b, t) => a + (b - a) * t
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)

// ---------- roteiro (frações de T) ----------
const HOLD0 = 0.35 // alturas de tela com o cartaz parado antes de começar
const LEN = 3.2 // alturas de tela da transição (T: 0 → 1)
/** alturas de tela de scroll que a cena pede no pin (reduced motion: o estado final, parado) */
export const pcLength = (reduce) => (reduce ? 1 : HOLD0 + LEN + TRAVEL.len)
// O capítulo com ímã: a transição segue o scroll, mas o hook (useManifestoHorizontal
// → snap) leva o scroll sozinho do clique no "apresentar" ao cartaz completo (ref.:
// shader.se), num caminho que diz quanto tempo cada trecho de T dura
/** o p de um T da transição */
export const pcP = (T) => HOLD0 + LEN * T
/** o fim do cartaz parado, em p: o PC começa a transição daqui */
export const pcHold = HOLD0
/** o p com o cartaz completo (barra em 99%, lâmpada acesa, adesivo) */
export const pcCartaz = (reduce) => (reduce ? 0.5 : HOLD0 + LEN * 0.99)
/** a partir deste p a câmera inclina para a folha (o botão de pular sai) */
export const pcTravelAt = (reduce) => (reduce ? Infinity : HOLD0 + LEN)
// Degauss: o "tum" que marca a virada de cartaz para monitor (tempo real, ao
// passar de at): clarão curto, anéis de cor que giram e se abrem, tremor e
// curva/cores do tubo oscilando — tudo amortecido em dur segundos. O tranco
// empurra o dither: a frente dispara do centro e desacelera (push do caminho, a
// 1 − e^(−pushK·s)), somada ao que o scroll anda, com uma crista clara na borda
// enquanto o impulso dura (e^(−waveK·s), até waveDur)
const DEGAUSS = { at: 0.07, dur: 1.3, push: 0.24, pushK: 4.5, waveK: 2.4, waveDur: 2 }
/** o T do tranco (o cartaz vira monitor, o dither entra): onde o botão de pular cai */
export const pcImpact = DEGAUSS.at
const TL = {
  crt: [0, 0.42], // a curva e os efeitos do tubo se espalham aos poucos
  shrink: [0, 0.36], // o cartaz encolhe até a tela 4:3
  wall: [DEGAUSS.at, 0.55], // preto → dither → cor (começa no tranco do degauss)
  zoom: [0.4, 0.86], // zoom out até o aparelho
  lights: [0.42, 0.8], // o aparelho sai do escuro
}
// A lâmpada é um evento, não um fade: ao passar de LAMP.at rolando para baixo,
// pisca em degraus (tempo real, ms → nível) e fica acesa; chegar depois do
// ponto já a encontra acesa; voltar para antes apaga.
// A piscada só toca se a lâmpada ficou apagada pelo menos rest ms: no vai-e-volta
// rápido em volta do ponto ela acende direto (senão a sala inteira piscava a cada passada).
const LAMP = { at: 0.76, rest: 4000, seq: [[0, 0.85], [55, 0.04], [150, 0.04], [190, 0.6], [250, 0.12], [400, 1]] }
// Câmera: no zoom out ela recua em arco e termina de frente; graus no meio do caminho
const CAM = { y: -10, x: 4, persp: 2.2 } // persp: distância da câmera em alturas de tela
// o cursor da seção 6 dentro da tela: o mesmo que clicou em "apresentar" e
// descansou ao lado de "trabalho." — fecha o "Aviso", abre Trabalhos com dois
// cliques e espera (ampulheta) até a barra chegar a 100% (T = 1)
const CUR = {
  toOk: [0.49, 0.55], ok: 0.56,
  toIcon: [0.575, 0.635], dbl: 0.645,
  open: 0.665,
  toWin: [0.675, 0.73],
}
const FIT = 0.84 // a tela (antes do zoom) ocupa esta fração da altura
const FINAL = 0.6 // o aparelho no fim: fração da altura (e no máx. 70% da largura)
// o PC da seção 2 (render recortado): tamanho da imagem e o buraco da tela, em px dela
const DEV = { w: 1228, h: 983, screen: { x: 204, y: 106, w: 638, h: 467 } }
const LEDS = { pow: [866, 676], hd: [527, 729] }
const REV = 2 // a revelação do wallpaper entra do centro

// ---------- Windows antigo ----------
const win = (title, text, btns = null, icon = null) => `<div class="w98"><div class="w98-t"><span>${title}</span><i>×</i></div>`
  + `<div class="w98-b">${icon ? `<img src="${icon}" alt="">` : ''}<p>${text}</p></div>`
  + (btns ? `<div class="w98-k">${btns.map((b) => `<b>${b}</b>`).join('')}</div>` : '<div class="w98-bar"></div>') + '</div>'
// a área de trabalho dentro da tela (px de um desktop de 800 de largura); os textos
// vêm do idioma da página (strings.js → pc)
const DESK_ICONS = (tx) => [icoPc, icoBin, icoFolder, icoTxt, icoPrompt].map((src, i) => [src, tx.icons[i]])
const DESK_T = { bar: 0.26, icons: [0.28, 0.42] }
const POPS_IN = (tx) => [ // [T, x, y, largura, html, classe, T em que fecha]
  [0.46, 586, 18, 200, win(tx.alert[0], tx.alert[1], tx.alert[2], icoAlert)],
  [0.47, 96, 26, 196, win(tx.notice[0], tx.notice[1], tx.notice[2]), 'aviso', CUR.ok], // o cursor obedece
  [0.57, 586, 266, 204, win(tx.txt[0], tx.txt[1], tx.txt[2], icoTxt)],
  [CUR.open, 590, 150, 196, win(tx.opening[0], `${tx.opening[1]} <span class="pct">0%</span>`), 'prog'],
]

// ---------- o cursor da seção 6, de volta (dentro da tela) ----------
const HOURGLASS = [[
  'kkkkkkkkkkk', 'kwwwwwwwwwk', 'kkkkkkkkkkk', '.kwwwwwwwk.', '.kwkkkkkwk.', '.kwwkkkwwk.', '..kwwkwwk..',
  '...kwwwk...', '....kwk....', '....kwk....', '...kwwwk...', '..kwwwwwk..', '.kwwwkwwwk.', '.kwwkkkwwk.',
  '.kwkkkkkwk.', '.kkkkkkkkk.', 'kkkkkkkkkkk', 'kwwwwwwwwwk', 'kkkkkkkkkkk',
], [5, 9]]
// as formas da seção 6 (o cursor é o mesmo: chega aqui em qualquer uma delas) e a ampulheta
const SPR = Object.fromEntries(Object.entries({ ...EDITOR, fist: [FIST, FIST_C], wait: HOURGLASS }).map(([k, [art, anchor]]) => [k, { art: shadeOf(art), anchor }]))
const CELL = 2.1 // px do desktop por pixel do desenho (com a tela já pequena; no começo, o tamanho que tinha na seção 6)
const RES = 2 // canvas do cursor em 2×
const HIT = { bump: 7, spin: 14, dbl: 0.18 } // recuo (px), giro (graus), intervalo do duplo clique (s)
const MORPH_MS = 160 // troca de forma (seta ↔ ampulheta), por limiar de Bayer
const TAU = 0.14 // inércia (s)
const damp = (a, b, tau, dt) => b + (a - b) * Math.exp(-dt / tau)
const jolt = (a, f = 26) => (a < 1.4 ? Math.exp(-a * 6) * Math.sin(a * f + 0.5) : 0)
const squash = (a, d) => 1 - d * (a < 1 ? Math.exp(-a * 10) : 0)

// ---------- vida no PC: pouso, inclinação pelo scroll, olhar para o cursor, LEDs ----------
// As molas da TV da seção 2 (tv3d.js: Euler semi-implícito em passos fixos)
// (sem o "olhar para o cursor" do LAB: com a mesa 3D parada, o PC girando com o mouse lia como um parallax solto)
const SPRING = {
  tilt: { k: 48, zeta: 0.26 },
  land: { k: 90, zeta: 0.32 },
}
const TILT = { gain: 2.4, max: 5 } // graus por (altura de tela / s) de scroll, e teto
const LAND = { drop: 300, kick: 18 }
const HD_BLINK = 0.45 // s piscando a cada janela que abre
const stepSpring = (s, target, { k, zeta }, dt) => {
  const c = 2 * zeta * Math.sqrt(k)
  for (let left = dt; left > 1e-6; left -= 1 / 120) {
    const h = Math.min(left, 1 / 120)
    s.v += (k * (target - s.x) - c * s.v) * h
    s.x += s.v * h
  }
}

const STAGE = `
  <svg width="0" height="0" style="position:absolute" aria-hidden="true">
    <filter id="pc-crt" x="0" y="0" width="1" height="1" primitiveUnits="objectBoundingBox" color-interpolation-filters="sRGB">
      <feImage id="pc-crt-map" x="0" y="0" width="1" height="1" preserveAspectRatio="none" result="map" />
      <feDisplacementMap id="pc-crt-bend" in="SourceGraphic" in2="map" scale="0" xChannelSelector="R" yChannelSelector="G" result="b" />
      <feColorMatrix in="b" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="r" />
      <feOffset id="pc-crt-r" in="r" dx="0" result="ro" />
      <feColorMatrix in="b" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="g" />
      <feColorMatrix in="b" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="bl" />
      <feOffset id="pc-crt-b" in="bl" dx="0" result="bo" />
      <feBlend in="ro" in2="g" mode="screen" result="rg" />
      <feBlend in="rg" in2="bo" mode="screen" />
    </filter>
  </svg>
  <div class="env-back"></div>
  <div class="pc-amb"><canvas></canvas></div>
  <div class="pc-cam">
    <canvas class="env-desk"></canvas>
    <div class="pc-rig">
      <div class="pc-spill"></div>
      <div class="pc-shadow"></div>
      <div class="pc-body">
        <div class="pc-crt">
          <div class="pc-crt-in">
            <canvas class="pc-wall"></canvas>
            <div class="pc-poster"><canvas class="pc-pvig"></canvas></div>
            <div class="pc-desk"></div>
            <div class="pc-fx pc-fx-scan"></div><div class="pc-fx pc-fx-mask"></div>
            <div class="pc-fx pc-fx-thump"></div>
          </div>
          <div class="pc-fx pc-fx-band"><canvas></canvas></div><div class="pc-fx pc-fx-flick"></div><div class="pc-fx pc-fx-noise"></div>
          <div class="pc-fx pc-fx-dg"><canvas></canvas></div>
          <div class="pc-fx pc-fx-vig"><canvas></canvas></div><div class="pc-fx pc-fx-glass"><canvas class="g-band"></canvas><canvas class="g-hl"></canvas></div>
        </div>
        <div class="pc-dev"><img alt="" src="${pcUrl}" /></div>
        <canvas class="pc-dev-glow"></canvas>
        <div class="pc-leds"><i class="pc-led-pow"></i><i class="pc-led-hd"></i></div>
      </div>
    </div>
  </div>
  <div class="env-front"></div>`

// o wallpaper: preto → dither → cor, por shader
function mountWall(canvas, onGlow) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false })
  const pr = Math.min(devicePixelRatio, 1.5)
  renderer.setPixelRatio(pr)
  const u = {
    uTex: { value: null }, uTexA: { value: 1 }, uRes: { value: new THREE.Vector2(1, 1) },
    uDis: { value: 0 }, uCol: { value: 0 }, uCell: { value: 3 * pr }, uRev: { value: 0 }, uWave: { value: 0 },
  }
  const mat = new THREE.ShaderMaterial({
    uniforms: u,
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }',
    fragmentShader: /* glsl */ `
      uniform sampler2D uTex; uniform float uTexA, uDis, uCol, uCell, uRev, uWave; uniform vec2 uRes;
      varying vec2 vUv;
      float b2(vec2 p) { p = floor(p); return fract(p.x * .5 + p.y * p.y * .75); }
      float b8(vec2 p) { return b2(p * .25) * .0625 + b2(p * .5) * .25 + b2(p); }
      vec3 src(vec2 uv) {
        float ra = (uRes.x / uRes.y) / uTexA; // cover
        vec2 t = uv;
        if (ra > 1.) t.y = (t.y - .5) / ra + .5; else t.x = (t.x - .5) * ra + .5;
        return texture2D(uTex, t).rgb;
      }
      // por onde a revelação passa primeiro (0 = antes, 1 = por último), por célula: do centro
      float order(vec2 c) {
        vec2 uv = (c + .5) * uCell / uRes;
        float asp = uRes.x / uRes.y;
        return length((uv - .5) * vec2(asp, 1.)) / length(vec2(asp, 1.) * .5);
      }
      // a célula já foi revelada? a frente anda com a, a borda (E) se desfaz no Bayer;
      // empurrada pelo tranco (uWave) a borda se espalha, como pó soprado
      float edge(float k) { return .24 + .3 * uWave * k; }
      bool shown(float th, float a, vec2 c, float k) {
        float E = edge(k);
        return th < clamp((a * (1. + E) - order(c)) / E, 0., 1.);
      }
      void main() {
        vec2 cell = floor(gl_FragCoord.xy / uCell);
        float th = b8(cell);
        vec3 col = src(vUv);
        // dither: a cor da célula inteira, em 4 cinzas
        float l = dot(src((cell + .5) * uCell / uRes), vec3(.299, .587, .114));
        float v = clamp((l - .5) * 1.25 + .5, 0., 1.) * 3.;
        float lv = min(3., floor(v) + step(th, fract(v)));
        vec3 pal = lv < .5 ? vec3(.078) : lv < 1.5 ? vec3(.373) : lv < 2.5 ? vec3(.725) : vec3(1.);
        vec3 o = shown(th, uDis, cell, 1.) ? pal : vec3(.078);
        // a crista do tranco: uma faixa clara (em Bayer) no meio da borda que avança
        if (uWave > .001 && uDis > 0.) {
          float E = edge(1.);
          float ring = uWave * (1. - smoothstep(0., E * .45, abs(order(cell) - (uDis * (1. + E) - E * .5))));
          if (th < ring) o = vec3(1.);
        }
        gl_FragColor = vec4(shown(th, uCol, cell, 0.) ? col : o, 1.);
      }`,
  })
  const scene = new THREE.Scene()
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat)
  scene.add(quad)
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  let dirty = true
  let alive = true
  let texDone
  const texReady = new Promise((r) => { texDone = r })
  new THREE.TextureLoader().load(wallUrl, (t) => {
    texDone()
    if (!alive) { t.dispose(); return }
    u.uTex.value = t; u.uTexA.value = t.image.width / t.image.height; dirty = true
    onGlow(t.image)
  }, undefined, texDone)
  return {
    get dirty() { return dirty },
    /** compila o shader e sobe a foto antes da cena (ver mountPC → warm) */
    async warm() {
      await renderer.compileAsync(scene, cam)
      await texReady
      if (alive && u.uTex.value) renderer.initTexture(u.uTex.value)
      if (!alive) return
      drawAll(renderer, scene, cam) // (o 1º uso do shader: ver utils/warmup.js)
      renderer.clear()
    },
    size(w, h) { renderer.setSize(w, h, false); u.uRes.value.set(w * pr, h * pr); dirty = true },
    draw(dis, col, wave = 0) {
      if (!dirty && u.uDis.value === dis && u.uCol.value === col && u.uWave.value === wave) return
      u.uDis.value = dis; u.uCol.value = col; u.uWave.value = wave; u.uRev.value = REV; dirty = false
      if (u.uTex.value) renderer.render(scene, cam)
    },
    dispose() {
      alive = false
      u.uTex.value?.dispose()
      quad.geometry.dispose()
      mat.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
    },
  }
}

// a luz da tela: a cor média do wallpaper, puxada para clara e saturada
function glowOf(img) {
  const c = document.createElement('canvas')
  c.width = c.height = 12
  const x = c.getContext('2d')
  x.drawImage(img, 0, 0, 12, 12)
  const d = x.getImageData(0, 0, 12, 12).data
  const s = [0, 0, 0]
  for (let i = 0; i < d.length; i += 4) for (let k = 0; k < 3; k++) s[k] += d[i + k]
  const rgb = s.map((v) => v / (d.length / 4))
  const m = Math.max(...rgb, 1), avg = (rgb[0] + rgb[1] + rgb[2]) / 3
  return rgb.map((v) => Math.round(Math.min(255, (avg + (v - avg) * 1.5) * (235 / m))))
}

// ---------- texturas ----------
// O rig muda de escala a cada quadro (o zoom). Gradiente, máscara e imagem de fundo
// em CSS dentro dele são re-rasterizados pelo Chrome a cada escala nova — milhares
// de ladrilhos por segundo rolando, e na GPU que não acompanha sobram ladrilhos
// vazios (os "quadrados"). Canvas é textura: a GPU só escala. Então o brilho, as
// vinhetas, o reflexo do vidro, a faixa do tubo e a luz na parede são desenhados
// uma vez aqui, com os mesmos gradientes que tinham em CSS, e o que se move vai
// por transform.
const ctx2d = (cv, w, h) => {
  cv.width = Math.max(1, Math.round(w)); cv.height = Math.max(1, Math.round(h))
  const x = cv.getContext('2d'); x.clearRect(0, 0, cv.width, cv.height)
  return x
}
// radial-gradient(<rx> <ry> at <cx> <cy>, stops) do CSS, em px do canvas; além do
// último stop, a cor dele (como no CSS). Transparente = a mesma cor com alfa 0: o
// CSS interpola pré-multiplicado, e assim o canvas dá o mesmo resultado
function ellipse(x, cx, cy, rx, ry, stops) {
  const W = x.canvas.width, H = x.canvas.height
  x.save()
  x.translate(cx, cy); x.scale(rx, ry)
  const g = x.createRadialGradient(0, 0, 0, 0, 0, 1)
  for (const [o, c] of stops) g.addColorStop(o, c)
  x.fillStyle = g
  x.fillRect(-cx / rx, -cy / ry, W / rx, H / ry)
  x.restore()
}
const rgba = (rgb, a) => `rgba(${rgb.join(',')},${a})`
const WHITE = [255, 255, 255], BLACK = [0, 0, 0]
const TEX_DPR = () => Math.min(2, devicePixelRatio || 1)

/**
 * @param host  .ma-pc (camada do tamanho da tela no segundo ato)
 * @param opts  { reduce, onLamp(v): a lâmpada mudou,
 *                cursorFrom(): o cursor da seção 6 agora (posição em px do editor, forma, troca, clique: manifestoS6 → cursor()),
 *                onImpact(v): passou (true) ou voltou de antes (false) do tranco do degauss,
 *                t: os textos da cena no idioma da página (strings.js → pc) }
 * O cartaz é a própria seção 6, viva: o hook move o .s6 para dentro de poster
 * (o retorno) enquanto a cena está ativa, e ela continua andando dentro da tela.
 * O cursor também é o dela, um só: aninhada, a seção 6 só calcula o estado dele e
 * o PC o desenha, igual, até tomar o gesto (sair para o "Aviso").
 */
export function mountPC(host, { reduce = false, onLamp = () => {}, cursorFrom = () => null, onImpact = () => {}, t: tx }) {
  let impacted = false // já passou do tranco (a tela virou monitor)
  host.innerHTML = STAGE
  const q = (s) => host.querySelector(s)
  const rig = q('.pc-rig'), crt = q('.pc-crt'), crtIn = q('.pc-crt-in'), poster = q('.pc-poster')
  const devEl = q('.pc-dev'), desk = q('.pc-desk')
  const bend = q('#pc-crt-bend'), offR = q('#pc-crt-r'), offB = q('#pc-crt-b')
  const camEl = q('.pc-cam'), spillEl = q('.pc-spill'), devGlow = q('.pc-dev-glow')
  const bodyEl = q('.pc-body'), shadowEl = q('.pc-shadow'), ledsEl = q('.pc-leds')
  const ledPow = q('.pc-led-pow'), ledHd = q('.pc-led-hd')
  const ambCv = q('.pc-amb canvas'), pvigCv = q('.pc-pvig'), bandCv = q('.pc-fx-band canvas')
  const glassBand = q('.g-band'), glassHl = q('.g-hl'), vigCv = q('.pc-fx-vig canvas'), dgCv = q('.pc-fx-dg canvas')
  const pcImg = new Image()
  pcImg.src = pcUrl

  // o brilho da tela sobre o PC (sala escura): era radial-gradient(ellipse 62% 56% at
  // centro da tela, gc .8, gc .26 45%, transparente 78%) com máscara = a imagem do PC.
  // Na resolução da própria imagem (a máscara em CSS também vinha dela)
  // (sem a cor do wallpaper ainda, nada: em CSS, sem --gc, o gradiente era inválido e não aparecia)
  let gcKnown = false
  function paintGlow() {
    if (!gcKnown || !pcImg.complete || !pcImg.naturalWidth) return
    const W = DEV.w, H = DEV.h, s = DEV.screen
    const x = ctx2d(devGlow, W, H)
    ellipse(x, s.x + s.w / 2, s.y + s.h / 2, W * 0.62, H * 0.56, [[0, rgba(glowRGB, 0.8)], [0.45, rgba(glowRGB, 0.26)], [0.78, rgba(glowRGB, 0)]])
    x.globalCompositeOperation = 'destination-in'
    x.drawImage(pcImg, 0, 0, W, H)
    x.globalCompositeOperation = 'source-over'
  }
  pcImg.onload = paintGlow
  // a luz da tela na parede: radial-gradient(ellipse 46% 52% at --ax --ay, gc .24, gc .07
  // 55%, transparente 80%) na viewport. Num canvas 2× a viewport, com o centro no meio,
  // que o quadro leva até (ax, ay) por transform (antes: o gradiente repintado a cada quadro)
  function paintAmb() {
    if (!gcKnown || !vw) return
    const q4 = 4 // gradiente suave: 1 px de textura a cada 4 de tela basta
    const x = ctx2d(ambCv, (2 * vw) / q4, (2 * vh) / q4)
    ellipse(x, vw / q4, vh / q4, (vw * 0.46) / q4, (vh * 0.52) / q4, [[0, rgba(glowRGB, 0.24)], [0.55, rgba(glowRGB, 0.07)], [0.8, rgba(glowRGB, 0)]])
  }
  // a vinheta do cartaz (a mesma noir do segundo ato): radial-gradient(120% 95% at 50% 46%,
  // transparente 52%, preto .5 100%) no tamanho do cartaz (= a viewport)
  function paintPosterVig() {
    if (!vw) return
    const x = ctx2d(pvigCv, vw / 2, vh / 2), W = vw / 2, H = vh / 2
    ellipse(x, W * 0.5, H * 0.46, W * 1.2, H * 0.95, [[0, rgba(BLACK, 0)], [0.52, rgba(BLACK, 0)], [1, rgba(BLACK, 0.5)]])
  }
  // o vidro: radial-gradient(60% 45% at 28% 18%, branco .13, transparente 70%) por cima de
  // linear-gradient(160deg, branco .07 0 30%, transparente 30.5%). O reflexo (g-hl) cobre de
  // −1 a 2 alturas da tela para correr com o balanço por transform; a faixa (g-band) é fixa
  function paintGlass() {
    if (!W1) return
    const r = TEX_DPR(), W = W1 * r, H = H1 * r
    const b = ctx2d(glassBand, W, H)
    const a = (160 * Math.PI) / 180, dx = Math.sin(a), dy = -Math.cos(a)
    const L = Math.abs(W * dx) + Math.abs(H * dy) // o comprimento da linha do gradiente, como no CSS
    const g = b.createLinearGradient(W / 2 - (dx * L) / 2, H / 2 - (dy * L) / 2, W / 2 + (dx * L) / 2, H / 2 + (dy * L) / 2)
    g.addColorStop(0, rgba(WHITE, 0.07)); g.addColorStop(0.3, rgba(WHITE, 0.07)); g.addColorStop(0.305, rgba(WHITE, 0)); g.addColorStop(1, rgba(WHITE, 0))
    b.fillStyle = g; b.fillRect(0, 0, W, H)
    const hw = W1 / 2, hh = H1 / 2 // reflexo suave: meia resolução basta
    const h = ctx2d(glassHl, hw, hh * 3)
    ellipse(h, hw * 0.28, hh + hh * 0.18, hw * 0.6, hh * 0.45, [[0, rgba(WHITE, 0.13)], [0.7, rgba(WHITE, 0)]])
  }
  // a vinheta do tubo: radial-gradient(130% 120% at 50% 50%, transparente 62%, preto .32
  // 100%) e, por cima, box-shadow: inset 0 0 (6% da altura) preto .4 — a sombra interna é
  // a de uma moldura em volta, fora do canvas (shadowBlur e blur do CSS: os dois são 2σ)
  function paintVig() {
    if (!W1) return
    const r = 0.5, W = W1 * r, H = H1 * r // tudo suave: meia resolução basta
    const x = ctx2d(vigCv, W, H)
    ellipse(x, W / 2, H / 2, W * 1.3, H * 1.2, [[0, rgba(BLACK, 0)], [0.62, rgba(BLACK, 0)], [1, rgba(BLACK, 0.32)]])
    x.save()
    x.beginPath()
    x.rect(-W, -H, W * 3, H * 3)
    x.rect(0, 0, W, H)
    x.shadowColor = rgba(BLACK, 0.4)
    x.shadowBlur = H1 * 0.06 * r
    x.fillStyle = '#000'
    x.fill('evenodd')
    x.restore()
  }
  // os anéis do degauss: repeating-radial-gradient(circle at 50% 56%, as 5 cores a cada
  // 5%, período de 25% do raio até o canto mais longe) com blur(14px) — o desfoque era
  // refeito na tela inteira a cada quadro do tranco (a escala e o matiz mudam). Desfocado
  // aqui uma vez, em meia resolução (tudo suave), com a borda de 3σ em volta, por onde o
  // blur do CSS também espalhava (a camada começa menor que a tela, a borda aparece); na
  // tela ficam a escala, a opacidade e o giro do matiz (App.css → .pc-fx-dg)
  const DG_RING = ['#ff2fa0', '#ffb02e', '#2effa0', '#2e7dff', '#b02eff']
  function paintDg() {
    if (!W1) return
    const r = 0.5, B = 14, P = B * 3
    const x = ctx2d(dgCv, (W1 + 2 * P) * r, (H1 + 2 * P) * r)
    Object.assign(dgCv.style, { left: `${-P}px`, top: `${-P}px`, width: `${W1 + 2 * P}px`, height: `${H1 + 2 * P}px` })
    const cx = W1 * 0.5, cy = H1 * 0.56
    const g = x.createRadialGradient(cx, cy, 0, cx, cy, Math.hypot(Math.max(cx, W1 - cx), Math.max(cy, H1 - cy)))
    for (let i = 0; i < 4; i++) DG_RING.forEach((c, j) => g.addColorStop((i * 5 + j) * 0.05, c))
    g.addColorStop(1, DG_RING[0])
    x.filter = `blur(${B * r}px)` // (em px do canvas: o filtro não segue a escala do setTransform)
    x.setTransform(r, 0, 0, r, P * r, P * r)
    x.fillStyle = g
    x.fillRect(0, 0, W1, H1)
  }
  // a faixa que desce pelo tubo: linear-gradient(180deg, transparente 0 40%, branco 50%,
  // transparente 60% 100%) num ladrilho de 3 alturas da tela, repetido. O canvas tem 4
  // alturas (ladrilho em 0 e em 3) e anda 3 alturas por ciclo, por transform (App.css → pcBand)
  function paintBand() {
    if (!H1) return
    const h = 512, tile = (h * 3) / 4
    const x = ctx2d(bandCv, 2, h)
    for (const y0 of [0, tile]) {
      const g = x.createLinearGradient(0, y0, 0, y0 + tile)
      g.addColorStop(0, rgba(WHITE, 0)); g.addColorStop(0.4, rgba(WHITE, 0)); g.addColorStop(0.5, rgba(WHITE, 1)); g.addColorStop(0.6, rgba(WHITE, 0)); g.addColorStop(1, rgba(WHITE, 0))
      x.fillStyle = g; x.fillRect(0, y0, 2, tile)
    }
  }

  // o mapa da curva: R/G = deslocamento em x/y (0,5 = parado); a borda puxa de fora → barril
  ;(() => {
    const N = 256, c = document.createElement('canvas')
    c.width = c.height = N
    const ctx = c.getContext('2d'), img = ctx.createImageData(N, N)
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const u = (x / (N - 1)) * 2 - 1, v = (y / (N - 1)) * 2 - 1, r2 = u * u + v * v
      const k = (y * N + x) * 4
      img.data[k] = 128 + 127 * (u * r2) / 2
      img.data[k + 1] = 128 + 127 * (v * r2) / 2
      img.data[k + 2] = 128
      img.data[k + 3] = 255
    }
    ctx.putImageData(img, 0, 0)
    q('#pc-crt-map').setAttribute('href', c.toDataURL())
  })()

  // ---------- área de trabalho e janelas ----------
  const icons = DESK_ICONS(tx), pops = POPS_IN(tx)
  desk.innerHTML = icons.map(([src, label], i) => `<div class="pc-pop pc-ico" style="left:10px;top:${12 + i * 76}px"><img src="${src}" alt=""><span>${label}</span></div>`).join('')
    + pops.map(([, x, y, w, html, kind]) => `<div class="pc-pop${kind ? ` ${kind}` : ''}" style="left:${x}px;top:${y}px;width:${w}px">${html}</div>`).join('')
    + `<div class="pc-pop pc-tb"><b><img src="${logoUrl}" alt="">MyTi</b><b class="task">${tx.txt[0]}</b><b class="task t2">${tx.opening[0]}</b><span class="clock"></span></div>`
    + `<canvas class="pc-cur"></canvas><div class="s6-impact"><svg viewBox="-50 -50 100 100">${[0, 45, 90, 135, 180, 225, 270, 315].map((a) => `<line x1="0" y1="-16" x2="0" y2="-34" transform="rotate(${a})"/>`).join('')}</svg></div>`
  const deskPops = [...desk.querySelectorAll('.pc-pop')]
  const deskOn = [ // [abre, fecha]
    ...icons.map((_, i) => [lerp(...DESK_T.icons, i / (icons.length - 1)), 2]),
    ...pops.map(([t, , , , , , off = 2]) => [t, off]),
    [DESK_T.bar, 2],
  ]
  const prog = desk.querySelector('.prog .w98'), pct = desk.querySelector('.pct')
  const clock = desk.querySelector('.clock')
  const [task1, task2] = desk.querySelectorAll('.pc-tb .task')
  const folder = deskPops[2], okBtn = desk.querySelector('.aviso b')

  // ---------- o cursor ----------
  // O mesmo cursor em dither que digitou, arrastou, clicou em "apresentar" e se
  // desfez em pixels na seção 6: aqui ele se refaz na área de trabalho. Posição
  // pelo scroll (com inércia); cliques, impacto e troca de forma em tempo real,
  // disparados ao passar do ponto rolando para baixo.
  const curCv = desk.querySelector('.pc-cur'), cx = curCv.getContext('2d'), impact = desk.querySelector('.s6-impact')
  const at = (el, fx = 0.5, fy = 0.5) => {
    let x = el.offsetWidth * fx, y = el.offsetHeight * fy
    for (let e = el; e && e !== desk; e = e.offsetParent) { x += e.offsetLeft; y += e.offsetTop }
    return [x, y]
  }
  let P = null
  const freshCursor = () => ({ pos: null, shown: 'arrow', prev: null, morph0: 0, last: 0, prevT: null, hit: { ok: null, dbl: null }, lastHit: null, dbl2: false, drawn: '', cell0: CELL, glow0: 0, filter: '', shadows: [] })
  const cursor = freshCursor()
  function measureCursor(DH) {
    curCv.width = 800 * RES; curCv.height = Math.round(DH * RES)
    curCv.style.height = `${DH}px`
    // os pops escondidos (visibility) continuam no layout: dá para medir
    P = { start: [455, DH * 0.6], ok: at(okBtn, 0.5, 0.55), icon: at(folder.querySelector('img'), 0.55, 0.5), win: at(prog, 0.8, 0.72) }
    cursor.drawn = ''
  }
  // de onde o cursor parte: onde a seção 6 o deixou (px do editor → px do desktop:
  // o cartaz e o desktop estão os dois no rig, o cartaz escalado em cs)
  function takeCursor() {
    const c = cursorFrom()
    if (!c || !W1) return null
    const toDesk = 800 / W1
    P.start = [((W1 - vw * cs) / 2 + c.x * cs) * toDesk, ((H1 - vh * cs) / 2 + c.y * cs) * toDesk]
    cursor.cell0 = c.cell * cs * toDesk // o mesmo tamanho na tela
    cursor.glow0 = c.glow * cs * toDesk // e o mesmo brilho
    return c
  }
  // o estilo: no preto, o brilho claro que ele tinha na seção 6; com o wallpaper
  // chegando, vira o contorno escuro da seta do Windows (que lê sobre o céu)
  // As sombras (o brilho do preto, o contorno escuro da seta, a sombra) eram filtros:
  // primeiro CSS no canvas inteiro (800 px × RES), depois ctx.filter — 6 passes
  // encadeados, um com desfoque, refeitos a cada quadro (no escuro o cursor anda, muda
  // de tamanho e de estilo todo quadro): o que mais pesava na GPU integrada. Agora são
  // as sombras do próprio canvas, uma por passo, na mesma ordem e com a mesma conta do
  // drop-shadow (cada uma sobre o resultado da anterior; desfoque = shadowBlur), só no
  // recorte do cursor e só as visíveis (alpha 0 não entra). Medidas em px do canvas (× RES)
  const curStyle = (T) => {
    const g = 1 - ramp(T, ...TL.wall)
    const o = +(1 - g).toFixed(3)
    const ink = (a) => `rgba(20,20,20,${a})`
    cursor.shadows = [
      [0, 0, cursor.glow0 * RES, `rgba(244,243,239,${(0.4 * g).toFixed(3)})`, 0.4 * g],
      [1.5 * RES, 0, 0, ink(o), o], [-1.5 * RES, 0, 0, ink(o), o], [0, 1.5 * RES, 0, ink(o), o], [0, -1.5 * RES, 0, ink(o), o],
      [2 * RES, 3 * RES, 0, `rgba(0,0,0,${(0.3 * (1 - g)).toFixed(3)})`, 0.3 * (1 - g)],
    ].filter((sh) => sh[4] > 0.0005)
    cursor.filter = cursor.shadows.map((sh) => sh.slice(0, 4).join(',')).join('|') // (a chave do redesenho)
  }
  // aplica as sombras em sequência, alternando entre os dois canvases do recorte
  function shadowChain(side) {
    let src = curTmp, dst = curTmp2
    for (const [sx, sy, blur, color] of cursor.shadows) {
      const d = dst.getContext('2d')
      d.setTransform(1, 0, 0, 1, 0, 0)
      d.clearRect(0, 0, side, side)
      Object.assign(d, { shadowOffsetX: sx, shadowOffsetY: sy, shadowBlur: blur, shadowColor: color })
      d.drawImage(src, 0, 0, side, side, 0, 0, side, side)
      Object.assign(d, { shadowOffsetX: 0, shadowOffsetY: 0, shadowBlur: 0, shadowColor: 'transparent' })
      ;[src, dst] = [dst, src]
    }
    return src
  }
  // o recorte: o maior desenho, girado, com folga para o brilho e as sombras; a origem
  // presa ao grid do dither (DCELL), para o pontilhado sair igual ao do canvas inteiro
  const SPR_MAX = Math.max(...Object.values(SPR).map(({ art }) => Math.max(art.cols, art.rows)))
  const curTmp = document.createElement('canvas')
  const curTmp2 = document.createElement('canvas')
  const tmpCx = curTmp.getContext('2d')
  function curTarget(T) {
    const seg = ([a, b], p0, p1) => { const e = easeInOut(ramp(T, a, b)); return [lerp(p0[0], p1[0], e), lerp(p0[1], p1[1], e)] }
    if (T < CUR.toOk[1]) return seg(CUR.toOk, P.start, P.ok)
    if (T < CUR.toWin[0]) return seg(CUR.toIcon, P.ok, P.icon)
    return seg(CUR.toWin, P.icon, P.win)
  }
  function fireImpact([x, y]) {
    Object.assign(impact.style, { left: `${x}px`, top: `${y}px` })
    impact.classList.remove('on')
    void impact.offsetWidth
    impact.classList.add('on')
  }
  function cursorFrame(now, T) {
    const c = cursor
    const dt = c.last ? Math.min(0.05, (now - c.last) / 1000) : 0
    c.last = now
    const s6c = T < CUR.toOk[1] ? takeCursor() : null // até sair para o "Aviso", ele parte de onde a seção 6 o tem
    // antes disso o gesto ainda é da seção 6: a forma, a troca e o clique são os dela
    // (ela já dá a inércia: sem uma segunda aqui, o desenho fica onde ela o calcula)
    const own = s6c && T < CUR.toOk[0]
    curStyle(T)
    const tgt = curTarget(T)
    c.pos = c.pos && dt && !reduce && !own ? [damp(c.pos[0], tgt[0], TAU, dt), damp(c.pos[1], tgt[1], TAU, dt)] : tgt
    // cliques: só quando o scroll PASSA do ponto (chegar no meio não clica)
    for (const [h, th] of [['ok', CUR.ok], ['dbl', CUR.dbl]]) {
      if (c.prevT !== null && c.prevT < th && T >= th && !reduce) { c.hit[h] = now; c.lastHit = h; c.dbl2 = false; fireImpact(tgt) }
    }
    c.prevT = T
    let ha = c.lastHit ? (now - c.hit[c.lastHit]) / 1000 : 99
    if (c.lastHit === 'dbl' && ha >= HIT.dbl) {
      if (!c.dbl2) { c.dbl2 = true; fireImpact(tgt) } // o segundo clique do duplo
      ha -= HIT.dbl
    }
    // forma: a da seção 6 (a troca dela continua daqui, no mesmo ponto); depois, esperando
    // a janela abrir, ampulheta; a barra em 100%, seta de novo
    if (own) { c.shown = s6c.shape; c.prev = s6c.from; c.morph0 = now - (Math.min(1, s6c.k) * MORPH_MS) }
    else {
      const want = T >= CUR.open && T < 1 ? 'wait' : 'arrow'
      if (want !== c.shown) { c.prev = c.shown; c.shown = want; c.morph0 = now }
    }
    const u = own ? s6c.k : c.prev && !reduce ? clamp01((now - c.morph0) / MORPH_MS) * 1.01 : 1.01
    const a = 1.01 // sempre visível: ele não some nem se refaz, só continua
    // o tamanho: o da seção 6 enquanto o cartaz encolhe, até o de ler na tela pequena
    const cell = lerp(c.cell0, CELL, easeInOut(ramp(T, ...TL.shrink)))
    const key = `${c.pos[0].toFixed(1)},${c.pos[1].toFixed(1)},${cell.toFixed(3)},${c.prev},${c.shown},${u.toFixed(2)},${own ? `${s6c.spin.toFixed(3)},${s6c.sq.toFixed(3)}` : ha < 1.4 ? ha.toFixed(3) : ''},${c.filter}`
    if (key === c.drawn) return
    c.drawn = key
    cx.clearRect(0, 0, curCv.width, curCv.height)
    const cj = own ? 0 : jolt(ha) * HIT.bump // (o recuo da seção 6 já vem na posição)
    const spin = own ? s6c.spin : (jolt(ha, 20) * HIT.spin * Math.PI) / 180
    const hc = cell * (own ? s6c.sq : squash(ha, 0.2)) * RES
    const x = (c.pos[0] - cj * 0.4) * RES, y = (c.pos[1] - cj) * RES
    // desenha no recorte (coordenadas do canvas inteiro, deslocadas) e o pousa com o filtro
    const R = SPR_MAX * hc * 1.5 + Math.ceil(c.glow0 * RES * 3 + 8 * RES) // (1,5: a diagonal, com a ponta na âncora)
    const ox = Math.floor((x - R) / DCELL) * DCELL, oy = Math.floor((y - R) / DCELL) * DCELL
    const side = Math.ceil(2 * R) + DCELL * 2
    if (curTmp.width < side) curTmp.width = curTmp.height = curTmp2.width = curTmp2.height = side
    tmpCx.setTransform(1, 0, 0, 1, 0, 0)
    tmpCx.clearRect(0, 0, side, side)
    tmpCx.setTransform(1, 0, 0, 1, -ox, -oy)
    const draw = (name, show) => { const { art, anchor } = SPR[name]; drawSprite(tmpCx, art, x, y, anchor[0], anchor[1], hc, show, name === 'fist' ? 0 : spin) }
    if (u < 1 && c.prev) draw(c.prev, (t) => t >= u && t < a)
    draw(c.shown, (t) => t < Math.min(a, u))
    cx.drawImage(shadowChain(side), 0, 0, side, side, ox, oy, side, side)
  }

  // ---------- vida no PC ----------
  const life = { tilt: { x: 0, v: 0 }, land: { x: 0, v: 0 }, last: 0, lastP: null, prevT: null, hd: -9, opened: 0 }
  let mousePx = null // px de tela: a parede atrás anda um tiquinho com ele (o PC não)
  const onMove = (e) => { if (e.pointerType === 'mouse') mousePx = [e.clientX, e.clientY] }
  addEventListener('pointermove', onMove)
  let devBox = null
  let lampV = 0
  function lifeFrame(now, T) {
    const L = life
    const dt = L.last ? Math.min(0.05, (now - L.last) / 1000) : 0
    L.last = now
    if (reduce || !devBox || !dt) { L.lastP = pIn; L.prevT = T; return }
    const on = ramp(T, TL.zoom[0], TL.zoom[0] + 0.15) // o PC passa a ter corpo
    // inclinação: contra o scroll (rolando para baixo, o topo vai para trás) e balança ao parar
    const vel = (pIn - (L.lastP ?? pIn)) / dt
    L.lastP = pIn
    stepSpring(L.tilt, Math.max(-TILT.max, Math.min(TILT.max, vel * TILT.gain)) * on, SPRING.tilt, dt)
    // o pouso: ao passar do fim do zoom rolando para baixo, afunda e balança
    if (L.prevT !== null && L.prevT < TL.zoom[1] && T >= TL.zoom[1]) { L.land.v += LAND.drop * (devBox.dh / 1000); L.tilt.v += LAND.kick }
    stepSpring(L.land, 0, SPRING.land, dt)
    // LED do HD: pisca quando uma janela abre (e enquanto "Abrindo trabalhos…" lê o disco)
    const opened = deskOn.filter(([a, b]) => T >= a && T < b).length + (T >= CUR.open ? 1 : 0)
    if (L.prevT !== null && opened > L.opened) L.hd = now
    L.opened = opened
    L.prevT = T
    const reading = (now - L.hd) / 1000 < HD_BLINK || (T >= CUR.open && T < 1 && Math.abs(vel) > 0.02)
    ledHd.style.opacity = reading && Math.random() > 0.45 ? 1 : 0.12
    ledPow.style.opacity = ramp(T, TL.zoom[0], TL.zoom[0] + 0.1)

    const rx = L.tilt.x
    bodyEl.style.transform = `perspective(${devBox.dh * 4}px) translateY(${L.land.x.toFixed(2)}px) rotateX(${rx.toFixed(3)}deg)`
    glassHl.style.transform = `translateY(${(rx * 0.04 * H1).toFixed(2)}px)` // o reflexo do vidro corre ao contrário do balanço (4% da tela por grau)
    // a sombra no chão: aparece com a lâmpada; o PC afundando a aperta
    const press = 1 + L.land.x / devBox.dh
    shadowEl.style.opacity = (lampV * Math.min(1.3, press)).toFixed(3)
    shadowEl.style.transform = `scale(${(press * (1 - Math.abs(rx) * 0.01)).toFixed(4)}, 1)`
  }

  // ---------- wallpaper e a luz da tela ----------
  let glowRGB = [200, 225, 255]
  const wall = mountWall(q('.pc-wall'), (img) => {
    glowRGB = glowOf(img)
    host.style.setProperty('--gc', glowRGB.join(','))
    gcKnown = true
    paintGlow(); paintAmb() // as duas luzes da tela, na cor dela
    dirty = true
    wake()
  })

  // ---------- o entorno: cartaz + mesa + folha ----------
  const env = mountPCDesk({ back: q('.env-back'), desk: q('.env-desk'), front: q('.env-front') }, tx)
  let pcOv = null, pcKey = ''

  // As variáveis que mudam a cada quadro vão direto em quem as usa, e só quando
  // mudam: escritas no host ou no tubo (que têm a seção 6 inteira dentro da tela),
  // cada mudança se herdava e recalculava o estilo de ~450 elementos por quadro
  const setVar = (els, name, v) => {
    v = String(v)
    for (const el of els) if (el && el.style.getPropertyValue(name) !== v) el.style.setProperty(name, v)
  }
  const fxEls = [...host.querySelectorAll('.pc-fx')] // --crt (e --fine: varredura e máscara)
  const fineEls = [q('.pc-fx-scan'), q('.pc-fx-mask')]
  const dgEl = q('.pc-fx-dg'), thumpEl = q('.pc-fx-thump')
  thumpEl.style.visibility = 'hidden' // (só no clarão do tranco)
  const glowEls = [q('.pc-amb'), spillEl, devGlow]
  const litEls = [devEl, q('.ec-stk')]
  // camada invisível fora da composição (as de brilho têm mix-blend e filtro animado)
  const showIf = (els, on) => { const v = on ? '' : 'hidden'; for (const el of els) if (el.style.visibility !== v) el.style.visibility = v }

  // ---------- medidas ----------
  let vw = 0, vh = 0, W1, H1, cs, k0, kf, fcx, fcy, devRig = null, lastT = -1, dirty = true
  function measure({ vw: w, vh: h, top = 0 }) {
    vw = w; vh = h
    host.style.setProperty('--pc-top', `${top}px`)
    const s = DEV.screen
    H1 = vh * FIT; W1 = (H1 * s.w) / s.h
    if (W1 > vw * 0.92) { W1 = vw * 0.92; H1 = (W1 * s.h) / s.w }
    const ds = W1 / s.w // px da imagem → px do rig
    cs = Math.min(W1 / vw, H1 / vh) // o cartaz (viewport inteira) cabe na tela
    k0 = 1 / cs // no começo o rig cobre a viewport e o cartaz fica 1:1
    const dw = DEV.w * ds, dh = DEV.h * ds
    kf = Math.min((vh - top) * FINAL, (vw * 0.7 * DEV.h) / DEV.w) / dh
    // no fim, centrado na área visível (abaixo da marquee + header)
    fcx = vw / 2 + (s.x + s.w / 2 - DEV.w / 2) * ds * kf
    fcy = (vh + top) / 2 + (s.y + s.h / 2 - DEV.h / 2) * ds * kf
    Object.assign(rig.style, { width: `${W1}px`, height: `${H1}px` })
    crt.style.setProperty('--h', `${H1}px`)
    const box = { left: `${-s.x * ds}px`, top: `${-s.y * ds}px`, width: `${dw}px`, height: `${dh}px` }
    Object.assign(devEl.style, box)
    Object.assign(ledsEl.style, box)
    devBox = { dh }
    bodyEl.style.transformOrigin = `${-s.x * ds + dw / 2}px ${-s.y * ds + dh}px`
    Object.assign(shadowEl.style, { left: `${-s.x * ds + dw * 0.04}px`, top: `${-s.y * ds + dh * 0.955}px`, width: `${dw * 0.92}px`, height: `${dh * 0.09}px` })
    Object.assign(spillEl.style, { left: `${-s.x * ds - dw * 0.2}px`, top: `${-s.y * ds + dh * 0.86}px`, width: `${dw * 1.4}px`, height: `${dh * 0.3}px` })
    Object.assign(devGlow.style, box)
    for (const [el, [x, y]] of [[ledPow, LEDS.pow], [ledHd, LEDS.hd]]) Object.assign(el.style, { left: `${(x / DEV.w) * 100}%`, top: `${(y / DEV.h) * 100}%` })
    Object.assign(poster.style, { width: `${vw}px`, height: `${vh}px`, left: `${(W1 - vw * cs) / 2}px`, top: `${(H1 - vh * cs) / 2}px`, transform: `scale(${cs})` })
    Object.assign(desk.style, { height: `${(800 * H1) / W1}px`, transform: `scale(${W1 / 800})` })
    measureCursor((800 * H1) / W1)
    wall.size(W1, H1)
    devRig = { x: -s.x * ds, y: -s.y * ds, w: dw, h: dh }
    env.resize(vw, vh)
    paintGlow(); paintAmb(); paintPosterVig(); paintGlass(); paintBand(); paintVig(); paintDg()
    dirty = true
    wake()
  }

  // a escala do rig (tela + aparelho) em T: cobrindo a viewport → tela 4:3 → aparelho
  const rigScale = (T) => Math.exp(lerp(Math.log(k0), 0, easeInOut(ramp(T, ...TL.shrink))) + lerp(0, Math.log(kf), easeInOut(ramp(T, ...TL.zoom))))
  const rgb = (a, b, t) => `rgb(${a.map((v, i) => Math.round(lerp(v, b[i], t))).join(',')})`

  // ---------- eventos em tempo real: a lâmpada e o degauss ----------
  const lamp = { t0: null, prevT: null, off: -1e9 } // off: quando apagou (performance.now)
  function lampLevel(now, T) {
    const was = lamp.prevT
    lamp.prevT = T
    if (T < LAMP.at) { if (lamp.t0 !== null) lamp.off = now; lamp.t0 = null; return 0 }
    if (reduce) return 1
    if (lamp.t0 === null) {
      const crossed = was !== null && was < LAMP.at
      lamp.t0 = crossed && now - lamp.off >= LAMP.rest ? now : -1e9 // -1e9: já acesa, sem a piscada
    }
    const age = now - lamp.t0
    let v = 0
    for (const [t, l] of LAMP.seq) if (age >= t) v = l
    return v
  }
  const deg = { t0: null, prevT: null }
  function degaussAge(now, T) {
    if (deg.prevT !== null && deg.prevT < DEGAUSS.at && T >= DEGAUSS.at && !reduce) deg.t0 = now
    if (T < DEGAUSS.at) deg.t0 = null
    deg.prevT = T
    return deg.t0 === null ? 99 : (now - deg.t0) / 1000
  }

  // ---------- o quadro ----------
  let pIn = null // alturas de tela desde o fim da seção 6; null = antes da cena
  function envFrame(now, T, T2) {
    if (!devRig) return
    const e2 = easeInOut(ramp(T, ...TL.zoom)), k = rigScale(T)
    const cx0 = lerp(vw / 2, fcx, e2), cy0 = lerp(vh / 2, fcy, e2)
    const tx = cx0 - (W1 / 2) * k, ty = cy0 - (H1 / 2) * k + life.land.x * k
    const pc = env.frame({
      now, T, T2, vw, vh, k, reduce, mouse: mousePx,
      lamp: lampV, glow: ramp(T, ...TL.wall) * (1 - lampV), gc: glowRGB,
      p: ramp(T, CUR.open, 1), // "Abrindo trabalhos…"
      dev: { x: tx + devRig.x * k, y: ty + devRig.y * k, w: devRig.w * k, h: devRig.h * k },
    })
    // o ajuste do PC mudou: o rig precisa ser redesenhado
    const key = pc ? `${pc.dx.toFixed(2)},${pc.dy.toFixed(2)},${pc.sx.toFixed(4)},${pc.sy.toFixed(4)}` : ''
    if (key !== pcKey) { pcKey = key; pcOv = pc; dirty = true }
  }

  function frame(now) {
    if (!vh || pIn === null) return
    const T = reduce ? 1 : clamp01((pIn - HOLD0) / LEN)
    const T2 = reduce ? 0 : clamp01((pIn - HOLD0 - LEN) / TRAVEL.len)
    const lv = lampLevel(now, T)
    const dga = degaussAge(now, T)
    // no tranco o cartaz vira tela de monitor: dali em diante, o cursor do site
    if ((T >= DEGAUSS.at) !== impacted) { impacted = !impacted; onImpact(impacted) }
    if (lv !== lampV || dga < Math.max(DEGAUSS.dur, DEGAUSS.waveDur) + 0.05) dirty = true
    if (lv !== lampV) { lampV = lv; onLamp(lv) }
    cursorFrame(now, T)
    lifeFrame(now, T)
    envFrame(now, T, T2)
    if (T === lastT && !dirty && !wall.dirty) return
    lastT = T; dirty = false

    // o tubo
    const c = ramp(T, ...TL.crt)
    setVar(fxEls, '--crt', c)
    crt.style.borderRadius = `${c * 3.4}% / ${c * 4.4}%`
    crtIn.classList.toggle('curved', c > 0.001 || dga < DEGAUSS.dur) // sem efeito, sem filtro: o cartaz nítido como na seção 6
    // degauss: o tubo treme, a curva e as cores oscilam, anéis de cor se abrem
    const da = dga / DEGAUSS.dur
    const dEnv = da < 1 ? Math.exp(-da * 4.2) * (1 - da) : 0
    const thump = dga < 1 ? Math.exp(-dga * 16) : 0 // o "tum": um clarão curto
    bend.setAttribute('scale', (0.1 * c + 0.07 * dEnv * Math.sin(dga * 21)).toFixed(4))
    offR.setAttribute('dx', (0.0013 * c + 0.007 * dEnv * Math.sin(dga * 27)).toFixed(5))
    offB.setAttribute('dx', (-0.0013 * c - 0.007 * dEnv * Math.sin(dga * 23 + 1)).toFixed(5))
    // a curva puxa a imagem para dentro: o conteúdo é ampliado o quanto a curva encolhe os cantos
    const over = 1 + 0.1 * c + 0.07 * dEnv
    crtIn.style.transform = dEnv > 0.002
      ? `translate(${(Math.sin(dga * 57) * 7 * dEnv).toFixed(2)}px, ${(Math.cos(dga * 44) * 3.5 * dEnv).toFixed(2)}px) scale(${(over * (1 + 0.014 * dEnv * Math.sin(dga * 31))).toFixed(4)})`
      : over > 1.0005 ? `scale(${over.toFixed(4)})` : ''
    // o clarão: era brightness() depois do filtro da curva (mais uma passada na tela toda,
    // e trocar a string do filtro refazia a cadeia dele). Agora uma camada em color-dodge
    // por cima do conteúdo do tubo: com cinza s = 1 − 1/f, cor / (1 − s) = cor × f, a
    // mesma conta (e o mesmo teto em 1) do brightness(f); a curva e as cores desalinhadas
    // deslocam um cinza liso sem mudar nada
    const flash = thump > 0.01 ? 1 - 1 / (1 + 0.9 * thump) : 0
    showIf([thumpEl], flash > 0)
    if (flash > 0) thumpEl.style.backgroundColor = `rgb(${(flash * 100).toFixed(2)}%, ${(flash * 100).toFixed(2)}%, ${(flash * 100).toFixed(2)}%)`
    const dg = (0.42 * dEnv).toFixed(3)
    setVar([dgEl], '--dg', dg)
    showIf([dgEl], dg > 0)
    if (dg > 0) {
      setVar([dgEl], '--dgs', (0.6 + da * 1.6).toFixed(3))
      setVar([dgEl], '--dgh', (dga * 260).toFixed(1))
    }
    // o texto sobre o wallpaper ganha a sombra dos rótulos da área de trabalho
    const sh = ramp(T, ...TL.wall)
    poster.style.filter = sh > 0 ? `drop-shadow(0 4px 3px rgba(0,0,0,${0.75 * sh}))` : ''

    // o rig: encolhe (cobrindo → tela 4:3) e dá o zoom out (tela → aparelho)
    const e2 = easeInOut(ramp(T, ...TL.zoom))
    const k = rigScale(T)
    const cx0 = lerp(vw / 2, fcx, e2), cy0 = lerp(vh / 2, fcy, e2)
    // a câmera inclinando leva o PC junto com a mesa: escala em volta da base dele e desloca
    const ov = pcOv ? `translate(${pcOv.dx.toFixed(2)}px, ${pcOv.dy.toFixed(2)}px) translate(${pcOv.ax.toFixed(2)}px, ${pcOv.ay.toFixed(2)}px) scale(${pcOv.sx.toFixed(4)}, ${pcOv.sy.toFixed(4)}) translate(${(-pcOv.ax).toFixed(2)}px, ${(-pcOv.ay).toFixed(2)}px) ` : ''
    rig.style.transform = `${ov}translate3d(${cx0 - (W1 / 2) * k}px, ${cy0 - (H1 / 2) * k}px, 0) scale(${k})`
    // a câmera recua em arco: gira em volta do aparelho no meio do zoom e termina de frente
    const arc = reduce ? 0 : Math.sin(Math.PI * e2) * (1 - 0.35 * e2)
    camEl.style.transformOrigin = `${cx0}px ${cy0}px`
    camEl.style.transform = arc > 0.001 ? `perspective(${(vh * CAM.persp).toFixed(0)}px) rotateY(${(CAM.y * arc).toFixed(3)}deg) rotateX(${(CAM.x * arc).toFixed(3)}deg)` : ''
    // a luz da tela na parede acompanha o aparelho (o centro do canvas, 2× a viewport, vai até ele)
    ambCv.style.transform = `translate(${(cx0 - vw).toFixed(1)}px, ${(cy0 - vh).toFixed(1)}px)`
    // scanlines e máscara somem quando a tela fica pequena (abaixo disso viram moiré)
    const fine = ramp(k, 0.5, 0.85)
    setVar(fineEls, '--fine', fine)
    showIf(fineEls, fine > 0 && c > 0)

    // o wallpaper: preto → dither → cor, as duas frentes contínuas (do centro, a borda
    // se desfazendo no Bayer). O tranco do degauss empurra a frente do dither
    // (chegar depois do ponto já a encontra empurrada, sem a crista)
    const w = ramp(T, ...TL.wall)
    const hit = T >= DEGAUSS.at && !reduce && dga < 99
    const push = T < DEGAUSS.at ? 0 : DEGAUSS.push * (hit ? 1 - Math.exp(-dga * DEGAUSS.pushK) : 1)
    const wave = hit && dga < DEGAUSS.waveDur ? Math.exp(-dga * DEGAUSS.waveK) : 0
    wall.draw(Math.min(1, ramp(w, 0, 0.55) + push), ramp(w, 0.55, 1), wave)
    setVar([pvigCv], '--pv', (1 - w).toFixed(3)) // a vinheta do cartaz sai com o wallpaper

    // sala escura: o aparelho só aparece pela luz da tela; a lâmpada acende em degraus
    const glow = (w * (1 - lampV)).toFixed(3)
    setVar(glowEls, '--glow', glow)
    showIf(glowEls, glow > 0)
    const lit = (lerp(0.05 + 0.12 * glow * ramp(T, ...TL.lights), 1, lampV)).toFixed(3)
    setVar(litEls, '--lit', lit)
    devEl.style.filter = lit >= 1 ? 'none' : '' // brightness(1) ainda custava uma passada de filtro
    // (--room e --lamp só mudam no instante da lâmpada: ficam no host, onde os usam)
    setVar([host], '--room', rgb([20, 20, 20], [255, 255, 255], lampV))
    setVar([host], '--lamp', lampV)

    // a área de trabalho e as janelas
    deskPops.forEach((el, i) => el.classList.toggle('on', T >= deskOn[i][0] && T < deskOn[i][1]))
    okBtn.classList.toggle('down', T >= CUR.ok - 0.006 && T < CUR.ok)
    folder.classList.toggle('sel', T >= CUR.dbl)
    // Trabalhos aberto: a barra anda com o scroll e chega a 100% em T = 1
    const p = ramp(T, CUR.open, 1)
    prog.style.setProperty('--prog', p)
    // texto só quando muda: trocar o nó a cada quadro, sob o filtro da curva, repinta a tela toda
    const pctTxt = `${Math.round(p * 100)}%`
    if (pct.textContent !== pctTxt) pct.textContent = pctTxt
    task1.classList.toggle('up', T >= CUR.open)
    task2.classList.toggle('on', T >= CUR.open)
    const clockTxt = new Date().toLocaleTimeString(tx.locale, { hour: '2-digit', minute: '2-digit' })
    if (clock.textContent !== clockTxt) clock.textContent = clockTxt
  }

  // rAF só com a cena ativa (scroll dentro dela) e na tela
  let raf = 0
  let visible = false
  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; wake() })
  io.observe(host)
  function loop(now) {
    raf = 0
    if (pIn === null || !visible) return
    frame(now)
    raf = requestAnimationFrame(loop)
  }
  function wake() { if (!raf && pIn !== null && visible) raf = requestAnimationFrame(loop) }

  return {
    poster,
    measure,
    /** o tranco agora (o salto do botão de pular cai logo depois do ponto dele, já
     *  na tela: sem cruzar o ponto rolando, ele não tocaria) */
    kick() { if (!reduce) { deg.t0 = performance.now(); deg.prevT = DEGAUSS.at; dirty = true; wake() } },
    /** aquece a cena antes de ela entrar (shaders, texturas, sombras da mesa, a
     *  imagem do PC): o hook o chama sob a tela de carregamento (utils/warmup.js) */
    warm: () => Promise.all([wall.warm(), env.warm(), pcImg.decode().catch(() => {})]),
    /** p: alturas de tela de scroll desde o fim da seção 6; null = antes da cena (some e para o rAF) */
    scroll(p) {
      if ((p === null) !== (pIn === null)) host.classList.toggle('on', p !== null)
      // saiu por cima (âncora, salto): a sala volta ao escuro sem esperar um quadro
      if (p === null) {
        if (lamp.t0 !== null) lamp.off = performance.now()
        lamp.prevT = lamp.t0 = null
        if (lampV) { lampV = 0; onLamp(0) }
        if (impacted) { impacted = false; onImpact(false) }
      }
      // entrou de novo: nada da visita anterior (o cursor partiria de onde ficou, as
      // molas balançariam, o degauss e os cliques achariam que já passaram)
      else if (pIn === null) {
        Object.assign(cursor, freshCursor())
        Object.assign(life, { last: 0, lastP: null, prevT: null })
        life.tilt.x = life.tilt.v = life.land.x = life.land.v = 0
        deg.prevT = deg.t0 = null
        lamp.prevT = lamp.t0 = null // (lamp.off fica: é ele que decide se a próxima acesa pisca)
        dirty = true
      }
      const entering = p !== null && pIn === null
      pIn = p
      // o 1º quadro já sai montado, antes da pintura: senão, por um quadro, a camada
      // aparece com o rig sem posição (o PC claro, inteiro, no canto) — o flash
      // branco da 1ª vez (nas outras, o rig ainda tinha a posição da visita anterior)
      if (entering) frame(performance.now()) // (sem esperar o IntersectionObserver: montada às pressas ele ainda não respondeu)
      wake()
    },
    dispose() {
      if (raf) cancelAnimationFrame(raf)
      io.disconnect()
      removeEventListener('pointermove', onMove)
      env.dispose()
      wall.dispose()
      host.classList.remove('on')
      host.innerHTML = ''
      host.removeAttribute('style')
    },
  }
}
