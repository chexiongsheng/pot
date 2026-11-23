// @ts-nocheck
/**
 * 第一人称手臂、战术手套、枪身刻字：机械移植自原版 HTML（手部 yl…Vv、刻字 hm/F_、装配 dm），只改了函数名，数值一字未动。
 * 坐标为原版 Three.js 约定（-Z 为前，单位米），几何用 geo.toMesh() 转换；姿态四元数用 toUnityEuler() 转换。
 *
 * 原版名 → 本文件名：yl→Rings, I_→grid, Lf→patch, z_→fingerGeo, yC→rotY, bC→rotX, C_→finger, _C→thumbQuat, MC→thumb,
 * D_→knuckleZ, Ov→palmEdgeZ, Hv→palmHalfW, L_→palmTop, k_→palmBottom, kv→backH, wC→heelH, EC→palm, SC→web, P_→mirror,
 * Vv→buildHand, hm→LABELS, F_→markingQuads, i0→quat, Yo→smoother, um/Fo→sat, xl→smoothstep, Ff→spow, vC→hash1,
 * cm→edgeK, Uv→EDGE, om→FINGERS, Nv→ANG, T_→NA, A_→PAD, R_→SEG, xC→BUMP, Qc→PZ0, Xo→tv, S_→FWD。
 * 颜色常量（线性、可大于 1，与很暗的手套底色相乘）保留原名：Bv 手背 Fv 防滑垫 Lv 指节护垫 am 侧面 lm 掌面 dC 垫边
 * kf 缝线 gl 袖口织带 Df 袖口胶条 pC 拉襻 E_ 袖子 mC 臂章 gC 臂章白字。
 */
import { BufferAttribute, BufferGeometry, Euler, Float32BufferAttribute, Matrix4, Quaternion, Vector3 } from '../vendor/three-geo'
import { merge } from './geo'
import { PAC9 } from './gun'

const Bv = [31, 21.5, 12.5], Fv = [5.6, 5.3, 5], Lv = [3.2, 3.1, 3], am = [12.5, 10, 7.6], lm = [16, 11, 6.6], dC = [3, 2.6, 2.2], kf = [36, 27, 16], gl = [20, 14, 8.4], Df = [4.8, 4.5, 4.2], pC = [30, 9.5, 2.2], E_ = [5, 6.9, 9], mC = [30, 9.5, 2.2], gC = [26, 26, 25]
const sat = (i) => i < 0 ? 0 : i > 1 ? 1 : i
const smoothstep = (i, e, t) => (t = sat((t - i) / (e - i)), t * t * (3 - 2 * t))
const spow = (i, e) => Math.sign(i) * Math.pow(Math.abs(i), e)
const hash1 = (i) => {
  let e = Math.sin(i * 127.1 + 311.7) * 43758.5453
  return e - Math.floor(e)
}
export const smoother = (i) => (i = sat(i), i * i * i * (i * (6 * i - 15) + 10))
export const quat = (x, y, z, o = 'XYZ') => new Quaternion().setFromEuler(new Euler(x, y, z, o))
const tv = new Vector3(), FWD = new Vector3(0, 0, -1)

/** 原版 yl：环带网格（每环 N 个点，相邻环连成四边形；collapse 标记的环法线取平均，用于封口） */
class Rings {
  constructor(e) {
    this.N = e, this.P = [], this.C = [], this.weld = []
  }
  v(e, t, n = 1) {
    this.P.push(e.x, e.y, e.z), this.C.push(t[0] * n, t[1] * n, t[2] * n)
  }
  rings() {
    return this.P.length / 3 / this.N
  }
  collapse() {
    this.weld.push(this.rings() - 1)
  }
  geo(e = false) {
    let t = this.N, n = this.rings(), s = []
    for (let a = 0; a < n - 1; a++) for (let l = 0; l < t; l++) {
      let c = a * t + l, u = a * t + (l + 1) % t, h = c + t, f = u + t
      e ? s.push(c, u, h, u, f, h) : s.push(c, h, u, u, h, f)
    }
    let o = new BufferGeometry()
    o.setAttribute('position', new Float32BufferAttribute(this.P, 3)), o.setAttribute('color', new Float32BufferAttribute(this.C, 3)), o.setAttribute('uv', new Float32BufferAttribute(new Float32Array(this.P.length / 3 * 2), 2)), o.setIndex(s), o.computeVertexNormals()
    let r = o.attributes.normal
    for (let a of this.weld) {
      let l = 0, c = 0, u = 0
      for (let f = 0; f < t; f++) l += r.getX(a * t + f), c += r.getY(a * t + f), u += r.getZ(a * t + f)
      let h = Math.hypot(l, c, u) || 1
      for (let f = 0; f < t; f++) r.setXYZ(a * t + f, l / h, c / h, u / h)
    }
    return o
  }
}

/** 原版 I_：参数网格曲面 t(u, v, out) → 颜色 */
function grid(i, e, t) {
  let n = [], s = [], o = [], r = i.length, a = e.length
  for (let c = 0; c < a; c++) for (let u = 0; u < r; u++) {
    let h = t(i[u], e[c], tv)
    n.push(tv.x, tv.y, tv.z), s.push(h[0], h[1], h[2])
  }
  for (let c = 0; c < a - 1; c++) for (let u = 0; u < r - 1; u++) {
    let h = c * r + u, f = h + 1, p = h + r, d = p + 1
    o.push(h, f, p, f, d, p)
  }
  let l = new BufferGeometry()
  return l.setAttribute('position', new Float32BufferAttribute(n, 3)), l.setAttribute('color', new Float32BufferAttribute(s, 3)), l.setAttribute('uv', new Float32BufferAttribute(new Float32Array(n.length / 3 * 2), 2)), l.setIndex(o), l.computeVertexNormals(), l
}

