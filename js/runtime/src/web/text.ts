/**
 * Web 宿主的文字贴图（004 第 20.8 节 web-3）：textTexture 与 canvasText，语义照 PotRender.TextTexture / CanvasText。
 * 用 Canvas2D 画字（boot.ts 注入 2D 上下文工厂；Node 上没有工厂时 textTexture 返回 0、canvasText 返回 null）。
 * textTexture 的排版照 Unity 版：行高 1.2 倍字号，竖直居中（或给定 y，像素，左下为原点），
 * 基线 = 行顶 - 行高 + (行高 - 字号) / 2 + 0.2 倍字号；水平 align 0 左（留 0.25 倍字号）、1 中、2 右，或给定 x 为笔起点；
 * 每个字后加 letterSpacing。结果按 sRGB、带 mipmap、截断、三线性、各向异性 4 注册为贴图。
 */
import type { WebTextures } from './texture'

/** 本文件用到的 CanvasRenderingContext2D 子集（便于测试替身） */
export interface Text2DLike {
  readonly canvas: { width: number; height: number }
  font: string
  fillStyle: any
  textAlign: string
  textBaseline: string
  clearRect(x: number, y: number, w: number, h: number): void
  fillRect(x: number, y: number, w: number, h: number): void
  fillText(text: string, x: number, y: number): void
  measureText(text: string): {
    width: number
    actualBoundingBoxLeft?: number
    actualBoundingBoxRight?: number
    actualBoundingBoxAscent?: number
    actualBoundingBoxDescent?: number
    fontBoundingBoxAscent?: number
  }
  getImageData(x: number, y: number, w: number, h: number): { data: ArrayLike<number> }
}

export const TEXT_FONT_FAMILY = '"Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", sans-serif'

interface TextCfg {
  text: string
  width: number
  height: number
  size: number
  color: number[] | null
  background: number[] | null
  align: number
  bold: number
  x: number
  y: number
  letterSpacing: number
}

