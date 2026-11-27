/**
 * Web 宿主图元网格（004 第 20.3、20.10 节）：Unity 尺寸、法线朝外、正面在屏幕上为顺时针（frontFace(CW)）
 */
const test = require('node:test')
const assert = require('node:assert/strict')
const { loadWebPot } = require('./helpers')

const web = () => loadWebPot().web

function bounds(m) {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity]
  for (let i = 0; i < m.positions.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      lo[k] = Math.min(lo[k], m.positions[i + k])
      hi[k] = Math.max(hi[k], m.positions[i + k])
    }
  }
  return [lo, hi].map((v) => v.map((x) => Math.round(x * 1e4) / 1e4 + 0))
}

function triangles(m, fn) {
  const P = m.positions
  const at = (i) => [P[i * 3], P[i * 3 + 1], P[i * 3 + 2]]
  for (let t = 0; t < m.indices.length; t += 3) fn(at(m.indices[t]), at(m.indices[t + 1]), at(m.indices[t + 2]))
}

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]

test('web-geometry：Unity 图元尺寸', () => {
  const { primitiveMesh } = web()
  const expect = {
    cube: [[-0.5, -0.5, -0.5], [0.5, 0.5, 0.5]],
    sphere: [[-0.5, -0.5, -0.5], [0.5, 0.5, 0.5]],
    capsule: [[-0.5, -1, -0.5], [0.5, 1, 0.5]],
    cylinder: [[-0.5, -1, -0.5], [0.5, 1, 0.5]],
    plane: [[-5, 0, -5], [5, 0, 5]],
    quad: [[-0.5, -0.5, 0], [0.5, 0.5, 0]],
  }
  for (const [shape, b] of Object.entries(expect)) {
    const m = primitiveMesh(shape)
    assert.deepEqual(bounds(m), b, shape)
    assert.equal(m.indices.length % 3, 0)
    assert.equal(m.normals.length, m.positions.length)
    assert.equal(m.uvs.length / 2, m.positions.length / 3)
    for (let i = 0; i < m.normals.length; i += 3) {
      assert.ok(Math.abs(Math.hypot(m.normals[i], m.normals[i + 1], m.normals[i + 2]) - 1) < 1e-5, `${shape} 法线单位长度`)
    }
  }
  assert.equal(primitiveMesh('empty'), undefined)
  assert.equal(primitiveMesh('cube'), primitiveMesh('cube'), '缓存')
})

test('web-geometry：cross(b - a, c - a) 朝外', () => {
  const { primitiveMesh } = web()
  for (const shape of ['cube', 'sphere', 'capsule', 'cylinder']) {
    let bad = 0
    triangles(primitiveMesh(shape), (a, b, c) => {
      const centroid = [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3]
      if (dot(cross(sub(b, a), sub(c, a)), centroid) <= 0) bad++
    })
    assert.equal(bad, 0, shape)
  }
  triangles(primitiveMesh('plane'), (a, b, c) => assert.ok(cross(sub(b, a), sub(c, a))[1] > 0, 'plane 朝 +Y'))
  triangles(primitiveMesh('quad'), (a, b, c) => assert.ok(cross(sub(b, a), sub(c, a))[2] < 0, 'quad 朝 -Z'))
})

test('web-geometry：默认相机看 quad 正面时屏幕上为顺时针', () => {
  const { primitiveMesh, WebScene, viewFromCamera, perspective, multiply } = web()
  const scene = new WebScene()
  const vp = multiply(perspective(60, 16 / 9, 0.3, 1000), viewFromCamera(scene.worldMatrix(scene.camera)))
  const ndc = (p) => {
    const x = vp[0] * p[0] + vp[4] * p[1] + vp[8] * p[2] + vp[12]
    const y = vp[1] * p[0] + vp[5] * p[1] + vp[9] * p[2] + vp[13]
    const w = vp[3] * p[0] + vp[7] * p[1] + vp[11] * p[2] + vp[15]
    assert.ok(w > 0, '在相机前方')
    return [x / w, y / w]
  }
  triangles(primitiveMesh('quad'), (a, b, c) => {
    const [pa, pb, pc] = [ndc(a), ndc(b), ndc(c)]
    const area = (pb[0] - pa[0]) * (pc[1] - pa[1]) - (pb[1] - pa[1]) * (pc[0] - pa[0])
    assert.ok(area < 0, 'NDC 中顺时针')
  })
})
