const test = require('node:test')
const assert = require('node:assert/strict')
const { startGame, frames, run } = require('./helpers')

const GAME = 'src/plugins/game.tsx'

function files(source) {
  return new Map([
    ['manifest.json', JSON.stringify({ id: 'builtin.world', plugins: ['game'] })],
    [GAME, source],
  ])
}

async function start(source) {
  const ctx = await startGame(files(source))
  assert.deepEqual(ctx.runtime.failures, [])
  return ctx
}

const w = (runtime) => runtime.root.world
const near = (a, b, msg, eps = 1e-6) => a.forEach((v, i) => assert.ok(Math.abs(v - b[i]) < eps, `${msg}：${a} ≈ ${b}`))
/** 用小帧推进恰好 n 步 */
function steps(runtime, n) {
  const target = w(runtime).tick + n
  for (let i = 0; i < 100000 && w(runtime).tick < target; i++) runtime.tick(1 / 240)
}

const game = (scene, rest = '') => `import { defineGame, definePrefab, defineBlock } from '@pot/core'
${rest}
export default defineGame({ scene: () => <>${scene}</> })
`

test('系统积木与预制件在 WorldService 构造时登记；系统预制件只有 entity', async () => {
  const { runtime } = await start(game(''))
  const registry = w(runtime).registry
  for (const name of ['shape', 'spin', 'moveTopdown', 'trigger', 'lifetime', 'projectile', 'cameraFollow', 'light']) assert.ok(registry.block(name), name)
  assert.ok(registry.prefab('entity'))
  for (const name of ['player', 'coin', 'ground', 'wall', 'bullet']) assert.equal(registry.prefab(name), undefined, name)
})

test('shape、spin：形状与颜色、缩放乘到实体上；spin 每秒转 speed 度', async () => {
  const def = "const Coin = definePrefab('coin', { tags: ['coin'], shape: { kind: 'sphere', scale: 0.5 }, spin: { speed: 90 } })"
  const { runtime, engine } = await start(game('<Coin key="c" at={[1, 0.5, 2]} scale={2} /><entity key="w" name="wall" shape={{ kind: "cylinder", color: "#ff0000" }} />', def))
  steps(runtime, 30)
  frames(runtime, 1, 1e-9)
  const coin = engine.byName('coin')[0]
  assert.equal(coin.shape, 'sphere')
  near(coin.scale, [1, 1, 1], '实体 2 × 形状 0.5')
  const e = w(runtime).query('coin')[0]
  assert.ok(Math.abs(e.rot[1] - 90 * 30 * w(runtime).dt) < 1e-9, `rot = ${e.rot}`)
  const wall = engine.byName('wall')[0]
  assert.equal(wall.shape, 'cylinder')
  assert.deepEqual(wall.color, [1, 0, 0, 1])
})

test('bullet：projectile 沿 dir 匀速飞，lifetime 到时销毁并发 death', async () => {
  const bullet = "const Bullet = definePrefab('bullet', { tags: ['bullet'], shape: { kind: 'sphere', scale: 0.2 }, projectile: { speed: 20 }, lifetime: { seconds: 2 } })"
  const { runtime, engine } = await start(game(`
    <rule on="every" seconds={0.5} do={(w) => { if (!w.vars.fired) { w.vars.fired = 1; w.spawn('bullet', { at: [0, 1, 0], projectile: { dir: [3, 0, 4], speed: 10 }, lifetime: { seconds: 1 } }) } }} />
    <rule on="death" a="bullet" do={(w, e) => { w.vars.died = e.pos }} />`, bullet).replace('defineGame({', 'defineGame({ prefabs: [Bullet],'))
  const dt = w(runtime).dt
  const n0 = Math.round(0.5 / dt)
  steps(runtime, n0)
  frames(runtime, 1, 1e-9)
  assert.equal(engine.byName('bullet').length, 1)
  steps(runtime, 10)
  const b = w(runtime).query('bullet')[0]
  near(b.pos, [0.6 * 10 * 10 * dt, 1, 0.8 * 10 * 10 * dt], '10 步', 1e-9)
  steps(runtime, Math.round(1 / dt))
  frames(runtime, 1, 1e-9)
  assert.equal(w(runtime).count('bullet'), 0)
  assert.ok(Array.isArray(w(runtime).vars.died))
  assert.equal(engine.byName('bullet').length, 0)
})

