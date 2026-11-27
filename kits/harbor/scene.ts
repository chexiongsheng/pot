/**
 * harbor 的场景积木（004 第 19.5 节第 8 步）：港口整张图的样子。
 * - harborLevel（一个实体）：原版地面（apron）、海面、雨幕、buildLevel 的码头几何（常量，不读游戏数据）、原版动态网格（闸杆、中继等，
 *   每帧同步原版动画）、远景闪灯与海鸥、原版点光、中继灯。中继状态读 w.vars.harborRelays（游戏写）。
 *   雨幕的雨量与地坪的积水、湿度跟随场景里的 weather（realistic 的 currentWeather），没有天气时是干的。
 * - harborStatics（若干实体，chunk / of 分份）：原版合并后的静态网格。分成几份，启动预热在实体之间让帧，加载界面不卡。
 * 材质（GPU 烘焙的原版材质）、表面贴图、喷字、闪灯与海鸥着色器按 World 缓存，几个积木共用；场景对象按实体建，exit 倒序销毁。
 */
import { defineBlock } from '@pot/core'
import { currentWeather } from '@pot/kit/realistic'
import type { Context, Entity, MaterialOptions, Texture } from '@pot/core'
import { createMats, MATS, type Mat, type Mats } from '@pot/kit/realistic/mats'
import { toMesh } from '@pot/kit/realistic/geo'
import { rng } from '@pot/kit/realistic/math'
import * as T from '@pot/kit/realistic/textures'
import { createApron, type Apron } from './apron'
import { createSea } from './sea'
import { createRain, type Rain } from './rain'
import { buildLevel, LEVEL_LAYER, type Piece } from './level'
import { emissiveMaterial, gullMesh, hdr, lampAttributes, origLevel, toUnityPos, toUnityTransform, writeUnityTRS, type MatToken } from './origlevel'

// ---------------------------------------------------------------- 表面与喷字

interface SurfaceDef {
  bake: () => T.Baked
  uv: 'mesh' | 'world' | 'object'
  /** 每米（或每网格 UV 单位）重复次数 */
  tiling: number
  /** true：贴图为白底，乘以 piece.color；false：贴图自带颜色，piece.color 置白 */
  tint: boolean
  extra?: MaterialOptions
}

/** 没有运行时着色器时的 CPU 近似贴图 */
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
  logo: { text: 'SALTLINE', width: 512, height: 128, size: 84, color: '#f2f0ea', letterSpacing: 4 },
  code: { text: 'SLTU 482915 7', width: 512, height: 144, size: 64, color: '#f2f0ea', letterSpacing: 6 },
  lane2: { text: '二号通道', width: 512, height: 152, size: 104, color: '#151515', letterSpacing: 8 },
  lane3: { text: '三号通道', width: 512, height: 152, size: 104, color: '#151515', letterSpacing: 8 },
}

function hexRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', '').slice(0, 6), 16)
  return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]
}

// ---------------------------------------------------------------- 按 World 缓存

interface Shared {
  mats?: Mats
  matsTried: boolean
  surfaces: Map<string, T.TexSet>
  paint?: ReturnType<typeof T.paintFields>
  paintShared?: T.TexSet
  paintMaps: Map<string, Texture>
  decals: Map<string, Texture>
  lamp?: any
  gull?: any
  shadersTried: boolean
  levels: Map<number, LevelLook>
  statics: Map<number, Entity[]>
}

const stores = new WeakMap<object, Shared>()
function store(w: object): Shared {
  let S = stores.get(w)
  if (!S) stores.set(w, (S = { matsTried: false, surfaces: new Map(), paintMaps: new Map(), decals: new Map(), shadersTried: false, levels: new Map(), statics: new Map() }))
  return S
}

