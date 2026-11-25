# 写这个游戏之前

本游戏用 pot 的高层写法（`defineGame` + TSX）。完整说明见 Skill `pot-game-dev`（`SKILL.md` 的“高层写法”一节和 `references/world.md`）。

## 五条规矩

1. 属性是初值，不是受控值。`<Player at={[0, 0.5, 0]} />` 不会每帧把玩家拉回原点。
2. 世界不走“每帧渲染再对比”。逐帧逻辑写在积木的 `step` 里，`scene` 不读运行状态。
3. 没有 hooks。`scene`、`ui` 和函数组件是纯函数；运行状态只放 `vars` 和积木状态，界面本地状态放 `ui.local`。
4. 能换成 C# 实现的只有 `defineBlock` 定义的积木，大写的函数组件永远是 TS。
5. 积木名、预制件名、事件名用驼峰标识符，不用点号和连字符。

界面回调（`onPress`、`onChange`、`onSubmit`）只改 `ui.local` 或调 `ui.emit`，不直接改 `w.vars`；要改 World 就发事件，由 `<rule on="事件名">` 或 `flow` 的 `on` 处理。

## 命令（在 pot 的 js 目录下，或用 `pot` 别名）

```powershell
node devserver/cli.js blocks --dir <游戏目录> [关键字]   # 先查有哪些积木、预制件、界面标签
node devserver/cli.js check <游戏目录>                  # 类型检查 + 逐个流程状态求值，生成 .pot/types.d.ts
node devserver/cli.js test <游戏目录> [--update]        # 跑 tests/*.json，--update 写回哈希
node devserver/cli.js open <游戏目录>                   # 让 Runner 打开，实机看效果
```

`.pot/` 是生成的，不入库。新增变量先写进 `vars` 再跑 `check`。
