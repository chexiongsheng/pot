// pot_gfx 编译器：GLSL ES（按 310 es 解析，语法与 300 es 一致）→ SPIR-V → 目标着色器源码 + 反射
#pragma once
#include <cstdint>
#include <string>
#include <utility>
#include <vector>

namespace pot {

enum class Target { HLSL50, GLSLES300 };

// 统一块（loose uniform 汇成的默认块）里的一个成员
struct UniformMember {
    std::string name;
    int offset = 0;
    char base = 'f';     // f 浮点 / i 整数 / u 无符号
    int vecsize = 1;     // 行数（向量分量数）
    int columns = 1;     // 矩阵列数，非矩阵为 1
    int arraySize = 0;   // 0 表示不是数组
    int arrayStride = 0;
    int matrixStride = 0;
};

struct StageReflection {
    int blockSize = 0;     // 0 表示该阶段没有统一块
    int blockBinding = 0;
    std::vector<UniformMember> members;
    std::vector<std::pair<std::string, int>> textures;  // 名字, 绑定槽
};

struct CompiledProgram {
    std::string error;
    std::string vsCode, fsCode;           // 目标语言源码（调试用，也供后端编译）
    std::vector<uint32_t> vsSpirv, fsSpirv;
    StageReflection vs, fs;
    // 后端原生字节码（D3D11 为 DXBC）。非空时后端直接创建，跳过编译；后端编译后也写回这里供缓存
    std::vector<uint8_t> vsBin, fsBin;
    bool cached = false;
};

bool CompileProgram(const std::string& vs, const std::string& fs, Target target, CompiledProgram& out);

// 反射转 JSON（交给 C#/JS）
std::string ReflectionJson(const CompiledProgram& p);
std::string JsonEscape(const std::string& s);

}  // namespace pot
