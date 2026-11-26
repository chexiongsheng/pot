/**
 * saltline 入口：唯一的 defineGame。敌人的积木、预制件与表现来自 mech 套件，玩家、关卡碰撞、导演的定义来自 src/parts；
 * 阶段走 flow（title、play、paused 叠加），一局的进度在 w.vars（parts/state.ts）。
 * 渲染（world）、界面（hud、menu）暂时仍是低层单元，由 load 挂载（004 第 19.4 节第 8–9 步再改）。
 */
import { defineGame } from '@pot/core'
import fps from '@pot/kit/fps'
import realistic, { setGunEnv } from '@pot/kit/realistic'
import harbor, { harborGunEnv } from '@pot/kit/harbor'
import mech from '@pot/kit/mech'
import { LevelColliders } from '../parts/level'
import { Player, playerBlocks } from '../parts/player'
import { Director, slDirector } from '../parts/director'
import { slVars } from '../parts/state'

export default defineGame({
  kits: [fps, realistic, harbor, mech],
  vars: slVars,
  controls: { actions: { interact: ['e'] } },
  flow: {
    start: 'title',
    states: {
      title: { on: { slStart: 'play' } },
      play: { on: { slPause: 'paused', slRetry: 'play', slRestart: 'play', slTitle: 'title' } },
      paused: { pause: true, on: { slResume: 'play', slRestart: 'play', slTitle: 'title' } },
    },
  },
  blocks: [...playerBlocks, slDirector],
  load: async (ctx, step) => {
    // viewGun 的表面种类与室内盒（港口）
    setGunEnv(ctx.world, harborGunEnv())
    // world 自己报绝对进度（到 0.73），区间要盖住它
    await step('加载场景', 0, 0.95)
    await ctx.use('world')
    await step('加载界面', 0.95, 0.99)
    await ctx.use('hud')
    await step('加载菜单', 0.99, 1)
    await ctx.use('menu')
  },
  // 关卡盒在玩家之前（实体 id 顺序影响 w.move）
  scene: ({ data }) => <>
    <LevelColliders data={data} />
    <Player data={data} />
    <Director data={data} />
  </>,
})
