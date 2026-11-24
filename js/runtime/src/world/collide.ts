/**
 * 触发检测：球与球、球与盒、盒与盒（不旋转）。见 004 第 15.9 节。
 * 实体数在 256 以内时两两检测，以上用格子大小为 4 的均匀网格。结果按 id 排序，保证确定。
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
