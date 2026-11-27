/**
 * Web 宿主界面（004 第 20.5、20.10 节）：命令串解析、uiMeasure 的行高与断行（假的测量函数）
 */
const test = require('node:test')
const assert = require('node:assert/strict')
const { loadWebPot } = require('./helpers')

const web = () => loadWebPot().web
const RS = '\u001e'
const FS = '\u001f'
const cmd = (...records) => records.map((r) => r.join(FS)).join(RS)

/** 记录调用的假 Canvas2D：每个字符宽 0.5em（从 font 里取字号） */
function fakeCtx() {
  const calls = []
  const ctx = {
    calls,
    font: '', fillStyle: '', strokeStyle: '', lineWidth: 1, lineCap: 'butt', textAlign: 'left', textBaseline: 'alphabetic', globalAlpha: 1,
    measureText(text) {
      const size = Number(/(\d+(?:\.\d+)?)px/.exec(ctx.font)[1])
      return { width: [...text].length * size * 0.5 }
    },
    createLinearGradient(...args) {
      const g = { args, stops: [], addColorStop(o, c) { g.stops.push([o, c]) } }
      return g
    },
  }
  for (const name of ['save', 'restore', 'beginPath', 'closePath', 'moveTo', 'lineTo', 'arc', 'arcTo', 'rect', 'fill', 'stroke', 'clip', 'fillRect', 'clearRect', 'drawImage']) {
    ctx[name] = (...args) => calls.push([name, ...args])
  }
  ctx.fillText = (text, x, y) => calls.push(['fillText', text, x, y, ctx.fillStyle, ctx.textAlign, ctx.font])
  return ctx
}

test('web-ui：颜色与字体', () => {
  const { parseColor, cssColor, fontOf, fontWeight } = web()
  assert.deepEqual(parseColor('ff000080').map((v) => +v.toFixed(3)), [1, 0, 0, 0.502])
  assert.deepEqual(parseColor('00ff00'), [0, 1, 0, 1])
  assert.equal(cssColor('ffffffff'), 'rgba(255,255,255,1)')
  assert.equal(fontWeight(0), 400)
  assert.equal(fontWeight(1), 700)
  assert.equal(fontWeight(5 << 4), 500)
  assert.match(fontOf(20, 8), /^400 20px Consolas/)
  assert.match(fontOf(16, 1), /^700 16px "Microsoft YaHei"/)
})

test('web-ui：uiMeasure 的宽度与行高', () => {
  const { WebUI, LINE_HEIGHT } = web()
  const ui = new WebUI(fakeCtx())
  assert.deepEqual(ui.measure('abcd', 20, 0), [40, 20 * LINE_HEIGHT])
  assert.deepEqual(ui.measure('ab\nabcdef', 10, 4), [30, 2 * 10 * LINE_HEIGHT], '测量不换行，只按 \\n 分行')
})

test('web-ui：断行规则', () => {
  const { wrapText } = web()
  const m = (s) => [...s].length * 10
  assert.deepEqual(wrapText('hello world foo', 110, m), ['hello world', 'foo'])
  assert.deepEqual(wrapText('中文可以逐字断行', 30, m), ['中文可', '以逐字', '断行'])
  assert.deepEqual(wrapText('abcdefgh', 30, m), ['abc', 'def', 'gh'], '超宽的词按字断')
  assert.deepEqual(wrapText('a\n\nb', 0, m), ['a', '', 'b'])
  assert.deepEqual(wrapText('得分 120 分', 50, m), ['得分 ', '120 分'].map((s) => s.trimEnd()))
})

test('web-ui：命令绘制、裁剪配对、文字对齐与阴影', () => {
  const { WebUI } = web()
  const ctx = fakeCtx()
  const ui = new WebUI(ctx)
  ui.submit(cmd(
    ['r', '10', '20', '100', '50', 'ff0000ff', '0'],
    ['c', '0', '0', '50', '50'],
    ['t', '0', '0', '100', '40', 'ffffffff', '20', '4', '2', 'hi'],
    ['l', '0', '0', '10', '10', '00ff00ff', '2'],
    ['a', '50', '50', '10', 'ffffffff', '2', '0', '90'],
    ['g', '0', '0', '10', '100', '0', '1', 'ff0000ff@0;0000ffff@1'],
    ['x', 'unknown'],
  ))
  assert.equal(ui.render(800, 600), true)
  const names = ctx.calls.map((c) => c[0])
  assert.equal(names.filter((n) => n === 'save').length, 1)
  assert.equal(names.filter((n) => n === 'restore').length, 1, '未弹出的裁剪在末尾补齐')
  assert.deepEqual(ctx.calls.find((c) => c[0] === 'rect' && c[1] === 10), ['rect', 10, 20, 100, 50])
  const texts = ctx.calls.filter((c) => c[0] === 'fillText').map((c) => c.map((v) => (typeof v === 'number' ? +v.toFixed(6) : v)))
  assert.equal(texts.length, 2, '阴影一次加正文一次')
  assert.deepEqual(texts[0].slice(1, 6), ['hi', 51, 21, 'rgba(0,0,0,0.75)', 'center'])
  assert.deepEqual(texts[1].slice(1, 6), ['hi', 50, 20, 'rgba(255,255,255,1)', 'center'])
  const arc = ctx.calls.find((c) => c[0] === 'arc')
  assert.ok(Math.abs(arc[4] + Math.PI / 2) < 1e-9 && Math.abs(arc[5]) < 1e-9 && arc[6] === false, '0 度朝上、顺时针')
  // 命令串与尺寸不变时不重画
  assert.equal(ui.render(800, 600), false)
  assert.equal(ui.render(801, 600), true)
  ui.invalidate()
  assert.equal(ui.render(801, 600), true)
})

test('web-ui：九宫格对齐与零尺寸锚点', () => {
  const { WebUI, LINE_HEIGHT } = web()
  const ctx = fakeCtx()
  const ui = new WebUI(ctx)
  ui.submit(cmd(
    ['t', '100', '100', '0', '0', 'ffffffff', '10', '8', '0', 'ab'],
    ['t', '0', '0', '40', '0', 'ffffffff', '10', '0', '4', 'aaaa bbbb'],
  ))
  ui.render(200, 200)
  const texts = ctx.calls.filter((c) => c[0] === 'fillText').map((c) => c.map((v) => (typeof v === 'number' ? +v.toFixed(6) : v)))
  // 右下对齐、w h 为 0：以 (100, 100) 为右下角
  assert.deepEqual(texts[0].slice(1, 4), ['ab', 100, +(100 - 0.5 * LINE_HEIGHT * 10).toFixed(6)])
  assert.equal(texts[0][5], 'right')
  // 换行：左上对齐，两行
  assert.deepEqual(texts.slice(1).map((t) => t[1]), ['aaaa', 'bbbb'])
})
