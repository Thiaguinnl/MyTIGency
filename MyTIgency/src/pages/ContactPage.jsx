import { useEffect } from 'react'
import { Header } from '../components/Header'
import { Contact } from '../components/Contact'
import { Footer } from '../components/Footer'
import { markPageReady } from '../utils/pageTransition'

// Página de contato (/contato). Chegando pela cortina, ela se revela quando
// as fontes da primeira dobra estão prontas (o título não pode aparecer com
// fallback); aberta direto, aparece sem LoadingScreen.
export default function ContactPage() {
  useEffect(() => {
    Promise.all([
      document.fonts.load('400 132px "Instrument Serif"'), // título, "Ou só bater um papo.", linha ao lado
      document.fonts.load('400 15px "JetBrains Mono"'),
      document.fonts.load('400 24px Fraunces'), // campos e pílulas
    ]).catch(() => {}).then(() => document.fonts.ready).then(markPageReady)
  }, [])

  return (
    <>
      <Header page="contact" />
      <div className="app-shell">
        <Contact />
        <Footer />
      </div>
    </>
  )
}
