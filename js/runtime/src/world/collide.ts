/**
 * 触发检测：球与球、球与盒、盒与盒（不旋转）。见 004 第 15.9 节。
 * 实体数在 256 以内时两两检测，以上用格子大小为 4 的均匀网格。结果按 id 排序，保证确定。
 *
 * 模拟侧碰撞（17.4）：由实体的 body 积木推出的碰撞表，XZ 均匀网格索引；
 * move 逐项照搬 saltline 的 Collision.move，raycast、overlap 为纯 JS，Node 与 Runner 结果相同。
 */

export interface Collider {
  id: number
  x: number
  y: number
  z: number
  /** 球半径（已乘缩放）；box 存在时不用 */
  r: number
  /** 盒的半边长（已乘缩放） */
  box: [number, number, number] | null
}

export const GRID_THRESHOLD = 256
export const GRID_CELL = 4

/** 两个触发体是否重叠（严格小于，半径都为 0 的两个点不算重叠） */
export function overlap(a: Collider, b: Collider): boolean {
  const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z
  if (!a.box && !b.box) {
    const r = a.r + b.r
    return dx * dx + dy * dy + dz * dz < r * r
  }
  if (a.box && b.box) {
    return Math.abs(dx) < a.box[0] + b.box[0] && Math.abs(dy) < a.box[1] + b.box[1] && Math.abs(dz) < a.box[2] + b.box[2]
  }
  const sphere = a.box ? b : a
  const box = a.box ? a : b
  const [hx, hy, hz] = box.box!
  const cx = clamp(sphere.x, box.x - hx, box.x + hx) - sphere.x
  const cy = clamp(sphere.y, box.y - hy, box.y + hy) - sphere.y
  const cz = clamp(sphere.z, box.z - hz, box.z + hz) - sphere.z
  const d2 = cx * cx + cy * cy + cz * cz
  if (sphere.r > 0) return d2 < sphere.r * sphere.r
  // 半径为 0 的点：严格在盒内
  return Math.abs(sphere.x - box.x) < hx && Math.abs(sphere.y - box.y) < hy && Math.abs(sphere.z - box.z) < hz
}

function clamp(v: number, lo: number, hi: number) {
  return v < lo ? lo : v > hi ? hi : v
}

function half(c: Collider): [number, number, number] {
  return c.box ?? [c.r, c.r, c.r]
}

/** 重叠的触发体对，每对按 id 小的在前，整体按 (小 id, 大 id) 排序 */
export function overlappingPairs(list: Collider[]): [Collider, Collider][] {
  const sorted = [...list].sort((a, b) => a.id - b.id)
  const out: [Collider, Collider][] = []
  if (sorted.length <= GRID_THRESHOLD) {
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        if (overlap(sorted[i], sorted[j])) out.push([sorted[i], sorted[j]])
      }
    }
    return out
  }
  const cells = new Map<string, number[]>()
  sorted.forEach((c, index) => {
    const [hx, hy, hz] = half(c)
    const x0 = Math.floor((c.x - hx) / GRID_CELL), x1 = Math.floor((c.x + hx) / GRID_CELL)
    const y0 = Math.floor((c.y - hy) / GRID_CELL), y1 = Math.floor((c.y + hy) / GRID_CELL)
    const z0 = Math.floor((c.z - hz) / GRID_CELL), z1 = Math.floor((c.z + hz) / GRID_CELL)
    for (let i = x0; i <= x1; i++) for (let j = y0; j <= y1; j++) for (let k = z0; k <= z1; k++) {
      const key = `${i},${j},${k}`
      let cell = cells.get(key)
      if (!cell) cells.set(key, cell = [])
      cell.push(index)
    }
  })
  const seen = new Set<number>()
  const n = sorted.length
  const found: [number, number][] = []
  for (const cell of cells.values()) {
    for (let i = 0; i < cell.length; i++) {
      for (let j = i + 1; j < cell.length; j++) {
        const a = cell[i], b = cell[j]
        const key = a * n + b
        if (seen.has(key)) continue
        seen.add(key)
        if (overlap(sorted[a], sorted[b])) found.push([a, b])
      }
    }
  }
  found.sort((p, q) => p[0] - q[0] || p[1] - q[1])
  for (const [a, b] of found) out.push([sorted[a], sorted[b]])
  return out
}

