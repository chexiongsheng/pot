/**
 * 后处理与画质（004 第 20.3 节 web-3，照 URP 14 的 PostProcessPass、UberPost、LutBuilderHdr、Bloom、FinalPost）。
 *
 * 流程：场景画到离屏目标（quality.hdr 且有 EXT_color_buffer_float 时 RGBA16F，否则 SRGB8_ALPHA8；尺寸 = 画布 × renderScale，
 * msaa > 1 时先画多重采样渲染缓冲再解析）。之后：
 * - post 未启用（相机 renderPostProcessing 为 false）：夹到 [0, 1] 转 sRGB 拷到画布；
 * - post 启用：bloom（半分辨率，13 抽头预滤波 + 阈值软膝，9 抽头横向与 5 抽头纵向高斯下采样，双三次上采样按 scatter 混合）→
 *   Uber（色差 → bloom → 暗角 → 曝光 → 调色 LUT → 胶片颗粒）→ FXAA（antialias 1；SMAA 也按 FXAA 处理）→ 转 sRGB 到画布。
 * 调色照 URP 的 HDR 调色模式（URP 资产 colorGradingMode = HDR）：CPU 按 LutBuilderHdr 烘焙 32³ 的 LUT（输入为 LogC 编码），
 * 白平衡 → 对比度（ACES 时在 ACEScc，否则在 LogC）→ 滤色 → 阴影中间调高光 → 饱和度 → 色调映射（Neutral 或快速 ACES）。
 * 与 URP 的差异：颗粒用哈希噪声代替 Thin1 贴图；quality.hdr 为 0 只改离屏格式，调色仍按 HDR 流程。
 */
import { srgbToLinear } from './math'
import type { PostConfig, QualityConfig } from './render'

type V3 = [number, number, number]

// ---------------- 颜色空间（行主序 3×3） ----------------

const LIN_2_LMS = [0.390405, 0.549941, 0.00892632, 0.0708416, 0.963172, 0.00135775, 0.0231082, 0.128021, 0.936245]
const LMS_2_LIN = [2.85847, -1.62879, -0.024891, -0.210182, 1.1582, 0.000324281, -0.041812, -0.118169, 1.06867]
const SRGB_2_AP0 = [0.439701, 0.382978, 0.177335, 0.0897923, 0.813423, 0.0967616, 0.017544, 0.111544, 0.870704]
const AP0_2_AP1 = [1.4514393161, -0.2365107469, -0.2149285693, -0.0765537734, 1.1762296998, -0.0996759264, 0.0083161484, -0.0060324498, 0.9977163014]
const AP1_2_AP0 = [0.6954522414, 0.1406786965, 0.1638690622, 0.0447945634, 0.8596711185, 0.0955343182, -0.0055258826, 0.0040252103, 1.0015006723]
const AP1_2_XYZ = [0.6624541811, 0.1340042065, 0.156187687, 0.2722287168, 0.6740817658, 0.0536895174, -0.0055746495, 0.0040607335, 1.0103391003]
const XYZ_2_AP1 = [1.6410233797, -0.3248032942, -0.2364246952, -0.6636628587, 1.6153315917, 0.0167563477, 0.0117218943, -0.008284442, 0.9883948585]
const D60_2_D65 = [0.987224, -0.00611327, 0.0159533, -0.00759836, 1.00186, 0.0053302, 0.00307257, -0.00509595, 1.08168]
const XYZ_2_REC709 = [3.2409699419, -1.5373831776, -0.4986107603, -0.9692436363, 1.8759675015, 0.0415550574, 0.0556300797, -0.2039769589, 1.0569715142]
const AP1_RGB2Y: V3 = [0.2722287168, 0.6740817658, 0.0536895174]
const REC709_Y: V3 = [0.2126729, 0.7151522, 0.072175]
const HALF_MAX = 65504
const ACESCC_MIDGRAY = 0.4135884

function mul(m: number[], v: ArrayLike<number>): V3 {
  return [
    m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
    m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
    m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
  ]
}
const dot = (a: ArrayLike<number>, b: ArrayLike<number>) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const lerp3 = (a: number, v: V3, t: number): V3 => [a + (v[0] - a) * t, a + (v[1] - a) * t, a + (v[2] - a) * t]
const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

// LogC（ALEXA LogC EI 1000，URP Color.hlsl 的 LUT 输入编码）
const LOGC = { cut: 0.011361, a: 5.555556, b: 0.047996, c: 0.244161, d: 0.386036, e: 5.301883, f: 0.092819 }

export function linearToLogC(x: number): number {
  const L = LOGC
  return x > L.cut ? L.c * Math.log10(L.a * x + L.b) + L.d : L.e * x + L.f
}

export function logCToLinear(x: number): number {
  const L = LOGC
  return x > L.e * L.cut + L.f ? (Math.pow(10, (x - L.d) / L.c) - L.b) / L.a : (x - L.f) / L.e
}

function acesToAcescc(v: number): number {
  const x = Math.max(0, Math.min(HALF_MAX, v))
  return x < 0.00003051757 ? (Math.log2(0.00001525878 + x * 0.5) + 9.72) / 17.52 : (Math.log2(x) + 9.72) / 17.52
}

