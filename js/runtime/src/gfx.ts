/**
 * gfx：运行时着色器。游戏在 data/ 里写 GLSL ES（与 WebGL2 / three.js ShaderMaterial 相同的语言），
 * Runner 的原生插件 pot_gfx 在运行时编译并在 URP 场景里绘制，改着色器、加材质都不需要重建 Runner。
 *
 *   const water = ctx.gfx.shader({ fragment: 'shaders/water.frag' })
 *   scene.spawn({ shape: 'plane' }).shader(water, { uniforms: { uDeep: '#0a3a5a' }, queue: 'transparent', blend: 'alpha' })
 *
 * - 预置代码：#version、精度、内置 uniform（pot_*）、顶点属性（顶点阶段）
 * - #include <pot/lit>（光照工具）、<pot/varyings>（默认顶点着色器的输出），#include "相对路径"（data/ 下）
 * - 不给 vertex 时用内置的 <pot/standard.vert>
 * - 改文件触发热重载；编译出错时保留旧程序，错误按原文件行号报告
 */
import { Context, Service } from 'cordis'
import type { Host } from './host'
import { applyUniforms, Texture } from './scene'
import type { UniformValue } from './scene'

declare module 'cordis' {
  interface Context {
    gfx: GfxService
  }
}

export interface ShaderOptions {
  /** data/ 下的片元着色器路径 */
  fragment?: string
  /** data/ 下的顶点着色器路径；省略时用 <pot/standard.vert> */
  vertex?: string
  /** 内联源码（与路径二选一，适合很短的着色器） */
  fragmentSource?: string
  vertexSource?: string
  /** 程序名；默认由路径或源码生成。同名程序全局共享 */
  name?: string
  /** 全屏程序（给 gfx.bake 用）：省略 vertex 时用 <pot/fullscreen.vert>，片元着色器读 in vec2 vUv */
  fullscreen?: boolean
}

export interface BakeTarget {
  /** rgba8（默认，线性数据）、srgb（颜色，写入时自动转 sRGB）、rgba16f、rgba32f、r8、rg8 */
  format?: 'rgba8' | 'srgb' | 'rgba16f' | 'rgba32f' | 'r8' | 'rg8'
  /** 生成 mipmap（默认 true） */
  mipmaps?: boolean
  wrap?: 'repeat' | 'clamp'
  filter?: 'point' | 'bilinear' | 'trilinear'
  /** 各向异性等级，默认 8 */
  aniso?: number
}

export interface BakeOptions {
  width: number
  /** 默认等于 width */
  height?: number
  /** 输出目标（MRT，片元着色器用 layout(location = i) out 输出）；默认一个 rgba8 */
  targets?: BakeTarget[]
  uniforms?: Record<string, UniformValue>
  /** 与目标原有内容（透明黑）的混合方式，默认 none */
  blend?: 'none' | 'alpha' | 'add' | 'premultiplied'
}

/** 着色器程序句柄（随创建它的插件卸载而释放） */
export class Shader {
  constructor(readonly name: string, readonly error: string, private _dispose?: () => any) {}
  /** 本次编译是否成功（失败时若有同名旧程序，画面仍用旧程序） */
  get ok() {
    return !this.error
  }
  destroy() {
    return this._dispose?.()
  }
}

