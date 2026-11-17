/**
 * pot Dev Server：
 * - 构建游戏（esbuild），监听文件变化，按单元 hash 差异向 Runner 推送热重载
 * - Runner 通过 WebSocket 连接 ws://<host>:<port>/runner
 * - CLI / MCP 通过 HTTP 调用：GET /status、GET /logs、POST /call、POST /sync、POST /load
 * - 报错栈经 sourcemap 映射回 TS 源文件
 */
const fs = require('fs')
const http = require('http')
const path = require('path')
const { WebSocketServer } = require('ws')
const { buildGame } = require('./builder')
const { SourceMapIndex } = require('./sourcemap')

const JS_SIDE = new Set(['reload', 'eval', 'state', 'leaks', 'plugins', 'query', 'time'])
const RUNNER_SIDE = new Set(['load', 'cold', 'screenshot', 'input'])

class DevServer {
  constructor(options) {
    this.gameDir = path.resolve(options.gameDir)
    this.port = options.port ?? 7788
    this.host = options.host ?? '0.0.0.0'
    this.quiet = !!options.quiet
    this.files = new Map()
    this.maps = new SourceMapIndex()
    this.buildErrors = []
    this.logs = []
    this.logSn = 0
    this.maxLogs = 1000
    this.runner = null
    this.runnerInfo = null
    this.pending = new Map()
    this.callId = 0
    this.lastReload = null
    this.lastLoad = null
    this._syncing = Promise.resolve()
    this._timer = null
  }

  log(level, text, source = 'server') {
    const entry = { sn: ++this.logSn, ts: Date.now(), source, level, text: this.maps.mapText(String(text), this.gameDir) }
    this.logs.push(entry)
    if (this.logs.length > this.maxLogs) this.logs.splice(0, this.logs.length - this.maxLogs)
    if (!this.quiet) {
      const tag = source === 'runner' ? 'runner' : 'pot'
      const out = level === 'error' ? console.error : console.log
      out(`[${tag}] ${level === 'info' ? '' : level + ' '}${entry.text}`)
    }
    return entry
  }

  async build() {
    const result = await buildGame(this.gameDir)
    this.buildErrors = result.errors
    if (result.errors.length) {
      for (const e of result.errors) this.log('error', `构建失败：${e}`)
      return null
    }
    this.maps.clear()
    for (const [file, map] of result.maps) this.maps.set(file, map)
    return result
  }

  filesArray(files = this.files) {
    return [...files].map(([p, content]) => ({ path: p, content }))
  }

  /** 重新构建并推送差异；串行执行 */
  sync(reason = 'change') {
    this._syncing = this._syncing.then(() => this._sync(reason)).catch((e) => this.log('error', e.stack ?? e))
    return this._syncing
  }

  async _sync(reason) {
    const result = await this.build()
    if (!result) return { ok: false, errors: this.buildErrors }
    const changed = []
    for (const [p, content] of result.files) {
      if (this.files.get(p) !== content) changed.push({ path: p, content })
    }
    for (const p of this.files.keys()) {
      if (!result.files.has(p)) changed.push({ path: p, content: null })
    }
    const first = this.files.size === 0
    this.files = result.files
    if (first || !changed.length || !this.runner) {
      return { ok: true, changed: changed.map((c) => c.path), pushed: false }
    }
    if (changed.some((c) => c.path === 'manifest.json')) {
      this.log('info', 'manifest.json 变化，冷重启')
      const res = await this.load().catch((e) => ({ ok: false, error: String(e.message ?? e) }))
      return { ok: res.ok, changed: changed.map((c) => c.path), mode: 'cold', result: res }
    }
    const res = await this.call({ type: 'reload', files: changed }).catch((e) => ({ ok: false, error: String(e.message ?? e) }))
    const data = res.data ?? {}
    this.lastReload = { ts: Date.now(), reason, files: changed.map((c) => c.path), ...res }
    if (res.ok && data.ok) {
      const leaks = data.leaks?.length ? `，疑似泄漏 ${data.leaks.length} 项：${data.leaks.join(', ')}` : ''
      if (data.units.length) this.log(leaks ? 'warn' : 'info', `热重载 ${data.units.join(', ')} 完成（${data.durationMs}ms）${leaks}`)
      else this.log('info', `已同步 ${changed.map((c) => c.path).join(', ')}（无需重载单元）`)
    } else {
      const error = res.error ?? data.error
      this.log('error', `热重载失败（阶段 ${data.phase ?? '?'}${data.rolledBack ? '，已回滚' : ''}）：${error}`)
    }
    return this.lastReload
  }

