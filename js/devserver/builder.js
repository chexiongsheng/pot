/**
 * 游戏发布构建（开发期 Runner 直接读源码，不需要构建）：
 * - buildRelease：src/plugins/*.ts 整体打包为一个 bundle.cjs（导出 { units }，共享代码只有一份，与 Runner 中行为一致），
 *   连同 manifest.json、data/** 写入输出目录。@pot/core / cordis 保持 require，由运行时注入。
 * - packGame：再压成 .potg（zip），Runner 可直接打开 / 安装。
 * - checkGame：tsc 类型检查 + 试打包，发现 Runner 运行前就能看出的错误。
 * - 套件（004 第 17.2 节）：@pot/kit/<名字> 解析到仓库的 kits/，打进 bundle，发布的游戏不依赖 Runner 里的套件。
 *   用到的套件的资源（着色器、JSON 等非代码文件，19.3 A）复制到发布包的 data/kits/<名字>/。
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

/** 仓库的套件目录（Dev Server 与 Runner 编辑器下用同一份） */
const KITS_DIR = path.resolve(__dirname, '../../kits')
const KIT_SUFFIXES = ['', '.ts', '.tsx', '.js', '.json', '/index.ts', '/index.tsx', '/index.js']

/** 把 @pot/kit/<名字>[/子路径] 解析到 kits/ 下的文件 */
function resolveKitFile(id) {
  const m = /^@pot\/kit\/([a-z][a-z0-9-]*)(\/.*)?$/.exec(id)
  if (!m) return null
  const root = path.join(KITS_DIR, m[1])
  const base = path.resolve(root, '.' + (m[2] ?? ''))
  if (base !== root && !base.startsWith(root + path.sep)) return null
  for (const suffix of KIT_SUFFIXES) {
    const file = base + suffix
    if (fs.existsSync(file) && fs.statSync(file).isFile()) return file
  }
  return null
}

const kitResolver = {
  name: 'pot-kit',
  setup(build) {
    build.onResolve({ filter: /^@pot\/kit\// }, (args) => {
      const file = resolveKitFile(args.path)
      if (!file) return { errors: [{ text: `找不到套件模块 "${args.path}"（套件目录 ${KITS_DIR}）` }] }
      return { path: file }
    })
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
    plugins: [externalPot, kitResolver],
    metafile: true,
  })
  const kits = new Set()
  for (const input of Object.keys(result.metafile?.inputs ?? {})) {
    const rel = path.relative(KITS_DIR, path.resolve(process.cwd(), input))
    if (!rel.startsWith('..') && !path.isAbsolute(rel)) kits.add(rel.split(path.sep)[0])
  }
  return { code: result.outputFiles[0].text, units: units.map((u) => u.name), kits: [...kits].sort() }
}

/** 套件里不是代码模块的文件（着色器、JSON 等），经 ctx.data / ctx.gfx 以 @pot/kit/<名字>/<路径> 读取（19.3 A） */
function isKitResource(rel) {
  return !/\.(tsx?|js)$/.test(rel)
}

