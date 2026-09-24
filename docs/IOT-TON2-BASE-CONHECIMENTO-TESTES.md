# Base de Conhecimento TON — Preparação para Teste da Nova Placa ("TON2")

> Gerado em 2026-07-21 por varredura completa do código/infra atuais (gerador v2, diagrama/catálogo,
> backend NexON, firmwares PlatformIO, docs e VPS) + memória de sessões anteriores.
> Objetivo: consolidar TODOS os protocolos e interfaces do ecossistema TON para planejar o teste da nova revisão de placa.

---

## 1. Nomenclatura — decidido: **TON-V2**

Decisão do usuário (2026-07-21): a nova revisão de hardware chama-se **TON-V2** (esquemático
`/var/www/SCH-TON-v1b.pdf`, EAGLE 9.7, A2) e **mantém o conceito de variantes de montagem**.
Não confundir com "ton2", que segue sendo a VARIANTE de montagem (com LoRa, sem relés):

| Feature | TON1 | TON2 | TON3 | TON4 |
|---|---|---|---|---|
| LoRa E220 | ❌ | ✅ | ❌ | ✅ |
| 6 relés 12V (comando) | ❌ | ❌ | ✅ | ✅ |
| RS485/Eth/SD/TR1-4/6 DIN/2 AN/PWM | ✅ | ✅ | ✅ | ✅ |

Essa nomenclatura de variante está assada em: `TON_CAPS` do gerador (`iot-firmware-generator.v2.js:17-22`),
tipos de componente do editor (`iot-diagram.v2.js`), `detectVariant()` do firmware de bancada e campo
`automacao` dos equipamentos (ton3/ton4).

---

## 1b. TON-V2 — análise do esquemático SCH-TON-v1b (2026-07-21)

MCU confirmado igual: **ESP32-S3-WROOM-1-N8R2** (mesmo board `lolin_s3`, 8MB, sem PSRAM, USB-C nativo).

### O que NÃO mudou (firmware atual continua válido)

| Interface | Pinos (iguais à v1a) |
|---|---|
| I2C | SDA=4, SCL=5; MCP entradas **0x26**, MCP relés **0x27** (mesmos straps) |
| RS485 | MAX485CSA++, D_R=IO8; eletricamente **TX=IO18, RX=IO17** (nets TX1/RX1 continuam com rótulo "invertido": o DI do transceiver recebe o net RX1=IO18, igual à v1a) — **1 porta só**; "RS485-1/RS485-2" são os terminais A/B |
| LoRa E220 | UART2 TX=16, RX=15, AUX=47 |
| W5500 (módulo) | NSS=IO10, MOSI=11, SCLK=12, MISO=13, RESET=IO14 (+ NINT) |
| SD | MOSI=35, SCLK=36, MISO=37, CS=38 |
| TR1-4 | IO1, IO2, IO42 (TR3), IO41 (TR4) — BC817 + 2K2 → X11 |
| RTC 2 fios | CLOCK=IO3, DATA=IO9 — mesmo CI misterioso, part number segue desconhecido |
| USB/botões | IO19/20, RESET2/BOOT, LEDPROG |
| Alimentação | 5V (jack + USB via diodo) → LM1117 3V3 — igual v1a (relés já eram bobina 5V) |

### O que MUDOU (exige mudança de firmware/backend)

1. **8 entradas ópticas** (era 6): X12-1..8, TLP183. **DIN1-8 = MCP 0x26 GP0-GP7.** GP6/GP7 deixaram
   de ser M0/M1 do LoRa.
2. **LoRa M0/M1 ATERRADOS** (era MCP GP6/GP7): módulo fixo em modo transparente/normal. `lora config` /
   `lora pair` do firmware de bancada **não funcionam mais** — E220 precisa vir configurado de fábrica ou
   ser configurado externamente.
3. **8 relés** (era 6): MKB-1M-05 (bobina 5V) + ULN2803, conectores X1-X8 (3 terminais cada).
   **RL1-8 = MCP 0x27 GP0-GP7** — na v1a era RL1-6 = GP1-GP6: **mapeamento DESLOCADO em −1**.
   Firmware v1 rodando na V2 acionaria o relé errado (r1 → RL2!).
