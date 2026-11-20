# 坑点库

格式：现象 / 原因 / 做法 / 来源。能由框架消除的坑改框架，并标注“已由框架保证”。

## 游戏代码

### state 里放了 Entity 或函数
- 现象：`define` 或热重载快照时报“不可序列化”并给出路径。
- 原因：state 要能深拷贝、存档、冷重启恢复。
- 做法：只存位置、id、名字等描述；Entity 放闭包里，apply 时重建。
- 来源：设计约定，运行时 `assertSerializable` 检查（已由框架保证报错）。

### 低帧率穿墙、出界后看到"薄薄一层"的集装箱

- `update` 的 dt 是真实帧间隔，窗口在后台时约 0.25 s。自写的 AABB 移动若一帧位移超过"盒厚 + 2×半径"，就会跨过薄盒（空气墙、栏杆）。按子步推进（每步不超过半径），并加"出了可玩区域就拉回 lastSafe"的兜底。
- 出界后看到的单层集装箱、薄墙通常是远景面片（只建了朝向关卡的一面），不是建模错误。
- 存档会原样恢复坏位置：在 `state.define` 里给 `validate`（如“是否在区域内、坐标是否有限”），不通过会自动回到 `init`（见 jimao 的 `player.ts`），不要在 define 之后手写一遍修补。
- 移植的原版代码经常把 three 的 `Vector3` 传给期望数组的适配函数（`addBox(box.min, box.max)`），按下标取会得到 NaN，碰撞盒静默失效。适配层同时接受 `[x,y,z]` 和 `{x,y,z}`，并在启动时统计非有限值。

### 热重载后旧版本泄漏
- 现象：`lastReload.leaks` 非空，或多次重载后 heap 上涨。
- 原因：模块顶层或全局变量持有了 ctx、fiber、Entity、回调；或者用了全局 setTimeout。
- 做法：所有副作用走 ctx；不要缓存入口 fiber 或 ctx 到模块外。
- 来源：原型开发时 hmr 自身持有入口 fiber 导致泄漏。

### 单元之间 import 值
- 现象：A 单元 import 了 B 单元的函数或常量，改 B 时 A 的行为和 B 的挂载状态对不上，或 B 的顶层代码被执行两次。
- 原因：单元文件每次加载都重新执行，B 被 import 时是另一份模块实例，不是挂载中的那个 B。
- 做法：单元之间只 `import type`；数据通过 state 或 data 共享，子单元用 `ctx.use`；共用的纯函数、常量放 `src/lib/`（共享模块只有一份实例，改了会热重载所有用到它的单元）。
- 来源：设计约定。

### 用了 npm 包或 Node API
- 现象：报“不支持 require”或“找不到模块”。
- 原因：Runner 只解析相对路径（自动补 `.ts`、`.js`、`.json`、`/index.ts`）和 `@pot/core`。
- 做法：需要的算法自己写进 `src/lib/`。纯计算、无副作用的第三方库（如 Three.js 的几何与数学部分）可以用 esbuild 打成单个 CJS 文件放进 `src/vendor/`，配一个 `.d.ts`，按相对路径 import。打包时只从库的具体源文件导入，不要从主入口导入：主入口常带模块级副作用（three 的 `LoadingManager` 一加载就 `new AbortController`，Puerts 里没有这个全局对象，单元直接启动失败）。参考 `tools/vendor/build-three-geo.js`。
- 来源：jimao 移植原版枪模。

### 移植 Three.js 建模代码后模型镜像、全黑或颜色发灰
- 原因：Three.js 是右手系、-Z 为前；Unity 是左手系、+Z 为前。原版颜色都是线性值，Runner 的颜色按 sRGB 传入。
- 做法：建模代码保持原版坐标与数值不动（只改名），最后统一用 `geo.ts` 的 `toMesh()` 转换：Z 取反、三角形绕序反转、顶点色转 sRGB（可大于 1，作亮度倍数）。材质颜色用 `linearColor()` 转，`smoothness = 1 - roughness`。原版位置 `[x, y, z]` 在 Runner 里是 `[x, y, -z]`，绕 X、Y 轴的旋转取反。
- 来源：jimao 移植原版枪模。