const EDGE = [-1, -0.9, -0.5, 0, 0.5, 0.9, 1], edgeK = (i) => Math.abs(i) > 0.95 ? -1 : Math.abs(i) > 0.8 ? 0.82 : 1
/** 原版 Lf：贴在曲面 r(x, z) 上的软垫贴片（四周收边） */
function patch(i, e, t, n, s, o, r, a = null, l = false, c = EDGE, u = EDGE) {
  return grid(c, u, (h, f, p) => {
    let d = i + h * t, v = e + (l ? f : -f) * n, g = Math.min(edgeK(h), edgeK(f)), x = r(d, v) + (g < 0 ? -22e-4 : s * g)
    p.set(d, l ? -x : x, v), a && a(p)
    let y = typeof o == 'function' ? o(h, f) : o, b = g < 0 ? 0.5 : g < 1 ? 0.8 : 1
    return [y[0] * b, y[1] * b, y[2] * b]
  })
}

const FINGERS = [{ base: [-0.031, 0, -0.094], len: [0.044, 0.026, 0.022], rad: [96e-4, 9e-3, 83e-4, 76e-4] }, { base: [-0.0105, 1e-3, -0.099], len: [0.049, 0.03, 0.023], rad: [97e-4, 91e-4, 84e-4, 77e-4] }, { base: [0.0105, 0, -0.095], len: [0.045, 0.028, 0.022], rad: [94e-4, 88e-4, 81e-4, 74e-4] }, { base: [0.03, -2e-3, -0.086], len: [0.035, 0.021, 0.02], rad: [84e-4, 78e-4, 72e-4, 66e-4] }]
const ANG = [12, 34, 44, 68, 90, 112, 136, 146, 168, 192, 220, 245, 270, 295, 320, 348].map((i) => i * Math.PI / 180), NA = ANG.length, PAD = 12e-4, SEG = [0.14, 0.22, 0.27, 0.73, 0.78, 0.88], BUMP = [0.1, 0.17, 0.1]

/** 原版 z_：三节手指（指根、两个关节处按角平分面裁切防穿插，指腹软垫、缝线、指尖封口） */
function fingerGeo(i) {
  let e = new Rings(NA), { base: t, qs: n, len: s, rad: o } = i, r = i.pads || [1, 1, 0], a = i.patchJ ?? 1, l = i.bump || BUMP, c = i.tipW || 1, u = i.tipH || 1, h = [], f = [], p = t.clone()
  for (let M = 0; M < 3; M++) h.push(p.clone()), f.push(FWD.clone().applyQuaternion(n[M + 1])), p.addScaledVector(f[M], s[M])
  let d = FWD.clone().applyQuaternion(n[0]), v = (M) => M ? f[M - 1] : d, g = [0, 1, 2].map((M) => new Vector3().addVectors(v(M), f[M]).normalize()), x = (M, E) => (M.x - h[E].x) * g[E].x + (M.y - h[E].y) * g[E].y + (M.z - h[E].z) * g[E].z, y = (M, E) => {
    let w = x(M, E)
    w > 0 && M.addScaledVector(v(E), -w / v(E).dot(g[E]))
  }, b = (M, E) => {
    let w = x(M, E)
    w < 0 && M.addScaledVector(f[E], -w / f[E].dot(g[E]))
  }, m = new Vector3(), A = new Quaternion(), _ = (M, E, w, S) => {
    let z = S.kD || 1, H = S.kP || 1, O = S.ao || 1
    for (let q = 0; q < NA; q++) {
      let U = Math.cos(ANG[q]), T = Math.sin(ANG[q]), D = q >= 1 && q <= 7, C = q >= 2 && q <= 6, G = w * U, j = T > 0 ? w * 0.96 * T * (C ? z : 1 + (z - 1) * 0.4) : w * 0.98 * T * H
      S.pad && C && (G += U * PAD, j += T * PAD), G *= S.wx || 1, j *= S.wy || 1, m.set(G, j, 0).applyQuaternion(M).add(E), S.a >= 0 && y(m, S.a), S.b >= 0 && b(m, S.b)
      let N = D ? Bv : q >= 10 && q <= 14 ? am : lm, Q = O
      S.pad && C ? N = Fv : S.patch && C && (N = lm, Q *= 0.9), (S.pad && D && !C || S.edge && D) && (N = dC), S.saddle && q >= 8 && (N = am, Q *= 0.9), S.stitch && D && (N = kf, Q *= 0.8), (q === 0 || q === 8 || q === 9 || q === 15) && (Q *= 0.72), q >= 9 && (Q *= S.aoP || 1), e.v(m, N, Q)
    }
  }
  _(n[0], tv.copy(h[0]).addScaledVector(d, -(i.rootBack || 0.012) - 2e-3), 1e-5, { a: 0, b: -1, ao: i.rootAo || 0.5 }), e.collapse(), _(n[0], tv.copy(h[0]).addScaledVector(d, -(i.rootBack || 0.012)), o[0] * (i.rootK || 1), { a: 0, b: -1, ao: i.rootAo || 0.5, saddle: i.saddle })
  for (let M = 0; M < 3; M++) {
    for (let E = 0; E < 4; E++) {
      let w = E / 3
      A.slerpQuaternions(n[M], n[M + 1], w), _(A, tv.copy(h[M]).addScaledVector(E < 2 ? v(M) : f[M], (E - 1.5) * 4e-4), o[M], { a: w < 0.5 ? M : -1, b: w < 0.5 ? -1 : M, kD: 1 + l[M] * (E === 0 || E === 3 ? 0.55 : 1), patch: M === a, saddle: i.saddle && M < 2, wx: M === 2 ? 1 + (c - 1) * 0.5 : 1, wy: M === 2 ? 1 + (u - 1) * 0.5 : 1, ao: M === 0 && !i.rootAo ? 0.62 + 0.1 * E : 1, aoP: E === 1 || E === 2 ? 0.55 : 0.8 })
    }
    if (M < 2) for (let E = 0; E < SEG.length; E++) {
      let w = SEG[E], S = (o[M] + (o[M + 1] - o[M]) * w) * (1 - 0.06 * Math.sin(Math.PI * w))
      _(n[M + 1], tv.copy(h[M]).addScaledVector(f[M], s[M] * w), S, { a: M + 1, b: M, pad: r[M] && (E === 2 || E === 3), edge: r[M] && (E === 1 || E === 4), saddle: i.saddle && M === 0, ao: M === 0 && !i.rootAo ? 0.86 + 0.14 * smoothstep(0, 0.5, w) : 1 })
    }
    else {
      let E = o[3], w = s[2] - E
      _(n[3], tv.copy(h[2]).addScaledVector(f[2], s[2] * 0.2), o[2] * 0.97, { a: -1, b: 2, stitch: 1, wx: c, wy: u }), _(n[3], tv.copy(h[2]).addScaledVector(f[2], s[2] * 0.42), (o[2] + E) * 0.5, { a: -1, b: 2, kP: 1.08, wx: c, wy: u })
      for (let S of [0, 0.6, 1.05, 1.36]) _(n[3], tv.copy(h[2]).addScaledVector(f[2], w + E * 1.08 * Math.sin(S)), E * Math.cos(S), { a: -1, b: -1, kP: 1.06, wx: c, wy: u })
      _(n[3], tv.copy(h[2]).addScaledVector(f[2], w + E * 1.08), 1e-5, { a: -1, b: -1 }), e.collapse()
    }
  }
  return e.geo()
}

