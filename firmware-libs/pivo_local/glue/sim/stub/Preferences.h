#pragma once
#include <cstddef>
#include <cstdint>
struct Preferences {
  bool begin(const char*, bool) { return false; }  // NVS vazia: usa os padroes do glue
  void end() {}
  size_t getBytesLength(const char*) { return 0; } size_t getBytes(const char*, void*, size_t) { return 0; }
  uint8_t getUChar(const char*, uint8_t d) { return d; } uint32_t getUInt(const char*, uint32_t d) { return d; }
  bool getBool(const char*, bool d) { return d; } float getFloat(const char*, float d) { return d; }
  uint16_t getUShort(const char*, uint16_t d) { return d; } void putUShort(const char*, uint16_t) {}
  size_t getString(const char*, char* b, size_t) { if (b) b[0] = 0; return 0; }
  void putBytes(const char*, const void*, size_t) {} void putUChar(const char*, uint8_t) {} void putUInt(const char*, uint32_t) {}
  void putBool(const char*, bool) {} void putFloat(const char*, float) {} void putString(const char*, const char*) {}
};
