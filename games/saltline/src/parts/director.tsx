/**
 * 导演（004 第 19.5 节第 6 步）：单例实体上的 slDirector 积木。
 * init 是开局布置（每次进入 flow 状态场景重建，导演实体随之新建），step 是子阶段、中继交互、波次、追击增援、撤离，
 * view 是标题镜头、切断音效与渐黑。另有两条规则：mechAlert（发现敌情）与 slKill（战绩）。
 */
import { defineBlock, type Context, type SceneArgs, type Vec3 } from '@pot/core'
import { mechClear } from '@pot/kit/mech'
import { levelPoints, type LevelData } from '@pot/kit/harbor/level'
import { catmull, dist2d, dot, forward, norm, sub, yawOf } from '@pot/kit/realistic/math'
import { sfx } from '@pot/kit/realistic/sfx'
import { foeSpawns, spawnFoe, type FoeSpawns } from './enemies'
import { findPlayer, freshSl, phaseOf, slEmit, type EnemyType, type Sl, type SubPhase } from './state'

const PROPS = {
  /** flow.json */
  flow: {} as any,
  relays: [] as { pos: Vec3; label: string }[],
  spawns: [] as { type: string; pos: Vec3 }[],
  extraction: { pos: [0, 0, 0] as Vec3, radius: 0 },
  foes: {} as FoeSpawns,
}
type Me = typeof PROPS & { pid: number }

const cutCount = (sl: Sl) => sl.relays.filter((r) => r === 'cut').length
const aliveFoes = (w: any) => w.query('enemy').filter((e: any) => e.b.mechFoe && e.b.mechFoe.mode !== 'dying').length

function setPhase(sl: Sl, phase: SubPhase) {
  sl.phase = phase
  sl.t = 0
}

function queue(sl: Sl, F: any, counts: { gull: number; hound: number }, pursuit: boolean) {
  let delay = 0
  const types: EnemyType[] = []
  for (let i = 0; i < Math.max(counts.gull, counts.hound); i++) {
    if (i < counts.hound) types.push('hound')
    if (i < counts.gull) types.push('gull')
  }
  for (const type of types) {
    sl.pending.push({ type, delay, pursuit })
    delay += F.spawnStagger
  }
}

/** 生成点评分：避开玩家近处与视野正前方，偏好中距离 */
function pickSpawn(me: Me, w: any, p: any, type: EnemyType): Vec3 {
  const kind = type === 'gull' ? 'air' : 'ground'
  let best: Vec3 = me.spawns[0].pos, score = -Infinity
  for (const sp of me.spawns) {
    if (sp.type !== kind) continue
    let sc = w.rand() * 8
    if (p) {
      const d = dist2d(sp.pos, p.pos)
      sc += d < me.flow.spawnFar ? -100 + d : 12 - Math.abs(d - 30) * 0.25
      const f = forward(p.b.moveFps.yaw)
      const to = norm(sub(sp.pos, p.pos))
      if (dot([f[0], 0, f[2]], [to[0], 0, to[2]]) > 0.8 && d < 30) sc -= 8
    }
    if (sc > score) { score = sc; best = sp.pos }
  }
  return best
}

function cutRelay(me: Me, w: any, sl: Sl, i: number) {
  const F = me.flow
  sl.relays[i] = 'cut'
  sl.interact = -1
  sl.progress = 0
  const n = cutCount(sl)
  slEmit(w, 'slMessage', `${me.relays[i].label} 已断开`)
  slEmit(w, 'slRadio', n >= me.relays.length ? F.radio.all : F.radio.cut[n - 1] ?? F.radio.cut[F.radio.cut.length - 1])
  const wave = F.waves[Math.min(n - 1, F.waves.length - 1)]
  if (wave) queue(sl, F, wave, true)
  sl.alerted = true
}

// ---- 表现（不进存档）：标题镜头时间、已播的切断数、滴答声间隔、渐黑 ----
interface Look { frame: number; time: number; dt: number; state: string; titleT: number; cut: number; tickT: number; fade: number }
const looks = new WeakMap<object, Look>()
function look(w: any): Look {
  let L = looks.get(w)
  if (!L) looks.set(w, (L = { frame: -1, time: 0, dt: 0, state: '', titleT: 0, cut: 0, tickT: 0, fade: 0 }))
  return L
}

/** 当前渐黑（0..1），hud 画 */
export const directorFade = (w: any) => looks.get(w)?.fade ?? 0

const ss = (a: number, c: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (c - a))); return t * t * (3 - 2 * t) }

