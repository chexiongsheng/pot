const test = require('node:test')
const assert = require('node:assert/strict')
const { frames } = require('./helpers')
const { startWorld, reloadGame, world, data, byPath } = require('./world-helpers')

const DEATHS = `w.mergeVars({ deaths: 0 })`
const deathRule = '<rule on="death" do={(w) => { w.vars.deaths++ }} />'

test('world 数据：构造时 define，归属 (host)；每个 key 的记录带规范化的 last', async () => {
  const { runtime } = await startWorld({ body: 'w.mount(<thing key="t" at={[1, 2, 3]} counter={{ by: 2 }} />)' })
  assert.equal(runtime.state.info().find((i) => i.key === 'world').owner, '(host)')
  const e = byPath(runtime, 'thing:t')
  assert.deepEqual(e.pos, [1, 2, 3])
  assert.deepEqual(e.b.counter, { n: 0, inits: 1, by: 2 }, '状态取默认值，调用了 init')
  assert.equal(e.mount, 'game')
  assert.equal(e.path, 'thing:t')
  const rec = data(runtime).mounts.game.keys['thing:t']
  assert.equal(rec.id, e.id)
  assert.equal(rec.dead, false)
  assert.equal(JSON.parse(rec.last).prefab, 'thing')
  frames(runtime, 3)
  assert.equal(e.b.counter.n, 6)
  assert.equal(world(runtime).tick, 3)
})

test('对比：活着的实体原地更新，at 未变时不被拉回；积木属性覆盖、状态不动；积木增删', async () => {
  const tree = (thing, at = '[0, 0.5, 0]') => `w.mount(<><player key="p" at={${at}} />${thing}</>)`
  const ctx = await startWorld({ body: tree('<thing key="t" counter={{ by: 2 }} tags={["a"]} />') })
  const { runtime, engine } = ctx
  engine.axes.move = [1, 0]
  frames(runtime, 30)
  engine.axes.move = [0, 0]
  const player = byPath(runtime, 'player:p')
  const thing = byPath(runtime, 'thing:t')
  const x = player.pos[0]
  assert.ok(x > 2, `玩家走动了：${x}`)
  const n = thing.b.counter.n

  await reloadGame(ctx, { body: tree('<thing key="t" counter={{ by: 3 }} tint tags={["b"]} />') })
  const thing2 = byPath(runtime, 'thing:t')
  assert.equal(thing2.id, thing.id, '同一实体')
  assert.equal(byPath(runtime, 'player:p').pos[0], x, 'at 没变，玩家留在走到的位置')
  assert.ok(thing2.b.counter.n >= n, '状态字段不动')
  assert.equal(thing2.b.counter.by, 3, '属性字段覆盖')
  assert.equal(thing2.b.counter.inits, 1, '已有积木不重新 init')
  assert.deepEqual(thing2.b.tint, { color: '#ffffff', size: { x: 1, y: 1 } }, '新增的积木加上')
  assert.deepEqual(thing2.tags, ['b'])

  await reloadGame(ctx, { body: tree('<thing key="t" counter={{ by: 3 }} />', '[5, 0.5, 1]') })
  assert.deepEqual(byPath(runtime, 'player:p').pos, [5, 0.5, 1], 'at 变了才写回')
  assert.equal(byPath(runtime, 'thing:t').b.tint, undefined, '消失的积木去掉')
})

test('对比：prefab 变了先销毁再创建；新树里没有的销毁并删记录；都不发 death', async () => {
  const ctx = await startWorld({ body: `${DEATHS}; w.mount(<>${deathRule}<thing key="x" /><coin key="c" /></>)` })
  const { runtime } = ctx
  const old = byPath(runtime, 'thing:x')
  await reloadGame(ctx, { body: `${DEATHS}; w.mount(<>${deathRule}<coin key="x" /></>)` })
  frames(runtime, 2)
  const fresh = byPath(runtime, 'coin:x')
  assert.ok(fresh)
  assert.notEqual(fresh.id, old.id)
  assert.equal(data(runtime).entities[old.id], undefined)
  assert.equal(byPath(runtime, 'coin:c'), undefined)
  assert.equal(data(runtime).mounts.game.keys['coin:c'], undefined, '记录删掉')
  assert.equal(world(runtime).vars.deaths, 0, '对比造成的销毁不发 death')
})

