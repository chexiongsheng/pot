/**
 * 无画面宿主（004 第 16.1、16.8 至 16.10 节）：在 Node 上加载游戏源码并运行，给 pot check、pot blocks、
 * pot types、pot test 用。引擎只记必要的状态（对象 id、界面命令），其余调用一律成功、不做事。
 */
const fs = require('fs')
const path = require('path')
const vm = require('vm')
const { walk } = require('./builder')

const DIST = path.resolve(__dirname, '../dist')
const PACKAGES = path.resolve(__dirname, '../../packages')

function loadPot() {
  if (globalThis.pot?.createRuntime && globalThis.pot?.devtools) return globalThis.pot
  const pick = (name, pkg) => {
    const dist = path.join(DIST, name)
    return fs.existsSync(dist) ? dist : path.join(PACKAGES, pkg, 'Runtime/Resources/pot', name)
  }
  for (const [name, pkg] of [['core.cjs', 'com.pot.core'], ['devtools.cjs', 'com.pot.devtools']]) {
    const file = pick(name, pkg)
    vm.runInThisContext(fs.readFileSync(file, 'utf8'), { filename: `pot/${name}` })
  }
  return globalThis.pot
}

class HeadlessEngine {
  constructor() {
    this.nextId = 2
    this.objects = new Map()
    this.vecs = new Map()
    this.ui = ''
    this.axes = {}
    this.keys = new Set()
    this.typed = ''
    this.texId = 0
  }
  spawn() { const id = this.nextId++; this.objects.set(id, true); return id }
  destroy(id) { this.objects.delete(id); this.vecs.delete(id) }
  exists(id) { return id === 1 || this.objects.has(id) }
  count() { return this.objects.size }
  cameraId() { return 1 }
  setVec(id, prop, x, y, z) { this.vecs.set(`${id}:${prop}`, [x, y, z]) }
  getVec(id, prop) { return [...(this.vecs.get(`${id}:${prop}`) ?? (prop === 'scale' ? [1, 1, 1] : [0, 0, 0]))] }
  axis(name) { return this.axes[name] ?? [0, 0] }
  key(name, mode) { return mode === 0 ? this.keys.has(name) : false }
  mouse() { return [0, 0] }
  screen() { return [1280, 720] }
  wheel() { return 0 }
  focused() { return true }
  cursorLocked() { return false }
  textInput() { const t = this.typed; this.typed = ''; return t }
  uiSubmit(list) { this.ui = list }
  uiMeasure(text, size) { return [String(text).length * size * 0.6, size * 1.3] }
  texture() { return ++this.texId }
  textTexture() { return ++this.texId }
  gfxBakeBegin() { return -(++this.texId) }
  gfxBake(_bind, _program, _w, _h, targets) { return String(targets).split(';').map(() => ++this.texId).join(',') }
  canvasText(text, _family, size) {
    const adv = Math.round(String(text).length * size * 0.6), asc = Math.round(size * 0.8), desc = Math.round(size * 0.2)
    const w = Math.max(1, adv), h = Math.max(1, asc)
    const buf = new ArrayBuffer(32 + w * h)
    new Float32Array(buf, 0, 8).set([w, h, 0, asc, adv, asc, desc, 0])
    return buf
  }
  mesh(_name, positions) { return positions.byteLength / 12 }
  meshCached() { return -1 }
  setTransforms(_ids, _data, count) { return count }
  raycast() { return null }
  sphereCast() { return null }
  audioClip() { return true }
  audioHas() { return false }
  audioLoop() { return ++this.texId }
  gfxBackend() { return 'headless' }
}

/** 没实现的引擎方法：一律返回 ''（多数宿主方法以空串表示成功） */
function wrapEngine(engine) {
  return new Proxy(engine, {
    get(target, key) {
      if (key in target || typeof key === 'symbol' || key === 'then') return target[key]
      return () => ''
    },
  })
}

function createHeadlessHost(files) {
  const engine = new HeadlessEngine()
  const logs = []
  return {
    platform: 'node',
    files,
    logs,
    engine: wrapEngine(engine),
    raw: engine,
    log(level, text) { logs.push({ level, text: String(text) }) },
    readText(p) { return files.has(p) ? files.get(p) : null },
    writeText(p, content) {
      if (content === null) files.delete(p)
      else files.set(p, content)
    },
    gc() {},
    send() {},
  }
}

function readGameFiles(dir) {
  return new Map(walk(dir).map((rel) => [rel, fs.readFileSync(path.join(dir, rel), 'utf8')]))
}

/** 游戏是否用了高层写法（defineGame）：只有这样的游戏才做求值校验、类型生成 */
function usesWorld(dir) {
  const src = path.join(dir, 'src')
  if (!fs.existsSync(src)) return false
  return walk(src).some((rel) => /\.(tsx?|js)$/.test(rel) && /\bdefineGame\b/.test(fs.readFileSync(path.join(src, rel), 'utf8')))
}

