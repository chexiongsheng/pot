/**
 * 游戏发布构建（开发期 Runner 直接读源码，不需要构建）：
 * - buildRelease：src/plugins/*.ts 整体打包为一个 bundle.cjs（导出 { units }，共享代码只有一份，与 Runner 中行为一致），
 *   连同 manifest.json、data/** 写入输出目录。@pot/core / cordis 保持 require，由运行时注入。
 * - packGame：再压成 .potg（zip），Runner 可直接打开 / 安装。
 * - checkGame：tsc 类型检查 + 试打包，发现 Runner 运行前就能看出的错误。
 */
const esbuild = require('esbuild')
const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

const externalPot = {
  name: 'pot-external',
  setup(build) {
    // jsx 子路径保留各自的名字，运行时的模块表里有对应项
    build.onResolve({ filter: /^(@pot\/core(\/jsx-runtime|\/jsx-dev-runtime)?|cordis)$/ }, (args) => ({ path: args.path === 'cordis' ? '@pot/core' : args.path, external: true }))
  },
}

const IGNORED_DIRS = new Set(['.pot', 'node_modules', '.git'])

function walk(dir, base = dir, out = []) {
  if (!fs.existsSync(dir)) return out
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (IGNORED_DIRS.has(entry.name)) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, base, out)
    else out.push(path.relative(base, full).replace(/\\/g, '/'))
  }
  return out
}

function listUnits(gameDir) {
  const dir = path.join(gameDir, 'src/plugins')
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir)
    .filter((f) => /\.(tsx?|js)$/.test(f) && !f.endsWith('.d.ts'))
    .map((f) => ({ name: f.replace(/\.(tsx?|js)$/, ''), file: path.join(dir, f) }))
}

function formatErrors(error) {
  const list = error.errors ?? [{ text: String(error?.stack ?? error) }]
  return list.map((e) => {
    const loc = e.location ? `${e.location.file}:${e.location.line}:${e.location.column + 1} ` : ''
    return `${loc}${e.text}`
  })
}

function readManifest(gameDir) {
  const file = path.join(gameDir, 'manifest.json')
  if (!fs.existsSync(file)) throw new Error(`找不到 ${file}`)
  const manifest = JSON.parse(fs.readFileSync(file, 'utf8'))
  if (!manifest.id) throw new Error('manifest.json 缺少 id')
  return manifest
}

/** 把全部单元打成一个 CJS 模块：module.exports = { units: { 名字: 模块导出 } } */
async function bundleUnits(gameDir) {
  const units = listUnits(gameDir)
  const lines = units.map((u, i) => `import * as u${i} from ${JSON.stringify('./' + path.relative(gameDir, u.file).replace(/\\/g, '/'))}`)
  lines.push(`export const units = { ${units.map((u, i) => `${JSON.stringify(u.name)}: u${i}`).join(', ')} }`)
  const result = await esbuild.build({
    stdin: { contents: lines.join('\n'), resolveDir: gameDir, sourcefile: 'pot-units.js', loader: 'js' },
    bundle: true,
    format: 'cjs',
    platform: 'neutral',
    target: 'es2020',
    charset: 'utf8',
    write: false,
    logLevel: 'silent',
    jsx: 'automatic',
    jsxImportSource: '@pot/core',
    plugins: [externalPot],
  })
  return { code: result.outputFiles[0].text, units: units.map((u) => u.name) }
}

/** 发布构建：manifest.json + bundle.cjs + data/** 写入 outDir（先清空） */
async function buildRelease(gameDir, outDir) {
  gameDir = path.resolve(gameDir)
  readManifest(gameDir)
  let bundle
  try {
    bundle = await bundleUnits(gameDir)
  } catch (error) {
    throw new Error(`构建失败：\n${formatErrors(error).join('\n')}`)
  }
  fs.rmSync(outDir, { recursive: true, force: true })
  fs.mkdirSync(outDir, { recursive: true })
  const copy = ['manifest.json', ...walk(path.join(gameDir, 'data')).map((f) => `data/${f}`)]
  for (const file of copy) {
    const target = path.join(outDir, file)
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.copyFileSync(path.join(gameDir, file), target)
  }
  fs.writeFileSync(path.join(outDir, 'bundle.cjs'), bundle.code)
  return { outDir, units: bundle.units.length }
}

