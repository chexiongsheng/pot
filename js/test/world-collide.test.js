/**
 * 模拟侧碰撞（004 第 17.4 节）：碰撞表网格、w.move（与 saltline Collision 逐步一致）、w.raycast、w.overlap、触发用 body 形状。
 */
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const path = require('path')
const esbuild = require('esbuild')
const { loadPot } = require('./helpers')
const { startWorld, world, byPath } = require('./world-helpers')

const { BodyTable } = loadPot()

/** 可复现的伪随机（mulberry32） */
function rng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** 碰撞表用的假实体：盒由 min、max 给出（中心为位置，size 为全长） */
function boxEntity(id, min, max, body = {}) {
  return {
    id, scale: [1, 1, 1],
    pos: [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2],
    b: { body: { shape: 'box', size: [max[0] - min[0], max[1] - min[1], max[2] - min[2]], radius: 0.5, height: 2, center: [0, 0, 0], layer: 'default', solid: true, ...body } },
  }
}

/** saltline 的 physics.ts 原样转译（去掉关卡相关的 import，只用 Collision） */
function saltlineCollision() {
  const file = path.resolve(__dirname, '../../games/saltline/src/lib/physics.ts')
  const source = fs.readFileSync(file, 'utf8').replace(/^import .*from '\.\/(level|origlevel)'\s*$/gm, '')
  const { code } = esbuild.transformSync(source, { loader: 'ts', format: 'cjs', target: 'es2022' })
  const mod = { exports: {} }
  new Function('module', 'exports', 'require', code)(mod, mod.exports, require)
  return mod.exports.Collision
}

/** 一组 0.25 米网格上的盒：平台、台阶、墙、顶 */
function randomBoxes(seed, count) {
  const rand = rng(seed)
  const q = (v) => Math.round(v * 4) / 4
  const boxes = []
  for (let i = 0; i < count; i++) {
    const x = q(rand() * 30 - 15), z = q(rand() * 30 - 15)
    const kind = rand()
    let size
    if (kind < 0.4) size = [q(1 + rand() * 3), q(0.25 + rand() * 0.5), q(1 + rand() * 3)] // 台阶、矮平台
    else if (kind < 0.7) size = [q(0.5 + rand() * 0.5), q(1 + rand() * 3), q(1 + rand() * 4)] // 墙
    else if (kind < 0.85) size = [q(2 + rand() * 3), 0.5, q(2 + rand() * 3)] // 悬空的顶
    else size = [q(1 + rand() * 2), q(0.5 + rand() * 1.5), q(1 + rand() * 2)]
    const y = kind >= 0.7 && kind < 0.85 ? q(2.25 + rand() * 1.5) : 0
    boxes.push({ min: [x, y, z], max: [x + size[0], y + size[1], z + size[2]] })
  }
  return boxes
}

test('与 saltline Collision 在同一组盒上逐步一致（600 步，多组场景）', () => {
  const Collision = saltlineCollision()
  const dt = 1 / 60
  for (const seed of [1, 7, 42]) {
    const boxes = randomBoxes(seed, 60)
    const ref = new Collision(boxes, 20)
    const table = new BodyTable()
    table.sync(boxes.map((b, i) => boxEntity(i + 1, b.min, b.max)))
    const a = { pos: [0, 6, 0], vel: [0, 0, 0], radius: 0.3, height: 1.8, grounded: false }
    const b = { pos: [0, 6, 0], vel: [0, 0, 0], grounded: false }
    const rand = rng(seed * 31 + 5)
    let vx = 0, vz = 0
    const stats = { wall: 0, ceiling: 0, landed: 0, sea: 0 }
    for (let i = 0; i < 600; i++) {
      if (i % 30 === 0) {
        const angle = rand() * Math.PI * 2
        const speed = rand() < 0.15 ? 30 : rand() < 0.5 ? 7 : 4
        vx = Math.cos(angle) * speed
        vz = Math.sin(angle) * speed
      }
      const jump = rand() < 0.04
      for (const body of [a, b]) {
        body.vel[0] = vx
        body.vel[2] = vz
        if (jump && body.grounded) body.vel[1] = 7
        body.vel[1] -= 20 * dt
      }
      const r1 = ref.move(a, dt, 0.4)
      const r2 = table.move(b.pos, b, { radius: 0.3, height: 1.8, stepUp: 0.4, dt, ground: { y: 0, maxX: 20 } }, (e) => e.solid)
      assert.deepEqual(b.pos, a.pos, `seed ${seed} 第 ${i} 步位置`)
      assert.deepEqual(b.vel, a.vel, `seed ${seed} 第 ${i} 步速度`)
      assert.equal(b.grounded, a.grounded, `seed ${seed} 第 ${i} 步 grounded`)
      assert.equal(r2.hitWall, r1.wall)
      assert.equal(r2.hitCeiling, r1.ceiling)
      assert.equal(r2.landed, r1.landed)
      assert.equal(r2.grounded, a.grounded)
      stats.wall += r1.wall ? 1 : 0
      stats.ceiling += r1.ceiling ? 1 : 0
      stats.landed += r1.landed ? 1 : 0
      if (a.pos[1] < -1) {
        // 掉进海里：两边一起拉回
        stats.sea++
        for (const body of [a, b]) {
          body.pos.splice(0, 3, 0, 6, 0)
          body.vel.splice(0, 3, 0, 0, 0)
          body.grounded = false
        }
      }
    }
    assert.ok(stats.wall > 0 && stats.landed > 0, `场景 ${seed} 覆盖撞墙与落地：${JSON.stringify(stats)}`)
  }
})

