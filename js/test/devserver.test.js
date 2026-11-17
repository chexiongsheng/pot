/**
 * Dev Server 测试：Dev Server 只是 AI ↔ Runner 的通道。
 * 用 Node 版“假 Runner”（协议与 C# PotDevClient 一致）验证：open 转发、命令转发、reload 事件、静态文件与清单。
 */
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const http = require('http')
const os = require('os')
const path = require('path')
const WebSocket = require('ws')
const { DevServer } = require('../devserver/server')
const { client } = require('../devserver/client')
const { loadPot, createHost, readGameFiles, helloDir } = require('./helpers')

class FakeRunner {
  constructor(port) {
    this.pot = loadPot()
    this.port = port
    this.runtime = null
    this.opened = []
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(`ws://127.0.0.1:${this.port}/runner`)
      this.ws.on('open', () => {
        this.ws.send(JSON.stringify({ type: 'hello', platform: 'node', unity: 'fake', device: 'test', game: null }))
        resolve()
      })
      this.ws.on('error', reject)
      this.ws.on('message', (raw) => this.onMessage(JSON.parse(raw.toString())))
      this.timer = setInterval(() => this.runtime?.tick(1 / 60), 5)
    })
  }

  reply(id, ok, payload) {
    this.ws.send(JSON.stringify({ type: 'result', id, ok, ...(ok ? { data: payload } : { error: payload }) }))
  }

  async boot(files) {
    if (this.runtime) await this.runtime.stop()
    const host = createHost(files)
    host.send = (m) => this.ws.send(m)
    host.log = (level, text) => this.ws.send(JSON.stringify({ type: 'log', level, text }))
    this.host = host
    this.runtime = await this.pot.createRuntime(host, { loader: this.pot.devtools.createLoader(host) })
    this.pot.devtools.attach(this.runtime)
    await this.runtime.start()
    const game = { id: this.runtime.manifest.id, source: this.source, status: this.runtime.status }
    this.ws.send(JSON.stringify({ type: 'event', name: 'game', data: game }))
    return game
  }

  async onMessage(msg) {
    try {
      switch (msg.type) {
        case 'open': {
          this.opened.push(msg)
          // 与真 Runner 一致：本地存在 path 就直接读，否则走 files URL
          this.source = msg.path
          this.files = readGameFiles(msg.path)
          return this.reply(msg.id, true, await this.boot(this.files))
        }
        case 'screenshot':
          return this.reply(msg.id, true, { png: Buffer.from('fake').toString('base64'), width: 1, height: 1 })
        case 'input':
          if (msg.action === 'axis') this.host.engine.axes[msg.name] = [msg.x, msg.y]
          return this.reply(msg.id, true, {})
        case 'restart':
          return this.reply(msg.id, true, await this.boot(this.files))
        default:
          // JS 侧命令：agent 通过 host.send 自行回复
          await this.pot.devtools.handle(msg)
      }
    } catch (error) {
      this.reply(msg.id, false, String(error.stack ?? error))
    }
  }

  close() {
    clearInterval(this.timer)
    this.ws?.close()
  }
}

async function until(fn, timeout = 5000) {
  const start = Date.now()
  for (;;) {
    const value = await fn()
    if (value) return value
    if (Date.now() - start > timeout) throw new Error('等待超时')
    await new Promise((r) => setTimeout(r, 20))
  }
}

function get(port, p) {
  return new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port, path: p }, (res) => {
      let text = ''
      res.setEncoding('utf8')
      res.on('data', (c) => { text += c })
      res.on('end', () => resolve({ status: res.statusCode, text }))
    }).on('error', reject)
  })
}

test('Dev Server：无游戏路径启动，转发 open / 命令，记录 Runner 的热重载事件', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pot-root-'))
  const gameDir = path.join(root, 'games/hello')
  fs.cpSync(helloDir, gameDir, { recursive: true })
  const server = new DevServer({ root, port: 0, host: '127.0.0.1', quiet: true })
  await server.start()
  const runner = new FakeRunner(server.port)
  t.after(async () => {
    runner.close()
    await server.close()
    fs.rmSync(root, { recursive: true, force: true })
  })
  const api = client(server.port)

  // Runner 未连接时给出明确错误
  assert.match((await api.open(gameDir)).error, /Runner 未连接/)

  await runner.connect()
  await until(async () => (await api.status()).runner.connected)

  // 不存在 / 不是游戏目录
  assert.match((await api.open(path.join(root, 'nope'))).error, /找不到/)
  assert.match((await api.open(root)).error, /没有 manifest\.json/)

  const opened = await api.open('games/hello', { reset: true })
  assert.equal(opened.ok, true, opened.error)
  assert.equal(opened.data.id, 'pot.hello')
  assert.equal(runner.opened[0].path, gameDir)
  assert.equal(runner.opened[0].files, '/files/games/hello/')
  assert.equal(runner.opened[0].reset, true)
  await until(async () => (await api.status()).game?.id === 'pot.hello')

  // 命令转发
  assert.deepEqual(await api.call({ type: 'eval', code: 'runtime.plugins.list().length' }), { ok: true, data: 3 })
  await api.call({ type: 'input', action: 'axis', name: 'move', x: 1, y: 0 })
  await until(async () => (await api.call({ type: 'state', action: 'get', key: 'player' })).data.position[0] > 1)
  await api.call({ type: 'input', action: 'axis', name: 'move', x: 0, y: 0 })
  assert.equal((await api.call({ type: 'nope' })).ok, false)

  // Runner 自己发现文件变化后热重载，结果以事件上报，Dev Server 记录为 lastReload
  runner.files.set('src/plugins/player.ts', runner.files.get('src/plugins/player.ts').replace('#4fc3f7', '#ff0000'))
  await runner.pot.devtools.changed(['src/plugins/player.ts'])
  await until(() => server.lastReload?.units?.includes('player'))
  assert.equal((await api.status()).lastReload.ok, true)

  // 冷重启 / 截图
  assert.equal((await api.call({ type: 'restart' })).ok, true)
  assert.equal((await api.call({ type: 'screenshot' })).ok, true)

  const logs = await api.logs(0)
  assert.ok(logs.some((l) => l.source === 'runner' && /热重载 player/.test(l.text)))
})

