/**
 * TSX 节点：jsx 运行时只构造这种普通对象，不做别的。场景树与界面树的求值见 tree.ts、ui-eval.ts。
 */

export const Fragment: unique symbol = Symbol.for('pot.fragment') as any

/** 源位置（开发期由 jsxDEV 带上） */
export interface SourcePos {
  file: string
  line: number
  col: number
}

/** definePrefab 的返回值上的标记 */
export const PREFAB = Symbol.for('pot.prefab')

/** 预制件句柄：可直接当大写标签用，也可传给 w.spawn。本身是个函数，只为让 TSX 的类型检查接受它 */
export interface Prefab<P = any> {
  (props: P): PotNode
  readonly [PREFAB]: true
  readonly prefab: string
  readonly def: Record<string, any>
}

export type Component<P = any> = (props: P) => PotChild

export interface PotNode {
  type: string | typeof Fragment | Prefab | Component
  /** 统一转成字符串 */
  key: string | null
  /** 子节点在 props.children，不另存 */
  props: Record<string, any>
  source?: SourcePos
}

export type PotChild = PotNode | string | number | boolean | null | undefined | PotChild[]

class Node implements PotNode {
  declare source?: SourcePos
  constructor(public type: PotNode['type'], public key: string | null, public props: Record<string, any>) {}
}

export function makeNode(type: PotNode['type'], props: Record<string, any> | null | undefined, key: unknown, source?: SourcePos): PotNode {
  const node = new Node(type, key === undefined || key === null ? null : String(key), props ?? {})
  if (source) node.source = source
  return node
}

export function isNode(value: unknown): value is PotNode {
  return value instanceof Node
}

export function isPrefab(value: unknown): value is Prefab {
  return typeof value === 'function' && (value as any)[PREFAB] === true
}

/** 节点名：标签名、预制件名、函数组件的函数名 */
export function nodeName(node: PotNode): string {
  const t = node.type
  if (typeof t === 'string') return t
  if (t === Fragment) return '#fragment'
  if (isPrefab(t)) return t.prefab
  return (t as Function).name || 'anonymous'
}

/** 源位置格式化为 文件:行号，没有时为空串 */
export function formatSource(source?: SourcePos | null) {
  return source ? `${source.file}:${source.line}` : ''
}

/** 报错信息前缀：有源位置时带上 */
export function sourcePrefix(source?: SourcePos | null) {
  return source ? `${formatSource(source)} ` : ''
}
