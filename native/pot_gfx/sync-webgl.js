#!/usr/bin/env node
// 把 pot_gfx 的 WebGL 所需源码拷进 com.pot.core/Plugins/WebGL/pot_gfx（Unity 打 WebGL 时用 emscripten 编译）。
// native/pot_gfx/src 是唯一源头；改了这些文件后执行：node native/pot_gfx/sync-webgl.js
// js/test/pot-gfx-webgl.test.js 检查两边一致，忘了同步会测试失败。
// 用法：node sync-webgl.js [--check] [--plugin-api <Unity Editor/Data/PluginAPI>]
'use strict'
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '../..')
const SRC = path.join(__dirname, 'src')
const DST = path.join(ROOT, 'packages/com.pot.core/Plugins/WebGL/pot_gfx')
/** 来自 native/pot_gfx/src 的文件（WebGL 不带 glslang/SPIRV-Cross、编译缓存、D3D11 后端） */
const FILES = ['plugin.cpp', 'backend.h', 'compiler.h', 'reflect.cpp', 'backend_gles3.cpp']
/** 来自 Unity PluginAPI 的头文件 */
const UNITY_HEADERS = ['IUnityInterface.h', 'IUnityGraphics.h']

function pluginMeta(guid) {
  return `fileFormatVersion: 2
guid: ${guid}
PluginImporter:
  externalObjects: {}
  serializedVersion: 2
  iconMap: {}
  executionOrder: {}
  defineConstraints: []
  isPreloaded: 0
  isOverridable: 1
  isExplicitlyReferenced: 0
  validateReferences: 1
  platformData:
  - first:
      Any: 
    second:
      enabled: 0
      settings: {}
  - first:
      Editor: Editor
    second:
      enabled: 0
      settings:
        DefaultValueInitialized: true
  - first:
      WebGL: WebGL
    second:
      enabled: 1
      settings: {}
  userData: 
  assetBundleName: 
  assetBundleVariant: 
`
}

/** 稳定 guid（按相对路径 hash），重复同步不会让 Unity 重新识别资源 */
function guidFor(rel) {
  return require('crypto').createHash('md5').update('pot_gfx/webgl/' + rel).digest('hex')
}

function findPluginApi(argv) {
  const i = argv.indexOf('--plugin-api')
  if (i >= 0) return argv[i + 1]
  if (process.env.UNITY_PLUGIN_API) return process.env.UNITY_PLUGIN_API
  const ver = fs.readFileSync(path.join(ROOT, 'player/ProjectSettings/ProjectVersion.txt'), 'utf8').match(/m_EditorVersion:\s*(\S+)/)[1]
  for (const hub of ['C:/Program Files/Unity/Hub/Editor', 'D:/Program Files/Unity/Hub/Editor']) {
    const p = path.join(hub, ver, 'Editor/Data/PluginAPI')
    if (fs.existsSync(p)) return p
  }
  return null
}

/** 期望的目标目录内容：相对路径 → Buffer */
function expected(argv = []) {
  const out = new Map()
  for (const f of FILES) out.set(f, fs.readFileSync(path.join(SRC, f)))
  const api = findPluginApi(argv)
  for (const h of UNITY_HEADERS) {
    const p = api && path.join(api, h)
    if (p && fs.existsSync(p)) out.set(h, fs.readFileSync(p))
    else if (fs.existsSync(path.join(DST, h))) out.set(h, fs.readFileSync(path.join(DST, h)))
    else throw new Error(`找不到 Unity PluginAPI 头文件 ${h}，用 --plugin-api 指定目录`)
  }
  for (const rel of [...out.keys()]) out.set(rel + '.meta', Buffer.from(pluginMeta(guidFor(rel))))
  return out
}

function diff(argv = []) {
  const want = expected(argv)
  const bad = []
  for (const [rel, buf] of want) {
    const p = path.join(DST, rel)
    if (!fs.existsSync(p) || !fs.readFileSync(p).equals(buf)) bad.push(rel)
  }
  return bad
}

function sync(argv = []) {
  fs.mkdirSync(DST, { recursive: true })
  const want = expected(argv)
  for (const [rel, buf] of want) fs.writeFileSync(path.join(DST, rel), buf)
  for (const [dir, meta] of [[path.dirname(DST), 'WebGL.meta'], [DST, 'pot_gfx.meta']]) {
    const p = path.join(path.dirname(dir), path.basename(dir) + '.meta')
    if (!fs.existsSync(p)) {
      fs.writeFileSync(p, `fileFormatVersion: 2\nguid: ${guidFor('dir/' + meta)}\nfolderAsset: yes\nDefaultImporter:\n  externalObjects: {}\n  userData: \n  assetBundleName: \n  assetBundleVariant: \n`)
    }
  }
  return [...want.keys()]
}

module.exports = { diff, sync, DST, FILES }

if (require.main === module) {
  const argv = process.argv.slice(2)
  if (argv.includes('--check')) {
    const bad = diff(argv)
    if (bad.length) {
      console.error('Plugins/WebGL/pot_gfx 与 native/pot_gfx/src 不一致：' + bad.join(', ') + '\n执行 node native/pot_gfx/sync-webgl.js')
      process.exit(1)
    }
    console.log('一致')
  } else {
    console.log('已同步到 ' + path.relative(ROOT, DST) + '：' + sync(argv).filter(f => !f.endsWith('.meta')).join(', '))
  }
}
