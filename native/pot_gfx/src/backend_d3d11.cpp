// pot_gfx D3D11 后端：HLSL（SPIRV-Cross 生成）→ D3DCompile → 在 Unity 当前绑定的渲染目标上绘制
#include <d3d11.h>
#include <d3dcompiler.h>

#include <IUnityGraphicsD3D11.h>
#include <IUnityInterface.h>

#include <mutex>
#include <string>
#include <unordered_map>
#include <vector>

#include "backend.h"

namespace pot {

template <class T>
static void SafeRelease(T*& p) {
    if (p) {
        p->Release();
        p = nullptr;
    }
}

struct ProgramD3D11 {
    ID3D11VertexShader* vs = nullptr;
    ID3D11PixelShader* ps = nullptr;
    std::vector<uint8_t> vsBlob;
    ID3D11Buffer* vsCB = nullptr;
    ID3D11Buffer* psCB = nullptr;
    int vsCBSize = 0, psCBSize = 0, vsCBSlot = 0, psCBSlot = 0;
    std::unordered_map<std::string, ID3D11InputLayout*> layouts;

    void Release() {
        SafeRelease(vs);
        SafeRelease(ps);
        SafeRelease(vsCB);
        SafeRelease(psCB);
        for (auto& kv : layouts) kv.second->Release();
        layouts.clear();
    }
};

struct SavedState {
    ID3D11InputLayout* layout = nullptr;
    ID3D11Buffer* vb[2] = {};
    UINT vbStride[2] = {}, vbOffset[2] = {};
    ID3D11Buffer* ib = nullptr;
    DXGI_FORMAT ibFormat = DXGI_FORMAT_UNKNOWN;
    UINT ibOffset = 0;
    D3D11_PRIMITIVE_TOPOLOGY topo = D3D11_PRIMITIVE_TOPOLOGY_UNDEFINED;
    ID3D11VertexShader* vs = nullptr;
    ID3D11PixelShader* ps = nullptr;
    ID3D11Buffer* vsCB[2] = {};
    ID3D11Buffer* psCB[2] = {};
    ID3D11ShaderResourceView* vsSRV[16] = {};
    ID3D11ShaderResourceView* psSRV[16] = {};
    ID3D11SamplerState* vsSamp[16] = {};
    ID3D11SamplerState* psSamp[16] = {};
    ID3D11RasterizerState* rs = nullptr;
    ID3D11BlendState* blend = nullptr;
    FLOAT blendFactor[4] = {};
    UINT sampleMask = 0;
    ID3D11DepthStencilState* ds = nullptr;
    UINT stencilRef = 0;
};

struct SrvEntry {
    ID3D11ShaderResourceView* srv = nullptr;
    uint64_t lastUse = 0;
};

class BackendD3D11 : public Backend {
public:
    explicit BackendD3D11(ID3D11Device* device) : device_(device) {
        // 缺省属性：slot 1，步长 0，所有顶点读同一个值
        const float dummy[20] = {0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 0, 0, 1};
        D3D11_BUFFER_DESC bd = {};
        bd.ByteWidth = sizeof dummy;
        bd.Usage = D3D11_USAGE_IMMUTABLE;
        bd.BindFlags = D3D11_BIND_VERTEX_BUFFER;
        D3D11_SUBRESOURCE_DATA sd = {dummy, 0, 0};
        device_->CreateBuffer(&bd, &sd, &dummy_);
    }

    const char* Name() const override { return "d3d11"; }
    Target ShaderTarget() const override { return Target::HLSL50; }

