/**
 * 标签的类型（004 第 5.7 节）。实体标签的属性是六个保留属性，加每个系统积木名对应的可选覆盖。
 * M1：系统标签之外的名字也放行（索引签名），游戏自写的积木名、预制件名不报错；
 * M2 由 pot check 生成 .pot/types.d.ts 后去掉索引签名。
 */
import type { Vec3 } from '../host'
import type { Color, Shape } from '../scene'
import type { PotChild, Prefab } from './node'
import type { World } from './world'

/** 积木覆盖：对象为字段覆盖，true 用默认值，false / null 去掉 */
type Over<T> = Partial<T> | boolean | null

export interface BuiltinBlockProps {
  shape?: Over<{ kind: Shape; color: Color; scale: number | Vec3 }>
  spin?: Over<{ speed: number }>
  moveTopdown?: Over<{ speed: number }>
  trigger?: Over<{ radius: number; box: Vec3 | null }>
  lifetime?: Over<{ seconds: number }>
  projectile?: Over<{ speed: number; dir: Vec3 }>
  cameraFollow?: Over<{ offset: Vec3 }>
  light?: Over<{ color: Color; intensity: number; range: number }>
}

export interface EntityProps extends BuiltinBlockProps {
  key?: string | number | null
  at?: Vec3
  rot?: Vec3
  scale?: number | Vec3
  name?: string
  tags?: string[]
  /** 游戏自写的积木（M1 放行） */
  [block: string]: any
}

export interface StageProps {
  background?: Color
  /** 平行光：欧拉角，或 { rot, intensity, color }；false 不要 */
  sun?: Vec3 | { rot?: Vec3; intensity?: number; color?: Color } | false | null
  camera?: { at?: Vec3; look?: Vec3 }
}

/** touch 的参数为 (w, a 侧实体, b 侧实体)，death 为 (w, 实体)，every 为 (w)，自定义事件为 (w, payload) */
export interface RuleProps {
  on: 'touch' | 'death' | 'every' | (string & {})
  a?: string | Prefab
  b?: string | Prefab
  seconds?: number
  do: (w: World, ...args: any[]) => unknown
}

export type UIAnchor = 'top-left' | 'top' | 'top-right' | 'left' | 'center' | 'right' | 'bottom-left' | 'bottom' | 'bottom-right'

export interface TextProps {
  at?: UIAnchor | [number, number]
  size?: number
  color?: Color
  bold?: boolean
  children?: PotChild
}

export interface PotIntrinsicElements {
  entity: EntityProps
  stage: StageProps
  rule: RuleProps
  text: TextProps
  [tag: string]: any
}
