/**
 * WorldService（ctx.world）：实体数据、挂载与对比、固定步调度、事件与规则、指令、触发检测、流程。
 * 见 004 第 15.5 至 15.9 节、16.2 节。表现（15.10）在 view.ts，由这里的 update 驱动。
 *
 * - 持久数据只放 state 的 'world' 条目，每次进入 fixed-update / update 都重新 get，不跨帧缓存引用。
 * - 内存表（规则、事件队列、上一步变换、指令）丢了可以重建。
 * - 服务方法里 this.ctx 是调用方的 ctx（cordis 4），挂载与 w.on 据此随调用单元回收；
 *   服务自己创建的东西一律用构造时的 _root，避免被单元回收。
 */
import { Context, Service } from 'cordis'
import { unitOf } from '../units'
import { makeNode } from './node'
import type { PotChild, Prefab, SourcePos } from './node'
import { Registry, clone, isPlainObject, merge } from './registry'
import type { BlockDef } from './registry'
import { evaluate } from './tree'
import type { EntitySpec, RuleSpec, StageSpec, TreeResult } from './tree'
import { applyPatches, mergePatches, treeView } from './inspect'
import type { VarsOf } from './types'
import { BodyTable, bodyCollider, bodyEntry, overlappingPairs } from './collide'
import type { BodyEntry, Collider, Mover, MoveOptions, MoveResult, OverlapShape } from './collide'
import { WorldView } from './view'
import { BUILTIN_BLOCKS } from './blocks'
import { BUILTIN_PREFABS } from './prefabs'
import { NativeBlocks } from './native'
import type { NativeMode } from './native'
import { verifyNative } from './verify'
import type { VerifyOptions, VerifyResult } from './verify'
import type { Host } from '../host'
import { initialFlow } from './flow'
import type { FlowData, FlowDef } from './flow'

declare module 'cordis' {
  interface Context {
    world: WorldService
  }
}

export interface EntityData {
  id: number
  prefab: string
  /** 所属挂载 id；w.spawn 生成的为 null */
  mount: string | null
  path: string | null
  name?: string
  tags: string[]
  pos: number[]
  rot: number[]
  scale: number[]
  /** 每个积木一个对象：属性与状态放在一起（me） */
  b: Record<string, Record<string, any>>
  /** w.spawn 的覆盖参数，用于重建 */
  spawn?: Record<string, any>
}

export interface MountRecord {
  id: number
  dead: boolean
  /** 上次应用的 EntitySpec 规范化 JSON */
  last: string
}

export interface MountData {
  keys: Record<string, MountRecord>
}

export interface WorldData {
  nextId: number
  /** 已执行的模拟步数 */
  tick: number
  /** w.rand 的 uint32 状态 */
  seed: number
  vars: Record<string, any>
  entities: Record<string, EntityData>
  mounts: Record<string, MountData>
  /** 正在重叠的实体对，键为 '小id:大id' */
  contacts: Record<string, true>
  /** 流程状态（16.2）；没有设置过 flow 时不存在 */
  flow?: FlowData
}

export type SpawnProps = Record<string, any> & { at?: number[]; rot?: number[]; scale?: number | number[]; name?: string; tags?: string[] }
export type Handler = (w: WorldService, ...args: any[]) => any

/** w.move 的选项：dt 缺省为 w.dt */
export type WorldMoveOptions = MoveOptions
/** w.raycast、w.overlap 的选项：layers 省略时为全部层；ignore 为要跳过的实体或 id；solid 为 true 时只看 solid 的碰撞体 */
export interface QueryOptions {
  layers?: string[]
  ignore?: EntityData | number | null
  solid?: boolean
}
export interface RayHit {
  point: [number, number, number]
  normal: [number, number, number]
  dist: number
  entity: EntityData
}

export interface Cmd {
  axis(name: string): { x: number; y: number }
  down(action: string): boolean
  /** 本步刚按下 */
  pressed(action: string): boolean
}

/** 一步的指令（16.10）：轴、按下的动作、界面事件。录制与 pot test 都用这个形状 */
export interface StepCommand {
  axes: Record<string, { x: number; y: number }>
  down: Record<string, boolean>
  events: { name: string; payload?: any }[]
}

/** 接管第 1 步的指令采样：每个固定步调用一次（叠加状态下也调用），tick 为当前 World 的步数；返回 null 时照常从 ctx.input 采样 */
export type CommandSource = (tick: number) => StepCommand | null

export interface Controls {
  /** 指令轴名到 ctx.input.axis 的名字 */
  axes?: Record<string, string>
  /** 动作名到键（任一按住即为按下） */
  actions?: Record<string, string | string[]>
}

export const DEFAULT_CONTROLS: Required<Controls> = {
  axes: { move: 'move', look: 'look' },
  actions: { jump: ['space'], fire: ['mouse0'] },
}

export const DEFAULT_SEED = 0x2f6b9d31
/** 增量类输入源（本帧的增量，如鼠标移动）：按帧累积，每帧只交给第一个固定步（17.5） */
export const DELTA_INPUTS = new Set(['look'])
/** 第 6、7 步（事件、延迟销毁）最多循环的轮数 */
export const MAX_EVENT_ROUNDS = 8

interface QueuedEvent {
  name: string
  args: any[]
}

interface HandlerEntry {
  event: string
  filter?: string
  fn: Handler
}

interface MountInfo {
  unit: string
  token: object
  /** 挂载时调用方的 fiber：同一 fiber 重复挂载不再注册回收 */
  fiber: unknown
}

interface FlowOwner {
  unit: string
  token: object
  def: FlowDef
}

interface GotoRequest {
  name: string
  params: Record<string, any> | undefined
  /** 不论叠加与恢复，一律按“进入”处理 */
  force?: boolean
}

function initData(): WorldData {
  return { nextId: 1, tick: 0, seed: DEFAULT_SEED, vars: {}, entities: {}, mounts: {}, contacts: {} }
}