    bool CreateProgram(int id, CompiledProgram& p, std::string& err) override {
        ProgramD3D11 prog;
        if (p.vsBin.empty() || p.fsBin.empty()) {
            ID3DBlob* code = nullptr;
            if (!Compile(p.vsCode, "vs_5_0", &code, err)) return false;
            p.vsBin.assign((uint8_t*)code->GetBufferPointer(), (uint8_t*)code->GetBufferPointer() + code->GetBufferSize());
            code->Release();
            if (!Compile(p.fsCode, "ps_5_0", &code, err)) { p.vsBin.clear(); return false; }
            p.fsBin.assign((uint8_t*)code->GetBufferPointer(), (uint8_t*)code->GetBufferPointer() + code->GetBufferSize());
            code->Release();
        }
        prog.vsBlob = p.vsBin;
        HRESULT hr = device_->CreateVertexShader(p.vsBin.data(), p.vsBin.size(), nullptr, &prog.vs);
        if (FAILED(hr)) { err = "CreateVertexShader 失败"; return false; }
        hr = device_->CreatePixelShader(p.fsBin.data(), p.fsBin.size(), nullptr, &prog.ps);
        if (FAILED(hr)) { err = "CreatePixelShader 失败"; prog.Release(); return false; }
        prog.vsCBSize = p.vs.blockSize;
        prog.psCBSize = p.fs.blockSize;
        prog.vsCBSlot = p.vs.blockBinding;
        prog.psCBSlot = p.fs.blockBinding;
        if (prog.vsCBSize > 0) prog.vsCB = MakeCB(prog.vsCBSize);
        if (prog.psCBSize > 0) prog.psCB = MakeCB(prog.psCBSize);
        std::lock_guard<std::mutex> lock(mutex_);
        programs_[id] = prog;
        return true;
    }

    void DestroyProgram(int id) override {
        std::lock_guard<std::mutex> lock(mutex_);
        pendingDelete_.push_back(id);
    }

    void Shutdown() override {
        std::lock_guard<std::mutex> lock(mutex_);
        for (auto& kv : programs_) kv.second.Release();
        programs_.clear();
        for (auto& kv : srvs_) kv.second.srv->Release();
        srvs_.clear();
        for (auto& kv : samplers_) kv.second->Release();
        samplers_.clear();
        for (auto& kv : blends_) kv.second->Release();
        blends_.clear();
        for (auto& kv : depths_) kv.second->Release();
        depths_.clear();
        for (auto& kv : rasters_) kv.second->Release();
        rasters_.clear();
        SafeRelease(dummy_);
    }

