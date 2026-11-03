import { launch, newPage, waitReady, sleep, state, BASE } from './lib.mjs'
const browser = await launch()
const { page, log, ctx } = await newPage(browser)
await page.addInitScript(() => {
  window.__gl = []
  const orig = HTMLCanvasElement.prototype.getContext
  HTMLCanvasElement.prototype.getContext = function (type, ...a) {
    const c = orig.call(this, type, ...a)
    if (c && /webgl/.test(type) && !this.__glc) { this.__glc = 1; window.__gl.push(new WeakRef(c)); this.__tag = (this.className || 'sem-classe') + ' ' + this.width + 'x' + this.height + ' conectado=' + this.isConnected }
    return c
  }
})
const cdp = await page.context().newCDPSession(page)
await cdp.send('HeapProfiler.enable')
const snap = async (tag) => {
  await cdp.send('HeapProfiler.collectGarbage')
  const r = await page.evaluate(() => ({
    heapMB: +(performance.memory.usedJSHeapSize / 1048576).toFixed(1),
    glCriados: window.__gl.length,
    glVivos: window.__gl.filter((w) => { const c = w.deref(); return c && !c.isContextLost() }).map((w) => w.deref().canvas.__tag),
    canvases: document.querySelectorAll('canvas').length,
    bodyKids: document.body.children.length,
    pinSpacers: document.querySelectorAll('.pin-spacer').length,
  }))
  console.log(tag.padEnd(14), JSON.stringify(r))
}
await page.goto(BASE + '/'); await waitReady(page); await sleep(2000)
await snap('home #0')
for (let i = 1; i <= 5; i++) {
  await page.click('.menu-trigger'); await sleep(500); await page.click('.menu-cta')
  await sleep(1200); await waitReady(page, 30000); await sleep(800)
  await snap(`contato #${i}`)
  await page.click('header .brand'); await sleep(1200); await waitReady(page, 30000); await sleep(1500)
  await snap(`home #${i}`)
}
console.log('console:', log.filter((l) => !/X3595|partial deriv/.test(l)).slice(0, 10).join('\n  '))
await ctx.close(); await browser.close()