/** GPU 烘焙的原版材质（运行时着色器不可用或失败时为 undefined，退回 CPU 贴图与纯色） */
function mats(S: Shared, ctx: Context, tex: number): Mats | undefined {
  if (S.matsTried) return S.mats
  S.matsTried = true
  if (!ctx.gfx.supported) return undefined
  try {
    S.mats = createMats(ctx, { tex: tex > 0 ? tex : undefined })
  } catch (err: any) {
    S.mats = undefined
    ctx.logger('harbor').error('GPU 材质不可用，回退 CPU 贴图：%s', err?.message ?? err)
  }
  return S.mats
}

/** 闪灯与海鸥的顶点动画着色器（原版 onBeforeCompile 注入，这里是 gfx 自定义着色器 + 自定义顶点属性） */
function shaders(S: Shared, ctx: Context) {
  if (S.shadersTried) return
  S.shadersTried = true
  if (!ctx.gfx.supported) return
  S.lamp = ctx.gfx.shader({ vertex: '@pot/kit/harbor/shaders/lamp.vert', fragment: '@pot/kit/harbor/shaders/lamp.frag', name: 'saltline/lamp', attributes: { blink: 'vec3', aLamp: 'vec3' } })
  S.gull = ctx.gfx.shader({ vertex: '@pot/kit/harbor/shaders/gull.vert', fragment: '@pot/kit/harbor/shaders/gull.frag', name: 'saltline/gull', attributes: { aOrbit: 'vec4', aPar: 'vec4' } })
}

function surfaceTex(S: Shared, ctx: Context, key: string) {
  let set = S.surfaces.get(key)
  if (!set) S.surfaces.set(key, (set = T.upload(ctx, SURFACES[key].bake())))
  return set
}

/** 集装箱漆面：共享损伤场与法线、遮罩，每种漆色一张基础色 */
function paintTex(S: Shared, ctx: Context, hex: string): T.TexSet {
  if (!S.paint) {
    S.paint = T.paintFields(512)
    S.paintShared = T.upload(ctx, S.paint.baked)
  }
  let map = S.paintMaps.get(hex)
  if (!map) S.paintMaps.set(hex, (map = ctx.scene.texture({ data: T.paintAlbedo(S.paint, hexRgb(hex)), width: S.paint.size, height: S.paint.size })))
  return { ...S.paintShared!, map }
}

function decalTex(S: Shared, ctx: Context, key: string) {
  let tex = S.decals.get(key)
  if (!tex) {
    const d = DECALS[key]
    S.decals.set(key, (tex = ctx.scene.text({ text: d.text, width: d.width, height: d.height, size: d.size, color: d.color, bold: true, letterSpacing: d.letterSpacing })))
  }
  return tex
}

/** 由 piece 解析颜色与材质 */
function resolvePiece(S: Shared, ctx: Context, M: Mats | undefined, piece: Piece, rand: () => number): { color?: string; material?: MaterialOptions } {
  const m = piece.mat ?? {}
  if (piece.decal) {
    return { color: piece.color, material: { mode: 'lit-fade', map: decalTex(S, ctx, piece.decal), shadows: false, smoothness: 0.35, metallic: 0 } }
  }
  const mode = m.mode ?? 'lit'
  const lit = mode === 'lit' || mode === 'lit-cutout' || mode === 'lit-twosided'
  const tex = piece.tex ?? (lit && m.emission === undefined ? 'steel' : 'none')
  if (tex === 'none' || !lit) return { color: piece.color, material: piece.mat }
  if (M) {
    if (tex.startsWith('paint:')) {
      const r = M.get('paint_grey', { color: tex.slice(6), uv: 'mesh' })
      return { color: r.color, material: { ...m, ...r.material, offset: [rand(), rand()], vertexColors: true } }
    }
    const sl = SL[tex]
    if (sl) {
      const r = M.get(sl.mat, { color: sl.tint ? piece.color : undefined, uv: sl.uv })
      return { color: r.color, material: { ...m, ...r.material, offset: [rand(), rand()], ...sl.extra } }
    }
  }
  if (tex.startsWith('paint:')) {
    const set = paintTex(S, ctx, tex.slice(6))
    return {
      color: '#ffffff',
      material: { ...m, ...set, smoothness: 1, metallic: 1, uv: 'mesh', tiling: [1 / 3, 1 / 3], offset: [rand(), rand()], vertexColors: true },
    }
  }
  const def = SURFACES[tex]
  if (!def) return { color: piece.color, material: piece.mat }
  return {
    color: def.tint ? piece.color : '#ffffff',
    material: { ...m, ...surfaceTex(S, ctx, tex), smoothness: 1, metallic: 1, uv: def.uv, tiling: [def.tiling, def.tiling], offset: [rand(), rand()], ...def.extra },
  }
}

