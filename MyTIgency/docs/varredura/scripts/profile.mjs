import { launch, newPage, waitReady, sleep, BASE } from './lib.mjs'
import { where } from './resolve.mjs'
const browser = await launch()
const { page, ctx } = await newPage(browser)
const cdp = await page.context().newCDPSession(page)
await cdp.send('Profiler.enable')
await cdp.send('Profiler.setSamplingInterval', { interval: 200 })
await cdp.send('Profiler.start')
// trace também, para tempo de GPU/compilação e estilo
const events = []
cdp.on('Tracing.dataCollected', (e) => events.push(...e.value))
const done = new Promise((r) => cdp.once('Tracing.tracingComplete', r))
await cdp.send('Tracing.start', { categories: 'devtools.timeline,v8,disabled-by-default-devtools.timeline', transferMode: 'ReportEvents' })
await page.goto(BASE + '/')
await waitReady(page, 30000); await sleep(500)
const { profile } = await cdp.send('Profiler.stop')
await cdp.send('Tracing.end'); await done
// self time por função
const byId = new Map(profile.nodes.map((n) => [n.id, n]))
const self = new Map()
const dt = profile.timeDeltas
profile.samples.forEach((id, i) => { const n = byId.get(id); const f = n.callFrame; const file = f.url.split('/').pop(); const key = /HomePage|Footer|main-/.test(file) ? where(file, f.lineNumber, f.columnNumber) : (f.functionName || '(anon)') + ' ' + file; self.set(key, (self.get(key) || 0) + (dt[i] || 0) / 1000) })
console.log('TOP self-time (ms) até liberar a página:')
;[...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25).forEach(([k, v]) => console.log(`  ${v.toFixed(0).padStart(6)}  ${k.slice(0, 120)}`))
// total (inclusive) por função "raiz" do nosso código: soma dos ticks com a função na pilha
const parent = new Map(); profile.nodes.forEach((n) => (n.children || []).forEach((c) => parent.set(c, n.id)))
const incl = new Map()
profile.samples.forEach((id, i) => { const seen = new Set(); for (let n = id; n; n = parent.get(n)) { const f = byId.get(n).callFrame; if (!/assets\/(HomePage|main|Footer)/.test(f.url)) continue; const key = where(f.url.split('/').pop(), f.lineNumber, f.columnNumber); if (seen.has(key)) continue; seen.add(key); incl.set(key, (incl.get(key) || 0) + (dt[i] || 0) / 1000) } })
console.log('TOP inclusivo (ms) — funções do bundle:')
;[...incl.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30).forEach(([k, v]) => console.log(`  ${v.toFixed(0).padStart(6)}  ${k}`))
const sum = (name) => events.filter((e) => e.name === name).reduce((a, e) => a + (e.dur || 0), 0) / 1000
console.log('trace:', ['UpdateLayoutTree', 'Layout', 'Paint', 'v8.compile', 'v8.parseOnBackground', 'Decode Image', 'ImageDecodeTask', 'GPUTask', 'FunctionCall', 'EvaluateScript'].map((n) => `${n}=${sum(n).toFixed(0)}`).join(' '))
await ctx.close(); await browser.close()
