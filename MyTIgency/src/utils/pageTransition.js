import { useSyncExternalStore } from 'react'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { decodeAt, decodeDuration, DECODE_TICK_MS } from '../hooks/useAsciiGlitch'
import { hasSkipGo } from './manifestoSkip'
import { warmupsDone } from './warmup'

// ---------- Transição entre páginas (home ⇄ contato) ----------
// Cortina de dither: a página atual é coberta de tinta por uma onda de
// pixels em dither retrô (Bayer, a mesma linguagem da TV do Manifesto) que
// nasce de onde a pessoa clicou; o destino aparece no centro decodificando
// (CONTATO_); a rota troca por baixo da cortina (sem recarregar — ver
// "Roteador"); a página nova só se revela, os pixels clareando a partir do
// centro, quando está pronta de verdade (home: fontes + modelo 3D, o mesmo
// gate do LoadingScreen). A cortina é a tela de carregamento entre páginas.
//
// Referências estudadas no Awwwards: estrutura cobrir → rótulo → revelar
// (Spatzek Studio, Constantinos Haritos); onda de textura (Yuga Labs).

const INK = '#0B0B0C'
const PAGES = {
  '/': { pt: 'home', en: 'home' },
  '/contato': { pt: 'contato', en: 'contact' },
}
const MENU_EXIT_MS = 340 // o menu fecha (framer, 300ms) antes da cortina começar
const COVER_MS = 1500
const LABEL_AT = 0.55 // fração da cobertura em que o rótulo começa a decodificar
const HOLD_MS = 280 // respiro com a página pronta ainda coberta
const REVEAL_MS = 1700
const MAX_WAIT_MS = 8000 // nunca prende ninguém atrás da cortina
const PAUSE_MS = 140
const LABEL_DECODE_DELAY_MS = 400 // após o início da revelação; decode de "contato" ≈ 1.2s < REVEAL_MS

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v)
// Mesma curva da intro (AsciiStage)
const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)
const normalize = (p) => p.replace(/\.html$/, '').replace(/\/index$/, '').replace(/\/+$/, '') || '/'

function langOf() {
  try {
    if (localStorage.getItem('myt-lang') === 'en') return 'en'
  } catch {
    // padrão PT
  }
  return 'pt'
}
const labelFor = (path) => PAGES[path][langOf()]

// ---------- Desenho da cortina ----------
// Dither retrô: dither ordenado Bayer 8×8 — a mesma fórmula do shader da TV
// do Manifesto (tv3d.js) — em 4 tons, a rampa "Cinza" da TV terminando na
// tinta: papel (transparente) → #bcbcbc → #6e6e6e → tinta. Pixels quadrados
// grandes: o canvas tem 1 pixel por célula e é ampliado com
// image-rendering: pixelated (index.css).
const fract = (v) => v - Math.floor(v)
const b2 = (x, y) => fract(Math.floor(x) * 0.5 + Math.floor(y) * Math.floor(y) * 0.75)
const b4 = (x, y) => b2(x * 0.5, y * 0.5) * 0.25 + b2(x, y)
const b8 = (x, y) => b4(x * 0.5, y * 0.5) * 0.25 + b2(x, y)
const rgba = (hex) => {
  const n = parseInt(hex.slice(1), 16)
  return ((255 << 24) | ((n & 0xff) << 16) | (n & 0xff00) | (n >> 16)) >>> 0 // ImageData little-endian: ABGR
}
const DITHER_TONES = [0, rgba('#bcbcbc'), rgba('#6e6e6e'), rgba(INK)]