const rotY = (i) => new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), i), rotX = (i) => new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), i)
/** 原版 C_：手指姿态 [三个关节弯曲, 外展] */
function finger(i, e) {
  let t = [rotY(e[3] || 0)]
  for (let n = 0; n < 3; n++) t.push(t[n].clone().multiply(rotX(-e[n])))
  return fingerGeo({ base: new Vector3(i.base[0], i.base[1], i.base[2]), qs: t, len: i.len, rad: i.rad })
}
/** 原版 _C：拇指每节朝向 */
function thumbQuat(i, e) {
  let t = i.clone().negate(), n = new Vector3().crossVectors(e, t)
  n.lengthSq() < 1e-6 && n.set(1, 0, 0), n.normalize()
  let s = new Vector3().crossVectors(t, n)
  return new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(n, s, t))
}
/** 原版 MC：拇指（三节方向） */
function thumb(i) {
  let e = i.map((o) => new Vector3(o[0], o[1], o[2]).normalize()), t = new Vector3(-0.72, 0.69, 0), n = [], s = e[2].clone().sub(e[0])
  s.length() > 0.12 && t.multiplyScalar(0.25).addScaledVector(s.normalize(), -1)
  for (let o = 0; o < 3; o++) n.push(thumbQuat(e[o], t))
  return n.unshift(n[0].clone()), fingerGeo({ base: new Vector3(-0.028, -7e-3, -0.014), qs: n, len: [0.044, 0.031, 0.026], rad: [0.0165, 0.0118, 0.011, 0.01], pads: [0, 1, 0], patchJ: 2, bump: [0, 0.2, 0.2], tipW: 1.12, tipH: 0.86, saddle: 1, rootBack: 0.01, rootK: 0.72, rootAo: 0.9 })
}

