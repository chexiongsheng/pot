/**
 * weather 积木（004 第 17.8 节末段，M3.5 第 13 步）：一个场景的天气，雨（雨量、湿度、积水、雨色、风、雨声）与闪电（排期、事件、雷声）。
 * 玩家说“黄昏下暴雨”：黄昏是 atmosphere（时段与画面），暴雨是 weather。
 *
 *   <entity key="sky" atmosphere={{ preset: 'dusk' }} />
 *   <entity key="storm" weather={{ rain: 0.6, lightning: {} }} />
 *
 * 地图自己画的雨幕、积水用 currentWeather(w) 读雨量与湿度（harbor）；闪电提亮画面由 atmosphere 读这里的闪电状态。
 */
import { defineBlock, type Color, type LoopHandle, type Over } from '@pot/core'
import { registerSfx, sfx } from './sfx'

/** 闪光曲线（saltline 原式）：t 为距闪电的秒数，power 为强度 */
export function lightningValue(t: number, power: number): number {
  if (!(t >= 0) || t >= 0.9) return 0
  return Math.max(0, power * Math.exp(-t * 5) * (0.55 + 0.45 * Math.sin(t * 47) * Math.sin(t * 13 + 1)))
}

const LIGHTNING = { every: [30, 60] as [number, number], first: [12, 30] as [number, number], power: [0.3, 1] as [number, number], flash: 1, sound: true }
export type LightningProps = typeof LIGHTNING

const WEATHER_PROPS = {
  /** 雨量 0..1 */
  rain: 0,
  /** 全局湿润 0..1，null 时取 min(1, rain × 2) */
  wetness: null as number | null,
  /** 积水 0..1，null 时取 rain */
  puddles: null as number | null,
  rainColor: null as Color | null,
  /** 风（x, z，米/秒） */
  wind: null as [number, number] | null,
  /** 雨声在雨量为 1 时的音量，0 不放 */
  sound: 0.78,
  /** null 不打雷 */
  lightning: null as Partial<LightningProps> | null,
  /** 雨由别的积木用着色器画（着色器可用时内置雨滴数为 0） */
  shaderRain: false,
}
const WEATHER_STATE = { active: true, next: -1, t: 99, power: 0, strikes: 0, delay: 0 }

export type WeatherProps = typeof WEATHER_PROPS

/** 暂停（叠加状态）时雨声的比例：saltline 原来 0.35 压到 0.08 */
const PAUSED_RAIN = 0.23

const clamp01 = (v: number) => Math.max(0, Math.min(1, v))

/** 当前天气里给地图着色器用的三个量 */
export interface WeatherNow {
  rain: number
  wetness: number
  puddles: number
}

/** 按属性算出雨量、湿度、积水（湿度、积水缺省跟雨量走） */
export function resolveWeather(me: Partial<WeatherProps>): WeatherNow {
  const rain = clamp01(me.rain ?? 0)
  return { rain, wetness: clamp01(me.wetness ?? Math.min(1, rain * 2)), puddles: clamp01(me.puddles ?? rain) }
}

/** 按 w.registry 登记的东西：当前的 weather 实体（读它的属性与闪电状态），atmosphere 当前画质档的内置雨滴数 */
interface Pub {
  entity?: { id: number; b?: Record<string, any> }
  me?: WeatherProps & typeof WEATHER_STATE
  drops?: number
}
const pubs = new WeakMap<object, Pub>()
const pub = (w: { registry: object }) => {
  let p = pubs.get(w.registry)
  if (!p) pubs.set(w.registry, (p = {}))
  return p
}
const live = (w: { registry: object }) => {
  const p = pubs.get(w.registry)
  return (p?.entity?.b?.weather ?? p?.me) as (WeatherProps & typeof WEATHER_STATE) | undefined
}

/** 当前天气；场景里没有 weather 时为 undefined */
export function currentWeather(w: { registry: object }): WeatherNow | undefined {
  const me = live(w)
  return me ? resolveWeather(me) : undefined
}

/** atmosphere 用：闪电的累计次数与当前闪光值（按固定步插值，已乘 flash）；没有 weather 或不打雷时为 undefined */
export function lightningNow(w: { registry: object; dt: number }, alpha: number): { strikes: number; flash: number } | undefined {
  const me = live(w)
  if (!me?.lightning) return undefined
  const t = me.t + (me.active ? alpha * w.dt : 0)
  return { strikes: me.strikes, flash: lightningValue(t, me.power) * (me.lightning.flash ?? LIGHTNING.flash) }
}

/** atmosphere 用：登记当前画质档的内置雨滴数（weather 的表现读它） */
export function setWeatherDrops(w: { registry: object }, drops: number | undefined) {
  pub(w).drops = drops
}

