// O entorno do PC no fim do Manifesto (manifestoPC.js): o cartaz, a mesa 3D e a
// folha. Portado do /lab/secao6/v13/entorno.js, opção "E · cartaz + mesa + folha":
//   o cartaz — "TRABALHOS" gigante atrás do PC (contorno, enche de vermelho com a
//     barra de "Abrindo trabalhos…"), moldura de página, microtexto dos lados e o
//     adesivo carimbado no PC (Santioni + Playdate);
//   a mesa — nogueira escura com a base de corte na frente do teclado, disquetes,
//     canecas, bilhetes, a tecla ENTER e o lápis; na sala escura só a tela a
//     ilumina, depois a lâmpada;
//   a folha — uma A3 branca na base de corte. Com a barra em 100%, mais scroll
//     inclina a câmera até a vista de cima (Oryzo, da Lusion) e termina sobre a
//     folha, que cobre a tela: a seção de trabalhos (branca) é essa folha.
// Camadas: back — atrás do aparelho (a palavra); desk — canvas WebGL atrás do rig;
// front — por cima de tudo, em px de tela. frame(st) roda todo quadro e só
// escreve no DOM / renderiza quando algo muda; devolve o ajuste do PC (pc) que o
// manifestoPC aplica no rig enquanto a câmera inclina.
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { Font } from 'three/addons/loaders/FontLoader.js'
// as fontes da palavra (OFL; só A–Z + acentos, convertidas para o formato do three)
const FONTS = import.meta.glob('../assets/*.typeface.json', { eager: true, import: 'default' })
import { drawAll } from './warmup'
import logoRaw from '../assets/logo.svg?raw'

const clamp01 = (v) => Math.min(1, Math.max(0, v))
const ramp = (p, a, b) => clamp01((p - a) / (b - a))
const lerp = (a, b, t) => a + (b - a) * t
const easeOut = (t) => 1 - (1 - t) ** 3
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)

// a imagem do PC (manifestoPC → DEV): um ponto em px dela vira px de tela
const PC = { w: 1228, h: 983 }
const at = (st, ix, iy) => [st.dev.x + (ix / PC.w) * st.dev.w, st.dev.y + (iy / PC.h) * st.dev.h]
// um ponto preso ao PC, depois do ajuste da câmera inclinando: escala em volta da base dele e desloca junto
const follow = (pc, [x, y]) => (pc ? [pc.ax + (x - pc.ax) * pc.sx + pc.dx, pc.ay + (y - pc.ay) * pc.sy + pc.dy] : [x, y])

// escreve no DOM só quando o valor muda
function css(el, name, v) {
  const c = (el.__c ||= {})
  if (c[name] === v) return
  c[name] = v
  if (name.startsWith('--')) el.style.setProperty(name, v)
  else el.style[name] = v
}
function txt(el, v) { if (el.__t !== v) { el.__t = v; el.textContent = v } }
const n3 = (v) => v.toFixed(3)

// ========== o cartaz ==========
const CARTAZ = {
  rise: [0.6, 0.86, 0.022], // as letras sobem: começo, fim, atraso entre letras
  chrome: [0.66, 0.82], // moldura e legendas
  side: [0.72, 0.86], // microtexto dos lados
  stamp: 0.88, // o adesivo carimba (tempo real, ao passar rolando para baixo)
  fit: 0.94, // a palavra ocupa esta fração da largura (no máximo: ver ws no frame)
  gap: 22, // px entre a palavra e o microtexto, e entre ele e a borda de trás da mesa
  away: 0.22, // moldura, legendas e microtexto saem neste começo da inclinação
  maxH: 0.5, // a palavra nunca mais alta que isto da tela (palavra curta, como "Work", ficaria gigante)
}
const IMPACT = `<svg viewBox="-50 -50 100 100">${[0, 45, 90, 135, 180, 225, 270, 315].map((a) => `<line x1="0" y1="-16" x2="0" y2="-34" transform="rotate(${a})"/>`).join('')}</svg>`
// o adesivo: recortado com borda branca, o texto (do idioma da página) girando em volta do logo
const sticker = (text) => {
  const logo = logoRaw.replace(/fill="black"/g, 'fill="#fff"').replace('<svg ', '<svg x="52" y="70" width="96" height="51" ')
  return `<svg viewBox="0 0 200 200"><defs><path id="pc-ec-ring" d="M100,100 m-68,0 a68,68 0 1,1 136,0 a68,68 0 1,1 -136,0"/></defs>
    <circle cx="100" cy="100" r="97" fill="#fff"/><circle cx="100" cy="100" r="89" fill="#FF4438"/>
    <circle cx="100" cy="100" r="52" fill="none" stroke="#fff" stroke-width="1.4" stroke-dasharray="2 5"/>
    <text font-family="JetBrains Mono, monospace" font-size="12.5" font-weight="500" letter-spacing="2.6" fill="#fff"><textPath href="#pc-ec-ring">${text}</textPath></text>
    ${logo}</svg>`
}

function cartaz({ front }, tx) {
  const root = Object.assign(document.createElement('div'), { className: 'ec' })
  front.append(root)
  root.innerHTML = `
    <div class="ec-frame"><i></i><i></i><i></i><i></i></div>
    <p class="env-mono ec-cap ec-tl">${tx.caption}</p>
    <p class="env-mono ec-cap ec-bc">${tx.scroll}</p>
    <div class="ec-side ec-l"><p class="env-mono"><b>( 06 )</b> ${tx.end}</p><i></i></div>
    <div class="ec-side ec-r"><i></i><p class="env-mono">${tx.next} <b>( 07 )</b> <span data-v="pct">000%</span></p></div>
    <div class="ec-stk">${sticker(tx.sticker)}</div>
    <div class="s6-impact ec-imp">${IMPACT}</div>`
  const q = (s) => root.querySelector(s)
  const chrome = [q('.ec-frame'), ...root.querySelectorAll('.ec-cap')]
  const sideL = q('.ec-l'), sideR = q('.ec-r'), lineL = sideL.querySelector('i'), lineR = sideR.querySelector('i')
  const pct = q('[data-v="pct"]')
  const stk = q('.ec-stk'), imp = q('.ec-imp')
  let prevT = null, textL = 0, textR = 0, sideH = 16, alive = true
  let impT = 0
  const measure = () => {
    textL = sideL.firstElementChild.offsetWidth
    textR = sideR.lastElementChild.offsetWidth
    sideH = sideL.offsetHeight
  }
  document.fonts.ready.then(() => { if (alive) measure() }) // as medidas mudam quando as fontes chegam

  return {
    /** altura do microtexto: a palavra (3D, na mesa) encolhe para ele caber acima da mesa */
    get sideH() { return sideH },
    resize() { measure() },
    frame(st) {
      const { T, pc } = st // pc: o ajuste do PC com a câmera inclinando
      const away = pc ? ramp(pc.e, 0, CARTAZ.away) : 0
      // moldura, legendas e o microtexto dos lados, com o fio até o PC
      const ch = n3(easeOut(ramp(T, ...CARTAZ.chrome)) * (1 - away))
      chrome.forEach((el) => css(el, '--in', ch))
      const sk = easeOut(ramp(T, ...CARTAZ.side)) * (1 - away)
      css(sideL, '--in', n3(sk)); css(sideR, '--in', n3(sk))
      txt(pct, `${String(Math.round(st.p * 100)).padStart(3, '0')}%`)
      // logo abaixo da palavra (em cima dela o microtexto se perde no vermelho), na
      // parede, antes da borda de trás da mesa
      const y = (st.wordBottom + CARTAZ.gap).toFixed(1), m = st.vw * 0.03
      css(sideL, 'transform', `translate(${m.toFixed(1)}px, ${y}px)`)
      css(sideR, 'transform', `translate(calc(${(st.vw - m).toFixed(1)}px - 100%), ${y}px)`)
      css(lineL, 'width', `${Math.max(0, (st.dev.x - 24 - m - textL - 12) * sk).toFixed(1)}px`)
      css(lineR, 'width', `${Math.max(0, (st.vw - m - textR - 12 - (st.dev.x + st.dev.w + 24)) * sk).toFixed(1)}px`)
      // o adesivo no canto de cima do monitor: carimba ao passar do ponto rolando para baixo
      const size = st.dev.h * 0.24 * (pc?.sx ?? 1)
      const [sx, sy] = follow(pc, at(st, 912, 58))
      css(stk, 'width', `${size.toFixed(1)}px`)
      css(stk, 'transform', `translate(${(sx - size / 2).toFixed(1)}px, ${(sy - size / 2).toFixed(1)}px) rotate(-12deg)`)
      const on = T >= CARTAZ.stamp
      if (on !== stk.classList.contains('on')) {
        stk.classList.toggle('on', on)
        if (on && prevT !== null && prevT < CARTAZ.stamp && !st.reduce) {
          stk.classList.remove('stamp'); void stk.offsetWidth; stk.classList.add('stamp')
          Object.assign(imp.style, { left: `${sx}px`, top: `${sy}px` })
          clearTimeout(impT)
          impT = setTimeout(() => { imp.classList.remove('on'); void imp.offsetWidth; imp.classList.add('on') }, 220) // o tranco, quando ele bate
        } else stk.classList.remove('stamp')
      }
      prevT = T
    },
    dispose() { alive = false; clearTimeout(impT) },
  }
}

