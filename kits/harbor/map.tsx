/**
 * 港口这张地图（004 第 19.2 节末的名词表）：一个地图组件放出整座港区，玩家能走、子弹能打、看得见。
 * 地图只管地方本身：地形、碰撞、模型和跟时段天气无关的环境动态。黄昏还是正午、下不下雨由游戏的关卡配
 * （realistic 的 atmosphere 与 weather）；港口的雨幕与积水地坪跟着场景里的 weather 走，没有天气时是干的。
 * 布局全在套件里（原版港区与码头常量），不读游戏的数据，不给属性也能放出来。
 *
 *   // 游戏的关卡：地图 + 时段 + 天气（+ 布置的点位，由导演、玩家读）
 *   <Harbor />
 *   <entity key="atmosphere" keep atmosphere={{ preset: 'dusk' }} />
 *   <entity key="weather" keep weather={{ rain: 0.45, lightning: {} }} />
 *
 * 里面有两样东西，按这个顺序放：
 * - 碰撞（HarborColliders）：集装箱、木箱与托盘、叉车、水泥隔离墩、仓库墙、楼梯与栈桥，码头边与围栏外的空气墙，
 *   天线这类只挡子弹的细杆。几百个只有 body 的静态实体，w.move、w.raycast 查它们。
 * - 港区模型（harborLevel、harborStatics）：积水地坪、海面、雨幕、集装箱堆场、起重机、仓库、货轮与码头，原版的动画与灯光，
 *   远处闪灯与海鸥、中继设备的灯（状态读 w.vars.harborRelays）；原版静态网格分 chunks 份，启动预热在份与份之间让帧。
 *   雨幕建出来时告诉 weather 雨由港口画（realistic 的 paintRain），weather 就不撒内置雨滴。
 *
 * 全部标 keep：切流程状态（开局、重试、回标题）时不重建。
 * 用到港口的角色（玩家、猎犬）要放在 <Harbor> 后面：w.move 按实体 id 升序处理碰撞候选，碰撞盒先建、id 在前，
 * 结果才与迁移前一致（saltline 的玩家金标准依赖这个顺序）。模型没有碰撞体，放在哪里都不影响模拟。
 */
import { harborBoxes } from './physics'

export interface HarborProps {
  /** 贴图档：0 为缺省，1024 为高清贴图 */
  tex?: number
  /** 原版静态网格分几份建，缺省 8 */
  chunks?: number
}

/** 整座港口：碰撞与模型。不给属性也能放出来（缺省贴图） */
export function Harbor({ tex = 0, chunks = 8 }: HarborProps = {}) {
  return <>
    <HarborColliders />
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
