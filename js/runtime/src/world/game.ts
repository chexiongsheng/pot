/**
 * defineGame（004 第 5.1、15.11 节）：把游戏描述对象变成一个普通单元 { apply(ctx) }。
 * 不设 name，由加载器按文件名命名；挂载 id 默认就是单元名。
 */
import type { Context } from 'cordis'
import type { DataService } from '../data'
import type { UIService } from '../ui'
import type { InputService } from '../input'
import type { AudioService } from '../audio'
import type { PotChild, Prefab } from './node'
import { isPrefab } from './node'
import type { BlockDef } from './registry'
import { expandKits, isKit, kitConflicts, mergeControls, mergeKitVars } from './kit'
import type { Kit } from './kit'
import { checkFlow } from './flow'
import type { FlowDef } from './flow'
import { unitOf } from '../units'
import { createUIRenderer } from './ui-eval'
import type { Controls, EntityData, World } from './world'

/** ui 的第二个参数（16.3） */
export interface GameUI {
  readonly width: number
  readonly height: number
  /** 界面本地状态：存在 state 里（热重载保留），不属于 World，不进录像 */
  local: Record<string, any>
  /** 发界面事件：进入下一步的指令，按自定义事件分发（可触发流程切换） */
  emit(name: string, payload?: any): void
  /** 当前焦点控件的 key 路径 */
  readonly focused: string | null
  /** 原始的 ctx.ui：在树之后画任意即时模式内容 */
  draw: UIService
  /** 原始的 ctx.input（只读用）：按键快捷键、窗口焦点、鼠标锁定。改 World 仍经 emit */
  input: InputService
  /** 原始的 ctx.audio：界面音效 */
  audio: AudioService
  /** 数据文件（与 scene 的 s.data 相同；每次 load 都重新解析，界面里频繁用时自己缓存） */
  data: DataService
}

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
  /** 引入的套件（17.2）：按 requires 展开后先于 blocks、prefabs 登记，controls 先于游戏的合并 */
  kits?: Kit[]
  /** 键位到指令的映射，不写用默认映射 */
  controls?: Controls
  /** 流程：状态、事件到状态的映射、叠加状态（16.2） */
  flow?: FlowDef
  /** 游戏自写的、只在运行时才按名字用到的积木 */
  blocks?: BlockDef<any, any>[]
  /** 游戏自写的、只在运行时才按名字用到的预制件（w.spawn('名字')） */
  prefabs?: Prefab<any>[]
  /**
   * 预载（004 第 17.13 节）：在登记积木、vars 之后、挂载场景之前执行，用来预读数据、模型、编译材质。
   * step(文字, 0..1) 报本单元内的进度并在启动加载期按预算让帧。热重载时也会执行（不让帧），应可重复执行；
   * 不要自己等帧。step 的第三个参数 until 给接下来 ctx.use 的子单元划出本单元内 progress..until 的区间。
   */
  load?: (ctx: Context, step: (text: string, progress?: number, until?: number) => Promise<void>) => void | Promise<void>
  /** 世界里有什么：返回标签树，挂到 ctx.world 上 */
  scene?: (s: SceneArgs) => PotChild
  /** 屏幕上画什么：每帧求值，画到 ctx.ui */
  ui?: (w: GameWorld<V>, ui: GameUI) => PotChild
}

/** 覆盖层 data/overrides.json 里本单元挂载的部分（16.7）；读过它的单元在文件变化时热重载 */
function readOverrides(ctx: Context, mount: string): Record<string, any> | undefined {
  if (!ctx.data.exists('overrides.json')) return undefined
  let all: any
  try {
    all = ctx.data.load('overrides.json')
  } catch (error: any) {
    ctx.logger('world').error(error?.message ?? String(error))
    return undefined
  }
  const mine = all?.[mount]
  if (mine === undefined) return undefined
  if (!mine || typeof mine !== 'object' || Array.isArray(mine)) {
    ctx.logger('world').error('data/overrides.json 的 "%s" 必须是 { key 路径: 属性补丁 }', mount)
    return undefined
  }
  return mine
}

