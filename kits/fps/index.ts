/**
 * fps 套件（004 第 17.5 节）：第一人称移动、相机、生命、枪械与两个简单的 AI。
 * moveFps 逐项照搬 saltline 的玩家控制（games/saltline/src/plugins/player.ts）。
 *
 *   import fps, { damage } from '@pot/kit/fps'
 *   export default defineGame({ kits: [fps], ... })
 */
import { defineBlock, defineKit, dmath } from '@pot/core'
import type { Over, Vec3 } from '@pot/core'

// ---------------------------------------------------------------- 小工具

const DEG = Math.PI / 180
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v)
/** 指数逼近：rate 越大越快 */
const damp = (c: number, t: number, rate: number, dt: number) => t + (c - t) * Math.exp(-rate * dt)
/** 朝向（度）对应的前方单位向量。用 dmath：模拟要与原生实现逐位一致（004 第 18.7 节） */
const forward = (yaw: number, pitch = 0): Vec3 => {
  const y = yaw * DEG, p = pitch * DEG
  return [dmath.sin(y) * dmath.cos(p), -dmath.sin(p), dmath.cos(y) * dmath.cos(p)]
}
const right = (yaw: number): Vec3 => {
  const y = yaw * DEG
  return [dmath.cos(y), 0, -dmath.sin(y)]
}
/** 由整数推出的 [-0.5, 0.5) 伪随机（表现层用，不动 World 的随机序列） */
const noise = (n: number) => {
  const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453
  return s - Math.floor(s) - 0.5
}

interface Bounds {
  min: [number, number]
  max: [number, number]
}
interface Ground {
  y: number
  maxX?: number
}

const inBounds = (b: Bounds | null, x: number, z: number) => !b || (x >= b.min[0] && x <= b.max[0] && z >= b.min[1] && z <= b.max[1])
const layersOf = (layers: string[] | null) => (layers ? layers : undefined)

// ---------------------------------------------------------------- moveFps

const MOVE_PROPS = {
  walk: 3.8,
  sprint: 6.4,
  crouch: 1.9,
  ads: 2.4,
  accelGround: 34,
  decelGround: 26,
  accelAir: 9,
  gravity: 21,
  jumpApex: 1,
  coyote: 0.12,
  jumpBuffer: 0.13,
  stepUp: 0.45,
  radius: 0.32,
  height: 1.8,
  crouchHeight: 1.15,
  eye: 1.68,
  crouchEye: 1.05,
  eyeRate: 11,
  sensitivity: 1,
  adsLook: 0.6,
  invertY: false,
  pitchLimit: 86,
  stride: { walk: 1.55, sprint: 2.1, crouch: 1.05 },
  layers: null as string[] | null,
  ground: { y: 0 } as Ground | null,
  bounds: null as Bounds | null,
  fallY: null as number | null,
  actions: { move: 'move', look: 'look', jump: 'jump', sprint: 'sprint', crouch: 'crouch' },
}

const MOVE_STATE = {
  active: true,
  vel: [0, 0, 0] as Vec3,
  yaw: 0,
  pitch: 0,
  grounded: true,
  crouched: false,
  coyoteT: 0,
  buffer: 0,
  lastSafe: [0, 0, 0] as Vec3,
  curHeight: 0,
  curEye: 0,
  bob: 0,
  speed: 0,
  sprinting: false,
  landed: 0,
  aim: 0,
}

export type MoveFpsProps = typeof MOVE_PROPS
export type MoveFpsState = typeof MOVE_STATE

