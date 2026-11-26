/**
 * 界面标签（004 第 16.4 节）：每个标签的内容尺寸、绘制，以及 pot blocks 用的说明表。
 * 交互（按下、焦点、键入、滚动、滑块拖动）在 ui-eval.ts。
 */
import type { UIService } from '../ui'
import { padding, prop, wrapText } from './ui-layout'
import type { Font, Measurer, TagLayouts, UIElement } from './ui-layout'

export interface DrawState {
  hover: boolean
  pressed: boolean
  focused: boolean
  /** 界面帧计数（光标闪烁） */
  frame: number
}

const LEAF_SIZE = 16

/** 字号与字体（粗体、字重、字距）；text、button、input 共用 */
function fontOf(el: UIElement): { size: number; font: Font } {
  const p = el.props
  const font: Font = { bold: !!p.bold }
  if (p.weight !== undefined) font.weight = p.weight
  if (Number(p.spacing)) font.spacing = Number(p.spacing)
  return { size: Number(p.size) || LEAF_SIZE, font }
}

/** ctx.ui.text 的字体选项 */
const textFont = (font: Font) => (font.weight !== undefined ? { weight: font.weight } : { bold: !!font.bold })

const fixed = (v: unknown, fallback: number) => (typeof v === 'number' ? v : fallback)

export const LAYOUTS: TagLayouts = {
  column: { container: 'column' },
  row: { container: 'row' },
  panel: { container: 'column', defaults: { pad: 12, gap: 8, bg: '#1a1d26e6', radius: 8 } },
  scroll: { container: 'column' },
  text: {
    intrinsic(el, m, width) {
      const { size, font } = fontOf(el)
      const [t, r, b, l] = padding(el, LAYOUTS)
      const lh = m.lineHeight(size, font)
      const lines = el.props.wrap && width !== undefined ? wrapText(el.text, Math.max(1, width - l - r), size, font, m) : el.text.split('\n')
      el.lines = lines
      const w = Math.max(0, ...lines.map((line) => m.width(line, size, font)))
      return { w: w + l + r, h: lines.length * lh + t + b }
    },
  },
  button: {
    defaults: { pad: [8, 16] },
    intrinsic(el, m) {
      const { size, font } = fontOf(el)
      const [t, r, b, l] = padding(el, LAYOUTS)
      return { w: m.width(el.text, size, font) + l + r, h: m.lineHeight(size, font) + t + b }
    },
  },
  bar: {
    intrinsic(el) {
      return { w: fixed(el.props.w, 120), h: fixed(el.props.h, 10) }
    },
  },
  image: {
    intrinsic(el) {
      const src = el.props.src
      const sw = Number(src?.width) || 64, sh = Number(src?.height) || 64
      const w = typeof el.props.w === 'number' ? el.props.w : undefined
      const h = typeof el.props.h === 'number' ? el.props.h : undefined
      if (w !== undefined && h === undefined) return { w, h: (w * sh) / sw }
      if (h !== undefined && w === undefined) return { w: (h * sw) / sh, h }
      return { w: w ?? sw, h: h ?? sh }
    },
  },
  input: {
    defaults: { pad: [6, 10] },
    intrinsic(el, m) {
      const { size, font } = fontOf(el)
      const [t, , b] = padding(el, LAYOUTS)
      return { w: fixed(el.props.w, 200), h: m.lineHeight(size, font) + t + b }
    },
  },
  slider: {
    intrinsic(el) {
      return { w: fixed(el.props.w, 200), h: fixed(el.props.h, 20) }
    },
  },
  canvas: {
    intrinsic(el) {
      return { w: fixed(el.props.w, 0), h: fixed(el.props.h, 0) }
    },
  },
}

/** 有子元素的标签（其余是叶子）；text、button 的子节点是文字 */
export const CONTAINERS = new Set(['column', 'row', 'panel', 'scroll'])
export const TEXT_TAGS = new Set(['text', 'button'])
export const UI_TAG_NAMES = Object.keys(LAYOUTS)

const FOCUS = '#ffd54f'

/** border 属性：颜色或 { color, width } */
function drawBorder(ui: UIService, border: any, x: number, y: number, w: number, h: number, radius: number | undefined, alpha: number) {
  if (!border) return
  const b = typeof border === 'string' || Array.isArray(border) ? { color: border, width: 1 } : border
  ui.border(x, y, w, h, b.color, b.width ?? 1, { radius, alpha })
}

