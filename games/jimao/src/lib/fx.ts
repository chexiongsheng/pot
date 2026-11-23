/**
 * 原版粒子系统（pretty.js Cf 内的 Bb/Ob 图集 + Rf 模拟池 + Ev 渲染）机械移植，目前接入水花 T（子弹打进积水）。
 * - 两个池：lit（alpha 预乘、太阳/环境光、按距离排序；水柱、水雾、烟团）与 add（加法；拉伸水珠、水平涟漪环）。
 * - 原版 Ev 是实例化四边形（每实例 aPos/aAxis/aCol/aMisc 16 个浮点）；这里每帧把存活粒子展开成 4 顶点（中心相同），
 *   用自定义顶点属性打包（Float32 原样传，HDR 颜色不经 sRGB 转换）：
 *     position = 中心（Unity 坐标），uv.x = 角点 0..3
 *     aAxis    = mode 1：(拉伸轴（Unity 坐标）, size)；其余：(roll, 0, 0, size)
 *     aCol     = rgb（HDR）+ a
 *     aMisc    = (frame, mode, age, shade)
 *   展开、朝向、拉伸宽度都在 shaders/fx.vert 里按原版 HR 计算。
 * - 模拟、发射全部在原版 three 坐标下进行（与原版逐句对照），只在打包时把 z 取反。
 * - 原版 soft particle（读场景深度）：两个片元着色器用 <pot/depth> 的 pot_SoftFade，淡出距离同原版 clamp(size·.4, .04, .7)。
 */
import type { Context, Entity, Vec3 } from '@pot/core'

type V3 = { x: number; y: number; z: number }

// ---------------- 图集（原版 yv / Bb / Ob） ----------------

function yv(i: number) {
  const n = new Float32Array(4096)
  let s = i >>> 0
  const o = () => {
    s |= 0; s = s + 1831565813 | 0
    let l = Math.imul(s ^ s >>> 15, 1 | s)
    l = l + Math.imul(l ^ l >>> 7, 61 | l) ^ l
    return ((l ^ l >>> 14) >>> 0) / 4294967296
  }
  for (let l = 0; l < 4096; l++) n[l] = o()
  const r = (l: number, c: number) => {
    const u = Math.floor(l), h = Math.floor(c)
    let f = l - u, p = c - h
    f = f * f * (3 - 2 * f); p = p * p * (3 - 2 * p)
    const d = u & 63, v = u + 1 & 63, g = (h & 63) * 64, x = (h + 1 & 63) * 64
    const y = n[g + d], b = n[g + v], m = n[x + d], A = n[x + v]
    return y + (b - y) * f + (m - y + (y - b - m + A) * f) * p
  }
  return {
    noise: r,
    fbm: (l: number, c: number, u = 4) => {
      let h = 0, f = 0.5, p = 0
      for (let d = 0; d < u; d++) { h += r(l, c) * f; p += f; l = l * 2.03 + 17.1; c = c * 2.03 + 9.7; f *= 0.5 }
      return h / p
    },
    rnd: o,
  }
}
const To = (i: number, e: number, t: number) => { let n = (t - i) / (e - i); n = n < 0 ? 0 : n > 1 ? 1 : n; return n * n * (3 - 2 * n) }
const Wc = 4, H1 = 2

/** 原版 Bb：lit 图集 4×2（rg 法线、b 厚度、a 不透明度）；6 号格为水柱 */
function Bb(i = 128) {
  const e = i * Wc, t = i * H1, n = new Uint8Array(e * t * 4), s = yv(9173)
  const o = new Float32Array(i * i), r = new Float32Array(i * i), a = new Float32Array(i * i)
  for (let c = 0; c < Wc * H1; c++) {
    const u = c % Wc, h = Math.floor(c / Wc), f = c * 13.37 + 3.1, p = c * 7.77 + 1.3
    for (let d = 0; d < i; d++) for (let v = 0; v < i; v++) {
      const g = (v + 0.5) / i * 2 - 1, x = (d + 0.5) / i * 2 - 1, y = 1 - To(0.78, 0.98, Math.max(Math.abs(g), Math.abs(x)))
      let b: number, m: number, A: number
      if (c === 6) {
        const M = x * 0.5 + 0.5, E = 0.16 + 0.5 * M * M, w = (s.fbm(g * 2 + f, M * 2 + p, 3) - 0.5) * 0.25, S = 1 - To(E * 0.3, E, Math.abs(g + w * M)), z = s.fbm(g * 9 + f, M * 2.2 + p, 4), H = 1 - To(0.55, 0.95, M - (s.noise(g * 6 + f, 3.3) - 0.5) * 0.35), O = To(0, 0.12, M)
        b = S * H * O * To(0.22, 0.7, z + 0.25 * (1 - M)); m = S * H; A = b * 0.5
      } else {
        const M = c === 7, E = M ? 0.3 : 0.6, w = (s.fbm(g * 1.4 + f, x * 1.4 + p, 3) - 0.5) * E, S = (s.fbm(g * 1.4 + p + 5.2, x * 1.4 + f + 1.7, 3) - 0.5) * E, z = g + w, H = x + S, O = Math.sqrt(z * z + H * H), q = (s.fbm(z * 2.2 + f, H * 2.2 + p, 3) - 0.5) * 0.6, U = 1 - To(0, M ? 0.84 : 0.8, O + q), T = s.fbm(z * 4.2 + f * 2, H * 4.2 + p * 2, 5), D = U * (M ? 0.8 + 0.7 * T : 0.25 + 1.5 * T)
        b = To(M ? 0.02 : 0.06, M ? 0.7 : 0.95, D); m = U; A = U * 0.55 + U * s.fbm(z * 3.1 + f * 3, H * 3.1 + p * 3, 3) * 0.9
      }
      const _ = d * i + v
      r[_] = b * y; a[_] = m; o[_] = A * y
    }
    for (let d = 0; d < i; d++) for (let v = 0; v < i; v++) {
      const g = Math.max(0, v - 2), x = Math.min(i - 1, v + 2), y = Math.max(0, d - 2), b = Math.min(i - 1, d + 2)
      const m = (o[d * i + x] - o[d * i + g]) * i / 8, A = (o[b * i + v] - o[y * i + v]) * i / 8, _ = 0.55
      let M = -m * _, E = -A * _
      const w = 1 / Math.sqrt(M * M + E * E + 1)
      M *= w; E *= w
      const S = ((h * i + d) * e + u * i + v) * 4, z = d * i + v
      n[S] = Math.round((M * 0.5 + 0.5) * 255); n[S + 1] = Math.round((E * 0.5 + 0.5) * 255); n[S + 2] = Math.min(255, a[z] * 255); n[S + 3] = Math.min(255, r[z] * 255)
    }
  }
  return { data: n, width: e, height: t }
}

