/**
 * 程序化 PBR 贴图（对应原版 GLSL 烘焙的 Tn.* 材质表，改为 JS 逐像素生成）。
 * 每种材质输出三张贴图：基础色（sRGB）、法线（由高度求导，OpenGL +Y）、遮罩（R 金属 G AO B 高度 A 光滑）。
 * 所有噪声都按整数周期取模，贴图四方连续可平铺。行顺序从下到上（v 向上）。
 */
import type { Context, Texture } from '@pot/core'

export interface TexSet {
  map: Texture
  normalMap: Texture
  maskMap: Texture
}

const sat = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)
const mix = (a: number, b: number, t: number) => a + (b - a) * t
function smooth(e0: number, e1: number, x: number) {
  const t = sat((x - e0) / (e1 - e0))
  return t * t * (3 - 2 * t)
}

function hash(x: number, y: number, s: number) {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 1442695041)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}

/** 可平铺分形值噪声：基础周期 px×py 个格子，逐层倍频；结果归一到 0..1 */
export function fbm(size: number, px: number, py: number, octaves: number, seed: number): Float32Array {
  const out = new Float32Array(size * size)
  let amp = 0.5, total = 0
  for (let o = 0; o < octaves; o++) {
    const cx = px << o, cy = py << o
    const lat = new Float32Array(cx * cy)
    for (let j = 0; j < cy; j++) for (let i = 0; i < cx; i++) lat[j * cx + i] = hash(i, j, seed * 131 + o * 17)
    const xi0 = new Int32Array(size), xi1 = new Int32Array(size), xt = new Float32Array(size)
    for (let x = 0; x < size; x++) {
      const f = (x / size) * cx, i = Math.floor(f), t = f - i
      xi0[x] = i % cx; xi1[x] = (i + 1) % cx; xt[x] = t * t * (3 - 2 * t)
    }
    for (let y = 0; y < size; y++) {
      const f = (y / size) * cy, j = Math.floor(f), t0 = f - j, ty = t0 * t0 * (3 - 2 * t0)
      const r0 = (j % cy) * cx, r1 = ((j + 1) % cy) * cx
      const row = y * size
      for (let x = 0; x < size; x++) {
        const a = lat[r0 + xi0[x]], b = lat[r0 + xi1[x]], c = lat[r1 + xi0[x]], d = lat[r1 + xi1[x]]
        const tx = xt[x]
        const top = a + (b - a) * tx, bot = c + (d - c) * tx
        out[row + x] += (top + (bot - top) * ty) * amp
      }
    }
    total += amp
    amp *= 0.5
  }
  for (let i = 0; i < out.length; i++) out[i] /= total
  // 拉伸对比度：值噪声叠加后集中在 0.5 附近
  for (let i = 0; i < out.length; i++) out[i] = sat((out[i] - 0.5) * 1.8 + 0.5)
  return out
}

/** 可平铺 Worley：每个像素到最近特征点的距离（以格子为单位）与该格子的随机 id */
export function cells(size: number, n: number, seed: number) {
  const f1 = new Float32Array(size * size), id = new Float32Array(size * size)
  const fx = new Float32Array(n * n), fy = new Float32Array(n * n), fid = new Float32Array(n * n)
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const k = j * n + i
    fx[k] = hash(i, j, seed * 7 + 1); fy[k] = hash(i, j, seed * 7 + 2); fid[k] = hash(i, j, seed * 7 + 3)
  }
  for (let y = 0; y < size; y++) {
    const gy = (y / size) * n, cy = Math.floor(gy)
    for (let x = 0; x < size; x++) {
      const gx = (x / size) * n, cx = Math.floor(gx)
      let best = 9, bid = 0
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        const i = cx + di, j = cy + dj
        const k = (((j % n) + n) % n) * n + (((i % n) + n) % n)
        const dx = i + fx[k] - gx, dy = j + fy[k] - gy
        const d = dx * dx + dy * dy
        if (d < best) { best = d; bid = fid[k] }
      }
      f1[y * size + x] = Math.sqrt(best); id[y * size + x] = bid
    }
  }
  return { f1, id }
}

export interface Px {
  r: number; g: number; b: number; a: number
  /** 高度 0..1 */
  h: number
  ao: number
  rough: number
  metal: number
}

export interface Baked {
  size: number
  albedo: Uint8Array
  height: Float32Array
  mask: Uint8Array
  normal: Uint8Array
}

