// sd_buffer.cpp — fila offline de mensagens MQTT no cartao SD, SEGMENTADA.
//
// Por que (plano anti-travamento 2026-09-23, itens A1..A7):
//  - a versao antiga contava pendentes lendo o arquivo inteiro byte a byte (ate 5 MB) a cada
//    10 s e, para mandar 5 mensagens, regravava o arquivo inteiro: podia estourar o watchdog
//    (reinicio em loop) e uma queda de energia no meio corrompia a fila.
// Como funciona agora:
//  - mensagens vao para segmentos /q/NNNNNNNN.txt de ate SDQ_SEG_MAX bytes (so' append);
//  - um PONTEIRO de leitura (segmento, deslocamento) fica no NVS numa UNICA chave de 64 bits
//    (escrita atomica: queda de energia mantem o valor anterior);
//  - o ponteiro so' avanca DEPOIS do lote publicado -> entrega "pelo menos uma vez":
//    queda no meio pode reenviar ate um lote, nunca perder;
//  - segmento lido ate o fim e' apagado so' depois do ponteiro avancar;
//  - linha incompleta (queda no meio da gravacao) e' descartada, nunca emendada na proxima;
//  - pendentes = contador em memoria; a contagem inicial roda em fatias (sd_buffer_tick);
//  - cartao cheio (SDQ_TOTAL_MAX) descarta o segmento MAIS ANTIGO;
//  - 3 falhas seguidas de abrir/gravar -> cartao marcado em falha, remonta a cada 10 min;
//  - o arquivo antigo /mqtt_buf.txt (ou .tmp) e' migrado para a fila no primeiro boot.
// Sem barra invertida, crase ou cifrao-chave neste arquivo: ele e' embutido literalmente
// num template JS das bases do gerador.

#include "sd_buffer.h"
#include <string.h>
#include <stdlib.h>
#include <stdio.h>

#ifdef SDQ_HOST
#include "sdq_host_shim.h"
#else
#include "hal.h"
#include "diag.h"
#include <Arduino.h>
#include <SPI.h>
#include <SD.h>
#include <Preferences.h>
#include <esp_task_wdt.h>
#define SDQ_WDT() esp_task_wdt_reset()
static SPIClass _spiSD(HSPI);
static bool _sdMountHw() {
    _spiSD.begin(SPI1_SCLK_PIN, SPI1_MISO_PIN, SPI1_MOSI_PIN, SD_CS);
    return SD.begin(SD_CS, _spiSD, 8000000);
}
static void _sdUnmountHw() { SD.end(); }
#endif

#ifndef SDQ_SEG_MAX
#define SDQ_SEG_MAX        65536UL             // bytes por segmento
#endif
#ifndef SDQ_TOTAL_MAX
#define SDQ_TOTAL_MAX      (8UL * 1024UL * 1024UL)   // teto total da fila no cartao
#endif
#define SDQ_DRAIN_BUDGET_MS 300UL
#define SDQ_TICK_BUDGET_MS  20UL
#define SDQ_REMOUNT_MS      600000UL
#define SDQ_FAILS_TO_OFF    3
#define SDQ_LINE_MAX        1400
#define SDQ_DIR            "/q"
#define SDQ_NL             ((char)10)
#define SDQ_TAB            ((char)9)

enum SdqState : uint8_t { SDQ_NOCARD = 0, SDQ_OK, SDQ_FAIL };

static SdqState _st = SDQ_NOCARD;
static bool     _ready = false;
static bool     _everMounted = false;
static uint32_t _rseg = 0, _roff = 0;      // ponteiro de leitura
static uint32_t _wseg = 0, _wsize = 0;     // segmento de escrita
static uint32_t _minSeg = 0;
static uint64_t _total = 0;                // bytes na fila (todos os segmentos)
static int32_t  _pend = 0;                 // pendentes (valido se !_rec)
static bool     _rec = false;              // contagem inicial em andamento
static uint32_t _recSeg = 0, _recOff = 0, _recEndSeg = 0, _recEndOff = 0;
static int32_t  _recCount = 0, _recDelta = 0;
static uint8_t  _fails = 0;
static unsigned long _lastMount = 0;
static uint32_t _discarded = 0;
static char     _line[SDQ_LINE_MAX + 1];

