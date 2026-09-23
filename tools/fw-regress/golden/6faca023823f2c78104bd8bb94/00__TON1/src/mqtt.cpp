#include "mqtt.h"
#include "ota.h"
#include "sd_buffer.h"
#include "blackbox.h"
#include "diag.h"
#include "eth.h"
#include "config.h"
#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <EthernetUdp.h>
#include <esp_task_wdt.h>
#include <string.h>
#include <time.h>
#include <sys/time.h>

// Janelas de retry/drain — evita saturar o broker ao reconectar.
// Publicacoes sao feitas normalmente em tempo real; a drenagem do SD e gradual.
#define WIFI_RECONNECT_MS   15000UL   // tenta WiFi.reconnect() no maximo a cada 15s
#define MQTT_RECONNECT_MS   5000UL    // tenta mqtt.connect() no maximo a cada 5s
#define SD_DRAIN_INTERVAL_MS 10000UL  // drena no maximo uma vez a cada 10s
#define SD_DRAIN_BATCH       5        // no maximo 5 mensagens retro por ciclo de drain
#define SD_DRAIN_ON_RECONNECT 5       // primeira leva ao reconectar (nao sobrecarrega)
#define NET_EVAL_INTERVAL_MS 30000UL  // re-avalia rede a cada 30s (detecta cabo plugado/perdido)

// Interface ativa para o MQTT (escolhida automaticamente, troca em tempo de execucao)
enum NetIf { NET_NONE=0, NET_WIFI=1, NET_ETH=2 };
static NetIf _activeIf = NET_NONE;

static WiFiClient     _wifiClient;
static PubSubClient _mqtt(_wifiClient);  // PubSubClient::setClient() troca o transport sem recriar

// Definicao do MQTT_CLIENT_ID (extern em config.h). Preenchido no mqtt_init() a partir do MAC.
// Formato "TON-XXXXXXXXXXXX\0" = 17 chars, buffer 20 com folga.
char MQTT_CLIENT_ID[20] = "TON-uninitialized";
static mqtt_cmd_callback_t _cmdCallback = nullptr;
static unsigned long _lastReconnect = 0;
static unsigned long _reconnDelay = MQTT_RECONNECT_MS;   // B2: recuo 5 -> 60 s entre tentativas
static unsigned long _lastWifiReconnect = 0;
static unsigned long _lastDrain = 0;
static unsigned long _lastNetEval = 0;
static bool _wasConnected = false;
static bool _timeSynced = false;

// Estado do WiFi: desligado por default. Ligamos sob demanda (apenas quando Eth nao disponivel).
// Evita logs ruidosos de AUTH_EXPIRE/NO_AP_FOUND quando o cliente so usa Eth.
static bool _wifiStarted = false;

// Helpers para identificar/observar a interface ativa
static const char* _ifName(NetIf i) {
    switch (i) { case NET_WIFI: return "wifi"; case NET_ETH: return "eth"; default: return "none"; }
}

// Liga o radio WiFi e dispara conexao em background.
// Idempotente: chamadas extras nao reiniciam conexao em andamento.
// ---- Gerenciador multi-WiFi (ate WIFI_MAX_NETS) — lista em NVS, semeada da config ----
#include <Preferences.h>
static char _wifiSsid[WIFI_MAX_NETS][33];
static char _wifiPass[WIFI_MAX_NETS][65];
static int  _wifiCount = 0;
static int  _wifiIdx = 0;
static bool _wifiLoaded = false;
static unsigned long _wifiTryStart = 0;

