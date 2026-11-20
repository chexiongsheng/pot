const test = require('node:test')
const assert = require('node:assert/strict')
const { startGame } = require('./helpers')

async function setup() {
  const ctx = await startGame(new Map([
    ['manifest.json', JSON.stringify({ id: 'ray', plugins: ['a'] })],
    ['src/plugins/a.js', `export const name = 'a'\nexport function apply() {}\n`],
  ]))
  return { scene: ctx.runtime.scene, engine: ctx.engine }
}

const near = (a, b) => a.every((v, i) => Math.abs(v - b[i]) < 1e-6)
const PLANES = [
  { y: 0, region: { maxX: 30 }, tag: 'ground' },
  { y: -1.6, region: { minX: 30 }, tag: 'water' },
]

test('raycast planes：没有碰撞体时命中地坪 / 海面，方向不必归一化', async () => {
  const { scene } = await setup()
  const g = scene.raycast([0, 2, 0], [1, -1, 0], { planes: PLANES })
  assert.equal(g.id, -1)
  assert.equal(g.entity, undefined)
  assert.equal(g.tag, 'ground')
  assert.equal(g.plane, 0)
  assert.ok(near(g.point, [2, 0, 0]))
  assert.ok(near(g.normal, [0, 1, 0]))
  assert.ok(Math.abs(g.distance - Math.SQRT2 * 2) < 1e-6)

  const w = scene.raycast([40, 2, 0], [0, -10, 0], { planes: PLANES })
  assert.equal(w.tag, 'water')
  assert.ok(near(w.point, [40, -1.6, 0]))

  assert.equal(scene.raycast([0, 2, 0], [0, 1, 0], { planes: PLANES }), null, '朝上不命中单面水平面')
  assert.equal(scene.raycast([0, 2, 0], [1, 0, 0], { planes: PLANES }), null, '平行不命中')
  assert.equal(scene.raycast([0, 2, 0], [0, -1, 0], { planes: PLANES, maxDistance: 1 }), null, '超出 maxDistance')
  assert.equal(scene.raycast([0, -1, 0], [0, -1, 0], { planes: PLANES }), null, '平面在身后')
})

test('raycast planes：与碰撞体命中取最近；任意法线与双面平面', async () => {
  const { scene, engine } = await setup()
  engine.nextHit = { id: 5, point: [0, 1, 0], normal: [0, 1, 0], distance: 1 }
  const first = scene.raycast([0, 2, 0], [0, -1, 0], { planes: PLANES })
  assert.equal(first.id, 5, '碰撞体更近')
  assert.ok(first.entity)
  engine.nextHit = { id: 5, point: [0, -3, 0], normal: [0, 1, 0], distance: 5 }
  const second = scene.raycast([0, 2, 0], [0, -1, 0], { planes: PLANES })
  assert.equal(second.tag, 'ground', '平面更近')
  engine.nextHit = null

  const wall = { point: [0, 0, 10], normal: [0, 0, -2], tag: 'wall' }
  const hw = scene.raycast([0, 0, 0], [0, 0, 1], { planes: [wall] })
  assert.ok(near(hw.point, [0, 0, 10]))
  assert.ok(near(hw.normal, [0, 0, -1]), '法线归一化')
  assert.equal(scene.raycast([0, 0, 20], [0, 0, -1], { planes: [wall] }), null, '背面不命中')
  const back = scene.raycast([0, 0, 20], [0, 0, -1], { planes: [{ ...wall, twoSided: true }] })
  assert.ok(near(back.normal, [0, 0, 1]), '双面时法线朝向射线来处')
})