4. **PCA9685 novo no I2C (addr 0x42)**: 16 canais PWM, 8 usados (LED0-7 = nets PWM1-8) → MOSFETs
   **AO3400 open-drain** → conector **X88-1..8**. ~OE=GND (sempre habilitado); EXTCLK ligado a um net
   "CLK25MH" (25 MHz — firmware pode ignorar e usar o oscilador interno de 25 MHz, não setar MODE1.EXTCLK).
   Requer driver novo no firmware.
5. **AN1/AN2 (IO6/IO7)**: divisor mudou para **22K/3K3 ≈ 7,67x** (era 8,01x) → X77-3/X77-1. Ajustar escala ADC.
6. **AN_C1/AN_C2 — entradas 4-20 mA NOVAS** (X77-5/X77-4): polyfuse 1206L + shunt 165R→GND
   (20 mA → 3,3 V). ⚠️ **LIGADAS A IO40/IO39, QUE NÃO TÊM ADC NO ESP32-S3** (ADC1=GPIO1-10,
   ADC2=GPIO11-20). Como desenhado, não dá pra ler o valor analógico — só nível digital (limiar ~ILIM).
   **Provável erro de design a confirmar com o usuário.**
7. **SU+ (IO48) novo**: entrada de contato seco X14 (pull-up 3V3 via 680R + TVS) — supervisão.
8. **AOD7N65 removido**: o net PWM (IO46) ficou **sem carga** no esquemático (aparece só no pino) —
   IO46 efetivamente livre.
9. Conector RS485 mudou de X9 para bornes novos; F1/F2 (polyfuse) nas entradas 4-20 mA.

### Matriz de impacto no software

| Camada | Mudança necessária |
|---|---|
| `hal.h` do gerador (`iot-firmware-base.v2.js`) | mapa de relés GP0-7 (r1-r8), 8 DIN GP0-7, escala AN 7,67, driver PCA9685 (0x42), SU+ IO48; parametrizar por revisão (v1 × V2 coexistem em campo) |
| Gerador (`TON_CAPS`/UI) | has_relays 6→8, inputs 6→8, PWM 1→8 canais; payloads `relays` r1..r8, `inputs` d1..d8 |
| Backend | `ton_bo.bo_numero` 1..6 → 1..8; `ton_bi` d1..d8; validação de cmd `r7/r8` |
| TON-TESTE / POP | fork V2: 8 relés/8 DIN no loopback, passo PCA9685+X88, passo 4-20 mA, SU+, REMOVER `lora config`/`lora pair` (M0/M1 fixos); `detectVariant` revisar |
| Catálogo/diagrama | bloco `integrated` do TON (já estava desatualizado) — reescrever com pinout V2 |

⚠️ O off-by-one das DIN no firmware gerado (§7.1 abaixo) fica AINDA mais visível na V2: com 8 entradas
em GP0-7, ler `i+1` erra todas.

---

## 2. Mapa do ecossistema

```
[Placa TON v1 (ESP32-S3)] --Modbus RTU/TCP/LoRa--> devices (inversores, medidores, relés)
        | MQTT (WiFi ou Eth W5500)
        v
[Broker MQTT 72.60.158.163:1883]  <-- servidor SEPARADO (o VPS NexON é 92.113.38.164)
        ^                       ^
        | sub/pub               | trigger OTA / comandos
[aupus-nexon-api (NestJS, pm2, :3001)] ---> Postgres Docker aupus-db-local :5433/aupus
        ^
[AupusNexOn SPA] editor de diagrama IoT + gerador de firmware v2 (roda NO BROWSER)
        | POST /iot-compile (nginx -> 127.0.0.1:3211)
[aupus-firmware-compiler (pm2)] -> pio run -> .bin em artifacts/ (servido p/ OTA em HTTP :80 E HTTPS)
```

- **Gerador de firmware real (v2)**: `service-nexon/AupusNexOn/public/iot-firmware-generator.v2.js` (6175 l.)
  + `iot-firmware-base.v2.js` (870 l.). Roda no browser; o diagrama define a topologia. Cache-buster
  `IOT_SCRIPTS_VERSION` (hoje `20260720-bo-dpc`) em `iot-diagram.tsx:198`.
