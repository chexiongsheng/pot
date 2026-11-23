/**
 * 原版地面（pretty.js 23498-23830：F1/Ab/fs/SR/Rb/Cb/Ib）机械移植。
 * - Rb：CPU 生成的大尺度遮罩（r 积水高度、g 干湿、b 油污、a 磨损），覆盖 Li
 * - Cb：可平铺细节 det 与法线 nrm
 * - 着色器见 data/shaders/apron.frag（TR + AR 片段移植，光照走 <pot/lit>）
 * 坐标：遮罩与着色器都用原版 three 坐标（x, z）；Unity z = -three z，着色器里自行换算。
 * 缺口：Pb 标线贴图用 Canvas2D 绘制（Runner 无 2D 画布），暂用 level.ts 的标线几何代替。
 */
import type { Context, Texture } from '@pot/core'

// ---- 原版代码（名字保持原样） ----
function F1(i: number, e: number, t: number) {
  let n = Math.imul(i | 0, 374761393) ^ Math.imul(e | 0, 668265263) ^ Math.imul(t | 0, 1274126177)
  return n = Math.imul(n ^ n >>> 13, 1274126177), ((n ^ n >>> 16) >>> 0) / 4294967296
}
function Ab(i: number, e: number, t: number, n?: number) {
  let s = Math.floor(i), o = Math.floor(e), r = i - s, a = e - o, l = r * r * (3 - 2 * r), c = a * a * (3 - 2 * a), u = s, h = s + 1, f = o, p = o + 1
  n && (u = (u % n + n) % n, h = (h % n + n) % n, f = (f % n + n) % n, p = (p % n + n) % n)
  let d = F1(u, f, t), v = F1(h, f, t), g = F1(u, p, t), x = F1(h, p, t)
  return d + (v - d) * l + (g - d) * c + (d - v - g + x) * l * c
}
function fs(i: number, e: number, t: number, n = 4, s = 0) {
  let o = 0, r = 0.5, a = 0
  for (let l = 0; l < n; l++) o += r * Ab(i, e, t + l * 17, s), a += r, i *= 2, e *= 2, s *= 2, r *= 0.5
  return o / a
}
const So = (i: number) => i < 0 ? 0 : i > 1 ? 1 : i, fl = (i: number, e: number, t: number) => {
  let n = So((t - i) / (e - i))
  return n * n * (3 - 2 * n)
}, wR = 0.385
export const Li = { x0: -44, z0: -40, size: 80 }
const Sb = [[-30.5, 6.6, 2.6, 1.7, 0.24], [-19.5, 5.2, 7.5, 1.5, 0.27], [-11.5, 7, 5, 1.2, 0.24], [-7.6, 5.6, 2.3, 1.7, 0.2], [5.6, 4.7, 3.3, 1.35, 0.26], [13, 6.6, 2.6, 1.2, 0.2], [-13, -1.3, 4.6, 1.5, 0.2], [1, -1.6, 3.4, 1.4, 0.18], [12.5, -1.4, 2.4, 1.3, 0.18], [-3.5, -8.2, 4.4, 1.6, 0.2], [-20, -8.6, 3.6, 1.6, 0.18], [14.6, -19.5, 2, 3.6, 0.2], [23.5, 6.9, 3.2, 2, 0.22], [23.2, -7.6, 3.4, 1.8, 0.2], [20.8, 1.5, 1.4, 3.6, 0.16], [23.5, 22.5, 3, 2, 0.2], [24, -25, 2.8, 2.6, 0.2], [-1, 16.5, 7, 1.7, 0.2], [11.5, 16.9, 3.6, 1.4, 0.18], [-17, 15.8, 3.2, 1.5, 0.18], [8.6, 12.3, 1.5, 3.4, 0.17], [-7.8, 19.5, 1.7, 3.6, 0.17], [-8, 25.8, 6, 1.3, 0.18], [9, 25.9, 4, 1.2, 0.18], [-32, -4, 2.6, 3.4, 0.18], [-31, 18, 3, 4, 0.18]], Tb = 1, ER = 0.02
function SR(i: number, e: number) {
  let t = 0.5 + (fs(i / 8.5, e / 8.5, 11, 4) - 0.47) * 0.3 + (fs(i / 2.4, e / 2.4, 23, 3) - 0.5) * 0.14
  for (let n = 0; n < Sb.length; n++) {
    let s = Sb[n], o = (i - s[0]) / (s[2] * Tb), r = (e - s[1]) / (s[3] * Tb), a = o * o + r * r
    a < 9 && (t -= (s[4] + ER) * Math.exp(-a * a))
  }
  if (i > -37 && i < 29) {
    let n = 0.5 + 0.5 * Ab(i / 6, 3.1, 5), s = (e - 4.9) / 0.5, o = (e - 7.1) / 0.5, r = (e - 15.4) / 0.5, a = (e - 17.2) / 0.5, l = fl(0.14, 0.34, fs(i / 9, 7.7, 19, 2)) * fl(-27, -24, i) * (1 - fl(14, 17, i))
    t -= 0.22 * (0.55 + 0.45 * n) * l * (Math.exp(-s * s) + Math.exp(-o * o)) + 0.09 * n * (1 - fl(0.3, 0.6, fs(i / 9, 7.7, 19, 2))) * (Math.exp(-r * r) + Math.exp(-a * a))
  }
  return t += 0.25 * fl(28.6, 29.8, i), t
}
function Rb(i: number) {
  let e = new Uint8Array(i * i * 4), { x0: t, z0: n, size: s } = Li, o = s / i
  for (let r = 0; r < i; r++) {
    let a = n + (r + 0.5) * o
    for (let l = 0; l < i; l++) {
      let c = t + (l + 0.5) * o, u = (r * i + l) * 4, h = SR(c, a)
      e[u] = Math.round(So(0.5 + (h - wR) * 2.5) * 255), e[u + 1] = Math.round(So(0.5 + (fs(c / 5.5, a / 5.5, 41, 3) - 0.5) * 1.5 + (0.5 - h) * 0.9) * 255)
      let f = fl(0.6, 0.78, fs(c / 1.4, a / 1.4, 77, 4)) * fl(0.47, 0.62, fs(c / 9, a / 9, 91, 2))
      e[u + 2] = Math.round(So(f) * 255), e[u + 3] = Math.round(So(fs(c / 22, a / 0.9, 57, 3) * 0.6 + fs(c / 13, a / 13, 63, 3) * 0.4) * 255)
    }
  }
  return e
}
function Cb(i: number) {
  let e = new Uint8Array(i * i * 4), t = new Uint8Array(i * i * 4), n = new Float32Array(i * i), s = new Float32Array(i * i)
  for (let r = 0; r < i; r++) for (let a = 0; a < i; a++) {
    let l = a / i, c = r / i, u = r * i + a, h = fs(l * 96, c * 96, 3, 2, 96) * 0.6 + fs(l * 40, c * 40, 9, 2, 40) * 0.4, f = fs(l * 6, c * 6, 21, 4, 6), p = (fs(l * 8, c * 8, 31, 2, 8) - 0.5) * 0.25, d = (fs(l * 8, c * 8, 37, 2, 8) - 0.5) * 0.25, v = 1 - Math.abs(2 * fs((l + p) * 5, (c + d) * 5, 43, 3, 5) - 1), g = fs(l * 28, c * 28, 51, 3, 28)
    e[u * 4] = Math.round(So(h) * 255), e[u * 4 + 1] = Math.round(So(f) * 255), e[u * 4 + 2] = Math.round(So(v) * 255), e[u * 4 + 3] = Math.round(So(g) * 255), n[u] = h, s[u] = fs(l * 9, c * 9, 71, 4, 9)
  }
  let o = (r: number) => (r + i) % i
  for (let r = 0; r < i; r++) for (let a = 0; a < i; a++) {
    let l = r * i + a, c = (n[r * i + o(a + 1)] - n[r * i + o(a - 1)]) * 2.2, u = (n[o(r + 1) * i + a] - n[o(r - 1) * i + a]) * 2.2, h = (s[r * i + o(a + 2)] - s[r * i + o(a - 2)]) * 9, f = (s[o(r + 2) * i + a] - s[o(r - 2) * i + a]) * 9
    t[l * 4] = Math.round(So(0.5 - c) * 255), t[l * 4 + 1] = Math.round(So(0.5 - u) * 255), t[l * 4 + 2] = Math.round(So(0.5 - h) * 255), t[l * 4 + 3] = Math.round(So(0.5 - f) * 255)
  }
  return { det: e, nrm: t }
}

