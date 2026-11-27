#!/usr/bin/env node
/**
 * pot 命令行：
 *   pot dev [--port 7788] [--root 目录]      启动 Dev Server（AI ↔ Runner 通道；/files/ 提供 root 下的文件给手机 Runner）
 *   pot open <游戏目录|.potg|URL> [--reset]   让已连接的 Runner 打开游戏（--reset 清空存档）
 *   pot restart [--reset]                   冷重启当前游戏（默认保留 state）
 *   pot check <游戏目录>                     试打包 + 求值校验（defineGame 游戏）+ 生成 .pot/types.d.ts + tsc 类型检查
 *   pot types <游戏目录>                     只生成 .pot/types.d.ts（游戏自写积木的属性、vars 的类型）
 *   pot test [游戏目录] [--update]          在无画面宿主上跑 tests/*.json（没有时跑冒烟），--update 写回 World 哈希
 *   pot record start [--reset] | record stop <文件.json> [--name 名字]
 *                                           在 Runner 里录制指令，停止时写成 pot test 的脚本（--reset 先清空存档重开）
 *   pot blocks [关键字] [--name 名字] [--dir 游戏目录] [--json]
 *                                           列出积木、预制件、界面标签、内置节点（系统级加游戏自写的），不需要 Runner
 *   pot eject --kit <名字> [游戏目录]        把套件复制进游戏 src/kits/<名字>/ 并改写 import（之后归游戏所有）
 *   pot build <游戏目录> <输出目录>           发布构建（manifest.json + bundle.cjs + data/）
 *   pot pack <游戏目录> [输出.potg]           打包为 .potg，Runner 可直接打开
 *   pot web <游戏目录> [输出目录]             构建网页（index.html + pot-web.js + game.js，缺省 <游戏目录>/.pot/web），静态托管即可玩
 *   pot release <游戏目录> [--platform win64|android|webgl[,…]] [--unity Unity.exe] [--out 目录]
 *                                           出包：TS 编译 → 暂存 → Unity -batchmode 打包（通用工程 player/），不用打开编辑器
 *   pot runner [--platform win64|android|macos[,…]] [--unity Unity.exe|Unity.app] [--out 目录]
 *                                           构建 Runner（runner/ 工程），默认输出 release/runner/<平台>/PotRunner.exe|.apk|.app
 *   pot native [--platform win64|webgl|android|macos[,…]] [--force] [--unity Unity.exe]
 *                                           检查/构建原生库 pot_gfx（release、runner 构建前会自动检查，缺了才编；--force 强制重建）
 *   pot stage <游戏目录> <暂存目录>           只暂存（game/ + release.json + 图标），供 Unity 菜单 pot/Build Game 使用
 *   pot mcp [--port 7788]                   以 stdio MCP 方式暴露调试工具
 *   pot status | logs [--follow] [--level error]
 *   pot eval <代码> | state [keys|get|set|reset] [key] [json] | query [info|objects|data|cache|modules|world|tree] [unit|筛选|挂载]
 *   pot world set <key 路径> <补丁 JSON> [--mount game] [--save] | world clear [--mount game] [--save] | world list
 *                                           运行期按 key 路径改属性；--save 写进游戏的 data/overrides.json（覆盖层）
 *   pot block verify <积木> [--test tests/x.json] [--steps 600] [--tolerance 1e-9]
 *                                           在 Runner 里用同一段输入分别跑 TS 与原生（C#）实现，逐步比较并给出耗时
 *   pot plugins | leaks | reload <单元...> | time [get|pause|resume|step|scale] [n]
 *   pot input axis <name> <x> <y> [frames] | input key <name> [down|up|tap] | input text <文字> | input clear
 *                                           input text 里 \n 为回车、\b 为退格
 *   pot screenshot [输出文件.png] [宽度]
 *
 * Runner 不依赖 Dev Server：直接运行 PotRunner.exe <游戏目录> 即可试玩，改源码自动热重载。
 */
const fs = require('fs')
const path = require('path')
const { client } = require('./client')

function parseArgs(argv) {
  const args = []
  const flags = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith('--')) {
      const [k, v] = a.slice(2).split('=')
      if (v !== undefined) flags[k] = v
      else if (argv[i + 1] && !argv[i + 1].startsWith('--')) flags[k] = argv[++i]
      else flags[k] = true
    } else {
      args.push(a)
    }
  }
  return { args, flags }
}

