/**
 * viewFeedback（004 第 19.5 节第 16 步）：第一人称反馈的写实样子，配 fps 的 feedbackFps。
 * feedbackFps 在规则侧只计数（迈步、重落地、受伤）并给出红屏程度；这里按计数变化放脚步、落地、受伤的声音，
 * 把受伤红边、低血量（去饱和、暗角收紧）、开镜边缘柔化写进 atmosphere 的后处理链（setPostValues）。
 * 来自 saltline 的 slFeedback 的表现部分。
 */
import { defineBlock } from '@pot/core'
import { setPostValues } from './post'
import { sfx } from './sfx'

const PROPS = {
  /** 血量比例低于 lowFrom 开始显示低血量，到 lowTo 最重 */
  lowFrom: 0.55,
  lowTo: 0.12,
  /** 低血量过渡速度（每秒趋近比例） */
  lowRate: 4,
}

export type ViewFeedbackProps = typeof PROPS

/** 表现侧已播过的计数与后处理参数（不进存档） */
interface Heard { steps: number; lands: number; hits: number; low: number; post: string; time: number; frame: number }
const heard = new WeakMap<object, Map<number, Heard>>()
function heardOf(w: { registry: object }) {
  let m = heard.get(w.registry)
  if (!m) heard.set(w.registry, (m = new Map()))
  return m
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v))

export const viewFeedback = defineBlock({
  name: 'viewFeedback',
  about: '第一人称反馈（写实样子，只有表现）：读同一实体的 feedbackFps 计数放脚步（蹲轻、冲刺响）、落地、受伤声；第一人称相机在用（cameraFps.active）时，把受伤红边（feedbackFps.hurt）、低血量（health 低于 lowFrom 起、到 lowTo 最重，平滑过渡，叠加状态如暂停时保持）、开镜（gunFps.ads）写进 atmosphere 的后处理链',
  props: PROPS,
  view: {
    enter(_me, e, ctx, w) {
      const f = e.b.feedbackFps
      heardOf(w).set(e.id, { steps: f?.steps ?? 0, lands: f?.lands ?? 0, hits: f?.hits ?? 0, low: 0, post: '', time: ctx.clock.time, frame: ctx.clock.frame })
    },
    update(me, e, _objs, ctx, w) {
      const h = heardOf(w).get(e.id)
      const f = e.b.feedbackFps
      if (!h || !f) return
      const c = ctx.clock
      const dt = h.frame === c.frame - 1 ? Math.min(0.1, Math.max(0, c.time - h.time)) : 0
      h.frame = c.frame
      h.time = c.time
      // 后处理：第一人称相机关着（标题巡游、结算镜头）时全部归零
      const live = !!e.b.cameraFps?.active, hp = e.b.health
      const low = live && hp ? clamp01((me.lowFrom - hp.hp / hp.max) / (me.lowFrom - me.lowTo)) : 0
      if (!w.overlayActive) h.low += (low * low * (3 - 2 * low) - h.low) * Math.min(1, dt * me.lowRate)
      const damage = live ? clamp01(f.hurt) : 0
      const ads = live ? clamp01(e.b.gunFps?.ads ?? 0) : 0
      const key = [damage, h.low, ads].map((v) => Math.round(v * 200)).join(',')
      if (key !== h.post) {
        h.post = key
        setPostValues(w, { uDamage: damage, uLowHealth: h.low, uAds: ads })
      }
      // 音效：落地闷响；脚步声蹲着最轻、冲刺最响，音调随机一点；受伤时一声闷哼
      const m = e.b.moveFps
      if (f.lands !== h.lands) ctx.audio.play(sfx('step'), { volume: 0.6, pitch: 0.8 })
      if (f.steps !== h.steps) ctx.audio.play(sfx('step'), { volume: m?.crouched ? 0.15 : m?.sprinting ? 0.5 : 0.3, pitch: 0.85 + Math.random() * 0.3 })
      if (f.hits !== h.hits) ctx.audio.play(sfx('hurt'), { volume: 0.7, pitch: 0.9 + Math.random() * 0.2 })
      h.steps = f.steps
      h.lands = f.lands
      h.hits = f.hits
    },
    exit(_me, e, _objs, _ctx, w) {
      heard.get(w.registry)?.delete(e.id)
    },
  },
})
