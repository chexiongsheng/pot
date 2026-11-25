const test = require('node:test')
const assert = require('node:assert/strict')
const { startGame, frames } = require('./helpers')

// MockEngine：屏幕 1280×720；量字宽 = 字数 × 字号 × 0.6，行高 = 字号 × 1.3

async function render(ui) {
  const src = `import { defineGame } from '@pot/core'
export default defineGame({ ui: (w, ui) => <>${ui}</> })
`
  const { runtime, engine, host } = await startGame(new Map([
    ['manifest.json', JSON.stringify({ id: 'ui.layout', plugins: ['game'] })],
    ['src/plugins/game.tsx', src],
  ]))
  assert.deepEqual(runtime.failures, [])
  frames(runtime, 1)
  const records = engine.ui ? engine.ui.split('\u001e').map((s) => s.split('\u001f')) : []
  return { records, errors: host.logs.filter((l) => l.level === 'error').map((l) => l.text), host }
}

const rects = (records) => records.filter((r) => r[0] === 'r').map((r) => r.slice(1, 5).map(Number))
const texts = (records) => records.filter((r) => r[0] === 't').map((r) => [Number(r[1]), Number(r[2]), Number(r[3]), Number(r[4]), r[9]])

test('column：内容尺寸、pad、gap；panel 画底色', async () => {
  const { records } = await render(`<panel at={[100, 50]} pad={10} gap={5}><text size={10}>ab</text><text size={10}>abcd</text></panel>`)
  assert.deepEqual(rects(records), [[100, 50, 44, 51]])
  assert.deepEqual(texts(records), [[110, 60, 12, 13, 'ab'], [110, 78, 24, 13, 'abcd']])
})

test('row：justify between 与 align center；grow 分剩余空间', async () => {
  const { records } = await render(`<row at={[0, 0]} w={200} h={50} justify="between" align="center">
    <bar value={0} w={20} h={10} /><bar value={0} w={20} h={10} /><bar value={0} w={20} h={10} />
  </row>
  <row at={[0, 100]} w={300}><panel w={50} h={4} pad={0} /><panel grow={1} h={4} pad={0} /><panel w={50} h={4} pad={0} /></row>`)
  const r = rects(records)
  assert.deepEqual(r.slice(0, 3), [[0, 20, 20, 10], [90, 20, 20, 10], [180, 20, 20, 10]])
  assert.deepEqual(r.slice(3), [[0, 100, 50, 4], [50, 100, 200, 4], [250, 100, 50, 4]])
})

test('百分比相对父容器内容区；stretch 撑满交叉轴；hidden 不占位', async () => {
  const { records } = await render(`<panel w="50%" pad={0} gap={0}><bar value={0} w="50%" h={4} /><bar value={0} w={10} h={4} hidden /><bar value={0} w={10} h={4} /></panel>
  <column at={[0, 300]} w={300} align="stretch"><panel pad={0} h={8} /></column>`)
  const r = rects(records)
  assert.deepEqual(r[0], [16, 16, 640, 8], '50% 的屏幕宽')
  assert.deepEqual(r[1], [16, 16, 320, 4], '50% 的父宽')
  assert.deepEqual(r[2], [16, 20, 10, 4], 'hidden 的不占位')
  assert.deepEqual(r[3], [0, 300, 300, 8], 'stretch')
})

test('顶层九宫格定位；wrap 按宽度断行', async () => {
  const { records } = await render(`<panel at="center" w={100} h={40} />
  <text at={[0, 0]} w={60} size={10} wrap>aaaa bbbb cccc</text>`)
  assert.deepEqual(rects(records)[0], [590, 340, 100, 40])
  assert.deepEqual(texts(records).map((t) => [t[1], t[4]]), [[0, 'aaaa bbbb'], [13, 'cccc']])
})

test('非法的尺寸与 at 报错，带行号', async () => {
  const { errors } = await render(`<panel at="middle" /><panel w="abc" at={[0, 0]} />`)
  assert.ok(errors.some((e) => /at 不认识 "middle"/.test(e) && /game\.tsx:\d+/.test(e)), errors.join('\n'))
  assert.ok(errors.some((e) => /尺寸必须是像素数或 'NN%'/.test(e)), errors.join('\n'))
})
