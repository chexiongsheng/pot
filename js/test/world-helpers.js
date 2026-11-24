/**
 * World 测试辅助：一个最小的游戏，测试用积木放在共享模块 src/lib/blocks.ts，
 * 场景树写在 src/plugins/game.tsx 里（由各用例给出 TSX 源码片段）。
 */
const assert = require('node:assert/strict')
const { startGame, run } = require('./helpers')

const BLOCKS = `
import { defineBlock } from '@pot/core'
import type { Context } from '@pot/core'

export const blocks = [
  defineBlock({ name: 'trigger', about: '触发', props: { radius: 0.5 as number, box: null as null | number[] } }),
  defineBlock({
    name: 'mover', about: '读 move 轴移动', props: { speed: 5 },
    step(me, e, w) {
      const a = w.cmd().axis('move')
      e.pos[0] += a.x * me.speed * w.dt
      e.pos[2] += a.y * me.speed * w.dt
    },
  }),
  defineBlock({
    name: 'counter', about: '每步加 by', props: { by: 1 }, state: { n: 0, inits: 0 },
    init(me) { me.inits++ },
    step(me) { me.n += me.by },
  }),
  defineBlock({ name: 'tint', about: '颜色', props: { color: '#ffffff', size: { x: 1, y: 1 } } }),
  defineBlock({
    name: 'jumper', about: '数 jump 的按下次数', state: { count: 0, held: 0 },
    step(me, e, w) {
      if (w.cmd().pressed('jump')) me.count++
      if (w.cmd().down('jump')) me.held++
    },
  }),
]

export function register(ctx: Context) {
  for (const b of blocks) ctx.effect(() => ctx.world.registry.addBlock(b))
}
`

/** game.tsx：prelude 放在 apply 之前（定义预制件、组件），body 放在 apply 里（mount 等） */
function gameSource({ prelude = '', body }) {
  return [
    "import { definePrefab } from '@pot/core'",
    "import type { Context } from '@pot/core'",
    "import { register } from '../lib/blocks'",
    "export const name = 'game'",
    "const Player = definePrefab('player', { tags: ['player'], mover: true, trigger: { radius: 0 } })",
    "const Coin = definePrefab('coin', { tags: ['coin'], trigger: { radius: 0.8 }, tint: { color: '#ffd54f' } })",
    "const Thing = definePrefab('thing', { counter: true })",
    prelude,
    'export function apply(ctx: Context) {',
    '  register(ctx)',
    '  ctx.effect(() => ctx.world.registry.addPrefab(Player))',
    '  ctx.effect(() => ctx.world.registry.addPrefab(Coin))',
    '  ctx.effect(() => ctx.world.registry.addPrefab(Thing))',
    '  const w = ctx.world',
    body,
    '}',
  ].join('\n')
}

const GAME = 'src/plugins/game.tsx'

function worldFiles(game, { plugins = ['game'], extra = {} } = {}) {
  const files = new Map([
    ['manifest.json', JSON.stringify({ id: 'world.test', plugins })],
    ['src/lib/blocks.ts', BLOCKS],
    [GAME, gameSource(game)],
  ])
  for (const [k, v] of Object.entries(extra)) files.set(k, v)
  return files
}

async function startWorld(game, options = {}) {
  const ctx = await startGame(worldFiles(game, options), options.start)
  assert.deepEqual(ctx.runtime.failures, [])
  return ctx
}

/** 改 game.tsx 并热重载 */
async function reloadGame(ctx, game) {
  ctx.files.set(GAME, gameSource(game))
  const reply = await run(ctx.runtime, ctx.pot.devtools.handle({ id: 1, type: 'changed', paths: [GAME] }))
  assert.equal(reply.ok, true, reply.error)
  assert.equal(reply.data.ok, true, reply.data.error)
  return reply.data
}

const world = (runtime) => runtime.root.world
const data = (runtime) => runtime.state.get('world')
/** 按挂载路径取实体 */
function byPath(runtime, path, mount = 'game') {
  const rec = data(runtime).mounts[mount]?.keys[path]
  return rec && !rec.dead ? data(runtime).entities[rec.id] : undefined
}

module.exports = { BLOCKS, GAME, gameSource, worldFiles, startWorld, reloadGame, world, data, byPath }