test('上台阶、撞墙、撞顶、下坡吸附、层与 solid 过滤', () => {
  const table = new BodyTable()
  table.sync([
    boxEntity(1, [1, 0, -5], [3, 0.25, 5]), // 台阶 0.25
    boxEntity(2, [3, 0, -5], [4, 2, 5]), // 墙
    boxEntity(3, [-5, 2.5, -5], [-3, 3, 5]), // 顶
    boxEntity(4, [-10, 0, -5], [-8, 3, 5], { layer: 'playerWall' }),
    boxEntity(5, [-12, 0, -5], [-11, 3, 5], { solid: false }),
  ])
  const all = (e) => e.solid
  const opts = { stepUp: 0.4, dt: 1 / 60, ground: { y: 0 } }
  const m = { vel: [3, 0, 0], grounded: true }
  const pos = [0, 0, 0]
  let wall = false
  for (let i = 0; i < 120; i++) {
    m.vel[0] = 3
    m.vel[1] -= 20 / 60
    const r = table.move(pos, m, opts, all)
    wall ||= r.hitWall
  }
  assert.equal(pos[1], 0.25, `上了台阶并落在台阶面上：y = ${pos[1]}`)
  assert.ok(wall)
  assert.ok(Math.abs(pos[0] - (3 - 0.3 - 0.001)) < 1e-9, `贴墙：x = ${pos[0]}`)
  assert.equal(m.vel[0], 0, '撞墙清零该轴速度')
  // 往回走下台阶：吸附到地面
  for (let i = 0; i < 60; i++) {
    m.vel[0] = -3
    m.vel[1] -= 20 / 60
    table.move(pos, m, opts, all)
    assert.equal(m.grounded, true, `第 ${i} 步保持着地`)
  }
  assert.equal(pos[1], 0)
  // 跳起撞顶
  pos.splice(0, 3, -4, 0, 0)
  m.vel = [0, 9, 0]
  m.grounded = true
  const r = table.move(pos, m, opts, all)
  assert.equal(r.hitCeiling, false)
  let ceiling = false
  for (let i = 0; i < 20; i++) if (table.move(pos, m, opts, all).hitCeiling) ceiling = true
  assert.ok(ceiling)
  assert.ok(pos[1] + 1.8 <= 2.5)
  // 层过滤：只看 default 层时穿过 playerWall；solid:false 不挡
  const run = (layers) => {
    const p = [-7, 0, 0], mv = { vel: [-3, 0, 0], grounded: true }
    for (let i = 0; i < 100; i++) table.move(p, mv, opts, (e) => e.solid && (!layers || layers.includes(e.layer)))
    return p[0]
  }
  assert.ok(Math.abs(run(undefined) - (-8 + 0.3 + 0.001)) < 1e-9)
  assert.ok(run(['default']) < -11.9, '只看 default 层：穿过 playerWall 与非 solid 盒')
})

