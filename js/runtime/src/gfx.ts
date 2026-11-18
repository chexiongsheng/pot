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

float pot_FogFactor(vec3 worldPos) {
  float d = length(worldPos - pot_CameraPos.xyz) * pot_Fog.w;
  return exp(-d * d);
}

vec3 pot_ApplyFog(vec3 color, vec3 worldPos) {
  return mix(pot_Fog.rgb, color, pot_FogFactor(worldPos));
}

// GGX 太阳光 + 半球环境光 + 环境反射，含雾
vec4 pot_Lit(PotSurface s, vec3 worldPos) {
  vec3 n = normalize(s.normal);
  vec3 v = normalize(pot_CameraPos.xyz - worldPos);
  vec3 l = normalize(pot_SunDir.xyz);
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
  vec3 f0 = mix(vec3(0.04), s.albedo, s.metallic);
  vec3 F = f0 + (1.0 - f0) * pow(1.0 - vh, 5.0);
  vec3 spec = D * G * F / max(4.0 * nl * nv, 1e-4);
  vec3 kd = (1.0 - F) * (1.0 - s.metallic);
  vec3 direct = (kd * s.albedo / POT_PI + spec) * pot_SunColor.rgb * nl * POT_PI;
  vec3 fenv = f0 + (max(vec3(1.0 - s.roughness), f0) - f0) * pow(1.0 - nv, 5.0);
  vec3 ambient = (1.0 - s.metallic) * s.albedo * pot_Hemisphere(n) * s.ao;
  vec3 refl = pot_EnvReflection(reflect(-v, n), s.roughness) * fenv * s.ao;
  vec3 color = direct + ambient + refl + s.emission;
  return vec4(pot_ApplyFog(color, worldPos), s.alpha);
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
export function preprocess(stage: 'vertex' | 'fragment', entry: { path?: string; source?: string }, read: (path: string) => string): Source {
  const files: string[] = ['(预置)']
  const once = new Set<string>()
  const out: string[] = [HEADER.trimEnd()]
  out.push(`#define ${stage === 'vertex' ? 'POT_VERTEX' : 'POT_FRAGMENT'} 1`)
  out.push(BUILTIN_UNIFORMS.trimEnd())
  if (stage === 'vertex') out.push(VERTEX_INPUTS.trimEnd())
  else out.push('uniform samplerCube pot_EnvMap;')

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
    expand('<pot/standard.vert>', LIBRARY['pot/standard.vert'], 0, [])
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
    const vertexEntry = { path: options.vertex, source: options.vertexSource }
    const fragmentEntry = { path: options.fragment, source: options.fragmentSource }
    if (fragmentEntry.path === undefined && fragmentEntry.source === undefined) throw new Error('gfx.shader：需要 fragment 或 fragmentSource')
    const name = options.name
      ?? `${options.vertex ?? (options.vertexSource !== undefined ? `inline:${hash(options.vertexSource)}` : '<pot/standard.vert>')}|${options.fragment ?? `inline:${hash(options.fragmentSource!)}`}`
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
