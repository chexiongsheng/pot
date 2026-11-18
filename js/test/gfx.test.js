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

const NOISE = `uniform vec4 uTint;
uniform sampler2D uSrc;
in vec2 vUv;
layout(location = 0) out vec4 o0;
layout(location = 1) out vec4 o1;
void main() {
  o0 = uTint * texture(uSrc, vUv);
  o1 = vec4(vUv, 0.0, 1.0);
}
`

function bakeGame() {
  return new Map([
    ['manifest.json', JSON.stringify({ id: 'bake', plugins: ['mat'] })],
    ['data/shaders/noise.frag', NOISE],
    ['src/plugins/mat.ts', `export const name = 'mat'
export function apply(ctx) {
  const shader = ctx.gfx.shader({ fragment: 'shaders/noise.frag', fullscreen: true })
  const src = ctx.scene.texture({ data: new Uint8Array(16), width: 2, height: 2 })
  const [albedo, orm] = ctx.gfx.bake(shader, {
    width: 256, height: 128,
    targets: [{ format: 'srgb' }, { format: 'rgba8', mipmaps: false, wrap: 'clamp', filter: 'point' }],
    uniforms: { uTint: [1, 0.5, 0.25, 1], uSrc: src },
  })
  ctx.scene.spawn({ name: 'box', material: { map: albedo, maskMap: orm } })
}
`],
  ])
}

test('gfx.bake：全屏程序画到 MRT 贴图，参数与 uniform 传到引擎，卸载时销毁', async () => {
  const ctx = await startGame(bakeGame())
  assert.deepEqual(ctx.runtime.failures, [])
  const name = '<pot/fullscreen.vert>|shaders/noise.frag'
  const prog = ctx.engine.programs.get(name)
  assert.ok(prog)
  assert.match(prog.vs, /gl_Position = vec4\(pot_Position\.xy, 0\.0, 1\.0\);/, '全屏顶点着色器')
  assert.equal(ctx.engine.bakes.length, 1)
  const bake = ctx.engine.bakes[0]
  assert.equal(bake.program, name)
  assert.equal(bake.width, 256)
  assert.equal(bake.height, 128)
  assert.equal(bake.targets, 'srgb,1,0,2,8;rgba8,0,1,0,8')
  assert.deepEqual(bake.uniforms.uTint, [1, 0.5, 0.25, 1])
  assert.equal(typeof bake.textures.uSrc, 'number')
  const box = ctx.engine.byName('box')[0]
  assert.ok(ctx.engine.textures.get(box.textures.map).bake, 'map 是烘焙结果')
  assert.ok(ctx.engine.textures.get(box.textures.mask).bake)
  assert.equal(ctx.engine.bakeBinds.size, 0, '临时绑定已释放')
  await run(ctx.runtime, ctx.runtime.stop())
  assert.equal([...ctx.engine.textures.values()].filter((t) => t.bake).length, 0, '卸载后烘焙贴图销毁')
})
