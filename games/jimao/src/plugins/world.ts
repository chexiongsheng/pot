/** 场景：关卡几何与 PBR 表面、喷字贴花、黄昏光照与天气、画质档位、中继模型、撤离点信标、环境声 */
import type { Context, Entity, MaterialOptions, Texture, Vec3 } from '@pot/core'
import { buildLevel, LEVEL_LAYER, levelPoints, P, VIEW_LAYER, type LevelData, type Piece } from '../lib/level'
import { rng } from '../lib/math'
import { createMats, type Mats } from '../lib/mats'
import { containerMesh } from '../lib/meshes'
import { registerSfx, sfx } from '../lib/sfx'
import * as T from '../lib/textures'
import { game } from '../lib/types'

export const name = 'world'

interface QualityLevel {
  renderScale: number
  shadowDistance: number
  shadowResolution: number
  shadowCascades: number
  reflection: number
  drops: number
  ao: number
  antialias: 'none' | 'fxaa' | 'smaa'
  reflectionShadows: boolean
}

interface SurfaceDef {
  bake: () => T.Baked
  uv: 'mesh' | 'world' | 'object'
  /** 每米（或每网格 UV 单位）重复次数 */
  tiling: number
  /** true：贴图为白底，乘以 piece.color；false：贴图自带颜色，piece.color 置白 */
  tint: boolean
  extra?: MaterialOptions
}

const SURFACES: Record<string, SurfaceDef> = {
    asphalt: { bake: () => T.asphalt(512), uv: 'world', tiling: 1 / 4, tint: false, extra: { planar: 1 } },
  concrete: { bake: () => T.concrete(256), uv: 'object', tiling: 1 / 3, tint: false },
  slab: { bake: () => T.concrete(256, true), uv: 'world', tiling: 1 / 4, tint: true, extra: { planar: 1 } },
  steel: { bake: () => T.steel(256), uv: 'object', tiling: 0.5, tint: true },
  wood: { bake: () => T.wood(256), uv: 'object', tiling: 0.8, tint: true },
  marking: { bake: () => T.marking(256), uv: 'world', tiling: 0.5, tint: true, extra: { mode: 'lit-cutout', cutoff: 0.5, shadows: false, planar: 1 } },
  chainlink: { bake: () => T.chainlink(256), uv: 'object', tiling: 2, tint: true, extra: { mode: 'lit-cutout', cutoff: 0.5 } },
}

/** 关卡 tex 键 → 原版命名材质（GPU 烘焙）；tint 为 true 时以 piece.color 覆盖材质颜色 */
const SL: Record<string, { mat: string; uv: 'mesh' | 'world' | 'object'; tint: boolean; extra?: MaterialOptions }> = {
  asphalt: { mat: 'asphalt', uv: 'world', tint: false, extra: { planar: 1 } },
  concrete: { mat: 'concrete', uv: 'object', tint: false },
  slab: { mat: 'concrete', uv: 'world', tint: true, extra: { planar: 1 } },
  steel: { mat: 'steel_worn', uv: 'object', tint: true },
  wood: { mat: 'wood_pallet', uv: 'object', tint: true },
  chainlink: { mat: 'chainlink', uv: 'object', tint: true },
}

const DECALS: Record<string, { text: string; width: number; height: number; size: number; color: string; letterSpacing?: number }> = {
  logo: { text: 'C-几猫物流', width: 512, height: 128, size: 84, color: '#f2f0ea', letterSpacing: 4 },
  code: { text: 'JMLU 204817 3', width: 512, height: 144, size: 64, color: '#f2f0ea', letterSpacing: 6 },
  lane2: { text: '二号通道', width: 512, height: 152, size: 104, color: '#151515', letterSpacing: 8 },
  lane3: { text: '三号通道', width: 512, height: 152, size: 104, color: '#151515', letterSpacing: 8 },
}

const CONTAINER_SIZES: Record<string, Vec3> = { '20': [6.06, 2.59, 2.44], '40': [12.19, 2.59, 2.44], hc: [12.19, 2.9, 2.44] }

function hexRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', '').slice(0, 6), 16)
  return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]
}

