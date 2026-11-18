# Game API 语义

游戏代码只依赖 `@pot/core`（运行时挂在 `globalThis.pot`）。每个单元自动注入全部核心服务（clock、timer、state、cache、data、scene、input、plugins），不用手写 `inject`。

## ctx.on('update', (dt, time) => {})

每个游戏帧触发。`dt` 为缩放后的秒数（单帧最大 0.1 秒），`time` 为游戏时间。暂停、热重载冻结时不触发。

## ctx.scene

| API | 说明 |
|---|---|
| `spawn({ shape, name, parent, position, rotation, scale, color, active })` | shape：cube/sphere/capsule/cylinder/plane/quad/empty。返回 `Entity`，随单元卸载自动销毁 |
| `light({ type, intensity, color, range, position, rotation })` | type：directional/point/spot |
| `camera` | 主相机 Entity，不能销毁；每次热重载都要重新设置位置 |
| `background(color)` | 纯色背景 |
| `find(name)` / `list(unit?)` | 查找 pot 创建的对象 |

`Entity`：`position`/`rotation`（欧拉角，度）/`scale` 读写都是一次跨语言调用，热点循环里先缓存；`move(dx,dy,dz)`、`lookAt(vec|entity)`、`color(c)`、`active(bool)`、`destroy()`、`alive`。

颜色可用 `'#rgb'`、`'#rrggbb'`、`'#rrggbbaa'` 或 `[r,g,b,a?]`（0 到 1）。

### 材质与渲染（URP，Linear 色彩空间）

所有颜色都按 sRGB 传入，Runner 负责转线性。游戏不能带 Unity 着色器或 C#；普通外观通过下列参数表达，参数表达不了的效果用下一节的 GLSL 着色器。

| API | 说明 |
|---|---|
| `spawn({ material })` | `mode`：lit/lit-cutout/lit-twosided/lit-fade/unlit/unlit-fade/additive；`map`/`normalMap`/`maskMap`（mask：R 金属 G AO B 高度 A 光滑）；`smoothness`/`metallic`（与 mask 相乘，用贴图时传 1）；`uv`：mesh/world/object（三平面）；`tiling`/`offset`；`vertexColors`；`emission`/`emissionIntensity`；`wet`（湿润响应，0 关）；`planar`（接收平面反射）；`shadows` |
| `texture({ data, width, height, linear })` | RGBA8 像素，行从下到上；法线和遮罩贴图传 `linear: true` |
| `text({ text, width, height, size, color, bold, letterSpacing })` | 生成文字贴图，用于贴花 |
| `mesh(name, { positions, normals, uvs, colors, indices })` | 注册程序化网格，`shape: 'mesh:name'` 使用。左手系、+Z 为前、顺时针为正面；`colors` 为 RGBA（sRGB，可大于 1 作亮度倍数），材质开 `vertexColors` 才生效。移植 Three.js 建模代码用 `toMesh()` 转换（见 pitfalls） |
| `view({ near, far })` / `quality({ renderScale, shadowDistance, shadowResolution, shadowCascades })` | 相机与画质 |
| `sky(...)` / `ambient(...)` / `fog(...)` / `weather({ wetness, puddles, rain, drops })` | 程序化天空、环境光、高度雾、雨与湿地 |
| `reflection({ enabled, height, scale, exclude, shadows })` | 地面平面反射，`exclude` 为不进反射的层 |
| `post({ tonemap, exposure, contrast, saturation, bloom, vignette, vignetteColor, grain, chromatic, ao, antialias, ... })` | 后处理，只改传入字段；受伤红晕用 `vignetteColor` 而不是 UI 叠框 |
| `burst({ kind: 'spark' \| 'glow' \| 'smoke', pos, dir, color, count, ... })` | 一次性粒子 |

### 自定义着色器（ctx.gfx，GLSL ES 3.10）

参数表达不了的效果（水、全息、溶解、顶点动画等）由游戏自带 GLSL 实现，Runner 运行时编译，改 `.glsl/.frag/.vert` 即热重载。先查 `ctx.gfx.supported`，不支持时退回普通材质。

```ts
const water = ctx.gfx.shader({ fragment: 'shaders/water.frag' })          // 路径相对 data/，顶点默认 <pot/standard.vert>
const clay = ctx.gfx.shader({ vertex: 'shaders/wobble.vert', fragment: 'shaders/clay.frag' })
ent.shader(water, { blend: 'alpha', uniforms: { uShallow: '#6fd', uDeep: '#036' } })
ent.uniforms({ uAmount: 0.15, uTint: '#e9b' })                           // 数字/颜色/vec2-4 数组/Texture/null
ent.shader(null)                                                          // 恢复普通材质
```

