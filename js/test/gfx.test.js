const test = require('node:test')
const assert = require('node:assert/strict')
const { startGame, frames, run } = require('./helpers')

function edit(ctx, file, transform) {
  const content = typeof transform === 'function' ? transform(ctx.files.get(file)) : transform
  ctx.files.set(file, content)
  return file
}

async function changed(ctx, ...paths) {
  const reply = await run(ctx.runtime, ctx.pot.devtools.handle({ id: 1, type: 'changed', paths }))
  assert.equal(reply.ok, true, reply.error)
  return reply.data
}

const WATER = `#include <pot/varyings>
#include <pot/lit>
#include "common.glsl"
uniform vec4 uDeep;
out vec4 fragColor;
void main() {
  PotSurface s = pot_DefaultSurface(normalize(vNormal));
  s.albedo = uDeep.rgb * wave(vWorldPos.xz);
  fragColor = pot_Lit(s, vWorldPos);
}
`

function game() {
  return new Map([
    ['manifest.json', JSON.stringify({ id: 'gfx', plugins: ['water'] })],
    ['data/shaders/water.frag', WATER],
    ['data/shaders/common.glsl', 'float wave(vec2 p) { return 0.5 + 0.5 * sin(p.x + pot_Time.x); }\n'],
    ['src/plugins/water.ts', `export const name = 'water'
export function apply(ctx) {
  const shader = ctx.gfx.shader({ fragment: 'shaders/water.frag' })
  ctx.scene.spawn({ name: 'water', shape: 'plane' }).shader(shader, { blend: 'alpha', uniforms: { uDeep: '#ff0000', uLevels: [1, 2, 3, 4, 5, 6] } })
}
`],
  ])
}

test('gfx：预处理展开 include，绑定对象与 uniform', async () => {
  const ctx = await startGame(game())
  assert.deepEqual(ctx.runtime.failures, [])
  const name = '<pot/standard.vert>|shaders/water.frag'
  const prog = ctx.engine.programs.get(name)
  assert.ok(prog, '程序已注册')
  assert.match(prog.fs, /^#version 310 es/)
  assert.match(prog.fs, /float wave\(vec2 p\)/, '相对路径 include 已展开')
  assert.match(prog.fs, /vec4 pot_Lit\(/, '内置库已展开')
  assert.match(prog.vs, /layout\(location = 0\) in vec3 pot_Position;/)
  assert.match(prog.vs, /gl_Position = pot_ViewProj \* world;/, '默认顶点着色器')
  const water = ctx.engine.byName('water')[0]
  assert.equal(water.gfx.program, name)
  assert.equal(water.gfx.queue, 1, 'alpha 混合默认进透明队列')
  assert.equal(water.gfx.flags, 1 << 3, '背面剔除、不写深度、alpha 混合')
  assert.equal(water.gfx.shadows, 0)
  assert.deepEqual(water.gfx.uniforms.uDeep, [1, 0, 0, 1])
  assert.deepEqual(water.gfx.uniforms.uLevels, [1, 2, 3, 4, 5, 6])
})

test('gfx：改 include 的文件触发热重载；编译出错时保留旧程序并报告原文件行号', async () => {
  const ctx = await startGame(game())
  const name = '<pot/standard.vert>|shaders/water.frag'
  const v1 = ctx.engine.programs.get(name).version

  let result = await changed(ctx, edit(ctx, 'data/shaders/common.glsl', (c) => c.replace('0.5 + 0.5', '0.25 + 0.75')))
  assert.deepEqual(result.units, ['water'])
  frames(ctx.runtime, 4)
  const prog = ctx.engine.programs.get(name)
  assert.ok(prog, '同名程序在重载后仍存在（没有被延迟释放误删）')
  assert.equal(prog.version, v1 + 1)
  assert.match(prog.fs, /0\.25 \+ 0\.75/)

  ctx.host.logs.length = 0
  result = await changed(ctx, edit(ctx, 'data/shaders/common.glsl', (c) => c + 'float bad() { return COMPILE_ERROR; }\n'))
  frames(ctx.runtime, 4)
  assert.equal(ctx.engine.programs.get(name).version, v1 + 1, '失败不替换旧程序')
  assert.equal(ctx.engine.byName('water')[0].gfx.program, name, '新对象仍绑定同名（旧）程序')
  const log = ctx.host.logs.find((l) => l.level === 'error' && /编译失败/.test(l.text))
  assert.ok(log, '输出编译错误')
  assert.match(log.text, /shaders\/common\.glsl:2:/, log.text)
})

test('gfx：插件卸载后程序延迟释放', async () => {
  const ctx = await startGame(game())
  const name = '<pot/standard.vert>|shaders/water.frag'
  await run(ctx.runtime, ctx.runtime.stop())
  assert.ok(ctx.engine.programs.has(name), '不立即释放')
  frames(ctx.runtime, 3)
  await new Promise((r) => setImmediate(r))
  assert.ok(!ctx.engine.programs.has(name))
})
