import type { Context } from '@pot/core'

/** 场景布置：背景、灯光、地面、相机，并挂载玩家与金币 */
export const name = 'world'

export function apply(ctx: Context) {
  ctx.scene.background('#1e2230')
  ctx.scene.light({ type: 'directional', rotation: [50, -30, 0], intensity: 1.1 })
  ctx.scene.spawn({ shape: 'plane', name: 'ground', scale: 2, color: '#3a4a3a' })

  const camera = ctx.scene.camera
  camera.position = [0, 12, -10]
  camera.lookAt([0, 0, 0])

  ctx.use('player', { speed: 5 })
  ctx.use('coins')
}
