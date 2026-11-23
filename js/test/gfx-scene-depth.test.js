const test = require('node:test')
const assert = require('node:assert/strict')
const { startGame } = require('./helpers')

function game() {
  return new Map([
    ['manifest.json', JSON.stringify({ id: 'depth', plugins: ['a'] })],
    ['data/shaders/soft.vert', '#include <pot/standard.vert>\n'],
    ['data/shaders/soft.frag', `#include <pot/varyings>
#include <pot/depth>
out vec4 fragColor;
void main() {
  float near = pot_SceneEyeDepth(pot_SceneUv(vWorldPos));
  fragColor = vec4(1.0, 1.0, 1.0, pot_SoftFade(vWorldPos, 0.5) * step(0.0, near));
}
`],
    ['src/plugins/a.js', `export const name = 'a'
export function apply(ctx) {
  const s = ctx.gfx.shader({ vertex: 'shaders/soft.vert', fragment: 'shaders/soft.frag', name: 'soft' })
  ctx.scene.spawn({ name: 'p', shape: 'quad' }).shader(s, { queue: 'transparent', blend: 'alpha', depthWrite: false })
}
`],
  ])
}

test('gfx pot/depth：片元内置 pot_SceneDepth 采样器，库函数可用于软粒子', async () => {
  const ctx = await startGame(game())
  assert.deepEqual(ctx.runtime.failures, [])
  const [p] = ctx.engine.byName('p')
  const prog = ctx.engine.programs.get(p.gfx.program)
  assert.ok(prog)
  assert.match(prog.fs, /uniform highp sampler2D pot_SceneDepth;/)
  assert.match(prog.fs, /float pot_SoftFade\(vec3 worldPos, float distance\)/)
  assert.match(prog.fs, /textureLod\(pot_SceneDepth, uv, 0\.0\)/)
  assert.doesNotMatch(prog.vs, /pot_SceneDepth/, '顶点阶段不声明')
  assert.doesNotMatch(prog.fs, /#include/)
})
