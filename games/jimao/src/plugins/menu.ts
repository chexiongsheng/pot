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

/** 原版 m-legend 的两行操作速览（宽度 ≥ 1180 时显示） */
const LEGEND: [string, string][][] = [
  [['W A S D', '移动'], ['鼠标', '视角'], ['左键', '开火'], ['右键', '瞄准'], ['R', '换弹']],
  [['E', '切断中继'], ['Space', '跳跃'], ['Shift', '冲刺'], ['C', '蹲伏'], ['Esc', '暂停']],
]

const ABOUT = [
  '《几猫 · 港区突击》是一部单关卡第一人称射击短篇。',
  '你将潜入暴雨中的港区，切断堆场、仓库与码头的三处中继，在机械飞鸥与机械猎犬的围攻中撤离。',
  '本版本使用 pot 框架重制：关卡、数值与流程全部来自数据文件，几何、音效均由代码生成，支持热重载。',
]

/** 原版 CSS 变量里没进 palette 的几个色 */
const SIGNAL_HOT = '#ffc977'
const BONE_DIM = '#e8e4daa3'

interface Spaced {
  size: number
  color: string
  bold?: boolean
  /** 字距，单位 em（CSS letter-spacing） */
  spacing?: number
  alpha?: number
  shadow?: boolean
  valign?: 'top' | 'middle' | 'bottom'
}

