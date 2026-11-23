const test = require('node:test')
const assert = require('node:assert/strict')
const { startGame } = require('./helpers')

const QUAD = {
  positions: [0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0],
  indices: [0, 1, 2, 0, 2, 3],
}

async function setup(plugin = `export const name = 'a'\nexport function apply() {}\n`) {
  const ctx = await startGame(new Map([
    ['manifest.json', JSON.stringify({ id: 'attrs', plugins: ['a'] })],
    ['src/plugins/a.js', plugin],
  ]))
  return { ctx, scene: ctx.runtime.scene, engine: ctx.engine }
}

test('mesh attributes：按名字排序写入 UV1 起的通道，数据原样（大于 1 不截断、不做 sRGB 转换）', async () => {
  const { scene, engine } = await setup()
  scene.mesh('p', {
    ...QUAD,
    attributes: {
      aSize: [1, 2, 3, 4],
      aCenter: { size: 4, data: [0, 0, 0, 1, 2, 2, 2, 1, 3, 3, 3, 1, 4, 4, 4, 1] },
      aColor: { size: 3, data: [5, 0.5, 0.25, 5, 0.5, 0.25, 5, 0.5, 0.25, 5, 0.5, 0.25] },
    },
  })
  const a = engine.meshes.get('p').attributes
  assert.deepEqual(Object.keys(a).sort(), ['aCenter', 'aColor', 'aSize'])
  assert.equal(a.aCenter.channel, 1)
  assert.equal(a.aColor.channel, 2)
  assert.equal(a.aSize.channel, 3)
  assert.equal(a.aSize.size, 1, '直接给数组时 size = 长度 / 顶点数')
  assert.deepEqual(a.aColor.data.slice(0, 3), [5, 0.5, 0.25])
})

test('mesh attributes：数量、长度、名字、与蒙皮同用都报错；参与 key: true 哈希', async () => {
  const { scene, engine } = await setup()
  const many = Object.fromEntries(Array.from({ length: 8 }, (_, i) => [`a${i}`, [0, 0, 0, 0]]))
  assert.throws(() => scene.mesh('x', { ...QUAD, attributes: many }), /最多 7 个/)
  assert.throws(() => scene.mesh('x', { ...QUAD, attributes: { a: { size: 2, data: [1, 2, 3] } } }), /每顶点 2 个数/)
  assert.throws(() => scene.mesh('x', { ...QUAD, attributes: { a: [1, 2, 3, 4, 5] } }), /1 到 4 个数/)
  assert.throws(() => scene.mesh('x', { ...QUAD, attributes: { pot_X: [1, 2, 3, 4] } }), /不合法/)
  assert.throws(() => scene.mesh('x', { ...QUAD, boneIndices: [0, 0, 0, 0], attributes: { a: [1, 2, 3, 4] } }), /不能与蒙皮/)

  scene.mesh('k', { ...QUAD, attributes: { a: [1, 2, 3, 4] } }, { key: true })
  const k1 = engine.meshes.get('k').key
  scene.mesh('k', { ...QUAD, attributes: { a: [1, 2, 3, 4] } }, { key: true })
  assert.equal(engine.meshes.get('k').uploads, 1, '内容相同不重复上传')
  scene.mesh('k', { ...QUAD, attributes: { b: [1, 2, 3, 4] } }, { key: true })
  assert.notEqual(engine.meshes.get('k').key, k1, '属性名不同则 key 不同')
  scene.mesh('k', { ...QUAD, attributes: { b: [1, 2, 3, 5] } }, { key: true })
  assert.equal(engine.meshes.get('k').uploads, 3, '属性数据不同则重新上传')
})

test('gfx.shader attributes / instanced：顶点阶段从 location 5 起声明，实例属性带标记，片元阶段不声明', async () => {
  const { ctx, engine } = await setup(`export const name = 'a'
export function apply(ctx) {
  const s = ctx.gfx.shader({
    name: 'parts',
    vertexSource: 'void main() { gl_Position = vec4(aCenter.xyz + iOffset, aSize); }',
    fragmentSource: 'out vec4 c; void main() { c = vec4(1.0); }',
    attributes: { aCenter: 'vec4', aSize: 'float' },
    instanced: { iOffset: 'vec3' },
  })
  ctx.scene.spawn({ name: 'e', shape: 'quad' }).shader(s)
}
`)
  assert.deepEqual(ctx.runtime.failures, [])
  const prog = engine.programs.get('parts')
  assert.match(prog.vs, /layout\(location = 5\) in vec4 aCenter;\n/)
  assert.match(prog.vs, /layout\(location = 6\) in float aSize;\n/)
  assert.match(prog.vs, /layout\(location = 7\) in vec3 iOffset; \/\/ pot:instance\n/)
  assert.doesNotMatch(prog.fs, /aCenter/)
})

test('gfx.shader attributes：超过 11 个、重名、类型不对时编译失败不抛错', async () => {
  const { ctx } = await setup(`export const name = 'a'
export function apply(ctx) {
  const fs = 'out vec4 c; void main() { c = vec4(1.0); }'
  const many = Object.fromEntries(Array.from({ length: 12 }, (_, i) => ['a' + i, 'vec4']))
  globalThis.__attrErrors = [
    ctx.gfx.shader({ name: 'm', fragmentSource: fs, attributes: many }).error,
    ctx.gfx.shader({ name: 'd', fragmentSource: fs, attributes: { a: 'vec4' }, instanced: { a: 'vec2' } }).error,
    ctx.gfx.shader({ name: 't', fragmentSource: fs, attributes: { a: 'mat4' } }).error,
  ]
}
`)
  assert.deepEqual(ctx.runtime.failures, [])
  const [m, d, t] = globalThis.__attrErrors
  assert.match(m, /最多 11 个/)
  assert.match(d, /重复声明/)
  assert.match(t, /类型须为/)
  delete globalThis.__attrErrors
})
