/**
 * 布景（004 第 19.5 节第 8 步）：环境（realistic 的 atmosphere：黄昏、雨、原版后处理链、画质档位、闪电与雷声）、
 * 港口整张图（harbor 的 harborLevel、harborStatics）、撤离点信标（realistic 的 beacon，导演写 on）、声音（slAudio）。
 * 全部标 keep：开局、重试、回标题时不重建。
 *
 * 画面上看到的：黄昏的天空和夕阳，斜飘的雨与地面积水的倒影，远处不时的闪电和延迟传来的雷声；
 * 港区本身（集装箱堆场、起重机、仓库、货轮、码头和海面）；码头南端撤离点的信标；以及一直在响的环境声。
 */
import type { SceneArgs } from '@pot/core'
import { levelPoints, type LevelData } from '@pot/kit/harbor/level'

/** 原版静态网格分几份建（启动预热在份与份之间让帧） */
const STATIC_CHUNKS = 8

export function Stage({ data }: { data: SceneArgs['data'] }) {
  const tuning = data.load('tuning.json')
  const look = tuning.look
  // 贴图档：0 为缺省，1024 为高清贴图
  const tex = tuning.quality.tex ?? 0
  // 撤离点：码头南端舷梯旁
  const ex = levelPoints(data.load<LevelData>('level.json')).extraction
  return <>
    {/* 天气与画面：黄昏预设，雨和积水按 look.weather，原版后处理链（曝光、调色、泛光、暗角、颗粒），四档画质，闪电带雷声；
        雨滴由港区的雨幕着色器画，所以关掉内置雨 */}
    <entity key="atmosphere" keep atmosphere={{
      preset: 'dusk', weather: look.weather, chain: { exposure: look.postExposure ?? 1 },
      lightning: { sound: true }, quality: tuning.quality.levels, shaderRain: true,
    }} />
    {/* 港区主体：积水地坪、海面、雨幕、集装箱与起重机等关卡几何、原版动画与灯光、远处闪灯与海鸥、中继设备的灯 */}
    <entity key="harbor" keep harborLevel={{ tex }} />
    {/* 原版的静态网格（杂物与建筑细节）分 8 份，启动时分批建好 */}
    {Array.from({ length: STATIC_CHUNKS }, (_, i) => <entity key={`statics${i}`} keep harborStatics={{ chunk: i, of: STATIC_CHUNKS, tex }} />)}
    {/* 撤离点信标：地面光圈、光柱和点光，三处中继都断开后导演把它点亮 */}
    <entity key="extraction" keep tags={['extraction']} at={ex.pos} beacon={{ radius: ex.radius }} />
    {/* 环境声（parts/audio.ts） */}
    <entity key="audio" keep slAudio />
  </>
}
