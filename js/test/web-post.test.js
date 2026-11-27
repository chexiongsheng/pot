/**
 * Web 宿主的后处理（004 第 20.3 节 web-3）：web/post.ts 照 URP 14 的 HDR 调色 LUT（白平衡、对比度、滤色、阴影中间调高光、饱和度、
 * Neutral 与快速 ACES 色调映射）、bloom 参数与金字塔层数、渲染缩放。GPU 部分在浏览器里验证。
 */
const test = require('node:test')
const assert = require('node:assert/strict')
const { loadWebPot } = require('./helpers')

const web = () => loadWebPot().web
const near = (a, b, eps = 1e-4) => Math.abs(a - b) <= eps

test('LogC 编解码互逆，1 对应约 58.86（曝光后的夹取上限）', () => {
  const w = web()
  for (const x of [0, 0.005, 0.18, 1, 20]) assert.ok(near(w.logCToLinear(w.linearToLogC(x)), x, 1e-5 * Math.max(1, x)))
  assert.ok(near(w.logCToLinear(1), 58.8566, 1e-3))
})

test('白平衡与阴影高光：缺省值换算为 1；色温为正时偏暖', () => {
  const w = web()
  for (const v of w.colorBalance(0, 0)) assert.ok(near(v, 1, 1e-5))
  assert.deepEqual(w.smhParam([1, 1, 1, 0]), [1, 1, 1])
  // w 为偏移：负值 × 1，正值 × 4，结果不小于 0
  assert.ok(near(w.smhParam([1, 1, 1, 0.1])[0], 1.4))
  assert.equal(w.smhParam([0, 0, 0, -0.5])[0], 0)
  const g = w.gradeParams({ ...w.defaultPost(), temperature: 40 })
  const c = w.gradeColor([0.5, 0.5, 0.5], g)
  assert.ok(c[0] > c[2], '暖色调红多于蓝')
})

test('色调映射：0 映射到 0，单调递增；Neutral 白点约 4，ACES 中灰约 0.108', () => {
  const w = web()
  assert.ok(near(w.neutralTonemap([0, 0, 0])[0], 0, 1e-6))
  // URP 先乘 whiteScale = 1 / curve(5.3) 再过曲线：输入 5.3 · curve(5.3) 映射到 1
  const n1 = w.neutralTonemap([1, 1, 1])[0]
  let lo = 0.5, hi = 10
  for (let i = 0; i < 60; i++) {
    const m = (lo + hi) / 2
    if (w.neutralTonemap([m, m, m])[0] < 1) lo = m
    else hi = m
  }
  assert.ok(lo > 3 && lo < 4.5, `白点 ${lo}`)
  assert.ok(near(n1, 0.6311, 1e-3))
  const g = w.gradeParams({ ...w.defaultPost(), tonemap: 2 })
  assert.ok(near(w.gradeColor([0, 0, 0], g)[0], 0, 1e-4))
  assert.ok(near(w.gradeColor([0.18, 0.18, 0.18], g)[0], 0.1078, 1e-3))
  let prevN = -1
  let prevA = -1
  for (let x = 0.001; x < 50; x *= 1.5) {
    const n = w.neutralTonemap([x, x, x])[0]
    const a = w.gradeColor([x, x, x], g)[0]
    assert.ok(n > prevN && a > prevA, `x=${x}`)
    assert.ok(a < 1)
    prevN = n
    prevA = a
  }
})

test('无色调映射且参数缺省时调色为恒等；对比度、饱和度、滤色生效', () => {
  const w = web()
  const base = { ...w.defaultPost(), tonemap: 0 }
  const id = w.gradeParams(base)
  for (const x of [0, 0.05, 0.18, 1, 10]) {
    const c = w.gradeColor([x, x * 0.5, x * 0.25], id)
    assert.ok(near(c[0], x, 1e-3 * Math.max(1, x)) && near(c[1], x * 0.5, 1e-3 * Math.max(1, x)))
  }
  // 对比度围绕中灰（ACEScc 0.4135884 对应的线性值）拉伸
  const hi = w.gradeParams({ ...base, contrast: 50 })
  assert.ok(w.gradeColor([0.8, 0.8, 0.8], hi)[0] > 0.8)
  assert.ok(w.gradeColor([0.02, 0.02, 0.02], hi)[0] < 0.02)
  // 饱和度 −100 变灰
  const gray = w.gradeColor([0.6, 0.2, 0.1], w.gradeParams({ ...base, saturation: -100 }))
  assert.ok(near(gray[0], gray[1], 1e-6) && near(gray[1], gray[2], 1e-6))
  // 滤色按线性值相乘
  const f = w.gradeColor([0.5, 0.5, 0.5], w.gradeParams({ ...base, filter: [0.5, 1, 1, 1] }))
  assert.ok(near(f[0], 0.5 * 0.21404, 1e-3))
})

test('LUT：32³，格点按 LogC 解码后调色', () => {
  const w = web()
  const g = w.gradeParams({ ...w.defaultPost(), tonemap: 0 })
  const lut = w.bakeLut(g, 4)
  assert.equal(lut.length, 4 * 4 * 4 * 4)
  // 格点 (r=3, g=0, b=0)：r 为 LogC 1 → 58.86，g、b 为 LogC 0 → 负值夹到 0
  const i = 3 * 4
  assert.ok(near(lut[i], w.logCToLinear(1), 1e-2))
  assert.equal(lut[i + 1], 0)
  assert.equal(lut[i + 3], 1)
  assert.equal(w.LUT_SIZE, 32)
})

test('bloom 参数：阈值转线性、软膝为一半、scatter 映射、tint 按亮度归一化；层数', () => {
  const w = web()
  const p = { ...w.defaultPost(), bloom: 0.6, bloomThreshold: 1, bloomScatter: 0, bloomTint: [1, 0.5, 0.5, 1] }
  const b = w.bloomParams(p)
  assert.equal(b.intensity, 0.6)
  assert.ok(near(b.threshold, 1) && near(b.knee, 0.5))
  assert.ok(near(b.scatter, 0.05))
  assert.ok(near(w.bloomParams({ ...p, bloomScatter: 1 }).scatter, 0.95))
  const l = b.tint[0] * 0.2126729 + b.tint[1] * 0.7151522 + b.tint[2] * 0.072175
  assert.ok(near(l, 1, 1e-6) && b.tint[0] > b.tint[1])
  assert.deepEqual(w.bloomParams({ ...p, bloomTint: [0, 0, 0, 1] }).tint, [1, 1, 1])
  // 半分辨率 960 → floor(log2 960 − 1) = 8，上限 6；极小画面至少 1 层
  assert.equal(w.bloomMipCount(1920, 1080), 6)
  assert.equal(w.bloomMipCount(64, 32), 4)
  assert.equal(w.bloomMipCount(2, 2), 1)
})

test('渲染缩放：取整且至少 1 像素', () => {
  const w = web()
  const q = w.defaultQuality()
  assert.deepEqual(w.scaledSize(1000, 500, q), [1000, 500])
  assert.deepEqual(w.scaledSize(1000, 501, { ...q, renderScale: 0.5 }), [500, 251])
  assert.deepEqual(w.scaledSize(1, 1, { ...q, renderScale: 0.25 }), [1, 1])
})
