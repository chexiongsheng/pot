/**
 * 后处理链（移植原版 SALTLINE_POST）：bloom 金字塔、横向光斑、自动曝光与太阳遮挡、镜头污渍与眩光、
 * ACES/AgX 混合色调映射与调色、受伤/低血量/ADS 效果、FXAA + 锐化 + 颗粒。全部是游戏内容，Runner 只提供 ctx.gfx.post。
 * 体积光只移植了太阳光柱（vol.frag，读 Runner 主光阴影图）；SSAO 未移植（仍用 Runner 的 scene.post({ ao })）。
 */
import type { Context, PostChain, Texture } from '@pot/core'

/** 游戏驱动的后处理参数（受伤、低血量、开镜等），按 World 存，atmosphere 的表现每帧写进链 */
const postValues = new WeakMap<object, Record<string, number | number[]>>()

/**
 * 写后处理链的参数（uDamage、uLowHealth、uAds 等）；没有链时忽略。
 * 按 w.registry 存：游戏传进来的 ctx.world 是服务代理，表现钩子拿到的是 World 本体
 */
export function setPostValues(w: { registry: object }, values: Record<string, number | number[]>) {
  const cur = postValues.get(w.registry)
  if (cur) Object.assign(cur, values)
  else postValues.set(w.registry, { ...values })
}

/** 取走待写进链的参数（atmosphere 的表现每帧调；没有新值为 undefined） */
export function takePostValues(w: { registry: object }) {
  const values = postValues.get(w.registry)
  if (values) postValues.delete(w.registry)
  return values
}

/** 原版 TUNE 中与后处理相关的参数 */
export const POST_TUNE = {
  bloom: 0.065,
  bloomMix: 0.62,
  dirt: 0.1,
  streak: 0.03,
  streakThreshold: 2.2,
  flare: 0.16,
  key: 0.12,
  minExposure: 0.6,
  maxExposure: 2,
  adaptTau: 1.5,
  agxMix: 0.25,
  ca: 13e-4,
  vignette: 0.3,
  grain: 0.02,
  sharpen: 0.3,
  vol: 0.12,
  volSigma: 0.02,
  volMaxDist: 120,
  lookPower: 1.18,
  lookSat: 1.22,
}

export interface PostFx {
  chain: PostChain
  /** 每帧调用：曝光平滑速率 */
  update(dt: number): void
  /** 画质：是否开 bloom（含污渍与光斑）、体积光 */
  quality(bloom: boolean, vol?: boolean): void
  /** 游戏驱动的参数：uDamage、uLowHealth、uAds、uFlash、uFade、uSaturation、uThunder、uFlashDir */
  set(values: Record<string, number | number[]>): void
}

