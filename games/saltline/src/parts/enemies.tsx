/**
 * 敌人：机械飞鸥（空中）与机械猎犬（地面）。
 * 模拟是积木：slFoe（感知、警戒、攻击令牌与开火）、slGull（飞行、避障、坠毁）、slHound（地面移动、扑击、倒地）、slBolt（弹道）。
 * wireEnemies 另有表现：按实体建、拆模型，驱动原版动画、特效，以及子弹命中的部件映射（过渡，第 5 步移入 mech 套件）。
 * 只导出定义，由 game.tsx 组装。
 */
import { defineBlock, definePrefab, type Context, type Entity, type Vec3 } from '@pot/core'
import { damage } from '@pot/kit/fps'
import { emit, on } from '../lib/bus'
import type { LevelData } from '@pot/kit/harbor/level'
import { angleDelta, clamp, dist, dist2d, jitter, lerp, norm, RAD, segmentDistance, sub, yawOf } from '@pot/kit/realistic/math'
import { buildEnemy, type EnemyModel } from '@pot/kit/mech/models'
import { syncHound } from '@pot/kit/mech/hound'
import { syncGull } from '@pot/kit/mech/gull'
import { createMats, type Mats } from '@pot/kit/realistic/mats'
import { sfx } from '@pot/kit/realistic/sfx'
import { chestOf, eyeOf, game, player, type EnemyType, type PlayerState } from '../lib/types'

type Mode = 'patrol' | 'combat' | 'search' | 'dying'

/** 积木的 step 拿不到单元的 ctx：wireEnemies 时记下（过渡，第 5 步去掉） */
let host: Context
let TU: any
let groundMaxX = 30
/** 敌人的射线只看关卡盒（default 与只挡子弹的 bullet 层） */
const RAY = { layers: ['default', 'bullet'] }
/** 开火口（局部坐标，绕朝向旋转；原版飞鸥 d.muzzle = (0, -.12, .17)） */
const MUZZLE: Record<EnemyType, Vec3> = { hound: [0, 0.97, 0.45], gull: [0, -0.12, 0.17] }
/** 地面/海面平面（原版 physics：x ≤ 30 为 y=0 的地坪，码头外为 y=-1.6 的海面） */
const planeY = (x: number) => (x <= 30 ? 0 : -1.6)

/** 暂停与标题时整体冻结（旧版 update 直接 return） */
function frozen() {
  const g = game(host)
  return !g || g.phase === 'paused' || g.phase === 'title'
}

/** 每步统计一次存活数与持有令牌数，并让令牌间隔走一步（只是缓存，不是状态） */
const tally = { tick: -1, alive: 0, tokens: 0 }
function tokens(w: any) {
  if (tally.tick !== w.tick) {
    tally.tick = w.tick
    tally.alive = tally.tokens = 0
    for (const x of w.query('enemy')) {
      if (x.b.slFoe.mode !== 'dying') tally.alive++
      if (x.b.slFoe.token) tally.tokens++
    }
    w.vars.tokenGap = Math.max(0, w.vars.tokenGap - w.dt)
  }
  return tally
}

function releaseToken(f: any, w: any) {
  if (!f.token) return
  f.token = false
  w.vars.tokenGap = TU.enemy.tokenGap
}

function enterCombat(f: any, e: any, at: Vec3) {
  const was = f.mode
  f.mode = 'combat'
  f.lastKnown = [...at]
  f.lost = 0
  if (was === 'patrol' || was === 'search') emit(host, 'saltline/alert', [...e.pos] as Vec3)
}

const sightFrom = (f: any, e: any): Vec3 => (f.kind === 'gull' ? [...e.pos] as Vec3 : [e.pos[0], e.pos[1] + 1.1, e.pos[2]])

function canSee(f: any, e: any, w: any, eye: Vec3, d: number) {
  const E = TU.enemy
  if (d > E.sightRange) return false
  if (f.mode !== 'combat' && Math.abs(angleDelta(f.yaw, yawOf(sub(eye, e.pos)))) > E.sightCone / 2) return false
  const from = sightFrom(f, e)
  const hit = w.raycast(from, sub(eye, from), d, RAY)
  return !hit || hit.dist > d - 0.4
}

function fire(f: any, e: any, w: any, target: Vec3) {
  const T = TU[f.kind], y = f.yaw * RAD, gull = f.kind === 'gull'
  const [mx, my, mz] = MUZZLE[f.kind as EnemyType]
  const origin: Vec3 = [e.pos[0] + Math.sin(y) * mz + Math.cos(y) * mx, e.pos[1] + my, e.pos[2] + Math.cos(y) * mz - Math.sin(y) * mx]
  const spread = lerp(T.spreadNear, T.spreadFar, clamp(dist(origin, target) / T.fireRange, 0, 1))
  const dir = jitter(norm(sub(target, origin)), spread, () => w.rand())
  if (gull) for (let k = 0; k < 3; k++) f.vel[k] -= dir[k] * 0.35
  const speed = gull ? T.boltSpeed : T.shotSpeed
  w.spawn('bolt', { at: origin, slBolt: { vel: [dir[0] * speed, dir[1] * speed, dir[2] * speed], damage: gull ? T.boltDamage : T.shotDamage, kind: f.kind } })
  f.fired = w.tick
  host.audio.play(sfx(gull ? 'bolt' : 'houndShot'), { volume: 0.6, position: origin, pitch: 0.9 + w.rand() * 0.2 })
}

