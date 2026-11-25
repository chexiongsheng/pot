/**
 * 原生积木（004 第 18.4、18.5 节）：选择用哪个积木的原生实现，并按批执行它的 step。
 *
 * - 宿主的 nativeBlocks() 返回 JSON：[{ name, kit, layout, collision }]，kit 为空表示系统积木。
 * - 选择：宿主有同名实现、登记表栈顶的来源对应（kit:<名字> 或 system）、TS 布局与实现的布局字符串相同。
 *   布局不同时告警一次并用 TS；游戏覆盖或 eject 了的积木用 TS。
 * - 执行：收集带这个积木的存活实体 → 打包 → 一次 nativeStep → 校验并写回。出错时告警一次，这个积木改用 TS。
 */
import type { Host } from '../host'
import { deriveLayout, packBatch, unpackBatch } from './layout'
import type { Layout, PackEnv } from './layout'
import type { BlockDef, Registry } from './registry'

export interface NativeImpl {
  name: string
  kit: string
  layout: string
  collision: boolean
}

export type NativeMode = 'auto' | 'off'

/** World 提供给原生调度的能力 */
export interface NativeEnv extends PackEnv {
  registry: Registry
  warn(message: string): void
  dt(): number
  tick(): number
  /** 用到碰撞的实现在调用前调用：碰撞表变了就把碰撞体发给宿主 */
  syncBodies(): void
}

interface Active {
  impl: NativeImpl
  layout: Layout
}

export class NativeBlocks {
  mode: NativeMode = 'auto'
  private _impls: Map<string, NativeImpl> | null = null
  private _version = -1
  private _active = new Map<string, Active>()
  private _reasons = new Map<string, string>()
  private _failed = new Set<string>()
  private _warned = new Set<string>()
  private _bufs = new Map<string, Float64Array>()
  /** 每个原生积木累计的耗时（毫秒），verify 用；为 null 时不计时 */
  timing: Map<string, number> | null = null

  constructor(private _env: NativeEnv, private _host: Host | undefined) {}

  /** 宿主提供的全部原生实现 */
  impls(): Map<string, NativeImpl> {
    if (this._impls) return this._impls
    const map = new Map<string, NativeImpl>()
    const text = this._host?.nativeBlocks?.()
    if (text) {
      try {
        for (const item of JSON.parse(text) as any[]) {
          if (!item || typeof item.name !== 'string') continue
          map.set(item.name, { name: item.name, kit: String(item.kit ?? ''), layout: String(item.layout ?? ''), collision: !!item.collision })
        }
      } catch (err) {
        this._env.warn(`原生积木列表解析失败：${(err as Error).message}`)
      }
    }
    this._impls = map
    return map
  }

  private _refresh() {
    const reg = this._env.registry
    if (this._version === reg.version) return
    this._version = reg.version
    this._active.clear()
    this._reasons.clear()
    for (const impl of this.impls().values()) {
      const def = reg.block(impl.name)
      if (!def) { this._reasons.set(impl.name, `积木 ${impl.name} 没有登记`); continue }
      const source = reg.sourceOf('block', impl.name)
      const expected = impl.kit ? `kit:${impl.kit}` : 'system'
      if (source !== expected) { this._reasons.set(impl.name, `积木 ${impl.name} 的来源是 ${source}，原生实现对应 ${expected}（被游戏覆盖或 eject 了）`); continue }
      if (!def.step) { this._reasons.set(impl.name, `积木 ${impl.name} 没有 step`); continue }
      const r = deriveLayout(def)
      if (!r.ok) { this._reasons.set(impl.name, `积木 ${impl.name} 没有布局：${r.reason}`); continue }
      if (r.layout.text !== impl.layout) {
        const reason = `积木 ${impl.name} 的原生实现与 TS 布局不同，改用 TS。\nTS：${r.layout.text}\n原生：${impl.layout}`
        this._reasons.set(impl.name, reason)
        if (!this._warned.has(reason)) { this._warned.add(reason); this._env.warn(reason) }
        continue
      }
      this._active.set(impl.name, { impl, layout: r.layout })
    }
  }

  /** 当前会走原生实现的积木名（不含 mode 为 off 与出错回退的） */
  activeNames(): string[] {
    this._refresh()
    if (this.mode === 'off') return []
    return [...this._active.keys()].filter((n) => !this._failed.has(n))
  }

  /** 积木不能用原生实现的原因；能用时为 null */
  reason(name: string): string | null {
    this._refresh()
    if (this._active.has(name)) return this._failed.has(name) ? `积木 ${name} 的原生实现出过错，已改用 TS` : null
    return this._reasons.get(name) ?? (this._host?.nativeStep ? `积木 ${name} 没有原生实现` : '当前宿主没有原生实现')
  }

  /** 高精度时间（毫秒）：宿主的 now，其次 performance.now，最后 Date.now */
  now(): number {
    const h = this._host?.now
    if (h) return h()
    const p = (globalThis as any).performance
    return p && typeof p.now === 'function' ? p.now() : Date.now()
  }

  /** 清掉出错回退的记录（verify、热重载后重试） */
  reset() {
    this._failed.clear()
  }

  /**
   * 原生执行一个积木的 step。返回 true 表示已处理（含没有实体的情况），false 表示应由 TS 执行。
   * alive 为本步开始时的实体，isAlive 过滤掉本步中途已销毁的。
   */
  run(block: BlockDef, alive: any[], isAlive: (e: any) => boolean): boolean {
    if (this.mode === 'off' || !this._host?.nativeStep) return false
    this._refresh()
    const active = this._active.get(block.name)
    if (!active || this._failed.has(block.name)) return false
    const list: { e: any; me: any }[] = []
    for (const e of alive) {
      const me = e.b[block.name]
      if (me && isAlive(e)) list.push({ e, me })
    }
    if (!list.length) return true
    const t0 = this.timing ? this.now() : 0
    try {
      if (active.impl.collision) this._env.syncBodies()
      const buf = packBatch(active.layout, list, this._env, this._env.dt(), this._env.tick(), this._bufs.get(block.name))
      this._bufs.set(block.name, buf)
      const ret: any = this._host.nativeStep(block.name, buf)
      const out = ret instanceof Float64Array ? ret : new Float64Array(ret)
      unpackBatch(active.layout, list, out)
    } catch (err) {
      this._failed.add(block.name)
      this._env.warn(`积木 ${block.name} 的原生实现出错，改用 TS：${(err as Error)?.message ?? err}`)
      return false
    } finally {
      if (this.timing) this.timing.set(block.name, (this.timing.get(block.name) ?? 0) + this.now() - t0)
    }
    return true
  }
}

