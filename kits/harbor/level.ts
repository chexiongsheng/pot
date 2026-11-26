/**
 * 关卡几何：把 data/level.json（原版坐标，右手系）转换为 Unity 坐标的方块清单。
 * 纯函数、无副作用：world 用它生成场景，player/enemies 用它生成碰撞盒，结果一致。
 * 原版坐标 (x, y, z) → Unity (x, y, -z)；绕 Y 的旋转（弧度）→ 取反后转为角度。
 */
import type { MaterialOptions, Shape, Vec3 } from '@pot/core'
import { DEG } from '@pot/kit/realistic/math'

export interface LevelData {
  palette: Record<string, string>
  containers: [number, number, [number | string, string, number?][], number][]
  props: [string, number, number, number, number?][]
  masts: [number, number][]
  bollards: number[]
  cranes: [number][]
  shed: { X0: number; X1: number; Z0: number; Z1: number; EAVE: number; RIDGE: number; ZR: number; FLOOR: number; doorN: [number, number, number]; doorE: [number, number, number]; racks: [number, number, number][] }
  quay: { X: number; LADDER_Z: number; RAILS: [number, number]; Z0: number; Z1: number }
  fence: { x0: number; x1: number; z0: number; z1: number; gate: [number, number] }
  stairs: { x0: number; x1: number; z: number; width: number; height: number; steps: number }
  catwalk: { x0: number; x1: number; z: number; width: number; height: number }
  relays: { id: string; short: string; label: string; pos: Vec3; rot: number }[]
  playerStart: { pos: Vec3; yaw: number }
  extraction: { pos: Vec3; radius: number }
  spawns: ['ground' | 'air', number, number, number][]
  cinematic: { pos: Vec3; look: Vec3 }[]
}

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
  /** 表面材质贴图集（world 中的 SURFACES 表）；'none' 为纯色；不填时受光物体默认 steel */
  tex?: string
  /** 生成时的缩放（网格形状按真实尺寸建模时为 [1,1,1]）；不填用 size。size 仍用于移动碰撞 */
  scale?: Vec3
  /** 文字贴花（world 中的 DECALS 表） */
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

/** 原版坐标下以底面中心定位的方块 */
function block(x: number, y: number, z: number, sx: number, sy: number, sz: number, rot: number, color: string, extra: Partial<Piece> = {}): Piece {
  return box(P(x, y + sy / 2, z), [sx, sy, sz], color, { rot: [0, R(rot), 0], ...extra })
}

/** 原版坐标下的轴对齐方块（min/max） */
function slab(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, color: string, extra: Partial<Piece> = {}): Piece {
  return box(P((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), [Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0)], color, extra)
}

const CONTAINER: Record<string, Vec3> = { '20': [6.06, 2.59, 2.44], '40': [12.19, 2.59, 2.44], hc: [12.19, 2.9, 2.44] }

const PROPS: Record<string, { size: Vec3; color: string; shape?: Shape; smooth?: number; metal?: number; tex?: string }> = {
  barrel: { size: [0.6, 0.9, 0.6], color: '#2d5a86', shape: 'cylinder' },
  pallet_stack: { size: [1.2, 1.0, 1.0], color: '#ffffff', tex: 'wood' },
  crate_stack: { size: [1.4, 2.0, 1.4], color: '#d8c8b0', tex: 'wood' },
  crate_wood: { size: [1.2, 1.1, 1.2], color: '#e8d8c0', tex: 'wood' },
  ibc_tote: { size: [1.2, 1.15, 1.0], color: '#d9ddda', smooth: 0.55, tex: 'none' },
  forklift: { size: [2.4, 1.3, 1.2], color: '#e0aa22' },
  jersey_barrier: { size: [2.0, 0.8, 0.6], color: '#ffffff', tex: 'concrete' },
  sandbags: { size: [1.6, 0.75, 0.6], color: '#7d7356', tex: 'none', smooth: 0.15 },
  cable_reel: { size: [1.2, 0.9, 1.2], color: '#ffffff', shape: 'cylinder', tex: 'wood' },
  tarp_cargo: { size: [2.4, 1.6, 1.6], color: '#3e5a4a', smooth: 0.6, tex: 'none' },
  tire_stack: { size: [1.0, 1.0, 1.0], color: '#1c1d1e', shape: 'cylinder', tex: 'none', smooth: 0.25 },
  cardboard_boxes: { size: [1.0, 0.8, 0.8], color: '#a3804f', tex: 'none', smooth: 0.1 },
  dumpster: { size: [2.0, 1.4, 1.2], color: '#2f6a42' },
  gas_cylinders: { size: [1.4, 1.5, 0.5], color: '#5a6a70' },
  pipe_stack: { size: [4.0, 0.9, 1.4], color: '#8a8f93' },
  generator: { size: [2.2, 1.4, 1.0], color: '#d09a2a' },
  guard_booth: { size: [2.2, 2.6, 2.2], color: '#e8e6dc' },
  workbench: { size: [2.2, 0.95, 0.9], color: '#6a6f73' },
}

