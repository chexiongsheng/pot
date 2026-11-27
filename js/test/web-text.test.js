/**
 * Web 宿主的文字贴图（004 第 20.8 节 web-3）：textTexture 与 canvasText 的排版照 PotRender.TextTexture / CanvasText。
 * 用假的 2D 上下文：每个字宽 0.5 倍字号，记录 fillText 的位置；getImageData 顶行红、底行蓝，用来核对行翻转。
 */
const test = require('node:test')
const assert = require('node:assert/strict')
const { loadWebPot } = require('./helpers')

const web = () => loadWebPot().web

function fakeCtx() {
  const ctx = {
    canvas: { width: 300, height: 150 },
    font: '',
    fillStyle: '',
    textAlign: '',
    textBaseline: '',
    calls: [],
    sizeOf() {
      return Number(/(\d+)px/.exec(ctx.font)?.[1] ?? 10)
    },
    clearRect() {
      ctx.calls.push(['clear'])
    },
    fillRect(x, y, w, h) {
      ctx.calls.push(['rect', x, y, w, h, ctx.fillStyle])
    },
    fillText(t, x, y) {
      ctx.calls.push(['text', t, x, y, ctx.font, ctx.fillStyle])
    },
    measureText(t) {
      const s = ctx.sizeOf()
      const width = Array.from(t).length * s * 0.5
      return { width, actualBoundingBoxLeft: 0, actualBoundingBoxRight: width, actualBoundingBoxAscent: s * 0.7, actualBoundingBoxDescent: s * 0.2, fontBoundingBoxAscent: s * 0.9 }
    },
    getImageData(x, y, w, h) {
      const data = new Uint8ClampedArray(w * h * 4)
      for (let i = 0; i < w; i++) {
        data.set([255, 0, 0, 200], i * 4)
        data.set([0, 0, 255, 100], ((h - 1) * w + i) * 4)
      }
      return { data }
    },
  }
  return ctx
}

function fakeHost(ctx) {
  const logs = []
  const host = web().createWebHost({
    files: { 'manifest.json': '{"id":"t"}' },
    ui: { submit() {}, measure: () => [0, 0] },
    platform: { screen: () => [800, 600], focused: () => true, cursor() {}, cursorLocked: () => false },
    text2d: ctx ? () => ctx : null,
    log: (level, text) => logs.push({ level, text }),
  })
  host.logs = logs
  return host
}

const texts = (ctx) => ctx.calls.filter((c) => c[0] === 'text').map((c) => [c[1], c[2], c[3]])

test('textTexture：行高 1.2 倍字号、竖直居中、基线偏移 0.2 倍字号，三种对齐与字距', () => {
  const ctx = fakeCtx()
  const host = fakeHost(ctx)
  const e = host.engine
  // 字宽 10；行高 24；行顶 (40 + 24) / 2 = 32；基线 32 - 24 + 2 + 4 = 14，画布 y = 40 - 14 = 26
  const id = e.textTexture(JSON.stringify({ text: 'ab', width: 100, height: 40, size: 20 }))
  assert.ok(id > 0)
  assert.deepEqual(texts(ctx), [['a', 40, 26], ['b', 50, 26]])
  const t = host.scene.textures.get(id)
  assert.deepEqual([t.width, t.height, t.linear, t.mipmaps, t.wrap, t.filter, t.aniso], [100, 40, false, true, 1, 2, 4])
  assert.deepEqual(Array.from(t.data.subarray(0, 4)), [0, 0, 255, 100], '贴图第 0 行是画布底行')
  assert.deepEqual(Array.from(t.data.subarray(t.data.length - 4)), [255, 0, 0, 200])
  assert.ok(!ctx.calls.some((c) => c[0] === 'rect'), '透明背景不填充')

  ctx.calls.length = 0
  e.textTexture(JSON.stringify({ text: 'ab', width: 100, height: 40, size: 20, align: 0, letterSpacing: 2, bold: 1, color: [1, 0.5, 0], background: [0, 0, 0, 0.5] }))
  assert.deepEqual(texts(ctx), [['a', 5, 26], ['b', 17, 26]])
  assert.match(ctx.calls.find((c) => c[0] === 'text')[4], /^bold 20px /)
  assert.equal(ctx.calls.find((c) => c[0] === 'text')[5], 'rgba(255,128,0,1)')
  assert.deepEqual(ctx.calls.find((c) => c[0] === 'rect'), ['rect', 0, 0, 100, 40, 'rgba(0,0,0,0.5)'])

  ctx.calls.length = 0
  e.textTexture(JSON.stringify({ text: 'ab', width: 100, height: 40, size: 20, align: 2 }))
  assert.deepEqual(texts(ctx), [['a', 75, 26], ['b', 85, 26]])

  // 两行：总高 48，行顶 (40 + 48) / 2 = 44；第一行基线 26，第二行 2；给定 x 为笔起点
  ctx.calls.length = 0
  e.textTexture(JSON.stringify({ text: 'a\nb', width: 100, height: 40, size: 20, x: 3 }))
  assert.deepEqual(texts(ctx), [['a', 3, 14], ['b', 3, 38]])
  // 给定 y（左下为原点的行顶）
  ctx.calls.length = 0
  e.textTexture(JSON.stringify({ text: 'a', width: 100, height: 40, size: 20, y: 30 }))
  assert.deepEqual(texts(ctx), [['a', 45, 28]])
  // 尺寸与字号夹取
  const small = host.scene.textures.get(e.textTexture(JSON.stringify({ text: 'a', width: 1, height: 99999, size: 1 })))
  assert.deepEqual([small.width, small.height], [4, 4096])
  assert.match(ctx.font, /^4px /)
  assert.equal(host.unsupported.size, 0)
})

test('canvasText：头部 [w, h, ox, base, advance, ascent, descent, 0] 与 alpha 位图（行从上到下）', () => {
  const ctx = fakeCtx()
  const e = fakeHost(ctx).engine
  // 字号 20，"ab"：前进 20，墨迹 x 0..20，上 14 下 4；ascent 18，descent max(2, 3) = 3
  const buf = e.canvasText('ab', 'Arial,Microsoft YaHei,sans-serif', 20, 3)
  const hd = Array.from(new Float32Array(buf, 0, 8))
  assert.deepEqual(hd, [24, 22, 2, 16, 20, 18, 3, 0])
  assert.equal(buf.byteLength, 32 + 24 * 22)
  const call = ctx.calls.find((c) => c[0] === 'text')
  assert.deepEqual(call.slice(1, 4), ['ab', 2, 16])
  assert.equal(call[4], 'italic bold 20px "Arial", "Microsoft YaHei", sans-serif')
  const alpha = new Uint8Array(buf, 32)
  assert.equal(alpha[0], 200, '顶行')
  assert.equal(alpha[alpha.length - 1], 100, '底行')
  const empty = e.canvasText('  ', 'Arial', 20, 0)
  assert.equal(empty.byteLength, 32)
  assert.deepEqual(Array.from(new Float32Array(empty, 0, 2)), [0, 0])
  e.canvasText('a\nb', 'Arial', 20, 0)
  assert.equal(ctx.calls.filter((c) => c[0] === 'text').pop()[1], 'a b', '换行折成空格')
})

test('没有 2D 上下文时 textTexture 返回 0、canvasText 返回 null，且不告警', () => {
  const host = fakeHost(null)
  assert.equal(host.engine.textTexture(JSON.stringify({ text: 'a' })), 0)
  assert.equal(host.engine.canvasText('a', 'Arial', 12, 0), null)
  assert.equal(host.logs.length, 0)
  assert.equal(host.unsupported.size, 0)
})
