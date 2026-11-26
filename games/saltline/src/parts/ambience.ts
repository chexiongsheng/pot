/**
 * 环境声（只有表现）：雨声、低鸣、交战紧张感三条循环音，按阶段与是否交战调音量；设置里的总音量变化时调 ctx.audio.volume。
 */
import { defineBlock, type LoopHandle } from '@pot/core'
import { registerSfx, sfx } from '@pot/kit/realistic'
import { phaseOf, type Settings, type Sl } from './state'

interface Mix { rain: LoopHandle; drone: LoopHandle; tension: LoopHandle; tensionVol: number; volume: number; time: number; frame: number; dt: number }
const mixes = new WeakMap<object, Map<number, Mix>>()
const of = (w: object) => {
  let m = mixes.get(w)
  if (!m) mixes.set(w, (m = new Map()))
  return m
}

function stop(m: Mix) {
  for (const l of [m.rain, m.drone, m.tension]) {
    try {
      l.stop()
    } catch {
      // 已停
    }
  }
}

export const slAmbience = defineBlock({
  name: 'slAmbience',
  about: 'saltline 环境声：雨声、低鸣、交战紧张感（暂停时压低），以及总音量（slSettings.volume）',
  props: {},
  view: {
    enter(_me, e, ctx, w) {
      registerSfx(ctx as any)
      const all = of(w), old = all.get(e.id)
      if (old) stop(old)
      all.set(e.id, {
        rain: ctx.audio.loop(sfx('rain'), { volume: 0.35 }),
        drone: ctx.audio.loop(sfx('drone'), { volume: 0.25 }),
        tension: ctx.audio.loop(sfx('tension'), { volume: 0 }),
        tensionVol: 0, volume: -1, time: ctx.clock.time, frame: ctx.clock.frame, dt: 0,
      })
    },
    update(_me, e, _objs, ctx, w) {
      const m = of(w).get(e.id)
      if (!m) return
      const c = ctx.clock
      if (m.frame !== c.frame) {
        m.dt = m.frame === c.frame - 1 ? Math.min(0.1, Math.max(0, c.time - m.time)) : 0
        m.frame = c.frame
        m.time = c.time
      }
      const sl: Sl = w.vars.sl, s: Settings = w.vars.slSettings, ph = phaseOf(w)
      const paused = ph === 'paused'
      const combat = sl?.alerted && ph === 'playing' ? 1 : 0
      m.tensionVol += (combat * 0.4 - m.tensionVol) * Math.min(1, m.dt * 0.8)
      m.tension.set({ volume: paused ? 0 : m.tensionVol })
      m.rain.set({ volume: paused ? 0.08 : 0.35 })
      m.drone.set({ volume: paused ? 0 : ph === 'title' ? 0.35 : 0.2 })
      const vol = s?.volume ?? 0.8
      if (vol !== m.volume) {
        m.volume = vol
        ctx.audio.volume(vol)
      }
    },
    exit(_me, e, _objs, _ctx, w) {
      const all = of(w), m = all.get(e.id)
      if (!m) return
      all.delete(e.id)
      stop(m)
    },
  },
})

declare module '@pot/core' {
  interface GameBlockProps {
    slAmbience?: boolean
  }
}
