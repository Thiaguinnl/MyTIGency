// Seção 6 do Manifesto ("Cada linha foi escrita e posicionada exatamente
// assim. Você não está lendo sobre o nosso trabalho. Você está vivenciando."),
// portada do /lab/secao6/v11. O DOM é montado aqui, a partir dos textos
// (strings.js → act2.c), dentro de .s6; o hook (useManifestoHorizontal)
// remonta quando o idioma muda.
//
// A cena é um editor: "ler" é a tela (tecla, cursor, caixas); "vivenciar" é a
// mão (rabiscos finos de caneta, fotos reais, papel). A régua do rodapé chega
// no punho em dither da seção 5 (manifestoS5.js → take/carry) e vira a "linha"
// de CADA ___ LINHA: as palavras surgem em volta dela, o punho solta, vira a
// seta do Figma e segue como o cursor do editor — o mesmo dither, mudando de
// forma (texto, mover, lápis, redimensionar). "foi escrita" é digitada pelo
// scroll; a tecla ENTER (render do Blender) é uma "letra" a mais e leva um
// clique, com o impacto do PC da seção 2; o cursor faz cada gesto de verdade
// (clica, arrasta, risca com a ponta do lápis, puxa a alça e descansa ao lado
// de "trabalho." — é o mesmo cursor que segue
// para dentro do PC, manifestoPC.js). Fotos: entram em dither e assentam em
// cor (a 1ª, quadrada, é o "+" de "+ E POSICIONADA"). Stop-motion de 2 poses
// (~0,5 s, em degrau, fora de fase) nas etiquetas, caixas, rabiscos e na tecla.
//
// Linha do tempo: p em alturas de tela de scroll a partir do fim do
// deslocamento lateral (shift 0→1, 1 px de scroll = 1 px de lado); p vai até
// LENGTH. Os primeiros LEAD são da régua chegando (assenta, o punho solta e
// vira seta); o roteiro do editor conta dali. Posições são função do scroll;
// cliques, stop-motion e troca de forma andam no tempo real (rAF próprio, só com a seção na tela).
// Sem o pin (mobile) ou com reduced motion: o cartaz final, parado, com uma
// régua desenhada no vão.
import { mountTextGL, mountGridGL, canvasFont, placeholderImage } from './manifestoS6GL'
import { HAND, FIST, FIST_C, EDITOR, GRAB_AT, GRIP_Y, RULER_SEAT, shadeOf, drawSprite } from './ditherSprite'
import linhaImg from '../assets/s6/linha.jpg'
import nossoImg from '../assets/s6/nosso.jpg'
// tecla ENTER: render do Blender (lab/secao6/keycap/keycap.blend), 3 poses
import keyIdle from '../assets/s6/enter-idle.webp'
import keyPose2 from '../assets/s6/enter-pose2.webp'
import keyPressed from '../assets/s6/enter-pressed.webp'

const clamp01 = (v) => Math.min(1, Math.max(0, v))
const ramp = (p, a, b) => clamp01((p - a) / (b - a))
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)
const easeOut3 = (x) => 1 - (1 - x) ** 3
const lerp = (a, b, t) => a + (b - a) * t
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])

// imagens entre as palavras (sem src = placeholder abstrato)
const IMG = {
  '@line': { src: linhaImg, seed: 1, sq: true },
  '@ours': { src: nossoImg, seed: 4 },
}
const KEYCAP = '@key' // a tecla ENTER no fim de "foi escrita"
const RULER = '@ruler' // o vão de CADA ___ LINHA, onde a régua assenta
// o papel de cada linha (strings.js → act2.c.lines: sempre 10, nesta ordem)
const KINDS = [null, 'type', 'move', 'mark', null, 'strike', 'ours', 'wide', 'stair', 'grow']
const IN = [0, 0.2, 0.56, 1.18, 1.5, 1.66, 2.16, 2.3, 2.46, 2.62]
const ENTER = 0.24 // quanto scroll a linha leva para assentar
const P = {
  type: [0.2, 0.44], key: 0.52, // a digitação acompanha o scroll; o clique na tecla
  move: { show: [0.56, 0.66], grab: 0.72, drop: [0.75, 1.08], boxOut: [1.1, 1.18] },
  mark: [1.22, 1.4], tag: 1.38, circle: [1.38, 1.62],
  ours: 2.34,
  strike: { draw: [1.8, 2.1], hollow: [2.02, 2.16] },
  grow: { box: [2.7, 2.78], drag: [2.84, 3.14] },
  // o fim acontece devagar: o sublinhado e a seta têm cada um o seu respiro; depois a
  // interface some (ui) e a câmera recua até o cartaz, com a palavra centralizada (fit)
  marker: [3.22, 3.52],
  hand: { arrow: [3.6, 3.82], tag: 3.82 },
  outro: { ui: [3.98, 4.38], fit: [4.04, 4.72] },
}
const LENGTH = 4.85
// a chegada da régua, antes do roteiro (alturas de tela): ela desce e se
// nivela no vão (seat), CADA e LINHA surgem em volta, o punho vira a seta
const LEAD = 0.4
const ARRIVE = { line0: [0.06, 0.32], seat: [0, 0.22], arrow: [0.22, 0.36] }
// o roteiro segue o scroll com freio: rolando rápido, ele anda no máximo
// max alturas de tela por segundo (e assenta com a inércia tau, s) — o cursor
// e o lápis nunca pulam. Enquanto o lápis desenha (rabiscos à mão), o teto
// cai para draw: o traço sai devagar, por mais rápido que se role; a troca
// entre os tetos é suave (shift, s)
// rush: o scroll já passou do fim da seção (rolou rápido para o PC): o que falta do
// roteiro toca nesse ritmo, sem o freio dos desenhos, e só então o PC começa a transição
// (useManifestoHorizontal → stepPC). Com scroll lento ele nunca entra
const PACE = { tau: 0.18, max: 0.9, draw: 0.14, shift: 0.3, rush: 2.6 }
// a régua assentando: desce e passa um tiquinho do lugar antes de parar
const settle = (u) => 1 + 2.2 * (u - 1) ** 3 + 1.2 * (u - 1) ** 2
// a régua no texto: encolhe só um pouco (o vão é que alarga); teto em fração da coluna
const RULER_FIT = { shrink: 0.88, max: 0.42 }
const MORPH_MS = 160 // troca de forma do cursor (dither, por limiar de Bayer)
// depois da seta, o cursor vai descansar ao lado de "trabalho." / "você está"
// (alturas de tela): é ali que o PC (manifestoPC.js) o pega e ele segue para os pop-ups
const REST = 4.6
const FOCUS = 0.56
const PAN = 0.26
const MOVE_FROM = { x: 0.24, y: 0.6, rot: 5 }
const PAD = { x: 0.4, y: 1.15 } // folga do quad em volta do texto (em), para curva, rastro e onda
// entrada: as letras sobem de trás da máscara, uma depois da outra, ondulando como na
// água e deixando rastro vermelho (stagger: quanto a última letra espera; rise e trail
// em alturas da linha)
const FX = { bend: 1.0, stagger: 0.6, rise: 1.05, wave: 0.06, blur: 14, trail: 0.8, rgb: 7, grain: 0.12 }
const SPEED = { bend: 0.45, rgb: 5, motion: 1.4 }
const DEFOCUS = { blur: 0.6, dim: 0.18 } // linhas anteriores à da vez (bem leve)
const TAU = { line: 0.16, cam: 0.11, cur: 0.14, focus: 0.25 } // inércias (s)
const BALL = { r: 46, strength: 1 }
// ritmo da digitação (ms de roteiro, esticados sobre P.type): intervalo base + variação,
// pausa depois de espaço, respiro antes da tecla
const TYPE = { first: 140, base: 72, jitter: 58, space: 120, image: 240 }
const FIT = 0.74 // o cartaz final ocupa esta fração da altura
// fotos: o dither segura um pouco e se desfaz em cor, célula a célula, em 8 degraus
// (12,5 qps, o ritmo dos pontos da grade)
const DITHER = { hold: 0.45, dur: 0.64, steps: 8 }
const POSE = 500 // ms por pose do stop-motion
// cliques (tempo real, como o esbarrão no PC da seção 2): quanto a tecla fica afundada (s),
// o recuo do cursor (px) e o giro dele (graus)
const HIT = { pressed: 0.16, bump: 7, spin: 14 }
const NARROW = 700 // até aqui (mobile, empilhado): coluna mais larga, corpo pela largura

