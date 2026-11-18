/**
 * 材质库：机械移植原版 Gg/c3/l1（程序化 PBR 贴图组 + 命名材质）。
 * 原版在 three.js 里用全屏 RawShaderMaterial 把 e3+Tn[fn]+t3 画到 3 目标 MRT，再 copy/法线 pass 得到 albedo/orm/normal，
 * 由 onBeforeCompile 补丁按 SL_TINT 合成颜色。这里同样在 GPU 上烘焙（ctx.gfx.bake），
 * 并把 SL_TINT 合成与 orm→PotLit 遮罩换算挪到一个游戏侧合成 pass，结果直接交给内置 PotLit 材质。
 *
 * 未移植（Runner 能力缺口，见 docs）：SL_FX 宏观亮度/粗糙度变化、雨天条纹与水珠、SL_ACUT 远距离抖动镂空。
 */
import type { Context, MaterialOptions, Texture } from '@pot/core'
import { COPY, HEADER, MAIN, NORMAL, SURF } from './sl-shaders'

void COPY // 原版的 copy pass 在合成 pass 里一并完成（同分辨率点采样，结果等价）

interface SetDef { fn: string; size: number; tile: number | [number, number]; bump: number; hero?: boolean; p?: number[]; seed?: number }

/** 原版 c3：贴图组 */
export const SETS: Record<string, SetDef> = {
  asphalt: { fn: 'asphalt', size: 1, tile: 2, bump: 1.6, hero: true },
  concrete: { fn: 'concrete', size: 1, tile: 3, bump: 2.5 },
  brick: { fn: 'brick', size: 0.5, tile: 1.8, bump: 6 },
  epoxy: { fn: 'epoxy', size: 0.5, tile: 4, bump: 3 },
  paint: { fn: 'paint', size: 1, tile: 2.5, bump: 2.5, p: [0.5] },
  hull: { fn: 'hull', size: 0.5, tile: 4, bump: 12 },
  galv: { fn: 'galv', size: 0.5, tile: 1, bump: 0.8 },
  metal: { fn: 'metal', size: 0.5, tile: 1, bump: 0.5, p: [1] },
  brushed: { fn: 'brushed', size: 0.5, tile: 0.5, bump: 0.4 },
  rust: { fn: 'rust', size: 0.5, tile: 1.2, bump: 3 },
  diamond: { fn: 'diamond', size: 0.5, tile: 0.5, bump: 2 },
  corrugated: { fn: 'corrugated', size: 0.5, tile: [0.762, 2.286], bump: 19 },
  chainlink: { fn: 'chainlink', size: 0.5, tile: 0.5, bump: 5 },
  hazard: { fn: 'hazard', size: 0.5, tile: 1, bump: 2.5 },
  gunmetal: { fn: 'gunmetal', size: 0.5, tile: 0.25, bump: 0.3, p: [0.6] },
  anodized: { fn: 'gunmetal', size: 0.5, tile: 0.25, bump: 0.25, p: [0.2], seed: 11 },
  polymer: { fn: 'polymer', size: 0.25, tile: 0.1, bump: 0.4 },
  carbon: { fn: 'carbon', size: 0.25, tile: 0.05, bump: 0.5 },
  fabric: { fn: 'fabric', size: 0.25, tile: 0.05, bump: 0.4 },
  armor: { fn: 'armor', size: 0.5, tile: 0.5, bump: 0.8 },
  wood: { fn: 'wood', size: 0.5, tile: 1.2, bump: 2.6 },
  plastic: { fn: 'plastic', size: 0.5, tile: 1, bump: 1 },
  tarp: { fn: 'tarp', size: 0.5, tile: 1.5, bump: 20 },
  cardboard: { fn: 'cardboard', size: 0.5, tile: 1, bump: 0.8 },
  rope: { fn: 'rope', size: 0.25, tile: 0.1, bump: 4 },
  tire: { fn: 'tire', size: 0.5, tile: [0.5, 0.3], bump: 7 },
  glass: { fn: 'glass', size: 0.5, tile: 1.5, bump: 1.5, p: [0.3] },
  glass_dirty: { fn: 'glass', size: 0.5, tile: 1.5, bump: 1.5, p: [1], seed: 40 },
  water: { fn: 'water', size: 0.25, tile: 4, bump: 30 },
}

type V4 = [number, number, number, number]
interface MatDef { set: string; tint: 0 | 1 | 2 | 3; color: number; rough: number; metal: number; wet: V4; macro: V4; nrm: number; transparent?: boolean; alphaCut?: boolean; side?: number }

