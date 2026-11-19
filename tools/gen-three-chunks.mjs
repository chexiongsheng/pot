#!/usr/bin/env node
// 从 tools/vendor 的 three 生成 js/runtime/src/three-chunks.ts：全部 ShaderChunk + meshphysical 顶点/片元。
// 用法：node tools/gen-three-chunks.mjs
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const three = path.join(here, 'vendor/node_modules/three')
const src = path.join(three, 'src/renderers/shaders')
const version = JSON.parse(fs.readFileSync(path.join(three, 'package.json'), 'utf8')).version

const strip = (s) => s.replace(/\r\n/g, '\n').split('\n').map((l) => l.replace(/\s+$/, '')).filter((l, i, a) => l || (a[i - 1] ?? '')).join('\n').trim() + '\n'

const chunks = {}
const dir = path.join(src, 'ShaderChunk')
for (const file of fs.readdirSync(dir).sort()) {
  if (!file.endsWith('.glsl.js')) continue
  const mod = await import(pathToFileURL(path.join(dir, file)).href)
  chunks[file.slice(0, -'.glsl.js'.length)] = strip(mod.default)
}
const physical = await import(pathToFileURL(path.join(src, 'ShaderLib/meshphysical.glsl.js')).href)

const out = [
  `// 自动生成，勿手改：node tools/gen-three-chunks.mjs（three ${version}）`,
  `// three.js 着色器源码，MIT License，Copyright © 2010-2025 three.js authors`,
  `export const THREE_VERSION = ${JSON.stringify(version)}`,
  `export const THREE_CHUNKS: Record<string, string> = ${JSON.stringify(chunks, null, 1)}`,
  `export const THREE_PHYSICAL = ${JSON.stringify({ vertex: strip(physical.vertex), fragment: strip(physical.fragment) }, null, 1)}`,
  '',
].join('\n')
const target = path.resolve(here, '../js/runtime/src/three-chunks.ts')
fs.writeFileSync(target, out)
console.log(`three ${version}: ${Object.keys(chunks).length} chunks, ${(out.length / 1024).toFixed(1)} KB -> ${target}`)
