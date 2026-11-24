/**
 * 官方预制件（004 第 15.11 节）。在 WorldService 构造时登记；游戏的同名预制件覆盖这里的。
 */
import { definePrefab } from './registry'

/** 不带任何积木的空实体 */
export const entity = definePrefab('entity', {})

/** 玩家：青色方块、俯视角移动、中心点触发（与 hello 的“玩家中心进入金币 0.8 米内即拾取”一致） */
export const player = definePrefab('player', {
  tags: ['player'],
  shape: { kind: 'cube', color: '#4fc3f7' },
  moveTopdown: true,
  trigger: { radius: 0 },
})

/** 金币：黄色小球、0.8 米触发、每秒转 90 度 */
export const coin = definePrefab('coin', {
  tags: ['coin'],
  shape: { kind: 'sphere', scale: 0.5, color: '#ffd54f' },
  trigger: { radius: 0.8 },
  spin: { speed: 90 },
})

/** 地面：平面（Unity 的 plane 是 10 米见方） */
export const ground = definePrefab('ground', { shape: { kind: 'plane' } })

/** 墙：方块 */
export const wall = definePrefab('wall', { shape: { kind: 'cube' } })

/** 子弹：小球、直线飞行、2 秒后销毁、小触发区 */
export const bullet = definePrefab('bullet', {
  tags: ['bullet'],
  shape: { kind: 'sphere', scale: 0.2, color: '#ffffff' },
  projectile: { speed: 20 },
  lifetime: { seconds: 2 },
  trigger: { radius: 0.1 },
})

export const BUILTIN_PREFABS = [entity, player, coin, ground, wall, bullet]
