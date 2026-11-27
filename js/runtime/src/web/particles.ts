/**
 * 粒子迸发（004 第 20.2 节 web-3）：照 PotRender.Burst 与 PotRender.Particles。
 * 每种 kind 一个粒子池（spark 火花 / glow 光点 / smoke 烟尘），上限各 4000，世界空间模拟，满了丢弃新粒子（ParticleSystem.Emit 同）。
 * 颜色：sRGB 转线性后除以 max(1, 最大分量)，alpha 保留；顶点色即线性值，乘生命周期渐变（渐变键原样相乘，同 Unity 顶点色）。
 * spark 的世界碰撞用射线近似（bounce 0.3、dampen 0.5、lifetimeLoss 0.2）；smoke 的速度阻尼 0.08 按 30 帧每秒换算成与帧率无关。
 * 本文件不碰 WebGL：gl.ts 每帧读取 pools 画四边形。
 */
import type { RaycastResult } from '../host'
import { hdrToLinear } from './math'

export type ParticleKind = 'spark' | 'glow' | 'smoke'

export const PARTICLE_KINDS: ParticleKind[] = ['smoke', 'spark', 'glow']
export const MAX_PARTICLES = 4000
const GRAVITY = -9.81

export interface KindStyle {
  gravity: number
  /** 混合：add 为 (SrcAlpha, One)，alpha 为 (SrcAlpha, OneMinusSrcAlpha) */
  blend: 'add' | 'alpha'
  /** PotUnlit 的 _FogMode：1 混向雾色，2 乘透过率 */
  fog: number
  /** 沿速度拉伸（ParticleSystemRenderMode.Stretch，velocityScale） */
  stretch: number
  collide: boolean
  /** limitVelocityOverLifetime.dampen（limit 0） */
  dampen: number
}

export const KIND_STYLES: Record<ParticleKind, KindStyle> = {
  spark: { gravity: 1, blend: 'add', fog: 2, stretch: 0.035, collide: true, dampen: 0 },
  glow: { gravity: 0, blend: 'add', fog: 2, stretch: 0, collide: false, dampen: 0 },
  smoke: { gravity: -0.04, blend: 'alpha', fog: 1, stretch: 0, collide: false, dampen: 0.08 },
}

/** 生命周期曲线：t 为 age/life（0 到 1），写入 out = [r, g, b, a, sizeMul] */
export function kindCurve(kind: ParticleKind, t: number, out: number[]): number[] {
  t = t < 0 ? 0 : t > 1 ? 1 : t
  switch (kind) {
    case 'smoke':
      out[0] = 1; out[1] = 1; out[2] = 1
      out[3] = t < 0.12 ? t / 0.12 : 1 - (t - 0.12) / 0.88
      out[4] = 0.5 + 1.1 * t
      break
    case 'glow':
      out[0] = 1; out[1] = 1; out[2] = 1
      out[3] = 1 - t
      out[4] = 1 - 0.7 * t
      break
    default:
      out[0] = 1; out[1] = 1 - 0.45 * t; out[2] = 1 - 0.7 * t
      out[3] = t < 0.5 ? 1 : 1 - (t - 0.5) / 0.5
      out[4] = 1
  }
  return out
}

export class ParticlePool {
  readonly kind: ParticleKind
  readonly style: KindStyle
  count = 0
  readonly pos = new Float32Array(MAX_PARTICLES * 3)
  readonly vel = new Float32Array(MAX_PARTICLES * 3)
  /** 起始颜色（线性 rgb + alpha） */
  readonly color = new Float32Array(MAX_PARTICLES * 4)
  readonly size = new Float32Array(MAX_PARTICLES)
  readonly age = new Float32Array(MAX_PARTICLES)
  readonly life = new Float32Array(MAX_PARTICLES)

  constructor(kind: ParticleKind) {
    this.kind = kind
    this.style = KIND_STYLES[kind]
  }

  /** 删除第 i 个（末尾挪过来） */
  remove(i: number): void {
    const j = --this.count
    if (i === j) return
    this.pos.copyWithin(i * 3, j * 3, j * 3 + 3)
    this.vel.copyWithin(i * 3, j * 3, j * 3 + 3)
    this.color.copyWithin(i * 4, j * 4, j * 4 + 4)
    this.size[i] = this.size[j]
    this.age[i] = this.age[j]
    this.life[i] = this.life[j]
  }
}

export type ParticleRaycast = (ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, maxDistance: number) => RaycastResult | null

