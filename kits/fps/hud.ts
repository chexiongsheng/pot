/**
 * 第一人称 HUD 的画法（004 第 19.5 节第 9 步）：罗盘与准星。只画，不管布局：游戏在界面树的 <canvas> 里调用，
 * 颜色、标记、数据都由参数给。saltline 的 HUD 用它们；换一种玩法（大逃杀）照样用得上。
 *
 *   <canvas w={520} h={56} draw={(d, b) => drawCompass(d, { x: b.x, y: b.y, w: b.w, yaw, origin: pos, marks, alpha: b.alpha })} />
 */
import type { UIService, Vec3 } from '@pot/core'

const DEG = 180 / Math.PI

/** 方向向量的偏航（度，0 朝 +Z，同 moveFps.yaw） */
export const yawTo = (from: Vec3, to: Vec3) => Math.atan2(to[0] - from[0], to[2] - from[2]) * DEG

/** 从 from 转到 to 的最小角（度，-180 到 180） */
export function angleDelta(from: number, to: number) {
  let d = (to - from) % 360
  if (d > 180) d -= 360
  if (d < -180) d += 360
  return d
}

export interface CompassMark {
  /** 世界坐标 */
  pos: Vec3
  /** 方块底色 */
  color: string
  /** 方块上的字（一两个字） */
  label: string
  labelColor?: string
}

export interface CompassOptions {
  /** 刻度带的左上角与宽；刻度带高 30，标记方块画在其下 4 到 22 像素 */
  x: number
  y: number
  w: number
  /** 观察者的偏航（度）与位置 */
  yaw: number
  origin: Vec3
  /** 半边可见的角度（80） */
  span?: number
  /** 目标标记（超出可见范围时贴边、半透明） */
  marks?: CompassMark[]
  /** 威胁方向（刻度带顶上的短条，超出可见范围的不画） */
  threats?: Vec3[]
  /** 四向文字（北东南西） */
  names?: [string, string, string, string]
  colors?: { bg?: string; text?: string; north?: string; major?: string; minor?: string; threat?: string; pointer?: string }
  alpha?: number
}

/** 罗盘（原版 saltline HUD）：每 15° 一格，45° 长刻度，90° 写方向字，正北高亮；中线指针 */
export function drawCompass(d: UIService, o: CompassOptions) {
  const a = o.alpha ?? 1
  const c = { bg: '#0b0d0f', text: '#e8e4da', north: '#ffb347', major: '#e8e4da', minor: '#8d9aa3', threat: '#ff5a40', pointer: '#ffb347', ...o.colors }
  const names = o.names ?? ['北', '东', '南', '西']
  const span = o.span ?? 80
  const cx = o.x + o.w / 2, top = o.y, half = o.w / 2
  d.rect(o.x, top, o.w, 30, c.bg, { alpha: 0.45 * a, radius: 4 })
  const yaw = ((o.yaw % 360) + 360) % 360
  for (let deg = 0; deg < 360; deg += 15) {
    const dd = angleDelta(yaw, deg)
    if (Math.abs(dd) > span) continue
    const x = cx + (dd / span) * half
    const fade = (1 - Math.abs(dd) / span) * a
    if (deg % 90 === 0) d.text(names[deg / 90], x, top + 15, { size: 16, bold: true, color: deg === 0 ? c.north : c.text, align: 'center', valign: 'middle', alpha: fade })
    else if (deg % 45 === 0) d.line(x, top + 6, x, top + 24, c.major, 2, fade * 0.7)
    else d.line(x, top + 10, x, top + 20, c.minor, 1, fade * 0.6)
  }
  for (const m of o.marks ?? []) {
    const dd = angleDelta(yaw, yawTo(o.origin, m.pos))
    const x = cx + Math.max(-1, Math.min(1, dd / span)) * half
    d.rect(x - 9, top + 34, 18, 18, m.color, { radius: 3, alpha: (Math.abs(dd) > span ? 0.5 : 1) * a })
    d.text(m.label, x, top + 43, { size: 12, bold: true, color: m.labelColor ?? c.bg, align: 'center', valign: 'middle', alpha: a })
  }
  for (const t of o.threats ?? []) {
    const dd = angleDelta(yaw, yawTo(o.origin, t))
    if (Math.abs(dd) > span) continue
    d.rect(cx + (dd / span) * half - 3, top + 1, 6, 4, c.threat, { alpha: a })
  }
  d.line(cx, top - 4, cx, top + 4, c.pointer, 2, a)
}

/** 准星张开的像素：base 加散布（弧度）在屏幕上的长度（按垂直 fov） */
export function crosshairGap(spread: number, fovDeg: number, screenH: number, base = 5) {
  return base + spread * (screenH / (2 * Math.tan((fovDeg * Math.PI) / 360)))
}

export interface CrosshairOptions {
  cx: number
  cy: number
  /** 四条短线离中心的距离（crosshairGap） */
  gap: number
  /** 开镜程度 0 到 1：短线随之淡出，中心点过半后换颜色 */
  ads?: number
  /** 命中标记：age 为秒（0.18 秒内显示），击杀更大 */
  marker?: { age: number; kill: boolean; weak: boolean } | null
  colors?: { line?: string; dot?: string; dotAds?: string; hit?: string; weak?: string; kill?: string }
  alpha?: number
}

/** 准星（原版 saltline HUD）：四条短线、中心点、命中时四个斜角 */
export function drawCrosshair(d: UIService, o: CrosshairOptions) {
  const a0 = o.alpha ?? 1
  const c = { line: '#e8e4da', dot: '#e8e4da', dotAds: '#ff5a40', hit: '#e8e4da', weak: '#ffb347', kill: '#ff5a40', ...o.colors }
  const { cx, cy, gap } = o
  const ads = o.ads ?? 0
  const a = (1 - ads * 0.85) * a0
  if (a > 0.05) {
    d.line(cx - gap - 8, cy, cx - gap, cy, c.line, 2, a)
    d.line(cx + gap, cy, cx + gap + 8, cy, c.line, 2, a)
    d.line(cx, cy - gap - 8, cx, cy - gap, c.line, 2, a)
    d.line(cx, cy + gap, cx, cy + gap + 8, c.line, 2, a)
  }
  d.rect(cx - 1.5, cy - 1.5, 3, 3, ads > 0.5 ? c.dotAds : c.dot, { radius: 1.5, alpha: a0 })
  const mk = o.marker
  if (mk && mk.age >= 0 && mk.age < 0.18) {
    const k = (1 - mk.age / 0.18) * a0
    const color = mk.kill ? c.kill : mk.weak ? c.weak : c.hit
    const s = mk.kill ? 12 : 9
    for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) d.line(cx + dx * 5, cy + dy * 5, cx + dx * s, cy + dy * s, color, 2.5, k)
  }
}
