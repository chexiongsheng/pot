const test = require('node:test')
const assert = require('node:assert/strict')
const { startGame } = require('./helpers')

const FS = `#include <pot/post>
uniform sampler2D tSrc;
out vec4 o;
void main() { o = texture(tSrc, vUv); }
`

async function setup(passOpts = '') {
  const ctx = await startGame(new Map([
    ['manifest.json', JSON.stringify({ id: 'pp', plugins: ['post'] })],
    ['data/shaders/copy.frag', FS],
    ['src/plugins/post.js', `export const name = 'post'
export function apply(ctx) {
  const s = ctx.gfx.shader({ fullscreen: true, fragment: 'shaders/copy.frag' })
  const chain = ctx.gfx.post({
    targets: { a: { scale: 0.5 }, b: { scale: 0.5 } },
    passes: [
      { shader: s, output: 'a', inputs: { tSrc: 'scene' } },
      { name: 'bloom', shader: s, output: 'b', inputs: { tSrc: 'a' } ${passOpts} },
      { name: 'bloom', shader: s, output: 'a', inputs: { tSrc: 'b' } },
      { shader: s, output: 'screen', inputs: { tSrc: 'a' } },
    ],
  })
  globalThis.__chain = chain
}
`],
  ]))
  assert.deepEqual(ctx.runtime.failures, [])
  return { chain: globalThis.__chain, engine: ctx.engine, runtime: ctx.runtime }
}

test('post enable：按下标或名字开关，同名成组；enabled 查询', async () => {
  const { chain, engine } = await setup()
  assert.equal(engine.postDisabled.size, 0)
  chain.enable('bloom', false)
  assert.deepEqual([...engine.postDisabled].sort(), [1, 2])
  assert.equal(chain.enabled('bloom'), false)
  assert.equal(chain.enabled(0), true)
  chain.enable(2, true)
  assert.deepEqual([...engine.postDisabled], [1])
  assert.equal(chain.enabled('bloom'), false, '组里有一个关着就算关')
  chain.enable([0, 'bloom'], false)
  assert.deepEqual([...engine.postDisabled].sort(), [0, 1, 2])
  chain.enable('bloom')
  assert.deepEqual([...engine.postDisabled], [0])
  assert.throws(() => chain.enable(9, false), /下标越界/)
  assert.throws(() => chain.enable('nope', false), /没有名为 nope/)
})

test('post enable：pass 上的 enabled: false 作为初始状态，链生效时下发', async () => {
  const { chain, engine } = await setup(", enabled: false")
  assert.deepEqual([...engine.postDisabled], [1])
  assert.equal(chain.enabled(1), false)
})

test('内置量：pot_Camera（fov、宽高比、tan(fov/2)、正交半高）与 pot_Resolution 对所有着色器可用', async () => {
  const { engine } = await setup()
  const prog = [...engine.programs.values()][0]
  for (const src of [prog.vs, prog.fs]) {
    assert.match(src, /uniform vec4 pot_Camera;/)
    assert.match(src, /uniform vec4 pot_Resolution;/)
  }
})
