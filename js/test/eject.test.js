const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { ejectKit } = require('../devserver/eject')

function write(root, files) {
  for (const [rel, text] of Object.entries(files)) {
    const file = path.join(root, rel)
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, text, 'utf8')
  }
}

test('pot eject --kit：复制套件并把本套件的 import 改成相对路径', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pot-eject-'))
  try {
    const kits = path.join(tmp, 'kits')
    const game = path.join(tmp, 'game')
    write(kits, {
      'top/index.ts': "import base from '@pot/kit/base'\nexport default base\n",
      'top/sub/x.ts': 'export const X = 1\n',
    })
    write(game, {
      'manifest.json': '{"id":"e","plugins":["game"]}',
      'src/plugins/game.tsx': "import top from '@pot/kit/top'\nimport { X } from \"@pot/kit/top/sub/x\"\nimport base from '@pot/kit/base'\nimport t2 from '@pot/kit/top-two'\n",
    })
    const r = ejectKit('top', game, kits)
    assert.equal(r.ok, true, JSON.stringify(r))
    assert.deepEqual(r.copied.sort(), ['src/kits/top/index.ts', 'src/kits/top/sub/x.ts'])
    assert.deepEqual(r.rewritten, ['src/plugins/game.tsx'])
    const code = fs.readFileSync(path.join(game, 'src/plugins/game.tsx'), 'utf8')
    assert.match(code, /from '\.\.\/kits\/top'/)
    assert.match(code, /from "\.\.\/kits\/top\/sub\/x"/)
    assert.match(code, /'@pot\/kit\/base'/, '别的套件不动')
    assert.match(code, /'@pot\/kit\/top-two'/, '前缀相同的别的套件不动')
    assert.equal(fs.readFileSync(path.join(game, 'src/kits/top/index.ts'), 'utf8').includes("'@pot/kit/base'"), true, '套件副本里对别的套件的引用不动')

    const again = ejectKit('top', game, kits)
    assert.equal(again.ok, false)
    assert.match(again.error, /已存在/)
    assert.equal(ejectKit('nope', game, kits).ok, false)
    assert.equal(ejectKit('Bad Name', game, kits).ok, false)
    assert.equal(ejectKit('top', tmp, kits).ok, false, '不是游戏目录')
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
})
