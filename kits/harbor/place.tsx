/**
 * 港口这个地方（004 第 19.2 节末段）：一个场景组件放出整座港区，玩家能走、子弹能打、看得见也淋得着雨。
 * 港口是自带的地方，不读游戏的数据：布局全在套件里（原版港区与码头常量），游戏只管放。
 *
 *   scene: ({ data }) => <>
 *     <Harbor />                      // 港口：碰撞盒、天气、港区模型
 *     <Player data={data} />          // 玩家要放在港口后面（见下）
 *   </>
 *
 * 里面有三样东西，按这个顺序放：
 * - 碰撞（HarborColliders）：集装箱、木箱与托盘、叉车、水泥隔离墩、仓库墙、楼梯与栈桥，码头边与围栏外的空气墙，
 *   天线这类只挡子弹的细杆。几百个只有 body 的静态实体，w.move、w.raycast 查它们。
 * - 天气（realistic 的 atmosphere）：缺省是黄昏暴雨，地面湿、积水、闪电带雷声；雨滴由港区的雨幕着色器画，所以关掉内置雨。
 * - 港区模型（harborLevel、harborStatics）：积水地坪、海面、雨幕、集装箱堆场、起重机、仓库、货轮与码头，原版的动画与灯光，
 *   远处闪灯与海鸥、中继设备的灯（状态读 w.vars.harborRelays）；原版静态网格分 chunks 份，启动预热在份与份之间让帧。
 *
 * 全部标 keep：切流程状态（开局、重试、回标题）时不重建。
 * 用到港口的角色（玩家、猎犬）要放在 <Harbor> 后面：w.move 按实体 id 升序处理碰撞候选，碰撞盒先建、id 在前，
 * 结果才与迁移前一致（saltline 的玩家金标准依赖这个顺序）。天气与模型没有碰撞体，放在哪里都不影响模拟。
 */
import type { AtmosphereProps } from '@pot/kit/realistic'
import { harborBoxes } from './physics'

export interface HarborProps {
  /** 贴图档：0 为缺省，1024 为高清贴图 */
  tex?: number
  /** 天气：湿度、积水、雨量、雨色、风（realistic atmosphere 的 weather），缺省为黄昏暴雨 */
  weather?: AtmosphereProps['weather']
  /** 后处理链的曝光，缺省 1 */
  exposure?: number
  /** 画质档位（realistic atmosphere 的 quality，按 w.vars.renderQuality 选），缺省用 realistic 的 */
  quality?: AtmosphereProps['quality']
  /** 闪电与雷声，缺省开 */
  lightning?: boolean
  /** 原版静态网格分几份建，缺省 8 */
  chunks?: number
}

/** 港口的黄昏暴雨（saltline 的画面风格） */
const DUSK_STORM: AtmosphereProps['weather'] = { wetness: 0.85, puddles: 0.6, rain: 0.45, rainColor: '#c9d2dc', wind: [1.2, -0.5] }

/** 整座港口：碰撞、天气、模型。不给属性也能放出来（缺省贴图、黄昏暴雨） */
export function Harbor({ tex = 0, weather, exposure = 1, quality, lightning = true, chunks = 8 }: HarborProps = {}) {
  return <>
    <HarborColliders />
    <entity key="atmosphere" keep atmosphere={{
      preset: 'dusk', weather: weather ?? DUSK_STORM, chain: { exposure },
      lightning: lightning ? { sound: true } : null, quality: quality ?? null, shaderRain: true,
    }} />
    <entity key="harbor" keep harborLevel={{ tex }} />
    {Array.from({ length: chunks }, (_, i) => <entity key={`statics${i}`} keep harborStatics={{ chunk: i, of: chunks, tex }} />)}
  </>
}

/**
 * 只有港口的碰撞（<Harbor> 的第一部分）：不需要画面时用，例如无画面的回归测试。
 * 层：default 谁都挡；playerWall 是码头边、围栏外的空气墙，只挡玩家；bullet 只挡子弹
 */
export function HarborColliders() {
  const { boxes } = harborBoxes()
  return <>
    {boxes.map(({ box: b, layer }, i) => <entity key={i} keep tags={['level']}
      at={[(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2]}
      body={{ shape: 'box', size: [b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]], layer }} />)}
  </>
}
