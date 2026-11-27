/**
 * 原版地图适配层：用材质令牌、碰撞收集器和空场景运行机械移植的原版关卡（./orig/port.ts），
 * 产出 Runner 可用的数据：按材质合并好的静态网格、需要逐帧同步的动态网格与点光源、碰撞盒和玩法点。
 *
 * 坐标仍是原版 Three.js 右手系；网格经 toMesh() 翻转，碰撞盒与点位用 toUnity* 转换。
 * 构建不依赖 ctx（材质只是令牌），world 负责把令牌解析成 Runner 材质，player/enemies 只取碰撞盒。
 */
import type { MaterialOptions } from '@pot/core'
import { Color, Group } from '@pot/kit/realistic/vendor/three-geo'
import { hdr } from '@pot/kit/realistic/three-unity'
import { moduleStamp } from '@pot/kit/realistic/geo'
import type { Box } from './quay'
import { MATS } from '@pot/kit/realistic/mats'
import * as port from '@pot/kit/realistic/orig/port'

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

export interface OrigMap {
  /** 合并后的静态网格（世界坐标，原版右手系） */
  statics: { geometry: any; material: MatToken; cast: boolean; recv: boolean }[]
  /** 不合并的动态网格：几何为局部坐标，transform 每帧由 sync 取 */
  dynamics: { mesh: any; material: MatToken }[]
  lights: any[]
  boxes: OrigBox[]
  data: any
  backdrop: any
  /** 地图构建代码（本模块及其依赖）没变就不变，拼进 scene.mesh 的 key 让网格跨热重载复用 */
  stamp: string
  update(dt: number): void
}

const STAMP = moduleStamp()
let built: OrigMap | undefined

/** 构建原版地图（模块内缓存；同一游戏包里多个插件共享） */
export function origMap(): OrigMap {
  if (built) return built
  const boxes: OrigBox[] = []
  const physics = {
    nav: undefined,
    addBox(minIn: number[] | { x: number; y: number; z: number }, maxIn: number[] | { x: number; y: number; z: number }, opts: Record<string, any> = {}) {
      // 原版道具碰撞（port.ts 2368 行）传的是复用的 Box3.min/max（Vector3），按下标取会得到 NaN
      const v = (a: any): number[] => (Array.isArray(a) ? a : [a.x, a.y, a.z])
      const min = v(minIn), max = v(maxIn)
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

  const statics: OrigMap['statics'] = []
  const dynamics: OrigMap['dynamics'] = []
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
    statics, dynamics, lights, boxes, data, backdrop, stamp: STAMP,
    update: (dt) => { data.update(dt); backdrop.update(dt); backdrop.root.updateMatrixWorld(true) },
  }
  return built
}

// ---- 原版右手系 → Unity 左手系（通用转换在 realistic/three-unity，这里转出给旧调用方） ----
export { toUnityPos, toUnityTransform, writeUnityTRS, hdr } from '@pot/kit/realistic/three-unity'

/**
 * 原版海鸥（port wb，12 只 × 6 顶点）的网格数据，配 shaders/gull.vert：
 * positions 保持原版 three 坐标（着色器里算完轨道再把 z 取反），属性 aOrbit/aPar 原样传。
 * 顶点全在着色器里重算，绑定时要关视锥剔除。
 */
export function gullMesh() {
  const g = port.createGulls(null, { value: 0 }).geometry
  const positions = new Float32Array(g.attributes.position.array)
  const n = positions.length / 3
  const indices = new Uint32Array(n)
  for (let k = 0; k < n; k++) indices[k] = k
  return {
    positions, indices,
    attributes: {
      aOrbit: { size: 4 as const, data: new Float32Array(g.attributes.aOrbit.array) },
      aPar: { size: 4 as const, data: new Float32Array(g.attributes.aPar.array) },
    },
  }
}

/** 原版闪灯网格（kind 'lamps'）的 blink 属性与线性 HDR 顶点色，顶点顺序与 toMesh 一致；不是闪灯网格时返回 undefined */
export function lampAttributes(geometry: any) {
  const blink = geometry.attributes.blink, col = geometry.attributes.color
  if (!blink || !col) return undefined
  const n = geometry.attributes.position.count
  const b = new Float32Array(n * 3), c = new Float32Array(n * 3)
  for (let k = 0; k < n; k++) {
    b[k * 3] = blink.getX(k); b[k * 3 + 1] = blink.getY(k); b[k * 3 + 2] = blink.getZ(k)
    c[k * 3] = col.getX(k); c[k * 3 + 1] = col.getY(k); c[k * 3 + 2] = col.getZ(k)
  }
  return { blink: { size: 3 as const, data: b }, aLamp: { size: 3 as const, data: c } }
}

/** 自发光令牌 → Runner 材质（MeshBasicMaterial：只有颜色，不受光照） */
export function emissiveMaterial(t: MatToken): { color: string; material: MaterialOptions } {
  const e = hdr(t.color)
  return { color: '#000000', material: { mode: 'lit', metallic: 0, smoothness: 0, emission: e.color, emissionIntensity: e.intensity, wet: 0 } }
}
