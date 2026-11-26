/**
 * viewGun（004 第 19.5 节第 7 步）：第一人称枪的样子。只有 view，按结构读同一实体的 gunFps、moveFps、cameraFps、health，
 * 按计数驱动表现：枪模（PAC-9 各部件与湿润材质）、双手与换弹动作、镜片与红点、枪口火焰与火光、曳光、弹簧姿态、
 * 命中特效（弹孔、碎屑、水花、敌人光点）与枪声。逐项取自 saltline 原来的 weapon.ts。
 *
 * 资源分两层：材质、着色器、贴图、网格注册、手的几何、弹孔池与粒子池按 World 缓存（WeakMap，不进存档）；
 * 场景对象按实体建，enter 不返回（挂在相机下，变换自己管），exit 倒序销毁。场景相关的查询由游戏用 setGunEnv 注入。
 */
import { defineBlock } from '@pot/core'
import type { Context, Entity, MaterialOptions, StandardMaterial, Vec3 } from '@pot/core'
import type { GunFpsProps, GunFpsState, GunShot, MoveFpsProps, MoveFpsState } from '@pot/kit/fps'
import { createPac9Materials, wetness } from './pac9-mats'
import { createDecals, decalFor } from './decals'
import { createFx } from './fx'
import { linearColor, toMesh, type RGB } from './geo'
import { buildPac9, PAC9 } from './gun'
import { buildHands, LABEL_TEXT, LABELS, markingQuads, sampleTrack, smoother, toUnityEuler, toUnityPos } from './hands'
import { LEVEL_LAYER, VIEW_LAYER } from './layers'
import { clamp, damp, lerp, norm, sub } from './math'
import { registerSfx, sfx } from './sfx'
import * as Tex from './textures'
import { Quaternion, Vector3 } from './vendor/three-geo'

// ---------------------------------------------------------------- 场景注入

/** 场景相关的查询：命中点的表面种类（金属、木头、混凝土、水等），相机处的雨淋程度（0 到 1，1 为露天） */
export interface GunEnv {
  surface(point: Vec3, normal: Vec3, tag?: string): string
  shelter(camPos: Vec3): number
}

const DEFAULT_ENV: GunEnv = {
  surface: (_p, _n, tag) => (tag === 'water' ? 'water' : 'concrete'),
  shelter: () => 1,
}
const envs = new WeakMap<object, GunEnv>()

/**
 * 由游戏在 load 里设置；没设或传 null 时用缺省（tag 为 water 是水，其余混凝土；处处露天）。
 * 按 w.registry 存：游戏传进来的 ctx.world 是服务代理，表现钩子拿到的是 World 本体，二者不是同一对象
 */
export function setGunEnv(w: { registry: object }, env: Partial<GunEnv> | null) {
  envs.set(w.registry, { ...DEFAULT_ENV, ...(env ?? {}) })
}

// ---------------------------------------------------------------- 常量

// 枪身姿态（原版 eu 腰射 / qv 瞄准 / tu 冲刺 / nu 换弹；Three.js 坐标，-Z 为前，旋转为弧度 YXZ）
const EU = { p: [0.118, -0.122, -0.275], r: [0.034, 0.085, -0.03] }
const QV = { p: [0, -PAC9.sightY, -0.135], r: [0, 0, 0] }
const TU = { p: [-0.035, 4e-3, 0.03], r: [-0.04, 0.62, 0.26] }
const NU = { p: [-0.03, 0.1, -0.02], r: [0.46, 0.22, -0.8] }
/** 原版枪模用独立相机渲染（固定 54°），这里把枪模父节点按 XY 用 tan(fov/2)/tan(54°/2) 缩放，屏幕投影与原版一致 */
const VIEW_FOV = 54
const DEG = 180 / Math.PI
const u = (p: readonly number[]): Vec3 => [p[0], p[1], -p[2]]
/** Three.js 欧拉角（弧度，YXZ）→ Unity 本地欧拉角（度）：Z 镜像，x、y 取反 */
const euler = (x: number, y: number, z: number): Vec3 => [-x * DEG, -y * DEG, z * DEG]
const MAG = u(PAC9.magPos)

/**
 * 原版 N_：第一人称枪口火焰的面片（three 坐标，枪口朝 -Z）。原版的 aType 属性编码进 uv.y（+ aType·2），
 * 由 shaders/muzzle.frag 解出。Z 翻成 Unity 坐标；双面渲染，绕序无所谓。
 */
