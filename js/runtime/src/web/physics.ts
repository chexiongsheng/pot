/**
 * Web 宿主的碰撞与射线（004 第 20.9 节）：collider / colliderShape / layer / raycast / sphereCast，语义照 PotScene.cs。
 * 纯数据，不碰 DOM 与 WebGL，Node 测试可直接使用。状态存在 o.ext：
 *   colliderKind  'mesh' | 'convex' | 'box'（colliderShape 换过形状时才有）
 *   colliderOff   true 表示碰撞体已关闭
 *   layer         0 到 31，默认 0
 *   _phys         碰撞形状缓存（按 scene.version 与网格数据失效）
 * 碰撞体与 Unity 一致：cube 为 BoxCollider；sphere 为 SphereCollider（半径 0.5 × 最大轴缩放）；
 * capsule、cylinder 为 CapsuleCollider（半径 0.5 × max(|sx|, |sz|)，高 2 × |sy|，轴 Y）；plane、quad 与 mesh: 为单面 MeshCollider；
 * skin: 与 empty 没有碰撞体。近似：convex 按双面网格处理（不求凸包）；层级里有切变时盒子的球体扫掠按正交盒近似。
 */
import type { RaycastResult } from '../host'
import { primitiveMesh } from './geometry'
import { M4, invert } from './math'
import type { WebObject, WebScene } from './scene'

type V = [number, number, number]

/** Physics.DefaultRaycastLayers：除 Ignore Raycast（第 2 层）外的所有层 */
const DEFAULT_LAYERS = ~(1 << 2)
const LEAF_SIZE = 8

// ---------------- 向量小工具 ----------------

const sub = (a: ArrayLike<number>, b: ArrayLike<number>): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const dot = (a: ArrayLike<number>, b: ArrayLike<number>) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a: ArrayLike<number>, b: ArrayLike<number>): V => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const madd = (a: ArrayLike<number>, b: ArrayLike<number>, s: number): V => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s]
const len = (a: ArrayLike<number>) => Math.hypot(a[0], a[1], a[2])
/** t 为有限值且不超过 limit */
const within = (t: number, limit: number) => t < Infinity && t <= limit

function normalize(a: ArrayLike<number>, fallback: V = [0, 1, 0]): V {
  const l = len(a)
  return l > 1e-20 ? [a[0] / l, a[1] / l, a[2] / l] : fallback
}

function point(m: ArrayLike<number>, x: number, y: number, z: number): V {
  return [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]]
}

function vector(m: ArrayLike<number>, v: ArrayLike<number>): V {
  return [m[0] * v[0] + m[4] * v[1] + m[8] * v[2], m[1] * v[0] + m[5] * v[1] + m[9] * v[2], m[2] * v[0] + m[6] * v[1] + m[10] * v[2]]
}

/** 局部法线 → 世界法线（逆转置；inv 为世界矩阵的逆） */
function normalToWorld(inv: ArrayLike<number>, n: ArrayLike<number>): V {
  return normalize([
    inv[0] * n[0] + inv[1] * n[1] + inv[2] * n[2],
    inv[4] * n[0] + inv[5] * n[1] + inv[6] * n[2],
    inv[8] * n[0] + inv[9] * n[1] + inv[10] * n[2],
  ])
}

function det3(m: ArrayLike<number>): number {
  return m[0] * (m[5] * m[10] - m[9] * m[6]) - m[4] * (m[1] * m[10] - m[9] * m[2]) + m[8] * (m[1] * m[6] - m[5] * m[2])
}

function closestOnSegment(p: ArrayLike<number>, a: ArrayLike<number>, b: ArrayLike<number>): V {
  const ab = sub(b, a)
  const l2 = dot(ab, ab)
  const t = l2 > 1e-20 ? Math.max(0, Math.min(1, dot(sub(p, a), ab) / l2)) : 0
  return madd(a, ab, t)
}

