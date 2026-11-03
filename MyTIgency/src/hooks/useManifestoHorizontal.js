import { useLayoutEffect } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin'
import { LINE_A_EXT, LINE_A_JOIN, LINE_A_LEN } from '../utils/manifestoLineA'
import { introPinDuration, lineAPen } from '../utils/manifestoScroll'
import { mountCursor3D } from '../utils/cursor3d'
import { warpBrush } from '../utils/manifestoBrush'
import { buildSplit } from '../utils/manifestoSplit'
import { mountAct2, PEN_OUT } from '../utils/manifestoAct2'
import { mountS5 } from '../utils/manifestoS5'
import { mountS6 } from '../utils/manifestoS6'
import { mountPC, pcLength, pcCartaz, pcTravelAt } from '../utils/manifestoPC'
import { warmup } from '../utils/warmup'
import { setSkip, setSkipGo, markManifestoSeen } from '../utils/manifestoSkip'
import { scrollNow, scrollSmooth, curtain, finishScrubs } from '../utils/pageTransition'
import { strings } from '../i18n/strings'
import { EDITOR_CELL } from '../utils/ditherSprite'

gsap.registerPlugin(ScrollTrigger, DrawSVGPlugin)

// Desktop/tablet: pin lateral. Mobile (≤700px): seção 3 empilhada, sem pin.
export const DESKTOP_QUERY = '(min-width: 701px)'
const MOBILE_QUERY = '(max-width: 700px)'
// Começa um pouco antes do centro exato: quando o centro do conteúdo ainda
// está esta fração da altura da tela abaixo do meio.
const START_EARLY = 0.06
// Notebook (tela baixa): a faixa fixa do topo (marquee + header) come uma
// fatia maior da altura e o topo do conteúdo ficava embaixo dela durante o
// pin. Só aqui o pin começa mais cedo, para o topo do conteúdo encostar no
// fim do header, como já acontece no desktop.
const NOTEBOOK_QUERY = '(max-height: 900px)'
// = caneta do traço A (useManifestoIntro): com scrubs diferentes, rolando
// rápido o cursor chegava ao traço antes dele (ou o traço passava do cursor).
const SCRUB = 1.2

// Seção 3: uma tela (100vw) logo depois da caixa de busca; depois que ela
// centra, HOLD_VH de scroll parado para as palavras, a seleção e a pílula.
const S3_GAP_VW = 0.06
const HOLD_VH = 1.1
// Fração do scroll parado em que todos os efeitos da seção 3 já terminaram;
// de S3_DONE a 1 fica o espaço da transição (máscara) para o próximo texto.
const S3_DONE = 0.72
// Segundo ato (utils/manifestoAct2.js), no mesmo pin, depois da seção 3:
// um respiro (ACT2_GAP_VH), a cortina #141414 (CURTAIN_VH) e a cena A
// (SCENE_A_VH; a frase entra quando a cortina está em TEXT_AT). Em alturas de tela.
const ACT2_GAP_VH = 0.1
const CURTAIN_VH = 1.3 // caneta → tinta enche → toma a tela
const SCENE_A_VH = 1.8
const TEXT_AT = 0.85
// Depois da cena A, a faixa ondulada: o scroll desliza a cena para a seção 5
// (1 px de scroll = 1 px lateral, como a trilha). Daí em diante a seção 5
// (utils/manifestoS5.js) dita quanto scroll precisa; sem ela, SCENE_B_VH parado.
const SCENE_B_VH = 0.6
// Depois da seção 5, a seção 6 (utils/manifestoS6.js, o editor) entra de lado,
// uma tela à direita (1 px de scroll = 1 px lateral, a seção 5 sai junto com a
// régua e a faixa) e então dita quanto scroll precisa.
// Quanto o cursor 3D e a régua apagam no meio da cortina (0 = nada, 1 = somem)
const ACT2_DIP = 0.65
// Cursor sai da frente da frase: começa quando a caneta da cortina evapora
// (PEN_OUT) e termina AWAY_END da cena A. Desliza num arco suave (mesma sineIO
// do trajeto 2→3), encolhe e gira até apontar para a direita (AWAY_DIR rad,
// y para cima: as próximas cenas seguem por ali), ao lado do olho:
// tamanho = altura do olho × AWAY_SIZE; ponta a AWAY_GAP (vw) + o corpo
// (AWAY_SIZE × AWAY_REACH) depois da borda direita do olho.
const AWAY_END = 0.2
const AWAY_DIR = 0.22
const AWAY_SIZE = 0.75
const AWAY_GAP = 0.015
const AWAY_REACH = 1.05
const AWAY_ARC = 0.04// quanto o arco sobe (alturas de tela)
// Cursor (o da busca vira o cursor 3D): sai da busca a GO_AT do percurso
// lateral e chega a DRAW_END_HOLD do scroll parado. Antes de soltar dá um
// "clique" (PRESS). Pega o traço A num ponto à direita da busca
// (PICK_AFTER_VW) — assim ele só anda para frente.
const GO_AT = 0.16
const DRAW_END_HOLD = 0.35
const PRESS = 0.05
const PICK_AFTER_VW = 0.16
// Ponta do cursor na busca: logo depois da lupa, na borda de baixo da caixa
// (frações do texto/caixa); tamanho = altura da caixa × SIZE_IN_SEARCH.
const START = { textX: 0.04, boxY: 0.86 }
const SIZE_IN_SEARCH = 1.6
// O pincel do trecho novo (arte do traço A deformada) engrossa até 125% no fim.
const BRUSH_GAIN = 1.25
// Boot de CRT do PC (tv3d.setBoot), com o scroll. As etapas antes do logo
// (cursor de espera → CRT → terminal com barra até 100%) começam BOOT_LEAD
// (alturas de tela) ANTES do pin lateral e vão até o esbarrão do cursor no
// monitor; logo depois do tranco (HIT_GLITCH do percurso lateral) a tela
// corta do terminal para o logo já em construção (LOGO_CUT) e o
// logo abre a partir do toque, com a mesma duração de antes: (1 − LOGO_FROM)
// do trecho PRESS + BOOT_SPAN.
const BOOT_SPAN = 0.42
const BOOT_LEAD = 0.15
const LOGO_FROM = 0.4
const HIT_GLITCH = 0.015
// Onde o logo já está quando a tela volta do tapa (entrada da varredura,
// antes da curva suave do tv3d: 0.47 ≈ o terço de cima do logo à mostra) —
// "tapa para dar sinal": nada de tela preta depois do chiado.
const LOGO_CUT = 0.47
// Giro da TV (rad, somado aos 0.6 do 3/4 de repouso do tv3d: −0.6 = de
// frente, menor = esquerda): UM giro contínuo, da ESQUERDA (início do pin)
// à DIREITA (TURN_END do percurso lateral), passando pela frente no
// esbarrão — sem pausa parada de frente; o esbarrão só o interrompe (mola).
const TURN_FRONT = -0.6
const TURN_LEFT = 0.75
const TURN_RIGHT = 0.75
const TURN_END = 0.85
// Esbarrão: o cursor encosta na borda direita real do monitor (raycast, numa
// linha a EDGE_Y da altura do PC) e recua BUMP_PX no impacto.
const EDGE_Y = 0.3
const BUMP_PX = 22
// Janela (px de caminho, para cada lado do toque planejado) em que o
// esbarrão espera a ponta encostar de verdade na malha do PC.
const HIT_WIN = 70
// Até HOLD_NEAR do percurso lateral do toque, a pose do PC perde a massa
// (giro atrasado pela mola, inclinação pela velocidade) e chega ao toque
// exatamente como foi medida — senão a ponta passa pela borda no ar e só
// encosta mais embaixo. O tranco do esbarrão continua (tv3d.setHold).
const HOLD_NEAR = 0.12
const sineIO = (t) => (1 - Math.cos(Math.PI * t)) / 2
const sineIOinv = (v) => Math.acos(1 - 2 * v) / Math.PI
const smooth = (t) => t * t * (3 - 2 * t)
const clamp01 = (v) => Math.min(1, Math.max(0, v))
const ramp = (p, a, b) => clamp01((p - a) / (b - a))
const TAU = Math.PI * 2
// Bézier cúbica: curve(início, c1, c2, fim, c1, c2, fim, ...) em px.
const curve = (a, ...r) => `M${a}` + r.map((p, i) => (i % 3 ? ' ' : 'C') + p).join('')

