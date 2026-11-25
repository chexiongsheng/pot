/**
 * pot test（004 第 16.10 节）：在无画面宿主上从空存档启动游戏，按 tests/*.json 逐步推进并检查结果。
 */
const fs = require('fs')
const path = require('path')
const { loadGame, usesWorld } = require('./headless')

const SMOKE = { name: '冒烟：无输入推进 300 步', steps: 300 }

function readScripts(dir) {
  const testsDir = path.join(dir, 'tests')
  if (!fs.existsSync(testsDir)) return [{ file: null, script: SMOKE }]
  const files = fs.readdirSync(testsDir).filter((f) => f.endsWith('.json')).sort()
  if (!files.length) return [{ file: null, script: SMOKE }]
  return files.map((f) => {
    const file = path.join(testsDir, f)
    let script
    try {
      script = JSON.parse(fs.readFileSync(file, 'utf8'))
    } catch (error) {
      script = { invalid: `${f} 不是合法 JSON：${error.message}` }
    }
    return { file, script }
  })
}

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v)

/** expected 是 actual 的子集（对象按字段，数组与其他值严格相等） */
function subset(expected, actual, at, out) {
  if (isObj(expected)) {
    if (!isObj(actual)) return out.push(`${at}：期望对象，实际 ${JSON.stringify(actual)}`)
    for (const k of Object.keys(expected)) subset(expected[k], actual[k], at ? `${at}.${k}` : k, out)
    return
  }
  if (JSON.stringify(expected) !== JSON.stringify(actual)) out.push(`${at}：期望 ${JSON.stringify(expected)}，实际 ${JSON.stringify(actual)}`)
}

async function runScript(dir, script) {
  const failures = []
  if (script.invalid) return { failures: [script.invalid] }
  if (!Number.isInteger(script.steps) || script.steps <= 0) return { failures: ['steps 必须是正整数'] }
  const { pot, host, runtime } = await loadGame(dir)
  try {
    for (const f of runtime.failures) failures.push(`单元 ${f.name} 启动失败：${String(f.error).split('\n')[0]}`)
    if (failures.length) return { failures }
    const w = runtime.root.world
    const next = pot.expandScript(script)
    // 步号按固定步计（叠加状态下 tick 不走，但仍算一步），与录制一致
    let steps = 0
    w.setCommandSource(() => next(steps++))
    const fixed = runtime.root.clock.fixedStep
    for (let frames = 0; steps < script.steps && frames < script.steps * 2 + 60; frames++) runtime.tick(fixed)
    for (const l of host.logs) if (l.level === 'error') failures.push(l.text.split('\n')[0])
    const hash = pot.worldHash(runtime.state.get('world'))
    const e = script.expect ?? {}
    if (e.vars) subset(e.vars, JSON.parse(JSON.stringify(w.vars)), 'vars', failures)
    for (const [filter, n] of Object.entries(e.count ?? {})) {
      const got = w.count(filter)
      if (got !== n) failures.push(`count.${filter}：期望 ${n}，实际 ${got}`)
    }
    if (e.flow !== undefined && w.flow.state !== e.flow) failures.push(`flow：期望 ${e.flow}，实际 ${w.flow.state}`)
    if (e.hash !== undefined && e.hash !== hash) failures.push(`hash：期望 ${e.hash}，实际 ${hash}（逻辑变了的话用 --update 更新）`)
    return { failures: [...new Set(failures)], hash, tick: w.tick, vars: w.vars, flow: w.flow.state }
  } finally {
    await runtime.stop?.()
  }
}

/** 跑游戏的全部测试脚本；update 为真时把当前 hash 写回脚本 */
async function testGame(dir, options = {}) {
  dir = path.resolve(dir)
  if (!fs.existsSync(path.join(dir, 'manifest.json'))) return { ok: false, results: [], error: `${dir} 不是游戏目录` }
  if (!usesWorld(dir)) return { ok: false, results: [], error: 'pot test 只支持用 defineGame 的游戏' }
  const results = []
  for (const { file, script } of readScripts(dir)) {
    const r = await runScript(dir, script)
    const name = script.name ?? (file ? path.basename(file) : SMOKE.name)
    if (options.update && file && r.hash && !script.invalid) {
      const failures = r.failures.filter((f) => !/^hash：/.test(f))
      if (!failures.length) {
        script.expect = { ...(script.expect ?? {}), hash: r.hash }
        fs.writeFileSync(file, JSON.stringify(script, null, 2) + '\n', 'utf8')
      }
      r.failures = failures
    }
    results.push({ name, file: file && path.relative(dir, file), ok: r.failures.length === 0, failures: r.failures, ...(r.hash ? { hash: r.hash, tick: r.tick, flow: r.flow } : {}) })
  }
  return { ok: results.every((r) => r.ok), results }
}

module.exports = { testGame, runScript }
