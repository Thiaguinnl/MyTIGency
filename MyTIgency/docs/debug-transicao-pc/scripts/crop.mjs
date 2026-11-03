import { chromium } from 'file:///C:/Users/thiag/Desktop/myti/MyTIGency/MyTIgency/node_modules/playwright/index.mjs'
import { readFileSync, writeFileSync } from 'node:fs'
const [,, name, x, y, w, h, out] = process.argv
const D = 'C:/Users/thiag/Desktop/myti/MyTIGency/MyTIgency/docs/debug-transicao-pc/saida/cmp'
const b = await chromium.launch(); const p = await b.newPage()
const r = await p.evaluate(async ([a, c, x, y, w, h]) => {
  const load = async (s) => { const i = new Image(); i.src = 'data:image/png;base64,' + s; await i.decode(); return i }
  const [ia, ib] = await Promise.all([load(a), load(c)])
  const cv = document.createElement('canvas'); const Z = 3; cv.width = (w * 2 + 4) * Z; cv.height = h * Z; const k = cv.getContext('2d'); k.imageSmoothingEnabled = false
  k.fillStyle = '#f0f'; k.fillRect(0, 0, cv.width, h * Z)
  k.drawImage(ia, x, y, w, h, 0, 0, w * Z, h * Z); k.drawImage(ib, x, y, w, h, (w + 4) * Z, 0, w * Z, h * Z)
  return cv.toDataURL('image/png').split(',')[1]
}, [readFileSync(`${D}/antes/${name}.png`).toString('base64'), readFileSync(`${D}/depois/${name}.png`).toString('base64'), +x, +y, +w, +h])
writeFileSync(out, Buffer.from(r, 'base64')); await b.close()
