const test = require('node:test')
const assert = require('node:assert/strict')
const { loadPot } = require('./helpers')

const pot = loadPot()
const { jsx } = pot.jsxRuntime
const { Fragment, Registry, defineBlock, definePrefab, evaluate } = pot

function setup() {
  const reg = new Registry()
  reg.addBlock(defineBlock({ name: 'shape', about: '外形', props: { color: '#ffffff', size: { x: 1, y: 1 }, dims: [1, 1, 1] } }))
  reg.addBlock(defineBlock({ name: 'spin', about: '自转', props: { speed: 90 } }))
  reg.addBlock(defineBlock({ name: 'trigger', about: '触发', props: { radius: 0.5 } }))
  reg.addPrefab(definePrefab('coin', { shape: { color: '#ffd54f' }, trigger: true, tags: ['pickup'] }))
  reg.addPrefab(definePrefab('base', { shape: { color: '#ff0000' }, tags: ['a'] }))
  return reg
}

/** 用 jsxDEV 构造带源位置的节点 */
function dev(type, props, key, line) {
  return pot.jsxDevRuntime.jsxDEV(type, props, key, false, { fileName: 'src/plugins/game.tsx', lineNumber: line, columnNumber: 0 })
}

function errorsOf(fn) {
  try {
    fn()
  } catch (error) {
    assert.ok(Array.isArray(error.errors), '应带 errors 列表')
    return error.errors
  }
  assert.fail('应当报错')
}

test('definePrefab 返回可调用的句柄，可作 TSX 大写标签', () => {
  const Coin = definePrefab('bigCoin', { is: 'coin' })
  assert.equal(Coin.prefab, 'bigCoin')
  assert.equal(Coin.name, 'bigCoin')
  assert.ok(pot.isPrefab(Coin))
  const node = Coin({ key: 3, at: [1, 2, 3] })
  assert.equal(node.type, Coin)
  assert.equal(node.key, '3')
  assert.throws(() => definePrefab('Big', {}), /小写开头/)
  assert.throws(() => defineBlock({ name: 'at', about: '' }), /保留属性/)
  assert.throws(() => defineBlock({ name: 'x', about: '', props: { a: 1 }, state: { a: 2 } }), /同时出现/)
})

test('Registry：同名按栈覆盖、撤销后露出原来的；ordered 按 order 再按首次登记', () => {
  const reg = new Registry()
  const a1 = defineBlock({ name: 'a', about: '', order: 1 })
  const undoA1 = reg.addBlock(a1)
  reg.addBlock(defineBlock({ name: 'b', about: '' }))
  reg.addBlock(defineBlock({ name: 'c', about: '', order: 1 }))
  const a2 = defineBlock({ name: 'a', about: '', order: 1 })
  const undoA2 = reg.addBlock(a2)
  assert.equal(reg.block('a'), a2)
  assert.deepEqual(reg.ordered().map((b) => b.name), ['b', 'a', 'c'])
  undoA2()
  assert.equal(reg.block('a'), a1)
  undoA1()
  assert.equal(reg.block('a'), undefined)
  reg.addBlock(defineBlock({ name: 'a', about: '', order: 1 }))
  assert.deepEqual(reg.ordered().map((b) => b.name), ['b', 'a', 'c'], '重新登记不改变先后')
  reg.addPrefab(definePrefab('p1', {}))
  reg.addPrefab(definePrefab('p2', { is: 'p1' }))
  assert.deepEqual(reg.chain('p2'), ['p1', 'p2'])
  assert.deepEqual(reg.chain('nope'), ['nope'])
})