/** 预置给两个阶段的内置 uniform（C# PotGfx.FrameBuiltins / ObjectBuiltins 填充） */
export const BUILTIN_UNIFORMS = `uniform mat4 pot_Model;
uniform mat4 pot_ModelInv;
uniform mat3 pot_NormalMatrix;
uniform mat4 pot_View;
uniform mat4 pot_Proj;
uniform mat4 pot_ViewProj;
uniform vec4 pot_CameraPos;
uniform vec4 pot_Time;
uniform vec4 pot_ScreenSize;
uniform vec4 pot_SunDir;
uniform vec4 pot_SunColor;
uniform vec4 pot_AmbientSky;
uniform vec4 pot_AmbientEquator;
uniform vec4 pot_AmbientGround;
uniform vec4 pot_Fog;
uniform vec4 pot_Env;
uniform mat4 pot_ShadowMatrix[4];
uniform vec4 pot_ShadowSpheres[4];
uniform vec4 pot_ShadowParams;
uniform vec4 pot_FogParams;
uniform vec4 pot_Planar;
uniform mat4 pot_PlanarVP;
uniform vec4 pot_LightPos[16];
uniform vec4 pot_LightColor[16];
uniform vec4 pot_LightSpot[16];
uniform vec4 pot_LightAtten[16];
uniform vec4 pot_LightCount;
`

const HEADER = `#version 310 es
precision highp float;
precision highp int;
precision highp sampler2D;
precision highp samplerCube;
`

const VERTEX_INPUTS = `layout(location = 0) in vec3 pot_Position;
layout(location = 1) in vec3 pot_Normal;
layout(location = 2) in vec2 pot_UV;
layout(location = 3) in vec4 pot_VertexColor;
layout(location = 4) in vec4 pot_Tangent;
`

