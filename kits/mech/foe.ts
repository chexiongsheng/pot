/**
 * 机甲的模拟积木：mechFoe（感知、警戒、攻击令牌与开火）、mechGull（飞行、避障、坠毁爆炸）、
 * mechHound（地面移动、扑击、倒地）、mechBolt（弹道）、mechBoom（爆炸，只有表现）。
 * 逐行照搬 saltline 原版敌人（坐标用 Unity 系）；目标按标签找，伤害走 fps 的 damage。
 *
 * 用到的 w.vars：mechFrozen（为真时整体冻结，如标题画面；暂停用 flow 叠加状态，模拟不走）、mechHostile（为假时不感知、不开火、不伤人）、mechTokenGap（攻击令牌间隔）。
 * 发出的 World 事件：mechAlert { entity, pos }（从巡逻或搜索转入交战）。
 */
import { defineBlock, definePrefab, type Vec3 } from '@pot/core'
import { damage } from '@pot/kit/fps'
import { angleDelta, clamp, dist, dist2d, jitter, lerp, norm, RAD, segmentDistance, sub, yawOf } from '@pot/kit/realistic/math'
import type { EnemyType } from './models'
import { chestOf, eyeOf, findTarget, hpOf } from './target'
import { boltView, boomView, foeView, partOwner } from './look'

type Mode = 'patrol' | 'combat' | 'search' | 'dying'

/** 开火口（局部坐标，绕朝向旋转；原版飞鸥 d.muzzle = (0, -.12, .17)） */
const MUZZLE: Record<EnemyType, Vec3> = { hound: [0, 0.97, 0.45], gull: [0, -0.12, 0.17] }

export const FOE_PROPS = {
  kind: 'hound' as EnemyType,
  /** 生成时直接搜索目标 */
  pursuit: false,
  /** 目标的标签 */
  target: 'player',
  /** 视线、避障、弹道的射线层 */
  layers: ['default', 'bullet'],
  /** 地坪：x ≤ maxX 为 y，之外为海面 sea */
  ground: { y: 0, maxX: 30, sea: -1.6 },
  /** 视距、视锥（度）、看丢多久转搜索、搜索多久、听觉半径、同时开火数（人多时 crowd，存活数 ≥ crowdAt 算人多）、令牌间隔 */
  sense: { range: 45, cone: 200, lose: 4, search: 8, hear: 45, tokens: 2, crowd: 3, crowdAt: 6, gap: 1.25 },
}

export const GULL_PROPS = {
  boltDamage: 7, boltSpeed: 70, burst: 3, burstGap: 0.12, telegraph: 0.55, cooldown: [1.9, 3.3] as [number, number],
  rangeMin: 12, rangeMax: 25, altMin: 4, altMax: 8, maxSpeed: 8, patrolSpeed: 3, accel: 11,
  spreadFar: 0.065, spreadNear: 0.018, fireRange: 42, explodeRadius: 3, explodeDamage: 30,
}

export const HOUND_PROPS = {
  shotDamage: 5, shotSpeed: 55, burst: 4, burstGap: 0.11, telegraph: 0.5, cooldown: [1.8, 3] as [number, number],
  runSpeed: 4.5, stalkSpeed: 2, patrolSpeed: 1.5, accel: 7, turnRate: 2.5, rangeMin: 8, rangeMax: 18,
  spreadFar: 0.12, spreadNear: 0.045, lungeRange: 3, lungeDamage: 15, lungeCooldown: 3.5, lungeSpeed: 9.5, fireRange: 30,
  /** 地面移动的身体（w.move） */
  body: { radius: 0.45, height: 1.3, stepUp: 0.5, layers: ['default'] },
}

export const BOLT_PROPS = {
  vel: [0, 0, 1] as Vec3,
  damage: 0,
  kind: 'gull' as EnemyType,
  target: 'player',
  layers: ['default', 'bullet'],
  /** 开火声的音高（开火时定好，表现播放） */
  pitch: 1,
}

