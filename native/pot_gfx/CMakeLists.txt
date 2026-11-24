cmake_minimum_required(VERSION 3.20)
# macOS：默认出 Universal（Apple Silicon 编辑器与 OSXUniversal 播放器都能加载）；10.15 起才有 std::filesystem。
# project() 之前 APPLE 尚未定义，用宿主判断；交叉编译（Android 工具链）时不设
if(CMAKE_HOST_APPLE AND NOT CMAKE_TOOLCHAIN_FILE)
    set(CMAKE_OSX_ARCHITECTURES "arm64;x86_64" CACHE STRING "")
    set(CMAKE_OSX_DEPLOYMENT_TARGET "10.15" CACHE STRING "")
endif()
project(pot_gfx CXX C)
if(APPLE AND NOT ANDROID)
    enable_language(OBJCXX)
endif()

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

# ---- SPIRV-Cross：反射 + HLSL/GLSL/MSL 后端（MSL 供 macOS Metal） ----
set(SPIRV_CROSS_CLI OFF CACHE BOOL "" FORCE)
set(SPIRV_CROSS_ENABLE_TESTS OFF CACHE BOOL "" FORCE)
set(SPIRV_CROSS_SHARED OFF CACHE BOOL "" FORCE)
set(SPIRV_CROSS_STATIC ON CACHE BOOL "" FORCE)
set(SPIRV_CROSS_ENABLE_C_API OFF CACHE BOOL "" FORCE)
set(SPIRV_CROSS_ENABLE_CPP OFF CACHE BOOL "" FORCE)
set(SPIRV_CROSS_ENABLE_UTIL OFF CACHE BOOL "" FORCE)
set(SPIRV_CROSS_ENABLE_MSL ON CACHE BOOL "" FORCE)
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

if(APPLE)
    set(POT_GFX_LIB_TYPE MODULE)
else()
    set(POT_GFX_LIB_TYPE SHARED)
endif()
add_library(pot_gfx ${POT_GFX_LIB_TYPE}
    src/compiler.cpp
    src/compiler.h
    src/reflect.cpp
    src/plugin.cpp
    src/backend.h
    src/cache.cpp
    src/cache.h
)
if(APPLE)
    # macOS：Unity 原生插件是 .bundle（MODULE），Metal 后端是 Objective-C++（Unity 的 Metal 接口头文件要求 ObjC）
    set_target_properties(pot_gfx PROPERTIES BUNDLE TRUE BUNDLE_EXTENSION bundle)
    target_sources(pot_gfx PRIVATE src/backend_metal.mm)
    set_source_files_properties(src/backend_metal.mm PROPERTIES COMPILE_FLAGS "-fobjc-arc")
    target_link_libraries(pot_gfx PRIVATE "-framework Foundation" "-framework Metal")
    target_compile_options(pot_gfx PRIVATE -fvisibility=hidden)
endif()
# GLES3 后端：WebGL 版不走 CMake，由 sync-webgl.js 拷进 com.pot.core/Plugins/WebGL 由 Unity 的 emscripten 编译；
# Android 版见上方 if(ANDROID) 分支
target_include_directories(pot_gfx PRIVATE ${UNITY_PLUGIN_API} ${glslang_SOURCE_DIR} ${spirv_cross_SOURCE_DIR})
target_link_libraries(pot_gfx PRIVATE glslang glslang-default-resource-limits SPIRV spirv-cross-core spirv-cross-glsl spirv-cross-hlsl spirv-cross-msl)
if(WIN32)
    target_sources(pot_gfx PRIVATE src/backend_d3d11.cpp)
    target_link_libraries(pot_gfx PRIVATE d3d11 d3dcompiler dxguid)
    target_compile_definitions(pot_gfx PRIVATE NOMINMAX WIN32_LEAN_AND_MEAN _CRT_SECURE_NO_WARNINGS)
endif()
if(MSVC)
    target_compile_options(pot_gfx PRIVATE /utf-8 /W3)
endif()

add_executable(pot_shaderc src/shaderc.cpp src/compiler.cpp src/reflect.cpp)
target_include_directories(pot_shaderc PRIVATE ${glslang_SOURCE_DIR} ${spirv_cross_SOURCE_DIR})
target_link_libraries(pot_shaderc PRIVATE glslang glslang-default-resource-limits SPIRV spirv-cross-core spirv-cross-glsl spirv-cross-hlsl spirv-cross-msl)
if(WIN32)
    target_link_libraries(pot_shaderc PRIVATE d3dcompiler)
endif()
if(MSVC)
    target_compile_options(pot_shaderc PRIVATE /utf-8)
endif()
