// pot_shaderc：离线检查着色器（与 Runner 内置同一套编译器）。
// 用法：pot_shaderc <vertex.glsl> <fragment.glsl> [--hlsl|--gles]
// 退出码 0 成功；输出反射 JSON（--hlsl/--gles 时另输出生成的源码）
#include <cstdio>
#include <fstream>
#include <iostream>
#include <sstream>
#include <string>

#include "compiler.h"

#ifdef _WIN32
#include <d3dcompiler.h>
#endif

static bool ReadFile(const char* path, std::string& out) {
    std::ifstream f(path, std::ios::binary);
    if (!f) return false;
    std::stringstream ss;
    ss << f.rdbuf();
    out = ss.str();
    return true;
}

int main(int argc, char** argv) {
    if (argc < 3) {
        std::cerr << "用法：pot_shaderc <vertex> <fragment> [--hlsl|--gles]\n";
        return 2;
    }
    std::string vs, fs;
    if (!ReadFile(argv[1], vs) || !ReadFile(argv[2], fs)) {
        std::cerr << "读取文件失败\n";
        return 2;
    }
    std::string mode = argc > 3 ? argv[3] : "";
    pot::Target target = mode == "--gles" ? pot::Target::GLSLES300 : pot::Target::HLSL50;
    pot::CompiledProgram p;
    if (!pot::CompileProgram(vs, fs, target, p)) {
        std::cerr << p.error << "\n";
        return 1;
    }
#ifdef _WIN32
    if (target == pot::Target::HLSL50) {
        const char* targets[2] = {"vs_5_0", "ps_5_0"};
        const std::string* srcs[2] = {&p.vsCode, &p.fsCode};
        for (int i = 0; i < 2; i++) {
            ID3DBlob *code = nullptr, *err = nullptr;
            HRESULT hr = D3DCompile(srcs[i]->data(), srcs[i]->size(), "pot", nullptr, nullptr, "main", targets[i], 0, 0, &code, &err);
            if (FAILED(hr)) {
                std::cerr << "[HLSL " << targets[i] << "] " << (err ? (const char*)err->GetBufferPointer() : "") << "\n";
                std::cerr << *srcs[i] << "\n";
                return 1;
            }
            if (code) code->Release();
            if (err) err->Release();
        }
    }
#endif
    if (!mode.empty()) std::cout << "----- vertex -----\n" << p.vsCode << "\n----- fragment -----\n" << p.fsCode << "\n";
    std::cout << pot::ReflectionJson(p) << "\n";
    return 0;
}
