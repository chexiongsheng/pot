/**
 * 建模辅助：从原版 HTML（Three.js）移植的几何构建函数，算法与参数保持一致，便于直接搬运原版资产代码。
 *
 * 坐标约定与原版相同（Three.js 右手系，-Z 为前）。生成完后用 toMesh() 转成 Runner 的 MeshData：
 * 翻转 Z（变成 Unity 左手系，+Z 为前）、反转三角形绕序、顶点色从线性转 sRGB。
 *
 * 原版名 → 本文件名：im→hash3, sm→tint, Wi→roundedBox, Rt→box, hC→shape, __→extrude, M_→fixSideNormals,
 * xr→extrudeX, qo→extrudeZ, Cn→lathe, Fi→pin, Dv→slot, fC→octRect, Fn→tube, Ii→merge
 */
import type { MeshData } from '@pot/core'
import { BoxGeometry, BufferAttribute, BufferGeometry, CatmullRomCurve3, Euler, ExtrudeGeometry, Float32BufferAttribute, Matrix4, Path, Shape, TubeGeometry, Vector2, Vector3, mergeGeometries } from '../vendor/three-geo'

export type Geo = any
export type RGB = [number, number, number]
export type P2 = [number, number]
type Mask = (x: number, y: number, z: number) => boolean

/** 原版 im：坐标哈希（0..1） */
export const hash3 = (x: number, y: number, z: number) => {
  const n = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453
  return n - Math.floor(n)
}
/** 原版 cC：非角点（法线不是三轴都接近 ±1 之外的面）——圆角盒的平面部分 */
const flatMask: Mask = (x, y, z) => Math.max(Math.abs(x), Math.abs(y), Math.abs(z)) < 0.95
/** 原版 b_：挤出体的倒角面 */
const bevelMask: Mask = (_x, _y, z) => {
  const a = Math.abs(z)
  return a > 0.15 && a < 0.95
}

/** 原版 sm：写顶点色 = 颜色 × (0.9..1.1 的位置噪声)，wear>0 时在 mask 选中的面上加磨损亮点 */
export function tint(g: Geo, color: RGB, wear = 0, mask: Mask | null = null): Geo {
  const pos = g.attributes.position, nrm = g.attributes.normal, count = pos.count
  const out = new Float32Array(count * 3)
  for (let k = 0; k < count; k++) {
    const x = pos.getX(k), y = pos.getY(k), z = pos.getZ(k)
    let f = 0.9 + 0.2 * hash3(Math.round(x * 70), Math.round(y * 70), Math.round(z * 70))
    if (wear > 0 && mask && mask(nrm.getX(k), nrm.getY(k), nrm.getZ(k))) {
      const p = hash3(Math.round(x * 300), Math.round(y * 300), Math.round(z * 300))
      const d = Math.max(0, p - 0.84) / 0.16
      f *= 1 + wear * 1.6 * d * d
    }
    out[k * 3] = color[0] * f
    out[k * 3 + 1] = color[1] * f
    out[k * 3 + 2] = color[2] * f
  }
  g.setAttribute('color', new BufferAttribute(out, 3))
  return g
}

const tmp = new Vector3()
/** 原版 Wi：圆角盒（3×3×3 分段的盒子把边角推成半径 r 的圆角，UV 按米） */
export function roundedBox(w: number, h: number, d: number, r = 0.02, anchor: 'center' | 'bottom' = 'center'): Geo {
  r = Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4)
  const g = new BoxGeometry(w, h, d, 3, 3, 3)
  const pos = g.attributes.position, nrm = g.attributes.normal, uv = g.attributes.uv
  const hw = w / 2, hh = h / 2, hd = d / 2
  const snap = (p: number, half: number) => (Math.abs(p) > half - 1e-5 ? Math.sign(p) * half : Math.sign(p) * (half - r))
  for (let k = 0; k < pos.count; k++) {
    let x = snap(pos.getX(k), hw), y = snap(pos.getY(k), hh), z = snap(pos.getZ(k), hd)
    const cx = Math.max(-(hw - r), Math.min(hw - r, x)), cy = Math.max(-(hh - r), Math.min(hh - r, y)), cz = Math.max(-(hd - r), Math.min(hd - r, z))
    tmp.set(x - cx, y - cy, z - cz)
    if (tmp.lengthSq() > 1e-10) {
      tmp.normalize()
      const nx = nrm.getX(k), ny = nrm.getY(k), nz = nrm.getZ(k)
      const edges = (Math.abs(x) > hw - 1e-5 ? 1 : 0) + (Math.abs(y) > hh - 1e-5 ? 1 : 0) + (Math.abs(z) > hd - 1e-5 ? 1 : 0)
      if (edges >= 2) {
        x = cx + tmp.x * r; y = cy + tmp.y * r; z = cz + tmp.z * r
        nrm.setXYZ(k, tmp.x, tmp.y, tmp.z)
      } else nrm.setXYZ(k, nx, ny, nz)
    }
    pos.setXYZ(k, x, y, z)
    const ax = Math.abs(nrm.getX(k)), ay = Math.abs(nrm.getY(k)), az = Math.abs(nrm.getZ(k))
    if (ax >= ay && ax >= az) uv.setXY(k, z, y)
    else if (ay >= ax && ay >= az) uv.setXY(k, x, z)
    else uv.setXY(k, x, y)
  }
  if (anchor === 'bottom') g.translate(0, h / 2, 0)
  return g
}

