/**
 * scene：场景对象。游戏代码只拿 Entity 句柄（内部是数字 id），不直接接触引擎对象。
 * spawn 出来的对象挂在调用方 fiber 的 effect 上：插件卸载/热重载时自动销毁。
 * 需要跨重载保留的东西请存进 state（位置、血量……），重建时据此恢复。
 */
import { Context, Service } from 'cordis'
import type { Host, Vec3 } from './host'
import { unitOf } from './units'
import { Canvas } from './canvas'
import { parseColorString } from './color'

declare module 'cordis' {
  interface Context {
    scene: SceneService
  }
}

export type Shape = 'cube' | 'sphere' | 'capsule' | 'cylinder' | 'plane' | 'quad' | 'empty' | `mesh:${string}`
export type Color = [number, number, number] | [number, number, number, number] | string

/**
 * 材质模式：lit 不透明受光（默认）、lit-cutout 镂空受光、lit-twosided 双面受光、lit-fade 半透明受光、
 * unlit 不受光、unlit-fade 半透明不受光、additive 叠加发光
 */
export type MaterialMode = 'lit' | 'lit-cutout' | 'lit-twosided' | 'lit-fade' | 'unlit' | 'unlit-fade' | 'additive'

const CULL: Record<string, number> = { none: 0, front: 1, back: 2, default: 3 }

/** 贴图句柄（scene.texture / scene.text 创建，随创建它的插件卸载而销毁） */
export class Texture {
  constructor(readonly id: number, readonly width: number, readonly height: number, private _dispose?: () => any) {}
  destroy() {
    return this._dispose?.()
  }
}

export interface MaterialOptions {
  mode?: MaterialMode
  /**
   * 面剔除：back 剔除背面（除 lit-twosided 外的默认）、front 剔除正面、none 双面；
   * default 恢复模式默认。只传 cull 时沿用当前模式，换模式时沿用已设置的 cull。
   * 双面受光时背面按翻转法线着色。仅对内置材质模式生效
   */
  cull?: 'back' | 'front' | 'none' | 'default'
  /** 0 到 1 */
  metallic?: number
  /** 0 到 1 */
  smoothness?: number
  /** 自发光颜色；emissionIntensity 为倍数（HDR，可大于 1） */
  emission?: Color
  emissionIntensity?: number
  /** 是否投射阴影 */
  shadows?: boolean
  /** 基础色贴图（sRGB），与 color 相乘；null 解除 */
  map?: Texture | null
  /** 法线贴图（线性，OpenGL 约定 +Y） */
  normalMap?: Texture | null
  /** 遮罩贴图（线性）：R 金属度、G AO、B 高度（积水用）、A 光滑度；与 metallic/smoothness 相乘 */
  maskMap?: Texture | null
  /** 贴图重复次数；uv 为 world/object 时表示每米重复次数 */
  tiling?: [number, number]
  offset?: [number, number]
  /** mesh 网格 UV（默认）、world 世界坐标三平面投影、object 物体坐标三平面投影（按缩放平铺） */
  uv?: 'mesh' | 'world' | 'object'
  normalScale?: number
  /** AO 强度 0 到 1 */
  occlusion?: number
  /** 对全局湿润的响应（0 不受雨淋，默认 1） */
  wet?: number
  /** 接收平面反射（0 到 1，需 scene.reflection 开启） */
  planar?: number
  /** Alpha 镂空阈值（lit-cutout 默认 0.5） */
  cutoff?: number
  /** 乘以网格顶点色 */
  vertexColors?: boolean
}

export interface SpawnOptions {
  shape?: Shape
  name?: string
  parent?: Entity
  position?: Vec3
  rotation?: Vec3
  scale?: Vec3 | number
  color?: Color
  material?: MaterialOptions
  /** 图元自带碰撞体，false 关闭（纯装饰物关掉能让射线更快） */
  collider?: boolean
  /** 层 0 到 31，配合 raycast 的 mask 使用 */
  layer?: number
  active?: boolean
  /** false：只留碰撞体不渲染（命中盒、触发区）。与 active 不同，碰撞体和子节点照常工作 */
  visible?: boolean
  /**
   * 骨骼（仅 mesh: 形状，网格须带 boneIndices）：顺序对应网格里的骨骼下标。给了就建成蒙皮网格，
   * 之后只要移动骨骼实体（通常用 scene.setTransforms 一次下发）。蒙皮实体没有碰撞体，也不能用运行时着色器
   */
  bones?: ArrayLike<Entity>
}

export interface TransformBatchOptions {
  /** 写入的实体数，默认取 targets 与 data 能容纳的较小值 */
  count?: number
  /** 默认三项都写；不需要的关掉（例如只同步位置与旋转） */
  position?: boolean
  rotation?: boolean
  scale?: boolean
  /** 位置与旋转所在空间，默认 world。缩放始终是本地缩放 */
  space?: 'world' | 'local'
}

export interface MeshOptions {
  /**
   * 内容标识。Runner 里同名网格已按同一个 key 注册过时直接复用，不再上传；data 传函数时连生成也跳过。
   * 网格跨热重载保留（冷重启才清空），所以大网格给一个随内容变化的 key 能省掉热重载里的重建。
   * true 表示由运行时按内容算哈希（仍要生成数据，只省上传）。不给则每次都上传（内容每帧变的动态网格）
   */
  key?: string | true
}

export interface LightOptions {
  type?: 'directional' | 'point' | 'spot'
  name?: string
  /** 强度；单位由 units 决定 */
  intensity?: number
  color?: Color
  /** 照射范围（米，URP 灯光必须有限）；默认 10 */
  range?: number
  /**
   * 强度单位。unity（默认）：URP 的强度，直接使用。
   * three：three.js r155+ 物理单位（点光/聚光为坎德拉、平行光为勒克斯）。three 的漫反射除以 π 而 URP 不除，
   * 运行时按 1/π 换算；之后 entity.intensity(v) 也按同一单位解释，移植时直接抄原版数值即可。
   */
  units?: 'unity' | 'three'
  /** three 的 PointLight.distance（0 表示不截断）。units 为 three 且没给 range 时，distance > 0 当作 range */
  distance?: number
  position?: Vec3
  rotation?: Vec3
  parent?: Entity
  /** 聚光灯角度（度） */
  spotAngle?: number
  shadows?: 'none' | 'hard' | 'soft'
}