function muzzleFlashMesh() {
  const pos: number[] = [], uv: number[] = [], idx: number[] = []
  const s = (d: number[], v: number[], g: number[], x: number[], y: number) => {
    const b = pos.length / 3
    for (const m of [d, v, g, x]) pos.push(m[0], m[1], -m[2])
    uv.push(0, y * 2, 1, y * 2, 1, 1 + y * 2, 0, 1 + y * 2)
    idx.push(b, b + 1, b + 2, b, b + 2, b + 3)
  }
  s([-0.13, -0.13, -0.03], [0.13, -0.13, -0.03], [0.13, 0.13, -0.03], [-0.13, 0.13, -0.03], 0)
  s([-0.13 * 0.7, -0.13 * 0.7, -0.09], [0.13 * 0.7, -0.13 * 0.7, -0.09], [0.13 * 0.7, 0.13 * 0.7, -0.09], [-0.13 * 0.7, 0.13 * 0.7, -0.09], 0)
  const r = 0.065, a = 0.34
  s([-r, 0, 0.01], [r, 0, 0.01], [r, 0, -a], [-r, 0, -a], 1)
  s([0, -r, 0.01], [0, r, 0.01], [0, r, -a], [0, -r, -a], 1)
  const l = 0.17, c = 0.05, w = 0.035
  s([-l, -c, w], [l, -c, w], [l, c, w], [-l, c, w], 2)
  s([-l, 0, w + c], [l, 0, w + c], [l, 0, w - c], [-l, 0, w - c], 2)
  s([-0.05, -0.05, -0.01], [0.05, -0.05, -0.01], [0.05, 0.05, -0.01], [-0.05, 0.05, -0.01], 3)
  s([-0.03, -0.03, 0.02], [0.03, -0.03, 0.02], [0.03, 0.03, 0.02], [-0.03, 0.03, 0.02], 4)
  const n = pos.length / 3, normals = new Float32Array(n * 3)
  for (let k = 0; k < n; k++) normals[k * 3 + 2] = 1
  return { positions: new Float32Array(pos), normals, uvs: new Float32Array(uv), indices: new Uint32Array(idx) }
}

/** 原版 pa / ma：阻尼弹簧（刚度 k、阻尼 c），步长不超过 8ms */
interface Spring { x: number; v: number; k: number; c: number }
const spring = (k: number, c: number): Spring => ({ x: 0, v: 0, k, c })
function stepSpring(s: Spring, target: number, dt: number) {
  const n = dt > 0.012 ? Math.ceil(dt / 8e-3) : 1, h = dt / n
  for (let o = 0; o < n; o++) { s.v += ((target - s.x) * s.k - s.v * s.c) * h; s.x += s.v * h }
  return s.x
}

type Look = { color: Vec3 | string; material: MaterialOptions }
const mat = (c: RGB, rough: number, metallic: number): { color: Vec3; material: MaterialOptions } =>
  ({ color: linearColor(c), material: { smoothness: 1 - rough, metallic, vertexColors: true, shadows: false, wet: 0 } })
// 原版材质（颜色为线性值，粗糙度 → 光滑度）
const ANODISED = mat([0.0085, 0.009, 0.0105], 0.4, 0.45)
const PHOSPHATE = mat([0.016, 0.016, 0.0165], 0.5, 0.7)
const POLYMER = mat([0.0125, 0.0128, 0.0135], 0.62, 0)
const MATTE = mat([1, 1, 1], 0.92, 0)
const TAN = mat([0.105, 0.08, 0.05], 0.62, 0)
const BRASS = mat([0.62, 0.42, 0.16], 0.35, 1)

// ---------------------------------------------------------------- 按 World 缓存的资源

interface Res {
  orig?: ReturnType<typeof createPac9Materials>
  glove: Look
  H: ReturnType<typeof buildHands>
  marks: { key: string; tex: any }[]
  flashShader: any
  decals: ReturnType<typeof createDecals>
  fx: ReturnType<typeof createFx>
}

interface Store {
  res?: Res
  rigs: Map<number, Rig>
  frame: number
  time: number
  dt: number
}

const stores = new WeakMap<object, Store>()
function store(w: any): Store {
  let S = stores.get(w)
  if (!S) stores.set(w, (S = { rigs: new Map(), frame: -1, time: 0, dt: 0 }))
  return S
}

/** 本帧的帧间隔：clock 只有 time 与 frame，按上一帧记下的值算；隔了帧（或第一帧）为 0 */
function frameDt(S: Store, ctx: Context) {
  const c: any = ctx.clock
  if (S.frame !== c.frame) {
    S.dt = S.frame === c.frame - 1 ? Math.min(0.1, Math.max(0, c.time - S.time)) : 0
    S.frame = c.frame
    S.time = c.time
  }
  return S.dt
}

