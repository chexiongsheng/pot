/**
 * Web 宿主的网格表（004 第 20.8 节）：mesh / meshCached / meshTangents / meshColors / meshAttribute / meshSkin 的语义照 PotScene.cs。
 * 纯数据，不碰 WebGL：gl.ts 按 version 上传缓冲区，physics.ts 用位置与索引做网格碰撞。
 * 约定：顶点色存线性值（Unity 线性色彩空间工程把 sRGB 顶点色转线性后写入）；没给法线时按面法线面积加权累加（RecalculateNormals），
 * 有 UV 时计算切线（RecalculateTangents）；自定义属性占 UV1-UV7，蒙皮网格的 UV1-UV3 存静止姿态的位置、法线、切线。
 */
import { srgbToLinear } from './math'

export interface MeshAttribute {
  name: string
  size: number
  data: Float32Array
}

export interface MeshSkinData {
  /** 每顶点 4 个骨骼下标与权重（不足 4 根的补 0 权重） */
  bones: Uint32Array
  weights: Float32Array
  /** 每根 16 个，列主序 */
  bindPoses: Float32Array
  boneCount: number
}

export interface WebMesh {
  name: string
  vertexCount: number
  positions: Float32Array
  normals: Float32Array
  uvs: Float32Array | null
  /** 线性 rgba；null 表示没有顶点色（着色器读到白色） */
  colors: Float32Array | null
  /** xyzw，w 为 ±1；没有 UV 时为 null */
  tangents: Float32Array | null
  indices: Uint32Array
  /** UV 通道（1-7）→ 自定义属性 */
  attributes: Map<number, MeshAttribute>
  skin: MeshSkinData | null
  /** 局部包围盒 */
  min: [number, number, number]
  max: [number, number, number]
  /** 内容变化时加一（gl.ts、physics.ts 据此重建） */
  version: number
}

function floats(buf: ArrayBuffer | ArrayBufferView | null | undefined): Float32Array | null {
  if (!buf) return null
  const n = Math.floor(buf.byteLength / 4)
  if (n < 1) return null
  const src = ArrayBuffer.isView(buf) ? new Float32Array(buf.buffer as ArrayBuffer, buf.byteOffset, n) : new Float32Array(buf, 0, n)
  return new Float32Array(src)
}

function ints(buf: ArrayBuffer | ArrayBufferView | null | undefined): Int32Array | null {
  if (!buf) return null
  const n = Math.floor(buf.byteLength / 4)
  if (n < 1) return null
  const src = ArrayBuffer.isView(buf) ? new Int32Array(buf.buffer as ArrayBuffer, buf.byteOffset, n) : new Int32Array(buf, 0, n)
  return new Int32Array(src)
}

/** 按三角形面积加权累加面法线（顺时针为正面：cross(b - a, c - a) 朝外） */
export function computeNormals(p: Float32Array, idx: Uint32Array, vcount: number): Float32Array {
  const n = new Float32Array(vcount * 3)
  for (let t = 0; t + 2 < idx.length; t += 3) {
    const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3
    if (a >= p.length || b >= p.length || c >= p.length) continue
    const e1x = p[b] - p[a], e1y = p[b + 1] - p[a + 1], e1z = p[b + 2] - p[a + 2]
    const e2x = p[c] - p[a], e2y = p[c + 1] - p[a + 1], e2z = p[c + 2] - p[a + 2]
    const cx = e1y * e2z - e1z * e2y, cy = e1z * e2x - e1x * e2z, cz = e1x * e2y - e1y * e2x
    for (const v of [a, b, c]) {
      n[v] += cx
      n[v + 1] += cy
      n[v + 2] += cz
    }
  }
  for (let i = 0; i < vcount * 3; i += 3) {
    const l = Math.hypot(n[i], n[i + 1], n[i + 2])
    if (l > 1e-20) {
      n[i] /= l
      n[i + 1] /= l
      n[i + 2] /= l
    } else n[i + 1] = 1
  }
  return n
}

