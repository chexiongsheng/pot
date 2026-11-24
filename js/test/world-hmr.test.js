const test = require('node:test')
const assert = require('node:assert/strict')
const { startGame, frames, run } = require('./helpers')

const GAME = 'src/plugins/game.tsx'
const COINS = 'data/coins.json'

/** 与 004 第 5.1 节同构的游戏；inc 是吃一个金币加的分，extra 插在场景树末尾 */
function gameSource({ inc = 1, extra = '' } = {}) {
  return `import { defineGame } from '@pot/core'

export default defineGame({
  vars: { score: 0 },
  scene: (s) => <>
    <stage background="#1e2230" sun={{ rot: [50, -30, 0], intensity: 1.1 }} camera={{ at: [0, 12, -10], look: [0, 0, 0] }} />
    <ground scale={2} shape={{ color: '#3a4a3a' }} />
    <player at={[0, 0.5, 0]} moveTopdown={{ speed: 5 }} />
    {s.data.load('coins.json').coins.map((at: [number, number, number], i: number) => <coin key={i} at={at} />)}
    <rule on="touch" a="player" b="coin" do={(w, p, c) => { w.destroy(c); w.vars.score += ${inc} }} />
    ${extra}
  </>,
  ui: (w) => <text at="top-left" size={28}>得分 {w.vars.score}</text>,
})
`
}

const coinsJson = (coins) => JSON.stringify({ coins })

function files({ plugins = ['game'], game = {}, coins = [[2, 0.5, 0], [6, 0.5, 0]] } = {}) {
  return new Map([
    ['manifest.json', JSON.stringify({ id: 'hmr.world', plugins })],
    [GAME, gameSource(game)],
    [COINS, coinsJson(coins)],
  ])
}

async function start(options = {}, startOptions) {
  const ctx = await startGame(files(options), startOptions)
  assert.deepEqual(ctx.runtime.failures, [])
  return ctx
}

async function changed(ctx, paths) {
  const reply = await run(ctx.runtime, ctx.pot.devtools.handle({ id: 1, type: 'changed', paths }))
  assert.equal(reply.ok, true, reply.error)
  assert.equal(reply.data.ok, true, reply.data.error)
  return reply.data
}

const w = (runtime) => runtime.root.world
const data = (runtime) => runtime.state.get('world')
const byPath = (runtime, path) => {
  const rec = data(runtime).mounts.game?.keys[path]
  return rec && !rec.dead ? data(runtime).entities[rec.id] : undefined
}
const texts = (engine) => engine.ui.split('\u001e').map((s) => s.split('\u001f')).filter((t) => t[0] === 't').map((t) => t[9])

/** 按住右键走到 x 不小于 target 为止，然后松开 */
function walkTo(ctx, target) {
  ctx.engine.axes.move = [1, 0]
  for (let i = 0; i < 600 && byPath(ctx.runtime, 'player#0').pos[0] < target; i++) frames(ctx.runtime, 1)
  ctx.engine.axes.move = [0, 0]
  frames(ctx.runtime, 1)
}

test('defineGame：场景挂载、官方预制件出形状、touch 规则加分、界面每帧画得分', async () => {
  const ctx = await start()
  const { runtime, engine } = ctx
  frames(runtime, 1)
  assert.equal(w(runtime).mounts().attached[0], 'game', '挂载 id 为单元名')
  assert.equal(engine.byName('player').length, 1)
  assert.equal(engine.byName('coin').length, 2)
  assert.equal(engine.byName('ground').length, 1)
  assert.deepEqual(engine.byName('player')[0].color, [0x4f / 255, 0xc3 / 255, 0xf7 / 255, 1])
  assert.deepEqual(texts(engine), ['得分 0'])

  walkTo(ctx, 3)
  assert.equal(w(runtime).vars.score, 1)
  assert.equal(engine.byName('coin').length, 1)
  assert.deepEqual(texts(engine), ['得分 1'])
})

test('改 game.tsx：吃掉的金币不回来、玩家位置保留、vars 保留、新规则生效', async () => {
  const ctx = await start()
  const { runtime, engine } = ctx
  walkTo(ctx, 3)
  const x = byPath(runtime, 'player#0').pos[0]
  assert.equal(w(runtime).vars.score, 1)

  ctx.files.set(GAME, gameSource({ inc: 10 }))
  await changed(ctx, [GAME])
  frames(runtime, 1)
  assert.equal(byPath(runtime, 'coin:0'), undefined, '吃掉的金币不回来')
  assert.equal(engine.byName('coin').length, 1)
  assert.equal(byPath(runtime, 'player#0').pos[0], x, '玩家位置保留')
  assert.equal(w(runtime).vars.score, 1, 'vars 保留')
  assert.equal(engine.byName('player').length, 1, '玩家对象没有重复')

  walkTo(ctx, 7)
  assert.equal(w(runtime).vars.score, 11, '新规则生效')
  assert.deepEqual(texts(engine), ['得分 11'])
})

