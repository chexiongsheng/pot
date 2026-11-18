# 坑点库

格式：现象 / 原因 / 做法 / 来源。能由框架消除的坑改框架，并标注“已由框架保证”。

## 游戏代码

### state 里放了 Entity 或函数
- 现象：`define` 或热重载快照时报“不可序列化”并给出路径。
- 原因：state 要能深拷贝、存档、冷重启恢复。
- 做法：只存位置、id、名字等描述；Entity 放闭包里，apply 时重建。
- 来源：设计约定，运行时 `assertSerializable` 检查（已由框架保证报错）。

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

- 目前只支持 Windows D3D11；其他平台 `ctx.gfx.supported` 为 false，要提供普通材质的退路。
- 用自定义着色器的物体可以接收主光阴影（`pot_Lit` 已包含），但不进 SSAO，也不会出现在平面反射里；附加光（点光、聚光）没有阴影。
- 用 `pot_DefaultSurface()` 初始化 `PotSurface`，不要逐字段手写，否则新增字段（如 `planar`）会是未定义值。
- 移植 three.js 的 `onBeforeCompile` 补丁：改 `directSpecular` 用 `s.specular`/`s.specularMax`；在 `opaque_fragment` 前改 `outgoingLight` 用 `pot_LitColor` 后自己 `pot_ApplyFog`；`s.ao` 同时影响环境漫反射和环境反射、不影响直射，与 three 的 `radiance *= k; iblIrradiance *= k` 不同，后者应折算为 `albedo *= k; specular *= k`。
- 移植时 three 的 `vGWorld`/`cameraPosition` 用 `(x, y, -z)` 换算，法线 `(nx, ny, nz)` 换回 Unity 是 `(nx, ny, -nz)`；自定义网格按 z 取反并反转三角形绕序。
- 没有实例化：原版 `InstancedBufferGeometry` + 每实例属性（雨、溅射、粒子）要把实例展开成普通网格，每个实例重复写它的顶点，实例数据塞进 `normals`（3 个浮点，原样传递）和 `uvs`（2 个浮点）；不要用 `colors`，会被当作 sRGB 转线性。
- 顶点着色器重算位置（以相机为中心循环、广告牌）时网格包围盒不可信，物体会被视锥剔除而时有时无：绑定时加 `frustumCull: false`（对应 three 的 `frustumCulled = false`）。
- three 的 `AdditiveBlending` 即 `blend: 'add'`（SrcAlpha, One）；`fov` 没有内置量，`2·tan(fov/2)` 用 `2.0 / abs(pot_Proj[1][1])` 求。
- `gl_FragCoord.y` 方向与 WebGL 相反（原点在左上），移植屏幕空间效果时用 `pot_ScreenSize.y - gl_FragCoord.y`。
- 编译错误不会让画面消失：日志和错误浮层给出 `文件:行号`，旧版本继续绘制，改好即恢复。
- 片元着色器没用到的 uniform 会被编译器剔除，对它调用 `uniforms` 不报错也无效果。
- `gfx.bake` 的 `vUv` 与采样坐标一致（`vUv.y=0` 即贴图 `v=0`），不要再手动翻 y；颜色目标用 `format: 'srgb'` 并输出线性值，数据目标（遮罩、高度、法线）用 `rgba8`。
- 程序化材质优先 GPU 烘焙（原版 three.js 的 RenderTarget + 全屏 pass 可直接对照 `gfx.bake` 机械移植），CPU 逐像素生成 1024² 贴图要几秒；作为中间结果的 MRT 用 `filter: 'point', mipmaps: false`。

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

## 工具与环境

### 类型检查用错 tsc
- 做法：用 `js/node_modules/.bin/tsc --noEmit -p games/<id>/tsconfig.json`，全局 tsc 版本可能不一致。

### 自动化输入没反应
- 原因：Runner 窗口不在前台时收不到系统按键。
- 做法：调试时用 `eval` 改 state（如 phase、yaw、health）再截图。

### PowerShell 改含中文的文件后乱码
- 原因：Windows PowerShell 5 的 `Set-Content`/`Get-Content` 默认不是 UTF-8。
- 做法：用编辑器或文件工具修改源码；`.ps1` 脚本保持纯 ASCII（PS5 按 ANSI 读取无 BOM 文件）。

### cordis 内部错误没有日志
- 原因：cordis 默认 logger 不输出。
- 做法：Runner 已把 logger 接到 `logs`（已由框架保证）。

## Unity 侧

见 `unity-side.md`。

## 画面全是洋红（粉紫色）

现象：物体都是纯洋红色，日志无报错。这是 Runner 自身缺陷（着色器没打进 Runner），不是游戏代码问题，游戏侧无法也不应修复：游戏不能新增 Unity 着色器（自定义效果用 `ctx.gfx` 的 GLSL，那条路径不会洋红）。遇到时把截图和日志反馈给 Runner 维护者。

（Runner 维护者注意：Runner 内置着色器必须放在 core 的 Resources 或 Always Included 中；构建 Runner 不要加 `-nographics`，否则着色器不会编译。）
