/**
 * 程序化网格：带真实波纹的集装箱（侧板梯形波纹、角柱、上下梁、角件、箱门锁杆）。
 * 原点在箱体中心，x 为长度方向，门在 +x 端。UV 以米为单位（材质用 tiling 换算），
 * 顶点色做底部污渍与凹槽暗部（材质需 vertexColors）。Unity 左手系：三角形 (a,b,c) 的正面法线为 cross(b-a, c-a)。
 */
import type { MeshData } from '@pot/core'

type V3 = [number, number, number]

class Builder {
  pos: number[] = []
  nrm: number[] = []
  uv: number[] = []
  col: number[] = []
  idx: number[] = []

  constructor(private shadeAt: (p: V3) => number) {}

  /** 平面四边形 a b c d（环绕顺序任意），n 为外法线，uvs 为四个角的 UV */
  quad(a: V3, b: V3, c: V3, d: V3, n: V3, uvs: [number, number][], tone = 1) {
    const base = this.pos.length / 3
    for (const [k, p] of [a, b, c, d].entries()) {
      this.pos.push(p[0], p[1], p[2])
      this.nrm.push(n[0], n[1], n[2])
      this.uv.push(uvs[k][0], uvs[k][1])
      const s = this.shadeAt(p) * tone
      this.col.push(s, s, s, 1)
    }
    const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]
    const cx = e1[1] * e2[2] - e1[2] * e2[1], cy = e1[2] * e2[0] - e1[0] * e2[2], cz = e1[0] * e2[1] - e1[1] * e2[0]
    if (cx * n[0] + cy * n[1] + cz * n[2] > 0) this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3)
    else this.idx.push(base, base + 2, base + 1, base, base + 3, base + 2)
  }

  /** 轴对齐盒子（中心、尺寸），UV 按米 */
  box(c: V3, s: V3, tone = 1, faces = 'xXyYzZ') {
    const [x0, y0, z0] = [c[0] - s[0] / 2, c[1] - s[1] / 2, c[2] - s[2] / 2]
    const [x1, y1, z1] = [c[0] + s[0] / 2, c[1] + s[1] / 2, c[2] + s[2] / 2]
    if (faces.includes('X')) this.quad([x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1], [1, 0, 0], [[z0, y0], [z0, y1], [z1, y1], [z1, y0]], tone)
    if (faces.includes('x')) this.quad([x0, y0, z0], [x0, y1, z0], [x0, y1, z1], [x0, y0, z1], [-1, 0, 0], [[-z0, y0], [-z0, y1], [-z1, y1], [-z1, y0]], tone)
    if (faces.includes('Y')) this.quad([x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1], [0, 1, 0], [[x0, z0], [x1, z0], [x1, z1], [x0, z1]], tone)
    if (faces.includes('y')) this.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0], [[x0, z0], [x1, z0], [x1, z1], [x0, z1]], tone)
    if (faces.includes('Z')) this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1], [[-x0, y0], [-x1, y0], [-x1, y1], [-x0, y1]], tone)
    if (faces.includes('z')) this.quad([x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [0, 0, -1], [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], tone)
  }

  /**
   * 竖向梯形波纹板：沿 axis 从 a0 到 a1，板面位于 plane（外侧方向 sign），高度 y0..y1 分 rows 段（顶点色渐变）。
   * profile 为一个周期内的 [沿向比例, 深度比例] 折线点。
   */
  corrugated(axis: 'x' | 'z', a0: number, a1: number, plane: number, sign: number, y0: number, y1: number, pitch: number, depth: number, rows: number[]) {
    const profile: [number, number][] = [[0, 0], [0.32, 0], [0.48, 1], [0.84, 1], [1, 0]]
    const n = Math.max(1, Math.round((a1 - a0) / pitch))
    const p = (a1 - a0) / n
    const at = (a: number, d: number): [number, number] => {
      const off = plane - sign * d * depth
      return axis === 'x' ? [a, off] : [off, a]
    }
    const ys = [y0, ...rows.filter((r) => r > y0 && r < y1), y1]
    for (let k = 0; k < n; k++) {
      for (let s = 0; s < profile.length - 1; s++) {
        const [ta, da] = profile[s], [tb, db] = profile[s + 1]
        const aa = a0 + (k + ta) * p, ab = a0 + (k + tb) * p
        const [xa, za] = at(aa, da), [xb, zb] = at(ab, db)
        // 法线：板面切线与 y 轴的叉积，朝外
        const tx = xb - xa, tz = zb - za
        let nx = tz, nz = -tx
        const out = axis === 'x' ? nz * sign : nx * sign
        if (out < 0) { nx = -nx; nz = -nz }
        const l = Math.hypot(nx, nz)
        nx /= l; nz /= l
        const tone = da > 0.5 && db > 0.5 ? 0.9 : da !== db ? 0.95 : 1
        for (let r = 0; r < ys.length - 1; r++) {
          const ya = ys[r], yb = ys[r + 1]
          const ua = sign * aa, ub = sign * ab
          this.quad([xa, ya, za], [xb, ya, zb], [xb, yb, zb], [xa, yb, za], [nx, 0, nz], [[ua, ya], [ub, ya], [ub, yb], [ua, yb]], tone)
        }
      }
    }
  }

  data(): MeshData {
    return { positions: this.pos, normals: this.nrm, uvs: this.uv, colors: this.col, indices: this.idx }
  }
}