/** 种类积木（射击参数在这里） */
const gun = (e: any, f: any): any => (f.kind === 'gull' ? e.b.mechGull : e.b.mechHound)
const planeY = (f: any, x: number) => (x <= f.ground.maxX ? f.ground.y : f.ground.sea)

/** 每步统计一次存活数与持有令牌数，并让令牌间隔走一步（只是缓存，不是状态） */
const tallies = new WeakMap<object, { tick: number; alive: number; tokens: number }>()
function tokens(w: any) {
  let t = tallies.get(w)
  if (!t) tallies.set(w, (t = { tick: -1, alive: 0, tokens: 0 }))
  if (t.tick !== w.tick) {
    t.tick = w.tick
    t.alive = t.tokens = 0
    for (const x of w.query()) {
      const f = x.b.mechFoe
      if (!f) continue
      if (f.mode !== 'dying') t.alive++
      if (f.token) t.tokens++
    }
    w.vars.mechTokenGap = Math.max(0, w.vars.mechTokenGap - w.dt)
  }
  return t
}

function releaseToken(f: any, w: any) {
  if (!f.token) return
  f.token = false
  w.vars.mechTokenGap = f.sense.gap
}

function enterCombat(f: any, e: any, w: any, at: Vec3) {
  const was = f.mode
  f.mode = 'combat'
  f.lastKnown = [...at]
  f.lost = 0
  if (was === 'patrol' || was === 'search') w.emit('mechAlert', { entity: e, pos: [...e.pos] })
}

const sightFrom = (f: any, e: any): Vec3 => (f.kind === 'gull' ? [...e.pos] as Vec3 : [e.pos[0], e.pos[1] + 1.1, e.pos[2]])

function canSee(f: any, e: any, w: any, eye: Vec3, d: number) {
  const S = f.sense
  if (d > S.range) return false
  if (f.mode !== 'combat' && Math.abs(angleDelta(f.yaw, yawOf(sub(eye, e.pos)))) > S.cone / 2) return false
  const from = sightFrom(f, e)
  const hit = w.raycast(from, sub(eye, from), d, { layers: f.layers })
  return !hit || hit.dist > d - 0.4
}

function fire(f: any, e: any, w: any, target: Vec3) {
  const T = gun(e, f), y = f.yaw * RAD, gull = f.kind === 'gull'
  const [mx, my, mz] = MUZZLE[f.kind as EnemyType]
  const origin: Vec3 = [e.pos[0] + Math.sin(y) * mz + Math.cos(y) * mx, e.pos[1] + my, e.pos[2] + Math.cos(y) * mz - Math.sin(y) * mx]
  const spread = lerp(T.spreadNear, T.spreadFar, clamp(dist(origin, target) / T.fireRange, 0, 1))
  const dir = jitter(norm(sub(target, origin)), spread, () => w.rand())
  if (gull) for (let k = 0; k < 3; k++) f.vel[k] -= dir[k] * 0.35
  const speed = gull ? T.boltSpeed : T.shotSpeed
  const pitch = 0.9 + w.rand() * 0.2
  w.spawn('bolt', {
    at: origin,
    mechBolt: { vel: [dir[0] * speed, dir[1] * speed, dir[2] * speed], damage: gull ? T.boltDamage : T.shotDamage, kind: f.kind, target: f.target, layers: f.layers, pitch },
  })
  f.fired = w.tick
}

/** 死亡的模拟部分；掉旋翼、熄灯等由表现看到 mode 变成 dying 后自己做 */
function die(f: any, w: any, dir?: Vec3) {
  releaseToken(f, w)
  f.mode = 'dying'
  f.dyingT = 0
  f.attack = 'idle'
  if (f.kind === 'gull') {
    // 原版：上抛 1.5，沿弹道再推 2.5，之后自旋坠落
    f.vel[1] += 1.5
    if (dir) for (let k = 0; k < 3; k++) f.vel[k] += dir[k] * 2.5
  } else {
    f.vel[0] *= 0.3; f.vel[2] *= 0.3
  }
}

