/**
 * Web 宿主的渲染配置（004 第 20.3 节 web-3）：web/render.ts 照 PotRender.Configure 的分发、局部覆盖与缺省值，
 * 以及天空球谐（CPU 版天空辐射）。
 */
const test = require('node:test')
const assert = require('node:assert/strict')
const { loadWebPot } = require('./helpers')

const web = () => loadWebPot().web
const near = (a, b, eps = 1e-5) => Math.abs(a - b) <= eps

test('configure：未知 kind、JSON 解析失败、refresh', () => {
  const r = new (web().WebRenderConfig)()
  assert.equal(r.configure('what', '{}'), '未知的渲染配置：what')
  assert.match(r.configure('sky', '{oops'), /^JSON 解析失败：/)
  assert.equal(r.sky, null)
  const v = r.envVersion
  assert.equal(r.configure('refresh', ''), '')
  assert.equal(r.envVersion, v + 1)
})

test('sky：首次用 PotSky 缺省值，缺省字段保持，颜色不足 3 个分量用回退色', () => {
  const W = web()
  const r = new W.WebRenderConfig()
  r.configure('sky', '{}')
  assert.deepEqual(r.sky, W.defaultSky())
  // 缺省 reflection（-1）也建探针，大小 128
  assert.deepEqual(r.probe, { size: 128 })
  r.configure('sky', JSON.stringify({ zenith: [0.1, 0.2, 0.3], clouds: 0.2 }))
  assert.deepEqual(r.sky.zenith, [0.1, 0.2, 0.3, 1])
  assert.equal(r.sky.clouds, 0.2)
  assert.equal(r.sky.sunSize, 0.02)
  r.configure('sky', JSON.stringify({ zenith: [1], horizon: [], ground: [0], cloudColor: [0, 0], horizonAway: [1, 2] }))
  assert.deepEqual(r.sky.zenith, [0, 0, 1, 1])
  assert.deepEqual(r.sky.horizon, [1, 1, 1, 1])
  assert.deepEqual(r.sky.horizonAway, [1, 1, 1, 1])
  assert.deepEqual(r.sky.ground, [0.5, 0.5, 0.5, 1])
  assert.deepEqual(r.sky.cloudColor, [0.5, 0.5, 0.5, 1])
  // sun 存成线性 HDR：大于 1 的分量按 2.2 次幂
  r.configure('sky', JSON.stringify({ sun: [2, 1, 0] }))
  assert.ok(near(r.sky.sun[0], Math.pow(2, 2.2)) && near(r.sky.sun[1], 1) && r.sky.sun[2] === 0)
})

test('sky：探针尺寸取 2 的幂并夹到 16..1024，reflection 0 销毁；ambient 与反射强度', () => {
  const W = web()
  const r = new W.WebRenderConfig()
  let amb = 0
  let ri = -1
  r.onSkyAmbient = () => amb++
  r.onReflectionIntensity = (v) => (ri = v)
  r.configure('sky', JSON.stringify({ reflectionSize: 100 }))
  assert.deepEqual(r.probe, { size: 128 })
  r.configure('sky', JSON.stringify({ reflectionSize: 5000 }))
  assert.deepEqual(r.probe, { size: 1024 })
  r.configure('sky', JSON.stringify({ reflectionSize: 3 }))
  assert.deepEqual(r.probe, { size: 16 })
  r.configure('sky', JSON.stringify({ reflection: 0 }))
  assert.equal(r.probe, null)
  assert.equal(amb, 0)
  r.configure('sky', JSON.stringify({ ambient: 1, reflectionIntensity: 3 }))
  assert.equal(amb, 1)
  assert.equal(ri, 1)
  assert.ok(r.skyAmbient)
  // ambient 保持：下次 sky 仍设环境光
  r.configure('sky', '{}')
  assert.equal(amb, 2)
  assert.equal(W.closestPowerOfTwo(48), 64)
  assert.equal(W.closestPowerOfTwo(40), 32)
})

test('fog：颜色与密度写进 scene.env.fog（与 scene.fog 共用），高度、基准、太阳散射留在 render.fog', () => {
  const s = new (web().WebScene)()
  assert.equal(s.render.configure('fog', JSON.stringify({ color: [0.2, 0.3, 0.4], density: 0.05, height: 0.3, base: 2, sun: 0.5 })), '')
  assert.deepEqual([...s.env.fog.color].slice(0, 3), [0.2, 0.3, 0.4])
  assert.equal(s.env.fog.density, 0.05)
  assert.deepEqual(s.render.fog, { height: 0.3, base: 2, sun: 0.5 })
  s.render.configure('fog', JSON.stringify({ density: -1, height: -2 }))
  assert.deepEqual([...s.env.fog.color].slice(0, 3), [0.2, 0.3, 0.4])
  assert.equal(s.env.fog.density, 0)
  assert.equal(s.render.fog.height, 0)
  assert.equal(s.render.fog.base, 2)
})

