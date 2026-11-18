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
- 目前只实现 D3D11 后端，其他图形 API 下 `PotGfx.Check()` 返回不可用原因，JS 侧 `gfx.supported` 为 false。
