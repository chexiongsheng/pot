// pot_gfx 后端接口：每种图形 API 一个实现（当前 D3D11；GLES3/Metal/Vulkan 待补）
#pragma once
#include <cstdint>
#include <cstring>
#include <string>

#include "compiler.h"

namespace pot {

// 每帧绘制数据（C# PotGfx 打包，小端，4 字节对齐）：
//   int32 drawCount
//   每个 draw：
//     int32 program, int32 flags
//     int64 vertexBuffer, int64 indexBuffer       （Unity Mesh 的原生缓冲指针）
//     int32 stride, int32 index32, int32 indexStart, int32 indexCount, int32 baseVertex
//     int32 attrOffset[5], int32 attrFormat[5]    （0 位置 1 法线 2 UV 3 颜色 4 切线；格式 0 表示缺省）
//     int32 texCount, 每个：int32 slot, int32 sampler, int64 nativeTexture
//     int32 vsBytes, vsBytes 字节（统一块数据，按 4 对齐）
//     int32 fsBytes, fsBytes 字节
enum AttrFormat { AF_None = 0, AF_Float2 = 1, AF_Float3 = 2, AF_Float4 = 3, AF_UNorm8x4 = 4, AF_Half2 = 5, AF_Half4 = 6 };
constexpr int kAttrCount = 5;

// flags 位
constexpr uint32_t F_CullMask = 3;         // 0 背面 1 正面 2 不剔除
constexpr uint32_t F_DepthWrite = 1u << 2;
constexpr uint32_t F_BlendShift = 3;       // 2 位：0 不混合 1 alpha 2 叠加 3 预乘
constexpr uint32_t F_FrontCCW = 1u << 5;
constexpr uint32_t F_ReversedZ = 1u << 6;
constexpr uint32_t F_NoDepthTest = 1u << 7;

// 采样器编码：bit0 clamp，bit1-2 过滤（0 点 1 双线性 2 三线性），bit3 各向异性
class Backend {
public:
    virtual ~Backend() = default;
    virtual const char* Name() const = 0;
    virtual Target ShaderTarget() const = 0;
    // 主线程调用；成功后 id 可在 Render 中使用。
    // p.vsBin/fsBin 非空时直接用字节码创建（缓存命中）；否则从 vsCode/fsCode 编译并把字节码写回 p
    virtual bool CreateProgram(int id, CompiledProgram& p, std::string& err) = 0;
    // 主线程调用；真正释放推迟到渲染线程
    virtual void DestroyProgram(int id) = 0;
    // 渲染线程调用
    virtual void Render(const uint8_t* data, size_t len) = 0;
    virtual void Shutdown() = 0;
};

Backend* CreateBackendD3D11(void* unityInterfaces);

struct Reader {
    const uint8_t* p;
    const uint8_t* end;
    bool ok = true;
    int32_t i32() {
        if (p + 4 > end) { ok = false; return 0; }
        int32_t v;
        memcpy(&v, p, 4);
        p += 4;
        return v;
    }
    int64_t i64() {
        if (p + 8 > end) { ok = false; return 0; }
        int64_t v;
        memcpy(&v, p, 8);
        p += 8;
        return v;
    }
    const uint8_t* bytes(int n) {
        int padded = (n + 3) & ~3;
        if (n < 0 || p + padded > end) { ok = false; return nullptr; }
        const uint8_t* r = p;
        p += padded;
        return r;
    }
};

}  // namespace pot
