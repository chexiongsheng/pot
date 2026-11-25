const test = require('node:test')
const assert = require('node:assert/strict')
const { startGame, frames, run } = require('./helpers')

// 布局（MockEngine 量字：宽 = 字数 × 字号 × 0.6，行高 = 字号 × 1.3），column 在 (100, 100)，gap 10：
//   Go 按钮 (100, 100) 51.2×36.8；No 按钮 y 146.8；输入框 y 193.6 200×32.8；scroll y 236.4 100×50；bar y 296.4
const GAME = 'src/plugins/game.tsx'
const SOURCE = `import { defineGame, definePrefab } from '@pot/core'
import topdown from '@pot/kit/topdown'

const Mover = definePrefab('mover', { moveTopdown: true })

export default defineGame({
  kits: [topdown],
  vars: { named: '' },
  flow: { start: 'title', states: { title: { on: { start: 'play' } }, play: {} } },
  scene: () => <>
    <Mover key="m" />
    <rule on="named" do={(w, p) => { w.vars.named = p.name }} />
  </>,
  ui: (w, ui) => <column at={[100, 100]} gap={10}>
    <button emit="start" onPress={() => { ui.local.n = (ui.local.n ?? 0) + 1 }}>Go</button>
    <button disabled onPress={() => { ui.local.bad = 1 }}>No</button>
    <input value={ui.local.name ?? ''} onChange={(v) => { ui.local.name = v }} onSubmit={(v) => ui.emit('named', { name: v })} placeholder="名字" />
    <scroll h={50} w={100}>{[1, 2, 3, 4, 5].map((i) => <text key={i}>{'row' + i}</text>)}</scroll>
    <bar value={0.5} w={100} h={6} />
    <image src={{ id: 3, width: 32, height: 16 }} w={64} />
  </column>,
})
`

async function start(src = SOURCE) {
  const ctx = await startGame(new Map([
    ['manifest.json', JSON.stringify({ id: 'ui.tags', plugins: ['game'] })],
    [GAME, src],
  ]))
  assert.deepEqual(ctx.runtime.failures, [])
  frames(ctx.runtime, 1)
  return ctx
}

const records = (engine) => engine.ui.split('\u001e').map((s) => s.split('\u001f'))
const w = (runtime) => runtime.root.world
const local = (runtime) => runtime.state.get('ui:game')

function click(ctx, x, y, releaseAt = [x, y]) {
  ctx.engine.mousePos = [x, y]
  ctx.engine.keys.add('mouse0')
  frames(ctx.runtime, 1)
  ctx.engine.mousePos = releaseAt
  ctx.engine.keys.delete('mouse0')
  frames(ctx.runtime, 1)
}

function tap(ctx, key, held = []) {
  for (const k of held) ctx.engine.keys.add(k)
  ctx.engine.keys.add(key)
  frames(ctx.runtime, 1)
  ctx.engine.keys.delete(key)
  for (const k of held) ctx.engine.keys.delete(k)
  frames(ctx.runtime, 1)
}

test('button：按下与抬起都在按钮上才触发；emit 进入下一步的指令并切换流程；disabled 不响应', async () => {
  const ctx = await start()
  const { runtime } = ctx
  click(ctx, 110, 110, [400, 400])
  assert.equal(local(runtime).n, undefined, '抬起时移开了')
  click(ctx, 110, 110)
  assert.equal(local(runtime).n, 1)
  assert.equal(w(runtime).flow.state, 'title', '事件在下一步才分发')
  frames(runtime, 1)
  assert.equal(w(runtime).flow.state, 'play')
  click(ctx, 110, 150)
  assert.equal(local(runtime).bad, undefined)
  assert.equal(local(runtime).$focus, null, '点到 disabled 上不获得焦点')
})

test('button 的绘制：底色、悬停、按下、焦点框；bar、image 的命令', async () => {
  const ctx = await start()
  const { engine } = ctx
  const r = records(engine)
  assert.deepEqual(r[0].slice(0, 6), ['r', '100', '100', '51.2', '36.8', '3a7bd5ff'])
  assert.ok(r.some((x) => x[0] === 'r' && x[2] === '296.4' && x[3] === '50'), 'bar 的前景是一半')
  assert.ok(r.some((x) => x[0] === 'i' && x[3] === '64' && x[4] === '32' && x[5] === '3'), 'image 按比例算高')
  engine.mousePos = [110, 110]
  frames(ctx.runtime, 1)
  assert.ok(records(engine).some((x) => x[0] === 'r' && x[5] === 'ffffff1f'), '悬停高亮')
})

