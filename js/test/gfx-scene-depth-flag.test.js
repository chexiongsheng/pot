const test = require('node:test')
const assert = require('node:assert/strict')
const { startGame } = require('./helpers')

const SCENE_DEPTH = 1 << 9

async function setup() {
  const ctx = await startGame(new Map([
    ['manifest.json', JSON.stringify({ id: 'sd', plugins: ['a'] })],
    ['src/plugins/a.js', `export const name = 'a'\nexport function apply() {}\n`],
  ]))
  return { scene: ctx.runtime.scene, engine: ctx.engine }
}

test('shader sceneDepth：不透明且写深度时默认写进深度预渲染', async () => {
  const { scene, engine } = await setup()
  const e = scene.spawn({ name: 'box', shape: 'cube' })
  const flags = (o) => { e.shader('p', o); return engine.objects.get(e.id).gfx.flags }
  assert.ok(flags({}) & SCENE_DEPTH, 'opaque 默认写')
  assert.ok(!(flags({ sceneDepth: false }) & SCENE_DEPTH), '可显式关闭（顶点动画）')
  assert.ok(!(flags({ blend: 'add' }) & SCENE_DEPTH), '透明队列不写')
  assert.ok(!(flags({ depthWrite: false }) & SCENE_DEPTH), '不写深度时不写')
  assert.ok(!(flags({ depthTest: false }) & SCENE_DEPTH), '关深度测试时不写')
  assert.ok(flags({ blend: 'alpha', queue: 'opaque', depthWrite: true, sceneDepth: true }) & SCENE_DEPTH, '可显式打开')
  assert.equal(flags({ polygonOffset: [-1, -1] }) & 0xffff & ~SCENE_DEPTH, 4, '不影响其它低位')
})