    void Render(const uint8_t* data, size_t len) override {
        frame_++;
        std::lock_guard<std::mutex> lock(mutex_);
        for (int id : pendingDelete_) {
            auto it = programs_.find(id);
            if (it != programs_.end()) {
                it->second.Release();
                programs_.erase(it);
            }
        }
        pendingDelete_.clear();
        PurgeSrvs();

        Reader r{data, data + len};
        int count = r.i32();
        if (!r.ok || count <= 0) return;

        ID3D11DeviceContext* ctx = nullptr;
        device_->GetImmediateContext(&ctx);
        SavedState saved;
        Save(ctx, saved);
        ctx->IASetPrimitiveTopology(D3D11_PRIMITIVE_TOPOLOGY_TRIANGLELIST);

        for (int d = 0; d < count && r.ok; d++) {
            int program = r.i32();
            uint32_t flags = (uint32_t)r.i32();
            ID3D11Buffer* vb = (ID3D11Buffer*)(intptr_t)r.i64();
            ID3D11Buffer* ib = (ID3D11Buffer*)(intptr_t)r.i64();
            int stride = r.i32();
            int index32 = r.i32();
            int indexStart = r.i32();
            int indexCount = r.i32();
            int baseVertex = r.i32();
            int offsets[kAttrCount], formats[kAttrCount];
            for (int i = 0; i < kAttrCount; i++) offsets[i] = r.i32();
            for (int i = 0; i < kAttrCount; i++) formats[i] = r.i32();
            int texCount = r.i32();
            struct Tex { int slot, sampler; ID3D11Resource* res; };
            Tex texs[16];
            int nt = 0;
            for (int i = 0; i < texCount && r.ok; i++) {
                Tex t;
                t.slot = r.i32();
                t.sampler = r.i32();
                t.res = (ID3D11Resource*)(intptr_t)r.i64();
                if (nt < 16) texs[nt++] = t;
            }
            int vsBytes = r.i32();
            const uint8_t* vsData = r.bytes(vsBytes);
            int fsBytes = r.i32();
            const uint8_t* fsData = r.bytes(fsBytes);
            if (!r.ok) break;

            auto it = programs_.find(program);
            if (it == programs_.end() || !vb || !ib || indexCount <= 0) continue;
            ProgramD3D11& prog = it->second;
            ID3D11InputLayout* layout = Layout(prog, stride, offsets, formats);
            if (!layout) continue;

            Upload(ctx, prog.vsCB, prog.vsCBSize, vsData, vsBytes);
            Upload(ctx, prog.psCB, prog.psCBSize, fsData, fsBytes);

            ctx->IASetInputLayout(layout);
            ID3D11Buffer* vbs[2] = {vb, dummy_};
            UINT strides[2] = {(UINT)stride, 0};
            UINT offs[2] = {0, 0};
            ctx->IASetVertexBuffers(0, 2, vbs, strides, offs);
            ctx->IASetIndexBuffer(ib, index32 ? DXGI_FORMAT_R32_UINT : DXGI_FORMAT_R16_UINT, 0);
            ctx->VSSetShader(prog.vs, nullptr, 0);
            ctx->PSSetShader(prog.ps, nullptr, 0);
            if (prog.vsCB) ctx->VSSetConstantBuffers(prog.vsCBSlot, 1, &prog.vsCB);
            if (prog.psCB) ctx->PSSetConstantBuffers(prog.psCBSlot, 1, &prog.psCB);
            for (int i = 0; i < nt; i++) {
                if (texs[i].slot < 0 || texs[i].slot >= 16) continue;
                ID3D11ShaderResourceView* srv = Srv(texs[i].res, (texs[i].sampler & 16) != 0);
                ID3D11SamplerState* samp = Sampler(texs[i].sampler & 15);
                ctx->VSSetShaderResources(texs[i].slot, 1, &srv);
                ctx->PSSetShaderResources(texs[i].slot, 1, &srv);
                ctx->VSSetSamplers(texs[i].slot, 1, &samp);
                ctx->PSSetSamplers(texs[i].slot, 1, &samp);
            }
            ctx->RSSetState(Raster(flags));
            const float factor[4] = {0, 0, 0, 0};
            ctx->OMSetBlendState(Blend((flags >> F_BlendShift) & 3), factor, 0xffffffff);
            ctx->OMSetDepthStencilState(Depth(flags), 0);
            ctx->DrawIndexed((UINT)indexCount, (UINT)indexStart, baseVertex);
        }

        Restore(ctx, saved);
        ctx->Release();
    }

private:
    ID3D11Device* device_;
    ID3D11Buffer* dummy_ = nullptr;
    std::mutex mutex_;
    std::unordered_map<int, ProgramD3D11> programs_;
    std::vector<int> pendingDelete_;
    std::unordered_map<uint64_t, SrvEntry> srvs_;
    std::unordered_map<int, ID3D11SamplerState*> samplers_;
    std::unordered_map<int, ID3D11BlendState*> blends_;
    std::unordered_map<int, ID3D11DepthStencilState*> depths_;
    std::unordered_map<uint32_t, ID3D11RasterizerState*> rasters_;
    uint64_t frame_ = 0;

    bool Compile(const std::string& src, const char* target, ID3DBlob** code, std::string& err) {
        ID3DBlob* errors = nullptr;
        HRESULT hr = D3DCompile(src.data(), src.size(), "pot", nullptr, nullptr, "main", target,
                                D3DCOMPILE_OPTIMIZATION_LEVEL3, 0, code, &errors);
        if (FAILED(hr)) {
            err = std::string("[HLSL ") + target + "] ";
            if (errors) err.append((const char*)errors->GetBufferPointer(), errors->GetBufferSize());
            SafeRelease(errors);
            return false;
        }
        SafeRelease(errors);
        return true;
    }

