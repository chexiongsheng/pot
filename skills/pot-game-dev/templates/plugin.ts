import type { Context } from '@pot/core'

/** 单元模板：复制为 src/plugins/<name>.ts，并把 name 改成文件名 */
export const name = 'example'

export interface ExampleState {
  position: [number, number, number]
}

export interface Config {
  speed?: number
}

export function apply(ctx: Context, config: Config = {}) {
  const speed = config.speed ?? 3

  // 持久数据：热重载、冷重启后保留
  const state = ctx.state.define<ExampleState>('example', {
    version: 1,
    init: () => ({ position: [0, 0.5, 0] }),
    // migrate: (old, from) => ...,  结构变化时 version + 1 并实现
  })

  // 场景是 state 的投影：每次挂载都根据 state 重建
  const body = ctx.scene.spawn({ shape: 'cube', name: 'example', position: state.position, color: '#4fc3f7' })

  ctx.on('update', (dt) => {
    const { x, y } = ctx.input.axis('move')
    if (!x && !y) return
    state.position[0] += x * speed * dt
    state.position[2] += y * speed * dt
    body.position = state.position
  })

  // 定时器走游戏时间，单元卸载时自动清理
  ctx.interval(() => ctx.logger(name).debug('position %o', state.position), 5000)
}
