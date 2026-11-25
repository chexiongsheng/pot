/**
 * saltline 敌人回归（004 第 17.7 节）：敌人迁移后的行为与旧版只是近似一致，这里在真实关卡上锁定当前行为：
 * 同样的输入两次结果逐步相同；鸥在视野内会交战、开火、打掉玩家血量；暂停时冻结；玩家死后不再开火；
 * clear-enemies 清空敌人、弹道与爆炸。
 */
const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('path')
const { startGame, readGameFiles } = require('./helpers')

const GAME_DIR = path.resolve(__dirname, '../../games/saltline')

/** 测试入口：GAME 状态固定为 playing，加载碰撞、玩家与敌人单元，导出几个探针 */
function files() {
  const f = readGameFiles(GAME_DIR)
  f.set('manifest.json', JSON.stringify({ id: 'saltline.enemies', plugins: ['probe'] }))
  f.set('src/plugins/probe.ts', `
import type { Context } from '@pot/core'
import { GAME, player } from '../lib/types'
import { emit } from '../lib/bus'
export const name = 'probe'
export async function apply(ctx: Context) {
  const g = ctx.state.define(GAME, { version: 1, init: () => ({ phase: 'playing', resume: 'playing', pending: [], stats: { shots: 0, hits: 0, kills: 0, weak: 0 }, relays: [], settings: { sensitivity: 1, invertY: false, volume: 0, fov: 74, quality: 0 } }) })
  for (const u of ['collision', 'player', 'enemies']) await ctx.use(u)
  ;(globalThis as any).slProbe = {
    g, player: () => player(ctx), w: () => ctx.world as any,
    spawn: (type: string, pos: number[], pursuit = false) => emit(ctx, 'saltline/spawn', type as any, pos as any, pursuit),
    clear: () => emit(ctx, 'saltline/clear-enemies'),
  }
}`)
  return f
}

/** 返回每步的摘要：[敌人模式…, 攻击阶段…, 弹道数, 玩家血量] */
async function run(steps, script = () => {}) {
  const game = await startGame(files())
  assert.deepEqual(game.runtime.failures, [])
  game.engine.locked = true
  const P = globalThis.slProbe
  for (let i = 0; i < 5; i++) game.runtime.tick(1 / 60)
  const rows = []
  for (let i = 0; i < steps; i++) {
    script(i, P)
    game.runtime.tick(1 / 60)
    const w = P.w()
    const foes = w.query('enemy')
    const bolts = w.query().filter((e) => e.b.slBolt).length
    rows.push({
      modes: foes.map((e) => e.b.slFoe.mode).join(','),
      attack: foes.map((e) => e.b.slFoe.attack).join(','),
      pos: foes.map((e) => e.pos.map((v) => +v.toFixed(5)).join(' ')).join('|'),
      bolts,
      hp: +P.player().health.toFixed(5),
    })
  }
  const errors = game.host.logs.filter((l) => l.level === 'error').map((l) => l.text)
  return { rows, errors, P, game }
}

/** 在玩家（出生点）前方高处放一只鸥，再在 8 米外放一只犬，都直接搜索玩家 */
const twoFoes = (i, P) => {
  if (i !== 0) return
  const p = P.player().pos
  P.spawn('gull', [p[0] + 9, 5, p[2]], true)
  P.spawn('hound', [p[0] + 8, 0, p[2] + 2], true)
}

test('saltline 敌人：同样的输入逐步结果相同（固定步、w.rand）', async () => {
  const a = await run(600, twoFoes)
  const b = await run(600, twoFoes)
  assert.deepEqual(a.errors, [])
  assert.deepEqual(a.rows, b.rows)
})

test('saltline 敌人：发现玩家后交战、开火、打掉血量', async () => {
  const { rows, errors } = await run(900, twoFoes)
  assert.deepEqual(errors, [])
  assert.ok(rows.some((r) => r.modes.includes('combat')), '应进入交战')
  assert.ok(rows.some((r) => r.attack.includes('telegraph')), '开火前应有预警')
  assert.ok(rows.some((r) => r.bolts > 0), '应生成弹道')
  const low = Math.min(...rows.map((r) => r.hp))
  assert.ok(low < rows[0].hp, `玩家应掉血（会回血，看最低值）：${rows[0].hp} → 最低 ${low}`)
})

test('saltline 敌人：暂停时冻结，恢复后继续', async () => {
  const { rows } = await run(400, (i, P) => {
    twoFoes(i, P)
    if (i === 200) P.g.phase = 'paused'
    if (i === 300) P.g.phase = 'playing'
  })
  for (let i = 202; i < 300; i++) assert.equal(rows[i].pos, rows[201].pos, `第 ${i} 步暂停中敌人不应移动`)
  assert.notEqual(rows[399].pos, rows[300].pos, '恢复后应继续移动')
})

test('saltline 敌人：玩家死后不再开火，弹道不再伤人', async () => {
  let deadAt = -1
  const { rows, P } = await run(900, (i, P) => {
    twoFoes(i, P)
    // 第一次出现弹道后让玩家死亡（dead 阶段）
    if (deadAt < 0 && i > 0 && P.w().query().some((e) => e.b.slBolt)) { deadAt = i; P.g.phase = 'dead' }
  })
  assert.ok(deadAt > 0, '应在测试时间内开火')
  const hp = rows[deadAt].hp
  // 死后不再生成新弹道（已发出的会飞完 1.6 秒后消失）
  for (let i = deadAt; i < rows.length; i++) assert.ok(rows[i].bolts <= rows[i - 1].bolts, `第 ${i} 步死后又生成了弹道`)
  for (let i = deadAt + 120; i < rows.length; i++) assert.equal(rows[i].bolts, 0, `第 ${i} 步不应再有弹道`)
  for (let i = deadAt; i < rows.length; i++) assert.equal(rows[i].hp, hp, `第 ${i} 步死后不应再掉血`)
  assert.ok(!rows[rows.length - 1].attack.includes('burst'), '死后不应停在连发中')
  P.clear()
})

test('saltline 敌人：clear-enemies 清空敌人、弹道与爆炸', async () => {
  const { P, game, rows } = await run(400, twoFoes)
  assert.ok(rows[rows.length - 1].modes.length > 0, '清空前应有敌人')
  P.clear()
  game.runtime.tick(1 / 60) // 销毁在本步末尾生效
  const w = P.w()
  assert.equal(w.query().filter((e) => e.b.slFoe || e.b.slBolt || e.b.lifetime).length, 0)
  assert.equal(w.vars.tokenGap, 0)
})