/** 逐像素调用 fn 生成表面属性，再由高度求法线。strength 为高度 1 对应的像素起伏 */
export function bake(size: number, strength: number, fn: (i: number, x: number, y: number, o: Px) => void): Baked {
  const n = size * size
  const albedo = new Uint8Array(n * 4), mask = new Uint8Array(n * 4), height = new Float32Array(n)
  const o: Px = { r: 1, g: 1, b: 1, a: 1, h: 0.5, ao: 1, rough: 0.5, metal: 0 }
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = y * size + x
    o.r = o.g = o.b = o.a = 1; o.h = 0.5; o.ao = 1; o.rough = 0.5; o.metal = 0
    fn(i, x, y, o)
    const p = i * 4
    albedo[p] = sat(o.r) * 255; albedo[p + 1] = sat(o.g) * 255; albedo[p + 2] = sat(o.b) * 255; albedo[p + 3] = sat(o.a) * 255
    mask[p] = sat(o.metal) * 255; mask[p + 1] = sat(o.ao) * 255; mask[p + 2] = sat(o.h) * 255; mask[p + 3] = sat(1 - o.rough) * 255
    height[i] = o.h
  }
  return { size, albedo, height, mask, normal: normalsOf(height, size, strength) }
}

export function normalsOf(h: Float32Array, size: number, strength: number) {
  const out = new Uint8Array(size * size * 4)
  const m = size - 1
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const l = h[y * size + ((x + m) & m)], r = h[y * size + ((x + 1) & m)]
    const d = h[((y + m) & m) * size + x], u = h[((y + 1) & m) * size + x]
    let nx = -(r - l) * 0.5 * strength, ny = -(u - d) * 0.5 * strength, nz = 1
    const k = 1 / Math.hypot(nx, ny, nz)
    nx *= k; ny *= k; nz *= k
    const p = (y * size + x) * 4
    out[p] = (nx * 0.5 + 0.5) * 255; out[p + 1] = (ny * 0.5 + 0.5) * 255; out[p + 2] = (nz * 0.5 + 0.5) * 255; out[p + 3] = 255
  }
  return out
}

/** 上传为贴图集 */
export function upload(ctx: Context, b: Baked, albedo = b.albedo): TexSet {
  const { size } = b
  return {
    map: ctx.scene.texture({ data: albedo, width: size, height: size }),
    normalMap: ctx.scene.texture({ data: b.normal, width: size, height: size, linear: true }),
    maskMap: ctx.scene.texture({ data: b.mask, width: size, height: size, linear: true }),
  }
}

// ---------------------------------------------------------------- 材质

/** 沥青堆场：骨料、焦油封缝、油渍。贴图覆盖 6 米 */
export function asphalt(size = 512): Baked {
  const big = fbm(size, 2, 2, 4, 5), mid = fbm(size, 16, 16, 4, 6), fine = fbm(size, 128, 128, 2, 7)
  const wear = fbm(size, 3, 3, 3, 8), crackN = fbm(size, 2, 2, 4, 9), crackGate = fbm(size, 2, 2, 2, 12), oilN = fbm(size, 4, 4, 4, 14)
  const a = cells(size, 96, 1), b = cells(size, 190, 2)
  return bake(size, 2.2, (i, _x, _y, o) => {
    const sa = smooth(0.48, 0.28, a.f1[i] + (fine[i] - 0.5) * 0.2) * (a.id[i] < 0.62 ? 1 : 0)
    const sb = smooth(0.48, 0.3, b.f1[i]) * (b.id[i] < 0.8 ? 1 : 0)
    const wk = smooth(0.3, 0.7, wear[i])
    let c = 0.16 * (0.85 + 0.3 * mid[i])
    const stA = mix(0.2, 0.3, a.id[i]), stB = mix(0.19, 0.26, b.id[i])
    c = mix(c, stB, sb * 0.45 * (0.45 + 0.55 * wk))
    c = mix(c, stA, sa * (0.35 + 0.35 * wk))
    c *= 0.84 + 0.32 * big[i]
    let r = c, g = c, bl = c * 1.02
    if (a.id[i] > 0.9 && sa > 0) { r *= 1.08; bl *= 0.9 }
    let h = Math.max(sa * (0.45 + 0.55 * a.id[i]), sb * 0.5) * 0.6 + fine[i] * 0.3 + mid[i] * 0.1
    let rough = mix(0.93, 0.74, Math.max(sa, sb * 0.8) * (0.4 + 0.6 * wk))
    const band = smooth(0.03, 0.012, Math.abs(crackN[i] - 0.5) + (fine[i] - 0.5) * 0.01) * smooth(0.45, 0.6, crackGate[i])
    r = mix(r, 0.075, band * 0.93); g = mix(g, 0.075, band * 0.93); bl = mix(bl, 0.08, band * 0.93)
    h = mix(h, 0.72, band * 0.88)
    rough = mix(rough, 0.38, band)
    const oil = smooth(0.7, 0.88, oilN[i])
    r *= 1 - oil * 0.45; g *= 1 - oil * 0.45; bl *= 1 - oil * 0.42
    rough = mix(rough, 0.5, oil * 0.6)
    o.r = r; o.g = g; o.b = bl; o.h = h; o.ao = mix(0.55, 1, smooth(0, 0.6, h)); o.rough = rough
  })
}

