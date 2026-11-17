/**
 * Dev Server 端到端测试：用 Node 版“假 Runner”（与 C# PotDevClient 协议一致）
 * 连接 Dev Server，验证 加载 → 改文件 → 自动热重载 → 报错栈映射 → CLI 调用。
 */
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const os = require('os')
const path = require('path')
const WebSocket = require('ws')
const { DevServer } = require('../devserver/server')
const { client } = require('../devserver/client')
const { loadPot, createHost, helloDir } = require('./helpers')

class FakeRunner {
  constructor(port) {
    this.pot = loadPot()
    this.port = port
    this.runtime = null
    this.loads = 0
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(`ws://127.0.0.1:${this.port}/runner`)
      this.ws.on('open', () => {
        this.ws.send(JSON.stringify({ type: 'hello', platform: 'node', unity: 'fake' }))
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

  async boot(files, resetState) {
    let state = ''
    if (this.runtime) {
      if (!resetState) state = this.runtime.exportState()
      await this.runtime.stop()
    }
    const host = createHost(new Map(files.map((f) => [f.path, f.content])))
    host.send = (m) => this.ws.send(m)
    host.log = (level, text) => this.ws.send(JSON.stringify({ type: 'log', level, text }))
    this.host = host
    this.runtime = await this.pot.createRuntime(host, { state })
    this.pot.devtools.attach(this.runtime)
    await this.runtime.start()
    this.loads++
  }

  async onMessage(msg) {
    try {
      switch (msg.type) {
        case 'load':
          await this.boot(msg.files, msg.resetState)
          return this.reply(msg.id, true, { files: msg.files.length })
        case 'screenshot':
          return this.reply(msg.id, true, { png: Buffer.from('fake').toString('base64'), width: 1, height: 1 })
        case 'input':
          if (msg.action === 'axis') this.host.engine.axes[msg.name] = [msg.x, msg.y]
          return this.reply(msg.id, true, {})
        case 'cold':
          return this.reply(msg.id, false, 'not supported')
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

test('Dev Server：加载、自动热重载、报错映射、CLI 调用', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pot-hello-'))
  fs.cpSync(helloDir, dir, { recursive: true })
  const server = new DevServer({ gameDir: dir, port: 0, host: '127.0.0.1', quiet: true })
  await server.start()
  const runner = new FakeRunner(server.port)
  t.after(async () => {
    runner.close()
    await server.close()
    fs.rmSync(dir, { recursive: true, force: true })
  })
  await runner.connect()
  await until(() => runner.loads === 1 && runner.runtime?.status === 'running')
  const api = client(server.port)

  const status = await api.status()
  assert.equal(status.runner.connected, true)
  assert.deepEqual(status.units.sort(), ['coins', 'player', 'world'])

  // CLI/HTTP 调用
  const evalRes = await api.call({ type: 'eval', code: 'runtime.plugins.list().length' })
  assert.deepEqual(evalRes, { ok: true, data: 3 })
  await api.call({ type: 'input', action: 'axis', name: 'move', x: 1, y: 0 })
  await until(async () => (await api.call({ type: 'state', action: 'get', key: 'player' })).data.position[0] > 1)
  await api.call({ type: 'input', action: 'axis', name: 'move', x: 0, y: 0 })

  // 改 player.ts → 自动热重载，state 保留
  const playerFile = path.join(dir, 'src/plugins/player.ts')
  const original = fs.readFileSync(playerFile, 'utf8')
  const x = runner.runtime.state.get('player').position[0]
  fs.writeFileSync(playerFile, original.replace('#4fc3f7', '#ff0000'))
  await until(() => server.lastReload?.data?.units?.includes('player'))
  assert.equal(server.lastReload.data.ok, true, server.lastReload.data.error)
  assert.deepEqual(runner.host.engine.byName('player')[0].color, [1, 0, 0, 1])
  assert.ok(Math.abs(runner.runtime.state.get('player').position[0] - x) < 1e-9)

  // 运行时报错：栈映射回 TS 源文件，且回滚
  server.lastReload = null
  fs.writeFileSync(playerFile, original.replace('const body =', 'if (speed > 0) throw new Error("坏了")\n  const body ='))
  await until(() => server.lastReload)
  const failed = server.lastReload.data
  assert.equal(failed.ok, false)
  assert.equal(failed.rolledBack, true)
  assert.match(failed.error, /src\/plugins\/player\.ts:\d+:\d+/, failed.error)
  assert.equal(runner.host.engine.byName('player').length, 1)

  // 构建错误：不推送，状态里可见
  server.lastReload = null
  fs.writeFileSync(playerFile, original.replace('export function apply', 'export function apply(('))
  await until(async () => (await api.status()).buildErrors.length > 0)
  assert.equal(server.lastReload, null)

  // 修好后恢复
  fs.writeFileSync(playerFile, original)
  await until(async () => (await api.status()).buildErrors.length === 0 && server.lastReload?.data?.ok)

  // 改 manifest → 冷重启，state 保留
  const score = runner.runtime.state.get('player')
  score.score = 7
  const manifestFile = path.join(dir, 'manifest.json')
  fs.writeFileSync(manifestFile, fs.readFileSync(manifestFile, 'utf8').replace('0.1.0', '0.1.1'))
  await until(() => runner.loads === 2 && runner.runtime?.status === 'running')
  assert.equal(runner.runtime.state.get('player').score, 7)

  // 截图
  const shot = await api.call({ type: 'screenshot' })
  assert.equal(shot.ok, true)

  const logs = await api.logs(0)
  assert.ok(logs.some((l) => /热重载 player 完成/.test(l.text)))
})

test('发布构建：bundle.cjs 可在无 units/ 的情况下运行', async () => {
  const { buildRelease } = require('../devserver/builder')
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'pot-release-'))
  try {
    const result = await buildRelease(helloDir, out)
    assert.equal(result.units, 3)
    assert.ok(fs.existsSync(path.join(out, 'bundle.cjs')))
    assert.ok(!fs.existsSync(path.join(out, 'units')))
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
  assert.ok(list.result.tools.some((t) => t.name === 'pot_eval'))
  assert.equal(call.result.isError, true, '端口 1 上没有 Dev Server，应返回错误而不是崩溃')
})
