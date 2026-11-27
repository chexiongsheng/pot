/**
 * 原生插件（pot_gfx）按平台检查与构建：出包（游戏 / Runner）前调用 ensureNative，
 * packages/com.pot.core/Plugins 下缺少对应平台的库时从 native/pot_gfx 构建。
 *
 *   win64    Plugins/Windows/x86_64/pot_gfx.dll        ← CMake + MSVC 编译 native/pot_gfx（不入库）
 *   webgl    Plugins/WebGL/pot_gfx/*.cpp|*.h           ← sync-webgl.js 从 native/pot_gfx/src 同步源码（Unity 用 emscripten 编译）
 *   android  Plugins/Android/arm64-v8a/libpot_gfx.so   ← CMake + Unity 自带 NDK + Ninja 精简构建（只有 GLES3 后端，不入库）
 *   macos    Plugins/macOS/pot_gfx.bundle              ← CMake + Xcode 命令行工具（clang）编译，arm64+x86_64 通用包，Metal 后端（不入库）
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
const ANDROID_SO = path.join(PLUGINS, 'Android/arm64-v8a/libpot_gfx.so')
const MACOS_BUNDLE = path.join(PLUGINS, 'macOS/pot_gfx.bundle')
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
  if (platform === 'android') return [ANDROID_SO]
  if (platform === 'macos') return [MACOS_BUNDLE]
  return []
}

function missingFiles(platform) {
  return requiredFiles(platform).filter((f) => !fs.existsSync(f))
}

/** 在 root 下按广度优先找含 header 的目录（优先名为 PluginAPI 的），不跟随符号链接 */
function findHeaderDir(root, header, maxDepth) {
  const hits = []
  let level = [root]
  for (let depth = 0; depth <= maxDepth && level.length; depth++) {
    const next = []
    for (const dir of level) {
      let entries
      try { entries = fs.readdirSync(dir, { withFileTypes: true }) } catch { continue }
      if (entries.some((e) => e.isFile() && e.name === header)) hits.push(dir)
      for (const e of entries) if (e.isDirectory()) next.push(path.join(dir, e.name))
    }
    if (hits.length) break
    level = next
  }
  return hits.find((d) => path.basename(d) === 'PluginAPI') || hits[0] || null
}

/**
 * Unity.exe → Editor/Data/PluginAPI；macOS 的 Unity.app/Contents/MacOS/Unity → Contents/PluginAPI；
 * 没有则用仓库自带头文件（requireMetal 时不行：自带的没有 IUnityGraphicsMetal.h）
 */
