/** 跨单元共享的状态结构。各 key 由所属单元 define，其他单元用 ctx.state.get 读取 */
import type { Context, Vec3 } from '@pot/core'

export type Phase = 'title' | 'intro' | 'playing' | 'paused' | 'dead' | 'complete'
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

export interface GameState {
  phase: Phase
  /** 暂停前的阶段 */
  resume: Phase
  phaseTime: number
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
  settings: Settings
  /** 菜单子面板：'' | settings | controls | about */
  panel: string
  fade: number
  titleT: number
  pending: { type: EnemyType; delay: number; pursuit: boolean }[]
  pursuitT: number
  pursuitSpawned: number
  lowWarned: boolean
  seed: number
}

/**
 * 玩家状态的视图：玩家是带 moveFps、cameraFps、health 的实体（player.tsx），这里把积木状态按旧字段名映射出来，
 * 其他单元照旧读写。只有 sprinting（武器开火时打断冲刺）与 shake（爆炸震屏）可写。
 */
export interface PlayerState {
  pos: Vec3
  vel: Vec3
  yaw: number
  pitch: number
  health: number
  crouching: boolean
  /** 当前身高（蹲伏插值） */
  height: number
  eye: number
  grounded: boolean
  coyote: number
  jumpBuffer: number
  lastHurt: number
  hurt: number
  bob: number
  speed: number
  sprinting: boolean
  lastSafe: Vec3
  /** 镜头抖动 */
  shake: number
}

export interface WeaponState {
  mag: number
  reserve: number
  reloading: boolean
  reloadT: number
  reloadTotal: number
  ads: number
  cooldown: number
  bloom: number
  recoilP: number
  recoilY: number
  kick: number
  /** 当前准星扩散（弧度），给 HUD 用 */
  spread: number
}

export const GAME = 'saltline/game'
export const WEAPON = 'saltline/weapon'

export const game = (ctx: Context) => ctx.state.get<GameState>(GAME)
export const weapon = (ctx: Context) => ctx.state.get<WeaponState>(WEAPON)

/** 敌人摘要（标签 enemy 的实体，enemies.tsx）：mode 为 patrol/combat/search/dying 等 */
export function foes(ctx: Context): { mode: string; pos: Vec3; kind: EnemyType }[] {
  return (ctx.world as any).query('enemy').map((e: any) => ({ mode: e.b.slFoe.mode, pos: e.pos, kind: e.b.slFoe.kind }))
}

/** 玩家实体（标签 player）；还没加载时为 undefined */
export function playerEntity(ctx: Context): any {
  const w: any = ctx.world
  const e = cachedId < 0 ? undefined : w.get(cachedId)
  if (e?.b.moveFps && e.tags.includes('player')) return e
  const found = w.query('player')[0]
  cachedId = found ? found.id : -1
  return found
}
/** 只是查找缓存（不是状态）：关卡有几百个碰撞实体，不能每次都全表查询 */
let cachedId = -1

export function player(ctx: Context): PlayerState | undefined {
  const e = playerEntity(ctx)
  if (!e) return undefined
  const b = e.b
  return {
    get pos() { return e.pos },
    get vel() { return b.moveFps.vel },
    get yaw() { return b.moveFps.yaw },
    get pitch() { return b.moveFps.pitch },
    get health() { return b.health.hp },
    get crouching() { return b.moveFps.crouched },
    get height() { return b.moveFps.curHeight },
    get eye() { return b.moveFps.curEye },
    get grounded() { return b.moveFps.grounded },
    get coyote() { return b.moveFps.coyoteT },
    get jumpBuffer() { return b.moveFps.buffer },
    get lastHurt() { return b.health.lastHit },
    get hurt() { return b.slFeedback.hurt },
    get bob() { return b.moveFps.bob },
    get speed() { return b.moveFps.speed },
    get sprinting() { return b.moveFps.sprinting },
    set sprinting(v) { b.moveFps.sprinting = v },
    get lastSafe() { return b.moveFps.lastSafe },
    get shake() { return b.cameraFps.shake },
    set shake(v) { b.cameraFps.shake = v },
  } as PlayerState
}

/** 玩家眼睛（相机）位置 */
export function eyeOf(p: PlayerState): Vec3 {
  return [p.pos[0], p.pos[1] + p.eye, p.pos[2]]
}

/** 玩家受击判定的中心（躯干） */
export function chestOf(p: PlayerState): Vec3 {
  return [p.pos[0], p.pos[1] + p.height * 0.6, p.pos[2]]
}