/** 材质令牌 → Runner 材质：GPU 烘焙的原版材质；没有运行时着色器时退回纯色 */
function resolveToken(M: Mats | undefined, t: MatToken): { color: string; material: MaterialOptions; mat?: Mat } {
  if (t.kind === 'emissive') return emissiveMaterial(t)
  // 远景闪灯：原版 MeshBasicMaterial + HDR 顶点色 + blink 顶点动画；着色器可用时换成 lamp 着色器闪烁，否则常亮
  if (t.kind === 'lamps') return { color: '#ffffff', material: { mode: 'unlit', vertexColors: true, shadows: false } }
  if (M) {
    const r = M.get(t.name, { interior: !!t.opts.interior, vertexColors: t.vertexColors })
    return { color: r.color, material: { ...r.material, vertexColors: t.vertexColors }, mat: r }
  }
  const def = MATS[t.name]
  const hex = `#${(def?.color ?? 0x808080).toString(16).padStart(6, '0')}`
  return { color: hex, material: { metallic: def?.metal ?? 0, smoothness: 1 - (def?.rough ?? 0.7), vertexColors: t.vertexColors, mode: def?.transparent ? 'lit-fade' : 'lit' } }
}

/** Canvas 2D 绘制的贴花与喷字（decal、label）暂缺，跳过 */
const drawable = (t: MatToken) => t.kind !== 'decal' && t.kind !== 'label'

function destroyAll(list: { destroy(): void }[]) {
  for (let i = list.length - 1; i >= 0; i--) {
    try {
      list[i].destroy()
    } catch {
      // 已随父节点销毁
    }
  }
  list.length = 0
}

/** 表现层的帧间隔（clock.time 的差分，上限 0.1 秒） */
function frameDt(h: { time: number; frame: number; dt: number }, clock: { time: number; frame: number }): number {
  if (h.frame !== clock.frame) {
    h.dt = h.frame === clock.frame - 1 ? Math.min(0.1, Math.max(0, clock.time - h.time)) : 0
    h.frame = clock.frame
    h.time = clock.time
  }
  return h.dt
}

// ---------------------------------------------------------------- harborLevel

interface LevelLook {
  objs: Entity[]
  apron?: Apron
  rain?: Rain
  dynamic: { mesh: any; ent: Entity; last: number[]; token: MatToken; version: number }[]
  dynIds: Int32Array
  dynData: Float32Array
  lights: { l: any; ent: Entity; last: number }[]
  relays: { ud: any; light: Entity }[]
  /** 已下发给雨幕与地坪的雨量、湿度（-1 为未下发） */
  rainLevel: number
  wet: number
  time: number
  frame: number
  dt: number
}

const LEVEL_PROPS = { tex: 0 }