/** 内置库（#include <pot/...>） */
export const LIBRARY: Record<string, string> = {
  'pot/varyings': `#ifndef POT_VARYINGS
#define POT_VARYINGS
#ifdef POT_VERTEX
out vec3 vWorldPos;
out vec3 vNormal;
out vec2 vUV;
out vec4 vColor;
out vec4 vTangent;
#else
in vec3 vWorldPos;
in vec3 vNormal;
in vec2 vUV;
in vec4 vColor;
in vec4 vTangent;
#endif
#endif
`,
  'pot/standard.vert': `#include <pot/varyings>
void main() {
  vec4 world = pot_Model * vec4(pot_Position, 1.0);
  vWorldPos = world.xyz;
  vNormal = normalize(pot_NormalMatrix * pot_Normal);
  vUV = pot_UV;
  vColor = pot_VertexColor;
  vTangent = vec4(normalize(mat3(pot_Model) * pot_Tangent.xyz), pot_Tangent.w);
  gl_Position = pot_ViewProj * world;
}
`,
  'pot/fullscreen.vert': `// gfx.bake 用：网格是裁剪空间的全屏四边形，UV 0..1（v=0 对应采样时的 v=0，已处理平台差异）
out vec2 vUv;
void main() {
  vUv = pot_UV;
  gl_Position = vec4(pot_Position.xy, 0.0, 1.0);
}
`,
  'pot/lit': `#ifndef POT_LIT
#define POT_LIT
// 输出到 HDR 线性缓冲（后处理负责色调映射）；颜色常量多为 sRGB，用 pot_ToLinear 转换
struct PotSurface {
  vec3 albedo;     // 线性
  float metallic;
  float roughness;
  vec3 normal;     // 世界空间，已归一化
  vec3 emission;   // 线性，HDR
  float ao;
  float alpha;
  float planar;    // 平面反射权重 0..1（需 scene.reflection 启用；只对接近反射平面、朝上的表面有意义）
  float specular;  // 直射高光倍率（太阳与附加光，默认 1；如海面闪光按方位调制）
  float specularMax; // 直射高光上限（每个光源，线性 HDR；默认 1e4 即不限）
};

PotSurface pot_DefaultSurface(vec3 normal) {
  PotSurface s;
  s.albedo = vec3(0.8);
  s.metallic = 0.0;
  s.roughness = 0.5;
  s.normal = normal;
  s.emission = vec3(0.0);
  s.ao = 1.0;
  s.alpha = 1.0;
  s.planar = 0.0;
  s.specular = 1.0;
  s.specularMax = 1e4;
  return s;
}

vec3 pot_ToLinear(vec3 c) {
  return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c));
}

vec3 pot_ToSrgb(vec3 c) {
  c = max(c, vec3(0.0));
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}

const float POT_PI = 3.14159265359;

vec3 pot_Hemisphere(vec3 n) {
  float y = n.y;
  vec3 up = mix(pot_AmbientEquator.rgb, pot_AmbientSky.rgb, clamp(y, 0.0, 1.0));
  return mix(up, pot_AmbientGround.rgb, clamp(-y, 0.0, 1.0));
}

vec3 pot_EnvReflection(vec3 r, float roughness) {
  vec3 env = textureLod(pot_EnvMap, r, roughness * 6.0).rgb;
  return mix(pot_Hemisphere(r), env, pot_Env.y) * pot_Env.x;
}

// 雾（与 PotCommon.hlsl 一致）：pot_Fog = (线性颜色, 密度)，pot_FogParams = (高度衰减, 基准高度, 太阳散射, 0)
float pot_FogFactor(vec3 worldPos) {
  if (pot_Fog.w <= 0.0) return 1.0;
  vec3 c = pot_CameraPos.xyz;
  vec3 d = worldPos - c;
  float od = pot_Fog.w * length(d);
  if (pot_FogParams.x > 0.0) {
    float k = pot_FogParams.x;
    float f = exp(-k * max(c.y - pot_FogParams.y, -20.0));
    float kdy = k * d.y;
    float t = abs(kdy) > 1e-3 ? (1.0 - exp(-kdy)) / kdy : 1.0;
    od *= f * t;
  }
  return exp(-od * od);
}

vec3 pot_FogColor(vec3 viewDir) {
  float s = pow(clamp(dot(viewDir, normalize(pot_SunDir.xyz)), 0.0, 1.0), 8.0);
  return pot_Fog.rgb + pot_SunColor.rgb * (pot_FogParams.z * s);
}

vec3 pot_ApplyFog(vec3 color, vec3 worldPos) {
  return mix(pot_FogColor(normalize(worldPos - pot_CameraPos.xyz)), color, pot_FogFactor(worldPos));
}

// 平面反射（scene.reflection）：rgb = 镜像相机画面，a = 可用权重（未启用或远离反射平面时为 0）
// n 用于扰动采样位置（涟漪、法线贴图会让倒影晃动）
vec4 pot_PlanarReflection(vec3 worldPos, vec3 n, float roughness) {
  if (pot_Planar.x < 0.5) return vec4(0.0);
  float near = clamp(1.0 - abs(worldPos.y - pot_Planar.y) * 3.0, 0.0, 1.0);
  if (near <= 0.0) return vec4(0.0);
  float dist = length(worldPos - pot_CameraPos.xyz);
  vec3 p = worldPos + vec3(n.x, 0.0, n.z) * (0.05 * dist);
  vec4 c = pot_PlanarVP * vec4(p, 1.0);
  vec2 uv = clamp(c.xy / max(c.w, 1e-4) * 0.5 + 0.5, vec2(0.001), vec2(0.999));
  return vec4(textureLod(pot_PlanarMap, uv, roughness * 7.0).rgb, near);
}

// 主光阴影：1 = 全亮，0 = 全影。按级联包围球选级联，3x3 双线性 PCF，超出阴影距离淡出
// pot_ShadowParams: x 强度（0 表示本帧无阴影），y 级联数，z 最大距离，w 1 = reversed Z
float pot_ShadowCmp(ivec2 p, float z) {
  float d = texelFetch(pot_ShadowMap, p, 0).r;
  return pot_ShadowParams.w > 0.5 ? step(d, z) : step(z, d);
}

float pot_Shadow(vec3 worldPos) {
  if (pot_ShadowParams.x <= 0.0) return 1.0;
  int count = int(pot_ShadowParams.y + 0.5);
  int ci = -1;
  for (int i = 0; i < 4; i++) {
    if (i >= count) break;
    vec3 dv = worldPos - pot_ShadowSpheres[i].xyz;
    if (dot(dv, dv) < pot_ShadowSpheres[i].w * pot_ShadowSpheres[i].w) { ci = i; break; }
  }
  if (ci < 0) return 1.0;
  vec4 sc = pot_ShadowMatrix[ci] * vec4(worldPos, 1.0);
  sc.xyz /= sc.w;
  ivec2 size = textureSize(pot_ShadowMap, 0);
  vec2 tc = sc.xy * vec2(size) - 0.5;
  ivec2 base = ivec2(floor(tc)) - 1;
  vec2 f = fract(tc);
  float sum = 0.0;
  for (int j = 0; j < 4; j++) {
    float wy = j == 0 ? 1.0 - f.y : (j == 3 ? f.y : 1.0);
    for (int i = 0; i < 4; i++) {
      float wx = i == 0 ? 1.0 - f.x : (i == 3 ? f.x : 1.0);
      ivec2 p = clamp(base + ivec2(i, j), ivec2(0), size - 1);
      sum += wx * wy * pot_ShadowCmp(p, sc.z);
    }
  }
  float lit = sum / 9.0;
  float dist = length(worldPos - pot_CameraPos.xyz);
  float fade = clamp((dist - pot_ShadowParams.z * 0.9) / max(pot_ShadowParams.z * 0.1, 1e-3), 0.0, 1.0);
  return mix(1.0, mix(1.0, lit, pot_ShadowParams.x), 1.0 - fade);
}

// 单个光源的直射项（GGX + Lambert，与 URP LightingPhysicallyBased 同量纲：乘 π 后对应 Unity 光强）
vec3 pot_BRDF(PotSurface s, vec3 n, vec3 v, vec3 l, vec3 f0) {
  vec3 h = normalize(l + v);
  float nl = max(dot(n, l), 0.0);
  float nv = max(dot(n, v), 1e-4);
  float nh = max(dot(n, h), 0.0);
  float vh = max(dot(v, h), 0.0);
  float a = max(s.roughness * s.roughness, 2e-3);
  float a2 = a * a;
  float dd = nh * nh * (a2 - 1.0) + 1.0;
  float D = a2 / (POT_PI * dd * dd);
  float k = (s.roughness + 1.0) * (s.roughness + 1.0) / 8.0;
  float G = (nl / (nl * (1.0 - k) + k)) * (nv / (nv * (1.0 - k) + k));
  vec3 F = f0 + (1.0 - f0) * pow(1.0 - vh, 5.0);
  vec3 spec = D * G * F / max(4.0 * nl * nv, 1e-4);
  vec3 kd = (1.0 - F) * (1.0 - s.metallic);
  return (kd * s.albedo / POT_PI + spec * s.specular) * nl * POT_PI;
}

// 同 pot_BRDF，但把直射高光（乘光色后）截到 s.specularMax 以内（three.js 常见的 directSpecular 钳制）
vec3 pot_BRDFLight(PotSurface s, vec3 n, vec3 v, vec3 l, vec3 f0, vec3 lightColor) {
  if (s.specularMax >= 1e4) return pot_BRDF(s, n, v, l, f0) * lightColor;
  PotSurface d = s; d.specular = 0.0;
  vec3 diff = pot_BRDF(d, n, v, l, f0) * lightColor;
  PotSurface p = s; p.albedo = vec3(0.0); p.metallic = 1.0;
  // metallic=1、albedo=0 时 kd=0，但 f0 由调用方给出，只剩高光项
  vec3 spec = pot_BRDF(p, n, v, l, f0) * lightColor;
  return diff + min(spec, vec3(s.specularMax * s.specular));
}

// 附加光（场景里的点光、聚光；Runner 每个物体挑最多 16 个），衰减与 URP 相同
vec3 pot_AdditionalLights(PotSurface s, vec3 n, vec3 v, vec3 f0, vec3 worldPos) {
  vec3 sum = vec3(0.0);
  int count = int(pot_LightCount.x + 0.5);
  for (int i = 0; i < 16; i++) {
    if (i >= count) break;
    vec3 dl = pot_LightPos[i].xyz - worldPos;
    float d2 = max(dot(dl, dl), 1e-4);
    vec3 l = dl * inversesqrt(d2);
    float f = d2 * pot_LightPos[i].w;
    float sm = clamp(1.0 - f * f, 0.0, 1.0);
    float sp = clamp(dot(pot_LightSpot[i].xyz, l) * pot_LightAtten[i].x + pot_LightAtten[i].y, 0.0, 1.0);
    float att = sm * sm / d2 * sp * sp;
    if (att <= 0.0) continue;
    sum += pot_BRDFLight(s, n, v, l, f0, pot_LightColor[i].rgb) * att;
  }
  return sum;
}

// GGX 太阳光（含阴影）+ 点光/聚光 + 半球环境光 + 环境反射（可混入平面反射），不含雾
// 需要在雾之前叠加效果（如远处雾霭）时用它，最后自行 pot_ApplyFog
vec3 pot_LitColor(PotSurface s, vec3 worldPos) {
  vec3 n = normalize(s.normal);
  // 镜面抗锯齿：法线在像素内的变化折算为粗糙度（同 three.js geometryRoughness），避免细碎法线在高光里闪烁
  vec3 dxy = max(abs(dFdx(n)), abs(dFdy(n)));
  s.roughness = min(max(s.roughness, 0.0525) + max(max(dxy.x, dxy.y), dxy.z), 1.0);
  vec3 v = normalize(pot_CameraPos.xyz - worldPos);
  vec3 f0 = mix(vec3(0.04), s.albedo, s.metallic);
  float nv = max(dot(n, v), 1e-4);
  vec3 direct = pot_BRDFLight(s, n, v, normalize(pot_SunDir.xyz), f0, pot_SunColor.rgb) * pot_Shadow(worldPos);
  direct += pot_AdditionalLights(s, n, v, f0, worldPos);
  vec3 fenv = f0 + (max(vec3(1.0 - s.roughness), f0) - f0) * pow(1.0 - nv, 5.0);
  vec3 ambient = (1.0 - s.metallic) * s.albedo * pot_Hemisphere(n) * s.ao;
  vec3 env = pot_EnvReflection(reflect(-v, n), s.roughness);
  if (s.planar > 0.0) {
    vec4 pr = pot_PlanarReflection(worldPos, n, s.roughness);
    env = mix(env, pr.rgb, clamp(s.planar * pr.a, 0.0, 1.0));
  }
  vec3 refl = env * fenv * s.ao;
  return direct + ambient + refl + s.emission;
}

// pot_LitColor + 雾
vec4 pot_Lit(PotSurface s, vec3 worldPos) {
  return vec4(pot_ApplyFog(pot_LitColor(s, worldPos), worldPos), s.alpha);
}
#endif
`,
}

