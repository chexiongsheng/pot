// 反射信息转 JSON（交给 C#）。独立于 compiler.cpp：WebGL 版不带 glslang/SPIRV-Cross，也要用到
#include <cstdio>
#include <string>

#include "compiler.h"

namespace pot {

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
