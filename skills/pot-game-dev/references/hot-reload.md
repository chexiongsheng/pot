# 热重载

## 范围

| 改动 | 方式 |
|---|---|
| `src/plugins/x.ts` | 热重载 x |
| 被单元 import 的共享 .ts | 热重载所有打包了它的单元 |
| `data/*.json` | 热重载读取过该文件的单元 |
| `manifest.json` | 冷重启（保留 state） |
| C#、Runner 包 | 重新构建 Runner |

## 流程

预加载新模块（读取导出并校验）→ 快照涉及单元的 state → 冻结时钟 → dispose 旧 fiber、挂载新版本 → 提交（释放旧模块，登记泄漏哨兵）→ 解冻。任一步失败：dispose 新 fiber、恢复 state 快照、重新挂载旧版本。

## 读结果

`pot status` 的 `lastReload.data`：

| 字段 | 含义 |
|---|---|
| `ok` | 是否切到新版本 |
| `phase` | 结束阶段：preload（模块执行或导出格式错误）、apply（apply 抛错）、commit（成功） |
| `rolledBack` | 是否已回滚到旧版本 |
| `error` | 错误和映射回 TS 的栈，第一行 `src/plugins/x.ts:行:列` 就是出错位置 |
| `skipped` | 内容 hash 未变而跳过的单元 |
| `leaks` | 未被回收的旧版本线索 |

编译错误不会推到 Runner，而是出现在 `status.buildErrors`，旧版本继续运行。

## 冷重启

`pot load`：导出 state 为 JSON → 销毁 JS 环境 → 新建环境并加载最新代码 → 恢复 state。`pot load --reset` 清空 state，相当于新开一局。

## 泄漏检查

`pot leaks`：`objects` 是 JS 侧登记的场景对象数，`engineObjects` 是 Unity 侧实际数量，两者应相等；`timers` 是排队中的定时器。`lastReload.leaks` 不为空说明旧模块或旧 fiber 仍被引用，通常是挂到了全局变量、外部数组，或绕过 ctx 注册了回调。
