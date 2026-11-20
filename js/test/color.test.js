const test = require('node:test')
const assert = require('node:assert/strict')
const { loadPot, startGame } = require('./helpers')

const close = (a, b) => a.length === b.length && a.every((v, i) => Math.abs(v - b[i]) < 1e-3)

test('颜色：十六进制、rgb/rgba、hsl/hsla、颜色名', () => {
  const { parseColor } = loadPot()
  const cases = [
    ['#ff8000', [1, 128 / 255, 0, 1]],
    ['#f80', [1, 136 / 255, 0, 1]],
    ['#f808', [1, 136 / 255, 0, 136 / 255]],
    ['#ff800080', [1, 128 / 255, 0, 128 / 255]],
    ['ff8000', [1, 128 / 255, 0, 1]],
    ['rgb(255, 128, 0)', [1, 128 / 255, 0, 1]],
    ['rgba(14,13,12,0.4)', [14 / 255, 13 / 255, 12 / 255, 0.4]],
    ['RGBA( 255 , 0 , 0 , 50% )', [1, 0, 0, 0.5]],
    ['rgb(255 0 0 / 0.25)', [1, 0, 0, 0.25]],
    ['rgb(100%, 50%, 0%)', [1, 0.5, 0, 1]],
    ['rgba(300, -5, 0, 2)', [1, 0, 0, 1]],
    ['hsl(120, 100%, 50%)', [0, 1, 0, 1]],
    ['hsla(0.5turn 100% 25% / 0.5)', [0, 0.5, 0.5, 0.5]],
    ['transparent', [0, 0, 0, 0]],
    ['White', [1, 1, 1, 1]],
  ]
  for (const [text, want] of cases) assert.ok(close(parseColor(text), want), `${text} → ${parseColor(text)}`)
  assert.deepEqual(parseColor([0.1, 0.2, 0.3]), [0.1, 0.2, 0.3, 1])
  for (const bad of ['#12345', 'rgb(1, 2)', 'rgba(a, b, c, d)', 'hsl(1, 2, 3x)', 'nope', '']) {
    assert.throws(() => parseColor(bad), /无法解析颜色/, bad)
  }
  const a = parseColor('rgba(1,2,3,0.5)')
  a[0] = 99
  assert.notEqual(parseColor('rgba(1,2,3,0.5)')[0], 99, '缓存不被调用方改写')
})

test('颜色：ui 绘制接受 rgba()，与透明度倍数相乘', async () => {
  const files = new Map([
    ['manifest.json', JSON.stringify({ id: 'c', plugins: ['hud'] })],
    ['src/plugins/hud.js', `export const name = 'hud'
export function apply(ctx) {
  ctx.on('update', () => {
    ctx.ui.rect(0, 0, 10, 10, 'rgba(255, 0, 0, 0.5)')
    ctx.ui.rect(0, 0, 10, 10, 'rgb(0 255 0)', { alpha: 0.5 })
    ctx.ui.text('x', 0, 0, { color: 'hsl(240, 100%, 50%)' })
  })
}
`],
  ])
  const ctx = await startGame(files)
  assert.deepEqual(ctx.runtime.failures, [])
  ctx.runtime.tick(1 / 60)
  const ui = ctx.engine.ui ?? ctx.host.engine.lastUi
  const text = typeof ui === 'string' ? ui : JSON.stringify(ui)
  assert.match(text, /ff000080/)
  assert.match(text, /00ff0080/)
  assert.match(text, /0000ffff/)
})
