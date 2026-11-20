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

// mock uiMeasure：每字 0.6*size 宽、1.3*size 高
test('ui 字距：逐字提交，位置含字距，空格不画；measure 宽度含末尾字距', async () => {
  const { ui, cmds } = await hud(`ctx.ui.text('A B', 10, 20, { size: 20, spacing: 0.5, color: '#ff0000' })`)
  const texts = cmds.filter((c) => c[0] === 't')
  assert.deepEqual(texts.map((c) => c[9]), ['A', 'B'])
  // A 宽 12 + 字距 10 = 22；空格 0.3em = 6 + 10 = 16 → B 在 10 + 22 + 16 = 48
  assert.deepEqual(texts.map((c) => Number(c[1])), [10, 48])
  assert.ok(texts.every((c) => c[2] === '20' && c[5] === 'ff0000ff' && c[6] === '20'))
  assert.equal(ui.measure('A B', 20, false, 0.5).width, 22 + 16 + 22)
  assert.equal(ui.measure('AB', 20).width, 24, '不带字距仍走宿主测量')
})

test('ui 字距：居中、右对齐按整行宽度定位并补回末尾字距；valign 原样传给每个字', async () => {
  const { cmds } = await hud(`
    ctx.ui.text('AB', 100, 50, { size: 10, spacing: 1, align: 'center', valign: 'middle' })
    ctx.ui.text('AB', 100, 80, { size: 10, spacing: 1, align: 'right', valign: 'bottom' })
  `)
  const t = cmds.filter((c) => c[0] === 't')
  // 每字 6 + 10 = 16，行宽 32；居中：100 - 16 + 5 = 89；右对齐：100 - 32 + 10 = 78
  assert.deepEqual(t.slice(0, 2).map((c) => Number(c[1])), [89, 105])
  assert.deepEqual(t.slice(2).map((c) => Number(c[1])), [78, 94])
  assert.equal(t[0][7], '3', 'middle')
  assert.equal(t[2][7], '6', 'bottom')
})

test('ui 字距：wrap 在 w 内断行，英文优先在空格处断', async () => {
  const { cmds } = await hud(`ctx.ui.text('AA BB', 0, 0, { size: 10, spacing: 0.4, w: 40, wrap: true })`)
  const t = cmds.filter((c) => c[0] === 't')
  assert.deepEqual(t.map((c) => c[9]), ['A', 'A', 'B', 'B'])
  const ys = [...new Set(t.map((c) => c[2]))]
  assert.equal(ys.length, 2, '两行')
  assert.equal(Number(ys[1]) - Number(ys[0]), 13, '行距为一行高度')
  assert.equal(t[2][1], '0', '第二行从行首开始')
})
