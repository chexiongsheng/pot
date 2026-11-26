/** 关卡碰撞：关卡的碰撞盒挂成带 body 的静态实体（层 default、playerWall、bullet），供 w.move、w.raycast 使用 */
import type { SceneArgs } from '@pot/core'
import { levelBoxes } from '@pot/kit/harbor/physics'
import type { LevelData } from '@pot/kit/harbor/level'

export function LevelColliders({ data }: { data: SceneArgs['data'] }) {
  const { boxes } = levelBoxes(data.load<LevelData>('level.json'))
  // 顺序与迁移前的 Collision 相同：w.move 按实体 id 升序处理候选，顺序不同结果就可能差一点；场景里要放在玩家之前
  return <>
    {boxes.map(({ box: b, layer }, i) => <entity key={i} tags={['level']}
      at={[(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2]}
      body={{ shape: 'box', size: [b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]], layer }} />)}
  </>
}
