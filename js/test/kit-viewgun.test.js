/**
 * realistic 的 viewGun（004 第 19.5 节第 7 步）：第一人称枪的样子，按 fps 的 gunFps 计数驱动枪声、命中效果与曳光，
 * 场景查询由 setGunEnv 注入；资源按 World 缓存，热重载与重进不重复编译、不泄漏场景对象。
 */
const test = require('node:test')
const assert = require('node:assert/strict')
const { startGame, run } = require('./helpers')

const DT = 1 / 60
const GAME = 'src/plugins/game.tsx'

function gameSource({ viewGun = true, water = false } = {}) {
  return `import { defineGame, defineBlock } from '@pot/core'
import fps from '@pot/kit/fps'
import realistic, { setGunEnv } from '@pot/kit/realistic'
const Part = defineBlock({
  name: 'part', about: '测试：可被射中的部件', props: { tag: '' },
  view: { enter(me, e, ctx, w) { const o = ctx.scene.spawn({ shape: 'cube', name: 'part' }); w.view.bindPart(o.id, e, me.tag || undefined); (globalThis as any).__part = o.id; return o } },
})
export default defineGame({
  kits: [fps, realistic],
  blocks: [Part],
  load: (ctx) => { ${water ? `setGunEnv(ctx.world, { surface: () => 'water' })` : 'setGunEnv(ctx.world, null)'} },
  scene: () => <>
    <entity key="p" moveFps cameraFps health gunFps={{ hitscan: 'view', magSize: 3, reserveStart: 30 }} ${viewGun ? 'viewGun' : ''} />
    <entity key="t" at={[0, 1.6, 8]} part />
  </>,
})
`
}

async function start(options) {
  const files = new Map([
    ['manifest.json', JSON.stringify({ id: 'viewgun.test', plugins: ['game'] })],
    [GAME, gameSource(options)],
  ])
  const g = await startGame(files)
  assert.deepEqual(g.runtime.failures, [])
  g.engine.locked = true
  steps(g, 2)
  return g
}

const W = (g) => g.runtime.root.world
const player = (g) => W(g).query().find((e) => e.b.gunFps)
const named = (g, name) => [...g.engine.objects.values()].filter((o) => o.name === name)
const played = (g, name) => (g.engine.played ?? []).filter((p) => p.name === `saltline.${name}`).length
const errors = (g) => g.host.logs.filter((l) => l.level === 'error').map((l) => l.text)

/** 推进 n 个固定步（每帧半步） */
function steps(g, n) {
  const w = W(g), target = w.tick + n
  for (let i = 0; i < n * 4 && w.tick < target; i++) g.runtime.tick(DT / 2)
}

/** 按一下再等 8 步（720 发每分钟，每发间隔 5 步） */
function tap(g, key) {
  g.engine.keys.add(key)
  steps(g, 1)
  g.engine.keys.delete(key)
  steps(g, 8)
}

test('viewGun：enter 建视图模型（挂在相机下）与 8 条曳光，开枪放枪声与表面命中音效', async () => {
  const g = await start()
  assert.equal(named(g, 'viewmodel').length, 1)
  assert.equal(named(g, 'viewmodel-fov')[0].parent, 1, '视图模型挂在相机下')
  assert.equal(named(g, 'tracer').length, 8)
  assert.ok(named(g, 'gun').length > 5, '枪身各部件')
  // 打中远处的普通场景对象（不是部件）：按表面放命中音效
  g.engine.nextHit = { id: 99999, point: [0, 1.6, 30], normal: [0, 0, -1], distance: 30 }
  for (let i = 0; i < 3; i++) tap(g, 'mouse0')
  assert.equal(player(g).b.gunFps.shots, 3)
  assert.equal(played(g, 'shot'), 3)
  assert.equal(played(g, 'impact'), 3)
  assert.equal(played(g, 'water'), 0)
  assert.deepEqual(errors(g), [])
})

test('viewGun：打中登记的部件只放光点与火花，不放表面命中音效', async () => {
  const g = await start()
  const part = globalThis.__part
  assert.ok(part > 0)
  g.engine.nextHit = { id: part, point: [0, 1.6, 7.5], normal: [0, 0, -1], distance: 7.5 }
  const before = (g.engine.bursts ?? []).length
  tap(g, 'mouse0')
  assert.equal(played(g, 'shot'), 1)
  assert.equal(played(g, 'impact'), 0)
  if (g.engine.bursts) assert.ok(g.engine.bursts.length - before >= 3, '光点、火花与枪口火光')
})

test('viewGun：setGunEnv 注入表面种类（水面放水花声）', async () => {
  const g = await start({ water: true })
  g.engine.nextHit = { id: 99999, point: [0, 0, 20], normal: [0, 1, 0], distance: 20 }
  tap(g, 'mouse0')
  assert.equal(played(g, 'water'), 1)
  assert.equal(played(g, 'impact'), 0)
})

test('viewGun：打空后空仓声与换弹声；生命归零时隐藏', async () => {
  const g = await start()
  for (let i = 0; i < 3; i++) tap(g, 'mouse0')
  assert.equal(player(g).b.gunFps.mag, 0)
  tap(g, 'mouse0')
  assert.ok(played(g, 'dry') >= 1, '空仓扣扳机')
  assert.equal(played(g, 'reload'), 1, '空仓扣扳机开始换弹')
  assert.equal(named(g, 'viewmodel')[0].active, true)
  player(g).b.health.hp = 0
  steps(g, 2)
  assert.equal(named(g, 'viewmodel')[0].active, false)
})

test('viewGun：热重载去掉再加回，场景对象不增长，着色器只编译一次', async () => {
  const g = await start()
  const base = g.engine.objects.size
  const version = () => [...(g.engine.programs ?? new Map()).entries()].filter(([k]) => k.includes('muzzle')).map(([, v]) => v.version)
  const v0 = version()
  const reload = async (options) => {
    g.files.set(GAME, gameSource(options))
    const reply = await run(g.runtime, g.pot.devtools.handle({ id: 1, type: 'changed', paths: [GAME] }))
    assert.equal(reply.ok, true, reply.error)
    assert.equal(reply.data.ok, true, reply.data.error)
    steps(g, 2)
  }
  await reload({ viewGun: false })
  assert.equal(named(g, 'viewmodel').length, 0)
  assert.equal(named(g, 'tracer').length, 0)
  await reload({ viewGun: true })
  assert.equal(named(g, 'viewmodel').length, 1)
  assert.equal(named(g, 'tracer').length, 8)
  await reload({ viewGun: false })
  await reload({ viewGun: true })
  assert.equal(g.engine.objects.size, base, '对象数不增长')
  assert.deepEqual(version(), v0, '枪口火焰着色器不重复编译')
  assert.deepEqual(errors(g), [])
})