// ========== a palavra (3D) ==========
// "TRABALHOS" em letras extrudadas, em arco sobre o PC, na parede atrás dele — o
// tratamento do Ascension (Pegassi): cromo que reflete um estúdio de painéis de luz,
// brilhos de quatro pontas em cantos das letras que acendem quando o giro alinha a
// faceta deles com a câmera, um halo atrás e a separação de cores (RGB) quando a
// palavra gira. Ela não anda: gira em volta do próprio centro olhando para o cursor
// (até LOOK.lean rad, com inércia). Começa em contorno e enche da esquerda para a
// direita com a barra de "Abrindo trabalhos…" (um plano de corte). Duas palavras
// ("Our Work") se dividem dos lados do monitor. Letras rígidas, giradas no arco
// (não curvadas): nada a recalcular por quadro além de transform.
// A palavra vive numa cena própria, desenhada antes da mesa numa textura (a mesa a
// encobre por cima) e posta na tela com a separação de cores (a mesa: frame()).
// WORD.look: 'chrome' (o Ascension) ou 'red' (o verniz vermelho da MyT)
// WORD.font: o arquivo em src/assets (*.typeface.json): titan-one e bagel-fat-one
// (gordas e arredondadas, as letras-adesivo do WordArt / Y2K),
// unbounded-black (grotesca extra-larga, a dos cartazes de computador dos anos 90) ou
// archivo-xc-black (a do cartaz em CSS de antes)
// WORD.border: os anéis de adesivo em volta de cada letra, [largura em em, cor], do mais
// fino ao mais largo ([] = sem): o papel branco e um fio de tinta por fora, que lê
// sobre a parede clara; letras vizinhas se juntam como um adesivo recortado só
const WORD = { look: 'red', font: '../assets/titan-one.typeface.json', border: [[0.07, '#fbfaf6'], [0.1, '#161514']] }
const LOOK = { lean: 0.15, tau: 0.2 } // giro máx. (rad) com o cursor na borda da tela; inércia (s) — os do Ascension
const ARC = {
  depth: 0.16, // espessura das letras (em)
  track: 0.02, // espaçamento entre letras (em): o bisel largo as engorda
  r: 2, // raio do arco, em larguras da palavra (menor = arco mais fechado)
  grow: 0.16, // as letras das pontas crescem até isto (perspectiva de dentro do arco)
  yaw: 0.6, // e giram para o centro (fração do ângulo no arco): mostram a lateral
  wall: -1.6, // z da parede (unidades da mesa)
  gap: 0.72, // palavra dividida: o vão entre as duas, em larguras da imagem do PC
}
const RED_DEEP = '#b3261c' // a lateral das letras no verniz vermelho: o vermelho na sombra
const HAIR = [new THREE.Color('#f4f3ef'), new THREE.Color('#141414')] // o contorno: sala escura / lâmpada acesa
// os materiais: o cromo é o do Ascension; o verniz, vermelho metálico com verniz por cima
const CHROME = { color: '#f2f3f6', metalness: 1, roughness: 0.11, clearcoat: 0.25, clearcoatRoughness: 0.3, envMapIntensity: 1.15 }
const GLOSS = { metalness: 0.3, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 1.1 }
// O estúdio que o material reflete: painéis brilhantes [largura, altura, brilho, x, y, z,
// azulado] num fundo cinza-azulado escuro — os "lightformers" do Ascension: um painel
// grande de frente, uma moldura de barras em volta, faixas finas (os riscos de luz que
// correm pelo cromo) e barras escuras (o contraste)
const STUDIO = {
  bg: [0.2, 0.21, 0.27],
  panels: [
    [8.2, 5.2, 0.95, 0, 0, 9, true],
    [13, 1.3, 6, 0, 4.4, 8], [13, 1.3, 5, 0, -4.4, 8], [1.3, 8, 6, -6.4, 0, 8], [1.3, 8, 5, 6.4, 0, 8],
    [9, 1.1, 9, 0, 8, 4], [0.9, 12, 7, -8, 1, 5], [0.9, 12, 5, 8, -0.5, 5], [12, 0.8, 6, -1, -6, 5],
    [18, 3.5, 0.1, 0, -4.5, 6], [20, 0.6, 0.06, 0, 2.6, 6], [20, 0.7, 0.1, -1, -2.4, 6],
  ],
}
function studioEnv(pmrem) {
  const sc = new THREE.Scene()
  sc.background = new THREE.Color().setRGB(...STUDIO.bg)
  const geo = new THREE.PlaneGeometry(1, 1)
  for (const [w, h, v, x, y, z, blue] of STUDIO.panels) {
    const color = blue ? new THREE.Color().setRGB(v * 0.8, v * 0.85, v * 1.08) : new THREE.Color().setScalar(v)
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, toneMapped: false }))
    m.scale.set(w, h, 1)
    m.position.set(x, y, z)
    m.lookAt(0, 0, 0)
    sc.add(m)
  }
  const tex = pmrem.fromScene(sc, 0, 0.1, 100).texture
  sc.traverse((o) => o.material?.dispose())
  geo.dispose()
  return tex
}
// Os brilhos (sprites de quatro pontas, desenhados como os do Ascension: um risco
// longo, um curto, o halo e o miolo). Cada um tem uma faceta (a direção do canto da
// letra): ele acende e estica quando o giro leva essa faceta ao anel FLARE.ring em
// volta da câmera, e apaga devagar
const FLARE = { facet: 0.62, ring: { at: 0.5, width: 0.14 }, dip: 0.6, stretch: 0.9, cross: 0.2, attack: 0.45, decay: 0.08, sway: 0.12, rot: 0.75, size: 0.95 }
const flareRing = (a) => Math.exp(-(((a - FLARE.ring.at) / FLARE.ring.width) ** 2))
function flareTex() {
  const c = Object.assign(document.createElement('canvas'), { width: 512, height: 512 })
  const x = c.getContext('2d')
  x.globalCompositeOperation = 'lighter'
  const spike = (len, th, rot, k = 1) => {
    x.save(); x.translate(256, 256); x.rotate(rot)
    const g = x.createLinearGradient(-len, 0, len, 0)
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.18, `rgba(255,255,255,${0.75 * k})`)
    g.addColorStop(0.5, `rgba(255,255,255,${k})`); g.addColorStop(0.82, `rgba(255,255,255,${0.75 * k})`); g.addColorStop(1, 'rgba(255,255,255,0)')
    x.fillStyle = g
    x.beginPath(); x.moveTo(-len, 0); x.quadraticCurveTo(0, th, len, 0); x.quadraticCurveTo(0, -th, -len, 0); x.fill()
    x.restore()
  }
  spike(256, 5.6, 0); spike(112.6, 5.6, Math.PI / 2, 0.95)
  for (const [r, stops] of [[112.6, [[0, 0.55], [0.3, 0.2], [1, 0]]], [46, [[0, 0.85], [0.5, 0.35], [1, 0]]], [20.5, [[0, 1], [0.6, 0.9], [1, 0]]]]) {
    const g = x.createRadialGradient(256, 256, 0, 256, 256, r)
    stops.forEach(([o, a]) => g.addColorStop(o, `rgba(255,255,255,${a})`))
    x.fillStyle = g; x.fillRect(0, 0, 512, 512)
  }
  return new THREE.CanvasTexture(c)
}
// o halo: o desenho da letra borrado, atrás dela, somando luz azulada (#dfe6ff)
const HALO = { tint: '#dfe6ff', strength: 0.5, red: 0.3, blur: 0.16, pad: 0.5 } // borrão e margem em em
// (desenhado do próprio contorno da letra: vale para qualquer fonte). O quadro vai de
// −pad a ha + pad em x e de −pad a 1 + pad em y (em, da origem da letra)
function haloTex(shapes, ha) {
  const S = 160, w = ha + 2 * HALO.pad, h = 1 + 2 * HALO.pad
  const c = Object.assign(document.createElement('canvas'), { width: Math.ceil(w * S), height: Math.ceil(h * S) })
  const x = c.getContext('2d')
  x.filter = `blur(${HALO.blur * S}px)`
  x.fillStyle = '#fff'
  x.beginPath()
  for (const s of shapes) for (const path of [s, ...s.holes]) {
    path.getPoints(4).forEach((p, i) => x[i ? 'lineTo' : 'moveTo']((p.x + HALO.pad) * S, c.height - (p.y + HALO.pad) * S))
    x.closePath()
  }
  x.fill('evenodd')
  return { tex: new THREE.CanvasTexture(c), w, h }
}

