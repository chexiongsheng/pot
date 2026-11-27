/**
 * Web 宿主的场景数据（004 第 20.3 节）：纯 JS 对象表，语义照 PotScene.cs。
 * 不碰 DOM 与 WebGL，Node 测试可直接使用；gl.ts 每帧读它渲染。
 * 约定：相机 id 为 1，spawn 的 id 从 2 开始；颜色存 sRGB；旋转存四元数；缩放始终是局部缩放。
 */
import {
  M4, Q4, V3, composeTRS, eulerToQuaternion, invert, lookRotation, multiply, quatConjugate, quatMultiply, quatNormalize,
  quatToEuler, transformPoint,
} from './math'
import { WebMeshes } from './mesh'
import { WebTextures } from './texture'

export const CAMERA_ID = 1

export type LightType = 'directional' | 'point' | 'spot'

export interface WebLight {
  type: LightType
  intensity: number
  /** sRGB */
  color: V3
  range: number
  /** 聚光全角（度） */
  spotAngle: number
  /** 0 无、1 硬、2 软 */
  shadows: number
}

export interface WebMaterial {
  /** lit / lit-fade / unlit / unlit-fade / additive */
  mode: string
  castShadows: boolean
  /** undefined 表示按模式默认；none / front / back */
  cull?: 'none' | 'front' | 'back'
  metallic: number
  smoothness: number
  /** sRGB，可大于 1 */
  emission: V3
}

export interface WebObject {
  id: number
  name: string
  /** cube/sphere/capsule/cylinder/plane/quad/empty、mesh:名字、skin:名字；相机为 camera */
  shape: string
  /** 0 表示根 */
  parent: number
  children: number[]
  /** 局部位置、旋转、缩放 */
  pos: V3
  rot: Q4
  scale: V3
  /** sRGB 加 alpha */
  color: [number, number, number, number]
  active: boolean
  visible: boolean
  light?: WebLight
  mat: WebMaterial
  /** 其余宿主扩展状态（贴图、着色器绑定、碰撞体等，web-2 起使用） */
  ext: Record<string, any>
  /** 世界矩阵缓存及其版本 */
  _world: M4
  _wv: number
  _wrot: Q4
}

export interface WebEnvironment {
  background: V3
  fov: number
  near: number
  far: number
  fog: { color: V3; density: number }
  ambient: { mode: 'flat' | 'trilight'; color: V3; sky: V3; equator: V3; ground: V3; reflection: number }
  /** 主平行光（RenderSettings.sun）；0 表示无 */
  sun: number
}

export function defaultEnvironment(): WebEnvironment {
  return {
    background: [0.1, 0.1, 0.12],
    fov: 60,
    near: 0.3,
    far: 1000,
    fog: { color: [0, 0, 0], density: 0 },
    ambient: { mode: 'flat', color: [0.35, 0.35, 0.38], sky: [0.35, 0.35, 0.38], equator: [0.35, 0.35, 0.38], ground: [0.35, 0.35, 0.38], reflection: 1 },
    sun: 0,
  }
}

function defaultMaterial(): WebMaterial {
  return { mode: 'lit', castShadows: true, metallic: 0, smoothness: 0.5, emission: [0, 0, 0] }
}

function makeObject(id: number, shape: string, name: string, parent: number): WebObject {
  return {
    id, name, shape, parent, children: [],
    pos: [0, 0, 0], rot: [0, 0, 0, 1], scale: [1, 1, 1],
    color: [1, 1, 1, 1], active: true, visible: true,
    mat: defaultMaterial(), ext: {},
    _world: new Float32Array(16), _wv: -1, _wrot: [0, 0, 0, 1],
  }
}

/** ArrayBuffer 或视图 → 指定类型的视图（不复制） */
function viewOf<T extends Int32Array | Float32Array>(buf: ArrayBuffer | ArrayBufferView, Ctor: { new (b: ArrayBuffer, o: number, n: number): T; BYTES_PER_ELEMENT: number }): T {
  if (ArrayBuffer.isView(buf)) return new Ctor(buf.buffer as ArrayBuffer, buf.byteOffset, Math.floor(buf.byteLength / Ctor.BYTES_PER_ELEMENT))
  return new Ctor(buf, 0, Math.floor(buf.byteLength / Ctor.BYTES_PER_ELEMENT))
}

