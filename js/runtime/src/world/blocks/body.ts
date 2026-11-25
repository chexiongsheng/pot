/**
 * 碰撞体（004 第 17.4 节）：本身没有逻辑，由 World 的碰撞表读取，供 w.move、w.raycast、w.overlap 与触发检测使用。
 */
import { defineBlock } from '../registry'
import type { Vec3 } from '../../host'
import type { BodyShape } from '../collide'

export const body = defineBlock({
  name: 'body',
  about: '碰撞体（轴对齐，旋转不计）：shape 为 box（size 全长）、sphere（radius）或竖直 capsule（radius，height 为总高）；center 为相对实体的偏移；尺寸乘实体缩放；layer 层名；solid 为 false 时不挡 w.move，只参加射线、重叠与触发',
  props: {
    shape: 'box' as BodyShape,
    size: [1, 1, 1] as Vec3,
    radius: 0.5,
    height: 2,
    center: [0, 0, 0] as Vec3,
    layer: 'default',
    solid: true,
  },
})
