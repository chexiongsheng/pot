/**
 * 套件（004 第 6.12、17.2 节）：一组积木、预制件、键位映射与全局变量，经 import 引入、写进 defineGame 的 kits 后登记。
 * - 登记栈从下到上：系统、套件（按 requires 展开后的顺序）、游戏。
 * - 两个套件之间同名报错，除非游戏自己也登记了这个名字（游戏覆盖二者）；套件覆盖系统不报错。
 * - defineKit 把套件记进全局目录，只用于报错提示（“它属于套件 X”）与 pot blocks。
 */
import { isPrefab } from './node'
import type { Prefab } from './node'
import type { BlockDef } from './registry'
import type { Controls } from './world'

const KIT_NAME = /^[a-z][a-z0-9-]*$/
const KIT = Symbol.for('pot.kit')

export interface KitDef {
  name: string
  about?: string
  blocks?: BlockDef<any, any>[]
  prefabs?: Prefab<any>[]
  controls?: Controls
  /** 套件的积木要读写的 w.vars 键及初值 */
  vars?: Record<string, any>
  /** 套件对 World 事件的处理器，defineGame 用 w.on 挂上，早于游戏的处理器 */
  on?: Record<string, KitHandler>
  requires?: Kit[]
}

export type KitHandler = (w: any, payload: any) => void

export interface Kit {
  readonly name: string
  readonly about: string
  readonly blocks: readonly BlockDef<any, any>[]
  readonly prefabs: readonly Prefab<any>[]
  readonly controls?: Controls
  readonly vars?: Readonly<Record<string, any>>
  readonly on?: Readonly<Record<string, KitHandler>>
  readonly requires: readonly Kit[]
}

/** 全局目录：套件名到最近一次 defineKit 的结果（热重载时被新的替换） */
const catalog = new Map<string, Kit>()

export function isKit(value: unknown): value is Kit {
  return !!value && typeof value === 'object' && (value as any)[KIT] === true
}

export function defineKit(def: KitDef): Kit {
  if (!def || typeof def !== 'object') throw new Error('defineKit 的参数必须是对象')
  if (typeof def.name !== 'string' || !KIT_NAME.test(def.name)) {
    throw new Error(`defineKit：套件名必须是小写字母开头、只含小写字母数字和 -，收到 ${JSON.stringify(def.name)}`)
  }
  const where = `defineKit(${def.name})`
  if (def.blocks !== undefined && (!Array.isArray(def.blocks) || def.blocks.some((b) => !b || typeof b.name !== 'string'))) {
    throw new Error(`${where}：blocks 必须是 defineBlock 结果的数组`)
  }
  if (def.prefabs !== undefined && (!Array.isArray(def.prefabs) || !def.prefabs.every(isPrefab))) {
    throw new Error(`${where}：prefabs 必须是 definePrefab 结果的数组`)
  }
  if (def.vars !== undefined && (!def.vars || typeof def.vars !== 'object' || Array.isArray(def.vars))) {
    throw new Error(`${where}：vars 必须是对象`)
  }
  if (def.on !== undefined) {
    if (!def.on || typeof def.on !== 'object' || Array.isArray(def.on)) throw new Error(`${where}：on 必须是 { 事件名: 处理函数 } 对象`)
    for (const [name, fn] of Object.entries(def.on)) {
      if (typeof fn !== 'function') throw new Error(`${where}：on.${name} 必须是函数`)
    }
  }
  if (def.requires !== undefined && (!Array.isArray(def.requires) || !def.requires.every(isKit))) {
    throw new Error(`${where}：requires 必须是 defineKit 结果的数组`)
  }
  const kit: Kit = {
    name: def.name,
    about: def.about ?? '',
    blocks: Object.freeze([...(def.blocks ?? [])]),
    prefabs: Object.freeze([...(def.prefabs ?? [])]),
    controls: def.controls,
    vars: def.vars ? Object.freeze({ ...def.vars }) : undefined,
    on: def.on ? Object.freeze({ ...def.on }) : undefined,
    requires: Object.freeze([...(def.requires ?? [])]),
  }
  Object.defineProperty(kit, KIT, { value: true })
  Object.freeze(kit)
  catalog.set(kit.name, kit)
  return kit
}