export class WebScene {
  readonly objects = new Map<number, WebObject>()
  /** 注册的网格（mesh:名字、skin:名字） */
  readonly meshes = new WebMeshes()
  /** 由 JS 像素创建的贴图（texture 返回的 id） */
  readonly textures = new WebTextures()
  env: WebEnvironment = defaultEnvironment()
  /** 任一局部变换或层级变化时加一，世界矩阵缓存据此失效 */
  version = 0
  /** 告警出口（宿主接到日志） */
  warn: (text: string) => void = () => {}
  private nextId = CAMERA_ID + 1

  constructor() {
    this.objects.set(CAMERA_ID, this.makeCamera())
  }

  private makeCamera(): WebObject {
    const cam = makeObject(CAMERA_ID, 'camera', 'Main Camera', 0)
    cam.pos = [0, 1, -10]
    return cam
  }

  get camera(): WebObject {
    return this.objects.get(CAMERA_ID)!
  }

  get(id: number): WebObject | undefined {
    return this.objects.get(id)
  }

  // ---- 对象 ----

  spawn(shape: string, name: string, parent: number): number {
    const id = this.nextId++
    const p = parent ? this.objects.get(parent) : undefined
    let s = shape
    if (shape.startsWith('mesh:') || shape.startsWith('skin:')) {
      // 与 PotScene.Spawn 一致：未注册的网格建空对象并告警
      const meshName = shape.slice(5)
      if (!this.meshes.get(meshName)) {
        this.warn(`[pot] 未注册的网格：${meshName}`)
        s = 'empty'
      }
    }
    const o = makeObject(id, s, name || `${shape}#${id}`, p ? p.id : 0)
    this.objects.set(id, o)
    if (p) p.children.push(id)
    this.version++
    return id
  }

  /** 连同子对象一起删除；相机不能删 */
  destroy(id: number): void {
    if (id === CAMERA_ID) return
    const o = this.objects.get(id)
    if (!o) return
    const p = o.parent ? this.objects.get(o.parent) : undefined
    if (p) {
      const i = p.children.indexOf(id)
      if (i >= 0) p.children.splice(i, 1)
    }
    this.removeTree(o)
    if (this.env.sun === id || !this.objects.has(this.env.sun)) this.env.sun = 0
    this.version++
  }

  private removeTree(o: WebObject) {
    for (const c of o.children) {
      const child = this.objects.get(c)
      if (child) this.removeTree(child)
    }
    this.objects.delete(o.id)
  }

  exists(id: number): boolean {
    return this.objects.has(id)
  }

  /** 给 spawn('skin:名字') 的对象绑定骨骼（PotScene.Skin）；成功返回空串 */
  skin(id: number, boneIds: ArrayBuffer | ArrayBufferView | null): string {
    const o = this.objects.get(id)
    const mesh = o && o.shape.startsWith('skin:') ? this.meshes.get(o.shape.slice(5)) : undefined
    if (!o || !mesh) return '对象不是蒙皮网格'
    const need = mesh.skin ? mesh.skin.bindPoses.length / 16 : 0
    if (need === 0) return '网格没有骨骼数据（注册网格时需要 boneIndices）'
    const b = boneIds && boneIds.byteLength >= 4 ? viewOf(boneIds, Int32Array) : null
    if (!b || b.length < need) return `骨骼数量不足：网格需要 ${need} 根，只给了 ${b ? b.length : 0} 根`
    for (let i = 0; i < b.length; i++) if (!this.objects.has(b[i])) return `第 ${i} 根骨骼不存在`
    o.ext.bones = Array.from(b)
    // 物体空间三平面改用静止姿态采样（PotLit 的 _Rest）
    ;(o.ext.floats ??= {})._Rest = 1
    return ''
  }

  /** 由 pot 创建的存活对象数（不含相机） */
  count(): number {
    return this.objects.size - 1
  }

