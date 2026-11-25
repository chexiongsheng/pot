/**
 * pot block verify（004 第 18.8 节）：用 JS 写的假原生实现测两遍比较、快照恢复与差异报告。
 */
const test = require('node:test')
const assert = require('node:assert/strict')
const { startGame, loadPot } = require('./helpers')

const GAME = 'src/plugins/game.tsx'

/** 假原生 moveTopdown；bias 不为 0 时故意在第 n 次调用起把 x 多加一点 */
function fake({ bias = 0, from = 0 } = {}) {
  let calls = 0
  return (h) => {
    h.nativeBlocks = () => JSON.stringify([{ name: 'moveTopdown', kit: 'topdown', layout: 'moveTopdown|@move:axis;speed:f', collision: false }])
    h.nativeStep = (name, buf) => {
      calls++
      const out = Float64Array.from(buf)
      for (let i = 0; i < out[0]; i++) {
        const o = 4 + i * out[1]
        const x = out[o + 7], y = out[o + 8], speed = out[o + 9]
        if (!x && !y) continue
        out[o + 1] += x * speed * out[2] + (calls > from ? bias : 0)
        out[o + 3] += y * speed * out[2]
      }
      return out.buffer
    }
  }
}

const SOURCE = `import { defineGame } from '@pot/core'
import topdown from '@pot/kit/topdown'
export default defineGame({
  kits: [topdown],
  vars: { n: 0 },
  scene: () => <>
    <entity key="a" at={[0, 0, 0]} moveTopdown />
    <entity key="b" at={[2, 0, 1]} moveTopdown={{ speed: 3 }} />
  </>,
})
`

async function start(setupHost) {
  const g = await startGame(new Map([
    ['manifest.json', JSON.stringify({ id: 'verify.test', plugins: ['game'] })],
    [GAME, SOURCE],
  ]), setupHost ? { setupHost } : {})
  assert.deepEqual(g.runtime.failures, [])
  for (let i = 0; i < 5; i++) g.runtime.tick(1 / 60)
  return g
}

const SCRIPT = {
  steps: 120,
  input: [{ at: 0, axis: { move: [0.6, 0.8] } }, { at: 60, axis: { move: [-1, 0.25] } }, { at: 100, axis: { move: [0, 0] } }],
}

test('verify：两种实现逐位一致时 identical，World 数据、指令来源、w.native 都恢复', async () => {
  const g = await start(fake())
  const w = g.runtime.root.world
  const pot = loadPot()
  const before = pot.worldHash(g.runtime.state.get('world'))
  const data = w.data
  const r = w.verifyNative('moveTopdown', { script: SCRIPT })
  assert.equal(r.ok, true, JSON.stringify(r))
  assert.equal(r.identical, true)
  assert.equal(r.steps, 120)
  assert.equal(r.entities, 2)
  assert.equal(r.perStep, true)
  assert.deepEqual(r.maxDiff, {})
  assert.equal(r.changedSteps, 100, '前 100 步在动，之后停下')
  assert.ok(r.tsMs >= 0 && r.nativeMs >= 0 && r.tsStepMs > 0 && r.nativeStepMs > 0)
  assert.equal(w.data, data, '恢复原来的 World 数据对象')
  assert.equal(pot.worldHash(g.runtime.state.get('world')), before)
  assert.equal(w.commandSource, null)
  assert.equal(w.native, 'auto')
  // 恢复后照常运行，仍走原生实现
  g.runtime.tick(1 / 60)
  assert.deepEqual(w.inspect().native, ['moveTopdown'])
})

test('verify：有偏差时给出第一个不同的步、实体与字段，以及各字段最大偏差', async () => {
  // start() 先跑了 5 步（5 次调用），verify 的第一遍是 TS，第二遍第 k 步是第 5+k+1 次调用：第 50 步起加偏差
  const g = await start(fake({ bias: 1e-6, from: 55 }))
  const w = g.runtime.root.world
  const r = w.verifyNative('moveTopdown', { script: SCRIPT })
  assert.equal(r.identical, false)
  assert.equal(r.firstHashDiff, 50)
  assert.equal(r.firstDiff.step, 50)
  assert.equal(r.firstDiff.field, 'pos.0')
  assert.ok(r.maxDiff['pos.0'] > 1e-6)
  assert.equal(r.ok, false, '超出缺省容差 1e-9')
  const loose = w.verifyNative('moveTopdown', { script: SCRIPT, tolerance: 1e-3 })
  assert.equal(loose.ok, true)
})

test('verify：没有脚本时零输入；步数缺省 600；参数与状态检查', async () => {
  const g = await start(fake())
  const w = g.runtime.root.world
  const r = w.verifyNative('moveTopdown')
  assert.equal(r.steps, 600)
  assert.equal(r.identical, true)
  assert.equal(r.changedSteps, 0, '零输入时积木什么都没做')
  assert.throws(() => w.verifyNative('moveTopdown', { steps: 0 }), /steps 必须是正整数/)
  assert.throws(() => w.verifyNative('spin'), /没有原生实现/)
})

test('verify：宿主没有原生实现时报原因；devtools 命令可用', async () => {
  const plain = await start(null)
  assert.throws(() => plain.runtime.root.world.verifyNative('moveTopdown'), /当前宿主没有原生实现/)

  const g = await start(fake())
  const pot = loadPot()
  const reply = await pot.devtools.handle({ id: 1, type: 'verify', block: 'moveTopdown', script: SCRIPT })
  assert.equal(reply.ok, true, JSON.stringify(reply))
  assert.equal(reply.data.identical, true)
  const bad = await pot.devtools.handle({ id: 2, type: 'verify' })
  assert.equal(bad.ok, false)
  assert.match(bad.error, /用法：pot block verify/)
})
