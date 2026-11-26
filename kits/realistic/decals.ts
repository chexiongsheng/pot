/**
 * 弹孔 / 焦痕贴花：原版 Hb（贴花图集，Canvas2D 绘制）+ j1（160 槽环形贴花池）机械移植。
 * - 图集 4×2 格、每格 256：金属×2、混凝土×2、木头、焦痕、烟灰、玻璃；三张图：albedo（sRGB）、orm（G 粗糙 B 金属）、
 *   高度（Sobel 转法线）。绘制走 ctx.scene.canvas（Runner 的 Canvas 2D），像素在模块内缓存，热重载不重画。
 * - 池：每个贴花一个四边形（Unity 世界坐标），全部放进一个网格；add 后整体重传（640 顶点，开销可忽略）。
 *   池满后接下来 14 个槽的 alpha 逐级淡出（原版 Yb）。
 * - 防 z-fighting 与原版相同：沿法线外推 0.004 + 槽号×0.0003（错层），再加 polygonOffset(-4, -4)。
 * - 切线由网格 tangents 提供（decal.frag 读 vTangent）。
 */
import type { Context, Entity, Vec3 } from '@pot/core'
import * as port from './orig/port'

export type DecalKind = 'bullet_metal' | 'bullet_concrete' | 'bullet_wood' | 'scorch' | 'soot' | 'bullet_glass'

const DL = 4, XV = 2
const FRAMES: Record<DecalKind, number[]> = { bullet_metal: [0, 1], bullet_concrete: [2, 3], bullet_wood: [4], scorch: [5], soot: [6], bullet_glass: [7] }
/** 原版 ZR：贴花直径（米） */
const SIZES: Record<DecalKind, number> = { bullet_metal: 0.25, bullet_concrete: 0.34, bullet_wood: 0.24, scorch: 2.4, soot: 0.3, bullet_glass: 0.3 }
const FADE = 14
const PI2 = Math.PI * 2

interface AtlasPixels { width: number; height: number; map: Uint8Array; orm: Uint8Array; nrm: Uint8Array; ms: number }
let cached: AtlasPixels | undefined

type G2D = any

