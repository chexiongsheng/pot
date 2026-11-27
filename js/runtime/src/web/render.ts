/**
 * 渲染配置（004 第 20.3 节 web-3，照 PotRender.Configure）：post / sky / fog / weather / reflection / quality / refresh。
 * JSON 按 JsonUtility.FromJsonOverwrite 语义局部覆盖：缺省字段（数值为 NaN、开关为 -1、数组为 null）保持原值。
 * 本文件只保存状态并给出与着色器一致的 CPU 版天空辐射（环境光球谐用），不碰 WebGL；绘制在 gl.ts。
 * 颜色约定：材质颜色属性（天空各色、云色、雨色、雾色）按 sRGB 存，上传时转线性；sky.sun 照 Lin(Col(...)) 存线性 HDR。
 */
import { hdrColorToLinear, hdrToLinear, srgbToLinear, V3 } from './math'

export type C4 = [number, number, number, number]

export interface SkyConfig {
  zenith: C4
  horizon: C4
  horizonAway: C4
  ground: C4
  cloudColor: C4
  /** 线性 HDR（已转换） */
  sun: V3
  sunSize: number
  sunGlow: number
  clouds: number
  cloudSpeed: number
  horizonFog: number
  exposure: number
}

/** PotSky.shader 的属性缺省值 */
export function defaultSky(): SkyConfig {
  return {
    zenith: [0.26, 0.32, 0.4, 1],
    horizon: [0.98, 0.76, 0.56, 1],
    horizonAway: [0.44, 0.51, 0.58, 1],
    ground: [0.2, 0.2, 0.2, 1],
    cloudColor: [0.6, 0.6, 0.65, 1],
    sun: [hdrToLinear(4), hdrToLinear(3), hdrToLinear(2)],
    sunSize: 0.02,
    sunGlow: 1,
    clouds: 0.5,
    cloudSpeed: 0.01,
    horizonFog: 0.6,
    exposure: 1,
  }
}

export interface RainConfig {
  /** sRGB + alpha */
  color: C4
  box: V3
  speed: number
  /** xz */
  wind: [number, number]
  length: number
  width: number
  intensity: number
  drops: number
}

/** PotRain.shader 的属性缺省值 */
export function defaultRain(): RainConfig {
  return { color: [0.7, 0.75, 0.8, 0.35], box: [28, 18, 28], speed: 11, wind: [1.2, 0.4], length: 0.9, width: 0.012, intensity: 1, drops: 8000 }
}

export interface PostConfig {
  /** 相机 renderPostProcessing */
  enabled: boolean
  /** 0 无、1 Neutral、2 ACES */
  tonemap: number
  /** 0 无、1 FXAA、2 SMAA */
  antialias: number
  exposure: number
  contrast: number
  saturation: number
  filter: C4
  temperature: number
  tint: number
  shadows: C4
  highlights: C4
  bloom: number
  bloomThreshold: number
  bloomScatter: number
  bloomTint: C4
  vignette: number
  vignetteSmooth: number
  vignetteColor: C4
  grain: number
  chromatic: number
  ao: number
  aoRadius: number
  aoDirect: number
}

/** URP Volume 组件的缺省值（未 Override 时的取值） */
export function defaultPost(): PostConfig {
  return {
    enabled: false, tonemap: 0, antialias: 0,
    exposure: 0, contrast: 0, saturation: 0, filter: [1, 1, 1, 1],
    temperature: 0, tint: 0, shadows: [1, 1, 1, 0], highlights: [1, 1, 1, 0],
    bloom: 0, bloomThreshold: 0.9, bloomScatter: 0.7, bloomTint: [1, 1, 1, 1],
    vignette: 0, vignetteSmooth: 0.2, vignetteColor: [0, 0, 0, 1],
    grain: 0, chromatic: 0,
    // URP SSAO 特性缺省：强度 1.6（Clear 时设回）、半径 0.035、直接光 0.25
    ao: 1.6, aoRadius: 0.035, aoDirect: 0.25,
  }
}

export interface QualityConfig {
  renderScale: number
  shadowDistance: number
  msaa: number
  hdr: boolean
  cascades: number
  shadowResolution: number
}

