const test = require('node:test')
const assert = require('node:assert/strict')
const { startGame, frames, run } = require('./helpers')

/** 004 第 17.8 节：realistic 套件（atmosphere、weather、surface、beacon） */

const GAME = 'src/plugins/game.tsx'

function gameSource(env, extra = '', head = '') {
  return `import { defineGame } from '@pot/core'
import realistic from '@pot/kit/realistic'
const g = globalThis as any
g.__hits ??= []
export default defineGame({
  kits: [realistic],${head}
  scene: () => <>
    ${env === null ? '' : `<entity key="env" keep atmosphere={${env}} />`}
    <rule on="lightning" do={(w, p) => g.__hits.push([p.power, p.delay, p.entity.id])} />
    ${extra}
  </>,
})
`
}

const weatherEntity = (props) => `<entity key="storm" keep weather={${props}} />`

function files(env, extra, head) {
  return new Map([
    ['manifest.json', JSON.stringify({ id: 'realistic.test', plugins: ['game'] })],
    [GAME, gameSource(env, extra, head)],
  ])
}

async function start(env, extra, { errors = true, head } = {}) {
  globalThis.__hits = []
  const g = await startGame(files(env, extra, head))
  assert.deepEqual(g.runtime.failures, [])
  frames(g.runtime, 1)
  const logged = g.host.logs.filter((l) => l.level === 'error').map((l) => l.text)
  if (errors) assert.deepEqual(logged, [])
  return g
}

const suns = (engine) => [...engine.objects.values()].filter((o) => o.light === 'directional')
const storm = (runtime) => runtime.root.world.query().find((e) => e.b.weather)
const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-6, `${msg ?? ''} 期望 ${b}，实际 ${a}`)
const loopsNamed = (engine, name) => [...(engine.loops ?? new Map()).entries()].filter(([, n]) => n === name).map(([id]) => engine.loopVolumes.get(id))

test('atmosphere：预设与分节覆盖，平面反射；weather：湿度缺省跟雨量，显式字段优先', async () => {
  const { engine } = await start(`{ preset: 'overcast', fog: { density: 0.02 }, reflection: 0.5 }`, weatherEntity(`{ rain: 0.4, puddles: 0.1 }`))
  const [sun] = suns(engine)
  assert.equal(suns(engine).length, 1)
  near(sun.intensity, 1.1, '阴天主光')
  near(engine.fogState.density, 0.02, '雾覆盖')
  near(engine.renderState.fog.height, 0.04, '雾其余字段来自预设')
  near(engine.renderState.sky.clouds, 1)
  near(engine.renderState.post.saturation, -18)
  const wt = engine.renderState.weather
  near(wt.rain, 0.4)
  near(wt.wetness, 0.8, '湿度缺省为 rain × 2')
  near(wt.puddles, 0.1, '显式积水优先')
  assert.ok(engine.renderState.reflection.enabled, '反射开启')
  near(engine.renderState.reflection.scale, 0.5)
  near(engine.ambientState.reflection, 0.6)
})

test('atmosphere：缺省为黄昏、不碰天气；未知预设报错', async () => {
  const { engine } = await start('true')
  near(suns(engine)[0].intensity, 3.8)
  near(engine.renderState.weather?.rain ?? 0, 0, '没有 weather 不下雨')
  near(engine.renderState.sky.sunSize, 0.018)
  globalThis.__hits = []
  const bad = await startGame(files(`{ preset: 'noon' }`))
  frames(bad.runtime, 1)
  const text = bad.host.logs.map((l) => l.text).join('\n')
  assert.match(text, /未知的预设 noon/)
})

