// pot_gfx Metal 后端（macOS）：MSL（SPIRV-Cross 生成）→ newLibraryWithSource → 在 Unity 当前的渲染编码器上绘制。
//
// 与 D3D11 后端保持同一套约定（C# 按 graphicsUVStartsAtTop / usesReversedZBuffer 处理，这里不再补偿）：
// - 裁剪空间 y 朝上、深度 [0,1]、渲染到贴图时 C# 翻转投影并置 F_FrontCCW；Metal 默认正面为顺时针，与 D3D 一致；
// - gl_FragCoord 原点在左上；
// - 资源索引：统一块 buffer(0)（顶点、片元各自一份），贴图与采样器同号（SPIRV-Cross enable_decoration_binding）；
//   顶点缓冲放在 28-30，避开统一块；
// - 采样器 bit4（sRGB 视图）忽略：Unity 在 Metal 上按色彩空间直接用 sRGB / 非 sRGB 像素格式建贴图，采样自动解码。
//
// 管线状态（MTLRenderPipelineState）在 Metal 里同时绑定顶点布局、渲染目标像素格式、采样数与混合方式，
// 按（顶点布局、当前渲染通道格式、混合）缓存在每个程序上。
//
// 编码器：默认用 Unity 当前的 MTLRenderCommandEncoder；SetNextTarget 指定了输出贴图时结束 Unity 的编码器、
// 自建一个通道画完再结束（Unity 之后会自己重新开始）。Unity 当前没有渲染编码器时，按它最近的通道描述（改为保留内容）自建。
#import <Foundation/Foundation.h>
#import <Metal/Metal.h>

#include "IUnityGraphics.h"
#include "IUnityGraphicsMetal.h"
#include "IUnityInterface.h"

#include <cstring>
#include <mutex>
#include <regex>
#include <string>
#include <unordered_map>
#include <vector>

#include "backend.h"

namespace pot {

constexpr int kBufMesh = 28, kBufDefault = 29, kBufInstance = 30;
constexpr int kMaxTex = 16;
constexpr int kMaxColor = 8;
constexpr int kDefaultStride = kAttrCount * 16;

struct ProgramMTL {
    id<MTLFunction> vs = nil;
    id<MTLFunction> fs = nil;
    int vsSize = 0, fsSize = 0, vsSlot = 0, fsSlot = 0;
    uint32_t attrs = 0;       // 顶点函数实际用到的 attribute（位）
    uint32_t shadowMask = 0;  // 以 depth2d / depthcube 声明（sample_compare）的贴图槽，需要比较采样器
    std::unordered_map<std::string, id<MTLRenderPipelineState>> pipelines;  // 失败也缓存 nil，避免每帧重试
};

// 当前渲染通道的附件格式（决定管线状态）
struct PassFormats {
    MTLPixelFormat color[kMaxColor];
    MTLPixelFormat depth = MTLPixelFormatInvalid;
    MTLPixelFormat stencil = MTLPixelFormatInvalid;
    NSUInteger samples = 1;
    PassFormats() {
        for (auto& c : color) c = MTLPixelFormatInvalid;
    }
    std::string Key() const {
        std::string k;
        for (auto c : color) k += std::to_string((int)c) + ",";
        k += std::to_string((int)depth) + "," + std::to_string((int)stencil) + "," + std::to_string((int)samples);
        return k;
    }
};

static PassFormats FormatsOf(MTLRenderPassDescriptor* rp) {
    PassFormats f;
    if (!rp) return f;
    for (int i = 0; i < kMaxColor; i++) {
        id<MTLTexture> t = rp.colorAttachments[i].texture;
        if (!t) continue;
        f.color[i] = t.pixelFormat;
        f.samples = t.sampleCount;
    }
    id<MTLTexture> d = rp.depthAttachment.texture;
    if (d) {
        f.depth = d.pixelFormat;
        f.samples = d.sampleCount;
    }
    id<MTLTexture> s = rp.stencilAttachment.texture;
    if (s) f.stencil = s.pixelFormat;
    if (f.samples == 0) f.samples = 1;
    return f;
}

// MSL 里以 depth2d / depthcube / depth2d_array 声明的贴图（sampler2DShadow 等）→ 槽位掩码
static uint32_t ShadowSlots(const std::string& msl) {
    static const std::regex re(R"(depth(?:2d|cube|2d_array|cube_array)<float>\s+\w+\s*\[\[texture\((\d+)\)\]\])");
    uint32_t mask = 0;
    for (std::sregex_iterator it(msl.begin(), msl.end(), re), end; it != end; ++it) {
        int slot = std::stoi((*it)[1].str());
        if (slot >= 0 && slot < 32) mask |= 1u << slot;
    }
    return mask;
}

class BackendMetal : public Backend {
public:
    BackendMetal(IUnityGraphicsMetalV1* unity, id<MTLDevice> device) : unity_(unity), device_(device) {
        // 缺省属性：常量步进，所有顶点读同一个值（同 D3D11 后端）
        // 0 位置 1 法线 2 UV 3 颜色 4 切线；5 以后的自定义属性缺省为 0
        float dummy[kAttrCount * 4] = {0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 0, 0, 1};
        dummy_ = [device_ newBufferWithBytes:dummy length:sizeof dummy options:MTLResourceStorageModeShared];
    }

