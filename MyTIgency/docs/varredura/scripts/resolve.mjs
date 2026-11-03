import fs from 'node:fs'
import { SourceMapConsumer } from 'file:///C:/Users/thiag/Desktop/myti/MyTIGency/MyTIgency/node_modules/source-map-js/source-map.js'
const D = 'C:/Users/thiag/AppData/Local/Temp/claude/C--Users-thiag--claude-spares-spare-Thfapn/6e649f18-ee4e-4870-8c50-30f4d8163d2e/scratchpad/dist-sm/assets/'
const maps = {}
export function where(file, line, col) {
  maps[file] ??= new SourceMapConsumer(JSON.parse(fs.readFileSync(D + file + '.map', 'utf8')))
  const p = maps[file].originalPositionFor({ line: line + 1, column: col })
  return p.source ? `${p.source.replace(/^.*?(src|node_modules)\//, '$1/')}:${p.line} ${p.name || ''}` : '?'
}
