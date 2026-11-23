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
  /** 字距，单位 em（同 CSS letter-spacing，每个字后面都加，含最后一个） */
  spacing?: number
}

export interface RectOptions {
  radius?: number
  alpha?: number
}

/** 渐变色标：颜色，或 [颜色, 位置 0..1]；不写位置的按 CSS 规则在相邻有位置的色标间均分（首默认 0、末默认 1） */
export type GradientStop = Color | [Color, number]

export interface GradientOptions {
  /** CSS linear-gradient 角度：180（默认）从上到下，90 从左到右，0 从下到上，270 从右到左；只支持 90 的整数倍 */
  angle?: number
  radius?: number
  /** 透明度倍数 0 到 1 */
  alpha?: number
}

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export interface FlowOptions {
  /** 主轴方向，默认 row（从左到右）；column 为从上到下 */
  dir?: 'row' | 'column'
  /** 相邻两项的间距 */
  gap?: number
  /** 交叉轴对齐：起点坐标是该轴的 start（默认）/ center / end 线 */
  align?: 'start' | 'center' | 'end'
}

export interface LayoutOptions {
  dir?: 'row' | 'column'
  gap?: number
  /** 主轴分布：start（默认）、center、end、between（两端对齐，间距均分，至少为 gap） */
  justify?: 'start' | 'center' | 'end' | 'between'
  /** 交叉轴对齐：start（默认）、center、end、stretch（拉满容器） */
  align?: 'start' | 'center' | 'end' | 'stretch'
}

/**
 * 增量排布（尺寸边画边知道时用）：next(w, h) 返回这一项的矩形并把游标前移 w（或 h）+ gap。
 * x/y 为下一项的位置，width/height 为已排内容的外框（不含末尾 gap）。
 */
export class Flow {
  /** 下一项的主轴起点（row 为 x，column 为 y）与交叉轴锚点 */
  x: number
  y: number
  width = 0
  height = 0
  private _count = 0
  constructor(private _x0: number, private _y0: number, private _o: FlowOptions = {}) {
    this.x = _x0
    this.y = _y0
  }

  next(w: number, h: number): Rect {
    const row = (this._o.dir ?? 'row') === 'row'
    const gap = this._o.gap ?? 0
    const align = this._o.align ?? 'start'
    const cross = row ? h : w
    const off = align === 'center' ? -cross / 2 : align === 'end' ? -cross : 0
    const r: Rect = row ? { x: this.x, y: this._y0 + off, w, h } : { x: this._x0 + off, y: this.y, w, h }
    if (row) {
      this.width = this.x + w - this._x0
      this.height = Math.max(this.height, h)
      this.x += w + gap
    } else {
      this.height = this.y + h - this._y0
      this.width = Math.max(this.width, w)
      this.y += h + gap
    }
    this._count++
    return r
  }

  /** 已排的项数 */
  get count() {
    return this._count
  }
}

