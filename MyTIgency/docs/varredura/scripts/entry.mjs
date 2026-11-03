import { launch, newPage, waitReady, sleep, state, wheel, BASE } from './lib.mjs'
const only = process.argv[2]
const browser = await launch()
const docTop = (page, sel) => page.evaluate((sel) => { const el = document.querySelector(sel); if (!el) return null; let t = 0; for (let n = el; n; n = n.offsetParent) t += n.offsetTop; return t }, sel)
async function run(name, fn) {
  if (only && !name.startsWith(only)) return
  const { page, log, ctx } = await newPage(browser)
  console.log(`\n=== ${name}`)
  try { await fn(page) } catch (e) { console.log('ERRO', e.message) }
  if (log.length) console.log('console:', log.filter((l) => !l.includes('X3595') && !l.includes('partial derivatives')).slice(0, 8).join('\n  '))
  await ctx.close()
}
const fontsCheck = (page) => page.evaluate(() => ({ playfair: document.fonts.check('900 40px Playfair'), archivoWide: [...document.fonts].filter((f) => f.family.includes('Archivo') && f.status === 'loaded').map((f) => f.stretch).join('|') }))

await run('A topo → manifesto → volta ao topo (rodinha)', async (page) => {
  await page.goto(BASE + '/'); await waitReady(page); await sleep(800)
  await page.mouse.move(800, 450)
  console.log('inicio', await state(page))
  const man = await docTop(page, '#manifesto')
  console.log('#manifesto docTop', man, '#trabalhos', await docTop(page, '#trabalhos'))
  for (let i = 0; i < 30; i++) { await wheel(page, 400, 4); const s = await state(page); if (s.label !== 'Home' && s.label !== 'HOME') { console.log('mudou em', i, s); break } }
  await sleep(1200); console.log('no manifesto', await state(page))
  for (let i = 0; i < 40; i++) { await wheel(page, -600, 4); const s = await state(page); if (s.y < 5) break }
  await sleep(2000); console.log('de volta ao topo', await state(page))
})
await run('B carga direta /#trabalhos', async (page) => {
  await page.goto(BASE + '/#trabalhos'); const ms = await waitReady(page); console.log('ready', ms)
  for (const t of [0, 1500, 4000, 9000, 14000]) { await sleep(t ? t - (t === 1500 ? 0 : 0) : 0); console.log(t, await state(page)) }
})
await run('C /contato → menu → Trabalhos', async (page) => {
  await page.goto(BASE + '/contato'); await waitReady(page); await sleep(1000)
  console.log('contato', await state(page), await fontsCheck(page))
  await page.click('.menu-trigger'); await sleep(600)
  await page.click('.menu-sections a[href="/#trabalhos"]')
  await sleep(1500); await waitReady(page, 25000)
  for (const t of [0, 3000, 9000, 15000]) { if (t) await sleep(t === 3000 ? 3000 : 6000); console.log(t, await state(page)) }
  console.log('fontes na home vinda do contato', await fontsCheck(page))
})
await run('D home topo → Fale conosco → logo → home', async (page) => {
  await page.goto(BASE + '/'); await waitReady(page); await sleep(800)
  await page.click('.menu-trigger'); await sleep(600)
  await page.click('.menu-cta'); await sleep(1000); await waitReady(page, 25000); await sleep(1500)
  console.log('no contato', await state(page))
  await page.click('header .brand'); await sleep(1000); await waitReady(page, 25000); await sleep(1500)
  console.log('de volta na home', await state(page))
})
await browser.close()
