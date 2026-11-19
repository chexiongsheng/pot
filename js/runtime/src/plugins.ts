/**
 * plugins：游戏单元（unit）的加载与挂载。
 * 一个单元 = 一个插件文件 src/plugins/<name>.ts。
 * - Runner（开发期）：devtools 提供的 UnitLoader 直接读源码转译执行，每次编译都是新的模块对象，旧版本释放后可被 GC。
 * - 发布期：没有 loader，从 bundle.cjs 读取（整体打包，导出 { units }）。
 *
 * 每个单元有一个稳定的 wrapper 插件：
 * - 标记 fiber → 单元名（state/data/scene 据此识别归属）
 * - 记录挂载点 mounts（热重载时据此替换）
 * - 自动注入全部核心服务，游戏代码无需手写 inject
 */
import { Context, Fiber, Inject, Service } from 'cordis'
import type { Host } from './host'
import { markFiber } from './units'

declare module 'cordis' {
  interface Context {
    plugins: PluginsService
    /** 挂载一个游戏单元：ctx.use('enemy', { count: 3 }) */
    use(name: string, config?: any): Fiber & PromiseLike<Fiber>
  }
}

export const CORE_SERVICES = ['clock', 'timer', 'state', 'cache', 'data', 'scene', 'input', 'ui', 'audio', 'gfx', 'loading', 'plugins']

export interface UnitSource {
  exports: any
  /** 单元及其依赖闭包的内容 hash，未变化的单元热重载时跳过 */
  hash: string
  /** 来源文件（如 src/plugins/player.ts） */
  source: string
}

/** 单元源码加载器（devtools 的 SourceLoader 实现）。没有源码时返回 null */
export interface UnitLoader {
  load(name: string, modules: Record<string, any>): UnitSource | null
  /** 文件变化后清缓存，返回受影响的单元 */
  invalidate?(paths: string[]): string[]
}

export interface Unit {
  name: string
  hash: string
  /** 模块导出（热重载提交后用 WeakRef 检查是否被释放） */
  exports: any
  /** 交给 cordis 的插件对象 */
  wrapper: any
  /** 当前挂载点 */
  mounts: Set<Fiber>
  source: string
  /** apply 抛出的错误（含异步），热重载据此判断新版本是否挂载成功 */
  errors: any[]
}

export type ModuleFactory = (exports: any, require: (id: string) => any, module: { exports: any }, filename: string) => void

/** 把 CommonJS 源码编译成工厂函数；代码与包装头同一行，行号不变；sourceURL 让报错栈带上文件名 */
export function compileModule(code: string, filename: string): ModuleFactory {
  const indirectEval = eval
  return indirectEval(`(function (exports, require, module, __filename) {${code}\n})\n//# sourceURL=${filename}`)
}

export function runModule(factory: ModuleFactory, filename: string, modules: Record<string, any>) {
  const module = { exports: {} as any }
  const require = (id: string) => {
    if (id in modules) return modules[id]
    throw new Error(`${filename}: 不支持 require("${id}")。游戏单元只能依赖 @pot/core，其余代码请由构建打包进单元`)
  }
  factory.call(module.exports, module.exports, require, module, filename)
  return module.exports
}

function resolvePlugin(name: string, exports: any) {
  let plugin = exports
  if (typeof exports?.apply !== 'function' && exports?.default) plugin = exports.default
  const apply = typeof plugin === 'function' ? plugin : plugin?.apply
  if (typeof apply !== 'function') {
    throw new Error(`单元 "${name}" 没有导出 apply(ctx, config)；请 export function apply(ctx) { ... }`)
  }
  if (typeof plugin === 'object' && typeof plugin.name === 'string' && plugin.name !== name) {
    throw new Error(`单元文件名是 "${name}"，但导出的 name 是 "${plugin.name}"，二者必须一致`)
  }
  return { plugin, apply }
}

export function createUnit(name: string, exports: any, contentHash: string, source: string): Unit {
  const { plugin, apply } = resolvePlugin(name, exports)
  const inject = Object.assign(Inject.resolve(CORE_SERVICES), Inject.resolve(plugin.inject))
  const unit: Unit = { name, hash: contentHash, exports, wrapper: null, mounts: new Set(), source, errors: [] }
  unit.wrapper = {
    name: `unit:${name}`,
    inject,
    Config: plugin.Config,
    apply(ctx: Context, config: any) {
      const fiber = ctx.fiber
      markFiber(fiber, name)
      unit.mounts.add(fiber)
      ctx.effect(() => () => {
        unit.mounts.delete(fiber)
      }, 'pot:mount')
      ;(ctx as any).loading?.unit(name)
      try {
        const result = apply.call(plugin, ctx, config)
        if (result && typeof result.then === 'function') {
          result.then(undefined, (error: any) => { unit.errors.push(error) })
        }
        return result
      } catch (error) {
        unit.errors.push(error)
        throw error
      }
    },
  }
  return unit
}

export class PluginsService extends Service {
  readonly units = new Map<string, Unit>()
  private _bundle: Record<string, any> | null | undefined

  constructor(ctx: Context, private _host: Host, private _modules: Record<string, any>, readonly loader?: UnitLoader) {
    super(ctx, 'plugins')
    ctx.mixin('plugins', ['use'])
  }

  /** 发布期：bundle.cjs 是一个整体打包的模块，导出 { units: { 单元名: 模块导出 } }，共享代码只有一份 */
  private _getBundle() {
    if (this._bundle !== undefined) return this._bundle
    const code = this._host.readText('bundle.cjs')
    this._bundle = null
    if (code) {
      const exports = runModule(compileModule(code, 'bundle.cjs'), 'bundle.cjs', this._modules)
      if (!exports?.units) throw new Error('bundle.cjs 格式不对（缺少 units），请用当前版本的 pot build 重新构建')
      this._bundle = exports.units
    }
    return this._bundle
  }

  /** 编译单元但不登记（热重载预加载用）。有源码（Runner）读源码，否则读发布包 bundle.cjs */
  compile(name: string): Unit {
    const source = this.loader?.load(name, this._modules)
    if (source) return createUnit(name, source.exports, source.hash, source.source)
    const bundle = this._getBundle()
    if (bundle && Object.prototype.hasOwnProperty.call(bundle, name)) {
      return createUnit(name, bundle[name], `bundle:${name}`, 'bundle.cjs')
    }
    throw new Error(`找不到单元 "${name}"（src/plugins/${name}.ts）`)
  }

  /** 取已加载的单元，未加载则编译并登记 */
  get(name: string): Unit {
    let unit = this.units.get(name)
    if (!unit) {
      unit = this.compile(name)
      this.units.set(name, unit)
    }
    return unit
  }

  /** 替换名字指向的版本（热重载用），返回旧版本 */
  swap(name: string, unit: Unit | undefined): Unit | undefined {
    const old = this.units.get(name)
    if (unit) this.units.set(name, unit)
    else this.units.delete(name)
    return old
  }

  /** 在调用方 ctx 下挂载单元 */
  use(name: string, config?: any) {
    const unit = this.get(name)
    return this.ctx.plugin(unit.wrapper, config)
  }

  list() {
    return [...this.units.values()].map((u) => ({
      name: u.name,
      hash: u.hash,
      source: u.source,
      mounts: [...u.mounts].map((f) => ({ state: f.state, config: f.config })),
    }))
  }
}