/** 第一人称移动：saltline 玩家控制的通用版 */
export const moveFps = defineBlock({
  name: 'moveFps',
  about: '第一人称移动：读 move、look、jump、sprint、crouch 指令，走跑蹲跳、上台阶（w.move），yaw/pitch 在状态里；aim（瞄准程度 0 到 1）由别的积木写入',
  props: MOVE_PROPS,
  state: MOVE_STATE,
  // 原生实现的布局提示（004 第 18.3 节）：缺省值推不出类型的字段
  native: {
    layers: 'layers',
    ground: { '?': { y: 'f', maxX: 'f?' } },
    bounds: { '?': { min: 'f2', max: 'f2' } },
    fallY: 'f?',
    actions: { move: 'axis', look: 'axis', jump: 'action', sprint: 'action', crouch: 'action' },
  },
  init(me, e) {
    me.yaw = e.rot?.[1] ?? 0
    me.lastSafe = [e.pos[0], e.pos[1], e.pos[2]]
    me.curHeight = me.height
    me.curEye = me.eye
  },
  step(me, e, w) {
    if (!me.active) return
    const dt = w.dt
    const cmd = w.cmd(e)
    const act = me.actions
    const ads = me.aim
    const layers = layersOf(me.layers)
    // 视角
    const look = cmd.axis(act.look)
    const k = 2 * me.sensitivity * (ads > 0.5 ? me.adsLook : 1)
    me.yaw = (me.yaw + look.x * k) % 360
    me.pitch = clamp(me.pitch - look.y * k * (me.invertY ? -1 : 1), -me.pitchLimit, me.pitchLimit)
    // 蹲伏
    if (cmd.pressed(act.crouch)) me.crouched = !me.crouched
    const targetH = me.crouched ? me.crouchHeight : me.height
    if (!me.crouched && me.curHeight < me.height - 0.01 && headBlocked(w, e, me, layers)) {
      me.crouched = true
    } else {
      me.curHeight = damp(me.curHeight, targetH, 14, dt)
    }
    me.curEye = damp(me.curEye, me.crouched ? me.crouchEye : me.eye, me.eyeRate, dt)

    // 移动
    const move = cmd.axis(act.move)
    let mx = move.x, mz = move.y
    const ml = Math.hypot(mx, mz)
    if (ml > 1) {
      mx /= ml
      mz /= ml
    }
    const wantsSprint = cmd.down(act.sprint) && mz > 0.3 && !me.crouched && ads < 0.3
    me.sprinting = wantsSprint && me.grounded
    const speed = me.crouched ? me.crouch : ads > 0.5 ? me.ads : wantsSprint ? me.sprint : me.walk
    const f = forward(me.yaw), r = right(me.yaw)
    const tx = (f[0] * mz + r[0] * mx) * speed
    const tz = (f[2] * mz + r[2] * mx) * speed
    const accel = me.grounded ? (ml > 0.01 ? me.accelGround : me.decelGround) : me.accelAir
    const v = me.vel
    const dvx = tx - v[0], dvz = tz - v[2]
    const dl = Math.hypot(dvx, dvz)
    const step = accel * dt
    if (dl <= step) {
      v[0] = tx
      v[2] = tz
    } else {
      v[0] += (dvx / dl) * step
      v[2] += (dvz / dl) * step
    }

    // 跳跃（土狼时间 + 输入缓冲）
    me.coyoteT = me.grounded ? me.coyote : Math.max(0, me.coyoteT - dt)
    me.buffer = cmd.pressed(act.jump) ? me.jumpBuffer : Math.max(0, me.buffer - dt)
    if (me.buffer > 0 && me.coyoteT > 0 && !me.crouched) {
      v[1] = Math.sqrt(2 * me.gravity * me.jumpApex)
      me.buffer = 0
      me.coyoteT = 0
      me.grounded = false
    }
    v[1] -= me.gravity * dt
    const wasAir = !me.grounded
    const fall = v[1]
    const mover = { vel: v, grounded: me.grounded }
    w.move(e, mover, { radius: me.radius, height: me.curHeight, stepUp: me.stepUp, layers, ground: me.ground ?? undefined })
    me.grounded = mover.grounded
    me.landed = me.grounded && wasAir ? -fall : 0
    // 出界、掉出世界：拉回最近的安全点
    const out = !inBounds(me.bounds, e.pos[0], e.pos[2]) || (me.fallY != null && e.pos[1] < me.fallY)
    if (out) {
      const s = me.lastSafe
      e.pos[0] = s[0]
      e.pos[1] = s[1]
      e.pos[2] = s[2]
      v[0] = v[1] = v[2] = 0
    }
    if (me.grounded && (!me.ground || e.pos[1] >= me.ground.y - 0.01) && inBounds(me.bounds, e.pos[0], e.pos[2])) {
      me.lastSafe = [e.pos[0], e.pos[1], e.pos[2]]
    }
    e.rot = [0, me.yaw, 0]

    // 步伐
    me.speed = Math.hypot(v[0], v[2])
    if (me.grounded && me.speed > 0.5) {
      const stride = me.crouched ? me.stride.crouch : me.sprinting ? me.stride.sprint : me.stride.walk
      me.bob += (me.speed / stride) * dt
    }
  },
})

