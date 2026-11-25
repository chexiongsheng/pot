/**
 * pot block verify（004 第 18.8 节）：同一段输入分别用 TS 与原生实现跑，逐步比较。
 *
 * 1. 叠加状态下模拟不走，拒绝。
 * 2. 记下 World 数据、指令来源与 w.native。
 * 3. 两遍：先 off 后 auto。每遍把 World 数据换成快照的副本，设指令来源（脚本的输入，at 相对于当前步；没有脚本时零输入），
 *    连续执行 steps 步，逐步记下 World 哈希与这个积木的字段、实体变换，并累计这个积木 step 阶段的耗时。
 * 4. 恢复。只恢复 World 数据：积木或规则改了别的 state、放了音效，这些副作用会发生两次。
 */
import { worldHash } from './inspect'
import { expandScript } from './script'
import type { TestScript } from './script'
import { clone, isPlainObject } from './registry'
import type { WorldService } from './world'

export interface VerifyOptions {
  /** 步数；缺省取脚本的 steps，再没有为 600 */
  steps?: number
  script?: TestScript | null
  /** 数值偏差的容差，缺省 1e-9 */
  tolerance?: number
}

export interface VerifyDiff {
  step: number
  entity: number
  field: string
  ts: any
  native: any
}

export interface VerifyResult {
  ok: boolean
  block: string
  steps: number
  /** 带这个积木的实体数（开始时） */
  entities: number
  /** 每一步的 World 哈希都相同 */
  identical: boolean
  /** 第一个哈希不同的步（从 0 起）；全同为 null */
  firstHashDiff: number | null
  /** 第一个字段不同的地方；逐步记录超出预算时只比最后一步 */
  firstDiff: VerifyDiff | null
  /** 各字段的最大偏差（只列有偏差的；非数值的不同记为 Infinity） */
  maxDiff: Record<string, number>
  tolerance: number
  /** 逐步比较了字段；为 false 时只比了最后一步（实体多、步数多时） */
  perStep: boolean
  /** 这个积木 step 阶段的累计耗时（毫秒） */
  tsMs: number
  nativeMs: number
  /** 整个模拟步的累计耗时（毫秒） */
  tsStepMs: number
  nativeStepMs: number
}

/** 逐步记录字段的上限（数值个数），超过时只记最后一步 */
const FIELD_BUDGET = 2_000_000

type Frame = Map<number, Record<string, any>>

function flatten(prefix: string, v: any, out: Record<string, any>) {
  if (Array.isArray(v)) v.forEach((x, i) => flatten(`${prefix}.${i}`, x, out))
  else if (isPlainObject(v)) for (const k of Object.keys(v)) flatten(prefix ? `${prefix}.${k}` : k, v[k], out)
  else out[prefix] = v
}

function capture(w: WorldService, block: string): Frame {
  const frame: Frame = new Map()
  for (const e of w.query()) {
    const me = e.b[block]
    if (!me) continue
    const rec: Record<string, any> = {}
    flatten('pos', e.pos, rec)
    flatten('rot', e.rot, rec)
    flatten('', me, rec)
    frame.set(e.id, rec)
  }
  return frame
}

interface Pass {
  hashes: string[]
  frames: Frame[]
  last: Frame
  blockMs: number
  stepMs: number
}

export function verifyNative(w: WorldService, state: { set(key: string, value: any): void }, block: string, options: VerifyOptions = {}): VerifyResult {
  const reason = w.nativeBlocks.reason(block)
  if (reason) throw new Error(reason)
  if (w.overlayActive) throw new Error('当前处于叠加状态（模拟不走），先恢复再 verify')
  const steps = options.steps ?? options.script?.steps ?? 600
  if (!Number.isInteger(steps) || steps <= 0) throw new Error(`steps 必须是正整数，收到 ${JSON.stringify(steps)}`)
  const tolerance = options.tolerance ?? 1e-9
  const original = w.data
  const snapshot = clone(original)
  const prevMode = w.native
  const prevSource = w.commandSource
  const native = w.nativeBlocks
  const passes: Pass[] = []
  let perStep = true
  try {
    for (const mode of ['off', 'auto'] as const) {
      state.set('world', clone(snapshot))
      w.native = mode
      native.reset()
      const start = w.data.tick
      const cmd = options.script ? expandScript(options.script) : null
      w.setCommandSource((tick) => (cmd ? cmd(tick - start) : { axes: {}, down: {}, events: [] }))
      native.timing = new Map()
      const pass: Pass = { hashes: [], frames: [], last: new Map(), blockMs: 0, stepMs: 0 }
      for (let i = 0; i < steps; i++) {
        const t0 = native.now()
        w.stepNow()
        pass.stepMs += native.now() - t0
        pass.hashes.push(worldHash(w.data))
        if (perStep) {
          const frame = capture(w, block)
          if (i === 0) {
            let size = 0
            for (const rec of frame.values()) size += Object.keys(rec).length
            if (size * steps > FIELD_BUDGET) perStep = false
          }
          if (perStep) pass.frames.push(frame)
        }
      }
      pass.last = capture(w, block)
      pass.blockMs = native.timing.get(block) ?? 0
      passes.push(pass)
      if (mode === 'auto') {
        const after = native.reason(block)
        if (after) throw new Error(`verify 期间原生实现不可用：${after}`)
      }
    }
  } finally {
    state.set('world', original)
    w.native = prevMode
    w.setCommandSource(prevSource)
    native.timing = null
  }

  const [ts, nat] = passes
  let firstHashDiff: number | null = null
  for (let i = 0; i < steps; i++) if (ts.hashes[i] !== nat.hashes[i]) { firstHashDiff = i; break }
  const maxDiff: Record<string, number> = {}
  let firstDiff: VerifyDiff | null = null
  const compare = (step: number, a: Frame, b: Frame) => {
    for (const id of new Set([...a.keys(), ...b.keys()])) {
      const ra = a.get(id), rb = b.get(id)
      if (!ra || !rb) {
        maxDiff['(实体)'] = Infinity
        firstDiff ??= { step, entity: id, field: '(实体)', ts: !!ra, native: !!rb }
        continue
      }
      for (const field of new Set([...Object.keys(ra), ...Object.keys(rb)])) {
        const x = ra[field], y = rb[field]
        if (Object.is(x, y)) continue
        const d = typeof x === 'number' && typeof y === 'number' ? Math.abs(x - y) : Infinity
        if (!(d === 0)) {
          const v = Number.isNaN(d) ? Infinity : d
          maxDiff[field] = Math.max(maxDiff[field] ?? 0, v)
          firstDiff ??= { step, entity: id, field, ts: x, native: y }
        }
      }
    }
  }
  if (perStep) for (let i = 0; i < steps; i++) compare(i, ts.frames[i], nat.frames[i])
  else compare(steps - 1, ts.last, nat.last)
  const identical = firstHashDiff === null
  const worst = Object.values(maxDiff).reduce((m, v) => Math.max(m, v), 0)
  return {
    ok: identical || (firstDiff !== null ? worst <= tolerance : false),
    block,
    steps,
    entities: ts.last.size,
    identical,
    firstHashDiff,
    firstDiff,
    maxDiff,
    tolerance,
    perStep,
    tsMs: round(ts.blockMs),
    nativeMs: round(nat.blockMs),
    tsStepMs: round(ts.stepMs),
    nativeStepMs: round(nat.stepMs),
  }
}

const round = (v: number) => Math.round(v * 1000) / 1000
