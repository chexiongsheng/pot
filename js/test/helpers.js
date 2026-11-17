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