export function defaultQuality(): QualityConfig {
  return { renderScale: 1, shadowDistance: 50, msaa: 1, hdr: true, cascades: 1, shadowResolution: 2048 }
}

export interface PlanarConfig {
  /** 镜像相机存在（PotRender.planarCam != null） */
  enabled: boolean
  height: number
  scale: number
  /** 不进反射的层掩码 */
  exclude: number
  shadows: boolean
}

type Json = Record<string, unknown>

function num(o: Json, k: string): number {
  const v = o[k]
  return typeof v === 'number' && isFinite(v) ? v : NaN
}

/** int 字段：缺省 -1；布尔按 0/1 */
function int(o: Json, k: string): number {
  const v = o[k]
  if (typeof v === 'boolean') return v ? 1 : 0
  return typeof v === 'number' && isFinite(v) ? Math.trunc(v) : -1
}

function arr(o: Json, k: string): number[] | null {
  const v = o[k]
  if (!Array.isArray(v)) return null
  return v.map((x) => (typeof x === 'number' && isFinite(x) ? x : 0))
}

const has = (v: number) => !Number.isNaN(v)
const clamp01 = (v: number) => Math.max(0, Math.min(1, v))

/** PotRender.Col：少于 3 个分量时用 fallback */
function col(a: number[] | null, fallback: C4): C4 {
  if (!a || a.length < 3) return fallback
  return [a[0], a[1], a[2], a.length > 3 ? a[3] : 1]
}

/** Unity ClosestPowerOfTwo */
export function closestPowerOfTwo(v: number): number {
  if (v <= 1) return 1
  const lo = Math.pow(2, Math.floor(Math.log2(v)))
  const hi = lo * 2
  return v - lo < hi - v ? lo : hi
}

export class WebRenderConfig {
  /** 已设置的程序化天空（null 表示没设置，清屏用背景色） */
  sky: SkyConfig | null = null
  /** sky.ambient：环境光取自天空（球谐） */
  skyAmbient = false
  /** sky.reflection：实时反射探针（只拍天空）作为环境反射；null 表示探针不存在 */
  probe: { size: number } | null = null
  /** 高度雾与太阳散射（颜色与密度在 scene.env.fog） */
  fog = { height: 0, base: 0, sun: 0 }
  wetness = 0
  puddles = 0
  /** 全局 _PotRain（波纹） */
  rain = 0
  /** 雨丝对象存在且启用 */
  rainActive = false
  rainCreated = false
  rainCfg: RainConfig = defaultRain()
  planar: PlanarConfig = { enabled: false, height: 0, scale: 0.5, exclude: 0, shadows: false }
  quality: QualityConfig = defaultQuality()
  post: PostConfig = defaultPost()
  postCreated = false
  /** sky 或 refresh 后加一：渲染器据此重新捕捉环境反射与环境光 */
  envVersion = 0
  /** 天空配置版本（天空材质参数变化） */
  skyVersion = 0
  /** 设置环境光模式（sky.ambient 时改为天空；由 host 接到 scene.env.ambient） */
  onSkyAmbient: () => void = () => {}
  /** fog 配置里的颜色、密度写进 scene.env.fog（与 scene.fog 共用 _PotFogColor、_PotFogDensity） */
  onFog: (color: C4 | null, density: number) => void = () => {}
  /** sky.reflectionIntensity → RenderSettings.reflectionIntensity */
  onReflectionIntensity: (v: number) => void = () => {}

  configure(kind: string, json: string): string {
    let o: Json
    try {
      const v = JSON.parse(json || '{}')
      o = v && typeof v === 'object' && !Array.isArray(v) ? v : {}
    } catch (e: any) {
      return `JSON 解析失败：${e?.message ?? e}`
    }
    switch (kind) {
      case 'post': this.setPost(o); break
      case 'sky': this.setSky(o); break
      case 'fog': this.setFog(o); break
      case 'weather': this.setWeather(o); break
      case 'reflection': this.setReflection(o); break
      case 'quality': this.setQuality(o); break
      case 'refresh': this.envVersion++; break
      default: return '未知的渲染配置：' + kind
    }
    return ''
  }

