#!/usr/bin/env node
/**
 * 把 games/ 下所有游戏打成 WebGL，汇总成一个可直接部署到 GitHub Pages 的静态站点：
 *   <out>/index.html        游戏列表首页
 *   <out>/<游戏目录名>/      各游戏的 WebGL 产物（入口 index.html）
 *
 * 用法：node tools/build-pages.js [--out site] [--unity Unity.exe] [--games hello,jimao]
 *
 * 依次构建（同一个 player 工程不能并行出包）。单个游戏失败不中断，失败项在首页标注；
 * 全部失败时退出码为 1。在 GitHub Actions 中会输出 ::error:: 注解和 Step Summary。
 */
const fs = require('fs')
const path = require('path')
const { releaseGame } = require('../js/devserver/release')

const REPO = path.resolve(__dirname, '..')

function parseArgs(argv) {
  const flags = {}
  for (let i = 0; i < argv.length; i++) {
    const m = /^--([^=]+)(?:=(.*))?$/.exec(argv[i])
    if (!m) continue
    flags[m[1]] = m[2] ?? (argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : 'true')
  }
  return flags
}

function listGames(filter) {
  const root = path.join(REPO, 'games')
  const wanted = filter ? new Set(filter.split(',').map((s) => s.trim()).filter(Boolean)) : null
  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter((d) => d.isDirectory() && fs.existsSync(path.join(root, d.name, 'manifest.json')))
    .map((d) => d.name)
    .filter((name) => !wanted || wanted.has(name))
    .sort()
}

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

function renderIndex(entries) {
  const cards = entries
    .map((e) => {
      const icon = e.icon ? `<img src="${escapeHtml(e.dir)}/${escapeHtml(e.icon)}" alt="">` : `<div class="ph">${escapeHtml(e.name.slice(0, 1))}</div>`
      const body = `${icon}<h2>${escapeHtml(e.name)}</h2><p>${escapeHtml(e.dir)} · v${escapeHtml(e.version)}</p>`
      return e.ok
        ? `<a class="card" href="${escapeHtml(e.dir)}/">${body}</a>`
        : `<div class="card failed">${body}<p class="err">本次构建失败</p></div>`
    })
    .join('\n    ')
  const sha = process.env.GITHUB_SHA ? process.env.GITHUB_SHA.slice(0, 7) : 'local'
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>pot demos</title>
  <style>
    body { margin: 0; font-family: system-ui, sans-serif; background: #15171c; color: #e6e6e6; }
    header { padding: 24px 32px; }
    h1 { margin: 0 0 4px; font-size: 24px; }
    header p { margin: 0; color: #8a8f99; font-size: 13px; }
    main { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 16px; padding: 0 32px 32px; }
    .card { display: block; background: #20232b; border-radius: 10px; padding: 16px; color: inherit; text-decoration: none; transition: transform .15s; }
    a.card:hover { transform: translateY(-2px); background: #272b35; }
    .card img, .card .ph { width: 64px; height: 64px; border-radius: 12px; object-fit: cover; }
    .card .ph { display: flex; align-items: center; justify-content: center; background: #3a3f4c; font-size: 28px; }
    .card h2 { font-size: 16px; margin: 12px 0 4px; }
    .card p { margin: 0; font-size: 12px; color: #8a8f99; }
    .failed { opacity: .5; }
    .err { color: #ff7b72 !important; margin-top: 6px !important; }
  </style>
</head>
<body>
  <header>
    <h1>pot demos</h1>
    <p>Unity WebGL 构建 · ${escapeHtml(sha)} · ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC</p>
  </header>
  <main>
    ${cards}
  </main>
</body>
</html>
`
}

async function main() {
  const flags = parseArgs(process.argv.slice(2))
  const out = path.resolve(REPO, flags.out ?? 'site')
  const games = listGames(flags.games)
  if (games.length === 0) throw new Error('games/ 下没有找到包含 manifest.json 的游戏')
  fs.rmSync(out, { recursive: true, force: true })
  fs.mkdirSync(out, { recursive: true })

  const entries = []
  for (const dir of games) {
    const gameDir = path.join(REPO, 'games', dir)
    const manifest = JSON.parse(fs.readFileSync(path.join(gameDir, 'manifest.json'), 'utf8'))
    const entry = { dir, name: manifest.name ?? dir, version: manifest.version ?? '0.0.0', ok: false, icon: null, seconds: 0, errors: [] }
    console.log(`\n===== ${dir}（${entry.name}）=====`)
    try {
      const res = await releaseGame(gameDir, { platform: 'webgl', unity: flags.unity, out: path.join(out, dir) })
      entry.ok = res.ok
      entry.seconds = res.seconds
      entry.errors = res.errors ?? []
    } catch (error) {
      entry.errors = [String(error?.message ?? error)]
    }
    if (entry.ok) {
      const iconRel = manifest.release?.icon ?? manifest.icon ?? 'icon.png'
      const iconSrc = path.join(gameDir, iconRel)
      if (fs.existsSync(iconSrc) && /\.(png|jpe?g)$/i.test(iconSrc)) {
        entry.icon = `icon${path.extname(iconSrc).toLowerCase()}`
        fs.copyFileSync(iconSrc, path.join(out, dir, entry.icon))
      }
    } else {
      fs.rmSync(path.join(out, dir), { recursive: true, force: true })
      for (const e of entry.errors.slice(-10)) console.log(`  ${e}`)
      if (process.env.GITHUB_ACTIONS) console.log(`::error title=WebGL 构建失败 ${dir}::${(entry.errors.slice(-3).join(' | ') || '见 Unity 日志').replace(/\r?\n/g, ' ')}`)
    }
    entries.push(entry)
  }

  fs.writeFileSync(path.join(out, 'index.html'), renderIndex(entries))
  fs.writeFileSync(path.join(out, '.nojekyll'), '')

  const lines = ['| 游戏 | 结果 | 耗时 |', '|---|---|---|', ...entries.map((e) => `| ${e.dir} | ${e.ok ? '成功' : '失败'} | ${e.seconds}s |`)]
  console.log(`\n${lines.join('\n')}`)
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## WebGL 构建\n\n${lines.join('\n')}\n`)

  const okCount = entries.filter((e) => e.ok).length
  console.log(`\n站点：${out}（成功 ${okCount}/${entries.length}）`)
  if (okCount === 0) process.exitCode = 1
}

main().catch((error) => {
  console.error(error?.stack ?? error)
  process.exitCode = 1
})