test('sky：ambient 把环境光改为天空，reflectionIntensity 写入 env.ambient.reflection', () => {
  const s = new (web().WebScene)()
  s.render.configure('sky', JSON.stringify({ ambient: 1, reflectionIntensity: 0.4 }))
  assert.equal(s.env.ambient.mode, 'sky')
  assert.equal(s.env.ambient.reflection, 0.4)
})

test('weather：夹取、needRain、drops 缺省与夹取', () => {
  const r = new (web().WebRenderConfig)()
  r.configure('weather', JSON.stringify({ wetness: 2, puddles: -1 }))
  assert.equal(r.wetness, 1)
  assert.equal(r.puddles, 0)
  // 没给 rain 且雨对象未创建：不建
  assert.equal(r.rainCreated, false)
  assert.equal(r.rainActive, false)
  r.configure('weather', JSON.stringify({ rain: 0.5, wind: [3, 1], speed: 20 }))
  assert.ok(r.rainCreated && r.rainActive)
  assert.equal(r.rain, 0.5)
  assert.equal(r.rainCfg.drops, 8000)
  assert.equal(r.rainCfg.intensity, 0.5)
  assert.deepEqual(r.rainCfg.wind, [3, 1])
  assert.equal(r.rainCfg.speed, 20)
  assert.deepEqual(r.rainCfg.box, [28, 18, 28])
  // 没给 rain、雨已存在：继续应用其他参数
  r.configure('weather', JSON.stringify({ drops: 10, length: 2 }))
  assert.equal(r.rainCfg.drops, 100)
  assert.equal(r.rainCfg.length, 2)
  r.configure('weather', JSON.stringify({ drops: 99999 }))
  assert.equal(r.rainCfg.drops, 60000)
  // rain 0：停雨，直接返回，不应用其他参数
  r.configure('weather', JSON.stringify({ rain: 0, speed: 1 }))
  assert.equal(r.rainActive, false)
  assert.equal(r.rain, 0)
  assert.equal(r.rainCfg.speed, 20)
})

test('reflection：启用、局部覆盖、scale 夹取与禁用', () => {
  const r = new (web().WebRenderConfig)()
  r.configure('reflection', JSON.stringify({ height: 0.1, shadows: 1 }))
  assert.deepEqual(r.planar, { enabled: true, height: 0.1, scale: 0.5, exclude: 0, shadows: true })
  r.configure('reflection', JSON.stringify({ scale: 5, exclude: 4 }))
  assert.deepEqual(r.planar, { enabled: true, height: 0.1, scale: 1, exclude: 4, shadows: true })
  r.configure('reflection', JSON.stringify({ enabled: 0 }))
  assert.equal(r.planar.enabled, false)
  assert.equal(r.planar.shadows, false)
  // 重新启用时 shadows 缺省 false
  r.configure('reflection', '{}')
  assert.equal(r.planar.enabled, true)
  assert.equal(r.planar.shadows, false)
  r.configure('reflection', JSON.stringify({ scale: 0 }))
  assert.equal(r.planar.enabled, false)
})

test('quality：夹取，冷重启不复位', () => {
  const r = new (web().WebRenderConfig)()
  r.configure('quality', JSON.stringify({ renderScale: 9, msaa: 3, cascades: 7, shadowResolution: 1000, hdr: 0, shadowDistance: -5 }))
  assert.deepEqual(r.quality, { renderScale: 2, shadowDistance: 0, msaa: 2, hdr: false, cascades: 4, shadowResolution: 1024 })
  r.configure('quality', JSON.stringify({ renderScale: 0.1, msaa: 16 }))
  assert.equal(r.quality.renderScale, 0.25)
  assert.equal(r.quality.msaa, 8)
  r.reset()
  assert.equal(r.quality.msaa, 8)
})