  private setPost(o: Json): void {
    const p = this.post
    if (!this.postCreated) {
      this.postCreated = true
      p.tonemap = 2
    }
    const enabled = int(o, 'enabled')
    p.enabled = enabled >= 0 ? enabled > 0 : true
    const aa = int(o, 'antialias')
    if (aa >= 0) p.antialias = aa === 0 ? 0 : aa === 1 ? 1 : 2
    const tm = int(o, 'tonemap')
    if (tm >= 0) p.tonemap = tm === 0 ? 0 : tm === 1 ? 1 : 2
    const set = (k: keyof PostConfig) => {
      const v = num(o, k)
      if (has(v)) (p as any)[k] = v
    }
    for (const k of ['exposure', 'contrast', 'saturation', 'temperature', 'tint', 'bloom', 'bloomThreshold', 'bloomScatter', 'vignette', 'vignetteSmooth', 'grain', 'chromatic'] as const) set(k)
    const filter = arr(o, 'filter')
    if (filter) p.filter = col(filter, [1, 1, 1, 1])
    const bloomTint = arr(o, 'bloomTint')
    if (bloomTint) p.bloomTint = col(bloomTint, [1, 1, 1, 1])
    const vc = arr(o, 'vignetteColor')
    if (vc) p.vignetteColor = col(vc, [0, 0, 0, 1])
    const v4 = (a: number[]): C4 => [a[0] ?? 0, a[1] ?? 0, a[2] ?? 0, a.length > 3 ? a[3] : 0]
    const sh = arr(o, 'shadows')
    if (sh) p.shadows = v4(sh)
    const hl = arr(o, 'highlights')
    if (hl) p.highlights = v4(hl)
    // SSAO：intensity 0 关闭
    const ao = num(o, 'ao')
    if (has(ao)) p.ao = ao > 0 ? ao : 0
    const r = num(o, 'aoRadius')
    if (has(r)) p.aoRadius = r
    const d = num(o, 'aoDirect')
    if (has(d)) p.aoDirect = d
  }

  private setSky(o: Json): void {
    const s = (this.sky ??= defaultSky())
    const c = (k: string, fallback: C4) => {
      const a = arr(o, k)
      return a ? col(a, fallback) : null
    }
    const zenith = c('zenith', [0, 0, 1, 1])
    if (zenith) s.zenith = zenith
    const horizon = c('horizon', [1, 1, 1, 1])
    if (horizon) s.horizon = horizon
    const away = c('horizonAway', [1, 1, 1, 1])
    if (away) s.horizonAway = away
    const ground = c('ground', [0.5, 0.5, 0.5, 1])
    if (ground) s.ground = ground
    const cloud = c('cloudColor', [0.5, 0.5, 0.5, 1])
    if (cloud) s.cloudColor = cloud
    const sun = c('sun', [1, 1, 1, 1])
    if (sun) s.sun = hdrColorToLinear(sun[0], sun[1], sun[2])
    for (const k of ['sunSize', 'sunGlow', 'clouds', 'cloudSpeed', 'horizonFog', 'exposure'] as const) {
      const v = num(o, k)
      if (has(v)) s[k] = v
    }
    const ambient = int(o, 'ambient')
    if (ambient >= 0) this.skyAmbient = ambient > 0
    if (this.skyAmbient) this.onSkyAmbient()
    const ri = num(o, 'reflectionIntensity')
    if (has(ri)) this.onReflectionIntensity(clamp01(ri))
    const reflection = int(o, 'reflection')
    if (reflection !== 0) {
      this.probe ??= { size: 128 }
      const size = int(o, 'reflectionSize')
      if (size > 0) this.probe.size = closestPowerOfTwo(Math.max(16, Math.min(1024, size)))
    } else this.probe = null
    this.skyVersion++
    this.envVersion++
  }

  private setFog(o: Json): void {
    const color = arr(o, 'color')
    const density = num(o, 'density')
    if (color || has(density)) this.onFog(color ? col(color, [0.5, 0.5, 0.5, 1]) : null, has(density) ? Math.max(0, density) : NaN)
    const height = num(o, 'height')
    if (has(height)) this.fog.height = Math.max(0, height)
    const base = num(o, 'base')
    if (has(base)) this.fog.base = base
    const sun = num(o, 'sun')
    if (has(sun)) this.fog.sun = Math.max(0, sun)
  }