// ---- 积水查询（原版 ground.puddleDepth / isPuddle，three 坐标；CPU 侧保留 Rb 数据） ----

let maskCache: { res: number; data: Uint8Array } | undefined
function maskData(res = 512) {
  if (!maskCache) maskCache = { res, data: Rb(res) }
  return maskCache
}
/** 原版 U1：遮罩双线性采样（通道 s），0..1 */
function U1(i: Uint8Array, e: number, t: number, n: number, s: number) {
  let o = (t - Li.x0) / Li.size * e - 0.5, r = (n - Li.z0) / Li.size * e - 0.5
  o = o < 0 ? 0 : o > e - 1.001 ? e - 1.001 : o, r = r < 0 ? 0 : r > e - 1.001 ? e - 1.001 : r
  const a = o | 0, l = r | 0, c = o - a, u = r - l, h = (l * e + a) * 4 + s, f = e * 4
  return ((i[h] * (1 - c) + i[h + 4] * c) * (1 - u) + (i[h + f] * (1 - c) + i[h + f + 4] * c) * u) / 255
}
const QUAY_X = 30
type Box3 = { min: { x: number; z: number }; max: { x: number; z: number } }
/** 原版 puddleDepth(x, z)：three 坐标；interior 为原版 level.interiorBoxes */
export function puddleDepth(x: number, z: number, interior: Box3[] = []): number {
  const inLi = x > Li.x0 && x < Li.x0 + Li.size && z > Li.z0 && z < Li.z0 + Li.size
  let inside = false
  for (const b of interior) if (b && x > b.min.x && x < b.max.x && z > b.min.z && z < b.max.z) { inside = true; break }
  if (x > QUAY_X || !inLi || inside) return -0.2
  const m = maskData()
  return 0.5 - U1(m.data, m.res, x, z, 0)
}
export const isPuddle = (x: number, z: number, interior?: Box3[]) => puddleDepth(x, z, interior) > 0.015

