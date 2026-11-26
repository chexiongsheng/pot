/**
 * pot eject --kit <名字> [游戏目录]（004 第 17.2 节）：把套件源码复制进游戏的 src/kits/<名字>/，
 * 并把游戏源码里的 '@pot/kit/<名字>[/子路径]' 改成相对路径。之后这份副本归游戏所有，不再随 Runner 更新。
 * 套件自己引用的其他套件（@pot/kit/别的）保持不变。
 *
 * 套件资源（19.3 A）：着色器、JSON 等非代码文件另复制一份到 data/kits/<名字>/。代码里写资源的字符串
 * （'@pot/kit/<名字>/shaders/x.frag' 这类带资源扩展名的路径）不改写，运行时先读游戏的 data/kits 副本。
 */
const fs = require('fs')
const path = require('path')
const { KITS_DIR, walk, isKitResource } = require('./builder')

/** 字符串里的子路径是资源（有扩展名且不是代码）时不改写；无扩展名或 .ts/.tsx/.js 是模块 */
function isResourceRef(sub) {
  const last = (sub ?? '').split('/').pop() ?? ''
  return /\.[A-Za-z0-9]+$/.test(last) && isKitResource(last)
}

function ejectKit(name, gameDir, kitsDir = KITS_DIR) {
  gameDir = path.resolve(gameDir)
  if (!/^[a-z][a-z0-9-]*$/.test(String(name ?? ''))) return { ok: false, error: `套件名不对：${name}` }
  if (!fs.existsSync(path.join(gameDir, 'manifest.json'))) return { ok: false, error: `${gameDir} 不是游戏目录（没有 manifest.json）` }
  const from = path.join(kitsDir, name)
  if (!fs.existsSync(from)) return { ok: false, error: `没有套件 ${name}（${kitsDir}）` }
  const to = path.join(gameDir, 'src', 'kits', name)
  if (fs.existsSync(to)) return { ok: false, error: `${path.relative(gameDir, to)} 已存在，先删掉再 eject` }
  const data = path.join(gameDir, 'data', 'kits', name)
  if (fs.existsSync(data)) return { ok: false, error: `${path.relative(gameDir, data).replace(/\\/g, '/')} 已存在，先删掉再 eject` }
  const copied = []
  const resources = []
  for (const rel of walk(from)) {
    if (!isKitResource(rel) || rel.endsWith('.json')) {
      const target = path.join(to, rel)
      fs.mkdirSync(path.dirname(target), { recursive: true })
      fs.copyFileSync(path.join(from, rel), target)
      copied.push(`src/kits/${name}/${rel}`)
    }
    if (isKitResource(rel)) {
      const res = path.join(data, rel)
      fs.mkdirSync(path.dirname(res), { recursive: true })
      fs.copyFileSync(path.join(from, rel), res)
      resources.push(`data/kits/${name}/${rel}`)
    }
  }
  const pattern = new RegExp(`(['"])@pot/kit/${name.replace(/-/g, '\\-')}(/[^'"]*)?\\1`, 'g')
  const rewritten = []
  const src = path.join(gameDir, 'src')
  for (const rel of walk(src)) {
    if (!/\.(tsx?|js)$/.test(rel) || rel.startsWith(`kits/${name}/`)) continue
    const file = path.join(src, rel)
    const code = fs.readFileSync(file, 'utf8')
    const next = code.replace(pattern, (m, q, sub) => {
      if (isResourceRef(sub)) return m
      let r = path.relative(path.dirname(file), path.join(to, sub ?? '')).replace(/\\/g, '/')
      if (!r.startsWith('.')) r = `./${r}`
      return `${q}${r}${q}`
    })
    if (next !== code) {
      fs.writeFileSync(file, next, 'utf8')
      rewritten.push(`src/${rel}`)
    }
  }
  return { ok: true, kit: name, copied, resources, rewritten }
}

module.exports = { ejectKit }