/** 起身时头顶是否被挡（saltline：blocked(x, y + 0.05, z, r - 0.02, h - 0.05)） */
function headBlocked(w: any, e: any, me: MoveFpsProps & MoveFpsState, layers: string[] | undefined) {
  const r = me.radius - 0.02, h = me.height - 0.05
  const at = [e.pos[0], e.pos[1] + 0.05 + h / 2, e.pos[2]]
  return w.overlap({ kind: 'box', size: [2 * r, h, 2 * r] }, at, { layers, ignore: e, solid: true }).length > 0
}

// ---------------------------------------------------------------- cameraFps

/** 第一人称相机：跟随同一实体的 moveFps */
export const cameraFps = defineBlock({
  name: 'cameraFps',
  about: '第一人称相机：放在 moveFps 实体的眼高处，带 fov（瞄准、冲刺）、步伐摆动与震动（shake、kick 由别的积木写入）；near、far 为裁剪面（0 为不改）',
  props: { fov: 74, fovAds: 52, fovSprint: 6, bobX: 0.013, bobY: 0.024, shakeDecay: 3, lockCursor: true, near: 0, far: 0 },
  state: { active: true, shake: 0, kick: [0, 0] as [number, number] },
  step(me, _e, w) {
    me.shake = Math.max(0, me.shake - w.dt * me.shakeDecay)
  },
  view: {
    enter(me, _e, ctx) {
      if (me.lockCursor) ctx.input.cursor(true)
      if (me.near > 0 || me.far > 0) ctx.scene.view({ near: me.near > 0 ? me.near : undefined, far: me.far > 0 ? me.far : undefined })
    },
    update(me, e, _objs, ctx, w) {
      const m = e.b.moveFps as (MoveFpsProps & MoveFpsState) | undefined
      if (!m || !me.active) return
      const prev = w.prev.get(e.id)?.pos ?? e.pos
      const a = ctx.clock.fixedAlpha
      const p = [prev[0] + (e.pos[0] - prev[0]) * a, prev[1] + (e.pos[1] - prev[1]) * a, prev[2] + (e.pos[2] - prev[2]) * a]
      const ads = m.aim
      ctx.scene.view({ fov: me.fov + (me.fovAds - me.fov) * ads + (m.sprinting ? me.fovSprint : 0) })
      const amp = Math.min(1, m.speed / m.walk) * (1 - ads * 0.8) * (m.grounded ? 1 : 0)
      const bobY = Math.abs(Math.sin(m.bob * Math.PI)) * me.bobY * amp * 2 - me.bobY * amp
      const bobX = Math.sin(m.bob * Math.PI) * me.bobX * amp
      const r = right(m.yaw)
      const sx = noise(w.tick * 2) * me.shake * 0.06, sy = noise(w.tick * 2 + 1) * me.shake * 0.06
      const cam = ctx.scene.camera
      cam.position = [p[0] + r[0] * bobX, p[1] + m.curEye + bobY, p[2] + r[2] * bobX]
      cam.rotation = [m.pitch + me.kick[0] + sy * 20, m.yaw + me.kick[1] + sx * 20, me.shake * Math.sin(ctx.clock.time * 40) * 1.5]
    },
    exit(me, _e, _objs, ctx) {
      if (me.lockCursor) ctx.input.cursor(false)
    },
  },
})

