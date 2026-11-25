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
  for (let i = 0; i < list.length; i++) packEntity(layout, list[i].e, list[i].me, env, out, BUFFER_HEAD + i * layout.stride)
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
  for (let i = 0; i < list.length; i++) unpackEntity(layout, list[i].e, list[i].me, buf, BUFFER_HEAD + i * layout.stride)
}
