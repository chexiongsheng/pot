/**
 * 界面求值器（004 第 6.8、16.3、16.4 节）：把 defineGame 的 ui(w, ui) 返回的树画到 ctx.ui 上。
 *
 * 每帧：建元素树（展开片段与函数组件、算 key 路径、校验）→ 顶层节点按 at 排布 → 命中检测与交互
 * （按钮、焦点、输入框、滚动）→ 按树的顺序绘制。不保留节点；跨帧的东西（焦点、滚动位置）放 local，
 * 按下的目标等只在本求值器里记着（丢了无妨）。同一处同一信息只报一次。
 */
import { Fragment, isNode, isPrefab, isStaticChildren, nodeName, sourcePrefix } from './node'
import type { PotChild, PotNode, SourcePos } from './node'
import type { UIService } from '../ui'
import type { InputService } from '../input'
import { layoutRoot, visible } from './ui-layout'
import type { LayoutEnv, Measurer, UIElement } from './ui-layout'
import { CONTAINERS, LAYOUTS, TEXT_TAGS, drawElement, drawScrollbar } from './ui-tags'
import { similar } from './tree'

export { ANCHORS, UI_MARGIN } from './ui-layout'

/** 场景树才用的标签：放进界面树时提示放错了树 */
const WORLD_TAGS = new Set(['entity', 'rule', 'stage'])
const MAX_DEPTH = 64
const SCROLL_STEP = 40

export interface UIEnv {
  ui: UIService
  /** 没有时不做交互（只画） */
  input?: InputService
  /** 界面本地状态（焦点、滚动位置也记在这里，键以 $ 开头） */
  local?: Record<string, any>
  emit?(name: string, payload?: any): void
  /** 是否有焦点控件（有时 World 不采样键盘与轴） */
  capture?(captured: boolean): void
}

export type UIRenderer = (tree: PotChild, env: UIEnv | UIService) => void

interface Layer {
  prefix: string
  counts: Map<string, number>
  source?: SourcePos
}

function textOf(children: PotChild, out: string[], tag: string) {
  if (children === null || children === undefined || typeof children === 'boolean') return
  if (typeof children === 'string' || typeof children === 'number') {
    out.push(String(children))
    return
  }
  if (Array.isArray(children)) {
    for (const c of children) textOf(c, out, tag)
    return
  }
  throw new Error(`<${tag}> 的子节点只能是字符串和数字`)
}

const keyEdges = ['tab', 'return', 'keypadenter', 'space', 'escape', 'uparrow', 'downarrow', 'leftarrow', 'rightarrow'] as const

