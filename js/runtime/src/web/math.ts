/**
 * Web 宿主的矩阵与四元数（004 第 20.3 节）。约定与 Unity 相同：左手系、Y 向上、相机看 +Z；
 * 欧拉角为度，旋转顺序先 z、再 x、最后 y（q = qY * qX * qZ，与 scene.ts 的 eulerToQuaternion 一致）。
 * 矩阵为列主序 Float32Array(16)，与 WebGL 的 uniformMatrix4fv 直接对应。
 */
export type V3 = [number, number, number]
export type Q4 = [number, number, number, number]
export type M4 = Float32Array

/** 欧拉角（度）→ 四元数，与 scene.ts 的 eulerToQuaternion、Unity 的 Quaternion.Euler 相同（web 包不引入 scene.ts，故复制一份） */
export function eulerToQuaternion(x: number, y: number, z: number): Q4 {
  const h = Math.PI / 360
  const sx = Math.sin(x * h), cx = Math.cos(x * h)
  const sy = Math.sin(y * h), cy = Math.cos(y * h)
  const sz = Math.sin(z * h), cz = Math.cos(z * h)
  const ax = sx * cz, ay = -sx * sz, az = cx * sz, aw = cx * cz
  return [cy * ax + sy * az, cy * ay + sy * aw, cy * az - sy * ax, cy * aw - sy * ay]
}

export function mat4(): M4 {
  const m = new Float32Array(16)
  m[0] = m[5] = m[10] = m[15] = 1
  return m
}

/** 平移 × 旋转 × 缩放 */
export function composeTRS(p: ArrayLike<number>, q: ArrayLike<number>, s: ArrayLike<number>, out: M4 = new Float32Array(16)): M4 {
  const [x, y, z, w] = [q[0], q[1], q[2], q[3]]
  const x2 = x + x, y2 = y + y, z2 = z + z
  const xx = x * x2, xy = x * y2, xz = x * z2
  const yy = y * y2, yz = y * z2, zz = z * z2
  const wx = w * x2, wy = w * y2, wz = w * z2
  out[0] = (1 - (yy + zz)) * s[0]
  out[1] = (xy + wz) * s[0]
  out[2] = (xz - wy) * s[0]
  out[3] = 0
  out[4] = (xy - wz) * s[1]
  out[5] = (1 - (xx + zz)) * s[1]
  out[6] = (yz + wx) * s[1]
  out[7] = 0
  out[8] = (xz + wy) * s[2]
  out[9] = (yz - wx) * s[2]
  out[10] = (1 - (xx + yy)) * s[2]
  out[11] = 0
  out[12] = p[0]
  out[13] = p[1]
  out[14] = p[2]
  out[15] = 1
  return out
}

export function multiply(a: ArrayLike<number>, b: ArrayLike<number>, out: M4 = new Float32Array(16)): M4 {
  const r = new Float32Array(16)
  for (let c = 0; c < 4; c++) {
    for (let row = 0; row < 4; row++) {
      r[c * 4 + row] = a[row] * b[c * 4] + a[4 + row] * b[c * 4 + 1] + a[8 + row] * b[c * 4 + 2] + a[12 + row] * b[c * 4 + 3]
    }
  }
  out.set(r)
  return out
}

