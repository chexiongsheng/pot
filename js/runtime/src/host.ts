/**
 * 宿主抽象：runtime 只通过 Host 接触外部世界（日志、文件、引擎、GC）。
 * Unity 中由 unity.ts 基于 CS.Pot.* 实现；Node 测试中由 mock 实现。
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export type Vec3 = [number, number, number]

/** 引擎桥：只用数字 id 引用引擎对象，不把引擎对象交给游戏代码 */
export interface Engine {
  /** shape: cube/sphere/capsule/cylinder/plane/quad/empty、mesh:名字、skin:名字（蒙皮，之后调 skin 绑骨骼）；parent 为 0 表示无父节点；返回对象 id */
  spawn(shape: string, name: string, parent: number): number
  destroy(id: number): void
  exists(id: number): boolean
  setVec(id: number, prop: VecProp, x: number, y: number, z: number): void
  /**
   * 批量设置变换。ids 为 Int32 对象 id；data 每个对象 10 个 Float32（位置 xyz、四元数 xyzw、缩放 xyz）。
   * flags：bit0 位置、bit1 旋转、bit2 缩放、bit3 位置与旋转按局部空间。返回实际写入的对象数
   */
  setTransforms(ids: ArrayBuffer, data: ArrayBuffer, count: number, flags: number): number
  /** 开关渲染（碰撞体不受影响） */
  visible(id: number, visible: boolean): void
  /** 给 spawn('skin:名字') 的对象绑定骨骼（Int32 对象 id，顺序对应骨骼下标）；成功返回空串 */
  skin(id: number, bones: ArrayBuffer): string
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

  // ---- 材质 ----
  /** mode: lit/lit-fade/unlit/unlit-fade/additive（空串不变）；castShadows -1 不变 0 关 1 开 */
  /** cull：-1 不变、0 不剔除、1 正面、2 背面、3 恢复模式默认 */
  material(id: number, mode: string, castShadows: number, cull: number): void
  /** 负数表示不变 */
  surface(id: number, metallic: number, smoothness: number): void
  emission(id: number, r: number, g: number, b: number): void

  // ---- 碰撞与射线 ----
  collider(id: number, enabled: boolean): void
  layer(id: number, layer: number): void
  /** 未命中返回 null；命中非 pot 对象时 id 为 -1 */
  raycast(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, maxDistance: number, mask: number): RaycastResult | null

  // ---- 相机、环境、灯光 ----
  /** 0 或负数表示不变 */
  view(fov: number, near: number, far: number): void
  fog(r: number, g: number, b: number, density: number): void
  ambient(r: number, g: number, b: number, reflection: number): void
  lightOptions(id: number, spotAngle: number, shadows: number): void
  lightIntensity(id: number, intensity: number): void

  // ---- 鼠标与屏幕 ----
  cursor(locked: boolean): void
  cursorLocked(): boolean
  /** 鼠标位置，左上角为原点（像素） */
  mouse(): [number, number]
  screen(): [number, number]
  wheel(): number
  focused(): boolean

  // ---- 2D 绘制 ----
  /** 提交本帧绘制命令（格式见 PotUI.cs） */
  uiSubmit(list: string): void
  /** flags 同 PotUI 文字命令（1 粗体、8 等宽、位 4..7 字重/100），只看字体相关位 */
  uiMeasure(text: string, size: number, flags: number): [number, number]

  // ---- 音频 ----
  audioClip(name: string, rate: number, channels: number, pcm16Base64: string): boolean
  audioHas(name: string): boolean
  audioPlay(name: string, volume: number, pitch: number, x: number, y: number, z: number, spatial: boolean): void
  audioLoop(name: string, volume: number, pitch: number): number
  audioSetLoop(handle: number, volume: number, pitch: number, x: number, y: number, z: number, spatial: boolean): void
  audioStop(handle: number): void
  audioVolume(volume: number): void
  audioPause(paused: boolean): void