function resources(S: Store, ctx: Context): Res {
  if (S.res) return S.res
  const { scene } = ctx
  const log = ctx.logger('realistic')
  const decals = createDecals(ctx)
  if (decals) log.info(`弹孔图集绘制 ${decals.atlasMs} ms`)
  const fx = createFx(ctx, { mask: 1 << LEVEL_LAYER })
  if (fx) log.info(`粒子图集生成 ${fx.atlasMs} ms`)
  const geo = buildPac9()
  for (const key of Object.keys(geo)) scene.mesh(`pac9-${key}`, toMesh(geo[key]))
  // 原版枪身材质（MeshStandardMaterial + Bf 补丁原文，three 方言编译）；平台没有运行时着色器时退回内置材质
  const orig = ctx.gfx.supported ? createPac9Materials(ctx) : undefined
  if (!orig) log.warn('枪模原版材质不可用（运行时着色器不支持或编译失败），使用内置材质近似')
  // 手套：原版 glove_fabric（底色 #23262a × 织物贴图 × 顶点色，三平面，贴图 0.25 米 × 缩放 3 → 每米 12 次）
  const fabric = Tex.upload(ctx, Tex.fabric(512))
  const glove: Look = { color: '#23262a', material: { ...fabric, smoothness: 1, metallic: 1, vertexColors: true, uv: 'object', tiling: [12, 12], shadows: false, wet: 0 } as MaterialOptions }
  // 双手（原版 Vv / dm 机械移植）
  const H = buildHands()
  scene.mesh('hand-r', toMesh(H.right.fabric))
  H.right.index.forEach((g: any, k: number) => scene.mesh(`hand-r-index${k}`, toMesh(g)))
  scene.mesh('hand-l', toMesh(H.left.fabric))
  // 枪身刻字（原版 F_）：每个标签一张文字贴图，贴图按原版像素框 ×2 渲染
  const quads = markingQuads()
  const marks = Object.keys(quads).map((key) => {
    const [, , pw, ph] = LABELS[key as keyof typeof LABELS], L = (LABEL_TEXT as any)[key]
    const tex = scene.text({ text: L.text, width: pw * 2, height: ph * 2, size: L.size * 2, color: L.color, align: L.align ?? 'center', bold: key !== 'cal' })
    scene.mesh(`mark-${key}`, toMesh(quads[key]))
    return { key, tex }
  })
  // 原版 N_：程序化枪口火焰。不支持运行时着色器的平台不画火焰，只留火光
  let flashShader: any = null
  if (ctx.gfx?.supported) {
    const sh = ctx.gfx.shader({ fragment: '@pot/kit/realistic/shaders/muzzle.frag', name: 'realistic/muzzle' })
    if (sh.ok !== false) {
      scene.mesh('muzzle-flash', muzzleFlashMesh)
      flashShader = sh
    }
  }
  return (S.res = { orig, glove, H, marks, flashShader, decals, fx })
}

// ---------------------------------------------------------------- 按实体的场景对象与动画状态

interface Rig {
  objs: Entity[]
  fovRoot: Entity
  gun: Entity
  bolt: Entity
  mag: Entity
  round: Entity
  roundOn: boolean
  leftHand: Entity
  leftRestPos: Vec3
  leftRestRot: Vec3
  indexFinger: Entity[]
  muzzle: Entity
  flash: Entity | null
  flashLight: Entity
  tracers: { e: Entity; life: number }[]
  wetParts: Entity[]
  visible: boolean
  // 动画（原版 dm 的 k.*）
  kZ: Spring; kP: Spring; kY: Spring; kR: Spring; bump: Spring
  boltT: number
  finger: number
  fingerIdx: number
  bobPhase: number
  bobAmt: number
  clock: number
  flags: Record<string, number>
  wasReloading: boolean
  ti: number
  flashT: number
  flashDur: number
  heat: number
  flashSeed: number
  flashJet: number
  wet: number
  wetSent: number
  seen: { shots: number; dry: number; reloads: number }
}