test('改金币坐标：数据文件变化让场景重新求值，金币移过去，玩家不动', async () => {
  const ctx = await start()
  const { runtime, engine } = ctx
  ctx.engine.axes.move = [0, 1]
  frames(runtime, 10)
  ctx.engine.axes.move = [0, 0]
  const z = byPath(runtime, 'player#0').pos[2]
  const id = byPath(runtime, 'coin:1').id

  ctx.files.set(COINS, coinsJson([[2, 0.5, 0], [-4, 0.5, 3]]))
  await changed(ctx, [COINS])
  frames(runtime, 2)
  const coin = byPath(runtime, 'coin:1')
  assert.equal(coin.id, id, '同一个实体')
  assert.deepEqual(coin.pos, [-4, 0.5, 3])
  const obj = engine.byName('coin').find((o) => Math.abs(o.position[0] + 4) < 1e-6)
  assert.ok(obj, '场景对象跟着移动')
  assert.equal(byPath(runtime, 'player#0').pos[2], z, '玩家位置保留')
})

test('改预制件属性（颜色）：表现重做 enter，对象换成新颜色，实体与运行状态不变', async () => {
  const ctx = await start()
  const { runtime, engine } = ctx
  frames(runtime, 1)
  const before = byPath(runtime, 'coin:0')
  ctx.files.set(GAME, gameSource().replace("<coin key={i} at={at} />", "<coin key={i} at={at} shape={{ color: '#ff0000' }} />"))
  await changed(ctx, [GAME])
  frames(runtime, 1)
  assert.equal(byPath(runtime, 'coin:0').id, before.id)
  const coins = engine.byName('coin')
  assert.equal(coins.length, 2, '旧对象已回收')
  assert.deepEqual(coins[0].color, [1, 0, 0, 1])
})

test('从 manifest 去掉单元（冷重启）后，它挂的实体与场景对象全部销毁', async () => {
  const HUD = ['src/plugins/hud.ts', 'export function apply() {}\n']
  const first = await startGame(new Map([...files({ plugins: ['game', 'hud'] }), HUD]))
  assert.deepEqual(first.runtime.failures, [])
  frames(first.runtime, 1)
  assert.ok(w(first.runtime).count() > 0)
  const saved = first.runtime.state.exportJSON()

  const next = await startGame(new Map([...files({ plugins: ['hud'] }), HUD]), { state: saved })
  assert.deepEqual(next.runtime.failures, [])
  frames(next.runtime, 1)
  assert.equal(w(next.runtime).count(), 0)
  assert.equal(data(next.runtime).mounts.game, undefined)
  assert.equal(next.engine.byName('coin').length, 0)
  assert.equal(next.engine.byName('player').length, 0)
})

/** 用小帧推进到恰好第 target 步（每帧最多一步） */
function stepTo(runtime, target) {
  for (let i = 0; i < 100000 && w(runtime).tick < target; i++) runtime.tick(1 / 240)
  assert.equal(w(runtime).tick, target)
}

test('exportJSON 后冷重启：World 数据一致，表现重建，继续玩结果相同', async () => {
  const a = await start()
  walkTo(a, 3)
  const saved = a.runtime.state.exportJSON()
  const snapshot = JSON.parse(JSON.stringify(data(a.runtime)))

  const b = await start({}, { state: saved })
  assert.deepEqual(JSON.parse(JSON.stringify(data(b.runtime))), snapshot, '挂载对比没有改动任何东西')
  frames(b.runtime, 1, 1 / 240)
  assert.equal(b.engine.byName('coin').length, 1)
  assert.equal(b.engine.byName('player').length, 1)
  const target = w(a.runtime).tick + 60
  for (const ctx of [a, b]) {
    ctx.engine.axes.move = [1, 0]
    stepTo(ctx.runtime, target)
  }
  assert.deepEqual(JSON.parse(JSON.stringify(data(b.runtime))), JSON.parse(JSON.stringify(data(a.runtime))))
  assert.equal(w(b.runtime).vars.score, 2)
})