const PZ0 = 6e-3, knuckleZ = (i) => -0.0975 + 0.0125 * Math.pow((i + 8e-3) / 0.04, 2), palmEdgeZ = (i) => knuckleZ(i) + 6e-3, palmHalfW = (i) => 0.029 + 0.014 * smoothstep(0.05, 0.85, i), palmTop = (i) => 0.0185 - 65e-4 * smoothstep(0.1, 1, i), palmBottom = (i) => 0.0185 + 3e-3 * Math.sin(Math.PI * sat(i * 1.6)) - 55e-4 * smoothstep(0.3, 1, i)
/** 原版 kv：手背高度场 */
function backH(i, e) {
  let t = sat((PZ0 - e) / (PZ0 - palmEdgeZ(i))), n = Math.min(0.999, Math.abs(i / palmHalfW(t)))
  return palmTop(t) * Math.pow(1 - Math.pow(n, 2.5), 0.4)
}
/** 原版 wC：掌心高度场（小鱼际隆起） */
function heelH(i, e) {
  let t = sat((PZ0 - e) / (PZ0 - palmEdgeZ(i))), n = palmHalfW(t), s = Math.min(0.999, Math.abs(i / n))
  return palmBottom(t) * Math.pow(1 - Math.pow(s, 2.5), 0.4) * (1 + 0.14 * Math.max(0, i / n) * Math.sin(Math.PI * t))
}
/** 原版 EC：手掌主体 */
function palm() {
  let e = new Rings(24), t = new Vector3(), n = [[0, 0, 1, 1], [0.1, 0, 1, 1], [0.22, 0, 1, 1], [0.36, 0, 1, 1], [0.5, 0, 1, 1], [0.64, 0, 1, 1], [0.77, 0, 1, 1], [0.89, 0, 1, 1], [1, 0, 1, 1], [1, -5e-3, 0.8, 1], [1, -9e-3, 0.45, 0.985], [1, -0.0105, 0.04, 0.97]]
  for (let [s, o, r, a] of n) {
    let l = palmHalfW(s) * a, c = palmTop(s) * r, u = palmBottom(s) * r
    for (let h = 0; h < 24; h++) {
      let f = (h + 0.5) / 24 * Math.PI * 2, p = Math.cos(f), d = Math.sin(f), v = l * spow(p, 0.8), g = d >= 0 ? c * spow(d, 0.8) : u * spow(d, 0.8) * (1 + 0.14 * Math.max(0, v / l) * Math.sin(Math.PI * s))
      t.set(v, g, PZ0 + (palmEdgeZ(v) - PZ0) * s + o)
      let x = d > 0.3 ? Bv : d < -0.3 ? am : lm, y = 1
      s === 0.1 && d > 0.3 && (x = kf, y = 0.75), o < 0 && (x = lm, y = 0.7 + o * 30), d < -0.3 && (y *= 0.82 + 0.18 * Math.abs(p)), e.v(t, x, y)
    }
  }
  return e.geo()
}
/** 原版 SC：虎口（拇指与手掌之间的蹼） */
function web(i) {
  let t = new Rings(12), n = new Vector3(), s = new Vector3(), o = new Vector3(), r = new Vector3(), a = new Vector3(), l = new Vector3(i.x, i.y, i.z - 1).normalize(), c = [-0.12, 0, 0.2, 0.4, 0.6, 0.78, 0.9]
  for (let d = 0; d < c.length; d++) {
    let v = c[d], g = d === 0 || d === c.length - 1
    s.set(-0.028, -7e-3, -0.014).addScaledVector(i, 0.044 * v), o.set(-0.03, -3e-3, -0.022 - 0.06 * v), r.subVectors(s, o)
    let x = r.length() * 0.5 + 5e-3
    r.normalize(), a.crossVectors(r, l).normalize()
    let y = g ? 1e-5 : 85e-4 * (1 - 0.55 * v), b = g ? 1e-5 : x * (1 - 0.3 * v * v)
    for (let m = 0; m < 12; m++) {
      let A = (m + 0.5) / 12 * Math.PI * 2, _ = Math.cos(A), M = Math.sin(A)
      n.copy(s).add(o).multiplyScalar(0.5).addScaledVector(r, _ * b).addScaledVector(a, M * y)
      let E = a.y * M < 0
      t.v(n, E ? am : Bv, E ? 0.85 : 0.92)
    }
    g && t.collapse()
  }
  let u = t.geo(), h = u.attributes.position, f = u.index.array, p = 0
  for (let d = 0; d < f.length; d += 3) s.fromBufferAttribute(h, f[d]), o.fromBufferAttribute(h, f[d + 1]), n.fromBufferAttribute(h, f[d + 2]), p += s.dot(o.cross(n))
  if (p < 0) {
    for (let d = 0; d < f.length; d += 3) {
      let v = f[d + 1]
      f[d + 1] = f[d + 2], f[d + 2] = v
    }
    u.computeVertexNormals()
  }
  return u
}
/** 原版 P_：左右镜像（X 取反 + 反转绕序） */
function mirror(i) {
  if (i.scale(-1, 1, 1), !i.index) {
    let t = i.attributes.position.count, n = new Uint32Array(t)
    for (let s = 0; s < t; s++) n[s] = s
    i.setIndex(new BufferAttribute(n, 1))
  }
  let e = i.index.array
  for (let t = 0; t < e.length; t += 3) {
    let n = e[t + 1]
    e[t + 1] = e[t + 2], e[t + 2] = n
  }
  return i
}

