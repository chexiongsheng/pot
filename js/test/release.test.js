const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { resolveRelease, stageGame, toPackageId, toVersionCode, normalizePlatform } = require('../devserver/release')

test('release：包名规范化', () => {
  assert.equal(toPackageId('pot.jimao'), 'pot.jimao')
  assert.equal(toPackageId('jimao'), 'com.pot.jimao')
  assert.equal(toPackageId('Com.My-Game.3d'), 'com.my_game.g3d')
  assert.equal(toPackageId(''), 'com.pot.game')
})

test('release：versionCode 由版本号推出', () => {
  assert.equal(toVersionCode('1.2.3'), 10203)
  assert.equal(toVersionCode('0.1.0'), 100)
  assert.equal(toVersionCode('2'), 20000)
  assert.equal(toVersionCode('abc'), 1)
  assert.equal(toVersionCode('0.0.0'), 1)
})

test('release：平台别名', () => {
  assert.equal(normalizePlatform('Windows'), 'win64')
  assert.equal(normalizePlatform('apk'), 'android')
  assert.equal(normalizePlatform('web'), 'webgl')
  assert.throws(() => normalizePlatform('ios'), /不支持的平台/)
})

test('release：manifest → 出包配置', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pot-release-'))
  try {
    const bare = resolveRelease({ id: 'pot.hello', name: 'Hello', version: '0.2.1' }, dir)
    assert.equal(bare.iconFile, null)
    assert.deepEqual(bare.config, {
      id: 'pot.hello', productName: 'Hello', company: 'pot', packageId: 'pot.hello',
      version: '0.2.1', versionCode: 201, icon: '', orientation: 'landscape',
      width: 1280, height: 720, fullscreen: false, resizable: true, fileName: 'hello',
    })

    fs.writeFileSync(path.join(dir, 'icon.png'), '')
    const full = resolveRelease({
      id: 'pot.jimao', name: '几猫', version: '1.0.0',
      release: { company: 'acme', packageId: 'com.acme.jimao', versionCode: 7, orientation: 'portrait',
        window: { width: 800, height: 600, fullscreen: true, resizable: false }, fileName: 'JiMao' },
    }, dir)
    assert.equal(full.iconFile, path.join(dir, 'icon.png'))
    assert.equal(full.config.icon, 'icon.png')
    assert.equal(full.config.packageId, 'com.acme.jimao')
    assert.equal(full.config.versionCode, 7)
    assert.equal(full.config.orientation, 'portrait')
    assert.equal(full.config.fullscreen, true)
    assert.equal(full.config.resizable, false)
    assert.equal(full.config.fileName, 'JiMao')

    assert.throws(() => resolveRelease({ id: 'x', icon: 'none.png' }, dir), /图标不存在/)
    fs.writeFileSync(path.join(dir, 'icon.bmp'), '')
    assert.throws(() => resolveRelease({ id: 'x', icon: 'icon.bmp' }, dir), /png\/jpg/)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

test('release：暂存时 TS 编译为 bundle.cjs，并复制数据与发布配置', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pot-stage-'))
  try {
    fs.mkdirSync(path.join(dir, 'src/plugins'), { recursive: true })
    fs.mkdirSync(path.join(dir, 'data/shaders'), { recursive: true })
    fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({ id: 'pot.demo', name: 'Demo', version: '1.2.3', plugins: ['main'] }))
    fs.writeFileSync(path.join(dir, 'src/plugins/main.ts'), 'export const name = "main"\nexport function apply(ctx: any) { ctx.scene.spawn({ name: "ok" }) }\n')
    fs.writeFileSync(path.join(dir, 'data/config.json'), '{"ok":true}')
    fs.writeFileSync(path.join(dir, 'data/shaders/water.frag'), 'void main() {}\n')
    const stage = path.join(dir, 'stage')
    const result = await stageGame(dir, stage)
    assert.equal(result.units, 1)
    assert.equal(result.config.packageId, 'pot.demo')
    assert.equal(result.config.versionCode, 10203)
    const game = path.join(stage, 'game')
    assert.ok(fs.readFileSync(path.join(game, 'bundle.cjs'), 'utf8').includes('ctx.scene.spawn'))
    assert.equal(fs.readFileSync(path.join(game, 'data/config.json'), 'utf8'), '{"ok":true}')
    assert.ok(fs.existsSync(path.join(game, 'data/shaders/water.frag')))
    assert.equal(fs.existsSync(path.join(game, 'src/plugins/main.ts')), false)
    assert.equal(JSON.parse(fs.readFileSync(path.join(stage, 'release.json'), 'utf8')).productName, 'Demo')
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})