function palavra(tx, envMap) {
  const font = new Font(FONTS[WORD.font])
  const res = font.data.resolution
  const chrome = WORD.look === 'chrome'
  const ext = { depth: ARC.depth, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.022, bevelSegments: 6, curveSegments: 6 } // bisel largo e redondo (o "fillet" do Ascension): é nele que a luz risca
  const front = ARC.depth + ext.bevelThickness
  // o corte: o material fica à esquerda da barra, o contorno à direita
  const fillPl = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0)
  const restPl = new THREE.Plane(new THREE.Vector3(1, 0, 0), 0)
  const group = new THREE.Group(), inner = new THREE.Group()
  group.add(inner)
  const starMap = flareTex()
  const halos = new Map()
  const haloColor = chrome ? new THREE.Color(HALO.tint).multiplyScalar(HALO.strength) : new THREE.Color(RED).multiplyScalar(HALO.red) // no vermelho, o halo é da cor da marca, mais fraco (a parede é clara)
  let cap = 0
  const parts = tx.word.toUpperCase().split(/\s+/).map((wd) => {
    let x = 0
    const letters = [...wd].map((ch, j) => {
      const ha = (font.data.glyphs[ch]?.ha ?? res * 0.3) / res
      const shapes = font.generateShapes(ch, 1)
      const geo = new THREE.ExtrudeGeometry(shapes, ext)
      geo.translate(-ha / 2, 0, -front) // origem no pé da letra, no meio; a face da frente em z 0
      geo.computeBoundingBox()
      const bb = geo.boundingBox
      cap = Math.max(cap, bb.max.y)
      const mats = chrome
        ? [new THREE.MeshPhysicalMaterial({ ...CHROME, envMap, transparent: true, clippingPlanes: [fillPl] })]
        : [
            // a face (grupo 0 da extrusão) com um tico de emissivo, para o vermelho da marca não morrer na sombra
            new THREE.MeshPhysicalMaterial({ ...GLOSS, envMap, color: RED, emissive: RED, emissiveIntensity: 0, transparent: true, clippingPlanes: [fillPl] }),
            new THREE.MeshPhysicalMaterial({ ...GLOSS, envMap, color: RED_DEEP, transparent: true, clippingPlanes: [fillPl] }),
          ]
      const mesh = new THREE.Mesh(geo, chrome ? mats[0] : mats)
      mesh.rotation.order = 'YXZ' // gira no arco (z), depois para o centro (y)
      // os anéis de adesivo: a mesma letra, fina e engordada (o bisel quase plano vira
      // um anel), logo atrás do corpo dela — cada anel mais largo, mais atrás
      WORD.border.forEach(([wd, color], k) => {
        const bGeo = new THREE.ExtrudeGeometry(shapes, { depth: 0.01, bevelEnabled: true, bevelThickness: 0.002, bevelSize: wd, bevelSegments: 1, curveSegments: ext.curveSegments })
        bGeo.translate(-ha / 2, 0, -front - 0.035 - 0.02 * k)
        const bM = new THREE.MeshStandardMaterial({ color, roughness: 0.6, envMap, envMapIntensity: 0.4, transparent: true, clippingPlanes: [fillPl] })
        mesh.add(new THREE.Mesh(bGeo, bM))
        mats.push(bM) // (sobe e aparece junto com a letra)
      })
      // o contorno da face da frente
      const seg = []
      for (const s of shapes) for (const path of [s, ...s.holes]) {
        const p = path.getPoints(ext.curveSegments)
        p.forEach((a, i) => { const b = p[(i + 1) % p.length]; seg.push(a.x - ha / 2, a.y, 0.002, b.x - ha / 2, b.y, 0.002) })
      }
      const lineGeo = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(seg, 3))
      const lineM = new THREE.LineBasicMaterial({ color: HAIR[0], transparent: true, depthWrite: false, clippingPlanes: [restPl] })
      mesh.add(new THREE.LineSegments(lineGeo, lineM))
      // o halo, atrás da letra (só onde ela já encheu)
      if (!halos.has(ch)) halos.set(ch, haloTex(shapes, ha))
      const hl = halos.get(ch)
      const haloM = new THREE.MeshBasicMaterial({ map: hl.tex, color: haloColor, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, clippingPlanes: [fillPl] })
      const halo = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), haloM)
      halo.scale.set(hl.w, hl.h, 1)
      halo.position.set(0, 0.5, -front - 0.05)
      halo.renderOrder = -1
      mesh.add(halo)
      // os brilhos: dois cantos da letra (alternando), com a faceta apontando para fora do canto
      const stars = [[bb.min.x, bb.max.y, -0.7, 0.7], [bb.max.x, bb.min.y + 0.05, 0.7, -0.7], [bb.max.x, bb.max.y, 0.7, 0.7], [bb.min.x, bb.min.y + 0.05, -0.7, -0.7]]
        .filter((_, k) => (k + j) % 3 === 0).map(([sx, sy, fx, fy], k) => {
          const sm = new THREE.SpriteMaterial({ map: starMap, rotation: FLARE.rot, blending: THREE.AdditiveBlending, depthTest: false, transparent: true })
          const sp = new THREE.Sprite(sm)
          const size = FLARE.size * (0.75 + 0.5 * (((j * 7 + k * 3) % 5) / 4))
          sp.position.set(sx, sy, 0.02)
          sp.scale.setScalar(size)
          sp.renderOrder = 2
          sp.userData = { size, facet: [fx, fy], lit: 1 }
          mesh.add(sp)
          return sp
        })
      inner.add(mesh)
      const L = { mesh, ha, cx: x + ha / 2, mats, lineM, haloM, stars }
      x += ha + ARC.track
      return L
    })
    return { letters, w: x - ARC.track }
  })
  const all = parts.flatMap((p) => p.letters)
  const growK = 1 / (1 - Math.cos(1 / (2 * ARC.r))) // as pontas da palavra (meia largura no arco) crescem ARC.grow
  const ringMax = flareRing(FLARE.facet)

  const look = { x: 0, y: 0, last: 0 } // o giro para o cursor (−1..1 da tela), com inércia
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), hit = new THREE.Vector3()
  const wallPl = new THREE.Plane(new THREE.Vector3(0, 0, 1), -ARC.wall)
  const nrm = new THREE.Vector3(), eul = new THREE.Euler(), tmp = new THREE.Vector3()
  let bottom = 0, key = '', shown = false

  return {
    group,
    /** y de tela do pé da palavra (o microtexto vai logo abaixo) */
    get bottom() { return bottom },
    /** o que muda a imagem além do que a mesa já olha */
    get key() { return key },
    /** há letra na tela (senão a mesa nem desenha a camada da palavra) */
    get shown() { return shown },
    /** a separação de cores agora (uv): cresce com o giro */
    get split() { return chrome ? 0.0004 + (Math.abs(look.x) + Math.abs(look.y)) * 0.0008 : 0 },
    lamp(Lm) {
      all.forEach((L) => { if (!chrome) L.mats[0].emissiveIntensity = 0.12 * Lm; L.lineM.color.lerpColors(HAIR[0], HAIR[1], Lm) })
    },
    // com a câmera de frente (e = 0): a palavra é posta em px de tela, como era no
    // DOM, e levada à parede; inclinando, ela fica parada no mundo e sobe com a parede
    layout(st, camera, proj, horizon, sideH) {
      // o giro: o alvo pelo cursor (−1..1 da tela), chega com inércia (reduced motion: parada de frente)
      const dt = look.last ? Math.min(0.05, (st.now - look.last) / 1000) : 0
      look.last = st.now
      const kl = dt ? 1 - Math.exp(-dt / LOOK.tau) : 1
      const ax = st.mouse && !st.reduce ? (st.mouse[0] / st.vw) * 2 - 1 : 0
      const ay = st.mouse && !st.reduce ? (st.mouse[1] / st.vh) * 2 - 1 : 0
      look.x += (ax - look.x) * kl; look.y += (ay - look.y) * kl
      if (Math.abs(ax - look.x) + Math.abs(ay - look.y) < 0.002) { look.x = ax; look.y = ay }
      // cursor embaixo: o topo vem para a frente (a face olha para baixo); à direita: gira para a direita
      group.rotation.set(look.y * LOOK.lean, look.x * LOOK.lean, 0)

      // tamanho (px por em): a palavra ocupa CARTAZ.fit da largura, até a altura
      // máxima; dividida, cada metade vai da borda do vão até a borda da faixa
      const span = st.vw * CARTAZ.fit
      const split = parts.length > 1
      const gapPx = split ? st.dev.w * ARC.gap : 0
      let s = split ? (span / 2 - gapPx / 2) / Math.max(...parts.map((p) => p.w)) : span / parts[0].w
      s = Math.min(s, (st.vh * CARTAZ.maxH * 0.9) / cap)
      const R = (ARC.r * span) / s, gap = gapPx / s
      // o centro de cada letra no arco (em, a partir do centro do arco)
      const X = split
        ? [...parts[0].letters.map((L) => -gap / 2 - parts[0].w + L.cx), ...parts[1].letters.map((L) => gap / 2 + L.cx)]
        : parts[0].letters.map((L) => L.cx - parts[0].w / 2)
      const [r0, r1, rd] = CARTAZ.rise
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity
      let flaring = false
      shown = false
      eul.set(look.y * LOOK.lean, look.x * LOOK.lean, 0)
      all.forEach((L, i) => {
        const th = X[i] / R, sn = Math.sin(th), cs = Math.cos(th)
        const g = 1 + ARC.grow * (1 - cs) * growK
        // as letras sobem uma a uma, de trás da mesa
        const k = easeOut(ramp(st.T, r0 + i * rd, r1 - (all.length - 1 - i) * rd))
        const lift = (1 - k) * 0.6 * cap
        L.mesh.position.set(R * sn - sn * lift, R * cs - R - cs * lift, 0)
        L.mesh.rotation.set(0, -th * ARC.yaw, -th)
        L.mesh.scale.setScalar(g)
        L.mats.forEach((m) => { m.opacity = k })
        L.lineM.opacity = 0.32 * k
        L.haloM.opacity = k
        L.mesh.visible = k > 0
        shown ||= k > 0
        // os brilhos: a faceta, girada com a palavra (e com a letra no arco), perto do
        // anel em volta da câmera acende e estica; longe, apaga devagar até FLARE.dip
        for (const sp of L.stars) {
          const [fx, fy] = sp.userData.facet
          nrm.set(fx * Math.sin(FLARE.facet), fy * Math.sin(FLARE.facet), Math.cos(FLARE.facet)).applyAxisAngle(Z_AXIS, -th).applyEuler(eul)
          const a = flareRing(Math.acos(Math.min(1, Math.max(-1, nrm.z)))) / ringMax
          const o = sp.userData.lit
          const lit = Math.abs(a - o) < 0.003 ? a : o + (a - o) * (a > o ? FLARE.attack : FLARE.decay)
          if (lit !== o) flaring = true
          sp.userData.lit = lit
          const over = Math.max(0, lit - 1), sz = sp.userData.size
          sp.material.opacity = k * (1 - FLARE.dip * Math.max(0, 1 - lit))
          sp.material.rotation = FLARE.rot + FLARE.sway * (look.x * fy - look.y * fx)
          sp.scale.set(sz * (1 + FLARE.stretch * over), sz * (1 + FLARE.cross * over), 1)
        }
        // a caixa da palavra assentada (os 4 cantos da letra, girados no arco)
        for (const [cx, cy] of [[-L.ha / 2, 0], [L.ha / 2, 0], [-L.ha / 2, cap], [L.ha / 2, cap]]) {
          const px = R * sn + (cx * cs + cy * sn) * g, py = R * cs - R + (-cx * sn + cy * cs) * g
          x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py)
        }
      })
      inner.position.set(-(x0 + x1) / 2, -(y0 + y1) / 2, 0)

      // centrada na altura do PC; encolhe (ws) se o microtexto não couber entre ela e a mesa
      const wordH = (y1 - y0) * s
      const cy = st.dev.y + st.dev.h * 0.47
      const room = horizon - cy - CARTAZ.gap - sideH - CARTAZ.gap
      const ws = Math.max(0.5, Math.min(1, (2 * room) / wordH))
      bottom = cy + (wordH * ws) / 2
      // o ponto da parede sob o centro da palavra, e quantos px mede 1 unidade ali
      const sx = split ? st.dev.x + st.dev.w / 2 : st.vw / 2, sy = cy
      ndc.set((sx / st.vw) * 2 - 1, 1 - (sy / st.vh) * 2)
      ray.setFromCamera(ndc, camera)
      ray.ray.intersectPlane(wallPl, hit)
      const ppu = proj(hit.x + 1, hit.y, ARC.wall)[0] - proj(hit.x, hit.y, ARC.wall)[0]
      const sc = (s * ws) / ppu
      group.position.copy(hit)
      group.scale.setScalar(sc)
      // a barra enche da esquerda para a direita (margem nas pontas: lateral e bisel passam da caixa)
      const p = easeInOut(st.p)
      const fx = p <= 0 ? -1e4 : p >= 1 ? 1e4 : hit.x + lerp(-(x1 - x0) / 2, (x1 - x0) / 2, p) * sc
      fillPl.constant = fx; restPl.constant = -fx
      // os brilhos só onde a letra já encheu
      group.updateMatrixWorld(true)
      all.forEach((L) => L.stars.forEach((sp) => { sp.visible = sp.getWorldPosition(tmp).x < fx }))
      key = `${look.x.toFixed(3)},${look.y.toFixed(3)},${p.toFixed(4)},${ws.toFixed(3)}${flaring ? `,${st.now}` : ''}`
    },
  }
}
const Z_AXIS = new THREE.Vector3(0, 0, 1)

