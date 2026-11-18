const test = require('node:test')
const assert = require('node:assert/strict')
const { loadPot, createHost, startGame, unit } = require('./helpers')

const pot = loadPot()
const px = (c, x, y) => {
  const d = c.getContext('2d').getImageData(x, y, 1, 1).data
  return [d[0], d[1], d[2], d[3]]
}
const near = (a, b, tol = 2) => a.every((v, i) => Math.abs(v - b[i]) <= tol)

test('颜色解析：hex / rgb / rgba / hsl / 颜色名', () => {
  assert.deepEqual(pot.parseCssColor('#f00'), [1, 0, 0, 1])
  assert.deepEqual(pot.parseCssColor('rgba(0,255,0,0.5)'), [0, 1, 0, 0.5])
  const h = pot.parseCssColor('hsl(240,100%,50%)')
  assert.ok(near(h.map((v) => v * 255), [0, 0, 255, 255], 1))
  assert.deepEqual(pot.parseCssColor('white'), [1, 1, 1, 1])
  assert.equal(pot.parseCssColor('???'), null)
})

test('fillRect / fillStyle / globalAlpha 与 source-over 合成', () => {
  const c = new pot.Canvas(8, 8)
  const g = c.getContext('2d')
  g.fillStyle = '#ff0000'
  g.fillRect(0, 0, 8, 8)
  g.globalAlpha = 0.5
  g.fillStyle = '#0000ff'
  g.fillRect(0, 0, 4, 8)
  assert.ok(near(px(c, 1, 1), [128, 0, 127, 255]), String(px(c, 1, 1)))
  assert.deepEqual(px(c, 6, 1), [255, 0, 0, 255])
})

test('路径填充：圆的面积覆盖率与抗锯齿边缘', () => {
  const c = new pot.Canvas(64, 64)
  const g = c.getContext('2d')
  g.fillStyle = '#fff'
  g.beginPath()
  g.arc(32, 32, 20.5, 0, Math.PI * 2)
  g.fill()
  let sum = 0
  const d = g.getImageData(0, 0, 64, 64).data
  for (let i = 3; i < d.length; i += 4) sum += d[i] / 255
  assert.ok(Math.abs(sum - Math.PI * 20.5 * 20.5) < 8, `area=${sum}`)
  assert.equal(px(c, 32, 32)[3], 255)
  assert.equal(px(c, 2, 2)[3], 0)
  const edge = px(c, 52, 32)[3]
  assert.ok(edge > 0 && edge < 255, `edge=${edge}`)
})

test('非零环绕与 evenodd：反向内环挖洞', () => {
  const c = new pot.Canvas(20, 20)
  const g = c.getContext('2d')
  g.fillStyle = '#fff'
  g.beginPath()
  g.rect(0, 0, 20, 20)
  g.rect(5, 5, 10, 10)
  g.fill('evenodd')
  assert.equal(px(c, 10, 10)[3], 0)
  assert.equal(px(c, 2, 2)[3], 255)
})

