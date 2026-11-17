# pot

面向 AI 的 Unity 游戏开发框架，基于 Puerts。

名字取自普洱（Puerts 名字的来源）的茶壶：Runner 是壶，游戏包是茶。用 JS/TS 代码和 JSON 配置写成的游戏包，在 Runner 里加载、热重载、预览。AI 通过 MCP/CLI 读取日志和截图、操作游戏，形成开发闭环；人可以在电脑或手机上实时试玩、提意见。发布时用 Unity 正常打包成独立 App。

## 文档

- [001 Game Runner 总体设计](docs/001-game-runner-design.md)
- [002 热重载设计（基于 cordis）](docs/002-hot-reload-design.md)
- [pot-game-dev Skill](skills/pot-game-dev/SKILL.md)

## 目录

| 目录 | 内容 |
|---|---|
| `packages/` | Unity 包：`com.pot.core`、`com.pot.devtools`、`com.pot.runner-shell`、`com.pot.build` |
| `runner/` | Runner Unity 工程 |
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

# 3. 启动 Dev Server
node js/devserver/cli.js dev games/hello --port 7788

# 4. 运行 Runner：用 Unity 打开 runner/ 点 Play，或构建后运行
#    Unity -batchmode -quit -projectPath runner -executeMethod RunnerBuild.BuildWin64
#    runner/Builds/Win64/PotRunner.exe -potServer=ws://127.0.0.1:7788/runner

# 5. 修改 games/hello/src/plugins/*.ts，自动热重载；查看结果
node js/devserver/cli.js status
node js/devserver/cli.js logs
```

MCP：`node js/devserver/cli.js mcp --port 7788`（stdio）。

发布：

```powershell
Unity -batchmode -quit -projectPath runner -executeMethod Pot.Build.PotBuild.Build `
  -potGame=D:\path\to\pot\games\hello -potOut=D:\path\to\pot\release\hello\Hello.exe -potTarget=Win64
```

`-potGame`、`-potOut` 请用绝对路径（Unity 的工作目录是工程目录）。

## 状态

原型 v0.1：Win64 Runner 与发布构建已跑通，移动端待验证。实现情况见 001 第 16 节、002 第 16 节。
