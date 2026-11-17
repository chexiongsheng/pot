/**
 * 开发通道的 JS 侧代理：处理 Dev Server 发来的、需要 JS 运行时参与的命令。
 * C# 侧（PotDevClient）自己处理 load / cold / screenshot / input，其余转发到 handle(json)。
 * 回复格式：{ type: 'result', id, ok, data | error }
 */
import type { Runtime } from '@pot/core'
import { currentRuntime } from '@pot/core'
import { reload, ReloadResult } from './hmr'

export interface Message {
  id?: number | string
  type: string
  [key: string]: any
}

let attached: Runtime | undefined
let lastReload: ReloadResult | undefined

export function attach(runtime: Runtime) {
  attached = runtime
}

function runtime(): Runtime {
  const rt = attached ?? currentRuntime()
  if (!rt) throw new Error('运行时尚未启动')
  return rt
}

/** 转成可 JSON 化的值（限深度、去函数、去循环） */
export function toPlain(value: any, depth = 4, seen = new Set<any>()): any {
  if (value === null || value === undefined) return value ?? null
  const type = typeof value
  if (type === 'number') return Number.isFinite(value) ? value : String(value)
  if (type === 'string' || type === 'boolean') return value
  if (type === 'bigint' || type === 'symbol') return String(value)
  if (type === 'function') return `[Function ${value.name || 'anonymous'}]`
  if (value instanceof Error) return { error: value.message, stack: value.stack }
  if (seen.has(value)) return '[Circular]'
  if (depth <= 0) return Array.isArray(value) ? `[Array(${value.length})]` : '[Object]'
  seen.add(value)
  try {
    if (ArrayBuffer.isView(value)) return Array.from(value as any).slice(0, 64)
    if (Array.isArray(value)) return value.slice(0, 200).map((v) => toPlain(v, depth - 1, seen))
    if (value instanceof Map) return Object.fromEntries([...value].slice(0, 200).map(([k, v]) => [String(k), toPlain(v, depth - 1, seen)]))
    if (value instanceof Set) return [...value].slice(0, 200).map((v) => toPlain(v, depth - 1, seen))
    const result: any = {}
    for (const key of Object.keys(value).slice(0, 200)) result[key] = toPlain(value[key], depth - 1, seen)
    return result
  } finally {
    seen.delete(value)
  }
}

function evaluate(code: string, rt: Runtime) {
  const args = ['runtime', 'ctx', 'pot']
  const values = [rt, rt.root, (globalThis as any).pot]
  let fn: Function
  try {
    // 优先当表达式求值
    fn = new Function(...args, `return (${code}\n)`)
  } catch {
    fn = new Function(...args, `return (async () => {\n${code}\n})()`)
  }
  return fn(...values)
}

type Handler = (msg: Message, rt: Runtime) => any

const handlers: Record<string, Handler> = {
  async reload(msg, rt) {
    const files: { path: string; content: string | null }[] = msg.files ?? []
    for (const file of files) rt.host.writeText?.(file.path, file.content)
    const names = new Set<string>(msg.units ?? [])
    const force = new Set<string>()
    for (const file of files) {
      const match = /^units\/(.+)\.cjs$/.exec(file.path)
      if (match) names.add(match[1])
      if (file.path.startsWith('data/')) {
        for (const unit of rt.data.readers(file.path)) {
          names.add(unit)
          force.add(unit)
        }
      }
    }
    // 只重载已加载过的单元；没加载过的下次 use 时自然拿到新代码
    const loaded = [...names].filter((n) => rt.plugins.units.has(n))
    lastReload = await reload(rt, loaded, { force, checkLeaks: msg.checkLeaks !== false })
    return lastReload
  },

  async eval(msg, rt) {
    const value = await evaluate(String(msg.code ?? ''), rt)
    return toPlain(value, msg.depth ?? 4)
  },

  state(msg, rt) {
    const state = rt.state
    switch (msg.action ?? 'get') {
      case 'keys': return state.info()
      case 'get': return msg.key ? toPlain(state.get(msg.key), 8) : toPlain(state.snapshot(), 8)
      case 'set': state.set(msg.key, msg.value); return true
      case 'reset': state.reset(msg.key); return true
      default: throw new Error(`未知 state 操作：${msg.action}`)
    }
  },

  leaks(_msg, rt) {
    return {
      lastReload: lastReload ? { units: lastReload.units, leaks: lastReload.leaks ?? [] } : null,
      objects: rt.scene.objects.size,
      engineObjects: rt.host.engine.count(),
      timers: rt.clock.pending,
      units: rt.plugins.list().map((u) => ({ name: u.name, mounts: u.mounts.length })),
    }
  },

  plugins(_msg, rt) {
    return toPlain(rt.plugins.list(), 5)
  },

  query(msg, rt) {
    switch (msg.what ?? 'info') {
      case 'info': return rt.info()
      case 'objects': return rt.scene.list(msg.unit)
      case 'data': return rt.data.dependencies()
      case 'cache': return rt.cache.stats()
      default: throw new Error(`未知查询：${msg.what}`)
    }
  },

  time(msg, rt) {
    const clock = rt.clock
    switch (msg.action) {
      case 'pause': clock.pause(); break
      case 'resume': clock.resume(); break
      case 'step': clock.step(msg.frames ?? 1); break
      case 'scale': clock.scale = Number(msg.value ?? 1); break
      case undefined: case 'get': break
      default: throw new Error(`未知 time 操作：${msg.action}`)
    }
    return { time: clock.time, frame: clock.frame, paused: clock.paused, scale: clock.scale, frozen: clock.frozen }
  },
}

/** 处理一条消息；回复通过 host.send 发出，同时返回 Promise 便于测试 */
export async function handle(json: string | Message) {
  let msg: Message
  try {
    msg = typeof json === 'string' ? JSON.parse(json) : json
  } catch (error: any) {
    return { type: 'result', id: null, ok: false, error: `消息不是合法 JSON：${error?.message}` }
  }
  let reply: any
  try {
    const rt = runtime()
    const handler = handlers[msg.type]
    if (!handler) throw new Error(`JS 侧不支持的命令：${msg.type}`)
    const data = await handler(msg, rt)
    reply = { type: 'result', id: msg.id ?? null, ok: true, data }
  } catch (error: any) {
    reply = { type: 'result', id: msg.id ?? null, ok: false, error: String(error?.stack ?? error) }
  }
  try {
    const rt = attached ?? currentRuntime()
    rt?.host.send?.(JSON.stringify(reply))
  } catch {}
  return reply
}
