const test = require('node:test')
const assert = require('node:assert/strict')
const { loadPot, createHost, startGame, frames, run } = require('./helpers')

/** 004 第 17.13 节：defineGame 的 load、ctx.loading.within、启动预热表现 */

const GAME = 'src/plugins/game.tsx'

function gameSource({ mark = 'a', budget = 50 } = {}) {
  return `import { defineGame, defineBlock } from '@pot/core'
const tag = defineBlock({ name: 'tag', about: '测试', props: {} })
export default defineGame({
  vars: { n: 7 },
  blocks: [tag],
  load: async (ctx, step) => {
    ctx.loading.budget = ${budget}
    const w = ctx.world
    ctx.logger('t').info('load ${mark} ' + w.vars.n + ' ' + !!w.registry.block('tag') + ' ' + w.query().length)
    await step('读数据', 0.5)
    ctx.logger('t').info('loaded ${mark}')
  },
  scene: () => <>{[0, 1, 2, 3].map((i) => <entity key={i} at={[i, 0, 0]} shape={{ kind: 'cube' }} />)}</>,
})
`
}

const PARENT = `"use strict";
exports.name = 'parent';
exports.apply = async function (ctx) {
  ctx.loading.within(0.5, 0.7)
  await ctx.use('game')
};
`

function files(options, plugins = ['game']) {
  const map = new Map([
    ['manifest.json', JSON.stringify({ id: 'load.test', plugins })],
    [GAME, gameSource(options)],
  ])
  if (plugins.includes('parent')) map.set('src/plugins/parent.js', PARENT)
  return map
}

const infos = (host) => host.logs.filter((l) => l.level === 'info').map((l) => l.text)

/** 按帧驱动的宿主：启动期间每轮放行一次等待，收集回报 */
async function startFramed(map) {
  const pot = loadPot()
  const host = createHost(map)
  const reports = []
  host.frames = true
  host.loading = (progress, text) => reports.push([progress, text])
  const runtime = await pot.createRuntime(host, { loader: pot.devtools.createLoader(host) })
  pot.devtools.attach(runtime)
  let started = false
  const p = runtime.start().then(() => { started = true })
  for (let i = 0; i < 500 && !started; i++) {
    await new Promise((r) => setImmediate(r))
    if (!started) runtime.loading.pump()
  }
  await p
  return { pot, host, runtime, engine: host.engine, files: map, reports }
}

test('load：积木与 vars 已登记、场景尚未挂载；预热后表现已建，第一帧不重复 enter', async () => {
  const { runtime, host, engine } = await startGame(files())
  assert.deepEqual(runtime.failures, [])
  assert.deepEqual(infos(host).filter((t) => t.includes('load')), ['load a 7 true 0', 'loaded a'])
  const world = runtime.root.world
  assert.equal(world.query().length, 4)
  // 还没走过任何一帧，表现已经建好
  assert.equal(world.view.objectCount, 4)
  const before = engine.objects.size
  frames(runtime, 2)
  assert.equal(world.view.objectCount, 4)
  assert.equal(engine.objects.size, before)
})

test('load：按帧驱动时让帧，load 的进度映射到前 80%，预热从 load 报到的位置接着走', async () => {
  const { runtime, reports } = await startFramed(files({ budget: 0 }))
  assert.deepEqual(runtime.failures, [])
  assert.ok(runtime.loading.yields > 0)
  const find = (text) => reports.find(([, t]) => t === text)
  assert.ok(Math.abs(find('读数据')[0] - 0.4) < 1e-9)
  // 0.4 起，4 个实体各 1/4
  assert.ok(Math.abs(find('生成场景 1/4')[0] - 0.55) < 1e-9)
  assert.ok(Math.abs(find('生成场景 4/4')[0] - 1) < 1e-9)
  assert.deepEqual(reports[reports.length - 1], [1, '完成'])
})

test('loading.within：父单元给子单元划区间；非法区间报错', async () => {
  const { runtime, reports } = await startFramed(files({ budget: 0 }, ['parent']))
  assert.deepEqual(runtime.failures, [])
  const find = (text) => reports.find(([, t]) => t === text)
  assert.ok(Math.abs(find('读数据')[0] - (0.5 + 0.2 * 0.8 * 0.5)) < 1e-9)
  assert.ok(Math.abs(find('生成场景 4/4')[0] - 0.7) < 1e-9)
  // 子单元从 load 报到的 0.58（0.5 + 0.2 × 0.4）接着走，4 个实体各 1/4
  assert.ok(Math.abs(find('生成场景 1/4')[0] - (0.58 + 0.12 * 0.25)) < 1e-9)
  assert.throws(() => runtime.loading.within(0.6, 0.2), /0 <= lo <= hi <= 1/)
  assert.throws(() => runtime.loading.within(-0.1, 0.2), /0 <= lo <= hi <= 1/)
})