// ---- 接入 Runner ----

export interface Apron {
  /** 原版 uWetG（0 干 .. 1 湿） */
  setWet(v: number): void
  setRain(v: number): void
  /** Cb 细节纹理（海面共用） */
  detail: Texture
  detailN: Texture
  /** Rb 积水遮罩（r < 0.49 为积水；雨点溅射共用） */
  mask: Texture
}

/** 原版 Ib：apron 平面 190×320，平移 (-65,0,0)；不投影、接收阴影 */
export function createApron(ctx: Context, opts: { maskRes?: number; detailRes?: number } = {}): Apron | undefined {
  const { scene, gfx } = ctx
  if (!gfx.supported) return undefined
  const maskRes = opts.maskRes ?? 512, detailRes = opts.detailRes ?? 256
  const t0 = Date.now()
  const md = maskCache && maskCache.res === maskRes ? maskCache : (maskCache = { res: maskRes, data: Rb(maskRes) })
  const mask = scene.texture({ data: md.data, width: maskRes, height: maskRes, linear: true, wrap: 'clamp', filter: 'trilinear', mipmaps: true })
  const t1 = Date.now()
  const { det, nrm } = Cb(detailRes)
  const tex = (data: Uint8Array): Texture => scene.texture({ data, width: detailRes, height: detailRes, linear: true, wrap: 'repeat', filter: 'trilinear', mipmaps: true, aniso: 8 })
  const detail = tex(det), detailN = tex(nrm)
  ctx.logger('apron').info('遮罩 %d² %dms，细节 %d² %dms', maskRes, t1 - t0, detailRes, Date.now() - t1)

  const shader = gfx.shader({ fragment: 'shaders/apron.frag', name: 'saltline/apron' })
  const uniforms: Record<string, any> = {
    uRain: 0.6, uWetG: 1, uMaskRes: maskRes,
    uMask: mask, uDetail: detail, uDetailN: detailN,
    uMaskRect: [Li.x0, Li.z0, 1 / Li.size, 0],
  }
  // Unity plane 为 10×10：190×320 → scale (19, 1, 32)，中心 x=-65（z 取反不影响对称平面）
  const ent = scene.spawn({ shape: 'plane', name: 'apron', position: [-65, 0, 0], scale: [19, 1, 32], collider: false })
    .shader(shader, { uniforms, shadows: false })
  return {
    detail, detailN, mask,
    setWet(v) { ent.uniforms({ uWetG: v }) },
    setRain(v) { ent.uniforms({ uRain: v }) },
  }
}
