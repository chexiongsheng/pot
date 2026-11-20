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

test('ui.flow：行内增量排布、gap、交叉轴对齐，外框不含末尾 gap', async () => {
  const { ui } = await hud('')
  const f = ui.flow(10, 100, { gap: 5, align: 'center' })
  assert.deepEqual(f.next(20, 10), { x: 10, y: 95, w: 20, h: 10 })
  assert.equal(f.x, 35)
  assert.deepEqual(f.next(30, 40), { x: 35, y: 80, w: 30, h: 40 })
  assert.equal(f.width, 55)
  assert.equal(f.height, 40)
  assert.equal(f.count, 2)
  const c = ui.flow(0, 0, { dir: 'column', gap: 2, align: 'end' })
  assert.deepEqual(c.next(10, 5), { x: -10, y: 0, w: 10, h: 5 })
  assert.deepEqual(c.next(4, 5), { x: -4, y: 7, w: 4, h: 5 })
  assert.equal(c.height, 12)
  assert.equal(c.width, 10)
})

test('ui.layout：主轴 start/center/end/between，交叉轴 center/stretch', async () => {
  const { ui } = await hud('')
  const box = { x: 0, y: 0, w: 100, h: 20 }
  const sizes = [[10, 10], [20, 6]]
  const xs = (o) => ui.layout(sizes, box, { gap: 10, ...o }).map((r) => r.x)
  assert.deepEqual(xs({}), [0, 20])
  assert.deepEqual(xs({ justify: 'center' }), [30, 50])
  assert.deepEqual(xs({ justify: 'end' }), [60, 80])
  assert.deepEqual(xs({ justify: 'between' }), [0, 80])
  const mid = ui.layout(sizes, box, { align: 'center' })
  assert.deepEqual(mid.map((r) => r.y), [5, 7])
  const st = ui.layout(sizes, box, { align: 'stretch' })
  assert.deepEqual(st.map((r) => r.h), [20, 20])
  const col = ui.layout([{ w: 10, h: 10 }, { w: 10, h: 10 }], { x: 5, y: 5, w: 50, h: 50 }, { dir: 'column', justify: 'between', align: 'end' })
  assert.deepEqual(col, [{ x: 45, y: 5, w: 10, h: 10 }, { x: 45, y: 45, w: 10, h: 10 }])
})
