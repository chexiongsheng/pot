/**
 * saltline 的持久状态（w.vars）与事件（004 第 19.5 节第 6 步）。
 * 阶段：flow 只有 title、play、paused；intro、playing、dead、complete 是 play 里的子阶段（vars.sl.phase）。
 * 这里的东西都进存档、热重载保留：玩到一半改代码，切断了几处中继、打掉了几只敌人都还在。
 */

/**
 * play 里的子阶段（导演切换）：
 * - intro：开场，画面从黑渐亮，正中显示“行动代号 · 港区突击”；能走动、转视角，但不能开枪，敌人还不敌对
 * - playing：战斗中，任务计时在走
 * - dead：突击队员倒下，画面渐暗，随后出现“信号中断”和“重试”
 * - complete：登上撤离艇，敌人清空，画面渐暗后出现行动简报与评级
 */
export type SubPhase = 'intro' | 'playing' | 'dead' | 'complete'
/** 合成的阶段：子阶段再加上标题画面 title 与暂停 paused */
export type Phase = 'title' | 'paused' | SubPhase
/** 中继的状态：live 在工作，cutting 玩家正按住 E 切断，cut 已切断（罗盘上不再标出） */
export type RelayStatus = 'live' | 'cutting' | 'cut'
/** 敌人种类：gull 机械飞鸥（空中），hound 机械猎犬（地面四足的“机器狗”） */
export type EnemyType = 'gull' | 'hound'

/** 设置面板里的选项（标题或暂停时可改，重开、热重载都保留） */
export interface Settings {
  /** 鼠标灵敏度 0.2 到 3 */
  sensitivity: number
  /** 反转垂直视角 */
  invertY: boolean
  /** 总音量 0 到 1 */
  volume: number
  /** 视野角度 60° 到 100° */
  fov: number
  /** 画质档位 0 低 1 中 2 高 3 极高（tuning.json quality.levels） */
  quality: number
}

/** 一局的进度（导演写，HUD、菜单、声音读） */
export interface Sl {
  /** 当前子阶段 */
  phase: SubPhase
  /** 当前子阶段已过的模拟秒数（标题时为标题已过的秒数） */
  t: number
  /** 任务计时（只在 playing 走） */
  time: number
  /** 阵亡后重试（重新部署）的次数：开场显示“重新部署 · 第 n 次”，结算时没重试过才能拿满评级 */
  retries: number
  /** 三处中继（甲号·堆场、乙号·仓库、丙号·码头）的状态，下标与 level.json 的 relays 相同 */
  relays: RelayStatus[]
  /** 正在交互的中继下标与进度 0..1；-1 为无 */
  interact: number
  progress: number
  /** 可交互但未按住时的中继（用于提示） */
  hint: number
  /** 是否已被敌人发现：第一次被发现时指挥中心喊“你已被发现！”，交战的紧张配乐也按它升起 */
  alerted: boolean
  /** 结算简报的数据：开枪数、命中数、击毁数、弱点命中数（打中敌人的弱点部位，伤害乘 2.2） */
  stats: { shots: number; hits: number; kills: number; weak: number }
  /**
   * 等待出场的敌人：开局的巡逻队、每切断一处中继派来的增援、追兵都先排进这里，导演每步最多放一只出场。
   * delay 是出场倒计时（同一波错开 0.85 秒），pursuit 为真时一出场就直奔玩家
   */
  pending: { type: EnemyType; delay: number; pursuit: boolean }[]
  /** 追兵计时：切断第一处中继后，每 7 秒看一次场上敌人够不够 */
  pursuitT: number
  /** 已派出的追兵数（一局最多 5 只） */
  pursuitSpawned: number
  /** 已经喊过“伤势严重”（血量回到 70 以上才会再喊） */
  lowWarned: boolean
  /** 撤离受阻提示的冷却 */
  warnT: number
}

/** 全新的一局：中继全部在工作，计时、战绩、队列清零（开始行动、重新开始任务、再次出击、回标题时用） */
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
  /** 底部“指挥中心”字幕（逐字打出，字越多显示越久）；换一句时响一声无线电提示音 */
  radio: { text: string; at: number; n: number }
  /** 顶部红框警告：“发现敌情 · 东北方”“中继尚未断开，撤离艇无法在火力下接应” */
  warn: { text: string; at: number }
  /** 屏幕中上方的一行消息：“甲号中继 · 堆场 已断开”“已从水中获救” */
  message: { text: string; at: number }
  /** 准星上的命中标记：普通命中、弱点命中（橙）、击杀（红），每次命中响一声 */
  marker: { at: number; kill: boolean; weak: boolean; n: number }
  /** 右上角的击杀信息：“机械猎犬 已摧毁 · 弱点命中”，最多 5 条，5 秒后淡出 */
  feed: { text: string; weak: boolean; at: number }[]
}

/** 很久以前：年龄远超显示时长，等于不显示 */
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
  /** 中继个数由导演 init 按关卡补上 */
  sl: freshSl(0),
  /** 缺省设置：灵敏度 1、音量 80%、视野 74°、画质“高” */
  slSettings: { sensitivity: 1, invertY: false, volume: 0.8, fov: 74, quality: 2 } as Settings,
  slHud: freshHud(),
}

/**
 * 合成的阶段：flow 为 play 时取子阶段，否则取 flow 状态名（title、paused）。
 * HUD 画不画、菜单显示哪一页、玩家能不能动、敌人敌不敌对、配乐怎么混，都按它决定
 */
export function phaseOf(w: any): Phase {
  const s = w.flow.state
  return s === 'play' ? ((w.vars.sl as Sl).phase ?? 'playing') : s
}

/** 游戏事件（w.emit / w.on / rule）的名字与载荷 */
export interface SlEvents {
  /** 指挥中心说一句话（下达任务、被发现、切断中继、伤势严重、撤离） */
  slRadio: string
  /** 顶部红框警告 */
  slWarn: string
  /** 屏幕中上方的消息 */
  slMessage: string
  /** 右上角添一条击杀信息 */
  slFeed: { text: string; weak: boolean }
  /** 打掉了一只飞鸥或猎犬（weak：致命一枪打在弱点上），记进战绩 */
  slKill: { kind: EnemyType; weak: boolean }
  /** 菜单改设置（界面事件，暂停中也分发） */
  slSet: Partial<Settings>
}

/** 发游戏事件（带载荷类型检查）：导演、玩家积木用它，接收的规则在 director.tsx 的 Director 里 */
export function slEmit<K extends keyof SlEvents>(w: any, name: K, payload: SlEvents[K]) {
  w.emit(name, payload)
}

/**
 * 菜单发的流程事件（emitUI）：slRestart、slRetry 必须带载荷，否则暂停中会被当成恢复。
 * slStart 开始行动，slResume 继续游戏，slPause 暂停（Esc、窗口失焦），slTitle 返回标题，
 * slRestart 重新开始任务、再次出击（{ mode: 'fresh' }），slRetry 阵亡后重试（{ mode: 'retry' }）
 */
export type FlowEvent = 'slStart' | 'slResume' | 'slPause' | 'slTitle' | 'slRestart' | 'slRetry'

/** 玩家实体（标签 player）；pid 是调用方记的缓存 id：港区有几百个碰撞盒实体，每帧全表查询太慢 */
export function findPlayer(w: any, cache: { pid: number }): any {
  const e = cache.pid < 0 ? undefined : w.get(cache.pid)
  if (e?.b.moveFps && e.tags.includes('player')) return e
  const found = w.query('player')[0]
  cache.pid = found ? found.id : -1
  return found
}