### 枪模大小、位置和原版对不上
- 原因：原版用独立相机渲染枪模（固定 54° 视角），Runner 只有一个主相机，视角随设置、瞄准、冲刺变化。
- 做法：枪模挂在一个相机子节点下，每帧把它的缩放设为 `[k, k, 1]`，`k = tan(fov/2) / tan(54°/2)`，屏幕投影与原版一致；近裁面降到 0.02。
- 来源：jimao 移植原版枪模。

### state set 之后插件行为没变
- 原因：`state set` 整体替换对象，插件闭包里 `define` 拿到的还是旧对象。
- 做法：调试时改完 state 再 `pot reload <单元>`，或者只改字段（`eval` 里拿到活对象再赋值）。

### 导出 name 与文件名不一致
- 现象：预加载失败，“单元文件名是 x，但导出的 name 是 y”。
- 做法：`export const name` 与文件名保持一致（已由框架检查）。

### state 结构改了但没升版本
- 现象：读到 undefined 字段或旧结构。
- 做法：结构变化时 `version + 1` 并写 `migrate`。

### 主相机位置在热重载后不对
- 原因：主相机不归任何单元，不会被重建或还原。
- 做法：在负责场景的单元 apply 里每次都设置相机。

### 写实画面偏灰、偏暗或过曝
- 原因：Runner 是 Linear + HDR，sRGB 0.085 只相当于线性 0.0076；后处理曝光、雾色、环境光三者叠加很敏感。
- 做法：先关雾和后处理确认基础受光，再逐项加；雾色用暖灰而不是中性灰；改曝光每次 ±0.2 以内，顺光、逆光各截一张对比。
- 来源：jimao 写实化迭代。

### 贴图材质发白或像镜子
- 原因：mask 的金属度、光滑度会和 `metallic`/`smoothness` 相乘；不传 mask 时按参数原值，参数为 1 就是镜面。平整的盒子顶面在掠射角会反射整片天空。
- 做法：用贴图时传 `smoothness: 1, metallic: 1`，由 mask 控制；枪模等近景小件光滑度降到 0.6 左右并关掉 `wet`。

### quad 贴花看不见或文字镜像
- 原因：Unity 的 quad 正面朝 -Z。
- 做法：贴在 +Z 侧面向外时不转，-Z 侧转 180°；离表面留 5mm 左右防止闪烁。

### 受伤暗角用 UI 多层描边
- 现象：屏幕出现一圈圈同心方框。
- 做法：用 `scene.post({ vignette, vignetteColor })` 驱动，并对强度量化，变化时才调用。

### tiling 写成 `as const` 报类型错误
- 原因：`as const` 得到只读元组，不能赋给 `MaterialOptions`。
- 做法：直接把对象标注为 `MaterialOptions`。

### 暂停游戏用了 clock.pause
- 现象：UI、菜单也一起停了。
- 做法：游戏暂停用自己的 phase；`time pause` 只用于开发调试。

### 自定义着色器的限制（ctx.gfx）

