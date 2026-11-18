/** 游戏内事件：基于 cordis 事件的带类型封装。监听随单元卸载自动清理 */
import type { Context, Vec3 } from '@pot/core'
import type { EnemyType } from './types'

/** 子弹命中信息：weapon 发出，enemies 同步填写结果 */
export interface BulletHit {
  id: number
  point: Vec3
  damage: number
  enemy: boolean
  killed: boolean
  weak: boolean
}

export interface Events {
  /** 重新开始（keep 为 true 时保留中继进度） */
  'jimao/reset'(keep: boolean): void
  /** 调试：沿视线做一次开枪检测并落弹孔（devserver eval 用） */
  'jimao/debug'(): void
  /** 玩家开枪（听觉警觉） */
  'jimao/shot'(pos: Vec3): void
  'jimao/bullet'(hit: BulletHit): void
  'jimao/damage-player'(amount: number, from: Vec3 | null): void
  'jimao/kill'(type: EnemyType, weak: boolean, pos: Vec3): void
  'jimao/spawn'(type: EnemyType, pos: Vec3, pursuit: boolean): void
  'jimao/clear-enemies'(): void
  /** 敌人发现玩家 */
  'jimao/alert'(pos: Vec3): void
  'jimao/relay-cut'(index: number): void
  'jimao/radio'(text: string): void
  'jimao/warn'(text: string): void
  'jimao/message'(text: string): void
  'jimao/feed'(text: string, weak: boolean): void
  'jimao/hitmarker'(kill: boolean, weak: boolean): void
  /** 后处理的游戏参数（uDamage、uLowHealth、uAds、uFade、uSaturation 等），world 转给后处理链 */
  'jimao/post'(values: Record<string, number>): void
  /** 菜单命令：start 开始、resume 继续、retry 重新部署、restart 重新开始、title 返回标题 */
  'jimao/command'(cmd: 'start' | 'resume' | 'retry' | 'restart' | 'title'): void
}

export function emit<K extends keyof Events>(ctx: Context, name: K, ...args: Parameters<Events[K]>) {
  ;(ctx as any).emit(name, ...args)
}

export function on<K extends keyof Events>(ctx: Context, name: K, listener: Events[K]) {
  return (ctx as any).on(name, listener) as () => void
}