  /** 全量下发文件并让 Runner 冷启动（state 由 Runner 保留） */
  async load(options = {}) {
    if (!this.files.size) await this.sync('load')
    const res = await this.call({ type: 'load', files: this.filesArray(), resetState: !!options.resetState }, 60000)
    this.lastLoad = { ts: Date.now(), ...res }
    if (res.ok) this.log('info', `游戏已加载（${this.files.size} 个文件）`)
    else this.log('error', `加载失败：${res.error}`)
    return res
  }

  /** 向 Runner 发命令并等待结果 */
  call(msg, timeout = 30000) {
    if (!this.runner || this.runner.readyState !== 1) {
      return Promise.reject(new Error('Runner 未连接。请启动 Runner 并连接到本 Dev Server'))
    }
    if (!JS_SIDE.has(msg.type) && !RUNNER_SIDE.has(msg.type)) {
      return Promise.reject(new Error(`未知命令：${msg.type}`))
    }
    const id = ++this.callId
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        resolve({ ok: false, error: `命令 ${msg.type} 超时（${timeout}ms）` })
      }, timeout)
      this.pending.set(id, { resolve, timer })
      this.runner.send(JSON.stringify({ ...msg, id }))
    })
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
        this.log('info', `Runner 已连接：${msg.platform ?? ''} ${msg.unity ?? ''}`)
        this._syncing.then(() => this.load()).catch((e) => this.log('error', e.stack ?? e))
        break
      case 'log':
        this.log(msg.level ?? 'info', msg.text, 'runner')
        break
      case 'result': {
        const pending = this.pending.get(msg.id)
        if (!pending) return
        this.pending.delete(msg.id)
        clearTimeout(pending.timer)
        pending.resolve(this._mapResult(msg))
        break
      }
      case 'event':
        this.log('debug', `事件 ${msg.name}：${JSON.stringify(msg.data)}`, 'runner')
        break
      default:
        this.log('warn', `未知 Runner 消息：${msg.type}`)
    }
  }

  _mapResult(msg) {
    const mapped = { ok: !!msg.ok }
    if (msg.ok) mapped.data = msg.data
    else mapped.error = this.maps.mapText(String(msg.error ?? ''), this.gameDir)
    if (mapped.data && typeof mapped.data === 'object' && typeof mapped.data.error === 'string') {
      mapped.data.error = this.maps.mapText(mapped.data.error, this.gameDir)
    }
    return mapped
  }

  status() {
    return {
      game: this.gameDir,
      port: this.port,
      runner: this.runner ? { connected: true, ...this.runnerInfo, type: undefined } : { connected: false },
      files: this.files.size,
      units: [...this.files.keys()].filter((p) => p.startsWith('units/')).map((p) => p.slice(6, -4)),
      buildErrors: this.buildErrors,
      lastReload: this.lastReload,
      lastLoad: this.lastLoad && { ts: this.lastLoad.ts, ok: this.lastLoad.ok, error: this.lastLoad.error },
    }
  }

  _watch() {
    const ignore = /(^|[\\/])(\.pot|node_modules|\.git)([\\/]|$)/
    this.watcher = fs.watch(this.gameDir, { recursive: true }, (_event, file) => {
      if (!file || ignore.test(file)) return
      clearTimeout(this._timer)
      this._timer = setTimeout(() => this.sync('watch'), 80)
    })
  }

  async _http(req, res) {
    const url = new URL(req.url, 'http://localhost')
    const send = (code, body) => {
      res.writeHead(code, { 'content-type': 'application/json; charset=utf-8' })
      res.end(JSON.stringify(body))
    }
    try {
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
          req.on('end', () => resolve(data ? JSON.parse(data) : {}))
          req.on('error', reject)
        })
        if (url.pathname === '/call') return send(200, await this.call(body, body.timeout ?? 30000))
        if (url.pathname === '/sync') return send(200, await this.sync('manual'))
        if (url.pathname === '/load') return send(200, await this.load(body))
      }
      send(404, { ok: false, error: `未知接口 ${req.method} ${url.pathname}` })
    } catch (error) {
      send(200, { ok: false, error: String(error?.message ?? error) })
    }
  }

  async start() {
    await this.sync('start')
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
    this._watch()
    this.log('info', `Dev Server 已启动：http://127.0.0.1:${this.port}  Runner 地址 ws://<本机IP>:${this.port}/runner  游戏 ${this.gameDir}`)
    return this
  }

  async close() {
    this.watcher?.close()
    clearTimeout(this._timer)
    for (const client of this.wss?.clients ?? []) client.terminate()
    await new Promise((r) => this.wss ? this.wss.close(() => r()) : r())
    await new Promise((r) => this.http ? this.http.close(() => r()) : r())
  }
}

module.exports = { DevServer, JS_SIDE, RUNNER_SIDE }