// ========== a mesa (3D) ==========
// Unidades: 1 = a altura da imagem do PC na tela. Origem: o centro da borda de
// baixo da imagem (a frente do teclado, onde o PC encosta na mesa); x para a
// direita, y para cima, z para a câmera. A câmera é posta, a cada quadro, para
// que a origem caia exatamente ali e 1 unidade meça a altura do PC na tela.
const MESA = {
  fov: 18, pitch: 13, // graus: abertura da câmera e o quanto ela olha de cima (o render do PC é um pouco de cima)
  screen: [-0.093, 0.644, -0.42], // o centro da tela do PC (de onde sai a luz na sala escura)
  light: 2.4, // intensidade da luz da tela, com a sala apagada (cai com o quadrado da distância)
}
// A base de corte: grafite, grade cor de papel a cada 0,05 (as linhas fortes a cada 0,25)
const MAT = { w: 2.4, d: 2.1, z0: 0.1, cell: 0.05, major: 5, color: '#1c1d1f' }
// A inclinação: depois da barra em 100%, TRAVEL.len alturas de tela de scroll; a
// câmera vai de MESA.pitch a quase 90° e termina sobre a folha
export const TRAVEL = { len: 1.6, pitch: 89.5 }
// A folha: uma A3 branca deitada na base de corte, um pouco torta, na frente do
// teclado. A inclinação termina sobre ela, perto o bastante para que a folha
// cubra a tela (e a câmera gira junto para endireitá-la)
const SHEET = { w: 0.84, d: 0.594, x: 0.04, z: 0.8, rot: 0.05 }
const PAPER = '#f4f1ea', INK = '#26231c', RED = '#FF4438'
const handFont = '"Nothing You Could Do", cursive'

