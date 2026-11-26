/**
 * 积木与预制件的登记。
 * - defineBlock / definePrefab 只构造定义，不登记；登记由 Registry 完成（官方的在 WorldService 构造时，游戏的在 defineGame 里）。
 * - 同名登记按栈处理：后登记的覆盖先登记的（游戏覆盖官方），撤销后露出原来的。
 * - 积木的执行顺序：order 小的先，同 order 按名字第一次登记的先后（热重载后不变）。
 * - 每个条目带来源（17.2）：system、kit:<套件名>、game，供 pot blocks 与冲突检查使用。
 */
import type { Context } from 'cordis'
import { PREFAB, isPrefab, makeNode } from './node'
import type { Prefab, PotNode } from './node'
import type { NativeHint } from './layout'

/** 实体标签与 w.spawn 上不是积木名的属性 */
export const RESERVED = new Set(['key', 'at', 'rot', 'scale', 'name', 'tags', 'keep', 'children'])
/** 预制件定义里不是积木名的字段 */
export const PREFAB_RESERVED = new Set(['is', 'tags', 'about'])

const IDENT = /^[a-z][A-Za-z0-9]*$/

export interface BlockDef<P extends object = any, S extends object = any> {
  name: string
  about: string
  props?: P
  state?: S
  order?: number
  /** 原生实现的布局提示（18.3）：缺省值推不出类型的字段在这里给出，如 { fallY: 'f?', actions: { jump: 'action' } } */
  native?: Record<string, NativeHint>
  init?(me: P & S, e: any, w: any): void
  step?(me: P & S, e: any, w: any): void
  view?: {
    /** 建表现的相对耗时（缺省 1）：启动预热按它加权推进进度条（17.13） */
    cost?: number
    enter?(me: P & S, e: any, ctx: Context, w: any): any
    update?(me: P & S, e: any, objs: any[], ctx: Context, w: any): void
    exit?(me: P & S, e: any, objs: any[], ctx: Context, w: any): void
  }
}

export function defineBlock<P extends object = {}, S extends object = {}>(def: BlockDef<P, S>): BlockDef<P, S> {
  if (!def || typeof def.name !== 'string' || !IDENT.test(def.name)) {
    throw new Error(`defineBlock：积木名必须是小写开头的驼峰标识符，收到 ${JSON.stringify(def?.name)}`)
  }
  if (RESERVED.has(def.name) || PREFAB_RESERVED.has(def.name)) throw new Error(`defineBlock：积木名 "${def.name}" 是保留属性`)
  if (def.props !== undefined && !isPlainObject(def.props)) throw new Error(`defineBlock(${def.name})：props 必须是普通对象`)
  if (def.state !== undefined && !isPlainObject(def.state)) throw new Error(`defineBlock(${def.name})：state 必须是普通对象`)
  for (const key of Object.keys(def.state ?? {})) {
    if (def.props && key in def.props) throw new Error(`defineBlock(${def.name})：字段 "${key}" 同时出现在 props 与 state 里`)
  }
  return def
}

/** def.about：一句话说明（pot blocks 显示） */
export function definePrefab<P = any>(name: string, def: { is?: Prefab | string; tags?: string[]; about?: string; [block: string]: any } = {}): Prefab<P> {
  if (typeof name !== 'string' || !IDENT.test(name)) throw new Error(`definePrefab：预制件名必须是小写开头的驼峰标识符，收到 ${JSON.stringify(name)}`)
  if (!isPlainObject(def)) throw new Error(`definePrefab(${name})：定义必须是普通对象`)
  const prefab = ((props: any) => makeNode(prefab, props, props?.key)) as any
  Object.defineProperty(prefab, 'name', { value: name })
  Object.defineProperty(prefab, PREFAB, { value: true })
  Object.defineProperty(prefab, 'prefab', { value: name, enumerable: true })
  Object.defineProperty(prefab, 'def', { value: def, enumerable: true })
  return prefab
}