/** 爆炸：火球（表现在 mechBoom），半径内按距离伤害目标，四倍半径内震屏 */
function explode(w: any, f: any, pos: Vec3, amount: number, radius: number) {
  w.spawn('boom', { at: [...pos] })
  const t = findTarget(w, f.target)
  if (!t || amount <= 0) return
  const d = dist(chestOf(t), pos)
  if (d < radius) damage(w, t, Math.round(amount * (1 - (d / radius) * 0.5)))
  const c = t.b.cameraFps
  if (c && d < radius * 4) c.shake = Math.min(1, c.shake + (1 - d / (radius * 4)) * 0.6)
}

/** 共用：感知、警戒状态与攻击循环（先于移动） */
export const mechFoe = defineBlock({
  name: 'mechFoe',
  about: '机甲共用：视线与听觉、巡逻/交战/搜索状态、攻击令牌与开火。kind 为 gull 或 hound（射击参数在 mechGull、mechHound），pursuit 为生成时直接搜索目标',
  props: FOE_PROPS,
  state: {
    mode: 'patrol' as Mode, yaw: 0, vel: [0, 0, 0] as Vec3, home: [0, 0, 0] as Vec3, goal: [0, 0, 0] as Vec3, goalT: 0,
    lastKnown: [0, 0, 0] as Vec3, lost: 0, searchT: 0, seeing: false, losT: 0,
    attack: 'idle' as 'idle' | 'telegraph' | 'burst', attackT: 0, shots: 0, cooldown: 0, token: false,
    orbit: 1, dyingT: 0, anim: 0, flash: 0,
    /** 最近一次开火的步号（表现据此做后坐） */
    fired: -1,
    /** 受击次数与最近一次的伤害、方向、是否弱点（表现据此做受击动画） */
    hits: 0, hitDmg: 0, hitDir: [0, 0, 0] as Vec3, hitWeak: false,
  },
  init(me, e, w) {
    const T = gun(e, me), t = findTarget(w, me.target)
    me.yaw = w.rand() * 360
    me.home = [...e.pos] as Vec3
    me.goal = [...e.pos] as Vec3
    me.lastKnown = t ? [...t.pos] as Vec3 : [...e.pos] as Vec3
    me.mode = me.pursuit ? 'search' : 'patrol'
    me.searchT = me.sense.search * 2
    me.losT = w.rand() * 0.2
    me.cooldown = lerp(T.cooldown[0], T.cooldown[1], w.rand())
    me.orbit = w.rand() < 0.5 ? -1 : 1
    me.anim = w.rand() * 10
  },
  step(me, e, w) {
    const t = findTarget(w, me.target)
    if (w.vars.mechFrozen || !t) return
    const T = gun(e, me), S = me.sense, dt = w.dt
    me.anim += dt
    me.flash = Math.max(0, me.flash - dt)
    if (me.mode === 'dying') { me.dyingT += dt; return }
    const fighting = !!w.vars.mechHostile
    const eye = eyeOf(t), tk = tokens(w)
    // 感知
    const d = dist(sightFrom(me, e), eye)
    me.losT -= dt
    if (me.losT <= 0) {
      me.losT = 0.18 + w.rand() * 0.08
      me.seeing = fighting && hpOf(t) > 0 && canSee(me, e, w, eye, d)
    }
    if (me.seeing) {
      if (me.mode !== 'combat') enterCombat(me, e, w, t.pos)
      me.lastKnown = [...t.pos] as Vec3
      me.lost = 0
    } else if (me.mode === 'combat') {
      me.lost += dt
      if (me.lost > S.lose) { me.mode = 'search'; me.searchT = S.search }
    }
    if (me.mode === 'search') {
      me.searchT -= dt
      if (me.searchT <= 0) { me.mode = 'patrol'; me.home = [...e.pos] as Vec3 }
    }
    // 攻击循环：预警 → 连发；同时开火的数量受令牌限制
    const facing = me.kind !== 'gull' || Math.abs(angleDelta(me.yaw, yawOf(sub(t.pos, e.pos)))) < 20
    const inRange = me.mode === 'combat' && me.seeing && d < T.fireRange
    if (me.attack === 'idle') {
      me.cooldown -= dt
      const max = tk.alive >= S.crowdAt ? S.crowd : S.tokens
      if (inRange && facing && me.cooldown <= 0 && !me.token && tk.tokens < max && w.vars.mechTokenGap <= 0) {
        me.token = true
        tk.tokens++
        w.vars.mechTokenGap = S.gap * 0.5
        me.attack = 'telegraph'
        me.attackT = T.telegraph
      }
    } else if (me.attack === 'telegraph') {
      me.attackT -= dt
      if (!inRange) { me.attack = 'idle'; me.cooldown = 0.6; releaseToken(me, w) }
      else if (me.attackT <= 0) { me.attack = 'burst'; me.shots = T.burst; me.attackT = 0 }
    } else {
      me.attackT -= dt
      if (!fighting) { me.shots = 0 } // 不再敌对（如玩家已死）：不对着尸体打完连发
      else if (me.attackT <= 0 && me.shots > 0) { fire(me, e, w, chestOf(t)); me.shots--; me.attackT = T.burstGap }
      if (me.shots <= 0) { me.attack = 'idle'; me.cooldown = lerp(T.cooldown[0], T.cooldown[1], w.rand()); releaseToken(me, w) }
    }
  },
  view: foeView,
})

