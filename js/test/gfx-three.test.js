const test = require('node:test')
const assert = require('node:assert/strict')
const { startGame } = require('./helpers')

function game() {
  return new Map([
    ['manifest.json', JSON.stringify({ id: 'three', plugins: ['mat'] })],
    ['src/plugins/mat.ts', `import { threeChunks } from '@pot/core'
export const name = 'mat'
export function apply(ctx) {
  const tex = ctx.scene.texture({ data: new Uint8Array(16), width: 2, height: 2 })
  const shared = { value: 0.5 }
  const opts = (tint) => ({
    name: 'crate', color: '#ff0000', roughness: 0.4, metalness: 0.2, map: tex, normalMap: tex, repeat: [2, 3],
    side: 'double', alphaTest: 0.5, defines: { SL_TINT: tint },
    onBeforeCompile(s) {
      s.uniforms.uWet = shared
      s.fragmentShader = 'uniform float uWet;\\n' + s.fragmentShader.replace('#include <aomap_fragment>',
        threeChunks.aomap_fragment + '\\ndiffuseColor.rgb *= 1.0 - uWet * 0.5;')
    },
  })
  const a = ctx.gfx.standard(opts(1))
  const b = ctx.gfx.standard(opts(1))
  const c = ctx.gfx.standard(opts(2))
  ctx.scene.spawn({ name: 'a', shape: 'cube' }).shader(a.shader, a.binding({ shadows: false }))
  shared.value = 0.25
  ctx.scene.spawn({ name: 'b', shape: 'cube' }).shader(b.shader, b.binding())
  ctx.scene.spawn({ name: 'c', shape: 'cube' }).shader(c.shader, c.binding())
}
`],
  ])
}

test('gfx.standard：three 原文 + onBeforeCompile 编译为 pot 程序，同源同 defines 共享程序', async () => {
  const ctx = await startGame(game())
  assert.deepEqual(ctx.runtime.failures, [])
  const [a] = ctx.engine.byName('a')
  const [b] = ctx.engine.byName('b')
  const [c] = ctx.engine.byName('c')
  assert.match(a.gfx.program, /^three:crate:/)
  assert.equal(a.gfx.program, b.gfx.program, '相同源码与 defines 共享程序')
  assert.notEqual(a.gfx.program, c.gfx.program, 'defines 不同则程序不同')
  const prog = ctx.engine.programs.get(a.gfx.program)
  assert.ok(prog)
  assert.match(prog.fs, /#define USE_MAP/)
  assert.match(prog.fs, /#define SL_TINT 1/)
  assert.match(prog.fs, /#define texture2D texture/, 'GLSL3 方言前缀')
  assert.match(prog.fs, /uniform float uWet;/, 'onBeforeCompile 的修改生效')
  assert.match(prog.fs, /pot_SunDir/, '光照改读 pot 内置')
  assert.doesNotMatch(prog.fs, /#include/, 'chunk 全部展开')
  assert.match(prog.vs, /layout\(location = 0\) in vec3 position;/)
  assert.equal(a.gfx.shadows, 0)
  assert.deepEqual(a.gfx.uniforms.uWet, [0.5], '绑定时取 { value } 当前值')
  assert.deepEqual(b.gfx.uniforms.uWet, [0.25])
  assert.deepEqual(a.gfx.uniforms.mapTransform, [2, 0, 0, 0, 3, 0, 0, 0, 1])
  assert.deepEqual(a.gfx.uniforms.alphaTest, [0.5])
  assert.equal(typeof a.gfx.textures.map, 'number')
})
