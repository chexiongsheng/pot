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

export const GAME = 'jimao/game'
export const PLAYER = 'jimao/player'
export const WEAPON = 'jimao/weapon'
export const ENEMIES = 'jimao/enemies'

export const game = (ctx: Context) => ctx.state.get<GameState>(GAME)
export const player = (ctx: Context) => ctx.state.get<PlayerState>(PLAYER)
export const weapon = (ctx: Context) => ctx.state.get<WeaponState>(WEAPON)

/** 玩家眼睛（相机）位置 */
export function eyeOf(p: PlayerState): Vec3 {
  return [p.pos[0], p.pos[1] + p.eye, p.pos[2]]
}

/** 玩家受击判定的中心（躯干） */
export function chestOf(p: PlayerState): Vec3 {
  return [p.pos[0], p.pos[1] + p.height * 0.6, p.pos[2]]
}
