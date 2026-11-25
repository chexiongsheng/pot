/**
 * topdown 套件（004 第 17.3 节）：俯视角移动与跟随相机。
 * 原是系统积木，M3 迁到这里；代码不变，只改了 import。
 *
 *   import topdown from '@pot/kit/topdown'
 *   export default defineGame({ kits: [topdown], ... })
 */
import { defineBlock, defineKit } from '@pot/core'
import type { Over, Vec3 } from '@pot/core'

/** 俯视角移动：读 move 轴，x 轴对应世界 x，y 轴对应世界 z */
export const moveTopdown = defineBlock({
  name: 'moveTopdown',
  about: '俯视角移动：读指令轴 move，按 speed（米每秒）改 pos 的 x、z',
  props: { speed: 5 },
  step(me, e, w) {
    const { x, y } = w.cmd(e).axis('move')
    if (!x && !y) return
    e.pos[0] += x * me.speed * w.dt
    e.pos[2] += y * me.speed * w.dt
  },
})

/** 相机跟随：每帧把相机放到实体插值位置加 offset，并看向实体 */
export const cameraFollow = defineBlock({
  name: 'cameraFollow',
  about: '相机跟随：相机放在实体位置加 offset 处并看向实体（每帧，按插值后的位置）',
  props: { offset: [0, 12, -10] as Vec3 },
  view: {
    update(me, e, _objs, ctx, w) {
      const prev = w.prev.get(e.id)?.pos ?? e.pos
      const a = ctx.clock.fixedAlpha
      const p: Vec3 = [prev[0] + (e.pos[0] - prev[0]) * a, prev[1] + (e.pos[1] - prev[1]) * a, prev[2] + (e.pos[2] - prev[2]) * a]
      const o = me.offset
      const cam = ctx.scene.camera
      cam.position = [p[0] + o[0], p[1] + o[1], p[2] + o[2]]
      cam.lookAt(p)
    },
  },
})

declare module '@pot/core' {
  interface GameBlockProps {
    moveTopdown?: Over<{ speed: number }>
    cameraFollow?: Over<{ offset: Vec3 }>
  }
}

export default defineKit({
  name: 'topdown',
  about: '俯视角移动（moveTopdown）与跟随相机（cameraFollow）',
  blocks: [moveTopdown, cameraFollow],
})