function buildRig(ctx: Context, R: Res, g: GunFpsState): Rig {
  const { scene } = ctx
  const objs: Entity[] = []
  const add = <T extends Entity>(e: T) => (objs.push(e), e)
  const fovRoot = add(scene.spawn({ shape: 'empty', name: 'viewmodel-fov', parent: scene.camera }))
  const gun = add(scene.spawn({ shape: 'empty', name: 'viewmodel', parent: fovRoot, position: u(EU.p), rotation: euler(EU.r[0], EU.r[1], EU.r[2]) }))
  const meshPart = (mesh: string, parent: Entity, m: Look, active = true) =>
    add(scene.spawn({ shape: `mesh:${mesh}`, name: 'gun', parent, color: m.color, material: m.material, collider: false, layer: VIEW_LAYER, active }))
  const wetParts: Entity[] = []
  const part = (key: string, parent: Entity, m: Look, three?: StandardMaterial) => {
    const e = meshPart(`pac9-${key}`, parent, m)
    if (three) {
      e.shader(three.shader, three.binding())
      if ('uRain' in three.uniforms) wetParts.push(e)
    }
    return e
  }
  const o = R.orig
  part('ano', gun, ANODISED, o?.anodised)
  part('gun', gun, PHOSPHATE, o?.phosphate)
  part('poly', gun, POLYMER, o?.polymer)
  part('plain', gun, MATTE, o?.matte)
  const bolt = part('bolt', gun, PHOSPHATE, o?.phosphate)
  const mag = add(scene.spawn({ shape: 'empty', name: 'mag', parent: gun, position: MAG }))
  part('mag', mag, TAN, o?.tan)
  const round = part('round', mag, BRASS)
  // 双手：右手握把固定，食指三档扳机姿态；左手按换弹关键帧运动
  const H = R.H
  const rightHand = add(scene.spawn({ shape: 'empty', name: 'hand-r', parent: gun, position: toUnityPos(H.right.p), rotation: toUnityEuler(H.right.q) }))
  meshPart('hand-r', rightHand, R.glove)
  const indexFinger = [0, 1, 2].map((k) => meshPart(`hand-r-index${k}`, rightHand, R.glove, k === 0))
  const leftRestPos = toUnityPos(H.left.rest.p), leftRestRot = toUnityEuler(H.left.rest.q)
  const leftHand = add(scene.spawn({ shape: 'empty', name: 'hand-l', parent: gun, position: leftRestPos, rotation: leftRestRot }))
  meshPart('hand-l', leftHand, R.glove)
  for (const m of R.marks) {
    add(scene.spawn({ shape: `mesh:mark-${m.key}`, name: 'marking', parent: gun, color: '#ffffff', material: { mode: 'lit-fade', map: m.tex, smoothness: 0.38, metallic: 0, shadows: false, wet: 0 }, collider: false, layer: VIEW_LAYER }))
  }
  // 全息镜：镜片（窗口略放大）+ 红点，位于视线高度 sightY、镜窗前后位置 lensF
  const win = PAC9.window
  const ww = (win[1][0] - win[0][0]) * 1.01, wh = (win[3][1] - win[0][1]) * 1.01
  add(scene.spawn({ shape: 'quad', name: 'lens', parent: gun, position: [0, PAC9.sightY, PAC9.lensF + 0.0025], scale: [ww, wh, 1], color: [0.55, 0.6, 0.55, 0.12], material: { mode: 'lit-fade', smoothness: 0.95, metallic: 0.2, shadows: false }, collider: false, layer: VIEW_LAYER }))
  add(scene.spawn({ shape: 'quad', name: 'reticle', parent: gun, position: [0, PAC9.sightY, PAC9.lensF + 0.002], scale: 0.0012, color: '#000000', material: { mode: 'lit', emission: '#ff2a1a', emissionIntensity: 12, shadows: false }, collider: false, layer: VIEW_LAYER }))
  const muzzle = add(scene.spawn({ shape: 'empty', name: 'muzzle', parent: gun, position: u(PAC9.muzzle) }))
  let flash: Entity | null = null
  if (R.flashShader) {
    flash = add(scene.spawn({ shape: 'mesh:muzzle-flash', name: 'flash', parent: muzzle, collider: false, layer: VIEW_LAYER, active: false }))
    flash.shader(R.flashShader, { blend: 'add', cull: 'none', queue: 'transparent', depthWrite: false, shadows: false, uniforms: { uSeed: 0, uInt: 0, uHeat: 0, uJet: 1 } })
  }
  const flashLight = add(scene.light({ type: 'point', name: 'muzzle-light', parent: muzzle, intensity: 0, range: 7, color: '#ffbe6a' }))
  const tracers: { e: Entity; life: number }[] = []
  for (let i = 0; i < 8; i++) tracers.push({ e: add(scene.spawn({ name: 'tracer', scale: [0.018, 0.018, 1], color: '#ffd9a0', material: { mode: 'additive', shadows: false }, collider: false, active: false })), life: 0 })
  const roundOn = !g.boltLocked
  round.active(roundOn)
  return {
    objs, fovRoot, gun, bolt, mag, round, roundOn, leftHand, leftRestPos, leftRestRot, indexFinger, muzzle, flash, flashLight, tracers, wetParts,
    visible: true,
    kZ: spring(520, 30), kP: spring(380, 26), kY: spring(300, 22), kR: spring(300, 20), bump: spring(600, 30),
    boltT: 9, finger: 0, fingerIdx: 0, bobPhase: 0, bobAmt: 0, clock: 0, flags: {}, wasReloading: g.reloading, ti: 0,
    flashT: 0, flashDur: 0.05, heat: 0, flashSeed: 0, flashJet: 1, wet: wetness.value, wetSent: -1,
    seen: { shots: g.shots, dry: g.dry, reloads: g.reloads },
  }
}

