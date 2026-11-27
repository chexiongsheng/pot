/**
 * realistic 套件（004 第 17.8 节）：写实环境与材质预设。
 *
 *   import realistic, { presets, materials, lightningValue } from '@pot/kit/realistic'
 *   export default defineGame({
 *     kits: [realistic],
 *     scene: () => <>
 *       <entity key="env" atmosphere={{ preset: 'overcast' }} />
 *       <entity key="storm" weather={{ rain: 0.6, lightning: {} }} />
 *       <entity key="ground" scale={[40, 1, 40]} surface={{ kind: 'plane', material: 'wetGround' }} />
 *     </>,
 *   })
 *
 * atmosphere 是时段与画面（太阳、天空、环境光、雾、后处理），weather 是天气（雨、雨声、闪电与雷声，见 weather.ts）。
 * 黄昏预设与闪电的时间分布、闪光曲线取自 saltline。atmosphere 还可以换成原版移植的后处理链（chain）、
 * 按画质档位表切换（quality，档位读 w.vars.renderQuality）；
 * 游戏驱动的后处理参数（受伤、低血量、开镜）用 setPostValues 写。beacon 是目标标记（光圈、光柱、点光）。
 */
import { defineBlock, defineKit, parseColor } from '@pot/core'
import type { Color, Entity, FogOptions, MaterialOptions, Over, PostOptions, SkyOptions, Vec3 } from '@pot/core'
import { viewGun } from './viewgun'
import { createPost, type PostFx } from './post'
import { VIEW_LAYER } from './layers'
import { weather, lightningNow, setWeatherDrops } from './weather'

// ---------------------------------------------------------------- 预设

export interface SunSpec {
  rotation: Vec3
  intensity: number
  color: Color
}
export interface AmbientSpec {
  sky: Color
  equator: Color
  ground: Color
  reflection: number
}
export interface FogSpec extends FogOptions {
  color: Color
  density: number
}
export interface Preset {
  sun: SunSpec
  sky: SkyOptions
  ambient: AmbientSpec
  fog: FogSpec
  post: PostOptions
}

const freeze = <T>(v: T): T => {
  if (v && typeof v === 'object') {
    for (const k of Object.keys(v)) freeze((v as any)[k])
    Object.freeze(v)
  }
  return v
}

/** 三个环境预设（只读）。dusk 取自 saltline 的 tuning.json 的 look；天气不在预设里（weather 积木） */
export const presets: Readonly<Record<'dusk' | 'overcast' | 'night', Preset>> = freeze({
  dusk: {
    sun: { rotation: [13, -70, 0], intensity: 3.8, color: '#ffd2a0' },
    sky: {
      zenith: '#46597a', horizon: '#f7b77c', horizonAway: '#8a98aa', ground: '#3a3a3c', sun: '#ffd29a', sunIntensity: 22, sunSize: 0.018,
      sunGlow: 1, clouds: 0.6, cloudColor: '#b8a08c', cloudSpeed: 0.004, horizonFog: 0.6, exposure: 0.8,
    },
    ambient: { sky: '#72829a', equator: '#a8927c', ground: '#45403a', reflection: 0.8 },
    fog: { color: '#b9a690', density: 0.0062, height: 0.05, base: 0, sun: 1.2 },
    post: {
      tonemap: 'aces', exposure: 0.2, contrast: 20, saturation: 6, temperature: 8, tint: 2, bloom: 0.6, bloomThreshold: 1.2, bloomScatter: 0.72,
      vignette: 0.28, vignetteSmooth: 0.45, grain: 0.07, chromatic: 0.03, shadows: [0.96, 1, 1.08, 0], highlights: [1.06, 1, 0.92, 0],
    },
  },
  overcast: {
    sun: { rotation: [55, -40, 0], intensity: 1.1, color: '#c9d0d8' },
    sky: {
      zenith: '#7d8792', horizon: '#a9b0b6', horizonAway: '#9aa2aa', ground: '#4a4c4e', sun: '#d8dde2', sunIntensity: 2, sunSize: 0.02,
      sunGlow: 0.3, clouds: 1, cloudColor: '#8d949b', cloudSpeed: 0.006, horizonFog: 0.8, exposure: 0.9,
    },
    ambient: { sky: '#8e98a3', equator: '#858b90', ground: '#4d4f50', reflection: 0.6 },
    fog: { color: '#9aa1a8', density: 0.012, height: 0.04, base: 0, sun: 0.2 },
    post: {
      tonemap: 'aces', exposure: 0.3, contrast: 12, saturation: -18, temperature: -6, tint: 0, bloom: 0.3, bloomThreshold: 1.3, bloomScatter: 0.7,
      vignette: 0.22, vignetteSmooth: 0.45, grain: 0.05,
    },
  },
  night: {
    sun: { rotation: [35, 150, 0], intensity: 0.35, color: '#9fb4e0' },
    sky: {
      zenith: '#05080f', horizon: '#1a2333', horizonAway: '#0d1320', ground: '#07080a', sun: '#c8d6ff', sunIntensity: 6, sunSize: 0.012,
      sunGlow: 0.4, clouds: 0.4, cloudColor: '#1c2230', cloudSpeed: 0.003, horizonFog: 0.5, exposure: 0.6,
    },
    ambient: { sky: '#1d2638', equator: '#151a24', ground: '#0a0b0e', reflection: 0.4 },
    fog: { color: '#141a26', density: 0.014, height: 0.05, base: 0, sun: 0.3 },
    post: {
      tonemap: 'aces', exposure: 0.6, contrast: 18, saturation: -10, temperature: -14, tint: 2, bloom: 0.9, bloomThreshold: 1, bloomScatter: 0.75,
      vignette: 0.35, vignetteSmooth: 0.5, grain: 0.08,
    },
  },
})