// ---------------------------------------------------------------- 模拟侧碰撞（17.4）

export type BodyShape = 'box' | 'sphere' | 'capsule'
type V3 = [number, number, number]

/** 碰撞表里的一项（由实体的 body 推出，已乘缩放、加偏移） */
export interface BodyEntry {
  id: number
  kind: BodyShape
  layer: string
  solid: boolean
  /** 中心 */
  c: V3
  /** 轴对齐包围盒（盒就是它自己） */
  min: V3
  max: V3
  /** 球、胶囊的半径 */
  r: number
  /** 胶囊两端球心到中心的距离 */
  seg: number
  /** 推出它的输入（位置、缩放、body 属性），变了才重建 */
  sig: string
}

interface BodyHost {
  id: number
  pos: number[]
  scale: number[]
  b: Record<string, Record<string, any> | undefined>
}

const num = (v: any, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d)

/** 实体的 body 推出的碰撞体；没有 body 时为 null */
export function bodyEntry(e: BodyHost): BodyEntry | null {
  const b = e.b.body
  if (!b) return null
  const s = e.scale
  const sx = Math.abs(s[0]), sy = Math.abs(s[1]), sz = Math.abs(s[2])
  const ctr = Array.isArray(b.center) ? b.center : [0, 0, 0]
  const c: V3 = [e.pos[0] + num(ctr[0], 0) * s[0], e.pos[1] + num(ctr[1], 0) * s[1], e.pos[2] + num(ctr[2], 0) * s[2]]
  const kind: BodyShape = b.shape === 'sphere' || b.shape === 'capsule' ? b.shape : 'box'
  let hx: number, hy: number, hz: number, r = 0, seg = 0
  if (kind === 'box') {
    const size = Array.isArray(b.size) ? b.size : [1, 1, 1]
    hx = (num(size[0], 1) * sx) / 2
    hy = (num(size[1], 1) * sy) / 2
    hz = (num(size[2], 1) * sz) / 2
  } else if (kind === 'sphere') {
    r = num(b.radius, 0.5) * Math.max(sx, sy, sz)
    hx = hy = hz = r
  } else {
    r = num(b.radius, 0.5) * Math.max(sx, sz)
    hy = Math.max(r, (num(b.height, 2) * sy) / 2)
    seg = hy - r
    hx = hz = r
  }
  return {
    id: e.id, kind, layer: typeof b.layer === 'string' ? b.layer : 'default', solid: b.solid !== false,
    c, min: [c[0] - hx, c[1] - hy, c[2] - hz], max: [c[0] + hx, c[1] + hy, c[2] + hz], r, seg,
    sig: bodySig(e),
  }
}

function bodySig(e: BodyHost) {
  const b = e.b.body!
  return `${e.pos}|${e.scale}|${b.shape}|${b.size}|${b.radius}|${b.height}|${b.center}|${b.layer}|${b.solid}`
}

/** 触发检测用：body 的形状换成触发体（胶囊取包围盒） */
export function bodyCollider(entry: BodyEntry): Collider {
  const [x, y, z] = entry.c
  if (entry.kind === 'sphere') return { id: entry.id, x, y, z, r: entry.r, box: null }
  return { id: entry.id, x, y, z, r: 0, box: [entry.max[0] - x, entry.max[1] - y, entry.max[2] - z] }
}

export interface Mover {
  vel: number[]
  grounded: boolean
}

export interface MoveOptions {
  radius?: number
  height?: number
  stepUp?: number
  dt?: number
  layers?: string[]
  /** 无限大的水平地面；maxX 给出时只在 x <= maxX 处存在 */
  ground?: { y: number; maxX?: number } | null
}

export interface MoveResult {
  grounded: boolean
  landed: boolean
  hitWall: boolean
  hitCeiling: boolean
}

export interface RayHitEntry {
  id: number
  point: V3
  normal: V3
  dist: number
}

export type OverlapShape = { kind: 'sphere'; radius: number } | { kind: 'box'; size: number[] }

