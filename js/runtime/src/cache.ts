/**
 * cache：可丢弃的派生数据（生成的网格、寻路表、解析结果……）。
 * LRU + 字节预算；丢了能重算，所以不参与热重载快照。
 */
import { Context, Service } from 'cordis'
import { estimateSize, hash } from './serialize'

declare module 'cordis' {
  interface Context {
    cache: CacheService
  }
}

interface Item {
  value: any
  size: number
}

export class CacheService extends Service {
  /** 预算字节数 */
  budget = 64 * 1024 * 1024
  private _items = new Map<string, Item>()
  private _bytes = 0
  hits = 0
  misses = 0

  constructor(ctx: Context) {
    super(ctx, 'cache')
  }

  hash = hash

  get<T = any>(key: string): T | undefined {
    const item = this._items.get(key)
    if (!item) {
      this.misses++
      return
    }
    this.hits++
    // 刷新 LRU 顺序
    this._items.delete(key)
    this._items.set(key, item)
    return item.value
  }

  has(key: string) {
    return this._items.has(key)
  }

  set<T>(key: string, value: T, size = estimateSize(value)): T {
    this.delete(key)
    this._items.set(key, { value, size })
    this._bytes += size
    this._evict()
    return value
  }

  /** 以 name + deps 的 hash 为 key，命中返回缓存，否则调用 factory 生成 */
  getOrCreate<T>(name: string, deps: any, factory: () => T): T {
    const key = `${name}:${hash(deps)}`
    const item = this._items.get(key)
    if (item) {
      this.hits++
      this._items.delete(key)
      this._items.set(key, item)
      return item.value
    }
    this.misses++
    return this.set(key, factory())
  }

  delete(key: string) {
    const item = this._items.get(key)
    if (!item) return false
    this._bytes -= item.size
    this._items.delete(key)
    return true
  }

  clear() {
    this._items.clear()
    this._bytes = 0
  }

  stats() {
    return { count: this._items.size, bytes: this._bytes, budget: this.budget, hits: this.hits, misses: this.misses }
  }

  private _evict() {
    for (const [key, item] of this._items) {
      if (this._bytes <= this.budget) break
      this._items.delete(key)
      this._bytes -= item.size
    }
  }
}
