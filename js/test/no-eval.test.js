/**
 * 小游戏环境禁止 eval / new Function：
 * - C# 调 JS 不再用 ScriptEnv.Eval 拼代码，而是 core/devtools 加载时通过 CS.Pot.PotRuntime.Bind 注册无参入口；
 * - 发布期 bundle.cjs 由构建包成 globalThis.__potBundle 工厂函数预先加载，plugins 直接用它。
 */
const test = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const os = require('os')
const path = require('path')
const vm = require('vm')
const { loadPot, createHost } = require('./helpers')

const dist = path.resolve(__dirname, '../dist')
const helloDir = path.resolve(__dirname, '../../games/hello')

test('C# 入口：core/devtools 加载时向 PotRuntime.Bind 注册，参数经 TakeArg、返回值经 Return', () => {
  const entries = new Map()
  const R = {
    arg: '',
    result: undefined,
    frameDt: 0.016,
    Bind(name, fn) { entries.set(name, fn) },
    TakeArg() { const s = this.arg; this.arg = ''; return s },
    Return(value) { this.result = value },
  }
  const sandbox = { CS: { Pot: { PotRuntime: R, PotHost: { Log() {} } } }, console }
  sandbox.globalThis = sandbox
  vm.createContext(sandbox)
  vm.runInContext(fs.readFileSync(path.join(dist, 'core.cjs'), 'utf8'), sandbox, { filename: 'pot/core.cjs' })
  vm.runInContext(fs.readFileSync(path.join(dist, 'devtools.cjs'), 'utf8'), sandbox, { filename: 'pot/devtools.cjs' })
  for (const name of ['unity.boot', 'unity.tick', 'unity.pump', 'unity.exportState', 'unity.stop', 'unity.info', 'devtools.changed', 'devtools.handle']) {
    assert.equal(typeof entries.get(name), 'function', `缺少入口 ${name}`)
  }
  entries.get('unity.info')()
  assert.deepEqual(JSON.parse(R.result), { status: 'idle' })
  R.result = undefined
  entries.get('unity.exportState')()
  assert.equal(R.result, '')
  entries.get('unity.tick')()
})

test('发布期：预加载的 __potBundle 工厂直接运行，不调用 eval / Function', async () => {
  const { buildRelease } = require('../devserver/builder')
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'pot-noeval-'))
  const pot = loadPot()
  const savedEval = globalThis.eval
  const savedFunction = globalThis.Function
  try {
    await buildRelease(helloDir, out)
    const code = fs.readFileSync(path.join(out, 'bundle.cjs'), 'utf8')
    // 与 PotBuild.WriteBundleFactory 相同的包装
    vm.runInThisContext('globalThis.__potBundle = function (exports, require, module, __filename) {' + code + '\n};\n', { filename: 'pot-game/bundle-factory.cjs' })
    const files = new Map()
    for (const f of ['manifest.json', 'data/coins.json']) files.set(f, fs.readFileSync(path.join(out, f), 'utf8'))
    globalThis.eval = () => { throw new Error('不允许 eval') }
    globalThis.Function = function () { throw new Error('不允许 Function') }
    const runtime = await pot.createRuntime(createHost(files))
    await runtime.start()
    assert.deepEqual(runtime.failures, [])
    assert.equal(runtime.scene.objects.size, 8)
    await runtime.stop()
  } finally {
    globalThis.eval = savedEval
    globalThis.Function = savedFunction
    delete globalThis.__potBundle
    fs.rmSync(out, { recursive: true, force: true })
  }
})