static void _path(uint32_t seg, char* out, size_t n) { snprintf(out, n, SDQ_DIR "/%08lu.txt", (unsigned long)seg); }

static void _loadPtr() {
    Preferences p;
    uint64_t v = 0;
    if (p.begin("sdq", true)) { v = p.getULong64("ptr", 0); p.end(); }
    _rseg = (uint32_t)(v >> 32); _roff = (uint32_t)(v & 0xFFFFFFFFULL);
}
static void _savePtr() {
    Preferences p;
    if (p.begin("sdq", false)) { p.putULong64("ptr", ((uint64_t)_rseg << 32) | (uint64_t)_roff); p.end(); }
}

static uint32_t _fileSize(const char* path) {
    File f = SD.open(path, FILE_READ);
    if (!f) return 0;
    uint32_t s = (uint32_t)f.size(); f.close(); return s;
}

// Lista /q: menor e maior segmento, bytes totais. false se a pasta nao abre.
static bool _scan(uint32_t* mn, uint32_t* mx, uint64_t* tot, bool* any) {
    *any = false; *mn = 0xFFFFFFFFUL; *mx = 0; *tot = 0;
    File d = SD.open(SDQ_DIR, FILE_READ);
    if (!d || !d.isDirectory()) return false;
    for (File e = d.openNextFile(); e; e = d.openNextFile()) {
        const char* nm = e.name();
        const char* b = strrchr(nm, '/'); b = b ? b + 1 : nm;
        char* end = nullptr;
        unsigned long seg = strtoul(b, &end, 10);
        if (end && end != b && strcmp(end, ".txt") == 0) {
            *any = true;
            if (seg < *mn) *mn = (uint32_t)seg;
            if (seg > *mx) *mx = (uint32_t)seg;
            *tot += (uint64_t)e.size();
        }
        e.close();
        SDQ_WDT();
    }
    d.close();
    return true;
}

static bool _segExists(uint32_t seg) { char p[32]; _path(seg, p, sizeof(p)); return SD.exists(p); }

// Proximo segmento existente depois de 'seg' (ate _wseg). Buracos vem de descarte.
static uint32_t _nextSeg(uint32_t seg) {
    uint32_t s = seg + 1;
    while (s < _wseg && !_segExists(s)) s++;
    return s;
}

static bool _hasData() {
    if (!_ready) return false;
    if (_rseg < _wseg) return true;
    return _rseg == _wseg && _roff < _wsize;
}

static void _startRecount() {
    _rec = true; _recSeg = _rseg; _recOff = _roff; _recEndSeg = _wseg; _recEndOff = _wsize;
    _recCount = 0; _recDelta = 0;
}

static void _markFail(const char* what) {
    diag_sd_write_errors++;
    if (++_fails >= SDQ_FAILS_TO_OFF && _ready) {
        Serial.printf("[SD-BUF] cartao em FALHA (%s x%u) - desativado, nova tentativa em 10 min", what, (unsigned)_fails);
        Serial.println();
        _ready = false; _st = SDQ_FAIL; diag_sd_available = false;
        _lastMount = millis();
        _sdUnmountHw();
    }
}

// Migra o arquivo da versao antiga. .tmp (sobra de drenagem interrompida) contem tudo.
static void _migrateLegacy(bool dirEmpty) {
    const char* src = nullptr;
    if (SD.exists("/mqtt_buf.tmp")) { src = "/mqtt_buf.tmp"; if (SD.exists("/mqtt_buf.txt")) SD.remove("/mqtt_buf.txt"); }
    else if (SD.exists("/mqtt_buf.txt")) src = "/mqtt_buf.txt";
    if (!src) return;
    char dst[32];
    uint32_t seg = dirEmpty ? 0 : _wseg + 1;
    _path(seg, dst, sizeof(dst));
    if (SD.rename(src, dst)) {
        Serial.printf("[SD-BUF] fila antiga migrada para %s", dst); Serial.println();
        if (dirEmpty) { _rseg = 0; _roff = 0; _savePtr(); }
    } else {
        Serial.println("[SD-BUF] falha ao migrar a fila antiga (mantida)");
    }
}