const Af = 4, bv = 2
export const FRAME = { glow: 0, streak: 1, star0: 2, star1: 3, ring: 4, smoke: 5, dot: 6, flame: 7 } as const

/** 原版 Ob：add 图集 4×2（灰度） */
function Ob(i = 128) {
  const e = i * Af, t = i * bv, n = new Uint8Array(e * t * 4), s = yv(4441)
  const o = [0, 1].map(() => {
    const a = 7 + Math.floor(s.rnd() * 4), l: { a: number; l: number; w: number; g: number }[] = []
    for (let c = 0; c < a; c++) l.push({ a: (c / a + (s.rnd() - 0.5) * 0.12) * Math.PI * 2, l: 0.35 + s.rnd() * 0.6, w: 0.018 + s.rnd() * 0.05, g: 0.5 + s.rnd() * 0.5 })
    return l
  })
  for (let a = 0; a < 8; a++) {
    const l = a % Af, c = Math.floor(a / Af)
    for (let u = 0; u < i; u++) for (let h = 0; h < i; h++) {
      const f = (h + 0.5) / i * 2 - 1, p = (u + 0.5) / i * 2 - 1, d = Math.sqrt(f * f + p * p), v = 1 - To(0.86, 0.99, Math.max(Math.abs(f), Math.abs(p)))
      let g = 0
      if (a === FRAME.glow) { const b = Math.max(0, 1 - d); g = b * b * b * 0.75 + Math.exp(-d * d * 22) * 0.5 }
      else if (a === FRAME.streak) { const b = Math.pow(Math.max(0, 1 - f * f), 1.5); g = Math.exp(-(p * p) / (0.42 * 0.42)) * b }
      else if (a === FRAME.star0 || a === FRAME.star1) {
        const b = o[a - FRAME.star0], m = Math.atan2(p, f)
        for (const A of b) {
          let _ = Math.abs(m - A.a) % (Math.PI * 2)
          if (_ > Math.PI) _ = Math.PI * 2 - _
          const M = Math.sin(Math.min(_, 1.5)) * d
          if (_ < 1.5) g += A.g * Math.exp(-(M * M) / (A.w * A.w * (0.4 + d))) * Math.pow(Math.max(0, 1 - d / A.l), 1.4)
        }
        g = g * (0.7 + 0.6 * s.fbm(f * 5 + a * 9, p * 5, 3)) + Math.exp(-d * d * 70) * 1.2 + Math.max(0, 1 - d * 2.2) * 0.06
      } else if (a === FRAME.ring) {
        const b = Math.atan2(p, f), m = 0.78 + (s.noise(Math.cos(b) * 2 + 5, Math.sin(b) * 2 + 5) - 0.5) * 0.04
        g = Math.exp(-((d - m) * (d - m)) / (0.03 * 0.03)) * (0.6 + 0.4 * s.noise(Math.cos(b) * 5 + 9, Math.sin(b) * 5 + 9)) + 0.05 * To(0.2, 0.78, d) * (1 - To(0.78, 0.8, d))
      } else if (a === FRAME.smoke) {
        const b = (s.fbm(f * 1.6 + 3.3, p * 1.6 + 8.1, 3) - 0.5) * 0.5, m = (s.fbm(f * 1.6 + 7.7, p * 1.6 + 2.2, 3) - 0.5) * 0.5, A = f + b, _ = p + m, M = Math.sqrt(A * A + _ * _), E = 1 - To(0, 0.84, M), w = s.fbm(A * 4 + 1.1, _ * 4 + 6.6, 5)
        g = To(0.04, 0.9, E * (0.3 + 1.4 * w)) * (0.45 + 0.75 * E)
      } else if (a === FRAME.dot) g = 1 - To(0.3, 0.62, d)
      else if (a === FRAME.flame) {
        const b = f * 0.5 + 0.5, m = 0.22 + 0.3 * b, _ = (f - 0.8) / 0.16
        let A = Math.exp(-(p * p) / (m * m)) * Math.pow(b, 1.8)
        if (f > 0.8) A *= Math.max(0, 1 - _ * _)
        g = A * 1.15
      }
      g *= v
      const x = Math.max(0, Math.min(255, g * 255)), y = ((c * i + u) * e + l * i + h) * 4
      n[y] = n[y + 1] = n[y + 2] = x; n[y + 3] = 255
    }
  }
  return { data: n, width: e, height: t }
}

