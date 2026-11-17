/**
 * 游戏构建：src/plugins/*.ts → units/<name>.cjs（每个单元一个 CJS 文件 + sourcemap）。
 * - @pot/core / cordis 保持 require，由运行时注入
 * - 开发期：Dev Server 把 units/*.cjs、manifest.json、data/** 推送到 Runner
 * - 发布期：合并为 bundle.cjs（{ 单元名: 工厂函数 }），连同 manifest/data 写入输出目录
 */
const esbuild = require('esbuild')
const fs = require('fs')
const path = require('path')

const externalPot = {
  name: 'pot-external',
  setup(build) {
    build.onResolve({ filter: /^(@pot\/core|cordis)$/ }, () => ({ path: '@pot/core', external: true }))
  },
}

function walk(dir, base = dir, out = []) {
  if (!fs.existsSync(dir)) return out
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
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
    .filter((f) => /\.(ts|js)$/.test(f) && !f.endsWith('.d.ts'))
    .map((f) => ({ name: f.replace(/\.(ts|js)$/, ''), file: path.join(dir, f) }))
}

/**
 * 构建一次。返回：
 *   files: Map<GameFS 路径, 内容>（manifest.json、units/*.cjs、data/**）
 *   maps:  Map<units/x.cjs, sourcemap 对象>
 *   inputs: Map<单元名, 依赖的源文件绝对路径[]>
 *   errors: 构建错误（字符串）
 */
async function buildGame(gameDir) {
  gameDir = path.resolve(gameDir)
  const files = new Map()
  const maps = new Map()
  const inputs = new Map()
  const errors = []

  const manifestPath = path.join(gameDir, 'manifest.json')
  if (!fs.existsSync(manifestPath)) {
    errors.push(`找不到 ${manifestPath}`)
    return { files, maps, inputs, errors }
  }
  files.set('manifest.json', fs.readFileSync(manifestPath, 'utf8'))

  for (const rel of walk(path.join(gameDir, 'data'))) {
    files.set(`data/${rel}`, fs.readFileSync(path.join(gameDir, 'data', rel), 'utf8'))
  }

  const units = listUnits(gameDir)
  if (units.length) {
    try {
      const result = await esbuild.build({
        entryPoints: Object.fromEntries(units.map((u) => [u.name, u.file])),
        outdir: path.join(gameDir, '.pot/units'),
        bundle: true,
        format: 'cjs',
        platform: 'neutral',
        target: 'es2020',
        charset: 'utf8',
        sourcemap: 'external',
        sourcesContent: false,
        metafile: true,
        write: false,
        logLevel: 'silent',
        outExtension: { '.js': '.cjs' },
        plugins: [externalPot],
      })
      for (const out of result.outputFiles) {
        const base = path.basename(out.path)
        if (base.endsWith('.cjs.map')) {
          const map = JSON.parse(out.text)
          // sources 改为绝对路径，便于映射报错栈
          map.sources = map.sources.map((s) => path.resolve(path.dirname(out.path), s))
          maps.set(`units/${base.replace(/\.map$/, '')}`, map)
        } else if (base.endsWith('.cjs')) {
          // 去掉 esbuild 追加的 sourceMappingURL（运行时用 sourceURL 标记文件名）
          files.set(`units/${base}`, out.text.replace(/\n\/\/# sourceMappingURL=.*\n?$/, '\n'))
        }
      }
      for (const [out, meta] of Object.entries(result.metafile.outputs)) {
        if (!meta.entryPoint) continue
        const name = path.basename(out).replace(/\.cjs$/, '')
        inputs.set(name, Object.keys(meta.inputs).map((p) => path.resolve(p)))
      }
    } catch (error) {
      const list = error.errors ?? [{ text: String(error) }]
      for (const e of list) {
        const loc = e.location ? `${e.location.file}:${e.location.line}:${e.location.column + 1} ` : ''
        errors.push(`${loc}${e.text}`)
      }
    }
  }
  return { files, maps, inputs, errors }
}

/** 发布构建：manifest.json + bundle.cjs + data/** 写入 outDir（先清空） */
async function buildRelease(gameDir, outDir) {
  const { files, errors } = await buildGame(gameDir)
  if (errors.length) throw new Error(`构建失败：\n${errors.join('\n')}`)
  fs.rmSync(outDir, { recursive: true, force: true })
  fs.mkdirSync(outDir, { recursive: true })
  const parts = []
  for (const [file, content] of files) {
    const unit = /^units\/(.+)\.cjs$/.exec(file)
    if (unit) {
      parts.push(`${JSON.stringify(unit[1])}: function (exports, require, module, __filename) {\n${content}\n}`)
      continue
    }
    const target = path.join(outDir, file)
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, content)
  }
  fs.writeFileSync(path.join(outDir, 'bundle.cjs'), `module.exports = {\n${parts.join(',\n')}\n}\n`)
  return { outDir, units: parts.length }
}

module.exports = { buildGame, buildRelease, listUnits }
