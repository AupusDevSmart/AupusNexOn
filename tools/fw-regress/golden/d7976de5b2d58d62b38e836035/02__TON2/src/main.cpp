// ==============================================================================
// TON2 (TON2) - Gerado pelo NexOn IoT
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
#include "blackbox.h"
#include "mqtt.h"
#include "ota.h"
#include "lora.h"

// Estado / timers
static unsigned long last_input_scan = 0;
static unsigned long last_evt        = 0;  // SOE: drenagem da fila de eventos do rele
static unsigned long last_sample     = 0;  // leitura Modbus RS485 (round-robin)
static unsigned long last_publish    = 0;  // publicacao MQTT RS485 (medias/deltas)
static unsigned long last_sample_tcp = 0;  // leitura Modbus TCP (round-robin via datalogger)
static unsigned long last_publish_tcp = 0; // publicacao MQTT TCP (medias/deltas)
static unsigned long last_evt_tcp    = 0;  // SOE: drenagem de eventos de rele TCP direto

// Publica em TOPIC_BASE/<sub>. Helper para modulos que nao conhecem o prefixo.
static void mqtt_publish_sub(const char* sub, const char* payload) {
    char topic[160];
    snprintf(topic, sizeof(topic), "%s/%s", MQTT_TOPIC_BASE, sub);
    mqtt_publish(topic, payload);
}

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
                snprintf(result_msg, msg_sz, "no_modbus_in_firmware");
                return false;
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
    // Cartao SD: "sd limpar confirmo" apaga a fila e remonta (arquivo corrompido). Nao formata.
    if (cmd == "sd limpar confirmo") {
        bool ok = sd_buffer_wipe();
        snprintf(result_msg, msg_sz, ok ? "sd_fila_apagada" : "sd_nao_monta");
        return ok;
    }
    if (cmd == "sd limpar") { snprintf(result_msg, msg_sz, "confirme_com_sd_limpar_confirmo"); return false; }
    // Caixa-preta: publica o anel inteiro em <base>/log
    if (cmd == "log") {
        int n = bb_publish(mqtt_publish_raw, MQTT_TOPIC_BASE, false);
        snprintf(result_msg, msg_sz, "log_%d_eventos", n);
        return true;
    }

    if (cmd.length() >= 4 && cmd[0] == 'r' && cmd[1] >= '1' && cmd[1] <= '6') {
        snprintf(result_msg, msg_sz, "no_relays_in_model");
        return false;
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


// ===== LoRa Router (role: gateway) =====
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
    { "28:37:2F:9D:82:C0", "28:37:2F:9D:82:C0" },
    { "28:37:2F:9D:8C:5C", "28:37:2F:9D:8C:5C" },
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
    (void)subtopic;
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


// Gateway: subscreve <BASE>/satellite/+/cmd no MQTT. Cmds MQTT viram envelope
// LoRa, sao enfileirados (pending queue) e transmitidos com retry ate receber
// ACK do satellite. Sem ACK em 3 tentativas, publica ack erro no MQTT.
// RX LoRa: filtra por 'to'=meu MAC; roteia ack/data/status pro MQTT.

extern bool mqtt_publish_raw(const char* topic, const char* payload);

// ===== Pending queue de cmds aguardando ACK do satellite =====
// Timeout/attempts calibrados pro canal half-duplex do E220: depois de TX, o
// gateway precisa FICAR EM SILENCIO tempo suficiente pro satellite responder o
// ACK sem colisao. 4s de janela cobre: airtime do cmd (~0.5s) + processamento
// do satellite (ate ~1s, ou mais se estiver saindo de um ciclo Modbus) +
// airtime do ACK (~0.5s) + folga. 3 tentativas = 12s total, dentro dos 15s do
// publishCommand do backend (5s x 3), entao o resultado (ACK ou erro) sempre
// chega a tempo. Antes era 2s x 3 = 6s: o gateway retransmitia POR CIMA do ACK.
#define LORA_PENDING_MAX 8
#define LORA_RETRY_TIMEOUT_MS 4000UL
#define LORA_MAX_ATTEMPTS 3

struct LoraPending {
    bool in_use;
    char cmd_id[40];
    char target_mac[20];
    char envelope[400];       // serializado pronto pra reenvio
    uint8_t attempts;
    unsigned long last_sent_ms;
};
static LoraPending _loraPending[LORA_PENDING_MAX];

static int _pending_alloc() {
    for (int i = 0; i < LORA_PENDING_MAX; i++) if (!_loraPending[i].in_use) return i;
    return -1;
}
static void _pending_release(int idx) {
    if (idx >= 0 && idx < LORA_PENDING_MAX) _loraPending[idx].in_use = false;
}
static int _pending_find(const char* cmd_id) {
    if (!cmd_id || !cmd_id[0]) return -1;
    for (int i = 0; i < LORA_PENDING_MAX; i++) {
        if (_loraPending[i].in_use && strcmp(_loraPending[i].cmd_id, cmd_id) == 0) return i;
    }
    return -1;
}

// Publica ack de erro no MQTT (queue cheia, timeout LoRa, etc).
static void _publish_error_ack(const char* mac_alvo, const char* cmd_id, const char* reason, int attempts) {
    char topic[200];
    snprintf(topic, sizeof(topic), "%s/satellite/%s/cmd/ack", MQTT_TOPIC_BASE, mac_alvo);
    char ack[300];
    snprintf(ack, sizeof(ack),
             "{\"cmd_id\":\"%s\",\"status\":\"error\",\"msg\":\"%s\",\"attempts\":%d,\"ts\":%lu}",
             cmd_id, reason, attempts, (unsigned long)(millis()/1000));
    mqtt_publish_raw(topic, ack);
}

// Chamado por mqtt.cpp quando recebe <BASE>/satellite/<MAC>/cmd.
// Aloca slot no pending queue, monta envelope, envia 1a tentativa.
void gateway_handle_satellite_mqtt(const char* mac_alvo, const char* payload) {
    if (!mac_alvo || !mac_alvo[0] || !payload) return;
    StaticJsonDocument<512> env;
    if (deserializeJson(env, payload) != DeserializationError::Ok) {
        Serial.println("[LORA-GW] payload MQTT invalido — descartado");
        return;
    }
    const char* cmd_id = env["cmd_id"] | "";

    // DEDUP (bug-fix): o backend re-publica o MESMO cmd_id a cada 5s (3x). Sem
    // esse guard, cada re-publish alocava um novo slot -> burst LoRa duplicado +
    // slot vazado. Se ja' temos esse cmd_id em voo, ignoramos o re-publish (a
    // retransmissao LoRa ja' e' gerida por lora_loop_tick).
    if (cmd_id[0] && _pending_find(cmd_id) >= 0) {
        Serial.printf("[LORA-GW] cmd_id=%s ja' em voo — re-publish MQTT ignorado\n", cmd_id);
        return;
    }

    JsonVariantConst inner = env["cmd"];
    char inner_buf[300];
    if (inner.is<const char*>()) {
        snprintf(inner_buf, sizeof(inner_buf), "\"%s\"", inner.as<const char*>());
    } else if (inner.is<JsonObjectConst>()) {
        serializeJson(inner, inner_buf, sizeof(inner_buf));
    } else {
        snprintf(inner_buf, sizeof(inner_buf), "\"\"");
    }

    int idx = _pending_alloc();
    if (idx < 0) {
        Serial.println("[LORA-GW] pending queue cheia");
        if (cmd_id[0]) _publish_error_ack(mac_alvo, cmd_id, "gateway_queue_full", 0);
        return;
    }
    LoraPending& p = _loraPending[idx];
    p.in_use = true;
    strncpy(p.cmd_id, cmd_id, sizeof(p.cmd_id) - 1); p.cmd_id[sizeof(p.cmd_id) - 1] = 0;
    strncpy(p.target_mac, mac_alvo, sizeof(p.target_mac) - 1); p.target_mac[sizeof(p.target_mac) - 1] = 0;
    String myMac = WiFi.macAddress();
    // MULTI-HOP: 'to' = destino FINAL (mac_alvo). O "ttl" permite que nos
    // intermediarios repassem ate o satellite. Em 1-salto o satellite e' vizinho
    // direto: _lora_next_hop(mac_alvo) == mac_alvo, e o satellite ja' ve to==myMac.
    int n = snprintf(p.envelope, sizeof(p.envelope),
                     "{\"to\":\"%s\",\"from\":\"%s\",\"cmd_id\":\"%s\",\"cmd\":%s,\"ttl\":%d,\"ts\":%lu}",
                     mac_alvo, myMac.c_str(), cmd_id, inner_buf, LORA_DEFAULT_TTL, (unsigned long)(millis()/1000));
    if (n <= 0 || n >= (int)sizeof(p.envelope)) {
        Serial.println("[LORA-GW] envelope > buffer — descartado");
        _pending_release(idx);
        if (cmd_id[0]) _publish_error_ack(mac_alvo, cmd_id, "envelope_too_large", 0);
        return;
    }
    // Bug-fix MTU: checa o limite REAL do radio (200), nao so o buffer (400).
    // Comando entre 201-399B passava o guard mas era descartado por _lora_safe_send,
    // gerando um "lora_no_ack" enganoso 6s depois. Falha imediato com motivo certo.
    p.attempts = 1;
    p.last_sent_ms = millis();
    if (!_lora_safe_send(p.envelope)) {
        Serial.printf("[LORA-GW] envelope %dB > MTU %d — abortado\n", n, LORA_MAX_PAYLOAD);
        _pending_release(idx);
        if (cmd_id[0]) _publish_error_ack(mac_alvo, cmd_id, "lora_mtu_exceeded", 0);
        return;
    }
    Serial.printf("[LORA-GW] TX#1 -> %s cmd_id=%s slot=%d (%d bytes)\n", mac_alvo, cmd_id, idx, n);
}

// Quantos cmds estao em voo (pending queue). O orquestrador de poll so' POLLa
// quando o canal esta livre de comandos (comando tem prioridade).
static int _pending_count() {
    int n = 0;
    for (int i = 0; i < LORA_PENDING_MAX; i++) if (_loraPending[i].in_use) n++;
    return n;
}

// ===== MESTRE-PUXA: orquestrador de polling (round-robin, alvos DINAMICOS) =====
#define POLL_TIMEOUT_MS    10000UL  // janela de espera por POLLRESP. Cobre a resposta
                                     // COMPLETA do satelite: leitura + N frames de
                                     // telemetria (1 por device) + pollresp, cada um
                                     // com airtime LoRa + CSMA (~1.7s/frame medido).
                                     // _poll_note_activity ESTENDE a cada frame do alvo,
                                     // entao o timeout so' dispara se o satelite ficar
                                     // MUDO por 10s (morto), nao por demorar a terminar.
#define POLL_MAX_TIMEOUTS  3        // N timeouts seguidos -> marca satelite offline
#define POLL_GAP_MS        200UL    // respiro entre o fim de um poll e o proximo TX
#define POLL_MIN_INTERVAL_MS 60000UL // cadencia minima por alvo (casa com PUBLISH_INTERVAL_MS):
                                     // o satelite zera o acumulador a cada POLL, entao espacar
                                     // os polls garante uma janela cheia de amostras (METER_CYCLE_MS)
                                     // e media com a MESMA qualidade do push antigo.
#define POLL_MAX_TARGETS   16        // teto de satelites polláveis (diagrama + descobertos)

// Lista de alvos MUTAVEL: semeada pelos alvos do diagrama (se houver) e CRESCE
// com descoberta dinamica (heartbeat "poll":1).
typedef struct { char mac[20]; char name[24]; } PollTarget;
static PollTarget    _poll_targets[POLL_MAX_TARGETS];
static int           _poll_n = 0;     // alvos ativos

static int  _poll_idx      = -1;      // indice do satelite POLLado por ultimo
static bool _poll_waiting  = false;   // true enquanto espera POLLRESP
static char _poll_req_id[16] = {0};   // req_id do POLL em voo
static unsigned long _poll_deadline = 0;
static unsigned long _poll_next_ms  = 0;
static uint32_t _poll_seq   = 0;
static uint8_t  _poll_timeouts[POLL_MAX_TARGETS];  // timeouts seguidos por satelite
static bool     _poll_online[POLL_MAX_TARGETS];    // estado de presenca conhecido
static unsigned long _poll_last_ms[POLL_MAX_TARGETS]; // millis do ultimo POLL (0=nunca)

// Adiciona um alvo (se novo e ha espaco). Semeia o diagrama E a descoberta
// dinamica: ao ouvir o heartbeat de um satelite pollável (status "poll":1) com
// MAC novo, o gateway passa a pollá-lo — sem precisar do MAC no diagrama (como o
// push antigo, que aprendia o 'from' em runtime). Retorna true se adicionou.
static bool _poll_add(const char* mac, const char* name) {
    if (!mac || !mac[0]) return false;
    for (int i = 0; i < _poll_n; i++)
        if (_lora_mac_eq(_poll_targets[i].mac, mac)) return false;  // ja' na lista
    if (_poll_n >= POLL_MAX_TARGETS) { Serial.println("[LORA-GW] poll: lista cheia"); return false; }
    strncpy(_poll_targets[_poll_n].mac, mac, sizeof(_poll_targets[0].mac) - 1);
    _poll_targets[_poll_n].mac[sizeof(_poll_targets[0].mac) - 1] = 0;
    strncpy(_poll_targets[_poll_n].name, (name && name[0]) ? name : mac, sizeof(_poll_targets[0].name) - 1);
    _poll_targets[_poll_n].name[sizeof(_poll_targets[0].name) - 1] = 0;
    _poll_timeouts[_poll_n] = 0; _poll_online[_poll_n] = false; _poll_last_ms[_poll_n] = 0;
    Serial.printf("[LORA-GW] alvo de poll +%s (%s) total=%d\n",
                  mac, _poll_targets[_poll_n].name, _poll_n + 1);
    _poll_n++;
    return true;
}

// Semeia os alvos vindos do DIAGRAMA (pode ser 0 — descoberta dinamica supre).
static void _poll_seed_init() {
    _poll_add("28:37:2F:9D:82:C0", "TON4");
    _poll_add("28:37:2F:9D:8C:5C", "TON4");
}

// Publica presenca do satelite (online/offline) em <BASE>/satellite/<mac>/status.
static void _poll_publish_presence(int idx, bool online) {
    char topic[200];
    snprintf(topic, sizeof(topic), "%s/satellite/%s/status", MQTT_TOPIC_BASE, _poll_targets[idx].mac);
    char buf[200];
    snprintf(buf, sizeof(buf),
             "{\"online\":%s,\"source\":\"poll\",\"ts\":%lu}",
             online ? "true" : "false", (unsigned long)(millis()/1000));
    mqtt_publish_raw(topic, buf);
}

// Monta e envia o POLL pro satelite idx. 'to' = MAC final; roteia pela malha
// (_lora_next_hop + ttl). req_id curto ("p<seq>") correlaciona a resposta.
static void _poll_send(int idx) {
    snprintf(_poll_req_id, sizeof(_poll_req_id), "p%lu", (unsigned long)(++_poll_seq));
    String myMac = WiFi.macAddress();
    char env[200];
    int n = snprintf(env, sizeof(env),
        "{\"to\":\"%s\",\"from\":\"%s\",\"cmd_id\":\"%s\",\"type\":\"poll\",\"ttl\":%d,\"ts\":%lu}",
        _poll_targets[idx].mac, myMac.c_str(), _poll_req_id, LORA_DEFAULT_TTL,
        (unsigned long)(millis()/1000));
    if (n <= 0 || n >= (int)sizeof(env)) { Serial.println("[LORA-GW] POLL envelope overflow"); return; }
    // Semeia o proprio POLL no dedup (chave cmd_id|type): se uma repetidora
    // re-emitir este POLL e o gateway ouvir de volta, o forward reconhece como
    // ja' visto e NAO re-repassa o proprio POLL (evita TX duplicado na malha).
    _sat_seen_or_add(_poll_req_id, "poll", myMac.c_str());
    Serial.printf("[LORA-GW] POLL -> %s (%s) req_id=%s\n",
                  _poll_targets[idx].mac, _poll_targets[idx].name, _poll_req_id);
    // So' abre a janela de espera se o CSMA REALMENTE transmitiu. Se o canal
    // estava ocupado/overflow, _lora_safe_send devolve false: nao adianta esperar
    // POLLRESP de um POLL que nem saiu — agenda o proximo apos o respiro.
    if (_lora_safe_send(env)) {
        _poll_waiting  = true;
        _poll_deadline = millis() + POLL_TIMEOUT_MS;
        _poll_last_ms[idx] = millis();  // marca a cadencia so' quando o POLL saiu de fato
    } else {
        _poll_next_ms = millis() + POLL_GAP_MS;
    }
}

// Casa um POLLRESP recebido com o POLL em voo. So' aceita se: estamos esperando,
// o req_id bate E o 'from' e' o satelite que estamos pollando (ignora o resto).
// Em match: marca online, zera timeouts, libera a janela e agenda o proximo.
static bool _gw_poll_match(const char* req_id, const char* from) {
    if (!_poll_waiting || _poll_idx < 0 || _poll_idx >= _poll_n) return false;
    if (!req_id || !req_id[0] || strcmp(req_id, _poll_req_id) != 0) return false;
    if (!_lora_mac_eq(from, _poll_targets[_poll_idx].mac)) return false;  // resposta de outro no
    if (!_poll_online[_poll_idx]) {
        _poll_online[_poll_idx] = true;
        _poll_publish_presence(_poll_idx, true);
        Serial.printf("[LORA-GW] %s ONLINE (poll)\n", _poll_targets[_poll_idx].mac);
    }
    _poll_timeouts[_poll_idx] = 0;
    _poll_waiting = false;
    _poll_next_ms = millis() + POLL_GAP_MS;  // respira antes do proximo TX
    return true;
}

// Qualquer frame recebido DO satelite que estamos pollando (data binario/JSON,
// status) prova que ele esta vivo e respondendo -> ESTENDE a janela de espera.
// Assim uma resposta multi-frame (varios devices) ou cold-start lento NAO dispara
// timeout falso: o timeout so' vale se o alvo ficar MUDO por POLL_TIMEOUT_MS.
static void _poll_note_activity(const char* from) {
    if (!_poll_waiting || _poll_idx < 0 || _poll_idx >= _poll_n) return;
    if (from && from[0] && _lora_mac_eq(from, _poll_targets[_poll_idx].mac))
        _poll_deadline = millis() + POLL_TIMEOUT_MS;
}

// Tick do orquestrador (chamado de lora_loop_tick). Avanca a maquina round-robin.
static void _gw_poll_tick() {
    static bool _seeded = false;
    if (!_seeded) { _seeded = true; _poll_seed_init(); }  // alvos do diagrama (1x)
    if (_poll_n <= 0) return;  // sem alvos ainda (nem diagrama nem descoberto) -> idle
    unsigned long now = millis();
    // Comando tem prioridade: nao POLLa enquanto ha cmd em voo (evita colisao no
    // canal half-duplex). O retry do cmd ja' e' gerido acima no lora_loop_tick.
    if (_pending_count() > 0) return;

    if (_poll_waiting) {
        if ((long)(now - _poll_deadline) < 0) return;  // ainda dentro da janela
        // TIMEOUT: nenhum POLLRESP casou em POLL_TIMEOUT_MS.
        if (_poll_idx >= 0 && _poll_idx < _poll_n) {
            if (_poll_timeouts[_poll_idx] < 255) _poll_timeouts[_poll_idx]++;
            Serial.printf("[LORA-GW] POLL timeout %s (%u/%d) req_id=%s\n",
                          _poll_targets[_poll_idx].mac, _poll_timeouts[_poll_idx],
                          POLL_MAX_TIMEOUTS, _poll_req_id);
            if (_poll_timeouts[_poll_idx] >= POLL_MAX_TIMEOUTS && _poll_online[_poll_idx]) {
                _poll_online[_poll_idx] = false;
                _poll_publish_presence(_poll_idx, false);
                Serial.printf("[LORA-GW] %s OFFLINE apos %d timeouts\n",
                              _poll_targets[_poll_idx].mac, POLL_MAX_TIMEOUTS);
            }
        }
        _poll_waiting = false;
        _poll_next_ms = now + POLL_GAP_MS;
        return;
    }

    // Canal livre e nao esperando: agenda o proximo satelite (round-robin).
    if ((long)(now - _poll_next_ms) < 0) return;  // respiro entre polls
    // Cadencia minima por alvo: nao re-POLLa um satelite antes de POLL_MIN_INTERVAL_MS
    // (ele precisa acumular uma janela de amostras entre respostas — senao a media
    // degrada). Espera estrita pelo proximo da fila: como todos foram pollados em
    // sequencia, ficam "vencidos" por volta do mesmo instante.
    int _next = (_poll_idx + 1) % _poll_n;
    if (_poll_last_ms[_next] != 0 && (long)(now - _poll_last_ms[_next]) < (long)POLL_MIN_INTERVAL_MS) return;
    _poll_idx = _next;
    _poll_send(_poll_idx);
}

// Tick periodico — chamado do loop() do main. Reenvia pendentes que estouraram
// timeout, e descarta os que esgotaram tentativas (publica ack de erro). Depois
// roda o orquestrador de poll (mestre-puxa), que so' transmite com o canal livre.
void lora_loop_tick() {
    unsigned long now = millis();
    for (int i = 0; i < LORA_PENDING_MAX; i++) {
        LoraPending& p = _loraPending[i];
        if (!p.in_use) continue;
        if (now - p.last_sent_ms < LORA_RETRY_TIMEOUT_MS) continue;
        if (p.attempts >= LORA_MAX_ATTEMPTS) {
            Serial.printf("[LORA-GW] FALHA cmd_id=%s -> %s apos %d tentativas\n",
                          p.cmd_id, p.target_mac, p.attempts);
            _publish_error_ack(p.target_mac, p.cmd_id, "lora_no_ack", p.attempts);
            _pending_release(i);
        } else {
            p.attempts++;
            p.last_sent_ms = now;
            _lora_safe_send(p.envelope);
            Serial.printf("[LORA-GW] TX#%d -> %s cmd_id=%s (retry)\n",
                          p.attempts, p.target_mac, p.cmd_id);
        }
    }
    // MESTRE-PUXA: orquestra o polling round-robin dos satelites. No-op no fallback.
    _gw_poll_tick();
}

// Decodifica frame "$B$" + Base64( type, version, from_mac[6], sublen, subtopic, payload ).
// Republica em <BASE>/satellite/<from_mac>/<subtopic> com JSON expandido.
// O subtopic vem DO frame (nao de tabela), entao casa o que o satellite emitiu.
static bool _lora_handle_binary(const char* raw, size_t raw_len) {
    if (raw_len < 4 || raw[0] != '$' || raw[1] != 'B' || raw[2] != '$') return false;

    uint8_t binbuf[200];
    int bin_len = _lora_b64_decode(raw + 3, raw_len - 3, binbuf, sizeof(binbuf));
    if (bin_len < 9) {
        Serial.println("[LORA-GW] BIN: b64 decode falhou ou < header");
        return true;  // foi reconhecido como binario, so descartado
    }

    uint8_t type_code = binbuf[0];
    uint8_t version = binbuf[1];
    uint8_t from_bytes[6];
    memcpy(from_bytes, &binbuf[2], 6);
    uint8_t sublen = binbuf[8];
    if (9 + (int)sublen > bin_len || sublen >= LORA_SUBTOPIC_MAX) {
        Serial.printf("[LORA-GW] BIN: sublen invalido (%u)\n", sublen);
        return true;
    }
    char subtopic[LORA_SUBTOPIC_MAX + 1];
    memcpy(subtopic, &binbuf[9], sublen);
    subtopic[sublen] = 0;
    int payload_off = 9 + (int)sublen;

    const LoraFieldSet* fs = _lora_fieldset_for_type(type_code, version);
    if (!fs) {
        Serial.printf("[LORA-GW] BIN: field-set desconhecido type=0x%02X v%d\n", type_code, version);
        return true;
    }

    StaticJsonDocument<512> doc;
    int consumed = _lora_unpack_fields(fs->fields, &binbuf[payload_off], bin_len - payload_off, doc);
    if (consumed < 0) {
        Serial.println("[LORA-GW] BIN: unpack underflow");
        return true;
    }

    char from_str[20];
    _lora_mac_bytes_to_str(from_bytes, from_str);
    _poll_note_activity(from_str);  // frame do alvo -> estende a janela do poll

    // CARIMBO de hora no GATEWAY: o satelite nao tem internet/NTP e o frame binario
    // nao carrega timestamp. Como o gateway TEM hora (NTP) e o dado e' fresco (acabou
    // de ser lido sob POLL), carimba aqui com a hora do gateway (epoch s). So' se o
    // relogio ja' sincronizou (senao deixa sem -> backend usa a hora de chegada).
    {
        time_t _tnow = time(nullptr);
        if (_tnow > 1700000000) doc["timestamp"] = (long)_tnow;
    }

    char topic[220];
    snprintf(topic, sizeof(topic), "%s/satellite/%s/%s",
             MQTT_TOPIC_BASE, from_str, subtopic);
    char json_buf[600];
    size_t n = serializeJson(doc, json_buf, sizeof(json_buf));
    if (n > 0) {
        Serial.printf("[LORA-GW] BIN rx type=0x%02X from=%s -> %s (%uB JSON)\n",
                      type_code, from_str, topic, (unsigned)n);
        mqtt_publish_raw(topic, json_buf);
    }
    return true;
}

static void lora_handle_rx(const char* raw) {
    if (!raw || !*raw) return;
    size_t raw_len = strlen(raw);

    // Detecta frame binario antes do JSON (prefixo "$B$").
    if (_lora_handle_binary(raw, raw_len)) return;

    if (raw[0] != '{') return;
    StaticJsonDocument<700> env;
    if (deserializeJson(env, raw) != DeserializationError::Ok) {
        Serial.println("[LORA-GW] JSON invalido");
        return;
    }
    const char* to = env["to"] | "";
    const char* from = env["from"] | "";
    String myMac = WiFi.macAddress();
    // Aceita frames endereçados a mim OU broadcast "*". Satellites enviam
    // heartbeat/telemetria pra "*" ANTES de descobrir o MAC do gateway (so'
    // aprendem ao receber o 1o comando). Sem aceitar "*", o heartbeat de um
    // satellite recem-ligado nunca chegava -> o MAC dele nunca aparecia no
    // broker -> impossivel cadastrar. Aceitando "*", o satellite aparece online
    // assim que liga, revelando o MAC pra cadastro.
    bool isBroadcast = (to[0] == '*' && to[1] == 0);
    bool forMe = _lora_mac_eq(to, myMac.c_str());
    // MULTI-HOP: envelope endereçado a OUTRO no (nem eu nem broadcast). Repassa
    // em direcao ao destino FINAL (defined-path). Dedup por cmd_id + TTL evitam
    // loop. 1-salto e broadcast "*" NAO caem aqui. (Frames binarios "$B$" sao
    // 1-salto e ja' foram tratados acima — multi-hop so' vale p/ envelope JSON.)
    if (!isBroadcast && !forMe) {
        const char* cmd_id = env["cmd_id"] | "";
        if (cmd_id[0] && _sat_seen_or_add(cmd_id, env["type"] | "", from)) return;  // ja' repassado -> descarta
        int ttl = env["ttl"] | 0;
        if (ttl <= 0) return;
        const char* nh = _lora_next_hop(to);
        if (!nh || !nh[0] || _lora_mac_eq(nh, myMac.c_str())) return;
        Serial.printf("[LORA-GW] FORWARD to=%s nh=%s ttl=%d->%d\n", to, nh, ttl, ttl - 1);
        _lora_forward(env, ttl - 1);
        return;
    }
    if (!from[0]) {
        Serial.println("[LORA-GW] envelope sem 'from' — descartado");
        return;
    }
    _poll_note_activity(from);  // frame do alvo (pollresp/data/status) -> estende a janela

    const char* type = env["type"] | "";

    // MESTRE-PUXA: resposta de conclusao do POLL. O satellite ja' mandou a
    // telemetria em envelopes "data" (republicados acima/abaixo); este "pollresp"
    // so' diz "terminei, req_id=X". O orquestrador casa pelo req_id (ignora se nao
    // estava esperando esse req_id) e avanca pro proximo satellite. No fallback
    // autonomo _gw_poll_match e' stub (retorna false) -> cai e e' ignorado.
    if (strcmp(type, "pollresp") == 0) {
        const char* req_id = env["cmd_id"] | "";
        if (_gw_poll_match(req_id, from)) {
            Serial.printf("[LORA-GW] POLLRESP req_id=%s de %s — satellite respondeu, avancando\n",
                          req_id, from);
        } else {
            Serial.printf("[LORA-GW] POLLRESP req_id=%s de %s ignorado (nao esperado)\n",
                          req_id, from);
        }
        return;
    }

    // ACK do satellite — libera pendente e publica em <BASE>/satellite/<from>/cmd/ack
    if (!type[0] || strcmp(type, "ack") == 0) {
        const char* cmd_id = env["cmd_id"] | "";
        int idx = _pending_find(cmd_id);
        if (idx >= 0) {
            Serial.printf("[LORA-GW] ACK recebido cmd_id=%s slot=%d apos %d tentativas\n",
                          cmd_id, idx, _loraPending[idx].attempts);
            _pending_release(idx);
        }
        char topic[200];
        snprintf(topic, sizeof(topic), "%s/satellite/%s/cmd/ack", MQTT_TOPIC_BASE, from);
        char ack_buf[400];
        const char* status = env["status"] | "ok";
        const char* msg = env["msg"] | "";
        unsigned long ts = env["ts"] | 0UL;
        snprintf(ack_buf, sizeof(ack_buf),
                 "{\"cmd_id\":\"%s\",\"status\":\"%s\",\"msg\":\"%s\",\"ts\":%lu}",
                 cmd_id, status, msg, ts);
        mqtt_publish_raw(topic, ack_buf);
        return;
    }

    // Telemetria — re-publica em <BASE>/satellite/<from>/<subtopic>
    if (strcmp(type, "data") == 0) {
        const char* subtopic = env["subtopic"] | "";
        if (!subtopic[0]) return;
        char topic[200];
        snprintf(topic, sizeof(topic), "%s/satellite/%s/%s", MQTT_TOPIC_BASE, from, subtopic);
        char payload_buf[600];
        JsonVariant payload = env["payload"];  // mutavel (env nao e' const) p/ carimbar a hora
        if (payload.isNull()) return;
        // CARIMBO de hora no gateway (mesmo motivo do binario): so' se sincronizou e
        // se o payload e' objeto. Sobrescreve um "timestamp":0 que o satelite mande.
        {
            time_t _tnow = time(nullptr);
            if (_tnow > 1700000000 && payload.is<JsonObject>()) payload["timestamp"] = (long)_tnow;
        }
        size_t n = serializeJson(payload, payload_buf, sizeof(payload_buf));
        if (n > 0) mqtt_publish_raw(topic, payload_buf);
        return;
    }

    // Heartbeat/status do satellite — publica em <BASE>/satellite/<from>/status (retain)
    if (strcmp(type, "status") == 0) {
        JsonVariantConst payload = env["payload"];
        // DESCOBERTA DINAMICA: satelite que anuncia "poll":1 com MAC novo
        // entra na fila de polling (sem precisar do MAC no diagrama).
        if (!payload.isNull() && ((payload["poll"] | 0) == 1)) _poll_add(from, "");
        char topic[200];
        snprintf(topic, sizeof(topic), "%s/satellite/%s/status", MQTT_TOPIC_BASE, from);
        char status_buf[400];
        if (payload.isNull()) {
            // Sem payload aninhado: re-serializa envelope inteiro
            size_t n = serializeJson(env, status_buf, sizeof(status_buf));
            if (n > 0) mqtt_publish_raw(topic, status_buf);
        } else {
            size_t n = serializeJson(payload, status_buf, sizeof(status_buf));
            if (n > 0) mqtt_publish_raw(topic, status_buf);
        }
        return;
    }
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
    bb_init();   // caixa-preta: eventos e etapa do laco persistem entre reinicios
    Serial.printf("\n  %s v%s - %s\n", DEVICE_ID, FIRMWARE_VERSION, DEVICE_MODEL);
    Serial.println("  [BOOT] RS485-fix v1.1: drain RX, flush preTx, retry 0xE0, delays 80/1000us");
    Serial.println("  [BOOT] MQTT-fix v1.2: setKeepAlive(60), setSocketTimeout(8), mqtt_loop entre blocos");
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

    // LoRa
    lora_init();

    // WiFi + MQTT + OTA
    mqtt_init(process_command);
    ota_init();
    // Detecta boot pos-OTA: se em PENDING_VERIFY, arma contador de validacao.
    // Se travarmos antes de N publicacoes OK, bootloader reverte para anterior.
    ota_check_pending_verify();

    esp_task_wdt_reset();
    Serial.println("\nPronto!");
}

void loop() {
    esp_task_wdt_reset();
    diag_tick();  // atualiza min_free_heap a cada loop
    unsigned long now = millis();
    bb_stage(BB_REDE);
    mqtt_loop();
    diag_publish_periodic();  // publica MQTT_TOPIC_BASE/diagnostics a cada DIAG_INTERVAL_MS

    // Durante OTA nao fazer mais nada (flash em andamento)
    if (ota_in_progress()) { delay(1); return; }

    // I/O edge-triggered: publica entradas/saidas SOMENTE quando mudam.
    // Estado inicial publicado no boot e republicado apos cada reconexao MQTT
    // (pra o backend nunca ficar sem o estado atual). Substitui o antigo status
    // periodico de ${MQTT_STATUS_MS}ms que poluia o broker com publicacoes redundantes.
    if (now - last_input_scan >= INPUT_SCAN_MS) {
        last_input_scan = now;
        bb_stage(BB_ENTRADAS);
        inputs_scan();

        static bool _io_force = true;        // forca publicacao inicial (boot)
        static bool _mqtt_was_up = false;
        static uint8_t _prev_out = 0;

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
            mqtt_publish_raw(MQTT_TOPIC_INPUTS, buf);
        }

        // Saidas transistor (TR1-4) on-change. Em satellite vai via LoRa.
        uint8_t os = outputs_get_state();
        if (_io_force || os != _prev_out) {
            _prev_out = os;
            char obuf[60];
            snprintf(obuf, sizeof(obuf), "{\"tr1\":%d,\"tr2\":%d,\"tr3\":%d,\"tr4\":%d}",
                os&1, (os>>1)&1, (os>>2)&1, (os>>3)&1);
            mqtt_publish_raw(MQTT_TOPIC_OUTPUTS, obuf);
        }
        _io_force = false;
    }

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