- **Repo de firmware manual/legado**: `/var/www/iot_nexon` (PLATFORMIO/, lib/, generator/generate.py **legado**,
  webapp Python **legado** em iot.aupusenergia.com.br).
- **Catálogo de dispositivos**: vive no **BANCO** (`iot_device_tipos` + `iot_device_modelos`), servido por
  `GET /api/v1/iot-catalog/device-catalog.js` (gerado do DB a cada request). O `iot-device-catalog.v2.js`
  estático é fallback/legado.
- **Staging**: staging-nexon.aupusenergia.com.br (API :3200, DB aupus_staging). ⚠️ Compilador de staging
  (porta 3210) está **parado** no pm2 — OTA/compilação por staging quebrada hoje.

---

## 3. Hardware baseline — TON v1 (esquemático SCH-TON-v1a, confirmado em bancada)

MCU **ESP32-S3-WROOM-1-N8R2** · board PlatformIO `lolin_s3` · flash 8MB `qio_qspi` · `BOARD_HAS_PSRAM=0`
(**obrigatório**: PSRAM colide com pinos do W5500 no N8R2) · USB CDC nativo (IO19/20, `use_1200bps_touch`)
· partições `default_8MB.csv` (2 slots OTA).

| Interface | Pinos | Config |
|---|---|---|
| I2C principal | SDA=4, SCL=5 | 100 kHz; MCP23008 IN **0x26**, MCP23008 OUT **0x27** (⚠️ esquemático dizia 0x20/0x21 — real é 0x26/0x27) |
| RS485 (MAX485) | UART1 TX=18, RX=17, DE/RE=8 | **9600 8N1 fixo** no gerador |
| LoRa E220-900T30D | UART2 TX=16, RX=15, AUX=47; M0/M1 = **MCP 0x26 GP6/GP7** | 9600 8N1, modo transparente; bench pareia canal 18/addr 0x0000/22 dBm |
| Ethernet W5500 | SPI2 MOSI=11, SCLK=12, MISO=13, CS=10, RST=14 | 8 MHz; pilha TCP/IP **própria do chip** (separada do lwIP!) |
| SD Card | SPI3 MOSI=35, SCLK=36, MISO=37, CS=38 | 8 MHz; workaround GPIO matrix (zona MSPI) |
| Saídas transistor TR1-4 | IO1, IO2, IO42, IO41 (BC817) | |
| Relés RL1-6 | MCP 0x27 **GP1-GP6** (via ULN2803) | só variantes ton3/ton4 |
| Entradas ópticas DIN1-6 | MCP 0x26 **GP0-GP5** (esquemático) | ⚠️ ver §9 — firmware gerado lê GP1-GP6 |
| Analógicas AN1/AN2 | IO6, IO7 | divisor 8.01x, máx ~26 V, 12-bit |
| PWM | IO46 (AOD7N65) | definido, geração 1 kHz/8-bit; função real "não implementada" |
| RTC | **2 fios dedicados CK=IO3, DT=IO9** (NÃO é o I2C principal) | protocolo próprio, part number DESCONHECIDO; nenhum firmware de produção lê (hora vem de NTP/gateway). Endereço 0x68 em config.h é resquício |
| Ordem de boot | **W5500 ANTES do SD** | SD primeiro mata a detecção SPI do W5500 |

Problema conhecido da v1: firmware manual `PLATFORMIO/TON/` marca RS485 "standby — problema hardware"
(`main.cpp:66`) — a causa **nunca foi documentada**; o firmware gerado v2 usa RS485 normalmente em campo.

---

## 4. Interfaces e protocolos

### 4.1 MQTT (contrato do firmware gerado v2)

Broker default `72.60.158.163:1883`, **sem user/pass no firmware** (o backend usa MQTT_USERNAME/PASSWORD —
broker aparentemente aceita anônimo). `MQTT_CLIENT_ID = "TON-<MAC12hex>"` (único por placa — bug histórico
de client_id duplicado derrubava TONs em ciclo de ~4 s). Buffer 4096, keepalive 60 s. Topic base =
`PROPRIETARIO/ESTADO/PLANTA/INSTALACAO` (props do TON no diagrama; prefixo `TESTE/` no modo Simular).

