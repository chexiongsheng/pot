/**
 * 积木布局（004 第 18.3 节）：推导、提示、规范字符串、打包与解包。
 */
const test = require('node:test')
const assert = require('node:assert/strict')
const { loadPot } = require('./helpers')

const pot = loadPot()

const env = (inputs = {}) => ({
  cmd: () => ({
    axis: (n) => inputs.axes?.[n] ?? { x: 0, y: 0 },
    down: (n) => !!inputs.down?.[n],
    pressed: (n) => !!inputs.pressed?.[n],
  }),
  layerMask: (names) => names.reduce((m, n) => m | (1 << ['default', 'bullet', 'playerWall'].indexOf(n)), 0) >>> 0,
})

test('布局：自动推导，先 props 后 state，对象展开、数组定长', () => {
  const def = pot.defineBlock({
    name: 'walker',
    props: { speed: 4, jump: true, stride: { walk: 1, run: 2 } },
    state: { vel: [0, 0, 0], hp: 3, alive: true },
    step() {},
  })
  const r = pot.deriveLayout(def)
  assert.equal(r.ok, true, r.reason)
  assert.equal(r.layout.text, 'walker|speed:f;jump:b;stride.walk:f;stride.run:f;vel:f3;hp:f;alive:b')
  assert.equal(r.layout.stride, 7 + 1 + 1 + 2 + 3 + 1 + 1)
  assert.deepEqual(r.layout.fields.map((f) => [f.path, f.offset, f.writable]), [
    ['speed', 7, false], ['jump', 8, false], ['stride.walk', 9, false], ['stride.run', 10, false], ['vel', 11, true], ['hp', 14, true], ['alive', 15, true],
  ])
  assert.equal(pot.deriveLayout(def), r, '按定义对象缓存')
})

test('布局：推不出时给出原因；提示与缺省值不符时报错', () => {
  const reason = (def) => pot.deriveLayout(pot.defineBlock({ name: 'x', step() {}, ...def })).reason
  assert.match(reason({ props: { target: 'player' } }), /target 的缺省值是 string，需要在 native 里给出类型/)
  assert.match(reason({ props: { fallY: null } }), /fallY 的缺省值是 null/)
  assert.match(reason({ props: { list: [] } }), /list 的缺省值是空数组/)
  assert.match(reason({ props: { a: 1 }, native: { b: 'f' } }), /native 提示里的 b 不是 props 或 state 的字段/)
  assert.match(reason({ props: { a: 'jump' }, native: { a: 'nope' } }), /不是已知类型/)
  assert.match(reason({ props: { a: 1 }, native: { a: 'axis' } }), /缺省值应是指令名字符串/)
  assert.match(reason({ state: { a: 'move' }, native: { a: 'axis' } }), /是 state，不能标为 axis/)
  assert.match(reason({ props: { a: 'x' }, native: { a: 'layers' } }), /缺省值应是字符串数组或 null/)
})

test('布局：moveFps 式的提示（axis、action、layers、f?、可为 null 的对象）', () => {
  const def = pot.defineBlock({
    name: 'm',
    props: { layers: null, ground: { y: 0 }, bounds: null, fallY: null, actions: { move: 'move', jump: 'jump' } },
    state: { vel: [0, 0, 0] },
    native: { layers: 'layers', ground: { '?': { y: 'f', maxX: 'f?' } }, bounds: { '?': { min: 'f2', max: 'f2' } }, fallY: 'f?', actions: { move: 'axis', jump: 'action' } },
    step() {},
  })
  const r = pot.deriveLayout(def)
  assert.equal(r.ok, true, r.reason)
  assert.equal(r.layout.text, 'm|layers:layers;ground:?;ground.y:f;ground.maxX:f?;bounds:?;bounds.min:f2;bounds.max:f2;fallY:f?;actions.move:axis;actions.jump:action;vel:f3')

  const e = { id: 9, pos: [1, 2, 3], rot: [0, 90, 0] }
  const me = { layers: ['bullet'], ground: { y: -1.6 }, bounds: null, fallY: -10, actions: { move: 'walk', jump: 'hop' }, vel: [4, 5, 6] }
  const buf = pot.packBatch(r.layout, [{ e, me }], env({ axes: { walk: { x: 0.5, y: -1 } }, down: { hop: true }, pressed: { hop: true } }), 1 / 60, 42)
  const at = (path) => 4 + r.layout.fields.find((f) => f.path === path).offset
  assert.deepEqual([...buf.slice(0, 4)], [1, r.layout.stride, 1 / 60, 42])
  assert.deepEqual([...buf.slice(4, 11)], [9, 1, 2, 3, 0, 90, 0])
  assert.equal(buf[at('layers')], 2)
  assert.deepEqual([buf[at('ground')], buf[at('ground.y')], buf[at('ground.maxX')], buf[at('ground.maxX') + 1]], [1, -1.6, 0, 0])
  assert.deepEqual([...buf.slice(at('bounds'), at('bounds') + 5)], [0, 0, 0, 0, 0], '为 null 的对象：有无槽为 0，子字段为 0')
  assert.deepEqual([buf[at('fallY')], buf[at('fallY') + 1]], [1, -10])
  assert.deepEqual([buf[at('actions.move')], buf[at('actions.move') + 1]], [0.5, -1])
  assert.deepEqual([buf[at('actions.jump')], buf[at('actions.jump') + 1]], [1, 1])
  assert.deepEqual([...buf.slice(at('vel'), at('vel') + 3)], [4, 5, 6])

  // 全部层
  me.layers = null
  const all = pot.packBatch(r.layout, [{ e, me }], env(), 1 / 60, 0)
  assert.equal(all[at('layers')], 0xffffffff)
})

