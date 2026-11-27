#!/usr/bin/env node
/**
 * 构建 JS 运行时与开发工具，输出到对应 Unity package 的 Resources：
 *   runtime/src  → packages/com.pot.core/Runtime/Resources/pot/core.cjs      (globalThis.pot)
 *   devtools/src → packages/com.pot.devtools/Runtime/Resources/pot/devtools.cjs (globalThis.pot.devtools)
 * 同时在 js/dist/ 下各放一份，供 Node 测试与 Dev Server 使用。
 *   runtime/src + web → js/dist/web.js（含运行时核心，globalThis.pot，Web 宿主在 pot.web；004 第 20 节，只给 pot web 用，不进 Unity 包）
 *   kits/        → packages/com.pot.core/Runtime/Resources/pot/kits.json （套件源码与资源 .json/.vert/.frag/.glsl，Runner 没有套件目录时读它，004 第 17.1、19.3 节）
 */
const esbuild = require('esbuild')
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const repo = path.resolve(root, '..')

/** devtools 中的 @pot/core / cordis 指向运行时已加载的 globalThis.pot */
const potShim = {
  name: 'pot-shim',
  setup(build) {
    build.onResolve({ filter: /^(@pot\/core|cordis)$/ }, () => ({ path: 'pot', namespace: 'pot-shim' }))
    build.onLoad({ filter: /.*/, namespace: 'pot-shim' }, () => ({ contents: 'module.exports = globalThis.pot', loader: 'js' }))
  },
}

const common = {
  bundle: true,
  format: 'iife',
  platform: 'neutral',
  target: 'es2020',
  charset: 'utf8',
  legalComments: 'inline',
  logLevel: 'warning',
  mainFields: ['module', 'main'],
  conditions: ['import', 'default'],
}

async function emit(name, options, outputs) {
  const result = await esbuild.build({ ...options, ...common, write: false })
  const code = result.outputFiles[0].text
  for (const file of outputs) {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, code)
  }
  console.log(`[build] ${name}: ${(code.length / 1024).toFixed(1)} KB → ${outputs.map((f) => path.relative(repo, f)).join(', ')}`)
}

async function main() {
  await emit('core', {
    entryPoints: [path.join(root, 'runtime/src/index.ts')],
    globalName: 'pot',
    footer: { js: 'globalThis.pot = pot;' },
  }, [
    path.join(repo, 'packages/com.pot.core/Runtime/Resources/pot/core.cjs'),
    path.join(root, 'dist/core.cjs'),
  ])
  await emit('devtools', {
    entryPoints: [path.join(root, 'devtools/src/index.ts')],
    globalName: '__potDevtools',
    footer: { js: 'globalThis.pot.devtools = __potDevtools;' },
    plugins: [potShim],
  }, [
    path.join(repo, 'packages/com.pot.devtools/Runtime/Resources/pot/devtools.cjs'),
    path.join(root, 'dist/devtools.cjs'),
  ])
  await emit('web', {
    stdin: {
      contents: "export * from './index'\nexport * as web from './web/index'\n",
      resolveDir: path.join(root, 'runtime/src'),
      sourcefile: 'web-entry.ts',
      loader: 'ts',
    },
    globalName: 'pot',
    footer: { js: 'globalThis.pot = pot;' },
  }, [
    path.join(root, 'dist/web.js'),
  ])
}

/** 全部套件源码收成 { files: { "topdown/index.ts": "源码" } }，路径排序，内容不变时文件不变 */
function emitKits() {
  const dir = path.join(repo, 'kits')
  const files = {}
  const walk = (sub) => {
    const full = path.join(dir, sub)
    if (!fs.existsSync(full)) return
    for (const entry of fs.readdirSync(full, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
      const rel = sub ? `${sub}/${entry.name}` : entry.name
      if (entry.isDirectory()) walk(rel)
      else if (/\.(tsx?|js|json|vert|frag|glsl)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) files[rel] = fs.readFileSync(path.join(dir, rel), 'utf8').replace(/\r\n/g, '\n')
    }
  }
  walk('')
  const out = path.join(repo, 'packages/com.pot.core/Runtime/Resources/pot/kits.json')
  const text = JSON.stringify({ files }, null, 1) + '\n'
  if (!fs.existsSync(out) || fs.readFileSync(out, 'utf8') !== text) fs.writeFileSync(out, text, 'utf8')
  console.log(`[build] kits: ${Object.keys(files).length} 个文件 → ${path.relative(repo, out)}`)
}

main().then(emitKits).catch((error) => {
  console.error(error)
  process.exit(1)
})
