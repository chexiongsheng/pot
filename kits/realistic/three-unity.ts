/**
 * Three.js 右手系 → Unity 左手系：位置、矩阵分解（欧拉角或无分配的 TRS）、线性 HDR 颜色转 Runner 颜色与强度。
 * 原版 three 代码移植过来的网格与节点都用它对接 scene。
 */
import type { Vec3 } from '@pot/core'
import { Euler, Matrix4, Quaternion, Vector3 } from './vendor/three-geo'

export const toUnityPos = (v: { x: number; y: number; z: number }): Vec3 => [v.x, v.y, -v.z]

const S = new Matrix4().makeScale(1, 1, -1)
const _m = new Matrix4(), _p = new Vector3(), _q = new Quaternion(), _s = new Vector3(), _e = new Euler()
const DEG = 180 / Math.PI

/** 世界矩阵 → Unity 的位置、欧拉角（度，Unity 的 ZXY 顺序即 three 的 'YXZ'）、缩放 */
export function toUnityTransform(matrixWorld: any) {
  _m.multiplyMatrices(S, matrixWorld).multiply(S)
  _m.decompose(_p, _q, _s)
  _e.setFromQuaternion(_q, 'YXZ')
  return {
    position: [_p.x, _p.y, _p.z] as Vec3,
    rotation: [_e.x * DEG, _e.y * DEG, _e.z * DEG] as Vec3,
    scale: [_s.x, _s.y, _s.z] as Vec3,
  }
}

const snap1 = (v: number) => (Math.abs(v - 1) < 1e-5 ? 1 : v)

/**
 * 无分配版本：把位置(3)、四元数(4)、缩放(3) 共 10 个数写到 out[offset..]，给 scene.setTransforms 用。
 * S·M·S 分解出的四元数分量可直接当 Unity 四元数。
 */
export function writeUnityTRS(matrixWorld: any, out: Float32Array, offset: number) {
  _m.multiplyMatrices(S, matrixWorld).multiply(S)
  _m.decompose(_p, _q, _s)
  out[offset] = _p.x; out[offset + 1] = _p.y; out[offset + 2] = _p.z
  out[offset + 3] = _q.x; out[offset + 4] = _q.y; out[offset + 5] = _q.z; out[offset + 6] = _q.w
  out[offset + 7] = snap1(_s.x); out[offset + 8] = snap1(_s.y); out[offset + 9] = snap1(_s.z)
}

const toSrgb = (v: number) => (v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055)
const hex2 = (v: number) => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, '0')

/** 线性 HDR 颜色 → Runner 的 { 颜色(sRGB), 强度 }：最大分量大于 1 时归一化，强度承担倍数 */
export function hdr(c: { r: number; g: number; b: number }): { color: string; intensity: number } {
  const m = Math.max(c.r, c.g, c.b, 1e-6)
  const k = m > 1 ? m : 1
  return { color: `#${hex2(toSrgb(c.r / k))}${hex2(toSrgb(c.g / k))}${hex2(toSrgb(c.b / k))}`, intensity: k }
}
