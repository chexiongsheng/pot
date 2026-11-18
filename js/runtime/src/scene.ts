/**
 * scene：场景对象。游戏代码只拿 Entity 句柄（内部是数字 id），不直接接触引擎对象。
 * spawn 出来的对象挂在调用方 fiber 的 effect 上：插件卸载/热重载时自动销毁。
 * 需要跨重载保留的东西请存进 state（位置、血量……），重建时据此恢复。
 */
import { Context, Service } from 'cordis'
import type { Host, Vec3 } from './host'
import { unitOf } from './units'

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

/** 贴图句柄（scene.texture / scene.text 创建，随创建它的插件卸载而销毁） */
export class Texture {
  constructor(readonly id: number, readonly width: number, readonly height: number, private _dispose?: () => any) {}
  destroy() {
    return this._dispose?.()
  }
}

export interface MaterialOptions {
  mode?: MaterialMode
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
}

export interface LightOptions {
  type?: 'directional' | 'point' | 'spot'
  name?: string
  intensity?: number
  color?: Color
  range?: number
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
}

export interface RaycastHit {
  /** 命中对象 id；命中非 pot 对象时为 -1 */
  id: number
  entity?: Entity
  point: Vec3
  normal: Vec3
  distance: number
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
  /** RGBA（sRGB 0 到 1） */
  colors?: ArrayLike<number>
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

function bytesOf(view: ArrayLike<number>, Type: Float32ArrayConstructor | Uint32ArrayConstructor): ArrayBuffer {
  const typed = view instanceof Type ? view : new Type(view as ArrayLike<number>)
  return typed.byteOffset === 0 && typed.byteLength === typed.buffer.byteLength
    ? typed.buffer as ArrayBuffer
    : typed.buffer.slice(typed.byteOffset, typed.byteOffset + typed.byteLength) as ArrayBuffer
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
  /** 用网格投射阴影（opaque 默认 true） */
  shadows?: boolean
}

function srgbToLinear(v: number) {
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
}

export function parseColor(color: Color): [number, number, number, number] {
  if (typeof color === 'string') {
    const hex = color.replace('#', '')
    const full = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex
    const n = parseInt(full.slice(0, 6), 16)
    const a = full.length >= 8 ? parseInt(full.slice(6, 8), 16) / 255 : 1
    return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255, a]
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
    if (options.mode !== undefined || options.shadows !== undefined) {
      engine.material(this.id, options.mode ?? '', options.shadows === undefined ? -1 : options.shadows ? 1 : 0)
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
    const blend = options.blend ?? 'none'
    const queue = options.queue ?? (blend === 'none' ? 'opaque' : 'transparent')
    const cull = options.cull ?? 'back'
    let flags = cull === 'front' ? 1 : cull === 'none' ? 2 : 0
    if (options.depthWrite ?? queue === 'opaque') flags |= 4
    flags |= ({ none: 0, alpha: 1, add: 2, premultiplied: 3 } as const)[blend] << 3
    if (options.depthTest === false) flags |= 128
    if (options.frustumCull === false) flags |= 256
    const shadows = options.shadows ?? queue === 'opaque'
    engine.gfxBind(this.id, typeof shader === 'string' ? shader : shader.name, flags, queue === 'transparent' ? 1 : 0, shadows ? 1 : 0)
    if (options.uniforms) this.uniforms(options.uniforms)
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

  /** 灯光强度（仅灯光对象） */
  intensity(value: number) {
    this._engine.lightIntensity(this.id, value)
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
    let id = 0
    const dispose = this.ctx.effect(() => {
      id = engine.spawn(shape, name, options.parent?.id ?? 0)
      this.objects.set(id, { id, name, shape, unit })
      return () => {
        this.objects.delete(id)
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
    return entity
  }

  light(options: LightOptions = {}): Entity {
    const entity = this.spawn({ shape: 'empty', name: options.name ?? `${options.type ?? 'directional'} light`, parent: options.parent, position: options.position, rotation: options.rotation })
    const [r, g, b] = parseColor(options.color ?? [1, 1, 1])
    const engine = this.host.engine
    engine.light(entity.id, options.type ?? 'directional', options.intensity ?? 1, r, g, b, options.range ?? 10)
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

  /** 注册网格，之后用 spawn({ shape: 'mesh:名字' }) 创建（自带网格碰撞体）。同名覆盖 */
  mesh(name: string, data: MeshData): number {
    const f = (v?: ArrayLike<number>) => v ? bytesOf(v, Float32Array) : null
    return this.host.engine.mesh(name, f(data.positions)!, f(data.normals), f(data.uvs), f(data.colors), bytesOf(data.indices, Uint32Array))
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

  /** 射线检测（命中图元自带的碰撞体）。direction 不必归一化 */
  raycast(origin: Vec3, direction: Vec3, options: RaycastOptions = {}): RaycastHit | null {
    const hit = this.host.engine.raycast(origin[0], origin[1], origin[2], direction[0], direction[1], direction[2], options.maxDistance ?? 0, options.mask ?? 0)
    if (!hit) return null
    return { ...hit, entity: hit.id > 0 ? new Entity(this, hit.id) : undefined }
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