test('布局：解包只写回 pos、rot 与 state，数组原地写；格式不对时抛错', () => {
  const def = pot.defineBlock({ name: 'w', props: { speed: 2 }, state: { vel: [0, 0, 0], on: false, n: 0, opt: null }, native: { opt: 'f?' }, step() {} })
  const { layout } = pot.deriveLayout(def)
  const e = { id: 3, pos: [0, 0, 0], rot: [0, 0, 0] }
  const vel = [0, 0, 0]
  const me = { speed: 2, vel, on: false, n: 0, opt: null }
  const list = [{ e, me }]
  const buf = pot.packBatch(layout, list, env(), 0.1, 0)
  const o = 4
  buf[o + 1] = 7; buf[o + 5] = 45
  const f = (p) => o + layout.fields.find((x) => x.path === p).offset
  buf[f('speed')] = 99
  buf[f('vel')] = 1; buf[f('vel') + 2] = -1
  buf[f('on')] = 1
  buf[f('n')] = 5
  buf[f('opt')] = 1; buf[f('opt') + 1] = 0.25
  pot.unpackBatch(layout, list, buf)
  assert.deepEqual(e.pos, [7, 0, 0])
  assert.deepEqual(e.rot, [0, 45, 0])
  assert.equal(me.speed, 2, 'props 不写回')
  assert.equal(me.vel, vel, '数组原地写')
  assert.deepEqual(me.vel, [1, 0, -1])
  assert.equal(me.on, true)
  assert.equal(me.n, 5)
  assert.equal(me.opt, 0.25)
  buf[f('opt')] = 0
  pot.unpackBatch(layout, list, buf)
  assert.equal(me.opt, null)

  assert.throws(() => pot.unpackBatch(layout, list, buf.slice(0, 5)), /格式不对/)
  const bad = buf.slice()
  bad[o] = 4
  assert.throws(() => pot.unpackBatch(layout, list, bad), /id 不符/)
})

test('布局：没有 state 的积木（moveTopdown 的形状）', () => {
  const r = pot.deriveLayout(pot.defineBlock({ name: 'moveTopdown', props: { speed: 5 }, step() {} }))
  assert.equal(r.layout.text, 'moveTopdown|speed:f')
  assert.equal(r.layout.stride, 8)
})

test('布局：@ 开头的提示是写死名字的输入，排在字段前面', () => {
  const def = pot.defineBlock({ name: 'td', props: { speed: 5 }, native: { '@move': 'axis', '@fire': 'action' }, step() {} })
  const r = pot.deriveLayout(def)
  assert.equal(r.layout.text, 'td|@move:axis;@fire:action;speed:f')
  const e = { id: 1, pos: [0, 0, 0], rot: [0, 0, 0] }
  const buf = pot.packBatch(r.layout, [{ e, me: { speed: 5 } }], env({ axes: { move: { x: 1, y: -0.5 } }, down: { fire: true } }), 0.1, 0)
  assert.deepEqual([...buf.slice(11, 16)], [1, -0.5, 1, 0, 5])
  const reason = (native) => pot.deriveLayout(pot.defineBlock({ name: 'x', props: { a: 1 }, native, step() {} })).reason
  assert.match(reason({ '@move': 'f' }), /是输入，类型只能是 axis 或 action/)
  assert.match(reason({ '@1x': 'axis' }), /不是合法的指令名/)
})