function pluginApiDir(unity, requireMetal = false) {
  const header = requireMetal ? 'IUnityGraphicsMetal.h' : 'IUnityGraphics.h'
  const tried = []
  if (unity) {
    let exe = unity
    try { exe = fs.realpathSync(unity) } catch {}
    // 允许直接传 Unity.app（目录）
    if (exe.endsWith('.app') && fs.existsSync(path.join(exe, 'Contents/MacOS/Unity'))) exe = path.join(exe, 'Contents/MacOS/Unity')
    const bin = path.dirname(exe)
    const candidates = [
      path.join(bin, 'Data/PluginAPI'),          // Windows: Editor/Data/PluginAPI
      path.join(bin, '../PluginAPI'),            // macOS: Unity.app/Contents/PluginAPI
      path.join(bin, '../Resources/PluginAPI'),  // macOS 部分版本
      path.join(bin, '../../../PluginAPI'),      // macOS: 与 Unity.app 同级
    ]
    for (const dir of candidates) {
      tried.push(path.resolve(dir))
      if (fs.existsSync(path.join(dir, header))) return path.resolve(dir)
    }
    // 兜底（仅 Metal 场景）：在编辑器安装根目录（Unity.app 的上级）下有限深度搜索
    if (requireMetal) {
      const root = exe.includes('.app/') ? path.dirname(exe.slice(0, exe.indexOf('.app/') + 4)) : bin
      const found = findHeaderDir(root, header, 7)
      if (found) return found
      tried.push(`${root}/**（深度 7）`)
    }
  }
  if (requireMetal) {
    throw new Error(`找不到 Unity 的 PluginAPI（需要 IUnityGraphicsMetal.h），用 --unity 指定 Unity.app 路径\n  --unity=${unity || '(空)'}\n  已查找：\n    ${tried.join('\n    ') || '(无)'}`)
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

/** macOS：CMake（Unix Makefiles）+ clang，arm64;x86_64 通用 bundle，D3D11 不编、Metal 后端编入 */
function buildMacos(unity, say) {
  if (process.platform !== 'darwin') throw new Error('pot_gfx.bundle 只能在 macOS 上构建（需要 CMake 与 Xcode 命令行工具）')
  const build = path.join(NATIVE, 'build-macos')
  const api = pluginApiDir(unity, true)
  run('cmake', ['-S', NATIVE, '-B', build, '-DCMAKE_BUILD_TYPE=Release', `-DUNITY_PLUGIN_API=${api}`], say)
  run('cmake', ['--build', build, '--config', 'Release', '--target', 'pot_gfx', '--parallel'], say)
  const bundle = [path.join(build, 'pot_gfx.bundle'), path.join(build, 'Release/pot_gfx.bundle')].find((f) => fs.existsSync(f))
  if (!bundle) throw new Error(`构建完成但没找到 pot_gfx.bundle（${build}）`)
  fs.mkdirSync(path.dirname(MACOS_BUNDLE), { recursive: true })
  fs.rmSync(MACOS_BUNDLE, { recursive: true, force: true })
  fs.cpSync(bundle, MACOS_BUNDLE, { recursive: true })
}

function syncWebgl(unity) {
  const api = pluginApiDir(unity)
  require('../../native/pot_gfx/sync-webgl').sync(api === BUNDLED_PLUGIN_API ? [] : ['--plugin-api', api])
}

/** NDK 根目录：环境变量 ANDROID_NDK_ROOT / ANDROID_NDK_HOME，否则 Unity 自带的 PlaybackEngines/AndroidPlayer/NDK */
function findNdk(unity) {
  const candidates = [process.env.ANDROID_NDK_ROOT, process.env.ANDROID_NDK_HOME]
  if (unity) candidates.push(path.join(path.dirname(unity), 'Data/PlaybackEngines/AndroidPlayer/NDK'))
  const ndk = candidates.find((d) => d && fs.existsSync(path.join(d, 'build/cmake/android.toolchain.cmake')))
  if (!ndk) throw new Error('找不到 Android NDK：安装 Unity 的 Android Build Support（含 NDK），或设置 ANDROID_NDK_ROOT')
  return ndk
}

/** Android arm64-v8a：NDK 工具链 + Ninja，只编 GLES3 后端（CMakeLists 的 if(ANDROID) 分支，不拉 glslang） */
function buildAndroid(unity, say) {
  const ndk = findNdk(unity).replace(/\\/g, '/')
  const build = path.join(NATIVE, 'build-android')
  const api = pluginApiDir(unity).replace(/\\/g, '/')
  run('cmake', [
    '-S', NATIVE, '-B', build, '-G', 'Ninja',
    `-DCMAKE_TOOLCHAIN_FILE=${ndk}/build/cmake/android.toolchain.cmake`,
    '-DANDROID_ABI=arm64-v8a', '-DANDROID_PLATFORM=android-24', '-DANDROID_STL=c++_static',
    '-DCMAKE_BUILD_TYPE=Release', `-DUNITY_PLUGIN_API=${api}`,
  ], say)
  run('cmake', ['--build', build, '--target', 'pot_gfx'], say)
  const so = path.join(build, 'libpot_gfx.so')
  if (!fs.existsSync(so)) throw new Error(`构建完成但没找到 libpot_gfx.so（${build}）`)
  fs.mkdirSync(path.dirname(ANDROID_SO), { recursive: true })
  fs.copyFileSync(so, ANDROID_SO)
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
  else if (platform === 'android') buildAndroid(options.unity, say)
  else if (platform === 'macos') buildMacos(options.unity, say)
  const still = missingFiles(platform)
  if (still.length) throw new Error(`原生库构建后仍缺少：${still.map(rel).join('、')}`)
  say(`[native] ${platform} 完成（${Math.round((Date.now() - started) / 1000)} 秒）`)
  return { platform, built: true, files: requiredFiles(platform) }
}

/** native 命令的平台名：release 的平台（win64 / android / webgl）之外再接受 macos（mac / osx） */
function normalizeNativePlatform(name) {
  const p = String(name).trim().toLowerCase()
  if (['macos', 'mac', 'osx', 'darwin'].includes(p)) return 'macos'
  return require('./release').normalizePlatform(name)
}

/** 当前主机默认构建的平台 */
function hostPlatform() {
  return process.platform === 'darwin' ? 'macos' : 'win64'
}

module.exports = { ensureNative, requiredFiles, missingFiles, normalizeNativePlatform, hostPlatform, WIN64_DLL, ANDROID_SO, MACOS_BUNDLE }
