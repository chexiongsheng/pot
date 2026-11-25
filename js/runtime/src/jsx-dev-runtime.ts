/**
 * JSX 开发期运行时：sucrase 第一遍转译（production: false）生成 jsxDEV 调用，带源文件与行列号。
 */
import { Fragment, makeNode } from './world/node'
import type { PotNode } from './world/node'

export { Fragment }
export type { JSX } from './jsx-runtime'

interface DevSource {
  fileName?: string
  lineNumber?: number
  columnNumber?: number
}

export function jsxDEV(type: PotNode['type'], props: Record<string, any> | null, key: unknown, isStatic?: boolean, source?: DevSource, _self?: unknown): PotNode {
  const pos = source && source.fileName ? { file: source.fileName, line: source.lineNumber ?? 0, col: source.columnNumber ?? 0 } : undefined
  return makeNode(type, props, key, pos, isStatic)
}
