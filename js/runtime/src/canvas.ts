/**
 * Canvas 2D：与浏览器 CanvasRenderingContext2D 同名同语义的软件光栅器，用来移植"用 Canvas 画贴图"的代码
 * （喷字贴花、标签、弹孔图集、地面标线）。结果用 canvas.texture() 转成贴图。
 *
 *   const c = ctx.scene.canvas(256, 256)
 *   const g = c.getContext('2d')
 *   g.fillStyle = '#c33'; g.fillRect(0, 0, 256, 256)
 *   g.font = 'bold 48px sans-serif'; g.textAlign = 'center'; g.fillText('危险', 128, 140)
 *   entity.material({ map: c.texture() })
 *
 * - 像素为预乘 Float32（sRGB 编码值，与浏览器一致），抗锯齿按像素覆盖面积精确计算（非零环绕）
 * - 支持：路径（直线、二次/三次贝塞尔、arc、ellipse、rect、roundRect）、fill/stroke（线宽、端点、连接、虚线）、
 *   clip、变换与 save/restore、globalAlpha、合成模式、线性/径向渐变、drawImage、像素读写、fillText/measureText
 * - 文字由宿主用系统字体栅格化（family 按 CSS 列表依次回退，sans-serif/serif/monospace 映射到系统字体）
 * - 不支持：pattern、shadow、filter、strokeText
 */
import type { Host } from './host'

export interface ImageDataLike {
  width: number
  height: number
  /** RGBA8，非预乘，行从上到下 */
  data: Uint8ClampedArray | Uint8Array
}

export interface CanvasImageData {
  width: number
  height: number
  data: Uint8ClampedArray
}

export interface TextMetrics {
  width: number
  actualBoundingBoxLeft: number
  actualBoundingBoxRight: number
  actualBoundingBoxAscent: number
  actualBoundingBoxDescent: number
  fontBoundingBoxAscent: number
  fontBoundingBoxDescent: number
}

type Mat = [number, number, number, number, number, number]
type RGBA = [number, number, number, number]
type Poly = number[]

const TAU = Math.PI * 2

const NAMED: Record<string, string> = {
  black: '#000000', white: '#ffffff', red: '#ff0000', green: '#008000', lime: '#00ff00', blue: '#0000ff',
  yellow: '#ffff00', orange: '#ffa500', gray: '#808080', grey: '#808080', silver: '#c0c0c0', cyan: '#00ffff',
  magenta: '#ff00ff', purple: '#800080', navy: '#000080', maroon: '#800000', transparent: '#00000000',
}

function hue(p: number, q: number, t: number) {
  if (t < 0) t += 1
  if (t > 1) t -= 1
  if (t < 1 / 6) return p + (q - p) * 6 * t
  if (t < 1 / 2) return q
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
  return p
}

/** 解析 CSS 颜色（#hex、rgb()/rgba()、hsl()/hsla()、常用颜色名），返回非预乘 0 到 1；无法解析返回 null */
export function parseCssColor(input: string): RGBA | null {
  let s = String(input).trim().toLowerCase()
  if (NAMED[s]) s = NAMED[s]
  if (s[0] === '#') {
    const h = s.slice(1)
    if (!/^[0-9a-f]+$/.test(h)) return null
    const x = h.length === 3 || h.length === 4 ? h.split('').map((c) => c + c).join('') : h
    if (x.length !== 6 && x.length !== 8) return null
    const v = (i: number) => parseInt(x.slice(i, i + 2), 16) / 255
    return [v(0), v(2), v(4), x.length === 8 ? v(6) : 1]
  }
  const m = /^(rgba?|hsla?)\(([^)]*)\)$/.exec(s)
  if (!m) return null
  const parts = m[2].split(/[\s,/]+/).filter(Boolean)
  if (parts.length < 3) return null
  const num = (t: string, scale: number) => (t.endsWith('%') ? parseFloat(t) / 100 : parseFloat(t) / scale)
  const a = parts.length > 3 ? Math.min(1, Math.max(0, num(parts[3], 1))) : 1
  if (m[1].startsWith('rgb')) {
    const c = parts.slice(0, 3).map((t) => Math.min(1, Math.max(0, num(t, 255))))
    if (c.some(Number.isNaN) || Number.isNaN(a)) return null
    return [c[0], c[1], c[2], a]
  }
  const hh = (((parseFloat(parts[0]) / 360) % 1) + 1) % 1
  const ss = Math.min(1, Math.max(0, parseFloat(parts[1]) / 100))
  const ll = Math.min(1, Math.max(0, parseFloat(parts[2]) / 100))
  if ([hh, ss, ll, a].some(Number.isNaN)) return null
  if (ss === 0) return [ll, ll, ll, a]
  const q = ll < 0.5 ? ll * (1 + ss) : ll + ss - ll * ss
  const p = 2 * ll - q
  return [hue(p, q, hh + 1 / 3), hue(p, q, hh), hue(p, q, hh - 1 / 3), a]
}

/** 渐变（ctx.createLinearGradient / createRadialGradient 返回） */
export class CanvasGradient {
  /** @internal */ stops: { t: number; c: RGBA }[] = []
  private _lut?: Float32Array
  constructor(readonly kind: 'linear' | 'radial', readonly args: number[]) {}

  addColorStop(offset: number, color: string) {
    const c = parseCssColor(color)
    if (!c) throw new Error(`addColorStop：无法解析颜色 ${color}`)
    if (!(offset >= 0 && offset <= 1)) throw new Error(`addColorStop：offset ${offset} 超出 0 到 1`)
    this.stops.push({ t: offset, c })
    this.stops.sort((a, b) => a.t - b.t)
    this._lut = undefined
  }

  /** @internal 1024 项预乘 LUT */
  lut() {
    if (this._lut) return this._lut
    const n = 1024
    const lut = new Float32Array(n * 4)
    const st = this.stops
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1)
      let c: RGBA
      if (!st.length) c = [0, 0, 0, 0]
      else if (t <= st[0].t) c = st[0].c
      else if (t >= st[st.length - 1].t) c = st[st.length - 1].c
      else {
        let k = 1
        while (st[k].t < t) k++
        const a = st[k - 1], b = st[k]
        const f = b.t > a.t ? (t - a.t) / (b.t - a.t) : 1
        c = [0, 1, 2, 3].map((j) => a.c[j] + (b.c[j] - a.c[j]) * f) as RGBA
      }
      lut[i * 4] = c[0] * c[3]
      lut[i * 4 + 1] = c[1] * c[3]
      lut[i * 4 + 2] = c[2] * c[3]
      lut[i * 4 + 3] = c[3]
    }
    return (this._lut = lut)
  }
}

type Paint = { color: RGBA } | { gradient: CanvasGradient }

interface FontSpec {
  css: string
  size: number
  bold: boolean
  italic: boolean
  family: string
}

