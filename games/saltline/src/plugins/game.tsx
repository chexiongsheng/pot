/**
 * saltline 入口：唯一的 defineGame，也是唯一的单元。港口这个地方（碰撞、天气、模型）来自 harbor 套件的 <Harbor>，
 * 敌人的积木、预制件与表现来自 mech 套件；玩家、导演（含撤离点）、环境声、界面（HUD、菜单）的定义来自 src/parts；
 * 阶段走 flow（title、play、paused 叠加），一局的进度在 w.vars（parts/state.ts）。
 *
 * 游戏内容：黄昏暴雨中的 Saltline 港区，玩家扮演突击队员，要切断三处中继（甲号·堆场、乙号·仓库、丙号·码头），
 * 一路上有机械飞鸥（空中盘旋、打三连发光弹，被击落后坠地爆炸）和机械猎犬（地面四足的“机器狗”，打四连发，
 * 贴近了会扑咬）围攻；三处全断后，码头南端舷梯旁的撤离点亮起，走进去登艇就算通关，
 * 结算简报按用时、命中率、是否重试给评级。
 *
 * 文件分工：
 * - parts/state.ts：一局的进度（阶段、三处中继的状态、敌人出场队列、战绩）、设置、HUD 提示、事件名
 * - parts/player.tsx：突击队员（走跑蹲跳、相机、生命、KR-7 步枪）与脚步声、受伤红屏、落水救援
 * - parts/director.tsx：关卡导演，管开场、切断中继、刷巡逻队与增援、追兵、撤离（含撤离点信标）、阵亡，以及标题画面的巡游镜头
 * - parts/enemies.ts：把 tuning.json 里飞鸥、猎犬的数值换成 mech 套件的生成参数
 * - parts/audio.ts：雨声、低鸣、交战紧张感三条循环音，以及无线电、命中、击杀的提示音
 * - parts/hud.tsx：战斗界面（罗盘、任务目标、生命、弹药、准星、击杀信息、指挥中心字幕、敌情警告、切断进度环）
 * - parts/menu.tsx：标题、暂停、阵亡、结算简报四个画面，以及设置、操作说明、项目介绍面板
 * - data/flow.json：节奏与台词（开场时长、切断用时、每波敌人数量、指挥中心的每句话、评级名）
 * - data/level.json：港区布局（集装箱、杂物、中继、敌人出生点、撤离点、标题镜头路线）
 * - data/tuning.json：手感与数值（玩家移动、步枪、敌人感知与火力、画面风格、画质档位）
 */
import { defineGame } from '@pot/core'
import fps from '@pot/kit/fps'
import realistic, { registerSfx, setGunEnv } from '@pot/kit/realistic'
import harbor, { Harbor, harborGunEnv } from '@pot/kit/harbor'
import mech from '@pot/kit/mech'
import { Player, playerBlocks } from '../parts/player'
import { Director, slDirector } from '../parts/director'
import { slAudio } from '../parts/audio'
import { Hud } from '../parts/hud'
import { Menu } from '../parts/menu'
import { slVars } from '../parts/state'

export default defineGame({
  // 用到的四个套件：
  // fps：第一人称走跑蹲跳、相机、生命与回血、步枪的射击规则（弹匣、射速、散布、后坐、开镜、换弹）
  // realistic：写实画面（黄昏天空、雨、雾、闪电、原版后处理链、画质档位）、第一人称枪模与弹孔火花、合成音效库
  // harbor：港口这个地方（集装箱、起重机、货轮、仓库、海面、积水地坪，关卡碰撞盒，黄昏暴雨的天气）
  // mech：机械飞鸥与机械猎犬（感知、巡逻与交战、攻击令牌、弹道、爆炸、模型与动画）
  kits: [fps, realistic, harbor, mech],
  // 一局的进度 sl、玩家设置 slSettings、HUD 提示 slHud（见 parts/state.ts）
  vars: slVars,
  // 缺省指令（WASD 移动、鼠标视角、空格跳、左键开火）之外再加一个“交互”：按住 E 切断中继
  controls: { actions: { interact: ['e'] } },
  // 流程：
  // title：标题画面，镜头沿港区巡游；点“开始行动”发 slStart 进入 play
  // play：一局任务。开场字幕、战斗、阵亡、撤离成功是 play 里的子阶段（vars.sl.phase，导演切换）。
  //   slRetry 是阵亡后的“重试”（已切断的中继保留），slRestart 是“重新开始任务”“再次出击”（全新一局）；
  //   从 play 到 play 也算一次“进入”：场景重建，导演的 init 重新布置
  // paused：Esc 或窗口失焦时叠加在 play 上，整个世界冻结、场景不动；“继续游戏”回到原来的战斗
  flow: {
    start: 'title',
    states: {
      title: { on: { slStart: 'play' } },
      play: { on: { slPause: 'paused', slRetry: 'play', slRestart: 'play', slTitle: 'title' } },
      paused: { pause: true, on: { slResume: 'play', slRestart: 'play', slTitle: 'title' } },
    },
  },
  // 游戏自己写的积木：玩家的阶段控制与受伤反馈、关卡导演、环境声
  blocks: [...playerBlocks, slDirector, slAudio],
  // 挂载场景前的准备（启动和热重载都会执行；只做同步的小事，加载进度条留给场景预热）
  load: (ctx) => {
    // 界面的按钮音效不等港口进场：先把合成音效（枪声、脚步、雨、雷、无线电、切断滴答、按钮声）登记好
    registerSfx(ctx)
    // viewGun 的表面种类与室内盒（港口）：子弹打进海里溅水花，打在别处按表面（金属集装箱、混凝土地面等）
    // 出烟尘、火花和不同的弹孔；仓库棚下算室内，枪身不淋雨
    setGunEnv(ctx.world, harborGunEnv())
  },
  // 场景从上到下：
  // 港口：黄昏暴雨里的 Saltline 港区，几百个碰撞盒、天气、整座港区的模型（tuning.json 给天气、画质档位、贴图档）；
  //   突击队员和之后刷出来的猎犬都要在港口后面（w.move 按实体 id 升序处理碰撞候选，碰撞盒的 id 要在前）
  // 突击队员：玩家
  // 任务：关卡导演（带它的规则）与码头南端的撤离点
  // 环境声：雨声、低鸣、交战紧张感（parts/audio.ts）
  // 港口、撤离点、环境声标 keep，切流程状态时不重建；敌人不在树里，导演在运行中按波次 w.spawn 飞鸥和猎犬
  scene: ({ data }) => {
    const tuning = data.load('tuning.json')
    return <>
      <Harbor data={data} weather={tuning.look.weather} quality={tuning.quality.levels} tex={tuning.quality.tex ?? 0} />
      <Player data={data} />
      <Director data={data} />
      <entity key="audio" keep slAudio />
    </>
  },
  // 界面每帧求值：先画战斗 HUD，菜单（标题、暂停、阵亡、结算）盖在上面
  ui: (w, ui) => <>
    <Hud w={w} ui={ui} />
    <Menu w={w} ui={ui} />
  </>,
})
