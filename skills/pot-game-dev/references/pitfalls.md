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
- 做法：需要的算法自己写进 `src/lib/`。

### 导出 name 与文件名不一致
- 现象：预加载失败，“单元文件名是 x，但导出的 name 是 y”。
- 做法：`export const name` 与文件名保持一致（已由框架检查）。

### state 结构改了但没升版本
- 现象：读到 undefined 字段或旧结构。
- 做法：结构变化时 `version + 1` 并写 `migrate`。

### 主相机位置在热重载后不对
- 原因：主相机不归任何单元，不会被重建或还原。
- 做法：在负责场景的单元 apply 里每次都设置相机。

## 工具与环境

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