export interface RaycastOptions {
  maxDistance?: number
  /** 层掩码（1 << layer 的组合）；默认为 Unity 默认射线层集合 */
  mask?: number
  /**
   * 额外参与求交的无限平面（不需要碰撞体，如地坪、海面）。与碰撞体命中一起取最近的一个。
   * 平面命中的 id 为 -1、entity 为空，`plane` 为下标、`tag` 为平面的 tag。
   */
  planes?: RayPlane[]
}

/**
 * 射线用的无限平面：`{ y }` 为水平面，或 `{ point, normal }` 任意平面；默认只从法线一侧命中（twoSided 为双面）。
 * region 限定命中点所在的世界坐标范围（如只在码头内的地坪），超出范围视为没有平面。
 */
export interface RayPlane {
  y?: number
  point?: Vec3
  /** 默认 [0, 1, 0]，不必归一化 */
  normal?: Vec3
  twoSided?: boolean
  region?: { minX?: number; maxX?: number; minY?: number; maxY?: number; minZ?: number; maxZ?: number }
  /** 命中时原样带回（如 'ground'、'water'） */
  tag?: string
}

export interface RaycastHit {
  /** 命中对象 id；命中非 pot 对象或平面时为 -1 */
  id: number
  entity?: Entity
  point: Vec3
  normal: Vec3
  distance: number
  /** 命中 options.planes 中的平面时为其下标 */
  plane?: number
  tag?: string
}

export interface ViewOptions {
  fov?: number
  near?: number
  far?: number
}

export interface TextureOptions {
  /** RGBA8 像素，长度 width*height*4，行从下到上 */
  data: Uint8Array | Uint8ClampedArray
  width: number
  height: number
  /** 数据为线性（法线、遮罩贴图用 true；颜色贴图 false，默认） */
  linear?: boolean
  mipmaps?: boolean
  wrap?: 'repeat' | 'clamp'
  filter?: 'point' | 'bilinear' | 'trilinear'
  /** 各向异性等级，默认 8 */
  aniso?: number
}

export interface TextTextureOptions {
  text: string
  width?: number
  height?: number
  /** 字号（像素） */
  size?: number
  color?: Color
  background?: Color
  align?: 'left' | 'center' | 'right'
  bold?: boolean
  letterSpacing?: number
}

export interface MeshData {
  positions: ArrayLike<number>
  indices: ArrayLike<number>
  normals?: ArrayLike<number>
  uvs?: ArrayLike<number>
  /**
   * RGBA，按 colorSpace 解释（默认 sRGB）。以 Float32 存储，大于 1 的 HDR 值原样保留（不截断），
   * 内置材质的 vertexColors 不做 saturate，配合 post({ bloom }) 可以直接发光
   */
  colors?: ArrayLike<number>
  /** colors 的色彩空间：srgb（默认，线性色彩空间项目里转线性）或 linear（已是线性值，原样写入，例如 three 的顶点色） */
  colorSpace?: 'srgb' | 'linear'
  /**
   * 切线 xyzw（引擎坐标；w 为 ±1，副切线 = cross(normal, tangent.xyz) * w）。
   * 省略时有 uvs 就由引擎按 UV 自动计算；自定义着色器从 pot_Tangent / vTangent 读到
   */
  tangents?: ArrayLike<number>
  /** 蒙皮：每个顶点 1 到 4 个骨骼下标（个数 = 长度 / 顶点数） */
  boneIndices?: ArrayLike<number>
  /** 蒙皮权重，形状同 boneIndices；省略表示第一根骨骼权重 1（刚性蒙皮） */
  boneWeights?: ArrayLike<number>
  /** 每根骨骼的绑定矩阵（16 个数，列主序，引擎坐标系）；省略表示单位矩阵，即顶点已经在各自骨骼的局部空间里 */
  bindPoses?: ArrayLike<number>
  /**
   * 自定义顶点属性：名字 → 每顶点 1 到 4 个浮点（`{ size, data }`，或直接给数组，size 按长度 / 顶点数推出）。
   * 最多 7 个，存进 Unity 网格的 UV1-UV7，原样存储（不做 sRGB 转换）；运行时着色器用 `shader({ attributes: { 名字: 'vec4' } })`
   * 声明后在顶点阶段按同名变量读取。不能与蒙皮同时使用
   */
  attributes?: Record<string, MeshAttribute | ArrayLike<number>>
}

export interface MeshAttribute {
  /** 每顶点分量数 1 到 4 */
  size: 1 | 2 | 3 | 4
  data: ArrayLike<number>
}

export interface PostOptions {
  enabled?: boolean
  tonemap?: 'none' | 'neutral' | 'aces'
  antialias?: 'none' | 'fxaa' | 'smaa'
  /** 曝光补偿（EV） */
  exposure?: number
  /** -100 到 100 */
  contrast?: number
  saturation?: number
  temperature?: number
  tint?: number
  filter?: Color
  /** 阴影/高光色调（Vector4，w 为亮度偏移） */
  shadows?: [number, number, number, number]
  highlights?: [number, number, number, number]
  bloom?: number
  bloomThreshold?: number
  bloomScatter?: number
  bloomTint?: Color
  vignette?: number
  vignetteSmooth?: number
  /** 暗角颜色（默认黑；受伤红晕等用） */
  vignetteColor?: Color
  grain?: number
  chromatic?: number
  /** 屏幕空间 AO 强度（0 关闭）、半径、对直接光的影响 */
  ao?: number
  aoRadius?: number
  aoDirect?: number
}

export interface SkyOptions {
  zenith?: Color
  /** 朝向太阳一侧的地平线 */
  horizon?: Color
  /** 背向太阳一侧的地平线 */
  horizonAway?: Color
  ground?: Color
  /** 日轮与光晕颜色（HDR，sunIntensity 为倍数） */
  sun?: Color
  sunIntensity?: number
  /** 日轮角半径（弧度） */
  sunSize?: number
  sunGlow?: number
  /** 云量 0 到 1 */
  clouds?: number
  cloudColor?: Color
  cloudSpeed?: number
  /** 地平线融入雾色的程度 */
  horizonFog?: number
  exposure?: number
  /** 用实时反射探针捕捉天空作为环境反射（默认开） */
  reflection?: boolean
  reflectionSize?: number
  reflectionIntensity?: number
  /** 用天空计算环境光（默认关，通常用 ambient 三色更可控） */
  ambient?: boolean
}