/** 死亡的模拟部分；掉旋翼、熄灯等由表现看到 mode 变成 dying 后自己做 */
function die(f: any, e: any, w: any, weak: boolean, dir?: Vec3) {
  releaseToken(f, w)
  f.mode = 'dying'
  f.dyingT = 0
  f.attack = 'idle'
  if (f.kind === 'gull') {
    // 原版 v：上抛 1.5，沿弹道再推 2.5，之后自旋坠落
    f.vel[1] += 1.5
    if (dir) for (let k = 0; k < 3; k++) f.vel[k] += dir[k] * 2.5
  } else {
    f.vel[0] *= 0.3; f.vel[2] *= 0.3
  }
  emit(host, 'saltline/kill', f.kind, weak, [...e.pos] as Vec3)
}

function explode(w: any, pos: Vec3, amount: number, radius: number) {
  w.spawn('boom', { at: [...pos] })
  host.audio.play(sfx('explode'), { volume: 0.9, position: pos })
  const p = player(host)
  if (!p || amount <= 0) return
  const d = dist(chestOf(p), pos)
  if (d < radius) emit(host, 'saltline/damage-player', Math.round(amount * (1 - (d / radius) * 0.5)), pos)
  if (d < radius * 4) p.shake = Math.min(1, p.shake + (1 - d / (radius * 4)) * 0.6)
}

/** 共用：感知、警戒状态与攻击循环（先于移动） */
const slFoe = defineBlock({
  name: 'slFoe',
  about: 'saltline 敌人共用：视线与听觉、巡逻/交战/搜索状态、攻击令牌与开火。kind 为 gull 或 hound，pursuit 为生成时直接搜索玩家',
  props: { kind: 'hound' as EnemyType, pursuit: false },
  state: {
    mode: 'patrol' as Mode, yaw: 0, vel: [0, 0, 0] as Vec3, home: [0, 0, 0] as Vec3, goal: [0, 0, 0] as Vec3, goalT: 0,
    lastKnown: [0, 0, 0] as Vec3, lost: 0, searchT: 0, seeing: false, losT: 0,
    attack: 'idle' as 'idle' | 'telegraph' | 'burst', attackT: 0, shots: 0, cooldown: 0, token: false,
    orbit: 1, dyingT: 0, anim: 0, flash: 0,
    /** 最近一次开火的步号（表现据此做后坐） */
    fired: -1,
  },
  init(me, e, w) {
    const T = TU[me.kind], p = player(host)
    me.yaw = w.rand() * 360
    me.home = [...e.pos] as Vec3
    me.goal = [...e.pos] as Vec3
    me.lastKnown = p ? [...p.pos] as Vec3 : [...e.pos] as Vec3
    me.mode = me.pursuit ? 'search' : 'patrol'
    me.searchT = TU.enemy.searchTime * 2
    me.losT = w.rand() * 0.2
    me.cooldown = lerp(T.cooldown[0], T.cooldown[1], w.rand())
    me.orbit = w.rand() < 0.5 ? -1 : 1
    me.anim = w.rand() * 10
  },
  step(me, e, w) {
    const p = player(host)
    if (frozen() || !p) return
    const T = TU[me.kind], E = TU.enemy, dt = w.dt
    me.anim += dt
    me.flash = Math.max(0, me.flash - dt)
    if (me.mode === 'dying') { me.dyingT += dt; return }
    const fighting = game(host)!.phase === 'playing'
    const eye = eyeOf(p), t = tokens(w)
    // 感知
    const d = dist(sightFrom(me, e), eye)
    me.losT -= dt
    if (me.losT <= 0) {
      me.losT = 0.18 + w.rand() * 0.08
      me.seeing = fighting && p.health > 0 && canSee(me, e, w, eye, d)
    }
    if (me.seeing) {
      if (me.mode !== 'combat') enterCombat(me, e, p.pos)
      me.lastKnown = [...p.pos] as Vec3
      me.lost = 0
    } else if (me.mode === 'combat') {
      me.lost += dt
      if (me.lost > E.loseSight) { me.mode = 'search'; me.searchT = E.searchTime }
    }
    if (me.mode === 'search') {
      me.searchT -= dt
      if (me.searchT <= 0) { me.mode = 'patrol'; me.home = [...e.pos] as Vec3 }
    }
    // 攻击循环：预警 → 连发；同时开火的数量受令牌限制
    const facing = me.kind !== 'gull' || Math.abs(angleDelta(me.yaw, yawOf(sub(p.pos, e.pos)))) < 20
    const inRange = me.mode === 'combat' && me.seeing && d < T.fireRange
    if (me.attack === 'idle') {
      me.cooldown -= dt
      const max = t.alive >= 6 ? E.maxTokensCrowd : E.maxTokens
      if (inRange && facing && me.cooldown <= 0 && !me.token && t.tokens < max && w.vars.tokenGap <= 0) {
        me.token = true
        t.tokens++
        w.vars.tokenGap = E.tokenGap * 0.5
        me.attack = 'telegraph'
        me.attackT = T.telegraph
        host.audio.play(sfx('telegraph'), { volume: 0.5, position: e.pos, pitch: me.kind === 'gull' ? 1.2 : 0.8 })
      }
    } else if (me.attack === 'telegraph') {
      me.attackT -= dt
      if (!inRange) { me.attack = 'idle'; me.cooldown = 0.6; releaseToken(me, w) }
      else if (me.attackT <= 0) { me.attack = 'burst'; me.shots = T.burst; me.attackT = 0 }
    } else {
      me.attackT -= dt
      if (!fighting) { me.shots = 0 } // 玩家已死或不在 playing：不再对着尸体打完连发
      else if (me.attackT <= 0 && me.shots > 0) { fire(me, e, w, chestOf(p)); me.shots--; me.attackT = T.burstGap }
      if (me.shots <= 0) { me.attack = 'idle'; me.cooldown = lerp(T.cooldown[0], T.cooldown[1], w.rand()); releaseToken(me, w) }
    }
  },
})

