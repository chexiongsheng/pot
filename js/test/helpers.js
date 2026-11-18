/**
 * 测试辅助：加载构建产物 dist/core.cjs、dist/devtools.cjs 到全局（与 Unity 中相同的方式），
 * 并提供内存版 Host / Engine。
 */
const fs = require('fs')
const path = require('path')
const vm = require('vm')

const dist = path.resolve(__dirname, '../dist')

function loadPot() {
  if (!globalThis.pot) {
    vm.runInThisContext(fs.readFileSync(path.join(dist, 'core.cjs'), 'utf8'), { filename: 'pot/core.cjs' })
    vm.runInThisContext(fs.readFileSync(path.join(dist, 'devtools.cjs'), 'utf8'), { filename: 'pot/devtools.cjs' })
  }
  return globalThis.pot
}

class MockEngine {
  constructor() {
    this.nextId = 2
    this.objects = new Map()
    this.camera = { id: 1, name: 'Main Camera', position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] }
    this.axes = { move: [0, 0], look: [0, 0] }
    this.keys = new Set()
    this.background = null
  }
  _get(id) {
    if (id === 1) return this.camera
    const obj = this.objects.get(id)
    if (!obj) throw new Error(`对象 ${id} 不存在`)
    return obj
  }
  spawn(shape, name, parent) {
    const id = this.nextId++
    this.objects.set(id, { id, shape, name, parent, position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], localPosition: [0, 0, 0], color: null, active: true })
    return id
  }
  destroy(id) { this.objects.delete(id) }
  exists(id) { return id === 1 || this.objects.has(id) }
  setVec(id, prop, x, y, z) { this._get(id)[prop] = [x, y, z] }
  getVec(id, prop) { return [...this._get(id)[prop]] }
  setColor(id, r, g, b, a) { this._get(id).color = [r, g, b, a] }
  setActive(id, active) { this._get(id).active = active }
  lookAt(id, x, y, z) { this._get(id).target = [x, y, z] }
  light(id, type, intensity) { Object.assign(this._get(id), { light: type, intensity }) }
  cameraId() { return 1 }
  setBackground(r, g, b) { this.background = [r, g, b] }
  axis(name) { return this.axes[name] ?? [0, 0] }
  key(name, mode) { return mode === 0 ? this.keys.has(name) : false }
  count() { return this.objects.size }
  material(id, mode, castShadows) { const o = this._get(id); if (mode) o.mode = mode; if (castShadows >= 0) o.shadows = !!castShadows }
  surface(id, metallic, smoothness) { const o = this._get(id); if (metallic >= 0) o.metallic = metallic; if (smoothness >= 0) o.smoothness = smoothness }
  emission(id, r, g, b) { this._get(id).emission = [r, g, b] }
  collider(id, enabled) { this._get(id).collider = enabled }
  layer(id, layer) { this._get(id).layer = layer }
  raycast() { return this.nextHit ?? null }
  view(fov, near, far) { if (fov > 0) this.camera.fov = fov; if (near > 0) this.camera.near = near; if (far > 0) this.camera.far = far }
  fog(r, g, b, density) { this.fogState = { color: [r, g, b], density } }
  ambient(r, g, b, reflection) { this.ambientState = { color: [r, g, b], reflection } }
  lightOptions(id, spotAngle, shadows) { Object.assign(this._get(id), { spotAngle, lightShadows: shadows }) }
  lightIntensity(id, intensity) { this._get(id).intensity = intensity }
  cursor(locked) { this.locked = locked }
  cursorLocked() { return !!this.locked }
  mouse() { return this.mousePos ?? [0, 0] }
  screen() { return [1280, 720] }
  wheel() { return 0 }
  focused() { return true }
  uiSubmit(list) { this.ui = list; this.uiSubmits = (this.uiSubmits ?? 0) + 1 }
  uiMeasure(text, size) { return [String(text).length * size * 0.6, size * 1.3] }
  audioClip(name, rate, channels, data) { (this.clips ??= new Map()).set(name, { rate, channels, bytes: data.length }); return true }
  audioHas(name) { return !!this.clips?.has(name) }
  audioPlay(name, volume) { (this.played ??= []).push({ name, volume }) }
  audioLoop(name) { this.loops ??= new Map(); const id = (this.loopId = (this.loopId ?? 0) + 1); this.loops.set(id, name); return id }
  audioSetLoop() {}
  audioStop(handle) { this.loops?.delete(handle) }
  audioVolume(v) { this.volume = v }
  audioPause(p) { this.audioPaused = p }
  texture(data, width, height, linear) { this.textures ??= new Map(); const id = (this.texId = (this.texId ?? 0) + 1); this.textures.set(id, { bytes: data.byteLength, width, height, linear }); return id }
  destroyTexture(id) { this.textures?.delete(id) }
  textTexture(json) { this.textures ??= new Map(); const id = (this.texId = (this.texId ?? 0) + 1); this.textures.set(id, { text: JSON.parse(json) }); return id }
  mesh(name, positions, normals, uvs, colors, indices) { (this.meshes ??= new Map()).set(name, { vertices: positions.byteLength / 12, indices: indices.byteLength / 4 }); return positions.byteLength / 12 }
  matTexture(id, slot, tex) { const o = this._get(id); (o.textures ??= {})[slot] = tex }
  matFloat(id, prop, value) { const o = this._get(id); (o.props ??= {})[prop] = value }
  matVector(id, prop, x, y, z, w) { const o = this._get(id); (o.props ??= {})[prop] = [x, y, z, w] }
  ambientTrilight(sr, sg, sb, er, eg, eb, gr, gg, gb, reflection) { this.ambientState = { sky: [sr, sg, sb], equator: [er, eg, eb], ground: [gr, gg, gb], reflection } }
  render(kind, json) { (this.renderState ??= {})[kind] = Object.assign((this.renderState[kind] ?? {}), JSON.parse(json)); return '' }
  burst(json) { (this.bursts ??= []).push(JSON.parse(json)) }
  gfxBackend() { return 'mock' }
  gfxProgram(name, vs, fs) {
    this.programs ??= new Map()
    // 模拟编译：片元源码含 COMPILE_ERROR 时报错（glslang 格式，文件号:行号）
    const lines = fs.split('\n')
    let file = 0, row = 0
    for (const line of lines) {
      const m = /^#line (\d+) (\d+)/.exec(line)
      if (m) { row = Number(m[1]); file = Number(m[2]); continue }
      if (line.includes('COMPILE_ERROR')) return `[fragment] ERROR: ${file}:${row}: 'COMPILE_ERROR' : undeclared identifier`
      row++
    }
    this.programs.set(name, { vs, fs, version: (this.programs.get(name)?.version ?? 0) + 1 })
    return ''
  }
  gfxDestroyProgram(name) { this.programs?.delete(name) }
  gfxBind(id, program, flags, queue, shadows) { const o = this._get(id); o.gfx = program ? { program, flags, queue, shadows, uniforms: {}, textures: {} } : undefined }
  gfxUniform(id, name, n, x, y, z, w) { const g = this._gfx(id); if (g) g.uniforms[name] = [x, y, z, w].slice(0, n) }
  gfxUniformArray(id, name, data) { const g = this._gfx(id); if (g) g.uniforms[name] = [...new Float32Array(data)] }
  gfxTexture(id, name, tex) { const g = this._gfx(id); if (g) g.textures[name] = tex }
  _gfx(id) { return id < 0 ? this.bakeBinds?.get(id) : this._get(id).gfx }
  gfxBakeBegin() { this.bakeBinds ??= new Map(); const id = -((this.bakeId = (this.bakeId ?? 0) + 1)); this.bakeBinds.set(id, { uniforms: {}, textures: {} }); return id }
  gfxBake(bind, program, width, height, targets, blend) {
    const g = this.bakeBinds?.get(bind)
    this.bakeBinds?.delete(bind)
    if (!g) return '!无效的烘焙句柄'
    if (!this.programs?.has(program)) return '!程序不存在：' + program
    this.textures ??= new Map()
    const ids = targets.split(';').map((t) => {
      const id = (this.texId = (this.texId ?? 0) + 1)
      this.textures.set(id, { bake: { program, width, height, target: t, blend, uniforms: g.uniforms, textures: g.textures } })
      return id
    })
    ;(this.bakes ??= []).push({ program, width, height, targets, blend, ...g })
    return ids.join(',')
  }
  byName(name) { return [...this.objects.values()].filter((o) => o.name === name) }
}