const cA: V4 = [0.42, 0.38, 0.5, 0], kc: V4 = [0.05, 0.62, 0.65, 0.7], aa: V4 = [0, 0.7, 0.55, 0.5], uA: V4 = [0.3, 0.6, 0.55, 0]
const i1: V4 = [0.08, 0.62, 0.6, 0.5], u3: V4 = [0.4, 0.5, 0.6, 0], s1: V4 = [0, 1, 0, 0], o1: V4 = [0.22, 0.12, 0.35, 0.35]
const hA: V4 = [0.14, 0.1, 0.8, 0.2], r1: V4 = [0.07, 0.06, 3, 0], a1: V4 = [0, 0, 1, 0]
const Nt = (set: string, e: Partial<MatDef> = {}): MatDef => ({ set, tint: 0, color: 0xffffff, rough: 1, metal: 1, wet: cA, macro: hA, nrm: 1, ...e })
const Xa = (color: number) => Nt('paint', { tint: 1, color, wet: kc, macro: [0.2, 0.16, 0.4, 0.45] })

/** 原版 l1：命名材质 */
export const MATS: Record<string, MatDef> = {
  asphalt: Nt('asphalt', { wet: [0.45, 0.3, 0.5, 0], macro: o1 }),
  concrete: Nt('concrete', { macro: o1 }),
  concrete_dirty: Nt('concrete', { color: 13616822, macro: [0.3, 0.15, 0.35, 0.9] }),
  concrete_painted: Nt('concrete', { tint: 2, color: 9343638, rough: 0.9, wet: [0.15, 0.55, 0.6, 0.3], macro: [0.14, 0.1, 0.5, 0.3] }),
  brick: Nt('brick'),
  floor_epoxy: Nt('epoxy', { wet: [0.04, 0.75, 0.4, 0], macro: [0.12, 0.2, 0.45, 0.25] }),
  paint_red: Xa(8200729), paint_blue: Xa(2047846), paint_green: Xa(2906692), paint_yellow: Xa(12159516),
  paint_orange: Xa(11751962), paint_white: Xa(12172214), paint_grey: Xa(5922920), paint_teal: Xa(2055523),
  steel_galv: Nt('galv', { wet: aa }),
  steel_dark: Nt('metal', { tint: 1, color: 4014406, rough: 1.15, wet: aa }),
  steel_worn: Nt('metal', { tint: 1, color: 9080466, rough: 0.9, wet: aa }),
  steel_bare: Nt('brushed', { tint: 1, color: 11843771, wet: aa, macro: r1 }),
  steel_rust: Nt('rust', { wet: uA }),
  diamond_plate: Nt('diamond', { wet: aa }),
  corrugated_roof: Nt('corrugated', { wet: aa }),
  chainlink: Nt('chainlink', { tint: 3, alphaCut: true, side: 2, wet: s1, macro: a1 }),
  aluminium: Nt('brushed', { tint: 1, color: 12896459, rough: 1.15, wet: aa, macro: r1 }),
  brass: Nt('brushed', { tint: 1, color: 12753477, rough: 0.9, wet: aa, macro: [0.1, 0.08, 20, 0] }),
  hazard_stripes: Nt('hazard', { wet: kc }),
  gunmetal: Nt('gunmetal', { tint: 1, color: 2764081, wet: [0, 0.75, 0.6, 0.5], macro: [0.08, 0.06, 6, 0] }),
  anodized_black: Nt('anodized', { tint: 1, color: 1184790, rough: 0.72, metal: 0.9, wet: [0, 0.75, 0.6, 0.5], macro: [0.06, 0.05, 6, 0] }),
  polymer_black: Nt('polymer', { tint: 1, color: 1513498, wet: [0, 0.7, 0.6, 0.5], macro: [0.06, 0.06, 6, 0] }),
  polymer_tan: Nt('polymer', { tint: 1, color: 7299144, wet: [0, 0.7, 0.6, 0.5], macro: [0.06, 0.06, 6, 0] }),
  rubber: Nt('polymer', { tint: 1, color: 1052688, rough: 1.4, wet: [0.05, 0.6, 0.6, 0.4], macro: [0.06, 0.06, 6, 0] }),
  carbon: Nt('carbon', { wet: [0, 0.8, 0.6, 0.5], macro: [0.05, 0.05, 6, 0] }),
  glove_fabric: Nt('fabric', { tint: 1, color: 2303530, wet: [0.3, 0.7, 0.6, 0], macro: [0.08, 0.04, 8, 0] }),
  armor_white: Nt('armor', { tint: 1, color: 11449528, wet: kc, macro: [0.08, 0.08, 2.5, 0.15] }),
  armor_orange: Nt('armor', { tint: 1, color: 12670234, wet: kc, macro: [0.08, 0.08, 2.5, 0.15] }),
  wood_pallet: Nt('wood', { wet: u3, macro: [0.2, 0.1, 0.9, 0.4] }),
  wood_dark: Nt('wood', { color: 9074794, wet: u3, macro: [0.2, 0.1, 0.9, 0.4] }),
  plastic_blue: Nt('plastic', { tint: 1, color: 1920134, wet: i1 }),
  plastic_red: Nt('plastic', { tint: 1, color: 9314074, wet: i1 }),
  plastic_grey: Nt('plastic', { tint: 1, color: 4935508, wet: i1 }),
  tarp: Nt('tarp', { tint: 1, color: 3885626, wet: i1, macro: [0.1, 0.1, 1.2, 0.2] }),
  cardboard: Nt('cardboard', { wet: [0.4, 0.75, 0.6, 0] }),
  rope: Nt('rope', { macro: r1 }),
  tire: Nt('tire', { wet: [0.1, 0.6, 0.6, 0.3], macro: r1 }),
  glass: Nt('glass', { tint: 3, transparent: true, wet: s1, macro: a1 }),
  glass_dirty: Nt('glass_dirty', { tint: 3, transparent: true, wet: s1, macro: a1 }),
  hull_paint: Nt('hull', { tint: 1, color: 1778219, wet: kc, macro: o1 }),
  hull_red: Nt('hull', { tint: 1, color: 6233880, wet: kc, macro: o1 }),
  water_dark: Nt('water', { wet: s1, macro: a1 }),
}
/** 原版 fA：未知材质的回退 */
const FALLBACK = Nt('metal', { tint: 1, color: 8027520, wet: aa })

