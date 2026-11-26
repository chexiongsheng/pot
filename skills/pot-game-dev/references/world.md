# 高层写法参考（defineGame + TSX）

主文件 `SKILL.md` 的“高层写法”一节是规矩和流程，这里是细节。积木、预制件和界面标签的完整清单以 `pot blocks` 为准，本文不罗列系统积木的全部字段。

## 游戏的骨架

一个游戏单元 `src/plugins/game.tsx` 默认导出 `defineGame(...)`，`manifest.json` 的 `plugins` 写 `["game"]`。

```tsx
import { defineBlock, defineGame, definePrefab } from '@pot/core'

export default defineGame({
  kits: [topdown],                          // 引入的套件，见“积木与预制件”
  vars: { score: 0 },                       // World 的运行变量（存在 state 里），w.vars 读写
  controls: { actions: { pause: 'escape' } },// 指令映射：axes 轴名 → 输入轴，actions 动作名 → 按键
  blocks: [myBlock],                        // 游戏自写的积木（defineBlock）
  flow: { start: 'title', states: { ... } },// 流程，见下文
  load: async (ctx, step) => { ... },       // 可选：挂载场景前的预载，见“加载进度”
  scene: (s) => <>...</>,                   // 场景树：s.state、s.params、s.data
  ui: (w, ui) => <>...</>,                  // 界面树：每帧求值
})
```

缺省指令：轴 `move`、`look`，动作 `jump`（空格）、`fire`（鼠标左键）。

## 积木与预制件

- `defineBlock({ name, about, props, state, order, init, step, view })`：`props` 是来自标签的属性及缺省值（只读），`state` 是积木自己的可写状态。`step(me, e, w)` 每个固定步调用，`me` 是属性与状态合在一起的对象，`e` 是实体数据（`e.pos`、`e.rot`、`e.tags`、`e.b`）。`step` 只读写实体数据和 `w`，不碰 `ctx.scene`，随机数用 `w.rand`，不用 `Math.random`、`Date`；三角函数用 `dmath.sin`、`dmath.cos`（`import { dmath } from '@pot/core'`），不用 `Math.sin`、`Math.cos`：不同 JS 引擎、原生实现之间 `Math.sin` 不保证逐位相同。`view` 里可以随便用 `Math`。`view.enter(me, e, ctx, w)`、`update(me, e, objs, ctx, w)`、`exit(me, e, objs, ctx, w)` 的 `ctx` 可用 `scene`、`audio`、`gfx`、`data`、`clock`、`input`、`ui`、`state`；音效、特效、震屏这类表现放在 view 里按状态变化触发，不放在 `step`。
- `definePrefab('coin', { is, tags, about, ...积木 })`：一组积木的组合，返回值可直接当大写标签 `<Coin />`，也可写进 `rule` 的 `a`、`b` 和 `w.spawn`。`is` 继承另一个预制件，积木字段深合并，写 `false` 去掉继承来的积木。
- 实体标签的公共属性：`key`、`at`、`rot`（欧拉角，度）、`scale`、`name`、`tags`，其余属性名就是积木名，值是该积木属性的部分覆盖（`true` 表示用缺省值）。
- 系统层只有 `entity` 预制件和一组通用积木（`shape`、`spin`、`trigger`、`lifetime`、`projectile`、`light`、`body`）。游戏同名定义会覆盖系统的。
- 碰撞在模拟侧：带 `body`（轴对齐的盒、球或竖直胶囊，可设 `layer`、`solid`）的实体进碰撞表。`w.move(e, mover, { radius, height, stepUp, layers, ground })` 做角色移动（`mover` 为 `{ vel, grounded }`，放在积木状态里）；`w.raycast(from, dir, maxDist, { layers, ignore, solid })` 返回最近的 `{ point, normal, dist, entity }` 或 null；`w.overlap({ kind: 'sphere', radius }, at)` 返回重叠的实体。三者都是纯 JS、可复现，玩法判定不要用 `scene.raycast`。
- 玩法相关的积木放在套件里，按需引入：`import topdown from '@pot/kit/topdown'`，再写 `defineGame({ kits: [topdown], ... })`。`topdown` 提供 `moveTopdown`、`cameraFollow`。`fps`（`import fps, { damage } from '@pot/kit/fps'`）提供 `moveFps`（第一人称走跑蹲跳，状态里有 `yaw`、`pitch`、`grounded`、`bob`，武器写 `aim`）、`cameraFps`（眼高相机，别的积木写 `shake`、`kick`）、`health`（扣血用 `damage(w, e, n, from)`，发 `damaged`、`died`，payload 为 `{ entity, amount, from }`）、`aiChase`、`aiPatrol`。`pot blocks` 会列出全部套件和它们的积木（未引入的标“未引入”并给出写法）；`realistic`（`import realistic from '@pot/kit/realistic'`）提供写实环境 `atmosphere` 和带材质预设的 `surface`，见下文“写实环境”。要改套件代码用 `pot eject --kit <名字>` 复制进游戏。
- 套件可以带数据文件（着色器、JSON）：`ctx.gfx.shader({ fragment: '@pot/kit/<名字>/shaders/x.frag' })`、`ctx.data.load('@pot/kit/<名字>/x.json')`。套件着色器里的相对 `#include` 留在套件内，游戏的着色器可以写 `#include "@pot/kit/<名字>/..."`。游戏的 `data/kits/<名字>/` 有同名文件时优先读它；`pot build` 把用到的套件资源复制进发布包，`pot eject` 把它们复制到 `data/kits/<名字>/`。

