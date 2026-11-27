/**
 * 机甲的表现（积木的 view）：按实体建、拆模型，驱动原版动画与特效，弹道与爆炸的场景对象。
 * 变换都自己管（enter 不返回对象）：模型由动画器摆放，弹道要朝飞行方向，爆炸要按寿命缩放。
 * 记录按 World 分开存（WeakMap），只是表现的缓存，不进存档。
 */
import type { Context, Vec3, World, EntityData } from '@pot/core'
import { createMats, type Mats } from '@pot/kit/realistic/mats'
import { registerSfx, sfx } from '@pot/kit/realistic/sfx'
import { norm, RAD } from '@pot/kit/realistic/math'
import { buildEnemy, type EnemyModel } from './models'
import { syncHound } from './hound'
import { syncGull } from './gull'
import { findTarget } from './target'

/** 每个敌人的表现记录：上次看到的开火步号、受击次数、攻击阶段，用来触发一次性的动画与音效 */
interface Look { m: EnemyModel; dead: boolean; fired: number; hits: number; attack: string; smokeT: number }
interface Fx { o: any; l?: any }
interface Store {
  looks: Map<number, Look>
  fx: Map<number, Fx>
  mats?: Mats
  matsTried: boolean
  frame: number
  time: number
  dt: number
}

const stores = new WeakMap<object, Store>()

function store(w: World): Store {
  let S = stores.get(w)
  if (!S) stores.set(w, (S = { looks: new Map(), fx: new Map(), matsTried: false, frame: -1, time: 0, dt: 0 }))
  return S
}

/** 猎犬外壳、金属用原版 GPU 烘焙材质（没有 gfx 后端时退回纯色）；每个 World 只建一次 */
function mats(S: Store, ctx: Context) {
  if (!S.matsTried) {
    S.matsTried = true
    try {
      S.mats = ctx.gfx.supported ? createMats(ctx, {}) : undefined
    } catch (err) {
      S.mats = undefined
      ctx.logger('mech').warn('材质不可用：%s', String(err))
    }
  }
  return S.mats
}

/** 本帧的帧间隔：clock 只有 time 与 frame，按上一帧记下的值算；隔了帧（或第一帧）为 0 */
function frameDt(S: Store, ctx: Context) {
  const c: any = ctx.clock
  if (S.frame !== c.frame) {
    S.dt = S.frame === c.frame - 1 ? Math.max(0, c.time - S.time) : 0
    S.frame = c.frame
    S.time = c.time
  }
  return S.dt
}

/** 固定步之间按插值取位置 */
function at(w: World, e: EntityData, a: number): Vec3 {
  const q = w.prev.get(e.id)?.pos ?? e.pos
  return [q[0] + (e.pos[0] - q[0]) * a, q[1] + (e.pos[1] - q[1]) * a, q[2] + (e.pos[2] - q[2]) * a]
}

const toThree = (v: Vec3) => ({ x: v[0], y: v[1], z: -v[2] })
/** Unity 偏航（度，0 朝 +Z）→ 原版偏航（弧度，模型朝 +Z 的右手系） */
const threeYaw = (yaw: number) => Math.PI - yaw * RAD

/** 死亡的表现：飞鸥随机掉一个旋翼（火花、烟）并熄灯，猎犬倒地；命中盒都关掉 */
function dieFx(L: Look, ctx: Context) {
  const m = L.m
  if (m.gull) {
    const a = m.gull.anim.die()
    const pt: Vec3 = [a.x, a.y, -a.z]
    ctx.scene.burst({ kind: 'spark', position: pt, direction: [0, 1, 0], color: '#ffc070', intensity: 8, count: 14, speed: 5, spread: 0.8, size: 0.02, life: 0.5 })
    ctx.scene.burst({ kind: 'smoke', position: pt, direction: [0, 1, 0], color: '#3a3c3e', count: 3, speed: 0.6, spread: 0.6, size: 0.5, life: 1 })
    for (const x of m.gull.hits) x.active(false)
    m.light.intensity(0)
  }
  if (m.hound) {
    m.hound.anim.die()
    for (const x of m.hound.hits) x.active(false)
  }
}

