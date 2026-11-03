import { launch, newPage, waitReady, sleep, state } from './lib.mjs'
const BASE = 'http://localhost:5175'
const browser = await launch()
const { page, ctx, log } = await newPage(browser)
const t0 = Date.now()
await page.goto(BASE + '/#trabalhos'); await waitReady(page, 40000)
console.log('dev /#trabalhos liberou em', Date.now() - t0, 'ms', await state(page))
await sleep(12000)
console.log('depois do capítulo', await state(page))
// a TV (canvas do React, remontado pelo StrictMode) continua com contexto vivo?
await page.evaluate(() => window.scrollTo(0, 2600)); await sleep(300); await page.mouse.wheel(0, 40); await sleep(3000)
console.log('TV:', await page.evaluate(() => { const c = document.querySelector('.s2-tv'); const gl = c?.getContext('webgl2') || c?.getContext('webgl'); return { tv: !!c?.tv, perdido: gl?.isContextLost(), w: c?.width, h: c?.height } }))
await page.screenshot({ path: 'dev-tv.png' })
console.log('console:', log.filter((l) => !/X3595|partial deriv|Download the React|DevTools/.test(l)).slice(0, 6).join('\n'))
await ctx.close(); await browser.close()