export function apply(ctx: Context) {
  const flow = ctx.data.load('flow.json')
  const qualityNames: string[] = ctx.data.load('tuning.json').quality.names
  const ui = ctx.ui
  const input = ctx.input
  let hover = ''

  // ---- 字距：ui.text 没有 letterSpacing，按字绘制并缓存单字宽度 ----
  const widths = new Map<string, number>()
  function charW(ch: string, size: number, bold: boolean) {
    const k = `${size}|${bold ? 1 : 0}|${ch}`
    let w = widths.get(k)
    if (w === undefined) {
      w = ch === ' ' ? size * 0.3 : ui.measure(ch, size, bold).width
      if (widths.size > 4096) widths.clear()
      widths.set(k, w)
    }
    return w
  }
  function spacedWidth(s: string, o: Spaced) {
    const size = Math.round(o.size), sp = (o.spacing ?? 0) * size
    let w = 0
    for (const ch of s) w += charW(ch, size, !!o.bold) + sp
    return w
  }
  /** 带字距的文字，(x, y) 为左端，返回宽度（含末尾字距，同 CSS） */
  function spaced(s: string, x: number, y: number, o: Spaced) {
    const size = Math.round(o.size), sp = (o.spacing ?? 0) * size, bold = !!o.bold
    if (!sp) {
      ui.text(s, x, y, { size, bold, color: o.color, alpha: o.alpha, shadow: o.shadow, valign: o.valign })
      return ui.measure(s, size, bold).width
    }
    let cx = x
    for (const ch of s) {
      if (ch !== ' ') ui.text(ch, cx, y, { size, bold, color: o.color, alpha: o.alpha, shadow: o.shadow, valign: o.valign })
      cx += charW(ch, size, bold) + sp
    }
    return cx - x
  }

  // ---- 原版 m-veil / m-bars ----
  /** 横向：ink .82 → .5（38%）→ 0（72%）；纵向：底部 .7 → 0（46%）。ui 没有渐变，用 6px 条带近似 */
  function veil(W: number, H: number, a: number) {
    const step = 6
    for (let x = 0; x < W * 0.72; x += step) {
      const f = (x + step / 2) / W
      const k = f < 0.38 ? 0.82 + (0.5 - 0.82) * (f / 0.38) : 0.5 * (1 - (f - 0.38) / 0.34)
      ui.rect(x, 0, step, H, C.ink, { alpha: Math.max(0, k) * a })
    }
    const y0 = Math.floor(H * 0.54)
    for (let y = y0; y < H; y += step) {
      const f = (H - (y + step / 2)) / H
      ui.rect(0, y, W, step, C.ink, { alpha: Math.max(0, 0.7 * (1 - f / 0.46)) * a })
    }
  }
  function bars(W: number, H: number, t: number) {
    const h = clamp(H * 0.055, 14, 52)
    const k = clamp(t / 0.7, 0, 1), e = 1 - (1 - k) ** 3
    ui.rect(0, 0, W, h * e, '#000000')
    ui.rect(0, H - h * e, W, h * e, '#000000')
    return h
  }

  /** 原版 m-btn：主按钮 signal 底 ink 字 18px 字距 .3em 高 52；次按钮半透明 ink 底 + bone .42 边框 15px 字距 .22em 高 46 */
  function mbtn(id: string, label: string, x: number, cy: number, primary = false) {
    const o: Spaced = primary ? { size: 18, bold: true, spacing: 0.3, color: C.ink } : { size: 15, bold: true, spacing: 0.22, color: C.bone }
    const h = primary ? 52 : 46
    const w = Math.round(spacedWidth(label, o) + (primary ? 64 : 48))
    const y = cy - h / 2
    const over = ui.hit(x, y, w, h)
    if (over && hover !== id) { hover = id; ctx.audio.play(sfx('ui'), { volume: 0.2, pitch: 1.4 }) }
    if (primary) ui.rect(x, y, w, h, over ? SIGNAL_HOT : C.signal)
    else {
      ui.rect(x, y, w, h, over ? C.bone : C.ink, { alpha: over ? 0.12 : 0.55 })
      ui.border(x, y, w, h, C.bone, 1, { alpha: over ? 1 : 0.42 })
    }
    // 末尾字距让视觉中心偏左，补回半个字距
    spaced(label, x + (primary ? 32 : 24) + (o.spacing! * o.size) / 2, cy, { ...o, valign: 'middle' })
    return { w, click: over && input.pressed('mouse0') }
  }
  /** 一行按钮，返回被点中的 id */
  function row(items: [string, string, boolean?][], x: number, cy: number) {
    let hit = ''
    for (const [id, label, primary] of items) {
      const r = mbtn(id, label, x, cy, primary)
      if (r.click) hit = id
      x += r.w + 10
    }
    return hit
  }

  /** 统计格：小号 steel 标签 + 大号数值 */
  function stats(items: [string, string, string?][], x: number, y: number, a: number) {
    for (const [k, v, color] of items) {
      spaced(k, x, y, { size: 11, spacing: 0.2, color: C.steel, alpha: a, bold: true })
      const w = spaced(v, x, y + 20, { size: 26, bold: true, color: color ?? C.bone, alpha: a })
      x += Math.max(150, w + 48)
    }
  }

  /** 页面公共骨架：遮罩、黑边、左下对齐的 eyebrow + 大标题；返回内容左边距与底线 */
  function frame(W: number, H: number, t: number, a: number) {
    veil(W, H, a)
    const bar = bars(W, H, t)
    return { x: Math.round(Math.max(24, W * 0.055)), bottom: H - bar - Math.max(24, H * 0.07) }
  }
  function heading(eyebrow: string, title: string, x: number, bottom: number, size: number, a: number, tag?: string, tagColor = C.signal) {
    const lh = size * 0.8
    spaced(title, x, bottom, { size, bold: true, spacing: 0.15, color: C.bone, alpha: a, shadow: true, valign: 'bottom' })
    let ex = x
    const ey = bottom - lh - 22
    if (tag) {
      const tw = spacedWidth(tag, { size: 15, bold: true, spacing: 0.1, color: C.ink }) + 16
      ui.rect(ex, ey - 12, tw, 24, tagColor, { alpha: a })
      spaced(tag, ex + 8, ey, { size: 15, bold: true, spacing: 0.1, color: C.ink, alpha: a, valign: 'middle' })
      ex += tw + 12
    }
    spaced(eyebrow, ex, ey, { size: 13, bold: true, spacing: 0.24, color: C.bone, alpha: a, valign: 'middle' })
    return bottom - lh
  }

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
    const title = g.panel === 'settings' ? '设置' : g.panel === 'controls' ? '操作说明' : '项目介绍'
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

  function title(g: GameState, W: number, H: number) {
    const { x, bottom } = frame(W, H, g.phaseTime, 1)
    // 备注
    ui.text('使用 Fable5.2 自主研发 · 国产第一人称射击游戏 · 开发体验版', x, bottom, { size: 11, color: C.steel, valign: 'bottom' })
    // 右下操作速览
    if (W >= 1180) {
      LEGEND.forEach((line, i) => {
        const o: Spaced = { size: 12, spacing: 0.16, color: C.bone, alpha: 0.78 }
        const parts = line.map(([k, v]) => [k, v] as const)
        const gap = 18
        let w = 0
        for (const [k, v] of parts) w += spacedWidth(k, { ...o, bold: true }) + 6 + spacedWidth(v, o) + gap
        let lx = W - x - (w - gap)
        const ly = bottom - (LEGEND.length - 1 - i) * 22
        for (const [k, v] of parts) {
          lx += spaced(k, lx, ly, { ...o, bold: true, color: C.signal, valign: 'bottom' }) + 6
          lx += spaced(v, lx, ly, { ...o, valign: 'bottom' }) + gap
        }
      })
    }
    // 按钮行
    const by = bottom - 22 - 26
    const items: [string, string, boolean?][] = [['start', '开始行动', true], ['settings', '设置'], ['about', '项目介绍']]
    if (W < 1180) items.push(['controls', '操作说明'])
    const hit = row(items, x, by)
    if (hit === 'start') emit(ctx, 'jimao/command', 'start')
    else if (hit) g.panel = hit
    // 简介：1px line 上边框 + 72×3 signal 短条
    const ps = Math.round(clamp(W * 0.0155, 17, 22))
    const pw = Math.min(620, W - x * 2)
    const py = by - 26 - 30 - ps * 1.5
    ui.rect(x, py, pw, 1, C.bone, { alpha: 0.2 })
    ui.rect(x, py, 72, 3, C.signal)
    ui.text('港区防御系统失控。切断三处中继，突破封锁，登船撤离。', x, py + 16, { size: ps, color: C.bone, alpha: 0.9 })
    // 大标题 + 副标题
    const hs = Math.round(clamp(W * 0.155, 52, 208))
    const hb = py - 34
    const tw = spacedWidth('几猫', { size: hs, bold: true, spacing: 0.15, color: C.bone })
    const top = heading('几猫突击小队', '几猫', x, hb, hs, 1, 'B4')
    spaced('3A大作', x + tw + 4, hb - hs * 0.06, { size: Math.round(hs * 0.24), bold: true, spacing: 0.08, color: C.signal, shadow: true, valign: 'bottom' })
    const ew = spacedWidth('B4', { size: 15, bold: true, spacing: 0.1, color: C.ink }) + 28 + spacedWidth('几猫突击小队', { size: 13, bold: true, spacing: 0.24, color: C.bone })
    spaced('几猫港区 · 05:42', x + ew + 14, top - 22, { size: 13, bold: true, spacing: 0.24, color: BONE_DIM, valign: 'middle' })
  }

  ctx.on('update', () => {
    const g = game(ctx)
    if (!g) return
    const W = ui.width, H = ui.height
    if (g.phase === 'playing' || g.phase === 'intro') return
    if (g.panel) return panel(g, W, H)

    if (g.phase === 'title') return title(g, W, H)

    if (g.phase === 'paused') {
      const { x, bottom } = frame(W, H, 1, 1)
      ui.text(`任务用时 ${formatTime(g.time)}`, x, bottom, { size: 11, color: C.steel, valign: 'bottom' })
      const by = bottom - 22 - 26
      const hit = row([['resume', '继续游戏', true], ['settings', '设置'], ['controls', '操作说明'], ['restart', '重新开始任务']], x, by)
      if (hit === 'resume') emit(ctx, 'jimao/command', 'resume')
      else if (hit === 'restart') emit(ctx, 'jimao/command', 'restart')
      else if (hit) g.panel = hit
      heading('行动暂时中止', '已暂停', x, by - 26 - 30, Math.round(clamp(W * 0.08, 44, 120)), 1)
      return
    }

    if (g.phase === 'dead') {
      if (g.phaseTime < 1) return
      const a = clamp(g.phaseTime - 1, 0, 1)
      const { x, bottom } = frame(W, H, g.phaseTime - 1, a)
      const by = bottom - 26
      if (a >= 1 && (row([['retry', '重试', true]], x, by) || input.pressed('return'))) emit(ctx, 'jimao/command', 'retry')
      const cut = g.relays.filter((r) => r === 'cut').length
      const sy = by - 26 - 30 - 52
      stats([['生存时间', formatTime(g.time)], ['已切断中继', `${cut} / ${g.relays.length}`]], x, sy, a)
      heading('突击队员倒下', '信号中断', x, sy - 30, Math.round(clamp(W * 0.08, 44, 120)), a, '!', C.alarm)
      return
    }

    if (g.phase === 'complete') {
      if (g.phaseTime < 1.2) return
      const a = clamp((g.phaseTime - 1.2) * 2, 0, 1)
      const r = rating(g, flow.ratings)
      const { x, bottom } = frame(W, H, g.phaseTime - 1.2, a)
      const by = bottom - 26
      if (a >= 1) {
        const hit = row([['again', '再次出击', true], ['title', '返回标题']], x, by)
        if (hit === 'again') emit(ctx, 'jimao/command', 'start')
        else if (hit === 'title') emit(ctx, 'jimao/command', 'title')
      }
      const sy = by - 26 - 30 - 52
      stats([
        ['用时', formatTime(g.time)],
        ['命中率', `${Math.round(r.acc * 100)}%`],
        ['击毁目标', String(g.stats.kills)],
        ['弱点命中', String(g.stats.weak)],
        ['重新部署', `${g.retries}`],
      ], x, sy, a)
      const ry = sy - 30 - 40
      spaced('行动评级', x, ry, { size: 11, bold: true, spacing: 0.2, color: C.steel, alpha: a })
      const rw = spaced(r.label, x, ry + 18, { size: 30, bold: true, color: C.signal, alpha: a })
      for (let i = 0; i < 5; i++) ui.rect(x + rw + 20 + i * 22, ry + 34, 16, 6, i < r.score ? C.signal : C.steel, { alpha: a * (i < r.score ? 1 : 0.35) })
      heading('四号泊位 · 行动简报', '几猫港区已解除封锁', x, ry - 30, Math.round(clamp(W * 0.05, 36, 72)), a)
    }
  })
}
