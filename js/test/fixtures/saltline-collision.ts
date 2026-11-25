/**
 * saltline 迁移到 w.move 之前的 Collision（games/saltline/src/lib/physics.ts 的原样副本，只换了 import）。
 * world-collide.test.js 用它验证 w.move 逐步一致；saltline 本身已不再使用。
 *
 * 轴对齐包围盒移动：按 X、Z、Y 分轴推进并回退，支持上台阶与向下吸附地面。
 * 角色视为竖直盒子：底面中心 pos，半宽 radius，高 height。
 */
type Vec3 = [number, number, number]
type Box = { min: number[]; max: number[] }

export interface Body {
  pos: Vec3
  vel: Vec3
  radius: number
  height: number
  grounded: boolean
}

export interface MoveResult {
  wall: boolean
  ceiling: boolean
  landed: boolean
}

const EPS = 0.001
/** 单个子步的最大位移（米），小于角色半径与最薄碰撞盒 */
const MAX_STEP = 0.2

export class Collision {
  /** 地面（y=0）存在的最大 x（码头外是海）；bounds 为可玩区域（空气墙围成的 XZ 矩形） */
  constructor(readonly boxes: Box[], readonly groundMaxX: number, readonly bounds?: { min: [number, number]; max: [number, number] }) {}

  /** 是否在可玩区域内（没有边界数据时恒为 true） */
  contains(x: number, z: number) {
    const b = this.bounds
    return !b || (x >= b.min[0] && x <= b.max[0] && z >= b.min[1] && z <= b.max[1])
  }

  floor(x: number): number | null {
    return x <= this.groundMaxX ? 0 : null
  }

  overlap(b: Box, x: number, y: number, z: number, r: number, h: number) {
    return x + r > b.min[0] && x - r < b.max[0] && z + r > b.min[2] && z - r < b.max[2] && y + h > b.min[1] && y < b.max[1]
  }

  blocked(x: number, y: number, z: number, r: number, h: number) {
    for (const b of this.boxes) if (this.overlap(b, x, y, z, r, h)) return true
    return false
  }

  /** 最高支撑面（不高于 y + up，且不低于 y - down） */
  support(x: number, y: number, z: number, r: number, down: number, up = 0.02): number | null {
    let best: number | null = null
    const f = this.floor(x)
    if (f !== null && f <= y + up && f >= y - down) best = f
    for (const b of this.boxes) {
      const top = b.max[1]
      if (top > y + up || top < y - down) continue
      if (x + r > b.min[0] && x - r < b.max[0] && z + r > b.min[2] && z - r < b.max[2]) {
        if (best === null || top > best) best = top
      }
    }
    return best
  }

  /**
   * 按子步推进：每步水平/竖直位移不超过 MAX_STEP。不分步时一帧位移超过“盒厚 + 2×半径”就会直接跨过盒子
   * （空气墙 0.6 米厚，冲刺 7 m/s 时帧率低于约 6 fps 即穿墙；窗口在后台时 Runner 只有约 4 fps）。
   */
  move(body: Body, dt: number, stepUp: number): MoveResult {
    const v = body.vel
    const dist = Math.max(Math.abs(v[0]), Math.abs(v[1]), Math.abs(v[2])) * dt
    const n = Math.min(64, Math.max(1, Math.ceil(dist / MAX_STEP)))
    const startGrounded = body.grounded
    const result: MoveResult = { wall: false, ceiling: false, landed: false }
    for (let i = 0; i < n; i++) {
      const r = this.step(body, dt / n, stepUp)
      result.wall ||= r.wall
      result.ceiling ||= r.ceiling
    }
    result.landed = body.grounded && !startGrounded
    return result
  }

  private step(body: Body, dt: number, stepUp: number): MoveResult {
    const { radius: r, height: h } = body
    const p = body.pos, v = body.vel
    const result: MoveResult = { wall: false, ceiling: false, landed: false }
    const wasGrounded = body.grounded

    for (const axis of [0, 2] as const) {
      const d = v[axis] * dt
      if (!d) continue
      const next: Vec3 = [p[0], p[1], p[2]]
      next[axis] += d
      for (const b of this.boxes) {
        if (!this.overlap(b, next[0], next[1], next[2], r, h)) continue
        const rise = b.max[1] - next[1]
        if (wasGrounded && rise > 0 && rise <= stepUp && !this.blocked(next[0], b.max[1] + EPS, next[2], r, h)) {
          next[1] = b.max[1] + EPS
          continue
        }
        next[axis] = d > 0 ? b.min[axis] - r - EPS : b.max[axis] + r + EPS
        v[axis] = 0
        result.wall = true
      }
      p[0] = next[0]
      p[1] = next[1]
      p[2] = next[2]
    }

    const dy = v[1] * dt
    let ny = p[1] + dy
    body.grounded = false
    for (const b of this.boxes) {
      if (!this.overlap(b, p[0], ny, p[2], r, h)) continue
      if (dy <= 0 && b.max[1] <= p[1] + 0.06) {
        ny = b.max[1]
        v[1] = 0
        body.grounded = true
      } else if (dy > 0 && b.min[1] >= p[1] + h - 0.06) {
        ny = b.min[1] - h - EPS
        v[1] = 0
        result.ceiling = true
      }
    }
    const f = this.floor(p[0])
    if (f !== null && ny <= f && p[1] >= f - 0.3) {
      ny = f
      if (v[1] < 0) v[1] = 0
      body.grounded = true
    }
    p[1] = ny
    // 下坡/下台阶时吸附
    if (!body.grounded && wasGrounded && v[1] <= 0) {
      const s = this.support(p[0], p[1], p[2], r, stepUp)
      if (s !== null) {
        p[1] = s
        v[1] = 0
        body.grounded = true
      }
    }
    result.landed = body.grounded && !wasGrounded
    return result
  }
}
