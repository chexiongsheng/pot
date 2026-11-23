/**
 * 发布出包（不需要打开 Unity 编辑器）：
 * - resolveRelease：manifest.json → 出包配置（名称、公司、包名、版本、versionCode、图标、方向、窗口、产物文件名）
 * - stageGame：TS 编译为 bundle.cjs（buildRelease）→ <stage>/game/**，再写 <stage>/release.json 与图标
 * - findUnity：--unity / 环境变量 POT_UNITY / 按 player 工程的 Unity 版本在 Hub 安装目录里找
 * - releaseGame：检查原生库（native.js）→ 暂存 → Unity -batchmode -executeMethod Pot.Build.PotBuild.Build → 汇报产物与日志
 * - releaseRunner：检查原生库 → Unity -batchmode -executeMethod RunnerBuild.BuildWin64|BuildAndroid（runner/ 工程）
 *
 * manifest.json 中与发布相关的字段（都可省略）：
 *   name / id / version          产品名 / 包名缺省来源 / 版本
 *   icon                         图标（相对游戏目录，png/jpg；缺省找 icon.png）
 *   release.company              公司名（缺省 pot）
 *   release.packageId            包名（Android applicationId 等；缺省由 id 推出，如 pot.saltline）
 *   release.versionCode          Android 版本号（缺省由 version 推出：1.2.3 → 10203）
 *   release.orientation          landscape（缺省）| portrait | auto
 *   release.window               { width, height, fullscreen, resizable }（桌面）
 *   release.fileName             产物文件名（缺省为 id 最后一段）
 *   release.font                 内置字体源（ttf/otf，相对游戏目录；缺省找本机 Noto Sans SC / 思源黑体），见 font.js
 *   release.fontChars            额外要放进字体子集的字符（运行时拼出、源码里没有的字）
 */
const fs = require('fs')
const path = require('path')
const os = require('os')
const { spawn } = require('child_process')
const { buildRelease } = require('./builder')
const { stageFont } = require('./font')
const { ensureNative } = require('./native')

const REPO = path.resolve(__dirname, '../..')
const DEFAULT_PROJECT = path.join(REPO, 'player')

/** 平台名 → Unity -buildTarget 名与产物形态 */
const PLATFORMS = {
  win64: { unity: 'Win64', ext: '.exe' },
  android: { unity: 'Android', ext: '.apk' },
  webgl: { unity: 'WebGL', ext: '' },
}

function normalizePlatform(name) {
  const key = String(name ?? '').toLowerCase()
  const alias = { windows: 'win64', win: 'win64', apk: 'android', web: 'webgl' }
  const platform = alias[key] ?? key
  if (!PLATFORMS[platform]) throw new Error(`不支持的平台：${name}（可选 win64 | android | webgl）`)
  return platform
}

/** Java 包名规则：至少两段，每段字母开头、只含字母数字下划线 */
function toPackageId(text) {
  let parts = String(text ?? '')
    .split('.')
    .map((s) => s.replace(/[^A-Za-z0-9_]/g, '_').replace(/^_+|_+$/g, ''))
    .filter(Boolean)
    .map((s) => (/^[A-Za-z]/.test(s) ? s : `g${s}`))
  if (parts.length === 0) parts = ['game']
  if (parts.length === 1) parts = ['com', 'pot', ...parts]
  return parts.join('.').toLowerCase()
}

/** 1.2.3 → 10203（每段 0..99）；无法解析时为 1 */
function toVersionCode(version) {
  const m = /^(\d+)(?:\.(\d+))?(?:\.(\d+))?/.exec(String(version ?? ''))
  if (!m) return 1
  const [a, b, c] = [m[1], m[2] ?? 0, m[3] ?? 0].map((n) => Math.min(99, Number(n)))
  return Math.max(1, a * 10000 + b * 100 + c)
}

