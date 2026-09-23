// ==============================================================================
// TON4 (TON4) - Gerado pelo NexOn IoT
// ==============================================================================

#include <Arduino.h>
#include <Wire.h>
#include <WiFi.h>          // WiFi.macAddress() — log de identidade no boot
#include <ArduinoJson.h>
#include <esp_task_wdt.h>

#include "hal.h"
#include "config.h"
#include "inputs.h"
#include "outputs.h"
#include "adc.h"
#include "sd_buffer.h"
#include "diag.h"
#include "eth.h"
#include "relays.h"
#include "mqtt.h"
#include "lora.h"
#include "modbus_meter.h"

// Estado / timers
static unsigned long last_input_scan = 0;
static unsigned long last_evt        = 0;  // SOE: drenagem da fila de eventos do rele
static unsigned long last_sample     = 0;  // leitura Modbus RS485 (round-robin)
static unsigned long last_publish    = 0;  // publicacao MQTT RS485 (medias/deltas)
static unsigned long last_sample_tcp = 0;  // leitura Modbus TCP (round-robin via datalogger)
static unsigned long last_publish_tcp = 0; // publicacao MQTT TCP (medias/deltas)
static unsigned long last_evt_tcp    = 0;  // SOE: drenagem de eventos de rele TCP direto

// ===== ACK aplicacao-level para comandos =====
// Protocolo:
//   Backend publica em <BASE>/cmd com envelope: {"cmd_id":"<uuid>","cmd": <inner>}
//   <inner> pode ser string ("r1 on") ou objeto ({"device":"X","cmd":"cmd_fechar"})
//   TON publica resposta em <BASE>/cmd/ack: {"cmd_id","status","msg","ts"}
//   status: "ok" | "error" | "duplicate"
// Backward-compat: se nao houver cmd_id, executa sem publicar ack (legado).
// Dedup ring-buffer: tamanho 32 da' folga pra ate ~10s de retries do backend
// (timeout 5s x 3 attempts) e do gateway LoRa (timeout 2s x 3 attempts) sem
// que cmd_ids antigos sejam sobrescritos.
#define CMD_DEDUP_SIZE 32
static char _cmdSeen[CMD_DEDUP_SIZE][40];
static int  _cmdSeenIdx = 0;

static bool _cmd_seen_or_add(const char* cmd_id) {
    for (int i = 0; i < CMD_DEDUP_SIZE; i++) {
        if (_cmdSeen[i][0] && strcmp(_cmdSeen[i], cmd_id) == 0) return true;
    }
    strncpy(_cmdSeen[_cmdSeenIdx], cmd_id, sizeof(_cmdSeen[0]) - 1);
    _cmdSeen[_cmdSeenIdx][sizeof(_cmdSeen[0]) - 1] = 0;
    _cmdSeenIdx = (_cmdSeenIdx + 1) % CMD_DEDUP_SIZE;
    return false;
}

static void _publish_cmd_ack(const char* cmd_id, const char* status, const char* msg) {
    char topic[160];
    snprintf(topic, sizeof(topic), "%s/cmd/ack", MQTT_TOPIC_BASE);
    char payload[256];
    snprintf(payload, sizeof(payload),
             "{\"cmd_id\":\"%s\",\"status\":\"%s\",\"msg\":\"%s\",\"ts\":%lu}",
             cmd_id, status, msg ? msg : "", (unsigned long)(millis() / 1000));
    mqtt_publish(topic, payload);
}

// Executa o comando bruto (sem envelope). Preenche result_msg com descricao curta.
// Retorna true em sucesso, false em erro.
static bool _process_command_inner(const char* raw, char* result_msg, size_t msg_sz) {
    if (!raw || !*raw) { snprintf(result_msg, msg_sz, "empty"); return false; }

    // Comando estruturado: {"device":"X","cmd":"cmd_fechar"}
    if (raw[0] == '{') {
        StaticJsonDocument<256> j;
        DeserializationError jerr = deserializeJson(j, raw);
        if (!jerr) {
            const char* dev = j["device"] | "";
            const char* cid = j["cmd"] | "";
            if (dev[0] && cid[0]) {
                bool ok = modbus_exec_command(dev, cid);
                snprintf(result_msg, msg_sz, "%s/%s:%s", dev, cid, ok ? "OK" : "FAIL");
                return ok;
            }
        }
    }

    String cmd = String(raw); cmd.trim(); cmd.toLowerCase();
    if (cmd.length() == 0) { snprintf(result_msg, msg_sz, "empty"); return false; }

    // Reinicio remoto (MQTT <base>/cmd ou Serial): "reboot" | "reiniciar". Recusa com OTA
    // em curso ou posto abastecendo; o ack sai antes (reinicia 2 s depois).
    if (cmd == "reboot" || cmd == "reiniciar" || cmd == "restart") {
        if (!mqtt_restart_permitido()) { snprintf(result_msg, msg_sz, "reboot_recusado_ton_ocupada"); return false; }
        // Mensagem RETIDA no broker chega logo apos conectar: ignorar evita loop de reinicio.
        if (mqtt_conn_age_ms() < 20000UL) { snprintf(result_msg, msg_sz, "reboot_ignorado_recem_conectado"); return false; }
        mqtt_request_restart("comando", 2000);
        snprintf(result_msg, msg_sz, "reiniciando_em_2s");
        return true;
    }

    if (cmd.length() >= 4 && cmd[0] == 'r' && cmd[1] >= '1' && cmd[1] <= '6') {
        bool on = cmd.indexOf("on") >= 0;
        relay_set(cmd[1] - '0', on);
        snprintf(result_msg, msg_sz, "rele_%c_%s", cmd[1], on ? "on" : "off");
        return true;
    }
    if (cmd.startsWith("tr") && cmd[2] >= '1' && cmd[2] <= '4') {
        bool on = cmd.indexOf("on") >= 0;
        output_set(cmd[2] - '0', on);
        snprintf(result_msg, msg_sz, "tr%c_%s", cmd[2], on ? "on" : "off");
        return true;
    }
    if (cmd == "status") {
        Serial.printf("Entradas: %02X  Saidas: %02X\n", inputs_get_state(), outputs_get_state());
        snprintf(result_msg, msg_sz, "status_printed");
        return true;
    }

    snprintf(result_msg, msg_sz, "unknown_cmd");
    return false;
}

