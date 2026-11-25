/**
 * 确定性数学（004 第 18.7、18.14 节）：模拟里要与原生实现、其他 JS 引擎逐位一致的函数。
 *
 * - sin、cos：fdlibm（与 C# 的 PotMath.Sin/Cos 同一算法、同一运算顺序）。不用 Math.sin：
 *   V8 的 Math.sin/cos 是从 glibc 移植的查表实现，与 fdlibm 约 3% 的输入差 1 ulp，换引擎（JSC、SpiderMonkey）又不同。
 * - |x| 超过 2^19·π/2（约 82 万弧度）时没有照搬 __kernel_rem_pio2，退回 Math.sin/cos，不保证一致。
 * - exp、hypot 目前直接用 Math（实测 V8 与 PotMath 逐位一致），换引擎时再补。
 */

const f64 = new Float64Array(1)
const u32 = new Uint32Array(f64.buffer)
/** 小端：u32[1] 是高字 */
const high = (x: number) => { f64[0] = x; return u32[1] | 0 }
const words = (hi: number, lo: number) => { u32[1] = hi >>> 0; u32[0] = lo >>> 0; return f64[0] }

const invpio2 = 6.36619772367581382433e-01
const pio2_1 = 1.57079632673412561417e+00
const pio2_1t = 6.07710050650619224932e-11
const pio2_2 = 6.07710050630396597660e-11
const pio2_2t = 2.02226624879595063154e-21
const pio2_3 = 2.02226624871116645580e-21
const pio2_3t = 8.47842766036889956997e-32

const npio2_hw = [
  0x3FF921FB, 0x400921FB, 0x4012D97C, 0x401921FB, 0x401F6A7A, 0x4022D97C,
  0x4025FDBB, 0x402921FB, 0x402C463A, 0x402F6A7A, 0x4031475C, 0x4032D97C,
  0x40346B9C, 0x4035FDBB, 0x40378FDB, 0x403921FB, 0x403AB41B, 0x403C463A,
  0x403DD85A, 0x403F6A7A, 0x40407E4C, 0x4041475C, 0x4042106C, 0x4042D97C,
  0x4043A28C, 0x40446B9C, 0x404534AC, 0x4045FDBB, 0x4046C6CB, 0x40478FDB,
  0x404858EB, 0x404921FB,
]

const y = [0, 0]

/** __ieee754_rem_pio2：结果在 y，返回 n；参数太大时返回 NaN */
function remPio2(x: number): number {
  let z: number, w: number, t: number, r: number
  const hx = high(x)
  const ix = hx & 0x7FFFFFFF
  if (ix <= 0x3FE921FB) { y[0] = x; y[1] = 0; return 0 }
  if (ix < 0x4002D97C) {
    if (hx > 0) {
      z = x - pio2_1
      if (ix !== 0x3FF921FB) { y[0] = z - pio2_1t; y[1] = (z - y[0]) - pio2_1t }
      else { z -= pio2_2; y[0] = z - pio2_2t; y[1] = (z - y[0]) - pio2_2t }
      return 1
    }
    z = x + pio2_1
    if (ix !== 0x3FF921FB) { y[0] = z + pio2_1t; y[1] = (z - y[0]) + pio2_1t }
    else { z += pio2_2; y[0] = z + pio2_2t; y[1] = (z - y[0]) + pio2_2t }
    return -1
  }
  if (ix <= 0x413921FB) {
    t = Math.abs(x)
    const n = (t * invpio2 + 0.5) | 0
    const fn = n
    r = t - fn * pio2_1
    w = fn * pio2_1t
    if (n < 32 && ix !== npio2_hw[n - 1]) {
      y[0] = r - w
    } else {
      const j = ix >> 20
      y[0] = r - w
      let i = j - ((high(y[0]) >> 20) & 0x7FF)
      if (i > 16) {
        t = r
        w = fn * pio2_2
        r = t - w
        w = fn * pio2_2t - ((t - r) - w)
        y[0] = r - w
        i = j - ((high(y[0]) >> 20) & 0x7FF)
        if (i > 49) {
          t = r
          w = fn * pio2_3
          r = t - w
          w = fn * pio2_3t - ((t - r) - w)
          y[0] = r - w
        }
      }
    }
    y[1] = (r - y[0]) - w
    if (hx < 0) { y[0] = -y[0]; y[1] = -y[1]; return -n }
    return n
  }
  return NaN
}

const S1 = -1.66666666666666324348e-01, S2 = 8.33333333332248946124e-03, S3 = -1.98412698298579493134e-04
const S4 = 2.75573137070700676789e-06, S5 = -2.50507602534068634195e-08, S6 = 1.58969099521155010221e-10

function kernelSin(x: number, yy: number, iy: number): number {
  const ix = high(x) & 0x7FFFFFFF
  if (ix < 0x3E400000) { if ((x | 0) === 0) return x }
  const z = x * x
  const v = z * x
  const r = S2 + z * (S3 + z * (S4 + z * (S5 + z * S6)))
  if (iy === 0) return x + v * (S1 + z * r)
  return x - ((z * (0.5 * yy - v * r) - yy) - v * S1)
}

const C1 = 4.16666666666666019037e-02, C2 = -1.38888888888741095749e-03, C3 = 2.48015872894767294178e-05
const C4 = -2.75573143513906633035e-07, C5 = 2.08757232129817482790e-09, C6 = -1.13596475577881948265e-11

function kernelCos(x: number, yy: number): number {
  const ix = high(x) & 0x7FFFFFFF
  if (ix < 0x3E400000) { if ((x | 0) === 0) return 1.0 }
  const z = x * x
  const r = z * (C1 + z * (C2 + z * (C3 + z * (C4 + z * (C5 + z * C6)))))
  if (ix < 0x3FD33333) return 1.0 - (0.5 * z - (z * r - x * yy))
  const qx = ix > 0x3FE90000 ? 0.28125 : words(ix - 0x00200000, 0)
  const iz = 0.5 * z - qx
  const a = 1.0 - qx
  return a - (iz - (z * r - x * yy))
}

function sin(x: number): number {
  const ix = high(x) & 0x7FFFFFFF
  if (ix <= 0x3FE921FB) return kernelSin(x, 0.0, 0)
  if (ix >= 0x7FF00000) return x - x
  const n = remPio2(x)
  if (Number.isNaN(n)) return Math.sin(x)
  switch (n & 3) {
    case 0: return kernelSin(y[0], y[1], 1)
    case 1: return kernelCos(y[0], y[1])
    case 2: return -kernelSin(y[0], y[1], 1)
    default: return -kernelCos(y[0], y[1])
  }
}

function cos(x: number): number {
  const ix = high(x) & 0x7FFFFFFF
  if (ix <= 0x3FE921FB) return kernelCos(x, 0.0)
  if (ix >= 0x7FF00000) return x - x
  const n = remPio2(x)
  if (Number.isNaN(n)) return Math.cos(x)
  switch (n & 3) {
    case 0: return kernelCos(y[0], y[1])
    case 1: return -kernelSin(y[0], y[1], 1)
    case 2: return -kernelCos(y[0], y[1])
    default: return kernelSin(y[0], y[1], 1)
  }
}

/** 确定性数学：模拟积木（step）里用它代替 Math 的同名函数 */
export const dmath = Object.freeze({ sin, cos })
