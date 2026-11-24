/**
 * 官方积木（004 第 15.11 节）。写法与游戏自写的积木完全相同，只用公开的低层 API。
 * 在 WorldService 构造时登记；游戏登记同名积木时覆盖这里的，撤销后露出这里的。
 */
import { defineBlock } from '../registry'
import type { Vec3 } from '../../host'
import type { Color, Shape } from '../../scene'

/** 外形：进入时 scene.spawn 一个图元，跟随实体的变换（缩放乘以 scale） */
export const shape = defineBlock({
  name: 'shape',
  about: '外形：kind 为 scene.spawn 支持的形状（cube、sphere、plane、cylinder、capsule、quad 或 mesh:名字），color 颜色，scale 相对实体的缩放',
  props: { kind: 'cube' as Shape, color: '#ffffff' as Color, scale: 1 as number | Vec3 },
  view: {
    enter(me, e, ctx) {
      return ctx.scene.spawn({ shape: me.kind, name: e.name ?? e.prefab, color: me.color, scale: me.scale, position: e.pos, rotation: e.rot })
    },
  },
})

/** 绕 y 轴匀速旋转（度每秒） */
export const spin = defineBlock({
  name: 'spin',
  about: '绕 y 轴旋转，speed 为度每秒',
  props: { speed: 90 },
  step(me, e, w) {
    e.rot[1] = (e.rot[1] + me.speed * w.dt) % 360
  },
})

/** 俯视角移动：读 move 轴，x 轴对应世界 x，y 轴对应世界 z */
export const moveTopdown = defineBlock({
  name: 'moveTopdown',
  about: '俯视角移动：读指令轴 move，按 speed（米每秒）改 pos 的 x、z',
  props: { speed: 5 },
  step(me, e, w) {
    const { x, y } = w.cmd(e).axis('move')
    if (!x && !y) return
    e.pos[0] += x * me.speed * w.dt
    e.pos[2] += y * me.speed * w.dt
  },
})

/** 触发区：由 WorldService 的触发检测读取（15.9），本身没有逻辑 */
export const trigger = defineBlock({
  name: 'trigger',
  about: '触发区：radius 为球半径（米，0 表示中心点），box 给了 [x, y, z] 时按轴对齐盒判定；两个触发区开始重叠时发 touch',
  props: { radius: 0.5, box: null as null | Vec3 },
})

/** 到时销毁 */
export const lifetime = defineBlock({
  name: 'lifetime',
  about: '存活 seconds 秒后销毁',
  props: { seconds: 2 },
  state: { age: 0 },
  step(me, e, w) {
    me.age += w.dt
    if (me.age >= me.seconds) w.destroy(e)
  },
})

/** 匀速直线飞行；dir 为世界方向，内部归一化 */
export const projectile = defineBlock({
  name: 'projectile',
  about: '沿世界方向 dir 以 speed（米每秒）匀速飞行',
  props: { speed: 10, dir: [0, 0, 1] as Vec3 },
  step(me, e, w) {
    const [x, y, z] = me.dir
    const len = Math.hypot(x, y, z)
    if (!len) return
    const k = (me.speed * w.dt) / len
    e.pos[0] += x * k
    e.pos[1] += y * k
    e.pos[2] += z * k
  },
})

/** 相机跟随：每帧把相机放到实体插值位置加 offset，并看向实体 */
export const cameraFollow = defineBlock({
  name: 'cameraFollow',
  about: '相机跟随：相机放在实体位置加 offset 处并看向实体（每帧，按插值后的位置）',
  props: { offset: [0, 12, -10] as Vec3 },
  view: {
    update(me, e, _objs, ctx, w) {
      const prev = w.prev.get(e.id)?.pos ?? e.pos
      const a = ctx.clock.fixedAlpha
      const p: Vec3 = [prev[0] + (e.pos[0] - prev[0]) * a, prev[1] + (e.pos[1] - prev[1]) * a, prev[2] + (e.pos[2] - prev[2]) * a]
      const o = me.offset
      const cam = ctx.scene.camera
      cam.position = [p[0] + o[0], p[1] + o[1], p[2] + o[2]]
      cam.lookAt(p)
    },
  },
})

/** 点光源，跟随实体 */
export const light = defineBlock({
  name: 'light',
  about: '点光源：color 颜色，intensity 强度，range 照射范围（米）',
  props: { color: '#ffffff' as Color, intensity: 1, range: 10 },
  view: {
    enter(me, e, ctx) {
      return ctx.scene.light({ type: 'point', name: e.name ?? `${e.prefab} light`, color: me.color, intensity: me.intensity, range: me.range, position: e.pos })
    },
  },
})

export const BUILTIN_BLOCKS = [shape, spin, moveTopdown, trigger, lifetime, projectile, cameraFollow, light]
