/** 游戏内事件：基于 cordis 事件的带类型封装。监听随单元卸载自动清理 */
import type { Context, Vec3 } from '@pot/core'
import type { EnemyType } from './types'

/** 子弹命中信息：weapon 发出，enemies.tsx 同步填写结果 */
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
  'saltline/reset'(keep: boolean): void
  /** 调试：沿视线做一次开枪检测并落弹孔；给坐标时直接在该点放水花（devserver eval 用） */
  'saltline/debug'(at?: Vec3): void
  /** 玩家开枪（听觉警觉） */
  'saltline/shot'(pos: Vec3): void
  'saltline/bullet'(hit: BulletHit): void
  'saltline/damage-player'(amount: number, from: Vec3 | null): void
  'saltline/kill'(type: EnemyType, weak: boolean, pos: Vec3): void
  'saltline/spawn'(type: EnemyType, pos: Vec3, pursuit: boolean): void
  'saltline/clear-enemies'(): void
  /** 敌人发现玩家 */
  'saltline/alert'(pos: Vec3): void
  'saltline/relay-cut'(index: number): void
  'saltline/radio'(text: string): void
  'saltline/warn'(text: string): void
  'saltline/message'(text: string): void
  'saltline/feed'(text: string, weak: boolean): void
  'saltline/hitmarker'(kill: boolean, weak: boolean): void
  /** 后处理的游戏参数（uDamage、uLowHealth、uAds、uFade、uSaturation 等），world 转给后处理链 */
  'saltline/post'(values: Record<string, number>): void
  /** 菜单命令：start 开始、resume 继续、retry 重新部署、restart 重新开始、title 返回标题 */
  'saltline/command'(cmd: 'start' | 'resume' | 'retry' | 'restart' | 'title'): void
}

export function emit<K extends keyof Events>(ctx: Context, name: K, ...args: Parameters<Events[K]>) {
  ;(ctx as any).emit(name, ...args)
}

export function on<K extends keyof Events>(ctx: Context, name: K, listener: Events[K]) {
  return (ctx as any).on(name, listener) as () => void
}
