# 004 pot：高层游戏编写方式（积木与 TSX）设计文档

状态：草案，M1 待实施。方向已定：可序列化的实体数据内核，加 TSX 作为唯一的编写前端。第 14 节是远期的待决事项，M1 用到的部分已在第 15 节给出临时决定
上级文档：`001-game-runner-design.md` 第 7 节（Game API 设计原则）、`002-hot-reload-design.md`
修订：第 3 版。第 1 版推荐“数据内核加 JSON 与 TS 双前端”，第 2 版把两种前端合并为 TSX，第 3 版补充 M1 实施规格（第 15 节）

## 0. 摘要

现有 Game API（下称低层）让游戏自己处理输入、自己在 `update` 里改位置、自己把状态镜像到场景。本文在它之上加一层高层 API：游戏由现成的积木（物体、玩家、NPC、触发区、界面等）摆放和配置而成，积木不够用时退回低层自己写。高层完全用低层实现，两层可以在同一个游戏里混用。

编写形式只有一种：TSX。场景是一棵标签树，标签的属性是配置，需要逻辑的地方直接写 TS 函数。一个小写标签背后的积木可以用 TS 实现，也可以用 C# 或 wasm 实现，写游戏的人看不出区别。界面也用同一套标签写。

TSX 只是前端。它下面的内核与第 1 版相同：实体数据存在 `state` 里，模拟与表现分开，输入先变成指令再进模拟。多语言实现、脱离 Unity、联机这三项需求都靠内核满足，与前端用什么写无关。

TSX 在 pot 现有转译链上已验证可行，需要一处修正（`.tsx` 文件分两遍转译，见 5.8）。

## 1. 背景与问题

以 `games/hello` 为例，一个“方块吃金币”的游戏由 3 个单元加 1 个数据文件组成，共 2739 字节（`world.ts` 542、`player.ts` 804、`coins.ts` 1245、`coins.json` 148）。其中真正表达设计意图的信息只有：场景长什么样、玩家怎么动、碰到金币加分。其余都是每个游戏重复的样板：

| 样板 | 出处 | 说明 |
|---|---|---|
| 读输入、乘速度、乘 dt、写位置 | `hello/player.ts` | 每个可控角色写一遍 |
| 状态镜像：`state.position` 改完再赋给 `body.position` | `hello/player.ts`、Skill 规则 8 | “场景是 state 的投影”靠手写保证 |
| 距离判断当碰撞 | `hello/coins.ts` | 低层只有射线和扫掠，没有重叠查询和触发事件 |
| 已拾取列表、按列表决定是否重建 | `hello/coins.ts` | 实体的生死要自己记进 state |
| 角色移动与碰撞 | `saltline/lib/physics.ts`（161 行）、`saltline/plugins/player.ts`（159 行） | 分轴 AABB、上台阶、子步防穿墙、土狼时间，都是通用逻辑 |
| 带类型的事件总线 | `saltline/lib/bus.ts` | 单元之间不能 import 值，只能自建事件约定 |
| 阶段切换与菜单 | `saltline/plugins/game.ts`（10.6 KB）、`menu.ts`（16.1 KB） | 标题、进行中、暂停、结算的流程每个游戏都有 |

这些样板带来三个问题：AI 生成和阅读它们要花 token；手写的部分容易出坑（坑点库里的“低帧率穿墙”“存档恢复坏位置”都出自这里）；逻辑直接读 `ctx.input`、直接改场景对象，将来联机和换宿主都要重写。

## 2. 需求与约束

来自讨论的需求：

1. 提供高层 API，游戏由现成积木摆放配置而成；高层基于低层实现，两层同时提供，积木不够时用低层自行构造。
2. 高层要让 AI 用尽量少的 token 写出游戏，同时保持灵活，两层组合能做出大部分游戏；人也容易理解。
3. 积木可以用 TS 写，也可以用 C# 写：先用 TS 快速迭代，成熟后整体或部分移植到 C# 提升性能。
4. 高层不依赖 Unity，将来可以在 Web 或小游戏环境用原生 JS API 和 wasm 实现积木。
5. 考虑联机游戏怎么支持。

已确认的范围：

| 问题 | 结论 |
|---|---|
| 编写形式 | TSX 是唯一前端。不再有 JSON 场景格式，也不再有另一套 TS 辅助函数写法 |
| 首批覆盖的游戏类型 | 3D 动作/射击/冒险、2D/俯视角休闲、界面重的类型都要，积木库按需扩充。因此先定机制，积木清单随真实游戏补 |
| 联机形态 | 小房间实时（服务器权威加状态同步）、帧同步、弱联网/回合制都要支持 |
| C# 积木的分发 | 官方积木随 Runner 内置；同时保留游戏通过 `extraPackages` 自带 C# 积木的扩展口 |
| 脱离 Unity 的优先级 | 只保证设计上不依赖，Web 原生后端远期再做 |

沿用的既有约束：持久数据只放 `state` 且可序列化；副作用都经 `ctx` 注册，随单元卸载回收；Runner 尽量一次发布长期稳定，游戏只有 TS 和数据；游戏逻辑只通过 `Host` 接触外部（`js/runtime/src/host.ts`）；开发期转译用 sucrase，发布用 esbuild，类型检查交给 `pot check`。

## 3. 设计原则

1. 标签说明“有什么”，函数只写“特别之处”。场景、实体、属性是标签和属性；只有属性表达不了的逻辑才写函数。
2. 高层是低层的用户，不是替代品。高层的每个积木都用公开的低层 API 写成，不走后门，这样游戏自己写的积木与官方积木地位相同。
3. 模拟与表现分开。模拟只读写实体数据和输入指令，不碰场景对象；表现把数据画出来。这一条同时服务于热重载、存档、联机、换宿主和换语言。
4. 状态即数据。实体数据可序列化、有模式（schema），热重载、存档、网络同步、`query` 用同一份数据。TSX 树只描述初始布置，不保存运行状态。
5. 逐级退出。从配置属性，到写一条规则，到写一个积木，到写普通单元，每一级只在上一级不够时才用，且互相可见。
6. 可发现。积木自带名字、一句话说明和属性模式，AI 按需查询，不需要把整个积木库读进上下文。
7. 跨语言开销随玩法量增长，不随世界规模增长。每帧跨语言调用的次数不应该取决于场景里有多少个实体（第 7 节）。

## 4. 方向与结论

第 1 版比较了四个方向，这里只保留结论：

| 方向 | 做法 | 主要问题 |
|---|---|---|
| 一：标准单元库 | 一批可配置的现成单元，在 `manifest.json` 里列出 | 没有统一的实体模型，跨单元关系仍靠手写，联机和 C# 移植没有统一的数据约定 |
| 二：TS 组合式 DSL | 用 TS 函数组合场景，逻辑写内联回调 | 场景是代码执行的结果，工具难以读写；闭包不能上网络 |
| 三：数据场景加事件表 | 场景、预制件、规则全是 JSON | 逻辑稍复杂，事件表就长成一门蹩脚的语言；没有类型检查 |
| 四：数据内核加双前端 | 三的数据格式作规范形式，二的写法作辅助 | 两种写法并存，要靠约定取舍 |

第 1 版推荐方向四。进一步看，方向三的场景本质是一棵带属性的树，方向二是用函数调用拼出同一棵树，两者可以用同一种语法表达，这就是 TSX。本版的结论是：保留方向四的内核，把它的两个前端合并成 TSX。

TSX 为什么能同时取代两者：

| 需要的性质 | 第 1 版靠什么 | TSX 靠什么 |
|---|---|---|
| 简单游戏省 token | JSON 场景 | 标签与 JSON 体量相当（hello 约 0.6 KB），且不需要另一个文件装规则 |
| 校验与提示 | JSON Schema | tsc：属性名拼错、类型不对直接报在行号上，编辑器有补全 |
| 逻辑不长成新语言 | 字符串动作加按名字注册的 TS 函数 | 规则的 `do` 就是 TS 函数，没有字符串动作 |
| 程序化生成内容 | 另一套 TS 辅助函数 | `map`、条件表达式、自定义组件 |
| 积木可换实现 | 名字加模式 | 小写标签和属性名就是名字，实现在哪种语言里对标签不可见 |
| 界面重的游戏 | 另一套 JSON 界面树 | 同一套标签语法，写法已被 Web 验证 |

换成 TSX 放弃了两样东西，各有补偿（5.9）：

- 场景不再是可以直接读写的数据文件。补偿：内核能输出树的 JSON 视图供工具读；人在 Runner 里调的参数写进覆盖层文件而不是改源码。
- 非 JS 宿主不能直接加载场景。这一点实际影响不大，因为各宿主本来都要运行 JS 才能执行规则和 TS 积木。

未采纳的还有节点树加脚本类（Godot、Unity 式）：状态放在类实例里，热重载和存档都要另做序列化；逻辑与对象绑死，模拟与表现分不开。TSX 的树看上去像节点树，区别在于标签只是布置说明，状态在 World 里。

## 5. TSX 前端

### 5.1 一个完整的例子

hello 用高层重写后只有一个单元 `src/plugins/game.tsx` 和原来的数据文件：

```tsx
import { defineGame } from '@pot/core'

export default defineGame({
  vars: { score: 0 },
  scene: (s) => <>
    <stage background="#1e2230" sun={{ rot: [50, -30, 0], intensity: 1.1 }} camera={{ at: [0, 12, -10], look: [0, 0, 0] }} />
    <ground scale={2} shape={{ color: '#3a4a3a' }} />
    <player at={[0, 0.5, 0]} shape={{ kind: 'cube', color: '#4fc3f7' }} moveTopdown={{ speed: 5 }} />
    {s.data.load('coins.json').coins.map((at, i) => <coin key={i} at={at} />)}
    <rule on="touch" a="player" b="coin" do={(w, p, c) => { w.destroy(c); w.vars.score++ }} />
  </>,
  ui: (w) => <text at="top-left" size={28}>得分 {w.vars.score}</text>,
})
```

