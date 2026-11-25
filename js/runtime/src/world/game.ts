/**
 * defineGame（004 第 5.1、15.11 节）：把游戏描述对象变成一个普通单元 { apply(ctx) }。
 * 不设 name，由加载器按文件名命名；挂载 id 默认就是单元名。
 */
import type { Context } from 'cordis'
import type { DataService } from '../data'
import type { UIService } from '../ui'
import type { PotChild, Prefab } from './node'
import { isPrefab } from './node'
import type { BlockDef } from './registry'
import { checkFlow } from './flow'
import type { FlowDef } from './flow'
import { unitOf } from '../units'
import { createUIRenderer } from './ui-eval'
import type { Controls, World } from './world'

/** scene 的参数：只有流程状态、流程参数与数据文件，不能读运行状态 */
export interface SceneArgs {
  state: string
  params: Record<string, any>
  data: DataService
}

export type GameWorld<V> = World & { vars: V }

export interface GameDef<V extends Record<string, any> = Record<string, any>> {
  /** 全局变量及初值：WorldData.vars 里没有的键补上，已有的保留 */
  vars?: V
  /** 键位到指令的映射，不写用默认映射 */
  controls?: Controls
  /** 流程：状态、事件到状态的映射、叠加状态（16.2） */
  flow?: FlowDef
  /** 游戏自写的、只在运行时才按名字用到的积木 */
  blocks?: BlockDef<any, any>[]
  /** 游戏自写的、只在运行时才按名字用到的预制件（w.spawn('名字')） */
  prefabs?: Prefab<any>[]
  /** 世界里有什么：返回标签树，挂到 ctx.world 上 */
  scene?: (s: SceneArgs) => PotChild
  /** 屏幕上画什么：每帧求值，画到 ctx.ui */
  ui?: (w: GameWorld<V>, ui: UIService) => PotChild
}

export interface GameUnit {
  apply(ctx: Context): void
}

export function defineGame<V extends Record<string, any> = Record<string, any>>(def: GameDef<V>): GameUnit {
  if (!def || typeof def !== 'object') throw new Error('defineGame 的参数必须是对象')
  for (const key of ['scene', 'ui'] as const) {
    if (def[key] !== undefined && typeof def[key] !== 'function') throw new Error(`defineGame：${key} 必须是返回标签树的函数`)
  }
  if (def.blocks !== undefined && !Array.isArray(def.blocks)) throw new Error('defineGame：blocks 必须是 defineBlock 结果的数组')
  if (def.prefabs !== undefined && (!Array.isArray(def.prefabs) || !def.prefabs.every(isPrefab))) {
    throw new Error('defineGame：prefabs 必须是 definePrefab 结果的数组')
  }
  const flow = def.flow === undefined ? undefined : checkFlow(def.flow)
  return {
    apply(ctx: Context) {
      const w = ctx.world
      const unit = unitOf(ctx) ?? '(host)'
      if (flow) ctx.effect(() => w.setFlow(flow, unit), 'world.flow')
      for (const block of def.blocks ?? []) ctx.effect(() => w.registry.addBlock(block), `world.block(${block.name})`)
      for (const prefab of def.prefabs ?? []) ctx.effect(() => w.registry.addPrefab(prefab), `world.prefab(${prefab.prefab})`)
      ctx.effect(() => {
        w.setControls(def.controls)
        const applied = w.controls
        // 热重载时新旧单元的先后不定：只撤销自己设的
        return () => {
          if (w.controls === applied) w.setControls(undefined)
        }
      }, 'world.controls')
      w.mergeVars(def.vars)
      const scene = def.scene
      if (scene) {
        const mountScene = () => {
          const s = w.flowScene
          w.mount(scene({ state: s.state, params: s.params, data: ctx.data }))
        }
        mountScene()
        if (flow) w.onFlowEnter(mountScene)
      }
      const ui = def.ui
      if (ui) {
        const logger = ctx.logger('world')
        const render = createUIRenderer((message) => logger.error(message))
        let lastError = ''
        ctx.on('update', () => {
          let tree: PotChild
          try {
            tree = ui(w as GameWorld<V>, ctx.ui)
          } catch (error: any) {
            const message = `ui 出错：${error?.stack ?? error?.message ?? error}`
            if (message !== lastError) logger.error(message)
            lastError = message
            return
          }
          lastError = ''
          render(tree, ctx.ui)
        })
      }
    },
  }
}