const eul = new Euler()
const mat = new Matrix4()
/** 原版 Rt：圆角盒，着色 + 可选旋转（弧度 XYZ），放到 (x, y, -z) */
export function box(w: number, h: number, d: number, r: number, x: number, y: number, z: number, color: RGB, wear = 0, rot: [number, number, number] | null = null): Geo {
  const g = roundedBox(w, h, d, r)
  tint(g, color, wear, flatMask)
  if (rot) {
    eul.set(rot[0], rot[1], rot[2])
    g.applyMatrix4(mat.makeRotationFromEuler(eul))
  }
  g.translate(x, y, -z)
  return g
}

/** 原版 hC：点列 → Shape（可带洞） */
export function shape(points: P2[], holes?: P2[][] | null): Geo {
  const s = new Shape()
  points.forEach((p, k) => (k ? s.lineTo(p[0], p[1]) : s.moveTo(p[0], p[1])))
  s.closePath()
  if (holes) for (const h of holes) s.holes.push(new Path(h.map((p) => new Vector2(p[0], p[1]))))
  return s
}

/** 原版 __：沿 +Z 挤出，总厚 depth（含倒角 bevel） */
export function extrude(points: P2[], depth: number, bevel: number, holes?: P2[][] | null): Geo {
  return new ExtrudeGeometry(shape(points, holes), {
    depth: Math.max(1e-4, depth - 2 * bevel), bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelOffset: -bevel,
    bevelSegments: 1, steps: 1, curveSegments: 6,
  })
}

/** 原版 M_：挤出体倒角面的法线拉正（端面朝 ±Z，侧面压平到 XY），让小倒角看起来是硬边加高光线 */
export function fixSideNormals(g: Geo): Geo {
  g.computeBoundingBox()
  const z0 = g.boundingBox.min.z, z1 = g.boundingBox.max.z
  const pos = g.attributes.position, nrm = g.attributes.normal
  for (let k = 0; k < pos.count; k++) {
    const nz = nrm.getZ(k), a = Math.abs(nz)
    if (a < 0.15 || a > 0.95) continue
    const z = pos.getZ(k)
    if (Math.abs(z - z0) < 1e-6 || Math.abs(z - z1) < 1e-6) nrm.setXYZ(k, 0, 0, Math.sign(nz))
    else {
      const l = Math.hypot(nrm.getX(k), nrm.getY(k)) || 1
      nrm.setXYZ(k, nrm.getX(k) / l, nrm.getY(k) / l, 0)
    }
  }
  return g
}

/** 原版 xr：侧视轮廓（点为 [前后 x, 上下 y]）沿左右方向挤出，左右范围 z0..z1 */
export function extrudeX(points: P2[], z0: number, z1: number, bevel: number, color: RGB, wear = 0, holes: P2[][] | null = null): Geo {
  const g = extrude(points, z1 - z0, bevel, holes)
  tint(g, color, wear, bevelMask)
  fixSideNormals(g)
  g.translate(0, 0, z0 + bevel)
  g.rotateY(Math.PI / 2)
  return g
}