test('网格：候选与暴力遍历一致，增删、移动后更新', () => {
  const rand = rng(3)
  const ents = []
  for (let i = 1; i <= 200; i++) {
    const x = rand() * 100 - 50, z = rand() * 100 - 50, s = 0.5 + rand() * 6
    ents.push(boxEntity(i, [x, 0, z], [x + s, 1, z + s]))
  }
  ents.push(boxEntity(201, [-500, -1, -500], [500, 0, 500])) // 很大的地面：不入格
  const table = new BodyTable()
  const check = () => {
    const alive = new Map(ents.map((e) => [e.id, e]))
    for (let k = 0; k < 50; k++) {
      const x = rand() * 120 - 60, z = rand() * 120 - 60, w = rand() * 10
      const got = table.candidates(x, z, x + w, z + w).map((e) => e.id)
      for (const e of alive.values()) {
        const b = table.entry(e.id)
        const hits = b.min[0] <= x + w && b.max[0] >= x && b.min[2] <= z + w && b.max[2] >= z
        if (hits) assert.ok(got.includes(e.id), `漏了 ${e.id}`)
      }
      assert.deepEqual(got, [...got].sort((a, b) => a - b), '按 id 升序')
      for (const id of got) assert.ok(alive.has(id))
    }
  }
  table.sync(ents)
  assert.equal(table.size, 201)
  check()
  // 移动、删除、改 body
  for (const e of ents.slice(0, 50)) e.pos[0] += 37
  ents.splice(50, 30)
  ents[60].b.body.size = [20, 1, 20]
  table.sync(ents)
  assert.equal(table.size, 171)
  check()
})

test('raycast：盒、球、胶囊的距离与法线；起点在内部、超出 maxDist、层与 ignore', () => {
  const table = new BodyTable()
  table.sync([
    boxEntity(1, [-1, 0, -1], [1, 2, 1]),
    { id: 2, pos: [0, 1, 10], scale: [2, 2, 2], b: { body: { shape: 'sphere', radius: 0.5, center: [0, 0, 0], layer: 'enemy' } } },
    { id: 3, pos: [10, 0, 0], scale: [1, 1, 1], b: { body: { shape: 'capsule', radius: 0.5, height: 2, center: [0, 1, 0], layer: 'enemy' } } },
  ])
  const close = (a, b) => a.every((v, i) => Math.abs(v - b[i]) < 1e-9)
  let hit = table.raycast([-5, 1, 0], [2, 0, 0], 100)
  assert.equal(hit.id, 1)
  assert.ok(Math.abs(hit.dist - 4) < 1e-12)
  assert.ok(close(hit.point, [-1, 1, 0]) && close(hit.normal, [-1, 0, 0]))
  hit = table.raycast([0, 1, 5], [0, 0, 1], 100)
  assert.equal(hit.id, 2, '球半径乘缩放：1')
  assert.ok(Math.abs(hit.dist - 4) < 1e-12)
  assert.ok(close(hit.normal, [0, 0, -1]))
  hit = table.raycast([5, 1, 0], [1, 0, 0], 100)
  assert.equal(hit.id, 3)
  assert.ok(Math.abs(hit.dist - 4.5) < 1e-12, '胶囊侧面')
  assert.ok(close(hit.normal, [-1, 0, 0]))
  hit = table.raycast([10, 5, 0], [0, -1, 0], 100)
  assert.ok(Math.abs(hit.dist - 3) < 1e-12, '胶囊顶端半球')
  assert.ok(close(hit.normal, [0, 1, 0]))
  hit = table.raycast([10.3, 5, 0.3], [0, -1, 0], 100)
  assert.ok(hit.point[1] < 2 && hit.point[1] > 1.5 && hit.normal[0] > 0, '偏离中轴时打在球面上')
  assert.equal(table.raycast([0, 1, 0], [0, 1, 0], 100), null, '起点在盒内：忽略')
  assert.equal(table.raycast([10, 1, 0], [-1, 0, 0], 100)?.id, 1, '起点在胶囊内：忽略胶囊，打到后面的盒')
  assert.equal(table.raycast([-5, 1, 0], [1, 0, 0], 3.5), null, '超出 maxDist')
  assert.equal(table.raycast([-5, 1, 0], [1, 0, 0], Infinity).id, 1)
  assert.equal(table.raycast([0, 1, -5], [0, 0, 1], 100, (e) => e.layer === 'enemy').id, 2, '层过滤跳过盒')
  assert.equal(table.raycast([0, 3, 0], [1, 0, 0], 100), null, '从上方掠过')
  assert.equal(table.raycast([0, 1, 0], [0, 0, 0], 100), null, '零方向')
})