/** 解析 CSS font 简写："italic 900 24px/1.2 \"PingFang SC\", sans-serif" */
export function parseFont(css: string): FontSpec | null {
  const m = /^\s*((?:(?:italic|oblique|normal|small-caps|bold|bolder|lighter|\d{3}|condensed|expanded)\s+)*)(\d*\.?\d+)(px|pt|em|rem)?(?:\s*\/\s*\S+)?\s+(.+?)\s*$/i.exec(css)
  if (!m) return null
  const pre = m[1].toLowerCase().split(/\s+/).filter(Boolean)
  let size = parseFloat(m[2])
  const unit = (m[3] || 'px').toLowerCase()
  if (unit === 'pt') size *= 4 / 3
  else if (unit === 'em' || unit === 'rem') size *= 16
  let bold = false, italic = false
  for (const t of pre) {
    if (t === 'bold' || t === 'bolder' || (/^\d{3}$/.test(t) && +t >= 600)) bold = true
    if (t === 'italic' || t === 'oblique') italic = true
  }
  return { css, size, bold, italic, family: m[4] }
}

function mul(a: Mat, b: Mat): Mat {
  return [
    a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5],
  ]
}

function invert(m: Mat): Mat {
  const det = m[0] * m[3] - m[1] * m[2]
  if (!det) return [0, 0, 0, 0, 0, 0]
  const i = 1 / det
  return [m[3] * i, -m[1] * i, -m[2] * i, m[0] * i, (m[2] * m[5] - m[3] * m[4]) * i, (m[1] * m[4] - m[0] * m[5]) * i]
}

function polyArea(p: Poly) {
  let a = 0
  for (let i = 0, n = p.length; i < n; i += 2) {
    const j = (i + 2) % n
    a += p[i] * p[j + 1] - p[j] * p[i + 1]
  }
  return a
}

function orient(p: Poly) {
  if (polyArea(p) >= 0) return p
  const r: Poly = []
  for (let i = p.length - 2; i >= 0; i -= 2) r.push(p[i], p[i + 1])
  return r
}

interface State {
  m: Mat
  fill: Paint
  stroke: Paint
  fillText: string | CanvasGradient
  strokeText: string | CanvasGradient
  lineWidth: number
  lineCap: 'butt' | 'round' | 'square'
  lineJoin: 'miter' | 'round' | 'bevel'
  miterLimit: number
  dash: number[]
  dashOffset: number
  alpha: number
  op: string
  font: FontSpec
  textAlign: 'start' | 'end' | 'left' | 'right' | 'center'
  textBaseline: 'alphabetic' | 'top' | 'hanging' | 'middle' | 'ideographic' | 'bottom'
  clip: Float32Array | null
}

const OPS = new Set(['source-over', 'destination-over', 'destination-out', 'destination-in', 'source-atop', 'lighter', 'copy', 'multiply', 'screen'])

interface Glyphs {
  w: number
  h: number
  ox: number
  base: number
  adv: number
  ascent: number
  descent: number
  alpha: Uint8Array
}

/** Canvas 的 2D 上下文（API 与浏览器相同） */
export class CanvasRenderingContext2D {
  private _s: State
  private _stack: State[] = []
  private _subs: { pts: number[]; closed: boolean }[] = []
  private _cur: { pts: number[]; closed: boolean } | null = null
  imageSmoothingEnabled = true
  imageSmoothingQuality = 'low'
  filter = 'none'
  shadowBlur = 0
  shadowColor = 'rgba(0, 0, 0, 0)'
  shadowOffsetX = 0
  shadowOffsetY = 0
  letterSpacing = '0px'

  constructor(readonly canvas: Canvas) {
    this._s = {
      m: [1, 0, 0, 1, 0, 0],
      fill: { color: [0, 0, 0, 1] },
      stroke: { color: [0, 0, 0, 1] },
      fillText: '#000000',
      strokeText: '#000000',
      lineWidth: 1,
      lineCap: 'butt',
      lineJoin: 'miter',
      miterLimit: 10,
      dash: [],
      dashOffset: 0,
      alpha: 1,
      op: 'source-over',
      font: parseFont('10px sans-serif')!,
      textAlign: 'start',
      textBaseline: 'alphabetic',
      clip: null,
    }
  }

  // ---------------- 状态 ----------------

  save() {
    this._stack.push({ ...this._s, dash: this._s.dash.slice() })
  }
  restore() {
    const s = this._stack.pop()
    if (s) this._s = s
  }
  reset() {
    this._stack = []
    this._subs = []
    this._cur = null
    this._s = new CanvasRenderingContext2D(this.canvas)._s
    this.canvas.data.fill(0)
  }

  get fillStyle(): string | CanvasGradient { return this._s.fillText }
  set fillStyle(v: string | CanvasGradient) { this._setPaint('fill', v) }
  get strokeStyle(): string | CanvasGradient { return this._s.strokeText }
  set strokeStyle(v: string | CanvasGradient) { this._setPaint('stroke', v) }
  private _setPaint(which: 'fill' | 'stroke', v: string | CanvasGradient) {
    if (v instanceof CanvasGradient) {
      this._s[which] = { gradient: v }
      this._s[which === 'fill' ? 'fillText' : 'strokeText'] = v
      return
    }
    const c = parseCssColor(v)
    if (!c) return
    this._s[which] = { color: c }
    this._s[which === 'fill' ? 'fillText' : 'strokeText'] = String(v)
  }

  get lineWidth() { return this._s.lineWidth }
  set lineWidth(v: number) { if (v > 0 && Number.isFinite(v)) this._s.lineWidth = v }
  get lineCap() { return this._s.lineCap }
  set lineCap(v) { if (v === 'butt' || v === 'round' || v === 'square') this._s.lineCap = v }
  get lineJoin() { return this._s.lineJoin }
  set lineJoin(v) { if (v === 'miter' || v === 'round' || v === 'bevel') this._s.lineJoin = v }
  get miterLimit() { return this._s.miterLimit }
  set miterLimit(v: number) { if (v > 0 && Number.isFinite(v)) this._s.miterLimit = v }
  get lineDashOffset() { return this._s.dashOffset }
  set lineDashOffset(v: number) { if (Number.isFinite(v)) this._s.dashOffset = v }
  setLineDash(d: number[]) {
    if (d.some((x) => !(x >= 0) || !Number.isFinite(x))) return
    this._s.dash = d.length % 2 ? d.concat(d) : d.slice()
  }
  getLineDash() { return this._s.dash.slice() }
  get globalAlpha() { return this._s.alpha }
  set globalAlpha(v: number) { if (v >= 0 && v <= 1) this._s.alpha = v }
  get globalCompositeOperation() { return this._s.op }
  set globalCompositeOperation(v: string) { if (OPS.has(v)) this._s.op = v }
  get font() { return this._s.font.css }
  set font(v: string) { const f = parseFont(v); if (f) this._s.font = f }
  get textAlign() { return this._s.textAlign }
  set textAlign(v) { this._s.textAlign = v }
  get textBaseline() { return this._s.textBaseline }
  set textBaseline(v) { this._s.textBaseline = v }

