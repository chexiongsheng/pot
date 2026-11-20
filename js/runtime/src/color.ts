/**
 * CSS 颜色解析（sRGB 0..1，非预乘）：#rgb #rgba #rrggbb #rrggbbaa、rgb()/rgba()、hsl()/hsla()（逗号或空格加 / alpha）、常用颜色名。
 * scene/ui 的 Color 字符串与 Canvas 的 fillStyle/strokeStyle 共用这一份。
 */
const NAMED: Record<string, string> = {
  transparent: '#00000000', black: '#000000', white: '#ffffff', red: '#ff0000', lime: '#00ff00', green: '#008000',
  blue: '#0000ff', yellow: '#ffff00', cyan: '#00ffff', aqua: '#00ffff', magenta: '#ff00ff', fuchsia: '#ff00ff',
  gray: '#808080', grey: '#808080', silver: '#c0c0c0', maroon: '#800000', olive: '#808000', navy: '#000080',
  purple: '#800080', teal: '#008080', orange: '#ffa500',
}

function clamp01(v: number) {
  return v < 0 ? 0 : v > 1 ? 1 : v
}

/** CSS 数值：r/g/b 为 0..255 或百分比，alpha 为 0..1 或百分比 */
function cssNumber(text: string, scale: number, source: string) {
  const s = text.trim()
  const v = s.endsWith('%') ? parseFloat(s) / 100 : parseFloat(s) / scale
  if (!/^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?%?$/i.test(s) || !Number.isFinite(v)) throw new TypeError(`无法解析颜色 "${source}"：分量 "${s}" 不是数字`)
  return clamp01(v)
}

function hue(text: string, source: string) {
  const m = /^([+-]?(?:\d+\.?\d*|\.\d+))(deg|turn|rad)?$/i.exec(text.trim())
  if (!m) throw new TypeError(`无法解析颜色 "${source}"：色相 "${text.trim()}" 不是角度`)
  const v = parseFloat(m[1])
  const unit = (m[2] ?? 'deg').toLowerCase()
  const deg = unit === 'turn' ? v * 360 : unit === 'rad' ? (v * 180) / Math.PI : v
  return ((deg % 360) + 360) % 360
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const k = (n: number) => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))
  return [f(0), f(8), f(4)]
}

/** 解析 CSS 颜色字符串（sRGB 0..1）：#rgb #rgba #rrggbb #rrggbbaa、rgb()/rgba()、hsl()/hsla()（逗号或空格加 / alpha）、常用颜色名 */
export function parseColorString(color: string): [number, number, number, number] {
  const source = color
  const text = color.trim().toLowerCase()
  if (text in NAMED) return parseColorString(NAMED[text])
  const hex = text.startsWith('#') ? text.slice(1) : /^[0-9a-f]{3,8}$/.test(text) ? text : null
  if (hex !== null) {
    if (!/^[0-9a-f]+$/.test(hex) || ![3, 4, 6, 8].includes(hex.length)) throw new TypeError(`无法解析颜色 "${source}"：十六进制应为 3、4、6 或 8 位`)
    const full = hex.length <= 4 ? hex.split('').map((c) => c + c).join('') : hex
    const n = parseInt(full.slice(0, 6), 16)
    const a = full.length === 8 ? parseInt(full.slice(6, 8), 16) / 255 : 1
    return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255, a]
  }
  const fn = /^(rgba?|hsla?)\(\s*(.*?)\s*\)$/.exec(text)
  if (fn) {
    const [body, alphaText] = fn[2].includes('/') ? fn[2].split('/') : [fn[2], undefined]
    const parts = body.includes(',') ? body.split(',') : body.trim().split(/\s+/)
    let alpha = alphaText
    if (alpha === undefined && parts.length === 4) alpha = parts.pop()
    if (parts.length !== 3) throw new TypeError(`无法解析颜色 "${source}"：需要 3 个分量（另可带 alpha）`)
    const a = alpha === undefined ? 1 : cssNumber(alpha, 1, source)
    if (fn[1].startsWith('rgb')) return [cssNumber(parts[0], 255, source), cssNumber(parts[1], 255, source), cssNumber(parts[2], 255, source), a]
    const pct = (p: string) => {
      if (!p.trim().endsWith('%') && !/^[+-]?[\d.]+$/.test(p.trim())) throw new TypeError(`无法解析颜色 "${source}"：饱和度与亮度应为百分比`)
      return clamp01(parseFloat(p) / 100)
    }
    const [r, g, b] = hslToRgb(hue(parts[0], source), pct(parts[1]), pct(parts[2]))
    return [r, g, b, a]
  }
  throw new TypeError(`无法解析颜色 "${source}"：支持 #rgb/#rgba/#rrggbb/#rrggbbaa、rgb()/rgba()、hsl()/hsla() 和常用颜色名`)
}