static void _wifi_save_nvs() {
    Preferences pr; pr.begin("wifi", false);
    pr.putInt("count", _wifiCount);
    pr.putUInt("cfghash", WIFI_CONFIG_HASH);
    for (int i = 0; i < WIFI_MAX_NETS; i++) {
        char ks[6], kp[6]; snprintf(ks, sizeof(ks), "s%d", i); snprintf(kp, sizeof(kp), "p%d", i);
        if (i < _wifiCount) { pr.putString(ks, _wifiSsid[i]); pr.putString(kp, _wifiPass[i]); }
        else { pr.remove(ks); pr.remove(kp); }
    }
    pr.end();
}
static void _wifi_seed_from_config() {
    _wifiCount = WIFI_DEF_COUNT < WIFI_MAX_NETS ? WIFI_DEF_COUNT : WIFI_MAX_NETS;
    for (int i = 0; i < _wifiCount; i++) {
        strncpy(_wifiSsid[i], WIFI_DEF_SSID[i], 32); _wifiSsid[i][32] = 0;
        strncpy(_wifiPass[i], WIFI_DEF_PASS[i], 64); _wifiPass[i][64] = 0;
    }
    _wifi_save_nvs();
    Serial.printf("[WIFI] NVS semeado com %d rede(s) da config\n", _wifiCount);
}
static void _wifi_ensure_loaded() {
    if (_wifiLoaded) return;
    _wifiLoaded = true;
    Preferences pr; pr.begin("wifi", true);
    int cnt = pr.getInt("count", -1);
    unsigned int hh = pr.getUInt("cfghash", 0);
    pr.end();
    if (cnt < 0 || hh != WIFI_CONFIG_HASH) { _wifi_seed_from_config(); return; }
    pr.begin("wifi", true);
    _wifiCount = cnt < WIFI_MAX_NETS ? cnt : WIFI_MAX_NETS;
    for (int i = 0; i < _wifiCount; i++) {
        char ks[6], kp[6]; snprintf(ks, sizeof(ks), "s%d", i); snprintf(kp, sizeof(kp), "p%d", i);
        String ss = pr.getString(ks, ""); String pp = pr.getString(kp, "");
        strncpy(_wifiSsid[i], ss.c_str(), 32); _wifiSsid[i][32] = 0;
        strncpy(_wifiPass[i], pp.c_str(), 64); _wifiPass[i][64] = 0;
    }
    pr.end();
    Serial.printf("[WIFI] %d rede(s) carregada(s) do NVS\n", _wifiCount);
}
static bool _wifi_add(const char* ssid, const char* pass) {
    _wifi_ensure_loaded();
    if (!ssid || !*ssid) return false;
    for (int i = 0; i < _wifiCount; i++) if (strncmp(_wifiSsid[i], ssid, 32) == 0) {
        strncpy(_wifiPass[i], pass ? pass : "", 64); _wifiPass[i][64] = 0;
        _wifi_save_nvs(); Serial.printf("[WIFI] senha atualizada: %s\n", ssid); return true;
    }
    if (_wifiCount >= WIFI_MAX_NETS) { Serial.println("[WIFI] lista cheia (max 4)"); return false; }
    strncpy(_wifiSsid[_wifiCount], ssid, 32); _wifiSsid[_wifiCount][32] = 0;
    strncpy(_wifiPass[_wifiCount], pass ? pass : "", 64); _wifiPass[_wifiCount][64] = 0;
    _wifiCount++; _wifi_save_nvs();
    Serial.printf("[WIFI] rede adicionada: %s (%d/%d)\n", ssid, _wifiCount, WIFI_MAX_NETS); return true;
}
static bool _wifi_remove(const char* ssid) {
    _wifi_ensure_loaded();
    if (!ssid) return false;
    for (int i = 0; i < _wifiCount; i++) if (strncmp(_wifiSsid[i], ssid, 32) == 0) {
        for (int j = i; j < _wifiCount - 1; j++) { strncpy(_wifiSsid[j], _wifiSsid[j+1], 33); strncpy(_wifiPass[j], _wifiPass[j+1], 65); }
        _wifiCount--; _wifi_save_nvs();
        Serial.printf("[WIFI] rede removida: %s (%d)\n", ssid, _wifiCount); return true;
    }
    return false;
}
// Comando /cmd/wifi: {"action":"add|remove|list","ssid":"..","pass":".."}
static void _wifi_handle_cmd(const char* json) {
    StaticJsonDocument<256> d;
    if (deserializeJson(d, json) != DeserializationError::Ok) { Serial.println("[WIFI] cmd JSON invalido"); return; }
    const char* action = d["action"] | "";
    const char* ssid = d["ssid"] | "";
    const char* pass = d["pass"] | (d["password"] | "");
    if (strcmp(action, "add") == 0) _wifi_add(ssid, pass);
    else if (strcmp(action, "remove") == 0) _wifi_remove(ssid);
    else if (strcmp(action, "list") == 0) {
        _wifi_ensure_loaded();
        Serial.printf("[WIFI] lista (%d):\n", _wifiCount);
        for (int i = 0; i < _wifiCount; i++) Serial.printf("  %d: %s\n", i + 1, _wifiSsid[i]);
    }
}
// Cycling nao-bloqueante: WiFi ligado e sem conectar em WIFI_TRY_MS -> proxima rede.
static void _wifi_cycle_tick() {
    if (!_wifiStarted || _wifiCount <= 1) return;
    if (WiFi.status() == WL_CONNECTED) return;
    if (millis() - _wifiTryStart < WIFI_TRY_MS) return;
    _wifiIdx = (_wifiIdx + 1) % _wifiCount;
    Serial.printf("[WIFI] fallback -> '%s' (%d/%d)\n", _wifiSsid[_wifiIdx], _wifiIdx + 1, _wifiCount);
    WiFi.disconnect();
    WiFi.begin(_wifiSsid[_wifiIdx], _wifiPass[_wifiIdx]);
    _wifiTryStart = millis();
}

static void _start_wifi() {
    if (_wifiStarted) return;
    _wifi_ensure_loaded();
    if (_wifiCount == 0) { Serial.println("[WIFI] sem redes configuradas"); return; }
    Serial.println("[WIFI] Ligando radio (fallback / Eth indisponivel)");
    WiFi.mode(WIFI_STA);
    WiFi.setAutoReconnect(true);
    WiFi.persistent(false);
    _wifiIdx = 0;
    WiFi.begin(_wifiSsid[0], _wifiPass[0]);
    Serial.printf("[WIFI] tentando '%s' (1/%d)\n", _wifiSsid[0], _wifiCount);
    _wifiTryStart = millis();
    _wifiStarted = true;
}

// Desliga o radio WiFi por completo. Para os reconnect attempts internos da stack
// que poluem o serial com AUTH_EXPIRE/NO_AP_FOUND quando o cliente so tem Eth.
static void _stop_wifi() {
    if (!_wifiStarted) return;
    Serial.println("[WIFI] Desligando radio (Eth ativa)");
    WiFi.disconnect(true, true);   // wifioff + erase config persistida
    WiFi.mode(WIFI_OFF);
    _wifiStarted = false;
}
static String _ifLocalIp() {
    if (_activeIf == NET_ETH) return eth_local_ip().toString();
    if (_activeIf == NET_WIFI && WiFi.status() == WL_CONNECTED) return WiFi.localIP().toString();
    return String("0.0.0.0");
}
const char* mqtt_active_iface() { return _ifName(_activeIf); }

