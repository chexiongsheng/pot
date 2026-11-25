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

  /** 按住。鼠标按键用 mouse0（左）、mouse1（右）、mouse2（中） */
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

  /** 锁定并隐藏鼠标（第一人称视角）；false 释放。不传参数时只返回当前是否锁定 */
  cursor(locked?: boolean) {
    if (locked !== undefined) this._host.engine.cursor(locked)
    return this._host.engine.cursorLocked()
  }

  /** 鼠标位置（像素，左上角为原点，与 ctx.ui 坐标一致） */
  mouse() {
    const [x, y] = this._host.engine.mouse()
    return { x, y }
  }

  /** 屏幕尺寸（像素） */
  screen() {
    const [width, height] = this._host.engine.screen()
    return { width, height }
  }

  /** 本帧滚轮增量 */
  wheel() {
    return this._host.engine.wheel()
  }

  /** 本帧键入的文字：退格为 \b，回车为 \n（输入框用；只有桌面键盘） */
  text(): string {
    return this._host.engine.textInput?.() ?? ''
  }

  /** 窗口是否有焦点（失焦时可以自动暂停） */
  focused() {
    return this._host.engine.focused()
  }
}
