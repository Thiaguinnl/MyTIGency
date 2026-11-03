import { launch, newPage, waitReady, sleep, state, wheel, instrument, BASE } from './lib.mjs'
const only = process.argv[2]
const browser = await launch()
const clean = (log) => log.filter((l) => !/X3595|partial deriv/.test(l))
async function run(name, opts, fn) {
  if (only && !name.startsWith(only)) return
  const { page, log, ctx } = await newPage(browser, opts)
  await instrument(page)
  console.log(`\n=== ${name}`)
  try { await fn(page) } catch (e) { console.log('ERRO', e.message.slice(0, 200)) }
  const c = clean(log); if (c.length) console.log('  console:', c.slice(0, 6).join('\n  '))
  await ctx.close()
}
await run('S pular manifesto (botão) e voltar', {}, async (page) => {
  await page.goto(BASE + '/'); await waitReady(page); await sleep(600); await page.mouse.move(800, 450)
  for (let i = 0; i < 8; i++) await wheel(page, 300, 3)
  await sleep(1500)
  console.log('  antes', (await state(page)))
  const t0 = await page.evaluate(() => performance.now())
  await page.click('.ms-skip-btn')
  for (const t of [1000, 3000, 8000, 12000]) { await sleep(t === 1000 ? 1000 : t === 3000 ? 2000 : t === 8000 ? 5000 : 4000); const s = await state(page); console.log(`  +${t}ms y=${s.y} rótulo=${s.label} skip=${s.skip}`) }
  console.log('  longtasks:', (await page.evaluate((t) => window.__ltSince(t), t0)).map(([, d]) => d).join(','))
  // volta pelo botão "voltar ao início" a partir da seção 6 (de cima)
  await page.evaluate(() => window.scrollTo(0, 19550)); await sleep(300); await wheel(page, 40, 2); await sleep(2000)
  const s1 = await state(page); console.log('  na seção 6:', s1.y, s1.label, s1.skip)
  if (s1.skip?.includes('on')) { await page.click('.ms-skip-btn'); await sleep(4000); const s2 = await state(page); console.log('  depois de voltar:', s2.y, s2.label, s2.skip, s2.hash) }
})
await run('R reduced motion: carga + /#trabalhos + menu', { reduced: true }, async (page) => {
  await page.goto(BASE + '/'); await waitReady(page); await sleep(800)
  const H = await page.evaluate(() => document.documentElement.scrollHeight)
  console.log('  altura', H, await state(page))
  await page.goto(BASE + '/#trabalhos'); await waitReady(page); await sleep(2000)
  console.log('  /#trabalhos', await state(page))
  await page.evaluate(() => window.scrollTo(0, 0)); await sleep(800)
  await page.click('.menu-trigger'); await sleep(400); await page.click('.menu-sections a[href="#trabalhos"]'); await sleep(4000)
  console.log('  menu→trabalhos', await state(page))
})
await run('M mobile 390x844', { w: 390, h: 844, mobile: true, dpr: 2 }, async (page) => {
  const t0 = Date.now()
  await page.goto(BASE + '/'); await waitReady(page, 40000); console.log('  ready ms', Date.now() - t0)
  await sleep(1000)
  const o = await page.evaluate(() => ({ docW: document.documentElement.scrollWidth, vw: innerWidth, canvases: document.querySelectorAll('canvas').length, bigCanvas: [...document.querySelectorAll('canvas')].filter((c) => c.width * c.height > 390 * 844).map((c) => `${c.className}:${c.width}x${c.height}`) }))
  console.log('  ', JSON.stringify(o))
  const H = await page.evaluate(() => document.documentElement.scrollHeight)
  const wide = []
  for (let y = 0; y < H; y += 800) { await page.evaluate((y) => window.scrollTo(0, y), y); await sleep(150); const w = await page.evaluate(() => document.documentElement.scrollWidth); if (w > 392) wide.push(`${y}:${w}`) }
  console.log('  overflow horizontal em:', wide.slice(0, 10).join(' ') || 'nenhum', ' altura total', H)
  await page.goto(BASE + '/#trabalhos'); await waitReady(page, 40000); await sleep(2500); console.log('  /#trabalhos', await state(page))
})
await run('Z resize no meio do pin (seção 3) e no PC', {}, async (page) => {
  await page.goto(BASE + '/'); await waitReady(page); await sleep(600); await page.mouse.move(800, 450)
  await page.evaluate(() => window.scrollTo(0, 6050)); await sleep(300); await wheel(page, 40, 2); await sleep(2000)
  const t0 = await page.evaluate(() => performance.now())
  await page.setViewportSize({ width: 1280, height: 720 }); await sleep(2500)
  const s = await state(page); await page.screenshot({ path: 'resize-s3.png' })
  console.log('  depois do resize em s3', s.y, s.label, 'longtasks', (await page.evaluate((t) => window.__ltSince(t), t0)).map(([, d]) => d).join(','))
  await page.evaluate(() => window.scrollTo(0, 19000)); await sleep(300); await wheel(page, 40, 2); await sleep(2500)
  await page.setViewportSize({ width: 1600, height: 900 }); await sleep(2500)
  await page.screenshot({ path: 'resize-s6.png' }); console.log('  depois do resize em s6', await state(page))
})
await run('F scroll muito rápido do topo ao fim e de volta', {}, async (page) => {
  await page.goto(BASE + '/'); await waitReady(page); await sleep(600); await page.mouse.move(800, 450)
  await page.evaluate(() => window.__recStart())
  for (let i = 0; i < 60; i++) { await page.mouse.wheel(0, 1200); await sleep(16) }
  await sleep(3000)
  const a = await state(page)
  for (let i = 0; i < 60; i++) { await page.mouse.wheel(0, -1500); await sleep(16) }
  await sleep(3000)
  const b = await state(page)
  console.log('  descendo parou em', a.y, a.label, a.lenisStopped, '| subindo parou em', b.y, b.label, b.lenisStopped, '| quadros', JSON.stringify(await page.evaluate(() => window.__recStop())))
  // depois de tudo, a rodinha ainda funciona?
  const y0 = (await state(page)).y; await wheel(page, 600, 4); await sleep(1500); console.log('  rodinha ainda responde?', y0, '→', (await state(page)).y)
})
await run('B voltar do navegador: home(Trabalhos) → contato → Voltar', {}, async (page) => {
  await page.goto(BASE + '/'); await waitReady(page); await sleep(600)
  await page.click('.menu-trigger'); await sleep(400); await page.click('.menu-sections a[href="#trabalhos"]'); await sleep(11000)
  console.log('  em trabalhos', await state(page))
  await page.click('.cta-band a.btn'); await sleep(1500); await waitReady(page, 30000); await sleep(800)
  console.log('  contato', await state(page))
  await page.goBack(); await sleep(1500); await waitReady(page, 30000); await sleep(3000)
  console.log('  depois do Voltar', await state(page))
})
await browser.close()