// Wrapper publico: detecta envelope com cmd_id, faz dedup e publica ack.
static void process_command(const char* raw) {
    if (!raw) return;

    char cmd_id[40] = {0};
    const char* effective = raw;
    static char inner_buf[512];

    // Detecta envelope: { "cmd_id": "...", "cmd": <inner> }
    if (raw[0] == '{') {
        StaticJsonDocument<512> env;
        if (deserializeJson(env, raw) == DeserializationError::Ok) {
            const char* id = env["cmd_id"] | "";
            if (id[0]) {
                strncpy(cmd_id, id, sizeof(cmd_id) - 1);

                if (_cmd_seen_or_add(cmd_id)) {
                    Serial.printf("[CMD] Duplicate cmd_id=%s ignorado\n", cmd_id);
                    _publish_cmd_ack(cmd_id, "duplicate", "already_seen");
                    return;
                }

                JsonVariantConst inner = env["cmd"];
                // ArduinoJson 7: em JsonVariantConst, is<JsonObject>() retorna false
                // mesmo pra objetos — precisa usar JsonObjectConst. Bug observado em
                // 2026-06-02 (ack "missing_cmd_field" mesmo com {"cmd":{...}} valido).
                if (inner.is<const char*>()) {
                    snprintf(inner_buf, sizeof(inner_buf), "%s", inner.as<const char*>());
                    effective = inner_buf;
                } else if (inner.is<JsonObjectConst>()) {
                    serializeJson(inner, inner_buf, sizeof(inner_buf));
                    effective = inner_buf;
                } else {
                    _publish_cmd_ack(cmd_id, "error", "missing_cmd_field");
                    return;
                }
            }
        }
    }

    char msg[64] = {0};
    bool ok = _process_command_inner(effective, msg, sizeof(msg));
    Serial.printf("[CMD] %s -> %s (%s)\n", effective, ok ? "OK" : "FAIL", msg);

    if (cmd_id[0]) {
        _publish_cmd_ack(cmd_id, ok ? "ok" : "error", msg);
    }
}


// ===== LoRa Router (role: satellite) =====
// Protocolo em envelope JSON (modo transparente do E220):
//   cmd:        {"to":"AA:BB:..","from":"<orig>","cmd_id":"...","cmd":"r1 on"}
//   ack:        {"to":"<orig>","from":"<me>","cmd_id":"...","status":"ok","msg":"..."}
//   data:       {"to":"<gw>","from":"<me>","type":"data","subtopic":"X/data","payload":{...}}
//   status:     {"to":"<gw>","from":"<me>","type":"status","online":true,"version":"..."}
//
// Garantias de entrega:
//   - Gateway: pending queue + retry com timeout 2s, ate 3 tentativas. Se nao
//     receber ACK no ultimo retry, publica ack erro "lora_no_ack" no MQTT.
//   - Ambos: CSMA simples (aguarda AUX=HIGH) + jitter random antes de TX pra
//     reduzir colisao quando varios dispositivos transmitem perto no tempo.
//   - MTU E220: 200 bytes max em modo transparente. _lora_safe_send descarta
//     payload acima e loga erro (caller deve dividir ou comprimir).

#define LORA_MAX_PAYLOAD 200

// Compara MACs ignorando case e separadores ':' / '-'.
static bool _lora_mac_eq(const char* a, const char* b) {
    if (!a || !b) return false;
    auto norm = [](char c) -> char {
        if (c == ':' || c == '-') return 0;
        if (c >= 'a' && c <= 'z') return c - 32;
        return c;
    };
    while (*a || *b) {
        while (*a && norm(*a) == 0) a++;
        while (*b && norm(*b) == 0) b++;
        if (norm(*a) != norm(*b)) return false;
        if (!*a || !*b) return (*a == *b);
        a++; b++;
    }
    return true;
}

// ============================================================
// REPASSE MULTI-HOP (defined-path) — tabela de rotas + next_hop.
// ----------------------------------------------------------------
// O 'to' do envelope e' o destino FINAL. Esta tabela (gerada do grafo LoRa
// pelo gerador, via BFS) diz qual o MAC do PROXIMO SALTO em direcao a cada
// destino alcancavel. 1-salto: nh == dst (vizinho direto). Multi-hop: nh e'
// um intermediario. Se o destino nao esta na tabela (ex: gateway que so'
// aprende MACs em runtime), _lora_next_hop devolve o proprio dst -> envia
// direto (compat: comportamento ponto-a-ponto antigo).
#define LORA_DEFAULT_TTL 4

typedef struct { const char* dst; const char* nh; } LoraRoute;
static const LoraRoute _LORA_ROUTES[] = {
    { "98:A3:16:EB:D4:20", "98:A3:16:EB:D4:20" },
    { "28:37:2F:9D:8C:5C", "98:A3:16:EB:D4:20" },
};
static const int _LORA_ROUTES_N = sizeof(_LORA_ROUTES) / sizeof(_LORA_ROUTES[0]);

// Retorna o MAC do proximo salto em direcao a 'dst'. Se 'dst' nao esta na
// tabela, devolve o proprio 'dst' (envio direto/compat ponto-a-ponto).
static const char* _lora_next_hop(const char* dst) {
    if (!dst || !dst[0]) return dst;
    for (int i = 0; i < _LORA_ROUTES_N; i++) {
        if (_lora_mac_eq(_LORA_ROUTES[i].dst, dst)) return _LORA_ROUTES[i].nh;
    }
    return dst;  // desconhecido -> tenta direto
}