    const char* Name() const override { return "metal"; }
    Target ShaderTarget() const override { return Target::MSL21; }

    bool CreateProgram(int id, CompiledProgram& p, std::string& err) override {
        // vsBin / fsBin 存 MSL 源码：缓存命中时跳过 glslang 与 SPIRV-Cross，驱动编译由 Metal 自己的缓存加速
        if (p.vsBin.empty() || p.fsBin.empty()) {
            p.vsBin.assign(p.vsCode.begin(), p.vsCode.end());
            p.fsBin.assign(p.fsCode.begin(), p.fsCode.end());
        }
        std::string vsrc(p.vsBin.begin(), p.vsBin.end()), fsrc(p.fsBin.begin(), p.fsBin.end());
        ProgramMTL prog;
        @autoreleasepool {
            prog.vs = Function(vsrc, "[MSL vertex] ", err);
            if (!prog.vs) return false;
            prog.fs = Function(fsrc, "[MSL fragment] ", err);
            if (!prog.fs) return false;
            for (MTLVertexAttribute* a in prog.vs.vertexAttributes) {
                if (a.active && a.attributeIndex < (NSUInteger)kAttrCount) prog.attrs |= 1u << a.attributeIndex;
            }
        }
        prog.shadowMask = ShadowSlots(vsrc) | ShadowSlots(fsrc);
        prog.vsSize = p.vs.blockSize;
        prog.fsSize = p.fs.blockSize;
        prog.vsSlot = p.vs.blockBinding;
        prog.fsSlot = p.fs.blockBinding;
        std::lock_guard<std::mutex> lock(mutex_);
        programs_[id] = std::move(prog);
        return true;
    }

    void DestroyProgram(int id) override {
        std::lock_guard<std::mutex> lock(mutex_);
        pendingDelete_.push_back(id);
    }

    void Shutdown() override {
        std::lock_guard<std::mutex> lock(mutex_);
        programs_.clear();
        samplers_.clear();
        depths_.clear();
        dummy_ = nil;
        targetTex_ = nil;
    }

    void SetNextTarget(int64_t tex, int width, int height) override {
        (void)width;
        (void)height;
        targetTex_ = (__bridge id<MTLTexture>)(void*)(intptr_t)tex;
    }