/** 原版 Vv：整只手（手掌、指节护垫、防滑条、缝线、掌根垫、四指、拇指、虎口、袖口、魔术贴、拉襻、袖子） */
export function buildHand(i) {
  let e = [], n = (_d, v) => (e.push(v), v)
  n('palm', palm())
  {
    let d = []
    for (let v = 0; v <= 30; v++) d.push(-1 + v / 15)
    n('guard', grid(d, [-1, -0.9, -0.5, 0, 0.5, 0.9, 1], (v, g, x) => {
      let y = -5e-4 + v * 0.0405, b = knuckleZ(y) + 45e-4 - g * 0.011, m = Math.min(edgeK(v), edgeK(g)), A = 0
      for (let M = 0; M < 4; M++) {
        let E = (y - FINGERS[M].base[0]) / 58e-4
        A += (M === 3 ? 0.8 : 1) * Math.exp(-E * E)
      }
      A = Math.min(1, A) * (1 - 0.55 * g * g), x.set(y, backH(y, b) + (m < 0 ? g > 0.95 ? -8e-3 : -3e-3 : (16e-4 + 6e-3 * A) * m), b)
      let _ = m < 0 ? 0.6 : 0.85 + 1.3 * A
      return [Lv[0] * _, Lv[1] * _, Lv[2] * _]
    }))
  }
  for (let d = 0; d < 3; d++) n('bar', patch(1e-3, -0.034 - d * 0.015, 0.023 + d * 25e-4, 52e-4, 19e-4, Fv, backH))
  n('seam', patch(0, -0.0225, 0.027, 13e-4, 9e-4, kf.map((d) => d * 0.8), backH, null, false, EDGE, [-1, 0, 1].map((d) => d * 0.9))), n('heelPad', patch(0.013, -0.03, 0.0135, 0.017, 17e-4, Fv, heelH, null, true))
  let s = []
  for (let d = 0; d < 4; d++) {
    if (d === 0 && i.indexPoses) {
      for (let v of i.indexPoses) s.push(finger(FINGERS[0], v))
      continue
    }
    n('finger' + d, finger(FINGERS[d], i.fingers[d]))
  }
  n('thumb', thumb(i.thumb)), n('web', web(new Vector3(i.thumb[0][0], i.thumb[0][1], i.thumb[0][2]).normalize()))
  let o = new Vector3(i.forearm[0], i.forearm[1], i.forearm[2]).normalize(), r = i.sleeve || 0.36, a = 0.022, l = new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), o), c = new Quaternion(), u = new Quaternion(), h = (d) => (u.slerpQuaternions(c, l, smoothstep(2e-3, 0.042, d.z)), d.z -= a, d.applyQuaternion(u), d.z += a, d)
  {
    let v = new Rings(24), g = new Vector3(), x = [[-85e-4, -15e-4, Df, 0.6], [-9e-3, 22e-4, Df, 1.3], [-6e-3, 26e-4, Df, 1.3], [-52e-4, 2e-3, gl, 0.75], [4e-3, 14e-4, gl, 1], [0.011, 16e-4, gl, 0.7], [0.0122, 3e-3, Df, 1.2], [0.0305, 32e-4, Df, 1.2], [0.0317, 18e-4, gl, 0.7], [0.04, 2e-3, gl, 1], [0.054, 24e-4, gl, 1], [0.058, 26e-4, kf, 0.7], [0.058, -4e-3, gl, 0.4]]
    for (let [y, b, m, A] of x) for (let _ = 0; _ < 24; _++) {
      let M = (_ + 0.5) / 24 * Math.PI * 2, E = Math.sin(M)
      v.v(h(g.set((0.0296 + b) * spow(Math.cos(M), 0.8), (E >= 0 ? 0.0185 + b : 0.0204 + b) * spow(E, 0.8), y)), m, A)
    }
    n('cuff', v.geo(true))
  }
  n('strapTab', patch(9e-3, 0.0215, 0.0135, 76e-4, 17e-4, (d) => d > 0.55 ? kf.map((v) => v * 0.75) : [9, 9, 9.6], (d) => 0.0217 * Math.pow(1 - Math.pow(Math.min(0.999, Math.abs(d / 0.0328)), 2.5), 0.4), h)), n('pullTab', patch(3e-3, 4e-3, 65e-4, 0.0115, 22e-4, pC, () => 0.022, h, true))
  {
    let d = []
    for (let z = 0; z < 24; z++) d.push(z * 15), (z === 4 || z === 16) && d.push(z * 15 + 11.5), (z === 5 || z === 17) && d.push(z * 15 + 3.5)
    d.sort((z, H) => z - H)
    let v = d.length, g = d.indexOf(75), x = d.indexOf(255), y = new Rings(v), b = new Vector3(), m = 0.04 + r, A = [[0.0415, 0], [0.04, 1], [0.044, 2], [0.049, 3], [0.055, 3], [0.061, 3], [0.0655, 4], [0.0685, 5]], _ = [0.1415, 0.143, 0.157, 0.1582, 0.1662, 0.1674, 0.181, 0.1825], M = _.slice(), E = Math.ceil((m - 0.074) / 52e-4)
    for (let z = 0; z <= E; z++) {
      let H = 0.074 + (m - 0.074) * z / E
      _.some((O) => Math.abs(O - H) < 16e-4) || M.push(H)
    }
    M.sort((z, H) => z - H)
    for (let z of M) A.push([z, 6])
    let w = 0
    for (let [z, H] of A) for (let O = 0; O < v; O++) {
      let q = d[O] * Math.PI / 180, U, T = 1, D = E_
      if (H === 0) U = 0.0292, T = 0.4
      else if (H === 1) U = 0.0372, T = 1.15
      else if (H === 2) U = 0.0377, T = 1.1
      else if (H === 3) {
        let C = Math.cos(q * 12)
        U = 0.0368 + 12e-4 * C, T = 0.62 + 0.26 * C
      } else if (H === 4) U = 0.0356, T = 0.55
      else if (H === 5) U = 0.038, T = 0.9
      else {
        let C = (z - 0.0685) / (m - 0.0685), G = 48e-4 * Math.exp(-Math.pow((C - 0.13) / 0.11, 2)), j = 48e-4 * smoothstep(0.62, 0.85, C), N = Math.pow(Math.abs(Math.sin(Math.PI * z / 0.027 + 1.7 * Math.sin(q + 0.5) + 0.8 * Math.sin(2 * q + 1.3))), 0.6) * 2 - 1.25, Q = Math.pow(Math.abs(Math.sin(Math.PI * z / 0.034 + 1.9 * Math.sin(q - 0.8) + 0.7 * Math.sin(2 * q))), 0.6) * 2 - 1.25, K = Math.sin(z * 40 + 2 * Math.sin(q * 2 + 1)) + 0.6 * Math.sin(3 * q + z * 25)
        U = 0.0405 + 0.012 * Math.pow(C, 0.85) + 25e-4 * Math.exp(-Math.pow((z - 0.082) / 0.012, 2)) + G * N + j * Q + 16e-4 * K, T = 0.78 + 0.26 * smoothstep(-1.1, 0.5, (G * N + j * Q) / (G + j + 8e-4)) + 0.04 * K
        let ie = hash1(w)
        z > 0.1575 && z < 0.167 ? (D = gC, T *= 0.85 + 0.25 * ie) : z > 0.1425 && z < 0.1815 && (D = mC, T *= 0.78 + 0.3 * ie)
      }
      H > 0 && (O === g || O === x ? (U += 19e-4, T *= 1.3) : (Math.abs(O - g) === 1 || Math.abs(O - x) === 1) && (T *= 0.52)), b.set(Math.cos(q) * U, Math.sin(q) * U * 0.84, z), y.v(b, D, T), w++
    }
    for (let z = 0; z < v; z++) y.v(b.set(0, 0, m + 6e-3), E_, 0.3)
    y.collapse()
    let S = y.geo(true)
    S.applyMatrix4(new Matrix4().makeTranslation(0, 0, a).multiply(new Matrix4().makeRotationFromQuaternion(l)).multiply(new Matrix4().makeTranslation(0, 0, -a))), n('sleeve', S)
  }
  let p = { fabric: merge(e), index: s.length ? s : null, knuckle: FINGERS[0].base.slice() }
  return i.mirror && (mirror(p.fabric), p.index && p.index.forEach(mirror), p.knuckle[0] *= -1), p
}

