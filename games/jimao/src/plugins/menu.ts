/** 菜单：标题、暂停、阵亡、结算简报，以及设置、操作说明、项目介绍面板 */
import type { Context } from '@pot/core'
import { emit } from '../lib/bus'
import { clamp, formatTime } from '../lib/math'
import { C } from '../lib/palette'
import { rating } from '../lib/rating'
import { sfx } from '../lib/sfx'
import { game, type GameState } from '../lib/types'

export const name = 'menu'

const CONTROLS: [string, string][] = [
  ['W A S D', '移动'],
  ['鼠标', '视角'],
  ['鼠标左键', '射击'],
  ['鼠标右键', '瞄准'],
  ['R', '换弹'],
  ['空格', '跳跃'],
  ['左 Shift', '冲刺'],
  ['C / 左 Ctrl', '蹲伏'],
  ['E（按住）', '切断中继'],
  ['Esc', '暂停'],
]

const ABOUT = [
  '《几猫 · 港区突击》是一部单关卡第一人称射击短篇。',
  '你将潜入暴雨中的港区，切断堆场、仓库与码头的三处中继，在机械飞鸥与机械猎犬的围攻中撤离。',
  '本版本使用 pot 框架重制：关卡、数值与流程全部来自数据文件，几何、音效均由代码生成，支持热重载。',
]