function buildLevelLook(S: Shared, ctx: Context, me: typeof LEVEL_PROPS): LevelLook {
  const { scene } = ctx
  const M = mats(S, ctx, me.tex)
  shaders(S, ctx)
  const L: LevelLook = { objs: [], dynamic: [], dynIds: new Int32Array(0), dynData: new Float32Array(0), lights: [], relays: [], rainLevel: -1, wet: -1, time: ctx.clock.time, frame: ctx.clock.frame, dt: 0 }
  const add = <E extends Entity>(o: E): E => (L.objs.push(o), o)
  const rand = rng(1931)

  // 原版地面（积水、干湿、油污、接缝）与海面（Gerstner 波）；不可用时保留 buildLevel 的盒子地面、海面
  const big = me.tex >= 1024
  L.apron = createApron(ctx, { maskRes: big ? 1024 : 512, detailRes: big ? 512 : 256 })
  const sea = L.apron ? createSea(ctx, L.apron) : undefined
  if (sea) add(sea)
  const replaced = new Set<string>([...(L.apron ? ['ground', 'quay-deck'] : []), ...(sea ? ['sea'] : [])])

  // 码头几何：地面、码头、海面、轨道、空气墙
  for (const piece of buildLevel()) {
    if (piece.hidden || replaced.has(piece.name ?? '')) continue
    const collide = piece.collide !== false
    const { color, material } = resolvePiece(S, ctx, M, piece, rand)
    const common = { shape: piece.shape ?? 'cube', name: piece.name ?? 'level', color, material, collider: collide, layer: collide ? LEVEL_LAYER : undefined } as const
    const scale = piece.scale ?? piece.size
    if (piece.parentScale) {
      const parent = add(scene.spawn({ shape: 'empty', name: 'gable', position: piece.pos, scale: piece.parentScale }))
      add(scene.spawn({ ...common, parent, position: [0, 0, 0], rotation: piece.rot, scale, collider: false, layer: undefined }))
    } else {
      add(scene.spawn({ ...common, position: piece.pos, rotation: piece.rot, scale }))
    }
  }

  // 原版雨丝、檐口滴水、地面溅射
  const orig = origLevel()
  if (L.apron) L.rain = createRain(ctx, { mask: L.apron.mask, level: orig.data })

  // 原版动态网格：中继、闸杆等会动的实心网格也要挡子弹（网格碰撞体 + 运动学刚体）
  const meshKey = { key: orig.stamp }
  for (let k = 0; k < orig.dynamics.length; k++) {
    const d = orig.dynamics[k]
    if (!drawable(d.material)) continue
    const name = `orig-dyn-${k}`
    const lamp = S.lamp && d.material.kind === 'lamps' ? lampAttributes(d.mesh.geometry) : undefined
    scene.mesh(name, () => (lamp ? { ...toMesh(d.mesh.geometry), attributes: lamp } : toMesh(d.mesh.geometry)), meshKey)
    const r = resolveToken(M, d.material)
    const tr = toUnityTransform(d.mesh.matrixWorld)
    const solid = !d.material.transparent && d.material.kind === 'std'
    const ent = add(scene.spawn({
      shape: `mesh:${name}`, name: `level-dyn:${d.material.name}`, position: tr.position, rotation: tr.rotation, scale: tr.scale,
      color: r.color, material: { ...r.material, shadows: d.mesh.castShadow },
      collider: solid ? 'mesh' : false, dynamic: solid, layer: solid ? LEVEL_LAYER : undefined,
    }))
    if (r.mat) M!.apply(ent, r.mat, { shadows: d.mesh.castShadow })
    // 闪灯网格包围盒是真实的（只是颜色变），保留视锥剔除
    if (lamp) ent.shader(S.lamp, { shadows: false })
    L.dynamic.push({ mesh: d.mesh, ent, last: d.mesh.matrixWorld.elements.slice(), token: d.material, version: d.material.version })
  }
  L.dynIds = new Int32Array(L.dynamic.length)
  L.dynData = new Float32Array(L.dynamic.length * 10)

  // 远景海鸥
  if (S.gull) {
    scene.mesh('saltline/gulls', () => gullMesh(), meshKey)
    add(scene.spawn({ shape: 'mesh:saltline/gulls', name: 'gulls', position: [0, 0, 0], collider: false }))
      .shader(S.gull, { cull: 'none', frustumCull: false, shadows: false, sceneDepth: false, uniforms: { uColor: [0.2, 0.21, 0.23] } })
  }

  // 原版点光源：three 物理单位（坎德拉）直接传，由 Runner 换算；distance 为 0（不截断）时 URP 仍需有限范围，取 15 米
  for (const l of orig.lights) {
    l.updateWorldMatrix(true, false)
    const p = toUnityPos({ x: l.matrixWorld.elements[12], y: l.matrixWorld.elements[13], z: l.matrixWorld.elements[14] })
    const c = hdr(l.color)
    const ent = add(scene.light({ type: 'point', name: 'orig-light', position: p, units: 'three', intensity: l.intensity * c.intensity, distance: l.distance, range: l.distance > 0 ? undefined : 15, color: c.color }))
    L.lights.push({ l, ent, last: l.intensity })
  }

  // 中继：原版模型（发光、天线、盖板动画由原版 update 驱动），这里补一盏随发光强度变化的点光
  orig.data.objectives.forEach((o: any, i: number) => {
    const ud = o.object.userData
    const b = ud.beacon as number[]
    o.object.updateWorldMatrix(true, false)
    const e = o.object.matrixWorld.elements
    const wx = e[0] * b[0] + e[4] * b[1] + e[8] * b[2] + e[12]
    const wy = e[1] * b[0] + e[5] * b[1] + e[9] * b[2] + e[13]
    const wz = e[2] * b[0] + e[6] * b[1] + e[10] * b[2] + e[14]
    const light = add(scene.light({ type: 'point', name: `relay-light-${i}`, position: toUnityPos({ x: wx, y: wy, z: wz }), intensity: 1.2, range: 6, color: '#ff5a40' }))
    L.relays.push({ ud, light })
  })
  return L
}

