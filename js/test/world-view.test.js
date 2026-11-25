const test = require('node:test')
const assert = require('node:assert/strict')
const { frames, run, loadPot } = require('./helpers')
const { startWorld, reloadGame, world, byPath } = require('./world-helpers')

const LOOK = (color = '#ff0000') => `
import { defineBlock } from '@pot/core'
import type { Context } from '@pot/core'
export const look = defineBlock({
  name: 'look', about: '方块外观', props: { color: '${color}' },
  view: {
    enter(me, e, ctx, w) { w.vars.enters = (w.vars.enters ?? 0) + 1; return ctx.scene.spawn({ shape: 'cube', name: 'look', color: me.color, scale: 0.5 }) },
    exit(me, e, objs, ctx, w) { w.vars.exits = (w.vars.exits ?? 0) + 1 },
  },
})
export function registerLook(ctx: Context) { ctx.effect(() => ctx.world.registry.addBlock(look)) }
`
const LOOK_FILE = 'src/lib/look.ts'

function game(body, prelude = '') {
  return {
    prelude: `import { registerLook } from '../lib/look'\nimport { createUIRenderer } from '@pot/core'\nconst Box = definePrefab('box', { look: true, mover: true })\n${prelude}`,
    body: `registerLook(ctx)\n${body}`,
  }
}

const start = (g, extra = {}) => startWorld(g, { extra: { [LOOK_FILE]: LOOK(), ...extra } })
const near = (a, b, msg) => a.forEach((v, i) => assert.ok(Math.abs(v - b[i]) < 1e-5, `${msg}：${a} ≈ ${b}`))
const looks = (engine) => engine.byName('look')

test('欧拉角换算与 Unity 的 Quaternion.Euler 一致；slerp 取短弧', () => {
  const pot = loadPot()
  const s = Math.SQRT1_2
  near(pot.eulerToQuaternion(0, 90, 0), [0, s, 0, s], 'y 90')
  near(pot.eulerToQuaternion(90, 0, 0), [s, 0, 0, s], 'x 90')
  near(pot.eulerToQuaternion(0, 0, 90), [0, 0, s, s], 'z 90')
  near(pot.eulerToQuaternion(90, 90, 0), [0.5, 0.5, -0.5, 0.5], '先 x 后 y')
  const axis = (ax, deg) => { const h = (deg * Math.PI) / 360; return [ax[0] * Math.sin(h), ax[1] * Math.sin(h), ax[2] * Math.sin(h), Math.cos(h)] }
  const mul = (a, b) => [
    a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
  ]
  near(pot.eulerToQuaternion(30, 40, 50), mul(axis([0, 1, 0], 40), mul(axis([1, 0, 0], 30), axis([0, 0, 1], 50))), '一般情况：qY * qX * qZ')
  near(pot.slerpQuaternion([0, 0, 0, 1], pot.eulerToQuaternion(0, 90, 0), 0.5), pot.eulerToQuaternion(0, 45, 0), '中点')
  near(pot.slerpQuaternion([0, 0, 0, 1], [0, 0, 0, -1], 0.5), [0, 0, 0, 1], '同一旋转的两个符号')
})

test('实体出现时 enter 创建场景对象，消失时 exit 并回收；对象展示为挂载所属单元，生命周期归内核', async () => {
  const { runtime, engine } = await start(game('w.mount(<><Box key="a" /><Box key="b" at={[2, 0, 0]} /></>)'))
  frames(runtime, 1)
  assert.equal(looks(engine).length, 2)
  assert.equal(world(runtime).vars.enters, 2)
  assert.equal(world(runtime).view.objectCount, 2)
  assert.equal(runtime.root.scene.list('game').length, 2, 'query objects game 能查到')
  assert.equal(runtime.root.scene.list('(host)').length, 0)
  world(runtime).destroy(byPath(runtime, 'box:b'))
  frames(runtime, 2)
  assert.equal(looks(engine).length, 1)
  assert.equal(world(runtime).vars.exits, 1)
})

test('变换：位置按 fixedAlpha 插值、旋转转四元数、缩放乘以创建时的缩放；一帧只调用一次 setTransforms', async () => {
  const { runtime, engine } = await start(game('w.mount(<><Box key="a" rot={[0, 90, 0]} scale={2} /><Box key="b" /></>)'))
  engine.axes.move = [1, 0]
  for (let i = 0; i < 7; i++) {
    const calls = engine.transformCalls ?? 0
    runtime.tick(1 / 150)
    assert.equal(engine.transformCalls, calls + 1, '一帧一次')
  }
  const e = byPath(runtime, 'box:a')
  const prev = world(runtime).prev.get(e.id)
  const alpha = runtime.root.clock.fixedAlpha
  assert.ok(alpha > 0 && alpha < 1, `alpha = ${alpha}`)
  const obj = engine.objects.get(world(runtime).view._entities.get(e.id).blocks.get('look').objs[0].id)
  near(obj.position, [prev.pos[0] + (e.pos[0] - prev.pos[0]) * alpha, 0, 0], '插值位置')
  assert.ok(obj.position[0] < e.pos[0])
  near(obj.quaternion, [0, Math.SQRT1_2, 0, Math.SQRT1_2], '旋转')
  near(obj.scale, [1, 1, 1], '2 × 0.5')
})