export type BodyFilter = (entry: BodyEntry) => boolean

const EPS = 0.001
/** 单个子步的最大位移（米），与 saltline 相同 */
const MAX_STEP = 0.2
/** 子步候选区域在位移之外的余量（米） */
const MARGIN = 1
/** 盒覆盖的格子超过这个数时不入格，每次查询都参加 */
const BIG_CELLS = 64

/** 碰撞表：实体 id → 碰撞体，XZ 网格索引。调用方负责在适当的时候 sync */
export class BodyTable {
  private _entries = new Map<number, BodyEntry>()
  private _cells = new Map<string, number[]>()
  private _big = new Set<number>()
  private _range = new Map<number, [number, number, number, number]>()
  /** 内容变化（增、删、改）时加一，原生侧据此决定是否重发（18.6） */
  version = 0

  get size() {
    return this._entries.size
  }

  entry(id: number) {
    return this._entries.get(id)
  }

  /** 按当前实体刷新：位置、缩放、body 属性没变的不动；不在 entities 里的移除 */
  sync(entities: Iterable<BodyHost>) {
    const seen = new Set<number>()
    for (const e of entities) {
      if (!e.b.body) continue
      seen.add(e.id)
      const old = this._entries.get(e.id)
      if (old && old.sig === bodySig(e)) continue
      if (old) this._unindex(e.id)
      const entry = bodyEntry(e)!
      this._entries.set(e.id, entry)
      this._index(entry)
      this.version++
    }
    for (const id of [...this._entries.keys()]) {
      if (!seen.has(id)) {
        this._unindex(id)
        this._entries.delete(id)
        this.version++
      }
    }
  }

  /**
   * 原生侧的碰撞体缓冲区（18.6）：[数量, 15, 排除的数量, 碰撞体…, 排除的 id…]，碰撞体按 id 升序，
   * 每个 [id, 形状 0/1/2, solid, 层位, 中心×3, min×3, max×3, 半径, 胶囊半段]
   */
  exportNative(layerBit: (name: string) => number, exclude: number[]): Float64Array {
    const list = [...this._entries.values()].sort((a, b) => a.id - b.id)
    const out = new Float64Array(3 + list.length * 15 + exclude.length)
    out[0] = list.length
    out[1] = 15
    out[2] = exclude.length
    let o = 3
    for (const b of list) {
      out[o] = b.id
      out[o + 1] = b.kind === 'box' ? 0 : b.kind === 'sphere' ? 1 : 2
      out[o + 2] = b.solid ? 1 : 0
      out[o + 3] = layerBit(b.layer)
      out.set(b.c, o + 4)
      out.set(b.min, o + 7)
      out.set(b.max, o + 10)
      out[o + 13] = b.r
      out[o + 14] = b.seg
      o += 15
    }
    out.set(exclude, o)
    return out
  }

  private _index(entry: BodyEntry) {
    const x0 = Math.floor(entry.min[0] / GRID_CELL), x1 = Math.floor(entry.max[0] / GRID_CELL)
    const z0 = Math.floor(entry.min[2] / GRID_CELL), z1 = Math.floor(entry.max[2] / GRID_CELL)
    const count = (x1 - x0 + 1) * (z1 - z0 + 1)
    if (!Number.isFinite(count) || count > BIG_CELLS) {
      this._big.add(entry.id)
      return
    }
    this._range.set(entry.id, [x0, x1, z0, z1])
    for (let i = x0; i <= x1; i++) for (let k = z0; k <= z1; k++) {
      const key = `${i},${k}`
      let cell = this._cells.get(key)
      if (!cell) this._cells.set(key, cell = [])
      cell.push(entry.id)
    }
  }

  private _unindex(id: number) {
    if (this._big.delete(id)) return
    const range = this._range.get(id)
    if (!range) return
    this._range.delete(id)
    const [x0, x1, z0, z1] = range
    for (let i = x0; i <= x1; i++) for (let k = z0; k <= z1; k++) {
      const key = `${i},${k}`
      const cell = this._cells.get(key)
      if (!cell) continue
      const at = cell.indexOf(id)
      if (at >= 0) cell.splice(at, 1)
      if (!cell.length) this._cells.delete(key)
    }
  }

