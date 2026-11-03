// Fotos de referência da transição em pontos fixos (para comparar antes × depois).
// As animações CSS e o rAF de tempo real são congelados só para a foto ser determinística.
// uso: node compare.mjs --tag antes | --tag depois [--diff antes]
import { chromium } from 'file:///C:/Users/thiag/Desktop/myti/MyTIGency/MyTIgency/node_modules/playwright/index.mjs'
import { mkdirSync, existsSync } from 'node:fs'

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d }
const TAG = arg('--tag', 'antes'), DIFF = arg('--diff', '')
const DIR = 'C:/Users/thiag/Desktop/myti/MyTIGency/MyTIgency/docs/debug-transicao-pc/saida/cmp'
mkdirSync(`${DIR}/${TAG}`, { recursive: true })
const PC_AT = 21200
const POINTS = { cartaz: 330, tranco: 560, dither: 900, cor: 1450, popups: 1900, zoom: 2300, lampada: 2900, mesa: 3500, inclina: 4300, folha: 4900 }

const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--use-angle=d3d11'] })
const ctx = await browser.newContext({ viewport: { width: 1700, height: 900 }, deviceScaleFactor: 1 })
const page = await ctx.newPage()
await page.addInitScript(() => { Math.random = () => 0.7 }) // LED do HD e afins: sempre o mesmo
await page.goto('http://localhost:5174/')
await page.waitForTimeout(7000)
await page.mouse.move(1650, 880)
for (let y = PC_AT - 2500; y <= PC_AT; y += 400) { await page.evaluate((y) => scrollTo(0, y), y); await page.waitForTimeout(450) }
for (const [name, dy] of Object.entries(POINTS)) {
  // chega devagar (os eventos de tempo real disparam como num scroll normal) e espera assentar
  const from = await page.evaluate(() => scrollY)
  const to = PC_AT + dy
  for (let k = 1; k <= 6; k++) { await page.evaluate((y) => scrollTo(0, y), from + ((to - from) * k) / 6); await page.waitForTimeout(250) }
  await page.waitForTimeout(3500)
  // congela animações CSS (faixa, ruído, grão, cintilação) na mesma fase
  await page.addStyleTag({ content: '*,*::before,*::after{animation-play-state:paused!important;animation-delay:0s!important}' })
  await page.evaluate(() => document.getAnimations().forEach((a) => { try { a.pause(); a.currentTime = 0 } catch {} }))
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${DIR}/${TAG}/${name}.png` })
  await page.evaluate(() => { document.querySelectorAll('style').forEach((s) => { if (s.textContent.includes('animation-play-state:paused')) s.remove() }); document.getAnimations().forEach((a) => { try { a.play() } catch {} }) })
}
console.log('fotos em', `${DIR}/${TAG}`)

if (DIFF && existsSync(`${DIR}/${DIFF}`)) {
  const ana = await (await browser.newContext()).newPage()
  const { readFileSync, writeFileSync } = await import('node:fs')
  for (const name of Object.keys(POINTS)) {
    const a = readFileSync(`${DIR}/${DIFF}/${name}.png`).toString('base64'), b = readFileSync(`${DIR}/${TAG}/${name}.png`).toString('base64')
    const r = await ana.evaluate(async ([a, b]) => {
      const load = async (s) => { const i = new Image(); i.src = 'data:image/png;base64,' + s; await i.decode(); return i }
      const [ia, ib] = await Promise.all([load(a), load(b)])
      const W = ia.width, H = ia.height, c = document.createElement('canvas'); c.width = W; c.height = H
      const x = c.getContext('2d', { willReadFrequently: true })
      x.drawImage(ia, 0, 0); const da = x.getImageData(0, 0, W, H).data
      x.drawImage(ib, 0, 0); const db = x.getImageData(0, 0, W, H).data
      const out = x.createImageData(W, H); let sum = 0, big = 0, max = 0
      for (let k = 0; k < da.length; k += 4) {
        const d = Math.max(Math.abs(da[k] - db[k]), Math.abs(da[k + 1] - db[k + 1]), Math.abs(da[k + 2] - db[k + 2]))
        sum += d; if (d > 24) big++; if (d > max) max = d
        out.data[k] = Math.min(255, d * 4); out.data[k + 1] = 0; out.data[k + 2] = 0; out.data[k + 3] = 255
      }
      x.putImageData(out, 0, 0)
      return { mean: sum / (W * H), bigPct: (100 * big) / (W * H), max, png: c.toDataURL('image/png').split(',')[1] }
    }, [a, b])
    writeFileSync(`${DIR}/${TAG}/diff-${name}.png`, Buffer.from(r.png, 'base64'))
    console.log(name.padEnd(9), `dif. média ${r.mean.toFixed(2)}  px com dif.>24: ${r.bigPct.toFixed(2)}%  máx ${r.max}`)
  }
}
await browser.close()
