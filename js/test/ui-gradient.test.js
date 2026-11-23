const test = require('node:test')
const assert = require('node:assert/strict')
const { startGame } = require('./helpers')

const FS = '\u001f'
const RS = '\u001e'

async function hud(body) {
  const ctx = await startGame(new Map([
    ['manifest.json', JSON.stringify({ id: 'ui', plugins: ['hud'] })],
    ['src/plugins/hud.js', `export const name = 'hud'\nexport function apply(ctx) {\n  globalThis.__ui = ctx.ui\n  ctx.on('update', () => { ${body} })\n}\n`],
  ]))
  assert.deepEqual(ctx.runtime.failures, [])
  ctx.runtime.tick(1 / 60)
  const cmds = (ctx.engine.ui || '').split(RS).filter(Boolean).map((c) => c.split(FS))
  return { ui: globalThis.__ui, cmds }
}

test('ui.gradient：默认 180° 纵向，位置按 CSS 规则补齐，alpha 乘到每个色标', async () => {
  const { cmds } = await hud(`ctx.ui.gradient(1, 2, 30, 40, ['#ff0000', '#00ff00', ['#0000ff', 0.8]], { radius: 4, alpha: 0.5 })`)
  assert.equal(cmds.length, 1)
  const [op, x, y, w, h, radius, vertical, stops] = cmds[0]
  assert.deepEqual([op, x, y, w, h, radius, vertical], ['g', '1', '2', '30', '40', '4', '1'])
  assert.equal(stops, 'ff000080@0;00ff0080@0.4;0000ff80@0.8')
})

test('ui.gradient：90° 横向；0° 与 270° 反转色标；位置不小于前一个', async () => {
  const { cmds } = await hud(`
    ctx.ui.gradient(0, 0, 10, 10, [['rgba(6,8,10,.82)', 0], ['rgba(6,8,10,.5)', 0.38], ['rgba(6,8,10,0)', 0.72]], { angle: 90 })
    ctx.ui.gradient(0, 0, 10, 10, [['#000000b3', 0], ['#00000000', 0.46]], { angle: 0 })
    ctx.ui.gradient(0, 0, 10, 10, [['#fff', 0.6], ['#000', 0.2]], { angle: -90 })
  `)
  assert.equal(cmds[0][6], '0')
  assert.equal(cmds[0][7], '06080ad1@0;06080a80@0.38;06080a00@0.72')
  assert.equal(cmds[1][6], '1')
  assert.equal(cmds[1][7], '00000000@0.54;000000b3@1', '从下到上：反转后 pos = 1 - pos')
  assert.equal(cmds[2][6], '0')
  assert.equal(cmds[2][7], '000000ff@0.4;ffffffff@0.4', '-90 即 270，第二个色标位置钳到 0.6 后反转')
})

test('ui.gradient：非法参数报错', async () => {
  const { ui } = await hud('')
  assert.throws(() => ui.gradient(0, 0, 1, 1, ['#fff'], { angle: 45 }), /angle 只支持/)
  assert.throws(() => ui.gradient(0, 0, 1, 1, []), /至少要有一个色标/)
  assert.throws(() => ui.gradient(0, 0, 1, 1, [['#fff', NaN]]), /有限数/)
})