export const slDirector = defineBlock<typeof PROPS, { pid: number }>({
  name: 'slDirector',
  about: 'saltline 导演：开局布置、子阶段（intro/playing/dead/complete）、中继交互、波次与追击增援、撤离；表现为标题镜头、切断音效、渐黑',
  order: 10,
  props: PROPS,
  state: { pid: -1 },

  init(me, _e, w) {
    const sl: Sl = w.vars.sl, f = w.flow
    if (f.state === 'play' && f.params.mode === 'retry') {
      sl.retries++
      sl.relays = sl.relays.map((r) => (r === 'cutting' ? 'live' : r))
    } else {
      Object.assign(sl, freshSl(me.relays.length))
    }
    if (f.state === 'title') return
    Object.assign(sl, { pending: [], interact: -1, progress: 0, hint: -1, pursuitT: 0, lowWarned: false, warnT: 0 })
    setPhase(sl, 'intro')
    w.vars.mechTokenGap = 0
    queue(sl, me.flow, me.flow.patrol, false)
    const cut = cutCount(sl)
    if (cut > 0 && cut < me.relays.length) queue(sl, me.flow, me.flow.waves[cut - 1], false)
  },

  step(me, _e, w) {
    const sl: Sl = w.vars.sl, F = me.flow, dt = w.dt
    sl.t += dt
    sl.warnT = Math.max(0, sl.warnT - dt)
    if (w.flow.state !== 'play') return
    const n = me.relays.length
    if (sl.phase === 'intro') {
      const first = sl.retries === 0 && cutCount(sl) === 0
      if (sl.t >= (first ? F.introSeconds : F.retryIntroSeconds)) {
        setPhase(sl, 'playing')
        if (first) slEmit(w, 'slRadio', F.radio.intro)
      }
      return
    }
    const p = findPlayer(w, me)
    if (sl.phase !== 'playing' || !p) return
    sl.time += dt

    // 阵亡、低血量
    const hp = p.b.health.hp
    if (hp <= 0) {
      setPhase(sl, 'dead')
      sl.interact = -1
      return
    }
    if (hp < 35 && !sl.lowWarned) {
      sl.lowWarned = true
      slEmit(w, 'slRadio', F.radio.low)
    }
    if (hp > 70) sl.lowWarned = false

    // 中继交互
    const f = forward(p.b.moveFps.yaw)
    let near = -1
    me.relays.forEach((r, i) => {
      if (sl.relays[i] === 'cut') return
      const d = dist2d(r.pos, p.pos)
      if (d > F.interactRange) return
      const to = norm([r.pos[0] - p.pos[0], 0, r.pos[2] - p.pos[2]])
      if (dot([f[0], 0, f[2]], to) < F.interactFacing) return
      if (near < 0 || d < dist2d(me.relays[near].pos, p.pos)) near = i
    })
    sl.hint = near
    if (near >= 0 && w.down('interact')) {
      if (sl.interact !== near) { sl.progress = 0; if (sl.interact >= 0 && sl.relays[sl.interact] === 'cutting') sl.relays[sl.interact] = 'live' }
      sl.interact = near
      sl.relays[near] = 'cutting'
      sl.progress += dt / F.cutSeconds
      if (sl.progress >= 1) cutRelay(me, w, sl, near)
    } else if (sl.interact >= 0) {
      if (sl.relays[sl.interact] === 'cutting') sl.relays[sl.interact] = 'live'
      sl.interact = -1
      sl.progress = 0
    }

    // 待生成队列：每步最多生成一个
    const living = aliveFoes(w)
    for (const item of sl.pending) item.delay -= dt
    if (sl.pending.length && sl.pending[0].delay <= 0 && living + 1 <= F.maxAlive) {
      const item = sl.pending.shift()!
      spawnFoe(w, me.foes, item.type, pickSpawn(me, w, p, item.type), item.pursuit)
    }

    // 追击增援
    const cut = cutCount(sl)
    if (cut > 0 && sl.pursuitSpawned < F.pursuitExtra) {
      sl.pursuitT += dt
      if (sl.pursuitT >= F.pursuitEvery) {
        sl.pursuitT = 0
        if (aliveFoes(w) + sl.pending.length < F.pursuitMinAlive) {
          const type: EnemyType = sl.pursuitSpawned % 2 === 0 ? 'gull' : 'hound'
          sl.pursuitSpawned++
          sl.pending.push({ type, delay: 0, pursuit: true })
        }
      }
    }

    // 撤离
    if (dist2d(p.pos, me.extraction.pos) < me.extraction.radius) {
      if (cut >= n) {
        setPhase(sl, 'complete')
        slEmit(w, 'slRadio', F.radio.done)
        mechClear(w)
      } else if (sl.warnT <= 0) {
        sl.warnT = 4
        slEmit(w, 'slWarn', F.extractBlocked)
      }
    }
  },

  view: {
    enter(_me, _e, _ctx, w) {
      look(w).cut = cutCount(w.vars.sl)
    },
    update(me, _e, _objs, ctx, w) {
      const L = look(w), sl: Sl = w.vars.sl, F = me.flow, c: any = ctx.clock
      if (L.frame !== c.frame) {
        L.dt = L.frame === c.frame - 1 ? Math.max(0, c.time - L.time) : 0
        L.frame = c.frame
        L.time = c.time
      }
      const dt = L.dt, ph = phaseOf(w), state = w.flow.state
      if (state !== L.state) {
        if (state === 'title') L.titleT = 0
        L.state = state
      }
      // 切断音效与切断中的滴答声
      const cut = cutCount(sl)
      if (cut > L.cut) ctx.audio.play(sfx('cut'), { volume: 0.8 })
      L.cut = cut
      if (ph === 'playing' && sl.interact >= 0 && sl.relays[sl.interact] === 'cutting') {
        L.tickT -= dt
        if (L.tickT <= 0) { L.tickT = 0.22; ctx.audio.play(sfx('cutTick'), { volume: 0.4, pitch: 1 + sl.progress * 0.6 }) }
      }
      if (ph === 'title') L.fade = titleCamera(ctx, F, L, dt, c.time)
      else if (ph === 'intro') L.fade = Math.max(0, 1 - sl.t / (sl.retries > 0 || cut > 0 ? F.retryIntroSeconds : F.introSeconds))
      else if (ph === 'dead') L.fade = Math.min(0.55, sl.t * 0.4)
      else if (ph === 'complete') L.fade = Math.min(0.6, sl.t * 0.5)
      else if (ph !== 'paused') L.fade = 0
    },
  },
})

