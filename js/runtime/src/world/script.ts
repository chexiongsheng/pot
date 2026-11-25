/**
 * 测试脚本（004 第 16.10 节）：pot test 的输入格式，与录制结果之间的转换。纯函数。
 *
 * input 里每项在步号 at 生效：axis 设置并保持轴的值，down / up 设置动作，emit 发界面事件（只在那一步）。
 */
import type { StepCommand } from './world'

export interface ScriptInput {
  at: number
  axis?: Record<string, [number, number]>
  down?: string[]
  up?: string[]
  emit?: string | { name: string; payload?: any }
}

export interface TestScript {
  name?: string
  steps: number
  input?: ScriptInput[]
  expect?: {
    vars?: Record<string, any>
    count?: Record<string, number>
    flow?: string
    hash?: string
  }
}

/** 把脚本展开成“步号 → 指令”的函数；步号相对脚本开始 */
export function expandScript(script: TestScript): (step: number) => StepCommand {
  const input = [...(script.input ?? [])].sort((a, b) => a.at - b.at)
  for (const item of input) {
    if (!Number.isInteger(item.at) || item.at < 0) throw new Error(`测试脚本的 input.at 必须是非负整数，收到 ${JSON.stringify(item.at)}`)
  }
  const axes: Record<string, { x: number; y: number }> = {}
  const down = new Set<string>()
  let next = 0
  let last = -1
  return (step) => {
    if (step < last) throw new Error('测试脚本只能按步号递增推进')
    last = step
    const events: StepCommand['events'] = []
    while (next < input.length && input[next].at <= step) {
      const item = input[next++]
      for (const [name, v] of Object.entries(item.axis ?? {})) axes[name] = { x: Number(v?.[0]) || 0, y: Number(v?.[1]) || 0 }
      for (const a of item.down ?? []) down.add(a)
      for (const a of item.up ?? []) down.delete(a)
      if (item.emit !== undefined && item.at === step) events.push(typeof item.emit === 'string' ? { name: item.emit } : { name: item.emit.name, payload: item.emit.payload })
    }
    return { axes: { ...axes }, down: Object.fromEntries([...down].map((a) => [a, true])), events }
  }
}

const sameAxis = (a?: { x: number; y: number }, b?: { x: number; y: number }) => (a?.x ?? 0) === (b?.x ?? 0) && (a?.y ?? 0) === (b?.y ?? 0)
const round = (v: number) => Math.round(v * 1000) / 1000

/** 录制的逐步指令压成变化点（输入格式） */
export function compressRecording(steps: StepCommand[]): ScriptInput[] {
  const out: ScriptInput[] = []
  let axes: Record<string, { x: number; y: number }> = {}
  let down = new Set<string>()
  steps.forEach((cmd, at) => {
    const item: ScriptInput = { at }
    const axisChange: Record<string, [number, number]> = {}
    for (const name of new Set([...Object.keys(axes), ...Object.keys(cmd.axes)])) {
      if (!sameAxis(axes[name], cmd.axes[name])) axisChange[name] = [round(cmd.axes[name]?.x ?? 0), round(cmd.axes[name]?.y ?? 0)]
    }
    if (Object.keys(axisChange).length) item.axis = axisChange
    const now = new Set(Object.keys(cmd.down).filter((k) => cmd.down[k]))
    const pressed = [...now].filter((a) => !down.has(a))
    const released = [...down].filter((a) => !now.has(a))
    if (pressed.length) item.down = pressed
    if (released.length) item.up = released
    const changed = Object.keys(item).length > 1
    if (changed) out.push(item)
    for (const e of cmd.events) out.push({ at, emit: e.payload === undefined ? e.name : { name: e.name, payload: e.payload } })
    axes = { ...cmd.axes }
    down = now
  })
  return out
}