function ditherPainter(canvas) {
  const ctx = canvas.getContext('2d')
  let px = 4
  let cols = 0
  let rows = 0
  let img = null
  let buf = null
  let bayer = null
  return {
    layout(width, height) {
      px = Math.min(5, Math.max(3, Math.round(width / 360))) // pixel de 3 (celular) a 5px (telas grandes)
      cols = Math.ceil(width / px)
      rows = Math.ceil(height / px)
      canvas.width = cols
      canvas.height = rows
      img = ctx.createImageData(cols, rows)
      buf = new Uint32Array(img.data.buffer)
      bayer = new Float32Array(cols * rows)
      for (let y = 0, k = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++, k++) bayer[k] = b8(x, y)
      }
    },
    paint(f, band, ox, oy, inverse) {
      for (let y = 0, k = 0; y < rows; y++) {
        const dy = (y + 0.5) * px - oy
        for (let x = 0; x < cols; x++, k++) {
          const dx = (x + 0.5) * px - ox
          let c = clamp01((f - Math.sqrt(dx * dx + dy * dy)) / band)
          if (inverse) c = 1 - c
          buf[k] = DITHER_TONES[Math.floor(c * 3 + bayer[k])]
        }
      }
      ctx.putImageData(img, 0, 0)
    },
    clear() {
      ctx.clearRect(0, 0, cols, rows)
    },
    solid() {
      ctx.fillStyle = INK
      ctx.fillRect(0, 0, cols, rows)
    },
  }
}

// ---------- Cortina (canvas + rótulo) ----------
function createOverlay(label) {
  const root = document.createElement('div')
  root.className = 'vt-overlay'
  root.setAttribute('aria-hidden', 'true')
  const canvas = document.createElement('canvas')
  const text = document.createElement('p')
  text.className = 'vt-label'
  text.innerHTML = '<span class="vt-label__text"></span><span class="vt-label__caret">_</span>'
  const textEl = text.firstChild
  textEl.textContent = label
  root.append(canvas, text)
  document.body.appendChild(root)

  const painter = ditherPainter(canvas)
  let w = 0
  let h = 0
  function layout() {
    w = window.innerWidth
    h = window.innerHeight
    painter.layout(w, h)
  }
  layout()

  let isSolid = false
  function solid() {
    isSolid = true
    painter.solid()
  }

  // Onda radial a partir de (ox, oy); inverse = revelar (pixels clareiam)
  function wave(ox, oy, duration, inverse, onProgress) {
    const far = Math.max(Math.hypot(ox, oy), Math.hypot(w - ox, oy), Math.hypot(ox, h - oy), Math.hypot(w - ox, h - oy))
    const band = Math.hypot(w, h) * 0.42 // faixa larga: o degradê de dither fica bastante tempo na tela
    const total = far + band * 1.35
    isSolid = false
    return new Promise((resolve) => {
      const start = performance.now()
      function frame(now) {
        const t = clamp01((now - start) / duration)
        onProgress?.(t)
        if (t >= 1) {
          if (inverse) painter.clear()
          else solid()
          resolve()
          return
        }
        painter.paint(easeInOutCubic(t) * total, band, ox, oy, inverse)
        requestAnimationFrame(frame)
      }
      requestAnimationFrame(frame)
    })
  }

  let decodeTimer = 0
  function decode() {
    clearInterval(decodeTimer)
    const start = performance.now()
    const tick = () => {
      const elapsed = performance.now() - start
      textEl.textContent = decodeAt(label, elapsed)
      if (elapsed >= decodeDuration(label.length)) {
        textEl.textContent = label
        clearInterval(decodeTimer)
      }
    }
    tick()
    decodeTimer = setInterval(tick, DECODE_TICK_MS)
    return wait(decodeDuration(label.length))
  }

  return {
    root,
    solid,
    wave,
    decode,
    showLabel(on) {
      root.classList.toggle('is-labelled', on)
    },
    fade(on, ms) {
      root.style.transition = `opacity ${ms}ms ease`
      root.style.opacity = on ? '1' : '0'
      return wait(ms)
    },
    remove() {
      clearInterval(decodeTimer)
      root.remove()
    },
    relayout() {
      layout()
      if (isSolid) solid()
    },
  }
}