/**
 * 飞鸥飞行（原版 x() 的移动部分，Unity 坐标；公式对 z 镜像对称）：
 * 目标点（交战绕目标盘旋 / 搜索绕最后位置 / 巡逻绕出生点）→ PD 加速度 + 三向探测避障 → 限加速度、限速 → 逐轴碰撞 → 离地 ≥ 1.1。
 */
export const mechGull = defineBlock({
  name: 'mechGull',
  about: '机械飞鸥：盘旋飞行、射线避障、限高；死亡后坠落并爆炸。属性为射击与飞行参数，配 mechFoe（kind: gull）',
  order: 1,
  props: GULL_PROPS,
  state: {
    orbitA: 0, orbitR: 0, patrolR: 0, alt: 0, flipT: 0, avoid: [0, 0, 0] as Vec3, ceil: 1e9, ceilT: 0, feeler: 0, phase: 0,
    /** 本步加速度（表现的机身姿态用） */
    acc: [0, 0, 0] as Vec3,
  },
  init(me, _e, w) {
    me.orbitR = me.rangeMin + 2 + w.rand() * (me.rangeMax - me.rangeMin - 5)
    me.alt = me.altMin + 0.8 + w.rand() * (me.altMax - me.altMin - 1.6)
    me.patrolR = 4 + w.rand() * 5
    me.phase = w.rand() * 6.283
    me.orbitA = w.rand() * 6.283
    me.flipT = 3 + w.rand() * 4
  },
  step(me, e, w) {
    const f = e.b.mechFoe
    const t = f && findTarget(w, f.target)
    if (w.vars.mechFrozen || !t) return
    const dt = w.dt, v: Vec3 = f.vel, pos: Vec3 = e.pos, RAY = { layers: f.layers }
    if (f.mode === 'dying') {
      // 原版：重力 9.5、水平阻尼；撞到东西、落地/落海或 5 秒后爆炸
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
        const py = planeY(f, pos[0])
        if (pos[1] <= py + 0.2) { pos[1] = py + 0.2; done = true }
      }
      if (done) {
        explode(w, f, e.pos, w.vars.mechHostile ? me.explodeDamage : 0, me.explodeRadius)
        w.destroy(e)
      }
      return
    }
    const combat = f.mode === 'combat', hp = e.b.health, hurt = !!hp && hp.hp < hp.max * 0.5, an = f.anim, lk: Vec3 = f.lastKnown
    let M = me.patrolSpeed, tx: number, ty: number, tz: number
    if (combat) {
      M = me.maxSpeed
      me.flipT -= dt
      if (me.flipT <= 0) {
        me.flipT = 3 + w.rand() * 5
        if (w.rand() < 0.6) f.orbit = -f.orbit
        me.orbitR = clamp(me.orbitR + (w.rand() - 0.5) * 6, me.rangeMin + 1, me.rangeMax - 2)
      }
      if (f.lost > 1.5) {
        tx = lk[0]; tz = lk[2]; ty = lk[1] + me.alt + 1
        me.orbitA = Math.atan2(pos[2] - lk[2], pos[0] - lk[0])
      } else {
        me.orbitA += f.orbit * (f.attack !== 'idle' ? 0.9 : 3.6) / me.orbitR * dt
        tx = t.pos[0] + Math.cos(me.orbitA) * me.orbitR; tz = t.pos[2] + Math.sin(me.orbitA) * me.orbitR; ty = t.pos[1] + me.alt
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
      acc[0] += Math.sin(an * 7.3 + me.phase) * 5; acc[2] += Math.cos(an * 6.1 + me.phase) * 5; acc[1] += Math.sin(an * 9.7) * 3
    }
    const H = Math.hypot(acc[0], acc[1], acc[2])
    if (H > me.accel) for (let k = 0; k < 3; k++) acc[k] *= me.accel / H
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
    const floor = Math.max(g ? g.point[1] : -Infinity, planeY(f, pos[0])) + 1.1
    if (pos[1] < floor) { pos[1] = floor; if (v[1] < 0) v[1] = 0 }
    // 朝向：交战/搜索时看目标（或最后位置），否则看飞行方向；转速 3.2 rad/s
    let q = f.yaw
    if (combat || f.mode === 'search') q = yawOf(sub(combat && f.lost < 1.5 ? t.pos : lk, pos))
    else if (z > 0.4) q = yawOf(v)
    const turn = 3.2 / RAD * dt
    f.yaw += clamp(angleDelta(f.yaw, q), -turn, turn)
    me.acc = acc
  },
})

