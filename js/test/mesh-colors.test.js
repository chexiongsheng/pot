const test = require('node:test')
const assert = require('node:assert/strict')
const { startGame } = require('./helpers')

async function setup() {
  const ctx = await startGame(new Map([
    ['manifest.json', JSON.stringify({ id: 'hdr', plugins: ['a'] })],
    ['src/plugins/a.js', `export const name = 'a'\nexport function apply() {}\n`],
  ]))
  return { scene: ctx.runtime.scene, engine: ctx.engine }
}

const TRI = { positions: [0, 0, 0, 1, 0, 0, 0, 1, 0], indices: [0, 1, 2] }
const HDR = [4, 2, 0.5, 1, 0, 8, 0, 1, 1, 1, 1, 0.5]

test('mesh colors：大于 1 的 HDR 值原样上传，默认按 sRGB 走 mesh()', async () => {
  const { scene, engine } = await setup()
  scene.mesh('s', { ...TRI, colors: HDR })
  assert.deepEqual(engine.meshes.get('s').colors, { linear: false, data: HDR })
})

test('mesh colorSpace linear：跳过 sRGB 转换，走 meshColors', async () => {
  const { scene, engine } = await setup()
  scene.mesh('l', { ...TRI, colors: HDR, colorSpace: 'linear' })
  assert.deepEqual(engine.meshes.get('l').colors, { linear: true, data: HDR })
  scene.mesh('n', { ...TRI, colorSpace: 'linear' })
  assert.equal(engine.meshes.get('n').colors, null, '没有 colors 时 colorSpace 不起作用')
  assert.throws(() => scene.mesh('bad', { ...TRI, colors: HDR, colorSpace: 'rgb' }), /colorSpace 只能是/)
  assert.throws(() => scene.mesh('bad2', { ...TRI, colors: [1, 1, 1, 1], colorSpace: 'linear' }), /colors 须为每顶点 4 个数/)
})

test('mesh colorSpace：参与 key: true 的内容哈希', async () => {
  const { scene, engine } = await setup()
  scene.mesh('k', { ...TRI, colors: HDR }, { key: true })
  const k1 = engine.meshes.get('k').key
  scene.mesh('k', { ...TRI, colors: HDR, colorSpace: 'srgb' }, { key: true })
  assert.equal(engine.meshes.get('k').uploads, 1, '显式 srgb 与默认相同')
  scene.mesh('k', { ...TRI, colors: HDR, colorSpace: 'linear' }, { key: true })
  assert.notEqual(engine.meshes.get('k').key, k1)
  assert.equal(engine.meshes.get('k').uploads, 2)
})