/** EntitySpec 中参与对比的部分（规范化后 JSON 化存进 last） */
function normalize(spec: EntitySpec) {
  return { prefab: spec.prefab, at: spec.at, rot: spec.rot, scale: spec.scale, name: spec.name ?? null, tags: spec.tags, blocks: spec.blocks }
}

const same = (a: any, b: any) => JSON.stringify(a) === JSON.stringify(b)

export class WorldService extends Service {
  static inject = ['clock', 'state', 'input', 'scene', 'ui']
  readonly registry = new Registry()
  /** 表现（15.10） */
  readonly view: WorldView
  /** 构造时的 ctx：服务自己的东西挂在这里 */
  private _root: Context
  private _controls: Required<Controls> = DEFAULT_CONTROLS
  /** 挂载 id → 当前挂着它的单元（脱离后删除） */
  private _attached = new Map<string, MountInfo>()
  /** 已脱离、等待清扫的挂载 id */
  private _detached = new Set<string>()
  /** 本次运行里挂载过的 id（冷重启清扫用） */
  private _mountedThisRun = new Set<string>()
  private _coldChecked = false
  /** 挂载 id → 规则表（按挂载先后，每次挂载整体替换） */
  private _rules = new Map<string, RuleSpec[]>()
  private _handlers: HandlerEntry[] = []
  private _queue: QueuedEvent[] = []
  private _pending: number[] = []
  private _pendingSet = new Set<number>()
  /** 上一步的变换（插值用）：id → { pos, rot } */
  readonly prev = new Map<number, { pos: number[]; rot: number[] }>()
  private _axes: Record<string, { x: number; y: number }> = {}
  private _down: Record<string, boolean> = {}
  private _prevDown: Record<string, boolean> = {}
  /** 增量输入源 → 没有固定步的帧里累积的增量 */
  private _deltaAcc: Record<string, { x: number; y: number }> = {}
  /** 最近一次采样增量输入的 clock.frame */
  private _deltaFrame = -1
  private _chains = new Map<string, string[]>()
  private _chainVersion = -1
  private _reported = new Set<string>()
  private _stepping = false
  /** 当前 stage（由挂载给出，最后一个带 stage 的挂载生效） */
  private _stages = new Map<string, StageSpec>()
  /** 实体 id → 积木属性被挂载对比改过的次数（表现据此重做 enter；内存表，丢了只会多重建一次） */
  private _revs = new Map<number, number>()
  /** 当前流程定义及其所属单元 */
  private _flowOwner: FlowOwner | null = null
  /** 待应用的流程切换 */
  private _goto: GotoRequest | null = null
  /** 进入流程状态后调用的钩子（defineGame 用它重建场景） */
  private _enterHooks: (() => void)[] = []
  /** 界面事件：等下一步采样时进入指令 */
  private _uiEvents: QueuedEvent[] = []
  /** 本步指令里的事件（第 6 步分发） */
  private _cmdEvents: QueuedEvent[] = []
  /** 有焦点控件的单元：非空时不采样键盘与轴 */
  private _captures = new Set<string>()
  /** 挂载 id → 最近一次挂载的树与覆盖层（运行期补丁重新求值用） */
  private _inputs = new Map<string, { tree: PotChild; overrides?: Record<string, any> }>()
  /** 挂载 id → 最近一次求值结果（树视图用） */
  private _results = new Map<string, TreeResult>()
  /** 挂载 id → 运行期补丁（pot world set），只在内存里 */
  private _patches = new Map<string, Record<string, any>>()
  /** 指令源（pot test）；不设时从 ctx.input 采样 */
  private _source: CommandSource | null = null
  /** 录制：每一步的指令 */
  private _recording: { start: number; steps: StepCommand[] } | null = null
  /** 碰撞表（17.4）：不进 World 数据，按需刷新 */
  private _bodies = new BodyTable()
  /** 实体增删、挂载对比改动时加一，碰撞表据此在同一步内也刷新 */
  private _bodyVer = 0
  private _bodySync: { tick: number; ver: number; data: WorldData | null } = { tick: -1, ver: -1, data: null }

  /** 原生积木（18.4、18.5） */
  private _native: NativeBlocks
  /** 碰撞层名到位号（18.3 的 layers、18.6 的碰撞体缓冲区），最多 32 层 */
  private _layerBits = new Map<string, number>()

  constructor(ctx: Context, host?: Host) {
    super(ctx, 'world')
    this._root = ctx
    this._native = new NativeBlocks({
      registry: this.registry,
      warn: (m) => this._warnOnce(m),
      dt: () => this.dt,
      tick: () => this.data.tick,
      cmd: (e) => this.cmd(e),
      layerMask: (names) => this.layerMask(names),
      syncBodies: () => this._syncNativeBodies(),
    }, host)
    // 官方积木与预制件垫在栈底，游戏的同名登记覆盖它们
    for (const block of BUILTIN_BLOCKS) this.registry.addBlock(block, 'system')
    for (const prefab of BUILTIN_PREFABS) this.registry.addPrefab(prefab, 'system')
    // 构造时 define 一次占住归属（host）；冷重启的 importJSON 会整个替换，之后一律 get
    ctx.state.define<WorldData>('world', { init: initData })
    ctx.on('fixed-update', () => this._step())
    this.view = new WorldView(this, ctx, (what, fn) => this._guard(what, undefined, fn))
    ctx.on('update', () => {
      this._accumulateDeltas()
      this._sweep()
      this.view.frame()
    })
  }

  /** 当前的 World 数据（每次重新取，不缓存） */
  get data(): WorldData {
    const state = this._root.state
    let data = state.get<WorldData>('world')
    if (!data) {
      state.set('world', initData())
      data = state.get<WorldData>('world')!
    }
    return data
  }

  get dt() {
    return this._root.clock.fixedStep
  }

  get tick() {
    return this.data.tick
  }

  get time() {
    return this.data.tick * this.dt
  }

  get vars(): VarsOf {
    return this.data.vars as any
  }

  /** 挂载 id 对应的单元（展示用）；w.spawn 生成的实体没有挂载，记为 (world) */
  unitOfMount(mount: string | null): string {
    if (mount === null) return '(world)'
    return this._attached.get(mount)?.unit ?? mount
  }

