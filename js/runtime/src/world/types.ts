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
export type Over<T> = Partial<T> | boolean | null

/** 游戏自写积木的属性覆盖：由 pot check / pot types 生成到 .pot/types.d.ts，以声明合并补进来 */
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface GameBlockProps {}

/** w.vars 的类型：由 pot check / pot types 按运行时的 vars 生成 */
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface GameVars {}

/** 生成过类型时 w.vars 就是 GameVars（新变量要先写进 defineGame 的 vars）；没生成过时放行任意字段 */
export type VarsOf = keyof GameVars extends never ? Record<string, any> : GameVars

export interface BuiltinBlockProps {
  shape?: Over<{ kind: Shape; color: Color; scale: number | Vec3 }>
  spin?: Over<{ speed: number }>
  trigger?: Over<{ radius: number; box: Vec3 | null }>
  lifetime?: Over<{ seconds: number }>
  projectile?: Over<{ speed: number; dir: Vec3 }>
  light?: Over<{ color: Color; intensity: number; range: number }>
}

export interface EntityProps extends BuiltinBlockProps, GameBlockProps {
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

/** 所有界面标签共有的属性（16.4） */
export interface UIBoxProps {
  key?: string | number | null
  /** 只对顶层节点有效：九宫格位置名或 [x, y] */
  at?: UIAnchor | [number, number]
  /** 像素或 'NN%' */
  w?: number | `${number}%`
  h?: number | `${number}%`
  grow?: number
  pad?: number | [number, number] | [number, number, number, number]
  hidden?: boolean
}

export interface UIContainerProps extends UIBoxProps {
  gap?: number
  align?: 'start' | 'center' | 'end' | 'stretch'
  justify?: 'start' | 'center' | 'end' | 'between'
  children?: PotChild
}

export interface PanelProps extends UIContainerProps {
  bg?: Color
  border?: Color | { color: Color; width?: number }
  radius?: number
}

export interface TextProps extends UIBoxProps {
  size?: number
  color?: Color
  bold?: boolean
  wrap?: boolean
  align?: 'left' | 'center' | 'right'
  children?: PotChild
}

export interface ButtonProps extends UIBoxProps {
  emit?: string
  payload?: any
  onPress?: () => void
  disabled?: boolean
  size?: number
  bold?: boolean
  color?: Color
  bg?: Color
  radius?: number
  children?: PotChild
}

export interface BarProps extends UIBoxProps {
  value: number
  max?: number
  color?: Color
  bg?: Color
  radius?: number
}

export interface ImageProps extends UIBoxProps {
  src: { id: number; width: number; height: number } | null | undefined
  fit?: 'fill' | 'contain' | 'cover'
  tint?: Color
  radius?: number
}

export interface InputProps extends UIBoxProps {
  value: string
  onChange?: (value: string) => void
  onSubmit?: (value: string) => void
  placeholder?: string
  max?: number
  size?: number
  bold?: boolean
  color?: Color
  bg?: Color
  radius?: number
}

export interface PotIntrinsicElements {
  entity: EntityProps
  stage: StageProps
  rule: RuleProps
  text: TextProps
  column: UIContainerProps
  row: UIContainerProps
  panel: PanelProps
  scroll: UIContainerProps
  button: ButtonProps
  bar: BarProps
  image: ImageProps
  input: InputProps
  [tag: string]: any
}