`manifest.json` 写 `"plugins": ["game"]`。输入采样、位置更新、状态镜像、碰撞判断、已拾取列表、热重载保留状态都由内核和积木承担。`s.data` 就是现有的 `ctx.data`，它会记下这个单元读过 `coins.json`，数据文件一改，场景就重新求值。

`defineGame` 返回的是一个普通单元（default 导出带 `apply`，现有 `resolvePlugin` 已接受这种形式），所以单元模型不用改，游戏可以同时有别的普通单元：`"plugins": ["game", "weather"]`。

`defineGame` 的参数是一个对象，不是树的部分放在对象字段里，只有两处用标签：

| 字段 | 内容 | 形式 |
|---|---|---|
| `vars` | 全局变量及初值 | 对象 |
| `controls` | 键位到指令的映射（6.6） | 对象 |
| `flow` | 流程状态及切换（5.6） | 对象 |
| `blocks`、`prefabs` | 游戏自写的、只在运行时才用到的积木和预制件，用于按名字登记 | 数组 |
| `scene` | 世界里有什么 | 返回标签树的函数 |
| `ui` | 屏幕上画什么 | 返回标签树的函数 |

### 5.2 标签是什么

| 写法 | 含义 | 谁实现 |
|---|---|---|
| 小写标签 `<player>`、`<coin>`、`<stage>` | 按名字登记的预制件或内置节点 | 官方或游戏，积木可以是 TS、C#、wasm |
| 大写标签 `<Coin>`、`<Level>` | 游戏自己的预制件（`definePrefab` 的返回值）或普通函数组件 | 游戏的 TS |
| 片段 `<>...</>` | 只分组，不产生实体 | 无 |
| `<rule>` | 一条规则（5.6） | 内核 |

实体标签的属性分两类。保留属性有六个：`key`、`at`、`rot`、`scale`、`name`、`tags`。其余属性名都是积木名，值是对该积木属性的覆盖。`<player moveTopdown={{ speed: 5 }}>` 的意思是：用 `player` 预制件，把其中 `moveTopdown` 积木的 `speed` 改成 5；预制件里没有这个积木时就加上它。`<entity>` 是不带任何积木的空预制件。

积木名用驼峰，不用点号和连字符：`<a.b>` 在 JSX 里是成员访问，带连字符的属性名拼错时 tsc 不报错。

预制件是起了名字的积木组合，可以继承，覆盖时按字段深合并：

```tsx
import { definePrefab } from '@pot/core'

export const Coin = definePrefab('coin', {
  tags: ['coin'],
  shape: { kind: 'sphere', scale: 0.5, color: '#ffd54f' },
  trigger: { radius: 0.8 },
  spin: { speed: 90 },
})
export const BigCoin = definePrefab('bigCoin', { is: Coin, shape: { scale: 1 }, trigger: { radius: 1.4 } })
```

`definePrefab` 一定要给名字。运行中生成实体时内核记录的是“预制件名加可序列化的属性”，热重载和读档靠它重建：`w.spawn(Bullet, { at, projectile: { speed: 20 } })` 与 `w.spawn('bullet', {...})` 等价。`w.spawn` 只接受预制件，不接受任意函数组件。游戏的预制件与官方同名时游戏的优先。

普通函数组件用来组织和批量生成，它必须是纯函数：

```tsx
const Row = ({ z, n }: { z: number; n: number }) =>
  <>{Array.from({ length: n }, (_, i) => <Coin key={i} at={[i * 2 - n, 0.5, z]} />)}</>
```

实体标签第 1 版没有子节点，实体之间是平的。父子变换是否支持列为待决。

### 5.3 两棵树，两种节奏

`scene` 和 `ui` 都返回标签树，但求值时机完全不同：

| | `scene` | `ui` |
|---|---|---|
| 签名 | `(s) => 树`，`s` 里只有流程状态名 `s.state`、流程参数 `s.params` 和数据文件 `s.data` | `(w, ui) => 树`，可以读 World 的任何数据 |
| 何时求值 | 进入流程状态、热重载、流程参数变化、读过的数据文件变化 | 每帧 |
| 结果去哪 | 与上次的树按 key 对比，变成实体的创建、更新、销毁 | 直接画到即时模式的 `ctx.ui`，不保留 |
| 在哪运行 | 所有宿主，包括无画面的服务器 | 只在有画面的宿主 |
| 能否读运行状态 | 不能 | 能 |

世界不采用“每帧渲染整棵树再对比”的做法，原因有三个：一千个实体每帧对比一次的开销随世界规模增长；逐帧变化的量（位置、速度）是模拟的结果，不是谁“设置”出来的；每帧求值会让闭包里的东西变成事实上的状态。逐帧逻辑写在积木的 `step` 里。

界面相反，每帧求值最简单：现有 `ui` 本来就是即时模式，界面节点数量少，而且界面内容就是 World 数据的函数。

### 5.4 实体的身份：key 路径

每个实体标签在树里有一个 key 路径，由各层的 `key` 组成，没写 `key` 的用“标签名加在兄弟中的序号”。World 按挂载实例记录见过的每个 key 及其状态，记录本身存在 `state` 里。`scene` 重新求值时：

| key 的情况 | 处理 |
|---|---|
| 新树里有，记录里没有 | 创建实体 |
| 新树里有，实体还活着 | 属性原地更新，运行状态不动 |
| 新树里有，实体在玩法中已被销毁 | 保持销毁，不重建 |
| 新树里没有，实体还活着 | 销毁 |

第三行取代了 hello 手写的“已拾取列表”：热重载后吃掉的金币不会回来。进入一个流程状态时记录清空，场景从头建立；标了 `pause: true` 的叠加状态（暂停菜单）进出都不重建。

属性是初值，不是受控值。`at` 这类会被模拟改写的属性，只有当它在新旧两棵树之间变了才重新应用。改了源码里金币的坐标，金币会移过去；没改玩家的 `at`，玩家留在走到的位置。

运行中用 `w.spawn` 生成的实体不在树里，不参与对比，按“预制件名加属性”自行重建表现。

其他单元可以用 `ctx.world.mount(树)` 挂自己的子树，各挂载实例的 key 记录互相独立，单元卸载时它挂的实体一并回收。

### 5.5 五条规矩

1. 属性是初值，不是受控值。写 `<player at={[0, 0.5, 0]}>` 不会每帧把玩家拉回原点。
2. 世界不走“每帧渲染再对比”。逐帧逻辑写在积木的 `step` 里，`scene` 不读运行状态。
3. 没有 `useState`、`useEffect` 之类的 hooks。场景函数和组件必须是纯函数，状态只放 World 的 `vars` 和积木状态里，界面的本地状态放 `ui.local`。这是 pot “持久数据只放 `state`”在 TSX 里的对应规定，也是热重载和联机能成立的前提。
4. 能换成 C# 实现的只有按名字登记的东西，也就是用 `defineBlock` 定义的积木。大写的函数组件永远是 TS。
5. 积木名、预制件名、事件名用驼峰标识符，不用点号和连字符。

### 5.6 规则与流程

规则是标签，放在 `scene` 的树里，随所在子树生效和失效：

```tsx
<rule on="touch" a="player" b="coin" do={(w, p, c) => { w.destroy(c); w.vars.score++ }} />
<rule on="death" a="coin" do={(w) => { if (w.count('coin') === 0) w.emit('allCoins') }} />
<rule on="every" seconds={2} do={(w) => w.spawn(Enemy, { at: [w.rand(-8, 8), 0.5, 10] })} />
```

事件种类：`touch`（两个实体开始重叠）、`enter` 与 `exit`（进出触发区）、`death`（实体被销毁）、`every`（定时），以及用 `w.emit('名字')` 发出的自定义事件。`a`、`b` 按标签或预制件名筛选。

`do` 一律是 TS 函数，没有字符串动作，也没有内置动作表。函数不能序列化，但规则不需要上网络：各端加载的是同一个游戏包，规则由树里的位置（key 路径）标识，网络上只传指令和实体数据。`do` 运行在模拟阶段，受模拟侧的约束（6.3）。

流程是对象，界面按当前状态选择画什么：

```tsx
const Menu = () =>
  <column at="center" gap={16}>
    <text size={64}>Hello Pot</text>
    <button emit="start">开始</button>
  </column>

export default defineGame({
  vars: { score: 0 },
  flow: {
    start: 'title',
    states: { title: { on: { start: 'play' } }, play: { on: { allCoins: 'title' } } },
  },
  scene: (s) => s.state === 'play' && <Level n={s.params.level ?? 1} />,
  ui: (w) => w.flow.state === 'title' ? <Menu /> : <text at="top-left" size={28}>得分 {w.vars.score}</text>,
})
```

状态切换由事件触发（`on` 里的映射），或在规则里调 `w.goto('play', { level: 2 })`。

### 5.7 类型

- 官方预制件、积木、界面标签的 `JSX.IntrinsicElements` 随 `@pot/core` 提供，由 `jsx-runtime.ts` 导出 `namespace JSX`。实体标签的属性类型是“六个保留属性，加每个已知积木名对应的可选属性覆盖”。
- 游戏自写的积木要出现在属性名里，`vars` 要出现在 `w.vars` 的类型里。JSX 元素的类型无法从 `defineGame` 的参数反推，所以这两样由 `pot check` 和 `pot dev` 在 Node 宿主上加载游戏后生成到 `.pot/types.d.ts`，以声明合并的方式补进 `@pot/core`。`vars` 的类型是否这样给列为待决。
- 世界标签与界面标签共用一个 `JSX.IntrinsicElements`，tsc 分不出“把 `<button>` 写进了 `scene`”。这类错误由求值时的运行期校验和 `pot check` 报出。
- 开发模式用 `jsxDEV`，每个节点带源文件和行号。内核的报错和 `pot query world` 的结果可以指到 `game.tsx:行号`。

### 5.8 接入现有转译链

已用 pot 现有的 sucrase 3.35.1 实测。结论：TSX 可以接入，但 `.tsx` 文件要改成两遍转译。