// ----- Dedup por cmd_id (ring buffer) — compartilhado por todos os roles LoRa.
// Usado pra: (sat) nao reaplicar cmd reenviado; (todos) anti-loop no repasse
// multi-hop (nao repassar o mesmo cmd_id 2x). Retorna true se ja' visto.
#define LORA_DEDUP_SIZE 32
// [72] = from(17) + "|" + cmd_id(ate' 39, igual LoraPending.cmd_id) + "|" + type
// (ate' "pollresp") sem truncar.
static char _loraDedup[LORA_DEDUP_SIZE][72];
static int _loraDedupIdx = 0;
static bool _sat_seen_or_add(const char* cmd_id, const char* type, const char* from) {
    if (!cmd_id || !cmd_id[0]) return false;
    // Chave "from|cmd_id|type" (originador + id + direcao). Dois motivos:
    //  1) o MESMO cmd_id viaja como pergunta E resposta (POLL<->POLLRESP,
    //     cmd<->ack reusam o id) -> o 'type' separa ida da volta, senao a
    //     repetidora marcava a ida e descartava a volta como duplicada (offline
    //     indevido a 2+ saltos).
    //  2) o cmd_id de telemetria ("d<seq>") e' por-no (cada satelite tem seu
    //     contador) -> sem o 'from', dois irmaos atras da MESMA repetidora
    //     gerariam "d1|data" identico e a repetidora descartaria a telemetria de
    //     um deles. O 'from' (originador, ja' no envelope) torna a chave unica por
    //     no SEM inchar o id -> o id curto cabe no MTU 200 (ex.: status do pivo).
    char key[72];
    snprintf(key, sizeof(key), "%s|%s|%s",
             (from && from[0]) ? from : "?", cmd_id, (type && type[0]) ? type : "-");
    for (int i = 0; i < LORA_DEDUP_SIZE; i++) {
        if (_loraDedup[i][0] && strcmp(_loraDedup[i], key) == 0) return true;
    }
    strncpy(_loraDedup[_loraDedupIdx], key, sizeof(_loraDedup[0]) - 1);
    _loraDedup[_loraDedupIdx][sizeof(_loraDedup[0]) - 1] = 0;
    _loraDedupIdx = (_loraDedupIdx + 1) % LORA_DEDUP_SIZE;
    return false;
}

// CSMA simples: aguarda canal idle (AUX=HIGH) + jitter random pra evitar
// colisao quando varios devices transmitem perto no tempo. Retorna false
// (sem transmitir) se passou do MTU do E220 (200 bytes) — caller decide o que
// fazer (ex: gateway publica erro imediato em vez de esperar timeout).
static bool _lora_safe_send(const char* msg) {
    if (!msg) return false;
    size_t len = strlen(msg);
    if (len > LORA_MAX_PAYLOAD) {
        Serial.printf("[LORA] descartado: payload %u > MTU %d\n", (unsigned)len, LORA_MAX_PAYLOAD);
        return false;
    }
    // Espera ate 2s o canal ficar idle.
    unsigned long t = millis();
    while (!digitalRead(LORA_AUX) && millis() - t < 2000) {
        delay(2);
        esp_task_wdt_reset();
    }
    // Jitter aleatorio 30-150ms reduz colisao entre transmissores proximos.
    delay(30 + (esp_random() % 120));
    lora_send(msg);
    return true;
}

// REPASSE (forward) — re-serializa o envelope JSON cru com ttl decrementado e
// re-transmite (CSMA via _lora_safe_send). 'to'/'from'/'cmd_id'/payload ficam
// INTACTOS; so' o ttl muda. Compartilhado por todos os roles LoRa.
static void _lora_forward(JsonDocument& env, int ttl) {
    env["ttl"] = ttl;
    char buf[LORA_MAX_PAYLOAD + 20];
    int n = serializeJson(env, buf, sizeof(buf));
    if (n <= 0 || n >= (int)sizeof(buf)) {
        Serial.printf("[LORA] forward: envelope %d bytes nao cabe — descartado\n", n);
        return;
    }
    _lora_safe_send(buf);
}

// ============================================================
// SCHEMAS BINARIOS — compressão de telemetria pra caber no MTU do E220.
// Frame: "$B$" + Base64( header + subtopic + payload ), onde:
//   header   = [type_code(1), version(1), from_mac(6), subtopic_len(1)] = 9 bytes
//   subtopic = N bytes (o subtopic REAL do device, ex: "Power Meter_1/data")
//   payload  = bytes dos fields do field-set (big-endian, com escala)
// O subtopic VIAJA no frame — assim o gateway republica no topico exato que o
// satellite emitiu (conserta o bug de subtopic hardcoded). O type_code so'
// seleciona o LAYOUT de campos (compartilhado entre os firmwares).
// Tamanho M160: 9 + ~18 (subtopic) + 50 (payload) = 77B -> Base64 104B + 3 = 107B ✓
// ============================================================

#define LORA_SUBTOPIC_MAX 60

typedef enum { LFT_U8 = 1, LFT_U16, LFT_S16, LFT_U32, LFT_S32 } LoraFieldType;

typedef struct {
    const char* json_key;
    uint8_t type;       // LoraFieldType
    float scale;        // raw_binario = real * scale; real = raw / scale
} LoraField;

typedef struct {
    uint8_t type_code;          // identificador do layout de campos (0x10=M160)
    uint8_t version;            // pra migrar layouts no futuro sem quebrar
    const LoraField* fields;    // array null-terminated (key=NULL)
} LoraFieldSet;

// ---- M160 (Modbus RTU, multimedidor IMS) — keys batem com o payload REAL do
//      firmware do M160 (Va,Ia,FPa,Pt,phf,consumo_* — capitalizado, confirmado
//      no broker em campo). ----
static const LoraField LORA_FIELDS_M160_V1[] = {
    {"Va",          LFT_U16, 100.0f},   // 0.01 V
    {"Vb",          LFT_U16, 100.0f},
    {"Vc",          LFT_U16, 100.0f},
    {"Ia",          LFT_U16, 100.0f},   // 0.01 A
    {"Ib",          LFT_U16, 100.0f},
    {"Ic",          LFT_U16, 100.0f},
    {"FPa",         LFT_S16, 1000.0f},  // 0.001 FP
    {"FPb",         LFT_S16, 1000.0f},
    {"FPc",         LFT_S16, 1000.0f},
    {"Pt",          LFT_S32, 10.0f},    // 0.1 W
    {"Qt",          LFT_S32, 10.0f},    // 0.1 var
    {"St",          LFT_S32, 10.0f},    // 0.1 VA
    {"phf",         LFT_U32, 1000.0f},  // mWh
    {"consumo_phf", LFT_U32, 1000.0f},
    {"consumo_phr", LFT_U32, 1000.0f},
    {"consumo_qhf", LFT_U32, 1000.0f},
    {"consumo_qhr", LFT_U32, 1000.0f},
    {NULL, 0, 0}  // terminator
};

