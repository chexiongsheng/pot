/**
 * 确定性数学 dmath（004 第 18.7 节）：与 fdlibm 一致的 sin、cos。
 * 这里用 C 版 fdlibm 的已知结果与恒等式检查；与 C# PotMath 的逐位比较在 Runner 里做（math-check）。
 */
const test = require('node:test')
const assert = require('node:assert/strict')
const { loadPot } = require('./helpers')

const { dmath } = loadPot()

test('dmath：特殊值与小参数', () => {
  assert.ok(Object.is(dmath.sin(0), 0))
  assert.ok(Object.is(dmath.sin(-0), -0))
  assert.equal(dmath.cos(0), 1)
  assert.equal(dmath.sin(1e-30), 1e-30)
  assert.ok(Number.isNaN(dmath.sin(NaN)))
  assert.ok(Number.isNaN(dmath.sin(Infinity)))
  assert.ok(Number.isNaN(dmath.cos(-Infinity)))
})

test('dmath：与 Math 的差不超过 1 ulp，sin² + cos² ≈ 1，奇偶性严格成立', () => {
  let seed = 7
  const rnd = () => { seed = (seed * 1103515245 + 12345) >>> 0; return seed / 4294967296 }
  const ulp = (x) => {
    const f = new Float64Array([Math.abs(x)])
    const u = new BigInt64Array(f.buffer)
    u[0] += 1n
    return f[0] - Math.abs(x)
  }
  for (let i = 0; i < 20000; i++) {
    const x = (rnd() - 0.5) * (i < 10000 ? 20 : 2e5)
    const s = dmath.sin(x), c = dmath.cos(x)
    assert.ok(Math.abs(s - Math.sin(x)) <= ulp(s), `sin(${x})：${s} vs ${Math.sin(x)}`)
    assert.ok(Math.abs(c - Math.cos(x)) <= ulp(c), `cos(${x})：${c} vs ${Math.cos(x)}`)
    assert.ok(Math.abs(s * s + c * c - 1) < 4e-16)
    assert.ok(Object.is(dmath.sin(-x), -s))
    assert.ok(Object.is(dmath.cos(-x), c))
  }
})

test('dmath：fdlibm 的已知结果（与 C 版 fdlibm 相同的位）', () => {
  // 这些值是 fdlibm 的输出；V8 新版本的 Math.sin 用 glibc 移植，其中个别会差 1 ulp
  const hex = (x) => { const f = new Float64Array([x]); return Buffer.from(f.buffer).reverse().toString('hex') }
  assert.equal(hex(dmath.sin(1)), '3feaed548f090cee')
  assert.equal(hex(dmath.cos(1)), '3fe14a280fb5068c')
  assert.equal(hex(dmath.sin(Math.PI)), '3ca1a62633145c07')
  assert.equal(hex(dmath.cos(Math.PI / 2)), '3c91a62633145c07')
  assert.equal(dmath.sin(100), -0.5063656411097588)
})
