const test = require('node:test')
const assert = require('node:assert/strict')
const { startHello, startGame, frames, run, unit } = require('./helpers')

test('hello 游戏启动：world 嵌套挂载 player 与 coins', async () => {
  const { runtime, engine } = await startHello()
  assert.equal(runtime.status, 'running')
  assert.deepEqual(runtime.failures, [])
  const units = runtime.plugins.list().map((u) => u.name).sort()
  assert.deepEqual(units, ['coins', 'player', 'world'])
  assert.equal(engine.byName('player').length, 1)
  assert.equal(engine.byName('ground').length, 1)
  assert.equal(engine.byName('coin0').length, 1)
  assert.deepEqual(engine.camera.target, [0, 0, 0])
  // 场景登记归属
  assert.equal(runtime.scene.list('player').length, 1)
  assert.equal(runtime.scene.list('coins').length, 5)
  // data 依赖记录
  assert.deepEqual(runtime.data.readers('coins.json'), ['coins'])
})

test('输入驱动移动，靠近金币时拾取并加分', async () => {
  const { runtime, engine } = await startHello()
  engine.axes.move = [1, 0]
  frames(runtime, 60) // speed 5 → 约 5 米
  const player = runtime.state.get('player')
  assert.ok(Math.abs(player.position[0] - 5) < 0.01, `x=${player.position[0]}`)
  assert.deepEqual(engine.byName('player')[0].position, player.position)

  // 走到 [3, 0.5, 2] 的金币
  player.position[0] = 3
  player.position[2] = 2
  engine.axes.move = [0, 0]
  frames(runtime, 1)
  assert.equal(player.score, 1)
  assert.deepEqual(runtime.state.get('coins').collected, [0])
  assert.equal(engine.byName('coin0').length, 0)
})

test('state 跨冷重启保留：exportState → 新运行时 importState', async () => {
  const first = await startHello()
  first.engine.axes.move = [0, 1]
  frames(first.runtime, 30)
  const json = first.runtime.exportState()
  const z = first.runtime.state.get('player').position[2]
  await first.runtime.stop()
  assert.equal(first.engine.objects.size, 0, 'stop 后所有对象被清理')

  const second = await startHello({ state: json })
  assert.equal(second.runtime.state.get('player').position[2], z)
  assert.deepEqual(second.engine.byName('player')[0].position, second.runtime.state.get('player').position)
})

test('单元启动失败不影响其他单元', async () => {
  const files = new Map([
    ['manifest.json', JSON.stringify({ id: 't', apiVersion: '0.1', plugins: ['bad', 'good'] })],
    ['src/plugins/bad.js', unit('bad', 'throw new Error("boom")')],
    ['src/plugins/good.js', unit('good', 'ctx.scene.spawn({ name: "ok" })')],
  ])
  const { runtime, engine } = await startGame(files)
  assert.equal(runtime.failures.length, 1)
  assert.equal(runtime.failures[0].name, 'bad')
  assert.match(runtime.failures[0].error, /boom/)
  assert.equal(engine.byName('ok').length, 1)
})

test('导出名与文件名不一致时报错', async () => {
  const files = new Map([
    ['manifest.json', JSON.stringify({ id: 't', plugins: ['a'] })],
    ['src/plugins/a.js', unit('b', '')],
  ])
  const { runtime } = await startGame(files)
  assert.match(runtime.failures[0].error, /必须一致/)
})

test('timer 走游戏时间，暂停/冻结时不走，插件卸载时清理', async () => {
  const files = new Map([
    ['manifest.json', JSON.stringify({ id: 't', plugins: ['t'] })],
    ['src/plugins/t.js', unit('t', `
      const s = ctx.state.define('t', { init: () => ({ fired: 0, ticks: 0 }) })
      ctx.timeout(() => s.fired++, 500)
      ctx.interval(() => s.ticks++, 125)
    `)],
  ])
  const { runtime } = await startGame(files)
  const s = runtime.state.get('t')
  const dt = 1 / 32
  frames(runtime, 12, dt) // 0.375s
  assert.equal(s.fired, 0)
  assert.equal(s.ticks, 3)
  runtime.clock.pause()
  frames(runtime, 50, dt)
  assert.equal(s.fired, 0)
  runtime.clock.resume()
  const release = runtime.clock.freeze()
  frames(runtime, 50, dt)
  assert.equal(s.fired, 0)
  release()
  frames(runtime, 6, dt) // 0.5625s
  assert.equal(s.fired, 1)
  assert.equal(s.ticks, 4)
  assert.ok(runtime.clock.pending > 0)
  await runtime.stop()
  assert.equal(runtime.clock.pending, 0, '卸载后定时器全部取消')
})

test('ctx.timeout(ms) 返回 Promise，waitFrames 按宿主帧计数', async () => {
  const files = new Map([
    ['manifest.json', JSON.stringify({ id: 't', plugins: ['t'] })],
    ['src/plugins/t.js', unit('t', `
      const s = ctx.state.define('t', { init: () => ({ done: false }) })
      ctx.timeout(200).then(() => { s.done = true })
    `)],
  ])
  const { runtime } = await startGame(files)
  await run(runtime, runtime.clock.waitFrames(5), 0.05)
  assert.equal(runtime.state.get('t').done, true)
})