export interface FogOptions {
  /** 高度衰减（每米），0 为均匀雾 */
  height?: number
  /** 高度雾基准高度 */
  base?: number
  /** 迎着太阳时雾中的散射强度 */
  sun?: number
}

export interface WeatherOptions {
  /** 全局湿润 0 到 1：变暗、变光滑 */
  wetness?: number
  /** 积水量 0 到 1（朝上表面） */
  puddles?: number
  /** 雨量 0 到 1（雨丝与积水波纹），0 关闭 */
  rain?: number
  rainColor?: Color
  /** 风（x, z，米/秒） */
  wind?: [number, number]
  /** 雨丝循环盒尺寸 */
  box?: [number, number, number]
  speed?: number
  length?: number
  width?: number
  drops?: number
}

export interface ReflectionOptions {
  enabled?: boolean
  /** 反射平面高度（世界 y） */
  height?: number
  /** 反射贴图分辨率相对屏幕的比例（0.1 到 1） */
  scale?: number
  /** 不进反射的层（层号数组） */
  exclude?: number[]
  /** 反射中渲染阴影（较贵，默认关） */
  shadows?: boolean
}

export interface QualityOptions {
  renderScale?: number
  shadowDistance?: number
  shadowResolution?: number
  shadowCascades?: number
  msaa?: number
  hdr?: boolean
}

export interface BurstOptions {
  /** spark 叠加火花（受重力、会弹跳）、glow 叠加光点、smoke 烟尘 */
  kind?: 'spark' | 'glow' | 'smoke'
  position: Vec3
  direction?: Vec3
  color?: Color
  /** 颜色倍数（HDR） */
  intensity?: number
  count?: number
  speed?: number
  speedJitter?: number
  /** 0 沿 direction，1 完全随机 */
  spread?: number
  size?: number
  sizeJitter?: number
  life?: number
  lifeJitter?: number
}

function rgb(color: Color | undefined, k = 1): number[] | undefined {
  if (color === undefined) return undefined
  const [r, g, b, a] = parseColor(color)
  return [r * k, g * k, b * k, a]
}

function bool(v: boolean | undefined) {
  return v === undefined ? undefined : v ? 1 : 0
}

function bytesOf(view: ArrayLike<number>, Type: Float32ArrayConstructor | Uint32ArrayConstructor | Int32ArrayConstructor): ArrayBuffer {
  const typed = view instanceof Type ? view : new Type(view as ArrayLike<number>)
  return typed.byteOffset === 0 && typed.byteLength === typed.buffer.byteLength
    ? typed.buffer as ArrayBuffer
    : typed.buffer.slice(typed.byteOffset, typed.byteOffset + typed.byteLength) as ArrayBuffer
}

interface ResolvedAttribute { name: string, size: number, data: ArrayBuffer }

const ATTRIBUTE_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/

function meshAttributes(mesh: string, attrs: MeshData['attributes'], vcount: number): ResolvedAttribute[] {
  if (!attrs) return []
  const names = Object.keys(attrs).sort()
  if (names.length > 7) throw new Error(`scene.mesh(${mesh})：自定义顶点属性最多 7 个，给了 ${names.length} 个`)
  return names.map(name => {
    if (!ATTRIBUTE_NAME.test(name) || name.startsWith('pot_') || name.startsWith('gl_')) throw new Error(`scene.mesh(${mesh})：顶点属性名 ${name} 不合法`)
    const v = attrs[name] as MeshAttribute | ArrayLike<number>
    const isArray = typeof (v as ArrayLike<number>).length === 'number'
    const data = isArray ? v as ArrayLike<number> : (v as MeshAttribute).data
    const size = isArray ? (vcount > 0 ? data.length / vcount : 0) : (v as MeshAttribute).size
    if (!(size >= 1 && size <= 4 && Number.isInteger(size))) throw new Error(`scene.mesh(${mesh})：顶点属性 ${name} 须为每顶点 1 到 4 个数`)
    if (data.length !== size * vcount) throw new Error(`scene.mesh(${mesh})：顶点属性 ${name} 须为每顶点 ${size} 个数，共 ${size * vcount} 个`)
    return { name, size, data: bytesOf(data, Float32Array) }
  })
}

function attributeKeyParts(attrs: ResolvedAttribute[]): ArrayBuffer[] {
  const out: ArrayBuffer[] = []
  for (const a of attrs) {
    const head = new Uint32Array(a.name.length + 1)
    head[0] = a.size
    for (let i = 0; i < a.name.length; i++) head[i + 1] = a.name.charCodeAt(i)
    out.push(head.buffer, a.data)
  }
  return out
}

/** 网格内容哈希（两路 32 位，按 4 字节字混合）：百万顶点量级几十毫秒，远快于上传 */
function contentKey(buffers: (ArrayBuffer | null)[]): string {
  let a = 0x811c9dc5 | 0
  let b = 0x9e3779b9 | 0
  let total = 0
  for (const buffer of buffers) {
    if (!buffer) {
      a = Math.imul(a ^ 0xff, 16777619)
      continue
    }
    const w = new Uint32Array(buffer, 0, buffer.byteLength >> 2)
    total += w.length
    a = Math.imul(a ^ w.length, 16777619)
    for (let i = 0; i < w.length; i++) {
      const x = w[i]
      a = Math.imul(a ^ x, 16777619)
      b = Math.imul(b ^ (x + 0x9e3779b9 + (b << 6) + (b >>> 2)), 0x85ebca6b)
    }
  }
  return `#${(a >>> 0).toString(16)}${(b >>> 0).toString(16)}.${total}`
}

export interface ObjectInfo {
  id: number
  name: string
  shape: string
  unit: string
}

export type UniformValue = number | boolean | string | ArrayLike<number> | Texture | null

/** 把 uniform 值写到运行时着色器绑定（对象 id，或 gfx.bake 的临时绑定 id） */
export function applyUniforms(engine: Host['engine'], id: number, values: Record<string, UniformValue>) {
  for (const name of Object.keys(values)) {
    const v = values[name]
    if (v === null || v === undefined) engine.gfxTexture(id, name, 0)
    else if (v instanceof Texture) engine.gfxTexture(id, name, v.id)
    else if (typeof v === 'number') engine.gfxUniform(id, name, 1, v, 0, 0, 0)
    else if (typeof v === 'boolean') engine.gfxUniform(id, name, 1, v ? 1 : 0, 0, 0, 0)
    else if (typeof v === 'string') {
      const [r, g, b, a] = parseColor(v)
      engine.gfxUniform(id, name, 4, srgbToLinear(r), srgbToLinear(g), srgbToLinear(b), a)
    } else if (v.length <= 4) engine.gfxUniform(id, name, v.length, v[0] ?? 0, v[1] ?? 0, v[2] ?? 0, v[3] ?? 0)
    else engine.gfxUniformArray(id, name, bytesOf(v, Float32Array))
  }
}

