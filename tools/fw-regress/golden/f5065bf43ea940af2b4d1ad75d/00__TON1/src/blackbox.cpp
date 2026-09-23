// blackbox.cpp — ver blackbox.h. Sem barra invertida/crase/cifrao-chave: embutido
// literalmente num template JS das bases do gerador.
#include "blackbox.h"
#include <Arduino.h>
#include <ArduinoJson.h>
#include <Preferences.h>
#include <esp_system.h>
#include <esp_attr.h>
#include <time.h>
#include <stdarg.h>
#include <string.h>

#define BB_N          40
#define BB_MSG        44
#define BB_NVS_N      16
#define BB_MAGIC      0x42424F58UL
#define BB_NVS_MIN_MS 900000UL
#define BB_PAGE       10

struct BbEntry { uint32_t seq; uint32_t epoch; uint32_t up; char msg[BB_MSG]; };
struct BbRtc {
    uint32_t magic, seq, sent, boots;
    uint8_t  stage, pad[3];
    BbEntry  e[BB_N];
};
RTC_NOINIT_ATTR static BbRtc _bb;
static uint8_t  _stageAtReset = 0;
static const char* _resetTxt = "?";
static unsigned long _lastNvs = 0;
static bool _dirty = false;
static bool _ok = false;

static const char* const _stages[] = {
    "inicio", "rede_mqtt", "entradas", "modbus_rtu", "publicacao",
    "modbus_tcp", "posto", "sd", "ota", "outros"
};
const char* bb_stage_name(uint8_t s) { return s < 10 ? _stages[s] : "?"; }

static const char* _resetName(esp_reset_reason_t r) {
    switch (r) {
        case ESP_RST_POWERON:  return "Power-on";
        case ESP_RST_SW:       return "Software";
        case ESP_RST_PANIC:    return "Panic";
        case ESP_RST_INT_WDT:
        case ESP_RST_TASK_WDT:
        case ESP_RST_WDT:      return "Watchdog";
        case ESP_RST_BROWNOUT: return "Brownout";
        case ESP_RST_DEEPSLEEP: return "DeepSleep";
        default:               return "Unknown";
    }
}

static void _nvsSave() {
    Preferences p;
    if (!p.begin("bb", false)) return;
    BbEntry tmp[BB_NVS_N];
    memset(tmp, 0, sizeof(tmp));
    int k = 0;
    uint32_t from = (_bb.seq > BB_NVS_N) ? _bb.seq - BB_NVS_N + 1 : 1;
    for (uint32_t s = from; s <= _bb.seq && k < BB_NVS_N; s++) {
        const BbEntry& e = _bb.e[s % BB_N];
        if (e.seq == s) tmp[k++] = e;
    }
    p.putBytes("ev", tmp, sizeof(tmp));
    p.putULong("seq", _bb.seq);
    p.putULong("sent", _bb.sent);
    p.putULong("boots", _bb.boots);
    p.end();
    _lastNvs = millis();
    _dirty = false;
}

static void _nvsLoad() {
    Preferences p;
    if (!p.begin("bb", true)) return;
    _bb.seq = p.getULong("seq", 0);
    _bb.sent = p.getULong("sent", 0);
    _bb.boots = p.getULong("boots", 0);
    BbEntry tmp[BB_NVS_N];
    memset(tmp, 0, sizeof(tmp));
    if (p.getBytesLength("ev") == sizeof(tmp)) p.getBytes("ev", tmp, sizeof(tmp));
    p.end();
    for (int i = 0; i < BB_NVS_N; i++) {
        if (tmp[i].seq == 0) continue;
        tmp[i].msg[BB_MSG - 1] = 0;
        _bb.e[tmp[i].seq % BB_N] = tmp[i];
    }
}

void bb_init() {
    esp_reset_reason_t r = esp_reset_reason();
    _resetTxt = _resetName(r);
    bool rtcOk = (_bb.magic == BB_MAGIC) && r != ESP_RST_POWERON && r != ESP_RST_BROWNOUT;
    if (!rtcOk) {
        memset(&_bb, 0, sizeof(_bb));
        _bb.magic = BB_MAGIC;
        _nvsLoad();                                  // tirou da tomada: recupera do NVS
    }
    _stageAtReset = _bb.stage;
    _bb.boots++;
    _bb.stage = BB_INICIO;
    _ok = true;
    bool travou = (r == ESP_RST_TASK_WDT || r == ESP_RST_INT_WDT || r == ESP_RST_WDT || r == ESP_RST_PANIC);
    if (travou) bb_log("boot %lu %s etapa=%s", (unsigned long)_bb.boots, _resetTxt, bb_stage_name(_stageAtReset));
    else        bb_log("boot %lu %s", (unsigned long)_bb.boots, _resetTxt);
    _nvsSave();
}

void bb_log(const char* fmt, ...) {
    if (!_ok) return;
    _bb.seq++;
    BbEntry& e = _bb.e[_bb.seq % BB_N];
    e.seq = _bb.seq;
    time_t now = time(nullptr);
    e.epoch = (now > 1700000000) ? (uint32_t)now : 0;
    e.up = (uint32_t)(millis() / 1000UL);
    va_list a; va_start(a, fmt);
    vsnprintf(e.msg, sizeof(e.msg), fmt, a);
    va_end(a);
    for (char* c = e.msg; *c; c++) if (*c == 34 || *c == 92 || *c < 32) *c = 39;   // aspas/barra/controle -> apostrofo
    Serial.printf("[BB] %s", e.msg);
    Serial.println();
    _dirty = true;
    if (millis() - _lastNvs > BB_NVS_MIN_MS) _nvsSave();
}

void bb_stage(uint8_t s) { _bb.stage = s; }

void bb_flush() { if (_ok && _dirty) _nvsSave(); }

int bb_publish(bb_publish_fn pub, const char* topic_base, bool so_novos) {
    if (!_ok || !pub || !topic_base) return 0;
    uint32_t primeiro = (_bb.seq >= BB_N) ? _bb.seq - BB_N + 1 : 1;
    if (so_novos && _bb.sent + 1 > primeiro) primeiro = _bb.sent + 1;
    if (primeiro > _bb.seq) return 0;
    char topic[160];
    snprintf(topic, sizeof(topic), "%s/log", topic_base);
    int total = 0;
    uint32_t s = primeiro;
    while (s <= _bb.seq) {
        StaticJsonDocument<2048> doc;
        doc["boot"] = _bb.boots;
        doc["reset"] = _resetTxt;
        doc["etapa_no_reset"] = bb_stage_name(_stageAtReset);
        JsonArray ev = doc.createNestedArray("ev");
        int n = 0;
        for (; s <= _bb.seq && n < BB_PAGE; s++) {
            const BbEntry& e = _bb.e[s % BB_N];
            if (e.seq != s) continue;
            JsonArray x = ev.createNestedArray();
            x.add(e.seq); x.add(e.epoch); x.add(e.up); x.add(e.msg);
            n++;
        }
        if (n == 0) continue;
        char buf[2048];
        if (serializeJson(doc, buf, sizeof(buf)) == 0) break;
        if (!pub(topic, buf)) return total;          // broker caiu: o resto vai na proxima
        total += n;
        if (so_novos) { _bb.sent = s - 1; _dirty = true; }
    }
    return total;
}
