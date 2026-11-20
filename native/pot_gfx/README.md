# pot_gfx

Runner 的运行时着色器能力：游戏包里的 GLSL ES 3.10 源码在 Runner 内编译并由原生插件在 URP pass 中绘制，Runner 不依赖 Editor，换着色器不需要重建 Runner。

```
GLSL ES 310 --glslang--> SPIR-V --SPIRV-Cross--> HLSL SM5.0 / GLSL 300 es --D3DCompile--> D3D11
```

## 依赖（不入库，放在 `third_party/`）

| 库 | 版本 | 目录 |
| --- | --- | --- |
| glslang | 15.0.0 | `third_party/glslang` |
| SPIRV-Cross | vulkan-sdk-1.4.304.0 | `third_party/SPIRV-Cross` |

```powershell
git clone --depth 1 -b 15.0.0 https://github.com/KhronosGroup/glslang third_party/glslang
git clone --depth 1 -b vulkan-sdk-1.4.304.0 https://github.com/KhronosGroup/SPIRV-Cross third_party/SPIRV-Cross
```

## 构建（Windows x64，VS 2022）

```powershell
cmake -S native/pot_gfx -B native/pot_gfx/build -G "Visual Studio 17 2022" -A x64 -DUNITY_PLUGIN_API="D:/Program Files/Unity/Hub/Editor/2022.3.62f1c1/Editor/Data/PluginAPI"
cmake --build native/pot_gfx/build --config Release --target pot_gfx pot_shaderc
Copy-Item native/pot_gfx/build/Release/pot_gfx.dll packages/com.pot.core/Plugins/Windows/x86_64/ -Force
```

复制后需重建 Runner（`RunnerBuild.BuildWin64`），产物中应有 `PotRunner_Data/Plugins/x86_64/pot_gfx.dll`。

`pot_shaderc.exe` 是离线调试工具：`pot_shaderc a.vert a.frag` 输出翻译后的 HLSL/GLSL 与反射 JSON，用于排查编译问题，不参与运行时。

## 约定

- uniform 默认块名 `pot_Uniforms`（set 0 / binding 0），贴图槽以反射信息为准。
- varying 按名字配对，片元用到的排在前面（D3D11 允许 PS 输入签名是 VS 输出的前缀）。
- 矩阵列主序；投影矩阵经 `GL.GetGPUProjectionMatrix` 处理，翻转与 Reversed-Z 通过 flags 告知原生端。
- 已实现 D3D11 与 GLES3/WebGL2 后端，其他图形 API 下 `PotGfx.Check()` 返回不可用原因，JS 侧 `gfx.supported` 为 false。
- 正面绕序：Unity 网格正面为顺时针。D3D11 翻转渲染目标时 C# 置 `F_FrontCCW`；GL 不翻转，默认 `glFrontFace(GL_CW)`，置了 `F_FrontCCW` 才用 `GL_CCW`。写反会让所有单面物体只画背面（地面从上方消失、集装箱透视），改动后须在 WebGL 包里目测验证。
- 每次绘制的数据（uniform、贴图、状态）由 C# 写入一个按票号索引的槽，渲染线程事件按票号取出后删除。槽不设固定数量（同一帧可提交任意多次绘制或烘焙），超过 4096 个未消费槽时视为泄漏并清空。
- 烘焙（`PotGfx.Bake`）不设视口和渲染目标：C# 用 CommandBuffer 先绑定 RenderTexture（单目标或 MRT）并清空，再发插件事件，原生端在当前绑定的目标上画裁剪空间全屏四边形；flags 带“关深度测试”，混合状态设在 RenderTarget[0] 上，对所有 MRT 目标生效。
- 编译缓存（`src/cache.cpp`）：C# 启动时用 `PotGfx_SetCacheDir` 设为 `persistentDataPath/cache/shaders`。键是（`kCacheVersion`、后端、vs、fs）的 128 位哈希，文件 `<hex>.bin` 存反射信息和两段 DXBC；命中时跳过 glslang、SPIRV-Cross 与 D3DCompile，用缓存创建失败则退回完整编译并覆盖。升级 glslang、SPIRV-Cross、改反射结构或编译参数时必须改 `kCacheVersion`。写入先写 `.tmp` 再改名，写失败只影响缓存不影响运行。`PotGfx_CacheHits/Misses` 给出本次进程的命中统计。
