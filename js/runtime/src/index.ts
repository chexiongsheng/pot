/**
 * @pot/core：游戏代码唯一可依赖的模块。
 * 构建后为 com.pot.core/Runtime/Resources/pot/core.cjs（IIFE，挂到 globalThis.pot）。
 */
export * from 'cordis'
export * from './host'
export * from './serialize'
export * from './units'
export * from './clock'
export * from './timer'
export * from './state'
export * from './cache'
export * from './data'
export * from './input'
export * from './ui'
export * from './audio'
export * from './scene'
export * from './gfx'
export * from './plugins'
export * from './runtime'
export * from './unity'

import type { Context } from 'cordis'

/** 游戏单元的类型辅助：export default definePlugin({ name, apply(ctx) {} }) */
export function definePlugin<T = any>(plugin: { name: string; inject?: string[]; apply: (ctx: Context, config: T) => any }) {
  return plugin
}