/** 登记来源：system、kit:<套件名>、game */
export type RegistrySource = string

interface Entry<T> {
  value: T
  token: object
  source: RegistrySource
}

export class Registry {
  private _blocks = new Map<string, Entry<BlockDef>[]>()
  private _prefabs = new Map<string, Entry<Prefab>[]>()
  /** 名字第一次登记的序号，决定同 order 积木的先后 */
  private _seen = new Map<string, number>()
  /** 内容变化时加一，供缓存失效 */
  version = 0

  /** 登记积木，返回撤销函数 */
  addBlock(def: BlockDef, source: RegistrySource = 'game'): () => void {
    defineBlock(def)
    if (!this._seen.has(def.name)) this._seen.set(def.name, this._seen.size)
    return this._push(this._blocks, def.name, def, source)
  }

  /** 登记预制件，返回撤销函数 */
  addPrefab(prefab: Prefab, source: RegistrySource = 'game'): () => void {
    if (!isPrefab(prefab)) throw new Error('登记预制件：需要 definePrefab 的返回值')
    return this._push(this._prefabs, prefab.prefab, prefab, source)
  }

  private _push<T>(map: Map<string, Entry<T>[]>, name: string, value: T, source: RegistrySource) {
    let stack = map.get(name)
    if (!stack) map.set(name, stack = [])
    const entry = { value, token: {}, source }
    stack.push(entry)
    this.version++
    return () => {
      const list = map.get(name)
      const i = list ? list.indexOf(entry) : -1
      if (i < 0) return
      list!.splice(i, 1)
      if (!list!.length) map.delete(name)
      this.version++
    }
  }

  block(name: string): BlockDef | undefined {
    const stack = this._blocks.get(name)
    return stack?.[stack.length - 1].value
  }

  prefab(name: string): Prefab | undefined {
    const stack = this._prefabs.get(name)
    return stack?.[stack.length - 1].value
  }

  /** 栈顶条目的来源；没登记返回 undefined */
  sourceOf(kind: 'block' | 'prefab', name: string): RegistrySource | undefined {
    const stack = (kind === 'block' ? this._blocks : this._prefabs).get(name) as Entry<unknown>[] | undefined
    return stack?.[stack.length - 1].source
  }

  /** 预制件链上的名字（从根到叶）；未知的预制件只返回它自己 */
  chain(name: string): string[] {
    const out: string[] = []
    let current: Prefab | string | undefined = name
    for (let guard = 0; current !== undefined && guard < 32; guard++) {
      const p: Prefab | undefined = typeof current === 'string' ? this.prefab(current) : current
      const n = typeof current === 'string' ? current : current.prefab
      out.unshift(n)
      current = p?.def.is
    }
    return out
  }

  blockNames() {
    return [...this._blocks.keys()]
  }

  prefabNames() {
    return [...this._prefabs.keys()]
  }

  /** 按执行顺序排好的积木 */
  ordered(): BlockDef[] {
    return [...this._blocks.keys()]
      .map((name) => this.block(name)!)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || this._seen.get(a.name)! - this._seen.get(b.name)!)
  }
}

export function isPlainObject(value: unknown): value is Record<string, any> {
  if (!value || typeof value !== 'object') return false
  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

/** 深拷贝普通数据（对象、数组、基本值）；函数等原样保留 */
export function clone<T>(value: T): T {
  if (Array.isArray(value)) return value.map(clone) as any
  if (isPlainObject(value)) {
    const out: any = {}
    for (const key of Object.keys(value)) out[key] = clone((value as any)[key])
    return out
  }
  return value
}

/** 深合并：普通对象逐字段合并，数组和其他值整个替换。不修改参数，返回新对象 */
export function merge(base: any, over: any): any {
  if (over === undefined) return clone(base)
  if (isPlainObject(base) && isPlainObject(over)) {
    const out: any = clone(base)
    for (const key of Object.keys(over)) out[key] = merge(base[key], over[key])
    return out
  }
  return clone(over)
}

export type { PotNode }
