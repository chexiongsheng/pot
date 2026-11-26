/**
 * World 的表现（004 第 15.10 节）：在 update 里把 World 数据同步到场景。
 *
 * - stage：与上次应用的值比较，变了才调用 scene。平行光由这里持有。
 * - 积木的 view.enter / update / exit：按实体和积木记录 enter 返回的场景对象；积木定义被替换（热重载）时重做 exit 与 enter。
 * - 变换：enter 返回的对象跟随实体，位置按 clock.fixedAlpha 插值、旋转球面插值、缩放乘以对象创建时的缩放，
 *   一帧只调用一次 scene.setTransforms。
 *
 * 场景对象一律用 WorldService 构造时的 ctx 创建，不挂在调用单元上，单元重载时不会被误回收。
 * 生命周期归内核，但 scene.objects 里的 unit 改记为实体所属挂载的单元（w.spawn 的为 (world)），
 * 这样 pot query objects <单元> 能按单元查到；unit 只用于展示，不参与回收。
 */
import type { Context } from 'cordis'
import { Entity, eulerToQuaternion, slerpQuaternion } from '../scene'
import type { Quat } from '../scene'
import type { BlockDef } from './registry'
import type { StageSpec } from './tree'
import type { EntityData, WorldService } from './world'

interface BlockView {
  def: BlockDef
  /** 最近一次的 me（积木从实体上去掉后 exit 仍要用） */
  me: Record<string, any>
  objs: Entity[]
  /** 每个对象创建时的缩放 */
  scales: number[][]
  /** enter 时实体的积木属性修订号（world.revision） */
  rev: number
}

interface EntityView {
  e: EntityData
  blocks: Map<string, BlockView>
}

interface Sun {
  rot: number[]
  intensity: number
  color: any
}

type Guard = (what: string, fn: () => void) => void

const json = (v: unknown) => (v === undefined ? undefined : JSON.stringify(v))

function normalizeSun(sun: any): Sun | null {
  if (sun === undefined || sun === null || sun === false) return null
  if (Array.isArray(sun)) return { rot: sun, intensity: 1, color: '#ffffff' }
  return { rot: sun.rot ?? [50, -30, 0], intensity: sun.intensity ?? 1, color: sun.color ?? '#ffffff' }
}

export class WorldView {
  private _entities = new Map<number, EntityView>()
  private _ids = new Int32Array(64)
  private _buf = new Float32Array(640)
  private _qa: Quat = [0, 0, 0, 1]
  private _qb: Quat = [0, 0, 0, 1]
  private _q: Quat = [0, 0, 0, 1]
  private _background: string | undefined
  private _sunKey: string | undefined
  private _sun: Entity | null = null
  private _camera: string | undefined
  /** 场景对象 id 到实体（部件登记，见 bindPart） */
  private _parts = new Map<number, { entity: number; tag?: string }>()

  constructor(private _world: WorldService, private _root: Context, private _guard: Guard) {}

  /**
   * 部件登记（004 第 19.5 节第 7 步）：把积木表现建的场景对象（如命中体）记到实体上，
   * 别的积木做场景射线后用 partOf 知道打中了谁。实体的表现退出时自动注销。tag 'weak' 约定为弱点。
   */
  bindPart(objectId: number, entity: EntityData | number, tag?: string) {
    const id = typeof entity === 'number' ? entity : entity?.id
    if (typeof objectId !== 'number' || typeof id !== 'number') throw new Error('w.view.bindPart(场景对象 id, 实体或实体 id, tag?)')
    this._parts.set(objectId, tag === undefined ? { entity: id } : { entity: id, tag })
  }

  unbindPart(objectId: number) {
    this._parts.delete(objectId)
  }

  /** 场景对象属于哪个实体；没登记或实体已不在时为 null */
  partOf(objectId: number): { entity: EntityData; tag?: string } | null {
    const part = this._parts.get(objectId)
    if (!part) return null
    const e = this._world.data.entities[part.entity]
    return e ? { entity: e, tag: part.tag } : null
  }

  /** 当前登记的场景对象数（测试与开发工具用） */
  get objectCount() {
    let n = 0
    for (const v of this._entities.values()) for (const b of v.blocks.values()) n += b.objs.length
    return n
  }

  /** 每个游戏帧调用一次 */
  frame() {
    const w = this._world
    this._applyStage(w.stage)
    const data = w.data
    const registry = w.registry
    const ordered = registry.ordered()
    const ctx = this._root
    const seen = new Set<number>()
    // 1. 出现、替换、消失的积木
    for (const key in data.entities) {
      const e = data.entities[key]
      seen.add(e.id)
      let v = this._entities.get(e.id)
      if (!v) this._entities.set(e.id, (v = { e, blocks: new Map() }))
      this._enter(v, e, ordered)
    }
    for (const [id, v] of this._entities) {
      if (seen.has(id)) continue
      for (const rec of v.blocks.values()) this._exit(rec, v.e)
      this._entities.delete(id)
      this._dropParts(id)
    }
    // 2. view.update
    for (const def of ordered) {
      const update = def.view?.update
      if (!update) continue
      for (const v of this._entities.values()) {
        const rec = v.blocks.get(def.name)
        if (rec) this._guard(`积木 ${def.name}.view.update`, () => update(rec.me, v.e, rec.objs, ctx, w))
      }
    }
    // 3. 变换同步
    this._sync()
  }

  /**
   * 启动加载期的预热（004 第 17.13 节）：提前建好实体的表现，第一帧不再重复 enter。
   * 返回本次新建了表现的积木数（没有带 view 的积木时为 0）。
   */
  warm(e: EntityData): number {
    let v = this._entities.get(e.id)
    if (!v) this._entities.set(e.id, (v = { e, blocks: new Map() }))
    const before = v.blocks.size
    this._enter(v, e, this._world.registry.ordered())
    return v.blocks.size - before
  }

