/**
 * harbor 套件（004 第 19.2 节）：港口场景。原版关卡构建（origlevel，运行 realistic/orig/port 的关卡代码）、
 * 关卡数据与玩法点（level）、关卡碰撞盒（physics），以及场景用的着色器（lamp 闪灯、gull 远景海鸥）。
 *
 *   import { origLevel } from '@pot/kit/harbor/origlevel'
 *   import { levelBoxes } from '@pot/kit/harbor/physics'
 */
import { defineKit } from '@pot/core'
import realistic from '@pot/kit/realistic'

export default defineKit({
  name: 'harbor',
  about: '港口场景：关卡构建、道具模型、关卡碰撞盒',
  requires: [realistic],
})
