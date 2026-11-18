/** 武器 PAC-9：射线射击、扩散、后坐力、换弹、瞄准、枪模（含双手、刻字）、曳光与命中火花 */
import type { Context, Entity, MaterialOptions, Vec3 } from '@pot/core'
import { emit, on, type BulletHit } from '../lib/bus'
import { createDecals, decalFor, surfaceAt } from '../lib/decals'
import { linearColor, toMesh, type RGB } from '../lib/geo'
import { buildPac9, PAC9 } from '../lib/gun'
import { buildHands, LABEL_TEXT, LABELS, markingQuads, sampleTrack, smoother, toUnityEuler, toUnityPos } from '../lib/hands'
import { ENEMY_LAYER, LEVEL_LAYER, VIEW_LAYER } from '../lib/level'
import { clamp, damp, forward, jitter, lerp } from '../lib/math'
import { sfx } from '../lib/sfx'
import * as Tex from '../lib/textures'
import { game, player, WEAPON, eyeOf, type WeaponState } from '../lib/types'
import { Quaternion, Vector3 } from '../vendor/three-geo'

export const name = 'weapon'

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

/** 原版 pa / ma：阻尼弹簧（刚度 k、阻尼 c），步长不超过 8ms */
interface Spring { x: number; v: number; k: number; c: number }
const spring = (k: number, c: number): Spring => ({ x: 0, v: 0, k, c })
function stepSpring(s: Spring, target: number, dt: number) {
  const n = dt > 0.012 ? Math.ceil(dt / 8e-3) : 1, h = dt / n
  for (let o = 0; o < n; o++) { s.v += ((target - s.x) * s.k - s.v * s.c) * h; s.x += s.v * h }
  return s.x
}