function acesccToAces(x: number): number {
  if (x < -0.301369863) return (Math.pow(2, x * 17.52 - 9.72) - 0.00001525878) * 2
  if (x < (Math.log2(HALF_MAX) + 9.72) / 17.52) return Math.pow(2, x * 17.52 - 9.72)
  return HALF_MAX
}

// ---------------- 参数换算（ColorUtils） ----------------

/** ColorUtils.ColorBalanceToLMSCoeffs：色温与色调 → LMS 空间的乘数 */
export function colorBalance(temperature: number, tint: number): V3 {
  const t1 = temperature / 65
  const t2 = tint / 65
  const x = 0.31271 - t1 * (t1 < 0 ? 0.1 : 0.05)
  const y = 2.87 * x - 3 * x * x - 0.27509507 + t2 * 0.05
  const X = x / y
  const Y = 1
  const Z = (1 - x - y) / y
  const L = 0.7328 * X + 0.4296 * Y - 0.1624 * Z
  const M = -0.7036 * X + 1.6975 * Y + 0.0061 * Z
  const S = 0.003 * X + 0.0136 * Y + 0.9834 * Z
  return [0.949237 / L, 1.03542 / M, 1.08728 / S]
}

/** ColorUtils.PrepareShadowsMidtonesHighlights 的单个分量：xyz 转线性，w 为偏移（负值 × 1，正值 × 4） */
export function smhParam(v: ArrayLike<number>): V3 {
  const w = v[3] ?? 0
  const off = w * (w < 0 ? 1 : 4)
  return [Math.max(srgbToLinear(v[0]) + off, 0), Math.max(srgbToLinear(v[1]) + off, 0), Math.max(srgbToLinear(v[2]) + off, 0)]
}

// ---------------- 色调映射 ----------------

function neutralCurve(x: number): number {
  const a = 0.2, b = 0.29, c = 0.24, d = 0.272, e = 0.02, f = 0.3
  return (x * (a * x + c * b) + d * e) / (x * (a * x + b) + d * f) - e / f
}

/** URP NeutralTonemap（whiteLevel 5.3，whiteClip 1） */
export function neutralTonemap(c: ArrayLike<number>): V3 {
  const ws = 1 / neutralCurve(5.3)
  return [neutralCurve(c[0] * ws) * ws, neutralCurve(c[1] * ws) * ws, neutralCurve(c[2] * ws) * ws]
}

function rgbToSaturation(c: V3): number {
  const mi = Math.min(c[0], c[1], c[2])
  const ma = Math.max(c[0], c[1], c[2])
  return (Math.max(ma, 1e-4) - Math.max(mi, 1e-4)) / Math.max(ma, 1e-2)
}

function rgbToYc(c: V3): number {
  const [r, g, b] = c
  const k = Math.max(0, b * (b - g) + g * (g - r) + r * (r - b))
  return (b + g + r + 1.75 * Math.sqrt(k)) / 3
}

function sigmoidShaper(x: number): number {
  const t = Math.max(1 - Math.abs(x / 2), 0)
  const y = 1 + Math.sign(x) * (1 - t * t)
  return y / 2
}

function glowFwd(yc: number, gain: number, mid: number): number {
  if (yc <= (2 / 3) * mid) return gain
  if (yc >= 2 * mid) return 0
  return gain * (mid / yc - 0.5)
}

function rgbToHue(c: V3): number {
  const [r, g, b] = c
  if (r === g && g === b) return 0
  let h = (180 / Math.PI) * Math.atan2(Math.sqrt(3) * (g - b), 2 * r - g - b)
  if (h < 0) h += 360
  return h
}

/** URP AcesTonemap 的快速版本（ACES.hlsl，TONEMAPPING_USE_FULL_ACES 未定义）；输入为 ACES2065-1（AP0），输出为线性 Rec.709 */
export function acesTonemap(input: ArrayLike<number>): V3 {
  let aces: V3 = [input[0], input[1], input[2]]
  // 辉光
  const sat = rgbToSaturation(aces)
  const yc = rgbToYc(aces)
  const s = sigmoidShaper((sat - 0.4) / 0.2)
  const glow = 1 + glowFwd(yc, 0.05 * s, 0.08)
  aces = [aces[0] * glow, aces[1] * glow, aces[2] * glow]
  // 红色修正
  let hue = rgbToHue(aces)
  if (hue < -180) hue += 360
  else if (hue > 180) hue -= 360
  let hw = smoothstep(0, 1, 1 - Math.abs((2 * hue) / 135))
  hw *= hw
  aces[0] += hw * sat * (0.03 - aces[0]) * (1 - 0.82)
  // 到 ACEScg，全局去饱和
  let cg = mul(AP0_2_AP1, aces).map((v) => Math.max(0, v)) as V3
  cg = lerp3(dot(cg, AP1_RGB2Y), cg, 0.96)
  // 亮度拟合（RRT + ODT 100 尼特暗环境）
  const curve = (x: number) => (x * (2.785085 * x + 0.107772)) / (x * (2.936045 * x + 0.887122) + 0.806889)
  let cv: V3 = [curve(cg[0]), curve(cg[1]), curve(cg[2])]
  // darkSurround_to_dimSurround
  const XYZ = mul(AP1_2_XYZ, cv)
  const div = Math.max(XYZ[0] + XYZ[1] + XYZ[2], 1e-4)
  const xx = XYZ[0] / div, yy = XYZ[1] / div
  const Y = Math.pow(Math.max(0, Math.min(HALF_MAX, XYZ[1])), 0.9811)
  const m = Y / Math.max(yy, 1e-4)
  cv = mul(XYZ_2_AP1, [xx * m, Y, (1 - xx - yy) * m])
  cv = lerp3(dot(cv, AP1_RGB2Y), cv, 0.93)
  return mul(XYZ_2_REC709, mul(D60_2_D65, mul(AP1_2_XYZ, cv)))
}

