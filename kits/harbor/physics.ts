/** 港口的碰撞盒：<HarborColliders>（map.tsx）据此生成带 body 的实体，玩家、猎犬的 w.move 与敌人的 w.raycast 都查它们 */
import { buildQuay, buildSolids, QUAY, type Box } from './quay'
import { origMap } from './origmap'
import { SEA_Y } from './sea'

export type BoxLayer = 'default' | 'playerWall' | 'bullet'

/**
 * 港口的全部碰撞盒，顺序固定并标上层（w.move 按实体 id 升序处理候选，saltline 的玩家金标准依赖这个顺序）：default 挡一切；
 * playerWall（码头/围栏外的空气墙）只挡玩家；bullet 只挡子弹。
 * bounds 为空气墙围成的 XZ 矩形，groundMaxX 为地面（y=0）存在的最大 x（码头外是海），给 fps 的 moveFps 判断出界与落水
 */
export function harborBoxes() {
  // 码头一带（地面、码头墙、码头边空气墙）来自 buildQuay；堆场、仓库、道具、中继的碰撞盒来自机械移植的原版关卡（已转 Unity 坐标）
  const boxes: { box: Box; layer: BoxLayer }[] = buildSolids(buildQuay()).map((box) => ({ box, layer: 'default' }))
  const walls = { min: [Infinity, Infinity] as [number, number], max: [-Infinity, -Infinity] as [number, number] }
  for (const b of origMap().boxes) {
    if (b.playerOnly) {
      walls.min[0] = Math.min(walls.min[0], b.min[0]); walls.min[1] = Math.min(walls.min[1], b.min[2])
      walls.max[0] = Math.max(walls.max[0], b.max[0]); walls.max[1] = Math.max(walls.max[1], b.max[2])
    }
    boxes.push({ box: b, layer: b.bulletOnly ? 'bullet' : b.playerOnly ? 'playerWall' : 'default' })
  }
  return { boxes, bounds: Number.isFinite(walls.min[0]) ? walls : undefined, groundMaxX: QUAY.X }
}

/**
 * 港口地图的地面信息（属于地图，不属于游戏）：码头地面 y=0 只到 x=groundMaxX，再往外是海面 y=seaY；
 * bounds 为空气墙围成的范围。planes 是给 fps 的 gunFps.viewPlanes 用的射线平面：
 * 打在码头地面上记为 ground（留弹孔），打进海里记为 water（溅水花），对应原版的 physics.raycast
 */
export function harborGround() {
  const { bounds, groundMaxX } = harborBoxes()
  return {
    seaY: SEA_Y,
    groundMaxX,
    bounds,
    planes: [
      { y: 0, region: { maxX: groundMaxX }, tag: 'ground' },
      { y: SEA_Y, region: { minX: groundMaxX }, tag: 'water' },
    ],
  }
}