/** 原版动画走一帧，变了的动态网格一次下发；点光强度变了才改 */
function syncOrig(L: LevelLook, ctx: Context, dt: number) {
  const orig = origLevel()
  orig.update(dt)
  orig.data.root.updateMatrixWorld(true)
  let moved = 0
  for (const d of L.dynamic) {
    const el = d.mesh.matrixWorld.elements
    let changed = false
    for (let k = 0; k < 16; k++) if (el[k] !== d.last[k]) { changed = true; d.last[k] = el[k] }
    if (changed) {
      L.dynIds[moved] = d.ent.id
      writeUnityTRS(d.mesh.matrixWorld, L.dynData, moved * 10)
      moved++
    }
    if (d.token.version !== d.version) {
      d.version = d.token.version
      d.ent.material(emissiveMaterial(d.token).material)
    }
  }
  if (moved) ctx.scene.setTransforms(L.dynIds, L.dynData, { count: moved })
  for (const o of L.lights) {
    if (o.l.intensity !== o.last) {
      o.last = o.l.intensity
      o.ent.intensity(o.l.intensity * hdr(o.l.color).intensity)
    }
  }
}

function dropLevel(L: LevelLook) {
  L.rain?.destroy()
  L.apron?.destroy()
  destroyAll(L.objs)
  L.dynamic = []
  L.lights = []
  L.relays = []
}

/**
 * 雨幕与地坪跟随天气。港区的着色器按原版调过：雨幕与地坪 uRain 0.6、地坪 uWetG 1 是 saltline 的黄昏暴雨（weather 雨量 0.45、湿度 0.85），
 * 所以雨量乘 4/3、湿度除以 0.85 再交给着色器（都不超过 1）；值变了才下发
 */
export function harborRainLevels(now: { rain: number; wetness: number } | undefined): { rain: number; wet: number } {
  return { rain: Math.min(1, (now?.rain ?? 0) * 4 / 3), wet: Math.min(1, (now?.wetness ?? 0) / 0.85) }
}

function followWeather(L: LevelLook, w: { registry: object }) {
  const { rain, wet } = harborRainLevels(currentWeather(w))
  if (rain !== L.rainLevel) {
    L.rainLevel = rain
    L.rain?.setRain(rain)
    L.apron?.setRain(rain)
  }
  if (wet !== L.wet) {
    L.wet = wet
    L.apron?.setWet(wet)
  }
}