    ID3D11Buffer* MakeCB(int size) {
        D3D11_BUFFER_DESC bd = {};
        bd.ByteWidth = (UINT)((size + 15) & ~15);
        bd.Usage = D3D11_USAGE_DYNAMIC;
        bd.BindFlags = D3D11_BIND_CONSTANT_BUFFER;
        bd.CPUAccessFlags = D3D11_CPU_ACCESS_WRITE;
        ID3D11Buffer* b = nullptr;
        device_->CreateBuffer(&bd, nullptr, &b);
        return b;
    }

    static void Upload(ID3D11DeviceContext* ctx, ID3D11Buffer* cb, int size, const uint8_t* data, int bytes) {
        if (!cb) return;
        D3D11_MAPPED_SUBRESOURCE m;
        if (FAILED(ctx->Map(cb, 0, D3D11_MAP_WRITE_DISCARD, 0, &m))) return;
        int n = bytes < size ? bytes : size;
        if (n > 0 && data) memcpy(m.pData, data, (size_t)n);
        if (n < size) memset((uint8_t*)m.pData + (n > 0 ? n : 0), 0, (size_t)(size - (n > 0 ? n : 0)));
        ctx->Unmap(cb, 0);
    }

    static DXGI_FORMAT AttrDxgi(int f) {
        switch (f) {
            case AF_Float2: return DXGI_FORMAT_R32G32_FLOAT;
            case AF_Float3: return DXGI_FORMAT_R32G32B32_FLOAT;
            case AF_Float4: return DXGI_FORMAT_R32G32B32A32_FLOAT;
            case AF_UNorm8x4: return DXGI_FORMAT_R8G8B8A8_UNORM;
            case AF_Half2: return DXGI_FORMAT_R16G16_FLOAT;
            case AF_Half4: return DXGI_FORMAT_R16G16B16A16_FLOAT;
            default: return DXGI_FORMAT_UNKNOWN;
        }
    }

    ID3D11InputLayout* Layout(ProgramD3D11& prog, int stride, const int* offsets, const int* formats) {
        std::string key = std::to_string(stride);
        for (int i = 0; i < kAttrCount; i++) key += "," + std::to_string(offsets[i]) + ":" + std::to_string(formats[i]);
        auto it = prog.layouts.find(key);
        if (it != prog.layouts.end()) return it->second;
        static const DXGI_FORMAT defaults[kAttrCount] = {DXGI_FORMAT_R32G32B32_FLOAT, DXGI_FORMAT_R32G32B32_FLOAT,
                                                         DXGI_FORMAT_R32G32_FLOAT, DXGI_FORMAT_R32G32B32A32_FLOAT,
                                                         DXGI_FORMAT_R32G32B32A32_FLOAT};
        D3D11_INPUT_ELEMENT_DESC el[kAttrCount];
        for (int i = 0; i < kAttrCount; i++) {
            bool has = formats[i] != AF_None && offsets[i] >= 0;
            el[i].SemanticName = "TEXCOORD";
            el[i].SemanticIndex = (UINT)i;
            el[i].Format = has ? AttrDxgi(formats[i]) : defaults[i];
            el[i].InputSlot = has ? 0 : 1;
            el[i].AlignedByteOffset = has ? (UINT)offsets[i] : (UINT)(i * 16);
            el[i].InputSlotClass = D3D11_INPUT_PER_VERTEX_DATA;
            el[i].InstanceDataStepRate = 0;
        }
        ID3D11InputLayout* layout = nullptr;
        device_->CreateInputLayout(el, kAttrCount, prog.vsBlob.data(), prog.vsBlob.size(), &layout);
        prog.layouts[key] = layout;  // 失败也缓存 nullptr，避免每帧重试
        return layout;
    }

