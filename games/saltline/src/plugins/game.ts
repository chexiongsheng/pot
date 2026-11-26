/** 游戏入口：挂载各单元，负责阶段状态机、标题镜头、中继交互、波次生成、撤离与评级 */
import type { Context, Vec3 } from '@pot/core'
import { emit, on } from '../lib/bus'
import { levelPoints, type LevelData } from '@pot/kit/harbor/level'
import { catmull, dist2d, dot, forward, norm, sub, yawOf } from '@pot/kit/realistic/math'
import { sfx } from '@pot/kit/realistic/sfx'
import { foes, GAME, player, type EnemyType, type GameState, type Phase } from '../lib/types'

export const name = 'game'

export async function apply(ctx: Context) {
  const flow = ctx.data.load('flow.json')
  const level = ctx.data.load<LevelData>('level.json')
  const points = levelPoints(level)
  const relayCount = points.relays.length

  const fresh = (settings?: GameState['settings']): GameState => ({
    phase: 'title', resume: 'playing', phaseTime: 0, time: 0, retries: 0,
    relays: points.relays.map(() => 'live'), interact: -1, progress: 0, hint: -1, alerted: false,
    stats: { shots: 0, hits: 0, kills: 0, weak: 0 },
    settings: settings ?? { sensitivity: 1, invertY: false, volume: 0.8, fov: 74, quality: 2 },
    panel: '', fade: 0, titleT: 0, pending: [], pursuitT: 0, pursuitSpawned: 0, lowWarned: false, seed: 1,
  })
  const g = ctx.state.define<GameState>(GAME, { version: 1, init: () => fresh() })

  // 分阶段加载：逐个 await 子单元，期间让帧并回报进度（Runner 显示加载界面）
  const stages: [string, string, number][] = [
    ['world', '加载场景', 0], ['collision', '加载碰撞', 0.75], ['player', '加载角色', 0.76], ['weapon', '加载武器', 0.8],
    ['enemies', '加载敌人', 0.9], ['hud', '加载界面', 0.97], ['menu', '加载菜单', 0.99],
  ]
  for (let i = 0; i < stages.length; i++) {
    const [unit, text, progress] = stages[i]
    await ctx.loading.step(text, progress)
    // 子单元若用 defineGame 的 load 或启动预热，进度落在本阶段区间内
    ctx.loading.within(progress, stages[i + 1]?.[2] ?? 1)
    await ctx.use(unit)
  }
  ctx.loading.within(0, 1)

  const cutCount = () => g.relays.filter((r) => r === 'cut').length
  const aliveCount = () => foes(ctx).filter((e) => e.mode !== 'dying').length + g.pending.length

  function setPhase(phase: Phase) {
    g.phase = phase
    g.phaseTime = 0
  }

  /** 暂停只能回到 intro 或 playing；旧存档里 resume 可能是 paused，否则“继续”会一直停在暂停 */
  const resumable = (r: Phase): Phase => (r === 'intro' ? 'intro' : 'playing')

  function queue(counts: { gull: number; hound: number }, pursuit: boolean) {
    let delay = 0
    const types: EnemyType[] = []
    for (let i = 0; i < Math.max(counts.gull, counts.hound); i++) {
      if (i < counts.hound) types.push('hound')
      if (i < counts.gull) types.push('gull')
    }
    for (const type of types) {
      g.pending.push({ type, delay, pursuit })
      delay += flow.spawnStagger
    }
  }

  /** 生成点评分：避开玩家近处与视野正前方，偏好中距离 */
  function pickSpawn(type: EnemyType): Vec3 {
    const p = player(ctx)
    const kind = type === 'gull' ? 'air' : 'ground'
    let best: Vec3 = points.spawns[0].pos, score = -Infinity
    for (const sp of points.spawns) {
      if (sp.type !== kind) continue
      let sc = Math.random() * 8
      if (p) {
        const d = dist2d(sp.pos, p.pos)
        sc += d < flow.spawnFar ? -100 + d : 12 - Math.abs(d - 30) * 0.25
        const f = forward(p.yaw)
        const to = norm(sub(sp.pos, p.pos))
        if (dot([f[0], 0, f[2]], [to[0], 0, to[2]]) > 0.8 && d < 30) sc -= 8
      }
      if (sc > score) { score = sc; best = sp.pos }
    }
    return best
  }

  function deploy(keep: boolean) {
    emit(ctx, 'saltline/clear-enemies')
    emit(ctx, 'saltline/reset', keep)
    g.pending.length = 0
    g.interact = -1
    g.progress = 0
    g.hint = -1
    g.pursuitT = 0
    g.lowWarned = false
    g.relays = g.relays.map((r) => (r === 'cutting' ? 'live' : r))
    queue(flow.patrol, false)
    const cut = cutCount()
    if (cut > 0 && cut < relayCount) queue(flow.waves[cut - 1], false)
  }

  on(ctx, 'saltline/command', (cmd) => {
    ctx.audio.play(sfx('ui'), { volume: 0.5 })
    g.panel = ''
    if (cmd === 'start' || cmd === 'restart') {
      Object.assign(g, fresh(g.settings))
      deploy(false)
      setPhase('intro')
      g.fade = 1
    } else if (cmd === 'retry') {
      g.retries++
      deploy(true)
      setPhase('intro')
      g.resume = 'intro'
      g.fade = 1
    } else if (cmd === 'resume') {
      g.phase = resumable(g.resume)
    } else if (cmd === 'title') {
      emit(ctx, 'saltline/clear-enemies')
      Object.assign(g, fresh(g.settings))
    }
  })

  on(ctx, 'saltline/alert', (pos) => {
    const p = player(ctx)
    if (g.phase !== 'playing' || !p) return
    if (!g.alerted) {
      g.alerted = true
      emit(ctx, 'saltline/radio', flow.radio.contact)
    }
    const b = ((yawOf(sub(pos, p.pos)) % 360) + 360) % 360
    emit(ctx, 'saltline/warn', `发现敌情 · ${flow.directions[Math.round(b / 45) % 8]}`)
  })

  on(ctx, 'saltline/kill', (type, weak) => {
    g.stats.kills++
    if (weak) g.stats.weak++
    emit(ctx, 'saltline/feed', `${type === 'gull' ? '机械飞鸥' : '机械猎犬'} 已摧毁`, weak)
  })

  function cutRelay(i: number) {
    g.relays[i] = 'cut'
    g.interact = -1
    g.progress = 0
    const n = cutCount()
    ctx.audio.play(sfx('cut'), { volume: 0.8 })
    emit(ctx, 'saltline/relay-cut', i)
    emit(ctx, 'saltline/message', `${points.relays[i].label} 已断开`)
    if (n >= relayCount) {
      emit(ctx, 'saltline/radio', flow.radio.all)
    } else {
      emit(ctx, 'saltline/radio', flow.radio.cut[n - 1] ?? flow.radio.cut[flow.radio.cut.length - 1])
    }
    const wave = flow.waves[Math.min(n - 1, flow.waves.length - 1)]
    if (wave) queue(wave, true)
    g.alerted = true
  }

  let warnBlockT = 0
  let tickT = 0
  let lastFocus = true

  ctx.on('update', (dt, now) => {
    const input = ctx.input
    const p = player(ctx)
    g.phaseTime += dt
    warnBlockT = Math.max(0, warnBlockT - dt)

    // 鼠标锁定
    const wantLock = g.phase === 'playing' || g.phase === 'intro'
    if (input.cursor() !== wantLock && (wantLock ? input.focused() : true)) input.cursor(wantLock)

    // 暂停
    const focus = input.focused()
    if ((g.phase === 'playing' || g.phase === 'intro') && (input.pressed('escape') || (lastFocus && !focus))) {
      g.resume = g.phase
      g.phase = 'paused'
      g.panel = ''
      lastFocus = focus
      return
    }
    lastFocus = focus
    if (g.phase === 'paused' && input.pressed('escape')) {
      if (g.panel) g.panel = ''
      else g.phase = resumable(g.resume)
      return
    }

    if (g.phase === 'title') {
      // 原版 z()：周期 max(26, 路径长/速度)，smoothstep 混合缓动，位置/目标微晃，滚转，首尾淡入淡出
      const pos = points.cinematic.map((c) => c.pos), look = points.cinematic.map((c) => c.look)
      let len = 0
      for (let i = 1; i < pos.length; i++) len += Math.hypot(pos[i][0] - pos[i - 1][0], pos[i][1] - pos[i - 1][1], pos[i][2] - pos[i - 1][2])
      const V = Math.max(26, Math.max(len, 4) / flow.titleSpeed)
      g.titleT += dt
      if (g.titleT >= V) g.titleT = 0
      const Y = g.titleT / V, L = Y * Y * (3 - 2 * Y) * 0.25 + Y * 0.75, J = now
      const b = catmull(pos, L), m = catmull(look, L)
      b[0] += Math.sin(J * 0.31) * 0.05; b[1] += Math.sin(J * 0.43 + 1.7) * 0.035; b[2] += Math.sin(J * 0.27 + 0.6) * 0.05
      m[1] += Math.sin(J * 0.19) * 0.12; m[0] += Math.sin(J * 0.13 + 2) * 0.2
      const cam = ctx.scene.camera
      cam.position = b
      cam.lookAt(m)
      const r = cam.rotation
      cam.rotation = [r[0], r[1], r[2] + Math.sin(J * 0.21) * 6e-3 * 180 / Math.PI]
      ctx.scene.view({ fov: flow.titleFov })
      const ss = (a: number, c: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (c - a))); return t * t * (3 - 2 * t) }
      g.fade = Math.max(1 - ss(0, 1.8, g.titleT), ss(V - 1.6, V, g.titleT))
      return
    }

    if (g.phase === 'intro') {
      const total = g.retries > 0 || cutCount() > 0 ? flow.retryIntroSeconds : flow.introSeconds
      g.fade = Math.max(0, 1 - g.phaseTime / total)
      if (g.phaseTime >= total) {
        setPhase('playing')
        g.fade = 0
        if (g.retries === 0 && cutCount() === 0) emit(ctx, 'saltline/radio', flow.radio.intro)
      }
      return
    }

    if (g.phase === 'dead') {
      g.fade = Math.min(0.55, g.phaseTime * 0.4)
      return
    }
    if (g.phase === 'complete') {
      g.fade = Math.min(0.6, g.phaseTime * 0.5)
      return
    }
    if (g.phase !== 'playing' || !p) return

    g.time += dt

    // 阵亡
    if (p.health <= 0) {
      setPhase('dead')
      g.interact = -1
      return
    }
    if (p.health < 35 && !g.lowWarned) {
      g.lowWarned = true
      emit(ctx, 'saltline/radio', flow.radio.low)
    }
    if (p.health > 70) g.lowWarned = false

    // 中继交互
    const f = forward(p.yaw)
    let near = -1
    points.relays.forEach((r, i) => {
      if (g.relays[i] === 'cut') return
      const d = dist2d(r.pos, p.pos)
      if (d > flow.interactRange) return
      const to = norm([r.pos[0] - p.pos[0], 0, r.pos[2] - p.pos[2]])
      if (dot([f[0], 0, f[2]], to) < flow.interactFacing) return
      if (near < 0 || d < dist2d(points.relays[near].pos, p.pos)) near = i
    })
    g.hint = near
    if (near >= 0 && input.key('e')) {
      if (g.interact !== near) { g.progress = 0; if (g.interact >= 0 && g.relays[g.interact] === 'cutting') g.relays[g.interact] = 'live' }
      g.interact = near
      g.relays[near] = 'cutting'
      g.progress += dt / flow.cutSeconds
      tickT -= dt
      if (tickT <= 0) { tickT = 0.22; ctx.audio.play(sfx('cutTick'), { volume: 0.4, pitch: 1 + g.progress * 0.6 }) }
      if (g.progress >= 1) cutRelay(near)
    } else if (g.interact >= 0) {
      if (g.relays[g.interact] === 'cutting') g.relays[g.interact] = 'live'
      g.interact = -1
      g.progress = 0
    }

    // 待生成队列
    const living = aliveCount() - g.pending.length
    for (const item of g.pending) item.delay -= dt
    while (g.pending.length && g.pending[0].delay <= 0 && living + 1 <= flow.maxAlive) {
      const item = g.pending.shift()!
      emit(ctx, 'saltline/spawn', item.type, pickSpawn(item.type), item.pursuit)
      break
    }

    // 追击增援
    const cut = cutCount()
    if (cut > 0 && cut < relayCount + 1 && g.pursuitSpawned < flow.pursuitExtra) {
      g.pursuitT += dt
      if (g.pursuitT >= flow.pursuitEvery) {
        g.pursuitT = 0
        if (aliveCount() < flow.pursuitMinAlive) {
          const type: EnemyType = g.pursuitSpawned % 2 === 0 ? 'gull' : 'hound'
          g.pursuitSpawned++
          g.pending.push({ type, delay: 0, pursuit: true })
        }
      }
    }

    // 撤离
    if (dist2d(p.pos, points.extraction.pos) < points.extraction.radius) {
      if (cut >= relayCount) {
        setPhase('complete')
        emit(ctx, 'saltline/radio', flow.radio.done)
        emit(ctx, 'saltline/clear-enemies')
      } else if (warnBlockT <= 0) {
        warnBlockT = 4
        emit(ctx, 'saltline/warn', flow.extractBlocked)
      }
    }
  })
}

