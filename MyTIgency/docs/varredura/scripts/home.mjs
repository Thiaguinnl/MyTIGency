import { launch, newPage, waitReady, sleep, wheel, state, BASE } from './lib.mjs'
const browser = await launch()
for (const how of ['logo do header', 'menu → Home']) {
  const { page, ctx } = await newPage(browser)
  await page.goto(BASE + '/'); await waitReady(page); await sleep(600); await page.mouse.move(800, 450)
  await page.evaluate(() => window.scrollTo(0, 27500)); await sleep(300); await wheel(page, 50, 2); await sleep(2000)
  if (how === 'logo do header') await page.click('header .brand')
  else { await page.click('.menu-trigger'); await sleep(500); await page.click('.menu-sections a[href="#top"]') }
  const seq = []
  for (let i = 0; i < 10; i++) { await sleep(1000); const s = await state(page); seq.push(`${s.y}:${s.label}`) }
  console.log(`${how} a partir de Trabalhos (27500): ${seq.join('  ')}`)
  await ctx.close()
}
await browser.close()
