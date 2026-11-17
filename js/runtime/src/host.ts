/**
 * 宿主抽象：runtime 只通过 Host 接触外部世界（日志、文件、引擎、GC）。
 * Unity 中由 unity.ts 基于 CS.Pot.* 实现；Node 测试中由 mock 实现。
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export type Vec3 = [number, number, number]

/** 引擎桥：只用数字 id 引用引擎对象，不把引擎对象交给游戏代码 */
export interface Engine {
  /** shape: cube/sphere/capsule/cylinder/plane/quad/empty；parent 为 0 表示无父节点；返回对象 id */
  spawn(shape: string, name: string, parent: number): number
  destroy(id: number): void
  exists(id: number): boolean
  setVec(id: number, prop: VecProp, x: number, y: number, z: number): void
  getVec(id: number, prop: VecProp): Vec3
  setColor(id: number, r: number, g: number, b: number, a: number): void
  setActive(id: number, active: boolean): void
  lookAt(id: number, x: number, y: number, z: number): void
  /** 给对象加灯光组件。type: directional/point/spot */
  light(id: number, type: string, intensity: number, r: number, g: number, b: number, range: number): void
  /** 主相机 id（不归任何插件所有，不能 destroy） */
  cameraId(): number
  setBackground(r: number, g: number, b: number): void
  /** 输入轴：move（WASD/方向键）、look（鼠标） */
  axis(name: string): [number, number]
  /** mode: 0 按住，1 本帧按下，2 本帧抬起 */
  key(name: string, mode: number): boolean
  /** 当前存活的、由 pot 创建的对象数（泄漏检查用） */
  count(): number
}

export type VecProp = 'position' | 'rotation' | 'scale' | 'localPosition'

export interface Host {
  platform: 'unity' | 'node'
  log(level: LogLevel, text: string): void
  /** 读游戏文件（GameFS 相对路径，如 manifest.json、units/player.cjs、data/levels/1.json）。不存在返回 null */
  readText(path: string): string | null
  /** 写入 GameFS 内存覆盖层（仅开发期）；content 为 null 表示删除 */
  writeText?(path: string, content: string | null): void
  /** 请求一次 GC。Unity 中在下一帧生效，调用方应等待帧后再检查 WeakRef */
  gc?(): void
  /** 开发通道：向 Dev Server 发送消息（仅开发期） */
  send?(message: string): void
  engine: Engine
}