export function invert(m: ArrayLike<number>, out: M4 = new Float32Array(16)): M4 {
  const a00 = m[0], a01 = m[1], a02 = m[2], a03 = m[3]
  const a10 = m[4], a11 = m[5], a12 = m[6], a13 = m[7]
  const a20 = m[8], a21 = m[9], a22 = m[10], a23 = m[11]
  const a30 = m[12], a31 = m[13], a32 = m[14], a33 = m[15]
  const b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10
  const b02 = a00 * a13 - a03 * a10, b03 = a01 * a12 - a02 * a11
  const b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12
  const b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30
  const b08 = a20 * a33 - a23 * a30, b09 = a21 * a32 - a22 * a31
  const b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32
  let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06
  if (!det) {
    out.set(mat4())
    return out
  }
  det = 1 / det
  out[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det
  out[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det
  out[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det
  out[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det
  out[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det
  out[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det
  out[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det
  out[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det
  out[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det
  out[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det
  out[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det
  out[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det
  out[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det
  out[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det
  out[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det
  out[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det
  return out
}

export function transformPoint(m: ArrayLike<number>, x: number, y: number, z: number): V3 {
  return [
    m[0] * x + m[4] * y + m[8] * z + m[12],
    m[1] * x + m[5] * y + m[9] * z + m[13],
    m[2] * x + m[6] * y + m[10] * z + m[14],
  ]
}

export function quatMultiply(a: ArrayLike<number>, b: ArrayLike<number>): Q4 {
  return [
    a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
  ]
}

export function quatConjugate(q: ArrayLike<number>): Q4 {
  return [-q[0], -q[1], -q[2], q[3]]
}

export function quatNormalize(q: ArrayLike<number>): Q4 {
  const l = Math.hypot(q[0], q[1], q[2], q[3]) || 1
  return [q[0] / l, q[1] / l, q[2] / l, q[3] / l]
}

export function rotateVector(q: ArrayLike<number>, v: ArrayLike<number>): V3 {
  const [qx, qy, qz, qw] = [q[0], q[1], q[2], q[3]]
  const tx = 2 * (qy * v[2] - qz * v[1])
  const ty = 2 * (qz * v[0] - qx * v[2])
  const tz = 2 * (qx * v[1] - qy * v[0])
  return [
    v[0] + qw * tx + (qy * tz - qz * ty),
    v[1] + qw * ty + (qz * tx - qx * tz),
    v[2] + qw * tz + (qx * ty - qy * tx),
  ]
}

const DEG = 180 / Math.PI

/** 四元数 → Unity 的 eulerAngles（度，各分量在 [0, 360)） */
export function quatToEuler(q: ArrayLike<number>): V3 {
  const [x, y, z, w] = [q[0], q[1], q[2], q[3]]
  // 旋转矩阵 R = Ry * Rx * Rz 的元素（行, 列）
  const m02 = 2 * (x * z + w * y)
  const m22 = 1 - 2 * (x * x + y * y)
  const m12 = 2 * (y * z - w * x)
  const m10 = 2 * (x * y + w * z)
  const m11 = 1 - 2 * (x * x + z * z)
  const m00 = 1 - 2 * (y * y + z * z)
  const m20 = 2 * (x * z - w * y)
  let ex: number, ey: number, ez: number
  const sx = Math.max(-1, Math.min(1, -m12))
  ex = Math.asin(sx)
  if (Math.abs(sx) < 0.9999995) {
    ey = Math.atan2(m02, m22)
    ez = Math.atan2(m10, m11)
  } else {
    ey = Math.atan2(-m20, m00)
    ez = 0
  }
  const wrap = (a: number) => {
    let d = a * DEG
    d %= 360
    if (d < 0) d += 360
    return Math.abs(d - 360) < 1e-4 || Math.abs(d) < 1e-4 ? 0 : d
  }
  return [wrap(ex), wrap(ey), wrap(ez)]
}

/** Unity 的 Quaternion.LookRotation(forward, up) */
export function lookRotation(f: ArrayLike<number>, up: ArrayLike<number> = [0, 1, 0]): Q4 {
  let fl = Math.hypot(f[0], f[1], f[2])
  if (fl < 1e-9) return [0, 0, 0, 1]
  const zx = f[0] / fl, zy = f[1] / fl, zz = f[2] / fl
  // x = normalize(cross(up, z))
  let xx = up[1] * zz - up[2] * zy
  let xy = up[2] * zx - up[0] * zz
  let xz = up[0] * zy - up[1] * zx
  let xl = Math.hypot(xx, xy, xz)
  if (xl < 1e-9) {
    // forward 与 up 平行：换一个参考轴
    xx = zz; xy = 0; xz = -zx
    xl = Math.hypot(xx, xy, xz) || 1
  }
  xx /= xl; xy /= xl; xz /= xl
  const yx = zy * xz - zz * xy
  const yy = zz * xx - zx * xz
  const yz = zx * xy - zy * xx
  return matrixToQuat(xx, yx, zx, xy, yy, zy, xz, yz, zz)
}

/** 3×3 旋转矩阵（按行给出 m00 m01 m02 / m10 m11 m12 / m20 m21 m22）→ 四元数 */
export function matrixToQuat(m00: number, m01: number, m02: number, m10: number, m11: number, m12: number, m20: number, m21: number, m22: number): Q4 {
  const tr = m00 + m11 + m22
  let x, y, z, w
  if (tr > 0) {
    const s = Math.sqrt(tr + 1) * 2
    w = 0.25 * s
    x = (m21 - m12) / s
    y = (m02 - m20) / s
    z = (m10 - m01) / s
  } else if (m00 > m11 && m00 > m22) {
    const s = Math.sqrt(1 + m00 - m11 - m22) * 2
    w = (m21 - m12) / s
    x = 0.25 * s
    y = (m01 + m10) / s
    z = (m02 + m20) / s
  } else if (m11 > m22) {
    const s = Math.sqrt(1 + m11 - m00 - m22) * 2
    w = (m02 - m20) / s
    x = (m01 + m10) / s
    y = 0.25 * s
    z = (m12 + m21) / s
  } else {
    const s = Math.sqrt(1 + m22 - m00 - m11) * 2
    w = (m10 - m01) / s
    x = (m02 + m20) / s
    y = (m12 + m21) / s
    z = 0.25 * s
  }
  return quatNormalize([x, y, z, w])
}

/** OpenGL 约定的透视投影（竖直 fov，度） */
export function perspective(fovDeg: number, aspect: number, near: number, far: number, out: M4 = new Float32Array(16)): M4 {
  const f = 1 / Math.tan((fovDeg * Math.PI) / 360)
  out.fill(0)
  out[0] = f / aspect
  out[5] = f
  out[10] = (far + near) / (near - far)
  out[11] = -1
  out[14] = (2 * far * near) / (near - far)
  return out
}

/** 相机世界矩阵 → OpenGL 视矩阵：diag(1, 1, -1) × 逆矩阵（Unity 左手系转右手视空间） */
export function viewFromCamera(world: ArrayLike<number>, out: M4 = new Float32Array(16)): M4 {
  invert(world, out)
  out[2] = -out[2]
  out[6] = -out[6]
  out[10] = -out[10]
  out[14] = -out[14]
  return out
}

/** sRGB 分量 → 线性 */
export function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}

/**
 * PotRender.UpdatePlanar 的镜像相机世界矩阵：位置关于 y = h 镜像，forward、up 的 y 取反后 LookRotation。
 * 结果是正常旋转（右轴 = −镜像后的右轴），所以画面左右翻转，着色器按 1 − x 取样。
 */
export function mirrorCamera(world: ArrayLike<number>, h: number, out: M4 = new Float32Array(16)): M4 {
  out.set(world)
  out[0] = -world[0]; out[1] = world[1]; out[2] = -world[2]
  out[4] = world[4]; out[5] = -world[5]; out[6] = world[6]
  out[8] = world[8]; out[9] = -world[9]; out[10] = world[10]
  out[12] = world[12]; out[13] = 2 * h - world[13]; out[14] = world[14]
  return out
}

/**
 * Camera.CalculateObliqueMatrix（OpenGL 约定，Lengyel 斜裁剪）：近裁剪面换成视空间平面
 * plane = (a, b, c, d)，正侧（a·x + b·y + c·z + d > 0）可见；相机须在负侧。
 */
export function obliqueProjection(proj: ArrayLike<number>, plane: ArrayLike<number>, out: M4 = new Float32Array(16)): M4 {
  const m = Float32Array.from(proj as ArrayLike<number>)
  const qx = (Math.sign(plane[0]) + m[8]) / m[0]
  const qy = (Math.sign(plane[1]) + m[9]) / m[5]
  const qw = (1 + m[10]) / m[14]
  const k = 2 / (plane[0] * qx + plane[1] * qy - plane[2] + plane[3] * qw)
  m[2] = plane[0] * k
  m[6] = plane[1] * k
  m[10] = plane[2] * k + 1
  m[14] = plane[3] * k
  out.set(m)
  return out
}

/** 世界空间水平面 y = h（法线朝上）在视矩阵 view 下的平面方程 */
export function viewPlaneY(view: ArrayLike<number>, h: number): [number, number, number, number] {
  const nx = view[4], ny = view[5], nz = view[6]
  const l = Math.hypot(nx, ny, nz) || 1
  const px = view[4] * h + view[12], py = view[5] * h + view[13], pz = view[6] * h + view[14]
  const a = nx / l, b = ny / l, c = nz / l
  return [a, b, c, -(a * px + b * py + c * pz)]
}

/** Unity Color.linear（Mathf.GammaToLinearSpace）：分量 ≤ 1 按 sRGB 解码，大于 1 按 2.2 次幂；用于着色器属性缺省值 */
export function hdrToLinear(x: number): number {
  return x <= 0 ? 0 : x <= 1 ? srgbToLinear(x) : Math.pow(x, 2.2)
}

/**
 * PotScene.HdrToLinear：最大分量 m ≤ 1 时逐分量 sRGB 解码；m > 1 时视为“颜色 × 亮度倍数”，
 * 先除以 m 解码再乘回 m（亮度倍数保持线性）。PotRender 的 Lin(Col(...)) 走这里。
 */
export function hdrColorToLinear(r: number, g: number, b: number): V3 {
  const m = Math.max(r, g, b)
  if (m <= 1) return [hdrToLinear(r), hdrToLinear(g), hdrToLinear(b)]
  return [srgbToLinear(Math.max(0, r / m)) * m, srgbToLinear(Math.max(0, g / m)) * m, srgbToLinear(Math.max(0, b / m)) * m]
}