/** 两个同拓扑几何按 t 插值（原版 z() 每帧插值食指顶点；这里预生成中间姿态） */
function lerpGeo(a, b, t) {
  const g = a.clone()
  for (const key of ['position', 'normal']) {
    const o = g.attributes[key].array, x = a.attributes[key].array, y = b.attributes[key].array
    for (let k = 0; k < o.length; k++) o[k] = x[k] + (y[k] - x[k]) * t
  }
  return g
}

/** 原版 dm 中的手部装配：右手握把（食指扳机姿态）、左手护木，以及战术/空仓换弹的左手关键帧轨迹 */
export function buildHands() {
  const mi = PAC9
  let y = (Me, we, be) => {
    let Oe = new Vector3(we[0], we[1], we[2]).normalize().applyQuaternion(Me.clone().invert())
    return be && (Oe.x *= -1), [Oe.x, Oe.y, Oe.z]
  }, b = quat(-0.24, 0, 0).multiply(quat(0, 0, -Math.PI / 2)), m = buildHand({ mirror: false, fingers: [null, [0.62, 1.72, 0.8, 0], [0.68, 1.7, 0.8, -0.03], [0.74, 1.66, 0.8, -0.09]], indexPoses: [[0.1, 0.16, 0.1, 0.05], [0.46, 1.15, 0.5, 0]], thumb: [y(b, [-0.85, 0.05, -0.5]), y(b, [-0.6, -0.05, -0.8]), y(b, [-0.05, -0.2, -0.97])], forearm: y(b, [0.27, -0.44, 0.86]), sleeve: 0.34 })
  const rightPos = new Vector3().fromArray(mi.grip).sub(new Vector3(6e-3, -0.031, -0.085).applyQuaternion(b))
  let H = quat(0, 0, Math.PI / 2).multiply(quat(0.06, 0, 0)), O = buildHand({ mirror: true, fingers: [[1.27, 1.42, 0.75, 0.02], [1.3, 1.45, 0.75, 0], [1.3, 1.45, 0.75, -0.02], [1.33, 1.45, 0.75, -0.05]], thumb: [y(H, [0, 0.25, -0.97], true), y(H, [0.05, 0.1, -0.99], true), y(H, [0, 0, -1], true)], forearm: y(H, [-0.5, -0.35, 0.79], true), sleeve: 0.34 })
  let U = new Vector3(0, -0.015, -0.055), T = (Me, we, be = U) => ({ q: Me.clone(), p: new Vector3(we[0], we[1], we[2]).sub(be.clone().applyQuaternion(Me)) }), D = (Me, we, be, Oe, pt = null) => ({ q: pt ? pt.clone() : Me.q.clone(), p: Me.p.clone().add(new Vector3(we, be, Oe)) }), C = quat(0, 0, Math.PI / 2).multiply(quat(0.12, 0, 0)), G = T(H, [-0.015, -0.062, -0.236]), j = T(C, [-0.0135, -0.15, -0.0745]), N = D(j, -0.035, -0.02, 0.01), Q = D(j, -0.06, -0.3, 0.13, C.clone().multiply(quat(-0.5, 0, 0.25))), K = D(j, 0, -0.035, 4e-3), ie = D(j, -4e-3, -0.06, 0), F = D(j, 0, -0.012, 0), X = quat(-0.6, 0, 0).multiply(new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(new Vector3(0, 0, 1), new Vector3(-1, 0, 0), new Vector3(0, -1, 0)))), ne = T(X, [mi.handlePos[0] - 4e-3, mi.handlePos[1], mi.handlePos[2]], new Vector3(0, -0.024, -0.118)), re = D(ne, 0, 0, mi.boltTravel), $ = [[0, G], [0.1, G], [0.36, N], [0.44, j], [0.5, j], [0.8, Q], [0.98, Q], [1.28, K], [1.35, j], [1.45, ie], [1.52, F], [1.62, j], [1.7, N], [2.02, G], [9, G]], ue = [...$.slice(0, 12), [1.7, N], [1.96, ne], [2.02, ne], [2.14, re], [2.19, re], [2.26, ne], [2.36, ne], [2.66, G], [9, G]]
  const [i0, i1] = m.index
  return {
    right: { fabric: m.fabric, index: [i0, lerpGeo(i0, i1, 0.5), i1], q: b, p: rightPos },
    left: { fabric: O.fabric, rest: G },
    tactical: $, empty: ue,
    /** 弹匣脱出 / 插入、空仓拉机柄三个时刻 */
    magOut: 0.47, magIn: 1.345, boltB: 2.02, boltP: 2.14, boltV: 2.19,
    /** 左手握弹匣姿态 j 与其旋转的逆（弹匣跟手用） */
    magGrip: j, magGripInv: C.clone().invert(),
  }
}

