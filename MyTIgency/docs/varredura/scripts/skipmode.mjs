import { launch, newPage, waitReady, sleep, wheel, BASE } from './lib.mjs'
const browser = await launch()
const { page, ctx } = await newPage(browser)
await page.goto(BASE + '/'); await waitReady(page); await sleep(600); await page.mouse.move(800, 450)
const read = () => page.evaluate(() => ({ y: Math.round(scrollY), btn: document.querySelector('.ms-skip-btn')?.innerText.replace(/\s+/g, ' '), on: document.querySelector('.ms-skip')?.classList.contains('on'), label: document.querySelector('.section-label')?.getAttribute('aria-label') }))
const seen = []
// rolagem linear com a rodinha até a seção 6 (antes do capítulo com ímã)
while (true) { await wheel(page, 500, 5, 16); await sleep(60); const r = await read(); const k = `${r.btn}|${r.label}`; if (seen.at(-1)?.k !== k) seen.push({ k, y: r.y }); if (r.y > 19400) break }
await sleep(1500)
console.log('descendo:', seen.map((s) => `${s.y}: botão "${s.k.split('|')[0]}" rótulo ${s.k.split('|')[1]}`).join('\n  '))
await ctx.close(); await browser.close()
