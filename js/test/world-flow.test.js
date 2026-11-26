const test = require('node:test')
const assert = require('node:assert/strict')
const { startGame, frames, run } = require('./helpers')

const GAME = 'src/plugins/game.tsx'

const STATES = `{
    title: { on: { start: 'play' } },
    play: { on: { pause: 'paused', win: 'over' }, enter: (w) => { w.vars.score = 0; w.vars.enters++ } },
    paused: { pause: true, on: { resume: 'play', quit: 'title' } },
    over: { on: { again: 'play' } },
  }`

function source(states = STATES) {
  return `import { defineGame, definePrefab } from '@pot/core'
import topdown from '@pot/kit/topdown'

const Player = definePrefab('player', { tags: ['player'], moveTopdown: true, trigger: { radius: 0 } })
const Coin = definePrefab('coin', { tags: ['coin'], trigger: { radius: 0.5 } })

export default defineGame({
  kits: [topdown],
  vars: { score: 0, enters: 0 },
  flow: { start: 'title', states: ${states} },
  scene: (s) => <>
    {s.state === 'title' && <entity key="logo" name="logo" />}
    {s.state === 'play' && <>
      <Player key="p" at={[0, 0.5, 0]} />
      {[0, 1].map((i) => <Coin key={i} at={[2 + i * 4, 0.5, 0]} />)}
      <rule on="touch" a={Player} b={Coin} do={(w, p, c) => { w.destroy(c); w.vars.score++; if (w.count('coin') === 0) w.emit('win', { score: w.vars.score }) }} />
    </>}
    {s.state === 'over' && <entity key="result" name={'result' + s.params.score} />}
  </>,
})
`
}

const files = (src = source()) => new Map([
  ['manifest.json', JSON.stringify({ id: 'flow.world', plugins: ['game'] })],
  [GAME, src],
])

async function start(src, options) {
  const ctx = await startGame(files(src), options)
  assert.deepEqual(ctx.runtime.failures, [])
  return ctx
}

const w = (runtime) => runtime.root.world
const names = (runtime) => w(runtime).query().map((e) => e.name ?? e.prefab).sort()
const player = (runtime) => w(runtime).query('player')[0]
/** 推进一个固定步（60 fps 下一帧一步） */
const step = (runtime, n = 1) => frames(runtime, n)

async function changed(ctx) {
  const reply = await run(ctx.runtime, ctx.pot.devtools.handle({ id: 1, type: 'changed', paths: [GAME] }))
  assert.equal(reply.data.ok, true, reply.data.error)
}

test('flow：从 start 开始；事件切换状态时场景重建、enter 被调用', async () => {
  const { runtime } = await start()
  step(runtime)
  assert.deepEqual(w(runtime).flow, { state: 'title', params: {}, base: 'title' })
  assert.deepEqual(names(runtime), ['logo'])
  w(runtime).emit('start')
  step(runtime)
  assert.equal(w(runtime).flow.state, 'play')
  assert.deepEqual(names(runtime), ['coin', 'coin', 'player'])
  assert.equal(w(runtime).vars.enters, 1)
})

test('flow：叠加状态不重建场景、模拟暂停、tick 不走；恢复后接着玩', async () => {
  const { runtime, engine } = await start()
  w(runtime).goto('play')
  step(runtime)
  const spawned = w(runtime).spawn('entity', { name: 'spark' })
  engine.axes.move = [1, 0]
  step(runtime, 10)
  w(runtime).emit('pause')
  step(runtime)
  const x = player(runtime).pos[0]
  const tick = w(runtime).tick
  assert.equal(w(runtime).flow.state, 'paused')
  assert.equal(w(runtime).flow.base, 'play')
  step(runtime, 20)
  assert.equal(player(runtime).pos[0], x, '暂停时不动')
  assert.equal(w(runtime).tick, tick, 'tick 不走')
  assert.ok(w(runtime).get(spawned.id), '叠加状态不清 spawn 的实体')
  w(runtime).emit('resume')
  step(runtime, 5)
  assert.equal(w(runtime).flow.state, 'play')
  assert.equal(w(runtime).vars.enters, 1, '恢复不是进入')
  assert.ok(player(runtime).pos[0] > x, '恢复后继续走')
  assert.ok(w(runtime).get(spawned.id))
})

test('flow：从叠加状态进入别的状态会重建，spawn 的实体被清', async () => {
  const { runtime } = await start()
  w(runtime).goto('play')
  step(runtime)
  const spawned = w(runtime).spawn('entity', { name: 'spark' })
  w(runtime).goto('paused')
  step(runtime)
  w(runtime).emit('quit')
  step(runtime)
  assert.equal(w(runtime).flow.state, 'title')
  assert.equal(w(runtime).get(spawned.id), undefined)
  assert.deepEqual(names(runtime), ['logo'])
})

test('flow：事件的普通对象 payload 作为 params；带参数再进入同一状态会重建并重置 vars', async () => {
  const { runtime, engine } = await start()
  w(runtime).goto('play')
  step(runtime)
  engine.axes.move = [1, 0]
  for (let i = 0; i < 600 && w(runtime).flow.state === 'play'; i++) step(runtime)
  engine.axes.move = [0, 0]
  assert.deepEqual(w(runtime).flow, { state: 'over', params: { score: 2 }, base: 'over' })
  assert.deepEqual(names(runtime), ['result2'])
  w(runtime).emit('again')
  step(runtime)
  assert.equal(w(runtime).flow.state, 'play')
  assert.equal(w(runtime).vars.score, 0, 'enter 重置得分')
  assert.equal(w(runtime).vars.enters, 2)
  assert.deepEqual(player(runtime).pos, [0, 0.5, 0], '场景从头建立')
  w(runtime).goto('paused')
  step(runtime)
  w(runtime).goto('play', { level: 2 })
  step(runtime)
  assert.equal(w(runtime).vars.enters, 3, '叠加状态下带参数回到 base 是进入')
})

