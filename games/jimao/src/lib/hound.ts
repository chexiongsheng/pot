// @ts-nocheck
/**
 * 机械猎犬：原版 Z_（模型）、iu（刚性骨骼 rig）、q_（两段腿 IK）、H（步态）、O（姿态）、q/U（死亡）的机械移植。
 * 原版用 SkinnedMesh + 每顶点 1 根骨骼（权重 1），等价于"每根骨骼一个刚体"：
 * 这里在 Three.js 坐标里搭同样的 Object3D 骨骼层级，每帧按原版代码设旋转，再把各骨骼的世界矩阵经 toUnityTransform 写到 Runner 实体。
 * 坐标为原版右手系（模型朝 +Z），几何经 geo.toMesh() 翻转。
 */
import { Vector3, Matrix4, Quaternion, SphereGeometry, TorusGeometry, Object3D, BufferAttribute } from '../vendor/three-geo'
import { Wi, ot, Fn, Dc, sa } from './orig/port'
import { toMesh } from './geo'
import { ENEMY_LAYER } from './level'
import { hdr, toUnityTransform } from './origlevel'

const W = Vector3, Ye = Matrix4, Lt = Quaternion, ls = SphereGeometry, Ci = TorusGeometry

// ---- 原版 rig（iu）：骨骼只有平移，几何按骨骼局部坐标保存（等价于原版 translate(world) + 逆绑定矩阵） ----
class Rig {
  constructor() { this.bones = []; this.index = {}; this.groups = new Map() }
  bone(name, parent, x, y, z) {
    if (parent !== null && !(parent in this.index)) throw new Error('rig: unknown parent bone ' + parent)
    this.index[name] = this.bones.length
    this.bones.push({ name, parent, local: [x, y, z] })
  }
  add(slot, bone, g, color = [1, 1, 1], shade = true) {
    if (!(bone in this.index)) throw new Error('rig: unknown bone ' + bone)
    let a = g.index ? g.toNonIndexed() : g
    a.attributes.normal || a.computeVertexNormals()
    for (const p of Object.keys(a.attributes)) p !== 'position' && p !== 'normal' && p !== 'uv' && a.deleteAttribute(p)
    const l = a.attributes.position.count
    a.attributes.uv || a.setAttribute('uv', new BufferAttribute(new Float32Array(l * 2), 2))
    const c = new Float32Array(l * 3), f = a.attributes.normal
    for (let p = 0; p < l; p++) {
      const d = shade ? 0.74 + 0.26 * (f.getY(p) * 0.5 + 0.5) : 1
      c[p * 3] = color[0] * d; c[p * 3 + 1] = color[1] * d; c[p * 3 + 2] = color[2] * d
    }
    a.setAttribute('color', new BufferAttribute(c, 3))
    const key = bone + '|' + slot
    let list = this.groups.get(key)
    if (!list) this.groups.set(key, (list = []))
    list.push(a)
    return this
  }
  build() {
    const parts = []
    for (const [key, list] of this.groups) {
      const [bone, slot] = key.split('|')
      parts.push({ bone, slot, geometry: sa(list, false) })
    }
    return { bones: this.bones, parts }
  }
}

// ---- 原版颜色常量与建模辅助（逐字） ----
const Ss = [1.15, 1.15, 1.15], vm = [0.95, 0.96, 0.97], Ts = [1, 0.34, 0.08], s0 = [0.1, 0.11, 0.12], ga = [0.035, 0.035, 0.038]
const Of = [1, 0.7, 0.07], As = [1, 1, 1], Yn = [2.4, 2.5, 2.6], an = [0.45, 0.46, 0.48], IC = [9, 9, 9.6], zC = [5.5, 4, 1.6]
const va = Math.PI / 2
const ft = (i, e, t, n = 0.008) => Wi(i, e, t, n)
const Ce = (i, e, t, n, s = 0, o = 0, r = 0, a = 1) => Dc(i, { p: [e, t, n], r: [s, o, r], s: a })
const ds = (i, e, t, n = 12) => ot(i, e, t, n)
const Ro = (i, e, t, n = 12) => Dc(ot(i, e, t, n), { r: [0, 0, -va] })
const Si = (i, e, t, n = 12) => Dc(ot(i, e, t, n), { r: [va, 0, 0] })
const mm = new W(), gm = new W(), X_ = new Lt(), DC = new W(0, 1, 0), Y_ = new Ye(), LC = new W(1, 1, 1)
function su(i, e, t, n = t, s = 8) {
  mm.set(i[0], i[1], i[2]), gm.set(e[0], e[1], e[2])
  const o = mm.distanceTo(gm), r = ot(n, t, o, s)
  return X_.setFromUnitVectors(DC, gm.clone().sub(mm).normalize()), Y_.compose(mm.clone().add(gm).multiplyScalar(0.5), X_, LC), r.applyMatrix4(Y_), r
}
const Ur = (i, e = 14, t = 10, n = 1, s = 1, o = 1) => { const r = new ls(i, e, t); return r.scale(n, s, o), r }
const $_ = (i, e, t) => Ce(Ro(0.0075, 0.0075, 0.006, 6), i, e, t)
const Yv = (i, e, t) => Ce(ds(0.0075, 0.0075, 0.006, 6), i, e, t)
const kC = (i, e, t) => Ce(Si(0.0075, 0.0075, 0.006, 6), i, e, t)