/** 混凝土（码头面板、隔离墩、墙裙）：气孔、水渍、白华；joints 为四边伸缩缝。贴图覆盖 3 米 */
export function concrete(size = 256, joints = false): Baked {
  const big = fbm(size, 2, 2, 5, 1), mid = fbm(size, 12, 12, 5, 2), fine = fbm(size, 96, 96, 3, 3), form = fbm(size, 2, 7, 4, 4)
  const st = fbm(size, 4, 4, 5, 14), ef = fbm(size, 5, 5, 4, 15), tint = fbm(size, 3, 3, 3, 13), chipN = fbm(size, 7, 7, 4, 11)
  const po = cells(size, 64, 5)
  return bake(size, 1.6, (i, x, y, o) => {
    const pore = (po.id[i] < 0.35 ? 1 : 0) * smooth(0.14 * po.id[i] + 0.06, 0.02, po.f1[i])
    const chip = smooth(0.8, 0.86, chipN[i] + (fine[i] - 0.5) * 0.08)
    let h = 0.6 + (mid[i] - 0.5) * 0.25 + (fine[i] - 0.5) * 0.14 + (form[i] - 0.5) * 0.06 - pore * 0.35
    h = mix(h, 0.42 + fine[i] * 0.1, chip)
    let c = 0.56 * (0.74 + 0.38 * big[i] + 0.22 * (mid[i] - 0.5) + 0.08 * (form[i] - 0.5))
    const stain = smooth(0.55, 0.82, st[i]); c *= 1 - stain * 0.3
    const flor = smooth(0.66, 0.86, ef[i]) * sat(fine[i] * 1.6 - 0.2); c = mix(c, 0.7, flor * 0.22)
    c *= 1 - pore * 0.5
    c = mix(c, 0.42 * (0.8 + 0.4 * fine[i]), chip * 0.8)
    const t = tint[i]
    let r = c * mix(1.04, 0.95, t), g = c, b = c * mix(0.94, 1.05, t)
    let ao = 1 - pore * 0.5 - chip * 0.15
    if (joints) {
      const d = Math.min(x, size - 1 - x, y, size - 1 - y)
      const j = smooth(2.2, 1.0, d), js = smooth(18, 0, d + (mid[i] - 0.5) * 10)
      r *= 1 - js * 0.25; g *= 1 - js * 0.25; b *= 1 - js * 0.25
      r = mix(r, 0.1, j); g = mix(g, 0.1, j); b = mix(b, 0.1, j)
      h = mix(h, 0.05, j); ao -= j * 0.6
    }
    o.r = r; o.g = g; o.b = b; o.h = h; o.ao = ao
    o.rough = mix(mix(0.84 + (mid[i] - 0.5) * 0.2 - (form[i] - 0.5) * 0.15, 0.95, chip), 0.62, stain * 0.3)
  })
}

