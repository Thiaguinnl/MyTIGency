// Registra, dentro da página, cada escrita no transform do rig (com a pilha de quem
// escreveu) e o scroll a cada rAF; acha saltos de escala (o PC "pula" de tamanho)
import { chromium } from 'file:///C:/Users/thiag/Desktop/myti/MyTIGency/MyTIgency/node_modules/playwright/index.mjs'

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d }
const PC_AT = 21200, FROM = Number(arg('--from', 600)), STEP = 120, N = 13
const browser = await chromium.launch({ channel: 'chrome', headless: !process.argv.includes('--headed'), args: ['--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--use-angle=d3d11', '--window-size=1716,1040'] })
const ctx = await browser.newContext({ viewport: { width: 1700, height: 900 }, deviceScaleFactor: 1 })
const page = await ctx.newPage()
await page.goto('http://localhost:5174/')
await page.waitForTimeout(7000)
for (let y = PC_AT - 2500; y <= PC_AT + FROM; y += 400) { await page.evaluate((y) => scrollTo(0, y), y); await page.waitForTimeout(450) }
await page.evaluate((y) => scrollTo(0, y), PC_AT + FROM)
await page.waitForTimeout(3000)
await page.mouse.move(300, 300)

await page.evaluate(() => {
  const rig = document.querySelector('.pc-rig')
  const log = (window.__log = [])
  let frame = 0
  ;(function f() { frame++; requestAnimationFrame(f) })()
  // cada escrita no style.transform do rig: quando, em que quadro, o valor e quem chamou
  const desc = Object.getOwnPropertyDescriptor(CSSStyleDeclaration.prototype, 'transform')
  const st = rig.style
  Object.defineProperty(st, 'transform', {
    configurable: true,
    get() { return desc.get.call(this) },
    set(v) {
      const m = /scale\(([\d.]+)\)\s*$/.exec(v)
      log.push({ t: performance.now(), frame, y: scrollY, k: m ? +m[1] : null, ov: v.startsWith('translate(') && v.includes(') translate(') ? 1 : 0, who: (new Error().stack.split('\n')[2] || '').trim().slice(0, 90) })
      desc.set.call(this, v)
    },
  })
})
for (let rep = 0; rep < 5; rep++) {
  for (let i = 0; i < N; i++) { await page.mouse.wheel(0, STEP); await page.waitForTimeout(16) }
  await page.waitForTimeout(200)
  for (let i = 0; i < N; i++) { await page.mouse.wheel(0, -STEP); await page.waitForTimeout(16) }
  await page.waitForTimeout(200)
}
await page.waitForTimeout(1200)
const log = await page.evaluate(() => window.__log)
console.log('escritas no rig:', log.length, 'quadros cobertos:', log.at(-1).frame - log[0].frame)
// mais de uma escrita no mesmo quadro?
const perFrame = {}
for (const e of log) (perFrame[e.frame] ||= []).push(e)
const multi = Object.values(perFrame).filter((a) => a.length > 1)
console.log('quadros com 2+ escritas no rig:', multi.length)
for (const a of multi.slice(0, 5)) console.log(' ', a.map((e) => `k=${e.k?.toFixed(4)} ← ${e.who}`).join('  |  '))
// saltos: escala que vai e volta (pico) em quadros seguidos
const ks = log.map((e) => e.k)
const jumps = []
for (let i = 1; i < log.length - 1; i++) {
  const a = Math.log(ks[i - 1]), b = Math.log(ks[i]), c = Math.log(ks[i + 1])
  if (Math.abs(b - a) > 0.06 && Math.abs(b - c) > 0.06 && Math.sign(b - a) === Math.sign(b - c)) jumps.push(i)
}
console.log('picos de escala (vai e volta):', jumps.length)
for (const i of jumps.slice(0, 12)) {
  const s = log.slice(i - 2, i + 3)
  console.log(s.map((e) => `[f${e.frame} y${Math.round(e.y)} k${e.k?.toFixed(3)}]`).join(' '), '←', log[i].who)
}
// os passos de escala mais bruscos entre escritas seguidas
const steps = log.slice(1).map((e, i) => ({ i: i + 1, d: Math.abs(Math.log(e.k / log[i].k)), dy: e.y - log[i].y, df: e.frame - log[i].frame }))
steps.sort((a, b) => b.d - a.d)
console.log('maiores passos de escala:', steps.slice(0, 8).map((s) => `Δln k=${s.d.toFixed(3)} Δy=${s.dy} Δquadro=${s.df}`).join(' | '))
await browser.close()