/** 原版 $v：站高、大腿/小腿长、髋外展偏移、髋位、落脚点 */
export const HOUND = {
  stand: 0.72, L1: 0.4, L2: 0.42, l0: 0.075, hipX: 0.165, hipY: -0.01, hipZ: 0.4, footX: 0.275, footZ: [0.37, 0.37, -0.42, -0.42],
  legs: ['FL', 'FR', 'RL', 'RR'], side: [1, -1, 1, -1], fore: [1, 1, -1, -1], muzzle: [0, 0, 0.43], eye: [0, 0, 0.14], footR: 0.046,
}

// ---- 原版 Z_：猎犬模型（逐字） ----
function Z_() {
  const i = HOUND, e = new Rig()
  e.bone('root', null, 0, 0, 0), e.bone('body', 'root', 0, i.stand, 0), e.bone('neck', 'body', 0, 0.06, 0.49), e.bone('head', 'neck', 0, 0.13, 0.12), e.bone('turret', 'body', 0, 0.152, -0.03), e.bone('gun', 'turret', 0, 0.095, 0.02), e.bone('antenna', 'body', -0.105, 0.15, -0.46), e.bone('beacon', 'body', 0.105, 0.2, -0.455)
  for (let n = 0; n < 4; n++) {
    const s = i.legs[n], o = i.side[n]
    e.bone('abd' + s, 'body', o * i.hipX, i.hipY, i.fore[n] * i.hipZ), e.bone('thigh' + s, 'abd' + s, o * i.l0, 0, 0), e.bone('shin' + s, 'thigh' + s, 0, -i.L1, 0)
  }
  const t = (n, s, o, r, a) => e.add(n, s, o, r, a)
  t('metal', 'body', Ce(ft(0.27, 0.2, 0.98, 0.02), 0, -0.01, 0), an), t('shell', 'body', Ce(ft(0.35, 0.05, 0.3, 0.014), 0, 0.125, 0.33), Ss), t('shell', 'body', Ce(ft(0.35, 0.05, 0.36, 0.014), 0, 0.125, -0.012), Ss), t('shell', 'body', Ce(ft(0.1, 0.052, 0.36, 0.01), 0, 0.126, -0.012 + 0), vm)
  for (const n of [-0.15, 0.15]) for (const s of [0.21, 0.45, -0.17, 0.145]) t('metal', 'body', Yv(n, 0.152, s), Yn)
  t('metal', 'body', Ce(ft(0.31, 0.03, 0.25, 0.006), 0, 0.112, -0.335), As)
  for (let n = 0; n < 10; n++) t('metal', 'body', Ce(ft(0.007, 0.062, 0.225, 0.002), -0.126 + n * 0.028, 0.155, -0.335), Yn)
  t('metal', 'body', Ce(ft(0.3, 0.012, 0.02, 0.003), 0, 0.186, -0.24), an), t('metal', 'body', Ce(ft(0.3, 0.012, 0.02, 0.003), 0, 0.186, -0.43), an)
  for (const n of [1, -1]) {
    t('shell', 'body', Ce(ft(0.032, 0.15, 0.31, 0.012), n * 0.15, 0.022, -0.075), Ss), t('shell', 'body', Ce(ft(0.032, 0.15, 0.135, 0.012), n * 0.15, 0.022, 0.1625), vm), t('metal', 'body', Fn([[n * 0.168, 0.06, 0.125], [n * 0.182, 0.06, 0.135], [n * 0.182, 0.06, 0.19], [n * 0.168, 0.06, 0.2]], 0.005, 5), Yn), t('shell', 'body', Ce(ft(0.034, 0.016, 0.135, 0.004), n * 0.151, -0.035, 0.1625), Of), t('shell', 'body', Ce(ft(0.034, 0.042, 0.46, 0.008), n * 0.151, -0.078, 0), Ts), t('shell', 'body', Ce(ft(0.028, 0.1, 0.11, 0.008), n * 0.146, 0.01, 0.305), s0)
    for (let s = 0; s < 4; s++) t('metal', 'body', Ce(ft(0.004, 0.012, 0.085, 0.001), n * 0.161, -0.02 + s * 0.022, 0.305), an)
    for (const s of [-0.035, 0.08]) for (const o of [-0.21, 0.06, 0.115, 0.21]) t('metal', 'body', $_(n * 0.167, s, o), Yn)
    t('metal', 'body', Fn([[n * 0.135, 0.148, -0.19], [n * 0.135, 0.205, -0.16], [n * 0.135, 0.212, 0], [n * 0.135, 0.205, 0.43], [n * 0.135, 0.148, 0.465]], 0.0105, 6), Yn)
    for (const s of [0, 0.26]) t('metal', 'body', Ce(ds(0.008, 0.008, 0.06, 6), n * 0.135, 0.178, s), Yn)
    t('shell', 'body', Fn([[n * 0.118, -0.105, -0.36], [n * 0.132, -0.118, -0.2], [n * 0.13, -0.112, 0.1], [n * 0.118, -0.1, 0.36]], 0.009, 5), ga), t('metal', 'body', Ce(new Ci(0.02, 0.005, 5, 10), n * 0.17, 0.085, -0.335, 0, va, 0), Yn)
  }
  t('shell', 'body', Ce(ft(0.3, 0.15, 0.075, 0.018), 0, -0.005, 0.505), Ts), t('shell', 'body', Ce(ft(0.2, 0.07, 0.02, 0.006), 0, 0.012, 0.545), s0)
  for (let n = 0; n < 6; n++) t('shell', 'body', Ce(ft(0.05, 0.034, 0.014, 0.003), -0.125 + n * 0.05, -0.098, 0.538, 0, 0, 0), n % 2 ? s0 : Of)
  for (const n of [-0.115, 0.115]) t('metal', 'body', Ce(Si(0.021, 0.021, 0.014, 10), n, 0.012, 0.547), an), t('glow', 'body', Ce(Si(0.015, 0.015, 0.004, 10), n, 0.012, 0.556), [6.5, 4.6, 2.2], !1)
  t('metal', 'body', Ce(ft(0.24, 0.095, 0.56, 0.02), 0, -0.145, 0), As), t('shell', 'body', Ce(ft(0.246, 0.03, 0.09, 0.006), 0, -0.14, 0.12), Ts), t('shell', 'body', Ce(ft(0.246, 0.03, 0.09, 0.006), 0, -0.14, -0.12), Ts), t('shell', 'body', Ce(ft(0.29, 0.15, 0.05, 0.014), 0, 0, -0.495), Ss), t('shell', 'body', Ce(ft(0.17, 0.05, 0.012, 0.004), 0, 0.03, -0.523), s0), t('glow', 'body', Ce(ft(0.13, 0.012, 0.004, 0.001), 0, 0.03, -0.531), [5, 0.3, 0.1], !1), t('metal', 'body', Ce(Si(0.022, 0.022, 0.02, 10), 0.085, -0.035, -0.525), Yn), t('metal', 'body', Ce(new Ci(0.024, 0.006, 5, 10), -0.07, -0.05, -0.528, va, 0, 0), Yn)
  for (const n of [-0.125, 0.125]) for (const s of [-0.055, 0.055]) t('metal', 'body', kC(n, s, -0.523), Yn)
  t('shell', 'body', Fn([[0.09, 0.15, -0.2], [0.13, 0.2, -0.16], [0.12, 0.2, -0.08], [0.09, 0.165, -0.05]], 0.009, 5), ga), t('metal', 'neck', su([0, -0.02, -0.02], [0, 0.11, 0.1], 0.045, 0.036, 10), an)
  for (let n = 0; n < 3; n++) {
    const s = 0.2 + n * 0.28
    t('shell', 'neck', su([0, -0.02 + 0.13 * s - 0.008, -0.02 + 0.12 * s - 0.0075], [0, -0.02 + 0.13 * s + 0.008, -0.02 + 0.12 * s + 0.0075], 0.052, 0.052, 10), ga)
  }
  t('shell', 'neck', Ce(ft(0.13, 0.05, 0.1, 0.012), 0, -0.01, -0.03), Ss), t('shell', 'neck', Fn([[0.05, -0.02, -0.04], [0.07, 0.05, 0.02], [0.06, 0.11, 0.07], [0.045, 0.12, 0.1]], 0.007, 5), ga), t('shell', 'head', Ce(ft(0.19, 0.118, 0.25, 0.03), 0, 0, 0), Ss), t('shell', 'head', Ce(ft(0.168, 0.074, 0.03, 0.012), 0, -0.004, 0.118), s0), t('lens', 'head', Ce(ft(0.128, 0.024, 0.006, 0.002), 0, 0.006, 0.1345), [1, 1, 1], !1)
  for (const n of [-0.056, 0.056]) t('metal', 'head', Ce(Si(0.015, 0.015, 0.012, 10), n, -0.022, 0.132), an), t('metal', 'head', Ce(Si(0.009, 0.009, 0.004, 8), n, -0.022, 0.139), [0.1, 0.12, 0.2])
  t('shell', 'head', Ce(ft(0.062, 0.008, 0.2, 0.003), 0, 0.06, -0.005), Ts), t('metal', 'head', Ce(Ro(0.032, 0.032, 0.214, 12), 0, 0, -0.055), an)
  for (const n of [1, -1]) t('shell', 'head', Ce(Ro(0.022, 0.022, 0.006, 10), n * 0.108, 0, -0.055), Ts)
  t('metal', 'head', Ce(ds(0.036, 0.036, 0.026, 14), 0, 0.072, -0.05), an), t('metal', 'head', Ce(ds(0.037, 0.037, 0.006, 14), 0, 0.074, -0.05), [0.2, 0.3, 0.5]), t('metal', 'head', Ce(ft(0.12, 0.03, 0.13, 0.008), 0, -0.068, 0.02), As)
  for (const n of [-0.08, 0.08]) for (const s of [-0.09, 0.07]) t('metal', 'head', Yv(n, 0.061, s), Yn)
  t('metal', 'turret', Ce(ds(0.105, 0.118, 0.034, 18), 0, 0, 0), an), t('metal', 'turret', Ce(ft(0.18, 0.02, 0.16, 0.005), 0, 0.026, 0), As)
  for (const n of [1, -1]) t('shell', 'turret', Ce(ft(0.028, 0.115, 0.15, 0.012), n * 0.078, 0.085, 0.005), Ss), t('metal', 'turret', Ce(Ro(0.022, 0.022, 0.008, 10), n * 0.094, 0.095, 0.02), Yn)
  t('shell', 'gun', Ce(ft(0.108, 0.086, 0.21, 0.016), 0, 0, -0.012), Ss), t('shell', 'gun', Ce(ft(0.11, 0.02, 0.212, 0.006), 0, -0.022, -0.012), Ts), t('metal', 'gun', Ce(Si(0.035, 0.035, 0.11, 12), 0, 0, 0.145), an)
  for (let n = 0; n < 4; n++) t('metal', 'gun', Ce(Si(0.039, 0.039, 0.008, 12), 0, 0, 0.105 + n * 0.026), As)
  t('metal', 'gun', Ce(Si(0.022, 0.024, 0.3, 12), 0, 0, 0.25), As), t('metal', 'gun', Ce(Si(0.036, 0.036, 0.06, 10), 0, 0, 0.395), an), t('metal', 'gun', Ce(ft(0.08, 0.012, 0.025, 0.003), 0, 0, 0.395), [0.15, 0.15, 0.15]), t('metal', 'gun', Ce(Ro(0.056, 0.056, 0.06, 14), 0.084, -0.004, -0.045), an), t('metal', 'gun', Ce(Ro(0.02, 0.02, 0.066, 8), 0.084, -0.004, -0.045), zC), t('metal', 'gun', Ce(ft(0.036, 0.036, 0.095, 0.008), -0.03, 0.06, 0), an), t('glow', 'gun', Ce(Si(0.011, 0.011, 0.003, 8), -0.03, 0.06, 0.049), [1.6, 0.12, 0.05], !1), t('shell', 'gun', Fn([[0.05, -0.03, -0.11], [0.06, -0.07, -0.13], [0.04, -0.09, -0.1]], 0.008, 5), ga), t('metal', 'body', Ce(ds(0.022, 0.026, 0.05, 10), 0.105, 0.175, -0.455), an), t('glow', 'beacon', Ce(Ur(0.02, 10, 6, 1, 1.25, 1), 0, 0.012, 0), [14, 5.5, 0.5], !1), t('metal', 'antenna', Ce(ds(0.011, 0.014, 0.05, 8), 0, 0.025, 0), an), t('metal', 'antenna', Ce(ds(0.0028, 0.005, 0.62, 5), 0, 0.36, 0), an), t('shell', 'antenna', Ce(Ur(0.009, 6, 4), 0, 0.67, 0), Ts)
  for (let n = 0; n < 4; n++) {
    const s = i.legs[n], o = i.side[n], r = 'abd' + s, a = 'thigh' + s, l = 'shin' + s
    t('metal', r, Ce(Si(0.06, 0.06, 0.17, 14), -o * 0.02, 0, 0), an), t('shell', r, Ce(ft(0.11, 0.05, 0.155, 0.014), o * 0, 0.058, 0), Ss), t('metal', r, Ce(Si(0.03, 0.03, 0.18, 8), -o * 0.02, 0, 0), Yn), t('shell', a, Ce(Ro(0.078, 0.078, 0.07, 18), 0, 0, 0), Ss), t('shell', a, Ce(Ro(0.081, 0.081, 0.016, 18), o * 0.012, 0, 0), Ts), t('metal', a, Ce(Ro(0.048, 0.048, 0.082, 12), 0, 0, 0), an)
    for (let c = 0; c < 5; c++) {
      const u = c * 1.2566
      t('metal', a, $_(o * 0.039, Math.cos(u) * 0.062, Math.sin(u) * 0.062), Yn)
    }
    t('shell', a, Ce(ft(0.062, i.L1 - 0.07, 0.1, 0.022), 0, -i.L1 * 0.5 - 0.005, 0.004), Ss), t('metal', a, Ce(ft(0.044, i.L1 - 0.04, 0.06, 0.012), 0, -i.L1 * 0.5, -0.035), an), t('shell', a, Ce(ft(0.065, 0.045, 0.103, 0.01), 0, -0.145, 0.004), Ts), t('shell', a, Ce(ft(0.064, 0.012, 0.102, 0.004), 0, -0.26, 0.004), s0), t('metal', a, su([0, -0.06, -0.082], [0, -i.L1 * 0.62, -0.078], 0.021, 0.021, 10), Yn), t('metal', a, su([0, -i.L1 * 0.62, -0.078], [0, -i.L1 + 0.025, -0.058], 0.009, 0.009, 6), IC), t('metal', a, Ce(ft(0.05, 0.03, 0.035, 0.006), 0, -0.055, -0.07), As), t('shell', a, Fn([[o * 0.036, -0.02, 0.05], [o * 0.044, -0.13, 0.062], [o * 0.042, -0.28, 0.058], [o * 0.034, -i.L1 + 0.03, 0.035]], 0.0065, 5), ga), t('metal', a, Ce(Ro(0.05, 0.05, 0.086, 14), 0, -i.L1, 0), an), t('shell', a, Ce(Ro(0.036, 0.036, 0.092, 12), 0, -i.L1, 0), vm), t('metal', l, Ce(ds(0.03, 0.021, i.L2 - 0.08, 10), 0, -(i.L2 - 0.08) / 2 - 0.01, 0), an), t('shell', l, Ce(ft(0.052, 0.21, 0.04, 0.014), 0, -0.14, 0.02), Ss), t('shell', l, Ce(ft(0.054, 0.02, 0.042, 0.006), 0, -0.215, 0.02), Ts), t('metal', l, Ce(ft(0.03, 0.06, 0.05, 0.008), 0, -0.02, -0.03), As), t('metal', l, Ce(ds(0.024, 0.03, 0.03, 10), 0, -i.L2 + 0.085, 0), Yn), t('shell', l, Ce(Ur(i.footR + 0.002, 12, 8, 1, 0.86, 1.08), 0, -i.L2 + i.footR * 0.86, 0.004), ga)
  }
  return e.build()
}