static bool _open() {
    bool ok = _sdMountHw();
    if (!ok) { SDQ_WDT(); _sdUnmountHw(); ok = _sdMountHw(); }
    if (!ok) return false;
    if (!SD.exists(SDQ_DIR)) SD.mkdir(SDQ_DIR);
    _loadPtr();
    uint32_t mn, mx; uint64_t tot; bool any;
    if (!_scan(&mn, &mx, &tot, &any)) return false;
    _wseg = any ? mx : _rseg;
    _migrateLegacy(!any);
    if (!_scan(&mn, &mx, &tot, &any)) return false;
    _total = tot;
    if (!any) {                                   // fila vazia
        _wseg = _rseg; _wsize = 0; _minSeg = _rseg;
    } else {
        _minSeg = mn;
        if (_rseg < mn) { _rseg = mn; _roff = 0; _savePtr(); }
        // Ponteiro alem do ultimo segmento: tudo foi lido; escrita continua no segmento do ponteiro.
        _wseg = (_rseg > mx) ? _rseg : mx;
        // restos ja' lidos (queda entre salvar o ponteiro e apagar): apaga
        for (uint32_t s = mn; s < _rseg; s++) {
            char p[32]; _path(s, p, sizeof(p));
            if (SD.exists(p)) { _total -= _fileSize(p); SD.remove(p); }
            SDQ_WDT();
        }
        char wp[32]; _path(_wseg, wp, sizeof(wp));
        _wsize = _fileSize(wp);
        // Linha incompleta no fim do segmento de escrita (queda no meio): nao emenda.
        if (_wsize > 0) {
            File f = SD.open(wp, FILE_READ);
            if (f) {
                f.seek(_wsize - 1);
                int c = f.read();
                f.close();
                if (c != SDQ_NL) { _wseg++; _wsize = 0; }
            }
        }
    }
    if (_rseg == _wseg && _roff > _wsize) _roff = _wsize;
    _ready = true; _everMounted = true; _st = SDQ_OK; _fails = 0;
    diag_sd_available = true;
    _startRecount();
    return true;
}

bool sd_buffer_init() {
    _lastMount = millis();
    if (!_open()) {
        Serial.println("[SD-BUF] Inicializacao falhou (sem cartao ou cartao com defeito)");
        _ready = false; _st = SDQ_FAIL; diag_sd_available = false;
        return false;
    }
    Serial.printf("[SD-BUF] OK - fila: leitura %lu:%lu, escrita %lu:%lu, %lu bytes",
                  (unsigned long)_rseg, (unsigned long)_roff, (unsigned long)_wseg,
                  (unsigned long)_wsize, (unsigned long)_total);
    Serial.println();
    return true;
}

bool sd_buffer_ready() { return _ready; }

const char* sd_buffer_state() {
    if (_st == SDQ_OK) return "ok";
    return _everMounted ? "falha" : "sem_cartao";
}

uint32_t sd_buffer_discarded() { return _discarded; }

// Conta linhas de um segmento a partir de 'off' (usado no descarte).
static int32_t _countLines(const char* path, uint32_t off) {
    File f = SD.open(path, FILE_READ);
    if (!f) return 0;
    f.seek(off);
    int32_t n = 0; uint8_t b[256];
    for (;;) {
        int r = f.read(b, sizeof(b));
        if (r <= 0) break;
        for (int i = 0; i < r; i++) if (b[i] == (uint8_t)SDQ_NL) n++;
    }
    f.close();
    return n;
}

static void _pendAdd(int32_t d) {
    if (_rec) _recDelta += d;
    else { _pend += d; if (_pend < 0) _pend = 0; }
}