现在的做法是先用 `splitMultiExports` 做文本级预处理，再交给 sucrase 一遍完成。`splitMultiExports` 不认识 JSX，五个用例全部出错：JSX 文本含逗号、`map` 里的自闭合标签、文本含撇号、片段与属性里的字符串、`<T,>(x: T) => x` 泛型箭头函数。改成两遍后五个用例全部正确，`jsxDEV` 带的行号也正确：

| 遍 | sucrase 选项 | 作用 |
|---|---|---|
| 第一遍 | `transforms: ['typescript', 'jsx']`，`jsxRuntime: 'automatic'`，`jsxImportSource: '@pot/core'`，`disableESTransforms: true`，开发期 `production: false` | 去掉类型和 JSX，保留 ESM |
| 中间 | `splitMultiExports` | 此时已没有 JSX，文本处理安全 |
| 第二遍 | `transforms: ['imports']`，`disableESTransforms: true` | 转成 CommonJS |

纯 `.ts` 文件现有做法没有问题（泛型箭头函数、泛型调用都验证过），不需要动。

改动点：

| 位置 | 现状 | 改动 |
|---|---|---|
| `js/runtime/src/jsx-runtime.ts`、`jsx-dev-runtime.ts`（新增） | 无 | 导出 `jsx`、`jsxs`、`Fragment`、`jsxDEV` 和 `namespace JSX`。函数只做一件事：生成 `{ tag, key, props, 源位置 }` 的普通对象 |
| `js/runtime/src/runtime.ts` 第 102 行的模块表 | 只有 `@pot/core` 和 `cordis` | 加 `@pot/core/jsx-runtime`、`@pot/core/jsx-dev-runtime` 两项。加载器的 `require` 先查模块表，表里有就不会触发“只能依赖 @pot/core”的报错 |
| `js/devtools/src/loader.ts` 第 26 行附近 | `UNIT_EXTS`、`RESOLVE_SUFFIXES`、后缀正则都没有 `tsx` | 加 `.tsx`、`/index.tsx` |
| `js/devtools/src/loader.ts` 第 61 到 62 行 | 一遍转译 | `.tsx` 走上表的两遍 |
| `js/devtools/src/loader.ts` 第 71 行 `TRANSPILER_ID` | `sucrase-3.35.1/multi-export-1` | 改值，让旧缓存失效 |
| `js/devserver/builder.js` 第 11 行 | `external` 过滤只精确匹配 `@pot/core` 和 `cordis` | 两个 jsx 子路径也标为外部，并保留各自的名字 |
| `js/devserver/builder.js` 第 37 到 38 行 | `listUnits` 只认 `ts`、`js` | 加 `tsx` |
| `js/devserver/builder.js` 第 62 行起的 esbuild 选项 | 无 jsx 设置 | 加 `jsx: 'automatic'`、`jsxImportSource: '@pot/core'` |
| 各游戏和模板的 `tsconfig.json`、`js/tsconfig.json` | 无 jsx 设置 | 加 `"jsx": "react-jsx"`、`"jsxImportSource": "@pot/core"`，`paths` 加 `@pot/core/jsx-runtime` |

不引入 React 或 Preact 作为依赖。场景树的求值就是调用纯函数、展开片段、算 key 路径，几百行以内。界面运行时的选择见 6.8。

### 5.9 放弃 JSON 场景后的补偿

- `pot query world --tree` 输出当前场景树的 JSON 视图（标签、key、属性、源位置），`pot query world` 输出实体的当前数据。AI 观察到的结构与它写的标签一一对应。
- `pot world set <key 路径> <属性补丁>` 在运行期按 key 改属性，用于试参数。
- 覆盖层：人在 Runner 里调好的参数写进数据文件（如 `data/overrides.json`，按 key 路径存属性补丁），内核在 `scene` 求值后叠加它。源码不被工具改写，覆盖层可以随时并回源码或丢弃。
- 大批量关卡数据仍然放 `data/` 下的 JSON，在 `scene` 里用 `s.data.load` 读入后 `map` 成标签，hello 的金币坐标就是这样。

## 6. 内核设计

### 6.1 分层

```plantuml
@startuml
package "游戏包" {
  [game.tsx：defineGame\n场景、规则、界面、流程] as Game
  [src/blocks、src/prefabs\n自写积木与预制件] as Own
  [普通单元 src/plugins/*.ts] as Units
}
package "高层（@pot/core 的 world 部分）" {
  [TSX 前端：jsx-runtime、树求值、key 对比] as Front
  [World 内核：实体、积木调度、事件、指令] as Kernel
  [官方积木库（TS，可有 C# 或 wasm 实现）] as Blocks
}
package "低层（现有 Game API）" {
  [scene / input / ui / audio / gfx / state / clock] as Low
}
package "宿主" {
  [Unity（C#）] as Unity
  [Node（无渲染）] as Node
  [Web 原生（远期）] as Web
}
Game --> Front
Own --> Kernel
Front --> Kernel
Blocks --> Kernel
Kernel --> Low : 数据存 state\n表现走 scene 等
Units --> Low
Units ..> Kernel : ctx.world
Low --> Unity
Low --> Node
Low --> Web
@enduml
```

World 内核是 `@pot/core` 的一个核心服务 `ctx.world`。`defineGame` 生成的单元在 `apply` 里把 `scene` 的树挂到它上面。

### 6.2 概念

| 概念 | 含义 | 类比 |
|---|---|---|
| World | 一局游戏的全部实体数据，存在 `state` 里 | 内存数据库 |
| 实体 | 一个 id 加若干积木的数据 | GameObject |
| 积木（Block） | 复用的最小单位：一份带模式的数据，加上处理这份数据的模拟逻辑和表现逻辑 | Kaplay 组件、GDevelop 行为 |
| 预制件 | 起了名字的积木组合和默认属性，可以继承。玩家、NPC、金币、墙都是预制件 | Prefab |
| 场景 | `scene` 函数返回的标签树：实体布置、环境、规则 | 关卡 |
| 规则 | 事件到 TS 函数的映射 | 事件处理 |
| 变量（vars） | 全局数据，如得分、关卡号 | 全局状态 |
| 指令（Cmd） | 每个玩家每一步的输入：若干轴和动作 | 输入帧 |
| 流程（flow） | 标题、进行中、暂停、结算等阶段及其切换 | 状态机 |

### 6.3 积木的定义

积木把属性（标签里配置的、运行中不变）、状态（运行中变化、要存档和同步）、模拟、表现四样东西放在一起：

```ts
// 官方积木与游戏自写积木写法相同。游戏的放在 src/blocks/
import { defineBlock } from '@pot/core'

export default defineBlock({
  name: 'moveTopdown',
  about: '俯视角平面移动，读 move 轴',
  props: { speed: 4 },                 // 属性：来自标签，只读
  state: { vx: 0, vz: 0 },             // 状态：进 World，可存档、可同步
  needs: ['transform'],
  // 模拟：固定步长。只读写实体数据和指令，不碰 ctx.scene，不用 Math.random、Date
  step(me, e, w) {
    const a = w.cmd(e).axis('move')
    me.vx = a.x * me.speed
    me.vz = a.y * me.speed
    e.pos[0] += me.vx * w.dt
    e.pos[2] += me.vz * w.dt
  },
})
```

```ts
export default defineBlock({
  name: 'shape',
  about: '基本形状的外观',
  props: { kind: 'cube', color: '#ffffff', scale: 1 },
  // 表现：只在有画面的宿主上运行，可以使用全部低层 API
  view: {
    enter(me, e, ctx) {
      // 返回的对象由内核保管：实体销毁、积木热重载、场景切换时自动 destroy
      return ctx.scene.spawn({ shape: me.kind, color: me.color, scale: me.scale })
    },
    // update(me, e, obj, ctx) {}      变换同步由内核统一做，多数积木不需要写
  },
})
```

`props` 的默认值同时就是类型和模式的来源，标签里 `shape={{ kind: 'cube' }}` 的补全与校验由它推出。

### 6.4 每一步的执行顺序

```plantuml
@startuml
start
:收集本步指令 Cmd\n（本地输入 / 网络 / 回放）;
partition "模拟（fixed-update，可在任何宿主运行）" {
  :按顺序执行各积木的 step;
  :碰撞与触发检测，产生事件;
  :执行规则的 do 函数;
  :应用延迟的创建与销毁;
}
partition "表现（update，仅有画面的宿主）" {
  :对新增和删除的实体执行积木的 view.enter / exit;
  :执行积木的 view.update;
  :求值 ui 函数并绘制;
}
partition "帧末" {
  :把本帧的变换写入合并成一次 setTransforms\n（按 fixedAlpha 插值）;
}
stop
@enduml
```

模拟建立在现有的 `fixed-update`（`clock.fixedStep`，默认 1/60 秒）上，表现建立在 `update` 上。顺序由阶段决定，不由注册先后决定。另有三个细节：

- 变换写入先记在 JS 侧，帧末一次发给宿主；中途有读回（屏幕坐标、拾取）时提前冲刷，保证读到的是最新值。
- 每帧的模拟步数要有上限，掉帧时丢弃多余的时间而不是越追越慢。现有 `clock` 已经这样做（`maxFixedSteps` 默认 8，丢弃的时间计入 `fixedDropped`）。
- 表现用上一步和这一步的位置按 `clock.fixedAlpha` 插值，帧率高于步频时画面依然平滑。

坑点库里“低帧率穿墙”“每帧逐个设变换很慢”两类问题由内核统一解决。

### 6.5 存储模型（待决）

积木的属性和状态都声明了模式，内核据此决定怎么存。三种做法：

| 做法 | 说明 | 取舍 |
|---|---|---|
| 对象式 | 每个实体一个普通对象，积木数据是它的字段 | 最简单；但 C# 积木每步都要整体搬运数据，快照和差量慢 |
| 列式 | 数值字段按积木和字段存成 TypedArray 的列（同 bitECS），其他字段存旁路对象表 | 快照、差量、哈希都是内存块操作；可以与 C# 或 wasm 共享内存；直接访问列的写法不直观 |
| 列式加游标（推荐） | 存储同列式，积木代码通过可复用的游标对象访问（上例中的 `me`、`e`），写法与对象式相同且不产生分配 | 实现多一层访问器；热点积木仍可直接拿列批量处理 |