let cached = null
/** 模型只建一次（约 2 万三角形），各只猎犬共用网格 */
export function houndDef() {
  return cached || (cached = Z_())
}

// ---- 原版 q_：髋外展 + 两段腿 IK ----
function q_(i, e, t, n, s, o, r, a) {
  const l = e * e + t * t, c = Math.sqrt(Math.max(l - o * o, 1e-6))
  i.abd = Math.atan2(t, e) - Math.atan2(-c, s * o), i.abd > Math.PI ? i.abd -= 2 * Math.PI : i.abd < -Math.PI && (i.abd += 2 * Math.PI)
  let u = Math.hypot(c, n)
  const h = (r + a) * 0.995, f = Math.abs(r - a) + 0.03
  i.reach = u / (r + a), u > h ? u = h : u < f && (u = f)
  const p = Math.atan2(n, c), d = (r * r + u * u - a * a) / (2 * r * u), v = (r * r + a * a - u * u) / (2 * r * a), g = Math.acos(d < -1 ? -1 : d > 1 ? 1 : d), x = Math.acos(v < -1 ? -1 : v > 1 ? 1 : v)
  return i.hip = g - p, i.knee = -(Math.PI - x), i
}

const ni = HOUND
const _m = [8, 4, 0.7], NC = [14, 1, 0.35]
const Mm = (i, e) => { let t = (i - e) % (Math.PI * 2); return t > Math.PI ? t -= Math.PI * 2 : t < -Math.PI && (t += Math.PI * 2), t }
const uo = (i, e, t) => (i < e ? e : i > t ? t : i)
const wm = [[0, 3], [1, 2]]
function xa(i, e, t, n, s) { return i.v += ((e - i.x) * t - i.v * n) * s, i.x += i.v * s, i.x }
const ps = new W()