/** 预置代码之后的源码编号：0 预置，1.. 各文件 */
interface Source {
  code: string
  files: string[]
}

function normalize(path: string) {
  const parts: string[] = []
  for (const p of path.replace(/\\/g, '/').replace(/^data\//, '').split('/')) {
    if (!p || p === '.') continue
    if (p === '..') parts.pop()
    else parts.push(p)
  }
  return parts.join('/')
}

function dirname(path: string) {
  const i = path.lastIndexOf('/')
  return i < 0 ? '' : path.slice(0, i + 1)
}

/**
 * 展开 #include，并用 #line 把行号映射回原文件。
 * read(path) 读取 data/ 下的文件（会登记依赖，文件变化时触发热重载）。
 */
export function preprocess(stage: 'vertex' | 'fragment', entry: { path?: string; source?: string; library?: string }, read: (path: string) => string): Source {
  const files: string[] = ['(预置)']
  const once = new Set<string>()
  const out: string[] = [HEADER.trimEnd()]
  out.push(`#define ${stage === 'vertex' ? 'POT_VERTEX' : 'POT_FRAGMENT'} 1`)
  out.push(BUILTIN_UNIFORMS.trimEnd())
  if (stage === 'vertex') out.push(VERTEX_INPUTS.trimEnd())
  else out.push('uniform samplerCube pot_EnvMap;\nuniform highp sampler2D pot_ShadowMap;\nuniform sampler2D pot_PlanarMap;')

  const expand = (name: string, text: string, depth: number, stack: string[]) => {
    if (depth > 16) throw new Error(`#include 嵌套过深：${stack.join(' → ')}`)
    const index = files.length
    files.push(name)
    out.push(`#line 1 ${index}`)
    const lines = text.replace(/\r\n?/g, '\n').split('\n')
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (/^\s*#\s*version\b/.test(line)) {
        out.push('')
        continue
      }
      const m = /^\s*#\s*include\s+(?:<([^>]+)>|"([^"]+)")/.exec(line)
      if (!m) {
        out.push(line)
        continue
      }
      let target: string
      let body: string
      if (m[1]) {
        target = `<${m[1]}>`
        const lib = LIBRARY[m[1]]
        if (lib === undefined) throw new Error(`${name}:${i + 1}: 未知的内置库 <${m[1]}>（可用：${Object.keys(LIBRARY).join('、')}）`)
        body = lib
      } else {
        target = normalize(dirname(name.startsWith('<') ? '' : name) + m[2])
        if (stack.includes(target)) throw new Error(`${name}:${i + 1}: #include 循环：${[...stack, target].join(' → ')}`)
        body = read(target)
      }
      if (once.has(target) && m[1]) {
        out.push('')
        continue
      }
      once.add(target)
      expand(target, body, depth + 1, [...stack, target])
      out.push(`#line ${i + 2} ${index}`)
    }
  }

  if (entry.path !== undefined) {
    const path = normalize(entry.path)
    expand(path, read(path), 0, [path])
  } else if (entry.source !== undefined) {
    expand(stage === 'vertex' ? '(内联顶点着色器)' : '(内联片元着色器)', entry.source, 0, [])
  } else {
    const lib = entry.library ?? 'pot/standard.vert'
    expand(`<${lib}>`, LIBRARY[lib], 0, [])
  }
  return { code: out.join('\n') + '\n', files }
}

