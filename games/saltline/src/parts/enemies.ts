/**
 * 敌人：机甲的行为与表现都在 mech 套件（@pot/kit/mech）。这里只把 tuning.json 映射成鸥与犬的生成覆盖，
 * 导演按覆盖生成；武器直接调 mechHear、mechHit。
 */
import type { Vec3 } from '@pot/core'
import type { LevelData } from '@pot/kit/harbor/level'
import type { EnemyType } from './state'

export type FoeSpawns = Record<EnemyType, Record<string, any>>

/** 两种敌人的生成覆盖（mechFoe 的感知与地面、mechGull 或 mechHound 的调参、生命） */
export function foeSpawns(tuning: any, level: LevelData): FoeSpawns {
  const E = tuning.enemy
  const sense = { range: E.sightRange, cone: E.sightCone, lose: E.loseSight, search: E.searchTime, hear: E.hearRadius, tokens: E.maxTokens, crowd: E.maxTokensCrowd, gap: E.tokenGap }
  const ground = { y: 0, maxX: level.quay.X, sea: tuning.player.seaY }
  const one = (type: EnemyType) => {
    const { hp, ...rest } = tuning[type]
    return { mechFoe: { sense, ground }, [type === 'gull' ? 'mechGull' : 'mechHound']: rest, health: { max: hp } }
  }
  return { gull: one('gull'), hound: one('hound') }
}

export function spawnFoe(w: any, spawns: FoeSpawns, type: EnemyType, pos: Vec3, pursuit: boolean) {
  const { mechFoe, ...rest } = spawns[type]
  return w.spawn(type, { at: [...pos], mechFoe: { pursuit, ...mechFoe }, ...rest })
}
