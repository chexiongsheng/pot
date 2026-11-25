const test = require('node:test')
const assert = require('node:assert/strict')
const { startGame, frames, unit } = require('./helpers')

const records = (engine) => engine.ui.split('\u001e').map((s) => s.split('\u001f'))

test('ui.clip / unclip / image 生成 c、C、i 命令；input.text 读本帧键入的文字', async () => {
  const body = `ctx.on('update', () => {
    ctx.ui.clip(10, 20, 100, 50)
    ctx.ui.image({ id: 7 }, 0, 0, 64, 32, { tint: '#ff0000', radius: 4, uv: [0, 0, 0.5, 1] })
    ctx.ui.image(8, 1, 2, 3, 4)
    ctx.ui.unclip()
    ctx.ui.text('[' + ctx.input.text() + ']', 0, 0)
  })`
  const { runtime, engine } = await startGame(new Map([
    ['manifest.json', JSON.stringify({ id: 'low.ui', plugins: ['hud'] })],
    ['src/plugins/hud.js', unit('hud', body)],
  ]))
  assert.deepEqual(runtime.failures, [])
  engine.typed = 'ab\b'
  frames(runtime, 1)
  const r = records(engine)
  assert.deepEqual(r[0], ['c', '10', '20', '100', '50'])
  assert.deepEqual(r[1], ['i', '0', '0', '64', '32', '7', 'ff0000ff', '4', '0,0,0.5,1'])
  assert.deepEqual(r[2], ['i', '1', '2', '3', '4', '8', 'ffffffff', '0', ''])
  assert.deepEqual(r[3], ['C', ''])
  assert.equal(r[4][9], '[ab\b]')
  frames(runtime, 1)
  assert.equal(records(engine)[4][9], '[]', '下一帧没有新键入')
  assert.throws(() => runtime.root.ui.image({}, 0, 0, 1, 1), /需要贴图/)
})