  // ---- 贴图、网格、扩展材质 ----
  /** RGBA8 像素（行从下到上）。wrap 0 重复 1 截断；filter 0 点 1 双线性 2 三线性。返回贴图 id */
  texture(data: ArrayBuffer, width: number, height: number, linear: boolean, mipmaps: boolean, wrap: number, filter: number, aniso: number): number
  destroyTexture(id: number): void
  /** 文字转贴图，参数 JSON 见 PotRender.TextTexture；返回贴图 id */
  textTexture(json: string): number
  /**
   * Canvas 文字栅格化：family 为逗号分隔的系统字体名；style bit1 粗体 bit2 斜体。
   * 返回 Float32 头 [w,h,ox,base,adv,ascent,descent,0] + w*h 字节 alpha（行从上到下）；不支持返回 null
   */
  canvasText(text: string, family: string, size: number, style: number): ArrayBuffer | null
  /** 注册网格（Float32 xyz / uv / rgba，Uint32 索引）；key 非空时登记为内容标识；返回顶点数 */
  mesh(name: string, positions: ArrayBuffer, normals: ArrayBuffer | null, uvs: ArrayBuffer | null, colors: ArrayBuffer | null, indices: ArrayBuffer, key: string): number
  /** 同名网格是否已按这个 key 注册过：命中返回顶点数，否则 -1（网格只在冷重启时清空） */
  meshCached(name: string, key: string): number
  /**
   * 给刚注册的网格补蒙皮数据：boneIndices 为 Int32（每顶点 1 到 4 个），weights 为 Float32（null 表示第一根权重 1），
   * bindPoses 为 Float32（每根 16 个，列主序；null 表示单位矩阵）。成功返回空串
   */
  meshSkin(name: string, boneIndices: ArrayBuffer, weights: ArrayBuffer | null, bindPoses: ArrayBuffer | null): string
  /** 用给定切线（Float32 xyzw，每顶点 4 个）替换刚注册网格自动计算的切线。成功返回空串 */
  meshTangents(name: string, tangents: ArrayBuffer): string
  /** 给刚注册的网格写自定义顶点属性：channel 1-7（UV1-UV7），data 为 Float32、每顶点 size（1-4）个，原样存储。成功返回空串 */
  meshAttribute(name: string, channel: number, attr: string, size: number, data: ArrayBuffer): string
  /** slot：map / normal / mask 或着色器属性名；tex 为 0 表示解除 */
  matTexture(id: number, slot: string, tex: number): void
  matFloat(id: number, prop: string, value: number): void
  matVector(id: number, prop: string, x: number, y: number, z: number, w: number): void
  ambientTrilight(sr: number, sg: number, sb: number, er: number, eg: number, eb: number, gr: number, gg: number, gb: number, reflection: number): void
  /** 渲染配置：post / sky / fog / weather / reflection / quality / refresh；返回空串成功，否则为错误信息 */
  render(kind: string, json: string): string
  /** 粒子迸发（JSON 参数见 PotRender.Burst） */
  burst(json: string): void

  // ---- 运行时着色器（PotGfx.cs / native/pot_gfx） ----
  /** 后端名（d3d11）；空串表示不支持 */
  gfxBackend(): string
  /** 运行时着色器不可用的原因（可用时为空串）；旧宿主可不实现 */
  gfxUnsupported?(): string
  /** 编译并注册程序（同名替换）；成功返回空串，失败返回错误且保留旧程序 */
  gfxProgram(name: string, vs: string, fs: string): string
  gfxDestroyProgram(name: string): void
  /** program 为空串表示解除；flags 见 PotGfx.Bind；queue 0 不透明 1 透明 */
  gfxBind(id: number, program: string, flags: number, queue: number, shadows: number): void
  gfxUniform(id: number, name: string, n: number, x: number, y: number, z: number, w: number): void
  gfxUniformArray(id: number, name: string, data: ArrayBuffer): void
  gfxTexture(id: number, name: string, tex: number): void
  /** 开始烘焙：返回临时绑定 id（负数），可用 gfxUniform/gfxUniformArray/gfxTexture 设参数 */
  gfxBakeBegin(): number
  /** 画全屏四边形到新贴图；targets 见 PotGfx.Bake；返回逗号分隔的贴图 id，出错以 ! 开头 */
  gfxBake(bind: number, program: string, width: number, height: number, targets: string, blend: number): string
  /** 设置每帧后处理链（JSON 见 PotGfx.Post），空串关闭；返回空串成功，否则为错误 */
  gfxPost(json: string): string
  /** 开关当前后处理链的第 pass 个 pass；成功返回空串 */
  gfxPostEnable(pass: number, on: boolean): string
}

export interface RaycastResult {
  id: number
  point: Vec3
  normal: Vec3
  distance: number
}

export type VecProp = 'position' | 'rotation' | 'scale' | 'localPosition' | 'localRotation'

export interface Host {
  platform: 'unity' | 'node'
  log(level: LogLevel, text: string): void
  /** 读游戏文件（游戏目录相对路径，如 manifest.json、src/plugins/player.ts、data/levels/1.json）。不存在返回 null */
  readText(path: string): string | null
  /** 请求一次 GC。Unity 中在下一帧生效，调用方应等待帧后再检查 WeakRef */
  gc?(): void
  /** 开发通道：向 Dev Server 发送消息（仅开发期，未连接时丢弃） */
  send?(message: string): void
  /** 宿主每帧调用 runtime 的 pump（Unity 为 true）。为 false 时 loading.frame()/step() 不让帧、立即继续 */
  frames?: boolean
  /** 加载进度回报给外壳（显示加载界面）：progress 0..1，小于 0 表示未知；text 为当前阶段 */
  loading?(progress: number, text: string): void
  engine: Engine
}
