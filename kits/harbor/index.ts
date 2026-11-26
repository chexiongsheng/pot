/**
 * harbor 套件（004 第 19.2 节）：港口场景。原版关卡构建（origlevel，运行 realistic/orig/port 的关卡代码）、
 * 关卡数据与玩法点（level）、关卡碰撞盒（physics），以及场景用的着色器（lamp 闪灯、gull 远景海鸥）。
 *
 *   import { origLevel } from '@pot/kit/harbor/origlevel'
 *   import { levelBoxes } from '@pot/kit/harbor/physics'
 *   import { harborGunEnv } from '@pot/kit/harbor'
 *   setGunEnv(ctx.world, harborGunEnv())   // realistic 的 viewGun：港口的表面种类与室内盒
 */
import { defineKit } from '@pot/core'
import type { Vec3 } from '@pot/core'
import realistic, { type GunEnv } from '@pot/kit/realistic'
import { isPuddle } from '@pot/kit/realistic/apron'
import { surfaceAt } from '@pot/kit/realistic/decals'
import { origLevel } from './origlevel'

/**
 * viewGun 的场景查询（原版 impact 与 setWetness）：表面取碰撞盒材质，朝上、贴地且落在积水遮罩里的命中按水面处理；
 * 相机在第一个室内盒里时雨淋程度为 0.3，否则为 1。坐标是 Unity 的，原版盒子是 three 的（z 取反）
 */
export function harborGunEnv(): GunEnv {
  const interior = () => origLevel().data?.interiorBoxes ?? []
  return {
    surface(pt: Vec3, n: Vec3, tag?: string) {
      if (tag === 'water') return 'water'
      const s = surfaceAt(origLevel().boxes, pt)
      if (s !== 'water' && n[1] > 0.7 && pt[1] < 0.08 && isPuddle(pt[0], -pt[2], interior())) return 'water'
      return s
    },
    shelter(c: Vec3) {
      const b = interior()[0]
      if (!b) return 1
      const x = c[0], y = c[1], z = -c[2]
      return x > b.min.x && x < b.max.x && z > b.min.z && z < b.max.z && y < b.max.y ? 0.3 : 1
    },
  }
}

export default defineKit({
  name: 'harbor',
  about: '港口场景：关卡构建、道具模型、关卡碰撞盒；harborGunEnv 给 realistic 的 viewGun 提供表面种类与室内盒',
  requires: [realistic],
})
