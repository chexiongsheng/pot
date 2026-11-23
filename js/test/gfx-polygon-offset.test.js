const test = require('node:test')
const assert = require('node:assert/strict')
const { startGame } = require('./helpers')

async function setup() {
  const ctx = await startGame(new Map([
    ['manifest.json', JSON.stringify({ id: 'po', plugins: ['a'] })],
    ['src/plugins/a.js', `export const name = 'a'\nexport function apply() {}\n`],
  ]))
  return { scene: ctx.runtime.scene, engine: ctx.engine }
}

const i8 = (flags, shift) => ((flags >>> shift) & 255) << 24 >> 24

test('shader polygonOffset：factor/units 按 int8 编码进 flags 高 16 位，不影响低位', async () => {
  const { scene, engine } = await setup()
  const e = scene.spawn({ name: 'decal', shape: 'quad' })
  e.shader('decal', { blend: 'alpha', polygonOffset: [-1, -4] })
  const flags = engine.objects.get(e.id).gfx.flags
  assert.equal(i8(flags, 16), -1)
  assert.equal(i8(flags, 24), -4)
  assert.equal(flags & 0xff, 1 << 3, '低位仍是 alpha 混合、不写深度、剔除背面')
  e.shader('decal', { polygonOffset: [300.4, -1000] })
  const g = engine.objects.get(e.id).gfx.flags
  assert.equal(i8(g, 16), 127)
  assert.equal(i8(g, 24), -128)
  e.shader('decal', {})
  assert.equal(engine.objects.get(e.id).gfx.flags >>> 16, 0, '不传时为 0')
})

test('shader polygonOffset：非有限数报错', async () => {
  const { scene } = await setup()
  const e = scene.spawn({ name: 'x', shape: 'quad' })
  assert.throws(() => e.shader('decal', { polygonOffset: [NaN, 1] }), /polygonOffset 须为两个有限数/)
})