/** 把 glslang 的 “ERROR: 文件号:行号: ...” 换成 “文件:行号: ...” */
export function mapErrors(message: string, vs: Source, fs: Source) {
  const lines = message.split('\n')
  let current: Source | undefined
  return lines.map((line) => {
    if (/^\[vertex\]/.test(line)) current = vs
    else if (/^\[fragment\]/.test(line)) current = fs
    else if (/^\[link\]|^\[mapIO\]/.test(line)) current = undefined
    return line.replace(/(ERROR|WARNING): (\d+):(\d+):/g, (all, kind, file, row) => {
      const name = current?.files[Number(file)]
      return name ? `${kind}: ${name}:${row}:` : all
    })
  }).join('\n')
}

export class GfxService extends Service {
  static inject = ['data', 'clock']

  /** 程序名 → 引用数（同名程序可被多个插件共享） */
  private _refs = new Map<string, number>()

  constructor(ctx: Context, private _host: Host) {
    super(ctx, 'gfx')
  }

  /** 后端名（d3d11）；为空表示当前平台不支持运行时着色器 */
  get backend(): string {
    return this._host.engine.gfxBackend()
  }

  get supported() {
    return !!this.backend
  }

  /** 编译着色器程序。失败不抛错（返回的 Shader.error 为错误信息，并输出日志），以便热重载时保留旧画面 */
  shader(options: ShaderOptions): Shader {
    const ctx = this.ctx
    const read = (path: string) => ctx.data.text(path)
    const vertexEntry = { path: options.vertex, source: options.vertexSource, library: options.fullscreen ? 'pot/fullscreen.vert' : undefined }
    const fragmentEntry = { path: options.fragment, source: options.fragmentSource }
    if (fragmentEntry.path === undefined && fragmentEntry.source === undefined) throw new Error('gfx.shader：需要 fragment 或 fragmentSource')
    const name = options.name
      ?? `${options.vertex ?? (options.vertexSource !== undefined ? `inline:${hash(options.vertexSource)}` : `<${vertexEntry.library ?? 'pot/standard.vert'}>`)}|${options.fragment ?? `inline:${hash(options.fragmentSource!)}`}`
    let error = ''
    let vs: Source | undefined
    let fs: Source | undefined
    try {
      vs = preprocess('vertex', vertexEntry, read)
      fs = preprocess('fragment', fragmentEntry, read)
    } catch (e: any) {
      error = String(e?.message ?? e)
    }
    const engine = this._host.engine
    const clock = ctx.clock
    const dispose = ctx.effect(() => {
      if (vs && fs) {
        const result = engine.gfxProgram(name, vs.code, fs.code)
        if (result) error = mapErrors(result, vs, fs)
      }
      if (error) ctx.logger('gfx').error('着色器 %s 编译失败：\n%s', name, error)
      this._refs.set(name, (this._refs.get(name) ?? 0) + 1)
      return () => this._release(name, clock)
    }, `gfx.shader(${name})`)
    return new Shader(name, error, dispose)
  }