  /** XZ 区域内的候选，按 id 升序（只按格子筛，不做精确判定） */
  candidates(minX: number, minZ: number, maxX: number, maxZ: number, filter?: BodyFilter): BodyEntry[] {
    const x0 = Math.floor(minX / GRID_CELL), x1 = Math.floor(maxX / GRID_CELL)
    const z0 = Math.floor(minZ / GRID_CELL), z1 = Math.floor(maxZ / GRID_CELL)
    const count = (x1 - x0 + 1) * (z1 - z0 + 1)
    let ids: Iterable<number>
    if (!Number.isFinite(count) || count >= this._cells.size) {
      ids = this._entries.keys()
    } else {
      const set = new Set<number>(this._big)
      for (let i = x0; i <= x1; i++) for (let k = z0; k <= z1; k++) {
        const cell = this._cells.get(`${i},${k}`)
        if (cell) for (const id of cell) set.add(id)
      }
      ids = set
    }
    const out: BodyEntry[] = []
    for (const id of ids) {
      const entry = this._entries.get(id)!
      if (!filter || filter(entry)) out.push(entry)
    }
    return out.sort((a, b) => a.id - b.id)
  }

  // ------------------------------------------------------------ move（照搬 saltline Collision）

  /** 运动学角色移动：改 pos、mover.vel、mover.grounded。filter 由调用方给出（solid、层、跳过自己） */
  move(pos: number[], mover: Mover, options: MoveOptions, filter: BodyFilter): MoveResult {
    const r = options.radius ?? 0.3
    const h = options.height ?? 1.8
    const stepUp = options.stepUp ?? 0
    const dt = options.dt ?? 0
    const ground = options.ground ?? null
    const v = mover.vel
    const dist = Math.max(Math.abs(v[0]), Math.abs(v[1]), Math.abs(v[2])) * dt
    const n = Math.min(64, Math.max(1, Math.ceil(dist / MAX_STEP)))
    const startGrounded = mover.grounded
    const result: MoveResult = { grounded: false, landed: false, hitWall: false, hitCeiling: false }
    for (let i = 0; i < n; i++) this._step(pos, mover, r, h, stepUp, dt / n, ground, filter, result)
    result.grounded = mover.grounded
    result.landed = mover.grounded && !startGrounded
    return result
  }

  private _step(p: number[], mover: Mover, r: number, h: number, stepUp: number, dt: number, ground: MoveOptions['ground'], filter: BodyFilter, result: MoveResult) {
    const v = mover.vel
    const wasGrounded = mover.grounded
    const reach = r + Math.max(Math.abs(v[0]), Math.abs(v[2])) * dt + MARGIN
    const boxes = this.candidates(p[0] - reach, p[2] - reach, p[0] + reach, p[2] + reach, filter)
    const hit = (b: BodyEntry, x: number, y: number, z: number) =>
      x + r > b.min[0] && x - r < b.max[0] && z + r > b.min[2] && z - r < b.max[2] && y + h > b.min[1] && y < b.max[1]
    const blocked = (x: number, y: number, z: number) => {
      for (const b of boxes) if (hit(b, x, y, z)) return true
      return false
    }
    const floor = (x: number): number | null => (ground && (ground.maxX == null || x <= ground.maxX) ? ground.y : null)

    for (const axis of [0, 2] as const) {
      const d = v[axis] * dt
      if (!d) continue
      const next = [p[0], p[1], p[2]]
      next[axis] += d
      for (const b of boxes) {
        if (!hit(b, next[0], next[1], next[2])) continue
        const rise = b.max[1] - next[1]
        if (wasGrounded && rise > 0 && rise <= stepUp && !blocked(next[0], b.max[1] + EPS, next[2])) {
          next[1] = b.max[1] + EPS
          continue
        }
        next[axis] = d > 0 ? b.min[axis] - r - EPS : b.max[axis] + r + EPS
        v[axis] = 0
        result.hitWall = true
      }
      p[0] = next[0]
      p[1] = next[1]
      p[2] = next[2]
    }

    const dy = v[1] * dt
    let ny = p[1] + dy
    mover.grounded = false
    for (const b of boxes) {
      if (!hit(b, p[0], ny, p[2])) continue
      if (dy <= 0 && b.max[1] <= p[1] + 0.06) {
        ny = b.max[1]
        v[1] = 0
        mover.grounded = true
      } else if (dy > 0 && b.min[1] >= p[1] + h - 0.06) {
        ny = b.min[1] - h - EPS
        v[1] = 0
        result.hitCeiling = true
      }
    }
    const f = floor(p[0])
    if (f !== null && ny <= f && p[1] >= f - 0.3) {
      ny = f
      if (v[1] < 0) v[1] = 0
      mover.grounded = true
    }
    p[1] = ny
    // 下坡、下台阶时吸附到 stepUp 以内的支撑面
    if (!mover.grounded && wasGrounded && v[1] <= 0) {
      const x = p[0], y = p[1], z = p[2], up = 0.02
      let best: number | null = null
      const g = floor(x)
      if (g !== null && g <= y + up && g >= y - stepUp) best = g
      for (const b of boxes) {
        const top = b.max[1]
        if (top > y + up || top < y - stepUp) continue
        if (x + r > b.min[0] && x - r < b.max[0] && z + r > b.min[2] && z - r < b.max[2]) {
          if (best === null || top > best) best = top
        }
      }
      if (best !== null) {
        p[1] = best
        v[1] = 0
        mover.grounded = true
      }
    }
  }

