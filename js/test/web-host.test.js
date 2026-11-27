/**
 * Web 宿主（004 第 20.10 节）：不碰 DOM 的 createWebHost（WebScene + 假的 2D 上下文与平台）上，
 * 跑 pot web 产出的 hello-tsx 发布包（game.js 的 __potFiles 与 __potBundle）与它的 tests/*.json，
 * 结果哈希须与无画面宿主相同（脚本里记的 expect.hash）。
 */
const test = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const os = require('os')
const path = require('path')
const vm = require('vm')
const { loadWebPot } = require('./helpers')

const pot = loadWebPot()
const HELLO_TSX = path.resolve(__dirname, '../../games/hello-tsx')

/** 假的 Canvas2D：只有 WebUI 用到的方法；文字宽 = 字数 × 字号 × 0.5 */
function fakeCtx() {
  const noop = () => {}
  const ctx = { font: '10px sans-serif', fillStyle: '', strokeStyle: '', lineWidth: 1, lineCap: 'butt', textAlign: 'left', textBaseline: 'top', globalAlpha: 1 }
  for (const k of ['save', 'restore', 'beginPath', 'closePath', 'moveTo', 'lineTo', 'arc', 'arcTo', 'rect', 'fill', 'stroke', 'clip', 'fillRect', 'clearRect', 'fillText', 'drawImage', 'setTransform']) ctx[k] = noop
  ctx.measureText = (s) => ({ width: String(s).length * (parseFloat(/(\d+(?:\.\d+)?)px/.exec(ctx.font)?.[1] ?? '10') * 0.5) })
  ctx.createLinearGradient = () => ({ addColorStop: noop })
  return ctx
}

function fakePlatform() {
  let locked = false
  return { screen: () => [1280, 720], focused: () => true, cursor: (v) => (locked = !!v), cursorLocked: () => locked }
}

function memoryStorage() {
  const map = new Map()
  return { map, getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)) }
}

/** 构建 hello-tsx 的网页并在本进程执行 game.js，返回文件表 */
let built
async function buildHello() {
  if (built) return built
  const { buildWeb } = require('../devserver/web')
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'pot-web-host-'))
  try {
    await buildWeb(HELLO_TSX, out)
    vm.runInThisContext(fs.readFileSync(path.join(out, 'game.js'), 'utf8'), { filename: 'game.js' })
  } finally {
    fs.rmSync(out, { recursive: true, force: true })
  }
  built = globalThis.__potFiles
  return built
}

/** 启动：frames 为真，启动期间要像 boot.ts 那样每帧 pump */
async function startWeb(files, storage = memoryStorage()) {
  const logs = []
  const host = pot.web.createWebHost({
    files,
    ui: new pot.web.WebUI(fakeCtx()),
    platform: fakePlatform(),
    storage,
    log: (level, text) => logs.push({ level, text }),
  })
  host.logs = logs
  const runtime = await pot.createRuntime(host)
  let done = false
  const started = runtime.start().finally(() => (done = true))
  for (let i = 0; !done && i < 10000; i++) {
    runtime.root.loading.pump()
    await new Promise((r) => setImmediate(r))
  }
  await started
  return { pot, host, runtime }
}

test('Web 宿主：hello-tsx 发布包启动，platform 为 web，读到 manifest 的 id', async () => {
  const files = await buildHello()
  assert.ok(files['manifest.json'] && files['data/coins.json'])
  assert.strictEqual(typeof globalThis.__potBundle, 'function')
  const { host, runtime } = await startWeb(files)
  try {
    assert.strictEqual(host.platform, 'web')
    assert.strictEqual(host.gameId, 'pot.hello-tsx')
    assert.deepStrictEqual(runtime.failures, [])
    assert.strictEqual(runtime.status, 'running')
    for (let i = 0; i < 10; i++) runtime.tick(1 / 60)
    // 标题页：地面在场景里，界面有命令
    assert.ok(host.scene.count() >= 1)
    assert.ok(host.ui.commands.length > 0)
    assert.deepStrictEqual(host.logs.filter((l) => l.level === 'error'), [])
  } finally {
    await runtime.stop()
  }
})

test('Web 宿主：hello-tsx 的 tests/*.json 结果哈希与无画面宿主相同', async () => {
  const files = await buildHello()
  const { runScript } = require('../devserver/gametest')
  const dir = path.join(HELLO_TSX, 'tests')
  const names = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort()
  assert.ok(names.length >= 2)
  for (const name of names) {
    const script = JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'))
    assert.ok(script.expect?.hash, `${name} 缺少 expect.hash`)
    const r = await runScript(HELLO_TSX, script, () => startWeb(files))
    assert.deepStrictEqual(r.failures, [], `${name}：${r.failures.join('；')}`)
    assert.strictEqual(r.hash, script.expect.hash, name)
  }
})

test('Web 宿主：缓存走 storage，键带游戏 id 前缀，非法 bucket/key 忽略', async () => {
  const files = await buildHello()
  const storage = memoryStorage()
  const { host, runtime } = await startWeb(files, storage)
  try {
    host.cacheWrite('b1', 'k1', 'hello')
    assert.strictEqual(storage.map.get('pot:pot.hello-tsx:b1/k1'), 'hello')
    assert.strictEqual(host.cacheRead('b1', 'k1'), 'hello')
    host.cacheWrite('../x', 'k', 'bad')
    assert.strictEqual(host.cacheRead('../x', 'k'), null)
    assert.ok(![...storage.map.keys()].some((k) => k.includes('..')))
  } finally {
    await runtime.stop()
  }
})

test('Web 宿主：未实现的方法 warn 一次并返回中性值', () => {
  const logs = []
  const host = pot.web.createWebHost({
    files: { 'manifest.json': '{"id":"t"}' },
    ui: new pot.web.WebUI(fakeCtx()),
    platform: fakePlatform(),
    log: (level, text) => logs.push({ level, text }),
  })
  assert.strictEqual(host.engine.raycast(0, 0, 0, 0, 0, 1, 10, -1), null)
  assert.strictEqual(host.engine.raycast(0, 0, 0, 0, 0, 1, 10, -1), null)
  assert.strictEqual(host.engine.texture(new Uint8Array(4), 1, 1), 0)
  assert.strictEqual(host.engine.collider(2, true), '')
  assert.deepStrictEqual(logs.map((l) => l.text), ['Web 宿主不支持 raycast', 'Web 宿主不支持 texture', 'Web 宿主不支持 collider'])
  assert.deepStrictEqual([...host.unsupported], ['raycast', 'texture', 'collider'])
  assert.strictEqual(host.readText('manifest.json'), '{"id":"t"}')
  assert.strictEqual(host.readText('nope.json'), null)
})
