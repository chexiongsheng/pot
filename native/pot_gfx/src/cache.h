// pot_gfx 着色器编译缓存：按（缓存格式版本 + 后端 + 两段源码）的内容 hash 把编译产物存盘，
// 再次创建同样的程序时跳过 glslang / SPIRV-Cross / D3DCompile，直接用缓存的字节码和反射信息。
// 只是加速手段：读失败、格式不对一律当作未命中重新编译，写失败忽略。
#pragma once
#include <string>

#include "compiler.h"

namespace pot {

// 缓存目录（UTF-8）。空串表示关闭缓存
void CacheSetDir(const std::string& dir);
bool CacheEnabled();
std::string CacheKey(const char* backend, const std::string& vs, const std::string& fs);
// 命中时填好 p.vs / p.fs 反射与 p.vsBin / p.fsBin
bool CacheLoad(const std::string& key, CompiledProgram& p);
void CacheStore(const std::string& key, const CompiledProgram& p);
// 本进程内的命中 / 未命中次数
void CacheStats(int& hits, int& misses);
void CacheCount(bool hit);

}  // namespace pot