/** 集装箱漆面损伤场（共享），按颜色生成多张基础色。贴图覆盖 3 米 */
export function paintFields(size = 512) {
  const big = fbm(size, 2, 2, 4, 1), streak = fbm(size, 40, 1, 3, 6), streak2 = fbm(size, 10, 1, 3, 16)
  const zoneN = fbm(size, 2, 2, 3, 22), chipN = fbm(size, 20, 11, 4, 23), chipF = fbm(size, 64, 40, 3, 24)
  const wearN = fbm(size, 3, 3, 6, 21), rg = fbm(size, 90, 90, 3, 15), fade = fbm(size, 3, 2, 4, 31), fine = fbm(size, 160, 160, 2, 3)
  const n = size * size
  const chip = new Float32Array(n), stain = new Float32Array(n), run = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const zone = smooth(0.55, 0.85, zoneN[i])
    const th = 0.86 - zone * 0.16
    const c1 = smooth(th, th + 0.03, chipN[i] * 0.85 + chipF[i] * 0.15)
    const c3 = smooth(0.93, 0.96, wearN[i] + (chipF[i] - 0.5) * 0.12)
    chip[i] = Math.max(c1, c3)
    stain[i] = sat(smooth(th - 0.07, th, chipN[i] * 0.85 + chipF[i] * 0.15) - c1) * smooth(0.35, 0.7, rg[i]) * 0.9
  }
  // 锈流：损伤处向下（v 减小方向）拖出锈迹
  const step = Math.max(1, Math.round(size / 96))
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let rr = 0
    for (let k = 1; k <= 8; k++) {
      const yy = (y + k * step) % size
      rr = Math.max(rr, chip[yy * size + x] * (1 - k / 9))
    }
    const i = y * size + x
    run[i] = rr * smooth(0.45, 0.75, streak[i])
  }
  const baked = bake(size, 1.2, (i, _x, _y, o) => {
    o.h = 0.62 + (fine[i] - 0.5) * 0.02 - chip[i] * 0.16 + stain[i] * 0.03
    o.ao = 1 - chip[i] * 0.2
    let r = 0.48 + (streak2[i] - 0.5) * 0.14 + (big[i] - 0.5) * 0.12
    r = mix(r, 0.9, Math.max(chip[i], run[i] * 0.6))
    o.rough = r
    o.metal = 0
  })
  return { size, baked, big, streak, streak2, rg, fade, chip, stain, run }
}

/** 给定漆色（sRGB 0..1）生成集装箱基础色 */
export function paintAlbedo(f: ReturnType<typeof paintFields>, color: [number, number, number]) {
  const n = f.size * f.size
  const out = new Uint8Array(n * 4)
  for (let i = 0; i < n; i++) {
    let k = (0.9 + 0.22 * (f.big[i] - 0.5)) * (0.95 + 0.1 * (f.streak2[i] - 0.5))
    const fd = smooth(0.5, 0.85, f.fade[i]) * 0.18
    let r = mix(color[0] * k, 0.7, fd), g = mix(color[1] * k, 0.7, fd), b = mix(color[2] * k, 0.68, fd)
    const ru = mix(0.26, 0.48, f.rg[i]), gu = mix(0.17, 0.3, f.rg[i]), bu = mix(0.12, 0.18, f.rg[i])
    const s = f.stain[i] * 0.6 + f.run[i] * 0.55
    r = mix(r, ru, s); g = mix(g, gu, s); b = mix(b, bu, s)
    k = f.chip[i]
    r = mix(r, ru * 0.85, k); g = mix(g, gu * 0.85, k); b = mix(b, bu * 0.85, k)
    const p = i * 4
    out[p] = sat(r) * 255; out[p + 1] = sat(g) * 255; out[p + 2] = sat(b) * 255; out[p + 3] = 255
  }
  return out
}

/** 通用钢构旧漆（白色可着色）：起重机、灯杆、栏杆、杂物。贴图覆盖 2 米 */
export function steel(size = 256): Baked {
  const big = fbm(size, 2, 2, 4, 41), mid = fbm(size, 10, 10, 4, 42), chipN = fbm(size, 36, 36, 3, 43), fine = fbm(size, 96, 96, 2, 44), streak = fbm(size, 24, 1, 3, 45), gate = fbm(size, 4, 4, 3, 46)
  return bake(size, 1.4, (i, _x, _y, o) => {
    const chip = smooth(0.86, 0.9, chipN[i] + (fine[i] - 0.5) * 0.08) * smooth(0.45, 0.7, gate[i])
    const dirt = smooth(0.45, 0.9, mid[i]) * 0.16 + smooth(0.6, 0.85, streak[i]) * 0.1
    const c = (0.86 + 0.12 * (big[i] - 0.5)) * (1 - dirt)
    o.r = mix(c, 0.5, chip); o.g = mix(c, 0.38, chip); o.b = mix(c, 0.3, chip)
    o.h = 0.6 - chip * 0.15 + (fine[i] - 0.5) * 0.04
    o.ao = 1 - chip * 0.2
    o.rough = mix(0.5 + (mid[i] - 0.5) * 0.2 + dirt * 0.4, 0.88, chip)
    o.metal = chip * 0.4
  })
}