/** 每个 weather 实体在表现层持有的东西 */
interface Held {
  drops: number | undefined
  rain?: LoopHandle
  volume: number
  strikes: number
  thunder: { at: number; near: boolean; gain: number }[]
}
const helds = new WeakMap<object, Map<number, Held>>()
const heldOf = (w: { registry: object }) => {
  let m = helds.get(w.registry)
  if (!m) helds.set(w.registry, (m = new Map()))
  return m
}

function stopRain(h: Held) {
  try {
    h.rain?.stop()
  } catch {
    // 已随单元停
  }
  h.rain = undefined
}

function applyScene(ctx: any, me: WeatherProps, drops: number | undefined) {
  const now = resolveWeather(me)
  ctx.scene.weather({
    ...now,
    ...(me.rainColor != null ? { rainColor: me.rainColor } : {}),
    ...(me.wind ? { wind: me.wind } : {}),
    drops: me.shaderRain && ctx.gfx.supported ? 0 : drops,
  })
}

const rainVolume = (me: WeatherProps, w: any) => me.sound * resolveWeather(me).rain * (w.overlayActive ? PAUSED_RAIN : 1)
const range = (w: any, r: [number, number]) => w.rand(Math.min(r[0], r[1]), Math.max(r[0], r[1]))

export const weather = defineBlock({
  name: 'weather',
  about: '天气：rain 雨量（0..1），wetness、puddles 缺省跟雨量走，rainColor、wind；sound 为雨量 1 时的雨声音量（暂停时压低）；lightning 打雷（发 lightning 事件，payload { entity, power, delay }；sound 缺省 true，按 delay 放雷声）；shaderRain 表示雨由着色器画。一个场景只放一个；active 为 false 时不打雷。地图的雨幕用 currentWeather(w) 读',
  props: WEATHER_PROPS,
  state: WEATHER_STATE,
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
    me.delay = delay
    w.emit('lightning', { entity: e, power: me.power, delay })
  },
  view: {
    enter(me, e, ctx, w) {
      const all = heldOf(w)
      const old = all.get(e.id)
      if (old) stopRain(old)
      const p = pub(w)
      p.entity = e as any
      p.me = me
      const h: Held = { drops: p.drops, volume: -1, strikes: me.strikes, thunder: [] }
      all.set(e.id, h)
      applyScene(ctx, me, p.drops)
      const thunder = !!me.lightning && (me.lightning.sound ?? LIGHTNING.sound)
      const rainy = me.sound > 0 && resolveWeather(me).rain > 0
      if (thunder || rainy) registerSfx(ctx as any)
      if (rainy) {
        h.volume = rainVolume(me, w)
        h.rain = ctx.audio.loop(sfx('rain'), { volume: h.volume })
      }
    },
    update(me, e, _objs, ctx, w) {
      const h = heldOf(w).get(e.id)
      if (!h) return
      const p = pub(w)
      p.entity = e as any
      p.me = me
      // 画质档变了：重下内置雨滴数
      if (p.drops !== h.drops) {
        h.drops = p.drops
        applyScene(ctx, me, h.drops)
      }
      // 雨声：暂停（叠加状态）时压低
      if (h.rain) {
        const v = rainVolume(me, w)
        if (v !== h.volume) {
          h.volume = v
          h.rain.set({ volume: v })
        }
      }
      if (!me.lightning) return
      // 新的闪电：按 delay 排雷声
      const time = ctx.clock.time
      if (me.strikes !== h.strikes) {
        h.strikes = me.strikes
        if (me.lightning.sound ?? LIGHTNING.sound) h.thunder.push({ at: time + me.delay, near: me.power > 0.6, gain: 0.35 + 0.65 * me.power })
      }
      for (let i = h.thunder.length - 1; i >= 0; i--) {
        const s = h.thunder[i]
        if (time < s.at) continue
        h.thunder.splice(i, 1)
        ctx.audio.play(sfx(s.near ? 'thunderNear' : 'thunder'), { volume: s.gain, pitch: 0.9 + Math.random() * 0.2 })
      }
    },
    exit(_me, e, _objs, ctx, w) {
      const all = heldOf(w)
      const h = all.get(e.id)
      all.delete(e.id)
      if (h) stopRain(h)
      const p = pubs.get(w.registry)
      if (p && p.entity?.id === e.id) {
        p.entity = undefined
        p.me = undefined
      }
      ctx.scene.weather({ rain: 0, wetness: 0, puddles: 0 })
    },
  },
})

declare module '@pot/core' {
  interface GameBlockProps {
    weather?: Over<WeatherProps>
  }
}
