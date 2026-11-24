# Runner、Unity 包与发布

## 包

| 包 | 内容 | 发布包含 |
|---|---|---|
| `com.pot.core` | PotRuntime（JS 环境、帧驱动、冷重启）、GameFS、PotScene、PotInput、PotBoot、`Resources/pot/core.cjs` | 是 |
| `com.pot.devtools` | PotDevClient（WebSocket 连接 Dev Server、命令转发、截图、虚拟输入）、`devtools.cjs`（含 sucrase 源码加载器、热重载） | 否 |
| `com.pot.runner-shell` | PotRunner（首页、状态条、F1 / 三指触摸面板）、GameSession（打开目录 / .potg / URL、文件监听、镜像同步、存档） | 否 |
| `com.pot.build` | 编辑器构建：导入游戏包、生成启动场景、BuildPlayer | 编辑器 |

依赖 Puerts 3.0.4 core + v8，放在 `third_party/puerts/`（`tools/install-puerts.ps1 -Source <含 core 和 v8 的目录>`）。

## Runner

- 构建：`Unity -batchmode -quit -projectPath runner -executeMethod RunnerBuild.BuildWin64`（或 `BuildAndroid`）。不要加 `-nographics`。
- 打开游戏：`PotRunner.exe <游戏目录|.potg|URL>` 或 `-potOpen=<同上>`；无参数时显示首页（输入框 + 最近打开）。Dev Server 连上后也可 `pot open`。
- 来源：本地目录直接读并监听；`.potg` 解压到 `persistentDataPath/pot/installed/`，文件变化时重装；`http://…/files/<目录>/` 镜像到 `persistentDataPath/pot/mirror/` 并每秒轮询。存档在 `persistentDataPath/pot/saves/<id>.json`。
- Dev Server 地址：命令行 `-potServer=ws://ip:port/runner`（仅本次）> 面板中保存的地址 > `ws://127.0.0.1:7788/runner`。后台静默连接与重连，连不上不影响试玩。输入 `192.168.1.5` 会自动补全端口和路径。
- 手机连接时 Dev Server 所在电脑要放行端口，Android 需要允许明文 ws/http（Runner 已设置）。

## 发布构建

```powershell
Unity -batchmode -quit -projectPath <Unity 工程> -executeMethod Pot.Build.PotBuild.Build `
  -potGame=<游戏目录> -potOut=<输出路径，如 release\hello\Hello.exe> -potTarget=Win64
```

流程：`pot build` 产出 manifest.json + bundle.cjs + data → 复制到 `Assets/PotGame/Resources/pot-game` → 生成只含 PotBoot 的场景 → 生成 Puerts 必需文件 → BuildPlayer。也可在编辑器菜单 `pot/Build Game...` 执行。

## C# 侧的坑

### 构建报 Puerts_il2cpp.cpp not found
- 原因：Puerts 的构建前检查要求 `Assets/Gen/Plugins/puerts_il2cpp/Puerts_il2cpp.cpp` 存在，Mono 后端也一样。
- 做法：构建前调用 `Pot.Build.PotBuild.EnsurePuertsGenerated()`（已由构建脚本保证）。

### 包里的 link.xml 不生效
- 原因：Unity 只读取 Assets 下的 link.xml。
- 做法：构建时复制到 `Assets/PotGame/link.xml`（已由构建脚本保证）。JS 通过反射访问的 C# 类型都要在 link.xml 中保留或标 `[Preserve]`。

### 在后台线程调用 Unity API 报错
- 原因：WebSocket 收发在线程池，`Application.platform` 等只能在主线程调用。
- 做法：线程间只传字符串，命令统一在主线程 Update 中处理。

### JS 回调 C# 时的日志死循环
- 原因：JS 日志写 Debug.Log，devtools 又订阅 Unity 日志转发给 Dev Server。
- 做法：`PotHost.InJsLog` 标记，转发时跳过 JS 自己产生的日志（已由框架保证）。

### -nographics 下截图失败
- 现象：screenshot 返回“当前没有图形设备”。属于预期行为，需要截图时不要带 `-nographics`。

## 渲染（URP）

- Runner 使用 URP + Linear + HDR。`PotRender.cs` 负责天空、雾、天气、平面反射、后处理、画质、粒子；`PotLit.shader`、`PotUnlit.shader` 在 core 的 `Resources/pot/` 下。
- 每个对象的参数（贴图、tiling、湿润、自发光等）走 MaterialPropertyBlock，材质只按 mode 共享一份，避免几千个材质实例。
- SSAO 等 URP 内部类型（`ScreenSpaceAmbientOcclusion` 的设置类）是 internal，只能反射设置；升级 URP 版本后要先验证。
- 天空的环境反射探针按脚本刷新（`cullingMask = 0` 只拍天空），改天空参数后自动重拍。
- 新增后处理参数：`PostCfg` 加字段 → 在应用函数里 Override → JS `PostOptions` 加类型，颜色字段在 `post()` 里经 `rgb()` 转换。
