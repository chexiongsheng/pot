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
  return { ui: globalThis.__ui, cmds, engine: ctx.engine }
}

test('ui 字重：400/700 只用粗体位（旧命令不变），其他字重写进位 4..7，≥600 同时带粗体位；mono 为位 8', async () => {
  const { cmds } = await hud(`
    ctx.ui.text('a', 0, 0)
    ctx.ui.text('a', 0, 0, { bold: true })
    ctx.ui.text('a', 0, 0, { weight: 500 })
    ctx.ui.text('a', 0, 0, { weight: 600, shadow: true })
    ctx.ui.text('a', 0, 0, { weight: 900, bold: false })
    ctx.ui.text('a', 0, 0, { weight: 'bold' })
    ctx.ui.text('a', 0, 0, { weight: 340 })
    ctx.ui.text('a', 0, 0, { weight: 1000, mono: true })
    ctx.ui.text('a', 0, 0, { weight: 400, bold: true, wrap: true })
  `)
  const flags = cmds.filter((c) => c[0] === 't').map((c) => Number(c[8]))
  assert.deepEqual(flags, [0, 1, 5 << 4, 1 | 2 | (6 << 4), 1 | (9 << 4), 1, 3 << 4, 1 | 8 | (9 << 4), 4])
})

test('ui 字重：带字距的逐字文字也带字重位；measure 接受字体选项并把字体位传给宿主，缓存按字重区分', async () => {
  const seen = []
  const { ui, cmds, engine } = await hud(`ctx.ui.text('AB', 0, 0, { size: 10, spacing: 0.1, weight: 900 })`)
  assert.ok(cmds.filter((c) => c[0] === 't').every((c) => Number(c[8]) === (1 | (9 << 4))))
  const orig = engine.uiMeasure
  engine.uiMeasure = (text, size, flags) => {
    seen.push(flags)
    return [String(text).length * size * ((flags >> 4) === 9 ? 0.8 : 0.6), size * 1.3]
  }
  try {
    assert.equal(ui.measure('AB', 10, { weight: 900 }).width, 16)
    assert.equal(ui.measure('AB', 10, true).width, 12)
    assert.equal(ui.measure('AB', 10, { mono: true }).width, 12)
    // 带字距时按逐字宽度缓存：900 与 400 不能共用缓存
    assert.equal(ui.measure('C', 10, { weight: 900 }, 0.5).width, 8 + 5)
    assert.equal(ui.measure('C', 10, false, 0.5).width, 6 + 5)
  } finally {
    engine.uiMeasure = orig
  }
  assert.deepEqual(seen.slice(0, 3), [1 | (9 << 4), 1, 8])
  assert.throws(() => ui.text('x', 0, 0, { weight: NaN }), /weight/)
})
