// @ts-nocheck
/**
 * 机械飞鸥（四旋翼无人机）：原版 xm/FC/j_（模型）与 Q_ 中外观相关部分（姿态、旋翼、频闪灯、云台、镜头、坠毁翻滚）的机械移植。
 * 与猎犬相同：原版 SkinnedMesh 每顶点 1 根骨骼，这里按骨骼拆成刚体，Three.js 坐标里搭 Object3D 层级，每帧把骨骼世界矩阵写到 Runner 实体。
 */
import { Vector2, Vector3, Object3D, LatheGeometry, CylinderGeometry, TorusGeometry, BufferGeometry, Float32BufferAttribute } from '../vendor/three-geo'
import { Fn } from './orig/port'
import { toMesh } from './geo'
import { ENEMY_LAYER } from './level'
import { hdr, toUnityTransform } from './origlevel'
import { Rig, Ss, vm, Ts, s0, ga, Of, As, Yn, an, va, ft, Ce, ds, Ro, Si, su, Ur, Yv, slotMaterial, HIDDEN } from './hound'

const Ci = TorusGeometry

/** 原版 xm：旋翼、云台、炮塔、枪口、探照灯位置（模型朝 +Z） */
export const GULL = {
  rotors: [[0.33, 0.035, 0.3], [-0.33, 0.035, 0.3], [0.33, 0.035, -0.3], [-0.33, 0.035, -0.3]],
  gimbal: [0, -0.095, 0.275], ball: [0, -0.072, 0], gun: [0, -0.085, -0.1], muzzle: [0, -0.032, 0.27], lamp: [0, -0.066, 0.025],
}

/** 原版 FC：旋翼护圈截面（车床旋转体） */
function FC() {
  const i = [[0.176, -0.036], [0.196, -0.032], [0.206, 0], [0.202, 0.03], [0.19, 0.04], [0.178, 0.032], [0.173, 0], [0.176, -0.036]].map((e) => new Vector2(e[0], e[1]))
  return new LatheGeometry(i, 28)
}

/** three RingGeometry(inner, outer, segs, 1)：XY 平面、法线 +Z（vendor 子集里没有，按原实现写） */
function ring(inner, outer, segs) {
  const pos = [], nrm = [], uv = [], idx = []
  for (let j = 0; j <= 1; j++) {
    const r = inner + (outer - inner) * j
    for (let k = 0; k <= segs; k++) {
      const a = (k / segs) * Math.PI * 2, x = r * Math.cos(a), y = r * Math.sin(a)
      pos.push(x, y, 0), nrm.push(0, 0, 1), uv.push((x / outer + 1) / 2, (y / outer + 1) / 2)
    }
  }
  for (let k = 0; k < segs; k++) {
    const a = k, b = k + segs + 1, c = k + segs + 2, d = k + 1
    idx.push(a, b, d, b, c, d)
  }
  const g = new BufferGeometry()
  g.setIndex(idx), g.setAttribute('position', new Float32BufferAttribute(pos, 3)), g.setAttribute('normal', new Float32BufferAttribute(nrm, 3)), g.setAttribute('uv', new Float32BufferAttribute(uv, 2))
  return g
}

