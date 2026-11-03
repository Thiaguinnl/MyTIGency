// Verifica: textos PT/EN da cena do PC, a bola some depois do tranco, a lâmpada no
// vai-e-volta rápido e o parallax da palavra.
import { chromium } from 'file:///C:/Users/thiag/Desktop/myti/MyTIGency/MyTIgency/node_modules/playwright/index.mjs'
const DIR = 'C:/Users/thiag/Desktop/myti/MyTIGency/MyTIgency/docs/debug-transicao-pc/saida'
const PC_AT = 21200, VH = 900, HOLD0 = 0.35, LEN = 3.2
const yAt = (T) => PC_AT + (HOLD0 + LEN * T) * VH
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--use-angle=d3d11'] })

for (const lang of ['pt']) {
  const ctx = await browser.newContext({ viewport: { width: 1700, height: VH } })
  await ctx.addInitScript((l) => localStorage.setItem('myt-lang', l), lang)
  const page = await ctx.newPage()
  await page.goto('http://localhost:5174/')
  await page.waitForTimeout(7000)
  const go = async (y, ms = 2500) => { await page.evaluate((y) => scrollTo(0, y), y); await page.waitForTimeout(ms) }
  for (let y = PC_AT - 2500; y <= PC_AT; y += 400) await go(y, 450)
  const st = () => page.evaluate(() => ({ ball: document.querySelector('.s6-ball')?.classList.contains('is-visible'), hidden: document.querySelector('.manifesto')?.dataset.cursor ?? null, lamp: document.querySelector('.ma-pc')?.style.getPropertyValue('--lamp') }))

  if (lang === 'pt') {
    // bola: antes do tranco (cartaz parado) e depois dele, com o mouse sobre a tela
    await go(yAt(0.0), 4000); await page.mouse.move(850, 450); await page.mouse.move(860, 455); await page.waitForTimeout(800)
    console.log('bola antes do tranco:', JSON.stringify(await st()))
    await go(yAt(0.25), 4000); await page.mouse.move(850, 450); await page.mouse.move(845, 452); await page.waitForTimeout(800)
    console.log('bola depois do tranco:', JSON.stringify(await st()))
    await go(yAt(0.0), 5000); await page.mouse.move(855, 450); await page.waitForTimeout(800)
    console.log('bola de volta antes do tranco:', JSON.stringify(await st()))
    // lâmpada: desce passando de 0,76, volta para trás e desce de novo rápido — amostra --lamp
    await go(yAt(0.7), 4000)
    const sample = async (ms) => page.evaluate(async (ms) => { const out = []; const t0 = performance.now(); while (performance.now() - t0 < ms) { out.push(document.querySelector('.ma-pc').style.getPropertyValue('--lamp')); await new Promise((r) => requestAnimationFrame(r)) } return [...new Set(out)].join(' ') }, ms)
    await page.evaluate((y) => scrollTo(0, y), yAt(0.85)); console.log('1ª passada (piscada esperada):', await sample(3500))
    await page.evaluate((y) => scrollTo(0, y), yAt(0.7)); await page.waitForTimeout(2200)
    await page.evaluate((y) => scrollTo(0, y), yAt(0.85)); console.log('volta rápida (acende direto):', await sample(3500))
    await page.evaluate((y) => scrollTo(0, y), yAt(0.7)); await page.waitForTimeout(7000)
    await page.evaluate((y) => scrollTo(0, y), yAt(0.85)); console.log('depois de ficar apagada (pisca de novo):', await sample(3500))
    // parallax da palavra: mouse à esquerda e à direita
    await go(yAt(0.95), 3500)
    const word = () => page.evaluate(() => document.querySelector('.ec-word').style.transform)
    await page.mouse.move(20, 450); await page.waitForTimeout(1500); const a = await word()
    await page.mouse.move(1680, 450); await page.waitForTimeout(250); const mid = await word(); await page.waitForTimeout(1500); const b = await word()
    console.log('palavra, mouse à esquerda:', a, '\n  logo após ir à direita (inércia):', mid, '\n  assentada à direita:', b)
  }
  // textos + fotos
  await go(yAt(0.6), 4000)
  await page.screenshot({ path: `${DIR}/txt-${lang}-popups.png` })
  await go(yAt(0.95), 4000)
  await page.screenshot({ path: `${DIR}/txt-${lang}-cartaz.png` })
  console.log(lang, 'textos:', JSON.stringify(await page.evaluate(() => ({
    word: document.querySelector('.ec-word .ec-o')?.textContent,
    caps: [...document.querySelectorAll('.ma-pc .env-mono')].map((e) => e.textContent.trim()),
    sticker: document.querySelector('.ec-stk textPath')?.textContent,
    icons: [...document.querySelectorAll('.pc-ico span')].map((e) => e.textContent),
    pops: [...document.querySelectorAll('.pc-desk .w98-t span')].map((e) => e.textContent),
    clock: document.querySelector('.pc-tb .clock')?.textContent,
  }))))
  await ctx.close()
}
await browser.close()
