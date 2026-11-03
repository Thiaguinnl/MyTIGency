import { launch, newPage, waitReady, sleep, state, wheel, instrument, BASE } from './lib.mjs'
const rate = Number(process.argv[2] || 1)
const browser = await launch()
const { page, log, ctx } = await newPage(browser)
await instrument(page)
if (process.argv[3] === 'ab') await page.addInitScript(() => {
  const orig = CSSStyleDeclaration.prototype.setProperty
  CSSStyleDeclaration.prototype.setProperty = function (k, v, p) {
    if ((k === '--chrome-push' || k === '--dock-t') && this === document.documentElement.style) { for (const el of document.querySelectorAll('header, .marquee')) orig.call(el.style, k, v, p); return }
    return orig.call(this, k, v, p)
  }
})
await page.goto(BASE + '/'); await waitReady(page); await sleep(800)
await page.mouse.move(800, 450)
const H = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight)
// para logo antes do footer começar a aparecer (2 telas antes do fim)
await page.evaluate((y) => window.scrollTo(0, y), H - 2600); await sleep(300); await wheel(page, 50, 2); await sleep(2500)
const cdp = await page.context().newCDPSession(page)
if (rate > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate })
const events = []
cdp.on('Tracing.dataCollected', (e) => events.push(...e.value))
const done = new Promise((r) => cdp.once('Tracing.tracingComplete', r))
await cdp.send('Tracing.start', { categories: 'devtools.timeline,disabled-by-default-devtools.timeline', transferMode: 'ReportEvents' })
await page.evaluate(() => window.__recStart())
for (let i = 0; i < 16; i++) { await wheel(page, 220, 3, 16); }
await sleep(1500)
const fr = await page.evaluate(() => window.__recStop())
await cdp.send('Tracing.end'); await done
const by = {}
for (const e of events) {
  if (e.ph !== 'X' && e.ph !== 'B') continue
  if (!['UpdateLayoutTree', 'Layout', 'Paint', 'PrePaint', 'Layerize', 'FunctionCall', 'EvaluateScript', 'RunTask'].includes(e.name)) continue
  by[e.name] ??= { n: 0, ms: 0, max: 0, el: 0 }
  const d = (e.dur || 0) / 1000
  by[e.name].n++; by[e.name].ms += d; by[e.name].max = Math.max(by[e.name].max, d)
  if (e.name === 'UpdateLayoutTree') by[e.name].el = Math.max(by[e.name].el, e.args?.elementCount ?? 0)
}
console.log(`CPU ${rate}x — rolando até o footer:`, JSON.stringify(fr))
for (const [k, v] of Object.entries(by)) console.log(`  ${k.padEnd(16)} n=${v.n} total=${v.ms.toFixed(0)}ms max=${v.max.toFixed(1)}ms${v.el ? ` maxElements=${v.el}` : ''}`)
// quantos estilos recalculados com elementCount grande
const big = events.filter((e) => e.name === 'UpdateLayoutTree' && (e.args?.elementCount ?? 0) > 500)
console.log('  recalcs de estilo com >500 elementos:', big.length, 'soma ms:', (big.reduce((a, e) => a + (e.dur || 0), 0) / 1000).toFixed(0))
console.log('  estado final', await state(page))
await ctx.close(); await browser.close()
