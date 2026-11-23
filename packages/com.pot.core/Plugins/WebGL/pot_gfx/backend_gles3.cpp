// pot_gfx GLES3 后端（WebGL2 / Android GLES3）：游戏的 GLSL ES 310 源码改成 300 es 直接交给驱动编译，
// 统一变量用 glGetActiveUniform 反射、逐个 glUniform* 上传，在 Unity 当前绑定的帧缓冲上绘制。
//
// 与 D3D11 后端的约定差异（C# 已按图形 API 处理，这里不再补偿）：
// - 不翻转 y、不用 reversed Z（flags 里不会出现 F_ReversedZ），深度函数 LEQUAL；
// - gl_FragCoord 原点在左下（D3D11 在左上）；
// - 采样器 bit4（sRGB 视图）忽略：GL 贴图的 sRGB 由内部格式决定，采样时自动解码。
//
// 线程：CreateProgram 直接在调用线程编译，要求调用时 GL 上下文是当前的（WebGL 单线程满足）。
// Android 多线程渲染下需要改成推迟到渲染线程编译，见 docs/001 缺口表。
#include <GLES3/gl3.h>
#if defined(__EMSCRIPTEN__)
#include <emscripten.h>
#endif

#include <mutex>
#include <string>
#include <unordered_map>
#include <vector>

#include "backend.h"

namespace pot {

struct UniformGL {
    GLint loc = -1;
    GLenum type = 0;
    int count = 1;
    int offset = 0;  // 在 C# 打包的块里的字节偏移（紧凑排列，即 glUniform*v 需要的布局）
};

struct SamplerGL {
    GLenum target = GL_TEXTURE_2D;
    bool shadow = false;
};

struct ProgramGL {
    GLuint prog = 0;
    int blockSize = 0;
    std::vector<UniformGL> uniforms;
    std::vector<SamplerGL> samplers;  // 下标即贴图单元
};

// 把 Runner 预置的 "#version 310 es" 换成 300 es，并补上 300 es 片元阶段没有默认精度的采样器类型
static std::string ToEs300(const std::string& src) {
    std::string body = src;
    size_t start = body.find_first_not_of(" \t\r\n");
    if (start != std::string::npos && body.compare(start, 8, "#version") == 0) {
        size_t eol = body.find('\n', start);
        body = eol == std::string::npos ? std::string() : body.substr(eol + 1);
    }
    return "#version 300 es\n"
           "precision highp float;\nprecision highp int;\n"
           "precision highp sampler2D;\nprecision highp samplerCube;\nprecision highp sampler3D;\n"
           "precision highp sampler2DArray;\nprecision highp sampler2DShadow;\nprecision highp samplerCubeShadow;\n"
           "#line 1\n" +
           body;
}

// 统一变量类型 → (基础类型, 行数, 列数)
static bool UniformShape(GLenum t, char& base, int& vec, int& cols) {
    base = 'f';
    cols = 1;
    switch (t) {
        case GL_FLOAT: vec = 1; return true;
        case GL_FLOAT_VEC2: vec = 2; return true;
        case GL_FLOAT_VEC3: vec = 3; return true;
        case GL_FLOAT_VEC4: vec = 4; return true;
        case GL_INT: case GL_BOOL: base = 'i'; vec = 1; return true;
        case GL_INT_VEC2: case GL_BOOL_VEC2: base = 'i'; vec = 2; return true;
        case GL_INT_VEC3: case GL_BOOL_VEC3: base = 'i'; vec = 3; return true;
        case GL_INT_VEC4: case GL_BOOL_VEC4: base = 'i'; vec = 4; return true;
        case GL_UNSIGNED_INT: base = 'u'; vec = 1; return true;
        case GL_UNSIGNED_INT_VEC2: base = 'u'; vec = 2; return true;
        case GL_UNSIGNED_INT_VEC3: base = 'u'; vec = 3; return true;
        case GL_UNSIGNED_INT_VEC4: base = 'u'; vec = 4; return true;
        case GL_FLOAT_MAT2: vec = 2; cols = 2; return true;
        case GL_FLOAT_MAT3: vec = 3; cols = 3; return true;
        case GL_FLOAT_MAT4: vec = 4; cols = 4; return true;
        case GL_FLOAT_MAT2x3: vec = 3; cols = 2; return true;
        case GL_FLOAT_MAT2x4: vec = 4; cols = 2; return true;
        case GL_FLOAT_MAT3x2: vec = 2; cols = 3; return true;
        case GL_FLOAT_MAT3x4: vec = 4; cols = 3; return true;
        case GL_FLOAT_MAT4x2: vec = 2; cols = 4; return true;
        case GL_FLOAT_MAT4x3: vec = 3; cols = 4; return true;
        default: return false;
    }
}

static bool SamplerShape(GLenum t, SamplerGL& s) {
    switch (t) {
        case GL_SAMPLER_2D: case GL_INT_SAMPLER_2D: case GL_UNSIGNED_INT_SAMPLER_2D: s.target = GL_TEXTURE_2D; return true;
        case GL_SAMPLER_2D_SHADOW: s.target = GL_TEXTURE_2D; s.shadow = true; return true;
        case GL_SAMPLER_CUBE: case GL_INT_SAMPLER_CUBE: case GL_UNSIGNED_INT_SAMPLER_CUBE: s.target = GL_TEXTURE_CUBE_MAP; return true;
        case GL_SAMPLER_CUBE_SHADOW: s.target = GL_TEXTURE_CUBE_MAP; s.shadow = true; return true;
        case GL_SAMPLER_3D: case GL_INT_SAMPLER_3D: case GL_UNSIGNED_INT_SAMPLER_3D: s.target = GL_TEXTURE_3D; return true;
        case GL_SAMPLER_2D_ARRAY: case GL_INT_SAMPLER_2D_ARRAY: case GL_UNSIGNED_INT_SAMPLER_2D_ARRAY: s.target = GL_TEXTURE_2D_ARRAY; return true;
        case GL_SAMPLER_2D_ARRAY_SHADOW: s.target = GL_TEXTURE_2D_ARRAY; s.shadow = true; return true;
        default: return false;
    }
}

constexpr int kMaxUnits = 16;

struct SavedGL {
    GLint program = 0, vao = 0, arrayBuffer = 0, activeTexture = GL_TEXTURE0;
    GLint tex2D[kMaxUnits] = {}, texCube[kMaxUnits] = {}, tex3D[kMaxUnits] = {}, tex2DArray[kMaxUnits] = {}, sampler[kMaxUnits] = {};
    int units = 0;
    GLboolean blend = 0, depthTest = 0, cull = 0, stencil = 0, depthMask = 0;
    GLint srcRGB = 0, dstRGB = 0, srcA = 0, dstA = 0, eqRGB = 0, eqA = 0;
    GLint depthFunc = 0, cullMode = 0, frontFace = 0;
    GLboolean polyOffset = 0;
    GLfloat polyFactor = 0, polyUnits = 0;
    GLboolean colorMask[4] = {1, 1, 1, 1};
    GLfloat attr[kAttrCount][4] = {};
};

class BackendGLES3 : public Backend {
public:
    const char* Name() const override { return "gles3"; }
    Target ShaderTarget() const override { return Target::GLSLES300; }

