cmake_minimum_required(VERSION 3.20)
project(pot_gfx CXX C)

# pot_gfx：Runner 运行时着色器能力（GLSL ES 3.00 → SPIR-V → 目标平台着色器 → 驱动编译 → 原生绘制）
# 依赖由 CMake FetchContent 自动下载（见 native/pot_gfx/README.md 的固定版本）
#
# Android（NDK 工具链，-DANDROID_ABI=arm64-v8a）：与 WebGL 相同的精简构建，只有 GLES3 后端 + 反射，
# 不带 glslang/SPIRV-Cross 和编译缓存（GLES 源码直接交给驱动），也不构建 pot_shaderc。

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_POSITION_INDEPENDENT_CODE ON)
set(CMAKE_MSVC_RUNTIME_LIBRARY "MultiThreaded$<$<CONFIG:Debug>:Debug>")

set(POT_ROOT ${CMAKE_CURRENT_SOURCE_DIR}/../..)
set(UNITY_PLUGIN_API "" CACHE PATH "Unity Editor/Data/PluginAPI 目录")

if(ANDROID)
    add_library(pot_gfx SHARED
        src/reflect.cpp
        src/plugin.cpp
        src/backend.h
        src/compiler.h
        src/backend_gles3.cpp
    )
    target_include_directories(pot_gfx PRIVATE ${UNITY_PLUGIN_API})
    target_link_libraries(pot_gfx PRIVATE GLESv3 log)
    # 体积：去掉符号与未用代码（只保留 UNITY_INTERFACE_EXPORT 导出）；按 16KB 页对齐（Android 15+ 设备要求）
    target_compile_options(pot_gfx PRIVATE -fvisibility=hidden -ffunction-sections -fdata-sections)
    target_link_options(pot_gfx PRIVATE -Wl,--gc-sections -s -Wl,-z,max-page-size=16384)
    return()
endif()

include(FetchContent)

# ---- glslang：只要 GLSL 前端 + SPIR-V 生成 ----
set(ENABLE_OPT OFF CACHE BOOL "" FORCE)
set(ENABLE_HLSL OFF CACHE BOOL "" FORCE)
set(ENABLE_GLSLANG_BINARIES OFF CACHE BOOL "" FORCE)
set(ENABLE_SPVREMAPPER OFF CACHE BOOL "" FORCE)
set(GLSLANG_TESTS OFF CACHE BOOL "" FORCE)
set(GLSLANG_ENABLE_INSTALL OFF CACHE BOOL "" FORCE)
set(BUILD_EXTERNAL OFF CACHE BOOL "" FORCE)
set(BUILD_SHARED_LIBS OFF CACHE BOOL "" FORCE)

FetchContent_Declare(
    glslang
    GIT_REPOSITORY https://github.com/KhronosGroup/glslang.git
    GIT_TAG        15.0.0
    GIT_SHALLOW    TRUE
)
FetchContent_MakeAvailable(glslang)

# ---- SPIRV-Cross：反射 + HLSL/GLSL/MSL 后端 ----
set(SPIRV_CROSS_CLI OFF CACHE BOOL "" FORCE)
set(SPIRV_CROSS_ENABLE_TESTS OFF CACHE BOOL "" FORCE)
set(SPIRV_CROSS_SHARED OFF CACHE BOOL "" FORCE)
set(SPIRV_CROSS_STATIC ON CACHE BOOL "" FORCE)
set(SPIRV_CROSS_ENABLE_C_API OFF CACHE BOOL "" FORCE)
set(SPIRV_CROSS_ENABLE_CPP OFF CACHE BOOL "" FORCE)
set(SPIRV_CROSS_ENABLE_UTIL OFF CACHE BOOL "" FORCE)
set(SPIRV_CROSS_ENABLE_MSL OFF CACHE BOOL "" FORCE)
set(SPIRV_CROSS_ENABLE_GLSL ON CACHE BOOL "" FORCE)
set(SPIRV_CROSS_ENABLE_HLSL ON CACHE BOOL "" FORCE)
set(SPIRV_CROSS_ENABLE_REFLECT OFF CACHE BOOL "" FORCE)
set(SPIRV_CROSS_SKIP_INSTALL ON CACHE BOOL "" FORCE)

FetchContent_Declare(
    spirv_cross
    GIT_REPOSITORY https://github.com/KhronosGroup/SPIRV-Cross.git
    GIT_TAG        vulkan-sdk-1.4.304.0
    GIT_SHALLOW    TRUE
)
FetchContent_MakeAvailable(spirv_cross)

add_library(pot_gfx SHARED
    src/compiler.cpp
    src/compiler.h
    src/reflect.cpp
    src/plugin.cpp
    src/backend.h
    src/backend_d3d11.cpp
    src/cache.cpp
    src/cache.h
)
# GLES3 后端：WebGL 版不走 CMake，由 sync-webgl.js 拷进 com.pot.core/Plugins/WebGL 由 Unity 的 emscripten 编译；
# Android 版见上方 if(ANDROID) 分支
target_include_directories(pot_gfx PRIVATE ${UNITY_PLUGIN_API} ${glslang_SOURCE_DIR} ${spirv_cross_SOURCE_DIR})
target_link_libraries(pot_gfx PRIVATE glslang glslang-default-resource-limits SPIRV spirv-cross-core spirv-cross-glsl spirv-cross-hlsl)
if(WIN32)
    target_link_libraries(pot_gfx PRIVATE d3d11 d3dcompiler dxguid)
    target_compile_definitions(pot_gfx PRIVATE NOMINMAX WIN32_LEAN_AND_MEAN _CRT_SECURE_NO_WARNINGS)
endif()
if(MSVC)
    target_compile_options(pot_gfx PRIVATE /utf-8 /W3)
endif()

add_executable(pot_shaderc src/shaderc.cpp src/compiler.cpp src/reflect.cpp)
target_include_directories(pot_shaderc PRIVATE ${glslang_SOURCE_DIR} ${spirv_cross_SOURCE_DIR})
target_link_libraries(pot_shaderc PRIVATE glslang glslang-default-resource-limits SPIRV spirv-cross-core spirv-cross-glsl spirv-cross-hlsl)
if(WIN32)
    target_link_libraries(pot_shaderc PRIVATE d3dcompiler)
endif()
if(MSVC)
    target_compile_options(pot_shaderc PRIVATE /utf-8)
endif()