// ---------------------------------------------------------------- 表现

type Gun = GunFpsProps & GunFpsState
type Move = MoveFpsProps & MoveFpsState
/** 只读 cameraFps 的这几项（fps 没导出它的类型） */
interface CameraFpsLike { active: boolean; fov: number; fovAds: number; fovSprint: number }

/** 非敌人命中：水面 → 水花 + 水声；其他 → 烟尘团、火花、闪光 + 弹孔 */
function impact(ctx: Context, R: Res, point: Vec3, n: Vec3, surface: string, dir?: Vec3) {
  const { scene } = ctx, fx = R.fx
  if (surface === 'water' && fx) {
    fx.splash(point, 1)
    ctx.audio.play(sfx('water'), { volume: 0.5, position: point })
    return
  }
  ctx.audio.play(sfx('impact'), { volume: 0.4, position: point })
  if (fx) fx.impact(point, n, surface, dir)
  else {
    const at: Vec3 = [point[0] + n[0] * 0.02, point[1] + n[1] * 0.02, point[2] + n[2] * 0.02]
    scene.burst({ kind: 'spark', position: at, direction: n, color: '#ffb060', intensity: 8, count: 12, speed: 5.5, speedJitter: 0.6, spread: 0.45, size: 0.018, life: 0.35, lifeJitter: 0.5 })
    scene.burst({ kind: 'smoke', position: at, direction: n, color: '#8f8a84', count: 4, speed: 0.8, spread: 0.6, size: 0.22, sizeJitter: 0.5, life: 1.1 })
  }
  const dk = R.decals && decalFor(surface)
  if (dk) R.decals!.add(point, n, dk[0], dk[1], dk[2], dk[3])
}

/** 一发的表现：枪口火焰、弹簧冲量、枪声、命中效果、枪口火光与曳光 */
function shotFx(ctx: Context, w: any, R: Res, r: Rig, e: any, g: Gun, m: Move | undefined, s: GunShot) {
  const { scene } = ctx, rand = Math.random
  r.flashT = r.flashDur = 0.036 + rand() * 0.02
  r.heat = Math.min(1.3, r.heat + 0.05)
  r.flashSeed = rand() * 100
  r.flashJet = 0.6 + rand() * 0.6
  if (r.flash) r.flash.localRotation = [0, 0, (rand() - 0.5) * 0.4 * DEG]
  // 枪模后坐弹簧（原版 Be）
  const ke = smoother(g.ads), bt = lerp(1, 0.55, ke) * (m?.crouched ? 0.85 : 1)
  r.kZ.v += 1.5 * lerp(1, 0.6, ke); r.kP.v += 1.5 * bt; r.kY.v += (rand() - 0.5) * bt; r.kR.v += (rand() - 0.5) * 1.8 * bt
  r.boltT = 0
  ctx.audio.play(sfx('shot'), { volume: 0.75, pitch: 0.95 + rand() * 0.1 })
  const origin = s.o, dir = s.d
  const hit = scene.raycast(origin, dir, { maxDistance: g.range, mask: g.viewMask || undefined, planes: g.viewPlanes ?? undefined })
  const end: Vec3 = hit ? hit.point : [origin[0] + dir[0] * g.range, origin[1] + dir[1] * g.range, origin[2] + dir[2] * g.range]
  if (hit) {
    const n = hit.normal
    const part = hit.id > 0 ? w.view.partOf(hit.id) : null
    if (part && part.entity.id !== e.id) {
      const at: Vec3 = [hit.point[0] + n[0] * 0.02, hit.point[1] + n[1] * 0.02, hit.point[2] + n[2] * 0.02]
      scene.burst({ kind: 'glow', position: at, direction: n, color: part.tag === 'weak' ? '#ff5a40' : '#ffd890', intensity: 6, count: 10, speed: 2.5, spread: 0.6, size: 0.05, life: 0.18 })
      scene.burst({ kind: 'spark', position: at, direction: n, color: '#ffc070', intensity: 8, count: 8, speed: 5, spread: 0.5, size: 0.02, life: 0.3 })
    } else {
      impact(ctx, R, hit.point, n, env(w).surface(hit.point, n, hit.tag), norm(sub(hit.point, origin)))
    }
  }
  // 枪口火光
  const mp = r.muzzle.position
  scene.burst({ kind: 'glow', position: mp, direction: dir, color: '#ffb35a', intensity: 6, count: 5, speed: 3, spread: 0.25, size: 0.035, life: 0.05 })
  // 曳光：从枪口到命中点
  const len = Math.hypot(end[0] - mp[0], end[1] - mp[1], end[2] - mp[2])
  if (len > 1.5 && rand() < 0.7) {
    const t = r.tracers[r.ti++ % r.tracers.length]
    const a = 0.25 + rand() * 0.3
    const seg = Math.min(len * 0.6, 14)
    t.e.position = [lerp(mp[0], end[0], a), lerp(mp[1], end[1], a), lerp(mp[2], end[2], a)]
    t.e.lookAt(end)
    t.e.scale = [0.018, 0.018, seg]
    t.e.active(true)
    t.life = 0.045
  }
}

