const test = require('node:test')
const assert = require('node:assert/strict')
const { startGame } = require('./helpers')

async function setup() {
  const ctx = await startGame(new Map([
    ['manifest.json', JSON.stringify({ id: 'cull', plugins: ['a'] })],
    ['src/plugins/a.js', `export const name = 'a'\nexport function apply() {}\n`],
  ]))
  return { scene: ctx.runtime.scene, engine: ctx.engine }
}

test('material.cull：none/front/back 传给宿主，default 恢复模式默认', async () => {
  const { scene, engine } = await setup()
  const e = scene.spawn({ name: 'disc', shape: 'quad', material: { mode: 'unlit-fade', cull: 'none' } })
  const o = () => engine.objects.get(e.id)
  assert.equal(o().mode, 'unlit-fade')
  assert.equal(o().cull, 'none')
  e.material({ cull: 'front' })
  assert.equal(o().cull, 'front')
  assert.equal(o().mode, 'unlit-fade', '只传 cull 时模式不变')
  e.material({ cull: 'default' })
  assert.equal(o().cull, undefined)
})

test('material.cull：非法值报错，不传时不触发 material 调用以外的变更', async () => {
  const { scene } = await setup()
  const e = scene.spawn({ name: 'x', shape: 'cube' })
  assert.throws(() => e.material({ cull: 'both' }), /material.cull 只能是 back\/front\/none\/default/)
})
