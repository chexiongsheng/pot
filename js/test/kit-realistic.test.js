const test = require('node:test')
const assert = require('node:assert/strict')
const { startGame, frames, run } = require('./helpers')

/** 004 第 17.8 节：realistic 套件（atmosphere、surface、闪电） */

const GAME = 'src/plugins/game.tsx'

function gameSource(env, extra = '') {
  return `import { defineGame } from '@pot/core'
import realistic from '@pot/kit/realistic'
const g = globalThis as any
g.__hits ??= []
export default defineGame({
  kits: [realistic],
  scene: () => <>
    ${env === null ? '' : `<entity key="env" atmosphere={${env}} />`}
    <rule on="lightning" do={(w, p) => g.__hits.push([p.power, p.delay, p.entity.id])} />
    ${extra}
  </>,
})
`
}

function files(env, extra) {
  return new Map([
    ['manifest.json', JSON.stringify({ id: 'realistic.test', plugins: ['game'] })],
    [GAME, gameSource(env, extra)],
  ])
}

async function start(env, extra, { errors = true } = {}) {
  globalThis.__hits = []
  const g = await startGame(files(env, extra))
  assert.deepEqual(g.runtime.failures, [])
  frames(g.runtime, 1)
  const logged = g.host.logs.filter((l) => l.level === 'error').map((l) => l.text)
  if (errors) assert.deepEqual(logged, [])
  return g
}

const suns = (engine) => [...engine.objects.values()].filter((o) => o.light === 'directional')
const env = (runtime) => runtime.root.world.query().find((e) => e.b.atmosphere)
const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-6, `${msg ?? ''} 期望 ${b}，实际 ${a}`)

test('atmosphere：预设与分节覆盖，rain 简写，平面反射', async () => {
  const { engine } = await start(`{ preset: 'overcast', fog: { density: 0.02 }, rain: 0.4, weather: { puddles: 0.1 }, reflection: 0.5 }`)
  const [sun] = suns(engine)
  assert.equal(suns(engine).length, 1)
  near(sun.intensity, 1.1, '阴天主光')
  near(engine.fogState.density, 0.02, '雾覆盖')
  near(engine.renderState.fog.height, 0.04, '雾其余字段来自预设')
  near(engine.renderState.sky.clouds, 1)
  near(engine.renderState.post.saturation, -18)
  const wt = engine.renderState.weather
  near(wt.rain, 0.4)
  near(wt.wetness, 0.8)
  near(wt.puddles, 0.1, 'weather 节显式字段优先于 rain 简写')
  assert.ok(engine.renderState.reflection.enabled, '反射开启')
  near(engine.renderState.reflection.scale, 0.5)
  near(engine.ambientState.reflection, 0.6)
})

test('atmosphere：缺省为黄昏、不下雨；未知预设报错', async () => {
  const { engine } = await start('true')
  near(suns(engine)[0].intensity, 3.8)
  near(engine.renderState.weather.rain, 0)
  near(engine.renderState.sky.sunSize, 0.018)
  globalThis.__hits = []
  const bad = await startGame(files(`{ preset: 'noon' }`))
  frames(bad.runtime, 1)
  const text = bad.host.logs.map((l) => l.text).join('\n')
  assert.match(text, /未知的预设 noon/)
})

test('atmosphere：闪电按 w.rand 排期、发事件，闪光提亮环境光后恢复；active 为 false 时不打', async () => {
  const { runtime, engine } = await start(`{ lightning: { first: [1, 1], every: [2, 2], power: [0.8, 0.8], flash: 1 } }`)
  const base = engine.ambientState.sky.slice()
  frames(runtime, 58)
  assert.equal(globalThis.__hits.length, 0)
  frames(runtime, 4)
  assert.equal(globalThis.__hits.length, 1)
  const [power, delay, id] = globalThis.__hits[0]
  near(power, 0.8)
  assert.ok(delay >= 0.5 + 0.2 * 2 && delay <= 0.5 + 0.2 * 2 + 0.6, `delay ${delay}`)
  assert.equal(id, env(runtime).id)
  assert.equal(env(runtime).b.atmosphere.strikes, 1)
  assert.ok(engine.ambientState.sky[0] > base[0] * 1.2, '闪光时环境光变亮')
  frames(runtime, 60)
  assert.deepEqual(engine.ambientState.sky, base, '闪光结束后恢复')
  const next = env(runtime).b.atmosphere.next
  assert.ok(next > 0.9 && next <= 1, `下一次按 every 排期，剩余 ${next}`)
  env(runtime).b.atmosphere.active = false
  frames(runtime, 180)
  assert.equal(globalThis.__hits.length, 1)
  env(runtime).b.atmosphere.active = true
  frames(runtime, 62)
  assert.equal(globalThis.__hits.length, 2)
})

test('atmosphere：去掉后销毁主光、关雾、雨量归零、关反射', async () => {
  const g = await start(`{ rain: 1, reflection: 0.5 }`)
  assert.equal(suns(g.engine).length, 1)
  g.files.set(GAME, gameSource(null))
  const reply = await run(g.runtime, g.pot.devtools.handle({ id: 1, type: 'changed', paths: [GAME] }))
  assert.equal(reply.ok, true, reply.error)
  assert.equal(reply.data.ok, true, reply.data.error)
  frames(g.runtime, 2)
  assert.equal(suns(g.engine).length, 0)
  assert.equal(g.engine.fogState.density, 0)
  near(g.engine.renderState.weather.rain, 0)
  near(g.engine.renderState.weather.wetness, 0)
  assert.ok(!g.engine.renderState.reflection.enabled, '反射关闭')
})

test('surface：材质预设与覆盖，未知预设报错', async () => {
  const { engine, host } = await start(null, `
    <entity key="a" surface={{ kind: 'plane', material: 'metal' }} />
    <entity key="b" surface={{ kind: 'cube', color: '#ff0000', material: { metallic: 0.25, smoothness: 0.5 } }} />
    <entity key="c" surface={{ material: 'gold' }} />`, { errors: false })
  const objs = [...engine.objects.values()]
  const a = objs.find((o) => o.shape === 'plane')
  near(a.metallic, 1)
  near(a.smoothness, 0.6)
  const b = objs.find((o) => o.shape === 'cube' && o.metallic !== undefined && Math.abs(o.metallic - 0.25) < 1e-6)
  assert.ok(b, '对象参数材质')
  near(b.smoothness, 0.5)
  assert.ok(b.color[0] > 0.9 && b.color[1] < 0.1, '显式颜色')
  assert.match(host.logs.map((l) => l.text).join('\n'), /未知的材质预设 gold/)
})
