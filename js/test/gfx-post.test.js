const test = require('node:test')
const assert = require('node:assert/strict')
const { startGame, run } = require('./helpers')

const PASS = `#include <pot/post>
uniform sampler2D tScene;
uniform sampler2D tDepth;
uniform vec4 uGain;
out vec4 o;
void main() {
  float raw = texture(tDepth, vUv).r;
  vec3 p = pot_WorldPos(vUv, raw);
  o = texture(tScene, vUv) * uGain + vec4(p * 0.0, 0.0);
}
`

function postGame() {
  return new Map([
    ['manifest.json', JSON.stringify({ id: 'post', plugins: ['fx'] })],
    ['data/shaders/post/a.frag', PASS],
    ['src/plugins/fx.ts', `export const name = 'fx'
export function apply(ctx) {
  const a = ctx.gfx.shader({ fragment: 'shaders/post/a.frag', fullscreen: true })
  const lut = ctx.scene.texture({ data: new Uint8Array(16), width: 2, height: 2 })
  const chain = ctx.gfx.post({
    targets: { half: { scale: 0.5 }, adapt: { width: 1, format: 'rg8', filter: 'point', history: true } },
    uniforms: { uExposure: 1.5 },
    passes: [
      { shader: a, output: 'half', inputs: { tScene: 'scene', tDepth: 'depth' }, uniforms: { uGain: [1, 1, 1, 1] } },
      { shader: a, output: 'adapt', inputs: { tScene: 'half', tDepth: 'adapt', tLut: lut } },
      { shader: a, output: 'screen', inputs: { tScene: 'half', tDepth: 'depth' }, blend: 'add' },
    ],
  })
  if (!chain.active) throw new Error('链未生效')
}
`],
  ])
}

test('gfx.post：后处理链的目标、输入与 uniform 传到引擎，卸载时关闭', async () => {
  const ctx = await startGame(postGame())
  assert.deepEqual(ctx.runtime.failures, [])
  const post = ctx.engine.post
  assert.ok(post, '链已设置')
  assert.deepEqual(post.targets.map((t) => t.name), ['half', 'adapt'])
  assert.equal(post.targets[0].scale, 0.5)
  assert.equal(post.targets[1].width, 1)
  assert.equal(post.targets[1].height, 1)
  assert.equal(post.targets[1].history, 1)
  assert.equal(post.targets[1].filter, 0)
  assert.equal(post.passes.length, 3)
  assert.deepEqual(post.passes[0].inputs, ['tScene=scene', 'tDepth=depth'])
  assert.deepEqual(post.passes[1].inputs, ['tScene=half', 'tDepth=adapt'], 'Texture 输入不进 inputs')
  assert.equal(post.passes[2].output, 'screen')
  assert.equal(post.passes[2].blend, 2)
  const prog = ctx.engine.programs.get(post.passes[0].program)
  assert.match(prog.fs, /pot_ScreenInvVP/, '包含 <pot/post>')
  assert.deepEqual(ctx.engine.bakeBinds.get(post.shared).uniforms.uExposure, [1.5])
  assert.deepEqual(ctx.engine.bakeBinds.get(post.passes[0].bind).uniforms.uGain, [1, 1, 1, 1])
  assert.equal(typeof ctx.engine.bakeBinds.get(post.passes[1].bind).textures.tLut, 'number')
  await run(ctx.runtime, ctx.runtime.stop())
  assert.equal(ctx.engine.post, null, '卸载后关闭')
})

function stageGame(after) {
  const opt = after === undefined ? '' : `, after: ${JSON.stringify(after)}`
  return new Map([
    ['manifest.json', JSON.stringify({ id: 'post', plugins: ['fx'] })],
    ['data/shaders/post/a.frag', PASS],
    ['src/plugins/fx.js', `export const name = 'fx'
export function apply(ctx) {
  const a = ctx.gfx.shader({ fragment: 'shaders/post/a.frag', fullscreen: true })
  ctx.gfx.post({ passes: [{ shader: a, output: 'screen', inputs: { tScene: 'scene', tDepth: 'depth' } }]${opt} })
}
`],
  ])
}

test("gfx.post after：默认挂在 URP 后处理之前（stage 0），after: 'urp' 挂在之后（stage 1）", async () => {
  const def = await startGame(stageGame())
  assert.deepEqual(def.runtime.failures, [])
  assert.equal(def.engine.post.stage, 0)
  const urp = await startGame(stageGame('urp'))
  assert.deepEqual(urp.runtime.failures, [])
  assert.equal(urp.engine.post.stage, 1)
  const bad = await startGame(stageGame('bloom'))
  assert.equal(bad.engine.post, undefined)
  assert.match(String(bad.runtime.failures[0]?.error ?? bad.runtime.failures[0]), /after 只能是/)
})