let atlases: { lit: ReturnType<typeof Bb>; add: ReturnType<typeof Ob>; ms: number } | undefined

// ---------------- 模拟池（原版 Rf） ----------------

export const BOUNCE = 1
export const KILL = 2
export const STICK = 4

class Pool {
  n = 0
  freeTop: number
  px; py; pz; vx; vy; vz; age; life; s0; s1; sk; rot; rotv; r; g; b; a; drag; grav; wind; turb; seed; fin; fout; stretch; shade; key; gy
  frame; mode; flags; ramp; order; free
  constructor(readonly cap: number, readonly sorted: boolean) {
    this.freeTop = cap
    const f = () => new Float32Array(cap)
    this.px = f(); this.py = f(); this.pz = f(); this.vx = f(); this.vy = f(); this.vz = f(); this.age = f(); this.life = f(); this.s0 = f(); this.s1 = f(); this.sk = f(); this.rot = f(); this.rotv = f()
    this.r = f(); this.g = f(); this.b = f(); this.a = f(); this.drag = f(); this.grav = f(); this.wind = f(); this.turb = f(); this.seed = f(); this.fin = f(); this.fout = f(); this.stretch = f(); this.shade = f(); this.key = f(); this.gy = f()
    this.frame = new Uint8Array(cap); this.mode = new Uint8Array(cap); this.flags = new Uint8Array(cap); this.ramp = new Uint8Array(cap)
    this.order = new Uint16Array(cap); this.free = new Uint16Array(cap)
    for (let s = 0; s < cap; s++) this.free[s] = cap - 1 - s
  }
  clear() {
    this.n = 0; this.freeTop = this.cap
    for (let e = 0; e < this.cap; e++) this.free[e] = this.cap - 1 - e
  }
  emit(e: number, t: number, n: number, s: number, o: number, r: number, a: number, l: number, c: number) {
    if (this.freeTop === 0) return -1
    const u = this.free[--this.freeTop]
    this.order[this.n++] = u
    this.px[u] = e; this.py[u] = t; this.pz[u] = n; this.vx[u] = s; this.vy[u] = o; this.vz[u] = r
    this.age[u] = -1; this.life[u] = a; this.s0[u] = l; this.s1[u] = c; this.sk[u] = 2; this.rot[u] = 0; this.rotv[u] = 0
    this.r[u] = 1; this.g[u] = 1; this.b[u] = 1; this.a[u] = 1; this.drag[u] = 0; this.grav[u] = 0; this.wind[u] = 0; this.turb[u] = 0
    this.seed[u] = Math.random() * 100; this.fin[u] = 0; this.fout[u] = 0.5; this.stretch[u] = 0.02; this.shade[u] = 1; this.key[u] = 0; this.gy[u] = 0
    this.frame[u] = 0; this.mode[u] = 0; this.flags[u] = 0; this.ramp[u] = 0
    return u
  }
  /** 原版 update(dt, 渲染批, 相机, 风, 时间)：模拟 + 排序 + 按原版公式算出每粒子的大小/alpha/颜色后推入批 */
  update(e: number, t: Batch, n: V3, s: V3, o: number) {
    const { px: r, py: a, pz: l, vx: c, vy: u, vz: h, age: f, life: p, order: d, flags: v } = this
    const g = n.x, x = n.y, y = n.z
    let b = 0
    const m = this.n
    for (let A = 0; A < m; A++) {
      const _ = d[A]
      if (f[_] < 0) f[_] = 0
      else {
        f[_] += e
        if (f[_] >= p[_]) { this.free[this.freeTop++] = _; continue }
        const M = 1 - Math.exp(-this.drag[_] * e), E = this.wind[_]
        c[_] += (s.x * E - c[_]) * M; u[_] += (s.y * E - u[_]) * M; h[_] += (s.z * E - h[_]) * M; u[_] -= this.grav[_] * e
        const w = this.turb[_]
        if (w > 0) {
          const H = this.seed[_]
          c[_] += Math.sin(a[_] * 2.3 + H + o * 1.7) * w * e; h[_] += Math.cos(r[_] * 1.9 + H * 1.3 + o * 1.3) * w * e; u[_] += Math.sin(l[_] * 2.1 + H * 0.7 + o * 2.1) * w * 0.4 * e
        }
        r[_] += c[_] * e; a[_] += u[_] * e; l[_] += h[_] * e; this.rot[_] += this.rotv[_] * e
        const S = v[_], z = this.gy[_] + 0.012
        if (S && a[_] < z) {
          if (S & KILL) { this.free[this.freeTop++] = _; continue }
          if (S & BOUNCE) { a[_] = z; if (u[_] < 0) { u[_] = -u[_] * (0.25 + this.seed[_] % 1 * 0.3); c[_] *= 0.65; h[_] *= 0.65 } }
          else if (S & STICK) { a[_] = z; c[_] = u[_] = h[_] = 0 }
        }
      }
      if (this.sorted) { const M = r[_] - g, E = a[_] - x, w = l[_] - y; this.key[_] = M * M + E * E + w * w }
      d[b++] = _
    }
    this.n = b
    if (this.sorted && b > 1) {
      const A = this.key
      for (let _ = 1; _ < b; _++) {
        const M = d[_], E = A[M]
        let w = _ - 1
        for (; w >= 0 && A[d[w]] < E;) { d[w + 1] = d[w]; w-- }
        d[w + 1] = M
      }
    }
    for (let A = 0; A < b; A++) {
      const _ = d[A], M = f[_] / p[_], E = 1 - M, w = 1 - Math.pow(E, this.sk[_]), S = this.s0[_] + (this.s1[_] - this.s0[_]) * w
      let z = this.a[_]
      const H = this.fin[_], O = this.fout[_]
      if (H > 0 && M < H) z *= M / H
      if (M > O) { const Q = 1 - (M - O) / (1 - O); z *= Q * Q * (3 - 2 * Q) }
      let q = this.r[_], U = this.g[_], T = this.b[_]
      const D = this.ramp[_]
      if (D === 1) { q *= Math.pow(E, 0.5); U *= Math.pow(E, 1.4); T *= Math.pow(E, 3) }
      else if (D === 2) { const Q = 1 - Math.pow(M, 1.6), K = Q * Math.sqrt(Q); q *= K; U *= (0.22 + 0.78 * Math.pow(Q, 1.3)) * K; T *= (0.04 + 0.96 * Math.pow(Q, 3.5)) * K }
      else if (D === 3) { const Q = 0.55 + 0.45 * Math.sin(o * 17 + this.seed[_] * 9); q *= Q; U *= Q * (0.6 + 0.4 * E); T *= Q * E }
      const C = this.mode[_]
      let G = 0, j = 1, N = 0
      if (C === 1) { const Q = this.stretch[_]; G = c[_] * Q; j = u[_] * Q; N = h[_] * Q }
      if (!t.push(r[_], a[_], l[_], S, G, j, N, this.rot[_], q, U, T, z, this.frame[_], C, M, this.shade[_])) break
    }
  }
}