export interface ShaderBinding {
  uniforms?: Record<string, UniformValue>
  /** 混合：none（默认）、alpha、add 叠加、premultiplied 预乘 */
  blend?: 'none' | 'alpha' | 'add' | 'premultiplied'
  /** 绘制阶段：opaque 不透明之后、transparent 透明之后（由远到近）。默认按 blend 推断 */
  queue?: 'opaque' | 'transparent'
  /** 剔除：back（默认）、front、none */
  cull?: 'back' | 'front' | 'none'
  /** 写深度（opaque 默认 true，transparent 默认 false） */
  depthWrite?: boolean
  depthTest?: boolean
  /** 视锥剔除（默认 true，按网格包围盒）。顶点着色器重算位置（粒子、以相机为中心的效果）时设 false */
  frustumCull?: boolean
  /**
   * 深度偏移 [factor, units]（同 three polygonOffsetFactor/Units、GL glPolygonOffset，负数朝相机），
   * 贴花、共面叠加层防 z-fighting。各取整并限制在 -128 到 127；reversed Z 平台由宿主取反
   */
  polygonOffset?: [number, number]
  /** 用网格投射阴影（opaque 默认 true）；实例化绘制时不投射 */
  shadows?: boolean
  /** 绑定后立即设置实例缓冲，同 entity.instances(layout, data, count) */
  instances?: InstanceData
}

/** 实例数据：layout 按顺序列出每实例的属性与分量数（1 到 4），data 为交错的 Float32，count 省略时按长度推出 */
export interface InstanceData {
  layout: Record<string, number>
  data: ArrayLike<number>
  count?: number
}

const INSTANCE_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/

/** 校验实例布局，返回宿主格式（"名字:分量;..."）与每实例 float 数 */
export function instanceLayout(layout: Record<string, number>): { text: string, stride: number } {
  const names = Object.keys(layout ?? {})
  if (names.length === 0 || names.length > 11) throw new Error(`instances：layout 应有 1 到 11 项，给了 ${names.length} 项`)
  let stride = 0
  const parts: string[] = []
  for (const name of names) {
    if (!INSTANCE_NAME.test(name) || name.startsWith('pot_') || name.startsWith('gl_')) throw new Error(`instances：属性名无效 ${name}`)
    const size = layout[name]
    if (!Number.isInteger(size) || size < 1 || size > 4) throw new Error(`instances：${name} 的分量数应为 1 到 4，收到 ${size}`)
    parts.push(`${name}:${size}`)
    stride += size
  }
  return { text: parts.join(';'), stride }
}

function srgbToLinear(v: number) {
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
}

const colorCache = new Map<string, [number, number, number, number]>()

/** 射线（d 已归一化）与平面求交，返回距离；平行、背面（非双面）、在身后或超出 region 时返回 undefined */
export function rayPlane(o: Vec3, d: Vec3, plane: RayPlane): number | undefined {
  const n = plane.normal ?? [0, 1, 0]
  const p = plane.point ?? [0, plane.y ?? 0, 0]
  const denom = n[0] * d[0] + n[1] * d[1] + n[2] * d[2]
  if (Math.abs(denom) < 1e-9) return
  if (denom > 0 && !plane.twoSided) return
  const t = (n[0] * (p[0] - o[0]) + n[1] * (p[1] - o[1]) + n[2] * (p[2] - o[2])) / denom
  if (!(t > 0)) return
  const r = plane.region
  if (r) {
    const x = o[0] + d[0] * t, y = o[1] + d[1] * t, z = o[2] + d[2] * t
    if ((r.minX !== undefined && x < r.minX) || (r.maxX !== undefined && x > r.maxX)) return
    if ((r.minY !== undefined && y < r.minY) || (r.maxY !== undefined && y > r.maxY)) return
    if ((r.minZ !== undefined && z < r.minZ) || (r.maxZ !== undefined && z > r.maxZ)) return
  }
  return t
}

/** Color → sRGB 0..1 的 [r, g, b, a]；字符串规则见 color.ts，无法解析时抛出 TypeError */
export function parseColor(color: Color): [number, number, number, number] {
  if (typeof color === 'string') {
    let c = colorCache.get(color)
    if (!c) {
      c = parseColorString(color)
      if (colorCache.size > 2048) colorCache.clear()
      colorCache.set(color, c)
    }
    return [c[0], c[1], c[2], c[3]]
  }
  return [color[0], color[1], color[2], color[3] ?? 1]
}

export class Entity {
  constructor(private _scene: SceneService, readonly id: number, private _dispose?: () => any) {}

  private get _engine() {
    return this._scene.host.engine
  }

  get alive() {
    return this._engine.exists(this.id)
  }

  get position(): Vec3 {
    return this._engine.getVec(this.id, 'position')
  }

  set position(v: Vec3) {
    this._engine.setVec(this.id, 'position', v[0], v[1], v[2])
  }

  get rotation(): Vec3 {
    return this._engine.getVec(this.id, 'rotation')
  }

  set rotation(v: Vec3) {
    this._engine.setVec(this.id, 'rotation', v[0], v[1], v[2])
  }

  get scale(): Vec3 {
    return this._engine.getVec(this.id, 'scale')
  }

  set scale(v: Vec3) {
    this._engine.setVec(this.id, 'scale', v[0], v[1], v[2])
  }

  move(dx: number, dy: number, dz: number) {
    const [x, y, z] = this.position
    this.position = [x + dx, y + dy, z + dz]
    return this
  }

  lookAt(target: Vec3 | Entity) {
    const [x, y, z] = target instanceof Entity ? target.position : target
    this._engine.lookAt(this.id, x, y, z)
    return this
  }

  color(color: Color) {
    const [r, g, b, a] = parseColor(color)
    this._engine.setColor(this.id, r, g, b, a)
    return this
  }

