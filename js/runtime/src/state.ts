/**
 * state：常驻状态服务。插件把需要跨热重载保留的数据放这里。
 * - define(key, { version, init, migrate }) 返回“活对象”，插件直接改它
 * - 顶层值必须是对象或数组（这样才能返回同一个引用）
 * - 每个 key 归属定义它的单元；不同单元定义同一个 key 报错
 * - 版本变化时调 migrate，失败则 init 并告警
 * - validate 校验沿用下来的数据（读档、冷重启、热重载），不通过则 init 并告警
 * - 冷重启时宿主保存 exportJSON()，新环境用 importJSON() 恢复
 */
import { Context, Service } from 'cordis'
import { assertSerializable, decode, deepClone, encode } from './serialize'
import { unitOf } from './units'

declare module 'cordis' {
  interface Context {
    state: StateService
  }
}

export interface StateOptions<T> {
  /** 数据结构版本，结构变化时 +1 */
  version?: number
  init: () => T
  /** 旧版本数据迁移；返回新数据。抛错则回退到 init */
  migrate?: (old: any, oldVersion: number) => T
  /**
   * 校验沿用下来的数据（读档恢复、冷重启、热重载、migrate 的结果；刚 init 的不校验）。
   * - 返回 true / undefined：通过；可以在函数里就地修正个别字段后返回 true
   * - 返回 false 或字符串（原因）：丢弃，用 init 重新初始化并告警
   * - 抛错：同 false
   * 重新初始化时尽量原地写回，其他单元已持有的引用仍然有效。
   */
  validate?: (value: T) => boolean | string | void
}

interface Entry {
  value: any
  owner: string
  version: number
  /** 本次运行中是否已被 define 过（用于区分“恢复来的旧数据”） */
  defined: boolean
}

export interface StateSnapshot {
  [key: string]: { owner: string; version: number; value: any }
}

function assertContainer(key: string, value: any) {
  if (value === null || typeof value !== 'object') {
    throw new TypeError(`state.define("${key}") 的 init 必须返回对象或数组，以便返回同一个引用；标量请包一层，如 { value: 0 }`)
  }
}

export class StateService extends Service {
  private _entries = new Map<string, Entry>()

  constructor(ctx: Context) {
    super(ctx, 'state')
  }

  define<T extends object>(key: string, options: StateOptions<T>): T {
    const owner = unitOf(this.ctx) ?? '(host)'
    const version = options.version ?? 1
    const existing = this._entries.get(key)
    if (existing) {
      if (existing.owner !== owner) {
        throw new Error(`state key "${key}" 已被单元 "${existing.owner}" 定义，单元 "${owner}" 不能重复定义；请改名或通过 state.get 读取`)
      }
      existing.defined = true
      if (existing.version === version) return this._validate(key, existing, options)
      let next: any
      if (options.migrate) {
        try {
          next = options.migrate(existing.value, existing.version)
          assertContainer(key, next)
          assertSerializable(next, key)
        } catch (error) {
          this.ctx.logger('state').warn('state "%s" 从 v%d 迁移到 v%d 失败，已重新初始化：%s', key, existing.version, version, error)
          next = undefined
        }
      } else {
        this.ctx.logger('state').warn('state "%s" 版本 v%d → v%d 且未提供 migrate，已重新初始化', key, existing.version, version)
      }
      existing.version = version
      if (next === undefined) {
        existing.value = this._init(key, options)
        return existing.value
      }
      existing.value = next
      return this._validate(key, existing, options)
    }
    const value = this._init(key, options)
    this._entries.set(key, { value, owner, version, defined: true })
    return value
  }