/**
 * 合成 pass（游戏侧，替代原版 h3 补丁里的 SL_TINT 分支与 roughness/metalness/ao 取值）：
 * 输入原版 MRT 的三个目标，输出 PotLit 用的 albedo（sRGB）与遮罩（R 金属度 G AO B 高度 A 光滑度）
 */
const COMPOSE = `
uniform sampler2D t0; uniform sampler2D t1; uniform sampler2D t2;
uniform vec3 uColor; uniform float uTint; uniform float uRough; uniform float uMetal;
in vec2 vUv;
layout(location = 0) out vec4 oA; layout(location = 1) out vec4 oM;
void main(){
  vec4 a = texture(t0, vUv); vec3 rgb = a.rgb * a.rgb;
  vec4 orm = texture(t1, vUv); vec4 h = texture(t2, vUv);
  vec4 c;
  if (uTint < 0.5) c = vec4(rgb * uColor, 1.0);
  else if (uTint < 1.5) c = vec4(rgb + uColor * a.a, 1.0);
  else if (uTint < 2.5) { float l = clamp(dot(rgb, vec3(0.3333)) / 0.19, 0.55, 1.35); c = vec4(mix(rgb, uColor * l, a.a * 0.96), 1.0); }
  else c = vec4(rgb * uColor, a.a);
  oA = c;
  float rough = clamp(uRough * orm.g, 0.045, 1.0);
  oM = vec4(clamp(uMetal * orm.b, 0.0, 1.0), orm.r, h.r + h.g / 255.0, 1.0 - rough);
}`

export interface MatGetOptions {
  /** 覆盖材质颜色（0xRRGGBB 或 '#rrggbb'） */
  color?: number | string
  /** 三平面投影（原版 triplanar）；否则用网格 UV（world.ts 的方块用 object/world 三平面） */
  uv?: 'mesh' | 'world' | 'object'
  /** 三平面时的额外缩放（原版 scale） */
  scale?: number
  doubleSide?: boolean
  /** 室内：几乎不受雨淋（原版 uSlX.x = 0.12） */
  interior?: boolean
}

export interface Mat {
  /** 交给 spawn 的颜色（已烘进贴图，恒为白） */
  color: string
  material: MaterialOptions
  /** 原版 tile（米） */
  tile: [number, number]
}

const hexNum = (c: number | string) => (typeof c === 'number' ? c : parseInt(c.replace('#', '').slice(0, 6), 16))
/** three.js ColorManagement：十六进制按 sRGB 解释，转线性 */
const toLinear = (v: number) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4))
const linearRgb = (n: number): [number, number, number] => [toLinear((n >> 16 & 255) / 255), toLinear((n >> 8 & 255) / 255), toLinear((n & 255) / 255)]

