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
export * from './loading'
export * from './canvas'
export * from './plugins'
export * from './runtime'
export * from './unity'
export * from './world/node'
export { defineBlock, definePrefab, Registry } from './world/registry'
export type { BlockDef } from './world/registry'
export { evaluate } from './world/tree'
export type { EntitySpec, RuleSpec, StageSpec, TreeResult } from './world/tree'
export { WorldService, DEFAULT_CONTROLS, MAX_EVENT_ROUNDS } from './world/world'
export type { World, EntityData, WorldData, MountData, SpawnProps, Handler, Cmd, Controls } from './world/world'
export { overlap, overlappingPairs } from './world/collide'
export type { Collider } from './world/collide'
export { WorldView } from './world/view'
export { createUIRenderer, ANCHORS, UI_MARGIN } from './world/ui-eval'
export type { UIRenderer } from './world/ui-eval'
export { defineGame } from './world/game'
export type { GameDef, GameUnit, GameWorld, SceneArgs } from './world/game'
export { BUILTIN_BLOCKS } from './world/blocks'
export type { FlowDef, FlowStateDef } from './world/flow'
export { BUILTIN_PREFABS } from './world/prefabs'
export type { PotIntrinsicElements, EntityProps, StageProps, RuleProps, TextProps } from './world/types'
export { createElement } from './jsx-runtime'
import * as jsxRuntime from './jsx-runtime'
import * as jsxDevRuntime from './jsx-dev-runtime'
/** 模块表里的 @pot/core/jsx-runtime、@pot/core/jsx-dev-runtime */
export { jsxRuntime, jsxDevRuntime }

import type { Context } from 'cordis'

/** 游戏单元的类型辅助：export default definePlugin({ name, apply(ctx) {} }) */
export function definePlugin<T = any>(plugin: { name: string; inject?: string[]; apply: (ctx: Context, config: T) => any }) {
  return plugin
}
