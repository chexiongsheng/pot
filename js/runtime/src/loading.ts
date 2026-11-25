/**
 * loading：加载期让帧与进度回报。
 * 游戏启动（以及热重载里耗时的单元）是一长串同步 JS，不让出帧时窗口不刷新、看起来像卡死。
 * 单元 apply 可以写成 async，在阶段之间 await ctx.loading.step('烘焙材质', 0.4)：
 * - 回报进度给宿主（Runner 外壳画加载界面和进度条）
 * - 本帧已占用超过 budget 毫秒时让出一帧（宿主下一帧调用 pump 后继续）
 * 宿主没有帧驱动（Node 测试）时不让帧，行为与同步代码一致。
 */
import { Context, Service } from 'cordis'
import type { Host } from './host'

declare module 'cordis' {
  interface Context {
    loading: LoadingService
  }
}

export class LoadingService extends Service {
  /** 0..1；小于 0 表示未知（外壳画不确定进度条） */
  progress = -1
  text = ''
  /** 运行时启动期间为 true */
  active = false
  /** 单次连续执行的时间预算（毫秒），超过后 step 让帧 */
  budget = 50
  /** 本次启动/加载让出的帧数 */
  yields = 0
  /** 接下来加载的单元可用的进度区间（绝对值，004 第 17.13 节）；begin 时重置为 [0, 1] */
  window: [number, number] = [0, 1]
  private _waiters: (() => void)[] = []
  private _sliceStart = Date.now()
  private _explicit = false

  constructor(ctx: Context, private _host: Host) {
    super(ctx, 'loading')
  }

  /** 宿主是否按帧驱动（否则让帧是空操作） */
  get frames() {
    return !!this._host.frames
  }

  /** 回报进度（不让帧）。progress 省略时保持不变；只在加载期间转发给宿主 */
  report(text?: string, progress?: number) {
    if (text !== undefined) this.text = text
    if (progress !== undefined) {
      this.progress = Math.min(1, progress)
      this._explicit = true
    }
    if (this.active) this._host.loading?.(this.progress, this.text)
  }

  /** 运行时在单元开始 apply 时调用：游戏没报过进度时，至少显示正在加载哪个单元 */
  unit(name: string) {
    if (!this.active || this._explicit) return
    this.report(`加载 ${name}`)
  }

  /** 设置接下来加载的单元可用的进度区间：自己报进度的父单元在 ctx.use(子单元) 前调用 */
  within(lo: number, hi: number) {
    if (!(lo >= 0 && hi <= 1 && lo <= hi)) throw new Error(`loading.within 需要 0 <= lo <= hi <= 1，收到 ${lo}、${hi}`)
    this.window = [lo, hi]
  }

  /** 等到下一帧（宿主 pump 时继续） */
  frame(): Promise<void> {
    if (!this._host.frames) return Promise.resolve()
    this.yields++
    return new Promise<void>((resolve) => this._waiters.push(resolve))
  }

  /** 回报进度；本帧连续执行超过 budget 时让出一帧 */
  step(text?: string, progress?: number): Promise<void> {
    this.report(text, progress)
    if (Date.now() - this._sliceStart < this.budget) return Promise.resolve()
    return this.frame()
  }

  /** 宿主每帧调用（Runtime.tick 与 Unity 启动期间） */
  pump() {
    this._sliceStart = Date.now()
    if (!this._waiters.length) return
    const waiters = this._waiters
    this._waiters = []
    for (const resolve of waiters) resolve()
  }

  /** 运行时启动开始 */
  begin(text = '启动') {
    this.active = true
    this._explicit = false
    this.yields = 0
    this.progress = -1
    this.window = [0, 1]
    this._sliceStart = Date.now()
    this.report(text)
  }

  /** 运行时启动结束 */
  end() {
    this.report('完成', 1)
    this.active = false
  }
}