const env = (w: any) => envs.get(w.registry) ?? DEFAULT_ENV

/** 原版 setWetness：雨淋程度 1（露天）时以 0.6 的速率变湿，否则以 0.25 的速率趋向它 */
function updateWetness(r: Rig, target: number, dt: number) {
  if (!r.wetParts.length) return
  const t = clamp(target, 0, 1)
  r.wet += (t - r.wet) * Math.min(1, dt * (t >= 1 ? 0.6 : 0.25))
  wetness.value = clamp(r.wet, 0, 1)
  if (Math.abs(wetness.value - r.wetSent) < 2e-3) return
  r.wetSent = wetness.value
  for (const p of r.wetParts) p.uniforms({ uRain: r.wetSent })
}

const tp = new Vector3(), tq = new Quaternion(), tz = new Quaternion(), tm = new Vector3()

function update(ctx: Context, w: any, r: Rig, R: Res, e: any, dt: number) {
  const g = e.b.gunFps as Gun | undefined
  const m = e.b.moveFps as Move | undefined
  const c = e.b.cameraFps as CameraFpsLike | undefined
  const hp = e.b.health
  if (!g || !m || !c) return
  const alive = !hp || hp.hp > 0
  const visible = c.active && alive
  if (visible !== r.visible) {
    r.visible = visible
    r.gun.active(visible)
  }
  // 叠加状态（暂停）：只设可见，其余冻结
  if (w.overlayActive) return
  updateWetness(r, env(w).shelter(ctx.scene.camera.position), dt)

  // 计数变化：新的发、空仓扣扳机、开始换弹
  if (g.shots !== r.seen.shots) {
    for (const s of g.fired) if (s.k > r.seen.shots) shotFx(ctx, w, R, r, e, g, m, s)
    r.seen.shots = g.shots
  }
  if (g.dry !== r.seen.dry) {
    r.seen.dry = g.dry
    ctx.audio.play(sfx('dry'), { volume: 0.5 })
    r.bump.v -= 0.08
  }
  if (g.reloads !== r.seen.reloads) {
    r.seen.reloads = g.reloads
    r.flags = {}
    ctx.audio.play(sfx('reload'), { volume: 0.6, pitch: g.reloadTactical / g.reloadTotal * 1.6 })
  }

  // 特效衰减
  for (const t of r.tracers) if (t.life > 0 && (t.life -= dt) <= 0) t.e.active(false)
  r.flashT -= dt
  r.heat = Math.max(0, r.heat - dt * 0.2)
  if (r.flash) {
    const uInt = r.flashT > 0 ? 9.5 * Math.sqrt(Math.max(0, r.flashT / r.flashDur)) : 0
    const uHeat = clamp((r.heat - 0.45) / 0.8, 0, 1) * 2.2
    const on = uInt > 0 || uHeat > 0.02
    r.flash.active(on)
    if (on) r.flash.uniforms({ uSeed: r.flashSeed, uInt, uHeat, uJet: r.flashJet })
  }
  r.flashLight.intensity(r.flashT > 0 ? 3 : 0)
  if (!g.active || !alive) return

  // 换弹动作（原版 dm 的时间点：0.47 弹匣脱出、0.86 新弹匣顶弹可见、1.345 插入、1.5 拍底、空仓 2.02~2.19 拉机柄）
  const H = R.H, f = r.flags
  const t = g.reloadT + (g.reloading ? ctx.clock.fixedAlpha * w.dt : 0)
  const once = (key: string, at: number) => (t >= at && !f[key] ? (f[key] = 1, true) : false)
  let nn = 0, reloadW = 0, rackW = 0
  if (g.reloading) {
    const empty = g.reloadTotal === g.reloadEmpty
    if (once('magout', H.magOut)) r.bump.v -= 0.25
    if (once('magin', H.magIn)) {
      r.bump.v += 0.55
      ctx.audio.play(sfx('dry'), { volume: 0.6, pitch: 1.4 })
    }
    if (once('tap', 1.5)) r.bump.v += 0.4
    if (empty) {
      if (t >= H.boltB) nn = t < H.boltP ? smoother((t - H.boltB) / (H.boltP - H.boltB)) : t < H.boltV ? 1 : Math.max(0, 1 - (t - H.boltV) / 0.035)
      if (once('bolt', H.boltV)) { r.bump.v += 0.3; r.kZ.v -= 0.5; ctx.audio.play(sfx('dry'), { volume: 0.6, pitch: 1.15 }) }
    }
    const s = sampleTrack(empty ? H.empty : H.tactical, t, tp, tq)
    r.leftHand.localPosition = toUnityPos(s.p)
    r.leftHand.localRotation = toUnityEuler(s.q)
    if (t >= H.magOut && t < H.magIn) {
      tz.copy(s.q).multiply(H.magGripInv)
      r.mag.localRotation = toUnityEuler(tz)
      tm.fromArray(PAC9.magPos as any).sub(H.magGrip.p).applyQuaternion(tz).add(s.p)
      r.mag.localPosition = toUnityPos(tm)
    } else {
      r.mag.localRotation = [0, 0, 0]
      r.mag.localPosition = MAG
    }
    const hs = 1 - smoother((t - (g.reloadTotal - 0.46)) / 0.4)
    reloadW = Math.min(smoother(t / 0.3), hs)
    rackW = empty ? smoother((t - 1.62) / 0.3) * hs : 0
  } else if (r.wasReloading) {
    r.leftHand.localPosition = r.leftRestPos
    r.leftHand.localRotation = r.leftRestRot
    r.mag.localRotation = [0, 0, 0]
    r.mag.localPosition = MAG
  }
  r.wasReloading = g.reloading
  const roundOn = !g.boltLocked || (g.reloading && t > 0.86)
  if (roundOn !== r.roundOn) {
    r.roundOn = roundOn
    r.round.active(roundOn)
  }

  // 枪机：每发 72ms 往复，打空后锁在 86% 行程；空仓换弹时由左手拉机柄驱动
  r.boltT += dt
  let ba = r.boltT < 0.072 ? Math.sin(Math.PI * r.boltT / 0.072) : 0
  if (g.boltLocked && r.boltT > 0.036) ba = Math.max(ba, 0.86)
  r.bolt.localPosition = [0, 0, -PAC9.boltTravel * Math.max(ba * 0.95, nn)]
  // 食指扣扳机
  r.finger = damp(r.finger, g.trigger && !g.reloading && g.sprintT < 0.45 ? 1 : 0, 30, dt)
  const fi = r.finger < 0.25 ? 0 : r.finger < 0.75 ? 1 : 2
  if (fi !== r.fingerIdx) { r.indexFinger[r.fingerIdx].active(false); r.indexFinger[fi].active(true); r.fingerIdx = fi }

  // 视野缩放
  const a = g.ads
  const fov = c.fov + (c.fovAds - c.fov) * a + (m.sprinting ? c.fovSprint : 0)
  const k = Math.tan(fov * Math.PI / 360) / Math.tan(VIEW_FOV * Math.PI / 360)
  r.fovRoot.scale = [k, k, 1]

  // 枪身姿态（原版 Xe 末段）：腰射/瞄准插值 + 冲刺 + 换弹 + 拉机柄 + 步伐晃动 + 呼吸 + 后坐弹簧
  r.clock += dt
  const ke = smoother(a), Le = 1 - ke, Ue = g.sprintT, ct = reloadW, De = rackW
  const ground = m.grounded, speed = m.speed
  r.bobAmt = damp(r.bobAmt, ground ? clamp(speed / 3.6, 0, 1) : 0, 8, dt)
  r.bobPhase += dt * (speed > 0.3 && ground ? 5.2 + speed * 1.55 : 0)
  const Zo = r.bobPhase, yr = r.bobAmt * lerp(1, 0.12, ke) * (1 + Ue * 1.4)
  const lu = Math.sin(Zo) * 6e-3 * yr
  const de = (Math.sin(2 * Zo) * 42e-4 - Math.pow(0.5 + 0.5 * Math.cos(2 * Zo + 0.6), 4) * 48e-4) * yr
  const te = lerp(1, 0.3, ke), he = r.clock
  for (const s of [r.kZ, r.kP, r.kY, r.kR, r.bump]) stepSpring(s, 0, dt)
  // 原版读 WASD；这里用速度在朝向上的投影（除以走速）
  const y = m.yaw / DEG, v = m.vel, walk = m.walk || 1
  const ge = clamp((v[0] * Math.cos(y) - v[2] * Math.sin(y)) / walk, -1, 1)
  const ye = clamp((v[0] * Math.sin(y) + v[2] * Math.cos(y)) / walk, -1, 1)
  const kZ = r.kZ.x, kP = r.kP.x, kY = r.kY.x, kR = r.kR.x, bump = r.bump.x
  const px = lerp(EU.p[0], QV.p[0], ke) + TU.p[0] * Ue + NU.p[0] * ct + lu + Math.sin(he * 0.85 + 1) * 12e-4 * te - ge * 4e-3 * Le
  const py = lerp(EU.p[1], QV.p[1], ke) + TU.p[1] * Ue + NU.p[1] * ct + de + Math.sin(he * 1.7) * 16e-4 * te + bump * 0.6
  const pz = lerp(EU.p[2], QV.p[2], ke) + TU.p[2] * Ue + NU.p[2] * ct + kZ * 0.55 + ye * 4e-3 * Le * (1 - Ue)
  const rx = EU.r[0] * Le + TU.r[0] * Ue + NU.r[0] * ct - 0.16 * De + Math.sin(he * 1.7 + 0.8) * 35e-4 * te + Math.sin(2 * Zo + 0.5) * 8e-3 * yr + kP + bump * 1.5
  const ry = EU.r[1] * Le + TU.r[1] * Ue + NU.r[1] * ct + Math.sin(he * 0.6) * 2e-3 * te + Math.sin(Zo) * 0.01 * yr + kY
  const rz = EU.r[2] * Le + TU.r[2] * Ue + NU.r[2] * ct + 0.62 * De + Math.sin(Zo) * 0.014 * yr - ge * 0.035 * Le + kR + Math.sin(he * 0.5) * 4e-3 * te
  r.gun.localPosition = [px, py, -pz]
  r.gun.localRotation = euler(rx, ry, rz)
}

