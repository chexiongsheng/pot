/** 关卡碰撞盒：collision 单元据此生成带 body 的实体，玩家、猎犬的 w.move 与敌人的 w.raycast 都查它们 */
import { buildLevel, buildSolids, type Box, type LevelData } from './level'
import { origLevel } from './origlevel'

export type BoxLayer = 'default' | 'playerWall' | 'bullet'

/**
 * 关卡的全部碰撞盒，顺序固定并标上层（w.move 按实体 id 升序处理候选，玩家金标准依赖这个顺序）：default 挡一切；playerWall（码头/围栏外的空气墙）只挡玩家；
 * bullet 只挡子弹。bounds 为空气墙围成的 XZ 矩形，groundMaxX 为地面（y=0）存在的最大 x（码头外是海）。
 */
export function levelBoxes(level: LevelData) {
  // 堆场、仓库、道具、中继的碰撞盒来自机械移植的原版关卡（physics.addBox 收集，已转 Unity 坐标）
  const boxes: { box: Box; layer: BoxLayer }[] = buildSolids(buildLevel(level, { origStatic: true })).map((box) => ({ box, layer: 'default' }))
  const walls = { min: [Infinity, Infinity] as [number, number], max: [-Infinity, -Infinity] as [number, number] }
  for (const b of origLevel().boxes) {
    if (b.playerOnly) {
      walls.min[0] = Math.min(walls.min[0], b.min[0]); walls.min[1] = Math.min(walls.min[1], b.min[2])
      walls.max[0] = Math.max(walls.max[0], b.max[0]); walls.max[1] = Math.max(walls.max[1], b.max[2])
    }
    boxes.push({ box: b, layer: b.bulletOnly ? 'bullet' : b.playerOnly ? 'playerWall' : 'default' })
  }
  return { boxes, bounds: Number.isFinite(walls.min[0]) ? walls : undefined, groundMaxX: level.quay.X as number }
}