/** 飞鸥外观：原版姿态、旋翼、频闪、云台、镜头；血量过半冒烟；坠落时拖黑烟 */
function animateGull(L: Look, e: EntityData, f: any, pos: Vec3, dt: number, t: EntityData, ctx: Context) {
  const a = L.m.gull!.anim, scene = ctx.scene
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
  const combat = f.mode === 'combat', h = e.b.health, hurt = !!h && h.hp < h.max * 0.5, acc: Vec3 = e.b.mechGull?.acc ?? [0, 0, 0]
  if (f.attack === 'telegraph') a.flare = Math.min(1, a.flare + dt * 4.5)
  else if (f.attack === 'burst') a.flare = 1
  a.live(dt, {
    x: pos[0], y: pos[1], z: -pos[2], yaw: threeYaw(f.yaw), ax: acc[0], ay: acc[1], az: -acc[2], hs: Math.hypot(f.vel[0], f.vel[2]),
    engage: combat, hurt, mode: combat ? 'engage' : f.mode === 'search' ? 'search' : 'patrol', player: toThree(t.pos), lastKnown: toThree(f.lastKnown),
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

/** 猎犬：原版步态、姿态、炮塔/头部追踪、镜头色；死亡时原版的倒地 */
function animateHound(L: Look, e: EntityData, f: any, pos: Vec3, dt: number, t: EntityData) {
  const a = L.m.hound!.anim
  if (f.mode === 'dying') { a.dead(dt, pos[0], pos[1], -pos[2]); return }
  if (L.fired !== f.fired) { L.fired = f.fired; a.fired() }
  const combat = f.mode === 'combat'
  if (f.attack === 'telegraph') a.flare = Math.min(1, a.flare + dt * 5)
  else if (f.attack === 'burst') a.flare = 1
  a.live(dt, {
    x: pos[0], y: pos[1], z: -pos[2], yaw: threeYaw(f.yaw), vx: f.vel[0], vz: -f.vel[2],
    ground: e.b.mechHound?.grounded ? pos[1] : a.ground,
    target: combat ? toThree(t.pos) : null,
    look: combat ? toThree(t.pos) : f.mode === 'search' ? toThree(f.lastKnown) : null,
    crouch: f.attack !== 'idle' ? 0.05 : 0, engage: combat,
  })
}

/** mechFoe 的表现 */
export const foeView = {
  enter(f: any, e: EntityData, ctx: Context, w: World) {
    registerSfx(ctx)
    const S = store(w)
    const m = buildEnemy(ctx, f.kind, `${f.kind}-${e.id}`, mats(S, ctx))
    // 命中体登记到实体上（w.view.partOf 查，弱点 tag 为 weak），表现退出时自动注销
    for (const [part, weak] of m.parts) w.view.bindPart(part, e.id, weak ? 'weak' : 'body')
    m.hound?.anim.place(e.pos[0], e.pos[1], -e.pos[2], threeYaw(f.yaw))
    m.gull?.anim.place(e.pos[0], e.pos[1], -e.pos[2], threeYaw(f.yaw))
    S.looks.set(e.id, { m, dead: false, fired: f.fired, hits: f.hits, attack: f.attack, smokeT: 0 })
  },
  update(f: any, e: EntityData, _objs: any, ctx: Context, w: World) {
    const S = store(w), dt = frameDt(S, ctx), L = S.looks.get(e.id)
    const t = findTarget(w, f.target)
    if (!L || w.vars.mechFrozen || w.overlayActive || !t) return
    const m = L.m
    // 受击（mechHit 记下的次数变了）：猎犬按伤害与方向晃动，飞鸥机身随机歪一下
    if (L.hits !== f.hits) {
      L.hits = f.hits
      const d: Vec3 = f.hitDir
      if (m.hound) m.hound.anim.hit(f.hitDmg, { x: d[0], y: d[1], z: -d[2] }, f.hitWeak)
      else m.gull?.anim.hit()
    }
    if (f.mode === 'dying' && !L.dead) { L.dead = true; dieFx(L, ctx) }
    if (f.attack !== L.attack) {
      if (f.attack === 'telegraph') ctx.audio.play(sfx('telegraph'), { volume: 0.5, position: [...e.pos] as Vec3, pitch: f.kind === 'gull' ? 1.2 : 0.8 })
      L.attack = f.attack
    }
    const pos = at(w, e, ctx.clock.fixedAlpha)
    if (m.gull) animateGull(L, e, f, pos, dt, t, ctx)
    else animateHound(L, e, f, pos, dt, t)
    if (f.mode !== 'dying') {
      // 预警发光
      const tele = f.attack === 'telegraph' ? 0.5 + 0.5 * Math.sin(f.anim * 40) : f.attack === 'burst' ? 1 : 0
      m.glow?.color(f.flash > 0 ? '#ffffff' : tele > 0 ? '#ffd27a' : f.mode === 'combat' ? '#ff5a40' : '#ff9a70')
      m.light.intensity(0.4 + tele * 2.5)
    }
    if (m.hound) syncHound(m.hound)
    else if (m.gull) syncGull(m.gull)
  },
  exit(_f: any, e: EntityData, _objs: any, _ctx: Context, w: World) {
    const S = store(w), L = S.looks.get(e.id)
    if (!L) return
    L.m.root.destroy()
    S.looks.delete(e.id)
  },
}

function drop(w: World, id: number) {
  const S = store(w), x = S.fx.get(id)
  if (!x) return
  S.fx.delete(id)
  try {
    x.l?.destroy()
    x.o.destroy()
  } catch {
    // 已被别处销毁
  }
}

/** mechBolt 的表现：发光胶囊朝飞行方向，出现时播开火声 */
export const boltView = {
  enter(b: any, e: EntityData, ctx: Context, w: World) {
    registerSfx(ctx)
    const o = ctx.scene.spawn({ shape: 'capsule', name: 'bolt', scale: [0.09, 0.32, 0.09], color: b.kind === 'gull' ? '#ff6a40' : '#ffb347', material: { mode: 'additive', shadows: false }, collider: false } as any)
    o.position = [...e.pos] as Vec3
    store(w).fx.set(e.id, { o })
    ctx.audio.play(sfx(b.kind === 'gull' ? 'bolt' : 'houndShot'), { volume: 0.6, position: [...e.pos] as Vec3, pitch: b.pitch })
  },
  update(b: any, e: EntityData, _objs: any, ctx: Context, w: World) {
    const x = store(w).fx.get(e.id)
    if (!x || w.vars.mechFrozen || w.overlayActive) return
    const o = x.o, v = b.vel, pos = at(w, e, ctx.clock.fixedAlpha)
    o.position = pos
    o.lookAt([pos[0] + v[0], pos[1] + v[1], pos[2] + v[2]])
    o.localRotation = [o.localRotation[0] + 90, o.localRotation[1], o.localRotation[2]]
  },
  exit(_b: any, e: EntityData, _objs: any, _ctx: Context, w: World) {
    drop(w, e.id)
  },
}

/** mechBoom 的表现：火球按寿命胀大变淡，点光源随之熄灭；出现时播爆炸声 */
export const boomView = {
  enter(_b: any, e: EntityData, ctx: Context, w: World) {
    registerSfx(ctx)
    const o = ctx.scene.spawn({ shape: 'sphere', name: 'boom', color: '#ffb347', material: { mode: 'additive', shadows: false }, collider: false } as any)
    o.position = [...e.pos] as Vec3
    o.scale = [0.6, 0.6, 0.6]
    const l = ctx.scene.light({ type: 'point', name: 'boom-light', parent: o, intensity: 6, range: 12, color: '#ff9a40' })
    store(w).fx.set(e.id, { o, l })
    ctx.audio.play(sfx('explode'), { volume: 0.9, position: [...e.pos] as Vec3 })
  },
  update(_b: any, e: EntityData, _objs: any, _ctx: Context, w: World) {
    const x = store(w).fx.get(e.id)
    if (!x || w.vars.mechFrozen || w.overlayActive) return
    const lt = e.b.lifetime
    const k = Math.min(1, (lt?.age ?? 0) / (lt?.seconds ?? 0.6))
    const r = 0.6 + k * 5
    x.o.position = e.pos
    x.o.scale = [r, r, r]
    x.o.color(`#ffb347${Math.round((1 - k) * 200).toString(16).padStart(2, '0')}`)
    x.l.intensity((1 - k) * 6)
  },
  exit(_b: any, e: EntityData, _objs: any, _ctx: Context, w: World) {
    drop(w, e.id)
  },
}
