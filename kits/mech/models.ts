/** 敌人模型：机械飞鸥与机械猎犬（均为原版模型机械移植）。只负责生成与动画，AI 在 enemies 单元 */
import type { Context, Entity } from '@pot/core'
import { buildGull, type GullModel } from './gull'
import { buildHound, type HoundModel } from './hound'
import type { Mats } from '@pot/kit/realistic/mats'
/** 机甲种类：鸥（飞行）、犬（地面） */
export type EnemyType = 'gull' | 'hound'

export interface EnemyModel {
  root: Entity
  /** 部件 id → 是否弱点 */
  parts: Map<number, boolean>
  glow?: Entity
  light: Entity
  /** 开火口（局部坐标） */
  muzzle: [number, number, number]
  /** 猎犬：原版模型的骨骼实体与动画器 */
  hound?: HoundModel
  /** 飞鸥：原版四旋翼模型的骨骼实体与动画器 */
  gull?: GullModel
}

export function buildEnemy(ctx: Context, type: EnemyType, name: string, mats?: Mats): EnemyModel {
  if (type === 'hound') {
    const h = buildHound(ctx, name, mats)
    return { root: h.root, parts: h.parts, light: h.light, muzzle: [0, 0.97, 0.45], hound: h.hound }
  }
  const g = buildGull(ctx, name, mats)
  // 原版 d.muzzle = (0, -.12, .17) 绕 yaw 旋转
  return { root: g.root, parts: g.parts, light: g.light, muzzle: [0, -0.12, 0.17], gull: g.gull }
}
