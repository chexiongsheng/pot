/**
 * 导演（004 第 19.5 节第 6 步）：单例实体上的 slDirector 积木。
 * init 是开局布置（每次进入 flow 状态场景重建，导演实体随之新建），step 是子阶段、中继交互、波次、追击增援、撤离，
 * view 是标题镜头、切断音效与渐黑。另有一组规则（Director 组件里）：发现敌情、战绩、HUD 提示、改设置。
 *
 * 导演就是这一关的“剧本”，一局任务按下面的顺序展开（数字来自 flow.json）：
 * 1. 开场（intro）：画面从黑渐亮 3.5 秒，指挥中心下令“切断堆场、仓库、码头的三处中继”；
 *    巡逻队（2 只机械飞鸥、6 只机械猎犬）陆续在港区各处出场，还没发现玩家
 * 2. 战斗（playing）：玩家走到中继跟前、面朝它，按住 E 2.4 秒切断；松手或走开进度就清零
 * 3. 每切断一处，指挥中心播报，并派一波直奔玩家的增援（第一处 3 鸥 1 犬，第二处 3 鸥 2 犬，第三处 4 鸥 3 犬）；
 *    此后场上敌人太少时还会零星补几只追兵
 * 4. 三处全断：码头南端舷梯旁的撤离点亮起信标，玩家走进去就登艇撤离（complete），敌人全部清走
 * 5. 中途血量归零就是阵亡（dead）：重试时已切断的中继保留，场景重建，敌人按进度重新布置
 */
import { defineBlock, type Context, type SceneArgs, type Vec3 } from '@pot/core'
import { mechClear } from '@pot/kit/mech'
import { levelPoints, type LevelData } from '@pot/kit/harbor/level'
import { catmull, dist2d, dot, forward, norm, sub, yawOf } from '@pot/kit/realistic/math'
import { sfx } from '@pot/kit/realistic/sfx'
import { foeSpawns, spawnFoe, type FoeSpawns } from './enemies'
import { findPlayer, freshSl, phaseOf, slEmit, type EnemyType, type Settings, type Sl, type SlHud, type SubPhase } from './state'

/** 导演的属性：全部由 Director 组件从数据文件读出来填上 */
const PROPS = {
  /** flow.json：节奏、敌人波次、指挥中心台词 */
  flow: {} as any,
  /** 三处中继的位置与名字（“甲号中继 · 堆场”等），来自 level.json */
  relays: [] as { pos: Vec3; label: string }[],
  /** 敌人出生点：type 为 ground（地面，给猎犬）或 air（空中，给飞鸥） */
  spawns: [] as { type: string; pos: Vec3 }[],
  /** 撤离点：码头南端舷梯旁，半径 2.5 米 */
  extraction: { pos: [0, 0, 0] as Vec3, radius: 0 },
  /** 飞鸥、猎犬的生成参数（parts/enemies.ts） */
  foes: {} as FoeSpawns,
}
/** 积木里拿到的 me：属性加上缓存的玩家实体 id */
type Me = typeof PROPS & { pid: number }

/** 已切断几处中继 */
const cutCount = (sl: Sl) => sl.relays.filter((r) => r === 'cut').length
/** 场上还活着的敌人数（正在坠落、倒地的不算），用来限制同屏敌人数 */
const aliveFoes = (w: any) => w.query('enemy').filter((e: any) => e.b.mechFoe && e.b.mechFoe.mode !== 'dying').length

/** 切换子阶段并从 0 计时（开场渐亮、阵亡渐暗、结算浮现都按 sl.t 算） */
function setPhase(sl: Sl, phase: SubPhase) {
  sl.phase = phase
  sl.t = 0
}

/** 把一波敌人排进出场队列：猎犬、飞鸥交替，每只错开 spawnStagger（0.85 秒），不会一下子冒出一群 */
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

/**
 * 生成点评分：避开玩家近处与视野正前方，偏好中距离。
 * 飞鸥只用空中点、猎犬只用地面点；离玩家不到 18 米的几乎不选（不在玩家脸上刷怪），最好在 30 米左右；
 * 玩家正看着的方向 30 米内扣分（不让敌人当面凭空出现）；再加一点随机，每次不完全一样
 */
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

