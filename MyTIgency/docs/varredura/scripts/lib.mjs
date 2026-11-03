import { chromium } from 'file:///C:/Users/thiag/Desktop/myti/MyTIGency/MyTIgency/node_modules/playwright/index.mjs'
export const BASE = process.env.BASE || 'http://localhost:4173'
export async function launch({ headless = true, extra = [] } = {}) {
  return chromium.launch({ channel: 'chrome', headless, args: ['--ignore-gpu-blocklist', '--use-angle=d3d11', '--enable-gpu-rasterization', ...extra] })
}
export async function newPage(browser, { w = 1600, h = 900, reduced = false, dpr = 1, mobile = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, reducedMotion: reduced ? 'reduce' : 'no-preference', isMobile: mobile, hasTouch: mobile })
  const page = await ctx.newPage()
  const log = []
  page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) log.push(`[${m.type()}] ${m.text()}`.slice(0, 300)) })
  page.on('pageerror', (e) => log.push(`[pageerror] ${e.message}`.slice(0, 300)))
  page.on('requestfailed', (r) => log.push(`[reqfail] ${r.url()} ${r.failure()?.errorText}`))
  return { ctx, page, log }
}
// espera a tela de carregamento (ou a cortina) sair
export async function waitReady(page, max = 20000) {
  const t0 = Date.now()
  await page.waitForFunction(() => !document.querySelector('.loading-screen') && !document.querySelector('.vt-overlay') && !document.documentElement.classList.contains('vt-active'), null, { timeout: max }).catch(() => {})
  return Date.now() - t0
}
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
export async function state(page) {
  return page.evaluate(() => ({
    y: Math.round(scrollY),
    label: document.querySelector('.section-label')?.getAttribute('aria-label'),
    hash: location.hash,
    path: location.pathname,
    skip: document.querySelector('.ms-skip')?.className,
    overflow: document.documentElement.style.overflow,
    lenisStopped: document.documentElement.classList.contains('lenis-stopped'),
    pcOn: document.querySelector('.manifesto')?.classList.contains('pc-on'),
  }))
}
// rodinha real, em passos
export async function wheel(page, dy, steps = 10, gap = 16) {
  for (let i = 0; i < steps; i++) { await page.mouse.wheel(0, dy / steps); await sleep(gap) }
}
// long tasks + intervalos de quadro (rAF) gravados na página
export async function instrument(page) {
  await page.addInitScript(() => {
    window.__lt = []
    try { new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__lt.push([Math.round(e.startTime), Math.round(e.duration)]))).observe({ type: 'longtask', buffered: true }) } catch {}
    window.__frames = null
    window.__recStart = () => { window.__frames = []; let last = performance.now(); const f = (now) => { if (!window.__frames) return; window.__frames.push(now - last); last = now; requestAnimationFrame(f) }; requestAnimationFrame(f) }
    window.__recStop = () => { const fr = window.__frames || []; window.__frames = null; const s = [...fr].sort((a, b) => a - b); const p = (q) => s[Math.floor(q * (s.length - 1))] || 0; return { n: fr.length, avg: +(fr.reduce((a, b) => a + b, 0) / (fr.length || 1)).toFixed(1), p50: +p(0.5).toFixed(1), p95: +p(0.95).toFixed(1), max: +(s[s.length - 1] || 0).toFixed(0), over50: fr.filter((x) => x > 50).length, over100: fr.filter((x) => x > 100).length } }
    window.__ltSince = (t) => window.__lt.filter(([s]) => s >= t)
  })
}
export async function throttle(page, rate = 4) {
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate })
  return cdp
}