// ---------------- 调色（LutBuilderHdr） ----------------

export interface GradeParams {
  /** 0 无、1 Neutral、2 ACES */
  tonemap: number
  balance: V3
  /** contrast / 100 + 1 */
  contrast: number
  /** saturation / 100 + 1 */
  saturation: number
  /** colorFilter.linear */
  filter: V3
  shadows: V3
  midtones: V3
  highlights: V3
}

export function gradeParams(p: PostConfig): GradeParams {
  return {
    tonemap: p.tonemap,
    balance: colorBalance(p.temperature, p.tint),
    contrast: p.contrast / 100 + 1,
    saturation: p.saturation / 100 + 1,
    filter: [srgbToLinear(p.filter[0]), srgbToLinear(p.filter[1]), srgbToLinear(p.filter[2])],
    shadows: smhParam(p.shadows),
    // 中间调没有接口，取 URP 缺省 (1, 1, 1, 0)
    midtones: [1, 1, 1],
    highlights: smhParam(p.highlights),
  }
}

/** LutBuilderHdr 的单色调色（输入线性 sRGB，输出色调映射后的线性值；Neutral 与无色调映射时仍是线性 sRGB） */
export function gradeColor(c: ArrayLike<number>, g: GradeParams): V3 {
  const aces = g.tonemap === 2
  // 白平衡
  let lms = mul(LIN_2_LMS, c)
  lms = [lms[0] * g.balance[0], lms[1] * g.balance[1], lms[2] * g.balance[2]]
  let lin = mul(LMS_2_LIN, lms)
  // 对比度（对数空间）
  if (aces) {
    const ap0 = mul(SRGB_2_AP0, lin)
    const cc = ap0.map((v) => (acesToAcescc(v) - ACESCC_MIDGRAY) * g.contrast + ACESCC_MIDGRAY)
    lin = mul(AP0_2_AP1, cc.map(acesccToAces))
  } else {
    lin = lin.map((v) => logCToLinear((linearToLogC(v) - ACESCC_MIDGRAY) * g.contrast + ACESCC_MIDGRAY)) as V3
  }
  // 滤色，之后不再有负值
  lin = [Math.max(0, lin[0] * g.filter[0]), Math.max(0, lin[1] * g.filter[1]), Math.max(0, lin[2] * g.filter[2])]
  // 阴影、中间调、高光（界限 0、0.3、0.55、1）
  const Y = aces ? AP1_RGB2Y : REC709_Y
  let luma = dot(lin, Y)
  const sf = 1 - smoothstep(0, 0.3, luma)
  const hf = smoothstep(0.55, 1, luma)
  const mf = 1 - sf - hf
  lin = [0, 1, 2].map((i) => lin[i] * (g.shadows[i] * sf + g.midtones[i] * mf + g.highlights[i] * hf)) as V3
  // 饱和度
  luma = dot(lin, Y)
  lin = lerp3(luma, lin, g.saturation).map((v) => Math.max(0, v)) as V3
  if (aces) return acesTonemap(mul(AP1_2_AP0, lin))
  if (g.tonemap === 1) return neutralTonemap(lin)
  return lin
}

export const LUT_SIZE = 32

/** 烘焙 size³ 的调色 LUT（RGBA，r 沿 x、g 沿 y、b 沿 z；格点 i / (size − 1) 为 LogC 编码） */
export function bakeLut(g: GradeParams, size = LUT_SIZE): Float32Array {
  const out = new Float32Array(size * size * size * 4)
  const dec = new Float32Array(size)
  for (let i = 0; i < size; i++) dec[i] = logCToLinear(i / (size - 1))
  let o = 0
  for (let b = 0; b < size; b++)
    for (let gg = 0; gg < size; gg++)
      for (let r = 0; r < size; r++) {
        const c = gradeColor([dec[r], dec[gg], dec[b]], g)
        out[o++] = c[0]
        out[o++] = c[1]
        out[o++] = c[2]
        out[o++] = 1
      }
  return out
}

// ---------------- bloom ----------------

export interface BloomParams {
  intensity: number
  threshold: number
  knee: number
  scatter: number
  tint: V3
}

/** PostProcessPass.SetupBloom：阈值转线性、软膝 = 阈值 × 0.5、scatter 映射到 [0.05, 0.95]、tint 转线性后除以亮度 */
export function bloomParams(p: PostConfig): BloomParams {
  const threshold = srgbToLinear(p.bloomThreshold)
  const t: V3 = [srgbToLinear(p.bloomTint[0]), srgbToLinear(p.bloomTint[1]), srgbToLinear(p.bloomTint[2])]
  const l = dot(t, REC709_Y)
  return {
    intensity: p.bloom,
    threshold,
    knee: threshold * 0.5,
    scatter: 0.05 + (0.95 - 0.05) * p.bloomScatter,
    tint: l > 0 ? [t[0] / l, t[1] / l, t[2] / l] : [1, 1, 1],
  }
}

