import { launch, newPage, waitReady, sleep, BASE } from './lib.mjs'
const browser = await launch()
const { page, log } = await newPage(browser)
const reqs = []
page.on('response', async (r) => { try { const b = (await r.body()).length; reqs.push({ url: r.url(), type: r.request().resourceType(), b, t: Date.now() }) } catch {} })
const t0 = Date.now()
await page.goto(BASE + '/')
const readyMs = await waitReady(page)
console.log('ready em ms', Date.now() - t0)
await sleep(1500)
const info = await page.evaluate(() => {
  const cvs = [...document.querySelectorAll('canvas')]
  const gl = cvs.filter((c) => { try { return !!(c.getContext('webgl2') || c.getContext('webgl')) && false } catch { return false } }).length
  return {
    nodes: document.getElementsByTagName('*').length,
    canvases: cvs.length,
    canvasList: cvs.map((c) => `${c.className || c.parentElement?.className}:${c.width}x${c.height}`),
    st: window.ScrollTrigger?.getAll?.().length,
    docH: document.documentElement.scrollHeight,
    gpu: (() => { const g = document.createElement('canvas').getContext('webgl'); const e = g?.getExtension('WEBGL_debug_renderer_info'); return e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : '?' })(),
    fontsLoaded: [...document.fonts].filter((f) => f.status === 'loaded').map((f) => `${f.family} ${f.weight} ${f.style}`).length,
    fontFaces: document.fonts.size,
  }
})
console.log(JSON.stringify(info, null, 1))
const byType = {}
for (const r of reqs) { byType[r.type] ??= { n: 0, kb: 0 }; byType[r.type].n++; byType[r.type].kb += r.b / 1024 }
console.log('transfer por tipo (até ready+1.5s):', Object.fromEntries(Object.entries(byType).map(([k, v]) => [k, `${v.n} req, ${v.kb.toFixed(0)} KB`])))
console.log('fontes:', reqs.filter((r) => r.type === 'font').length, (reqs.filter((r) => r.type === 'font').reduce((a, r) => a + r.b, 0) / 1024).toFixed(0), 'KB')
console.log('maiores:', reqs.sort((a, b) => b.b - a.b).slice(0, 15).map((r) => `${(r.b / 1024).toFixed(0)}KB ${r.url.split('/').pop().slice(0, 60)}`).join('\n'))
console.log('LOG:', log.join('\n'))
await browser.close()
