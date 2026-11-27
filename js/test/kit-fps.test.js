/**
 * fps 套件（004 第 17.5 节）：增量输入按帧累积、moveFps、cameraFps、health/damage、gunFps、aiChase、aiPatrol。
 */
const test = require('node:test')
const assert = require('node:assert/strict')
const { startWorld, world, byPath } = require('./world-helpers')

const DT = 1 / 60

const PRELUDE = `import fps, { damage } from '@pot/kit/fps'
import { defineBlock } from '@pot/core'
const Looker = defineBlock({
  name: 'looker', about: '累计 look 轴', state: { x: 0, y: 0, steps: 0 },
  step(me, e, w) { const a = w.cmd(e).axis('look'); me.x += a.x; me.y += a.y; me.steps++ },
})
const Hitbox = defineBlock({
  name: 'hitbox', about: '只在表现里的命中体', props: { tag: 'body' },
  view: { enter(me, e, ctx, w) { const o = ctx.scene.spawn({ shape: 'cube', name: 'hitbox' }); w.view.bindPart(o.id, e, me.tag); return o } },
})
const Part = defineBlock({
  name: 'part', about: '测试：可被射中的部件', props: { tag: '' },
  view: { enter(me, e, ctx, w) { const o = ctx.scene.spawn({ shape: 'cube', name: 'part' }); w.view.bindPart(o.id, e, me.tag || undefined); return o } },
})`

function body(tree, extra = '') {
  return `for (const b of fps.blocks) ctx.effect(() => w.registry.addBlock(b))
  ctx.effect(() => w.registry.addBlock(Looker))
  ctx.effect(() => w.registry.addBlock(Hitbox))
  for (const [k, f] of Object.entries(fps.on ?? {})) w.on(k, f as any)
  ctx.effect(() => w.registry.addBlock(Part))
  w.setControls(fps.controls)
  ;(globalThis as any).fpsDamage = damage
  ${extra}
  w.mount(<>${tree}</>)`
}

async function start(tree, extra) {
  const ctx = await startWorld({ prelude: PRELUDE, body: body(tree, extra) })
  return { ...ctx, w: world(ctx.runtime), at: (key) => byPath(ctx.runtime, `entity:${key}`) }
}

/** 推进 n 个固定步（每帧半步，一步两帧） */
function steps(runtime, n) {
  const w = world(runtime)
  const target = w.tick + n
  for (let i = 0; i < n * 4 && w.tick < target; i++) runtime.tick(DT / 2)
  assert.equal(w.tick, target)
}

/** 按住一个键走一步再松开（pressed 只在这一步为真） */
function tap(g, key) {
  g.engine.keys.add(key)
  steps(g.runtime, 1)
  g.engine.keys.delete(key)
}