/**
 * 飞鸥飞行（原版 x() 的移动部分，Unity 坐标；公式对 z 镜像对称）：
 * 目标点（交战绕玩家盘旋 / 搜索绕最后位置 / 巡逻绕出生点）→ PD 加速度 + 三向探测避障 → 限加速度、限速 → 逐轴碰撞 → 离地 ≥ 1.1。
 */
const slGull = defineBlock({
  name: 'slGull',
  about: 'saltline 飞鸥：盘旋飞行、射线避障、限高；死亡后坠落并爆炸',
  order: 1,
  state: {
    orbitA: 0, orbitR: 0, patrolR: 0, alt: 0, flipT: 0, avoid: [0, 0, 0] as Vec3, ceil: 1e9, ceilT: 0, feeler: 0, phase: 0,
    /** 本步加速度（表现的机身姿态用） */
    acc: [0, 0, 0] as Vec3,
  },
  init(me, _e, w) {
    const T = TU.gull
    me.orbitR = T.rangeMin + 2 + w.rand() * (T.rangeMax - T.rangeMin - 5)
    me.alt = T.altMin + 0.8 + w.rand() * (T.altMax - T.altMin - 1.6)
    me.patrolR = 4 + w.rand() * 5
    me.phase = w.rand() * 6.283
    me.orbitA = w.rand() * 6.283
    me.flipT = 3 + w.rand() * 4
  },
  step(me, e, w) {
    const p = player(host)
    if (frozen() || !p) return
    const f = e.b.slFoe, T = TU.gull, dt = w.dt, v: Vec3 = f.vel, pos: Vec3 = e.pos
    if (f.mode === 'dying') {
      // 原版 g：重力 9.5、水平阻尼；撞到东西、落地/落海或 5 秒后爆炸
      v[1] -= 9.5 * dt
      v[0] *= 1 - 0.4 * dt; v[2] *= 1 - 0.4 * dt
      const b = Math.hypot(v[0], v[1], v[2])
      let done = f.dyingT > 5 || pos[1] < -3
      if (!done && b > 0.01) {
        const h = w.raycast(pos, v, b * dt + 0.3, RAY)
        if (h) { e.pos = [h.point[0] + h.normal[0] * 0.2, h.point[1] + h.normal[1] * 0.2, h.point[2] + h.normal[2] * 0.2]; done = true }
      }
      if (!done) {
        for (let k = 0; k < 3; k++) pos[k] += v[k] * dt
        const py = planeY(pos[0])
        if (pos[1] <= py + 0.2) { pos[1] = py + 0.2; done = true }
      }
      if (done) {
        explode(w, e.pos, game(host)!.phase === 'playing' ? T.explodeDamage : 0, T.explodeRadius)
        w.destroy(e)
      }
      return
    }
    const combat = f.mode === 'combat', hurt = e.b.health.hp < T.hp * 0.5, t = f.anim, lk: Vec3 = f.lastKnown
    let M = T.patrolSpeed, tx: number, ty: number, tz: number
    if (combat) {
      M = T.maxSpeed
      me.flipT -= dt
      if (me.flipT <= 0) {
        me.flipT = 3 + w.rand() * 5
        if (w.rand() < 0.6) f.orbit = -f.orbit
        me.orbitR = clamp(me.orbitR + (w.rand() - 0.5) * 6, T.rangeMin + 1, T.rangeMax - 2)
      }
      if (f.lost > 1.5) {
        tx = lk[0]; tz = lk[2]; ty = lk[1] + me.alt + 1
        me.orbitA = Math.atan2(pos[2] - lk[2], pos[0] - lk[0])
      } else {
        me.orbitA += f.orbit * (f.attack !== 'idle' ? 0.9 : 3.6) / me.orbitR * dt
        tx = p.pos[0] + Math.cos(me.orbitA) * me.orbitR; tz = p.pos[2] + Math.sin(me.orbitA) * me.orbitR; ty = p.pos[1] + me.alt
      }
    } else if (f.mode === 'search') {
      M = 5.5
      me.orbitA += 0.5 * dt
      tx = lk[0] + Math.cos(me.orbitA) * 4.5; tz = lk[2] + Math.sin(me.orbitA) * 4.5; ty = lk[1] + Math.min(me.alt, 5.5)
    } else {
      me.orbitA += 0.28 * dt * f.orbit
      tx = f.home[0] + Math.cos(me.orbitA) * me.patrolR; tz = f.home[2] + Math.sin(me.orbitA) * me.patrolR; ty = f.home[1]
    }
    ty = Math.max(2.2, Math.min(ty, me.ceil))
    const acc: Vec3 = [(tx - pos[0]) * 2.2 - v[0] * 2.4, (ty - pos[1]) * 5 - v[1] * 3.6, (tz - pos[2]) * 2.2 - v[2] * 2.4]
    const av = me.avoid
    me.feeler = (me.feeler + 1) % 3
    const z = Math.hypot(v[0], v[2])
    if (me.feeler === 0 && z > 0.6) {
      const P = 2.2 + z * 0.5
      const h = w.raycast(pos, [v[0] / z, 0, v[2] / z], P, RAY)
      if (h) {
        const Y = 1 - h.dist / P
        av[0] = h.normal[0] * 26 * Y; av[1] = h.normal[1] * 26 * Y + 9 * Y; av[2] = h.normal[2] * 26 * Y
        if (Y > 0.5) { f.orbit = -f.orbit; me.flipT = 2.5 }
      }
    } else if (me.feeler === 1) {
      const h = w.raycast(pos, [0, -1, 0], 2.4, RAY)
      if (h) av[1] += (2.4 - h.dist) * 10
    } else if (me.feeler === 2) {
      me.ceilT -= dt * 3
      if (me.ceilT <= 0) {
        me.ceilT = 0.35
        const h = w.raycast(pos, [0, 1, 0], 4, RAY)
        me.ceil = h ? pos[1] + h.dist - 1.3 : 1e9
      }
    }
    const decay = Math.exp(-6 * dt)
    for (let k = 0; k < 3; k++) { acc[k] += av[k]; av[k] *= decay }
    if (hurt) {
      acc[0] += Math.sin(t * 7.3 + me.phase) * 5; acc[2] += Math.cos(t * 6.1 + me.phase) * 5; acc[1] += Math.sin(t * 9.7) * 3
    }
    const H = Math.hypot(acc[0], acc[1], acc[2])
    if (H > T.accel) for (let k = 0; k < 3; k++) acc[k] *= T.accel / H
    for (let k = 0; k < 3; k++) v[k] += acc[k] * dt
    const O = Math.hypot(v[0], v[1], v[2])
    if (O > M) for (let k = 0; k < 3; k++) v[k] *= M / O
    // 逐轴碰撞：撞上则反弹 .25 并记一次反向推力
    for (let k = 0; k < 3; k++) {
      const V = v[k]
      if (Math.abs(V) < 0.02) continue
      const Y = V > 0 ? 1 : -1, L = k === 1 ? 0.35 : 0.62
      const dir: Vec3 = [0, 0, 0]; dir[k] = Y
      const h = w.raycast(pos, dir, Math.abs(V) * dt + L, RAY)
      if (h) {
        v[k] = -V * 0.25
        av[k] -= Y * 8
        if (h.dist < L) pos[k] -= Y * (L - h.dist)
      }
    }
    for (let k = 0; k < 3; k++) pos[k] += v[k] * dt
    // 原版 groundHeight(x, z, y + .5) + 1.1
    const g = w.raycast([pos[0], pos[1] + 0.5, pos[2]], [0, -1, 0], 60, RAY)
    const floor = Math.max(g ? g.point[1] : -Infinity, planeY(pos[0])) + 1.1
    if (pos[1] < floor) { pos[1] = floor; if (v[1] < 0) v[1] = 0 }
    // 朝向：交战/搜索时看玩家（或最后位置），否则看飞行方向；转速 3.2 rad/s
    let q = f.yaw
    if (combat || f.mode === 'search') q = yawOf(sub(combat && f.lost < 1.5 ? p.pos : lk, pos))
    else if (z > 0.4) q = yawOf(v)
    const turn = 3.2 / RAD * dt
    f.yaw += clamp(angleDelta(f.yaw, q), -turn, turn)
    me.acc = acc
  },
})

