// depois da troca de idioma no meio do pin: cursor 3D montado, botão de pular, rótulo, régua
import { launch, newPage, waitReady, sleep, wheel, state, BASE } from './lib.mjs'
const mobile = process.argv[2] === 'mobile'
const browser = await launch()
const pts = mobile ? [[3000, 'm-s3'], [6500, 'm-s6']] : [[6130, 'cena A'], [12000, 'seção 5'], [19590, 'seção 6']]
for (const [y0, label] of pts) {
  const { page, ctx, log } = await newPage(browser, mobile ? { w: 390, h: 844, mobile: true, dpr: 2 } : {})
  await page.goto(BASE + '/'); await waitReady(page); await sleep(1200); await page.mouse.move(800, 450)
  await page.evaluate((y) => window.scrollTo(0, y), y0); await sleep(300); await wheel(page, 40, 2); await sleep(2500)
  const snap = () => page.evaluate(() => ({ cursor3d: !!document.querySelector('.ms-cursor-cv') || !!document.querySelector('.s3-gap canvas'), cursorVisivel: document.querySelector('.ms-cursor-cv')?.style.visibility !== 'hidden', skip: document.querySelector('.ms-skip')?.className, botao: document.querySelector('.ms-skip-btn')?.innerText.replace(/\s+/g, ' '), regua: document.querySelector('.ms-ruler')?.classList.contains('on') }))
  const a = await snap()
  await page.click('.menu-trigger'); await sleep(500); await page.click('.menu-lang button:nth-of-type(2)')
  await page.waitForFunction(() => !document.querySelector('.vt-overlay'), null, { timeout: 30000 }); await sleep(1500)
  await page.keyboard.press('Escape'); await sleep(600)
  const b = await snap(); const s = await state(page)
  await page.screenshot({ path: `langstate-${label.replace(/\s/g, '')}.png` })
  console.log(`${label} y=${s.y} rótulo=${s.label}\n  PT: ${JSON.stringify(a)}\n  EN: ${JSON.stringify(b)}`)
  const errs = log.filter((l) => !/X3595|partial deriv/.test(l)); if (errs.length) console.log('  console:', errs.slice(0, 4).join('\n  '))
  await ctx.close()
}
await browser.close()
