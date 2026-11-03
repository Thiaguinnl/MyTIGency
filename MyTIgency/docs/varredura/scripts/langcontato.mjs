import { launch, newPage, waitReady, sleep, BASE } from './lib.mjs'
const browser = await launch()
const { page, ctx } = await newPage(browser)
await page.goto(BASE + '/contato'); await waitReady(page); await sleep(800)
await page.click('.menu-trigger'); await sleep(500)
const t0 = Date.now()
await page.click('.menu-lang button:nth-of-type(2)')
await page.waitForFunction(() => document.querySelector('.ct-title')?.textContent.match(/build|together/i), null, { timeout: 5000 }).catch(() => {})
console.log('contato: EN em', Date.now() - t0, 'ms; cortina apareceu?', await page.evaluate(() => !!document.querySelector('.vt-overlay')), '| título:', (await page.evaluate(() => document.querySelector('.ct-title')?.textContent)).slice(0, 50))
// voltar para a home com EN mantém o idioma
await page.keyboard.press('Escape'); await sleep(400)
await page.click('header .brand'); await sleep(1500); await waitReady(page, 30000); await sleep(800)
console.log('home depois:', await page.evaluate(() => ({ label: document.querySelector('.section-label').getAttribute('aria-label'), s5en: /nothing/i.test(document.querySelector('.s5')?.textContent || '') })))
await ctx.close(); await browser.close()
