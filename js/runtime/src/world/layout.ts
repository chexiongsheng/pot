/**
 * 积木布局（004 第 18.3 节）：TS 实现与原生实现之间的接口。
 *
 * 布局是一串按顺序排列的字段，每个字段占若干个 double 槽；规范字符串为
 *   <积木名>|<路径>:<类型>;<路径>:<类型>;...
 * 两边逐字比较。类型：f（数）、b（布尔）、f<n>（定长数组）、f?（可为 null 的数：有无、值）、
 * layers（碰撞层名数组或 null，换成位掩码）、axis / action（值是指令名，传本步的输入，只读）、
 * ?（可为 null 的对象的有无槽，子字段紧随其后，路径以它为前缀）。
 * 提示里以 @ 开头的键不是字段，而是写死名字的输入：'@move': 'axis' 传本步 move 轴（step 里直接写 w.cmd(e).axis('move') 的积木用）。
 *
 * 推导：先 props 后 state，各按声明顺序；数、布尔、数字数组、普通对象自动推出，其余靠 def.native 提示。
 * 每个实体的记录为 [id, pos×3, rot×3, 布局字段…]；缓冲区头部为 [数量, 每实体槽数, dt, tick]。
 */
import { isPlainObject } from './registry'
import type { BlockDef } from './registry'

/** def.native 的提示：类型字符串、{ '?': {...} }（可为 null 的对象）或按键给子字段的提示 */
export type NativeHint = string | { '?': Record<string, NativeHint> } | { [key: string]: NativeHint }

export interface LayoutField {
  /** 点分路径，如 stride.walk */
  path: string
  keys: string[]
  type: string
  slots: number
  /** 在实体记录里的偏移（含前 7 个槽） */
  offset: number
  /** 属于 state，解包时写回 */
  writable: boolean
  /** @ 开头的输入：指令名（不读字段） */
  input?: string
}

export interface Layout {
  block: string
  text: string
  fields: LayoutField[]
  /** 每个实体的槽数（含 id、pos、rot） */
  stride: number
}

export type LayoutResult = { ok: true; layout: Layout } | { ok: false; reason: string }

/** 每个实体记录前面的固定槽：id、pos×3、rot×3 */
export const ENTITY_HEAD = 7
/** 缓冲区头部：数量、每实体槽数、dt、tick */
export const BUFFER_HEAD = 4

const SIMPLE: Record<string, number> = { f: 1, b: 1, 'f?': 2, layers: 1, axis: 2, action: 2 }

function slotsOf(type: string): number {
  if (type in SIMPLE) return SIMPLE[type]
  const m = /^f([1-9][0-9]*)$/.exec(type)
  return m ? Number(m[1]) : 0
}

const isNullableGroup = (h: any): h is { '?': Record<string, NativeHint> } => isPlainObject(h) && Object.keys(h).length === 1 && isPlainObject(h['?'])

const cache = new WeakMap<object, LayoutResult>()

/** 由积木定义推出布局（按定义对象缓存） */
export function deriveLayout(def: BlockDef): LayoutResult {
  const hit = cache.get(def)
  if (hit) return hit
  const result = derive(def)
  cache.set(def, result)
  return result
}