推荐第三种。`state` 服务本来就允许 TypedArray，所以 World 整体放进 `ctx.state.define('world', ...)` 后，热重载保留状态、冷重启、存档都不需要改动。模式变化（加字段、删字段）由内核按字段名自动迁移，不需要手写 `version` 和 `migrate`；类型变了的字段重置并告警。

### 6.6 输入：指令

积木不直接读 `ctx.input`，而是读本步的指令 `w.cmd(e)`。键位映射写在 `defineGame` 的 `controls` 里，不写时用默认映射：

```ts
controls: {
  axes: { move: ['wasd', 'arrows', 'stick.left'], look: ['mouse', 'stick.right'] },
  actions: { jump: ['space', 'pad.a'], fire: ['mouse0', 'pad.rt'] },
}
```

指令是一小块可序列化的数据（几个轴加一个动作位图）。单机时内核每步从 `ctx.input` 采样生成；联机时来自网络；回放时来自录像。001 第 10.2 节计划中的 `record`/`replay` 因此可以直接实现：录下指令流和初始快照即可。界面事件也走指令（6.8）。

### 6.7 模拟侧的碰撞

低层目前只有射线和球体扫掠（走 Unity PhysX），没有重叠查询和触发事件，而且 PhysX 在 Node 上不存在、结果也不保证各机一致。因此高层在模拟侧自带一个轻量碰撞模块（TS 实现，后续可移植到 C# 或 wasm）：

- 形状：盒、圆/球、胶囊；静态体用空间网格索引。
- 能力：重叠与触发（产生 `touch`、`enter`、`exit` 事件）、运动学角色移动（分轴推进、上台阶、贴地、子步，即 `saltline/lib/physics.ts` 的通用化）、射线。
- 2D 游戏用同一模块，只是忽略一个轴。

需要真实刚体动力学（堆箱子、布娃娃、车辆）的游戏有两条路。一是积木在表现侧直接用宿主物理，标记为“非确定”，可用于单机和以 Runner 为房主的联机，不能用于帧同步。二是在模拟侧接入 wasm 物理库，例如 Rapier 的确定性构建：它能整体快照和恢复，能在没有场景的 Node 进程里步进，和 World 的存档、回滚、权威服务器都对得上，本文倾向于这条路。前提是 Puerts 的 V8 在各目标平台上都有 WebAssembly，需要实测；体积代价是几 MB 的 wasm 文件。此项仍列入待决。

### 6.8 界面

界面用标签写，`ui` 函数每帧求值，结果直接画到现有的即时模式 `ctx.ui`：

- 标签：`<text>`、`<button>`、`<bar>`、`<image>`、`<row>`、`<column>`、`<panel>`、`<scroll>`、`<input>`。排版用弹性布局的一个子集。
- 事件只经指令影响 World：`<button emit="start">` 或在回调里 `ui.emit('start')`。这样界面操作与按键一样能被录制、回放、上网络。
- 界面自己的状态（哪个标签页打开、滚动位置、输入框内容）放 `ui.local`。它存在 `state` 里所以热重载不丢，但不属于 World，不同步。
- 界面组件同样是纯函数，没有 hooks。

现有 `ui` 只有矩形、描边、渐变、线、弧、文字六种绘制命令和单轴行列排布，界面重的游戏还缺几样能力，列在第 10 节。

界面运行时有三种做法，M1 采用第一种：

| 做法 | 说明 | 取舍 |
|---|---|---|
| 自己写极小求值器（采用） | 每帧调用 `ui` 函数，遍历树，算布局，发绘制命令。不保留节点，没有 hooks | 代码量小，与即时模式 `ui` 和“状态只放 state”完全一致；用不了 React 生态的组件库 |
| 嵌 Preact 加一层仿 DOM | 宿主侧提供 `createElement`、`appendChild`、`setAttribute` 等接口，Preact 原样运行 | 得到完整的组件模型和 hooks；但 hooks 状态在 Preact 内部，与规矩 3 冲突，热重载要另想办法 |
| react-reconciler 自定义宿主 | 用 React 本体，自己实现宿主配置 | 最完整也最重：宿主配置要上千行，热重载时保住 hooks 状态还得读 React 的内部结构 |

对话、卡牌、背包等更专门的界面作为组件包按需求再做，不在首批范围。

### 6.9 与低层混用：四级逃生口

| 级别 | 做法 | 典型代价 |
|---|---|---|
| 0 | 改属性、换预制件 | 标签里一个属性 |
| 1 | 写一条 `<rule>`，或用函数组件批量生成 | 几行 TSX |
| 2 | 在 `src/blocks/` 里写一个积木，表现部分可以使用全部低层 API | 一个文件 |
| 3 | 写普通单元，通过 `ctx.world` 读写实体、监听事件、挂子树；也可以完全不经过 World | 与现在相同 |

另外提供“弹出”：`pot eject <积木名>` 把官方积木的 TS 源码复制到游戏的 `src/blocks/`，同名的游戏积木优先于官方积木，改完即热重载。

普通单元里可以这样使用 World：

```ts
export function apply(ctx: Context) {
  ctx.world.on('death', 'enemy', (w, enemy) => ctx.scene.burst({ kind: 'spark', pos: enemy.pos }))
  ctx.on('update', () => {
    for (const e of ctx.world.query('enemy')) { /* 自己画血条等 */ }
  })
}
```

以 saltline 为例，这意味着玩家、敌人、拾取物可以换成积木，而海面、雨、后处理链这些专门的渲染代码原样保留为普通单元。

### 6.10 热重载与存档

- World 数据在 `state` 里，积木、规则、场景的热重载都不丢状态。
- 改积木代码：只重建该积木的表现对象（`view.exit` 后 `view.enter`），模拟数据原样保留；模式变化按 6.5 自动迁移。
- 改 `game.tsx` 或它引用的文件：单元重载，`scene` 重新求值，按 5.4 的 key 对比处理。规则函数换成新的，下一步生效。
- 存档就是 World 快照（含 key 记录），沿用现有存档机制。

这里没有 React 式热重载的难题。React 的状态在 hooks 里，重载后要按“组件位置加 hook 顺序”把值对回去，对不上就丢；pot 的状态一开始就不在组件里，重载只是重新求值一个纯函数。

### 6.11 面向 AI 的配套

- `pot blocks [关键字]`（CLI 和 MCP）：列出积木、预制件、界面标签的名字、一句话说明、属性模式，按需查看单个的详细说明。Skill 主文件只讲规则和查询方法，不罗列积木。
- `pot check`：tsc 管属性名和类型；内核在 Node 宿主上把 `scene` 求值一遍，报出 tsc 查不到的问题（标签放错树、引用了未登记的预制件、重复的 key、规则筛选的标签不存在），错误带 `game.tsx:行号`。
- `pot query world`、`pot world set`、覆盖层（5.9）。
- `pot test`：在 Node 宿主上加载游戏，喂一段录制的指令跑若干步，出现任何报错即失败，可选对比 World 哈希。AI 不开 Runner 就能验证逻辑没坏。
- 类型声明由工具生成（`.pot/types.d.ts`），不手写。
- 游戏模板里放一份简短的 `AGENTS.md`，写明五条规矩和查询命令，指向 Skill。

## 7. TS、C#、wasm 多实现

目标是一个积木先有 TS 实现，之后可以再有 C# 实现，两者可以互换，写标签的人不需要知道。

- 约定：积木的名字加模式（字段名、类型、顺序）就是接口。C# 实现声明同名积木和同样的字段，内核启动时向宿主询问有哪些原生实现及其模式哈希，哈希一致就用原生实现的 `step`，否则用 TS 实现并告警。
- TS 实现始终保留：它是参考实现，也是没有原生实现的宿主（Node 服务器、Web 原生）上的实现。
- 一致性检验：`pot block verify <积木名>` 用同一段录制的指令分别跑两种实现，比较 World 哈希或在容差内比较数值。
- 部分移植：一个积木只有 `step` 的热点部分值得移植时，把它拆成两个积木，一个留在 TS，一个移到 C#。
- 分发：官方积木的 C# 实现放在 `com.pot.core` 里随 Runner 发布，游戏无感知。游戏自带的 C# 积木走 001 第 12 节的 `extraPackages` 和自定义 Runner，接口相同；这类游戏应当同时保留 TS 实现，否则通用 Runner 打不开它。
- wasm：与 C# 同样的接口，列放在 wasm 线性内存里，JS 侧的 TypedArray 视图直接指向它。wasm 模块按名字、版本、内容哈希标识，哈希不符就拒绝使用并退回 TS 实现。

跨语言边界的四条约束：

1. 配置一次性跨过去。原生积木的属性在实体创建时作为一份配置整体传入，不逐个属性赋值。
2. 稳态开销随玩法量增长，不随世界规模增长。每步每个原生积木只有一次跨语言调用，C# 直接在列上处理全部实体，不逐实体往返。
3. 批量数据走一个缓冲区。变换、事件、差量都放在 TypedArray 里一次传递，人数不变时复用同一个缓冲区。
4. 多条命令合并成一次调用。一帧内的创建、销毁、移动先在 JS 侧攒起来再发。

检验一个设计是否合格的问题是：逐帧的 JS 开销是随世界规模增长，还是随玩法量增长。

一次跨语言调用的代价是纯 JS 运算的数百倍，按一帧预算的一成算只够几百次调用，所以不能逐实体跨语言。M4 要在 Puerts 上实测这几项：一次 `setTransforms` 与逐个赋值的对比、单次属性读写、纯 JS 运算。

JS 与 C# 之间的列能否做到零拷贝共享取决于 Puerts 的 ArrayBuffer 传递方式，需要在原型阶段实测；做不到时退化为每步拷贝该积木用到的列。

另一个要记住的事实：pot 用 V8，有 JIT 的平台上 TS 模拟很快；但 iOS 不允许 JIT，JS 是解释执行，热点积木在那里更需要 C# 实现。

C# 接口示意：

