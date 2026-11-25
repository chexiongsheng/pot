# 高层写法参考（defineGame + TSX）

主文件 `SKILL.md` 的“高层写法”一节是规矩和流程，这里是细节。积木、预制件和界面标签的完整清单以 `pot blocks` 为准，本文不罗列系统积木的全部字段。

## 游戏的骨架

一个游戏单元 `src/plugins/game.tsx` 默认导出 `defineGame(...)`，`manifest.json` 的 `plugins` 写 `["game"]`。

```tsx
import { defineBlock, defineGame, definePrefab } from '@pot/core'

export default defineGame({
  vars: { score: 0 },                       // World 的运行变量（存在 state 里），w.vars 读写
  controls: { actions: { pause: 'escape' } },// 指令映射：axes 轴名 → 输入轴，actions 动作名 → 按键
  blocks: [myBlock],                        // 游戏自写的积木（defineBlock）
  flow: { start: 'title', states: { ... } },// 流程，见下文
  scene: (s) => <>...</>,                   // 场景树：s.state、s.params、s.data
  ui: (w, ui) => <>...</>,                  // 界面树：每帧求值
})
```

缺省指令：轴 `move`、`look`，动作 `jump`（空格）、`fire`（鼠标左键）。

## 积木与预制件

- `defineBlock({ name, about, props, state, order, init, step, view })`：`props` 是来自标签的属性及缺省值（只读），`state` 是积木自己的可写状态。`step(me, e, w)` 每个固定步调用，`me` 是属性与状态合在一起的对象，`e` 是实体数据（`e.pos`、`e.rot`、`e.tags`、`e.b`）。`step` 只读写实体数据和 `w`，不碰 `ctx.scene`，随机数用 `w.rand`，不用 `Math.random`、`Date`。
- `definePrefab('coin', { is, tags, about, ...积木 })`：一组积木的组合，返回值可直接当大写标签 `<Coin />`，也可写进 `rule` 的 `a`、`b` 和 `w.spawn`。`is` 继承另一个预制件，积木字段深合并，写 `false` 去掉继承来的积木。
- 实体标签的公共属性：`key`、`at`、`rot`（欧拉角，度）、`scale`、`name`、`tags`，其余属性名就是积木名，值是该积木属性的部分覆盖（`true` 表示用缺省值）。
- 系统层只有 `entity` 预制件和一组通用积木（`shape`、`spin`、`trigger`、`lifetime`、`projectile`、`light`）。游戏同名定义会覆盖系统的。
- 玩法相关的积木放在套件里，按需引入：`import topdown from '@pot/kit/topdown'`，再写 `defineGame({ kits: [topdown], ... })`。`topdown` 提供 `moveTopdown`、`cameraFollow`。`pot blocks` 会列出全部套件和它们的积木（未引入的标“未引入”并给出写法）；要改套件代码用 `pot eject --kit <名字>` 复制进游戏。

## 场景树

- 标签：实体（`<entity>`、预制件标签）、`<stage>`（`background`、`sun`、`camera: { at, look }`，最多一个）、`<rule>`。
- `scene` 只在挂载和流程“进入”时求值；它是纯函数，按 `s.state` 决定放什么，属性只是初值。
- `map` 出来的实体要写 `key`，否则 `pot check` 告警；身份按 key 路径记，热重载时没变的实体保留。
- 运行中生成用 `w.spawn(Coin, { at })`，这些实体不在树里，流程“进入”时被清掉。

## 规则

```tsx
<rule on="touch" a={Player} b={Coin} do={(w, p, c) => { w.destroy(c); w.vars.score++ }} />
<rule on="every" seconds={2} do={(w) => w.spawn(Coin, { at: [w.rand(-8, 8), 0.5, 4] })} />
<rule on="answer" do={(w, payload) => { ... }} />
```

事件：`touch`（两个触发区开始重叠，参数为两个实体）、`death`（实体被销毁）、`every`（定时）、自定义事件（`w.emit`、`ui.emit`，参数为 payload）。规则随所在子树生效和失效，放在 `s.state === 'play' && ...` 里就只在该状态有效。

## World（`w`）

| 成员 | 说明 |
|---|---|
| `w.vars` | 运行变量，类型来自 `.pot/types.d.ts`（`pot check` 生成） |
| `w.tick`、`w.time`、`w.dt` | 步数、模拟时间、固定步长 |
| `w.spawn(预制件, 属性)`、`w.destroy(实体)` | 生成、销毁（销毁在本步末尾生效） |
| `w.get(id)`、`w.query(筛选)`、`w.count(筛选)` | 筛选为标签或预制件名 |
| `w.emit(名字, payload)`、`w.on(事件, [筛选], fn)` | 自定义事件 |
| `w.cmd()` | 本步指令：`axis(名)`、`down(动作)`、`pressed(动作)` |
| `w.rand()`、`w.rand(min, max)` | 确定性随机数 |
| `w.flow`、`w.goto(状态, 参数?)` | 流程，见下文 |

## 流程