function derive(def: BlockDef): LayoutResult {
  const fields: Omit<LayoutField, 'offset'>[] = []
  const hints = (def as any).native as Record<string, NativeHint> | undefined
  if (hints !== undefined && !isPlainObject(hints)) return { ok: false, reason: 'native 提示必须是普通对象' }
  const known = new Set([...Object.keys(def.props ?? {}), ...Object.keys(def.state ?? {})])
  for (const key of Object.keys(hints ?? {})) {
    if (key.startsWith('@')) {
      const type = hints![key]
      if (type !== 'axis' && type !== 'action') return { ok: false, reason: `native 提示里的 ${key} 是输入，类型只能是 axis 或 action` }
      if (!/^@[A-Za-z][A-Za-z0-9]*$/.test(key)) return { ok: false, reason: `native 提示里的 ${key} 不是合法的指令名` }
      fields.push({ path: key, keys: [], type, slots: 2, writable: false, input: key.slice(1) })
      continue
    }
    if (!known.has(key)) return { ok: false, reason: `native 提示里的 ${key} 不是 props 或 state 的字段` }
  }

  const add = (keys: string[], value: any, hint: NativeHint | undefined, writable: boolean): string | null => {
    const path = keys.join('.')
    if (typeof hint === 'string') {
      const slots = slotsOf(hint)
      if (!slots || hint === '?') return `${path} 的提示 ${JSON.stringify(hint)} 不是已知类型（f、b、f<n>、f?、layers、axis、action）`
      if ((hint === 'axis' || hint === 'action') && typeof value !== 'string') return `${path} 标为 ${hint}，缺省值应是指令名字符串`
      if (hint === 'layers' && value !== null && !(Array.isArray(value) && value.every((v) => typeof v === 'string'))) return `${path} 标为 layers，缺省值应是字符串数组或 null`
      if ((hint === 'axis' || hint === 'action') && writable) return `${path} 是 state，不能标为 ${hint}（输入只读）`
      fields.push({ path, keys, type: hint, slots, writable })
      return null
    }
    if (hint !== undefined && isNullableGroup(hint)) {
      if (value !== null && !isPlainObject(value)) return `${path} 标为可为 null 的对象，缺省值应是对象或 null`
      fields.push({ path, keys, type: '?', slots: 1, writable })
      for (const sub of Object.keys(hint['?'])) {
        const err = add([...keys, sub], value?.[sub] ?? null, hint['?'][sub], writable)
        if (err) return err
      }
      return null
    }
    if (typeof value === 'number') { fields.push({ path, keys, type: 'f', slots: 1, writable }); return null }
    if (typeof value === 'boolean') { fields.push({ path, keys, type: 'b', slots: 1, writable }); return null }
    if (Array.isArray(value)) {
      if (value.length && value.every((v) => typeof v === 'number')) { fields.push({ path, keys, type: `f${value.length}`, slots: value.length, writable }); return null }
      return `${path} 的缺省值是${value.length ? '非数字' : '空'}数组，需要在 native 里给出类型`
    }
    if (isPlainObject(value)) {
      if (hint !== undefined && !isPlainObject(hint)) return `${path} 的提示应是对象`
      for (const sub of Object.keys(value)) {
        const err = add([...keys, sub], value[sub], (hint as any)?.[sub], writable)
        if (err) return err
      }
      return null
    }
    return `${path} 的缺省值是 ${value === null ? 'null' : typeof value}，需要在 native 里给出类型`
  }

  for (const [group, writable] of [[def.props ?? {}, false], [def.state ?? {}, true]] as const) {
    for (const key of Object.keys(group)) {
      const err = add([key], (group as any)[key], hints?.[key], writable)
      if (err) return { ok: false, reason: err }
    }
  }
  let offset = ENTITY_HEAD
  const laid = fields.map((f) => {
    const out = { ...f, offset }
    offset += f.slots
    return out
  })
  const text = `${def.name}|${laid.map((f) => `${f.path}:${f.type}`).join(';')}`
  return { ok: true, layout: { block: def.name, text, fields: laid, stride: offset } }
}

/** 打包时需要的 World 能力 */
export interface PackEnv {
  cmd(e: any): { axis(name: string): { x: number; y: number }; down(name: string): boolean; pressed(name: string): boolean }
  /** 层名数组（null 为全部）换成位掩码 */
  layerMask(names: string[] | null): number
}

const ALL_LAYERS = 0xffffffff

function read(me: any, keys: string[]) {
  let v = me
  for (const k of keys) {
    if (v === null || v === undefined) return undefined
    v = v[k]
  }
  return v
}