**Assina**: `<base>/cmd`, `<base>/ota/cmd`; gateway LoRa também `<base>/satellite/+/cmd`.

**Publica**:
| Tópico | Payload | Quando |
|---|---|---|
| `<base>/status` | `{online,version,model,mac,ip,iface}` retained; LWT `{"online":false}` QoS1 retained | conexão / morte |
| `<base>/<device>_<addr>/data` | pontos do catálogo + `timestamp` (epoch padrão) + `samples` | a cada 60 s (média/last/delta) |
| `<base>/<device>_<addr>/status` | `{"error":"no_samples"[,last_fail,reconnects]}` | falha de leitura |
| `<base>/inputs` `/outputs` `/relays` | `{d1..d6}` `{tr1..tr4}` `{r1..r6}` | edge-triggered (scan 50 ms) + boot/reconexão |
| `<base>/cmd/ack` | `{cmd_id,status:ok\|error\|duplicate,msg,ts}` | resposta a comando (dedup ring 32) |
| `<base>/diagnostics` | heap, modbus_ok/err, mqtt_pub, sd_*, reset_reason… | a cada 60 s |
| `<base>/evt` | evento SOE cru (fun/inf/dpi/ms…, `cat` = catalog_id) | poll do buffer do relé |
| `<base>/ota/status` | `{state,progress,version,msg}` | durante OTA |
| `<base>/satellite/<MAC>/...` | repasse do gateway LoRa (status/data/cmd/ack/inputs) | topologia LoRa |
| `<base>/pivo` | `{estado,ps,dir,falha}` | pivô de irrigação |

Intervalos: leitura round-robin 4 s/device, publicação 60 s. QoS 0 (exceto LWT). Offline → buffer SD
`/mqtt_buf.txt` (`topico\tpayload`, ts injetado, 5 MB, drain 5 msgs/10 s).

**Backend assina** (por equipamento com `mqtt_habilitado`): base, `/status`, `/cmd/ack`, `/inputs`, `/evt` +
wildcard **`TESTE/#`** (discovery de bancada, não ingere). Ingestão → `equipamentos_dados` (buffer 1 min p/
inversores; direto p/ M160/A966), `iot_dispositivos_online` (announce; upsert por topico_mqtt), `equipamento_io_estado`
(BI), `rele_eventos` (SOE). Timestamp: `ts` (SD) → `timestamp` (epoch ou string legada) → hora de chegada.

### 4.2 Modbus — 4 transportes gerados

