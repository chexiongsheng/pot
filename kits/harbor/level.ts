/**
 * 港口的几何与坐标：原版坐标（three.js 右手系，北为 -z）到 Unity 的换算，码头（quay）的地面、码头墙、轨道、海面、
 * 码头边空气墙与车道标线的方块清单。游戏的布置（点位）也用原版坐标，用这里的 P、R 换算。
 * 港区其余的样子（堆场、仓库、围栏、道具、起重机、远景）由原版关卡代码建（origlevel.ts），这里不再重复。
 * 纯函数、无副作用：harborLevel 用它生成场景，harborBoxes 用它生成碰撞盒，结果一致。
 * 原版坐标 (x, y, z) → Unity (x, y, -z)；绕 Y 的旋转（弧度）→ 取反后转为角度。
 */
import type { MaterialOptions, Shape, Vec3 } from '@pot/core'
import { DEG } from '@pot/kit/realistic/math'

/** 码头（原版坐标）：X 为码头边（再往东是海），RAILS 为两条起重机轨道的 x */
export const QUAY = { X: 30, RAILS: [18.5, 28.5] as [number, number] }

export interface Piece {
  pos: Vec3
  size: Vec3
  /** Unity 欧拉角（度） */
  rot?: Vec3
  shape?: Shape
  color?: string
  mat?: MaterialOptions
  /** 引擎碰撞体（射线、视线），默认 true */
  collide?: boolean
  /** JS 移动碰撞，默认与 collide 相同 */
  solid?: boolean
  /** 不生成可见物体，只参与 JS 移动碰撞（空气墙） */
  hidden?: boolean
  /** 父节点缩放（用于山墙这类斜切形状），仅视觉 */
  parentScale?: Vec3
  name?: string
  /** 表面材质贴图集（scene.ts 的表面表）；'none' 为纯色；不填时受光物体默认 steel */
  tex?: string
  /** 生成时的缩放（网格形状按真实尺寸建模时为 [1,1,1]）；不填用 size。size 仍用于移动碰撞 */
  scale?: Vec3
  /** 文字贴花（scene.ts 的贴花表） */
  decal?: string
}

export interface Box {
  min: Vec3
  max: Vec3
}

export { LEVEL_LAYER, ENEMY_LAYER, VIEW_LAYER } from '@pot/kit/realistic/layers'

/** 原版坐标 → Unity */
export const P = (x: number, y: number, z: number): Vec3 => [x, y, -z]
/** 原版 yaw（弧度）→ Unity 角度 */
export const R = (r: number) => -r * DEG

const box = (pos: Vec3, size: Vec3, color: string, extra: Partial<Piece> = {}): Piece => ({ pos, size, color, ...extra })

/** 原版坐标下的轴对齐方块（min/max） */
function slab(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, color: string, extra: Partial<Piece> = {}): Piece {
  return box(P((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), [Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0)], color, extra)
}

/**
 * 码头一带的方块：地面、码头甲板与边线、码头墙、起重机轨道、海面、码头边空气墙（原版 playerOnly）、车道标线与斑马线。
 * 原版地面（apron.ts）与海面（sea.ts）可用时，harborLevel 跳过这里的 ground、quay-deck 与 sea
 */
export function buildLevel() {
  const pieces: Piece[] = []
  const add = (p: Piece) => (pieces.push(p), p)
  const steel = { metallic: 0.55, smoothness: 0.45 }
  const X = QUAY.X

  // ---- 地面、码头与海面 ----
  add(slab(-90, -0.5, -70, X, 0, 70, '#ffffff', { tex: 'asphalt', name: 'ground' }))
  add(slab(16, 0, -32, X - 0.6, 0.012, 30, '#ffffff', { collide: false, tex: 'slab', name: 'quay-deck' }))
  add(slab(X - 0.6, 0, -32, X - 0.42, 0.03, 30, '#d8ac2a', { collide: false, tex: 'steel', name: 'quay-edge' }))
  add(slab(X - 0.65, -4.2, -32, X, 0, 30, '#ffffff', { tex: 'concrete', name: 'quay-wall' }))
  for (const x of QUAY.RAILS) add(slab(x - 0.06, 0, -32, x + 0.06, 0.03, 30, '#6a6d70', { collide: false, mat: steel }))
  add(box([X + 80, -1.2, 0], [160, 0.1, 200], '#16242b', { collide: false, solid: false, tex: 'none', mat: { smoothness: 0.95, metallic: 0.25, wet: 0 }, name: 'sea' }))
  // 码头边空气墙（原版 playerOnly）
  add(slab(X + 0.03, -5, -32, X + 0.7, 8, 30, '', { hidden: true }))
  // 车道标线（磨损镂空）与斑马线
  for (const z of [-8.6, 6.1, 17.2]) add(slab(-24, 0, z - 0.07, 16, 0.006, z + 0.07, '#d9b23a', { collide: false, tex: 'marking' }))
  for (const [x0, z0] of [[-6, -8.6], [9, 6.1]] as [number, number][]) {
    for (let k = 0; k < 6; k++) add(slab(x0 + k * 0.9, 0, z0 + 1.2, x0 + k * 0.9 + 0.45, 0.005, z0 + 4.4, '#e6e4dc', { collide: false, tex: 'marking' }))
  }
  return pieces
}

/** 由方块清单生成 JS 移动碰撞盒（Unity 坐标，轴对齐包围盒） */
export function buildSolids(pieces: Piece[]): Box[] {
  const result: Box[] = []
  for (const p of pieces) {
    const solid = p.solid ?? (p.hidden || p.collide !== false)
    if (!solid || p.parentScale) continue
    if (p.name === 'ground') continue
    let [sx, sy, sz] = p.size
    if (p.shape === 'cylinder') sy *= 2
    const yaw = (p.rot?.[1] ?? 0) / DEG
    const c = Math.abs(Math.cos(yaw)), s = Math.abs(Math.sin(yaw))
    const hx = (c * sx + s * sz) / 2, hz = (s * sx + c * sz) / 2
    if (p.rot && (Math.abs(p.rot[0]) > 1 || Math.abs(p.rot[2]) > 1)) continue
    result.push({ min: [p.pos[0] - hx, p.pos[1] - sy / 2, p.pos[2] - hz], max: [p.pos[0] + hx, p.pos[1] + sy / 2, p.pos[2] + hz] })
  }
  return result
}