test('weather：闪电按 w.rand 排期、发事件，atmosphere 按闪光提亮环境光后恢复；active 为 false 时不打', async () => {
  const { runtime, engine } = await start('true', weatherEntity(`{ lightning: { first: [1, 1], every: [2, 2], power: [0.8, 0.8], flash: 1, sound: false } }`))
  const base = engine.ambientState.sky.slice()
  frames(runtime, 58)
  assert.equal(globalThis.__hits.length, 0)
  frames(runtime, 4)
  assert.equal(globalThis.__hits.length, 1)
  const [power, delay, id] = globalThis.__hits[0]
  near(power, 0.8)
  assert.ok(delay >= 0.5 + 0.2 * 2 && delay <= 0.5 + 0.2 * 2 + 0.6, `delay ${delay}`)
  assert.equal(id, storm(runtime).id)
  assert.equal(storm(runtime).b.weather.strikes, 1)
  assert.ok(engine.ambientState.sky[0] > base[0] * 1.2, '闪光时环境光变亮')
  frames(runtime, 60)
  assert.deepEqual(engine.ambientState.sky, base, '闪光结束后恢复')
  const next = storm(runtime).b.weather.next
  assert.ok(next > 0.9 && next <= 1, `下一次按 every 排期，剩余 ${next}`)
  storm(runtime).b.weather.active = false
  frames(runtime, 180)
  assert.equal(globalThis.__hits.length, 1)
  storm(runtime).b.weather.active = true
  frames(runtime, 62)
  assert.equal(globalThis.__hits.length, 2)
})