// ---------------------------------------------------------------- health

export const health = defineBlock({
  name: 'health',
  about: '生命：hp 初值为 max；距最近受伤超过 regenDelay 秒后按 regen 每秒回血。扣血用套件导出的 damage(w, e, n, from)',
  props: { max: 100, regen: 0, regenDelay: 4 },
  state: { hp: 0, lastHit: -1e9 },
  order: 5,
  init(me) {
    me.hp = me.max
  },
  step(me, _e, w) {
    if (me.hp > 0 && me.hp < me.max && me.regen > 0 && w.time - me.lastHit > me.regenDelay) {
      me.hp = Math.min(me.max, me.hp + me.regen * w.dt)
    }
  },
})

/**
 * 扣血：实体没有 health 或已死时返回 false。发 damaged，hp 到 0 时再发 died；
 * payload 为 { entity, amount, from }（from 为实体 id 或 null）。died 不销毁实体。
 */
export function damage(w: any, e: any, n: number, from?: any): boolean {
  const me = e?.b?.health
  if (!me || !(me.hp > 0) || !(n > 0)) return false
  me.hp = Math.max(0, me.hp - n)
  me.lastHit = w.time
  const src = from == null ? null : typeof from === 'number' ? from : from.id ?? null
  w.emit('damaged', { entity: e, amount: n, from: src })
  if (me.hp <= 0) w.emit('died', { entity: e, amount: n, from: src })
  return true
}

// ---------------------------------------------------------------- AI

const AI_BODY = { radius: 0.3, height: 1.8, gravity: 21, stepUp: 0.3, layers: null as string[] | null, ground: { y: 0 } as Ground | null }

/** 水平走向 (x, z)：到 stop 以内停下；返回是否已到 */
function walkTo(w: any, e: any, me: any, x: number, z: number, speed: number, stop: number) {
  const dx = x - e.pos[0], dz = z - e.pos[2]
  const d = Math.hypot(dx, dz)
  const arrived = d <= stop
  if (d > 1e-6) e.rot = [0, Math.atan2(dx, dz) / DEG, 0]
  me.vel[0] = arrived ? 0 : (dx / d) * speed
  me.vel[2] = arrived ? 0 : (dz / d) * speed
  fallAndMove(w, e, me)
  return arrived
}

function fallAndMove(w: any, e: any, me: any) {
  me.vel[1] -= me.gravity * w.dt
  const mover = { vel: me.vel, grounded: me.grounded }
  w.move(e, mover, { radius: me.radius, height: me.height, stepUp: me.stepUp, layers: layersOf(me.layers), ground: me.ground ?? undefined })
  me.grounded = mover.grounded
}