test('cameraFollow 每帧把相机放到实体加 offset 处并看向它；light 生成跟随实体的点光源', async () => {
  const { runtime, engine } = await start(game('<entity key="p" name="player" tags={["player"]} shape={{ kind: "cube" }} moveTopdown at={[1, 0.5, 0]} cameraFollow={{ offset: [0, 5, -5] }} light={{ intensity: 2 }} />'))
  engine.axes.move = [1, 0]
  steps(runtime, 12)
  engine.axes.move = [0, 0]
  steps(runtime, 1)
  frames(runtime, 1, 1e-9)
  const p = w(runtime).query('player')[0].pos
  near(engine.camera.position, [p[0], p[1] + 5, p[2] - 5], '相机位置')
  near(engine.camera.target, p, '看向玩家')
  const lights = [...engine.objects.values()].filter((o) => o.light === 'point')
  assert.equal(lights.length, 1)
  assert.equal(lights[0].intensity, 2)
  near(lights[0].position, p, '跟随实体')
})

test('游戏的同名积木与预制件覆盖系统的；去掉后露出系统的', async () => {
  const over = `const entity = definePrefab('entity', { tags: ['c'], shape: { kind: 'cube', color: '#00ff00' } })
const spin = defineBlock({ name: 'spin', about: '反着转', props: { speed: 90 }, step(me, e, w) { e.rot[1] -= me.speed * w.dt } })`
  const source = game('<entity key="c" name="c" />', over).replace('defineGame({', 'defineGame({ prefabs: [entity], blocks: [spin],')
  const ctx = await startGame(files(source.replace("shape: { kind: 'cube', color: '#00ff00' } })", "shape: { kind: 'cube', color: '#00ff00' }, spin: true })")))
  const { runtime, engine } = ctx
  assert.deepEqual(runtime.failures, [])
  steps(runtime, 10)
  frames(runtime, 1, 1e-9)
  assert.equal(engine.byName('c')[0].shape, 'cube', '游戏的预制件')
  assert.ok(w(runtime).query('c')[0].rot[1] < 0, '游戏的积木')

  ctx.files.set(GAME, game('<entity key="c" name="c" />'))
  const reply = await run(runtime, ctx.pot.devtools.handle({ id: 1, type: 'changed', paths: [GAME] }))
  assert.equal(reply.data.ok, true, reply.data.error)
  assert.equal(w(runtime).registry.block('spin').about.includes('反着转'), false, '露出系统 spin')
  assert.equal(w(runtime).registry.prefab('entity').def.shape, undefined, '露出系统 entity')
})

test('controls：defineGame 的映射生效，单元撤销后恢复默认', async () => {
  const source = `import { defineGame, defineBlock } from '@pot/core'
const jumps = defineBlock({ name: 'jumps', about: '数跳', state: { n: 0 }, step(me, e, w) { if (w.cmd().pressed('jump')) me.n++ } })
export default defineGame({ blocks: [jumps], controls: { actions: { jump: 'k' } }, scene: () => <entity key="e" jumps /> })
`
  const ctx = await start(source)
  const { runtime, engine } = ctx
  assert.deepEqual(w(runtime).controls.actions.jump, 'k')
  engine.keys.add('k')
  steps(runtime, 2)
  engine.keys.delete('k')
  steps(runtime, 2)
  assert.equal(w(runtime).query()[0].b.jumps.n, 1)
  ctx.files.set(GAME, source.replace("controls: { actions: { jump: 'k' } }, ", ''))
  const reply = await run(runtime, ctx.pot.devtools.handle({ id: 1, type: 'changed', paths: [GAME] }))
  assert.equal(reply.data.ok, true, reply.data.error)
  assert.deepEqual(w(runtime).controls.actions.jump, ['space'])
})