  // ------------------------------------------------------------ raycast

  /** 最近的命中；起点在碰撞体内部时忽略它；距离相同取 id 小的 */
  raycast(from: number[], dir: number[], maxDist: number, filter?: BodyFilter): RayHitEntry | null {
    const len = Math.hypot(dir[0], dir[1], dir[2])
    if (!len || !(maxDist >= 0)) return null
    const d: V3 = [dir[0] / len, dir[1] / len, dir[2] / len]
    const o: V3 = [from[0], from[1], from[2]]
    let list: BodyEntry[]
    if (Number.isFinite(maxDist)) {
      const ex = o[0] + d[0] * maxDist, ez = o[2] + d[2] * maxDist
      list = this.candidates(Math.min(o[0], ex), Math.min(o[2], ez), Math.max(o[0], ex), Math.max(o[2], ez), filter)
    } else {
      list = this.candidates(-Infinity, -Infinity, Infinity, Infinity, filter)
    }
    let best: RayHitEntry | null = null
    for (const b of list) {
      const hit = b.kind === 'box' ? rayBox(o, d, b.min, b.max) : b.kind === 'sphere' ? raySphere(o, d, b.c, b.r) : rayCapsule(o, d, b)
      if (!hit || hit.t > maxDist || (best && hit.t >= best.dist)) continue
      best = { id: b.id, dist: hit.t, point: [o[0] + d[0] * hit.t, o[1] + d[1] * hit.t, o[2] + d[2] * hit.t], normal: hit.n }
    }
    return best
  }

  // ------------------------------------------------------------ overlap

  /** 与给定形状重叠的碰撞体 id，升序 */
  overlap(shape: OverlapShape, at: number[], filter?: BodyFilter): number[] {
    const out: number[] = []
    if (shape.kind === 'sphere') {
      const r = shape.radius
      for (const b of this.candidates(at[0] - r, at[2] - r, at[0] + r, at[2] + r, filter)) {
        if (sphereHits(at, r, b)) out.push(b.id)
      }
      return out
    }
    const hx = shape.size[0] / 2, hy = shape.size[1] / 2, hz = shape.size[2] / 2
    const min: V3 = [at[0] - hx, at[1] - hy, at[2] - hz], max: V3 = [at[0] + hx, at[1] + hy, at[2] + hz]
    for (const b of this.candidates(min[0], min[2], max[0], max[2], filter)) {
      const hits = b.kind === 'sphere'
        ? dist2Box(b.c, min, max) < b.r * b.r
        : min[0] < b.max[0] && max[0] > b.min[0] && min[1] < b.max[1] && max[1] > b.min[1] && min[2] < b.max[2] && max[2] > b.min[2]
      if (hits) out.push(b.id)
    }
    return out
  }
}

