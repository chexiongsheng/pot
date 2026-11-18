/**
 * 原版关卡适配层：用材质令牌、碰撞收集器和空场景运行机械移植的原版关卡（./orig/port.ts），
 * 产出 Runner 可用的数据：按材质合并好的静态网格、需要逐帧同步的动态网格与点光源、碰撞盒和玩法点。
 *
 * 坐标仍是原版 Three.js 右手系；网格经 toMesh() 翻转，碰撞盒与点位用 toUnity* 转换。
 * 构建不依赖 ctx（材质只是令牌），world 负责把令牌解析成 Runner 材质，player/enemies 只取碰撞盒。
 */
import type { MaterialOptions, Vec3 } from '@pot/core'
import { Color, Euler, Group, Matrix4, Quaternion, Vector3 } from '../vendor/three-geo'
import type { Box } from './level'
import { MATS } from './mats'
import * as port from './orig/port'

export type TokenKind = 'std' | 'emissive' | 'decal' | 'label' | 'lamps'

let uid = 0
/** 原版 three 材质的替身：保留原版代码会读写的字段，world 按 kind/name/opts 解析成 Runner 材质 */
export class MatToken {
  readonly isMaterial = true
  uuid = `mat-${++uid}`
  isMeshStandardMaterial: boolean
  isMeshBasicMaterial: boolean
  vertexColors: boolean
  transparent: boolean
  color: any
  emissive = new Color(0, 0, 0)
  emissiveIntensity = 1
  userData: Record<string, any> = {}
  needsUpdate = false
  map: any = null
  /** 自发光颜色是否被原版运行时改过（world 据此刷新） */
  version = 0
  constructor(readonly kind: TokenKind, public name: string, readonly opts: Record<string, any> = {}, color?: any) {
    this.isMeshStandardMaterial = kind === 'std'
    this.isMeshBasicMaterial = kind !== 'std'
    this.vertexColors = !!opts.vertexColors
    this.transparent = kind === 'decal' || kind === 'label' || !!MATS[name]?.transparent
    this.color = color ?? new Color(1, 1, 1)
    if (opts.interior) this.userData.interior = true
    if (kind === 'emissive') {
      // 原版 relay 的 setEmissive 路径：MeshBasicMaterial 走 color.copy(c).multiplyScalar(k)
      const c = this.color
      const copy = c.copy.bind(c)
      c.copy = (v: any) => (this.version++, copy(v))
    }
  }
  clone() {
    const t = new MatToken(this.kind, this.name, this.opts, this.color.clone())
    t.vertexColors = this.vertexColors
    t.transparent = this.transparent
    t.userData = { ...this.userData }
    return t
  }
}

/** 原版 mats 接口（get/emissive/decal/label/names）的令牌实现；同名同选项返回同一对象（原版 C1 依赖这点做顶点色替换） */
function tokenMats() {
  const cache = new Map<string, MatToken>()
  const once = (key: string, make: () => MatToken) => {
    let t = cache.get(key)
    if (!t) cache.set(key, (t = make()))
    return t
  }
  return {
    names: Object.keys(MATS),
    get(name: string, o: Record<string, any> = {}) {
      const opts = { interior: !!o.interior, vertexColors: !!o.vertexColors }
      return once(`S|${name}|${opts.interior}|${opts.vertexColors}`, () => new MatToken('std', name, opts))
    },
    emissive(color = 0xffffff, k = 4) {
      return once(`E|${color}|${k}`, () => new MatToken('emissive', 'emissive', {}, new Color(color).multiplyScalar(k)))
    },
    // Canvas 2D 绘制的贴花与喷字：Runner 暂无 Canvas 2D，先以透明令牌占位（world 跳过）
    decal(name: string) {
      return { material: once(`D|${name}`, () => new MatToken('decal', `decal:${name}`)), aspect: 1 }
    },
    label(text: string) {
      return { material: once(`L|${text}`, () => new MatToken('label', 'label')), aspect: Math.max(1, text.length * 0.6) }
    },
    uniforms: { wet: { value: 0.5 } },
  }
}

export interface OrigBox extends Box {
  surface: string
  playerOnly?: boolean
  /** 只挡子弹（天线等细杆），不参与移动碰撞 */
  bulletOnly?: boolean
}

export interface OrigLevel {
  /** 合并后的静态网格（世界坐标，原版右手系） */
  statics: { geometry: any; material: MatToken; cast: boolean; recv: boolean }[]
  /** 不合并的动态网格：几何为局部坐标，transform 每帧由 sync 取 */
  dynamics: { mesh: any; material: MatToken }[]
  lights: any[]
  boxes: OrigBox[]
  data: any
  backdrop: any
  update(dt: number): void
}

