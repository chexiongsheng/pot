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

test('load：按帧驱动时让帧，进度映射到区间（load 占前 80%，预热占后 20%）', async () => {
  const { runtime, reports } = await startFramed(files({ budget: 0 }))
  assert.deepEqual(runtime.failures, [])
  assert.ok(runtime.loading.yields > 0)
  const find = (text) => reports.find(([, t]) => t === text)
  assert.ok(Math.abs(find('读数据')[0] - 0.4) < 1e-9)
  assert.ok(Math.abs(find('生成场景 1/4')[0] - 0.85) < 1e-9)
  assert.ok(Math.abs(find('生成场景 4/4')[0] - 1) < 1e-9)
  assert.deepEqual(reports[reports.length - 1], [1, '完成'])
})

test('loading.within：父单元给子单元划区间；非法区间报错', async () => {
  const { runtime, reports } = await startFramed(files({ budget: 0 }, ['parent']))
  assert.deepEqual(runtime.failures, [])
  const find = (text) => reports.find(([, t]) => t === text)
  assert.ok(Math.abs(find('读数据')[0] - (0.5 + 0.2 * 0.8 * 0.5)) < 1e-9)
  assert.ok(Math.abs(find('生成场景 4/4')[0] - 0.7) < 1e-9)
  assert.throws(() => runtime.loading.within(0.6, 0.2), /0 <= lo <= hi <= 1/)
  assert.throws(() => runtime.loading.within(-0.1, 0.2), /0 <= lo <= hi <= 1/)
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
