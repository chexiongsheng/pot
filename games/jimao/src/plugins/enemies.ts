/** 敌人：机械飞鸥（空中）与机械猎犬（地面）的 AI、弹道、攻击许可与死亡爆炸 */
import type { Context, Entity, Vec3 } from '@pot/core'
import { emit, on } from '../lib/bus'
import { LEVEL_LAYER, type LevelData } from '../lib/level'
import { angleDelta, clamp, dist, dist2d, jitter, lerp, norm, segmentDistance, sub, yawOf } from '../lib/math'
import { buildEnemy, type EnemyModel } from '../lib/models'
import { levelCollision } from '../lib/physics'
import { sfx } from '../lib/sfx'
import { chestOf, ENEMIES, eyeOf, game, player, type EnemyType } from '../lib/types'

export const name = 'enemies'

export interface Enemy {
  id: number
  type: EnemyType
  pos: Vec3
  vel: Vec3
  yaw: number
  hp: number
  mode: 'patrol' | 'combat' | 'search' | 'dying'
  home: Vec3
  goal: Vec3
  goalT: number
  lastKnown: Vec3
  lost: number
  searchT: number
  seeing: boolean
  losT: number
  attack: 'idle' | 'telegraph' | 'burst'
  attackT: number
  shots: number
  cooldown: number
  token: boolean
  orbit: number
  alt: number
  lunge: number
  lungeCd: number
  detour: number
  detourT: number
  dyingT: number
  grounded: boolean
  anim: number
  flash: number
}

interface Bolt { pos: Vec3; vel: Vec3; life: number; damage: number; type: EnemyType }

interface EnemiesState { list: Enemy[]; nextId: number; bolts: Bolt[]; tokenGap: number; booms: { pos: Vec3; t: number }[] }

