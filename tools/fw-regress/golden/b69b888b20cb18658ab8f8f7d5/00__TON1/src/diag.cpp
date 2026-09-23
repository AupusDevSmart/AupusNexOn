#include "diag.h"
#include "config.h"
#include "mqtt.h"
#include "ota.h"
#include <Arduino.h>
#include <ArduinoJson.h>
#include <WiFi.h>
#include <esp_system.h>

uint32_t diag_modbus_ok = 0;
uint32_t diag_modbus_err = 0;
uint32_t diag_mqtt_pub = 0;
uint32_t diag_publish_fails = 0;
uint32_t diag_wifi_disconnects = 0;
uint32_t diag_mqtt_disconnects = 0;
uint32_t diag_tcp_retries = 0;
uint32_t diag_sd_writes = 0;
uint32_t diag_sd_resends = 0;
uint32_t diag_sd_write_errors = 0;
uint32_t diag_min_free_heap = 0xFFFFFFFFu;
bool     diag_sd_available = false;
bool     diag_tcp_connected = false;
unsigned long diag_last_successful_read_ms = 0;
unsigned long diag_boot_time_ms = 0;

static unsigned long _lastDiagPub = 0;

void diag_init() {
    diag_boot_time_ms = millis();
    diag_min_free_heap = ESP.getFreeHeap();
}

void diag_tick() {
    uint32_t f = ESP.getFreeHeap();
    if (f < diag_min_free_heap) diag_min_free_heap = f;
}

const char* diag_reset_reason() {
    switch (esp_reset_reason()) {
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

void diag_publish_periodic() {
    if (!mqtt_connected()) return;
    if (millis() - _lastDiagPub < DIAG_INTERVAL_MS) return;
    _lastDiagPub = millis();

    StaticJsonDocument<1024> doc;
    doc["device"]            = DEVICE_MODEL;
    doc["mac"]               = WiFi.macAddress();
    // IP reportado e' o da interface ATIVA no MQTT (wifi ou eth)
    {
        const char* iface = mqtt_active_iface();
        doc["iface"] = iface;
        if (strcmp(iface, "eth") == 0) {
            extern IPAddress eth_local_ip();
            doc["ip"] = eth_local_ip().toString();
        } else {
            doc["ip"] = WiFi.localIP().toString();
        }
    }
    doc["uptime_sec"]        = (uint32_t)((millis() - diag_boot_time_ms) / 1000);
    doc["free_heap"]         = ESP.getFreeHeap();
    doc["wifi_rssi"]         = WiFi.RSSI();
    doc["tcp_connected"]     = diag_tcp_connected;
    doc["tcp_retries"]       = diag_tcp_retries;
    doc["modbus_ok"]         = diag_modbus_ok;
    doc["modbus_err"]        = diag_modbus_err;
    doc["mqtt_pub"]          = diag_mqtt_pub;
    doc["publish_fails"]     = diag_publish_fails;
    doc["wifi_disconnects"]  = diag_wifi_disconnects;
    doc["mqtt_disconnects"]  = diag_mqtt_disconnects;
    doc["sd_available"]      = diag_sd_available;
    doc["sd_writes"]         = diag_sd_writes;
    doc["sd_resends"]        = diag_sd_resends;
    doc["sd_write_errors"]   = diag_sd_write_errors;
    doc["min_free_heap"]     = diag_min_free_heap;
    doc["reset_reason"]      = diag_reset_reason();
    doc["restart_cause"]     = mqtt_restart_cause();   // "" | sem_broker | comando
    if (diag_last_successful_read_ms > 0) {
        doc["silence_sec"] = (uint32_t)((millis() - diag_last_successful_read_ms) / 1000);
    } else {
        doc["silence_sec"] = 0;
    }

    char json[1024];
    size_t sz = serializeJson(doc, json, sizeof(json));
    if (sz == 0) return;

    char topic[160];
    snprintf(topic, sizeof(topic), "%s/diagnostics", MQTT_TOPIC_BASE);
    if (mqtt_publish_raw(topic, json)) {
        // Diagnostic gerado e publicado pelo firmware NOVO ao vivo: prova que
        // WiFi+MQTT+JSON+counters estao funcionando. Conta como validacao OTA
        // (cobre o caso patologico de TON sem telemetria periodica via mqtt_publish).
        ota_confirm_valid_if_needed();
        // Heartbeat visual no serial: confirma que o pipe MQTT esta vivo.
        Serial.printf("[MQTT] diag publicado em %s/diagnostics (iface=%s, total_pubs=%lu)\n",
                      MQTT_TOPIC_BASE, mqtt_active_iface(), (unsigned long)diag_mqtt_pub);
    } else {
        Serial.printf("[MQTT] FALHA ao publicar diagnostics (iface=%s)\n", mqtt_active_iface());
    }
}