// ---------------- 渲染批（原版 Ev 的 begin/push/end → 动态网格） ----------------

interface Batch {
  begin(): void
  push(x: number, y: number, z: number, size: number, ax: number, ay: number, az: number, roll: number, r: number, g: number, b: number, a: number, frame: number, mode: number, age: number, shade: number): boolean
  end(): void
}

function createBatch(ctx: Context, name: string, cap: number, shader: unknown, bind: Record<string, unknown>): Batch & { ent: Entity } {
  const { scene } = ctx
  const P = new Float32Array(cap * 12), U = new Float32Array(cap * 8), A = new Float32Array(cap * 16), C = new Float32Array(cap * 16), M = new Float32Array(cap * 16)
  const I = new Uint32Array(cap * 6)
  for (let k = 0; k < cap; k++) { const c = k * 4; I.set([c, c + 1, c + 2, c, c + 2, c + 3], k * 6); for (let j = 0; j < 4; j++) U[(c + j) * 2] = j }
  const mesh = `jimao/fx-${name}`
  // 初始一个不可见的非退化四边形（隐藏状态下不会绘制）
  scene.mesh(mesh, { positions: new Float32Array([0, 0, 0, 1, 0, 0, 1, 0, 1]), indices: new Uint32Array([0, 1, 2]) })
  const ent: Entity = scene.spawn({ shape: `mesh:${mesh}`, name: `fx_${name}`, position: [0, 0, 0], collider: false }).shader(shader as any, bind as any)
  ent.active(false)
  let n = 0, shown = false
  return {
    ent,
    begin() { n = 0 },
    push(x, y, z, size, ax, ay, az, roll, r, g, b, a, frame, mode, age, shade) {
      if (n >= cap) return false
      const zU = -z
      const nx = mode === 1 ? ax : roll, ny = mode === 1 ? ay : 0, nz = mode === 1 ? -az : 0
      for (let k = 0; k < 4; k++) {
        const v = n * 4 + k
        P[v * 3] = x; P[v * 3 + 1] = y; P[v * 3 + 2] = zU
        A[v * 4] = nx; A[v * 4 + 1] = ny; A[v * 4 + 2] = nz; A[v * 4 + 3] = size
        C[v * 4] = r; C[v * 4 + 1] = g; C[v * 4 + 2] = b; C[v * 4 + 3] = a
        M[v * 4] = frame; M[v * 4 + 1] = mode; M[v * 4 + 2] = age; M[v * 4 + 3] = shade
      }
      n++
      return true
    },
    end() {
      if (n === 0) { if (shown) { shown = false; ent.active(false) } return }
      const v4 = n * 16
      scene.mesh(mesh, {
        positions: P.slice(0, n * 12), uvs: U.slice(0, n * 8), indices: I.slice(0, n * 6),
        attributes: { aAxis: { size: 4, data: A.slice(0, v4) }, aCol: { size: 4, data: C.slice(0, v4) }, aMisc: { size: 4, data: M.slice(0, v4) } },
      })
      if (!shown) { shown = true; ent.active(true) }
    },
  }
}