test('对比：玩法中销毁的实体标 dead，重新求值不重建；从树里去掉后再加回来才重建', async () => {
  const coins = (list) => `${DEATHS}; w.mount(<>${deathRule}${list.map((k) => `<coin key="${k}" />`).join('')}</>)`
  const ctx = await startWorld({ body: coins(['c1', 'c2']) })
  const { runtime } = ctx
  const c1 = byPath(runtime, 'coin:c1')
  world(runtime).destroy(c1)
  assert.equal(world(runtime).count('coin'), 1, '待销毁的不计入 query')
  frames(runtime, 1)
  assert.equal(world(runtime).vars.deaths, 1, '玩法销毁发 death')
  assert.equal(data(runtime).mounts.game.keys['coin:c1'].dead, true)

  await reloadGame(ctx, { body: coins(['c1', 'c2']) + ' // 改一下' })
  assert.equal(byPath(runtime, 'coin:c1'), undefined, 'dead 的不重建')
  assert.equal(world(runtime).count('coin'), 1)

  await reloadGame(ctx, { body: coins(['c2']) })
  assert.equal(data(runtime).mounts.game.keys['coin:c1'], undefined)
  await reloadGame(ctx, { body: coins(['c1', 'c2']) })
  assert.ok(byPath(runtime, 'coin:c1'), '记录删掉后再出现就是新的')
  assert.equal(world(runtime).count('coin'), 2)
})

test('vars 合并：已有的键保留，新键补初值', async () => {
  const ctx = await startWorld({ body: 'w.mergeVars({ score: 0 }); w.mount(null)' })
  world(ctx.runtime).vars.score = 7
  await reloadGame(ctx, { body: "w.mergeVars({ score: 0, lives: 3, list: [1] }); w.mount(null)" })
  assert.deepEqual(world(ctx.runtime).vars, { score: 7, lives: 3, list: [1] })
})

test('同一个挂载 id 不能被两个单元使用；挂载 id 缺省为单元名', async () => {
  const { startGame } = require('./helpers')
  const { worldFiles } = require('./world-helpers')
  const files = worldFiles({ body: "w.mount(<coin key=\"c\" />); w.mount(<thing key=\"t\" />, { id: 'other' })" }, {
    plugins: ['game', 'b'],
    extra: { 'src/plugins/b.tsx': "import type { Context } from '@pot/core'\nimport { definePrefab } from '@pot/core'\nexport const name = 'b'\nexport function apply(ctx: Context) { ctx.world.mount(definePrefab('thing2', {})({}), { id: 'other' }) }\n" },
  })
  const { runtime } = await startGame(files)
  assert.deepEqual(runtime.failures.map((f) => f.name), ['b'])
  assert.match(runtime.failures[0].error, /挂载 id "other" 已被单元 "game" 使用/)
  assert.ok(data(runtime).mounts.game.keys['coin:c'], '缺省 id 为单元名')
  assert.ok(data(runtime).mounts.other.keys['thing:t'], 'game 不受影响')
})

test('冷重启：importJSON 带回的、本次没有挂载的记录在第一次清扫时销毁；其余实体原样保留', async () => {
  const main = '<><player key="p" /><coin key="c" at={[3, 0.5, 0]} /></>'
  const ctx = await startWorld({ body: `w.mount(${main}); w.mount(<thing key="e" />, { id: 'extra' })` })
  ctx.engine.axes.move = [0, 1]
  frames(ctx.runtime, 20)
  const saved = ctx.runtime.state.exportJSON()
  const before = data(ctx.runtime)
  const z = byPath(ctx.runtime, 'player:p').pos[2]

  const next = await startWorld({ body: `w.mount(${main})` }, { start: { state: saved } })
  const { runtime } = next
  assert.ok(data(runtime).mounts.extra, '清扫前记录还在')
  frames(runtime, 1)
  assert.equal(data(runtime).mounts.extra, undefined)
  assert.equal(world(runtime).count('thing'), 0)
  assert.equal(byPath(runtime, 'player:p').id, before.mounts.game.keys['player:p'].id)
  assert.equal(byPath(runtime, 'player:p').pos[2], z, '玩家位置保留')
  assert.equal(world(runtime).tick, before.tick + 1)
})
