// 原生插件按平台的产物检查（不实际构建）
const test = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const path = require('path')
const { requiredFiles, ANDROID_SO, WIN64_DLL } = require('../devserver/native')

const REPO = path.resolve(__dirname, '../..')

test('native：各平台需要的产物', () => {
  assert.deepEqual(requiredFiles('win64'), [WIN64_DLL])
  assert.deepEqual(requiredFiles('android'), [ANDROID_SO])
  assert.ok(ANDROID_SO.replace(/\\/g, '/').endsWith('Plugins/Android/arm64-v8a/libpot_gfx.so'))
  assert.ok(requiredFiles('webgl').some((f) => f.endsWith('backend_gles3.cpp')))
  assert.deepEqual(requiredFiles('ios'), [])
})

test('native：Android .so 的 meta 入库且只对 Android ARM64 启用', () => {
  const meta = fs.readFileSync(ANDROID_SO + '.meta', 'utf8')
  assert.match(meta, /Android: Android\s+second:\s+enabled: 1\s+settings:\s+CPU: ARM64/)
  assert.match(meta, /Exclude Editor: 1/)
  const ignore = fs.readFileSync(path.join(REPO, '.gitignore'), 'utf8')
  assert.match(ignore, /Plugins\/Android\/arm64-v8a\/\*\.so/)
})

test('native：Android 走精简构建（不带 glslang 编译器）', () => {
  const cmake = fs.readFileSync(path.join(REPO, 'native/pot_gfx/CMakeLists.txt'), 'utf8')
  const android = cmake.slice(cmake.indexOf('if(ANDROID)'), cmake.indexOf('return()'))
  assert.match(android, /backend_gles3\.cpp/)
  assert.doesNotMatch(android, /compiler\.cpp|glslang/)
  const plugin = fs.readFileSync(path.join(REPO, 'native/pot_gfx/src/plugin.cpp'), 'utf8')
  assert.match(plugin, /#if !defined\(__EMSCRIPTEN__\) && !defined\(__ANDROID__\)\s+#define POT_GFX_COMPILER/)
})