// ---------------- 对外：原版 fx 的子集 ----------------

/** 原版 Mn / en（three 坐标、线性） */
const SUN_DIR: V3 = (() => { const l = Math.hypot(0.916, 0.225, 0.331); return { x: 0.916 / l, y: 0.225 / l, z: 0.331 / l } })()
const SUN = [1, 0.72, 0.42].map((v) => v * 9 / Math.PI * 0.9)
const ZENITH = [0.055, 0.085, 0.13], AWAY = [0.16, 0.22, 0.3], FOG = [0.42, 0.47, 0.52]
const AMB_HI = [0, 1, 2].map((k) => ZENITH[k] * 0.6 + AWAY[k] * 0.5 + FOG[k] * 0.25)
const AMB_LO = [0, 1, 2].map((k) => AWAY[k] * 0.3 + FOG[k] * 0.14)
const WIND: V3 = { x: -0.8, y: 0, z: 0.3 }
const UP: V3 = { x: 0, y: 1, z: 0 }

const ht = Math.random, Ze = (i: number, e: number) => i + (e - i) * Math.random()
/** 原版 ro：方向 i 周围半径 e 的球内随机扰动后归一化 */
function ro(i: V3, e: number, t: V3) {
  const n = ht() * 2 - 1, s = ht() * 2 - 1, o = ht() * 2 - 1, r = Math.hypot(n, s, o) || 1, a = e * Math.cbrt(ht()) / r
  t.x = i.x + n * a; t.y = i.y + s * a; t.z = i.z + o * a
  const l = Math.hypot(t.x, t.y, t.z)
  if (l < 1e-4) { t.x = i.x; t.y = i.y; t.z = i.z } else { t.x /= l; t.y /= l; t.z /= l }
  return t
}

export interface Fx {
  /** 原版 fx.splash(T)：p 为 Unity 坐标，B 为强度（子弹 1，脚步 .4/.55，落地 .9） */
  splash(p: Vec3, B?: number): void
  /** 原版 fx.impact（非敌人）：p、n、dir 为 Unity 坐标；按表面出烟尘团 / 火花 / 闪光 */
  impact(p: Vec3, n: Vec3, surface: string, dir?: Vec3): void
  clear(): void
  stats(): { lit: number; add: number }
  readonly atlasMs: number
}