// texturas desenhadas num canvas (a letra à mão espera a fonte carregar e redesenha)
function canvasTex(w, h, draw, { hand = true } = {}) {
  const c = document.createElement('canvas')
  c.width = w; c.height = h
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  const paint = () => { draw(c.getContext('2d'), w, h); tex.needsUpdate = true }
  paint()
  if (hand) document.fonts.load(`40px ${handFont}`).then(paint, () => {})
  return tex
}
// um traço à mão (tremido) por pontos
function scribble(ctx, pts, width = 5) {
  ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = RED
  ctx.beginPath()
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
  ctx.stroke()
}
// nogueira escura: veios longos e ondulados em tons próximos, poros curtos
const walnutTex = () => canvasTex(2048, 1024, (x, w, h) => {
  const g = x.createLinearGradient(0, 0, 0, h)
  g.addColorStop(0, '#3d291d'); g.addColorStop(0.5, '#33221a'); g.addColorStop(1, '#3a2719')
  x.fillStyle = g; x.fillRect(0, 0, w, h)
  for (let i = 0; i < 1100; i++) {
    const y0 = Math.random() * h, amp = 4 + Math.random() * 26, f = 0.0012 + Math.random() * 0.0028, ph = Math.random() * 6.28
    const dark = Math.random() < 0.62
    x.strokeStyle = dark ? `rgba(16,9,5,${(0.05 + Math.random() * 0.13).toFixed(3)})` : `rgba(150,104,68,${(0.03 + Math.random() * 0.08).toFixed(3)})`
    x.lineWidth = 0.6 + Math.random() * 2.4
    x.beginPath()
    for (let px = -24; px <= w + 24; px += 24) {
      const y = y0 + Math.sin(px * f + ph) * amp + Math.sin(px * f * 3.1 + ph * 2) * amp * 0.22
      if (px === -24) x.moveTo(px, y); else x.lineTo(px, y)
    }
    x.stroke()
  }
  for (let i = 0; i < 7000; i++) { x.fillStyle = `rgba(12,6,3,${(0.08 + Math.random() * 0.16).toFixed(3)})`; x.fillRect(Math.random() * w, Math.random() * h, 2 + Math.random() * 7, 1) }
}, { hand: false })
// a base de corte: grade cor de papel centrada, números de régua nas bordas e um guia de 45° vermelho no canto
const matTex = () => {
  const ppu = 2048 / MAT.w // px de textura por unidade
  return canvasTex(2048, Math.round(MAT.d * ppu), (x, w, h) => {
    x.fillStyle = MAT.color; x.fillRect(0, 0, w, h)
    const cell = MAT.cell * ppu, cx = w / 2, cy = h / 2
    for (let pass = 0; pass < 2; pass++) {
      x.strokeStyle = pass ? 'rgba(244,243,239,.2)' : 'rgba(244,243,239,.08)'
      x.lineWidth = pass ? 1.8 : 1.3
      const step = pass ? cell * MAT.major : cell
      for (let k = -Math.ceil(cx / step); k <= Math.ceil(cx / step); k++) { const px = cx + k * step; x.beginPath(); x.moveTo(px, 0); x.lineTo(px, h); x.stroke() }
      for (let k = -Math.ceil(cy / step); k <= Math.ceil(cy / step); k++) { const py = cy + k * step; x.beginPath(); x.moveTo(0, py); x.lineTo(w, py); x.stroke() }
    }
    // a margem com a numeração (a régua)
    x.fillStyle = MAT.color; x.globalAlpha = 0.86
    x.fillRect(0, 0, w, cell * 1.2); x.fillRect(0, 0, cell * 1.2, h)
    x.globalAlpha = 1
    x.fillStyle = 'rgba(244,243,239,.5)'; x.font = '500 17px "JetBrains Mono", monospace'
    for (let k = 1; k * cell < w; k++) if (k % 5 === 0) x.fillText(String(k), k * cell - 9, cell * 0.85)
    for (let k = 1; k * cell < h; k++) if (k % 5 === 0) x.fillText(String(k), 6, k * cell + 6)
    x.strokeStyle = 'rgba(244,243,239,.35)'; x.lineWidth = 2; x.strokeRect(cell * 1.2, cell * 1.2, w - cell * 2.4, h - cell * 2.4)
    // o guia de 45° no canto de baixo à esquerda
    x.strokeStyle = 'rgba(255,68,56,.75)'; x.lineWidth = 2.4
    x.beginPath(); x.moveTo(cell * 1.2, h - cell * 7); x.lineTo(cell * 7, h - cell * 1.2); x.stroke()
    x.fillStyle = 'rgba(255,68,56,.85)'; x.font = '500 15px "JetBrains Mono", monospace'; x.fillText('45°', cell * 4.4, h - cell * 4.4)
  }, { hand: false })
}
const noteTex = (bg, lines, mark) => canvasTex(256, 256, (x, w, h) => {
  x.fillStyle = bg; x.fillRect(0, 0, w, h)
  x.fillStyle = 'rgba(0,0,0,.05)'; x.fillRect(0, 0, w, 26) // a faixa de cola
  x.fillStyle = INK; x.font = `40px ${handFont}`
  lines.forEach((t, i) => x.fillText(t, 20, 96 + i * 54))
  mark?.(x)
})
const labelTex = (text) => canvasTex(512, 320, (x, w, h) => {
  x.fillStyle = PAPER; x.fillRect(0, 0, w, h)
  x.strokeStyle = 'rgba(0,0,0,.12)'; x.lineWidth = 3
  for (let y = 120; y < h; y += 60) { x.beginPath(); x.moveTo(24, y); x.lineTo(w - 24, y); x.stroke() }
  x.fillStyle = INK; x.font = `92px ${handFont}`; x.fillText(text, 36, 160)
  scribble(x, [[40, 190], [180, 196], [330, 186], [450, 194]], 7)
})
const keyTex = () => canvasTex(256, 192, (x) => {
  x.fillStyle = '#f1eee7'; x.fillRect(0, 0, 256, 192)
  x.fillStyle = '#7a776f'; x.font = '500 34px "JetBrains Mono", monospace'; x.fillText('ENTER', 28, 70)
  x.strokeStyle = '#7a776f'; x.lineWidth = 6; x.lineCap = 'round'; x.lineJoin = 'round'
  x.beginPath(); x.moveTo(200, 110); x.lineTo(200, 150); x.lineTo(130, 150); x.moveTo(150, 132); x.lineTo(130, 150); x.lineTo(150, 168); x.stroke()
}, { hand: false })

