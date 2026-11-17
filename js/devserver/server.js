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
const JS_SIDE = new Set(['reload', 'changed', 'eval', 'state', 'leaks', 'plugins', 'query', 'time'])
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

  /** 向 Runner 发命令并等待结果 */
  call(msg, timeout = 30000) {
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
    this.wss.on('connection', (socket) => {
      if (this.runner && this.runner !== socket) {
        this.log('warn', '新的 Runner 连接，替换旧连接')
        try { this.runner.close() } catch {}
      }
      this.runner = socket
      socket.on('message', (raw) => this._onRunnerMessage(raw))
      socket.on('close', () => {
        if (this.runner !== socket) return
        this.runner = null
        this.runnerInfo = null
        this.game = null
        for (const [id, p] of this.pending) {
          clearTimeout(p.timer)
          p.resolve({ ok: false, error: 'Runner 连接已断开' })
          this.pending.delete(id)
        }
        this.log('warn', 'Runner 已断开')
      })
    })
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

module.exports = { DevServer, JS_SIDE, RUNNER_SIDE, listFiles }
