/**
 * JSX 自动运行时（jsxImportSource: '@pot/core'）：tsc、sucrase、esbuild 生成的代码引用 @pot/core/jsx-runtime。
 * 函数只构造 PotNode，不做别的；求值见 world/tree.ts、world/ui-eval.ts。不依赖 React。
 */
import { Fragment, makeNode } from './world/node'
import type { Component, PotChild, PotNode, Prefab } from './world/node'
import type { PotIntrinsicElements } from './world/types'

export { Fragment }

export function jsx(type: PotNode['type'], props: Record<string, any> | null, key?: unknown): PotNode {
  return makeNode(type, props, key)
}

/** 子节点是静态写出的多个（编译器保证），与 map 生成的列表区分（列表要写 key） */
export function jsxs(type: PotNode['type'], props: Record<string, any> | null, key?: unknown): PotNode {
  return makeNode(type, props, key, undefined, true)
}

/** key 写在展开属性之后时，编译器退回经典写法 createElement(type, config, ...children) */
export function createElement(type: PotNode['type'], config: Record<string, any> | null, ...children: PotChild[]): PotNode {
  const props: Record<string, any> = {}
  let key: unknown
  for (const name in config ?? {}) {
    if (name === 'key') key = config![name]
    else if (name !== '__self' && name !== '__source') props[name] = config![name]
  }
  if (children.length === 1) props.children = children[0]
  else if (children.length > 1) props.children = children
  return makeNode(type, props, key, undefined, children.length > 1)
}

export namespace JSX {
  export type Element = PotNode
  /** 允许函数组件返回数组、null 等任意子节点（TS 5.1+） */
  export type ElementType = string | Prefab | Component
  export interface ElementChildrenAttribute {
    children: {}
  }
  export interface IntrinsicAttributes {
    key?: string | number | null
  }
  export interface IntrinsicElements extends PotIntrinsicElements {}
}