```csharp
[PotBlock("moveTopdown")]
public struct MoveTopdown : IPotBlock
{
    public float speed;      // 属性，与 TS 的 props 同名
    public float vx, vz;     // 状态，与 TS 的 state 同名
    public void Step(ref PotEntity e, in PotWorld w) { /* 与 TS 的 step 一一对应 */ }
}
```

## 8. 不依赖 Unity

运行时本来就只通过 `Host` 和 `Engine` 接口接触外部，测试里已经有 Node 上的内存宿主（`js/test/helpers.js`）。高层在此基础上再加四条规则：

1. 内核、TSX 求值和所有积木的模拟部分只依赖 World 数据和指令，不调用任何 `Engine` 方法。
2. 积木的表现部分只通过 `ctx.scene`、`ctx.ui`、`ctx.audio` 等低层服务工作，不直接访问 `CS.*`。
3. CI 在 Node 宿主上跑完整的高层用例（场景求值、模拟结果、事件、规则），作为“不依赖 Unity”的持续证明。
4. 游戏代码能用的全局对象有一份明确的清单（可移植契约）。

可移植契约的做法：先按各宿主的引导脚本实际提供了什么，推出一份“所有宿主都有”的清单；清单之外的浏览器专有全局对象，在每个宿主上都屏蔽成 `undefined`，包括真正的浏览器。这样第三方库的特性检测会自动走非浏览器分支，游戏也不会无意中依赖只在某个宿主上存在的东西。pot 的清单要按 Puerts、Node、Web 三个宿主的实际情况定，起点可以是：定时器、`queueMicrotask`、`performance`、`URL`、`TextEncoder`，网络只经 `ctx.net`，存储只经 `state`。`pot check` 检查游戏代码对清单外全局对象的使用。

将来做 Web 原生宿主时，要实现的是 `Engine` 接口的一个子集。每个积木的表现部分用到了哪些低层能力可以静态得出，从而算出一个游戏对宿主的最低要求，对应 `manifest.capabilities`。只用基本形状、精灵和界面的游戏，需要的 `Engine` 子集很小。

## 9. 联机

### 9.1 共同基础

三种联机形态共用四件事，单机游戏按高层写法写出来就已经具备：

1. World 是可序列化的数据，可以整体或差量发送。
2. 玩家对 World 的影响只经过指令，界面操作也是指令。
3. 模拟按固定步长运行，与表现分离，可以在没有画面的 Node 进程里运行。
4. 随机数用 `w.rand()`（种子在 World 里），时间用 `w.time`。

TSX 没有带来新的障碍：`scene` 是纯函数，各端求值结果相同；规则函数不上网络，各端从同一个游戏包里按 key 路径取到同一个函数；`ui` 只在本地运行。

在此之上，实体有 `owner`（属于哪个玩家槽位），状态字段可以标记 `local`（纯装饰，不同步）。单机相当于只有一个玩家、使用本地驱动的联机。

### 9.2 三种驱动

| | 权威同步（小房间实时） | 帧同步 | 回合制与弱联网 |
|---|---|---|---|
| 谁运行模拟 | 权威端：Node 服务器，或某个玩家的 Runner 做房主 | 每个客户端各自运行 | 权威端（服务器或房主） |
| 网络上传什么 | 上行指令，下行 World 差量（每秒 10 到 20 次，字段可按模式量化） | 只传每步的指令 | 离散动作，以及动作后的状态差量 |
| 客户端做什么 | 远端实体插值；自己的实体用同一份积木代码做预测，收到权威状态后回滚重放 | 等齐指令后推进；可选回滚（快照和恢复本来就有） | 发动作，等结果 |
| 对确定性的要求 | 无 | 严格：只能用标记为确定的积木，定期比对 World 哈希，不一致时从房主重新同步 | 无 |
| 服务器 | 需要运行游戏逻辑（Node 加无渲染宿主） | 只需转发 | 可以很薄；异步对战时把 World 快照存在服务器上 |

确定性的具体约束（只有帧同步需要）：

- JS 的加减乘除和开方在各引擎上结果一致，但 `Math.sin`、`Math.pow` 等不保证逐位一致，所以模拟侧提供 `w.math` 的确定版本，`pot check` 对帧同步游戏检查模拟代码（积木的 `step` 和规则的 `do`）里的 `Math.random`、`Date`、`Math.sin` 等用法。
- 同一个积木的 TS 实现和 C# 实现不保证逐位一致，所以一局帧同步游戏里所有参与者必须使用同一种实现，握手时比对积木实现的哈希，不一致则统一退回 TS 实现。
- 使用宿主物理的积木不能用于帧同步。接入确定性版本的 wasm 物理库后，刚体可以用于帧同步。

### 9.3 低层需要新增的部分

- `ctx.net`：连接、房间、收发消息的低层服务，`Host` 增加对应接口（Unity 用 C# WebSocket，Web 用原生 WebSocket）。初期只做 WebSocket，UDP 类传输以后再议。
- `pot serve <游戏目录> --mode authority|relay`：基于现有 Dev Server 的 WebSocket 基础做一个房间服务器。权威模式下它在 Node 里加载同一个游戏包运行模拟。
- 开发闭环：`pot` 可以在一个 Node 进程里起一个服务器加若干无画面的机器人客户端，AI 不开多个 Runner 就能验证联机逻辑；机器人的输入用录制的指令流。

排行榜、登录这类服务不属于模拟，作为普通的服务型单元提供，不进入 World。

### 9.4 房间与房主

房间层的几条规定：

- 房主由房间服务指定，不由各客户端自己推算。各端自己用“id 最小的成员当房主”这类规则时，断线的连接可能还留在成员列表里，会选出一个已经不在的房主，全体失步。
- 掉线后一段时间内（默认一分钟）重连，拿回原来的槽位和名字。实体的 `owner` 指向槽位而不是连接，所以重连后控制权自然恢复。
- 应用切到后台或页面隐藏时主动让出房主。
- 中继模式的房间只转发，不理解游戏内容；权威模式才运行模拟。

## 10. 需要补的低层能力

高层只用公开的低层 API 实现，下列缺口要先在低层补上（核对自 `js/runtime/src` 和 `PotInput.cs`）：

| 能力 | 现状 | 用途 |
|---|---|---|
| 正交相机 | `scene.view` 只有 fov、near、far | 2D 和俯视角游戏 |
| 精灵、图集、瓦片地图 | 没有，只能用带贴图的 quad 拼 | 2D 游戏 |
| 手柄；可配置的触屏按钮 | 触屏只有左半屏虚拟摇杆，没有手柄 | 指令映射 |
| 网络 | 没有 | 联机 |
| 外部资源加载（glb、图片、音频文件）与骨骼动画播放 | 网格、贴图、音频目前都由代码生成 | 不适合程序化生成的内容（001 第 9 节） |
| 寻路 | 没有 | NPC。可以先在模拟侧用网格寻路实现，不依赖宿主 |
| 重叠查询、触发事件、刚体 | 只有射线和球体扫掠 | 由 6.7 的模拟侧碰撞覆盖，刚体待决 |
| 界面：弹性布局子集 | 只有单轴行列排布 | 界面重的游戏 |
| 界面：裁剪与滚动 | 没有 | 列表、背包、长文本 |
| 界面：图片 | 只有矩形、描边、渐变、线、弧、文字 | 图标、立绘、卡面 |
| 界面：输入框 | 没有 | 起名、聊天 |
| 界面：焦点与手柄导航 | 没有 | 手柄和键盘操作菜单 |

## 11. 首批积木与预制件（建议）

按“先让 hello 和一个 2D 小游戏、一个界面游戏能用高层写出来”来定，之后随真实游戏补充。

| 类别 | 名字 |
|---|---|
| 基础积木 | `transform`、`shape`、`sprite`、`light`、`sound`、`lifetime`、`spin` |
| 碰撞积木 | `body`（静态或运动学）、`trigger` |
| 移动积木 | `moveTopdown`、`movePlatformer`、`moveFps`、`movePath`（沿路径） |
| 玩法积木 | `health`、`damage`、`pickup`、`spawner`、`projectile`、`timer` |
| 行为积木 | `aiChase`、`aiPatrol`、`aiFlee` |
| 相机积木 | `cameraFollow`、`cameraFps`、`cameraFixed` |
| 预制件标签 | `entity`、`player`、`npc`、`enemy`、`coin`、`wall`、`ground`、`zone`、`bullet` |
| 内置节点 | `stage`（环境与相机）、`rule` |
| 界面标签 | `text`、`button`、`bar`、`image`、`row`、`column`、`panel`、`scroll`、`input` |

规则函数里常用的 World 方法：`w.destroy`、`w.spawn`、`w.emit`、`w.goto`、`w.count`、`w.query`、`w.rand`、`w.vars`、`w.play`（音效）、`w.after`（延时）。

## 12. 里程碑

| 阶段 | 内容 | 验收 |
|---|---|---|
| M1 内核最小版加 TSX 接入 | jsx 运行时与两遍转译（5.8）；`defineGame`、树求值与 key 对比；World 服务、带模式的积木、固定步调度、帧末变换批量同步、事件与规则、指令层；约 10 个积木；最简的 `ui` 求值（文本） | 用 5.1 的写法重写 hello，对比字节数和 AI 生成所用的 token；热重载后吃掉的金币不回来；存档行为不变 |
| M2 界面与工具 | 界面标签与布局、流程、`ui.local`；补界面的低层缺口；`pot blocks`、`pot check` 的求值校验、类型生成、`pot query world`、覆盖层、`pot test`；Skill 更新 | AI 只凭 Skill 和 `pot blocks` 写出一个新的小游戏和一个界面为主的小游戏 |
| M3 混用验证 | 模拟侧碰撞、`moveFps`、AI 积木；把 saltline 的玩家和敌人换成积木，渲染单元保留 | 行为与现版本一致，代码量明显下降 |
| M4 C# 积木 | 原生实现注册、列共享与跨语言开销实测、`pot block verify`；移植碰撞和一个移动积木；评估 wasm 物理库 | 同一录像两种实现结果一致，给出性能对比 |
| M5 联机 | `ctx.net`、房间服务、本地回环驱动与录像回放、权威同步、帧同步、回合制，按此顺序 | 每种驱动各有一个示例游戏和 Node 上的自动化用例 |
| M6 Web 原生宿主（远期） | `Engine` 子集的 Web 实现、可移植契约的屏蔽层 | hello 的高层版本在不含 Unity 的网页里运行 |