/** bloom 金字塔层数：半分辨率起，clamp(floor(log2(max) − 1), 1, maxIterations = 6) */
export function bloomMipCount(width: number, height: number): number {
  const s = Math.max(width >> 1, height >> 1, 1)
  return Math.max(1, Math.min(6, Math.floor(Math.log2(s) - 1)))
}

/** 渲染缩放后的离屏尺寸 */
export function scaledSize(width: number, height: number, q: QualityConfig): [number, number] {
  return [Math.max(1, Math.round(width * q.renderScale)), Math.max(1, Math.round(height * q.renderScale))]
}

// ---------------- 着色器 ----------------

const VS = `#version 300 es
out vec2 vUV;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUV = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`

const HEAD = `#version 300 es
precision highp float;
precision highp sampler3D;
in vec2 vUV;
out vec4 outColor;
vec3 toSRGB(vec3 c) {
  c = clamp(c, 0.0, 1.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c));
}
`

/** post 未启用：夹取后转 sRGB */
const COPY_FS = `${HEAD}
uniform sampler2D uSource;
void main() { outColor = vec4(toSRGB(texture(uSource, vUV).rgb), 1.0); }`

/** Bloom.shader FragPrefilter（_BLOOM_HQ：13 抽头） */
const PREFILTER_FS = `${HEAD}
uniform sampler2D uSource;
uniform vec2 uTexel;
uniform float uThreshold;
uniform float uKnee;
vec3 S(vec2 o) { return texture(uSource, vUV + uTexel * o).rgb; }
void main() {
  vec3 A = S(vec2(-1.0, -1.0)), B = S(vec2(0.0, -1.0)), C = S(vec2(1.0, -1.0));
  vec3 D = S(vec2(-0.5, -0.5)), E = S(vec2(0.5, -0.5));
  vec3 F = S(vec2(-1.0, 0.0)), G = S(vec2(0.0)), H = S(vec2(1.0, 0.0));
  vec3 I = S(vec2(-0.5, 0.5)), J = S(vec2(0.5, 0.5));
  vec3 K = S(vec2(-1.0, 1.0)), L = S(vec2(0.0, 1.0)), M = S(vec2(1.0, 1.0));
  vec2 div = 0.25 * vec2(0.5, 0.125);
  vec3 c = (D + E + I + J) * div.x + (A + B + G + F) * div.y + (B + C + H + G) * div.y + (F + G + L + K) * div.y + (G + H + M + L) * div.y;
  c = min(c, vec3(65472.0));
  float br = max(c.r, max(c.g, c.b));
  float soft = clamp(br - uThreshold + uKnee, 0.0, 2.0 * uKnee);
  soft = soft * soft / (4.0 * uKnee + 1e-4);
  c *= max(br - uThreshold, soft) / max(br, 1e-4);
  outColor = vec4(max(c, vec3(0.0)), 1.0);
}`

/** FragBlurH：在下采样源上 9 抽头高斯（步长为源纹素 × 2） */
const BLUR_H_FS = `${HEAD}
uniform sampler2D uSource;
uniform vec2 uTexel;
void main() {
  float t = uTexel.x * 2.0;
  vec3 c = texture(uSource, vUV - vec2(t * 4.0, 0.0)).rgb * 0.01621622
    + texture(uSource, vUV - vec2(t * 3.0, 0.0)).rgb * 0.05405405
    + texture(uSource, vUV - vec2(t * 2.0, 0.0)).rgb * 0.12162162
    + texture(uSource, vUV - vec2(t, 0.0)).rgb * 0.19459459
    + texture(uSource, vUV).rgb * 0.22702703
    + texture(uSource, vUV + vec2(t, 0.0)).rgb * 0.19459459
    + texture(uSource, vUV + vec2(t * 2.0, 0.0)).rgb * 0.12162162
    + texture(uSource, vUV + vec2(t * 3.0, 0.0)).rgb * 0.05405405
    + texture(uSource, vUV + vec2(t * 4.0, 0.0)).rgb * 0.01621622;
  outColor = vec4(c, 1.0);
}`

/** FragBlurV：同尺寸源上 5 次双线性采样（等效 9 抽头） */
const BLUR_V_FS = `${HEAD}
uniform sampler2D uSource;
uniform vec2 uTexel;
void main() {
  float t = uTexel.y;
  vec3 c = texture(uSource, vUV - vec2(0.0, t * 3.23076923)).rgb * 0.07027027
    + texture(uSource, vUV - vec2(0.0, t * 1.38461538)).rgb * 0.31621622
    + texture(uSource, vUV).rgb * 0.22702703
    + texture(uSource, vUV + vec2(0.0, t * 1.38461538)).rgb * 0.31621622
    + texture(uSource, vUV + vec2(0.0, t * 3.23076923)).rgb * 0.07027027;
  outColor = vec4(c, 1.0);
}`

