const test = require('node:test')
const assert = require('node:assert/strict')
const { startHello, frames, run } = require('./helpers')

/** 修改 hello 中某个单元的构建产物（模拟 Dev Server 推送） */
function patch(build, name, transform) {
  return { path: `units/${name}.cjs`, content: transform(build.files.get(`units/${name}.cjs`)) }
}

async function reload(ctx, msg) {
  const reply = await run(ctx.runtime, ctx.pot.devtools.handle({ id: 1, type: 'reload', ...msg }))
  assert.equal(reply.ok, true, reply.error)
  return reply.data
}

test('热重载 player：state 保留，对象重建，无泄漏', async () => {
  const ctx = await startHello()
  const { runtime, engine, build } = ctx
  engine.axes.move = [1, 0]
  frames(runtime, 30)
  engine.axes.move = [0, 0]
  const before = runtime.state.get('player')
  const x = before.position[0]
  const oldId = engine.byName('player')[0].id

  const result = await reload(ctx, { files: [patch(build, 'player', (c) => c.replace('#4fc3f7', '#ff0000'))] })
  assert.equal(result.ok, true, result.error)
  assert.deepEqual(result.units, ['player'])
  assert.equal(result.rolledBack, false)
  assert.deepEqual(result.leaks, [], `泄漏：${result.leaks}`)

  const players = engine.byName('player')
  assert.equal(players.length, 1, '旧对象销毁、新对象创建')
  assert.notEqual(players[0].id, oldId)
  assert.deepEqual(players[0].color, [1, 0, 0, 1])
  assert.equal(runtime.state.get('player'), before, 'state 活对象引用不变')
  assert.equal(players[0].position[0], x, '新版本从 state 恢复位置')
  assert.equal(runtime.clock.frozen, false)

  // 新版本照常响应输入
  engine.axes.move = [1, 0]
  frames(runtime, 12)
  assert.ok(before.position[0] > x)
})

test('未修改的单元被跳过', async () => {
  const ctx = await startHello()
  const result = await reload(ctx, { files: [patch(ctx.build, 'player', (c) => c)] })
  assert.deepEqual(result.units, [])
  assert.deepEqual(result.skipped, ['player'])
})

test('apply 抛错时回滚：旧版本恢复运行，state 恢复', async () => {
  const ctx = await startHello()
  const { runtime, engine, build } = ctx
  const player = runtime.state.get('player')
  player.position[0] = 2
  const result = await reload(ctx, {
    files: [patch(build, 'player', (c) => c.replace(/(const body = )/, 'state.position[0] = 999;\n  throw new Error("新版本坏了");\n  $1'))],
  })
  assert.equal(result.ok, false)
  assert.equal(result.rolledBack, true)
  assert.equal(result.phase, 'apply')
  assert.match(result.error, /新版本坏了/)
  assert.match(result.error, /units\/player\.cjs/, '报错栈带单元文件名')

  assert.equal(runtime.state.get('player').position[0], 2, 'state 回滚')
  assert.equal(engine.byName('player').length, 1, '旧版本重新挂载')
  assert.equal(runtime.plugins.units.get('player').hash, runtime.plugins.list().find((u) => u.name === 'player').hash)
  engine.axes.move = [1, 0]
  frames(runtime, 12)
  assert.ok(runtime.state.get('player').position[0] > 2, '旧版本仍在响应输入')
})

test('语法错误在 preload 阶段失败，运行中的版本不受影响', async () => {
  const ctx = await startHello()
  const oldHash = ctx.runtime.plugins.units.get('coins').hash
  const result = await reload(ctx, { files: [{ path: 'units/coins.cjs', content: 'exports.apply = function (ctx) { (' }] })
  assert.equal(result.ok, false)
  assert.equal(result.phase, 'preload')
  assert.equal(result.rolledBack, false)
  assert.equal(ctx.runtime.plugins.units.get('coins').hash, oldHash)
  assert.equal(ctx.engine.byName('coin0').length, 1)
})

