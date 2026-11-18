/** 武器 KR-7：射线射击、扩散、后坐力、换弹、瞄准、枪模、曳光与命中火花 */
import type { Context, Entity, MaterialOptions, Vec3 } from '@pot/core'
import { emit, on, type BulletHit } from '../lib/bus'
import { linearColor, toMesh, type RGB } from '../lib/geo'
import { buildPac9, PAC9 } from '../lib/gun'
import { ENEMY_LAYER, LEVEL_LAYER, VIEW_LAYER } from '../lib/level'
import { clamp, damp, forward, jitter, lerp } from '../lib/math'
import { sfx } from '../lib/sfx'
import { game, player, WEAPON, eyeOf, type WeaponState } from '../lib/types'

export const name = 'weapon'

// 枪模姿态（Unity 坐标，相对相机）：原版 PAC9 的腰射/瞄准位置，瞄准时视线正对全息镜窗口中心（sightY）
const HIP: Vec3 = [0.118, -0.122, 0.275]
const HIP_ROT: Vec3 = [-1.95, -4.87, -1.72]
const ADS: Vec3 = [0, -PAC9.sightY, 0.135]
/** 原版枪模用独立相机渲染（固定 54°），这里把枪模父节点的 XY 按 tan(fov/2)/tan(54°/2) 缩放，屏幕投影与原版一致 */
const VIEW_FOV = 54
const u = (p: readonly number[]): Vec3 => [p[0], p[1], -p[2]]