/** 原版 Hb(256) 逐句移植（随机序列 il(77123)，与原版 yv 同为 mulberry32 变体） */
function drawAtlas(ctx: Context, i = 256): AtlasPixels {
  const t0 = Date.now()
  const e = i * DL, t = i * XV
  const n = ctx.scene.canvas(e, t), s = ctx.scene.canvas(e, t), o = ctx.scene.canvas(e, t)
  const r: G2D = n.getContext('2d'), a: G2D = s.getContext('2d'), l: G2D = o.getContext('2d')
  l.fillStyle = 'rgb(128,128,128)'; l.fillRect(0, 0, e, t)
  const c = (stops: [number, number][], M: number) => {
    const E = l.createRadialGradient(0, 0, 0, 0, 0, M)
    for (const [w, S] of stops) E.addColorStop(w, `rgb(${S},${S},${S})`)
    l.fillStyle = E; l.beginPath(); l.arc(0, 0, M, 0, PI2); l.fill()
  }
  const h = port.rng(77123) as () => number
  a.fillStyle = 'rgb(0,235,0)'; a.fillRect(0, 0, e, t)
  const f = PI2
  const p = (_: G2D, M: number, E: number, w = 22, S = 1) => {
    _.beginPath()
    for (let z = 0; z < w; z++) {
      const H = z / w * f, O = M * (1 + (h() - 0.5) * E), q = Math.cos(H) * O, U = Math.sin(H) * O * S
      z ? _.lineTo(q, U) : _.moveTo(q, U)
    }
    _.closePath()
  }
  const d = (_: G2D, M: number, E: number, w: number, S: number, z: number, H: string) => {
    _.beginPath()
    let O = E, q = M
    _.moveTo(Math.cos(q) * O, Math.sin(q) * O)
    const U = 5 + Math.floor(h() * 4)
    for (let T = 1; T <= U; T++) { O = E + (w - E) * T / U; q += (h() - 0.5) * S; _.lineTo(Math.cos(q) * O, Math.sin(q) * O) }
    _.strokeStyle = H; _.lineWidth = z; _.lineCap = 'round'; _.lineJoin = 'round'; _.stroke()
  }
  const v = (_: number, M: (S: number) => void) => {
    const E = (_ % DL + 0.5) * i, w = (Math.floor(_ / DL) + 0.5) * i, S = i / 2
    for (const z of [r, a, l]) { z.save(); z.beginPath(); z.rect(E - S, w - S, i, i); z.clip(); z.translate(E, w) }
    M(S)
    r.restore(); a.restore(); l.restore()
  }
  const g = (_: G2D, M: number, E: number, w: [number, string][]) => {
    const S = _.createRadialGradient(0, 0, M, 0, 0, E)
    for (const [z, H] of w) S.addColorStop(z, H)
    return S
  }

  for (const _ of FRAMES.bullet_metal) v(_, (M) => {
    r.fillStyle = g(r, M * 0.1, M * 0.6, [[0, 'rgba(14,13,12,0.4)'], [0.5, 'rgba(18,17,16,0.14)'], [1, 'rgba(20,20,20,0)']]); r.fillRect(-M, -M, 2 * M, 2 * M)
    const E = 6 + Math.floor(h() * 5)
    for (let T = 0; T < E; T++) { const D = h() * f; d(r, D, M * 0.2, M * (0.38 + h() * 0.45), 0.3, 0.8 + h() * 1, 'rgba(8,8,8,0.55)') }
    const w = M * (0.24 + h() * 0.08), S = 0.7 + h() * 0.5, z = h() * f
    const H = (T: number, D: number, C: number, G: number, j: number, N: number) => {
      for (const F of [r, a]) { F.save(); F.translate(T, D); F.rotate(G) }
      const Q: number[] = []
      for (let F = 0; F < N; F++) Q.push(1 + (h() - 0.5) * j)
      const K = (F: G2D, X: number) => {
        F.beginPath()
        for (let ne = 0; ne < N; ne++) {
          const re = ne / N * f, $ = C * Q[ne] * X, ue = Math.cos(re) * $, me = Math.sin(re) * $ * S
          ne ? F.lineTo(ue, me) : F.moveTo(ue, me)
        }
        F.closePath()
      }
      K(r, 1); r.lineJoin = 'miter'; r.strokeStyle = 'rgba(92,54,36,0.95)'; r.lineWidth = Math.max(1.5, C * 0.14); r.stroke()
      const ie = 150 + Math.floor(h() * 50)
      K(r, 1); r.fillStyle = g(r, 0, C * 1.2, [[0, `rgb(${ie - 30},${ie - 26},${ie - 20})`], [0.7, `rgb(${ie + 30},${ie + 33},${ie + 36})`], [1, `rgb(${ie},${ie + 3},${ie + 6})`]]); r.fill()
      K(a, 1); a.fillStyle = 'rgb(0,85,255)'; a.fill()
      r.restore(); a.restore()
    }
    H(0, 0, w, z, 0.75, 11)
    const O = 2 + Math.floor(h() * 4)
    for (let T = 0; T < O; T++) { const D = h() * f, C = w * (1 + h() * 0.7); H(Math.cos(D) * C, Math.sin(D) * C, w * (0.15 + h() * 0.3), h() * f, 0.8, 7) }
    for (let T = 0; T < 9; T++) {
      const D = h() * f, C = w * 0.3, G = w * (0.6 + h() * 0.3)
      r.beginPath(); r.moveTo(Math.cos(D) * C, Math.sin(D) * C); r.lineTo(Math.cos(D + 0.1) * G, Math.sin(D + 0.1) * G)
      r.strokeStyle = h() < 0.5 ? 'rgba(245,246,248,0.7)' : 'rgba(70,72,76,0.5)'; r.lineWidth = 0.8; r.stroke()
    }
    const q = M * (0.1 + h() * 0.025), U = 8 + Math.floor(h() * 5)
    for (let T = 0; T < U; T++) {
      if (h() < 0.15) continue
      const D = (T + (h() - 0.5) * 0.6) / U * f, C = q * (1.25 + h() * 0.9), G = 0.16 + h() * 0.16, j = 205 + Math.floor(h() * 50)
      r.beginPath(); r.moveTo(Math.cos(D - G) * q * 0.9, Math.sin(D - G) * q * 0.9); r.lineTo(Math.cos(D) * C, Math.sin(D) * C); r.lineTo(Math.cos(D + G) * q * 0.9, Math.sin(D + G) * q * 0.9); r.closePath()
      r.fillStyle = `rgb(${j},${j},${Math.min(255, j + 4)})`; r.fill(); r.strokeStyle = 'rgba(40,40,42,0.6)'; r.lineWidth = 0.7; r.stroke()
    }
    a.beginPath(); a.arc(0, 0, q * 1.8, 0, f); a.fillStyle = 'rgb(0,60,255)'; a.fill()
    p(r, q, 0.3, 11); r.fillStyle = g(r, 0, q, [[0, '#000000'], [0.8, '#040404'], [1, '#141414']]); r.fill()
    c([[0, 0], [0.26, 10], [0.36, 240], [0.5, 200], [0.62, 100], [1, 128]], q * 3.4)
    p(a, q, 0.1, 11); a.fillStyle = 'rgb(0,250,0)'; a.fill()
  })

  for (const _ of FRAMES.bullet_concrete) v(_, (M) => {
    r.fillStyle = g(r, M * 0.2, M * 0.9, [[0, 'rgba(186,180,168,0.22)'], [0.6, 'rgba(180,175,165,0.07)'], [1, 'rgba(170,165,155,0)']]); r.fillRect(-M, -M, 2 * M, 2 * M)
    const E = 4 + Math.floor(h() * 4)
    for (let O = 0; O < E; O++) {
      const q = h() * f, U = M * (0.5 + h() * 0.42)
      d(r, q, M * 0.25, U, 0.35, 1.3 + h() * 1.3, 'rgba(20,19,18,0.75)')
      if (h() < 0.5) d(r, q + (h() - 0.5) * 0.6, U * 0.7, U * 1.05, 0.6, 0.9, 'rgba(20,19,18,0.5)')
    }
    const w = M * (0.33 + h() * 0.09), S = 12, z: number[] = []
    for (let O = 0; O < S; O++) z.push(1 + (h() - 0.5) * 0.6)
    const H = (O: G2D, q: number, U: number, T: number) => {
      O.beginPath()
      for (let D = 0; D < S; D++) {
        const C = D / S * f, G = w * z[D] * q
        D ? O.lineTo(Math.cos(C) * G + U, Math.sin(C) * G + T) : O.moveTo(Math.cos(C) * G + U, Math.sin(C) * G + T)
      }
      O.closePath()
    }
    H(r, 1.05, 1.5, 1.5); r.fillStyle = 'rgba(22,21,20,0.8)'; r.fill()
    H(r, 1, 0, 0); r.fillStyle = g(r, w * 0.1, w * 1.1, [[0, '#35332f'], [0.4, '#6f6b63'], [0.8, '#8f8b82'], [1, '#9a968c']]); r.fill()
    H(r, 0.97, -1, -1); r.strokeStyle = 'rgba(206,201,190,0.55)'; r.lineWidth = 1.2; r.stroke()
    for (let O = 0; O < 6; O++) { const q = h() * f; d(r, q, w * 0.2, w * 0.9, 0.5, 1, 'rgba(28,27,25,0.5)') }
    for (let O = 0; O < 60; O++) {
      const q = h() * f, U = Math.sqrt(h()) * w * 0.85
      r.fillStyle = h() < 0.55 ? 'rgba(36,34,32,0.6)' : 'rgba(196,191,180,0.6)'
      r.beginPath(); r.arc(Math.cos(q) * U, Math.sin(q) * U, 0.7 + h() * 2, 0, f); r.fill()
    }
    p(r, w * 0.3, 0.45, 9); r.fillStyle = g(r, 0, w * 0.33, [[0, '#060606'], [0.7, '#161514'], [1, '#2c2a27']]); r.fill()
    c([[0, 0], [0.24, 20], [0.3, 70], [0.8, 112], [0.88, 150], [1, 128]], w * 1.15)
    for (let O = 0; O < 22; O++) {
      const q = h() * f, U = w * (1.15 + h() * 1.3)
      r.fillStyle = h() < 0.5 ? 'rgba(190,185,175,0.45)' : 'rgba(30,29,27,0.45)'
      r.beginPath(); r.arc(Math.cos(q) * U, Math.sin(q) * U, 0.6 + h() * 1.6, 0, f); r.fill()
    }
  })

  for (const _ of FRAMES.bullet_wood) v(_, (M) => {
    p(r, M * 0.27, 0.7, 11, 1.45); r.fillStyle = 'rgba(206,182,140,0.85)'; r.fill()
    for (let E = 0; E < 46; E++) {
      const w = (h() - 0.5) * M * 0.62, S = M * (0.25 + h() * 0.6) * (1 - Math.abs(w) / (M * 0.4)), z = (h() - 0.5) * M * 0.2
      r.beginPath(); r.moveTo(w, z - S); r.lineTo(w + (h() - 0.5) * 5, z + S)
      r.strokeStyle = h() < 0.5 ? 'rgba(236,216,172,0.85)' : 'rgba(88,62,38,0.7)'; r.lineWidth = 0.8 + h() * 2.2; r.stroke()
    }
    p(r, M * 0.1, 0.5, 9, 1.1); r.fillStyle = g(r, 0, M * 0.12, [[0, '#050403'], [0.8, '#140f0a'], [1, '#3a2a1a']]); r.fill()
    c([[0, 0], [0.5, 30], [0.8, 140], [1, 128]], M * 0.17)
  })

  for (const _ of FRAMES.scorch) v(_, (M) => {
    r.fillStyle = g(r, 0, M * 0.98, [[0, 'rgba(6,5,5,0.92)'], [0.3, 'rgba(10,9,8,0.85)'], [0.55, 'rgba(22,18,15,0.5)'], [0.8, 'rgba(30,24,20,0.16)'], [1, 'rgba(30,24,20,0)']]); r.fillRect(-M, -M, 2 * M, 2 * M)
    for (let E = 0; E < 90; E++) {
      const w = h() * f, S = M * (0.1 + h() * 0.3), z = M * (0.5 + h() * 0.46)
      r.beginPath(); r.moveTo(Math.cos(w - 0.03) * S, Math.sin(w - 0.03) * S); r.lineTo(Math.cos(w) * z, Math.sin(w) * z); r.lineTo(Math.cos(w + 0.03) * S, Math.sin(w + 0.03) * S); r.closePath()
      r.fillStyle = `rgba(8,7,6,${0.12 + h() * 0.3})`; r.fill()
    }
    for (let E = 0; E < 60; E++) {
      const w = h() * f, S = M * (0.15 + h() * 0.6)
      r.fillStyle = h() < 0.3 ? 'rgba(150,140,128,0.25)' : 'rgba(0,0,0,0.4)'
      r.beginPath(); r.arc(Math.cos(w) * S, Math.sin(w) * S, 1 + h() * 4, 0, f); r.fill()
    }
  })

  for (const _ of FRAMES.soot) v(_, (M) => {
    for (let E = 0; E < 14; E++) {
      const w = h() * f, S = h() * M * 0.3, z = M * (0.15 + h() * 0.3), H = Math.cos(w) * S, O = Math.sin(w) * S
      const q = r.createRadialGradient(H, O, 0, H, O, z)
      q.addColorStop(0, 'rgba(8,8,8,0.4)'); q.addColorStop(1, 'rgba(8,8,8,0)')
      r.fillStyle = q; r.fillRect(-M, -M, 2 * M, 2 * M)
    }
    p(r, M * 0.1, 0.4, 12); r.fillStyle = 'rgba(0,0,0,0.9)'; r.fill()
  })

  for (const _ of FRAMES.bullet_glass) v(_, (M) => {
    r.fillStyle = g(r, 0, M * 0.5, [[0, 'rgba(235,240,242,0.55)'], [1, 'rgba(235,240,242,0)']]); r.fillRect(-M, -M, 2 * M, 2 * M)
    for (let E = 0; E < 13; E++) { const w = (E + h() * 0.6) / 13 * f; d(r, w, M * 0.07, M * (0.5 + h() * 0.45), 0.12, 0.9 + h(), 'rgba(240,246,248,0.85)') }
    for (let E = 0; E < 3; E++) {
      const w = M * (0.2 + E * 0.17 + h() * 0.05)
      for (let S = 0; S < 9; S++) {
        if (h() < 0.45) continue
        const z = S / 9 * f
        r.beginPath(); r.arc(0, 0, w, z, z + 0.5); r.strokeStyle = 'rgba(240,246,248,0.6)'; r.lineWidth = 1; r.stroke()
      }
    }
    p(r, M * 0.07, 0.3, 10); r.fillStyle = '#060606'; r.fill()
  })

  // 高度 → 法线（原版 Sobel，S = 5/255；行从上到下，C 为向下的高度差）
  const M = l.getImageData(0, 0, e, t).data
  const nrm = new Uint8Array(e * t * 4)
  const S = 5 / 255
  for (let z = 0; z < t; z++) {
    const H = Math.max(0, z - 1) * e, O = Math.min(t - 1, z + 1) * e
    for (let q = 0; q < e; q++) {
      const U = Math.max(0, q - 1), T = Math.min(e - 1, q + 1)
      const D = (M[(z * e + T) * 4] - M[(z * e + U) * 4]) * S
      const C = (M[(O + q) * 4] - M[(H + q) * 4]) * S
      const G = 1 / Math.sqrt(D * D + C * C + 1)
      // 上传约定行从下到上：直接写到翻转后的行
      const j = ((t - 1 - z) * e + q) * 4
      nrm[j] = (-D * G * 0.5 + 0.5) * 255; nrm[j + 1] = (C * G * 0.5 + 0.5) * 255; nrm[j + 2] = (G * 0.5 + 0.5) * 255; nrm[j + 3] = 255
    }
  }
  return { width: e, height: t, map: n.pixels(true), orm: s.pixels(true), nrm, ms: Date.now() - t0 }
}