/** 三角形上离 p 最近的点（Ericson《Real-Time Collision Detection》5.1.5） */
export function closestOnTriangle(p: ArrayLike<number>, a: ArrayLike<number>, b: ArrayLike<number>, c: ArrayLike<number>): V {
  const ab = sub(b, a), ac = sub(c, a), ap = sub(p, a)
  const d1 = dot(ab, ap), d2 = dot(ac, ap)
  if (d1 <= 0 && d2 <= 0) return [a[0], a[1], a[2]]
  const bp = sub(p, b)
  const d3 = dot(ab, bp), d4 = dot(ac, bp)
  if (d3 >= 0 && d4 <= d3) return [b[0], b[1], b[2]]
  const vc = d1 * d4 - d3 * d2
  if (vc <= 0 && d1 >= 0 && d3 <= 0) return madd(a, ab, d1 / (d1 - d3))
  const cp = sub(p, c)
  const d5 = dot(ab, cp), d6 = dot(ac, cp)
  if (d6 >= 0 && d5 <= d6) return [c[0], c[1], c[2]]
  const vb = d5 * d2 - d1 * d6
  if (vb <= 0 && d2 >= 0 && d6 <= 0) return madd(a, ac, d2 / (d2 - d6))
  const va = d3 * d6 - d5 * d4
  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) return madd(b, sub(c, b), (d4 - d3) / (d4 - d3 + (d5 - d6)))
  const denom = 1 / (va + vb + vc)
  const v = vb * denom, w = vc * denom
  return [a[0] + ab[0] * v + ac[0] * w, a[1] + ab[1] * v + ac[1] * w, a[2] + ab[2] * v + ac[2] * w]
}

// ---------------- 基本求交（世界空间时 d 为单位向量） ----------------

/** 射线进入盒子 [lo - r, hi + r] 的参数：返回 [t0, t1, 进入轴]；未相交返回 null。t0 < 0 表示起点在盒内 */
function slab(o: ArrayLike<number>, d: ArrayLike<number>, lo: ArrayLike<number>, hi: ArrayLike<number>, r: number): [number, number, number] | null {
  let t0 = -Infinity, t1 = Infinity, axis = -1
  for (let k = 0; k < 3; k++) {
    const l = lo[k] - r, h = hi[k] + r
    if (Math.abs(d[k]) < 1e-15) {
      if (o[k] < l || o[k] > h) return null
      continue
    }
    let a = (l - o[k]) / d[k], b = (h - o[k]) / d[k]
    if (a > b) { const s = a; a = b; b = s }
    if (a > t0) { t0 = a; axis = k }
    if (b < t1) t1 = b
    if (t0 > t1) return null
  }
  if (t1 < 0) return null
  return [t0, t1, axis]
}

/** 射线与球的进入距离（起点在球外）；没命中返回 Infinity */
function raySphere(o: ArrayLike<number>, d: ArrayLike<number>, c: ArrayLike<number>, r: number): number {
  const oc = sub(o, c)
  const b = dot(d, oc)
  const h = b * b - (dot(oc, oc) - r * r)
  if (h < 0) return Infinity
  const t = -b - Math.sqrt(h)
  return t >= 0 ? t : Infinity
}

/** 射线与胶囊（线段 pa-pb、半径 r）的进入距离（起点在胶囊外）；没命中返回 Infinity */
function rayCapsule(o: ArrayLike<number>, d: ArrayLike<number>, pa: ArrayLike<number>, pb: ArrayLike<number>, r: number): number {
  let best = Infinity
  const ba = sub(pb, pa)
  const baba = dot(ba, ba)
  if (baba > 1e-20) {
    // 侧面（无限长圆柱，交点须落在线段范围内）
    const oa = sub(o, pa)
    const bard = dot(ba, d), baoa = dot(ba, oa), rdoa = dot(d, oa), oaoa = dot(oa, oa)
    const a = baba - bard * bard
    if (a > 1e-9 * baba) {
      const b = baba * rdoa - baoa * bard
      const c = baba * oaoa - baoa * baoa - r * r * baba
      const h = b * b - a * c
      if (h >= 0) {
        const t = (-b - Math.sqrt(h)) / a
        const y = baoa + t * bard
        if (t >= 0 && y >= 0 && y <= baba) best = t
      }
    }
    best = Math.min(best, raySphere(o, d, pb, r))
  }
  return Math.min(best, raySphere(o, d, pa, r))
}