export function createMats(ctx: Context, quality: { tex?: number } = {}) {
  const gfx = ctx.gfx
  const n = quality.tex ?? 1024
  const s = Math.min(n, 1024)
  const sizeOf = (d: SetDef) => Math.max(32, d.hero && n >= 2048 ? 2048 : Math.round(s * d.size))

  const programs = new Map<string, string>()
  const program = (key: string, source: string) => {
    let name = programs.get(key)
    if (!name) {
      const sh = gfx.shader({ fullscreen: true, fragmentSource: source, name: `jimao/${key}` })
      if (sh.error) throw new Error(`材质着色器 ${key} 编译失败`)
      name = sh.name
      programs.set(key, name)
    }
    return name
  }

  interface Baked { raw: Texture[]; normal: Texture; size: number; tile: [number, number] }
  const sets = new Map<string, Baked>()
  const bakeSet = (key: string): Baked => {
    let b = sets.get(key)
    if (b) return b
    const d = SETS[key]
    const D = sizeOf(d)
    const tile: [number, number] = Array.isArray(d.tile) ? d.tile : [d.tile, d.tile]
    const p = d.p ?? []
    const raw = gfx.bake(program(`surf/${d.fn}`, HEADER + SURF[d.fn] + MAIN), {
      width: D,
      targets: [0, 1, 2].map(() => ({ format: 'rgba8' as const, mipmaps: false, filter: 'point' as const, wrap: 'repeat' as const })),
      uniforms: { uP: [p[0] ?? 0, p[1] ?? 0, p[2] ?? 0, p[3] ?? 0], uSeed: d.seed ?? 0, uTexel: 1 / D },
    })
    const [normal] = gfx.bake(program('normal', NORMAL), {
      width: D,
      targets: [{ format: 'rgba8', wrap: 'repeat', filter: 'trilinear' }],
      uniforms: { tH: raw[2], uTexel: 1 / D, uK: [d.bump * 1e-3 * D / tile[0], d.bump * 1e-3 * D / tile[1]] },
    })
    b = { raw, normal, size: D, tile }
    sets.set(key, b)
    return b
  }

  const composed = new Map<string, { map: Texture; maskMap: Texture }>()
  const compose = (def: MatDef, color: number) => {
    const key = `${def.set}|${def.tint}|${color}|${def.rough}|${def.metal}`
    let c = composed.get(key)
    if (c) return c
    const set = bakeSet(def.set)
    const [map, maskMap] = gfx.bake(program('compose', COMPOSE), {
      width: set.size,
      targets: [{ format: 'srgb', wrap: 'repeat', filter: 'trilinear' }, { format: 'rgba8', wrap: 'repeat', filter: 'trilinear' }],
      uniforms: { t0: set.raw[0], t1: set.raw[1], t2: set.raw[2], uColor: linearRgb(color), uTint: def.tint, uRough: def.rough, uMetal: def.metal },
    })
    c = { map, maskMap }
    composed.set(key, c)
    return c
  }

  const warned = new Set<string>()
  /** 原版 mats.get */
  function get(name: string, o: MatGetOptions = {}): Mat {
    let def = MATS[name]
    if (!def) {
      if (!warned.has(name)) {
        warned.add(name)
        ctx.logger('mats').warn('未知材质 "%s"，使用回退', name)
      }
      def = FALLBACK
    }
    const color = o.color !== undefined ? hexNum(o.color) : def.color
    const set = bakeSet(def.set)
    const tex = compose(def, color)
    const k = o.scale ?? 1
    const mode = def.transparent ? 'lit-fade' : def.alphaCut ? 'lit-cutout' : o.doubleSide || def.side === 2 ? 'lit-twosided' : 'lit'
    const material: MaterialOptions = {
      mode,
      map: tex.map,
      normalMap: set.normal,
      maskMap: tex.maskMap,
      metallic: 1,
      smoothness: 1,
      normalScale: def.nrm,
      occlusion: 1,
      uv: o.uv ?? 'mesh',
      tiling: [k / set.tile[0], k / set.tile[1]],
      wet: (def.wet[2] > 0 ? 1 : 0) * (o.interior ? 0.12 : 1),
    }
    if (def.alphaCut) material.cutoff = 0.5
    return { color: '#ffffff', material, tile: set.tile }
  }

  return {
    get,
    names: Object.keys(MATS),
    /** 预先烘焙（原版 prewarm） */
    prewarm(names: string[] = Object.keys(MATS)) {
      for (const nm of names) get(nm)
    },
    stats() {
      return { sets: sets.size, composed: composed.size }
    },
  }
}

export type Mats = ReturnType<typeof createMats>
