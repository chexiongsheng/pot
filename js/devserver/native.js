/**
 * 原生插件（pot_gfx）按平台检查与构建：出包（游戏 / Runner）前调用 ensureNative，
 * packages/com.pot.core/Plugins 下缺少对应平台的库时从 native/pot_gfx 构建。
 *
 *   win64    Plugins/Windows/x86_64/pot_gfx.dll        ← CMake + MSVC 编译 native/pot_gfx（不入库）
 *   webgl    Plugins/WebGL/pot_gfx/*.cpp|*.h           ← sync-webgl.js 从 native/pot_gfx/src 同步源码（Unity 用 emscripten 编译）
 *   android  暂无 pot_gfx（GLES/Vulkan 后端未接入 Android 构建），不检查
 *
 * 只检查是否存在，不比较新旧：改了 native/pot_gfx/src 后用 `pot native --platform win64 --force` 重建。
 */
const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

const REPO = path.resolve(__dirname, '../..')
const NATIVE = path.join(REPO, 'native/pot_gfx')
const PLUGINS = path.join(REPO, 'packages/com.pot.core/Plugins')
const WIN64_DLL = path.join(PLUGINS, 'Windows/x86_64/pot_gfx.dll')
/** 仓库内自带的 Unity PluginAPI 头文件（IUnityInterface.h / IUnityGraphics.h），找不到 Unity 时用它 */
const BUNDLED_PLUGIN_API = path.join(PLUGINS, 'WebGL/pot_gfx')

function webglFiles() {
  const { FILES } = require('../../native/pot_gfx/sync-webgl')
  return [...FILES, 'IUnityInterface.h', 'IUnityGraphics.h'].map((f) => path.join(BUNDLED_PLUGIN_API, f))
}

/** 平台 → 需要存在的库文件 */
function requiredFiles(platform) {
  if (platform === 'win64') return [WIN64_DLL]
  if (platform === 'webgl') return webglFiles()
  return []
}

function missingFiles(platform) {
  return requiredFiles(platform).filter((f) => !fs.existsSync(f))
}

/** Unity.exe → Editor/Data/PluginAPI；没有则用仓库自带头文件 */
function pluginApiDir(unity) {
  if (unity) {
    const dir = path.join(path.dirname(unity), 'Data/PluginAPI')
    if (fs.existsSync(path.join(dir, 'IUnityGraphics.h'))) return dir
  }
  if (fs.existsSync(path.join(BUNDLED_PLUGIN_API, 'IUnityGraphics.h'))) return BUNDLED_PLUGIN_API
  throw new Error('找不到 Unity PluginAPI 头文件（IUnityGraphics.h），用 --unity 指定 Unity.exe')
}

function run(cmd, args, say) {
  say(`      > ${cmd} ${args.join(' ')}`)
  const res = spawnSync(cmd, args, { stdio: 'inherit', windowsHide: true })
  if (res.error) throw new Error(`${cmd} 启动失败：${res.error.message}（确认已安装并在 PATH 中）`)
  if (res.status !== 0) throw new Error(`${cmd} 失败（exit ${res.status}）`)
}

function buildWin64(unity, say) {
  if (process.platform !== 'win32') throw new Error('pot_gfx.dll 只能在 Windows 上构建（需要 CMake 与 Visual Studio C++ 工具链）')
  const build = path.join(NATIVE, 'build')
  const api = pluginApiDir(unity).replace(/\\/g, '/')
  // 已配置过的 build 目录沿用原生成器，否则用 CMake 默认（最新的 Visual Studio）
  const configured = fs.existsSync(path.join(build, 'CMakeCache.txt'))
  run('cmake', ['-S', NATIVE, '-B', build, ...(configured ? [] : ['-A', 'x64']), `-DUNITY_PLUGIN_API=${api}`], say)
  run('cmake', ['--build', build, '--config', 'Release', '--target', 'pot_gfx', '--parallel'], say)
  const dll = [path.join(build, 'Release/pot_gfx.dll'), path.join(build, 'pot_gfx.dll')].find((f) => fs.existsSync(f))
  if (!dll) throw new Error(`构建完成但没找到 pot_gfx.dll（${build}）`)
  fs.mkdirSync(path.dirname(WIN64_DLL), { recursive: true })
  fs.copyFileSync(dll, WIN64_DLL)
}

function syncWebgl(unity) {
  const api = pluginApiDir(unity)
  require('../../native/pot_gfx/sync-webgl').sync(api === BUNDLED_PLUGIN_API ? [] : ['--plugin-api', api])
}

/**
 * 确保平台对应的原生库存在。options：{ unity, force, quiet }
 * 返回 { platform, built, files }
 */
function ensureNative(platform, options = {}) {
  const say = options.quiet ? () => {} : (text) => console.log(text)
  const missing = options.force ? requiredFiles(platform) : missingFiles(platform)
  if (missing.length === 0) return { platform, built: false, files: requiredFiles(platform) }
  const rel = (f) => path.relative(REPO, f).replace(/\\/g, '/')
  say(`[native] ${platform}：${options.force ? '强制重建' : `缺少 ${missing.map(rel).join('、')}`}，从 native/pot_gfx 构建`)
  const started = Date.now()
  if (platform === 'win64') buildWin64(options.unity, say)
  else if (platform === 'webgl') syncWebgl(options.unity)
  const still = missingFiles(platform)
  if (still.length) throw new Error(`原生库构建后仍缺少：${still.map(rel).join('、')}`)
  say(`[native] ${platform} 完成（${Math.round((Date.now() - started) / 1000)} 秒）`)
  return { platform, built: true, files: requiredFiles(platform) }
}

module.exports = { ensureNative, requiredFiles, missingFiles, WIN64_DLL }
