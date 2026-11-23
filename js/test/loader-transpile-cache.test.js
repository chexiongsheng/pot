const test = require('node:test')
const assert = require('node:assert/strict')
const { loadPot } = require('./helpers')

/** 最小宿主：只有 readText 与内存版持久缓存 */
function host(files, store = new Map()) {
  return {
    platform: 'node',
    log() {},
    readText: (path) => (files.has(path) ? files.get(path) : null),
    cacheRead: (bucket, key) => store.get(`${bucket}/${key}`) ?? null,
    cacheWrite: (bucket, key, text) => { store.set(`${bucket}/${key}`, text) },
    store,
  }
}

const files = () => new Map([
  ['src/lib/util.ts', 'export const twice = (n: number): number => n * 2\n'],
  ['src/plugins/main.ts', "import { twice } from '../lib/util'\nexport const value: number = twice(21)\n"],
])

test('转译缓存：第二个加载器从持久缓存取结果，不再转译', () => {
  const { devtools } = loadPot()
  const h = host(files())
  const a = devtools.createLoader(h)
  assert.equal(a.load('main', {}).exports.value, 42)
  assert.deepEqual(a.transpileStats, { memory: 0, disk: 0, compiled: 2 })
  assert.equal(h.store.size, 2)
  for (const key of h.store.keys()) assert.match(key, /^js\/[0-9a-f]{16}$/)

  const b = devtools.createLoader(host(files(), h.store))
  assert.equal(b.load('main', {}).exports.value, 42)
  assert.deepEqual(b.transpileStats, { memory: 0, disk: 2, compiled: 0 })
})

test('转译缓存：单元热重载源码没变时走内存，改了才重新转译', () => {
  const { devtools } = loadPot()
  const fs = files()
  const loader = devtools.createLoader(host(fs))
  loader.load('main', {})
  loader.load('main', {})
  assert.deepEqual(loader.transpileStats, { memory: 1, disk: 0, compiled: 2 })
  fs.set('src/plugins/main.ts', "export const value: number = 7\n")
  loader.invalidate(['src/plugins/main.ts'])
  assert.equal(loader.load('main', {}).exports.value, 7)
  assert.equal(loader.transpileStats.compiled, 3)
})

test('转译缓存：条目头部不符（碰撞或旧格式）时重新转译，行号不变', () => {
  const { devtools } = loadPot()
  const fs = files()
  const h = host(fs)
  for (const [path, code] of fs) h.store.set(`js/${devtools.transpileKey(code, path)}`, 'module.exports = { value: -1 }')
  const loader = devtools.createLoader(h)
  assert.equal(loader.load('main', {}).exports.value, 42)
  assert.equal(loader.transpileStats.compiled, 2)
  const out = loader.transpileCached(fs.get('src/plugins/main.ts'), 'src/plugins/main.ts')
  assert.equal(out.split('\n').length, fs.get('src/plugins/main.ts').split('\n').length)
})

test('转译缓存：宿主没有缓存接口时照常工作', () => {
  const { devtools } = loadPot()
  const fs = files()
  const loader = devtools.createLoader({ platform: 'node', log() {}, readText: (p) => fs.get(p) ?? null })
  assert.equal(loader.load('main', {}).exports.value, 42)
  assert.equal(loader.transpileStats.compiled, 2)
})