/** 原版 qo：截面轮廓（点为 [左右, 上下]）沿前后方向挤出，前后范围 z0..z1（向前为正） */
export function extrudeZ(points: P2[], z0: number, z1: number, bevel: number, color: RGB, wear = 0, holes: P2[][] | null = null): Geo {
  const g = extrude(points, z1 - z0, bevel, holes)
  tint(g, color, wear, bevelMask)
  fixSideNormals(g)
  g.translate(0, 0, -z1 + bevel)
  return g
}

/**
 * 原版 Cn：旋转体（轮廓点为 [半径, 向前距离]），绕前后轴旋转 segments 段，轴心在 (ox, oy)。
 * 每段独立顶点（硬边），斜面上 wear 加磨损亮点；colorFn(半径, 距离, 默认色) 可按位置改色。
 */
export function lathe(profile: P2[], segments: number, color: RGB, wear = 0, ox = 0, oy = 0, colorFn: ((r: number, z: number, c: RGB) => RGB) | null = null): Geo {
  const P: number[] = [], N: number[] = [], C: number[] = [], I: number[] = []
  let base = 0
  for (let p = 0; p < profile.length - 1; p++) {
    const [r0, z0] = profile[p], [r1, z1] = profile[p + 1]
    const dr = r1 - r0, dz = z1 - z0, len = Math.hypot(dr, dz)
    if (len < 1e-7) continue
    const nr = dz / len, nz = -dr / len
    const slanted = Math.abs(nr) > 0.25 && Math.abs(nz) > 0.25
    for (let s = 0; s <= segments; s++) {
      const a = (s / segments) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a)
      for (let end = 0; end < 2; end++) {
        const r = end ? r1 : r0, z = end ? z1 : z0
        P.push(ox + r * ca, oy + r * sa, -z)
        N.push(nr * ca, nr * sa, -nz)
        let f = 0.9 + 0.2 * hash3(Math.round(z * 150), Math.round(a * 3), p)
        if (slanted && wear > 0) {
          const j = hash3(s * 7.1, p * 3.3, z * 100)
          const d = Math.max(0, j - 0.84) / 0.16
          f *= 1 + wear * 1.6 * d * d
        }
        const c = colorFn ? colorFn(r, z, color) : color
        C.push(c[0] * f, c[1] * f, c[2] * f)
      }
    }
    for (let s = 0; s < segments; s++) {
      const a = base + s * 2, b = a + 2, c = a + 1, d = a + 3
      I.push(a, c, b, b, c, d)
    }
    base += (segments + 1) * 2
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute(P, 3))
  g.setAttribute('normal', new Float32BufferAttribute(N, 3))
  g.setAttribute('color', new Float32BufferAttribute(C, 3))
  g.setAttribute('uv', new Float32BufferAttribute(new Float32Array((P.length / 3) * 2), 2))
  g.setIndex(I)
  return g
}

/** 原版 Fi：沿左右轴的短圆柱销（半径 radius、长 length，端部倒角），中心 (x, y, -z) */
export function pin(radius: number, length: number, x: number, y: number, z: number, color: RGB, segments = 12, wear = 0): Geo {
  const ch = Math.min(radius * 0.25, length * 0.25), h = length / 2
  const g = lathe([[0, -h], [radius - ch, -h], [radius, -h + ch], [radius, h - ch], [radius - ch, h], [0, h]], segments, color, wear)
  g.rotateY(Math.PI / 2)
  g.translate(x, y, -z)
  return g
}

/** 原版 Dv：圆头长槽轮廓（中心 x,y，长 len、宽 width），作挤出的洞 */
export function slot(x: number, y: number, len: number, width: number, steps = 4): P2[] {
  const out: P2[] = [], r = width / 2, a = len / 2 - r
  for (let k = 0; k <= steps; k++) {
    const t = -Math.PI / 2 + (k / steps) * Math.PI
    out.push([x + a + Math.cos(t) * r, y + Math.sin(t) * r])
  }
  for (let k = 0; k <= steps; k++) {
    const t = Math.PI / 2 + (k / steps) * Math.PI
    out.push([x - a + Math.cos(t) * r, y + Math.sin(t) * r])
  }
  return out
}

/** 原版 fC：切角矩形 */
export const octRect = (x0: number, y0: number, x1: number, y1: number, c: number): P2[] =>
  [[x0 + c, y0], [x1 - c, y0], [x1, y0 + c], [x1, y1 - c], [x1 - c, y1], [x0 + c, y1], [x0, y1 - c], [x0, y0 + c]]