/** 套件 name 的资源文件（相对套件目录） */
function kitResources(name, kitsDir = KITS_DIR) {
  return walk(path.join(kitsDir, name)).filter(isKitResource)
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
  // 用到的套件的资源复制到 data/kits/<名字>/，运行时先读这里（游戏自己的 data/kits 副本已在上面复制，优先）
  let resources = 0
  for (const kit of bundle.kits) {
    for (const rel of kitResources(kit)) {
      const target = path.join(outDir, 'data', 'kits', kit, rel)
      if (fs.existsSync(target)) continue
      fs.mkdirSync(path.dirname(target), { recursive: true })
      fs.copyFileSync(path.join(KITS_DIR, kit, rel), target)
      resources++
    }
  }
  fs.writeFileSync(path.join(outDir, 'bundle.cjs'), bundle.code)
  return { outDir, units: bundle.units.length, kits: bundle.kits, kitResources: resources }
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
 * pot check 的可移植检查（004 第 20.7 节）：游戏源码（src/**，不含 src/kits/ 下的套件副本）里把宿主专有的全局对象
 * （BLOCKED_GLOBALS）当自由变量用的地方。用 TypeScript 语法树：属性访问的名字、对象键、类型位置、本文件里有同名声明的都不算；
 * typeof X 是特性检测的写法，在 Web 上会自然走回退分支，也不算。返回 [{ file, line, name }]
 */
function findBlockedGlobals(gameDir, blocked) {
  const ts = require('typescript')
  const names = new Set(blocked)
  const out = []
  const files = walk(path.join(gameDir, 'src')).filter((f) => /\.(tsx?|jsx?|mts|cts)$/.test(f) && !f.startsWith('kits/') && !f.endsWith('.d.ts'))
  for (const rel of files) {
    const text = fs.readFileSync(path.join(gameDir, 'src', rel), 'utf8')
    const kind = /x$/.test(rel) ? ts.ScriptKind.TSX : rel.endsWith('.js') ? ts.ScriptKind.JS : ts.ScriptKind.TS
    const sf = ts.createSourceFile(rel, text, ts.ScriptTarget.ES2022, true, kind)
    const declared = new Set()
    const refs = []
    const declare = (n) => {
      if (n && ts.isIdentifier(n)) declared.add(n.text)
      else if (n && (ts.isObjectBindingPattern(n) || ts.isArrayBindingPattern(n))) for (const e of n.elements) if (!ts.isOmittedExpression(e)) declare(e.name)
    }
    const visit = (node) => {
      if (ts.isTypeNode(node) && !ts.isExpressionWithTypeArguments(node)) return
      if (ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)) return
      if (ts.isTypeOfExpression(node) && ts.isIdentifier(node.expression)) return
      if (ts.isVariableDeclaration(node) || ts.isParameter(node) || ts.isBindingElement(node)) declare(node.name)
      else if ((ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node) || ts.isFunctionExpression(node) || ts.isClassExpression(node) || ts.isEnumDeclaration(node)) && node.name) declare(node.name)
      else if (ts.isImportClause(node) && node.name) declare(node.name)
      else if (ts.isImportSpecifier(node) || ts.isNamespaceImport(node) || ts.isImportEqualsDeclaration(node)) declare(node.name)
      if (ts.isIdentifier(node) && names.has(node.text)) {
        const p = node.parent
        const isName =
          (ts.isPropertyAccessExpression(p) && p.name === node) ||
          ((ts.isPropertyAssignment(p) || ts.isPropertyDeclaration(p) || ts.isMethodDeclaration(p) || ts.isPropertySignature(p) ||
            ts.isMethodSignature(p) || ts.isGetAccessor(p) || ts.isSetAccessor(p) || ts.isEnumMember(p)) && p.name === node) ||
          (ts.isQualifiedName(p) && p.right === node) ||
          ts.isJsxAttribute(p) || ts.isLabeledStatement(p) || ts.isBreakOrContinueStatement(p) ||
          ts.isImportSpecifier(p) || ts.isExportSpecifier(p)
        if (!isName) refs.push(node)
      }
      ts.forEachChild(node, visit)
    }
    visit(sf)
    for (const node of refs) {
      if (declared.has(node.text)) continue
      const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf))
      out.push({ file: `src/${rel}`, line: line + 1, name: node.text })
    }
  }
  return out
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
  try {
    for (const r of findBlockedGlobals(gameDir, headless.loadPot().BLOCKED_GLOBALS)) {
      warnings.push(`${r.file}:${r.line}：用到了宿主专有的全局对象 ${r.name}，Web 发布包里它是 undefined；网络用 ctx.net，存储用 state，计时用 ctx.clock / ctx.timer（004 第 20.7 节）`)
    }
  } catch (error) {
    warnings.push(`全局对象检查出错：${error?.message ?? error}`)
  }
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

module.exports = { buildRelease, packGame, checkGame, findBlockedGlobals, generateGameTypes, listUnits, walk, KITS_DIR, resolveKitFile, isKitResource, kitResources }
