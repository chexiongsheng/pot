import type { Context } from '@pot/core'

/** 根单元：布置场景并挂载其他单元 */
export const name = 'main'

export function apply(ctx: Context) {
  const settings = ctx.data.load<{ background: string }>('settings.json')
  ctx.scene.background(settings.background)
  ctx.scene.light({ type: 'directional', rotation: [50, -30, 0] })
  ctx.scene.spawn({ shape: 'plane', name: 'ground', scale: 2, color: '#3a4a3a' })

  const camera = ctx.scene.camera
  camera.position = [0, 10, -10]
  camera.lookAt([0, 0, 0])

  // ctx.use('player', { speed: 5 })
}