  /** 实体是否有要建表现的积木 */
  hasView(e: EntityData): boolean {
    for (const name in e.b) if (e.b[name] && this._world.registry.block(name)?.view) return true
    return false
  }

  /** 出现、替换、消失的积木：按积木顺序 enter，定义或属性修订号变了的先 exit */
  private _enter(v: EntityView, e: EntityData, ordered: BlockDef[]) {
    const w = this._world
    const registry = w.registry
    const ctx = this._root
    v.e = e
    const rev = w.revision(e.id)
    for (const [name, rec] of v.blocks) {
      if (e.b[name] && registry.block(name) === rec.def && rec.rev === rev) continue
      this._exit(rec, e)
      v.blocks.delete(name)
    }
    for (const def of ordered) {
      const me = e.b[def.name]
      if (!def.view || !me) continue
      const rec = v.blocks.get(def.name)
      if (rec) {
        rec.me = me
        continue
      }
      const created: BlockView = { def, me, objs: [], scales: [], rev }
      v.blocks.set(def.name, created)
      if (def.view.enter) {
        this._guard(`积木 ${def.name}.view.enter`, () => {
          const out = def.view!.enter!(me, e, ctx, w)
          const list = out === undefined || out === null ? [] : Array.isArray(out) ? out : [out]
          const unit = w.unitOfMount(e.mount)
          for (const obj of list) {
            if (!(obj instanceof Entity)) continue
            created.objs.push(obj)
            created.scales.push(obj.scale)
            this._label(obj.id, unit)
          }
        })
      }
    }
  }

  /** 注销实体的全部部件 */
  private _dropParts(entity: number) {
    if (!this._parts.size) return
    for (const [obj, part] of this._parts) if (part.entity === entity) this._parts.delete(obj)
  }

  /** 改记场景对象的展示归属 */
  private _label(id: number, unit: string) {
    const info = this._root.scene.objects.get(id)
    if (info) info.unit = unit
  }

  private _exit(rec: BlockView, e: EntityData) {
    const exit = rec.def.view?.exit
    if (exit) this._guard(`积木 ${rec.def.name}.view.exit`, () => exit(rec.me, e, rec.objs, this._root, this._world))
    for (const obj of rec.objs) {
      try {
        obj.destroy()
      } catch {
        // 已被别处销毁
      }
    }
    rec.objs = []
    rec.scales = []
  }

  private _sync() {
    let count = 0
    for (const v of this._entities.values()) for (const b of v.blocks.values()) count += b.objs.length
    if (!count) return
    if (this._ids.length < count) {
      let size = this._ids.length
      while (size < count) size *= 2
      this._ids = new Int32Array(size)
      this._buf = new Float32Array(size * 10)
    }
    const alpha = this._root.clock.fixedAlpha
    const ids = this._ids
    const buf = this._buf
    let k = 0
    for (const v of this._entities.values()) {
      const e = v.e
      const prev = this._world.prev.get(e.id)
      const p0 = prev?.pos ?? e.pos
      const x = p0[0] + (e.pos[0] - p0[0]) * alpha
      const y = p0[1] + (e.pos[1] - p0[1]) * alpha
      const z = p0[2] + (e.pos[2] - p0[2]) * alpha
      const r1 = e.rot
      const r0 = prev?.rot ?? r1
      eulerToQuaternion(r1[0], r1[1], r1[2], this._qb)
      const q = r0 === r1 || (r0[0] === r1[0] && r0[1] === r1[1] && r0[2] === r1[2])
        ? this._qb
        : slerpQuaternion(eulerToQuaternion(r0[0], r0[1], r0[2], this._qa), this._qb, alpha, this._q)
      for (const b of v.blocks.values()) {
        for (let i = 0; i < b.objs.length; i++) {
          const s = b.scales[i]
          const at = k * 10
          ids[k] = b.objs[i].id
          buf[at] = x
          buf[at + 1] = y
          buf[at + 2] = z
          buf[at + 3] = q[0]
          buf[at + 4] = q[1]
          buf[at + 5] = q[2]
          buf[at + 6] = q[3]
          buf[at + 7] = e.scale[0] * s[0]
          buf[at + 8] = e.scale[1] * s[1]
          buf[at + 9] = e.scale[2] * s[2]
          k++
        }
      }
    }
    this._root.scene.setTransforms(ids, buf, { count: k })
  }

  private _applyStage(stage: StageSpec | null) {
    const scene = this._root.scene
    const background = json(stage?.background)
    if (background !== undefined && background !== this._background) {
      this._background = background
      this._guard('<stage background>', () => scene.background(stage!.background))
    }
    const sun = normalizeSun(stage?.sun)
    const sunKey = json(sun)
    if (sunKey !== this._sunKey) {
      this._sunKey = sunKey
      if (this._sun) {
        const old = this._sun
        this._sun = null
        try {
          old.destroy()
        } catch {
          // 已销毁
        }
      }
      if (sun) {
        this._guard('<stage sun>', () => {
          this._sun = scene.light({ type: 'directional', name: 'sun', rotation: sun.rot as any, intensity: sun.intensity, color: sun.color })
          this._label(this._sun.id, this._world.stageUnit)
        })
      }
    }
    const camera = stage?.camera
    const cameraKey = json(camera ? { at: camera.at, look: camera.look } : undefined)
    if (cameraKey !== undefined && cameraKey !== this._camera) {
      this._camera = cameraKey
      this._guard('<stage camera>', () => {
        const cam = scene.camera
        if (camera!.at) cam.position = camera!.at
        if (camera!.look) cam.lookAt(camera!.look)
      })
    }
  }
}