/** alpha 为沿树累乘的 opacity */
export function drawElement(el: UIElement, ui: UIService, s: DrawState, m: Measurer, alpha = 1) {
  const p = el.props
  const { x, y, w, h } = el
  switch (el.tag) {
    case 'panel': {
      const radius = prop(el, LAYOUTS, 'radius')
      const bg = prop(el, LAYOUTS, 'bg')
      if (bg) ui.rect(x, y, w, h, bg, { radius, alpha })
      drawBorder(ui, p.border, x, y, w, h, radius, alpha)
      return
    }
    case 'text': {
      const { size, font } = fontOf(el)
      const [t, r, , l] = padding(el, LAYOUTS)
      const lh = m.lineHeight(size, font)
      const lines = el.lines ?? [el.text]
      const align = p.align === 'center' || p.align === 'right' ? p.align : 'left'
      lines.forEach((line, i) => {
        ui.text(line, x + l, y + t + i * lh, { size, ...textFont(font), spacing: font.spacing, shadow: !!p.shadow, color: p.color ?? '#ffffff', alpha, w: Math.max(0, w - l - r), h: lh, align, valign: 'middle' })
      })
      return
    }
    case 'button': {
      const { size, font } = fontOf(el)
      const radius = p.radius ?? 6
      const a = alpha * (p.disabled ? 0.45 : 1)
      const hot = !p.disabled && s.hover && !s.pressed
      ui.rect(x, y, w, h, hot && p.hoverBg ? p.hoverBg : p.bg ?? '#3a7bd5', { radius, alpha: a })
      if (!p.disabled && s.pressed) ui.rect(x, y, w, h, '#000000', { radius, alpha: 0.2 * alpha })
      else if (hot && !p.hoverBg) ui.rect(x, y, w, h, '#ffffff', { radius, alpha: 0.12 * alpha })
      drawBorder(ui, p.border, x, y, w, h, radius, a)
      if (s.focused) ui.border(x - 2, y - 2, w + 4, h + 4, FOCUS, 2, { radius: radius + 2, alpha })
      const color = hot && p.hoverColor ? p.hoverColor : p.color ?? '#ffffff'
      ui.text(el.text, x, y, { size, ...textFont(font), spacing: font.spacing, shadow: !!p.shadow, color, w, h, align: 'center', valign: 'middle', alpha: a })
      return
    }
    case 'bar': {
      const max = Number(p.max ?? 1) || 1
      const ratio = Math.max(0, Math.min(1, Number(p.value ?? 0) / max))
      const radius = p.radius ?? h / 2
      ui.rect(x, y, w, h, p.bg ?? '#ffffff33', { radius, alpha })
      if (ratio > 0) ui.rect(x, y, w * ratio, h, p.color ?? '#4caf50', { radius, alpha })
      return
    }
    case 'image': {
      const src = p.src
      if (!src) return
      const sw = Number(src.width) || 1, sh = Number(src.height) || 1
      const fit = p.fit ?? 'fill'
      const opts: any = { tint: p.tint, radius: p.radius, alpha }
      if (fit === 'contain') {
        const k = Math.min(w / sw, h / sh)
        const dw = sw * k, dh = sh * k
        ui.image(src, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh, opts)
      } else if (fit === 'cover') {
        const k = Math.max(w / sw, h / sh)
        const uw = w / (sw * k), uh = h / (sh * k)
        ui.image(src, x, y, w, h, { ...opts, uv: [(1 - uw) / 2, (1 - uh) / 2, uw, uh] })
      } else ui.image(src, x, y, w, h, opts)
      return
    }
    case 'input': {
      const { size, font } = fontOf(el)
      const [t, r, b, l] = padding(el, LAYOUTS)
      const radius = p.radius ?? 4
      ui.rect(x, y, w, h, p.bg ?? '#0e1016', { radius, alpha })
      ui.border(x, y, w, h, s.focused ? '#4fc3f7' : '#ffffff40', s.focused ? 2 : 1, { radius, alpha })
      const value = String(p.value ?? '')
      const innerW = Math.max(0, w - l - r)
      ui.clip(x + l, y + t, innerW, Math.max(0, h - t - b))
      const tw = m.width(value, size, font)
      // 文字比框长时左移，保证末尾（光标）可见
      const shift = s.focused ? Math.max(0, tw + 2 - innerW) : 0
      if (value) ui.text(value, x + l - shift, y, { size, ...textFont(font), color: p.color ?? '#ffffff', w: tw + 4, h, valign: 'middle', alpha })
      else if (p.placeholder) ui.text(String(p.placeholder), x + l, y, { size, ...textFont(font), color: '#ffffff66', w: innerW, h, valign: 'middle', alpha })
      if (s.focused && Math.floor(s.frame / 30) % 2 === 0) ui.rect(x + l - shift + tw + 1, y + t, 2, Math.max(0, h - t - b), '#ffffff', { alpha })
      ui.unclip()
      return
    }
    case 'slider': {
      const min = Number(p.min ?? 0), max = Number(p.max ?? 1)
      const k = max === min ? 0 : Math.max(0, Math.min(1, (Number(p.value ?? min) - min) / (max - min)))
      const a = alpha * (p.disabled ? 0.45 : 1)
      const track = 4, ty = y + (h - track) / 2
      const color = p.color ?? '#4fc3f7'
      ui.rect(x, ty, w, track, p.bg ?? '#ffffff40', { radius: track / 2, alpha: a })
      if (k > 0) ui.rect(x, ty, w * k, track, color, { radius: track / 2, alpha: a })
      const kw = 14, kh = Math.min(h, 16)
      const kx = x + w * k - kw / 2, ky = y + (h - kh) / 2
      ui.rect(kx, ky, kw, kh, p.knob ?? '#ffffff', { radius: 3, alpha: a })
      if (s.focused) ui.border(kx - 2, ky - 2, kw + 4, kh + 4, FOCUS, 2, { radius: 4, alpha })
      return
    }
    case 'canvas': {
      if (typeof p.draw !== 'function') throw new Error('<canvas> 需要 draw(d, box) 回调')
      try {
        p.draw(ui, { x, y, w, h, alpha })
      } catch (error: any) {
        throw new Error(`<canvas> 的 draw 出错：${error?.message ?? error}`)
      }
      return
    }
  }
}

