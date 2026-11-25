/**
 * 开发工具用的 World 检视（004 第 16.6、16.7 节）：树视图、覆盖层与运行期补丁的叠加。
 * 都是纯函数，Node 上可单测。
 */
import type { SourcePos } from './node'
import { Registry, clone, isPlainObject, merge } from './registry'
import type { EntitySpec, TreeResult } from './tree'
import { similar } from './tree'

const where = (s?: SourcePos) => (s ? `${s.file}:${s.line}` : undefined)

function plain(value: any, depth = 0): any {
  if (typeof value === 'function') return '[function]'
  if (depth > 8) return '…'
  if (Array.isArray(value)) return value.map((v) => plain(v, depth + 1))
  if (isPlainObject(value)) {
    const out: any = {}
    for (const key of Object.keys(value)) out[key] = plain(value[key], depth + 1)
    return out
  }
  if (value && typeof value === 'object') return Object.prototype.toString.call(value)
  return value
}

/** 一次挂载的树视图：实体、规则、stage 各一条，带 key 路径与源位置 */
export function treeView(result: TreeResult) {
  return {
    entities: result.entities.map((e) => ({
      path: e.path, prefab: e.prefab, at: e.at, rot: e.rot, scale: e.scale,
      ...(e.name !== undefined ? { name: e.name } : {}),
      tags: e.tags, blocks: plain(e.blocks), source: where(e.source),
    })),
    rules: result.rules.map((r) => ({ path: r.path, on: r.on, a: r.a, b: r.b, seconds: r.seconds, do: '[function]', source: where(r.source) })),
    stage: result.stage ? { ...plain({ ...result.stage, source: undefined }), source: where(result.stage.source) } : null,
  }
}

const isVec3 = (v: any) => Array.isArray(v) && v.length === 3 && v.every((n) => typeof n === 'number' && Number.isFinite(n))

/** 合并两层补丁（覆盖层在下、运行期补丁在上）：同一路径的补丁深合并 */
export function mergePatches(...layers: (Record<string, any> | undefined)[]): Record<string, any> | undefined {
  let out: Record<string, any> | undefined
  for (const layer of layers) {
    if (!layer) continue
    out ??= {}
    for (const path of Object.keys(layer)) out[path] = out[path] ? merge(out[path], layer[path]) : clone(layer[path])
  }
  return out
}

/**
 * 把补丁叠到实体描述上（返回新数组，不改参数）。写法与标签属性相同：
 * at、rot、scale、name、tags 整体替换；积木名对应的对象按字段合并，true 为加上（缺省值），false / null 去掉。
 * 对不上的路径与非法的字段交给 warn。
 */
export function applyPatches(specs: EntitySpec[], patches: Record<string, any>, registry: Registry, warn: (message: string) => void): EntitySpec[] {
  const byPath = new Map(specs.map((s) => [s.path, s]))
  for (const path of Object.keys(patches)) {
    if (!byPath.has(path)) warn(`补丁的路径 "${path}" 在这次挂载里不存在${similar(path, [...byPath.keys()])}`)
  }
  return specs.map((spec) => {
    const patch = patches[spec.path]
    if (!patch) return spec
    if (!isPlainObject(patch)) {
      warn(`补丁 "${spec.path}" 必须是对象`)
      return spec
    }
    const out: EntitySpec = { ...spec, blocks: { ...spec.blocks } }
    for (const key of Object.keys(patch)) {
      const value = patch[key]
      const bad = (what: string) => warn(`补丁 "${spec.path}" 的 ${key} ${what}`)
      switch (key) {
        case 'at':
        case 'rot':
          if (isVec3(value)) out[key] = [value[0], value[1], value[2]]
          else bad('必须是 [x, y, z]')
          continue
        case 'scale':
          if (typeof value === 'number' && Number.isFinite(value)) out.scale = [value, value, value]
          else if (isVec3(value)) out.scale = [value[0], value[1], value[2]]
          else bad('必须是数或 [x, y, z]')
          continue
        case 'name':
          if (typeof value === 'string') out.name = value
          else bad('必须是字符串')
          continue
        case 'tags':
          if (Array.isArray(value) && value.every((t) => typeof t === 'string')) out.tags = [...value]
          else bad('必须是字符串数组')
          continue
      }
      const block = registry.block(key)
      if (!block) {
        warn(`补丁 "${spec.path}" 里未知的积木 ${key}${similar(key, registry.blockNames())}`)
        continue
      }
      if (value === false || value === null) {
        delete out.blocks[key]
        continue
      }
      const over = value === true ? {} : value
      if (!isPlainObject(over)) {
        bad('必须是对象、true 或 false')
        continue
      }
      const fields = block.props ?? {}
      const valid: Record<string, any> = {}
      for (const field of Object.keys(over)) {
        if (field in fields) valid[field] = over[field]
        else warn(`补丁 "${spec.path}" 的积木 ${key} 没有字段 ${field}${similar(field, Object.keys(fields))}`)
      }
      out.blocks[key] = merge(out.blocks[key] ?? clone(fields), valid)
    }
    return out
  })
}

