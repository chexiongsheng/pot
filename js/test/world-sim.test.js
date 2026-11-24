const test = require('node:test')
const assert = require('node:assert/strict')
const { startWorld, world, data, byPath } = require('./world-helpers')

/** 推进恰好 n 个模拟步（半步长的帧，保证一帧最多一步） */
function steps(runtime, n) {
  const target = world(runtime).tick + n
  for (let i = 0; i < n * 4 && world(runtime).tick < target; i++) runtime.tick(1 / 120)
  assert.equal(world(runtime).tick, target)
}

const errors = (host, re) => host.logs.filter((l) => l.level === 'error' && re.test(l.text))

test('mover 读 move 轴，约 5 米每秒', async () => {
  const { runtime, engine } = await startWorld({ body: 'w.mount(<player key="p" at={[0, 0.5, 0]} />)' })
  engine.axes.move = [1, 0]
  steps(runtime, 60)
  const p = byPath(runtime, 'player:p')
  assert.ok(Math.abs(p.pos[0] - 5) < 1e-9, `x = ${p.pos[0]}`)
  assert.equal(p.pos[2], 0)
})

test('touch 规则：a、b 与检测顺序相反时参数按规则顺序；destroy 发 death；emit 带 payload；重叠期间不重复', async () => {
  const body = `w.mergeVars({ score: 0, bonus: 0, order: [], deaths: [], touches: 0 })
  w.mount(<>
    <player key="p" at={[0, 0.5, 0]} />
    <coin key="c" at={[2, 0.5, 0]} />
    <coin key="d" at={[-2, 0.5, 0]} />
    <rule on="touch" a="coin" b="player" do={(w, c, p) => { w.vars.order = [c.prefab, p.prefab]; w.vars.score++; w.destroy(c); w.emit('scored', 10) }} />
    <rule on="death" a="coin" do={(w, e) => { w.vars.deaths.push(e.path) }} />
    <rule on="scored" do={(w, n) => { w.vars.bonus += n }} />
  </>)`
  const { runtime, engine } = await startWorld({ body })
  const w = world(runtime)
  assert.ok(byPath(runtime, 'player:p').id < byPath(runtime, 'coin:c').id, '检测按 (小 id, 大 id) 给出 (player, coin)')
  engine.axes.move = [1, 0]
  steps(runtime, 30)
  assert.deepEqual(w.vars.order, ['coin', 'player'])
  assert.equal(w.vars.score, 1)
  assert.equal(w.vars.bonus, 10)
  assert.deepEqual(w.vars.deaths, ['coin:c'])
  assert.equal(w.count('coin'), 1)
  assert.equal(data(runtime).mounts.game.keys['coin:c'].dead, true)
  assert.deepEqual(data(runtime).contacts, {}, '销毁后接触记录清掉')
})

test('w.on 处理器与规则一样分发，filter 按标签匹配', async () => {
  const body = `w.mergeVars({ hits: [] })
  w.on('touch', 'player', (w, p, other) => { w.vars.hits.push([p.prefab, other.prefab]) })
  w.mount(<><player key="p" at={[0, 0.5, 0]} /><coin key="c" at={[0.5, 0.5, 0]} /></>)`
  const { runtime } = await startWorld({ body })
  steps(runtime, 5)
  assert.deepEqual(world(runtime).vars.hits, [['player', 'coin']], '持续重叠只触发一次')
})

test('every：第 n、2n… 步触发（0.5 秒在 60 步里 2 次）', async () => {
  const body = `w.mergeVars({ at: [] })
  w.mount(<rule on="every" seconds={0.5} do={(w) => { w.vars.at.push(w.tick) }} />)`
  const { runtime } = await startWorld({ body })
  steps(runtime, 60)
  assert.deepEqual(world(runtime).vars.at, [29, 59])
})

test('count / query 按预制件链匹配：bigCoin（is: Coin）算作 coin', async () => {
  const { runtime } = await startWorld({
    prelude: "const BigCoin = definePrefab('bigCoin', { is: Coin, tint: { color: '#ff0000' } })",
    body: 'w.mount(<><coin key="a" /><BigCoin key="b" /></>)',
  })
  const w = world(runtime)
  assert.equal(w.count('coin'), 2)
  assert.equal(w.count('bigCoin'), 1)
  const big = byPath(runtime, 'bigCoin:b')
  assert.equal(big.b.trigger.radius, 0.8, '继承的积木')
  assert.equal(big.b.tint.color, '#ff0000')
})