// ---------------- 三角形 BVH（局部空间） ----------------

interface BNode {
  lo: V
  hi: V
  a?: BNode
  b?: BNode
  start: number
  count: number
}

interface Bvh {
  pos: Float32Array
  idx: Uint32Array
  /** 三角形首个索引的位置（idx 下标），按节点连续排列 */
  tris: Uint32Array
  root: BNode | null
}

function buildBvh(pos: Float32Array, idx: Uint32Array): Bvh {
  const vc = Math.floor(pos.length / 3)
  const list: number[] = []
  for (let t = 0; t + 2 < idx.length; t += 3) if (idx[t] < vc && idx[t + 1] < vc && idx[t + 2] < vc) list.push(t)
  const tris = Uint32Array.from(list)
  const cen = new Float64Array(idx.length)
  for (const t of list) {
    for (let k = 0; k < 3; k++) cen[t + k] = (pos[idx[t] * 3 + k] + pos[idx[t + 1] * 3 + k] + pos[idx[t + 2] * 3 + k]) / 3
  }
  const build = (start: number, count: number): BNode => {
    const lo: V = [Infinity, Infinity, Infinity], hi: V = [-Infinity, -Infinity, -Infinity]
    const clo: V = [Infinity, Infinity, Infinity], chi: V = [-Infinity, -Infinity, -Infinity]
    for (let i = start; i < start + count; i++) {
      const t = tris[i]
      for (let j = 0; j < 3; j++) {
        const v = idx[t + j] * 3
        for (let k = 0; k < 3; k++) {
          if (pos[v + k] < lo[k]) lo[k] = pos[v + k]
          if (pos[v + k] > hi[k]) hi[k] = pos[v + k]
        }
      }
      for (let k = 0; k < 3; k++) {
        if (cen[t + k] < clo[k]) clo[k] = cen[t + k]
        if (cen[t + k] > chi[k]) chi[k] = cen[t + k]
      }
    }
    const node: BNode = { lo, hi, start, count }
    if (count <= LEAF_SIZE) return node
    let axis = 0
    for (let k = 1; k < 3; k++) if (chi[k] - clo[k] > chi[axis] - clo[axis]) axis = k
    if (chi[axis] - clo[axis] < 1e-12) return node
    const part = Array.from(tris.subarray(start, start + count)).sort((x, y) => cen[x + axis] - cen[y + axis])
    tris.set(part, start)
    const half = count >> 1
    node.a = build(start, half)
    node.b = build(start + half, count - half)
    return node
  }
  return { pos, idx, tris, root: tris.length ? build(0, tris.length) : null }
}

const bvhCache = new WeakMap<Float32Array, { idx: Uint32Array; bvh: Bvh }>()

function bvhOf(pos: Float32Array, idx: Uint32Array): Bvh {
  const c = bvhCache.get(pos)
  if (c && c.idx === idx) return c.bvh
  const bvh = buildBvh(pos, idx)
  bvhCache.set(pos, { idx, bvh })
  return bvh
}

/** 遍历射线（局部空间，节点盒扩大 r）经过的三角形；limit() 返回当前最近命中距离，用于剪枝 */
function traverse(bvh: Bvh, o: V, d: V, r: number, limit: () => number, visit: (t: number) => boolean | void): void {
  if (!bvh.root) return
  const stack: BNode[] = [bvh.root]
  while (stack.length) {
    const n = stack.pop()!
    const s = slab(o, d, n.lo, n.hi, r)
    if (!s || Math.max(s[0], 0) > limit()) continue
    if (n.a && n.b) {
      stack.push(n.b, n.a)
      continue
    }
    for (let i = n.start; i < n.start + n.count; i++) if (visit(bvh.tris[i])) return
  }
}

// ---------------- 碰撞形状 ----------------

type Shape =
  | { kind: 'box'; lo: V; hi: V; m: M4; inv: M4; wlo: V; whi: V }
  | { kind: 'mesh'; bvh: Bvh; twoSided: boolean; m: M4; inv: M4; flip: number; invNorm: number; wlo: V; whi: V }
  | { kind: 'sphere'; c: V; r: number; wlo: V; whi: V }
  | { kind: 'capsule'; a: V; b: V; r: number; wlo: V; whi: V }

