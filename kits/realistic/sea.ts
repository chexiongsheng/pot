/**
 * 原版海面（pretty.js kb）机械移植：
 * - 网格：近处变密的格网（x 27.5..880，z -880..880）+ 3 块远处四边形填补陆地背后
 * - 顶点：4 个 Gerstner 波（shaders/sea.vert）
 * - 片元：11 个波的斜率 + 细节法线、码头与船体泡沫、风区/涌浪、太阳闪光、远处雾霭（shaders/sea.frag）
 * 细节纹理与 apron 共用（原版同一份 Cb）。
 */
import type { Context, Texture } from '@pot/core'

/** 原版海面高度（oi.seaY） */
export const SEA_Y = -1.6

/** 原版 gv：从 i 到 e 的递增序列，步长从 t 起按 n 倍增长，不超过 s */
function gv(i: number, e: number, t: number, n: number, s: number) {
  const o = [i]; let r = i, a = t
  for (; r < e - 0.001;) r = Math.min(e, r + a), o.push(r), a = Math.min(s, a * n)
  return o
}

/** kb 的网格（three 坐标）→ Unity 坐标：z 取反，绕序反转 */
function seaMesh() {
  const t = SEA_Y
  const n = gv(27.5, 880, 0.75, 1.075, 120), s = gv(48, 880, 0.9, 1.085, 120)
  const r = s.map(M => -M).reverse().concat(gv(-48 + 0.9, 48 - 0.9, 0.9, 1, 0.9), s.slice(0))
  const a = n.length, l = r.length
  const pos: number[] = [], idx: number[] = []
  for (let M = 0; M < l; M++) for (let E = 0; E < a; E++) pos.push(n[E], t, -r[M])
  for (let M = 0; M < l - 1; M++) for (let E = 0; E < a - 1; E++) {
    const w = M * a + E, S = w + 1, z = w + a, H = z + 1
    idx.push(w, S, z, S, H, z)
  }
  const quad = (x0: number, z0: number, x1: number, z1: number) => {
    const b = pos.length / 3
    for (const [x, z] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) pos.push(x, t, -z)
    idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2)
  }
  quad(-880, -880, 27.5, -158); quad(-880, 158, 27.5, 880); quad(-880, -158, -158, 158)
  const positions = new Float32Array(pos)
  const normals = new Float32Array(positions.length)
  for (let k = 1; k < normals.length; k += 3) normals[k] = 1
  return { positions, normals, indices: new Uint32Array(idx) }
}

/** 原版 en.horizon / en.horizonAway（线性） */
const HORIZON: [number, number, number] = [0.95, 0.55, 0.28]
const HORIZON_AWAY: [number, number, number] = [0.16, 0.22, 0.3]

export function createSea(ctx: Context, detail: { detail: Texture; detailN: Texture }): boolean {
  const { scene, gfx } = ctx
  if (!gfx.supported) return false
  scene.mesh('saltline/sea', seaMesh())
  const shader = gfx.shader({ vertex: '@pot/kit/realistic/shaders/sea.vert', fragment: '@pot/kit/realistic/shaders/sea.frag', name: 'saltline/sea' })
  const uniforms: Record<string, any> = {
    uDetail: detail.detail, uDetailN: detail.detailN,
    uHazeA: HORIZON_AWAY.map(v => v * 0.85), uHazeB: HORIZON.map(v => v * 0.8),
  }
  scene.spawn({ shape: 'mesh:saltline/sea', name: 'sea', position: [0, 0, 0], collider: false })
    .shader(shader, { uniforms, shadows: false })
  return true
}