/** 集装箱网格。L 长、H 高、W 宽（米） */
export function containerMesh(L: number, H: number, W: number): MeshData {
  const hx = L / 2, hy = H / 2, hz = W / 2
  // 底部泥污渐变（高度 0..0.9 米），顶部略暗
  const b = new Builder((p) => {
    const t = Math.min(1, Math.max(0, (p[1] + hy) / 0.9))
    const top = Math.min(1, Math.max(0, (hy - p[1]) / 0.25))
    return (0.62 + 0.38 * t * t * (3 - 2 * t)) * (0.9 + 0.1 * top)
  })
  const post = 0.17, railT = 0.12, railB = 0.16
  const rows = [-hy + 0.45, -hy + 0.9]
  // 侧板（长边，±z），波纹深 36mm、节距 0.28
  for (const s of [-1, 1]) b.corrugated('x', -hx + post, hx - post, s * (hz - 0.012), s, -hy + railB, hy - railT, 0.28, 0.036, rows)
  // 后端板（-x）竖波纹
  b.corrugated('z', -hz + post, hz - post, -(hx - 0.012), -1, -hy + railB, hy - railT, 0.24, 0.03, rows)
  // 门端（+x）：两扇门，每扇 3 道浅波纹 + 门缝
  const doorY0 = -hy + railB + 0.02, doorY1 = hy - railT - 0.1
  for (const side of [-1, 1]) {
    const a0 = side < 0 ? -hz + post : 0.012, a1 = side < 0 ? -0.012 : hz - post
    b.corrugated('z', a0, a1, hx - 0.03, 1, doorY0, doorY1, (a1 - a0) / 4, 0.022, rows)
  }
  b.box([hx - 0.02, 0, 0], [0.02, H - railT - railB, 0.03], 0.35, 'X')
  // 门上框
  b.box([hx - 0.05, hy - railT - 0.05, 0], [0.08, 0.1, W - 2 * post], 0.95)
  // 顶板（略低于顶梁，带浅横向起伏用法线贴图表现）
  b.box([0, hy - 0.04, 0], [L - 0.1, 0.02, W - 0.1], 1, 'Y')
  b.box([0, -hy + 0.1, 0], [L - 0.1, 0.02, W - 0.1], 0.5, 'y')
  // 角柱
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box([sx * (hx - post / 2), 0, sz * (hz - post / 2)], [post, H, post], 0.92)
  // 上下纵梁、端梁
  for (const sz of [-1, 1]) {
    b.box([0, hy - railT / 2, sz * (hz - 0.05)], [L - 2 * post, railT, 0.1], 0.95)
    b.box([0, -hy + railB / 2, sz * (hz - 0.06)], [L - 2 * post, railB, 0.12], 0.85)
  }
  for (const sx of [-1, 1]) {
    b.box([sx * (hx - 0.06), hy - railT / 2, 0], [0.12, railT, W - 2 * post], 0.95)
    b.box([sx * (hx - 0.07), -hy + railB / 2, 0], [0.14, railB, W - 2 * post], 0.85)
  }
  // 角件（铸钢，略凸出，深色）
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    b.box([sx * (hx - 0.09), sy * (hy - 0.06), sz * (hz - 0.08)], [0.19, 0.125, 0.17], 0.45)
  }
  // 门锁杆：每扇门两根竖杆 + 上下锁座 + 把手
  for (const z of [-0.86, -0.36, 0.36, 0.86].map((v) => v * hz / 1.22)) {
    b.box([hx + 0.02, 0, z], [0.035, H - 0.36, 0.035], 0.6)
    for (const y of [-hy + 0.22, hy - 0.2]) b.box([hx + 0.01, y, z], [0.05, 0.08, 0.08], 0.5)
    b.box([hx + 0.06, -0.05, z + 0.12], [0.03, 0.03, 0.22], 0.55)
  }
  // 门铰链
  for (const sz of [-1, 1]) for (const y of [-hy + 0.5, 0, hy - 0.55]) b.box([hx + 0.005, y, sz * (hz - post - 0.03)], [0.04, 0.12, 0.06], 0.6)
  return b.data()
}