// ---- 原版 j_：飞鸥模型（逐字；原版分两个 rig，disc/cone 在第二个，这里合在一起按槽区分） ----
function j_() {
  const i = GULL, e = new Rig()
  const n = (l, c, u, h, f) => e.bone(l, c, u, h, f)
  n('root', null, 0, 0, 0), n('body', 'root', 0, 0, 0)
  for (let l = 0; l < 4; l++) n('rotor' + l, 'body', i.rotors[l][0], i.rotors[l][1], i.rotors[l][2])
  n('gimbalYaw', 'body', i.gimbal[0], i.gimbal[1], i.gimbal[2]), n('ball', 'gimbalYaw', i.ball[0], i.ball[1], i.ball[2]), n('lamp', 'ball', i.lamp[0], i.lamp[1], i.lamp[2]), n('gun', 'body', i.gun[0], i.gun[1], i.gun[2]), n('strobeG', 'body', 0, 0, 0), n('strobeR', 'body', 0, 0, 0), n('strobeW', 'body', 0, 0, 0)
  const s = (l, c, u, h, f) => e.add(l, c, u, h, f)
  s('shell', 'body', Ce(Ur(1, 20, 12, 0.118, 0.074, 0.27), 0, 0.02, 0), Ss), s('shell', 'body', Ce(ds(1, 0.9, 1, 20), 0, 0.02, 0.165, va, 0, 0, [0.094, 0.05, 0.06]), Ts), s('shell', 'body', Ce(ds(1, 1, 1, 20), 0, 0.02, -0.02, va, 0, 0, [0.121, 0.012, 0.0765]), s0), s('shell', 'body', Ce(ft(0.118, 0.014, 0.2, 0.005), 0, 0.089, -0.03), vm), s('shell', 'body', Ce(ft(0.03, 0.006, 0.2, 0.002), 0, 0.0975, -0.03), Ts)
  for (const l of [-0.05, 0.05]) for (const c of [-0.12, 0.06]) s('metal', 'body', Yv(l, 0.097, c), Yn)
  s('metal', 'body', Ce(ft(0.175, 0.06, 0.37, 0.016), 0, -0.035, -0.005), an), s('metal', 'body', Ce(ft(0.12, 0.075, 0.11, 0.014), 0, 0.005, -0.265), As), s('shell', 'body', Ce(ft(0.124, 0.02, 0.03, 0.005), 0, 0.03, -0.3), Ts), s('glow', 'body', Ce(ft(0.05, 0.006, 0.003, 0.001), 0, 0, -0.321), [0.3, 1.6, 0.4], false)
  for (const l of [1, -1]) {
    for (let c = 0; c < 4; c++) s('metal', 'body', Ce(ft(0.004, 0.01, 0.06, 0.001), l * 0.0885, -0.045 + c * 0.016, -0.06), [0.2, 0.2, 0.2])
    s('metal', 'body', Fn([[l * 0.075, -0.055, 0.13], [l * 0.135, -0.175, 0.16], [l * 0.135, -0.192, 0.11], [l * 0.135, -0.192, -0.14], [l * 0.135, -0.175, -0.19], [l * 0.075, -0.055, -0.15]], 0.0085, 6, false, 0.5), Yn)
    for (const c of [0.07, -0.1]) s('shell', 'body', Ce(Si(0.0135, 0.0135, 0.07, 8), l * 0.135, -0.192, c), ga)
    s('metal', 'body', su([l * 0.04, 0.07, -0.17], [l * 0.085, 0.37, -0.27], 0.004, 0.002, 5), an), s('metal', 'body', Ce(ds(0.008, 0.01, 0.025, 6), l * 0.04, 0.078, -0.17), Yn)
  }
  s('metal', 'body', Ce(ds(0.007, 0.007, 0.04, 6), 0, 0.105, 0.1), Yn), s('shell', 'body', Ce(ds(0.034, 0.036, 0.018, 14), 0, 0.132, 0.1), Ss), s('metal', 'body', Ce(ft(0.07, 0.03, 0.09, 0.008), 0, -0.075, 0.235), As)
  const o = FC()
  for (let l = 0; l < 4; l++) {
    const [c, u, h] = i.rotors[l], f = Math.sign(c), p = Math.sign(h)
    s('metal', 'body', su([f * 0.07, 0, p * 0.09], [c, u - 0.05, h], 0.017, 0.015, 8), an), s('shell', 'body', Ce(ft(0.07, 0.045, 0.07, 0.014), f * 0.085, 0, p * 0.1, 0, f * p * 0.74, 0), Ss), s('shell', 'body', Fn([[f * 0.09, 0.02, p * 0.12], [f * 0.18, 0.012, p * 0.19], [c - f * 0.05, u - 0.03, h - p * 0.04]], 0.005, 5), ga), s('metal', 'body', Ce(ds(0.04, 0.03, 0.075, 12), c, u - 0.05, h), an), s('metal', 'body', Ce(ds(0.042, 0.042, 0.012, 12), c, u - 0.02, h), Yn), s('shell', 'body', Ce(o.clone(), c, u, h), Ss), s('shell', 'body', Ce(new Ci(0.196, 0.0085, 6, 28), c, u + 0.036, h, va, 0, 0), Ts)
    for (let v = 0; v < 3; v++) {
      const g = v * 2.094 + 0.5 + l
      s('metal', 'body', Ce(ft(0.145, 0.007, 0.016, 0.002), c + Math.cos(g) * 0.105, u - 0.022, h - Math.sin(g) * 0.105, 0, g, 0), an)
    }
    for (let v = -1; v <= 1; v++) {
      const g = Math.atan2(p, f) + v * 0.2
      s('shell', 'body', Ce(ft(0.012, 0.05, 0.036, 0.003), c + Math.cos(g) * 0.205, u, h + Math.sin(g) * 0.205, 0, -g, 0), v === 0 ? s0 : Of)
    }
    s('metal', 'rotor' + l, Ce(ds(0.017, 0.02, 0.03, 8), 0, -0.002, 0), Yn), s('metal', 'rotor' + l, Ce(ft(0.158, 0.0035, 0.03, 0.001), 0.088, 0.008, 0, 0.22, 0, 0), an), s('metal', 'rotor' + l, Ce(ft(0.158, 0.0035, 0.03, 0.001), -0.088, 0.008, 0, -0.22, 0, 0), an), s('shell', 'rotor' + l, Ce(ft(0.02, 0.004, 0.031, 0.001), 0.158, 0.008, 0, 0.22, 0, 0), Of), s('shell', 'rotor' + l, Ce(ft(0.02, 0.004, 0.031, 0.001), -0.158, 0.008, 0, -0.22, 0, 0), Of)
    // 旋翼残影盘：原版 RingGeometry + DoubleSide；Runner 半透明材质单面，正反各一片
    const d = ring(0.03, 0.168, 24)
    d.rotateX(-va), e.add('disc', 'body', Ce(d, c, u + 0.008, h), [1, 1, 1], false)
    const d2 = ring(0.03, 0.168, 24)
    d2.rotateX(va), e.add('disc', 'body', Ce(d2, c, u + 0.008, h), [1, 1, 1], false)
  }
  s('glow', 'strobeR', Ce(Ur(0.012, 8, 6), 0.33 + 0.215, 0.035, 0.3), [10, 0.4, 0.2], false), s('glow', 'strobeR', Ce(Ur(0.012, 8, 6), 0.33 + 0.215, 0.035, -0.3), [10, 0.4, 0.2], false), s('glow', 'strobeG', Ce(Ur(0.012, 8, 6), -0.33 - 0.215, 0.035, 0.3), [0.3, 9, 1], false), s('glow', 'strobeG', Ce(Ur(0.012, 8, 6), -0.33 - 0.215, 0.035, -0.3), [0.3, 9, 1], false), s('glow', 'strobeW', Ce(Ur(0.011, 8, 6), 0, 0.05, -0.325), [9, 9, 9], false), s('metal', 'gimbalYaw', Ce(ds(0.036, 0.036, 0.014, 12), 0, -0.004, 0), an), s('metal', 'gimbalYaw', Ce(ft(0.156, 0.01, 0.03, 0.003), 0, -0.014, 0), As)
  for (const l of [1, -1]) s('metal', 'gimbalYaw', Ce(ft(0.009, 0.075, 0.03, 0.003), l * 0.0735, -0.05, 0), As)
  s('metal', 'ball', Ce(Ur(0.06, 18, 12), 0, 0, 0), an), s('metal', 'ball', Ce(Ro(0.013, 0.013, 0.142, 8), 0, 0, 0), Yn), s('metal', 'ball', Ce(Si(0.031, 0.036, 0.03, 14), 0, 0.004, 0.048), As), s('lens', 'ball', Ce(Si(0.025, 0.025, 0.004, 14), 0, 0.004, 0.0645), [1, 1, 1], false), s('metal', 'ball', Ce(Si(0.012, 0.012, 0.01, 8), 0.03, 0.036, 0.04), [0.1, 0.12, 0.2]), s('metal', 'ball', Ce(Si(0.019, 0.023, 0.045, 10), i.lamp[0], i.lamp[1], i.lamp[2] - 0.022), an), s('glow', 'lamp', Ce(Si(0.016, 0.016, 0.003, 10), 0, 0, 0.001), [11, 9.8, 7.6], false)
  {
    // 原版 ConeGeometry(1.25, 9, 20, 6, openEnded)：即顶半径 0 的圆柱
    const u = new CylinderGeometry(0, 1.25, 9, 20, 6, true)
    u.translate(0, -9 / 2, 0), u.rotateX(-va), e.add('cone', 'lamp', u, [1, 1, 1], false)
  }
  s('metal', 'gun', Ce(ft(0.05, 0.03, 0.05, 0.006), 0, 0.012, 0), As), s('metal', 'gun', Ce(Ro(0.012, 0.012, 0.07, 8), 0, -0.005, 0), Yn), s('metal', 'gun', Ce(ft(0.052, 0.046, 0.13, 0.008), 0, -0.032, 0), As), s('shell', 'gun', Ce(ft(0.054, 0.012, 0.05, 0.003), 0, -0.02, -0.03), Ts)
  for (const l of [-0.014, 0.014]) s('metal', 'gun', Ce(Si(0.0085, 0.0085, 0.2, 8), l, -0.032, 0.16), an), s('metal', 'gun', Ce(Si(0.012, 0.012, 0.03, 8), l, -0.032, 0.255), As)
  s('metal', 'gun', Ce(ft(0.045, 0.012, 0.012, 0.002), 0, -0.032, 0.2), Yn), s('metal', 'gun', Ce(ft(0.03, 0.05, 0.05, 0.006), 0.04, -0.035, -0.02), an)
  return e.build()
}

