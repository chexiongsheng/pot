/** 玩家：第一人称移动、跳跃、蹲伏、冲刺、生命回复、落水救援、相机 */
import type { Context } from '@pot/core'
import { on, emit } from '../lib/bus'
import { clamp, damp, forward, right } from '../lib/math'
import { levelCollision } from '../lib/physics'
import { levelPoints, type LevelData } from '../lib/level'
import { sfx } from '../lib/sfx'
import { game, PLAYER, weapon, type PlayerState } from '../lib/types'

export const name = 'player'

export function apply(ctx: Context) {
  const T = ctx.data.load('tuning.json').player
  const flow = ctx.data.load('flow.json')
  const level = ctx.data.load<LevelData>('level.json')
  const points = levelPoints(level)
  const world = levelCollision(level)

  const fresh = (): PlayerState => ({
    pos: [...points.start.pos], vel: [0, 0, 0], yaw: points.start.yaw, pitch: 0,
    health: T.maxHealth, crouching: false, height: T.height, eye: T.eye, grounded: true,
    coyote: 0, jumpBuffer: 0, lastHurt: -99, hurt: 0, bob: 0, speed: 0, sprinting: false,
    lastSafe: [...points.start.pos], shake: 0,
  })
  const p = ctx.state.define<PlayerState>(PLAYER, { version: 1, init: fresh })
  const cam = ctx.scene.camera
  let lastStep = 0

  on(ctx, 'jimao/reset', () => {
    Object.assign(p, fresh())
  })

  on(ctx, 'jimao/damage-player', (amount, from) => {
    const g = game(ctx)
    if (!g || g.phase !== 'playing' || p.health <= 0) return
    p.health = Math.max(0, p.health - amount)
    p.lastHurt = ctx.clock.time
    p.hurt = Math.min(1, p.hurt + 0.35 + amount / 40)
    p.shake = Math.min(1, p.shake + amount / 25)
    ctx.audio.play(sfx('hurt'), { volume: 0.7, pitch: 0.9 + Math.random() * 0.2 })
    void from
  })

  ctx.on('update', (dt, clock) => {
    const g = game(ctx)
    if (!g) return
    const w = weapon(ctx)
    p.hurt = Math.max(0, p.hurt - dt * 1.2)
    p.shake = Math.max(0, p.shake - dt * 3)
    if (g.phase === 'title' || g.phase === 'complete') return
    const active = g.phase === 'playing' || g.phase === 'intro'
    if (active && p.health > 0) control(dt, clock, g.settings, w?.ads ?? 0)
    // 相机
    const ads = w?.ads ?? 0
    const fov = (g.settings.fov ?? T.fov) + (T.fovAds - T.fov) * ads + (p.sprinting ? T.fovSprint : 0)
    ctx.scene.view({ fov })
    const amp = Math.min(1, p.speed / T.walk) * (1 - ads * 0.8) * (p.grounded ? 1 : 0)
    const bobY = Math.abs(Math.sin(p.bob * Math.PI)) * T.bobY * amp * 2 - T.bobY * amp
    const bobX = Math.sin(p.bob * Math.PI) * T.bobX * amp
    const r = right(p.yaw)
    const sx = (Math.random() - 0.5) * p.shake * 0.06, sy = (Math.random() - 0.5) * p.shake * 0.06
    cam.position = [p.pos[0] + r[0] * bobX, p.pos[1] + p.eye + bobY, p.pos[2] + r[2] * bobX]
    cam.rotation = [p.pitch + (w?.recoilP ?? 0) + sy * 20, p.yaw + (w?.recoilY ?? 0) + sx * 20, p.shake * Math.sin(clock * 40) * 1.5]
  })

  function control(dt: number, clock: number, settings: { sensitivity: number; invertY: boolean }, ads: number) {
    const input = ctx.input
    // 视角
    if (input.cursor()) {
      const look = input.axis('look')
      const k = 2 * settings.sensitivity * (ads > 0.5 ? T.adsLook : 1)
      p.yaw = (p.yaw + look.x * k) % 360
      p.pitch = clamp(p.pitch - look.y * k * (settings.invertY ? -1 : 1), -T.pitchLimit, T.pitchLimit)
    }
    // 蹲伏
    if (input.pressed('c') || input.pressed('leftcontrol')) p.crouching = !p.crouching
    const wantCrouch = p.crouching
    const targetH = wantCrouch ? T.crouchHeight : T.height
    if (!wantCrouch && p.height < T.height - 0.01 && world.blocked(p.pos[0], p.pos[1] + 0.05, p.pos[2], T.radius - 0.02, T.height - 0.05)) {
      p.crouching = true
    } else {
      p.height = damp(p.height, targetH, 14, dt)
    }
    p.eye = damp(p.eye, p.crouching ? T.crouchEye : T.eye, T.eyeRate, dt)

    // 移动
    const move = input.axis('move')
    let mx = move.x, mz = move.y
    const ml = Math.hypot(mx, mz)
    if (ml > 1) { mx /= ml; mz /= ml }
    const wantsSprint = input.key('leftshift') && mz > 0.3 && !p.crouching && ads < 0.3
    p.sprinting = wantsSprint && p.grounded
    const speed = p.crouching ? T.crouch : ads > 0.5 ? T.ads : wantsSprint ? T.sprint : T.walk
    const f = forward(p.yaw), r = right(p.yaw)
    const tx = (f[0] * mz + r[0] * mx) * speed
    const tz = (f[2] * mz + r[2] * mx) * speed
    const accel = p.grounded ? (ml > 0.01 ? T.accelGround : T.decelGround) : T.accelAir
    const dvx = tx - p.vel[0], dvz = tz - p.vel[2]
    const dl = Math.hypot(dvx, dvz)
    const step = accel * dt
    if (dl <= step) { p.vel[0] = tx; p.vel[2] = tz } else { p.vel[0] += dvx / dl * step; p.vel[2] += dvz / dl * step }

    // 跳跃（土狼时间 + 输入缓冲）
    p.coyote = p.grounded ? T.coyote : Math.max(0, p.coyote - dt)
    p.jumpBuffer = input.pressed('space') ? T.jumpBuffer : Math.max(0, p.jumpBuffer - dt)
    if (p.jumpBuffer > 0 && p.coyote > 0 && !p.crouching) {
      p.vel[1] = Math.sqrt(2 * T.gravity * T.jumpApex)
      p.jumpBuffer = 0
      p.coyote = 0
      p.grounded = false
    }
    p.vel[1] -= T.gravity * dt
    const body = { pos: p.pos, vel: p.vel, radius: T.radius, height: p.height, grounded: p.grounded }
    const wasAir = !p.grounded
    const fall = p.vel[1]
    world.move(body, dt, T.stepUp)
    p.grounded = body.grounded
    if (p.grounded && wasAir && fall < -4) {
      ctx.audio.play(sfx('step'), { volume: 0.6, pitch: 0.8 })
      p.shake = Math.min(1, p.shake + 0.15)
    }
    if (p.grounded && p.pos[1] >= -0.01) p.lastSafe = [p.pos[0], p.pos[1], p.pos[2]]

    // 步伐与脚步声
    p.speed = Math.hypot(p.vel[0], p.vel[2])
    if (p.grounded && p.speed > 0.5) {
      const stride = p.crouching ? T.stride.crouch : p.sprinting ? T.stride.sprint : T.stride.walk
      p.bob += p.speed / stride * dt
      if (Math.floor(p.bob) !== lastStep) {
        lastStep = Math.floor(p.bob)
        ctx.audio.play(sfx('step'), { volume: p.crouching ? 0.15 : p.sprinting ? 0.5 : 0.3, pitch: 0.85 + Math.random() * 0.3 })
      }
    }

    // 落水救援（原版：低于海面 2.2 m）
    if (p.pos[1] < T.seaY - 2.2) {
      p.pos[0] = p.lastSafe[0] - 1.5
      p.pos[1] = p.lastSafe[1]
      p.pos[2] = p.lastSafe[2]
      p.vel[0] = p.vel[1] = p.vel[2] = 0
      emit(ctx, 'jimao/message', flow.rescued)
      emit(ctx, 'jimao/damage-player', T.rescueDamage, null)
    }

    // 生命回复
    if (p.health > 0 && clock - p.lastHurt > T.regenDelay && p.health < T.maxHealth) {
      p.health = Math.min(T.maxHealth, p.health + T.regenRate * dt)
    }
  }
}