  /** 冷重启：删除全部对象，相机与环境回到默认（PotScene.Clear） */
  clear(): void {
    this.objects.clear()
    this.objects.set(CAMERA_ID, this.makeCamera())
    this.env = defaultEnvironment()
    this.meshes.clear()
    this.textures.clear()
    this.version++
  }

  setActive(id: number, active: boolean): void {
    const o = this.objects.get(id)
    if (o) o.active = active
  }

  visible(id: number, visible: boolean): void {
    const o = this.objects.get(id)
    if (o) o.visible = visible
  }

  /** 自身与所有祖先都 active（activeInHierarchy） */
  activeInHierarchy(o: WebObject): boolean {
    for (let cur: WebObject | undefined = o; cur; cur = cur.parent ? this.objects.get(cur.parent) : undefined) {
      if (!cur.active) return false
    }
    return true
  }

  setColor(id: number, r: number, g: number, b: number, a: number): void {
    const o = this.objects.get(id)
    if (!o) return
    o.color = [r, g, b, a]
    if (o.light) o.light.color = [r, g, b]
  }

  // ---- 变换 ----

  /** 世界矩阵（带缓存） */
  worldMatrix(o: WebObject): M4 {
    if (o._wv === this.version) return o._world
    const p = o.parent ? this.objects.get(o.parent) : undefined
    composeTRS(o.pos, o.rot, o.scale, o._world)
    if (p) {
      multiply(this.worldMatrix(p), o._world, o._world)
      const pr = this.worldRotation(p)
      o._wrot = quatNormalize(quatMultiply(pr, o.rot))
    } else {
      o._wrot = [o.rot[0], o.rot[1], o.rot[2], o.rot[3]]
    }
    o._wv = this.version
    return o._world
  }

  worldRotation(o: WebObject): Q4 {
    this.worldMatrix(o)
    return o._wrot
  }

  worldPosition(o: WebObject): V3 {
    const m = this.worldMatrix(o)
    return [m[12], m[13], m[14]]
  }

  private parentOf(o: WebObject): WebObject | undefined {
    return o.parent ? this.objects.get(o.parent) : undefined
  }

  setWorldPosition(o: WebObject, x: number, y: number, z: number): void {
    const p = this.parentOf(o)
    if (p) {
      const inv = invert(this.worldMatrix(p))
      o.pos = transformPoint(inv, x, y, z)
    } else {
      o.pos = [x, y, z]
    }
    this.version++
  }

  setWorldRotation(o: WebObject, q: ArrayLike<number>): void {
    const p = this.parentOf(o)
    o.rot = quatNormalize(p ? quatMultiply(quatConjugate(this.worldRotation(p)), q) : q)
    this.version++
  }

  setVec(id: number, prop: string, x: number, y: number, z: number): void {
    const o = this.objects.get(id)
    if (!o) return
    switch (prop) {
      case 'position': this.setWorldPosition(o, x, y, z); break
      case 'rotation': this.setWorldRotation(o, eulerToQuaternion(x, y, z)); break
      case 'scale': o.scale = [x, y, z]; this.version++; break
      case 'localPosition': o.pos = [x, y, z]; this.version++; break
      case 'localRotation': o.rot = eulerToQuaternion(x, y, z); this.version++; break
    }
  }

  getVec(id: number, prop: string): V3 {
    const o = this.objects.get(id)
    if (!o) return [0, 0, 0]
    switch (prop) {
      case 'position': return this.worldPosition(o)
      case 'rotation': return quatToEuler(this.worldRotation(o))
      case 'scale': return [o.scale[0], o.scale[1], o.scale[2]]
      case 'localPosition': return [o.pos[0], o.pos[1], o.pos[2]]
      case 'localRotation': return quatToEuler(o.rot)
    }
    return [0, 0, 0]
  }