/** 画 scroll 的滚动条（在子元素之后、出裁剪之前） */
export function drawScrollbar(el: UIElement, ui: UIService, scrollY: number) {
  const content = el.contentH ?? 0
  if (content <= el.h) return
  const track = el.h
  const thumb = Math.max(20, (track * el.h) / content)
  const top = el.y + ((track - thumb) * scrollY) / (content - el.h)
  ui.rect(el.x + el.w - 4, top, 3, thumb, '#ffffff55', { radius: 1.5 })
}

/** pot blocks 用：界面标签的一句话说明与属性 */
export const UI_TAG_DOCS: Record<string, { about: string; props: Record<string, string> }> = {
  column: { about: '纵向排列子元素，本身不画东西', props: { gap: '间距', align: 'start|center|end|stretch', justify: 'start|center|end|between', pad: '内边距' } },
  row: { about: '横向排列子元素，本身不画东西', props: { gap: '间距', align: 'start|center|end|stretch', justify: 'start|center|end|between', pad: '内边距' } },
  panel: { about: '带底色的纵向容器（缺省 pad 12、gap 8）', props: { bg: '底色', border: '描边颜色或 { color, width }', radius: '圆角' } },
  text: { about: '文字；子节点里的字符串和数字拼起来', props: { size: '字号（16）', color: '颜色', bold: '粗体', weight: '字重 100 到 900（优先于 bold）', spacing: '字距（em）', shadow: '1 像素投影', wrap: '按宽度换行（需要确定宽度）', align: 'left|center|right' } },
  button: { about: '按钮：点击或焦点上按 Enter/空格时 ui.emit(emit, payload) 并调 onPress', props: { emit: '事件名', payload: '事件参数', onPress: '回调（只改 ui.local 或 ui.emit）', onHover: '指针移入时调一次（放提示音等）', disabled: '禁用', bg: '底色', hoverBg: '悬停底色', color: '文字颜色', hoverColor: '悬停文字颜色', border: '描边颜色或 { color, width }', size: '字号', weight: '字重', spacing: '字距（em）' } },
  bar: { about: '进度条', props: { value: '当前值', max: '最大值（1）', color: '前景色', bg: '底色', w: '宽（120）', h: '高（10）' } },
  image: { about: '贴图（低层 Texture）', props: { src: 'Texture', fit: 'fill|contain|cover', tint: '染色', radius: '圆角' } },
  scroll: { about: '纵向滚动容器，内容超出时裁剪；滚轮、拖动滚动', props: { h: '高（必填）', gap: '间距' } },
  input: { about: '单行输入框（受控）：显示 value，键入时 onChange(新值)，Enter 时 onSubmit(值)', props: { value: '当前值', onChange: '回调', onSubmit: '回调', placeholder: '占位文字', max: '最大长度', w: '宽（200）', size: '字号' } },
  slider: { about: '滑块（受控）：拖动或焦点上左右方向键改值，值变了调 onChange(新值)', props: { value: '当前值', min: '最小值（0）', max: '最大值（1）', step: '步长（缺省为范围的 1/20，只用于方向键；给了时拖动也对齐）', onChange: '回调', color: '已选部分颜色', bg: '轨道颜色', knob: '滑钮颜色', w: '宽（200）', h: '高（20）' } },
  canvas: { about: '自绘区：在布局里占位，按树的顺序调 draw(d, box)；d 为 ctx.ui，box 为 { x, y, w, h, alpha }', props: { draw: '回调', w: '宽', h: '高' } },
}

export const UI_COMMON_PROPS: Record<string, string> = {
  at: '只对顶层节点：九宫格位置名或 [x, y]（top-left）',
  w: '宽：像素或 "50%"',
  h: '高：像素或 "50%"',
  grow: '主轴上分剩余空间的权重',
  pad: '内边距：数、[上下, 左右] 或 [上, 右, 下, 左]',
  hidden: '为真时不占位、不绘制',
  opacity: '不透明度 0 到 1，乘到自身与全部子孙上',
}