function num(v: any, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

/** sRGB 数组 [r,g,b(,a)] → CSS 颜色（超出 0 到 1 的截断） */
export function cssRgba(c: number[] | null | undefined, fallback: [number, number, number, number]): string {
  const a = c && c.length >= 3 ? [c[0], c[1], c[2], c.length > 3 ? c[3] : 1] : fallback
  const b = (v: number) => Math.round(clamp(num(v, 0), 0, 1) * 255)
  return `rgba(${b(a[0])},${b(a[1])},${b(a[2])},${clamp(num(a[3], 1), 0, 1)})`
}

/** "A,B C,serif" → CSS font-family 列表（带空格的名字加引号） */
export function cssFamilies(families: string): string {
  const list = (families || 'Microsoft YaHei,Arial').split(',').map((s) => s.trim()).filter(Boolean)
  const generic = new Set(['serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui'])
  return list.map((n) => (generic.has(n) ? n : `"${n.replace(/"/g, '')}"`)).join(', ') || 'sans-serif'
}

export class WebText {
  private ctx: Text2DLike | null | undefined

  constructor(private readonly textures: WebTextures, private readonly factory: (() => Text2DLike | null) | null = null) {}

  private context(w: number, h: number): Text2DLike | null {
    if (this.ctx === undefined) {
      try {
        this.ctx = this.factory ? this.factory() : null
      } catch {
        this.ctx = null
      }
    }
    const c = this.ctx
    if (!c) return null
    // 改尺寸会清空并重置状态；尺寸相同则手动清空
    if (c.canvas.width !== w || c.canvas.height !== h) {
      c.canvas.width = w
      c.canvas.height = h
    } else c.clearRect(0, 0, w, h)
    return c
  }

  /** 文字转贴图，返回贴图 id；没有 2D 上下文返回 0 */
  texture(json: string): number {
    let raw: any = {}
    try {
      raw = JSON.parse(json || '{}') ?? {}
    } catch {}
    const cfg: TextCfg = {
      text: typeof raw.text === 'string' ? raw.text : raw.text == null ? '' : String(raw.text),
      width: Math.trunc(num(raw.width, 256)),
      height: Math.trunc(num(raw.height, 64)),
      size: Math.trunc(num(raw.size, 48)),
      color: Array.isArray(raw.color) ? raw.color : null,
      background: Array.isArray(raw.background) ? raw.background : null,
      align: Math.trunc(num(raw.align, 1)),
      bold: Math.trunc(num(raw.bold, 0)),
      x: num(raw.x, NaN),
      y: num(raw.y, NaN),
      letterSpacing: num(raw.letterSpacing, 0),
    }
    const size = clamp(cfg.size, 4, 256)
    const w = clamp(cfg.width, 4, 4096)
    const h = clamp(cfg.height, 4, 4096)
    const ctx = this.context(w, h)
    if (!ctx) return 0
    const bg = cssRgba(cfg.background, [0, 0, 0, 0])
    if (!bg.endsWith(',0)')) {
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, w, h)
    }
    ctx.font = `${cfg.bold > 0 ? 'bold ' : ''}${size}px ${TEXT_FONT_FAMILY}`
    ctx.textAlign = 'left'
    ctx.textBaseline = 'alphabetic'
    ctx.fillStyle = cssRgba(cfg.color, [1, 1, 1, 1])
    const lines = cfg.text.split('\n')
    const lineH = size * 1.2
    const chars = lines.map((l) => Array.from(l))
    const widths = chars.map((cs) => cs.reduce((s, ch) => s + ctx.measureText(ch).width + cfg.letterSpacing, 0))
    const totalH = lineH * lines.length
    const top = Number.isFinite(cfg.y) ? cfg.y : (h + totalH) * 0.5
    for (let li = 0; li < lines.length; li++) {
      const baseline = top - (li + 1) * lineH + (lineH - size) * 0.5 + size * 0.2
      let pen = Number.isFinite(cfg.x) ? cfg.x
        : cfg.align === 0 ? size * 0.25 : cfg.align === 2 ? w - widths[li] - size * 0.25 : (w - widths[li]) * 0.5
      for (const ch of chars[li]) {
        ctx.fillText(ch, pen, h - baseline)
        pen += ctx.measureText(ch).width + cfg.letterSpacing
      }
    }
    const src = ctx.getImageData(0, 0, w, h).data
    // canvas 行从上到下，贴图约定行从下到上
    const out = new Uint8Array(w * h * 4)
    const row = w * 4
    for (let y = 0; y < h; y++) {
      const s = (h - 1 - y) * row
      for (let x = 0; x < row; x++) out[y * row + x] = src[s + x]
    }
    return this.textures.create(out, w, h, false, true, 1, 2, 4)
  }

  /**
   * 一行文字栅格化为 alpha 位图：Float32 头 [w, h, ox, base, advance, ascent, descent, 0] + w*h 字节 alpha（行从上到下）。
   * style 位 0 粗体、位 1 斜体。没有 2D 上下文返回 null。
   */
  canvasText(text: string, families: string, size: number, style: number): ArrayBuffer | null {
    text = (text ?? '').replace(/\n/g, ' ')
    size = clamp(Math.trunc(num(size, 16)), 1, 512)
    const font = `${style & 2 ? 'italic ' : ''}${style & 1 ? 'bold ' : ''}${size}px ${cssFamilies(families)}`
    const probe = this.context(1, 1)
    if (!probe) return null
    probe.font = font
    const m = probe.measureText(text)
    const pen = m.width
    const minX = -num(m.actualBoundingBoxLeft, 0)
    const maxX = num(m.actualBoundingBoxRight, pen)
    const maxY = num(m.actualBoundingBoxAscent, size * 0.8)
    const minY = -num(m.actualBoundingBoxDescent, size * 0.2)
    let ascent = num(m.fontBoundingBoxAscent, size * 0.8)
    if (ascent > size * 1.2 || ascent < size * 0.5) ascent = size * 0.8
    const descent = Math.max(size - ascent, size * 0.15)
    const any = text.trim().length > 0 && maxX > minX && maxY > minY
    const pad = 2
    let w = 0, h = 0, ox = 0, by = 0
    if (any) {
      ox = pad - Math.floor(minX)
      by = pad - Math.floor(minY)
      w = clamp(Math.ceil(maxX) + ox + pad, 1, 4096)
      h = clamp(Math.ceil(maxY) + by + pad, 1, 1024)
    }
    const buf = new ArrayBuffer(32 + w * h)
    new Float32Array(buf, 0, 8).set([w, h, ox, h - by, pen, ascent, descent, 0])
    if (!any) return buf
    const ctx = this.context(w, h)!
    ctx.font = font
    ctx.textAlign = 'left'
    ctx.textBaseline = 'alphabetic'
    ctx.fillStyle = '#fff'
    ctx.fillText(text, ox, h - by)
    const src = ctx.getImageData(0, 0, w, h).data
    const alpha = new Uint8Array(buf, 32, w * h)
    for (let i = 0; i < w * h; i++) alpha[i] = src[i * 4 + 3]
    return buf
  }
}
