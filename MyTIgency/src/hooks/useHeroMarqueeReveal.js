import { useLayoutEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useLenis } from 'lenis/react'

gsap.registerPlugin(ScrollTrigger)

const MOBILE_QUERY = '(max-width: 820px)'
const MOBILE_PEEK = 10
// Mesmo breakpoint da Hero em coluna única (App.css) — onde --hero-h vale.
const SINGLE_COLUMN_QUERY = '(max-width: 980px)'
// Scroll parado (descendo) depois deste ponto da transição completa o dock —
// senão a marquee podia ficar a poucos px do topo, com o fundo aparecendo.
const DOCK_SNAP_FROM = 0.85

// Hero stays fixed for its whole lifecycle (never toggled back to static —
// that reflow was what flickered the ascii canvas). Marquee and the reveal
// panel (Services + Work + Footer) are adjacent in flow and share ONE
// scrubbed `y` tween, so they travel as one visual sheet — sweeping up from a
// peeking position at the fold until Marquee reaches the very top, dragging
// the next section in with it. Same flow + same transform means they can't
// drift apart (a fixed Marquee could: mobile toolbar resizes and iOS momentum
// scroll moved the panel natively while Marquee waited on JS, opening a gap).
// They're kept as siblings (not nested) on purpose: see the comment above
// `.reveal-panel` in App.css. Marquee is sticky (top:0, above the header), so
// once the travel ends it docks natively. Reduced-motion users keep the
// original static, in-flow marquee.
export function useHeroMarqueeReveal() {
  const lenis = useLenis()
  const triggerRef = useRef(null)

  useLayoutEffect(() => {
    const hero = document.getElementById('top')
    const spacer = document.querySelector('.reveal-spacer')
    const panel = document.querySelector('.reveal-panel')
    const marquee = document.querySelector('.marquee')
    if (!hero || !spacer || !panel || !marquee) return undefined

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return undefined
    }

    const setMarqueeHeight = () => {
      document.documentElement.style.setProperty('--marquee-h', `${marquee.offsetHeight}px`)
    }
    setMarqueeHeight()
    const marqueeHeightObserver = new ResizeObserver(setMarqueeHeight)
    marqueeHeightObserver.observe(marquee)

    // Altura da Hero/transição congelada em px. A barra do navegador (ou a
    // barra simulada de extensões de mobile, que redimensionam o iframe e
    // levam svh junto) muda só a altura, e pouco — seguir isso fazia a Hero
    // crescer no primeiro scroll: ASCII mudava de tamanho, copy descia e a
    // marquee pulava. Só atualiza em mudança de largura (rotação), salto
    // grande de altura, ou no layout desktop (>980px, sem barra dinâmica).
    let heroH = window.innerHeight
    let lastW = window.innerWidth
    const setHeroH = () => document.documentElement.style.setProperty('--hero-h', `${heroH}px`)
    setHeroH()
    const onResize = () => {
      const w = window.innerWidth
      const h = window.innerHeight
      const minorHeightOnly = w === lastW && Math.abs(h - heroH) < heroH * 0.25
      if (minorHeightOnly && window.matchMedia(SINGLE_COLUMN_QUERY).matches) return
      lastW = w
      heroH = h
      setHeroH()
    }
    window.addEventListener('resize', onResize)

    hero.classList.add('hero--pinned')
    spacer.classList.add('reveal-spacer--active')
    marquee.classList.add('marquee--reveal')

    function dock() {
      document.documentElement.classList.add('marquee-docked')
      hero.classList.add('hero--hidden')
      // Drop the panel's transform (and the will-change that goes with it)
      // once it's done sweeping — it's settled at y:0 either way, this just
      // stops it being an unnecessary compositor layer/stacking context.
      gsap.set([marquee, panel], { clearProps: 'transform,willChange' })
    }

    function undock() {
      document.documentElement.classList.remove('marquee-docked')
      hero.classList.remove('hero--hidden')
      // Só will-change: o scrub já aplicou o `y` do progresso atual antes
      // deste callback — forçar y:0 aqui sobrescrevia isso num scroll rápido.
      gsap.set([marquee, panel], { willChange: 'transform' })
    }

    const ctx = gsap.context(() => {
      const peek = () => (window.matchMedia(MOBILE_QUERY).matches ? MOBILE_PEEK : marquee.offsetHeight)
      // Marquee's natural (untransformed) flow position is right below the
      // spacer, so the starting transform only needs to make up the
      // difference up to the desired peek position at the fold.
      const fromY = () => (heroH - peek()) - spacer.offsetHeight

      // will-change promotes both to their own compositor layers so scrubbing
      // the transform doesn't repaint the whole subtree (Services cards) on
      // every scroll frame.
      const sheetTween = gsap.fromTo(
        [marquee, panel],
        { y: fromY, willChange: 'transform' },
        { y: 0, ease: 'none' }
      )

      // Header troca de lugar com a marquee ligado ao scroll, sem evento: o
      // topo visual da marquee é linear no progresso, (heroH − peek)·(1 − p).
      // Quando ela encosta na base do header, ele começa a descer na mesma
      // proporção e chega embaixo dela exatamente no dock (--dock-t = 1, o
      // mesmo top que html.marquee-docked aplica) — antes ele só pulava.
      const header = document.querySelector('header')
      function dockHeader(self) {
        if (!header) return
        const base = parseFloat(getComputedStyle(header).getPropertyValue('--header-base')) || 0
        const reach = header.offsetHeight + base // de onde a marquee "encosta" no header
        const marqueeTop = (heroH - peek()) * (1 - self.progress)
        const t = Math.min(1, Math.max(0, (reach - marqueeTop) / reach))
        header.style.setProperty('--dock-t', t.toFixed(4)) // (no header, não no <html>: herdada pela página inteira, recalculava o estilo de tudo a cada quadro)
      }

      triggerRef.current = ScrollTrigger.create({
        trigger: spacer,
        start: 'top top',
        end: 'bottom top',
        scrub: true,
        animation: sheetTween,
        invalidateOnRefresh: true,
        onLeave: dock,
        onEnterBack: undock,
        onUpdate: dockHeader,
      })
    })

    return () => {
      marqueeHeightObserver.disconnect()
      window.removeEventListener('resize', onResize)
      document.documentElement.style.removeProperty('--hero-h')
      ctx.revert()
      triggerRef.current = null
      document.documentElement.classList.remove('marquee-docked')
      document.querySelector('header')?.style.removeProperty('--dock-t')
      hero.classList.remove('hero--pinned', 'hero--hidden')
      spacer.classList.remove('reveal-spacer--active')
      marquee.classList.remove('marquee--reveal')
    }
  }, [])

  useLayoutEffect(() => {
    if (!lenis) return undefined
    let settleTimer = 0
    const onScroll = () => {
      ScrollTrigger.update()
      clearTimeout(settleTimer)
      settleTimer = setTimeout(() => {
        const st = triggerRef.current
        if (st && !lenis.isTouching && lenis.direction === 1
          && st.progress > DOCK_SNAP_FROM && st.progress < 1) {
          lenis.scrollTo(st.end)
        }
      }, 150)
    }
    lenis.on('scroll', onScroll)
    return () => {
      clearTimeout(settleTimer)
      lenis.off('scroll', onScroll)
    }
  }, [lenis])
}