    static DXGI_FORMAT Typed(DXGI_FORMAT f, bool srgb) {
        switch (f) {
            case DXGI_FORMAT_R8G8B8A8_TYPELESS: return srgb ? DXGI_FORMAT_R8G8B8A8_UNORM_SRGB : DXGI_FORMAT_R8G8B8A8_UNORM;
            case DXGI_FORMAT_B8G8R8A8_TYPELESS: return srgb ? DXGI_FORMAT_B8G8R8A8_UNORM_SRGB : DXGI_FORMAT_B8G8R8A8_UNORM;
            case DXGI_FORMAT_BC1_TYPELESS: return srgb ? DXGI_FORMAT_BC1_UNORM_SRGB : DXGI_FORMAT_BC1_UNORM;
            case DXGI_FORMAT_BC2_TYPELESS: return srgb ? DXGI_FORMAT_BC2_UNORM_SRGB : DXGI_FORMAT_BC2_UNORM;
            case DXGI_FORMAT_BC3_TYPELESS: return srgb ? DXGI_FORMAT_BC3_UNORM_SRGB : DXGI_FORMAT_BC3_UNORM;
            case DXGI_FORMAT_BC7_TYPELESS: return srgb ? DXGI_FORMAT_BC7_UNORM_SRGB : DXGI_FORMAT_BC7_UNORM;
            case DXGI_FORMAT_R16G16B16A16_TYPELESS: return DXGI_FORMAT_R16G16B16A16_FLOAT;
            case DXGI_FORMAT_R32G32B32A32_TYPELESS: return DXGI_FORMAT_R32G32B32A32_FLOAT;
            case DXGI_FORMAT_R32_TYPELESS: return DXGI_FORMAT_R32_FLOAT;
            case DXGI_FORMAT_R16_TYPELESS: return DXGI_FORMAT_R16_UNORM;
            case DXGI_FORMAT_R8_TYPELESS: return DXGI_FORMAT_R8_UNORM;
            case DXGI_FORMAT_R8G8_TYPELESS: return DXGI_FORMAT_R8G8_UNORM;
            case DXGI_FORMAT_R24G8_TYPELESS: return DXGI_FORMAT_R24_UNORM_X8_TYPELESS;
            case DXGI_FORMAT_R32G8X24_TYPELESS: return DXGI_FORMAT_R32_FLOAT_X8X24_TYPELESS;
            default: return f;
        }
    }

    ID3D11ShaderResourceView* Srv(ID3D11Resource* res, bool srgb) {
        if (!res) return nullptr;
        uint64_t key = (uint64_t)(intptr_t)res ^ (srgb ? 1ull : 0ull);
        auto it = srvs_.find(key);
        if (it != srvs_.end()) {
            it->second.lastUse = frame_;
            return it->second.srv;
        }
        ID3D11Texture2D* tex = nullptr;
        if (FAILED(res->QueryInterface(__uuidof(ID3D11Texture2D), (void**)&tex))) return nullptr;
        D3D11_TEXTURE2D_DESC td;
        tex->GetDesc(&td);
        tex->Release();
        D3D11_SHADER_RESOURCE_VIEW_DESC sd = {};
        sd.Format = Typed(td.Format, srgb);
        if (td.MiscFlags & D3D11_RESOURCE_MISC_TEXTURECUBE) {
            sd.ViewDimension = D3D11_SRV_DIMENSION_TEXTURECUBE;
            sd.TextureCube.MipLevels = (UINT)-1;
        } else if (td.SampleDesc.Count > 1) {
            sd.ViewDimension = D3D11_SRV_DIMENSION_TEXTURE2DMS;
        } else {
            sd.ViewDimension = D3D11_SRV_DIMENSION_TEXTURE2D;
            sd.Texture2D.MipLevels = (UINT)-1;
        }
        ID3D11ShaderResourceView* srv = nullptr;
        device_->CreateShaderResourceView(res, &sd, &srv);
        if (srv) srvs_[key] = SrvEntry{srv, frame_};
        return srv;
    }

    void PurgeSrvs() {
        // 一段时间没用的视图释放掉（视图持有贴图引用，Unity 销毁贴图后不能一直留着）
        for (auto it = srvs_.begin(); it != srvs_.end();) {
            if (frame_ - it->second.lastUse > 240) {
                it->second.srv->Release();
                it = srvs_.erase(it);
            } else {
                ++it;
            }
        }
    }