export function apply(ctx: Context) {
  const flow = ctx.data.load('flow.json')
  const qualityNames: string[] = ctx.data.load('tuning.json').quality.names
  const ui = ctx.ui
  const input = ctx.input
  let hover = ''

  function button(id: string, label: string, x: number, y: number, w: number, h = 44, accent = false) {
    const over = ui.hit(x, y, w, h)
    if (over && hover !== id) { hover = id; ctx.audio.play(sfx('ui'), { volume: 0.2, pitch: 1.4 }) }
    ui.rect(x, y, w, h, over ? (accent ? C.signal : C.bone) : C.ink, { alpha: over ? 0.95 : 0.6, radius: 3 })
    if (!over) ui.border(x, y, w, h, accent ? C.signal : C.steel, 1, { alpha: 0.7, radius: 3 })
    ui.rect(x, y, 3, h, accent ? C.signal : C.steel, { alpha: over ? 0 : 1 })
    ui.text(label, x + 20, y + h / 2, { size: 17, bold: true, color: over ? C.ink : C.bone, valign: 'middle' })
    return over && input.pressed('mouse0')
  }

  function slider(label: string, value: number, min: number, max: number, x: number, y: number, w: number, fmt: (v: number) => string) {
    ui.text(label, x, y, { size: 15, color: C.bone })
    ui.text(fmt(value), x + w, y, { size: 15, color: C.signal, align: 'right', bold: true })
    const ty = y + 28
    const k = (value - min) / (max - min)
    ui.rect(x, ty, w, 4, C.steel, { alpha: 0.35, radius: 2 })
    ui.rect(x, ty, w * k, 4, C.signal, { radius: 2 })
    ui.rect(x + w * k - 7, ty - 6, 14, 16, C.bone, { radius: 3 })
    if (input.key('mouse0') && ui.hit(x - 8, ty - 12, w + 16, 28)) {
      const m = input.mouse()
      return min + clamp((m.x - x) / w, 0, 1) * (max - min)
    }
    return value
  }

  function panel(g: GameState, W: number, H: number) {
    const pw = Math.min(560, W - 80), ph = 440
    const x = W / 2 - pw / 2, y = H / 2 - ph / 2
    ui.rect(0, 0, W, H, C.ink, { alpha: 0.55 })
    ui.rect(x, y, pw, ph, C.ink, { alpha: 0.92, radius: 6 })
    ui.rect(x, y, pw, 4, C.signal)
    const title = g.panel === 'settings' ? '设置' : g.panel === 'controls' ? '操作说明' : '关于本作'
    ui.text(title, x + 28, y + 26, { size: 24, bold: true, color: C.bone })
    const cx = x + 28, cw = pw - 56
    if (g.panel === 'settings') {
      const s = g.settings
      s.sensitivity = Math.round(slider('鼠标灵敏度', s.sensitivity, 0.2, 3, cx, y + 80, cw, (v) => v.toFixed(2)) * 100) / 100
      s.fov = Math.round(slider('视野', s.fov, 60, 100, cx, y + 140, cw, (v) => `${Math.round(v)}°`))
      s.volume = Math.round(slider('音量', s.volume, 0, 1, cx, y + 200, cw, (v) => `${Math.round(v * 100)}%`) * 100) / 100
      const ty = y + 262
      ui.text('反转垂直视角', cx, ty, { size: 15, color: C.bone })
      const bx = cx + cw - 56
      ui.rect(bx, ty - 2, 56, 26, s.invertY ? C.signal : C.steel, { radius: 13, alpha: s.invertY ? 1 : 0.4 })
      ui.rect(s.invertY ? bx + 32 : bx + 4, ty + 2, 20, 18, C.bone, { radius: 9 })
      if (input.pressed('mouse0') && ui.hit(bx, ty - 2, 56, 26)) { s.invertY = !s.invertY; ctx.audio.play(sfx('ui'), { volume: 0.4 }) }
      const qy = y + 312
      ui.text('画质', cx, qy + 4, { size: 15, color: C.bone })
      const names: string[] = qualityNames
      const qw = 64
      names.forEach((label, i) => {
        const qx = cx + cw - (names.length - i) * (qw + 6) + 6
        const on = (s.quality ?? 2) === i
        ui.rect(qx, qy, qw, 28, on ? C.signal : C.steel, { radius: 3, alpha: on ? 1 : 0.25 })
        ui.text(label, qx + qw / 2, qy + 14, { size: 14, bold: true, color: on ? C.ink : C.bone, align: 'center', valign: 'middle' })
        if (input.pressed('mouse0') && ui.hit(qx, qy, qw, 28) && !on) { s.quality = i; ctx.audio.play(sfx('ui'), { volume: 0.4 }) }
      })
    } else if (g.panel === 'controls') {
      CONTROLS.forEach(([k, v], i) => {
        const yy = y + 76 + i * 30
        ui.rect(cx, yy, 150, 24, C.steel, { alpha: 0.18, radius: 3 })
        ui.text(k, cx + 75, yy + 12, { size: 14, bold: true, color: C.signal, align: 'center', valign: 'middle' })
        ui.text(v, cx + 170, yy + 12, { size: 15, color: C.bone, valign: 'middle' })
      })
    } else {
      ABOUT.forEach((t, i) => ui.text(t, cx, y + 80 + i * 80, { w: cw, h: 76, size: 15, color: C.bone, wrap: true }))
    }
    if (button('back', '返回', x + pw - 168, y + ph - 64, 140, 40) || input.pressed('escape')) g.panel = ''
  }

  ctx.on('update', () => {
    const g = game(ctx)
    if (!g) return
    const W = ui.width, H = ui.height
    if (g.phase === 'playing' || g.phase === 'intro') return
    if (g.panel) return panel(g, W, H)

    if (g.phase === 'title') {
      ui.rect(0, 0, W * 0.42, H, C.ink, { alpha: 0.55 })
      ui.rect(0, 0, 6, H, C.signal)
      const x = Math.max(48, W * 0.06), y = H * 0.2
      ui.text('几猫', x, y, { size: 84, bold: true, color: C.bone, shadow: true })
      ui.text('港区突击', x + 4, y + 104, { size: 30, bold: true, color: C.signal, shadow: true })
      ui.text('暴雨夜 · 港区主控已封锁泊位', x + 4, y + 150, { size: 15, color: C.steel })
      const bw = 260
      if (button('start', '开始行动', x, y + 200, bw, 48, true)) emit(ctx, 'jimao/command', 'start')
      if (button('settings', '设置', x, y + 258, bw)) g.panel = 'settings'
      if (button('controls', '操作说明', x, y + 312, bw)) g.panel = 'controls'
      if (button('about', '关于本作', x, y + 366, bw)) g.panel = 'about'
      ui.text('几猫工作室 · 国产 3A 大作 V1', x, H - 40, { size: 12, color: C.steel })
      return
    }

    if (g.phase === 'paused') {
      ui.rect(0, 0, W, H, C.ink, { alpha: 0.6 })
      const x = W / 2 - 140, y = H / 2 - 170
      ui.text('已暂停', W / 2, y, { size: 40, bold: true, color: C.bone, align: 'center' })
      ui.text(`任务用时 ${formatTime(g.time)}`, W / 2, y + 54, { size: 14, color: C.steel, align: 'center' })
      if (button('resume', '继续', x, y + 90, 280, 46, true)) emit(ctx, 'jimao/command', 'resume')
      if (button('settings', '设置', x, y + 146, 280)) g.panel = 'settings'
      if (button('controls', '操作说明', x, y + 200, 280)) g.panel = 'controls'
      if (button('restart', '重新开始', x, y + 254, 280)) emit(ctx, 'jimao/command', 'restart')
      if (button('title', '返回标题', x, y + 308, 280)) emit(ctx, 'jimao/command', 'title')
      return
    }

    if (g.phase === 'dead') {
      if (g.phaseTime < 1) return
      const a = clamp(g.phaseTime - 1, 0, 1)
      const y = H / 2 - 110
      ui.text('行动失败', W / 2, y, { size: 48, bold: true, color: C.alarm, align: 'center', alpha: a, shadow: true })
      ui.text('几猫队员已阵亡 · 中继进度已保留', W / 2, y + 66, { size: 16, color: C.bone, align: 'center', alpha: a })
      if (a < 1) return
      if (button('retry', '重新部署', W / 2 - 140, y + 120, 280, 48, true) || input.pressed('return')) emit(ctx, 'jimao/command', 'retry')
      if (button('title', '返回标题', W / 2 - 140, y + 178, 280)) emit(ctx, 'jimao/command', 'title')
      return
    }

    if (g.phase === 'complete') {
      if (g.phaseTime < 1.2) return
      const a = clamp((g.phaseTime - 1.2) * 2, 0, 1)
      const r = rating(g, flow.ratings)
      const pw = Math.min(560, W - 80), ph = 420
      const x = W / 2 - pw / 2, y = H / 2 - ph / 2
      ui.rect(x, y, pw, ph, C.ink, { alpha: 0.9 * a, radius: 6 })
      ui.rect(x, y, pw, 4, C.ok, { alpha: a })
      ui.text('行动简报', x + 32, y + 28, { size: 26, bold: true, color: C.bone, alpha: a })
      ui.text('港区封锁已解除', x + 32, y + 66, { size: 14, color: C.ok, alpha: a })
      const rows: [string, string][] = [
        ['任务用时', formatTime(g.time)],
        ['命中率', `${Math.round(r.acc * 100)}%  (${g.stats.hits}/${g.stats.shots})`],
        ['击毁目标', String(g.stats.kills)],
        ['弱点命中', String(g.stats.weak)],
        ['重新部署', `${g.retries} 次`],
      ]
      rows.forEach(([k, v], i) => {
        const yy = y + 110 + i * 34
        ui.text(k, x + 32, yy, { size: 16, color: C.steel, alpha: a })
        ui.text(v, x + pw / 2 + 20, yy, { size: 16, bold: true, color: C.bone, alpha: a })
      })
      ui.text('评级', x + 32, y + 290, { size: 16, color: C.steel, alpha: a })
      ui.text(r.label, x + pw / 2 + 20, y + 280, { size: 30, bold: true, color: C.signal, alpha: a })
      for (let i = 0; i < 5; i++) ui.rect(x + pw / 2 + 20 + i * 22, y + 322, 16, 6, i < r.score ? C.signal : C.steel, { alpha: a * (i < r.score ? 1 : 0.35), radius: 2 })
      if (a < 1) return
      if (button('again', '再次出击', x + 32, y + ph - 66, 200, 44, true)) emit(ctx, 'jimao/command', 'start')
      if (button('title', '返回标题', x + pw - 232, y + ph - 66, 200, 44)) emit(ctx, 'jimao/command', 'title')
    }
  })
}
