/**
 * ui：即时模式 2D 绘制。每帧在 update 里调用 rect/text/line/arc，运行时在帧末一次性提交给宿主。
 * 不保留任何对象：单元卸载后自然不再绘制，热重载零清理。坐标为屏幕像素，左上角为原点。
 * 点击检测由游戏自己做：ctx.input.mouse() + ctx.input.pressed('mouse0') + ui.hit(x, y, w, h)。
 */
import { Context, Service } from 'cordis'
import type { Host } from './host'
import { Color, parseColor } from './scene'

declare module 'cordis' {
  interface Context {
    ui: UIService
  }
}

const RS = '\u001e'
const FS = '\u001f'

export type HAlign = 'left' | 'center' | 'right'
export type VAlign = 'top' | 'middle' | 'bottom'

export interface TextOptions {
  /** 文字框宽高；不传则以 (x, y) 为锚点按 align/valign 对齐 */
  w?: number
  h?: number
  size?: number
  color?: Color
  /** 透明度倍数 0 到 1 */
  alpha?: number
  align?: HAlign
  valign?: VAlign
  bold?: boolean
  /** 1 像素黑色投影 */
  shadow?: boolean
  /** 在 w 内自动换行 */
  wrap?: boolean
}

export interface RectOptions {
  radius?: number
  alpha?: number
}

const n = (v: number) => String(Math.round(v * 10) / 10)

export class UIService extends Service {
  private _list: string[] = []
  private _colors = new Map<string, string>()
  private _submittedEmpty = true

  constructor(ctx: Context, private _host: Host) {
    super(ctx, 'ui')
  }

  /** 屏幕宽（像素） */
  get width() {
    return this._host.engine.screen()[0]
  }

  /** 屏幕高（像素） */
  get height() {
    return this._host.engine.screen()[1]
  }

  /** 颜色转 rrggbbaa，alpha 为倍数 */
  hex(color: Color, alpha = 1): string {
    let base: string | undefined
    if (typeof color === 'string') {
      base = this._colors.get(color)
      if (base === undefined) {
        const [r, g, b, a] = parseColor(color)
        base = [r, g, b, a].map((v) => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, '0')).join('')
        if (this._colors.size > 1024) this._colors.clear()
        this._colors.set(color, base)
      }
      if (alpha >= 1) return base
      const a = Math.round(parseInt(base.slice(6, 8), 16) * Math.max(0, alpha))
      return base.slice(0, 6) + a.toString(16).padStart(2, '0')
    }
    const [r, g, b, a] = parseColor(color)
    return [r, g, b, a * Math.max(0, Math.min(1, alpha))].map((v) => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, '0')).join('')
  }

  rect(x: number, y: number, w: number, h: number, color: Color, options: RectOptions = {}) {
    this._list.push(['r', n(x), n(y), n(w), n(h), this.hex(color, options.alpha), n(options.radius ?? 0)].join(FS))
  }

  border(x: number, y: number, w: number, h: number, color: Color, thickness = 1, options: RectOptions = {}) {
    this._list.push(['b', n(x), n(y), n(w), n(h), this.hex(color, options.alpha), n(thickness), n(options.radius ?? 0)].join(FS))
  }

  line(x1: number, y1: number, x2: number, y2: number, color: Color, width = 1, alpha = 1) {
    this._list.push(['l', n(x1), n(y1), n(x2), n(y2), this.hex(color, alpha), n(width)].join(FS))
  }

  /** 圆弧：角度制，0 度朝上，顺时针；sweep 360 为整圆 */
  arc(cx: number, cy: number, radius: number, color: Color, thickness = 2, start = 0, sweep = 360, alpha = 1) {
    this._list.push(['a', n(cx), n(cy), n(radius), this.hex(color, alpha), n(thickness), n(start), n(sweep)].join(FS))
  }

  text(text: string | number, x: number, y: number, options: TextOptions = {}) {
    const h = options.align === 'right' ? 2 : options.align === 'center' ? 1 : 0
    const v = options.valign === 'bottom' ? 2 : options.valign === 'middle' ? 1 : 0
    const flags = (options.bold ? 1 : 0) | (options.shadow ? 2 : 0) | (options.wrap ? 4 : 0)
    const w = options.w ?? 0
    const hh = options.h ?? 0
    const s = String(text).split(RS).join('').split(FS).join('')
    this._list.push(['t', n(x), n(y), n(w), n(hh), this.hex(options.color ?? '#ffffff', options.alpha), String(Math.round(options.size ?? 16)), String(v * 3 + h), String(flags), s].join(FS))
  }

  /** 文字尺寸（像素） */
  measure(text: string, size = 16, bold = false) {
    const [width, height] = this._host.engine.uiMeasure(text, size, bold)
    return { width, height }
  }

  /** 鼠标是否在矩形内 */
  hit(x: number, y: number, w: number, h: number) {
    const [mx, my] = this._host.engine.mouse()
    return mx >= x && mx <= x + w && my >= y && my <= y + h
  }

  /** 运行时在每个游戏帧末调用 */
  flush() {
    if (!this._list.length) {
      if (this._submittedEmpty) return
      this._submittedEmpty = true
      this._host.engine.uiSubmit('')
      return
    }
    this._submittedEmpty = false
    this._host.engine.uiSubmit(this._list.join(RS))
    this._list = []
  }
}
