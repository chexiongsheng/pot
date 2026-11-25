/**
 * 场景树求值（纯函数，Node 上可单测）：展开片段与函数组件、解析预制件、算 key 路径、校验，
 * 输出扁平的实体描述表、规则表与 stage。见 004 第 15.4 节。
 */
import { Fragment, isNode, isPrefab, nodeName, sourcePrefix } from './node'
import type { PotChild, PotNode, Prefab, SourcePos } from './node'
import { PREFAB_RESERVED, RESERVED, Registry, clone, isPlainObject, merge } from './registry'
import type { Vec3 } from '../host'
import { UI_TAG_NAMES } from './ui-tags'

export interface EntitySpec {
  path: string
  /** 预制件名 */
  prefab: string
  at: Vec3
  /** 欧拉角（度） */
  rot: Vec3
  scale: Vec3
  name?: string
  /** 预制件链上的 tags 与标签上的合并去重 */
  tags: string[]
  /** 积木名到属性（已含积木 props 默认值） */
  blocks: Record<string, Record<string, any>>
  source?: SourcePos
}

export interface RuleSpec {
  path: string
  on: string
  a?: string
  b?: string
  seconds?: number
  do: (...args: any[]) => any
  source?: SourcePos
}

export interface StageSpec {
  background?: any
  sun?: any
  camera?: { at?: Vec3; look?: Vec3 }
  source?: SourcePos
}

export interface TreeResult {
  entities: EntitySpec[]
  rules: RuleSpec[]
  stage: StageSpec | null
  /** 以大写标签直接引用的预制件（挂载时自动登记） */
  prefabs: Prefab[]
  /** 告警（不影响求值）：列表里的节点缺 key */
  warnings: string[]
}

const BUILTIN_TAGS = ['rule', 'stage']
const EVENT = /^[A-Za-z_$][A-Za-z0-9_$]*$/
const BUILTIN_EVENTS = ['touch', 'death', 'every']

interface Layer {
  prefix: string
  counts: Map<string, number>
  /** 最近的带源位置的祖先，给文本等没有位置的子节点报错用 */
  source?: SourcePos
}

/** 编辑距离（短字符串用，提示相近名字） */
function distance(a: string, b: string) {
  const dp = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0]
    dp[0] = i
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j]
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1].toLowerCase() === b[j - 1].toLowerCase() ? 0 : 1))
      prev = tmp
    }
  }
  return dp[b.length]
}

export function similar(name: string, candidates: string[]) {
  const limit = name.length <= 4 ? 1 : 2
  const list = candidates
    .map((c) => ({ c, d: distance(name, c) }))
    .filter(({ c, d }) => d <= limit || c.toLowerCase().startsWith(name.toLowerCase()) || name.toLowerCase().startsWith(c.toLowerCase()))
    .sort((x, y) => x.d - y.d)
    .slice(0, 3)
    .map(({ c }) => c)
  return list.length ? `，是不是 ${list.join('、')}？` : ''
}

function isVec3(v: any): v is Vec3 {
  return Array.isArray(v) && v.length === 3 && v.every((n) => typeof n === 'number' && Number.isFinite(n))
}

function flatChildren(children: any): any[] {
  const out: any[] = []
  const walk = (c: any) => {
    if (Array.isArray(c)) c.forEach(walk)
    else if (c !== null && c !== undefined && c !== false && c !== true && c !== '') out.push(c)
  }
  walk(children)
  return out
}

