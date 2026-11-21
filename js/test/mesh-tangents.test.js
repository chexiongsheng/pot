const test = require('node:test')
const assert = require('node:assert/strict')
const { startGame } = require('./helpers')

async function setup() {
  const ctx = await startGame(new Map([
    ['manifest.json', JSON.stringify({ id: 'tan', plugins: ['a'] })],
    ['src/plugins/a.js', `export const name = 'a'\nexport function apply() {}\n`],
  ]))
  return { scene: ctx.runtime.scene, engine: ctx.engine }
}

const QUAD = {
  positions: [0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0],
  normals: [0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1],
  uvs: [0, 0, 1, 0, 1, 1, 0, 1],
  indices: [0, 1, 2, 0, 2, 3],
}

test('mesh tangents：按顶点上传 xyzw，没给时不调用', async () => {
  const { scene, engine } = await setup()
  scene.mesh('plain', QUAD)
  assert.equal(engine.meshes.get('plain').tangents, undefined)
  const tangents = [1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, -1, 1, 0, 0, -1]
  scene.mesh('t', { ...QUAD, tangents })
  assert.deepEqual(engine.meshes.get('t').tangents, tangents)
})

test('mesh tangents：长度不对报错；参与 key: true 的内容哈希', async () => {
  const { scene, engine } = await setup()
  assert.throws(() => scene.mesh('bad', { ...QUAD, tangents: [1, 0, 0] }), /tangents 须为每顶点 4 个数/)
  const a = { ...QUAD, tangents: new Float32Array(16).fill(1) }
  scene.mesh('k', a, { key: true })
  const k1 = engine.meshes.get('k').key
  scene.mesh('k', a, { key: true })
  assert.equal(engine.meshes.get('k').uploads, 1, '内容相同不重复上传')
  scene.mesh('k', { ...QUAD, tangents: new Float32Array(16).fill(-1) }, { key: true })
  assert.notEqual(engine.meshes.get('k').key, k1, '切线不同则 key 不同')
  assert.equal(engine.meshes.get('k').uploads, 2)
})