function write(me: any, keys: string[], value: any) {
  let o = me
  for (let i = 0; i < keys.length - 1; i++) {
    if (!isPlainObject(o[keys[i]])) o[keys[i]] = {}
    o = o[keys[i]]
  }
  o[keys[keys.length - 1]] = value
}

/** 把一个实体写进缓冲区的 o 处 */
export function packEntity(layout: Layout, e: any, me: any, env: PackEnv, buf: Float64Array, o: number) {
  buf[o] = e.id
  buf[o + 1] = e.pos[0]; buf[o + 2] = e.pos[1]; buf[o + 3] = e.pos[2]
  buf[o + 4] = e.rot[0]; buf[o + 5] = e.rot[1]; buf[o + 6] = e.rot[2]
  let absent: string | null = null
  for (const f of layout.fields) {
    const at = o + f.offset
    if (absent !== null && f.path.startsWith(absent)) { for (let i = 0; i < f.slots; i++) buf[at + i] = 0; continue }
    absent = null
    const v = f.input !== undefined ? f.input : read(me, f.keys)
    switch (f.type) {
      case 'f': buf[at] = typeof v === 'number' ? v : NaN; break
      case 'b': buf[at] = v ? 1 : 0; break
      case 'f?': buf[at] = typeof v === 'number' ? 1 : 0; buf[at + 1] = typeof v === 'number' ? v : 0; break
      case 'layers': buf[at] = Array.isArray(v) ? env.layerMask(v) : ALL_LAYERS; break
      case 'axis': { const a = env.cmd(e).axis(String(v)); buf[at] = a.x; buf[at + 1] = a.y; break }
      case 'action': { const c = env.cmd(e); buf[at] = c.down(String(v)) ? 1 : 0; buf[at + 1] = c.pressed(String(v)) ? 1 : 0; break }
      case '?': buf[at] = isPlainObject(v) ? 1 : 0; if (!isPlainObject(v)) absent = f.path + '.'; break
      default: for (let i = 0; i < f.slots; i++) buf[at + i] = Array.isArray(v) && typeof v[i] === 'number' ? v[i] : NaN
    }
  }
}

/** 把缓冲区 o 处的结果写回实体：pos、rot 与 state 字段 */
export function unpackEntity(layout: Layout, e: any, me: any, buf: Float64Array, o: number) {
  e.pos[0] = buf[o + 1]; e.pos[1] = buf[o + 2]; e.pos[2] = buf[o + 3]
  e.rot[0] = buf[o + 4]; e.rot[1] = buf[o + 5]; e.rot[2] = buf[o + 6]
  let absent: string | null = null
  for (const f of layout.fields) {
    if (!f.writable) continue
    if (absent !== null && f.path.startsWith(absent)) continue
    absent = null
    const at = o + f.offset
    switch (f.type) {
      case 'f': write(me, f.keys, buf[at]); break
      case 'b': write(me, f.keys, buf[at] !== 0); break
      case 'f?': write(me, f.keys, buf[at] !== 0 ? buf[at + 1] : null); break
      case '?':
        if (buf[at] === 0) { write(me, f.keys, null); absent = f.path + '.' }
        else if (!isPlainObject(read(me, f.keys))) write(me, f.keys, {})
        break
      case 'layers': case 'axis': case 'action': break
      default: {
        const cur = read(me, f.keys)
        const arr = Array.isArray(cur) && cur.length === f.slots ? cur : new Array(f.slots)
        for (let i = 0; i < f.slots; i++) arr[i] = buf[at + i]
        if (arr !== cur) write(me, f.keys, arr)
      }
    }
  }
}