test('Dev Server：/files 静态文件与递归清单，拒绝越界访问', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pot-files-'))
  fs.cpSync(helloDir, path.join(root, 'hello'), { recursive: true })
  fs.mkdirSync(path.join(root, 'hello/.pot'), { recursive: true })
  fs.writeFileSync(path.join(root, 'hello/.pot/junk.txt'), 'x')
  const server = new DevServer({ root, port: 0, host: '127.0.0.1', quiet: true })
  await server.start()
  t.after(async () => {
    await server.close()
    fs.rmSync(root, { recursive: true, force: true })
  })
  const list = await get(server.port, '/files/hello/?list')
  assert.equal(list.status, 200)
  const files = JSON.parse(list.text).files
  const paths = files.map((f) => f.path).sort()
  assert.ok(paths.includes('manifest.json'))
  assert.ok(paths.includes('src/plugins/player.ts'))
  assert.ok(!paths.some((p) => p.startsWith('.pot')), '忽略 .pot')
  assert.ok(files.every((f) => f.size > 0 && f.mtime > 0))

  const manifest = await get(server.port, '/files/hello/manifest.json')
  assert.equal(JSON.parse(manifest.text).id, 'pot.hello')
  assert.equal((await get(server.port, '/files/hello/nope.txt')).status, 404)
  assert.equal((await get(server.port, '/files/..%2F..%2Fetc')).status, 403)
  assert.equal((await get(server.port, '/files/hello/.pot/junk.txt')).status, 403)
})

test('发布构建：bundle.cjs 在没有源码加载器（发布包）时运行，共享模块只有一份', async () => {
  const { buildRelease } = require('../devserver/builder')
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'pot-release-'))
  try {
    const result = await buildRelease(helloDir, out)
    assert.equal(result.units, 3)
    assert.ok(fs.existsSync(path.join(out, 'bundle.cjs')))
    assert.ok(!fs.existsSync(path.join(out, 'src')))
    const files = new Map()
    for (const f of ['manifest.json', 'bundle.cjs', 'data/coins.json']) files.set(f, fs.readFileSync(path.join(out, f), 'utf8'))
    const pot = loadPot()
    const runtime = await pot.createRuntime(createHost(files))
    await runtime.start()
    assert.deepEqual(runtime.failures, [])
    assert.equal(runtime.scene.objects.size, 8, '地面 + 灯光 + 玩家 + 5 个金币')
    await runtime.stop()
  } finally {
    fs.rmSync(out, { recursive: true, force: true })
  }
})

test('pot check：hello 通过；缺单元、语法错误、类型错误都能报出', async () => {
  const { checkGame } = require('../devserver/builder')
  const ok = await checkGame(helloDir)
  assert.deepEqual(ok.errors, [])
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pot-check-'))
  try {
    fs.cpSync(helloDir, dir, { recursive: true })
    // tsconfig 里的 paths 是相对 games/hello 的，复制后改成绝对路径
    const tsconfig = path.join(dir, 'tsconfig.json')
    const runtimeIndex = path.resolve(__dirname, '../runtime/src/index.ts').replace(/\\/g, '/')
    fs.writeFileSync(tsconfig, fs.readFileSync(tsconfig, 'utf8').replace(/"[^"]*js\/runtime\/src\/index\.ts"/, JSON.stringify(runtimeIndex)))
    const manifest = path.join(dir, 'manifest.json')
    fs.writeFileSync(manifest, fs.readFileSync(manifest, 'utf8').replace('"world"', '"world", "ghost"'))
    const player = path.join(dir, 'src/plugins/player.ts')
    fs.writeFileSync(player, fs.readFileSync(player, 'utf8').replace('const speed = config.speed ?? 4', 'const speed: string = config.speed ?? 4'))
    const bad = await checkGame(dir)
    assert.equal(bad.ok, false)
    assert.ok(bad.errors.some((e) => /ghost/.test(e)), bad.errors.join('\n'))
    assert.ok(bad.errors.some((e) => /player\.ts/.test(e) && /TS\d+/.test(e)), bad.errors.join('\n'))
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

test('MCP：initialize / tools/list', async () => {
  const { spawn } = require('child_process')
  const child = spawn(process.execPath, [path.join(__dirname, '../devserver/cli.js'), 'mcp', '--port', '1'], { stdio: ['pipe', 'pipe', 'inherit'] })
  const lines = []
  child.stdout.on('data', (d) => lines.push(...d.toString().split('\n').filter(Boolean)))
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05' } }) + '\n')
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n')
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list' }) + '\n')
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'pot_status', arguments: {} } }) + '\n')
  await until(() => lines.length >= 3)
  child.kill()
  const [init, list, call] = lines.map((l) => JSON.parse(l))
  assert.equal(init.result.serverInfo.name, 'pot')
  const names = list.result.tools.map((t) => t.name)
  assert.ok(names.includes('pot_open') && names.includes('pot_restart') && names.includes('pot_eval'))
  assert.ok(!names.includes('pot_load') && !names.includes('pot_sync'))
  assert.equal(call.result.isError, true, '端口 1 上没有 Dev Server，应返回错误而不是崩溃')
})