每个阶段结束都可以停下来评估，M1 的结果决定是否继续。

## 13. 风险

| 风险 | 应对 |
|---|---|
| 高层抽象不合用，AI 反而要读更多文档 | M1 就用真实对比数据说话；积木文档按需查询；高层不合用时逃生口保证不会卡住 |
| AI 按 React 的习惯写：用 hooks、把属性当受控值、在 `scene` 里读运行状态 | 运行时不导出 hooks，写了就是编译错误；`pot check` 的求值校验给出针对性的提示；模板的 `AGENTS.md` 和 Skill 开头就写五条规矩 |
| 没写 `key` 的列表在增删元素后身份错位 | `map` 产生的节点缺 `key` 时 `pot check` 告警；序号 key 只用于静态布置 |
| 世界标签与界面标签共用命名空间，tsc 查不出放错树 | 运行期校验加 `pot check`；两类标签的名字不重叠 |
| 积木越做越多越细，名字记不住 | 预制件承担“常用组合”，AI 多数时候只接触预制件标签；`pot blocks` 支持按意图搜索；属性名有补全 |
| 场景不再是数据文件，工具改不了源码 | 树的 JSON 视图、运行期补丁、覆盖层（5.9） |
| 自己写的界面求值器功能不够 | 先满足首批游戏；界面树的格式与 React 元素相近，以后可以换成 Preact 加仿 DOM 而不改游戏代码中不用 hooks 的部分 |
| 列式存储增加内核复杂度 | 游标访问器把它藏在内核里；内核有独立的 Node 用例 |
| JS 与 C# 不能零拷贝共享列 | 原型阶段先测；退化方案是每步只拷贝用到的列 |
| JS 模拟的性能不够，尤其在不允许 JIT 的平台 | 这正是 C# 积木要解决的；M3 用 saltline 的敌人数量做基准，M4 在 iOS 上实测 |
| Puerts 的 V8 在某些平台没有 WebAssembly | 接 wasm 物理库之前先实测；不行则刚体只走宿主物理 |
| 帧同步的确定性难以保证 | 作为三种驱动里最后做的一个；用哈希比对和 `pot check` 规则尽早发现问题 |
| 两层 API 并存，学习成本上升 | Skill 明确次序：先属性，再规则，再积木，最后单元 |

## 14. 待决事项

1. 界面运行时：M1 用自己写的极小求值器（6.8）；做界面重的游戏时再评估是否改用 Preact 加仿 DOM。
2. 类型给法：`vars` 和游戏自写积木的类型由工具生成到 `.pot/types.d.ts`，还是让游戏手写声明合并（推荐生成）。
3. 存储模型：对象式、列式、列式加游标（推荐第三种）。
4. 官方积木的 TS 源码放在哪：打进 Runner 的 `core.cjs`（游戏包最小，改积木要重建 Runner），还是作为随 Runner 分发、可被游戏同名覆盖的源码模块（可热重载，可弹出；推荐）。
5. 刚体动力学：只在表现侧用宿主物理（非确定），还是在模拟侧接入 wasm 物理库（倾向后者，取决于 WebAssembly 可用性的实测）。
6. 实体层级：实体标签是否允许子节点和父子变换，还是保持平的、只用片段和函数组件分组。
7. 自写积木与预制件的登记方式：在 `defineGame` 里显式列出，还是约定 `src/blocks/`、`src/prefabs/` 目录自动加载。
8. 命名：积木在代码里叫 Block 是否合适；服务名 `ctx.world`、入口 `defineGame` / `defineBlock` / `definePrefab` 是否沿用。
9. 2D 的坐标约定：2D 场景里 `at` 用两个数（x、y）并由内核映射到三维，还是始终写三个数。

## 15. M1 实施规格

本节是 M1 的施工说明，按它可以直接动手。凡是与前文不同的地方以本节为准；前文标为待决的事项，M1 一律按 15.1 的临时决定做，不阻塞实施。

### 15.1 M1 的临时决定

| 事项 | M1 的做法 | 以后 |
|---|---|---|
| 存储模型（6.5） | 对象式：每个实体一个普通对象。积木代码只通过 `me`、`e` 访问数据，不直接摸存储结构 | 换列式加游标时积木代码不改 |
| 界面运行时（6.8） | 自己写极小求值器，M1 只支持 `<text>` | M2 加布局与其余标签 |
| 登记方式（待决 7） | 游戏自写的积木和预制件在 `defineGame({ blocks, prefabs })` 里显式列出；用大写标签直接引用的预制件自动登记 | 再评估目录约定 |
| 官方积木放哪（待决 4） | `js/runtime/src/world/blocks/`、`world/prefabs.ts`，打进 core | 再评估可覆盖的源码模块 |
| 类型（待决 2） | 官方标签有准确类型；实体标签另加索引签名 `[block: string]: any`，游戏自写积木名不报错；`w.vars` 类型为 `Record<string, any>` | M2 生成 `.pot/types.d.ts` 后去掉索引签名 |
| 实体层级（待决 6） | 平的，实体标签带子节点即报错 | 再议 |
| 2D 坐标（待决 9） | 一律三个数 | 再议 |
| 变换 | `pos`、`rot`、`scale` 是实体自带字段，不是积木；第 11 节的 `transform` 在 M1 不存在 | 不变 |
| 流程 | 不做 `flow`，`s.state` 固定为 `'play'`，`s.params` 为 `{}`；写了 `flow` 报错并提示 M2 | M2 |
| 输入 | 只有本地驱动，`w.cmd(e)` 忽略 `e`，返回本地玩家的指令 | M5 按 `owner` 取 |
| 碰撞 | 只做触发重叠（球与盒），产生 `touch`；不做挡路、射线、角色移动 | M3 |
| 刚体 | 不做 | 待决 5 |
| 示例游戏 | 新建 `games/hello-tsx`，不改 `games/hello`：`hmr`、`runtime`、`state`、`devserver`、`no-eval` 等测试依赖 hello 的现有单元 | hello-tsx 稳定后再决定是否替换 |

### 15.2 文件清单

新增：

| 文件 | 内容 |
|---|---|
| `js/runtime/src/jsx-runtime.ts` | `jsx`、`jsxs`、`Fragment`、`namespace JSX` |
| `js/runtime/src/jsx-dev-runtime.ts` | `jsxDEV`、`Fragment`，再导出 `JSX` |
| `js/runtime/src/world/node.ts` | `PotNode` 类型、`isNode`、源位置格式化 |
| `js/runtime/src/world/registry.ts` | `defineBlock`、`definePrefab`、积木表与预制件表、深合并 |
| `js/runtime/src/world/tree.ts` | 树求值：展开、解析预制件、算 key 路径、校验，输出扁平的描述表 |
| `js/runtime/src/world/world.ts` | `WorldService`（`ctx.world`）：数据、挂载与对比、调度、事件、规则、指令 |
| `js/runtime/src/world/collide.ts` | 触发重叠检测 |
| `js/runtime/src/world/view.ts` | 表现：`view.enter/update/exit`、`stage`、帧末批量变换 |
| `js/runtime/src/world/ui-eval.ts` | 界面求值器 |
| `js/runtime/src/world/game.ts` | `defineGame` |
| `js/runtime/src/world/blocks/*.ts`、`world/prefabs.ts` | 官方积木与预制件（15.10） |
| `js/test/jsx.test.js`、`world-tree.test.js`、`world-diff.test.js`、`world-sim.test.js`、`world-view.test.js`、`world-hmr.test.js` | 见 15.12 |
| `games/hello-tsx/`：`manifest.json`、`tsconfig.json`、`src/plugins/game.tsx`、`data/coins.json` | 5.1 的写法；`coins.json` 复制自 hello |

修改：`runtime.ts`（安装 `WorldService`，模块表加两个 jsx 子路径）、`index.ts`（导出 `defineGame`、`defineBlock`、`definePrefab`、`Fragment` 和 World 相关类型，另以 `jsxRuntime`、`jsxDevRuntime` 两个名字导出 jsx 模块供模块表引用）、`plugins.ts`（`CORE_SERVICES` 加 `'world'`）、`js/devtools/src/loader.ts`、`js/devserver/builder.js`、各 `tsconfig.json`（均见 5.8）。`WorldService` 装在 `LoadingService` 之后、`PluginsService` 之前，并声明 `static inject = ['clock', 'state', 'input', 'scene', 'ui']`：cordis 4 里服务访问别的服务必须声明依赖，否则构造时就报错。

### 15.3 JSX 节点

```ts
export const Fragment = Symbol.for('pot.fragment')

export interface PotNode {
  type: string | typeof Fragment | Prefab | ((props: any) => PotChild)
  key: string | null            // 统一转成字符串
  props: Record<string, any>    // 子节点在 props.children，不另存
  source?: { file: string; line: number; col: number }
}
export type PotChild = PotNode | string | number | boolean | null | undefined | PotChild[]

export function jsx(type, props, key?): PotNode            // jsxs 与它相同
export function jsxDEV(type, props, key, isStatic, source, self): PotNode
```

函数只构造对象，不做别的。sucrase 的 `jsxDEV` 给出的 `source` 是 `{ fileName, lineNumber, columnNumber }`，在这里转成上面的形状。`JSX.Element` 就是 `PotNode`，`JSX.ElementChildrenAttribute` 是 `{ children: {} }`。

### 15.4 树求值

`evaluate(root, registry) → { entities: EntitySpec[], rules: RuleSpec[], stage: StageSpec | null, prefabs: Prefab[] }`，纯函数，Node 上可单测。`prefabs` 是树里以句柄直接引用的预制件（如 `<Coin />`），挂载时由 `WorldService` 补登记，这样游戏不登记也能用自己的预制件。出错时把全部错误收齐后一起抛出，`error.errors` 是逐条的列表。

