/**
 * 玩家：几乎全由套件积木拼成，这里只有本游戏特有的两块（slControl 阶段控制、slRescue 落水救援）。
 * - fps 套件（玩法，通用）：moveFps 移动、cameraFps 相机、health 生命、gunFps 枪、feedbackFps 迈步/落地/受伤计数与红屏、镜头震动；
 * - realistic 套件（写实样子）：viewGun 手和枪、viewFeedback 脚步/受伤声与受伤红边、低血量、开镜后处理；
 * - harbor 套件（地图）：碰撞盒、地面与海面、出界范围（harborGround）。
 * 只导出定义，由 game.tsx 组装。命中判定走表现层的场景射线（敌人命中体挂在动画骨骼上），经 emitUI 回写。
 *
 * 玩家扮演的突击队员：步行 3.8 米/秒、冲刺 6.4、蹲伏 1.9，能跳 1 米高、直接迈上 0.45 米的台阶；
 * 满血 100，受伤 4 秒后开始每秒回 25；手里是 KR-7 突击步枪，30 发弹匣、备弹 150、每分钟 720 发，右键开镜。
 * 这些数值都在 tuning.json 的 player、weapon 里。
 */
import { defineBlock, type SceneArgs } from '@pot/core'
import { damage } from '@pot/kit/fps'
import { harborGround } from '@pot/kit/harbor/physics'
import { levelPoints, type LevelData } from './level'
import { ENEMY_LAYER, MAP_LAYER } from '@pot/kit/realistic/layers'
import { phaseOf, slEmit, type Settings } from './state'

/** regen：每秒回血量；fov：设置里没给视野时的缺省视野 */
const CONTROL_PROPS = { regen: 0, fov: 74 }

/**
 * 每步最先：把阶段与设置写进套件积木与 mech 的 w.vars（暂停是 flow 叠加状态，模拟整体不走）。
 * 标题画面：背景里的敌人冻结，玩家不能动，相机交给导演的巡游镜头；
 * 开场字幕：能走动、转视角，但不能开枪，敌人还不敌对；战斗中：全部放开；
 * 阵亡：不能动、不能开枪，不再回血；撤离成功：相机停住，交给结算画面
 */
const slControl = defineBlock<typeof CONTROL_PROPS>({
  name: 'slControl',
  about: 'saltline：按阶段开关移动、相机与枪，同步灵敏度、反转、视野；标题时冻结机甲，只在 playing 敌对',
  order: -1,
  props: CONTROL_PROPS,
  step(me, e, w) {
    const ph = phaseOf(w), s: Settings = w.vars.slSettings, m = e.b.moveFps, c = e.b.cameraFps, h = e.b.health, g = e.b.gunFps
    // 标题画面里敌人冻结；只有战斗中敌人才会发现玩家、开火、伤人
    w.vars.mechFrozen = ph === 'title'
    w.vars.mechHostile = ph === 'playing'
    m.active = (ph === 'playing' || ph === 'intro') && h.hp > 0
    c.active = ph !== 'title' && ph !== 'complete'
    if (g) g.active = ph === 'playing' && h.hp > 0
    // 能动的时候才回血
    h.regen = m.active ? me.regen : 0
    // 设置面板里的灵敏度、反转垂直视角、视野
    m.sensitivity = s.sensitivity
    m.invertY = s.invertY
    c.fov = s.fov ?? me.fov
  },
})

/** seaY：海面高度（取自港口地图）；rescueDamage：从海里救上来扣的血；rescued：救上来时的提示（“已从水中获救”） */
const RESCUE_PROPS = { seaY: -1.6, rescueDamage: 0, rescued: '' }

/**
 * 移动之后（order 1，排在同 order 的 fps 的 feedbackFps 之后）：落水救援（原版：低于海面 2.2 m）。
 * 从码头边掉进海里时，拉回最后站稳的地方（往岸里挪 1.5 米），提示“已从水中获救”，战斗中还要扣 12 血。
 * 往岸里挪的方向（-x）和战斗中扣血都是本游戏的规矩，所以不放进套件
 */
const slRescue = defineBlock<typeof RESCUE_PROPS>({
  name: 'slRescue',
  about: 'saltline：落水救援，低于海面 2.2 米时拉回最后站稳处往岸里 1.5 米，提示 rescued，战斗中扣 rescueDamage',
  order: 1,
  props: RESCUE_PROPS,
  step(me, e, w) {
    const m = e.b.moveFps
    if (!m.active || e.pos[1] >= me.seaY - 2.2) return
    const s = m.lastSafe
    e.pos = [s[0] - 1.5, s[1], s[2]]
    m.vel = [0, 0, 0]
    slEmit(w, 'slMessage', me.rescued)
    if (phaseOf(w) === 'playing') damage(w, e, me.rescueDamage)
  },
})

export const playerBlocks = [slControl, slRescue]

/**
 * 玩家实体：出生点与朝向来自关卡（level.json），地面、海面、出界范围来自港口地图（harborGround），手感参数来自 tuning.json 的 player。
 * 积木分工：slControl 按阶段开关；moveFps 走跑蹲跳与碰撞（走不出码头边和围栏外的空气墙）；
 * cameraFps 第一人称相机（走路晃动、开镜收窄视野、冲刺放宽视野）；health 生命与回血；gunFps KR-7 的射击规则；
 * feedbackFps 迈步、落地、受伤计数与红屏、镜头震动；slRescue 落水救援；
 * viewGun 手和枪的模型、换弹动作、枪口火焰、曳光与弹孔；viewFeedback 脚步与受伤声、受伤红边、低血量、开镜后处理
 */
export function Player({ data }: { data: SceneArgs['data'] }) {
  const tuning = data.load('tuning.json')
  const { fov, fovAds, fovSprint, bobX, bobY, regenDelay, regenRate, maxHealth, rescueDamage, ...move } = tuning.player
  const { name: _name, mag, reserve, spread, ...gun } = tuning.weapon
  const level = data.load<LevelData>('level.json')
  const { start } = levelPoints(level), ground = harborGround()
  return <entity key="player" tags={['player']} at={[...start.pos]} rot={[0, start.yaw, 0]}
    slControl={{ regen: regenRate, fov }}
    moveFps={{ ...move, layers: ['default', 'playerWall'], ground: { y: 0, maxX: ground.groundMaxX }, bounds: ground.bounds ?? null }}
    cameraFps={{ fov, fovAds, fovSprint, bobX, bobY, lockCursor: false, near: 0.02, far: 600 }}
    health={{ max: maxHealth, regen: regenRate, regenDelay }}
    gunFps={{ ...gun, magSize: mag, reserveStart: reserve, spreadHip: spread, hitscan: 'view', viewMask: (1 << MAP_LAYER) | (1 << ENEMY_LAYER), viewPlanes: ground.planes }}
    feedbackFps
    slRescue={{ seaY: ground.seaY, rescueDamage, rescued: data.load('flow.json').rescued }}
    viewGun viewFeedback />
}

declare module '@pot/core' {
  interface GameBlockProps {
    slControl?: Partial<typeof CONTROL_PROPS> | boolean
    slRescue?: Partial<typeof RESCUE_PROPS> | boolean
  }
}
