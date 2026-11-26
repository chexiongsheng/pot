/**
 * saltline 入口：唯一的 defineGame。敌人的积木、预制件与表现来自 mech 套件，玩家、关卡碰撞的定义来自 src/parts；
 * 渲染（world）、武器、界面（hud、menu）暂时仍是低层单元，由 load 依次挂载，导演最后接上（004 第 19.4 节第 4 步）。
 */
import { defineGame } from '@pot/core'
import fps from '@pot/kit/fps'
import realistic from '@pot/kit/realistic'
import harbor from '@pot/kit/harbor'
import mech from '@pot/kit/mech'
import { LevelColliders } from '../parts/level'
import { Player, playerBlocks, wirePlayer } from '../parts/player'
import { wireEnemies } from '../parts/enemies'
import { defineGameState, director } from '../parts/director'

export default defineGame({
  kits: [fps, realistic, harbor, mech],
  blocks: playerBlocks,
  load: async (ctx, step) => {
    const g = defineGameState(ctx)
    // world 自己报绝对进度（到 0.73），区间要盖住它
    await step('加载场景', 0, 0.92)
    await ctx.use('world')
    await step('加载角色', 0.92)
    wirePlayer(ctx)
    await step('加载武器', 0.93, 0.96)
    await ctx.use('weapon')
    await step('加载敌人', 0.96)
    wireEnemies(ctx)
    await step('加载界面', 0.97, 0.99)
    await ctx.use('hud')
    await step('加载菜单', 0.99, 1)
    await ctx.use('menu')
    director(ctx, g)
  },
  // 关卡盒在玩家之前（实体 id 顺序影响 w.move）
  scene: ({ data }) => <>
    <LevelColliders data={data} />
    <Player data={data} />
  </>,
})
