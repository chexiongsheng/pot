# Game API 语义

游戏代码只依赖 `@pot/core`（运行时挂在 `globalThis.pot`）。每个单元自动注入全部核心服务（clock、timer、state、cache、data、scene、input、plugins），不用手写 `inject`。

## ctx.on('update', (dt, time) => {})

每个游戏帧触发。`dt` 为缩放后的秒数（单帧最大 0.1 秒），`time` 为游戏时间。暂停、热重载冻结时不触发。

## ctx.on('fixed-update', (step, fixedTime) => {})

固定步长，在同一帧的 `update` 之前触发。`step` 恒为 `ctx.clock.fixedStep`（默认 1/60 秒，可改）；帧率低时一帧补多步（最多 `clock.maxFixedSteps`，默认 8，超出的时间丢弃并累加到 `clock.fixedDropped`），帧率高时有的帧不触发。移动、碰撞、物理积分这类“步长大了会穿墙”的逻辑放这里，渲染跟随放 `update`，需要平滑时用 `clock.fixedAlpha`（未满一步的比例）在上一步与当前步之间插值。暂停、冻结、`scale` 与 `update` 一致。

## ctx.scene

| API | 说明 |
|---|---|
| `spawn({ shape, name, parent, position, rotation, scale, color, active, collider, layer, visible, bones })` | shape：cube/sphere/capsule/cylinder/plane/quad/empty/`mesh:名字`。返回 `Entity`，随单元卸载自动销毁。`collider: false` 去掉自带碰撞体；`visible: false` 只留碰撞体不渲染（命中盒、触发区）；`bones` 见下方蒙皮 |
| `setTransforms(ids, data, { count, position, rotation, scale, space })` | 批量设置变换，一次跨语言调用。`data` 每个实体 10 个数：位置 xyz、四元数 xyzw、缩放 xyz（Unity 坐标系）。`ids` 传建好后复用的 `Int32Array`（实体 id）则不产生分配，也可传实体数组。默认三项都写、世界空间；缩放始终是本地缩放。同一批里父节点要排在子节点前面。返回实际写入的个数 |
| `light({ type, intensity, color, range, position, rotation, units, distance })` | type：directional/point/spot。`units: 'three'` 时强度按 three.js 物理单位（坎德拉 / 勒克斯）传，运行时按 1/π 换算成 URP 强度，之后 `entity.intensity(v)` 也按同一单位；`distance`（three 的 PointLight.distance）> 0 时作为 range，0 时 URP 仍需有限 `range`（默认 10）。移植 three 场景时直接抄原版数值 |
| `camera` | 主相机 Entity，不能销毁；每次热重载都要重新设置位置 |
| `background(color)` | 纯色背景 |
| `find(name)` / `list(unit?)` | 查找 pot 创建的对象 |
| `raycast(origin, dir, { maxDistance, mask, planes })` | 射线命中碰撞体，返回 `{ id, entity, point, normal, distance }` 或 null；`dir` 不必归一化。`planes` 加入无碰撞体的无限平面一起取最近：`{ y }` 或 `{ point, normal }`，`region`（`minX/maxX/minY/maxY/minZ/maxZ`）限定范围，`twoSided` 双面，命中时 `id` 为 -1，带回 `plane` 下标与 `tag` |

`Entity`：`position`/`rotation`（欧拉角，度）/`scale` 读写都是一次跨语言调用，热点循环里先缓存，成批的改用 `scene.setTransforms`；`move(dx,dy,dz)`、`lookAt(vec|entity)`、`color(c)`、`active(bool)`、`visible(bool)`（只开关渲染，碰撞体与子节点不受影响）、`destroy()`、`alive`。

颜色可用 CSS 写法：`'#rgb'`、`'#rgba'`、`'#rrggbb'`、`'#rrggbbaa'`、`'rgb(255, 128, 0)'`、`'rgba(14,13,12,0.4)'`、`'rgb(255 0 0 / 50%)'`、`'hsl(120, 100%, 50%)'`/`hsla()`、常用颜色名（`white`、`transparent` 等），或 `[r,g,b,a?]`（0 到 1）。scene、ui、uniform 与 Canvas 的 `fillStyle` 共用同一套解析；写错时抛出“无法解析颜色”（Canvas 与浏览器一样忽略无效值）。

### 材质与渲染（URP，Linear 色彩空间）

所有颜色都按 sRGB 传入，Runner 负责转线性。游戏不能带 Unity 着色器或 C#；普通外观通过下列参数表达，参数表达不了的效果用下一节的 GLSL 着色器。