export type PresetName = keyof typeof presets

/** 材质预设（只读）：color 之外是 scene.spawn 的 material 参数 */
export const materials: Readonly<Record<'wetGround' | 'metal' | 'concrete', MaterialOptions & { color: Color }>> = freeze({
  wetGround: { color: '#3b3d40', metallic: 0, smoothness: 0.9, wet: 1, planar: 0.7, occlusion: 1 },
  metal: { color: '#8a8d90', metallic: 1, smoothness: 0.6, wet: 0.5 },
  concrete: { color: '#8c8a85', metallic: 0, smoothness: 0.15, wet: 0.6 },
})

// ---------------------------------------------------------------- 小工具

const isObj = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v)
/** 深合并（数组整个替换），不改参数 */
function deep<T>(base: T, over: any): T {
  if (!isObj(base) || !isObj(over)) return (over === undefined ? base : over) as T
  const out: any = { ...base }
  for (const k of Object.keys(over)) out[k] = deep((base as any)[k], over[k])
  return out
}

/** 闪光曲线在 weather.ts（这里转导出） */
export { lightningValue } from './weather'

const scaled = (c: Color, k: number): Color => {
  const [r, g, b] = parseColor(c)
  return [r * k, g * k, b * k]
}

// ---------------------------------------------------------------- atmosphere

export type { LightningProps } from './weather'

const ATMOS_PROPS = {
  preset: 'dusk' as PresetName,
  sun: {} as Partial<SunSpec>,
  sky: {} as SkyOptions,
  ambient: {} as Partial<AmbientSpec>,
  fog: {} as Partial<FogSpec>,
  post: {} as PostOptions,
  reflection: 0,
  /** 原版移植的后处理链（运行时着色器可用时代替 URP 后处理）；sunColor 缺省取 sky.sun */
  chain: null as { exposure?: number; sunColor?: string } | null,
  /** 画质档位表：按 w.vars.renderQuality 选档 */
  quality: null as QualityLevel[] | null,
}

/** 画质档位（saltline 的 tuning.quality.levels） */
export interface QualityLevel {
  renderScale: number
  shadowDistance: number
  shadowResolution: number
  shadowCascades: number
  /** 平面反射分辨率比例，0 为关 */
  reflection: number
  /** 内置雨滴粒子数（交给 weather；它的 shaderRain 且着色器可用时不用） */
  drops: number
  ao: number
  antialias: 'none' | 'fxaa' | 'smaa'
  msaa?: number
  reflectionShadows: boolean
  bloom?: boolean
}

export type AtmosphereProps = typeof ATMOS_PROPS

