import { launch, newPage, waitReady, sleep, BASE } from './lib.mjs'
const browser = await launch()
for (const path of ['/', '/contato']) {
  const { page } = await newPage(browser)
  // conta contextos WebGL criados
  await page.addInitScript(() => {
    window.__gl = []
    const orig = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function (type, ...a) {
      const c = orig.call(this, type, ...a)
      if (c && /webgl/.test(type) && !this.__glc) { this.__glc = 1; window.__gl.push(this) }
      return c
    }
  })
  await page.goto(BASE + path)
  await waitReady(page)
  await sleep(2000)
  // rola a página inteira devagar para tudo que é lazy montar
  const H = await page.evaluate(() => document.documentElement.scrollHeight)
  for (let y = 0; y < H; y += 700) { await page.evaluate((y) => window.scrollTo(0, y), y); await sleep(120) }
  await sleep(1500)
  const r = await page.evaluate(() => {
    const fams = new Set()
    for (const el of document.querySelectorAll('*')) {
      const cs = getComputedStyle(el)
      fams.add(cs.fontFamily.split(',')[0].trim().replace(/["']/g, ''))
      for (const pe of ['::before', '::after']) { const p = getComputedStyle(el, pe); if (p.content && p.content !== 'none') fams.add(p.fontFamily.split(',')[0].trim().replace(/["']/g, '')) }
    }
    const loaded = [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family.replace(/["']/g, ''))
    return { usedCss: [...fams].sort(), loaded: [...new Set(loaded)].sort(), gl: window.__gl.length, glAttached: window.__gl.filter((c) => c.isConnected).map((c) => c.className || '(sem classe)') }
  })
  console.log(path, JSON.stringify(r, null, 1))
}
await browser.close()