let cached = null
export function gullDef() {
  return cached || (cached = j_())
}

const ym = [8, 4, 0.7], UC = [14, 1, 0.35]
const K_ = (i, e) => { let t = (i - e) % (Math.PI * 2); return t > Math.PI ? t -= Math.PI * 2 : t < -Math.PI && (t += Math.PI * 2), t }
const bl = (i, e, t) => (i < e ? e : i > t ? t : i)
const Hf = new Vector3(0, 1, 0)
const $o = new Vector3(), ou = new Vector3()

/**
 * 飞鸥动画器（原版 x/g 中与外观相关的部分），全部在 Three.js 坐标里：yaw 弧度，前方 (sin yaw, 0, cos yaw)。
 * 飞行控制（目标点、加速度、避障）在 enemies 单元，这里只吃它算出的加速度 Co 与水平速度。
 */
export function createGullAnimator(rand = Math.random) {
  const def = gullDef()
  const group = new Object3D()
  group.rotation.order = 'YXZ'
  const l = {}
  for (const b of def.bones) {
    const o = new Object3D()
    o.name = b.name
    o.position.set(b.local[0], b.local[1], b.local[2])
    l[b.name] = o
    ;(b.parent ? l[b.parent] : group).add(o)
  }
  const d = {
    group, bones: l, pos: group.position, yaw: 0, pitch: 0, roll: 0, thr: 1, gy: 0, gp: 0, sweep: 0, flare: 0,
    lensC: [ym[0], ym[1], ym[2]], lens: [ym[0], ym[1], ym[2]], phase: rand() * 6.283, t: 0, dieT: 0, spin: 0, lostRotor: -1,
    sensor: new Vector3(),
  }

  /** 原版 _activate 的外观部分 */
  d.place = (x, y, z, yaw) => {
    d.pos.set(x, y, z), d.yaw = yaw, d.pitch = d.roll = 0, d.thr = 1, d.dieT = 0, d.spin = 0, d.lostRotor = -1, d.flare = 0
    for (let m = 0; m < 4; m++) l['rotor' + m].scale.setScalar(1)
    l.lamp.scale.setScalar(1), l.body.rotation.set(0, 0, 0)
    group.rotation.set(0, d.yaw, 0), group.updateMatrixWorld(true)
  }

  /**
   * 活着时每帧（原版 x 中移动之后的部分）。
   * o: x,y,z；yaw；ax,ay,az 加速度 Co；hs 水平速度；engage；hurt（血量过半）；
   *    player（交战目标，脚底位置）、lastKnown；mode 'engage'|'search'|'patrol'
   */
  d.live = (y, o) => {
    d.t += y
    const m = d.t, A = o.engage, _ = o.hurt
    d.pos.set(o.x, o.y, o.z), d.yaw = o.yaw
    const T = Math.cos(d.yaw), D = Math.sin(d.yaw), C = o.ax * D + o.az * T, G = o.ax * T - o.az * D
    let j = bl(C * 0.04, -0.42, 0.42), N = bl(-G * 0.04, -0.42, 0.42)
    _ && (j += Math.sin(m * 11 + d.phase) * 0.1, N += Math.cos(m * 8.7 + d.phase * 2) * 0.13)
    const Q = 1 - Math.exp(-7 * y)
    d.pitch += (j - d.pitch) * Q, d.roll += (N - d.roll) * Q, group.rotation.set(d.pitch, d.yaw, d.roll)
    l.body.position.y = Math.sin(m * 2.1 + d.phase) * 0.045 + Math.sin(m * 3.7 + d.phase * 1.7) * 0.018
    d.thr += (1 + bl(o.ay * 0.03, -0.25, 0.4) + o.hs * 0.02 - d.thr) * Q
    const K = 41 * d.thr * y
    l.rotor0.rotation.y += K, l.rotor1.rotation.y -= K * 1.03, l.rotor2.rotation.y -= K * 0.98, l.rotor3.rotation.y += K * 1.01
    const ie = (m * 0.9 + d.phase * 0.1) % 1, F = ie < 0.05 || (ie > 0.13 && ie < 0.18) ? 1 : 1e-4
    l.strobeR.scale.setScalar(F), l.strobeG.scale.setScalar(F), l.strobeW.scale.setScalar(ie > 0.5 && ie < 0.56 ? 1 : 1e-4)
    d.sensor.set(0, -0.17, 0.27).applyAxisAngle(Hf, d.yaw).add(d.pos)
    if (A && o.player) ou.set(o.player.x, o.player.y + 1.1, o.player.z)
    else if (o.mode !== 'patrol' && o.lastKnown) d.sweep += y, ou.set(o.lastKnown.x + Math.sin(d.sweep * 0.9) * 3, o.lastKnown.y, o.lastKnown.z + Math.cos(d.sweep * 0.7) * 3)
    else {
      d.sweep += y
      const P = d.yaw + Math.sin(d.sweep * 0.5 + d.phase) * 0.9
      ou.set(d.pos.x + Math.sin(P) * 5, d.pos.y - 5, d.pos.z + Math.cos(P) * 5)
    }
    $o.copy(ou).sub(d.sensor)
    const X = $o.x * T - $o.z * D, ne = $o.x * D + $o.z * T, re = $o.y, $ = Math.atan2(X, ne), ue = bl(Math.atan2(-re, Math.hypot(X, ne)), -0.5, 1.5), me = 1 - Math.exp(-9 * y)
    d.gy += K_($, d.gy) * me, d.gp += (ue - d.gp) * me, l.gimbalYaw.rotation.y = d.gy, l.ball.rotation.x = d.gp - d.pitch, l.gun.rotation.x = bl(d.gp, -0.2, 1.3) - d.pitch
    const ee = A ? UC : ym, B = 1 + d.flare * 3.2 + (A ? 0 : Math.sin(m * 3 + d.phase) * 0.15)
    for (let P = 0; P < 3; P++) d.lensC[P] += (ee[P] - d.lensC[P]) * (1 - Math.exp(-8 * y))
    d.lens = [d.lensC[0] * B, d.lensC[1] * B, d.lensC[2] * B]
    d.flare = Math.max(0, d.flare - y * 1.5)
    group.updateMatrixWorld(true)
  }

  /** 原版 damage：机身被打歪 */
  d.hit = () => { d.roll += (rand() - 0.5) * 0.5, d.pitch += (rand() - 0.5) * 0.4 }

  /** 原版 v：随机掉一个旋翼、熄灯、开始自旋。返回掉落旋翼的 three 世界坐标（冒火花用） */
  d.die = () => {
    d.dieT = 0, d.lostRotor = Math.floor(rand() * 4), l['rotor' + d.lostRotor].scale.setScalar(1e-4)
    const r = GULL.rotors[d.lostRotor]
    const at = new Vector3(r[0], 0.05, r[2]).applyAxisAngle(Hf, d.yaw).add(d.pos)
    d.spin = (rand() < 0.5 ? -1 : 1) * (5 + rand() * 3)
    l.lamp.scale.setScalar(1e-4), l.strobeG.scale.setScalar(1e-4), l.strobeR.scale.setScalar(1e-4), l.strobeW.scale.setScalar(1e-4)
    d.lens = [0.3, 0.05, 0.02]
    return at
  }

  /** 原版 g 的姿态部分：越转越快、侧倾、低头；剩下的旋翼逐渐停转。位置由调用方给出 */
  d.dead = (y, x, yy, z) => {
    d.dieT += y, d.t += y
    d.spin += Math.sign(d.spin) * 7 * y, d.yaw += d.spin * y, d.roll += d.spin * 0.35 * y, d.pitch += 0.9 * y
    d.pos.set(x, yy, z), group.rotation.set(d.pitch, d.yaw, d.roll)
    for (let _ = 0; _ < 4; _++) _ !== d.lostRotor && (l['rotor' + _].rotation.y += (_ % 3 === 0 ? 1 : -1) * 30 * Math.max(0.2, 1 - d.dieT * 0.5) * y)
    group.updateMatrixWorld(true)
  }
  return d
}