// Cartao cheio: descarta o segmento mais antigo (o que esta sendo lido).
static bool _dropOldest() {
    if (_rseg >= _wseg) return false;
    char p[32]; _path(_rseg, p, sizeof(p));
    uint32_t sz = _fileSize(p);
    int32_t lines = _countLines(p, _roff);
    uint32_t old = _rseg;
    _rseg = _nextSeg(_rseg); _roff = 0;
    _savePtr();
    SD.remove(p);
    _total = (_total > sz) ? _total - sz : 0;
    _discarded += (uint32_t)lines;
    if (_rec) _startRecount(); else _pendAdd(-lines);
    Serial.printf("[SD-BUF] cartao cheio: segmento %lu descartado (%ld mensagens antigas)", (unsigned long)old, (long)lines);
    Serial.println();
    return true;
}

bool sd_buffer_store(const char* topic, const char* payload) {
    if (!_ready) { diag_sd_write_errors++; return false; }
    size_t lt = strlen(topic), lp = strlen(payload), need = lt + lp + 2;
    if (need > SDQ_LINE_MAX) { diag_sd_write_errors++; Serial.println("[SD-BUF] mensagem grande demais, descartada"); return false; }
    if (_wsize >= SDQ_SEG_MAX) { _wseg++; _wsize = 0; }
    while (_total + need > SDQ_TOTAL_MAX && _dropOldest()) { SDQ_WDT(); }
    char p[32]; _path(_wseg, p, sizeof(p));
    File f = SD.open(p, FILE_APPEND);
    if (!f) { _markFail("abrir"); return false; }
    // Linha montada inteira e gravada numa unica chamada.
    memcpy(_line, topic, lt); _line[lt] = SDQ_TAB; memcpy(_line + lt + 1, payload, lp); _line[lt + 1 + lp] = SDQ_NL;
    size_t w = f.write((const uint8_t*)_line, need);
    f.close();
    if (w != need) {
        if (w > 0) { _wseg++; _wsize = 0; _total += w; }   // linha parcial: fecha o segmento
        _markFail("gravar");
        return false;
    }
    _fails = 0;
    _wsize += (uint32_t)need; _total += need;
    _pendAdd(1);
    diag_sd_writes++;
    return true;
}

int sd_buffer_pending() {
    if (!_hasData()) return 0;
    int32_t n = _rec ? (_recCount + _recDelta) : _pend;
    return n > 0 ? (int)n : 1;
}

void sd_buffer_tick() {
    unsigned long now = millis();
    if (!_ready) {
        if (_st == SDQ_FAIL && now - _lastMount >= SDQ_REMOUNT_MS) {
            _lastMount = now;
            Serial.println("[SD-BUF] tentando remontar o cartao...");
            _sdUnmountHw();
            if (_open()) { Serial.println("[SD-BUF] cartao de volta"); }
            else { _st = SDQ_FAIL; diag_sd_available = false; _sdUnmountHw(); }
        }
        return;
    }
    if (!_rec) return;
    // Contagem inicial em fatias: [ponteiro no inicio da contagem, fim da escrita naquele instante)
    unsigned long t0 = millis();
    while (millis() - t0 < SDQ_TICK_BUDGET_MS) {
        if (_recSeg > _recEndSeg || (_recSeg == _recEndSeg && _recOff >= _recEndOff)) {
            _rec = false; _pend = _recCount + _recDelta; if (_pend < 0) _pend = 0;
            Serial.printf("[SD-BUF] %ld mensagens pendentes na fila", (long)_pend); Serial.println();
            return;
        }
        char p[32]; _path(_recSeg, p, sizeof(p));
        File f = SD.open(p, FILE_READ);
        if (!f) { _recSeg = (_recSeg < _recEndSeg) ? _nextSeg(_recSeg) : _recEndSeg + 1; _recOff = 0; continue; }
        uint32_t lim = (_recSeg == _recEndSeg) ? _recEndOff : (uint32_t)f.size();
        f.seek(_recOff);
        uint8_t b[512];
        bool fim = false;
        while (millis() - t0 < SDQ_TICK_BUDGET_MS) {
            if (_recOff >= lim) { fim = true; break; }
            uint32_t want = lim - _recOff; if (want > sizeof(b)) want = sizeof(b);
            int r = f.read(b, want);
            if (r <= 0) { fim = true; break; }
            for (int i = 0; i < r; i++) if (b[i] == (uint8_t)SDQ_NL) _recCount++;
            _recOff += (uint32_t)r;
        }
        f.close();
        if (fim) {
            if (_recSeg < _recEndSeg) { _recSeg = _nextSeg(_recSeg); _recOff = 0; }
            else { _recSeg = _recEndSeg; _recOff = _recEndOff; }
        }
    }
}

