/**
 * pot Dev Server：AI（CLI / MCP）与 Runner 之间的通道。它不读、不编译、不推送游戏。
 * - Runner 通过 WebSocket 连接 ws://<host>:<port>/runner（可选；Runner 不连也能自己打开游戏试玩）
 * - CLI / MCP 通过 HTTP：GET /status、GET /logs、POST /call（转发命令）、POST /open（让 Runner 打开游戏）
 * - 静态文件：GET /files/<相对 root 的路径>，目录加 ?list 返回递归清单。手机上的 Runner 据此镜像游戏目录并轮询变化
 */
const fs = require('fs')
const http = require('http')
const path = require('path')
const { WebSocketServer } = require('ws')

/** 由 Runner 的 JS 运行时处理 */
const JS_SIDE = new Set(['reload', 'changed', 'eval', 'state', 'leaks', 'plugins', 'query', 'time', 'world', 'record', 'verify'])
/** 由 Runner 的 C# 侧处理 */
const RUNNER_SIDE = new Set(['open', 'restart', 'home', 'screenshot', 'input'])

const IGNORED = new Set(['.pot', 'node_modules', '.git'])

const MIME = {
  '.json': 'application/json; charset=utf-8',
  '.ts': 'text/plain; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.cjs': 'text/javascript; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.potg': 'application/zip',
}

/** 递归列出目录文件（相对路径、大小、修改时间） */
function listFiles(dir, base = dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (IGNORED.has(entry.name)) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) listFiles(full, base, out)
    else if (entry.isFile()) {
      const stat = fs.statSync(full)
      out.push({ path: path.relative(base, full).replace(/\\/g, '/'), size: stat.size, mtime: Math.floor(stat.mtimeMs) })
    }
  }
  return out
}

function isInside(root, target) {
  const rel = path.relative(root, target)
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))
}

/** 拒绝第二个 Runner / 被接管时的 WebSocket 关闭码；Runner 收到后停止自动重连 */
const BUSY_CODE = 4409
/** 判断旧 Runner 是否存活的 ping 超时 */
const LIVENESS_MS = 1500

/** ping 一次，timeout 内收到 pong 视为存活 */
function isAlive(socket, timeout) {
  return new Promise((resolve) => {
    let done = false
    const finish = (v) => {
      if (done) return
      done = true
      clearTimeout(timer)
      socket.off('pong', onPong)
      socket.off('close', onClose)
      resolve(v)
    }
    const onPong = () => finish(true)
    const onClose = () => finish(false)
    const timer = setTimeout(() => finish(false), timeout)
    socket.on('pong', onPong)
    socket.on('close', onClose)
    try { socket.ping() } catch { finish(false) }
  })
}

/** 从尚未处理的消息里取出 hello 的设备描述 */
function deviceOf(queued) {
  for (const raw of queued) {
    try {
      const msg = JSON.parse(raw.toString())
      if (msg.type === 'hello') return `${msg.platform ?? ''} ${msg.device ?? ''}`.trim()
    } catch {}
  }
  return ''
}

class DevServer {
  constructor(options = {}) {
    this.root = path.resolve(options.root ?? process.cwd())
    this.port = options.port ?? 7788
    this.host = options.host ?? '0.0.0.0'
    this.quiet = !!options.quiet
    this.logs = []
    this.logSn = 0
    this.maxLogs = 1000
    this.runner = null
    this.runnerInfo = null
    this.game = null
    this.pending = new Map()
    this.callId = 0
    this.lastReload = null
  }

  log(level, text, source = 'server') {
    const entry = { sn: ++this.logSn, ts: Date.now(), source, level, text: String(text) }
    this.logs.push(entry)
    if (this.logs.length > this.maxLogs) this.logs.splice(0, this.logs.length - this.maxLogs)
    if (!this.quiet) {
      const tag = source === 'runner' ? 'runner' : 'pot'
      const out = level === 'error' ? console.error : console.log
      out(`[${tag}] ${level === 'info' ? '' : level + ' '}${entry.text}`)
    }
    return entry
  }

