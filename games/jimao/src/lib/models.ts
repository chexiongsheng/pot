/** 敌人模型：机械飞鸥与机械猎犬。只负责生成与动画，AI 在 enemies 单元 */
import type { Context, Entity } from '@pot/core'
import { buildHound, type HoundModel } from './hound'
import { ENEMY_LAYER } from './level'
import type { Mats } from './mats'
import type { EnemyType } from './types'

export interface EnemyModel {
  root: Entity
  /** 部件 id → 是否弱点 */
  parts: Map<number, boolean>
  glow?: Entity
  light: Entity
  wings: Entity[]
  /** 开火口（局部坐标） */
  muzzle: [number, number, number]
  /** 猎犬：原版模型的骨骼实体与动画器 */
  hound?: HoundModel
}

const metal = { metallic: 0.65, smoothness: 0.55 }

export function buildEnemy(ctx: Context, type: EnemyType, name: string, mats?: Mats): EnemyModel {
  const { scene } = ctx
  if (type === 'hound') {
    const h = buildHound(ctx, name, mats)
    return { root: h.root, parts: h.parts, light: h.light, wings: [], muzzle: [0, 0.97, 0.45], hound: h.hound }
  }
  const root = scene.spawn({ shape: 'empty', name })
  const parts = new Map<number, boolean>()
  const add = (opts: Parameters<typeof scene.spawn>[0], weak = false, hit = true) => {
    const e = scene.spawn({ parent: root, collider: hit, layer: hit ? ENEMY_LAYER : undefined, ...opts })
    if (hit) parts.set(e.id, weak)
    return e
  }
  const wings: Entity[] = []
  add({ shape: 'sphere', name: 'gull-body', position: [0, 0, 0], scale: [0.55, 0.36, 0.95], color: '#d6d8d2', material: metal })
  add({ shape: 'sphere', name: 'gull-head', position: [0, 0.08, 0.48], scale: [0.32, 0.28, 0.34], color: '#c4c7c2', material: metal })
  add({ name: 'gull-beak', position: [0, 0.04, 0.7], scale: [0.08, 0.06, 0.2], color: '#d39a2a' }, false, false)
  const glow = add({ shape: 'sphere', name: 'gull-eye', position: [0, 0.12, 0.62], scale: 0.17, color: '#ff5a40', material: { mode: 'unlit' } }, true)
  add({ name: 'gull-pod', position: [0, -0.2, 0.1], scale: [0.16, 0.12, 0.4], color: '#2a2e31', material: metal })
  add({ name: 'gull-tail', position: [0, 0.02, -0.58], scale: [0.36, 0.03, 0.3], color: '#3a3f43' }, false, false)
  for (const side of [-1, 1]) {
    const pivot = scene.spawn({ shape: 'empty', name: 'wing-pivot', parent: root, position: [side * 0.22, 0.06, 0] })
    const wing = scene.spawn({ parent: pivot, name: 'gull-wing', position: [side * 0.55, 0, -0.05], scale: [1.1, 0.04, 0.42], color: '#b8bcb6', material: metal, collider: true, layer: ENEMY_LAYER })
    parts.set(wing.id, false)
    scene.spawn({ parent: pivot, name: 'gull-wingtip', position: [side * 1.05, 0, -0.12], scale: [0.25, 0.045, 0.3], color: '#2a2e31', collider: false })
    wings.push(pivot)
  }
  const light = scene.light({ type: 'point', name: 'gull-light', parent: root, position: [0, 0, 0.9], intensity: 0.6, range: 4, color: '#ff5a40' })
  return { root, parts, glow, light, wings, muzzle: [0, -0.22, 0.35] }
}