test('事件连锁最多 8 轮：超出时报错并丢弃剩余事件', async () => {
  const body = `w.mergeVars({ pings: 0 })
  w.mount(<rule on="ping" do={(w) => { w.vars.pings++; w.emit('ping') }} />)
  w.emit('ping')`
  const { runtime, host } = await startWorld({ body })
  steps(runtime, 1)
  assert.equal(world(runtime).vars.pings, 8)
  assert.equal(errors(host, /超过 8 轮/).length, 1)
  steps(runtime, 3)
  assert.equal(world(runtime).vars.pings, 8, '剩余的 ping 已丢弃')
})

test('指令：pressed 只在按下的那一步为真，down 按住期间为真', async () => {
  const { runtime, engine } = await startWorld({ body: 'w.mount(<thing key="j" jumper />)' })
  engine.keys.add('space')
  steps(runtime, 3)
  engine.keys.delete('space')
  steps(runtime, 2)
  engine.keys.add('space')
  steps(runtime, 1)
  assert.deepEqual(byPath(runtime, 'thing:j').b.jumper, { count: 2, held: 4 })
})

test('规则出错：同一来源同一信息只打印一次，带源位置，其余规则照常', async () => {
  const body = `w.mergeVars({ ok: 0 })
  w.mount(<>
    <rule on="every" seconds={1 / 60} do={() => { throw new Error('boom') }} />
    <rule on="every" seconds={1 / 60} do={(w) => { w.vars.ok++ }} />
  </>)`
  const { runtime, host } = await startWorld({ body })
  steps(runtime, 5)
  const logged = errors(host, /boom/)
  assert.equal(logged.length, 1)
  assert.match(logged[0].text, /game\.tsx:\d+ <rule on="every">/)
  assert.equal(world(runtime).vars.ok, 5)
})

test('w.spawn：步内生成的实体下一步才参加 step；记下 spawn 参数，mount 与 path 为 null', async () => {
  const body = `w.mergeVars({ id: 0 })
  w.mount(<rule on="every" seconds={1 / 60} do={(w) => { if (!w.vars.id) w.vars.id = w.spawn('thing', { at: [1, 0, 0], counter: { by: 5 } }).id }} />)`
  const { runtime } = await startWorld({ body })
  steps(runtime, 1)
  const e = data(runtime).entities[world(runtime).vars.id]
  assert.equal(e.b.counter.n, 0)
  assert.equal(e.b.counter.inits, 1)
  assert.equal(e.mount, null)
  assert.equal(e.path, null)
  assert.deepEqual(e.spawn, { at: [1, 0, 0], counter: { by: 5 } })
  assert.deepEqual(e.pos, [1, 0, 0])
  steps(runtime, 2)
  assert.equal(e.b.counter.n, 10)
  assert.throws(() => world(runtime).spawn('thing', { f: () => 1, x: 1n }), /可序列化/)
})

test('确定性：同样的输入与 w.rand，跑两次 World 完全一致', async () => {
  const body = `w.mount(<>
    <player key="p" at={[0, 0.5, 0]} />
    <rule on="every" seconds={0.1} do={(w) => { if (w.count('coin') < 6) w.spawn('coin', { at: [w.rand(-3, 3), 0.5, w.rand(-3, 3)] }) }} />
    <rule on="touch" a="player" b="coin" do={(w, p, c) => { w.vars.score = (w.vars.score ?? 0) + 1; w.destroy(c) }} />
  </>)`
  const once = async () => {
    const { runtime, engine } = await startWorld({ body })
    const moves = [[1, 0], [0, 1], [-1, 0], [0, -1]]
    for (let i = 0; i < 8; i++) {
      engine.axes.move = moves[i % 4]
      steps(runtime, 30)
    }
    return JSON.stringify(data(runtime))
  }
  const a = await once()
  const b = await once()
  assert.equal(a, b)
  assert.ok(JSON.parse(a).vars.score > 0, '确实吃到了金币')
})