/**
 * 猎犬动画器（原版 iM 里与外观相关的部分）。全部在 Three.js 坐标里计算：
 * pos/yaw/yawRate 为原版约定（yaw 弧度，前方 = (sin yaw, 0, cos yaw)）。
 */
export function createHoundAnimator(rand = Math.random) {
  const def = houndDef()
  const group = new Object3D()
  const l = {}
  for (const b of def.bones) {
    const o = new Object3D()
    o.name = b.name
    o.position.set(b.local[0], b.local[1], b.local[2])
    l[b.name] = o
    ;(b.parent ? l[b.parent] : group).add(o)
  }
  const c = [], u = [], h = []
  for (let T = 0; T < 4; T++) c.push(l['abd' + ni.legs[T]]), u.push(l['thigh' + ni.legs[T]]), h.push(l['shin' + ni.legs[T]])
  const b = [0, 1, 2, 3].map(() => ({ p: new W(), from: new W(), to: new W(), slide: new W() }))
  const bm = { abd: 0, hip: 0, knee: 0, reach: 0 }
  const m = {
    group, bones: l, feet: b, pos: group.position, yaw: 0, speed: 0, prevSpeed: 0, yawRate: 0, vx: 0, vz: 0, ground: 0, alive: true,
    sw: -1, swT: 0, swDur: 0.2, lastPair: 1, idleT: 0, lift: 0.08,
    sY: { x: 0, v: 0 }, sP: { x: 0, v: 0 }, sR: { x: 0, v: 0 }, sL: { x: 0, v: 0 }, sA: { x: 0, v: 0 }, sA2: { x: 0, v: 0 },
    crouch: 0, tyaw: 0, tpitch: 0, hyaw: 0, hpitch: 0, flare: 0, lensC: [_m[0], _m[1], _m[2]], lens: [_m[0], _m[1], _m[2]],
    phase: rand() * 6.283, scan: 0, dieT: 0, vy: 0, dieRoll: 0, diePitch: 0, t: 0, beacon: 1,
    headPos: new W(), gunPos: new W(), onStep: null,
  }

  // 原版 A：第 D 条腿在 (x,z,yaw) 姿态下的默认落脚点
  function A(T, D, C, G, j) {
    const N = ni.side[D] * ni.footX, Q = ni.footZ[D], K = Math.cos(j), ie = Math.sin(j)
    return T.set(C + N * K + Q * ie, 0, G - N * ie + Q * K), T
  }

  // 原版 H：对角两组腿交替摆动；预测下一步落脚点，偏离过大的组先迈
  function H(T) {
    const D = m.vx, C = m.vz, G = m.speed > 0.15 || Math.abs(m.yawRate) > 0.25
    if (m.sw < 0) {
      m.idleT = G ? 0 : m.idleT + T
      const j = m.speed + Math.abs(m.yawRate) * 0.5, N = uo(0.27 - j * 0.026, 0.14, 0.27)
      let Q = -1, K = 0
      for (let F = 0; F < 2; F++) {
        let X = 0
        for (const ne of wm[F]) {
          A(ps, ne, m.pos.x + D * N, m.pos.z + C * N, m.yaw + m.yawRate * N)
          const re = Math.hypot(ps.x - b[ne].p.x, ps.z - b[ne].p.z)
          re > X && (X = re)
        }
        F !== m.lastPair && (X *= 1.25), X > K && (K = X, Q = F)
      }
      const ie = G ? 0.09 : m.idleT > 0.25 ? 0.035 : 1e9
      if (Q >= 0 && K > ie) {
        m.sw = Q, m.swT = 0, m.swDur = N, m.lift = 0.065 + Math.min(0.09, j * 0.02)
        for (const F of wm[Q]) {
          const X = b[F]
          X.from.copy(X.p), A(X.to, F, m.pos.x + D * N * 1.5, m.pos.z + C * N * 1.5, m.yaw + m.yawRate * N * 1.5), X.to.y = m.ground
        }
      }
    } else {
      m.swT += T / m.swDur
      const j = m.swT >= 1 ? 1 : m.swT, N = j * j * (3 - 2 * j)
      for (const Q of wm[m.sw]) {
        const K = b[Q]
        K.p.lerpVectors(K.from, K.to, N), K.p.y += Math.sin(Math.PI * j) * m.lift
      }
      if (m.swT >= 1) {
        const Q = b[wm[m.sw][0]]
        m.onStep && m.onStep(Q.p, false), m.sY.v -= 0.12 + m.speed * 0.03, m.lastPair = m.sw, m.sw = -1
      }
    }
  }

  // 原版 O：由四脚高度与加速度算机身姿态（弹簧），再对四条腿做 IK
  function O(T) {
    const D = Math.cos(m.yaw), C = Math.sin(m.yaw), G = (b[0].p.y + b[1].p.y) * 0.5, j = (b[2].p.y + b[3].p.y) * 0.5, N = (b[0].p.y + b[2].p.y) * 0.5, Q = (b[1].p.y + b[3].p.y) * 0.5, K = (G + j) * 0.5 - m.pos.y, ie = T > 0 ? (m.speed - m.prevSpeed) / T : 0
    let F = Math.atan2(j - G, 0.8) * 0.6 + uo(ie * 0.006, -0.07, 0.07), X = Math.atan2(N - Q, 0.55) * 0.6 + uo(m.yawRate * m.speed * 0.02, -0.12, 0.12), ne = K * 0.45 - Math.min(0.05, m.speed * 0.011)
    m.alive || (F = m.diePitch, X = m.dieRoll, ne = 0), m.alive && (xa(m.sY, ne, 160, 17, T), xa(m.sP, F, 130, 15, T), xa(m.sR, X, 130, 15, T), xa(m.sL, 0, 110, 13, T))
    const re = m.alive ? Math.sin(m.t * 1.7 + m.phase) * 0.004 : 0, $ = m.sL.x, ue = ni.stand + m.sY.x - m.crouch + re, me = m.sP.x, ee = m.sR.x
    group.rotation.y = m.yaw, l.body.position.set($, ue, 0), l.body.rotation.set(me, 0, ee), l.turret.rotation.y = m.tyaw, l.gun.rotation.x = m.tpitch - me * 0.5, l.head.rotation.set(m.hpitch, m.hyaw, 0), xa(m.sA, uo(-ie * 0.03 - me, -0.6, 0.6), 60, 5, T), xa(m.sA2, uo(m.yawRate * 0.12 - ee, -0.6, 0.6), 60, 5, T), l.antenna.rotation.set(m.sA.x, 0, m.sA2.x)
    const B = Math.cos(me), P = Math.sin(me), V = Math.cos(ee), Y = Math.sin(ee)
    for (let L = 0; L < 4; L++) {
      const Z = b[L].p, J = Z.x - m.pos.x, oe = Z.y + ni.footR * 0.6 - m.pos.y, fe = Z.z - m.pos.z, le = J * D - fe * C - $, R = oe - ue, I = J * C + fe * D, se = R * B + I * P, ae = -R * P + I * B, k = le * V + se * Y, ce = -le * Y + se * V
      q_(bm, k - ni.side[L] * ni.hipX, ce - ni.hipY, ae - ni.fore[L] * ni.hipZ, ni.side[L], ni.l0, ni.L1, ni.L2 - ni.footR * 0.6), c[L].rotation.z = bm.abd, u[L].rotation.x = bm.hip, h[L].rotation.x = bm.knee
    }
    group.updateMatrixWorld(true), m.headPos.setFromMatrixPosition(l.head.matrixWorld), m.gunPos.setFromMatrixPosition(l.gun.matrixWorld)
  }

  /** 原版 _activate 的姿态部分：脚放到默认落脚点 */
  m.place = (x, y, z, yaw) => {
    m.pos.set(x, y, z), m.yaw = yaw, m.ground = y, m.speed = m.prevSpeed = m.yawRate = 0, m.sw = -1, m.idleT = 0, m.crouch = 0, m.alive = true
    for (const C of [m.sY, m.sP, m.sR, m.sL, m.sA, m.sA2]) C.x = 0, C.v = 0
    for (let C = 0; C < 4; C++) A(b[C].p, C, x, z, yaw), b[C].p.y = y
    O(0.016)
  }

  /**
   * 活着时每帧调用（原版 S 中移动之后的部分）。
   * o: x,y,z 位置；yaw；vx,vz 水平速度；ground 地面高；target 炮塔目标（交战时玩家）；look 头部目标；crouch 下蹲目标；engage 是否交战
   */
  m.live = (T, o) => {
    m.t += T
    const raw = T > 0 ? Mm(o.yaw, m.yaw) / T : 0
    m.yawRate += (raw - m.yawRate) * (1 - Math.exp(-10 * T))
    m.yaw = o.yaw, m.pos.set(o.x, o.y, o.z), m.ground = o.ground, m.vx = o.vx, m.vz = o.vz
    m.prevSpeed = m.speed, m.speed = Math.hypot(o.vx, o.vz)
    // 位置突变（传送、复用）：脚离默认落脚点过远则直接重置，避免 IK 把腿拉成直线
    for (let F = 0; F < 4; F++) {
      A(ps, F, m.pos.x, m.pos.z, m.yaw)
      if (Math.hypot(ps.x - b[F].p.x, ps.z - b[F].p.z) > 1.2) { m.sw = -1; for (let C = 0; C < 4; C++) A(b[C].p, C, m.pos.x, m.pos.z, m.yaw), b[C].p.y = m.ground; break }
    }
    H(T), m.crouch += ((o.crouch || 0) - m.crouch) * (1 - Math.exp(-12 * T))
    const G = o.target, j = o.look
    const ee = Math.cos(m.yaw), B = Math.sin(m.yaw), Z = m.pos.y + ni.stand + m.sY.x - m.crouch
    let P = 0, V = 0, Y = 0, L = 0.05
    if (G) {
      const I = G.x - m.pos.x, se = G.z - m.pos.z, ae = G.y + 1 - (Z + 0.25)
      P = Math.atan2(I * ee - se * B, I * B + se * ee), V = uo(Math.atan2(-ae, Math.hypot(I, se)), -0.9, 0.35)
    } else m.scan += T * 0.5, P = Math.sin(m.scan * 0.9 + m.phase) * 1.1
    if (j) {
      const I = j.x - m.pos.x, se = j.z - m.pos.z, ae = j.y + 1.2 - (Z + 0.2)
      Y = uo(Math.atan2(I * ee - se * B, I * B + se * ee), -1.2, 1.2), L = uo(Math.atan2(-ae, Math.hypot(I, se)), -0.6, 0.5)
    } else Y = Math.sin(m.t * 0.7 + m.phase) * 0.5 + uo(m.yawRate * 0.25, -0.6, 0.6)
    const J = uo(4.5 * T, 0, 1)
    m.tyaw += uo(Mm(P, m.tyaw), -J, J), m.tpitch += (V - m.tpitch) * (1 - Math.exp(-10 * T))
    const oe = 1 - Math.exp(-7 * T)
    m.hyaw += (Y - m.hyaw) * oe, m.hpitch += (L - m.hpitch) * oe
    O(T)
    const fe = (m.t * (o.engage ? 2.2 : 0.8) + m.phase) % 1
    m.beacon = fe < 0.12 || (fe > 0.22 && fe < 0.3) ? 1 : 1e-4
    l.beacon.scale.setScalar(m.beacon)
    const le = o.engage ? NC : _m, R = 1 + m.flare * 3.5
    for (let I = 0; I < 3; I++) m.lensC[I] += (le[I] - m.lensC[I]) * (1 - Math.exp(-8 * T))
    m.lens = [m.lensC[0] * R, m.lensC[1] * R, m.lensC[2] * R]
    m.flare = Math.max(0, m.flare - T * 2)
  }

  /** 原版 damage 的受击冲量：C 为命中方向（单位向量） */
  m.hit = (dmg, C, weak) => {
    const j = Math.cos(m.yaw), N = Math.sin(m.yaw), Q = Math.min(1.6, dmg / 28), K = C.x * N + C.z * j, ie = C.x * j - C.z * N
    m.sL.v += ie * 1.4 * Q, m.sR.v += -ie * 3.2 * Q, m.sP.v += K * 2.4 * Q * (weak ? 1.6 : 1), m.sY.v -= 0.5 * Q
  }

  /** 原版 z 末尾：开火后坐 */
  m.fired = () => { m.sP.v += 1.1, m.sY.v -= 0.25 }

  /** 原版 q：倒地开始（随机侧翻、四脚外滑） */
  m.die = () => {
    m.alive = false, m.dieT = 0, m.vy = 0, m.beacon = 1e-4, l.beacon.scale.setScalar(1e-4)
    m.dieRoll = (rand() < 0.5 ? -1 : 1) * (0.25 + rand() * 0.3), m.diePitch = (rand() - 0.5) * 0.25, m.sR.v += m.dieRoll * 3, m.sP.v += (rand() - 0.5) * 2
    for (let D = 0; D < 4; D++) {
      const C = b[D]
      m.sw >= 0 && (C.p.y = m.pos.y)
      const G = m.yaw, j = ni.side[D] * (0.16 + rand() * 0.2), N = ni.fore[D] * (0.05 + rand() * 0.22) + (rand() - 0.5) * 0.1
      C.slide.set(j * Math.cos(G) + N * Math.sin(G), 0, -j * Math.sin(G) + N * Math.cos(G))
    }
    m.sw = -1, m.speed *= 0.3
  }

  /** 原版 U 的姿态部分：2.2 秒内机身塌落、弹跳，镜头闪烁熄灭。位置由调用方给出 */
  m.dead = (T, x, y, z) => {
    m.pos.set(x, y, z), m.dieT += T, m.t += T
    const D = m.dieT
    if (D >= 2.2) return
    const C = 0.215 - ni.stand
    m.vy -= 9.8 * T * (D < 0.12 ? 0.3 : 1), m.sY.x += m.vy * T
    m.sY.x < C && (m.sY.x = C, m.vy < -1.2 && m.onStep && m.onStep(m.pos, true), m.vy = -m.vy * 0.22)
    xa(m.sP, m.diePitch, 60, 9, T), xa(m.sR, m.dieRoll, 60, 9, T), xa(m.sL, 0, 40, 8, T)
    const G = Math.exp(-3.2 * T)
    for (let N = 0; N < 4; N++) {
      const Q = b[N]
      Q.p.x += Q.slide.x * (1 - G), Q.p.z += Q.slide.z * (1 - G), Q.slide.multiplyScalar(G)
    }
    m.speed *= Math.exp(-5 * T), m.hpitch += (0.55 - m.hpitch) * (1 - Math.exp(-5 * T)), m.hyaw += (m.dieRoll - m.hyaw) * (1 - Math.exp(-3 * T)), m.tpitch += (0.3 - m.tpitch) * (1 - Math.exp(-4 * T))
    const j = D < 1.2 ? (Math.sin(D * 60) > 0.2 ? 1 - D / 1.2 : 0.05) : 0.02
    m.lens = [6 * j + 0.05, 0.6 * j + 0.01, 0.2 * j]
    O(T)
  }
  return m
}