export function createPost(ctx: Context, opts: { exposure?: number; sunColor?: string } = {}): PostFx | undefined {
  if (!ctx.gfx.supported) return
  const g = POST_TUNE
  const sh = (name: string) => ctx.gfx.shader({ fragment: `@pot/kit/realistic/shaders/post/${name}.frag`, fullscreen: true })
  const down = sh('down'), up = sh('up'), streak = sh('streak'), adapt = sh('adapt'), grade = sh('grade'), final = sh('final')
  for (const s of [down, up, streak, adapt, grade, final]) if (!s.ok) return
  // 体积光可选：着色器失败时整条链照常工作，只是没有光柱
  const volShader = sh('vol')
  const hasVol = volShader.ok
  const dirtShader = sh('dirt')
  let dirt: Texture | undefined
  if (dirtShader.ok) [dirt] = ctx.gfx.bake(dirtShader, { width: 512, height: 288, targets: [{ format: 'rgba8', mipmaps: false, wrap: 'clamp', filter: 'bilinear' }], uniforms: { uAspect: 16 / 9 } })

  const LEVELS = 6
  const targets: Record<string, any> = {
    sA: { scale: 1 / 8 },
    sB: { scale: 1 / 8 },
    adapt: { width: 1, height: 1, history: true, filter: 'point' },
    ldr: { scale: 1, format: 'rgba8' },
    vol: { scale: 1 / 2 },
  }
  for (let i = 0; i < LEVELS; i++) targets[`d${i}`] = { scale: 1 / 2 ** (i + 1) }
  for (let i = 0; i < LEVELS - 1; i++) targets[`u${i}`] = { scale: 1 / 2 ** (i + 1) }

  const passes: any[] = []
  for (let i = 0; i < LEVELS; i++) passes.push({ shader: down, output: `d${i}`, inputs: { tSrc: i ? `d${i - 1}` : 'scene' }, uniforms: { uFirst: i ? 0 : 1 } })
  // 上采样与光斑标为 'bloom'：画质关 bloom 时直接跳过（降采样链仍要给自动曝光测光，不能关）
  for (let i = LEVELS - 2; i >= 0; i--) passes.push({ name: 'bloom', shader: up, output: `u${i}`, inputs: { tLow: i === LEVELS - 2 ? `d${LEVELS - 1}` : `u${i + 1}`, tHigh: `d${i}` } })
  passes.push({ name: 'bloom', shader: streak, output: 'sA', inputs: { tSrc: 'd2', tAdapt: 'adapt' }, uniforms: { uDirPx: 1.5, uThreshold: g.streakThreshold } })
  passes.push({ name: 'bloom', shader: streak, output: 'sB', inputs: { tSrc: 'sA', tAdapt: 'adapt' }, uniforms: { uDirPx: 5, uThreshold: 0 } })
  passes.push({ shader: adapt, output: 'adapt', inputs: { tPrev: 'adapt', tLum: `d${LEVELS - 1}`, tDepth: 'depth', tAdapt: 'adapt' } })
  if (hasVol) passes.push({ name: 'vol', shader: volShader, output: 'vol', inputs: { tDepth: 'depth', tAdapt: 'adapt' } })
  const gradeInputs: Record<string, string | Texture> = { tScene: 'scene', tBloom: 'u0', tBlur: 'd1', tStreak: 'sB', tDepth: 'depth', tAdapt: 'adapt', tVol: 'vol' }
  if (dirt) gradeInputs.tDirt = dirt
  passes.push({ shader: grade, output: 'ldr', inputs: gradeInputs, uniforms: { uLookPower: g.lookPower, uLookSat: g.lookSat } })
  passes.push({ shader: final, output: 'screen', inputs: { tSrc: 'ldr', tAdapt: 'adapt' } })

  const chain = ctx.gfx.post({
    targets,
    passes,
    uniforms: {
      uExposure: opts.exposure ?? 1, uKey: g.key, uMinE: g.minExposure, uMaxE: g.maxExposure, uAuto: 1,
      uRate: 1, uVisRate: 1, uMix: g.bloomMix,
      uBloom: g.bloom, uDirt: dirt ? g.dirt : 0, uStreak: g.streak, uFlare: g.flare, uCA: g.ca, uVignette: g.vignette, uAgxMix: g.agxMix,
      uSunCol: opts.sunColor ?? '#ffd29a', uFlashDir: [-0.5, 0.5, 0.7],
      uDamage: 0, uLowHealth: 0, uAds: 0, uFlash: 0, uFade: 0, uSaturation: 1, uThunder: 0,
      uGrain: g.grain, uSharpen: g.sharpen, uFxaa: 1,
      uVol: hasVol ? g.vol : 0, uVolSigma: g.volSigma, uVolMaxDist: g.volMaxDist,
    },
  })
  let frames = 0
  return {
    chain,
    update(dt) {
      // 前两帧直接取测光结果，之后按时间常数平滑（原版 adaptTau 1.5 秒，太阳可见度 0.12 秒）
      frames++
      if (frames <= 2) chain.set({ uRate: 1, uVisRate: 1 })
      else chain.set({ uRate: 1 - Math.exp(-dt / g.adaptTau), uVisRate: 1 - Math.exp(-dt / 0.12) })
    },
    quality(bloom, vol = true) {
      // 关 bloom：跳过上采样与光斑（输出目标被清零，grade 读到 0），强度也置零以免污渍、眩光残留
      chain.enable('bloom', bloom)
      chain.set({ uBloom: bloom ? g.bloom : 0, uDirt: bloom && dirt ? g.dirt : 0, uStreak: bloom ? g.streak : 0 })
      if (hasVol) {
        chain.enable('vol', vol)
        chain.set({ uVol: vol ? g.vol : 0 })
      }
    },
    set(values) {
      chain.set(values)
    },
  }
}
