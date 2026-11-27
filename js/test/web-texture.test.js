/**
 * Web 宿主的贴图与材质（004 第 20.3 节 web-2）：texture / destroyTexture / matTexture / matFloat / matVector
 * 的语义与 PotScene.cs 一致（id 从 1 起不复用、长度不足报错、map 回到白贴图、normal/mask 同步 _HasBump/_HasMask），
 * 以及界面 i 命令用的像素转换（行翻转、tint 相乘）。
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

/** 2×2 贴图：下行红、绿，上行蓝、白（行从下到上） */
const PIXELS = new Uint8Array([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 255, 128])

test('web-texture：创建返回递增 id，数据被拷贝，参数按 PotScene 规整', () => {
  const host = fakeHost()
  const e = host.engine
  const src = PIXELS.slice()
  const a = e.texture(src.buffer, 2, 2, false, true, 1, 2, 99)
  const b = e.texture(src, 2, 2, true, false, 7, 0, -3)
  assert.equal(a, 1)
  assert.equal(b, 2)
  src[0] = 1
  const t = host.scene.textures.get(a)
  assert.equal(t.data[0], 255)
  assert.equal(t.data.length, 16)
  assert.deepEqual([t.linear, t.mipmaps, t.wrap, t.filter, t.aniso], [false, true, 1, 2, 16])
  const u = host.scene.textures.get(b)
  assert.deepEqual([u.linear, u.mipmaps, u.wrap, u.filter, u.aniso], [true, false, 0, 0, 0])
  // 多余字节只取前 w×h×4
  const c = e.texture(new Uint8Array(20), 2, 2, true, false, 0, 1, 0)
  assert.equal(host.scene.textures.get(c).data.length, 16)
})

test('web-texture：数据不足报错返回 0；尺寸非法返回 0；销毁后 id 不复用，clear 清空', () => {
  const host = fakeHost()
  const e = host.engine
  assert.equal(e.texture(new Uint8Array(15), 2, 2, true, false, 0, 1, 0), 0)
  assert.deepEqual(host.logs, [{ level: 'error', text: '[pot] Texture 数据长度不足：15 < 16' }])
  assert.equal(e.texture(new Uint8Array(16), 0, 2, true, false, 0, 1, 0), 0)
  assert.equal(e.texture(null, 2, 2, true, false, 0, 1, 0), 0)
  const a = e.texture(PIXELS, 2, 2, true, false, 0, 1, 0)
  e.destroyTexture(a)
  assert.equal(host.scene.textures.get(a), undefined)
  const b = e.texture(PIXELS, 2, 2, true, false, 0, 1, 0)
  assert.equal(b, a + 1)
  host.scene.clear()
  assert.equal(host.scene.textures.size, 0)
  assert.equal(e.texture(PIXELS, 2, 2, true, false, 0, 1, 0), b + 1)
  assert.ok(!host.unsupported.has('texture'))
})

test('web-texture：matTexture 槽位语义与 _HasBump/_HasMask', () => {
  const host = fakeHost()
  const e = host.engine
  const id = e.spawn('cube', '', 0)
  const t = e.texture(PIXELS, 2, 2, false, false, 0, 1, 0)
  const n = e.texture(PIXELS, 2, 2, true, false, 0, 1, 0)
  e.matTexture(id, 'map', t)
  e.matTexture(id, 'normal', n)
  e.matTexture(id, 'mask', n)
  e.matTexture(id, '_Detail', t)
  const o = host.scene.get(id)
  assert.deepEqual(o.ext.textures, { map: t, normal: n, mask: n, _Detail: t })
  assert.equal(o.ext.floats._HasBump, 1)
  assert.equal(o.ext.floats._HasMask, 1)
  // 0 或不存在的贴图：map 回到白（0），normal/mask 关掉标志但保留旧绑定，其他槽不动
  e.matTexture(id, 'map', 0)
  e.matTexture(id, 'normal', 999)
  e.matTexture(id, 'mask', 0)
  e.matTexture(id, '_Detail', 0)
  assert.deepEqual(o.ext.textures, { map: 0, normal: n, mask: n, _Detail: t })
  assert.equal(o.ext.floats._HasBump, 0)
  assert.equal(o.ext.floats._HasMask, 0)
  // 没有渲染器的对象（空对象、相机）忽略
  const empty = e.spawn('empty', '', 0)
  e.matTexture(empty, 'map', t)
  e.matFloat(empty, '_UVMode', 1)
  assert.deepEqual(host.scene.get(empty).ext, {})
  e.matTexture(e.cameraId(), 'map', t)
  assert.deepEqual(host.scene.camera.ext, {})
})

test('web-texture：matFloat / matVector 写入材质状态，_Metallic/_Glossiness 与 surface 同源', () => {
  const host = fakeHost()
  const e = host.engine
  const id = e.spawn('sphere', '', 0)
  e.matFloat(id, '_UVMode', 2)
  e.matFloat(id, '_BumpScale', 0.5)
  e.matFloat(id, '_Metallic', 0.7)
  e.matFloat(id, '_Glossiness', 0.2)
  e.matVector(id, '_Tiling', 2, 3, 0.5, 0.25)
  const o = host.scene.get(id)
  assert.deepEqual(o.ext.floats, { _UVMode: 2, _BumpScale: 0.5 })
  assert.deepEqual(o.ext.vectors, { _Tiling: [2, 3, 0.5, 0.25] })
  assert.equal(o.mat.metallic, 0.7)
  assert.equal(o.mat.smoothness, 0.2)
  e.surface(id, 0.1, -1)
  assert.equal(o.mat.metallic, 0.1)
  assert.equal(o.mat.smoothness, 0.2)
  for (const k of ['matTexture', 'matFloat', 'matVector', 'destroyTexture']) assert.ok(!host.unsupported.has(k), k)
})

test('web-texture：texturePixels 翻转成从上到下并按 tint 相乘 RGB', () => {
  const W = web()
  const tex = { width: 2, height: 2, data: PIXELS }
  assert.deepEqual(Array.from(W.texturePixels(tex)), [0, 0, 255, 255, 255, 255, 255, 128, 255, 0, 0, 255, 0, 255, 0, 255])
  const half = Array.from(W.texturePixels(tex, '80ff0040'))
  assert.deepEqual(half.slice(0, 8), [0, 0, 0, 255, 128, 255, 0, 128])
})