export const viewGun = defineBlock({
  name: 'viewGun',
  about: '第一人称枪的样子（只有表现）：读同一实体的 gunFps、moveFps、cameraFps、health，画 PAC-9 枪模、双手与换弹动作、枪口火焰、曳光、命中特效与枪声。表面种类与雨淋程度由 setGunEnv(w, { surface, shelter }) 注入',
  props: {},
  order: 3,
  view: {
    enter(_me, e, ctx, w) {
      const g = e.b.gunFps as Gun | undefined
      if (!g) return
      registerSfx(ctx as any)
      const S = store(w)
      const R = resources(S, ctx as any)
      R.decals?.clear()
      R.fx?.clear()
      const old = S.rigs.get(e.id)
      if (old) destroy(old)
      S.rigs.set(e.id, buildRig(ctx as any, R, g))
    },
    update(_me, e, _objs, ctx, w) {
      const S = store(w)
      const r = S.rigs.get(e.id)
      if (!r || !S.res) return
      update(ctx as any, w, r, S.res, e, frameDt(S, ctx as any))
    },
    exit(_me, e, _objs, _ctx, w) {
      const S = stores.get(w)
      const r = S?.rigs.get(e.id)
      if (!r) return
      S!.rigs.delete(e.id)
      destroy(r)
    },
  },
})

/** 倒序销毁（先子后父） */
function destroy(r: Rig) {
  for (let i = r.objs.length - 1; i >= 0; i--) {
    try {
      r.objs[i].destroy()
    } catch {
      // 已随父节点销毁
    }
  }
  r.objs = []
}