// Garante que o transport do PubSubClient bate com a interface alvo.
// Chama disconnect() antes de trocar (PubSubClient nao gosta de troca em conexao viva).
static void _setActiveIf(NetIf target) {
    if (target == _activeIf) return;
    if (_mqtt.connected()) _mqtt.disconnect();
    if (target == NET_ETH) {
        _mqtt.setClient(eth_get_client());
    } else {
        _mqtt.setClient(_wifiClient);
    }
    Serial.printf("[NET] Trocando interface: %s -> %s\n", _ifName(_activeIf), _ifName(target));
    _activeIf = target;
    _wasConnected = false;
    diag_tcp_connected = (target == NET_ETH);
}

// Avalia qual interface tem internet "boa" agora e troca se necessario.
// Politica: Ethernet ganha sempre que cabo plugado e tem IP. Se cair, volta WiFi.
// Loga MUDANCAS de estado (link UP/DOWN, IP perdido) sempre, e um heartbeat
// resumido a cada 60s pra confirmar que a avaliacao esta rodando.
static void _evalNetwork() {
    static bool _prevLink   = false;
    static bool _prevHasIp  = false;
    static bool _prevWifiOk = false;
    static unsigned long _lastHeartbeat = 0;

    bool linkUp  = eth_link_up();

    // Loga transicoes do link Ethernet (cabo plugado/desplugado)
    if (linkUp != _prevLink) {
        Serial.printf("[NET] Cabo Ethernet: link %s\n", linkUp ? "UP" : "DOWN");
        _prevLink = linkUp;
    }

    bool ethReady = false;
    if (linkUp) {
        ethReady = eth_check_dhcp();  // pode pegar IP se cabo acabou de ser plugado
    }
    bool wifiReady = (_wifiStarted && WiFi.status() == WL_CONNECTED);

    // Gestao de energia do radio WiFi: liga so' se Eth estiver indisponivel.
    // Sem Eth e WiFi off -> liga.  Com Eth e WiFi on -> desliga.
    if (!ethReady && !_wifiStarted) {
        _start_wifi();
    } else if (ethReady && _wifiStarted) {
        _stop_wifi();
    }
    _wifi_cycle_tick();   // fallback multi-WiFi: cicla pelas redes se a atual nao conectar

    // Loga transicoes de IP/conexao
    if (ethReady != _prevHasIp) {
        Serial.printf("[NET] Ethernet IP: %s\n", ethReady ? "obtido" : "perdido");
        _prevHasIp = ethReady;
    }
    if (wifiReady != _prevWifiOk) {
        Serial.printf("[NET] WiFi: %s\n", wifiReady ? "conectado" : "desconectado");
        _prevWifiOk = wifiReady;
    }

    // Decisao de troca
    if (ethReady && _activeIf != NET_ETH) {
        Serial.println("[NET] Cabo Ethernet detectado com IP — preferindo Ethernet");
        _setActiveIf(NET_ETH);
    } else if (!ethReady && _activeIf == NET_ETH && wifiReady) {
        Serial.println("[NET] Cabo Ethernet sem IP/link — voltando para WiFi");
        _setActiveIf(NET_WIFI);
    } else if (_activeIf == NET_NONE) {
        if (ethReady)        _setActiveIf(NET_ETH);
        else if (wifiReady)  _setActiveIf(NET_WIFI);
    }

    // Heartbeat a cada 60s — mostra estado das duas interfaces e quem esta ativa
    if (millis() - _lastHeartbeat > 60000UL) {
        _lastHeartbeat = millis();
        Serial.printf("[NET] estado: ativo=%s | eth=%s/%s%s | wifi=%s%s\n",
            _ifName(_activeIf),
            linkUp ? "link-UP" : "link-DOWN",
            ethReady ? "ip-OK" : "no-ip",
            (_activeIf == NET_ETH ? " *" : ""),
            wifiReady ? "OK" : "off",
            (_activeIf == NET_WIFI ? " *" : ""));
    }
}

// Forward decl
bool mqtt_publish_raw(const char* topic, const char* payload);

// Sync NTP apos WiFi conectar. Nao bloqueia — apenas arranca o processo.
// 3o servidor e' IP fixo do NTP.br (a.st1.ntp.br) — contorna o caso comum em
// redes corporativas onde DNS esta bloqueado mas UDP 123 sai.
static void _start_ntp() {
    configTime(-3 * 3600, 0, "pool.ntp.org", "time.google.com", "200.160.7.193");
}

