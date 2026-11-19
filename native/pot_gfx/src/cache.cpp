#include "cache.h"

#include <atomic>
#include <cstdint>
#include <cstring>
#include <filesystem>
#include <fstream>
#include <mutex>
#include <system_error>
#include <vector>

namespace pot {

namespace fs = std::filesystem;

// 改动编译流程（编译选项、反射结构、依赖库版本）时递增，旧缓存自然失效
static const char* kCacheVersion = "pot_gfx-cache-2/glslang-15.0.0/spirv-cross-1.4.304.0/sm5-O3";
static const uint32_t kMagic = 0x43544f50;  // "POTC"
static const uint32_t kFormat = 1;

static std::mutex g_mutex;
static fs::path g_dir;
static bool g_enabled = false;
static std::atomic<int> g_hits{0}, g_misses{0};

void CacheSetDir(const std::string& dir) {
    std::lock_guard<std::mutex> lock(g_mutex);
    g_enabled = false;
    if (dir.empty()) return;
    std::error_code ec;
    fs::path p = fs::u8path(dir);
    fs::create_directories(p, ec);
    if (!fs::is_directory(p, ec)) return;
    g_dir = p;
    g_enabled = true;
}

bool CacheEnabled() {
    std::lock_guard<std::mutex> lock(g_mutex);
    return g_enabled;
}

static uint64_t Fnv(uint64_t h, const void* data, size_t n) {
    const uint8_t* p = (const uint8_t*)data;
    for (size_t i = 0; i < n; i++) {
        h ^= p[i];
        h *= 0x100000001b3ull;
    }
    return h;
}

std::string CacheKey(const char* backend, const std::string& vs, const std::string& fs) {
    // 两个不同种子的 64 位 FNV-1a 拼成 128 位，段之间插入长度防止拼接歧义
    std::string b = backend ? backend : "";
    uint64_t h[2] = {0xcbf29ce484222325ull, 0x84222325cbf29ce4ull};
    const std::string* parts[] = {&b, &vs, &fs};
    for (auto& x : h) {
        for (const std::string* s : parts) {
            uint64_t len = s->size();
            x = Fnv(x, &len, sizeof len);
            x = Fnv(x, s->data(), s->size());
        }
        x = Fnv(x, kCacheVersion, strlen(kCacheVersion));
    }
    char buf[40];
    snprintf(buf, sizeof buf, "%016llx%016llx", (unsigned long long)h[0], (unsigned long long)h[1]);
    return buf;
}

// ---------------- 序列化 ----------------

struct Writer {
    std::vector<uint8_t> out;
    void i32(int32_t v) { out.insert(out.end(), (uint8_t*)&v, (uint8_t*)&v + 4); }
    void bytes(const void* p, size_t n) {
        i32((int32_t)n);
        out.insert(out.end(), (const uint8_t*)p, (const uint8_t*)p + n);
    }
    void str(const std::string& s) { bytes(s.data(), s.size()); }
};

struct In {
    const uint8_t* p;
    const uint8_t* end;
    bool ok = true;
    int32_t i32() {
        if (end - p < 4) { ok = false; return 0; }
        int32_t v;
        memcpy(&v, p, 4);
        p += 4;
        return v;
    }
    bool bytes(std::vector<uint8_t>& v) {
        int32_t n = i32();
        if (!ok || n < 0 || end - p < n) { ok = false; return false; }
        v.assign(p, p + n);
        p += n;
        return true;
    }
    std::string str() {
        int32_t n = i32();
        if (!ok || n < 0 || end - p < n) { ok = false; return {}; }
        std::string s((const char*)p, (size_t)n);
        p += n;
        return s;
    }
};

static void WriteStage(Writer& w, const StageReflection& r) {
    w.i32(r.blockSize);
    w.i32(r.blockBinding);
    w.i32((int32_t)r.members.size());
    for (const auto& m : r.members) {
        w.str(m.name);
        w.i32(m.offset);
        w.i32(m.base);
        w.i32(m.vecsize);
        w.i32(m.columns);
        w.i32(m.arraySize);
        w.i32(m.arrayStride);
        w.i32(m.matrixStride);
    }
    w.i32((int32_t)r.textures.size());
    for (const auto& t : r.textures) {
        w.str(t.first);
        w.i32(t.second);
    }
}

static bool ReadStage(In& r, StageReflection& s) {
    s.blockSize = r.i32();
    s.blockBinding = r.i32();
    int n = r.i32();
    if (!r.ok || n < 0 || n > 4096) return false;
    s.members.resize(n);
    for (auto& m : s.members) {
        m.name = r.str();
        m.offset = r.i32();
        m.base = (char)r.i32();
        m.vecsize = r.i32();
        m.columns = r.i32();
        m.arraySize = r.i32();
        m.arrayStride = r.i32();
        m.matrixStride = r.i32();
    }
    int t = r.i32();
    if (!r.ok || t < 0 || t > 256) return false;
    s.textures.resize(t);
    for (auto& x : s.textures) {
        x.first = r.str();
        x.second = r.i32();
    }
    return r.ok;
}

bool CacheLoad(const std::string& key, CompiledProgram& p) {
    fs::path file;
    {
        std::lock_guard<std::mutex> lock(g_mutex);
        if (!g_enabled) return false;
        file = g_dir / (key + ".bin");
    }
    std::ifstream f(file, std::ios::binary);
    if (!f) return false;
    std::vector<uint8_t> data((std::istreambuf_iterator<char>(f)), std::istreambuf_iterator<char>());
    In r{data.data(), data.data() + data.size()};
    if (r.i32() != (int32_t)kMagic || r.i32() != (int32_t)kFormat) return false;
    CompiledProgram q;
    if (!ReadStage(r, q.vs) || !ReadStage(r, q.fs)) return false;
    if (!r.bytes(q.vsBin) || !r.bytes(q.fsBin) || q.vsBin.empty() || q.fsBin.empty()) return false;
    q.cached = true;
    p = std::move(q);
    return true;
}

void CacheStore(const std::string& key, const CompiledProgram& p) {
    if (p.vsBin.empty() || p.fsBin.empty()) return;
    fs::path dir;
    {
        std::lock_guard<std::mutex> lock(g_mutex);
        if (!g_enabled) return;
        dir = g_dir;
    }
    Writer w;
    w.i32((int32_t)kMagic);
    w.i32((int32_t)kFormat);
    WriteStage(w, p.vs);
    WriteStage(w, p.fs);
    w.bytes(p.vsBin.data(), p.vsBin.size());
    w.bytes(p.fsBin.data(), p.fsBin.size());
    // 先写临时文件再改名：进程中途退出不会留下半截文件
    std::error_code ec;
    fs::path tmp = dir / (key + ".tmp");
    fs::path file = dir / (key + ".bin");
    {
        std::ofstream f(tmp, std::ios::binary | std::ios::trunc);
        if (!f) return;
        f.write((const char*)w.out.data(), (std::streamsize)w.out.size());
        if (!f) {
            f.close();
            fs::remove(tmp, ec);
            return;
        }
    }
    fs::rename(tmp, file, ec);
    if (ec) fs::remove(tmp, ec);
}

void CacheStats(int& hits, int& misses) {
    hits = g_hits.load();
    misses = g_misses.load();
}

void CacheCount(bool hit) {
    if (hit) g_hits++;
    else g_misses++;
}

}  // namespace pot
