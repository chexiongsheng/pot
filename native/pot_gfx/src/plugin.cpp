// pot_gfx：Unity 原生渲染插件入口与 C 导出（C# 侧 Pot.PotGfx 调用）
#include <IUnityGraphics.h>
#include <IUnityInterface.h>

#include <cstring>
#include <mutex>
#include <string>
#include <vector>

#include "backend.h"
#include "compiler.h"

using namespace pot;

static IUnityInterfaces* g_unity = nullptr;
static IUnityGraphics* g_graphics = nullptr;
static Backend* g_backend = nullptr;
static std::string g_info;
static int g_nextId = 1;

// 帧数据环形槽：主线程 Submit 拷贝进来，渲染线程按槽号读取
static constexpr int kSlots = 16;
static std::vector<uint8_t> g_slots[kSlots];
static int g_slotNext = 0;
static std::mutex g_slotMutex;

static void UNITY_INTERFACE_API OnDeviceEvent(UnityGfxDeviceEventType type) {
    if (type == kUnityGfxDeviceEventInitialize) {
        if (g_backend) return;
        UnityGfxRenderer r = g_graphics->GetRenderer();
#if defined(_WIN32)
        if (r == kUnityGfxRendererD3D11) g_backend = CreateBackendD3D11(g_unity);
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

static void UNITY_INTERFACE_API OnRenderEvent(int eventId, void* data) {
    (void)eventId;
    if (!g_backend) return;
    int slot = (int)(intptr_t)data;
    if (slot < 0 || slot >= kSlots) return;
    std::vector<uint8_t> frame;
    {
        std::lock_guard<std::mutex> lock(g_slotMutex);
        frame.swap(g_slots[slot]);
    }
    if (!frame.empty()) g_backend->Render(frame.data(), frame.size());
}

// ---------------- C 导出 ----------------

extern "C" {

// 当前后端名（"d3d11"）；不支持的图形 API 返回空串
UNITY_INTERFACE_EXPORT const char* UNITY_INTERFACE_API PotGfx_Backend() {
    return g_backend ? g_backend->Name() : "";
}

// 编译程序。成功返回 id（>0），PotGfx_Info 为反射 JSON；失败返回 0，PotGfx_Info 为错误信息
UNITY_INTERFACE_EXPORT int UNITY_INTERFACE_API PotGfx_Create(const char* vs, const char* fs) {
    if (!g_backend) {
        g_info = "当前图形 API 不支持运行时着色器（pot_gfx 目前支持 D3D11）";
        return 0;
    }
    CompiledProgram p;
    if (!CompileProgram(vs ? vs : "", fs ? fs : "", g_backend->ShaderTarget(), p)) {
        g_info = p.error;
        return 0;
    }
    int id = g_nextId++;
    std::string err;
    if (!g_backend->CreateProgram(id, p, err)) {
        g_info = err + "\n----- 生成的顶点着色器 -----\n" + p.vsCode + "\n----- 生成的片元着色器 -----\n" + p.fsCode;
        return 0;
    }
    g_info = ReflectionJson(p);
    return id;
}

UNITY_INTERFACE_EXPORT const char* UNITY_INTERFACE_API PotGfx_Info() {
    return g_info.c_str();
}

// 只做转译（调试用）：返回目标语言源码，失败返回错误
UNITY_INTERFACE_EXPORT const char* UNITY_INTERFACE_API PotGfx_Translate(const char* vs, const char* fs) {
    CompiledProgram p;
    Target t = g_backend ? g_backend->ShaderTarget() : Target::HLSL50;
    if (!CompileProgram(vs ? vs : "", fs ? fs : "", t, p)) g_info = p.error;
    else g_info = "----- vertex -----\n" + p.vsCode + "\n----- fragment -----\n" + p.fsCode;
    return g_info.c_str();
}

UNITY_INTERFACE_EXPORT void UNITY_INTERFACE_API PotGfx_Destroy(int id) {
    if (g_backend) g_backend->DestroyProgram(id);
}

// 提交一帧绘制数据，返回槽号（作为 IssuePluginEventAndData 的 data）
UNITY_INTERFACE_EXPORT int UNITY_INTERFACE_API PotGfx_Submit(const uint8_t* data, int len) {
    std::lock_guard<std::mutex> lock(g_slotMutex);
    int slot = g_slotNext;
    g_slotNext = (g_slotNext + 1) % kSlots;
    g_slots[slot].assign(data, data + (len > 0 ? len : 0));
    return slot;
}

UNITY_INTERFACE_EXPORT UnityRenderingEventAndData UNITY_INTERFACE_API PotGfx_RenderEvent() {
    return OnRenderEvent;
}

}  // extern "C"
