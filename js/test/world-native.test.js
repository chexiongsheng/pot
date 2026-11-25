/**
 * 原生积木的选择与批量执行（004 第 18.4、18.5 节），用 JS 写的假原生实现测流程。
 */
const test = require('node:test')
const assert = require('node:assert/strict')
const { startGame, loadPot } = require('./helpers')

const GAME = 'src/plugins/game.tsx'
const LAYOUT = 'moveTopdown|@move:axis;speed:f'

/** 假原生实现：与 kits/topdown 的 moveTopdown 运算顺序相同 */
function fakeTopdown(buf) {
  const out = Float64Array.from(buf)
  const n = out[0], stride = out[1], dt = out[2]
  for (let i = 0; i < n; i++) {
    const o = 4 + i * stride
    const x = out[o + 7], y = out[o + 8], speed = out[o + 9]
    if (!x && !y) continue
    out[o + 1] += x * speed * dt
    out[o + 3] += y * speed * dt
  }
  return out.buffer
}

function nativeHost({ layout = LAYOUT, kit = 'topdown', step = fakeTopdown } = {}) {
  const calls = []
  return {
    calls,
    setup(host) {
      host.nativeBlocks = () => JSON.stringify([{ name: 'moveTopdown', kit, layout, collision: false }])
      host.nativeStep = (name, buf) => {
        calls.push({ name, count: buf[0] })
        return step(buf)
      }
    },
  }
}

const source = (extra = '') => `import { defineGame, defineBlock } from '@pot/core'
import topdown from '@pot/kit/topdown'
${extra}
export default defineGame({
  kits: [topdown],
  ${extra ? 'blocks: [mine],' : ''}
  scene: () => <>
    <entity key="a" at={[0, 0, 0]} moveTopdown />
    <entity key="b" at={[2, 0, 1]} moveTopdown={{ speed: 3 }} />
    <entity key="c" at={[5, 0, 5]} />
  </>,
})
`

async function play(native, src = source(), steps = 90) {
  const g = await startGame(new Map([
    ['manifest.json', JSON.stringify({ id: 'native.test', plugins: ['game'] })],
    [GAME, src],
  ]), native ? { setupHost: (h) => native.setup(h) } : {})
  assert.deepEqual(g.runtime.failures, [])
  for (let i = 0; i < steps; i++) {
    g.engine.axes.move = i < 40 ? [0.6, 0.8] : i < 70 ? [-1, 0.3] : [0, 0]
    g.runtime.tick(1 / 60)
  }
  const w = g.runtime.root.world
  const pot = loadPot()
  return { g, w, hash: pot.worldHash(g.runtime.state.get('world')), pos: w.query().map((e) => [...e.pos]), warns: g.host.logs.filter((l) => l.level !== 'info' && l.level !== 'debug').map((l) => l.text) }
}

test('原生积木：布局与来源都对时按批调用，结果与 TS 逐位相同', async () => {
  const ts = await play(null)
  const fake = nativeHost()
  const nat = await play(fake)
  assert.deepEqual(nat.w.inspect().native, ['moveTopdown'])
  assert.ok(fake.calls.length >= 90, `每步调用一次：${fake.calls.length}`)
  assert.ok(fake.calls.every((c) => c.name === 'moveTopdown' && c.count === 2), '一批两个实体（c 没有这个积木）')
  assert.deepEqual(nat.pos, ts.pos)
  assert.equal(nat.hash, ts.hash)
  assert.deepEqual(nat.warns, [])
})

test('原生积木：w.native = off 时不调用', async () => {
  const fake = nativeHost()
  const g = await play(fake, source(), 0)
  g.w.native = 'off'
  for (let i = 0; i < 10; i++) g.g.runtime.tick(1 / 60)
  assert.equal(fake.calls.length, 0)
  assert.deepEqual(g.w.inspect().native, [])
  assert.throws(() => { g.w.native = 'on' }, /只能是 auto 或 off/)
})

test('原生积木：布局不同时告警一次并用 TS', async () => {
  const ts = await play(null)
  const fake = nativeHost({ layout: 'moveTopdown|speed:f' })
  const nat = await play(fake)
  assert.equal(fake.calls.length, 0)
  assert.equal(nat.hash, ts.hash)
  const warns = nat.warns.filter((t) => t.includes('布局不同'))
  assert.equal(warns.length, 1, nat.warns.join('\n'))
  assert.match(warns[0], /TS：moveTopdown\|@move:axis;speed:f/)
  assert.match(nat.w.nativeBlocks.reason('moveTopdown'), /布局不同/)
})

