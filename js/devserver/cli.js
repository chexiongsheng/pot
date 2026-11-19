#!/usr/bin/env node
/**
 * pot 命令行：
 *   pot dev [--port 7788] [--root 目录]      启动 Dev Server（AI ↔ Runner 通道；/files/ 提供 root 下的文件给手机 Runner）
 *   pot open <游戏目录|.potg|URL> [--reset]   让已连接的 Runner 打开游戏（--reset 清空存档）
 *   pot restart [--reset]                   冷重启当前游戏（默认保留 state）
 *   pot check <游戏目录>                     类型检查 + 试打包，Runner 运行前发现错误
 *   pot build <游戏目录> <输出目录>           发布构建（manifest.json + bundle.cjs + data/）
 *   pot pack <游戏目录> [输出.potg]           打包为 .potg，Runner 可直接打开
 *   pot release <游戏目录> [--platform win64|android|webgl[,…]] [--unity Unity.exe] [--out 目录]
 *                                           出包：TS 编译 → 暂存 → Unity -batchmode 打包（通用工程 player/），不用打开编辑器
 *   pot stage <游戏目录> <暂存目录>           只暂存（game/ + release.json + 图标），供 Unity 菜单 pot/Build Game 使用
 *   pot mcp [--port 7788]                   以 stdio MCP 方式暴露调试工具
 *   pot status | logs [--follow] [--level error]
 *   pot eval <代码> | state [keys|get|set|reset] [key] [json] | query [info|objects|data|cache|modules] [unit]
 *   pot plugins | leaks | reload <单元...> | time [get|pause|resume|step|scale] [n]
 *   pot input axis <name> <x> <y> [frames] | input key <name> [down|up|tap] | input clear
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