test('raycast 距离相同取 id 小的；overlap 球与盒查询', () => {
  const table = new BodyTable()
  table.sync([
    boxEntity(5, [0, 0, 0], [1, 1, 1]),
    boxEntity(2, [0, 0, 0], [1, 1, 1]),
    { id: 3, pos: [5, 0.5, 0.5], scale: [1, 1, 1], b: { body: { shape: 'sphere', radius: 0.5 } } },
    { id: 4, pos: [8, 0, 0.5], scale: [1, 1, 1], b: { body: { shape: 'capsule', radius: 0.5, height: 2, center: [0, 1, 0] } } },
  ])
  assert.equal(table.raycast([-3, 0.5, 0.5], [1, 0, 0], 10).id, 2)
  assert.deepEqual(table.overlap({ kind: 'sphere', radius: 0.6 }, [0.5, 0.5, 1]), [2, 5])
  assert.deepEqual(table.overlap({ kind: 'sphere', radius: 0.4 }, [5.5, 0.5, 1.2]), [3])
  assert.deepEqual(table.overlap({ kind: 'sphere', radius: 0.3 }, [5.5, 0.5, 1.4]), [], '球与球严格小于')
  assert.deepEqual(table.overlap({ kind: 'sphere', radius: 0.6 }, [8.9, 1.9, 0.5]), [4], '球与胶囊按线段距离')
  assert.deepEqual(table.overlap({ kind: 'sphere', radius: 0.1 }, [8.4, 1.95, 0.9]), [], '胶囊包围盒的角上不算')
  assert.deepEqual(table.overlap({ kind: 'box', size: [10, 1, 1] }, [5, 0.5, 0.5]), [2, 3, 4, 5])
  assert.deepEqual(table.overlap({ kind: 'box', size: [0.2, 0.2, 0.2] }, [4.6, 0.1, 0.1]), [], '盒与球按距离，不按包围盒')
})

// ---------------------------------------------------------------- 经 World

function steps(runtime, n) {
  const target = world(runtime).tick + n
  for (let i = 0; i < n * 4 && world(runtime).tick < target; i++) runtime.tick(1 / 120)
  assert.equal(world(runtime).tick, target)
}

const FALLER = `import { defineBlock } from '@pot/core'
const Faller = defineBlock({
  name: 'faller', about: '受重力下落', props: { layers: null as null | string[] }, state: { vel: [0, 0, 0], grounded: false, landed: 0, walls: 0 },
  step(me, e, w) {
    me.vel[1] -= 20 * w.dt
    const r = w.move(e, me, { stepUp: 0.3, layers: me.layers ?? undefined })
    if (r.landed) me.landed++
    if (r.hitWall) me.walls++
  },
})`

test('w.move：落到带 body 的实体上，跳过自己的 body；layers 与 solid 过滤', async () => {
  const body = `ctx.effect(() => w.registry.addBlock(Faller))
  w.mount(<>
    <entity key="floor" at={[0, -0.5, 0]} body={{ size: [10, 1, 10] }} />
    <entity key="glass" at={[5, 1, 0]} body={{ size: [2, 0.2, 2], solid: false }} />
    <entity key="net" at={[-5, 1, 0]} body={{ size: [2, 0.2, 2], layer: 'net' }} />
    <entity key="a" at={[0, 3, 0]} faller body={{ shape: 'capsule', radius: 0.3, height: 1.8, center: [0, 0.9, 0] }} />
    <entity key="b" at={[5, 3, 0]} faller />
    <entity key="c" at={[-5, 3, 0]} faller={{ layers: ['default'] }} />
    <entity key="d" at={[-5.5, 3, 0.5]} faller />
  </>)`
  const { runtime } = await startWorld({ prelude: FALLER, body })
  steps(runtime, 120)
  const at = (key) => byPath(runtime, `entity:${key}`)
  assert.equal(at('a').pos[1], 0)
  assert.equal(at('a').b.faller.grounded, true)
  assert.equal(at('a').b.faller.landed, 1)
  assert.equal(at('b').pos[1], 0, '穿过 solid:false')
  assert.equal(at('c').pos[1], 0, '只看 default 层，穿过 net')
  assert.ok(Math.abs(at('d').pos[1] - 1.1) < 1e-12, `落在 net 上：${at('d').pos[1]}`)
})