    bool CreateProgram(int id, CompiledProgram& p, std::string& err) override {
        std::string vsrc = ToEs300(p.vsCode), fsrc = ToEs300(p.fsCode);
        GLuint vs = Compile(GL_VERTEX_SHADER, vsrc, "[vertex] ", err);
        if (!vs) return false;
        GLuint fs = Compile(GL_FRAGMENT_SHADER, fsrc, "[fragment] ", err);
        if (!fs) { glDeleteShader(vs); return false; }
        GLuint prog = glCreateProgram();
        glAttachShader(prog, vs);
        glAttachShader(prog, fs);
        glLinkProgram(prog);
        glDeleteShader(vs);
        glDeleteShader(fs);
        GLint ok = 0;
        glGetProgramiv(prog, GL_LINK_STATUS, &ok);
        if (!ok) {
            err = "[link] " + ProgramLog(prog);
            glDeleteProgram(prog);
            return false;
        }

        ProgramGL pg;
        pg.prog = prog;
        p.vs = StageReflection();
        p.fs = StageReflection();
        GLint prevProg = 0;
        glGetIntegerv(GL_CURRENT_PROGRAM, &prevProg);
        glUseProgram(prog);
        GLint n = 0, maxLen = 0;
        glGetProgramiv(prog, GL_ACTIVE_UNIFORMS, &n);
        glGetProgramiv(prog, GL_ACTIVE_UNIFORM_MAX_LENGTH, &maxLen);
        std::vector<char> buf((size_t)(maxLen > 0 ? maxLen : 1) + 1);
        int offset = 0;
        for (GLint i = 0; i < n; i++) {
            GLsizei len = 0;
            GLint size = 0;
            GLenum type = 0;
            glGetActiveUniform(prog, (GLuint)i, (GLsizei)buf.size(), &len, &size, &type, buf.data());
            std::string name(buf.data(), (size_t)len);
            GLint loc = glGetUniformLocation(prog, name.c_str());
            if (loc < 0) continue;  // 统一块里的成员（游戏没用到）
            bool isArray = name.size() > 3 && name.compare(name.size() - 3, 3, "[0]") == 0;
            if (isArray) name.resize(name.size() - 3);
            if (name.find('.') != std::string::npos || name.find('[') != std::string::npos) continue;  // 结构体成员不支持
            SamplerGL s;
            if (SamplerShape(type, s)) {
                int unit = (int)pg.samplers.size();
                if (unit >= kMaxUnits) continue;
                glUniform1i(loc, unit);
                pg.samplers.push_back(s);
                p.fs.textures.emplace_back(name, unit);
                continue;
            }
            UniformMember m;
            if (!UniformShape(type, m.base, m.vecsize, m.columns)) continue;
            m.name = name;
            m.offset = offset;
            m.matrixStride = m.columns > 1 ? m.vecsize * 4 : 0;
            int elem = m.vecsize * m.columns * 4;
            if (isArray || size > 1) {
                m.arraySize = size;
                m.arrayStride = elem;
            }
            UniformGL u;
            u.loc = loc;
            u.type = type;
            u.count = size > 0 ? size : 1;
            u.offset = offset;
            pg.uniforms.push_back(u);
            p.fs.members.push_back(m);
            offset += elem * u.count;
        }
        glUseProgram((GLuint)prevProg);
        // 成员都放在片元阶段（GL 的统一变量属于整个程序），顶点阶段为空块
        p.fs.blockSize = offset;
        pg.blockSize = offset;
        std::lock_guard<std::mutex> lock(mutex_);
        programs_[id] = pg;
        return true;
    }