/** 在无画面宿主上加载并启动游戏（读源码，不经打包）。files 缺省为游戏目录的全部文件 */
async function loadGame(dir, options = {}) {
  const pot = loadPot()
  const files = options.files ?? readGameFiles(dir)
  const host = createHeadlessHost(files)
  const runtime = await pot.createRuntime(host, { loader: pot.devtools.createLoader(host), ...(options.state ? { state: options.state } : {}) })
  await runtime.start()
  return { pot, host, runtime, engine: host.raw }
}

/** 只有系统级（不在游戏目录、或游戏没用高层写法）时用的空游戏 */
function emptyGame() {
  return new Map([['manifest.json', JSON.stringify({ id: 'pot.blocks', plugins: [] })]])
}

const plain = (v) => JSON.parse(JSON.stringify(v ?? {}, (_k, x) => (typeof x === 'function' ? '[function]' : x)))

/** pot blocks：积木、预制件、界面标签、内置节点（16.8） */
async function listBlocks(dir) {
  const inGame = !!dir && fs.existsSync(path.join(dir, 'manifest.json')) && usesWorld(dir)
  const { pot, runtime } = await loadGame(dir, inGame ? {} : { files: emptyGame() })
  try {
    runtime.tick(1 / 60)
    const reg = runtime.root.world.registry
    const sysBlocks = new Set(pot.BUILTIN_BLOCKS)
    const sysPrefabs = new Set(pot.BUILTIN_PREFABS)
    const items = []
    for (const name of reg.blockNames()) {
      const b = reg.block(name)
      items.push({ kind: 'block', name, layer: sysBlocks.has(b) ? 'system' : 'game', about: b.about ?? '', props: plain(b.props), state: plain(b.state) })
    }
    for (const name of reg.prefabNames()) {
      const p = reg.prefab(name)
      const def = p.def ?? {}
      items.push({
        kind: 'prefab', name, layer: sysPrefabs.has(p) ? 'system' : 'game', about: def.about ?? '',
        is: typeof def.is === 'string' ? def.is : def.is?.prefab, chain: reg.chain(name), tags: def.tags ?? [],
        blocks: plain(Object.fromEntries(Object.entries(def).filter(([k]) => !['is', 'tags', 'about'].includes(k)))),
      })
    }
    for (const [name, doc] of Object.entries(pot.UI_TAG_DOCS)) items.push({ kind: 'ui', name, layer: 'system', about: doc.about, props: { ...doc.props, ...pot.UI_COMMON_PROPS } })
    items.push({ kind: 'node', name: 'stage', layer: 'system', about: '环境与相机（scene 里最多一个）', props: { background: '背景色', sun: '平行光：欧拉角，或 { rot, intensity, color }；false 不要', camera: '{ at, look }' } })
    items.push({ kind: 'node', name: 'rule', layer: 'system', about: '事件规则：事件到 TS 函数', props: { on: 'touch | death | every | 自定义事件名', a: '标签或预制件（句柄或名字）', b: 'touch 的另一方', seconds: 'every 的间隔', do: '(w, ...参数) => void' } })
    return { game: inGame ? path.basename(dir) : null, items }
  } finally {
    await runtime.stop?.()
  }
}

/** pot check 的求值校验与类型生成（16.9）：启动、推进 steps 个固定步并画一帧界面 */
async function evaluateGame(dir, options = {}) {
  const errors = []
  const warnings = []
  const { pot, host, runtime } = await loadGame(dir)
  try {
    for (const f of runtime.failures) errors.push(`单元 ${f.name} 启动失败：${String(f.error).split('\n')[0]}`)
    for (let i = 0; i < (options.steps ?? 2); i++) runtime.tick(1 / 60)
    for (const l of host.logs) {
      const first = l.text.split('\n')[0]
      if (l.level === 'error') {
        if (!/启动失败/.test(first)) errors.push(first)
      } else if (l.level === 'warn') warnings.push(first)
    }
    let types = null
    if (!runtime.failures.length) {
      const w = runtime.root.world
      const sys = new Set(pot.BUILTIN_BLOCKS)
      const sysNames = new Set(pot.BUILTIN_BLOCKS.map((b) => b.name))
      const blocks = w.registry.blockNames().map((n) => w.registry.block(n)).filter((b) => !sys.has(b) && !sysNames.has(b.name))
      types = pot.generateTypes(blocks, w.vars)
    }
    return { errors: [...new Set(errors)], warnings: [...new Set(warnings)], types }
  } finally {
    await runtime.stop?.()
  }
}

/** 写 .pot/types.d.ts；返回文件路径 */
function writeTypes(dir, content) {
  const file = path.join(dir, '.pot', 'types.d.ts')
  fs.mkdirSync(path.dirname(file), { recursive: true })
  if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== content) fs.writeFileSync(file, content, 'utf8')
  return file
}

module.exports = { loadPot, HeadlessEngine, createHeadlessHost, readGameFiles, usesWorld, loadGame, listBlocks, evaluateGame, writeTypes }
