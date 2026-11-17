/**
 * 事务式热重载（见 docs/002）：
 *   preload → snapshot → swap → dispose → apply → commit
 * 任何一步失败都回滚：卸掉新版本、名字切回旧版本、恢复 state 快照、在原父级下重新挂旧版本。
 * 替换期间冻结时钟。提交后对旧版本登记 WeakRef 哨兵，GC 后仍存活即报告泄漏。
 */
import type { Context, Fiber, Runtime, Unit } from '@pot/core'
import { ancestors } from '@pot/core'

const ACTIVE = 2

export interface ReloadOptions {
  /** 即使代码 hash 未变也重载（数据文件变化时） */
  force?: Iterable<string>
  /** 提交后是否做泄漏检查，默认 true */
  checkLeaks?: boolean
  /** 泄漏检查前等待的宿主帧数 */
  leakFrames?: number
}

export interface ReloadResult {
  ok: boolean
  mode: 'hot'
  units: string[]
  skipped: string[]
  phase: string
  rolledBack: boolean
  durationMs: number
  error?: string
  leaks?: string[]
  /** 本次重新挂载成功的、之前启动失败的入口单元 */
  mounted?: string[]
}

interface Mount {
  unit: string
  fiber: Fiber
  parent: Context
  config: any
}

interface Sentinel {
  label: string
  ref: WeakRef<object>
}

const now = () => {
  const perf = (globalThis as any).performance
  return perf ? perf.now() : Date.now()
}

function errorText(error: any) {
  return String(error?.stack ?? error)
}

function isActive(ctx: Context) {
  const fiber = ctx?.fiber
  return !!fiber && fiber.state === ACTIVE
}

/** 只保留最外层挂载：祖先也在列表中的，会随祖先一起被卸载和重建 */
function topMounts(mounts: Mount[]) {
  const set = new Set(mounts.map((m) => m.fiber))
  return mounts.filter((m) => !ancestors(m.fiber).some((f) => set.has(f)))
}

async function settle(runtime: Runtime) {
  // 让 apply 中的异步部分有机会抛错
  for (let i = 0; i < 3; i++) await Promise.resolve()
  await runtime.clock.waitFrames(1).then(() => {}, () => {})
}

async function transaction(runtime: Runtime, names: string[], options: ReloadOptions, result: ReloadResult): Promise<Sentinel[]> {
  const { plugins, state } = runtime
  const force = new Set(options.force ?? [])

  // 1. preload：编译新版本，不影响运行中的旧版本
  result.phase = 'preload'
  const fresh = new Map<string, Unit>()
  const previous = new Map<string, Unit | undefined>()
  for (const name of new Set(names)) {
    const unit = plugins.compile(name)
    const prev = plugins.units.get(name)
    if (prev && prev.hash === unit.hash && !force.has(name)) {
      result.skipped.push(name)
      continue
    }
    fresh.set(name, unit)
    previous.set(name, prev)
  }
  result.units = [...fresh.keys()]
  if (!fresh.size) return []

  // 2. snapshot：只快照本次涉及单元拥有的 key
  result.phase = 'snapshot'
  const ownedBefore = [...fresh.keys()].flatMap((n) => state.ownerKeys(n))
  const snapshot = state.snapshot(ownedBefore)

  const mounts: Mount[] = []
  for (const [name, prev] of previous) {
    for (const fiber of prev?.mounts ?? []) {
      mounts.push({ unit: name, fiber, parent: fiber.parent, config: fiber.config })
    }
  }
  const tops = topMounts(mounts)

  // 3. swap：名字指向新版本（嵌套的 ctx.use 会拿到新版本）
  result.phase = 'swap'
  for (const [name, unit] of fresh) plugins.swap(name, unit)

  const created: Fiber[] = []
  try {
    // 4. dispose：卸载旧挂载（effect 逆序清理：对象、定时器、事件……）
    result.phase = 'dispose'
    for (const mount of tops) await mount.fiber.dispose()

    // 5. apply：在原父级下用原配置挂新版本
    result.phase = 'apply'
    for (const mount of tops) {
      const unit = plugins.get(mount.unit)
      const fiber = mount.parent.plugin(unit.wrapper, mount.config)
      created.push(fiber)
      await fiber
    }
    await settle(runtime)
    for (const unit of fresh.values()) {
      if (unit.errors.length) throw unit.errors[0]
    }
  } catch (error) {
    result.error = errorText(error)
    await rollback(runtime, fresh, previous, tops, created, snapshot, ownedBefore)
    result.rolledBack = true
    return []
  }

  // 6. commit：旧版本不再被引用，登记哨兵
  result.phase = 'commit'
  const sentinels: Sentinel[] = []
  for (const [name, prev] of previous) {
    if (!prev) continue
    sentinels.push({ label: `${name}@${prev.hash} exports`, ref: new WeakRef(prev.exports) })
    sentinels.push({ label: `${name}@${prev.hash} plugin`, ref: new WeakRef(prev.wrapper) })
    runtime.root.registry.delete(prev.wrapper)
  }
  for (const mount of mounts) {
    sentinels.push({ label: `${mount.unit} fiber#${mount.fiber.uid}`, ref: new WeakRef(mount.fiber) })
  }
  return sentinels
}