/** 按属性算出最终的环境（预设深合并分节覆盖） */
export function resolveAtmosphere(me: Partial<AtmosphereProps>): Preset {
  const name = me.preset ?? 'dusk'
  const base = presets[name]
  if (!base) throw new Error(`atmosphere：未知的预设 ${name}，可用 ${Object.keys(presets).join('、')}`)
  return {
    sun: deep(base.sun, me.sun),
    sky: deep(base.sky, me.sky),
    ambient: deep(base.ambient, me.ambient),
    fog: deep(base.fog, me.fog),
    post: deep(base.post, me.post),
  }
}

/** 每个带 atmosphere 的实体在表现层持有的东西（不进 World 数据） */
interface Held {
  sun: Entity | null
  env: Preset
  flash: number
  post?: PostFx
  /** 已应用的画质档位（-1 为未应用） */
  quality: number
  /** 见过的闪电次数（-1 为还没见过 weather 的闪电） */
  strikes: number
  time: number
  frame: number
}

/** 表现层的帧间隔（clock.time 的差分，上限 0.1 秒；同一帧多次取得到同一值） */
function frameDt(h: { time: number; frame: number; dt?: number }, clock: { time: number; frame: number }): number {
  if (h.frame !== clock.frame) {
    h.dt = h.frame === clock.frame - 1 ? Math.min(0.1, Math.max(0, clock.time - h.time)) : 0
    h.frame = clock.frame
    h.time = clock.time
  }
  return h.dt ?? 0
}
const held = new Map<number, Held>()

/** 游戏驱动的后处理参数（受伤、低血量、开镜等），按 World 存，atmosphere 的表现每帧写进链 */
const postValues = new WeakMap<object, Record<string, number | number[]>>()

/**
 * 写后处理链的参数（uDamage、uLowHealth、uAds 等）；没有链时忽略。
 * 按 w.registry 存：游戏传进来的 ctx.world 是服务代理，表现钩子拿到的是 World 本体
 */
export function setPostValues(w: { registry: object }, values: Record<string, number | number[]>) {
  const cur = postValues.get(w.registry)
  if (cur) Object.assign(cur, values)
  else postValues.set(w.registry, { ...values })
}

function applyQuality(ctx: any, me: AtmosphereProps, h: Held, index: number, w: { registry: object }) {
  const levels = me.quality!
  const q = levels[Math.max(0, Math.min(levels.length - 1, index))]
  h.quality = index
  const scene = ctx.scene
  scene.quality({ renderScale: q.renderScale, shadowDistance: q.shadowDistance, shadowResolution: q.shadowResolution, shadowCascades: q.shadowCascades, msaa: q.msaa ?? 1 })
  scene.reflection({ enabled: q.reflection > 0, height: 0, scale: q.reflection > 0 ? q.reflection : undefined, exclude: [VIEW_LAYER], shadows: q.reflectionShadows })
  scene.post({ ao: q.ao, antialias: q.antialias })
  h.post?.quality(q.bloom !== false)
  // 雨滴数随画质档走，由 weather 应用
  setWeatherDrops(w, q.drops)
}

function applyAmbient(ctx: any, a: AmbientSpec, k: number) {
  ctx.scene.ambient({ sky: scaled(a.sky, k), equator: scaled(a.equator, k), ground: scaled(a.ground, k) }, a.reflection)
}
function applyFog(ctx: any, f: FogSpec, k: number, options: boolean) {
  if (!(f.density > 0)) return ctx.scene.fog(false)
  const { color, density, ...rest } = f
  ctx.scene.fog(scaled(color, k), density, options ? rest : undefined)
}

