/**
 * 界面布局（004 第 16.4 节）：弹性布局的子集，纯计算，Node 上可单测。
 *
 * 每帧两遍：measure 自底向上量内容尺寸，layout 自顶向下分配位置。
 * 没有换行、绝对定位子节点、z 序。尺寸 w / h 为像素或 'NN%'（相对父容器内容区）；百分比在 measure 时不计。
 */
import type { SourcePos } from './node'

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export interface UIElement {
  tag: string
  /** key 路径（焦点、滚动、按下状态按它记） */
  path: string
  props: Record<string, any>
  children: UIElement[]
  /** text、button 的文字 */
  text: string
  source?: SourcePos
  x: number
  y: number
  w: number
  h: number
  /** 可见区域（被 scroll 裁剪后），命中检测用；null 表示完全不可见 */
  clip: Rect | null
  /** text 换行后的各行 */
  lines?: string[]
  /** scroll：内容总高 */
  contentH?: number
}

export interface Measurer {
  /** 单行文字的宽 */
  width(text: string, size: number, bold: boolean): number
  /** 行高 */
  lineHeight(size: number, bold: boolean): number
}

export interface TagLayout {
  /** 容器的主轴 */
  container?: 'row' | 'column'
  /** 属性缺省值（pad、gap 等） */
  defaults?: Record<string, any>
  /** 叶子的内容尺寸（含内边距）；width 已知时按它算（换行） */
  intrinsic?(el: UIElement, m: Measurer, width: number | undefined): { w: number; h: number }
}

export type TagLayouts = Record<string, TagLayout>

export const UI_MARGIN = 16

/** 九宫格位置：水平、垂直锚点（0 左/上、0.5 中、1 右/下） */
export const ANCHORS: Record<string, [number, number]> = {
  'top-left': [0, 0],
  top: [0.5, 0],
  'top-right': [1, 0],
  left: [0, 0.5],
  center: [0.5, 0.5],
  right: [1, 0.5],
  'bottom-left': [0, 1],
  bottom: [0.5, 1],
  'bottom-right': [1, 1],
}

export function prop(el: UIElement, layouts: TagLayouts, name: string) {
  const v = el.props[name]
  return v === undefined ? layouts[el.tag]?.defaults?.[name] : v
}

/** 内边距 [上, 右, 下, 左] */
export function padding(el: UIElement, layouts: TagLayouts): [number, number, number, number] {
  const p = prop(el, layouts, 'pad') ?? 0
  if (typeof p === 'number') return [p, p, p, p]
  if (Array.isArray(p) && p.length === 2) return [p[0], p[1], p[0], p[1]]
  if (Array.isArray(p) && p.length === 4) return [p[0], p[1], p[2], p[3]]
  throw new Error(`<${el.tag}> 的 pad 必须是数、[上下, 左右] 或 [上, 右, 下, 左]`)
}

/** 解析 w / h：数为像素，'NN%' 相对 base；其他为 undefined */
export function resolve(value: unknown, base: number | undefined): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.max(0, value)
  if (typeof value === 'string' && /^\d+(\.\d+)?%$/.test(value)) return base === undefined ? undefined : (base * parseFloat(value)) / 100
  if (value !== undefined) throw new Error(`尺寸必须是像素数或 'NN%'，收到 ${JSON.stringify(value)}`)
  return undefined
}

const fixedPx = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : undefined)

export const visible = (el: UIElement) => !el.props.hidden

