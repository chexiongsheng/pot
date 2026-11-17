/**
 * data：读取游戏数据文件（GameFS 的 data/ 目录）。
 * 记录“哪个单元读过哪个文件”，数据文件变化时开发工具据此重载相关单元。
 */
import { Context, Service } from 'cordis'
import type { Host } from './host'
import { unitOf } from './units'

declare module 'cordis' {
  interface Context {
    data: DataService
  }
}

export class DataService extends Service {
  /** path → 读取过它的单元 */
  private _readers = new Map<string, Set<string>>()

  constructor(ctx: Context, private _host: Host) {
    super(ctx, 'data')
  }

  private _track(path: string) {
    const unit = unitOf(this.ctx)
    if (!unit) return
    let set = this._readers.get(path)
    if (!set) this._readers.set(path, set = new Set())
    set.add(unit)
  }

  /** 读取文本；不存在时抛错 */
  text(path: string): string {
    path = normalize(path)
    this._track(path)
    const text = this._host.readText(`data/${path}`)
    if (text === null || text === undefined) throw new Error(`数据文件不存在：data/${path}`)
    return text
  }

  /** 读取 JSON（每次都重新解析，返回新对象，可放心修改） */
  load<T = any>(path: string): T {
    const text = this.text(path)
    try {
      return JSON.parse(text)
    } catch (error: any) {
      throw new Error(`数据文件 data/${normalize(path)} 不是合法 JSON：${error?.message ?? error}`)
    }
  }

  exists(path: string) {
    path = normalize(path)
    this._track(path)
    const text = this._host.readText(`data/${path}`)
    return text !== null && text !== undefined
  }

  /** 读取过某个数据文件的单元 */
  readers(path: string): string[] {
    return [...this._readers.get(normalize(path)) ?? []]
  }

  dependencies() {
    const result: Record<string, string[]> = {}
    for (const [path, set] of this._readers) result[path] = [...set]
    return result
  }
}

function normalize(path: string) {
  return path.replace(/\\/g, '/').replace(/^\/+/, '').replace(/^data\//, '')
}