interface MeshSource {
  pos: Float32Array
  idx: Uint32Array
  vertexCount: number
  min: V
  max: V
}

const primitiveBounds = new WeakMap<Float32Array, [V, V]>()

function boundsOf(pos: Float32Array): [V, V] {
  let b = primitiveBounds.get(pos)
  if (b) return b
  const lo: V = [Infinity, Infinity, Infinity], hi: V = [-Infinity, -Infinity, -Infinity]
  for (let i = 0; i + 2 < pos.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      if (pos[i + k] < lo[k]) lo[k] = pos[i + k]
      if (pos[i + k] > hi[k]) hi[k] = pos[i + k]
    }
  }
  if (pos.length < 3) { lo.fill(0); hi.fill(0) }
  b = [lo, hi]
  primitiveBounds.set(pos, b)
  return b
}

function worldBoxOf(m: ArrayLike<number>, lo: V, hi: V): [V, V] {
  const wlo: V = [Infinity, Infinity, Infinity], whi: V = [-Infinity, -Infinity, -Infinity]
  for (let i = 0; i < 8; i++) {
    const p = point(m, i & 1 ? hi[0] : lo[0], i & 2 ? hi[1] : lo[1], i & 4 ? hi[2] : lo[2])
    for (let k = 0; k < 3; k++) {
      if (p[k] < wlo[k]) wlo[k] = p[k]
      if (p[k] > whi[k]) whi[k] = p[k]
    }
  }
  return [wlo, whi]
}

/** 命中记录（世界空间） */
interface Hit {
  t: number
  id: number
  point: V
  normal: V
}

export class WebPhysics {
  constructor(private readonly scene: WebScene) {}

  /** 对象的网格数据：mesh: 取注册的网格，图元取内置网格；empty、skin:、相机没有 */
  private meshOf(o: WebObject): MeshSource | undefined {
    if (o.shape.startsWith('mesh:')) {
      const m = this.scene.meshes.get(o.shape.slice(5))
      return m ? { pos: m.positions, idx: m.indices, vertexCount: m.vertexCount, min: m.min, max: m.max } : undefined
    }
    const p = primitiveMesh(o.shape)
    if (!p) return undefined
    const [min, max] = boundsOf(p.positions)
    return { pos: p.positions, idx: p.indices, vertexCount: Math.floor(p.positions.length / 3), min, max }
  }

  /** 开关碰撞体（SetCollider） */
  collider(id: number, enabled: boolean): void {
    const o = this.scene.get(id)
    if (o) o.ext.colliderOff = !enabled
  }

  /** 换碰撞体形状（SetColliderShape）：mesh / convex / box，空串不换；dynamic 在 Web 上不影响查询。成功返回空串 */
  colliderShape(id: number, kind: string, dynamic: boolean): string {
    void dynamic
    const o = this.scene.get(id)
    if (!o || o.shape === 'camera') return '实体不存在'
    if (o.shape.startsWith('skin:')) return '蒙皮实体没有碰撞体，命中体另挂在骨骼下'
    if (kind) {
      if (kind !== 'mesh' && kind !== 'convex' && kind !== 'box') return '形状只能是 mesh、convex 或 box'
      if (!this.meshOf(o)) return `没有网格，不能用 ${kind} 碰撞体`
      o.ext.colliderKind = kind
    }
    return ''
  }

  /** 设置层（0 到 31） */
  layer(id: number, layer: number): void {
    const o = this.scene.get(id)
    if (o) o.ext.layer = Math.max(0, Math.min(31, Math.trunc(layer) || 0))
  }

