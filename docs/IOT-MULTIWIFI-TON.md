# IOT — Multi-WiFi na TON (até 4 redes, OTA + runtime)

> Prevenir ida a campo quando a rede/senha WiFi vai mudar: a TON guarda até 4 redes
> e cai de uma pra outra sozinha. Dá pra pré-cadastrar a rede nova **a distância**
> antes da troca. Data: 2026-09-01. Relacionados: `feedback_ota_safety_required`,
> `project_ton_w5500_ntp` (a TON tem 2 pilhas: Ethernet primária + WiFi fallback).

## 1. Ideia / caso de uso

O dono avisou que **um WiFi vai trocar de senha**. Antes: precisava ir no local
reflashar/reconfigurar depois da troca (a TON ficava offline no meio). Agora:

1. Enquanto a TON **ainda está online** na rede atual, adiciono a rede NOVA a
   distância (OTA de config **ou** comando de runtime).
2. Quando a rede antiga cair/trocar senha, a TON **conecta sozinha** na nova.
3. Depois (opcional) removo a antiga.

Ethernet (W5500) continua sendo a primária; **isto é só a pilha WiFi de fallback**.
Se o cabo estiver de pé, o WiFi fica OFF de qualquer jeito (gestão de energia do
rádio já existente em `_evalNetwork`).

## 2. Dois métodos (ambos implementados)

| Método | Como | Quando |
|---|---|---|
| **OTA / config** | No diagrama IoT, no nó **Roteador WiFi**, preencho SSID + Senha (1) e as opcionais **SSID 2/3/4**. Gera firmware → OTA. | Trocar a lista inteira; primeira instalação. |
| **Runtime (sem reflash)** | `POST /api/v1/equipamentos/:id/cmd/wifi` `{action:"add|remove|list", ssid, pass}`. Publica em `<base>/cmd/wifi`. | Ajuste rápido numa TON já em campo. |

Precedência: um OTA de config **nova** sobrescreve a lista do NVS (via hash, §4);
mudanças de runtime feitas **depois** de um OTA persistem até o próximo OTA que
mude a lista.

## 3. Firmware (gerado)

Vale pros dois geradores: `iot-firmware-generator.v2.js` (TON v1) e
`iot-firmware-generator.ton-v2.js` (TON v2) — **mudança idêntica nos dois**.

- **config.h**: emite `WIFI_DEF_SSID[]` / `WIFI_DEF_PASS[]` / `WIFI_DEF_COUNT`
  (a lista compilada), `WIFI_MAX_NETS 4`, `WIFI_TRY_MS 20000`, e
  `WIFI_CONFIG_HASH` (FNV-1a da lista). `WIFI_SSID`/`WIFI_PASSWORD` continuam
  (compat = rede 1).
- **Gerenciador** (bloco novo antes de `_start_wifi`): lista em **NVS**
  (`Preferences`, namespace `"wifi"`), com `_wifi_ensure_loaded` (lazy),
  `_wifi_seed_from_config`, `_wifi_add/_remove`, `_wifi_handle_cmd`,
  `_wifi_cycle_tick`.
- **`_start_wifi`**: carrega o NVS, começa pela rede 1 (`WiFi.begin` não-bloqueante).
- **`_evalNetwork`** (a cada 30 s): chama `_wifi_cycle_tick()` → se o rádio está
  ligado e **não conectou em `WIFI_TRY_MS`**, tenta a próxima rede (round-robin).
- **Dispatcher MQTT**: `<base>/cmd/wifi` é tratado **antes** do `_cmdCallback`
  (isolado como o `rfid_sync`), e assinado junto do `MQTT_TOPIC_CMD`.
  `WiFi.persistent(false)` (a verdade é o nosso NVS, não o do SDK).

### Comando `<base>/cmd/wifi` (payload)
```json
{ "action": "add",    "ssid": "RedeNova", "pass": "senha123" }
{ "action": "remove", "ssid": "RedeVelha" }
{ "action": "list" }   // só loga no Serial
```
`add` num SSID que já existe = **atualiza a senha**. Lista cheia (4) recusa `add`.
**Fire-and-forget**: o firmware NÃO manda ack neste tópico; a TON precisa estar
online quando o comando chega. Publicado **QoS 1, NÃO retido** de propósito (um
`remove` retido re-aplicaria a cada boot).

## 4. Semântica do config-hash (por que o NVS não é atropelado)

No boot, `_wifi_ensure_loaded` compara `cfghash` salvo no NVS com
`WIFI_CONFIG_HASH` do binário atual:
- **igual** → usa a lista do NVS (preserva o que foi mexido em runtime).
- **diferente ou vazio** → **semeia** o NVS com a lista da config e grava o hash.

Ou seja: só um firmware com **lista diferente** (OTA de config nova) reseta o NVS.
Reflashar o *mesmo* firmware não apaga as redes adicionadas em runtime.

## 5. Backend

- `EquipamentosCmdService.configurarWifi()` + `POST /equipamentos/:id/cmd/wifi`
  (`ConfigurarWifiDto`). Permission **`equipamentos.comandar`** (mesma do cmd normal),
  escopo por dono (`assertEntityInScope`). Publica via `mqtt.publish(<base>/cmd/wifi, …,
  {qos:1, retain:false})`. **Nunca loga a senha.** Valida `ssid` obrigatório em
  add/remove; 503 se broker off.

## 6. Pendências / bancada (firmware NÃO testado localmente — não compila aqui)

1. **Compilar + flashar** os dois firmwares numa TON de bancada (v1 e v2).
2. Validar: (a) boot com 2+ redes, derruba a 1ª, confirma fallback pra 2ª em
   ~`WIFI_TRY_MS`; (b) `add`/`remove`/`list` via `/cmd/wifi` com a TON online;
   (c) reflash do mesmo bin **preserva** o NVS; OTA de lista diferente **semeia**.
3. Warning possível: `static const char* WIFI_DEF_*[]` em header incluído por vários
   TUs → `-Wunused-variable` onde não é usado (não quebra sem `-Werror`).
4. Confirmar que o cache-bust `IOT_SCRIPTS_VERSION='20260901-multiwifi'` fez o
   navegador rebaixar os geradores novos.

## 7. Log
- **2026-09-01** — Multi-WiFi (até 4) implementado nos 2 geradores + campo no
  diagrama (Roteador WiFi: SSID 2/3/4) + endpoint runtime `/cmd/wifi`. Front
  buildado/deployado (dist), backend rebuildado + pm2 restart. Falta bancada.
