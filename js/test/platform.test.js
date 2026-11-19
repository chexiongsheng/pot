const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { startGame } = require('./helpers')
const { collectChars, findSourceFont } = require('../devserver/font')

test('平台缺能力显式化：没有 pot_gfx 后端时 gfx 给出原因并警告一次', async () => {
  const files = new Map([
    ['manifest.json', JSON.stringify({ id: 'nogfx', plugins: ['main'] })],
    ['src/plugins/main.ts', 'export const name = "main"\nexport function apply(ctx) { ctx.logger("t").info(`gfx=${ctx.gfx.supported}|${ctx.gfx.unsupported}`) }\n'],
  ])
  const { runtime, host } = await startGame(files, {
    setupHost(h) {
      h.engine.gfxBackend = () => ''
      h.engine.gfxUnsupported = () => '当前图形 API（Vulkan）不支持运行时着色器'
    },
  })
  assert.deepEqual(runtime.failures, [])
  const warns = host.logs.filter((l) => /运行时着色器不可用/.test(l.text))
  assert.equal(warns.length, 1)
  assert.match(warns[0].text, /Vulkan/)
  assert.equal(warns[0].level, 'warn')
  assert.ok(host.logs.some((l) => /gfx=false\|当前图形 API（Vulkan）/.test(l.text)))
})

test('平台缺能力显式化：有后端时不警告', async () => {
  const files = new Map([
    ['manifest.json', JSON.stringify({ id: 'gfx', plugins: [] })],
  ])
  const { host } = await startGame(files)
  assert.equal(host.logs.filter((l) => /运行时着色器不可用/.test(l.text)).length, 0)
})

test('发布字体：字符集取自暂存的游戏文件（含 \\u 转义），并补 ASCII 与常用标点', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pot-font-'))
  try {
    fs.mkdirSync(path.join(dir, 'data'))
    fs.writeFileSync(path.join(dir, 'bundle.cjs'), 'ui.text("\\u5F00\\u59CB\\u884C\\u52A8")\nconst a = "已暂停"\n')
    fs.writeFileSync(path.join(dir, 'data/level.json'), '{"name":"港区"}')
    fs.writeFileSync(path.join(dir, 'data/tex.png'), '猫')
    const chars = collectChars(dir, '龘')
    for (const ch of '开始行动已暂停港区龘A~，。') assert.ok(chars.includes(ch), `缺少 ${ch}`)
    assert.ok(!chars.includes('猫'), '二进制/非文本文件不参与')
    const cps = [...chars].map((c) => c.codePointAt(0))
    assert.deepEqual(cps, [...cps].sort((a, b) => a - b))
    assert.equal(new Set(chars).size, [...chars].length)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

test('发布字体：manifest.release.font 优先，路径不存在时报错', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pot-font-'))
  try {
    fs.writeFileSync(path.join(dir, 'my.ttf'), 'x')
    assert.deepEqual(findSourceFont({ release: { font: 'my.ttf' } }, dir), { file: path.join(dir, 'my.ttf'), from: 'manifest' })
    assert.throws(() => findSourceFont({ release: { font: 'none.ttf' } }, dir), /不存在/)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})
