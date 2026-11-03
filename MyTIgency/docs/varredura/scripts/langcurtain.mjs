import { launch, newPage, waitReady, sleep, state, wheel, instrument, BASE } from './lib.mjs'
const cpu = Number(process.argv[2] || 1)
const reduced = process.argv[3] === 'reduced'
const browser = await launch()
async function at(y0, label) {
  const { page, log, ctx } = await newPage(browser, { reduced })
  await instrument(page)
  await page.addInitScript(() => {
    window.__ov = []
    new MutationObserver((ms) => ms.forEach((m) => {
      m.addedNodes.forEach((n) => n.classList?.contains('vt-overlay') && window.__ov.push(['add', performance.now()]))
      m.removedNodes.forEach((n) => n.classList?.contains('vt-overlay') && window.__ov.push(['remove', performance.now()]))
    })).observe(document, { childList: true, subtree: true })
  })
  await page.goto(BASE + '/'); await waitReady(page); await sleep(1200); await page.mouse.move(800, 450)
  if (y0) { await page.evaluate((y) => window.scrollTo(0, y), y0); await sleep(300); await wheel(page, 40, 2); await sleep(2500) }
  const before = await state(page)
  if (cpu > 1) { const cdp = await page.context().newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu }) }
  await page.click('.menu-trigger'); await sleep(600)
  const t0 = await page.evaluate(() => performance.now())
  await page.click('.menu-lang button:nth-of-type(2)')
  await page.waitForFunction(() => window.__ov.some(([k]) => k === 'remove'), null, { timeout: 60000 }).catch(() => {})
  await sleep(500)
  const r = await page.evaluate((t0) => {
    const add = window.__ov.find(([k]) => k === 'add')?.[1], rem = window.__ov.find(([k]) => k === 'remove')?.[1]
    const lt = window.__ltSince(t0)
    const covered = add + (matchMedia('(prefers-reduced-motion: reduce)').matches ? 200 : 600)
    const revealStart = rem - (matchMedia('(prefers-reduced-motion: reduce)').matches ? 250 : 700)
    const vis = lt.filter(([s, d]) => s + d < covered || s > revealStart).map(([s, d]) => `${d}ms@${Math.round(s - t0)}`)
    const hid = lt.filter(([s, d]) => !(s + d < covered || s > revealStart)).map(([, d]) => d)
    return { total: Math.round(rem - t0), coberta: hid, visiveis: vis, s5en: document.querySelector('.s5')?.textContent.includes('NOTHING') || /nothing/i.test(document.querySelector('.s5')?.textContent || ''), pc: !!document.querySelector('.ma-pc .pc-rig') }
  }, t0)
  await page.keyboard.press('Escape'); await sleep(700)
  const after = await state(page)
  await page.screenshot({ path: `langc-${y0}.png` })
  console.log(`${label}: y ${before.y}→${after.y} rótulo ${before.label}→${after.label} | cortina ${r.total} ms | tarefas longas cobertas: [${r.coberta}] visíveis: [${r.visiveis}] | EN na seção 5: ${r.s5en} | lenis parado: ${after.lenisStopped} overflow:'${after.overflow}'`)
  const errs = log.filter((l) => !/X3595|partial deriv/.test(l)); if (errs.length) console.log('  console:', errs.slice(0, 4).join('\n  '))
  await ctx.close()
}
for (const [y, l] of [[0, 'Hero'], [6050, 'seção 3'], [19550, 'seção 6'], [24078, 'cartaz']]) await at(y, l)
await browser.close()