/** 已知各项尺寸时，在容器内按主轴分布与交叉轴对齐算出每项矩形（不绘制） */
export function layoutRects(sizes: ArrayLike<[number, number] | { w: number; h: number }>, box: Rect, options: LayoutOptions = {}): Rect[] {
  const row = (options.dir ?? 'row') === 'row'
  const gap = options.gap ?? 0
  const items = Array.from(sizes, (s) => (Array.isArray(s) ? { w: s[0], h: s[1] } : { w: s.w, h: s.h }))
  const mainBox = row ? box.w : box.h
  const crossBox = row ? box.h : box.w
  const mains = items.map((s) => (row ? s.w : s.h))
  const total = mains.reduce((a, b) => a + b, 0)
  const justify = options.justify ?? 'start'
  let space = gap
  let start = 0
  const used = total + gap * Math.max(0, items.length - 1)
  if (justify === 'between' && items.length > 1) space = Math.max(gap, (mainBox - total) / (items.length - 1))
  else if (justify === 'center') start = (mainBox - used) / 2
  else if (justify === 'end') start = mainBox - used
  else if (justify === 'between') start = (mainBox - used) / 2
  const align = options.align ?? 'start'
  const out: Rect[] = []
  let at = start
  for (let i = 0; i < items.length; i++) {
    const s = items[i]
    let cross = row ? s.h : s.w
    let off = 0
    if (align === 'stretch') cross = crossBox
    else if (align === 'center') off = (crossBox - cross) / 2
    else if (align === 'end') off = crossBox - cross
    out.push(row ? { x: box.x + at, y: box.y + off, w: s.w, h: cross } : { x: box.x + off, y: box.y + at, w: cross, h: s.h })
    at += mains[i] + space
  }
  return out
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

  /**
   * 线性渐变填充矩形（同 CSS linear-gradient，色标间按预乘 alpha 插值）。
   * 例：ui.gradient(0, 0, W, H, [['#06080ad1', 0], ['#06080a80', 0.38], ['#06080a00', 0.72]], { angle: 90 })
   */
  gradient(x: number, y: number, w: number, h: number, stops: GradientStop[], options: GradientOptions = {}) {
    if (!Array.isArray(stops) || stops.length === 0) throw new Error('ui.gradient：stops 至少要有一个色标')
    const raw = options.angle ?? 180
    if (!Number.isFinite(raw) || raw % 90 !== 0) throw new Error('ui.gradient：angle 只支持 0/90/180/270')
    const angle = ((raw % 360) + 360) % 360
    const list = stops.map((s) => {
      const pair = Array.isArray(s) && s.length === 2 && typeof s[1] === 'number' && (typeof s[0] === 'string' || Array.isArray(s[0]))
      const color = (pair ? s[0] : s) as Color
      const pos = pair ? (s[1] as number) : undefined
      if (pos !== undefined && !Number.isFinite(pos)) throw new Error('ui.gradient：色标位置须为有限数')
      return { hex: this.hex(color, options.alpha), pos }
    })
    // CSS 规则：首末缺省 0 / 1；位置不得小于前一个；中间缺省的在两侧已知位置间均分
    if (list[0].pos === undefined) list[0].pos = 0
    if (list.length > 1 && list[list.length - 1].pos === undefined) list[list.length - 1].pos = 1
    let max = -Infinity
    for (const s of list) if (s.pos !== undefined) { s.pos = Math.max(s.pos, max); max = s.pos }
    for (let i = 1; i < list.length; i++) {
      if (list[i].pos !== undefined) continue
      let j = i
      while (list[j].pos === undefined) j++
      const a = list[i - 1].pos!, b = list[j].pos!
      for (let k = i; k < j; k++) list[k].pos = a + ((b - a) * (k - i + 1)) / (j - i + 1)
    }
    // 统一成沿 +x（横向）或 +y（纵向）：0° 与 270° 反转色标
    const vertical = angle === 0 || angle === 180
    const flip = angle === 0 || angle === 270
    const out = (flip ? list.slice().reverse().map((s) => ({ hex: s.hex, pos: 1 - s.pos! })) : list).map((s) => `${s.hex}@${Math.round(s.pos! * 10000) / 10000}`)
    this._list.push(['g', n(x), n(y), n(w), n(h), n(options.radius ?? 0), vertical ? '1' : '0', out.join(';')].join(FS))
  }

  line(x1: number, y1: number, x2: number, y2: number, color: Color, width = 1, alpha = 1) {
    this._list.push(['l', n(x1), n(y1), n(x2), n(y2), this.hex(color, alpha), n(width)].join(FS))
  }

  /** 圆弧：角度制，0 度朝上，顺时针；sweep 360 为整圆 */
  arc(cx: number, cy: number, radius: number, color: Color, thickness = 2, start = 0, sweep = 360, alpha = 1) {
    this._list.push(['a', n(cx), n(cy), n(radius), this.hex(color, alpha), n(thickness), n(start), n(sweep)].join(FS))
  }

  text(text: string | number, x: number, y: number, options: TextOptions = {}) {
    const size = Math.round(options.size ?? 16)
    if (options.spacing) return this._spacedText(String(text), x, y, size, options)
    const h = options.align === 'right' ? 2 : options.align === 'center' ? 1 : 0
    const v = options.valign === 'bottom' ? 2 : options.valign === 'middle' ? 1 : 0
    const flags = (options.bold ? 1 : 0) | (options.shadow ? 2 : 0) | (options.wrap ? 4 : 0)
    const w = options.w ?? 0
    const hh = options.h ?? 0
    const s = String(text).split(RS).join('').split(FS).join('')
    this._list.push(['t', n(x), n(y), n(w), n(hh), this.hex(options.color ?? '#ffffff', options.alpha), String(size), String(v * 3 + h), String(flags), s].join(FS))
  }

  /** 文字尺寸（像素）。spacing（em）不为 0 时按逐字宽度加字距计算，宽度含末尾字距（同 CSS） */
  measure(text: string, size = 16, bold = false, spacing = 0) {
    if (spacing) {
      const lines = String(text).split('\n')
      const width = Math.max(...lines.map((l) => this._spacedWidth(l, Math.round(size), bold, spacing * Math.round(size))))
      return { width, height: this._lineHeight(Math.round(size), bold) * lines.length }
    }
    const [width, height] = this._host.engine.uiMeasure(text, size, bold)
    return { width, height }
  }

  private _charWidths = new Map<string, number>()
  private _lineHeights = new Map<string, number>()

  private _charWidth(ch: string, size: number, bold: boolean) {
    const key = `${size}|${bold ? 1 : 0}|${ch}`
    let w = this._charWidths.get(key)
    if (w === undefined) {
      // 宿主量单个空格常为 0，按常见字体的空格宽度（约 0.3em）计
      w = ch === ' ' ? size * 0.3 : this._host.engine.uiMeasure(ch, size, bold)[0]
      if (this._charWidths.size > 4096) this._charWidths.clear()
      this._charWidths.set(key, w)
    }
    return w
  }

  private _lineHeight(size: number, bold: boolean) {
    const key = `${size}|${bold ? 1 : 0}`
    let h = this._lineHeights.get(key)
    if (h === undefined) {
      h = this._host.engine.uiMeasure('国Mg', size, bold)[1]
      this._lineHeights.set(key, h)
    }
    return h
  }

  private _spacedWidth(line: string, size: number, bold: boolean, sp: number) {
    let w = 0
    for (const ch of line) w += this._charWidth(ch, size, bold) + sp
    return w
  }

  /** 带字距：按字切行（wrap 时在 w 内按字断行，英文优先在空格处断）、按 align/valign 定位后逐字提交 */
  private _spacedText(text: string, x: number, y: number, size: number, o: TextOptions) {
    const bold = !!o.bold
    const sp = (o.spacing ?? 0) * size
    const maxW = o.w ?? 0
    const lines: string[] = []
    for (const para of text.split('\n')) {
      if (!o.wrap || !maxW) { lines.push(para); continue }
      let line = '', lw = 0, lastSpace = -1
      for (const ch of para) {
        const cw = this._charWidth(ch, size, bold) + sp
        if (lw + cw > maxW && line) {
          if (ch !== ' ' && lastSpace > 0) {
            lines.push(line.slice(0, lastSpace))
            line = line.slice(lastSpace + 1)
            lw = this._spacedWidth(line, size, bold, sp)
          } else {
            lines.push(line)
            line = ''
            lw = 0
          }
          lastSpace = -1
          if (ch === ' ') continue
        }
        if (ch === ' ') lastSpace = line.length
        line += ch
        lw += cw
      }
      lines.push(line)
    }
    const lh = this._lineHeight(size, bold)
    const total = lh * lines.length
    const boxH = o.h ?? 0
    // 与无字距的 text 一致：有框时在框内对齐，没框时 (x, y) 为锚点
    let top = y
    if (o.valign === 'middle') top = boxH ? y + (boxH - total) / 2 : y - total / 2
    else if (o.valign === 'bottom') top = boxH ? y + boxH - total : y - total
    const color = this.hex(o.color ?? '#ffffff', o.alpha)
    const flags = (bold ? 1 : 0) | (o.shadow ? 2 : 0)
    // 单行且没给框：每个字直接按原 valign 以 y 为锚点（与无字距的 text 逐像素一致）；否则每行按行中心对齐
    const single = lines.length === 1 && !boxH
    const vcode = single ? (o.valign === 'bottom' ? 2 : o.valign === 'middle' ? 1 : 0) : 1
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const lw = this._spacedWidth(line, size, bold, sp)
      let cx = x
      if (o.align === 'center') cx = maxW ? x + (maxW - lw) / 2 : x - lw / 2
      else if (o.align === 'right') cx = maxW ? x + maxW - lw : x - lw
      // 末尾字距让视觉中心偏移：居中时补回半个字距，右对齐时补回一个（字框仍含末尾字距）
      if (o.align === 'center') cx += sp / 2
      else if (o.align === 'right') cx += sp
      const cy = single ? y : top + lh * i + lh / 2
      for (const ch of line) {
        if (ch !== ' ') this._list.push(['t', n(cx), n(cy), '0', '0', color, String(size), String(vcode * 3), String(flags), ch.split(RS).join('').split(FS).join('')].join(FS))
        cx += this._charWidth(ch, size, bold) + sp
      }
    }
  }

  /** 鼠标是否在矩形内 */
  hit(x: number, y: number, w: number, h: number) {
    const [mx, my] = this._host.engine.mouse()
    return mx >= x && mx <= x + w && my >= y && my <= y + h
  }

  /** 增量行/列排布（各项尺寸边画边知道时用）：const f = ui.flow(x, y, { gap: 10 }); const r = f.next(w, h) */
  flow(x: number, y: number, options: FlowOptions = {}) {
    return new Flow(x, y, options)
  }

  /** 已知各项尺寸时在容器内排布：返回每项矩形（justify 主轴分布、align 交叉轴对齐） */
  layout(sizes: ArrayLike<[number, number] | { w: number; h: number }>, box: Rect, options: LayoutOptions = {}) {
    return layoutRects(sizes, box, options)
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
