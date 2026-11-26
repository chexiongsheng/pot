import type { Vec3 } from '@pot/core'

export const DEG = 180 / Math.PI
export const RAD = Math.PI / 180

export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v)
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t

/** 平滑阶梯（原版 sl） */
export function smoothstep(a: number, b: number, v: number) {
  const t = clamp((v - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
}

/** 指数逼近（原版 kn）：rate 越大越快，与帧率无关 */
export function damp(current: number, target: number, rate: number, dt: number) {
  return target + (current - target) * Math.exp(-rate * dt)
}

export function approach(current: number, target: number, step: number) {
  return current < target ? Math.min(target, current + step) : Math.max(target, current - step)
}

/** 角度差，结果在 -180..180 */
export function angleDelta(from: number, to: number) {
  let d = (to - from) % 360
  if (d > 180) d -= 360
  if (d < -180) d += 360
  return d
}

export const v3 = (x = 0, y = 0, z = 0): Vec3 => [x, y, z]
export const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
export const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
export const scale = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k]
export const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
export const len = (a: Vec3) => Math.hypot(a[0], a[1], a[2])
export const dist = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
export const dist2d = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[2] - b[2])
export const copy = (a: Vec3): Vec3 => [a[0], a[1], a[2]]

export function norm(a: Vec3): Vec3 {
  const l = len(a) || 1
  return [a[0] / l, a[1] / l, a[2] / l]
}

export function set(out: Vec3, a: Vec3) {
  out[0] = a[0]
  out[1] = a[1]
  out[2] = a[2]
  return out
}

/** Unity 约定：yaw 0 朝 +z（北），90 朝 +x（东）；pitch 正值向下看（度） */
export function forward(yaw: number, pitch = 0): Vec3 {
  const y = yaw * RAD, p = pitch * RAD
  return [Math.sin(y) * Math.cos(p), -Math.sin(p), Math.cos(y) * Math.cos(p)]
}

export function right(yaw: number): Vec3 {
  const y = yaw * RAD
  return [Math.cos(y), 0, -Math.sin(y)]
}

/** 方向向量 → yaw（度） */
export function yawOf(dir: Vec3) {
  return Math.atan2(dir[0], dir[2]) * DEG
}

/** 在方向 dir 周围随机偏移（锥形，spread 为弧度量级） */
export function jitter(dir: Vec3, spread: number, rand: () => number): Vec3 {
  const a = rand() * Math.PI * 2
  const r = Math.sqrt(rand()) * spread
  // 构造与 dir 正交的两个基
  const up: Vec3 = Math.abs(dir[1]) > 0.95 ? [1, 0, 0] : [0, 1, 0]
  const u = norm(cross(dir, up))
  const v = cross(u, dir)
  return norm([
    dir[0] + (u[0] * Math.cos(a) + v[0] * Math.sin(a)) * r,
    dir[1] + (u[1] * Math.cos(a) + v[1] * Math.sin(a)) * r,
    dir[2] + (u[2] * Math.cos(a) + v[2] * Math.sin(a)) * r,
  ])
}

export function cross(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
}

/** 可复现随机数（原版 aA，mulberry32 变体） */
export function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s |= 0
    s = (s + 1831565813) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Catmull-Rom 插值（标题镜头路径） */
export function catmull(points: Vec3[], t: number): Vec3 {
  const n = points.length - 1
  const x = clamp(t, 0, 1) * n
  const i = Math.min(n - 1, Math.floor(x))
  const f = x - i
  const p0 = points[Math.max(0, i - 1)], p1 = points[i], p2 = points[i + 1], p3 = points[Math.min(n, i + 2)]
  const f2 = f * f, f3 = f2 * f
  const k = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * f + (2 * a - 5 * b + 4 * c - d) * f2 + (-a + 3 * b - 3 * c + d) * f3)
  return [k(p0[0], p1[0], p2[0], p3[0]), k(p0[1], p1[1], p2[1], p3[1]), k(p0[2], p1[2], p2[2], p3[2])]
}

/** 点到线段的最近距离 */
export function segmentDistance(p: Vec3, a: Vec3, b: Vec3) {
  const ab = sub(b, a)
  const l2 = dot(ab, ab) || 1e-9
  const t = clamp(dot(sub(p, a), ab) / l2, 0, 1)
  return dist(p, [a[0] + ab[0] * t, a[1] + ab[1] * t, a[2] + ab[2] * t])
}

export function formatTime(seconds: number) {
  const s = Math.max(0, Math.floor(seconds))
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}
