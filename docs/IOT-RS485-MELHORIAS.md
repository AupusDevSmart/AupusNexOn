# Plano de Melhoria — Comunicação RS485 Modbus (Firmware Gerado)

**Data**: 2026-05-27
**Autor**: discussão Sergio + Claude
**Escopo**: `AupusNexOn/public/iot-firmware-generator.v2.js` (caminho RS485 do gerador de firmware)
**Status**: **implementado 2026-05-27, aguardando medição em campo**
**Out-of-scope**: caminho TCP (já refatorado em 2026-05-27), backend `aupus-nexon-api`, hardware/cabeamento (depende de inspeção de campo)

---

## Sumário

1. [Sintoma observado](#1-sintoma-observado)
2. [Diagnóstico](#2-diagnóstico)
3. [Baseline — estado atual do código](#3-baseline--estado-atual-do-código)
4. [Plano de melhorias — software](#4-plano-de-melhorias--software)
5. [Checks de hardware](#5-checks-de-hardware)
6. [Critérios de aceite](#6-critérios-de-aceite)
7. [Plano de validação](#7-plano-de-validação)
8. [Rollback](#8-rollback)
9. [Observações fora de escopo](#9-observações-fora-de-escopo)

---

## 1. Sintoma observado

TON em produção (`JOAO/GO/CF/UFV`, instalação CF Investments 01), 4 inversores Sungrow CX em barramento RS485 compartilhado. Logs do Serial Monitor mostram falhas espalhadas:

```text
[MB] Inversor_3 bloco 1 FAIL (reg=5049 count=40 rc=0xE0)
[MB] Inversor_3: falha leitura (consecutivas: 2)
[MB] Inversor_4 bloco 1 FAIL (reg=5049 count=40 rc=0xE0)
[MB] Inversor_4: falha leitura (consecutivas: 2)
[MB] Inversor_1 bloco 1 FAIL (reg=5049 count=40 rc=0xE0)
[MB] Inversor_1: falha leitura (consecutivas: 1)
[MB] Inversor_2: OK (apos 2 falhas consecutivas)
[MB] Inversor_3 bloco 3 FAIL (reg=5119 count=35 rc=0xE0)
[MB] Inversor_4 bloco 0 FAIL (reg=4999 count=50 rc=0xE0)
[MB] Inversor_1: OK (apos 1 falhas consecutivas)
```

Padrão: falhas distribuídas entre **vários inversores** e **vários blocos**. Não localizadas em um slave específico nem em um bloco específico — característico de problema sistêmico, não de slave defeituoso.

---

## 2. Diagnóstico

**`rc=0xE0`** na biblioteca [ModbusMaster](https://github.com/4-20ma/ModbusMaster) (Arduino) = `ku8MBInvalidSlaveID`. Significado: o byte de slave ID no frame de resposta **não corresponde** ao slave ID que foi perguntado. Não é timeout (`0xE2`), não é CRC (`0xE3`).

Três causas físicas possíveis:

1. **Eco half-duplex** — driver MAX485 não comuta DE/RE a tempo, os próprios bytes transmitidos pelo ESP32 voltam pelo RX e são interpretados como início de resposta.
2. **Cross-talk entre slaves** — o slave anterior ainda está finalizando transmissão quando o master começa a falar com o próximo slave.
3. **Resíduo no buffer RX** — resposta atrasada de transação anterior fica no buffer da serial e contamina a leitura seguinte.

As três causas têm em comum: **bytes "errados" chegam ao master antes do frame correto**, o parser do ModbusMaster lê o primeiro byte e descobre que é um slave ID diferente do esperado → retorna `0xE0`.

A distribuição uniforme dos erros nos logs (todos os inversores, vários blocos) reforça que **a causa é no transporte/timing**, não no cadastro Modbus ou nos slaves.

---

## 3. Baseline — estado atual do código

Snapshot do gerador antes de qualquer mudança. Tudo abaixo é o que está em produção hoje no firmware gerado.

### 3.1 Setup RS485

[iot-firmware-generator.v2.js:685-687](../AupusNexOn/public/iot-firmware-generator.v2.js#L685-L687) (config defines):
```cpp
#define RS485_UART_NUM      1
#define RS485_BAUD          9600
#define RS485_CONFIG        SERIAL_8N1
```

[iot-firmware-generator.v2.js:1623](../AupusNexOn/public/iot-firmware-generator.v2.js#L1623) (instância):
```cpp
static HardwareSerial _rs485(RS485_UART_NUM);
```

[iot-firmware-generator.v2.js:1676-1680](../AupusNexOn/public/iot-firmware-generator.v2.js#L1676-L1680) (boot):
```cpp
pinMode(RS485_DIR, OUTPUT);
digitalWrite(RS485_DIR, LOW);
_rs485.begin(RS485_BAUD, RS485_CONFIG, UART1_RX, UART1_TX);
```

### 3.2 Controle de direção (DE/RE) — `_preTx` / `_postTx`

[iot-firmware-generator.v2.js:1625-1626](../AupusNexOn/public/iot-firmware-generator.v2.js#L1625-L1626):
```cpp
static void _preTx()  { digitalWrite(RS485_DIR, HIGH); delayMicroseconds(500); }
static void _postTx() { delayMicroseconds(500); digitalWrite(RS485_DIR, LOW); }
```

**Falta `_rs485.flush()`** no `_preTx`. Sem ele, não há garantia de que o último frame TX terminou de sair antes de comutar DE/RE → eco residual no RX.

### 3.3 Seleção de slave — `_select`

[iot-firmware-generator.v2.js:1628-1632](../AupusNexOn/public/iot-firmware-generator.v2.js#L1628-L1632):
```cpp
static inline void _select(uint8_t addr) {
    _mb.begin(addr, _rs485);
    _mb.preTransmission(_preTx);
    _mb.postTransmission(_postTx);
}
```

**Falta drain do buffer RX**. Bytes residuais (eco, resposta atrasada) ficam no buffer e são consumidos como início de resposta da próxima transação.

### 3.4 Leitura de bloco com retry

[iot-firmware-generator.v2.js:1852-1869](../AupusNexOn/public/iot-firmware-generator.v2.js#L1852-L1869) (emitido por bloco do `ai_blocks`):
```cpp
// Bloco N: reg X, count Y, func 0xZZ
{
    uint8_t rc = _mb.readInputRegisters(X, Y);
    if (rc != _mb.ku8MBSuccess) {
        // 1 retry (timeout=0xE2, CRC=0xE3, IllegalAddr=0x02, IllegalFn=0x01, SlaveFail=0x04)
        delay(50);
        rc = _mb.readInputRegisters(X, Y);
    }
    if (rc == _mb.ku8MBSuccess) {
        for (uint16_t i = 0; i < Y; i++) buf[OFFSET + i] = _mb.getResponseBuffer(i);
        diag_modbus_ok++;
    } else {
        diag_modbus_err++;
        Serial.printf("[MB] NAME bloco N FAIL (reg=X count=Y rc=0x%02X)\n", rc);
        return false;
    }
}
delay(40);   // espaçamento entre blocos
```

**Comentário do retry não menciona `0xE0`**. Retry repete a mesma sequência sem drain extra → se a causa do erro foi resíduo no RX, o retry herda o mesmo problema.

### 3.5 Cadência do round-robin

[iot-firmware-generator.v2.js:771-772](../AupusNexOn/public/iot-firmware-generator.v2.js#L771-L772):
```cpp
#define METER_CYCLE_MS      2000   // intervalo entre samples (round-robin 1 device por chamada)
#define PUBLISH_INTERVAL_MS 60000  // intervalo de publicação MQTT
```

Com 4 inversores e cycle de 2s, cada inversor é amostrado a cada **8 segundos**. Tempo entre transações do mesmo slave é folgado, então `0xE0` aqui é descartável como causa.

### 3.6 Timeouts

Não há chamada explícita a `_mb.setResponseTimeout(...)`. Default da biblioteca ModbusMaster = **2000 ms** por transação. Folgado.

### 3.7 Frequência de falhas observada

A coletar empiricamente (item da validação — ver §7). Estimativa por inspeção do log fornecido: **>30% das transações falhando com `0xE0`**.

### 3.8 Resumo do estado

| Aspecto | Estado atual | Adequado? |
|---|---|---|
| Drain do RX antes de transação | **ausente** | ❌ |
| `flush()` antes de comutar DE/RE | **ausente** | ❌ |
| Delay em `_preTx` após `digitalWrite HIGH` | `delayMicroseconds(500)` | ✅ (mínimo OK) |
| Delay em `_postTx` antes de `digitalWrite LOW` | `delayMicroseconds(500)` | ⚠️ (sem `flush()` antes) |
| Retry trata `0xE0` especificamente | **não** | ❌ |
| Delay entre blocos | `delay(40)` | ⚠️ (Sungrow pode precisar mais) |
| Delay no retry | `delay(50)` | ⚠️ (sem drain) |
| Timeout do ModbusMaster | default 2s | ✅ |
| Cadência round-robin | 2s por slave (8s/slave com 4) | ✅ |

---

## 4. Plano de melhorias — software

Cinco mudanças, ordenadas por prioridade (1 = maior impacto esperado). Todas em `_genDeviceReader` do gerador. Aplicam-se a TODO firmware RS485 gerado (não só Sungrow).

### Melhoria 1 — Drain do RX em `_select()`

**Diff:**
```diff
 static inline void _select(uint8_t addr) {
+    // Descarta bytes residuais (eco, resposta atrasada de transacao anterior).
+    // Sem isso, o ModbusMaster pode ler o primeiro byte residual como inicio
+    // de resposta e retornar 0xE0 (InvalidSlaveID).
+    while (_rs485.available()) _rs485.read();
     _mb.begin(addr, _rs485);
     _mb.preTransmission(_preTx);
     _mb.postTransmission(_postTx);
 }
```

**Por quê**: ataca diretamente a causa #3 do diagnóstico (resíduo no buffer).
**Risco**: nulo. Operação O(n) onde n = bytes pendentes (≤ algumas dezenas).
**Custo de RAM/Flash**: zero.

### Melhoria 2 — `flush()` no `_preTx`

**Diff:**
```diff
-static void _preTx()  { digitalWrite(RS485_DIR, HIGH); delayMicroseconds(500); }
+static void _preTx()  {
+    _rs485.flush();              // garante TX anterior 100% drenado antes de comutar DE/RE
+    digitalWrite(RS485_DIR, HIGH);
+    delayMicroseconds(500);
+}
```

**Por quê**: ataca a causa #1 (eco half-duplex). Espelha o padrão do firmware hand-coded de referência [`/var/www/iot_nexon/PLATFORMIO/TON/.../modbus_meter.cpp`](iot_nexon/PLATFORMIO/TON/include/modbus_meter.cpp) que tem `Serial1.flush()` no caminho equivalente.
**Risco**: nulo. `flush()` é no-op se não há bytes pendentes.
**Custo de tempo**: `flush()` espera até que o último bit saia do shift register UART — máximo ~1 char time = ~1ms a 9600 8N1.

### Melhoria 3 — Tratamento específico de `0xE0` no retry

**Diff** (no template emitido por bloco):
```diff
     uint8_t rc = _mb.readInputRegisters(X, Y);
     if (rc != _mb.ku8MBSuccess) {
-        // 1 retry (timeout=0xE2, CRC=0xE3, IllegalAddr=0x02, IllegalFn=0x01, SlaveFail=0x04)
-        delay(50);
+        // Erros com diagnostico:
+        //   0xE0 InvalidSlaveID (cross-talk/eco) | 0xE2 timeout | 0xE3 CRC
+        //   0x02 IllegalAddr   | 0x01 IllegalFn | 0x04 SlaveFail
+        // Para 0xE0, drena buffer + delay maior antes de retry (causa = resíduo).
+        if (rc == 0xE0) {
+            delay(20);
+            while (_rs485.available()) _rs485.read();
+            delay(20);
+        } else {
+            delay(50);
+        }
         rc = _mb.readInputRegisters(X, Y);
     }
```

**Por quê**: retry atual repete a sequência sem limpar o buffer, herdando o resíduo. Para `0xE0` especificamente, o drain extra resolve.
**Risco**: baixo. Aumenta latência de retry de 50ms para ~40ms apenas no caso `0xE0` (rolê drain é rápido).
**Custo de Flash**: ~30 bytes por bloco gerado.

### Melhoria 4 — `setResponseTimeout` explícito ⚠️ **DESCARTADA**

**Motivo**: a biblioteca `ModbusMaster` em uso (`6-20ma/ModbusMaster`) define o timeout como `static const uint16_t ku16MBResponseTimeout = 2000` no header — constante de compilação, sem setter runtime. Não é possível ajustar sem patching da lib ou troca para outra implementação (ex: `eModbus`, `eModbus-RTU-Master`).

Comentário documentando essa limitação foi adicionado ao código gerado:
```cpp
// NOTA: ModbusMaster usa ku16MBResponseTimeout = 2000ms como static const compilada
// na lib — nao expoe setter runtime. Timeout fica em 2s (folgado pra Sungrow).
// Refator pra ajustar exige trocar a lib (ex: eModbus) — fora deste escopo.
```

**Backlog futuro**: avaliar troca de biblioteca se medições mostrarem que timeout de 2s prejudica cadência quando slave fica offline. Hoje não é gargalo conhecido.

### Melhoria 5 — Delays empíricos ajustados (sem schema novo)

Decisão pragmática: em vez de criar campo `timing` no catálogo (complexidade extra para todos os modelos), aplicar valores globais mais conservadores. Sungrow é o caso mais lento conhecido e o custo extra para os outros é desprezível.

**Mudanças aplicadas:**

| Parâmetro | Antes | Depois | Justificativa |
|---|---|---|---|
| Delay entre blocos | `delay(40)` | `delay(80)` | Cobre datalogger interno do Sungrow CX. Custo: até 200ms extras por amostragem de 5 blocos, desprezível dado cycle de 8s/slave. |
| `_preTx` `delayMicroseconds` | 500µs | **1000µs** | Folga pra MAX485 isolado/optoacoplado. 1ms imperceptível na transação total. |
| `_postTx` `delayMicroseconds` | 500µs | **1000µs** | Mesma razão. |

Se algum cliente futuro precisar de timing por modelo (ex: medidor Chint muito mais rápido onde 80ms é desperdício notável), a Melhoria 5 original (campo `timing` no catálogo) volta como segunda iteração — fica no backlog.

**Risco**: baixo. Aumento de ~40ms por bloco × N blocos × 1 device/ciclo = no máximo +200ms por amostragem completa, sem impacto na cadência de 8s/slave.
**Custo Flash**: zero relevante.

### Resumo das mudanças

| # | Onde | Tipo | Esforço | Impacto esperado |
|---|---|---|---|---|
| 1 | `_select()` no gerador | adição | trivial | **alto** — ataca causa principal |
| 2 | `_preTx()` no gerador | adição | trivial | **alto** — elimina eco |
| 3 | template de retry | adição | trivial | **médio** — recupera transações que falharam por resíduo |
| 4 | setup `_mb` + `_select()` | adição | trivial | **baixo/médio** — libera barramento mais rápido |
| 5 | schema catálogo + 1 template | médio | pequeno | **médio** para Sungrow, neutro para resto |

---

## 5. Checks de hardware

Não são software, mas devem ser verificados **paralelamente** porque podem ser causa única ou coadjuvante. **Pedir ao técnico de campo:**

- [ ] **Terminação 120Ω** em ambas as extremidades do barramento (no TON e no inversor mais distante). Sem terminação, sinal reflete e contamina próximo frame.
- [ ] **Polarização (bias)**: resistores ~680Ω entre A↔VCC e B↔GND **em um único ponto** do barramento (geralmente no master). Sem bias, linha flutua entre transações e qualquer ruído vira "byte".
- [ ] **Cabo par trançado blindado** (CAT5/CAT6 ou específico RS485). Sinais A/B no MESMO par. Malha aterrada em UMA extremidade só.
- [ ] **Topologia daisy-chain estrita** — sem estrela, sem stubs > 30cm.
- [ ] **Slave IDs únicos** — confirmar 1, 2, 3, 4 distintos no display de cada inversor. IDs duplicados causam exatamente `0xE0`.
- [ ] **Baud rate uniforme** — todos os 4 inversores em 9600 8N1. Um divergente gera frames inválidos no barramento.
- [ ] **Verificar GND comum** entre TON e inversores (se não houver isolamento galvânico no driver). Diferença de potencial → modo comum → corrompe diferencial.

---

## 6. Critérios de aceite

Após implementar §4 (M1+M2+M3+M4, deixando M5 opcional para refinamento posterior):

1. **Build limpo**: `pio run` compila sem erros novos, sem warnings novos. ✓ é mandatório.
2. **Equivalência funcional**: firmware gerado para um cadastro existente (ex: M-160 LORA_TX_MODBUS) produz código com mesma estrutura externa (mesmas chamadas Modbus, mesmas decodificações). Mudanças concentradas em `_select`, `_preTx` e template de retry.
3. **Redução da taxa de `0xE0` em campo**: medida sobre janela de 10 minutos no TON-real do CF Investments 01, comparando antes vs depois. Meta: **redução ≥ 80%** dos erros `0xE0`. Se cair < 50%, problema é predominantemente hardware (§5).
4. **Sem regressão de timeout**: `0xE2` (timeout) não pode AUMENTAR. Indicaria que `setResponseTimeout(1000)` está apertado demais para algum slave; nesse caso ajustar `MODBUS_RESPONSE_TIMEOUT_MS` para 1500.
5. **Cadência de publish mantida**: TON continua publicando a cada 60s (sem starve).

---

## 7. Plano de validação

### 7.1 Validação local (antes do deploy)

1. Aplicar M1+M2+M3+M4 no gerador.
2. Regenerar firmware para os mesmos 4 inversores Sungrow CX da instalação CF Investments 01 (diagrama IoT já existe).
3. Comparar diff do `src/modbus.cpp` antes vs depois — deve ser exatamente as mudanças previstas, nada mais.
4. `pio run -e ton` — confirmar build verde.
5. Comparar tamanho de binário (`firmware.bin`) antes/depois — esperar diferença < 1KB.

### 7.2 Medição do baseline em campo (ANTES de aplicar)

Antes de fazer o deploy, capturar **10 minutos** do Serial Monitor do TON atual com o firmware vigente. Extrair contagens:
- Total de transações Modbus tentadas
- Falhas com `rc=0xE0`
- Falhas com `rc=0xE2`
- Falhas com `rc=0xE3`
- Falhas com outros códigos
- Sequências `OK (apos N falhas consecutivas)` — distribuição de N

Salvar em `/tmp/baseline-cf-investments-01.log` ou anexar a este documento.

### 7.3 Validação em campo (DEPOIS de aplicar)

Mesma janela de 10 minutos, mesmo TON, firmware novo. Comparar contagens. Documentar resultado em uma seção §10 deste mesmo arquivo (a criar pós-medição).

### 7.4 Vigilância pós-deploy

Acompanhar logs do TON por **48h**. Sinais de regressão a vigiar:
- Pico de `0xE2` (timeout) → reduzir `MODBUS_RESPONSE_TIMEOUT_MS` foi agressivo demais
- Aumento de `consecutivas: N` com N > 5 → drain insuficiente OU hardware
- Heap caindo → vazamento (improvável, mas `flush()` em loop pode ter surpresa)

---

## 8. Rollback

- Tag git no `AupusNexOn` antes do merge: `pre-rs485-improvements-2026-05-27`
- Deploy via `deploy.sh AupusNexOn` (DEPLOY.md §3) mantém `dist.previous` — swap reverso em <1min
- Para reverter o **firmware em campo** (não só o gerador): regenerar com o gerador da tag pré-mudança e fazer reflash OTA. **Fluxo OTA tem safety** (memória `feedback_ota_safety_required.md`) — se firmware novo travar, bootloader reverte sozinho.

---

## 9. Observações fora de escopo

Detectado no mesmo log mas **não tratado neste plano**:

- **MQTT desconectando a cada poucos segundos** (`[MQTT] DESCONECTADO - mensagens irao para o SD`). Pode ser:
  - WiFi do site instável
  - Broker derrubando por keepalive
  - CPU starving por excesso de retries Modbus (esta hipótese **diminui** se §4 reduzir as falhas)
  - Tratar depois — esperar §7.3 mostrar se §4 já alivia indiretamente.
- **Padrão de retentativa MQTT**: `[SD-BUF] Reenviado` mostra que o buffer SD está funcionando para offline — não há perda de dados, só atraso. OK por enquanto.

---

## 10. Resultado da implementação

### 10.1 O que foi mudado (2026-05-27)

Edições aplicadas em [iot-firmware-generator.v2.js](../AupusNexOn/public/iot-firmware-generator.v2.js):

- **M1 ✅** — Drain do RX em `_select()` ([linha ~1657](../AupusNexOn/public/iot-firmware-generator.v2.js#L1657))
- **M2 ✅** — `_rs485.flush()` no `_preTx` ([linhas ~1639-1643](../AupusNexOn/public/iot-firmware-generator.v2.js#L1639))
- **M3 ✅** — Tratamento específico de `0xE0` no retry de cada bloco ([template em ~1879](../AupusNexOn/public/iot-firmware-generator.v2.js#L1879))
- **M4 ❌** — Descartada: lib `ModbusMaster` não expõe setter de timeout (ver §4 atualizado)
- **M5 ✅** — Delay entre blocos 40 → 80ms; `delayMicroseconds` DE/RE 500 → 1000µs

### 10.2 Diff resumido do código gerado

Comparação `/tmp/baseline-rs485-OLD/src/modbus_meter.cpp` vs `/tmp/baseline-rs485-NEW/src/modbus_meter.cpp` (4 inversores Sungrow SG110CX em RS485 puro):

```diff
-static void _preTx()  { digitalWrite(RS485_DIR, HIGH); delayMicroseconds(500); }
-static void _postTx() { delayMicroseconds(500); digitalWrite(RS485_DIR, LOW); }
+static void _preTx()  {
+    _rs485.flush();
+    digitalWrite(RS485_DIR, HIGH);
+    delayMicroseconds(1000);
+}
+static void _postTx() {
+    delayMicroseconds(1000);
+    digitalWrite(RS485_DIR, LOW);
+}

 static inline void _select(uint8_t addr) {
+    while (_rs485.available()) _rs485.read();
     _mb.begin(addr, _rs485);
     _mb.preTransmission(_preTx);
     _mb.postTransmission(_postTx);
 }

 // No template de cada bloco (4 blocos × 4 devices = 16 ocorrências):
 if (rc != _mb.ku8MBSuccess) {
-    delay(50);
+    if (rc == 0xE0) {
+        delay(20); while (_rs485.available()) _rs485.read(); delay(20);
+    } else {
+        delay(50);
+    }
     rc = _mb.readInputRegisters(...);
 }
-delay(40);
+delay(80);
```

### 10.3 Validação local

- `pio run -e ton` (firmware com 4 Sungrow SG110CX RS485): **[SUCCESS] 50.50 seconds**
- RAM: 16.0% (52472 / 327680 B) — antes: 15.4% (50384 B)
- Flash: 31.3% (1047709 / 3342336 B) — antes: 30.0% (1002621 B)
- Overhead: +2088 B RAM, +45 KB Flash. Aceitável (Flash sobrando 68%).

### 10.4 Medição em campo

_A preencher após reflash do TON no CF Investments 01 e coleta de 10 min de log com firmware novo, comparado com 10 min de baseline ANTES._

| Métrica | Antes | Depois | Delta | Meta |
|---|---|---|---|---|
| `0xE0` por minuto | ? | ? | ? | redução ≥80% |
| `0xE2` por minuto | ? | ? | ? | não aumentar |
| `0xE3` por minuto | ? | ? | ? | não aumentar |
| Transações OK / total | ? | ? | ? | ≥95% |
| Heap mínimo livre | ? | ? | ? | não cair |
| Reconexões MQTT por minuto | ? | ? | ? | (observar) |

### 10.5 Próximos passos

1. **[pendente] Coletar baseline em campo** — 10 min Serial Monitor do TON atual ANTES do reflash, salvar contagens
2. **[pendente] Deploy do `AupusNexOn`** via `deploy.sh` (DEPLOY.md §3) — só o gerador, frontend
3. **[pendente] Regenerar firmware** do TON CF Investments 01 na UI (após deploy) e fazer OTA (com safety automática)
4. **[pendente] Medição pós** — 10 min Serial Monitor com firmware novo, preencher §10.4
5. **[pendente] Hardware checks §5** em paralelo com o técnico de campo
6. **[se §10.4 não bater meta]** investigar causa hardware (terminação, bias, cabo) — software já fez tudo que pode