/**
 * 打包为 .potg（zip：manifest.json + bundle.cjs + data/**），Runner 可打开本地文件或 http URL 安装试玩。
 * outFile 缺省为 <游戏目录>/.pot/<id>-<version>.potg
 */
async function packGame(gameDir, outFile) {
  gameDir = path.resolve(gameDir)
  const temp = path.join(gameDir, '.pot/pack')
  await buildRelease(gameDir, temp)
  const manifest = JSON.parse(fs.readFileSync(path.join(temp, 'manifest.json'), 'utf8'))
  const target = path.resolve(outFile ?? path.join(gameDir, '.pot', `${manifest.id}-${manifest.version ?? '0.0.0'}.potg`))
  const { createZip } = require('./zip')
  const entries = walk(temp).sort().map((name) => ({ name, data: fs.readFileSync(path.join(temp, name)) }))
  const zip = createZip(entries)
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.writeFileSync(target, zip)
  fs.rmSync(temp, { recursive: true, force: true })
  return { file: target, id: manifest.id, version: manifest.version, files: entries.length, bytes: zip.length }
}

/**
 * 检查：manifest、单元与 manifest 对应、试打包（语法/模块解析）；
 * 用了 defineGame 的游戏再在无画面宿主上求值（树求值、规则、界面的报错与告警）并生成 .pot/types.d.ts；
 * 最后 tsc 类型检查（有 tsconfig.json 时）。告警放在 warnings 里，不影响 ok。
 */
async function checkGame(gameDir) {
  gameDir = path.resolve(gameDir)
  const errors = []
  const warnings = []
  let types = null
  let manifest
  try {
    manifest = readManifest(gameDir)
  } catch (error) {
    return { ok: false, errors: [error.message] }
  }
  const names = new Set(listUnits(gameDir).map((u) => u.name))
  for (const item of manifest.plugins ?? []) {
    const name = typeof item === 'string' ? item : item?.name
    if (!names.has(name)) errors.push(`manifest.plugins 中的 "${name}" 没有对应的 src/plugins/${name}.ts（或 .tsx）`)
  }
  let bundled = true
  try {
    await bundleUnits(gameDir)
  } catch (error) {
    bundled = false
    errors.push(...formatErrors(error))
  }
  const headless = require('./headless')
  if (bundled && headless.usesWorld(gameDir)) {
    try {
      const result = await headless.evaluateGame(gameDir)
      errors.push(...result.errors)
      warnings.push(...result.warnings)
      if (result.types) types = headless.writeTypes(gameDir, result.types)
    } catch (error) {
      errors.push(`求值校验出错：${error?.message ?? error}`)
    }
  }
  if (fs.existsSync(path.join(gameDir, 'tsconfig.json'))) {
    const tsc = require.resolve('typescript/bin/tsc')
    const result = spawnSync(process.execPath, [tsc, '--noEmit', '--pretty', 'false', '-p', gameDir], { encoding: 'utf8' })
    const out = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim()
    if (result.status !== 0) errors.push(...out.split(/\r?\n/).filter(Boolean))
  }
  return { ok: errors.length === 0, errors, ...(warnings.length ? { warnings } : {}), ...(types ? { types } : {}) }
}

/** pot types：只生成 .pot/types.d.ts */
async function generateGameTypes(gameDir) {
  gameDir = path.resolve(gameDir)
  const headless = require('./headless')
  if (!headless.usesWorld(gameDir)) return { ok: false, errors: ['游戏没有用 defineGame，不需要生成类型'] }
  const result = await headless.evaluateGame(gameDir)
  if (!result.types) return { ok: false, errors: result.errors }
  return { ok: true, file: headless.writeTypes(gameDir, result.types) }
}

module.exports = { buildRelease, packGame, checkGame, generateGameTypes, listUnits, walk }