interface BurstCfg {
  kind: string
  pos: number[]
  dir: number[]
  color: number[]
  count: number
  speed: number
  speedJitter: number
  spread: number
  size: number
  sizeJitter: number
  life: number
  lifeJitter: number
}

function num(v: unknown, d: number): number {
  return typeof v === 'number' && isFinite(v) ? v : d
}

export class WebParticles {
  readonly pools = new Map<ParticleKind, ParticlePool>()
  rand: () => number
  raycast: ParticleRaycast | null

  constructor(raycast: ParticleRaycast | null = null, rand: () => number = Math.random) {
    this.raycast = raycast
    this.rand = rand
  }

  pool(kind: ParticleKind): ParticlePool {
    let p = this.pools.get(kind)
    if (!p) {
      p = new ParticlePool(kind)
      this.pools.set(kind, p)
    }
    return p
  }

  /** 当前存活粒子总数 */
  get alive(): number {
    let n = 0
    for (const p of this.pools.values()) n += p.count
    return n
  }

  /** Unity Random.onUnitSphere */
  private onUnitSphere(): [number, number, number] {
    const z = this.rand() * 2 - 1
    const a = this.rand() * Math.PI * 2
    const r = Math.sqrt(Math.max(0, 1 - z * z))
    return [r * Math.cos(a), r * Math.sin(a), z]
  }

  /** 粒子迸发：JSON 局部覆盖 BurstCfg 缺省值；没有 pos 时忽略 */
  burst(json: string): void {
    let raw: any
    try {
      raw = JSON.parse(json)
    } catch {
      return
    }
    if (!raw || typeof raw !== 'object') return
    const cfg: BurstCfg = {
      kind: typeof raw.kind === 'string' && raw.kind ? raw.kind : 'spark',
      pos: Array.isArray(raw.pos) ? raw.pos : [],
      dir: Array.isArray(raw.dir) ? raw.dir : [],
      color: Array.isArray(raw.color) ? raw.color : [],
      count: num(raw.count, 8),
      speed: num(raw.speed, 4),
      speedJitter: num(raw.speedJitter, 0.5),
      spread: num(raw.spread, 0.5),
      size: num(raw.size, 0.05),
      sizeJitter: num(raw.sizeJitter, 0.5),
      life: num(raw.life, 0.4),
      lifeJitter: num(raw.lifeJitter, 0.3),
    }
    if (cfg.pos.length < 3) return
    // 不认识的 kind 走 spark 外观（PotRender.Particles 的 default 分支）
    const kind: ParticleKind = cfg.kind === 'glow' || cfg.kind === 'smoke' ? cfg.kind : 'spark'
    const pool = this.pool(kind)
    let dx = 0, dy = 1, dz = 0
    if (cfg.dir.length >= 3) {
      dx = +cfg.dir[0] || 0; dy = +cfg.dir[1] || 0; dz = +cfg.dir[2] || 0
      const l2 = dx * dx + dy * dy + dz * dz
      if (l2 < 1e-6) { dx = 0; dy = 1; dz = 0 }
      else { const l = Math.sqrt(l2); dx /= l; dy /= l; dz /= l }
    }
    const c = cfg.color.length >= 3 ? [+cfg.color[0] || 0, +cfg.color[1] || 0, +cfg.color[2] || 0, cfg.color.length > 3 ? +cfg.color[3] : 1] : [1, 1, 1, 1]
    const lr = hdrToLinear(c[0]), lg = hdrToLinear(c[1]), lb = hdrToLinear(c[2])
    const m = Math.max(1, lr, lg, lb)
    const count = Math.max(1, Math.min(500, Math.trunc(cfg.count)))
    const spread = Math.max(0, Math.min(1, cfg.spread))
    for (let n = 0; n < count; n++) {
      const r = this.onUnitSphere()
      let v = slerp(dx, dy, dz, r[0], r[1], r[2], spread)
      const d = v[0] * dx + v[1] * dy + v[2] * dz
      if (d < 0 && cfg.spread < 1) v = [v[0] - 2 * d * dx, v[1] - 2 * d * dy, v[2] - 2 * d * dz]
      const vl = Math.hypot(v[0], v[1], v[2]) || 1
      const speed = cfg.speed * (1 + (this.rand() * 2 - 1) * cfg.speedJitter)
      const size = cfg.size * (1 + (this.rand() * 2 - 1) * cfg.sizeJitter)
      const life = Math.max(0.02, cfg.life * (1 + (this.rand() * 2 - 1) * cfg.lifeJitter))
      this.rand() // rotation：圆点贴图旋转对称，只消耗随机数保持序列
      if (pool.count >= MAX_PARTICLES) continue
      const i = pool.count++
      pool.pos[i * 3] = +cfg.pos[0] || 0
      pool.pos[i * 3 + 1] = +cfg.pos[1] || 0
      pool.pos[i * 3 + 2] = +cfg.pos[2] || 0
      pool.vel[i * 3] = (v[0] / vl) * speed
      pool.vel[i * 3 + 1] = (v[1] / vl) * speed
      pool.vel[i * 3 + 2] = (v[2] / vl) * speed
      pool.color[i * 4] = lr / m
      pool.color[i * 4 + 1] = lg / m
      pool.color[i * 4 + 2] = lb / m
      pool.color[i * 4 + 3] = c[3]
      pool.size[i] = size
      pool.age[i] = 0
      pool.life[i] = life
    }
  }

