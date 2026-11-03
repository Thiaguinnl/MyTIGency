// Grava os quadros do compositor durante scroll rápido de vai-e-volta na FASE ESCURA
// do PC e acha "piscadas": blocos que mudam por exatamente um quadro e voltam (A→B→A).
// uso: node record2.mjs [--headed] [--tag nome] [--css "..."] [--js "..."] [--from 600 --span 1600]
import { chromium } from 'file:///C:/Users/thiag/Desktop/myti/MyTIGency/MyTIgency/node_modules/playwright/index.mjs'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d }
const TAG = arg('--tag', 'dark')
const CSS = arg('--css', '')
const JS = arg('--js', '')
const PC_AT = Number(arg('--pc', 21200))
const FROM = Number(arg('--from', 600)) // px depois de o PC ligar (≈ T 0,1)
const STEP = Number(arg('--step', 120)) // px por "tique" da roda
const N = Number(arg('--n', 13))
const OUT = `C:/Users/thiag/Desktop/myti/MyTIGency/MyTIgency/docs/debug-transicao-pc/saida/out-${TAG}`
rmSync(OUT, { recursive: true, force: true }); mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({
  channel: 'chrome', headless: !process.argv.includes('--headed'),
  args: ['--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--use-angle=d3d11', '--window-size=1716,1040',
    ...(arg('--gpumem') ? [`--force-gpu-mem-available-mb=${arg('--gpumem')}`] : [])],
})
const ctx = await browser.newContext({ viewport: { width: 1700, height: 900 }, deviceScaleFactor: Number(arg('--dpr', 1)) })
const page = await ctx.newPage()
const URL = arg('--url', '')
await page.goto(URL || 'http://localhost:5174/')
await page.waitForTimeout(7000)
if (CSS) await page.addStyleTag({ content: CSS })
if (JS) await page.evaluate(JS)
if (URL) { await page.evaluate((y) => scrollTo(0, y), Number(arg('--start', 600))); await page.waitForTimeout(3000) }
else {
  for (let y = PC_AT - 2500; y <= PC_AT + FROM; y += 400) { await page.evaluate((y) => scrollTo(0, y), y); await page.waitForTimeout(450) }
  await page.evaluate((y) => scrollTo(0, y), PC_AT + FROM)
  await page.waitForTimeout(3000)
}
if (arg('--cpu')) { const c0 = await ctx.newCDPSession(page); await c0.send('Emulation.setCPUThrottlingRate', { rate: Number(arg('--cpu')) }) }
await page.mouse.move(300, 300)

const cdp = await ctx.newCDPSession(page)
const frames = []
cdp.on('Page.screencastFrame', async (f) => {
  frames.push({ t: f.metadata.timestamp, y: f.metadata.scrollOffsetY, data: f.data })
  try { await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }) } catch {}
})
await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, everyNthFrame: 1 })
for (let rep = 0; rep < 5; rep++) {
  for (let i = 0; i < N; i++) { await page.mouse.wheel(0, STEP); await page.waitForTimeout(16) }
  await page.waitForTimeout(200)
  for (let i = 0; i < N; i++) { await page.mouse.wheel(0, -STEP); await page.waitForTimeout(16) }
  await page.waitForTimeout(200)
}
await page.waitForTimeout(1200)
await cdp.send('Page.stopScreencast')
const inv = frames.filter((f, i) => i > 0 && f.t < frames[i - 1].t).length; console.log("quadros fora de ordem (timestamp):", inv, "y fora de ordem vs vizinhos:", frames.filter((f, i) => i > 0 && i < frames.length - 1 && Math.sign(f.y - frames[i - 1].y) * Math.sign(f.y - frames[i + 1].y) > 0 && Math.abs(f.y - frames[i - 1].y) > 40).length)
const info = await page.evaluate(() => ({ y: scrollY, lit: document.querySelector('.ma-pc')?.style.getPropertyValue('--lamp') }))
console.log('quadros:', frames.length, 'fim:', JSON.stringify(info), 'y min/máx:', Math.min(...frames.map((f) => f.y)) | 0, Math.max(...frames.map((f) => f.y)) | 0)

// médias de luminância por bloco de 32 px, por quadro
const ana = await (await browser.newContext()).newPage()
const means = []
for (let i = 0; i < frames.length; i += 30) {
  means.push(...await ana.evaluate(async (list) => {
    const B = 32, res = []
    const cv = document.createElement('canvas'); const cx = cv.getContext('2d', { willReadFrequently: true })
    for (const src of list) {
      const img = new Image(); img.src = 'data:image/jpeg;base64,' + src; await img.decode()
      cv.width = img.width; cv.height = img.height; cx.drawImage(img, 0, 0)
      const d = cx.getImageData(0, 0, cv.width, cv.height).data
      const W = Math.floor(cv.width / B), H = Math.floor(cv.height / B), m = new Float32Array(W * H)
      for (let by = 0; by < H; by++) for (let bx = 0; bx < W; bx++) {
        let s = 0, n = 0
        for (let y = by * B; y < by * B + B; y += 2) for (let x = bx * B; x < bx * B + B; x += 2) { const k = (y * cv.width + x) * 4; s += d[k] * 0.3 + d[k + 1] * 0.59 + d[k + 2] * 0.11; n++ }
        m[by * W + bx] = s / n
      }
      res.push({ W, H, m: Array.from(m, (v) => Math.round(v)) })
    }
    return res
  }, frames.slice(i, i + 30).map((f) => f.data)))
}
// piscada: |f(i) − f(i−1)| e |f(i) − f(i+1)| grandes, |f(i−1) − f(i+1)| pequeno
const blinks = []
for (let i = 1; i < means.length - 1; i++) {
  const a = means[i - 1].m, b = means[i].m, c = means[i + 1].m, W = means[i].W
  const hits = []
  for (let k = 0; k < b.length; k++) if (Math.abs(b[k] - a[k]) > 22 && Math.abs(b[k] - c[k]) > 22 && Math.abs(a[k] - c[k]) < 10) hits.push(k)
  if (hits.length >= 3) {
    const xs = hits.map((k) => k % W), ys = hits.map((k) => Math.floor(k / W))
    const dir = hits.reduce((s, k) => s + Math.sign(b[k] - a[k]), 0) > 0 ? 'clareia' : 'escurece'
    blinks.push({ i, y: Math.round(frames[i].y), n: hits.length, dir, box: [Math.min(...xs) * 32, Math.min(...ys) * 32, (Math.max(...xs) + 1) * 32, (Math.max(...ys) + 1) * 32] })
  }
}
console.log('piscadas (quadro, y, blocos 32px, sentido, caixa x0,y0,x1,y1):', blinks.length)
for (const b of blinks.slice(0, 30)) console.log(` #${b.i} y=${b.y} n=${b.n} ${b.dir} box=${b.box}`)
writeFileSync(`${OUT}/blinks.json`, JSON.stringify(blinks, null, 1))
for (const b of blinks.slice(0, 10)) for (const j of [b.i - 1, b.i, b.i + 1]) writeFileSync(`${OUT}/f${String(j).padStart(4, '0')}.jpg`, Buffer.from(frames[j].data, 'base64'))
await browser.close()