  /** Transform.LookAt(target)，世界向上为 +Y */
  lookAt(id: number, x: number, y: number, z: number): void {
    const o = this.objects.get(id)
    if (!o) return
    const p = this.worldPosition(o)
    const f: V3 = [x - p[0], y - p[1], z - p[2]]
    if (Math.hypot(f[0], f[1], f[2]) < 1e-9) return
    this.setWorldRotation(o, lookRotation(f, [0, 1, 0]))
  }

  /**
   * 批量变换（PotScene.SetTransforms）：每个对象 10 个 Float32（位置 xyz、四元数 xyzw、缩放 xyz）。
   * flags：bit0 位置、bit1 旋转、bit2 缩放（始终局部）、bit3 位置与旋转按局部空间。返回写入数
   */
  setTransforms(ids: ArrayBuffer | ArrayBufferView, data: ArrayBuffer | ArrayBufferView, count: number, flags: number): number {
    if (!ids || !data || count <= 0) return 0
    const iv = viewOf(ids, Int32Array)
    const dv = viewOf(data, Float32Array)
    count = Math.min(count, iv.length, Math.floor(dv.length / 10))
    const pos = (flags & 1) !== 0, rot = (flags & 2) !== 0, scale = (flags & 4) !== 0, local = (flags & 8) !== 0
    let done = 0
    for (let i = 0; i < count; i++) {
      const o = this.objects.get(iv[i])
      if (!o) continue
      const at = i * 10
      if (pos) {
        if (local) o.pos = [dv[at], dv[at + 1], dv[at + 2]]
        else this.setWorldPosition(o, dv[at], dv[at + 1], dv[at + 2])
      }
      if (rot) {
        const q: Q4 = [dv[at + 3], dv[at + 4], dv[at + 5], dv[at + 6]]
        if (local) o.rot = quatNormalize(q)
        else this.setWorldRotation(o, q)
      }
      if (scale) o.scale = [dv[at + 7], dv[at + 8], dv[at + 9]]
      this.version++
      done++
    }
    return done
  }

  // ---- 灯光 ----

  light(id: number, type: string, intensity: number, r: number, g: number, b: number, range: number): void {
    const o = this.objects.get(id)
    if (!o) return
    const t: LightType = type === 'point' ? 'point' : type === 'spot' ? 'spot' : 'directional'
    const l = o.light ?? { type: t, intensity: 1, color: [1, 1, 1], range: 10, spotAngle: 30, shadows: 0 }
    l.type = t
    l.intensity = intensity
    l.color = [r, g, b]
    if (range > 0) l.range = range
    if (t === 'directional') {
      l.shadows = 2
      if (!this.env.sun || !this.objects.has(this.env.sun)) this.env.sun = id
    }
    o.light = l
  }

  lightOptions(id: number, spotAngle: number, shadows: number): void {
    const l = this.objects.get(id)?.light
    if (!l) return
    if (spotAngle > 0) l.spotAngle = spotAngle
    if (shadows >= 0) l.shadows = shadows
  }

  lightIntensity(id: number, intensity: number): void {
    const l = this.objects.get(id)?.light
    if (l) l.intensity = intensity
  }

  /** 主平行光：RenderSettings.sun（存在且启用时），否则取最亮的启用平行光 */
  mainLight(): WebObject | undefined {
    const sun = this.env.sun ? this.objects.get(this.env.sun) : undefined
    if (sun?.light && sun.light.type === 'directional' && this.activeInHierarchy(sun)) return sun
    let best: WebObject | undefined
    for (const o of this.objects.values()) {
      if (o.light?.type === 'directional' && this.activeInHierarchy(o) && (!best || o.light.intensity > best.light!.intensity)) best = o
    }
    return best
  }

  /** 启用的灯光（含主光） */
  lights(): WebObject[] {
    const out: WebObject[] = []
    for (const o of this.objects.values()) if (o.light && this.activeInHierarchy(o)) out.push(o)
    return out
  }

  // ---- 材质 ----

  material(id: number, mode: string, castShadows: number, cull: number): void {
    const o = this.objects.get(id)
    if (!o) return
    if (mode) o.mat.mode = mode
    if (castShadows >= 0) o.mat.castShadows = castShadows !== 0
    if (cull >= 0) o.mat.cull = cull === 3 ? undefined : (['none', 'front', 'back'] as const)[cull]
  }