  /** 推进 dt 秒：重力、阻尼、碰撞、寿命 */
  update(dt: number): void {
    if (!(dt > 0)) return
    for (const pool of this.pools.values()) {
      const st = pool.style
      const g = GRAVITY * st.gravity * dt
      const damp = st.dampen > 0 ? Math.pow(1 - st.dampen, dt * 30) : 1
      const P = pool.pos, V = pool.vel
      for (let i = pool.count - 1; i >= 0; i--) {
        pool.age[i] += dt
        if (pool.age[i] >= pool.life[i]) {
          pool.remove(i)
          continue
        }
        const k = i * 3
        V[k + 1] += g
        if (damp !== 1) {
          V[k] *= damp; V[k + 1] *= damp; V[k + 2] *= damp
        }
        let mx = V[k] * dt, my = V[k + 1] * dt, mz = V[k + 2] * dt
        if (st.collide && this.raycast) {
          const len = Math.hypot(mx, my, mz)
          const hit = len > 1e-6 ? this.raycast(P[k], P[k + 1], P[k + 2], mx, my, mz, len) : null
          if (hit) {
            const [nx, ny, nz] = hit.normal
            const vn = V[k] * nx + V[k + 1] * ny + V[k + 2] * nz
            if (vn < 0) {
              // 法向分量反弹并乘 bounce 0.3，整体乘 (1 − dampen 0.5)，寿命扣起始寿命的 0.2
              const f = 1 + 0.3
              V[k] = (V[k] - f * vn * nx) * 0.5
              V[k + 1] = (V[k + 1] - f * vn * ny) * 0.5
              V[k + 2] = (V[k + 2] - f * vn * nz) * 0.5
              pool.age[i] += pool.life[i] * 0.2
              P[k] = hit.point[0] + nx * 1e-3
              P[k + 1] = hit.point[1] + ny * 1e-3
              P[k + 2] = hit.point[2] + nz * 1e-3
              mx = my = mz = 0
            }
          }
        }
        P[k] += mx; P[k + 1] += my; P[k + 2] += mz
      }
    }
  }

  clear(): void {
    for (const p of this.pools.values()) p.count = 0
  }
}

/** Unity Vector3.Slerp（两个单位向量） */
function slerp(ax: number, ay: number, az: number, bx: number, by: number, bz: number, t: number): [number, number, number] {
  const d = Math.max(-1, Math.min(1, ax * bx + ay * by + az * bz))
  const theta = Math.acos(d)
  if (theta < 1e-5) return [ax + (bx - ax) * t, ay + (by - ay) * t, az + (bz - az) * t]
  const s = Math.sin(theta)
  if (s < 1e-5) {
    // 反向：绕任一垂直轴转 t·π
    let px = -ay, py = ax, pz = 0
    if (px * px + py * py < 1e-6) { px = 0; py = -az; pz = ay }
    const pl = Math.hypot(px, py, pz)
    px /= pl; py /= pl; pz /= pl
    const a = t * Math.PI
    return [ax * Math.cos(a) + px * Math.sin(a), ay * Math.cos(a) + py * Math.sin(a), az * Math.cos(a) + pz * Math.sin(a)]
  }
  const wa = Math.sin((1 - t) * theta) / s
  const wb = Math.sin(t * theta) / s
  return [ax * wa + bx * wb, ay * wa + by * wb, az * wa + bz * wb]
}
