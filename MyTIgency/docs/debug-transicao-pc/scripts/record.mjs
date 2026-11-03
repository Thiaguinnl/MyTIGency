// Grava os quadros do compositor (screencast) durante scroll rápido de vai-e-volta
// na fase escura do PC, e mede blocos "chapados" (ladrilho sem raster) em cada quadro.
// uso: node record.mjs [--headed] [--tag nome] [--css "regra css de teste"]
import { chromium } from 'file:///C:/Users/thiag/Desktop/myti/MyTIGency/MyTIgency/node_modules/playwright/index.mjs'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d }
const TAG = arg('--tag', 'base')
const CSS = arg('--css', '')
const JS = arg('--js', '')
const OUT = `C:/Users/thiag/Desktop/myti/MyTIGency/MyTIgency/docs/debug-transicao-pc/saida/out-${TAG}`
rmSync(OUT, { recursive: true, force: true }); mkdirSync(OUT, { recursive: true })
const PC_AT = Number(arg('--pc', 21200))

const browser = await chromium.launch({
  channel: 'chrome', headless: !process.argv.includes('--headed'),
  args: ['--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--use-angle=d3d11'],
})
const page = await browser.newPage({ viewport: { width: 1700, height: 900 }, deviceScaleFactor: 1 })
await page.goto('http://localhost:5174/')
await page.waitForTimeout(7000)
if (CSS) await page.addStyleTag({ content: CSS })
if (JS) await page.evaluate(JS)
// entra no PC devagar (monta a cena, sem pressa), e para no começo da fase escura
for (let y = PC_AT - 2500; y <= PC_AT + 600; y += 400) { await page.evaluate((y) => scrollTo(0, y), y); await page.waitForTimeout(500) }
await page.waitForTimeout(2500)
await page.mouse.move(850, 450)

const cdp = await page.context().newCDPSession(page)
const frames = []
cdp.on('Page.screencastFrame', async (f) => {
  frames.push({ t: f.metadata.timestamp, y: f.metadata.scrollOffsetY, data: f.data })
  try { await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }) } catch {}
})
await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 90, everyNthFrame: 1, maxWidth: 1700, maxHeight: 900 })

// vai-e-volta rápido com a roda (o Lenis trata a roda), dentro da fase escura
const t0 = Date.now()
for (let rep = 0; rep < 4; rep++) {
  for (let i = 0; i < 14; i++) { await page.mouse.wheel(0, 260); await page.waitForTimeout(16) }
  await page.waitForTimeout(250)
  for (let i = 0; i < 14; i++) { await page.mouse.wheel(0, -260); await page.waitForTimeout(16) }
  await page.waitForTimeout(250)
}
await page.waitForTimeout(1500)
await cdp.send('Page.stopScreencast')
console.log('quadros:', frames.length, 'em', ((Date.now() - t0) / 1000).toFixed(1), 's')

// análise numa aba à parte, em lotes: por quadro, blocos de 64 px chapados (desvio ~0)
const ana = await (await browser.newContext()).newPage()
const analyze = (list) => ana.evaluate(async (list) => {
  const B = 64
  const out = []
  const cv = document.createElement('canvas'); const cx = cv.getContext('2d', { willReadFrequently: true })
  for (const src of list) {
    const img = new Image(); img.src = 'data:image/jpeg;base64,' + src
    await img.decode()
    cv.width = img.width; cv.height = img.height
    cx.drawImage(img, 0, 0)
    const d = cx.getImageData(0, 0, cv.width, cv.height).data
    let flat = 0, total = 0
    const flatColors = {}
    for (let by = 2; by < Math.floor(cv.height / B) - 1; by++) for (let bx = 0; bx < Math.floor(cv.width / B); bx++) {
      let s = 0, s2 = 0, n = 0, r0 = 0, g0 = 0, b0 = 0
      for (let y = by * B; y < by * B + B; y += 4) for (let x = bx * B; x < bx * B + B; x += 4) {
        const k = (y * cv.width + x) * 4; const l = d[k] * 0.3 + d[k + 1] * 0.59 + d[k + 2] * 0.11
        s += l; s2 += l * l; n++; r0 = d[k]; g0 = d[k + 1]; b0 = d[k + 2]
      }
      const m = s / n, sd = Math.sqrt(Math.max(0, s2 / n - m * m))
      total++
      if (sd < 1.2) { flat++; const key = `${r0},${g0},${b0}`; flatColors[key] = (flatColors[key] || 0) + 1 }
    }
    out.push({ flat, total, colors: Object.entries(flatColors).sort((a, b) => b[1] - a[1]).slice(0, 3) })
  }
  return out
}, list)
const stats = []
for (let i = 0; i < frames.length; i += 25) stats.push(...await analyze(frames.slice(i, i + 25).map((f) => f.data)))

const rows = frames.map((f, i) => ({ i, t: +(f.t - frames[0].t).toFixed(3), y: Math.round(f.y), ...stats[i] }))
writeFileSync(`${OUT}/stats.json`, JSON.stringify(rows, null, 1))
// os quadros com mais blocos chapados que os vizinhos (ladrilho que some por um quadro)
const spikes = rows.filter((r, i) => i > 0 && i < rows.length - 1 && r.flat - Math.max(rows[i - 1].flat, rows[i + 1].flat) >= 4)
console.log('blocos chapados por quadro (mín/med/máx):', Math.min(...rows.map((r) => r.flat)), Math.round(rows.reduce((a, r) => a + r.flat, 0) / rows.length), Math.max(...rows.map((r) => r.flat)))
console.log('picos (quadro: chapados, cores):', spikes.length)
for (const s of spikes.slice(0, 25)) console.log(` #${s.i} t=${s.t}s y=${s.y} flat=${s.flat}`, JSON.stringify(s.colors))
// salva os picos e os vizinhos para olhar
for (const s of spikes.slice(0, 12)) for (const j of [s.i - 1, s.i, s.i + 1]) writeFileSync(`${OUT}/f${String(j).padStart(4, '0')}.jpg`, Buffer.from(frames[j].data, 'base64'))
// e alguns quadros comuns, espaçados, para comparar
for (let j = 0; j < frames.length; j += Math.ceil(frames.length / 8)) writeFileSync(`${OUT}/n${String(j).padStart(4, '0')}.jpg`, Buffer.from(frames[j].data, 'base64'))
await browser.close()