/** 创建一个求值器；onError 收到去重后的报错，onWarn 收到告警（列表缺 key） */
export function createUIRenderer(onError: (message: string) => void, onWarn?: (message: string) => void): UIRenderer {
  const reported = new Set<string>()
  const report = (message: string, warn = false) => {
    if (reported.has(message)) return
    if (reported.size > 256) reported.clear()
    reported.add(message)
    if (warn) onWarn?.(message)
    else onError(message)
  }
  const widths = new Map<string, number>()
  const heights = new Map<string, number>()
  let current: UIService
  const m: Measurer = {
    width(text, size, bold) {
      if (!text) return 0
      const k = `${size}|${bold ? 1 : 0}|${text}`
      let w = widths.get(k)
      if (w === undefined) {
        w = current.measure(text, size, bold).width
        if (widths.size > 4096) widths.clear()
        widths.set(k, w)
      }
      return w
    },
    lineHeight(size, bold) {
      const k = `${size}|${bold ? 1 : 0}`
      let h = heights.get(k)
      if (h === undefined) heights.set(k, h = current.measure('国Mg', size, bold).height)
      return h
    },
  }
  let prevDown = false
  let pressTarget: string | null = null
  let drag: { path: string; y: number; scroll: number } | null = null
  const prevKeys: Record<string, boolean> = {}
  let frame = 0

  // ---------------------------------------------------------------- 建元素树

  /** 标签的子节点：静态写出的子节点数组（jsxs）里的元素不算列表，其余数组（map 的结果）是列表 */
  const buildChildren = (children: PotChild, layer: Layer, depth: number, out: UIElement[], isStatic: boolean) => {
    if (Array.isArray(children)) for (const c of children) build(c, layer, depth + 1, out, !isStatic && !isStaticChildren(children))
    else build(children, layer, depth + 1, out, false)
  }

  const build = (child: PotChild, layer: Layer, depth: number, out: UIElement[], dynamic: boolean) => {
    if (child === null || child === undefined || typeof child === 'boolean' || child === '') return
    if (depth > MAX_DEPTH) {
      report(`${sourcePrefix(layer.source)}界面树嵌套超过 ${MAX_DEPTH} 层`)
      return
    }
    if (Array.isArray(child)) {
      const list = !isStaticChildren(child)
      for (const c of child) build(c, layer, depth + 1, out, list)
      return
    }
    if (!isNode(child)) {
      report(`${sourcePrefix(layer.source)}界面树里的文字要放在 <text> 里`)
      return
    }
    const node = child as PotNode
    const type = node.type
    if (dynamic && node.key === null) report(`${sourcePrefix(node.source)}列表里的 <${nodeName(node)}> 缺少 key：焦点和滚动位置按 key 路径记，增删元素后会错位`, true)
    const join = (seg: string) => (layer.prefix ? `${layer.prefix}/${seg}` : seg)
    const segment = (name: string) => {
      if (node.key !== null) return `${name}:${node.key}`
      const n = layer.counts.get(name) ?? 0
      layer.counts.set(name, n + 1)
      return `${name}#${n}`
    }
    if (type === Fragment) {
      if (node.key === null) buildChildren(node.props.children, { ...layer, source: node.source ?? layer.source }, depth, out, !!(node as any).static)
      else buildChildren(node.props.children, { prefix: join(`#${node.key}`), counts: new Map(), source: node.source }, depth, out, !!(node as any).static)
      return
    }
    if (isPrefab(type)) {
      report(`${sourcePrefix(node.source)}<${type.prefab}> 是实体标签，放错了树：实体写在 scene 里，ui 里只能用界面标签`)
      return
    }
    if (typeof type === 'function') {
      const name = nodeName(node)
      let result: PotChild
      try {
        result = (type as any)(node.props)
      } catch (error: any) {
        report(`${sourcePrefix(node.source)}界面组件 ${name} 出错：${error?.message ?? error}`)
        return
      }
      buildChildren(result, { prefix: join(segment(name)), counts: new Map(), source: node.source ?? layer.source }, depth, out, true)
      return
    }
    if (typeof type !== 'string') {
      report(`${sourcePrefix(node.source)}无法识别的界面标签`)
      return
    }
    if (!(type in LAYOUTS)) {
      if (WORLD_TAGS.has(type)) report(`${sourcePrefix(node.source)}<${type}> 是场景标签，放错了树：它写在 scene 里，ui 里只能用界面标签`)
      else report(`${sourcePrefix(node.source)}界面树里不认识 <${type}>${similar(type, Object.keys(LAYOUTS))}`)
      return
    }
    const el: UIElement = { tag: type, path: join(segment(type)), props: node.props, children: [], text: '', source: node.source, x: 0, y: 0, w: 0, h: 0, clip: null }
    try {
      if (TEXT_TAGS.has(type)) {
        const parts: string[] = []
        textOf(node.props.children, parts, type)
        el.text = parts.join('')
        if (type === 'button') el.text = el.text.replace(/[\r\n]+/g, ' ')
      } else if (CONTAINERS.has(type)) {
        buildChildren(node.props.children, { prefix: el.path, counts: new Map(), source: node.source ?? layer.source }, depth, el.children, !!(node as any).static)
      } else if (node.props.children !== undefined && node.props.children !== null && node.props.children !== false) {
        throw new Error(`<${type}> 不能有子节点`)
      }
      if (type === 'scroll' && el.props.h === undefined) throw new Error('<scroll> 需要 h')
    } catch (error: any) {
      report(`${sourcePrefix(node.source)}${error?.message ?? error}`)
      return
    }
    out.push(el)
  }

  // ---------------------------------------------------------------- 渲染

  return (tree, arg) => {
    const env: UIEnv = typeof (arg as any)?.rect === 'function' ? { ui: arg as UIService } : (arg as UIEnv)
    const ui = env.ui
    current = ui
    frame++
    const local = env.local ?? {}
    const scrolls: Record<string, number> = (local.$scroll ??= {})
    const roots: UIElement[] = []
    buildChildren(tree, { prefix: '', counts: new Map() }, 0, roots, true)

    const layoutEnv: LayoutEnv = { layouts: LAYOUTS, m, scrollOf: (path) => scrolls[path] ?? 0 }
    const placed: UIElement[] = []
    for (const root of roots) {
      if (!visible(root)) continue
      try {
        layoutRoot(root, ui.width, ui.height, layoutEnv)
        placed.push(root)
      } catch (error: any) {
        report(`${sourcePrefix(root.source)}${error?.message ?? error}`)
      }
    }

    // 绘制顺序展开（后画的在上，命中检测取最后一个）
    const order: UIElement[] = []
    const walk = (el: UIElement) => {
      if (!visible(el)) return
      order.push(el)
      for (const c of el.children) walk(c)
    }
    placed.forEach(walk)
    const byPath = new Map(order.map((el) => [el.path, el]))
    const focusables = order.filter((el) => (el.tag === 'button' && !el.props.disabled) || el.tag === 'input')
    const contains = (el: UIElement, x: number, y: number) => !!el.clip && x >= el.clip.x && x <= el.clip.x + el.clip.w && y >= el.clip.y && y <= el.clip.y + el.clip.h

    const activate = (el: UIElement) => {
      if (el.props.disabled) return
      try {
        if (el.props.emit !== undefined) env.emit?.(String(el.props.emit), el.props.payload)
        el.props.onPress?.()
      } catch (error: any) {
        report(`${sourcePrefix(el.source)}<button> 的回调出错：${error?.message ?? error}`)
      }
    }

    let hover: UIElement | null = null
    let pressedNow = false
    const input = env.input
    if (input) {
      const mouse = input.mouse()
      const down = input.key('mouse0')
      for (let i = order.length - 1; i >= 0; i--) {
        const el = order[i]
        if ((el.tag === 'button' || el.tag === 'input' || el.tag === 'scroll') && contains(el, mouse.x, mouse.y)) {
          hover = el
          break
        }
      }
      if (down && !prevDown) {
        pressTarget = hover?.path ?? null
        if (hover && (hover.tag === 'input' || (hover.tag === 'button' && !hover.props.disabled))) local.$focus = hover.path
        else local.$focus = null
        drag = hover?.tag === 'scroll' ? { path: hover.path, y: mouse.y, scroll: scrolls[hover.path] ?? 0 } : null
      }
      if (down && drag) scrolls[drag.path] = drag.scroll - (mouse.y - drag.y)
      if (!down && prevDown) {
        const target = pressTarget ? byPath.get(pressTarget) : undefined
        if (target && hover === target && target.tag === 'button') activate(target)
        pressTarget = null
        drag = null
      }
      pressedNow = down
      prevDown = down
      // 滚轮：鼠标下最内层的 scroll
      const wheel = input.wheel()
      if (wheel) {
        for (let i = order.length - 1; i >= 0; i--) {
          const el = order[i]
          if (el.tag === 'scroll' && contains(el, mouse.x, mouse.y)) {
            scrolls[el.path] = (scrolls[el.path] ?? 0) - wheel * SCROLL_STEP
            break
          }
        }
      }
      // 键盘焦点
      const edge: Record<string, boolean> = {}
      for (const k of keyEdges) {
        const now = input.key(k)
        edge[k] = now && !prevKeys[k]
        prevKeys[k] = now
      }
      let focus = local.$focus ? byPath.get(local.$focus) : undefined
      if (local.$focus && (!focus || !focusables.includes(focus))) {
        local.$focus = null
        focus = undefined
      }
      const move = (delta: number) => {
        if (!focusables.length) return
        const i = focus ? focusables.indexOf(focus) : -1
        const next = i < 0 ? (delta > 0 ? 0 : focusables.length - 1) : (i + delta + focusables.length) % focusables.length
        focus = focusables[next]
        local.$focus = focus.path
      }
      if (edge.tab) move(input.key('leftshift') || input.key('rightshift') ? -1 : 1)
      else if (focus) {
        const isInput = focus.tag === 'input'
        if (edge.escape) {
          local.$focus = null
          focus = undefined
        } else if (edge.downarrow || (!isInput && edge.rightarrow)) move(1)
        else if (edge.uparrow || (!isInput && edge.leftarrow)) move(-1)
        else if (!isInput && (edge.return || edge.keypadenter || edge.space)) activate(focus)
      }
      // 输入框键入
      if (focus && focus.tag === 'input') {
        const typed = input.text()
        if (typed) {
          const p = focus.props
          let value = String(p.value ?? '')
          let submit = false
          for (const ch of typed) {
            if (ch === '\b') value = value.slice(0, -1)
            else if (ch === '\n' || ch === '\r') submit = true
            else if (ch >= ' ' && (p.max === undefined || value.length < p.max)) value += ch
          }
          try {
            if (value !== String(p.value ?? '')) p.onChange?.(value)
            if (submit) p.onSubmit?.(value)
          } catch (error: any) {
            report(`${sourcePrefix(focus.source)}<input> 的回调出错：${error?.message ?? error}`)
          }
        }
      }
      env.capture?.(!!local.$focus)
    }
    // 滚动位置夹在范围内（布局已按旧值排好，夹紧后下一帧生效）
    for (const el of order) {
      if (el.tag !== 'scroll') continue
      const max = Math.max(0, (el.contentH ?? 0) - el.h)
      const v = scrolls[el.path] ?? 0
      if (v < 0 || v > max) scrolls[el.path] = Math.max(0, Math.min(max, v))
    }

    // 绘制
    const draw = (el: UIElement) => {
      if (!visible(el) || !el.clip) return
      const state = { hover: hover === el, pressed: hover === el && pressedNow && pressTarget === el.path, focused: local.$focus === el.path, frame }
      try {
        drawElement(el, ui, state, m)
      } catch (error: any) {
        report(`${sourcePrefix(el.source)}${error?.message ?? error}`)
      }
      if (el.tag === 'scroll') {
        ui.clip(el.x, el.y, el.w, el.h)
        el.children.forEach(draw)
        ui.unclip()
        drawScrollbar(el, ui, scrolls[el.path] ?? 0)
      } else el.children.forEach(draw)
    }
    placed.forEach(draw)
  }
}