  surface(id: number, metallic: number, smoothness: number): void {
    const o = this.objects.get(id)
    if (!o) return
    if (metallic >= 0) o.mat.metallic = metallic
    if (smoothness >= 0) o.mat.smoothness = smoothness
  }

  emission(id: number, r: number, g: number, b: number): void {
    const o = this.objects.get(id)
    if (o) o.mat.emission = [r, g, b]
  }

  /** 有渲染器的对象（PotScene 里 GetComponent<Renderer>() 非空） */
  private rendererOf(id: number): WebObject | undefined {
    const o = this.objects.get(id)
    return o && o.id !== CAMERA_ID && o.shape !== 'empty' ? o : undefined
  }

  /**
   * 绑定贴图（PotScene.MatTexture）：map 基础色（0 回到白贴图）、normal 法线（同时设 _HasBump）、
   * mask 遮罩（同时设 _HasMask）、其余以 _ 开头的名字原样记录。状态存在 o.ext.textures / o.ext.floats
   */
  matTexture(id: number, slot: string, tex: number): void {
    const o = this.rendererOf(id)
    if (!o) return
    const t = tex ? this.textures.get(tex) : undefined
    const texs: Record<string, number> = (o.ext.textures ??= {})
    const floats: Record<string, number> = (o.ext.floats ??= {})
    switch (slot) {
      case 'map':
        texs.map = t ? t.id : 0
        break
      case 'normal':
        if (t) texs.normal = t.id
        floats._HasBump = t ? 1 : 0
        break
      case 'mask':
        if (t) texs.mask = t.id
        floats._HasMask = t ? 1 : 0
        break
      default:
        if (t) texs[slot] = t.id
    }
  }

  /** 任意浮点属性（PotScene.MatFloat）；_Metallic、_Glossiness 与 surface 写同一处 */
  matFloat(id: number, prop: string, value: number): void {
    const o = this.rendererOf(id)
    if (!o || !prop) return
    if (prop === '_Metallic') o.mat.metallic = value
    else if (prop === '_Glossiness') o.mat.smoothness = value
    else (o.ext.floats ??= {})[prop] = value
  }

  /** 任意向量属性（PotScene.MatVector），例如 _Tiling（xy 缩放、zw 偏移） */
  matVector(id: number, prop: string, x: number, y: number, z: number, w: number): void {
    const o = this.rendererOf(id)
    if (!o || !prop) return
    ;(o.ext.vectors ??= {})[prop] = [x, y, z, w]
  }

  // ---- 相机与环境 ----

  setBackground(r: number, g: number, b: number): void {
    this.env.background = [r, g, b]
  }

  view(fov: number, near: number, far: number): void {
    if (fov > 0) this.env.fov = fov
    if (near > 0) this.env.near = near
    if (far > 0) this.env.far = far
  }

  fog(r: number, g: number, b: number, density: number): void {
    this.env.fog = { color: [r, g, b], density: Math.max(0, density) }
  }

  ambient(r: number, g: number, b: number, reflection: number): void {
    const a = this.env.ambient
    a.mode = 'flat'
    a.color = [r, g, b]
    if (reflection >= 0) a.reflection = Math.min(1, reflection)
  }

  ambientTrilight(sr: number, sg: number, sb: number, er: number, eg: number, eb: number, gr: number, gg: number, gb: number, reflection: number): void {
    const a = this.env.ambient
    a.mode = 'trilight'
    a.sky = [sr, sg, sb]
    a.equator = [er, eg, eb]
    a.ground = [gr, gg, gb]
    if (reflection >= 0) a.reflection = Math.min(1, reflection)
  }

  /** 渲染列表：在层级中启用、visible 且有可画形状的对象 */
  renderables(): WebObject[] {
    const out: WebObject[] = []
    for (const o of this.objects.values()) {
      if (o.id === CAMERA_ID || o.shape === 'empty' || !o.visible) continue
      if (this.activeInHierarchy(o)) out.push(o)
    }
    return out
  }
}
