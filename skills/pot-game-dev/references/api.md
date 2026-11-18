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

- `shader` 选项：`fragment`/`vertex`（data 内路径）或 `fragmentSource`/`vertexSource`（内联）、`name`。返回对象有 `ok`、`error`，编译失败不抛错，日志记录并保留上一版。
- `entity.shader` 选项：`blend`：none（默认）/alpha/add/premultiplied；`cull`：back/front/none；`queue`：opaque/transparent（默认按 blend 推断）；`depthWrite`、`depthTest`、`shadows`（投射阴影，不透明时默认开）。
- 不写 `#version`，由 Runner 补上。`#include <pot/varyings>`（`vWorldPos/vNormal/vUV/vColor/vTangent`）、`<pot/lit>`（`PotSurface`、`pot_DefaultSurface()`、`pot_Lit(s)`，含太阳光、半球环境光、环境反射与雾）、`<pot/standard.vert>`；`#include "相对路径"` 引用游戏内文件。
- 内置 uniform：`pot_Model`、`pot_ModelInv`、`pot_NormalMatrix`、`pot_View`、`pot_Proj`、`pot_ViewProj`、`pot_CameraPos`、`pot_Time`（x 时间、y dt、z 帧号、w 不受缩放时间）、`pot_ScreenSize`、`pot_SunDir`、`pot_SunColor`、`pot_AmbientSky/Equator/Ground`、`pot_Fog`、`pot_Env`；贴图 `pot_EnvMap`（samplerCube）。顶点输入 `pot_Position`、`pot_Normal`、`pot_UV`、`pot_VertexColor`、`pot_Tangent`。
- 颜色 uniform 以 sRGB 传入，自动转线性；输出写线性颜色。

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

## 定时器

`ctx.timeout(cb, ms)`、`ctx.interval(cb, ms)` 返回取消函数；`await ctx.timeout(ms)` 在单元卸载时 reject。`ctx.throttle`/`ctx.debounce` 同 cordis。全部走游戏时间：暂停、时间缩放、热重载冻结都会生效。

## ctx.use(name, config)

在当前 ctx 下挂载子单元。父单元重载时子单元一起重建；子单元重载不影响父单元。`manifest.json` 的 `plugins` 是根上挂载的单元。

## ctx.logger(name)

`info`/`warn`/`error`/`debug`，支持 `%d %s %o` 格式化。日志会进入 Dev Server 的 `logs`。

## ctx.effect(setup, label)

自定义资源：`setup` 返回清理函数，单元卸载时执行。
