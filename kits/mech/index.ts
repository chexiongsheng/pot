/**
 * mech 套件（004 第 19.2 节）：机甲敌人。鸥（飞行）与犬（地面）的行为积木（foe）、表现（look）、
 * 程序化模型与骨骼同步（models、gull、hound），鸥的锥形视野着色器（shaders/gullcone.frag）。
 *
 *   import mech, { mechHit, mechHear, mechClear } from '@pot/kit/mech'
 *   w.spawn('gull', { at, mechFoe: { pursuit: true }, health: { max: 45 } })
 *
 * 目标是带 mechFoe.target 标签的实体（缺省 player，眼高与身高读 fps 的 moveFps）；
 * w.vars.mechFrozen 冻结（如标题画面）、mechHostile 敌对开关由游戏每步写；flow 叠加状态（暂停）时模拟本就不走，表现也随之冻结；
 * 转入交战时发 World 事件 mechAlert { entity, pos }。
 * 与 fps 的枪靠事件对接：gunHit 打中机甲时扣血并发 mechHurt { entity, kind, weak, killed, pos, damage, by }；gunFired 惊动听觉范围内的机甲。
 */
import { defineKit } from '@pot/core'
import type { Over, Vec3 } from '@pot/core'
import fps from '@pot/kit/fps'
import realistic from '@pot/kit/realistic'
import { BOLT_PROPS, FOE_PROPS, GULL_PROPS, HOUND_PROPS, mechBlocks, mechPrefabs, onGunFired, onGunHit } from './foe'

export { mechFoe, mechGull, mechHound, mechBolt, mechBoom, mechHit, mechHear, mechClear, type MechHit } from './foe'
export { findTarget, eyeOf, chestOf, hpOf } from './target'
export type { EnemyType } from './models'

declare module '@pot/core' {
  interface GameBlockProps {
    mechFoe?: Over<typeof FOE_PROPS>
    mechGull?: Over<typeof GULL_PROPS>
    mechHound?: Over<typeof HOUND_PROPS>
    mechBolt?: Over<typeof BOLT_PROPS & { vel: Vec3 }>
    mechBoom?: boolean
  }
}

export default defineKit({
  name: 'mech',
  about: '机甲敌人（接 fps 的 gunHit、gunFired，受伤发 mechHurt）：mechFoe（感知、警戒、令牌、开火）、mechGull（飞行）、mechHound（地面）、mechBolt（弹道）、mechBoom（爆炸）；预制件 gull、hound、bolt、boom',
  blocks: mechBlocks,
  prefabs: mechPrefabs,
  vars: { mechFrozen: false, mechHostile: true, mechTokenGap: 0 },
  requires: [fps, realistic],
  on: { gunHit: onGunHit, gunFired: onGunFired },
})