export const aiChase = defineBlock({
  name: 'aiChase',
  about: '追击：range 内最近的 target（标签或预制件名），sight 时要求视线不被 solid 碰撞体挡住；看丢后走到最后看见的位置',
  props: { target: 'player', range: 12, speed: 3, stopAt: 1.5, sight: true, eye: 1.5, ...AI_BODY },
  state: { vel: [0, 0, 0] as Vec3, grounded: false, seen: false, lastSeen: null as Vec3 | null, targetId: 0 },
  order: 10,
  step(me, e, w) {
    let best: any = null
    let bestD = me.range
    for (const t of w.query(me.target)) {
      if (t.id === e.id) continue
      const d = Math.hypot(t.pos[0] - e.pos[0], t.pos[1] - e.pos[1], t.pos[2] - e.pos[2])
      if (d > bestD) continue
      if (me.sight) {
        const from = [e.pos[0], e.pos[1] + me.eye, e.pos[2]]
        const to = [t.pos[0], t.pos[1] + me.eye, t.pos[2]]
        const dir = [to[0] - from[0], to[1] - from[1], to[2] - from[2]]
        const len = Math.hypot(dir[0], dir[1], dir[2])
        const hit = len > 0 ? w.raycast(from, dir, len, { ignore: e, solid: true, layers: layersOf(me.layers) }) : null
        if (hit && hit.entity.id !== t.id) continue
      }
      best = t
      bestD = d
    }
    me.seen = !!best
    me.targetId = best ? best.id : 0
    if (best) me.lastSeen = [best.pos[0], best.pos[1], best.pos[2]]
    if (me.lastSeen) {
      const arrived = walkTo(w, e, me, me.lastSeen[0], me.lastSeen[2], me.speed, me.stopAt)
      if (arrived && !best) me.lastSeen = null
      return
    }
    // 闲着：有 aiPatrol 时让它走，否则原地（只受重力）
    if (e.b.aiPatrol) return
    me.vel[0] = me.vel[2] = 0
    fallAndMove(w, e, me)
  },
})

export const aiPatrol = defineBlock({
  name: 'aiPatrol',
  about: '巡逻：按 points 顺序走，到点停 wait 秒；loop 为 false 时到头折返。同一实体的 aiChase 在追时让出',
  props: { points: [] as Vec3[], speed: 2, wait: 1, loop: true, arrive: 0.2, ...AI_BODY },
  state: { vel: [0, 0, 0] as Vec3, grounded: false, index: 0, dirn: 1, waitT: 0 },
  order: 11,
  step(me, e, w) {
    const chase = e.b.aiChase
    if (chase && (chase.seen || chase.lastSeen)) return
    const pts = me.points
    if (!pts.length) {
      me.vel[0] = me.vel[2] = 0
      fallAndMove(w, e, me)
      return
    }
    if (me.waitT > 0) {
      me.waitT = Math.max(0, me.waitT - w.dt)
      me.vel[0] = me.vel[2] = 0
      fallAndMove(w, e, me)
      return
    }
    const i = clamp(me.index, 0, pts.length - 1)
    const p = pts[i]
    if (walkTo(w, e, me, p[0], p[2], me.speed, me.arrive)) {
      me.waitT = me.wait
      if (pts.length === 1) return
      if (me.loop) me.index = (i + 1) % pts.length
      else {
        if (i + me.dirn < 0 || i + me.dirn >= pts.length) me.dirn = -me.dirn
        me.index = i + me.dirn
      }
    }
  },
})

// ---------------------------------------------------------------- gunFps

const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const norm3 = (v: number[]): Vec3 => {
  const l = Math.hypot(v[0], v[1], v[2]) || 1
  return [v[0] / l, v[1] / l, v[2] / l]
}
const cross3 = (a: number[], b: number[]): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
/** 在 dir 周围半角 spread（弧度）的锥内随机偏转；r 在圆盘上均匀（与 saltline 原版的 jitter 相同，三角函数用 dmath） */
function jitter(dir: Vec3, spread: number, rand: () => number): Vec3 {
  const a = rand() * Math.PI * 2
  const r = Math.sqrt(rand()) * spread
  const up = Math.abs(dir[1]) > 0.95 ? [1, 0, 0] : [0, 1, 0]
  const u = norm3(cross3(dir, up))
  const v = cross3(u, dir)
  const ca = dmath.cos(a), sa = dmath.sin(a)
  return norm3([dir[0] + (u[0] * ca + v[0] * sa) * r, dir[1] + (u[1] * ca + v[1] * sa) * r, dir[2] + (u[2] * ca + v[2] * sa) * r])
}