#define LORA_TYPE_M160 0x10

// Tabela de field-sets FIXA e compartilhada (gateway e satellite tem a mesma).
// Indexada por type_code — define apenas o LAYOUT, nao o subtopic.
static const LoraFieldSet LORA_FIELD_SETS[] = {
    {LORA_TYPE_M160, 1, LORA_FIELDS_M160_V1},
    {0, 0, NULL}  // terminator
};

static const LoraFieldSet* _lora_fieldset_for_type(uint8_t type_code, uint8_t version) {
    for (const LoraFieldSet* s = LORA_FIELD_SETS; s->fields; s++) {
        if (s->type_code == type_code && s->version == version) return s;
    }
    return NULL;
}

// SATELLITE-SIDE: mapeia o subtopic REAL emitido pelo device reader
// (formato nome_endereco/data) -> type_code. Gerado a partir dos RS485 do
// diagrama desta TON, entao casa exatamente o que lora_publish_data recebe.
static uint8_t _lora_typecode_for_subtopic(const char* subtopic) {
    if (!subtopic) return 0;
    if (strcmp(subtopic, "Power Meter_1/data") == 0) return LORA_TYPE_M160;
    if (strcmp(subtopic, "Power Meter_2/data") == 0) return LORA_TYPE_M160;
    return 0;  // sem field-set conhecido -> caller usa JSON (e loga)
}

// MAC string ("AA:BB:CC:DD:EE:FF") <-> 6 bytes binarios
static void _lora_mac_str_to_bytes(const char* str, uint8_t bytes[6]) {
    memset(bytes, 0, 6);
    if (!str) return;
    int b = 0;
    const char* p = str;
    while (*p && b < 6) {
        while (*p && (*p == ':' || *p == '-' || *p == ' ')) p++;
        if (!*p || !*(p+1)) break;
        char h[3] = { *p, *(p+1), 0 };
        bytes[b++] = (uint8_t)strtoul(h, NULL, 16);
        p += 2;
    }
}
static void _lora_mac_bytes_to_str(const uint8_t bytes[6], char* out) {
    sprintf(out, "%02X:%02X:%02X:%02X:%02X:%02X",
            bytes[0], bytes[1], bytes[2], bytes[3], bytes[4], bytes[5]);
}

// Pack JSON -> binario. Retorna bytes escritos ou -1 em overflow.
static int _lora_pack_fields(const LoraField* fields, JsonDocument& doc,
                              uint8_t* buf, int max_len) {
    int pos = 0;
    for (const LoraField* f = fields; f->json_key; f++) {
        if (pos + 4 > max_len) return -1;
        double val = doc[f->json_key] | 0.0;
        int64_t raw = (int64_t)(val * f->scale + (val >= 0 ? 0.5 : -0.5));  // round
        switch (f->type) {
            case LFT_U8:
                buf[pos++] = (uint8_t)(raw & 0xFF);
                break;
            case LFT_U16:
            case LFT_S16:
                buf[pos++] = (uint8_t)((raw >> 8) & 0xFF);
                buf[pos++] = (uint8_t)(raw & 0xFF);
                break;
            case LFT_U32:
            case LFT_S32:
                buf[pos++] = (uint8_t)((raw >> 24) & 0xFF);
                buf[pos++] = (uint8_t)((raw >> 16) & 0xFF);
                buf[pos++] = (uint8_t)((raw >> 8) & 0xFF);
                buf[pos++] = (uint8_t)(raw & 0xFF);
                break;
        }
    }
    return pos;
}

// Unpack binario -> JSON. Retorna bytes consumidos ou -1 em underflow.
static int _lora_unpack_fields(const LoraField* fields, const uint8_t* buf,
                                int len, JsonDocument& doc) {
    int pos = 0;
    for (const LoraField* f = fields; f->json_key; f++) {
        int64_t raw = 0;
        switch (f->type) {
            case LFT_U8:
                if (pos + 1 > len) return -1;
                raw = buf[pos++];
                break;
            case LFT_U16:
                if (pos + 2 > len) return -1;
                raw = ((uint16_t)buf[pos] << 8) | buf[pos+1]; pos += 2;
                break;
            case LFT_S16:
                if (pos + 2 > len) return -1;
                raw = (int16_t)(((uint16_t)buf[pos] << 8) | buf[pos+1]); pos += 2;
                break;
            case LFT_U32:
                if (pos + 4 > len) return -1;
                raw = ((uint32_t)buf[pos] << 24) | ((uint32_t)buf[pos+1] << 16)
                    | ((uint32_t)buf[pos+2] << 8) | buf[pos+3]; pos += 4;
                break;
            case LFT_S32:
                if (pos + 4 > len) return -1;
                raw = (int32_t)(((uint32_t)buf[pos] << 24) | ((uint32_t)buf[pos+1] << 16)
                              | ((uint32_t)buf[pos+2] << 8) | buf[pos+3]); pos += 4;
                break;
        }
        // Scale=1 mantem como inteiro; senao como double
        if (f->scale == 1.0f) {
            doc[f->json_key] = (long)raw;
        } else {
            doc[f->json_key] = (double)raw / f->scale;
        }
    }
    return pos;
}

// Base64 — usa mbedtls (ja disponivel no Arduino-ESP32 framework)
#include <mbedtls/base64.h>
static int _lora_b64_encode(const uint8_t* in, size_t in_len, char* out, size_t out_max) {
    size_t olen = 0;
    int rc = mbedtls_base64_encode((unsigned char*)out, out_max, &olen, in, in_len);
    if (rc != 0) return -1;
    out[olen] = 0;
    return (int)olen;
}
static int _lora_b64_decode(const char* in, size_t in_len, uint8_t* out, size_t out_max) {
    size_t olen = 0;
    int rc = mbedtls_base64_decode(out, out_max, &olen, (const unsigned char*)in, in_len);
    if (rc != 0) return -1;
    return (int)olen;
}


// Satellite: recebe envelope LoRa, processa só se 'to' bater com meu MAC.
// Dedup (_sat_seen_or_add, ring compartilhado) evita reaplicar cmd quando
// gateway re-envia por timeout. Heartbeat a cada 30s pro gateway saber vivo.