test('原生积木：来源不对（kit 不符、游戏覆盖）时用 TS', async () => {
  const wrongKit = nativeHost({ kit: 'fps' })
  const a = await play(wrongKit)
  assert.equal(wrongKit.calls.length, 0)
  assert.match(a.w.nativeBlocks.reason('moveTopdown'), /来源是 kit:topdown，原生实现对应 kit:fps/)

  const fake = nativeHost()
  const mine = `const mine = defineBlock({ name: 'moveTopdown', about: '游戏自己的', props: { speed: 5 }, native: { '@move': 'axis' }, step(me, e) { e.pos[1] += 1 } })`
  const b = await play(fake, source(mine), 10)
  assert.equal(fake.calls.length, 0, '布局相同但被游戏覆盖，不用原生')
  assert.match(b.w.nativeBlocks.reason('moveTopdown'), /来源是 game/)
  assert.equal(b.pos[0][1], 10, '执行的是游戏自己的 step')
})

test('原生积木：出错时告警一次、本步改用 TS，之后一直用 TS', async () => {
  const ts = await play(null)
  let n = 0
  const fake = nativeHost({ step: (buf) => { if (++n === 30) throw new Error('boom'); return fakeTopdown(buf) } })
  const nat = await play(fake)
  assert.equal(fake.calls.length, 30)
  assert.equal(nat.hash, ts.hash, '出错那一步由 TS 补上，结果不变')
  assert.equal(nat.warns.filter((t) => t.includes('原生实现出错')).length, 1)
  assert.match(nat.w.nativeBlocks.reason('moveTopdown'), /出过错/)

  // 返回长度不对：同样回退
  const bad = nativeHost({ step: (buf) => buf.slice(0, 5).buffer })
  const b = await play(bad)
  assert.equal(b.hash, ts.hash)
  assert.ok(b.warns.some((t) => /格式不对/.test(t)))
})

test('原生积木：宿主没有原生实现时说明原因', async () => {
  const r = await play(null, source(), 1)
  assert.deepEqual(r.w.inspect().native, [])
  assert.equal(r.w.nativeBlocks.reason('moveTopdown'), '当前宿主没有原生实现')
})

test('原生积木：用到碰撞的实现在碰撞表变化时才收到碰撞体（按 id 升序，带层位与等待销毁的 id）', async () => {
  const sent = []
  const native = {
    calls: [],
    setup(host) {
      host.nativeBlocks = () => JSON.stringify([{ name: 'moveTopdown', kit: 'topdown', layout: LAYOUT, collision: true }])
      host.nativeStep = (name, buf) => fakeTopdown(buf)
      host.nativeBodies = (buf) => sent.push(Array.from(buf))
    },
  }
  const src = `import { defineGame } from '@pot/core'
import topdown from '@pot/kit/topdown'
export default defineGame({
  kits: [topdown],
  scene: () => <>
    <entity key="p" at={[0, 0, 0]} moveTopdown />
    <entity key="w2" at={[3, 1, 0]} body={{ shape: 'box', size: [1, 2, 4], layer: 'wall' }} />
    <entity key="w1" at={[-3, 1, 0]} body={{ shape: 'sphere', radius: 0.5 }} />
  </>,
})
`
  const g = await play(native, src, 30)
  assert.equal(sent.length, 1, '静态关卡只发一次')
  const [buf] = sent
  assert.deepEqual(buf.slice(0, 3), [2, 15, 0])
  const ids = [buf[3], buf[18]]
  assert.ok(ids[0] < ids[1], 'id 升序')
  const wall = g.w.query().find((e) => e.b.body?.layer === 'wall')
  const wallAt = buf[3] === wall.id ? 3 : 18
  assert.deepEqual(buf.slice(wallAt, wallAt + 13), [wall.id, 0, 1, g.w.layerBit('wall'), 3, 1, 0, 2.5, 0, -2, 3.5, 2, 2])
  const sphereAt = wallAt === 3 ? 18 : 3
  assert.deepEqual([buf[sphereAt + 1], buf[sphereAt + 3], buf[sphereAt + 13]], [1, g.w.layerBit('default'), 0.5])
  // 移动一个碰撞体：下一步重发
  wall.pos[0] = 4
  g.g.runtime.tick(1 / 60)
  assert.equal(sent.length, 2)
  // 销毁：当步碰撞体还在，id 进排除表；下一步碰撞体少一个、排除表清空
  g.w.destroy(wall)
  g.g.runtime.tick(1 / 60)
  const during = sent[sent.length - 1]
  assert.deepEqual([during[0], during[2], during[during.length - 1]], [2, 1, wall.id])
  g.g.runtime.tick(1 / 60)
  assert.deepEqual(sent[sent.length - 1].slice(0, 3), [1, 15, 0])
})