  /** 当前生效的 stage 来自哪个单元（展示用） */
  get stageUnit(): string {
    let last: string | null = null
    for (const id of this._stages.keys()) last = id
    return last === null ? '(world)' : this.unitOfMount(last)
  }

  /** 当前生效的 stage（多个挂载都给了时取最后挂载的） */
  get stage(): StageSpec | null {
    let last: StageSpec | null = null
    for (const s of this._stages.values()) last = s
    return last
  }

  /** 当前的指令映射 */
  get controls(): Required<Controls> {
    return this._controls
  }

  /** 设置指令映射（defineGame 的 controls） */
  setControls(controls: Controls | undefined) {
    this._controls = {
      axes: { ...DEFAULT_CONTROLS.axes, ...controls?.axes },
      actions: { ...DEFAULT_CONTROLS.actions, ...controls?.actions },
    }
  }

  // ---------------------------------------------------------------- 流程（16.2）

  /** 当前流程状态（只读快照）；没有 flow 时为 play */
  get flow(): { state: string; params: Record<string, any>; base: string } {
    const f = this.data.flow ?? initialFlow()
    return { state: f.state, params: f.params, base: f.base }
  }

  /** scene 求值用的状态名与参数 */
  get flowScene(): { state: string; params: Record<string, any> } {
    if (!this._flowOwner) return { state: 'play', params: {} }
    const f = this.data.flow ?? initialFlow(this._flowOwner.def.start)
    return { state: f.base, params: clone(f.baseParams) }
  }

  /** flow 里定义的全部状态名（没有 flow 时为空）；pot check 用它逐个求值 */
  get flowStates(): string[] {
    return this._flowOwner ? Object.keys(this._flowOwner.def.states) : []
  }

  /** 设置流程定义（defineGame 的 flow），返回撤销函数。一个 World 同时只能有一个 flow */
  setFlow(def: FlowDef, unit: string): () => void {
    const owner = this._flowOwner
    if (owner && owner.unit !== unit) throw new Error(`world.setFlow：流程已由单元 "${owner.unit}" 定义，一个 World 只能有一个 flow`)
    const token = {}
    this._flowOwner = { unit, token, def }
    const data = this.data
    if (!data.flow) data.flow = initialFlow(def.start)
    else if (!(data.flow.state in def.states) || !(data.flow.base in def.states)) {
      this._root.logger('world').warn('流程状态 %s 已不在 flow 里，进入 %s', data.flow.state, def.start)
      data.flow = initialFlow(def.start)
      this._goto = { name: def.start, params: undefined, force: true }
    }
    return () => {
      if (this._flowOwner?.token === token) this._flowOwner = null
    }
  }

  /** 请求切换流程状态：步内调用时在本步末尾应用，否则在下一步开始时应用；一步里多次调用以最后一次为准 */
  goto(name: string, params?: Record<string, any>) {
    const owner = this._flowOwner
    if (!owner) throw new Error('w.goto：游戏没有定义 flow')
    if (!(name in owner.def.states)) throw new Error(`w.goto：没有状态 "${name}"，可用 ${Object.keys(owner.def.states).join('、')}`)
    if (params !== undefined && !isPlainObject(params)) throw new Error('w.goto 的参数必须是普通对象')
    this._goto = { name, params: params === undefined ? undefined : clone(params) }
  }

  /** 注册“进入流程状态后”的钩子（随调用单元回收） */
  onFlowEnter(fn: () => void): () => void {
    return this.ctx.effect(() => {
      this._enterHooks.push(fn)
      return () => {
        const i = this._enterHooks.indexOf(fn)
        if (i >= 0) this._enterHooks.splice(i, 1)
      }
    }, 'world.onFlowEnter')
  }

  /** 当前是否处于叠加状态（模拟暂停） */
  private _overlay() {
    const owner = this._flowOwner
    const f = this.data.flow
    return !!owner && !!f && !!owner.def.states[f.state]?.pause
  }

  /** 自定义事件触发的流程切换 */
  private _flowEvent(name: string, payload: any) {
    const owner = this._flowOwner
    if (!owner) return
    const f = this.data.flow
    const target = f && owner.def.states[f.state]?.on?.[name]
    if (target) this._goto = { name: target, params: isPlainObject(payload) ? clone(payload) : undefined }
  }

  private _applyGoto() {
    const req = this._goto
    if (!req) return
    this._goto = null
    const owner = this._flowOwner
    if (!owner) return
    const def = owner.def
    const target = def.states[req.name]
    if (!target) return
    const data = this.data
    const cur = data.flow ?? (data.flow = initialFlow(def.start))
    if (!req.force) {
      if (target.pause) {
        cur.state = req.name
        cur.params = req.params ?? {}
        return
      }
      if (def.states[cur.state]?.pause && req.name === cur.base && req.params === undefined) {
        cur.state = cur.base
        cur.params = clone(cur.baseParams)
        return
      }
    }
    const params = req.params ?? {}
    this._enterCleanup(data, owner.unit)
    data.flow = { state: req.name, params, base: req.name, baseParams: clone(params) }
    for (const hook of [...this._enterHooks]) this._guard(`进入流程状态 ${req.name} 时重建场景`, undefined, hook)
    if (target.enter) this._guard(`flow 状态 ${req.name} 的 enter`, undefined, () => target.enter!(this))
  }

  /** 进入流程状态前：销毁 w.spawn 的实体与游戏挂载的实体，清空该挂载的 key 记录和接触表 */
  private _enterCleanup(data: WorldData, mountId: string) {
    for (const key of Object.keys(data.entities)) {
      const e = data.entities[key]
      if (e && e.mount === null) this._remove(data, e, false)
    }
    const mount = data.mounts[mountId]
    if (mount) {
      for (const rec of Object.values(mount.keys)) {
        const e = !rec.dead && data.entities[rec.id]
        if (e) this._remove(data, e, false)
      }
      data.mounts[mountId] = { keys: {} }
    }
    data.contacts = {}
  }