#define LORA_SAT_HEARTBEAT_MS 30000UL
// 1 = gateway e' vizinho direto (1 salto); 0 = atras de repetidora (2+ saltos).
// Telemetria binaria ("$B$") so' roteia 1-salto -> a 2+ saltos o firmware avisa.
#define LORA_GW_DIRECT 1

static String _ton2_gw_mac = "";  // MAC do gateway (descoberto na 1a msg recebida)
static unsigned long _lastHeartbeat = 0;

// MESTRE-PUXA: definida no main.cpp (la' tem acesso aos leitores Modbus/TCP/IO).
// Lê o device, publica a telemetria via lora_publish_data e fecha com pollresp.
// Forward-decl aqui pois lora_handle_rx a chama ao receber um POLL.
void lora_poll_respond(const char* gw_mac, const char* req_id);
// Envia o envelope de CONCLUSAO do poll (type:"pollresp") — def. abaixo de
// lora_send_envelope (que ela usa). Chamada por lora_poll_respond no main.cpp.
void lora_send_pollresp(const char* gw_mac, const char* req_id);

// Empacota envelope JSON e envia via _lora_safe_send (CSMA + jitter).
// 'to_mac' e' o destino FINAL. O campo "ttl" (multi-hop) limita os saltos —
// intermediarios repassam ate ttl chegar a 0. Em 1-salto o destino e' vizinho
// direto e o ttl nem e' consumido.
static void lora_send_envelope(const char* to_mac, const char* type, const char* cmd_id,
                                const char* status, const char* msg,
                                const char* subtopic, const char* payload_json) {
    char buf[LORA_MAX_PAYLOAD + 20];  // +20 pra detectar overflow antes do safe_send
    String my_mac = WiFi.macAddress();
    int n = snprintf(buf, sizeof(buf), "{\"to\":\"%s\",\"from\":\"%s\"",
                     to_mac && to_mac[0] ? to_mac : "*", my_mac.c_str());
    if (type && type[0]) n += snprintf(buf + n, sizeof(buf) - n, ",\"type\":\"%s\"", type);
    if (cmd_id && cmd_id[0]) n += snprintf(buf + n, sizeof(buf) - n, ",\"cmd_id\":\"%s\"", cmd_id);
    if (status && status[0]) n += snprintf(buf + n, sizeof(buf) - n, ",\"status\":\"%s\"", status);
    if (msg && msg[0]) n += snprintf(buf + n, sizeof(buf) - n, ",\"msg\":\"%s\"", msg);
    if (subtopic && subtopic[0]) n += snprintf(buf + n, sizeof(buf) - n, ",\"subtopic\":\"%s\"", subtopic);
    if (payload_json && payload_json[0]) n += snprintf(buf + n, sizeof(buf) - n, ",\"payload\":%s", payload_json);
    n += snprintf(buf + n, sizeof(buf) - n, ",\"ttl\":%d", LORA_DEFAULT_TTL);
    // "data" e "status" omitem o "ts" do envelope (o gateway republica so' o
    // payload e nao usa esse ts) — economiza ~13B pro MTU 200 (telemetria do pivo,
    // heartbeat com "poll":1). ack/pollresp mantem o ts.
    if (!type || (strcmp(type, "data") != 0 && strcmp(type, "status") != 0))
        n += snprintf(buf + n, sizeof(buf) - n, ",\"ts\":%lu", (unsigned long)(millis()/1000));
    n += snprintf(buf + n, sizeof(buf) - n, "}");
    if (n <= 0 || n >= (int)sizeof(buf)) {
        Serial.printf("[LORA-SAT] envelope montagem falhou (n=%d)\n", n);
        return;
    }
    _lora_safe_send(buf);  // descarta se > MTU 200, com log
}

// MESTRE-PUXA: fecha o ciclo de poll respondendo o req_id pro mestre. A
// telemetria em si ja' foi enviada por lora_poll_respond via lora_publish_data;
// este envelope so' sinaliza "terminei, req_id=X" pro mestre avancar.
void lora_send_pollresp(const char* gw_mac, const char* req_id) {
    const char* gw = (gw_mac && gw_mac[0]) ? gw_mac
                   : (_ton2_gw_mac.length() ? _ton2_gw_mac.c_str() : "*");
    lora_send_envelope(gw, "pollresp", req_id, "ok", nullptr, nullptr, nullptr);
}