  /** 对象当前的碰撞形状（世界空间数据，带缓存）；没有碰撞体返回 null */
  shapeOf(o: WebObject): Shape | null {
    if (o.ext.colliderOff || o.shape === 'camera' || o.shape === 'empty' || o.shape.startsWith('skin:')) return null
    const src = this.meshOf(o)
    if (!src) return null
    const kind: string | undefined = o.ext.colliderKind ?? (o.shape.startsWith('mesh:') ? 'mesh' : undefined)
    const c = o.ext._phys
    if (c && c.v === this.scene.version && c.pos === src.pos && c.idx === src.idx && c.kind === kind) return c.shape
    const shape = this.buildShape(o, src, kind)
    o.ext._phys = { v: this.scene.version, pos: src.pos, idx: src.idx, kind, shape }
    return shape
  }

  private buildShape(o: WebObject, src: MeshSource, kind: string | undefined): Shape | null {
    const m = this.scene.worldMatrix(o)
    const sx = Math.hypot(m[0], m[1], m[2]), sy = Math.hypot(m[4], m[5], m[6]), sz = Math.hypot(m[8], m[9], m[10])
    if (!kind && o.shape === 'sphere') {
      const c: V = [m[12], m[13], m[14]]
      const r = 0.5 * Math.max(sx, sy, sz)
      return { kind: 'sphere', c, r, wlo: [c[0] - r, c[1] - r, c[2] - r], whi: [c[0] + r, c[1] + r, c[2] + r] }
    }
    if (!kind && (o.shape === 'capsule' || o.shape === 'cylinder')) {
      const c: V = [m[12], m[13], m[14]]
      const r = 0.5 * Math.max(sx, sz)
      const half = Math.max(0, sy - r)
      const axis = normalize([m[4], m[5], m[6]])
      const a = madd(c, axis, -half), b = madd(c, axis, half)
      const wlo: V = [0, 0, 0], whi: V = [0, 0, 0]
      for (let k = 0; k < 3; k++) {
        wlo[k] = Math.min(a[k], b[k]) - r
        whi[k] = Math.max(a[k], b[k]) + r
      }
      return { kind: 'capsule', a, b, r, wlo, whi }
    }
    const inv = invert(m)
    if (!Number.isFinite(inv[0]) || Math.abs(det3(m)) < 1e-30) return null
    if ((!kind && o.shape === 'cube') || kind === 'box') {
      const lo: V = kind === 'box' ? [...src.min] : [-0.5, -0.5, -0.5]
      const hi: V = kind === 'box' ? [...src.max] : [0.5, 0.5, 0.5]
      const [wlo, whi] = worldBoxOf(m, lo, hi)
      return { kind: 'box', lo, hi, m: new Float32Array(m), inv, wlo, whi }
    }
    // 网格碰撞体：退化网格不建（与 PotScene.Degenerate 一致）
    const size = sub(src.max, src.min)
    if (src.vertexCount < 3 || dot(size, size) <= 1e-12) return null
    const bvh = bvhOf(src.pos, src.idx)
    if (!bvh.root) return null
    const [wlo, whi] = worldBoxOf(m, src.min, src.max)
    let fro = 0
    for (const i of [0, 1, 2, 4, 5, 6, 8, 9, 10]) fro += inv[i] * inv[i]
    return {
      kind: 'mesh', bvh, twoSided: kind === 'convex', m: new Float32Array(m), inv,
      flip: det3(m) < 0 ? -1 : 1, invNorm: Math.sqrt(fro), wlo, whi,
    }
  }

  /** 参与检测的对象：在层级中启用、有碰撞体、层在掩码内 */
  private *candidates(mask: number): Generator<[WebObject, Shape]> {
    const layers = mask === 0 ? DEFAULT_LAYERS : mask
    for (const o of this.scene.objects.values()) {
      if (o.shape === 'camera') continue
      const layer: number = o.ext.layer ?? 0
      if (((layers >>> layer) & 1) === 0) continue
      if (!this.scene.activeInHierarchy(o)) continue
      const s = this.shapeOf(o)
      if (s) yield [o, s]
    }
  }