    void DestroyProgram(int id) override {
        std::lock_guard<std::mutex> lock(mutex_);
        pendingDelete_.push_back(id);
    }

    void Shutdown() override {
        std::lock_guard<std::mutex> lock(mutex_);
        for (auto& kv : programs_) glDeleteProgram(kv.second.prog);
        programs_.clear();
        for (auto& kv : samplers_) glDeleteSamplers(1, &kv.second);
        samplers_.clear();
        if (vao_) glDeleteVertexArrays(1, &vao_);
        vao_ = 0;
        if (fbo_) glDeleteFramebuffers(1, &fbo_);
        fbo_ = 0;
    }

    void Render(const uint8_t* data, size_t len) override {
        std::lock_guard<std::mutex> lock(mutex_);
        for (int id : pendingDelete_) {
            auto it = programs_.find(id);
            if (it != programs_.end()) {
                glDeleteProgram(it->second.prog);
                programs_.erase(it);
            }
        }
        pendingDelete_.clear();

        Reader r{data, data + len};
        int count = r.i32();
        if (!r.ok || count <= 0) { targetTex_ = 0; return; }
        if (!vao_) glGenVertexArrays(1, &vao_);

        SavedGL saved;
        Save(saved);
        // 指定了输出贴图：绑定自己的 FBO 与视口（Unity 的 SetRenderTarget 在 GL 上要到它自己下一次绘制才生效）
        const GLuint target = targetTex_;
        const int tw = targetW_, th = targetH_;
        targetTex_ = 0;
        GLint prevFbo = 0, prevVp[4] = {0, 0, 0, 0};
        if (target) {
            glGetIntegerv(GL_FRAMEBUFFER_BINDING, &prevFbo);
            glGetIntegerv(GL_VIEWPORT, prevVp);
            if (!fbo_) glGenFramebuffers(1, &fbo_);
            glBindFramebuffer(GL_FRAMEBUFFER, fbo_);
            glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_TEXTURE_2D, target, 0);
            const GLenum buf = GL_COLOR_ATTACHMENT0;
            glDrawBuffers(1, &buf);
            glViewport(0, 0, tw, th);
        }
        glBindVertexArray(vao_);
        glColorMask(GL_TRUE, GL_TRUE, GL_TRUE, GL_TRUE);
        glDisable(GL_STENCIL_TEST);
        int unitsUsed = 0;