// ---------- Estado compartilhado (header, trava de scroll, cursor) ----------
let covered = false
const listeners = new Set()
function setCovered(value) {
  covered = value
  document.documentElement.classList.toggle('vt-active', value)
  listeners.forEach((fn) => fn())
}
function subscribe(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
/** true enquanto a cortina cobre a página (saindo ou chegando). */
export function usePageCovered() {
  return useSyncExternalStore(subscribe, () => covered, () => false)
}

// Rótulo do header na página que chega: segura o da página anterior enquanto
// a cortina está fechada e libera logo que a revelação começa — o decode
// termina antes da cortina sair (ver LABEL_DECODE_DELAY_MS).
let prevLabelHeld = false
function releasePrevLabel() {
  prevLabelHeld = false
  listeners.forEach((fn) => fn())
}
/** true enquanto o header deve mostrar o rótulo da página anterior. */
export function usePrevLabelHeld() {
  return useSyncExternalStore(subscribe, () => prevLabelHeld, () => false)
}

// ---------- Roteador: navegação sem recarregar ----------
// Como nos sites de referência (Barba.js, Taxi, Nuxt): um documento só. A
// cortina fecha, a rota troca por baixo dela, a página nova avisa que está
// pronta e a cortina abre. Cursor, Lenis e o próprio documento continuam
// vivos — o navegador nunca "esquece" onde o mouse está (com recarga de
// página o Chrome não reaplica cursor:none até o mouse se mexer).
const TITLES = { '/': 'mytigency', '/contato': 'Contato — MyTIgency' }

let route = PAGES[normalize(window.location.pathname)] ? normalize(window.location.pathname) : '/'
let navigated = false
let lenis = null
let prefetchPage = () => {}
let readyResolve = null
let busy = false
let overlay = null

// O scroll volta pro topo por nós (por baixo da cortina), não pelo navegador
if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual'

/** Rota atual ('/' ou '/contato'). */
export function useRoute() {
  return useSyncExternalStore(subscribe, () => route, () => route)
}
/** false só na primeira página aberta (a home usa pra decidir o LoadingScreen). */
export const hasNavigated = () => navigated
/** SmoothScroll registra o Lenis (scroll pro topo/âncora por baixo da cortina). */
export function setPageLenis(instance) {
  lenis = instance
}
/** App registra como baixar o código de uma página (adiantado durante a cortina). */
export function setPagePrefetch(fn) {
  prefetchPage = fn
}
/** A página nova avisa que está pronta (home: useAppReady; contato: fontes). */
export function markPageReady() {
  readyResolve?.()
  readyResolve = null
}

const nextFrame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
function scrollTo(target) {
  if (lenis) lenis.scrollTo(target, { immediate: true, force: true })
  else if (target === 0) window.scrollTo(0, 0)
}
/** rola na hora (px), sem a suavização do Lenis: o salto do botão de pular o Manifesto */
export function scrollNow(y) {
  if (lenis) {
    lenis.resize() // (o Lenis limita o destino à altura que mediu por último: no celular a página ainda crescia)
    lenis.scrollTo(y, { immediate: true, force: true })
  } else window.scrollTo(0, y)
}
/** rola suave (px): "Work" no menu já perto do cartaz (force: o menu do celular trava o Lenis até fechar) */
export function scrollSmooth(y) {
  if (lenis) lenis.scrollTo(y, { force: true })
  else window.scrollTo({ top: y, behavior: 'smooth' })
}
/** sobe suave até o topo (logos, Menu → Home, ainda na Home) */
export function scrollToTop() {
  if (lenis) lenis.scrollTo(0, { force: true })
  else window.scrollTo({ top: 0, behavior: 'smooth' })
}

// Âncora vinda de outra página (/#trabalhos): os pins do GSAP da home ainda
// estão se montando e empurram o layout, então repete até a seção parar no
// topo — tudo ainda por baixo da cortina.
async function scrollToAnchor(hash) {
  if (hash === '#trabalhos' && hasSkipGo()) return // a home já pousou no cartaz do Manifesto (useAppReady)
  const el = document.getElementById(decodeURIComponent(hash.slice(1)))
  if (!el) return
  for (let i = 0; i < 12; i++) {
    scrollTo(el)
    await nextFrame()
    if (Math.abs(el.getBoundingClientRect().top) < 2) return
  }
}

async function go(to, url, { push, ox, oy }) {
  busy = true
  prefetchPage(to)
  if (document.querySelector('.menu-panel')) await wait(MENU_EXIT_MS)

  // 1. Cobre
  overlay = createOverlay(labelFor(to))
  setCovered(true)
  if (reduceMotion) {
    overlay.root.style.opacity = '0'
    overlay.solid()
    overlay.showLabel(true)
    await overlay.fade(true, 200)
  } else {
    let labelStarted = null
    await overlay.wave(ox, oy, COVER_MS, false, (t) => {
      if (!labelStarted && t >= LABEL_AT) {
        overlay.showLabel(true)
        labelStarted = overlay.decode()
      }
    })
    await labelStarted
    await wait(PAUSE_MS)
  }

  // 2. Troca a rota por baixo da cortina
  const ready = new Promise((r) => { readyResolve = r })
  if (push) window.history.pushState({ myt: true }, '', url.pathname + url.search + url.hash)
  scrollTo(0)
  navigated = true
  prevLabelHeld = true
  route = to
  document.title = TITLES[to]
  listeners.forEach((fn) => fn())
  await Promise.race([ready, wait(MAX_WAIT_MS)])
  readyResolve = null
  if (url.hash) await scrollToAnchor(url.hash)

  // 3. Revela
  await wait(HOLD_MS)
  overlay.showLabel(false)
  if (reduceMotion) {
    releasePrevLabel()
    await overlay.fade(false, 250)
  } else {
    await wait(PAUSE_MS)
    setTimeout(releasePrevLabel, LABEL_DECODE_DELAY_MS)
    await overlay.wave(window.innerWidth / 2, window.innerHeight / 2, REVEAL_MS, true)
  }
  overlay.remove()
  overlay = null
  setCovered(false)
  busy = false

  // Voltar/avançar apertado no meio da transição: segue até onde a URL está
  const pending = normalize(window.location.pathname)
  if (PAGES[pending] && pending !== route) {
    go(pending, new URL(window.location.href), { push: false, ox: window.innerWidth / 2, oy: window.innerHeight / 2 })
  }
}

// ---------- Troca de seção na home ----------
// A mesma cortina, sem trocar de rota: cobre, o salto acontece por baixo (work),
// revela. É a transição padrão do site entre seções (Menu, logos, o botão de pular
// o Manifesto); dentro da própria seção, quem chama só rola.
const SECTIONS = {
  top: { pt: 'home', en: 'home' },
  manifesto: { pt: 'manifesto', en: 'manifesto' },
  trabalhos: { pt: 'trabalhos', en: 'work' },
  carreiras: { pt: 'carreiras', en: 'careers' },
}

/** de onde a cortina nasce: o clique, ou o centro do elemento (teclado não tem coordenada) */
export function originOf(e) {
  let { clientX: x, clientY: y } = e
  if (!x && !y) {
    const r = e.currentTarget.getBoundingClientRect()
    x = r.left + r.width / 2
    y = r.top + r.height / 2
  }
  return [x, y]
}

/** as suavizações (scrub) do ScrollTrigger fecham no scroll atual: depois de um
 *  salto, nada da sequência do caminho toca quando a cortina abre */
export function finishScrubs() {
  ScrollTrigger.getAll().forEach((t) => {
    const tw = t.getTween?.()
    if (tw && typeof tw.progress === 'function') tw.progress(1)
  })
}

/** cobre a tela com a cortina de dither, roda work() por baixo e revela.
 *  section: chave de SECTIONS (o rótulo) ou o próprio texto; [x, y]: de onde nasce.
 *  false se outra cortina já estiver no ar. */
export async function curtain(section, [x, y], work, { cover = COVER_MS, reveal = REVEAL_MS, menuExit = true } = {}) {
  if (busy) return false
  busy = true
  if (menuExit && document.querySelector('.menu-panel')) await wait(MENU_EXIT_MS)
  overlay = createOverlay(SECTIONS[section]?.[langOf()] ?? section)
  setCovered(true)
  try {
    let decoding = null
    if (reduceMotion) {
      overlay.root.style.opacity = '0'
      overlay.solid()
      overlay.showLabel(true)
      await overlay.fade(true, 200)
    } else {
      await overlay.wave(x, y, cover, false, (t) => {
        if (!decoding && t >= LABEL_AT) {
          overlay.showLabel(true)
          decoding = overlay.decode()
        }
      })
    }
    await nextFrame() // a cortina inteira na tela antes do salto (ou da remontagem) congelar o quadro
    await work()
    await nextFrame()
    await decoding
    await wait(HOLD_MS)
    overlay.showLabel(false)
    if (reduceMotion) await overlay.fade(false, 250)
    else {
      await wait(PAUSE_MS)
      await overlay.wave(window.innerWidth / 2, window.innerHeight / 2, reveal, true)
    }
  } finally {
    overlay.remove()
    overlay = null
    setCovered(false)
    busy = false
  }
  return true
}

/** vai a uma seção da home pela cortina: 'top' (o topo do documento), 'carreiras'
 *  (o footer, revelado por baixo do painel: o fim do documento) ou o id de uma seção */
export function curtainTo(section, origin) {
  return curtain(section, origin, async () => {
    const doc = document.documentElement
    const el = document.getElementById(section)
    const y = section === 'top' ? 0
      : section === 'carreiras' ? doc.scrollHeight - window.innerHeight
        : el ? el.getBoundingClientRect().top + window.scrollY : 0
    scrollNow(y)
    await nextFrame() // (o ScrollTrigger lê o scroll de um cache por quadro)
    ScrollTrigger.update()
    finishScrubs()
  })
}

// ---------- Troca de idioma (home) ----------
// Os textos do Manifesto vivem em DOM montado fora do React, em canvas e no 3D do
// PC (a palavra, o disquete, os bilhetes): trocar o idioma remonta o Manifesto
// inteiro — ~1 s de tela parada no desktop, segundos num aparelho fraco. A troca
// acontece por baixo de uma versão curta da cortina, que só revela com a página
// assentada (o aquecimento dos shaders novos incluído). No contato a troca é barata
// e segue direta.
const LANG_LABELS = { pt: 'português', en: 'english' }
const LANG_COVER_MS = 600
const LANG_REVEAL_MS = 700
/** troca o idioma por baixo da cortina. apply: aplica na hora (flushSync), para a
 *  remontagem cair inteira com a tela coberta; (x, y): de onde a cortina nasce */
export async function switchLang(lang, apply, x, y) {
  if (busy || route !== '/') { apply(); return }
  await curtain(LANG_LABELS[lang], [x, y], async () => {
    apply()
    await Promise.race([warmupsDone(), wait(MAX_WAIT_MS)])
  }, { cover: LANG_COVER_MS, reveal: LANG_REVEAL_MS, menuExit: false }) // (o menu segue aberto na troca de idioma)
}

document.addEventListener('click', (e) => {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
  const a = e.target.closest?.('a[href]')
  if (!a || (a.target && a.target !== '_self') || a.hasAttribute('download')) return
  const url = new URL(a.href, window.location.href)
  if (url.origin !== window.location.origin) return
  const to = normalize(url.pathname)
  if (!PAGES[to] || to === route) return // outra página do site (créditos) ou âncora na mesma: segue normal
  e.preventDefault()
  if (busy) return
  // Teclado (Enter) não tem coordenada: a onda nasce do próprio link
  let { clientX: x, clientY: y } = e
  if (!x && !y) {
    const r = a.getBoundingClientRect()
    x = r.left + r.width / 2
    y = r.top + r.height / 2
  }
  go(to, url, { push: true, ox: x, oy: y })
}, true)

// Voltar/avançar do navegador: mesma cortina, nascendo do centro
window.addEventListener('popstate', () => {
  const to = normalize(window.location.pathname)
  if (busy || !PAGES[to] || to === route) return
  go(to, new URL(window.location.href), { push: false, ox: window.innerWidth / 2, oy: window.innerHeight / 2 })
})

window.addEventListener('resize', () => overlay?.relayout())
