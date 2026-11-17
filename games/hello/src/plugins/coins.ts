import type { Context, Entity, Vec3 } from '@pot/core'
import type { PlayerState } from './player'

/** 金币：位置来自 data/coins.json，拾取记录放在 state */
export const name = 'coins'

interface Level {
  color: string
  radius: number
  coins: Vec3[]
}

function distance(a: Vec3, b: Vec3) {
  return Math.hypot(a[0] - b[0], a[2] - b[2])
}

export function apply(ctx: Context) {
  const level = ctx.data.load<Level>('coins.json')
  const state = ctx.state.define('coins', { version: 1, init: () => ({ collected: [] as number[] }) })

  const items: (Entity | null)[] = level.coins.map((position, i) =>
    state.collected.includes(i)
      ? null
      : ctx.scene.spawn({ shape: 'sphere', name: `coin${i}`, position, scale: 0.5, color: level.color }))

  ctx.on('update', (_dt, time) => {
    const player = ctx.state.get<PlayerState>('player')
    items.forEach((coin, i) => {
      if (!coin) return
      coin.rotation = [0, time * 90, 0]
      if (player && distance(player.position, level.coins[i]) < level.radius) {
        coin.destroy()
        items[i] = null
        state.collected.push(i)
        player.score++
        ctx.logger('coins').info('拾取金币 %d，得分 %d', i, player.score)
      }
    })
  })
}