/** 原版 le：关键帧轨迹采样（smootherstep 缓动，位置 lerp、旋转 slerp） */
export function sampleTrack(Me, we, Y = new Vector3(), L = new Quaternion()) {
  let be = 0
  for (; be < Me.length - 2 && we > Me[be + 1][0];) be++
  let Oe = Me[be], pt = Me[be + 1], ut = smoother((we - Oe[0]) / Math.max(1e-4, pt[0] - Oe[0]))
  Y.copy(Oe[1].p).lerp(pt[1].p, ut), L.copy(Oe[1].q).slerp(pt[1].q, ut)
  return { p: Y, q: L }
}

const ue = new Quaternion(), ee = new Euler()
/** Three.js 四元数 → Unity 本地欧拉角（度）：Z 镜像后按 YXZ（= Unity 的 Z→X→Y 应用顺序）分解 */
export function toUnityEuler(q): [number, number, number] {
  ue.set(-q.x, -q.y, q.z, q.w)
  ee.setFromQuaternion(ue, 'YXZ')
  const d = 180 / Math.PI
  return [ee.x * d, ee.y * d, ee.z * d]
}
export const toUnityPos = (p): [number, number, number] => [p.x, p.y, -p.z]

// ---------------------------------------------------------------- 刻字

/** 原版 hm：刻字图集里每个标签的像素框 [x, y, w, h]（图集 1024×512） */
export const LABELS = { model: [8, 8, 330, 84], maker: [8, 100, 560, 40], cal: [8, 146, 560, 40], prop: [8, 192, 700, 40], safe: [8, 240, 90, 34], semi: [110, 240, 90, 34], auto: [212, 240, 90, 34], rack: [8, 290, 300, 110], warn: [330, 290, 420, 110], optic: [580, 8, 300, 60], light: [580, 76, 300, 60], dots: [320, 240, 60, 34], r2: [8, 420, 56, 40], r4: [72, 420, 56, 40], r6: [136, 420, 56, 40], r8: [200, 420, 56, 40], r10: [264, 420, 56, 40], r12: [328, 420, 56, 40] }

/** 原版 TC 的文字内容与字号（canvas 改为每个标签一张 scene.text 贴图；颜色为 sRGB + alpha） */
const C0 = [196 / 255, 198 / 255, 194 / 255, 0.92], RED = [205 / 255, 60 / 255, 40 / 255, 0.95]
export const LABEL_TEXT = {
  model: { text: 'PAC-9', size: 78, color: C0, align: 'left' },
  maker: { text: 'LONGSHORE ARMS · SALTLINE', size: 30, color: C0, align: 'left' },
  cal: { text: 'CAL 5.8×40   SN PA-004217', size: 27, color: C0, align: 'left' },
  prop: { text: '港务局装备 · 四号泊位武器库', size: 28, color: C0, align: 'left' },
  safe: { text: 'S', size: 30, color: C0 },
  semi: { text: '1', size: 30, color: C0 },
  auto: { text: 'A', size: 30, color: RED },
  rack: { text: 'B4-07', size: 104, color: [214 / 255, 206 / 255, 170 / 255, 0.9] },
  r2: { text: 'T2', size: 30, color: [190 / 255, 192 / 255, 188 / 255, 0.85] },
  r4: { text: 'T4', size: 30, color: [190 / 255, 192 / 255, 188 / 255, 0.85] },
  r6: { text: 'T6', size: 30, color: [190 / 255, 192 / 255, 188 / 255, 0.85] },
  r8: { text: 'T8', size: 30, color: [190 / 255, 192 / 255, 188 / 255, 0.85] },
  r10: { text: 'T10', size: 30, color: [190 / 255, 192 / 255, 188 / 255, 0.85] },
  r12: { text: 'T12', size: 30, color: [190 / 255, 192 / 255, 188 / 255, 0.85] },
  optic: { text: 'HX-2 反射瞄具', size: 44, color: C0 },
  light: { text: '900 LM  IPX8', size: 40, color: C0 },
  warn: { text: '警告：存放前必须清空弹膛\n仅限授权突击队员使用\n港务安全规程 44/7', size: 24, color: C0, align: 'left' },
}

