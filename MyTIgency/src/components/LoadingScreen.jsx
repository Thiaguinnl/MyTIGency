import { useEffect, useState } from 'react'
import { useAppReady } from '../hooks/useAppReady'
import { useBodyScrollLock } from '../hooks/useBodyScrollLock'
import { useLanguage } from '../context/LanguageContext'

const FADE_MS = 500

// Entrada da Hero (App.css → "Hero entrance"): HomePage marca html.hero-wait
// no mount; liberar o gate troca pra .hero-in, junto com o fade do loading.
export const revealHero = () =>
  document.documentElement.classList.replace('hero-wait', 'hero-in')

export function LoadingScreen() {
  const isReady = useAppReady()
  const { t } = useLanguage()
  const [mounted, setMounted] = useState(true)
  const [fading, setFading] = useState(false)

  useBodyScrollLock(mounted)

  useEffect(() => {
    if (!isReady) return undefined
    revealHero()
    setFading(true)
    const timer = setTimeout(() => setMounted(false), FADE_MS)
    return () => clearTimeout(timer)
  }, [isReady])

  if (!mounted) return null

  return (
    <div
      className={`loading-screen${fading ? ' loading-screen--fading' : ''}`}
      role="status"
      aria-live="polite"
      aria-label={t.loading.ariaLabel}
      aria-busy={!isReady}
    >
      <span className="loading-screen-label">{t.loading.label}</span>
    </div>
  )
}
