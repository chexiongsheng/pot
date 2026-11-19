cmake_minimum_required(VERSION 3.20)
project(pot_gfx CXX C)

# pot_gfx：Runner 运行时着色器能力（GLSL ES 3.00 → SPIR-V → 目标平台着色器 → 驱动编译 → 原生绘制）
# 依赖源码放在 third_party/（不入库，见 native/pot_gfx/README.md 的固定版本）

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_POSITION_INDEPENDENT_CODE ON)
set(CMAKE_MSVC_RUNTIME_LIBRARY "MultiThreaded$<$<CONFIG:Debug>:Debug>")

set(POT_ROOT ${CMAKE_CURRENT_SOURCE_DIR}/../..)
set(UNITY_PLUGIN_API "" CACHE PATH "Unity Editor/Data/PluginAPI 目录")

# ---- glslang：只要 GLSL 前端 + SPIR-V 生成 ----
set(ENABLE_OPT OFF CACHE BOOL "" FORCE)
set(ENABLE_HLSL OFF CACHE BOOL "" FORCE)
set(ENABLE_GLSLANG_BINARIES OFF CACHE BOOL "" FORCE)
set(ENABLE_SPVREMAPPER OFF CACHE BOOL "" FORCE)
set(GLSLANG_TESTS OFF CACHE BOOL "" FORCE)
set(GLSLANG_ENABLE_INSTALL OFF CACHE BOOL "" FORCE)
set(BUILD_EXTERNAL OFF CACHE BOOL "" FORCE)
set(BUILD_SHARED_LIBS OFF CACHE BOOL "" FORCE)
add_subdirectory(${POT_ROOT}/third_party/glslang ${CMAKE_BINARY_DIR}/glslang EXCLUDE_FROM_ALL)

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
add_subdirectory(${POT_ROOT}/third_party/SPIRV-Cross ${CMAKE_BINARY_DIR}/spirv-cross EXCLUDE_FROM_ALL)

add_library(pot_gfx SHARED
    src/compiler.cpp
    src/compiler.h
    src/plugin.cpp
    src/backend.h
    src/backend_d3d11.cpp
    src/cache.cpp
    src/cache.h
)
target_include_directories(pot_gfx PRIVATE ${UNITY_PLUGIN_API} ${POT_ROOT}/third_party/glslang ${POT_ROOT}/third_party/SPIRV-Cross)
target_link_libraries(pot_gfx PRIVATE glslang glslang-default-resource-limits SPIRV spirv-cross-core spirv-cross-glsl spirv-cross-hlsl)
if(WIN32)
    target_link_libraries(pot_gfx PRIVATE d3d11 d3dcompiler dxguid)
    target_compile_definitions(pot_gfx PRIVATE NOMINMAX WIN32_LEAN_AND_MEAN _CRT_SECURE_NO_WARNINGS)
endif()
if(MSVC)
    target_compile_options(pot_gfx PRIVATE /utf-8 /W3)
endif()

add_executable(pot_shaderc src/shaderc.cpp src/compiler.cpp)
target_include_directories(pot_shaderc PRIVATE ${POT_ROOT}/third_party/glslang ${POT_ROOT}/third_party/SPIRV-Cross)
target_link_libraries(pot_shaderc PRIVATE glslang glslang-default-resource-limits SPIRV spirv-cross-core spirv-cross-glsl spirv-cross-hlsl)
if(WIN32)
    target_link_libraries(pot_shaderc PRIVATE d3dcompiler)
endif()
if(MSVC)
    target_compile_options(pot_shaderc PRIVATE /utf-8)
endif()