/** 原版 dm 里传给 F_ 的刻字表：[标签, x, y, z, 高, 朝向 L/R/T] */
export const MARKINGS = [['model', -0.0168, -0.0315, 0.064, 95e-4, 'L'], ['maker', -0.0168, -0.042, 0.064, 3e-3, 'L'], ['cal', -0.0168, -0.0465, 0.064, 28e-4, 'L'], ['prop', -0.0168, -0.071, 0.066, 26e-4, 'L'], ['auto', -0.0168, -0.027, -0.0335, 36e-4, 'L'], ['semi', -0.0168, -0.0262, -0.049, 36e-4, 'L'], ['safe', -0.0168, -0.0362, -0.062, 36e-4, 'L'], ['rack', -0.0168, -4e-3, -0.205, 0.02, 'L'], ['warn', -0.0181, -0.01, 0.03, 62e-4, 'L'], ['optic', -0.0195, 0.0735, 0.021, 24e-4, 'L'], ['model', 0.0168, -0.0315, 0.068, 95e-4, 'R'], ['warn', 0.0168, -0.066, 0.066, 75e-4, 'R'], ['rack', 0.0168, -4e-3, -0.205, 0.02, 'R'], ['auto', 0.0168, -0.027, -0.0335, 36e-4, 'R'], ['safe', 0.0168, -0.0362, -0.062, 36e-4, 'R'], ['optic', 0.0195, 0.0735, 0.021, 24e-4, 'R'], ['cal', 0.0181, 0.0245, -0.055, 26e-4, 'R'], ['r2', 0, 0.04365, -0.0816, 3e-3, 'T'], ['r4', 0, 0.04365, -0.0616, 3e-3, 'T'], ['r6', 0, 0.04365, 0.0584, 3e-3, 'T'], ['r8', 0, 0.04365, 0.0784, 3e-3, 'T'], ['r10', 0, 0.04365, 0.0984, 3e-3, 'T'], ['r12', 0, 0.04365, 0.1184, 3e-3, 'T']]

/**
 * 原版 F_：刻字四边形。UV 由图集坐标改为每个标签 0..1（每个标签一张贴图），按标签分组返回几何；
 * 原版用 polygonOffset 防 Z 冲突，这里沿法线外移 lift 米。
 */
export function markingQuads(list = MARKINGS, lift = 2e-4) {
  const groups = {}
  for (let [l, c, u, h, f, p, d = 0] of list) {
    let [, , x, y] = LABELS[l], b = f * x / y, w
    if (p === 'L' ? w = [[c, u - f / 2, -(h + b / 2)], [c, u - f / 2, -(h - b / 2)], [c, u + f / 2, -(h - b / 2)], [c, u + f / 2, -(h + b / 2)]] : p === 'R' ? w = [[c, u - f / 2, -(h - b / 2)], [c, u - f / 2, -(h + b / 2)], [c, u + f / 2, -(h + b / 2)], [c, u + f / 2, -(h - b / 2)]] : w = [[c - b / 2, u, -(h - f / 2)], [c + b / 2, u, -(h - f / 2)], [c + b / 2, u, -(h + f / 2)], [c - b / 2, u, -(h + f / 2)]], d) {
      let z = Math.cos(d), H = Math.sin(d), O = u, q = -h
      for (let U of w) {
        let T = U[1] - O, D = U[2] - q
        U[1] = O + T * z - D * H, U[2] = q + T * H + D * z
      }
    }
    const g = groups[l] || (groups[l] = { P: [], U: [], N: [], I: [] })
    let E = g.P.length / 3, S = p === 'L' ? [-1, 0, 0] : p === 'R' ? [1, 0, 0] : [0, 1, 0]
    for (let z of w) g.P.push(z[0] + S[0] * lift, z[1] + S[1] * lift, z[2] + S[2] * lift)
    g.U.push(0, 0, 1, 0, 1, 1, 0, 1)
    for (let z = 0; z < 4; z++) g.N.push(S[0], S[1], S[2])
    g.I.push(E, E + 1, E + 2, E, E + 2, E + 3)
  }
  const out = {}
  for (const key of Object.keys(groups)) {
    const g = groups[key], o = new BufferGeometry()
    o.setAttribute('position', new Float32BufferAttribute(g.P, 3)), o.setAttribute('uv', new Float32BufferAttribute(g.U, 2)), o.setAttribute('normal', new Float32BufferAttribute(g.N, 3)), o.setIndex(g.I)
    out[key] = o
  }
  return out
}
