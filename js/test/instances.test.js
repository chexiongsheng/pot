const test = require('node:test')
const assert = require('node:assert/strict')
const { startGame } = require('./helpers')

async function setup() {
  const ctx = await startGame(new Map([
    ['manifest.json', JSON.stringify({ id: 'inst', plugins: ['a'] })],
    ['src/plugins/a.js', `export const name = 'a'\nexport function apply() {}\n`],
  ]))
  return { ctx, scene: ctx.runtime.scene, engine: ctx.engine }
}

test('instances：按 layout 顺序传交错数据，count 省略时按长度推出，可只传预分配数组的前 count 个', async () => {
  const { scene, engine } = await setup()
  const e = scene.spawn({ shape: 'quad' }).shader('p')
  e.instances({ iOffset: 3, iColor: 4 }, [1, 2, 3, 0.1, 0.2, 0.3, 1, 4, 5, 6, 0.4, 0.5, 0.6, 1])
  let g = engine._get(e.id).gfx
  assert.equal(g.instances.count, 2)
  assert.equal(g.instances.layout, 'iOffset:3;iColor:4')
  assert.equal(g.instances.data.length, 14)

  const pool = new Float32Array(7 * 100)
  pool.set([9, 9, 9, 1, 1, 1, 1])
  e.instances({ iOffset: 3, iColor: 4 }, pool, 1)
  g = engine._get(e.id).gfx
  assert.equal(g.instances.count, 1)
  assert.deepEqual(g.instances.data, [9, 9, 9, 1, 1, 1, 1])

  e.instances(null)
  assert.equal(engine._get(e.id).gfx.instances, undefined, 'null 恢复单次绘制')
  e.instances({ iOffset: 3 }, pool, 0)
  assert.equal(engine._get(e.id).gfx.instances, undefined, 'count 0 同样释放')
})

test('instances：shader 选项里直接给；布局与长度不合法时报错；未绑定着色器时报宿主错误', async () => {
  const { scene, engine } = await setup()
  const e = scene.spawn({ shape: 'quad' }).shader('p', { instances: { layout: { iPos: 4 }, data: [0, 0, 0, 1, 1, 1, 1, 1] } })
  assert.equal(engine._get(e.id).gfx.instances.count, 2)

  assert.throws(() => e.instances({}, [1]), /1 到 11 项/)
  assert.throws(() => e.instances({ iPos: 5 }, [1]), /1 到 4/)
  assert.throws(() => e.instances({ pot_X: 1 }, [1]), /属性名无效/)
  assert.throws(() => e.instances({ iPos: 4 }, [1, 2, 3, 4], 2), /需要 8 个 float/)
  const many = Object.fromEntries(Array.from({ length: 12 }, (_, i) => ['i' + i, 1]))
  assert.throws(() => e.instances(many, new Array(12).fill(0)), /1 到 11 项/)

  const bare = scene.spawn({ shape: 'quad' })
  assert.throws(() => bare.instances({ iPos: 4 }, [0, 0, 0, 1]), /先调用 shader/)
})
