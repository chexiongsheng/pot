/**
 * 玩家：移动、相机、生命、枪的规则用 fps 套件，枪的样子用 realistic 的 viewGun；这里是阶段控制、音效、受伤反馈与落水救援。
 * 只导出定义，由 game.tsx 组装。命中判定走表现层的场景射线（敌人命中体挂在动画骨骼上），经 emitUI 回写。
 */
import { defineBlock, type SceneArgs } from '@pot/core'
import { damage } from '@pot/kit/fps'
import { levelBoxes } from '@pot/kit/harbor/physics'
import { levelPoints, type LevelData } from '@pot/kit/harbor/level'
import { sfx } from '@pot/kit/realistic/sfx'
import { ENEMY_LAYER, LEVEL_LAYER } from '@pot/kit/realistic/layers'
import { phaseOf, slEmit, type Settings } from './state'

const CONTROL_PROPS = { regen: 0, fov: 74 }

/** 每步最先：把阶段与设置写进套件积木与 mech 的 w.vars（暂停是 flow 叠加状态，模拟整体不走） */
const slControl = defineBlock<typeof CONTROL_PROPS>({
  name: 'slControl',
  about: 'saltline：按阶段开关移动、相机与枪，同步灵敏度、反转、视野；标题时冻结机甲，只在 playing 敌对',
  order: -1,
  props: CONTROL_PROPS,
  step(me, e, w) {
    const ph = phaseOf(w), s: Settings = w.vars.slSettings, m = e.b.moveFps, c = e.b.cameraFps, h = e.b.health, g = e.b.gunFps
    w.vars.mechFrozen = ph === 'title'
    w.vars.mechHostile = ph === 'playing'
    m.active = (ph === 'playing' || ph === 'intro') && h.hp > 0
    c.active = ph !== 'title' && ph !== 'complete'
    if (g) g.active = ph === 'playing' && h.hp > 0
    h.regen = m.active ? me.regen : 0
    m.sensitivity = s.sensitivity
    m.invertY = s.invertY
    c.fov = s.fov ?? me.fov
  },
})

const FEEDBACK_PROPS = { seaY: -1.6, rescueDamage: 0, rescued: '' }

/** 表现侧已播过的计数（不进存档） */
const heard = new WeakMap<object, Map<number, { steps: number; lands: number; hits: number }>>()
function heardOf(w: any) {
  let m = heard.get(w)
  if (!m) heard.set(w, (m = new Map()))
  return m
}

/** 移动之后：受伤红屏衰减、落地与脚步计数、落水救援；音效在 view 里按计数变化播 */
const slFeedback = defineBlock<typeof FEEDBACK_PROPS, { hurt: number; lastStep: number; steps: number; lands: number; hits: number }>({
  name: 'slFeedback',
  about: 'saltline：落地与脚步声、受伤红屏与受伤声、落水救援',
  order: 1,
  props: FEEDBACK_PROPS,
  state: { hurt: 0, lastStep: 0, steps: 0, lands: 0, hits: 0 },
  step(me, e, w) {
    me.hurt = Math.max(0, me.hurt - w.dt * 1.2)
    const m = e.b.moveFps, c = e.b.cameraFps
    if (!m.active) return
    if (m.landed > 4) {
      me.lands++
      c.shake = Math.min(1, c.shake + 0.15)
    }
    const n = Math.floor(m.bob)
    if (n !== me.lastStep) {
      me.lastStep = n
      me.steps++
    }
    // 落水救援（原版：低于海面 2.2 m）
    if (e.pos[1] < me.seaY - 2.2) {
      const s = m.lastSafe
      e.pos = [s[0] - 1.5, s[1], s[2]]
      m.vel = [0, 0, 0]
      slEmit(w, 'slMessage', me.rescued)
      if (phaseOf(w) === 'playing') damage(w, e, me.rescueDamage)
    }
  },
  view: {
    enter(me, e, _ctx, w) {
      heardOf(w).set(e.id, { steps: me.steps, lands: me.lands, hits: me.hits })
    },
    update(me, e, _objs, ctx, w) {
      const h = heardOf(w).get(e.id)
      if (!h) return
      const m = e.b.moveFps
      if (me.lands !== h.lands) ctx.audio.play(sfx('step'), { volume: 0.6, pitch: 0.8 })
      if (me.steps !== h.steps) ctx.audio.play(sfx('step'), { volume: m.crouched ? 0.15 : m.sprinting ? 0.5 : 0.3, pitch: 0.85 + Math.random() * 0.3 })
      if (me.hits !== h.hits) ctx.audio.play(sfx('hurt'), { volume: 0.7, pitch: 0.9 + Math.random() * 0.2 })
      h.steps = me.steps
      h.lands = me.lands
      h.hits = me.hits
    },
    exit(_me, e, _objs, _ctx, w) {
      heard.get(w)?.delete(e.id)
    },
  },
})

export const playerBlocks = [slControl, slFeedback]

/** 受伤反馈：敌人与落水救援都走 fps 的 damaged */
function hurt(_w: any, ev: { entity: any; amount: number }) {
  const e = ev.entity, f = e.b.slFeedback
  if (!f) return
  f.hurt = Math.min(1, f.hurt + 0.35 + ev.amount / 40)
  f.hits++
  e.b.cameraFps.shake = Math.min(1, e.b.cameraFps.shake + ev.amount / 25)
}

/** 玩家实体：出生点与朝向来自关卡，手感参数来自 tuning.json 的 player */
export function Player({ data }: { data: SceneArgs['data'] }) {
  const tuning = data.load('tuning.json')
  const { fov, fovAds, fovSprint, bobX, bobY, regenDelay, regenRate, maxHealth, seaY, rescueDamage, ...move } = tuning.player
  const { name: _name, mag, reserve, spread, ...gun } = tuning.weapon
  const level = data.load<LevelData>('level.json')
  const { start } = levelPoints(level), { bounds, groundMaxX } = levelBoxes(level)
  return <>
    <entity key="player" tags={['player']} at={[...start.pos]} rot={[0, start.yaw, 0]}
      slControl={{ regen: regenRate, fov }} slFeedback={{ seaY, rescueDamage, rescued: data.load('flow.json').rescued }}
      moveFps={{ ...move, layers: ['default', 'playerWall'], ground: { y: 0, maxX: groundMaxX }, bounds: bounds ?? null }}
      cameraFps={{ fov, fovAds, fovSprint, bobX, bobY, lockCursor: false }}
      health={{ max: maxHealth, regen: regenRate, regenDelay }}
      gunFps={{ ...gun, magSize: mag, reserveStart: reserve, spreadHip: spread, hitscan: 'view', viewMask: (1 << LEVEL_LAYER) | (1 << ENEMY_LAYER), viewPlanes: GROUND_PLANES }}
      viewGun />
    <rule on="damaged" do={hurt} />
  </>
}

/** 子弹射线除碰撞体外还与地面 y=0（x≤30）、码头外的海面 y=-1.6（记为水面）求交（原版 physics.raycast） */
const GROUND_PLANES = [
  { y: 0, region: { maxX: 30 }, tag: 'ground' },
  { y: -1.6, region: { minX: 30 }, tag: 'water' },
]

declare module '@pot/core' {
  interface GameBlockProps {
    slControl?: Partial<typeof CONTROL_PROPS> | boolean
    slFeedback?: Partial<typeof FEEDBACK_PROPS> | boolean
  }
}