| API | 说明 |
|---|---|
| `spawn({ material })` | `mode`：lit/lit-cutout/lit-twosided/lit-fade/unlit/unlit-fade/additive；`map`/`normalMap`/`maskMap`（mask：R 金属 G AO B 高度 A 光滑）；`smoothness`/`metallic`（与 mask 相乘，用贴图时传 1）；`uv`：mesh/world/object（三平面）；`tiling`/`offset`；`vertexColors`；`emission`/`emissionIntensity`；`wet`（湿润响应，0 关）；`planar`（接收平面反射）；`shadows`；`cull`：back（默认）/front/none（双面，背面按翻转法线受光）/default（恢复模式默认），只传 cull 时沿用当前模式 |
| `texture({ data, width, height, linear })` | RGBA8 像素，行从下到上；法线和遮罩贴图传 `linear: true` |
| `text({ text, width, height, size, color, bold, letterSpacing })` | 生成文字贴图，用于贴花 |
| `mesh(name, data \| () => data, { key })` | 注册程序化网格，`shape: 'mesh:name'` 使用。`data` 为 `{ positions, normals, uvs, colors, indices, tangents? }`（`tangents` 每顶点 xyzw，引擎坐标，副切线 = cross(normal, tangent.xyz)·w；省略时有 uvs 就自动计算，自定义着色器从 `vTangent` 读到），左手系、+Z 为前、顺时针为正面；`colors` 为 RGBA（sRGB，可大于 1 作亮度倍数），材质开 `vertexColors` 才生效。移植 Three.js 建模代码用 `toMesh()` 转换（见 pitfalls）。网格在 Runner 里跨热重载保留：给了字符串 `key` 且与上次相同就直接复用，`data` 写成函数时连生成也跳过；`key: true` 按内容算哈希（仍要生成，只省上传）；不给 key 每次都上传（每帧变的动态网格）。蒙皮：`data` 加 `boneIndices`（每顶点 1 到 4 个骨骼下标）、可选 `boneWeights`（省略为第一根权重 1）与 `bindPoses`（每根 16 个数；省略为单位矩阵，即顶点已在各自骨骼的局部空间），再用 `spawn({ shape: 'mesh:name', bones: [骨骼实体…] })` 建成蒙皮网格，之后只移动骨骼实体。蒙皮实体没有碰撞体，不能用运行时着色器 |
| `view({ near, far })` / `quality({ renderScale, shadowDistance, shadowResolution, shadowCascades })` | 相机与画质 |
| `sky(...)` / `ambient(...)` / `fog(...)` / `weather({ wetness, puddles, rain, drops })` | 程序化天空、环境光、高度雾、雨与湿地 |
| `reflection({ enabled, height, scale, exclude, shadows })` | 地面平面反射，`exclude` 为不进反射的层 |
| `post({ tonemap, exposure, contrast, saturation, bloom, vignette, vignetteColor, grain, chromatic, ao, antialias, ... })` | 后处理，只改传入字段；受伤红晕用 `vignetteColor` 而不是 UI 叠框 |
| `burst({ kind: 'spark' \| 'glow' \| 'smoke', pos, dir, color, count, ... })` | 一次性粒子 |

### 自定义着色器（ctx.gfx，GLSL ES 3.10）

参数表达不了的效果（水、全息、溶解、顶点动画等）由游戏自带 GLSL 实现，Runner 运行时编译，改 `.glsl/.frag/.vert` 即热重载。先查 `ctx.gfx.supported`，不支持时退回普通材质；`ctx.gfx.unsupported` 给出不可用的原因（可用时为空串），Runner 启动时也会警告一次。

```ts
const water = ctx.gfx.shader({ fragment: 'shaders/water.frag' })          // 路径相对 data/，顶点默认 <pot/standard.vert>
const clay = ctx.gfx.shader({ vertex: 'shaders/wobble.vert', fragment: 'shaders/clay.frag' })
ent.shader(water, { blend: 'alpha', uniforms: { uShallow: '#6fd', uDeep: '#036' } })
ent.uniforms({ uAmount: 0.15, uTint: '#e9b' })                           // 数字/颜色/vec2-4 数组/Texture/null
ent.shader(null)                                                          // 恢复普通材质
```

