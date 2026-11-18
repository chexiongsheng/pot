/** 场景：关卡几何与 PBR 表面、喷字贴花、黄昏光照与天气、画质档位、中继模型、撤离点信标、环境声 */
import type { Context, Entity, MaterialOptions, Texture, Vec3 } from '@pot/core'
import { buildLevel, LEVEL_LAYER, levelPoints, P, VIEW_LAYER, type LevelData, type Piece } from '../lib/level'
import { createApron } from '../lib/apron'
import { createSea } from '../lib/sea'
import { rng } from '../lib/math'
import { createMats, MATS, type Mats } from '../lib/mats'
import { toMesh } from '../lib/geo'
import { emissiveMaterial, hdr, origLevel, toUnityPos, toUnityTransform, type MatToken } from '../lib/origlevel'
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

  // ---- 原版地面（apron：积水/干湿/油污/接缝，ctx.gfx 着色器）；不可用时用下面的近似地面 ----
  const apron = createApron(ctx, { maskRes: tuning.quality.tex >= 1024 ? 1024 : 512, detailRes: tuning.quality.tex >= 1024 ? 512 : 256 })
  // ---- 原版海面（Gerstner 波、泡沫、闪光、远处雾霭）；不可用时保留 level.ts 的盒子海面 ----
  const sea = apron ? createSea(ctx, apron) : false
  const replaced = new Set<string>([...(apron ? ['ground', 'quay-deck'] : []), ...(sea ? ['sea'] : [])])

  // ---- 关卡几何：地面、码头、海面、起重机、远景（原版 ground/backdrop 未移植前的近似） ----
  for (const piece of buildLevel(level, { origStatic: true })) {
    if (piece.hidden || replaced.has(piece.name ?? '')) continue
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

  // ---- 机械移植的原版关卡：堆场、仓库、围栏、道具、中继 ----
  const orig = origLevel()
  /** 材质令牌 → Runner 材质：GPU 烘焙的原版材质；没有运行时着色器时退回纯色 */
  const resolveToken = (t: MatToken): { color: string; material: MaterialOptions } => {
    if (t.kind === 'emissive') return emissiveMaterial(t)
    // 远景闪灯：原版 MeshBasicMaterial + HDR 顶点色（闪烁着色器暂缺，常亮）
    if (t.kind === 'lamps') return { color: '#ffffff', material: { mode: 'unlit', vertexColors: true, shadows: false } }
    if (mats) {
      const r = mats.get(t.name, { interior: !!t.opts.interior })
      return { color: r.color, material: { ...r.material, vertexColors: t.vertexColors } }
    }
    const def = MATS[t.name]
    const hex = `#${(def?.color ?? 0x808080).toString(16).padStart(6, '0')}`
    return { color: hex, material: { metallic: def?.metal ?? 0, smoothness: 1 - (def?.rough ?? 0.7), vertexColors: t.vertexColors, mode: def?.transparent ? 'lit-fade' : 'lit' } }
  }
  // Canvas 2D 绘制的贴花与喷字（decal/label）暂缺，跳过
  const drawable = (t: MatToken) => t.kind !== 'decal' && t.kind !== 'label'
  orig.statics.forEach((s, k) => {
    if (!drawable(s.material)) return
    const name = `orig-static-${k}`
    scene.mesh(name, toMesh(s.geometry))
    const r = resolveToken(s.material)
    const solid = !s.material.transparent && s.material.kind === 'std'
    scene.spawn({
      shape: `mesh:${name}`, name: `level:${s.material.name}`, color: r.color,
      material: { ...r.material, shadows: s.cast }, collider: solid, layer: solid ? LEVEL_LAYER : undefined,
    })
  })
  const dynamic: { mesh: any; ent: Entity; last: number[]; token: MatToken; version: number }[] = []
  orig.dynamics.forEach((d, k) => {
    if (!drawable(d.material)) return
    const name = `orig-dyn-${k}`
    scene.mesh(name, toMesh(d.mesh.geometry))
    const r = resolveToken(d.material)
    const tr = toUnityTransform(d.mesh.matrixWorld)
    const ent = scene.spawn({
      shape: `mesh:${name}`, name: `level-dyn:${d.material.name}`, position: tr.position, rotation: tr.rotation, scale: tr.scale,
      color: r.color, material: { ...r.material, shadows: d.mesh.castShadow }, collider: false,
    })
    dynamic.push({ mesh: d.mesh, ent, last: d.mesh.matrixWorld.elements.slice(), token: d.material, version: d.material.version })
  })
  // 原版点光源（three 物理单位坎德拉；URP 漫反射不除以 π，强度按 1/π 换算）
  const origLights = orig.lights.map((l) => {
    l.updateWorldMatrix(true, false)
    const p = toUnityPos({ x: l.matrixWorld.elements[12], y: l.matrixWorld.elements[13], z: l.matrixWorld.elements[14] })
    const c = hdr(l.color)
    const ent = scene.light({ type: 'point', name: 'orig-light', position: p, intensity: (l.intensity * c.intensity) / Math.PI, range: l.distance || 15, color: c.color })
    return { l, ent, last: l.intensity }
  })
  const syncOrig = (dt: number) => {
    orig.update(dt)
    orig.data.root.updateMatrixWorld(true)
    for (const d of dynamic) {
      const e = d.mesh.matrixWorld.elements
      let changed = false
      for (let k = 0; k < 16; k++) if (e[k] !== d.last[k]) { changed = true; d.last[k] = e[k] }
      if (changed) {
        const tr = toUnityTransform(d.mesh.matrixWorld)
        d.ent.position = tr.position
        d.ent.rotation = tr.rotation
        d.ent.scale = tr.scale
      }
      if (d.token.version !== d.version) {
        d.version = d.token.version
        d.ent.material(emissiveMaterial(d.token).material)
      }
    }
    for (const o of origLights) {
      if (o.l.intensity !== o.last) {
        o.last = o.l.intensity
        o.ent.intensity((o.l.intensity * hdr(o.l.color).intensity) / Math.PI)
      }
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

  // ---- 中继：原版模型（发光/天线/盖板动画由原版 update 驱动），这里只补一盏随发光强度变化的点光 ----
  const relayParts = orig.data.objectives.map((o: any, i: number) => {
    const ud = o.object.userData
    const b = ud.beacon as number[]
    o.object.updateWorldMatrix(true, false)
    const e = o.object.matrixWorld.elements
    const wx = e[0] * b[0] + e[4] * b[1] + e[8] * b[2] + e[12]
    const wy = e[1] * b[0] + e[5] * b[1] + e[9] * b[2] + e[13]
    const wz = e[2] * b[0] + e[6] * b[1] + e[10] * b[2] + e[14]
    const light = scene.light({ type: 'point', name: `relay-light-${i}`, position: toUnityPos({ x: wx, y: wy, z: wz }), intensity: 1.2, range: 6, color: '#ff5a40' })
    return { ud, light }
  })

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
    relayParts.forEach((r: any, i: number) => r.ud.setState?.(relays[i] ?? 'live'))
    syncOrig(dt)
    relayParts.forEach((r: any) => {
      const c = hdr(r.ud.emissiveMaterial.color)
      r.light.intensity(Math.min(2, (r.ud.level ?? 0) * 0.2))
      r.light.color(c.color)
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
