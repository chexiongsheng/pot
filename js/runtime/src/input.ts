/**
 * input：只读输入。虚拟输入（开发工具注入）由宿主合并，JS 侧无感知。
 */
import { Context, Service } from 'cordis'
import type { Host } from './host'

declare module 'cordis' {
  interface Context {
    input: InputService
  }
}

export class InputService extends Service {
  constructor(ctx: Context, private _host: Host) {
    super(ctx, 'input')
  }

  /** move：WASD/方向键，look：鼠标增量。返回 { x, y } */
  axis(name = 'move') {
    const [x, y] = this._host.engine.axis(name)
    return { x, y }
  }

  /** 按住 */
  key(name: string) {
    return this._host.engine.key(name, 0)
  }

  /** 本帧按下 */
  pressed(name: string) {
    return this._host.engine.key(name, 1)
  }

  /** 本帧抬起 */
  released(name: string) {
    return this._host.engine.key(name, 2)
  }
}