  active(value: boolean) {
    this._engine.setActive(this.id, value)
    return this
  }

  /** 开关渲染。false 时碰撞体、子节点、灯光照常工作（只碰撞不渲染的命中体） */
  visible(value: boolean) {
    this._engine.visible(this.id, value)
    return this
  }

  /** 相对父节点的位置 */
  get localPosition(): Vec3 {
    return this._engine.getVec(this.id, 'localPosition')
  }

  set localPosition(v: Vec3) {
    this._engine.setVec(this.id, 'localPosition', v[0], v[1], v[2])
  }

  /** 相对父节点的欧拉角（度） */
  get localRotation(): Vec3 {
    return this._engine.getVec(this.id, 'localRotation')
  }

  set localRotation(v: Vec3) {
    this._engine.setVec(this.id, 'localRotation', v[0], v[1], v[2])
  }

  /** 材质参数（逐对象，不复制材质）。只设置传入的字段 */
  material(options: MaterialOptions) {
    const engine = this._engine
    if (options.mode !== undefined || options.shadows !== undefined || options.cull !== undefined) {
      const cull = options.cull === undefined ? -1 : CULL[options.cull]
      if (cull === undefined) throw new Error(`material.cull 只能是 back/front/none/default，收到 ${options.cull}`)
      engine.material(this.id, options.mode ?? '', options.shadows === undefined ? -1 : options.shadows ? 1 : 0, cull)
    }
    if (options.metallic !== undefined || options.smoothness !== undefined) {
      engine.surface(this.id, options.metallic ?? -1, options.smoothness ?? -1)
    }
    if (options.emission !== undefined) {
      const [r, g, b] = parseColor(options.emission)
      const k = options.emissionIntensity ?? 1
      engine.emission(this.id, r * k, g * k, b * k)
    }
    if (options.map !== undefined) engine.matTexture(this.id, 'map', options.map?.id ?? 0)
    if (options.normalMap !== undefined) engine.matTexture(this.id, 'normal', options.normalMap?.id ?? 0)
    if (options.maskMap !== undefined) engine.matTexture(this.id, 'mask', options.maskMap?.id ?? 0)
    if (options.tiling !== undefined || options.offset !== undefined) {
      const t = options.tiling ?? [1, 1]
      const o = options.offset ?? [0, 0]
      engine.matVector(this.id, '_Tiling', t[0], t[1], o[0], o[1])
    }
    if (options.uv !== undefined) engine.matFloat(this.id, '_UVMode', options.uv === 'world' ? 1 : options.uv === 'object' ? 2 : 0)
    if (options.normalScale !== undefined) engine.matFloat(this.id, '_BumpScale', options.normalScale)
    if (options.occlusion !== undefined) engine.matFloat(this.id, '_Occlusion', options.occlusion)
    if (options.wet !== undefined) engine.matFloat(this.id, '_Wet', options.wet)
    if (options.planar !== undefined) engine.matFloat(this.id, '_Planar', options.planar)
    if (options.cutoff !== undefined) engine.matFloat(this.id, '_Cutoff', options.cutoff)
    if (options.vertexColors !== undefined) engine.matFloat(this.id, '_VColor', options.vertexColors ? 1 : 0)
    return this
  }

  collider(enabled: boolean) {
    this._engine.collider(this.id, enabled)
    return this
  }

  /**
   * 改用运行时着色器绘制（ctx.gfx.shader 创建；也可传程序名）。null 恢复普通材质。
   * 网格仍由 Unity 渲染器投射阴影（shadows: false 关闭）；接收主光阴影用 <pot/lit> 的 pot_Lit / pot_Shadow。
   */
  shader(shader: { name: string } | string | null, options: ShaderBinding = {}) {
    const engine = this._engine
    if (!shader) {
      engine.gfxBind(this.id, '', 0, 0, 0)
      return this
    }
    if (this._scene.skinned.has(this.id)) throw new Error('蒙皮实体暂不支持运行时着色器（顶点由引擎蒙皮，运行时着色器拿不到蒙皮后的网格）')
    const blend = options.blend ?? 'none'
    const queue = options.queue ?? (blend === 'none' ? 'opaque' : 'transparent')
    const cull = options.cull ?? 'back'
    let flags = cull === 'front' ? 1 : cull === 'none' ? 2 : 0
    if (options.depthWrite ?? queue === 'opaque') flags |= 4
    flags |= ({ none: 0, alpha: 1, add: 2, premultiplied: 3 } as const)[blend] << 3
    if (options.depthTest === false) flags |= 128
    if (options.frustumCull === false) flags |= 256
    if (options.polygonOffset) {
      const [f, u] = options.polygonOffset
      if (!Number.isFinite(f) || !Number.isFinite(u)) throw new Error(`polygonOffset 须为两个有限数 [factor, units]，收到 ${options.polygonOffset}`)
      const i8 = (v: number) => Math.max(-128, Math.min(127, Math.round(v))) & 255
      flags |= (i8(f) << 16) | (i8(u) << 24)
    }
    const shadows = options.shadows ?? queue === 'opaque'
    engine.gfxBind(this.id, typeof shader === 'string' ? shader : shader.name, flags, queue === 'transparent' ? 1 : 0, shadows ? 1 : 0)
    if (options.uniforms) this.uniforms(options.uniforms)
    if (options.instances) this.instances(options.instances.layout, options.instances.data, options.instances.count)
    return this
  }

  /**
   * 实例化绘制（先调用 shader）：网格画 count 次，着色器里 gfx.shader({ instanced }) 声明的同名输入每实例读一次。
   * layout 如 { aOffset: 3, aColor: 4 }，data 按此顺序交错；data 可以是预分配的大数组，只上传前 count 个实例。
   * 实例化时不做视锥剔除、不投射网格阴影。传 null 或 count 0 恢复单次绘制
   */
  instances(layout: Record<string, number> | null, data?: ArrayLike<number>, count?: number) {
    const engine = this._engine
    if (!engine.gfxInstances) throw new Error('当前 Runner 不支持实例化（宿主缺少 gfxInstances），请更新 Runner')
    if (!layout || count === 0) {
      engine.gfxInstances(this.id, 0, '', new ArrayBuffer(0))
      return this
    }
    const { text, stride } = instanceLayout(layout)
    if (!data) throw new Error('instances：缺少 data')
    const n = count ?? Math.floor(data.length / stride)
    if (!Number.isInteger(n) || n < 0) throw new Error(`instances：count 无效 ${count}`)
    if (n * stride > data.length) throw new Error(`instances：${n} 个实例需要 ${n * stride} 个 float，data 只有 ${data.length} 个`)
    if (n === 0) {
      engine.gfxInstances(this.id, 0, '', new ArrayBuffer(0))
      return this
    }
    const err = engine.gfxInstances(this.id, n, text, bytesOf(data, Float32Array))
    if (err) throw new Error(`instances：${err}`)
    return this
  }

