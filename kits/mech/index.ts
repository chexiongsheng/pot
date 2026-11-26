/**
 * mech 套件（004 第 19.2 节）：机甲敌人。鸥（飞行）与犬（地面）的程序化模型与骨骼同步（models、gull、hound），
 * 鸥的锥形视野着色器（shaders/gullcone.frag）。行为积木在第 5 步移入。
 *
 *   import { buildEnemy } from '@pot/kit/mech/models'
 */
import { defineKit } from '@pot/core'
import fps from '@pot/kit/fps'
import realistic from '@pot/kit/realistic'

export default defineKit({
  name: 'mech',
  about: '机甲敌人：鸥（飞行）与犬（地面）的模型与骨骼同步',
  requires: [fps, realistic],
})
