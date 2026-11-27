/**
 * Web 宿主的自定义网格（004 第 20.8、20.10 节）：mesh / meshCached / meshTangents / meshColors / meshAttribute / meshSkin
 * 的语义与 PotScene.cs 一致（顶点色转线性、缺法线时计算、有 UV 时算切线、key 缓存、错误文案），spawn 未注册网格时告警。
 */
const test = require('node:test')
const assert = require('node:assert/strict')
const { loadWebPot } = require('./helpers')

const web = () => loadWebPot().web

const f32 = (a) => new Float32Array(a).buffer
const i32 = (a) => new Int32Array(a).buffer
const near = (a, b, eps = 1e-5) => assert.ok(Math.abs(a - b) <= eps, `${a} ≉ ${b}`)

/** XY 平面上的单位正方形，顺时针朝 -Z（Unity 正面朝向相机） */
const QUAD = {
  positions: f32([0, 0, 0, 0, 1, 0, 1, 1, 0, 1, 0, 0]),
  uvs: f32([0, 0, 0, 1, 1, 1, 1, 0]),
  indices: i32([0, 1, 2, 0, 2, 3]),
}

function fakeHost() {
  const logs = []
  const host = web().createWebHost({
    files: { 'manifest.json': '{"id":"t"}' },
    ui: { submit() {}, measure: () => [0, 0] },
    platform: { screen: () => [800, 600], focused: () => true, cursor() {}, cursorLocked: () => false },
    log: (level, text) => logs.push({ level, text }),
  })
  host.logs = logs
  return host
}

test('web-mesh：注册返回顶点数；缺法线时按绕序算出朝外的法线；有 UV 时算切线', () => {
  const meshes = new (web().WebMeshes)()
  assert.equal(meshes.register('q', QUAD.positions, null, QUAD.uvs, null, QUAD.indices, ''), 4)
  const m = meshes.get('q')
  assert.equal(m.vertexCount, 4)
  for (let v = 0; v < 4; v++) {
    near(m.normals[v * 3], 0)
    near(m.normals[v * 3 + 1], 0)
    near(m.normals[v * 3 + 2], -1)
    // u 沿 +X 增长：切线为 +X，cross(n, t) = (0,0,-1)×(1,0,0) = (0,-1,0) 与 v 方向（+Y）相反 → w = -1
    near(m.tangents[v * 4], 1)
    near(m.tangents[v * 4 + 1], 0)
    assert.equal(m.tangents[v * 4 + 3], -1)
  }
  assert.deepEqual(m.min, [0, 0, 0])
  assert.deepEqual(m.max, [1, 1, 0])
  assert.equal(m.colors, null)
  // 没有 UV：不算切线
  meshes.register('n', QUAD.positions, null, null, null, QUAD.indices, '')
  assert.equal(meshes.get('n').tangents, null)
  assert.equal(meshes.get('n').uvs, null)
})

test('web-mesh：给了法线就原样用；顶点色从 sRGB 转线性，alpha 不变；meshColors 的 linear 参数', () => {
  const meshes = new (web().WebMeshes)()
  const normals = f32([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0])
  const colors = f32([0.5, 1, 0, 0.25, 0.5, 1, 0, 0.25, 0.5, 1, 0, 0.25, 0.5, 1, 0, 0.25])
  meshes.register('q', QUAD.positions, normals, null, colors, QUAD.indices, '')
  const m = meshes.get('q')
  near(m.normals[1], 1)
  near(m.colors[0], 0.21404, 1e-4)
  near(m.colors[1], 1)
  near(m.colors[3], 0.25)
  const v0 = m.version
  assert.equal(meshes.colors('q', colors, true), '')
  near(m.colors[0], 0.5)
  assert.ok(m.version > v0)
  assert.equal(meshes.colors('q', colors, false), '')
  near(meshes.get('q').colors[0], 0.21404, 1e-4)
  assert.match(meshes.colors('q', f32([1, 1, 1, 1]), true), /每顶点 4 个数/)
  assert.equal(meshes.colors('nope', colors, true), '未注册的网格：nope')
})