/**
 * 切断完成：屏幕中上方提示“甲号中继 · 堆场 已断开”，指挥中心按已断几处播报（最后一处喊“快撤”），
 * 再按已断几处派一波直奔玩家的增援；从此敌人算是已经警觉
 */
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
/**
 * frame、time、dt：上次更新的渲染帧号与时间、本帧间隔；state：上一帧的流程状态；titleT：标题镜头走了几秒；
 * cut：已为几处切断播过音效；tickT：切断中滴答声的倒计时；fade：当前渐黑（0 不黑，1 全黑）
 */
interface Look { frame: number; time: number; dt: number; state: string; titleT: number; cut: number; tickT: number; fade: number }
/** 按 w.registry 存：积木钩子与界面拿到的 World 是不同上下文的服务代理，registry 是同一个对象 */
const looks = new WeakMap<object, Look>()
function look(w: any): Look {
  let L = looks.get(w.registry)
  if (!L) looks.set(w.registry, (L = { frame: -1, time: 0, dt: 0, state: '', titleT: 0, cut: 0, tickT: 0, fade: 0 }))
  return L
}

/** 当前渐黑（0..1），hud 画 */
export const directorFade = (w: any) => looks.get(w.registry)?.fade ?? 0

const ss = (a: number, c: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (c - a))); return t * t * (3 - 2 * t) }

/**
 * 导演积木：放在场景里唯一的 director 实体上。order 10 排在移动（0）、开枪（2）、敌人（0 到 2）、生命（5）之后，
 * 读到的是本步结算后的玩家位置与血量
 */