const GUN_PROPS = {
  magSize: 30,
  reserveStart: 150,
  rpm: 720,
  damage: 26,
  weakMultiplier: 2,
  range: 300,
  /** 腰射散布（弧度） */
  spreadHip: 0.0125,
  spreadAds: 0.0025,
  spreadMove: 0.02,
  bloomPerShot: 0.004,
  bloomMax: 0.03,
  recoilPitch: 0.55,
  recoilYaw: 0.22,
  recoilRecover: 6.5,
  adsTime: 0.18,
  reloadTactical: 2.1,
  reloadEmpty: 2.72,
  /** 换弹进行到这一刻补进子弹 */
  reloadMagIn: 1.345,
  /** 空仓换弹进行到这一刻枪机复位 */
  reloadBolt: 2.19,
  /** 命中判定：world 用模拟侧碰撞体（当步发 gunHit）；view 用表现层的场景射线与 w.view 的部件登记，经 emitUI 回写 */
  hitscan: 'world' as 'world' | 'view',
  layers: null as string[] | null,
  viewMask: 0,
  viewPlanes: null as any[] | null,
  actions: { fire: 'fire', aim: 'aim', reload: 'reload' },
}

/** 最近的一发：k 发序号，o 起点，d 方向，r 已报告命中 */
export interface GunShot {
  k: number
  o: Vec3
  d: Vec3
  r?: number
}

const GUN_STATE = {
  active: true,
  mag: 0,
  reserve: 0,
  reloading: false,
  reloadT: 0,
  reloadTotal: 0,
  /** 开镜程度 0 到 1 */
  ads: 0,
  cooldown: 0,
  bloom: 0,
  recoilP: 0,
  recoilY: 0,
  /** 当前散布（弧度），给准星用 */
  spread: 0,
  /** 冲刺收枪程度 0 到 1 */
  sprintT: 0,
  /** 这一步扣着扳机（表现用：扳机手指、姿态） */
  trigger: false,
  /** 打空后枪机停在后方，空仓换弹拉机柄后复位 */
  boltLocked: false,
  /** 计数：开火、空仓扣扳机、开始换弹（表现按变化放声音与动画） */
  shots: 0,
  dry: 0,
  reloads: 0,
  fired: [] as GunShot[],
}

export type GunFpsProps = typeof GUN_PROPS
export type GunFpsState = typeof GUN_STATE
type Gun = GunFpsProps & GunFpsState

/** 命中事件 gunHit 的载荷；fps 只报告，不扣血 */
export interface GunHit {
  entity: any
  target: any
  weak: boolean
  point: Vec3
  normal: Vec3
  dir: Vec3
  /** 已乘弱点倍率 */
  damage: number
  shot: number
}

const RING = 8

function startReload(me: Gun) {
  if (me.reloading || me.mag >= me.magSize || me.reserve <= 0) return
  me.reloading = true
  me.reloadTotal = me.mag === 0 ? me.reloadEmpty : me.reloadTactical
  me.reloadT = 0
  me.reloads++
}