/** 原版 m(_)：图集格 → [u0, v0, u1, v1]（v 向上） */
function frameUV(frame: number, cell = 256): [number, number, number, number] {
  const b = 2 / cell, M = frame % DL, E = Math.floor(frame / DL)
  return [(M + b) / DL, 1 - (E + 1 - b) / XV, (M + 1 - b) / DL, 1 - (E + b) / XV]
}

/** 带表面材质的碰撞盒（关卡提供） */
export interface SurfaceBox { min: Vec3; max: Vec3; surface: string; playerOnly?: boolean }

/** 命中点所在碰撞盒的材质（最小的包含盒；找不到按混凝土） */
export function surfaceAt(boxes: readonly SurfaceBox[], point: Vec3, eps = 0.06): string {
  let best = 'concrete', vol = Infinity
  for (const b of boxes) {
    if (b.playerOnly) continue
    if (point[0] < b.min[0] - eps || point[0] > b.max[0] + eps || point[1] < b.min[1] - eps || point[1] > b.max[1] + eps || point[2] < b.min[2] - eps || point[2] > b.max[2] + eps) continue
    const v = (b.max[0] - b.min[0]) * (b.max[1] - b.min[1]) * (b.max[2] - b.min[2])
    if (v < vol) { vol = v; best = b.surface }
  }
  return best
}

