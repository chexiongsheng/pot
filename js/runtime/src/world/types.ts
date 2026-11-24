/**
 * 标签的类型。M1：官方标签之外的名字也放行（索引签名），游戏自写的积木名不报错；
 * M2 由 pot check 生成 .pot/types.d.ts 后去掉索引签名。
 */

export interface PotIntrinsicElements {
  [tag: string]: any
}
