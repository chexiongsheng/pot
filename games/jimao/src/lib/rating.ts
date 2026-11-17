import type { GameState } from './types'
/** 评级：用时、命中率、是否无重试 */
export function rating(g: GameState, ratings: string[]) {
  const acc = g.stats.shots ? g.stats.hits / g.stats.shots : 0
  const score = (g.time < 270 ? 2 : g.time < 400 ? 1 : 0) + (acc >= 0.5 ? 2 : acc >= 0.3 ? 1 : 0) + (g.retries === 0 ? 1 : 0)
  return { acc, score, label: ratings[Math.min(ratings.length - 1, score)] }
}
