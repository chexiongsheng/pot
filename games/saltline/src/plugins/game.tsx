/**
 * saltline 入口：唯一的 defineGame。敌人的积木、预制件与表现来自 mech 套件，玩家、关卡碰撞、导演的定义来自 src/parts；
 * 阶段走 flow（title、play、paused 叠加），一局的进度在 w.vars（parts/state.ts）。
 * 布景（环境、港口、撤离点、环境声）在 src/parts/stage.tsx；界面（hud、menu）暂时仍是低层单元，由 load 挂载（第 9 步再改）。
 */
import { defineGame } from '@pot/core'
import fps from '@pot/kit/fps'
import realistic, { registerSfx, setGunEnv } from '@pot/kit/realistic'
import harbor, { harborGunEnv } from '@pot/kit/harbor'
import mech from '@pot/kit/mech'
import { LevelColliders } from '../parts/level'
import { Player, playerBlocks } from '../parts/player'
import { Director, slDirector } from '../parts/director'
import { Stage } from '../parts/stage'
import { slAmbience } from '../parts/ambience'
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
  blocks: [...playerBlocks, slDirector, slAmbience],
  load: async (ctx, step) => {
    registerSfx(ctx)
    // viewGun 的表面种类与室内盒（港口）
    setGunEnv(ctx.world, harborGunEnv())
    await step('加载界面', 0, 0.5)
    await ctx.use('hud')
    await step('加载菜单', 0.5, 1)
    await ctx.use('menu')
  },
  // 关卡盒在玩家之前（实体 id 顺序影响 w.move）；关卡盒与布景标 keep，切流程状态时不重建
  scene: ({ data }) => <>
    <LevelColliders data={data} />
    <Player data={data} />
    <Director data={data} />
    <Stage data={data} />
  </>,
})
