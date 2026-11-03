import { useEffect, useRef, useState } from 'react'
import { useHeaderScroll } from '../hooks/useHeaderScroll'
import { useActiveSection } from '../hooks/useActiveSection'
import { useLanguage } from '../context/LanguageContext'
import { usePrevLabelHeld, scrollToTop, curtainTo, originOf } from '../utils/pageTransition'
import { DecodeText } from './DecodeText'
import { useSkipState } from '../utils/manifestoSkip'
import { Menu } from './Menu'
import logo from '../assets/logo.svg'

// page="contact": mesmo header, mas o rótulo é fixo ("Contato"), o fundo fica
// sempre no estado com vidro e o logo leva de volta pra home.
export function Header({ page = 'home' }) {
  const isContact = page === 'contact'
  const scrolled = useHeaderScroll() || isContact
  const entering = usePrevLabelHeld()
  const { t } = useLanguage()

  // Hero is permanently position:fixed (see useHeroMarqueeReveal), so its
  // getBoundingClientRect().top never changes — a native #top jump would be
  // a no-op. Ainda na Home, sobe até o topo; de outra seção, a cortina de dither.
  const handleHomeClick = (e) => {
    if (isContact) return
    e.preventDefault()
    e.stopPropagation()
    if (activeId === 'top') scrollToTop()
    else curtainTo('top', originOf(e))
  }
  const headerRef = useRef(null)
  const triggerRef = useRef(null)
  const toggleTimeoutRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [justToggled, setJustToggled] = useState(false)

  const handleToggle = () => {
    setOpen((o) => !o)
    setJustToggled(true)
    clearTimeout(toggleTimeoutRef.current)
    toggleTimeoutRef.current = setTimeout(() => setJustToggled(false), 650)
  }

  useEffect(() => () => clearTimeout(toggleTimeoutRef.current), [])

  const homeSectionId = useActiveSection(isContact ? [] : ['top', 'manifesto', 'trabalhos', 'carreiras'])
  // no cartaz do fim do Manifesto (e na folha) o assunto já é Trabalhos. Vale por
  // cima da seção ativa: depois de um salto ela pode não ter visto o Manifesto
  // (o pin decide quando é cartaz, só dentro dele — utils/manifestoSkip.js)
  const { cartaz } = useSkipState()
  const activeId = isContact ? 'contato' : cartaz ? 'trabalhos' : homeSectionId
  const sectionLabels = {
    top: t.header.home,
    manifesto: t.header.manifesto,
    trabalhos: t.header.work,
    carreiras: t.header.careers,
    contato: t.header.contact,
  }

  useEffect(() => {
    const header = headerRef.current
    if (!header) return undefined

    const setHeaderHeight = () => {
      document.documentElement.style.setProperty('--header-h', `${header.offsetHeight}px`)
    }

    setHeaderHeight()
    const observer = new ResizeObserver(setHeaderHeight)
    observer.observe(header)
    return () => observer.disconnect()
  }, [])

  return (
    <header
      ref={headerRef}
      className={[scrolled && 'scrolled', open && 'menu-open'].filter(Boolean).join(' ')}
    >
      <a href={isContact ? '/' : '#top'} className="brand" onClick={handleHomeClick}>
        <img src={logo} alt="MyTigency" className="brand-logo" />
      </a>

      <div className="header-right">
        {/* Chegando pela cortina de dither: o rótulo começa no da página
            anterior e decodifica para o desta durante a revelação */}
        <DecodeText
          value={entering ? sectionLabels[isContact ? 'top' : 'contato'] : sectionLabels[activeId]}
          className="section-label"
        />

        <button
          type="button"
          ref={triggerRef}
          className={`menu-trigger${justToggled ? ' just-toggled' : ''}`}
          aria-expanded={open}
          aria-controls="site-menu"
          onClick={handleToggle}
        >
          <DecodeText
            value={open ? t.header.menuClose : t.header.menuOpen}
            as="span"
            className="menu-trigger-label"
          />
          <svg
            className={`mark${open ? ' is-open' : ''}`}
            viewBox="0 0 178 174"
            aria-hidden="true"
          >
            <path className="chevron" d="M117.767 103.273L59.2216 133.091V121.455L104.131 99.8182L103.767 100.545V98.7273L104.131 99.4545L59.2216 77.8182V66.1818L117.767 96V103.273Z" />
            <path className="underscore" d="M177.062 124V134H118.881V124H177.062Z" />
          </svg>
        </button>
      </div>

      <Menu open={open} onClose={() => setOpen(false)} triggerRef={triggerRef} activeId={activeId} isContact={isContact} />
    </header>
  )
}