- 支持 Windows D3D11 与 WebGL2（GLES3 后端，`ctx.gfx.backend` 为 `"gles3"`）；Android 包目前不含 `pot_gfx`，其他平台 `ctx.gfx.supported` 为 false，要提供普通材质的退路。
- 发布包的文字用内置字体子集（只含游戏文件里出现过的字）。运行时拼出来的字（玩家输入、网络文本）不在子集里，WebGL 上会缺字，要在 manifest `release.fontChars` 里补上。UI 文字竖直位置按参考行高 1.32em 对齐，复刻 CSS 的 `line-height` 小于 1 的大标题时，按行框中心 `valign: 'middle'` 摆放，不要用 `bottom`（字形会偏高）。
- 用自定义着色器的物体可以接收主光阴影（`pot_Lit` 已包含），但不进 SSAO，也不会出现在平面反射里；附加光（点光、聚光）没有阴影。后处理链（`gfx.post`）的 pass 拿不到主光阴影图，体积光暂时做不了。
- 用 `pot_DefaultSurface()` 初始化 `PotSurface`，不要逐字段手写，否则新增字段（如 `planar`）会是未定义值。
- 移植 three 材质优先用 `gfx.standard` 原文加 `onBeforeCompile`（见 api.md），比手改成 `pot_Lit` 更接近原版。限制：蒙皮实体不能用运行时着色器；没有自定义顶点属性；只画在主相机上（不进平面反射）；阴影仍由普通渲染器的回退材质投射，回退材质要保留 alphaTest 才能让镂空物体的阴影一致。
- 改了 `js/runtime` 后要 `npm --prefix js run build` 并重建 Runner，Runner 内打包的是 `Resources/pot/core.cjs`；只热重载游戏会出现 `ctx.gfx.standard is not a function` 或 `threeChunks` 为 undefined。
- 移植 three.js 的 `onBeforeCompile` 补丁：改 `directSpecular` 用 `s.specular`/`s.specularMax`；在 `opaque_fragment` 前改 `outgoingLight` 用 `pot_LitColor` 后自己 `pot_ApplyFog`；`s.ao` 同时影响环境漫反射和环境反射、不影响直射，与 three 的 `radiance *= k; iblIrradiance *= k` 不同，后者应折算为 `albedo *= k; specular *= k`。
- 移植时 three 的 `vGWorld`/`cameraPosition` 用 `(x, y, -z)` 换算，法线 `(nx, ny, nz)` 换回 Unity 是 `(nx, ny, -nz)`；自定义网格按 z 取反并反转三角形绕序。
- 没有实例化：原版 `InstancedBufferGeometry` + 每实例属性（雨、溅射、粒子）要把实例展开成普通网格，每个实例重复写它的顶点，实例数据塞进 `normals`（3 个浮点，原样传递）和 `uvs`（2 个浮点）；不要用 `colors`，会被当作 sRGB 转线性。
- 顶点着色器重算位置（以相机为中心循环、广告牌）时网格包围盒不可信，物体会被视锥剔除而时有时无：绑定时加 `frustumCull: false`（对应 three 的 `frustumCulled = false`）。
- three 的 `AdditiveBlending` 即 `blend: 'add'`（SrcAlpha, One）；`fov` 没有内置量，`2·tan(fov/2)` 用 `2.0 / abs(pot_Proj[1][1])` 求。
- `gl_FragCoord.y` 原点随后端不同：D3D11 在左上（与 WebGL 相反），GLES3/WebGL 在左下。需要屏幕方向的效果用 `vUv` 或 `pot_WorldToUv` 求屏幕坐标，不要直接依赖 `gl_FragCoord.y`；只用作噪声种子则无所谓。
- WebGL 上着色器源码由后端直接交给 `GLctx.shaderSource`，绕开了 emscripten 的 C 预处理（它会把 `sat(max(max(a,b),c))` 这类嵌套函数式宏展开坏）；游戏侧照常写宏即可。
- 编译错误不会让画面消失：日志和错误浮层给出 `文件:行号`，旧版本继续绘制，改好即恢复。
- 片元着色器没用到的 uniform 会被编译器剔除，对它调用 `uniforms` 不报错也无效果。
- `gfx.bake` 的 `vUv` 与采样坐标一致（`vUv.y=0` 即贴图 `v=0`），不要再手动翻 y；颜色目标用 `format: 'srgb'` 并输出线性值，数据目标（遮罩、高度、法线）用 `rgba8`。
- 程序化材质优先 GPU 烘焙（原版 three.js 的 RenderTarget + 全屏 pass 可直接对照 `gfx.bake` 机械移植），CPU 逐像素生成 1024² 贴图要几秒；作为中间结果的 MRT 用 `filter: 'point', mipmaps: false`。

### 移植 EffectComposer 后处理（gfx.post）