/** 双三次 B 样条采样（Core RP SampleTexture2DBicubic，4 次双线性） */
const BICUBIC = `
vec3 bicubic(sampler2D t, vec2 uv, vec2 size) {
  vec2 xy = uv * size - 0.5;
  vec2 ic = floor(xy);
  vec2 f = xy - ic;
  vec2 f2 = f * f;
  vec2 f3 = f2 * f;
  vec2 w0 = (1.0 / 6.0) * (-f3 + 3.0 * f2 - 3.0 * f + 1.0);
  vec2 w1 = (1.0 / 6.0) * (3.0 * f3 - 6.0 * f2 + 4.0);
  vec2 w2 = (1.0 / 6.0) * (-3.0 * f3 + 3.0 * f2 + 3.0 * f + 1.0);
  vec2 w3 = (1.0 / 6.0) * f3;
  vec2 g0 = w0 + w1;
  vec2 g1 = w2 + w3;
  vec2 h0 = (ic - 1.0 + w1 / g0 + 0.5) / size;
  vec2 h1 = (ic + 1.0 + w3 / g1 + 0.5) / size;
  return g0.y * (g0.x * texture(t, vec2(h0.x, h0.y)).rgb + g1.x * texture(t, vec2(h1.x, h0.y)).rgb)
    + g1.y * (g0.x * texture(t, vec2(h0.x, h1.y)).rgb + g1.x * texture(t, vec2(h1.x, h1.y)).rgb);
}
`

/** FragUpsample：lerp(高层, 低层双三次, scatter) */
const UPSAMPLE_FS = `${HEAD}
${BICUBIC}
uniform sampler2D uSource;
uniform sampler2D uLow;
uniform vec2 uLowSize;
uniform float uScatter;
void main() {
  vec3 hi = texture(uSource, vUV).rgb;
  vec3 lo = bicubic(uLow, vUV, uLowSize);
  outColor = vec4(mix(hi, lo, uScatter), 1.0);
}`

/** UberPost.shader：色差 → bloom → 暗角 → 曝光 + 调色 LUT → 颗粒；uEncode 为 1 时直接转 sRGB 输出到画布 */
const UBER_FS = `${HEAD}
${BICUBIC}
uniform sampler2D uSource;
uniform sampler2D uBloom;
uniform sampler3D uLut;
uniform float uChroma;
uniform int uBloomOn;
uniform vec2 uBloomSize;
uniform float uBloomIntensity;
uniform vec3 uBloomTint;
uniform float uVignette;
uniform float uVSmooth;
uniform vec3 uVColor;
uniform float uExposure;
uniform float uLutSize;
uniform float uGrain;
uniform vec2 uGrainOffset;
uniform int uEncode;
float logC(float x) {
  return x > 0.011361 ? 0.244161 * log(5.555556 * x + 0.047996) / log(10.0) + 0.386036 : 5.301883 * x + 0.092819;
}
float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
void main() {
  vec2 uv = vUV;
  vec3 color;
  if (uChroma > 0.0) {
    vec2 coords = 2.0 * uv - 1.0;
    vec2 end = uv - coords * dot(coords, coords) * uChroma;
    vec2 delta = (end - uv) / 3.0;
    color = vec3(texture(uSource, uv).r, texture(uSource, uv + delta).g, texture(uSource, uv + delta * 2.0).b);
  } else color = texture(uSource, uv).rgb;
  if (uBloomOn == 1) color += bicubic(uBloom, uv, uBloomSize) * uBloomIntensity * uBloomTint;
  if (uVignette > 0.0) {
    vec2 d = abs(uv - 0.5) * uVignette;
    float vf = pow(clamp(1.0 - dot(d, d), 0.0, 1.0), uVSmooth);
    color *= mix(uVColor, vec3(1.0), vf);
  }
  color *= uExposure;
  vec3 lut = clamp(vec3(logC(color.r), logC(color.g), logC(color.b)), 0.0, 1.0);
  float n = uLutSize;
  color = texture(uLut, lut * ((n - 1.0) / n) + 0.5 / n).rgb;
  if (uGrain > 0.0) {
    float g = (hash(floor(gl_FragCoord.xy) + uGrainOffset) - 0.5) * 2.0;
    float lum = 1.0 - sqrt(max(dot(clamp(color, 0.0, 1.0), vec3(0.2126729, 0.7151522, 0.072175)), 0.0));
    lum = mix(1.0, lum, 0.8);
    color += color * g * uGrain * lum;
  }
  outColor = uEncode == 1 ? vec4(toSRGB(color), 1.0) : vec4(clamp(color, 0.0, 1.0), 1.0);
}`