  /**
   * 设置运行时着色器的 uniform（先调用 shader）。数字、布尔、数组（矩阵按列主序）、颜色字符串（转为线性 rgba）、Texture；
   * 贴图传 null 解除。
   */
  uniforms(values: Record<string, UniformValue>) {
    applyUniforms(this._engine, this.id, values)
    return this
  }

  layer(layer: number) {
    this._engine.layer(this.id, layer)
    return this
  }

  /** 灯光强度（仅灯光对象）；单位与创建时的 units 一致 */
  intensity(value: number) {
    this._engine.lightIntensity(this.id, value * (this._scene.lightScale.get(this.id) ?? 1))
    return this
  }

  destroy() {
    if (this._dispose) return this._dispose()
    throw new Error('该对象不能销毁（例如主相机）')
  }
}

export class SceneService extends Service {
  /** id → 对象登记信息（只登记 pot 创建的对象） */
  readonly objects = new Map<number, ObjectInfo>()
  /** 蒙皮实体的 id */
  readonly skinned = new Set<number>()
  /** 灯光 id → 强度换算系数（units: 'three' 为 1/π） */
  readonly lightScale = new Map<number, number>()

  constructor(ctx: Context, readonly host: Host) {
    super(ctx, 'scene')
  }

  /** 主相机（不归任何插件所有，不能销毁） */
  get camera() {
    return new Entity(this, this.host.engine.cameraId())
  }

  background(color: Color) {
    const [r, g, b] = parseColor(color)
    this.host.engine.setBackground(r, g, b)
  }

  spawn(options: SpawnOptions = {}): Entity {
    const engine = this.host.engine
    const shape = options.shape ?? 'cube'
    const name = options.name ?? shape
    const unit = unitOf(this.ctx) ?? '(host)'
    const bones = options.bones
    if (bones && !shape.startsWith('mesh:')) throw new Error(`scene.spawn(${name})：bones 只能配 mesh: 形状`)
    let id = 0
    const dispose = this.ctx.effect(() => {
      id = engine.spawn(bones ? `skin:${shape.slice(5)}` : shape, name, options.parent?.id ?? 0)
      if (bones) {
        const ids = new Int32Array(bones.length)
        for (let i = 0; i < bones.length; i++) ids[i] = bones[i].id
        const error = engine.skin(id, ids.buffer as ArrayBuffer)
        if (error) {
          engine.destroy(id)
          throw new Error(`scene.spawn(${name})：${error}`)
        }
        this.skinned.add(id)
      }
      this.objects.set(id, { id, name, shape, unit })
      return () => {
        this.objects.delete(id)
        this.skinned.delete(id)
        this.lightScale.delete(id)
        engine.destroy(id)
      }
    }, `scene.spawn(${name})`)
    const entity = new Entity(this, id, dispose)
    if (options.parent) {
      if (options.position) entity.localPosition = options.position
      if (options.rotation) entity.localRotation = options.rotation
    } else {
      if (options.position) entity.position = options.position
      if (options.rotation) entity.rotation = options.rotation
    }
    if (options.scale !== undefined) {
      const s = options.scale
      entity.scale = typeof s === 'number' ? [s, s, s] : s
    }
    if (options.color) entity.color(options.color)
    if (options.material) entity.material(options.material)
    if (options.collider === false) entity.collider(false)
    if (options.layer !== undefined) entity.layer(options.layer)
    if (options.active === false) entity.active(false)
    if (options.visible === false) entity.visible(false)
    return entity
  }

  /**
   * 批量设置变换：一次跨语言调用写完一批实体（骨骼、成群的动态物体），比逐个设 position/rotation/scale 省得多。
   * data 每个实体 10 个数：位置 xyz、单位四元数 xyzw、缩放 xyz（引擎坐标系）。
   * targets 传 Int32Array（实体 id，建好后复用）时不产生分配；也可以传实体数组。
   * 世界空间下若同一批里有父子关系，父节点要排在子节点前面。返回实际写入的实体数（已销毁的跳过）
   */
  setTransforms(targets: Int32Array | ArrayLike<Entity | number>, data: Float32Array, options: TransformBatchOptions = {}): number {
    let ids: Int32Array
    if (targets instanceof Int32Array) ids = targets
    else {
      ids = new Int32Array(targets.length)
      for (let i = 0; i < targets.length; i++) {
        const t = targets[i]
        ids[i] = typeof t === 'number' ? t : t.id
      }
    }
    const count = options.count ?? Math.min(ids.length, Math.floor(data.length / 10))
    if (count <= 0) return 0
    if (count > ids.length || count * 10 > data.length) throw new Error(`scene.setTransforms：count ${count} 超出范围（${ids.length} 个实体，data 能容纳 ${Math.floor(data.length / 10)} 个）`)
    let flags = 0
    if (options.position !== false) flags |= 1
    if (options.rotation !== false) flags |= 2
    if (options.scale !== false) flags |= 4
    if (options.space === 'local') flags |= 8
    if (!(flags & 7)) return 0
    return this.host.engine.setTransforms(bytesOf(ids, Int32Array), bytesOf(data, Float32Array), count, flags)
  }

  light(options: LightOptions = {}): Entity {
    const entity = this.spawn({ shape: 'empty', name: options.name ?? `${options.type ?? 'directional'} light`, parent: options.parent, position: options.position, rotation: options.rotation })
    const [r, g, b] = parseColor(options.color ?? [1, 1, 1])
    const engine = this.host.engine
    const three = options.units === 'three'
    if (options.units !== undefined && options.units !== 'unity' && !three) throw new Error(`scene.light：未知的 units "${options.units}"，可用 unity / three`)
    const scale = three ? 1 / Math.PI : 1
    if (scale !== 1) this.lightScale.set(entity.id, scale)
    const range = options.range ?? (three && options.distance && options.distance > 0 ? options.distance : 10)
    engine.light(entity.id, options.type ?? 'directional', (options.intensity ?? 1) * scale, r, g, b, range)
    if (options.spotAngle !== undefined || options.shadows !== undefined) {
      const shadows = options.shadows === undefined ? -1 : options.shadows === 'none' ? 0 : options.shadows === 'hard' ? 1 : 2
      engine.lightOptions(entity.id, options.spotAngle ?? 0, shadows)
    }
    return entity
  }