- 写 `screen` 的最后一个 pass 输出线性颜色。原版最后一个 pass 输出 sRGB 编码值（`OutputPass` 或自己 pow 1/2.2），照搬会整体发灰偏亮，结尾补一次 `toLinear`。中间目标存 sRGB 值时用 `rgba8`，与原版一致。
- `pot_ScreenSize` 是当前 pass 输出目标的尺寸，不是屏幕尺寸。降采样 pass 的源像素大小用 `1.0 / vec2(textureSize(tSrc, 0))`；原版按 `resolution` 统一传的 uniform 要逐个核对。
- 时间累积（自动曝光、TAA）用 `history: true` 目标，首帧读到透明黑，着色器里把 `prev <= 0` 当作首帧直接取当前值，否则开局会从全黑慢慢亮起来。
- 深度、世界坐标用 `<pot/post>` 的 `pot_WorldPos`、`pot_IsSky`，不要照搬原版的 `cameraNear/Far` 线性化：Unity 是 reversed Z，且远平面不同。
- 原版的方向向量（太阳、闪电方向）是 three 坐标，传进来要把 z 取反；太阳屏幕位置用 `pot_WorldToUv(camPos + pot_SunDir * 500)`，z（w）< 0 时在相机后方，要关掉眩光。
- 链生效时 URP 后处理被关闭，`scene.post` 里的 SSAO、景深、tonemap 全部失效；退路是先查 `ctx.gfx.supported` 和每个着色器的 `ok`，`gfx.post` 出错会抛异常，捕获后再走 `scene.post`（见 jimao 的 `lib/post.ts`）。
- 热重载中途报 `xxx is not defined`（新加了 import 的模块）多半是编辑过程中保存的中间版本，已自动回滚；以最后一次重载或冷启动的日志为准。

### 移植原版自定义材质补丁（onBeforeCompile）

- 原版的 `#include <map_fragment>` 等替换不能照搬到 PotLit；把“贴图 + 参数 → albedo / 金属度 / 粗糙度 / AO”的纯函数部分挪进一个 bake 合成 pass，输出 PotLit 的 `map`（sRGB）与 `maskMap`（R 金属度、G AO、B 高度、A 光滑度 = 1 − 粗糙度），材质里 `metallic`、`smoothness` 设 1。
- three.js 的十六进制颜色按 sRGB 解释并转线性（ColorManagement），传进 bake 的颜色 uniform 若是数组要自己转线性。
- 依赖世界坐标、法线或屏幕导数的部分（宏观亮度变化、雨痕水珠、远距离镂空抖动）不能烘焙，只能写成完整的自定义着色器或暂时舍弃。

### 移植 HTML/CSS 菜单

- `rgba(...)`、颜色名传给 ui 会被当成十六进制解析成错色，先换成 `#rrggbbaa`。
- linear-gradient 用条带矩形近似时条带不要超过约 6px，16px 在亮背景上能看到竖向色阶。
- letter-spacing 按字绘制时缓存 `ui.measure` 的单字宽度（每次 measure 都是跨语言调用）；CSS 字距在末字后也有，按钮文字居中要补回半个字距。
- `valign: 'bottom'` 对齐的是字体框底，大字号（100px 以上）时字形底部和下方元素之间要多留 8px 左右。
- three 相机 `rotation.z` 是弧度，pot 的 `camera.rotation` 是度；在 `lookAt` 之后读出再写回才能叠加滚转。

### 移植 canvas 贴图与贴花

- `canvas.data` 是预乘 alpha 的 Float32；要非预乘 RGBA8 用 `pixels()`，直接喂 `scene.texture` 时用 `pixels(true)`（行序从下到上），否则贴图上下颠倒。
- 动态网格池（弹孔、贴花）初始全零时，`spawn` 不会建碰撞体；但池子本身也不该参与射线检测，spawn 时传 `collider: false`。
- gfx 没有 polygon offset，贴花沿法线外推几毫米防 z-fighting；网格没有切线，法线贴图用 `dFdx/dFdy` 重建切线框架。
- 调试命中类效果不要靠模拟鼠标（失焦会触发暂停），给游戏加一个调试事件，在 `eval` 里 `ctx.emit` 后看日志和截图。

## 工具与环境

### 类型检查用错 tsc
- 做法：用 `js/node_modules/.bin/tsc --noEmit -p games/<id>/tsconfig.json`，全局 tsc 版本可能不一致。

### 自动化输入没反应
- 原因：Runner 窗口不在前台时收不到系统按键。
- 做法：调试时用 `eval` 改 state（如 phase、yaw、health）再截图。

### 帧率突然只有约 4fps，CPU 和显卡都不忙
- 原因：同时开了两个 Runner 连同一个 Dev Server。旧版 Dev Server 只保留一个连接，两边互相顶替、反复重连，`logs` 里不断出现"新的 Runner 连接，替换旧连接"。和游戏内容、敌人数量无关。
- 现状：新版 Dev Server 会拒绝第二个 Runner（日志“已拒绝第二个 Runner 连接”，`pot status` 的 `rejected`），后开的 Runner 状态栏显示“Dev 被另一个 Runner 占用”，不再互相顶替；要让新 Runner 接手，在它的 F1 面板点“连接”。
- 做法：仍建议启动前先 `Stop-Process -Name PotRunner`，确认 `Get-Process PotRunner` 只有一个，否则 CLI 命令发给的是先开的那个。