export const atmosphere = defineBlock({
  name: 'atmosphere',
  about: '时段与画面：preset（dusk、overcast、night）加分节覆盖 sun、sky、ambient、fog、post；reflection 开平面反射；chain 用原版后处理链（游戏参数用 setPostValues 写）；quality 为画质档位表（档位读 w.vars.renderQuality，雨滴数交给 weather）。雨与闪电在 weather 积木，打雷时这里按闪光提亮画面。一个场景只放一个',
  props: ATMOS_PROPS,
  view: {
    enter(me, e, ctx, w) {
      const env = resolveAtmosphere(me)
      const scene = ctx.scene
      const old = held.get(e.id)
      if (old) release(old)
      const sun = scene.light({ type: 'directional', name: 'sun', rotation: env.sun.rotation, intensity: env.sun.intensity, color: env.sun.color, shadows: 'soft' })
      const h: Held = { sun, env, flash: 0, quality: -1, strikes: -1, time: ctx.clock.time, frame: ctx.clock.frame }
      held.set(e.id, h)
      scene.sky(env.sky)
      applyAmbient(ctx, env.ambient, 1)
      applyFog(ctx, env.fog, 1, true)
      if (me.chain) h.post = createPost(ctx, { exposure: me.chain.exposure ?? 1, sunColor: me.chain.sunColor ?? (env.sky.sun as string | undefined) })
      if (!h.post) scene.post(env.post)
      if (me.quality?.length) applyQuality(ctx, me, h, w.vars.renderQuality ?? 2, w)
      else {
        setWeatherDrops(w, undefined)
        scene.reflection(me.reflection > 0 ? { enabled: true, height: 0, scale: me.reflection } : { enabled: false })
      }
      scene.refreshEnvironment()
    },
    update(me, e, _objs, ctx, w) {
      const h = held.get(e.id)
      if (!h) return
      const dt = frameDt(h, ctx.clock)
      if (me.quality?.length && (w.vars.renderQuality ?? 2) !== h.quality) applyQuality(ctx, me, h, w.vars.renderQuality ?? 2, w)
      if (h.post) {
        h.post.update(dt)
        const values = postValues.get(w.registry)
        if (values) {
          h.post.set(values)
          postValues.delete(w.registry)
        }
      }
      // 闪电读 weather：新的一次在链上随机一个闪光方向（第一次见到只记下次数）
      const ln = lightningNow(w, ctx.clock.fixedAlpha)
      if (ln && ln.strikes !== h.strikes) {
        const first = h.strikes < 0
        h.strikes = ln.strikes
        if (!first && h.post) {
          const a = Math.PI * (0.55 + Math.random() * 0.9)
          const d = [Math.cos(a), 0.35 + Math.random() * 0.3, Math.sin(a) * (Math.random() < 0.5 ? -1 : 1)]
          const l = Math.hypot(d[0], d[1], d[2])
          h.post.set({ uFlashDir: [d[0] / l, d[1] / l, -d[2] / l] })
        }
      }
      const v = ln?.flash ?? 0
      if (v === h.flash) return
      h.flash = v
      // 有链时写链的 uThunder（原版：闪光值 × 0.35）；没有链时按闪光提亮环境光与雾
      if (h.post) {
        h.post.set({ uThunder: v * 0.35 })
        return
      }
      const k = 1 + v * 3
      applyAmbient(ctx, h.env.ambient, k)
      applyFog(ctx, h.env.fog, k, false)
    },
    exit(_me, e, _objs, ctx, w) {
      const h = held.get(e.id)
      held.delete(e.id)
      if (h) release(h)
      setWeatherDrops(w, undefined)
      ctx.scene.fog(false)
      ctx.scene.reflection({ enabled: false })
    },
  },
})

function release(h: Held) {
  for (const o of [h.sun, h.post?.chain]) {
    try {
      o?.destroy()
    } catch {
      // 已随单元回收
    }
  }
  h.sun = null
  h.post = undefined
}

// ---------------------------------------------------------------- beacon

const BEACON_PROPS = { radius: 3, color: '#38e070', height: 12 }
const BEACON_STATE = { on: false }

interface Beacon { root: Entity; ring: Entity; pillar: Entity; light: Entity; on: boolean }
const beacons = new Map<number, Beacon>()

const hex2 = (v: number) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')

