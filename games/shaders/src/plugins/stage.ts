import type { Context } from '@pot/core'

/**
 * 运行时着色器示例：着色器是 data/shaders 下的 GLSL ES 文件，改了保存即热重载，Runner 不用重建。
 * - 水面：自定义片元（时间动画 + 菲涅尔 + 环境反射），与穿过水面的柱子正确遮挡
 * - 球：条纹全息（叠加混合，透明队列）
 * - 方块：自定义顶点着色器（摆动）+ 共用光照库
 */
export const name = 'stage'

export function apply(ctx: Context) {
  const { scene, gfx } = ctx
  scene.background('#1b2333')
  scene.sky({ zenith: '#2c4f86', horizon: '#c9d8e8', ground: '#3b3b40', reflection: true, ambient: true })
  scene.light({ type: 'directional', rotation: [40, -40, 0], intensity: 1.2, shadows: 'soft' })
  scene.spawn({ shape: 'plane', name: 'ground', scale: 3, position: [0, -1.2, 0], color: '#556055' })

  const camera = scene.camera
  camera.position = [0, 5, -9]
  camera.lookAt([0, 0, 0])

  if (!gfx.supported) ctx.logger('stage').warn('当前平台不支持运行时着色器')

  const water = gfx.shader({ fragment: 'shaders/water.frag' })
  scene.spawn({ shape: 'plane', name: 'water', scale: 1.2, position: [0, 0, 0] })
    .shader(water, { blend: 'alpha', uniforms: { uShallow: '#5fd0c8', uDeep: '#0b3c66' } })

  // 穿过水面的柱子（普通 URP 材质）：检验遮挡
  scene.spawn({ shape: 'cylinder', name: 'pillar', position: [2, 0, 1], scale: [0.8, 1.5, 0.8], color: '#c08050' })

  const holo = gfx.shader({ fragment: 'shaders/holo.frag' })
  scene.spawn({ shape: 'sphere', name: 'holo', position: [-2.2, 1, 0.5], scale: 1.6 })
    .shader(holo, { blend: 'add', uniforms: { uColor: '#40c0ff' } })

  const wobble = gfx.shader({ vertex: 'shaders/wobble.vert', fragment: 'shaders/clay.frag' })
  const box = scene.spawn({ shape: 'cube', name: 'clay', position: [0, 0.6, 2.5], scale: 1.2 })
    .shader(wobble, { uniforms: { uAmount: 0.15, uTint: '#e0a060' } })

  ctx.on('update', (_dt, time) => {
    box.rotation = [0, time * 30, 0]
  })
}