```tsx
flow: {
  start: 'title',
  states: {
    title:  { on: { start: 'play' } },                       // 事件名 → 目标状态
    play:   { on: { pause: 'paused', allCoins: 'over' }, enter: (w) => { w.vars.score = 0 } },
    paused: { pause: true, on: { resume: 'play', quit: 'title' } }, // 叠加状态：不重建场景，模拟暂停
    over:   { on: { again: 'play', quit: 'title' } },
  },
}
```

- 自定义事件先交给规则，再查当前状态的 `on`；payload 是普通对象时成为新状态的 `params`（`w.flow.params`、`s.params`）。
- “进入”一个非叠加状态会清掉 `w.spawn` 的实体、按新状态重新求值 `scene`，然后调 `enter`。从叠加状态回到原状态（不带参数）是“恢复”，场景不动。
- `w.flow.state` 是当前状态（含叠加），`w.flow.base` 是场景所按的状态。
- `w.goto` 在步末应用，一步里多次以最后一次为准。流程状态存在 state 里，热重载保留。

## 界面

`ui: (w, ui) => 树` 每帧求值。`ui` 提供：`width`、`height`、`local`（界面本地状态，热重载保留，不属于 World）、`emit(名字, payload)`（进入下一步的指令，可录制回放）、`focused`、`data`、`draw`（原始低层绘制，逃生口）。

规矩：回调（`onPress`、`onChange`、`onSubmit`）只改 `ui.local` 或调 `ui.emit`，不直接改 `w.vars`。界面里读 `w` 可以，写 World 一律经事件。

通用属性：`at`（只对顶层：九宫格名或 `[x, y]`，缺省 `top-left`）、`w`、`h`（像素或 `'50%'`）、`grow`、`pad`、`hidden`、`key`。容器属性：`gap`、`align`（交叉轴 `start` `center` `end` `stretch`）、`justify`（主轴 `start` `center` `end` `between`）。

| 标签 | 要点 |
|---|---|
| `row`、`column` | 横向、纵向排列，不画东西 |
| `panel` | 带底色的纵向容器，缺省 `pad` 12、`gap` 8；`bg`、`border`、`radius` |
| `text` | 子节点的字符串和数字拼起来；`size`、`color`、`bold`、`align`；`wrap` 换行需要确定的宽度（写 `w`，或父容器 `align="stretch"`） |
| `button` | `emit`、`payload`、`onPress`、`disabled`、`bg`、`color`；点击或焦点上按 Enter、空格触发 |
| `bar` | 进度条：`value`、`max`、`color`、`bg` |
| `image` | `src` 为低层贴图，`fit`、`tint`、`radius` |
| `scroll` | 纵向滚动，`h` 必填；滚轮、拖动 |
| `input` | 受控单行输入：`value`、`onChange(新值)`、`onSubmit(值)`、`placeholder`、`max` |

焦点：按钮和输入框按树的顺序可聚焦，Tab 与方向键移动，Esc 取消。有焦点时键盘和轴不进游戏指令；没有焦点时界面不占键。

函数组件是普通 TS 函数，可以把 `children` 转放到别的标签里：

```tsx
const Menu = (p: { title: string; children?: any }) =>
  <panel at="center" w={320} align="stretch" gap={12} pad={24}>
    <text size={36} bold align="center">{p.title}</text>
    {p.children}
  </panel>
```

列表（`map` 的结果）里的界面节点要写 `key`，焦点、滚动位置、按下状态都按 key 路径记。

## 数据与覆盖层

- `s.data.load('x.json')`、`ui.data.load('x.json')` 读 `data/` 下的 JSON，改文件即热重载。
- `data/overrides.json`：按挂载和 key 路径给实体打补丁（调参不改源码）。`pot world set <路径> '<补丁 JSON>' [--save]` 在运行期试，`--save` 写进文件。

## 检查与测试

1. `pot blocks --dir <游戏>`：列出系统与游戏的积木、预制件、界面标签；`--name <名字>` 看单项。
2. `pot check <游戏>`：tsc + 无画面求值（开始状态推进 2 步，再逐个切到其余流程状态各推进 2 步），报树求值错误、未知标签与积木、缺 `key`；生成 `.pot/types.d.ts`（不入库，`tsconfig.json` 的 `include` 要有 `.pot/*.d.ts`）。
3. `pot test <游戏> [--update]`：跑 `tests/*.json`，同样的输入每次结果相同。

```json
{
  "name": "开始后吃第一个金币",
  "steps": 120,
  "input": [
    { "at": 0, "emit": "start" },
    { "at": 2, "axis": { "move": [0.83, 0.55] } },
    { "at": 50, "down": ["pause"] }, { "at": 51, "up": ["pause"] },
    { "at": 80, "emit": { "name": "answer", "payload": { "choice": 1 } } }
  ],
  "expect": { "vars": { "score": 1 }, "count": { "coin": 4 }, "flow": "play", "hash": "308d9a76" }
}
```

`at` 是固定步号；`axis` 设置后保持；`emit` 只在那一步。`expect.vars` 按子集比较，运行中任何 error 日志都算失败。`--update` 写回 `hash`。

4. Runner 实测：`pot open <游戏>`，`pot query world`、`pot query tree`、`pot input text <文字>`（给输入框键入）、`pot screenshot`。录一段可回放的脚本：`pot record start --reset`，手动玩，`pot record stop tests/x.json`。