export function apply(ctx: Context) {
  const W = ctx.data.load('tuning.json').weapon
  const T = ctx.data.load('tuning.json').player
  const fresh = (): WeaponState => ({ mag: W.mag, reserve: W.reserve, reloading: false, reloadT: 0, reloadTotal: 0, ads: 0, cooldown: 0, bloom: 0, recoilP: 0, recoilY: 0, kick: 0, spread: W.spread })
  const w = ctx.state.define<WeaponState>(WEAPON, { version: 1, init: fresh })
  const { scene } = ctx
  const cam = scene.camera
  const rand = Math.random

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
  const fovRoot = scene.spawn({ shape: 'empty', name: 'viewmodel-fov', parent: cam })
  const gun = scene.spawn({ shape: 'empty', name: 'viewmodel', parent: fovRoot, position: HIP, rotation: HIP_ROT })
  const part = (key: string, parent: Entity, m: { color: Vec3; material: MaterialOptions }) =>
    scene.spawn({ shape: `mesh:pac9-${key}`, name: 'gun', parent, color: m.color, material: m.material, collider: false, layer: VIEW_LAYER })
  part('ano', gun, anodised)
  part('gun', gun, phosphate)
  part('poly', gun, polymer)
  part('plain', gun, matte)
  part('bolt', gun, phosphate)
  const MAG = u(PAC9.magPos)
  const mag = scene.spawn({ shape: 'empty', name: 'mag', parent: gun, position: MAG })
  part('mag', mag, tan)
  part('round', mag, brass)
  // 全息镜：镜片（窗口略放大）+ 红点，位于视线高度 sightY、镜窗前后位置 lensF
  const win = PAC9.window
  const ww = (win[1][0] - win[0][0]) * 1.01, wh = (win[3][1] - win[0][1]) * 1.01
  scene.spawn({ shape: 'quad', name: 'lens', parent: gun, position: [0, PAC9.sightY, PAC9.lensF + 0.0025], scale: [ww, wh, 1], color: [0.55, 0.6, 0.55, 0.12], material: { mode: 'lit-fade', smoothness: 0.95, metallic: 0.2, shadows: false }, collider: false, layer: VIEW_LAYER })
  scene.spawn({ shape: 'quad', name: 'reticle', parent: gun, position: [0, PAC9.sightY, PAC9.lensF + 0.002], scale: 0.0012, color: '#000000', material: { mode: 'lit', emission: '#ff2a1a', emissionIntensity: 12, shadows: false }, collider: false, layer: VIEW_LAYER })
  const muzzle = scene.spawn({ shape: 'empty', name: 'muzzle', parent: gun, position: u(PAC9.muzzle) })
  const flash = scene.spawn({ shape: 'quad', name: 'flash', parent: muzzle, scale: 0.12, color: '#ffcf7a', material: { mode: 'additive', shadows: false }, collider: false, layer: VIEW_LAYER, active: false })
  const flashLight = scene.light({ type: 'point', name: 'muzzle-light', parent: muzzle, intensity: 0, range: 7, color: '#ffbe6a' })

  // ---- 曳光池 ----
  const tracers: { e: Entity; life: number }[] = []
  for (let i = 0; i < 8; i++) tracers.push({ e: scene.spawn({ name: 'tracer', scale: [0.018, 0.018, 1], color: '#ffd9a0', material: { mode: 'additive', shadows: false }, collider: false, active: false }), life: 0 })
  let ti = 0
  let flashT = 0
  let reloadClick = 0

  on(ctx, 'jimao/reset', (keep) => {
    const m = w.mag, r = w.reserve
    Object.assign(w, fresh())
    if (keep) { w.mag = Math.max(m, W.mag); w.reserve = Math.max(r, W.reserve) }
  })

  function startReload() {
    if (w.reloading || w.mag >= W.mag || w.reserve <= 0) return
    w.reloading = true
    w.reloadTotal = w.mag === 0 ? W.reloadEmpty : W.reloadTactical
    w.reloadT = 0
    reloadClick = 0
    ctx.audio.play(sfx('reload'), { volume: 0.6, pitch: W.reloadTactical / w.reloadTotal * 1.6 })
  }

  function fire(origin: Vec3, yaw: number, pitch: number, moving: boolean) {
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
    // 瞄准
    const wantAds = locked && input.key('mouse1') && !p.sprinting
    w.ads = clamp(w.ads + (wantAds ? 1 : -1) * dt / W.adsTime, 0, 1)
    // 换弹
    if (input.pressed('r')) startReload()
    if (w.reloading) {
      w.reloadT += dt
      if (reloadClick === 0 && w.reloadT > w.reloadTotal * 0.7) { reloadClick = 1; ctx.audio.play(sfx('dry'), { volume: 0.6, pitch: 1.4 }) }
      if (w.reloadT >= w.reloadTotal) {
        const need = W.mag - w.mag
        const take = Math.min(need, w.reserve)
        w.mag += take
        w.reserve -= take
        w.reloading = false
      }
    }
    // 射击
    w.cooldown = Math.max(-0.02, w.cooldown - dt)
    const trigger = locked && input.key('mouse0')
    if (trigger && !w.reloading) {
      if (w.mag <= 0) {
        if (input.pressed('mouse0')) ctx.audio.play(sfx('dry'), { volume: 0.5 })
        if (w.reserve > 0) startReload()
      } else {
        p.sprinting = false
        const origin = eyeOf(p)
        const moving = p.speed > 1
        let shots = 0
        while (w.cooldown <= 0 && w.mag > 0 && shots++ < 3) fire(origin, p.yaw + w.recoilY, p.pitch + w.recoilP, moving)
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
    // 枪模位置：瞄准插值 + 后坐 + 换弹下沉 + 冲刺倾斜
    const a = w.ads
    const fov = (g.settings.fov ?? T.fov) + (T.fovAds - T.fov) * a + (p.sprinting ? T.fovSprint : 0)
    const k = Math.tan(fov * Math.PI / 360) / Math.tan(VIEW_FOV * Math.PI / 360)
    fovRoot.scale = [k, k, 1]
    const reloadDip = w.reloading ? Math.sin(Math.PI * clamp(w.reloadT / w.reloadTotal, 0, 1)) : 0
    const sway = Math.sin(p.bob * Math.PI) * 0.008 * (1 - a) * Math.min(1, p.speed / 4)
    gun.localPosition = [lerp(HIP[0], ADS[0], a) + sway, lerp(HIP[1], ADS[1], a) - reloadDip * 0.08 - Math.abs(sway) * 0.5, lerp(HIP[2], ADS[2], a) - w.kick * 0.03]
    gun.localRotation = [lerp(HIP_ROT[0], 0, a) - w.kick * 4 + reloadDip * 35, lerp(HIP_ROT[1], 0, a) + (p.sprinting ? -25 : 0), lerp(HIP_ROT[2], 0, a) + (p.sprinting ? 12 : reloadDip * -20)]
    mag.localPosition = [MAG[0], MAG[1] - (reloadDip > 0.6 ? (reloadDip - 0.6) * 0.5 : 0), MAG[2]]
  })
}
