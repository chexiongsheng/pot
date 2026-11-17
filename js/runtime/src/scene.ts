/**
 * scene：场景对象。游戏代码只拿 Entity 句柄（内部是数字 id），不直接接触引擎对象。
 * spawn 出来的对象挂在调用方 fiber 的 effect 上：插件卸载/热重载时自动销毁。
 * 需要跨重载保留的东西请存进 state（位置、血量……），重建时据此恢复。
 */
import { Context, Service } from 'cordis'
import type { Host, Vec3 } from './host'
import { unitOf } from './units'

declare module 'cordis' {
  interface Context {
    scene: SceneService
  }
}

export type Shape = 'cube' | 'sphere' | 'capsule' | 'cylinder' | 'plane' | 'quad' | 'empty'
export type Color = [number, number, number] | [number, number, number, number] | string

export interface SpawnOptions {
  shape?: Shape
  name?: string
  parent?: Entity
  position?: Vec3
  rotation?: Vec3
  scale?: Vec3 | number
  color?: Color
  active?: boolean
}

export interface LightOptions {
  type?: 'directional' | 'point' | 'spot'
  name?: string
  intensity?: number
  color?: Color
  range?: number
  position?: Vec3
  rotation?: Vec3
}

export interface ObjectInfo {
  id: number
  name: string
  shape: string
  unit: string
}

export function parseColor(color: Color): [number, number, number, number] {
  if (typeof color === 'string') {
    const hex = color.replace('#', '')
    const full = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex
    const n = parseInt(full.slice(0, 6), 16)
    const a = full.length >= 8 ? parseInt(full.slice(6, 8), 16) / 255 : 1
    return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255, a]
  }
  return [color[0], color[1], color[2], color[3] ?? 1]
}

export class Entity {
  constructor(private _scene: SceneService, readonly id: number, private _dispose?: () => any) {}

  private get _engine() {
    return this._scene.host.engine
  }

  get alive() {
    return this._engine.exists(this.id)
  }

  get position(): Vec3 {
    return this._engine.getVec(this.id, 'position')
  }

  set position(v: Vec3) {
    this._engine.setVec(this.id, 'position', v[0], v[1], v[2])
  }

  get rotation(): Vec3 {
    return this._engine.getVec(this.id, 'rotation')
  }

  set rotation(v: Vec3) {
    this._engine.setVec(this.id, 'rotation', v[0], v[1], v[2])
  }

  get scale(): Vec3 {
    return this._engine.getVec(this.id, 'scale')
  }

  set scale(v: Vec3) {
    this._engine.setVec(this.id, 'scale', v[0], v[1], v[2])
  }

  move(dx: number, dy: number, dz: number) {
    const [x, y, z] = this.position
    this.position = [x + dx, y + dy, z + dz]
    return this
  }

  lookAt(target: Vec3 | Entity) {
    const [x, y, z] = target instanceof Entity ? target.position : target
    this._engine.lookAt(this.id, x, y, z)
    return this
  }

  color(color: Color) {
    const [r, g, b, a] = parseColor(color)
    this._engine.setColor(this.id, r, g, b, a)
    return this
  }

  active(value: boolean) {
    this._engine.setActive(this.id, value)
    return this
  }

  destroy() {
    if (this._dispose) return this._dispose()
    throw new Error('该对象不能销毁（例如主相机）')
  }
}

export class SceneService extends Service {
  /** id → 对象登记信息（只登记 pot 创建的对象） */
  readonly objects = new Map<number, ObjectInfo>()

  constructor(ctx: Context, readonly host: Host) {
    super(ctx, 'scene')
  }

  /** 主相机（不归任何插件所有，不能销毁） */
  get camera() {
    return new Entity(this, this.host.engine.cameraId())
  }

  background(color: Color) {
    const [r, g, b] = parseColor(color)
    this.host.engine.setBackground(r, g, b)
  }

  spawn(options: SpawnOptions = {}): Entity {
    const engine = this.host.engine
    const shape = options.shape ?? 'cube'
    const name = options.name ?? shape
    const unit = unitOf(this.ctx) ?? '(host)'
    let id = 0
    const dispose = this.ctx.effect(() => {
      id = engine.spawn(shape, name, options.parent?.id ?? 0)
      this.objects.set(id, { id, name, shape, unit })
      return () => {
        this.objects.delete(id)
        engine.destroy(id)
      }
    }, `scene.spawn(${name})`)
    const entity = new Entity(this, id, dispose)
    if (options.position) entity.position = options.position
    if (options.rotation) entity.rotation = options.rotation
    if (options.scale !== undefined) {
      const s = options.scale
      entity.scale = typeof s === 'number' ? [s, s, s] : s
    }
    if (options.color) entity.color(options.color)
    if (options.active === false) entity.active(false)
    return entity
  }

  light(options: LightOptions = {}): Entity {
    const entity = this.spawn({ shape: 'empty', name: options.name ?? `${options.type ?? 'directional'} light`, position: options.position, rotation: options.rotation })
    const [r, g, b] = parseColor(options.color ?? [1, 1, 1])
    this.host.engine.light(entity.id, options.type ?? 'directional', options.intensity ?? 1, r, g, b, options.range ?? 10)
    return entity
  }

  find(name: string): Entity | undefined {
    for (const info of this.objects.values()) {
      if (info.name === name) return new Entity(this, info.id)
    }
  }

  list(unit?: string): ObjectInfo[] {
    const result = [...this.objects.values()]
    return unit ? result.filter((o) => o.unit === unit) : result
  }
}
