const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { startGame, run } = require('./helpers')

/** 套件资源（004 第 19.3 节 A）：ctx.data / ctx.gfx 读 @pot/kit/<名字>/<路径> */

async function changed(ctx, ...paths) {
  const reply = await run(ctx.runtime, ctx.pot.devtools.handle({ id: 1, type: 'changed', paths }))
  assert.equal(reply.ok, true, reply.error)
  return reply.data
}

function kits() {
  return new Map([
    ['look/index.ts', "import { defineKit } from '@pot/core'\nexport default defineKit({ name: 'look', about: '测试' })\n"],
    ['look/shaders/glow.frag', '#include "lib/tint.glsl"\nout vec4 fragColor;\nvoid main() { fragColor = vec4(tint(), 1.0); }\n'],
    ['look/shaders/lib/tint.glsl', 'vec3 tint() { return vec3(0.25); }\n'],
    ['look/tuning.json', '{ "speed": 3 }'],
  ])
}

function game(extra = []) {
  return new Map([
    ['manifest.json', JSON.stringify({ id: 'kr', plugins: ['a'] })],
    ['data/shaders/mine.frag', '#include "@pot/kit/look/shaders/lib/tint.glsl"\nout vec4 fragColor;\nvoid main() { fragColor = vec4(tint(), 0.5); }\n'],
    ['src/plugins/a.ts', `export const name = 'a'
export function apply(ctx) {
  const s = ctx.state.define('a', { init: () => ({}) })
  s.speed = ctx.data.load('@pot/kit/look/tuning.json').speed
  s.has = ctx.data.exists('@pot/kit/look/nope.json')
  s.glow = ctx.gfx.shader({ fragment: '@pot/kit/look/shaders/glow.frag', name: 'glow' }).error ?? ''
  s.mine = ctx.gfx.shader({ fragment: 'shaders/mine.frag', name: 'mine' }).error ?? ''
}
`],
    ...extra,
  ])
}

test('套件资源：数据与着色器从套件读取，套件内的相对 include 与游戏里的 @pot/kit include 都能展开', async () => {
  const ctx = await startGame(game(), { setupHost: (host) => { host.kits = kits() } })
  assert.deepEqual(ctx.runtime.failures, [])
  const s = ctx.runtime.state.get('a')
  assert.equal(s.speed, 3)
  assert.equal(s.has, false)
  assert.equal(s.glow, '')
  assert.equal(s.mine, '')
  assert.match(ctx.engine.programs.get('glow').fs, /vec3 tint\(\)/)
  assert.match(ctx.engine.programs.get('mine').fs, /vec3 tint\(\)/)
  assert.deepEqual(ctx.runtime.data.readers('@pot/kit/look/shaders/lib/tint.glsl'), ['a'])
  assert.deepEqual(ctx.runtime.data.readers('data/kits/look/tuning.json'), ['a'], '游戏副本的路径也能找到读者')
})

test('套件资源：游戏的 data/kits 副本优先；套件目录与副本变化都触发热重载', async () => {
  const k = kits()
  const ctx = await startGame(game([['data/kits/look/tuning.json', '{ "speed": 7 }']]), { setupHost: (host) => { host.kits = k } })
  assert.equal(ctx.runtime.state.get('a').speed, 7, '先读游戏副本')

  ctx.files.set('data/kits/look/tuning.json', '{ "speed": 8 }')
  let r = await changed(ctx, 'data/kits/look/tuning.json')
  assert.deepEqual(r.units, ['a'])
  assert.equal(ctx.runtime.state.get('a').speed, 8)

  ctx.files.delete('data/kits/look/tuning.json')
  k.set('look/tuning.json', '{ "speed": 9 }')
  r = await changed(ctx, '@pot/kit/look/tuning.json')
  assert.deepEqual(r.units, ['a'])
  assert.equal(ctx.runtime.state.get('a').speed, 9, '副本删掉后回退到套件目录')

  k.set('look/shaders/lib/tint.glsl', 'vec3 tint() { return vec3(0.75); }\n')
  r = await changed(ctx, '@pot/kit/look/shaders/lib/tint.glsl')
  assert.deepEqual(r.units, ['a'], '套件着色器的 include 变化也重载')
  assert.match(ctx.engine.programs.get('glow').fs, /vec3\(0\.75\)/)
})

test('套件资源：路径不对时报错，不能用 .. 越出套件', async () => {
  const files = new Map([
    ['manifest.json', JSON.stringify({ id: 'kr', plugins: ['a'] })],
    ['src/plugins/a.ts', "export const name = 'a'\nexport function apply(ctx) { ctx.data.text('@pot/kit/look/../other/x.json') }\n"],
  ])
  const ctx = await startGame(files, { setupHost: (host) => { host.kits = kits() } })
  assert.match(ctx.runtime.failures[0].error, /套件资源路径不对/)
})

test('pot build 与 pot eject 复制套件资源', async () => {
  const { buildRelease, kitResources } = require('../devserver/builder')
  const { ejectKit } = require('../devserver/eject')
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pot-kitres-'))
  try {
    // 发布：hello-tsx 用 topdown，topdown 没有资源时不复制任何东西
    const hello = path.resolve(__dirname, '../../games/hello-tsx')
    const out = path.join(tmp, 'out')
    const result = await buildRelease(hello, out)
    assert.deepEqual(result.kits, ['topdown'])
    assert.equal(result.kitResources, kitResources('topdown').length)

    // eject：资源进 data/kits，资源路径字符串不改写，模块路径改写
    const kitsDir = path.join(tmp, 'kits')
    const gameDir = path.join(tmp, 'game')
    for (const [rel, text] of kits()) {
      fs.mkdirSync(path.dirname(path.join(kitsDir, rel)), { recursive: true })
      fs.writeFileSync(path.join(kitsDir, rel), text)
    }
    fs.mkdirSync(path.join(gameDir, 'src/plugins'), { recursive: true })
    fs.writeFileSync(path.join(gameDir, 'manifest.json'), '{"id":"g","plugins":["game"]}')
    fs.writeFileSync(path.join(gameDir, 'src/plugins/game.tsx'), "import look from '@pot/kit/look'\nconst f = '@pot/kit/look/shaders/glow.frag'\n")
    const r = ejectKit('look', gameDir, kitsDir)
    assert.equal(r.ok, true, JSON.stringify(r))
    assert.deepEqual(r.copied.sort(), ['src/kits/look/index.ts', 'src/kits/look/tuning.json'])
    assert.deepEqual(r.resources.sort(), ['data/kits/look/shaders/glow.frag', 'data/kits/look/shaders/lib/tint.glsl', 'data/kits/look/tuning.json'])
    const code = fs.readFileSync(path.join(gameDir, 'src/plugins/game.tsx'), 'utf8')
    assert.match(code, /from '\.\.\/kits\/look'/)
    assert.match(code, /'@pot\/kit\/look\/shaders\/glow\.frag'/)
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
})