// ---- Runner 侧 ----

const registered = new WeakSet<object>()
const meshName = (p) => `gull-${p.bone}-${p.slot}`
/** 需要同步缩放的骨骼（频闪灯开关、掉落旋翼、熄灭探照灯） */
const SCALED = new Set(['rotor0', 'rotor1', 'rotor2', 'rotor3', 'lamp', 'strobeG', 'strobeR', 'strobeW'])

export interface GullModel {
  anim: any
  ents: Map<string, any>
  lens: any[]
  lastLens: number[]
  hits: any[]
}

export function buildGull(ctx, name: string, mats?: any) {
  const { scene } = ctx
  const def = gullDef()
  let cone = null
  if (ctx.gfx?.supported) {
    const sh = ctx.gfx.shader({ fragment: 'shaders/gullcone.frag', name: 'jimao/gull-cone' })
    if (sh.ok !== false) cone = sh
  }
  if (!registered.has(ctx)) {
    registered.add(ctx)
    for (const p of def.parts) scene.mesh(meshName(p), toMesh(p.geometry))
  }
  const root = scene.spawn({ shape: 'empty', name })
  const ents = new Map()
  for (const b of def.bones) if (b.parent) ents.set(b.name, scene.spawn({ shape: 'empty', name: `${name}-${b.name}`, parent: root }))
  const lens = []
  for (const p of def.parts) {
    const parent = ents.get(p.bone)
    if (p.slot === 'cone') {
      // 原版探照灯光锥：自定义着色器、加色、双面、不写深度、不受雾
      if (!cone) continue
      scene.spawn({ shape: `mesh:${meshName(p)}`, name: `${name}-cone`, parent, collider: false })
        .shader(cone, { blend: 'add', cull: 'none', queue: 'transparent', depthWrite: false, shadows: false, uniforms: { uColor: [1, 0.9, 0.74], uGain: 0.085 } })
      continue
    }
    // 原版旋翼盘：MeshBasicMaterial 0x0c0d0f，opacity .42
    const r = p.slot === 'disc' ? { color: '#0c0d0f6b', material: { mode: 'unlit-fade', shadows: false } } : slotMaterial(p.slot, mats)
    const e = scene.spawn({ shape: `mesh:${meshName(p)}`, name: `${name}-${p.slot}`, parent, color: r.color, material: r.material, collider: false })
    if (p.slot === 'lens') lens.push(e)
  }
  // 原版 _raycast：以机身为中心、半径 .5、竖向压扁 2.3 倍的椭球（无弱点）
  const parts = new Map<number, boolean>()
  const hit = scene.spawn({ ...HIDDEN, parent: ents.get('body'), shape: 'sphere', name: `${name}-hit`, position: [0, -0.03, 0], scale: [1, 1 / 2.3, 1], collider: true, layer: ENEMY_LAYER })
  parts.set(hit.id, false)
  const light = scene.light({ type: 'point', name: `${name}-light`, parent: ents.get('ball'), position: [0, 0, 0.1], intensity: 0.4, range: 4, color: '#ff8a40' })
  const anim = createGullAnimator(Math.random)
  const gull: GullModel = { anim, ents, lens, lastLens: [-1, -1, -1], hits: [hit] }
  return { root, parts, light, gull }
}

export function syncGull(g: GullModel) {
  const l = g.anim.bones
  for (const [name, ent] of g.ents) {
    const tr = toUnityTransform(l[name].matrixWorld)
    ent.position = tr.position
    ent.rotation = tr.rotation
    if (SCALED.has(name)) ent.scale = tr.scale
  }
  const c = g.anim.lens
  if (Math.abs(c[0] - g.lastLens[0]) + Math.abs(c[1] - g.lastLens[1]) + Math.abs(c[2] - g.lastLens[2]) > 0.05) {
    g.lastLens = [c[0], c[1], c[2]]
    const e = hdr({ r: c[0], g: c[1], b: c[2] })
    for (const ent of g.lens) ent.material({ emission: e.color, emissionIntensity: e.intensity })
  }
}