let built: OrigLevel | undefined

/** 构建原版关卡（模块内缓存；同一游戏包里多个插件共享） */
export function origLevel(): OrigLevel {
  if (built) return built
  const boxes: OrigBox[] = []
  const physics = {
    nav: undefined,
    addBox(min: number[], max: number[], opts: Record<string, any> = {}) {
      const b: OrigBox = {
        min: [min[0], min[1], -max[2]],
        max: [max[0], max[1], -min[2]],
        surface: opts.surface ?? 'concrete',
      }
      if (opts.playerOnly) b.playerOnly = true
      if (opts.bulletOnly) b.bulletOnly = true
      boxes.push(b)
      return b
    },
  }
  const scene = new Group()
  const ctx: any = { mats: tokenMats(), physics, scene, rng: port.rng(4207), params: {} }
  ctx.props = port.createProps(ctx)
  const data = port.createLevel(ctx)
  // 远景：起重机、货轮、撤离艇、天际线（自带吊具摆动、雷达旋转、艇体起伏，全部作为动态网格同步）
  const backdrop = port.createBackdrop(ctx)
  const asToken = (m: any): MatToken => (m instanceof MatToken ? m : new MatToken('lamps', 'lamps', { vertexColors: true }))

  const statics: OrigLevel['statics'] = []
  const dynamics: OrigLevel['dynamics'] = []
  const lights: any[] = []
  const merged = data.root.children.find((c: any) => c.name === 'level-merged')
  for (const m of merged?.children ?? []) {
    if (m.isMesh) statics.push({ geometry: m.geometry, material: m.material, cast: m.castShadow, recv: m.receiveShadow })
  }
  data.root.updateMatrixWorld(true)
  backdrop.root.updateMatrixWorld(true)
  for (const root of [data.root, backdrop.root]) root.traverse((o: any) => {
    if (o.isPointLight) lights.push(o)
    if (!o.isMesh || o.parent === merged) return
    dynamics.push({ mesh: o, material: asToken(o.material) })
  })
  built = {
    statics, dynamics, lights, boxes, data, backdrop,
    update: (dt) => { data.update(dt); backdrop.update(dt); backdrop.root.updateMatrixWorld(true) },
  }
  return built
}

// ---- 原版右手系 → Unity 左手系 ----

export const toUnityPos = (v: { x: number; y: number; z: number }): Vec3 => [v.x, v.y, -v.z]

const S = new Matrix4().makeScale(1, 1, -1)
const _m = new Matrix4(), _p = new Vector3(), _q = new Quaternion(), _s = new Vector3(), _e = new Euler()
const DEG = 180 / Math.PI

/** 世界矩阵 → Unity 的位置、欧拉角（度，Unity 的 ZXY 顺序即 three 的 'YXZ'）、缩放 */
export function toUnityTransform(matrixWorld: any) {
  _m.multiplyMatrices(S, matrixWorld).multiply(S)
  _m.decompose(_p, _q, _s)
  _e.setFromQuaternion(_q, 'YXZ')
  return {
    position: [_p.x, _p.y, _p.z] as Vec3,
    rotation: [_e.x * DEG, _e.y * DEG, _e.z * DEG] as Vec3,
    scale: [_s.x, _s.y, _s.z] as Vec3,
  }
}

const toSrgb = (v: number) => (v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055)
const hex2 = (v: number) => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, '0')

/** 线性 HDR 颜色 → Runner 的 { 颜色(sRGB), 强度 }：最大分量大于 1 时归一化，强度承担倍数 */
export function hdr(c: { r: number; g: number; b: number }): { color: string; intensity: number } {
  const m = Math.max(c.r, c.g, c.b, 1e-6)
  const k = m > 1 ? m : 1
  return { color: `#${hex2(toSrgb(c.r / k))}${hex2(toSrgb(c.g / k))}${hex2(toSrgb(c.b / k))}`, intensity: k }
}

/** 自发光令牌 → Runner 材质（MeshBasicMaterial：只有颜色，不受光照） */
export function emissiveMaterial(t: MatToken): { color: string; material: MaterialOptions } {
  const e = hdr(t.color)
  return { color: '#000000', material: { mode: 'lit', metallic: 0, smoothness: 0, emission: e.color, emissionIntensity: e.intensity, wet: 0 } }
}