function mesa({ desk }, tx) {
  const renderer = new THREE.WebGLRenderer({ canvas: desk, alpha: true, antialias: true })
  renderer.setPixelRatio(Math.min(1.5, devicePixelRatio || 1))
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  // a cena é parada (as luzes e o alvo do sol nunca andam; só a câmera e as
  // intensidades mudam): as sombras são assadas uma vez, não refeitas a cada quadro
  renderer.shadowMap.autoUpdate = false
  renderer.shadowMap.needsUpdate = true
  const scene = new THREE.Scene()
  // reflexos de estúdio (o verniz da mesa, as canecas): só com a lâmpada acesa
  const pmrem = new THREE.PMREMGenerator(renderer)
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
  scene.environment = envTex
  const camera = new THREE.PerspectiveCamera(MESA.fov, 1, 0.05, 40)
  const std = (color, roughness = 0.6, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, ...extra })
  const add = (mesh, { shadow = true, receive = true } = {}) => { mesh.castShadow = shadow; mesh.receiveShadow = receive; return mesh }

  // luzes: a lâmpada (céu + sol + preenchimento) e a tela
  const hemi = new THREE.HemisphereLight(0xffffff, 0xcfc4b3, 0)
  const sun = new THREE.DirectionalLight(0xfff2e2, 0)
  sun.position.set(-1.4, 3.4, 2.6)
  sun.castShadow = true
  Object.assign(sun.shadow.camera, { left: -2.8, right: 2.8, top: 2.8, bottom: -2.8, near: 0.5, far: 10 })
  sun.shadow.mapSize.set(2048, 2048)
  sun.shadow.bias = -0.0004
  sun.shadow.normalBias = 0.02
  const fill = new THREE.DirectionalLight(0xffffff, 0)
  fill.position.set(2.6, 1.4, 1.8)
  const scr = new THREE.PointLight(0xffffff, 0, 4, 2)
  scr.position.set(...MESA.screen)
  scr.castShadow = true
  scr.shadow.mapSize.set(512, 512)
  scr.shadow.bias = -0.002
  scene.add(hemi, sun, sun.target, fill, scr)

  // a mesa: nogueira escura com verniz acetinado, borda arredondada e pés de metal preto;
  // com a base de corte ela vem até perto da câmera. Atrás do PC ela é rasa (back):
  // a borda de trás fica baixa na tela e sobra parede para a palavra e o microtexto
  const wood = walnutTex()
  wood.wrapS = wood.wrapT = THREE.RepeatWrapping
  const back = -0.55, frontZ = 2.6
  const depth = frontZ - back
  wood.repeat.set(1.6, depth / 2.2)
  const deskMat = new THREE.MeshPhysicalMaterial({ map: wood, roughness: 0.48, clearcoat: 0.5, clearcoatRoughness: 0.34 })
  const top = add(new THREE.Mesh(new RoundedBoxGeometry(3.9, 0.07, depth, 4, 0.02), deskMat), { shadow: false })
  top.position.set(0, -0.035, (back + frontZ) / 2)
  scene.add(top)
  const legMat = std(0x161616, 0.4, { metalness: 0.7 })
  const legGeo = new THREE.BoxGeometry(0.045, 2.6, 0.045)
  for (const x of [-1.82, 1.82]) for (const z of [frontZ - 0.07, back + 0.07]) {
    const leg = add(new THREE.Mesh(legGeo, legMat), { receive: false })
    leg.position.set(x, -1.37, z)
    scene.add(leg)
  }
  // a base de corte, fosca (Lambert: sem o reflexo do ambiente)
  const matMesh = new THREE.Mesh(new THREE.PlaneGeometry(MAT.w, MAT.d), new THREE.MeshLambertMaterial({ map: matTex() }))
  matMesh.rotation.x = -Math.PI / 2
  matMesh.position.set(0, 0.0012, MAT.z0 + MAT.d / 2)
  matMesh.receiveShadow = true
  scene.add(matMesh)
  // a folha, fosca; a cor passa um pouco de 1 e puxa para o azul para anular o sol
  // quente da lâmpada: renderizada fica no mesmo branco da seção de trabalhos
  const paper = new THREE.Color().setRGB(1.04, 1.12, 1.22, THREE.LinearSRGBColorSpace)
  const sheet = new THREE.Mesh(new THREE.PlaneGeometry(SHEET.w, SHEET.d), new THREE.MeshLambertMaterial({ color: paper }))
  sheet.rotation.set(-Math.PI / 2, 0, SHEET.rot)
  sheet.position.set(SHEET.x, 0.0018, SHEET.z)
  sheet.receiveShadow = true
  scene.add(sheet)

  // disquetes (os trabalhos estão no disco): uma pilha, o de cima com etiqueta
  const metal = std(0xb9bcc1, 0.3, { metalness: 0.85 })
  const floppy = (color, label = null) => {
    const g = new THREE.Group()
    g.add(add(new THREE.Mesh(new RoundedBoxGeometry(0.2, 0.0075, 0.21, 2, 0.003), std(color, 0.38))))
    const shutter = add(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.0082, 0.072), metal))
    shutter.position.set(0.012, 0, 0.066)
    g.add(shutter)
    if (label) {
      const l = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.094), std(0xffffff, 0.85, { map: label }))
      l.rotation.x = -Math.PI / 2
      l.position.set(0, 0.0039, -0.048)
      l.receiveShadow = true
      g.add(l)
    }
    return g
  }
  const stack = new THREE.Group()
  ;[[0x2a2a2a, 0.1], [0xe8e2d6, -0.08], [0x141414, 0.05], [0xd8432f, -0.12, labelTex(tx.floppy)]].forEach(([c, r, lab], i) => {
    const f = floppy(c, lab)
    f.position.set(Math.sin(i * 2.3) * 0.012, 0.00375 + i * 0.0078, Math.cos(i * 1.7) * 0.01)
    f.rotation.y = r
    stack.add(f)
  })
  stack.position.set(-0.93, 0, -0.26)
  stack.rotation.y = 0.16
  scene.add(stack)

  // as duas canecas (2 pessoas + café): uma branca, uma vermelha
  const mug = (color) => {
    const g = new THREE.Group()
    const prof = [[0, 0], [0.068, 0], [0.077, 0.006], [0.08, 0.022], [0.08, 0.2], [0.072, 0.2], [0.072, 0.014], [0, 0.014]].map(([x, y]) => new THREE.Vector2(x, y))
    const mt = std(color, 0.22)
    g.add(add(new THREE.Mesh(new THREE.LatheGeometry(prof, 56), mt)))
    const handle = add(new THREE.Mesh(new THREE.TorusGeometry(0.046, 0.011, 12, 28, Math.PI), mt))
    handle.rotation.z = -Math.PI / 2
    handle.position.set(0.077, 0.108, 0)
    g.add(handle)
    const coffee = new THREE.Mesh(new THREE.CircleGeometry(0.0725, 40), std(0x2a160b, 0.1))
    coffee.rotation.x = -Math.PI / 2
    coffee.position.y = 0.172
    g.add(coffee)
    return g
  }
  const mugW = mug(0xf3f0ea), mugR = mug(0xff4438)
  mugW.position.set(1.12, 0, -0.1); mugW.rotation.y = -2.4
  mugR.position.set(0.9, 0, -0.34); mugR.rotation.y = -0.6
  scene.add(mugW, mugR)

  // bilhetes na mesa
  const note = (tex, x, z, r) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.26), std(0xffffff, 0.9, { map: tex }))
    m.rotation.set(-Math.PI / 2, 0, r)
    m.position.set(x, 0.0024, z)
    m.receiveShadow = true
    scene.add(m)
  }
  note(noteTex('#f6eda8', tx.notes[0], (x) => scribble(x, [[150, 214], [196, 186], [232, 140], [216, 150], [232, 140], [240, 160]], 6)), 1.02, 0.17, 0.18)
  note(noteTex(PAPER, tx.notes[1], (x) => scribble(x, [[120, 236], [170, 228], [222, 206], [208, 214], [222, 206], [218, 224]], 6)), -0.88, 0.13, -0.22)

  // a tecla ENTER (a da seção 6), solta na mesa
  const cap = add(new THREE.Mesh(new RoundedBoxGeometry(0.118, 0.056, 0.09, 3, 0.012), std(0xf1eee7, 0.5)))
  const capTop = new THREE.Mesh(new THREE.PlaneGeometry(0.09, 0.068), std(0xffffff, 0.5, { map: keyTex() }))
  capTop.rotation.x = -Math.PI / 2
  capTop.position.y = 0.0285
  const key = new THREE.Group()
  key.add(cap, capTop)
  key.position.set(0.66, 0.029, 0.2)
  key.rotation.y = 0.42
  scene.add(key)

  // o lápis, atravessado na frente do teclado
  const pencil = new THREE.Group()
  const part = (geo, mt, x) => { const m = add(new THREE.Mesh(geo, mt)); m.rotation.z = Math.PI / 2; m.position.x = x; pencil.add(m); return m }
  part(new THREE.CylinderGeometry(0.013, 0.013, 0.34, 6), std(0x1d1d1d, 0.45), 0)
  part(new THREE.ConeGeometry(0.013, 0.05, 6), std(0xe2c79c, 0.8), 0.195).rotation.z = -Math.PI / 2
  part(new THREE.ConeGeometry(0.0045, 0.016, 8), std(0x2e2e2e, 0.4), 0.226).rotation.z = -Math.PI / 2
  part(new THREE.CylinderGeometry(0.0138, 0.0138, 0.026, 14), metal, -0.183)
  part(new THREE.CylinderGeometry(0.0128, 0.0128, 0.022, 14), std(0xff4438, 0.7), -0.207)
  pencil.position.set(-0.34, 0.0145, 0.24)
  pencil.rotation.y = -0.38
  scene.add(pencil)

  // os materiais com reflexo: a intensidade segue a lâmpada (no escuro, só a tela ilumina)
  const mats = []
  scene.traverse((o) => [].concat(o.material ?? []).forEach((m) => { if (m.isMeshStandardMaterial && !mats.includes(m)) mats.push(m) }))
  let envLamp = -1

  // a palavra na parede (corte da barra: plano de corte por material), numa cena
  // própria com o estúdio dela (aceso mesmo com a sala escura) e cópias das luzes da
  // sala (o verniz vermelho as sente; o cromo, quase só o estúdio). Ela é desenhada
  // numa textura (wordRT) e posta na tela com a separação de cores (comp); a mesa vem
  // por cima e a encobre embaixo
  renderer.localClippingEnabled = true
  const glossEnv = studioEnv(pmrem)
  const word = palavra(tx, glossEnv)
  const wordScene = new THREE.Scene()
  const wHemi = hemi.clone(), wSun = sun.clone(), wScr = scr.clone()
  wSun.castShadow = wScr.castShadow = false
  wordScene.add(word.group, wHemi, wSun, wSun.target, wScr)
  const wordRT = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 })
  // a textura guarda a cor linear já multiplicada pelo alfa: separa vermelho e azul
  // (o verde fica no centro), recupera o alfa da luz somada (halo, brilhos: viram
  // "screen" sobre a parede) e devolve em sRGB
  const comp = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    uniforms: { u_tex: { value: wordRT.texture }, u_split: { value: new THREE.Vector2() } },
    vertexShader: 'varying vec2 v_uv; void main() { v_uv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: `uniform sampler2D u_tex; uniform vec2 u_split; varying vec2 v_uv;
      vec3 enc(vec3 c) { return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
      void main() {
        vec4 c = texture2D(u_tex, v_uv);
        vec3 col = vec3(texture2D(u_tex, v_uv + u_split).r, c.g, texture2D(u_tex, v_uv - u_split).b);
        float a = clamp(max(c.a, max(col.r, max(col.g, col.b))), 0.0, 1.0);
        gl_FragColor = vec4(enc(clamp(col / max(a, 1e-4), 0.0, 1.0)) * a, a);
      }`,
    depthTest: false, depthWrite: false, blending: THREE.NoBlending,
  }))
  comp.frustumCulled = false
  const compScene = new THREE.Scene().add(comp), compCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)

  let w = 0, h = 0, last = '', horizon = Infinity
  const glowColor = new THREE.Color()
  const v = new THREE.Vector3()
  const proj = (x, y, z) => { v.set(x, y, z).project(camera); return [((v.x + 1) / 2) * w, ((1 - v.y) / 2) * h] }
  // a câmera em e (0 = de frente, a origem na base do PC; 1 = de cima, sobre a
  // folha e perto o bastante para que ela cubra a tela)
  const place = (st, e) => {
    const fov = (MESA.fov * Math.PI) / 180, t = Math.tan(fov / 2)
    const D0 = h / (2 * t * st.dev.h) // 1 unidade = altura do PC
    const D1 = (Math.min(SHEET.d, (SHEET.w * h) / w) * 0.94) / (2 * t)
    const pitch = (lerp(MESA.pitch, TRAVEL.pitch, e) * Math.PI) / 180, D = lerp(D0, D1, e)
    const tx = lerp(0, SHEET.x, e), tz = lerp(0, SHEET.z, e)
    camera.position.set(tx, D * Math.sin(pitch), tz + D * Math.cos(pitch))
    camera.lookAt(tx, 0, tz)
    camera.rotateZ(SHEET.rot * easeInOut(ramp(e, 0.55, 1))) // endireita a folha no fim (o PC já saiu de quadro)
    camera.near = D * 0.05; camera.far = D * 8
    const ox = st.dev.x + st.dev.w / 2, oy = st.dev.y + st.dev.h
    camera.aspect = w / h
    camera.setViewOffset(w, h, lerp(w / 2 - ox, 0, e), lerp(h / 2 - oy, 0, e), w, h)
    camera.updateProjectionMatrix()
    camera.updateMatrixWorld()
  }

  return {
    /** y de tela da borda de trás da mesa (acima é parede) */
    get horizon() { return horizon },
    /** y de tela do pé da palavra */
    get wordBottom() { return word.bottom },
    resize(vw, vh) {
      w = vw; h = vh
      renderer.setSize(vw, vh, false)
      const pr = renderer.getPixelRatio()
      wordRT.setSize(Math.round(vw * pr), Math.round(vh * pr))
      last = ''
    },
    /** sob a tela de carregamento: compila os shaders, sobe as texturas e assa as
     *  sombras — feito no 1º quadro visível, travava a página por até 2 s */
    async warm() {
      await renderer.compileAsync(scene, camera)
      await renderer.compileAsync(wordScene, camera)
      renderer.compile(compScene, compCam)
      ;[scene, wordScene].forEach((sc) => sc.traverse((o) => [].concat(o.material ?? []).forEach((m) => { if (m.map) renderer.initTexture(m.map) })))
      renderer.render(scene, camera) // shadowMap.needsUpdate: este render assa as sombras
      drawAll(renderer, scene, camera) // (as sombras já assadas: este só usa cada shader uma vez)
      renderer.clear()
      last = ''
    },
    frame(st) {
      if (!w || st.T < 0.38) return null // antes do zoom a mesa está fora de quadro
      const e = easeInOut(st.T2)
      // o PC (imagem) acompanha a mesa enquanto a câmera inclina: a base dele fica
      // presa ao mesmo ponto da mesa, e ele encolhe como a câmera o veria
      let pc = null
      place(st, 0)
      horizon = proj(0, 0, back)[1] // a borda de trás do tampo, com a câmera de frente
      word.layout(st, camera, proj, horizon, st.sideH)
      if (e > 0) {
        const O0 = proj(0, 0, 0), U0 = proj(0, 1, 0), L0 = proj(-0.5, 0, 0), R0 = proj(0.5, 0, 0), W0 = proj(0, 0.5, -1.6)
        place(st, e)
        const O = proj(0, 0, 0), U = proj(0, 1, 0), L = proj(-0.5, 0, 0), R = proj(0.5, 0, 0), Wp = proj(0, 0.5, -1.6)
        pc = {
          e: st.T2, ax: O0[0], ay: O0[1], dx: O[0] - O0[0], dy: O[1] - O0[1],
          sx: (R[0] - L[0]) / (R0[0] - L0[0]), sy: (O[1] - U[1]) / (O0[1] - U0[1]), wallDy: Wp[1] - W0[1],
        }
      }

      const sig = `${st.T.toFixed(4)}|${e.toFixed(4)}|${st.lamp}|${st.glow.toFixed(3)}|${st.dev.x.toFixed(1)}|${st.dev.y.toFixed(1)}|${st.dev.h.toFixed(1)}|${st.gc}|${word.key}`
      if (sig === last) return pc
      last = sig
      // a luz: a tela sozinha na sala escura; a lâmpada acende o resto (e os reflexos)
      const Lm = st.lamp
      hemi.intensity = 0.04 + 0.95 * Lm
      sun.intensity = 2.6 * Lm
      fill.intensity = 0.5 * Lm
      scr.intensity = MESA.light * st.glow
      glowColor.setRGB(st.gc[0] / 255, st.gc[1] / 255, st.gc[2] / 255, THREE.SRGBColorSpace)
      scr.color.copy(glowColor)
      if (envLamp !== Lm) { envLamp = Lm; mats.forEach((m) => { m.envMapIntensity = 0.06 + 0.7 * Lm }); word.lamp(Lm) }
      // a palavra (com as mesmas luzes da sala) numa textura, posta na tela com a
      // separação de cores; a mesa por cima. Sem letra na tela, só a mesa
      if (word.shown) {
        wHemi.intensity = hemi.intensity; wSun.intensity = sun.intensity
        wScr.intensity = scr.intensity; wScr.color.copy(scr.color)
        renderer.setRenderTarget(wordRT)
        renderer.clear()
        renderer.render(wordScene, camera)
        renderer.setRenderTarget(null)
        const sp = word.split
        comp.material.uniforms.u_split.value.set(sp, sp * 0.3)
        renderer.autoClear = false
        renderer.clear()
        renderer.render(compScene, compCam)
        renderer.render(scene, camera)
        renderer.autoClear = true
      } else renderer.render(scene, camera)
      return pc
    },
    dispose() {
      const seen = new Set()
      ;[scene, wordScene, compScene].forEach((sc) => sc.traverse((o) => {
        o.geometry?.dispose()
        ;[].concat(o.material ?? []).forEach((m) => { if (seen.has(m)) return; seen.add(m); m.map?.dispose(); m.dispose() })
      }))
      envTex.dispose()
      glossEnv.dispose()
      wordRT.dispose()
      pmrem.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
    },
  }
}

// cartaz + mesa + folha. No fim da inclinação a folha 3D faz crossfade para um
// branco em CSS (.ecm-sheet), o mesmo da seção de trabalhos que vem logo abaixo
// tx: os textos no idioma da página (strings.js → pc)
export function mountPCDesk(layers, tx) {
  const m = mesa(layers, tx)
  const c = cartaz(layers, tx)
  const sheetLayer = Object.assign(document.createElement('div'), { className: 'ecm-sheet' })
  layers.front.prepend(sheetLayer)
  return {
    resize(vw, vh) { m.resize(vw, vh); c.resize() },
    warm: () => m.warm(),
    frame(st) {
      const pc = m.frame({ ...st, sideH: c.sideH })
      c.frame({ ...st, pc, wordBottom: m.wordBottom })
      css(sheetLayer, 'opacity', n3(ramp(st.T2, 0.86, 1)))
      return pc
    },
    dispose() {
      m.dispose()
      c.dispose()
      layers.back.innerHTML = ''
      layers.front.innerHTML = ''
    },
  }
}