逐个子节点按下列规则处理：

| 节点 | 处理 |
|---|---|
| `null`、`undefined`、`true`、`false`、`''` | 跳过 |
| 数组、不带 `key` 的片段 | 透明，子节点并入当前层 |
| 带 `key` 的片段 | 在路径上加一段 `#key`，再展开子节点 |
| 函数组件 | 路径加一段，以返回值继续展开 |
| `rule` | 生成 `RuleSpec { path, on, a, b, seconds, do, source }` |
| `stage` | 生成 `StageSpec`，一棵树只能有一个 |
| 其余小写标签，或 `definePrefab` 的返回值 | 生成 `EntitySpec` |
| 字符串、数字 | 报错：场景树里不能有文本 |

路径段的格式：有 `key` 时是 `名字:key`，没有时是 `名字#n`，`n` 是同一父层里同名节点的序号，从 0 开始；名字是标签名、预制件名或函数组件的函数名。整条路径用 `/` 连接，例如 `Level#0/coin:3`。同一棵树里路径重复即报错。

`EntitySpec` 的解析：

```ts
interface EntitySpec {
  path: string
  prefab: string                          // 预制件名
  at: [number, number, number]            // 缺省 [0, 0, 0]
  rot: [number, number, number]           // 欧拉角，度，缺省 [0, 0, 0]
  scale: [number, number, number]         // 写一个数时扩成三个
  name?: string
  tags: string[]                          // 预制件链上的 tags 与标签上的合并去重
  blocks: Record<string, Record<string, any>>   // 积木名到属性
  source?: PotNode['source']
}
```

属性按“预制件链从根到叶，最后是标签上的属性”的顺序深合并：普通对象逐字段合并，数组和其他值整个替换。每个积木最终的属性是“积木 `props` 默认值，加上述合并结果”。

积木属性的值可以是对象，也可以是 `true` 或 `false`：`true` 等同 `{}`，即加上这个积木、全部用默认值（如 `definePrefab('coin', { trigger: true })`）；`false` 或 `null` 表示去掉链上前面带来的这个积木（如 `<coin spin={false} />`）；`undefined` 不影响。其他值报错。`tags` 在预制件定义与标签上都可以写，合并去重。

校验，出错时报错信息都带 `文件:行号`：

| 情况 | 报错 |
|---|---|
| 小写标签不是登记的预制件，也不是 `rule`、`stage` | 未知的标签，列出相近的名字 |
| 属性名不是保留属性，也不是登记的积木 | 未知的积木 |
| 积木属性里有该积木 `props` 没有的字段 | 未知的字段 |
| 实体标签有子节点 | M1 不支持子节点 |
| 路径重复 | 重复的 key，提示用 `key` 或带 `key` 的片段区分 |
| 规则的 `on` 不是 `touch`、`death`、`every`，也不是合法的标识符 | 未知的事件 |

另外还校验：`at`、`rot`、`scale` 必须是三个有限数（`scale` 可写一个数）；`name` 必须是字符串；积木值必须是对象、`true`、`false` 或 `null`；`<rule>` 必须有 `do` 函数，`every` 必须有正数 `seconds`；`is` 链上的名字必须已登记且不能成环；函数组件抛出的异常记为一条错误。

### 15.5 World 数据

`WorldService` 在构造时调用 `ctx.state.define('world', { init })`，归属为 `(host)`，热重载和冷重启都靠现有的 `state` 机制保留。`state.restore` 可能换掉对象，所以内核每次进入 `fixed-update`、`update` 时都重新 `ctx.state.get('world')`，不跨帧缓存引用。

因此 `state.info()` 里会多出一条归属 `(host)` 的 `world` 条目。热重载回滚只恢复本次涉及单元拥有的 key，`world` 不在其中；回滚时旧单元重新 `apply` 并挂载，对比会把实体改回旧树的样子。

```ts
interface WorldData {
  nextId: number
  tick: number                             // 已执行的模拟步数
  seed: number                             // w.rand 的 uint32 状态
  vars: Record<string, any>
  entities: Record<string, EntityData>     // id 到实体
  mounts: Record<string, MountData>
  contacts: Record<string, true>           // 正在重叠的实体对，键为 '小id:大id'
}
interface EntityData {
  id: number
  prefab: string
  mount: string | null                     // w.spawn 生成的为 null
  path: string | null
  name?: string
  tags: string[]
  pos: number[]; rot: number[]; scale: number[]
  b: Record<string, Record<string, any>>   // 每个积木一个对象：属性与状态放在一起
  spawn?: Record<string, any>              // w.spawn 的覆盖参数，用于重建
}
interface MountData {
  keys: Record<string, { id: number; dead: boolean; last: string }>   // last：上次应用的 EntitySpec 规范化 JSON
}
```

`me` 就是 `e.b[积木名]`。属性与状态放在同一个对象里，属性约定只读。不进 `state` 的东西放在 `WorldService` 的内存表里，丢了可以重建：按积木名的实体索引、上一步的变换（插值用）、表现对象、当前规则表、事件队列。冷重启后这些表从 `WorldData` 重建。

`vars` 的合并：`defineGame` 的 `vars` 里有、`WorldData.vars` 里没有的键补上初值，已有的键保留。

冷重启时 `runtime.init` 先安装服务、后 `importJSON`，构造时 define 的 `world` 条目会被导入的整个替换（`defined` 也变回 false）。所以 `WorldService` 只在构造时 define 一次占住归属，之后一律 `get`，不保留构造时拿到的引用。

### 15.6 挂载与对比

`ctx.world.mount(tree, { id })` 求值后按 5.4 的表对比，挂载 id 缺省为调用单元的名字。对比时对每个 `EntitySpec`：

| 情况 | 处理 |
|---|---|
| 记录里没有 | 创建实体，各积木的状态取默认值，调用 `init`，记下 `last` |
| 记录里有且活着，`prefab` 变了 | 销毁后按新的创建 |
| 记录里有且活着 | 拿新旧 `last` 逐项比较：`at`、`rot`、`scale` 各自变了才写回实体；某积木的属性变了，只覆盖属性字段，状态字段不动；新增的积木加上，消失的积木去掉。然后更新 `last` |
| 记录里有，`dead` 为真 | 不动 |
| 记录里有，新树里没有 | 活着则销毁；删掉记录 |

玩法中销毁一个属于挂载的实体时，把它的记录标为 `dead`，不删除。

对比造成的销毁（`prefab` 变了、新树里没有）不是玩法事件，不发 `death`。

单元回收与重载：`mount` 通过调用单元的 `ctx.effect` 登记。单元被回收时，挂载只标记为“脱离”，实体不动；如果在下一次清扫之前同一 id 被重新挂载，就是热重载，按上表对比；否则就是单元被移除，销毁它的全部实体并删除记录。用 `w.spawn` 生成的实体不属于任何挂载，生成它的单元脱离时不清理。

已确认（读 `devtools/src/hmr.ts` 的 `reload`）：热重载事务从开始到提交或回滚全程持有 `clock.freeze()`，冻结时 `clock.tick` 在触发 `fixed-update`、`update` 之前就返回；回滚也在冻结期内。所以回收与重新 `apply` 之间不会插进任何一步，上面的做法成立，不需要额外的重载完成事件。

清扫的时机与范围：

- 清扫在 `fixed-update` 与 `update` 中先到的那一处执行。帧率高于步频时一帧可能没有 `fixed-update`，只挂在 `fixed-update` 上会让被移除单元的实体多显示若干帧。
- 冷重启（`importJSON` 带回 `mounts`）后，本次运行里还没有被挂载过的记录一律视为脱离，第一次清扫时处理。例如 manifest 去掉了某个单元，它挂的实体在冷重启后也要清掉，不能永远留在数据里。

`scene` 的重新求值不需要额外的触发机制：热重载、数据文件变化都会让 `defineGame` 生成的单元重新 `apply`，`apply` 里求值并挂载即可。

规则表按挂载 id 存在内存里，每次挂载整体替换，所以热重载后新函数下一步生效。

### 15.7 World 接口

`ctx.world` 与规则里的 `w` 是同一个对象。

```ts
interface World {
  readonly dt: number                     // clock.fixedStep
  readonly time: number                   // tick * dt
  readonly tick: number
  readonly vars: Record<string, any>
  mount(tree: PotChild, options?: { id?: string }): void
  spawn(prefab: string | Prefab, props?: SpawnProps): EntityData   // 立即加入数据，下一步起参加 step
  destroy(e: EntityData | number): void   // 延迟到本步末尾
  get(id: number): EntityData | undefined
  query(filter?: string): EntityData[]    // 省略为全部存活实体
  count(filter?: string): number
  on(event: string, filter: string, fn: Handler): () => void
  on(event: string, fn: Handler): () => void
  emit(name: string, payload?: any): void
  cmd(e?: EntityData): Cmd
  rand(): number                          // [0, 1)
  rand(min: number, max: number): number
}
interface Cmd {
  axis(name: string): { x: number; y: number }
  down(action: string): boolean
  pressed(action: string): boolean        // 本步刚按下
}
```

`SpawnProps` 与实体标签的属性相同（保留属性加积木覆盖）。`filter` 匹配实体的标签，或匹配它预制件链上的任一名字，所以 `bigCoin` 也匹配 `coin`。`w.on` 从普通单元调用时随该单元回收。`w.rand` 用 mulberry32，状态在 `seed` 里。

“待销毁”指已调用 `destroy`、还没在第 7 步应用的实体：它仍在 `entities` 里，但 `get`、`query`、`count` 都不返回它，也不再参加 `step` 和触发检测。

### 15.8 每一步

`fixed-update` 里按顺序：