test('evaluate：预制件继承与深合并、默认值、tags 合并、scale 扩成三个数', () => {
  const reg = setup()
  const Child = definePrefab('child', { is: 'base', shape: { size: { y: 2 }, dims: [2, 2, 2] }, spin: true, tags: ['b', 'a'] })
  const { entities, prefabs } = evaluate(jsx(Child, { shape: { color: '#00ff00', dims: [3] }, scale: 2, tags: ['c'] }), reg)
  assert.equal(entities.length, 1)
  const e = entities[0]
  assert.equal(e.prefab, 'child')
  assert.equal(e.path, 'child#0')
  assert.deepEqual(e.at, [0, 0, 0])
  assert.deepEqual(e.rot, [0, 0, 0])
  assert.deepEqual(e.scale, [2, 2, 2])
  assert.deepEqual(e.tags.sort(), ['a', 'b', 'c'])
  assert.deepEqual(e.blocks.shape, { color: '#00ff00', size: { x: 1, y: 2 }, dims: [3] }, '对象逐字段合并，数组整个替换')
  assert.deepEqual(e.blocks.spin, { speed: 90 }, 'true 表示用默认值')
  assert.deepEqual(prefabs, [Child], '直接引用的预制件句柄收进 prefabs')
  assert.deepEqual(reg.block('shape').props, { color: '#ffffff', size: { x: 1, y: 1 }, dims: [1, 1, 1] }, '不改积木默认值')
  assert.deepEqual(Child.def.shape, { size: { y: 2 }, dims: [2, 2, 2] }, '不改预制件定义')

  const coin = evaluate(jsx('coin', { at: [1, 0, 2], rot: [0, 45, 0], scale: [1, 2, 3], name: 'c1' }), reg).entities[0]
  assert.deepEqual(coin.blocks, { shape: { color: '#ffd54f', size: { x: 1, y: 1 }, dims: [1, 1, 1] }, trigger: { radius: 0.5 } })
  assert.deepEqual([coin.at, coin.rot, coin.scale, coin.name, coin.tags], [[1, 0, 2], [0, 45, 0], [1, 2, 3], 'c1', ['pickup']])
})

test('evaluate：积木值 false / null 去掉预制件带的积木', () => {
  const reg = setup()
  assert.deepEqual(Object.keys(evaluate(jsx('coin', { trigger: false }), reg).entities[0].blocks), ['shape'])
  assert.deepEqual(Object.keys(evaluate(jsx('coin', { shape: null, trigger: true }), reg).entities[0].blocks), ['trigger'])
})

test('evaluate：路径格式（序号、key、函数组件、带 key 的片段、数组透明）', () => {
  const reg = setup()
  function Row({ n }) {
    return Array.from({ length: n }, () => jsx('coin', {}))
  }
  const onTouch = () => {}
  const tree = jsx(Fragment, {
    children: [
      jsx('coin', {}),
      [jsx('coin', {}), null, false, true, ''],
      jsx('coin', {}, 'a'),
      jsx(Row, { n: 2 }),
      jsx(Row, { n: 1 }, 'r'),
      jsx(Fragment, { children: jsx('coin', {}) }, 'k'),
      jsx('rule', { on: 'touch', a: definePrefab('player', {}), b: 'coin', do: onTouch }),
      jsx('rule', { on: 'every', seconds: 2, do: onTouch }),
      jsx('stage', { background: '#1e2230', camera: { at: [0, 12, -10], look: [0, 0, 0] } }),
    ],
  })
  const { entities, rules, stage } = evaluate(tree, reg)
  assert.deepEqual(entities.map((e) => e.path), ['coin#0', 'coin#1', 'coin:a', 'Row#0/coin#0', 'Row#0/coin#1', 'Row:r/coin#0', '#k/coin#0'])
  assert.deepEqual(rules.map((r) => [r.path, r.on, r.a, r.b, r.seconds]), [['rule#0', 'touch', 'player', 'coin', undefined], ['rule#1', 'every', undefined, undefined, 2]])
  assert.equal(rules[0].do, onTouch)
  assert.deepEqual(stage, { background: '#1e2230', camera: { at: [0, 12, -10], look: [0, 0, 0] } })
  assert.equal(evaluate(null, reg).stage, null)
})

test('evaluate：15.4 校验表逐行报错，带 文件:行号', () => {
  const reg = setup()
  const cases = [
    [dev('con', {}, undefined, 3), /^src\/plugins\/game\.tsx:3 未知的标签 <con>，是不是 coin/],
    [dev('coin', { spn: true }, undefined, 4), /^src\/plugins\/game\.tsx:4 未知的积木 spn，是不是 spin/],
    [dev('coin', { shape: { colour: '#000' } }, undefined, 5), /^src\/plugins\/game\.tsx:5 积木 shape 没有字段 colour，是不是 color/],
    [dev('coin', { children: dev('coin', {}, undefined, 7) }, undefined, 6), /^src\/plugins\/game\.tsx:6 <coin> 有子节点/],
    [dev(Fragment, { children: [dev('coin', {}, 'x', 8), dev('coin', {}, 'x', 9)] }, undefined, 8), /^src\/plugins\/game\.tsx:9 重复的 key 路径 "coin:x"（第一次出现在 src\/plugins\/game\.tsx:8）/],
    [dev('rule', { on: 'on-hit', do() {} }, undefined, 10), /^src\/plugins\/game\.tsx:10 <rule> 未知的事件 "on-hit"/],
  ]
  for (const [node, re] of cases) {
    const errors = errorsOf(() => evaluate(node, reg))
    assert.equal(errors.length, 1, errors.join('\n'))
    assert.match(errors[0], re)
  }
})