const near = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg ?? ''} 期望 ${b}，实际 ${a}`)

// ---------------------------------------------------------------- 增量输入

test('look 增量按帧累积：一帧多步只计一次，没有步的帧累积到下一步；界面捕获时为 0', async () => {
  const g = await start('<entity key="p" looker />')
  const me = () => g.at('p').b.looker
  g.engine.axes.look = [1, 0.5]
  // 每帧半步：10 帧 5 步，每帧的增量都计入
  for (let i = 0; i < 10; i++) g.runtime.tick(DT / 2)
  assert.equal(me().steps, 5)
  assert.equal(me().x, 10)
  assert.equal(me().y, 5)
  // 每帧两步：5 帧 10 步，每帧只计一次
  for (let i = 0; i < 5; i++) g.runtime.tick(DT * 2)
  assert.equal(me().steps, 15)
  assert.equal(me().x, 15)
  // 界面捕获：不计也不累积
  g.w.setUICapture('menu', true)
  for (let i = 0; i < 4; i++) g.runtime.tick(DT / 2)
  g.w.setUICapture('menu', false)
  assert.equal(me().x, 15)
  g.engine.axes.look = [0, 0]
  for (let i = 0; i < 4; i++) g.runtime.tick(DT / 2)
  assert.equal(me().x, 15, '捕获期间的增量没有留到之后')
  // move 不是增量：一帧多步时每步都取当前值
  assert.equal(g.w.controls.axes.move, 'move')
})

// ---------------------------------------------------------------- moveFps

test('moveFps：走与跑的速度、朝向、视角', async () => {
  const g = await start('<entity key="p" at={[0, 0, 0]} rot={[0, 90, 0]} moveFps />')
  const p = () => g.at('p')
  const me = () => p().b.moveFps
  assert.equal(me().yaw, 90, 'yaw 取 e.rot[1]')
  g.engine.axes.move = [0, 1]
  steps(g.runtime, 60)
  near(me().speed, 3.8, 1e-9, '走')
  near(me().vel[0], 3.8, 1e-9, 'yaw 90 朝 +x')
  near(p().pos[2], 0, 1e-9)
  assert.equal(me().grounded, true)
  assert.ok(me().bob > 0)
  g.engine.keys.add('leftshift')
  steps(g.runtime, 60)
  near(me().speed, 6.4, 1e-9, '跑')
  assert.equal(me().sprinting, true)
  me().aim = 1
  steps(g.runtime, 60)
  near(me().speed, 2.4, 1e-9, '瞄准时不能跑')
  assert.equal(me().sprinting, false)
  me().aim = 0
  g.engine.keys.delete('leftshift')
  g.engine.axes.move = [0, 0]
  steps(g.runtime, 60)
  assert.equal(me().speed, 0)
  // 视角：每单位增量 2 度（一步两帧，两帧的增量都计入），pitch 有上限
  g.engine.axes.look = [3, 0]
  steps(g.runtime, 1)
  g.engine.axes.look = [0, 0]
  near(me().yaw, 102, 1e-9)
  assert.deepEqual(p().rot, [0, me().yaw, 0])
  g.engine.axes.look = [0, 100]
  steps(g.runtime, 1)
  g.engine.axes.look = [0, 0]
  assert.equal(me().pitch, -86)
})

test('moveFps：跳跃顶点高度约为 jumpApex', async () => {
  const g = await start('<entity key="p" moveFps />')
  const p = () => g.at('p')
  steps(g.runtime, 2)
  tap(g, 'space')
  let top = 0
  for (let i = 0; i < 90; i++) {
    steps(g.runtime, 1)
    top = Math.max(top, p().pos[1])
  }
  // 半隐式欧拉：顶点比 v0²/2g 低约 v0·dt/2
  near(top, 1, 0.07, '顶点')
  assert.equal(p().pos[1], 0)
  assert.equal(p().b.moveFps.grounded, true)
})

/** 平台 z ∈ [-10, 2]，顶面 y=0；没有无限地面。玩家朝 +z 走出边缘 */
const LEDGE = '<entity key="deck" at={[0, -0.5, -4]} body={{ size: [4, 1, 12] }} /><entity key="p" at={[0, 0, 0]} moveFps={{ ground: null }} />'

async function walkOff(delay) {
  const g = await start(LEDGE)
  const me = () => g.at('p').b.moveFps
  g.engine.axes.move = [0, 1]
  let n = 0
  while (me().grounded) {
    steps(g.runtime, 1)
    assert.ok(++n < 200)
  }
  g.engine.axes.move = [0, 0]
  for (let i = 0; i < delay; i++) steps(g.runtime, 1)
  tap(g, 'space')
  return me().vel[1]
}

test('moveFps：土狼时间内离开边缘仍能起跳，超过就不行', async () => {
  // 土狼 0.12 秒约 7 步；离地那一步已经扣了一次
  assert.ok((await walkOff(3)) > 5, '3 步后起跳')
  assert.ok((await walkOff(9)) < 0, '9 步后不能起跳')
})

test('moveFps：落地前按跳，缓冲时间内落地即起跳', async () => {
  // 先不按，找到落地的步
  const g = await start('<entity key="p" at={[0, 1.5, 0]} moveFps />')
  const me = () => g.at('p').b.moveFps
  steps(g.runtime, 1)
  let L = 1
  while (!me().grounded) {
    steps(g.runtime, 1)
    L++
  }
  assert.ok(L > 10)
  // 落地前 4 步按：缓冲 0.13 秒约 7.8 步，落地后下一步起跳，之后又在空中
  const early = await start('<entity key="p" at={[0, 1.5, 0]} moveFps />')
  const m2 = () => early.at('p').b.moveFps
  for (let i = 0; i < L - 4; i++) steps(early.runtime, 1)
  tap(early, 'space')
  let jumped = false
  for (let i = 0; i < 10; i++) {
    steps(early.runtime, 1)
    if (m2().vel[1] > 5) jumped = true
  }
  assert.ok(jumped, '缓冲内起跳')
  // 落地前 12 步按：缓冲过期
  const late = await start('<entity key="p" at={[0, 1.5, 0]} moveFps />')
  const m3 = () => late.at('p').b.moveFps
  for (let i = 0; i < L - 12; i++) steps(late.runtime, 1)
  tap(late, 'space')
  for (let i = 0; i < 20; i++) {
    steps(late.runtime, 1)
    assert.ok(m3().vel[1] <= 0, '缓冲过期不起跳')
  }
  assert.equal(m3().grounded, true)
  assert.ok(m3().landed === 0)
})

test('moveFps：蹲下钻到低顶下，起身被挡就保持蹲伏；出来后能起身', async () => {
  // 顶的底面在 y=1.5，z ∈ [-2, 2]
  const g = await start('<entity key="roof" at={[0, 2, 0]} body={{ size: [4, 1, 4] }} /><entity key="p" at={[0, 0, -5]} moveFps />')
  const p = () => g.at('p')
  const me = () => p().b.moveFps
  tap(g, 'c')
  assert.equal(me().crouched, true)
  steps(g.runtime, 60)
  near(me().curHeight, 1.15, 0.01, '蹲下后的高度')
  g.engine.axes.move = [0, 1]
  while (p().pos[2] < 0) steps(g.runtime, 1)
  g.engine.axes.move = [0, 0]
  steps(g.runtime, 30)
  tap(g, 'c')
  steps(g.runtime, 30)
  assert.equal(me().crouched, true, '顶头不能起身')
  assert.ok(me().curHeight < 1.5)
  // 不能跳
  tap(g, 'space')
  assert.ok(me().vel[1] <= 0)
  g.engine.axes.move = [0, -1]
  while (p().pos[2] > -4) steps(g.runtime, 1)
  g.engine.axes.move = [0, 0]
  tap(g, 'c')
  steps(g.runtime, 60)
  assert.equal(me().crouched, false)
  near(me().curHeight, 1.8, 0.01)
})

test('moveFps：掉出 fallY 或出 bounds 时拉回 lastSafe', async () => {
  const g = await start('<entity key="p" at={[1, 0, 1]} moveFps={{ ground: { y: 0, maxX: 3 }, fallY: -5, bounds: { min: [-10, -10], max: [10, 2] } }} />')
  const p = () => g.at('p')
  const me = () => p().b.moveFps
  g.engine.axes.move = [1, 0]
  let fell = false
  for (let i = 0; i < 300 && !fell; i++) {
    steps(g.runtime, 1)
    if (p().pos[1] < -1) fell = true
  }
  assert.ok(fell, '走出地面掉下去')
  g.engine.axes.move = [0, 0]
  for (let i = 0; i < 120; i++) steps(g.runtime, 1)
  assert.equal(p().pos[1], 0, '拉回后站在地面上')
  assert.ok(p().pos[0] <= 3 && p().pos[0] > 2, `拉回到地面边缘：${p().pos[0]}`)
  assert.equal(me().grounded, true)
  g.engine.axes.move = [0, 1]
  for (let i = 0; i < 60; i++) {
    steps(g.runtime, 1)
    assert.ok(p().pos[2] <= 2 + 0.1, `不出 bounds：${p().pos[2]}`)
  }
})

// ---------------------------------------------------------------- cameraFps

test('cameraFps：相机在眼高处，锁定鼠标，fov 随瞄准变化；表现层不动 World 的随机序列', async () => {
  const g = await start('<entity key="p" at={[2, 0, 3]} moveFps cameraFps />')
  const me = () => g.at('p').b.moveFps
  steps(g.runtime, 2)
  assert.equal(g.engine.locked, true)
  const cam = g.engine.camera
  near(cam.position[0], 2, 1e-6)
  near(cam.position[1], 1.68, 1e-6)
  near(cam.position[2], 3, 1e-6)
  assert.equal(cam.fov, 74)
  me().aim = 1
  g.at('p').b.cameraFps.shake = 1
  const seed = g.w.data.seed
  steps(g.runtime, 2)
  assert.equal(cam.fov, 52)
  assert.equal(g.w.data.seed, seed)
  assert.ok(g.at('p').b.cameraFps.shake < 1, 'shake 衰减')
})

// ---------------------------------------------------------------- health

test('health：扣血、damaged/died 事件、回血、死后不再扣', async () => {
  const extra = `w.on('damaged', (w, p) => { (w.vars.log ??= []).push(['damaged', p.entity.id, p.amount, p.from]) })
  w.on('died', (w, p) => { (w.vars.log ??= []).push(['died', p.entity.id, p.amount, p.from]) })`
  const g = await start('<entity key="a" health={{ max: 50, regen: 10, regenDelay: 1 }} /><entity key="b" />', extra)
  const damage = globalThis.fpsDamage
  const a = () => g.at('a')
  steps(g.runtime, 1)
  assert.equal(a().b.health.hp, 50)
  assert.equal(damage(g.w, g.at('b'), 10), false, '没有 health')
  assert.equal(damage(g.w, a(), 20, g.at('b')), true)
  assert.equal(a().b.health.hp, 30)
  steps(g.runtime, 1)
  assert.deepEqual(g.w.vars.log, [['damaged', a().id, 20, g.at('b').id]])
  steps(g.runtime, 59)
  assert.equal(a().b.health.hp, 30, 'regenDelay 内不回血')
  steps(g.runtime, 60)
  assert.ok(a().b.health.hp > 30 && a().b.health.hp < 40, `回血：${a().b.health.hp}`)
  steps(g.runtime, 300)
  assert.equal(a().b.health.hp, 50, '回满为止')
  damage(g.w, a(), 80)
  steps(g.runtime, 1)
  assert.equal(a().b.health.hp, 0)
  assert.deepEqual(g.w.vars.log.slice(1), [['damaged', a().id, 80, null], ['died', a().id, 80, null]])
  assert.equal(damage(g.w, a(), 5), false, '死后不再扣')
  steps(g.runtime, 300)
  assert.equal(a().b.health.hp, 0, '死后不回血')
  assert.ok(a(), 'died 不销毁实体')
})

test('feedbackFps：受伤累加红屏与震屏、计 hits 并按 hurtFade 褪去；从高处落下计一次重落地', async () => {
  const g = await start('<entity key="p" at={[0, 3, 0]} moveFps cameraFps health feedbackFps />')
  const damage = globalThis.fpsDamage
  const p = () => g.at('p')
  steps(g.runtime, 60)
  assert.equal(p().b.feedbackFps.lands, 1, '从 3 米落下（约 11 米/秒）算重落地')
  assert.equal(p().b.feedbackFps.hits, 0)
  damage(g.w, p(), 20)
  steps(g.runtime, 1)
  const f = p().b.feedbackFps
  assert.equal(f.hits, 1)
  near(f.hurt, 0.35 + 20 / 40, 0.03, '红屏 hurtBase + 伤害/hurtDamage')
  assert.ok(p().b.cameraFps.shake > 0.5, `震屏：${p().b.cameraFps.shake}`)
  damage(g.w, p(), 40)
  steps(g.runtime, 1)
  assert.equal(p().b.feedbackFps.hurt, 1, '红屏封顶 1')
  steps(g.runtime, 30)
  near(p().b.feedbackFps.hurt, 1 - 0.6, 0.03, '每秒褪 1.2')
  steps(g.runtime, 30)
  assert.equal(p().b.feedbackFps.hurt, 0)
})

// ---------------------------------------------------------------- gunFps

const LOG_GUN = `w.on('gunFired', (w, p) => { (w.vars.fired ??= []).push(p.shot) })
  w.on('gunHit', (w, p) => { (w.vars.hits ??= []).push([p.target.id, p.shot, p.damage, p.weak]) })`

test('gunFps：按住开火按射速出弹，world 模式当步发 gunFired、gunHit；后坐写回 cameraFps.kick，弹道抽 World 随机数', async () => {
  const g = await start('<entity key="p" at={[0, 0, 0]} moveFps cameraFps gunFps={{ rpm: 600 }} /><entity key="t" at={[0, 1.6, 5]} body={{ size: [2, 2, 2] }} />', LOG_GUN)
  const me = () => g.at('p').b.gunFps
  steps(g.runtime, 1)
  assert.equal(me().mag, 30)
  assert.equal(me().reserve, 150)
  const seed = g.w.data.seed
  g.engine.keys.add('mouse0')
  steps(g.runtime, 30)
  g.engine.keys.delete('mouse0')
  steps(g.runtime, 1)
  const n = me().shots
  assert.ok(n >= 5 && n <= 6, `0.5 秒 600 rpm：${n} 发`)
  assert.equal(me().mag, 30 - n)
  assert.deepEqual(g.w.vars.fired, Array.from({ length: n }, (_, i) => i + 1))
  const t = g.at('t').id
  assert.deepEqual(g.w.vars.hits, Array.from({ length: n }, (_, i) => [t, i + 1, 26, false]))
  assert.ok(me().fired.every((s) => s.r === 1))
  assert.notEqual(g.w.data.seed, seed, '散布与水平后坐抽 w.rand')
  assert.ok(me().recoilP < 0, '枪口上跳')
  assert.ok(me().bloom > 0)
  assert.deepEqual(g.at('p').b.cameraFps.kick, [me().recoilP, me().recoilY])
  steps(g.runtime, 120)
  near(me().recoilP, 0, 0.01, '松开扳机后坐回复')
  // 开镜：aim 写回 moveFps，散布收窄
  g.engine.keys.add('mouse1')
  steps(g.runtime, 20)
  assert.equal(me().ads, 1)
  assert.equal(g.at('p').b.moveFps.aim, 1)
  near(me().spread, 0.0025, 1e-3)
  g.engine.keys.delete('mouse1')
})

test('gunFps：打空自动换弹（空仓：1.345 秒补弹，2.19 秒枪机复位），战术换弹，没有备弹时空仓扣扳机', async () => {
  const g = await start('<entity key="p" moveFps gunFps={{ magSize: 3, reserveStart: 4, rpm: 60000 }} />')
  const me = () => g.at('p').b.gunFps
  steps(g.runtime, 1)
  g.engine.keys.add('mouse0')
  steps(g.runtime, 1)
  assert.equal(me().shots, 3, '一步最多 3 发')
  assert.equal(me().mag, 0)
  assert.equal(me().boltLocked, true)
  steps(g.runtime, 1)
  g.engine.keys.delete('mouse0')
  assert.equal(me().reloading, true)
  assert.equal(me().reloadTotal, 2.72)
  assert.equal(me().reloads, 1)
  steps(g.runtime, 80)
  assert.equal(me().mag, 0)
  steps(g.runtime, 1)
  assert.equal(me().mag, 3)
  assert.equal(me().reserve, 1)
  assert.equal(me().boltLocked, true, '空仓换弹补弹时枪机还没复位')
  steps(g.runtime, 51)
  assert.equal(me().boltLocked, false)
  assert.equal(me().reloading, true)
  steps(g.runtime, 32)
  assert.equal(me().reloading, false)
  // 战术换弹
  me().mag = 1
  tap(g, 'r')
  assert.equal(me().reloading, true)
  assert.equal(me().reloadTotal, 2.1)
  assert.equal(me().reloads, 2)
  tap(g, 'mouse0')
  assert.equal(me().shots, 3, '换弹中不开火')
  steps(g.runtime, 130)
  assert.equal(me().reloading, false)
  assert.equal(me().mag, 2)
  assert.equal(me().reserve, 0)
  tap(g, 'r')
  assert.equal(me().reloading, false, '没有备弹不换弹')
  me().mag = 0
  tap(g, 'mouse0')
  assert.equal(me().dry, 1)
  assert.equal(me().reloading, false)
  // 不活跃时不开火
  me().mag = 2
  me().active = false
  tap(g, 'mouse0')
  assert.equal(me().shots, 3)
})

test('gunFps：view 模式由表现层射线查部件登记，经 emitUI 回写 gunReport 再转成 gunHit；弱点乘倍率，重复与非法报告忽略', async () => {
  const extra = `for (const [n, f] of Object.entries(fps.on ?? {})) w.on(n, f as any)
  ${LOG_GUN}`
  const tree = `<entity key="p" moveFps cameraFps gunFps={{ hitscan: 'view', rpm: 600 }} />
    <entity key="t" at={[0, 1.6, 5]} part={{ tag: 'weak' }} />
    <entity key="u" at={[3, 1.6, 5]} part />`
  const g = await start(tree, extra)
  const me = () => g.at('p').b.gunFps
  steps(g.runtime, 2)
  const [ot, ou] = g.engine.byName('part').map((o) => o.id)
  const t = g.at('t').id, u = g.at('u').id, p = g.at('p').id
  g.engine.nextHit = { id: ot, point: [0, 1.6, 4.5], normal: [0, 0, -1], distance: 4.5 }
  tap(g, 'mouse0')
  assert.deepEqual(g.w.vars.fired, [1])
  assert.equal(g.w.vars.hits, undefined, '命中在表现层，下一步才回写')
  steps(g.runtime, 1)
  assert.deepEqual(g.w.vars.hits, [[t, 1, 52, true]])
  assert.equal(me().fired[0].r, 1)
  steps(g.runtime, 3)
  assert.equal(g.w.vars.hits.length, 1, '同一发只报一次')
  const rep = (o) => g.w.emitUI('gunReport', { entity: p, shot: 1, target: t, weak: true, point: [0, 1.6, 4.5], normal: [0, 0, -1], ...o })
  rep({})
  steps(g.runtime, 10)
  g.engine.nextHit = { id: ou, point: [3, 1.6, 4.5], normal: [0, 0, -1], distance: 5 }
  tap(g, 'mouse0')
  steps(g.runtime, 1)
  assert.deepEqual(g.w.vars.hits, [[t, 1, 52, true], [u, 2, 26, false]], '已报告的发不再算')
  // 没登记的对象不报告；手工报告：不在环内、打自己、超射程、坐标非法都忽略，合法的才算
  steps(g.runtime, 10)
  g.engine.nextHit = { id: 999999, point: [0, 1.6, 9], normal: [0, 0, -1], distance: 9 }
  tap(g, 'mouse0')
  steps(g.runtime, 2)
  assert.equal(me().shots, 3)
  assert.equal(g.w.vars.hits.length, 2)
  rep({ shot: 99 })
  rep({ shot: 3, target: p })
  rep({ shot: 3, point: [0, 0, 400] })
  rep({ shot: 3, point: [0, 'x', 1] })
  rep({ shot: 3, target: 424242 })
  steps(g.runtime, 1)
  assert.equal(g.w.vars.hits.length, 2)
  rep({ shot: 3, target: u, weak: false })
  steps(g.runtime, 1)
  assert.deepEqual(g.w.vars.hits[2], [u, 3, 26, false])
})

// ---------------------------------------------------------------- gunFps

const GUN_LOG = `w.on('gunFired', (w, p) => { (w.vars.fired ??= []).push([p.entity.id, p.shot]) })
  w.on('gunHit', (w, p) => { (w.vars.hits ??= []).push({ by: p.entity.id, target: p.target.id, weak: p.weak, damage: p.damage, shot: p.shot }) })`

test('gunFps world 模式：按住开火按射速出弹，命中碰撞体当步发 gunHit；写 moveFps.aim 与 cameraFps.kick', async () => {
  const tree = `<entity key="p" moveFps cameraFps gunFps={{ hitscan: 'world' }} />
    <entity key="t" at={[0, 1.6, 6]} body={{ size: [1.2, 1.2, 1.2] }} />`
  const g = await start(tree, GUN_LOG)
  const gun = () => g.at('p').b.gunFps
  steps(g.runtime, 2)
  assert.equal(gun().mag, 30)
  assert.equal(gun().reserve, 150)
  g.engine.keys.add('mouse0')
  steps(g.runtime, 30)
  g.engine.keys.delete('mouse0')
  steps(g.runtime, 1)
  // 720 发每分钟：0.5 秒 6 发（首发立即，之后每 5 步一发）
  assert.equal(gun().shots, 6)
  assert.equal(gun().mag, 24)
  assert.equal(g.w.vars.fired.length, 6)
  assert.deepEqual(g.w.vars.fired.map((f) => f[1]), [1, 2, 3, 4, 5, 6])
  const hits = g.w.vars.hits
  assert.equal(hits.length, 6, '全部命中')
  assert.ok(hits.every((h) => h.target === g.at('t').id && h.damage === 26 && !h.weak))
  assert.ok(gun().fired.every((s) => s.r === 1))
  assert.ok(gun().recoilP < 0, '后坐向上')
  assert.deepEqual(g.at('p').b.cameraFps.kick, [gun().recoilP, gun().recoilY])
  assert.ok(gun().bloom > 0)
  // 松开后后坐与 bloom 回落
  steps(g.runtime, 120)
  assert.ok(Math.abs(gun().recoilP) < 0.01)
  assert.equal(gun().bloom, 0)
  // 开镜
  g.engine.keys.add('mouse1')
  steps(g.runtime, 12)
  assert.equal(gun().ads, 1)
  assert.equal(g.at('p').b.moveFps.aim, 1)
  g.engine.keys.delete('mouse1')
  steps(g.runtime, 12)
  assert.equal(gun().ads, 0)
})

test('gunFps：打空锁枪机、空仓扣扳机开始换弹，补弹与枪机复位按时刻；没有备弹时只记空仓', async () => {
  const g = await start('<entity key="p" moveFps gunFps={{ magSize: 2, reserveStart: 3 }} />', GUN_LOG)
  const gun = () => g.at('p').b.gunFps
  steps(g.runtime, 1)
  g.engine.keys.add('mouse0')
  steps(g.runtime, 6)
  assert.equal(gun().mag, 0)
  assert.equal(gun().boltLocked, true)
  steps(g.runtime, 1)
  assert.equal(gun().reloading, true, '空仓扣扳机开始换弹')
  assert.equal(gun().reloadTotal, 2.72)
  assert.equal(gun().reloads, 1)
  g.engine.keys.delete('mouse0')
  steps(g.runtime, 82)
  assert.equal(gun().mag, 2, '1.345 秒补弹')
  assert.equal(gun().reserve, 1)
  assert.equal(gun().boltLocked, true, '空仓换弹到拉机柄才复位')
  steps(g.runtime, 51)
  assert.equal(gun().boltLocked, false)
  assert.equal(gun().reloading, true)
  steps(g.runtime, 32)
  assert.equal(gun().reloading, false)
  // 满弹匣按 r 不换；打一发后按 r 是战术换弹
  tap(g, 'r')
  assert.equal(gun().reloading, false)
  tap(g, 'mouse0')
  assert.equal(gun().mag, 1)
  tap(g, 'r')
  assert.equal(gun().reloadTotal, 2.1)
  steps(g.runtime, 130)
  assert.equal(gun().mag, 2)
  assert.equal(gun().reserve, 0)
  // 没有备弹：打空后再扣扳机只记空仓
  g.engine.keys.add('mouse0')
  steps(g.runtime, 10)
  g.engine.keys.delete('mouse0')
  steps(g.runtime, 1)
  tap(g, 'mouse0')
  assert.equal(gun().mag, 0)
  assert.equal(gun().reloading, false)
  assert.equal(gun().dry, 1, '按住打空不算，再按一次才算')
  assert.equal(g.w.vars.hits, undefined, '没有目标')
})

test('gunFps：active 为假或生命归零时不开火', async () => {
  const g = await start('<entity key="a" moveFps gunFps /><entity key="b" at={[3, 0, 0]} moveFps health gunFps />', GUN_LOG)
  steps(g.runtime, 1)
  g.at('a').b.gunFps.active = false
  globalThis.fpsDamage(g.w, g.at('b'), 1000)
  g.engine.keys.add('mouse0')
  steps(g.runtime, 10)
  assert.equal(g.at('a').b.gunFps.shots, 0)
  assert.equal(g.at('b').b.gunFps.shots, 0)
  assert.equal(g.at('a').b.gunFps.trigger, false)
})

test('gunFps view 模式：表现层射线打中登记的部件，经 emitUI 回写，下一步发 gunHit（弱点乘倍率）；伪造与重复的报告被拒', async () => {
  const tree = `<entity key="p" moveFps gunFps={{ hitscan: 'view', weakMultiplier: 2.2 }} />
    <entity key="t" at={[0, 1.6, 6]} hitbox={{ tag: 'weak' }} />`
  const g = await start(tree, GUN_LOG)
  const gun = () => g.at('p').b.gunFps
  steps(g.runtime, 1)
  const [box] = g.engine.byName('hitbox')
  assert.ok(box)
  g.engine.nextHit = { id: box.id, point: [0, 1.7, 5.4], normal: [0, 0, -1], distance: 5.4 }
  tap(g, 'mouse0')
  assert.equal(gun().shots, 1)
  assert.equal(g.w.vars.hits, undefined, '当步没有命中')
  steps(g.runtime, 2)
  const hits = g.w.vars.hits
  assert.equal(hits.length, 1)
  assert.deepEqual(hits[0], { by: g.at('p').id, target: g.at('t').id, weak: true, damage: 26 * 2.2, shot: 1 })
  assert.equal(gun().fired[0].r, 1)
  g.engine.nextHit = null
  // 重复的报告、不在环里的发序号、打自己、超出射程：都不发 gunHit
  const p = g.at('p').id, t = g.at('t').id
  g.w.emitUI('gunReport', { entity: p, shot: 1, target: t, weak: false, point: [0, 1.7, 5.4], normal: [0, 0, -1] })
  g.w.emitUI('gunReport', { entity: p, shot: 99, target: t, weak: false, point: [0, 1.7, 5.4], normal: [0, 0, -1] })
  steps(g.runtime, 10)
  assert.equal(g.w.vars.hits.length, 1)
  tap(g, 'mouse0')
  g.w.emitUI('gunReport', { entity: p, shot: 2, target: p, weak: false, point: [0, 1.7, 5.4], normal: [0, 0, -1] })
  g.w.emitUI('gunReport', { entity: p, shot: 2, target: t, weak: false, point: [0, 1.7, 900], normal: [0, 0, -1] })
  g.w.emitUI('gunReport', { entity: p, shot: 2, target: t, weak: false, point: 'x', normal: [0, 0, -1] })
  steps(g.runtime, 3)
  assert.equal(g.w.vars.hits.length, 1)
  assert.equal(gun().shots, 2)
})

// ---------------------------------------------------------------- AI

test('aiChase：看得见就追到 stopAt 以内；隔墙看不见不动', async () => {
  const tree = `<entity key="t" at={[0, 0, 8]} tags={['player']} />
    <entity key="dog" at={[0, 0, 0]} aiChase={{ speed: 4 }} />
    <entity key="wall" at={[10, 1, 4]} body={{ size: [4, 2, 0.5] }} />
    <entity key="cat" at={[10, 0, 0]} aiChase />
    <entity key="t2" at={[10, 0, 8]} tags={['player']} />`
  const g = await start(tree)
  steps(g.runtime, 180)
  const dog = g.at('dog'), cat = g.at('cat')
  assert.equal(dog.b.aiChase.seen, true)
  near(dog.pos[2], 8 - 1.5, 0.1, '停在 stopAt')
  near(dog.rot[1], 0, 1e-9)
  assert.equal(cat.b.aiChase.seen, false)
  assert.equal(cat.b.aiChase.lastSeen, null)
  near(cat.pos[2], 0, 1e-9, '看不见不动')
  assert.equal(cat.pos[1], 0)
})

test('aiPatrol：按点巡逻并循环；aiChase 在追时让出', async () => {
  const tree = `<entity key="g" at={[0, 0, 0]} aiPatrol={{ points: [[4, 0, 0], [4, 0, 4]], speed: 4, wait: 0.5 }} />`
  const g = await start(tree)
  const me = () => g.at('g').b.aiPatrol
  steps(g.runtime, 70)
  assert.equal(me().index, 1)
  near(g.at('g').pos[0], 4, 0.2)
  steps(g.runtime, 100)
  assert.equal(me().index, 0, '循环回第一个点')
  const h = await start(`<entity key="t" at={[0, 0, -6]} tags={['player']} />
    <entity key="g" at={[0, 0, 0]} aiChase={{ speed: 4 }} aiPatrol={{ points: [[0, 0, 8]], speed: 4 }} />`)
  steps(h.runtime, 120)
  assert.equal(h.at('g').b.aiChase.seen, true)
  near(h.at('g').pos[2], -4.5, 0.1, '追击优先')
})