        for (int d = 0; d < count && r.ok; d++) {
            int program = r.i32();
            uint32_t flags = (uint32_t)r.i32();
            GLuint vb = (GLuint)(uintptr_t)r.i64();
            GLuint ib = (GLuint)(uintptr_t)r.i64();
            int stride = r.i32();
            int index32 = r.i32();
            int indexStart = r.i32();
            int indexCount = r.i32();
            int baseVertex = r.i32();
            int offsets[kAttrCount], formats[kAttrCount];
            for (int i = 0; i < kAttrCount; i++) offsets[i] = r.i32();
            for (int i = 0; i < kAttrCount; i++) formats[i] = r.i32();
            GLuint instVB = (GLuint)(uintptr_t)r.i64();
            int instStride = r.i32();
            int instCount = r.i32();
            if (!instVB || instStride <= 0) instCount = 0;
            int texCount = r.i32();
            struct Tex { int slot, sampler; GLuint tex; };
            Tex texs[kMaxUnits];
            int nt = 0;
            for (int i = 0; i < texCount && r.ok; i++) {
                Tex t;
                t.slot = r.i32();
                t.sampler = r.i32();
                t.tex = (GLuint)(uintptr_t)r.i64();
                if (nt < kMaxUnits) texs[nt++] = t;
            }
            int vsBytes = r.i32();
            r.bytes(vsBytes);
            int fsBytes = r.i32();
            const uint8_t* fsData = r.bytes(fsBytes);
            if (!r.ok) break;

            auto it = programs_.find(program);
            if (it == programs_.end() || !vb || !ib || indexCount <= 0) continue;
            ProgramGL& prog = it->second;
            glUseProgram(prog.prog);
            Upload(prog, fsData, fsBytes);

            // 顶点属性：GLES3/WebGL2 没有 baseVertex 绘制，改为把属性指针整体偏移 baseVertex 个顶点
            glBindBuffer(GL_ARRAY_BUFFER, vb);
            const size_t base = (size_t)(baseVertex > 0 ? baseVertex : 0) * (size_t)stride;
            bool anyInst = false;
            for (int i = 0; i < kAttrCount; i++) {
                GLint comps;
                GLenum type;
                GLboolean norm = GL_FALSE;
                bool inst = (formats[i] & AF_Instance) != 0;
                if ((inst && instCount <= 0) || !AttrGL(formats[i] & ~AF_Instance, comps, type, norm) || offsets[i] < 0) {
                    glDisableVertexAttribArray((GLuint)i);
                    glVertexAttribDivisor((GLuint)i, 0);
                    static const float defaults[kBuiltinAttrs][4] = {{0, 0, 0, 1}, {0, 1, 0, 0}, {0, 0, 0, 0}, {1, 1, 1, 1}, {1, 0, 0, 1}};
                    static const float zero[4] = {0, 0, 0, 0};
                    glVertexAttrib4fv((GLuint)i, i < kBuiltinAttrs ? defaults[i] : zero);
                    continue;
                }
                glEnableVertexAttribArray((GLuint)i);
                if (inst) {
                    // 实例属性：每个实例前进一步，不受 baseVertex 影响
                    glBindBuffer(GL_ARRAY_BUFFER, instVB);
                    glVertexAttribPointer((GLuint)i, comps, type, norm, instStride, (const void*)(size_t)offsets[i]);
                    glVertexAttribDivisor((GLuint)i, 1);
                    glBindBuffer(GL_ARRAY_BUFFER, vb);
                    anyInst = true;
                } else {
                    glVertexAttribPointer((GLuint)i, comps, type, norm, stride, (const void*)(base + (size_t)offsets[i]));
                    glVertexAttribDivisor((GLuint)i, 0);
                }
            }
            glBindBuffer(GL_ELEMENT_ARRAY_BUFFER, ib);

            for (int i = 0; i < nt; i++) {
                int unit = texs[i].slot;
                if (unit < 0 || unit >= (int)prog.samplers.size()) continue;
                const SamplerGL& s = prog.samplers[(size_t)unit];
                SaveUnit(saved, unit, unitsUsed);
                glActiveTexture(GL_TEXTURE0 + (GLenum)unit);
                glBindTexture(s.target, texs[i].tex);
                glBindSampler((GLuint)unit, Sampler(texs[i].sampler & 15, s.shadow));
            }

            ApplyState(flags);
            const size_t isz = index32 ? 4 : 2;
            const GLenum itype = index32 ? GL_UNSIGNED_INT : GL_UNSIGNED_SHORT;
            const void* ioff = (const void*)((size_t)indexStart * isz);
            if (anyInst && instCount > 0)
                glDrawElementsInstanced(GL_TRIANGLES, indexCount, itype, ioff, instCount);
            else
                glDrawElements(GL_TRIANGLES, indexCount, itype, ioff);
        }
        // 自己的 VAO 上 divisor 复位，下一帧未用到的属性不会残留实例步进
        for (int i = 0; i < kAttrCount; i++) glVertexAttribDivisor((GLuint)i, 0);

