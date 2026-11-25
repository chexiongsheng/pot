---
name: pot-game-dev
description: 用 pot（Unity + Puerts + cordis）开发游戏包时使用：编写 src/plugins/*.ts 游戏单元、src/lib 共享代码、data/*.json 数据，借助 Runner 自带的热重载和 Dev Server 的 CLI/MCP 打开游戏、查看日志、截图、注入输入、读写 state，以及类型检查与发布构建。涉及 pot、Runner、游戏单元、ctx.scene/ctx.state、pot dev/pot open/pot check/pot build 时触发。
---

# pot 游戏开发

pot 的游戏包是一个目录：`manifest.json` + `src/plugins/*.ts`（每个文件一个热重载单元）+ `src/lib/**`（共享代码）+ `data/*.json`。Runner 直接读取源码（内置 TS 转译，报错行号就是源码行号），自己监听文件变化，在 1 秒内热替换受影响的单元，state 保留；新代码出错会自动回滚到旧版本。Dev Server 只是 AI 与 Runner 之间的通道，不参与加载游戏。

## 必须遵守的规则

1. 持久数据只放 `ctx.state.define(key, { version, init, migrate })` 返回的活对象里，直接修改它。闭包和模块顶层只放能随时重建的东西。
2. state 只放可序列化数据（JSON 值 + TypedArray）。不放 Entity、函数、类实例、Promise；场景对象存位置等描述，重建时据此恢复。init 必须返回对象或数组，标量包一层 `{ value: 0 }`。
3. 所有副作用通过 ctx 注册：`ctx.on('update', ...)`、`ctx.timeout`/`ctx.interval`、`ctx.scene.spawn`、`ctx.effect`。不要用全局 `setTimeout`/`setInterval`，不要往 `globalThis` 挂东西。
4. 模块顶层不能有副作用，只写 import、导出、常量和纯函数。
5. 导出格式固定：`export const name = '<与文件名相同>'` + `export function apply(ctx, config) {}`。name 与文件名不一致会报错。
6. 单元之间不 import 值，只 `import type`。子单元用 `ctx.use('enemy', config)` 挂载；跨单元读数据用 `ctx.state.get('player')`。多个单元要共用的函数、常量放 `src/lib/`，用相对路径 import；改了它会热重载所有用到它的单元。
7. 结构变化时把 state 的 `version` 加 1 并写 `migrate`，否则会被重新初始化（有 warning 日志）。
8. 场景是 state 的投影：apply 里根据 state 重建场景，update 里把变化写回 state。
9. 不要持有入口 fiber、旧 ctx 或模块对象的长期引用（会导致旧版本无法回收，`leaks` 会报出来）。
10. 数据驱动的数值放 `data/*.json`，用 `ctx.data.load('x.json')` 读取；改数据会自动重载读取过它的单元。
11. 只能 import 相对路径和 `@pot/core`（类型）。不能用 npm 包、Node API；外观只能通过 Game API 表达，游戏不能新增 Unity 着色器或 C#。

## 开发闭环

```powershell
node <pot>/js/devserver/cli.js dev            # 启动 Dev Server（后台运行，不需要游戏路径）
# Runner（PotRunner.exe、编辑器 Play 或手机 App）会在后台自动连上 ws://<电脑IP>:7788/runner
node <pot>/js/devserver/cli.js open games/<game>   # 让 Runner 打开游戏（相对 Dev Server 的 --root，默认当前目录）
```

人也可以不开 Dev Server，直接 `PotRunner.exe games/<game>` 试玩，效果相同。

改完文件后不需要手动触发重载，按下面顺序确认结果：

1. `pot check games/<game>`：tsc 类型检查 + 试打包，Runner 运行前发现类型错误和缺失的单元。
2. `pot status`：看 `game`（当前游戏和状态）与 `lastReload`（ok、phase、rolledBack、error、paths、mounted、leaks）。
3. `pot logs --since <sn>`：增量读日志，报错栈第一行是 `src/...ts:行:列`。
4. 需要时验证行为：`pot input axis move 1 0 30`、`pot time step 10`（暂停并推进 10 个固定步，每步 `fixedStep` 秒、与 Runner 帧率无关，推进完才返回，结果可复现）、`pot state get player`、`pot query objects player`、`pot eval "<js>"`、`pot screenshot out.png`。
5. 需要“新开一局”时 `pot restart --reset`；只想冷重启保留 state 用 `pot restart`。切换游戏用 `pot open <目录>`。

启动时就失败的单元（如语法错误）修好后保存即可自动挂载，不需要重启。

MCP 方式：`pot mcp --port 7788` 提供同名工具（`pot_status`、`pot_open`、`pot_check`、`pot_logs`、`pot_state`、`pot_input`、`pot_screenshot` 等）。

## 详细参考（按需读取）

- `references/api.md`：Game API（scene、state、data、cache、input、timer、clock）的语义。
- `references/hot-reload.md`：热重载流程、失败结果怎么读、冷重启与泄漏检查。
- `references/pitfalls.md`：坑点库。遇到新坑按“现象、原因、做法、来源”追加。
- `references/unity-side.md`：Runner、Unity 包、发布构建与 C# 侧注意事项。
- `templates/plugin.ts`、`templates/game/`：新单元与新游戏包模板。
