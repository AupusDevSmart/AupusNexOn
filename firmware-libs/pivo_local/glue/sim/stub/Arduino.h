#pragma once
#include <string>
#include <cstdio>
#include <cstring>
#include <cstdint>
#include <cstdarg>
#include <cmath>
extern unsigned long g_millis;
inline unsigned long millis() { return g_millis; }
inline void delay(unsigned long ms) { g_millis += ms; }
struct SerialT { void printf(const char* f, ...) { va_list a; va_start(a, f); vprintf(f, a); va_end(a); } void println(const char* s) { ::printf("%s\n", s); } };
extern SerialT Serial;
class String {
public:
  std::string s;
  String() {} String(const char* c) : s(c ? c : "") {} String(const std::string& x) : s(x) {}
  bool startsWith(const char* p) const { return s.rfind(p, 0) == 0; }
  bool endsWith(const char* p) const { size_t n = strlen(p); return s.size() >= n && s.compare(s.size() - n, n, p) == 0; }
  int indexOf(const char* p) const { size_t i = s.find(p); return i == std::string::npos ? -1 : (int)i; }
  String substring(size_t a) const { return a >= s.size() ? String("") : String(s.substr(a)); }
  void trim() { size_t a = s.find_first_not_of(" \t\r\n"), b = s.find_last_not_of(" \t\r\n"); s = a == std::string::npos ? "" : s.substr(a, b - a + 1); }
  const char* c_str() const { return s.c_str(); }
  bool operator==(const char* c) const { return s == c; }
  bool operator!=(const char* c) const { return s != c; }
};