  /** 合并 vars：没有的键补初值，已有的保留 */
  mergeVars(vars: Record<string, any> | undefined) {
    if (!vars) return
    const target = this.data.vars
    for (const key of Object.keys(vars)) {
      if (!(key in target)) target[key] = clone(vars[key])
    }
  }

  // ---------------------------------------------------------------- 挂载与对比（15.6）

  /** overrides：覆盖层（按 key 路径的属性补丁，16.7），叠在求值结果上再对比 */
  mount(tree: PotChild, options: { id?: string; overrides?: Record<string, any> } = {}) {
    const unit = unitOf(this.ctx) ?? '(host)'
    const id = options.id ?? unit
    const current = this._attached.get(id)
    if (current && current.unit !== unit) {
      throw new Error(`world.mount：挂载 id "${id}" 已被单元 "${current.unit}" 使用，请换一个 id`)
    }
    const result = evaluate(tree, this.registry)
    for (const prefab of result.prefabs) {
      if (this.registry.prefab(prefab.prefab) !== prefab) this.ctx.effect(() => this.registry.addPrefab(prefab), `world.prefab(${prefab.prefab})`)
    }
    this._inputs.set(id, { tree, overrides: options.overrides })
    this._applyMount(id, result)
    this._detached.delete(id)
    this._mountedThisRun.add(id)
    const fiber = (this.ctx as any).fiber
    // 同一单元实例重复挂载（流程切换）：沿用已注册的回收
    if (current && current.fiber === fiber) return
    const token = {}
    this._attached.set(id, { unit, token, fiber })
    this.ctx.effect(() => () => {
      if (this._attached.get(id)?.token !== token) return
      this._attached.delete(id)
      this._detached.add(id)
    }, `world.mount(${id})`)
  }

  private _applyMount(id: string, result: TreeResult) {
    const input = this._inputs.get(id)
    const patches = mergePatches(input?.overrides, this._patches.get(id))
    const entities = patches ? applyPatches(result.entities, patches, this.registry, (m) => this._warnOnce(`挂载 ${id}：${m}`)) : result.entities
    for (const warning of result.warnings) this._warnOnce(warning)
    this._results.set(id, result)
    this._diff(this.data, id, entities)
    this._rules.set(id, result.rules)
    if (result.stage) this._stages.set(id, result.stage)
    else this._stages.delete(id)
  }

  private _remount(id: string) {
    const input = this._inputs.get(id)
    if (!input) return
    this._applyMount(id, evaluate(input.tree, this.registry))
  }

  private _warnOnce(message: string) {
    if (this._reported.has(message)) return
    if (this._reported.size > 1000) this._reported.clear()
    this._reported.add(message)
    this._root.logger('world').warn(message)
  }

  // ---------------------------------------------------------------- 开发工具（16.6、16.7）

  /** 树视图：给了挂载 id 只返回它的，否则按挂载 id 返回全部 */
  treeView(id?: string) {
    if (id !== undefined) {
      const result = this._results.get(id)
      if (!result) throw new Error(`没有挂载 "${id}"，现有 ${[...this._results.keys()].join('、') || '（无）'}`)
      return treeView(result)
    }
    const out: Record<string, ReturnType<typeof treeView>> = {}
    for (const [key, result] of this._results) out[key] = treeView(result)
    return out
  }

  /** World 数据的检视：tick、流程、vars、使用原生实现的积木、（筛选后的）实体 */
  inspect(filter?: string) {
    const data = this.data
    return { tick: data.tick, flow: this.flow, vars: clone(data.vars), native: this._native.activeNames(), entities: this.query(filter).map((e) => clone(e)) }
  }

  /** 原生积木的开关（18.4）：auto 有就用，off 一律用 TS */
  get native(): NativeMode {
    return this._native.mode
  }

  set native(mode: NativeMode) {
    if (mode !== 'auto' && mode !== 'off') throw new Error(`w.native 只能是 auto 或 off，收到 ${JSON.stringify(mode)}`)
    this._native.mode = mode
  }

  /** 原生积木调度器（verify 与工具用） */
  get nativeBlocks(): NativeBlocks {
    return this._native
  }

  /** 层名数组换成位掩码；null 为全部层。新层名按出现顺序分配位号，超过 32 层的告警并忽略 */
  layerMask(names: string[] | null): number {
    if (!names) return 0xffffffff
    let mask = 0
    for (const name of names) {
      const bit = this.layerBit(name)
      if (bit >= 0) mask |= 1 << bit
    }
    return mask >>> 0
  }

  /** 层名的位号；超过 32 层返回 -1 */
  layerBit(name: string): number {
    let bit = this._layerBits.get(name)
    if (bit === undefined) {
      if (this._layerBits.size >= 32) {
        this._warnOnce(`碰撞层超过 32 个，${name} 在原生积木里不参与碰撞`)
        return -1
      }
      bit = this._layerBits.size
      this._layerBits.set(name, bit)
    }
    return bit
  }

  /** 立即执行一个模拟步（verify 用；平时由 fixed-update 驱动） */
  stepNow() {
    this._step()
  }

  /** 当前的指令来源（录像回放、pot test、verify 设置的）；没有时为 null */
  get commandSource(): CommandSource | null {
    return this._source
  }

  /** 是否处于叠加状态（模拟不走） */
  get overlayActive(): boolean {
    return !!this._overlay()
  }

  /** 两种实现跑同一段输入并比较（18.8）；只恢复 World 数据，别的 state 不管 */
  verifyNative(block: string, options: VerifyOptions = {}): VerifyResult {
    return verifyNative(this, this._root.state, block, options)
  }

  /** 碰撞表变了就发给原生侧（18.6，第 6 步实现） */
  private _syncNativeBodies() {}

