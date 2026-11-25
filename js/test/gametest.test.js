const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { startGame, frames, loadPot } = require('./helpers')

const GAME = `import { defineGame, definePrefab } from '@pot/core'

const Player = definePrefab('player', { tags: ['player'], moveTopdown: true, trigger: { radius: 0 } })
const Coin = definePrefab('coin', { tags: ['coin'], trigger: { radius: 0.5 } })

export default defineGame({
  vars: { score: 0, fired: 0 },
  flow: { start: 'play', states: { play: { on: { pause: 'paused' } }, paused: { pause: true, on: { resume: 'play' } } } },
  scene: () => <>
    <Player key="p" at={[0, 0.5, 0]} />
    {[0, 1].map((i) => <Coin key={i} at={[2 + i * 2, 0.5, 0]} />)}
    <rule on="touch" a={Player} b={Coin} do={(w, p, c) => { w.destroy(c); w.vars.score++ }} />
    <rule on="every" seconds={0.1} do={(w) => { if (w.cmd().down('fire')) w.vars.fired++ }} />
  </>,
})
`

function gameDir(scripts = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pot-test-'))
  fs.mkdirSync(path.join(dir, 'src/plugins'), { recursive: true })
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({ id: 'test.game', plugins: ['game'] }))
  fs.writeFileSync(path.join(dir, 'src/plugins/game.tsx'), GAME)
  for (const [name, script] of Object.entries(scripts)) {
    fs.mkdirSync(path.join(dir, 'tests'), { recursive: true })
    fs.writeFileSync(path.join(dir, 'tests', name), typeof script === 'string' ? script : JSON.stringify(script))
  }
  return dir
}

test('expandScript 与 compressRecording：轴保持、动作按下抬起、emit 只在那一步；压缩后再展开逐步相同', () => {
  const pot = loadPot()
  const next = pot.expandScript({ steps: 10, input: [
    { at: 0, axis: { move: [1, 0] } },
    { at: 2, down: ['fire'], emit: 'pause' },
    { at: 4, up: ['fire'], axis: { move: [0, 0] }, emit: { name: 'named', payload: { n: 1 } } },
  ] })
  const steps = Array.from({ length: 6 }, (_, i) => next(i))
  assert.deepEqual(steps[1], { axes: { move: { x: 1, y: 0 } }, down: {}, events: [] })
  assert.deepEqual(steps[2], { axes: { move: { x: 1, y: 0 } }, down: { fire: true }, events: [{ name: 'pause' }] })
  assert.deepEqual(steps[3].events, [], 'emit 只在那一步')
  assert.deepEqual(steps[4], { axes: { move: { x: 0, y: 0 } }, down: {}, events: [{ name: 'named', payload: { n: 1 } }] })
  const input = pot.compressRecording(steps)
  const again = pot.expandScript({ steps: 6, input })
  assert.deepEqual(Array.from({ length: 6 }, (_, i) => again(i)), steps)
  assert.throws(() => next(1), /按步号递增/)
})

test('录制：World 记下每一步的指令（含界面事件与叠加状态下的步）；pot record 经 devtools 返回脚本', async () => {
  const ctx = await startGame(new Map([
    ['manifest.json', JSON.stringify({ id: 'rec', plugins: ['game'] })],
    ['src/plugins/game.tsx', GAME],
  ]))
  const { runtime, engine, pot } = ctx
  const w = runtime.root.world
  const start = await pot.devtools.handle({ id: 1, type: 'record', action: 'start' })
  assert.equal(start.ok, true, start.error)
  engine.axes.move = [0.8320502943378437, 0.5547001962252291]
  frames(runtime, 10)
  w.emitUI('pause')
  frames(runtime, 3)
  w.emitUI('resume')
  engine.axes.move = [0, 0]
  frames(runtime, 2)
  const stop = await pot.devtools.handle({ id: 2, type: 'record', action: 'stop' })
  assert.equal(stop.ok, true, stop.error)
  assert.equal(stop.data.steps, 15)
  assert.deepEqual(stop.data.input.map((i) => [i.at, i.axis ?? i.emit]), [[0, { move: [0.8320502943378437, 0.5547001962252291] }], [10, 'pause'], [13, { move: [0, 0] }], [13, 'resume']])
  assert.equal(stop.data.expect.flow, 'play')
  assert.match(stop.data.expect.hash, /^[0-9a-f]{8}$/)
  const { testGame } = require('../devserver/gametest')
  const dir = gameDir({ 'rec.json': stop.data })
  try {
    const replay = await testGame(dir)
    assert.equal(replay.ok, true, JSON.stringify(replay.results))
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

test('pot test：脚本按步注入指令，检查 vars、count、flow、hash；--update 写回哈希；改坏后失败', async () => {
  const { testGame } = require('../devserver/gametest')
  const script = {
    name: '吃两个金币，暂停时不动',
    steps: 120,
    input: [
      { at: 0, axis: { move: [1, 0] } },
      { at: 30, emit: 'pause' },
      { at: 60, emit: 'resume', down: ['fire'] },
    ],
    expect: { vars: { score: 2 }, count: { coin: 0 }, flow: 'play' },
  }
  const dir = gameDir({ 'coins.json': script, 'bad.json': '{ nope' })
  try {
    const first = await testGame(dir, { update: true })
    const coins = first.results.find((r) => r.file === path.join('tests', 'coins.json'))
    assert.equal(coins.ok, true, coins.failures.join('\n'))
    assert.ok(coins.results === undefined)
    const saved = JSON.parse(fs.readFileSync(path.join(dir, 'tests/coins.json'), 'utf8'))
    assert.equal(saved.expect.hash, coins.hash, '--update 写回')
    const bad = first.results.find((r) => r.file === path.join('tests', 'bad.json'))
    assert.equal(bad.ok, false)
    assert.match(bad.failures[0], /不是合法 JSON/)
    assert.equal(first.ok, false)

    fs.rmSync(path.join(dir, 'tests/bad.json'))
    const again = await testGame(dir)
    assert.equal(again.ok, true, JSON.stringify(again.results))
    assert.equal(again.results[0].hash, coins.hash, '同一输入哈希稳定')

    const src = path.join(dir, 'src/plugins/game.tsx')
    fs.writeFileSync(src, fs.readFileSync(src, 'utf8').replace('w.vars.score++', 'w.vars.score += 2'))
    const broken = await testGame(dir)
    assert.equal(broken.ok, false)
    assert.ok(broken.results[0].failures.some((f) => /^vars\.score：期望 2，实际 4/.test(f)), broken.results[0].failures.join('\n'))
    assert.ok(broken.results[0].failures.some((f) => /^hash：/.test(f)))
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

test('pot test：没有 tests/ 时跑冒烟；运行中有错误日志即失败', async () => {
  const { testGame } = require('../devserver/gametest')
  const dir = gameDir()
  try {
    const smoke = await testGame(dir)
    assert.equal(smoke.ok, true)
    assert.equal(smoke.results[0].tick, 300)
    const src = path.join(dir, 'src/plugins/game.tsx')
    fs.writeFileSync(src, fs.readFileSync(src, 'utf8').replace("if (w.cmd().down('fire')) w.vars.fired++", "if (w.tick > 50) throw new Error('炸了')"))
    const broken = await testGame(dir)
    assert.equal(broken.ok, false)
    assert.ok(broken.results[0].failures.some((f) => /炸了/.test(f)), broken.results[0].failures.join('\n'))
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})