// ---------------------------------------------------------------- 类型生成（16.9）

const IDENT = /^[A-Za-z_$][A-Za-z0-9_$]*$/

/** 由缺省值推出 TS 类型：数、字符串、布尔照搬；三个数的数组为 Vec3；普通对象递归；null 为 any */
export function typeOfValue(value: unknown, depth = 0): string {
  if (value === null || value === undefined) return 'any'
  if (typeof value === 'number') return 'number'
  if (typeof value === 'string') return 'string'
  if (typeof value === 'boolean') return 'boolean'
  if (depth > 6) return 'any'
  if (Array.isArray(value)) {
    if (value.length === 3 && value.every((n) => typeof n === 'number')) return 'Vec3'
    if (!value.length) return 'any[]'
    const types = [...new Set(value.map((v) => typeOfValue(v, depth + 1)))]
    return types.length === 1 ? `${types[0]}[]` : `(${types.join(' | ')})[]`
  }
  if (isPlainObject(value)) {
    const keys = Object.keys(value)
    if (!keys.length) return 'Record<string, any>'
    return `{ ${keys.map((k) => `${IDENT.test(k) ? k : JSON.stringify(k)}: ${typeOfValue((value as any)[k], depth + 1)}`).join('; ')} }`
  }
  return 'any'
}

/** .pot/types.d.ts 的内容：游戏自写积木的属性覆盖、vars 的类型 */
export function generateTypes(blocks: { name: string; props?: Record<string, any> }[], vars: Record<string, any>) {
  const lines = ['// 由 pot check / pot types 生成，不要手改', "import type { Over, Vec3 } from '@pot/core'", '', "declare module '@pot/core' {", '  interface GameBlockProps {']
  for (const b of blocks) lines.push(`    ${b.name}?: Over<${typeOfValue(b.props ?? {})}>`)
  lines.push('  }', '  interface GameVars {')
  for (const key of Object.keys(vars)) lines.push(`    ${IDENT.test(key) ? key : JSON.stringify(key)}: ${typeOfValue(vars[key])}`)
  lines.push('  }', '}', '', 'export {}', '')
  return lines.join('\n')
}

// ---------------------------------------------------------------- World 哈希（16.10）

function canonical(value: any): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`
  if (typeof value === 'number') return Number.isFinite(value) ? String(Math.round(value * 1e6) / 1e6) : 'null'
  return JSON.stringify(value ?? null)
}

/** World 数据（去掉 contacts）规范化 JSON 的 FNV-1a 32 位值，十六进制；数保留 6 位小数 */
export function worldHash(data: Record<string, any>) {
  const { contacts: _c, ...rest } = data
  const text = canonical(rest)
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(16).padStart(8, '0')
}
