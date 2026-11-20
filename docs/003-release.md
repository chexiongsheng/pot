# 自动发布打包

平时用 Runner 直接打开游戏源码开发和热重载；发布时使用同一个 `com.pot.core`，由通用 Unity 壳工程 `player/` 打出独立应用。整个过程不需要打开 Unity 编辑器。

## 一键出包

在仓库根目录执行：

```powershell
# 单个平台
node js/devserver/cli.js release games/jimao --platform win64

# 三个平台依次出包
node js/devserver/cli.js release games/jimao --platform win64,android,webgl

# 显式指定 Unity、输出目录（多平台时自动附加平台子目录）
node js/devserver/cli.js release games/jimao --platform win64,android,webgl `
  --unity "D:\Program Files\Unity\Hub\Editor\2022.3.62f1c1\Editor\Unity.exe" `
  --out D:\build\jimao
```

也可以用 `tools/release.cmd`，参数完全相同。`--unity` 可省略：脚本读取 `POT_UNITY`、`UNITY_PATH`，或按 `player/ProjectSettings/ProjectVersion.txt` 在 Unity Hub 安装目录中查找。

默认产物在 `release/<游戏名>/<平台>/`：

- `win64`：`jimao.exe` 及配套数据目录（IL2CPP，含 `GameAssembly.dll`）。
- `android`：`jimao-<版本>.apk`（ARM64、IL2CPP，最低 Android 7.0）。
- `webgl`：可部署到静态 HTTP 服务器的目录，入口为 `index.html`。

Unity 的完整日志在 `<游戏目录>/.pot/release/unity-<平台>.log`，脚本同时转发关键构建行。编译失败、产物缺失或 Puerts WebGL 后处理缺失都会返回非零退出码。

## manifest 发布配置

```json
{
  "id": "pot.jimao",
  "name": "几猫 · 港区突击",
  "version": "0.1.0",
  "apiVersion": "0.1",
  "plugins": ["game"],
  "icon": "icon.png",
  "release": {
    "company": "pot",
    "packageId": "com.pot.jimao",
    "versionCode": 100,
    "orientation": "landscape",
    "fileName": "jimao",
    "window": { "width": 1600, "height": 900, "fullscreen": false, "resizable": true }
  }
}
```

除 `id`、`plugins` 外，发布字段都可省略。`icon` 支持 PNG/JPG；未指定时自动查找 `icon.png`。`packageId` 缺省由 `id` 规范化；`versionCode` 缺省由三段版本号推出；`orientation` 支持 `landscape`、`portrait`、`auto`。

### 内置字体

发布包会带一份中文字体子集，WebGL 拿不到系统字体，没有它中文就不显示。暂存时脚本收集游戏文件（`bundle.cjs`、`data/**` 中的文本）里出现过的全部字符，加上 ASCII 和常用中文标点，从开源字体裁出子集，jimao 约 630 字、172 KB。

- 字体来源依次为 `release.font`（相对游戏目录的 ttf/otf）、环境变量 `POT_FONT`、本机已安装的 Noto Sans SC 或思源黑体。只用 OFL 等可再分发的字体，微软雅黑等系统字体不能随包分发。
- 找不到字体源时照常出包，但会打印警告，此时 WebGL 中文无法显示。
- 运行时拼出来、源码里没出现过的字（例如玩家输入、服务器下发的文本）不在子集里，会回退到系统字体；可以用 `release.fontChars` 补充。

### 平台能力提示

打包时按目标平台输出 `[pot] 平台能力` 警告；运行时启动日志写明运行时着色器后端（`d3d11` / `gles3` / 不可用），不可用时说明原因。Win64 会被固定为 D3D11、WebGL 固定为 WebGL2，避免选到没有 `pot_gfx` 后端的图形 API。

## 打包流程

1. `js/devserver/builder.js` 用 esbuild 把 `src/plugins/*.ts` 及其共享 TS/JS 模块编译、打包成 `bundle.cjs`，不把 TS 源文件放进发布包。
2. `js/devserver/release.js` 暂存 `manifest.json`、`bundle.cjs`、`data/**`、发布配置和图标。
3. Unity 批处理入口 `Pot.Build.PotBuild.Build` 把暂存资源导入 `Assets/PotGame/Resources/pot-game`，生成只含 `PotBoot` 的启动场景，设置 URP、Puerts、名称、包名、版本、图标、方向和窗口。
4. 调用标准 `BuildPipeline.BuildPlayer` 出包。游戏仍由同一份 JS 运行时执行，不依赖 Runner 外壳或 Dev Server。

`player/Assets/PotGame`、`player/Assets/Gen` 每次构建重新生成，已被 `.gitignore` 排除。想人工查看或调整时，可以正常用 Unity 打开 `player/`，使用菜单 `pot/Import Game Only` 导入游戏，或 `pot/Build Game...` 出包。编辑器占用工程期间，命令行会拒绝同时构建。

当前命令使用 `-batchmode`，没有加 `-nographics`：本项目的内置着色器导入需要图形设备，Runner 构建也有同样约束。

## 平台说明

- Win64 与 Android 都使用 IL2CPP（Android 为 ARM64），Runner 同样；WebGL 使用 Puerts 的浏览器 JS 后端。Win64 IL2CPP 需要 Unity Windows Build Support (IL2CPP) 模块和 Visual Studio C++ 工具链。
- Android 需要 Unity Android Build Support、SDK/NDK/JDK；WebGL 需要 WebGL Build Support。未安装对应模块时 Unity 会在日志中报错。
- WebGL 产物必须通过 HTTP/HTTPS 打开，不能双击 `index.html` 使用 `file://`。默认 gzip 压缩并启用解压回退，普通静态服务器即可托管；配置 `Content-Encoding: gzip` 可减少下载前的浏览器解压工作。
- 原生 `pot_gfx` 运行时着色器后端支持 D3D11（win64）与 GLES3（WebGL2）。WebGL 插件以源码形式放在 `Plugins/WebGL/pot_gfx`，由 Unity 的 emscripten 一起编译；改了 `native/pot_gfx/src` 后要执行 `node native/pot_gfx/sync-webgl.js` 再出包。其他平台 `ctx.gfx.supported` 为 `false`，游戏需自备回退。
- 各平台图形、输入、音频和文件系统能力仍受 Unity/Web 平台限制。构建成功不等于所有游戏功能都已在目标设备验证，发布前应在真实设备上试玩。