/** 猎犬：巡逻游走、交战时绕目标侧移或追击、近身扑击；撞墙临时绕行 */
export const mechHound = defineBlock({
  name: 'mechHound',
  about: '机械猎犬：地面移动（w.move）、绕行、扑击；死亡后滑行倒地、下沉回收。属性为射击与移动参数，配 mechFoe（kind: hound）',
  order: 1,
  props: HOUND_PROPS,
  state: { grounded: true, yawRate: 0, lunge: 0, lungeCd: 0, detour: 0, detourT: 0 },
  step(me, e, w) {
    const f = e.b.mechFoe
    const t = f && findTarget(w, f.target)
    if (w.vars.mechFrozen || !t) return
    const dt = w.dt, v: Vec3 = f.vel
    if (f.mode === 'dying') {
      // 原版：滑行减速、倒地；6.5 秒后残骸以 .22m/s 下沉 3.2 秒再回收（原版不爆炸）
      const k = Math.exp(-5 * dt)
      v[0] *= k; v[2] *= k
      e.pos[0] += v[0] * dt; e.pos[2] += v[2] * dt
      if (f.dyingT > 6.5) e.pos[1] -= 0.22 * dt
      if (f.dyingT > 9.7) w.destroy(e)
      return
    }
    me.detourT = Math.max(0, me.detourT - dt)
    f.goalT -= dt
    const toP = sub(t.pos, e.pos)
    const hd = Math.hypot(toP[0], toP[2]) || 1
    let target: Vec3 = f.goal
    let speed = me.patrolSpeed
    if (f.mode === 'combat') {
      if (hd > me.rangeMax || !f.seeing) { target = f.lastKnown; speed = me.runSpeed }
      else if (hd < me.rangeMin) { target = [e.pos[0] - toP[0] / hd * 3, 0, e.pos[2] - toP[2] / hd * 3]; speed = me.stalkSpeed }
      else {
        target = [e.pos[0] - toP[2] / hd * f.orbit * 3, 0, e.pos[2] + toP[0] / hd * f.orbit * 3]
        speed = me.stalkSpeed
        if (f.goalT <= 0) { f.goalT = 1.5 + w.rand() * 2; if (w.rand() < 0.5) f.orbit *= -1 }
      }
      me.lungeCd = Math.max(0, me.lungeCd - dt)
      if (hd < me.lungeRange && me.lungeCd <= 0 && me.lunge <= 0) {
        me.lunge = 0.35
        me.lungeCd = me.lungeCooldown
        v[0] = toP[0] / hd * me.lungeSpeed; v[2] = toP[2] / hd * me.lungeSpeed; v[1] = 3
      }
    } else if (f.mode === 'search') {
      target = f.lastKnown
      speed = me.runSpeed * 0.7
    } else if (f.goalT <= 0 || dist2d(e.pos, f.goal) < 1) {
      f.goalT = 4 + w.rand() * 4
      const a = w.rand() * Math.PI * 2, r = 2 + w.rand() * 7
      f.goal = [f.home[0] + Math.cos(a) * r, 0, f.home[2] + Math.sin(a) * r]
    }
    if (me.lunge > 0) {
      me.lunge -= dt
      if (dist2d(e.pos, t.pos) < 1.2 && Math.abs(e.pos[1] - t.pos[1]) < 1.5) {
        me.lunge = 0
        if (w.vars.mechHostile) damage(w, t, me.lungeDamage, e)
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
      const k = Math.min(1, me.accel * dt / Math.max(0.001, speed))
      v[0] += (tx - v[0]) * k
      v[2] += (tz - v[2]) * k
    }
    // 原版：机身只沿自身前方移动；期望朝向 = 速度方向（停下且交战时朝目标），转速限 turnRate（扑击时 ×2）
    const hs = Math.hypot(v[0], v[2])
    const want = me.lunge > 0 ? yawOf(toP) : hs > 0.3 ? yawOf(v) : f.mode === 'combat' && f.seeing ? yawOf(toP) : f.yaw
    const F = clamp(angleDelta(f.yaw, want) * 6, -me.turnRate * 57.3, me.turnRate * 57.3) * (me.lunge > 0 ? 2 : 1)
    me.yawRate += (F - me.yawRate) * (1 - Math.exp(-10 * dt))
    f.yaw += me.yawRate * dt
    const fwd = me.lunge > 0 ? 1 : Math.max(0, Math.cos(angleDelta(f.yaw, want) * RAD))
    v[0] = Math.sin(f.yaw * RAD) * hs * fwd
    v[2] = Math.cos(f.yaw * RAD) * hs * fwd
    v[1] -= 21 * dt
    const B = me.body, mover = { vel: v, grounded: me.grounded }
    const res = w.move(e, mover, { radius: B.radius, height: B.height, stepUp: B.stepUp, layers: B.layers, ground: { y: f.ground.y, maxX: f.ground.maxX } })
    me.grounded = mover.grounded
    if (res.hitWall && me.detourT <= 0) { me.detour = (w.rand() < 0.5 ? -1 : 1) * 75; me.detourT = 0.9 }
    if (e.pos[1] < -3) { e.pos = [...f.home]; f.vel = [0, 0, 0] }
  },
})

/** 弹道：飞行、寿命、打中目标、撞墙（不用系统 projectile/lifetime：它们不认 mechFrozen） */
export const mechBolt = defineBlock({
  name: 'mechBolt',
  about: '机甲弹道：按 vel 飞行 1.6 秒，扫过目标躯干或头部时造成 damage，撞到 layers 里的碰撞盒消失',
  order: 2,
  props: BOLT_PROPS,
  state: { life: 1.6 },
  step(me, e, w) {
    if (w.vars.mechFrozen) return
    const t = findTarget(w, me.target), v = me.vel, dt = w.dt
    const prev: Vec3 = [e.pos[0], e.pos[1], e.pos[2]]
    for (let k = 0; k < 3; k++) e.pos[k] += v[k] * dt
    me.life -= dt
    let dead = me.life <= 0
    if (!dead && t && w.vars.mechHostile && hpOf(t) > 0 && (segmentDistance(chestOf(t), prev, e.pos) < 0.45 || segmentDistance(eyeOf(t), prev, e.pos) < 0.3)) {
      damage(w, t, me.damage, e)
      dead = true
    }
    if (!dead && w.raycast(prev, v, Math.hypot(v[0], v[1], v[2]) * dt, { layers: me.layers })) dead = true
    if (dead) w.destroy(e)
  },
  view: boltView,
})

/** 爆炸火球：只有表现，寿命由系统 lifetime 管 */
export const mechBoom = defineBlock({
  name: 'mechBoom',
  about: '机甲爆炸火球（只是表现，配 lifetime）',
  order: 2,
  view: boomView,
})

export const mechBlocks = [mechFoe, mechGull, mechHound, mechBolt, mechBoom]

export const mechPrefabs = [
  definePrefab('gull', { tags: ['enemy'], about: '机械飞鸥', mechFoe: { kind: 'gull' }, mechGull: true, health: true }),
  definePrefab('hound', { tags: ['enemy'], about: '机械猎犬', mechFoe: { kind: 'hound' }, mechHound: true, health: true }),
  definePrefab('bolt', { about: '机甲弹道', mechBolt: true }),
  definePrefab('boom', { about: '机甲爆炸火球', mechBoom: true, lifetime: { seconds: 0.6 } }),
]

/** 命中结果：不是机甲部件或机甲已在倒下时 mechHit 返回 null */
export interface MechHit {
  entity: any
  kind: EnemyType
  weak: boolean
  killed: boolean
  pos: Vec3
  damage: number
}

/**
 * 子弹打中模型部件：按部件找到机甲，弱点乘 weakMul 后扣血、闪白；
 * 给了 dir（射击方向）时做受击动画、飞鸥被打退；没在交战时转入交战；血量见底时倒下。
 */
export function mechHit(w: any, part: number, dmg: number, dir?: Vec3, weakMul = 2): MechHit | null {
  const owner = partOwner(w, part)
  const e = owner && w.get(owner.id), f = e?.b.mechFoe
  if (!owner || !f || f.mode === 'dying') return null
  const n = dmg * (owner.weak ? weakMul : 1)
  damage(w, e, n)
  f.flash = 0.08
  if (dir) {
    f.hits++
    f.hitDmg = n
    f.hitDir = [...dir] as Vec3
    f.hitWeak = owner.weak
    // 原版：飞鸥被打退 min(3, dmg·.09)
    if (f.kind === 'gull') {
      const k = Math.min(3, n * 0.09)
      for (let i = 0; i < 3; i++) f.vel[i] += dir[i] * k
    }
  }
  const t = findTarget(w, f.target)
  if (t && f.mode !== 'combat') enterCombat(f, e, w, t.pos)
  const killed = !(e.b.health?.hp > 0)
  if (killed) die(f, w, dir)
  return { entity: e, kind: f.kind, weak: owner.weak, killed, pos: [...e.pos] as Vec3, damage: n }
}

/** 听到 pos 处的声响（如枪声）：听觉半径内、不在交战的机甲转去搜索 */
export function mechHear(w: any, pos: Vec3) {
  for (const e of w.query()) {
    const f = e.b.mechFoe
    if (!f || f.mode === 'dying' || f.mode === 'combat' || dist(e.pos, pos) >= f.sense.hear) continue
    f.mode = 'search'
    f.lastKnown = [...pos] as Vec3
    f.searchT = f.sense.search
  }
}

/** 清空机甲、弹道与爆炸（销毁在本步末尾生效），令牌间隔归零 */
export function mechClear(w: any) {
  for (const e of w.query()) if (e.b.mechFoe || e.b.mechBolt || e.b.mechBoom) w.destroy(e)
  w.vars.mechTokenGap = 0
}
