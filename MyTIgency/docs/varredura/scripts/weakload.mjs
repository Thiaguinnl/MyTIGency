import { launch, newPage, waitReady, sleep, state, instrument, BASE } from './lib.mjs'
const browser = await launch()
for (const [cpu, net, label] of [[1, null, 'desktop sem limite'], [4, { lat: 150, down: 9e6 / 8, up: 1.5e6 / 8 }, 'CPU 4x + 4G'], [6, { lat: 300, down: 1.6e6 / 8, up: 0.75e6 / 8 }, 'CPU 6x + 3G rápido']]) {
  const { page, log, ctx } = await newPage(browser)
  await instrument(page)
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Network.enable')
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true })
  if (net) await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: net.lat, downloadThroughput: net.down, uploadThroughput: net.up })
  if (cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu })
  const t0 = Date.now()
  await page.goto(BASE + '/', { waitUntil: 'commit' })
  await page.waitForSelector('.loading-screen', { timeout: 60000 }).catch(() => {})
  const tLoading = Date.now() - t0
  await waitReady(page, 60000)
  const tReady = Date.now() - t0
  await sleep(1000)
  const lt = await page.evaluate(() => window.__lt)
  const total = lt.reduce((a, [, d]) => a + d, 0)
  console.log(`${label}: tela de loading em ${tLoading}ms, página liberada em ${tReady}ms; long tasks: ${lt.length} (soma ${total}ms, maior ${Math.max(0, ...lt.map(([, d]) => d))}ms)`)
  // primeiro gesto depois de liberar: rola 3 telas e mede quadros
  await page.mouse.move(800, 450)
  await page.evaluate(() => window.__recStart())
  for (let i = 0; i < 12; i++) { await page.mouse.wheel(0, 220); await sleep(16) }
  await sleep(1500)
  console.log('   primeiros 2,7 telas de scroll:', JSON.stringify(await page.evaluate(() => window.__recStop())))
  await ctx.close()
}
await browser.close()
