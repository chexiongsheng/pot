/**
 * 轴对齐包围盒移动：按 X、Z、Y 分轴推进并回退，支持上台阶与向下吸附地面。
 * 角色视为竖直盒子：底面中心 pos，半宽 radius，高 height。
 */
import type { Vec3 } from '@pot/core'
import { buildLevel, buildSolids, levelPoints, type Box, type LevelData } from './level'

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

export class Collision {
  /** 地面（y=0）存在的最大 x（码头外是海） */
  constructor(readonly boxes: Box[], readonly groundMaxX: number) {}

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

  move(body: Body, dt: number, stepUp: number): MoveResult {
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

export function levelCollision(level: LevelData) {
  const boxes = buildSolids(buildLevel(level))
  for (const r of levelPoints(level).relays) {
    boxes.push({ min: [r.pos[0] - 0.5, r.pos[1], r.pos[2] - 0.5], max: [r.pos[0] + 0.5, r.pos[1] + 1.7, r.pos[2] + 0.5] })
  }
  return new Collision(boxes, level.quay.X)
}