| Transporte | Nó no diagrama | Framing | Leitura | Escrita | Limitações |
|---|---|---|---|---|---|
| RS485 RTU direto | link `rs485` TON↔device | RTU (lib ModbusMaster) UART1 9600 8N1 | FC01/02/03/04 (`ai_blocks[].func`, `bi_blocks`) | FC05/06/**15** + SBO steps | bloco AI ≤ **64 words** (buffer da lib); timeout 2 s; back-off 3 falhas→30 s |
| MBAP datalogger | nó `inverter_datalogger` (WiNet-S, Logger1000, SmartLogger…) | Modbus TCP puro :502 | FC01-04 | FC05/06/15 | reconexão forçada a cada falha (fix desync UBS) |
| RTU-sobre-TCP | nó `conversor` (USR-W610/TCP232) | RTU+CRC16 encapsulado, timeout 3 s | FC03/04 | **NÃO gera escrita** | **sem BO, sem BI FC02, sem SOE** — usa mapa RTU |
| TCP direto | device com `props.ip` (ex.: relé 7SR5111:502) | MBAP | FC01-04 (mapa `por_transporte.tcp`) | FC05/06/15 (DPC) | igual datalogger |

⚠️ **Regra de campo**: TON no RS485 de inversores vira 2º mestre e colide com o datalogger do fabricante
(Sungrow/Huawei sempre; GoodWe/WEG só com EzLogger) → ler via **Datalogger TCP**, nunca tapar o barramento.
⚠️ Paridade: TON é fixa 8N1 — P3U30 sai 8E1, PD666 8N2 de fábrica, 7SR10 default 19200: configurar o device.

### 4.3 LoRa (E220 transparente, gateway/satélite)

- Papel por LAYOUT: internet+peer=**gateway**; sem internet+peer=**satellite**; sem peer=tx.
- Envelope JSON `{to,from,cmd_id,type,subtopic,payload,ttl,ts?}`; MTU **200 B** (overhead ~120-130 B);
  TTL=4; flood controlado broadcast + dedup ring 32 por `from|cmd_id|type`.
- Frame binário `$B$`+Base64 (só M160, 17 campos) — **1 salto apenas**; subtopic viaja no frame.
- **Mestre-puxa** (default): gateway orquestra POLL round-robin (`POLL_TIMEOUT_MS=10000` com extensão por
  frame, 3 timeouts→offline, cadência 60 s/alvo, máx 16 alvos); satélite reativo anuncia `poll:1` no
  heartbeat (30 s) → gateway aprende MAC em runtime (não precisa no diagrama). Fallback push via flag.
- Comando MQTT→LoRa: backend publica em `<base>/satellite/<MAC>/cmd`; gateway roteia por MAC; retry 4 s ×3;
  sem ACK → publica `lora_no_ack`. Satélites **não têm NTP** — gateway carimba `timestamp` ao republicar.
- **OTA via LoRa NÃO existe** (decisão) — satélite só regrava por USB.
- MAC: usar SEMPRE o do `[BOOT] MAC:` do Serial (STA), nunca o do flasher/etiqueta.

### 4.4 OTA

- Trigger: `POST /equipamentos/:id/ota/[compilar-e-]publicar` → compilador :3211 (`pio run`) → `.bin` em
  artifacts + md5/sha256 → publica `<topico_mqtt>/ota/cmd` `{url,version,md5,target_mac?}` **QoS1 retained**
  (auto-clear no success/fail, fallback 180 s).
- Download no device: WiFi → HTTPS `setInsecure()`; **Ethernet → HTTP :80 puro** via EthernetClient (W5500
  sem TLS; nginx serve `/iot-compile/artifacts/*.bin` em 80 e 443 de propósito; integridade = MD5).
- Rollback: partição PENDING_VERIFY; confirma após **3 publicações MQTT OK** (`esp_ota_mark_app_valid...`).
- ⚠️ **`target_mac` só é verificado pela lib `ota_safety`** (firmwares custom/bancada, `_ota_mac_matches`).
  O firmware **gerado v2 NÃO checa** (`ota_handle_command` lê só url/version/md5) — verificado 2026-07-21.
  O esquema `<base>/<MAC>/cmd/ota` da memória antiga nunca foi implementado; o tópico real é `<base>/ota/cmd`.
- Política: **todo firmware de campo precisa de OTA** (lib `iot_nexon/lib/ota_safety/`, 5 linhas).

### 4.5 NTP / hora

Duas pilhas de rede independentes: lwIP (WiFi) e W5500 (TCP/IP no chip). SNTP só funciona no WiFi; no cabo
o firmware faz query NTP manual via `EthernetUDP` (UDP 123, IPs fixos NTP.br rotacionados, `settimeofday`).
Satélites LoRa sem hora → gateway carimba. Timestamp padronizado **epoch** (backend resolve string legada).

### 4.6 SOE (eventos de relé 7SR)

Buffer privado IEC-103-like via Modbus: EVENTCOUNT (Modicon 30001/PDU 0, FC04 qty1) + EVENT (30002/PDU 1,
FC04 **qty 8 exato** = pop). **Exceção 2 = fila vazia (não é erro)**. Publica cru em `<base>/evt` com
`cat=catalog_id`; tradução FUN/INF é DADO no backend (`rele_evento_codigos`, fonte autoritativa = report
IEC-103 do Reydisp, 563 eventos do 7SR5111). Timestamp sem data → backend completa com virada de meia-noite.
Funciona em RS485 e TCP direto; **não** no conversor rtu_tcp. Gotcha 7SR5111: **não usar BO1 como trip**
(latch permanente).

---

## 5. Catálogo de dispositivos (DB `iot_device_tipos`/`iot_device_modelos`)

| Device | Protocolo | Observações |
|---|---|---|
| Sungrow SG250CX/110CX/75CX/333HX | RTU 9600 / TCP WiNet-S | FC04, **word_order low_first** |
| Huawei SUN2000 | TCP SmartLogger | FC03 32016+ |
| GoodWe MT / WEG SIW400 | RTU / TCP | SIW400 = rebrand GoodWe (mapa 0x0300) |
| WEG SIW500H | TCP | rebrand Huawei |
| CHINT PD666 | RTU | FLOAT IEEE754; paridade fábrica 8N2 |
| IMS M160 | RTU 9600 8N1 | auto-range decimal regs 35/36 (DPT/DCT/DPQ, `valor=raw·10^(exp−4)`), TP/TC regs 3/4, energias delta |
| Pextron URP6000 | tcp_usr | handshake reg 0x88; BO fechar 0x33/abrir 0x34 |
| Schneider P3U30 | RTU | 4 blocos FC03; comandos SBO; **8E1 de fábrica** |
| Siemens 7SR10 / 7SR5 / 7SR5111 | RTU / dual RTU+TCP | FP_32BITS_3DP→S32/1000/high_first; BI FC02 blocos esparsos; 7SR5111: CB double-bit, comando DPC FC15, `bo_outputs` configurável por instância (`io_config.bo` com coil/func override); SOE `eventos` |
| A966 SSU | serial proprietário | visual/independente, publica direto no broker |

`io_config.bo` (comando por ponto→BO, coil embutido NA GERAÇÃO → mudou coil = regerar+regravar).
`io_config.bi` ainda **não é consumido** (gap conhecido — indicador de DJ pendente).

---

## 6. Infra de teste JÁ existente (usar no plano da placa nova)

1. **Firmware de bancada TON-TESTE** (`PLATFORMIO/TESTES-BANCADA/TON-TESTE/`, 1353 l.): assistente `guia`
   (11 passos: I2C/expanders, RTC, ADC, SD, W5500 via SPI raw, loopback relé→DIN com +24 V, TR, PWM, RS485,
   LoRa eco com 2ª placa, resumo APROVADA/RESSALVA/REPROVADA), comandos avulsos, detecção de variante,
   OTA via ota_safety (base `AUPUS_TESTE`). Prebuilt `ton-teste-v2.bin` gravável via Web Serial pelo NexON.
2. **POP em PDF**: `/var/www/POP-Teste-Bancada-TON-v2.pdf` (procedimento passo a passo p/ técnico).
3. **Modo Simular** do diagrama: firmware 🧪 com dados plausíveis, prefixo `TESTE/`, OTA bloqueado,
   heartbeat com `sim:<nome>` p/ auto-casamento no painel "Comando de Teste".
4. **Isolamento TESTE/**: backend assina `TESTE/#` sem ingerir; `GET /api/v1/iot/sim/bench-satellites`
   lista boards vivos; flags `sim`/`testMac` (remap de MAC) nos endpoints de comando — produção intocada.
5. **Ferramentas**: `mosquitto_sub/pub` 2.0.18 no VPS; `<base>/diagnostics` a cada 60 s; endpoints
   `/api/v1/mqtt/diagnostico*`; compilador `/health` (pio ok).
6. ~17 subprojetos ad-hoc em TESTES-BANCADA (P3U30, GoodWe, M160, LoRa Tx/Rx, WiFi diag…).

---

## 7. Achados da varredura (2026-07-21) — divergências a resolver

1. **DIN off-by-one no firmware GERADO**: `iot-firmware-base.v2.js:159` lê `_mcp.digitalRead(i+1)` →
   d1..d6 = GP1..GP6. Esquemático SCH-TON-v1a (e TON-TESTE corrigido) dizem DIN1-6 = **GP0-GP5**, GP6=M0.
   Ou seja: no gerado, DIN1 nunca é lida e "d6" lê a linha M0 do LoRa. Verificar se algum site usa DIN via
   firmware gerado e corrigir.
2. **OTA sem checagem de `target_mac` no firmware gerado** (só ota_safety tem). Com retained QoS1 no
   `<base>/ota/cmd` e base compartilhada de bancada (`AUPUS_TESTE`), uma placa nova pode pegar OTA residual
   de outra. Mitigação: auto-clear + 180 s; recomendação: portar `_ota_mac_matches` pro gerado.
3. **RTC**: 3 versões conflitantes nos artefatos (DS3231 I2C 0x68 no bloco `integrated` do diagrama vs
   2 fios IO3/IO9 confirmado em bancada vs "sem driver" no gerado). Real: IO3/IO9, part number desconhecido,
   ninguém lê. O bloco `integrated` do iot-diagram.v2.js está desatualizado.
4. **Docs defasados**: SISTEMA_FIRMWARE_TON.md parou em 28/04 (não cobre LoRa mestre-puxa, SOE, relé TCP,
   NTP-Eth, epoch); IMPLEMENTACAO_OTA.md não menciona target_mac nem HTTP :80; protocolo LoRa e M160
   decimal register só existem em código/memória.
5. **Compilador de staging parado** (porta 3210) — nginx aponta pra porta morta.
6. Duas cópias divergentes de `RELE-URP6000_RS485_MQTT` (raiz vs SUP_PRIME) — canônica indefinida.
7. Firmwares legados SEM OTA em campo: SUP_PRIME/EV-PD666, UFV-SOLAR_POWER, OLI/NSA, RELE-URP6000.

## 8. Riscos específicos para o teste da placa nova

- **Pinout 100% hardcoded em 2 lugares** (hal.h do gerador + TON-TESTE). Mudou pino → firmware grava GPIO
  errado; passo 6 do guia chaveia +24 V — risco físico se um GPIO virou outra função.
- **NÃO gravar o `ton-teste-v2.bin` prebuilt às cegas** na placa nova — recompilar/forkar com o pinout dela
  primeiro. `detectVariant()` (AUX + mcpOut) dá falso diagnóstico se endereços/pinos mudarem.
- Endereços I2C 0x26/0x27: mudança de strap falha SILENCIOSAMENTE (placa "vira" TON1 na detecção).
- **MAC novo × cadastro**: `equipamentos.mac_address` é UNIQUE e o announce `/status` SUBSTITUI o MAC do
  equipamento. Placa nova com topic base de produção sequestra o cadastro da placa de campo (e o LWT
  derruba o status). Sempre bancada = `TESTE/` + testMac.
- Se mudou MCU/flash: partições 8MB, rollback esp_ota_ops, `qio_qspi` e `BOARD_HAS_PSRAM=0` são premissas
  da v1 (PSRAM × W5500). Se mudou o chip Ethernet (≠W5500): caem juntos Version Register check, NTP
  EthernetUDP e OTA HTTP :80.
- RS485 fixo 9600 8N1 → separar "defeito da placa" de "framing errado do device" no teste.
- Broker é servidor remoto com auth incerta (firmware conecta anônimo) — fora do nosso controle direto.
- Limitações de SOFTWARE que não são defeito da placa: rtu_tcp sem escrita/BI/SOE; io_config.bi não
  consumido; RTC sem driver; binário LoRa 1 salto.

## 9. Perguntas — status (2026-07-21)

**Respondidas**: nomenclatura = **TON-V2**, mantém conceito de variantes; MCU/flash iguais (S3 N8R2 8MB);
esquemático em `/var/www/SCH-TON-v1b.pdf` (analisado no §1b). Ambiente de teste: em standby por decisão
do usuário (prioridade = conhecimento).

**Ainda em aberto**:
1. **AN_C1/AN_C2 em IO40/IO39 (sem ADC no S3)** — intencional (entrada digital de limiar) ou erro de
   design? Se leitura 4-20 mA analógica é requisito, precisa retrabalho (jumper p/ pino ADC1/2 ou ADC externo).
2. O que era o "problema hardware RS485" da v1 e a V2 corrige? (mesma topologia MAX485 na V2)
3. E220 da V2: como será configurado (canal/addr/air rate) já que M0/M1 estão em GND? Vem pré-configurado?
4. Origem do CLK25MH no EXTCLK do PCA9685 (oscilador dedicado?) — só documentação, firmware usa osc interno.
5. IO46 (PWM) realmente ficou sem função na V2?
6. Spec dos relés MKB-1M-05 (corrente/contatos) p/ documentar limites.
7. Quantidade de placas V2 e objetivo imediato (bring-up bancada × piloto campo).
8. RTC: part number continua desconhecido — segue sem driver mesmo na V2?