// NTP pela pilha do W5500 (Ethernet.h tem TCP/IP PROPRIO, separado do lwIP do
// ESP32). O configTime/SNTP roda no lwIP -> so' sai pelo WiFi; em locais que so'
// tem Ethernet (cabo), o SNTP nunca sincroniza. Aqui montamos a query NTP (UDP
// 123) na mao e enviamos pela pilha do W5500 (EthernetUDP), depois setamos o
// relogio com settimeofday. IPs fixos (sem DNS). O configTime ja' setou o TZ (-3),
// entao localtime() continua certo. Retorna true se sincronizou.
static bool _ntp_eth_sync() {
    if (!eth_has_ip()) return false;
    static const char* NTP_IPS[] = { "200.160.7.193", "200.186.125.195", "162.159.200.123" };
    // 1 servidor por chamada, rotacionando. Assim o bloqueio do loop e' <=800ms
    // (nao 3 x 1.2s = 3.6s), pra nao atrapalhar o orquestrador LoRa enquanto o NTP
    // ainda nao sincronizou. As chamadas seguintes (retry a cada 5s/30s) cobrem os
    // outros servidores. Quando sincroniza, _timeSynced=true e isto nao roda mais.
    static uint8_t _ntpSrv = 0;
    const char* srvIp = NTP_IPS[_ntpSrv];
    _ntpSrv = (_ntpSrv + 1) % 3;
    IPAddress ip;
    if (!ip.fromString(srvIp)) return false;
    EthernetUDP _ntpUdp;
    if (!_ntpUdp.begin(2390)) return false;  // socket do W5500 (8 disponiveis, MQTT usa 1)
    uint8_t pkt[48];
    memset(pkt, 0, sizeof(pkt));
    pkt[0] = 0xE3;  // LI=3 (nao-sync), VN=4, Mode=3 (client)
    pkt[1] = 0; pkt[2] = 6; pkt[3] = 0xEC;
    bool sent = false;
    if (_ntpUdp.beginPacket(ip, 123)) {
        _ntpUdp.write(pkt, 48);
        sent = _ntpUdp.endPacket();
    }
    bool ok = false;
    if (sent) {
        unsigned long t0 = millis();
        while (millis() - t0 < 800) {
            // So' aceita resposta DO servidor que perguntei (origem confere) — evita
            // que um datagrama qualquer na porta injete um timestamp.
            if (_ntpUdp.parsePacket() >= 48 && _ntpUdp.remoteIP() == ip) {
                _ntpUdp.read(pkt, 48);
                // Transmit Timestamp (segundos desde 1900) nos bytes 40..43.
                unsigned long secs1900 = ((unsigned long)pkt[40] << 24) | ((unsigned long)pkt[41] << 16)
                                       | ((unsigned long)pkt[42] << 8)  |  (unsigned long)pkt[43];
                if (secs1900 > 2208988800UL) {
                    unsigned long epoch = secs1900 - 2208988800UL;  // 1900 -> 1970
                    if (epoch > 1700000000UL) {                     // sanity (>= 2023)
                        struct timeval tv; tv.tv_sec = (time_t)epoch; tv.tv_usec = 0;
                        settimeofday(&tv, nullptr);
                        Serial.printf("[NTP-ETH] sincronizado via W5500 (%s)! epoch=%lu\n",
                                      srvIp, epoch);
                        ok = true;
                    }
                }
                break;  // resposta do servidor certo recebida (valida ou nao)
            }
            delay(10);
            esp_task_wdt_reset();
        }
    }
    _ntpUdp.stop();  // libera o socket do W5500
    return ok;
}

// Salva no SD com timestamp injetado no JSON (se possivel).
// Formato: "{\"ts\":<epoch>, ... resto do payload}"
// Se o relogio nao estiver sincronizado, ou o payload nao for JSON,
// salva como esta (sem ts) para nao perder dados.
static void _store_offline(const char* topic, const char* payload) {
    time_t now = time(nullptr);
    bool haveTime = (now > 1700000000);
    if (haveTime) _timeSynced = true;

    if (haveTime && payload && payload[0] == '{' && strstr(payload, "\"ts\"") == nullptr) {
        // Cabe ate ~3200 bytes (payload de inversor + overhead do ts)
        char withTs[3200];
        int n = snprintf(withTs, sizeof(withTs), "{\"ts\":%lu,%s",
                         (unsigned long)now, payload + 1);
        if (n > 0 && n < (int)sizeof(withTs)) {
            sd_buffer_store(topic, withTs);
            return;
        }
    }
    sd_buffer_store(topic, payload);
}

// Forward decl: gateway router precisa estar declarado pra _onMessage chamar.


// Callback unico: despacha OTA (TOPIC_BASE/ota/cmd) antes de entregar o
// restante ao callback de usuario (TOPIC_BASE/cmd).
static void _onMessage(char* topic, byte* payload, unsigned int len) {
    static char buf[1200]; // grande para caber JSON OTA
    if (len >= sizeof(buf)) len = sizeof(buf) - 1;
    memcpy(buf, payload, len);
    buf[len] = 0;

    if (strstr(topic, "/ota/cmd") != nullptr) {
        Serial.printf("[MQTT] OTA cmd recebido (%u bytes)\n", len);
        ota_handle_command(buf);
        return;
    }

    Serial.printf("[MQTT] Recebido: %s -> %s\n", topic, buf);
    if (strstr(topic, "/cmd/wifi") != nullptr) {   // config multi-WiFi em runtime (add/remove/list)
        _wifi_handle_cmd(buf);
        return;
    }
    if (_cmdCallback) _cmdCallback(buf);
}

// =====================================================================
// AUTO-RECUPERACAO — watchdog de conectividade (caso NS Aparecida, 01/08->16/09:
// TON 47 dias sem broker com o WiFi "conectado" e a rede da fazenda funcionando;
// so' voltou tirando da tomada). Nada aqui depende de ter mais de uma rede WiFi.
//   1) MQTT fora ha NETWD_REASSOC_MS com WiFi associado  -> desassocia e reassocia
//      (se houver mais de uma rede cadastrada, passa pra proxima)
//   2) MQTT fora ha 10 / 30 / 60 min (recuo por reinicio seguido) -> ESP.restart()
//      Se o proprio broker estiver fora, a TON reinicia no maximo 1x/hora (dados no SD).
// O relogio e' preservado no reinicio (RTC noinit) — sem internet ainda carimba certo.
// Reinicio so' e' executado se for seguro (sem OTA em curso; posto ocioso/bloqueado).
// =====================================================================
#define NETWD_REASSOC_MS   180000UL
#define NETWD_STABLE_MS    300000UL   // conectado ha 5 min => zera o recuo
static const unsigned long NETWD_RESTART_MS[3] = { 600000UL, 1800000UL, 3600000UL };
#define NETWD_MAGIC        0x544F4E57UL
RTC_NOINIT_ATTR static uint32_t _rtcMagic;
RTC_NOINIT_ATTR static uint32_t _rtcRestarts;
RTC_NOINIT_ATTR static uint32_t _rtcEpoch;
RTC_NOINIT_ATTR static char     _rtcCause[24];
static char _bootCause[24] = "";
static unsigned long _lastMqttOkMs = 0, _mqttConnSince = 0, _lastReassocMs = 0, _lastRestartTry = 0;
static unsigned long _restartAt = 0;
static unsigned long _lastEthReset = 0;
static char _restartReason[24] = "";