/** 按 requires 展开：深度优先、依赖在前，按名字去重（先遇到的为准） */
export function expandKits(kits: readonly Kit[]): Kit[] {
  const out: Kit[] = []
  const done = new Set<string>()
  const visiting: string[] = []
  const visit = (kit: Kit) => {
    if (done.has(kit.name)) return
    if (visiting.includes(kit.name)) throw new Error(`套件的 requires 有循环：${[...visiting, kit.name].join(' → ')}`)
    visiting.push(kit.name)
    for (const dep of kit.requires) visit(dep)
    visiting.pop()
    done.add(kit.name)
    out.push(kit)
  }
  for (const kit of kits) visit(kit)
  return out
}

/** 套件之间的同名冲突（游戏自己登记了的名字除外）；返回报错文案列表 */
export function kitConflicts(kits: readonly Kit[], gameBlocks: Iterable<string>, gamePrefabs: Iterable<string>): string[] {
  const errors: string[] = []
  const check = (kind: string, names: Map<string, string>, own: Set<string>, kit: Kit, name: string) => {
    const other = names.get(name)
    if (other !== undefined && other !== kit.name && !own.has(name)) {
      errors.push(`${kind} ${name} 同时由套件 ${other} 和 ${kit.name} 提供；在游戏的 ${kind === '积木' ? 'blocks' : 'prefabs'} 里登记同名的${kind}来决定用哪个`)
    }
    names.set(name, kit.name)
  }
  const blocks = new Map<string, string>()
  const prefabs = new Map<string, string>()
  const ownBlocks = new Set(gameBlocks)
  const ownPrefabs = new Set(gamePrefabs)
  for (const kit of kits) {
    for (const b of kit.blocks) check('积木', blocks, ownBlocks, kit, b.name)
    for (const p of kit.prefabs) check('预制件', prefabs, ownPrefabs, kit, p.prefab)
  }
  return errors
}

/** 合并 vars：套件按顺序、游戏最后；两个套件声明同一个键时报错（游戏也声明了的除外） */
export function mergeKitVars(kits: readonly Kit[], own: Record<string, any> | undefined): { vars: Record<string, any> | undefined; errors: string[] } {
  const errors: string[] = []
  const owner = new Map<string, string>()
  const out: Record<string, any> = {}
  let any = false
  for (const kit of kits) {
    if (!kit.vars) continue
    for (const key of Object.keys(kit.vars)) {
      const other = owner.get(key)
      if (other !== undefined && other !== kit.name && !(own && key in own)) {
        errors.push(`变量 ${key} 同时由套件 ${other} 和 ${kit.name} 声明；在游戏的 vars 里声明它来决定初值`)
      }
      owner.set(key, kit.name)
      out[key] = kit.vars[key]
      any = true
    }
  }
  if (own) {
    Object.assign(out, own)
    any = true
  }
  return { vars: any ? out : undefined, errors }
}

/** 合并键位：套件按顺序、游戏最后，按动作名（轴名）覆盖 */
export function mergeControls(kits: readonly Kit[], own: Controls | undefined): Controls | undefined {
  const list = [...kits.map((k) => k.controls), own].filter(Boolean) as Controls[]
  if (!list.length) return undefined
  const out: Controls = { axes: {}, actions: {} }
  for (const c of list) {
    Object.assign(out.axes!, c.axes)
    Object.assign(out.actions!, c.actions)
  }
  return out
}

/** 名字属于哪个（已 defineKit 过的）套件 */
export function kitOf(kind: 'block' | 'prefab', name: string): string | undefined {
  for (const kit of catalog.values()) {
    const has = kind === 'block' ? kit.blocks.some((b) => b.name === name) : kit.prefabs.some((p) => p.prefab === name)
    if (has) return kit.name
  }
}

/** 未知积木、预制件报错的补充提示 */
export function kitHint(kind: 'block' | 'prefab', name: string): string {
  const kit = kitOf(kind, name)
  return kit ? `，它属于套件 ${kit}，请加到 defineGame 的 kits` : ''
}

/** 全局目录的快照（pot blocks 用） */
export function knownKits(): Kit[] {
  return [...catalog.values()]
}
