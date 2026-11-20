const test = require('node:test')
const assert = require('node:assert/strict')
const { startGame, startHello, frames, unit } = require('./helpers')

function game(units) {
  const files = new Map([['manifest.json', JSON.stringify({ id: 't', plugins: Object.keys(units).filter((n) => !n.startsWith('_')) })]])
  for (const [name, body] of Object.entries(units)) files.set(`src/plugins/${name.replace(/^_/, '')}.js`, unit(name.replace(/^_/, ''), body))
  return startGame(files)
}

test('define 返回活对象，重复 define 返回同一引用', async () => {
  const { runtime } = await game({
    a: `
      const s1 = ctx.state.define('a', { init: () => ({ n: 1 }) })
      const s2 = ctx.state.define('a', { init: () => ({ n: 2 }) })
      s1.n++
      ctx.state.define('a-check', { init: () => ({ same: s1 === s2, n: s2.n }) })
    `,
  })
  assert.deepEqual(runtime.state.get('a-check'), { same: true, n: 2 })
  assert.deepEqual(runtime.state.info().map((i) => i.owner), ['a', 'a'])
})

test('不同单元定义同一个 key 报错', async () => {
  const { runtime } = await game({
    a: `ctx.state.define('shared', { init: () => ({}) })`,
    b: `ctx.state.define('shared', { init: () => ({}) })`,
  })
  assert.equal(runtime.failures.length, 1)
  assert.match(runtime.failures[0].error, /已被单元 "a" 定义/)
})

test('不可序列化的值被拒绝，并指出路径', async () => {
  const { runtime } = await game({
    a: `ctx.state.define('bad', { init: () => ({ list: [1, { fn: () => 1 }] }) })`,
  })
  assert.match(runtime.failures[0].error, /bad\.list\[1\]\.fn 是 函数/)
})

test('标量 init 被拒绝', async () => {
  const { runtime } = await game({ a: `ctx.state.define('n', { init: () => 1 })` })
  assert.match(runtime.failures[0].error, /必须返回对象或数组/)
})

test('版本变化走 migrate，失败回退 init 并告警', async () => {
  const { runtime, host } = await game({ a: `` })
  const state = runtime.state
  state.importJSON(JSON.stringify({
    m: { owner: '(host)', version: 1, value: { hp: 10 } },
    f: { owner: '(host)', version: 1, value: { hp: 10 } },
  }))
  const m = state.define('m', { version: 2, init: () => ({ health: 100 }), migrate: (old) => ({ health: old.hp * 10 }) })
  assert.deepEqual(m, { health: 100 })
  const f = state.define('f', { version: 2, init: () => ({ health: 1 }), migrate: () => { throw new Error('x') } })
  assert.deepEqual(f, { health: 1 })
  assert.ok(host.logs.some((l) => l.level === 'warn' && /迁移/.test(l.text)))
})

test('TypedArray 可存入并在 export/import 后还原', async () => {
  const { runtime } = await game({ a: `` })
  const s = runtime.state.define('grid', { init: () => ({ cells: new Uint8Array([1, 2, 3]) }) })
  s.cells[1] = 9
  const json = runtime.exportState()
  runtime.state.reset()
  runtime.state.importJSON(json)
  const restored = runtime.state.get('grid').cells
  assert.ok(restored instanceof Uint8Array)
  assert.deepEqual([...restored], [1, 9, 3])
})

test('snapshot/restore 原地写回，插件持有的引用保持有效', async () => {
  const { runtime } = await startHello()
  const player = runtime.state.get('player')
  const snap = runtime.state.snapshot(['player'])
  player.score = 42
  player.position[0] = 9
  runtime.state.restore(snap, ['player'])
  assert.equal(runtime.state.get('player'), player)
  assert.equal(player.score, 0)
  frames(runtime, 1)
})

test('cache：getOrCreate 命中、LRU 淘汰', async () => {
  const { runtime } = await game({ a: `` })
  const cache = runtime.cache
  let calls = 0
  const make = () => { calls++; return { data: 'x'.repeat(100) } }
  const a = cache.getOrCreate('mesh', { seed: 1 }, make)
  const b = cache.getOrCreate('mesh', { seed: 1 }, make)
  assert.equal(a, b)
  assert.equal(calls, 1)
  cache.budget = 300
  cache.getOrCreate('mesh', { seed: 2 }, make)
  cache.getOrCreate('mesh', { seed: 3 }, make)
  assert.ok(cache.stats().bytes <= 300)
  assert.equal(cache.stats().count, 1)
})

test('validate：读档恢复的坏数据重新初始化并告警，原地写回；通过或就地修正的保留', async () => {
  const { runtime, host } = await game({ a: `` })
  const state = runtime.state
  state.importJSON(JSON.stringify({
    bad: { owner: '(host)', version: 1, value: { x: 999, hp: 5 } },
    why: { owner: '(host)', version: 1, value: { x: -1 } },
    boom: { owner: '(host)', version: 1, value: { x: 1 } },
    ok: { owner: '(host)', version: 1, value: { x: 3, hp: 5 } },
    fix: { owner: '(host)', version: 1, value: { x: 3, hp: -20 } },
    mig: { owner: '(host)', version: 1, value: { pos: 999 } },
  }))
  const held = state.get('bad')
  const inside = (v) => Math.abs(v.x) < 50
  const bad = state.define('bad', { init: () => ({ x: 0, hp: 100 }), validate: inside })
  assert.deepEqual(bad, { x: 0, hp: 100 })
  assert.equal(bad, held, '原地写回，已持有的引用仍有效')
  const why = state.define('why', { init: () => ({ x: 0 }), validate: (v) => (v.x >= 0 ? true : 'x 为负') })
  assert.deepEqual(why, { x: 0 })
  const boom = state.define('boom', { init: () => ({ x: 0 }), validate: (v) => v.missing.deep })
  assert.deepEqual(boom, { x: 0 })
  const ok = state.define('ok', { init: () => ({ x: 0, hp: 100 }), validate: inside })
  assert.deepEqual(ok, { x: 3, hp: 5 })
  const fix = state.define('fix', { init: () => ({ x: 0, hp: 100 }), validate: (v) => { v.hp = Math.max(0, v.hp); return true } })
  assert.deepEqual(fix, { x: 3, hp: 0 })
  const mig = state.define('mig', { version: 2, init: () => ({ x: 0 }), migrate: (o) => ({ x: o.pos }), validate: inside })
  assert.deepEqual(mig, { x: 0 }, 'migrate 的结果也要校验')
  const warns = host.logs.filter((l) => l.level === 'warn' && /沿用的数据无效/.test(l.text)).map((l) => l.text)
  assert.equal(warns.length, 4)
  assert.ok(warns.some((t) => /x 为负/.test(t)))
  assert.ok(warns.some((t) => /校验出错/.test(t)))
})

test('validate：刚 init 的数据不校验；热重载时同样校验沿用的数据', async () => {
  let calls = 0
  const { runtime } = await game({ a: `` })
  const state = runtime.state
  const v = state.define('h', { init: () => ({ x: 0 }), validate: () => { calls++; return true } })
  assert.equal(calls, 0)
  v.x = 1e9
  const again = state.define('h', { init: () => ({ x: 0 }), validate: (s) => { calls++; return s.x < 100 } })
  assert.equal(calls, 1)
  assert.equal(again, v)
  assert.equal(again.x, 0)
})