bool mqtt_restart_permitido() {
    if (ota_in_progress()) return false;
    return true;
}

const char* mqtt_restart_cause() { return _bootCause; }
unsigned long mqtt_conn_age_ms() { return (_mqtt.connected() && _mqttConnSince) ? millis() - _mqttConnSince : 0xFFFFFFFFUL; }

static bool _doRestart(const char* reason) {
    if (!mqtt_restart_permitido()) {
        Serial.printf("[SYS] reinicio (%s) adiado: TON ocupada (OTA/abastecimento)\n", reason);
        return false;
    }
    time_t nowE = time(nullptr);
    // D0 gestor unico: no maximo 4 reinicios automaticos em 6 h (comando manual e o
    // watchdog de broker, que ja' tem recuo de ate' 1/h, ficam fora do teto).
    bool automatico = strcmp(reason, "comando") != 0 && strcmp(reason, "sem_broker") != 0;
    if (automatico && nowE > 1700000000) {
        // Historico no NVS (nao na RTC): sobrevive a queda de energia real / brownout.
        uint32_t ts[4] = {0, 0, 0, 0};
        Preferences pr;
        if (pr.begin("sysrst", true)) { if (pr.getBytesLength("ts") == sizeof(ts)) pr.getBytes("ts", ts, sizeof(ts)); pr.end(); }
        int recentes = 0;
        for (int i = 0; i < 4; i++) if (ts[i] && (uint32_t)nowE - ts[i] < 21600UL) recentes++;
        if (recentes >= 4) {
            Serial.printf("[SYS] reinicio (%s) NEGADO: teto de 4 reinicios automaticos em 6 h\n", reason);
            bb_log("reinicio %s negado: teto 4/6h", reason);
            return false;
        }
        for (int i = 3; i > 0; i--) ts[i] = ts[i - 1];
        ts[0] = (uint32_t)nowE;
        if (pr.begin("sysrst", false)) { pr.putBytes("ts", ts, sizeof(ts)); pr.end(); }
    }
    strncpy(_rtcCause, reason, sizeof(_rtcCause) - 1); _rtcCause[sizeof(_rtcCause) - 1] = 0;
    _rtcEpoch = (nowE > 1700000000) ? (uint32_t)nowE : 0;
    _rtcMagic = NETWD_MAGIC;
    Serial.printf("[SYS] REINICIANDO a TON (motivo: %s, reinicios seguidos: %lu)\n", reason, (unsigned long)_rtcRestarts);
    bb_log("reinicio: %s", reason);
    bb_flush();
    sd_buffer_flush();
    if (_mqtt.connected()) { _mqtt.disconnect(); }
    delay(200);
    ESP.restart();
    return true;
}

void mqtt_request_restart(const char* reason, unsigned long delay_ms) {
    strncpy(_restartReason, reason ? reason : "comando", sizeof(_restartReason) - 1);
    _restartReason[sizeof(_restartReason) - 1] = 0;
    _restartAt = millis() + (delay_ms ? delay_ms : 1);
}

static void _netwdInit() {
    if (_rtcMagic != NETWD_MAGIC || esp_reset_reason() == ESP_RST_POWERON || esp_reset_reason() == ESP_RST_BROWNOUT) {
        _rtcMagic = NETWD_MAGIC; _rtcRestarts = 0; _rtcEpoch = 0; _rtcCause[0] = 0;
    }
    _rtcCause[sizeof(_rtcCause) - 1] = 0;
    strncpy(_bootCause, _rtcCause, sizeof(_bootCause) - 1);
    _rtcCause[0] = 0;
    // Relogio: reinicio por software nao zera o RTC do ESP32, mas a hora do sistema sim.
    // Restaura a ultima hora conhecida (+3 s do boot) ate o NTP corrigir.
    if (_bootCause[0] && _rtcEpoch > 1700000000UL && time(nullptr) < 1700000000) {
        struct timeval tv; tv.tv_sec = (time_t)_rtcEpoch + 3; tv.tv_usec = 0;
        settimeofday(&tv, nullptr);
        Serial.printf("[SYS] hora restaurada apos reinicio (%s): epoch=%lu\n", _bootCause, (unsigned long)tv.tv_sec);
    }
    _rtcEpoch = 0;
    if (_bootCause[0]) Serial.printf("[SYS] boot apos reinicio pedido pelo firmware: %s (seguidos: %lu)\n", _bootCause, (unsigned long)_rtcRestarts);
    _lastMqttOkMs = millis();
}