  /** 射线检测（Physics.Raycast）：起点在碰撞体内部时该碰撞体不算命中；maxDistance ≤ 0 表示无穷远 */
  raycast(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, maxDistance: number, mask: number): RaycastResult | null {
    const dl = Math.hypot(dx, dy, dz)
    if (dl * dl < 1e-12) return null
    const o: V = [ox, oy, oz], d: V = [dx / dl, dy / dl, dz / dl]
    const best: Hit = { t: maxDistance > 0 ? maxDistance : Infinity, id: 0, point: [0, 0, 0], normal: [0, 1, 0] }
    for (const [obj, s] of this.candidates(mask)) {
      const b = slab(o, d, s.wlo, s.whi, 0)
      if (!b || Math.max(b[0], 0) > best.t) continue
      switch (s.kind) {
        case 'sphere': {
          const oc = sub(o, s.c)
          if (dot(oc, oc) < s.r * s.r) break
          const t = raySphere(o, d, s.c, s.r)
          if (within(t, best.t)) this.record(best, obj.id, t, madd(o, d, t), (p) => normalize(sub(p, s.c)))
          break
        }
        case 'capsule': {
          const q = closestOnSegment(o, s.a, s.b)
          if (dot(sub(o, q), sub(o, q)) < s.r * s.r) break
          const t = rayCapsule(o, d, s.a, s.b, s.r)
          if (within(t, best.t)) this.record(best, obj.id, t, madd(o, d, t), (p) => normalize(sub(p, closestOnSegment(p, s.a, s.b))))
          break
        }
        case 'box': {
          const lo = point(s.inv, o[0], o[1], o[2]), ld = vector(s.inv, d)
          const h = slab(lo, ld, s.lo, s.hi, 0)
          if (!h || h[0] < 0 || h[0] > best.t || h[2] < 0) break
          const n: V = [0, 0, 0]
          n[h[2]] = ld[h[2]] > 0 ? -1 : 1
          this.record(best, obj.id, h[0], madd(o, d, h[0]), () => normalToWorld(s.inv, n))
          break
        }
        case 'mesh': {
          const lo = point(s.inv, o[0], o[1], o[2]), ld = vector(s.inv, d)
          const { pos, idx } = s.bvh
          const st = { t: best.t, n: null as V | null }
          traverse(s.bvh, lo, ld, 0, () => st.t, (t) => {
            const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3
            const e1: V = [pos[b] - pos[a], pos[b + 1] - pos[a + 1], pos[b + 2] - pos[a + 2]]
            const e2: V = [pos[c] - pos[a], pos[c + 1] - pos[a + 1], pos[c + 2] - pos[a + 2]]
            const p = cross(ld, e2)
            const det = dot(e1, p)
            // 单面：顺时针为正面，det > 0 表示射线迎着 cross(e1, e2)
            if (det === 0 || (!s.twoSided && det < 0)) return
            const inv = 1 / det
            const sv: V = [lo[0] - pos[a], lo[1] - pos[a + 1], lo[2] - pos[a + 2]]
            const u = dot(sv, p) * inv
            if (u < 0 || u > 1) return
            const q = cross(sv, e1)
            const v = dot(ld, q) * inv
            if (v < 0 || u + v > 1) return
            const tt = dot(e2, q) * inv
            if (tt < 0 || tt > st.t) return
            st.t = tt
            const n = cross(e1, e2)
            st.n = det < 0 ? [-n[0], -n[1], -n[2]] : n
          })
          const hn = st.n
          if (hn) this.record(best, obj.id, st.t, madd(o, d, st.t), () => normalToWorld(s.inv, hn))
          break
        }
      }
    }
    return best.id ? { id: best.id, point: best.point, normal: best.normal, distance: best.t } : null
  }