/** 猎犬：巡逻游走、交战时绕玩家侧移或追击、近身扑击；撞墙临时绕行 */
const slHound = defineBlock({
  name: 'slHound',
  about: 'saltline 猎犬：地面移动（w.move）、绕行、扑击；死亡后滑行倒地、下沉回收',
  order: 1,
  state: { grounded: true, yawRate: 0, lunge: 0, lungeCd: 0, detour: 0, detourT: 0 },
  step(me, e, w) {
    const p = player(host)
    if (frozen() || !p) return
    const f = e.b.slFoe, T = TU.hound, dt = w.dt, v: Vec3 = f.vel
    if (f.mode === 'dying') {
      // 原版 U：滑行减速、倒地；6.5 秒后残骸以 .22m/s 下沉 3.2 秒再回收（原版不爆炸）
      const k = Math.exp(-5 * dt)
      v[0] *= k; v[2] *= k
      e.pos[0] += v[0] * dt; e.pos[2] += v[2] * dt
      if (f.dyingT > 6.5) e.pos[1] -= 0.22 * dt
      if (f.dyingT > 9.7) w.destroy(e)
      return
    }
    me.detourT = Math.max(0, me.detourT - dt)
    f.goalT -= dt
    const toP = sub(p.pos, e.pos)
    const hd = Math.hypot(toP[0], toP[2]) || 1
    let target: Vec3 = f.goal
    let speed = T.patrolSpeed
    if (f.mode === 'combat') {
      if (hd > T.rangeMax || !f.seeing) { target = f.lastKnown; speed = T.runSpeed }
      else if (hd < T.rangeMin) { target = [e.pos[0] - toP[0] / hd * 3, 0, e.pos[2] - toP[2] / hd * 3]; speed = T.stalkSpeed }
      else {
        target = [e.pos[0] - toP[2] / hd * f.orbit * 3, 0, e.pos[2] + toP[0] / hd * f.orbit * 3]
        speed = T.stalkSpeed
        if (f.goalT <= 0) { f.goalT = 1.5 + w.rand() * 2; if (w.rand() < 0.5) f.orbit *= -1 }
      }
      me.lungeCd = Math.max(0, me.lungeCd - dt)
      if (hd < T.lungeRange && me.lungeCd <= 0 && me.lunge <= 0) {
        me.lunge = 0.35
        me.lungeCd = T.lungeCooldown
        v[0] = toP[0] / hd * T.lungeSpeed; v[2] = toP[2] / hd * T.lungeSpeed; v[1] = 3
      }
    } else if (f.mode === 'search') {
      target = f.lastKnown
      speed = T.runSpeed * 0.7
    } else if (f.goalT <= 0 || dist2d(e.pos, f.goal) < 1) {
      f.goalT = 4 + w.rand() * 4
      const a = w.rand() * Math.PI * 2, r = 2 + w.rand() * 7
      f.goal = [f.home[0] + Math.cos(a) * r, 0, f.home[2] + Math.sin(a) * r]
    }
    if (me.lunge > 0) {
      me.lunge -= dt
      if (dist2d(e.pos, p.pos) < 1.2 && Math.abs(e.pos[1] - p.pos[1]) < 1.5) {
        me.lunge = 0
        emit(host, 'saltline/damage-player', T.lungeDamage, [...e.pos] as Vec3)
        v[0] *= -0.3; v[2] *= -0.3
      }
    } else {
      // 转向目标（绕行时把期望速度转 detour 度），按加速度逼近
      const dx = target[0] - e.pos[0], dz = target[2] - e.pos[2], l = Math.hypot(dx, dz)
      const sp = Math.min(speed, l * 1.5)
      let tx = l > 0.01 ? dx / l * sp : 0, tz = l > 0.01 ? dz / l * sp : 0
      if (me.detourT > 0) {
        const a = me.detour * RAD, c = Math.cos(a), s = Math.sin(a)
        ;[tx, tz] = [tx * c + tz * s, -tx * s + tz * c]
      }
      const k = Math.min(1, T.accel * dt / Math.max(0.001, speed))
      v[0] += (tx - v[0]) * k
      v[2] += (tz - v[2]) * k
    }
    // 原版：机身只沿自身前方移动；期望朝向 = 速度方向（停下且交战时朝玩家），转速限 turnRate（扑击时 ×2）
    const hs = Math.hypot(v[0], v[2])
    const want = me.lunge > 0 ? yawOf(toP) : hs > 0.3 ? yawOf(v) : f.mode === 'combat' && f.seeing ? yawOf(toP) : f.yaw
    const F = clamp(angleDelta(f.yaw, want) * 6, -T.turnRate * 57.3, T.turnRate * 57.3) * (me.lunge > 0 ? 2 : 1)
    me.yawRate += (F - me.yawRate) * (1 - Math.exp(-10 * dt))
    f.yaw += me.yawRate * dt
    const fwd = me.lunge > 0 ? 1 : Math.max(0, Math.cos(angleDelta(f.yaw, want) * RAD))
    v[0] = Math.sin(f.yaw * RAD) * hs * fwd
    v[2] = Math.cos(f.yaw * RAD) * hs * fwd
    v[1] -= 21 * dt
    const mover = { vel: v, grounded: me.grounded }
    const res = w.move(e, mover, { radius: 0.45, height: 1.3, stepUp: 0.5, layers: ['default'], ground: { y: 0, maxX: groundMaxX } })
    me.grounded = mover.grounded
    if (res.hitWall && me.detourT <= 0) { me.detour = (w.rand() < 0.5 ? -1 : 1) * 75; me.detourT = 0.9 }
    if (e.pos[1] < -3) { e.pos = [...f.home]; f.vel = [0, 0, 0] }
  },
})