/** 枪：弹匣、射速、散布与后坐、开镜、换弹；开火发 gunFired，命中发 gunHit（不扣血） */
export const gunFps = defineBlock({
  name: 'gunFps',
  about: '第一人称枪械：读 fire、aim、reload 指令；弹匣、射速、散布、后坐、开镜、换弹。每发 w.emit("gunFired", { entity, origin, dir, shot })；命中 w.emit("gunHit", { entity, target, weak, point, normal, dir, damage, shot })，扣血交给接收方。写同一实体的 moveFps.aim 与 cameraFps.kick',
  props: GUN_PROPS,
  state: GUN_STATE,
  order: 2,
  init(me) {
    me.mag = me.magSize
    me.reserve = me.reserveStart
  },
  step(me, e, w) {
    const dt = w.dt
    const m = e.b.moveFps as (MoveFpsProps & MoveFpsState) | undefined
    const hp = e.b.health
    if (!me.active || (hp && !(hp.hp > 0))) {
      me.trigger = false
      me.ads = Math.max(0, me.ads - dt / me.adsTime)
      writeBack(me, e)
      return
    }
    const cmd = w.cmd(e)
    const act = me.actions
    const trigger = (me.trigger = cmd.down(act.fire))
    const sprinting = !!m?.sprinting
    const wantAds = cmd.down(act.aim) && !sprinting
    me.ads = clamp(me.ads + ((wantAds && !me.reloading ? 1 : -1) * dt) / me.adsTime, 0, 1)
    me.sprintT = damp(me.sprintT, sprinting && !trigger && !wantAds && !me.reloading ? 1 : 0, 9, dt)
    if (cmd.pressed(act.reload)) startReload(me)
    if (me.reloading) {
      const before = me.reloadT
      const t = (me.reloadT += dt)
      const empty = me.reloadTotal === me.reloadEmpty
      if (before < me.reloadMagIn && t >= me.reloadMagIn) {
        const take = Math.min(me.magSize - me.mag, me.reserve)
        me.mag += take
        me.reserve -= take
        if (!empty) me.boltLocked = false
      }
      if (empty && before < me.reloadBolt && t >= me.reloadBolt) me.boltLocked = false
      if (t >= me.reloadTotal) me.reloading = false
    }
    // 射击
    const moving = (m?.speed ?? 0) > 1
    me.cooldown = Math.max(-0.02, me.cooldown - dt)
    if (trigger && !me.reloading) {
      if (me.mag <= 0) {
        if (cmd.pressed(act.fire)) me.dry++
        if (me.reserve > 0) startReload(me)
      } else {
        if (m) m.sprinting = false
        const eye = m ? m.curEye : 1.6
        const yaw = m ? m.yaw : e.rot[1]
        const pitch = m ? m.pitch : 0
        let n = 0
        while (me.cooldown <= 0 && me.mag > 0 && n++ < 3) fire(me, e, w, [e.pos[0], e.pos[1] + eye, e.pos[2]], yaw + me.recoilY, pitch + me.recoilP, moving)
      }
    }
    if (!trigger) me.cooldown = Math.max(0, me.cooldown)
    // 散布、后坐回复
    me.bloom = Math.max(0, me.bloom - dt * (trigger ? 0.02 : 0.08))
    me.spread = baseSpread(me, moving)
    if (!trigger) {
      me.recoilP = damp(me.recoilP, 0, me.recoilRecover, dt)
      me.recoilY = damp(me.recoilY, 0, me.recoilRecover, dt)
    }
    writeBack(me, e)
  },
  view: {
    enter(me, e) {
      reported.set(e.id, me.shots)
    },
    update(me, e, _objs, ctx, w) {
      if (me.hitscan !== 'view') return
      const last = reported.get(e.id) ?? me.shots
      if (me.shots === last) return
      reported.set(e.id, me.shots)
      for (const s of me.fired) {
        if (s.k <= last || s.r) continue
        const hit = ctx.scene.raycast(s.o, s.d, { maxDistance: me.range, mask: me.viewMask, planes: me.viewPlanes ?? undefined })
        const part = hit && hit.id > 0 ? w.view.partOf(hit.id) : null
        if (!part || part.entity.id === e.id) continue
        w.emitUI('gunReport', { entity: e.id, shot: s.k, target: part.entity.id, weak: part.tag === 'weak', point: hit!.point, normal: hit!.normal })
      }
    },
    exit(_me, e) {
      reported.delete(e.id)
    },
  },
})

/** gunFps.view 已检查到的发序号（表现缓存，按实体 id） */
const reported = new Map<number, number>()

function baseSpread(me: Gun, moving: boolean) {
  return lerp(me.spreadHip, me.spreadAds, me.ads) + (moving ? me.spreadMove * (1 - me.ads * 0.7) : 0) + me.bloom
}

function writeBack(me: Gun, e: any) {
  const m = e.b.moveFps
  if (m) m.aim = me.ads
  const cam = e.b.cameraFps
  if (cam) cam.kick = [me.recoilP, me.recoilY]
}