int sd_buffer_drain(sd_buffer_publish_fn publish_fn, int max_send) {
    if (!publish_fn || !_hasData()) return 0;
    unsigned long t0 = millis();
    int limit = max_send > 0 ? max_send : 10;
    int sent = 0;
    bool moved = false, parar = false;
    while (!parar && sent < limit && millis() - t0 < SDQ_DRAIN_BUDGET_MS && _hasData()) {
        char p[32]; _path(_rseg, p, sizeof(p));
        File f = SD.open(p, FILE_READ);
        if (!f) {
            if (_rseg < _wseg) { _rseg = _nextSeg(_rseg); _roff = 0; moved = true; continue; }
            _markFail("ler"); break;
        }
        uint32_t size = (uint32_t)f.size();
        bool segFim = false;
        while (sent < limit && millis() - t0 < SDQ_DRAIN_BUDGET_MS) {
            SDQ_WDT();
            if (_roff >= size) { segFim = true; break; }
            f.seek(_roff);
            int r = f.read((uint8_t*)_line, SDQ_LINE_MAX);
            if (r <= 0) { segFim = true; break; }
            int nl = -1;
            for (int i = 0; i < r; i++) if (_line[i] == SDQ_NL) { nl = i; break; }
            if (nl < 0) {
                if (r >= SDQ_LINE_MAX) { _roff += (uint32_t)r; moved = true; continue; }   // lixo sem quebra: pula
                // Sem quebra no fim do arquivo = linha incompleta (queda no meio da gravacao).
                if (_rseg < _wseg) { _roff = size; moved = true; segFim = true; }
                else parar = true;   // segmento de escrita: nao consome
                break;
            }
            _line[nl] = 0;
            char* tab = strchr(_line, SDQ_TAB);
            if (!tab || tab == _line) { _roff += (uint32_t)nl + 1; moved = true; _pendAdd(-1); continue; }   // corrompida
            *tab = 0;
            if (!publish_fn(_line, tab + 1)) { parar = true; break; }
            _roff += (uint32_t)nl + 1; moved = true; sent++;
            diag_sd_resends++;
            _pendAdd(-1);
        }
        f.close();
        if (segFim && _rseg < _wseg) {
            uint32_t old = _rseg;
            _rseg = _nextSeg(_rseg); _roff = 0;
            _savePtr(); moved = false;               // ponteiro antes de apagar
            char op[32]; _path(old, op, sizeof(op));
            SD.remove(op);
            _total = (_total > size) ? _total - size : 0;
        } else if (segFim) {
            break;                                   // alcancou o fim da escrita
        }
    }
    if (moved) _savePtr();
    if (sent > 0) {
        Serial.printf("[SD-BUF] %d reenviadas (pendentes: %d)", sent, sd_buffer_pending());
        Serial.println();
    }
    return sent;
}

#ifdef SDQ_HOST
// So' no teste de host: simula o reinicio da TON (RAM zera; cartao e NVS ficam).
void sdq_host_reboot() {
    _st = SDQ_NOCARD; _ready = false; _everMounted = false;
    _rseg = _roff = _wseg = _wsize = _minSeg = 0; _total = 0; _pend = 0;
    _rec = false; _recSeg = _recOff = _recEndSeg = _recEndOff = 0; _recCount = _recDelta = 0;
    _fails = 0; _lastMount = 0; _discarded = 0;
}
#endif