  /** 运行期补丁：按 key 路径叠加属性，立即重新挂载；冷重启后丢失 */
  setPatch(mount: string, path: string, patch: Record<string, any>) {
    if (!this._inputs.has(mount)) throw new Error(`没有挂载 "${mount}"，现有 ${[...this._inputs.keys()].join('、') || '（无）'}`)
    if (typeof path !== 'string' || !path) throw new Error('world set 需要 key 路径')
    if (!isPlainObject(patch)) throw new Error('world set 的补丁必须是对象，写法与标签属性相同')
    const all = this._patches.get(mount) ?? {}
    all[path] = all[path] ? merge(all[path], patch) : clone(patch)
    this._patches.set(mount, all)
    this._remount(mount)
  }

  /** 清掉运行期补丁（不给挂载 id 时清全部） */
  clearPatches(mount?: string) {
    const ids = mount === undefined ? [...this._patches.keys()] : [mount]
    for (const id of ids) {
      if (!this._patches.delete(id)) continue
      this._remount(id)
    }
  }

  /** 当前的运行期补丁 */
  patches() {
    const out: Record<string, any> = {}
    for (const [id, all] of this._patches) out[id] = clone(all)
    return out
  }

  private _diff(data: WorldData, id: string, specs: EntitySpec[]) {
    const mount = (data.mounts[id] ??= { keys: {} })
    const seen = new Set<string>()
    for (const spec of specs) {
      seen.add(spec.path)
      const last = JSON.stringify(normalize(spec))
      const rec = mount.keys[spec.path]
      if (!rec) {
        const e = this._create(data, spec, id, spec.path)
        mount.keys[spec.path] = { id: e.id, dead: false, last }
        continue
      }
      if (rec.dead) continue
      const e = data.entities[rec.id]
      if (!e) {
        rec.dead = true
        continue
      }
      const old = JSON.parse(rec.last)
      if (old.prefab !== spec.prefab) {
        this._remove(data, e, false)
        const fresh = this._create(data, spec, id, spec.path)
        mount.keys[spec.path] = { id: fresh.id, dead: false, last }
        continue
      }
      if (last === rec.last) continue
      this._bodyVer++
      if (!same(old.at, spec.at)) e.pos = [...spec.at]
      if (!same(old.rot, spec.rot)) e.rot = [...spec.rot]
      if (!same(old.scale, spec.scale)) e.scale = [...spec.scale]
      if (old.name !== (spec.name ?? null)) {
        if (spec.name === undefined) delete e.name
        else e.name = spec.name
      }
      if (!same(old.tags, spec.tags)) e.tags = [...spec.tags]
      const added: string[] = []
      let changed = false
      for (const name of Object.keys(spec.blocks)) {
        const props = spec.blocks[name]
        if (!e.b[name]) {
          e.b[name] = this._blockData(name, props)
          added.push(name)
        } else if (!same(old.blocks?.[name], props)) {
          Object.assign(e.b[name], clone(props))
          changed = true
        }
      }
      if (changed) this._revs.set(e.id, (this._revs.get(e.id) ?? 0) + 1)
      for (const name of Object.keys(e.b)) {
        if (!(name in spec.blocks)) delete e.b[name]
      }
      this._init(e, added)
      rec.last = last
    }
    for (const path of Object.keys(mount.keys)) {
      if (seen.has(path)) continue
      const rec = mount.keys[path]
      const e = !rec.dead && data.entities[rec.id]
      if (e) this._remove(data, e, false)
      delete mount.keys[path]
    }
  }

  /** 清扫已脱离的挂载：销毁它们的实体、删除记录。fixed-update 与 update 先到的一处执行 */
  private _sweep() {
    if (!this._coldChecked) {
      this._coldChecked = true
      // 冷重启带回的、本次运行里还没挂载过的记录一律视为脱离
      for (const id of Object.keys(this.data.mounts)) {
        if (!this._mountedThisRun.has(id) && !this._attached.has(id)) this._detached.add(id)
      }
    }
    if (!this._detached.size) return
    const data = this.data
    for (const id of this._detached) {
      const mount = data.mounts[id]
      if (mount) {
        for (const rec of Object.values(mount.keys)) {
          const e = !rec.dead && data.entities[rec.id]
          if (e) this._remove(data, e, false)
        }
        delete data.mounts[id]
      }
      this._rules.delete(id)
      this._stages.delete(id)
      this._inputs.delete(id)
      this._results.delete(id)
    }
    this._detached.clear()
  }

  // ---------------------------------------------------------------- 实体

  private _blockData(name: string, props: Record<string, any>) {
    const block = this.registry.block(name)
    return { ...clone(block?.state ?? {}), ...clone(props) }
  }

  private _create(data: WorldData, spec: EntitySpec, mount: string | null, path: string | null): EntityData {
    const id = data.nextId++
    const e: EntityData = {
      id, prefab: spec.prefab, mount, path, tags: [...spec.tags],
      pos: [...spec.at], rot: [...spec.rot], scale: [...spec.scale], b: {},
    }
    if (spec.name !== undefined) e.name = spec.name
    for (const name of Object.keys(spec.blocks)) e.b[name] = this._blockData(name, spec.blocks[name])
    data.entities[id] = e
    this._bodyVer++
    this._init(e, Object.keys(e.b))
    return e
  }

  /** 按执行顺序对指定积木调用 init */
  private _init(e: EntityData, names: string[]) {
    if (!names.length) return
    for (const block of this.registry.ordered()) {
      if (!block.init || !names.includes(block.name) || !e.b[block.name]) continue
      this._guard(`积木 ${block.name}.init`, undefined, () => block.init!(e.b[block.name], e, this))
    }
  }

  /** 立即移除实体；gameplay 为真时把挂载记录标为 dead */
  private _remove(data: WorldData, e: EntityData, gameplay: boolean) {
    delete data.entities[e.id]
    this._bodyVer++
    this.prev.delete(e.id)
    this._revs.delete(e.id)
    if (this._pendingSet.delete(e.id)) this._pending = this._pending.filter((id) => id !== e.id)
    if (gameplay && e.mount !== null && e.path !== null) {
      const rec = data.mounts[e.mount]?.keys[e.path]
      if (rec && rec.id === e.id) rec.dead = true
    }
  }

  private _alive(e: EntityData | undefined): e is EntityData {
    return !!e && !this._pendingSet.has(e.id) && this.data.entities[e.id] === e
  }