function safeFileName(text) {
  const name = String(text ?? '').replace(/[<>:"/\\|?*\x00-\x1f]/g, '').trim()
  return name || 'game'
}

/** manifest → 出包配置（纯函数，便于测试）。iconFile 为解析后的图标绝对路径或 null */
function resolveRelease(manifest, gameDir) {
  const release = manifest.release ?? {}
  const window = release.window ?? {}
  const id = String(manifest.id)
  const version = String(manifest.version ?? '0.0.0')
  const orientation = ['landscape', 'portrait', 'auto'].includes(release.orientation) ? release.orientation : 'landscape'
  let iconFile = null
  const iconRel = release.icon ?? manifest.icon ?? (fs.existsSync(path.join(gameDir, 'icon.png')) ? 'icon.png' : null)
  if (iconRel) {
    iconFile = path.resolve(gameDir, iconRel)
    if (!fs.existsSync(iconFile)) throw new Error(`manifest 指定的图标不存在：${iconFile}`)
    if (!/\.(png|jpe?g)$/i.test(iconFile)) throw new Error(`图标只支持 png/jpg：${iconFile}`)
  }
  return {
    config: {
      id,
      productName: String(manifest.name ?? id),
      company: String(release.company ?? 'pot'),
      packageId: toPackageId(release.packageId ?? id),
      version,
      versionCode: Number.isInteger(release.versionCode) ? release.versionCode : toVersionCode(version),
      icon: iconFile ? `icon${path.extname(iconFile).toLowerCase()}` : '',
      orientation,
      width: Number(window.width ?? 1280),
      height: Number(window.height ?? 720),
      fullscreen: !!window.fullscreen,
      resizable: window.resizable !== false,
      fileName: safeFileName(release.fileName ?? id.split('.').pop()),
    },
    iconFile,
  }
}

/** 暂存：<stage>/game/（manifest.json + bundle.cjs + data/**）、<stage>/release.json、<stage>/icon.* */
async function stageGame(gameDir, stageDir) {
  gameDir = path.resolve(gameDir)
  stageDir = path.resolve(stageDir)
  fs.rmSync(stageDir, { recursive: true, force: true })
  const built = await buildRelease(gameDir, path.join(stageDir, 'game'))
  const manifest = JSON.parse(fs.readFileSync(path.join(gameDir, 'manifest.json'), 'utf8'))
  const { config, iconFile } = resolveRelease(manifest, gameDir)
  if (iconFile) fs.copyFileSync(iconFile, path.join(stageDir, config.icon))
  const font = await stageFont(manifest, gameDir, stageDir)
  config.font = font.file
  fs.writeFileSync(path.join(stageDir, 'release.json'), JSON.stringify(config, null, 2))
  return { stageDir, units: built.units, config, font }
}

function readProjectVersion(project) {
  const file = path.join(project, 'ProjectSettings/ProjectVersion.txt')
  if (!fs.existsSync(file)) return null
  return /m_EditorVersion:\s*(\S+)/.exec(fs.readFileSync(file, 'utf8'))?.[1] ?? null
}

/** 找 Unity 可执行文件：显式指定 → 环境变量 → Hub 安装目录（按工程的 Unity 版本） */
function findUnity(explicit, project = DEFAULT_PROJECT) {
  const given = explicit ?? process.env.POT_UNITY ?? process.env.UNITY_PATH
  if (given) {
    let exe = path.resolve(given)
    if (fs.existsSync(exe) && fs.statSync(exe).isDirectory()) {
      const inner = [path.join(exe, 'Unity.exe'), path.join(exe, 'Editor/Unity.exe'), path.join(exe, 'Unity.app/Contents/MacOS/Unity')]
      exe = inner.find((f) => fs.existsSync(f)) ?? exe
    }
    if (!fs.existsSync(exe)) throw new Error(`找不到 Unity：${exe}`)
    return exe
  }
  const version = readProjectVersion(project)
  if (!version) throw new Error(`读不到 ${project} 的 Unity 版本，请用 --unity 指定 Unity 路径`)
  const roots = []
  try {
    const secondary = path.join(process.env.APPDATA ?? path.join(os.homedir(), 'AppData/Roaming'), 'UnityHub/secondaryInstallPath.json')
    const dir = JSON.parse(fs.readFileSync(secondary, 'utf8'))
    if (dir) roots.push(dir)
  } catch {}
  for (const drive of ['C', 'D', 'E', 'F']) {
    roots.push(`${drive}:/Program Files/Unity/Hub/Editor`, `${drive}:/Unity/Hub/Editor`, `${drive}:/Unity`)
  }
  roots.push('/Applications/Unity/Hub/Editor')
  for (const root of roots) {
    for (const exe of [path.join(root, version, 'Editor/Unity.exe'), path.join(root, version, 'Unity.app/Contents/MacOS/Unity')]) {
      if (fs.existsSync(exe)) return exe
    }
  }
  throw new Error(`没找到 Unity ${version}（工程 ${project} 需要的版本），请用 --unity 或环境变量 POT_UNITY 指定 Unity.exe 路径`)
}

/** 工程是否正被 Unity 编辑器打开（Temp/UnityLockfile 被独占） */
function projectLocked(project) {
  const lock = path.join(project, 'Temp/UnityLockfile')
  if (!fs.existsSync(lock)) return false
  try {
    fs.closeSync(fs.openSync(lock, 'r+'))
    return false
  } catch (error) {
    return error.code === 'EBUSY' || error.code === 'EPERM' || error.code === 'EACCES'
  }
}

/** 产物路径：win64 → <out>/<文件名>.exe；android → <out>/<文件名>-<版本>.apk；webgl → <out>/ */
function outputPath(outDir, platform, config) {
  if (platform === 'win64') return path.join(outDir, `${config.fileName}.exe`)
  if (platform === 'android') return path.join(outDir, `${config.fileName}-${config.version}.apk`)
  return outDir
}

const LOG_PATTERNS = /\[pot\]|error CS\d+|Error building Player|BuildFailedException|Build Finished|Exception:|Shader error|UnityException|CommandInvokationFailure|IL2CPP error|Gradle build failed|Aborting batchmode/i
const LOG_PREFIX = /^\d{4}-\d\d-\d\dT[\d:.]+Z\|0x[0-9a-f]+\|/i

/** 跟随 Unity 日志，只转发关键行 */
function tailLog(file, onLine) {
  let pos = 0
  let rest = ''
  const read = () => {
    if (!fs.existsSync(file)) return
    const size = fs.statSync(file).size
    if (size < pos) pos = 0
    if (size === pos) return
    const fd = fs.openSync(file, 'r')
    const buf = Buffer.alloc(size - pos)
    fs.readSync(fd, buf, 0, buf.length, pos)
    fs.closeSync(fd)
    pos = size
    const lines = (rest + buf.toString('utf8')).split(/\r?\n/)
    rest = lines.pop()
    for (const line of lines) onLine(line)
  }
  const timer = setInterval(read, 1000)
  return () => {
    clearInterval(timer)
    read()
    if (rest) onLine(rest)
  }
}

function collectErrors(log) {
  if (!fs.existsSync(log)) return []
  const lines = fs.readFileSync(log, 'utf8').split(/\r?\n/).map((l) => l.replace(LOG_PREFIX, '').trim())
  const hits = lines.filter((l) => /error CS\d+|\[pot\] 构建失败|Error building Player|BuildFailedException|Exception:|CommandInvokationFailure|error:|Shader error|Aborting batchmode|Scripts have compiler errors/i.test(l))
  return [...new Set(hits)].slice(-40)
}

/**
 * 出包。options：{ platform, unity, out, project, quiet, log }
 * 返回 { ok, platform, output, log, seconds, config, errors? }
 */
async function releaseGame(gameDir, options = {}) {
  const started = Date.now()
  gameDir = path.resolve(gameDir)
  const platform = normalizePlatform(options.platform ?? 'win64')
  const project = path.resolve(options.project ?? DEFAULT_PROJECT)
  if (!fs.existsSync(path.join(project, 'Packages/manifest.json'))) throw new Error(`不是 Unity 工程：${project}`)
  const unity = findUnity(options.unity, project)
  if (projectLocked(project)) {
    throw new Error(`工程 ${project} 正被 Unity 编辑器打开。请先关闭编辑器，或在编辑器里用菜单 pot/Build Game... 出包`)
  }
  const say = options.quiet ? () => {} : (text) => console.log(text)
  ensureNative(platform, { unity, quiet: options.quiet })

  const work = path.join(gameDir, '.pot/release')
  const stageDir = path.join(work, 'stage')
  say(`[1/3] 编译游戏 TS → bundle.cjs，暂存到 ${stageDir}`)
  const staged = await stageGame(gameDir, stageDir)
  const { config } = staged
  say(`      ${config.productName}  ${config.packageId}  v${config.version}（${config.versionCode}）${config.icon ? '  有图标' : ''}`)
  const { font } = staged
  if (font.file) say(`      内置字体：${path.basename(font.source)} 子集 ${font.chars} 字 ${Math.round(font.bytes / 1024)} KB`)
  else say(`      警告：${font.warning}`)

  const outDir = path.resolve(options.out ?? path.join(REPO, 'release', config.fileName, platform))
  const output = outputPath(outDir, platform, config)
  fs.mkdirSync(outDir, { recursive: true })
  const log = path.resolve(options.log ?? path.join(work, `unity-${platform}.log`))
  fs.rmSync(log, { force: true })

  say(`[2/3] Unity 出包（${PLATFORMS[platform].unity}），日志 ${log}`)
  const code = await runUnity({
    unity, project, platform, log, say,
    args: ['-executeMethod', 'Pot.Build.PotBuild.Build', `-potStage=${stageDir}`, `-potTarget=${PLATFORMS[platform].unity}`, `-potOut=${output}`],
  })

  const seconds = Math.round((Date.now() - started) / 1000)
  const exists = platform === 'webgl' ? fs.existsSync(path.join(output, 'index.html')) : fs.existsSync(output)
  let ok = code === 0 && exists
  const result = { ok, platform, output, log, seconds, config }
  if (ok) {
    removeDoNotShip(outDir)
    if (platform === 'webgl') {
      const missing = ['puerts-runtime.js', 'puerts_browser_js_resources.js'].filter((f) => !fs.existsSync(path.join(output, f)))
      if (missing.length) {
        ok = result.ok = false
        result.errors = [`WebGL 产物缺少 ${missing.join('、')}：Puerts WebGL 后处理失败，确认 third_party/puerts/webgl/Cli/Javascripts~ 已 npm i`]
      }
    }
  }
  if (!ok) {
    result.exitCode = code
    result.errors = result.errors ?? collectErrors(log)
  }
  say(ok ? `[3/3] 完成：${output}（${seconds} 秒）` : `[3/3] 失败（exit ${code}），详见 ${log}`)
  return result
}

/** batchmode 调用 Unity（-batchmode -quit -projectPath -buildTarget ... -logFile），转发关键日志行，返回退出码 */
async function runUnity({ unity, project, platform, args, log, say }) {
  say(`      ${unity}`)
  const stop = tailLog(log, (line) => {
    line = line.replace(LOG_PREFIX, '').trim()
    if (LOG_PATTERNS.test(line) && !/^at /.test(line) && !/^Start importing /.test(line)) say(`      ${line.slice(0, 300)}`)
  })
  const full = ['-batchmode', '-quit', '-projectPath', project, '-buildTarget', PLATFORMS[platform].unity, ...args, '-logFile', log]
  return new Promise((resolve, reject) => {
    const child = spawn(unity, full, { stdio: 'ignore', windowsHide: true })
    child.on('error', reject)
    child.on('exit', (c) => resolve(c ?? 1))
  }).finally(stop)
}

/** Runner 支持的平台 → RunnerBuild 入口 */
const RUNNER_METHODS = { win64: 'RunnerBuild.BuildWin64', android: 'RunnerBuild.BuildAndroid' }

/**
 * 构建 Runner（runner/ 工程）。options：{ platform, unity, out, quiet, log }
 * 产物：win64 → <out>/PotRunner.exe；android → <out>/PotRunner.apk
 * 返回 { ok, platform, output, log, seconds, errors? }
 */
async function releaseRunner(options = {}) {
  const started = Date.now()
  const platform = normalizePlatform(options.platform ?? 'win64')
  if (!RUNNER_METHODS[platform]) throw new Error(`Runner 不支持平台 ${platform}（可选 win64 | android）`)
  const project = path.join(REPO, 'runner')
  const unity = findUnity(options.unity, project)
  if (projectLocked(project)) throw new Error(`工程 ${project} 正被 Unity 编辑器打开，请先关闭编辑器，或在编辑器里用菜单 pot/Build Runner`)
  const say = options.quiet ? () => {} : (text) => console.log(text)
  ensureNative(platform, { unity, quiet: options.quiet })

  const outDir = path.resolve(options.out ?? path.join(REPO, 'release/runner', platform))
  const output = path.join(outDir, `PotRunner${PLATFORMS[platform].ext}`)
  fs.mkdirSync(outDir, { recursive: true })
  const log = path.resolve(options.log ?? path.join(REPO, 'release/runner', `unity-${platform}.log`))
  fs.mkdirSync(path.dirname(log), { recursive: true })
  fs.rmSync(log, { force: true })

  say(`[1/2] Unity 构建 Runner（${PLATFORMS[platform].unity}），日志 ${log}`)
  const code = await runUnity({ unity, project, platform, log, say, args: ['-executeMethod', RUNNER_METHODS[platform], `-potOut=${output}`] })
  const seconds = Math.round((Date.now() - started) / 1000)
  const ok = code === 0 && fs.existsSync(output)
  const result = { ok, platform, output, log, seconds }
  if (ok) removeDoNotShip(outDir)
  else {
    result.exitCode = code
    result.errors = collectErrors(log)
  }
  say(ok ? `[2/2] 完成：${output}（${seconds} 秒）` : `[2/2] 失败（exit ${code}），详见 ${log}`)
  return result
}

/** 删掉 Unity 生成在输出目录里、明确标注不要发布的调试目录 */
function removeDoNotShip(dir) {
  if (!fs.existsSync(dir)) return
  for (const name of fs.readdirSync(dir)) {
    if (/_(BurstDebugInformation_DoNotShip|BackUpThisFolder_ButDontShipItWithYourGame)$/.test(name)) {
      fs.rmSync(path.join(dir, name), { recursive: true, force: true })
    }
  }
}

module.exports = { resolveRelease, stageGame, findUnity, releaseGame, releaseRunner, toPackageId, toVersionCode, normalizePlatform, PLATFORMS }
