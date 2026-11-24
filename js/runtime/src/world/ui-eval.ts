/**
 * 界面求值器（004 第 15.11 节）：把 defineGame 的 ui(w, ctx.ui) 返回的树画到 ctx.ui 上。
 *
 * 只认片段、数组、函数组件和 <text>。<text> 子节点里的字符串和数字拼成一行；
 * at 是九宫格位置名或像素坐标 [x, y]，九宫格离屏幕边缘 UI_MARGIN 像素，对齐方式由 at 推出。
 * 其他标签报错，同一处同一信息只报一次。
 */
import { Fragment, isNode, isPrefab, nodeName, sourcePrefix } from './node'
import type { PotChild, PotNode } from './node'
import type { HAlign, UIService, VAlign } from '../ui'

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

const H: HAlign[] = ['left', 'center', 'right']
const V: VAlign[] = ['top', 'middle', 'bottom']
const MAX_DEPTH = 64

export type UIRenderer = (tree: PotChild, ui: UIService) => void

function textOf(children: PotChild, out: string[]) {
  if (children === null || children === undefined || typeof children === 'boolean') return
  if (typeof children === 'string' || typeof children === 'number') {
    out.push(String(children))
    return
  }
  if (Array.isArray(children)) {
    for (const c of children) textOf(c, out)
    return
  }
  throw new Error('<text> 的子节点只能是字符串和数字')
}

/** 创建一个求值器；onError 收到去重后的报错信息 */
export function createUIRenderer(onError: (message: string) => void): UIRenderer {
  const reported = new Set<string>()
  const report = (message: string) => {
    if (reported.has(message)) return
    if (reported.size > 256) reported.clear()
    reported.add(message)
    onError(message)
  }

  const text = (node: PotNode, ui: UIService) => {
    const p = node.props
    const parts: string[] = []
    textOf(p.children, parts)
    const content = parts.join('').replace(/[\r\n]+/g, ' ')
    const at = p.at ?? 'top-left'
    let x: number, y: number, h = 0, v = 0
    if (typeof at === 'string') {
      const anchor = ANCHORS[at]
      if (!anchor) throw new Error(`<text> 的 at 不认识 "${at}"，可用 ${Object.keys(ANCHORS).join('、')} 或 [x, y]`)
      x = UI_MARGIN + (ui.width - UI_MARGIN * 2) * anchor[0]
      y = UI_MARGIN + (ui.height - UI_MARGIN * 2) * anchor[1]
      h = anchor[0] * 2
      v = anchor[1] * 2
    } else if (Array.isArray(at) && at.length === 2 && at.every((n) => typeof n === 'number' && Number.isFinite(n))) {
      x = at[0]
      y = at[1]
    } else {
      throw new Error('<text> 的 at 必须是九宫格位置名或 [x, y]')
    }
    ui.text(content, x, y, { size: p.size, color: p.color, bold: p.bold, align: H[h], valign: V[v] })
  }

  const visit = (child: PotChild, ui: UIService, depth: number, source?: PotNode['source']) => {
    if (child === null || child === undefined || typeof child === 'boolean') return
    if (depth > MAX_DEPTH) {
      report(`${sourcePrefix(source)}界面树嵌套超过 ${MAX_DEPTH} 层`)
      return
    }
    if (Array.isArray(child)) {
      for (const c of child) visit(c, ui, depth + 1, source)
      return
    }
    if (!isNode(child)) {
      report(`${sourcePrefix(source)}界面树里的文字要放在 <text> 里`)
      return
    }
    const node = child
    const type = node.type
    if (type === Fragment) return visit(node.props.children, ui, depth + 1, node.source ?? source)
    if (typeof type === 'function' && !isPrefab(type)) {
      let out: PotChild
      try {
        out = (type as any)(node.props)
      } catch (error: any) {
        report(`${sourcePrefix(node.source)}界面组件 ${nodeName(node)} 出错：${error?.message ?? error}`)
        return
      }
      return visit(out, ui, depth + 1, node.source ?? source)
    }
    if (type === 'text') {
      try {
        text(node, ui)
      } catch (error: any) {
        report(`${sourcePrefix(node.source)}${error?.message ?? error}`)
      }
      return
    }
    report(`${sourcePrefix(node.source)}界面树里不认识 <${nodeName(node)}>，只能用 <text>、片段和函数组件`)
  }

  return (tree, ui) => visit(tree, ui, 0)
}