test('数据文件变化：重载读过它的单元', async () => {
  const ctx = await startHello()
  const data = JSON.parse(ctx.build.files.get('data/coins.json'))
  data.coins.push([7, 0.5, 7])
  const result = await reload(ctx, { files: [{ path: 'data/coins.json', content: JSON.stringify(data) }] })
  assert.deepEqual(result.units, ['coins'])
  assert.equal(ctx.engine.byName('coin5').length, 1)
  assert.equal(ctx.engine.byName('player').length, 1, '不相关单元不受影响')
})

test('重载父单元 world：嵌套的 player/coins 随之重建，只保留一份', async () => {
  const ctx = await startHello()
  const { engine, build, runtime } = ctx
  runtime.state.get('player').score = 3
  const result = await reload(ctx, { files: [patch(build, 'world', (c) => c.replace('#1e2230', '#000000'))] })
  assert.deepEqual(result.units, ['world'])
  assert.deepEqual(result.leaks, [])
  assert.deepEqual(engine.background, [0, 0, 0])
  assert.equal(engine.byName('player').length, 1)
  assert.equal(engine.byName('ground').length, 1)
  assert.equal(engine.byName('coin0').length, 1)
  assert.equal(runtime.state.get('player').score, 3)
})

test('同时重载父子单元', async () => {
  const ctx = await startHello()
  const { engine, build } = ctx
  const result = await reload(ctx, {
    files: [
      patch(build, 'world', (c) => c.replace('#1e2230', '#010101')),
      patch(build, 'player', (c) => c.replace('#4fc3f7', '#00ff00')),
    ],
  })
  assert.deepEqual(result.units.sort(), ['player', 'world'])
  assert.equal(engine.byName('player').length, 1)
  assert.deepEqual(engine.byName('player')[0].color, [0, 1, 0, 1])
  assert.equal(engine.byName('ground').length, 1)
})

test('泄漏检测：旧版本被全局变量持有时报告', async () => {
  const ctx = await startHello()
  const leaky = (c) => c.replace(/(function apply\(ctx[^)]*\) \{)/, '$1\n  globalThis.__leak = globalThis.__leak || []; globalThis.__leak.push(() => ctx);')
  await reload(ctx, { files: [patch(ctx.build, 'coins', leaky)] })
  const result = await reload(ctx, { files: [patch(ctx.build, 'coins', (c) => leaky(c).replace('#', '#').replace('拾取', '捡到'))] })
  assert.equal(result.ok, true)
  assert.ok(result.leaks.length > 0, '应检测到泄漏')
  assert.ok(result.leaks.some((l) => /coins/.test(l)))
  delete globalThis.__leak
})

test('agent：eval / state / plugins / query / time', async () => {
  const ctx = await startHello()
  const call = (msg) => run(ctx.runtime, ctx.pot.devtools.handle({ id: 7, ...msg }))
  assert.deepEqual((await call({ type: 'eval', code: '1 + 2' })).data, 3)
  assert.equal((await call({ type: 'eval', code: 'runtime.state.get("player").score' })).data, 0)
  assert.equal((await call({ type: 'eval', code: 'const a = 2; return a * 5' })).data, 10)
  const err = await call({ type: 'eval', code: 'nope()' })
  assert.equal(err.ok, false)
  assert.ok((await call({ type: 'state', action: 'keys' })).data.some((k) => k.key === 'player'))
  assert.equal((await call({ type: 'plugins' })).data.length, 3)
  assert.equal((await call({ type: 'query', what: 'objects', unit: 'coins' })).data.length, 5)
  const t = (await call({ type: 'time', action: 'pause' })).data
  assert.equal(t.paused, true)
  assert.equal((await call({ type: 'unknown' })).ok, false)
  // 回复也通过 host.send 发出
  assert.ok(ctx.host.sent.length >= 8)
  assert.equal(ctx.host.sent[0].type, 'result')
})