/** 切线（Lengyel 方法，按 UV 梯度累加后对法线正交化）；w 为副切线方向 */
export function computeTangents(p: Float32Array, n: Float32Array, uv: Float32Array, idx: Uint32Array, vcount: number): Float32Array {
  const tan = new Float64Array(vcount * 3)
  const bit = new Float64Array(vcount * 3)
  for (let t = 0; t + 2 < idx.length; t += 3) {
    const i0 = idx[t], i1 = idx[t + 1], i2 = idx[t + 2]
    if (i0 >= vcount || i1 >= vcount || i2 >= vcount) continue
    const x1 = p[i1 * 3] - p[i0 * 3], y1 = p[i1 * 3 + 1] - p[i0 * 3 + 1], z1 = p[i1 * 3 + 2] - p[i0 * 3 + 2]
    const x2 = p[i2 * 3] - p[i0 * 3], y2 = p[i2 * 3 + 1] - p[i0 * 3 + 1], z2 = p[i2 * 3 + 2] - p[i0 * 3 + 2]
    const s1 = uv[i1 * 2] - uv[i0 * 2], t1 = uv[i1 * 2 + 1] - uv[i0 * 2 + 1]
    const s2 = uv[i2 * 2] - uv[i0 * 2], t2 = uv[i2 * 2 + 1] - uv[i0 * 2 + 1]
    const det = s1 * t2 - s2 * t1
    if (Math.abs(det) < 1e-20) continue
    const r = 1 / det
    const sx = (t2 * x1 - t1 * x2) * r, sy = (t2 * y1 - t1 * y2) * r, sz = (t2 * z1 - t1 * z2) * r
    const tx = (s1 * x2 - s2 * x1) * r, ty = (s1 * y2 - s2 * y1) * r, tz = (s1 * z2 - s2 * z1) * r
    for (const v of [i0, i1, i2]) {
      tan[v * 3] += sx; tan[v * 3 + 1] += sy; tan[v * 3 + 2] += sz
      bit[v * 3] += tx; bit[v * 3 + 1] += ty; bit[v * 3 + 2] += tz
    }
  }
  const out = new Float32Array(vcount * 4)
  for (let v = 0; v < vcount; v++) {
    const nx = n[v * 3], ny = n[v * 3 + 1], nz = n[v * 3 + 2]
    let tx = tan[v * 3], ty = tan[v * 3 + 1], tz = tan[v * 3 + 2]
    const d = nx * tx + ny * ty + nz * tz
    tx -= nx * d; ty -= ny * d; tz -= nz * d
    let l = Math.hypot(tx, ty, tz)
    if (l < 1e-20) {
      // 退化：取任一与法线垂直的方向
      if (Math.abs(nx) < 0.9) { tx = 0; ty = -nz; tz = ny } else { tx = nz; ty = 0; tz = -nx }
      l = Math.hypot(tx, ty, tz) || 1
    }
    tx /= l; ty /= l; tz /= l
    // w：cross(n, t) 与 UV 的 v 方向同向为 +1
    const cx = ny * tz - nz * ty, cy = nz * tx - nx * tz, cz = nx * ty - ny * tx
    const w = cx * bit[v * 3] + cy * bit[v * 3 + 1] + cz * bit[v * 3 + 2] < 0 ? -1 : 1
    out.set([tx, ty, tz, w], v * 4)
  }
  return out
}

export class WebMeshes {
  readonly meshes = new Map<string, WebMesh>()
  private keys = new Map<string, string>()
  private versions = 0

  get(name: string): WebMesh | undefined {
    return this.meshes.get(name)
  }

  /** 冷重启时清空 */
  clear(): void {
    this.meshes.clear()
    this.keys.clear()
  }

  cached(name: string, key: string): number {
    if (!key) return -1
    const m = this.meshes.get(name)
    if (!m || this.keys.get(name) !== key) return -1
    return m.vertexCount
  }

  register(name: string, positions: ArrayBuffer | ArrayBufferView, normals: ArrayBuffer | ArrayBufferView | null, uvs: ArrayBuffer | ArrayBufferView | null,
    colors: ArrayBuffer | ArrayBufferView | null, indices: ArrayBuffer | ArrayBufferView, key: string): number {
    this.keys.delete(name)
    const p = floats(positions)
    const ii = ints(indices)
    if (!p || !ii) return 0
    const vcount = Math.floor(p.length / 3)
    const idx = new Uint32Array(ii.buffer)
    const uvf = floats(uvs)
    const uv = uvf && uvf.length >= vcount * 2 ? uvf : null
    const cf = floats(colors)
    let col: Float32Array | null = null
    if (cf && cf.length >= vcount * 4) {
      col = new Float32Array(vcount * 4)
      for (let i = 0; i < vcount; i++) {
        col[i * 4] = srgbToLinear(cf[i * 4])
        col[i * 4 + 1] = srgbToLinear(cf[i * 4 + 1])
        col[i * 4 + 2] = srgbToLinear(cf[i * 4 + 2])
        col[i * 4 + 3] = cf[i * 4 + 3]
      }
    }
    const nf = floats(normals)
    const nrm = nf && nf.length >= vcount * 3 ? nf : computeNormals(p, idx, vcount)
    const min: [number, number, number] = [Infinity, Infinity, Infinity]
    const max: [number, number, number] = [-Infinity, -Infinity, -Infinity]
    for (let i = 0; i < vcount; i++) {
      for (let k = 0; k < 3; k++) {
        const v = p[i * 3 + k]
        if (v < min[k]) min[k] = v
        if (v > max[k]) max[k] = v
      }
    }
    if (vcount === 0) {
      min.fill(0)
      max.fill(0)
    }
    const mesh: WebMesh = {
      name, vertexCount: vcount, positions: p, normals: nrm, uvs: uv, colors: col,
      tangents: uv ? computeTangents(p, nrm, uv, idx, vcount) : null,
      indices: idx, attributes: new Map(), skin: null, min, max, version: ++this.versions,
    }
    this.meshes.set(name, mesh)
    if (key) this.keys.set(name, key)
    return vcount
  }

