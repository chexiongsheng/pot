/**
 * Web 宿主的碰撞与射线（004 第 20.9 节 web-2）：collider / colliderShape / layer / raycast / sphereCast
 * 的语义与 PotScene.cs 一致：图元自带碰撞体（cube 盒、sphere 球、capsule/cylinder 胶囊、plane/quad 单面网格），
 * mesh: 默认单面网格碰撞体，掩码 0 排除第 2 层，起点在碰撞体内（或扫掠起点重叠）时该碰撞体不算命中。
 */
const test = require('node:test')
const assert = require('node:assert/strict')
const { loadWebPot } = require('./helpers')

const web = () => loadWebPot().web

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

function near(actual, expected, eps = 1e-4, label = '') {
  if (typeof expected === 'number') {
    assert.ok(Math.abs(actual - expected) <= eps, `${label} ${actual} ≈ ${expected}`)
    return
  }
  assert.equal(actual.length, expected.length)
  for (let i = 0; i < expected.length; i++) near(actual[i], expected[i], eps, `${label}[${i}]`)
}

function hitIs(hit, id, distance, point, normal) {
  assert.ok(hit, '应当命中')
  assert.equal(hit.id, id)
  near(hit.distance, distance, 1e-4, 'distance')
  near(hit.point, point, 1e-4, 'point')
  near(hit.normal, normal, 1e-4, 'normal')
}

function put(e, shape, x, y, z, scale) {
  const id = e.spawn(shape, '', 0)
  e.setVec(id, 'position', x, y, z)
  if (scale) e.setVec(id, 'scale', ...scale)
  return id
}

/** 单个三角形，cross(b - a, c - a) 朝 +Y（顺时针为正面） */
function triangleMesh(e, name, s = 1) {
  const pos = new Float32Array([0, 0, 0, 0, 0, s, s, 0, 0])
  return e.mesh(name, pos.buffer, null, null, null, new Int32Array([0, 1, 2]).buffer, '')
}

test('web-physics：图元碰撞体的射线命中点、法线与距离', () => {
  const e = fakeHost().engine
  const cube = put(e, 'cube', 0, 0, 5)
  hitIs(e.raycast(0, 0, 0, 0, 0, 2, 0, 0), cube, 4.5, [0, 0, 4.5], [0, 0, -1])
  assert.equal(e.raycast(0, 0, 0, 0, 0, 1, 4, 0), null, 'maxDistance 截断')
  assert.equal(e.raycast(0, 0, 5, 0, 0, 1, 0, 0), null, '起点在盒内不命中')
  assert.equal(e.raycast(0, 0, 0, 0, 0, 0, 0, 0), null, '方向为零')
  e.destroy(cube)

  const sphere = put(e, 'sphere', 0, 0, 5, [1, 3, 1])
  hitIs(e.raycast(0, 0, 0, 0, 0, 1, 0, 0), sphere, 3.5, [0, 0, 3.5], [0, 0, -1])
  e.destroy(sphere)

  const capsule = put(e, 'capsule', 0, 0, 0)
  hitIs(e.raycast(0, 5, 0, 0, -1, 0, 0, 0), capsule, 4, [0, 1, 0], [0, 1, 0])
  hitIs(e.raycast(-5, 0.3, 0, 1, 0, 0, 0, 0), capsule, 4.5, [-0.5, 0.3, 0], [-1, 0, 0])
  e.destroy(capsule)

  // cylinder 在 Unity 里是 CapsuleCollider：顶上是半球
  const cyl = put(e, 'cylinder', 0, 0, 0, [2, 1, 2])
  hitIs(e.raycast(0, 5, 0, 0, -1, 0, 0, 0), cyl, 4, [0, 1, 0], [0, 1, 0])
  e.destroy(cyl)
})

test('web-physics：plane、quad 与 mesh: 为单面网格，旋转与镜像缩放下法线正确', () => {
  const e = fakeHost().engine
  const plane = put(e, 'plane', 0, 0, 0)
  hitIs(e.raycast(1, 2, 1, 0, -1, 0, 0, 0), plane, 2, [1, 0, 1], [0, 1, 0])
  assert.equal(e.raycast(1, -2, 1, 0, 1, 0, 0, 0), null, '背面不命中')
  e.setVec(plane, 'scale', -1, 1, 1)
  hitIs(e.raycast(1, 2, 1, 0, -1, 0, 0, 0), plane, 2, [1, 0, 1], [0, 1, 0])
  assert.equal(e.raycast(1, -2, 1, 0, 1, 0, 0, 0), null, '镜像后背面仍不命中')
  // 绕 X 转 90°：+Y 法线转到 +Z
  e.setVec(plane, 'scale', 1, 1, 1)
  e.setVec(plane, 'position', 0, 0, 5)
  e.setVec(plane, 'rotation', 90, 0, 0)
  assert.equal(e.raycast(0, 0, 0, 0, 0, 1, 0, 0), null)
  hitIs(e.raycast(0, 0, 10, 0, 0, -1, 0, 0), plane, 5, [0, 0, 5], [0, 0, 1])
  e.destroy(plane)

  const quad = put(e, 'quad', 0, 0, 5)
  hitIs(e.raycast(0, 0, 0, 0, 0, 1, 0, 0), quad, 5, [0, 0, 5], [0, 0, -1])
  assert.equal(e.raycast(0, 0, 10, 0, 0, -1, 0, 0), null)
  e.destroy(quad)

  triangleMesh(e, 'tri', 2)
  const m = put(e, 'mesh:tri', 0, 0, 0)
  hitIs(e.raycast(0.5, 3, 0.5, 0, -1, 0, 0, 0), m, 3, [0.5, 0, 0.5], [0, 1, 0])
  assert.equal(e.raycast(0.5, -3, 0.5, 0, 1, 0, 0, 0), null)
  assert.equal(e.raycast(1.5, 3, 1.5, 0, -1, 0, 0, 0), null, '三角形外')
  // convex 按双面近似：背面也命中，法线朝向射线来处
  assert.equal(e.colliderShape(m, 'convex', false), '')
  hitIs(e.raycast(0.5, -3, 0.5, 0, 1, 0, 0, 0), m, 3, [0.5, 0, 0.5], [0, -1, 0])
})

