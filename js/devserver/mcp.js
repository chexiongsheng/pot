/**
 * pot MCP（stdio，JSON-RPC 2.0，每行一条消息）。
 * 只是 Dev Server HTTP 接口的薄封装，让 AI 编程工具直接操作运行中的游戏。
 */
const readline = require('readline')
const { client } = require('./client')

const PROTOCOL_VERSION = '2024-11-05'

const tools = [
  { name: 'pot_status', description: 'Dev Server 与 Runner 状态：是否连接、单元列表、构建错误、最近一次热重载结果', inputSchema: { type: 'object', properties: {} } },
  { name: 'pot_logs', description: '读取日志（Runner 日志 + Dev Server 日志，报错栈已映射回 TS）。用 since 增量读取', inputSchema: { type: 'object', properties: { since: { type: 'number', description: '只返回 sn 大于此值的日志' }, level: { type: 'string', enum: ['debug', 'info', 'warn', 'error'] }, limit: { type: 'number' } } } },
  { name: 'pot_sync', description: '立即重新构建并把变化推送到 Runner（一般不需要，文件保存后会自动同步）。返回热重载结果', inputSchema: { type: 'object', properties: {} } },
  { name: 'pot_load', description: '全量重新加载游戏（冷启动）。resetState=true 时清空 state', inputSchema: { type: 'object', properties: { resetState: { type: 'boolean' } } } },
  { name: 'pot_eval', description: '在 Runner 的 JS 运行时中执行代码。可用变量：runtime、ctx（根上下文）、pot。表达式直接返回值；多语句请用 return', inputSchema: { type: 'object', properties: { code: { type: 'string' } }, required: ['code'] } },
  { name: 'pot_state', description: '读写 state。action: keys | get | set | reset', inputSchema: { type: 'object', properties: { action: { type: 'string', enum: ['keys', 'get', 'set', 'reset'] }, key: { type: 'string' }, value: {} } } },
  { name: 'pot_query', description: '查询运行时。what: info（总体）| objects（场景对象，可按 unit 过滤）| data（数据文件依赖）| cache', inputSchema: { type: 'object', properties: { what: { type: 'string', enum: ['info', 'objects', 'data', 'cache'] }, unit: { type: 'string' } } } },
  { name: 'pot_plugins', description: '已加载单元及其挂载点', inputSchema: { type: 'object', properties: {} } },
  { name: 'pot_leaks', description: '泄漏检查：最近一次热重载未回收的旧版本、对象数、定时器数', inputSchema: { type: 'object', properties: {} } },
  { name: 'pot_time', description: '控制游戏时间。action: get | pause | resume | step（frames）| scale（value）', inputSchema: { type: 'object', properties: { action: { type: 'string', enum: ['get', 'pause', 'resume', 'step', 'scale'] }, frames: { type: 'number' }, value: { type: 'number' } } } },
  { name: 'pot_input', description: '注入虚拟输入。action: axis（name,x,y,frames 可选）| key（name, mode: down/up/tap）| clear', inputSchema: { type: 'object', properties: { action: { type: 'string', enum: ['axis', 'key', 'clear'] }, name: { type: 'string' }, x: { type: 'number' }, y: { type: 'number' }, frames: { type: 'number' }, mode: { type: 'string', enum: ['down', 'up', 'tap'] } }, required: ['action'] } },
  { name: 'pot_screenshot', description: '截取 Runner 当前画面（PNG）', inputSchema: { type: 'object', properties: { width: { type: 'number', description: '缩放到的宽度，默认 640' } } } },
]

async function callTool(api, name, args = {}) {
  switch (name) {
    case 'pot_status': return api.status()
    case 'pot_logs': return api.logs(args.since ?? 0, args.level, args.limit ?? 200)
    case 'pot_sync': return api.sync()
    case 'pot_load': return api.load({ resetState: !!args.resetState })
    case 'pot_eval': return api.call({ type: 'eval', code: args.code })
    case 'pot_state': return api.call({ type: 'state', ...args })
    case 'pot_query': return api.call({ type: 'query', ...args })
    case 'pot_plugins': return api.call({ type: 'plugins' })
    case 'pot_leaks': return api.call({ type: 'leaks' })
    case 'pot_time': return api.call({ type: 'time', ...args })
    case 'pot_input': return api.call({ type: 'input', ...args })
    case 'pot_screenshot': return api.call({ type: 'screenshot', width: args.width ?? 640 })
    default: throw new Error(`未知工具：${name}`)
  }
}

function toContent(name, result) {
  if (name === 'pot_screenshot' && result?.ok && result.data?.png) {
    return [{ type: 'image', data: result.data.png, mimeType: 'image/png' }, { type: 'text', text: `${result.data.width}x${result.data.height}` }]
  }
  return [{ type: 'text', text: JSON.stringify(result, null, 2) }]
}

function runMcp(port = 7788) {
  const api = client(port)
  const write = (msg) => process.stdout.write(JSON.stringify(msg) + '\n')
  const rl = readline.createInterface({ input: process.stdin })
  rl.on('line', async (line) => {
    if (!line.trim()) return
    let msg
    try {
      msg = JSON.parse(line)
    } catch {
      return write({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } })
    }
    const { id, method, params } = msg
    if (id === undefined) return // 通知
    try {
      let result
      switch (method) {
        case 'initialize':
          result = { protocolVersion: params?.protocolVersion ?? PROTOCOL_VERSION, capabilities: { tools: {} }, serverInfo: { name: 'pot', version: '0.1.0' } }
          break
        case 'ping':
          result = {}
          break
        case 'tools/list':
          result = { tools }
          break
        case 'tools/call': {
          try {
            const value = await callTool(api, params.name, params.arguments)
            result = { content: toContent(params.name, value), isError: value?.ok === false }
          } catch (error) {
            result = { content: [{ type: 'text', text: String(error?.message ?? error) }], isError: true }
          }
          break
        }
        default:
          return write({ jsonrpc: '2.0', id, error: { code: -32601, message: `Method not found: ${method}` } })
      }
      write({ jsonrpc: '2.0', id, result })
    } catch (error) {
      write({ jsonrpc: '2.0', id, error: { code: -32603, message: String(error?.message ?? error) } })
    }
  })
}

module.exports = { runMcp, tools, callTool }
