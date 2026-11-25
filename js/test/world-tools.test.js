const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { startGame, frames, run } = require('./helpers')

const GAME = 'src/plugins/game.tsx'
const SOURCE = `import { defineGame, definePrefab } from '@pot/core'

const Player = definePrefab('player', { tags: ['player'], shape: { kind: 'cube' }, moveTopdown: true })
const Coin = definePrefab('coin', { tags: ['coin'], shape: { kind: 'sphere', color: '#ffd54f' }, spin: true })

export default defineGame({
  scene: () => <>
    <stage background="#1e2230" />
    <Player key="p" at={[0, 0.5, 0]} />
    {[0, 1].map((i) => <Coin key={i} at={[2 + i, 0.5, 0]} />)}
    <rule on="touch" a={Player} b={Coin} do={(w, p, c) => w.destroy(c)} />
  </>,
})
`

async function start(extra = []) {
  const ctx = await startGame(new Map([
    ['manifest.json', JSON.stringify({ id: 'world.tools', plugins: ['game'] })],
    [GAME, SOURCE],
    ...extra,
  ]))
  assert.deepEqual(ctx.runtime.failures, [])
  frames(ctx.runtime, 1)
  return ctx
}

const w = (runtime) => runtime.root.world
const at = (runtime, p) => w(runtime).query().find((e) => e.path === p)?.pos
const call = (ctx, msg) => run(ctx.runtime, ctx.pot.devtools.handle({ id: 1, ...msg }))

test('树视图：实体、规则、stage 各一条，带 key 路径、属性与源位置；pot query tree / world', async () => {
  const ctx = await start()
  const view = w(ctx.runtime).treeView('game')
  assert.deepEqual(view.entities.map((e) => e.path), ['player:p', 'coin:0', 'coin:1'])
  assert.match(view.entities[0].source, /^src\/plugins\/game\.tsx:9$/)
  assert.equal(view.entities[1].blocks.shape.kind, 'sphere')
  assert.deepEqual(view.rules.map((r) => [r.path, r.on, r.a, r.b, r.do]), [['rule#0', 'touch', 'player', 'coin', '[function]']])
  assert.equal(view.stage.background, '#1e2230')
  const tree = await call(ctx, { type: 'query', what: 'tree' })
  assert.deepEqual(Object.keys(tree.data), ['game'])
  const world = await call(ctx, { type: 'query', what: 'world', unit: 'coin' })
  assert.equal(world.data.entities.length, 2)
  assert.deepEqual(world.data.flow, { state: 'play', params: {}, base: 'play' })
  assert.throws(() => w(ctx.runtime).treeView('nope'), /没有挂载 "nope"/)
})

test('覆盖层 data/overrides.json：叠在求值结果上；对不上的路径告警一次；改文件即热重载', async () => {
  const overrides = { game: { 'coin:0': { at: [9, 0.5, 0], shape: { color: '#ff0000' }, spin: false }, 'coin:7': { at: [0, 0, 0] } } }
  const ctx = await start([['data/overrides.json', JSON.stringify(overrides)]])
  const { runtime, host } = ctx
  assert.deepEqual(at(runtime, 'coin:0'), [9, 0.5, 0])
  const coin = w(runtime).query().find((e) => e.path === 'coin:0')
  assert.equal(coin.b.shape.color, '#ff0000')
  assert.equal(coin.b.spin, undefined, 'false 去掉积木')
  assert.equal(host.logs.filter((l) => l.level === 'warn' && /"coin:7" 在这次挂载里不存在/.test(l.text)).length, 1)
  ctx.files.set('data/overrides.json', JSON.stringify({ game: { 'coin:0': { at: [5, 0.5, 5] } } }))
  const reply = await call(ctx, { type: 'changed', paths: ['data/overrides.json'] })
  assert.equal(reply.data.ok, true, reply.data.error)
  assert.deepEqual(at(runtime, 'coin:0'), [5, 0.5, 5])
  assert.ok(w(runtime).query().find((e) => e.path === 'coin:0').b.spin, '去掉补丁后积木回来')
})

test('运行期补丁 pot world set / clear：立即重新挂载；补丁里的未知积木与字段告警', async () => {
  const ctx = await start()
  const { runtime, host } = ctx
  const set = await call(ctx, { type: 'world', action: 'set', path: 'coin:1', patch: { at: [1, 2, 3], spin: { speed: 10, fast: 1 }, glow: true } })
  assert.equal(set.ok, true, set.error)
  assert.deepEqual(at(runtime, 'coin:1'), [1, 2, 3])
  assert.equal(w(runtime).query().find((e) => e.path === 'coin:1').b.spin.speed, 10)
  assert.ok(host.logs.some((l) => /积木 spin 没有字段 fast/.test(l.text)))
  assert.ok(host.logs.some((l) => /未知的积木 glow/.test(l.text)))
  await call(ctx, { type: 'world', action: 'set', path: 'coin:1', patch: { at: [4, 2, 3] } })
  assert.deepEqual((await call(ctx, { type: 'world' })).data, { game: { 'coin:1': { at: [4, 2, 3], spin: { speed: 10, fast: 1 }, glow: true } } }, '同一路径的补丁深合并')
  await call(ctx, { type: 'world', action: 'clear' })
  assert.deepEqual(at(runtime, 'coin:1'), [3, 0.5, 0], '清掉后回到源码里的值')
  const bad = await call(ctx, { type: 'world', action: 'set', mount: 'hud', path: 'x', patch: {} })
  assert.equal(bad.ok, false)
  assert.match(bad.error, /没有挂载 "hud"/)
})

test('Dev Server 的 --save：补丁深合并写进游戏目录的 data/overrides.json；非本机目录报错', async () => {
  const { DevServer } = require('../devserver/server')
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pot-overrides-'))
  try {
    fs.writeFileSync(path.join(dir, 'manifest.json'), '{"id":"x"}')
    const server = new DevServer({ root: dir, port: 0, quiet: true })
    server.game = { kind: 'Directory', dir }
    assert.equal((await server.call({ type: 'world', action: 'set', save: true, path: 'coin:0', patch: { at: [1, 2, 3] } })).ok, true)
    await server.call({ type: 'world', action: 'set', save: true, path: 'coin:0', patch: { shape: { color: '#f00' } } })
    const file = JSON.parse(fs.readFileSync(path.join(dir, 'data/overrides.json'), 'utf8'))
    assert.deepEqual(file, { game: { 'coin:0': { at: [1, 2, 3], shape: { color: '#f00' } } } })
    await server.call({ type: 'world', action: 'clear', save: true })
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir, 'data/overrides.json'), 'utf8')), {})
    server.game = { kind: 'Package', dir: null }
    assert.equal((await server.call({ type: 'world', action: 'set', save: true, path: 'a', patch: {} })).ok, false)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})