test('load：step 的第三个参数给 ctx.use 的子单元划区间，load 结束后恢复', async () => {
  const map = files({ budget: 0 })
  map.set(GAME, `import { defineGame } from '@pot/core'
export default defineGame({
  load: async (ctx, step) => {
    ctx.loading.budget = 0
    await step('挂子单元', 0.25, 0.5)
    await ctx.use('child')
    ctx.logger('t').info('window ' + ctx.loading.window.join(','))
  },
  scene: () => <entity key="a" at={[0, 0, 0]} shape={{ kind: 'cube' }} />,
})
`)
  map.set('src/plugins/child.tsx', `import { defineGame } from '@pot/core'
export default defineGame({ load: async (_ctx, step) => { await step('子读数据', 0.5) } })
`)
  const { runtime, reports, host } = await startFramed(map)
  assert.deepEqual(runtime.failures, [])
  const find = (text) => reports.find(([, t]) => t === text)
  assert.ok(Math.abs(find('挂子单元')[0] - 0.2) < 1e-9)
  // 子单元区间为 0.2..0.4，没有 scene，load 独占：0.5 → 0.3
  assert.ok(Math.abs(find('子读数据')[0] - 0.3) < 1e-9)
  assert.ok(infos(host).includes('window 0.2,0.4'))
  assert.deepEqual(runtime.loading.window, [0, 1])
})

test('load：热重载时重跑、不让帧，实体保留', async () => {
  const ctx = await startFramed(files())
  const { runtime, host } = ctx
  const ids = runtime.root.world.query().map((e) => e.id)
  const yields = runtime.loading.yields
  frames(runtime, 3)
  ctx.files.set(GAME, gameSource({ mark: 'b', budget: 0 }))
  const reply = await run(runtime, ctx.pot.devtools.handle({ id: 1, type: 'changed', paths: [GAME] }))
  assert.equal(reply.ok, true, reply.error)
  assert.equal(reply.data.ok, true, reply.data.error)
  assert.ok(infos(host).includes('load b 7 true 4'))
  assert.ok(infos(host).includes('loaded b'))
  assert.equal(runtime.loading.yields, yields)
  frames(runtime, 2)
  assert.deepEqual(runtime.root.world.query().map((e) => e.id), ids)
  assert.equal(runtime.root.world.view.objectCount, 4)
})

test('defineGame：load 不是函数时报错', async () => {
  const map = files()
  map.set(GAME, gameSource().replace(/load: async \(ctx, step\) => \{[\s\S]*?\n  \},\n/, 'load: 1,\n'))
  const { runtime, host } = await startGame(map)
  const all = JSON.stringify(runtime.failures) + host.logs.map((l) => l.text).join('\n')
  assert.match(all, /load 必须是函数/)
})

test('预热：load 没报进度时独占整个区间；按 view.cost 加权；最慢的实体记日志', async () => {
  const map = files({ budget: 0 })
  map.set(GAME, `import { defineGame, defineBlock } from '@pot/core'
const heavy = defineBlock({ name: 'heavy', about: '测试', props: {}, view: { cost: 6, enter() { const t = Date.now(); while (Date.now() - t < 120) {} } } })
const light = defineBlock({ name: 'light', about: '测试', props: {}, view: { enter() {} } })
export default defineGame({
  blocks: [heavy, light],
  load: (ctx) => { ctx.loading.budget = 0 },
  scene: () => <>
    <entity key="big" heavy light />
    {[0, 1, 2].map((i) => <entity key={i} light />)}
    <entity key="bare" />
  </>,
})
`)
  const { runtime, reports, host } = await startFramed(map)
  assert.deepEqual(runtime.failures, [])
  const scene = reports.filter(([, t]) => /^生成场景/.test(t))
  // 有表现的 4 个实体，权重 7、1、1、1，共 10；load 没报进度，从 0 开始
  assert.deepEqual(scene.map(([, t]) => t), ['生成场景 1/4', '生成场景 2/4', '生成场景 3/4', '生成场景 4/4'])
  assert.ok(Math.abs(scene[0][0] - 0.7) < 1e-9, `第一个是 0.7，实际 ${scene[0][0]}`)
  assert.ok(Math.abs(scene[1][0] - 0.8) < 1e-9)
  assert.ok(Math.abs(scene[3][0] - 1) < 1e-9)
  assert.ok(infos(host).some((t) => /^预热最慢：entity:big（heavy、light）\d+ ms$/.test(t)), infos(host).join('\n'))
})