static void _netWatchdog() {
    unsigned long now = millis();
    if (_restartAt && (long)(now - _restartAt) >= 0) {
        if (_doRestart(_restartReason)) return;
        _restartAt = now + 30000UL;   // ocupada: tenta de novo em 30 s
    }
    if (_mqtt.connected()) {
        _lastMqttOkMs = now;
        if (_rtcRestarts && _mqttConnSince && now - _mqttConnSince > NETWD_STABLE_MS) {
            Serial.println("[SYS] conexao estavel: recuo do watchdog zerado");
            _rtcRestarts = 0;
        }
        return;
    }
    unsigned long off = now - _lastMqttOkMs;
    // 1) WiFi "conectado" mas sem broker: forca nova associacao (mesma rede se so' houver uma)
    if (off > NETWD_REASSOC_MS && now - _lastReassocMs > NETWD_REASSOC_MS
        && _wifiStarted && _activeIf != NET_ETH && WiFi.status() == WL_CONNECTED && _wifiCount > 0) {
        _lastReassocMs = now;
        if (_wifiCount > 1) _wifiIdx = (_wifiIdx + 1) % _wifiCount;
        bb_log("sem broker %lus: reassocia wifi", (unsigned long)(off / 1000));
        Serial.printf("[SYS] sem broker ha %lus com WiFi associado -> reassociando em '%s'\n",
                      (unsigned long)(off / 1000), _wifiSsid[_wifiIdx]);
        WiFi.disconnect();
        WiFi.begin(_wifiSsid[_wifiIdx], _wifiPass[_wifiIdx]);
        _wifiTryStart = now;
    }
    // 1b) Ethernet ativa, cabo com link e sem broker ha 5 min: reset FISICO do W5500 (IO14).
    //     Criterio ativo (broker nao responde), nao "sem trafego": o keepalive MQTT e' obrigatorio.
    if (_activeIf == NET_ETH && eth_link_up() && off > 300000UL && now - _lastEthReset > 300000UL) {
        _lastEthReset = now;
        if (_mqtt.connected()) _mqtt.disconnect();
        bb_log("eth sem broker 5 min: reset W5500");
        eth_hw_reset();
    }
    // D2) Memoria livre abaixo de 40 kB por 60 s seguidos -> reinicio (sujeito ao teto global)
    {
        static unsigned long _lowHeapSince = 0;
        if (ESP.getFreeHeap() < 40000UL) {
            if (!_lowHeapSince) _lowHeapSince = now;
            if (now - _lowHeapSince > 60000UL && now - _lastRestartTry > 60000UL) {
                _lastRestartTry = now;
                bb_log("memoria baixa %lu bytes", (unsigned long)ESP.getFreeHeap());
                _doRestart("memoria_baixa");
            }
        } else _lowHeapSince = 0;
    }
    // 2) Reinicio com recuo (10 / 30 / 60 min)
    uint32_t k = _rtcRestarts < 2 ? _rtcRestarts : 2;
    if (off > NETWD_RESTART_MS[k] && now - _lastRestartTry > 60000UL) {
        _lastRestartTry = now;
        if (_rtcRestarts < 1000) _rtcRestarts++;
        if (!_doRestart("sem_broker")) { if (_rtcRestarts) _rtcRestarts--; }
    }
}

void mqtt_init(mqtt_cmd_callback_t callback) {
    _cmdCallback = callback;

    // 1) Captura o MAC ANTES de mexer com radios — WiFi.macAddress() le do efuse
    //    e funciona independente do WIFI_MODE. Garantia de identidade estavel.
    uint8_t _mac_for_id[6];
    WiFi.macAddress(_mac_for_id);

    // 2) Ethernet (W5500) — tenta primeiro. Se cabo plugado com IP, ETH vence
    //    e o radio WiFi sequer e' ligado (evita logs spurious de AUTH_EXPIRE).
    eth_hw_init();
    bool ethReady = eth_check_dhcp();   // tenta DHCP se link UP

    // 3) WiFi — so' liga se Eth nao estiver disponivel. Se Eth cair depois,
    //    _evalNetwork() religa o WiFi como fallback (e desliga quando Eth volta).
    if (ethReady) {
        Serial.println("[NET] Ethernet OK no boot — WiFi ficara OFF (auto fallback se Eth cair)");
        WiFi.mode(WIFI_OFF);
        _wifiStarted = false;
        _setActiveIf(NET_ETH);
        _start_ntp();        // seta o TZ (-3h); o SNTP/lwIP NAO sai pela pilha do W5500
        _ntp_eth_sync();     // sincroniza JA pela pilha do W5500 (NTP via EthernetUDP)
    } else {
        _start_wifi();
        Serial.printf("[WIFI] Conectando a '%s'...\n", WIFI_SSID);
        unsigned long t = millis();
        while (WiFi.status() != WL_CONNECTED && millis() - t < WIFI_TIMEOUT_MS) {
            delay(500); Serial.print(".");
            esp_task_wdt_reset();
        }
        if (WiFi.status() == WL_CONNECTED) {
            Serial.printf("\n[WIFI] IP: %s\n", WiFi.localIP().toString().c_str());
            _setActiveIf(NET_WIFI);
            _start_ntp();
        } else {
            Serial.println("\n[WIFI] FALHOU no boot - continuara tentando em background");
        }
    }

    // 4) MQTT_CLIENT_ID derivado do MAC — unico por hardware, evita colisao de IDs
    //    que estava causando 26k+ desconexoes/dia no broker (10 IPs em "TON1-TON1").
    snprintf(MQTT_CLIENT_ID, sizeof(MQTT_CLIENT_ID),
             "TON-%02X%02X%02X%02X%02X%02X",
             _mac_for_id[0], _mac_for_id[1], _mac_for_id[2],
             _mac_for_id[3], _mac_for_id[4], _mac_for_id[5]);
    Serial.printf("[MQTT] client_id (do MAC): %s\n", MQTT_CLIENT_ID);

    // MQTT (PubSubClient — transport ja foi setado por _setActiveIf)
    _mqtt.setServer(MQTT_SERVER, MQTT_PORT);
    bool bufok = _mqtt.setBufferSize(MQTT_BUFFER_SIZE);
    Serial.printf("[MQTT] Buffer %d bytes: %s\n", MQTT_BUFFER_SIZE, bufok ? "OK" : "FAIL (heap?)");
    _mqtt.setCallback(_onMessage);
    // Default PubSubClient: keepalive 15s, socket timeout 15s — apertado demais.
    // Um sample Modbus com 1-2 timeouts pode passar de 15s (lib ModbusMaster
    // timeout = 2s/transacao, nao configuravel). 60s/30s da' folga real.
    _mqtt.setKeepAlive(60);
    _mqtt.setSocketTimeout(8);   // B1 anti-travamento: broker que aceita TCP e nao responde prendia o laco 30 s
    _netwdInit();
}

