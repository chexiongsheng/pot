#!/usr/bin/env node
/**
 * pot 命令行：
 *   pot dev [游戏目录] [--port 7788]       启动 Dev Server（构建 + 监听 + 等待 Runner 连接）
 *   pot build <游戏目录> <输出目录>         发布构建（manifest.json + bundle.cjs + data/）
 *   pot mcp [--port 7788]                  以 stdio MCP 方式暴露调试工具
 *   pot status | logs [--follow] [--level error] | sync | load [--reset]
 *   pot eval <代码> | state [keys|get|set|reset] [key] [json] | query [info|objects|data|cache] [unit]
 *   pot plugins | leaks | time [get|pause|resume|step|scale] [n]
 *   pot input axis <name> <x> <y> [frames] | input key <name> [down|up|tap] | input clear
 *   pot screenshot [输出文件.png] [宽度]
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
      const gameDir = path.resolve(args[0] ?? '.')
      const server = new DevServer({ gameDir, port, quiet: !!flags.quiet })
      await server.start()
      const stop = () => server.close().finally(() => process.exit(0))
      process.on('SIGINT', stop)
      process.on('SIGTERM', stop)
      return
    }
    case 'build': {
      const { buildRelease } = require('./builder')
      if (args.length < 2) throw new Error('用法：pot build <游戏目录> <输出目录>')
      return print(await buildRelease(path.resolve(args[0]), path.resolve(args[1])))
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
    case 'sync':
      return print(await api.sync())
    case 'load':
      return exitBy(await api.load({ resetState: !!flags.reset }))
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