/** FinalPost 的 FXAA（Common.hlsl ApplyFXAA），输出转 sRGB */
const FXAA_FS = `${HEAD}
uniform sampler2D uSource;
uniform vec4 uSize;
float lumi(vec3 c) { return dot(c, vec3(0.2126729, 0.7151522, 0.072175)); }
vec3 L(ivec2 p, int dx, int dy) {
  ivec2 q = clamp(p + ivec2(dx, dy), ivec2(0), ivec2(uSize.xy) - 1);
  return clamp(texelFetch(uSource, q, 0).rgb, 0.0, 1.0);
}
vec3 F(vec2 o) { return clamp(texture(uSource, vUV + o).rgb, 0.0, 1.0); }
void main() {
  ivec2 p = ivec2(vUV * uSize.xy);
  vec3 color = clamp(texture(uSource, vUV).rgb, 0.0, 1.0);
  vec3 nw = L(p, -1, -1), ne = L(p, 1, -1), sw = L(p, -1, 1), se = L(p, 1, 1);
  float lNW = lumi(nw), lNE = lumi(ne), lSW = lumi(sw), lSE = lumi(se), lM = lumi(color);
  vec2 dir = vec2(-((lNW + lNE) - (lSW + lSE)), (lNW + lSW) - (lNE + lSE));
  float reduce = max((lNW + lNE + lSW + lSE) * (0.25 * (1.0 / 8.0)), 1.0 / 128.0);
  float rcpMin = 1.0 / (min(abs(dir.x), abs(dir.y)) + reduce);
  dir = clamp(dir * rcpMin, vec2(-8.0), vec2(8.0)) * uSize.zw;
  vec3 a = 0.5 * (F(dir * (1.0 / 3.0 - 0.5)) + F(dir * (2.0 / 3.0 - 0.5)));
  vec3 b = a * 0.5 + 0.25 * (F(dir * -0.5) + F(dir * 0.5));
  float lB = lumi(b);
  float lMin = min(lM, min(lNW, min(lNE, min(lSW, lSE))));
  float lMax = max(lM, max(lNW, max(lNE, max(lSW, lSE))));
  outColor = vec4(toSRGB((lB < lMin || lB > lMax) ? a : b), 1.0);
}`

// ---------------- GPU 部分 ----------------

interface Target {
  fbo: WebGLFramebuffer
  tex: WebGLTexture
  w: number
  h: number
}

type Prog = { p: WebGLProgram; u: Record<string, WebGLUniformLocation | null> }

/**
 * 离屏目标与后处理链。begin 绑定场景目标并返回渲染尺寸，end 把结果画到画布（默认帧缓冲）。
 * 占用纹理单元 0、1、2；end 之后这几个单元的绑定已改变。
 */
export class WebPost {
  private gl: WebGL2RenderingContext
  private colorFloat: boolean
  private vao: WebGLVertexArrayObject
  private copy: Prog
  private prefilter: Prog
  private blurH: Prog
  private blurV: Prog
  private upsample: Prog
  private uber: Prog
  private fxaa: Prog
  /** 场景目标：解析后的颜色贴图 + 深度（单采样时）；多重采样时另有 msFbo */
  private scene: (Target & { depth: WebGLRenderbuffer | null; ms: WebGLFramebuffer | null; msColor: WebGLRenderbuffer | null; msDepth: WebGLRenderbuffer | null; samples: number; hdr: boolean }) | null = null
  private ldr: Target | null = null
  private down: Target[] = []
  private up: Target[] = []
  private lut: WebGLTexture | null = null
  private lutKey = ''
  /** 实际使用的采样数（MSAA）与离屏是否为 HDR 格式 */
  samples = 1
  hdr = false

  constructor(gl: WebGL2RenderingContext, colorFloat: boolean) {
    this.gl = gl
    this.colorFloat = colorFloat
    this.vao = gl.createVertexArray()!
    const mk = (fs: string, names: string[], units: Record<string, number> = { uSource: 0 }): Prog => {
      const p = link(gl, VS, fs)
      const u: Record<string, WebGLUniformLocation | null> = {}
      for (const n of [...names, ...Object.keys(units)]) u[n] = gl.getUniformLocation(p, n)
      gl.useProgram(p)
      for (const [n, unit] of Object.entries(units)) gl.uniform1i(u[n], unit)
      return { p, u }
    }
    this.copy = mk(COPY_FS, [])
    this.prefilter = mk(PREFILTER_FS, ['uTexel', 'uThreshold', 'uKnee'])
    this.blurH = mk(BLUR_H_FS, ['uTexel'])
    this.blurV = mk(BLUR_V_FS, ['uTexel'])
    this.upsample = mk(UPSAMPLE_FS, ['uLowSize', 'uScatter'], { uSource: 0, uLow: 1 })
    this.uber = mk(UBER_FS, ['uChroma', 'uBloomOn', 'uBloomSize', 'uBloomIntensity', 'uBloomTint', 'uVignette', 'uVSmooth', 'uVColor',
      'uExposure', 'uLutSize', 'uGrain', 'uGrainOffset', 'uEncode'], { uSource: 0, uBloom: 1, uLut: 2 })
    this.fxaa = mk(FXAA_FS, ['uSize'])
  }

