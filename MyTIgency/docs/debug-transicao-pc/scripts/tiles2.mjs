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
const CSS = arg('--css', ''); if (CSS) await page.addStyleTag({ content: CSS })
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
const pick=['RasterTask','cc::Tile:deleted','GpuImageDecodeCache::EnsureCapacity','PictureLayer::Update','TileManager::CreateRasterTask'];console.log(arg('--tag','base').padEnd(10), pick.map(k=>k.replace('GpuImageDecodeCache::','')+'='+(evn[k]||0)).join('  '))
await browser.close()