  /** 球体扫掠（Physics.SphereCast）：起点已与碰撞体重叠时该碰撞体不算命中；radius 须大于 0 */
  sphereCast(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, radius: number, maxDistance: number, mask: number): RaycastResult | null {
    const dl = Math.hypot(dx, dy, dz)
    if (dl * dl < 1e-12 || !(radius > 0)) return null
    const r = radius
    const o: V = [ox, oy, oz], d: V = [dx / dl, dy / dl, dz / dl]
    const best: Hit = { t: maxDistance > 0 ? maxDistance : Infinity, id: 0, point: [0, 0, 0], normal: [0, 1, 0] }
    for (const [obj, s] of this.candidates(mask)) {
      const b = slab(o, d, s.wlo, s.whi, r)
      if (!b || Math.max(b[0], 0) > best.t) continue
      switch (s.kind) {
        case 'sphere': {
          const R = s.r + r
          const oc = sub(o, s.c)
          if (dot(oc, oc) < R * R) break
          const t = raySphere(o, d, s.c, R)
          if (within(t, best.t)) {
            const n = normalize(sub(madd(o, d, t), s.c))
            this.set(best, obj.id, t, madd(s.c, n, s.r), n)
          }
          break
        }
        case 'capsule': {
          const R = s.r + r
          const q0 = closestOnSegment(o, s.a, s.b)
          if (dot(sub(o, q0), sub(o, q0)) < R * R) break
          const t = rayCapsule(o, d, s.a, s.b, R)
          if (within(t, best.t)) {
            const c = madd(o, d, t)
            const q = closestOnSegment(c, s.a, s.b)
            const n = normalize(sub(c, q))
            this.set(best, obj.id, t, madd(q, n, s.r), n)
          }
          break
        }
        case 'box':
          this.sweepBox(best, obj.id, s, o, d, r)
          break
        case 'mesh':
          this.sweepMesh(best, obj.id, s, o, d, r)
          break
      }
    }
    return best.id ? { id: best.id, point: best.point, normal: best.normal, distance: best.t } : null
  }

  private record(best: Hit, id: number, t: number, p: V, normal: (p: V) => V): void {
    if (!(within(t, best.t))) return
    this.set(best, id, t, p, normal(p))
  }

  private set(best: Hit, id: number, t: number, p: V, n: V): void {
    best.t = t
    best.id = id
    best.point = p
    best.normal = n
  }

  /** 盒子扫掠：在盒子的正交标架里求射线与圆角盒（三块扩展板 + 12 条棱胶囊）的最近进入点 */
  private sweepBox(best: Hit, id: number, s: Extract<Shape, { kind: 'box' }>, o: V, d: V, r: number): void {
    const m = s.m
    const cols: V[] = [[m[0], m[1], m[2]], [m[4], m[5], m[6]], [m[8], m[9], m[10]]]
    const scale = cols.map(len)
    if (scale.some((x) => x < 1e-12)) return
    const u = cols.map((c, k) => [c[0] / scale[k], c[1] / scale[k], c[2] / scale[k]] as V)
    const center = point(m, (s.lo[0] + s.hi[0]) / 2, (s.lo[1] + s.hi[1]) / 2, (s.lo[2] + s.hi[2]) / 2)
    const e: V = [0, 1, 2].map((k) => ((s.hi[k] - s.lo[k]) / 2) * scale[k]) as V
    const rel = sub(o, center)
    const lo: V = [dot(rel, u[0]), dot(rel, u[1]), dot(rel, u[2])]
    const ld: V = [dot(d, u[0]), dot(d, u[1]), dot(d, u[2])]
    const clamp = (p: V): V => [Math.max(-e[0], Math.min(e[0], p[0])), Math.max(-e[1], Math.min(e[1], p[1])), Math.max(-e[2], Math.min(e[2], p[2]))]
    const q0 = clamp(lo)
    if (dot(sub(lo, q0), sub(lo, q0)) < r * r) return
    let t = Infinity
    const ne: V = [-e[0], -e[1], -e[2]]
    for (let k = 0; k < 3; k++) {
      const hi: V = [e[0], e[1], e[2]], lw: V = [ne[0], ne[1], ne[2]]
      hi[k] += r
      lw[k] -= r
      const h = slab(lo, ld, lw, hi, 0)
      if (h && h[0] >= 0 && h[0] < t) t = h[0]
      // 沿第 k 轴的 4 条棱
      const k1 = (k + 1) % 3, k2 = (k + 2) % 3
      for (const s1 of [-1, 1]) {
        for (const s2 of [-1, 1]) {
          const a: V = [0, 0, 0], b: V = [0, 0, 0]
          a[k] = -e[k]; b[k] = e[k]
          a[k1] = b[k1] = s1 * e[k1]
          a[k2] = b[k2] = s2 * e[k2]
          t = Math.min(t, rayCapsule(lo, ld, a, b, r))
        }
      }
    }
    if (!(within(t, best.t))) return
    const c = madd(lo, ld, t)
    const q = clamp(c)
    const n = normalize(sub(c, q))
    const toWorld = (v: V): V => [u[0][0] * v[0] + u[1][0] * v[1] + u[2][0] * v[2], u[0][1] * v[0] + u[1][1] * v[1] + u[2][1] * v[2], u[0][2] * v[0] + u[1][2] * v[1] + u[2][2] * v[2]]
    const wq = toWorld(q)
    this.set(best, id, t, [wq[0] + center[0], wq[1] + center[1], wq[2] + center[2]], normalize(toWorld(n)))
  }