export const beacon = defineBlock({
  name: 'beacon',
  about: '目标标记：地面光圈、光柱、点光，脉动。radius 为光圈半径，color 为颜色（#rrggbb），height 为光柱高；状态 on 由游戏写（为 false 时隐藏）',
  props: BEACON_PROPS,
  state: BEACON_STATE,
  view: {
    enter(me, e, ctx) {
      const scene = ctx.scene
      const old = beacons.get(e.id)
      if (old) dropBeacon(old)
      const root = scene.spawn({ shape: 'empty', name: 'beacon', position: e.pos, active: false })
      const ring = scene.spawn({ parent: root, shape: 'cylinder', name: 'ring', position: [0, 0.02, 0], scale: [me.radius * 2, 0.01, me.radius * 2], color: `${me.color}55`, material: { mode: 'additive', shadows: false }, collider: false })
      const pillar = scene.spawn({ parent: root, shape: 'cylinder', name: 'pillar', position: [0, me.height / 2, 0], scale: [0.25, me.height / 2, 0.25], color: `${me.color}33`, material: { mode: 'additive', shadows: false }, collider: false })
      const light = scene.light({ type: 'point', name: 'beacon-light', parent: root, position: [0, 1.5, 0], intensity: 2.5, range: 10, color: me.color })
      beacons.set(e.id, { root, ring, pillar, light, on: false })
    },
    update(me, e, _objs, ctx) {
      const b = beacons.get(e.id)
      if (!b) return
      if (me.on !== b.on) {
        b.on = me.on
        b.root.active(me.on)
      }
      if (!me.on) return
      const pulse = 0.5 + 0.5 * Math.sin(ctx.clock.time * 3)
      const r = me.radius * 2 * (0.9 + pulse * 0.15)
      b.ring.scale = [r, 0.01, r]
      b.pillar.color(`${me.color}${hex2(30 + pulse * 40)}`)
      b.light.intensity(1.8 + pulse * 1.2)
    },
    exit(_me, e) {
      const b = beacons.get(e.id)
      beacons.delete(e.id)
      if (b) dropBeacon(b)
    },
  },
})

function dropBeacon(b: Beacon) {
  for (const o of [b.light, b.pillar, b.ring, b.root]) {
    try {
      o.destroy()
    } catch {
      // 已随父节点销毁
    }
  }
}

// ---------------------------------------------------------------- surface

const SURFACE_PROPS = {
  kind: 'cube' as string,
  color: null as Color | null,
  scale: 1 as number | Vec3,
  material: 'concrete' as keyof typeof materials | (MaterialOptions & { color?: Color }),
}

/** 由属性解析出颜色与材质参数 */
export function resolveSurface(me: Partial<typeof SURFACE_PROPS>): { color: Color; material: MaterialOptions } {
  const m = me.material ?? 'concrete'
  let preset: MaterialOptions & { color?: Color }
  if (typeof m === 'string') {
    preset = (materials as any)[m]
    if (!preset) throw new Error(`surface：未知的材质预设 ${m}，可用 ${Object.keys(materials).join('、')}`)
  } else preset = m
  const { color, ...material } = preset
  return { color: me.color ?? color ?? '#ffffff', material }
}

export const surface = defineBlock({
  name: 'surface',
  about: '带材质的外形：kind、scale 同 shape；material 为预设名（wetGround、metal、concrete）或材质参数对象；color 为 null 时取预设颜色',
  props: SURFACE_PROPS,
  view: {
    enter(me, e, ctx) {
      const { color, material } = resolveSurface(me)
      return ctx.scene.spawn({ shape: me.kind as any, name: e.name ?? e.prefab, color, material, scale: me.scale, position: e.pos, rotation: e.rot })
    },
  },
})

declare module '@pot/core' {
  interface GameBlockProps {
    atmosphere?: Over<AtmosphereProps>
    surface?: Over<typeof SURFACE_PROPS>
    viewGun?: boolean | Record<string, never>
    beacon?: Over<typeof BEACON_PROPS>
  }
}

export { viewGun, setGunEnv, type GunEnv } from './viewgun'
export { registerSfx, sfx } from './sfx'
export { weather, currentWeather, resolveWeather, type WeatherProps, type WeatherNow } from './weather'

export default defineKit({
  name: 'realistic',
  about: '写实：atmosphere（时段与画面：环境预设 dusk、overcast、night，平面反射，后处理链，画质档位）、weather（天气：雨、雨声、闪电与雷声）、surface（材质预设 wetGround、metal、concrete）、beacon（目标标记）与 viewGun（第一人称枪的样子，配 fps 的 gunFps；场景查询用 setGunEnv 注入）',
  vars: { renderQuality: 2 },
  blocks: [atmosphere, weather, surface, beacon, viewGun],
})