/** 标题镜头（原版 z()）：周期 max(26, 路径长/速度)，smoothstep 混合缓动，位置与目标微晃，滚转，首尾淡入淡出；返回渐黑 */
function titleCamera(ctx: Context, F: any, L: Look, dt: number, now: number) {
  const { cinematic } = levelPoints(ctx.data.load<LevelData>('level.json'))
  const pos = cinematic.map((c) => c.pos), at = cinematic.map((c) => c.look)
  let len = 0
  for (let i = 1; i < pos.length; i++) len += Math.hypot(pos[i][0] - pos[i - 1][0], pos[i][1] - pos[i - 1][1], pos[i][2] - pos[i - 1][2])
  const V = Math.max(26, Math.max(len, 4) / F.titleSpeed)
  L.titleT += dt
  if (L.titleT >= V) L.titleT = 0
  const Y = L.titleT / V, s = Y * Y * (3 - 2 * Y) * 0.25 + Y * 0.75, J = now
  const b = catmull(pos, s), m = catmull(at, s)
  b[0] += Math.sin(J * 0.31) * 0.05; b[1] += Math.sin(J * 0.43 + 1.7) * 0.035; b[2] += Math.sin(J * 0.27 + 0.6) * 0.05
  m[1] += Math.sin(J * 0.19) * 0.12; m[0] += Math.sin(J * 0.13 + 2) * 0.2
  const cam = ctx.scene.camera
  cam.position = b
  cam.lookAt(m)
  const r = cam.rotation
  cam.rotation = [r[0], r[1], r[2] + Math.sin(J * 0.21) * 6e-3 * 180 / Math.PI]
  ctx.scene.view({ fov: F.titleFov })
  return Math.max(1 - ss(0, 1.8, L.titleT), ss(V - 1.6, V, L.titleT))
}

/** 导演实体与两条规则；属性来自 flow.json、关卡点位与 tuning.json */
export function Director({ data }: { data: SceneArgs['data'] }) {
  const flow = data.load('flow.json')
  const level = data.load<LevelData>('level.json')
  const { relays, spawns, extraction } = levelPoints(level)
  const cache = { pid: -1 }
  const alert = (w: any, ev: { pos: Vec3 }) => {
    const sl: Sl = w.vars.sl, p = findPlayer(w, cache)
    if (phaseOf(w) !== 'playing' || !p) return
    if (!sl.alerted) {
      sl.alerted = true
      slEmit(w, 'slRadio', flow.radio.contact)
    }
    const b = ((yawOf(sub(ev.pos, p.pos)) % 360) + 360) % 360
    slEmit(w, 'slWarn', `发现敌情 · ${flow.directions[Math.round(b / 45) % 8]}`)
  }
  const kill = (w: any, ev: { kind: EnemyType; weak: boolean }) => {
    const sl: Sl = w.vars.sl
    sl.stats.kills++
    if (ev.weak) sl.stats.weak++
    slEmit(w, 'slFeed', { text: `${ev.kind === 'gull' ? '机械飞鸥' : '机械猎犬'} 已摧毁`, weak: ev.weak })
  }
  return <>
    <entity key="director" tags={['director']} slDirector={{
      flow, relays: relays.map((r) => ({ pos: r.pos, label: r.label })), spawns, extraction, foes: foeSpawns(data.load('tuning.json'), level),
    }} />
    <rule on="mechAlert" do={alert} />
    <rule on="slKill" do={kill} />
  </>
}

declare module '@pot/core' {
  interface GameBlockProps {
    slDirector?: Partial<typeof PROPS> | boolean
  }
}
