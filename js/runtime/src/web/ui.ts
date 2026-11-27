/**
 * Web 宿主的 2D 界面（004 第 20.5 节）：用 Canvas2D 复刻 PotUI.cs 的命令。
 * 只依赖下面的 Ctx2D 结构（真实的 CanvasRenderingContext2D 满足它），Node 测试可传假的上下文。
 *
 * 命令以 \u001e 分隔，字段以 \u001f 分隔，颜色为 rrggbbaa：
 *   r x y w h color radius / b x y w h color thickness radius / l x1 y1 x2 y2 color width
 *   a cx cy radius color thickness start sweep（度，0 度朝上，顺时针）/ g x y w h radius vertical stops
 *   t x y w h color size align flags text / i x y w h texId color radius uv / c x y w h / C
 */

export interface Ctx2D {
  font: string
  fillStyle: unknown
  strokeStyle: unknown
  lineWidth: number
  lineCap: string
  textAlign: string
  textBaseline: string
  globalAlpha: number
  save(): void
  restore(): void
  beginPath(): void
  closePath(): void
  moveTo(x: number, y: number): void
  lineTo(x: number, y: number): void
  arc(x: number, y: number, r: number, a0: number, a1: number, ccw?: boolean): void
  arcTo(x1: number, y1: number, x2: number, y2: number, r: number): void
  rect(x: number, y: number, w: number, h: number): void
  fill(): void
  stroke(): void
  clip(): void
  fillRect(x: number, y: number, w: number, h: number): void
  clearRect(x: number, y: number, w: number, h: number): void
  fillText(text: string, x: number, y: number): void
  measureText(text: string): { width: number }
  createLinearGradient(x0: number, y0: number, x1: number, y1: number): { addColorStop(offset: number, color: string): void }
  drawImage(image: any, sx: number, sy: number, sw: number, sh: number, dx: number, dy: number, dw: number, dh: number): void
}

/** 贴图查询：返回可画的图像与尺寸；tint 非白色时由宿主返回染过色的图像（web-2） */
export type ImageSource = (texId: number, tint: string) => { image: unknown; width: number; height: number } | null

const RS = '\u001e'
const FS = '\u001f'

/** 参考行高（em），与 PotUI.cs 的 RefLineHeight 相同 */
export const LINE_HEIGHT = 1.32
export const UI_FONT_FAMILY = '"Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", sans-serif'
export const UI_MONO_FAMILY = 'Consolas, "Courier New", "Microsoft YaHei", "PingFang SC", monospace'

/** flags 中的字重：位 4..7 为 字重/100；为 0 时看位 0（粗体 700，否则 400） */
export function fontWeight(flags: number): number {
  const w = (flags >> 4) & 15
  return w > 0 ? Math.min(w, 9) * 100 : flags & 1 ? 700 : 400
}

export function fontOf(size: number, flags: number): string {
  return `${fontWeight(flags)} ${Math.max(1, size)}px ${flags & 8 ? UI_MONO_FAMILY : UI_FONT_FAMILY}`
}

/** rrggbbaa / rrggbb → [r, g, b, a]（0..1） */
export function parseColor(s: string): [number, number, number, number] {
  let n = parseInt(s, 16)
  if (!Number.isFinite(n) || !/^[0-9a-fA-F]+$/.test(s)) n = 0xffffffff
  else if (s.length === 6) n = n * 256 + 255
  return [((n >>> 24) & 255) / 255, ((n >>> 16) & 255) / 255, ((n >>> 8) & 255) / 255, (n & 255) / 255]
}

const cssCache = new Map<string, string>()

export function cssColor(s: string, alphaScale = 1): string {
  const key = alphaScale === 1 ? s : `${s}*${alphaScale}`
  let c = cssCache.get(key)
  if (c === undefined) {
    const [r, g, b, a] = parseColor(s)
    c = `rgba(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)},${+(a * alphaScale).toFixed(4)})`
    if (cssCache.size > 4096) cssCache.clear()
    cssCache.set(key, c)
  }
  return c
}

const num = (s: string | undefined) => {
  const v = parseFloat(s ?? '')
  return Number.isFinite(v) ? v : 0
}

/** 中日韩文字与全角标点：可在任意字之间断行 */
const CJK = /[\u2e80-\u9fff\uac00-\ud7af\uf900-\ufaff\uff00-\uffef\u3000-\u303f]/

/**
 * 按宽度断行：英文在空格处断（空格留在行尾、量宽时不计），中文逐字可断，单个词超宽时按字断。
 * width 为 0 或负数时只按 \n 分行
 */