  /** 校验沿用下来的数据；不通过时用 init 重新初始化（尽量原地写回） */
  private _validate<T>(key: string, entry: Entry, options: StateOptions<T>): T {
    if (!options.validate) return entry.value
    let reason: string | undefined
    try {
      const result = options.validate(entry.value)
      if (result === false) reason = '校验未通过'
      else if (typeof result === 'string') reason = result
    } catch (error: any) {
      reason = `校验出错：${error?.message ?? error}`
    }
    if (reason === undefined) {
      try {
        assertSerializable(entry.value, key)
        return entry.value
      } catch (error: any) {
        reason = `校验修正后不可序列化：${error?.message ?? error}`
      }
    }
    this.ctx.logger('state').warn('state "%s" 沿用的数据无效（%s），已重新初始化', key, reason)
    const fresh = this._init(key, options)
    if (sameShape(entry.value, fresh)) assignInPlace(entry.value, fresh)
    else entry.value = fresh
    return entry.value
  }

  private _init<T>(key: string, options: StateOptions<T>) {
    const value = options.init()
    assertContainer(key, value)
    assertSerializable(value, key)
    return value
  }

  has(key: string) {
    return this._entries.has(key)
  }

  get<T = any>(key: string): T | undefined {
    return this._entries.get(key)?.value
  }

  /** 整体替换（会断开旧引用，插件持有的活对象需要重新 define/get） */
  set(key: string, value: any) {
    assertContainer(key, value)
    assertSerializable(value, key)
    const entry = this._entries.get(key)
    if (entry) entry.value = value
    else this._entries.set(key, { value, owner: unitOf(this.ctx) ?? '(host)', version: 1, defined: false })
  }

  keys() {
    return [...this._entries.keys()]
  }

  ownerKeys(unit: string) {
    return [...this._entries].filter(([, e]) => e.owner === unit).map(([k]) => k)
  }

  info() {
    return [...this._entries].map(([key, e]) => ({ key, owner: e.owner, version: e.version }))
  }

  /** 深拷贝快照（含校验）。keys 省略表示全部 */
  snapshot(keys?: string[]): StateSnapshot {
    const result: StateSnapshot = {}
    for (const key of keys ?? this._entries.keys()) {
      const entry = this._entries.get(key)
      if (!entry) continue
      assertSerializable(entry.value, key)
      result[key] = { owner: entry.owner, version: entry.version, value: deepClone(entry.value) }
    }
    return result
  }

  /**
   * 用快照恢复：尽量原地写回，保持插件持有的引用有效。
   * keys 指定时，快照中没有但当前存在的 key 会被删除（回滚新版本定义的 key）。
   */
  restore(snapshot: StateSnapshot, keys?: string[]) {
    for (const key of keys ?? []) {
      if (!(key in snapshot)) this._entries.delete(key)
    }
    for (const key of Object.keys(snapshot)) {
      const saved = snapshot[key]
      const entry = this._entries.get(key)
      const value = deepClone(saved.value)
      if (entry && sameShape(entry.value, value)) {
        assignInPlace(entry.value, value)
        entry.owner = saved.owner
        entry.version = saved.version
      } else {
        this._entries.set(key, { value, owner: saved.owner, version: saved.version, defined: entry?.defined ?? false })
      }
    }
  }

  reset(key?: string) {
    if (key === undefined) this._entries.clear()
    else this._entries.delete(key)
  }

  /** 导出为 JSON 字符串（TypedArray 编码），用于冷重启 */
  exportJSON() {
    return JSON.stringify(encode(this.snapshot()))
  }

  importJSON(json: string) {
    if (!json) return
    const data = decode(JSON.parse(json)) as StateSnapshot
    for (const key of Object.keys(data)) {
      const saved = data[key]
      this._entries.set(key, { value: saved.value, owner: saved.owner, version: saved.version, defined: false })
    }
  }
}

function sameShape(a: any, b: any) {
  return a && b && typeof a === 'object' && typeof b === 'object' && Array.isArray(a) === Array.isArray(b) && !ArrayBuffer.isView(a)
}

function assignInPlace(target: any, source: any) {
  if (Array.isArray(target)) {
    target.length = 0
    target.push(...source)
    return
  }
  for (const key of Object.keys(target)) {
    if (!(key in source)) delete target[key]
  }
  Object.assign(target, source)
}