  /** 实体的积木属性修订号：挂载对比改了已有积木的属性时加一，表现据此重做 view.enter */
  revision(id: number) {
    return this._revs.get(id) ?? 0
  }

  spawn(prefab: string | Prefab, props: SpawnProps = {}): EntityData {
    if (typeof prefab !== 'string' && this.registry.prefab(prefab.prefab) !== prefab) {
      // 句柄直接生成：补登记（不随单元撤销，重建要靠名字找到它）
      if (!this.registry.prefab(prefab.prefab)) this.registry.addPrefab(prefab)
    }
    if (!isPlainObject(props)) throw new Error('w.spawn 的属性必须是普通对象')
    const { key, children, ...rest } = props as any
    let saved: Record<string, any>
    try {
      saved = JSON.parse(JSON.stringify(rest))
    } catch {
      throw new Error('w.spawn 的属性必须可序列化（热重载与读档要靠它重建）')
    }
    const { entities } = evaluate(makeNode(prefab, rest, null), this.registry)
    const e = this._create(this.data, entities[0], null, null)
    e.spawn = saved
    return e
  }

  /** 延迟到本步末尾销毁（不在步内调用时，到下一步末尾） */
  destroy(target: EntityData | number) {
    const id = typeof target === 'number' ? target : target?.id
    const e = this.data.entities[id]
    if (!e || this._pendingSet.has(id)) return
    this._pendingSet.add(id)
    this._pending.push(id)
  }

  get(id: number): EntityData | undefined {
    const e = this.data.entities[id]
    return e && !this._pendingSet.has(id) ? e : undefined
  }

  /** 预制件链上的名字（按登记表版本缓存） */
  chain(prefab: string) {
    if (this._chainVersion !== this.registry.version) {
      this._chains.clear()
      this._chainVersion = this.registry.version
    }
    let chain = this._chains.get(prefab)
    if (!chain) this._chains.set(prefab, chain = this.registry.chain(prefab))
    return chain
  }

  /** filter 匹配实体的标签，或它预制件链上的任一名字；省略时匹配全部 */
  matches(e: EntityData, filter?: string) {
    if (filter === undefined) return true
    return e.tags.includes(filter) || this.chain(e.prefab).includes(filter)
  }

  query(filter?: string): EntityData[] {
    const out: EntityData[] = []
    const entities = this.data.entities
    for (const key in entities) {
      const e = entities[key]
      if (!this._pendingSet.has(e.id) && this.matches(e, filter)) out.push(e)
    }
    return out
  }

  count(filter?: string) {
    return this.query(filter).length
  }

  // ---------------------------------------------------------------- 事件

  // ---------------------------------------------------------------- 碰撞（17.4）

  /** 碰撞表：每个固定步第一次查询时刷新，实体增删、挂载改动后也刷新 */
  private _table() {
    const data = this.data
    const s = this._bodySync
    if (s.tick !== data.tick || s.ver !== this._bodyVer || s.data !== data) {
      s.tick = data.tick
      s.ver = this._bodyVer
      s.data = data
      this._bodies.sync(Object.values(data.entities))
    }
    return this._bodies
  }

  private _bodyFilter(layers: string[] | undefined, skip: number | null, solidOnly: boolean) {
    if (layers !== undefined && !Array.isArray(layers)) throw new Error('layers 必须是层名数组')
    return (b: BodyEntry) => (!solidOnly || b.solid) && b.id !== skip && (!layers || layers.includes(b.layer)) && !this._pendingSet.has(b.id)
  }

  /** 运动学角色移动（saltline Collision.move 的通用版）：改 e.pos、mover.vel、mover.grounded */
  move(e: EntityData, mover: Mover, options: WorldMoveOptions = {}): MoveResult {
    if (!e || !Array.isArray(e.pos)) throw new Error('w.move 的第一个参数必须是实体')
    if (!mover || !Array.isArray(mover.vel)) throw new Error('w.move 的 mover 必须是 { vel: [x, y, z], grounded }')
    const opts = { ...options, dt: options.dt ?? this.dt }
    return this._table().move(e.pos, mover, opts, this._bodyFilter(options.layers, e.id, true))
  }

  /** 射线：最近的碰撞体，或 null；起点在碰撞体内部时忽略它 */
  raycast(from: number[], dir: number[], maxDist = Infinity, options: QueryOptions = {}): RayHit | null {
    const skip = options.ignore == null ? null : typeof options.ignore === 'number' ? options.ignore : options.ignore.id
    const hit = this._table().raycast(from, dir, maxDist, this._bodyFilter(options.layers, skip, !!options.solid))
    if (!hit) return null
    return { point: hit.point, normal: hit.normal, dist: hit.dist, entity: this.data.entities[hit.id] }
  }

  /** 与给定形状重叠的实体，按 id 升序 */
  overlap(shape: OverlapShape, at: number[], options: QueryOptions = {}): EntityData[] {
    const skip = options.ignore == null ? null : typeof options.ignore === 'number' ? options.ignore : options.ignore.id
    const ids = this._table().overlap(shape, at, this._bodyFilter(options.layers, skip, !!options.solid))
    return ids.map((id) => this.data.entities[id])
  }

  on(event: string, filter: string | Handler, fn?: Handler): () => void {
    const entry: HandlerEntry = typeof filter === 'function' ? { event, fn: filter } : { event, filter, fn: fn! }
    if (typeof entry.fn !== 'function') throw new Error('w.on 需要处理函数')
    return this.ctx.effect(() => {
      this._handlers.push(entry)
      return () => {
        const i = this._handlers.indexOf(entry)
        if (i >= 0) this._handlers.splice(i, 1)
      }
    }, `world.on(${event})`)
  }

  emit(name: string, payload?: any) {
    this._queue.push({ name, args: [payload] })
  }