void mqtt_loop() {
    _netWatchdog();   // auto-recuperacao (reassocia / reinicia com recuo)
    sd_buffer_tick(); // fila do SD: contagem inicial fatiada + remontagem do cartao com falha
    // Mantem stack do W5500 atualizada (DHCP renew, etc.)
    eth_maintain();

    // Re-avalia interface ativa periodicamente — detecta cabo plugado/perdido a quente.
    if (millis() - _lastNetEval > NET_EVAL_INTERVAL_MS) {
        _lastNetEval = millis();
        _evalNetwork();
    }

    // Detecta queda de WiFi para o contador (so' conta se o radio estiver ligado)
    static bool _wifiWasConn = false;
    bool wifiNow = (_wifiStarted && WiFi.status() == WL_CONNECTED);
    if (_wifiWasConn && !wifiNow) {
        diag_wifi_disconnects++;
        Serial.printf("[ALERTA] WiFi desconectou (#%lu)\n", (unsigned long)diag_wifi_disconnects);
        bb_log("wifi caiu #%lu", (unsigned long)diag_wifi_disconnects);
    }
    _wifiWasConn = wifiNow;

    // Tem alguma rede usavel? (Ethernet com IP OU WiFi conectado)
    bool ethOk = eth_has_ip();
    bool netUp = ethOk || wifiNow;

    if (!netUp) {
        // Sem nenhuma rede. Garante que o WiFi esta ligado pra tentar fallback
        // (se ETH cair, ainda nao foi processado por _evalNetwork ainda).
        if (!_wifiStarted) _start_wifi();
        // Tenta reconectar WiFi em background (rate-limited).
        if (millis() - _lastWifiReconnect > WIFI_RECONNECT_MS) {
            _lastWifiReconnect = millis();
            Serial.println("[WIFI] Desconectado — reconectando em background...");
            WiFi.reconnect();
        }
        if (_wasConnected) {
            Serial.println("[MQTT] DESCONECTADO - mensagens irao para o SD (com timestamp)");
            bb_log("mqtt caiu (sem rede)");
            _wasConnected = false;
            diag_mqtt_disconnects++;
        }
        return;
    }

    // Se eh a primeira vez que temos rede, decide a interface inicial.
    if (_activeIf == NET_NONE) {
        _setActiveIf(ethOk ? NET_ETH : NET_WIFI);
    }

    // WiFi/Eth OK — rekick NTP ate sincronizar. Usa variavel separada
    // (_lastNtpKick) pra nao competir com o rate-limit do WiFi.reconnect().
    // Intervalo agressivo (5s) nos primeiros 5min depois do boot — periodo
    // critico onde o TON precisa carimbar timestamps validos. Depois espaca
    // pra 30s pra reduzir trafego.
    if (!_timeSynced) {
        time_t now = time(nullptr);
        if (now < 1700000000) {
            static unsigned long _lastNtpKick = 0;
            unsigned long retryInterval = (millis() < 300000UL) ? 5000UL : 30000UL;
            if (millis() - _lastNtpKick > retryInterval) {
                _lastNtpKick = millis();
                // Ethernet (W5500) tem pilha TCP/IP propria -> SNTP/lwIP nao roteia
                // por ela. Usa o NTP via EthernetUDP. WiFi usa o SNTP (lwIP) normal.
                if (_activeIf == NET_ETH) _ntp_eth_sync();
                else _start_ntp();
                Serial.printf("[NTP] retry (uptime=%lus, epoch=%lu)\n",
                              (unsigned long)(millis()/1000), (unsigned long)now);
            }
        } else {
            _timeSynced = true;
            Serial.printf("[NTP] sincronizado! epoch=%lu\n", (unsigned long)now);
        }
    }

    if (_mqtt.connected()) {
        _mqtt.loop();
        // Drena retroativo aos poucos: no maximo SD_DRAIN_BATCH msgs por SD_DRAIN_INTERVAL_MS.
        // Isto garante que tempo real + retroativo nao sobrecarregue o broker.
        if (millis() - _lastDrain > SD_DRAIN_INTERVAL_MS) {
            _lastDrain = millis();
            int pending = sd_buffer_pending();
            if (pending > 0) {
                Serial.printf("[MQTT] Drenando retroativo (%d pendentes, batch %d)...\n",
                              pending, SD_DRAIN_BATCH);
                sd_buffer_drain(mqtt_publish_raw, SD_DRAIN_BATCH);
            }
        }
        return;
    }

    // MQTT desconectado (mas WiFi OK) — tentar reconectar
    if (_wasConnected) {
        Serial.println("[MQTT] DESCONECTADO - mensagens irao para o SD (com timestamp)");
        bb_log("mqtt caiu (rede ok) rc=%d", _mqtt.state());
        _wasConnected = false;
        diag_mqtt_disconnects++;
    }
    if (millis() - _lastReconnect < _reconnDelay) return;
    _lastReconnect = millis();

    Serial.printf("[MQTT] Conectando a %s:%d (%s)...\n", MQTT_SERVER, MQTT_PORT, MQTT_CLIENT_ID);
    // Last Will em TOPIC_BASE/status (QoS 1, retained) -> sinaliza offline se cair
    String willTopic = String(MQTT_TOPIC_BASE) + "/status";
    const char* willMsg = "{\"online\":false}";

    bool ok;
    if (strlen(MQTT_USER) > 0) {
        ok = _mqtt.connect(MQTT_CLIENT_ID, MQTT_USER, MQTT_PASS,
                           willTopic.c_str(), 1, true, willMsg);
    } else {
        ok = _mqtt.connect(MQTT_CLIENT_ID, nullptr, nullptr,
                           willTopic.c_str(), 1, true, willMsg);
    }

    if (!ok) {
        _reconnDelay = (_reconnDelay >= 30000UL) ? 60000UL : _reconnDelay * 2;
        Serial.printf("[MQTT] falha (rc=%d) - nova tentativa em %lus\n", _mqtt.state(), (unsigned long)(_reconnDelay / 1000));
        { static unsigned long _lastFailLog = 0; if (!_lastFailLog || millis() - _lastFailLog > 600000UL) { _lastFailLog = millis(); bb_log("mqtt nao conecta rc=%d", _mqtt.state()); } }
    }
    if (ok) {
        _reconnDelay = MQTT_RECONNECT_MS;
        Serial.println("[MQTT] Conectado!");
        _mqttConnSince = millis();
        bb_log("mqtt ok via %s rssi=%d", _ifName(_activeIf), (int)WiFi.RSSI());
        _wasConnected = true;
        _mqtt.subscribe(MQTT_TOPIC_CMD);
        { String wt = String(MQTT_TOPIC_BASE) + "/cmd/wifi"; _mqtt.subscribe(wt.c_str()); Serial.printf("[MQTT] Inscrito em: %s\n", wt.c_str()); }
        String otaCmdTopic = String(MQTT_TOPIC_BASE) + "/ota/cmd";
        _mqtt.subscribe(otaCmdTopic.c_str());
        Serial.printf("[MQTT] Inscrito em: %s\n[MQTT] Inscrito em: %s\n",
                      MQTT_TOPIC_CMD, otaCmdTopic.c_str());


        // Announce online + identidade (retained). Inclui MAC, IP da interface
        // ativa e qual interface (wifi/eth) — backend usa para auto-discovery.
        char hello[256];
        snprintf(hello, sizeof(hello),
                 "{\"online\":true,\"version\":\"%s\",\"model\":\"%s\",\"mac\":\"%s\",\"ip\":\"%s\",\"iface\":\"%s\",\"reset\":\"%s\",\"restart_cause\":\"%s\"}",
                 FIRMWARE_VERSION, DEVICE_MODEL,
                 WiFi.macAddress().c_str(),
                 _ifLocalIp().c_str(),
                 _ifName(_activeIf),
                 diag_reset_reason(), _bootCause);
        _mqtt.publish(willTopic.c_str(), hello, true);
        bb_publish(mqtt_publish_raw, MQTT_TOPIC_BASE, true);   // caixa-preta: eventos ainda nao enviados

        // Primeira leva ao reconectar — pequena, so pra confirmar fluxo.
        // O resto sera drenado pelo _lastDrain no mqtt_loop, aos poucos.
        int pending = sd_buffer_pending();
        if (pending > 0) {
            Serial.printf("[MQTT] Reconectado - %d mensagens no SD, iniciando drain gradual...\n", pending);
            sd_buffer_drain(mqtt_publish_raw, SD_DRAIN_ON_RECONNECT);
            _lastDrain = millis();  // espera SD_DRAIN_INTERVAL_MS antes do proximo lote
        }
    }
}