test('post：首次缺省 ACES，enabled 缺省为 true，冷重启后关闭', () => {
  const r = new (web().WebRenderConfig)()
  assert.equal(r.post.enabled, false)
  r.configure('post', JSON.stringify({ exposure: 0.5, filter: [1, 0.9, 0.8] }))
  assert.equal(r.post.enabled, true)
  assert.equal(r.post.tonemap, 2)
  assert.equal(r.post.exposure, 0.5)
  assert.deepEqual(r.post.filter, [1, 0.9, 0.8, 1])
  r.configure('post', JSON.stringify({ tonemap: 1, enabled: 0, ao: -1 }))
  assert.equal(r.post.tonemap, 1)
  assert.equal(r.post.enabled, false)
  assert.equal(r.post.ao, 0)
  assert.equal(r.post.exposure, 0.5)
  r.configure('post', '{}')
  assert.equal(r.post.tonemap, 1)
  assert.equal(r.post.enabled, true)
  r.reset()
  assert.equal(r.post.enabled, false)
  assert.equal(r.post.tonemap, 0)
  r.configure('post', '{}')
  assert.equal(r.post.tonemap, 2)
})

test('reset：天空、探针、天气、平面反射复位，envVersion 加一', () => {
  const r = new (web().WebRenderConfig)()
  r.configure('sky', JSON.stringify({ ambient: 1 }))
  r.configure('fog', JSON.stringify({ height: 1 }))
  r.configure('weather', JSON.stringify({ rain: 1, wetness: 1 }))
  r.configure('reflection', '{}')
  const v = r.envVersion
  r.reset()
  assert.equal(r.sky, null)
  assert.equal(r.probe, null)
  assert.equal(r.skyAmbient, false)
  assert.equal(r.fog.height, 0)
  assert.equal(r.wetness, 0)
  assert.equal(r.rainCreated, false)
  assert.equal(r.planar.enabled, false)
  assert.equal(r.envVersion, v + 1)
})

test('skySH：常量天空的球谐环境光等于该常量，evalSH 各方向一致', () => {
  const W = web()
  const sky = W.defaultSky()
  const c = [0.5, 0.5, 0.5, 1]
  sky.zenith = c
  sky.horizon = c
  sky.horizonAway = c
  sky.ground = c
  sky.clouds = 0
  sky.sunGlow = 0
  sky.sun = [0, 0, 0]
  const inp = { sky, sunDir: [0, 1, 0], fogColor: [0, 0, 0], fogDensity: 0, fogSun: 0, sunColor: [0, 0, 0], time: 0 }
  const L = W.srgbToLinear(0.5)
  const one = W.skyRadiance(inp, 0.3, 0.5, -0.2)
  assert.ok(near(one[0], L, 1e-6), String(one))
  const sh = W.skySH(inp)
  for (const d of [[0, 1, 0], [0, -1, 0], [1, 0, 0], [0, 0, -1], [0.6, 0.0, 0.8]]) {
    const e = W.evalSH(sh, d[0], d[1], d[2])
    for (let i = 0; i < 3; i++) assert.ok(near(e[i], L, 2e-3), `${d} → ${e}`)
  }
})

test('skySH：天顶亮、地面暗时向上的环境光更亮', () => {
  const W = web()
  const sky = W.defaultSky()
  sky.zenith = [1, 1, 1, 1]
  sky.horizon = sky.horizonAway = [0.5, 0.5, 0.5, 1]
  sky.ground = [0, 0, 0, 1]
  sky.clouds = 0
  const inp = { sky, sunDir: [0, 1, 0], fogColor: [0, 0, 0], fogDensity: 0, fogSun: 0, sunColor: [0, 0, 0], time: 0 }
  const sh = W.skySH(inp)
  assert.ok(W.evalSH(sh, 0, 1, 0)[0] > W.evalSH(sh, 0, -1, 0)[0] + 0.2)
})

test('web 宿主：engine.render 交给 scene.render，冷重启复位', () => {
  const W = web()
  const host = W.createWebHost({
    files: { 'manifest.json': '{"id":"t"}' },
    ui: { submit() {}, measure: () => [0, 0] },
    platform: { screen: () => [1, 1], focused: () => true, cursor() {}, cursorLocked: () => false },
  })
  assert.equal(host.engine.render('sky', '{"clouds":0.1}'), '')
  assert.equal(host.scene.render.sky.clouds, 0.1)
  assert.equal(host.engine.render('nope', '{}'), '未知的渲染配置：nope')
  assert.equal(host.unsupported.has('render'), false)
  host.scene.clear()
  assert.equal(host.scene.render.sky, null)
})