test('线性 / 径向渐变', () => {
  const c = new pot.Canvas(100, 4)
  const g = c.getContext('2d')
  const lg = g.createLinearGradient(0, 0, 100, 0)
  lg.addColorStop(0, '#000')
  lg.addColorStop(1, '#fff')
  g.fillStyle = lg
  g.fillRect(0, 0, 100, 4)
  const mid = px(c, 50, 1)[0]
  assert.ok(Math.abs(mid - 128) < 4, `mid=${mid}`)
  assert.ok(px(c, 0, 1)[0] < 4 && px(c, 99, 1)[0] > 250)

  const r = new pot.Canvas(40, 40)
  const rg = r.getContext('2d')
  const grad = rg.createRadialGradient(20, 20, 0, 20, 20, 20)
  grad.addColorStop(0, 'rgba(255,255,255,1)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  rg.fillStyle = grad
  rg.fillRect(0, 0, 40, 40)
  assert.ok(px(r, 20, 20)[3] > 245)
  assert.ok(Math.abs(px(r, 30, 20)[3] - 128) < 8, String(px(r, 30, 20)))
  assert.equal(px(r, 0, 0)[3], 0)
})

test('描边：线宽、端点、变换', () => {
  const c = new pot.Canvas(40, 40)
  const g = c.getContext('2d')
  g.strokeStyle = '#fff'
  g.lineWidth = 4
  g.beginPath()
  g.moveTo(10, 20)
  g.lineTo(30, 20)
  g.stroke()
  assert.equal(px(c, 20, 19)[3], 255)
  assert.equal(px(c, 20, 23)[3], 0)
  assert.equal(px(c, 8, 20)[3], 0, 'butt 端点不外延')
  g.clearRect(0, 0, 40, 40)
  g.lineCap = 'square'
  g.stroke()
  assert.equal(px(c, 8, 20)[3], 255, 'square 端点外延半线宽')

  g.clearRect(0, 0, 40, 40)
  g.save()
  g.translate(20, 20)
  g.rotate(Math.PI / 2)
  g.lineCap = 'butt'
  g.beginPath()
  g.moveTo(-10, 0)
  g.lineTo(10, 0)
  g.stroke()
  g.restore()
  assert.equal(px(c, 20, 12)[3], 255, '旋转后竖线')
  assert.equal(px(c, 12, 20)[3], 0)
})

test('clip 与 destination-out', () => {
  const c = new pot.Canvas(20, 20)
  const g = c.getContext('2d')
  g.save()
  g.beginPath()
  g.rect(0, 0, 10, 20)
  g.clip()
  g.fillStyle = '#fff'
  g.fillRect(0, 0, 20, 20)
  g.restore()
  assert.equal(px(c, 5, 5)[3], 255)
  assert.equal(px(c, 15, 5)[3], 0)

  g.globalCompositeOperation = 'destination-out'
  g.fillRect(0, 0, 5, 20)
  assert.equal(px(c, 2, 5)[3], 0)
  assert.equal(px(c, 7, 5)[3], 255)
})

test('putImageData / drawImage / pixels 翻转', () => {
  const a = new pot.Canvas(2, 2)
  const ga = a.getContext('2d')
  const img = ga.createImageData(2, 2)
  img.data.set([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 255, 255])
  ga.putImageData(img, 0, 0)
  assert.deepEqual(px(a, 0, 1), [0, 0, 255, 255])
  const flipped = a.pixels(true)
  assert.deepEqual([...flipped.slice(0, 4)], [0, 0, 255, 255], 'flipY 后第一行是原最后一行')

  const b = new pot.Canvas(4, 4)
  b.getContext('2d').drawImage(a, 0, 0, 1, 1, 0, 0, 4, 4)
  assert.deepEqual(px(b, 3, 3), [255, 0, 0, 255])
})

test('fillText 走宿主栅格化，textAlign 生效', () => {
  const host = createHost()
  const c = new pot.Canvas(100, 40, host)
  const g = c.getContext('2d')
  g.font = 'bold 20px sans-serif'
  g.fillStyle = '#fff'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText('AB', 50, 20)
  assert.equal(host.engine.canvasTexts[0].size, 20)
  assert.match(host.engine.canvasTexts[0].family, /Microsoft YaHei/)
  assert.equal(px(c, 50, 20)[3], 255)
  assert.equal(px(c, 30, 20)[3], 0, '宽 24 居中，x=30 在外')
  assert.equal(Math.round(g.measureText('AB').width), 24)
  assert.throws(() => new pot.Canvas(4, 4).getContext('2d').fillText('x', 0, 0), /宿主/)
})

test('ctx.scene.canvas 上传贴图（行从下到上），插件卸载时销毁', async () => {
  const files = new Map([
    ['manifest.json', JSON.stringify({ id: 't', plugins: ['c'] })],
    ['src/plugins/c.js', unit('c', `
      const cv = ctx.scene.canvas(4, 2)
      const g = cv.getContext('2d')
      g.fillStyle = '#f00'; g.fillRect(0, 0, 4, 1)
      g.fillStyle = '#00f'; g.fillRect(0, 1, 4, 1)
      globalThis.__tex = cv.texture({ linear: true })
    `)],
  ])
  const { runtime, engine } = await startGame(files)
  assert.equal(runtime.failures.length, 0, runtime.failures[0]?.error)
  assert.equal(engine.textures.size, 1)
  const t = [...engine.textures.values()][0]
  assert.equal(t.width, 4)
  assert.equal(t.linear, true)
  await runtime.stop()
  assert.equal(engine.textures.size, 0)
  delete globalThis.__tex
})