### PowerShell 改含中文的文件后乱码
- 原因：Windows PowerShell 5 的 `Set-Content`/`Get-Content` 默认不是 UTF-8。
- 做法：用编辑器或文件工具修改源码；`.ps1` 脚本保持纯 ASCII（PS5 按 ANSI 读取无 BOM 文件）。C++ 源码被这样改坏后，中文注释会吞掉换行，表现为大量莫名其妙的编译错误。

### 改了 pot_gfx 原生代码，WebGL 包没变化
- 原因：WebGL 插件是 `packages/com.pot.core/Plugins/WebGL/pot_gfx` 下的源码副本。
- 做法：改完 `native/pot_gfx/src` 后执行 `node native/pot_gfx/sync-webgl.js` 再出包；浏览器的 UnityCache 可能缓存旧包，验证时给页面 URL 加个参数。

### WebGL 上 gfx.post 不生效、画面发灰偏亮
- 原因：Unity GL 设备的 `CommandBuffer.SetRenderTarget` 惰性生效，要到 Unity 自己下一次绘制或清屏才绑定 FBO，插件事件发生时仍是相机目标。
- 做法：Runner 已处理（GL 上 post pass 用事件 1，帧数据前缀带输出贴图，后端自行绑定 FBO 和视口）。新增“插件画到指定 RT”的路径时同样要这么做，或像 `gfx.bake` 那样先 `ClearRenderTarget` 强制绑定。

### cordis 内部错误没有日志
- 原因：cordis 默认 logger 不输出。
- 做法：Runner 已把 logger 接到 `logs`（已由框架保证）。

## Unity 侧

见 `unity-side.md`。

## 热重载报 `ReferenceError: X is not defined`（导出常量）

现象：`export const A = 1, B = 2, C = 4` 只有第一个能用，其余在运行时未定义，tsc 不报错。原因是开发期转译器 sucrase 的缺陷，devtools 现已在转译前自动改写，正常写即可。若仍遇到（例如用的是旧 Runner），先确认 Runner 带的是新版 `devtools.cjs`，或临时拆成每条 `export const` 只声明一个变量。

## 自建粒子：把实例数据塞进普通顶点属性

没有实例化与自定义属性时，每个粒子展开成 4 个顶点：position 放中心，normal 放拉伸轴或 (滚转, 年龄, 明暗)，uv 放 (模式·32 + 帧·4 + 角点, 尺寸)，color 放 rgba。注意 color 的 rgb 会被逐分量 sRGB→线性（不截断），在顶点着色器里做线性→sRGB 逆变换即可取回原值。参考 `games/jimao/src/lib/fx.ts`。

## 射线打地面"未命中"

地坪若用 `collider: false` 的大平面（如 jimao 的 apron），`scene.raycast` 打不到地面。给射线传 `planes`，例如 `scene.raycast(o, d, { planes: [{ y: 0, region: { maxX: 30 }, tag: 'ground' }, { y: -1.6, region: { minX: 30 }, tag: 'water' }] })`，与碰撞体命中一起取最近，平面命中带回 `tag`（见 jimao 的 `weapon.ts`）。

## 积水算了涟漪法线，倒影却纹丝不动

`pot_Lit` 只按法线把倒影采样点平移约 0.05·距离，细小涟漪几乎看不出。要让倒影晃动，给 `s.planarOffset` 赋屏幕 uv 偏移（原版 three 的 RR 做法：法线投到视线前方/侧方，乘 `(积水 + 0.03)/(1 + 距离·0.07)`，钳到 ±0.12）。参考 `games/jimao/data/shaders/apron.frag`。

## 刚性多足角色传送后腿被拉直、身体悬空

步态记录的是落脚点的世界坐标，实体被直接改位置（出生、复活、存档恢复、调试传送）后脚还停在旧处，IK 把腿拉到极限。每帧检查脚与机身标准落点的水平距离，超过一步长（jimao 猎犬取 1.2 m）就整体重置落脚点并清步态相位。参考 `games/jimao/src/lib/hound.ts`。