/**
 * origStatic：堆场、仓库、围栏、道具等由机械移植的原版关卡（origlevel.ts）生成，这里只出地面、码头、海面、起重机、撤离艇与远景
 * （原版地面见 apron.ts，可用时 world 会跳过这里的 ground 与 quay-deck；backdrop 已在 origlevel 中移植）。
 */
export function buildLevel(level: LevelData, opts: { origStatic?: boolean } = {}) {
  const full = !opts.origStatic
  const pieces: Piece[] = []
  const add = (p: Piece) => (pieces.push(p), p)
  const pal = level.palette
  const steel = { metallic: 0.55, smoothness: 0.45 }

  // ---- 地面、码头与海面 ----
  add(slab(-90, -0.5, -70, level.quay.X, 0, 70, '#ffffff', { tex: 'asphalt', name: 'ground' }))
  add(slab(16, 0, -32, level.quay.X - 0.6, 0.012, 30, '#ffffff', { collide: false, tex: 'slab', name: 'quay-deck' }))
  add(slab(level.quay.X - 0.6, 0, -32, level.quay.X - 0.42, 0.03, 30, '#d8ac2a', { collide: false, tex: 'steel', name: 'quay-edge' }))
  add(slab(level.quay.X - 0.65, -4.2, -32, level.quay.X, 0, 30, '#ffffff', { tex: 'concrete', name: 'quay-wall' }))
  for (const x of level.quay.RAILS) add(slab(x - 0.06, 0, -32, x + 0.06, 0.03, 30, '#6a6d70', { collide: false, mat: steel }))
  add(box([level.quay.X + 80, -1.2, 0], [160, 0.1, 200], '#16242b', { collide: false, solid: false, tex: 'none', mat: { smoothness: 0.95, metallic: 0.25, wet: 0 }, name: 'sea' }))
  // 码头边空气墙（原版 playerOnly）
  add(slab(level.quay.X + 0.03, -5, -32, level.quay.X + 0.7, 8, 30, '', { hidden: true }))
  // 车道标线（磨损镂空）与斑马线
  for (const z of [-8.6, 6.1, 17.2]) add(slab(-24, 0, z - 0.07, 16, 0.006, z + 0.07, '#d9b23a', { collide: false, tex: 'marking' }))
  for (const [x0, z0] of [[-6, -8.6], [9, 6.1]] as [number, number][]) {
    for (let k = 0; k < 6; k++) add(slab(x0 + k * 0.9, 0, z0 + 1.2, x0 + k * 0.9 + 0.45, 0.005, z0 + 4.4, '#e6e4dc', { collide: false, tex: 'marking' }))
  }

  // ---- 集装箱（波纹网格 + 漆面贴图 + 侧面喷字） ----
  let serial = 0
  if (full) for (const [x, z, layers, rot] of level.containers) {
    let y = 0
    for (const [kind, color, dx = 0] of layers) {
      const key = String(kind) in CONTAINER ? String(kind) : '20'
      const size = CONTAINER[key]
      const c = Math.cos(rot), s = Math.sin(rot)
      const cx = x + dx * c, cz = z - dx * s
      const hex = pal[color] ?? color
      add(block(cx, y, cz, size[0], size[1], size[2], rot, '#ffffff', { shape: `mesh:container${key}`, scale: [1, 1, 1], tex: `paint:${hex}`, name: 'container' }))
      // 侧面喷字：两侧各一块，略离开波纹外表面
      const n = serial++
      const decal = n % 5 === 3 ? 'code' : 'logo'
      const w = decal === 'logo' ? 2.6 : 1.5, h = decal === 'logo' ? 0.65 : 0.42
      const along = (n % 3 - 1) * (size[0] > 7 ? 2.2 : 0.6)
      for (const side of [-1, 1]) {
        const lz = side * (size[2] / 2 + 0.006)
        const px = cx + along * c + lz * s, pz = cz - along * s + lz * c
        // Unity 的 quad 正面朝 -Z：原版 +z 侧（Unity -z）不转，另一侧转 180°
        pieces.push({ pos: P(px, y + size[1] * 0.55, pz), size: [w, h, 1], rot: [0, R(rot) + (side > 0 ? 0 : 180), 0], shape: 'quad', color: '#ffffff', collide: false, solid: false, decal })
      }
      y += size[1]
    }
  }

  // ---- 杂物 ----
  if (full) for (const [type, x, z, rot, y = 0] of level.props) {
    const def = PROPS[type]
    if (!def) continue
    const [sx, sy, sz] = def.size
    const mat: MaterialOptions = { smoothness: def.smooth ?? 0.3, metallic: def.metal ?? 0 }
    if (def.shape === 'cylinder') {
      add(box(P(x, y + sy / 2, z), [sx, sy / 2, sz], def.color, { shape: 'cylinder', mat, tex: def.tex }))
    } else {
      add(block(x, y, z, sx, sy, sz, rot, def.color, { mat, tex: def.tex }))
    }
    if (type === 'forklift') {
      const c = Math.cos(rot), s = Math.sin(rot)
      add(block(x + 1.25 * c, 0, z - 1.25 * s, 0.18, 2.4, 1.0, rot, '#2b2b2b', { collide: false, mat: steel }))
      add(block(x - 0.3 * c, 1.3, z + 0.3 * s, 1.1, 0.9, 1.1, rot, '#1f2326', { collide: false, mat: { mode: 'lit-fade', smoothness: 0.9 } }))
    }
    if (type === 'guard_booth') {
      add(block(x, 1.2, z, sx + 0.02, 0.7, sz + 0.02, rot, '#ffd9a0', { collide: false, mat: { emission: '#ffb860', emissionIntensity: 1.2 } }))
    }
    if (type === 'ibc_tote') add(block(x, sy, z, sx + 0.04, 0.05, sz + 0.04, rot, '#8a8f93', { collide: false, mat: steel }))
  }

  // ---- 灯塔杆（灯光由 world 另行生成） ----
  if (full) for (const [x, z] of level.masts) {
    add(box(P(x, 6, z), [0.32, 6, 0.32], '#8a9096', { shape: 'cylinder', mat: steel }))
    add(box(P(x, 12.1, z), [1.6, 0.35, 0.7], '#2a2d30', { collide: false, mat: steel }))
    add(box(P(x, 11.9, z), [1.4, 0.06, 0.55], '#fff1d0', { collide: false, mat: { mode: 'unlit' } }))
  }
  // 通道指示牌（挂在前两根灯杆上，双面）
  if (full) level.masts.slice(0, 2).forEach(([x, z], k) => {
    add(box(P(x, 3.6, z - 0.22), [1.5, 0.5, 0.05], '#c9a227', { collide: false, tex: 'steel' }))
    for (const side of [-1, 1]) {
      pieces.push({ pos: P(x, 3.6, z - 0.22 + side * 0.03), size: [1.4, 0.42, 1], rot: [0, side > 0 ? 0 : 180, 0], shape: 'quad', color: '#ffffff', collide: false, solid: false, decal: k === 0 ? 'lane2' : 'lane3' })
    }
  })

  // ---- 系缆桩 ----
  if (full) for (const z of level.bollards) add(box(P(level.quay.X - 1.1, 0.3, z), [0.42, 0.3, 0.42], '#2c2f31', { shape: 'cylinder', mat: steel }))

  // ---- 门式起重机（码头） ----
  // 原版模式下起重机、撤离艇、远景由机械移植的 backdrop 提供
  if (!full) return pieces
  const [r0, r1] = level.quay.RAILS
  for (const [cz] of level.cranes) {
    const red = '#b4452f'
    for (const x of [r0, r1]) for (const dz of [-5, 5]) add(slab(x - 0.5, 0, cz + dz - 0.5, x + 0.5, 22, cz + dz + 0.5, red, { mat: steel }))
    for (const x of [r0, r1]) add(slab(x - 0.6, 0, cz - 5.6, x + 0.6, 0.8, cz + 5.6, '#3a3c3e', { mat: steel }))
    add(slab(r0 - 6, 22, cz - 1.4, r1 + 34, 24, cz + 1.4, red, { collide: false, mat: steel }))
    add(slab(r0 - 1, 24, cz - 5.5, r1 + 1, 25, cz + 5.5, red, { collide: false, mat: steel }))
    add(slab(r1 - 3, 18.5, cz - 2, r1 + 1, 21.5, cz + 2, '#d9d6cc', { collide: false }))
    add(slab(r1 - 2.9, 19.6, cz - 2.02, r1 + 0.9, 20.8, cz + 2.02, '#ffd29a', { collide: false, mat: { emission: '#ffc070', emissionIntensity: 0.9 } }))
  }

  // ---- 撤离艇与舷梯 ----
  const lz = level.quay.LADDER_Z
  const qx = level.quay.X
  add(slab(qx + 1.2, -1.9, lz - 4.5, qx + 4.6, -0.4, lz + 4.5, '#2b3a46', { collide: false, mat: { smoothness: 0.6, metallic: 0.3 }, name: 'boat' }))
  add(slab(qx + 1.5, -0.4, lz - 1.2, qx + 4.3, 1.1, lz + 2.4, '#d3d1c7', { collide: false }))
  add(slab(qx + 1.52, 0.4, lz - 1.22, qx + 4.28, 0.8, lz + 2.42, '#202a30', { collide: false, mat: { smoothness: 0.95 } }))
  add(slab(qx + 1.3, -0.4, lz + 3.6, qx + 1.4, 0.2, lz + 4.4, '#ff3b30', { collide: false, mat: { mode: 'unlit' } }))
  add(slab(qx + 4.4, -0.4, lz + 3.6, qx + 4.5, 0.2, lz + 4.4, '#38e070', { collide: false, mat: { mode: 'unlit' } }))
  for (const s of [-1, 1]) add(slab(qx - 0.2, -3.9, lz + s * 0.26 - 0.03, qx - 0.12, 1.12, lz + s * 0.26 + 0.03, '#c39b2a', { collide: false }))

  // ---- 远景：货轮、塔吊剪影 ----
  add(slab(70, -2, -60, 86, 12, 40, '#262a2f', { collide: false, solid: false, name: 'ship' }))
  add(slab(72, 12, 20, 84, 22, 32, '#30353a', { collide: false, solid: false }))
  add(slab(72.2, 18, 19.9, 83.8, 18.6, 20.05, '#ffcc88', { collide: false, solid: false, mat: { mode: 'unlit' } }))
  for (let i = 0; i < 6; i++) {
    const cz = -50 + i * 14
    add(slab(70.5, 12, cz, 85.5, 12 + 2.6 * (1 + (i % 3)), cz + 12, ['#7a3a2e', '#2d5a86', '#757b80', '#2c7473'][i % 4], { collide: false, solid: false }))
  }
  for (const [x, z] of [[-70, -40], [-75, 30], [10, 70]] as [number, number][]) {
    add(slab(x - 1, 0, z - 1, x + 1, 38, z + 1, '#3a3f44', { collide: false, solid: false }))
    add(slab(x - 18, 36, z - 0.8, x + 12, 38, z + 0.8, '#3a3f44', { collide: false, solid: false }))
    add(box(P(x, 38.6, z), [0.4, 0.4, 0.4], '#ff3b30', { collide: false, solid: false, mat: { mode: 'unlit' } }))
  }

  if (!full) return pieces

  // ---- 围栏与大门 ----
  const f = level.fence
  const fenceLine = (x0: number, z0: number, x1: number, z1: number) => {
    add(slab(Math.min(x0, x1) - 0.03, 0, Math.min(z0, z1) - 0.03, Math.max(x0, x1) + 0.03, 2.4, Math.max(z0, z1) + 0.03, '#c4cacd', { tex: 'chainlink', mat: { shadows: false } }))
    add(slab(Math.min(x0, x1) - 0.05, 2.35, Math.min(z0, z1) - 0.05, Math.max(x0, x1) + 0.05, 2.45, Math.max(z0, z1) + 0.05, '#6f777c', { collide: false, mat: steel }))
    const n = Math.max(1, Math.round(Math.hypot(x1 - x0, z1 - z0) / 3.35))
    for (let i = 0; i <= n; i++) {
      const t = i / n
      add(box(P(x0 + (x1 - x0) * t, 1.2, z0 + (z1 - z0) * t), [0.07, 1.2, 0.07], '#6f777c', { shape: 'cylinder', collide: false, mat: steel }))
    }
    add(slab(Math.min(x0, x1) - 0.3, 0, Math.min(z0, z1) - 0.3, Math.max(x0, x1) + 0.3, 7, Math.max(z0, z1) + 0.3, '', { hidden: true }))
  }
  fenceLine(f.x0, f.z0, f.x1, f.z0)
  fenceLine(f.x0, f.z1, f.x1, f.z1)
  fenceLine(f.x0, f.z0, f.x0, f.gate[0])
  fenceLine(f.x0, f.gate[1], f.x0, f.z1)
  add(slab(f.x0 - 0.4, 0, f.gate[0], f.x0 - 0.1, 7, f.gate[1], '', { hidden: true }))
  for (const z of [f.gate[0] - 0.1, f.gate[1] + 0.1]) add(slab(f.x0 - 0.11, 0, z - 0.11, f.x0 + 0.11, 3.4, z + 0.11, '#2a2d30', { mat: steel }))
  add(slab(-36.35, 0.95, f.gate[0] + 0.2, -36.25, 1.05, f.gate[1] - 0.2, '#e8e4da', { collide: false }))
  for (let z = f.gate[0] + 0.6; z < f.gate[1] - 0.4; z += 1.2) add(slab(-36.36, 0.94, z, -36.24, 1.06, z + 0.5, '#c8342a', { collide: false }))

  // ---- 维修车间（仓库） ----
  const s = level.shed
  const wall = '#8a8f8a', wallT = 0.25
  const wallMat: MaterialOptions = { smoothness: 0.35, metallic: 0.3 }
  add(slab(s.X0, -0.25, s.Z0, s.X1, s.FLOOR, s.Z1, '#b8c4be', { tex: 'slab', mat: { wet: 0 }, name: 'shed-floor' }))
  // 南墙（原版 z=Z0）整面
  add(slab(s.X0, 0, s.Z0, s.X1, s.EAVE, s.Z0 + wallT, wall, { mat: wallMat }))
  // 北墙（z=Z1）带门
  const [dn0, dn1, dnh] = s.doorN
  add(slab(s.X0, 0, s.Z1 - wallT, dn0, s.EAVE, s.Z1, wall, { mat: wallMat }))
  add(slab(dn1, 0, s.Z1 - wallT, s.X1, s.EAVE, s.Z1, wall, { mat: wallMat }))
  add(slab(dn0, dnh, s.Z1 - wallT, dn1, s.EAVE, s.Z1, wall, { mat: wallMat }))
  // 西墙整面，东墙带门
  add(slab(s.X0, 0, s.Z0, s.X0 + wallT, s.EAVE, s.Z1, wall, { mat: wallMat }))
  const [de0, de1, deh] = s.doorE
  add(slab(s.X1 - wallT, 0, s.Z0, s.X1, s.EAVE, de0, wall, { mat: wallMat }))
  add(slab(s.X1 - wallT, 0, de1, s.X1, s.EAVE, s.Z1, wall, { mat: wallMat }))
  add(slab(s.X1 - wallT, deh, de0, s.X1, s.EAVE, de1, wall, { mat: wallMat }))
  // 墙裙（混凝土）
  for (const [x0, z0, x1, z1] of [[s.X0, s.Z0 - 0.02, s.X1, s.Z0 + 0.1], [s.X0 - 0.02, s.Z0, s.X0 + 0.1, s.Z1]] as number[][]) {
    add(slab(x0, 0, z0, x1, 1.2, z1, '#ffffff', { collide: false, tex: 'concrete' }))
  }
  // 门上警示条
  add(slab(dn0, dnh, s.Z1 + 0.01, dn1, dnh + 0.25, s.Z1 + 0.05, '#c39b2a', { collide: false }))
  add(slab(s.X1 + 0.01, deh, de0, s.X1 + 0.05, deh + 0.25, de1, '#c39b2a', { collide: false }))
  // 山墙：父节点纵向压扁的 45° 方块，得到三角形
  const half = (s.Z1 - s.Z0) / 2
  const rise = s.RIDGE - s.EAVE
  for (const x of [s.X0 + wallT / 2, s.X1 - wallT / 2]) {
    const side = half * Math.SQRT2
    pieces.push({ pos: P(x, s.EAVE, s.ZR), size: [wallT, side, side], rot: [45, 0, 0], color: wall, mat: wallMat, collide: false, solid: false, parentScale: [1, rise / half, 1] })
  }
  // 屋顶两坡
  const slope = Math.atan2(rise, half) * DEG
  const roofLen = Math.hypot(half, rise) + 0.4
  for (const sign of [-1, 1]) {
    const zc = s.ZR + sign * half / 2
    pieces.push({ pos: P((s.X0 + s.X1) / 2, s.EAVE + rise / 2 + 0.08, zc), size: [s.X1 - s.X0 + 0.6, 0.12, roofLen], rot: [-sign * slope, 0, 0], color: '#5d6468', mat: { metallic: 0.5, smoothness: 0.5 }, solid: false })
  }
  // 天窗灯带
  for (const x of [-10, -2, 6]) add(slab(x - 2, s.EAVE - 0.3, s.ZR - 0.25, x + 2, s.EAVE - 0.22, s.ZR + 0.25, '#fff6e0', { collide: false, mat: { mode: 'unlit' } }))
  // 横梁
  for (const x of [-11.1, -6.2, -0.8, 5.6]) add(slab(x - 0.15, s.EAVE - 0.5, s.Z0, x + 0.15, s.EAVE - 0.2, s.Z1, '#3b4a5a', { collide: false, mat: steel }))
  // 货架
  for (const [x, z, rot] of s.racks) {
    add(block(x, 0, z, 5, 2.8, 1.0, rot, '#33597a', { mat: steel }))
    add(block(x - 1.2, 2.8, z, 1.1, 0.8, 0.9, rot, '#8d6a3f', { collide: false }))
    add(block(x + 1.1, 2.8, z, 1.4, 0.6, 0.9, rot, '#c9cdca', { collide: false }))
  }

  // ---- 楼梯与天桥（堆场集装箱顶的制高点） ----
  const st = level.stairs
  const run = (st.x1 - st.x0) / st.steps
  for (let i = 0; i < st.steps; i++) {
    const top = (st.height / st.steps) * (i + 1)
    add(slab(st.x0 + run * i, 0, st.z - st.width / 2, st.x1, top, st.z + st.width / 2, i === st.steps - 1 ? '#c39b2a' : '#5b6064', { mat: steel }))
  }
  const cw = level.catwalk
  add(slab(cw.x0, cw.height - 0.1, cw.z - cw.width / 2, cw.x1, cw.height, cw.z + cw.width / 2, '#4a4f53', { mat: steel }))
  for (const sz of [-1, 1]) add(slab(cw.x0, cw.height + 1.0, cw.z + sz * cw.width / 2 - 0.03, cw.x1, cw.height + 1.06, cw.z + sz * cw.width / 2 + 0.03, '#c39b2a', { collide: false }))

  return pieces
}

/** 颜色变暗 */
export function shade(hex: string, k: number) {
  const n = parseInt(hex.replace('#', '').slice(0, 6), 16)
  const c = (v: number) => Math.round(Math.min(255, v * k)).toString(16).padStart(2, '0')
  return '#' + c(n >> 16 & 255) + c(n >> 8 & 255) + c(n & 255)
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

/** 转换后的关卡要点（Unity 坐标） */
export function levelPoints(level: LevelData) {
  return {
    relays: level.relays.map((r) => ({ ...r, pos: P(r.pos[0], r.pos[1], r.pos[2]), yaw: R(r.rot) })),
    start: { pos: P(...level.playerStart.pos), yaw: R(level.playerStart.yaw) },
    extraction: { pos: P(...level.extraction.pos), radius: level.extraction.radius },
    spawns: level.spawns.map(([type, x, y, z]) => ({ type, pos: P(x, y, z) })),
    cinematic: level.cinematic.map((c) => ({ pos: P(...c.pos), look: P(...c.look) })),
    shed: level.shed,
  }
}
