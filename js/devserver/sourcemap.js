/**
 * 极简 sourcemap 解析（VLQ），把运行时报错栈中的 units/<name>.cjs:行:列 映射回 TS 源文件。
 * 不引第三方依赖。
 */
const path = require('path')

const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
const LOOKUP = Object.fromEntries([...BASE64].map((c, i) => [c, i]))

function decodeVLQ(segment) {
  const values = []
  let value = 0
  let shift = 0
  for (const char of segment) {
    const digit = LOOKUP[char]
    if (digit === undefined) throw new Error(`非法 VLQ 字符：${char}`)
    value += (digit & 31) << shift
    if (digit & 32) {
      shift += 5
    } else {
      values.push(value & 1 ? -(value >>> 1) : value >>> 1)
      value = 0
      shift = 0
    }
  }
  return values
}

/** 解析为 lines[生成行] = [{ col, source, line, column }]（均 0 基） */
function parseMappings(map) {
  const lines = []
  let source = 0, line = 0, column = 0
  for (const text of map.mappings.split(';')) {
    const segments = []
    let col = 0
    if (text) {
      for (const seg of text.split(',')) {
        const v = decodeVLQ(seg)
        col += v[0]
        if (v.length >= 4) {
          source += v[1]
          line += v[2]
          column += v[3]
          segments.push({ col, source, line, column })
        }
      }
    }
    lines.push(segments)
  }
  return lines
}

class SourceMapIndex {
  constructor() {
    /** units/x.cjs → { map, lines } */
    this.maps = new Map()
  }

  set(file, map) {
    this.maps.set(file, { map, lines: null })
  }

  clear() {
    this.maps.clear()
  }

  /** 1 基行、1 基列 → { source, line, column }（1 基）或 null */
  lookup(file, line, column) {
    const entry = this.maps.get(file)
    if (!entry) return null
    if (!entry.lines) entry.lines = parseMappings(entry.map)
    const segments = entry.lines[line - 1]
    if (!segments || !segments.length) return null
    let best = segments[0]
    for (const seg of segments) {
      if (seg.col <= column - 1) best = seg
      else break
    }
    return { source: entry.map.sources[best.source], line: best.line + 1, column: best.column + 1 }
  }

  /** 替换文本中所有 units/x.cjs:L:C；base 为显示用的相对路径基准 */
  mapText(text, base) {
    if (typeof text !== 'string' || !text.includes('units/')) return text
    return text.replace(/(units\/[\w.\-/]+\.cjs):(\d+):(\d+)/g, (all, file, l, c) => {
      const pos = this.lookup(file, +l, +c)
      if (!pos) return all
      const shown = base ? path.relative(base, pos.source).replace(/\\/g, '/') : pos.source
      return `${shown}:${pos.line}:${pos.column}`
    })
  }
}

module.exports = { decodeVLQ, parseMappings, SourceMapIndex }
