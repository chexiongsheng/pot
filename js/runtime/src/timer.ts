/**
 * timer：改编自 cordis 官方 @cordisjs/timer（MIT, Copyright (c) Shigma）。
 * 差异：不依赖全局 setTimeout，而是走 clock 的游戏时间；
 * 因此暂停/冻结/时间缩放对定时器同样生效，热重载时不会“补跑”。
 * 所有定时器都挂在调用方 fiber 的 effect 上，插件卸载自动清理。
 */
import { Context, Service } from 'cordis'
import type { ClockService } from './clock'

declare module 'cordis' {
  interface Context extends Pick<TimerService, 'interval' | 'timeout' | 'throttle' | 'debounce' | 'setTimeout' | 'setInterval'> {
    timer: TimerService
  }
}

type WithDispose<T> = T & { dispose: () => void }

export class TimerService extends Service {
  static inject = ['clock']
  private _clock: ClockService

  constructor(ctx: Context) {
    super(ctx, 'timer')
    this._clock = ctx.clock
    ctx.mixin('timer', ['timeout', 'interval', 'throttle', 'debounce', 'setTimeout', 'setInterval'])
  }

  setTimeout(callback: () => void, delay: number) {
    return this.timeout(callback, delay)
  }

  setInterval(callback: () => void, delay: number) {
    return this.interval(callback, delay)
  }

  /** timeout(cb, ms) 返回取消函数；timeout(ms) 返回 Promise（插件卸载时 reject） */
  timeout(callback: () => void, delay: number): () => void
  timeout(delay: number): Promise<void>
  timeout(...args: any[]): any {
    const callback = typeof args[0] === 'function' ? args.shift() : undefined
    const delay = args[0] as number
    const clock = this._clock
    if (callback) {
      const dispose = this.ctx.effect(() => {
        const cancel = clock.schedule(delay, () => {
          dispose()
          callback()
        })
        return cancel
      }, 'ctx.timeout()')
      return dispose
    }
    let resolve!: () => void, reject!: (e: any) => void
    const promise = new Promise<void>((res, rej) => { resolve = res; reject = rej })
    let settled = false
    const dispose = this.ctx.effect(() => {
      const cancel = clock.schedule(delay, () => { settled = true; resolve() })
      return () => {
        cancel()
        if (!settled) reject(new Error('Context has been disposed'))
      }
    }, 'ctx.timeout()')
    // 防止卸载导致的 reject 变成未处理异常
    promise.catch(() => {})
    return promise.finally(() => dispose())
  }

  /** interval(cb, ms)，返回取消函数 */
  interval(callback: () => void, delay: number): () => void {
    const clock = this._clock
    const period = Math.max(1, delay)
    return this.ctx.effect(() => {
      let cancel = () => {}
      const loop = () => {
        cancel = clock.schedule(period, () => {
          loop()
          callback()
        })
      }
      loop()
      return () => cancel()
    }, 'ctx.interval()')
  }

  private _schedule(label: string, trigger: (args: any[], isDisposed: boolean) => (() => void) | undefined, isDisposed = false) {
    let cancel: (() => void) | undefined
    const dispose = this.ctx.effect(() => () => {
      isDisposed = true
      cancel?.()
    }, label)
    const wrapper: any = (...args: any[]) => {
      cancel?.()
      cancel = trigger(args, isDisposed)
    }
    wrapper.dispose = dispose
    return wrapper
  }

  throttle<F extends (...args: any[]) => void>(callback: F, delay: number, noTrailing?: boolean): WithDispose<F> {
    const clock = this._clock
    let lastCall = -Infinity
    const execute = (...args: any[]) => {
      lastCall = clock.time * 1000
      callback(...args)
    }
    return this._schedule('ctx.throttle()', (args, isDisposed) => {
      const now = clock.time * 1000
      const remaining = delay - now + lastCall
      if (remaining <= 0) {
        execute(...args)
      } else if (!isDisposed) {
        return clock.schedule(remaining, () => execute(...args))
      }
    }, noTrailing)
  }

  debounce<F extends (...args: any[]) => void>(callback: F, delay: number): WithDispose<F> {
    const clock = this._clock
    return this._schedule('ctx.debounce()', (args, isDisposed) => {
      if (isDisposed) return
      return clock.schedule(delay, () => callback(...args))
    })
  }
}
