/**
 * 源码加载器（仅 Runner / 开发期）：直接读取游戏目录里的 TS/JS 源码，用 sucrase 转译成 CommonJS 后执行。
 * 不需要 Dev Server、不需要预先构建；发布包里没有 devtools，单元改从 bundle.cjs 读取。
 *
 * - 单元：src/plugins/<name>.ts（或 .js）。每次 load 都重新执行单元文件，得到新的模块对象（热重载需要）。
 * - 共享模块：单元 import 的相对路径文件（如 src/lib/math.ts），按路径缓存，同一时刻只有一个实例。
 * - require：@pot/core、cordis 映射到运行时；相对路径依次尝试 原样 / .ts / .js / .json / /index.ts / /index.js。
 * - sucrase 保留行号，sourceURL 为游戏内相对路径，报错栈直接指向 TS 源码行。
 * - 依赖图：invalidate(paths) 返回受影响的单元，供热重载使用。
 */
import { transform } from 'sucrase'
import { splitMultiExports } from './multi-export'
import { compileModule, hash } from '@pot/core'
import type { Host, UnitLoader, UnitSource } from '@pot/core'

interface ModuleRecord {
  path: string
  exports: any
  /** 直接依赖的游戏内文件路径 */
  deps: Set<string>
  /** 本文件源码 hash */
  hash: string
}

const UNIT_DIR = 'src/plugins/'
const UNIT_EXTS = ['.ts', '.js']
const RESOLVE_SUFFIXES = ['', '.ts', '.js', '.json', '/index.ts', '/index.js']

export function normalizePath(path: string) {
  const out: string[] = []
  for (const part of path.replace(/\\/g, '/').split('/')) {
    if (!part || part === '.') continue
    if (part === '..') {
      if (!out.length) throw new Error(`路径越出游戏目录：${path}`)
      out.pop()
    } else out.push(part)
  }
  return out.join('/')
}

function dirname(path: string) {
  const i = path.lastIndexOf('/')
  return i < 0 ? '' : path.slice(0, i)
}

/** 由文件路径得到单元名（不是单元文件返回 undefined） */
export function unitNameOf(path: string) {
  path = normalizePath(path)
  if (!path.startsWith(UNIT_DIR)) return
  const rest = path.slice(UNIT_DIR.length)
  const ext = UNIT_EXTS.find((e) => rest.endsWith(e))
  if (!ext || rest.includes('/')) return
  return rest.slice(0, -ext.length)
}

export function transpile(code: string, path: string) {
  if (path.endsWith('.json')) {
    JSON.parse(code)
    return `module.exports = ${code}`
  }
  const transforms: any[] = path.endsWith('.ts') || path.endsWith('.tsx') ? ['typescript', 'imports'] : ['imports']
  try {
    return transform(splitMultiExports(code), { transforms, disableESTransforms: true, filePath: path, production: true }).code
  } catch (error: any) {
    const loc = error?.loc ? `:${error.loc.line}:${error.loc.column + 1}` : ''
    throw new SyntaxError(`${path}${loc} ${error?.message ?? error}`)
  }
}

export class SourceLoader implements UnitLoader {
  /** 已执行的共享模块（单元文件不进缓存） */
  readonly cache = new Map<string, ModuleRecord>()
  /** 单元 → 上次加载时的依赖闭包（含单元文件本身） */
  readonly unitDeps = new Map<string, Set<string>>()

  constructor(private _host: Host) {}

  private _read(path: string) {
    const text = this._host.readText(path)
    return text === null || text === undefined ? null : text
  }

  private _resolve(id: string, from: string) {
    const base = normalizePath(`${dirname(from)}/${id}`)
    for (const suffix of RESOLVE_SUFFIXES) {
      const path = base + suffix
      if (suffix === '' && !/\.(ts|js|json)$/.test(path)) continue
      const code = this._read(path)
      if (code !== null) return { path, code }
    }
    throw new Error(`${from}: 找不到模块 "${id}"（${base}）`)
  }

  /** 执行一个文件，返回记录；shared=true 时进缓存 */
  private _execute(path: string, code: string, modules: Record<string, any>, shared: boolean): ModuleRecord {
    const record: ModuleRecord = { path, exports: {}, deps: new Set(), hash: hash(code) }
    const module = { exports: record.exports }
    // 先登记再执行，支持循环依赖（与 Node 一致：拿到的是尚未执行完的 exports）
    if (shared) this.cache.set(path, record)
    try {
      const factory = compileModule(transpile(code, path), path)
      const require = (id: string) => {
        if (id in modules) return modules[id]
        if (id.startsWith('./') || id.startsWith('../')) {
          const dep = this._require(id, path, modules)
          record.deps.add(dep.path)
          return dep.exports
        }
        throw new Error(`${path}: 不支持 require("${id}")。游戏代码只能依赖 @pot/core 和游戏目录内的相对路径文件`)
      }
      factory.call(module.exports, module.exports, require, module, path)
    } catch (error) {
      if (shared) this.cache.delete(path)
      throw error
    }
    record.exports = module.exports
    return record
  }

  private _require(id: string, from: string, modules: Record<string, any>) {
    const { path, code } = this._resolve(id, from)
    return this.cache.get(path) ?? this._execute(path, code, modules, true)
  }

  private _closure(record: ModuleRecord) {
    const seen = new Set<string>([record.path])
    const stack = [...record.deps]
    while (stack.length) {
      const path = stack.pop()!
      if (seen.has(path)) continue
      seen.add(path)
      for (const dep of this.cache.get(path)?.deps ?? []) stack.push(dep)
    }
    return seen
  }

  /** 加载单元源码；没有源码返回 null（交给 bundle） */
  load(name: string, modules: Record<string, any>): UnitSource | null {
    for (const ext of UNIT_EXTS) {
      const path = UNIT_DIR + name + ext
      const code = this._read(path)
      if (code === null) continue
      const record = this._execute(path, code, modules, false)
      const closure = this._closure(record)
      this.unitDeps.set(name, closure)
      const parts = [...closure].sort().map((p) => (p === path ? record.hash : this.cache.get(p)?.hash ?? ''))
      return { exports: record.exports, hash: hash(...parts), source: path }
    }
    return null
  }

  /** 文件变化：清掉相关缓存，返回受影响的单元名 */
  invalidate(paths: string[]) {
    const changed = new Set(paths.map(normalizePath))
    // 反向传播：依赖了变化文件的共享模块也要重新执行
    let grew = true
    while (grew) {
      grew = false
      for (const record of this.cache.values()) {
        if (changed.has(record.path)) continue
        if ([...record.deps].some((d) => changed.has(d))) {
          changed.add(record.path)
          grew = true
        }
      }
    }
    for (const path of changed) this.cache.delete(path)
    const units = new Set<string>()
    for (const [name, deps] of this.unitDeps) {
      if ([...deps].some((d) => changed.has(d))) units.add(name)
    }
    for (const path of changed) {
      const name = unitNameOf(path)
      if (name) units.add(name)
    }
    return [...units]
  }

  info() {
    return {
      modules: [...this.cache.values()].map((r) => ({ path: r.path, deps: [...r.deps] })),
      units: Object.fromEntries([...this.unitDeps].map(([n, d]) => [n, [...d]])),
    }
  }
}

export function createLoader(host: Host) {
  return new SourceLoader(host)
}
