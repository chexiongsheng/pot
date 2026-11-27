/** 机甲的目标：按标签找（通常是 player），眼睛与躯干位置读 fps 的 moveFps，血量读 health */
import type { Vec3, World, EntityData } from '@pot/core'

/** 只是查找缓存（不是状态）：关卡有几百个碰撞实体，不能每步都全表查询 */
const cache = new WeakMap<object, Map<string, number>>()

/** 带 tag 的第一个实体；没有时为 undefined */
export function findTarget(w: World, tag: string): EntityData | undefined {
  let m = cache.get(w)
  if (!m) cache.set(w, (m = new Map()))
  const id = m.get(tag)
  if (id !== undefined && id >= 0) {
    const e = w.get(id)
    if (e && e.tags.includes(tag)) return e
  }
  const found = w.query(tag)[0]
  m.set(tag, found ? found.id : -1)
  return found
}

/** 目标的眼睛（相机）位置 */
export const eyeOf = (t: EntityData): Vec3 => [t.pos[0], t.pos[1] + (t.b.moveFps?.curEye ?? 1.6), t.pos[2]]

/** 目标受击判定的中心（躯干） */
export const chestOf = (t: EntityData): Vec3 => [t.pos[0], t.pos[1] + (t.b.moveFps?.curHeight ?? 1.8) * 0.6, t.pos[2]]

/** 目标血量；没有 health 时当作活着 */
export const hpOf = (t: EntityData): number => (t.b.health ? t.b.health.hp : 1)