// ---- Runner 侧：网格注册、实体层级、每帧同步 ----

const registered = new WeakSet<object>()
const meshName = (p) => `hound-${p.bone}-${p.slot}`

/** 原版 Em 的材质槽：shell/metal 用 GPU 烘焙材质（三平面，乘顶点色）；glow 为 HDR 顶点色的无光照；lens 每只一份、每帧改颜色 */
function slotMaterial(slot, mats) {
  if (slot === 'glow') return { color: '#ffffff', material: { mode: 'unlit', vertexColors: true, shadows: false } }
  if (slot === 'lens') return { color: '#000000', material: { mode: 'lit', metallic: 0, smoothness: 0.6, emission: '#ffffff', emissionIntensity: 1, shadows: false, wet: 0 } }
  const name = slot === 'shell' ? 'armor_white' : 'gunmetal'
  if (mats) {
    const r = mats.get(name, { uv: 'object' })
    return { color: r.color, material: { ...r.material, vertexColors: true } }
  }
  return { color: slot === 'shell' ? '#aeb5b8' : '#2a2d31', material: { metallic: slot === 'shell' ? 0.1 : 0.8, smoothness: 0.5, vertexColors: true } }
}

/** 隐形命中体（Runner 没有"只碰撞不渲染"的开关：用加色混合的黑色代替） */
const HIDDEN = { color: '#000000', material: { mode: 'additive', shadows: false } }