test('焦点：Tab、Shift+Tab 跳过 disabled；Enter 触发按钮；有焦点时 World 不采样轴；Esc 取消', async () => {
  const ctx = await start()
  const { runtime, engine } = ctx
  tap(ctx, 'tab')
  assert.equal(local(runtime).$focus, 'column#0/button#0')
  tap(ctx, 'tab')
  assert.equal(local(runtime).$focus, 'column#0/input#0')
  tap(ctx, 'tab', ['leftshift'])
  assert.equal(local(runtime).$focus, 'column#0/button#0')
  assert.ok(records(engine).some((x) => x[0] === 'b' && x[5] === 'ffd54fff'), '焦点框')
  engine.axes.move = [1, 0]
  frames(runtime, 5)
  assert.deepEqual(w(runtime).query('mover')[0].pos, [0, 0, 0], '有焦点时不动')
  tap(ctx, 'return')
  frames(runtime, 1)
  assert.equal(local(runtime).n, 1)
  assert.equal(w(runtime).flow.state, 'play')
  tap(ctx, 'escape')
  assert.equal(local(runtime).$focus, null)
  frames(runtime, 5)
  assert.ok(w(runtime).query('mover')[0].pos[0] > 0, '焦点取消后恢复')
})

test('input：点击获得焦点，键入、退格调 onChange，回车调 onSubmit', async () => {
  const ctx = await start()
  const { runtime, engine } = ctx
  click(ctx, 120, 200)
  assert.equal(local(runtime).$focus, 'column#0/input#0')
  engine.typed = 'hi'
  frames(runtime, 1)
  assert.equal(local(runtime).name, 'hi')
  engine.typed = 'x\b\b'
  frames(runtime, 1)
  assert.equal(local(runtime).name, 'h')
  frames(runtime, 1)
  assert.ok(records(engine).some((x) => x[0] === 't' && x[9] === 'h'), '显示受控的值')
  engine.typed = '\n'
  frames(runtime, 2)
  assert.equal(w(runtime).vars.named, 'h')
})

test('scroll：裁剪、滚轮滚动并夹在范围内', async () => {
  const ctx = await start()
  const { runtime, engine } = ctx
  const rows = () => records(engine).filter((x) => x[0] === 't' && /^row/.test(x[9])).map((x) => [x[9], Number(x[2])])
  assert.ok(records(engine).some((x) => x.join(',') === 'c,100,236.4,100,50'))
  assert.deepEqual(rows()[0], ['row1', 236.4])
  engine.mousePos = [120, 250]
  engine.wheelDelta = -1
  frames(runtime, 2)
  assert.equal(local(runtime).$scroll['column#0/scroll#0'], 40)
  assert.ok(!rows().some(([name]) => name === 'row1'), '完全滚出可视区的不画')
  assert.equal(rows()[0][0], 'row2')
  assert.ok(Math.abs(rows()[0][1] - 217.2) < 1e-6, '上移 40')
  engine.wheelDelta = -5
  frames(runtime, 2)
  assert.ok(Math.abs(local(runtime).$scroll['column#0/scroll#0'] - 54) < 1e-6, '最多滚到内容高 104 减可视高 50')
})

test('ui.local 存在 state 里，热重载后保留', async () => {
  const ctx = await start()
  click(ctx, 110, 110)
  assert.equal(local(ctx.runtime).n, 1)
  const reply = await run(ctx.runtime, ctx.pot.devtools.handle({ id: 1, type: 'changed', paths: [GAME] }))
  assert.equal(reply.data.ok, true, reply.data.error)
  frames(ctx.runtime, 1)
  assert.equal(local(ctx.runtime).n, 1)
})

test('放错树：界面里写实体标签、场景里写界面标签都报错；列表缺 key 告警', async () => {
  const load = async (src) => {
    const { runtime, host } = await startGame(new Map([
      ['manifest.json', JSON.stringify({ id: 'ui.wrong', plugins: ['game'] })],
      [GAME, `import { defineGame } from '@pot/core'\nexport default defineGame(${src})\n`],
    ]))
    frames(runtime, 1)
    return host.logs.map((l) => `${l.level} ${l.text}`)
  }
  const logs = [
    ...(await load(`{ scene: () => <><button /></> }`)),
    ...(await load(`{ ui: () => <><entity /><column>{[1, 2].map((i) => <text>{i}</text>)}</column></> }`)),
  ]
  assert.ok(logs.some((t) => /<entity> 是场景标签，放错了树/.test(t)), logs.join('\n'))
  assert.ok(logs.some((t) => /<button> 是界面标签，放错了树/.test(t)), logs.join('\n'))
  assert.ok(logs.some((t) => /^warn .*列表里的 <text> 缺少 key/.test(t)), logs.join('\n'))
})
