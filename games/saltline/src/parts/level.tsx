/**
 * saltline 的关卡（004 第 19.2 节末的名词表）：关卡 = 地图 + 时段 + 天气 + 布置。
 * 这一关是港口地图上的黄昏暴雨：地图来自 harbor 的 <Harbor>，时段与天气是 realistic 的 atmosphere、weather，
 * 数值都在 data/level.json（atmosphere、weather 两节；画质档与贴图档在 tuning.json，跟着玩家的画质设置走）。
 * 布置是这一关在地图上的点位（中继、出生点、敌人出生点、撤离点、标题镜头路线），也在 level.json，
 * 由导演、玩家、HUD 经 levelPoints 读。换一个时段、天气或布置就是另一关，地图不用动。
 */
import type { SceneArgs, Vec3 } from '@pot/core'
import { Harbor } from '@pot/kit/harbor'
import { P, R } from '@pot/kit/harbor/quay'
import type { AtmosphereProps, WeatherProps } from '@pot/kit/realistic'

/** level.json：时段、天气与布置（点位用原版坐标） */
export interface LevelData {
  atmosphere: Partial<AtmosphereProps>
  weather: Partial<WeatherProps>
  /** 要切断的三处中继 */
  relays: { id: string; short: string; label: string; pos: Vec3; rot: number }[]
  playerStart: { pos: Vec3; yaw: number }
  extraction: { pos: Vec3; radius: number }
  /** 敌人出生点：地面（猎犬）或空中（飞鸥） */
  spawns: ['ground' | 'air', number, number, number][]
  /** 标题画面的巡游镜头路线 */
  cinematic: { pos: Vec3; look: Vec3 }[]
}

/** 布置的点位换算到 Unity 坐标 */
export function levelPoints(level: LevelData) {
  return {
    relays: level.relays.map((r) => ({ ...r, pos: P(r.pos[0], r.pos[1], r.pos[2]), yaw: R(r.rot) })),
    start: { pos: P(...level.playerStart.pos), yaw: R(level.playerStart.yaw) },
    extraction: { pos: P(...level.extraction.pos), radius: level.extraction.radius },
    spawns: level.spawns.map(([type, x, y, z]) => ({ type, pos: P(x, y, z) })),
    cinematic: level.cinematic.map((c) => ({ pos: P(...c.pos), look: P(...c.look) })),
  }
}

/**
 * 关卡的环境：港口地图、黄昏、暴雨，全部标 keep（切流程状态时不重建）。
 * 地图放最前：用到港口碰撞的角色（玩家、猎犬）要在它后面（见 harbor 的 map.tsx）
 */
export function Level({ data }: { data: SceneArgs['data'] }) {
  const level = data.load<LevelData>('level.json'), tuning = data.load('tuning.json')
  return <>
    <Harbor tex={tuning.quality.tex ?? 0} />
    <entity key="atmosphere" keep atmosphere={{ ...level.atmosphere, quality: tuning.quality.levels }} />
    <entity key="weather" keep weather={level.weather} />
  </>
}
