const test = require('node:test')
const assert = require('node:assert/strict')
const { startHello, startGame, frames, run } = require('./helpers')

/** 修改游戏源文件（模拟编辑器保存），返回路径 */
function edit(ctx, file, transform) {
  const content = typeof transform === 'function' ? transform(ctx.files.get(file)) : transform
  if (content === null) ctx.files.delete(file)
  else ctx.files.set(file, content)
  return file
}

/** 模拟 Runner 监听到文件变化 */
async function changed(ctx, ...paths) {
  const reply = await run(ctx.runtime, ctx.pot.devtools.handle({ id: 1, type: 'changed', paths }))
  assert.equal(reply.ok, true, reply.error)
  return reply.data
}

const PLAYER = 'src/plugins/player.ts'
const WORLD = 'src/plugins/world.ts'
const COINS = 'src/plugins/coins.ts'

test('热重载 player：state 保留，对象重建，无泄漏', async () => {
  const ctx = await startHello()
  const { runtime, engine } = ctx
  engine.axes.move = [1, 0]
  frames(runtime, 30)
  engine.axes.move = [0, 0]
  const before = runtime.state.get('player')
  const x = before.position[0]
  const oldId = engine.byName('player')[0].id

  const result = await changed(ctx, edit(ctx, PLAYER, (c) => c.replace('#4fc3f7', '#ff0000')))
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

test('内容未变的单元被跳过', async () => {
  const ctx = await startHello()
  const result = await changed(ctx, PLAYER)
  assert.deepEqual(result.units, [])
  assert.deepEqual(result.skipped, ['player'])
})

test('apply 抛错时回滚：旧版本恢复运行，state 恢复；报错栈指向 TS 源码行', async () => {
  const ctx = await startHello()
  const { runtime, engine } = ctx
  const player = runtime.state.get('player')
  player.position[0] = 2
  edit(ctx, PLAYER, (c) => c.replace(/(  const body = )/, '  state.position[0] = 999\n  throw new Error("新版本坏了")\n$1'))
  const line = ctx.files.get(PLAYER).split('\n').findIndex((l) => l.includes('新版本坏了')) + 1
  const result = await changed(ctx, PLAYER)
  assert.equal(result.ok, false)
  assert.equal(result.rolledBack, true)
  assert.equal(result.phase, 'apply')
  assert.match(result.error, /新版本坏了/)
  assert.match(result.error, new RegExp(`src/plugins/player\\.ts:${line}:`), result.error)

  assert.equal(runtime.state.get('player').position[0], 2, 'state 回滚')
  assert.equal(engine.byName('player').length, 1, '旧版本重新挂载')
  engine.axes.move = [1, 0]
  frames(runtime, 12)
  assert.ok(runtime.state.get('player').position[0] > 2, '旧版本仍在响应输入')
})

test('语法错误在 preload 阶段失败，运行中的版本不受影响', async () => {
  const ctx = await startHello()
  const oldHash = ctx.runtime.plugins.units.get('coins').hash
  const result = await changed(ctx, edit(ctx, COINS, (c) => c.replace('export function apply', 'export function apply((')))
  assert.equal(result.ok, false)
  assert.equal(result.phase, 'preload')
  assert.equal(result.rolledBack, false)
  assert.match(result.error, /src\/plugins\/coins\.ts:\d+/)
  assert.equal(ctx.runtime.plugins.units.get('coins').hash, oldHash)
  assert.equal(ctx.engine.byName('coin0').length, 1)
})

test('数据文件变化：重载读过它的单元', async () => {
  const ctx = await startHello()
  const data = JSON.parse(ctx.files.get('data/coins.json'))
  data.coins.push([7, 0.5, 7])
  const result = await changed(ctx, edit(ctx, 'data/coins.json', JSON.stringify(data)))
  assert.deepEqual(result.units, ['coins'])
  assert.equal(ctx.engine.byName('coin5').length, 1)
  assert.equal(ctx.engine.byName('player').length, 1, '不相关单元不受影响')
})

test('重载父单元 world：嵌套的 player/coins 随之重建，只保留一份', async () => {
  const ctx = await startHello()
  const { engine, runtime } = ctx
  runtime.state.get('player').score = 3
  const result = await changed(ctx, edit(ctx, WORLD, (c) => c.replace('#1e2230', '#000000')))
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
  const { engine } = ctx
  const result = await changed(ctx,
    edit(ctx, WORLD, (c) => c.replace('#1e2230', '#010101')),
    edit(ctx, PLAYER, (c) => c.replace('#4fc3f7', '#00ff00')))
  assert.deepEqual(result.units.sort(), ['player', 'world'])
  assert.equal(engine.byName('player').length, 1)
  assert.deepEqual(engine.byName('player')[0].color, [0, 1, 0, 1])
  assert.equal(engine.byName('ground').length, 1)
})

test('泄漏检测：旧版本被全局变量持有时报告', async () => {
  const ctx = await startHello()
  const leaky = (c) => c.replace(/(export function apply\(ctx[^)]*\) \{)/, '$1\n  ;(globalThis as any).__leak = (globalThis as any).__leak || []; (globalThis as any).__leak.push(() => ctx)')
  await changed(ctx, edit(ctx, COINS, leaky))
  const result = await changed(ctx, edit(ctx, COINS, (c) => c.replace('拾取', '捡到') + '\n// v2\n'))
  assert.equal(result.ok, true, result.error)
  assert.ok(result.leaks.length > 0, '应检测到泄漏')
  assert.ok(result.leaks.some((l) => /coins/.test(l)))
  delete globalThis.__leak
})

test('共享模块：改动后依赖它的单元一起重载，且两个单元共用同一实例', async () => {
  const files = new Map([
    ['manifest.json', JSON.stringify({ id: 'shared', plugins: ['a', 'b'] })],
    ['src/lib/palette.ts', "export const color: string = '#ff0000'\nexport const instance = {}\n"],
    ['src/lib/unused.ts', 'export const x = 1\n'],
    ['src/plugins/a.ts', "import type { Context } from '@pot/core'\nimport { color, instance } from '../lib/palette'\nexport const name = 'a'\nexport function apply(ctx: Context) {\n  ctx.scene.spawn({ name: 'a', color })\n  ;(globalThis as any).__inst_a = instance\n}\n"],
    ['src/plugins/b.ts', "import * as palette from '../lib/palette'\nexport const name = 'b'\nexport function apply(ctx) {\n  ctx.scene.spawn({ name: 'b', color: palette.color })\n  ;(globalThis as any).__inst_b = palette.instance\n}\n"],
    ['src/plugins/c.ts', "export const name = 'c'\nexport function apply() {}\n"],
  ])
  const ctx = await startGame(files)
  assert.deepEqual(ctx.runtime.failures, [])
  assert.equal(globalThis.__inst_a, globalThis.__inst_b, '同一个共享模块实例')
  assert.deepEqual(ctx.engine.byName('a')[0].color, [1, 0, 0, 1])

  // 不被任何单元依赖的文件变化：不重载
  assert.deepEqual((await changed(ctx, edit(ctx, 'src/lib/unused.ts', 'export const x = 2\n'))).units, [])

  const result = await changed(ctx, edit(ctx, 'src/lib/palette.ts', (c) => c.replace('#ff0000', '#0000ff')))
  assert.equal(result.ok, true, result.error)
  assert.deepEqual(result.units.sort(), ['a', 'b'])
  assert.deepEqual(ctx.engine.byName('a')[0].color, [0, 0, 1, 1])
  assert.deepEqual(ctx.engine.byName('b')[0].color, [0, 0, 1, 1])
  assert.equal(globalThis.__inst_a, globalThis.__inst_b, '重载后仍是同一个实例')

  const modules = (await run(ctx.runtime, ctx.pot.devtools.handle({ id: 2, type: 'query', what: 'modules' }))).data
  assert.deepEqual(modules.units.a.sort(), ['src/lib/palette.ts', 'src/plugins/a.ts'])

  // 找不到模块：清晰报错
  const bad = await changed(ctx, edit(ctx, 'src/plugins/b.ts', (c) => c.replace('../lib/palette', '../lib/nope')))
  assert.equal(bad.ok, false)
  assert.match(bad.error, /找不到模块 "\.\.\/lib\/nope"/)
  delete globalThis.__inst_a
  delete globalThis.__inst_b
})

test('agent：eval / state / plugins / query / time / reload', async () => {
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
  const forced = (await call({ type: 'reload', units: ['coins'] })).data
  assert.deepEqual(forced.units, ['coins'])
  const t = (await call({ type: 'time', action: 'pause' })).data
  assert.equal(t.paused, true)
  assert.equal((await call({ type: 'unknown' })).ok, false)
  // 回复也通过 host.send 发出
  assert.ok(ctx.host.sent.length >= 9)
  assert.equal(ctx.host.sent[0].type, 'result')
})

test('changed()：Runner 文件监听入口，结果写日志并发 reload 事件', async () => {
  const ctx = await startHello()
  edit(ctx, PLAYER, (c) => c.replace('#4fc3f7', '#123456'))
  const result = await run(ctx.runtime, ctx.pot.devtools.changed(JSON.stringify([PLAYER])))
  assert.equal(result.ok, true)
  assert.ok(ctx.host.logs.some((l) => /热重载 player/.test(l.text)))
  const event = ctx.host.sent.find((m) => m.type === 'event' && m.name === 'reload')
  assert.ok(event)
  assert.deepEqual(event.data.paths, [PLAYER])
})

test('启动时语法错误的入口单元：修好代码后自动挂载，无需冷重启', async () => {
  const { readGameFiles } = require('./helpers')
  const path = require('node:path')
  const files = readGameFiles(path.join(__dirname, '../../games/hello'))
  const good = files.get(WORLD)
  files.set(WORLD, good.replace("ctx.use('coins')", "ctx.use('coins'"))
  const ctx = await startGame(files)
  assert.equal(ctx.runtime.failures.length, 1)
  assert.equal(ctx.engine.byName('player').length, 0)
  const result = await changed(ctx, edit(ctx, WORLD, good))
  assert.deepEqual(result.mounted, ['world'])
  assert.equal(ctx.runtime.failures.length, 0)
  assert.equal(ctx.engine.byName('player').length, 1)
})