  /** 界面事件（ui.emit）：进入下一步的指令，在那一步的第 6 步按自定义事件分发 */
  emitUI(name: string, payload?: any) {
    if (typeof name !== 'string' || !/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name)) throw new Error(`ui.emit：事件名必须是标识符，收到 ${JSON.stringify(name)}`)
    let value: any
    try {
      value = payload === undefined ? undefined : JSON.parse(JSON.stringify(payload))
    } catch {
      throw new Error('ui.emit 的 payload 必须可序列化（要进指令和录像）')
    }
    this._uiEvents.push({ name, args: [value] })
  }

  /** 接管指令采样（pot test），返回撤销函数 */
  setCommandSource(source: CommandSource | null) {
    this._source = source
    return () => {
      if (this._source === source) this._source = null
    }
  }

  /** 开始录制：从下一个固定步起记下每一步的指令（叠加状态下的步也记） */
  startRecording() {
    this._recording = { start: this.data.tick, steps: [] }
  }

  /** 停止录制，返回起始步号与每一步的指令；没有在录时返回 null */
  stopRecording() {
    const rec = this._recording
    this._recording = null
    return rec
  }

  get recording() {
    return !!this._recording
  }

  /** 界面有焦点控件时屏蔽指令里的键盘与轴（按单元记） */
  setUICapture(unit: string, captured: boolean) {
    if (captured) this._captures.add(unit)
    else this._captures.delete(unit)
  }

  cmd(_e?: EntityData): Cmd {
    return {
      axis: (name) => this._axes[name] ?? (this._source ? { x: 0, y: 0 } : this._root.input.axis(this._controls.axes[name] ?? name)),
      down: (action) => !!this._down[action],
      pressed: (action) => !!this._down[action] && !this._prevDown[action],
    }
  }

  rand(): number
  rand(min: number, max: number): number
  rand(min?: number, max?: number) {
    const data = this.data
    // mulberry32
    let t = (data.seed = (data.seed + 0x6d2b79f5) >>> 0)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    const r = ((t ^ (t >>> 14)) >>> 0) / 4294967296
    return min === undefined ? r : min + r * ((max ?? 1) - min)
  }

  /** 打印一次（同一来源同一信息只打印一次），不中断其余部分 */
  private _guard(what: string, source: SourcePos | undefined, fn: () => void) {
    try {
      fn()
    } catch (error: any) {
      const where = source ? `${source.file}:${source.line} ` : ''
      const message = `${where}${what} 出错：${error?.stack ?? error?.message ?? error}`
      const key = `${where}${what}:${error?.message ?? error}`
      if (this._reported.has(key)) return
      if (this._reported.size > 1000) this._reported.clear()
      this._reported.add(key)
      this._root.logger('world').error(message)
    }
  }

  private *_allRules(on: string) {
    for (const rules of this._rules.values()) {
      for (const rule of rules) if (rule.on === on) yield rule
    }
  }

  private _dispatch(event: QueuedEvent) {
    if (event.name === 'touch') {
      const [x, y] = event.args as [EntityData, EntityData]
      if (!this._alive(x) || !this._alive(y)) return
      for (const rule of this._allRules('touch')) {
        if (this.matches(x, rule.a) && this.matches(y, rule.b)) this._guard(`<rule on="touch">`, rule.source, () => rule.do(this, x, y))
        else if (this.matches(y, rule.a) && this.matches(x, rule.b)) this._guard(`<rule on="touch">`, rule.source, () => rule.do(this, y, x))
      }
      for (const h of [...this._handlers]) {
        if (h.event !== 'touch') continue
        if (this.matches(x, h.filter)) this._guard('w.on("touch")', undefined, () => h.fn(this, x, y))
        else if (this.matches(y, h.filter)) this._guard('w.on("touch")', undefined, () => h.fn(this, y, x))
      }
      return
    }
    if (event.name === 'death') {
      const [e] = event.args as [EntityData]
      for (const rule of this._allRules('death')) {
        if (this.matches(e, rule.a)) this._guard(`<rule on="death">`, rule.source, () => rule.do(this, e))
      }
      for (const h of [...this._handlers]) {
        if (h.event === 'death' && this.matches(e, h.filter)) this._guard('w.on("death")', undefined, () => h.fn(this, e))
      }
      return
    }
    for (const rule of this._allRules(event.name)) {
      this._guard(`<rule on="${event.name}">`, rule.source, () => rule.do(this, ...event.args))
    }
    for (const h of [...this._handlers]) {
      if (h.event === event.name) this._guard(`w.on("${event.name}")`, undefined, () => h.fn(this, ...event.args))
    }
    this._flowEvent(event.name, event.args[0])
  }

  // ---------------------------------------------------------------- 每一步（15.8）

  /** 本帧没有跑固定步时，把增量输入累积到下一个固定步（17.5） */
  private _accumulateDeltas() {
    if (this._deltaFrame === this._root.clock.frame || this._source || this._captures.size > 0) return
    const input = this._root.input
    const seen = new Set<string>()
    for (const src of Object.values(this._controls.axes)) {
      if (!DELTA_INPUTS.has(src) || seen.has(src)) continue
      seen.add(src)
      const v = input.axis(src)
      if (!v.x && !v.y) continue
      const a = this._deltaAcc[src] ?? (this._deltaAcc[src] = { x: 0, y: 0 })
      a.x += v.x
      a.y += v.y
    }
  }

  private _step() {
    if (this._stepping) return
    this._stepping = true
    try {
      this._sweep()
      // 步外请求的流程切换在步开始时应用
      this._applyGoto()
      const data = this.data
      // 1. 采样指令
      this._prevDown = this._down
      this._down = {}
      this._axes = {}
      const injected = this._source?.(data.tick) ?? null
      if (injected) {
        for (const name of Object.keys(this._controls.axes)) this._axes[name] = { x: 0, y: 0 }
        for (const [name, v] of Object.entries(injected.axes ?? {})) this._axes[name] = { x: Number(v?.x) || 0, y: Number(v?.y) || 0 }
        for (const [action, on] of Object.entries(injected.down ?? {})) this._down[action] = !!on
        this._uiEvents = []
        this._cmdEvents = (injected.events ?? []).map((e) => ({ name: e.name, args: [e.payload] }))
      } else {
        const input = this._root.input
        const captured = this._captures.size > 0
        const frame = this._root.clock.frame
        const first = this._deltaFrame !== frame
        this._deltaFrame = frame
        const acc = this._deltaAcc
        if (first) this._deltaAcc = {}
        const deltas: Record<string, { x: number; y: number }> = {}
        for (const name of Object.keys(this._controls.axes)) {
          const src = this._controls.axes[name]
          if (captured) this._axes[name] = { x: 0, y: 0 }
          else if (!DELTA_INPUTS.has(src)) this._axes[name] = input.axis(src)
          else if (!first) this._axes[name] = { x: 0, y: 0 }
          else {
            // 同一输入源只读一次，多个指令名映射到它时取同一个值
            if (!deltas[src]) {
              const v = input.axis(src)
              const a = acc[src]
              deltas[src] = a ? { x: v.x + a.x, y: v.y + a.y } : v
            }
            this._axes[name] = { ...deltas[src] }
          }
        }
        for (const action of Object.keys(this._controls.actions)) {
          const keys = this._controls.actions[action]
          this._down[action] = !captured && (Array.isArray(keys) ? keys : [keys]).some((k) => input.key(k))
        }
        this._cmdEvents = this._uiEvents.splice(0)
      }
      if (this._recording) {
        this._recording.steps.push({
          axes: clone(this._axes),
          down: Object.fromEntries(Object.entries(this._down).filter(([, on]) => on)),
          events: this._cmdEvents.map((e) => (e.args[0] === undefined ? { name: e.name } : { name: e.name, payload: clone(e.args[0]) })),
        })
      }
      // 叠加状态：只处理事件与延迟销毁，tick 不走；插值的上一步等于当前
      if (this._overlay()) {
        this.prev.clear()
        this._queue.unshift(...this._cmdEvents)
        this._cmdEvents = []
        this._drain(data)
        this._applyGoto()
        return
      }
      // 2. 上一步变换
      this.prev.clear()
      for (const key in data.entities) {
        const e = data.entities[key]
        this.prev.set(e.id, { pos: [...e.pos], rot: [...e.rot] })
      }
      // 3. 积木 step（本步开始时存活的实体；本步生成的下一步起参加）
      const alive = Object.values(data.entities)
      const isAlive = (e: EntityData) => this._alive(e)
      for (const block of this.registry.ordered()) {
        if (!block.step) continue
        if (this._native.run(block, alive, isAlive)) continue
        const timing = this._native.timing
        const t0 = timing ? this._native.now() : 0
        for (const e of alive) {
          const me = e.b[block.name]
          if (!me || !this._alive(e)) continue
          this._guard(`积木 ${block.name}.step`, undefined, () => block.step!(me, e, this))
        }
        if (timing) timing.set(block.name, (timing.get(block.name) ?? 0) + this._native.now() - t0)
      }
      // 4. 触发检测
      const touches = this._detect(data)
      // 5. every
      for (const rule of this._allRules('every')) {
        const n = Math.max(1, Math.round(rule.seconds! / this.dt))
        if ((data.tick + 1) % n === 0) this._guard('<rule on="every">', rule.source, () => rule.do(this))
      }
      // 6、7. 事件队列与延迟销毁
      this._queue.unshift(...this._cmdEvents, ...touches)
      this._cmdEvents = []
      this._drain(data)
      // 8.
      data.tick++
      this._applyGoto()
    } finally {
      this._stepping = false
    }
  }

  private _drain(data: WorldData) {
    let rounds = 0
    while (this._queue.length || this._pending.length) {
      if (++rounds > MAX_EVENT_ROUNDS) {
        const dropped = this._queue.map((e) => e.name)
        this._queue = []
        this._root.logger('world').error('事件与销毁连锁超过 %d 轮，本步剩余的事件已丢弃：%s', MAX_EVENT_ROUNDS, dropped.join('、') || '（death）')
        for (const id of this._pending.splice(0)) {
          const e = data.entities[id]
          this._pendingSet.delete(id)
          if (e) this._remove(data, e, true)
        }
        return
      }
      const batch = this._queue.splice(0)
      for (const event of batch) this._dispatch(event)
      const pending = this._pending.splice(0)
      for (const id of pending) {
        this._pendingSet.delete(id)
        const e = data.entities[id]
        if (!e) continue
        this._remove(data, e, true)
        this._queue.push({ name: 'death', args: [e] })
      }
    }
  }

  private _detect(data: WorldData): QueuedEvent[] {
    const colliders: Collider[] = []
    for (const key in data.entities) {
      const e = data.entities[key]
      const t = e.b.trigger
      if (!t || this._pendingSet.has(e.id)) continue
      const body = e.b.body ? bodyEntry(e) : null
      if (body) {
        colliders.push(bodyCollider(body))
        continue
      }
      const [sx, sy, sz] = e.scale.map(Math.abs)
      const box = Array.isArray(t.box) ? [t.box[0] * sx, t.box[1] * sy, t.box[2] * sz] as [number, number, number] : null
      colliders.push({ id: e.id, x: e.pos[0], y: e.pos[1], z: e.pos[2], r: (Number(t.radius) || 0) * Math.max(sx, sy, sz), box })
    }
    const now = new Set<string>()
    const events: QueuedEvent[] = []
    for (const [a, b] of overlappingPairs(colliders)) {
      const key = `${a.id}:${b.id}`
      now.add(key)
      if (!data.contacts[key]) {
        data.contacts[key] = true
        events.push({ name: 'touch', args: [data.entities[a.id], data.entities[b.id]] })
      }
    }
    for (const key of Object.keys(data.contacts)) {
      if (!now.has(key)) delete data.contacts[key]
    }
    return events
  }

  /** 测试与开发工具用：当前规则表 */
  rules(): RuleSpec[] {
    return [...this._rules.values()].flat()
  }

  /** 测试与开发工具用：挂载状态 */
  mounts() {
    return { attached: [...this._attached.keys()], detached: [...this._detached] }
  }
}

export type World = WorldService
export type { BlockDef }
