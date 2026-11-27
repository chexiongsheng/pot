/**
 * 敌人：机甲的行为与表现都在 mech 套件（@pot/kit/mech）。这里只把 tuning.json 映射成鸥与犬的生成覆盖，
 * 导演按覆盖生成。玩家的枪声与命中由 mech 套件接 fps 的 gunFired（惊动附近的敌人）与 gunHit（扣血、打死倒下）处理。
 *
 * 两种敌人（数值以 tuning.json 为准，改数据即可调手感）：
 * - 机械飞鸥 gull：45 血，在玩家上空 4 到 8 米、12 到 25 米外盘旋，预警 0.55 秒后打三连发光弹（每发 7），
 *   被击落后坠地爆炸，3 米内的玩家也会受伤（30）
 * - 机械猎犬 hound（“机器狗”）：140 血，在地面绕行、潜行逼近，8 到 18 米外打四连发（每发 5），
 *   贴到 3 米内会扑咬（15）；被打死后滑行倒地、沉进地里回收
 */
import type { Vec3, World } from '@pot/core'
import { harborGround } from '@pot/kit/harbor/physics'
import type { EnemyType } from './state'

/** 每种敌人生成时要覆盖的积木属性（w.spawn 的第二个参数） */
export type FoeSpawns = Record<EnemyType, Record<string, any>>

/** 两种敌人的生成覆盖（mechFoe 的感知与地面、mechGull 或 mechHound 的调参、生命） */
export function foeSpawns(tuning: any): FoeSpawns {
  const E = tuning.enemy
  // 两种敌人共用的感知：视距 45 米、视野 200°、看丢 4 秒后转入搜索、搜索 8 秒，45 米内听得见枪声；
  // 攻击令牌：同时最多 2 只开火（围上来的敌人多时 3 只），发令牌至少隔 1.25 秒，玩家不会被一齐集火
  const sense = { range: E.sightRange, cone: E.sightCone, lose: E.loseSight, search: E.searchTime, hear: E.hearRadius, tokens: E.maxTokens, crowd: E.maxTokensCrowd, gap: E.tokenGap }
  // 脚下的高度（港口地图给出）：码头边缘 groundMaxX 以内是地面（高 0），以外是海面（seaY）；猎犬只在码头内走，
  // 飞鸥坠落、残骸下沉按脚下是地面还是海面算
  const map = harborGround(), ground = { y: 0, maxX: map.groundMaxX, sea: map.seaY }
  // 一种敌人：共用的 mechFoe 感知，加上 mechGull 或 mechHound 的飞行、移动与射击参数，再加血量
  const one = (type: EnemyType) => {
    const { hp, ...rest } = tuning[type]
    return { mechFoe: { sense, ground }, [type === 'gull' ? 'mechGull' : 'mechHound']: rest, health: { max: hp } }
  }
  return { gull: one('gull'), hound: one('hound') }
}

/** 在 pos 生成一只飞鸥或猎犬；pursuit 为真时一出场就去搜索玩家（切断中继后的增援、追兵），否则原地巡逻 */
export function spawnFoe(w: World, spawns: FoeSpawns, type: EnemyType, pos: Vec3, pursuit: boolean) {
  const { mechFoe, ...rest } = spawns[type]
  return w.spawn(type, { at: [...pos], mechFoe: { pursuit, ...mechFoe }, ...rest })
}
