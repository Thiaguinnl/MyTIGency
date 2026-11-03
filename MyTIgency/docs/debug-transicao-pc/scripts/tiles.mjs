// Trace do compositor (cc) na fase escura: por camada, escala ideal × escala de raster
// e número de ladrilhos; e o orçamento/uso de memória de ladrilhos.
import { chromium } from 'file:///C:/Users/thiag/Desktop/myti/MyTIGency/MyTIgency/node_modules/playwright/index.mjs'
import { writeFileSync } from 'node:fs'

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d }
const DPR = Number(arg('--dpr', 1)), AT = Number(arg('--at', 1500)), PC_AT = 21200
const browser = await chromium.launch({ channel: 'chrome', headless: !process.argv.includes('--headed'), args: ['--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--use-angle=d3d11', '--window-size=1716,1040'] })
const ctx = await browser.newContext({ viewport: { width: 1700, height: 900 }, deviceScaleFactor: DPR })
const page = await ctx.newPage()
await page.goto('http://localhost:5174/')
await page.waitForTimeout(7000)
for (let y = PC_AT - 2500; y <= PC_AT + AT; y += 300) { await page.evaluate((y) => scrollTo(0, y), y); await page.waitForTimeout(400) }
await page.waitForTimeout(3000)

const cdp = await ctx.newCDPSession(page)
const events = []
cdp.on('Tracing.dataCollected', (e) => events.push(...e.value))
const done = new Promise((r) => cdp.once('Tracing.tracingComplete', r))
await cdp.send('Tracing.start', { traceConfig: { includedCategories: ['disabled-by-default-cc.debug', 'cc', 'disabled-by-default-devtools.timeline.layers', 'disabled-by-default-devtools.timeline.frame', 'disabled-by-default-devtools.timeline', 'disabled-by-default-cc.debug.quads', 'viz'], recordMode: 'recordUntilFull' }, transferMode: 'ReportEvents' })
// um pouco de scroll, para o compositor desenhar
for (let i = 0; i < 6; i++) { await page.mouse.wheel(0, 60); await page.waitForTimeout(120) }
await page.waitForTimeout(800)
await cdp.send('Tracing.end')
await done
const evn = {}
for (const e of events) evn[e.name] = (evn[e.name] || 0) + 1
console.log('eventos (top):', Object.entries(evn).sort((a, b) => b[1] - a[1]).slice(0, 25).map(([k, v]) => `${k}:${v}`).join(', '))
const snaps = events.filter((e) => e.ph === 'O' && e.args?.snapshot)
const names = {}
for (const s of snaps) names[s.name] = (names[s.name] || 0) + 1
console.log('objetos no trace:', JSON.stringify(names))
// o último estado de cada PictureLayerImpl
const pli = {}
for (const s of snaps.filter((s) => s.name === 'cc::PictureLayerImpl')) pli[s.id] = s.args.snapshot
const rows = Object.values(pli).map((l) => {
  const til = l.tilings ?? []
  const tiles = til.reduce((a, t) => a + (t.num_tiles ?? 0), 0)
  return {
    id: l.layer_id, name: (l.debug_info?.layer_name ?? l.layer_name ?? '').slice(0, 44),
    bounds: l.bounds ? `${l.bounds.width}x${l.bounds.height}` : '?',
    ideal: l.ideal_contents_scale?.toFixed?.(3), raster: (l.raster_contents_scale ?? til[0]?.content_scale)?.toFixed?.(3),
    tilings: til.map((t) => `${(+t.content_scale).toFixed(2)}:${t.num_tiles}`).join(' '), tiles,
  }
}).sort((a, b) => b.tiles - a.tiles)
console.log('camadas com ladrilhos:', rows.length, 'ladrilhos no total:', rows.reduce((a, r) => a + r.tiles, 0))
for (const r of rows.slice(0, 18)) console.log(`${String(r.tiles).padStart(5)} lad. | ${r.bounds.padEnd(11)} | ideal ${r.ideal} raster ${r.raster} | ${r.tilings.slice(0, 40).padEnd(40)} | ${r.name}`)
const tm = snaps.filter((s) => /TileManager|GlobalStateThatImpactsTilePriority|LayerTreeHostImpl/.test(s.name)).at(-1)
if (tm) writeFileSync('C:/Users/thiag/Desktop/myti/MyTIGency/MyTIgency/docs/debug-transicao-pc/saida/lthi.json', JSON.stringify(tm.args.snapshot, null, 1).slice(0, 400000))
await browser.close()