/** 一批实体打包成缓冲区（复用 buf，不够大时新建） */
export function packBatch(layout: Layout, list: { e: any; me: any }[], env: PackEnv, dt: number, tick: number, buf?: Float64Array): Float64Array {
  const size = BUFFER_HEAD + list.length * layout.stride
  const out = buf && buf.length === size ? buf : new Float64Array(size)
  out[0] = list.length
  out[1] = layout.stride
  out[2] = dt
  out[3] = tick
  const { pack } = compileLayout(layout)
  for (let i = 0; i < list.length; i++) pack(list[i].e, list[i].me, env, out, BUFFER_HEAD + i * layout.stride)
  return out
}

/** 把结果缓冲区写回；长度或格式不对时抛错 */
export function unpackBatch(layout: Layout, list: { e: any; me: any }[], buf: Float64Array) {
  if (buf.length !== BUFFER_HEAD + list.length * layout.stride || buf[0] !== list.length || buf[1] !== layout.stride) {
    throw new Error(`原生实现返回的缓冲区格式不对（长度 ${buf.length}，应为 ${BUFFER_HEAD + list.length * layout.stride}）`)
  }
  for (let i = 0; i < list.length; i++) {
    const o = BUFFER_HEAD + i * layout.stride
    if (buf[o] !== list[i].e.id) throw new Error(`原生实现返回的第 ${i} 个实体 id 不符（${buf[o]}，应为 ${list[i].e.id}）`)
  }
  const { unpack } = compileLayout(layout)
  for (let i = 0; i < list.length; i++) unpack(list[i].e, list[i].me, buf, BUFFER_HEAD + i * layout.stride)
}

// ---------------------------------------------------------------- 代码生成（18.14 第 7 步）

type PackFn = (e: any, me: any, env: PackEnv, buf: Float64Array, o: number) => void
type UnpackFn = (e: any, me: any, buf: Float64Array, o: number) => void

const compiled = new WeakMap<Layout, { pack: PackFn; unpack: UnpackFn }>()

/** 属性访问表达式：me.a.b 写成逐级判空，避免中间是 null 时抛错 */
function access(keys: string[]): string {
  let expr = 'me'
  for (const k of keys) expr = `(${expr} == null ? undefined : ${expr}[${JSON.stringify(k)}])`
  return expr
}

/**
 * 按布局生成专用的打包、解包函数（与 packEntity、unpackEntity 结果逐位相同，测试里比对）。
 * 通用版每个字段都要按路径逐级取值、按类型字符串分支，1000 个实体、54 个字段时每步约 1.3 ms；生成的版本把这些都展开。
 * 生成失败（宿主不允许 new Function）时退回通用版。
 */
export function compileLayout(layout: Layout): { pack: PackFn; unpack: UnpackFn } {
  const hit = compiled.get(layout)
  if (hit) return hit
  let result: { pack: PackFn; unpack: UnpackFn }
  try {
    result = { pack: compilePack(layout), unpack: compileUnpack(layout) }
  } catch {
    result = { pack: (e, me, env, buf, o) => packEntity(layout, e, me, env, buf, o), unpack: (e, me, buf, o) => unpackEntity(layout, e, me, buf, o) }
  }
  compiled.set(layout, result)
  return result
}