/** 把文字按宽度断行：中日韩字符可在任意处断，其他在空格处断，单词超宽时按字符断 */
export function wrapText(text: string, maxW: number, size: number, bold: boolean, m: Measurer): string[] {
  const out: string[] = []
  for (const para of text.split('\n')) {
    const tokens = para.match(/[\u2e80-\u9fff\uac00-\ud7af\uff00-\uffef]|[^\s\u2e80-\u9fff\uac00-\ud7af\uff00-\uffef]+|\s+/g) ?? ['']
    let line = ''
    for (const token of tokens) {
      const next = line + token
      if (!line || m.width(next, size, bold) <= maxW) {
        line = next
        continue
      }
      out.push(line.replace(/\s+$/, ''))
      line = /^\s+$/.test(token) ? '' : token
      // 单个 token 比整行还宽：按字符切
      while (line && m.width(line, size, bold) > maxW && line.length > 1) {
        let i = line.length - 1
        while (i > 1 && m.width(line.slice(0, i), size, bold) > maxW) i--
        out.push(line.slice(0, i))
        line = line.slice(i)
      }
    }
    out.push(line.replace(/\s+$/, ''))
  }
  return out
}

/** 量尺寸（含自身内边距）。width 已知时按它量（文字换行、stretch 的子节点） */
export function measure(el: UIElement, layouts: TagLayouts, m: Measurer, width?: number): { w: number; h: number } {
  const def = layouts[el.tag] ?? {}
  const fw = fixedPx(el.props.w)
  const fh = fixedPx(el.props.h)
  const useW = fw ?? width
  let size: { w: number; h: number }
  if (def.container) {
    const [t, r, b, l] = padding(el, layouts)
    const gap = prop(el, layouts, 'gap') ?? 0
    const align = prop(el, layouts, 'align') ?? 'start'
    const kids = el.children.filter(visible)
    const innerW = useW === undefined ? undefined : Math.max(0, useW - l - r)
    let main = 0
    let cross = 0
    for (const child of kids) {
      const hint = def.container === 'column' ? fixedPx(child.props.w) ?? (align === 'stretch' || child.props.wrap ? innerW : undefined) : fixedPx(child.props.w)
      const s = measure(child, layouts, m, hint)
      if (def.container === 'column') {
        main += s.h
        cross = Math.max(cross, s.w)
      } else {
        main += s.w
        cross = Math.max(cross, s.h)
      }
    }
    main += Math.max(0, kids.length - 1) * gap
    size = def.container === 'column' ? { w: cross + l + r, h: main + t + b } : { w: main + l + r, h: cross + t + b }
  } else {
    size = def.intrinsic ? def.intrinsic(el, m, useW) : { w: 0, h: 0 }
  }
  return { w: fw ?? (width !== undefined && def.container ? Math.max(width, size.w) : size.w), h: fh ?? size.h }
}

function intersect(a: Rect | null, b: Rect): Rect | null {
  if (!a) return null
  const x0 = Math.max(a.x, b.x), y0 = Math.max(a.y, b.y)
  const x1 = Math.min(a.x + a.w, b.x + b.w), y1 = Math.min(a.y + a.h, b.y + b.h)
  if (x1 <= x0 || y1 <= y0) return null
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
}

export interface LayoutEnv {
  layouts: TagLayouts
  m: Measurer
  /** scroll 的当前位置（按路径） */
  scrollOf(path: string): number
}

