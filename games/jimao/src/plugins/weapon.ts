/** 武器 KR-7：射线射击、扩散、后坐力、换弹、瞄准、枪模、曳光与命中火花 */
import type { Context, Entity, MaterialOptions, SpawnOptions, Vec3 } from '@pot/core'
import { emit, on, type BulletHit } from '../lib/bus'
import { ENEMY_LAYER, LEVEL_LAYER, VIEW_LAYER } from '../lib/level'
import { clamp, damp, forward, jitter, lerp } from '../lib/math'
import { sfx } from '../lib/sfx'
import { gunmetal, polymer, upload } from '../lib/textures'
import { game, player, WEAPON, eyeOf, type WeaponState } from '../lib/types'

export const name = 'weapon'

const HIP: Vec3 = [0.2, -0.2, 0.42]
const ADS: Vec3 = [0, -0.118, 0.3]

export function apply(ctx: Context) {
  const W = ctx.data.load('tuning.json').weapon
  const fresh = (): WeaponState => ({ mag: W.mag, reserve: W.reserve, reloading: false, reloadT: 0, reloadTotal: 0, ads: 0, cooldown: 0, bloom: 0, recoilP: 0, recoilY: 0, kick: 0, spread: W.spread })
  const w = ctx.state.define<WeaponState>(WEAPON, { version: 1, init: fresh })
  const { scene } = ctx
  const cam = scene.camera
  const rand = Math.random

  // ---- 枪模（挂在相机下，单独一层，不进平面反射） ----
  const gun = scene.spawn({ shape: 'empty', name: 'viewmodel', parent: cam, position: HIP })
  const metalSet = upload(ctx, gunmetal(256))
  const polySet = upload(ctx, polymer(256))
  const metal: MaterialOptions = { ...metalSet, smoothness: 0.7, metallic: 1, uv: 'object', tiling: [2, 2], shadows: false, wet: 0 }
  const poly: MaterialOptions = { ...polySet, smoothness: 0.7, metallic: 1, uv: 'object', tiling: [2, 2], shadows: false, wet: 0 }
  const part = (pos: Vec3, size: Vec3, color: string, material: MaterialOptions = metal, extra: Partial<SpawnOptions> = {}) =>
    scene.spawn({ parent: gun, name: 'gun', position: pos, scale: size, color, material, collider: false, layer: VIEW_LAYER, ...extra })
  const cyl = (pos: Vec3, d: number, len: number, color: string, material: MaterialOptions = metal) =>
    part(pos, [d, len / 2, d], color, material, { shape: 'cylinder', rotation: [90, 0, 0] })
  // 机匣（上/下）、拉机柄、抛壳窗
  part([0, 0.012, 0.02], [0.058, 0.066, 0.36], '#5a5f64')
  part([0, -0.042, -0.01], [0.052, 0.05, 0.22], '#5a5f64')
  part([0, 0.03, -0.165], [0.05, 0.022, 0.03], '#5a5f64')
  part([0.0295, 0.02, 0.0], [0.002, 0.026, 0.07], '#2a2c2e')
  // 顶部皮卡汀尼导轨：底条 + 横齿
  part([0, 0.049, 0.05], [0.024, 0.008, 0.42], '#50555a')
  for (let i = 0; i < 22; i++) part([0, 0.056, -0.135 + i * 0.0175], [0.03, 0.006, 0.0085], '#50555a')
  // M-LOK 护木与侧面开槽
  part([0, 0.008, 0.36], [0.064, 0.064, 0.3], '#4a4f54')
  for (const sx of [-1, 1]) for (let i = 0; i < 5; i++) part([sx * 0.0325, 0.0, 0.25 + i * 0.05], [0.002, 0.012, 0.03], '#111214', poly)
  part([0, -0.026, 0.36], [0.05, 0.004, 0.28], '#3e4246')
  // 枪管与制退器
  cyl([0, 0.006, 0.56], 0.02, 0.12, '#45494d')
  cyl([0, 0.006, 0.64], 0.032, 0.06, '#3a3d40')
  for (const sx of [-1, 1]) part([sx * 0.0165, 0.006, 0.645], [0.002, 0.016, 0.03], '#0d0e0f', poly)
  // 侧挂战术手电
  cyl([0.044, 0.004, 0.42], 0.026, 0.1, '#3a3d40')
  part([0.044, 0.004, 0.4705], [0.022, 0.022, 0.002], '#d8e4ff', { mode: 'unlit', shadows: false })
  // 弹匣（略弧）、握把、扳机护圈、枪托与缓冲管
  const mag = scene.spawn({ shape: 'empty', name: 'mag', parent: gun, position: [0, -0.07, 0.07] })
  scene.spawn({ parent: mag, name: 'gun', position: [0, -0.04, 0], rotation: [8, 0, 0], scale: [0.046, 0.09, 0.075], color: '#ffffff', material: poly, collider: false, layer: VIEW_LAYER })
  scene.spawn({ parent: mag, name: 'gun', position: [0, -0.115, 0.016], rotation: [18, 0, 0], scale: [0.046, 0.07, 0.072], color: '#ffffff', material: poly, collider: false, layer: VIEW_LAYER })
  part([0, -0.09, -0.08], [0.042, 0.11, 0.055], '#ffffff', poly, { rotation: [-16, 0, 0] })
  part([0, -0.075, -0.02], [0.012, 0.004, 0.07], '#45494d')
  cyl([0, 0.01, -0.24], 0.03, 0.12, '#45494d')
  part([0, -0.01, -0.33], [0.05, 0.085, 0.13], '#ffffff', poly)
  part([0, -0.01, -0.398], [0.054, 0.1, 0.012], '#2a2c2e', poly)
  // 全息红点镜：底座、外壳框、镜片、红点（视线高度 ADS 时 y≈0.118）
  part([0, 0.066, 0.06], [0.04, 0.012, 0.08], '#45494d')
  part([0, 0.083, 0.035], [0.05, 0.026, 0.03], '#45494d')
  part([0, 0.156, 0.075], [0.056, 0.008, 0.07], '#45494d')
  for (const sx of [-1, 1]) part([sx * 0.026, 0.115, 0.075], [0.006, 0.082, 0.07], '#45494d')
  part([0, 0.075, 0.075], [0.056, 0.008, 0.07], '#45494d')
  part([0, 0.115, 0.108], [0.046, 0.074, 0.002], '#ff8a70', { mode: 'lit-fade', smoothness: 0.95, metallic: 0.2, shadows: false }, { shape: 'quad', scale: [0.046, 0.074, 1] })
  part([0, 0.118, 0.106], [0.003, 0.003, 1], '#000000', { mode: 'lit', emission: '#ff2a1a', emissionIntensity: 12, shadows: false }, { shape: 'quad' })
  const muzzle = scene.spawn({ shape: 'empty', name: 'muzzle', parent: gun, position: [0, 0.006, 0.68] })
  const flash = scene.spawn({ shape: 'quad', name: 'flash', parent: muzzle, scale: 0.16, color: '#ffcf7a', material: { mode: 'additive', shadows: false }, collider: false, layer: VIEW_LAYER, active: false })
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
    const reloadDip = w.reloading ? Math.sin(Math.PI * clamp(w.reloadT / w.reloadTotal, 0, 1)) : 0
    const sway = Math.sin(p.bob * Math.PI) * 0.012 * (1 - a) * Math.min(1, p.speed / 4)
    gun.localPosition = [lerp(HIP[0], ADS[0], a) + sway, lerp(HIP[1], ADS[1], a) - reloadDip * 0.12 - Math.abs(sway) * 0.5, lerp(HIP[2], ADS[2], a) - w.kick * 0.045]
    gun.localRotation = [-w.kick * 4 + reloadDip * 35, p.sprinting ? -25 : 0, p.sprinting ? 12 : reloadDip * -20]
    mag.localPosition = [0, -0.07 - (reloadDip > 0.6 ? (reloadDip - 0.6) * 0.6 : 0), 0.07]
  })
}
