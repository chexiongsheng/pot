/**
 * 关卡碰撞：关卡的碰撞盒挂成带 body 的静态实体（层 default、playerWall、bullet），供 w.move、w.raycast 使用。
 * 这些盒子就是港区里挡路的东西：一排排集装箱、木箱与托盘、叉车、水泥隔离墩、仓库墙、楼梯与栈桥；
 * 它们只有碰撞没有外形，看得见的模型由 harbor 套件的 harborLevel、harborStatics 画（parts/stage.tsx）。
 * 层：default 谁都挡；playerWall 是码头边、围栏外的空气墙，只挡玩家；bullet 只挡子弹（天线这类细杆，不挡走路）
 */
import type { SceneArgs } from '@pot/core'
import { levelBoxes } from '@pot/kit/harbor/physics'
import type { LevelData } from '@pot/kit/harbor/level'

export function LevelColliders({ data }: { data: SceneArgs['data'] }) {
  const { boxes } = levelBoxes(data.load<LevelData>('level.json'))
  // 几百个盒子都标 keep：开局、重试、回标题时不重建
  // 顺序与迁移前的 Collision 相同：w.move 按实体 id 升序处理候选，顺序不同结果就可能差一点；场景里要放在玩家之前
  return <>
    {boxes.map(({ box: b, layer }, i) => <entity key={i} keep tags={['level']}
      at={[(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2]}
      body={{ shape: 'box', size: [b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]], layer }} />)}
  </>
}
