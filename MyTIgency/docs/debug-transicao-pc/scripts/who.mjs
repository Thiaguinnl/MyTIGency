// Atribui o churn de raster a camadas: RasterTask/PictureLayer::Update por layer id,
// casado com o elemento do DOM pela árvore de camadas (LayerTree)
import { chromium } from 'file:///C:/Users/thiag/Desktop/myti/MyTIGency/MyTIgency/node_modules/playwright/index.mjs'

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d }
const AT = Number(arg('--at', 1500)), PC_AT = 21200
const browser = await chromium.launch({ channel: 'chrome', headless: !process.argv.includes('--headed'), args: ['--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--use-angle=d3d11', '--window-size=1716,1040'] })
const ctx = await browser.newContext({ viewport: { width: 1700, height: 900 }, deviceScaleFactor: 1 })
const page = await ctx.newPage()
await page.goto('http://localhost:5174/')
await page.waitForTimeout(7000)
const CSS = arg('--css', ''); if (CSS) await page.addStyleTag({ content: CSS })
for (let y = PC_AT - 2500; y <= PC_AT + AT; y += 300) { await page.evaluate((y) => scrollTo(0, y), y); await page.waitForTimeout(400) }
await page.waitForTimeout(3000)

const cdp = await ctx.newCDPSession(page)
await cdp.send('DOM.enable'); await cdp.send('LayerTree.enable')
let layers = []
cdp.on('LayerTree.layerTreeDidChange', (e) => { if (e.layers) layers = e.layers })
const events = []
cdp.on('Tracing.dataCollected', (e) => events.push(...e.value))
const done = new Promise((r) => cdp.once('Tracing.tracingComplete', r))
await cdp.send('Tracing.start', { traceConfig: { includedCategories: ['disabled-by-default-cc.debug', 'cc', 'disabled-by-default-devtools.timeline', 'devtools.timeline'], recordMode: 'recordUntilFull' }, transferMode: 'ReportEvents' })
if (process.argv.includes('--still')) await page.waitForTimeout(720); else for (let i = 0; i < 6; i++) { await page.mouse.wheel(0, 60); await page.waitForTimeout(120) }
await page.waitForTimeout(800)
await cdp.send('Tracing.end'); await done

const one = (n) => events.find((e) => e.name === n && e.args && Object.keys(e.args).length)
for (const n of ['RasterTask', 'PictureLayer::Update', 'UpdateLayer', 'Paint', 'PaintImage', 'Decode Image']) {
  const e = one(n); if (e) console.log(n, '→', JSON.stringify(e.args).slice(0, 300))
}
// agrega por layer id onde houver
const byLayer = {}
const lid = (e) => e.args?.layerId ?? e.args?.layer_id ?? e.args?.data?.layerId ?? e.args?.tileData?.layerId ?? e.args?.tile_data?.layer_id
for (const e of events) {
  if (!['RasterTask', 'PictureLayer::Update', 'UpdateLayer', 'Paint'].includes(e.name)) continue
  const id = lid(e); if (id === undefined) continue
  const k = `${id}`; (byLayer[k] ||= {}); byLayer[k][e.name] = (byLayer[k][e.name] || 0) + 1
}
const names = {}
for (const l of layers) {
  let name = ''
  if (l.backendNodeId) { try { const { node } = await cdp.send('DOM.describeNode', { backendNodeId: l.backendNodeId }); const i = node.attributes?.indexOf('class') ?? -1; name = `${node.localName}${i >= 0 ? '.' + node.attributes[i + 1] : ''}` } catch {} }
  names[l.layerId] = `${name || '(sem nó)'} ${l.width}x${l.height}`
}
const rows = Object.entries(byLayer).map(([id, c]) => ({ id, ...c, tot: Object.values(c).reduce((a, b) => a + b, 0) })).sort((a, b) => b.tot - a.tot)
console.log('camadas com atividade:', rows.length)
console.log("TOTAL RasterTask", rows.reduce((a, r) => a + (r.RasterTask || 0), 0)); for (const r of rows.slice(0, 12)) console.log(JSON.stringify(r).slice(0, 110).padEnd(110), names[r.id] ?? '?')
await browser.close()
