const test = require('node:test')
const assert = require('node:assert/strict')
const { loadPot, startGame, frames } = require('./helpers')

/** 用加载器转译并执行一个 .tsx 单元，返回导出 */
function loadTsx(code, name = 'main') {
  const pot = loadPot()
  const files = new Map([[`src/plugins/${name}.tsx`, code]])
  const host = { platform: 'node', log() {}, readText: (p) => (files.has(p) ? files.get(p) : null) }
  const modules = { '@pot/core': pot, 'cordis': pot, '@pot/core/jsx-runtime': pot.jsxRuntime, '@pot/core/jsx-dev-runtime': pot.jsxDevRuntime }
  return pot.devtools.createLoader(host).load(name, modules).exports
}

test('jsx：节点形状、key 转字符串、Fragment', () => {
  const pot = loadPot()
  const { jsx, jsxs, Fragment } = pot.jsxRuntime
  const node = jsx('coin', { at: [1, 2, 3] }, 7)
  assert.equal(node.type, 'coin')
  assert.equal(node.key, '7')
  assert.deepEqual(node.props, { at: [1, 2, 3] })
  assert.equal(node.source, undefined)
  assert.ok(pot.isNode(node))
  assert.ok(!pot.isNode({ type: 'coin', key: null, props: {} }))
  assert.equal(jsx('a', null).key, null)
  assert.deepEqual(jsx('a', null).props, {})
  assert.equal(jsxs, jsx)
  assert.equal(Fragment, Symbol.for('pot.fragment'))
  assert.equal(pot.Fragment, Fragment)
  assert.equal(pot.jsxDevRuntime.Fragment, Fragment)
})

test('jsx：jsxDEV 把源位置转成 { file, line, col }', () => {
  const { jsxDEV } = loadPot().jsxDevRuntime
  const node = jsxDEV('player', { children: 'x' }, undefined, false, { fileName: 'src/plugins/game.tsx', lineNumber: 12, columnNumber: 5 }, undefined)
  assert.deepEqual(node.source, { file: 'src/plugins/game.tsx', line: 12, col: 5 })
  assert.equal(node.key, null)
  assert.equal(node.props.children, 'x')
})

test('jsx：createElement（key 写在展开属性之后时的回退）', () => {
  const pot = loadPot()
  const node = pot.createElement('coin', { key: 3, at: [0, 0, 0], __source: {} }, 'a', 'b')
  assert.equal(node.key, '3')
  assert.deepEqual(node.props, { at: [0, 0, 0], children: ['a', 'b'] })
})

test('jsx：TRANSPILER_ID 已改，旧缓存失效', () => {
  const { devtools } = loadPot()
  assert.notEqual(devtools.TRANSPILER_ID, 'sucrase-3.35.1/multi-export-1')
})

test('jsx 转译：JSX 文本含逗号，与多变量导出同在一个文件', () => {
  const m = loadTsx([
    'export const a: number = 1, b = 2',
    'export const node = <text size={28}>a, b, c</text>',
  ].join('\n'))
  assert.equal(m.a + m.b, 3)
  assert.equal(m.node.type, 'text')
  assert.equal(m.node.props.children, 'a, b, c')
  assert.equal(m.node.props.size, 28)
})

test('jsx 转译：map 里的自闭合标签', () => {
  const m = loadTsx('export const list = [[1, 0, 2], [3, 0, 4]].map((at, i) => <coin key={i} at={at} />), x = 1\n')
  assert.equal(m.list.length, 2)
  assert.deepEqual(m.list.map((n) => [n.type, n.key, n.props.at]), [['coin', '0', [1, 0, 2]], ['coin', '1', [3, 0, 4]]])
  assert.equal(m.x, 1)
})

test("jsx 转译：文本含撇号", () => {
  const m = loadTsx("export const node = <text>it's a pot, isn't it</text>, y = 'q'\n")
  assert.equal(m.node.props.children, "it's a pot, isn't it")
  assert.equal(m.y, 'q')
})

test('jsx 转译：片段与属性里的字符串', () => {
  const m = loadTsx([
    "import { Fragment } from '@pot/core'",
    'export const tree = <>',
    '  <stage background="#1e2230, x" />',
    "  <rule on='touch' a=\"player\" b='coin, big' />",
    '</>',
    'export const keyed = <Fragment key="k"><coin /></Fragment>',
  ].join('\n'))
  assert.equal(m.tree.type, Symbol.for('pot.fragment'))
  const [stage, rule] = m.tree.props.children
  assert.equal(stage.props.background, '#1e2230, x')
  assert.deepEqual([rule.props.on, rule.props.a, rule.props.b], ['touch', 'player', 'coin, big'])
  assert.equal(m.keyed.key, 'k')
  assert.equal(m.keyed.props.children.type, 'coin')
})

test('jsx 转译：泛型箭头函数 <T,>(x: T) => x', () => {
  const m = loadTsx('export const id = <T,>(x: T): T => x, two = id<number>(2)\nexport const node = <coin at={id([1, 2, 3])} />\n')
  assert.equal(m.two, 2)
  assert.deepEqual(m.node.props.at, [1, 2, 3])
})

test('jsx 转译：jsxDEV 带的文件名与行号正确，函数组件与 key 回退可用', () => {
  const m = loadTsx([
    "import type { PotNode } from '@pot/core'",
    'const Row = ({ n }: { n: number }) => <>{Array.from({ length: n }, (_, i) => <coin key={i} />)}</>',
    '',
    'const p = { at: [1, 2, 3] }',
    'export const tree: PotNode = <>',
    '  <Row n={2} />',
    '  <coin {...p} key="late" />',
    '</>',
  ].join('\n'), 'game')
  const [row, late] = m.tree.props.children
  // sucrase 的 jsxDEV 只给行号，不给列号，col 记为 0
  assert.deepEqual(m.tree.source, { file: 'src/plugins/game.tsx', line: 5, col: 0 })
  assert.equal(row.source.line, 6)
  assert.equal(row.type.name, 'Row')
  const expanded = row.type(row.props)
  assert.equal(expanded.props.children.length, 2)
  assert.equal(expanded.props.children[1].source.line, 2)
  assert.equal(late.key, 'late')
  assert.deepEqual(late.props.at, [1, 2, 3])
})

test('jsx：.tsx 单元经运行时模块表加载并运行', async () => {
  const files = new Map([
    ['manifest.json', JSON.stringify({ id: 'jsx.test', plugins: ['main'] })],
    ['src/lib/shapes.tsx', 'export const Ball = (p: { at: number[] }) => <coin at={p.at} />\n'],
    ['src/plugins/main.tsx', [
      "import type { Context } from '@pot/core'",
      "import { Ball } from '../lib/shapes'",
      'export const name = "main"',
      'export function apply(ctx: Context) {',
      '  const node = <Ball at={[1, 2, 3]} />',
      "  ctx.state.define('out', { init: () => ({ type: node.type.name, at: node.type(node.props).props.at }) })",
      '}',
    ].join('\n')],
  ])
  const { runtime } = await startGame(files)
  assert.deepEqual(runtime.failures, [])
  frames(runtime, 1)
  assert.deepEqual(runtime.state.get('out'), { type: 'Ball', at: [1, 2, 3] })
})
