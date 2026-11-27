import type { UIService } from '../ui'
/**
 * 标签的类型（004 第 5.7 节）。实体标签的属性是六个保留属性，加每个系统积木名对应的可选覆盖。
 * M1：系统标签之外的名字也放行（索引签名），游戏自写的积木名、预制件名不报错；
 * M2 由 pot check 生成 .pot/types.d.ts 后去掉索引签名。
 */
import type { Vec3 } from '../host'
import type { Color, Shape } from '../scene'
import type { PotChild, Prefab } from './node'
import type { World } from './world'
import type { BlockMe } from './registry'
import type * as blocks from './blocks'
import type { body } from './blocks/body'

/** 积木覆盖：对象为字段覆盖，true 用默认值，false / null 去掉 */
export type Over<T> = Partial<T> | boolean | null

/** 游戏自写积木的属性覆盖：由 pot check / pot types 生成到 .pot/types.d.ts，以声明合并补进来 */
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface GameBlockProps {}

/**
 * e.b 上各积木的数据类型（属性与状态合在一起，即钩子里的 me）：套件以声明合并补进来，
 * 如 moveFps: BlockMe<typeof moveFps>。字段不写可选：实体上有没有这个积木由调用方判断（同改造前的 any）。
 */
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface GameBlockData {}

/** 系统积木在 e.b 上的数据类型 */
export interface BuiltinBlockData {
  shape: BlockMe<typeof blocks.shape>
  spin: BlockMe<typeof blocks.spin>
  trigger: BlockMe<typeof blocks.trigger>
  lifetime: BlockMe<typeof blocks.lifetime>
  projectile: BlockMe<typeof blocks.projectile>
  light: BlockMe<typeof blocks.light>
  body: BlockMe<typeof body>
}

/** e.b 的类型：声明过的积木按名字带类型，其余积木名放行 */
export type BlockDataOf = BuiltinBlockData & GameBlockData & { [block: string]: Record<string, any> }

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
  body?: Over<{ shape: 'box' | 'sphere' | 'capsule'; size: Vec3; radius: number; height: number; center: Vec3; layer: string; solid: boolean }>
}

export interface EntityProps extends BuiltinBlockProps, GameBlockProps {
  key?: string | number | null
  at?: Vec3
  rot?: Vec3
  scale?: number | Vec3
  name?: string
  tags?: string[]
  /** 进入新的流程状态时保留（不销毁重建）：新状态的场景里还有同一 key 时照常对比属性，没有了才删 */
  keep?: boolean
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
  /** 不透明度 0 到 1，乘到自身与全部子孙上 */
  opacity?: number
}

/** 字重 100 到 900（优先于 bold） */
export type UIWeight = number | 'normal' | 'bold'

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
  weight?: UIWeight
  /** 字距，单位 em */
  spacing?: number
  /** 1 像素投影 */
  shadow?: boolean
  wrap?: boolean
  align?: 'left' | 'center' | 'right'
  children?: PotChild
}

export interface ButtonProps extends UIBoxProps {
  emit?: string
  payload?: any
  onPress?: () => void
  /** 指针移入时调一次 */
  onHover?: () => void
  disabled?: boolean
  size?: number
  bold?: boolean
  weight?: UIWeight
  spacing?: number
  shadow?: boolean
  color?: Color
  hoverColor?: Color
  bg?: Color
  /** 悬停时的底色；不写时在 bg 上叠一层白 */
  hoverBg?: Color
  border?: Color | { color: Color; width?: number }
  radius?: number
  children?: PotChild
}

export interface SliderProps extends UIBoxProps {
  value: number
  min?: number
  max?: number
  /** 步长：方向键每次的增减（缺省为范围的 1/20）；给了时拖动也对齐 */
  step?: number
  onChange?: (value: number) => void
  disabled?: boolean
  color?: Color
  bg?: Color
  knob?: Color
}

export interface CanvasProps extends UIBoxProps {
  /** d 为 ctx.ui；box.alpha 为沿树累乘的 opacity */
  draw: (d: UIService, box: { x: number; y: number; w: number; h: number; alpha: number }) => void
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
  slider: SliderProps
  canvas: CanvasProps
  [tag: string]: any
}