export const harborLevel = defineBlock({
  name: 'harborLevel',
  about: '港口整张图（只有表现）：原版地面积水、海面、雨幕（雨量与积水跟随场景里的 weather，没有天气时是干的）、关卡几何、原版动态网格与动画、远景闪灯与海鸥、点光与中继灯。tex 为贴图档（0 缺省，1024 为高）；中继状态读 w.vars.harborRelays（live、cutting、cut 数组）。一个场景放一个，建议标 keep',
  props: LEVEL_PROPS,
  view: {
    // 实测（Windows）约 350 ms：地面遮罩与细节、海面、雨幕、关卡几何、动态网格；harborStatics 每份约 80 ms，缺省 1
    cost: 4,
    enter(me, e, ctx, w) {
      const S = store(w)
      const old = S.levels.get(e.id)
      if (old) dropLevel(old)
      S.levels.set(e.id, buildLevelLook(S, ctx as any, me))
    },
    update(_me, e, _objs, ctx, w) {
      const L = store(w).levels.get(e.id)
      if (!L) return
      const dt = frameDt(L, ctx.clock)
      const relays: string[] = w.vars.harborRelays ?? []
      L.relays.forEach((r, i) => r.ud.setState?.(relays[i] ?? 'live'))
      syncOrig(L, ctx as any, dt)
      followWeather(L, w)
      L.rain?.update(dt)
      for (const r of L.relays) {
        const c = hdr(r.ud.emissiveMaterial.color)
        r.light.intensity(Math.min(2, (r.ud.level ?? 0) * 0.2))
        r.light.color(c.color)
      }
    },
    exit(_me, e, _objs, _ctx, w) {
      const S = stores.get(w)
      const L = S?.levels.get(e.id)
      if (!L) return
      S!.levels.delete(e.id)
      dropLevel(L)
    },
  },
})

// ---------------------------------------------------------------- harborStatics

const STATICS_PROPS = { chunk: 0, of: 1, tex: 0 }

export const harborStatics = defineBlock({
  name: 'harborStatics',
  about: '港口的原版静态网格（只有表现）：堆场、仓库、围栏、道具等合并后的网格，chunk / of 表示建全部的第几份（分份后启动预热在实体之间让帧）。tex 同 harborLevel。建议标 keep',
  props: STATICS_PROPS,
  view: {
    enter(me, e, ctx, w) {
      const S = store(w)
      const old = S.statics.get(e.id)
      if (old) destroyAll(old)
      const M = mats(S, ctx as any, me.tex)
      const orig = origLevel()
      const n = orig.statics.length, of = Math.max(1, Math.floor(me.of)), k = Math.min(of - 1, Math.max(0, Math.floor(me.chunk)))
      const from = Math.floor(n * k / of), to = Math.floor(n * (k + 1) / of)
      const meshKey = { key: orig.stamp }
      const list: Entity[] = []
      for (let i = from; i < to; i++) {
        const s = orig.statics[i]
        if (!drawable(s.material)) continue
        const name = `orig-static-${i}`
        ctx.scene.mesh(name, () => toMesh(s.geometry), meshKey)
        const r = resolveToken(M, s.material)
        const solid = !s.material.transparent && s.material.kind === 'std'
        const ent = ctx.scene.spawn({
          shape: `mesh:${name}`, name: `level:${s.material.name}`, color: r.color,
          material: { ...r.material, shadows: s.cast }, collider: solid, layer: solid ? LEVEL_LAYER : undefined,
        })
        if (r.mat) M!.apply(ent, r.mat, { shadows: s.cast })
        list.push(ent)
      }
      S.statics.set(e.id, list)
    },
    exit(_me, e, _objs, _ctx, w) {
      const S = stores.get(w)
      const list = S?.statics.get(e.id)
      if (!list) return
      S!.statics.delete(e.id)
      destroyAll(list)
    },
  },
})

export type HarborLevelProps = typeof LEVEL_PROPS
export type HarborStaticsProps = typeof STATICS_PROPS
