/**
 * realistic 套件（004 第 17.8 节）：写实环境与材质预设。
 *
 *   import realistic, { presets, materials, lightningValue } from '@pot/kit/realistic'
 *   export default defineGame({
 *     kits: [realistic],
 *     scene: () => <>
 *       <entity key="env" atmosphere={{ preset: 'overcast', rain: 0.6, lightning: {} }} />
 *       <entity key="ground" scale={[40, 1, 40]} surface={{ kind: 'plane', material: 'wetGround' }} />
 *     </>,
 *   })
 *
 * 黄昏预设与闪电的时间分布、闪光曲线取自 saltline；saltline 自己的后处理链、apron 雨幕留在游戏里。
 */
import { defineBlock, defineKit, parseColor } from '@pot/core'
import type { Color, Entity, FogOptions, MaterialOptions, Over, PostOptions, SkyOptions, Vec3, WeatherOptions } from '@pot/core'

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
  weather: WeatherOptions
}

const freeze = <T>(v: T): T => {
  if (v && typeof v === 'object') {
    for (const k of Object.keys(v)) freeze((v as any)[k])
    Object.freeze(v)
  }
  return v
}

const DRY: WeatherOptions = { wetness: 0, puddles: 0, rain: 0 }

/** 三个环境预设（只读）。dusk 取自 saltline 的 tuning.json 的 look，去掉天气 */
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
    weather: { ...DRY },
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
    weather: { ...DRY },
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
    weather: { ...DRY },
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

/** 闪光曲线（saltline 原式）：t 为距闪电的秒数，power 为强度 */
export function lightningValue(t: number, power: number): number {
  if (!(t >= 0) || t >= 0.9) return 0
  return Math.max(0, power * Math.exp(-t * 5) * (0.55 + 0.45 * Math.sin(t * 47) * Math.sin(t * 13 + 1)))
}

const scaled = (c: Color, k: number): Color => {
  const [r, g, b] = parseColor(c)
  return [r * k, g * k, b * k]
}

// ---------------------------------------------------------------- atmosphere

const LIGHTNING = { every: [30, 60] as [number, number], first: [12, 30] as [number, number], power: [0.3, 1] as [number, number], flash: 1 }
export type LightningProps = typeof LIGHTNING

const ATMOS_PROPS = {
  preset: 'dusk' as PresetName,
  sun: {} as Partial<SunSpec>,
  sky: {} as SkyOptions,
  ambient: {} as Partial<AmbientSpec>,
  fog: {} as Partial<FogSpec>,
  post: {} as PostOptions,
  weather: {} as WeatherOptions,
  rain: 0,
  reflection: 0,
  lightning: null as Partial<LightningProps> | null,
}

const ATMOS_STATE = { active: true, next: -1, t: 99, power: 0, strikes: 0 }

export type AtmosphereProps = typeof ATMOS_PROPS

/** 按属性算出最终的环境（预设深合并分节覆盖，再套 rain 简写） */
export function resolveAtmosphere(me: Partial<AtmosphereProps>): Preset {
  const name = me.preset ?? 'dusk'
  const base = presets[name]
  if (!base) throw new Error(`atmosphere：未知的预设 ${name}，可用 ${Object.keys(presets).join('、')}`)
  const rain = Math.max(0, Math.min(1, me.rain ?? 0))
  const weather = rain > 0 ? { ...base.weather, rain, wetness: Math.min(1, rain * 2), puddles: rain } : base.weather
  return {
    sun: deep(base.sun, me.sun),
    sky: deep(base.sky, me.sky),
    ambient: deep(base.ambient, me.ambient),
    fog: deep(base.fog, me.fog),
    post: deep(base.post, me.post),
    weather: deep(weather, me.weather),
  }
}

/** 每个带 atmosphere 的实体在表现层持有的东西（不进 World 数据） */
interface Held {
  sun: Entity | null
  env: Preset
  flash: number
}
const held = new Map<number, Held>()

function applyAmbient(ctx: any, a: AmbientSpec, k: number) {
  ctx.scene.ambient({ sky: scaled(a.sky, k), equator: scaled(a.equator, k), ground: scaled(a.ground, k) }, a.reflection)
}
function applyFog(ctx: any, f: FogSpec, k: number, options: boolean) {
  if (!(f.density > 0)) return ctx.scene.fog(false)
  const { color, density, ...rest } = f
  ctx.scene.fog(scaled(color, k), density, options ? rest : undefined)
}

const range = (w: any, r: [number, number]) => w.rand(Math.min(r[0], r[1]), Math.max(r[0], r[1]))

export const atmosphere = defineBlock({
  name: 'atmosphere',
  about: '写实环境：preset（dusk、overcast、night）加分节覆盖 sun、sky、ambient、fog、post、weather；rain 为雨量简写，reflection 开平面反射，lightning 打雷（发 lightning 事件，payload { entity, power, delay }）。一个场景只放一个；active 为 false 时不打雷',
  props: ATMOS_PROPS,
  state: ATMOS_STATE,
  step(me, e, w) {
    me.t += w.dt
    if (!me.lightning) return
    const l = { ...LIGHTNING, ...me.lightning }
    if (me.next < 0) me.next = range(w, l.first)
    if (!me.active) return
    me.next -= w.dt
    if (me.next > 0) return
    me.power = Math.min(1, range(w, l.power))
    me.t = 0
    me.strikes++
    me.next = range(w, l.every)
    const delay = 0.5 + (1 - me.power) * 2 + w.rand() * 0.6
    w.emit('lightning', { entity: e, power: me.power, delay })
  },
  view: {
    enter(me, e, ctx) {
      const env = resolveAtmosphere(me)
      const scene = ctx.scene
      const old = held.get(e.id)
      if (old?.sun) old.sun.destroy()
      const sun = scene.light({ type: 'directional', name: 'sun', rotation: env.sun.rotation, intensity: env.sun.intensity, color: env.sun.color, shadows: 'soft' })
      held.set(e.id, { sun, env, flash: 0 })
      scene.sky(env.sky)
      applyAmbient(ctx, env.ambient, 1)
      applyFog(ctx, env.fog, 1, true)
      scene.post(env.post)
      scene.weather(env.weather)
      scene.reflection(me.reflection > 0 ? { enabled: true, height: 0, scale: me.reflection } : { enabled: false })
      scene.refreshEnvironment()
    },
    update(me, e, _objs, ctx, w) {
      const h = held.get(e.id)
      if (!h || !me.lightning) return
      const flash = me.lightning.flash ?? LIGHTNING.flash
      const t = me.t + (me.active ? ctx.clock.fixedAlpha * w.dt : 0)
      const v = lightningValue(t, me.power) * flash
      if (v === h.flash) return
      h.flash = v
      const k = 1 + v * 3
      applyAmbient(ctx, h.env.ambient, k)
      applyFog(ctx, h.env.fog, k, false)
    },
    exit(_me, e, _objs, ctx) {
      const h = held.get(e.id)
      held.delete(e.id)
      if (h?.sun) {
        try {
          h.sun.destroy()
        } catch {
          // 已随单元回收
        }
      }
      ctx.scene.fog(false)
      ctx.scene.weather({ rain: 0, wetness: 0, puddles: 0 })
      ctx.scene.reflection({ enabled: false })
    },
  },
})

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
  }
}

export default defineKit({
  name: 'realistic',
  about: '写实：atmosphere（环境预设 dusk、overcast、night，雨、平面反射、闪电）与 surface（材质预设 wetGround、metal、concrete）',
  blocks: [atmosphere, surface],
})