  /** 主相机参数：视野（度）、近/远裁剪面 */
  view(options: ViewOptions) {
    this.host.engine.view(options.fov ?? 0, options.near ?? 0, options.far ?? 0)
  }

  /** 指数平方雾；density 为 0 或传 false 关闭。options 可加高度衰减与太阳散射 */
  fog(color: Color | false, density = 0.03, options?: FogOptions) {
    if (color === false) return this.host.engine.fog(0, 0, 0, 0)
    const [r, g, b] = parseColor(color)
    this.host.engine.fog(r, g, b, density)
    if (options) this._render('fog', { height: options.height, base: options.base, sun: options.sun })
  }

  /** 环境光：纯色，或 { sky, equator, ground } 三色；reflection 为环境反射强度（0 到 1） */
  ambient(color: Color | { sky: Color, equator: Color, ground: Color }, reflection = 0.3) {
    if (typeof color === 'object' && !Array.isArray(color)) {
      const [sr, sg, sb] = parseColor(color.sky)
      const [er, eg, eb] = parseColor(color.equator)
      const [gr, gg, gb] = parseColor(color.ground)
      return this.host.engine.ambientTrilight(sr, sg, sb, er, eg, eb, gr, gg, gb, reflection)
    }
    const [r, g, b] = parseColor(color as Color)
    this.host.engine.ambient(r, g, b, reflection)
  }

  private _render(kind: string, options: object) {
    const error = this.host.engine.render(kind, JSON.stringify(options))
    if (error) throw new Error(`scene.${kind}：${error}`)
  }