test('web-mesh：meshCached 按 key 命中；出错与重注册时清掉 key', () => {
  const meshes = new (web().WebMeshes)()
  assert.equal(meshes.cached('q', 'k1'), -1)
  meshes.register('q', QUAD.positions, null, QUAD.uvs, null, QUAD.indices, 'k1')
  assert.equal(meshes.cached('q', 'k1'), 4)
  assert.equal(meshes.cached('q', 'k2'), -1)
  assert.equal(meshes.cached('q', ''), -1)
  // 后续步骤出错：key 失效，下次重建
  assert.match(meshes.tangents('q', f32([1, 0, 0, 1])), /tangents 须为每顶点 4 个数/)
  assert.equal(meshes.cached('q', 'k1'), -1)
  meshes.register('q', QUAD.positions, null, QUAD.uvs, null, QUAD.indices, 'k1')
  meshes.register('q', QUAD.positions, null, QUAD.uvs, null, QUAD.indices, '')
  assert.equal(meshes.cached('q', 'k1'), -1)
  // 空数据不注册
  assert.equal(meshes.register('e', new ArrayBuffer(0), null, null, null, new ArrayBuffer(0), 'k'), 0)
})

test('web-mesh：meshTangents 的 w 取符号；meshAttribute 的通道与长度检查', () => {
  const meshes = new (web().WebMeshes)()
  meshes.register('q', QUAD.positions, null, QUAD.uvs, null, QUAD.indices, '')
  assert.equal(meshes.tangents('q', f32([1, 0, 0, 0.3, 1, 0, 0, -2, 1, 0, 0, 0, 1, 0, 0, 5])), '')
  assert.deepEqual([...meshes.get('q').tangents].filter((_, i) => i % 4 === 3), [1, -1, 1, 1])
  assert.equal(meshes.attribute('q', 1, 'heat', 1, f32([1, 2, 3, 4])), '')
  const m = meshes.get('q')
  assert.equal(meshes.attributeChannel(m, 'heat'), 1)
  assert.equal(meshes.attributeChannel(m, 'nope'), -1)
  assert.equal(meshes.attribute('q', 8, 'x', 1, f32([1, 2, 3, 4])), '自定义顶点属性最多 7 个')
  assert.equal(meshes.attribute('q', 2, 'x', 5, f32([1, 2, 3, 4])), '属性 x 的 size 须为 1 到 4')
  assert.match(meshes.attribute('q', 2, 'x', 2, f32([1, 2, 3, 4])), /每顶点 2 个数，共 8 个/)
  // 带自定义属性的网格不能蒙皮
  assert.match(meshes.skin('q', i32([0, 0, 0, 0]), null, null), /不能蒙皮/)
})

test('web-mesh：meshSkin 补齐到每顶点 4 根并归一化权重；缺权重时第一根为 1；缺 bindPoses 时为单位矩阵', () => {
  const meshes = new (web().WebMeshes)()
  meshes.register('s', QUAD.positions, null, QUAD.uvs, null, QUAD.indices, '')
  assert.equal(meshes.skin('s', i32([0, 1, 1, 2, 2, 0, 0, 1]), f32([1, 1, 3, 1, 0, 0, 0.2, 0.2]), null), '')
  const sk = meshes.get('s').skin
  assert.equal(sk.boneCount, 3)
  assert.deepEqual([...sk.bones.slice(0, 8)], [0, 1, 0, 0, 1, 2, 0, 0])
  assert.deepEqual([...sk.weights.slice(0, 8)], [0.5, 0.5, 0, 0, 0.75, 0.25, 0, 0])
  // 权重全 0：第一根为 1
  assert.deepEqual([...sk.weights.slice(8, 12)], [1, 0, 0, 0])
  assert.deepEqual([...sk.bindPoses.slice(16, 32)], [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1])
  // 每顶点 1 根，缺权重
  assert.equal(meshes.skin('s', i32([0, 0, 1, 1]), null, null), '')
  assert.deepEqual([...meshes.get('s').skin.weights.slice(0, 4)], [1, 0, 0, 0])
  assert.equal(meshes.skin('s', i32([0, 0, 1]), null, null), 'boneIndices 的长度须为顶点数的整数倍')
  assert.equal(meshes.skin('s', i32(new Array(20).fill(0)), null, null), '每个顶点只能有 1 到 4 根骨骼')
  assert.equal(meshes.skin('s', i32([0, 0, 1, 1]), f32([1]), null), 'boneWeights 的长度须与 boneIndices 相同')
  assert.match(meshes.skin('s', i32([0, 0, 1, 1]), null, f32(new Array(16).fill(0))), /bindPoses 须为每根骨骼 16 个数，至少 32 个/)
  // 蒙皮网格不能再加自定义属性
  assert.match(meshes.attribute('s', 1, 'x', 1, f32([1, 2, 3, 4])), /蒙皮网格不能带自定义顶点属性/)
})