static void lora_handle_rx(const char* raw) {
    if (!raw || !*raw || raw[0] != '{') {
        Serial.printf("[LORA-SAT] payload nao-JSON descartado: %s\n", raw ? raw : "(null)");
        return;
    }
    StaticJsonDocument<512> env;
    if (deserializeJson(env, raw) != DeserializationError::Ok) {
        Serial.println("[LORA-SAT] JSON invalido");
        return;
    }
    const char* to = env["to"] | "";
    const char* from = env["from"] | "";
    String myMac = WiFi.macAddress();
    const char* cmd_id = env["cmd_id"] | "";
    bool forMe = _lora_mac_eq(to, myMac.c_str());

    // MULTI-HOP: nao e' pra mim. Tenta REPASSAR (defined-path) em direcao ao
    // destino FINAL. Dedup por cmd_id evita repassar 2x (anti-loop), junto com o
    // TTL. 1-salto (gateway<->satellite direto) NUNCA cai aqui (to == myMac).
    if (!forMe) {
        // Dedup PRIMEIRO: ja' repassado/processado -> descarta (nem reprocessa
        // nem re-encaminha). Conta como "visto" pra nao repassar de novo.
        if (cmd_id[0] && _sat_seen_or_add(cmd_id, env["type"] | "", from)) return;
        int ttl = env["ttl"] | 0;   // ausente -> 0 -> nao repassa (compat: era so' p/ mim)
        if (ttl <= 0) return;       // esgotou TTL ou envelope antigo sem ttl
        const char* nh = _lora_next_hop(to);
        if (!nh || !nh[0] || _lora_mac_eq(nh, myMac.c_str())) return;  // sem rota
        Serial.printf("[LORA-SAT] FORWARD to=%s nh=%s ttl=%d->%d\n", to, nh, ttl, ttl - 1);
        _lora_forward(env, ttl - 1);  // re-send com to/from/cmd_id intactos, ttl-1
        return;
    }

    // ---- Daqui pra baixo: 'to' == meu MAC (fluxo ponto-a-ponto original) ----
    // Memoriza MAC do gateway pra responder ack/telemetria.
    if (from[0] && _ton2_gw_mac.length() == 0) {
        _ton2_gw_mac = String(from);
        Serial.printf("[LORA-SAT] Gateway descoberto: %s\n", from);
    }

    // MESTRE-PUXA (satellite REATIVO): POLL endereçado a mim. O mestre pergunta;
    // eu leio o device + faco os calculos (decode/escala EXISTENTE) e respondo
    // DATA(req_id) pela malha. req_id = cmd_id deste POLL (correlaciona no mestre).
    // NAO entra no dedup: cada POLL e' um pedido novo; se o mestre re-perguntar
    // (retransmissao), responder de novo com dado fresco e' o correto. So' um POLL
    // em voo por vez (mestre serializa), entao nao ha burst.
    {
        const char* _ptype = env["type"] | "";
        if (strcmp(_ptype, "poll") == 0) {
            Serial.printf("[LORA-SAT] POLL recebido req_id=%s de %s — lendo device e respondendo\n",
                          cmd_id[0] ? cmd_id : "(sem)", from);
            // Responde p/ quem perguntou (o mestre). Le devices + publica telemetria
            // via lora_publish_data (mesmo caminho do push antigo) e fecha com pollresp.
            lora_poll_respond(from, cmd_id);
            return;
        }
    }

    // Dedup: gateway pode reenviar mesmo cmd_id se nosso ACK se perdeu.
    // Resposta correta e' re-enviar ack 'duplicate' (gateway libera pendente).
    if (cmd_id[0] && _sat_seen_or_add(cmd_id, env["type"] | "", from)) {
        Serial.printf("[LORA-SAT] Duplicado cmd_id=%s — re-enviando ack 'duplicate'\n", cmd_id);
        lora_send_envelope(from, "ack", cmd_id, "duplicate", "already_seen", nullptr, nullptr);
        return;
    }

    JsonVariantConst inner = env["cmd"];
    static char inner_buf[300];
    const char* effective = "";
    if (inner.is<const char*>()) {
        snprintf(inner_buf, sizeof(inner_buf), "%s", inner.as<const char*>());
        effective = inner_buf;
    } else if (inner.is<JsonObjectConst>()) {
        serializeJson(inner, inner_buf, sizeof(inner_buf));
        effective = inner_buf;
    } else {
        if (cmd_id[0]) lora_send_envelope(from, "ack", cmd_id, "error", "missing_cmd_field", nullptr, nullptr);
        return;
    }

    char msg[64] = {0};
    bool ok = _process_command_inner(effective, msg, sizeof(msg));
    Serial.printf("[LORA-SAT][CMD] %s -> %s (%s)\n", effective, ok ? "OK" : "FAIL", msg);
    if (cmd_id[0]) {
        lora_send_envelope(from, "ack", cmd_id, ok ? "ok" : "error", msg, nullptr, nullptr);
    }
}

// Tenta enviar binario (cabe folgado no MTU). Retorna true se conseguiu.
// Frame: "$B$" + Base64( type(1), version(1), from_mac[6], sublen(1), subtopic, payload ).
// O subtopic viaja no frame -> gateway republica no topico EXATO emitido aqui.
static bool _lora_try_publish_binary(const char* subtopic, const char* payload_json) {
    uint8_t type_code = _lora_typecode_for_subtopic(subtopic);
    if (!type_code) return false;  // sem field-set p/ esse device -> caller usa JSON
    const LoraFieldSet* fs = _lora_fieldset_for_type(type_code, 1);
    if (!fs) return false;

    StaticJsonDocument<400> doc;
    if (deserializeJson(doc, payload_json) != DeserializationError::Ok) {
        Serial.println("[LORA-SAT] bin: JSON invalido");
        return false;
    }

    size_t sublen = strlen(subtopic);
    if (sublen > LORA_SUBTOPIC_MAX) {
        Serial.printf("[LORA-SAT] bin: subtopic %u > %d (usa JSON)\n",
                      (unsigned)sublen, LORA_SUBTOPIC_MAX);
        return false;
    }

    // Header: type(1) + version(1) + from_mac(6) + sublen(1), depois subtopic + payload
    uint8_t binbuf[200];
    binbuf[0] = fs->type_code;
    binbuf[1] = fs->version;
    String my_mac = WiFi.macAddress();
    _lora_mac_str_to_bytes(my_mac.c_str(), &binbuf[2]);
    binbuf[8] = (uint8_t)sublen;
    memcpy(&binbuf[9], subtopic, sublen);
    int payload_off = 9 + (int)sublen;

    int payload_len = _lora_pack_fields(fs->fields, doc, &binbuf[payload_off],
                                        (int)sizeof(binbuf) - payload_off);
    if (payload_len < 0) {
        Serial.println("[LORA-SAT] bin: pack overflow");
        return false;
    }
    int bin_total = payload_off + payload_len;

    char out[LORA_MAX_PAYLOAD + 4];
    out[0] = '$'; out[1] = 'B'; out[2] = '$';
    int b64_len = _lora_b64_encode(binbuf, bin_total, out + 3, sizeof(out) - 4);
    if (b64_len < 0) {
        Serial.println("[LORA-SAT] bin: b64 encode falhou");
        return false;
    }
    int total = 3 + b64_len;
    if (total > LORA_MAX_PAYLOAD) {
        Serial.printf("[LORA-SAT] bin: %d > MTU %d (descarta)\n", total, LORA_MAX_PAYLOAD);
        return false;
    }
    Serial.printf("[LORA-SAT] BIN tx sub=%s type=0x%02X bin=%dB total=%dB\n",
                  subtopic, fs->type_code, bin_total, total);
    _lora_safe_send(out);
    return true;
}

