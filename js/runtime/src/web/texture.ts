/**
 * Web 宿主的贴图表（004 第 20.3 节，web-2）：语义照 PotScene.Texture / DestroyTexture。
 * 只存像素数据与采样参数，不碰 WebGL；gl.ts 按对象身份惰性上传，界面的 i 命令经 texturePixels 取图。
 * 约定：RGBA8，行从下到上；id 从 1 开始且不复用（Clear 也不重置计数）。
 */

export interface WebTexture {
  id: number
  width: number
  height: number
  /** RGBA8，行从下到上（拷贝，调用方之后改原缓冲不影响） */
  data: Uint8Array
  /** false 表示颜色数据按 sRGB 解码 */
  linear: boolean
  mipmaps: boolean
  /** 0 重复，1 截断 */
  wrap: number
  /** 0 点，1 双线性，2 三线性 */
  filter: number
  /** 0..16 */
  aniso: number
}

function bytesOf(buf: ArrayBuffer | ArrayBufferView | null | undefined): Uint8Array | null {
  if (!buf) return null
  if (ArrayBuffer.isView(buf)) return new Uint8Array(buf.buffer as ArrayBuffer, buf.byteOffset, buf.byteLength)
  if (buf instanceof ArrayBuffer) return new Uint8Array(buf)
  return null
}

export class WebTextures {
  private map = new Map<number, WebTexture>()
  private next = 1
  /** 错误出口（宿主接到日志 error） */
  error: (text: string) => void = () => {}

  get(id: number): WebTexture | undefined {
    return id ? this.map.get(id) : undefined
  }

  get size(): number {
    return this.map.size
  }

  /** 返回贴图 id；参数非法返回 0 */
  create(data: ArrayBuffer | ArrayBufferView | null, width: number, height: number, linear: boolean, mipmaps: boolean,
    wrap: number, filter: number, aniso: number): number {
    const bytes = bytesOf(data)
    width = Math.trunc(width)
    height = Math.trunc(height)
    if (!bytes || width <= 0 || height <= 0) return 0
    const need = width * height * 4
    if (bytes.length < need) {
      this.error(`[pot] Texture 数据长度不足：${bytes.length} < ${need}`)
      return 0
    }
    const id = this.next++
    this.map.set(id, {
      id, width, height,
      data: bytes.slice(0, need),
      linear: !!linear,
      mipmaps: !!mipmaps,
      wrap: wrap === 1 ? 1 : 0,
      filter: filter === 0 ? 0 : filter === 1 ? 1 : 2,
      aniso: Math.max(0, Math.min(16, Math.trunc(aniso) || 0)),
    })
    return id
  }

  destroy(id: number): void {
    this.map.delete(id)
  }

  clear(): void {
    this.map.clear()
  }
}

/** 解析界面颜色 rrggbb[aa]，返回 0..1 的 RGB（只取 RGB，alpha 由调用方处理） */
function tintRgb(tint: string): [number, number, number] {
  const h = (tint || '').replace(/^#/, '')
  const c = (i: number) => {
    const v = parseInt(h.slice(i, i + 2), 16)
    return Number.isFinite(v) ? v / 255 : 1
  }
  return h.length >= 6 ? [c(0), c(2), c(4)] : [1, 1, 1]
}

/**
 * 界面绘图用的像素：行改成从上到下（canvas 约定），RGB 乘以 tint（sRGB 字节直接相乘，同 RawImage.color）。
 * 返回 Uint8ClampedArray，可直接构造 ImageData。
 */
export function texturePixels(tex: WebTexture, tint = 'ffffffff'): Uint8ClampedArray<ArrayBuffer> {
  const { width: w, height: h, data } = tex
  const out = new Uint8ClampedArray(w * h * 4)
  const [tr, tg, tb] = tintRgb(tint)
  const plain = tr === 1 && tg === 1 && tb === 1
  const row = w * 4
  for (let y = 0; y < h; y++) {
    const src = (h - 1 - y) * row
    const dst = y * row
    if (plain) {
      out.set(data.subarray(src, src + row), dst)
      continue
    }
    for (let x = 0; x < row; x += 4) {
      out[dst + x] = data[src + x] * tr
      out[dst + x + 1] = data[src + x + 1] * tg
      out[dst + x + 2] = data[src + x + 2] * tb
      out[dst + x + 3] = data[src + x + 3]
    }
  }
  return out
}