    void Render(const uint8_t* data, size_t len) override {
        std::lock_guard<std::mutex> lock(mutex_);
        for (int id : pendingDelete_) programs_.erase(id);
        pendingDelete_.clear();
        id<MTLTexture> target = targetTex_;
        targetTex_ = nil;

        Reader r(data, data + len);
        int count = r.i32();
        if (!r.ok || count <= 0) return;

        @autoreleasepool {
            id<MTLRenderCommandEncoder> enc = nil;
            bool own = false;
            PassFormats fmt;
            if (target) {
                MTLRenderPassDescriptor* rp = [MTLRenderPassDescriptor renderPassDescriptor];
                rp.colorAttachments[0].texture = target;
                rp.colorAttachments[0].loadAction = MTLLoadActionLoad;
                rp.colorAttachments[0].storeAction = MTLStoreActionStore;
                enc = Begin(rp);
                own = true;
                fmt = FormatsOf(rp);
            } else {
                id<MTLCommandEncoder> cur = unity_->CurrentCommandEncoder();
                MTLRenderPassDescriptor* rp = unity_->CurrentRenderPassDescriptor();
                if (cur && [cur conformsToProtocol:@protocol(MTLRenderCommandEncoder)]) {
                    enc = (id<MTLRenderCommandEncoder>)cur;
                } else if (rp) {
                    // Unity 此刻没有渲染编码器：沿用它最近的通道附件，改成保留已有内容
                    MTLRenderPassDescriptor* copy = [rp copy];
                    for (int i = 0; i < kMaxColor; i++) {
                        auto* a = copy.colorAttachments[i];
                        if (!a.texture) continue;
                        a.loadAction = MTLLoadActionLoad;
                        a.storeAction = a.resolveTexture ? MTLStoreActionStoreAndMultisampleResolve : MTLStoreActionStore;
                    }
                    if (copy.depthAttachment.texture) {
                        copy.depthAttachment.loadAction = MTLLoadActionLoad;
                        copy.depthAttachment.storeAction = MTLStoreActionStore;
                    }
                    if (copy.stencilAttachment.texture) {
                        copy.stencilAttachment.loadAction = MTLLoadActionLoad;
                        copy.stencilAttachment.storeAction = MTLStoreActionStore;
                    }
                    enc = Begin(copy);
                    own = true;
                }
                fmt = FormatsOf(rp);
            }
            if (!enc) return;
            const bool hasDepth = fmt.depth != MTLPixelFormatInvalid;
            const std::string passKey = fmt.Key();

            for (int d = 0; d < count && r.ok; d++) {
                int program = r.i32();
                uint32_t flags = (uint32_t)r.i32();
                int64_t vbPtr = r.i64();
                int64_t ibPtr = r.i64();
                int stride = r.i32();
                int index32 = r.i32();
                int indexStart = r.i32();
                int indexCount = r.i32();
                int baseVertex = r.i32();
                int offsets[kAttrCount], formats[kAttrCount];
                for (int i = 0; i < kAttrCount; i++) offsets[i] = r.i32();
                for (int i = 0; i < kAttrCount; i++) formats[i] = r.i32();
                int64_t instPtr = r.i64();
                int instStride = r.i32();
                int instCount = r.i32();
                if (!instPtr || instStride <= 0) instCount = 0;
                if (instCount <= 0)
                    for (int i = 0; i < kAttrCount; i++)
                        if (formats[i] & AF_Instance) formats[i] = AF_None;
                int texCount = r.i32();
                struct Tex { int slot, sampler; int64_t ptr; };
                Tex texs[kMaxTex];
                int nt = 0;
                for (int i = 0; i < texCount && r.ok; i++) {
                    Tex t;
                    t.slot = r.i32();
                    t.sampler = r.i32();
                    t.ptr = r.i64();
                    if (nt < kMaxTex) texs[nt++] = t;
                }
                int vsBytes = r.i32();
                const uint8_t* vsData = r.bytes(vsBytes);
                int fsBytes = r.i32();
                const uint8_t* fsData = r.bytes(fsBytes);
                if (!r.ok) break;

                auto it = programs_.find(program);
                if (it == programs_.end() || !vbPtr || !ibPtr || indexCount <= 0) continue;
                ProgramMTL& prog = it->second;
                if (instCount > 0) {
                    bool any = false;
                    for (int i = 0; i < kAttrCount; i++) any = any || ((formats[i] & AF_Instance) && (prog.attrs & (1u << i)));
                    if (!any) instCount = 0;  // 着色器没用实例属性：照常画一份
                }
                int mode = (int)((flags >> F_BlendShift) & 3);
                id<MTLRenderPipelineState> pso = Pipeline(prog, stride, offsets, formats, instStride, fmt, passKey, mode);
                if (!pso) continue;

                id<MTLBuffer> vb = (__bridge id<MTLBuffer>)(void*)(intptr_t)vbPtr;
                id<MTLBuffer> ib = (__bridge id<MTLBuffer>)(void*)(intptr_t)ibPtr;
                [enc setRenderPipelineState:pso];
                [enc setVertexBuffer:vb offset:0 atIndex:kBufMesh];
                [enc setVertexBuffer:dummy_ offset:0 atIndex:kBufDefault];
                if (instCount > 0) [enc setVertexBuffer:(__bridge id<MTLBuffer>)(void*)(intptr_t)instPtr offset:0 atIndex:kBufInstance];
                Uniforms(enc, true, prog.vsSlot, prog.vsSize, vsData, vsBytes);
                Uniforms(enc, false, prog.fsSlot, prog.fsSize, fsData, fsBytes);
                for (int i = 0; i < nt; i++) {
                    if (texs[i].slot < 0 || texs[i].slot >= kMaxTex || !texs[i].ptr) continue;
                    id<MTLTexture> tex = (__bridge id<MTLTexture>)(void*)(intptr_t)texs[i].ptr;
                    id<MTLSamplerState> samp = Sampler(texs[i].sampler & 15, (prog.shadowMask >> texs[i].slot) & 1);
                    NSUInteger slot = (NSUInteger)texs[i].slot;
                    [enc setVertexTexture:tex atIndex:slot];
                    [enc setFragmentTexture:tex atIndex:slot];
                    [enc setVertexSamplerState:samp atIndex:slot];
                    [enc setFragmentSamplerState:samp atIndex:slot];
                }
                int cull = (int)(flags & F_CullMask);
                [enc setCullMode:cull == 0 ? MTLCullModeBack : cull == 1 ? MTLCullModeFront : MTLCullModeNone];
                [enc setFrontFacingWinding:(flags & F_FrontCCW) ? MTLWindingCounterClockwise : MTLWindingClockwise];
                [enc setTriangleFillMode:MTLTriangleFillModeFill];
                // 同 D3D11：reversed Z 时“朝相机”是深度变大，取反
                float sign = (flags & F_ReversedZ) ? -1.0f : 1.0f;
                [enc setDepthBias:sign * (float)OffsetUnits(flags) slopeScale:sign * (float)OffsetFactor(flags) clamp:0.0f];
                [enc setDepthStencilState:Depth(flags, hasDepth)];
                [enc drawIndexedPrimitives:MTLPrimitiveTypeTriangle
                                indexCount:(NSUInteger)indexCount
                                 indexType:index32 ? MTLIndexTypeUInt32 : MTLIndexTypeUInt16
                               indexBuffer:ib
                         indexBufferOffset:(NSUInteger)indexStart * (index32 ? 4u : 2u)
                             instanceCount:(NSUInteger)(instCount > 0 ? instCount : 1)
                                baseVertex:baseVertex
                              baseInstance:0];
            }
            if (own) [enc endEncoding];
        }
    }

private:
    IUnityGraphicsMetalV1* unity_;
    id<MTLDevice> device_;
    id<MTLBuffer> dummy_ = nil;
    id<MTLTexture> targetTex_ = nil;
    std::mutex mutex_;
    std::unordered_map<int, ProgramMTL> programs_;
    std::vector<int> pendingDelete_;
    std::unordered_map<int, id<MTLSamplerState>> samplers_;
    std::unordered_map<int, id<MTLDepthStencilState>> depths_;
    std::vector<uint8_t> scratch_;

