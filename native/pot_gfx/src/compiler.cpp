#include "compiler.h"

#include <glslang/Public/ShaderLang.h>
#include <glslang/Public/ResourceLimits.h>
#include <SPIRV/GlslangToSpv.h>
#include <spirv_hlsl.hpp>
#include <spirv_glsl.hpp>

#include <algorithm>
#include <cstdio>
#include <memory>
#include <mutex>
#include <unordered_map>

namespace pot {

static std::once_flag g_init;

std::string JsonEscape(const std::string& s) {
    std::string o;
    o.reserve(s.size() + 8);
    for (unsigned char c : s) {
        switch (c) {
            case '"': o += "\\\""; break;
            case '\\': o += "\\\\"; break;
            case '\n': o += "\\n"; break;
            case '\r': break;
            case '\t': o += "\\t"; break;
            default:
                if (c < 0x20) {
                    char buf[8];
                    snprintf(buf, sizeof buf, "\\u%04x", c);
                    o += buf;
                } else {
                    o += (char)c;
                }
        }
    }
    return o;
}

static void Reflect(spirv_cross::Compiler& comp, StageReflection& r) {
    auto res = comp.get_shader_resources();
    for (auto& ub : res.uniform_buffers) {
        const auto& type = comp.get_type(ub.base_type_id);
        r.blockSize = (int)comp.get_declared_struct_size(type);
        r.blockBinding = (int)comp.get_decoration(ub.id, spv::DecorationBinding);
        for (uint32_t i = 0; i < (uint32_t)type.member_types.size(); i++) {
            const auto& mt = comp.get_type(type.member_types[i]);
            UniformMember m;
            m.name = comp.get_member_name(type.self, i);
            m.offset = (int)comp.type_struct_member_offset(type, i);
            m.base = mt.basetype == spirv_cross::SPIRType::Int ? 'i' : mt.basetype == spirv_cross::SPIRType::UInt ? 'u' : 'f';
            m.vecsize = (int)mt.vecsize;
            m.columns = (int)mt.columns;
            if (!mt.array.empty()) {
                m.arraySize = (int)mt.array[0];
                m.arrayStride = (int)comp.type_struct_member_array_stride(type, i);
            }
            if (mt.columns > 1) m.matrixStride = (int)comp.type_struct_member_matrix_stride(type, i);
            r.members.push_back(m);
        }
        break;  // 只有一个默认块
    }
    for (auto& t : res.sampled_images) {
        r.textures.emplace_back(comp.get_name(t.id), (int)comp.get_decoration(t.id, spv::DecorationBinding));
    }
}

static std::unique_ptr<spirv_cross::CompilerGLSL> MakeCompiler(std::vector<uint32_t> spirv, Target target) {
    std::unique_ptr<spirv_cross::CompilerGLSL> c;
    if (target == Target::HLSL50) {
        auto h = std::make_unique<spirv_cross::CompilerHLSL>(std::move(spirv));
        spirv_cross::CompilerHLSL::Options ho;
        ho.shader_model = 50;
        h->set_hlsl_options(ho);
        c = std::move(h);
    } else {
        c = std::make_unique<spirv_cross::CompilerGLSL>(std::move(spirv));
        spirv_cross::CompilerGLSL::Options o;
        o.version = 300;
        o.es = true;
        o.vulkan_semantics = false;
        o.vertex.support_nonzero_base_instance = false;
        c->set_common_options(o);
    }
    return c;
}

// 阶段间变量按名字配对（GLSL 链接语义）：片元不读的顶点输出屏蔽掉，两边按名字统一重排 location。
// D3D11 要求 VS 输出与 PS 输入签名寄存器一致，所以两边必须是同一组变量、同一顺序。
static bool LinkVaryings(spirv_cross::CompilerGLSL& vsc, spirv_cross::CompilerGLSL& fsc, std::string& err) {
    auto vres = vsc.get_shader_resources();
    auto fres = fsc.get_shader_resources();
    std::unordered_map<std::string, uint32_t> vsOut;  // 名字 → 原 location
    std::unordered_map<std::string, spirv_cross::ID> vsIds;
    for (auto& v : vres.stage_outputs) {
        std::string n = vsc.get_name(v.id);
        vsOut[n] = vsc.get_decoration(v.id, spv::DecorationLocation);
        vsIds[n] = v.id;
    }
    std::vector<std::pair<uint32_t, std::string>> used;  // 按顶点阶段原 location 排序
    for (auto& v : fres.stage_inputs) {
        std::string n = fsc.get_name(v.id);
        auto it = vsOut.find(n);
        if (it == vsOut.end()) {
            err = "片元着色器的输入 " + n + " 在顶点着色器里没有对应的 out";
            return false;
        }
        used.emplace_back(it->second, n);
    }
    std::sort(used.begin(), used.end());
    std::unordered_map<std::string, uint32_t> newLoc;
    uint32_t next = 0;
    for (auto& u : used) newLoc[u.second] = next++;
    // 片元不读的顶点输出排在后面：D3D11 允许 PS 输入签名是 VS 输出签名的前缀
    std::vector<std::pair<uint32_t, std::string>> rest;
    for (auto& kv : vsOut) if (!newLoc.count(kv.first)) rest.emplace_back(kv.second, kv.first);
    std::sort(rest.begin(), rest.end());
    for (auto& r : rest) newLoc[r.second] = next++;
    for (auto& kv : newLoc) vsc.set_decoration(vsIds[kv.first], spv::DecorationLocation, kv.second);
    for (auto& v : fres.stage_inputs) fsc.set_decoration(v.id, spv::DecorationLocation, newLoc[fsc.get_name(v.id)]);
    return true;
}

static std::string Finish(spirv_cross::CompilerGLSL& c, Target target, StageReflection& refl, std::string& err) {
    try {
        Reflect(c, refl);
        if (target != Target::HLSL50) c.build_combined_image_samplers();
        return c.compile();
    } catch (const std::exception& e) {
        err = std::string("SPIRV-Cross: ") + e.what();
        return {};
    }
}

static void SetupShader(glslang::TShader& s, EShLanguage stage, const char* const* src) {
    s.setStrings(src, 1);
    s.setEnvInput(glslang::EShSourceGlsl, stage, glslang::EShClientVulkan, 100);
    s.setEnvInputVulkanRulesRelaxed();
    s.setEnvClient(glslang::EShClientVulkan, glslang::EShTargetVulkan_1_0);
    s.setEnvTarget(glslang::EShTargetSpv, glslang::EShTargetSpv_1_0);
    s.setAutoMapLocations(true);
    s.setAutoMapBindings(true);
    s.setGlobalUniformBlockName("pot_Uniforms");
    s.setGlobalUniformSet(0);
    s.setGlobalUniformBinding(0);
}

bool CompileProgram(const std::string& vs, const std::string& fs, Target target, CompiledProgram& out) {
    std::call_once(g_init, [] { glslang::InitializeProcess(); });
    const EShMessages msg = (EShMessages)(EShMsgSpvRules | EShMsgVulkanRules);
    const char* vsrc[] = {vs.c_str()};
    const char* fsrc[] = {fs.c_str()};
    auto vsh = std::make_unique<glslang::TShader>(EShLangVertex);
    auto fsh = std::make_unique<glslang::TShader>(EShLangFragment);
    SetupShader(*vsh, EShLangVertex, vsrc);
    SetupShader(*fsh, EShLangFragment, fsrc);
    const TBuiltInResource* res = GetDefaultResources();
    bool ok = true;
    if (!vsh->parse(res, 310, false, msg)) {
        out.error += std::string("[vertex]\n") + vsh->getInfoLog();
        ok = false;
    }
    if (!fsh->parse(res, 310, false, msg)) {
        out.error += std::string("[fragment]\n") + fsh->getInfoLog();
        ok = false;
    }
    if (!ok) return false;
    glslang::TProgram prog;
    prog.addShader(vsh.get());
    prog.addShader(fsh.get());
    if (!prog.link(msg)) {
        out.error = std::string("[link]\n") + prog.getInfoLog();
        return false;
    }
    if (!prog.mapIO()) {
        out.error = std::string("[mapIO]\n") + prog.getInfoLog();
        return false;
    }
    glslang::SpvOptions opt;
    opt.disableOptimizer = true;
    glslang::GlslangToSpv(*prog.getIntermediate(EShLangVertex), out.vsSpirv, &opt);
    glslang::GlslangToSpv(*prog.getIntermediate(EShLangFragment), out.fsSpirv, &opt);
    std::string err;
    try {
        auto vsc = MakeCompiler(out.vsSpirv, target);
        auto fsc = MakeCompiler(out.fsSpirv, target);
        if (!LinkVaryings(*vsc, *fsc, err)) { out.error = "[link] " + err; return false; }
        out.vsCode = Finish(*vsc, target, out.vs, err);
        if (!err.empty()) { out.error = "[vertex] " + err; return false; }
        out.fsCode = Finish(*fsc, target, out.fs, err);
        if (!err.empty()) { out.error = "[fragment] " + err; return false; }
    } catch (const std::exception& e) {
        out.error = std::string("SPIRV-Cross: ") + e.what();
        return false;
    }
    return true;
}

static void StageJson(std::string& o, const StageReflection& r) {
    o += "{\"size\":" + std::to_string(r.blockSize) + ",\"members\":[";
    for (size_t i = 0; i < r.members.size(); i++) {
        const auto& m = r.members[i];
        if (i) o += ",";
        o += "{\"name\":\"" + JsonEscape(m.name) + "\",\"offset\":" + std::to_string(m.offset) + ",\"base\":\"" + m.base +
             "\",\"vec\":" + std::to_string(m.vecsize) + ",\"cols\":" + std::to_string(m.columns) +
             ",\"array\":" + std::to_string(m.arraySize) + ",\"arrayStride\":" + std::to_string(m.arrayStride) +
             ",\"matrixStride\":" + std::to_string(m.matrixStride) + "}";
    }
    o += "],\"textures\":[";
    for (size_t i = 0; i < r.textures.size(); i++) {
        if (i) o += ",";
        o += "{\"name\":\"" + JsonEscape(r.textures[i].first) + "\",\"slot\":" + std::to_string(r.textures[i].second) + "}";
    }
    o += "]}";
}

std::string ReflectionJson(const CompiledProgram& p) {
    std::string o = "{\"vs\":";
    StageJson(o, p.vs);
    o += ",\"fs\":";
    StageJson(o, p.fs);
    o += "}";
    return o;
}

}  // namespace pot
