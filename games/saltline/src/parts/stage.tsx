/**
 * 布景（004 第 19.5 节第 8 步）：环境（realistic 的 atmosphere：黄昏、雨、原版后处理链、画质档位、闪电与雷声）、
 * 港口整张图（harbor 的 harborLevel、harborStatics）、撤离点信标（realistic 的 beacon，导演写 on）、环境声（slAmbience）。
 * 全部标 keep：开局、重试、回标题时不重建。
 */
import type { SceneArgs } from '@pot/core'
import { levelPoints, type LevelData } from '@pot/kit/harbor/level'

/** 原版静态网格分几份建（启动预热在份与份之间让帧） */
const STATIC_CHUNKS = 8

export function Stage({ data }: { data: SceneArgs['data'] }) {
  const tuning = data.load('tuning.json')
  const look = tuning.look
  const tex = tuning.quality.tex ?? 0
  const ex = levelPoints(data.load<LevelData>('level.json')).extraction
  return <>
    <entity key="atmosphere" keep atmosphere={{
      preset: 'dusk', weather: look.weather, chain: { exposure: look.postExposure ?? 1 },
      lightning: { sound: true }, quality: tuning.quality.levels, shaderRain: true,
    }} />
    <entity key="harbor" keep harborLevel={{ tex }} />
    {Array.from({ length: STATIC_CHUNKS }, (_, i) => <entity key={`statics${i}`} keep harborStatics={{ chunk: i, of: STATIC_CHUNKS, tex }} />)}
    <entity key="extraction" keep tags={['extraction']} at={ex.pos} beacon={{ radius: ex.radius }} />
    <entity key="ambience" keep slAmbience />
  </>
}