    id<MTLRenderCommandEncoder> Begin(MTLRenderPassDescriptor* rp) {
        // 自建编码器前必须先结束 Unity 的；画完结束自己的，Unity 需要时会重新开始
        unity_->EndCurrentCommandEncoder();
        id<MTLCommandBuffer> cb = unity_->CurrentCommandBuffer();
        return cb ? [cb renderCommandEncoderWithDescriptor:rp] : nil;
    }

    id<MTLFunction> Function(const std::string& src, const char* tag, std::string& err) {
        MTLCompileOptions* opt = [MTLCompileOptions new];
        opt.languageVersion = MTLLanguageVersion2_1;
        NSError* e = nil;
        NSString* s = [[NSString alloc] initWithBytes:src.data() length:src.size() encoding:NSUTF8StringEncoding];
        id<MTLLibrary> lib = s ? [device_ newLibraryWithSource:s options:opt error:&e] : nil;
        if (!lib) {
            err = std::string(tag) + (e ? e.localizedDescription.UTF8String : "源码无效");
            return nil;
        }
        // SPIRV-Cross 把 main 改名为 main0
        id<MTLFunction> fn = [lib newFunctionWithName:@"main0"];
        if (!fn) err = std::string(tag) + "找不到入口 main0";
        return fn;
    }