/** 弹道：飞行、寿命、打中玩家、撞墙（不用系统 projectile/lifetime：它们不知道 saltline 的暂停） */
const slBolt = defineBlock({
  name: 'slBolt',
  about: 'saltline 敌人弹道：按 vel 飞行 1.6 秒，扫过玩家躯干或头部时造成 damage，撞到关卡盒消失',
  order: 2,
  props: { vel: [0, 0, 1] as Vec3, damage: 0, kind: 'gull' as EnemyType },
  state: { life: 1.6 },
  step(me, e, w) {
    if (frozen()) return
    const p = player(host), v = me.vel, dt = w.dt
    const prev: Vec3 = [e.pos[0], e.pos[1], e.pos[2]]
    for (let k = 0; k < 3; k++) e.pos[k] += v[k] * dt
    me.life -= dt
    let dead = me.life <= 0
    if (!dead && p && game(host)!.phase === 'playing' && p.health > 0 && (segmentDistance(chestOf(p), prev, e.pos) < 0.45 || segmentDistance(eyeOf(p), prev, e.pos) < 0.3)) {
      emit(host, 'saltline/damage-player', me.damage, prev)
      dead = true
    }
    if (!dead && w.raycast(prev, v, Math.hypot(v[0], v[1], v[2]) * dt, RAY)) dead = true
    if (dead) w.destroy(e)
  },
})