export function createFx(ctx: Context, opts: { mask?: number } = {}): Fx | undefined {
  const { scene, gfx } = ctx
  if (!gfx.supported) return undefined
  const t0 = Date.now()
  const at = (atlases ??= (() => { const lit = Bb(128), add = Ob(128); return { lit, add, ms: Date.now() - t0 } })())
  const tex = (a: { data: Uint8Array; width: number; height: number }) => scene.texture({ data: a.data, width: a.width, height: a.height, linear: true, mipmaps: true, wrap: 'clamp', filter: 'trilinear' })
  const litTex = tex(at.lit), addTex = tex(at.add)

  const LIT_CAP = 1400, ADD_CAP = 3200 - 160
  const attributes = { aAxis: 'vec4', aCol: 'vec4', aMisc: 'vec4' } as const
  const litShader = gfx.shader({ vertex: 'shaders/fx.vert', fragment: 'shaders/fx_lit.frag', name: 'jimao/fx-lit', attributes })
  const addShader = gfx.shader({ vertex: 'shaders/fx.vert', fragment: 'shaders/fx_add.frag', name: 'jimao/fx-add', attributes })
  const common = { queue: 'transparent', cull: 'none', depthWrite: false, shadows: false, frustumCull: false }
  const r = createBatch(ctx, 'lit', LIT_CAP, litShader, {
    ...common, blend: 'premultiplied',
    uniforms: { uTex: litTex, uAtlas: [Wc, H1], uSun: SUN, uSunDir: [SUN_DIR.x, SUN_DIR.y, -SUN_DIR.z], uAmbLo: AMB_LO, uAmbHi: AMB_HI },
  })
  const a = createBatch(ctx, 'add', ADD_CAP, addShader, { ...common, blend: 'add', uniforms: { uTex: addTex, uAtlas: [Af, bv] } })
  const l = new Pool(LIT_CAP, true), c = new Pool(ADD_CAP, false)
  const mask = opts.mask ?? 1
  const qe: V3 = { x: 0, y: 0, z: 0 }
  let v = 0

  /** 原版 m：沿太阳方向是否被遮挡（.2 / 1） */
  function m(ee: V3, B: V3 | null) {
    const o: Vec3 = [ee.x + (B ? B.x * 0.08 : 0), ee.y + (B ? B.y * 0.08 : 0) + 0.03, -(ee.z + (B ? B.z * 0.08 : 0))]
    const hit = scene.raycast(o, [SUN_DIR.x, SUN_DIR.y, -SUN_DIR.z], { maxDistance: 90, mask })
    return hit ? 0.2 : 1
  }
  /** 原版 _：lit 粒子 */
  function _(ee: number, B: number, P: number, V: number, Y: number, L: number, Z: number, J: number, oe: number, fe: number, le: number, R: number, I: number, se: number, ae: number, k: number, ce: number, ve: number) {
    const e = l.emit(ee, B, P, V, Y, L, Z, J, oe)
    if (e < 0) return -1
    l.r[e] = fe; l.g[e] = le; l.b[e] = R; l.a[e] = I; l.shade[e] = se; l.drag[e] = ae; l.grav[e] = -k; l.wind[e] = ce; l.turb[e] = 0.5
    l.rot[e] = ht() * 6.283; l.rotv[e] = (ht() - 0.5) * 1.2; l.frame[e] = ve < 0 ? ht() * 6 | 0 : ve; l.fin[e] = 0.06; l.fout[e] = 0.3; l.sk[e] = 2.5
    return e
  }
  /** 原版 S：水平涟漪环 */
  function S(ee: number, B: number, P: number, V: number, Y: number, L: number, Z: number, J: number, oe: number) {
    const e = c.emit(ee, B, P, 0, 0, 0, V, Y, L)
    if (e < 0) return -1
    c.mode[e] = 2; c.frame[e] = FRAME.ring; c.r[e] = Z; c.g[e] = J; c.b[e] = oe; c.fout[e] = 0.15; c.fin[e] = 0.08; c.sk[e] = 2.2; c.rot[e] = ht() * 6.283
    return e
  }
  /** 原版 T：水花（水柱 ×5、水雾 ×2、水珠 ×14·B、涟漪环 ×2） */
  function T(ee: V3, B = 1) {
    const P = m(ee, UP), V = ee.y
    for (let i = 0; i < 5; i++) {
      const le = Ze(0.35, 0.6) * B
      const R = _(ee.x + (ht() - 0.5) * 0.08 * B, V + 0.1 * B, ee.z + (ht() - 0.5) * 0.08 * B, (ht() - 0.5) * 0.5, Ze(1.6, 2.8) * Math.sqrt(B), (ht() - 0.5) * 0.5, Ze(0.4, 0.65), le * 0.3, le, 0.72, 0.78, 0.84, 0.95, P, 0.5, -7, 0, 6)
      if (R >= 0) { l.rot[R] = (ht() - 0.5) * 0.3; l.rotv[R] = 0; l.turb[R] = 0; l.sk[R] = 3; l.fout[R] = 0.4 }
    }
    for (let i = 0; i < 2; i++) _(ee.x, V + 0.15 * B, ee.z, (ht() - 0.5) * 0.6, 0.5, (ht() - 0.5) * 0.6, Ze(0.7, 1.1), 0.2 * B, 0.7 * B, 0.7, 0.75, 0.8, 0.14, P, 2, 0, 0.8, -1)
    const Y = 1.9 * P + 0.35, L = 1.5 * P + 0.45, Z = 1.05 * P + 0.55, J = Math.round(14 * Math.min(B, 1.6))
    for (let i = 0; i < J; i++) {
      ro(UP, 0.75, qe)
      const le = Ze(1.5, 4.8) * Math.sqrt(B)
      const R = c.emit(ee.x, V + 0.03, ee.z, qe.x * le, Math.abs(qe.y) * le, qe.z * le, Ze(0.5, 1), Ze(0.012, 0.024), 0.01)
      if (R >= 0) { c.mode[R] = 1; c.frame[R] = FRAME.dot; c.stretch[R] = 0.012; c.grav[R] = 9.81; c.drag[R] = 0.4; c.r[R] = Y; c.g[R] = L; c.b[R] = Z; c.fout[R] = 0.7; c.flags[R] = KILL; c.sk[R] = 1; c.gy[R] = V }
    }
    S(ee.x, V + 0.012, ee.z, 0.9, 0.12 * B, 1.5 * B, 0.3 * P + 0.08, 0.27 * P + 0.09, 0.22 * P + 0.1)
    const oe = S(ee.x, V + 0.012, ee.z, 1.3, 0.05 * B, 1 * B, 0.2 * P + 0.05, 0.18 * P + 0.06, 0.15 * P + 0.07)
    if (oe >= 0) c.fin[oe] = 0.35
  }

  /** 原版 M：add 池拉伸火花（随寿命由白热变红） */
  function M(ee: number, B: number, P: number, V: number, Y: number, L: number, Z: number, J: number, oe: number, fe: number, le: number, R: number) {
    const I = c.emit(ee, B, P, V, Y, L, Z, J, J * 0.5)
    if (I < 0) return -1
    c.mode[I] = 1; c.frame[I] = FRAME.streak; c.stretch[I] = 0.03; c.grav[I] = 9.81; c.drag[I] = 0.9; c.ramp[I] = 1
    c.r[I] = oe * 0.6; c.g[I] = fe * 0.6; c.b[I] = le * 0.6; c.fout[I] = 0.55; c.flags[I] = R; c.sk[I] = 1
    return I
  }
  /** 原版 E：沿方向 B 锥内发射 P 个火花 */
  function E(ee: V3, B: V3, P: number, V: number, Y: number, L: number, Z: number, J: number, oe: number, fe: number, le: number, R: number) {
    for (let I = 0; I < P; I++) {
      ro(B, L, qe)
      const se = Ze(V, Y) * (0.35 + 0.65 * ht())
      M(ee.x, ee.y, ee.z, qe.x * se, qe.y * se, qe.z * se, Ze(Z, J), Ze(0.01, 0.02), oe * Ze(0.6, 1.2), fe * Ze(0.6, 1.2), le, R)
    }
  }
  /** 原版 w：add 池静止闪光精灵 */
  function w(ee: number, B: number, P: number, V: number, Y: number, L: number, Z: number, J: number, oe: number, fe: number) {
    const le = c.emit(ee, B, P, 0, 0, 0, V, Y, L)
    if (le < 0) return -1
    c.frame[le] = fe; c.r[le] = Z; c.g[le] = J; c.b[le] = oe; c.fout[le] = 0.2; c.rot[le] = ht() * 6.283; c.sk[le] = 1.5
    return le
  }
  /** 原版 q（fx.dust）：命中点冒出的烟尘团（8 个快速喷出 + 2 个缓慢飘散），返回太阳遮挡系数 */
  function q(ee: V3, Et: V3, P = 1, V = 0.5, Y = 0.48, L = 0.45) {
    const Z = m(ee, Et)
    for (let J = 0; J < 8; J++) {
      ro(Et, 0.5, qe)
      const oe = Ze(1, 4.5) * P, fe = Ze(0.85, 1.1)
      _(ee.x + Et.x * 0.03, ee.y + Et.y * 0.03, ee.z + Et.z * 0.03, qe.x * oe, qe.y * oe, qe.z * oe, Ze(0.5, 1.1), 0.08 * P, Ze(0.35, 0.7) * P, V * fe, Y * fe, L * fe, 0.9, Z, 3.5, 0.15, 0.6, J < 3 ? 7 : -1)
    }
    for (let J = 0; J < 2; J++)
      _(ee.x + Et.x * 0.15, ee.y + Et.y * 0.15, ee.z + Et.z * 0.15, Et.x * 0.5 + (ht() - 0.5) * 0.3, Et.y * 0.5 + 0.1, Et.z * 0.5 + (ht() - 0.5) * 0.3, Ze(2.2, 3.6), 0.25 * P, Ze(0.9, 1.5) * P, V, Y, L, 0.28, Z, 1.5, 0.1, 1, -1)
    return Z
  }
  /** 原版 C（fx.impact）的非敌人分支；碎屑（原版 $1 实体碎块）与命中点光源闪光未移植，弹孔由调用方负责 */
  function C(L: V3, nrm: V3, P: string, dir: V3 | null) {
    const Et: V3 = { x: nrm.x, y: nrm.y, z: nrm.z }
    { const k = Math.hypot(Et.x, Et.y, Et.z); if (k < 1e-3) { Et.x = 0; Et.y = 1; Et.z = 0 } else { Et.x /= k; Et.y /= k; Et.z /= k } }
    const zt: V3 = { x: -Et.x, y: -Et.y, z: -Et.z }
    if (dir) { const k = Math.hypot(dir.x, dir.y, dir.z); if (k > 1e-3) { zt.x = dir.x / k; zt.y = dir.y / k; zt.z = dir.z / k } }
    const d2 = 2 * (zt.x * Et.x + zt.y * Et.y + zt.z * Et.z)
    const J1: V3 = { x: zt.x - Et.x * d2, y: zt.y - Et.y * d2, z: zt.z - Et.z * d2 }
    { const k = Math.hypot(J1.x, J1.y, J1.z) || 1; J1.x /= k; J1.y /= k; J1.z /= k }
    const cp = scene.camera.position
    const far = (cp[0] - L.x) ** 2 + (cp[1] - L.y) ** 2 + (-cp[2] - L.z) ** 2 > 3025, oe = far ? 0.5 : 1
    const fe = Et.x, le = Et.y, R = Et.z
    const mix = (a: V3, b: V3, s: number, o: V3) => { o.x = a.x + b.x * s; o.y = a.y + b.y * s; o.z = a.z + b.z * s; const k = Math.hypot(o.x, o.y, o.z) || 1; o.x /= k; o.y /= k; o.z /= k; return o }
    switch (P) {
      case 'metal': {
        mix(J1, Et, 0.6, zt)
        E(L, zt, Math.round(18 * oe), 6, 24, 0.55, 0.1, 0.38, 40, 25, 10.5, 0)
        E(L, zt, 2 + (ht() * 2 | 0), 9, 18, 0.9, 0.7, 1.3, 32, 18, 7, BOUNCE)
        w(L.x + fe * 0.03, L.y + le * 0.03, L.z + R * 0.03, 0.05, 0.25, 0.45, 16, 11, 5.5, FRAME.glow)
        w(L.x + fe * 0.04, L.y + le * 0.04, L.z + R * 0.04, 0.04, 0.35, 0.5, 9, 6, 2.6, FRAME.star0 + (ht() * 2 | 0))
        const I = m(L, Et)
        for (let se = 0; se < 2; se++) _(L.x + fe * 0.04, L.y + le * 0.04, L.z + R * 0.04, fe * 0.8 + (ht() - 0.5) * 0.5, le * 0.8 + 0.2, R * 0.8 + (ht() - 0.5) * 0.5, Ze(0.5, 0.9), 0.06, Ze(0.3, 0.5), 0.4, 0.4, 0.41, 0.4, I, 2.5, 0.3, 0.8, -1)
        break
      }
      case 'wood': {
        const I = q(L, Et, 0.75, 0.5, 0.42, 0.32)
        if (I > 0.5 && ht() < 0.3) w(L.x, L.y, L.z, 0.04, 0.1, 0.2, 3, 2, 1, FRAME.glow)
        break
      }
      case 'water': T(L, 1); break
      case 'rubber': case 'dirt': {
        const I = m(L, Et), dirt = P === 'dirt', ae = dirt ? 0.3 : 0.14, k = dirt ? 0.25 : 0.14, ce = dirt ? 0.19 : 0.14
        for (let ve = 0; ve < 5; ve++) {
          ro(Et, 0.6, qe)
          const s = Ze(0.6, 2.6)
          _(L.x + fe * 0.03, L.y + le * 0.03, L.z + R * 0.03, qe.x * s, qe.y * s, qe.z * s, Ze(0.5, 1), 0.07, Ze(0.3, 0.55), ae, k, ce, 0.85, I, 3.5, 0.1, 0.6, ve < 2 ? 7 : -1)
        }
        break
      }
      case 'glass': {
        for (let I = 0; I < 12; I++) {
          ro(Et, 0.9, qe)
          const se = Ze(1.5, 6), ae = c.emit(L.x, L.y, L.z, qe.x * se, qe.y * se, qe.z * se, Ze(0.4, 0.9), Ze(0.012, 0.02), 0.008)
          if (ae >= 0) { c.mode[ae] = 1; c.frame[ae] = FRAME.dot; c.stretch[ae] = 0.01; c.grav[ae] = 9.81; c.r[ae] = 2.6; c.g[ae] = 2.7; c.b[ae] = 2.8; c.flags[ae] = KILL; c.ramp[ae] = 3 }
        }
        _(L.x, L.y, L.z, fe * 0.6, le * 0.6 + 0.2, R * 0.6, 0.6, 0.08, 0.4, 0.75, 0.8, 0.82, 0.2, m(L, Et), 2.5, 0.2, 0.8, -1)
        break
      }
      default: {
        q(L, Et, 1, 0.52, 0.5, 0.47)
        mix(J1, Et, 0.7, zt)
        for (let I = 0; I < 4; I++) {
          ro(zt, 0.5, qe)
          const se = Ze(3, 9), ae = _(L.x, L.y, L.z, qe.x * se, qe.y * se, qe.z * se, Ze(0.25, 0.45), 0.03, 0.09, 0.6, 0.58, 0.54, 0.7, 1, 2, -6, 0.2, 7)
          if (ae >= 0) l.turb[ae] = 0
        }
        if (ht() < 0.3) E(L, zt, 3, 4, 10, 0.6, 0.08, 0.2, 26, 15, 6, 0)
      }
    }
  }

  const cam = scene.camera
  ctx.on('update', (dt) => {
    if (!(dt > 0)) dt = 0
    if (l.n === 0 && c.n === 0) { r.begin(); r.end(); a.begin(); a.end(); return }
    v += dt
    const cp = cam.position
    const B: V3 = { x: cp[0], y: cp[1], z: -cp[2] }
    r.begin(); l.update(dt, r, B, WIND, v); r.end()
    a.begin(); c.update(dt, a, B, WIND, v); a.end()
  })

  return {
    atlasMs: at.ms,
    splash(p, B = 1) { T({ x: p[0], y: p[1], z: -p[2] }, B) },
    impact(p, n, surface, dir) { C({ x: p[0], y: p[1], z: -p[2] }, { x: n[0], y: n[1], z: -n[2] }, surface, dir ? { x: dir[0], y: dir[1], z: -dir[2] } : null) },
    clear() { l.clear(); c.clear(); r.begin(); r.end(); a.begin(); a.end() },
    stats() { return { lit: l.n, add: c.n } },
  }
}
