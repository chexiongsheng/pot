/**
 * fiber → 单元名 的标记。plugins 服务在挂载单元时标记 fiber，
 * state/data/scene 通过调用方 ctx 沿 fiber 链向上查找所属单元。
 * 用 WeakMap，fiber 释放后标记自动消失。
 */
import type { Context, Fiber } from 'cordis'

const marks = new WeakMap<Fiber, string>()

export function markFiber(fiber: Fiber, unit: string) {
  marks.set(fiber, unit)
}

export function unitOfFiber(fiber: Fiber | undefined): string | undefined {
  const seen = new Set<Fiber>()
  while (fiber && !seen.has(fiber)) {
    seen.add(fiber)
    const name = marks.get(fiber)
    if (name) return name
    fiber = fiber.parent?.fiber
  }
}

/** 调用方 ctx 所属单元；不在任何单元内（如宿主、devtools）时返回 undefined */
export function unitOf(ctx: Context): string | undefined {
  return unitOfFiber(ctx?.fiber)
}

/** 从 fiber 向上的祖先链（不含自身） */
export function ancestors(fiber: Fiber): Fiber[] {
  const result: Fiber[] = []
  const seen = new Set<Fiber>([fiber])
  let current = fiber.parent?.fiber
  while (current && !seen.has(current)) {
    seen.add(current)
    result.push(current)
    current = current.parent?.fiber
  }
  return result
}
