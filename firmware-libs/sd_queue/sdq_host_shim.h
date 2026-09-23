// Shim de HOST para testar sd_buffer.cpp sem hardware: cartao SD em memoria (com injecao
// de falhas e de "queda de energia"), NVS (Preferences), millis(), Serial e contadores diag.
#pragma once
#include <stdint.h>
#include <stdio.h>
#include <stdarg.h>
#include <string>
#include <map>
#include <vector>
#include <memory>
#include <string.h>
#include <algorithm>

#define FILE_READ   "r"
#define FILE_APPEND "a"
#define SDQ_WDT() ((void)0)

// ---- relogio ----
extern unsigned long g_millis;
inline unsigned long millis() { return g_millis; }

// ---- serial ----
struct HostSerial {
    bool quiet = true;
    void printf(const char* fmt, ...) { if (quiet) return; va_list a; va_start(a, fmt); vprintf(fmt, a); va_end(a); }
    void println(const char* s = "") { if (!quiet) ::printf("%s\n", s); }
};
extern HostSerial Serial;

// ---- diag ----
extern bool     diag_sd_available;
extern uint32_t diag_sd_writes, diag_sd_resends, diag_sd_write_errors;

// ---- cartao em memoria ----
struct HostCard {
    std::map<std::string, std::string> files;
    std::map<std::string, bool> dirs;
    bool mounted = false;
    bool broken = false;          // cartao com defeito: nada abre, nao monta
    long writeCutAfter = -1;      // >=0: a PROXIMA escrita grava so' N bytes (queda de energia)
};
extern HostCard g_card;

class File {
public:
    File() {}
    File(const std::string& path, bool dir, size_t pos) : _path(path), _dir(dir), _pos(pos), _ok(true) {}
    explicit operator bool() const { return _ok; }
    bool isDirectory() { return _dir; }
    size_t size() { auto it = g_card.files.find(_path); return it == g_card.files.end() ? 0 : it->second.size(); }
    bool seek(uint32_t p) { _pos = p; return true; }
    int read() { auto& s = g_card.files[_path]; if (_pos >= s.size()) return -1; return (uint8_t)s[_pos++]; }
    int read(uint8_t* b, size_t n) {
        auto& s = g_card.files[_path];
        if (_pos >= s.size()) return 0;
        size_t k = std::min(n, s.size() - _pos);
        memcpy(b, s.data() + _pos, k); _pos += k; return (int)k;
    }
    size_t write(const uint8_t* b, size_t n) {
        if (g_card.broken) return 0;
        size_t k = n;
        if (g_card.writeCutAfter >= 0) { k = std::min(n, (size_t)g_card.writeCutAfter); g_card.writeCutAfter = -1; }
        g_card.files[_path].append((const char*)b, k); return k;
    }
    void close() { _ok = false; }
    const char* name() { return _name.c_str(); }
    File openNextFile() {
        if (!_dir) return File();
        std::string pre = _path + "/";
        size_t idx = 0;
        for (auto& kv : g_card.files) {
            if (kv.first.compare(0, pre.size(), pre) != 0) continue;
            if (idx++ == _iter) { _iter++; File f(kv.first, false, 0); f._name = kv.first.substr(pre.size()); return f; }
        }
        return File();
    }
private:
    std::string _path, _name;
    bool _dir = false;
    size_t _pos = 0, _iter = 0;
    bool _ok = false;
};

struct HostSD {
    File open(const char* path, const char* mode) {
        if (!g_card.mounted || g_card.broken) return File();
        std::string p(path);
        if (g_card.dirs.count(p)) return File(p, true, 0);
        if (std::string(mode) == FILE_APPEND) { auto& s = g_card.files[p]; return File(p, false, s.size()); }
        if (!g_card.files.count(p)) return File();
        return File(p, false, 0);
    }
    bool exists(const char* path) { std::string p(path); return g_card.mounted && (g_card.files.count(p) || g_card.dirs.count(p)); }
    bool remove(const char* path) { return g_card.files.erase(path) > 0; }
    bool rename(const char* a, const char* b) {
        auto it = g_card.files.find(a); if (it == g_card.files.end()) return false;
        g_card.files[b] = it->second; g_card.files.erase(a); return true;
    }
    bool mkdir(const char* path) { g_card.dirs[path] = true; return true; }
};
extern HostSD SD;

inline bool _sdMountHw() { if (g_card.broken) return false; g_card.mounted = true; return true; }
inline void _sdUnmountHw() { g_card.mounted = false; }

// ---- NVS ----
extern std::map<std::string, uint64_t> g_nvs;
struct Preferences {
    std::string ns;
    bool begin(const char* n, bool) { ns = n; return true; }
    void end() {}
    uint64_t getULong64(const char* k, uint64_t d) { auto it = g_nvs.find(ns + "/" + k); return it == g_nvs.end() ? d : it->second; }
    size_t putULong64(const char* k, uint64_t v) { g_nvs[ns + "/" + k] = v; return 8; }
};