1. 采样指令：按 `controls` 映射，轴读 `ctx.input.axis(名字)`，动作读 `ctx.input.key(键)`，任一键按住即为按下；`pressed` 由内核比较本步与上一步得出，不用 `ctx.input.pressed`，因为一帧可能跑零步或多步。缺省映射是 `axes: { move: 'move', look: 'look' }`、`actions: { jump: ['space'], fire: ['mouse0'] }`。
2. 记录每个实体的上一步变换（插值用）。
3. 按积木的 `order`（缺省 0，小的先，同序按登记顺序）逐个积木，对拥有它的存活实体调用 `step(me, e, w)`。
4. 触发检测（15.9），产生 `touch` 事件。
5. `every` 规则：记 `n = max(1, round(seconds / dt))`，在第 n、2n… 步触发，即本步的 `(tick + 1) % n === 0`（`tick` 在第 8 步才加一）。这样 `seconds={0.5}` 在开局 60 步里恰好触发 2 次，第 0 步不会立刻触发。
6. 处理事件队列，依次是 `touch`、自定义事件；对每个事件按规则在树里的顺序调用匹配的 `do`。
7. 应用延迟销毁，每销毁一个发 `death`，处理 `death` 规则；规则里又销毁或发事件的，回到第 6 步，最多 8 轮。超过时报错一次，丢弃队列中剩余的事件，剩余待销毁的实体直接移除（挂载记录照样标 `dead`，但不再发 `death`），保证这一步能结束。
8. `tick` 加一。

`touch` 的匹配：对实体对 `(x, y)`，规则的 `a` 匹配 `x` 且 `b` 匹配 `y` 时调用 `do(w, x, y)`；否则反过来匹配时调用 `do(w, y, x)`。实体对按 id 从小到大处理，结果确定。处理某个 `touch` 事件时，若任一方已被移除或已在待销毁中（例如同一步里前面的规则 `destroy` 了它），整个事件跳过。规则或积木抛出的异常按“来源 + 信息”去重，只打印一次（带规则的源位置），不中断这一步的其余部分。

进入 `fixed-update` 时先执行一次清扫（15.6），再从第 1 步开始。

### 15.9 触发检测

拥有 `trigger` 积木的实体参加检测。`trigger` 的属性是 `{ radius: 0.5 }` 或 `{ box: [x, y, z] }`（半边长），都乘以实体的 `scale`，中心在实体位置。检测球与球、球与盒、盒与盒（不旋转的盒）。实体数在 256 以内时两两检测，以上用格子大小为 4 的均匀网格。本步重叠且不在 `contacts` 里的实体对产生 `touch` 并加入 `contacts`；不再重叠或已销毁的实体对从 `contacts` 删除。

### 15.10 表现

在 `update` 里，`ui` 之前：

1. 应用 `stage`：与上次应用的值比较，变了才调用 `ctx.scene.background`、`ctx.scene.light`、相机的 `position` 与 `lookAt`。`stage` 的属性：`background`（颜色）；`sun`，写成欧拉角数组时为平行光的旋转、强度 1，写成 `{ rot, intensity, color }` 时逐项指定；`camera: { at, look }`。平行光对象由 `WorldService` 持有，`sun` 变了时先销毁旧的再建。
2. 新出现的实体，对它的每个积木调用 `view.enter(me, e, ctx, w)`，返回的场景对象（一个、数组或空）记在内存表里，并记下每个对象创建时的缩放。消失的实体，先调 `view.exit`，再销毁它的场景对象。积木定义对象被替换（热重载）时，对拥有它的实体重做 `exit` 与 `enter`。
3. 调用各积木的 `view.update(me, e, objs, ctx, w)`。
4. 变换同步：`enter` 返回的对象都跟随实体。位置为上一步与本步按 `ctx.clock.fixedAlpha` 线性插值，旋转为两个四元数球面插值，缩放为实体缩放乘以对象创建时的缩放。所有对象写进一个复用的 `Float32Array`（每个 10 个数），一帧只调用一次 `ctx.scene.setTransforms`。

欧拉角与 `scene.spawn` 的 `rotation` 用同一约定，换算函数优先用 `scene.ts` 现有的，没有就新增并加测试。表现对象不经调用单元的 `ctx.effect`，由 `WorldService` 自己管，单元重载时不会被误回收。

### 15.11 积木、预制件、界面、defineGame

```ts
interface BlockDef<P extends object, S extends object> {
  name: string
  about: string
  props?: P
  state?: S
  order?: number
  init?(me: P & S, e: EntityData, w: World): void
  step?(me: P & S, e: EntityData, w: World): void
  view?: {
    enter?(me: P & S, e: EntityData, ctx: Context, w: World): SceneObject | SceneObject[] | void
    update?(me: P & S, e: EntityData, objs: SceneObject[], ctx: Context, w: World): void
    exit?(me: P & S, e: EntityData, objs: SceneObject[], ctx: Context, w: World): void
  }
}
function defineBlock<P, S>(def: BlockDef<P, S>): BlockDef<P, S>
function definePrefab(name: string, def: { is?: Prefab | string; tags?: string[]; [block: string]: any }): Prefab
```

`definePrefab` 的返回值是一个可调用的函数 `(props) => PotNode`，函数上带 `prefab`（名字）、`def`（定义）和一个标记，`tree.ts` 靠标记识别。做成函数而不是普通对象 `{ name, def }`，是因为 TSX 的大写标签 `<Coin />` 要求标签类型可调用，否则过不了类型检查；`tree.ts` 不会调用它，只读 `prefab` 与 `def`。名字必须是小写开头的驼峰标识符（与小写标签同名，`<coin>` 与 `<Coin>` 指同一个预制件）。`is` 可以写预制件句柄，也可以写已登记的预制件名。登记时游戏的同名积木、预制件覆盖官方的，撤销登记（热重载卸载游戏单元）后露出官方的；同 `order` 的积木按名字第一次登记的先后执行，重新登记不改变先后。

M1 的官方积木：`shape`（`kind` 为 cube、sphere、plane、cylinder 等 `scene.spawn` 支持的形状，`color`，`scale`）、`spin`（`speed`，度每秒，绕 y 轴）、`moveTopdown`（`speed`，读 `move` 轴，写 `pos` 的 x、z）、`trigger`（15.9）、`lifetime`（`seconds`，到时销毁）、`projectile`（`speed`、`dir`）、`cameraFollow`（`offset`，在 `view.update` 里移动相机）、`light`（点光源）。

M1 的官方预制件：`entity`（空）、`player`（`shape` 青色方块、`moveTopdown`、`trigger` 半径 0，标签 `player`；半径 0 即按玩家中心点判定，与 hello 的“玩家中心进入金币 0.8 米内即拾取”一致）、`coin`（`shape` 黄色球、`trigger`、`spin`，标签 `coin`）、`ground`（`shape` 平面）、`wall`（`shape` 方块）、`bullet`（`shape` 小球、`projectile`、`lifetime`、`trigger`）。

界面求值器：`ui(w, ctx.ui)` 每帧在表现之后调用，返回的树里只认片段、数组、函数组件和 `<text>`。`<text>` 的子节点里的字符串和数字拼成一行；`at` 是九宫格位置名（`top-left`、`top`、`top-right`、`left`、`center`、`right`、`bottom-left`、`bottom`、`bottom-right`）或像素坐标 `[x, y]`，九宫格离屏幕边缘 16 像素；`size`、`color`、`bold` 原样传给 `ctx.ui.text`，对齐方式由 `at` 推出。其他标签报错，同一个标签只报一次。

`defineGame(def)` 返回 `{ apply(ctx) }`，不设 `name`，由加载器按文件名命名。`apply` 依次：登记 `blocks`、`prefabs`；合并 `vars`；以 `s = { state: 'play', params: {}, data: ctx.data }` 求值 `scene` 并 `ctx.world.mount`；有 `ui` 时 `ctx.on('update', ...)` 每帧求值界面。登记和 `on` 都随单元回收。

### 15.12 测试与验收

测试放在 `js/test/`，用 `helpers.js` 的 `startGame(files)`、`frames`、`run` 和 `MockEngine`，单元源码以 `.tsx` 文件放进 `files`。`MockEngine` 没有注入轴的口子就加一个。

| 文件 | 覆盖 |
|---|---|
| `jsx.test.js` | 节点形状、`Fragment`、`key` 转字符串、`jsxDEV` 的源位置；5.8 的五个转译用例经加载器加载后运行正确；`TRANSPILER_ID` 已改 |
| `world-tree.test.js` | 预制件继承与深合并；`scale` 扩成三个数；路径格式与重复报错；15.4 校验表的每一行，报错带行号 |
| `world-diff.test.js` | 15.6 表的每一行；`at` 未变时实体位置不被拉回；`dead` 的实体不重建；`vars` 合并 |
| `world-sim.test.js` | `moveTopdown` 在注入轴后移动；`touch` 规则销毁金币并加分；`death`、`every`、自定义事件；第 7 步的轮数上限；同一输入跑两次 World 完全相同 |
| `world-view.test.js` | 实体出现与消失时场景对象创建与回收；一帧只调用一次 `setTransforms`；`stage` 不变时不重复调用 |
| `world-hmr.test.js` | 改 `game.tsx` 后：吃掉的金币不回来、玩家位置保留、`vars` 保留、新规则生效；改金币坐标后金币移动；从 manifest 去掉单元后实体全部销毁；`exportJSON` 后冷重启 World 一致 |

另在 `devserver.test.js` 里加一例：`buildRelease` 一个含 `.tsx` 的游戏，产物能在 Node 宿主上跑起来。

M1 验收：`npm test` 全部通过（含原有用例）；`pot check games/hello-tsx` 通过；`games/hello-tsx` 在 Runner 里可玩，行为与 hello 相同；报告 hello-tsx 与 hello 的源码字节数对比。

### 15.13 实施顺序

1. jsx 运行时与转译链（5.8），`jsx.test.js` 通过。
2. `registry.ts`、`tree.ts`，`world-tree.test.js` 通过。这两步不依赖运行时，可以先在 Node 上完成。
3. `WorldService` 的数据、挂载与对比、调度、事件、规则、指令、触发检测，`world-diff`、`world-sim` 通过。
4. 表现与界面求值器，`world-view` 通过。
5. 官方积木与预制件、`defineGame`，`world-hmr` 通过。
6. `games/hello-tsx`、各 `tsconfig`、发布构建，跑全量 `npm test` 与 `pot check`。
