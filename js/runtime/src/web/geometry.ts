/**
 * Unity 尺寸的内置图元网格（004 第 20.3 节）。
 * cube 边长 1；sphere 直径 1；capsule 高 2、半径 0.5；cylinder 高 2、半径 0.5；plane 10×10、法线 +Y；quad 1×1、法线 -Z。
 * 绕序约定与 Unity 网格一致：cross(b - a, c - a) 指向外侧法线（左手系下即顺时针为正面），渲染时 frontFace(CW)。
 * 纯数据，不碰 WebGL，Node 测试可直接使用。
 */

export interface MeshData {
  positions: Float32Array
  normals: Float32Array
  uvs: Float32Array
  indices: Uint32Array
}

type V3 = [number, number, number]

class Builder {
  p: number[] = []
  n: number[] = []
  uv: number[] = []
  idx: number[] = []

  vertex(p: V3, n: V3, u: number, v: number): number {
    const i = this.p.length / 3
    this.p.push(p[0], p[1], p[2])
    this.n.push(n[0], n[1], n[2])
    this.uv.push(u, v)
    return i
  }

  /** 加一个三角形：按三个顶点法线之和校正绕序，使 cross(b - a, c - a) 朝外；退化三角形跳过 */
  tri(a: number, b: number, c: number): void {
    const P = this.p, N = this.n
    const ax = P[a * 3], ay = P[a * 3 + 1], az = P[a * 3 + 2]
    const e1x = P[b * 3] - ax, e1y = P[b * 3 + 1] - ay, e1z = P[b * 3 + 2] - az
    const e2x = P[c * 3] - ax, e2y = P[c * 3 + 1] - ay, e2z = P[c * 3 + 2] - az
    const cx = e1y * e2z - e1z * e2y, cy = e1z * e2x - e1x * e2z, cz = e1x * e2y - e1y * e2x
    if (cx * cx + cy * cy + cz * cz < 1e-14) return
    const nx = N[a * 3] + N[b * 3] + N[c * 3], ny = N[a * 3 + 1] + N[b * 3 + 1] + N[c * 3 + 1], nz = N[a * 3 + 2] + N[b * 3 + 2] + N[c * 3 + 2]
    if (cx * nx + cy * ny + cz * nz >= 0) this.idx.push(a, b, c)
    else this.idx.push(a, c, b)
  }

  /** 四边形 a-b-c-d（环绕顺序任意方向）拆成两个三角形 */
  quad(a: number, b: number, c: number, d: number): void {
    this.tri(a, b, c)
    this.tri(a, c, d)
  }

  build(): MeshData {
    return {
      positions: new Float32Array(this.p),
      normals: new Float32Array(this.n),
      uvs: new Float32Array(this.uv),
      indices: new Uint32Array(this.idx),
    }
  }
}

function cube(): MeshData {
  const b = new Builder()
  // 每个面：法线 n、面内两轴 u、v（cross(u, v) = n）
  const faces: [V3, V3, V3][] = [
    [[1, 0, 0], [0, 0, -1], [0, 1, 0]],
    [[-1, 0, 0], [0, 0, 1], [0, 1, 0]],
    [[0, 1, 0], [0, 0, 1], [1, 0, 0]],
    [[0, -1, 0], [1, 0, 0], [0, 0, 1]],
    [[0, 0, 1], [1, 0, 0], [0, 1, 0]],
    [[0, 0, -1], [0, 1, 0], [1, 0, 0]],
  ]
  for (const [n, u, v] of faces) {
    const corner = (su: number, sv: number): V3 => [
      n[0] * 0.5 + u[0] * su + v[0] * sv,
      n[1] * 0.5 + u[1] * su + v[1] * sv,
      n[2] * 0.5 + u[2] * su + v[2] * sv,
    ]
    const i0 = b.vertex(corner(-0.5, -0.5), n, 0, 0)
    const i1 = b.vertex(corner(0.5, -0.5), n, 1, 0)
    const i2 = b.vertex(corner(0.5, 0.5), n, 1, 1)
    const i3 = b.vertex(corner(-0.5, 0.5), n, 0, 1)
    b.quad(i0, i1, i2, i3)
  }
  return b.build()
}

/**
 * 绕 Y 轴的旋转面：profile 给出从下到上的 (半径, 高度, 法线径向分量, 法线 y 分量, v)。
 * seg 为经向分段数；u 沿经度 0→1
 */
