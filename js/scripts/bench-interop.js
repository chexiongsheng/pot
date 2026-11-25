#!/usr/bin/env node
/**
 * 跨语言开销实测（004 第 18.2 节）：在已连接的 Runner 里执行一段 JS，调用 C# 的 Pot.PotBench，输出耗时表。
 *
 *   node js/devserver/cli.js dev            # 先启动 Dev Server，再让 Runner 打开任意游戏
 *   node js/scripts/bench-interop.js [--port 7788]
 *
 * 时间用 Date.now()，每项都重复到几十毫秒以上再除以次数。
 */
const { client } = require('../devserver/client')

/** 在 Runner 里执行的代码（pot eval 的函数体） */
const BENCH = String.raw`
const B = CS.Pot.PotBench
const out = []
const time = (label, n, fn) => {
  fn(Math.min(n, 100)) // 预热
  const t0 = Date.now()
  fn(n)
  const ms = Date.now() - t0
  out.push({ label, n, ms, us: +(ms * 1000 / n).toFixed(3) })
}
time('空调用 Noop()', 200000, (n) => { for (let i = 0; i < n; i++) B.Noop() })
time('标量 Add(a, b)', 200000, (n) => { let s = 0; for (let i = 0; i < n; i++) s = B.Add(s, 1) })
for (const kb of [1, 64, 1024]) {
  const a = new Float64Array(kb * 128)
  const reps = kb === 1 ? 20000 : kb === 64 ? 2000 : 100
  time('只传入 Take(' + kb + ' KB)', reps, (n) => { for (let i = 0; i < n; i++) B.Take(a) })
  time('往返 Echo(' + kb + ' KB)', reps, (n) => { for (let i = 0; i < n; i++) new Float64Array(B.Echo(a)) })
  time('往返加计算 Increment(' + kb + ' KB)', reps, (n) => { for (let i = 0; i < n; i++) new Float64Array(B.Increment(a)) })
}
// 纯 JS 与纯 C# 的同样运算：64K 个 double，20 轮
{
  const n = 65536, rounds = 20
  const a = new Float64Array(n)
  for (let i = 0; i < n; i++) a[i] = i * 0.5
  const t0 = Date.now()
  for (let r = 0; r < rounds; r++) for (let i = 0; i < n; i++) a[i] = a[i] * 0.999 + Math.sqrt(a[i] + 1)
  const js = Date.now() - t0
  const cs = B.Compute(n, rounds)
  out.push({ label: '纯 JS 运算（64K×20）', n: n * rounds, ms: js, us: +(js * 1000 / (n * rounds)).toFixed(5) })
  out.push({ label: '纯 C# 运算（64K×20）', n: n * rounds, ms: +cs.toFixed(2), us: +(cs * 1000 / (n * rounds)).toFixed(5) })
}
// 变换写入：1000 个对象逐个设位置 vs 一次 setTransforms
{
  const scene = runtime.scene
  const objs = []
  for (let i = 0; i < 1000; i++) objs.push(scene.spawn({ shape: 'cube', name: 'bench' + i, visible: false }))
  const ids = new Int32Array(objs.map((o) => o.id))
  const data = new Float32Array(objs.length * 10)
  for (let i = 0; i < objs.length; i++) data[i * 10 + 6] = 1
  const rounds = 20
  time('逐个设位置（1000 个）', rounds, (n) => { for (let r = 0; r < n; r++) for (let i = 0; i < objs.length; i++) objs[i].position = [i, r, 0] })
  time('setTransforms（1000 个，只写位置）', rounds, (n) => { for (let r = 0; r < n; r++) { for (let i = 0; i < objs.length; i++) { data[i * 10] = i; data[i * 10 + 1] = r } scene.setTransforms(ids, data, { rotation: false, scale: false }) } })
  for (const o of objs) o.destroy()
}
return out
`

async function main() {
  const i = process.argv.indexOf('--port')
  const api = client(i > 0 ? Number(process.argv[i + 1]) : 7788)
  const res = await api.call({ type: 'eval', code: BENCH })
  if (!res.ok) {
    console.error(res.error ?? res)
    process.exitCode = 1
    return
  }
  console.log('| 项目 | 次数 | 总耗时 ms | 每次 µs |')
  console.log('|---|---|---|---|')
  for (const r of res.data) console.log(`| ${r.label} | ${r.n} | ${r.ms} | ${r.us} |`)
}

main().catch((e) => { console.error(e.message); process.exitCode = 1 })
