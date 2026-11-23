// pot_gfx：Unity 原生渲染插件入口与 C 导出（C# 侧 Pot.PotGfx 调用）。
//
// 两种构建：
// - 桌面（CMake）：带 glslang/SPIRV-Cross 编译器和编译缓存（D3D11 需要先转 HLSL）；
// - WebGL（__EMSCRIPTEN__，由 Unity 的 emscripten 编译 Plugins/WebGL 下的源码）与 Android（NDK + CMake 精简构建）：
//   不带编译器，GLES3 后端直接把游戏源码交给驱动编译。WebGL 没有动态库加载，C# 先调 PotGfx_RegisterPlugin 注册渲染插件。
// Unity 头文件用引号：WebGL 版的头文件和源码在同一目录（桌面版由 CMake 按 UNITY_PLUGIN_API 提供）。
#include "IUnityGraphics.h"
#include "IUnityInterface.h"

#include <cstring>
#include <mutex>
#include <string>
#include <unordered_map>
#include <vector>

#include "backend.h"
#include "compiler.h"

#if !defined(__EMSCRIPTEN__) && !defined(__ANDROID__)
#define POT_GFX_COMPILER 1
#include "cache.h"
#endif

using namespace pot;

static IUnityInterfaces* g_unity = nullptr;
static IUnityGraphics* g_graphics = nullptr;
static Backend* g_backend = nullptr;
static std::string g_info;
static int g_nextId = 1;

// 帧数据：主线程 Submit 拷贝进来并分配票号，渲染线程按票号取走。
// 不用固定环形槽：同一帧可能有大量提交（例如加载时连续烘焙几十张贴图），多线程渲染下渲染线程滞后会覆盖未消费的槽。
static std::unordered_map<int, std::vector<uint8_t>> g_slots;
static int g_slotNext = 1;
static std::mutex g_slotMutex;

static void UNITY_INTERFACE_API OnDeviceEvent(UnityGfxDeviceEventType type) {
    if (type == kUnityGfxDeviceEventInitialize) {
        if (g_backend || !g_graphics) return;
        UnityGfxRenderer r = g_graphics->GetRenderer();
#if defined(_WIN32)
        if (r == kUnityGfxRendererD3D11) g_backend = CreateBackendD3D11(g_unity);
#endif
#if defined(__EMSCRIPTEN__) || defined(__ANDROID__)
        if (r == kUnityGfxRendererOpenGLES30) g_backend = CreateBackendGLES3();
#endif
        (void)r;
    } else if (type == kUnityGfxDeviceEventShutdown) {
        if (g_backend) {
            g_backend->Shutdown();
            delete g_backend;
            g_backend = nullptr;
        }
    }
}

extern "C" void UNITY_INTERFACE_EXPORT UNITY_INTERFACE_API UnityPluginLoad(IUnityInterfaces* unityInterfaces) {
    g_unity = unityInterfaces;
    g_graphics = unityInterfaces->Get<IUnityGraphics>();
    g_graphics->RegisterDeviceEventCallback(OnDeviceEvent);
    OnDeviceEvent(kUnityGfxDeviceEventInitialize);
}

extern "C" void UNITY_INTERFACE_EXPORT UNITY_INTERFACE_API UnityPluginUnload() {
    if (g_graphics) g_graphics->UnregisterDeviceEventCallback(OnDeviceEvent);
    OnDeviceEvent(kUnityGfxDeviceEventShutdown);
}

#if defined(__EMSCRIPTEN__)
typedef void(UNITY_INTERFACE_API* PluginLoadFunc)(IUnityInterfaces* unityInterfaces);
typedef void(UNITY_INTERFACE_API* PluginUnloadFunc)();
// Unity WebGL 运行库导出的符号（不带 V5 后缀）
extern "C" void UnityRegisterRenderingPlugin(PluginLoadFunc loadPlugin, PluginUnloadFunc unloadPlugin);

// WebGL：静态链接的插件要自己注册，Unity 随即回调 UnityPluginLoad。重复调用无副作用。
extern "C" void UNITY_INTERFACE_EXPORT UNITY_INTERFACE_API PotGfx_RegisterPlugin() {
    static bool done = false;
    if (done) return;
    done = true;
    UnityRegisterRenderingPlugin(UnityPluginLoad, UnityPluginUnload);
}
#endif

// eventId 0：data 为 Submit 返回的槽号，帧数据见 backend.h
// eventId 1：帧数据前多一段目标：int64 原生贴图句柄, int32 宽, int32 高（后端据此自行绑定输出）
static void UNITY_INTERFACE_API OnRenderEvent(int eventId, void* data) {
    if (!g_backend) return;
    int slot = (int)(intptr_t)data;
    std::vector<uint8_t> frame;
    {
        std::lock_guard<std::mutex> lock(g_slotMutex);
        auto it = g_slots.find(slot);
        if (it == g_slots.end()) return;
        frame.swap(it->second);
        g_slots.erase(it);
    }
    size_t skip = 0;
    if (eventId == 1) {
        pot::Reader r(frame.data(), frame.data() + frame.size());
        int64_t tex = r.i64();
        int w = r.i32(), h = r.i32();
        if (!r.ok) return;
        g_backend->SetNextTarget(tex, w, h);
        skip = 16;
    }
    if (frame.size() > skip) g_backend->Render(frame.data() + skip, frame.size() - skip);
}

// GLES3：源码直接交给驱动（不经过 glslang/SPIRV-Cross），后端负责反射
static bool Passthrough() { return g_backend && g_backend->ShaderTarget() == Target::GLSLES300; }