test('evaluate：其余校验，多条错误一起报', () => {
  const reg = setup()
  const errors = errorsOf(() => evaluate(jsx(Fragment, {
    children: [
      dev(Fragment, { children: 'hello' }, undefined, 2),
      dev('coin', { at: [1, 2], scale: 'big', name: 3 }, undefined, 3),
      dev('coin', { shape: 'red' }, undefined, 4),
      dev('rule', { on: 'touch' }, undefined, 5),
      dev('rule', { on: 'every', seconds: 0, do() {} }, undefined, 6),
      dev('stage', {}, undefined, 7),
      dev('stage', {}, undefined, 8),
      dev(() => { throw new Error('boom') }, {}, undefined, 9),
      dev(definePrefab('orphan', { is: 'missing' }), {}, undefined, 10),
    ],
  }), reg))
  const text = errors.join('\n')
  assert.match(text, /game\.tsx:2 场景树里不能有文本："hello"/)
  assert.match(text, /game\.tsx:3 at 必须是三个有限数/)
  assert.match(text, /game\.tsx:3 scale 必须是三个有限数/)
  assert.match(text, /game\.tsx:3 name 必须是字符串/)
  assert.match(text, /game\.tsx:4 积木 shape 的值必须是对象/)
  assert.match(text, /game\.tsx:5 <rule on="touch"> 缺少 do 函数/)
  assert.match(text, /game\.tsx:6 <rule on="every"> 需要正数 seconds/)
  assert.match(text, /game\.tsx:8 一棵场景树只能有一个 <stage>（第一个在 src\/plugins\/game\.tsx:7）/)
  assert.match(text, /game\.tsx:9 函数组件 .* 出错：boom/)
  assert.match(text, /game\.tsx:10 预制件 orphan 继承的 "missing" 没有登记/)
  assert.equal(errors.length, 10)
})

test('evaluate：is 链循环', () => {
  const reg = setup()
  reg.addPrefab(definePrefab('p', { is: 'q' }))
  reg.addPrefab(definePrefab('q', { is: 'p' }))
  assert.match(errorsOf(() => evaluate(jsx('p', {}), reg))[0], /is 链有循环/)
})

test('evaluate：经加载器转译的 .tsx，行号来自 jsxDEV', () => {
  const files = new Map([['src/plugins/game.tsx', [
    "import { Registry, defineBlock, definePrefab, evaluate } from '@pot/core'",
    'const reg = new Registry()',
    "reg.addBlock(defineBlock({ name: 'shape', about: '', props: { color: '#fff' } }))",
    "const Coin = definePrefab('coin', { shape: true })",
    'reg.addPrefab(Coin)',
    'function Level() {',
    '  return <>{[1, 2].map((i) => <Coin key={i} at={[i, 0, 0]} />)}</>',
    '}',
    'export const ok = evaluate(<Level />, reg)',
    'let message = ""',
    'try { evaluate(<><Coin /><coin shape={{ size: 1 }} /></>, reg) } catch (e: any) { message = e.message }',
    'export { message }',
  ].join('\n')]])
  const host = { platform: 'node', log() {}, readText: (p) => (files.has(p) ? files.get(p) : null) }
  const modules = { '@pot/core': pot, 'cordis': pot, '@pot/core/jsx-runtime': pot.jsxRuntime, '@pot/core/jsx-dev-runtime': pot.jsxDevRuntime }
  const m = pot.devtools.createLoader(host).load('game', modules).exports
  assert.deepEqual(m.ok.entities.map((e) => [e.path, e.at[0], e.source.line]), [['Level#0/coin:1', 1, 7], ['Level#0/coin:2', 2, 7]])
  assert.equal(m.message, 'src/plugins/game.tsx:11 积木 shape 没有字段 size')
})
