/**
 * data：读取游戏数据文件（GameFS 的 data/ 目录）。
 * 记录“哪个单元读过哪个文件”，数据文件变化时开发工具据此重载相关单元。
 *
 * 套件资源（004 第 19.3 节 A）：路径写成 @pot/kit/<名字>/<路径> 时，先读游戏的 data/kits/<名字>/<路径>
 * （pot build 或 pot eject 复制的副本），没有再读宿主的套件目录（host.readKit）。
 * 读者同时登记在 @pot/kit/<名字>/<路径> 与 kits/<名字>/<路径> 两个键下，套件目录与游戏副本的变化都能找到读者。
 */
import { Context, Service } from 'cordis'
import type { Host } from './host'
import { unitOf } from './units'

declare module 'cordis' {
  interface Context {
    data: DataService
  }
}

export const KIT_PREFIX = '@pot/kit/'
const KIT_PATH = /^([a-z][a-z0-9-]*)\/(.+)$/

export class DataService extends Service {
  /** path → 读取过它的单元 */
  private _readers = new Map<string, Set<string>>()

  constructor(ctx: Context, private _host: Host) {
    super(ctx, 'data')
  }

  private _track(path: string) {
    const unit = unitOf(this.ctx)
    if (!unit) return
    for (const key of path.startsWith(KIT_PREFIX) ? [path, `kits/${path.slice(KIT_PREFIX.length)}`] : [path]) {
      let set = this._readers.get(key)
      if (!set) this._readers.set(key, set = new Set())
      set.add(unit)
    }
  }

  private _read(path: string): string | null {
    if (!path.startsWith(KIT_PREFIX)) return this._host.readText(`data/${path}`) ?? null
    const rest = path.slice(KIT_PREFIX.length)
    if (!KIT_PATH.test(rest) || rest.split('/').includes('..')) throw new Error(`套件资源路径不对："${path}"，应为 @pot/kit/<名字>/<路径>`)
    const local = this._host.readText(`data/kits/${rest}`)
    if (local !== null && local !== undefined) return local
    return this._host.readKit?.(rest) ?? null
  }

  /** 读取文本；不存在时抛错 */
  text(path: string): string {
    path = normalize(path)
    this._track(path)
    const text = this._read(path)
    if (text === null || text === undefined) throw new Error(`数据文件不存在：${display(path)}`)
    return text
  }

  /** 读取 JSON（每次都重新解析，返回新对象，可放心修改） */
  load<T = any>(path: string): T {
    const text = this.text(path)
    try {
      return JSON.parse(text)
    } catch (error: any) {
      throw new Error(`数据文件 ${display(normalize(path))} 不是合法 JSON：${error?.message ?? error}`)
    }
  }

  exists(path: string) {
    path = normalize(path)
    this._track(path)
    const text = this._read(path)
    return text !== null && text !== undefined
  }

  /** 读取过某个数据文件的单元；path 可以是 data/ 下的路径，也可以是 @pot/kit/<名字>/<路径> */
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
  path = path.replace(/\\/g, '/')
  if (path.startsWith(KIT_PREFIX)) return path
  return path.replace(/^\/+/, '').replace(/^data\//, '')
}

function display(path: string) {
  return path.startsWith(KIT_PREFIX) ? path : `data/${path}`
}
