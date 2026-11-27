/**
 * 玩家：移动、相机、生命、枪的规则用 fps 套件，枪的样子用 realistic 的 viewGun；这里是阶段控制、音效、受伤反馈与落水救援。
 * 只导出定义，由 game.tsx 组装。命中判定走表现层的场景射线（敌人命中体挂在动画骨骼上），经 emitUI 回写。
 *
 * 玩家扮演的突击队员：步行 3.8 米/秒、冲刺 6.4、蹲伏 1.9，能跳 1 米高、直接迈上 0.45 米的台阶；
 * 满血 100，受伤 4 秒后开始每秒回 25；手里是 KR-7 突击步枪，30 发弹匣、备弹 150、每分钟 720 发，右键开镜。
 * 这些数值都在 tuning.json 的 player、weapon 里。
 */
import { defineBlock, type SceneArgs } from '@pot/core'
import { damage } from '@pot/kit/fps'
import { harborBoxes } from '@pot/kit/harbor/physics'
import { levelPoints, type LevelData } from './level'
import { sfx } from '@pot/kit/realistic/sfx'
import { setPostValues } from '@pot/kit/realistic'
import { ENEMY_LAYER, MAP_LAYER } from '@pot/kit/realistic/layers'
import { phaseOf, slEmit, type Settings } from './state'

/** regen：每秒回血量；fov：设置里没给视野时的缺省视野 */
const CONTROL_PROPS = { regen: 0, fov: 74 }

/**
 * 每步最先：把阶段与设置写进套件积木与 mech 的 w.vars（暂停是 flow 叠加状态，模拟整体不走）。
 * 标题画面：背景里的敌人冻结，玩家不能动，相机交给导演的巡游镜头；
 * 开场字幕：能走动、转视角，但不能开枪，敌人还不敌对；战斗中：全部放开；
 * 阵亡：不能动、不能开枪，不再回血；撤离成功：相机停住，交给结算画面
 */
const slControl = defineBlock<typeof CONTROL_PROPS>({
  name: 'slControl',
  about: 'saltline：按阶段开关移动、相机与枪，同步灵敏度、反转、视野；标题时冻结机甲，只在 playing 敌对',
  order: -1,
  props: CONTROL_PROPS,
  step(me, e, w) {
    const ph = phaseOf(w), s: Settings = w.vars.slSettings, m = e.b.moveFps, c = e.b.cameraFps, h = e.b.health, g = e.b.gunFps
    // 标题画面里敌人冻结；只有战斗中敌人才会发现玩家、开火、伤人
    w.vars.mechFrozen = ph === 'title'
    w.vars.mechHostile = ph === 'playing'
    m.active = (ph === 'playing' || ph === 'intro') && h.hp > 0
    c.active = ph !== 'title' && ph !== 'complete'
    if (g) g.active = ph === 'playing' && h.hp > 0
    // 能动的时候才回血
    h.regen = m.active ? me.regen : 0
    // 设置面板里的灵敏度、反转垂直视角、视野
    m.sensitivity = s.sensitivity
    m.invertY = s.invertY
    c.fov = s.fov ?? me.fov
  },
})

/** seaY：海面高度；rescueDamage：从海里救上来扣的血；rescued：救上来时的提示（“已从水中获救”） */
const FEEDBACK_PROPS = { seaY: -1.6, rescueDamage: 0, rescued: '' }

/** 表现侧已播过的计数与后处理参数（不进存档） */
interface Heard { steps: number; lands: number; hits: number; low: number; post: string; time: number; frame: number }
const heard = new WeakMap<object, Map<number, Heard>>()
function heardOf(w: any) {
  let m = heard.get(w)
  if (!m) heard.set(w, (m = new Map()))
  return m
}