// Scroll lateral do Manifesto: quando o conteúdo da seção 2 chega ao centro da
// tela, o bloco inteiro fixa (pin) e o scroll vertical passa a mover a trilha
// para a esquerda até a seção 3 ficar centrada; depois, HOLD_VH de scroll
// parado. Fixa o bloco todo (não só a seção 2) porque o traço A emenda as
// seções. O cursor da busca (set:mytigency.com) vira o cursor 3D: na seção 2
// é um cursor de interface; no pin ele "clica e solta" e percorre UM caminho
// só (velocidade constante, uma easing no trajeto inteiro): desce até a ponta
// do traço A, pega-a e, como caneta, desenha o resto do traço (a mesma arte,
// deformada) até o vão entre as palavras da seção 3, onde assenta em 3/4.

// o salto do botão de pular: depois do scroll, finishScrubs (pageTransition) fecha as
// suavizações no destino, para nada da sequência tocar quando a cortina abre
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
export function useManifestoHorizontal(rootRef, lang) {
  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return undefined
    const q = (sel) => root.querySelector(sel)
    const track = q('.ms-track')
    const ms2 = q('.ms2')
    const groups = root.querySelectorAll('.s2-group')
    const lineLow = q('.s2-line-a')
    const guides = root.querySelectorAll('.la-guide')
    const s3 = q('.s3')
    const s3vis = q('.s3-vis')
    const act2El = q('.ms-act2')
    const tvCanvas = q('.s2-tv')
    const search = q('.s2-search') // useManifestoS2Enter anima o x dele (entrada)
    const searchBox = q('.s2-search-box')
    const searchText = q('.s2-search-text')
    const searchCursor = q('.s2-search-cursor')
    if (!track || !ms2 || !groups.length || !lineLow || !s3 || !s3vis || !search || !searchBox || !searchText || !searchCursor) return undefined
    const who = JSON.parse(s3vis.dataset.who)
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    // Posição no documento pela cadeia de offsetTop: é layout puro, imune ao
    // transform da transição Hero→Marquee (.reveal-panel), que no topo da
    // página desloca tudo e faria getBoundingClientRect errar o início.
    const docTop = (el) => {
      let y = 0
      for (let n = el; n; n = n.offsetParent) y += n.offsetTop
      return y
    }
    // Caixa de um elemento em coordenadas da trilha/bloco (sem transforms).
    const boxIn = (el) => {
      let x = 0
      let y = 0
      for (let n = el; n && n !== root; n = n.offsetParent) { x += n.offsetLeft; y += n.offsetTop }
      return { x, y, w: el.offsetWidth, h: el.offsetHeight }
    }
    // Faixa fixa do topo durante o Manifesto: marquee acoplado + header.
    const chromeBottom = () => {
      const header = document.querySelector('header')
      const marqueeH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--marquee-h')) || 0
      return marqueeH + (header?.offsetHeight ?? 0)
    }
    const isNotebook = () => window.matchMedia(NOTEBOOK_QUERY).matches
    // Em layout (sem pins). O pin de entrada da seção 1 (useManifestoIntro)
    // vem antes e segura o bloco por introPinDuration() de scroll.
    const startY = () => {
      let top = Infinity
      let bottom = -Infinity
      groups.forEach((g) => {
        top = Math.min(top, g.offsetTop)
        bottom = Math.max(bottom, g.offsetTop + g.offsetHeight)
      })
      top += docTop(ms2)
      bottom += docTop(ms2)
      const y = (top + bottom) / 2 - window.innerHeight * (0.5 + START_EARLY)
      return isNotebook() ? y - Math.max(0, chromeBottom() - (top - y)) : y
    }
    const pinAt = () => startY() + introPinDuration()
    // ponta do cursor na busca (caixas em px)
    const startIn = (box, text) => [text.x + text.w * START.textX, box.y + box.h * START.boxY]

    // Seção 3: o DOM é montado quando as fontes chegam (o corpo das palavras é
    // medido); cada modo (desktop/mobile) só reajusta e anima.
    let cancelled = false
    let split = null
    const ready = Promise.all([
      document.fonts.load('400 100px Anton'),
      document.fonts.load('500 16px "JetBrains Mono"'),
    ]).catch(() => {}).then(() => {
      if (!cancelled) split = buildSplit(s3vis, who)
      return split
    })
    // o cursor (e a seção 3) só montam quando a seção 2 chega perto
    let near = false
    const nearWaiters = []
    const io = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) goNear() }, { rootMargin: '100% 0px' })
    io.observe(ms2)
    // (também chamado pelo pin: quem chega já dentro dele — salto, âncora, remontagem
    // pela troca de idioma — não vê a seção 2 entrar, ela está deslocada de lado)
    function goNear() {
      if (near) return
      near = true
      io.disconnect()
      nearWaiters.splice(0).forEach((fn) => warmup(fn()))
    }
    // (como aquecimento: a cortina da troca de idioma espera o cursor montar e remedir)
    const whenNear = (fn) => (near ? warmup(fn()) : nearWaiters.push(fn))

    const mm = gsap.matchMedia()

    /* ------------------------------ desktop ------------------------------ */
    mm.add(DESKTOP_QUERY, () => {
      let alive = true
      let st = null
      let cur = null
      let canvas = null
      // medidas em coordenadas da trilha (offset*, imunes ao transform dela)
      let travelA = 0
      let scrollB = 0
      let vw = 1
      let vh = 1
      let s3Left = 0
      let s3Top = 0
      let rootDoc = 0
      let dGo = 0
      let dEnd = 0
      let act2At = 0 // px no pin em que a cortina começa
      let pinLen = 1 // pin inteiro: trilha + seção 3 + segundo ato
      let rulerW = 0 // largura da régua (0 = medir de novo)
      let sceneAEnd = 0 // px no pin em que a cena A termina (e a faixa começa)
      let shiftLen = 0 // deslocamento lateral até a seção 5 (px)
      let s6At = 0 // px no pin em que a seção 6 começa a entrar de lado
      let pcAt = 0 // px no pin em que a seção 6 termina e o PC (cartaz → tela → mesa → folha) começa
      let J = [0, 0] // onde o cursor pega o traço A
      let Jdir = [1, 0]
      let pickS = 0 // comprimento da extensão do traço A até J (unid. do SVG)
      let artScale = 1 // px por unidade do SVG do traço A
      let T = [0, 0] // ponta na busca
      let F = [0, 0] // ponta final, no vão da seção 3
      let sF = 200 // tamanho final do cursor
      let s0 = 40 // tamanho na busca
      let L = 1 // comprimento do caminho inteiro
      let L1 = 1 // ... até J
      let ext = null
      let sHit = -1 // fração do caminho em que a ponta encosta no monitor
      let prevS = -1
      let bumpAt = -1e9
      let bumpDir = 1
      let hitN = [1, 0] // direção do cursor no toque
      let dHit = -1 // scroll (px no pin) em que a ponta encosta no monitor
      let tvBox = { x: 0, y: 0 } // canvas da TV em coordenadas da trilha
      let hitD = -1 // scroll (px no pin) do último contato real, vindo de frente
      let hitArm = null // lado (−1 antes / 1 depois) de onde o cursor vem para a janela do toque; 0 = já esbarrou
      let away = null // ponta ao lado do olho (coordenadas do bloco); null = sem olho
      let sAway = 100 // tamanho do cursor ao lado do olho
      let dAway0 = 0 // scroll (px no pin) em que o cursor sai da frente da frase...
      let dAway1 = 1 // ... e em que assenta ao lado do olho

      // traço novo: arte do traço A deformada, revelada por uma máscara de
      // caneta (como a do site); motion/seg1 são só geometria
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
      svg.setAttribute('class', 's3-ext')
      svg.setAttribute('aria-hidden', 'true')
      Object.assign(svg.style, { position: 'absolute', left: 0, top: 0, width: '1px', height: '1px', overflow: 'visible', zIndex: 1, pointerEvents: 'none' })
      // ponta reta (butt) na máscara: a redonda avançava meia espessura além
      // da cabeça e o traço aparecia na frente da ponta do cursor
      svg.innerHTML = '<defs><mask id="s3-brush-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="0" height="0">'
        + '<path fill="none" stroke="#fff" stroke-linecap="butt" stroke-linejoin="round"/></mask></defs>'
        + '<path fill="#FF4438" mask="url(#s3-brush-mask)"/><path fill="none"/><path fill="none"/>'
      track.append(svg)
      // marca de impacto do esbarrão: riscos vermelhos curtos que se abrem e somem
      const impact = document.createElement('div')
      impact.className = 'ms-impact'
      impact.setAttribute('aria-hidden', 'true')
      impact.innerHTML = '<svg viewBox="-50 -50 100 100">'
        + [0, 45, 90, 135, 180, 225, 270, 315].map((a) => `<line x1="0" y1="-16" x2="0" y2="-34" transform="rotate(${a})"/>`).join('') + '</svg>'
      track.append(impact)
      // Régua do trajeto: fixa no rodapé enquanto o pin lateral está ativo.
      // Escala milimetrada (1% / 10%), as três paradas do cursor (sai da busca,
      // pega o traço, chega) e o cabeçote com um cursor e a leitura em %.
      // O trecho vermelho é o caminho do cursor, preenchido conforme ele anda.
      const ruler = document.createElement('div')
      ruler.className = 'ms-ruler'
      ruler.setAttribute('aria-hidden', 'true')
      ruler.innerHTML = '<div class="ms-ruler-scale"></div><div class="ms-ruler-path"><i></i></div>'
        + who.ruler.map((t, i) => `<span class="ms-ruler-stop"><b>0${i + 1}</b> ${t}</span>`).join('')
        + '<div class="ms-ruler-head"><span>000%</span><svg viewBox="0 0 12 14"><path d="M1 1v11l3-3 2.4 4.4 1.8-1-2.4-4.3H10Z"/></svg></div>'
      document.body.append(ruler)
      // a largura dela muda no resize e quando a seção 6 a segura (holdRuler): remede
      const rulerRO = new ResizeObserver(() => { rulerW = 0 })
      rulerRO.observe(ruler)
      // grão do segundo ato: fixo, acima de tudo menos header/marquee (App.css → .ms-grain)
      const grain = document.createElement('div')
      grain.className = 'ms-grain'
      grain.setAttribute('aria-hidden', 'true')
      document.body.append(grain)
      const rStops = [...ruler.querySelectorAll('.ms-ruler-stop')]
      const rPath = ruler.querySelector('.ms-ruler-path'), rFill = rPath.firstChild
      const rHead = ruler.querySelector('.ms-ruler-head'), rVal = rHead.firstChild
      let rFracs = [0, 0.5, 1]
      // seção 5: assume a régua do rodapé e o cursor 3D depois que a faixa começa.
      // Monta ANTES do segundo ato: a faixa mede pela linha da seção 5 (.s5-row).
      const s5El = act2El?.querySelector('.s5')
      const s5 = s5El ? mountS5(s5El, { ruler }) : null
      const act2 = act2El && mountAct2(act2El, { behind: s3, ribbon: true }) // a seção 3 recua sob a tinta
      const s6Scene = act2El?.querySelector('.ma-c')
      const s6El = s5 && s6Scene?.querySelector('.s6')
      const s6 = s6El ? mountS6(s6El, { ruler }) : null
      if (s6) warmup(s6.warm())
      // fim: o PC (utils/manifestoPC.js), depois da seção 6. Pesado (2 WebGL, mesa
      // 3D, texturas em canvas): monta e aquece já, sob a tela de carregamento
      // (utils/warmup.js) — montado no scroll, travava a entrada da cena por segundos
      const pcHost = s6 ? act2El.querySelector('.ma-pc') : null
      let pc = null
      let pcLamp = 0 // a lâmpada da sala: acesa, o grão e o header escuro saem
      let curtainNow = 0
      const chrome = () => {
        const g = ramp(proxy.d, act2At + vh * CURTAIN_VH * 0.28, act2At + vh * CURTAIN_VH) * (1 - pcLamp)
        grain.style.setProperty('--grain', g)
        grain.classList.toggle('on', g > 0) // apagado, o grão para de piscar (App.css)
        document.documentElement.classList.toggle('ms-dark', curtainNow > 0.55 && pcLamp < 0.5) // header claro sobre o escuro
      }
      const mountPCNow = () => {
        if (pc || !alive) return
        pc = mountPC(pcHost, {
          reduce: reduced, onLamp: (v) => { pcLamp = v; chrome() }, cursorFrom: s6.cursor,
          onImpact: (v) => s6.ballOff(v), t: strings[lang]?.pc ?? strings.pt.pc,
        })
        pc.measure({ vw, vh, top: chromeBottom() })
      }
      // A transição do PC só começa quando a seção 6 termina o roteiro: rolando rápido,
      // o freio dela (PACE) ainda tocava o fim (o texto indo para o cartaz) quando
      // o scroll já entrava no PC, e os dois efeitos se somavam. Até lá o PC fica no
      // início (o cartaz parado, idêntico ao fim da 6); depois alcança o scroll rápido,
      // sem salto (PC_CATCH alturas de tela/s). Voltando, segue o scroll na hora; chegando
      // de uma vez com a 6 já pronta (âncora, salto), também. Teto: PC_HOLD_MAX ms
      const PC_CATCH = 2
      const PC_HOLD_MAX = 10000
      let pcTarget = null // alturas de tela desde o fim da 6, pelo scroll (null = antes do PC)
      let pcShown = null // o que o PC mostra
      let pcLast = 0
      let pcHeld = 0 // desde quando a 6 segura o PC
      let pcJump = false // o salto do botão de pular: vai direto, sem esperar a 6 nem alcançar
      let jumping = false // o portal do botão de pular no ar
      let skipSt = null // a faixa em que o botão de pular aparece (criada depois do pin)
      let skipActive = false
      function stepPC(now) {
        if (!pc) return
        const dt = now && pcLast ? Math.min(0.1, (now - pcLast) / 1000) : 0
        if (now) pcLast = now
        let next
        if (pcTarget === null) { next = null; pcHeld = 0 }
        else if (pcJump) next = pcTarget // (vale o salto inteiro: o pin passa por posições no meio antes de fechar no destino)
        else if (!s6.done() && (!pcHeld || performance.now() - pcHeld < PC_HOLD_MAX)) {
          pcHeld ||= performance.now()
          next = Math.min(pcTarget, pcShown ?? 0) // segurar = não avançar (nunca puxa de volta: o salto já pode ter posto o PC no cartaz)
        } else if (pcShown === null || pcTarget <= pcShown) next = pcTarget
        else next = dt ? Math.min(pcTarget, pcShown + PC_CATCH * dt) : pcShown
        if (next !== pcShown) { pcShown = next; pc.scroll(next); syncSkip() }
      }

      const tickPC = () => stepPC(performance.now())

      // ---------- pular o Manifesto (utils/manifestoSkip.js) ----------
      // o botão aparece com a seção 1 e sai quando a câmera inclina para a folha;
      // até a cena A ele pula para o cartaz, da seção 5 em diante volta ao início
      function syncSkip() {
        const past = pcShown !== null && pcShown > pcTravelAt(reduced)
        const atCartaz = pcShown !== null && pcShown >= pcCartaz(reduced) - 0.01
        // (cartaz só dentro do pin: depois dele a seção ativa do header assume)
        setSkip({ visible: skipActive && !past && !jumping, mode: proxy.d >= sceneAEnd ? 'back' : 'skip', cartaz: atCartaz && skipActive })
        if (atCartaz) markManifestoSeen()
      }
      // o destino do salto (botão, menu, âncora): a tela já formada, com a barra em
      // 99% (pcCartaz); dali o scroll segue normal
      const cartazY = () => st.start + pcAt + vh * pcCartaz(reduced)
      // O salto: o scroll vai de uma vez ao destino e todas as suavizações (scrub)
      // fecham nele — nada da sequência anterior toca; a seção 6 vai direto ao ponto
      // do roteiro em que o scroll está.
      async function land(toCartaz) {
        const y = toCartaz ? cartazY() : Math.max(0, docTop(q('#manifesto')) - chromeBottom())
        if (toCartaz) { s6?.snap(); pcJump = true }
        scrollNow(y)
        // o ScrollTrigger lê o scroll de um cache por quadro: só no quadro seguinte
        // ele vê a posição nova (e as suavizações fecham no lugar certo)
        await nextFrame()
        ScrollTrigger.update()
        finishScrubs()
        stepPC(0)
        pcJump = false
      }
      async function go(mode, origin) {
        if (jumping || !st) return false
        if (mode === 'arrive') { // (coberto pela tela de carregamento ou pela cortina: sem portal)
          jumping = true
          try { ScrollTrigger.refresh(); await land(true) } finally { jumping = false; syncSkip() }
          return true
        }
        if (mode === 'work') {
          // sem cortina: da seção 6 em diante (o PC, a folha) só rola até o cartaz
          if (st.scroll() >= st.start + s6At) { scrollSmooth(cartazY()); return true }
          mode = 'skip'
        }
        jumping = true
        syncSkip()
        const toCartaz = mode !== 'back'
        try {
          // a cortina de dither, a transição padrão entre seções (utils/pageTransition.js)
          await curtain(toCartaz ? 'trabalhos' : 'manifesto', origin, async () => {
            await land(toCartaz)
            history.replaceState(history.state, '', `${location.pathname}${location.search}${toCartaz ? '#trabalhos' : ''}`)
          })
        } finally {
          jumping = false
          syncSkip()
        }
        const focusEl = toCartaz ? document.getElementById('pc-cartaz') : q('#manifesto')
        if (focusEl) { if (!focusEl.hasAttribute('tabindex')) focusEl.setAttribute('tabindex', '-1'); focusEl.focus({ preventScroll: true }) }
        return true
      }
      setSkipGo(go)
      // o cartaz do PC é a seção 6 viva: o mesmo nó vai para dentro da tela (e
      // volta), então nada para na troca — stop-motion, régua e bola continuam
      let s6InPC = false
      const nestS6 = (on) => {
        if (on === s6InPC) return
        s6InPC = on
        ;(on ? pc.poster : s6Scene).append(s6El)
        s6.nest(on)
      }
      // o deslocamento 5 → 6 (d em px do pin): o punho da seção 5 leva a régua até o
      // vão da 6 (slot, px de tela); handed = chegou, a régua e o cursor são da 6
      const carryAt = (d, layerTop) => {
        if (!s6) return null
        const slide = Math.min(vw, Math.max(0, d - s6At))
        const b = slide > 0 ? s6.slotIn() : null
        return { k: slide / vw, handed: d >= s6At + vw, slot: b && { x: b.x + vw - slide, y: b.y + layerTop, w: b.w } }
      }
      const maskEl = svg.querySelector('mask')
      const extPath = maskEl.firstChild
      const [, brushArt, motion, seg1] = svg.children
      // drawSVG manual: dasharray = comprimento; set(t) revela até t
      const stroke = (path, d) => {
        path.setAttribute('d', d)
        const len = path.getTotalLength()
        path.style.strokeDasharray = `${len}`
        return { set: (t) => { path.style.strokeDashoffset = `${len * (1 - t)}` } }
      }

      function layout() {
        vh = window.innerHeight
        vw = window.innerWidth
        rulerW = 0
        const sb = boxIn(searchBox)
        s3Left = sb.x + sb.w + vw * S3_GAP_VW
        s3Top = startY() - docTop(root)
        rootDoc = docTop(root)
        root.style.setProperty('--s3-left', `${s3Left}px`)
        root.style.setProperty('--s3-top', `${s3Top}px`)
        // a pílula fica abaixo da faixa fixa do topo
        root.style.setProperty('--s3-chrome', `${Math.max(0, chromeBottom() - (docTop(root) + s3Top - startY()))}px`)
        travelA = s3Left
        scrollB = vh * HOLD_VH
        dGo = travelA * GO_AT
        dEnd = travelA + scrollB * DRAW_END_HOLD
        act2At = travelA + scrollB * S3_DONE + vh * ACT2_GAP_VH
        sceneAEnd = act2At + vh * (CURTAIN_VH + SCENE_A_VH)
        shiftLen = act2?.shiftLength() ?? 0
        pinLen = sceneAEnd + (shiftLen ? shiftLen + (s5 ? s5.length(vh) : vh * SCENE_B_VH) : 0)
        s6At = pinLen
        if (s6 && shiftLen) pinLen += vw + vh * s6.length()
        pcAt = pinLen
        if (pcHost && shiftLen) pinLen += vh * pcLength(reduced)
        root.classList.toggle('has-pc', pinLen > pcAt)
        dAway0 = act2At + vh * CURTAIN_VH * PEN_OUT[0]
        dAway1 = act2At + vh * (CURTAIN_VH + SCENE_A_VH * AWAY_END)
        // olho da cena A, já no lugar final (offset* ignora a subida das linhas)
        const eye = act2El?.querySelector('.ma-eye')
        if (eye?.offsetHeight) {
          const b = boxIn(eye)
          sAway = b.h * AWAY_SIZE
          away = [Math.min(b.x + b.w + vw * AWAY_GAP + sAway * AWAY_REACH, vw * 0.97), b.y + b.h / 2]
        }
        // ponto da extensão do traço A a PICK_AFTER_VW à direita da busca
        const line = boxIn(lineLow) // SVG 2135×1216
        const sx = line.w / 2135
        const sy = line.h / 1216
        const at = ([u, v]) => [line.x + u * sx, line.y + v * sy]
        T = startIn(boxIn(searchBox), boxIn(searchText))
        const pickX = T[0] + vw * PICK_AFTER_VW
        const pts = [LINE_A_JOIN, ...LINE_A_EXT]
        let lenAll = 0
        let lenTo = -1
        for (let i = 1; i < pts.length; i++) {
          const seg = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])
          const a = at(pts[i - 1])
          const b = at(pts[i])
          if (lenTo < 0 && b[0] >= pickX) {
            const f = clamp01((pickX - a[0]) / (b[0] - a[0]))
            J = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]
            const n = Math.hypot(b[0] - a[0], b[1] - a[1])
            Jdir = [(b[0] - a[0]) / n, (b[1] - a[1]) / n]
            lenTo = lenAll + seg * f
          }
          lenAll += seg
        }
        if (lenTo < 0) { lenTo = lenAll; J = at(pts[pts.length - 1]) }
        pickS = lenTo
        artScale = sx
        // a máscara do traço A usa pincel redondo de 40 unid.: a ponta dele vai
        // 20 além do fim do drawSVG — termina 20 antes para a arte parar em J
        lineAPen.frac = (LINE_A_LEN + lenTo - 20) / (LINE_A_LEN + lenAll)
        if (reduced) gsap.set(guides, { drawSVG: `${lineAPen.frac * 100}%` })
        root.style.setProperty('--ms-travel', `${travelA}px`)
        buildPath()
        s5?.measure({ vw, vh, shift: shiftLen, sceneEndX: act2.sceneEndX(), size: away ? sAway : vh * 0.08, fracs: rFracs })
        s6?.measure({ vw, vh, dockW: s5.dockWidth(), cell: s5.handCell() * EDITOR_CELL })
        pc?.measure({ vw, vh, top: chromeBottom() })
      }

      // caminho do cursor + traço novo (precisa da seção 3 montada para o vão)
      function buildPath() {
        if (!split) { lineAPen.end = pinAt() + travelA * 0.4; return }
        split.refit(Math.round(vw * 0.2))
        const gap = split.gap()
        sF = Math.min(gap.w * 0.78, vh * 0.3)
        // corpo do cursor centrado no vão (antes do modelo carregar, aproximado)
        const [bx, by] = cur?.body(sF) ?? [sF * 0.33, sF * 0.45]
        F = [s3Left + gap.x + gap.w / 2 - bx, s3Top + vh / 2 - by]
        // 1) da busca desce para a frente até J, chegando na direção do traço;
        // 2) segue na mesma direção e sobe reto pelo vão (tangente contínua em J)
        // Esbarrão de verdade: G = borda direita REAL do monitor (raycast na
        // malha), medida com o giro que a TV terá no instante do toque. O
        // trecho 1 passa por G: a ponta encosta no monitor ali.
        const findEdge = (turn) => {
          const tv = tvCanvas?.tv
          const pb = tv?.projBox?.(turn)
          if (!pb) return null
          const tb = boxIn(tvCanvas)
          const yRow = pb.y + pb.h * EDGE_Y
          for (let x = pb.x + pb.w; x > pb.x; x -= 3) if (tv.hit(x, yRow, turn)) return [tb.x + x, tb.y + yRow]
          return null
        }
        const c3 = [J[0] + Jdir[0] * vw * 0.35, J[1] + Jdir[1] * vw * 0.35]
        const c4 = [F[0], F[1] + vh * 0.5]
        // trecho 1: T → (G) → J, tangente contínua; devolve o comprimento até G
        const buildSeg1 = (G) => {
          if (!G) {
            const c1 = [T[0] + vw * 0.06, T[1] + vh * 0.12]
            const c2 = [J[0] - Jdir[0] * vw * 0.12, J[1] - Jdir[1] * vw * 0.12]
            seg1.setAttribute('d', curve(T, c1, c2, J))
            return -1
          }
          const dTG = Math.hypot(G[0] - T[0], G[1] - T[1])
          const dGJ = Math.hypot(J[0] - G[0], J[1] - G[1])
          const dir = [(J[0] - G[0]) / dGJ, (J[1] - G[1]) / dGJ]
          const a1 = [T[0], T[1] + dTG * 0.4] // sai da busca descendo
          const a2 = [G[0] - dir[0] * dTG * 0.4, G[1] - dir[1] * dTG * 0.4]
          seg1.setAttribute('d', curve(T, a1, a2, G))
          const lenG = seg1.getTotalLength()
          const k = Math.min(vw * 0.12, dGJ * 0.4)
          const b1 = [G[0] + dir[0] * dGJ * 0.35, G[1] + dir[1] * dGJ * 0.35]
          const b2 = [J[0] - Jdir[0] * k, J[1] - Jdir[1] * k]
          seg1.setAttribute('d', curve(T, a1, a2, G, b1, b2, J))
          return lenG
        }
        // duas passadas: o giro no toque depende de onde o toque cai no caminho
        let lenG = -1
        let sGuess = 0.06
        for (let pass = 0; pass < 2; pass++) {
          const dTouch = dGo + sineIOinv(clamp01(sGuess)) * (dEnd - dGo)
          lenG = reduced ? -1 : buildSeg1(findEdge(turnAt(dTouch)))
          if (reduced) buildSeg1(null)
          L1 = seg1.getTotalLength()
          motion.setAttribute('d', `${seg1.getAttribute('d')}${curve(J, c3, c4, F).slice(1 + String(J).length)}`)
          L = motion.getTotalLength()
          if (lenG < 0) break
          sGuess = lenG / L
        }
        sHit = lenG > 0 ? lenG / L : -1
        dHit = sHit > 0 ? dGo + sineIOinv(sHit) * (dEnd - dGo) : -1
        tvBox = boxIn(tvCanvas)
        hitArm = null // caminho novo: a janela do toque se rearma pelo lado em que o cursor está
        if (sHit > 0) {
          const h0 = motion.getPointAtLength(lenG - 4)
          const h1 = motion.getPointAtLength(lenG + 4)
          const hp = motion.getPointAtLength(lenG)
          const hl = Math.hypot(h1.x - h0.x, h1.y - h0.y) || 1
          hitN = [(h1.x - h0.x) / hl, (h1.y - h0.y) / hl]
          Object.assign(impact.style, { left: `${hp.x}px`, top: `${hp.y}px` })
        }
        const bw = 70 * artScale * BRUSH_GAIN // cobre a arte
        extPath.setAttribute('stroke-width', bw)
        ext = stroke(extPath, curve(J, c3, c4, F))
        // região da máscara = caixa do traço (+ espessura). Grande demais (era
        // 60000²) estoura a textura da GPU e a página inteira fica preta.
        const bb = extPath.getBBox()
        Object.entries({ x: bb.x - bw, y: bb.y - bw, width: bb.width + bw * 2, height: bb.height + bw * 2 })
          .forEach(([k, v]) => maskEl.setAttribute(k, v))
        brushArt.setAttribute('d', warpBrush(extPath, pickS, artScale, BRUSH_GAIN))
        // o traço A chega em J no instante em que o cursor passa por ali
        const dJ = dGo + sineIOinv(L1 / L) * (dEnd - dGo)
        lineAPen.end = pinAt() + dJ
        // paradas da régua, em fração do pin inteiro
        const total = travelA + scrollB
        rFracs = [dGo / total, dJ / total, dEnd / total]
        rStops.forEach((el, i) => { el.style.left = `${rFracs[i] * 100}%` })
        Object.assign(rPath.style, { left: `${rFracs[0] * 100}%`, width: `${(rFracs[2] - rFracs[0]) * 100}%` })
        s0 = searchBox.offsetHeight * SIZE_IN_SEARCH
        split.tagAt(F[0] - s3Left + sF * 0.7, F[1] - s3Top + sF * 1.02)
      }

      // fração do comprimento do caminho em que o cursor está
      const progress = (d) => (reduced ? 1 : sineIO(ramp(d, dGo, dEnd)))
      // giro da TV em função do scroll: contínuo, com a frente no esbarrão
      // (dF) na metade da curva (velocidade máxima ali, nada parado); acelera
      // devagar no início e assenta devagar no fim (sine in-out no todo)
      function turnAt(d) {
        const dF = dHit > 0 ? dHit : dGo - travelA * PRESS + travelA * BOOT_SPAN * 0.7
        const dE = Math.max(dF + 1, travelA * TURN_END)
        const u = d < dF ? 0.5 * clamp01(d / dF) : 0.5 + 0.5 * clamp01((d - dF) / (dE - dF))
        const e = sineIO(u) * 2 - 1 // −1 esquerda · 0 frente · 1 direita
        return TURN_FRONT + e * (e < 0 ? TURN_LEFT : TURN_RIGHT)
      }
      const proxy = { d: 0 } // px de scroll percorridos dentro do pin

      function apply() {
        const d = proxy.d
        if (d > 0) goNear() // dentro do pin: o cursor 3D e a seção 3 montam mesmo sem ter passado pela seção 2
        const x = -Math.min(d, travelA)
        gsap.set(track, { x })
        // Com o PC no ar (camada opaca por cima de tudo), o que fica embaixo — a TV, a
        // seção 3, o segundo ato, a seção 5 — não é atualizado: fica parado, invisível,
        // e o 1º quadro fora do PC o refaz (é tudo função do scroll). Atualizado, cada
        // quadro do PC pagava escritas e leituras de layout de cenas que ninguém via
        const under = !!pc && d >= pcAt
        // giro, sintonia e peso da TV pela posição dela na tela (nada disso em
        // reduced motion: a TV fica no repouso, já sintonizada)
        const tv = under ? null : tvCanvas?.tv
        if (tv && !reduced) {
          tv.setTurn(turnAt(d))
          // perto do toque o PC assenta na pose em que o toque foi medido
          tv.setHold?.(dHit > 0 ? 1 - smooth(clamp01(Math.abs(d - dHit) / (travelA * HOLD_NEAR))) : 0)
          tv.setShift(x)
          tv.setTune(1) // o boot (applyBoot) ocupa a tela, sem chiado de sintonia
        }
        // a seção 3 entra pela direita: a pílula "quem conversa com você" já
        // decodifica na entrada (está pronta quando a seção chega), rótulos
        // digitam, a 1ª palavra é desenhada, a 2ª compila; com o cursor
        // assentado, seleção (Figma), inspeção (DevTools) e etiqueta. A nota
        // digita cedo, já na chegada da seção.
        // Tudo termina até S3_DONE do scroll parado: o resto fica livre para a
        // transição (máscara) para o próximo texto do Manifesto.
        if (!under) split?.update({
          mark: ramp(d, travelA - vw * 0.95, travelA - vw * 0.65),
          kickA: ramp(d, travelA - vw * 0.85, travelA - vw * 0.6),
          wordA: ramp(d, travelA - vw * 0.8, travelA - vw * 0.25),
          kickB: ramp(d, travelA - vw * 0.7, travelA - vw * 0.45),
          wordB: ramp(d, travelA - vw * 0.6, travelA - vw * 0.05),
          crop: ramp(d, travelA - vw * 0.5, travelA),
          sel: ramp(d, dEnd - scrollB * 0.02, dEnd + scrollB * 0.12),
          inspect: ramp(d, dEnd + scrollB * 0.05, dEnd + scrollB * 0.2),
          tag: ramp(d, dEnd + scrollB * 0.15, dEnd + scrollB * 0.25),
          note: ramp(d, travelA - vw * 0.2, dEnd),
        })
        if (!under) ext?.set(Math.max(0, (progress(d) * L - L1) / (L - L1)))
        // segundo ato: cortina e cena A (reduced motion: corte seco, cena pronta)
        const curtain = ramp(d, act2At, act2At + vh * CURTAIN_VH)
        const sceneA = ramp(d, act2At + vh * CURTAIN_VH * TEXT_AT, sceneAEnd)
        // faixa → seção 5: deslocamento lateral preso ao scroll (também em reduced motion, como a trilha)
        const b = Math.min(shiftLen, Math.max(0, d - sceneAEnd))
        // seção 5: a câmera anda mais um pouco no arrasto da régua
        // seção 6: entra de lado (a cena B, a faixa e a régua saem junto, pela câmera)
        const slide6 = s6 ? Math.min(vw, Math.max(0, d - s6At)) : 0
        const cam = (s5 ? s5.cam(d - sceneAEnd) : 0) + slide6
        if (s6) {
          s6Scene.style.transform = `translateX(${vw - slide6}px)`
          // (preso no fim do roteiro: o PC vem depois, e o excesso o faria "desandar" com freio ao voltar)
          s6.scroll(d > s6At ? Math.min(s6.length(), Math.max(0, d - s6At - vw) / vh) : null, slide6 / vw)
        }
        if (pcHost && pinLen > pcAt) {
          if (!pc && d >= pcAt) mountPCNow() // (só se ainda não montou: ver o aquecimento abaixo de layout())
          if (pc) nestS6(d >= pcAt)
          pcTarget = d >= pcAt ? (d - pcAt) / vh : null
          stepPC(0)
          // com o PC no ar (camada opaca por cima de tudo), a trilha atrás dele (seções
          // 1–3, a grade) não precisa ser pintada: ela seguia repintando, invisível
          root.classList.toggle('pc-on', !!pc && d >= pcAt)
        }
        if (!under) act2?.update(reduced ? { curtain: curtain > 0 ? 1 : 0, a: curtain > 0 ? 1 : 0, b, cam } : { curtain, a: sceneA, b, cam })
        // cursor 3D e régua seguem no segundo ato (a régua volta a ter papel
        // na seção 5): mergulham devagar durante a cortina e voltam inteiros
        const dip = reduced ? 0 : ACT2_DIP * Math.sin(Math.PI * curtain)
        if (canvas && !under) {
          canvas.style.opacity = `${1 - dip}`
          // acende junto com "mostrar": o mesmo brilho do text-shadow dela
          // (App.css → .ma-w--show), na escala do cursor ao lado do olho
          const lit = act2?.lit() ?? 0
          canvas.style.filter = lit > 0 ? `drop-shadow(0 0 ${(sAway * 0.32 * lit).toFixed(1)}px rgba(244,243,239,${(0.4 * lit).toFixed(3)}))` : ''
        }
        ruler.style.setProperty('--act2-dip', dip)
        curtainNow = curtain
        chrome() // grão e header claro sobre o escuro (até a lâmpada do PC acender)
        syncSkip() // o modo do botão (pular/voltar) segue o scroll, não só os eventos do pin
        // régua: cabeçote no scroll do pin, trecho vermelho = cursor no caminho
        const p = clamp01(d / (travelA + scrollB))
        rulerW ||= ruler.clientWidth // (medida no layout; ler aqui, depois das escritas, forçava um layout por quadro)
        rHead.style.transform = `translateX(${p * rulerW}px)`
        const pct = `${String(Math.round(p * 100)).padStart(3, '0')}%`
        if (rVal.textContent !== pct) rVal.textContent = pct // (reescrever igual inseria um nó a cada quadro)
        rFill.style.transform = `scaleX(${progress(d)})`
        rStops.forEach((el, i) => el.classList.toggle('on', p >= rFracs[i] - 0.001))
        // seção 5 (frases, relógio, fermata) e, depois da faixa, a régua nas mãos dela
        if (under) return
        const layerTop = rootDoc - window.scrollY + gsap.getProperty(root, 'y') + s3Top
        s5?.update(d - sceneAEnd, act2.sceneX(), layerTop, carryAt(d, layerTop))
      }

      // Cursor a cada quadro, dentro do quadro do próprio cursor (antes de
      // renderizar — sem atraso de um quadro para o traço) e sem ler layout:
      // a posição da trilha na tela vem do y do pin (transform aplicado pelo
      // GSAP, soma o pin de entrada da seção 1 e o lateral) + o x dela.
      const onPath = { s: -1, L: -1, a: null, dir: 0 }
      let underPC = false // (ver apply: embaixo do PC nada se atualiza)
      function tick(now) {
        if (!ext || !st || !cur) return
        if (pc && proxy.d >= pcAt) {
          // o cursor e os desenhos da seção 5 saem uma vez; o cursor ali é o do PC
          if (!underPC) { underPC = true; s5?.idle(canvas); cur.set(-9999, 0, 0, 1, 0) }
          return
        }
        underPC = false
        const d = proxy.d
        const s = progress(d)
        // Esbarrão (em qualquer sentido do scroll): o PC leva o impacto
        // (balança, treme, dither estoura, tela perde a sintonia — tv3d.bump),
        // aparece a marca e o cursor recua. O caminho passa pela borda do
        // monitor medida com o PC parado no giro planejado, mas o PC de verdade
        // pode estar um pouco fora dessa pose (inclinado pela velocidade, ainda
        // balançando) — então, perto do toque (HIT_WIN px de caminho para cada
        // lado), o esbarrão sai no primeiro quadro em que a ponta encosta de
        // fato na malha; se não encostar, no fim da janela.
        if (sHit > 0 && prevS >= 0) {
          const win = HIT_WIN / L
          const zone = s < sHit - win ? -1 : s > sHit + win ? 1 : 0
          // a ponta só importa dentro da janela do toque (getPointAtLength num
          // caminho longo é caro, e isto roda todo quadro até o fim do pin)
          const tip = zone === 0 ? motion.getPointAtLength(s * L) : null
          const fire = (dir) => {
            bumpDir = dir
            // o corte terminal → logo segue o contato real (vindo de frente)
            // (nunca depois do planejado: o fim do gatilho do boot foi medido com ele)
            if (dir > 0) { hitD = dHit > 0 ? Math.min(d, dHit) : d; applyBoot() }
            tvCanvas?.tv?.bump?.(bumpDir * Math.min(1.2, 0.45 + Math.abs(s - prevS) * 40))
            bumpAt = now
            const at = zone === 0 ? tip : motion.getPointAtLength(sHit * L)
            Object.assign(impact.style, { left: `${at.x}px`, top: `${at.y}px` })
            impact.classList.remove('on')
            void impact.offsetWidth // reinicia a animação da marca
            impact.classList.add('on')
          }
          if (hitArm === null) hitArm = zone
          else if (zone !== 0) {
            if (hitArm === -zone) fire(zone) // atravessou a janela sem encostar
            hitArm = zone
          } else if (hitArm !== 0 && tvCanvas?.tv?.hit(tip.x - tvBox.x, tip.y - tvBox.y)) {
            fire(-hitArm)
            hitArm = 0
          }
        }
        prevS = s
        // recuo: quica para trás da direção em que vinha, achata e gira rápido
        const age = (now - bumpAt) / 1000
        const hitK = age < 1.4 ? Math.exp(-age * 6) : 0
        const jolt = hitK * Math.sin(age * 26 + 0.5) * BUMP_PX * bumpDir
        const squash = 1 - 0.2 * (age < 1 ? Math.exp(-age * 10) : 0)
        const spin = hitK * Math.sin(age * 20) * 0.45 * bumpDir
        const trTop = rootDoc - window.scrollY + gsap.getProperty(root, 'y')
        // seção 5: depois do fim da cena A o cursor é dela (trajeto, virada, dedilhado, régua)
        if (s5) {
          const d5 = d - sceneAEnd
          if (d5 > 0) {
            s5.frame(now, d5, {
              cur,
              cursorCanvas: canvas,
              start: away ? [away[0], trTop + away[1]] : [vw * 0.86, vh * 0.5],
              size: away ? sAway : vh * 0.08,
              layerTop: trTop + s3Top,
              sceneX: act2.sceneX(),
              ribbon: { at: act2.ribbonAt, reach: act2.ribbonReach(), half: act2.ribbonHalf() },
              carry: carryAt(d, trTop + s3Top),
            })
            return
          }
          s5.idle(canvas)
        }
        const trLeft = gsap.getProperty(track, 'x')
        const click = gsap.getProperty(searchCursor, 'scale')
        const press = 1 - 0.14 * Math.sin(Math.PI * ramp(d, dGo - travelA * PRESS, dGo + travelA * 0.015))
        // escala geométrica: cada trecho cresce a mesma proporção
        const size = s0 * (sF / s0) ** smooth(ramp(s, 0.08, 0.95)) * press * (s > 0 ? 1 : click) * squash
        // até pegar o traço: continua cursor de interface (chapado) e gira aos
        // poucos, no sentido horário, até a direção do traço em J
        const w = smooth(clamp01((s * L) / L1))
        const settle = Math.max(1 - w, smooth(ramp(s, 0.88, 1)))
        const flat = 1 - w
        const aimJ = cur.aimFor(Math.atan2(-Jdir[1], Jdir[0]))
        const aim = s * L < L1 ? cur.flatZ + ((((aimJ - cur.flatZ) % TAU) - TAU) % TAU) * w : null
        if (s <= 0) {
          cur.set(trLeft + T[0] + gsap.getProperty(search, 'x'), trTop + T[1], Math.PI / 2, 1, 1, size, 1)
          return
        }
        // ponto e direção no caminho: só recalcula quando o scroll andou (o tick roda
        // todo quadro, inclusive parado, e getPointAtLength é caro)
        if (s !== onPath.s || L !== onPath.L) {
          const p0 = motion.getPointAtLength(Math.max(0, s * L - 6))
          const p1 = motion.getPointAtLength(Math.min(L, s * L + 6))
          onPath.a = motion.getPointAtLength(s * L)
          onPath.dir = Math.atan2(p0.y - p1.y, p1.x - p0.x)
          onPath.s = s
          onPath.L = L
        }
        const { a, dir } = onPath
        split?.cursor(trLeft + a.x, trTop + a.y)
        // segundo ato: sai da frente da frase para o lado do olho (arco
        // suave, encolhe, gira para a direita; a inércia do giro é do cursor3d)
        const mv = !away ? 0 : reduced ? (d >= dAway0 ? 1 : 0) : sineIO(ramp(d, dAway0, dAway1))
        if (mv > 0) {
          const x0 = trLeft + a.x, y0 = trTop + a.y
          const x2 = away[0], y2 = trTop + away[1]
          const x1 = (x0 + x2) / 2, y1 = Math.min(y0, y2) - vh * AWAY_ARC
          const u = 1 - mv
          const turn = Math.atan2(Math.sin(cur.aimFor(AWAY_DIR) - cur.restZ), Math.cos(cur.aimFor(AWAY_DIR) - cur.restZ))
          cur.set(u * u * x0 + 2 * u * mv * x1 + mv * mv * x2, u * u * y0 + 2 * u * mv * y1 + mv * mv * y2, dir, 1, 1,
            size * (sAway / size) ** mv, 0, cur.restZ + turn * mv)
          return
        }
        cur.set(trLeft + a.x - hitN[0] * jolt, trTop + a.y - hitN[1] * jolt, dir, settle, 1, size, flat, aim === null ? null : aim + spin)
      }

      layout()
      if (pcHost && pinLen > pcAt) { mountPCNow(); warmup(pc.warm()) }
      gsap.ticker.add(tickPC) // o PC alcançando o scroll depois que a 6 termina (stepPC)
      st = gsap.fromTo(proxy, { d: 0 }, {
        d: () => pinLen,
        ease: 'none',
        onUpdate: apply,
        scrollTrigger: {
          trigger: root,
          start: pinAt,
          end: () => `+=${pinLen}`,
          pin: true,
          // Fixa por transform, não por position:fixed. O .reveal-panel (pai)
          // pode estar com transform/will-change da transição Hero→Marquee, e
          // aí um fixed se posiciona relativo a ele e o bloco some da tela.
          pinType: 'transform',
          scrub: SCRUB,
          invalidateOnRefresh: true,
          refreshPriority: -1, // mede depois do gatilho da Hero→Marquee
          onRefreshInit: layout,
          onRefresh: apply,
          // Mesmo padrão do tween Marquee/panel (useHeroMarqueeReveal): promove
          // a camada só enquanto o scrub lateral está de fato em jogo.
          onEnter: () => gsap.set(track, { willChange: 'transform' }),
          onEnterBack: () => gsap.set(track, { willChange: 'transform' }),
          onLeave: () => gsap.set(track, { willChange: 'auto' }),
          onLeaveBack: () => gsap.set(track, { willChange: 'auto' }),
          onToggle: (self) => ruler.classList.toggle('on', self.isActive),
        },
      }).scrollTrigger
      // a faixa do botão de pular: da seção 1 até o fim do pin (mede depois dele)
      skipSt = ScrollTrigger.create({
        trigger: q('.ms-content'), start: 'top 75%', end: () => st.end, // (com a frase da seção 1 na tela, não a Hero)
        refreshPriority: -3,
        onToggle: (self) => { skipActive = self.isActive; syncSkip() },
      })
      // criada já dentro da faixa (remontagem pela troca de idioma) ela não dispara onToggle
      skipActive = skipSt.isActive
      syncSkip()

      // Boot do PC: gatilho próprio porque começa antes do pin (o proxy acima
      // só anda dentro dele). Mesma régua (px a partir do início do pin) e o
      // mesmo scrub, então emenda sem salto com o resto do pin.
      // Ordem na tela: barra em 100% → esbarrão (dHit) → a tela "dá bug"
      // (tv3d.bump tira a sintonia) e o terminal some no tranco → o logo abre.
      const bootLead = () => vh * BOOT_LEAD
      const bootSpan = () => travelA * (PRESS + BOOT_SPAN)
      // sem toque medido (TV ainda não carregou): o logo fica onde ficava
      // contato real do último esbarrão de frente; antes dele, o planejado
      const bootHit = () => (hitD > 0 ? hitD : dHit > 0 ? dHit : dGo - travelA * PRESS + bootSpan() * LOGO_FROM)
      const bootEnd = () => bootHit() + bootSpan() * (1 - LOGO_FROM)
      const boot = { d: 0 }
      function applyBoot() {
        const tv = tvCanvas?.tv
        if (!tv?.setBoot) return
        // corte seco no tranco: até `cut` o terminal (100%), daí o logo já
        // entra construído em LOGO_CUT — o chiado do tapa (tv3d.bump) cobre a troca
        const cut = bootHit() + travelA * HIT_GLITCH
        tv.setBoot(ramp(boot.d, -bootLead(), cut), boot.d < cut ? 0 : LOGO_CUT + (1 - LOGO_CUT) * ramp(boot.d, cut, bootEnd()))
      }
      const bootTw = reduced ? null : gsap.fromTo(boot, { d: () => -bootLead() }, {
        d: bootEnd,
        ease: 'none',
        onUpdate: applyBoot,
        scrollTrigger: {
          trigger: root,
          start: () => pinAt() - bootLead(),
          end: () => pinAt() + bootEnd(),
          scrub: SCRUB,
          invalidateOnRefresh: true,
          refreshPriority: -2, // depois do pin (layout() já mediu)
          onRefresh: applyBoot,
        },
      })

      // seção 3 montada → remede (vão, caminho, lineAPen.end)
      ready.then(() => { if (alive && split) ScrollTrigger.refresh() })
      // cursor 3D: canvas da tela inteira (fora do bloco fixado)
      whenNear(async () => {
        await ready
        if (!alive || !split) return
        canvas = Object.assign(document.createElement('canvas'), { className: 'ms-cursor-cv' })
        canvas.setAttribute('aria-hidden', 'true')
        document.body.append(canvas)
        let c = null
        try {
          c = await mountCursor3D(canvas, { size: 40, before: tick })
        } catch (err) {
          console.error('[manifesto cursor]', err)
        }
        if (!alive || !c) { c?.dispose(); canvas.remove(); canvas = null; return }
        cur = c
        // em reduced motion o cursor não viaja: o SVG da busca fica e o 3D
        // aparece já assentado na seção 3
        if (!reduced) root.classList.add('has-cursor3d')
        ScrollTrigger.refresh() // corpo exato do cursor → ponta final
      })
      // TV pronta / malha carregada: remede (a borda real do monitor entra no caminho)
      const onTvReady = () => ScrollTrigger.refresh()
      tvCanvas?.addEventListener('s2:tv-ready', onTvReady)
      tvCanvas?.addEventListener('tv3d:loaded', onTvReady)

      return () => {
        alive = false
        gsap.ticker.remove(tickPC)
        setSkipGo(null)
        skipSt?.kill()
        setSkip({ visible: false, mode: 'skip', cartaz: false })
        tvCanvas?.removeEventListener('s2:tv-ready', onTvReady)
        tvCanvas?.removeEventListener('tv3d:loaded', onTvReady)
        bootTw?.scrollTrigger?.kill()
        bootTw?.kill()
        tvCanvas?.tv?.setBoot?.(null)
        s5?.dispose()
        s6?.dispose()
        if (s6Scene) s6Scene.style.transform = ''
        if (pc) nestS6(false) // a seção 6 volta para a cena antes do PC limpar o DOM dele
        pc?.dispose()
        root.classList.remove('has-pc', 'pc-on')
        act2?.dispose()
        document.documentElement.classList.remove('ms-dark')
        cur?.dispose()
        canvas?.remove()
        svg.remove()
        impact.remove()
        rulerRO.disconnect()
        ruler.remove()
        grain.remove()
        root.classList.remove('has-cursor3d')
        gsap.set(track, { clearProps: 'transform,willChange' })
        lineAPen.end = 0 // sem o pin lateral, a caneta volta a terminar na seção 2
        lineAPen.frac = 1
        tvCanvas?.tv?.setTurn(0)
        tvCanvas?.tv?.setHold?.(0)
        tvCanvas?.tv?.setTune(1) // sem o pin lateral não há sintonia pelo scroll
      }
    })

    /* ------------------------------ mobile ------------------------------- */
    // Empilhada: pílula, é quem DESENHA, cursor 3D já assentado, e quem
    // PROGRAMA, nota. Os efeitos de texto seguem o scroll vertical da seção.
    mm.add(MOBILE_QUERY, () => {
      let alive = true
      let stm = null
      let cv = null
      let c = null
      // segundo ato empilhado: seção escura no fluxo, a cena A segue o scroll
      // seção 5 empilhada, no estado final (sem régua, sem cursor)
      const s5El = act2El?.querySelector('.s5')
      const s5 = s5El ? mountS5(s5El) : null
      s5?.still()
      // seção 6 empilhada: o cartaz final, parado (remede sozinha no resize)
      const s6El = act2El?.querySelector('.s6')
      const s6 = s6El ? mountS6(s6El, { still: true }) : null
      const act2 = act2El && mountAct2(act2El)
      const act2St = act2 && ScrollTrigger.create({
        trigger: act2El,
        start: 'top 70%',
        end: 'bottom 55%',
        scrub: SCRUB,
        invalidateOnRefresh: true,
        onUpdate: (self) => act2.update({ curtain: 1, a: reduced ? 1 : self.progress / 0.9 }),
        onRefresh: (self) => act2.update({ curtain: 1, a: reduced ? 1 : self.progress / 0.9 }),
      })
      // header claro enquanto a seção escura está atrás dele
      const darkSt = act2El && ScrollTrigger.create({
        trigger: act2El,
        start: 'top 64px',
        end: 'bottom 64px',
        toggleClass: { targets: document.documentElement, className: 'ms-dark' },
      })
      // pular o Manifesto (utils/manifestoSkip.js): sem o pin, o destino é a seção 6
      // empilhada (o cartaz final, parado) e a volta, o começo da seção 1
      const s5Scene = act2El?.querySelector('.ma-b')
      const s6Scene = act2El?.querySelector('.ma-c')
      let mActive = false
      let mMode = 'skip'
      let mJumping = false
      const mSync = () => setSkip({ visible: mActive && !mJumping, mode: mMode })
      const mSkipSt = ScrollTrigger.create({
        trigger: q('.ms-content'), start: 'top 75%', endTrigger: document.getElementById('trabalhos') ?? root, end: 'top 60%',
        onToggle: (self) => { mActive = self.isActive; mSync() },
      })
      const mModeSt = s5Scene && ScrollTrigger.create({
        trigger: s5Scene, start: 'top 60%',
        onEnter: () => { mMode = 'back'; mSync() },
        onLeaveBack: () => { mMode = 'skip'; mSync() },
      })
      // o cartaz parado: da seção 6 até Trabalhos assumir o header
      const mSeenSt = s6Scene && ScrollTrigger.create({
        trigger: s6Scene, start: 'top 50%', endTrigger: document.getElementById('trabalhos') ?? root, end: 'top 50%',
        onEnter: markManifestoSeen,
        onToggle: (self) => setSkip({ cartaz: self.isActive }),
      })
      // criadas já no meio do caminho (remontagem pela troca de idioma) elas não disparam
      // onToggle/onEnter: o estado sai da posição atual
      mActive = mSkipSt.isActive
      if (mModeSt && mModeSt.scroll() >= mModeSt.start) mMode = 'back'
      mSync()
      if (mSeenSt) setSkip({ cartaz: mSeenSt.isActive })
      const mCartazY = () => Math.max(0, docTop(s6Scene) - chromeBottom())
      // empilhado, o Manifesto cresce depois dos gatilhos criados (fontes, as seções 5 e
      // 6 medindo sozinhas): sem recalcular, as faixas ficavam com as posições velhas
      let mRefresh = 0
      const mRO = new ResizeObserver(() => { clearTimeout(mRefresh); mRefresh = setTimeout(() => ScrollTrigger.refresh(), 200) })
      mRO.observe(root)
      setSkipGo(async (mode, origin) => {
        if (mJumping || !s6Scene) return false
        if (mode === 'arrive') {
          ScrollTrigger.refresh()
          scrollNow(mCartazY())
          await nextFrame()
          ScrollTrigger.update()
          finishScrubs()
          return true
        }
        if (mode === 'work') {
          if (mMode === 'back') { scrollSmooth(mCartazY()); return true } // da seção 5 em diante: só rola
          mode = 'skip'
        }
        mJumping = true
        mSync()
        const toCartaz = mode !== 'back'
        try {
          await curtain(toCartaz ? 'trabalhos' : 'manifesto', origin, async () => {
            const target = toCartaz ? s6Scene : q('#manifesto')
            if (target) scrollNow(Math.max(0, docTop(target) - chromeBottom()))
            await nextFrame() // (o cache de scroll do ScrollTrigger: ver o salto no desktop)
            ScrollTrigger.update()
            finishScrubs()
            history.replaceState(history.state, '', `${location.pathname}${location.search}${toCartaz ? '#trabalhos' : ''}`)
          })
        } finally {
          mJumping = false
          mSync()
        }
        const focusEl = toCartaz ? document.getElementById('pc-cartaz') : q('#manifesto')
        if (focusEl) { if (!focusEl.hasAttribute('tabindex')) focusEl.setAttribute('tabindex', '-1'); focusEl.focus({ preventScroll: true }) }
        return true
      })
      const stateAt = (p) => ({
        mark: ramp(p, 0, 0.18),
        kickA: ramp(p, 0.08, 0.2),
        wordA: ramp(p, 0.1, 0.4),
        kickB: ramp(p, 0.3, 0.42),
        wordB: ramp(p, 0.34, 0.62),
        crop: ramp(p, 0.4, 0.62),
        sel: ramp(p, 0.55, 0.75),
        inspect: ramp(p, 0.62, 0.82),
        tag: ramp(p, 0.7, 0.8),
        note: ramp(p, 0.45, 0.65),
      })
      whenNear(async () => {
        await ready
        if (!alive || !split) return
        split.refit(0)
        stm = ScrollTrigger.create({
          trigger: s3,
          start: 'top 85%',
          end: 'bottom 75%',
          scrub: SCRUB,
          invalidateOnRefresh: true,
          onRefresh: (self) => { split.refit(0); split.update(stateAt(self.progress)) },
          onUpdate: (self) => split.update(stateAt(self.progress)),
        })
        split.update(stateAt(stm.progress))
        // a seção 3 montada empurra o segundo ato para baixo: remede os gatilhos dele
        ScrollTrigger.refresh()
        cv = document.createElement('canvas')
        s3vis.querySelector('.s3-gap').append(cv)
        try {
          c = await mountCursor3D(cv, { size: 100 })
        } catch (err) {
          console.error('[manifesto cursor]', err)
        }
        if (!alive || !c) { c?.dispose(); cv.remove(); return }
        // assentado no meio do vão, com a etiqueta junto ao corpo
        const g = split.gap()
        const size = g.h * 0.72
        const [bx, by] = c.body(size)
        const tip = [g.w / 2 - bx, g.h / 2 - by]
        c.set(tip[0], tip[1], Math.PI / 2, 1, 1, size, 0)
        split.tagAt(g.x + tip[0] + size * 0.7, g.y + tip[1] + size * 1.02)
      })
      return () => {
        alive = false
        setSkipGo(null)
        mRO.disconnect()
        clearTimeout(mRefresh)
        mSkipSt.kill()
        mModeSt?.kill()
        mSeenSt?.kill()
        setSkip({ visible: false, mode: 'skip', cartaz: false })
        act2St?.kill()
        darkSt?.kill()
        s5?.dispose()
        s6?.dispose()
        document.documentElement.classList.remove('ms-dark')
        act2?.dispose()
        stm?.kill()
        c?.dispose()
        cv?.remove()
      }
    })

    // Alturas da seção dependem de fontes web; remede quando carregarem.
    document.fonts.ready.then(() => ScrollTrigger.refresh())

    return () => {
      cancelled = true
      io.disconnect()
      mm.revert()
      s3vis.innerHTML = ''
    }
  }, [rootRef, lang])
}