/** 枪械：阳极氧化铝（细划痕）。贴图覆盖 0.5 米 */
export function gunmetal(size = 256): Baked {
  const fine = fbm(size, 128, 128, 2, 51), mid = fbm(size, 8, 8, 4, 52), scr = fbm(size, 2, 160, 3, 53), scr2 = fbm(size, 160, 3, 3, 54), gate = fbm(size, 6, 6, 3, 55)
  return bake(size, 0.8, (i, _x, _y, o) => {
    const s = Math.max(smooth(0.86, 0.93, scr[i]), smooth(0.88, 0.94, scr2[i])) * smooth(0.5, 0.7, gate[i])
    const c = 0.16 + (mid[i] - 0.5) * 0.04 + (fine[i] - 0.5) * 0.02
    o.r = mix(c, 0.32, s); o.g = mix(c, 0.32, s); o.b = mix(c * 1.05, 0.33, s)
    o.h = 0.5 + (fine[i] - 0.5) * 0.05 - s * 0.05
    o.rough = mix(0.62 + (mid[i] - 0.5) * 0.1, 0.4, s)
    o.metal = mix(0.35, 0.9, s)
  })
}

/** 枪械：聚合物（护木、握把、枪托）细颗粒 */
export function polymer(size = 256): Baked {
  const fine = fbm(size, 160, 160, 2, 61), mid = fbm(size, 6, 6, 4, 62)
  return bake(size, 1.4, (i, _x, _y, o) => {
    const c = 0.1 + (mid[i] - 0.5) * 0.03
    o.r = c; o.g = c * 1.02; o.b = c * 0.98
    o.h = 0.5 + (fine[i] - 0.5) * 0.4
    o.rough = 0.68 + (mid[i] - 0.5) * 0.1
  })
}

/** 木材（托盘、木箱）：顺纹 */
export function wood(size = 256): Baked {
  const grain = fbm(size, 2, 28, 4, 71), fine = fbm(size, 8, 96, 2, 72), big = fbm(size, 2, 2, 3, 73), knotN = cells(size, 5, 74)
  return bake(size, 1.8, (i, _x, _y, o) => {
    const ring = 0.5 + 0.5 * Math.sin((grain[i] * 18 + fine[i] * 2) * Math.PI)
    const knot = smooth(0.18, 0.05, knotN.f1[i]) * (knotN.id[i] < 0.4 ? 1 : 0)
    const k = (0.72 + 0.28 * ring) * (0.85 + 0.3 * big[i]) * (1 - knot * 0.5)
    o.r = 0.58 * k; o.g = 0.43 * k; o.b = 0.28 * k
    o.h = 0.5 + ring * 0.12 + (fine[i] - 0.5) * 0.2 - knot * 0.2
    o.rough = 0.86
  })
}

/** 路面标线：磨损斑驳，alpha 镂空。贴图覆盖 2 米 */
export function marking(size = 256): Baked {
  const wear = fbm(size, 6, 6, 5, 81), fine = fbm(size, 64, 64, 2, 82)
  return bake(size, 1, (i, _x, _y, o) => {
    const keep = smooth(0.3, 0.42, wear[i] * 0.85 + fine[i] * 0.15)
    o.r = o.g = o.b = 0.85 + (fine[i] - 0.5) * 0.1
    o.a = keep
    o.h = 0.55
    o.rough = 0.55
  })
}

/** 镀锌菱形铁丝网，alpha 镂空。贴图覆盖 0.5 米，8 个网眼 */
export function chainlink(size = 256): Baked {
  const n = 8, w = 0.06
  return bake(size, 2, (_i, x, y, o) => {
    const u = x / size, v = y / size
    const d1 = (u + v) * n, d2 = (u - v + 1) * n
    const e1 = Math.abs(d1 - Math.round(d1)), e2 = Math.abs(d2 - Math.round(d2))
    const wire = Math.max(smooth(w, w * 0.4, e1), smooth(w, w * 0.4, e2))
    o.r = 0.7; o.g = 0.72; o.b = 0.73
    o.a = wire
    o.h = 0.5 + wire * 0.3
    o.rough = 0.45
    o.metal = 0.85
  })
}
