#!/usr/bin/env node
/**
 * 构建 JS 运行时与开发工具，输出到对应 Unity package 的 Resources：
 *   runtime/src  → packages/com.pot.core/Runtime/Resources/pot/core.cjs      (globalThis.pot)
 *   devtools/src → packages/com.pot.devtools/Runtime/Resources/pot/devtools.cjs (globalThis.pot.devtools)
 * 同时在 js/dist/ 下各放一份，供 Node 测试与 Dev Server 使用。
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
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