- `shader` 选项：`fragment`/`vertex`（data 内路径）或 `fragmentSource`/`vertexSource`（内联）、`name`、`fullscreen`（给 bake 用的全屏程序）。返回对象有 `ok`、`error`，编译失败不抛错，日志记录并保留上一版。
- `entity.shader` 选项：`blend`：none（默认）/alpha/add（SrcAlpha, One）/premultiplied；`cull`：back/front/none；`queue`：opaque/transparent（默认按 blend 推断）；`depthWrite`、`depthTest`、`shadows`（投射阴影，不透明时默认开）；`frustumCull`（默认 true，顶点着色器重算位置时设 false）；`polygonOffset: [factor, units]`（同 three / glPolygonOffset，负数朝相机，按 int8 取整；贴花用 `[-4, -4]` 一类值防 z-fighting；`gfx.standard` 的 `polygonOffset`/`polygonOffsetFactor`/`polygonOffsetUnits` 同义）。
- 不写 `#version`，由 Runner 补上。`#include <pot/varyings>`（`vWorldPos/vNormal/vUV/vColor/vTangent`）、`<pot/lit>`（`PotSurface`、`pot_DefaultSurface()`、`pot_Lit(s, worldPos)`，含太阳光与主光阴影、点光和聚光（每物体最多 16 个，无阴影）、半球环境光、环境反射、平面反射（`s.planar` 权重，需 `scene.reflection` 启用；`s.planarOffset` 是倒影采样的屏幕 uv 偏移，涟漪、风浪靠它让倒影晃动，量级 0.01..0.1，参考 jimao 的 `apron.frag`）与雾，并带镜面抗锯齿；`s.specular` 调直射高光倍率、`s.specularMax` 钳制单个光源的直射高光；`pot_LitColor(s, worldPos)` 是不含雾的版本，需要在雾之前叠加效果（如远处雾霭）时用它再调 `pot_ApplyFog`；单独可用的有 `pot_Shadow(worldPos)`（1 亮 0 暗）、`pot_BRDF`、`pot_BRDFLight`、`pot_AdditionalLights`、`pot_PlanarReflection(worldPos, n, roughness[, uvOffset])`（a 为可用权重）、`pot_FogFactor`、`pot_FogColor(viewDir)`、`pot_ApplyFog`）、`<pot/standard.vert>`；`#include "相对路径"` 引用游戏内文件。自定义顶点着色器（`gfx.shader({ vertex, fragment })`）要自己写齐 `<pot/varyings>` 的全部输出，额外的 `out` 变量在片元里用同名 `in` 接收。
- 内置 uniform：`pot_Model`、`pot_ModelInv`、`pot_NormalMatrix`、`pot_View`、`pot_Proj`、`pot_ViewProj`、`pot_CameraPos`、`pot_Time`（x 时间、y dt、z 帧号、w 不受缩放时间）、`pot_ScreenSize`、`pot_SunDir`、`pot_SunColor`、`pot_AmbientSky/Equator/Ground`、`pot_Fog`（线性颜色、密度，与 `scene.fog` 同源）、`pot_FogParams`（高度衰减、基准高度、太阳散射）、`pot_Env`、`pot_ShadowMatrix[4]`、`pot_ShadowSpheres[4]`、`pot_ShadowParams`（x 强度，0 表示本帧无阴影；y 级联数；z 阴影距离；w reversed Z）、`pot_LightPos/Color/Spot/Atten[16]` 与 `pot_LightCount`（本物体的附加光）、`pot_Planar`（x 开关，y 反射平面高度）、`pot_Camera`（x 竖直视野弧度、y 宽高比、z = tan(fov/2)，正交相机为 0、w 正交半高）、`pot_Resolution`（相机实际渲染分辨率，含 renderScale：宽、高、1/宽、1/高；后处理里 `pot_ScreenSize` 是当前 pass 输出尺寸，它不变）、`pot_PlanarVP`（镜像相机视图投影，`uv = ndc.xy*0.5+0.5`）；贴图 `pot_EnvMap`（samplerCube）、`pot_ShadowMap`（主光阴影图，用 texelFetch 读深度）、`pot_PlanarMap`（平面反射，带 mip）、`pot_SceneDepth`（场景深度，只在 `queue: 'transparent'` 时有真实内容，其余读到无限远；用 `#include <pot/depth>` 的 `pot_SceneUv(worldPos)`、`pot_SceneEyeDepth(uv)`、`pot_EyeDepthOf(worldPos)`、`pot_SoftFade(worldPos, 距离)` 做软粒子、水体边缘淡出，参考 jimao 的 `fx_lit.frag`）。顶点输入 `pot_Position`、`pot_Normal`、`pot_UV`、`pot_VertexColor`、`pot_Tangent`。
- 颜色 uniform 以 sRGB 传入，自动转线性；输出写线性颜色。

