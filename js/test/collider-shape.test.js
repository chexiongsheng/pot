const test = require('node:test')
const assert = require('node:assert/strict')
const { startGame } = require('./helpers')

async function setup() {
  const ctx = await startGame(new Map([
    ['manifest.json', JSON.stringify({ id: 'col', plugins: ['a'] })],
    ['src/plugins/a.js', `export const name = 'a'\nexport function apply() {}\n`],
  ]))
  return { scene: ctx.runtime.scene, engine: ctx.engine }
}

const TRI = { positions: [0, 0, 0, 1, 0, 0, 0, 1, 0], indices: [0, 1, 2] }

test('spawn collider 形状与 dynamic：转给宿主并打开碰撞体', async () => {
  const { scene, engine } = await setup()
  scene.mesh('m', TRI)
  const a = scene.spawn({ shape: 'mesh:m', collider: 'convex', dynamic: true })
  assert.deepEqual([engine.objects.get(a.id).colliderShape, engine.objects.get(a.id).dynamic, engine.objects.get(a.id).collider], ['convex', true, true])
  const b = scene.spawn({ shape: 'cube', dynamic: true })
  assert.equal(engine.objects.get(b.id).colliderShape, undefined, '只开 dynamic 不换形状')
  assert.equal(engine.objects.get(b.id).dynamic, true)
  const c = scene.spawn({ shape: 'mesh:m' })
  assert.equal(engine.objects.get(c.id).colliderShape, undefined, '默认不额外调用')
  assert.equal(engine.objects.get(c.id).collider, undefined)
  c.collider('box')
  assert.equal(engine.objects.get(c.id).colliderShape, 'box')
  c.collider(false)
  assert.equal(engine.objects.get(c.id).collider, false)
})

test('collider 形状：非法值与宿主错误都抛出', async () => {
  const { scene } = await setup()
  const e = scene.spawn({ shape: 'empty' })
  assert.throws(() => e.collider('sphere'), /形状只能是/)
  assert.throws(() => e.collider('mesh'), /没有网格/)
  assert.throws(() => scene.spawn({ shape: 'empty', collider: 'convex' }), /没有网格/)
})

test('sphereCast：传半径，命中带回实体；radius 须为正', async () => {
  const { scene, engine } = await setup()
  const t = scene.spawn({ shape: 'cube' })
  engine.nextHit = { id: t.id, point: [0, 0, 5], normal: [0, 0, -1], distance: 4.5 }
  const hit = scene.sphereCast([0, 0, 0], [0, 0, 2], 0.5, { maxDistance: 10 })
  assert.equal(hit.entity.id, t.id)
  assert.equal(hit.distance, 4.5)
  assert.equal(engine.lastSphereCast.radius, 0.5)
  engine.nextHit = null
  assert.equal(scene.sphereCast([0, 0, 0], [0, 0, 1], 0.5), null)
  assert.throws(() => scene.sphereCast([0, 0, 0], [0, 0, 1], 0), /radius 须大于 0/)
})