  /**
   * 用全屏程序（shader({ fullscreen: true })）一次画到新建的贴图，返回每个目标一张 Texture（随调用方插件卸载销毁）。
   * 用于程序化材质、查找表、法线生成等：结果可当 material 的 map/normalMap/maskMap，也可作为下一次 bake 的输入。
   * 采样坐标与 vUv 一致（vUv.y=0 即贴图 v=0），无需关心平台的 UV 原点差异。
   */
  bake(shader: Shader | string, options: BakeOptions): Texture[] {
    const program = typeof shader === 'string' ? shader : shader.name
    if (typeof shader !== 'string' && shader.error) throw new Error(`gfx.bake：着色器 ${program} 编译失败`)
    const width = Math.round(options.width)
    const height = Math.round(options.height ?? options.width)
    const targets = options.targets?.length ? options.targets : [{}]
    const spec = targets.map((t) => [
      t.format ?? 'rgba8',
      t.mipmaps === false ? 0 : 1,
      t.wrap === 'clamp' ? 1 : 0,
      t.filter === 'point' ? 0 : t.filter === 'bilinear' ? 1 : 2,
      t.aniso ?? 8,
    ].join(',')).join(';')
    const blend = ({ none: 0, alpha: 1, add: 2, premultiplied: 3 } as const)[options.blend ?? 'none']
    const engine = this._host.engine
    let ids: number[] = []
    const dispose = this.ctx.effect(() => {
      const bind = engine.gfxBakeBegin()
      if (options.uniforms) applyUniforms(engine, bind, options.uniforms)
      const result = engine.gfxBake(bind, program, width, height, spec, blend)
      if (result.startsWith('!')) throw new Error(`gfx.bake(${program})：${result.slice(1) || '失败'}`)
      ids = result.split(',').map(Number)
      return () => {
        for (const id of ids) engine.destroyTexture(id)
      }
    }, `gfx.bake(${program})`)
    // 多张贴图共用一个销毁：任何一张 destroy 都会全部释放
    return ids.map((id) => new Texture(id, width, height, dispose))
  }

  /** 引用归零后延迟两帧再释放：热重载时新单元会先重新登记同名程序，旧程序得以平滑替换或在出错时保留 */
  private _release(name: string, clock: { waitFrames(n: number): Promise<void> }) {
    const n = (this._refs.get(name) ?? 1) - 1
    if (n > 0) {
      this._refs.set(name, n)
      return
    }
    this._refs.delete(name)
    clock.waitFrames(2).then(() => {
      if (!this._refs.has(name)) this._host.engine.gfxDestroyProgram(name)
    })
  }
}

function hash(text: string) {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0).toString(36)
}
