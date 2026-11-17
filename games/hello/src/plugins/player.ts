import type { Context, Vec3 } from '@pot/core'

/** 玩家：WASD/方向键移动。位置与得分放在 state，热重载后保持 */
export const name = 'player'

export interface PlayerState {
  position: Vec3
  score: number
}

export function apply(ctx: Context, config: { speed?: number } = {}) {
  const speed = config.speed ?? 4
  const state = ctx.state.define<PlayerState>('player', {
    version: 1,
    init: () => ({ position: [0, 0.5, 0], score: 0 }),
  })

  const body = ctx.scene.spawn({ shape: 'cube', name: 'player', position: state.position, color: '#4fc3f7' })

  ctx.on('update', (dt) => {
    const { x, y } = ctx.input.axis('move')
    if (!x && !y) return
    state.position[0] += x * speed * dt
    state.position[2] += y * speed * dt
    body.position = state.position
  })
}
