/**
 * saltline 的持久状态（w.vars）与事件（004 第 19.5 节第 6 步）。
 * 阶段：flow 只有 title、play、paused；intro、playing、dead、complete 是 play 里的子阶段（vars.sl.phase）。
 */

export type SubPhase = 'intro' | 'playing' | 'dead' | 'complete'
export type Phase = 'title' | 'paused' | SubPhase
export type RelayStatus = 'live' | 'cutting' | 'cut'
export type EnemyType = 'gull' | 'hound'

export interface Settings {
  sensitivity: number
  invertY: boolean
  volume: number
  fov: number
  /** 画质档位 0 低 1 中 2 高 3 极高（tuning.json quality.levels） */
  quality: number
}

/** 一局的进度 */
export interface Sl {
  phase: SubPhase
  /** 当前子阶段已过的模拟秒数（标题时为标题已过的秒数） */
  t: number
  /** 任务计时（只在 playing 走） */
  time: number
  retries: number
  relays: RelayStatus[]
  /** 正在交互的中继下标与进度 0..1；-1 为无 */
  interact: number
  progress: number
  /** 可交互但未按住时的中继（用于提示） */
  hint: number
  alerted: boolean
  stats: { shots: number; hits: number; kills: number; weak: number }
  pending: { type: EnemyType; delay: number; pursuit: boolean }[]
  pursuitT: number
  pursuitSpawned: number
  lowWarned: boolean
  /** 撤离受阻提示的冷却 */
  warnT: number
}

export function freshSl(relayCount: number): Sl {
  return {
    phase: 'intro', t: 0, time: 0, retries: 0,
    relays: Array.from({ length: relayCount }, () => 'live' as RelayStatus), interact: -1, progress: 0, hint: -1, alerted: false,
    stats: { shots: 0, hits: 0, kills: 0, weak: 0 },
    pending: [], pursuitT: 0, pursuitSpawned: 0, lowWarned: false, warnT: 0,
  }
}

/**
 * HUD 的瞬时提示（无线电字幕、敌情警告、消息、命中标记、击杀信息）：文字与发生时的 tick，界面按 tick 差算年龄
 * （暂停时 tick 不走，提示冻结）；n 是序号，提示音按它的变化放
 */
export interface SlHud {
  radio: { text: string; at: number; n: number }
  warn: { text: string; at: number }
  message: { text: string; at: number }
  marker: { at: number; kill: boolean; weak: boolean; n: number }
  feed: { text: string; weak: boolean; at: number }[]
}

const NEVER = -1e9

export function freshHud(): SlHud {
  return {
    radio: { text: '', at: NEVER, n: 0 }, warn: { text: '', at: NEVER }, message: { text: '', at: NEVER },
    marker: { at: NEVER, kill: false, weak: false, n: 0 }, feed: [],
  }
}

/** 提示的年龄（秒） */
export const ageOf = (w: any, at: number) => (w.tick - at) * w.dt

/** defineGame 的 vars */
export const slVars = {
  sl: freshSl(0),
  slSettings: { sensitivity: 1, invertY: false, volume: 0.8, fov: 74, quality: 2 } as Settings,
  slHud: freshHud(),
}

/** 合成的阶段：flow 为 play 时取子阶段，否则取 flow 状态名（title、paused） */
export function phaseOf(w: any): Phase {
  const s = w.flow.state
  return s === 'play' ? ((w.vars.sl as Sl).phase ?? 'playing') : s
}

/** 游戏事件（w.emit / w.on / rule）的名字与载荷 */
export interface SlEvents {
  slRadio: string
  slWarn: string
  slMessage: string
  slFeed: { text: string; weak: boolean }
  slKill: { kind: EnemyType; weak: boolean }
  /** 菜单改设置（界面事件，暂停中也分发） */
  slSet: Partial<Settings>
}

export function slEmit<K extends keyof SlEvents>(w: any, name: K, payload: SlEvents[K]) {
  w.emit(name, payload)
}

/** 菜单发的流程事件（emitUI）：slRestart、slRetry 必须带载荷，否则暂停中会被当成恢复 */
export type FlowEvent = 'slStart' | 'slResume' | 'slPause' | 'slTitle' | 'slRestart' | 'slRetry'

/** 玩家实体（标签 player）；pid 是调用方记的缓存 id */
export function findPlayer(w: any, cache: { pid: number }): any {
  const e = cache.pid < 0 ? undefined : w.get(cache.pid)
  if (e?.b.moveFps && e.tags.includes('player')) return e
  const found = w.query('player')[0]
  cache.pid = found ? found.id : -1
  return found
}