export function apply(ctx: Context) {
  const W = ctx.data.load('tuning.json').weapon
  const T = ctx.data.load('tuning.json').player
  const fresh = (): WeaponState => ({ mag: W.mag, reserve: W.reserve, reloading: false, reloadT: 0, reloadTotal: 0, ads: 0, cooldown: 0, bloom: 0, recoilP: 0, recoilY: 0, kick: 0, spread: W.spread })
  const w = ctx.state.define<WeaponState>(WEAPON, { version: 1, init: fresh })
  const { scene } = ctx
  const cam = scene.camera
  const rand = Math.random
  // ---- 弹孔贴花（原版 Hb 图集 + j1 池） ----
  const decals = createDecals(ctx)
  if (decals) ctx.logger('jimao').info(`弹孔图集绘制 ${decals.atlasMs} ms`)
  // 调试：ctx.emit('jimao/debug') 沿视线做一次与开枪相同的检测并落弹孔，日志报告表面与池数量
  if (decals) on(ctx, 'jimao/debug', () => {
    const p = player(ctx)
    if (!p) return
    const hit = scene.raycast(eyeOf(p), forward(p.yaw, p.pitch), { maxDistance: W.range, mask: (1 << LEVEL_LAYER) | (1 << ENEMY_LAYER) })
    const s = hit ? surfaceAt(hit.point) : '-', dk = decalFor(s)
    if (hit && dk) decals.add(hit.point, hit.normal, dk[0], dk[1], dk[2], dk[3])
    ctx.logger('jimao').info(`调试射线 ${hit ? hit.point.map(v => v.toFixed(2)).join(',') : '未命中'} 表面 ${s} 弹孔 ${decals.count}`)
  })

  // ---- 枪模（原版几何机械移植，挂在相机下，单独一层，不进平面反射） ----
  const geo = buildPac9()
  for (const key of Object.keys(geo)) scene.mesh(`pac9-${key}`, toMesh(geo[key]))
  // 原版材质（颜色为线性值，粗糙度 → 光滑度）
  const mat = (c: RGB, rough: number, metallic: number): { color: Vec3; material: MaterialOptions } =>
    ({ color: linearColor(c), material: { smoothness: 1 - rough, metallic, vertexColors: true, shadows: false, wet: 0 } })
  const anodised = mat([0.0085, 0.009, 0.0105], 0.4, 0.45)
  const phosphate = mat([0.016, 0.016, 0.0165], 0.5, 0.7)
  const polymer = mat([0.0125, 0.0128, 0.0135], 0.62, 0)
  const matte = mat([1, 1, 1], 0.92, 0)
  const tan = mat([0.105, 0.08, 0.05], 0.62, 0)
  const brass = mat([0.62, 0.42, 0.16], 0.35, 1)
  // 手套：原版 glove_fabric（底色 #23262a × 织物贴图 × 顶点色，三平面，贴图 0.25 米 × 缩放 3 → 每米 12 次）
  const fabric = Tex.upload(ctx, Tex.fabric(512))
  const glove = { color: '#23262a', material: { ...fabric, smoothness: 1, metallic: 1, vertexColors: true, uv: 'object', tiling: [12, 12], shadows: false, wet: 0 } as MaterialOptions }

  const fovRoot = scene.spawn({ shape: 'empty', name: 'viewmodel-fov', parent: cam })
  const gun = scene.spawn({ shape: 'empty', name: 'viewmodel', parent: fovRoot, position: u(EU.p), rotation: euler(EU.r[0], EU.r[1], EU.r[2]) })
  const meshPart = (mesh: string, parent: Entity, m: { color: Vec3 | string; material: MaterialOptions }, active = true) =>
    scene.spawn({ shape: `mesh:${mesh}`, name: 'gun', parent, color: m.color, material: m.material, collider: false, layer: VIEW_LAYER, active })
  const part = (key: string, parent: Entity, m: { color: Vec3; material: MaterialOptions }) => meshPart(`pac9-${key}`, parent, m)
  part('ano', gun, anodised)
  part('gun', gun, phosphate)
  part('poly', gun, polymer)
  part('plain', gun, matte)
  const bolt = part('bolt', gun, phosphate)
  const MAG = u(PAC9.magPos)
  const mag = scene.spawn({ shape: 'empty', name: 'mag', parent: gun, position: MAG })
  part('mag', mag, tan)
  const round = part('round', mag, brass)

  // ---- 双手（原版 Vv / dm 机械移植）：右手握把固定，食指三档扳机姿态；左手按换弹关键帧运动 ----
  const H = buildHands()
  scene.mesh('hand-r', toMesh(H.right.fabric))
  H.right.index.forEach((g: any, k: number) => scene.mesh(`hand-r-index${k}`, toMesh(g)))
  scene.mesh('hand-l', toMesh(H.left.fabric))
  const rightHand = scene.spawn({ shape: 'empty', name: 'hand-r', parent: gun, position: toUnityPos(H.right.p), rotation: toUnityEuler(H.right.q) })
  meshPart('hand-r', rightHand, glove)
  const indexFinger = [0, 1, 2].map((k) => meshPart(`hand-r-index${k}`, rightHand, glove, k === 0))
  const leftRestPos = toUnityPos(H.left.rest.p), leftRestRot = toUnityEuler(H.left.rest.q)
  const leftHand = scene.spawn({ shape: 'empty', name: 'hand-l', parent: gun, position: leftRestPos, rotation: leftRestRot })
  meshPart('hand-l', leftHand, glove)

  // ---- 枪身刻字（原版 F_）：每个标签一张文字贴图，贴图按原版像素框 ×2 渲染 ----
  const quads = markingQuads()
  for (const key of Object.keys(quads)) {
    const [, , pw, ph] = LABELS[key as keyof typeof LABELS], L = (LABEL_TEXT as any)[key]
    const tex = scene.text({ text: L.text, width: pw * 2, height: ph * 2, size: L.size * 2, color: L.color, align: L.align ?? 'center', bold: key !== 'cal' })
    scene.mesh(`mark-${key}`, toMesh(quads[key]))
    scene.spawn({ shape: `mesh:mark-${key}`, name: 'marking', parent: gun, color: '#ffffff', material: { mode: 'lit-fade', map: tex, smoothness: 0.38, metallic: 0, shadows: false, wet: 0 }, collider: false, layer: VIEW_LAYER })
  }

  // 全息镜：镜片（窗口略放大）+ 红点，位于视线高度 sightY、镜窗前后位置 lensF
  const win = PAC9.window
  const ww = (win[1][0] - win[0][0]) * 1.01, wh = (win[3][1] - win[0][1]) * 1.01
  scene.spawn({ shape: 'quad', name: 'lens', parent: gun, position: [0, PAC9.sightY, PAC9.lensF + 0.0025], scale: [ww, wh, 1], color: [0.55, 0.6, 0.55, 0.12], material: { mode: 'lit-fade', smoothness: 0.95, metallic: 0.2, shadows: false }, collider: false, layer: VIEW_LAYER })
  scene.spawn({ shape: 'quad', name: 'reticle', parent: gun, position: [0, PAC9.sightY, PAC9.lensF + 0.002], scale: 0.0012, color: '#000000', material: { mode: 'lit', emission: '#ff2a1a', emissionIntensity: 12, shadows: false }, collider: false, layer: VIEW_LAYER })
  const muzzle = scene.spawn({ shape: 'empty', name: 'muzzle', parent: gun, position: u(PAC9.muzzle) })
  const flash = scene.spawn({ shape: 'quad', name: 'flash', parent: muzzle, scale: 0.12, color: '#ffcf7a', material: { mode: 'additive', shadows: false }, collider: false, layer: VIEW_LAYER, active: false })
  const flashLight = scene.light({ type: 'point', name: 'muzzle-light', parent: muzzle, intensity: 0, range: 7, color: '#ffbe6a' })

  // ---- 曳光弹 ----
  const tracers: { e: Entity; life: number }[] = []
  for (let i = 0; i < 8; i++) tracers.push({ e: scene.spawn({ name: 'tracer', scale: [0.018, 0.018, 1], color: '#ffd9a0', material: { mode: 'additive', shadows: false }, collider: false, active: false }), life: 0 })
  let ti = 0
  let flashT = 0

  // ---- 枪模动画状态（原版 dm 的 k.*；纯表现，不进存档） ----
  const kZ = spring(520, 30), kP = spring(380, 26), kY = spring(300, 22), kR = spring(300, 20), bump = spring(600, 30)
  let boltT = 9, boltLocked = w.mag <= 0, finger = 0, fingerIdx = 0, sprintT = 0, bobPhase = 0, bobAmt = 0, clock = 0
  let flags: Record<string, number> = {}
  round.active(!boltLocked)
  const tp = new Vector3(), tq = new Quaternion(), tz = new Quaternion(), tm = new Vector3()

  on(ctx, 'jimao/reset', (keep) => {
    const m = w.mag, r = w.reserve
    Object.assign(w, fresh())
    if (keep) { w.mag = Math.max(m, W.mag); w.reserve = Math.max(r, W.reserve) }
    boltLocked = false
    round.active(true)
    decals?.clear()
  })

  function startReload() {
    if (w.reloading || w.mag >= W.mag || w.reserve <= 0) return
    w.reloading = true
    w.reloadTotal = w.mag === 0 ? W.reloadEmpty : W.reloadTactical
    w.reloadT = 0
    flags = {}
    ctx.audio.play(sfx('reload'), { volume: 0.6, pitch: W.reloadTactical / w.reloadTotal * 1.6 })
  }

  function fire(origin: Vec3, yaw: number, pitch: number, moving: boolean, crouching: boolean) {
    const g = game(ctx)!
    w.mag--
    w.cooldown += 60 / W.rpm
    g.stats.shots++
    const base = lerp(W.spread, W.spreadAds, w.ads) + (moving ? W.spreadMove * (1 - w.ads * 0.7) : 0) + w.bloom
    const dir = jitter(forward(yaw, pitch), base, rand)
    w.bloom = Math.min(W.bloomMax, w.bloom + W.bloomPerShot)
    w.recoilP = Math.max(-10, w.recoilP - W.recoilPitch * (1 - w.ads * 0.35))
    w.recoilY += (rand() - 0.5) * 2 * W.recoilYaw
    w.kick = 1
    flashT = 0.05
    // 枪模后坐弹簧（原版 Be）
    const ke = smoother(w.ads), bt = lerp(1, 0.55, ke) * (crouching ? 0.85 : 1)
    kZ.v += 1.5 * lerp(1, 0.6, ke); kP.v += 1.5 * bt; kY.v += (rand() - 0.5) * bt; kR.v += (rand() - 0.5) * 1.8 * bt
    boltT = 0
    if (w.mag <= 0) { boltLocked = true; round.active(false) }
    ctx.audio.play(sfx('shot'), { volume: 0.75, pitch: 0.95 + rand() * 0.1 })
    emit(ctx, 'jimao/shot', origin)

    const hit = scene.raycast(origin, dir, { maxDistance: W.range, mask: (1 << LEVEL_LAYER) | (1 << ENEMY_LAYER) })
    const end: Vec3 = hit ? hit.point : [origin[0] + dir[0] * W.range, origin[1] + dir[1] * W.range, origin[2] + dir[2] * W.range]
    if (hit) {
      const info: BulletHit = { id: hit.id, point: hit.point, damage: W.damage, enemy: false, killed: false, weak: false }
      emit(ctx, 'jimao/bullet', info)
      if (info.enemy) {
        g.stats.hits++
        emit(ctx, 'jimao/hitmarker', info.killed, info.weak)
        ctx.audio.play(sfx(info.killed ? 'kill' : 'hit'), { volume: 0.5, pitch: info.weak ? 1.25 : 1 })
      } else {
        ctx.audio.play(sfx('impact'), { volume: 0.4, position: hit.point })
      }
      const n = hit.normal
      const at: Vec3 = [hit.point[0] + n[0] * 0.02, hit.point[1] + n[1] * 0.02, hit.point[2] + n[2] * 0.02]
      if (info.enemy) {
        scene.burst({ kind: 'glow', position: at, direction: n, color: info.weak ? '#ff5a40' : '#ffd890', intensity: 6, count: 10, speed: 2.5, spread: 0.6, size: 0.05, life: 0.18 })
        scene.burst({ kind: 'spark', position: at, direction: n, color: '#ffc070', intensity: 8, count: 8, speed: 5, spread: 0.5, size: 0.02, life: 0.3 })
      } else {
        scene.burst({ kind: 'spark', position: at, direction: n, color: '#ffb060', intensity: 8, count: 12, speed: 5.5, speedJitter: 0.6, spread: 0.45, size: 0.018, life: 0.35, lifeJitter: 0.5 })
        scene.burst({ kind: 'smoke', position: at, direction: n, color: '#8f8a84', count: 4, speed: 0.8, spread: 0.6, size: 0.22, sizeJitter: 0.5, life: 1.1 })
        const dk = decals && decalFor(surfaceAt(hit.point))
        if (dk) decals!.add(hit.point, n, dk[0], dk[1], dk[2], dk[3])
      }
    }
    // 枪口火光
    const mp = muzzle.position
    scene.burst({ kind: 'glow', position: mp, direction: dir, color: '#ffb35a', intensity: 6, count: 5, speed: 3, spread: 0.25, size: 0.035, life: 0.05 })
    // 曳光：从枪口到命中点
    const start = muzzle.position
    const len = Math.hypot(end[0] - start[0], end[1] - start[1], end[2] - start[2])
    if (len > 1.5 && rand() < 0.7) {
      const t = tracers[ti++ % tracers.length]
      const a = 0.25 + rand() * 0.3
      const seg = Math.min(len * 0.6, 14)
      t.e.position = [lerp(start[0], end[0], a), lerp(start[1], end[1], a), lerp(start[2], end[2], a)]
      t.e.lookAt(end)
      t.e.scale = [0.018, 0.018, seg]
      t.e.active(true)
      t.life = 0.045
    }
  }

  /** 换弹时间点触发一次（原版 Vt） */
  const once = (key: string, at: number) => (w.reloadT >= at && !flags[key] ? (flags[key] = 1, true) : false)

  ctx.on('update', (dt) => {
    const g = game(ctx)
    const p = player(ctx)
    if (!g || !p) return
    const visible = g.phase === 'playing' || g.phase === 'intro' || g.phase === 'paused' || g.phase === 'dead'
    gun.active(visible && p.health > 0)
    // 特效衰减（暂停时冻结）
    if (g.phase !== 'paused') {
      for (const t of tracers) if (t.life > 0 && (t.life -= dt) <= 0) t.e.active(false)
      flashT -= dt
      flash.active(flashT > 0)
      if (flashT > 0) flash.localRotation = [0, 0, rand() * 360]
      flashLight.intensity(flashT > 0 ? 3 : 0)
    }
    if (g.phase !== 'playing' || p.health <= 0) {
      if (g.phase !== 'paused') w.ads = Math.max(0, w.ads - dt / W.adsTime)
      return
    }
    const input = ctx.input
    const locked = input.cursor()
    const trigger = locked && input.key('mouse0')
    // 瞄准
    const wantAds = locked && input.key('mouse1') && !p.sprinting
    w.ads = clamp(w.ads + (wantAds && !w.reloading ? 1 : -1) * dt / W.adsTime, 0, 1)
    sprintT = damp(sprintT, p.sprinting && !trigger && !wantAds && !w.reloading ? 1 : 0, 9, dt)
    // 换弹（原版 dm 的时间点：0.47 弹匣脱出、0.86 新弹匣顶弹可见、1.345 插入、1.5 拍底、空仓 2.02~2.19 拉机柄）
    if (input.pressed('r')) startReload()
    let nn = 0, reloadW = 0, rackW = 0
    if (w.reloading) {
      w.reloadT += dt
      const t = w.reloadT, empty = w.reloadTotal === W.reloadEmpty
      if (once('magout', H.magOut)) bump.v -= 0.25
      if (t > 0.86 && !flags.fresh) { flags.fresh = 1; round.active(true) }
      if (once('magin', H.magIn)) {
        bump.v += 0.55
        const take = Math.min(W.mag - w.mag, w.reserve)
        w.mag += take
        w.reserve -= take
        if (!empty) boltLocked = false
        ctx.audio.play(sfx('dry'), { volume: 0.6, pitch: 1.4 })
      }
      if (once('tap', 1.5)) bump.v += 0.4
      if (empty) {
        if (t >= H.boltB) nn = t < H.boltP ? smoother((t - H.boltB) / (H.boltP - H.boltB)) : t < H.boltV ? 1 : Math.max(0, 1 - (t - H.boltV) / 0.035)
        if (once('bolt', H.boltV)) { boltLocked = false; bump.v += 0.3; kZ.v -= 0.5; ctx.audio.play(sfx('dry'), { volume: 0.6, pitch: 1.15 }) }
      }
      const s = sampleTrack(empty ? H.empty : H.tactical, t, tp, tq)
      leftHand.localPosition = toUnityPos(s.p)
      leftHand.localRotation = toUnityEuler(s.q)
      if (t >= H.magOut && t < H.magIn) {
        tz.copy(s.q).multiply(H.magGripInv)
        mag.localRotation = toUnityEuler(tz)
        tm.fromArray(PAC9.magPos as any).sub(H.magGrip.p).applyQuaternion(tz).add(s.p)
        mag.localPosition = toUnityPos(tm)
      } else {
        mag.localRotation = [0, 0, 0]
        mag.localPosition = MAG
      }
      const hs = 1 - smoother((t - (w.reloadTotal - 0.46)) / 0.4)
      reloadW = Math.min(smoother(t / 0.3), hs)
      rackW = empty ? smoother((t - 1.62) / 0.3) * hs : 0
      if (t >= w.reloadTotal) {
        w.reloading = false
        reloadW = rackW = 0
        leftHand.localPosition = leftRestPos
        leftHand.localRotation = leftRestRot
      }
    }
    // 射击
    w.cooldown = Math.max(-0.02, w.cooldown - dt)
    const canFire = !w.reloading && sprintT < 0.45
    if (trigger && !w.reloading) {
      if (w.mag <= 0) {
        if (input.pressed('mouse0')) { ctx.audio.play(sfx('dry'), { volume: 0.5 }); bump.v -= 0.08 }
        if (w.reserve > 0) startReload()
      } else {
        p.sprinting = false
        const origin = eyeOf(p)
        const moving = p.speed > 1
        let shots = 0
        while (w.cooldown <= 0 && w.mag > 0 && shots++ < 3) fire(origin, p.yaw + w.recoilY, p.pitch + w.recoilP, moving, p.crouching)
      }
    }
    if (!trigger) w.cooldown = Math.max(0, w.cooldown)
    // 扩散、后坐力回复
    w.bloom = Math.max(0, w.bloom - dt * (trigger ? 0.02 : 0.08))
    w.spread = lerp(W.spread, W.spreadAds, w.ads) + (p.speed > 1 ? W.spreadMove * (1 - w.ads * 0.7) : 0) + w.bloom
    if (!trigger) {
      w.recoilP = damp(w.recoilP, 0, W.recoilRecover, dt)
      w.recoilY = damp(w.recoilY, 0, W.recoilRecover, dt)
    }
    w.kick = damp(w.kick, 0, 18, dt)

    // 枪机：每发 72ms 往复，打空后锁在 86% 行程；空仓换弹时由左手拉机柄驱动
    boltT += dt
    let ba = boltT < 0.072 ? Math.sin(Math.PI * boltT / 0.072) : 0
    if (boltLocked && boltT > 0.036) ba = Math.max(ba, 0.86)
    bolt.localPosition = [0, 0, -PAC9.boltTravel * Math.max(ba * 0.95, nn)]
    // 食指扣扳机
    finger = damp(finger, trigger && canFire ? 1 : 0, 30, dt)
    const fi = finger < 0.25 ? 0 : finger < 0.75 ? 1 : 2
    if (fi !== fingerIdx) { indexFinger[fingerIdx].active(false); indexFinger[fi].active(true); fingerIdx = fi }

    // 视野缩放
    const a = w.ads
    const fov = (g.settings.fov ?? T.fov) + (T.fovAds - T.fov) * a + (p.sprinting ? T.fovSprint : 0)
    const k = Math.tan(fov * Math.PI / 360) / Math.tan(VIEW_FOV * Math.PI / 360)
    fovRoot.scale = [k, k, 1]

    // 枪身姿态（原版 Xe 末段）：腰射/瞄准插值 + 冲刺 + 换弹 + 拉机柄 + 步伐晃动 + 呼吸 + 后坐弹簧
    clock += dt
    const ke = smoother(a), Le = 1 - ke, Ue = sprintT, ct = reloadW, De = rackW
    const ground = p.grounded
    bobAmt = damp(bobAmt, ground ? clamp(p.speed / 3.6, 0, 1) : 0, 8, dt)
    bobPhase += dt * (p.speed > 0.3 && ground ? 5.2 + p.speed * 1.55 : 0)
    const Zo = bobPhase, yr = bobAmt * lerp(1, 0.12, ke) * (1 + Ue * 1.4)
    const lu = Math.sin(Zo) * 6e-3 * yr
    const de = (Math.sin(2 * Zo) * 42e-4 - Math.pow(0.5 + 0.5 * Math.cos(2 * Zo + 0.6), 4) * 48e-4) * yr
    const te = lerp(1, 0.3, ke), he = clock
    for (const s of [kZ, kP, kY, kR, bump]) stepSpring(s, 0, dt)
    const ge = (input.key('d') ? 1 : 0) - (input.key('a') ? 1 : 0), ye = (input.key('w') ? 1 : 0) - (input.key('s') ? 1 : 0)
    const px = lerp(EU.p[0], QV.p[0], ke) + TU.p[0] * Ue + NU.p[0] * ct + lu + Math.sin(he * 0.85 + 1) * 12e-4 * te - ge * 4e-3 * Le
    const py = lerp(EU.p[1], QV.p[1], ke) + TU.p[1] * Ue + NU.p[1] * ct + de + Math.sin(he * 1.7) * 16e-4 * te + bump.x * 0.6
    const pz = lerp(EU.p[2], QV.p[2], ke) + TU.p[2] * Ue + NU.p[2] * ct + kZ.x * 0.55 + ye * 4e-3 * Le * (1 - Ue)
    const rx = EU.r[0] * Le + TU.r[0] * Ue + NU.r[0] * ct - 0.16 * De + Math.sin(he * 1.7 + 0.8) * 35e-4 * te + Math.sin(2 * Zo + 0.5) * 8e-3 * yr + kP.x + bump.x * 1.5
    const ry = EU.r[1] * Le + TU.r[1] * Ue + NU.r[1] * ct + Math.sin(he * 0.6) * 2e-3 * te + Math.sin(Zo) * 0.01 * yr + kY.x
    const rz = EU.r[2] * Le + TU.r[2] * Ue + NU.r[2] * ct + 0.62 * De + Math.sin(Zo) * 0.014 * yr - ge * 0.035 * Le + kR.x + Math.sin(he * 0.5) * 4e-3 * te
    gun.localPosition = [px, py, -pz]
    gun.localRotation = euler(rx, ry, rz)
  })
}