function compilePack(layout: Layout): PackFn {
  const lines: string[] = [
    'buf[o] = e.id',
    'const p = e.pos, r = e.rot',
    'buf[o + 1] = p[0]; buf[o + 2] = p[1]; buf[o + 3] = p[2]',
    'buf[o + 4] = r[0]; buf[o + 5] = r[1]; buf[o + 6] = r[2]',
    'let c = null',
  ]
  /** 外层可为 null 的对象：[路径前缀, 条件变量] */
  const groups: [string, string][] = []
  let n = 0
  for (const f of layout.fields) {
    while (groups.length && !f.path.startsWith(groups[groups.length - 1][0])) groups.pop()
    const cond = groups.map((g) => g[1]).join(' && ')
    const at = `o + ${f.offset}`
    const v = `v${n++}`
    const zeros = Array.from({ length: f.slots }, (_, i) => `buf[${at} + ${i}] = 0`).join('; ')
    const body: string[] = []
    if (f.input !== undefined) body.push(`const ${v} = ${JSON.stringify(f.input)}`)
    else body.push(`const ${v} = ${access(f.keys)}`)
    switch (f.type) {
      case 'f': body.push(`buf[${at}] = typeof ${v} === 'number' ? ${v} : NaN`); break
      case 'b': body.push(`buf[${at}] = ${v} ? 1 : 0`); break
      case 'f?': body.push(`if (typeof ${v} === 'number') { buf[${at}] = 1; buf[${at} + 1] = ${v} } else { buf[${at}] = 0; buf[${at} + 1] = 0 }`); break
      case 'layers': body.push(`buf[${at}] = Array.isArray(${v}) ? env.layerMask(${v}) : 4294967295`); break
      case 'axis': body.push(`if (!c) c = env.cmd(e)`, `const a${n} = c.axis(String(${v}))`, `buf[${at}] = a${n}.x; buf[${at} + 1] = a${n}.y`); break
      case 'action': body.push(`if (!c) c = env.cmd(e)`, `buf[${at}] = c.down(String(${v})) ? 1 : 0; buf[${at} + 1] = c.pressed(String(${v})) ? 1 : 0`); break
      case '?': {
        const ok = `g${n}`
        lines.push(`let ${ok} = false`)
        body.push(`${ok} = isPlainObject(${v})`, `buf[${at}] = ${ok} ? 1 : 0`)
        groups.push([f.path + '.', ok])
        break
      }
      default: {
        const parts: string[] = []
        for (let i = 0; i < f.slots; i++) parts.push(`buf[${at} + ${i}] = arr && typeof ${v}[${i}] === 'number' ? ${v}[${i}] : NaN`)
        body.push(`{ const arr = Array.isArray(${v}); ${parts.join('; ')} }`)
      }
    }
    if (cond) lines.push(`if (${cond}) { ${body.join('; ')} } else { ${zeros} }`)
    else lines.push(`{ ${body.join('; ')} }`)
  }
  // eslint-disable-next-line no-new-func
  return new Function('isPlainObject', `return function pack(e, me, env, buf, o) {\n${lines.join('\n')}\n}`)(isPlainObject) as PackFn
}

function compileUnpack(layout: Layout): UnpackFn {
  const writable = layout.fields.filter((f) => f.writable)
  // 状态里有可为 null 的对象或嵌套路径时用通用版（实际的积木都没有）
  if (writable.some((f) => f.type === '?' || f.keys.length !== 1)) return (e, me, buf, o) => unpackEntity(layout, e, me, buf, o)
  const lines: string[] = [
    'const p = e.pos, r = e.rot',
    'p[0] = buf[o + 1]; p[1] = buf[o + 2]; p[2] = buf[o + 3]',
    'r[0] = buf[o + 4]; r[1] = buf[o + 5]; r[2] = buf[o + 6]',
  ]
  for (const f of writable) {
    const at = `o + ${f.offset}`
    const key = JSON.stringify(f.keys[0])
    switch (f.type) {
      case 'f': lines.push(`me[${key}] = buf[${at}]`); break
      case 'b': lines.push(`me[${key}] = buf[${at}] !== 0`); break
      case 'f?': lines.push(`me[${key}] = buf[${at}] !== 0 ? buf[${at} + 1] : null`); break
      case 'layers': case 'axis': case 'action': break
      default: {
        const sets = Array.from({ length: f.slots }, (_, i) => `t[${i}] = buf[${at} + ${i}]`).join('; ')
        lines.push(`{ let t = me[${key}]; if (!Array.isArray(t) || t.length !== ${f.slots}) { t = new Array(${f.slots}); me[${key}] = t } ${sets} }`)
      }
    }
  }
  // eslint-disable-next-line no-new-func
  return new Function(`return function unpack(e, me, buf, o) {\n${lines.join('\n')}\n}`)() as UnpackFn
}