## 场景树

- 标签：实体（`<entity>`、预制件标签）、`<stage>`（`background`、`sun`、`camera: { at, look }`，最多一个）、`<rule>`。
- `scene` 只在挂载和流程“进入”时求值；它是纯函数，按 `s.state` 决定放什么，属性只是初值。
- `map` 出来的实体要写 `key`，否则 `pot check` 告警；身份按 key 路径记，热重载时没变的实体保留。
- 运行中生成用 `w.spawn(Coin, { at })`，这些实体不在树里，流程“进入”时被清掉。

## 写实环境（realistic 套件）

`atmosphere` 放在一个不带外形的实体上，管主方向光、天空、环境光、雾、后处理、天气和平面反射，实体销毁或热重载去掉时全部还原。`surface` 是带材质的外形。

```tsx
<entity key="env" atmosphere={{ preset: 'night', rain: 1, reflection: 0.5, lightning: { first: [3, 3], every: [6, 9] } }} />
<entity key="ground" scale={[40, 1, 40]} surface={{ kind: 'plane', material: 'wetGround' }} />
<entity key="box" at={[0, 1, 4]} surface={{ kind: 'cube', material: 'concrete', color: '#8c7a6a' }} />
<rule on="lightning" do={(w, p) => { /* p.entity、p.power（0..1）、p.delay：雷声延迟秒数 */ }} />
```

- `atmosphere.preset`：`dusk`（缺省，黄昏干燥）、`overcast`（阴天）、`night`（夜）。`sun`、`sky`、`ambient`、`fog`、`post`、`weather` 六节按字段覆盖预设；`rain`（0..1）是简写，同时设湿度和积水，`weather` 里显式写的字段优先；`reflection`（0..1）开平面反射；`lightning` 为 null 时不打雷，有值时按 `w.rand` 排期，到点发 `lightning` 事件并让画面闪一下，积木状态 `active` 设为 false 可暂停。
- `surface`：`kind`、`scale` 同 `shape`；`material` 为预设名（`wetGround`、`metal`、`concrete`）或材质参数对象；`color` 为 null 时取预设颜色。
- 想按关卡或天气切换环境：`scene` 不能读 `w.vars`，用流程状态决定写哪个预设，并让 `key` 随之变化（如 `key={'env-' + s.state}`），旧环境会先还原再建新的。
- 预设与材质是 `presets`、`materials` 导出，可以读来做自己的组合；名字写错时报“未知的预设 X，可用 …”。

## 加载进度

启动期间 Runner 显示加载界面。`defineGame` 写了 `load(ctx, step)` 时，它在登记积木和 `vars` 之后、挂载场景之前执行，用来预读数据、模型或编译材质：

```tsx
load: async (ctx, step) => {
  await step('读取关卡', 0.2)
  for (let i = 0; i < n; i++) { /* ... */ await step(`烘焙 ${i + 1}/${n}`, 0.2 + 0.8 * (i + 1) / n) }
},
```

- `step(文字, 0..1)` 报的是本单元内的进度，并在超出帧预算时让一帧；热重载时 `load` 也会执行但不让帧，要写成可重复执行。不要自己等帧。
- 启动时框架还会逐个预热场景实体的表现（报“生成场景 k/n”），进度条消失后不会再卡一帧。有 `load` 且有 `scene` 时，`load` 占前 80%，预热占后 20%。
- 父单元按顺序挂多个 `defineGame` 子单元时，用 `ctx.loading.within(lo, hi)` 把下一个子单元的进度映射到 `[lo, hi]`，挂完后 `within(0, 1)` 复原（见 `references/api.md` 的 `ctx.loading`）。

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

## 原生积木（C#）

官方积木可以另有 C# 实现，Runner 自动换用，写标签的人不需要知道；结果与 TS 逐位一致。现有：`moveTopdown`（topdown）、`moveFps`（fps）。

- `pot query world` 的 `native` 列出当前走 C# 的积木；`w.native = 'off'` 一律用 TS。游戏覆盖或 eject 了同名积木时用游戏的 TS。
- `pot block verify <积木> [--test tests/x.json] [--steps 600]`：在 Runner 里用同一段输入分别跑两种实现，逐步比较，给出第一个不同的步与字段、两种实现的耗时。`changedSteps` 为 0 说明这个积木在这段输入下什么都没做（例如 `active` 为 false、角色已死），要换输入。
- 有 JIT 的平台上，`moveFps` 这类积木 TS 已经够快（每实体每步约 1 µs），C# 版因为每步要打包、拷贝数据并不更快；它主要为没有 JIT 的平台（iOS）准备。是否用以 verify 的实测为准。
- `pot blocks --name <积木>` 的 `layout` 是 C# 实现要对上的布局字符串，`layoutError` 说明为什么没有布局。游戏自写的积木目前不能有 C# 实现。

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