#### three 方言（gfx.standard）

移植 three.js 的 `MeshStandardMaterial` 及其 `onBeforeCompile` 补丁时不必改写成 pot 着色器：`gfx.standard` 直接编译 three r180 的 meshphysical 原文，光照、阴影、雾、环境反射改读 pot 场景。

```ts
import { threeChunks } from '@pot/core'
const m = ctx.gfx.standard({
  name: 'crate', map: albedo, normalMap: nrm, roughnessMap: orm, metalnessMap: orm, aoMap: orm, repeat: [2, 2],
  color: '#ffffff', roughness: 1, metalness: 1, side: 'double', alphaTest: 0.5, defines: { SL_TINT: 1 },
  onBeforeCompile(s) {                       // 与 three 相同：改 vertexShader / fragmentShader / uniforms / defines
    s.uniforms.uWet = shared                 // { value } 可在多个材质间共享，binding() 时取当前值
    s.fragmentShader = s.fragmentShader.replace('#include <aomap_fragment>', threeChunks.aomap_fragment.replace(...))
  },
})
if (m.ok) ent.shader(m.shader, m.binding({ shadows: true }))
```

- 选项与 three 同名：`color/roughness/metalness/emissive/map/normalMap/normalScale/roughnessMap/metalnessMap/aoMap/emissiveMap/alphaMap/repeat/offset/vertexColors/transparent/opacity/alphaTest/side/fog/depthWrite/envMapIntensity/defines/uniforms`。颜色 `'#rrggbb'`/`0xrrggbb` 为 sRGB，数组为线性（同 `new Color(r, g, b)`）。
- `threeChunks` 是 three 原版 ShaderChunk（只读），对应补丁里的 `ShaderChunk.xxx.replace(...)`。
- 同源码同 defines 的材质共享一个程序（名为 `three:${name}:${hash}`），只有 uniform 不同的材质不会重复编译。
- 自定义着色器也可用 `gfx.shader({ dialect: 'three', vertexSource, fragmentSource, defines })` 使用同一套前缀与 chunk。
- 输出为线性 HDR，不做色调映射；贴图按 three 约定：albedo 用 sRGB 贴图，数据贴图用线性。

#### 烘焙到贴图（gfx.bake）

程序化贴图、查找表、高度转法线等一次性计算用全屏程序画到新贴图，返回的 Texture 可直接当 `map`/`normalMap`/`maskMap`，也能作为下一次 bake 的输入。

```ts
const surf = ctx.gfx.shader({ fullscreen: true, fragment: 'shaders/rust.frag' })  // 顶点用 <pot/fullscreen.vert>，片元读 in vec2 vUv
const [albedo, mask] = ctx.gfx.bake(surf, {
  width: 1024,                                          // height 默认等于 width
  targets: [{ format: 'srgb' }, { format: 'rgba8' }],   // MRT：layout(location = i) out vec4
  uniforms: { uSeed: 3, uTint: [0.6, 0.2, 0.1] },
})
ent.material({ map: albedo, maskMap: mask, metallic: 1, smoothness: 1 })
```

- 目标选项：`format`（rgba8 默认 / srgb / rgba16f / rgba32f / r8 / rg8）、`mipmaps`（默认 true）、`wrap`（repeat 默认 / clamp）、`filter`（trilinear 默认 / bilinear / point）、`aniso`（默认 8）。最多 8 个目标，边长不超过 8192。
- `blend`：none（默认）/alpha/add/premultiplied，与透明黑的初始内容混合。
- `vUv.y=0` 对应贴图 `v=0`，已处理平台差异。同一帧可连续 bake 任意多次，结果按调用顺序生效。
- 同一次 bake 返回的贴图共享生命周期：随调用插件卸载释放，任一张 `destroy()` 会一起释放。

#### 自定义后处理链（gfx.post）

整条后处理由游戏的全屏程序组成，替换 URP 自带后处理（链存在期间 `scene.post` 无效，卸载后恢复）。

