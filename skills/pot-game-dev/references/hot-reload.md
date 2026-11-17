# 热重载

Runner 自己监听游戏目录（本地目录用文件监听，手机镜像目录每秒轮询 Dev Server 的 `/files/`），变化去抖 150ms 后热重载。不依赖 Dev Server。

## 范围

| 改动 | 方式 |
|---|---|
| `src/plugins/x.ts` | 热重载 x |
| `src/lib/**` 等被 import 的共享模块 | 热重载所有直接或间接 import 它的单元 |
| `data/*.json` | 热重载读取过该文件的单元 |
| `manifest.json` | 冷重启（保留 state） |
| 启动时失败的入口单元 | 任意文件变化后重试挂载，修好即恢复 |
| C#、Runner 包 | 重新构建 Runner |

## 流程

预加载新模块（转译、执行、读取导出并校验）→ 快照涉及单元的 state → 冻结时钟 → dispose 旧 fiber、挂载新版本 → 提交（释放旧模块，登记泄漏哨兵）→ 解冻。任一步失败：dispose 新 fiber、恢复 state 快照、重新挂载旧版本。

## 读结果

`pot status` 的 `lastReload`：

| 字段 | 含义 |
|---|---|
| `ok` | 是否切到新版本 |
| `phase` | 结束阶段：preload（语法错误、模块执行或导出格式错误）、apply（apply 抛错）、commit（成功） |
| `rolledBack` | 是否已回滚到旧版本 |
| `error` | 错误和栈，第一处 `src/plugins/x.ts:行:列` 就是出错位置（行号即源码行号） |
| `paths` | 触发本次重载的文件 |
| `skipped` | 内容 hash 未变而跳过的单元 |
| `mounted` | 本次重新挂载成功的、之前启动失败的单元 |
| `leaks` | 未被回收的旧版本线索 |

Runner 只做转译不做类型检查。类型错误用 `pot check <游戏目录>` 查。

## 冷重启

`pot restart`：导出 state 为 JSON → 销毁 JS 环境 → 新建环境并加载最新代码 → 恢复 state。`pot restart --reset` 清空 state 和存档，相当于新开一局。Runner 会把 state 存为存档（切换游戏、返回首页、切后台、退出和每 30 秒），下次打开同一游戏自动恢复；`pot open <目录> --reset` 不读存档。

## 泄漏检查

`pot leaks`：`objects` 是 JS 侧登记的场景对象数，`engineObjects` 是 Unity 侧实际数量，两者应相等；`timers` 是排队中的定时器。`lastReload.leaks` 不为空说明旧模块或旧 fiber 仍被引用，通常是挂到了全局变量、外部数组，或绕过 ctx 注册了回调。
