const test = require('node:test')
const assert = require('node:assert/strict')
const { startGame, run } = require('./helpers')

const GAME = 'src/plugins/game.tsx'

/** 测试用套件：base 提供积木 hop 与预制件 bunny；a、b 都依赖 base，且都提供积木 glow */
const KITS = {
  'base/index.ts': `import { defineKit, defineBlock, definePrefab } from '@pot/core'
import { HOP } from './consts'
export const hop = defineBlock({ name: 'hop', about: '跳', props: { h: HOP }, state: { n: 0 }, step(me) { me.n++ } })
export const Bunny = definePrefab('bunny', { hop: true, tags: ['bunny'] })
export default defineKit({ name: 'base', about: '基础', blocks: [hop], prefabs: [Bunny], controls: { actions: { jump: 'k', dash: 'j' } } })
`,
  'base/consts.ts': 'export const HOP = 1\n',
  'a/index.ts': `import { defineKit, defineBlock } from '@pot/core'
import base from '@pot/kit/base'
export const glow = defineBlock({ name: 'glow', about: 'a 的光', props: { a: 1 } })
export default defineKit({ name: 'a', blocks: [glow], requires: [base], controls: { actions: { dash: 'l' } } })
`,
  'b/index.ts': `import { defineKit, defineBlock } from '@pot/core'
import base from '@pot/kit/base'
export const glow = defineBlock({ name: 'glow', about: 'b 的光', props: { b: 1 } })
export default defineKit({ name: 'b', blocks: [glow], requires: [base] })
`,
  'bad/index.ts': `import { HOP } from '../base/consts'\nexport default HOP\n`,
}

function setup(source) {
  const files = new Map([
    ['manifest.json', JSON.stringify({ id: 'kit.test', plugins: ['game'] })],
    [GAME, source],
  ])
  const kits = new Map(Object.entries(KITS))
  return { files, kits }
}

async function start(source, { ok = true } = {}) {
  const { files, kits } = setup(source)
  const ctx = await startGame(files, { setupHost: (host) => { host.kits = kits } })
  if (ok) assert.deepEqual(ctx.runtime.failures, [])
  return { ...ctx, kits }
}

const w = (runtime) => runtime.root.world
const errors = (host) => host.logs.filter((l) => l.level === 'error').map((l) => l.text)

test('kits：按 requires 展开、依赖只登记一次；来源为 kit:<名字>；controls 依次覆盖', async () => {
  const { runtime } = await start(`import { defineGame } from '@pot/core'
import a from '@pot/kit/a'
import base from '@pot/kit/base'
export default defineGame({ kits: [a, base], controls: { actions: { fire: 'f' } }, scene: () => <><entity key="e" glow hop /><bunny key="b" /></> })
`)
  const reg = w(runtime).registry
  assert.equal(reg.sourceOf('block', 'hop'), 'kit:base')
  assert.equal(reg.sourceOf('block', 'glow'), 'kit:a')
  assert.equal(reg.sourceOf('prefab', 'bunny'), 'kit:base')
  assert.equal(reg.sourceOf('block', 'shape'), 'system')
  assert.equal(reg.sourceOf('prefab', 'entity'), 'system')
  assert.equal(reg.block('glow').about, 'a 的光')
  const c = w(runtime).controls
  assert.equal(c.actions.jump, 'k')
  assert.equal(c.actions.dash, 'l', 'a 在 base 之后，覆盖 base 的 dash')
  assert.equal(c.actions.fire, 'f')
  assert.equal(w(runtime).query('bunny').length, 1)
})

test('kits：两个套件同名报错；游戏登记了同名的就不报，用游戏的', async () => {
  const bad = await start(`import { defineGame } from '@pot/core'
import a from '@pot/kit/a'
import b from '@pot/kit/b'
export default defineGame({ kits: [a, b], scene: () => <entity key="e" glow /> })
`, { ok: false })
  assert.equal(bad.runtime.failures.length, 1)
  assert.match(String(bad.runtime.failures[0].error), /积木 glow 同时由套件 a 和 b 提供/)

  const { runtime } = await start(`import { defineGame, defineBlock } from '@pot/core'
import a from '@pot/kit/a'
import b from '@pot/kit/b'
const glow = defineBlock({ name: 'glow', about: '游戏的光', props: { c: 1 } })
export default defineGame({ kits: [a, b], blocks: [glow], scene: () => <entity key="e" glow={{ c: 2 }} /> })
`)
  assert.equal(w(runtime).registry.block('glow').about, '游戏的光')
  assert.equal(w(runtime).registry.sourceOf('block', 'glow'), 'game')
})

test('kits：只 import 没写进 kits 时提示属于哪个套件', async () => {
  const { host } = await start(`import { defineGame } from '@pot/core'
import base from '@pot/kit/base'
export default defineGame({ scene: () => <><entity key="e" hop /><bunny key="b" /></> })
`, { ok: false })
  const text = errors(host).join('\n')
  assert.match(text, /未知的积木 hop，它属于套件 base，请加到 defineGame 的 kits/)
})

test('kits：套件文件变化后，依赖它的游戏单元热重载，改动生效', async () => {
  const ctx = await start(`import { defineGame } from '@pot/core'
import base from '@pot/kit/base'
export default defineGame({ kits: [base], scene: () => <entity key="e" hop /> })
`)
  const { runtime, pot, kits } = ctx
  assert.equal(w(runtime).registry.block('hop').props.h, 1)
  kits.set('base/consts.ts', 'export const HOP = 3\n')
  const reply = await run(runtime, pot.devtools.handle({ id: 1, type: 'changed', paths: ['@pot/kit/base/consts.ts'] }))
  assert.equal(reply.ok, true, reply.error)
  assert.ok(reply.data.units.includes('game'), JSON.stringify(reply.data))
  assert.equal(w(runtime).registry.block('hop').props.h, 3)
  assert.deepEqual(errors(ctx.host), [])
})

test('加载器：套件内相对路径不能越出套件；游戏不能用相对路径进套件；套件不存在时报错', async () => {
  const bad = await start(`import x from '@pot/kit/bad'\nexport const y = x\nexport function apply() {}\n`, { ok: false })
  assert.match(String(bad.runtime.failures[0].error), /套件内的相对路径不能越出套件目录/)
  const missing = await start(`import x from '@pot/kit/nope'\nexport const y = x\nexport function apply() {}\n`, { ok: false })
  assert.match(String(missing.runtime.failures[0].error), /找不到模块 "@pot\/kit\/nope"/)
  const escape = await start(`import x from '@pot/kit/base/../a'\nexport const y = x\nexport function apply() {}\n`, { ok: false })
  assert.match(String(escape.runtime.failures[0].error), /越出套件目录/)
})
