/** 玩家：移动、相机、生命用 fps 套件；这里是阶段控制、音效、受伤反馈与落水救援 */
import { defineBlock, defineGame, type Context } from '@pot/core'
import fps, { damage } from '@pot/kit/fps'
import { on, emit } from '../lib/bus'
import { levelBoxes } from '../lib/physics'
import { levelPoints, type LevelData } from '../lib/level'
import { sfx } from '../lib/sfx'
import { game, playerEntity, weapon } from '../lib/types'

export const name = 'player'

/** 积木的 step 拿不到单元的 ctx：apply 时记下 */
let host: Context
let T: any

/** 每步最先：把游戏阶段、设置、瞄准程度写进套件积木 */
const slControl = defineBlock({
  name: 'slControl',
  about: 'saltline：按游戏阶段开关移动与相机，同步灵敏度、瞄准、fov',
  order: -1,
  step(_me, e) {
    const g = game(host), m = e.b.moveFps, c = e.b.cameraFps, h = e.b.health
    if (!g) { m.active = c.active = false; h.regen = 0; return }
    m.active = (g.phase === 'playing' || g.phase === 'intro') && h.hp > 0
    c.active = g.phase !== 'title' && g.phase !== 'complete'
    h.regen = m.active ? T.regenRate : 0
    m.aim = weapon(host)?.ads ?? 0
    m.sensitivity = host.input.cursor() ? g.settings.sensitivity : 0 // 没锁定鼠标时不转视角
    m.invertY = g.settings.invertY
    c.fov = g.settings.fov ?? T.fov
  },
})

/** 移动之后：受伤红屏衰减、落地与脚步声、落水救援 */
const slFeedback = defineBlock({
  name: 'slFeedback',
  about: 'saltline：落地与脚步声、受伤红屏、落水救援',
  order: 1,
  state: { hurt: 0, lastStep: 0 },
  step(me, e, w) {
    me.hurt = Math.max(0, me.hurt - w.dt * 1.2)
    const m = e.b.moveFps, c = e.b.cameraFps
    if (!m.active) return
    if (m.landed > 4) {
      host.audio.play(sfx('step'), { volume: 0.6, pitch: 0.8 })
      c.shake = Math.min(1, c.shake + 0.15)
    }
    const n = Math.floor(m.bob)
    if (n !== me.lastStep) {
      me.lastStep = n
      host.audio.play(sfx('step'), { volume: m.crouched ? 0.15 : m.sprinting ? 0.5 : 0.3, pitch: 0.85 + Math.random() * 0.3 })
    }
    // 落水救援（原版：低于海面 2.2 m）
    if (e.pos[1] < T.seaY - 2.2) {
      const s = m.lastSafe
      e.pos = [s[0] - 1.5, s[1], s[2]]
      m.vel = [0, 0, 0]
      emit(host, 'saltline/message', host.data.load('flow.json').rescued)
      emit(host, 'saltline/damage-player', T.rescueDamage, null)
    }
  },
})

const unit = defineGame({
  kits: [fps],
  blocks: [slControl, slFeedback],
  scene: ({ data }) => {
    const { fov, fovAds, fovSprint, bobX, bobY, regenDelay, regenRate, maxHealth, seaY, rescueDamage, ...move } = data.load('tuning.json').player
    const level = data.load<LevelData>('level.json')
    const { start } = levelPoints(level), { bounds, groundMaxX } = levelBoxes(level)
    return <entity key="player" tags={['player']} at={[...start.pos]} rot={[0, start.yaw, 0]} slControl slFeedback
      moveFps={{ ...move, layers: ['default', 'playerWall'], ground: { y: 0, maxX: groundMaxX }, bounds: bounds ?? null }}
      cameraFps={{ fov, fovAds, fovSprint, bobX, bobY, lockCursor: false }}
      health={{ max: maxHealth, regen: regenRate, regenDelay }} />
  },
})

export function apply(ctx: Context) {
  host = ctx
  T = ctx.data.load('tuning.json').player
  unit.apply(ctx)
  const start = levelPoints(ctx.data.load<LevelData>('level.json')).start

  on(ctx, 'saltline/reset', () => {
    const e = playerEntity(ctx)
    if (!e) return
    e.pos = [...start.pos]
    e.rot = [0, start.yaw, 0]
    Object.assign(e.b.moveFps, {
      vel: [0, 0, 0], yaw: start.yaw, pitch: 0, grounded: true, crouched: false, coyoteT: 0, buffer: 0, lastSafe: [...start.pos],
      curHeight: T.height, curEye: T.eye, bob: 0, speed: 0, sprinting: false, landed: 0,
    })
    Object.assign(e.b.health, { hp: T.maxHealth, lastHit: -1e9 })
    Object.assign(e.b.cameraFps, { shake: 0, kick: [0, 0] })
    Object.assign(e.b.slFeedback, { hurt: 0, lastStep: 0 })
  })

  on(ctx, 'saltline/damage-player', (amount) => {
    const e = playerEntity(ctx)
    if (game(ctx)?.phase !== 'playing' || !damage(ctx.world, e, amount)) return
    e.b.slFeedback.hurt = Math.min(1, e.b.slFeedback.hurt + 0.35 + amount / 40)
    e.b.cameraFps.shake = Math.min(1, e.b.cameraFps.shake + amount / 25)
    ctx.audio.play(sfx('hurt'), { volume: 0.7, pitch: 0.9 + Math.random() * 0.2 })
  })

  ctx.on('update', () => {
    const e = playerEntity(ctx), w = weapon(ctx)
    if (e) e.b.cameraFps.kick = [w?.recoilP ?? 0, w?.recoilY ?? 0]
  })
}

declare module '@pot/core' {
  interface GameBlockProps {
    slControl?: boolean
    slFeedback?: boolean
  }
}
