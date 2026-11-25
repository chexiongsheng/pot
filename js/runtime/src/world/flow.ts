/**
 * 流程定义（004 第 5.6、16.2 节）：校验 defineGame 的 flow。状态的应用在 WorldService 里。
 */
import type { World } from './world'

export interface FlowStateDef {
  /** 事件名 → 目标状态 */
  on?: Record<string, string>
  /** 叠加状态：进出都不重建场景，模拟暂停 */
  pause?: boolean
  /** 进入后调用（场景已重建） */
  enter?: (w: World) => void
}

export interface FlowDef {
  start: string
  states: Record<string, FlowStateDef>
}

/** 存在 World 数据里的流程状态 */
export interface FlowData {
  /** 当前状态（可能是叠加状态） */
  state: string
  /** 当前状态的参数 */
  params: Record<string, any>
  /** 最近一个非叠加状态，scene 按它求值 */
  base: string
  /** base 的参数 */
  baseParams: Record<string, any>
}

const NAME = /^[A-Za-z_$][A-Za-z0-9_$]*$/

export function checkFlow(flow: unknown): FlowDef {
  const fail = (message: string): never => {
    throw new Error(`defineGame：flow ${message}`)
  }
  if (!flow || typeof flow !== 'object') fail('必须是对象 { start, states }')
  const def = flow as FlowDef
  if (!def.states || typeof def.states !== 'object') fail('缺少 states')
  const names = Object.keys(def.states)
  if (!names.length) fail('的 states 至少要有一个状态')
  for (const name of names) {
    if (!NAME.test(name)) fail(`的状态名 ${JSON.stringify(name)} 必须是标识符`)
    const s = def.states[name]
    if (!s || typeof s !== 'object') fail(`的状态 ${name} 必须是对象`)
    if (s.enter !== undefined && typeof s.enter !== 'function') fail(`的状态 ${name} 的 enter 必须是函数`)
    for (const [event, target] of Object.entries(s.on ?? {})) {
      if (!NAME.test(event)) fail(`的状态 ${name} 的事件名 ${JSON.stringify(event)} 必须是标识符`)
      if (!(target in def.states)) fail(`的状态 ${name} 在 ${event} 时切到不存在的状态 ${JSON.stringify(target)}`)
    }
  }
  if (typeof def.start !== 'string' || !(def.start in def.states)) fail(`的 start ${JSON.stringify(def.start)} 不是已定义的状态`)
  if (def.states[def.start].pause) fail(`的 start 不能是叠加状态（pause）`)
  return def
}

export function initialFlow(state = 'play'): FlowData {
  return { state, params: {}, base: state, baseParams: {} }
}