test('atmosphere 与 weather：去掉后销毁主光、关雾、关反射；雨量归零、雨声停', async () => {
  const g = await start(`{ reflection: 0.5 }`, weatherEntity(`{ rain: 1 }`))
  assert.equal(suns(g.engine).length, 1)
  assert.equal(loopsNamed(g.engine, 'saltline.rain').length, 1)
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
  assert.equal(loopsNamed(g.engine, 'saltline.rain').length, 0, '雨声停')
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

const QUALITY = `[
  { renderScale: 0.5, shadowDistance: 20, shadowResolution: 512, shadowCascades: 1, reflection: 0, drops: 100, ao: 0, antialias: 'none', reflectionShadows: false, bloom: false },
  { renderScale: 1, shadowDistance: 60, shadowResolution: 2048, shadowCascades: 4, reflection: 0.5, drops: 900, ao: 1, antialias: 'smaa', msaa: 4, reflectionShadows: true },
]`
const SET_Q = `<rule on="every" seconds={0.05} do={(w) => { if (w.vars.q !== undefined) w.vars.renderQuality = w.vars.q }} />`

async function startQuality(weatherProps) {
  const src = gameSource(`{ chain: {}, quality: ${QUALITY} }`, SET_Q + weatherEntity(weatherProps))
    .replace("import realistic from '@pot/kit/realistic'", "import realistic, { setPostValues, paintRain } from '@pot/kit/realistic'\n;(globalThis as any).__setPost = setPostValues\n;(globalThis as any).__paintRain = paintRain")
  globalThis.__hits = []
  const g = await startGame(new Map([['manifest.json', JSON.stringify({ id: 'realistic.test', plugins: ['game'] })], [GAME, src]]))
  assert.deepEqual(g.runtime.failures, [])
  frames(g.runtime, 2)
  assert.deepEqual(g.host.logs.filter((l) => l.level === 'error').map((l) => l.text), [])
  return g
}

test('atmosphere：后处理链（chain）、画质档位（quality 按 w.vars.renderQuality）、setPostValues；地图 paintRain', async () => {
  const g = await startQuality(`{ rain: 0.5 }`)
  const e = g.engine
  // 地图声明自己画雨（harbor 的雨幕）：weather 不撒内置雨滴
  globalThis.__paintRain(g.runtime.root.world, 'map', true)
  frames(g.runtime, 1)
  assert.ok(e.post && e.post.passes.length > 5, '建了后处理链')
  assert.equal(e.renderState.post?.tonemap, undefined, '有链时不设 URP 后处理的色调映射')
  // renderQuality 缺省 2，超出档位表取最后一档
  near(e.renderState.quality.renderScale, 1)
  assert.equal(e.renderState.quality.msaa, 4)
  assert.ok(e.renderState.reflection.enabled)
  assert.equal(e.renderState.weather.drops, 0, 'paintRain：地图自己画雨时内置雨滴为 0')
  near(e.renderState.weather.rain, 0.5)
  const w = g.runtime.root.world
  w.vars.q = 0
  frames(g.runtime, 6)
  near(e.renderState.quality.renderScale, 0.5)
  assert.ok(!e.renderState.reflection.enabled)
  assert.ok(e.postDisabled.size > 0, '关 bloom 的 pass')
  assert.equal(e.renderState.weather.drops, 0)
  // 地图撤销声明（例如退出）：内置雨滴回到画质档
  globalThis.__paintRain(w, 'map', false)
  frames(g.runtime, 1)
  assert.equal(e.renderState.weather.drops, 100)
  globalThis.__setPost(w, { uDamage: 0.7 })
  frames(g.runtime, 1)
  assert.ok(JSON.stringify(e.post).length > 0)
})

test('weather：地图不画雨时内置雨滴数跟 atmosphere 的画质档', async () => {
  const g = await startQuality(`{ rain: 0.5 }`)
  assert.equal(g.engine.renderState.weather.drops, 900)
  g.runtime.root.world.vars.q = 0
  frames(g.runtime, 6)
  assert.equal(g.engine.renderState.weather.drops, 100)
  near(g.engine.renderState.weather.rain, 0.5, '换档不改雨量')
})

test('weather：lightning 缺省按 delay 放雷声（强度大于 0.6 为近雷）', async () => {
  const { runtime, engine } = await start(null, weatherEntity(`{ lightning: { first: [0.1, 0.1], every: [100, 100], power: [0.9, 0.9] } }`))
  engine.played = []
  frames(runtime, 10)
  assert.equal(globalThis.__hits.length, 1)
  const delay = globalThis.__hits[0][1]
  // 闪电在第 6、7 步，雷声在其后 delay 秒
  frames(runtime, Math.floor(delay * 60) - 8)
  assert.equal(engine.played.filter((p) => p.name.startsWith('saltline.thunder')).length, 0, '未到 delay 不响')
  frames(runtime, 12)
  assert.deepEqual(engine.played.filter((p) => p.name.startsWith('saltline.thunder')).map((p) => p.name), ['saltline.thunderNear'])
})

test('weather：雨声音量为 sound × 雨量，叠加状态（暂停）时压低；不下雨或 sound 为 0 不放', async () => {
  const head = `\n  flow: { start: 'play', states: { play: { on: { pause: 'paused' } }, paused: { pause: true, on: { resume: 'play' } } } },`
  const g = await start(null, weatherEntity(`{ rain: 0.45 }`), { head })
  let [v] = loopsNamed(g.engine, 'saltline.rain')
  near(v, 0.78 * 0.45, '缺省 sound 0.78')
  const w = g.runtime.root.world
  w.emit('pause')
  frames(g.runtime, 2)
  ;[v] = loopsNamed(g.engine, 'saltline.rain')
  near(v, 0.78 * 0.45 * 0.23, '暂停时压低')
  w.emit('resume')
  frames(g.runtime, 2)
  ;[v] = loopsNamed(g.engine, 'saltline.rain')
  near(v, 0.78 * 0.45)
  const dry = await start(null, weatherEntity(`{ rain: 0 }`))
  assert.equal(loopsNamed(dry.engine, 'saltline.rain').length, 0)
  const mute = await start(null, weatherEntity(`{ rain: 1, sound: 0 }`))
  assert.equal(loopsNamed(mute.engine, 'saltline.rain').length, 0)
})

test('beacon：on 为假时隐藏，为真时显示并脉动；去掉后对象全部销毁', async () => {
  const g = await start(null, `<entity key="b" at={[3, 0, 4]} beacon={{ radius: 2, color: '#38e070' }} />`)
  const root = () => [...g.engine.objects.values()].find((o) => o.name === 'beacon')
  const base = g.engine.objects.size
  assert.ok(root(), '建了信标')
  assert.equal(root().active, false)
  const e = g.runtime.root.world.query().find((x) => x.b.beacon)
  e.b.beacon.on = true
  frames(g.runtime, 2)
  assert.equal(root().active, true)
  const ring = [...g.engine.objects.values()].find((o) => o.name === 'ring')
  assert.ok(ring.scale[0] >= 2 * 2 * 0.9 && ring.scale[0] <= 2 * 2 * 1.05)
  g.files.set(GAME, gameSource(null))
  const reply = await run(g.runtime, g.pot.devtools.handle({ id: 1, type: 'changed', paths: [GAME] }))
  assert.equal(reply.data.ok, true, reply.data.error)
  frames(g.runtime, 2)
  assert.equal(root(), undefined)
  assert.equal(g.engine.objects.size, base - 4)
})