export function evaluate(root: PotChild, registry: Registry): TreeResult {
  const result: TreeResult = { entities: [], rules: [], stage: null, prefabs: [], warnings: [] }
  const errors: string[] = []
  const paths = new Map<string, SourcePos | undefined>()
  const usedPrefabs = new Set<Prefab>()

  const segment = (layer: Layer, name: string, key: string | null) => {
    if (key !== null) return `${name}:${key}`
    const n = layer.counts.get(name) ?? 0
    layer.counts.set(name, n + 1)
    return `${name}#${n}`
  }
  const join = (layer: Layer, seg: string) => (layer.prefix ? `${layer.prefix}/${seg}` : seg)

  const claim = (path: string, node: PotNode) => {
    if (paths.has(path)) {
      const first = paths.get(path)
      errors.push(`${sourcePrefix(node.source)}重复的 key 路径 "${path}"${first ? `（第一次出现在 ${first.file}:${first.line}）` : ''}：同一层的同名标签请用不同的 key 区分，或包一层带 key 的片段`)
      return false
    }
    paths.set(path, node.source)
    return true
  }

  /** 子节点：静态写出的子节点数组（jsxs）里的元素不算列表，其余数组（map 的结果）是列表，列表里的节点要写 key */
  const children = (value: any, layer: Layer, depth: number, isStatic: boolean) => {
    if (Array.isArray(value)) for (const c of value) visit(c, layer, depth + 1, !isStatic)
    else visit(value, layer, depth + 1, false)
  }

  const visit = (child: any, layer: Layer, depth: number, dynamic = false) => {
    if (child === null || child === undefined || child === true || child === false || child === '') return
    if (depth > 64) {
      errors.push('场景树嵌套超过 64 层，可能是函数组件递归')
      return
    }
    if (Array.isArray(child)) {
      for (const c of child) visit(c, layer, depth + 1, true)
      return
    }
    if (typeof child === 'string' || typeof child === 'number') {
      errors.push(`${sourcePrefix(layer.source)}场景树里不能有文本：${JSON.stringify(child)}`)
      return
    }
    if (!isNode(child)) {
      errors.push(`${sourcePrefix(layer.source)}场景树里不能有 ${Object.prototype.toString.call(child)}，只能是标签、数组或 null`)
      return
    }
    const node = child as PotNode
    const type = node.type
    if (dynamic && node.key === null && type !== 'rule' && type !== 'stage') {
      result.warnings.push(`${sourcePrefix(node.source)}列表里的 <${nodeName(node)}> 缺少 key：增删元素后实体身份会错位（序号 key 只适合静态布置）`)
    }
    const isStatic = !!(node as any).static
    if (type === Fragment) {
      if (node.key === null) children(node.props.children, { ...layer, source: node.source }, depth, isStatic)
      else {
        const prefix = join(layer, `#${node.key}`)
        children(node.props.children, { prefix, counts: new Map(), source: node.source }, depth, isStatic)
      }
      return
    }
    if (typeof type === 'function' && !isPrefab(type)) {
      const name = nodeName(node)
      const prefix = join(layer, segment(layer, name, node.key))
      let out: PotChild
      try {
        out = (type as any)(node.props)
      } catch (error: any) {
        errors.push(`${sourcePrefix(node.source)}函数组件 ${name} 出错：${error?.message ?? error}`)
        return
      }
      children(out, { prefix, counts: new Map(), source: node.source }, depth, true)
      return
    }
    if (type === 'rule') return rule(node, layer)
    if (type === 'stage') return stage(node)
    let prefab: Prefab | undefined
    if (isPrefab(type)) {
      prefab = type
      if (!usedPrefabs.has(type)) {
        usedPrefabs.add(type)
        result.prefabs.push(type)
      }
    } else if (typeof type === 'string') {
      prefab = registry.prefab(type)
      if (!prefab) {
        if (UI_TAG_NAMES.includes(type)) errors.push(`${sourcePrefix(node.source)}<${type}> 是界面标签，放错了树：界面写在 ui 里，scene 里只能用实体标签、rule、stage`)
        else errors.push(`${sourcePrefix(node.source)}未知的标签 <${type}>${similar(type, [...registry.prefabNames(), ...BUILTIN_TAGS])}`)
        return
      }
    } else {
      errors.push(`${sourcePrefix(node.source)}无法识别的标签类型`)
      return
    }
    const path = join(layer, segment(layer, prefab.prefab, node.key))
    if (!claim(path, node)) return
    const spec = entity(node, prefab, path)
    if (spec) result.entities.push(spec)
  }

  const chainOf = (prefab: Prefab, node: PotNode): Prefab[] | null => {
    const chain: Prefab[] = []
    let current: Prefab | string | undefined = prefab
    while (current !== undefined) {
      const p: Prefab | undefined = typeof current === 'string' ? registry.prefab(current) : current
      if (!p) {
        errors.push(`${sourcePrefix(node.source)}预制件 ${chain[0]?.prefab ?? prefab.prefab} 继承的 "${current}" 没有登记${similar(String(current), registry.prefabNames())}`)
        return null
      }
      if (chain.includes(p) || chain.length > 32) {
        errors.push(`${sourcePrefix(node.source)}预制件 ${prefab.prefab} 的 is 链有循环`)
        return null
      }
      chain.unshift(p)
      current = p.def.is
    }
    return chain
  }

  /** 把一组覆盖（预制件定义或标签属性）并入 acc；where 用于报错 */
  const apply = (acc: Record<string, any>, tags: Set<string>, values: Record<string, any>, reserved: Set<string>, where: string) => {
    let ok = true
    for (const key of Object.keys(values)) {
      if (key === 'tags') {
        const list = values.tags
        if (list === undefined) continue
        if (!Array.isArray(list) || list.some((t) => typeof t !== 'string')) {
          errors.push(`${where}tags 必须是字符串数组`)
          ok = false
        } else list.forEach((t) => tags.add(t))
        continue
      }
      if (reserved.has(key)) continue
      const block = registry.block(key)
      if (!block) {
        errors.push(`${where}未知的积木 ${key}${similar(key, registry.blockNames())}`)
        ok = false
        continue
      }
      const value = values[key]
      if (value === false || value === null) {
        delete acc[key]
        continue
      }
      if (value === undefined) continue
      const over = value === true ? {} : value
      if (!isPlainObject(over)) {
        errors.push(`${where}积木 ${key} 的值必须是对象（或 true 表示用默认值、false 表示去掉）`)
        ok = false
        continue
      }
      const fields = block.props ?? {}
      for (const field of Object.keys(over)) {
        if (!(field in fields)) {
          errors.push(`${where}积木 ${key} 没有字段 ${field}${similar(field, Object.keys(fields))}`)
          ok = false
        }
      }
      acc[key] = merge(acc[key] ?? {}, over)
    }
    return ok
  }

  const entity = (node: PotNode, prefab: Prefab, path: string): EntitySpec | null => {
    const where = sourcePrefix(node.source)
    const props = node.props
    if (flatChildren(props.children).length) {
      errors.push(`${where}<${prefab.prefab}> 有子节点：M1 的实体是平的，不支持子节点`)
      return null
    }
    const chain = chainOf(prefab, node)
    if (!chain) return null
    const acc: Record<string, any> = {}
    const tags = new Set<string>()
    let ok = true
    for (const p of chain) ok = apply(acc, tags, p.def, PREFAB_RESERVED, `${where}预制件 ${p.prefab}：`) && ok
    ok = apply(acc, tags, props, RESERVED, where) && ok
    const vec = (name: string, value: any, fallback: Vec3): Vec3 => {
      if (value === undefined) return [...fallback] as Vec3
      if (!isVec3(value)) {
        errors.push(`${where}${name} 必须是三个有限数 [x, y, z]，收到 ${JSON.stringify(value)}`)
        ok = false
        return [...fallback] as Vec3
      }
      return [value[0], value[1], value[2]]
    }
    const at = vec('at', props.at, [0, 0, 0])
    const rot = vec('rot', props.rot, [0, 0, 0])
    const scale = typeof props.scale === 'number' && Number.isFinite(props.scale)
      ? [props.scale, props.scale, props.scale] as Vec3
      : vec('scale', props.scale, [1, 1, 1])
    if (props.name !== undefined && typeof props.name !== 'string') {
      errors.push(`${where}name 必须是字符串`)
      ok = false
    }
    if (!ok) return null
    const blocks: Record<string, Record<string, any>> = {}
    for (const name of Object.keys(acc)) {
      const block = registry.block(name)!
      blocks[name] = merge(clone(block.props ?? {}), acc[name])
    }
    const spec: EntitySpec = { path, prefab: prefab.prefab, at, rot, scale, tags: [...tags], blocks }
    if (props.name !== undefined) spec.name = props.name
    if (node.source) spec.source = node.source
    return spec
  }

  const rule = (node: PotNode, layer: Layer) => {
    const where = sourcePrefix(node.source)
    const p = node.props
    const path = join(layer, segment(layer, 'rule', node.key))
    if (!claim(path, node)) return
    if (typeof p.on !== 'string' || !(BUILTIN_EVENTS.includes(p.on) || EVENT.test(p.on))) {
      errors.push(`${where}<rule> 未知的事件 ${JSON.stringify(p.on)}：可用 touch、death、every 或自定义事件名（标识符）`)
      return
    }
    if (typeof p.do !== 'function') {
      errors.push(`${where}<rule on="${p.on}"> 缺少 do 函数`)
      return
    }
    if (p.on === 'every' && !(typeof p.seconds === 'number' && p.seconds > 0)) {
      errors.push(`${where}<rule on="every"> 需要正数 seconds`)
      return
    }
    const filter = (v: any) => (v === undefined ? undefined : isPrefab(v) ? v.prefab : String(v))
    const spec: RuleSpec = { path, on: p.on, do: p.do }
    const a = filter(p.a), b = filter(p.b)
    if (a !== undefined) spec.a = a
    if (b !== undefined) spec.b = b
    if (p.seconds !== undefined) spec.seconds = p.seconds
    if (node.source) spec.source = node.source
    result.rules.push(spec)
  }

  const stage = (node: PotNode) => {
    if (result.stage) {
      errors.push(`${sourcePrefix(node.source)}一棵场景树只能有一个 <stage>${result.stage.source ? `（第一个在 ${result.stage.source.file}:${result.stage.source.line}）` : ''}`)
      return
    }
    const { children, ...rest } = node.props
    const spec: StageSpec = clone(rest)
    if (node.source) spec.source = node.source
    result.stage = spec
  }

  children(root, { prefix: '', counts: new Map() }, 0, true)
  if (errors.length) {
    const error = new Error(errors.join('\n'))
    ;(error as any).errors = errors
    throw error
  }
  return result
}
