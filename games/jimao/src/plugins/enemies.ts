/** 敌人：机械飞鸥（空中）与机械猎犬（地面）的 AI、弹道、攻击许可与死亡爆炸 */
import type { Context, Entity, Vec3 } from '@pot/core'
import { emit, on } from '../lib/bus'
import { LEVEL_LAYER, type LevelData } from '../lib/level'
import { angleDelta, clamp, dist, dist2d, jitter, lerp, norm, RAD, segmentDistance, sub, yawOf } from '../lib/math'
import { buildEnemy, type EnemyModel } from '../lib/models'
import { syncHound } from '../lib/hound'
import { syncGull } from '../lib/gull'
import { createMats, type Mats } from '../lib/mats'
import { levelCollision } from '../lib/physics'
import { sfx } from '../lib/sfx'
import { chestOf, ENEMIES, eyeOf, game, player, type EnemyType, type PlayerState } from '../lib/types'

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
  /** 猎犬转向角速度（度/秒） */
  yawRate?: number
  /** 飞鸥（原版 x()）：绕点角、绕飞半径、巡逻半径、换向计时、避障推力、天花板高度、探测轮转、相位、本帧加速度、冒烟计时 */
  orbitA?: number
  orbitR?: number
  patrolR?: number
  flipT?: number
  avoid?: Vec3
  ceil?: number
  ceilT?: number
  feeler?: number
  phase?: number
  acc?: Vec3
  smokeT?: number
}

interface Bolt { pos: Vec3; vel: Vec3; life: number; damage: number; type: EnemyType }

interface EnemiesState { list: Enemy[]; nextId: number; bolts: Bolt[]; tokenGap: number; booms: { pos: Vec3; t: number }[] }

