/** HUD：指南针、任务目标、生命、弹药、准星与命中标记、击杀信息、无线电字幕、敌情警告、交互环、受伤暗角、渐黑 */
import type { Context } from '@pot/core'
import { setPostValues } from '@pot/kit/realistic'
import { levelPoints, type LevelData } from '@pot/kit/harbor/level'
import { angleDelta, clamp, formatTime, sub, yawOf } from '@pot/kit/realistic/math'
import { C } from '../lib/palette'
import { sfx } from '@pot/kit/realistic/sfx'
import { foes, game, phase, player, settings, weapon, type Phase, type Sl } from '../lib/types'
import { directorFade } from '../parts/director'
import type { SlEvents } from '../parts/state'

export const name = 'hud'

const NAMES = ['甲', '乙', '丙', '丁']

export function apply(ctx: Context) {
  const tuning = ctx.data.load('tuning.json')
  const level = ctx.data.load<LevelData>('level.json')
  const points = levelPoints(level)
  const ui = ctx.ui

  let radio = { text: '', t: 0 }
  let warn = { text: '', t: 0 }
  let message = { text: '', t: 0 }
  let marker = { t: 0, kill: false, weak: false }
  let feed: { text: string; weak: boolean; t: number }[] = []
  let hurtShown = ''
  let lowHealth = 0

  const w0 = ctx.world as any
  w0.on('slRadio', (_w: any, text: string) => { radio = { text, t: 0 }; ctx.audio.play(sfx('radio'), { volume: 0.5 }) })
  w0.on('slWarn', (_w: any, text: string) => { warn = { text, t: 0 } })
  w0.on('slMessage', (_w: any, text: string) => { message = { text, t: 0 } })
  w0.on('mechHurt', (_w: any, h: { killed: boolean; weak: boolean }) => {
    marker = { t: 0, kill: !!h.killed, weak: !!h.weak }
    ctx.audio.play(sfx(h.killed ? 'kill' : 'hit'), { volume: 0.5, pitch: h.weak ? 1.25 : 1 })
  })
  w0.on('slFeed', (_w: any, f: SlEvents['slFeed']) => {
    feed.unshift({ text: f.weak ? `${f.text} · 弱点命中` : f.text, weak: f.weak, t: 0 })
    feed = feed.slice(0, 5)
  })
  ctx.world.onFlowEnter(() => {
    warn.t = 99
    message.t = 99
    feed = []
  })

  ctx.on('update', (dt) => {
    const g = game(ctx), p = player(ctx), w = weapon(ctx)
    if (!g || !p || !w) return
    const ph = phase(ctx), fade = directorFade(ctx.world)
    const W = ui.width, H = ui.height
    const live = ph === 'playing' || ph === 'intro' || ph === 'paused' || ph === 'dead'
    if (ph !== 'paused') {
      radio.t += dt; warn.t += dt; message.t += dt; marker.t += dt
      for (const f of feed) f.t += dt
      feed = feed.filter((f) => f.t < 5)
    }

    // 受伤红边、低血量去饱和与暗角、ADS 边缘柔化：交给后处理链（lib/post.ts 的 grade pass）
    {
      const low = live ? clamp((0.55 - p.health / tuning.player.maxHealth) / (0.55 - 0.12), 0, 1) : 0
      lowHealth += (low * low * (3 - 2 * low) - lowHealth) * Math.min(1, dt * 4)
      const damage = live ? clamp(p.hurt, 0, 1) : 0
      const ads = live ? clamp(w.ads, 0, 1) : 0
      const key = [damage, lowHealth, ads].map((v) => Math.round(v * 200)).join(',')
      if (key !== hurtShown) {
        hurtShown = key
        setPostValues(ctx.world as any, { uDamage: damage, uLowHealth: lowHealth, uAds: ads })
      }
    }

    if (ph === 'playing' || ph === 'intro' || ph === 'paused') {
      drawCompass(W, g.relays.every((r) => r === 'cut'))
      drawObjectives(g)
      drawHealth(H, p.health / tuning.player.maxHealth)
      drawAmmo(W, H, w)
      if (ph !== 'paused') drawCrosshair(W, H, w)
      drawInteract(W, H, g, ph)
      drawFeed(W)
      drawWarn(W)
      drawMessage(W, H)
    }
    if (ph !== 'title') drawRadio(W, H)

    if (fade > 0.001) ui.rect(0, 0, W, H, C.ink, { alpha: fade })
    if (ph === 'intro') {
      const a = clamp(Math.min(g.t * 2, fade * 2.5), 0, 1)
      ui.text('行动代号 · 港区突击', W / 2, H / 2 - 20, { size: 34, color: C.bone, align: 'center', valign: 'middle', bold: true, alpha: a })
      ui.text(g.retries > 0 || g.relays.some((r) => r === 'cut') ? `重新部署 · 第 ${g.retries} 次` : '切断三处中继 · 撤离港区', W / 2, H / 2 + 22, { size: 18, color: C.signal, align: 'center', valign: 'middle', alpha: a })
    }
  })

  function drawCompass(W: number, extract: boolean) {
    const p = player(ctx)!
    const g = game(ctx)!
    const cw = Math.min(520, W * 0.5), cx = W / 2, top = 16, span = 80
    ui.rect(cx - cw / 2, top, cw, 30, C.ink, { alpha: 0.45, radius: 4 })
    const yaw = ((p.yaw % 360) + 360) % 360
    for (let a = 0; a < 360; a += 15) {
      const d = angleDelta(yaw, a)
      if (Math.abs(d) > span) continue
      const x = cx + (d / span) * (cw / 2)
      const fade = 1 - Math.abs(d) / span
      if (a % 90 === 0) {
        ui.text(['北', '东', '南', '西'][a / 90], x, top + 15, { size: 16, bold: true, color: a === 0 ? C.signal : C.bone, align: 'center', valign: 'middle', alpha: fade })
      } else if (a % 45 === 0) {
        ui.line(x, top + 6, x, top + 24, C.bone, 2, fade * 0.7)
      } else {
        ui.line(x, top + 10, x, top + 20, C.steel, 1, fade * 0.6)
      }
    }
    const mark = (pos: [number, number, number], color: string, label: string) => {
      const d = angleDelta(yaw, yawOf(sub(pos, p.pos)))
      const x = cx + clamp(d / span, -1, 1) * (cw / 2)
      ui.rect(x - 9, top + 34, 18, 18, color, { radius: 3, alpha: Math.abs(d) > span ? 0.5 : 1 })
      ui.text(label, x, top + 43, { size: 12, bold: true, color: C.ink, align: 'center', valign: 'middle' })
    }
    points.relays.forEach((r, i) => { if (g.relays[i] !== 'cut') mark(r.pos, C.signal, NAMES[i] ?? r.short) })
    if (extract) mark(points.extraction.pos, C.ok, '撤')
    for (const e of foes(ctx)) {
      if (e.mode !== 'combat') continue
      const d = angleDelta(yaw, yawOf(sub(e.pos, p.pos)))
      if (Math.abs(d) > span) continue
      const x = cx + (d / span) * (cw / 2)
      ui.rect(x - 3, top + 1, 6, 4, C.alarm)
    }
    ui.line(cx, top - 4, cx, top + 4, C.signal, 2)
  }

  function drawObjectives(g: Sl) {
    const x = 24, y = 20
    const allCut = g.relays.every((r) => r === 'cut')
    const n = g.relays.filter((r) => r === 'cut').length
    ui.rect(x, y, 4, allCut ? 64 : 34 + points.relays.length * 24, C.signal)
    ui.text('任务目标', x + 14, y, { size: 13, color: C.steel, bold: true })
    ui.text(formatTime(g.time), x + 250, y, { size: 13, color: C.steel, align: 'right' })
    if (allCut) {
      ui.text('前往码头撤离点', x + 14, y + 20, { size: 18, color: C.bone, bold: true, shadow: true })
      ui.text('撤离艇已在南端舷梯旁待命', x + 14, y + 44, { size: 13, color: C.ok, shadow: true })
      return
    }
    ui.text(`切断中继 ${n}/${points.relays.length}`, x + 14, y + 18, { size: 18, color: C.bone, bold: true, shadow: true })
    points.relays.forEach((r, i) => {
      const st = g.relays[i]
      const yy = y + 46 + i * 24
      ui.rect(x + 16, yy + 4, 10, 10, st === 'cut' ? C.steel : st === 'cutting' ? C.signal : C.alarm, { radius: 2, alpha: st === 'cut' ? 0.5 : 1 })
      ui.text(r.label, x + 34, yy, { size: 14, color: st === 'cut' ? C.steel : C.bone, shadow: true, alpha: st === 'cut' ? 0.6 : 1 })
      if (st === 'cut') ui.line(x + 34, yy + 9, x + 34 + ui.measure(r.label, 14).width, yy + 9, C.steel, 1, 0.8)
    })
  }

  function drawHealth(H: number, k: number) {
    const x = 24, y = H - 52
    ui.text('生命', x, y - 20, { size: 12, color: C.steel, bold: true })
    for (let i = 0; i < 10; i++) {
      const fill = clamp(k * 10 - i, 0, 1)
      ui.rect(x + i * 22, y, 18, 14, C.ink, { alpha: 0.5, radius: 2 })
      if (fill > 0) ui.rect(x + i * 22, y, 18 * fill, 14, k < 0.35 ? C.alarm : C.bone, { radius: 2, alpha: 0.9 })
    }
  }

  function drawAmmo(W: number, H: number, w: NonNullable<ReturnType<typeof weapon>>) {
    const x = W - 24, y = H - 40
    ui.text(String(w.mag), x - 70, y, { size: 40, bold: true, color: w.mag <= 6 ? C.alarm : C.bone, align: 'right', valign: 'bottom', shadow: true })
    ui.text(`/ ${w.reserve}`, x, y - 4, { size: 18, color: C.steel, align: 'right', valign: 'bottom', shadow: true })
    ui.text(tuning.weapon.name, x, y + 4, { size: 12, color: C.steel, align: 'right', bold: true })
    let hint = ''
    if (w.reloading) hint = '换弹中'
    else if (w.mag === 0 && w.reserve === 0) hint = '弹药不足'
    else if (w.mag <= 6) hint = 'R · 换弹'
    if (hint) ui.text(hint, W / 2, H / 2 + 58, { size: 15, color: w.reloading ? C.bone : C.alarm, align: 'center', bold: true, shadow: true })
    if (w.reloading) {
      const k = clamp(w.reloadT / w.reloadTotal, 0, 1)
      ui.rect(W / 2 - 50, H / 2 + 80, 100, 3, C.ink, { alpha: 0.6 })
      ui.rect(W / 2 - 50, H / 2 + 80, 100 * k, 3, C.bone)
    }
  }

  function drawCrosshair(W: number, H: number, w: NonNullable<ReturnType<typeof weapon>>) {
    const cx = W / 2, cy = H / 2
    const fovPx = H / (2 * Math.tan(((settings(ctx).fov ?? 74) * Math.PI / 180) / 2))
    const gap = 5 + w.spread * fovPx
    const a = 1 - w.ads * 0.85
    if (a > 0.05) {
      ui.line(cx - gap - 8, cy, cx - gap, cy, C.bone, 2, a)
      ui.line(cx + gap, cy, cx + gap + 8, cy, C.bone, 2, a)
      ui.line(cx, cy - gap - 8, cx, cy - gap, C.bone, 2, a)
      ui.line(cx, cy + gap, cx, cy + gap + 8, C.bone, 2, a)
    }
    ui.rect(cx - 1.5, cy - 1.5, 3, 3, w.ads > 0.5 ? C.alarm : C.bone, { radius: 1.5 })
    if (marker.t < 0.18) {
      const k = 1 - marker.t / 0.18
      const color = marker.kill ? C.alarm : marker.weak ? C.signal : C.bone
      const s = marker.kill ? 12 : 9
      for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) ui.line(cx + dx * 5, cy + dy * 5, cx + dx * s, cy + dy * s, color, 2.5, k)
    }
  }

  function drawInteract(W: number, H: number, g: Sl, ph: Phase) {
    const i = g.interact >= 0 ? g.interact : g.hint
    if (i < 0 || ph !== 'playing') return
    const cx = W / 2, cy = H / 2 + 110
    ui.arc(cx, cy, 24, C.ink, 6, 0, 360, 0.55)
    if (g.interact >= 0) ui.arc(cx, cy, 24, C.signal, 6, 0, 360 * clamp(g.progress, 0, 1))
    ui.text('E', cx, cy, { size: 18, bold: true, color: C.bone, align: 'center', valign: 'middle' })
    ui.text(`${g.interact >= 0 ? '切断中' : '按住 E · 切断中继'} ${NAMES[i] ?? ''}`, cx, cy + 40, { size: 15, color: C.bone, align: 'center', bold: true, shadow: true })
  }

  function drawFeed(W: number) {
    feed.forEach((f, i) => {
      const a = clamp((5 - f.t) / 0.6, 0, 1)
      const tw = ui.measure(f.text, 14, true).width
      const y = 84 + i * 28
      ui.rect(W - 34 - tw, y, tw + 20, 24, C.ink, { alpha: 0.5 * a, radius: 3 })
      ui.rect(W - 34 - tw, y, 3, 24, f.weak ? C.signal : C.alarm, { alpha: a })
      ui.text(f.text, W - 24, y + 12, { size: 14, bold: true, color: f.weak ? C.signal : C.bone, align: 'right', valign: 'middle', alpha: a })
    })
  }

  function drawWarn(W: number) {
    if (warn.t > 2.6 || !warn.text) return
    const a = clamp(Math.min(warn.t * 6, (2.6 - warn.t) * 3), 0, 1)
    const blink = warn.t < 0.6 ? (Math.sin(warn.t * 30) > 0 ? 1 : 0.5) : 1
    const tw = ui.measure(warn.text, 16, true).width
    ui.rect(W / 2 - tw / 2 - 18, 74, tw + 36, 30, C.alarm, { alpha: 0.2 * a, radius: 3 })
    ui.border(W / 2 - tw / 2 - 18, 74, tw + 36, 30, C.alarm, 1, { alpha: a, radius: 3 })
    ui.text(warn.text, W / 2, 89, { size: 16, bold: true, color: C.alarm, align: 'center', valign: 'middle', alpha: a * blink })
  }

  function drawMessage(W: number, H: number) {
    if (message.t > 2.4 || !message.text) return
    const a = clamp(Math.min(message.t * 5, (2.4 - message.t) * 2), 0, 1)
    ui.text(message.text, W / 2, H * 0.32, { size: 20, bold: true, color: C.bone, align: 'center', valign: 'middle', alpha: a, shadow: true })
  }

  function drawRadio(W: number, H: number) {
    if (!radio.text) return
    const life = 2.5 + radio.text.length * 0.09
    if (radio.t > life) return
    const a = clamp(Math.min(radio.t * 4, (life - radio.t) * 2), 0, 1)
    const bw = Math.min(720, W - 80)
    const y = H - 150
    ui.rect(W / 2 - bw / 2, y, bw, 64, C.ink, { alpha: 0.62 * a, radius: 4 })
    ui.rect(W / 2 - bw / 2, y, 3, 64, C.signal, { alpha: a })
    ui.text('指挥中心', W / 2 - bw / 2 + 16, y + 8, { size: 12, bold: true, color: C.signal, alpha: a })
    const shown = radio.text.slice(0, Math.floor(radio.t * 40))
    ui.text(shown, W / 2 - bw / 2 + 16, y + 26, { w: bw - 32, h: 36, size: 15, color: C.bone, alpha: a, wrap: true })
  }
}