export function wrapText(text: string, maxWidth: number, measure: (s: string) => number): string[] {
  const out: string[] = []
  for (const para of String(text).split('\n')) {
    if (!(maxWidth > 0)) { out.push(para); continue }
    // 切成可断开的片段：中文单字、英文词连同其后的空格
    const tokens: string[] = []
    let word = ''
    for (const ch of para) {
      if (CJK.test(ch)) {
        if (word) { tokens.push(word); word = '' }
        tokens.push(ch)
      } else if (ch === ' ') {
        word += ch
        tokens.push(word)
        word = ''
      } else {
        if (word.endsWith(' ')) { tokens.push(word); word = '' }
        word += ch
      }
    }
    if (word) tokens.push(word)
    let line = ''
    for (const tok of tokens) {
      if (!line) line = tok
      else if (measure((line + tok).trimEnd()) <= maxWidth) line += tok
      else {
        out.push(line.trimEnd())
        line = tok
      }
      // 单个超宽的片段（此时 line 就是它）：按字断
      if (measure(line.trimEnd()) > maxWidth && [...line.trimEnd()].length > 1) {
        let part = ''
        for (const ch of line) {
          if (part && measure((part + ch).trimEnd()) > maxWidth) {
            out.push(part.trimEnd())
            part = ''
          }
          part += ch
        }
        line = part
      }
    }
    out.push(line.trimEnd())
  }
  return out
}

export class WebUI {
  private list = ''
  private drawn: string | null = null
  private drawnW = 0
  private drawnH = 0
  private widths = new Map<string, number>()

  constructor(private ctx: Ctx2D, private images: ImageSource = () => null) {}

  /** 保存本帧命令串（绘制在 render 时统一做） */
  submit(list: string): void {
    this.list = list ?? ''
  }

  get commands(): string {
    return this.list
  }

  /** 让下一次 render 一定重画（贴图内容变化、画布尺寸变化时） */
  invalidate(): void {
    this.drawn = null
  }

  private width(text: string, font: string): number {
    const key = font + '|' + text
    let w = this.widths.get(key)
    if (w === undefined) {
      this.ctx.font = font
      w = this.ctx.measureText(text).width
      if (this.widths.size > 8192) this.widths.clear()
      this.widths.set(key, w)
    }
    return w
  }

  /** 文字尺寸：不换行（同 PotUI.Measure 去掉换行与阴影位），宽为最长行，高为行数 × 行高 */
  measure(text: string, size: number, flags: number): [number, number] {
    const font = fontOf(size, flags)
    const lines = String(text ?? '').split('\n')
    let w = 0
    for (const l of lines) w = Math.max(w, this.width(l, font))
    return [w, lines.length * LINE_HEIGHT * Math.max(1, size)]
  }

  /** 画本帧命令；命令串与画布尺寸都没变时不重画，返回是否画了 */
  render(width: number, height: number): boolean {
    if (this.drawn === this.list && this.drawnW === width && this.drawnH === height) return false
    const ctx = this.ctx
    ctx.clearRect(0, 0, width, height)
    let depth = 0
    if (this.list) {
      for (const record of this.list.split(RS)) {
        if (record.length < 1) continue
        const f = record.split(FS)
        try {
          if (f[0] === 'c') {
            ctx.save()
            ctx.beginPath()
            ctx.rect(num(f[1]), num(f[2]), Math.max(0, num(f[3])), Math.max(0, num(f[4])))
            ctx.clip()
            depth++
          } else if (f[0] === 'C') {
            if (depth > 0) { ctx.restore(); depth-- }
          } else {
            this.command(f)
          }
        } catch {
          // 单条命令格式错误不影响其他命令
        }
      }
    }
    while (depth-- > 0) ctx.restore()
    this.drawn = this.list
    this.drawnW = width
    this.drawnH = height
    return true
  }

  private roundRect(x: number, y: number, w: number, h: number, r: number) {
    const ctx = this.ctx
    r = Math.max(0, Math.min(r, w / 2, h / 2))
    ctx.beginPath()
    if (r <= 0) {
      ctx.rect(x, y, w, h)
      return
    }
    ctx.moveTo(x + r, y)
    ctx.arcTo(x + w, y, x + w, y + h, r)
    ctx.arcTo(x + w, y + h, x, y + h, r)
    ctx.arcTo(x, y + h, x, y, r)
    ctx.arcTo(x, y, x + w, y, r)
    ctx.closePath()
  }