  /**
   * pot world set/clear --save：把补丁写进游戏目录的 data/overrides.json（与已有内容深合并），
   * 由 Runner 的文件监听触发热重载。只支持本机目录打开的游戏。
   */
  saveOverrides(msg) {
    const dir = this.game?.kind === 'Directory' ? this.game.dir : null
    if (!dir || !fs.existsSync(path.join(dir, 'manifest.json'))) return { ok: false, error: '--save 只支持本机目录打开的游戏（.potg、网址打开的不能写回）' }
    const file = path.join(dir, 'data', 'overrides.json')
    let all = {}
    if (fs.existsSync(file)) {
      try { all = JSON.parse(fs.readFileSync(file, 'utf8')) } catch (error) { return { ok: false, error: `${file} 不是合法 JSON：${error.message}` } }
    }
    const mount = msg.mount ?? 'game'
    const deep = (a, b) => {
      if (b && typeof b === 'object' && !Array.isArray(b) && a && typeof a === 'object' && !Array.isArray(a)) {
        const out = { ...a }
        for (const k of Object.keys(b)) out[k] = deep(a[k], b[k])
        return out
      }
      return b
    }
    if (msg.action === 'set') {
      if (!msg.path || !msg.patch || typeof msg.patch !== 'object') return { ok: false, error: 'world set 需要 key 路径和补丁对象' }
      all[mount] = all[mount] ?? {}
      all[mount][msg.path] = deep(all[mount][msg.path], msg.patch)
    } else if (msg.action === 'clear') {
      delete all[mount]
    } else return { ok: false, error: `未知 world 操作：${msg.action}` }
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, JSON.stringify(all, null, 2) + '\n', 'utf8')
    return { ok: true, data: { file, overrides: all[mount] ?? {} } }
  }

  /** 向 Runner 发命令并等待结果 */
  call(msg, timeout = 30000) {
    if (msg.type === 'world' && msg.save) return Promise.resolve(this.saveOverrides(msg))
    if (!this.runner || this.runner.readyState !== 1) {
      return Promise.resolve({ ok: false, error: 'Runner 未连接。请启动 Runner，在 F1 面板中把 Dev Server 地址设为 ws://<本机IP>:' + this.port + '/runner' })
    }
    if (!JS_SIDE.has(msg.type) && !RUNNER_SIDE.has(msg.type)) {
      return Promise.resolve({ ok: false, error: `未知命令：${msg.type}` })
    }
    const id = ++this.callId
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        resolve({ ok: false, error: `命令 ${msg.type} 超时（${timeout}ms）` })
      }, timeout)
      this.pending.set(id, { resolve, timer })
      const { timeout: _t, ...payload } = msg
      this.runner.send(JSON.stringify({ ...payload, id }))
    })
  }

  /**
   * 让 Runner 打开游戏。target：本地目录 / .potg 文件（相对 root 或绝对路径），或 http(s) URL。
   * Runner 与本机共享文件系统时直接用 path；否则（手机）用 url 从本服务拉取。
   */
  async open(target, options = {}) {
    if (!target) return { ok: false, error: '缺少要打开的游戏路径或 URL' }
    const msg = { type: 'open', reset: !!options.reset }
    if (/^https?:\/\//i.test(target)) {
      msg.url = target
    } else {
      const abs = path.resolve(this.root, target)
      if (!fs.existsSync(abs)) return { ok: false, error: `找不到 ${abs}` }
      const stat = fs.statSync(abs)
      if (stat.isDirectory() && !fs.existsSync(path.join(abs, 'manifest.json'))) {
        return { ok: false, error: `${abs} 下没有 manifest.json，不是游戏目录` }
      }
      msg.path = abs
      if (isInside(this.root, abs)) {
        const rel = path.relative(this.root, abs).split(path.sep).map(encodeURIComponent).join('/')
        msg.files = `/files/${rel}${stat.isDirectory() && rel ? '/' : ''}`
      }
    }
    const res = await this.call(msg, 120000)
    if (res.ok) this.log('info', `Runner 已打开 ${target}`)
    else this.log('error', `打开 ${target} 失败：${res.error}`)
    return res
  }

  /**
   * 新的 Runner 连接。同一时刻只服务一个 Runner：
   * - 已有 Runner 且还活着（ping 在 LIVENESS_MS 内有 pong）→ 拒绝新连接（关闭码 4409），旧连接不受影响。
   *   新 Runner 收到 4409 后停止自动重连并在面板上提示，避免两个 Runner 互相顶替、反复重连（画面掉到约 4 fps）。
   * - 旧连接已失效（进程被杀、网络断开但 TCP 未关）→ 断开旧的，接受新的。
   * - 连接地址带 ?takeover=1（面板里手动点“连接”）→ 直接接管，旧 Runner 收到 4409 后同样停止重连。
   */
  async _onConnection(socket, req) {
    const queued = []
    const early = (raw) => queued.push(raw)
    socket.on('message', early)
    const takeover = /[?&]takeover=1\b/.test(req?.url ?? '')
    const old = this.runner
    if (old && old !== socket && old.readyState === 1 && !takeover) {
      const alive = await isAlive(old, LIVENESS_MS)
      if (socket.readyState !== 1) return
      if (alive && this.runner === old) {
        this.rejected = { count: (this.rejected?.count ?? 0) + 1, ts: Date.now(), device: deviceOf(queued) }
        const who = this.runnerInfo ? `${this.runnerInfo.platform ?? ''} ${this.runnerInfo.device ?? ''}`.trim() : '已连接的 Runner'
        if (this.rejected.count === 1 || Date.now() - (this._lastRejectLog ?? 0) > 10000) {
          this._lastRejectLog = Date.now()
          this.log('warn', `已拒绝第二个 Runner 连接（${this.rejected.device || '未知设备'}）：${who} 仍在线。同一时刻只服务一个 Runner；要换用新 Runner，先关掉旧的，或在新 Runner 的 F1 面板里点“连接”接管`)
        }
        socket.close(BUSY_CODE, 'runner-busy')
        return
      }
    }
    if (this.runner && this.runner !== socket) {
      const prev = this.runner
      this.log('warn', takeover ? '新的 Runner 请求接管，断开旧连接' : '旧的 Runner 连接已无响应，改用新连接')
      this._dropRunner(prev, '被新的 Runner 接管')
      try { takeover ? prev.close(BUSY_CODE, 'runner-replaced') : prev.terminate() } catch {}
    }
    this.runner = socket
    socket.off('message', early)
    socket.on('message', (raw) => this._onRunnerMessage(raw))
    for (const raw of queued) this._onRunnerMessage(raw)
    socket.on('close', () => {
      if (this.runner !== socket) return
      this._dropRunner(socket, 'Runner 连接已断开')
      this.log('warn', 'Runner 已断开')
    })
  }

  _dropRunner(socket, reason) {
    if (this.runner !== socket) return
    this.runner = null
    this.runnerInfo = null
    this.game = null
    for (const [id, p] of this.pending) {
      clearTimeout(p.timer)
      p.resolve({ ok: false, error: reason })
      this.pending.delete(id)
    }
  }

  _onRunnerMessage(raw) {
    let msg
    try {
      msg = JSON.parse(raw.toString())
    } catch {
      return this.log('warn', `Runner 消息不是 JSON：${String(raw).slice(0, 200)}`)
    }
    switch (msg.type) {
      case 'hello':
        this.runnerInfo = msg
        this.game = msg.game ?? null
        this.log('info', `Runner 已连接：${msg.platform ?? ''} ${msg.device ?? ''}${this.game?.id ? `，正在运行 ${this.game.id}` : ''}`)
        break
      case 'log':
        this.log(msg.level ?? 'info', msg.text, 'runner')
        break
      case 'result': {
        const pending = this.pending.get(msg.id)
        if (!pending) return
        this.pending.delete(msg.id)
        clearTimeout(pending.timer)
        pending.resolve(msg.ok ? { ok: true, data: msg.data } : { ok: false, error: String(msg.error ?? '') })
        break
      }
      case 'event':
        if (msg.name === 'reload') this.lastReload = { ts: Date.now(), ...msg.data }
        else if (msg.name === 'game') this.game = msg.data ?? null
        else this.log('debug', `事件 ${msg.name}：${JSON.stringify(msg.data)}`, 'runner')
        break
      default:
        this.log('warn', `未知 Runner 消息：${msg.type}`)
    }
  }

  status() {
    const info = this.runnerInfo ? { ...this.runnerInfo } : {}
    delete info.type
    delete info.game
    return {
      root: this.root,
      port: this.port,
      runner: this.runner ? { connected: true, ...info } : { connected: false },
      rejected: this.rejected ?? null,
      game: this.game,
      lastReload: this.lastReload,
    }
  }

  /** GET /files/<rel>[?list] */
  _serveFile(url, res) {
    let rel
    try {
      rel = decodeURIComponent(url.pathname.slice('/files/'.length))
    } catch {
      res.writeHead(400).end()
      return
    }
    const target = path.resolve(this.root, rel)
    if (!isInside(this.root, target) || rel.split(/[\\/]/).some((p) => IGNORED.has(p))) {
      res.writeHead(403).end('forbidden')
      return
    }
    if (!fs.existsSync(target)) {
      res.writeHead(404).end('not found')
      return
    }
    const stat = fs.statSync(target)
    if (stat.isDirectory()) {
      const body = JSON.stringify({ files: listFiles(target) })
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
      res.end(body)
      return
    }
    res.writeHead(200, {
      'content-type': MIME[path.extname(target).toLowerCase()] ?? 'application/octet-stream',
      'content-length': stat.size,
      'cache-control': 'no-store',
    })
    fs.createReadStream(target).pipe(res)
  }

  async _http(req, res) {
    const url = new URL(req.url, 'http://localhost')
    const send = (code, body) => {
      res.writeHead(code, { 'content-type': 'application/json; charset=utf-8' })
      res.end(JSON.stringify(body))
    }
    try {
      if (req.method === 'GET' && url.pathname.startsWith('/files/')) return this._serveFile(url, res)
      if (req.method === 'GET' && url.pathname === '/status') return send(200, this.status())
      if (req.method === 'GET' && url.pathname === '/logs') {
        const since = Number(url.searchParams.get('since') ?? 0)
        const level = url.searchParams.get('level')
        const limit = Number(url.searchParams.get('limit') ?? 200)
        let logs = this.logs.filter((l) => l.sn > since)
        if (level) logs = logs.filter((l) => l.level === level)
        return send(200, logs.slice(-limit))
      }
      if (req.method === 'POST') {
        const body = await new Promise((resolve, reject) => {
          let data = ''
          req.on('data', (c) => { data += c })
          req.on('end', () => {
            try { resolve(data ? JSON.parse(data) : {}) } catch (e) { reject(e) }
          })
          req.on('error', reject)
        })
        if (url.pathname === '/call') return send(200, await this.call(body, body.timeout ?? 30000))
        if (url.pathname === '/open') return send(200, await this.open(body.target, body))
      }
      send(404, { ok: false, error: `未知接口 ${req.method} ${url.pathname}` })
    } catch (error) {
      send(200, { ok: false, error: String(error?.message ?? error) })
    }
  }

  async start() {
    this.http = http.createServer((req, res) => this._http(req, res))
    this.wss = new WebSocketServer({ server: this.http, path: '/runner', maxPayload: 64 * 1024 * 1024 })
    this.wss.on('connection', (socket, req) => this._onConnection(socket, req))
    await new Promise((resolve, reject) => {
      this.http.once('error', reject)
      this.http.listen(this.port, this.host, resolve)
    })
    this.port = this.http.address().port
    this.log('info', `Dev Server 已启动：http://127.0.0.1:${this.port}  Runner 地址 ws://<本机IP>:${this.port}/runner  文件根目录 ${this.root}`)
    return this
  }

  async close() {
    for (const client of this.wss?.clients ?? []) client.terminate()
    await new Promise((r) => this.wss ? this.wss.close(() => r()) : r())
    await new Promise((r) => this.http ? this.http.close(() => r()) : r())
  }
}

module.exports = { DevServer, JS_SIDE, RUNNER_SIDE, BUSY_CODE, listFiles }