function print(value) {
  console.log(typeof value === 'string' ? value : JSON.stringify(value, null, 2))
}

function exitBy(result) {
  print(result)
  process.exitCode = result && result.ok === false ? 1 : 0
}

/** 读 pot test 脚本：先按当前目录找，再按 Runner 正在运行的游戏目录找 */
async function readTestScript(api, file) {
  const candidates = [path.resolve(file)]
  if (!path.isAbsolute(file)) {
    const status = await api.status().catch(() => null)
    const dir = status?.game?.dir
    if (dir) candidates.push(path.resolve(dir, file))
  }
  const hit = candidates.find((f) => fs.existsSync(f))
  if (!hit) throw new Error(`找不到测试脚本 ${file}（找过：${candidates.join('、')}）`)
  return JSON.parse(fs.readFileSync(hit, 'utf8'))
}

function parseValue(text) {
  if (text === undefined) return undefined
  try { return JSON.parse(text) } catch { return text }
}

async function main() {
  const [command = 'help', ...rest] = process.argv.slice(2)
  const { args, flags } = parseArgs(rest)
  const port = Number(flags.port ?? process.env.POT_PORT ?? 7788)
  const api = client(port)

  switch (command) {
    case 'dev': {
      const { DevServer } = require('./server')
      if (args[0]) console.log('提示：Dev Server 不再需要游戏路径。启动后用 pot open <游戏目录> 让 Runner 打开游戏')
      const server = new DevServer({ root: path.resolve(flags.root ?? '.'), port, quiet: !!flags.quiet })
      await server.start()
      const stop = () => server.close().finally(() => process.exit(0))
      process.on('SIGINT', stop)
      process.on('SIGTERM', stop)
      return
    }
    case 'open': {
      if (!args[0]) throw new Error('用法：pot open <游戏目录|.potg|URL> [--reset]')
      const target = /^https?:\/\//i.test(args[0]) ? args[0] : path.resolve(args[0])
      return exitBy(await api.open(target, { reset: !!flags.reset }))
    }
    case 'restart':
      return exitBy(await api.call({ type: 'restart', reset: !!flags.reset }))
    case 'check': {
      const { checkGame } = require('./builder')
      return exitBy(await checkGame(path.resolve(args[0] ?? '.')))
    }
    case 'test': {
      const { testGame } = require('./gametest')
      const result = await testGame(path.resolve(args[0] ?? '.'), { update: !!flags.update })
      if (flags.json || result.error) return exitBy(result)
      for (const r of result.results) {
        console.log(`${r.ok ? 'ok  ' : 'FAIL'} ${r.name}${r.file ? `（${r.file}）` : ''}${r.hash ? `  tick ${r.tick}  hash ${r.hash}` : ''}`)
        for (const f of r.failures) console.log(`     ${f}`)
      }
      console.log(result.ok ? `全部通过（${result.results.length}）` : '有失败')
      process.exitCode = result.ok ? 0 : 1
      return
    }
    case 'record': {
      const [action = 'status', file] = args
      if (action === 'start' && flags.reset) {
        const r = await api.call({ type: 'restart', reset: true })
        if (!r.ok) return exitBy(r)
        await new Promise((res) => setTimeout(res, 1500))
      }
      const res = await api.call({ type: 'record', action })
      if (action !== 'stop' || !res.ok) return exitBy(res)
      if (!file) return exitBy({ ok: false, error: '用法：pot record stop <文件.json> [--name 名字]' })
      const script = { name: flags.name ?? path.basename(file, '.json'), steps: res.data.steps, input: res.data.input, expect: res.data.expect }
      const out = path.resolve(file)
      fs.mkdirSync(path.dirname(out), { recursive: true })
      fs.writeFileSync(out, JSON.stringify(script, null, 2) + '\n', 'utf8')
      return print({ ok: true, file: out, steps: script.steps, inputs: script.input.length })
    }
    case 'types': {
      const { generateGameTypes } = require('./builder')
      return exitBy(await generateGameTypes(path.resolve(args[0] ?? '.')))
    }
    case 'blocks': {
      const { listBlocks } = require('./headless')
      const dir = path.resolve(flags.dir ?? '.')
      const { game, items } = await listBlocks(dir)
      if (flags.name) {
        const found = items.filter((i) => i.name === flags.name)
        if (!found.length) return exitBy({ ok: false, error: `没有 ${flags.name}` })
        return print(found.length === 1 ? found[0] : found)
      }
      const word = args[0]?.toLowerCase()
      const hit = word ? items.filter((i) => i.name.toLowerCase().includes(word) || String(i.about).toLowerCase().includes(word)) : items
      if (flags.json) return print(hit)
      const KIND = { block: '积木', prefab: '预制件', ui: '界面', node: '节点', kit: '套件' }
      const brief = (i) => {
        if (i.kind === 'kit') return [...i.blocks, ...i.prefabs].join(', ')
        if (i.kind === 'block') return Object.keys(i.props).join(', ')
        if (i.kind === 'prefab') return Object.keys(i.blocks).join(' + ') || '（空）'
        return Object.keys(i.props).filter((k) => !['at', 'w', 'h', 'grow', 'pad', 'hidden'].includes(k)).join(', ')
      }
      console.log(game ? `游戏 ${game}（系统级 + 套件 + 游戏自写）` : '系统级与套件（不在用 defineGame 的游戏目录下）')
      for (const i of hit) {
        const mark = i.kind === 'kit' ? (i.imported ? '（已引入）' : `（未引入：${i.usage}）`) : i.available ? '（未引入）' : ''
        console.log(`[${i.layer}] ${KIND[i.kind]} ${i.name}${mark}：${i.about}${brief(i) ? `  {${brief(i)}}` : ''}`)
      }
      console.log('详情：pot blocks --name <名字>')
      return
    }
    case 'eject': {
      if (!flags.kit || flags.kit === true) return exitBy({ ok: false, error: '用法：pot eject --kit <名字> [游戏目录]' })
      return exitBy(require('./eject').ejectKit(flags.kit, path.resolve(args[0] ?? '.')))
    }
    case 'build': {
      const { buildRelease } = require('./builder')
      if (args.length < 2) throw new Error('用法：pot build <游戏目录> <输出目录>')
      return print(await buildRelease(path.resolve(args[0]), path.resolve(args[1])))
    }
    case 'pack': {
      const { packGame } = require('./builder')
      if (args.length < 1) throw new Error('用法：pot pack <游戏目录> [输出文件.potg]')
      return print(await packGame(path.resolve(args[0]), args[1] && path.resolve(args[1])))
    }
    case 'web': {
      const { buildWeb } = require('./web')
      if (args.length < 1) throw new Error('用法：pot web <游戏目录> [输出目录]')
      return print(await buildWeb(path.resolve(args[0]), args[1] && path.resolve(args[1])))
    }
    case 'stage': {
      const { stageGame } = require('./release')
      if (args.length < 2) throw new Error('用法：pot stage <游戏目录> <暂存目录>')
      const res = await stageGame(path.resolve(args[0]), path.resolve(args[1]))
      return print({ stageDir: res.stageDir, units: res.units, release: res.config })
    }
    case 'release': {
      const { releaseGame } = require('./release')
      if (args.length < 1) throw new Error('用法：pot release <游戏目录> [--platform win64|android|webgl] [--unity Unity.exe] [--out 输出目录] [--project Unity 工程]')
      const platforms = String(flags.platform ?? 'win64').split(',')
      const results = []
      for (const platform of platforms) {
        results.push(await releaseGame(args[0], { platform, unity: flags.unity, out: platforms.length > 1 && flags.out ? path.join(flags.out, platform) : flags.out, project: flags.project }))
        if (!results[results.length - 1].ok) break
      }
      const brief = results.map((r) => ({ ok: r.ok, platform: r.platform, output: r.output, seconds: r.seconds, log: r.log, ...(r.ok ? {} : { exitCode: r.exitCode, errors: r.errors }) }))
      return exitBy(brief.length === 1 ? brief[0] : { ok: brief.every((r) => r.ok), results: brief })
    }
    case 'runner': {
      const { releaseRunner, defaultPlatform } = require('./release')
      const platforms = String(flags.platform ?? defaultPlatform()).split(',')
      const results = []
      for (const platform of platforms) {
        results.push(await releaseRunner({ platform, unity: flags.unity, out: platforms.length > 1 && flags.out ? path.join(flags.out, platform) : flags.out }))
        if (!results[results.length - 1].ok) break
      }
      const brief = results.map((r) => ({ ok: r.ok, platform: r.platform, output: r.output, seconds: r.seconds, log: r.log, ...(r.ok ? {} : { exitCode: r.exitCode, errors: r.errors }) }))
      return exitBy(brief.length === 1 ? brief[0] : { ok: brief.every((r) => r.ok), results: brief })
    }
    case 'native': {
      const { ensureNative, normalizeNativePlatform, hostPlatform } = require('./native')
      const { findUnity } = require('./release')
      let unity = null
      try { unity = findUnity(flags.unity) } catch {}
      const results = String(flags.platform ?? hostPlatform()).split(',').map((p) => ensureNative(normalizeNativePlatform(p), { unity, force: !!flags.force }))
      return exitBy({ ok: true, results })
    }
    case 'mcp':
      return require('./mcp').runMcp(port)
    case 'status':
      return print(await api.status())
    case 'logs': {
      let since = Number(flags.since ?? 0)
      const show = (logs) => {
        for (const l of logs) {
          console.log(`#${l.sn} [${l.source}] ${l.level}: ${l.text}`)
          since = Math.max(since, l.sn)
        }
      }
      show(await api.logs(since, flags.level, Number(flags.limit ?? 200)))
      if (!flags.follow) return
      for (;;) {
        await new Promise((r) => setTimeout(r, 500))
        show(await api.logs(since, flags.level))
      }
    }
    case 'reload':
      return exitBy(await api.call({ type: 'reload', units: args }))
    case 'eval':
      return exitBy(await api.call({ type: 'eval', code: args.join(' ') }))
    case 'state': {
      const [action = 'keys', key, value] = args
      return exitBy(await api.call({ type: 'state', action, key, value: parseValue(value) }))
    }
    case 'block': {
      const [action, name] = args
      if (action !== 'verify' || !name) return exitBy({ ok: false, error: '用法：pot block verify <积木> [--test tests/x.json] [--steps 600] [--tolerance 1e-9]' })
      const script = flags.test ? await readTestScript(api, flags.test) : null
      return exitBy(await api.call({ type: 'verify', block: name, script, steps: flags.steps, tolerance: flags.tolerance, timeout: 600000 }))
    }
    case 'world': {
      const [action = 'list', p, patch] = args
      const msg = { type: 'world', action, mount: flags.mount, save: !!flags.save }
      if (action === 'set') Object.assign(msg, { path: p, patch: parseValue(patch) })
      if (action === 'clear' && flags.save && !flags.mount) msg.mount = 'game'
      return exitBy(await api.call(msg))
    }
    case 'query':
      return exitBy(await api.call({ type: 'query', what: args[0] ?? 'info', unit: args[1] }))
    case 'plugins':
    case 'leaks':
      return exitBy(await api.call({ type: command }))
    case 'time': {
      const [action = 'get', n] = args
      return exitBy(await api.call({ type: 'time', action, frames: n && +n, value: n && +n }))
    }
    case 'input': {
      const [action, name, a, b, c] = args
      if (action === 'axis') return exitBy(await api.call({ type: 'input', action, name, x: +a, y: +b, frames: c ? +c : 0 }))
      if (action === 'key') return exitBy(await api.call({ type: 'input', action, name, mode: a ?? 'tap' }))
      if (action === 'text') return exitBy(await api.call({ type: 'input', action, text: String(name ?? '').replace(/\\n/g, '\n').replace(/\\b/g, '\b') }))
      return exitBy(await api.call({ type: 'input', action: action ?? 'clear' }))
    }
    case 'screenshot': {
      const out = path.resolve(args[0] ?? 'screenshot.png')
      const res = await api.call({ type: 'screenshot', width: Number(args[1] ?? 640) })
      if (!res.ok) return exitBy(res)
      fs.writeFileSync(out, Buffer.from(res.data.png, 'base64'))
      return print({ ok: true, file: out, width: res.data.width, height: res.data.height })
    }
    case 'help':
    case '--help':
    case '-h': {
      const text = fs.readFileSync(__filename, 'utf8')
      const doc = /\/\*\*([\s\S]*?)\*\//.exec(text)[1].replace(/^ \* ?/gm, '')
      return print(doc.trim())
    }
    default:
      throw new Error(`未知命令：${command}，运行 pot help 查看用法`)
  }
}

main().catch((error) => {
  console.error(error?.message ?? error)
  process.exit(1)
})