  private command(f: string[]) {
    const ctx = this.ctx
    switch (f[0]) {
      case 'r': {
        ctx.fillStyle = cssColor(f[5])
        this.roundRect(num(f[1]), num(f[2]), num(f[3]), num(f[4]), num(f[6]))
        ctx.fill()
        break
      }
      case 'b': {
        // 描边画在矩形内侧（IMGUI 的 borderWidth）
        const t = num(f[6])
        if (t <= 0) break
        ctx.strokeStyle = cssColor(f[5])
        ctx.lineWidth = t
        this.roundRect(num(f[1]) + t / 2, num(f[2]) + t / 2, num(f[3]) - t, num(f[4]) - t, Math.max(0, num(f[7]) - t / 2))
        ctx.stroke()
        break
      }
      case 'l': {
        ctx.strokeStyle = cssColor(f[5])
        ctx.lineWidth = num(f[6])
        ctx.lineCap = 'butt'
        ctx.beginPath()
        ctx.moveTo(num(f[1]), num(f[2]))
        ctx.lineTo(num(f[3]), num(f[4]))
        ctx.stroke()
        break
      }
      case 'a': {
        const sweep = num(f[7])
        if (!sweep) break
        const start = ((num(f[6]) - 90) * Math.PI) / 180
        ctx.strokeStyle = cssColor(f[4])
        ctx.lineWidth = num(f[5])
        ctx.lineCap = 'butt'
        ctx.beginPath()
        ctx.arc(num(f[1]), num(f[2]), num(f[3]), start, start + (sweep * Math.PI) / 180, sweep < 0)
        ctx.stroke()
        break
      }
      case 'g': {
        const x = num(f[1]), y = num(f[2]), w = num(f[3]), h = num(f[4])
        const vertical = f[6] === '1'
        const grad = ctx.createLinearGradient(x, y, vertical ? x : x + w, vertical ? y + h : y)
        const parts = (f[7] ?? '').split(';')
        let last = 0
        parts.forEach((p, i) => {
          const at = p.lastIndexOf('@')
          let pos = at >= 0 ? num(p.slice(at + 1)) : parts.length > 1 ? i / (parts.length - 1) : 0
          pos = Math.max(last, Math.min(1, Math.max(0, pos)))
          last = pos
          grad.addColorStop(pos, cssColor(at >= 0 ? p.slice(0, at) : p))
        })
        ctx.fillStyle = grad
        this.roundRect(x, y, w, h, num(f[5]))
        ctx.fill()
        break
      }
      case 'i': {
        const src = this.images(num(f[5]), f[6] ?? 'ffffffff')
        if (!src) break
        const x = num(f[1]), y = num(f[2]), w = num(f[3]), h = num(f[4])
        const radius = num(f[7])
        let sx = 0, sy = 0, sw = src.width, sh = src.height
        if (f[8]) {
          // uv 的 v 从下往上（Unity 贴图坐标）
          const [u, v, uw, vh] = f[8].split(',').map(num)
          sx = u * src.width
          sy = (1 - v - vh) * src.height
          sw = uw * src.width
          sh = vh * src.height
        }
        ctx.save()
        ctx.globalAlpha = parseColor(f[6] ?? 'ffffffff')[3]
        if (radius > 0) {
          this.roundRect(x, y, w, h, radius)
          ctx.clip()
        }
        ctx.drawImage(src.image, sx, sy, sw, sh, x, y, w, h)
        ctx.restore()
        break
      }
      case 't':
        this.text(f)
        break
    }
  }

  /** 文字：九宫格对齐（align 0..8），flags 1 粗体 2 阴影 4 换行 8 等宽，位 4..7 字重 */
  private text(f: string[]) {
    const text = f.length > 9 ? f.slice(9).join(FS) : ''
    if (!text) return
    const ctx = this.ctx
    const x = num(f[1]), y = num(f[2]), w = num(f[3]), h = num(f[4])
    const size = Math.max(1, num(f[6]))
    const align = Math.max(0, Math.min(8, Math.trunc(num(f[7]))))
    const flags = Math.trunc(num(f[8]))
    const font = fontOf(size, flags)
    const lines = flags & 4 && w > 0 ? wrapText(text, w, (s) => this.width(s, font)) : text.split('\n')
    const lineH = LINE_HEIGHT * size
    const col = align % 3, row = Math.floor(align / 3)
    const total = lines.length * lineH
    const top = row === 0 ? y : row === 1 ? y + (h - total) / 2 : y + h - total
    const ax = col === 0 ? x : col === 1 ? x + w / 2 : x + w
    ctx.font = font
    ctx.textAlign = col === 0 ? 'left' : col === 1 ? 'center' : 'right'
    ctx.textBaseline = 'middle'
    const draw = (color: string, dx: number, dy: number) => {
      ctx.fillStyle = color
      for (let i = 0; i < lines.length; i++) ctx.fillText(lines[i], ax + dx, top + (i + 0.5) * lineH + dy)
    }
    if (flags & 2) draw(`rgba(0,0,0,${+(parseColor(f[5])[3] * 0.75).toFixed(4)})`, 1, 1)
    draw(cssColor(f[5]), 0, 0)
  }
}
