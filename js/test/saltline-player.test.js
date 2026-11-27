/**
 * saltline 玩家金标准（004 第 17.6 节）：在真实关卡上用固定的输入脚本跑 840 步，
 * 逐步比对位置、grounded、crouched（误差 1e-4）与生命值。
 *
 * 录制：POT_RECORD=1 node --test test/saltline-player.test.js（写 fixtures/saltline-player.json）
 * 调试：POT_TRACE=1 打印轨迹
 */
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const path = require('path')
const { startGame, readGameFiles } = require('./helpers')

const GAME_DIR = path.resolve(__dirname, '../../games/saltline')
const FIXTURE = path.join(__dirname, 'fixtures/saltline-player.json')
const STEPS = 840

/** 测试入口单元：没有 flow（w.flow.state 为 play），vars.sl 的子阶段固定为 playing，用 harbor 的港口碰撞（HarborColliders）与 src/parts 的玩家组装 */
function goldenFiles() {
  const files = readGameFiles(GAME_DIR)
  files.set('manifest.json', JSON.stringify({ id: 'saltline.golden', plugins: ['golden'] }))
  files.set('src/plugins/golden.tsx', `
import { defineGame } from '@pot/core'
import fps from '@pot/kit/fps'
import realistic from '@pot/kit/realistic'
import { HarborColliders } from '@pot/kit/harbor/place'
import { Player, playerBlocks } from '../parts/player'
export default defineGame({
  kits: [fps, realistic],
  blocks: playerBlocks,
  vars: { sl: { phase: 'playing' }, slSettings: { sensitivity: 1, invertY: false, volume: 0, fov: 74, quality: 0 } },
  load: (ctx) => {
    ;(globalThis as any).slPlayer = () => (ctx.world as any).query('player')[0]
  },
  scene: ({ data }) => <><HarborColliders data={data} /><Player data={data} /></>,
})`)
  return files
}

/** 第 i 步的输入：move、look、按住的键；teleport 为把玩家移到地面以下（触发落水救援） */
function input(i) {
  const keys = []
  let move = [0, 0], look = [0, 0], teleport = false
  if (i >= 40 && i < 50) look = [1, 0.3]
  else if (i >= 50 && i < 60) look = [-1, -0.3]
  if (i >= 30 && i < 90) move = [0, 1]
  if (i >= 90 && i < 300) { move = [0, 1]; keys.push('leftshift') }
  if (i === 120 || i === 121 || i === 170) keys.push('space')
  if (i >= 230 && i < 236) keys.push('space') // 按住不放：只算一次按下
  if (i === 300) teleport = true
  if (i >= 310 && i < 360) move = [1, 0]
  if (i >= 360 && i < 380) move = [0.7, 0.7]
  if (i === 380 || i === 381) keys.push('c')
  if (i >= 380 && i < 440) move = [0, -1]
  if (i === 400) keys.push('space') // 蹲着不能跳
  if (i === 440) keys.push('leftcontrol')
  if (i >= 450 && i < 470) look = [-2, 0.5]
  if (i >= 450 && i < 520) move = [-0.5, 1]
  if (i === 480) keys.push('space')
  if (i >= 530 && i < 550) look = [2, 0] // 转回朝 +x
  if (i >= 550 && i < 650) move = [1, 0] // 右移，贴上南侧的墙
  if (i >= 650 && i < 720) { move = [0.3, 1]; keys.push('leftshift') } // 斜着贴墙冲刺滑行，再顶住前方障碍
  if (i >= 720 && i < 840) move = [-1, 0.25] // 左移，跨上 0.33 高的长凳，顶住靠背
  return { move, look, keys, teleport }
}

async function runScript() {
  const g = await startGame(goldenFiles())
  assert.deepEqual(g.runtime.failures, [])
  g.engine.locked = true
  const p = () => globalThis.slPlayer()
  // 等加载完成、站稳
  for (let i = 0; i < 5; i++) g.runtime.tick(1 / 60)
  const rows = []
  for (let i = 0; i < STEPS; i++) {
    const { move, look, keys, teleport } = input(i)
    g.engine.axes.move = move
    g.engine.axes.look = look
    g.engine.keys = new Set(keys)
    if (teleport) p().pos[1] = -5
    g.runtime.tick(1 / 60)
    const s = p()
    const m = s.b.moveFps
    rows.push([s.pos[0], s.pos[1], s.pos[2], m.grounded ? 1 : 0, m.crouched ? 1 : 0, s.b.health.hp, m.yaw])
    if (process.env.POT_TRACE && i % 10 === 0) console.log(i, rows[i].map((v) => +v.toFixed(3)).join(' '))
  }
  for (const l of g.host.logs) if (l.level === 'error') console.log(l.text)
  return rows
}

test('saltline 玩家：840 步与金标准一致', async () => {
  const rows = await runScript()
  if (process.env.POT_RECORD) {
    fs.mkdirSync(path.dirname(FIXTURE), { recursive: true })
    fs.writeFileSync(FIXTURE, JSON.stringify({ about: 'saltline 玩家金标准：[x, y, z, grounded, crouched, health, yaw]', rows: rows.map((r) => r.map((v) => +v.toFixed(6))) }) + '\n')
    return
  }
  const golden = JSON.parse(fs.readFileSync(FIXTURE, 'utf8')).rows
  assert.equal(rows.length, golden.length)
  for (let i = 0; i < rows.length; i++) {
    const a = rows[i], b = golden[i]
    for (let k = 0; k < 3; k++) assert.ok(Math.abs(a[k] - b[k]) <= 1e-4, `第 ${i} 步位置[${k}]：期望 ${b[k]}，实际 ${a[k]}`)
    assert.equal(a[3], b[3], `第 ${i} 步 grounded`)
    assert.equal(a[4], b[4], `第 ${i} 步 crouched`)
    assert.ok(Math.abs(a[5] - b[5]) <= 1e-3, `第 ${i} 步生命：期望 ${b[5]}，实际 ${a[5]}`)
    assert.ok(Math.abs(a[6] - b[6]) <= 1e-6, `第 ${i} 步 yaw：期望 ${b[6]}，实际 ${a[6]}`)
  }
})