/** 移动之后：受伤红屏衰减、落地与脚步计数、落水救援；音效在 view 里按计数变化播 */
const slFeedback = defineBlock<typeof FEEDBACK_PROPS, { hurt: number; lastStep: number; steps: number; lands: number; hits: number }>({
  name: 'slFeedback',
  about: 'saltline：落地与脚步声、受伤红屏与受伤声、落水救援；表现层写后处理的受伤红边、低血量与开镜',
  order: 1,
  props: FEEDBACK_PROPS,
  state: { hurt: 0, lastStep: 0, steps: 0, lands: 0, hits: 0 },
  step(me, e, w) {
    // 受伤红屏每秒褪去 1.2（受伤规则 hurt 往上加）
    me.hurt = Math.max(0, me.hurt - w.dt * 1.2)
    const m = e.b.moveFps, c = e.b.cameraFps
    if (!m.active) return
    // 重重落地（下落速度超过 4 米/秒，比如从集装箱顶上跳下）：记一次落地声，镜头震一下
    if (m.landed > 4) {
      me.lands++
      c.shake = Math.min(1, c.shake + 0.15)
    }
    // 走路的晃动相位每过一个整数算迈了一步，记一次脚步声；走、跑、蹲的步幅不同，脚步快慢跟着变
    const n = Math.floor(m.bob)
    if (n !== me.lastStep) {
      me.lastStep = n
      me.steps++
    }
    // 落水救援（原版：低于海面 2.2 m）：从码头边掉进海里时，拉回最后站稳的地方（往岸里挪 1.5 米），
    // 提示“已从水中获救”，战斗中还要扣 12 血
    if (e.pos[1] < me.seaY - 2.2) {
      const s = m.lastSafe
      e.pos = [s[0] - 1.5, s[1], s[2]]
      m.vel = [0, 0, 0]
      slEmit(w, 'slMessage', me.rescued)
      if (phaseOf(w) === 'playing') damage(w, e, me.rescueDamage)
    }
  },
  view: {
    enter(me, e, ctx, w) {
      heardOf(w).set(e.id, { steps: me.steps, lands: me.lands, hits: me.hits, low: 0, post: '', time: ctx.clock.time, frame: ctx.clock.frame })
    },
    update(me, e, _objs, ctx, w) {
      const h = heardOf(w).get(e.id)
      if (!h) return
      const c = ctx.clock
      const dt = h.frame === c.frame - 1 ? Math.min(0.1, Math.max(0, c.time - h.time)) : 0
      h.frame = c.frame
      h.time = c.time
      // 受伤红边、低血量去饱和与暗角、开镜边缘柔化：交给后处理链（realistic 的 setPostValues）
      const ph = phaseOf(w), hp = e.b.health
      const live = ph === 'playing' || ph === 'intro' || ph === 'paused' || ph === 'dead'
      // 血量低于 55% 开始去饱和、暗角收紧，到 12% 最重；平滑过渡，暂停时保持
      const low = live && hp ? Math.max(0, Math.min(1, (0.55 - hp.hp / hp.max) / (0.55 - 0.12))) : 0
      if (ph !== 'paused') h.low += (low * low * (3 - 2 * low) - h.low) * Math.min(1, dt * 4)
      const damageV = live ? Math.max(0, Math.min(1, me.hurt)) : 0
      const ads = live ? Math.max(0, Math.min(1, e.b.gunFps?.ads ?? 0)) : 0
      const key = [damageV, h.low, ads].map((v) => Math.round(v * 200)).join(',')
      if (key !== h.post) {
        h.post = key
        setPostValues(w, { uDamage: damageV, uLowHealth: h.low, uAds: ads })
      }
      const m = e.b.moveFps
      // 音效：落地闷响；脚步声蹲着最轻、冲刺最响，音调随机一点；受伤时一声闷哼
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

/** 受伤反馈：敌人的光弹、扑咬、飞鸥坠毁的爆炸与落水救援都走 fps 的 damaged；伤得越重红屏越浓、镜头震得越狠 */
function hurt(_w: any, ev: { entity: any; amount: number }) {
  const e = ev.entity, f = e.b.slFeedback
  if (!f) return
  f.hurt = Math.min(1, f.hurt + 0.35 + ev.amount / 40)
  f.hits++
  e.b.cameraFps.shake = Math.min(1, e.b.cameraFps.shake + ev.amount / 25)
}

/**
 * 玩家实体：出生点与朝向来自关卡，手感参数来自 tuning.json 的 player。
 * 积木分工：slControl 按阶段开关；moveFps 走跑蹲跳与碰撞（走不出码头边和围栏外的空气墙）；
 * cameraFps 第一人称相机（走路晃动、开镜收窄视野、冲刺放宽视野）；health 生命与回血；gunFps KR-7 的射击规则；
 * viewGun 手和枪的模型、换弹动作、枪口火焰、曳光与弹孔；slFeedback 脚步、受伤与落水
 */
export function Player({ data }: { data: SceneArgs['data'] }) {
  const tuning = data.load('tuning.json')
  const { fov, fovAds, fovSprint, bobX, bobY, regenDelay, regenRate, maxHealth, seaY, rescueDamage, ...move } = tuning.player
  const { name: _name, mag, reserve, spread, ...gun } = tuning.weapon
  const level = data.load<LevelData>('level.json')
  const { start } = levelPoints(level), { bounds, groundMaxX } = harborBoxes()
  return <>
    <entity key="player" tags={['player']} at={[...start.pos]} rot={[0, start.yaw, 0]}
      slControl={{ regen: regenRate, fov }} slFeedback={{ seaY, rescueDamage, rescued: data.load('flow.json').rescued }}
      moveFps={{ ...move, layers: ['default', 'playerWall'], ground: { y: 0, maxX: groundMaxX }, bounds: bounds ?? null }}
      cameraFps={{ fov, fovAds, fovSprint, bobX, bobY, lockCursor: false, near: 0.02, far: 600 }}
      health={{ max: maxHealth, regen: regenRate, regenDelay }}
      gunFps={{ ...gun, magSize: mag, reserveStart: reserve, spreadHip: spread, hitscan: 'view', viewMask: (1 << MAP_LAYER) | (1 << ENEMY_LAYER), viewPlanes: GROUND_PLANES }}
      viewGun />
    <rule on="damaged" do={hurt} />
  </>
}

/**
 * 子弹射线除碰撞体外还与地面 y=0（x≤30）、码头外的海面 y=-1.6（记为水面）求交（原版 physics.raycast）：
 * 打在码头地面上留弹孔，打进海里溅水花
 */
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