export function apply(ctx: Context) {
  const tuning = ctx.data.load('tuning.json')
  const E = tuning.enemy
  const level = ctx.data.load<LevelData>('level.json')
  const world = levelCollision(level)
  const s = ctx.state.define<EnemiesState>(ENEMIES, { version: 1, init: () => ({ list: [], nextId: 1, bolts: [], tokenGap: 0, booms: [] }) })
  const { scene } = ctx
  const rand = Math.random
  const models = new Map<number, EnemyModel>()
  const partOwner = new Map<number, { id: number; weak: boolean }>()

  // ---- 弹道与爆炸特效池 ----
  const boltPool: Entity[] = []
  for (let i = 0; i < 32; i++) boltPool.push(scene.spawn({ shape: 'capsule', name: 'bolt', scale: [0.09, 0.32, 0.09], color: '#ff6a40', material: { mode: 'additive', shadows: false }, collider: false, active: false }))
  const boomPool: { e: Entity; l: Entity }[] = []
  for (let i = 0; i < 4; i++) {
    const e = scene.spawn({ shape: 'sphere', name: 'boom', color: '#ffb347', material: { mode: 'additive', shadows: false }, collider: false, active: false })
    const l = scene.light({ type: 'point', name: 'boom-light', parent: e, intensity: 0, range: 12, color: '#ff9a40' })
    boomPool.push({ e, l })
  }

  function model(e: Enemy) {
    let m = models.get(e.id)
    if (!m) {
      m = buildEnemy(ctx, e.type, `${e.type}-${e.id}`)
      models.set(e.id, m)
      for (const [part, weak] of m.parts) partOwner.set(part, { id: e.id, weak })
    }
    return m
  }

  function remove(e: Enemy) {
    const m = models.get(e.id)
    if (m) {
      for (const part of m.parts.keys()) partOwner.delete(part)
      m.root.destroy()
      models.delete(e.id)
    }
    const i = s.list.indexOf(e)
    if (i >= 0) s.list.splice(i, 1)
  }

  for (const e of s.list) model(e)

  on(ctx, 'jimao/spawn', (type, pos, pursuit) => {
    const T = tuning[type]
    const p = player(ctx)
    const e: Enemy = {
      id: s.nextId++, type, pos: [...pos], vel: [0, 0, 0], yaw: rand() * 360, hp: T.hp,
      mode: pursuit ? 'search' : 'patrol', home: [...pos], goal: [...pos], goalT: 0,
      lastKnown: p ? [...p.pos] : [...pos], lost: 0, searchT: E.searchTime * 2, seeing: false, losT: rand() * 0.2,
      attack: 'idle', attackT: 0, shots: 0, cooldown: lerp(T.cooldown[0], T.cooldown[1], rand()), token: false,
      orbit: rand() < 0.5 ? -1 : 1, alt: lerp(T.altMin ?? 0, T.altMax ?? 0, rand()), lunge: 0, lungeCd: 0,
      detour: 0, detourT: 0, dyingT: 0, grounded: true, anim: rand() * 10, flash: 0,
    }
    s.list.push(e)
    model(e)
    sync(e)
  })

  on(ctx, 'jimao/clear-enemies', () => {
    for (const e of [...s.list]) remove(e)
    s.bolts.length = 0
    s.booms.length = 0
    s.tokenGap = 0
  })

  on(ctx, 'jimao/shot', (pos) => {
    for (const e of s.list) {
      if (e.mode === 'dying' || e.mode === 'combat') continue
      if (dist(e.pos, pos) < E.hearRadius) {
        e.mode = 'search'
        e.lastKnown = [...pos]
        e.searchT = E.searchTime
      }
    }
  })

  on(ctx, 'jimao/bullet', (hit) => {
    const owner = partOwner.get(hit.id)
    if (!owner) return
    const e = s.list.find((x) => x.id === owner.id)
    if (!e || e.mode === 'dying') return
    hit.enemy = true
    hit.weak = owner.weak
    e.hp -= hit.damage * (owner.weak ? tuning.weapon.weakMultiplier : 1)
    e.flash = 0.08
    const p = player(ctx)
    if (p && e.mode !== 'combat') enterCombat(e, p.pos)
    if (e.hp <= 0) {
      hit.killed = true
      die(e, owner.weak)
    }
  })

  function enterCombat(e: Enemy, at: Vec3) {
    const was = e.mode
    e.mode = 'combat'
    e.lastKnown = [...at]
    e.lost = 0
    if (was === 'patrol' || was === 'search') emit(ctx, 'jimao/alert', [...e.pos])
  }

  function releaseToken(e: Enemy) {
    if (e.token) {
      e.token = false
      s.tokenGap = E.tokenGap
    }
  }

  function die(e: Enemy, weak: boolean) {
    releaseToken(e)
    e.mode = 'dying'
    e.dyingT = 0
    e.attack = 'idle'
    if (e.type === 'gull') {
      e.vel = [e.vel[0] * 0.5 + (rand() - 0.5) * 2, 1.5, e.vel[2] * 0.5 + (rand() - 0.5) * 2]
    }
    emit(ctx, 'jimao/kill', e.type, weak, [...e.pos])
  }

  function explode(pos: Vec3, damage: number, radius: number) {
    s.booms.push({ pos: [...pos], t: 0 })
    ctx.audio.play(sfx('explode'), { volume: 0.9, position: pos })
    const p = player(ctx)
    if (!p || damage <= 0) return
    const d = dist(chestOf(p), pos)
    if (d < radius) emit(ctx, 'jimao/damage-player', Math.round(damage * (1 - (d / radius) * 0.5)), pos)
    if (d < radius * 4) p.shake = Math.min(1, p.shake + (1 - d / (radius * 4)) * 0.6)
  }

  function fireBolt(e: Enemy, m: EnemyModel, target: Vec3) {
    const T = tuning[e.type]
    const yawR = e.yaw * Math.PI / 180
    const [mx, my, mz] = m.muzzle
    const origin: Vec3 = [e.pos[0] + Math.sin(yawR) * mz + Math.cos(yawR) * mx, e.pos[1] + my, e.pos[2] + Math.cos(yawR) * mz - Math.sin(yawR) * mx]
    const d = dist(origin, target)
    const spread = lerp(T.spreadNear, T.spreadFar, clamp(d / T.fireRange, 0, 1))
    const dir = jitter(norm(sub(target, origin)), spread, rand)
    const speed = e.type === 'gull' ? T.boltSpeed : T.shotSpeed
    s.bolts.push({ pos: origin, vel: [dir[0] * speed, dir[1] * speed, dir[2] * speed], life: 1.6, damage: e.type === 'gull' ? T.boltDamage : T.shotDamage, type: e.type })
    ctx.audio.play(sfx(e.type === 'gull' ? 'bolt' : 'houndShot'), { volume: 0.6, position: origin, pitch: 0.9 + rand() * 0.2 })
  }

  function canSee(e: Enemy, eye: Vec3, d: number) {
    if (d > E.sightRange) return false
    if (e.mode !== 'combat') {
      const off = Math.abs(angleDelta(e.yaw, yawOf(sub(eye, e.pos))))
      if (off > E.sightCone / 2) return false
    }
    const from: Vec3 = e.type === 'gull' ? e.pos : [e.pos[0], e.pos[1] + 1.1, e.pos[2]]
    const hit = scene.raycast(from, sub(eye, from), { maxDistance: d, mask: 1 << LEVEL_LAYER })
    return !hit || hit.distance > d - 0.4
  }

  function steer(e: Enemy, target: Vec3, maxSpeed: number, accel: number, dt: number, flying: boolean) {
    const dx = target[0] - e.pos[0], dy = flying ? target[1] - e.pos[1] : 0, dz = target[2] - e.pos[2]
    const l = Math.hypot(dx, dy, dz)
    const sp = Math.min(maxSpeed, l * 1.5)
    let tx = l > 0.01 ? dx / l * sp : 0, tz = l > 0.01 ? dz / l * sp : 0
    const ty = l > 0.01 ? dy / l * sp : 0
    if (e.detourT > 0) {
      const a = e.detour * Math.PI / 180, c = Math.cos(a), sn = Math.sin(a)
      ;[tx, tz] = [tx * c + tz * sn, -tx * sn + tz * c]
    }
    const k = Math.min(1, accel * dt / Math.max(0.001, maxSpeed))
    e.vel[0] += (tx - e.vel[0]) * k
    e.vel[2] += (tz - e.vel[2]) * k
    if (flying) e.vel[1] += (ty - e.vel[1]) * k
  }

  function sync(e: Enemy) {
    const m = model(e)
    m.root.position = e.pos
    m.root.rotation = [e.type === 'gull' ? clamp(e.vel[1] * -4, -20, 20) : 0, e.yaw, e.mode === 'dying' ? Math.min(80, e.dyingT * 160) * (e.type === 'hound' ? 1 : 3) : 0]
  }

  ctx.on('update', (dt) => {
    const g = game(ctx)
    const p = player(ctx)
    if (!g || !p) return
    if (g.phase === 'paused' || g.phase === 'title') return
    const fighting = g.phase === 'playing'
    const eye = eyeOf(p), chest = chestOf(p)
    s.tokenGap = Math.max(0, s.tokenGap - dt)
    const alive = s.list.filter((e) => e.mode !== 'dying').length
    const maxTokens = alive >= 6 ? E.maxTokensCrowd : E.maxTokens
    let tokens = s.list.filter((e) => e.token).length

    for (const e of [...s.list]) {
      const T = tuning[e.type]
      const m = model(e)
      e.anim += dt
      e.flash = Math.max(0, e.flash - dt)

      if (e.mode === 'dying') {
        e.dyingT += dt
        if (e.type === 'gull') {
          e.vel[1] -= 18 * dt
          e.pos[0] += e.vel[0] * dt; e.pos[1] += e.vel[1] * dt; e.pos[2] += e.vel[2] * dt
          e.yaw += dt * 500
          const floor = world.support(e.pos[0], e.pos[1], e.pos[2], 0.3, 0.5, 0.5) ?? (world.floor(e.pos[0]) === null ? -1.2 : null)
          if ((floor !== null && e.pos[1] <= floor + 0.3) || e.dyingT > 4) {
            explode(e.pos, fighting ? T.explodeDamage : 0, T.explodeRadius)
            remove(e)
            continue
          }
        } else if (e.dyingT > 1.6) {
          explode([e.pos[0], e.pos[1] + 0.8, e.pos[2]], 0, 0)
          remove(e)
          continue
        }
        sync(e)
        continue
      }

      // 感知
      const d = dist(e.type === 'gull' ? e.pos : [e.pos[0], e.pos[1] + 1.1, e.pos[2]], eye)
      e.losT -= dt
      if (e.losT <= 0) {
        e.losT = 0.18 + rand() * 0.08
        e.seeing = fighting && p.health > 0 && canSee(e, eye, d)
      }
      if (e.seeing) {
        if (e.mode !== 'combat') enterCombat(e, p.pos)
        e.lastKnown = [...p.pos]
        e.lost = 0
      } else if (e.mode === 'combat') {
        e.lost += dt
        if (e.lost > E.loseSight) { e.mode = 'search'; e.searchT = E.searchTime }
      }
      if (e.mode === 'search') {
        e.searchT -= dt
        if (e.searchT <= 0) { e.mode = 'patrol'; e.home = [...e.pos] }
      }

      // 攻击循环
      const inRange = e.mode === 'combat' && e.seeing && d < T.fireRange
      if (e.attack === 'idle') {
        e.cooldown -= dt
        if (inRange && e.cooldown <= 0 && !e.token && tokens < maxTokens && s.tokenGap <= 0) {
          e.token = true
          tokens++
          s.tokenGap = E.tokenGap * 0.5
          e.attack = 'telegraph'
          e.attackT = T.telegraph
          ctx.audio.play(sfx('telegraph'), { volume: 0.5, position: e.pos, pitch: e.type === 'gull' ? 1.2 : 0.8 })
        }
      } else if (e.attack === 'telegraph') {
        e.attackT -= dt
        if (!inRange) {
          e.attack = 'idle'
          e.cooldown = 0.6
          releaseToken(e)
        } else if (e.attackT <= 0) {
          e.attack = 'burst'
          e.shots = T.burst
          e.attackT = 0
        }
      } else {
        e.attackT -= dt
        if (e.attackT <= 0 && e.shots > 0) {
          fireBolt(e, m, chest)
          e.shots--
          e.attackT = T.burstGap
        }
        if (e.shots <= 0) {
          e.attack = 'idle'
          e.cooldown = lerp(T.cooldown[0], T.cooldown[1], rand())
          releaseToken(e)
        }
      }

      // 移动
      e.detourT = Math.max(0, e.detourT - dt)
      e.goalT -= dt
      const toP = sub(p.pos, e.pos)
      const hd = Math.hypot(toP[0], toP[2]) || 1
      if (e.type === 'gull') {
        let target: Vec3
        let speed = T.maxSpeed
        if (e.mode === 'combat') {
          const want = clamp(hd, T.rangeMin, T.rangeMax)
          const ang = Math.atan2(-toP[0], -toP[2]) + e.orbit * 0.35
          target = [p.pos[0] + Math.sin(ang) * want, p.pos[1] + e.alt, p.pos[2] + Math.cos(ang) * want]
          if (e.goalT <= 0) { e.goalT = 2 + rand() * 2; if (rand() < 0.35) e.orbit *= -1 }
          if (e.attack !== 'idle') speed *= 0.35
        } else if (e.mode === 'search') {
          target = [e.lastKnown[0], e.lastKnown[1] + e.alt, e.lastKnown[2]]
          speed = T.maxSpeed * 0.7
        } else {
          const a = e.anim * 0.35 * e.orbit
          target = [e.home[0] + Math.sin(a) * 8, Math.max(e.home[1], T.altMin + 2), e.home[2] + Math.cos(a) * 8]
          speed = T.patrolSpeed
        }
        steer(e, target, speed, T.accel, dt, true)
        e.pos[0] += e.vel[0] * dt; e.pos[1] += e.vel[1] * dt; e.pos[2] += e.vel[2] * dt
        if (world.blocked(e.pos[0], e.pos[1] - 0.3, e.pos[2], 0.5, 0.6)) { e.pos[1] += 4 * dt; e.vel[1] = Math.max(e.vel[1], 2) }
        if (e.pos[1] < 2.2) { e.pos[1] = 2.2; e.vel[1] = Math.max(0, e.vel[1]) }
        const face = e.mode === 'combat' ? yawOf(toP) : Math.hypot(e.vel[0], e.vel[2]) > 0.3 ? yawOf(e.vel) : e.yaw
        e.yaw += angleDelta(e.yaw, face) * Math.min(1, dt * 5)
        const flap = Math.sin(e.anim * (e.attack === 'idle' ? 9 : 16)) * 28
        m.wings[0].localRotation = [0, 0, -flap]
        m.wings[1].localRotation = [0, 0, flap]
      } else {
        let target: Vec3 = e.goal
        let speed = T.patrolSpeed
        if (e.mode === 'combat') {
          if (hd > T.rangeMax || !e.seeing) { target = e.lastKnown; speed = T.runSpeed }
          else if (hd < T.rangeMin) { target = [e.pos[0] - toP[0] / hd * 3, 0, e.pos[2] - toP[2] / hd * 3]; speed = T.stalkSpeed }
          else {
            const sx = -toP[2] / hd * e.orbit, sz = toP[0] / hd * e.orbit
            target = [e.pos[0] + sx * 3, 0, e.pos[2] + sz * 3]
            speed = T.stalkSpeed
            if (e.goalT <= 0) { e.goalT = 1.5 + rand() * 2; if (rand() < 0.5) e.orbit *= -1 }
          }
          // 扑击
          e.lungeCd = Math.max(0, e.lungeCd - dt)
          if (hd < T.lungeRange && e.lungeCd <= 0 && e.lunge <= 0) {
            e.lunge = 0.35
            e.lungeCd = T.lungeCooldown
            e.vel[0] = toP[0] / hd * T.lungeSpeed
            e.vel[2] = toP[2] / hd * T.lungeSpeed
            e.vel[1] = 3
          }
        } else if (e.mode === 'search') {
          target = e.lastKnown
          speed = T.runSpeed * 0.7
        } else if (e.goalT <= 0 || dist2d(e.pos, e.goal) < 1) {
          e.goalT = 4 + rand() * 4
          const a = rand() * Math.PI * 2, r = 2 + rand() * 7
          e.goal = [e.home[0] + Math.cos(a) * r, 0, e.home[2] + Math.sin(a) * r]
        }
        if (e.lunge > 0) {
          e.lunge -= dt
          if (dist2d(e.pos, p.pos) < 1.2 && Math.abs(e.pos[1] - p.pos[1]) < 1.5) {
            e.lunge = 0
            emit(ctx, 'jimao/damage-player', T.lungeDamage, [...e.pos])
            e.vel[0] *= -0.3; e.vel[2] *= -0.3
          }
        } else {
          steer(e, target, speed, T.accel, dt, false)
        }
        e.vel[1] -= 21 * dt
        const res = world.move({ pos: e.pos, vel: e.vel, radius: 0.45, height: 1.3, get grounded() { return e.grounded }, set grounded(v) { e.grounded = v } }, dt, 0.5)
        if (res.wall && e.detourT <= 0) { e.detour = (rand() < 0.5 ? -1 : 1) * 75; e.detourT = 0.9 }
        if (e.pos[1] < -3) { e.pos = [...e.home]; e.vel = [0, 0, 0] }
        const moving = Math.hypot(e.vel[0], e.vel[2])
        const face = e.mode === 'combat' && e.seeing ? yawOf(toP) : moving > 0.3 ? yawOf(e.vel) : e.yaw
        e.yaw += clamp(angleDelta(e.yaw, face), -T.turnRate * 57.3 * dt * 3, T.turnRate * 57.3 * dt * 3)
        const gait = Math.sin(e.anim * (4 + moving * 2.2)) * Math.min(1, moving / 2) * 35
        m.legs.forEach((leg, i) => (leg.localRotation = [(i === 0 || i === 3 ? gait : -gait), 0, 0]))
      }

      // 预警发光
      const tele = e.attack === 'telegraph' ? 0.5 + 0.5 * Math.sin(e.anim * 40) : e.attack === 'burst' ? 1 : 0
      m.glow.color(e.flash > 0 ? '#ffffff' : tele > 0 ? '#ffd27a' : e.mode === 'combat' ? '#ff5a40' : '#ff9a70')
      m.light.intensity(0.4 + tele * 2.5)
      sync(e)
    }

    // 弹道
    const pool = boltPool
    let used = 0
    for (let i = s.bolts.length - 1; i >= 0; i--) {
      const b = s.bolts[i]
      const prev: Vec3 = [...b.pos]
      const step = Math.hypot(b.vel[0], b.vel[1], b.vel[2]) * dt
      b.pos[0] += b.vel[0] * dt; b.pos[1] += b.vel[1] * dt; b.pos[2] += b.vel[2] * dt
      b.life -= dt
      let dead = b.life <= 0
      if (!dead && fighting && p.health > 0 && (segmentDistance(chest, prev, b.pos) < 0.45 || segmentDistance(eye, prev, b.pos) < 0.3)) {
        emit(ctx, 'jimao/damage-player', b.damage, prev)
        dead = true
      }
      if (!dead) {
        const hit = scene.raycast(prev, b.vel, { maxDistance: step, mask: 1 << LEVEL_LAYER })
        if (hit) dead = true
      }
      if (dead) s.bolts.splice(i, 1)
    }
    for (const b of s.bolts) {
      if (used >= pool.length) break
      const e = pool[used++]
      e.active(true)
      e.position = b.pos
      e.lookAt([b.pos[0] + b.vel[0], b.pos[1] + b.vel[1], b.pos[2] + b.vel[2]])
      e.localRotation = [e.localRotation[0] + 90, e.localRotation[1], e.localRotation[2]]
      e.color(b.type === 'gull' ? '#ff6a40' : '#ffb347')
    }
    for (let i = used; i < pool.length; i++) pool[i].active(false)

    // 爆炸
    for (let i = s.booms.length - 1; i >= 0; i--) if ((s.booms[i].t += dt) > 0.6) s.booms.splice(i, 1)
    boomPool.forEach((b, i) => {
      const boom = s.booms[i]
      b.e.active(!!boom)
      if (!boom) return
      const k = boom.t / 0.6
      const r = 0.6 + k * 5
      b.e.position = boom.pos
      b.e.scale = [r, r, r]
      b.e.color(`#ffb347${Math.round((1 - k) * 200).toString(16).padStart(2, '0')}`)
      b.l.intensity((1 - k) * 6)
    })
  })
}