    ID3D11SamplerState* Sampler(int code) {
        auto it = samplers_.find(code);
        if (it != samplers_.end()) return it->second;
        D3D11_SAMPLER_DESC sd = {};
        int filter = (code >> 1) & 3;
        bool aniso = (code & 8) != 0 && filter == 2;
        sd.Filter = aniso ? D3D11_FILTER_ANISOTROPIC
                  : filter == 0 ? D3D11_FILTER_MIN_MAG_MIP_POINT
                  : filter == 1 ? D3D11_FILTER_MIN_MAG_LINEAR_MIP_POINT
                                : D3D11_FILTER_MIN_MAG_MIP_LINEAR;
        D3D11_TEXTURE_ADDRESS_MODE mode = (code & 1) ? D3D11_TEXTURE_ADDRESS_CLAMP : D3D11_TEXTURE_ADDRESS_WRAP;
        sd.AddressU = sd.AddressV = sd.AddressW = mode;
        sd.MaxAnisotropy = aniso ? 8 : 1;
        sd.ComparisonFunc = D3D11_COMPARISON_NEVER;
        sd.MaxLOD = D3D11_FLOAT32_MAX;
        ID3D11SamplerState* s = nullptr;
        device_->CreateSamplerState(&sd, &s);
        samplers_[code] = s;
        return s;
    }

    ID3D11BlendState* Blend(int mode) {
        auto it = blends_.find(mode);
        if (it != blends_.end()) return it->second;
        D3D11_BLEND_DESC bd = {};
        auto& rt = bd.RenderTarget[0];
        rt.RenderTargetWriteMask = D3D11_COLOR_WRITE_ENABLE_ALL;
        if (mode != 0) {
            rt.BlendEnable = TRUE;
            rt.BlendOp = rt.BlendOpAlpha = D3D11_BLEND_OP_ADD;
            rt.SrcBlend = mode == 1 ? D3D11_BLEND_SRC_ALPHA : mode == 2 ? D3D11_BLEND_SRC_ALPHA : D3D11_BLEND_ONE;
            rt.DestBlend = mode == 2 ? D3D11_BLEND_ONE : D3D11_BLEND_INV_SRC_ALPHA;
            rt.SrcBlendAlpha = D3D11_BLEND_ONE;
            rt.DestBlendAlpha = mode == 2 ? D3D11_BLEND_ONE : D3D11_BLEND_INV_SRC_ALPHA;
        }
        ID3D11BlendState* s = nullptr;
        device_->CreateBlendState(&bd, &s);
        blends_[mode] = s;
        return s;
    }

    ID3D11DepthStencilState* Depth(uint32_t flags) {
        int key = (int)(flags & (F_DepthWrite | F_ReversedZ | F_NoDepthTest));
        auto it = depths_.find(key);
        if (it != depths_.end()) return it->second;
        D3D11_DEPTH_STENCIL_DESC dd = {};
        dd.DepthEnable = (flags & F_NoDepthTest) ? FALSE : TRUE;
        dd.DepthWriteMask = (flags & F_DepthWrite) ? D3D11_DEPTH_WRITE_MASK_ALL : D3D11_DEPTH_WRITE_MASK_ZERO;
        dd.DepthFunc = (flags & F_ReversedZ) ? D3D11_COMPARISON_GREATER_EQUAL : D3D11_COMPARISON_LESS_EQUAL;
        ID3D11DepthStencilState* s = nullptr;
        device_->CreateDepthStencilState(&dd, &s);
        depths_[key] = s;
        return s;
    }

    ID3D11RasterizerState* Raster(uint32_t flags) {
        // 缓存键：剔除、绕序、深度偏移（bit16-31）
        uint32_t key = flags & (F_CullMask | F_FrontCCW | F_ReversedZ | (0xFFFFu << F_OffsetShift));
        auto it = rasters_.find(key);
        if (it != rasters_.end()) return it->second;
        D3D11_RASTERIZER_DESC rd = {};
        rd.FillMode = D3D11_FILL_SOLID;
        int cull = (int)(flags & F_CullMask);
        rd.CullMode = cull == 0 ? D3D11_CULL_BACK : cull == 1 ? D3D11_CULL_FRONT : D3D11_CULL_NONE;
        rd.FrontCounterClockwise = (flags & F_FrontCCW) ? TRUE : FALSE;
        rd.DepthClipEnable = TRUE;
        // 同 GL：offset = factor·斜率 + units·最小可分辨深度；reversed Z 时“朝相机”是深度变大，取反
        float sign = (flags & F_ReversedZ) ? -1.0f : 1.0f;
        rd.DepthBias = (INT)(sign * (float)OffsetUnits(flags));
        rd.SlopeScaledDepthBias = sign * (float)OffsetFactor(flags);
        rd.DepthBiasClamp = 0.0f;
        ID3D11RasterizerState* s = nullptr;
        device_->CreateRasterizerState(&rd, &s);
        rasters_[key] = s;
        return s;
    }