    static MTLVertexFormat AttrFormat(int f) {
        switch (f & ~AF_Instance) {
            case AF_Float1: return MTLVertexFormatFloat;
            case AF_Float2: return MTLVertexFormatFloat2;
            case AF_Float3: return MTLVertexFormatFloat3;
            case AF_Float4: return MTLVertexFormatFloat4;
            case AF_UNorm8x4: return MTLVertexFormatUChar4Normalized;
            case AF_Half2: return MTLVertexFormatHalf2;
            case AF_Half4: return MTLVertexFormatHalf4;
            default: return MTLVertexFormatInvalid;
        }
    }

    id<MTLRenderPipelineState> Pipeline(ProgramMTL& prog, int stride, const int* offsets, const int* formats, int instStride,
                                        const PassFormats& fmt, const std::string& passKey, int blend) {
        std::string key = passKey + "|" + std::to_string(blend) + "|" + std::to_string(stride) + "|" + std::to_string(instStride);
        for (int i = 0; i < kAttrCount; i++)
            if (prog.attrs & (1u << i)) key += "," + std::to_string(offsets[i]) + ":" + std::to_string(formats[i]);
        auto it = prog.pipelines.find(key);
        if (it != prog.pipelines.end()) return it->second;

        MTLVertexDescriptor* vd = [MTLVertexDescriptor vertexDescriptor];
        bool useMesh = false, useDefault = false, useInst = false;
        for (int i = 0; i < kAttrCount; i++) {
            if (!(prog.attrs & (1u << i))) continue;
            bool has = (formats[i] & ~AF_Instance) != AF_None && offsets[i] >= 0 && AttrFormat(formats[i]) != MTLVertexFormatInvalid;
            bool inst = has && (formats[i] & AF_Instance);
            auto* a = vd.attributes[i];
            if (has) {
                a.format = AttrFormat(formats[i]);
                a.offset = (NSUInteger)offsets[i];
                a.bufferIndex = inst ? kBufInstance : kBufMesh;
                (inst ? useInst : useMesh) = true;
            } else {
                // 缺省值：分量少于着色器声明时 Metal 自动补 (0,0,0,1)
                a.format = MTLVertexFormatFloat4;
                a.offset = (NSUInteger)(i * 16);
                a.bufferIndex = kBufDefault;
                useDefault = true;
            }
        }
        if (useMesh) {
            vd.layouts[kBufMesh].stride = (NSUInteger)stride;
            vd.layouts[kBufMesh].stepFunction = MTLVertexStepFunctionPerVertex;
            vd.layouts[kBufMesh].stepRate = 1;
        }
        if (useDefault) {
            vd.layouts[kBufDefault].stride = kDefaultStride;
            vd.layouts[kBufDefault].stepFunction = MTLVertexStepFunctionConstant;
            vd.layouts[kBufDefault].stepRate = 0;
        }
        if (useInst) {
            vd.layouts[kBufInstance].stride = (NSUInteger)instStride;
            vd.layouts[kBufInstance].stepFunction = MTLVertexStepFunctionPerInstance;
            vd.layouts[kBufInstance].stepRate = 1;
        }

        MTLRenderPipelineDescriptor* pd = [MTLRenderPipelineDescriptor new];
        pd.vertexFunction = prog.vs;
        pd.fragmentFunction = prog.fs;
        pd.vertexDescriptor = vd;
        pd.rasterSampleCount = fmt.samples;
        for (int i = 0; i < kMaxColor; i++) {
            if (fmt.color[i] == MTLPixelFormatInvalid) continue;
            auto* c = pd.colorAttachments[i];
            c.pixelFormat = fmt.color[i];
            c.writeMask = MTLColorWriteMaskAll;
            // 同 D3D11（IndependentBlendEnable 关闭）：混合方式对所有 MRT 目标生效
            if (blend != 0) {
                c.blendingEnabled = YES;
                c.rgbBlendOperation = c.alphaBlendOperation = MTLBlendOperationAdd;
                c.sourceRGBBlendFactor = blend == 3 ? MTLBlendFactorOne : MTLBlendFactorSourceAlpha;
                c.destinationRGBBlendFactor = blend == 2 ? MTLBlendFactorOne : MTLBlendFactorOneMinusSourceAlpha;
                c.sourceAlphaBlendFactor = MTLBlendFactorOne;
                c.destinationAlphaBlendFactor = blend == 2 ? MTLBlendFactorOne : MTLBlendFactorOneMinusSourceAlpha;
            }
        }
        pd.depthAttachmentPixelFormat = fmt.depth;
        pd.stencilAttachmentPixelFormat = fmt.stencil;
        NSError* e = nil;
        id<MTLRenderPipelineState> pso = [device_ newRenderPipelineStateWithDescriptor:pd error:&e];
        if (!pso) NSLog(@"[pot_gfx] 创建 Metal 管线状态失败：%@", e ? e.localizedDescription : @"");
        prog.pipelines[key] = pso;
        return pso;
    }