function createHost(files = new Map()) {
  const engine = new MockEngine()
  const logs = []
  const sent = []
  const host = {
    platform: 'node',
    files,
    logs,
    sent,
    engine,
    log(level, text) {
      logs.push({ level, text })
      if (process.env.POT_LOG) console.log(`[${level}] ${text}`)
    },
    readText(p) { return files.has(p) ? files.get(p) : null },
    writeText(p, content) {
      if (content === null) files.delete(p)
      else files.set(p, content)
    },
    gc() { if (globalThis.gc) globalThis.gc() },
    send(message) { sent.push(JSON.parse(message)) },
  }
  return host
}

const helloDir = path.resolve(__dirname, '../../games/hello')

/** 读取游戏目录全部文件到 Map（与 Runner 读游戏目录相同的视图） */
function readGameFiles(dir) {
  const { walk } = require('../devserver/builder')
  return new Map(walk(dir).map((rel) => [rel, fs.readFileSync(path.join(dir, rel), 'utf8')]))
}

/** 启动游戏；默认带源码加载器（Runner 的行为），options.loader === false 时只读 bundle（发布包的行为） */
async function startGame(files, options = {}) {
  const pot = loadPot()
  const host = createHost(files)
  const { loader, ...rest } = options
  const runtime = await pot.createRuntime(host, { ...rest, loader: loader === false ? undefined : pot.devtools.createLoader(host) })
  pot.devtools.attach(runtime)
  await runtime.start()
  return { pot, host, runtime, engine: host.engine, files }
}

async function startHello(options) {
  return startGame(readGameFiles(helloDir), options)
}

function frames(runtime, n, dt = 1 / 60) {
  for (let i = 0; i < n; i++) runtime.tick(dt)
}

/** 推进若干帧并让出事件循环（泄漏检查、异步 apply 需要） */
async function run(runtime, promise, dt = 1 / 60) {
  let done = false
  let value, error
  promise.then((v) => { done = true; value = v }, (e) => { done = true; error = e })
  for (let i = 0; i < 1000 && !done; i++) {
    await new Promise((r) => setImmediate(r))
    runtime.tick(dt)
  }
  if (!done) throw new Error('超时')
  if (error) throw error
  return value
}

/** 简单 CJS 单元源码（测试用） */
function unit(name, body) {
  return `"use strict";\nexports.name = ${JSON.stringify(name)};\nexports.apply = function (ctx, config) {\n${body}\n};\n`
}

module.exports = { loadPot, createHost, startGame, startHello, readGameFiles, frames, run, unit, helloDir, MockEngine }