// Publica direto, sem fallback de SD (usado pela drain para evitar loop)
bool mqtt_publish_raw(const char* topic, const char* payload) {
    if (!_mqtt.connected()) return false;
    bool ok = _mqtt.publish(topic, payload);
    if (ok) diag_mqtt_pub++;
    else    diag_publish_fails++;
    return ok;
}

bool mqtt_publish(const char* topic, const char* payload) {
    if (!_mqtt.connected()) {
        Serial.printf("[MQTT] PUB FAIL (desconectado): %s -> SD\n", topic);
        diag_publish_fails++;
        _store_offline(topic, payload);
        return false;
    }
    size_t plen = strlen(payload);
    size_t tlen = strlen(topic);
    bool ok = _mqtt.publish(topic, payload);
    if (ok) {
        diag_mqtt_pub++;
        // Sinaliza execucao saudavel: apos N pubs OK pos-OTA,
        // confirma firmware como valido (cancela rollback do bootloader).
        ota_confirm_valid_if_needed();
    } else {
        diag_publish_fails++;
        Serial.printf("[MQTT] PUB FAIL: %s (payload=%u bytes, topic=%u bytes, state=%d) -> SD\n",
                      topic, (unsigned)plen, (unsigned)tlen, _mqtt.state());
        _store_offline(topic, payload);
    }
    return ok;
}

bool mqtt_connected() { return _mqtt.connected(); }