// Helper: satellite publica telemetria via LoRa. Tenta binario primeiro. Se
// nao ha field-set conhecido, cai pro JSON envelope — que pode exceder o MTU.
// FAIL-LOUD: avisa no Serial quando vai pro JSON, pra diagnosticar perda.
static void lora_publish_data(const char* subtopic, const char* payload_json) {
#if !LORA_GW_DIRECT
    // Este satelite esta a 2+ saltos do gateway. O frame binario "$B$" NAO carrega
    // to/ttl -> a repetidora (que so' repassa JSON) o descarta e a telemetria nao
    // chega. Avisa ALTO (sem silencio). Correcao: colocar o medidor a 1 salto do
    // gateway, ou aguardar o suporte a binario roteavel multi-hop (TODO).
    if (_lora_typecode_for_subtopic(subtopic)) {
        Serial.printf("[LORA-SAT] ⚠ sub=%s usa telemetria BINARIA e este no esta a 2+ saltos do "
                      "gateway — o frame nao roteia multi-hop ainda; a telemetria deste device NAO "
                      "chegara. Coloque o medidor a 1 salto do gateway.\n", subtopic ? subtopic : "?");
    }
#endif
    if (_lora_try_publish_binary(subtopic, payload_json)) return;
    size_t plen = payload_json ? strlen(payload_json) : 0;
    if (plen > 120) {
        // Envelope JSON vai estourar o MTU 200. Avisa claramente (sem schema
        // binario nao temos como caber). Telemetria NAO sera entregue.
        Serial.printf("[LORA-SAT] ⚠ sub=%s sem field-set binario e payload=%uB — "
                      "JSON provavelmente excede MTU 200 e sera descartado. "
                      "Cadastre um field-set p/ este device.\n",
                      subtopic ? subtopic : "?", (unsigned)plen);
    }
    // cmd_id de telemetria "d<seq>" (CURTO). A unicidade ENTRE satelites vem do
    // 'from' na chave de dedup (from|cmd_id|type), nao do id — assim o id fica curto
    // e o envelope cabe no MTU 200 (ex.: status do pivo). O seq por-no basta pra
    // o anti-loop/dedup dos proprios frames repassados.
    // Semeado com esp_random() no boot (init do static, 1a chamada): apos um reboot
    // os ids NAO recomecam de 'd1' (que poderia ainda estar no ring de dedup da
    // repetidora e fazer a telemetria pos-reboot ser dropada como duplicata por
    // alguns ciclos). Comeco aleatorio -> sem reuso de id entre reinicios. O id
    // maximo (uint32) ainda cabe no MTU 200 (verificado).
    static uint32_t _data_seq = esp_random();
    char _data_id[16];
    snprintf(_data_id, sizeof(_data_id), "d%lu", (unsigned long)(++_data_seq));
    const char* gw = _ton2_gw_mac.length() ? _ton2_gw_mac.c_str() : "*";
    lora_send_envelope(gw, "data", _data_id, nullptr, nullptr, subtopic, payload_json);
}

// Heartbeat periodico pro gateway saber que satellite esta vivo.
// Gateway re-publica em <BASE>/satellite/<MAC>/status (retain) — backend ve
// presence. Sem heartbeat por 2*intervalo, backend pode marcar offline.
void lora_loop_tick() {
    unsigned long now = millis();
    if (now - _lastHeartbeat < LORA_SAT_HEARTBEAT_MS) return;
    _lastHeartbeat = now;
    char payload[180];
    // "poll":1 anuncia que este satelite e' POLLAVEL (reativo, tem device) — o
    // gateway usa isso pra DESCOBRIR o alvo sem precisar do MAC no diagrama.
    snprintf(payload, sizeof(payload),
             "{\"online\":true,\"poll\":1,\"version\":\"%s\",\"uptime\":%lu,\"free_heap\":%u}",
             FIRMWARE_VERSION, (unsigned long)(now/1000),
             (unsigned)ESP.getFreeHeap());
    const char* gw = _ton2_gw_mac.length() ? _ton2_gw_mac.c_str() : "*";
    lora_send_envelope(gw, "status", nullptr, nullptr, nullptr, nullptr, payload);
}
// Motivo do ultimo reset (diagnostico)
static const char* _resetReason() {
    switch (esp_reset_reason()) {
        case ESP_RST_POWERON:  return "Power-on";
        case ESP_RST_SW:       return "Software";
        case ESP_RST_PANIC:    return "Panic (crash)";
        case ESP_RST_INT_WDT:  return "Watchdog (interrupt)";
        case ESP_RST_TASK_WDT: return "Watchdog (task)";
        case ESP_RST_WDT:      return "Watchdog";
        case ESP_RST_BROWNOUT: return "Brownout (tensao baixa)";
        case ESP_RST_DEEPSLEEP:return "Deep-sleep wake";
        case ESP_RST_EXT:      return "External reset";
        default:               return "Unknown";
    }
}

// Alimentar o watchdog (chamar em loops longos / esperas)
static inline void feedWatchdog() { esp_task_wdt_reset(); }

void setup() {
    Serial.begin(115200);
    delay(2000);
    Serial.printf("\n  %s v%s - %s\n", DEVICE_ID, FIRMWARE_VERSION, DEVICE_MODEL);
    Serial.println("  [BOOT] RS485-fix v1.1: drain RX, flush preTx, retry 0xE0, delays 80/1000us");
    Serial.println("  [BOOT] MQTT-fix v1.2: setKeepAlive(60), setSocketTimeout(30), mqtt_loop entre blocos");
    Serial.println("  [BOOT] Cycle v1.2.1: METER_CYCLE_MS=4000 (era 2000) — menos pressao no Modbus/MQTT");
    Serial.println("  [BOOT] TCPlog v1.2.2: log inclui slave id pra desambiguar inversores TCP");
    Serial.println("  [BOOT] ClientID v1.3.0: MQTT_CLIENT_ID derivado do MAC (unico por hardware)");
    Serial.println("  [BOOT] CmdHR v1.4.0: bo_map suporta func 0x06 (writeSingleRegister) — Schneider VI");
    Serial.println("  [BOOT] CmdEnvFix v1.4.1: envelope {cmd_id, cmd:{...}} agora reconhece objeto aninhado");
    Serial.println("  [BOOT] SBO v1.5.0: bo_map suporta comandos compostos (steps[]) — Schneider Object control");
    Serial.printf("  [BOOT] MAC: %s\n", WiFi.macAddress().c_str());
    Serial.printf("  Motivo do reset: %s\n", _resetReason());
    Serial.printf("  Heap livre: %u bytes\n\n", ESP.getFreeHeap());

    // Diagnosticos: contadores globais (uptime, modbus_ok/err, mqtt_pub, sd_*, etc.)
    diag_init();

    // Watchdog em panic mode: reinicia a placa se travar
    esp_task_wdt_init(WATCHDOG_TIMEOUT_S, true);
    esp_task_wdt_add(NULL);
    Serial.printf("[OK] Watchdog %ds (panic=reboot)\n", WATCHDOG_TIMEOUT_S);

    // I2C
    Wire.begin(I2C_SDA, I2C_SCL);
    Wire.setClock(I2C_CLOCK_HZ);

    // Ethernet W5500: inicializar ANTES do SD Card.
    // Razao: no TON-TESTE de bancada (validado), o W5500 e' inicializado primeiro.
    // Iniciar SD antes do W5500 estava deixando o chip nao-detectado pelo SPI.
    eth_hw_init();

    // Perifericos
    if (inputs_init()) Serial.println("[OK] Entradas (6x optoacopladas)");
    else Serial.println("[FAIL] Entradas");

    if (relays_init()) Serial.println("[OK] Reles (6x ULN2803)");
    else Serial.println("[FAIL] Reles");

    outputs_init();
    Serial.println("[OK] Transistores (TR1-TR4)");

    adc_init();
    Serial.println("[OK] ADC (AN1/AN2)");

    // SD Card - buffer offline para MQTT
    if (sd_buffer_init()) {
        Serial.println("[OK] SD Buffer");
    } else {
        Serial.println("[WARN] SD nao disponivel - mensagens offline serao perdidas");
    }

    // RS485 + Modbus (dispositivos vem do catalogo, sem scan no boot)
    modbus_init();

    // LoRa
    lora_init();

    esp_task_wdt_reset();
    Serial.println("\nPronto!");
}