function lathe(b: Builder, profile: [number, number, number, number, number][], seg: number): void {
  const rows: number[][] = []
  for (const [r, y, nr, ny, v] of profile) {
    const row: number[] = []
    for (let i = 0; i <= seg; i++) {
      const t = i / seg
      const a = t * Math.PI * 2
      const cx = -Math.sin(a), cz = -Math.cos(a)
      row.push(b.vertex([cx * r, y, cz * r], [cx * nr, ny, cz * nr], t, v))
    }
    rows.push(row)
  }
  for (let j = 0; j + 1 < rows.length; j++) {
    for (let i = 0; i < seg; i++) b.quad(rows[j][i], rows[j][i + 1], rows[j + 1][i + 1], rows[j + 1][i])
  }
}

function sphere(seg = 32, rings = 16): MeshData {
  const b = new Builder()
  const profile: [number, number, number, number, number][] = []
  for (let k = 0; k <= rings; k++) {
    const phi = -Math.PI / 2 + (k / rings) * Math.PI
    const c = Math.cos(phi), s = Math.sin(phi)
    profile.push([c * 0.5, s * 0.5, c, s, k / rings])
  }
  lathe(b, profile, seg)
  return b.build()
}

function capsule(seg = 32, capRings = 8): MeshData {
  const b = new Builder()
  const profile: [number, number, number, number, number][] = []
  // 总高 2：下半球心 y=-0.5，上半球心 y=0.5；v 按高度 0→1
  for (let k = 0; k <= capRings; k++) {
    const phi = -Math.PI / 2 + (k / capRings) * (Math.PI / 2)
    const c = Math.cos(phi), s = Math.sin(phi)
    const y = -0.5 + s * 0.5
    profile.push([c * 0.5, y, c, s, (y + 1) / 2])
  }
  for (let k = 0; k <= capRings; k++) {
    const phi = (k / capRings) * (Math.PI / 2)
    const c = Math.cos(phi), s = Math.sin(phi)
    const y = 0.5 + s * 0.5
    profile.push([c * 0.5, y, c, s, (y + 1) / 2])
  }
  lathe(b, profile, seg)
  return b.build()
}

function cylinder(seg = 32): MeshData {
  const b = new Builder()
  lathe(b, [[0.5, -1, 1, 0, 0], [0.5, 1, 1, 0, 1]], seg)
  for (const y of [-1, 1]) {
    const n: V3 = [0, y, 0]
    const center = b.vertex([0, y, 0], n, 0.5, 0.5)
    const ring: number[] = []
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * Math.PI * 2
      const x = Math.cos(a) * 0.5, z = Math.sin(a) * 0.5
      ring.push(b.vertex([x, y, z], n, 0.5 + x, 0.5 + z))
    }
    for (let i = 0; i < seg; i++) b.tri(center, ring[i], ring[i + 1])
  }
  return b.build()
}

function grid(size: number, cells: number): MeshData {
  const b = new Builder()
  const n: V3 = [0, 1, 0]
  const rows: number[][] = []
  for (let j = 0; j <= cells; j++) {
    const row: number[] = []
    for (let i = 0; i <= cells; i++) {
      const u = i / cells, v = j / cells
      // Unity 的 Plane：u 沿 -X、v 沿 -Z 增大
      row.push(b.vertex([(0.5 - u) * size, 0, (0.5 - v) * size], n, u, v))
    }
    rows.push(row)
  }
  for (let j = 0; j < cells; j++) for (let i = 0; i < cells; i++) b.quad(rows[j][i], rows[j][i + 1], rows[j + 1][i + 1], rows[j + 1][i])
  return b.build()
}

function quadMesh(): MeshData {
  const b = new Builder()
  const n: V3 = [0, 0, -1]
  const i0 = b.vertex([-0.5, -0.5, 0], n, 0, 0)
  const i1 = b.vertex([0.5, -0.5, 0], n, 1, 0)
  const i2 = b.vertex([0.5, 0.5, 0], n, 1, 1)
  const i3 = b.vertex([-0.5, 0.5, 0], n, 0, 1)
  b.quad(i0, i1, i2, i3)
  return b.build()
}

export const PRIMITIVE_SHAPES = ['cube', 'sphere', 'capsule', 'cylinder', 'plane', 'quad'] as const

const cache = new Map<string, MeshData>()

/** 内置图元网格（缓存）；未知形状返回 undefined */
export function primitiveMesh(shape: string): MeshData | undefined {
  let m = cache.get(shape)
  if (m) return m
  switch (shape) {
    case 'cube': m = cube(); break
    case 'sphere': m = sphere(); break
    case 'capsule': m = capsule(); break
    case 'cylinder': m = cylinder(); break
    case 'plane': m = grid(10, 10); break
    case 'quad': m = quadMesh(); break
    default: return undefined
  }
  cache.set(shape, m)
  return m
}