  // ---------------- 变换 ----------------

  setTransform(a: number | { a: number; b: number; c: number; d: number; e: number; f: number }, b?: number, c?: number, d?: number, e?: number, f?: number) {
    if (typeof a === 'object') this._s.m = [a.a, a.b, a.c, a.d, a.e, a.f]
    else this._s.m = [a, b!, c!, d!, e!, f!]
  }
  getTransform() {
    const [a, b, c, d, e, f] = this._s.m
    return { a, b, c, d, e, f }
  }
  resetTransform() { this._s.m = [1, 0, 0, 1, 0, 0] }
  transform(a: number, b: number, c: number, d: number, e: number, f: number) { this._s.m = mul(this._s.m, [a, b, c, d, e, f]) }
  translate(x: number, y: number) { this._s.m = mul(this._s.m, [1, 0, 0, 1, x, y]) }
  scale(x: number, y: number) { this._s.m = mul(this._s.m, [x, 0, 0, y, 0, 0]) }
  rotate(r: number) {
    const c = Math.cos(r), s = Math.sin(r)
    this._s.m = mul(this._s.m, [c, s, -s, c, 0, 0])
  }

  // ---------------- 路径（存设备坐标） ----------------

  private _tx(x: number, y: number): [number, number] {
    const m = this._s.m
    return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]
  }
  private _scale() {
    const m = this._s.m
    return Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2])) || 1
  }
  private _last(): [number, number] | null {
    const c = this._cur
    if (!c || !c.pts.length) return null
    return [c.pts[c.pts.length - 2], c.pts[c.pts.length - 1]]
  }
  private _addDev(x: number, y: number) {
    if (!this._cur) {
      this._cur = { pts: [x, y], closed: false }
      this._subs.push(this._cur)
    } else this._cur.pts.push(x, y)
  }

  beginPath() {
    this._subs = []
    this._cur = null
  }
  moveTo(x: number, y: number) {
    const [dx, dy] = this._tx(x, y)
    this._cur = { pts: [dx, dy], closed: false }
    this._subs.push(this._cur)
  }
  lineTo(x: number, y: number) {
    const [dx, dy] = this._tx(x, y)
    this._addDev(dx, dy)
  }
  closePath() {
    const c = this._cur
    if (!c || !c.pts.length) return
    c.closed = true
    this._cur = { pts: [c.pts[0], c.pts[1]], closed: false }
    this._subs.push(this._cur)
  }
  quadraticCurveTo(cx: number, cy: number, x: number, y: number) {
    let p0 = this._last()
    if (!p0) { this.moveTo(cx, cy); p0 = this._last()! }
    const p1 = this._tx(cx, cy), p2 = this._tx(x, y)
    const d = Math.hypot(p0[0] - 2 * p1[0] + p2[0], p0[1] - 2 * p1[1] + p2[1])
    const n = Math.min(256, Math.max(1, Math.ceil(Math.sqrt(d * 2))))
    for (let i = 1; i <= n; i++) {
      const t = i / n, u = 1 - t
      this._addDev(u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0], u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1])
    }
  }
  bezierCurveTo(c1x: number, c1y: number, c2x: number, c2y: number, x: number, y: number) {
    let p0 = this._last()
    if (!p0) { this.moveTo(c1x, c1y); p0 = this._last()! }
    const p1 = this._tx(c1x, c1y), p2 = this._tx(c2x, c2y), p3 = this._tx(x, y)
    const d = Math.max(
      Math.hypot(p0[0] - 2 * p1[0] + p2[0], p0[1] - 2 * p1[1] + p2[1]),
      Math.hypot(p1[0] - 2 * p2[0] + p3[0], p1[1] - 2 * p2[1] + p3[1]),
    )
    const n = Math.min(256, Math.max(1, Math.ceil(Math.sqrt(d * 3))))
    for (let i = 1; i <= n; i++) {
      const t = i / n, u = 1 - t
      const a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, e = t * t * t
      this._addDev(a * p0[0] + b * p1[0] + c * p2[0] + e * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + e * p3[1])
    }
  }
  arc(x: number, y: number, r: number, a0: number, a1: number, ccw = false) {
    this.ellipse(x, y, r, r, 0, a0, a1, ccw)
  }
  ellipse(x: number, y: number, rx: number, ry: number, rot: number, a0: number, a1: number, ccw = false) {
    if (rx < 0 || ry < 0) throw new Error('ellipse：半径不能为负')
    let sweep = a1 - a0
    if (!ccw) {
      if (sweep >= TAU) sweep = TAU
      else { sweep %= TAU; if (sweep < 0) sweep += TAU }
    } else {
      if (-sweep >= TAU) sweep = -TAU
      else { sweep %= TAU; if (sweep > 0) sweep -= TAU }
    }
    const rd = Math.max(rx, ry) * this._scale()
    const n = Math.min(1024, Math.max(2, Math.ceil(Math.abs(sweep) * Math.sqrt(Math.max(rd, 0.5)) * 1.3)))
    const cr = Math.cos(rot), sr = Math.sin(rot)
    for (let i = 0; i <= n; i++) {
      const a = a0 + (sweep * i) / n
      const ex = Math.cos(a) * rx, ey = Math.sin(a) * ry
      const [dx, dy] = this._tx(x + ex * cr - ey * sr, y + ex * sr + ey * cr)
      this._addDev(dx, dy)
    }
  }
  arcTo(x1: number, y1: number, x2: number, y2: number, r: number) {
    const m = this._s.m
    const inv = invert(m)
    const last = this._last()
    if (!last) { this.moveTo(x1, y1); return }
    const x0 = inv[0] * last[0] + inv[2] * last[1] + inv[4], y0 = inv[1] * last[0] + inv[3] * last[1] + inv[5]
    const ax = x0 - x1, ay = y0 - y1, bx = x2 - x1, by = y2 - y1
    const la = Math.hypot(ax, ay), lb = Math.hypot(bx, by)
    const cross = ax * by - ay * bx
    if (!la || !lb || !r || Math.abs(cross) < 1e-9) { this.lineTo(x1, y1); return }
    const cos = (ax * bx + ay * by) / (la * lb)
    const half = Math.acos(Math.max(-1, Math.min(1, cos))) / 2
    const dist = r / Math.tan(half)
    const t0x = x1 + (ax / la) * dist, t0y = y1 + (ay / la) * dist
    const t1x = x1 + (bx / lb) * dist, t1y = y1 + (by / lb) * dist
    const nx = cross > 0 ? -ay / la : ay / la, ny = cross > 0 ? ax / la : -ax / la
    const cx = t0x + nx * r, cy = t0y + ny * r
    this.lineTo(t0x, t0y)
    const s = Math.atan2(t0y - cy, t0x - cx), e = Math.atan2(t1y - cy, t1x - cx)
    this.arc(cx, cy, r, s, e, cross > 0)
  }
  rect(x: number, y: number, w: number, h: number) {
    this.moveTo(x, y)
    this.lineTo(x + w, y)
    this.lineTo(x + w, y + h)
    this.lineTo(x, y + h)
    this.closePath()
  }
  roundRect(x: number, y: number, w: number, h: number, radii: number | number[] = 0) {
    const r = Array.isArray(radii) ? radii : [radii]
    const [tl, tr, br, bl] = r.length === 1 ? [r[0], r[0], r[0], r[0]] : r.length === 2 ? [r[0], r[1], r[0], r[1]] : r.length === 3 ? [r[0], r[1], r[2], r[1]] : r
    const k = Math.min(1, Math.abs(w) / Math.max(1e-9, tl + tr, bl + br), Math.abs(h) / Math.max(1e-9, tl + bl, tr + br))
    const a = tl * k, b = tr * k, c = br * k, d = bl * k
    this.moveTo(x + a, y)
    this.lineTo(x + w - b, y)
    if (b) this.arc(x + w - b, y + b, b, -Math.PI / 2, 0)
    this.lineTo(x + w, y + h - c)
    if (c) this.arc(x + w - c, y + h - c, c, 0, Math.PI / 2)
    this.lineTo(x + d, y + h)
    if (d) this.arc(x + d, y + h - d, d, Math.PI / 2, Math.PI)
    this.lineTo(x, y + a)
    if (a) this.arc(x + a, y + a, a, Math.PI, Math.PI * 1.5)
    this.closePath()
  }

  // ---------------- 绘制 ----------------

  private _fillPolys(): Poly[] {
    return this._subs.filter((s) => s.pts.length >= 6).map((s) => s.pts)
  }

  fill(rule?: 'nonzero' | 'evenodd') {
    this._evenodd = rule === 'evenodd'
    try { this._paint(this._fillPolys(), this._s.fill) } finally { this._evenodd = false }
  }
  stroke() {
    this._paint(this._strokePolys(this._subs), this._s.stroke)
  }
  clip(rule?: 'nonzero' | 'evenodd') {
    const c = this.canvas
    const mask = new Float32Array(c.width * c.height)
    this._evenodd = rule === 'evenodd'
    const cov = this._coverage(this._fillPolys())
    this._evenodd = false
    if (cov) {
      const { x0, y0, w, h, a } = cov
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) mask[(y0 + y) * c.width + x0 + x] = a[y * w + x]
    }
    const old = this._s.clip
    if (old) for (let i = 0; i < mask.length; i++) mask[i] *= old[i]
    this._s.clip = mask
  }
  fillRect(x: number, y: number, w: number, h: number) {
    this._paint([this._rectPoly(x, y, w, h)], this._s.fill)
  }
  strokeRect(x: number, y: number, w: number, h: number) {
    const p = this._rectPoly(x, y, w, h)
    this._paint(this._strokePolys([{ pts: p, closed: true }]), this._s.stroke)
  }
  clearRect(x: number, y: number, w: number, h: number) {
    const cov = this._coverage([this._rectPoly(x, y, w, h)])
    if (!cov) return
    const d = this.canvas.data, W = this.canvas.width, clip = this._s.clip
    const { x0, y0, w: cw, h: ch, a } = cov
    for (let yy = 0; yy < ch; yy++) for (let xx = 0; xx < cw; xx++) {
      let c = a[yy * cw + xx]
      const pi = (y0 + yy) * W + x0 + xx
      if (clip) c *= clip[pi]
      if (c <= 0) continue
      const k = 1 - Math.min(1, c)
      d[pi * 4] *= k; d[pi * 4 + 1] *= k; d[pi * 4 + 2] *= k; d[pi * 4 + 3] *= k
    }
  }
  isPointInPath(x: number, y: number) {
    const cov = this._coverage(this._fillPolys())
    if (!cov) return false
    const xi = Math.floor(x) - cov.x0, yi = Math.floor(y) - cov.y0
    return xi >= 0 && yi >= 0 && xi < cov.w && yi < cov.h && cov.a[yi * cov.w + xi] > 0.5
  }

  private _rectPoly(x: number, y: number, w: number, h: number): Poly {
    const a = this._tx(x, y), b = this._tx(x + w, y), c = this._tx(x + w, y + h), d = this._tx(x, y + h)
    return [a[0], a[1], b[0], b[1], c[0], c[1], d[0], d[1]]
  }

  createLinearGradient(x0: number, y0: number, x1: number, y1: number) {
    return new CanvasGradient('linear', [x0, y0, x1, y1])
  }
  createRadialGradient(x0: number, y0: number, r0: number, x1: number, y1: number, r1: number) {
    if (r0 < 0 || r1 < 0) throw new Error('createRadialGradient：半径不能为负')
    return new CanvasGradient('radial', [x0, y0, r0, x1, y1, r1])
  }
  createPattern(): never {
    throw new Error('Canvas：暂不支持 createPattern')
  }

  // ---------------- 覆盖率光栅化（按像素面积累加，非零环绕 / 奇偶） ----------------
  private _evenodd = false

  /** @internal */
  _coverage(polys: Poly[]): { x0: number; y0: number; w: number; h: number; a: Float32Array } | null {
    const W = this.canvas.width, H = this.canvas.height
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const p of polys) for (let i = 0; i < p.length; i += 2) {
      const x = p[i], y = p[i + 1]
      if (!Number.isFinite(x) || !Number.isFinite(y)) return null
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
    const x0 = Math.max(0, Math.floor(minX)), x1 = Math.min(W, Math.ceil(maxX))
    const y0 = Math.max(0, Math.floor(minY)), y1 = Math.min(H, Math.ceil(maxY))
    if (x1 <= x0 || y1 <= y0) return null
    const bw = x1 - x0, bh = y1 - y0, stride = bw + 2
    const acc = new Float32Array(stride * bh)
    const line = (ax: number, ay: number, bx: number, by: number) => {
      if (ay === by) return
      let dir = 1
      if (ay > by) { dir = -1; let t = ax; ax = bx; bx = t; t = ay; ay = by; by = t }
      const dxdy = (bx - ax) / (by - ay)
      let x = ax
      if (ay < 0) x -= ay * dxdy
      const ys = Math.max(0, Math.floor(ay)), ye = Math.min(bh, Math.ceil(by))
      for (let y = ys; y < ye; y++) {
        const ls = y * stride
        const dy = Math.min(y + 1, by) - Math.max(y, ay)
        const xn = x + dxdy * dy
        const d = dy * dir
        const xa = x < xn ? x : xn, xb = x < xn ? xn : x
        const xaf = Math.floor(xa), xai = xaf
        const xbc = Math.ceil(xb), xbi = xbc
        if (xbi <= xai + 1) {
          const xmf = 0.5 * (x + xn) - xaf
          acc[ls + xai] += d - d * xmf
          acc[ls + xai + 1] += d * xmf
        } else {
          const s = 1 / (xb - xa)
          const x0f = xa - xaf
          const a0 = 0.5 * s * (1 - x0f) * (1 - x0f)
          const x1f = xb - xbc + 1
          const am = 0.5 * s * x1f * x1f
          acc[ls + xai] += d * a0
          if (xbi === xai + 2) acc[ls + xai + 1] += d * (1 - a0 - am)
          else {
            const a1 = s * (1.5 - x0f)
            acc[ls + xai + 1] += d * (a1 - a0)
            for (let xi = xai + 2; xi < xbi - 1; xi++) acc[ls + xi] += d * s
            const a2 = a1 + (xbi - xai - 3) * s
            acc[ls + xbi - 1] += d * (1 - a2 - am)
          }
          acc[ls + xbi] += d * am
        }
        x = xn
      }
    }
    // 按 x = 0 与 x = bw 切分，界外部分压到边界上（保持环绕数）
    const seg = (ax: number, ay: number, bx: number, by: number) => {
      ax -= x0; bx -= x0; ay -= y0; by -= y0
      if (ay === by) return
      const ts: number[] = [0, 1]
      if (ax !== bx) for (const X of [0, bw]) {
        const t = (X - ax) / (bx - ax)
        if (t > 0 && t < 1) ts.push(t)
      }
      ts.sort((p, q) => p - q)
      const cl = (v: number) => (v < 0 ? 0 : v > bw ? bw : v)
      for (let i = 0; i + 1 < ts.length; i++) {
        const t0 = ts[i], t1 = ts[i + 1]
        line(cl(ax + (bx - ax) * t0), ay + (by - ay) * t0, cl(ax + (bx - ax) * t1), ay + (by - ay) * t1)
      }
    }
    for (const p of polys) {
      const n = p.length
      for (let i = 0; i < n; i += 2) {
        const j = (i + 2) % n
        seg(p[i], p[i + 1], p[j], p[j + 1])
      }
    }
    const a = new Float32Array(bw * bh)
    const eo = this._evenodd
    for (let y = 0; y < bh; y++) {
      let s = 0
      const ls = y * stride
      for (let x = 0; x < bw; x++) {
        s += acc[ls + x]
        let v = Math.abs(s)
        if (eo) { v %= 2; if (v > 1) v = 2 - v }
        a[y * bw + x] = v > 1 ? 1 : v
      }
    }
    return { x0, y0, w: bw, h: bh, a }
  }

  // ---------------- 描边转多边形 ----------------

  private _strokePolys(subs: { pts: number[]; closed: boolean }[]): Poly[] {
    const s = this._s
    const m = s.m, inv = invert(m)
    const hw = s.lineWidth / 2
    const out: Poly[] = []
    const scale = this._scale()
    const push = (p: Poly) => {
      const r: Poly = []
      for (let i = 0; i < p.length; i += 2) r.push(m[0] * p[i] + m[2] * p[i + 1] + m[4], m[1] * p[i] + m[3] * p[i + 1] + m[5])
      out.push(orient(r))
    }
    const circle = (x: number, y: number) => {
      const n = Math.min(256, Math.max(8, Math.ceil(TAU * Math.sqrt(Math.max(hw * scale, 0.5)) * 1.3)))
      const p: Poly = []
      for (let i = 0; i < n; i++) p.push(x + Math.cos((i / n) * TAU) * hw, y + Math.sin((i / n) * TAU) * hw)
      push(p)
    }
    const stroke = (pts: number[], closed: boolean) => {
      const n = pts.length / 2
      if (n < 2) return
      const segs = closed ? n : n - 1
      const dirs: number[] = []
      for (let i = 0; i < segs; i++) {
        const j = (i + 1) % n
        const dx = pts[j * 2] - pts[i * 2], dy = pts[j * 2 + 1] - pts[i * 2 + 1]
        const l = Math.hypot(dx, dy) || 1
        dirs.push(dx / l, dy / l)
        const nx = (-dy / l) * hw, ny = (dx / l) * hw
        const ax = pts[i * 2], ay = pts[i * 2 + 1], bx = pts[j * 2], by = pts[j * 2 + 1]
        push([ax + nx, ay + ny, bx + nx, by + ny, bx - nx, by - ny, ax - nx, ay - ny])
      }
      const join = (vi: number, d0: number, d1: number) => {
        const px = pts[vi * 2], py = pts[vi * 2 + 1]
        const ax = dirs[d0 * 2], ay = dirs[d0 * 2 + 1], bx = dirs[d1 * 2], by = dirs[d1 * 2 + 1]
        const cross = ax * by - ay * bx, dot = ax * bx + ay * by
        if (Math.abs(cross) < 1e-6 && dot > 0) return
        if (s.lineJoin === 'round') { circle(px, py); return }
        const sg = cross > 0 ? -1 : 1
        const n0x = -ay * hw * sg, n0y = ax * hw * sg, n1x = -by * hw * sg, n1y = bx * hw * sg
        if (s.lineJoin === 'miter' && 1 + dot > 1e-9) {
          const ratio = Math.sqrt(2 / (1 + dot))
          if (ratio <= s.miterLimit) {
            const k = 1 / (1 + dot)
            push([px, py, px + n0x, py + n0y, px + (n0x + n1x) * k, py + (n0y + n1y) * k, px + n1x, py + n1y])
            return
          }
        }
        push([px, py, px + n0x, py + n0y, px + n1x, py + n1y])
      }
      for (let i = 1; i < segs; i++) join(i, i - 1, i)
      if (closed) join(0, segs - 1, 0)
      else {
        const cap = (vi: number, dx: number, dy: number) => {
          const px = pts[vi * 2], py = pts[vi * 2 + 1]
          if (s.lineCap === 'round') circle(px, py)
          else if (s.lineCap === 'square') {
            const nx = -dy * hw, ny = dx * hw, ex = dx * hw, ey = dy * hw
            push([px + nx, py + ny, px + nx + ex, py + ny + ey, px - nx + ex, py - ny + ey, px - nx, py - ny])
          }
        }
        cap(0, -dirs[0], -dirs[1])
        cap(n - 1, dirs[(segs - 1) * 2], dirs[(segs - 1) * 2 + 1])
      }
    }
    for (const sub of subs) {
      const user: number[] = []
      for (let i = 0; i < sub.pts.length; i += 2) {
        const x = inv[0] * sub.pts[i] + inv[2] * sub.pts[i + 1] + inv[4]
        const y = inv[1] * sub.pts[i] + inv[3] * sub.pts[i + 1] + inv[5]
        const k = user.length
        if (k && Math.abs(user[k - 2] - x) < 1e-7 && Math.abs(user[k - 1] - y) < 1e-7) continue
        user.push(x, y)
      }
      if (sub.closed && user.length > 4 && Math.abs(user[0] - user[user.length - 2]) < 1e-7 && Math.abs(user[1] - user[user.length - 1]) < 1e-7) user.length -= 2
      if (user.length < 4) continue
      if (s.dash.length && s.dash.some((d) => d > 0)) for (const piece of this._dashes(user, sub.closed)) stroke(piece, false)
      else stroke(user, sub.closed)
    }
    return out
  }

  private _dashes(pts: number[], closed: boolean): number[][] {
    const dash = this._s.dash
    const total = dash.reduce((a, b) => a + b, 0)
    let off = ((this._s.dashOffset % total) + total) % total
    let di = 0
    while (off >= dash[di]) { off -= dash[di]; di = (di + 1) % dash.length }
    let left = dash[di] - off
    let on = di % 2 === 0
    const out: number[][] = []
    let cur: number[] | null = on ? [pts[0], pts[1]] : null
    const n = pts.length / 2
    const segs = closed ? n : n - 1
    for (let i = 0; i < segs; i++) {
      const j = (i + 1) % n
      let ax = pts[i * 2], ay = pts[i * 2 + 1]
      const bx = pts[j * 2], by = pts[j * 2 + 1]
      let len = Math.hypot(bx - ax, by - ay)
      const ux = len ? (bx - ax) / len : 0, uy = len ? (by - ay) / len : 0
      while (len > left) {
        ax += ux * left; ay += uy * left; len -= left
        if (on) { cur!.push(ax, ay); out.push(cur!); cur = null } else cur = [ax, ay]
        on = !on
        di = (di + 1) % dash.length
        left = dash[di]
      }
      left -= len
      if (on) cur!.push(bx, by)
    }
    if (cur && cur.length >= 4) out.push(cur)
    return out
  }

  // ---------------- 着色与合成 ----------------

  private _shader(paint: Paint): (x: number, y: number, out: Float32Array) => void {
    if ('color' in paint) {
      const [r, g, b, a] = paint.color
      return (_x, _y, o) => { o[0] = r * a; o[1] = g * a; o[2] = b * a; o[3] = a }
    }
    const gr = paint.gradient
    const lut = gr.lut()
    const inv = invert(this._s.m)
    const look = (t: number, o: Float32Array) => {
      const i = (t <= 0 ? 0 : t >= 1 ? 1023 : Math.round(t * 1023)) * 4
      o[0] = lut[i]; o[1] = lut[i + 1]; o[2] = lut[i + 2]; o[3] = lut[i + 3]
    }
    const A = gr.args
    if (gr.kind === 'linear') {
      const [x0, y0, x1, y1] = A
      const dx = x1 - x0, dy = y1 - y0, l2 = dx * dx + dy * dy
      return (x, y, o) => {
        if (!l2) { o.fill(0); return }
        const ux = inv[0] * x + inv[2] * y + inv[4], uy = inv[1] * x + inv[3] * y + inv[5]
        look(((ux - x0) * dx + (uy - y0) * dy) / l2, o)
      }
    }
    const [cx0, cy0, r0, cx1, cy1, r1] = A
    const cdx = cx1 - cx0, cdy = cy1 - cy0, dr = r1 - r0
    const a = cdx * cdx + cdy * cdy - dr * dr
    return (x, y, o) => {
      const ux = inv[0] * x + inv[2] * y + inv[4], uy = inv[1] * x + inv[3] * y + inv[5]
      const px = ux - cx0, py = uy - cy0
      const b = px * cdx + py * cdy + r0 * dr
      const c = px * px + py * py - r0 * r0
      let t: number
      if (Math.abs(a) < 1e-9) {
        if (Math.abs(b) < 1e-12) { o.fill(0); return }
        t = c / (2 * b)
      } else {
        const disc = b * b - a * c
        if (disc < 0) { o.fill(0); return }
        const sq = Math.sqrt(disc)
        t = (b + sq) / a
        if (r0 + t * dr < 0) t = (b - sq) / a
      }
      if (r0 + t * dr < 0) { o.fill(0); return }
      look(t, o)
    }
  }

  /** 合成一个预乘源像素（c 为覆盖率 × globalAlpha × clip） */
  private _blend(pi: number, S: Float32Array, c: number) {
    const d = this.canvas.data
    const i = pi * 4
    const Dr = d[i], Dg = d[i + 1], Db = d[i + 2], Da = d[i + 3]
    const Sr = S[0], Sg = S[1], Sb = S[2], Sa = S[3]
    let r: number, g: number, b: number, a: number
    switch (this._s.op) {
      case 'destination-out': r = Dr * (1 - Sa); g = Dg * (1 - Sa); b = Db * (1 - Sa); a = Da * (1 - Sa); break
      case 'destination-in': r = Dr * Sa; g = Dg * Sa; b = Db * Sa; a = Da * Sa; break
      case 'destination-over': r = Dr + Sr * (1 - Da); g = Dg + Sg * (1 - Da); b = Db + Sb * (1 - Da); a = Da + Sa * (1 - Da); break
      case 'source-atop': r = Sr * Da + Dr * (1 - Sa); g = Sg * Da + Dg * (1 - Sa); b = Sb * Da + Db * (1 - Sa); a = Da; break
      case 'lighter': r = Math.min(1, Sr + Dr); g = Math.min(1, Sg + Dg); b = Math.min(1, Sb + Db); a = Math.min(1, Sa + Da); break
      case 'copy': r = Sr; g = Sg; b = Sb; a = Sa; break
      case 'multiply':
        r = Sr * (1 - Da) + Dr * (1 - Sa) + Sr * Dr; g = Sg * (1 - Da) + Dg * (1 - Sa) + Sg * Dg
        b = Sb * (1 - Da) + Db * (1 - Sa) + Sb * Db; a = Sa + Da - Sa * Da; break
      case 'screen': r = Sr + Dr - Sr * Dr; g = Sg + Dg - Sg * Dg; b = Sb + Db - Sb * Db; a = Sa + Da - Sa * Da; break
      default: r = Sr + Dr * (1 - Sa); g = Sg + Dg * (1 - Sa); b = Sb + Db * (1 - Sa); a = Sa + Da * (1 - Sa)
    }
    if (c >= 1) { d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = a }
    else { d[i] = Dr + (r - Dr) * c; d[i + 1] = Dg + (g - Dg) * c; d[i + 2] = Db + (b - Db) * c; d[i + 3] = Da + (a - Da) * c }
  }

  private _paint(polys: Poly[], paint: Paint, sample?: (x: number, y: number, o: Float32Array) => number) {
    if (!polys.length) return
    const cov = this._coverage(polys)
    if (!cov) return
    const W = this.canvas.width, clip = this._s.clip, alpha = this._s.alpha
    const shade = this._shader(paint)
    const S = new Float32Array(4)
    const { x0, y0, w, h, a } = cov
    for (let y = 0; y < h; y++) {
      const py = y0 + y + 0.5
      for (let x = 0; x < w; x++) {
        let c = a[y * w + x]
        if (c <= 0) continue
        const pi = (y0 + y) * W + x0 + x
        if (clip) { c *= clip[pi]; if (c <= 0) continue }
        c *= alpha
        if (sample) {
          const k = sample(x0 + x + 0.5, py, S)
          if (k < 0) { this._blend(pi, S, c); continue }
          if (k <= 0) continue
          shade(x0 + x + 0.5, py, S)
          S[0] *= k; S[1] *= k; S[2] *= k; S[3] *= k
        } else shade(x0 + x + 0.5, py, S)
        this._blend(pi, S, c)
      }
    }
  }

  // ---------------- 图像 ----------------

  drawImage(img: Canvas | ImageDataLike, ...args: number[]) {
    const iw = img.width, ih = img.height
    let sx = 0, sy = 0, sw = iw, sh = ih, dx: number, dy: number, dw = iw, dh = ih
    if (args.length === 2) [dx, dy] = args
    else if (args.length === 4) [dx, dy, dw, dh] = args
    else if (args.length === 8) [sx, sy, sw, sh, dx, dy, dw, dh] = args
    else throw new Error('drawImage：参数个数应为 3、5 或 9')
    if (!sw || !sh || !dw || !dh) return
    const src = img instanceof Canvas ? img.data : premulBytes(img.data)
    const inv = invert(this._s.m)
    const smooth = this.imageSmoothingEnabled
    // 采样区域限制在源矩形内（与浏览器一致，不会采到相邻图块）
    const lx = Math.max(0, Math.min(sx, sx + sw)), hx = Math.min(iw, Math.max(sx, sx + sw))
    const ly = Math.max(0, Math.min(sy, sy + sh)), hy = Math.min(ih, Math.max(sy, sy + sh))
    this._paint([this._rectPoly(dx, dy, dw, dh)], this._s.fill, (x, y, o) => {
      const ux = inv[0] * x + inv[2] * y + inv[4], uy = inv[1] * x + inv[3] * y + inv[5]
      const u = sx + ((ux - dx) / dw) * sw, v = sy + ((uy - dy) / dh) * sh
      sampleRGBA(src, iw, u, v, lx, ly, hx, hy, smooth, o)
      return -1
    })
  }

  getImageData(x: number, y: number, w: number, h: number): CanvasImageData {
    const out = new Uint8ClampedArray(w * h * 4)
    const c = this.canvas, d = c.data
    for (let j = 0; j < h; j++) {
      const yy = y + j
      if (yy < 0 || yy >= c.height) continue
      for (let i = 0; i < w; i++) {
        const xx = x + i
        if (xx < 0 || xx >= c.width) continue
        const s = (yy * c.width + xx) * 4, o = (j * w + i) * 4
        const a = d[s + 3]
        if (a > 0) {
          out[o] = Math.round((d[s] / a) * 255)
          out[o + 1] = Math.round((d[s + 1] / a) * 255)
          out[o + 2] = Math.round((d[s + 2] / a) * 255)
          out[o + 3] = Math.round(a * 255)
        }
      }
    }
    return { width: w, height: h, data: out }
  }
  createImageData(w: number | ImageDataLike, h?: number): CanvasImageData {
    if (typeof w === 'object') return { width: w.width, height: w.height, data: new Uint8ClampedArray(w.width * w.height * 4) }
    return { width: w, height: h!, data: new Uint8ClampedArray(w * h! * 4) }
  }
  putImageData(img: ImageDataLike, x: number, y: number) {
    const c = this.canvas, d = c.data, s = img.data
    x = Math.round(x); y = Math.round(y)
    for (let j = 0; j < img.height; j++) {
      const yy = y + j
      if (yy < 0 || yy >= c.height) continue
      for (let i = 0; i < img.width; i++) {
        const xx = x + i
        if (xx < 0 || xx >= c.width) continue
        const si = (j * img.width + i) * 4, di = (yy * c.width + xx) * 4
        const a = s[si + 3] / 255
        d[di] = (s[si] / 255) * a
        d[di + 1] = (s[si + 1] / 255) * a
        d[di + 2] = (s[si + 2] / 255) * a
        d[di + 3] = a
      }
    }
  }

  // ---------------- 文字 ----------------

  measureText(text: string): TextMetrics {
    const f = this._s.font
    const g = this.canvas._glyphs(String(text), f, f.size)
    const left = this._alignOffset(g.adv)
    return {
      width: g.adv,
      actualBoundingBoxLeft: -left + g.ox,
      actualBoundingBoxRight: left + g.w - g.ox,
      actualBoundingBoxAscent: g.base,
      actualBoundingBoxDescent: g.h - g.base,
      fontBoundingBoxAscent: g.ascent,
      fontBoundingBoxDescent: g.descent,
    }
  }

  private _alignOffset(adv: number) {
    switch (this._s.textAlign) {
      case 'center': return -adv / 2
      case 'right': case 'end': return -adv
      default: return 0
    }
  }

  fillText(text: string, x: number, y: number, maxWidth?: number) {
    text = String(text).replace(/[\t\n\r\f]/g, ' ')
    if (!text) return
    const f = this._s.font
    // 按设备缩放栅格化，放大后仍清晰
    const scale = Math.min(8, Math.max(0.25, this._scale()))
    const rs = Math.max(4, Math.min(512, Math.round(f.size * scale)))
    const k = f.size / rs
    const g = this.canvas._glyphs(text, f, rs)
    const adv = g.adv * k
    const sxk = maxWidth !== undefined && maxWidth > 0 && adv > maxWidth ? maxWidth / adv : 1
    const ascent = f.size * 0.8, descent = f.size * 0.2
    let base = y
    switch (this._s.textBaseline) {
      case 'top': case 'hanging': base = y + ascent; break
      case 'middle': base = y + (ascent - descent) / 2; break
      case 'bottom': case 'ideographic': base = y - descent; break
    }
    const left = x + this._alignOffset(adv * sxk)
    const qx = left - g.ox * k * sxk, qy = base - g.base * k, qw = g.w * k * sxk, qh = g.h * k
    if (!g.w || !g.h) return
    const inv = invert(this._s.m)
    const A = g.alpha, gw = g.w, gh = g.h
    this._paint([this._rectPoly(qx, qy, qw, qh)], this._s.fill, (px, py) => {
      const ux = inv[0] * px + inv[2] * py + inv[4], uy = inv[1] * px + inv[3] * py + inv[5]
      return sampleAlpha(A, gw, gh, ((ux - qx) / qw) * gw, ((uy - qy) / qh) * gh)
    })
  }

  strokeText(): never {
    throw new Error('Canvas：暂不支持 strokeText')
  }
}

