/** 低层单元（hud、menu、world）共用的读取函数。一局的进度在 w.vars.sl（parts/state.ts） */
import type { Context, Vec3 } from '@pot/core'
import type { GunFpsState } from '@pot/kit/fps'
import { phaseOf, type EnemyType, type Phase, type Settings, type Sl } from '../parts/state'

export type { EnemyType, Phase, Settings, Sl }

/**
 * 玩家状态的视图：玩家是带 moveFps、cameraFps、health 的实体（player.tsx），这里把积木状态按旧字段名映射出来，
 * 其他单元照旧读写。只有 sprinting 与 shake（爆炸震屏）可写。
 */
export interface PlayerState {
  pos: Vec3
  vel: Vec3
  yaw: number
  pitch: number
  health: number
  crouching: boolean
  /** 当前身高（蹲伏插值） */
  height: number
  eye: number
  grounded: boolean
  coyote: number
  jumpBuffer: number
  lastHurt: number
  hurt: number
  bob: number
  speed: number
  sprinting: boolean
  lastSafe: Vec3
  /** 镜头抖动 */
  shake: number
}

export const game = (ctx: Context): Sl => (ctx.world as any).vars.sl
export const settings = (ctx: Context): Settings => (ctx.world as any).vars.slSettings
export const phase = (ctx: Context): Phase => phaseOf(ctx.world)
/** 玩家的枪（fps 的 gunFps 积木状态：mag、reserve、reloading、ads、spread 等）；还没加载时为 undefined */
export const weapon = (ctx: Context): GunFpsState | undefined => playerEntity(ctx)?.b.gunFps

/** 敌人摘要（标签 enemy 的实体，mech 套件的 mechFoe）：mode 为 patrol/combat/search/dying 等 */
export function foes(ctx: Context): { mode: string; pos: Vec3; kind: EnemyType }[] {
  return (ctx.world as any).query('enemy').filter((e: any) => e.b.mechFoe).map((e: any) => ({ mode: e.b.mechFoe.mode, pos: e.pos, kind: e.b.mechFoe.kind }))
}

/** 玩家实体（标签 player）；还没加载时为 undefined */
export function playerEntity(ctx: Context): any {
  const w: any = ctx.world
  const e = cachedId < 0 ? undefined : w.get(cachedId)
  if (e?.b.moveFps && e.tags.includes('player')) return e
  const found = w.query('player')[0]
  cachedId = found ? found.id : -1
  return found
}
/** 只是查找缓存（不是状态）：关卡有几百个碰撞实体，不能每次都全表查询 */
let cachedId = -1

export function player(ctx: Context): PlayerState | undefined {
  const e = playerEntity(ctx)
  if (!e) return undefined
  const b = e.b
  return {
    get pos() { return e.pos },
    get vel() { return b.moveFps.vel },
    get yaw() { return b.moveFps.yaw },
    get pitch() { return b.moveFps.pitch },
    get health() { return b.health.hp },
    get crouching() { return b.moveFps.crouched },
    get height() { return b.moveFps.curHeight },
    get eye() { return b.moveFps.curEye },
    get grounded() { return b.moveFps.grounded },
    get coyote() { return b.moveFps.coyoteT },
    get jumpBuffer() { return b.moveFps.buffer },
    get lastHurt() { return b.health.lastHit },
    get hurt() { return b.slFeedback.hurt },
    get bob() { return b.moveFps.bob },
    get speed() { return b.moveFps.speed },
    get sprinting() { return b.moveFps.sprinting },
    set sprinting(v) { b.moveFps.sprinting = v },
    get lastSafe() { return b.moveFps.lastSafe },
    get shake() { return b.cameraFps.shake },
    set shake(v) { b.cameraFps.shake = v },
  } as PlayerState
}

/** 玩家眼睛（相机）位置 */
export function eyeOf(p: PlayerState): Vec3 {
  return [p.pos[0], p.pos[1] + p.eye, p.pos[2]]
}

/** 玩家受击判定的中心（躯干） */
export function chestOf(p: PlayerState): Vec3 {
  return [p.pos[0], p.pos[1] + p.height * 0.6, p.pos[2]]
}