  tangents(name: string, data: ArrayBuffer | ArrayBufferView): string {
    const m = this.meshes.get(name)
    if (!m) return `未注册的网格：${name}`
    const t = floats(data)
    if (!t || t.length !== m.vertexCount * 4) {
      this.keys.delete(name)
      return `tangents 须为每顶点 4 个数（xyzw），共 ${m.vertexCount * 4} 个`
    }
    for (let i = 3; i < t.length; i += 4) t[i] = t[i] < 0 ? -1 : 1
    m.tangents = t
    m.version = ++this.versions
    return ''
  }

  colors(name: string, data: ArrayBuffer | ArrayBufferView, linear: boolean): string {
    const m = this.meshes.get(name)
    if (!m) return `未注册的网格：${name}`
    const c = floats(data)
    if (!c || c.length !== m.vertexCount * 4) {
      this.keys.delete(name)
      return `colors 须为每顶点 4 个数（rgba），共 ${m.vertexCount * 4} 个`
    }
    if (!linear) {
      for (let i = 0; i < c.length; i += 4) {
        c[i] = srgbToLinear(c[i])
        c[i + 1] = srgbToLinear(c[i + 1])
        c[i + 2] = srgbToLinear(c[i + 2])
      }
    }
    m.colors = c
    m.version = ++this.versions
    return ''
  }

  attribute(name: string, channel: number, attr: string, size: number, data: ArrayBuffer | ArrayBufferView): string {
    const m = this.meshes.get(name)
    if (!m) return `未注册的网格：${name}`
    const d = floats(data)
    let err = ''
    if (channel < 1 || channel > 7) err = '自定义顶点属性最多 7 个'
    else if (size < 1 || size > 4) err = `属性 ${attr} 的 size 须为 1 到 4`
    else if (!d || d.length !== m.vertexCount * size) err = `属性 ${attr} 须为每顶点 ${size} 个数，共 ${m.vertexCount * size} 个`
    else if (m.skin) err = '蒙皮网格不能带自定义顶点属性（UV1-3 已用于静止姿态）'
    if (err) {
      this.keys.delete(name)
      return err
    }
    m.attributes.set(channel, { name: attr, size, data: d! })
    m.version = ++this.versions
    return ''
  }

  /** 自定义属性所在的 UV 通道；没有返回 -1 */
  attributeChannel(m: WebMesh, attr: string): number {
    for (const [ch, a] of m.attributes) if (a.name === attr) return ch
    return -1
  }

  skin(name: string, boneIndices: ArrayBuffer | ArrayBufferView, weights: ArrayBuffer | ArrayBufferView | null, bindPoses: ArrayBuffer | ArrayBufferView | null): string {
    const m = this.meshes.get(name)
    if (!m) return `未注册的网格：${name}`
    const fail = (e: string) => {
      this.keys.delete(name)
      return e
    }
    if (m.attributes.size) return fail('带自定义顶点属性的网格不能蒙皮（UV1-3 要存静止姿态）')
    const bi = ints(boneIndices)
    const w = floats(weights)
    const bp = floats(bindPoses)
    const vcount = m.vertexCount
    if (!bi || vcount === 0 || bi.length % vcount !== 0) return fail('boneIndices 的长度须为顶点数的整数倍')
    const per = bi.length / vcount
    if (per < 1 || per > 4) return fail('每个顶点只能有 1 到 4 根骨骼')
    if (w && w.length !== bi.length) return fail('boneWeights 的长度须与 boneIndices 相同')
    const bones = new Uint32Array(vcount * 4)
    const ws = new Float32Array(vcount * 4)
    let maxBone = 0
    for (let v = 0; v < vcount; v++) {
      let sum = 0
      for (let k = 0; k < per; k++) {
        const b = bi[v * per + k]
        if (b < 0) return fail(`第 ${v} 个顶点的骨骼下标为负`)
        const wk = w ? Math.max(0, w[v * per + k]) : k === 0 ? 1 : 0
        bones[v * 4 + k] = b
        ws[v * 4 + k] = wk
        sum += wk
        if (b > maxBone) maxBone = b
      }
      if (sum > 1e-6) for (let k = 0; k < 4; k++) ws[v * 4 + k] /= sum
      else ws[v * 4] = 1
    }
    const boneCount = maxBone + 1
    let poses: Float32Array
    if (bp) {
      if (bp.length < boneCount * 16 || bp.length % 16 !== 0) return fail(`bindPoses 须为每根骨骼 16 个数，至少 ${boneCount * 16} 个`)
      poses = bp
    } else {
      poses = new Float32Array(boneCount * 16)
      for (let i = 0; i < boneCount; i++) poses.set([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], i * 16)
    }
    m.skin = { bones, weights: ws, bindPoses: poses, boneCount: Math.max(boneCount, poses.length / 16) }
    m.version = ++this.versions
    return ''
  }
}
