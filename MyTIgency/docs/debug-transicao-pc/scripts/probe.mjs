// Reconhecimento: GPU do navegador automatizado, onde a cena do PC liga e a árvore de camadas nela
import { chromium } from 'file:///C:/Users/thiag/Desktop/myti/MyTIGency/MyTIgency/node_modules/playwright/index.mjs'

const URL = 'http://localhost:5174/'
const headless = process.argv.includes('--headless')
const browser = await chromium.launch({
  channel: 'chrome', headless,
  args: ['--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--use-angle=d3d11'],
})
const page = await browser.newPage({ viewport: { width: 1700, height: 900 }, deviceScaleFactor: 1 })
await page.goto(URL)
await page.waitForTimeout(7000)

const gpu = await page.evaluate(() => {
  const gl = document.createElement('canvas').getContext('webgl')
  const ext = gl?.getExtension('WEBGL_debug_renderer_info')
  return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'sem webgl'
})
console.log('GPU:', gpu)

// acha onde a cena do PC liga (a classe .on), andando pelo scroll
const st = () => page.evaluate(() => ({ y: scrollY, on: document.querySelector('.ma-pc')?.classList.contains('on'), kids: document.querySelector('.ma-pc')?.children.length }))
let pcAt = null
for (let y = 14000; y < 30000; y += 300) {
  await page.evaluate((y) => scrollTo(0, y), y)
  await page.waitForTimeout(1600)
  const s = await st()
  if (s.on) { pcAt = y; break }
}
console.log('PC liga perto de y =', pcAt)
const workTop = await page.evaluate(() => { let t = 0; for (let n = document.querySelector('#trabalhos'); n; n = n.offsetParent) t += n.offsetTop; return t })
console.log('#trabalhos em', workTop, 'vh', 900)

// árvore de camadas na fase escura (≈ 1,5 tela depois de ligar)
const cdp = await page.context().newCDPSession(page)
await cdp.send('DOM.enable')
await cdp.send('LayerTree.enable')
let layers = null
cdp.on('LayerTree.layerTreeDidChange', (e) => { if (e.layers) layers = e.layers })
await page.evaluate((y) => scrollTo(0, y), pcAt + 1350)
await page.waitForTimeout(3000)
await page.mouse.move(10, 10)
await page.waitForTimeout(500)
if (layers) {
  const draw = layers.filter((l) => l.drawsContent)
  const area = draw.reduce((a, l) => a + l.width * l.height, 0)
  console.log('camadas:', layers.length, 'com conteúdo:', draw.length, 'área total (Mpx):', (area / 1e6).toFixed(1))
  const big = [...draw].sort((a, b) => b.width * b.height - a.width * a.height).slice(0, 14)
  for (const l of big) {
    let name = ''
    if (l.backendNodeId) {
      try {
        const { node } = await cdp.send('DOM.describeNode', { backendNodeId: l.backendNodeId })
        name = `${node.localName}${node.attributes ? '.' + (node.attributes[node.attributes.indexOf('class') + 1] || '') : ''}`
      } catch { name = '?' }
    }
    let reasons = []
    try { reasons = (await cdp.send('LayerTree.compositingReasons', { layerId: l.layerId })).compositingReasonIds ?? [] } catch {}
    console.log(`${l.width}x${l.height}`.padEnd(12), name.slice(0, 50).padEnd(50), reasons.slice(0, 4).join(','))
  }
} else console.log('sem árvore de camadas')
await page.screenshot({ path: 'C:/Users/thiag/Desktop/myti/MyTIGency/MyTIgency/docs/debug-transicao-pc/saida/probe.png' })
console.log(JSON.stringify({ pcAt, workTop }))
await browser.close()
