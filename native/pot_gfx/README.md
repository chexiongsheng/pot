# pot_gfx

Runner 的运行时着色器能力：游戏包里的 GLSL ES 3.10 源码在 Runner 内编译并由原生插件在 URP pass 中绘制，Runner 不依赖 Editor，换着色器不需要重建 Runner。

```
GLSL ES 310 --glslang--> SPIR-V --SPIRV-Cross--> HLSL SM5.0  --D3DCompile-->            D3D11
                                            \-> MSL 2.1      --newLibraryWithSource--> Metal（macOS）
                                            \-> GLSL 300 es  --glCompileShader-->      GLES3 / WebGL2
```

## 依赖（由 CMake 自动下载，无需手动 clone）

| 库 | 版本 | 下载方式 |
| --- | --- | --- |
| glslang | 15.0.0 | CMake `FetchContent` 自动拉取 |
| SPIRV-Cross | vulkan-sdk-1.4.304.0 | CMake `FetchContent` 自动拉取 |

首次配置时 CMake 会自动下载到 build 目录（默认 `<build>/_deps/`），无需在 `third_party/` 手动放置。需要能访问 GitHub；如需离线/内网，可自行改用本地镜像地址。

## 构建（Windows x64，VS 2022）

`pot_gfx.dll` 不入库。`pot release` / `pot runner` 出包前缺少时会自动构建；也可手动执行（`--force` 强制重建）：

```powershell
node js/devserver/cli.js native --platform win64 --force
```

或直接用 CMake：

```powershell
cmake -S native/pot_gfx -B native/pot_gfx/build -G "Visual Studio 17 2022" -A x64 -DUNITY_PLUGIN_API="D:/Program Files/Unity/Hub/Editor/2022.3.62f1c1/Editor/Data/PluginAPI"
cmake --build native/pot_gfx/build --config Release --target pot_gfx pot_shaderc
Copy-Item native/pot_gfx/build/Release/pot_gfx.dll packages/com.pot.core/Plugins/Windows/x86_64/ -Force
```

复制后需重建 Runner（`RunnerBuild.BuildWin64`），产物中应有 `PotRunner_Data/Plugins/x86_64/pot_gfx.dll`。

`pot_shaderc.exe` 是离线调试工具：`pot_shaderc a.vert a.frag [--hlsl|--gles|--msl]` 输出翻译后的 HLSL/GLSL/MSL 与反射 JSON，用于排查编译问题，不参与运行时。

## 构建（macOS，Metal 后端）

需要 CMake 与 Xcode 命令行工具（clang）。产物 `Plugins/macOS/pot_gfx.bundle`（arm64 + x86_64 通用包，不入库，meta 入库，只对编辑器与 OSXUniversal 启用）：

```bash
node js/devserver/cli.js native --platform macos --force --unity /Applications/Unity/Hub/Editor/<版本>/Unity.app
```

或直接用 CMake（PluginAPI 必须取 Unity 自带的，需要 `IUnityGraphicsMetal.h`）：

```bash
cmake -S native/pot_gfx -B native/pot_gfx/build-macos -DCMAKE_BUILD_TYPE=Release -DUNITY_PLUGIN_API=/Applications/Unity/Hub/Editor/<版本>/Unity.app/Contents/PluginAPI
cmake --build native/pot_gfx/build-macos --target pot_gfx pot_shaderc --parallel
rm -rf packages/com.pot.core/Plugins/macOS/pot_gfx.bundle && cp -R native/pot_gfx/build-macos/pot_gfx.bundle packages/com.pot.core/Plugins/macOS/
```

编辑器已加载过旧 bundle 时需重启 Unity 才会换新。Unity 需运行在 Metal 下（macOS 默认）。

## 约定

- uniform 默认块名 `pot_Uniforms`（set 0 / binding 0），贴图槽以反射信息为准。
- varying 按名字配对，片元用到的排在前面（D3D11 允许 PS 输入签名是 VS 输出的前缀）。
- 矩阵列主序；投影矩阵经 `GL.GetGPUProjectionMatrix` 处理，翻转与 Reversed-Z 通过 flags 告知原生端。
- Metal：MSL 统一块在 `buffer(0)`，贴图与采样器同号（`texture(N)` / `sampler(N)`，N 取反射槽位），入口 `main0`；网格 / 缺省属性 / 实例数据分别占 `buffer(28/29/30)`。PSO 按程序缓存（key 含附件格式、混合、顶点布局）。编译缓存里 Metal 存的是 MSL 源码，不是二进制。
- Metal 的渲染通道是延迟开启的，后处理输出与 GL 一样走事件 1 显式传目标贴图（后端自建 Load/Store 通道）；事件 0 优先复用 Unity 当前的 encoder，没有时复制当前通道描述自建。
- 已实现 D3D11、Metal 与 GLES3/WebGL2 后端，其他图形 API 下 `PotGfx.Check()` 返回不可用原因，JS 侧 `gfx.supported` 为 false。
- 正面绕序：Unity 网格正面为顺时针。D3D11 翻转渲染目标时 C# 置 `F_FrontCCW`；GL 不翻转，默认 `glFrontFace(GL_CW)`，置了 `F_FrontCCW` 才用 `GL_CCW`。写反会让所有单面物体只画背面（地面从上方消失、集装箱透视），改动后须在 WebGL 包里目测验证。
- 每次绘制的数据（uniform、贴图、状态）由 C# 写入一个按票号索引的槽，渲染线程事件按票号取出后删除。槽不设固定数量（同一帧可提交任意多次绘制或烘焙），超过 4096 个未消费槽时视为泄漏并清空。
- 烘焙（`PotGfx.Bake`）不设视口和渲染目标：C# 用 CommandBuffer 先绑定 RenderTexture（单目标或 MRT）并清空，再发插件事件，原生端在当前绑定的目标上画裁剪空间全屏四边形；flags 带“关深度测试”，混合状态设在 RenderTarget[0] 上，对所有 MRT 目标生效。
- 编译缓存（`src/cache.cpp`）：C# 启动时用 `PotGfx_SetCacheDir` 设为 `persistentDataPath/cache/shaders`。键是（`kCacheVersion`、后端、vs、fs）的 128 位哈希，文件 `<hex>.bin` 存反射信息和两段 DXBC；命中时跳过 glslang、SPIRV-Cross 与 D3DCompile，用缓存创建失败则退回完整编译并覆盖。升级 glslang、SPIRV-Cross、改反射结构或编译参数时必须改 `kCacheVersion`。写入先写 `.tmp` 再改名，写失败只影响缓存不影响运行。`PotGfx_CacheHits/Misses` 给出本次进程的命中统计。