export const slDirector = defineBlock<typeof PROPS, { pid: number; bid: number }>({
  name: 'slDirector',
  about: 'saltline 导演：开局布置、子阶段（intro/playing/dead/complete）、中继交互、波次与追击增援、撤离；把中继状态写给 harbor（harborRelays），撤离点开放时点亮信标；表现为标题镜头、切断音效、渐黑',
  order: 10,
  props: PROPS,
  state: { pid: -1, bid: -1 },

  // 开局布置：每次“进入”流程状态（开始行动、重试、重新开始、回标题）场景都会重建，导演实体随之新建，init 跑一次
  init(me, _e, w) {
    const sl: Sl = w.vars.sl, f = w.flow
    // 阵亡后重试：重新部署次数加一，已切断的中继保留，切到一半的那处恢复原状；其余情况都是全新一局
    if (f.state === 'play' && f.params.mode === 'retry') {
      sl.retries++
      sl.relays = sl.relays.map((r) => (r === 'cutting' ? 'live' : r))
    } else {
      Object.assign(sl, freshSl(me.relays.length))
    }
    // 进入流程状态时清掉警告、消息、击杀信息（无线电字幕保留）
    const hud: SlHud | undefined = w.vars.slHud
    if (hud) {
      hud.warn.at = hud.message.at = -1e9
      hud.feed = []
    }
    // 标题画面只要镜头巡游，不刷敌人
    if (f.state === 'title') return
    // 清掉上一条命留下的出场队列、交互进度和追兵计时，从开场字幕开始
    Object.assign(sl, { pending: [], interact: -1, progress: 0, hint: -1, pursuitT: 0, lowWarned: false, warnT: 0 })
    setPhase(sl, 'intro')
    // 攻击令牌的间隔清零：敌人发现玩家后不用额外等待就能开火
    w.vars.mechTokenGap = 0
    // 巡逻队：2 只飞鸥、6 只猎犬，在港区各处巡逻，还没发现玩家
    queue(sl, me.flow, me.flow.patrol, false)
    // 重试时已经断了几处，就把对应的那波增援也补上（敌人已经警觉，不会因为重来变少）
    const cut = cutCount(sl)
    if (cut > 0 && cut < me.relays.length) queue(sl, me.flow, me.flow.waves[cut - 1], false)
  },

  // 每个固定步（每秒 60 次）：推进子阶段、切断中继、放敌人出场、派追兵、判定撤离
  step(me, _e, w) {
    const sl: Sl = w.vars.sl, F = me.flow, dt = w.dt
    sl.t += dt
    sl.warnT = Math.max(0, sl.warnT - dt)
    // harbor 的中继模型读 harborRelays：港区模型按它画三处中继设备上的灯（在工作、切断中、已切断）；
    // 撤离点信标在三处都断开后亮起（标题时不亮）
    const shown: string[] = w.vars.harborRelays ?? []
    if (shown.length !== sl.relays.length || shown.some((r, i) => r !== sl.relays[i])) w.vars.harborRelays = [...sl.relays]
    const beacon = findBeacon(w, me)
    if (beacon) beacon.on = w.flow.state !== 'title' && sl.relays.length > 0 && sl.relays.every((r) => r === 'cut')
    // 下面只在任务中推进（标题画面不走；暂停时整个模拟停住，step 根本不调）
    if (w.flow.state !== 'play') return
    const n = me.relays.length
    // 开场：第一次出击等 3.5 秒，结束时指挥中心下达任务；重试或已断过中继时只等 1.3 秒，不再重复任务简报
    if (sl.phase === 'intro') {
      const first = sl.retries === 0 && cutCount(sl) === 0
      if (sl.t >= (first ? F.introSeconds : F.retryIntroSeconds)) {
        setPhase(sl, 'playing')
        if (first) slEmit(w, 'slRadio', F.radio.intro)
      }
      return
    }
    // 阵亡和撤离后不再推进；任务计时只在战斗中走（结算里的“用时”）
    const p = findPlayer(w, me)
    if (sl.phase !== 'playing' || !p) return
    sl.time += dt

    // 阵亡、低血量：血量归零进入阵亡；低于 35 时指挥中心提醒“伤势严重！找掩体躲避”，回血到 70 以上才会再提醒
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

    // 中继交互：2.2 米内、且大致面朝它（水平夹角约 63° 以内）的中继里取最近的一处，HUD 显示“按住 E · 切断中继”；
    // 按住 E 时进度每秒涨 1/2.4，满了就切断；松手或换了一处，进度清零、那处恢复成在工作
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

    // 待生成队列：每步最多生成一个。队列里的倒计时一起走，排在最前的到点、且场上不到 12 只时放它出场
    const living = aliveFoes(w)
    for (const item of sl.pending) item.delay -= dt
    if (sl.pending.length && sl.pending[0].delay <= 0 && living + 1 <= F.maxAlive) {
      const item = sl.pending.shift()!
      spawnFoe(w, me.foes, item.type, pickSpawn(me, w, p, item.type), item.pursuit)
    }

    // 追击增援：切断第一处之后，每 7 秒看一次，场上加排队的敌人少于 4 只就补一只直奔玩家的追兵，
    // 飞鸥、猎犬轮流，一局最多补 5 只；玩家清得太快也不会一直冷场
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

    // 撤离：走进码头南端的撤离圈。三处都断了就登艇成功，指挥中心说“干得漂亮”，敌人、弹道、爆炸全部清掉；
    // 还没断完就在顶部警告“中继尚未断开，撤离艇无法在火力下接应”，4 秒内不重复
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

  // 表现（每个渲染帧，不进存档）：标题镜头、切断音效、全屏渐黑
  view: {
    // 进场时记下已切断几处，重建后不会把以前的切断音效补播一遍
    enter(_me, _e, _ctx, w) {
      look(w).cut = cutCount(w.vars.sl)
    },
    update(me, _e, _objs, ctx, w) {
      const L = look(w), sl: Sl = w.vars.sl, F = me.flow, c: any = ctx.clock
      // 自己算渲染帧间隔：同一帧只算一次，跳过了帧（如热重载后）按 0 算
      if (L.frame !== c.frame) {
        L.dt = L.frame === c.frame - 1 ? Math.max(0, c.time - L.time) : 0
        L.frame = c.frame
        L.time = c.time
      }
      const dt = L.dt, ph = phaseOf(w), state = w.flow.state
      // 回到标题时镜头从路线起点重新开始
      if (state !== L.state) {
        if (state === 'title') L.titleT = 0
        L.state = state
      }
      // 切断音效与切断中的滴答声：切断成功时“咔嚓”一声；按住 E 期间每 0.22 秒“滴”一下，越接近完成音调越高
      const cut = cutCount(sl)
      if (cut > L.cut) ctx.audio.play(sfx('cut'), { volume: 0.8 })
      L.cut = cut
      if (ph === 'playing' && sl.interact >= 0 && sl.relays[sl.interact] === 'cutting') {
        L.tickT -= dt
        if (L.tickT <= 0) { L.tickT = 0.22; ctx.audio.play(sfx('cutTick'), { volume: 0.4, pitch: 1 + sl.progress * 0.6 }) }
      }
      // 全屏渐黑（HUD 画）：标题镜头每圈首尾淡入淡出；开场从全黑渐亮；阵亡时渐暗到 55%；
      // 撤离成功渐暗到 60%，衬出结算简报；暂停时保持不变
      if (ph === 'title') L.fade = titleCamera(ctx, F, L, dt, c.time)
      else if (ph === 'intro') L.fade = Math.max(0, 1 - sl.t / (sl.retries > 0 || cut > 0 ? F.retryIntroSeconds : F.introSeconds))
      else if (ph === 'dead') L.fade = Math.min(0.55, sl.t * 0.4)
      else if (ph === 'complete') L.fade = Math.min(0.6, sl.t * 0.5)
      else if (ph !== 'paused') L.fade = 0
    },
  },
})

/** 撤离点信标（标签 extraction 的实体的 beacon，parts/stage.tsx 放的地面光圈与光柱）；bid 是缓存的实体 id */
function findBeacon(w: any, me: { bid: number }): any {
  const e = me.bid < 0 ? undefined : w.get(me.bid)
  if (e?.b.beacon) return e.b.beacon
  const found = w.query('extraction')[0]
  me.bid = found ? found.id : -1
  return found?.b.beacon
}

/**
 * 标题镜头（原版 z()）：周期 max(26, 路径长/速度)，smoothstep 混合缓动，位置与目标微晃，滚转，首尾淡入淡出；返回渐黑。
 * 标题画面背后的镜头沿 level.json 的 cinematic 路线，从港区西侧出发，贴着地面穿过集装箱之间的巷道，
 * 像手持摄影机一样轻轻晃动；一圈走完黑一下，再从头开始
 */
function titleCamera(ctx: Context, F: any, L: Look, dt: number, now: number) {
  const { cinematic } = levelPoints(ctx.data.load<LevelData>('level.json'))
  const pos = cinematic.map((c) => c.pos), at = cinematic.map((c) => c.look)
  // 路线总长决定一圈多久（至少 26 秒）
  let len = 0
  for (let i = 1; i < pos.length; i++) len += Math.hypot(pos[i][0] - pos[i - 1][0], pos[i][1] - pos[i - 1][1], pos[i][2] - pos[i - 1][2])
  const V = Math.max(26, Math.max(len, 4) / F.titleSpeed)
  L.titleT += dt
  if (L.titleT >= V) L.titleT = 0
  // 起步和收尾稍慢的缓动；位置与看点沿 Catmull-Rom 曲线插值，再叠上几路慢速正弦晃动和一点滚转（手持感）
  const Y = L.titleT / V, s = Y * Y * (3 - 2 * Y) * 0.25 + Y * 0.75, J = now
  const b = catmull(pos, s), m = catmull(at, s)
  b[0] += Math.sin(J * 0.31) * 0.05; b[1] += Math.sin(J * 0.43 + 1.7) * 0.035; b[2] += Math.sin(J * 0.27 + 0.6) * 0.05
  m[1] += Math.sin(J * 0.19) * 0.12; m[0] += Math.sin(J * 0.13 + 2) * 0.2
  const cam = ctx.scene.camera
  cam.position = b
  cam.lookAt(m)
  const r = cam.rotation
  cam.rotation = [r[0], r[1], r[2] + Math.sin(J * 0.21) * 6e-3 * 180 / Math.PI]
  // 标题镜头用 50° 的窄视野，更有电影感
  ctx.scene.view({ fov: F.titleFov })
  // 每圈开头 1.8 秒从黑渐亮，结尾 1.6 秒渐黑
  return Math.max(1 - ss(0, 1.8, L.titleT), ss(V - 1.6, V, L.titleT))
}

/** 菜单改设置（设置面板的滑块、开关、画质按钮发 slSet）：只收认识的键与对的类型；画质同时写给 realistic，暂停中也立刻生效 */
function applySettings(w: any, patch: Partial<Settings>) {
  const s: Settings = w.vars.slSettings
  if (!patch || typeof patch !== 'object') return
  for (const k of ['sensitivity', 'volume', 'fov', 'quality'] as const) if (typeof patch[k] === 'number' && Number.isFinite(patch[k])) s[k] = patch[k]!
  if (typeof patch.invertY === 'boolean') s.invertY = patch.invertY
  w.vars.renderQuality = s.quality
}

/** 导演实体与规则（敌情、战绩、HUD 提示、设置）；属性来自 flow.json、关卡点位与 tuning.json */
export function Director({ data }: { data: SceneArgs['data'] }) {
  const flow = data.load('flow.json')
  const level = data.load<LevelData>('level.json')
  const { relays, spawns, extraction } = levelPoints(level)
  const cache = { pid: -1 }
  /**
   * 敌人发现玩家（mech 的 mechAlert）：第一次被发现时指挥中心喊“你已被发现！空中有机械飞鸥，地面有机械猎犬”；
   * 每次都在顶部警告敌人在玩家的哪个方位（八个方向，如“发现敌情 · 东北方”）
   */
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
  /** 打掉一只敌人：击毁数加一（弱点致命再记一次弱点命中），右上角添一条“机械猎犬 已摧毁” */
  const kill = (w: any, ev: { kind: EnemyType; weak: boolean }) => {
    const sl: Sl = w.vars.sl
    sl.stats.kills++
    if (ev.weak) sl.stats.weak++
    slEmit(w, 'slFeed', { text: `${ev.kind === 'gull' ? '机械飞鸥' : '机械猎犬'} 已摧毁`, weak: ev.weak })
  }
  /** 战绩：开枪数（fps 的 gunFired）、命中数（mech 的 mechHurt，击杀时转成 slKill）；每次命中准星上闪一下命中标记 */
  const fired = (w: any) => { (w.vars.sl as Sl).stats.shots++ }
  const hurt = (w: any, h: { kind: EnemyType; weak: boolean; killed: boolean }) => {
    ;(w.vars.sl as Sl).stats.hits++
    const m = (w.vars.slHud as SlHud).marker
    Object.assign(m, { at: w.tick, kill: !!h.killed, weak: !!h.weak, n: m.n + 1 })
    if (h.killed) slEmit(w, 'slKill', { kind: h.kind, weak: h.weak })
  }
  // 导演实体，加上把各种事件落进 vars 的规则：HUD 每帧只读 vars.slHud，自己不订阅事件
  return <>
    <entity key="director" tags={['director']} slDirector={{
      flow, relays: relays.map((r) => ({ pos: r.pos, label: r.label })), spawns, extraction, foes: foeSpawns(data.load('tuning.json'), level),
    }} />
    {/* 发现敌情、开枪、命中、击杀 → 战绩与提示 */}
    <rule on="mechAlert" do={alert} />
    <rule on="gunFired" do={fired} />
    <rule on="mechHurt" do={hurt} />
    <rule on="slKill" do={kill} />
    {/* HUD 的瞬时提示：记下文字和发生时的步数，界面按步数差算显示了多久（暂停时不走） */}
    <rule on="slRadio" do={(w: any, text: string) => { const r = (w.vars.slHud as SlHud).radio; Object.assign(r, { text, at: w.tick, n: r.n + 1 }) }} />
    <rule on="slWarn" do={(w: any, text: string) => { (w.vars.slHud as SlHud).warn = { text, at: w.tick } }} />
    <rule on="slMessage" do={(w: any, text: string) => { (w.vars.slHud as SlHud).message = { text, at: w.tick } }} />
    <rule on="slFeed" do={(w: any, f: { text: string; weak: boolean }) => {
      const hud: SlHud = w.vars.slHud
      hud.feed = [{ text: f.weak ? `${f.text} · 弱点命中` : f.text, weak: !!f.weak, at: w.tick }, ...hud.feed].slice(0, 5)
    }} />
    {/* 设置面板改设置 */}
    <rule on="slSet" do={applySettings} />
  </>
}

declare module '@pot/core' {
  interface GameBlockProps {
    slDirector?: Partial<typeof PROPS> | boolean
  }
}
