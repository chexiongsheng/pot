/**
 * 开发通道的 JS 侧代理。
 * - changed(paths)：Runner 监听到游戏文件变化时由 C# 调用，触发热重载（不依赖 Dev Server）。
 * - handle(json)：Dev Server 转发来的、需要 JS 运行时参与的命令；
 *   C# 侧（PotDevClient / Runner 外壳）自己处理 open / cold / screenshot / input，其余转到这里。
 * 回复格式：{ type: 'result', id, ok, data | error }
 */
import type { Runtime } from '@pot/core'
import { bindEntry, currentRuntime } from '@pot/core'
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

/** pot eval：本质就是动态执行代码，只在 Runner（桌面 V8）里可用；小游戏发布包不带 devtools */
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

/** 文件变化（相对游戏目录的路径）→ 找出受影响且已加载的单元做事务式热重载 */
async function applyChanges(rt: Runtime, paths: string[], checkLeaks = true): Promise<ReloadResult> {
  const names = new Set<string>()
  const force = new Set<string>()
  for (const path of paths) {
    const p = path.replace(/\\/g, '/')
    if (p.startsWith('data/')) {
      for (const unit of rt.data.readers(p)) {
        names.add(unit)
        force.add(unit)
      }
    }
  }
  for (const unit of rt.plugins.loader?.invalidate?.(paths) ?? []) names.add(unit)
  // 只重载已加载过的单元；没加载过的下次 use 时自然拿到新代码
  const loaded = [...names].filter((n) => rt.plugins.units.has(n))
  const result = await reload(rt, loaded, { force, checkLeaks })
  const mounted = await retryFailures(rt)
  if (mounted.length) result.mounted = mounted
  return result
}

/** 启动时挂载失败的入口单元（如语法错误）：文件变化后重试挂载，修好代码即恢复，无需冷重启 */
async function retryFailures(rt: Runtime): Promise<string[]> {
  const manifest = rt.manifest
  if (!manifest || !rt.failures.length) return []
  const pending = rt.failures.splice(0)
  const mounted: string[] = []
  for (const failure of pending) {
    const item = manifest.plugins.find((i: any) => (typeof i === 'string' ? i : i.name) === failure.name)
    const entry = typeof item === 'string' ? { name: item, config: undefined } : item
    if (!entry || rt.plugins.units.has(entry.name)) continue
    try {
      await rt.root.plugins.use(entry.name, entry.config)
      mounted.push(entry.name)
    } catch (error: any) {
      rt.failures.push({ name: failure.name, error: error?.stack ?? String(error) })
    }
  }
  return mounted
}

function report(rt: Runtime, result: ReloadResult, paths: string[]) {
  const log = rt.root.logger('hmr')
  if (!result.ok) log.error('热重载失败（%s 阶段%s）：%s', result.phase, result.rolledBack ? '，已回滚' : '', result.error)
  else if (result.units.length) log.info('热重载 %s（%sms）', result.units.join(', '), result.durationMs)
  if (result.mounted?.length) log.info('已挂载之前启动失败的单元：%s', result.mounted.join(', '))
  if (rt.failures.length) log.error('仍有单元启动失败：%s', rt.failures.map((f) => `${f.name}：${f.error.split('\n')[0]}`).join('; '))
  if (result.leaks?.length) log.warn('可能的泄漏：%s', result.leaks.join('; '))
  try {
    rt.host.send?.(JSON.stringify({ type: 'event', name: 'reload', data: { ...result, paths } }))
  } catch {}
}

/**
 * Runner 监听到游戏文件变化时调用（C# 侧 PotRuntime.Call("devtools.changed", '["src/plugins/player.ts"]')）。
 * manifest.json 变化由 C# 侧直接冷重启，不走这里。
 */
export async function changed(pathsJson: string | string[]) {
  const rt = runtime()
  const paths: string[] = typeof pathsJson === 'string' ? JSON.parse(pathsJson) : pathsJson
  const result = await applyChanges(rt, paths)
  lastReload = result
  report(rt, result, paths)
  return result
}

const handlers: Record<string, Handler> = {
  /** 强制重载指定单元：{ units: ['player'] } */
  async reload(msg, rt) {
    const names: string[] = (msg.units ?? []).filter((n: string) => rt.plugins.units.has(n))
    rt.plugins.loader?.invalidate?.(names.map((n) => `src/plugins/${n}.ts`))
    lastReload = await reload(rt, names, { force: names, checkLeaks: msg.checkLeaks !== false })
    return lastReload
  },

  /** 模拟文件变化：{ paths: ['src/plugins/player.ts'] } */
  async changed(msg, rt) {
    lastReload = await applyChanges(rt, msg.paths ?? [], msg.checkLeaks !== false)
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
      case 'modules': return (rt.plugins.loader as any)?.info?.() ?? null
      case 'world': return toPlain(rt.root.world.inspect(msg.unit || undefined), 10)
      case 'tree': return rt.root.world.treeView(msg.unit || undefined)
      default: throw new Error(`未知查询：${msg.what}`)
    }
  },

  world(msg, rt) {
    const w = rt.root.world
    switch (msg.action) {
      case 'set': w.setPatch(msg.mount ?? 'game', msg.path, msg.patch); return w.patches()
      case 'clear': w.clearPatches(msg.mount); return w.patches()
      case 'list': case undefined: return w.patches()
      default: throw new Error(`未知 world 操作：${msg.action}`)
    }
  },

  async time(msg, rt) {
    const clock = rt.clock
    switch (msg.action) {
      case 'pause': clock.pause(); break
      case 'resume': clock.resume(); break
      case 'step': {
        // 等步进完成再回复，调用方随后读 state 或松开输入不会抢在中间
        const start = clock.frame
        clock.step(msg.frames ?? 1)
        for (let guard = 0; clock.pendingSteps > 0 && clock.paused && guard < 100000; guard++) await clock.waitFrames(1)
        if (clock.frame - start < (msg.frames ?? 1) && clock.pendingSteps > 0) throw new Error('time step 未完成（时钟被冻结？）')
        break
      }
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

function logError(what: string, error: any) {
  try {
    ;(attached ?? currentRuntime())?.root.logger('devtools').error('%s：%s', what, error?.stack ?? error)
  } catch {}
}

// C# 入口（PotRuntime.Call），不用 eval 拼代码
bindEntry('devtools.changed', (paths) => {
  changed(paths).catch((error) => logError('热重载出错', error))
})
bindEntry('devtools.handle', (json) => {
  handle(json).catch((error) => logError('处理开发命令出错', error))
})
