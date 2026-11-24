/**
 * 运行时：组装核心服务，按 manifest 挂载游戏单元，驱动帧循环。
 * 宿主无关：Unity 中由 unity.ts 提供 Host，Node 测试中由 mock 提供。
 */
import { Context, Logger } from 'cordis'
import { CacheService } from './cache'
import { ClockService } from './clock'
import { DataService } from './data'
import type { Host, LogLevel } from './host'
import { InputService } from './input'
import { PluginsService } from './plugins'
import type { UnitLoader } from './plugins'
import { SceneService } from './scene'
import { StateService } from './state'
import { TimerService } from './timer'
import { UIService } from './ui'
import { AudioService } from './audio'
import { GfxService } from './gfx'
import { LoadingService } from './loading'
import * as jsxRuntime from './jsx-runtime'
import * as jsxDevRuntime from './jsx-dev-runtime'

export const API_VERSION = '0.1'
export const VERSION = '0.1.0'

export interface PluginEntry {
  name: string
  config?: any
}

export interface Manifest {
  id: string
  name?: string
  version?: string
  apiVersion?: string
  /** 启动时挂载到根上的单元，按顺序 */
  plugins: (string | PluginEntry)[]
  /** 预留：发布期 bundle 文件名 */
  entry?: string
}

export interface RuntimeOptions {
  /** 冷重启时带过来的 state（StateService.exportJSON 的结果） */
  state?: string
  /** 单元 require 可见的模块，默认 { '@pot/core': globalThis.pot } */
  modules?: Record<string, any>
  /** 源码加载器（Runner 由 devtools 提供）；不提供则只从 bundle.cjs 加载 */
  loader?: UnitLoader
}

let current: Runtime | undefined

/** 当前（最近创建的）运行时，供开发工具使用 */
export function currentRuntime() {
  return current
}

/** 用闭包把宿主等参数传给服务构造函数（cordis 的第二个参数留给 config） */
function bind<T extends new (...args: any[]) => any>(Base: T, ...args: any[]): T {
  const Bound: any = class extends (Base as any) {
    constructor(ctx: Context) {
      super(ctx, ...args)
    }
  }
  Object.defineProperty(Bound, 'name', { value: Base.name })
  return Bound
}

export class Runtime {
  readonly root: Context
  manifest: Manifest | undefined
  status: 'idle' | 'starting' | 'running' | 'failed' | 'stopped' = 'idle'
  /** 启动阶段失败的单元 */
  readonly failures: { name: string; error: string }[] = []

  constructor(readonly host: Host, readonly options: RuntimeOptions = {}) {
    this.root = new Context()
    current = this
    const exporter = {
      colors: false as const,
      export(message: any) {
        const level = (['error', 'warn', 'info', 'debug'].includes(message.type) ? message.type : 'info') as LogLevel
        try {
          host.log(level, Logger.format(exporter, message))
        } catch {
          host.log(level, String(message.args?.[0]))
        }
      },
    }
    this.root.logger.exporter(exporter)
  }

  get clock() { return this.root.clock }
  get state() { return this.root.state }
  get plugins() { return this.root.plugins }
  get scene() { return this.root.scene }
  get data() { return this.root.data }
  get cache() { return this.root.cache }
  get loading() { return this.root.loading }

  /** 安装核心服务 */
  async init() {
    const { root, host } = this
    const pot = (globalThis as any).pot
    const modules = this.options.modules ?? {
      '@pot/core': pot,
      'cordis': pot,
      '@pot/core/jsx-runtime': jsxRuntime,
      '@pot/core/jsx-dev-runtime': jsxDevRuntime,
    }
    const install = (plugin: any) => root.plugin(plugin as any, undefined as never)
    await install(ClockService)
    await install(TimerService)
    await install(bind(StateService))
    await install(CacheService)
    await install(bind(DataService, host))
    await install(bind(SceneService, host))
    await install(bind(InputService, host))
    await install(bind(UIService, host))
    await install(bind(AudioService, host))
    await install(bind(GfxService, host))
    await install(bind(LoadingService, host))
    await install(bind(PluginsService, host, modules, this.options.loader))
    if (this.options.state) this.root.state.importJSON(this.options.state)
    return this
  }

  readManifest(): Manifest {
    const text = this.host.readText('manifest.json')
    if (!text) throw new Error('找不到 manifest.json')
    const manifest = JSON.parse(text) as Manifest
    if (!manifest.id) throw new Error('manifest.json 缺少 id')
    if (!Array.isArray(manifest.plugins)) throw new Error('manifest.json 缺少 plugins 数组')
    if (manifest.apiVersion && manifest.apiVersion.split('.')[0] !== API_VERSION.split('.')[0]) {
      throw new Error(`manifest.apiVersion=${manifest.apiVersion} 与运行时 ${API_VERSION} 不兼容`)
    }
    return manifest
  }

  /**
   * 读取 manifest 并挂载入口单元。单个单元失败不影响其他单元。
   * 注意：不要在这里持有入口 fiber 的引用，否则热重载后旧 fiber 无法回收。
   */
  async start() {
    this.status = 'starting'
    this.root.loading.begin()
    try {
      this.manifest = this.readManifest()
    } catch (error: any) {
      this.status = 'failed'
      this.root.loading.end()
      this.root.logger('pot').error(error)
      throw error
    }
    for (const item of this.manifest.plugins) {
      const entry = typeof item === 'string' ? { name: item } : item
      try {
        await this.root.plugins.use(entry.name, entry.config)
      } catch (error: any) {
        this.failures.push({ name: entry.name, error: error?.stack ?? String(error) })
        this.root.logger('pot').error('单元 %s 启动失败：%s', entry.name, error?.stack ?? error)
      }
    }
    this.root.loading.end()
    this.status = 'running'
    return this
  }

  tick(dt: number) {
    const clock = this.root.clock
    const frame = clock.frame
    // 先放行等帧的加载（热重载中 async 单元的 loading.step）
    this.root.loading.pump()
    clock.tick(dt)
    // 只有游戏帧推进（update 执行过）才提交 UI；暂停/冻结时保留上一帧画面
    if (clock.frame !== frame) this.root.ui.flush()
  }

  /** 卸载所有单元（服务保留，state 保留） */
  async stop() {
    for (const unit of this.root.plugins.units.values()) {
      for (const fiber of [...unit.mounts]) {
        try {
          await fiber.dispose()
        } catch (error) {
          this.root.logger('pot').warn(error)
        }
      }
    }
    this.status = 'stopped'
  }

  exportState() {
    return this.root.state.exportJSON()
  }

  info() {
    return {
      status: this.status,
      game: this.manifest?.id,
      apiVersion: API_VERSION,
      time: this.root.clock.time,
      frame: this.root.clock.frame,
      paused: this.root.clock.paused,
      frozen: this.root.clock.frozen,
      units: this.root.plugins.list().map((u) => ({ name: u.name, hash: u.hash, mounts: u.mounts.length })),
      objects: this.root.scene.objects.size,
      timers: this.root.clock.pending,
      state: this.root.state.keys(),
      failures: this.failures,
      loading: { active: this.root.loading.active, progress: this.root.loading.progress, text: this.root.loading.text, yields: this.root.loading.yields },
    }
  }
}

export async function createRuntime(host: Host, options?: RuntimeOptions) {
  const runtime = new Runtime(host, options)
  await runtime.init()
  return runtime
}
