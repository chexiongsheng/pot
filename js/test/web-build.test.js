/**
 * pot web 构建（004 第 20.6、20.7 节）：产出 index.html、pot-web.js、game.js；
 * game.js 在独立 vm 上下文里执行后 __potFiles、__potBundle 可用，屏蔽名单里的名字在游戏代码里为 undefined，
 * 可移植清单里的全局对象照常可用。
 */
const test = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const os = require('os')
const path = require('path')
const vm = require('vm')
const { loadPot } = require('./helpers')

const pot = loadPot()

function makeGame(root) {
  const dir = path.join(root, 'game')
  fs.mkdirSync(path.join(dir, 'src/plugins'), { recursive: true })
  fs.mkdirSync(path.join(dir, 'data'), { recursive: true })
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({ id: 'pot.web-probe', name: '探针 <&>', plugins: ['probe'] }))
  fs.writeFileSync(path.join(dir, 'data/info.json'), JSON.stringify({ hello: '世界' }))
  fs.writeFileSync(path.join(dir, 'data/blob.bin'), Buffer.from([0, 1, 2, 255]))
  const blocked = pot.BLOCKED_GLOBALS.map((n) => `${JSON.stringify(n)}: typeof ${n}`).join(',\n  ')
  fs.writeFileSync(path.join(dir, 'src/plugins/probe.ts'), `export const name = 'probe'
export function apply() {}
export const blocked: Record<string, string> = {
  ${blocked}
}
export const portable = { setTimeout: typeof setTimeout, console: typeof console, globalThis: typeof globalThis }
`)
  return dir
}

test('pot web：产出三个文件，game.js 带文件表与屏蔽层包裹的 bundle', async () => {
  const { buildWeb } = require('../devserver/web')
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pot-web-build-'))
  try {
    const dir = makeGame(root)
    const out = path.join(root, 'site')
    const result = await buildWeb(dir, out)
    assert.deepStrictEqual(fs.readdirSync(out).sort(), ['game.js', 'index.html', 'pot-web.js'])
    assert.ok(!fs.existsSync(path.join(dir, '.pot/web-stage')), '临时目录已删除')
    assert.deepStrictEqual(result.skipped, ['data/blob.bin'])

    const html = fs.readFileSync(path.join(out, 'index.html'), 'utf8')
    assert.ok(html.includes('<title>探针 &lt;&amp;&gt;</title>'))
    const order = ['pot-web.js', 'game.js', 'pot.web.boot()'].map((s) => html.indexOf(s))
    assert.ok(order.every((i, k) => i > 0 && (k === 0 || i > order[k - 1])), '依次加载 pot-web.js、game.js 再 boot')
    assert.ok(html.includes('id="pot"') && html.includes('id="pot-loading"'))

    // 独立上下文：放上浏览器与 Node 的专有全局，检查游戏代码里看不到它们
    const sandbox = { console, setTimeout, clearTimeout }
    for (const n of pot.BLOCKED_GLOBALS) sandbox[n] = { leaked: n }
    const context = vm.createContext(sandbox)
    vm.runInContext(fs.readFileSync(path.join(out, 'game.js'), 'utf8'), context, { filename: 'game.js' })
    const files = context.__potFiles
    assert.deepStrictEqual(Object.keys(files).sort(), ['data/info.json', 'manifest.json'])
    assert.deepStrictEqual(JSON.parse(files['data/info.json']), { hello: '世界' })
    assert.strictEqual(typeof context.__potBundle, 'function')

    const module = { exports: {} }
    const require = (name) => {
      throw new Error(`未预期的 require：${name}`)
    }
    context.__potBundle(module.exports, require, module, 'bundle.cjs')
    const probe = module.exports.units.probe
    const blocked = JSON.parse(JSON.stringify(probe.blocked))
    for (const n of pot.BLOCKED_GLOBALS) assert.strictEqual(blocked[n], 'undefined', `${n} 应被屏蔽`)
    assert.deepStrictEqual(JSON.parse(JSON.stringify(probe.portable)), { setTimeout: 'function', console: 'object', globalThis: 'object' })
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})
