import { lazy, Suspense } from 'react'
import { ContextualCursor } from './components/ContextualCursor'
import { SmoothScroll } from './components/SmoothScroll'
import { LanguageProvider, useLanguage } from './context/LanguageContext'
import { hasNavigated, setPagePrefetch, useRoute } from './utils/pageTransition'
import './App.css'

// Um documento só para as duas páginas (navegação sem recarregar, ver
// utils/pageTransition.js). O que é do site inteiro — scroll, idioma,
// cursor — fica montado; cada página carrega o próprio código sob demanda
// (a contato não baixa o 3D da home) e é remontada do zero a cada visita.
const LOADERS = {
  '/': () => import('./pages/HomePage'),
  '/contato': () => import('./pages/ContactPage'),
}
const PAGES = {
  '/': lazy(LOADERS['/']),
  '/contato': lazy(LOADERS['/contato']),
}
// Enquanto a cortina fecha, o código da página de destino já vai baixando
setPagePrefetch((to) => LOADERS[to]?.().catch(() => {}))

// Primeira carga: o código da página ainda está chegando. Na home, já com a
// cara do LoadingScreen (que assume em seguida); na contato, só o fundo.
// Navegando, a cortina já cobre a tela — nada aqui.
function RouteFallback({ route }) {
  const { t } = useLanguage()
  if (route !== '/' || hasNavigated()) return null
  return (
    <div className="loading-screen" aria-hidden="true">
      <span className="loading-screen-label">{t.loading.label}</span>
    </div>
  )
}

function App() {
  const route = useRoute()
  const Page = PAGES[route]

  return (
    <SmoothScroll>
      <LanguageProvider>
        <ContextualCursor />
        <Suspense fallback={<RouteFallback route={route} />}>
          <Page key={route} />
        </Suspense>
      </LanguageProvider>
    </SmoothScroll>
  )
}

export default App
