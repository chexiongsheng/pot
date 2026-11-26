/**
 * 敌人：机甲的行为与表现都在 mech 套件（@pot/kit/mech），这里只是 saltline 的接线（第 6 步改为 rules 后删除）：
 * 按 tuning.json 生成鸥与犬，清场，枪声惊动，子弹命中换算成战绩。
 */
import type { Context } from '@pot/core'
import { mechClear, mechHear, mechHit } from '@pot/kit/mech'
import type { LevelData } from '@pot/kit/harbor/level'
import { norm, sub } from '@pot/kit/realistic/math'
import { emit, on } from '../lib/bus'
import { eyeOf, player } from '../lib/types'

/** 过渡期接线：spawn、clear-enemies、shot、bullet 事件转给 mech */
export function wireEnemies(ctx: Context) {
  const TU = ctx.data.load('tuning.json')
  const level = ctx.data.load<LevelData>('level.json')
  const w: any = ctx.world
  const E = TU.enemy
  const sense = { range: E.sightRange, cone: E.sightCone, lose: E.loseSight, search: E.searchTime, hear: E.hearRadius, tokens: E.maxTokens, crowd: E.maxTokensCrowd, gap: E.tokenGap }
  const ground = { y: 0, maxX: level.quay.X, sea: TU.player.seaY }

  on(ctx, 'saltline/spawn', (type, pos, pursuit) => {
    const { hp, ...tuning } = TU[type]
    w.spawn(type, { at: [...pos], mechFoe: { pursuit, sense, ground }, [type === 'gull' ? 'mechGull' : 'mechHound']: tuning, health: { max: hp } })
  })

  on(ctx, 'saltline/clear-enemies', () => mechClear(w))

  on(ctx, 'saltline/shot', (pos) => mechHear(w, pos))

  on(ctx, 'saltline/bullet', (hit) => {
    const p = player(ctx)
    const dir = p ? norm(sub(hit.point, eyeOf(p))) : undefined
    const r = mechHit(w, hit.id, hit.damage, dir, TU.weapon.weakMultiplier)
    if (!r) return
    hit.enemy = true
    hit.weak = r.weak
    hit.killed = r.killed
    if (r.killed) emit(ctx, 'saltline/kill', r.kind, r.weak, r.pos)
  })
}
