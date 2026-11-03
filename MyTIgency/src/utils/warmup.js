// Aquecimento sob a tela de carregamento (ver myt-motion → Loading Gate): quem
// monta algo pesado que só aparece mais adiante no scroll (a TV do Manifesto, o PC
// e a mesa) registra aqui a promise do "pronto" — shaders compilados, texturas
// enviadas à GPU, modelo carregado. useAppReady espera todas antes de liberar a
// página, para que esse custo não caia no meio do scroll.

const pending = new Set()
// Teto por tarefa: uma que nunca termina não pode prender o gate desta visita nem o
// das próximas (pending é do módulo e sobrevive à troca de página). Acontece: o
// compileAsync do three fica pendente para sempre se o material é descartado no meio
// (sair da home cedo, StrictMode no dev). A tarefa segue rodando; só não é esperada.
const TASK_MAX_MS = 6000

/** Registra um aquecimento; uma falha (ou o teto) não trava o gate, só deixa de esperar. */
export function warmup(task) {
  const p = Promise.race([task, new Promise((r) => setTimeout(r, TASK_MAX_MS))]).catch(() => {})
  pending.add(p)
  p.then(() => pending.delete(p))
  return p
}

/** Resolve quando não houver mais aquecimento pendente (inclusive os registrados
 *  enquanto os primeiros ainda rodavam). */
export async function warmupsDone() {
  while (pending.size) await Promise.all([...pending])
}

/** three.js: desenha a cena uma vez com tudo, inclusive o que está fora do quadro da
 *  câmera (e, com all, o que está escondido). O driver só termina de compilar um shader
 *  no primeiro uso dele (three lê o log do programa ali e espera); compileAsync liga os
 *  programas mas não os usa, e o render do aquecimento pulava o que a câmera ainda não
 *  via — o 1º quadro de verdade de cada objeto travava (a mesa: ~130 ms no zoom do PC) */
export function drawAll(renderer, scene, camera, { all = false } = {}) {
  const undo = []
  scene.traverse((o) => {
    if (o.frustumCulled) { o.frustumCulled = false; undo.push(() => { o.frustumCulled = true }) }
    if (all && !o.visible) { o.visible = true; undo.push(() => { o.visible = false }) }
  })
  try { renderer.render(scene, camera) } finally { undo.forEach((f) => f()) }
}
