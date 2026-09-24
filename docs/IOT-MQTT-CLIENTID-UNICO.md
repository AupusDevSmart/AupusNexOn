# Plano de Desenvolvimento: MQTT_CLIENT_ID único por TON

**Data**: 2026-05-27
**Status**: **implementado 2026-05-27 commit `4a77ddf`, deploy AupusNexOn OK. Aguardando reflash das 10 TONs em campo.**
**Escopo**: gerador de firmware (`AupusNexOn/public/iot-firmware-generator.v2.js`) e firmware-base
**Out-of-scope**: renomeação das 6 TONs no banco (fase separada, ver §8)

---

## 1. Problema

6 TONs físicas em campo, **todas configuradas com `name="TON1"`** no cadastro do banco. Isso faz o gerador emitir `#define MQTT_CLIENT_ID "TON1-TON1"` para **todas as 6**. No broker MQTT, **client_id é chave única** (spec 3.1.1 §3.1.3.2): quando dois clientes conectam com mesmo ID, o broker **chuta o anterior** ao aceitar o novo.

**Sintoma confirmado**: capturado em 2026-05-27 com `mosquitto_sub -h 72.60.158.163 -t 'JOAO/GO/CF/UFV/status'`:
```
{"online":true, "version":"1.2.0-mqttkeepalive", ...}
{"online":false}    ← Last Will disparado (broker chutou)
{"online":true, ...}
{"online":false}
...   (repete a cada ~4s)
```

**Confirmação numérica do banco**:
```sql
SELECT propriedades->>'name', COUNT(*)
FROM iot_componentes WHERE tipo='ton1' GROUP BY 1;
-- TON1 | 6        ← 6 TONs, mesmo nome
```

→ **6 conexões competindo pelo mesmo client_id** = ping-pong infinito no broker.

---

## 2. Diagnóstico — por que aconteceu

`MQTT_CLIENT_ID` é montado em compile-time a partir do `hostname` (campo `name` do componente TON na UI):

