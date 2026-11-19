const test = require('node:test')
const assert = require('node:assert/strict')
const { startGame } = require('./helpers')

function empty() {
  return new Map([['manifest.json', JSON.stringify({ id: 'scene', plugins: [] })]])
}

const TRI = { positions: [0, 0, 0, 1, 0, 0, 0, 1, 0], indices: [0, 1, 2] }

test('scene.setTransforms：一次调用写完一批实体', async () => {
  const { runtime, engine } = await startGame(empty())
  const scene = runtime.scene
  const a = scene.spawn({ name: 'a' })
  const b = scene.spawn({ name: 'b' })
  const ids = Int32Array.from([a.id, b.id])
  const data = new Float32Array(20)
  data.set([1, 2, 3, 0, 0, 0, 1, 2, 2, 2], 0)
  data.set([4, 5, 6, 0, 1, 0, 0, 1, 1, 3], 10)

  assert.equal(scene.setTransforms(ids, data), 2)
  assert.equal(engine.transformCalls, 1)
  assert.deepEqual(engine.byName('a')[0].position, [1, 2, 3])
  assert.deepEqual(engine.byName('a')[0].scale, [2, 2, 2])
  assert.deepEqual(engine.byName('b')[0].quaternion, [0, 1, 0, 0])

  // 只写局部位置：旋转、缩放保持
  data.set([7, 8, 9], 0)
  scene.setTransforms([a], data, { rotation: false, scale: false, space: 'local' })
  assert.deepEqual(engine.byName('a')[0].localPosition, [7, 8, 9])
  assert.deepEqual(engine.byName('a')[0].scale, [2, 2, 2])
  assert.equal(engine.byName('a')[0].localQuaternion, undefined)

  // 已销毁的实体跳过，不报错
  b.destroy()
  assert.equal(scene.setTransforms(ids, data), 1)
  assert.throws(() => scene.setTransforms(ids, data, { count: 3 }), /超出范围/)
})

test('visible:false：只碰撞不渲染', async () => {
  const { runtime, engine } = await startGame(empty())
  const hit = runtime.scene.spawn({ name: 'hit', shape: 'sphere', visible: false, layer: 9 })
  const o = engine.byName('hit')[0]
  assert.equal(o.visible, false)
  assert.equal(o.collider, undefined, '碰撞体没有被关掉')
  assert.equal(o.active, true)
  hit.visible(true)
  assert.equal(o.visible, true)
})

test('scene.mesh：key 相同跳过生成与上传；key:true 按内容判断', async () => {
  const { runtime, engine } = await startGame(empty())
  const scene = runtime.scene
  let made = 0
  const make = () => { made++; return TRI }

  assert.equal(scene.mesh('m', make, { key: 'v1' }), 3)
  assert.equal(scene.mesh('m', make, { key: 'v1' }), 3)
  assert.equal(made, 1, '命中缓存时不调用生成函数')
  assert.equal(engine.meshes.get('m').uploads, 1)
  scene.mesh('m', make, { key: 'v2' })
  assert.equal(made, 2)
  assert.equal(engine.meshes.get('m').uploads, 2)

  // 不给 key：每次都上传，并且让之前的 key 失效
  scene.mesh('m', TRI)
  assert.equal(engine.meshes.get('m').uploads, 3)
  scene.mesh('m', make, { key: 'v2' })
  assert.equal(engine.meshes.get('m').uploads, 4)

  scene.mesh('h', TRI, { key: true })
  scene.mesh('h', { ...TRI, positions: [...TRI.positions] }, { key: true })
  assert.equal(engine.meshes.get('h').uploads, 1, '内容相同只上传一次')
  scene.mesh('h', { ...TRI, positions: [0, 0, 0, 2, 0, 0, 0, 1, 0] }, { key: true })
  assert.equal(engine.meshes.get('h').uploads, 2, '内容变了重新上传')
})

test('蒙皮网格：boneIndices + bones', async () => {
  const { runtime, engine } = await startGame(empty())
  const scene = runtime.scene
  scene.mesh('arm', { ...TRI, boneIndices: [0, 1, 1] }, { key: 'k' })
  assert.deepEqual(engine.meshes.get('arm').skin, { per: 1, bones: 2, weights: null })

  const root = scene.spawn({ shape: 'empty', name: 'root' })
  const b0 = scene.spawn({ shape: 'empty', name: 'b0', parent: root })
  const b1 = scene.spawn({ shape: 'empty', name: 'b1', parent: root })
  const skin = scene.spawn({ shape: 'mesh:arm', name: 'skin', parent: root, bones: [b0, b1] })
  const o = engine.byName('skin')[0]
  assert.equal(o.shape, 'skin:arm')
  assert.deepEqual(o.bones, [b0.id, b1.id])
  assert.throws(() => skin.shader('any'), /蒙皮实体暂不支持运行时着色器/)

  const before = engine.count()
  assert.throws(() => scene.spawn({ shape: 'mesh:arm', name: 'bad', bones: [b0] }), /骨骼数量不足/)
  assert.equal(engine.count(), before, '绑定失败的对象已销毁')
  assert.throws(() => scene.spawn({ shape: 'cube', bones: [b0, b1] }), /只能配 mesh:/)
  assert.throws(() => scene.mesh('bad', { ...TRI, boneWeights: [1, 1, 1] }), /一起给/)
  assert.throws(() => scene.mesh('bad', { ...TRI, boneIndices: [0, 1] }), /整数倍/)
  assert.equal(engine.meshCached('bad', 'x'), -1)

  skin.destroy()
  assert.equal(scene.skinned.size, 0)
})
