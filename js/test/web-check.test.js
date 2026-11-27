/**
 * pot check 的可移植检查（004 第 20.7 节）：游戏源码里把宿主专有全局对象当自由变量用的地方要报出来；
 * 属性名、对象键、类型位置、typeof 特性检测、本文件里有同名声明的都不算；src/kits/ 下的套件副本不检查。
 */
const test = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { loadPot } = require('./helpers')
const { findBlockedGlobals, checkGame } = require('../devserver/builder')

const pot = loadPot()

function makeGame(root) {
  const dir = path.join(root, 'game')
  fs.mkdirSync(path.join(dir, 'src/plugins'), { recursive: true })
  fs.mkdirSync(path.join(dir, 'src/kits/demo'), { recursive: true })
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({ id: 'pot.web-check', name: '检查', plugins: ['bad', 'good'] }))
  fs.writeFileSync(path.join(dir, 'src/plugins/bad.ts'), `export const name = 'bad'
export function apply() {
  const w = window.innerWidth
  fetch('/x')
  const shorthand = { process }
  return [w, shorthand]
}
`)
  fs.writeFileSync(path.join(dir, 'src/plugins/good.tsx'), `export const name = 'good'
interface Opts { document: number; el?: HTMLElement }
type Win = typeof window
const location = { x: 1 }
export function apply(obj: { window: number; close(): void }, open: boolean) {
  const o: Opts = { document: 1 }
  const hasWindow = typeof window !== 'undefined'
  obj.close()
  const { self } = { self: 2 }
  const el = <div close="1" />
  return [obj.window, o.document, hasWindow, location.x, open, self, el] as unknown as Win
}
`)
  fs.writeFileSync(path.join(dir, 'src/kits/demo/index.ts'), `export const w = window\n`)
  return dir
}

test('findBlockedGlobals：只报真正的自由引用', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pot-web-check-'))
  try {
    const dir = makeGame(root)
    const found = findBlockedGlobals(dir, pot.BLOCKED_GLOBALS)
    assert.deepStrictEqual(found, [
      { file: 'src/plugins/bad.ts', line: 3, name: 'window' },
      { file: 'src/plugins/bad.ts', line: 4, name: 'fetch' },
      { file: 'src/plugins/bad.ts', line: 5, name: 'process' },
    ])
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

test('pot check：自由引用作为告警输出，不影响 ok', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pot-web-check-'))
  try {
    const dir = makeGame(root)
    const result = await checkGame(dir)
    const warnings = (result.warnings ?? []).filter((w) => w.includes('宿主专有的全局对象'))
    assert.strictEqual(warnings.length, 3)
    assert.match(warnings[0], /^src\/plugins\/bad\.ts:3：.*window/)
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

test('示例游戏没有宿主专有全局对象的自由引用', () => {
  const games = path.join(__dirname, '../../games')
  for (const name of fs.readdirSync(games)) {
    const dir = path.join(games, name)
    if (!fs.existsSync(path.join(dir, 'manifest.json'))) continue
    assert.deepStrictEqual(findBlockedGlobals(dir, pot.BLOCKED_GLOBALS), [], name)
  }
})
