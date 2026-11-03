import { launch, newPage, waitReady, sleep, state, wheel, instrument, BASE } from './lib.mjs'
const browser = await launch()
async function fromY(y0, label) {
  const { page, log, ctx } = await newPage(browser)
  await instrument(page)
  await page.goto(BASE + '/'); await waitReady(page); await sleep(800)
  await page.mouse.move(800, 450)
  if (y0) { await page.evaluate((y) => window.scrollTo(0, y), y0); await sleep(300); await wheel(page, 50, 2); await sleep(1500) }
  const before = await state(page)
  await page.click('.menu-trigger'); await sleep(500)
  const t0 = await page.evaluate(() => performance.now())
  await page.click('.menu-sections a[href="#trabalhos"]')
  const seq = []
  for (let i = 0; i < 14; i++) { await sleep(1000); const s = await state(page); seq.push(`${s.y}:${s.label}`) }
  const lt = await page.evaluate((t) => window.__ltSince(t), t0)
  console.log(`\n=== Menu→Trabalhos de ${label} (y0=${before.y}, rótulo antes=${before.label})\n  ${seq.join('  ')}\n  longtasks>50ms: ${lt.map(([s, d]) => d).join(',') || '-'}`)
  const errs = log.filter((l) => !/X3595|partial deriv/.test(l)); if (errs.length) console.log('  console:', errs.slice(0, 5).join('\n  '))
  await ctx.close()
}
await fromY(0, 'Hero')
await fromY(6000, 'seção 3 (pin lateral)')
await fromY(19500, 'seção 6')
await fromY(27500, 'Trabalhos')
await browser.close()