  private setWeather(o: Json): void {
    const wetness = num(o, 'wetness')
    if (has(wetness)) this.wetness = clamp01(wetness)
    const puddles = num(o, 'puddles')
    if (has(puddles)) this.puddles = clamp01(puddles)
    const rain = num(o, 'rain')
    if (has(rain)) this.rain = clamp01(rain)
    const need = has(rain) ? rain > 0 : this.rainCreated
    if (!need) {
      this.rainActive = false
      return
    }
    const r = this.rainCfg
    const drops = int(o, 'drops')
    if (!this.rainCreated || (drops > 0 && Math.max(100, Math.min(60000, drops)) !== r.drops)) {
      r.drops = drops > 0 ? Math.max(100, Math.min(60000, drops)) : 8000
      this.rainCreated = true
    }
    this.rainActive = true
    if (has(rain)) r.intensity = clamp01(rain)
    const color = arr(o, 'rainColor')
    if (color) r.color = col(color, [1, 1, 1, 1])
    const wind = arr(o, 'wind')
    if (wind && wind.length >= 2) r.wind = [wind[0], wind[1]]
    const box = arr(o, 'box')
    if (box && box.length >= 3) r.box = [box[0], box[1], box[2]]
    const speed = num(o, 'speed')
    if (has(speed)) r.speed = speed
    const length = num(o, 'length')
    if (has(length)) r.length = length
    const width = num(o, 'width')
    if (has(width)) r.width = width
  }

  private setReflection(o: Json): void {
    const p = this.planar
    const height = num(o, 'height')
    if (has(height)) p.height = height
    const scale = num(o, 'scale')
    if (has(scale)) p.scale = Math.max(0.1, Math.min(1, scale))
    const exclude = int(o, 'exclude')
    if (exclude >= 0) p.exclude = exclude
    if (int(o, 'enabled') === 0 || (has(scale) && scale <= 0)) {
      p.enabled = false
      p.shadows = false
      return
    }
    if (!p.enabled) {
      p.enabled = true
      p.shadows = false
    }
    const shadows = int(o, 'shadows')
    if (shadows >= 0) p.shadows = shadows > 0
  }

  private setQuality(o: Json): void {
    const q = this.quality
    const rs = num(o, 'renderScale')
    if (has(rs)) q.renderScale = Math.max(0.25, Math.min(2, rs))
    const sd = num(o, 'shadowDistance')
    if (has(sd)) q.shadowDistance = Math.max(0, sd)
    const msaa = int(o, 'msaa')
    if (msaa >= 0) q.msaa = msaa >= 8 ? 8 : msaa >= 4 ? 4 : msaa >= 2 ? 2 : 1
    const hdr = int(o, 'hdr')
    if (hdr >= 0) q.hdr = hdr > 0
    const cascades = int(o, 'cascades')
    if (cascades > 0) q.cascades = Math.max(1, Math.min(4, cascades))
    const res = int(o, 'shadowResolution')
    if (res > 0) q.shadowResolution = closestPowerOfTwo(res)
  }

  /** 冷重启（PotRender.Clear + ResetGlobals）；画质是渲染管线资产的设置，不随冷重启复位 */
  reset(): void {
    this.sky = null
    this.skyAmbient = false
    this.probe = null
    this.fog = { height: 0, base: 0, sun: 0 }
    this.wetness = 0
    this.puddles = 0
    this.rain = 0
    this.rainActive = false
    this.rainCreated = false
    this.rainCfg = defaultRain()
    this.planar = { enabled: false, height: 0, scale: 0.5, exclude: 0, shadows: false }
    this.post = defaultPost()
    this.postCreated = false
    this.skyVersion++
    this.envVersion++
  }
}

// ---------------- 天空辐射（与 PotSky.shader 同式，CPU 版） ----------------