test('w.raycast / w.overlap 返回实体；同一步生成的实体立刻可查，被 destroy 的不再命中', async () => {
  const body = `w.mount(<>
    <entity key="wall" at={[0, 1, 5]} body={{ size: [4, 2, 1] }} />
    <entity key="foe" at={[0, 0, 2]} body={{ shape: 'capsule', radius: 0.4, height: 1.8, center: [0, 0.9, 0], layer: 'enemy' }} />
  </>)`
  const { runtime } = await startWorld({ body })
  steps(runtime, 1)
  const w = world(runtime)
  const foe = byPath(runtime, 'entity:foe'), wall = byPath(runtime, 'entity:wall')
  let hit = w.raycast([0, 1, 0], [0, 0, 1], 50)
  assert.equal(hit.entity, foe)
  assert.ok(Math.abs(hit.dist - 1.6) < 1e-12)
  assert.equal(w.raycast([0, 1, 0], [0, 0, 1], 50, { ignore: foe }).entity, wall)
  assert.equal(w.raycast([0, 1, 0], [0, 0, 1], 50, { layers: ['default'] }).entity, wall)
  assert.equal(w.raycast([0, 1, 0], [0, 0, 1], 1), null)
  assert.deepEqual(w.overlap({ kind: 'sphere', radius: 3.5 }, [0, 1, 1.5]).map((e) => e.id), [wall.id, foe.id])
  assert.deepEqual(w.overlap({ kind: 'box', size: [1, 1, 1] }, [0, 1, 2], { layers: ['enemy'] }), [foe])
  const crate = w.spawn('entity', { at: [0, 1, 1], body: { size: [0.5, 0.5, 0.5] } })
  assert.equal(w.raycast([0, 1, 0], [0, 0, 1], 50).entity, crate, '生成后立刻进表')
  w.destroy(crate)
  assert.equal(w.raycast([0, 1, 0], [0, 0, 1], 50).entity, foe, '等待销毁的实体不再命中')
  steps(runtime, 1)
  assert.ok(Math.abs(w.raycast([0, 1, 0], [0, 0, 1], 50).dist - 1.6) < 1e-12, '新的一步第一次查询时刷新')
  foe.pos[2] = 4
  assert.ok(Math.abs(w.raycast([0, 1, 0], [0, 0, 1], 50).dist - 1.6) < 1e-12, '同一步里直接改位置：表不变')
  steps(runtime, 1)
  assert.ok(Math.abs(w.raycast([0, 1, 0], [0, 0, 1], 50).dist - 3.6) < 1e-12, '下一步刷新')
  assert.throws(() => w.raycast([0, 0, 0], [1, 0, 0], 10, { layers: 'enemy' }), /layers/)
})

test('触发：实体同时有 trigger 与 body 时用 body 的形状与偏移', async () => {
  const body = `w.mergeVars({ touches: 0 })
  w.mount(<>
    <entity key="a" at={[0, 0, 0]} trigger={{ radius: 0 }} body={{ size: [2, 2, 2], center: [1.5, 0, 0], solid: false }} />
    <entity key="b" at={[2.55, 0, 0]} trigger={{ radius: 0.1 }} />
    <entity key="c" at={[0.05, 0, 0]} trigger={{ radius: 0.1 }} />
    <rule on="touch" do={(w, x, y) => { w.vars.touches++; w.vars.last = [x.path, y.path] }} />
  </>)`
  const { runtime } = await startWorld({ body })
  steps(runtime, 2)
  const w = world(runtime)
  assert.equal(w.vars.touches, 1, 'b 碰到偏移后的盒；c 在原位置的 trigger 半径内也不算')
  assert.deepEqual(w.vars.last, ['entity:a', 'entity:b'])
})
