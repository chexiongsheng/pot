/** CLI / MCP 共用的 HTTP 客户端，连接本机 Dev Server */
const http = require('http')

function request(port, method, path, body, timeout = 65000) {
  return new Promise((resolve, reject) => {
    const data = body === undefined ? undefined : Buffer.from(JSON.stringify(body))
    const req = http.request({
      host: '127.0.0.1',
      port,
      method,
      path,
      headers: data ? { 'content-type': 'application/json', 'content-length': data.length } : {},
      timeout,
    }, (res) => {
      let text = ''
      res.setEncoding('utf8')
      res.on('data', (c) => { text += c })
      res.on('end', () => {
        try {
          resolve(JSON.parse(text))
        } catch {
          reject(new Error(`Dev Server 返回非 JSON：${text.slice(0, 200)}`))
        }
      })
    })
    req.on('timeout', () => req.destroy(new Error('请求超时')))
    req.on('error', (e) => {
      if (e.code === 'ECONNREFUSED') reject(new Error(`连不上 Dev Server（端口 ${port}）。先运行：pot dev`))
      else reject(e)
    })
    if (data) req.write(data)
    req.end()
  })
}

function client(port = 7788) {
  return {
    status: () => request(port, 'GET', '/status'),
    logs: (since = 0, level, limit = 200) => request(port, 'GET', `/logs?since=${since}&limit=${limit}${level ? `&level=${level}` : ''}`),
    call: (msg) => request(port, 'POST', '/call', msg),
    open: (target, options = {}) => request(port, 'POST', '/open', { ...options, target }, 130000),
  }
}

module.exports = { client, request }
