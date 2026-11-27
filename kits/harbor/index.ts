/**
 * harbor 套件（004 第 19.2 节）：港口这张地图。游戏的关卡里放一个 <Harbor>（map.tsx）就有整座港区：
 * 碰撞盒、地面积水、海面、雨幕、集装箱堆场、起重机、仓库、货轮与码头。时段与天气由游戏的关卡配（realistic 的
 * atmosphere、weather），雨幕与积水跟着 weather 走。
 *
 *   import harbor, { Harbor, harborGunEnv } from '@pot/kit/harbor'
 *   <><Harbor /><entity key="weather" keep weather={{ rain: 0.45 }} /><Player data={data} /></>   // 角色放在港口后面
 *   setGunEnv(ctx.world, harborGunEnv())   // realistic 的 viewGun：港口的表面种类与室内盒
 *
 * 组成：原版地图构建（origmap，运行 realistic/orig/port 的原版关卡代码）、码头几何常量与原版坐标换算（quay）、碰撞盒（physics），
 * 地面积水（apron）、海面（sea）、雨幕（rain）与着色器；外观积木 harborLook（整张图的地面、海面、雨幕、码头几何、
 * 原版动画与灯光，中继状态读 w.vars.harborRelays）、harborStatics（原版静态网格，chunk / of 分份），由 <Harbor> 摆好。
 */
import { defineKit } from '@pot/core'
import type { Over, Vec3 } from '@pot/core'
import realistic, { type GunEnv } from '@pot/kit/realistic'
import { isPuddle } from './apron'
import { surfaceAt } from '@pot/kit/realistic/decals'
import { origMap } from './origmap'
import { harborLook, harborStatics, type HarborLookProps, type HarborStaticsProps } from './look'

export { harborLook, harborStatics }
export { Harbor, HarborColliders, type HarborProps } from './map'

/**
 * viewGun 的场景查询（原版 impact 与 setWetness）：表面取碰撞盒材质，朝上、贴地且落在积水遮罩里的命中按水面处理；
 * 相机在第一个室内盒里时雨淋程度为 0.3，否则为 1。坐标是 Unity 的，原版盒子是 three 的（z 取反）
 */
export function harborGunEnv(): GunEnv {
  const interior = () => origMap().data?.interiorBoxes ?? []
  return {
    surface(pt: Vec3, n: Vec3, tag?: string) {
      if (tag === 'water') return 'water'
      const s = surfaceAt(origMap().boxes, pt)
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

declare module '@pot/core' {
  interface GameBlockProps {
    harborLook?: Over<HarborLookProps>
    harborStatics?: Over<HarborStaticsProps>
  }
}

export default defineKit({
  name: 'harbor',
  about: '港口这张地图：地图组件 <Harbor>（碰撞盒与港区模型，不含时段与天气，雨幕与积水跟着 weather 走；角色放在它后面）；积木 harborLook（地面积水、海面、雨幕、码头几何、原版动画与灯光，中继状态读 w.vars.harborRelays）、harborStatics（原版静态网格，分份）；harborGunEnv 给 realistic 的 viewGun 提供表面种类与室内盒',
  vars: { harborRelays: [] as string[] },
  blocks: [harborLook, harborStatics],
  requires: [realistic],
})