  /** 由像素创建贴图（随调用方插件卸载销毁） */
  texture(options: TextureOptions): Texture {
    const engine = this.host.engine
    const { width, height, data } = options
    if (data.length < width * height * 4) throw new Error(`scene.texture：数据长度 ${data.length} 小于 ${width}x${height}x4`)
    const wrap = options.wrap === 'clamp' ? 1 : 0
    const filter = options.filter === 'point' ? 0 : options.filter === 'bilinear' ? 1 : 2
    let id = 0
    const dispose = this.ctx.effect(() => {
      const view = data instanceof Uint8Array ? data : new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
      const buffer = view.byteOffset === 0 && view.byteLength === view.buffer.byteLength ? view.buffer : view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength)
      id = engine.texture(buffer as ArrayBuffer, width, height, !!options.linear, options.mipmaps !== false, wrap, filter, options.aniso ?? 8)
      return () => engine.destroyTexture(id)
    }, 'scene.texture')
    return new Texture(id, width, height, dispose)
  }

  /** Canvas 2D 画布（软件光栅化，文字由宿主栅格化）；canvas.texture() 转贴图，随调用方插件卸载销毁 */
  canvas(width: number, height: number): Canvas {
    const canvas = new Canvas(width, height, this.host)
    canvas.upload = (data, w, h, o) => this.texture({ ...o, data, width: w, height: h }) as any
    return canvas
  }

  /** 文字转贴图（系统中文字体），可贴在任意材质上（例如集装箱喷字、路牌） */
  text(options: TextTextureOptions): Texture {
    const engine = this.host.engine
    const width = options.width ?? 256
    const height = options.height ?? 64
    const json = JSON.stringify({
      text: options.text,
      width,
      height,
      size: options.size ?? Math.round(height * 0.7),
      color: rgb(options.color ?? [1, 1, 1]),
      background: rgb(options.background ?? [0, 0, 0, 0]),
      align: options.align === 'left' ? 0 : options.align === 'right' ? 2 : 1,
      bold: options.bold ? 1 : 0,
      letterSpacing: options.letterSpacing ?? 0,
    })
    let id = 0
    const dispose = this.ctx.effect(() => {
      id = engine.textTexture(json)
      return () => engine.destroyTexture(id)
    }, `scene.text(${options.text})`)
    return new Texture(id, width, height, dispose)
  }

  /**
   * 注册网格，之后用 spawn({ shape: 'mesh:名字' }) 创建（自带网格碰撞体）。同名覆盖。
   * 大网格给 options.key 并把 data 写成函数：热重载时内容没变就直接复用 Runner 里已有的网格。
   * 带 boneIndices 的网格用 spawn({ shape: 'mesh:名字', bones }) 建成蒙皮网格。返回顶点数
   */
  mesh(name: string, data: MeshData | (() => MeshData), options: MeshOptions = {}): number {
    const engine = this.host.engine
    let key = typeof options.key === 'string' ? options.key : ''
    if (key) {
      const cached = engine.meshCached(name, key)
      if (cached >= 0) return cached
    }
    const d = typeof data === 'function' ? data() : data
    const f = (v?: ArrayLike<number>) => v ? bytesOf(v, Float32Array) : null
    const positions = f(d.positions)!
    const normals = f(d.normals)
    const uvs = f(d.uvs)
    const colors = f(d.colors)
    const indices = bytesOf(d.indices, Uint32Array)
    const boneIndices = d.boneIndices ? bytesOf(d.boneIndices, Int32Array) : null
    const boneWeights = f(d.boneWeights)
    const bindPoses = f(d.bindPoses)
    const tangents = f(d.tangents)
    if (!boneIndices && (boneWeights || bindPoses)) throw new Error(`scene.mesh(${name})：boneWeights、bindPoses 需要和 boneIndices 一起给`)
    if (tangents && tangents.byteLength !== positions.byteLength / 3 * 4) throw new Error(`scene.mesh(${name})：tangents 须为每顶点 4 个数（xyzw），共 ${positions.byteLength / 12 * 4} 个`)
    const vcount = positions.byteLength / 12
    const attributes = meshAttributes(name, d.attributes, vcount)
    if (attributes.length && boneIndices) throw new Error(`scene.mesh(${name})：自定义顶点属性不能与蒙皮同时使用`)
    if (d.colorSpace !== undefined && d.colorSpace !== 'srgb' && d.colorSpace !== 'linear') throw new Error(`scene.mesh(${name})：colorSpace 只能是 srgb 或 linear`)
    const linearColors = !!colors && d.colorSpace === 'linear'
    if (options.key === true) {
      key = contentKey([positions, normals, uvs, colors, indices, boneIndices, boneWeights, bindPoses, tangents, ...attributeKeyParts(attributes), ...(linearColors ? [new Uint32Array([0x4c494e]).buffer] : [])])
      const cached = engine.meshCached(name, key)
      if (cached >= 0) return cached
    }
    const count = engine.mesh(name, positions, normals, uvs, linearColors ? null : colors, indices, key)
    if (linearColors) {
      const error = engine.meshColors(name, colors!, true)
      if (error) throw new Error(`scene.mesh(${name})：${error}`)
    }
    if (tangents) {
      const error = engine.meshTangents(name, tangents)
      if (error) throw new Error(`scene.mesh(${name})：${error}`)
    }
    attributes.forEach((a, i) => {
      const error = engine.meshAttribute(name, i + 1, a.name, a.size, a.data)
      if (error) throw new Error(`scene.mesh(${name})：${error}`)
    })
    if (boneIndices) {
      const error = engine.meshSkin(name, boneIndices, boneWeights, bindPoses)
      if (error) throw new Error(`scene.mesh(${name})：${error}`)
    }
    return count
  }

  /** 后处理（色调映射、曝光、调色、泛光、暗角、颗粒、色差、SSAO、抗锯齿）；只改传入的字段 */
  post(options: PostOptions) {
    const tonemap = options.tonemap === undefined ? undefined : options.tonemap === 'none' ? 0 : options.tonemap === 'neutral' ? 1 : 2
    const antialias = options.antialias === undefined ? undefined : options.antialias === 'none' ? 0 : options.antialias === 'fxaa' ? 1 : 2
    this._render('post', {
      ...options,
      enabled: bool(options.enabled),
      tonemap,
      antialias,
      filter: rgb(options.filter),
      bloomTint: rgb(options.bloomTint),
      vignetteColor: rgb(options.vignetteColor),
    })
  }

  /** 程序化天空盒（渐变、日轮光晕、云、地平线雾），太阳方向跟随主方向光；同时捕捉环境反射 */
  sky(options: SkyOptions) {
    this._render('sky', {
      ...options,
      zenith: rgb(options.zenith),
      horizon: rgb(options.horizon),
      horizonAway: rgb(options.horizonAway),
      ground: rgb(options.ground),
      sun: rgb(options.sun, options.sunIntensity ?? 1),
      cloudColor: rgb(options.cloudColor),
      reflection: bool(options.reflection),
      ambient: bool(options.ambient),
      sunIntensity: undefined,
    })
  }

  /** 天气：全局湿润、积水、雨丝与波纹 */
  weather(options: WeatherOptions) {
    this._render('weather', { ...options, rainColor: rgb(options.rainColor) })
  }

  /** 平面反射（湿地面、积水、水面）。材质需设置 planar */
  reflection(options: ReflectionOptions) {
    const exclude = options.exclude?.reduce((m, l) => m | (1 << l), 0)
    this._render('reflection', { ...options, enabled: bool(options.enabled), shadows: bool(options.shadows), exclude })
  }

  /** 画质参数（渲染缩放、阴影距离/分辨率/级联、MSAA、HDR） */
  quality(options: QualityOptions) {
    this._render('quality', { ...options, hdr: bool(options.hdr), cascades: options.shadowCascades, shadowCascades: undefined })
  }

  /** 太阳或天空改变后重新捕捉环境反射 */
  refreshEnvironment() {
    this._render('refresh', {})
  }

  /** 粒子迸发（枪口火花、弹着点火星、烟尘）。不需要销毁，生命周期结束自动消失 */
  burst(options: BurstOptions) {
    this.host.engine.burst(JSON.stringify({
      kind: options.kind ?? 'spark',
      pos: options.position,
      dir: options.direction,
      color: rgb(options.color ?? [1, 0.8, 0.5], options.intensity ?? 1),
      count: options.count,
      speed: options.speed,
      speedJitter: options.speedJitter,
      spread: options.spread,
      size: options.size,
      sizeJitter: options.sizeJitter,
      life: options.life,
      lifeJitter: options.lifeJitter,
    }))
  }

  /** 射线检测（命中图元自带的碰撞体，以及 options.planes 中的无限平面）。direction 不必归一化 */
  raycast(origin: Vec3, direction: Vec3, options: RaycastOptions = {}): RaycastHit | null {
    const hit = this.host.engine.raycast(origin[0], origin[1], origin[2], direction[0], direction[1], direction[2], options.maxDistance ?? 0, options.mask ?? 0)
    let best: RaycastHit | null = hit ? { ...hit, entity: hit.id > 0 ? new Entity(this, hit.id) : undefined } : null
    const planes = options.planes
    if (!planes?.length) return best
    const len = Math.hypot(direction[0], direction[1], direction[2])
    if (!(len > 0)) return best
    const d: Vec3 = [direction[0] / len, direction[1] / len, direction[2] / len]
    const max = options.maxDistance && options.maxDistance > 0 ? options.maxDistance : Infinity
    for (let i = 0; i < planes.length; i++) {
      const t = rayPlane(origin, d, planes[i])
      if (t === undefined || t > max || (best && best.distance <= t)) continue
      const pl = planes[i]
      const nl = pl.normal ? Math.hypot(pl.normal[0], pl.normal[1], pl.normal[2]) || 1 : 1
      let n: Vec3 = pl.normal ? [pl.normal[0] / nl, pl.normal[1] / nl, pl.normal[2] / nl] : [0, 1, 0]
      if (n[0] * d[0] + n[1] * d[1] + n[2] * d[2] > 0) n = [-n[0], -n[1], -n[2]]
      best = { id: -1, point: [origin[0] + d[0] * t, origin[1] + d[1] * t, origin[2] + d[2] * t], normal: n, distance: t, plane: i, tag: pl.tag }
    }
    return best
  }

  find(name: string): Entity | undefined {
    for (const info of this.objects.values()) {
      if (info.name === name) return new Entity(this, info.id)
    }
  }

  list(unit?: string): ObjectInfo[] {
    const result = [...this.objects.values()]
    return unit ? result.filter((o) => o.unit === unit) : result
  }
}
