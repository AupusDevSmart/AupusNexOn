#include "sd_buffer.h"
#include "hal.h"
#include "diag.h"
#include <Arduino.h>
#include <SPI.h>
#include <SD.h>

#define SD_BUF_FILE      "/mqtt_buf.txt"
#define SD_BUF_TMP       "/mqtt_buf.tmp"
#define SD_MAX_FILE_SIZE (5UL * 1024UL * 1024UL)  // 5 MB
#define SD_FLUSH_PER_LOOP 10                       // max msgs por drain

static bool _sdReady = false;
static SPIClass _spiSD(HSPI);

bool sd_buffer_init() {
    _spiSD.begin(SPI1_SCLK_PIN, SPI1_MISO_PIN, SPI1_MOSI_PIN, SD_CS);
    if (!SD.begin(SD_CS, _spiSD, 8000000)) {
        Serial.println("[SD-BUF] Inicializacao falhou");
        _sdReady = false;
        diag_sd_available = false;
        return false;
    }
    _sdReady = true;
    diag_sd_available = true;
    Serial.printf("[SD-BUF] OK - %llu MB\n", SD.cardSize() / (1024ULL * 1024ULL));
    int pending = sd_buffer_pending();
    if (pending > 0) {
        Serial.printf("[SD-BUF] %d mensagens pendentes no buffer\n", pending);
    }
    return true;
}

bool sd_buffer_ready() { return _sdReady; }

bool sd_buffer_store(const char* topic, const char* payload) {
    if (!_sdReady) {
        diag_sd_write_errors++;
        return false;
    }

    File f = SD.open(SD_BUF_FILE, FILE_APPEND);
    if (!f) {
        diag_sd_write_errors++;
        Serial.println("[SD-BUF] Falha ao abrir para escrita");
        return false;
    }
    if (f.size() > SD_MAX_FILE_SIZE) {
        f.close();
        diag_sd_write_errors++;
        Serial.println("[SD-BUF] Arquivo cheio, descartando");
        return false;
    }
    f.print(topic);
    f.print('\t');
    f.println(payload);
    f.close();
    diag_sd_writes++;
    Serial.printf("[SD-BUF] SALVO: %s (total armazenado: %lu)\n", topic, (unsigned long)diag_sd_writes);
    return true;
}

int sd_buffer_pending() {
    if (!_sdReady) return 0;
    if (!SD.exists(SD_BUF_FILE)) return 0;
    File f = SD.open(SD_BUF_FILE, FILE_READ);
    if (!f) return 0;
    int n = 0;
    while (f.available()) {
        if (f.read() == '\n') n++;
    }
    f.close();
    return n;
}

int sd_buffer_drain(sd_buffer_publish_fn publish_fn, int max_send) {
    if (!_sdReady || !publish_fn) return 0;
    if (!SD.exists(SD_BUF_FILE)) return 0;

    File check = SD.open(SD_BUF_FILE, FILE_READ);
    if (!check) return 0;
    if (check.size() == 0) { check.close(); SD.remove(SD_BUF_FILE); return 0; }
    check.close();

    if (SD.exists(SD_BUF_TMP)) SD.remove(SD_BUF_TMP);
    if (!SD.rename(SD_BUF_FILE, SD_BUF_TMP)) return 0;

    File src = SD.open(SD_BUF_TMP, FILE_READ);
    if (!src) return 0;
    File dst = SD.open(SD_BUF_FILE, FILE_WRITE);

    int sent = 0, kept = 0, limit = (max_send > 0 ? max_send : SD_FLUSH_PER_LOOP);
    bool failing = false;

    while (src.available()) {
        String line = src.readStringUntil('\n');
        line.trim();
        if (line.length() == 0) continue;

        if (failing || sent >= limit) {
            if (dst) dst.println(line);
            kept++;
            continue;
        }

        int tab = line.indexOf('\t');
        if (tab <= 0) continue; // linha corrompida

        String topic = line.substring(0, tab);
        String payload = line.substring(tab + 1);

        if (publish_fn(topic.c_str(), payload.c_str())) {
            sent++;
            diag_sd_resends++;
            Serial.printf("[SD-BUF] Reenviado: %s\n", topic.c_str());
            delay(30);
        } else {
            // Falhou - guardar restante para proxima
            if (dst) dst.println(line);
            kept++;
            failing = true;
        }
    }

    src.close();
    if (dst) dst.close();
    SD.remove(SD_BUF_TMP);

    if (sent > 0 || kept > 0) {
        Serial.printf("[SD-BUF] Drenadas %d mensagens (restam %d, total reenviado: %lu)\n",
                       sent, kept, (unsigned long)diag_sd_resends);
    }
    // Se ficou vazio, remover arquivo
    File recheck = SD.open(SD_BUF_FILE, FILE_READ);
    if (recheck) {
        if (recheck.size() == 0) { recheck.close(); SD.remove(SD_BUF_FILE); }
        else recheck.close();
    }
    return sent;
}