export interface HoundModel {
  anim: any
  ents: Map<string, any>
  lens: any[]
  lastLens: number[]
  /** 隐形命中体（死亡后关闭） */
  hits: any[]
}

export function buildHound(ctx, name: string, mats?: any) {
  const { scene } = ctx
  const def = houndDef()
  if (!registered.has(ctx)) {
    registered.add(ctx)
    for (const p of def.parts) scene.mesh(meshName(p), toMesh(p.geometry))
  }
  const root = scene.spawn({ shape: 'empty', name })
  const ents = new Map()
  for (const b of def.bones) if (b.parent) ents.set(b.name, scene.spawn({ shape: 'empty', name: `${name}-${b.name}`, parent: root }))
  const lens = []
  for (const p of def.parts) {
    const r = slotMaterial(p.slot, mats)
    const e = scene.spawn({ shape: `mesh:${meshName(p)}`, name: `${name}-${p.slot}`, parent: ents.get(p.bone), color: r.color, material: r.material, collider: false })
    if (p.slot === 'lens') lens.push(e)
  }
  const parts = new Map<number, boolean>()
  const hits = []
  const hit = (parent, opts, weak) => {
    const e = scene.spawn({ ...HIDDEN, parent, collider: true, layer: ENEMY_LAYER, ...opts })
    parts.set(e.id, weak)
    hits.push(e)
  }
  // 原版 _raycast：头部球 r=.155（弱点）；机身胶囊 r=.27（z -.45….47，高 +.03）与下部胶囊 r=.25（离地 45% 处）
  hit(ents.get('head'), { shape: 'sphere', name: `${name}-hit-head`, scale: 0.31 }, true)
  hit(ents.get('body'), { shape: 'capsule', name: `${name}-hit-body`, position: [0, 0.03, -0.01], rotation: [90, 0, 0], scale: [0.54, 0.73, 0.54] }, false)
  hit(ents.get('body'), { shape: 'capsule', name: `${name}-hit-legs`, position: [0, -0.37, -0.01], rotation: [90, 0, 0], scale: [0.5, 0.71, 0.5] }, false)
  const light = scene.light({ type: 'point', name: `${name}-light`, parent: ents.get('head'), position: [0, 0, -0.3], intensity: 0.4, range: 4, color: '#ff8a40' })
  const anim = createHoundAnimator(Math.random)
  const hound: HoundModel = { anim, ents, lens, lastLens: [-1, -1, -1], hits }
  return { root, parts, light, hound }
}

/** 骨骼世界矩阵 → 实体；镜头颜色有变化时更新自发光 */
export function syncHound(h: HoundModel) {
  const l = h.anim.bones
  for (const [name, ent] of h.ents) {
    const tr = toUnityTransform(l[name].matrixWorld)
    ent.position = tr.position
    ent.rotation = tr.rotation
    if (name === 'beacon') ent.scale = tr.scale
  }
  const c = h.anim.lens
  if (Math.abs(c[0] - h.lastLens[0]) + Math.abs(c[1] - h.lastLens[1]) + Math.abs(c[2] - h.lastLens[2]) > 0.05) {
    h.lastLens = [c[0], c[1], c[2]]
    const e = hdr({ r: c[0], g: c[1], b: c[2] })
    for (const ent of h.lens) ent.material({ emission: e.color, emissionIntensity: e.intensity })
  }
}
