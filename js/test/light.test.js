const test = require('node:test')
const assert = require('node:assert/strict')
const { startGame } = require('./helpers')

async function setup() {
  const ctx = await startGame(new Map([
    ['manifest.json', JSON.stringify({ id: 'light', plugins: ['a'] })],
    ['src/plugins/a.js', `export const name = 'a'\nexport function apply() {}\n`],
  ]))
  return { scene: ctx.runtime.scene, engine: ctx.engine, runtime: ctx.runtime }
}

test('light units：默认 unity 原样；three 按 1/π 换算，intensity() 沿用同一单位', async () => {
  const { scene, engine } = await setup()
  const u = scene.light({ type: 'point', intensity: 2 })
  assert.equal(engine._get(u.id).intensity, 2)
  const t = scene.light({ type: 'point', intensity: 30, units: 'three' })
  assert.ok(Math.abs(engine._get(t.id).intensity - 30 / Math.PI) < 1e-9)
  t.intensity(10)
  assert.ok(Math.abs(engine._get(t.id).intensity - 10 / Math.PI) < 1e-9)
  u.intensity(3)
  assert.equal(engine._get(u.id).intensity, 3)
  const sun = scene.light({ type: 'directional', intensity: Math.PI, units: 'three' })
  assert.ok(Math.abs(engine._get(sun.id).intensity - 1) < 1e-9, '平行光同样换算')
  assert.throws(() => scene.light({ intensity: 1, units: 'lux' }), /未知的 units/)
})

test('light units：three 的 distance > 0 作为 range，0 时用 range 或默认 10；销毁后清掉系数', async () => {
  const { scene, engine } = await setup()
  const calls = []
  const orig = engine.light.bind(engine)
  engine.light = (id, type, intensity, r, g, b, range) => { calls.push(range); return orig(id, type, intensity, r, g, b, range) }
  scene.light({ type: 'point', units: 'three', distance: 7 })
  scene.light({ type: 'point', units: 'three', distance: 0 })
  scene.light({ type: 'point', units: 'three', distance: 0, range: 15 })
  scene.light({ type: 'point', distance: 7 })
  assert.deepEqual(calls, [7, 10, 15, 10])
  const l = scene.light({ type: 'point', units: 'three' })
  assert.ok(scene.lightScale.has(l.id))
  l.destroy()
  assert.ok(!scene.lightScale.has(l.id))
})