function dist2Box(p: ArrayLike<number>, min: V3, max: V3) {
  let d2 = 0
  for (let i = 0; i < 3; i++) {
    const q = clamp(p[i], min[i], max[i]) - p[i]
    d2 += q * q
  }
  return d2
}

/** 点到胶囊中轴线段的距离平方 */
function dist2Segment(p: ArrayLike<number>, b: BodyEntry) {
  const y = clamp(p[1], b.c[1] - b.seg, b.c[1] + b.seg)
  const dx = p[0] - b.c[0], dy = p[1] - y, dz = p[2] - b.c[2]
  return dx * dx + dy * dy + dz * dz
}

function sphereHits(at: number[], r: number, b: BodyEntry) {
  if (b.kind === 'box') return dist2Box(at, b.min, b.max) < r * r
  const rr = r + b.r
  if (b.kind === 'sphere') {
    const dx = at[0] - b.c[0], dy = at[1] - b.c[1], dz = at[2] - b.c[2]
    return dx * dx + dy * dy + dz * dz < rr * rr
  }
  return dist2Segment(at, b) < rr * rr
}

interface RayT {
  t: number
  n: V3
}

function rayBox(o: V3, d: V3, min: V3, max: V3): RayT | null {
  let tmin = -Infinity, tmax = Infinity, axis = -1
  for (let i = 0; i < 3; i++) {
    if (d[i] === 0) {
      if (o[i] <= min[i] || o[i] >= max[i]) return null
      continue
    }
    let t1 = (min[i] - o[i]) / d[i], t2 = (max[i] - o[i]) / d[i]
    if (t1 > t2) [t1, t2] = [t2, t1]
    if (t1 > tmin) {
      tmin = t1
      axis = i
    }
    if (t2 < tmax) tmax = t2
  }
  // 起点在盒内（或盒在身后）
  if (axis < 0 || tmin < 0 || tmax < tmin) return null
  const n: V3 = [0, 0, 0]
  n[axis] = d[axis] > 0 ? -1 : 1
  return { t: tmin, n }
}

function raySphere(o: V3, d: V3, c: V3, r: number): RayT | null {
  const mx = o[0] - c[0], my = o[1] - c[1], mz = o[2] - c[2]
  const cc = mx * mx + my * my + mz * mz - r * r
  if (cc < 0) return null
  const b = mx * d[0] + my * d[1] + mz * d[2]
  if (b > 0) return null
  const disc = b * b - cc
  if (disc < 0) return null
  const t = -b - Math.sqrt(disc)
  if (t < 0) return null
  return { t, n: [(o[0] + d[0] * t - c[0]) / r, (o[1] + d[1] * t - c[1]) / r, (o[2] + d[2] * t - c[2]) / r] }
}

/** 竖直胶囊：侧面（圆柱段）与两端半球取最近 */
function rayCapsule(o: V3, d: V3, b: BodyEntry): RayT | null {
  const r = b.r, c = b.c
  if (dist2Segment(o, b) < r * r) return null
  let best: RayT | null = null
  const a = d[0] * d[0] + d[2] * d[2]
  if (a > 1e-12) {
    const ox = o[0] - c[0], oz = o[2] - c[2]
    const bb = ox * d[0] + oz * d[2]
    const cc = ox * ox + oz * oz - r * r
    const disc = bb * bb - a * cc
    if (disc >= 0) {
      const t = (-bb - Math.sqrt(disc)) / a
      const y = o[1] + d[1] * t
      if (t >= 0 && y >= c[1] - b.seg && y <= c[1] + b.seg) {
        best = { t, n: [(o[0] + d[0] * t - c[0]) / r, 0, (o[2] + d[2] * t - c[2]) / r] }
      }
    }
  }
  for (const sy of [c[1] - b.seg, c[1] + b.seg]) {
    const hit = raySphere(o, d, [c[0], sy, c[2]], r)
    if (hit && (!best || hit.t < best.t)) best = hit
  }
  return best
}
