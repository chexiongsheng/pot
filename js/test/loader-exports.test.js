const test = require('node:test')
const assert = require('node:assert/strict')
const { loadPot, startGame } = require('./helpers')

function run(code, path = 'src/lib/a.ts') {
  const { devtools } = loadPot()
  const out = devtools.transpile(code, path)
  const module = { exports: {} }
  new Function('exports', 'require', 'module', out)(module.exports, () => ({}), module)
  return { exports: module.exports, out }
}

test('加载器：一条 export 声明多个变量时全部导出', () => {
  const { exports } = run('export const BOUNCE = 1, KILL = 2, STICK = 4\nexport function f() { return BOUNCE + KILL + STICK }\n')
  assert.equal(exports.BOUNCE, 1)
  assert.equal(exports.KILL, 2)
  assert.equal(exports.STICK, 4)
  assert.equal(exports.f(), 7)
})

test('加载器：多变量导出支持 let/var、类型标注、泛型、跨行、解构与分号', () => {
  const code = [
    'type M<A, B> = { a: A; b: B }',
    'export let a: number = 1, b: M<string, number> = { a: "x,y", b: 2 }',
    'export var c = 3,',
    '  d = c + 1',
    'export const { x, y: [z, ...rest] } = { x: 1, y: [2, 3, 4] }, [p = 5, , q] = [undefined, 0, 6];',
    'export const s = `t${[1, 2].join(",")}`, r = /,\\//g, fn = (u: number, v = 2) => u + v',
    'function inner() { const k = 1, j = 2; return k + j }',
    'export const n = inner()',
  ].join('\n')
  const { exports, out } = run(code)
  assert.equal(exports.a, 1)
  assert.deepEqual(exports.b, { a: 'x,y', b: 2 })
  assert.equal(exports.c, 3)
  assert.equal(exports.d, 4)
  assert.equal(exports.x, 1)
  assert.equal(exports.z, 2)
  assert.deepEqual(exports.rest, [3, 4])
  assert.equal(exports.p, 5)
  assert.equal(exports.q, 6)
  assert.equal(exports.s, 't1,2')
  assert.ok(exports.r instanceof RegExp)
  assert.equal(exports.fn(1), 3)
  assert.equal(exports.n, 3)
  assert.equal(out.split('\n').length, code.split('\n').length, '行号不变')
})

test('加载器：单个声明、函数内多变量、const enum 不改写', () => {
  const { devtools } = loadPot()
  const code = 'export const a = [1, 2]\nfunction f() { const b = 1, c = 2 }\nexport const enum E { A, B }\n'
  assert.equal(devtools.splitMultiExports(code), code)
  assert.deepEqual(devtools.bindingNames('{ a, b: { c }, d = 1, ...e }'), ['a', 'c', 'd', 'e'])
})

test('加载器：游戏单元从共享模块导入多变量导出的常量', async () => {
  const files = new Map([
    ['manifest.json', JSON.stringify({ id: 'multi', plugins: ['main'] })],
    ['src/lib/flags.ts', 'export const BOUNCE = 1, KILL = 2, STICK = 4\n'],
    ['src/plugins/main.ts', `import { BOUNCE, KILL, STICK } from '../lib/flags'
export const name = 'main'
export function apply(ctx) { ctx.scene.spawn({ name: 'flags-' + (BOUNCE | KILL | STICK) }) }
`],
  ])
  const ctx = await startGame(files)
  assert.deepEqual(ctx.runtime.failures, [])
  assert.equal(ctx.engine.byName('flags-7').length, 1)
})
