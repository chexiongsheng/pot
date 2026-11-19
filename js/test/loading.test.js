const test = require('node:test')
const assert = require('node:assert/strict')
const { loadPot, createHost, startGame } = require('./helpers')

/** async 单元：分 n 步加载，每步 step 一次，最后生成一个实体 */
function asyncUnit(name, n) {
  return `"use strict";\nexports.name = ${JSON.stringify(name)};\nexports.apply = async function (ctx) {\n` +
    `  ctx.loading.budget = 0\n` +
    `  for (let i = 0; i < ${n}; i++) await ctx.loading.step('阶段 ' + i, i / ${n})\n` +
    `  ctx.scene.spawn({ name: 'loaded' })\n};\n`
}

function files(n) {
  return new Map([
    ['manifest.json', JSON.stringify({ id: 't', plugins: ['w'] })],
    ['src/plugins/w.js', asyncUnit('w', n)],
  ])
}

test('loading：宿主不按帧驱动时 step 不让帧，启动与同步代码一致', async () => {
  const { runtime, engine } = await startGame(files(5))
  assert.equal(runtime.status, 'running')
  assert.equal(engine.byName('loaded').length, 1)
  assert.equal(runtime.loading.yields, 0)
  assert.equal(runtime.loading.active, false)
})

test('loading：按帧驱动时 step 让帧，pump 后继续，并向宿主回报进度', async () => {
  const pot = loadPot()
  const host = createHost(files(4))
  const reports = []
  host.frames = true
  host.loading = (progress, text) => reports.push([progress, text])
  const runtime = await pot.createRuntime(host, { loader: pot.devtools.createLoader(host) })
  pot.devtools.attach(runtime)
  let started = false
  const p = runtime.start().then(() => { started = true })
  let pumps = 0
  for (let i = 0; i < 200 && !started; i++) {
    await new Promise((r) => setImmediate(r))
    if (started) break
    // 让帧期间实体尚未生成
    if (runtime.loading.yields > 0 && pumps === 0) assert.equal(host.engine.byName('loaded').length, 0)
    runtime.loading.pump()
    pumps++
  }
  await p
  assert.equal(host.engine.byName('loaded').length, 1)
  assert.ok(runtime.loading.yields >= 4, `yields=${runtime.loading.yields}`)
  assert.ok(reports.some(([, t]) => t === '阶段 2'))
  assert.deepEqual(reports[reports.length - 1], [1, '完成'])
  assert.equal(runtime.loading.active, false)
})