async function rollback(
  runtime: Runtime,
  fresh: Map<string, Unit>,
  previous: Map<string, Unit | undefined>,
  tops: Mount[],
  created: Fiber[],
  snapshot: ReturnType<Runtime['state']['snapshot']>,
  ownedBefore: string[],
) {
  const { plugins, state } = runtime
  const log = runtime.root.logger('hmr')
  for (const fiber of created) {
    try { await fiber.dispose() } catch (e) { log.warn(e) }
  }
  for (const unit of fresh.values()) {
    for (const fiber of [...unit.mounts]) {
      try { await fiber.dispose() } catch (e) { log.warn(e) }
    }
    runtime.root.registry.delete(unit.wrapper)
  }
  for (const [name, prev] of previous) plugins.swap(name, prev)
  const ownedNow = [...fresh.keys()].flatMap((n) => state.ownerKeys(n))
  state.restore(snapshot, [...new Set([...ownedBefore, ...ownedNow])])
  for (const mount of tops) {
    if (!isActive(mount.parent)) continue
    const prev = previous.get(mount.unit)
    if (!prev) continue
    try {
      await mount.parent.plugin(prev.wrapper, mount.config)
    } catch (e) {
      log.error('回滚时重新挂载 %s 失败：%s', mount.unit, errorText(e))
    }
  }
}

function forceGC(runtime: Runtime) {
  const gc = (globalThis as any).gc
  if (typeof gc === 'function') gc()
  runtime.host.gc?.()
}

/** 热重载一组单元 */
export async function reload(runtime: Runtime, names: string[], options: ReloadOptions = {}): Promise<ReloadResult> {
  const start = now()
  const result: ReloadResult = { ok: false, mode: 'hot', units: [], skipped: [], phase: 'preload', rolledBack: false, durationMs: 0 }
  const release = runtime.clock.freeze()
  let sentinels: Sentinel[] = []
  try {
    sentinels = await transaction(runtime, names, options, result)
    result.ok = !result.error
  } catch (error) {
    // preload / snapshot 阶段失败：旧版本未受影响，无需回滚
    result.error = errorText(error)
  } finally {
    release()
  }
  result.durationMs = Math.round((now() - start) * 100) / 100
  if (result.ok && sentinels.length && options.checkLeaks !== false) {
    result.leaks = await checkLeaks(runtime, sentinels, options.leakFrames ?? 3)
  }
  return result
}

/** 等 GC 后检查哨兵；返回仍存活对象的描述 */
export async function checkLeaks(runtime: Runtime, sentinels: Sentinel[], frames = 3) {
  forceGC(runtime)
  await runtime.clock.waitFrames(frames)
  forceGC(runtime)
  await runtime.clock.waitFrames(1)
  return sentinels.filter((s) => s.ref.deref() !== undefined).map((s) => s.label)
}
