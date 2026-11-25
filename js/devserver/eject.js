/**
 * pot eject --kit <名字> [游戏目录]（004 第 17.2 节）：把套件源码复制进游戏的 src/kits/<名字>/，
 * 并把游戏源码里的 '@pot/kit/<名字>[/子路径]' 改成相对路径。之后这份副本归游戏所有，不再随 Runner 更新。
 * 套件自己引用的其他套件（@pot/kit/别的）保持不变。
 */
const fs = require('fs')
const path = require('path')
const { KITS_DIR, walk } = require('./builder')

function ejectKit(name, gameDir, kitsDir = KITS_DIR) {
  gameDir = path.resolve(gameDir)
  if (!/^[a-z][a-z0-9-]*$/.test(String(name ?? ''))) return { ok: false, error: `套件名不对：${name}` }
  if (!fs.existsSync(path.join(gameDir, 'manifest.json'))) return { ok: false, error: `${gameDir} 不是游戏目录（没有 manifest.json）` }
  const from = path.join(kitsDir, name)
  if (!fs.existsSync(from)) return { ok: false, error: `没有套件 ${name}（${kitsDir}）` }
  const to = path.join(gameDir, 'src', 'kits', name)
  if (fs.existsSync(to)) return { ok: false, error: `${path.relative(gameDir, to)} 已存在，先删掉再 eject` }
  const copied = []
  for (const rel of walk(from)) {
    const target = path.join(to, rel)
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.copyFileSync(path.join(from, rel), target)
    copied.push(`src/kits/${name}/${rel}`)
  }
  const pattern = new RegExp(`(['"])@pot/kit/${name.replace(/-/g, '\\-')}(/[^'"]*)?\\1`, 'g')
  const rewritten = []
  const src = path.join(gameDir, 'src')
  for (const rel of walk(src)) {
    if (!/\.(tsx?|js)$/.test(rel) || rel.startsWith(`kits/${name}/`)) continue
    const file = path.join(src, rel)
    const code = fs.readFileSync(file, 'utf8')
    const next = code.replace(pattern, (_m, q, sub) => {
      let r = path.relative(path.dirname(file), path.join(to, sub ?? '')).replace(/\\/g, '/')
      if (!r.startsWith('.')) r = `./${r}`
      return `${q}${r}${q}`
    })
    if (next !== code) {
      fs.writeFileSync(file, next, 'utf8')
      rewritten.push(`src/${rel}`)
    }
  }
  return { ok: true, kit: name, copied, rewritten }
}

module.exports = { ejectKit }