    // 统一块：按着色器声明的大小（16 对齐）补零上传；4KB 以内走 setBytes，更大的临时建缓冲（由命令缓冲持有到执行完）
    void Uniforms(id<MTLRenderCommandEncoder> enc, bool vertex, int slot, int size, const uint8_t* data, int bytes) {
        if (size <= 0) return;
        size_t need = (size_t)((size + 15) & ~15);
        if (bytes > 0 && (size_t)bytes > need) need = (size_t)bytes;
        scratch_.assign(need, 0);
        if (data && bytes > 0) memcpy(scratch_.data(), data, (size_t)bytes);
        if (need <= 4096) {
            if (vertex) [enc setVertexBytes:scratch_.data() length:need atIndex:(NSUInteger)slot];
            else [enc setFragmentBytes:scratch_.data() length:need atIndex:(NSUInteger)slot];
            return;
        }
        id<MTLBuffer> b = [device_ newBufferWithBytes:scratch_.data() length:need options:MTLResourceStorageModeShared];
        if (vertex) [enc setVertexBuffer:b offset:0 atIndex:(NSUInteger)slot];
        else [enc setFragmentBuffer:b offset:0 atIndex:(NSUInteger)slot];
    }

    id<MTLSamplerState> Sampler(int code, bool shadow) {
        int key = code | (shadow ? 32 : 0);
        auto it = samplers_.find(key);
        if (it != samplers_.end()) return it->second;
        MTLSamplerDescriptor* sd = [MTLSamplerDescriptor new];
        int filter = (code >> 1) & 3;
        bool aniso = (code & 8) != 0 && filter == 2;
        sd.minFilter = sd.magFilter = filter == 0 ? MTLSamplerMinMagFilterNearest : MTLSamplerMinMagFilterLinear;
        sd.mipFilter = filter == 2 ? MTLSamplerMipFilterLinear : MTLSamplerMipFilterNearest;
        sd.maxAnisotropy = aniso ? 8 : 1;
        MTLSamplerAddressMode mode = (code & 1) ? MTLSamplerAddressModeClampToEdge : MTLSamplerAddressModeRepeat;
        sd.sAddressMode = sd.tAddressMode = sd.rAddressMode = mode;
        if (shadow) sd.compareFunction = MTLCompareFunctionLessEqual;
        id<MTLSamplerState> s = [device_ newSamplerStateWithDescriptor:sd];
        samplers_[key] = s;
        return s;
    }

    id<MTLDepthStencilState> Depth(uint32_t flags, bool hasDepth) {
        int key = (int)(flags & (F_DepthWrite | F_ReversedZ | F_NoDepthTest)) | (hasDepth ? 0x10000 : 0);
        auto it = depths_.find(key);
        if (it != depths_.end()) return it->second;
        MTLDepthStencilDescriptor* dd = [MTLDepthStencilDescriptor new];
        // 通道没有深度附件时必须关掉深度测试与写入，否则 Metal 校验报错
        bool test = hasDepth && !(flags & F_NoDepthTest);
        dd.depthCompareFunction = !test ? MTLCompareFunctionAlways
                                : (flags & F_ReversedZ) ? MTLCompareFunctionGreaterEqual
                                                        : MTLCompareFunctionLessEqual;
        // 同 D3D11：关深度测试时也不写深度
        dd.depthWriteEnabled = test && (flags & F_DepthWrite) ? YES : NO;
        id<MTLDepthStencilState> s = [device_ newDepthStencilStateWithDescriptor:dd];
        depths_[key] = s;
        return s;
    }
};

Backend* CreateBackendMetal(void* unityInterfaces) {
    auto* ifs = (IUnityInterfaces*)unityInterfaces;
    auto* metal = ifs->Get<IUnityGraphicsMetalV1>();
    if (!metal) return nullptr;
    id<MTLDevice> dev = metal->MetalDevice();
    if (!dev) return nullptr;
    return new BackendMetal(metal, dev);
}

}  // namespace pot
