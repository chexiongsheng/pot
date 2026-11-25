const test = require('node:test')
const assert = require('node:assert/strict')
const { startGame } = require('./helpers')

async function game() {
  const ctx = await startGame(new Map([
    ['manifest.json', JSON.stringify({ id: 'fixed', plugins: ['phys'] })],
    ['src/plugins/phys.js', `export const name = 'phys'
export function apply(ctx) {
  const log = ctx.state.define('log', { init: () => ({ steps: [], order: [] }) })
  ctx.on('fixed-update', (step, t) => { log.steps.push([step, t]); log.order.push('f') })
  ctx.on('update', () => log.order.push('u'))
}
`],
  ]))
  return { runtime: ctx.runtime, clock: ctx.runtime.clock, log: ctx.runtime.state.get('log') }
}

const reset = (log) => { log.steps.length = 0; log.order.length = 0 }

test('fixed-update：60 fps 每帧一步，在 update 之前；高帧率时隔帧触发', async () => {
  const { runtime, clock, log } = await game()
  reset(log)
  for (let i = 0; i < 60; i++) runtime.tick(1 / 60)
  assert.equal(log.steps.length, 60, '浮点误差不丢步')
  assert.ok(log.steps.every(([s]) => s === 1 / 60))
  assert.equal(log.order.slice(0, 4).join(''), 'fufu')
  reset(log)
  for (let i = 0; i < 120; i++) runtime.tick(1 / 120)
  assert.equal(log.steps.length, 60)
  assert.equal(log.order.filter((o) => o === 'u').length, 120)
  assert.ok(Math.abs(clock.fixedTime - 2) < 1e-9)
})

test('fixed-update：低帧率一帧补多步，超过 maxFixedSteps 的时间丢弃', async () => {
  const { runtime, clock, log } = await game()
  reset(log)
  runtime.tick(0.25)
  assert.equal(log.steps.length, 8, '0.25 秒按 1/60 应为 15 步，被 maxFixedSteps=8 截断')
  assert.ok(clock.fixedDropped > 0.1 && clock.fixedDropped < 0.12)
  assert.ok(clock.fixedAlpha >= 0 && clock.fixedAlpha < 1)
  reset(log)
  clock.maxFixedSteps = 32
  clock.fixedStep = 0.02
  runtime.tick(0.25)
  assert.equal(log.steps.length, 12)
  assert.ok(Math.abs(clock.fixedAlpha - 0.5) < 1e-6, '余下 0.01 秒 = 半步')
  runtime.tick(0.01)
  assert.equal(log.steps.length, 13, '余量累计到下一帧')
})

test('fixed-update：暂停、冻结、时间缩放', async () => {
  const { runtime, clock, log } = await game()
  reset(log)
  clock.pause()
  for (let i = 0; i < 10; i++) runtime.tick(1 / 60)
  assert.equal(log.steps.length, 0)
  clock.step(2)
  for (let i = 0; i < 10; i++) runtime.tick(1 / 60)
  assert.equal(log.steps.length, 2, 'step(n) 推进 n 帧，固定步随之推进')
  const t0 = clock.time
  clock.step(3)
  runtime.tick(0.25)
  runtime.tick(0.001)
  runtime.tick(1 / 60)
  assert.equal(log.steps.length, 5, '单步与宿主 dt 无关：每帧恰好一个固定步')
  assert.ok(Math.abs(clock.time - t0 - 3 * clock.fixedStep) < 1e-9, '游戏时间按 fixedStep 走')
  assert.equal(clock.pendingSteps, 0)
  clock.resume()
  const release = clock.freeze()
  runtime.tick(1)
  assert.equal(log.steps.length, 5, '冻结时不触发')
  release()
  clock.scale = 0.5
  for (let i = 0; i < 60; i++) runtime.tick(1 / 60)
  assert.equal(log.steps.length, 35, '半速时一秒只有 30 步')
  clock.scale = 0
  runtime.tick(1)
  assert.equal(log.steps.length, 35)
})
