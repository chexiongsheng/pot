# Game API 语义

游戏代码只依赖 `@pot/core`（运行时挂在 `globalThis.pot`）。每个单元自动注入全部核心服务（clock、timer、state、cache、data、scene、input、plugins），不用手写 `inject`。

## ctx.on('update', (dt, time) => {})

每个游戏帧触发。`dt` 为缩放后的秒数（单帧最大 0.1 秒），`time` 为游戏时间。暂停、热重载冻结时不触发。

## ctx.scene

| API | 说明 |
|---|---|
| `spawn({ shape, name, parent, position, rotation, scale, color, active })` | shape：cube/sphere/capsule/cylinder/plane/quad/empty。返回 `Entity`，随单元卸载自动销毁 |
| `light({ type, intensity, color, range, position, rotation })` | type：directional/point/spot |
| `camera` | 主相机 Entity，不能销毁；每次热重载都要重新设置位置 |
| `background(color)` | 纯色背景 |
| `find(name)` / `list(unit?)` | 查找 pot 创建的对象 |

`Entity`：`position`/`rotation`（欧拉角，度）/`scale` 读写都是一次跨语言调用，热点循环里先缓存；`move(dx,dy,dz)`、`lookAt(vec|entity)`、`color(c)`、`active(bool)`、`destroy()`、`alive`。

颜色可用 `'#rgb'`、`'#rrggbb'`、`'#rrggbbaa'` 或 `[r,g,b,a?]`（0 到 1）。

## ctx.state

| API | 说明 |
|---|---|
| `define(key, { version, init, migrate })` | 返回活对象。key 已存在且版本相同时返回同一个对象，这就是热重载保留状态的原因 |
| `get(key)` | 读取任意单元的 state（只读使用，写入归属单元自己） |
| `set(key, value)` | 整体替换，会断开旧引用，少用 |
| `keys()` / `reset(key?)` / `snapshot()` / `restore()` | 开发工具和存档用 |

同一个 key 只能由一个单元 define。

## ctx.data

`load<T>(path)` 每次返回新解析的对象；`text(path)`、`exists(path)`。路径相对 `data/`。

## ctx.cache

可丢弃的派生数据（LRU，默认 64MB 预算），不参与快照。常用 `getOrCreate(name, deps, factory)`：deps 不变就复用，适合程序化生成的结果。

## ctx.input

`axis('move')`：WASD/方向键/触屏左半屏摇杆，返回 `{ x, y }`；`axis('look')`：鼠标增量。`key(name)` 按住、`pressed(name)` 本帧按下、`released(name)` 本帧抬起。键名不区分大小写，用 Unity KeyCode 名（`space`、`a`、`1`、`leftshift`）。

## 定时器

`ctx.timeout(cb, ms)`、`ctx.interval(cb, ms)` 返回取消函数；`await ctx.timeout(ms)` 在单元卸载时 reject。`ctx.throttle`/`ctx.debounce` 同 cordis。全部走游戏时间：暂停、时间缩放、热重载冻结都会生效。

## ctx.use(name, config)

在当前 ctx 下挂载子单元。父单元重载时子单元一起重建；子单元重载不影响父单元。`manifest.json` 的 `plugins` 是根上挂载的单元。

## ctx.logger(name)

`info`/`warn`/`error`/`debug`，支持 `%d %s %o` 格式化。日志会进入 Dev Server 的 `logs`。

## ctx.effect(setup, label)

自定义资源：`setup` 返回清理函数，单元卸载时执行。
