/**
 * saltline 导演回归：切断中继（按住 interact 2.4 秒）。
 * 提交 05a6b56 起导演里写成了 w.down（World 上没有这个方法），按住交互键时 slDirector.step 每步报错、进度不动，
 * 这一关打不通；当时积木钩子的 w 是 any，类型检查发现不了。这里用完整游戏锁定：站到中继旁、面朝它、按住交互键，
 * 进度推进、中继变为 cut，过程中没有积木报错。
 */
const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('path')
const { startGame, readGameFiles } = require('./helpers')

const GAME_DIR = path.resolve(__dirname, '../../games/saltline')

test('saltline 导演：站在中继旁按住交互键，进度推进并切断中继', async () => {
  const game = await startGame(readGameFiles(GAME_DIR))
  assert.deepEqual(game.runtime.failures, [])
  game.engine.locked = true
  const w = game.runtime.root.world
  const tick = () => game.runtime.tick(1 / 60)
  for (let i = 0; i < 600 && w.flow?.state !== 'title'; i++) tick()
  assert.equal(w.flow.state, 'title')
  w.emitUI('slStart')
  for (let i = 0; i < 600 && w.vars.sl.phase !== 'playing'; i++) tick()
  assert.equal(w.vars.sl.phase, 'playing')

  const director = w.query().find((e) => e.b.slDirector)
  const relay = director.b.slDirector.relays[0].pos
  const player = w.query('player')[0]
  // 站在中继西侧 1.2 米，面朝东（yaw 90）
  const at = [relay[0] - 1.2, 0, relay[2]]
  let hold = true
  w.setCommandSource(() => ({ axes: {}, down: { interact: hold }, events: [] }))
  const progress = []
  for (let i = 0; i < 200; i++) {
    player.pos = [...at]
    player.b.moveFps.yaw = 90
    player.b.health.hp = player.b.health.max
    tick()
    progress.push(w.vars.sl.progress)
    if (w.vars.sl.relays[0] === 'cut') break
  }
  hold = false
  const errors = game.host.logs.filter((l) => l.level === 'error').map((l) => l.text)
  assert.deepEqual(errors, [])
  assert.equal(w.vars.sl.hint, 0, '应提示可以交互的是第一个中继')
  assert.ok(Math.max(...progress) > 0, '按住时进度应推进')
  assert.equal(w.vars.sl.relays[0], 'cut', `按住约 2.4 秒后应切断（共 ${progress.length} 步）`)
  assert.deepEqual(w.vars.sl.relays.slice(1), ['live', 'live'])
})