export function apply(ctx: Context) {
  registerSfx(ctx)
  const level = ctx.data.load<LevelData>('level.json')
  const tuning = ctx.data.load<any>('tuning.json')
  const look = tuning.look
  const levels: QualityLevel[] = tuning.quality.levels
  const points = levelPoints(level)
  const { scene } = ctx

  // ---- 程序化贴图（按需烘焙并缓存） ----
  // GPU 烘焙（原版材质系统机械移植）；没有运行时着色器后端时回退到下面的 CPU 近似贴图
  let mats: Mats | undefined
  if (ctx.gfx.supported) {
    try {
      mats = createMats(ctx, { tex: tuning.quality.tex })
    } catch (e: any) {
      ctx.logger('world').error('GPU 材质不可用，回退 CPU 贴图：%s', e?.message ?? e)
    }
  }
  const surfaceCache = new Map<string, T.TexSet>()
  const surfaceTex = (key: string) => {
    let set = surfaceCache.get(key)
    if (!set) {
      set = T.upload(ctx, SURFACES[key].bake())
      surfaceCache.set(key, set)
    }
    return set
  }
  // 集装箱漆面：共享损伤场与法线/遮罩，每种漆色一张基础色
  let paint: ReturnType<typeof T.paintFields> | undefined
  let paintShared: T.TexSet | undefined
  const paintCache = new Map<string, Texture>()
  const paintTex = (hex: string): T.TexSet => {
    if (!paint) {
      paint = T.paintFields(512)
      paintShared = T.upload(ctx, paint.baked)
    }
    let map = paintCache.get(hex)
    if (!map) {
      map = scene.texture({ data: T.paintAlbedo(paint, hexRgb(hex)), width: paint.size, height: paint.size })
      paintCache.set(hex, map)
    }
    return { ...paintShared!, map }
  }
  const decalCache = new Map<string, Texture>()
  const decalTex = (key: string) => {
    let tex = decalCache.get(key)
    if (!tex) {
      const d = DECALS[key]
      tex = scene.text({ text: d.text, width: d.width, height: d.height, size: d.size, color: d.color, bold: true, letterSpacing: d.letterSpacing })
      decalCache.set(key, tex)
    }
    return tex
  }

  // ---- 集装箱网格 ----
  for (const [key, [L, H, W]] of Object.entries(CONTAINER_SIZES)) scene.mesh(`container${key}`, containerMesh(L, H, W))

  const rand = rng(1931)
  /** 由 piece 解析颜色与材质 */
  function resolve(piece: Piece): { color?: string; material?: MaterialOptions } {
    const m = piece.mat ?? {}
    if (piece.decal) {
      return { color: piece.color, material: { mode: 'lit-fade', map: decalTex(piece.decal), shadows: false, smoothness: 0.35, metallic: 0 } }
    }
    const mode = m.mode ?? 'lit'
    const lit = mode === 'lit' || mode === 'lit-cutout' || mode === 'lit-twosided'
    const tex = piece.tex ?? (lit && m.emission === undefined ? 'steel' : 'none')
    if (tex === 'none' || !lit) return { color: piece.color, material: piece.mat }
    if (mats) {
      if (tex.startsWith('paint:')) {
        const r = mats.get('paint_grey', { color: tex.slice(6), uv: 'mesh' })
        return { color: r.color, material: { ...m, ...r.material, offset: [rand(), rand()], vertexColors: true } }
      }
      const sl = SL[tex]
      if (sl) {
        const r = mats.get(sl.mat, { color: sl.tint ? piece.color : undefined, uv: sl.uv })
        return { color: r.color, material: { ...m, ...r.material, offset: [rand(), rand()], ...sl.extra } }
      }
    }
    if (tex.startsWith('paint:')) {
      const set = paintTex(tex.slice(6))
      return {
        color: '#ffffff',
        material: { ...m, ...set, smoothness: 1, metallic: 1, uv: 'mesh', tiling: [1 / 3, 1 / 3], offset: [rand(), rand()], vertexColors: true },
      }
    }
    const def = SURFACES[tex]
    if (!def) return { color: piece.color, material: piece.mat }
    return {
      color: def.tint ? piece.color : '#ffffff',
      material: { ...m, ...surfaceTex(tex), smoothness: 1, metallic: 1, uv: def.uv, tiling: [def.tiling, def.tiling], offset: [rand(), rand()], ...def.extra },
    }
  }

  // ---- 关卡几何 ----
  for (const piece of buildLevel(level)) {
    if (piece.hidden) continue
    const collide = piece.collide !== false
    const { color, material } = resolve(piece)
    const common = {
      shape: piece.shape ?? 'cube',
      name: piece.name ?? 'level',
      color,
      material,
      collider: collide,
      layer: collide ? LEVEL_LAYER : undefined,
    } as const
    const scale = piece.scale ?? piece.size
    if (piece.parentScale) {
      const parent = scene.spawn({ shape: 'empty', name: 'gable', position: piece.pos, scale: piece.parentScale })
      scene.spawn({ ...common, parent, position: [0, 0, 0], rotation: piece.rot, scale, collider: false, layer: undefined })
    } else {
      scene.spawn({ ...common, position: piece.pos, rotation: piece.rot, scale })
    }
  }

  // ---- 光照：黄昏逆光 ----
  scene.view({ near: 0.02, far: 600 })
  scene.light({ type: 'directional', name: 'sun', rotation: look.sun.rotation, intensity: look.sun.intensity, color: look.sun.color, shadows: 'soft' })
  scene.ambient({ sky: look.ambient.sky, equator: look.ambient.equator, ground: look.ambient.ground }, look.ambient.reflection)
  scene.sky(look.sky)
  scene.fog(look.fog.color, look.fog.density, { height: look.fog.height, base: look.fog.base, sun: look.fog.sun })
  scene.post(look.post)

  for (const [x, z] of level.masts) {
    scene.light({ type: 'spot', name: 'mast', position: P(x, 11.7, z), rotation: [90, 0, 0], intensity: 2.4, range: 30, spotAngle: 95, color: '#ffe2b0' })
  }
  for (const [cz] of level.cranes) {
    scene.light({ type: 'point', name: 'crane', position: P(level.quay.RAILS[1] - 1, 19, cz), intensity: 1.2, range: 16, color: '#ffc070' })
  }
  const s = level.shed
  for (const x of [-10, -2, 6]) {
    scene.light({ type: 'point', name: 'shed', position: P(x, s.EAVE - 0.6, s.ZR), intensity: 1.5, range: 13, color: '#fff1d6' })
  }
  scene.light({ type: 'point', name: 'quay', position: P(level.quay.X - 2, 3, 12), intensity: 0.8, range: 12, color: '#9fc4ff' })

  // ---- 画质档位（设置变化时重新应用） ----
  let appliedQuality = -1
  const applyQuality = (index: number) => {
    const q = levels[Math.max(0, Math.min(levels.length - 1, index))]
    appliedQuality = index
    scene.quality({ renderScale: q.renderScale, shadowDistance: q.shadowDistance, shadowResolution: q.shadowResolution, shadowCascades: q.shadowCascades })
    scene.reflection({ enabled: q.reflection > 0, height: 0, scale: q.reflection > 0 ? q.reflection : undefined, exclude: [VIEW_LAYER], shadows: q.reflectionShadows })
    scene.post({ ao: q.ao, antialias: q.antialias })
    scene.weather({ ...look.weather, drops: q.drops })
  }
  applyQuality(game(ctx)?.settings.quality ?? 2)
  scene.refreshEnvironment()

  // ---- 中继 ----
  const steelSet = surfaceTex('steel')
  const steelMat = (extra: MaterialOptions = {}): MaterialOptions => ({ ...steelSet, smoothness: 1, metallic: 1, uv: 'object', tiling: [2, 2], ...extra })
  const relayParts: { body: Entity; beacon: Entity; screen: Entity; light: Entity; pos: Vec3 }[] = []
  for (const r of points.relays) {
    const root = scene.spawn({ shape: 'empty', name: `relay-${r.id}`, position: r.pos, rotation: [0, r.yaw, 0] })
    const body = scene.spawn({ parent: root, name: 'relay', position: [0, 0.8, 0], scale: [0.9, 1.6, 0.6], color: '#4a535a', material: steelMat(), layer: LEVEL_LAYER })
    scene.spawn({ parent: root, name: 'relay-base', position: [0, 0.05, 0], scale: [1.1, 0.1, 0.8], color: '#2c3033', material: steelMat(), collider: false })
    const screen = scene.spawn({ parent: root, name: 'relay-screen', position: [0, 1.15, 0.305], scale: [0.6, 0.35, 0.01], color: '#ff5a40', material: { mode: 'unlit' }, collider: false })
    scene.spawn({ parent: root, name: 'relay-stripe', position: [0, 0.35, 0.305], scale: [0.88, 0.12, 0.01], color: '#c39b2a', material: steelMat(), collider: false })
    scene.spawn({ parent: root, shape: 'cylinder', name: 'antenna', position: [0.3, 2.4, 0], scale: [0.05, 0.8, 0.05], color: '#8d9aa3', material: steelMat(), collider: false })
    scene.spawn({ parent: root, shape: 'cylinder', name: 'dish', position: [-0.2, 1.75, 0], rotation: [70, 0, 0], scale: [0.5, 0.03, 0.5], color: '#aab3b8', material: steelMat(), collider: false })
    const beacon = scene.spawn({ parent: root, shape: 'sphere', name: 'beacon', position: [0.3, 3.25, 0], scale: 0.16, color: '#ff5a40', material: { mode: 'unlit' }, collider: false })
    const light = scene.light({ type: 'point', name: 'relay-light', parent: root, position: [0, 2.2, 0.8], intensity: 1.2, range: 6, color: '#ff5a40' })
    relayParts.push({ body, beacon, screen, light, pos: r.pos })
  }

  // ---- 撤离点信标 ----
  const ex = points.extraction
  const exRoot = scene.spawn({ shape: 'empty', name: 'extraction', position: ex.pos, active: false })
  const ring = scene.spawn({ parent: exRoot, shape: 'cylinder', name: 'ring', position: [0, 0.02, 0], scale: [ex.radius * 2, 0.01, ex.radius * 2], color: '#38e07055', material: { mode: 'additive', shadows: false }, collider: false })
  const pillar = scene.spawn({ parent: exRoot, shape: 'cylinder', name: 'pillar', position: [0, 6, 0], scale: [0.25, 6, 0.25], color: '#38e07033', material: { mode: 'additive', shadows: false }, collider: false })
  const flare = scene.light({ type: 'point', name: 'flare', parent: exRoot, position: [0, 1.5, 0], intensity: 2.5, range: 10, color: '#38e070' })

  // ---- 环境声 ----
  const rain = ctx.audio.loop(sfx('rain'), { volume: 0.35 })
  const drone = ctx.audio.loop(sfx('drone'), { volume: 0.25 })
  const tension = ctx.audio.loop(sfx('tension'), { volume: 0 })
  let tensionVol = 0
  let lastVol = -1

  let t = 0
  ctx.on('update', (dt) => {
    t += dt
    const g = game(ctx)
    const quality = g?.settings.quality ?? 2
    if (quality !== appliedQuality) applyQuality(quality)
    const relays = g?.relays ?? []
    relayParts.forEach((r, i) => {
      const status = relays[i] ?? 'live'
      const blink = status === 'live' ? (Math.sin(t * 6 + i) > 0 ? 1 : 0.15) : status === 'cutting' ? (Math.sin(t * 22) > 0 ? 1 : 0.3) : 0
      const color = status === 'cut' ? '#2a3034' : status === 'cutting' ? '#ffb347' : '#ff5a40'
      r.beacon.color(color)
      const k = 0.16 * (0.6 + blink * 0.4)
      r.beacon.scale = [k, k, k]
      r.screen.color(status === 'cut' ? '#14181a' : color)
      r.light.intensity(status === 'cut' ? 0 : 0.4 + blink * 1.2)
    })
    const open = relays.length > 0 && relays.every((s) => s === 'cut') && g?.phase !== 'title'
    exRoot.active(open)
    if (open) {
      const pulse = 0.5 + 0.5 * Math.sin(t * 3)
      ring.scale = [ex.radius * 2 * (0.9 + pulse * 0.15), 0.01, ex.radius * 2 * (0.9 + pulse * 0.15)]
      pillar.color(`#38e070${Math.round(30 + pulse * 40).toString(16).padStart(2, '0')}`)
      flare.intensity(1.8 + pulse * 1.2)
    }
    const paused = g?.phase === 'paused'
    const combat = g?.alerted && g.phase === 'playing' ? 1 : 0
    tensionVol += (combat * 0.4 - tensionVol) * Math.min(1, dt * 0.8)
    tension.set({ volume: paused ? 0 : tensionVol })
    const vol = g?.settings.volume ?? 0.8
    if (vol !== lastVol) { lastVol = vol; ctx.audio.volume(vol) }
    rain.set({ volume: paused ? 0.08 : 0.35 })
    drone.set({ volume: paused ? 0 : g?.phase === 'title' ? 0.35 : 0.2 })
  })
}