## 四足/车式移动横着走、倒着走

朝向与速度方向各算各的，转向又有限速时，就会看到机身侧滑。原版做法：速度只沿机身前方，大小乘 `max(0, cos(朝向差))`，朝向用带阻尼的角速度追目标。

## PowerShell `-replace` 不区分大小写

调试时用 `(Get-Content -Raw x.js) -replace 'YAW', '0'` 做模板替换，会把 `p.yaw` 一起换掉导致语法错误。用 `-creplace`。

## 画面全是洋红（粉紫色）

现象：物体都是纯洋红色，日志无报错。这是 Runner 自身缺陷（着色器没打进 Runner），不是游戏代码问题，游戏侧无法也不应修复：游戏不能新增 Unity 着色器（自定义效果用 `ctx.gfx` 的 GLSL，那条路径不会洋红）。遇到时把截图和日志反馈给 Runner 维护者。

（Runner 维护者注意：Runner 内置着色器必须放在 core 的 Resources 或 Always Included 中；构建 Runner 不要加 `-nographics`，否则着色器不会编译。）

## 热重载一次要好几秒

单元每次热重载都会重新执行，里面的 `scene.mesh` 会把网格重新生成并上传一遍。大网格这样写：`scene.mesh(name, () => toMesh(geo), { key })`。key 相同时 Runner 直接复用已有网格，生成函数不会被调用。key 要随内容变化：建模代码放在 `src/lib/*.ts` 里，在模块顶层取一个随机戳（jimao 的 `moduleStamp()`），共享模块只有自己或依赖改动时才重新执行，所以戳正好在"建模代码没动"的热重载之间保持不变。着色器不用处理，源码没变 Runner 不会重编。jimao 的 world 单元由此从约 6.3 秒降到约 0.2 秒。

## 多部件角色每帧同步变换很慢、渲染器很多

刚性分件的角色（机器狗）不要每个"骨骼 × 材质"建一个网格实体再逐个设变换。做法：每种材质合成一个带 `boneIndices` 的网格（jimao 的 `skinMesh()`），`spawn({ shape, bones })` 建成蒙皮网格；每帧把所有骨骼的世界变换写进一个 `Float32Array`，调一次 `scene.setTransforms(ids, data)`。注意：
- `bones` 的顺序就是 `boneIndices` 里的下标；不给 `bindPoses` 时顶点必须已经在各自骨骼的局部空间里（three 里挂在骨骼下的几何体经 `toMesh` 后正好满足）。
- 蒙皮实体不能用运行时着色器（`entity.shader` 会抛错），这类部件保持刚性分件，挂在骨骼实体下。
- 蒙皮实体没有碰撞体。命中体用 `spawn({ visible: false, collider: true, parent: 骨骼 })`，不要再用"全黑叠加材质"假装隐藏，那样仍然会被绘制。
- `setTransforms` 的四元数是 Unity 坐标系：three 的世界矩阵先做 `S·M·S`（S 为 z 取反）再 decompose，分量可直接使用（jimao 的 `writeUnityTRS()`）。

## 启动很慢、窗口像卡死

启动时所有单元的 apply 在一次同步调用里跑完，期间窗口不刷新。做法：把重的单元写成 `async apply`，阶段之间 `await ctx.loading.step('阶段', 进度)`；大循环用 `for` 并在循环体里 step（不要用 `forEach`，回调里不能 await）。父单元按顺序 `await ctx.use('子单元')`。注意：
- 在 await 之后注册的 `ctx.on('update')`、`ctx.effect` 照常生效，`update` 用到的变量在 await 前后都可访问。
- 其他单元在启动期间读 `ctx.state` 时，被 await 中的单元可能还没 define 好，读时要判空（jimao 的 `game(ctx)?.`）。
- 运行时着色器的编译结果缓存在 `persistentDataPath/cache/shaders`（按后端、编译器版本和源码哈希），第二次打开不再编译。怀疑缓存有问题时删掉这个目录即可；启动日志 `[pot] 游戏已启动（X 秒，着色器缓存命中 a/b）` 可以看命中情况。jimao 由此从 9.8 秒降到 3.8 秒。
