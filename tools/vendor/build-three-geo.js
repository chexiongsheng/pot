// 把 three.js 的纯几何子集打成单个 CommonJS 文件，放进游戏包（游戏只能 require 相对路径文件）。
// 用法：node tools/vendor/build-three-geo.js games/saltline/src/vendor/three-geo.js
const path = require('path')
const fs = require('fs')
const esbuild = require(path.join(__dirname, '../../js/node_modules/esbuild'))

const out = process.argv[2]
if (!out) throw new Error('用法：node tools/vendor/build-three-geo.js <输出路径>')
const version = require('./node_modules/three/package.json').version

esbuild.build({
  entryPoints: [path.join(__dirname, 'three-geo.entry.js')],
  bundle: true,
  format: 'cjs',
  platform: 'neutral',
  target: 'es2020',
  minify: true,
  treeShaking: true,
  legalComments: 'none',
  nodePaths: [path.join(__dirname, 'node_modules')],
  plugins: [{
    name: 'three-core',
    setup(build) {
      build.onResolve({ filter: /^three$/ }, () => ({ path: path.join(__dirname, 'three-core.js') }))
    },
  }],
  banner: { js: `// three.js r${version.split('.')[1]} 几何子集（MIT License, Copyright 2010-2025 three.js authors）。由 tools/vendor/build-three-geo.js 生成，勿手改。` },
  outfile: out,
}).then(() => {
  const size = fs.statSync(out).size
  console.log(`${out} ${(size / 1024).toFixed(1)} KB`)
})
