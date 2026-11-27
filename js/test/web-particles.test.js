/**
 * Web 宿主的粒子迸发（004 第 20.2 节 web-3）：burst 的参数解析、发射与模拟照 PotRender.Burst / Particles。
 */
const test = require('node:test')
const assert = require('node:assert/strict')
const { loadWebPot } = require('./helpers')

const web = () => loadWebPot().web

/** 固定序列的随机数 */
function seq(values) {
  let i = 0
  return () => values[i++ % values.length]
}

test('burst：缺 pos 忽略、count 夹到 1 到 500、不认识的 kind 走 spark', () => {
  const p = new (web().WebParticles)(null, seq([0.5]))
  p.burst('{"count":10}')
  p.burst('not json')
  assert.equal(p.alive, 0)
  p.burst('{"pos":[0,0,0],"count":0}')
  assert.equal(p.pool('spark').count, 1)
  p.burst('{"pos":[0,0,0],"count":9999,"kind":"glow"}')
  assert.equal(p.pool('glow').count, 500)
  p.burst('{"pos":[0,0,0],"kind":"what"}')
  assert.equal(p.pool('spark').count, 1 + 8)
})

test('burst：颜色转线性后除以最大分量，速度、尺寸、寿命按 jitter 取值', () => {
  // onUnitSphere 用两个随机数；随后 speed、size、life、rotation 各一个
  const p = new (web().WebParticles)(null, seq([1, 0, 1, 0, 0.5, 0.5]))
  p.burst(JSON.stringify({ pos: [1, 2, 3], dir: [0, 0, 5], color: [2, 1, 0, 0.5], count: 1, spread: 0, speed: 4, speedJitter: 0.5, size: 0.1, sizeJitter: 0.5, life: 0.4, lifeJitter: 0.5 }))
  const s = p.pool('spark')
  assert.equal(s.count, 1)
  assert.deepEqual([...s.pos.slice(0, 3)], [1, 2, 3])
  // spread 0 时方向即 dir，speed = 4·(1 + 0.5)
  const v = [...s.vel.slice(0, 3)]
  assert.ok(Math.abs(v[0]) < 1e-6 && Math.abs(v[1]) < 1e-6 && Math.abs(v[2] - 6) < 1e-5, String(v))
  assert.ok(Math.abs(s.size[0] - 0.05) < 1e-6)
  assert.ok(Math.abs(s.life[0] - 0.4) < 1e-6)
  // HdrToLinear([2,1,0]) = [2, 2·lin(0.5), 0]，再除以最大分量 2
  const g = web().srgbToLinear(0.5)
  const c = [...s.color.slice(0, 4)]
  assert.ok(Math.abs(c[0] - 1) < 1e-6 && Math.abs(c[1] - g) < 1e-6 && c[2] === 0 && c[3] === 0.5, String(c))
})

test('burst：spread < 1 时反向的方向沿 dir 反射到正半球；寿命下限 0.02', () => {
  // onUnitSphere 取 z = −1（正下方），spread 0.9 插值后仍朝下，应被反射
  const p = new (web().WebParticles)(null, seq([0, 0, 0.5, 0.5, 0, 0.5]))
  p.burst(JSON.stringify({ pos: [0, 0, 0], dir: [0, 0, 1], count: 1, spread: 0.9, life: 0.01, lifeJitter: 1 }))
  const s = p.pool('spark')
  assert.ok(s.vel[2] >= 0, String([...s.vel.slice(0, 3)]))
  assert.equal(Math.fround(s.life[0]), Math.fround(0.02))
})

test('update：spark 受重力、到寿命删除；smoke 上浮且减速；glow 不受重力', () => {
  const W = web()
  const p = new W.WebParticles(null, seq([0.5]))
  const base = { pos: [0, 10, 0], dir: [1, 0, 0], count: 1, spread: 0, speedJitter: 0, sizeJitter: 0, lifeJitter: 0, life: 1 }
  p.burst(JSON.stringify({ ...base, kind: 'spark' }))
  p.burst(JSON.stringify({ ...base, kind: 'smoke' }))
  p.burst(JSON.stringify({ ...base, kind: 'glow' }))
  p.update(0.1)
  const sp = p.pool('spark'), sm = p.pool('smoke'), gl = p.pool('glow')
  assert.ok(Math.abs(sp.vel[1] + 0.981) < 1e-5)
  assert.ok(sm.vel[1] > 0 && sm.vel[0] < 4)
  assert.equal(gl.vel[1], 0)
  assert.ok(Math.abs(gl.pos[0] - 0.4) < 1e-5)
  p.update(1)
  assert.equal(p.alive, 0)
})

test('update：spark 碰到地面反弹（法向乘 0.3，整体乘 0.5，扣 0.2 寿命）', () => {
  const W = web()
  const ground = (ox, oy, oz, dx, dy, dz, max) => {
    if (dy >= 0) return null
    const t = oy / -dy
    return t <= 1 ? { id: 1, point: [ox + dx * t, 0, oz + dz * t], normal: [0, 1, 0], distance: t * max } : null
  }
  const p = new W.WebParticles(ground, seq([0.5]))
  p.burst(JSON.stringify({ pos: [0, 0.05, 0], dir: [0, -1, 0], count: 1, spread: 0, speed: 10, speedJitter: 0, sizeJitter: 0, lifeJitter: 0, life: 1 }))
  p.update(0.02)
  const s = p.pool('spark')
  assert.ok(s.vel[1] > 0, String(s.vel[1]))
  assert.ok(Math.abs(s.vel[1] - (10 + 0.981 * 0.02 * 10) * 0.3 * 0.5) < 0.05, String(s.vel[1]))
  assert.ok(s.pos[1] >= 0)
  assert.ok(Math.abs(s.age[0] - 0.22) < 1e-5)
})

test('kindCurve：spark 颜色白到 (1, 0.55, 0.3)、alpha 后半段淡出；smoke 尺寸 0.5 到 1.6', () => {
  const { kindCurve } = web()
  const out = []
  assert.deepEqual(kindCurve('spark', 1, out).map((x) => +x.toFixed(4)), [1, 0.55, 0.3, 0, 1])
  assert.equal(kindCurve('spark', 0.4, out)[3], 1)
  assert.equal(kindCurve('smoke', 0.12, out)[3], 1)
  assert.ok(Math.abs(kindCurve('smoke', 1, out)[4] - 1.6) < 1e-9)
  assert.ok(Math.abs(kindCurve('glow', 1, out)[4] - 0.3) < 1e-9)
})

test('web 宿主：engine.burst 交给 host.particles', () => {
  const W = web()
  const host = W.createWebHost({
    files: { 'manifest.json': '{"id":"t"}' },
    ui: { submit() {}, measure: () => [0, 0] },
    platform: { screen: () => [1, 1], focused: () => true, cursor() {}, cursorLocked: () => false },
  })
  host.engine.burst('{"pos":[0,0,0],"count":3,"kind":"smoke"}')
  assert.equal(host.particles.pool('smoke').count, 3)
  assert.equal(host.unsupported.has('burst'), false)
})