// MESTRE-PUXA: responde um POLL do mestre. Le+publica a telemetria do device
// (mesmo decode/escala/empacotamento do push antigo) e sinaliza fim com pollresp.
void lora_poll_respond(const char* gw_mac, const char* req_id) {
    Serial.printf("[LORA-SAT] POLL req_id=%s -> lendo device e respondendo p/ %s\n",
                  req_id && req_id[0] ? req_id : "(sem)", gw_mac ? gw_mac : "*");
    // RS485: publica medias acumuladas (mesmo caminho do modo autonomo).
    modbus_publish_all([](const char* sub, const char* payload){ lora_publish_data(sub, payload); });
    // Fecha o ciclo: o mestre casa pelo req_id, republica o que chegou e avanca.
    lora_send_pollresp(gw_mac, req_id);
}

void loop() {
    esp_task_wdt_reset();
    diag_tick();  // atualiza min_free_heap a cada loop
    unsigned long now = millis();

    // I/O edge-triggered: publica entradas/saidas SOMENTE quando mudam.
    // Estado inicial publicado no boot e republicado apos cada reconexao MQTT
    // (pra o backend nunca ficar sem o estado atual). Substitui o antigo status
    // periodico de ${MQTT_STATUS_MS}ms que poluia o broker com publicacoes redundantes.
    if (now - last_input_scan >= INPUT_SCAN_MS) {
        last_input_scan = now;
        inputs_scan();

        static bool _io_force = true;        // forca publicacao inicial (boot)
        static bool _mqtt_was_up = false;
        static uint8_t _prev_out = 0;
        static uint8_t _prev_rl = 0;

        // Detecta reconexao MQTT (false->true) pra republicar estado atual
        bool _mqtt_up = mqtt_connected();
        if (_mqtt_up && !_mqtt_was_up) _io_force = true;
        _mqtt_was_up = _mqtt_up;

        // Entradas digitais (on-change via debounce de inputs_changed)
        bool _in_changed = inputs_changed();   // sempre chama pra consumir o flag
        if (_io_force || _in_changed) {
            uint8_t s = inputs_get_state();
            char buf[80];
            snprintf(buf, sizeof(buf), "{\"d1\":%d,\"d2\":%d,\"d3\":%d,\"d4\":%d,\"d5\":%d,\"d6\":%d}",
                s&1, (s>>1)&1, (s>>2)&1, (s>>3)&1, (s>>4)&1, (s>>5)&1);
            lora_publish_data("inputs", buf);
        }

        // Saidas transistor (TR1-4) on-change. Em satellite vai via LoRa.
        uint8_t os = outputs_get_state();
        if (_io_force || os != _prev_out) {
            _prev_out = os;
            char obuf[60];
            snprintf(obuf, sizeof(obuf), "{\"tr1\":%d,\"tr2\":%d,\"tr3\":%d,\"tr4\":%d}",
                os&1, (os>>1)&1, (os>>2)&1, (os>>3)&1);
            lora_publish_data("outputs", obuf);
        }

        // Reles (R1-6) on-change.
        uint8_t rl = relays_get_state();
        if (_io_force || rl != _prev_rl) {
            _prev_rl = rl;
            char rbuf[80];
            snprintf(rbuf, sizeof(rbuf), "{\"r1\":%d,\"r2\":%d,\"r3\":%d,\"r4\":%d,\"r5\":%d,\"r6\":%d}",
                (rl>>1)&1, (rl>>2)&1, (rl>>3)&1, (rl>>4)&1, (rl>>5)&1, (rl>>6)&1);
            lora_publish_data("relays", rbuf);
        }
        _io_force = false;
    }

    // Modbus: sample 1 device por ciclo (round-robin) a cada METER_CYCLE_MS
    if (now - last_sample >= METER_CYCLE_MS) {
        last_sample = now;
        modbus_sample_one();
    }
    // (mestre-puxa) sem publish autonomo: a telemetria sai em lora_poll_respond
    // quando o mestre POLLa. O accumulator (sample_one) segue rodando pra ter
    // media fresca pronta na hora do POLL. (void)last_publish;
    (void)last_publish;

    // Serial commands
    if (Serial.available()) {
        String cmd = Serial.readStringUntil('\n');
        process_command(cmd.c_str());
    }

    // LoRa RX — dispatcher consciente do papel (gateway vs satellite).
    if (lora_available()) {
        String msg = lora_read();
        if (msg.length() > 0) {
            Serial.printf("[LORA] RX: %s\n", msg.c_str());
            lora_handle_rx(msg.c_str());
        }
    }

    // LoRa tick — gateway processa retries do pending queue; satellite emite heartbeat.
    lora_loop_tick();
}
