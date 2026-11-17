/**
 * clock：游戏时间。宿主每帧调用 tick(dt)。
 * - freeze()/计数：热重载事务期间冻结，游戏时间与 update 都停住，宿主帧计数照常
 * - pause()/resume()/step(n)：给开发工具与游戏暂停用
 * - scale：时间缩放
 * - waitFrames(n)：按宿主帧计数（冻结时也走），用于“等 GC 生效”等场景
 */
import { Context, Service } from 'cordis'

declare module 'cordis' {
  interface Context {
    clock: ClockService
  }
  interface Events {
    /** 每个游戏帧触发；dt 为缩放后的秒数，time 为游戏时间（秒） */
    'update'(dt: number, time: number): void
  }
}

interface Scheduled {
  at: number
  seq: number
  callback: () => void
  cancelled: boolean
}

export class ClockService extends Service {
  /** 游戏时间（秒），冻结或暂停时不走 */
  time = 0
  /** 游戏帧数 */
  frame = 0
  /** 宿主帧数，任何情况下都走 */
  hostFrame = 0
  scale = 1
  private _freeze = 0
  private _paused = false
  private _steps = 0
  private _seq = 0
  private _queue: Scheduled[] = []
  private _frameWaiters: { frame: number; resolve: () => void }[] = []

  constructor(ctx: Context) {
    super(ctx, 'clock')
  }

  get frozen() {
    return this._freeze > 0
  }

  get paused() {
    return this._paused
  }

  /** 冻结时钟，返回解冻函数（可嵌套） */
  freeze() {
    this._freeze++
    let released = false
    return () => {
      if (released) return
      released = true
      this._freeze--
    }
  }

  pause() {
    this._paused = true
    this._steps = 0
  }

  resume() {
    this._paused = false
    this._steps = 0
  }

  /** 暂停状态下推进 n 个游戏帧 */
  step(frames = 1) {
    this._paused = true
    this._steps += Math.max(1, frames | 0)
  }

  /** 宿主每帧调用 */
  tick(dt: number) {
    this.hostFrame++
    if (this._frameWaiters.length) {
      const due = this._frameWaiters.filter((w) => w.frame <= this.hostFrame)
      this._frameWaiters = this._frameWaiters.filter((w) => w.frame > this.hostFrame)
      for (const waiter of due) waiter.resolve()
    }
    if (this._freeze > 0) return
    if (this._paused) {
      if (this._steps <= 0) return
      this._steps--
    }
    const scaled = Math.max(0, dt) * this.scale
    this.time += scaled
    this.frame++
    this._runDue()
    this.ctx.emit('update', scaled, this.time)
  }

  /** 宿主帧计数等待（冻结/暂停时也会推进） */
  waitFrames(frames = 1): Promise<void> {
    return new Promise<void>((resolve) => {
      this._frameWaiters.push({ frame: this.hostFrame + Math.max(1, frames | 0), resolve })
    })
  }

  /** 按游戏时间调度回调，返回取消函数。一般用 ctx.timeout，它会随插件自动清理 */
  schedule(delayMs: number, callback: () => void): () => void {
    const item: Scheduled = {
      at: this.time + Math.max(0, delayMs) / 1000,
      seq: this._seq++,
      callback,
      cancelled: false,
    }
    // 插入排序：按 at、seq 升序
    let index = this._queue.length
    while (index > 0) {
      const prev = this._queue[index - 1]
      if (prev.at < item.at || (prev.at === item.at && prev.seq < item.seq)) break
      index--
    }
    this._queue.splice(index, 0, item)
    return () => {
      if (item.cancelled) return
      item.cancelled = true
      const i = this._queue.indexOf(item)
      if (i >= 0) this._queue.splice(i, 1)
    }
  }

  /** 当前排队中的定时器数量（泄漏排查用） */
  get pending() {
    return this._queue.length
  }

  private _runDue() {
    // 回调里可能再调度，最多处理到本帧时间点
    let guard = 10000
    while (this._queue.length && this._queue[0].at <= this.time && guard-- > 0) {
      const item = this._queue.shift()!
      if (item.cancelled) continue
      item.cancelled = true
      try {
        item.callback()
      } catch (error) {
        this.ctx.logger('clock').error(error)
      }
    }
  }
}