/** 自顶向下排布：给定元素的位置与尺寸，排它的子孙 */
export function layout(el: UIElement, x: number, y: number, w: number, h: number, clip: Rect | null, env: LayoutEnv) {
  el.x = x
  el.y = y
  el.w = w
  el.h = h
  el.clip = intersect(clip, { x, y, w, h })
  const { layouts, m } = env
  const def = layouts[el.tag] ?? {}
  if (!def.container) {
    if (def.intrinsic) def.intrinsic(el, m, w)
    return
  }
  const [t, r, b, l] = padding(el, layouts)
  const gap = prop(el, layouts, 'gap') ?? 0
  const align = prop(el, layouts, 'align') ?? 'start'
  const justify = prop(el, layouts, 'justify') ?? 'start'
  const kids = el.children.filter(visible)
  const innerX = x + l, innerY = y + t
  const innerW = Math.max(0, w - l - r)
  const scroll = el.tag === 'scroll'
  const innerH = Math.max(0, h - t - b)
  const column = def.container === 'column'
  const mainSpace = column ? innerH : innerW
  const crossSpace = column ? innerW : innerH
  const sizes = kids.map((child) => {
    let cw: number, ch: number
    if (column) {
      const natural = () => measure(child, layouts, m)
      cw = resolve(child.props.w, innerW) ?? (align === 'stretch' ? innerW : Math.min(natural().w, child.props.wrap ? innerW : Infinity))
      ch = resolve(child.props.h, scroll ? undefined : innerH) ?? measure(child, layouts, m, cw).h
      return { main: ch, cross: cw }
    }
    cw = resolve(child.props.w, innerW) ?? measure(child, layouts, m).w
    ch = resolve(child.props.h, innerH) ?? (align === 'stretch' ? innerH : measure(child, layouts, m, cw).h)
    return { main: cw, cross: ch }
  })
  const used = sizes.reduce((s, v) => s + v.main, 0) + Math.max(0, kids.length - 1) * gap
  let remaining = scroll ? 0 : mainSpace - used
  const totalGrow = kids.reduce((s, c) => s + (Number(c.props.grow) > 0 ? Number(c.props.grow) : 0), 0)
  if (remaining > 0 && totalGrow > 0) {
    kids.forEach((c, i) => {
      const g = Number(c.props.grow) > 0 ? Number(c.props.grow) : 0
      sizes[i].main += (remaining * g) / totalGrow
    })
    remaining = 0
  }
  let offset = 0
  let spacing = gap
  if (remaining > 0) {
    if (justify === 'center') offset = remaining / 2
    else if (justify === 'end') offset = remaining
    else if (justify === 'between' && kids.length > 1) spacing = gap + remaining / (kids.length - 1)
  }
  const scrollY = scroll ? env.scrollOf(el.path) : 0
  const childClip = scroll ? intersect(el.clip, { x: innerX, y: innerY, w: innerW, h: innerH }) : el.clip
  let pos = offset
  kids.forEach((child, i) => {
    const s = sizes[i]
    let crossPos = 0
    if (align === 'center') crossPos = (crossSpace - s.cross) / 2
    else if (align === 'end') crossPos = crossSpace - s.cross
    if (column) layout(child, innerX + crossPos, innerY + pos - scrollY, s.cross, s.main, childClip, env)
    else layout(child, innerX + pos, innerY + crossPos, s.main, s.cross, childClip, env)
    pos += s.main + spacing
  })
  if (scroll) el.contentH = Math.max(0, pos - spacing)
}

/** 顶层节点按 at 放在屏幕上 */
export function layoutRoot(el: UIElement, screenW: number, screenH: number, env: LayoutEnv) {
  const w = resolve(el.props.w, screenW) ?? measure(el, env.layouts, env.m).w
  const h = resolve(el.props.h, screenH) ?? measure(el, env.layouts, env.m, w).h
  const at = el.props.at ?? 'top-left'
  let x: number, y: number
  if (typeof at === 'string') {
    const anchor = ANCHORS[at]
    if (!anchor) throw new Error(`<${el.tag}> 的 at 不认识 "${at}"，可用 ${Object.keys(ANCHORS).join('、')} 或 [x, y]`)
    x = UI_MARGIN + (screenW - UI_MARGIN * 2 - w) * anchor[0]
    y = UI_MARGIN + (screenH - UI_MARGIN * 2 - h) * anchor[1]
  } else if (Array.isArray(at) && at.length === 2 && at.every((n) => typeof n === 'number' && Number.isFinite(n))) {
    x = at[0]
    y = at[1]
  } else {
    throw new Error(`<${el.tag}> 的 at 必须是九宫格位置名或 [x, y]`)
  }
  layout(el, x, y, w, h, { x: 0, y: 0, w: screenW, h: screenH }, env)
}