// ---------------- C 导出 ----------------

extern "C" {

// 当前后端名（"d3d11" / "gles3"）；不支持的图形 API 返回空串
UNITY_INTERFACE_EXPORT const char* UNITY_INTERFACE_API PotGfx_Backend() {
    return g_backend ? g_backend->Name() : "";
}

// 编译程序。成功返回 id（>0），PotGfx_Info 为反射 JSON；失败返回 0，PotGfx_Info 为错误信息。
// 设置了缓存目录时先按源码 hash 查缓存，命中则跳过全部编译步骤。
UNITY_INTERFACE_EXPORT int UNITY_INTERFACE_API PotGfx_Create(const char* vs, const char* fs) {
    if (!g_backend) {
        g_info = "当前图形 API 不支持运行时着色器（pot_gfx 目前支持 D3D11、GLES3/WebGL2）";
        return 0;
    }
    std::string vsrc = vs ? vs : "", fsrc = fs ? fs : "";
    CompiledProgram p;
    std::string err;
    int id = g_nextId++;
    if (Passthrough()) {
        p.vsCode = vsrc;
        p.fsCode = fsrc;
        if (!g_backend->CreateProgram(id, p, err)) {
            g_info = err;
            return 0;
        }
        g_info = ReflectionJson(p);
        return id;
    }
#if POT_GFX_COMPILER
    std::string key;
    bool hit = false;
    if (CacheEnabled()) {
        key = CacheKey(g_backend->Name(), vsrc, fsrc);
        hit = CacheLoad(key, p);
    }
    if (hit && !g_backend->CreateProgram(id, p, err)) {
        // 缓存内容不可用（驱动拒绝等）：退回完整编译
        hit = false;
        p = CompiledProgram();
        err.clear();
    }
    if (!hit) {
        if (!CompileProgram(vsrc, fsrc, g_backend->ShaderTarget(), p)) {
            g_info = p.error;
            return 0;
        }
        if (!g_backend->CreateProgram(id, p, err)) {
            g_info = err + "\n----- 生成的顶点着色器 -----\n" + p.vsCode + "\n----- 生成的片元着色器 -----\n" + p.fsCode;
            return 0;
        }
        if (!key.empty()) CacheStore(key, p);
    }
    CacheCount(hit);
    g_info = ReflectionJson(p);
    return id;
#else
    g_info = "pot_gfx 未包含着色器编译器";
    return 0;
#endif
}

// 设置编译缓存目录（UTF-8）；空串关闭。WebGL 版没有缓存（驱动直接编译源码）
UNITY_INTERFACE_EXPORT void UNITY_INTERFACE_API PotGfx_SetCacheDir(const char* dir) {
#if POT_GFX_COMPILER
    CacheSetDir(dir ? dir : "");
#else
    (void)dir;
#endif
}

// 本进程缓存命中 / 未命中次数
UNITY_INTERFACE_EXPORT int UNITY_INTERFACE_API PotGfx_CacheHits() {
#if POT_GFX_COMPILER
    int h, m;
    CacheStats(h, m);
    return h;
#else
    return 0;
#endif
}

UNITY_INTERFACE_EXPORT int UNITY_INTERFACE_API PotGfx_CacheMisses() {
#if POT_GFX_COMPILER
    int h, m;
    CacheStats(h, m);
    return m;
#else
    return 0;
#endif
}

UNITY_INTERFACE_EXPORT const char* UNITY_INTERFACE_API PotGfx_Info() {
    return g_info.c_str();
}

// 只做转译（调试用）：返回目标语言源码，失败返回错误。GLES3 不转译，原样返回
UNITY_INTERFACE_EXPORT const char* UNITY_INTERFACE_API PotGfx_Translate(const char* vs, const char* fs) {
#if POT_GFX_COMPILER
    if (!Passthrough()) {
        CompiledProgram p;
        Target t = g_backend ? g_backend->ShaderTarget() : Target::HLSL50;
        if (!CompileProgram(vs ? vs : "", fs ? fs : "", t, p)) g_info = p.error;
        else g_info = "----- vertex -----\n" + p.vsCode + "\n----- fragment -----\n" + p.fsCode;
        return g_info.c_str();
    }
#endif
    g_info = std::string("----- vertex -----\n") + (vs ? vs : "") + "\n----- fragment -----\n" + (fs ? fs : "");
    return g_info.c_str();
}

UNITY_INTERFACE_EXPORT void UNITY_INTERFACE_API PotGfx_Destroy(int id) {
    if (g_backend) g_backend->DestroyProgram(id);
}

// 提交一帧绘制数据，返回槽号（作为 IssuePluginEventAndData 的 data）
UNITY_INTERFACE_EXPORT int UNITY_INTERFACE_API PotGfx_Submit(const uint8_t* data, int len) {
    std::lock_guard<std::mutex> lock(g_slotMutex);
    int slot = g_slotNext;
    g_slotNext = g_slotNext >= 0x3fffffff ? 1 : g_slotNext + 1;
    // 渲染线程从未消费的数据（例如命令缓冲被丢弃）不会无限堆积
    if (g_slots.size() > 4096) g_slots.clear();
    g_slots[slot].assign(data, data + (len > 0 ? len : 0));
    return slot;
}

UNITY_INTERFACE_EXPORT UnityRenderingEventAndData UNITY_INTERFACE_API PotGfx_RenderEvent() {
    return OnRenderEvent;
}

}  // extern "C"
