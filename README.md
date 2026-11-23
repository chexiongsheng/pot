# pot

面向 AI 的 Unity 游戏开发框架，基于 Puerts。

名字取自普洱（Puerts 名字的来源）的茶壶：Runner 是壶，游戏包是茶。用 JS/TS 代码和 JSON 配置写成的游戏包，由 Runner 直接加载源码（内置 TS 转译）、监听变化并热重载。Dev Server 只是 AI 与 Runner 之间的可选通道：AI 通过 MCP/CLI 读取日志和截图、操作游戏，形成开发闭环；人不开 Dev Server 也能在电脑或手机上试玩。发布时用 Unity 正常打包成独立 App。

## 文档

- [001 Game Runner 总体设计](docs/001-game-runner-design.md)
- [002 热重载设计（基于 cordis）](docs/002-hot-reload-design.md)
- [003 自动发布打包](docs/003-release.md)
- [pot-game-dev Skill](skills/pot-game-dev/SKILL.md)

## 目录

| 目录 | 内容 |
|---|---|
| `packages/` | Unity 包：`com.pot.core`、`com.pot.devtools`、`com.pot.runner-shell`、`com.pot.build` |
| `runner/` | Runner Unity 工程 |
| `player/` | 通用发布壳工程（core + build + Puerts + URP），无需按游戏新建 Unity 工程 |
| `js/` | `@pot/core` 运行时、devtools、Dev Server（CLI + MCP）、测试 |
| `games/hello` | 示例游戏 |
| `skills/pot-game-dev` | AI 开发用 Skill |
| `tools/` | 辅助脚本 |

## 快速开始

环境：Node 22、Unity 2022.3、Puerts 3.0.3（core + v8）。

```powershell
# 1. 安装 Puerts 到 third_party（目录中需含 core/ 和 v8/）
powershell -File tools/install-puerts.ps1 -Source <Puerts 包目录>

# 2. 构建 JS 运行时并测试
cd js; npm install; node scripts/build.js; node --expose-gc --test "test/*.test.js"; cd ..

# 3. 构建 Runner（不要加 -nographics，否则内置着色器不会编译）
Unity -batchmode -quit -projectPath runner -executeMethod RunnerBuild.BuildWin64

# 4. 直接用 Runner 打开游戏试玩：不需要 Dev Server，改 games/hello/src/**/*.ts、data/*.json 自动热重载
runner/Builds/Win64/PotRunner.exe games/hello
#    不带参数启动则显示首页：输入目录 / .potg / URL 打开，或点最近打开

# 5. 需要 AI 参与时再启动 Dev Server（AI ↔ Runner 通道，不需要游戏路径）。Runner 会在后台自动连上
node js/devserver/cli.js dev
node js/devserver/cli.js open games/hello     # 让 Runner 打开（切换）游戏
node js/devserver/cli.js status               # lastReload、当前游戏
node js/devserver/cli.js logs
node js/devserver/cli.js check games/hello    # 类型检查 + 试打包
```

手机：Runner 面板（F1 / 三指触摸）里填电脑的 `IP:7788`，之后 `pot open games/hello` 会让手机从 `http://电脑IP:7788/files/games/hello/` 镜像游戏并每秒同步变化；也可以在首页直接输入这个 URL。

MCP：`node js/devserver/cli.js mcp --port 7788`（stdio）。

发布（自动编译 TS、读取 manifest 配置并调用 Unity 批处理，无需打开编辑器）：

```powershell
node js/devserver/cli.js release games/saltline --platform win64
node js/devserver/cli.js release games/saltline --platform win64,android,webgl
# 可选：--unity "D:\...\Unity.exe" --out D:\build\saltline
```

产物默认在 `release/<游戏名>/<平台>/`。manifest 字段、平台要求与限制见 [自动发布打包](docs/003-release.md)。

## 状态

Win64 Runner 与发布构建、Android APK 构建、WebGL 浏览器运行已跑通；运行时着色器（`ctx.gfx`）支持 D3D11 与 WebGL2（GLES3）。Android 真机待验证。实现情况见 001 第 16 节、002 第 16 节。
