/**
 * harbor 的场景积木（004 第 19.5 节第 8 步）：harborLevel 与 harborStatics 建出港口整张图，
 * 中继状态读 w.vars.harborRelays，keep 时跨流程状态不重建，去掉后对象全部销毁、着色器不重复编译；雨幕与积水跟随场景里的 weather。
 */
const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('path')
const { startGame, frames, run, readGameFiles } = require('./helpers')

const GAME = 'src/plugins/game.tsx'
const SALTLINE = path.resolve(__dirname, '../../games/saltline')

function source({ scenery = true, weather = '' } = {}) {
  return `import { defineGame } from '@pot/core'
import realistic from '@pot/kit/realistic'
import harbor from '@pot/kit/harbor'
export default defineGame({
  kits: [realistic, harbor],
  flow: { start: 'a', states: { a: { on: { go: 'b' } }, b: { on: { go: 'a' } } } },
  scene: (s) => <>
    ${weather ? `<entity key="storm" keep weather={${weather}} />` : ''}
    ${scenery ? `<entity key="harbor" keep harborLevel />
    {[0, 1, 2].map((i) => <entity key={'s' + i} keep harborStatics={{ chunk: i, of: 3 }} />)}` : ''}
    <entity key={'marker-' + s.state} name="marker" />
  </>,
})
`
}

async function start(options) {
  // 关卡数据用 saltline 的
  const files = readGameFiles(SALTLINE)
  for (const k of [...files.keys()]) if (k.startsWith('src/')) files.delete(k)
  files.set('manifest.json', JSON.stringify({ id: 'harbor.test', plugins: ['game'] }))
  files.set(GAME, source(options))
  const g = await startGame(files)
  assert.deepEqual(g.runtime.failures, [])
  frames(g.runtime, 2)
  return g
}

const errors = (g) => g.host.logs.filter((l) => l.level === 'error').map((l) => l.text)
const named = (g, re) => [...g.engine.objects.values()].filter((o) => re.test(o.name ?? ''))

test('harborLevel、harborStatics：建出地面、海面、雨幕、关卡几何、原版网格与灯；中继状态驱动中继灯；keep 跨状态不重建；去掉后全部销毁', async () => {
  const g = await start()
  assert.deepEqual(errors(g), [])
  assert.equal(named(g, /^apron$/).length, 1, '原版地面')
  assert.equal(named(g, /^sea$/).length, 1, '海面')
  assert.equal(named(g, /^rain$/).length, 1, '雨丝')
  const statics = named(g, /^level:/).length
  assert.ok(statics > 50, `静态网格 ${statics}`)
  assert.ok(named(g, /^level-dyn:/).length > 5, '动态网格')
  const relays = named(g, /^relay-light-/)
  assert.equal(relays.length, 3, '三个中继灯')
  // 中继切断后中继灯随原版动画变化（发光强度变了）
  const before = relays.map((r) => r.intensity)
  g.runtime.root.world.vars.harborRelays = ['cut', 'cut', 'cut']
  frames(g.runtime, 60)
  assert.notDeepEqual(relays.map((r) => r.intensity), before, '中继灯随状态变化')
  // keep：切状态不重建
  const count = g.engine.objects.size
  const progs = g.engine.programs.size
  g.runtime.root.world.emit('go')
  frames(g.runtime, 3)
  assert.equal(g.runtime.root.world.flow.state, 'b')
  assert.equal(g.engine.objects.size, count, '布景没有重建')
  assert.equal(g.engine.programs.size, progs)
  // 去掉布景：对象回到只剩 marker 的数量
  g.files.set(GAME, source({ scenery: false }))
  const reply = await run(g.runtime, g.pot.devtools.handle({ id: 1, type: 'changed', paths: [GAME] }))
  assert.equal(reply.data.ok, true, reply.data.error)
  frames(g.runtime, 2)
  assert.equal(named(g, /^(apron|sea|rain|rain-splash|gulls)$|^level|^relay-light|^orig-light/).length, 0, '布景对象全部销毁')
  // 加回来：材质与着色器按 World 缓存，不重复编译
  g.files.set(GAME, source())
  const again = await run(g.runtime, g.pot.devtools.handle({ id: 1, type: 'changed', paths: [GAME] }))
  assert.equal(again.data.ok, true, again.data.error)
  frames(g.runtime, 2)
  assert.equal(named(g, /^level:/).length, statics)
  assert.equal(g.engine.objects.size, count)
  assert.deepEqual(errors(g), [])
})

test('harborLevel：雨幕与地坪跟随 weather（雨量 × 4/3、湿度 ÷ 0.85），改天气随之变化，没有天气时是干的', async () => {
  const g = await start({ weather: "{ rain: 0.45, wetness: 0.85 }" })
  assert.deepEqual(errors(g), [])
  const apron = () => named(g, /^apron$/)[0].gfx.uniforms
  const rain = () => named(g, /^rain$/)[0]
  const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-3, `${msg} 期望 ${b}，实际 ${a}`)
  near(apron().uRain[0], 0.6, '黄昏暴雨：地坪雨量与迁移前相同')
  near(apron().uWetG[0], 1, '黄昏暴雨：地坪湿度与迁移前相同')
  near(rain().gfx.uniforms.uRain[0], 0.6, '雨幕')
  const me = g.runtime.root.world.query().find((e) => e.b.weather).b.weather
  me.rain = 0.9
  me.wetness = 0.425
  frames(g.runtime, 2)
  near(apron().uRain[0], 1, '雨量不超过 1')
  near(apron().uWetG[0], 0.5, '湿度')
  frames(g.runtime, 600)
  near(rain().gfx.uniforms.uRain[0], 1, '雨幕缓动到新雨量')
  // 去掉天气：干
  g.files.set(GAME, source())
  const reply = await run(g.runtime, g.pot.devtools.handle({ id: 1, type: 'changed', paths: [GAME] }))
  assert.equal(reply.data.ok, true, reply.data.error)
  frames(g.runtime, 2)
  near(apron().uRain[0], 0, '没有天气时地坪不下雨')
  near(apron().uWetG[0], 0, '没有天气时地坪干')
  frames(g.runtime, 600)
  assert.equal(rain().active, false, '雨幕停了就隐藏')
  assert.deepEqual(errors(g), [])
})
