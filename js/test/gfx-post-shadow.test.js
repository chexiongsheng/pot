const test = require('node:test')
const assert = require('node:assert/strict')
const { startGame } = require('./helpers')

// 后处理里按深度重建世界坐标，沿视线对太阳阴影做 raymarch（体积光的最小形态）
const VOL = `#include <pot/post>
#include <pot/shadow>
uniform sampler2D tDepth;
out vec4 o;
void main() {
  float raw = texture(tDepth, vUv).r;
  vec3 end = pot_WorldPos(vUv, raw);
  float lit = 0.0;
  for (int i = 0; i < 8; i++) lit += pot_SunVisibility(mix(pot_CameraPos.xyz, end, (float(i) + 0.5) / 8.0));
  o = vec4(vec3(lit / 8.0), pot_Shadow(end));
}
`

function game() {
  return new Map([
    ['manifest.json', JSON.stringify({ id: 'postshadow', plugins: ['fx'] })],
    ['data/shaders/post/vol.frag', VOL],
    ['data/shaders/lit.vert', '#include <pot/standard.vert>\n'],
    ['data/shaders/lit.frag', `#include <pot/varyings>
#include <pot/shadow>
#include <pot/lit>
out vec4 o;
void main() { o = pot_Lit(pot_DefaultSurface(normalize(vNormal)), vWorldPos); }
`],
    ['src/plugins/fx.js', `export const name = 'fx'
export function apply(ctx) {
  const vol = ctx.gfx.shader({ fragment: 'shaders/post/vol.frag', fullscreen: true })
  ctx.gfx.post({ passes: [{ shader: vol, output: 'screen', inputs: { tDepth: 'depth' } }] })
  const lit = ctx.gfx.shader({ vertex: 'shaders/lit.vert', fragment: 'shaders/lit.frag', name: 'lit' })
  ctx.scene.spawn({ name: 'p', shape: 'quad' }).shader(lit)
}
`],
  ])
}

test('gfx pot/shadow：后处理可读主光阴影图，与 pot/lit 同时包含不重复定义', async () => {
  const ctx = await startGame(game())
  assert.deepEqual(ctx.runtime.failures, [])
  const post = ctx.engine.post
  assert.ok(post)
  const vol = ctx.engine.programs.get(post.passes[0].program).fs
  assert.match(vol, /uniform highp sampler2D pot_ShadowMap;/)
  assert.match(vol, /float pot_SunVisibility\(vec3 worldPos\)/)
  assert.match(vol, /int pot_ShadowCascade\(vec3 worldPos\)/)
  assert.doesNotMatch(vol, /#include/)

  const [p] = ctx.engine.byName('p')
  const lit = ctx.engine.programs.get(p.gfx.program).fs
  assert.equal(lit.match(/float pot_Shadow\(vec3 worldPos\)/g).length, 1, '<pot/lit> 内部再 include <pot/shadow> 时被去重')
  assert.equal(lit.match(/float pot_ShadowCmp\(/g).length, 1)
  assert.match(lit, /pot_Shadow\(worldPos\)/)
})