// rabiscos à mão (viewBox 100 × 100): cada passada é um traço com o próprio tremor;
// duas poses = duas sementes, para o stop-motion. [desenho, passadas, tremor]
const SCRIBBLE = {
  // risco de "lendo": vai, volta e vai de novo, cada passada numa altura
  strike: [(k) => (t) => [lerp(2, 98, k % 2 ? 1 - t : t), [42, 62, 50][k] - t * [6, -4, 8][k]], 3, 4],
  // círculo de "exatamente": passa do ponto de partida e não fecha igual
  circle: [(k) => (t) => { const a = -2.7 + t * Math.PI * 2 * [1.1, 0.92][k]; const r = [1, 1.05][k]; return [50 + Math.cos(a) * 49 * r, 52 + Math.sin(a) * 45 * r] }, 2, 2.2],
  // sublinhado de "vivenciando.": vai e volta mais baixo
  under: [(k) => (t) => (k ? [lerp(97, 8, t), 78 - t * 10] : [lerp(0, 100, t), 30 + Math.sin(t * Math.PI) * 12]), 2, 5],
  // seta da etiqueta "feito à mão" até o sublinhado: haste curva + duas farpas
  arrow: [(k) => (t) => (k === 0 ? [lerp(92, 14, t) + Math.sin(t * Math.PI) * 18, lerp(94, 10, t) + Math.sin(t * Math.PI) * 14]
    : k === 1 ? [lerp(14, 40, t), lerp(10, 14, t)] : [lerp(14, 20, t), lerp(10, 38, t)]), 3, 1.6],
}
// o traço em px do próprio svg (w × h); o tremor em px (amp)
function scribblePath(fn, seed, amp, w, h) {
  let s = seed
  const r = () => (s = (s * 9301 + 49297) % 233280) / 233280
  const ph = [r(), r(), r(), r()].map((v) => v * 6.283)
  const pts = Array.from({ length: 29 }, (_, i) => {
    const t = i / 28
    const [x, y] = fn(t)
    return [(x * w) / 100 + amp * 0.3 * Math.sin(t * 13 + ph[0]), (y * h) / 100 + amp * (0.6 * Math.sin(t * 9 + ph[1]) + 0.4 * Math.sin(t * 23 + ph[2]))]
  })
  // curva suave pelos pontos médios
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`
  for (let i = 1; i < pts.length - 1; i++) d += ` Q${pts[i][0].toFixed(1)} ${pts[i][1].toFixed(1)} ${((pts[i][0] + pts[i + 1][0]) / 2).toFixed(1)} ${((pts[i][1] + pts[i + 1][1]) / 2).toFixed(1)}`
  return `${d} L${pts.at(-1)[0].toFixed(1)} ${pts.at(-1)[1].toFixed(1)}`
}
const scribbleSvg = (kind) => `<svg class="s6-scr s6-scr--${kind}" data-kind="${kind}" data-n="${SCRIBBLE[kind][1]}" data-pose="0" aria-hidden="true"></svg>`
// (re)desenha as passadas no tamanho atual do svg; tremor em centésimos do corpo da linha
function buildScribble(svg, fs) {
  const [make, n, amp] = SCRIBBLE[svg.dataset.kind]
  const w = svg.clientWidth
  const h = svg.clientHeight
  const pose = (p) => `<g class="p${p}">${Array.from({ length: n }, (_, k) => `<path pathLength="1" data-k="${k}" d="${scribblePath(make(k), 11 + k * 7 + p * 101, (amp * fs) / 100, w, h)}"/>`).join('')}</g>`
  svg.setAttribute('viewBox', `0 0 ${w} ${h}`)
  svg.innerHTML = pose(0) + pose(1)
}

const HANDLES = '<i></i>'.repeat(6)
const IMG_KEYS = Object.keys(IMG)
const unitHtml = (part) => (part === KEYCAP
  ? `<span class="s6-lt s6-kc" data-s="idle"><img class="k-idle" src="${keyIdle}" alt=""><img class="k-pose2" src="${keyPose2}" alt=""><img class="k-pressed" src="${keyPressed}" alt=""></span>`
  : part === RULER
    ? '<span class="s6-lt s6-slot"></span>'
    : IMG[part]
      ? `<span class="s6-lt s6-im${IMG[part].sq ? ' s6-im--sq' : ''}" data-img="${IMG_KEYS.indexOf(part)}"></span>`
      : [...part].map((c) => `<span class="s6-lt">${esc(c)}</span>`).join(''))
const T_CLS = { mark: 's6-mark', strike: 's6-hollow', grow: 's6-it' }
const LN_CLS = { grow: 's6-ln--grow', wide: 's6-ln--wide', stair: 's6-ln--stair' }
const lineHtml = ({ parts, kind }) => `<p class="s6-ln ${LN_CLS[kind] ?? ''}"><span class="s6-t ${T_CLS[kind] ?? ''}">${parts.map(unitHtml).join('')}</span></p>`
const fgHtml = (tags) => ({
  type: '<span class="s6-caret"></span>',
  move: `<span class="s6-box">${HANDLES}</span><span class="s6-snap">← 0 px</span>`,
  mark: `${scribbleSvg('circle')}<span class="s6-tag s6-tag-xy"></span>`,
  strike: scribbleSvg('strike'),
  ours: `<span class="s6-tag s6-tag--paper s6-tag-ours">${esc(tags.ours)}</span>`,
  grow: `<span class="s6-box">${HANDLES}</span><span class="s6-tag s6-tag-scale"></span>${scribbleSvg('under')}${scribbleSvg('arrow')}<span class="s6-tag s6-tag--paper s6-tag-hand">${esc(tags.hand)}</span>`,
})
// painel de ferramentas (só as que a cena usa; a mão = a pegada que trouxe a régua)
const TOOLS = [
  ['grab', '<path d="M6 9V4.5a1.2 1.2 0 0 1 2.4 0V8M8.4 8V3.5a1.2 1.2 0 0 1 2.4 0V8M10.8 8V4.5a1.2 1.2 0 0 1 2.4 0V10c0 3.3-2 5.5-5 5.5-2.2 0-3.4-1.2-4.4-3L2.5 10a1.2 1.2 0 0 1 2-1.3L6 10.5"/>'],
  ['arrow', '<path d="M4 2v12l3-3 2.2 4.6 1.8-.9L8.8 10H13Z" class="fill"/>'],
  ['move', '<path d="M9 1v16M1 9h16M9 1 7 3M9 1l2 2M9 17l-2-2M9 17l2-2M1 9l2-2M1 9l2 2M17 9l-2-2M17 9l-2 2"/>'],
  ['text', '<path d="M3 3h12M9 3v12M6 15h6"/>'],
  ['brush', '<path d="M12.5 2.5 15.5 5.5 6 15H3v-3Z M10.5 4.5l3 3"/>'], // lápis: os rabiscos à mão
  ['resize', '<path d="M3 3h5M3 3v5M3 3l12 12M15 15h-5M15 15v-5"/>'],
]

/**
 * @param host  .s6 (data-s6 = strings.js → act2.c)
 * @param opts  { still?: só o cartaz final, parado (mobile, sem o pin);
 *                ruler?: a régua do rodapé (.ms-ruler), que a seção 5 traz no punho }
 */
export function mountS6(host, { still = false, ruler = null } = {}) {
  const data = JSON.parse(host.dataset.s6)
  const REDUCE = still || matchMedia('(prefers-reduced-motion: reduce)').matches
  const FINE = matchMedia('(pointer: fine)').matches
  // a régua de verdade só vem no punho com o movimento liberado; senão, desenhada no vão
  const carried = !!ruler && !REDUCE
  const LINES = data.lines.map((parts, i) => ({ parts, kind: KINDS[i] }))
  const FG = fgHtml(data.tags)
  host.innerHTML = `
    <div class="s6-ed">
      <canvas class="s6-grid-gl"></canvas><div class="s6-grid"></div>
      <div class="s6-chrome"><div class="s6-guide"></div></div>
      <div class="s6-clip">
        <div class="s6-art">${LINES.map(lineHtml).join('')}</div>
        <canvas class="s6-gl"></canvas>
        <div class="s6-art s6-fg">${LINES.map(({ kind }) => `<div class="s6-fgl">${FG[kind] ?? ''}</div>`).join('')}</div>
      </div>
      <div class="s6-chrome">
        <div class="s6-bar"><span class="s6-sp"></span></div>
        <div class="s6-tools">${TOOLS.map(([name, svg]) => `<i data-tool="${name}"><svg viewBox="0 0 18 18">${svg}</svg></i>`).join('')}</div>
      </div>
      <div class="s6-impact"><svg viewBox="-50 -50 100 100">${[0, 45, 90, 135, 180, 225, 270, 315].map((a) => `<line x1="0" y1="-16" x2="0" y2="-34" transform="rotate(${a})"/>`).join('')}</svg></div>
      <div class="s6-ball"></div>
    </div>`

  const q = (s) => host.querySelector(s)
  const ed = q('.s6-ed')
  const art = q('.s6-art')
  const fg = q('.s6-fg')
  const guide = q('.s6-guide')
  const lns = [...art.querySelectorAll('.s6-ln')]
  const ts = lns.map((l) => l.querySelector('.s6-t'))
  const fgls = [...fg.querySelectorAll('.s6-fgl')]
  const at = (kind) => LINES.findIndex((l) => l.kind === kind)
  const iType = at('type'), iMove = at('move'), iMark = at('mark'), iStrike = at('strike'), iGrow = at('grow')
  const caret = fgls[iType].querySelector('.s6-caret')
  const moveBox = fgls[iMove].querySelector('.s6-box')
  const snap = fgls[iMove].querySelector('.s6-snap')
  const tagXY = q('.s6-tag-xy')
  const growBox = fgls[iGrow].querySelector('.s6-box')
  const tagScale = q('.s6-tag-scale')
  const fgOf = (kind, s) => fgls[at(kind)].querySelector(s)
  const scr = { circle: fgOf('mark', '.s6-scr'), strike: fgOf('strike', '.s6-scr'), under: fgOf('grow', '.s6-scr--under'), arrow: fgOf('grow', '.s6-scr--arrow') }
  const tagOurs = q('.s6-tag-ours')
  const tagHand = q('.s6-tag-hand')
  const key = q('.s6-kc')
  const impact = q('.s6-impact')
  const growHandle = growBox.querySelector('i:nth-child(6)')
  // stop-motion: cada peça com a sua fase (fora de fase entre si)
  const POSED = [[tagXY, 0], [tagScale, 0.5], [tagOurs, 0.25], [tagHand, 0.75], [moveBox, 0.4], [growBox, 0.9],
    [scr.circle, 0.15], [scr.strike, 0.6], [scr.under, 0.35], [scr.arrow, 0.85]]
  const ball = q('.s6-ball')
  const slot = q('.s6-slot')
  ed.classList.toggle('is-still', !carried)
  // o cursor do editor: desenho em pixel no dither, numa camada fixa (como a mão da seção 5)
  const cv = still ? null : Object.assign(document.createElement('canvas'), { className: 's6-cv' })
  const cx = cv?.getContext('2d')
  if (cv) { cv.setAttribute('aria-hidden', 'true'); document.body.append(cv) }
  const SPR = Object.fromEntries(Object.entries(EDITOR).map(([k, [art, anchor]]) => [k, { art: shadeOf(art), anchor }]))
  const fist = shadeOf(FIST)
  const rParts = ruler ? ['.ms-ruler-cap', '.ms-ruler-lock'].flatMap((s) => [...ruler.querySelectorAll(s)]) : []
  const tools = Object.fromEntries([...host.querySelectorAll('.s6-tools [data-tool]')].map((el) => [el.dataset.tool, el]))
  const typeUnits = [...ts[iType].querySelectorAll('.s6-lt')]
  // a bola de quem visita substitui o cursor do site (useContextualCursor) sobre a cena
  const cursorRoot = host.closest('.manifesto')

  const gl = mountTextGL(q('.s6-gl'))
  ed.classList.toggle('gl-on', !!gl)
  const grid = mountGridGL(q('.s6-grid-gl')) // sem WebGL, a grade em CSS (.s6-grid) assume
  ed.classList.toggle('grid-on', !!grid)
  const glLines = gl ? LINES.map(() => gl.addLine()) : []
  const st = LINES.map(() => ({ e: 0, foc: 0 })) // estado com inércia de cada linha

  let alive = true
  // imagens: placeholder até a foto carregar (aí a linha é redesenhada)
  const imgSlots = Object.values(IMG).map((slot) => {
    const s = { src: placeholderImage(slot.seed), lines: [] }
    if (slot.src) {
      const img = new Image()
      img.onload = () => {
        if (!alive) return
        s.src = img
        s.lines.forEach((i) => drawLine(i))
        if (still) renderStill()
      }
      img.src = slot.src
    }
    return s
  })
  lns.forEach((ln, i) => ln.querySelectorAll('.s6-im').forEach((el) => imgSlots[+el.dataset.img].lines.push(i)))

  // digitação: o roteiro de cada tecla, com ritmo humano (fixo: semente), esticado sobre P.type
  let seed = 7
  const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280 }
  let acc = TYPE.first
  const typeAt = typeUnits.map((el, i) => {
    if (i > 0) acc += TYPE.base + rnd() * TYPE.jitter + (typeUnits[i - 1].textContent === ' ' ? TYPE.space : 0) + (el === key ? TYPE.image : 0)
    return acc
  })
  // cliques (tempo real): disparam ao passar do ponto no scroll; subir rearma
  const HITS = { key: P.key, grab: P.move.grab }
  const hitT0 = { key: null, grab: null }
  let lastHit = null
  // fotos: instante em que cada linha mostrou a sua (o dither se desfaz a partir dele)
  const imgT0 = LINES.map(() => null)
  const hasImg = LINES.map(({ parts }) => parts.some((pt) => pt === KEYCAP || IMG[pt]))

  // rabisco desenhado até u (0..1): as passadas, uma depois da outra
  const drawn = new Map()
  const drawScribble = (svg, u) => {
    if (drawn.get(svg) === u) return
    drawn.set(svg, u)
    const n = +svg.dataset.n
    svg.querySelectorAll('path').forEach((pth) => { pth.style.strokeDashoffset = 1 - clamp01(u * n - pth.dataset.k) })
  }
  const setPose = (el, pose) => { if (el.dataset.pose !== String(pose)) el.dataset.pose = pose }

  let vw = 0
  let vh = 0
  let W = 0
  let ax0 = 0
  let gsMax = 1
  let fsBase = []
  let view = null
  let curPos = null
  let moveOff = { x: 0, y: 0, rot: 0 }
  let lastNow = 0
  let lastAy = 0
  let speed = 0
  let toolOn = ''
  let cell = 2 // px por célula do cursor em dither (o hook passa: a mão da seção 5 × EDITOR_CELL)
  let dockW = 0
  let rulerH = 34
  let owning = false // a régua está presa ao texto (é desta seção)
  // nest: o editor desenhado dentro de uma caixa escalada (a tela do PC, manifestoPC.js);
  // a régua vai junto, para dentro dele. Medidas de tela → px do editor: ÷ edK(e)
  let nested = false
  let ballBlocked = false // o PC passou do tranco: a bola sai, volta o cursor do site
  let lastRenderKey = null
  let boxes = null // medidas de layout das linhas (lineBoxes)
  let camSettled = false // a câmera do editor já assentou no alvo (done)
  let caretLeft = 0
  // a caixa do editor na tela, lida uma vez por quadro (o update a zera): os
  // transforms que ele escreve são dos filhos, ela mesma só muda com quem a contém
  let edNow = null
  const edRect = () => edNow || (edNow = ed.getBoundingClientRect())
  // Aninhada na tela do PC, as leituras de posição (getBoundingClientRect) do quadro
  // são feitas todas juntas no começo do update — um layout só —, e o resto do update
  // usa esse retrato: lidas no meio dele, depois das escritas do PC e da própria seção,
  // cada uma forçava um layout do documento (o roteiro ainda anda no começo do PC:
  // câmera, crescimento). O retrato é o editor antes das escritas deste quadro, um
  // quadro de atraso, dentro da tela do PC (onde quem desenha o cursor é o PC).
  // Quais ler: as que o quadro anterior pediu (o trecho do roteiro muda pouco)
  let shot = new Map()
  let wanted = new Map() // chave → leitura
  const ids = new WeakMap()
  let nextId = 0
  const idOf = (el) => { if (!ids.has(el)) ids.set(el, ++nextId); return ids.get(el) }
  const nestedRead = (k, fn) => {
    if (!nested) return fn()
    wanted.set(k, fn)
    if (!shot.has(k)) shot.set(k, fn())
    return shot.get(k)
  }
  function takeShot() {
    const w = wanted
    shot = new Map()
    wanted = new Map()
    if (nested) for (const [k, fn] of w) shot.set(k, fn())
  }
  const edK =(e) => e.width / (ed.offsetWidth || e.width || 1)

  const fsOf = (i, gs = 1) => fsBase[i] * (i === iGrow ? gs : 1)
  const placeFg = (i) => {
    const t = ts[i]
    const fsz = getComputedStyle(lns[i]).fontSize
    Object.assign(fgls[i].style, {
      left: `${lns[i].offsetLeft + t.offsetLeft}px`, top: `${lns[i].offsetTop + t.offsetTop}px`,
      width: `${t.offsetWidth}px`, height: `${t.offsetHeight}px`, fontSize: fsz,
    })
    fgls[i].style.setProperty('--lfs', fsz)
  }
  // a textura de uma linha: cada letra e cada cápsula no x/y que o DOM mediu
  function drawLine(i) {
    if (!gl || !vw) return
    const t = ts[i]
    const units = [...t.querySelectorAll('.s6-lt:not(.s6-im):not(.s6-kc):not(.s6-slot)')]
    const cs = getComputedStyle(units[0])
    const upper = cs.textTransform === 'uppercase'
    const fs = parseFloat(cs.fontSize)
    glLines[i].draw({
      width: t.offsetWidth, height: t.offsetHeight,
      font: canvasFont(cs).font,
      glyphs: units.map((el) => ({ ch: upper ? el.textContent.toUpperCase() : el.textContent, x: el.offsetLeft, top: el.offsetTop, h: el.offsetHeight })),
      images: [...t.querySelectorAll('.s6-im')].map((el) => ({ x: el.offsetLeft, top: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight, src: imgSlots[+el.dataset.img].src })),
      pad: { x: PAD.x * fs, y: PAD.y * fs },
      res: Math.min(2, devicePixelRatio || 1),
    })
  }

  /** size: { vw, vh } da cena (no pin, a tela; empilhada, a caixa da seção);
   *  dockW: a largura da régua na seção 5; cell: px por célula do cursor em dither */
  function measure(size = { vw: host.clientWidth, vh: host.clientHeight }) {
    ({ vw, vh } = size)
    boxes = null
    if (size.cell) cell = size.cell
    if (size.dockW) dockW = size.dockW
    if (!vw || !vh) return
    const narrow = vw <= NARROW
    const fs = narrow ? Math.max(18, Math.min(vw * 0.075, vh * 0.1)) : Math.max(40, Math.min(vw * 0.06, vh * 0.1, 116))
    ed.style.setProperty('--fs', `${fs}px`)
    lns[iGrow].style.setProperty('--gs', 1)
    W = vw * (narrow ? 0.92 : 0.62)
    ax0 = (vw - W) / 2
    art.style.width = fg.style.width = `${W}px`
    // o vão de CADA ___ LINHA: a régua da seção 5, só um pouco menor
    slot.style.width = `${Math.min((dockW || W * 0.3) * RULER_FIT.shrink, W * RULER_FIT.max)}px`
    rulerH = ruler?.offsetHeight || 34
    fsBase = lns.map((l) => parseFloat(getComputedStyle(l).fontSize))
    gsMax = Math.min(2.6, (W * 0.98) / ts[iGrow].offsetWidth)
    // a guia marca onde "e posicionada" encaixa
    guide.style.left = `${ax0 + W / 2}px`
    snap.style.left = '-64px'
    snap.style.top = '.38em'
    tagXY.style.left = `${ts[iMark].offsetWidth + 18}px`
    tagXY.style.top = '.2em'
    tagScale.style.left = '0px'
    tagScale.style.top = 'calc(100% + 14px)'
    tagXY.textContent = `x ${Math.round(lns[iMark].offsetLeft + ts[iMark].offsetLeft)} · y ${Math.round(lns[iMark].offsetTop + ts[iMark].offsetTop)}`
    // o círculo à mão abraça só a 1ª palavra ("exatamente")
    const markLts = [...ts[iMark].querySelectorAll('.s6-lt')]
    const sp = markLts.findIndex((el) => el.textContent === ' ')
    const ex = markLts.slice(0, sp > 0 ? sp : markLts.length)
    const exL = ex[0].offsetLeft
    const exR = ex.at(-1).offsetLeft + ex.at(-1).offsetWidth
    const exPad = (exR - exL) * 0.07
    Object.assign(scr.circle.style, { left: `${exL - exPad}px`, width: `${exR - exL + exPad * 2}px` })
    // "2 pessoas + café" colada no canto de cima da foto
    const ours = ts[at('ours')].querySelector('.s6-im')
    Object.assign(tagOurs.style, { left: `${ours.offsetLeft + ours.offsetWidth * 0.55}px`, top: `${ours.offsetTop - 26}px` })
    lns.forEach((_, i) => { if (i !== iGrow) { placeFg(i); drawLine(i) } })
    buildScribble(scr.circle, fsBase[iMark])
    buildScribble(scr.strike, fsBase[iStrike])
    // "vivenciando." é desenhada já no tamanho final (o quad só escala); os rabiscos dela também
    lns[iGrow].style.setProperty('--gs', gsMax)
    drawLine(iGrow)
    placeFg(iGrow)
    buildScribble(scr.under, fsOf(iGrow, gsMax))
    buildScribble(scr.arrow, fsOf(iGrow, gsMax))
    drawn.clear()
    lns[iGrow].style.setProperty('--gs', 1)
    placeFg(iGrow)
    boxes = null
    gl?.resize(vw, vh)
    grid?.resize(vw, vh)
    if (cv) {
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      cv.width = Math.round(window.innerWidth * dpr)
      cv.height = Math.round(window.innerHeight * dpr)
      cv.style.filter = `drop-shadow(0 0 ${(HAND.length * cell * 0.32).toFixed(1)}px rgba(244,243,239,0.4))` // o brilho da mão da seção 5
    }
    view = null
    if (still) renderStill()
  }

  // a escala da régua (10 px, no pé dela) fica no meio da altura das letras,
  // como o traço de CADA – LINHA: topo da régua a partir da caixa do vão
  const rulerTop = (top, h, s) => top + h / 2 + (5 - rulerH) * s
  /** onde a régua assenta no vão, com a câmera do começo (p = 0), em px do editor:
   *  topo-esquerda da régua e a largura */
  function slotIn() {
    if (!vw) return null
    // (chamada a cada quadro pelo pin: as medidas vêm do cache de lineBoxes)
    const b = lineBoxes()
    const x = b.t[0].x + b.slot.x
    const top = b.t[0].y + b.slot.y
    return { x: ax0 + x, y: vh * FOCUS - focusY(0) + rulerTop(top, b.slot.h, 1), w: b.slot.w }
  }
  // a régua chegando (pRaw da chegada): quanto ainda está acima (px) e inclinada (graus)
  const seatOf = (pRaw) => {
    const u = ramp(pRaw, ...ARRIVE.seat)
    return { lift: RULER_SEAT.lift * vh * (1 - settle(u)), tilt: RULER_SEAT.tilt * (1 - easeOut3(u)) }
  }

  // ----- a régua presa ao texto (depois que o deslocamento termina) -----
  function holdRuler({ lift, tilt }) {
    if (!carried) return
    if (!owning) { owning = true; ruler.classList.add('is-s6') }
    const s = view?.s ?? 1
    const r = nested // dentro do editor: a mesma conta, em px dele
      ? nestedRead('slot', () => {
        const sr = slot.getBoundingClientRect()
        const e = edRect()
        const k = edK(e)
        return { left: (sr.left - e.left) / k, top: (sr.top - e.top) / k, height: sr.height / k }
      })
      : slot.getBoundingClientRect()
    // assentando, gira em volta do punho (como na seção 5); depois, só a câmera
    Object.assign(ruler.style, {
      transform: `translate(${r.left}px, ${rulerTop(r.top, r.height, s) - lift}px)${tilt ? ` rotate(${tilt}deg)` : ''} scale(${s})`,
      transformOrigin: tilt ? `${GRAB_AT * 100}% ${GRIP_Y}px` : '0 0',
      width: `${lineBoxes().slot.w}px`,
    })
    rParts.forEach((el) => { el.style.opacity = '0' }) // a régua vem inteira; só o cadeado (e as pontas da fita) já se foram
  }
  function releaseRuler() {
    if (!owning) return
    owning = false
    ruler.classList.remove('is-s6')
    // a seção 5 reescreve posição e opacidades no próximo quadro dela
    rParts.forEach((el) => { el.style.opacity = '' })
  }

  // bola que inverte a cor (cursor de quem visita; = .talk-cursor-dot do footer).
  // A camada do segundo ato não recebe ponteiro: lê da janela.
  let mouse = null
  let inside = false
  let ballA = 0
  let ballOn = false
  let client = null // o ponteiro em px de tela
  // também a cada quadro: aninhado na tela do PC o editor se move com o scroll e
  // sai de baixo de um ponteiro parado
  const placeBall = () => {
    if (!client) return
    const r = edRect()
    const k = edK(r)
    const x = (client[0] - r.left) / k
    const y = (client[1] - r.top) / k
    inside = x >= 0 && y >= 0 && x <= r.width / k && y <= r.height / k
    // fora da tela a bola e a lente que incha o texto ficam no último ponto de dentro
    // e se apagam ali: seguir o ponteiro lá fora fazia a tela "puxar" para o cursor
    if (!inside) return
    mouse = [x, y]
    // dentro de uma caixa escalada a bola mantém o tamanho de tela
    ball.style.transform = `translate3d(${x}px, ${y}px, 0)${k !== 1 ? ` scale(${1 / k})` : ''}`
  }
  const onMove = (e) => {
    if (e.pointerType !== 'mouse') return
    client = [e.clientX, e.clientY]
    edNow = null // fora do quadro: a caixa pode ter andado desde ele
    placeBall()
  }
  const onLeave = () => { inside = false; client = null }
  if (FINE && !still) {
    window.addEventListener('pointermove', onMove, { passive: true })
    document.documentElement.addEventListener('pointerleave', onLeave)
  }
  const setBall = (on) => {
    if (on === ballOn) return
    ballOn = on
    ball.classList.toggle('is-visible', on)
    if (!cursorRoot) return
    if (on) cursorRoot.dataset.cursor = 'hidden'
    else delete cursorRoot.dataset.cursor
  }

  // As medidas das linhas (offset*: sem os transforms), lidas uma vez e
  // reaproveitadas: o update as lia ~10× por quadro, intercaladas com escritas de
  // estilo, e cada leitura forçava um layout do documento inteiro. Valem até o
  // próximo measure() ou até a linha que cresce (--gs) mudar de tamanho
  const lineBoxes = () => {
    if (boxes) return boxes
    const b = {
      t: lns.map((l, i) => ({ x: l.offsetLeft + ts[i].offsetLeft, y: l.offsetTop + ts[i].offsetTop, w: ts[i].offsetWidth, h: ts[i].offsetHeight })),
      typeEnd: typeUnits.map((el) => el.offsetLeft + el.offsetWidth),
      caret: { top: caret.offsetTop, h: caret.offsetHeight },
      slot: { x: slot.offsetLeft, y: slot.offsetTop, w: slot.offsetWidth, h: slot.offsetHeight },
    }
    if (b.t[0].h) boxes = b // fora do layout tudo mede 0: não guarda
    return b
  }
  const tBox = (i) => {
    const b = lineBoxes().t[i]
    return i === iMove ? { x: b.x + moveOff.x, y: b.y + moveOff.y, w: b.w, h: b.h } : b
  }
  const toScene = (x, y) => [view.ax + x * view.s, view.ay + y * view.s]
  const focusY = (i) => { const b = tBox(i); return b.y + b.h / 2 }
  // pontos do trajeto do cursor do editor (frações da caixa de cada linha)
  const caretPt = () => { const b = tBox(iType); const c = lineBoxes().caret; return toScene(b.x + caretLeft + 3, b.y + c.top + c.h * 0.5) }
  const movePt = () => { const b = tBox(iMove); return toScene(b.x + b.w * 0.42, b.y + b.h * 0.55) }
  // um ponto (frações) de um elemento da tela, em px do editor
  const elAt = (el, fx_ = 0.5, fy_ = 0.5) => nestedRead(`a${idOf(el)},${fx_},${fy_}`, () => {
    const r = el.getBoundingClientRect()
    const e = edRect()
    const k = edK(e)
    return [(r.left - e.left + r.width * fx_) / k, (r.top - e.top + r.height * fy_) / k]
  })
  // o descanso: à direita de "trabalho." / "você está", na altura entre as duas
  const restPt = () => {
    const a = tBox(iGrow - 2)
    const b = tBox(iGrow - 1)
    return toScene(Math.max(a.x + a.w, b.x + b.w) + fsBase[iGrow - 1] * 0.35, (a.y + a.h + b.y) / 2)
  }
  // a ponta da caneta: onde o rabisco está sendo desenhado agora (u = o quanto já foi)
  // (o comprimento de cada traço, guardado enquanto o desenho dele não muda)
  const lenOf = new WeakMap()
  const pathLen = (pth) => {
    const d = pth.getAttribute('d')
    const c = lenOf.get(pth)
    if (c && c.d === d) return c.len
    const len = pth.getTotalLength()
    lenOf.set(pth, { d, len })
    return len
  }
  const penAt = (svg, u = drawn.get(svg) ?? 0) => {
    const n = +svg.dataset.n
    const k = Math.min(n - 1, Math.floor(clamp01(u) * n))
    const pth = svg.querySelector(`.p${svg.dataset.pose} [data-k="${k}"]`)
    const pt = pth.getPointAtLength(clamp01(u * n - k) * pathLen(pth))
    // a caixa do rabisco em px do editor (a leitura de layout; o ponto no traço não é)
    const [x0, y0, sc] = nestedRead(`s${idOf(svg)}`, () => {
      const r = svg.getBoundingClientRect()
      const e = edRect()
      const ek = edK(e)
      return [(r.left - e.left) / ek, (r.top - e.top) / ek, r.width / svg.viewBox.baseVal.width / ek]
    })
    return [x0 + pt.x * sc, y0 + pt.y * sc]
  }
  const pen = (svg, u) => () => penAt(svg, u)
  // onde o punho segura a régua assentada no vão (px do editor)
  const gripPt = (lift = 0) => nestedRead(`g${lift}`, () => {
    const r = slot.getBoundingClientRect()
    const e = edRect()
    const s = view?.s ?? 1
    const k = edK(e)
    return [(r.left - e.left + r.width * GRAB_AT) / k, rulerTop((r.top - e.top) / k, r.height / k, s) + GRIP_Y * s - lift]
  })
  // [de, até, origem, destino, cursor, preso]; preso = segue o alvo sem inércia
  // (a linha que arrasta, a ponta do traço, a alça da caixa). Antes de 0, a chegada da régua.
  const PATH = [
    [0, IN[iType], gripPt, caretPt, 'arrow'],
    [IN[iType], P.type[1] + 0.01, caretPt, caretPt, 'text', 1],
    [P.type[1] + 0.01, P.key - 0.02, caretPt, () => elAt(key, 0.42, 0.34), 'arrow'],
    [P.key - 0.02, P.move.show[1], () => elAt(key, 0.42, 0.34), () => elAt(key, 0.42, 0.34), 'arrow', 1],
    [P.move.show[1], P.move.grab, () => elAt(key, 0.42, 0.34), movePt, 'arrow'],
    [P.move.grab, P.move.drop[1] + 0.02, movePt, movePt, 'move', 1],
    [P.move.drop[1] + 0.02, P.circle[0], movePt, pen(scr.circle, 0), 'arrow'],
    [P.circle[0], P.circle[1], pen(scr.circle), pen(scr.circle), 'brush', 1],
    [P.circle[1], P.strike.draw[0], pen(scr.circle, 1), pen(scr.strike, 0), 'arrow'],
    [P.strike.draw[0], P.strike.draw[1], pen(scr.strike), pen(scr.strike), 'brush', 1],
    [P.strike.draw[1], P.grow.box[1], pen(scr.strike, 1), () => elAt(growHandle), 'arrow'],
    [P.grow.box[1], P.grow.drag[1] + 0.01, () => elAt(growHandle), () => elAt(growHandle), 'resize', 1],
    [P.grow.drag[1] + 0.01, P.marker[0], () => elAt(growHandle), pen(scr.under, 0), 'arrow'],
    [P.marker[0], P.marker[1], pen(scr.under), pen(scr.under), 'brush', 1],
    [P.marker[1], P.hand.arrow[0], pen(scr.under, 1), pen(scr.arrow, 0), 'arrow'],
    [P.hand.arrow[0], P.hand.arrow[1], pen(scr.arrow), pen(scr.arrow), 'brush', 1],
    [P.hand.arrow[1], REST, pen(scr.arrow, 1), restPt, 'arrow'],
    [REST, 99, restPt, restPt, 'arrow', 1],
  ]
  const damp = (a, b, tau, dt) => (REDUCE || !dt ? b : lerp(a, b, 1 - Math.exp(-dt / tau)))

  function update(pRaw, { now, v, shift }) {
    edNow = null
    takeShot()
    const dt = lastNow ? Math.min(0.1, (now - lastNow) / 1000) : 0
    lastNow = now
    const live = !REDUCE
    // o roteiro do editor começa depois da chegada da régua
    const p = pRaw - LEAD
    speed = damp(speed, live ? Math.min(1, Math.abs(v) / 40) : 0, 0.18, dt)
    // a grade entra com a troca de seção (a 5 não tem grade): varre em pixels da
    // direita para a esquerda e termina já com a 1ª linha na tela
    const gridIn = ramp(shift, 0.25, 1) * 0.7 + ramp(pRaw, 0, 0.35) * 0.3
    ed.style.setProperty('--grid', easeInOut(ramp(shift, 0.3, 1)))

    // ---- digitação: acompanha o scroll, letra a letra (subir apaga) ----
    const typeU = ramp(p, ...P.type)
    const typed = p < IN[iType] ? 0 : typeAt.filter((t) => t <= typeU * typeAt.at(-1)).length
    const typing = typed > 0 && typed < typeUnits.length
    const typedEnd = typed ? lineBoxes().typeEnd[typed - 1] : 0
    caretLeft = typed ? typedEnd + 2 : 0
    caret.style.left = `${caretLeft}px`
    caret.classList.toggle('on', p >= IN[iType] && p < P.move.show[0])
    caret.classList.toggle('typing', typing) // digitando: cursor de texto fixo; parado: pisca

    // ---- stop-motion: 2 poses em degrau, cada peça na sua fase ----
    const poseAt = (ph) => (REDUCE ? 0 : Math.floor(now / POSE + ph) % 2)
    for (const [el, ph] of POSED) setPose(el, poseAt(ph))

    // ---- estados da história ----
    const k = easeInOut(ramp(p, ...P.move.drop))
    moveOff = { x: MOVE_FROM.x * W * (1 - k), y: MOVE_FROM.y * lineBoxes().t[iMove].h * (1 - k), rot: MOVE_FROM.rot * (1 - k) }
    const mvT = `translate(${moveOff.x}px, ${moveOff.y}px) rotate(${moveOff.rot}deg)`
    ts[iMove].style.transform = mvT
    fgls[iMove].style.transform = mvT
    moveBox.style.opacity = p >= P.move.grab ? 1 - ramp(p, ...P.move.boxOut) : 0
    // encaixou: a guia pisca e o "← 0 px" fica (até no cartaz final)
    snap.style.opacity = k >= 1 ? 1 : 0
    guide.classList.toggle('flash', k >= 1 && p < P.move.boxOut[1])
    const hl = easeInOut(ramp(p, ...P.mark))
    ts[iMark].style.setProperty('--hl', hl)
    tagXY.classList.toggle('on', p >= P.tag)
    drawScribble(scr.circle, easeInOut(ramp(p, ...P.circle)))
    tagOurs.classList.toggle('on', p >= P.ours)
    drawScribble(scr.strike, easeInOut(ramp(p, ...P.strike.draw)))
    const hollow = easeInOut(ramp(p, ...P.strike.hollow))
    ts[iStrike].classList.toggle('is-hollow', hollow > 0.5) // (sem WebGL)
    const gs = lerp(1, gsMax, easeInOut(ramp(p, ...P.grow.drag)))
    if (lns[iGrow].style.getPropertyValue('--gs') !== String(gs)) {
      lns[iGrow].style.setProperty('--gs', gs)
      placeFg(iGrow)
      boxes = null // a linha mudou de tamanho
    }
    drawScribble(scr.under, easeInOut(ramp(p, ...P.marker)))
    drawScribble(scr.arrow, easeInOut(ramp(p, ...P.hand.arrow)))
    tagHand.classList.toggle('on', p >= P.hand.tag)
    const ui = 1 - easeInOut(ramp(p, ...P.outro.ui))
    growBox.style.opacity = ramp(p, ...P.grow.box) * ui
    const scaleTxt = `${data.tags.scale} ${Math.round(gs * 100)}%`
    if (tagScale.textContent !== scaleTxt) tagScale.textContent = scaleTxt // (trocar o nó a cada quadro repinta tudo em volta)
    tagScale.classList.toggle('on', p >= P.grow.drag[0])
    ed.style.setProperty('--ui', ui)

    // ---- cliques (tempo real; subir rearma): a tecla e a pega da linha ----
    let fired = null
    for (const h in HITS) {
      if (p >= HITS[h] && hitT0[h] === null) { hitT0[h] = now; lastHit = fired = h }
      if (p < HITS[h] - 0.02) hitT0[h] = null
    }
    const hitAge = (h) => (hitT0[h] === null || REDUCE ? 99 : (now - hitT0[h]) / 1000)
    // o impacto (= esbarrão no PC da seção 2): afunda, treme e volta
    const jolt = (a, f = 26) => (a < 1.4 ? Math.exp(-a * 6) * Math.sin(a * f + 0.5) : 0)
    const squash = (a, d) => 1 - d * (a < 1 ? Math.exp(-a * 10) : 0)
    // tecla ENTER: a última "letra"; o clique a afunda; parada, o stop-motion
    const ka = hitAge('key')
    key.classList.toggle('on', typed === typeUnits.length)
    const keyS = ka < HIT.pressed ? 'pressed' : poseAt(0.3) ? 'pose2' : 'idle'
    if (key.dataset.s !== keyS) key.dataset.s = keyS
    key.style.transform = `translateX(${jolt(ka, 40) * 3}px) scale(${squash(ka, -0.06)}, ${squash(ka, 0.12)})`

    // ---- câmera (alvo pelo scroll, posição com inércia) ----
    let fy = focusY(0)
    for (let i = 1; i < LINES.length; i++) if (p >= IN[i]) fy = lerp(focusY(i - 1), focusY(i), easeInOut(ramp(p, IN[i], IN[i] + PAN)))
    const lastB = tBox(LINES.length - 1)
    const artH = lastB.y + lastB.h
    const fitS = Math.min(1, (vh * FIT) / artH)
    const fit = easeInOut(ramp(p, ...P.outro.fit))
    const target = {
      s: lerp(1, fitS, fit),
      ax: lerp(ax0, (vw - W * fitS) / 2, fit),
      ay: lerp(vh * FOCUS - fy, (vh - artH * fitS) / 2 + 16, fit),
    }
    view = view ? { s: damp(view.s, target.s, TAU.cam, dt), ax: damp(view.ax, target.ax, TAU.cam, dt), ay: damp(view.ay, target.ay, TAU.cam, dt) } : target
    // a inércia nunca chega exatamente: perto o bastante, encaixa no alvo — senão o
    // transform mudava nas últimas casas a cada quadro, para sempre (repintura do
    // editor e as leituras de posição refeitas sem nada ter se movido)
    camSettled = Math.abs(view.s - target.s) < 1e-4 && Math.abs(view.ax - target.ax) < 0.05 && Math.abs(view.ay - target.ay) < 0.05
    if (camSettled) view = target
    const artT = `translate3d(${view.ax}px, ${view.ay}px, 0) scale(${view.s})`
    art.style.transform = artT
    fg.style.transform = artT
    const vy = dt ? (view.ay - lastAy) / (dt * 60) : 0
    lastAy = view.ay

    // ---- bola ----
    if (nested && (!ballBlocked || ballA > 0.01)) placeBall() // (sem a bola, nada a medir)
    const ballIn = inside && shift > 0.6 && !ballBlocked
    ballA = damp(ballA, ballIn ? 1 : 0, 0.12, dt)
    setBall(ballIn)
    ed.classList.toggle('has-ball', ballIn)

    // ---- cada linha: entrada com inércia + efeitos (WebGL) ----
    const fi = IN.findLastIndex((t) => p >= t)
    for (let i = 0; i < LINES.length; i++) {
      const s = st[i]
      // CADA e LINHA surgem em volta da régua, enquanto ela assenta
      const eT = i === iType ? (typed ? 1 : 0)
        : i === iMove ? ramp(p, ...P.move.show)
          : i === 0 ? ramp(pRaw, ...ARRIVE.line0)
            : ramp(p, IN[i], IN[i] + ENTER)
      s.e = i === iType ? eT : damp(s.e, eT, TAU.line, dt)
      s.foc = damp(s.foc, live && i < fi && fit < 1 ? 1 - fit : 0, TAU.focus, dt)
      const kk = i === iType ? 0 : 1 - easeOut3(clamp01(s.e))

      if (!gl) {
        lns[i].style.opacity = clamp01(s.e * 2)
        continue
      }
      const b = tBox(i)
      const fsl = fsOf(i, gs)
      const L = glLines[i]
      const u = L.u
      const px = PAD.x * fsl
      const py = PAD.y * fsl
      const w = (b.w + px * 2) * view.s
      const h = (b.h + py * 2) * view.s
      const left = view.ax + (b.x - px) * view.s
      const top = view.ay + (b.y - py) * view.s
      L.place(left + w / 2, top + h / 2, w, h, i === iMove ? (moveOff.rot * Math.PI) / 180 : 0)
      L.show(s.e > 0.001)
      const qh = b.h + py * 2
      // a entrada em si é calculada por pixel no shader, a partir de uE
      u.uE.value = s.e
      u.uFx.value = live && i !== iType ? 1 : 0
      u.uType.value = i === iType ? 1 : 0
      u.uStag.value = FX.stagger
      u.uRise.value = (b.h * FX.rise) / qh
      u.uBoxBot.value = (py - 0.2 * fsl) / qh // a máscara fica um pouco abaixo, para não cortar as descendentes
      u.uWave.value = FX.wave
      u.uBlurMax.value = FX.blur
      u.uTrail.value = (b.h * FX.trail) / qh
      u.uRgbMax.value = FX.rgb
      u.uAlpha.value = 1 - s.foc * DEFOCUS.dim
      u.uBend.value = live ? kk * FX.bend + speed * SPEED.bend * kk : 0
      u.uRGB.value = live ? speed * SPEED.rgb * kk : 0 // só na linha que está entrando
      u.uMotion.value = live ? Math.min(30, Math.abs(vy) * SPEED.motion) : 0
      u.uDefocus.value = live ? s.foc * DEFOCUS.blur : 0
      u.uGrain.value = live ? FX.grain : 0
      u.uHollow.value = i === iStrike ? hollow : 0
      // foto: dither na entrada, depois cor em degraus
      if (hasImg[i]) {
        const seen = i === iType ? typed === typeUnits.length : s.e > 0.6
        if (!seen) imgT0[i] = null
        else if (imgT0[i] === null) imgT0[i] = now
        const age = imgT0[i] === null ? 0 : (now - imgT0[i]) / 1000 - DITHER.hold
        u.uImgMode.value = REDUCE ? 1 : Math.floor(clamp01(age / DITHER.dur) * DITHER.steps) / DITHER.steps
      }
      // "exatamente assim.": as letras sob o bloco de papel viram tinta
      u.uInvX.value = i === iMark ? (px + (-0.1 * fsl + hl * (b.w + 0.2 * fsl))) / (b.w + px * 2) : -1
      // "foi escrita": só o que já foi digitado
      u.uRevealX.value = i === iType
        ? (typed === typeUnits.length ? 2 : typed ? (px + typedEnd) / (b.w + px * 2) : -1)
        : 2
      // a bola incha o texto por baixo
      if (mouse && ballA > 0.01 && live) {
        u.uMouse.value.set(mouse[0] - left, top + h - mouse[1], ballA * BALL.strength)
        u.uMouseR.value = BALL.r
      } else u.uMouse.value.z = 0
    }
    // aninhada na tela do PC, sob o filtro da curva do CRT: cada quadro novo daqui
    // obriga o filtro a refazer a tela inteira. Lá só redesenha no degrau da
    // fervura da grade (12,5 qps, o mesmo do grão) ou quando algo de fato muda
    const renderKey = nested ? `${Math.floor(now / 80)}|${pRaw.toFixed(4)}|${ballA.toFixed(2)}|${view.s.toFixed(4)}` : null
    const doRender = !nested || renderKey !== lastRenderKey
    lastRenderKey = renderKey
    if (doRender) gl?.render(now / 1000)

    if (doRender) grid?.render(now / 1000, REDUCE ? 1 : easeInOut(gridIn), ui)

    const arrived = shift >= 1 && pRaw >= 0
    const seat = seatOf(pRaw)

    // ---- cursor do editor (alvo pelo trajeto, posição com inércia) ----
    // (antes da régua: as leituras de layout do trajeto vêm juntas, antes de ela escrever)
    // antes de 0: o punho que trouxe a régua a assenta e vira a seta
    let mode
    let cTarget
    let stuck = false
    if (p < 0) {
      cTarget = gripPt(seat.lift)
      mode = 'grab'
      stuck = true
    } else {
      const seg = PATH.findLast((sg) => p >= sg[0]) ?? PATH[0]
      const a0 = seg[2]()
      const b0 = seg[3]()
      const uu = easeInOut(ramp(p, seg[0], seg[1]))
      cTarget = [lerp(a0[0], b0[0], uu), lerp(a0[1], b0[1], uu)]
      mode = seg[4]
      stuck = !!seg[5]
    }
    curPos = curPos && !stuck ? [damp(curPos[0], cTarget[0], TAU.cur, dt), damp(curPos[1], cTarget[1], TAU.cur, dt)] : cTarget
    if (Math.abs(curPos[0] - cTarget[0]) < 0.05 && Math.abs(curPos[1] - cTarget[1]) < 0.05) curPos = cTarget // (idem: encaixa)

    // ---- a régua: presa ao vão de CADA ___ LINHA depois do deslocamento ----
    if (carried && arrived) holdRuler(seat)
    else releaseRuler()

    // a marca de impacto (riscos vermelhos que se abrem e somem) na ponta do cursor
    if (fired && fired !== 'grab' && live) {
      Object.assign(impact.style, { left: `${cTarget[0]}px`, top: `${cTarget[1]}px` })
      impact.classList.remove('on')
      void impact.offsetWidth // reinicia a animação
      impact.classList.add('on')
    }
    drawCursor(now, pRaw, mode, arrived, ui, { jolt, squash, hitAge })
    if (mode !== toolOn) {
      tools[toolOn]?.classList.remove('on')
      tools[mode]?.classList.add('on')
      toolOn = mode
    }
  }

  // ----- o cursor em dither (camada fixa, px de tela) -----
  let shown = null // forma na tela; a anterior some por limiar de Bayer em MORPH_MS
  let prev = null
  let morphT0 = 0
  let cvDpr = 1
  const clearCv = () => { if (cx) { cx.setTransform(1, 0, 0, 1, 0, 0); cx.clearRect(0, 0, cv.width, cv.height) } }
  // O estado do cursor (px do editor: ponta, forma, troca, clique) é calculado aqui
  // sempre; aninhada na tela do PC, quem o desenha é o PC, com este mesmo estado
  // (cursor(), abaixo) — um cursor só, que não pula de forma nem de lugar na troca
  let curState = null
  function drawCursor(now, pRaw, mode, arrived, ui, { jolt, squash, hitAge }) {
    if (!cx) return
    cvDpr = cv.width / Math.max(1, window.innerWidth)
    clearCv()
    curState = null
    // antes de chegar, o punho ainda é da seção 5 (ela o desenha no deslocamento)
    if (!arrived || (REDUCE && ui < 0.5)) return
    // clique: o cursor recua e gira (a pega da linha, mais leve)
    const ha = lastHit ? hitAge(lastHit) : 99
    const hs = lastHit === 'grab' ? 0.4 : 1
    const cj = jolt(ha) * HIT.bump * hs
    const spin = (jolt(ha, 20) * HIT.spin * hs * Math.PI) / 180
    let from, k
    if (mode === 'grab') {
      // a chegada: o punho assenta a régua e vira a seta direto, por limiar de Bayer
      shown = 'arrow'
      prev = null
      from = 'fist'
      k = REDUCE ? 1.01 : easeInOut(ramp(pRaw, ...ARRIVE.arrow)) * 1.01
    } else {
      // troca de forma (texto, mover, lápis, redimensionar)
      if (mode !== shown) { prev = shown; shown = mode; morphT0 = now }
      from = prev
      k = REDUCE || !prev ? 1.01 : clamp01((now - morphT0) / MORPH_MS) * 1.01
    }
    curState = { x: curPos[0] - cj * 0.4, y: curPos[1] - cj, shape: shown, from, k, spin, sq: squash(ha, 0.2 * hs) }
    if (nested) return
    cx.setTransform(cvDpr, 0, 0, cvDpr, 0, 0)
    const e = edRect()
    const ek = edK(e) // (a camada do cursor é de tela: o editor escalado o encolhe junto)
    const x = e.left + curState.x * ek
    const y = e.top + curState.y * ek
    const hc = cell * curState.sq * ek
    if (from === 'fist') {
      if (k < 1.01) drawSprite(cx, fist, x, y, FIST_C[0], FIST_C[1], hc, (t) => t >= k)
      if (k > 0) { const { art, anchor } = SPR.arrow; drawSprite(cx, art, x, y, anchor[0], anchor[1], hc, (t) => t < k, spin) }
      return
    }
    if (k < 1.01 && from) { const { art, anchor } = SPR[from]; drawSprite(cx, art, x, y, anchor[0], anchor[1], hc, (t) => t >= k, spin) }
    const { art, anchor } = SPR[shown]
    drawSprite(cx, art, x, y, anchor[0], anchor[1], hc, k < 1.01 ? (t) => t < k : null, spin)
  }

  // ----- tempo real: rAF próprio, só com a seção na tela e o scroll já nela -----
  // pos = o que o hook mandou (scroll); a velocidade sai da diferença entre quadros
  // pS = o roteiro de fato (o scroll com o freio de PACE)
  let pos = null
  let pS = null
  let lastFrame = 0
  let paceMax = PACE.max
  // as janelas do roteiro em que o lápis desenha (o freio aperta nelas)
  const BRUSH = [P.circle, P.strike.draw, P.marker, P.hand.arrow]
  let lastPx = null
  let raf = 0
  let onScreen = false
  const frame = (now) => {
    raf = 0
    if (!alive || !pos || !vw) return
    const dt = lastFrame ? Math.min(0.1, (now - lastFrame) / 1000) : 0
    lastFrame = now
    if (pS === null || REDUCE || !dt) pS = pos.p
    else {
      const diff = pos.p - pS
      const q = pS - LEAD
      const drawing = BRUSH.some(([a, b]) => q >= a - 0.03 && q <= b + 0.01)
      const rush = pos.p >= LEAD + LENGTH - 1e-6 && diff > 0
      paceMax += ((rush ? PACE.rush : drawing ? PACE.draw : PACE.max) - paceMax) * (1 - Math.exp(-dt / PACE.shift))
      pS += Math.sign(diff) * Math.min(Math.abs(diff) * (1 - Math.exp(-dt / PACE.tau)), paceMax * dt)
    }
    const px = pS * vh + pos.shift * vw
    const v = lastPx === null ? 0 : px - lastPx
    lastPx = px
    update(pS, { now, v, shift: pos.shift })
    if (onScreen) raf = requestAnimationFrame(frame)
  }
  const wake = () => { if (!raf && onScreen && pos) raf = requestAnimationFrame(frame) }
  const io = still ? null : new IntersectionObserver(([e]) => {
    onScreen = e.isIntersecting
    if (onScreen) wake()
    else { lastPx = null; lastFrame = 0; setBall(false); releaseRuler(); clearCv() } // fora da tela: a régua volta a se esconder com o pin
  })
  io?.observe(ed)
  // parada (empilhada): mede sozinha, na caixa da seção (e de novo com as fontes)
  const ro = still ? new ResizeObserver(() => measure()) : null
  ro?.observe(host)
  if (still) document.fonts.ready.then(() => { if (alive) measure() })

  function renderStill() {
    if (!vw) return
    lastNow = 0
    update(LEAD + LENGTH, { now: performance.now(), v: 0, shift: 1 })
  }

  return {
    /** alturas de tela de scroll depois do deslocamento lateral (a chegada da régua + o roteiro) */
    length: () => LEAD + LENGTH,
    measure,
    slotIn,
    /** compila os shaders do texto e da grade antes da seção entrar (utils/warmup.js) */
    warm: () => Promise.all([gl?.warm(), grid?.warm()]),
    /** o editor passa a ser desenhado dentro de uma caixa escalada (true: a tela do
     *  PC, manifestoPC.js) ou volta à cena (false); a régua presa ao texto vai junto */
    nest(on) {
      if (on === nested) return
      nested = on
      if (on) clearCv() // daqui o PC desenha o cursor: nunca os dois na tela
      if (ruler) (on ? ed : document.body).append(ruler)
      // mudar de lugar no DOM reinicia animações CSS: a marca do último clique não pode bater de novo
      impact.classList.remove('on')
    },
    /** true: sem a bola que deforma o texto (e sem esconder o cursor do site) — dentro
     *  do PC, depois do tranco, a tela já é monitor e a bola pesava sob o CRT */
    ballOff(on) {
      ballBlocked = on
      if (on) { setBall(false); ed.classList.remove('has-ball') }
    },
    /** o cursor do editor agora: ponta em px do editor (com o recuo do clique), forma
     *  (from → shape pela troca k, de 0 a 1,01, por limiar de Bayer; from 'fist' = a
     *  chegada do punho), giro e achatamento do clique, px de tela por pixel do desenho
     *  e raio do brilho (com o editor em escala 1); null sem cursor na tela */
    cursor: () => (curState && vw ? { ...curState, cell, glow: HAND.length * cell * 0.32 } : null),
    /** o scroll do pin: p (alturas de tela a partir do fim do deslocamento) e shift (0→1);
     *  null = antes da seção (para o rAF) */
    /** o roteiro chegou ao fim (o freio de PACE alcançou o fim da seção e a câmera
     *  assentou no enquadramento final, o "cartaz"): o PC só
     *  começa a transição depois disso (useManifestoHorizontal → stepPC) */
    done: () => REDUCE || !onScreen || (pS !== null && pS >= LEAD + LENGTH - 1e-3 && camSettled), // (fora da tela, nada a esperar)
    /** salto (botão de pular o Manifesto): o roteiro vai direto aonde o scroll está,
     *  sem o freio de PACE, e a câmera já no enquadramento dele, sem inércia */
    snap() {
      pS = null
      view = null
      curPos = null
      lastPx = null
    },
    scroll(p, shift) {
      pos = p === null ? null : { p, shift }
      if (!pos) { lastPx = null; pS = null; setBall(false); releaseRuler(); clearCv() }
      wake()
    },
    dispose() {
      alive = false
      if (raf) cancelAnimationFrame(raf)
      io?.disconnect()
      ro?.disconnect()
      window.removeEventListener('pointermove', onMove)
      document.documentElement.removeEventListener('pointerleave', onLeave)
      setBall(false)
      releaseRuler()
      if (nested && ruler) document.body.append(ruler) // (host.innerHTML = '' a levaria junto)
      cv?.remove()
      gl?.dispose()
      grid?.dispose()
      host.innerHTML = ''
    },
  }
}