[iot-firmware-generator.v2.js:495](../AupusNexOn/public/iot-firmware-generator.v2.js#L495):
```c
#define MQTT_CLIENT_ID   "${spec.tonType.toUpperCase()}-" DEVICE_ID
#define DEVICE_ID        "${spec.hostname}"
```

`hostname` vem de `ton.props.name`. Se 6 TONs foram cadastradas com nome default ("TON1") e nunca renomeadas, todas produzem o mesmo client_id.

A causa raiz é dupla:
1. **Cadastro permite nomes duplicados** (sem unique constraint) → erro de UX
2. **Client_id depende só do hostname** (sem componente único de hardware) → erro de arquitetura

Este plano resolve **a #2** (arquitetura). A #1 fica para sessão separada (§8).

---

## 3. Estado atual — snapshot do código

### 3.1 `MQTT_CLIENT_ID`

[iot-firmware-generator.v2.js:495](../AupusNexOn/public/iot-firmware-generator.v2.js#L495):
```c
#define MQTT_CLIENT_ID      "${spec.tonType.toUpperCase()}-" DEVICE_ID
```

Compile-time. Sem componente de hardware. **Colide** quando hostname duplica.

### 3.2 Uso atual no `_mqtt.connect()`

[iot-firmware-generator.v2.js:1287-1292](../AupusNexOn/public/iot-firmware-generator.v2.js#L1287):
```cpp
if (strlen(MQTT_USER) > 0) {
    ok = _mqtt.connect(MQTT_CLIENT_ID, MQTT_USER, MQTT_PASS, ...);
} else {
    ok = _mqtt.connect(MQTT_CLIENT_ID, nullptr, nullptr, ...);
}
```

`MQTT_CLIENT_ID` é tratado como string literal. Trivialmente substituível por uma `String` runtime.

### 3.3 Last Will Topic — não depende de client_id

[iot-firmware-generator.v2.js:1283](../AupusNexOn/public/iot-firmware-generator.v2.js#L1283):
```cpp
String willTopic = String(MQTT_TOPIC_BASE) + "/status";
```

Mudança no client_id **não quebra** o LWT — topic é derivado de `MQTT_TOPIC_BASE` (independente).

### 3.4 OTA não depende do client_id

[ota.service.ts:63-64](../aupus-nexon-api/src/modules/ota/ota.service.ts#L63):
```typescript
const topic = `${equipamento.topico_mqtt}/ota/cmd`;
```

OTA publica em path baseado em `topico_mqtt` da tabela `equipamentos`. **Independente do client_id**.

### 3.5 Backend não filtra por client_id

Grep em `aupus-nexon-api/src/shared/mqtt/`: nenhuma referência a `clientId` que assume padrão específico. **Sem risco interno**.

### 3.6 ACL no broker — **ainda desconhecido**

⚠️ Precisa de comando SSH em `72.60.158.163` antes do deploy (ver §6.1). Se houver ACL que filtra por prefix `TON1-*`, a mudança quebra. Risco baixo, mas precisa confirmar.

---

## 4. Solução proposta

### 4.1 Geração do client_id em runtime

Substituir o `#define` por uma função inline que monta o ID com o MAC completo. **Decisão**: MAC completo (12 hex chars) — máxima unicidade, formato `TON-<MAC_hex_sem_separador>`.

**Diff proposto** em [iot-firmware-generator.v2.js](../AupusNexOn/public/iot-firmware-generator.v2.js):

```diff
-#define MQTT_CLIENT_ID      "${spec.tonType.toUpperCase()}-" DEVICE_ID
+// MQTT_CLIENT_ID montado em runtime usando o MAC (unico por hardware).
+// Substitui versao compile-time anterior ("TONx-" + hostname) que colidia
+// quando multiplas TONs eram cadastradas com mesmo name na UI.
+// Formato: "TON-<MAC_HEX_12_CHARS>" — ex: "TON-28372F9D82C0".
+extern char MQTT_CLIENT_ID[20];
```

E onde o `_mqtt` é configurado (no setup do mqtt em [iot-firmware-generator.v2.js:1186-1196](../AupusNexOn/public/iot-firmware-generator.v2.js#L1186)):

```diff
+char MQTT_CLIENT_ID[20];   // "TON-XXXXXXXXXXXX\0" = 17 chars, folga ate 20
+
 void mqtt_init(...) {
     ...
+    // Monta client_id usando MAC (unico por hardware)
+    uint8_t mac[6];
+    WiFi.macAddress(mac);
+    snprintf(MQTT_CLIENT_ID, sizeof(MQTT_CLIENT_ID),
+             "TON-%02X%02X%02X%02X%02X%02X",
+             mac[0], mac[1], mac[2], mac[3], mac[4], mac[5]);
+    Serial.printf("[MQTT] client_id: %s\n", MQTT_CLIENT_ID);
+
     _mqtt.setServer(MQTT_SERVER, MQTT_PORT);
     ...
 }
```

E no banner de boot (linha ~2484):
```diff
+    Serial.println("  [BOOT] ClientID v1.3: MQTT_CLIENT_ID derivado de MAC (unico)");
```

### 4.2 Por que MAC e não outras identidades

| Opção | Pro | Contra | Decisão |
|---|---|---|---|
| **MAC** | Único por hardware, sempre disponível, imutável | Não correlaciona com nome humano em logs | ✅ Escolhido |
| equipamento_id (CUID do banco) | Legível, casa com banco | Precisa cadastro; se DB refizer, muda | ❌ Frágil |
| hostname + MAC suffix | Combina humano + único | Dependência dupla | ❌ Complexo |
| UUID gerado e salvo em NVS | Único, persistente | Setup extra (NVS) | ❌ Overkill |

### 4.3 Bump de versão

- `FIRMWARE_VERSION`: `1.2.2-tcplog` → `1.3.0-clientid`
- Banner de boot adiciona linha confirmando client_id derivado de MAC
- `IOT_SCRIPTS_VERSION`: `20260527-tcplog` → `20260527-clientid`

---

## 5. Plano em fases

### Fase 1 — Implementação (esta sessão, após resposta)
1. Editar `iot-firmware-generator.v2.js` (§4.1)
2. Gerar firmware de teste, validar via diff e log de boot
3. Compilar via `pio run -e ton` (sanity)

### Fase 2 — Verificações pré-deploy (depende de ações suas)
1. **ACL do broker** — comando SSH em `72.60.158.163` (§6.1)
2. **Confirmar conteúdo da imagem** anexada anteriormente (não chegou)
3. Compilação cruzada não-regressão: TON sem o fix continua funcionando? (sim, mudança é só no firmware, broker aceita ambos)

### Fase 3 — Deploy + reflash gradual
1. Deploy `AupusNexOn` (frontend) via `deploy.sh` — DEPLOY.md §3
2. Reflash da **1ª TON** (sugestão: a do CF Investments 01, que tinha o problema mais visível)
3. Observar no broker — `mosquitto_sub $SYS/broker/clients/#` deve mostrar conexão estável com novo client_id
4. Validar que outras 5 TONs **não foram afetadas** (continuam com `TON1-TON1`, brigando entre si — mas a 1ª saiu da briga)
5. Reflash gradual das outras 5 TONs (uma por vez, com janela)
6. Após última TON migrada, confirmar zero ocorrência de Last Will `{"online":false}` no broker

### Fase 4 — Cadastro UI (separado, §8)
Não atrapalha. Fica como housekeeping pra próxima sessão.

---

## 6. Verificações de pré-deploy

### 6.1 ACL do broker — comandos a rodar em `72.60.158.163`

Você (ou alguém com SSH) executa e me manda a saída:

```bash
# Versão do broker
mosquitto -h 2>&1 | head -2

# Configs ativas
ls /etc/mosquitto/conf.d/
cat /etc/mosquitto/mosquitto.conf
cat /etc/mosquitto/conf.d/*.conf 2>/dev/null

# Procurar ACL/pattern especificos
grep -rE "acl|client_id|pattern|allow|deny" /etc/mosquitto/ 2>/dev/null | head -20

# Log recente
tail -n 50 /var/log/mosquitto/mosquitto.log
```

**O que estou procurando**: alguma diretiva tipo `pattern allow read/write TON1-*` ou `acl_file` com regras client_id-specific. Se não houver → **mudança é safe**.

### 6.2 Mapa MAC ↔ TON (pra log/debug pós-deploy)

Pra cada TON em campo, anotar (preferencialmente em uma planilha):

| MAC (do boot log) | Cliente/Site | Nome no banco | Novo client_id |
|---|---|---|---|
| 28:37:2F:9D:82:C0 | CF Investments 01 | TON1 | TON-28372F9D82C0 |
| ?? | San German 02 | TON1 | TON-?? |
| ... | ... | TON1 | ... |

Vai facilitar diagnóstico nos próximos meses.

---

## 7. Validação pós-deploy

### 7.1 Imediata (após primeira TON reflashada)

```bash
# Deve mostrar UMA conexão estável com novo client_id, sem disconnect:
timeout 30 mosquitto_sub -h 72.60.158.163 \
  -t '$SYS/broker/clients/connected' -t 'JOAO/GO/CF/UFV/status' -v -W 25
```

**Esperado**: `{"online":true}` UMA vez, sem `{"online":false}` seguindo.

### 7.2 Sanity das outras TONs

```bash
# Conta quantas TONs estão em loop de reconexão (Last Will):
timeout 60 mosquitto_sub -h 72.60.158.163 -t '+/+/+/+/status' -v 2>&1 \
  | grep -c '"online":false'
```

**Esperado depois de reflashar todas**: zero ocorrências.

### 7.3 Telemetria volta a fluir

Verificar no SCADA / `equipamentos_dados`:
```sql
SELECT equipamento_id, MAX(timestamp_dados) AS ultima_leitura
FROM equipamentos_dados
WHERE timestamp_dados > NOW() - INTERVAL '5 minutes'
GROUP BY 1;
```

Cada TON reflashada deve aparecer com leitura recente (< 5min).

---

## 8. Rollback

### Por TON individual
- Regerar firmware com o gerador da versão anterior (commit `ff5dab5` v1.2.2-tcplog)
- Reflashar a TON afetada
- Volta ao client_id antigo `TON1-TON1` (e ao problema original)

### Global (frontend)
```bash
cd /var/www/service-nexon/AupusNexOn
rm -rf dist && mv dist.previous dist
# Próximos "Compilar" da UI usam o gerador antigo
```

Tags git de rollback: usar commit `ff5dab5` como ponto de retorno.

---

## 9. Housekeeping correlato (próxima sessão)

Não vai ser feito nesta sessão, mas registrado pra não perder:

1. **Renomear as 6 TONs** no `iot_componentes` com nomes únicos por site (`TON-CF01`, `TON-SAN02`, ...). Refletir no `equipamentos` também.
2. **UI deve impedir cadastro com nome duplicado** (validation no form de TON).
3. **Tópico `<topic_base>/identity`** publicado pelo firmware no boot (retained) com `{mac, hostname, version, ip}` — auto-descoberta + facilita correlação MAC↔nome.
4. **Comando MQTT "identify"** que pisca LED da TON em campo (debug físico remoto).
5. **DEPLOY.md §9 alerta de `MQTT_MODE=production` duplicado** nos 2 backends — corrigir separadamente.

---

## 10. Resultado da implementação

### 10.1 Confirmação do diagnóstico (2026-05-27)

Imagem do broker (`/var/log/mosquitto/mosquitto.log`) confirmou e ampliou o diagnóstico:

| Evento | Contagem |
|---|---|
| `already connected, closing old connection` | **26.877** |
| ...delas com client_id `TON1-TON1` | **26.866 (99,96%)** |
| `disconnected due to protocol error` | 1.304 |
| `exceeded timeout` | 43 |

**10 IPs reais em campo** brigando pelo mesmo `TON1-TON1`:

| IP | Conexões |
|---|---|
| 170.239.145.31 | 8.958 |
| 200.189.23.204 | 4.298 |
| 148.227.91.6 | 3.516 |
| 200.189.23.251 | 3.041 |
| 138.84.59.180 | 2.426 |
| 148.227.122.205 | 1.689 |
| 200.189.23.51 | 1.495 |
| 153.67.110.196 | 974 |
| 200.189.23.46 | 363 |
| 148.227.90.192 | 151 |

→ **muito pior que estimativa inicial de 6 TONs** (eram 10 dispositivos físicos), confirma urgência.

Cliente também confirmou: **broker mosquitto sem ACL filtrando por padrão `TON1-*`** — implementação safe.

### 10.2 Implementação aplicada (commit `4a77ddf`)

Mudanças em [iot-firmware-generator.v2.js](../AupusNexOn/public/iot-firmware-generator.v2.js):

```diff
- #define MQTT_CLIENT_ID "TON1-" DEVICE_ID    // compile-time, colide
+ extern char MQTT_CLIENT_ID[20];              // declarado no config.h
+ char MQTT_CLIENT_ID[20] = "TON-uninitialized";   // definido no mqtt.cpp
+
+ // No mqtt_init():
+ uint8_t _mac_for_id[6];
+ WiFi.macAddress(_mac_for_id);
+ snprintf(MQTT_CLIENT_ID, sizeof(MQTT_CLIENT_ID),
+          "TON-%02X%02X%02X%02X%02X%02X",
+          _mac_for_id[0], ..., _mac_for_id[5]);
+ Serial.printf("[MQTT] client_id (do MAC): %s\\n", MQTT_CLIENT_ID);
```

- `FIRMWARE_VERSION`: `1.2.2-tcplog` → `1.3.0-clientid`
- `IOT_SCRIPTS_VERSION`: `20260527-tcplog` → `20260527-clientid`
- Banner de boot identifica: `[BOOT] ClientID v1.3.0: MQTT_CLIENT_ID derivado do MAC (unico por hardware)`

### 10.3 Validação

- `node baseline-rs485-gen.js`: gerador produz código esperado (4 marcadores confirmados via curl no endpoint)
- `pio run -e ton`: **[SUCCESS] 62.50s**, sem warnings novos
- `https://nexon.aupusenergia.com.br/iot-firmware-generator.v2.js?v=20260527-clientid`: HTTP 200, 4/4 marcadores presentes

### 10.4 Reflash em campo — pendente

| Métrica | Antes (broker log 27/05) | Depois | Meta |
|---|---|---|---|
| TONs com client_id duplicado | **10** | _aguardando_ | 0 |
| `already connected, closing` por dia | **26.866** | _aguardando_ | < 100 |
| Last Will `{"online":false}` espúrio | constante | _aguardando_ | só em queda real |
| Telemetria contínua das 10 TONs | quebrada | _aguardando_ | sim |

### 10.5 Plano de reflash (sequencial recomendado)

Cada TON reflashada **sai da briga** automaticamente (novo client_id único). As demais continuam brigando entre si — mas com 1 a menos. Ou seja: melhora **gradativa**, monotônica.

Ordem sugerida (do mais frequente pra menos):
1. IP `170.239.145.31` (8.958 conn) — provavelmente CF Investments 01
2. IP `200.189.23.204` (4.298 conn)
3. IP `148.227.91.6` (3.516 conn)
4. ... (até a 10ª)

Após cada reflash, validar no broker:
```bash
mosquitto_sub -h 72.60.158.163 -p 1883 -t '$SYS/broker/clients/connected' -C 3
```
Esperado: número estável (não oscilando).

---

## 11. Informações que ainda preciso

- [ ] **Conteúdo da imagem do broker** (não chegou no upload — colar texto)
- [ ] **Saída dos comandos §6.1** (SSH no broker para ver ACL/log)
- [ ] **MAC de cada TON em campo** (boot log de cada uma, ou planilha do time)
- [ ] **Janela de manutenção pra reflash gradual** (idealmente uma TON por vez, alguns minutos de intervalo entre cada)
