/** 低层单元之间的事件（cordis 事件，监听随单元卸载自动清理）。游戏事件走 w.emit，见 parts/state.ts 的 SlEvents */
import type { Context } from '@pot/core'

export interface Events {
  /** 后处理的游戏参数（uDamage、uLowHealth、uAds、uFade、uSaturation 等），world 转给后处理链 */
  'saltline/post'(values: Record<string, number>): void
}

export function emit<K extends keyof Events>(ctx: Context, name: K, ...args: Parameters<Events[K]>) {
  ;(ctx as any).emit(name, ...args)
}

export function on<K extends keyof Events>(ctx: Context, name: K, listener: Events[K]) {
  return (ctx as any).on(name, listener) as () => void
}