/** 原版 fx.impact 的贴花分支：返回 [种类, 尺寸, 亮度, alpha]；水面、敌人不留痕 */
export function decalFor(surface: string): [DecalKind, number | undefined, number, number] | undefined {
  switch (surface) {
    case 'metal': return ['bullet_metal', undefined, 1, 1]
    case 'wood': return ['bullet_wood', undefined, 1, 1]
    case 'water': case 'enemy': return undefined
    case 'rubber': case 'dirt': return ['soot', 0.2, 1, 0.8]
    case 'glass': return ['bullet_glass', undefined, 1, 1]
    default: return ['bullet_concrete', undefined, 1, 1]
  }
}

export interface Decals {
  add(point: Vec3, normal: Vec3, kind: DecalKind, size?: number, bright?: number, alpha?: number): void
  clear(): void
  readonly count: number
  readonly atlasMs: number
}

export function createDecals(ctx: Context, cap = 160): Decals | undefined {
  const { scene, gfx } = ctx
  if (!gfx.supported) return undefined
  const atlas = (cached ??= drawAtlas(ctx))
  const tex = (data: Uint8Array, linear: boolean) => scene.texture({ data, width: atlas.width, height: atlas.height, linear, mipmaps: true, wrap: 'clamp', aniso: 4 })
  const map = tex(atlas.map, false), orm = tex(atlas.orm, true), nrm = tex(atlas.nrm, true)
  const uvs = Object.fromEntries(Object.entries(FRAMES).map(([k, fr]) => [k, fr.map((x) => frameUV(x))])) as Record<DecalKind, [number, number, number, number][]>

  const positions = new Float32Array(cap * 12), normals = new Float32Array(cap * 12), uv = new Float32Array(cap * 8), colors = new Float32Array(cap * 16), tangents = new Float32Array(cap * 16)
  const baseA = new Float32Array(cap)
  const indices = new Uint32Array(cap * 6)
  for (let k = 0; k < cap; k++) { const c = k * 4; indices.set([c, c + 1, c + 2, c, c + 2, c + 3], k * 6) }
  const MESH = 'saltline/decals'
  const upload = () => scene.mesh(MESH, { positions, normals, uvs: uv, colors, indices, tangents })
  upload()
  const shader = gfx.shader({ fragment: '@pot/kit/realistic/shaders/decal.frag', name: 'saltline/decal' })
  const ent: Entity = scene.spawn({ shape: `mesh:${MESH}`, name: 'fx_decals', position: [0, 0, 0], collider: false })
    .shader(shader, { queue: 'transparent', blend: 'alpha', cull: 'none', depthWrite: false, shadows: false, frustumCull: false, polygonOffset: [-4, -4], uniforms: { uMap: map, uOrm: orm, uNrm: nrm } })
  ent.active(false)

  let next = 0, count = 0
  return {
    get count() { return count },
    atlasMs: atlas.ms,
    clear() {
      positions.fill(0); colors.fill(0); next = 0; count = 0
      upload(); ent.active(false)
    },
    add(point, normal, kind, size, bright = 1, alpha = 1) {
      const set = uvs[kind] ?? uvs.bullet_concrete
      const l = set[Math.random() * set.length | 0]
      const c = (size || SIZES[kind] || 0.25) * (0.85 + Math.random() * 0.3) * 0.5
      const u = next
      next = (u + 1) % cap
      if (count < cap) count++
      let h = normal[0], f = normal[1], p = normal[2]
      const d = Math.hypot(h, f, p) || 1
      h /= d; f /= d; p /= d
      let v: number, g: number, x: number
      if (Math.abs(f) > 0.9) { v = 1; g = 0; x = 0 } else { v = -p; g = 0; x = h }
      const y = v * h + g * f + x * p
      v -= h * y; g -= f * y; x -= p * y
      const b = Math.hypot(v, g, x) || 1
      v /= b; g /= b; x /= b
      const m = f * x - p * g, A = p * v - h * x, _ = h * g - f * v
      const M = kind === 'bullet_wood' ? (Math.random() - 0.5) * 0.3 : Math.random() * 6.283
      const E = Math.cos(M), w = Math.sin(M)
      const S = (v * E + m * w) * c, z = (g * E + A * w) * c, H = (x * E + _ * w) * c
      const O = (m * E - v * w) * c, q = (A * E - g * w) * c, U = (_ * E - x * w) * c
      const T = 0.004 + (u % 7) * 3e-4
      const D = point[0] + h * T, C = point[1] + f * T, G = point[2] + p * T
      let ie = u * 12
      positions.set([D - S - O, C - z - q, G - H - U, D + S - O, C + z - q, G + H - U, D + S + O, C + z + q, G + H + U, D - S + O, C - z + q, G - H + U], ie)
      for (let F = 0; F < 4; F++) normals.set([h, f, p], ie + F * 3)
      // 切线 = dP/du（+S 方向）；cross(N, S) 恰为 +O = dP/dv，所以 w = 1
      const tl = Math.hypot(S, z, H) || 1
      for (let F = 0; F < 4; F++) tangents.set([S / tl, z / tl, H / tl, 1], u * 16 + F * 4)
      ie = u * 8
      uv.set([l[0], l[1], l[2], l[1], l[2], l[3], l[0], l[3]], ie)
      ie = u * 16
      baseA[u] = alpha
      for (let F = 0; F < 4; F++) colors.set([bright, bright, bright, alpha], ie + F * 4)
      if (count >= cap) for (let F = 0; F < FADE; F++) {
        const X = (next + F) % cap, ne = baseA[X] * (F + 1) / (FADE + 1), re = X * 16
        colors[re + 3] = colors[re + 7] = colors[re + 11] = colors[re + 15] = ne
      }
      upload()
      ent.active(true)
    },
  }
}