test('flow：一步里多次 goto 以最后一次为准；未知状态与无 flow 时报错', async () => {
  const { runtime } = await start()
  w(runtime).goto('over', { score: 9 })
  w(runtime).goto('play')
  step(runtime)
  assert.equal(w(runtime).flow.state, 'play')
  assert.throws(() => w(runtime).goto('nope'), /没有状态 "nope"/)
  const plain = await start(`import { defineGame } from '@pot/core'
export default defineGame({ scene: () => <entity key="a" /> })
`)
  assert.throws(() => w(plain.runtime).goto('play'), /没有定义 flow/)
  assert.deepEqual(w(plain.runtime).flow, { state: 'play', params: {}, base: 'play' })
})

test('flow：定义校验在 defineGame 调用处报错', async () => {
  const ctx = await startGame(files(source(`{ a: { on: { go: 'b' } } }`)))
  assert.match(JSON.stringify(ctx.runtime.failures), /切到不存在的状态/)
})

test('flow：热重载保留流程状态与玩家位置；当前状态被删掉时回到 start', async () => {
  const ctx = await start()
  const { runtime, engine } = ctx
  w(runtime).goto('play')
  step(runtime)
  engine.axes.move = [0, 1]
  step(runtime, 10)
  engine.axes.move = [0, 0]
  const pos = [...player(runtime).pos]
  await changed(ctx)
  step(runtime)
  assert.equal(w(runtime).flow.state, 'play')
  assert.deepEqual(player(runtime).pos, pos)
  assert.equal(w(runtime).vars.enters, 1)

  w(runtime).goto('over', { score: 1 })
  step(runtime)
  ctx.files.set(GAME, source(`{
    title: { on: { start: 'play' } },
    play: { on: { pause: 'paused' } },
    paused: { pause: true, on: { resume: 'play' } },
  }`))
  await changed(ctx)
  step(runtime, 2)
  assert.equal(w(runtime).flow.state, 'title')
  assert.deepEqual(names(runtime), ['logo'])
  assert.ok(runtime.host.logs.some((l) => /已不在 flow 里/.test(l.text)))
})

test('flow：冷重启（exportJSON 后启动）保留流程状态与玩家位置', async () => {
  const { runtime, engine } = await start()
  w(runtime).goto('play')
  step(runtime)
  engine.axes.move = [0, 1]
  step(runtime, 10)
  engine.axes.move = [0, 0]
  w(runtime).emit('pause')
  step(runtime)
  const pos = [...player(runtime).pos]
  const cold = await start(source(), { state: runtime.state.exportJSON() })
  step(cold.runtime)
  assert.equal(w(cold.runtime).flow.state, 'paused')
  assert.deepEqual(player(cold.runtime).pos, pos)
  w(cold.runtime).emit('resume')
  step(cold.runtime)
  assert.equal(w(cold.runtime).flow.state, 'play')
  assert.equal(w(cold.runtime).vars.enters, 1)
})

test('flow：标了 keep 的实体在流程切换时保留（同一 key 照常对比属性，新状态没有它才删）', async () => {
  const src = source().replace(`{s.state === 'title' && <entity key="logo" name="logo" />}`,
    `<entity key="stage" keep name={s.state === 'over' ? 'stage-over' : 'stage'} />
    {s.state !== 'title' && <entity key="hud" keep name="hud" />}
    {s.state === 'title' && <entity key="logo" name="logo" />}`)
  const { runtime } = await start(src)
  step(runtime)
  const stage = () => w(runtime).query().find((e) => (e.name ?? '').startsWith('stage'))
  const id = stage().id
  w(runtime).emit('start')
  step(runtime)
  assert.equal(stage().id, id, 'title → play 保留')
  const hud = w(runtime).query().find((e) => e.name === 'hud').id
  w(runtime).emit('win', { score: 2 })
  step(runtime)
  assert.equal(w(runtime).flow.state, 'over')
  assert.equal(stage().id, id, 'play → over 保留')
  assert.equal(stage().name, 'stage-over', '属性照常对比更新')
  assert.equal(w(runtime).query().find((e) => e.name === 'hud').id, hud)
  w(runtime).emit('again')
  step(runtime)
  assert.equal(stage().id, id, '重进 play 仍保留')
  assert.equal(stage().name, 'stage')
  assert.equal(w(runtime).query('player').length, 1, '没标 keep 的照常重建')
  // 新状态的场景里没有了就删（hud 只在非 title）
  const map = files(src.replace("play: { on: { pause: 'paused', win: 'over' }", "play: { on: { pause: 'paused', win: 'over', quit: 'title' }"))
  const g = await start(map.get(GAME))
  step(g.runtime)
  w(g.runtime).emit('start')
  step(g.runtime)
  assert.equal(w(g.runtime).query().filter((e) => e.name === 'hud').length, 1)
  w(g.runtime).emit('quit')
  step(g.runtime)
  assert.equal(w(g.runtime).flow.state, 'title')
  assert.equal(w(g.runtime).query().filter((e) => e.name === 'hud').length, 0, '新状态没有它就删')
})

test('flow：keep 不是布尔值时报错', async () => {
  const src = source().replace(`<entity key="logo" name="logo" />`, `<entity key="logo" name="logo" keep={1 as any} />`)
  const ctx = await startGame(files(src))
  const all = JSON.stringify(ctx.runtime.failures) + ctx.host.logs.map((l) => l.text).join('\n')
  assert.match(all, /keep 必须是 true 或 false/)
})
