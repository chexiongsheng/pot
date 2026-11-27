/**
 * 配乐与提示音（只有表现）：低鸣、交战紧张感两条循环音，按阶段与是否交战调音量；设置里的总音量变化时调 ctx.audio.volume；
 * 无线电、命中、击杀的提示音（按 w.vars.slHud 里的序号变化放）。雨声与雷声归天气（realistic 的 weather，<Harbor> 里放）。
 *
 * 听到的：低沉的嗡鸣在标题画面更响；被敌人发现后，战斗中慢慢升起紧张的配乐。
 */
import { defineBlock, type LoopHandle } from '@pot/core'
import { registerSfx, sfx } from '@pot/kit/realistic'
import { phaseOf, type Settings, type Sl, type SlHud } from './state'

/** 一个声音实体的混音状态：两条循环音、紧张感当前音量、已设的总音量、帧间隔、已响过的无线电与命中序号 */
interface Mix { drone: LoopHandle; tension: LoopHandle; tensionVol: number; volume: number; time: number; frame: number; dt: number; radio: number; marker: number }
const mixes = new WeakMap<object, Map<number, Mix>>()
const of = (w: object) => {
  let m = mixes.get(w)
  if (!m) mixes.set(w, (m = new Map()))
  return m
}

/** 停掉两条循环音（实体销毁、热重载重建时） */
function stop(m: Mix) {
  for (const l of [m.drone, m.tension]) {
    try {
      l.stop()
    } catch {
      // 已停
    }
  }
}

export const slAudio = defineBlock({
  name: 'slAudio',
  about: 'saltline 配乐与提示音：低鸣、交战紧张感（暂停时静音），总音量（slSettings.volume），无线电、命中、击杀的提示音。雨声在天气里',
  props: {},
  view: {
    enter(_me, e, ctx, w) {
      registerSfx(ctx as any)
      const all = of(w), old = all.get(e.id)
      if (old) stop(old)
      all.set(e.id, {
        drone: ctx.audio.loop(sfx('drone'), { volume: 0.25 }),
        tension: ctx.audio.loop(sfx('tension'), { volume: 0 }),
        tensionVol: 0, volume: -1, time: ctx.clock.time, frame: ctx.clock.frame, dt: 0,
        radio: w.vars.slHud?.radio.n ?? 0, marker: w.vars.slHud?.marker.n ?? 0,
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
      // 交战紧张感：被发现后战斗中升到 0.4，否则慢慢落下（一两秒的过渡）；暂停时静音
      const combat = sl?.alerted && ph === 'playing' ? 1 : 0
      m.tensionVol += (combat * 0.4 - m.tensionVol) * Math.min(1, m.dt * 0.8)
      m.tension.set({ volume: paused ? 0 : m.tensionVol })
      // 低鸣在标题画面最响，暂停时静音
      m.drone.set({ volume: paused ? 0 : ph === 'title' ? 0.35 : 0.2 })
      // 设置面板的总音量
      const vol = s?.volume ?? 0.8
      if (vol !== m.volume) {
        m.volume = vol
        ctx.audio.volume(vol)
      }
      // 提示音：指挥中心每说一句话响一声无线电；命中和击杀各有一种提示音，弱点命中音调更高
      const hud: SlHud | undefined = w.vars.slHud
      if (hud && hud.radio.n !== m.radio) {
        m.radio = hud.radio.n
        ctx.audio.play(sfx('radio'), { volume: 0.5 })
      }
      if (hud && hud.marker.n !== m.marker) {
        m.marker = hud.marker.n
        ctx.audio.play(sfx(hud.marker.kill ? 'kill' : 'hit'), { volume: 0.5, pitch: hud.marker.weak ? 1.25 : 1 })
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
    slAudio?: boolean
  }
}