/** 原版 Fn：沿 Catmull-Rom 曲线的管子（UV 按米） */
export function tube(points: [number, number, number][], radius = 0.03, radial = 8, closed = false, tension = 0): Geo {
  const curve = new CatmullRomCurve3(points.map((p) => new Vector3(p[0], p[1], p[2])), closed, 'catmullrom', tension)
  const len = curve.getLength()
  const seg = Math.max(2, Math.ceil(len / Math.max(0.08, radius * 3)))
  const g = new TubeGeometry(curve, Math.min(seg, 400), radius, radial, closed)
  const uv = g.attributes.uv
  for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * len, uv.getY(k) * Math.PI * 2 * radius)
  return g
}

/** 原版 Ii：合并成一个几何（补齐 uv/normal/color，混合索引时统一转非索引） */
export function merge(list: Geo[]): Geo {
  const geos = list.filter(Boolean).map((g) => {
    if (!g.attributes.uv) g.setAttribute('uv', new BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2))
    if (!g.attributes.normal) g.computeVertexNormals()
    return g
  })
  if (!geos.length) return new BufferGeometry()
  const anyColor = geos.some((g) => g.attributes.color)
  for (const g of geos) {
    if (anyColor && !g.attributes.color) g.setAttribute('color', new BufferAttribute(new Float32Array(g.attributes.position.count * 3).fill(1), 3))
    for (const key of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(key)) g.deleteAttribute(key)
  }
  const allIndexed = geos.every((g) => g.index), noneIndexed = geos.every((g) => !g.index)
  const ready = allIndexed || noneIndexed ? geos : geos.map((g) => (g.index ? g.toNonIndexed() : g))
  return mergeGeometries(ready, false) ?? new BufferGeometry()
}

/** 三角形数 */
export const triCount = (g: Geo) => (g.index ? g.index.count : g.attributes.position.count) / 3

/** 线性 → sRGB（标准分段公式，大于 1 照常外推；Runner 用同一公式的逆解码，不截断） */
const toSrgb = (v: number) => (v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055)

/**
 * Three.js 几何 → Runner MeshData：Z 取反（右手 → 左手，-Z 前 → +Z 前），绕序反转，线性顶点色转 sRGB（可大于 1，作亮度倍数）。
 */
export function toMesh(g: Geo): MeshData {
  const pos = g.attributes.position, nrm = g.attributes.normal, uv = g.attributes.uv, col = g.attributes.color
  const n = pos.count
  const positions = new Float32Array(n * 3), normals = new Float32Array(n * 3)
  for (let k = 0; k < n; k++) {
    positions[k * 3] = pos.getX(k); positions[k * 3 + 1] = pos.getY(k); positions[k * 3 + 2] = -pos.getZ(k)
    if (nrm) { normals[k * 3] = nrm.getX(k); normals[k * 3 + 1] = nrm.getY(k); normals[k * 3 + 2] = -nrm.getZ(k) } else normals[k * 3 + 1] = 1
  }
  let uvs: Float32Array | undefined
  if (uv) {
    uvs = new Float32Array(n * 2)
    for (let k = 0; k < n; k++) { uvs[k * 2] = uv.getX(k); uvs[k * 2 + 1] = uv.getY(k) }
  }
  let colors: Float32Array | undefined
  if (col) {
    colors = new Float32Array(n * 4)
    for (let k = 0; k < n; k++) {
      colors[k * 4] = toSrgb(col.getX(k)); colors[k * 4 + 1] = toSrgb(col.getY(k)); colors[k * 4 + 2] = toSrgb(col.getZ(k)); colors[k * 4 + 3] = 1
    }
  }
  const src: ArrayLike<number> = g.index ? g.index.array : Array.from({ length: n }, (_, k) => k)
  const indices = new Uint32Array(src.length)
  for (let k = 0; k < src.length; k += 3) { indices[k] = src[k]; indices[k + 1] = src[k + 2]; indices[k + 2] = src[k + 1] }
  return { positions, normals, uvs, colors, indices }
}

/** 线性 RGB → sRGB（给 MaterialOptions.color 用，原版材质颜色都是线性值） */
export const linearColor = (c: RGB): [number, number, number] => [toSrgb(c[0]), toSrgb(c[1]), toSrgb(c[2])]
