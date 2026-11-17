/**
 * state 数据约束：只允许 JSON 兼容值 + TypedArray。
 * 深拷贝与 JSON 编解码自己实现，不依赖 structuredClone（裸 V8 不一定有）。
 */

const TYPED_ARRAYS: Record<string, any> = {
  Int8Array, Uint8Array, Uint8ClampedArray, Int16Array, Uint16Array,
  Int32Array, Uint32Array, Float32Array, Float64Array,
}

function typedName(value: any): string | undefined {
  if (!ArrayBuffer.isView(value) || value instanceof DataView) return
  const name = value.constructor?.name
  return name && TYPED_ARRAYS[name] ? name : undefined
}

function isPlainObject(value: any) {
  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

export class StateTypeError extends TypeError {
  name = 'StateTypeError'
  constructor(public path: string, public kind: string) {
    super(`state 中只能放可序列化数据，${path} 是 ${kind}。场景对象请存 id 或描述，生成结果请放 cache`)
  }
}

function describe(value: any): string {
  if (typeof value === 'function') return '函数'
  if (typeof value === 'number') return `非有限数字 ${value}`
  if (typeof value === 'bigint') return 'bigint'
  if (typeof value === 'symbol') return 'symbol'
  if (value === undefined) return 'undefined'
  if (value instanceof Promise) return 'Promise'
  if (value instanceof Map) return 'Map（请改用普通对象）'
  if (value instanceof Set) return 'Set（请改用数组）'
  const ctor = value?.constructor?.name
  return ctor ? `${ctor} 实例` : typeof value
}

/** 检查 value 是否可放进 state，不合规时抛 StateTypeError（带路径） */
export function assertSerializable(value: any, path = '$', seen = new Set<any>()): void {
  if (value === null) return
  switch (typeof value) {
    case 'string':
    case 'boolean':
      return
    case 'number':
      if (Number.isFinite(value)) return
      throw new StateTypeError(path, describe(value))
    case 'object':
      break
    default:
      throw new StateTypeError(path, describe(value))
  }
  if (typedName(value)) return
  if (seen.has(value)) throw new StateTypeError(path, '循环引用')
  seen.add(value)
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      // 稀疏数组的空位按 undefined 处理会报错，这里视为 null
      if (!(i in value)) continue
      assertSerializable(value[i], `${path}[${i}]`, seen)
    }
  } else if (isPlainObject(value)) {
    for (const key of Object.keys(value)) {
      const child = value[key]
      // 对象上值为 undefined 的属性在 JSON 中会被忽略，允许
      if (child === undefined) continue
      assertSerializable(child, `${path}.${key}`, seen)
    }
  } else {
    throw new StateTypeError(path, describe(value))
  }
  seen.delete(value)
}

export function deepClone<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value
  const typed = typedName(value)
  if (typed) return (value as any).slice()
  if (Array.isArray(value)) return value.map(deepClone) as any
  const result: any = {}
  for (const key of Object.keys(value as any)) {
    const child = (value as any)[key]
    if (child !== undefined) result[key] = deepClone(child)
  }
  return result
}

/** 编码为 JSON 安全结构：TypedArray → { $typed, data } */
export function encode(value: any): any {
  if (value === null || typeof value !== 'object') return value
  const typed = typedName(value)
  if (typed) return { $typed: typed, data: Array.from(value) }
  if (Array.isArray(value)) return value.map(encode)
  const result: any = {}
  for (const key of Object.keys(value)) {
    if (value[key] !== undefined) result[key] = encode(value[key])
  }
  return result
}

export function decode(value: any): any {
  if (value === null || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map(decode)
  if (typeof value.$typed === 'string' && Array.isArray(value.data) && TYPED_ARRAYS[value.$typed]) {
    return new TYPED_ARRAYS[value.$typed](value.data)
  }
  const result: any = {}
  for (const key of Object.keys(value)) result[key] = decode(value[key])
  return result
}

/** 粗略估算内存占用（字节），cache 预算用 */
export function estimateSize(value: any, depth = 0): number {
  if (value === null || value === undefined) return 8
  switch (typeof value) {
    case 'string': return 16 + value.length * 2
    case 'number': case 'boolean': return 8
    case 'object': break
    default: return 16
  }
  if (ArrayBuffer.isView(value)) return 64 + value.byteLength
  if (value instanceof ArrayBuffer) return 64 + value.byteLength
  if (depth > 8) return 64
  let size = 32
  if (Array.isArray(value)) {
    for (const item of value) size += estimateSize(item, depth + 1)
  } else {
    for (const key of Object.keys(value)) size += 16 + key.length * 2 + estimateSize(value[key], depth + 1)
  }
  return size
}

/** FNV-1a 32 位，用于 cache key 与内容 hash */
export function hash(...parts: any[]): string {
  const text = parts.map((p) => typeof p === 'string' ? p : JSON.stringify(encode(p))).join('\u0000')
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}