/** 敌人积木；用到 game.tsx 的 vars.tokenGap（攻击令牌间隔） */
export const enemyBlocks = [slFoe, slGull, slHound, slBolt]

export const enemyPrefabs = [
  definePrefab('gull', { tags: ['enemy'], about: '机械飞鸥', slFoe: { kind: 'gull' }, slGull: true, health: true }),
  definePrefab('hound', { tags: ['enemy'], about: '机械猎犬', slFoe: { kind: 'hound' }, slHound: true, health: true }),
  definePrefab('bolt', { about: '敌人弹道', slBolt: true }),
  definePrefab('boom', { about: '爆炸火球（只是表现）', lifetime: { seconds: 0.6 } }),
]

/** 表现侧每个敌人的记录 */
interface Look { m: EnemyModel; dead: boolean; fired: number; smokeT: number }

/** 过渡期接线：记下 ctx，建模型与特效池，处理 spawn、clear-enemies、shot、bullet 事件 */
export function wireEnemies(ctx: Context) {
  host = ctx
  TU = ctx.data.load('tuning.json')
  groundMaxX = ctx.data.load<LevelData>('level.json').quay.X
  const w: any = ctx.world
  const { scene } = ctx
  const looks = new Map<number, Look>()
  const partOwner = new Map<number, { id: number; weak: boolean }>()
  /** 猎犬外壳/金属用原版 GPU 烘焙材质（没有 gfx 后端时退回纯色） */
  let mats: Mats | undefined
  try { mats = ctx.gfx.supported ? createMats(ctx, { tex: TU.quality?.tex }) : undefined } catch (err) {
    mats = undefined
    ctx.logger('enemies').warn('材质不可用：%s', String(err))
  }
  const toThree = (v: Vec3) => ({ x: v[0], y: v[1], z: -v[2] })
  /** Unity 偏航（度，0 朝 +Z）→ 原版偏航（弧度，模型朝 +Z 的右手系） */
  const threeYaw = (yaw: number) => Math.PI - yaw * RAD
  /** 固定步之间按插值取位置 */
  const at = (e: any, a: number): Vec3 => {
    const q = w.prev.get(e.id)?.pos ?? e.pos
    return [q[0] + (e.pos[0] - q[0]) * a, q[1] + (e.pos[1] - q[1]) * a, q[2] + (e.pos[2] - q[2]) * a]
  }

  // ---- 弹道与爆炸特效池 ----
  const boltPool: Entity[] = []
  for (let i = 0; i < 32; i++) boltPool.push(scene.spawn({ shape: 'capsule', name: 'bolt', scale: [0.09, 0.32, 0.09], color: '#ff6a40', material: { mode: 'additive', shadows: false }, collider: false, active: false }))
  const boomPool: { e: Entity; l: Entity }[] = []
  for (let i = 0; i < 4; i++) {
    const e = scene.spawn({ shape: 'sphere', name: 'boom', color: '#ffb347', material: { mode: 'additive', shadows: false }, collider: false, active: false })
    const l = scene.light({ type: 'point', name: 'boom-light', parent: e, intensity: 0, range: 12, color: '#ff9a40' })
    boomPool.push({ e, l })
  }

  function look(e: any): Look {
    let L = looks.get(e.id)
    if (!L) {
      const f = e.b.slFoe
      const m = buildEnemy(ctx, f.kind, `${f.kind}-${e.id}`, mats)
      for (const [part, weak] of m.parts) partOwner.set(part, { id: e.id, weak })
      m.hound?.anim.place(e.pos[0], e.pos[1], -e.pos[2], threeYaw(f.yaw))
      m.gull?.anim.place(e.pos[0], e.pos[1], -e.pos[2], threeYaw(f.yaw))
      looks.set(e.id, L = { m, dead: false, fired: f.fired, smokeT: 0 })
    }
    return L
  }

  function drop(id: number) {
    const L = looks.get(id)
    if (!L) return
    for (const part of L.m.parts.keys()) partOwner.delete(part)
    L.m.root.destroy()
    looks.delete(id)
  }

  on(ctx, 'saltline/spawn', (type, pos, pursuit) => {
    w.spawn(type, { at: [...pos], slFoe: { pursuit }, health: { max: TU[type].hp } })
  })

  on(ctx, 'saltline/clear-enemies', () => {
    for (const e of w.query()) if (e.b.slFoe || e.b.slBolt || e.prefab === 'boom') w.destroy(e)
    w.vars.tokenGap = 0
  })

  on(ctx, 'saltline/shot', (pos) => {
    for (const e of w.query('enemy')) {
      const f = e.b.slFoe
      if (f.mode === 'dying' || f.mode === 'combat' || dist(e.pos, pos) >= TU.enemy.hearRadius) continue
      f.mode = 'search'
      f.lastKnown = [...pos]
      f.searchT = TU.enemy.searchTime
    }
  })

  on(ctx, 'saltline/bullet', (hit) => {
    const owner = partOwner.get(hit.id)
    const e = owner && w.get(owner.id), f = e?.b.slFoe
    if (!owner || !f || f.mode === 'dying') return
    hit.enemy = true
    hit.weak = owner.weak
    const dmg = hit.damage * (owner.weak ? TU.weapon.weakMultiplier : 1)
    damage(w, e, dmg)
    f.flash = 0.08
    const p = player(ctx), m = looks.get(e.id)?.m
    const dir = p ? norm(sub(hit.point, eyeOf(p))) : undefined
    if (m?.hound && dir) m.hound.anim.hit(dmg, { x: dir[0], y: dir[1], z: -dir[2] }, owner.weak)
    if (f.kind === 'gull' && dir) {
      // 原版 damage：被打退 min(3, dmg·.09)，机身随机歪一下
      const k = Math.min(3, dmg * 0.09)
      for (let i = 0; i < 3; i++) f.vel[i] += dir[i] * k
      m?.gull?.anim.hit()
    }
    if (p && f.mode !== 'combat') enterCombat(f, e, p.pos)
    if (e.b.health.hp <= 0) {
      hit.killed = true
      die(f, e, w, owner.weak, dir)
    }
  })

  /** 死亡的表现：飞鸥随机掉一个旋翼（火花、烟）并熄灯，猎犬倒地；命中盒都关掉 */
  function dieFx(L: Look) {
    const m = L.m
    if (m.gull) {
      const a = m.gull.anim.die()
      const pt: Vec3 = [a.x, a.y, -a.z]
      scene.burst({ kind: 'spark', position: pt, direction: [0, 1, 0], color: '#ffc070', intensity: 8, count: 14, speed: 5, spread: 0.8, size: 0.02, life: 0.5 })
      scene.burst({ kind: 'smoke', position: pt, direction: [0, 1, 0], color: '#3a3c3e', count: 3, speed: 0.6, spread: 0.6, size: 0.5, life: 1 })
      for (const x of m.gull.hits) x.active(false)
      m.light.intensity(0)
    }
    if (m.hound) {
      m.hound.anim.die()
      for (const x of m.hound.hits) x.active(false)
    }
  }

  /** 飞鸥外观：原版姿态、旋翼、频闪、云台、镜头；血量过半冒烟；坠落时拖黑烟 */
  function animateGull(L: Look, e: any, pos: Vec3, dt: number, p: PlayerState) {
    const f = e.b.slFoe, a = L.m.gull!.anim
    if (f.mode === 'dying') {
      a.dead(dt, pos[0], pos[1], -pos[2])
      L.smokeT -= dt
      if (L.smokeT <= 0) {
        L.smokeT = 0.045
        scene.burst({ kind: 'smoke', position: pos, direction: [0, 1, 0], color: '#151617', count: 1, speed: 0.6, spread: 0.3, size: 0.45, life: 1.3 })
        if (Math.random() < 0.5) scene.burst({ kind: 'spark', position: pos, direction: norm([Math.random() - 0.5, Math.random(), Math.random() - 0.5]), color: '#ffc070', intensity: 8, count: 3, speed: 4, spread: 0.5, size: 0.015, life: 0.3 })
      }
      return
    }
    const combat = f.mode === 'combat', hurt = e.b.health.hp < TU.gull.hp * 0.5, acc = e.b.slGull.acc
    if (f.attack === 'telegraph') a.flare = Math.min(1, a.flare + dt * 4.5)
    else if (f.attack === 'burst') a.flare = 1
    a.live(dt, {
      x: pos[0], y: pos[1], z: -pos[2], yaw: threeYaw(f.yaw), ax: acc[0], ay: acc[1], az: -acc[2], hs: Math.hypot(f.vel[0], f.vel[2]),
      engage: combat, hurt, mode: combat ? 'engage' : f.mode === 'search' ? 'search' : 'patrol', player: toThree(p.pos), lastKnown: toThree(f.lastKnown),
    })
    if (hurt) {
      L.smokeT -= dt
      if (L.smokeT <= 0) {
        L.smokeT = 0.16
        scene.burst({ kind: 'smoke', position: pos, direction: [0, 1, 0], color: '#26282c', count: 1, speed: 0.8, spread: 0.3, size: 0.3, life: 1.1 })
        if (Math.random() < 0.15) scene.burst({ kind: 'spark', position: pos, direction: [0, -1, 0], color: '#ffc070', intensity: 8, count: 2, speed: 3, spread: 0.6, size: 0.015, life: 0.3 })
      }
    }
  }

  /** 猎犬：原版步态 H、姿态 O、炮塔/头部追踪、镜头色；死亡时原版 U 的倒地 */
  function animateHound(L: Look, e: any, pos: Vec3, dt: number, p: PlayerState) {
    const f = e.b.slFoe, a = L.m.hound!.anim
    if (f.mode === 'dying') { a.dead(dt, pos[0], pos[1], -pos[2]); return }
    if (L.fired !== f.fired) { L.fired = f.fired; a.fired() }
    const combat = f.mode === 'combat'
    if (f.attack === 'telegraph') a.flare = Math.min(1, a.flare + dt * 5)
    else if (f.attack === 'burst') a.flare = 1
    a.live(dt, {
      x: pos[0], y: pos[1], z: -pos[2], yaw: threeYaw(f.yaw), vx: f.vel[0], vz: -f.vel[2],
      ground: e.b.slHound.grounded ? pos[1] : a.ground,
      target: combat ? toThree(p.pos) : null,
      look: combat ? toThree(p.pos) : f.mode === 'search' ? toThree(f.lastKnown) : null,
      crouch: f.attack !== 'idle' ? 0.05 : 0, engage: combat,
    })
  }

  ctx.on('update', (dt) => {
    const g = game(ctx), p = player(ctx)
    const still = !g || !p || g.phase === 'paused' || g.phase === 'title'
    const alpha = ctx.clock.fixedAlpha
    const bolts: any[] = [], booms: any[] = [], live = new Set<number>()
    for (const e of w.query()) {
      if (e.b.slBolt) { bolts.push(e); continue }
      if (e.prefab === 'boom') { booms.push(e); continue }
      if (!e.b.slFoe) continue
      live.add(e.id)
      const L = look(e), f = e.b.slFoe, m = L.m
      if (still) continue
      if (f.mode === 'dying' && !L.dead) { L.dead = true; dieFx(L) }
      const pos = at(e, alpha)
      if (m.gull) animateGull(L, e, pos, dt, p!)
      else animateHound(L, e, pos, dt, p!)
      if (f.mode !== 'dying') {
        // 预警发光
        const tele = f.attack === 'telegraph' ? 0.5 + 0.5 * Math.sin(f.anim * 40) : f.attack === 'burst' ? 1 : 0
        m.glow?.color(f.flash > 0 ? '#ffffff' : tele > 0 ? '#ffd27a' : f.mode === 'combat' ? '#ff5a40' : '#ff9a70')
        m.light.intensity(0.4 + tele * 2.5)
      }
      if (m.hound) syncHound(m.hound)
      else if (m.gull) syncGull(m.gull)
    }
    for (const id of [...looks.keys()]) if (!live.has(id)) drop(id)
    if (still) return

    // 弹道
    let used = 0
    for (const b of bolts) {
      if (used >= boltPool.length) break
      const o = boltPool[used++], v = b.b.slBolt.vel, pos = at(b, alpha)
      o.active(true)
      o.position = pos
      o.lookAt([pos[0] + v[0], pos[1] + v[1], pos[2] + v[2]])
      o.localRotation = [o.localRotation[0] + 90, o.localRotation[1], o.localRotation[2]]
      o.color(b.b.slBolt.kind === 'gull' ? '#ff6a40' : '#ffb347')
    }
    for (let i = used; i < boltPool.length; i++) boltPool[i].active(false)

    // 爆炸
    boomPool.forEach((b, i) => {
      const boom = booms[i]
      b.e.active(!!boom)
      if (!boom) return
      const k = Math.min(1, boom.b.lifetime.age / 0.6)
      const r = 0.6 + k * 5
      b.e.position = boom.pos
      b.e.scale = [r, r, r]
      b.e.color(`#ffb347${Math.round((1 - k) * 200).toString(16).padStart(2, '0')}`)
      b.l.intensity((1 - k) * 6)
    })
  })
}