  /** 绑定场景离屏目标（按画布尺寸、renderScale、msaa、hdr 重建），返回渲染尺寸 */
  begin(width: number, height: number, q: QualityConfig): [number, number] {
    const gl = this.gl
    const [w, h] = scaledSize(width, height, q)
    const hdr = q.hdr && this.colorFloat
    const fmt = hdr ? gl.RGBA16F : gl.SRGB8_ALPHA8
    let samples = 1
    if (q.msaa > 1) {
      const avail = gl.getInternalformatParameter(gl.RENDERBUFFER, fmt, gl.SAMPLES) as Int32Array | null
      if (avail) for (const s of avail) if (s <= q.msaa) { samples = s; break }
    }
    const s = this.scene
    if (!s || s.w !== w || s.h !== h || s.samples !== samples || s.hdr !== hdr) {
      this.freeScene()
      const t = this.target(w, h, fmt)
      let depth: WebGLRenderbuffer | null = null
      let ms: WebGLFramebuffer | null = null
      let msColor: WebGLRenderbuffer | null = null
      let msDepth: WebGLRenderbuffer | null = null
      if (samples > 1) {
        ms = gl.createFramebuffer()!
        gl.bindFramebuffer(gl.FRAMEBUFFER, ms)
        msColor = gl.createRenderbuffer()!
        gl.bindRenderbuffer(gl.RENDERBUFFER, msColor)
        gl.renderbufferStorageMultisample(gl.RENDERBUFFER, samples, fmt, w, h)
        gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, msColor)
        msDepth = gl.createRenderbuffer()!
        gl.bindRenderbuffer(gl.RENDERBUFFER, msDepth)
        gl.renderbufferStorageMultisample(gl.RENDERBUFFER, samples, gl.DEPTH_COMPONENT24, w, h)
        gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, msDepth)
      } else {
        gl.bindFramebuffer(gl.FRAMEBUFFER, t.fbo)
        depth = gl.createRenderbuffer()!
        gl.bindRenderbuffer(gl.RENDERBUFFER, depth)
        gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, w, h)
        gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depth)
      }
      gl.bindRenderbuffer(gl.RENDERBUFFER, null)
      this.scene = { ...t, depth, ms, msColor, msDepth, samples, hdr }
    }
    this.samples = samples
    this.hdr = hdr
    const sc = this.scene!
    gl.bindFramebuffer(gl.FRAMEBUFFER, sc.ms ?? sc.fbo)
    gl.viewport(0, 0, w, h)
    return [w, h]
  }

  /** 解析多重采样，按 post 配置画到画布（width、height 为画布像素尺寸） */
  end(p: PostConfig, width: number, height: number, time: number): void {
    const gl = this.gl
    const sc = this.scene
    if (!sc) return
    if (sc.ms) {
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, sc.ms)
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, sc.fbo)
      gl.blitFramebuffer(0, 0, sc.w, sc.h, 0, 0, sc.w, sc.h, gl.COLOR_BUFFER_BIT, gl.NEAREST)
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null)
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null)
    }
    gl.disable(gl.DEPTH_TEST)
    gl.disable(gl.BLEND)
    gl.disable(gl.CULL_FACE)
    gl.depthMask(false)
    gl.bindVertexArray(this.vao)

    if (!p.enabled) {
      this.toCanvas(width, height)
      this.use(this.copy, sc.tex)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    } else {
      const bloom = p.bloom > 0 ? this.bloom(p, sc) : null
      this.ensureLut(p)
      const fxaa = p.antialias > 0
      if (fxaa) {
        if (!this.ldr || this.ldr.w !== sc.w || this.ldr.h !== sc.h) {
          if (this.ldr) this.freeTarget(this.ldr)
          this.ldr = this.target(sc.w, sc.h, gl.SRGB8_ALPHA8)
        }
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.ldr.fbo)
        gl.viewport(0, 0, sc.w, sc.h)
      } else this.toCanvas(width, height)
      const u = this.uber.u
      this.use(this.uber, sc.tex)
      gl.activeTexture(gl.TEXTURE1)
      gl.bindTexture(gl.TEXTURE_2D, bloom ? bloom.tex : null)
      gl.activeTexture(gl.TEXTURE2)
      gl.bindTexture(gl.TEXTURE_3D, this.lut)
      gl.activeTexture(gl.TEXTURE0)
      gl.uniform1f(u.uChroma, p.chromatic > 0 ? p.chromatic * 0.05 : 0)
      gl.uniform1i(u.uBloomOn, bloom ? 1 : 0)
      if (bloom) {
        const bp = bloomParams(p)
        gl.uniform2f(u.uBloomSize, bloom.w, bloom.h)
        gl.uniform1f(u.uBloomIntensity, bp.intensity)
        gl.uniform3fv(u.uBloomTint, bp.tint)
      }
      gl.uniform1f(u.uVignette, p.vignette > 0 ? p.vignette * 3 : 0)
      gl.uniform1f(u.uVSmooth, p.vignetteSmooth * 5)
      gl.uniform3f(u.uVColor, p.vignetteColor[0], p.vignetteColor[1], p.vignetteColor[2])
      gl.uniform1f(u.uExposure, Math.pow(2, p.exposure))
      gl.uniform1f(u.uLutSize, LUT_SIZE)
      gl.uniform1f(u.uGrain, Math.max(0, p.grain))
      const seed = Math.floor(time * 60)
      gl.uniform2f(u.uGrainOffset, (seed * 37) % 251, (seed * 91) % 241)
      gl.uniform1i(u.uEncode, fxaa ? 0 : 1)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
      if (fxaa && this.ldr) {
        this.toCanvas(width, height)
        this.use(this.fxaa, this.ldr.tex)
        gl.uniform4f(this.fxaa.u.uSize, this.ldr.w, this.ldr.h, 1 / this.ldr.w, 1 / this.ldr.h)
        gl.drawArrays(gl.TRIANGLES, 0, 3)
      }
    }
    gl.bindVertexArray(null)
    gl.activeTexture(gl.TEXTURE0)
    gl.depthMask(true)
  }

  private toCanvas(width: number, height: number): void {
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null)
    this.gl.viewport(0, 0, width, height)
  }

  private use(prog: Prog, src: WebGLTexture): void {
    const gl = this.gl
    gl.useProgram(prog.p)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, src)
  }

  /** bloom 金字塔，返回最终的半分辨率 bloom 贴图 */
  private bloom(p: PostConfig, sc: Target): Target {
    const gl = this.gl
    const bp = bloomParams(p)
    const tw = Math.max(1, sc.w >> 1)
    const th = Math.max(1, sc.h >> 1)
    const n = bloomMipCount(sc.w, sc.h)
    const fmt = this.colorFloat ? gl.RGBA16F : gl.RGBA8
    if (this.down.length !== n || this.down[0].w !== tw || this.down[0].h !== th) {
      for (const t of [...this.down, ...this.up]) this.freeTarget(t)
      this.down = []
      this.up = []
      for (let i = 0; i < n; i++) {
        const w = Math.max(1, tw >> i)
        const h = Math.max(1, th >> i)
        this.down.push(this.target(w, h, fmt))
        this.up.push(this.target(w, h, fmt))
      }
    }
    const pass = (prog: Prog, src: Target, dst: Target) => {
      gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fbo)
      gl.viewport(0, 0, dst.w, dst.h)
      this.use(prog, src.tex)
      if (prog.u.uTexel !== undefined) gl.uniform2f(prog.u.uTexel, 1 / src.w, 1 / src.h)
    }
    pass(this.prefilter, sc, this.down[0])
    gl.uniform1f(this.prefilter.u.uThreshold, bp.threshold)
    gl.uniform1f(this.prefilter.u.uKnee, bp.knee)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
    for (let i = 1; i < n; i++) {
      pass(this.blurH, this.down[i - 1], this.up[i])
      gl.drawArrays(gl.TRIANGLES, 0, 3)
      pass(this.blurV, this.up[i], this.down[i])
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    }
    if (n === 1) return this.down[0]
    for (let i = n - 2; i >= 0; i--) {
      const low = i === n - 2 ? this.down[i + 1] : this.up[i + 1]
      pass(this.upsample, this.down[i], this.up[i])
      gl.activeTexture(gl.TEXTURE1)
      gl.bindTexture(gl.TEXTURE_2D, low.tex)
      gl.activeTexture(gl.TEXTURE0)
      gl.uniform2f(this.upsample.u.uLowSize, low.w, low.h)
      gl.uniform1f(this.upsample.u.uScatter, bp.scatter)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    }
    return this.up[0]
  }

  /** 调色参数变化时重新烘焙 LUT（RGBA16F 三维贴图，线性过滤） */
  private ensureLut(p: PostConfig): void {
    const g = gradeParams(p)
    const key = JSON.stringify(g)
    if (this.lut && key === this.lutKey) return
    const gl = this.gl
    this.lutKey = key
    this.lut ??= gl.createTexture()!
    gl.activeTexture(gl.TEXTURE2)
    gl.bindTexture(gl.TEXTURE_3D, this.lut)
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4)
    gl.texImage3D(gl.TEXTURE_3D, 0, gl.RGBA16F, LUT_SIZE, LUT_SIZE, LUT_SIZE, 0, gl.RGBA, gl.FLOAT, bakeLut(g))
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE)
    gl.activeTexture(gl.TEXTURE0)
  }

  private target(w: number, h: number, fmt: number): Target {
    const gl = this.gl
    const tex = gl.createTexture()!
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.texStorage2D(gl.TEXTURE_2D, 1, fmt, w, h)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    const fbo = gl.createFramebuffer()!
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    return { fbo, tex, w, h }
  }

  private freeTarget(t: Target): void {
    this.gl.deleteFramebuffer(t.fbo)
    this.gl.deleteTexture(t.tex)
  }

  private freeScene(): void {
    const s = this.scene
    if (!s) return
    const gl = this.gl
    this.freeTarget(s)
    if (s.depth) gl.deleteRenderbuffer(s.depth)
    if (s.ms) gl.deleteFramebuffer(s.ms)
    if (s.msColor) gl.deleteRenderbuffer(s.msColor)
    if (s.msDepth) gl.deleteRenderbuffer(s.msDepth)
    this.scene = null
  }

  dispose(): void {
    const gl = this.gl
    this.freeScene()
    if (this.ldr) this.freeTarget(this.ldr)
    for (const t of [...this.down, ...this.up]) this.freeTarget(t)
    this.ldr = null
    this.down = []
    this.up = []
    if (this.lut) gl.deleteTexture(this.lut)
    this.lut = null
    for (const p of [this.copy, this.prefilter, this.blurH, this.blurV, this.upsample, this.uber, this.fxaa]) gl.deleteProgram(p.p)
    gl.deleteVertexArray(this.vao)
  }
}

function link(gl: WebGL2RenderingContext, vs: string, fs: string): WebGLProgram {
  const compile = (type: number, src: string) => {
    const s = gl.createShader(type)!
    gl.shaderSource(s, src)
    gl.compileShader(s)
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('pot web: 后处理着色器编译失败\n' + gl.getShaderInfoLog(s))
    return s
  }
  const p = gl.createProgram()!
  gl.attachShader(p, compile(gl.VERTEX_SHADER, vs))
  gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs))
  gl.linkProgram(p)
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('pot web: 后处理着色器链接失败\n' + gl.getProgramInfoLog(p))
  return p
}