        Restore(saved);
        if (target) {
            // 解除附件，避免这张贴图之后被采样时与本 FBO 形成反馈环
            glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_TEXTURE_2D, 0, 0);
            glBindFramebuffer(GL_FRAMEBUFFER, (GLuint)prevFbo);
            glViewport(prevVp[0], prevVp[1], prevVp[2], prevVp[3]);
        }
    }

    void SetNextTarget(int64_t tex, int width, int height) override {
        targetTex_ = (GLuint)(uintptr_t)tex;
        targetW_ = width;
        targetH_ = height;
    }

private:
    std::mutex mutex_;
    std::unordered_map<int, ProgramGL> programs_;
    std::vector<int> pendingDelete_;
    std::unordered_map<int, GLuint> samplers_;
    GLuint vao_ = 0;
    GLuint fbo_ = 0;
    GLuint targetTex_ = 0;
    int targetW_ = 0, targetH_ = 0;

    static std::string ShaderLog(GLuint s) {
        GLint n = 0;
        glGetShaderiv(s, GL_INFO_LOG_LENGTH, &n);
        std::string log((size_t)(n > 0 ? n : 0), '\0');
        if (n > 0) glGetShaderInfoLog(s, n, nullptr, &log[0]);
        while (!log.empty() && log.back() == '\0') log.pop_back();
        return log;
    }

    static std::string ProgramLog(GLuint p) {
        GLint n = 0;
        glGetProgramiv(p, GL_INFO_LOG_LENGTH, &n);
        std::string log((size_t)(n > 0 ? n : 0), '\0');
        if (n > 0) glGetProgramInfoLog(p, n, nullptr, &log[0]);
        while (!log.empty() && log.back() == '\0') log.pop_back();
        return log;
    }

    // 属性的当前值（未启用数组时使用）。emscripten 的 glGetVertexAttribfv 在该属性启用了客户端数组
    // （Unity WebGL 会用）时只报错不返回数据，WebGL 下直接问浏览器。
    static void CurrentAttrib(GLuint i, float out[4]) {
#if defined(__EMSCRIPTEN__)
        EM_ASM({
            var v = GLctx.getVertexAttrib($0, 0x8626);
            for (var k = 0; k < 4; k++) HEAPF32[($1 >> 2) + k] = v ? v[k] : (k == 3 ? 1 : 0);
        }, i, out);
#else
        glGetVertexAttribfv(i, GL_CURRENT_VERTEX_ATTRIB, out);
#endif
    }

    // WebGL：emscripten 的 glShaderSource 会先用 JS 实现的 C 预处理器（preprocess_c_code）改写源码，
    // 嵌套的函数式宏（如 sat(max(max(a, b), c))）会被展开坏，导致驱动报 'max' 无匹配重载。
    // 源码不依赖它支持的 layout(location/binding) 统一变量扩展，直接交给浏览器原生 shaderSource。
    static void ShaderSource(GLuint s, const std::string& src) {
#if defined(__EMSCRIPTEN__)
        // 补上 glShaderSource 本该挂上的字段（glLinkProgram 会读取）
        EM_ASM({
            var sh = GL.shaders[$0];
            GLctx.shaderSource(sh, UTF8ToString($1));
            sh.explicitUniformLocations = {};
            sh.explicitSamplerBindings = {};
            sh.explicitUniformBindings = {};
        }, s, src.c_str());
#else
        const char* p = src.c_str();
        glShaderSource(s, 1, &p, nullptr);
#endif
    }

    static GLuint Compile(GLenum stage, const std::string& src, const char* tag, std::string& err) {
        GLuint s = glCreateShader(stage);
        ShaderSource(s, src);
        glCompileShader(s);
        GLint ok = 0;
        glGetShaderiv(s, GL_COMPILE_STATUS, &ok);
        if (!ok) {
            err = std::string(tag) + ShaderLog(s);
            glDeleteShader(s);
            return 0;
        }
        return s;
    }

    static bool AttrGL(int f, GLint& comps, GLenum& type, GLboolean& norm) {
        norm = GL_FALSE;
        switch (f) {
            case AF_Float1: comps = 1; type = GL_FLOAT; return true;
            case AF_Float2: comps = 2; type = GL_FLOAT; return true;
            case AF_Float3: comps = 3; type = GL_FLOAT; return true;
            case AF_Float4: comps = 4; type = GL_FLOAT; return true;
            case AF_UNorm8x4: comps = 4; type = GL_UNSIGNED_BYTE; norm = GL_TRUE; return true;
            case AF_Half2: comps = 2; type = GL_HALF_FLOAT; return true;
            case AF_Half4: comps = 4; type = GL_HALF_FLOAT; return true;
            default: return false;
        }
    }

    static void Upload(const ProgramGL& prog, const uint8_t* data, int bytes) {
        if (!data) return;
        for (const auto& u : prog.uniforms) {
            const void* p = data + u.offset;
            const GLfloat* f = (const GLfloat*)p;
            const GLint* i = (const GLint*)p;
            const GLuint* ui = (const GLuint*)p;
            GLsizei n = u.count;
            char base;
            int vec, cols;
            UniformShape(u.type, base, vec, cols);
            if (u.offset + vec * cols * 4 * n > bytes) continue;
            switch (u.type) {
                case GL_FLOAT: glUniform1fv(u.loc, n, f); break;
                case GL_FLOAT_VEC2: glUniform2fv(u.loc, n, f); break;
                case GL_FLOAT_VEC3: glUniform3fv(u.loc, n, f); break;
                case GL_FLOAT_VEC4: glUniform4fv(u.loc, n, f); break;
                case GL_INT: case GL_BOOL: glUniform1iv(u.loc, n, i); break;
                case GL_INT_VEC2: case GL_BOOL_VEC2: glUniform2iv(u.loc, n, i); break;
                case GL_INT_VEC3: case GL_BOOL_VEC3: glUniform3iv(u.loc, n, i); break;
                case GL_INT_VEC4: case GL_BOOL_VEC4: glUniform4iv(u.loc, n, i); break;
                case GL_UNSIGNED_INT: glUniform1uiv(u.loc, n, ui); break;
                case GL_UNSIGNED_INT_VEC2: glUniform2uiv(u.loc, n, ui); break;
                case GL_UNSIGNED_INT_VEC3: glUniform3uiv(u.loc, n, ui); break;
                case GL_UNSIGNED_INT_VEC4: glUniform4uiv(u.loc, n, ui); break;
                case GL_FLOAT_MAT2: glUniformMatrix2fv(u.loc, n, GL_FALSE, f); break;
                case GL_FLOAT_MAT3: glUniformMatrix3fv(u.loc, n, GL_FALSE, f); break;
                case GL_FLOAT_MAT4: glUniformMatrix4fv(u.loc, n, GL_FALSE, f); break;
                case GL_FLOAT_MAT2x3: glUniformMatrix2x3fv(u.loc, n, GL_FALSE, f); break;
                case GL_FLOAT_MAT2x4: glUniformMatrix2x4fv(u.loc, n, GL_FALSE, f); break;
                case GL_FLOAT_MAT3x2: glUniformMatrix3x2fv(u.loc, n, GL_FALSE, f); break;
                case GL_FLOAT_MAT3x4: glUniformMatrix3x4fv(u.loc, n, GL_FALSE, f); break;
                case GL_FLOAT_MAT4x2: glUniformMatrix4x2fv(u.loc, n, GL_FALSE, f); break;
                case GL_FLOAT_MAT4x3: glUniformMatrix4x3fv(u.loc, n, GL_FALSE, f); break;
                default: break;
            }
        }
    }

    GLuint Sampler(int code, bool shadow) {
        int key = code | (shadow ? 32 : 0);
        auto it = samplers_.find(key);
        if (it != samplers_.end()) return it->second;
        GLuint s = 0;
        glGenSamplers(1, &s);
        int filter = (code >> 1) & 3;
        GLint mag = filter == 0 ? GL_NEAREST : GL_LINEAR;
        GLint min = filter == 0 ? GL_NEAREST : filter == 1 ? GL_LINEAR : GL_LINEAR_MIPMAP_LINEAR;
        glSamplerParameteri(s, GL_TEXTURE_MIN_FILTER, min);
        glSamplerParameteri(s, GL_TEXTURE_MAG_FILTER, mag);
        GLint wrap = (code & 1) ? GL_CLAMP_TO_EDGE : GL_REPEAT;
        glSamplerParameteri(s, GL_TEXTURE_WRAP_S, wrap);
        glSamplerParameteri(s, GL_TEXTURE_WRAP_T, wrap);
        glSamplerParameteri(s, GL_TEXTURE_WRAP_R, wrap);
        // 采样器对象会覆盖贴图自身的比较模式：普通 sampler2D 读深度贴图时必须关掉比较
        glSamplerParameteri(s, GL_TEXTURE_COMPARE_MODE, shadow ? GL_COMPARE_REF_TO_TEXTURE : GL_NONE);
        glSamplerParameteri(s, GL_TEXTURE_COMPARE_FUNC, GL_LEQUAL);
        samplers_[key] = s;
        return s;
    }

    static void ApplyState(uint32_t flags) {
        int cull = (int)(flags & F_CullMask);
        if (cull == 2) {
            glDisable(GL_CULL_FACE);
        } else {
            glEnable(GL_CULL_FACE);
            glCullFace(cull == 0 ? GL_BACK : GL_FRONT);
        }
        // Unity 网格正面为顺时针（Unity 自己在 GL 上也用 glFrontFace(GL_CW)）。GL 不翻转渲染目标，
        // C# 在 GL 上不会置 F_FrontCCW；若置了（翻转投影）则与 D3D 一样改为逆时针
        glFrontFace((flags & F_FrontCCW) ? GL_CCW : GL_CW);
        if (flags & F_NoDepthTest) {
            glDisable(GL_DEPTH_TEST);
        } else {
            glEnable(GL_DEPTH_TEST);
            glDepthFunc((flags & F_ReversedZ) ? GL_GEQUAL : GL_LEQUAL);
        }
        glDepthMask((flags & F_DepthWrite) ? GL_TRUE : GL_FALSE);
        int of = OffsetFactor(flags), ou = OffsetUnits(flags);
        if (of != 0 || ou != 0) {
            glEnable(GL_POLYGON_OFFSET_FILL);
            float sign = (flags & F_ReversedZ) ? -1.0f : 1.0f;
            glPolygonOffset(sign * (float)of, sign * (float)ou);
        } else {
            glDisable(GL_POLYGON_OFFSET_FILL);
        }
        int mode = (int)((flags >> F_BlendShift) & 3);
        if (mode == 0) {
            glDisable(GL_BLEND);
        } else {
            glEnable(GL_BLEND);
            glBlendEquationSeparate(GL_FUNC_ADD, GL_FUNC_ADD);
            GLenum src = mode == 3 ? GL_ONE : GL_SRC_ALPHA;
            GLenum dst = mode == 2 ? GL_ONE : GL_ONE_MINUS_SRC_ALPHA;
            glBlendFuncSeparate(src, dst, GL_ONE, dst);
        }
    }

    static void SaveUnit(SavedGL& s, int unit, int& used) {
        if (unit < used) return;
        for (int u = used; u <= unit; u++) {
            glActiveTexture(GL_TEXTURE0 + (GLenum)u);
            glGetIntegerv(GL_TEXTURE_BINDING_2D, &s.tex2D[u]);
            glGetIntegerv(GL_TEXTURE_BINDING_CUBE_MAP, &s.texCube[u]);
            glGetIntegerv(GL_TEXTURE_BINDING_3D, &s.tex3D[u]);
            glGetIntegerv(GL_TEXTURE_BINDING_2D_ARRAY, &s.tex2DArray[u]);
            glGetIntegerv(GL_SAMPLER_BINDING, &s.sampler[u]);
        }
        used = unit + 1;
        s.units = used;
    }

    static void Save(SavedGL& s) {
        glGetIntegerv(GL_CURRENT_PROGRAM, &s.program);
        glGetIntegerv(GL_VERTEX_ARRAY_BINDING, &s.vao);
        glGetIntegerv(GL_ARRAY_BUFFER_BINDING, &s.arrayBuffer);
        glGetIntegerv(GL_ACTIVE_TEXTURE, &s.activeTexture);
        s.blend = glIsEnabled(GL_BLEND);
        s.depthTest = glIsEnabled(GL_DEPTH_TEST);
        s.cull = glIsEnabled(GL_CULL_FACE);
        s.stencil = glIsEnabled(GL_STENCIL_TEST);
        s.polyOffset = glIsEnabled(GL_POLYGON_OFFSET_FILL);
        glGetFloatv(GL_POLYGON_OFFSET_FACTOR, &s.polyFactor);
        glGetFloatv(GL_POLYGON_OFFSET_UNITS, &s.polyUnits);
        glGetBooleanv(GL_DEPTH_WRITEMASK, &s.depthMask);
        glGetBooleanv(GL_COLOR_WRITEMASK, s.colorMask);
        glGetIntegerv(GL_BLEND_SRC_RGB, &s.srcRGB);
        glGetIntegerv(GL_BLEND_DST_RGB, &s.dstRGB);
        glGetIntegerv(GL_BLEND_SRC_ALPHA, &s.srcA);
        glGetIntegerv(GL_BLEND_DST_ALPHA, &s.dstA);
        glGetIntegerv(GL_BLEND_EQUATION_RGB, &s.eqRGB);
        glGetIntegerv(GL_BLEND_EQUATION_ALPHA, &s.eqA);
        glGetIntegerv(GL_DEPTH_FUNC, &s.depthFunc);
        glGetIntegerv(GL_CULL_FACE_MODE, &s.cullMode);
        glGetIntegerv(GL_FRONT_FACE, &s.frontFace);
        for (int i = 0; i < kAttrCount; i++) CurrentAttrib((GLuint)i, s.attr[i]);
        s.units = 0;
    }

    static void SetEnabled(GLenum cap, GLboolean on) {
        if (on) glEnable(cap);
        else glDisable(cap);
    }

    static void Restore(const SavedGL& s) {
        for (int u = 0; u < s.units; u++) {
            glActiveTexture(GL_TEXTURE0 + (GLenum)u);
            glBindTexture(GL_TEXTURE_2D, (GLuint)s.tex2D[u]);
            glBindTexture(GL_TEXTURE_CUBE_MAP, (GLuint)s.texCube[u]);
            glBindTexture(GL_TEXTURE_3D, (GLuint)s.tex3D[u]);
            glBindTexture(GL_TEXTURE_2D_ARRAY, (GLuint)s.tex2DArray[u]);
            glBindSampler((GLuint)u, (GLuint)s.sampler[u]);
        }
        glActiveTexture((GLenum)s.activeTexture);
        glBindVertexArray((GLuint)s.vao);
        glBindBuffer(GL_ARRAY_BUFFER, (GLuint)s.arrayBuffer);
        for (int i = 0; i < kAttrCount; i++) glVertexAttrib4fv((GLuint)i, s.attr[i]);
        glUseProgram((GLuint)s.program);
        SetEnabled(GL_BLEND, s.blend);
        SetEnabled(GL_DEPTH_TEST, s.depthTest);
        SetEnabled(GL_CULL_FACE, s.cull);
        SetEnabled(GL_STENCIL_TEST, s.stencil);
        SetEnabled(GL_POLYGON_OFFSET_FILL, s.polyOffset);
        glPolygonOffset(s.polyFactor, s.polyUnits);
        glDepthMask(s.depthMask);
        glColorMask(s.colorMask[0], s.colorMask[1], s.colorMask[2], s.colorMask[3]);
        glBlendFuncSeparate((GLenum)s.srcRGB, (GLenum)s.dstRGB, (GLenum)s.srcA, (GLenum)s.dstA);
        glBlendEquationSeparate((GLenum)s.eqRGB, (GLenum)s.eqA);
        glDepthFunc((GLenum)s.depthFunc);
        glCullFace((GLenum)s.cullMode);
        glFrontFace((GLenum)s.frontFace);
    }
};

Backend* CreateBackendGLES3() { return new BackendGLES3(); }

}  // namespace pot