const fract = (x: number) => x - Math.floor(x)
const sat = (x: number) => Math.max(0, Math.min(1, x))
const smoothstep = (a: number, b: number, x: number) => {
  const t = sat((x - a) / (b - a))
  return t * t * (3 - 2 * t)
}
const mix = (a: number, b: number, t: number) => a + (b - a) * t

/** PotCommon.hlsl 的 PotHash */
export function potHash(x: number, y: number): number {
  let px = fract(x * 123.34)
  let py = fract(y * 456.21)
  const d = px * (px + 45.32) + py * (py + 45.32)
  px += d
  py += d
  return fract(px * py)
}

export function potNoise(x: number, y: number): number {
  const ix = Math.floor(x), iy = Math.floor(y)
  let fx = x - ix, fy = y - iy
  fx = fx * fx * (3 - 2 * fx)
  fy = fy * fy * (3 - 2 * fy)
  const a = potHash(ix, iy)
  const b = potHash(ix + 1, iy)
  const c = potHash(ix, iy + 1)
  const d = potHash(ix + 1, iy + 1)
  return mix(mix(a, b, fx), mix(c, d, fx), fy)
}

function cloudFbm(x: number, y: number): number {
  let v = 0
  let a = 0.5
  for (let i = 0; i < 5; i++) {
    v += a * potNoise(x, y)
    x = x * 2.07 + 13.7
    y = y * 2.07 + 7.3
    a *= 0.5
  }
  return v
}

export interface SkyInputs {
  sky: SkyConfig
  /** 指向太阳（_PotSunDir） */
  sunDir: V3
  /** _PotFogColor（线性）、_PotFogDensity、_PotFogSun、_PotSunColor（线性 × 强度） */
  fogColor: V3
  fogDensity: number
  fogSun: number
  sunColor: V3
  time: number
}

const lin = (c: C4): V3 => [srgbToLinear(c[0]), srgbToLinear(c[1]), srgbToLinear(c[2])]

/** PotSky.shader 的 frag：方向 d（不必归一化）的线性辐射 */
export function skyRadiance(inp: SkyInputs, dx: number, dy: number, dz: number, out: number[] = [0, 0, 0]): number[] {
  const s = inp.sky
  const dl = Math.hypot(dx, dy, dz) || 1
  dx /= dl; dy /= dl; dz /= dl
  let sx = inp.sunDir[0], sy = inp.sunDir[1] + 1e-4, sz = inp.sunDir[2]
  const sl = Math.hypot(sx, sy, sz) || 1
  sx /= sl; sy /= sl; sz /= sl
  const h = dy
  let dhx = dx + 1e-5, dhz = dz + 1e-5
  const dhl = Math.hypot(dhx, dhz) || 1
  dhx /= dhl; dhz /= dhl
  let shx = sx + 1e-5, shz = sz + 1e-5
  const shl = Math.hypot(shx, shz) || 1
  shx /= shl; shz /= shl
  const towards = (dhx * shx + dhz * shz) * 0.5 + 0.5
  const zen = lin(s.zenith), hor = lin(s.horizon), away = lin(s.horizonAway), gnd = lin(s.ground), cloud = lin(s.cloudColor)
  const sun = s.sun
  const kt = smoothstep(0.2, 1, towards)
  const up = sat(h)
  const ku = Math.pow(up, 0.45)
  const kg = sat(-h * 5)
  const mu = dx * sx + dy * sy + dz * sz
  const smu = sat(mu)
  const glow = (0.18 * Math.pow(smu, 4) + 0.45 * Math.pow(smu, 32) + 1.2 * Math.pow(smu, 400)) * s.sunGlow * (0.4 + 0.6 * sat(1 - h * 2))
  let disc = smoothstep(Math.cos(s.sunSize * 1.25), Math.cos(s.sunSize), mu)
  const col = [0, 0, 0]
  for (let i = 0; i < 3; i++) {
    const horizon = mix(away[i], hor[i], kt)
    col[i] = mix(mix(horizon, zen[i], ku), gnd[i], kg) + sun[i] * glow
  }
  if (s.clouds > 0.001 && h > -0.02) {
    const k = (1 / (Math.max(h, 0) + 0.12)) * 0.9
    const t = inp.time * s.cloudSpeed
    const c = cloudFbm(dx * k + t, dz * k + t * 0.35)
    const cov = smoothstep(1 - s.clouds, 1 - s.clouds + 0.3, c) * smoothstep(-0.02, 0.15, h)
    const thick = smoothstep(1 - s.clouds, 1.1, c)
    const m3 = Math.pow(smu, 3), m12 = Math.pow(smu, 12)
    for (let i = 0; i < 3; i++) {
      const lit = cloud[i] * (0.7 + 0.3 * up) + sun[i] * 0.12 * m3
      const dark = cloud[i] * 0.55
      const cc = mix(lit, dark, thick * 0.7) + sun[i] * 0.35 * m12 * (1 - thick)
      col[i] = mix(col[i], cc, cov * 0.92)
    }
    disc *= 1 - sat(cov * 1.5)
  }
  const fogAmt = inp.fogDensity > 0.0001 ? sat(Math.exp(-Math.max(h, 0) * 9) * s.horizonFog) : 0
  const fs = Math.pow(sat(dx * inp.sunDir[0] + dy * inp.sunDir[1] + dz * inp.sunDir[2]), 8) * inp.fogSun
  for (let i = 0; i < 3; i++) {
    const c = col[i] + sun[i] * disc * 25
    out[i] = mix(c, inp.fogColor[i] + inp.sunColor[i] * fs, fogAmt) * s.exposure
  }
  return out
}

