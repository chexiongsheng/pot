/**
 * pot web（004 第 20.6、20.7 节）：把游戏构建成可直接静态托管的网页。
 *   index.html   全屏画布与加载提示，依次加载 pot-web.js、game.js，再调 pot.web.boot()
 *   pot-web.js   dist/web.js 的副本（运行时核心 + Web 宿主，globalThis.pot）
 *   game.js      globalThis.__potFiles = { 路径: 文本 } 与屏蔽层包裹的 globalThis.__potBundle
 * 浏览器里只跑发布包：先 buildRelease 到临时目录，再把产物转成上面三个文件。
 */
const fs = require('fs')
const path = require('path')
const { buildRelease, walk } = require('./builder')

const WEB_DIST = path.resolve(__dirname, '../dist/web.js')

/** 按 UTF-8 解码；不是合法文本（含 NUL 或解码失败）时返回 null */
function asText(buf) {
  if (buf.includes(0)) return null
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf).replace(/^\uFEFF/, '')
  } catch {
    return null
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
}

function indexHtml(title) {
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no">
<title>${escapeHtml(title)}</title>
<style>
  html, body { margin: 0; height: 100%; overflow: hidden; background: #1a1a1f; }
  #pot { position: fixed; inset: 0; }
  #pot-loading { position: fixed; left: 50%; top: 50%; transform: translate(-50%, -50%); z-index: 10;
    color: #c8c8d0; font: 15px "Microsoft YaHei", "PingFang SC", sans-serif; white-space: pre-wrap; pointer-events: none; }
  #pot-loading.pot-error { color: #ff8080; left: 16px; top: 16px; transform: none; max-width: calc(100% - 32px);
    font-family: Consolas, monospace; font-size: 13px; pointer-events: auto; user-select: text; }
</style>
</head>
<body>
<div id="pot"></div>
<div id="pot-loading">加载中…</div>
<script src="pot-web.js"></script>
<script src="game.js"></script>
<script>pot.web.boot()</script>
</body>
</html>
`
}

/**
 * 构建网页。outDir 缺省 <游戏目录>/.pot/web（先清空）。
 * 返回 { outDir, files, bytes, units, kits, skipped }；skipped 为跳过的二进制文件（web-2 起支持贴图与音频）。
 */
async function buildWeb(gameDir, outDir) {
  gameDir = path.resolve(gameDir)
  outDir = path.resolve(outDir ?? path.join(gameDir, '.pot/web'))
  if (!fs.existsSync(WEB_DIST)) throw new Error(`找不到 ${WEB_DIST}：先在 js 目录执行 npm run build`)
  const stage = path.join(gameDir, '.pot/web-stage')
  try {
    const release = await buildRelease(gameDir, stage)
    const files = {}
    const skipped = []
    for (const rel of walk(stage).sort()) {
      if (rel === 'bundle.cjs') continue
      const text = asText(fs.readFileSync(path.join(stage, rel)))
      if (text === null) skipped.push(rel)
      else files[rel] = text
    }
    const bundle = fs.readFileSync(path.join(stage, 'bundle.cjs'), 'utf8')
    const { shieldModuleSource } = require('./headless').loadPot()
    const manifest = JSON.parse(files['manifest.json'])
    const game =
      `/* ${manifest.id ?? 'game'} ${manifest.version ?? ''}：pot web 生成，请勿手改 */\n` +
      `globalThis.__potFiles = ${JSON.stringify(files)};\n` +
      `globalThis.__potBundle = ${shieldModuleSource(bundle)};\n`

    fs.rmSync(outDir, { recursive: true, force: true })
    fs.mkdirSync(outDir, { recursive: true })
    fs.copyFileSync(WEB_DIST, path.join(outDir, 'pot-web.js'))
    fs.writeFileSync(path.join(outDir, 'game.js'), game)
    fs.writeFileSync(path.join(outDir, 'index.html'), indexHtml(manifest.name ?? manifest.id ?? 'pot'))
    const bytes = ['index.html', 'pot-web.js', 'game.js'].reduce((n, f) => n + fs.statSync(path.join(outDir, f)).size, 0)
    return {
      outDir,
      files: Object.keys(files).length,
      bytes,
      units: release.units,
      kits: release.kits,
      ...(skipped.length ? { skipped, warning: `跳过 ${skipped.length} 个二进制文件：Web 宿主暂只打包文本文件` } : {}),
    }
  } finally {
    fs.rmSync(stage, { recursive: true, force: true })
  }
}

module.exports = { buildWeb, indexHtml }