function fire(me: Gun, e: any, w: any, origin: Vec3, yaw: number, pitch: number, moving: boolean) {
  me.mag--
  me.cooldown += 60 / me.rpm
  const dir = jitter(forward(yaw, pitch), baseSpread(me, moving), () => w.rand())
  me.bloom = Math.min(me.bloomMax, me.bloom + me.bloomPerShot)
  me.recoilP = Math.max(-10, me.recoilP - me.recoilPitch * (1 - me.ads * 0.35))
  me.recoilY += (w.rand() - 0.5) * 2 * me.recoilYaw
  if (me.mag <= 0) me.boltLocked = true
  const k = ++me.shots
  const shot: GunShot = { k, o: origin, d: dir }
  me.fired.push(shot)
  if (me.fired.length > RING) me.fired.splice(0, me.fired.length - RING)
  w.emit('gunFired', { entity: e, origin, dir, shot: k })
  if (me.hitscan !== 'world') return
  const hit = w.raycast(origin, dir, me.range, { layers: layersOf(me.layers), ignore: e })
  if (!hit?.entity) return
  shot.r = 1
  w.emit('gunHit', { entity: e, target: hit.entity, weak: false, point: hit.point, normal: hit.normal, dir, damage: me.damage, shot: k } satisfies GunHit)
}

/** view 模式的命中回写（emitUI 进指令与录像）：校验后转成 gunHit */
function onGunReport(w: any, p: any) {
  if (!p || typeof p !== 'object') return
  const shooter = w.get(p.entity)
  const me = shooter?.b?.gunFps as Gun | undefined
  if (!me) return
  const hp = shooter.b.health
  if (hp && !(hp.hp > 0)) return
  const shot = me.fired.find((s) => s.k === p.shot)
  if (!shot || shot.r) return
  const target = w.get(p.target)
  if (!target || target.id === shooter.id) return
  const pt = p.point, nm = p.normal
  const vec = (v: any) => Array.isArray(v) && v.length === 3 && v.every((x: any) => typeof x === 'number' && Number.isFinite(x))
  if (!vec(pt) || !vec(nm)) return
  const dx = pt[0] - shot.o[0], dy = pt[1] - shot.o[1], dz = pt[2] - shot.o[2]
  if (Math.hypot(dx, dy, dz) > me.range + 1e-3) return
  shot.r = 1
  const weak = !!p.weak
  w.emit('gunHit', { entity: shooter, target, weak, point: [pt[0], pt[1], pt[2]], normal: [nm[0], nm[1], nm[2]], dir: norm3([dx, dy, dz]), damage: me.damage * (weak ? me.weakMultiplier : 1), shot: shot.k } satisfies GunHit)
}

declare module '@pot/core' {
  interface GameBlockProps {
    moveFps?: Over<typeof MOVE_PROPS>
    cameraFps?: Over<{ fov: number; fovAds: number; fovSprint: number; bobX: number; bobY: number; shakeDecay: number; lockCursor: boolean; near: number; far: number }>
    health?: Over<{ max: number; regen: number; regenDelay: number }>
    aiChase?: Over<{ target: string; range: number; speed: number; stopAt: number; sight: boolean; eye: number } & typeof AI_BODY>
    aiPatrol?: Over<{ points: Vec3[]; speed: number; wait: number; loop: boolean; arrive: number } & typeof AI_BODY>
    gunFps?: Over<typeof GUN_PROPS>
  }
}

export default defineKit({
  name: 'fps',
  about: '第一人称：moveFps、cameraFps、health（配 damage 函数）、gunFps（开火 gunFired、命中 gunHit）、aiChase、aiPatrol',
  blocks: [moveFps, cameraFps, health, gunFps, aiChase, aiPatrol],
  controls: {
    axes: { move: 'move', look: 'look' },
    actions: { jump: ['space'], sprint: ['leftshift'], crouch: ['c', 'leftcontrol'], fire: ['mouse0'], aim: ['mouse1'], reload: ['r'] },
  },
  on: { gunReport: onGunReport },
})