  /** 网格扫掠：BVH 在局部空间按扩展半径剪枝，三角形在世界空间求面（平移 r）与三条棱胶囊的最近进入点 */
  private sweepMesh(best: Hit, id: number, s: Extract<Shape, { kind: 'mesh' }>, o: V, d: V, r: number): void {
    const { pos, idx } = s.bvh
    const lo = point(s.inv, o[0], o[1], o[2]), ld = vector(s.inv, d)
    const rl = r * s.invNorm
    const st = { t: best.t, tri: null as [V, V, V] | null, overlap: false }
    const m = s.m
    traverse(s.bvh, lo, ld, rl, () => st.t, (t) => {
      const a = point(m, pos[idx[t] * 3], pos[idx[t] * 3 + 1], pos[idx[t] * 3 + 2])
      const b = point(m, pos[idx[t + 1] * 3], pos[idx[t + 1] * 3 + 1], pos[idx[t + 1] * 3 + 2])
      const c = point(m, pos[idx[t + 2] * 3], pos[idx[t + 2] * 3 + 1], pos[idx[t + 2] * 3 + 2])
      const q0 = closestOnTriangle(o, a, b, c)
      if (dot(sub(o, q0), sub(o, q0)) < r * r) {
        st.overlap = true
        return true
      }
      const raw = cross(sub(b, a), sub(c, a))
      const rawLen = len(raw)
      if (rawLen < 1e-20) return
      let n: V = [(raw[0] / rawLen) * s.flip, (raw[1] / rawLen) * s.flip, (raw[2] / rawLen) * s.flip]
      if (s.twoSided && dot(sub(o, a), n) < 0) n = [-n[0], -n[1], -n[2]]
      const dn = dot(d, n)
      if (!s.twoSided && dn >= 0) return
      let tt = Infinity
      if (dn < 0) {
        const t0 = (dot(sub(o, a), n) - r) / -dn
        if (t0 >= 0) {
          const p = madd(madd(o, d, t0), n, -r)
          if (insideTriangle(p, a, b, c)) tt = t0
        }
      }
      tt = Math.min(tt, rayCapsule(o, d, a, b, r), rayCapsule(o, d, b, c, r), rayCapsule(o, d, c, a, r))
      if (within(tt, st.t)) {
        st.t = tt
        st.tri = [a, b, c]
      }
    })
    if (st.overlap || !st.tri || !(within(st.t, best.t))) return
    const [a, b, c] = st.tri
    const center = madd(o, d, st.t)
    const q = closestOnTriangle(center, a, b, c)
    this.set(best, id, st.t, q, normalize(sub(center, q)))
  }
}

/** p 已在三角形平面上：重心坐标是否都在 [0, 1] */
function insideTriangle(p: V, a: V, b: V, c: V): boolean {
  const v0 = sub(b, a), v1 = sub(c, a), v2 = sub(p, a)
  const d00 = dot(v0, v0), d01 = dot(v0, v1), d11 = dot(v1, v1), d20 = dot(v2, v0), d21 = dot(v2, v1)
  const den = d00 * d11 - d01 * d01
  if (Math.abs(den) < 1e-30) return false
  const v = (d11 * d20 - d01 * d21) / den
  const w = (d00 * d21 - d01 * d20) / den
  return v >= -1e-9 && w >= -1e-9 && v + w <= 1 + 1e-9
}