- `shader` 选项：`fragment`/`vertex`（data 内路径）或 `fragmentSource`/`vertexSource`（内联）、`name`、`fullscreen`（给 bake 用的全屏程序）。返回对象有 `ok`、`error`，编译失败不抛错，日志记录并保留上一版。
- `entity.shader` 选项：`blend`：none（默认）/alpha/add（SrcAlpha, One）/premultiplied；`cull`：back/front/none；`queue`：opaque/transparent（默认按 blend 推断）；`depthWrite`、`depthTest`、`shadows`（投射阴影，不透明时默认开）；`frustumCull`（默认 true，顶点着色器重算位置时设 false）。
- 不写 `#version`，由 Runner 补上。`#include <pot/varyings>`（`vWorldPos/vNormal/vUV/vColor/vTangent`）、`<pot/lit>`（`PotSurface`、`pot_DefaultSurface()`、`pot_Lit(s, worldPos)`，含太阳光与主光阴影、点光和聚光（每物体最多 16 个，无阴影）、半球环境光、环境反射、平面反射（`s.planar` 权重，需 `scene.reflection` 启用；`s.planarOffset` 是倒影采样的屏幕 uv 偏移，涟漪、风浪靠它让倒影晃动，量级 0.01..0.1，参考 jimao 的 `apron.frag`）与雾，并带镜面抗锯齿；`s.specular` 调直射高光倍率、`s.specularMax` 钳制单个光源的直射高光；`pot_LitColor(s, worldPos)` 是不含雾的版本，需要在雾之前叠加效果（如远处雾霭）时用它再调 `pot_ApplyFog`；单独可用的有 `pot_Shadow(worldPos)`（1 亮 0 暗）、`pot_BRDF`、`pot_BRDFLight`、`pot_AdditionalLights`、`pot_PlanarReflection(worldPos, n, roughness[, uvOffset])`（a 为可用权重）、`pot_FogFactor`、`pot_FogColor(viewDir)`、`pot_ApplyFog`）、`<pot/standard.vert>`；`#include "相对路径"` 引用游戏内文件。自定义顶点着色器（`gfx.shader({ vertex, fragment })`）要自己写齐 `<pot/varyings>` 的全部输出，额外的 `out` 变量在片元里用同名 `in` 接收。
- 内置 uniform：`pot_Model`、`pot_ModelInv`、`pot_NormalMatrix`、`pot_View`、`pot_Proj`、`pot_ViewProj`、`pot_CameraPos`、`pot_Time`（x 时间、y dt、z 帧号、w 不受缩放时间）、`pot_ScreenSize`、`pot_SunDir`、`pot_SunColor`、`pot_AmbientSky/Equator/Ground`、`pot_Fog`（线性颜色、密度，与 `scene.fog` 同源）、`pot_FogParams`（高度衰减、基准高度、太阳散射）、`pot_Env`、`pot_ShadowMatrix[4]`、`pot_ShadowSpheres[4]`、`pot_ShadowParams`（x 强度，0 表示本帧无阴影；y 级联数；z 阴影距离；w reversed Z）、`pot_LightPos/Color/Spot/Atten[16]` 与 `pot_LightCount`（本物体的附加光）、`pot_Planar`（x 开关，y 反射平面高度）、`pot_PlanarVP`（镜像相机视图投影，`uv = ndc.xy*0.5+0.5`）；贴图 `pot_EnvMap`（samplerCube）、`pot_ShadowMap`（主光阴影图，用 texelFetch 读深度）、`pot_PlanarMap`（平面反射，带 mip）。顶点输入 `pot_Position`、`pot_Normal`、`pot_UV`、`pot_VertexColor`、`pot_Tangent`。
- 颜色 uniform 以 sRGB 传入，自动转线性；输出写线性颜色。

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
- pass 选项：`blend`（同 bake）、`uniforms`。按数组顺序执行，`output: 'screen'` 的 pass 写最终画面，必须输出线性颜色（最终拷贝负责转 sRGB）。
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
| `define(key, { version, init, migrate })` | 返回活对象。key 已存在且版本相同时返回同一个对象，这就是热重载保留状态的原因 |
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

即时模式 2D，每帧在 update 里画，坐标为屏幕像素、左上角原点。`rect(x,y,w,h,color,{alpha,radius})`、`border(...,thickness)`、`line`、`arc`、`text(str,x,y,{size,bold,color,alpha,align,valign,shadow,w,h,wrap})`、`measure(str,size,bold)`、`hit(x,y,w,h)`、`width`/`height`。颜色只认十六进制（`#rrggbbaa` 带透明度）。没有渐变、字距、字重档位：渐变用窄条带矩形近似，字距按字绘制并缓存单字宽度（见 jimao `menu.ts` 的 `spaced`）。

## 定时器

`ctx.timeout(cb, ms)`、`ctx.interval(cb, ms)` 返回取消函数；`await ctx.timeout(ms)` 在单元卸载时 reject。`ctx.throttle`/`ctx.debounce` 同 cordis。全部走游戏时间：暂停、时间缩放、热重载冻结都会生效。

## ctx.use(name, config)

在当前 ctx 下挂载子单元。父单元重载时子单元一起重建；子单元重载不影响父单元。`manifest.json` 的 `plugins` 是根上挂载的单元。

## ctx.logger(name)

`info`/`warn`/`error`/`debug`，支持 `%d %s %o` 格式化。日志会进入 Dev Server 的 `logs`。

## ctx.effect(setup, label)

自定义资源：`setup` 返回清理函数，单元卸载时执行。
