/**
 * 原版雨（pretty.js Fb/Nb + kR/FR/UR/NR）机械移植：
 * - 雨滴：9000·n 条以相机为中心的雨丝（26×15×26 m 循环盒）+ 260 条仓库南檐滴水，HG 相函数逆光发亮
 * - 溅射：900·n 个地面水冠，积水处更密
 * 原版用实例化网格；gfx 没有实例化，这里把每个实例的 4 个角点展开进普通网格，
 * 种子 aSeed 存在法线（xyz）与 uv.x（w）里（颜色会被当作 sRGB 转线性，不能用）。
 * 着色器重算位置，网格包围盒不可信，绑定时关掉视锥剔除（frustumCull:false）。
 */
import type { Context, Entity, Texture } from '@pot/core'

/** 原版 Mn（太阳）与 en.fog（three 坐标、线性） */
const SUN_DIR = (() => { const v = [0.916, 0.225, 0.331]; const l = Math.hypot(v[0], v[1], v[2]); return v.map(x => x / l) })()
const SUN_COL = [1, 0.72, 0.42].map(v => v * 1.9)
const AMB = [0.42, 0.47, 0.52].map(v => v * 0.15)
/** 原版 Li：apron 遮罩覆盖范围 */
const LI = { x0: -44, z0: -40, size: 80 }

function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** 原版 Fb：count 个普通实例 + drips 个滴水实例（aSeed.w = -1），展开为 4 角点四边形 */
function seedQuads(count: number, drips: number, rng: () => number) {
  const n = count + drips
  const positions = new Float32Array(n * 12), normals = new Float32Array(n * 12), uvs = new Float32Array(n * 8)
  const indices = new Uint32Array(n * 6)
  const corners = [-0.5, 0, 0.5, 0, -0.5, 1, 0.5, 1]
  for (let k = 0; k < n; k++) {
    const s = [rng(), rng(), rng(), rng()]
    if (k >= count) s[3] = -1
    for (let c = 0; c < 4; c++) {
      const v = k * 4 + c
      positions.set([corners[c * 2], corners[c * 2 + 1], 0], v * 3)
      normals.set([s[0], s[1], s[2]], v * 3)
      uvs.set([s[3], 0], v * 2)
    }
    // 原版 [0,1,2, 2,1,3]；双面绘制，绕序无关
    const b = k * 4
    indices.set([b, b + 1, b + 2, b + 2, b + 1, b + 3], k * 6)
  }
  return { positions, normals, uvs, indices }
}

export interface Rain {
  /** 目标雨量 0..1（原版每帧以 0.8/s 缓动） */
  setRain(v: number): void
  readonly level: number
  update(dt: number): void
}

export interface RainLevel {
  /** 原版 level.interiorBoxes（three 坐标 Box3） */
  interiorBoxes?: { min: { x: number; y: number; z: number }; max: { x: number; y: number; z: number } }[]
  /** 原版 level.skylights */
  skylights?: { x: number; z: number; w: number; d?: number }[]
}

export function createRain(ctx: Context, opts: { mask: Texture; quality?: number; level?: RainLevel; seed?: number }): Rain | undefined {
  const { scene, gfx } = ctx
  if (!gfx.supported) return undefined
  const rng = mulberry32(opts.seed ?? 9431)
  const n = Math.max(0.15, opts.quality ?? 0.5)
  const drops = Math.round(9000 * n), drips = 260, splashes = Math.round(900 * n)

  // 室内盒子外扩、天窗（原版每帧刷新，这里关卡静态，建一次）
  const boxes = opts.level?.interiorBoxes ?? []
  const boxMin: number[] = [], boxMax: number[] = []
  for (let i = 0; i < 4; i++) {
    const b = boxes[i]
    if (b) {
      boxMin.push(b.min.x - 0.15, b.min.y - 1, b.min.z - 0.15, 0)
      boxMax.push(b.max.x + 0.15, b.max.y + 0.3, b.max.z + 0.15, 0)
    } else { boxMin.push(0, 0, 0, 0); boxMax.push(0, 0, 0, 0) }
  }
  const sky: number[] = []
  const lights = opts.level?.skylights ?? []
  for (let i = 0; i < 8; i++) {
    const s = lights[i]
    if (s && s.w > 0) sky.push(s.x, s.z, s.w * 0.5, (s.d || s.w) * 0.5)
    else sky.push(0, 0, -1, -1)
  }
  const shared = { uSunDir: SUN_DIR, uSunCol: SUN_COL, uAmb: AMB, uBoxMin: boxMin, uBoxMax: boxMax }
  const bind = { queue: 'transparent', blend: 'add', cull: 'none', depthWrite: false, shadows: false, frustumCull: false } as const

  scene.mesh('saltline/rain', seedQuads(drops, drips, rng))
  const rainShader = gfx.shader({ vertex: 'shaders/rain.vert', fragment: 'shaders/rain.frag', name: 'saltline/rain' })
  const rainEnt: Entity = scene.spawn({ shape: 'mesh:saltline/rain', name: 'rain', position: [0, 0, 0], collider: false })
    .shader(rainShader, { ...bind, uniforms: { ...shared, uSky: sky, uRain: 0.6, uDrip: boxes.length ? 1 : 0, uVel: [-2.6, -9.4, 1.1], uBox: [26, 15, 26] } })

  scene.mesh('saltline/rain-splash', seedQuads(splashes, 0, rng))
  const splashShader = gfx.shader({ vertex: 'shaders/splash.vert', fragment: 'shaders/splash.frag', name: 'saltline/rain-splash' })
  const splashEnt: Entity = scene.spawn({ shape: 'mesh:saltline/rain-splash', name: 'rain-splash', position: [0, 0, 0], collider: false })
    .shader(splashShader, { ...bind, uniforms: { ...shared, uRain: 0.6, uMask: opts.mask, uMaskRect: [LI.x0, LI.z0, 1 / LI.size] } })

  let level = 0.6, target = 0.6, visible = true
  return {
    setRain(v) { target = Math.min(1, Math.max(0, v)) },
    get level() { return level },
    update(dt) {
      if (Math.abs(target - level) < 1e-4) return
      level += (target - level) * Math.min(1, dt * 0.8)
      rainEnt.uniforms({ uRain: level })
      splashEnt.uniforms({ uRain: level })
      const vis = level > 0.01
      if (vis !== visible) { visible = vis; rainEnt.active(vis); splashEnt.active(vis) }
    },
  }
}