```ts
const fs = (f: string) => ctx.gfx.shader({ fullscreen: true, fragment: `shaders/post/${f}.frag` })
const chain = ctx.gfx.post({
  targets: {
    half: { scale: 0.5 },                                   // 按屏幕比例；或 width/height 固定尺寸
    adapt: { width: 1, height: 1, filter: 'point', history: true },
    ldr: { format: 'rgba8' },                               // 默认 rgba16f、bilinear
  },
  passes: [
    { shader: fs('down'), output: 'half', inputs: { tSrc: 'scene' } },
    { shader: fs('adapt'), output: 'adapt', inputs: { tPrev: 'adapt', tLum: 'half' } },
    { shader: fs('grade'), output: 'ldr', inputs: { tScene: 'scene', tDepth: 'depth', tDirt: dirtTex } },
    { shader: fs('final'), output: 'screen', inputs: { tSrc: 'ldr' }, uniforms: { uGrain: 0.02 } },
  ],
  uniforms: { uExposure: 1 },                               // 所有 pass 共享
})
chain.set({ uThunder: 0.3 })   // 改共享 uniform；chain.setPass(i, {...}) 改单个 pass；chain.destroy()
```

- 内置输入：`scene`（本帧 HDR 场景，线性）、`depth`（相机原始深度）。输入也可以直接给 Texture。`history: true` 的目标在同一帧里读到的是上一帧结果，写入本帧；首帧为透明黑。
- pass 选项：`blend`（同 bake）、`uniforms`、`name`、`enabled`（初始开关，默认 true）。`chain.enable(下标 | 名字 | 数组, on)` 开关 pass，同名的一组一起开关（如所有 bloom pass 都叫 `bloom`），`chain.enabled(x)` 查询；关闭的 pass 不执行，它写的普通目标被清成透明黑（下游读到 0），history 目标保留上次结果，写 screen 的则画面保持上一步。比把强度置零省 GPU。按数组顺序执行，`output: 'screen'` 的 pass 写最终画面，必须输出线性颜色（最终拷贝负责转 sRGB）。
- 后建的链替换先建的，`chain.active` 为 false 表示已被替换或释放。着色器编译失败或目标名不存在时抛错。
- `#include <pot/post>`：`in vec2 vUv`（原点左下）、`pot_Depth01(raw)`、`pot_EyeDepth(raw)`、`pot_IsSky(raw)`、`pot_WorldPos(uv, raw)`、`pot_ViewDir(uv)`、`pot_WorldToUv(p)`（xy 为屏幕 uv，z 为裁剪空间 w，<0 在相机后）。内置量 `pot_ScreenVP`、`pot_ScreenInvVP`、`pot_DepthParams`；`pot_ScreenSize` 在每个 pass 里是输出目标的尺寸（xy 像素、zw 倒数），源贴图尺寸用 `textureSize`。`<pot/lit>` 也能 include，用其中的雾函数和太阳量。

### Canvas 2D（ctx.scene.canvas）

```ts
const c = ctx.scene.canvas(1024, 512)
const g = c.getContext('2d')          // 与浏览器 CanvasRenderingContext2D 同名同义
g.fillStyle = g.createRadialGradient(64, 64, 0, 64, 64, 40); g.fill('evenodd')
g.font = 'bold 24px Microsoft YaHei'; g.fillText('标签', 8, 30)
const tex = c.texture({ wrap: 'clamp', aniso: 4, mipmaps: true })   // 默认 sRGB，数据贴图传 linear: true；插件卸载时自动销毁
const rgba = c.pixels(true)           // 非预乘 RGBA8；true = 行序从下到上（scene.texture 的约定）
```

- 用于移植网页里用 canvas 程序化绘制的贴图（贴花图集、标签、喷字、标线）。纯 JS 软件光栅，1024×512 的复杂图集约 40 ms 一张，只在加载时画，不要每帧画。
- 支持：路径（arc、贝塞尔、rect、roundRect）、nonzero/evenodd、线性/径向渐变、描边（lineWidth/cap/join/dash）、变换、save/restore、clip、globalAlpha、globalCompositeOperation（source-over、destination-out、lighter 等）、getImageData/putImageData、drawImage（另一块 Canvas）、fillText/measureText。
- 不支持：pattern、shadow、filter、strokeText。
- 文字由 Runner 用系统字体栅格化（family 逗号列表依次回退），与浏览器字形不会逐像素一致。

## ctx.state