function premulBytes(b: Uint8ClampedArray | Uint8Array) {
  const f = new Float32Array(b.length)
  for (let i = 0; i < b.length; i += 4) {
    const a = b[i + 3] / 255
    f[i] = (b[i] / 255) * a; f[i + 1] = (b[i + 1] / 255) * a; f[i + 2] = (b[i + 2] / 255) * a; f[i + 3] = a
  }
  return f
}

function sampleRGBA(src: Float32Array, w: number, u: number, v: number, lx: number, ly: number, hx: number, hy: number, smooth: boolean, o: Float32Array) {
  if (!smooth) {
    const x = Math.min(hx - 1, Math.max(lx, Math.floor(u))), y = Math.min(hy - 1, Math.max(ly, Math.floor(v)))
    const i = (y * w + x) * 4
    o[0] = src[i]; o[1] = src[i + 1]; o[2] = src[i + 2]; o[3] = src[i + 3]
    return
  }
  const fx = u - 0.5, fy = v - 0.5
  let x0 = Math.floor(fx), y0 = Math.floor(fy)
  const tx = fx - x0, ty = fy - y0
  const cx = (x: number) => (x < lx ? lx : x > hx - 1 ? hx - 1 : x)
  const cy = (y: number) => (y < ly ? ly : y > hy - 1 ? hy - 1 : y)
  const xa = cx(x0), xb = cx(x0 + 1), ya = cy(y0), yb = cy(y0 + 1)
  const i00 = (ya * w + xa) * 4, i10 = (ya * w + xb) * 4, i01 = (yb * w + xa) * 4, i11 = (yb * w + xb) * 4
  for (let k = 0; k < 4; k++) {
    const top = src[i00 + k] + (src[i10 + k] - src[i00 + k]) * tx
    const bot = src[i01 + k] + (src[i11 + k] - src[i01 + k]) * tx
    o[k] = top + (bot - top) * ty
  }
  x0 = y0 = 0
}