export interface GameUnit {
  apply(ctx: Context): void | Promise<void>
}

export function defineGame<V extends Record<string, any> = Record<string, any>>(def: GameDef<V>): GameUnit {
  if (!def || typeof def !== 'object') throw new Error('defineGame 的参数必须是对象')
  for (const key of ['scene', 'ui', 'load'] as const) {
    if (def[key] !== undefined && typeof def[key] !== 'function') throw new Error(`defineGame：${key} 必须是${key === 'load' ? '函数' : '返回标签树的函数'}`)
  }
  if (def.blocks !== undefined && !Array.isArray(def.blocks)) throw new Error('defineGame：blocks 必须是 defineBlock 结果的数组')
  if (def.prefabs !== undefined && (!Array.isArray(def.prefabs) || !def.prefabs.every(isPrefab))) {
    throw new Error('defineGame：prefabs 必须是 definePrefab 结果的数组')
  }
  if (def.kits !== undefined && (!Array.isArray(def.kits) || !def.kits.every(isKit))) {
    throw new Error('defineGame：kits 必须是套件的数组（import 套件 from \'@pot/kit/<名字>\'）')
  }
  const kits = expandKits(def.kits ?? [])
  const conflicts = kitConflicts(kits, (def.blocks ?? []).map((b) => b.name), (def.prefabs ?? []).map((p) => p.prefab))
  const merged = mergeKitVars(kits, def.vars)
  conflicts.push(...merged.errors)
  if (conflicts.length) throw new Error(`defineGame：${conflicts.join('；')}`)
  const controls = mergeControls(kits, def.controls)
  const flow = def.flow === undefined ? undefined : checkFlow(def.flow)
  return {
    apply(ctx: Context) {
      const w = ctx.world
      const unit = unitOf(ctx) ?? '(host)'
      if (flow) ctx.effect(() => w.setFlow(flow, unit), 'world.flow')
      for (const kit of kits) {
        const source = `kit:${kit.name}`
        for (const block of kit.blocks) ctx.effect(() => w.registry.addBlock(block, source), `world.block(${block.name})`)
        for (const prefab of kit.prefabs) ctx.effect(() => w.registry.addPrefab(prefab, source), `world.prefab(${prefab.prefab})`)
        if (kit.on) for (const name of Object.keys(kit.on)) w.on(name, kit.on[name])
      }
      for (const block of def.blocks ?? []) ctx.effect(() => w.registry.addBlock(block, 'game'), `world.block(${block.name})`)
      for (const prefab of def.prefabs ?? []) ctx.effect(() => w.registry.addPrefab(prefab, 'game'), `world.prefab(${prefab.prefab})`)
      // 没有 kits 与 controls 的单元不碰映射：否则多个 defineGame 单元时后加载的会把前面的清掉
      if (controls) ctx.effect(() => {
        w.setControls(controls)
        const applied = w.controls
        // 热重载时新旧单元的先后不定：只撤销自己设的
        return () => {
          if (w.controls === applied) w.setControls(undefined)
        }
      }, 'world.controls')
      w.mergeVars(merged.vars)
      const loading = ctx.loading
      const starting = loading.active
      const [lo, hi] = loading.window
      const scene = def.scene
      const ui = def.ui
      // 进度区间：load 与预热都有时 load 占前 80%
      const mid = def.load && scene ? lo + (hi - lo) * 0.8 : hi

      const setupScene = () => {
        if (!scene) return
        const mountScene = () => {
          const s = w.flowScene
          w.mount(scene({ state: s.state, params: s.params, data: ctx.data }), { overrides: readOverrides(ctx, unit) })
        }
        mountScene()
        if (flow) w.onFlowEnter(mountScene)
      }

      const setupUI = () => {
        if (!ui) return
        const logger = ctx.logger('world')
        const render = createUIRenderer((message) => logger.error(message), (message) => logger.warn(message))
        const key = `ui:${unit}`
        ctx.state.define<Record<string, any>>(key, { version: 1, init: () => ({}) })
        const emit = (name: string, payload?: any) => w.emitUI(name, payload)
        const capture = (on: boolean) => w.setUICapture(unit, on)
        ctx.effect(() => () => w.setUICapture(unit, false), 'world.uiCapture')
        let lastError = ''
        ctx.on('update', () => {
          // state.restore 可能换掉对象：每帧重新取
          const local = ctx.state.get<Record<string, any>>(key) ?? {}
          const gui: GameUI = {
            get width() { return ctx.ui.width },
            get height() { return ctx.ui.height },
            local,
            emit,
            get focused() { return local.$focus ?? null },
            draw: ctx.ui,
            input: ctx.input,
            audio: ctx.audio,
            data: ctx.data,
          }
          let tree: PotChild
          try {
            tree = ui(w as World as GameWorld<V>, gui)
          } catch (error: any) {
            const message = `ui 出错：${error?.stack ?? error?.message ?? error}`
            if (message !== lastError) logger.error(message)
            lastError = message
            return
          }
          lastError = ''
          render(tree, { ui: ctx.ui, input: ctx.input, local, emit, capture })
        })
      }

      // 启动加载期提前建好本挂载实体的表现，按积木的 view.cost 加权回报“生成场景 k/n”（17.13）；
      // 从 load 实际报到的位置接着走，load 没报进度时预热独占整个区间
      const warm = async () => {
        const mount = w.data.mounts[unit]
        if (!mount) return
        const list: { e: EntityData; cost: number; path: string }[] = []
        let total = 0
        for (const [path, rec] of Object.entries(mount.keys)) {
          const e = !rec.dead && w.data.entities[rec.id]
          const cost = e ? w.view.viewCost(e) : 0
          if (!e || cost <= 0) continue
          list.push({ e, cost, path })
          total += cost
        }
        const from = Math.min(hi, Math.max(lo, loading.progress))
        const slow: { path: string; blocks: string; ms: number }[] = []
        let done = 0
        for (let k = 0; k < list.length; k++) {
          const { e, cost, path } = list[k]
          // 预热期间实体可能已被别处删掉（例如 load 之外的异步代码）
          if (w.data.entities[e.id] !== e) continue
          const t0 = Date.now()
          w.view.warm(e)
          const ms = Date.now() - t0
          if (ms > 100) slow.push({ path, blocks: Object.keys(e.b).filter((n) => w.registry.block(n)?.view).join('、'), ms })
          done += cost
          await loading.step(`生成场景 ${k + 1}/${list.length}`, from + (hi - from) * done / total)
        }
        if (slow.length) {
          slow.sort((a, b) => b.ms - a.ms)
          ctx.logger('world').info('预热最慢：%s', slow.slice(0, 3).map((s) => `${s.path}（${s.blocks}）${s.ms} ms`).join('；'))
        }
      }

      const finish = (): void | Promise<void> => {
        setupScene()
        setupUI()
        if (starting && scene && loading.active) return warm()
      }

      if (!def.load) return finish()
      const toAbs = (v: unknown) => lo + (mid - lo) * Math.min(1, Math.max(0, Number(v) || 0))
      const step = (text: string, progress = 0, until?: number) => {
        const p = toAbs(progress)
        // 给子单元划区间：load 里接下来 ctx.use 的单元落在 p..until 内（17.13）
        if (until !== undefined) loading.within(p, Math.max(p, toAbs(until)))
        // 热重载时不让帧：回收与重新 apply 之间不能插进固定步（15.6）
        if (!starting || !loading.active) return Promise.resolve()
        return loading.step(text, p)
      }
      const done = () => {
        loading.within(lo, hi)
        return finish()
      }
      const loaded = def.load(ctx, step)
      if (loaded && typeof (loaded as any).then === 'function') return (loaded as Promise<void>).then(done)
      return done()
    },
  }
}