| API | 说明 |
|---|---|
| `define(key, { version, init, migrate, validate })` | 返回活对象。key 已存在且版本相同时返回同一个对象，这就是热重载保留状态的原因。`validate(value)` 校验沿用下来的数据（读档、冷重启、热重载、migrate 结果，刚 init 的不校验）：返回 `true`/不返回为通过，可就地修正字段；返回 `false` 或原因字符串、或抛错，则用 `init` 重新初始化（原地写回）并告警 |
| `get(key)` | 读取任意单元的 state（只读使用，写入归属单元自己） |
| `set(key, value)` | 整体替换，会断开旧引用，少用 |
| `keys()` / `reset(key?)` / `snapshot()` / `restore()` | 开发工具和存档用 |

同一个 key 只能由一个单元 define。

## ctx.data

`load<T>(path)` 每次返回新解析的对象；`text(path)`、`exists(path)`。路径相对 `data/`。

## ctx.cache

可丢弃的派生数据（LRU，默认 64MB 预算），不参与快照。常用 `getOrCreate(name, deps, factory)`：deps 不变就复用，适合程序化生成的结果。

## ctx.input

`axis('move')`：WASD/方向键/触屏左半屏摇杆，返回 `{ x, y }`；`axis('look')`：鼠标增量。`key(name)` 按住、`pressed(name)` 本帧按下、`released(name)` 本帧抬起。键名不区分大小写，用 Unity KeyCode 名（`space`、`a`、`1`、`leftshift`）。

## ctx.ui

即时模式 2D，每帧在 update 里画，坐标为屏幕像素、左上角原点。`rect(x,y,w,h,color,{alpha,radius})`、`border(...,thickness)`、`line`、`arc`、`text(str,x,y,{size,bold,color,alpha,align,valign,shadow,w,h,wrap,spacing})`、`measure(str,size,bold,spacing?)`、`hit(x,y,w,h)`、`width`/`height`。颜色写法同上（支持 `rgba()`）。`spacing` 为字距（em，同 CSS letter-spacing，每个字后都加、含最后一个）：运行时逐字排版并缓存单字宽度，`align` 居中/右对齐时自动补回末尾字距，`wrap` 时在 `w` 内断行（英文优先在空格处断）；`measure` 传同样的 `spacing` 得到含末尾字距的宽度。没有渐变、字重档位：渐变用窄条带矩形近似。

布局辅助（只算矩形，不绘制）：`ui.flow(x, y, { dir: 'row'|'column', gap, align: 'start'|'center'|'end' })` 增量排布，尺寸边画边知道时用，`f.next(w, h)` 返回这一项的矩形并前移游标，`f.x`/`f.y` 为下一项位置，`f.width`/`f.height` 为已排外框（`align: 'center'` 时起点 y 是行的中线）；`ui.layout(sizes, { x, y, w, h }, { dir, gap, justify: 'start'|'center'|'end'|'between', align: 'start'|'center'|'end'|'stretch' })` 已知各项尺寸时在容器内分布，返回矩形数组。

## 定时器

`ctx.timeout(cb, ms)`、`ctx.interval(cb, ms)` 返回取消函数；`await ctx.timeout(ms)` 在单元卸载时 reject。`ctx.throttle`/`ctx.debounce` 同 cordis。全部走游戏时间：暂停、时间缩放、热重载冻结都会生效。

## ctx.use(name, config)

在当前 ctx 下挂载子单元。父单元重载时子单元一起重建；子单元重载不影响父单元。`manifest.json` 的 `plugins` 是根上挂载的单元。

## ctx.logger(name)

`info`/`warn`/`error`/`debug`，支持 `%d %s %o` 格式化。日志会进入 Dev Server 的 `logs`。

## ctx.loading

启动期加载进度与让帧。单元 `apply` 可以写成 `async`，在耗时阶段之间 `await ctx.loading.step('编译材质', 0.4)`：
- `step(text?, progress?)`：回报进度（0..1），本帧已连续执行超过 `budget`（默认 50 ms）时让出一帧，下一帧继续。宿主不按帧驱动（Node 测试）时立即继续。
- `report(text?, progress?)`：只回报不让帧；`frame()`：无条件等下一帧。
- 只读：`active`（启动中）、`progress`、`text`、`yields`（本次让帧次数）。
- 父单元用 `await ctx.use('子单元')` 可以等子单元的 async apply 完成，按顺序加载并分段回报进度。
- 启动期间 Runner 显示加载界面（游戏名、进度条、阶段文字、已用秒数）；游戏从没报过进度时显示"加载 单元名"和不确定进度条。

## ctx.effect(setup, label)

自定义资源：`setup` 返回清理函数，单元卸载时执行。