test('web-mesh：宿主接入；spawn 未注册网格时告警并建空对象；冷重启清空网格表', () => {
  const host = fakeHost()
  const e = host.engine
  assert.equal(e.mesh('q', QUAD.positions, null, QUAD.uvs, null, QUAD.indices, 'k'), 4)
  assert.equal(e.meshCached('q', 'k'), 4)
  assert.equal(e.meshTangents('q', f32(new Array(16).fill(1))), '')
  assert.equal(e.meshColors('q', f32(new Array(16).fill(1)), true), '')
  assert.equal(e.meshAttribute('q', 1, 'a', 1, f32([1, 2, 3, 4])), '')
  assert.equal(e.meshSkin('q', i32([0, 0, 0, 0]), null, null), '带自定义顶点属性的网格不能蒙皮（UV1-3 要存静止姿态）')
  const a = e.spawn('mesh:q', 'a', 0)
  assert.equal(host.scene.get(a).shape, 'mesh:q')
  assert.ok(host.scene.renderables().some((o) => o.id === a))
  const b = e.spawn('mesh:nope', '', 0)
  const ob = host.scene.get(b)
  assert.equal(ob.shape, 'empty')
  assert.equal(ob.name, `mesh:nope#${b}`)
  assert.ok(!host.scene.renderables().some((o) => o.id === b))
  assert.deepEqual(host.logs, [{ level: 'warn', text: '[pot] 未注册的网格：nope' }])
  assert.deepEqual([...host.unsupported], [])
  host.scene.clear()
  assert.equal(e.meshCached('q', 'k'), -1)
  assert.equal(host.scene.meshes.get('q'), undefined)
})

test('web-mesh：skin 绑定骨骼的检查与错误文案同 PotScene.Skin，成功后设 _Rest', () => {
  const host = fakeHost()
  const e = host.engine
  e.mesh('s', QUAD.positions, null, QUAD.uvs, null, QUAD.indices, '')
  e.mesh('plain', QUAD.positions, null, QUAD.uvs, null, QUAD.indices, '')
  const cube = e.spawn('cube', '', 0)
  assert.equal(e.skin(cube, i32([cube])), '对象不是蒙皮网格')
  const m = e.spawn('mesh:s', '', 0)
  assert.equal(e.skin(m, i32([cube])), '对象不是蒙皮网格')
  const noBones = e.spawn('skin:plain', '', 0)
  assert.equal(e.skin(noBones, i32([cube])), '网格没有骨骼数据（注册网格时需要 boneIndices）')
  assert.equal(e.meshSkin('s', i32([0, 1, 1, 0]), null, null), '')
  const s = e.spawn('skin:s', '', 0)
  assert.equal(e.skin(s, i32([cube])), '骨骼数量不足：网格需要 2 根，只给了 1 根')
  assert.equal(e.skin(s, null), '骨骼数量不足：网格需要 2 根，只给了 0 根')
  assert.equal(e.skin(s, i32([cube, 999])), '第 1 根骨骼不存在')
  const b2 = e.spawn('empty', '', 0)
  assert.equal(e.skin(s, i32([cube, b2])), '')
  const o = host.scene.get(s)
  assert.deepEqual(o.ext.bones, [cube, b2])
  assert.equal(o.ext.floats._Rest, 1)
  assert.deepEqual([...host.unsupported], [])
})