function sampleAlpha(A: Uint8Array, w: number, h: number, u: number, v: number) {
  const fx = u - 0.5, fy = v - 0.5
  const x0 = Math.floor(fx), y0 = Math.floor(fy)
  const tx = fx - x0, ty = fy - y0
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : A[y * w + x])
  const top = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * tx
  const bot = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * tx
  return (top + (bot - top) * ty) / 255
}

const GENERIC: Record<string, string[]> = {
  'sans-serif': ['Microsoft YaHei', 'Arial'],
  sans: ['Microsoft YaHei', 'Arial'],
  'system-ui': ['Microsoft YaHei', 'Segoe UI'],
  serif: ['SimSun', 'Times New Roman'],
  monospace: ['Consolas', 'Courier New', 'SimHei'],
  'ui-monospace': ['Consolas', 'Courier New'],
}

/** CSS font-family 列表 → 系统字体名（逗号分隔，通用族展开，最后补中文回退） */
export function fontFamilies(css: string) {
  const out: string[] = []
  for (const raw of css.split(',')) {
    const name = raw.trim().replace(/^["']|["']$/g, '')
    if (!name) continue
    const g = GENERIC[name.toLowerCase()]
    for (const n of g ?? [name]) if (!out.includes(n)) out.push(n)
  }
  for (const n of ['Microsoft YaHei', 'SimHei', 'PingFang SC', 'Noto Sans CJK SC', 'Arial']) if (!out.includes(n)) out.push(n)
  return out.join(',')
}

/** 软件画布：像素为预乘 Float32，行从上到下（与浏览器一致） */
export class Canvas {
  data: Float32Array
  private _w: number
  private _h: number
  private _ctx?: CanvasRenderingContext2D
  private _glyphCache = new Map<string, Glyphs>()
  /** 宿主文字栅格化（scene.canvas 创建时注入；独立 new Canvas 时不能画文字） */
  host?: Host
  /** 由 scene.canvas 注入：把像素上传为贴图 */
  upload?: (data: Uint8Array, width: number, height: number, options: any) => any

  constructor(width: number, height: number, host?: Host) {
    this._w = Math.max(1, Math.floor(width))
    this._h = Math.max(1, Math.floor(height))
    this.data = new Float32Array(this._w * this._h * 4)
    this.host = host
  }

  get width() { return this._w }
  set width(v: number) { this._resize(v, this._h) }
  get height() { return this._h }
  set height(v: number) { this._resize(this._w, v) }
  private _resize(w: number, h: number) {
    this._w = Math.max(1, Math.floor(w))
    this._h = Math.max(1, Math.floor(h))
    this.data = new Float32Array(this._w * this._h * 4)
    this._ctx = undefined
  }

  getContext(kind: '2d', _options?: any): CanvasRenderingContext2D {
    if (kind !== '2d') throw new Error(`Canvas：只支持 getContext('2d')`)
    return (this._ctx ??= new CanvasRenderingContext2D(this))
  }

  /** RGBA8 非预乘像素；flipY 为 true 时行从下到上（scene.texture 的约定） */
  pixels(flipY = false) {
    const w = this._w, h = this._h, d = this.data
    const out = new Uint8Array(w * h * 4)
    for (let y = 0; y < h; y++) {
      const ry = flipY ? h - 1 - y : y
      for (let x = 0; x < w; x++) {
        const s = (y * w + x) * 4, o = (ry * w + x) * 4
        const a = d[s + 3]
        if (a <= 0) continue
        const ia = 1 / a
        out[o] = Math.min(255, Math.round(d[s] * ia * 255))
        out[o + 1] = Math.min(255, Math.round(d[s + 1] * ia * 255))
        out[o + 2] = Math.min(255, Math.round(d[s + 2] * ia * 255))
        out[o + 3] = Math.min(255, Math.round(a * 255))
      }
    }
    return out
  }

  /**
   * 上传为贴图（scene.texture 的选项：linear 数据贴图如法线/遮罩用 true，mipmaps、wrap、filter、aniso）。
   * 只有 ctx.scene.canvas 创建的画布可用；贴图随调用 scene.canvas 的插件卸载销毁。
   */
  texture(options: { linear?: boolean; mipmaps?: boolean; wrap?: 'repeat' | 'clamp'; filter?: 'point' | 'bilinear' | 'trilinear'; aniso?: number } = {}) {
    if (!this.upload) throw new Error('canvas.texture：请用 ctx.scene.canvas 创建画布')
    return this.upload(this.pixels(true), this._w, this._h, options)
  }

  /** @internal 一行文字的 alpha 位图（宿主栅格化，带缓存） */
  _glyphs(text: string, font: FontSpec, size: number): Glyphs {
    const style = (font.bold ? 1 : 0) | (font.italic ? 2 : 0)
    const key = `${size}|${style}|${font.family}|${text}`
    let g = this._glyphCache.get(key)
    if (g) return g
    const engine = this.host?.engine
    if (!engine?.canvasText) throw new Error('Canvas：文字需要宿主支持，请用 ctx.scene.canvas 创建画布')
    const buf = engine.canvasText(text, fontFamilies(font.family), size, style)
    if (!buf || buf.byteLength < 32) g = { w: 0, h: 0, ox: 0, base: 0, adv: 0, ascent: size * 0.8, descent: size * 0.2, alpha: new Uint8Array(0) }
    else {
      const hd = new Float32Array(buf, 0, 8)
      const w = hd[0], h = hd[1]
      g = { w, h, ox: hd[2], base: hd[3], adv: hd[4], ascent: hd[5], descent: hd[6], alpha: new Uint8Array(buf, 32, w * h) }
    }
    if (this._glyphCache.size > 512) this._glyphCache.clear()
    this._glyphCache.set(key, g)
    return g
  }
}
