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

现象：物体都是纯洋红色，日志无报错。这是 Runner 自身缺陷（着色器没打进 Runner），不是游戏代码问题，游戏侧无法也不应修复：游戏不能新增 Unity 着色器，外观只能通过 Game API 的材质参数和数据表达。遇到时把截图和日志反馈给 Runner 维护者。

（Runner 维护者注意：Runner 内置着色器必须放在 core 的 Resources 或 Always Included 中；构建 Runner 不要加 `-nographics`，否则着色器不会编译。）