export function apply(ctx: Context) {
  const tuning = ctx.data.load('tuning.json')
  const E = tuning.enemy
  const level = ctx.data.load<LevelData>('level.json')
const world = levelCollision(level, 'enemy')
  const s = ctx.state.define<EnemiesState>(ENEMIES, { version: 1, init: () => ({ list: [], nextId: 1, bolts: [], tokenGap: 0, booms: [] }) })
  const { scene } = ctx
  const rand = Math.random
  const models = new Map<number, EnemyModel>()
  const partOwner = new Map<number, { id: number; weak: boolean }>()
  /** 猎犬外壳/金属用原版 GPU 烘焙材质（没有 gfx 时退回纯色） */
  let mats: Mats | undefined
  try { mats = ctx.gfx ? createMats(ctx, { tex: tuning.quality?.tex }) : undefined } catch (err) { ctx.logger('enemies').warn('材质不可用：%s', String(err)) }
  const toThree = (v: Vec3) => ({ x: v[0], y: v[1], z: -v[2] })
  /** Unity 偏航（度，0 朝 +Z）→ 原版偏航（弧度，模型朝 +Z 的右手系） */
  const threeYaw = (yaw: number) => Math.PI - yaw * RAD

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
      m = buildEnemy(ctx, e.type, `${e.type}-${e.id}`, mats)
      models.set(e.id, m)
      for (const [part, weak] of m.parts) partOwner.set(part, { id: e.id, weak })
      m.hound?.anim.place(e.pos[0], e.pos[1], -e.pos[2], threeYaw(e.yaw))
      m.gull?.anim.place(e.pos[0], e.pos[1], -e.pos[2], threeYaw(e.yaw))
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
    if (type === 'gull') initGull(e, T)
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
    const dmg = hit.damage * (owner.weak ? tuning.weapon.weakMultiplier : 1)
    e.hp -= dmg
    e.flash = 0.08
    const p = player(ctx)
    const m = models.get(e.id)
    const dir = p ? norm(sub(hit.point, eyeOf(p))) : undefined
    if (m?.hound && dir) m.hound.anim.hit(dmg, { x: dir[0], y: dir[1], z: -dir[2] }, owner.weak)
    if (m?.gull && dir) {
      // 原版 damage：被打退 min(3, dmg·.09)，机身随机歪一下
      const k = Math.min(3, dmg * 0.09)
      e.vel[0] += dir[0] * k; e.vel[1] += dir[1] * k; e.vel[2] += dir[2] * k
      m.gull.anim.hit()
    }
    if (p && e.mode !== 'combat') enterCombat(e, p.pos)
    if (e.hp <= 0) {
      hit.killed = true
      die(e, owner.weak, dir)
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

  function die(e: Enemy, weak: boolean, dir?: Vec3) {
    releaseToken(e)
    e.mode = 'dying'
    e.dyingT = 0
    e.attack = 'idle'
    const m = models.get(e.id)
    if (m?.gull) {
      // 原版 v：随机掉一个旋翼（火花、碎片、烟），上抛 1.5，沿弹道再推 2.5，熄灯后自旋坠落
      e.vel[1] += 1.5
      if (dir) { e.vel[0] += dir[0] * 2.5; e.vel[1] += dir[1] * 2.5; e.vel[2] += dir[2] * 2.5 }
      const at = m.gull.anim.die()
      const pt: Vec3 = [at.x, at.y, -at.z]
      scene.burst({ kind: 'spark', position: pt, direction: [0, 1, 0], color: '#ffc070', intensity: 8, count: 14, speed: 5, spread: 0.8, size: 0.02, life: 0.5 })
      scene.burst({ kind: 'smoke', position: pt, direction: [0, 1, 0], color: '#3a3c3e', count: 3, speed: 0.6, spread: 0.6, size: 0.5, life: 1 })
      for (const x of m.gull.hits) x.active(false)
      m.light.intensity(0)
    }
    const h = m?.hound
    if (h) {
      h.anim.die()
      e.vel[0] *= 0.3; e.vel[2] *= 0.3
      for (const x of h.hits) x.active(false)
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
    let origin: Vec3 = [e.pos[0] + Math.sin(yawR) * mz + Math.cos(yawR) * mx, e.pos[1] + my, e.pos[2] + Math.cos(yawR) * mz - Math.sin(yawR) * mx]
    if (m.hound) {
      // 原版 z()：炮管骨骼世界位置沿目标方向前推 .43
      const g = m.hound.anim.gunPos
      const o: Vec3 = [g.x, g.y, -g.z]
      const dir = norm(sub(target, o))
      origin = [o[0] + dir[0] * 0.43, o[1] + dir[1] * 0.43, o[2] + dir[2] * 0.43]
      m.hound.anim.fired()
    }
    const d = dist(origin, target)
    const spread = lerp(T.spreadNear, T.spreadFar, clamp(d / T.fireRange, 0, 1))
    const dir = jitter(norm(sub(target, origin)), spread, rand)
    if (m.gull) { e.vel[0] -= dir[0] * 0.35; e.vel[1] -= dir[1] * 0.35; e.vel[2] -= dir[2] * 0.35 }
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
    if (m.hound) { syncHound(m.hound); return }
    if (m.gull) { syncGull(m.gull); return }
    m.root.position = e.pos
  }

  /** 原版 _activate 中飞鸥的随机参数 */
  function initGull(e: Enemy, T: any) {
    e.orbitR = T.rangeMin + 2 + rand() * (T.rangeMax - T.rangeMin - 5)
    e.alt = T.altMin + 0.8 + rand() * (T.altMax - T.altMin - 1.6)
    e.patrolR = 4 + rand() * 5
    e.phase = rand() * 6.283
    e.orbitA = rand() * 6.283
    e.ceil = 1e9; e.ceilT = 0; e.flipT = 3 + rand() * 4; e.feeler = 0; e.avoid = [0, 0, 0]; e.acc = [0, 0, 0]; e.smokeT = 0
  }

  /** 地面/海面平面（原版 physics：x ≤ 30 为 y=0 的地坪，码头外为 y=-1.6 的海面） */
  const planeY = (x: number) => (x <= 30 ? 0 : -1.6)
  const MASK = 1 << LEVEL_LAYER

  /**
   * 飞鸥飞行（原版 x() 的移动部分，Unity 坐标；公式对 z 镜像对称）：
   * 目标点（交战绕玩家盘旋 / 搜索绕最后位置 / 巡逻绕出生点）→ PD 加速度 + 三向探测避障 → 限加速度、限速 → 逐轴碰撞 → 离地 ≥ 1.1。
   * 返回与期望朝向的夹角（度），开火要求小于 20°。
   */
  function flyGull(e: Enemy, T: any, dt: number, p: PlayerState) {
    if (e.orbitR === undefined) initGull(e, T)
    const combat = e.mode === 'combat', hurt = e.hp < T.hp * 0.5, t = e.anim, lk = e.lastKnown
    let M = T.patrolSpeed, tx: number, ty: number, tz: number
    if (combat) {
      M = T.maxSpeed
      const busy = e.attack !== 'idle'
      e.flipT! -= dt
      if (e.flipT! <= 0) {
        e.flipT = 3 + rand() * 5
        if (rand() < 0.6) e.orbit = -e.orbit
        e.orbitR = clamp(e.orbitR! + (rand() - 0.5) * 6, T.rangeMin + 1, T.rangeMax - 2)
      }
      if (e.lost > 1.5) {
        tx = lk[0]; tz = lk[2]; ty = lk[1] + e.alt + 1
        e.orbitA = Math.atan2(e.pos[2] - lk[2], e.pos[0] - lk[0])
      } else {
        e.orbitA! += e.orbit * (busy ? 0.9 : 3.6) / e.orbitR! * dt
        tx = p.pos[0] + Math.cos(e.orbitA!) * e.orbitR!; tz = p.pos[2] + Math.sin(e.orbitA!) * e.orbitR!; ty = p.pos[1] + e.alt
      }
    } else if (e.mode === 'search') {
      M = 5.5
      e.orbitA! += 0.5 * dt
      tx = lk[0] + Math.cos(e.orbitA!) * 4.5; tz = lk[2] + Math.sin(e.orbitA!) * 4.5; ty = lk[1] + Math.min(e.alt, 5.5)
    } else {
      e.orbitA! += 0.28 * dt * e.orbit
      tx = e.home[0] + Math.cos(e.orbitA!) * e.patrolR!; tz = e.home[2] + Math.sin(e.orbitA!) * e.patrolR!; ty = e.home[1]
    }
    if (ty > e.ceil!) ty = e.ceil!
    if (ty < 2.2) ty = 2.2
    const acc: Vec3 = [(tx - e.pos[0]) * 2.2 - e.vel[0] * 2.4, (ty - e.pos[1]) * 5 - e.vel[1] * 3.6, (tz - e.pos[2]) * 2.2 - e.vel[2] * 2.4]
    const av = e.avoid!
    e.feeler = (e.feeler! + 1) % 3
    const z = Math.hypot(e.vel[0], e.vel[2])
    if (e.feeler === 0 && z > 0.6) {
      const P = 2.2 + z * 0.5
      const h = scene.raycast(e.pos, [e.vel[0] / z, 0, e.vel[2] / z], { maxDistance: P, mask: MASK })
      if (h) {
        const Y = 1 - h.distance / P
        av[0] = h.normal[0] * 26 * Y; av[1] = h.normal[1] * 26 * Y + 9 * Y; av[2] = h.normal[2] * 26 * Y
        if (Y > 0.5) { e.orbit = -e.orbit; e.flipT = 2.5 }
      }
    } else if (e.feeler === 1) {
      const h = scene.raycast(e.pos, [0, -1, 0], { maxDistance: 2.4, mask: MASK })
      if (h) av[1] += (2.4 - h.distance) * 10
    } else if (e.feeler === 2) {
      e.ceilT! -= dt * 3
      if (e.ceilT! <= 0) {
        e.ceilT = 0.35
        const h = scene.raycast(e.pos, [0, 1, 0], { maxDistance: 4, mask: MASK })
        e.ceil = h ? e.pos[1] + h.distance - 1.3 : 1e9
      }
    }
    const decay = Math.exp(-6 * dt)
    for (let k = 0; k < 3; k++) { acc[k] += av[k]; av[k] *= decay }
    if (hurt) {
      acc[0] += Math.sin(t * 7.3 + e.phase!) * 5; acc[2] += Math.cos(t * 6.1 + e.phase!) * 5; acc[1] += Math.sin(t * 9.7) * 3
    }
    const H = Math.hypot(acc[0], acc[1], acc[2])
    if (H > T.accel) for (let k = 0; k < 3; k++) acc[k] *= T.accel / H
    for (let k = 0; k < 3; k++) e.vel[k] += acc[k] * dt
    const O = Math.hypot(e.vel[0], e.vel[1], e.vel[2])
    if (O > M) for (let k = 0; k < 3; k++) e.vel[k] *= M / O
    // 逐轴碰撞：撞上则反弹 .25 并记一次反向推力
    for (let k = 0; k < 3; k++) {
      const V = e.vel[k]
      if (Math.abs(V) < 0.02) continue
      const Y = V > 0 ? 1 : -1, L = k === 1 ? 0.35 : 0.62
      const dir: Vec3 = [0, 0, 0]; dir[k] = Y
      const h = scene.raycast(e.pos, dir, { maxDistance: Math.abs(V) * dt + L, mask: MASK })
      if (h) {
        e.vel[k] = -V * 0.25
        av[k] -= Y * 8
        if (h.distance < L) e.pos[k] -= Y * (L - h.distance)
      }
    }
    for (let k = 0; k < 3; k++) e.pos[k] += e.vel[k] * dt
    // 原版 groundHeight(x, z, y + .5) + 1.1
    const g = scene.raycast([e.pos[0], e.pos[1] + 0.5, e.pos[2]], [0, -1, 0], { maxDistance: 60, mask: MASK })
    const floor = Math.max(g ? g.point[1] : -Infinity, planeY(e.pos[0])) + 1.1
    if (e.pos[1] < floor) { e.pos[1] = floor; if (e.vel[1] < 0) e.vel[1] = 0 }
    // 朝向：交战/搜索时看玩家（或最后位置），否则看飞行方向；转速 3.2 rad/s
    let q = e.yaw
    if (combat || e.mode === 'search') q = yawOf(sub(combat && e.lost < 1.5 ? p.pos : lk, e.pos))
    else if (z > 0.4) q = yawOf(e.vel)
    const U = angleDelta(e.yaw, q)
    const turn = 3.2 / RAD * dt
    e.yaw += clamp(U, -turn, turn)
    e.acc = acc
    return Math.abs(U)
  }

  /** 飞鸥外观：原版姿态、旋翼、频闪、云台、镜头；血量过半冒烟 */
  function animateGull(e: Enemy, m: EnemyModel, T: any, dt: number, p: PlayerState) {
    const a = m.gull!.anim
    const combat = e.mode === 'combat', hurt = e.hp < T.hp * 0.5, acc = e.acc ?? [0, 0, 0]
    if (e.attack === 'telegraph') a.flare = Math.min(1, a.flare + dt * 4.5)
    else if (e.attack === 'burst') a.flare = 1
    a.live(dt, {
      x: e.pos[0], y: e.pos[1], z: -e.pos[2], yaw: threeYaw(e.yaw), ax: acc[0], ay: acc[1], az: -acc[2], hs: Math.hypot(e.vel[0], e.vel[2]),
      engage: combat, hurt, mode: combat ? 'engage' : e.mode === 'search' ? 'search' : 'patrol', player: toThree(p.pos), lastKnown: toThree(e.lastKnown),
    })
    if (hurt) {
      e.smokeT = (e.smokeT ?? 0) - dt
      if (e.smokeT <= 0) {
        e.smokeT = 0.16
        scene.burst({ kind: 'smoke', position: e.pos, direction: [0, 1, 0], color: '#26282c', count: 1, speed: 0.8, spread: 0.3, size: 0.3, life: 1.1 })
        if (rand() < 0.15) scene.burst({ kind: 'spark', position: e.pos, direction: [0, -1, 0], color: '#ffc070', intensity: 8, count: 2, speed: 3, spread: 0.6, size: 0.015, life: 0.3 })
      }
    }
  }

  /** 飞鸥坠毁（原版 g）：重力 9.5、水平阻尼、越转越快；撞到东西、落地/落海或 5 秒后爆炸。返回是否结束 */
  function crashGull(e: Enemy, m: EnemyModel, dt: number) {
    e.vel[1] -= 9.5 * dt
    e.vel[0] *= 1 - 0.4 * dt; e.vel[2] *= 1 - 0.4 * dt
    const b = Math.hypot(e.vel[0], e.vel[1], e.vel[2])
    let done = e.dyingT > 5 || e.pos[1] < -3
    if (!done && b > 0.01) {
      const h = scene.raycast(e.pos, [e.vel[0] / b, e.vel[1] / b, e.vel[2] / b], { maxDistance: b * dt + 0.3, mask: MASK })
      if (h) { e.pos = [h.point[0] + h.normal[0] * 0.2, h.point[1] + h.normal[1] * 0.2, h.point[2] + h.normal[2] * 0.2]; done = true }
    }
    if (!done) {
      for (let k = 0; k < 3; k++) e.pos[k] += e.vel[k] * dt
      const py = planeY(e.pos[0])
      if (e.pos[1] <= py + 0.2) { e.pos[1] = py + 0.2; done = true }
    }
    m.gull!.anim.dead(dt, e.pos[0], e.pos[1], -e.pos[2])
    e.smokeT = (e.smokeT ?? 0) - dt
    if (e.smokeT <= 0) {
      e.smokeT = 0.045
      scene.burst({ kind: 'smoke', position: e.pos, direction: [0, 1, 0], color: '#151617', count: 1, speed: 0.6, spread: 0.3, size: 0.45, life: 1.3 })
      if (rand() < 0.5) scene.burst({ kind: 'spark', position: e.pos, direction: norm([rand() - 0.5, rand(), rand() - 0.5]), color: '#ffc070', intensity: 8, count: 3, speed: 4, spread: 0.5, size: 0.015, life: 0.3 })
    }
    return done
  }

  /** 猎犬：原版步态 H、姿态 O、炮塔/头部追踪、镜头色；死亡时原版 U 的倒地 */
  function animateHound(e: Enemy, m: EnemyModel, dt: number, p: PlayerState | undefined) {
    const a = m.hound!.anim
    if (e.mode === 'dying') { a.dead(dt, e.pos[0], e.pos[1], -e.pos[2]); return }
    const combat = e.mode === 'combat'
    if (e.attack === 'telegraph') a.flare = Math.min(1, a.flare + dt * 5)
    else if (e.attack === 'burst') a.flare = 1
    a.live(dt, {
      x: e.pos[0], y: e.pos[1], z: -e.pos[2], yaw: threeYaw(e.yaw), vx: e.vel[0], vz: -e.vel[2],
      ground: e.grounded ? e.pos[1] : a.ground,
      target: combat && p ? toThree(p.pos) : null,
      look: combat && p ? toThree(p.pos) : e.mode === 'search' ? toThree(e.lastKnown) : null,
      crouch: e.attack !== 'idle' ? 0.05 : 0, engage: combat,
    })
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
          if (crashGull(e, m, dt)) {
            explode(e.pos, fighting ? T.explodeDamage : 0, T.explodeRadius)
            remove(e)
            continue
          }
        } else {
          // 原版 U：滑行减速、倒地；6.5 秒后残骸以 .22m/s 下沉 3.2 秒再回收（原版不爆炸）
          const k = Math.exp(-5 * dt)
          e.vel[0] *= k; e.vel[2] *= k
          e.pos[0] += e.vel[0] * dt; e.pos[2] += e.vel[2] * dt
          if (e.dyingT > 6.5) e.pos[1] -= 0.22 * dt
          if (e.dyingT > 9.7) { remove(e); continue }
          animateHound(e, m, dt, p)
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
      const facing = e.type !== 'gull' || Math.abs(angleDelta(e.yaw, yawOf(sub(p.pos, e.pos)))) < 20
      const inRange = e.mode === 'combat' && e.seeing && d < T.fireRange
      if (e.attack === 'idle') {
        e.cooldown -= dt
        if (inRange && facing && e.cooldown <= 0 && !e.token && tokens < maxTokens && s.tokenGap <= 0) {
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
        flyGull(e, T, dt, p)
        animateGull(e, m, T, dt, p)
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
        // 原版：机身只沿自身前方移动；期望朝向 = 速度方向（停下且交战时朝玩家），转速限 turnRate（扑击时 ×2）
        {
          const hs = Math.hypot(e.vel[0], e.vel[2])
          const want = e.lunge > 0 ? yawOf(toP) : hs > 0.3 ? yawOf(e.vel) : e.mode === 'combat' && e.seeing ? yawOf(toP) : e.yaw
          const diff = angleDelta(e.yaw, want)
          const F = clamp(diff * 6, -T.turnRate * 57.3, T.turnRate * 57.3) * (e.lunge > 0 ? 2 : 1)
          e.yawRate = (e.yawRate ?? 0) + (F - (e.yawRate ?? 0)) * (1 - Math.exp(-10 * dt))
          e.yaw += e.yawRate * dt
          const f = e.lunge > 0 ? 1 : Math.max(0, Math.cos(angleDelta(e.yaw, want) * RAD))
          e.vel[0] = Math.sin(e.yaw * RAD) * hs * f
          e.vel[2] = Math.cos(e.yaw * RAD) * hs * f
        }
        e.vel[1] -= 21 * dt
        const res = world.move({ pos: e.pos, vel: e.vel, radius: 0.45, height: 1.3, get grounded() { return e.grounded }, set grounded(v) { e.grounded = v } }, dt, 0.5)
        if (res.wall && e.detourT <= 0) { e.detour = (rand() < 0.5 ? -1 : 1) * 75; e.detourT = 0.9 }
        if (e.pos[1] < -3) { e.pos = [...e.home]; e.vel = [0, 0, 0] }
        animateHound(e, m, dt, p)
      }

      // 预警发光
      const tele = e.attack === 'telegraph' ? 0.5 + 0.5 * Math.sin(e.anim * 40) : e.attack === 'burst' ? 1 : 0
      m.glow?.color(e.flash > 0 ? '#ffffff' : tele > 0 ? '#ffd27a' : e.mode === 'combat' ? '#ff5a40' : '#ff9a70')
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