test('web-physics：网格碰撞体跟随网格更新，退化网格没有碰撞体', () => {
  const e = fakeHost().engine
  e.mesh('pool', new Float32Array(9).buffer, null, null, null, new Int32Array([0, 1, 2]).buffer, '')
  const m = put(e, 'mesh:pool', 0, 0, 0)
  assert.equal(e.raycast(0.2, 3, 0.2, 0, -1, 0, 0, 0), null, '全零网格没有碰撞体')
  triangleMesh(e, 'pool')
  hitIs(e.raycast(0.2, 3, 0.2, 0, -1, 0, 0, 0), m, 3, [0.2, 0, 0.2], [0, 1, 0])
  // 较大的网格：BVH 剪枝后结果与逐个三角形一致
  const n = 40
  const pos = []
  const idx = []
  for (let z = 0; z <= n; z++) for (let x = 0; x <= n; x++) pos.push(x, Math.sin(x * 0.3) * Math.cos(z * 0.2), z)
  for (let z = 0; z < n; z++) {
    for (let x = 0; x < n; x++) {
      const i = z * (n + 1) + x
      idx.push(i, i + n + 1, i + 1, i + 1, i + n + 1, i + n + 2)
    }
  }
  e.mesh('terrain', new Float32Array(pos).buffer, null, null, null, new Int32Array(idx).buffer, '')
  const t = put(e, 'mesh:terrain', 100, 0, 0)
  for (const [x, z] of [[3.3, 7.1], [20.5, 33.9], [39.9, 0.2]]) {
    const hit = e.raycast(100 + x, 10, z, 0, -1, 0, 0, 0)
    assert.ok(hit)
    assert.equal(hit.id, t)
    assert.ok(Math.abs(hit.point[1] - Math.sin(x * 0.3) * Math.cos(z * 0.2)) < 0.05, `高度 ${hit.point[1]}`)
    assert.ok(hit.normal[1] > 0.5)
  }
})

test('web-physics：最近命中、层与掩码、不活跃与关闭的碰撞体', () => {
  const host = fakeHost()
  const e = host.engine
  const near1 = put(e, 'cube', 0, 0, 3)
  const far1 = put(e, 'cube', 0, 0, 8)
  assert.equal(e.raycast(0, 0, 0, 0, 0, 1, 0, 0).id, near1)

  e.layer(near1, 2)
  assert.equal(e.raycast(0, 0, 0, 0, 0, 1, 0, 0).id, far1, '掩码 0 排除第 2 层')
  assert.equal(e.raycast(0, 0, 0, 0, 0, 1, 0, 1 << 2).id, near1)
  assert.equal(e.raycast(0, 0, 0, 0, 0, 1, 0, 1).id, far1)
  assert.equal(e.raycast(0, 0, 0, 0, 0, 1, 0, -1).id, near1, '-1 包含所有层')
  e.layer(near1, 40)
  assert.equal(host.scene.get(near1).ext.layer, 31)
  e.layer(near1, -3)
  assert.equal(host.scene.get(near1).ext.layer, 0)

  e.collider(near1, false)
  assert.equal(e.raycast(0, 0, 0, 0, 0, 1, 0, 0).id, far1, '关掉的碰撞体')
  e.collider(near1, true)
  e.visible(near1, false)
  assert.equal(e.raycast(0, 0, 0, 0, 0, 1, 0, 0).id, near1, '不可见仍参与检测')

  const parent = e.spawn('empty', 'p', 0)
  const child = e.spawn('cube', 'c', parent)
  e.setVec(child, 'position', 0, 0, 1)
  assert.equal(e.raycast(0, 0, 0, 0, 0, 1, 0, 0).id, child, '命中子对象返回子对象 id')
  e.setActive(parent, false)
  assert.equal(e.raycast(0, 0, 0, 0, 0, 1, 0, 0).id, near1, '父对象不活跃')
  assert.equal(e.raycast(0, 0, 0, 0, 0, 1, 0, 0).id, near1)
  assert.deepEqual(host.logs, [])
})