/**
 * 天空的二阶球谐环境光（DynamicGI.UpdateEnvironment 后的 SampleSH）：返回 9 个 RGB 系数（27 个数），
 * 已乘余弦卷积与基函数常数，着色器按 [1, y, z, x, xy, yz, 3z²−1, xz, x²−y²] 点乘即得 E/π（常量天空 c 得 c）。
 */
export function skySH(inp: SkyInputs, rows = 32, cols = 64): Float32Array {
  const acc = new Float64Array(27)
  const c = [0, 0, 0]
  let wsum = 0
  for (let r = 0; r < rows; r++) {
    const theta = ((r + 0.5) / rows) * Math.PI
    const st = Math.sin(theta), ct = Math.cos(theta)
    for (let k = 0; k < cols; k++) {
      const phi = ((k + 0.5) / cols) * Math.PI * 2
      const x = st * Math.cos(phi), z = st * Math.sin(phi), y = ct
      skyRadiance(inp, x, y, z, c)
      const w = st
      wsum += w
      const ys = [
        0.282095, 0.488603 * y, 0.488603 * z, 0.488603 * x,
        1.092548 * x * y, 1.092548 * y * z, 0.315392 * (3 * z * z - 1), 1.092548 * x * z, 0.546274 * (x * x - y * y),
      ]
      for (let i = 0; i < 9; i++) for (let j = 0; j < 3; j++) acc[i * 3 + j] += c[j] * ys[i] * w
    }
  }
  // ∫ ≈ 4π · Σ(L·Y·w) / Σw；再乘 A_l/π（1、2/3、1/4）与基函数常数
  const norm = (4 * Math.PI) / wsum
  const band = [1, 2 / 3, 2 / 3, 2 / 3, 0.25, 0.25, 0.25, 0.25, 0.25]
  const basis = [0.282095, 0.488603, 0.488603, 0.488603, 1.092548, 1.092548, 0.315392, 1.092548, 0.546274]
  const out = new Float32Array(27)
  for (let i = 0; i < 9; i++) for (let j = 0; j < 3; j++) out[i * 3 + j] = acc[i * 3 + j] * norm * band[i] * basis[i]
  return out
}

/** 按 skySH 系数求方向 n 的环境光（测试与 CPU 侧用） */
export function evalSH(sh: ArrayLike<number>, x: number, y: number, z: number): V3 {
  const b = [1, y, z, x, x * y, y * z, 3 * z * z - 1, x * z, x * x - y * y]
  const out: V3 = [0, 0, 0]
  for (let i = 0; i < 9; i++) for (let j = 0; j < 3; j++) out[j] += sh[i * 3 + j] * b[i]
  return out
}
