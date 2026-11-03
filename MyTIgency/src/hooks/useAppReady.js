import { useEffect, useState } from 'react'
import { getHeroModelReady } from '../utils/1asciiLogo'
import { warmupsDone } from '../utils/warmup'
import { landOnHash } from '../utils/manifestoSkip'

// Teto: nunca deixa o usuário preso atrás do loading screen por causa de
// rede ruim ou um asset que falhou — libera de qualquer jeito (o aquecimento
// que faltar continua rodando por trás).
const MAX_WAIT_MS = 9000
// Mesmo carregando tudo instantaneamente, uma exibição mínima evita um
// "pisca" da tela de loading — e cobre o raro caso de tudo resolver rápido
// o bastante pra coincidir com o próprio burst de montagem síncrona.
// 700ms = um ciclo inteiro da varredura ░▒▓ do LoadingScreen.
const MIN_DISPLAY_MS = 700

const nextFrame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))

// O que precisa estar pronto antes de liberar a primeira interação — ver
// myt-motion → Loading Gate pra critério de quando adicionar algo aqui.
// Além da primeira tela, o aquecimento do que vem depois no scroll
// (utils/warmup.js); espera dois quadros para os efeitos da página o registrarem.
function dependencies() {
  return Promise.all([
    document.fonts?.ready ?? Promise.resolve(),
    getHeroModelReady().catch(() => {}),
    nextFrame().then(warmupsDone),
  ])
}

export function useAppReady() {
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    const timeout = new Promise((resolve) => setTimeout(resolve, MAX_WAIT_MS))
    const minDisplay = new Promise((resolve) => setTimeout(resolve, MIN_DISPLAY_MS))

    // com /#trabalhos, pousa no cartaz do Manifesto ainda coberto (utils/manifestoSkip.js)
    Promise.race([dependencies().then(landOnHash), timeout])
      .then(() => minDisplay)
      .then(() => { if (!cancelled) setIsReady(true) })

    return () => { cancelled = true }
  }, [])

  return isReady
}