test('热重载：积木定义没变时对象保留；积木定义被替换时重做 exit 与 enter', async () => {
  const ctx = await start(game('w.mount(<Box key="a" />)'))
  const { runtime, engine } = ctx
  frames(runtime, 1)
  const id = looks(engine)[0].id
  await reloadGame(ctx, game('w.mount(<Box key="a" />) // 改一下'))
  frames(runtime, 1)
  assert.equal(looks(engine).length, 1)
  assert.equal(looks(engine)[0].id, id, 'look.ts 没改，对象不重建')

  ctx.files.set(LOOK_FILE, LOOK('#00ff00'))
  const reply = await run(runtime, ctx.pot.devtools.handle({ id: 2, type: 'changed', paths: [LOOK_FILE] }))
  assert.equal(reply.data.ok, true, reply.data.error)
  frames(runtime, 1)
  assert.equal(looks(engine).length, 1)
  assert.notEqual(looks(engine)[0].id, id, '定义替换后重建')
  assert.equal(world(runtime).vars.exits, 1)
  assert.equal(world(runtime).vars.enters, 2)
})

test('stage：只在变化时调用 scene；sun 变了先销毁旧的平行光', async () => {
  const stage = (sun) => `w.mount(<stage background="#102030" sun={${sun}} camera={{ at: [0, 10, -10], look: [0, 0, 0] }} />)`
  const ctx = await start(game(stage('[50, -30, 0]')))
  const { runtime, engine } = ctx
  let backgrounds = 0
  const setBackground = engine.setBackground.bind(engine)
  engine.setBackground = (...a) => { backgrounds++; setBackground(...a) }
  frames(runtime, 5)
  assert.equal(backgrounds, 1)
  near(engine.background, [0x10 / 255, 0x20 / 255, 0x30 / 255], '背景')
  assert.deepEqual(engine.camera.position, [0, 10, -10])
  assert.deepEqual(engine.camera.target, [0, 0, 0])
  const suns = () => [...engine.objects.values()].filter((o) => o.light === 'directional')
  assert.equal(suns().length, 1)
  assert.deepEqual(suns()[0].rotation, [50, -30, 0])
  assert.equal(suns()[0].intensity, 1)
  const first = suns()[0].id

  await reloadGame(ctx, game(stage("{ rot: [30, 0, 0], intensity: 2, color: '#ffeedd' }")))
  frames(runtime, 2)
  assert.equal(backgrounds, 1, '背景没变')
  assert.equal(suns().length, 1)
  assert.notEqual(suns()[0].id, first)
  assert.equal(suns()[0].intensity, 2)
})

test('界面求值器：顶层节点按九宫格放进离边缘 16 像素的区域、文字拼成一行；不认识的标签只报一次', async () => {
  const body = `w.mergeVars({ score: 3 })
  const render = createUIRenderer((m) => ctx.logger('ui').error(m))
  const Hud = (p: { n: number }) => <text at="bottom">{'第 '}{p.n}{' 关'}</text>
  ctx.on('update', () => render(<>
    <text at="top-right" size={24} color="#ffcc00" bold>分数：{w.vars.score}</text>
    {[<text at={[10, 20]}>a</text>, null, false]}
    <Hud n={2} />
    <box />
  </>, ctx.ui))
  w.mount(null)`
  const { runtime, engine, host } = await start(game(body))
  frames(runtime, 3)
  const items = engine.ui.split('\u001e').map((s) => s.split('\u001f'))
  // MockEngine 量字：宽 = 字数 × 字号 × 0.6，行高 = 字号 × 1.3；文字在自己的框里左对齐、垂直居中（对齐码 3）
  assert.deepEqual(items.map((t) => [t[0], t[1], t[2], t[3], t[4], t[6], t[7], t[9]]), [
    ['t', '1206.4', '16', '57.6', '31.2', '24', '3', '分数：3'],
    ['t', '10', '20', '9.6', '20.8', '16', '3', 'a'],
    ['t', '616', '683.2', '48', '20.8', '16', '3', '第 2 关'],
  ])
  assert.equal(items[0][5], 'ffcc00ff')
  assert.equal(items[0][8], '1', '粗体')
  const errors = host.logs.filter((l) => l.level === 'error' && /<box>/.test(l.text))
  assert.equal(errors.length, 1)
  assert.match(errors[0].text, /game\.tsx:\d+ /)
})