test('web-physics：sphereCast 的接触点、法线与起点重叠', () => {
  const e = fakeHost().engine
  const s = put(e, 'sphere', 0, 0, 5)
  hitIs(e.sphereCast(0, 0, 0, 0, 0, 1, 0.5, 0, 0), s, 4, [0, 0, 4.5], [0, 0, -1])
  assert.equal(e.sphereCast(0, 0, 0, 0, 0, 1, 0, 0, 0), null, 'radius 须大于 0')
  assert.equal(e.sphereCast(0, 0, 0, 0, 0, 0, 1, 0, 0), null, '方向为零')
  assert.equal(e.sphereCast(0, 0, 4.2, 0, 0, 1, 0.5, 0, 0), null, '起点重叠')
  e.destroy(s)

  const cube = put(e, 'cube', 0, 0, 5)
  const back = put(e, 'cube', 0, 0, 10)
  hitIs(e.sphereCast(0, 0, 0, 0, 0, 1, 0.25, 0, 0), cube, 4.25, [0, 0, 4.5], [0, 0, -1])
  // 擦过棱：中心路径 x = 0.6，与 x = 0.5、z = 4.5 的棱相切
  const dz = Math.sqrt(0.25 * 0.25 - 0.1 * 0.1)
  const len = Math.hypot(0.1, dz)
  hitIs(e.sphereCast(0.6, 0, 0, 0, 0, 1, 0.25, 0, 0), cube, 4.5 - dz, [0.5, 0, 4.5], [0.1 / len, 0, -dz / len])
  // 起点与第一个盒子重叠：只算后面的
  hitIs(e.sphereCast(0, 0, 4.3, 0, 0, 1, 0.25, 0, 0), back, 9.5 - 0.25 - 4.3, [0, 0, 9.5], [0, 0, -1])
  e.destroy(cube)
  e.destroy(back)

  const cap = put(e, 'capsule', 0, 0, 0)
  hitIs(e.sphereCast(0, 5, 0, 0, -1, 0, 0.5, 0, 0), cap, 3.5, [0, 1, 0], [0, 1, 0])
  e.destroy(cap)

  const plane = put(e, 'plane', 0, 0, 0)
  hitIs(e.sphereCast(1, 2, 1, 0, -1, 0, 0.5, 0, 0), plane, 1.5, [1, 0, 1], [0, 1, 0])
  assert.equal(e.sphereCast(1, -2, 1, 0, 1, 0, 0.5, 0, 0), null, '单面')
  // 平面边缘外侧擦过（plane 边长 10，边在 x = 5）
  const hit = e.sphereCast(5.3, 2, 0, 0, -1, 0, 0.5, 0, 0)
  assert.ok(hit)
  near(hit.point, [5, 0, 0])
  near(hit.distance, 2 - 0.4)
  assert.equal(e.sphereCast(1, 0.2, 1, 0, -1, 0, 0.5, 0, 0), null, '起点与平面重叠')
})

test('web-physics：colliderShape 的形状与错误文案', () => {
  const e = fakeHost().engine
  assert.equal(e.colliderShape(999, 'box', false), '实体不存在')
  assert.equal(e.colliderShape(1, 'box', false), '实体不存在')
  const empty = e.spawn('empty', '', 0)
  assert.equal(e.colliderShape(empty, '', true), '')
  assert.equal(e.colliderShape(empty, 'box', false), '没有网格，不能用 box 碰撞体')
  const cube = put(e, 'cube', 0, 0, 0)
  assert.equal(e.colliderShape(cube, 'sphere', false), '形状只能是 mesh、convex 或 box')
  e.destroy(cube)
  triangleMesh(e, 'tri')
  e.meshSkin('tri', new Int32Array([0, 0, 0]).buffer, null, null)
  const sk = e.spawn('skin:tri', '', 0)
  assert.equal(e.colliderShape(sk, 'box', false), '蒙皮实体没有碰撞体，命中体另挂在骨骼下')
  assert.equal(e.raycast(0.2, 3, 0.2, 0, -1, 0, 0, 0), null, '蒙皮实体没有碰撞体')

  // sphere 换成 box：取网格包围盒（±0.5），对角处也能命中
  const s = put(e, 'sphere', 0, 0, 0)
  assert.equal(e.raycast(0.45, 0.45, -5, 0, 0, 1, 0, 0), null)
  assert.equal(e.colliderShape(s, 'box', true), '')
  hitIs(e.raycast(0.45, 0.45, -5, 0, 0, 1, 0, 0), s, 4.5, [0.45, 0.45, -0.5], [0, 0, -1])
  // cube 换成 mesh：单面三角形
  const c = put(e, 'cube', 0, 0, 5)
  assert.equal(e.colliderShape(c, 'mesh', false), '')
  hitIs(e.raycast(0, 0, 0, 0, 0, 1, 0, 0), c, 4.5, [0, 0, 4.5], [0, 0, -1])
  assert.equal(e.raycast(0, 0, 5, 0, 0, 1, 0, 0), null, '盒内向外是背面')
})