    static void Save(ID3D11DeviceContext* c, SavedState& s) {
        c->IAGetInputLayout(&s.layout);
        c->IAGetVertexBuffers(0, 2, s.vb, s.vbStride, s.vbOffset);
        c->IAGetIndexBuffer(&s.ib, &s.ibFormat, &s.ibOffset);
        c->IAGetPrimitiveTopology(&s.topo);
        c->VSGetShader(&s.vs, nullptr, nullptr);
        c->PSGetShader(&s.ps, nullptr, nullptr);
        c->VSGetConstantBuffers(0, 2, s.vsCB);
        c->PSGetConstantBuffers(0, 2, s.psCB);
        c->VSGetShaderResources(0, 16, s.vsSRV);
        c->PSGetShaderResources(0, 16, s.psSRV);
        c->VSGetSamplers(0, 16, s.vsSamp);
        c->PSGetSamplers(0, 16, s.psSamp);
        c->RSGetState(&s.rs);
        c->OMGetBlendState(&s.blend, s.blendFactor, &s.sampleMask);
        c->OMGetDepthStencilState(&s.ds, &s.stencilRef);
    }

    static void Restore(ID3D11DeviceContext* c, SavedState& s) {
        c->IASetInputLayout(s.layout);
        c->IASetVertexBuffers(0, 2, s.vb, s.vbStride, s.vbOffset);
        c->IASetIndexBuffer(s.ib, s.ibFormat, s.ibOffset);
        c->IASetPrimitiveTopology(s.topo);
        c->VSSetShader(s.vs, nullptr, 0);
        c->PSSetShader(s.ps, nullptr, 0);
        c->VSSetConstantBuffers(0, 2, s.vsCB);
        c->PSSetConstantBuffers(0, 2, s.psCB);
        c->VSSetShaderResources(0, 16, s.vsSRV);
        c->PSSetShaderResources(0, 16, s.psSRV);
        c->VSSetSamplers(0, 16, s.vsSamp);
        c->PSSetSamplers(0, 16, s.psSamp);
        c->RSSetState(s.rs);
        c->OMSetBlendState(s.blend, s.blendFactor, s.sampleMask);
        c->OMSetDepthStencilState(s.ds, s.stencilRef);
        SafeRelease(s.layout);
        for (auto& b : s.vb) SafeRelease(b);
        SafeRelease(s.ib);
        SafeRelease(s.vs);
        SafeRelease(s.ps);
        for (auto& b : s.vsCB) SafeRelease(b);
        for (auto& b : s.psCB) SafeRelease(b);
        for (auto& v : s.vsSRV) SafeRelease(v);
        for (auto& v : s.psSRV) SafeRelease(v);
        for (auto& v : s.vsSamp) SafeRelease(v);
        for (auto& v : s.psSamp) SafeRelease(v);
        SafeRelease(s.rs);
        SafeRelease(s.blend);
        SafeRelease(s.ds);
    }
};

Backend* CreateBackendD3D11(void* unityInterfaces) {
    auto* ifs = (IUnityInterfaces*)unityInterfaces;
    auto* d3d = ifs->Get<IUnityGraphicsD3D11>();
    if (!d3d) return nullptr;
    ID3D11Device* dev = d3d->GetDevice();
    if (!dev) return nullptr;
    return new BackendD3D11(dev);
}

}  // namespace pot
