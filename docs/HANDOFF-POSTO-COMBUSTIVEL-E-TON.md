# HANDOFF — Projeto do Posto de Combustível (Bomba RFID) + Plataforma TON

> **Para quem:** uma sessão de planejamento em outro chat, sem contexto prévio. Este documento é
> autossuficiente: descreve o que a TON é (hardware V1 e V2, variantes 1-4, firmware, contrato
> MQTT/Modbus/LoRa/OTA, como o NexON a modela) e **tudo que já existe e foi decidido** sobre o
> projeto do posto de combustível — inclusive os furos encontrados na varredura de 18/09/2026.
> O resultado do planejamento volta para a sessão de implementação (que tem acesso ao VPS).
>
> **Gerado em:** 2026-09-18 · **Fontes:** código real (`/var/www/service-nexon/{AupusNexOn,aupus-nexon-api}`,
> `/var/www/iot_nexon`), banco NexON (`aupus`), esquemáticos `SCH-TON-v1a`/`SCH-TON-v1b`,
> `Datasheet-TON-v1b.pdf`, docs em `docs/` e memória de sessões anteriores.
> Tudo que está marcado **⚠️** é fato verificado que contradiz a intenção original ou exige decisão.

---

## 0. Resumo em 10 linhas

1. **TON** = controlador IoT da Aupus (ESP32-S3-WROOM-1-N8R2, placa própria). Duas revisões de
   hardware (**V1** = esquemático `SCH-TON-v1a`, **V2** = `SCH-TON-v1b`), cada uma com **4 variantes de
   montagem** (1 = base, 2 = +LoRa, 3 = +relés/IO, 4 = tudo). Nomes comerciais no datasheet: TON-100/200/300/400.
2. A TON lê dispositivos Modbus (RS485, TCP), tem entradas/saídas digitais (expansores I2C), analógicas,
   LoRa (V2/V4), Ethernet W5500, WiFi, SD, OTA. Fala **MQTT** com o broker `72.60.158.163:1883`.
3. O firmware de produção é **GERADO** no navegador a partir do **diagrama IoT** do NexON (gerador V1 para
   `ton1..ton4`, gerador separado V2 para `ton1v2..ton4v2`), compilado por um serviço PlatformIO no VPS e
   gravado por USB (Web Serial) ou OTA. Também existem firmwares **manuais** em `/var/www/iot_nexon/PLATFORMIO/`.
4. No NexON, a TON é uma linha em `equipamentos` (auto-criada ao salvar o diagrama); seus canais físicos
   (BO relés, BI entradas, AI analógicas) são amarrados a **pontos lógicos** de outros equipamentos
   (`equipamento_pontos`) via `ton_bo/ton_bi/ton_ai` (+ espelho `iot_vinculos`).
5. **Posto de combustível:** equipamento "Bomba de Combustível" controlado por uma TON com relés (ton3/ton4
   ou v2 equivalentes). Máquinas da fazenda abastecem por **RFID**; a TON autoriza **offline** contra uma
   whitelist sincronizada do NexON, aciona o contator por pulso (BO Ligar/Desligar), corta por solenoide,
   mede litros (fluxômetro), nível do tanque (AI), intertravamentos (E-stop, tanque cheio, nível mínimo, timeout).
6. Já existe: componente `bomba` no diagrama, geração de firmware da bomba (máquina de estados) nos dois
   geradores, backend `bomba-combustivel` (RFID, config, whitelist, transações), tabelas, modal no unifilar,
   relatório de abastecimento por unidade, firmware manual de bancada e de produção (modo simulação), catálogo.
7. **Ainda não existe:** leitura real de fluxômetro/leitor RFID/nível no firmware gerado (litros são
   simulados por tempo × vazão), bancada com periféricos reais (Fase 0 nunca rodou com hardware real),
   PDF do relatório, limite litros/dia, buffer de transações dedicado no firmware gerado.
8. ⚠️ **Três furos de integração encontrados hoje (18/09):** whitelist publicada no tópico da BOMBA (que não
   tem tópico) em vez do da TON; ingestão de produção grava `abastecimentos.equipamento_id` = id da TON (não
   da bomba); firmware manual publica em `TESTE/<MAC>/…` enquanto o backend de bancada resolve por
   `TESTE/<nome da TON>/…`. Detalhes em §7.8.
9. Único projeto cadastrado: **"IoT Posto"** (unidade "Posto Fazenda Algodoeira", planta "Fazenda
   Cristalina"), com TON3 (V1) + bomba BC-01, vínculos BO1/2/3 + BI1/2 + AI1 já feitos. Zero transações reais.
10. Decisão pendente central para o planejamento: **quais periféricos físicos** (leitor RFID, fluxômetro,
    nível) e **em qual interface** (RS485/Modbus é o primário decidido; Wiegand e pulso exigem GPIO nativo).

---

## 1. Ecossistema — onde a TON vive

```
[Placa TON (ESP32-S3)] --Modbus RTU (RS485) / Modbus TCP / LoRa--> devices (inversores, medidores, relés, sensores)
        | MQTT via WiFi (lwIP) ou Ethernet W5500 (pilha própria do chip)
        v
[Broker MQTT 72.60.158.163:1883]   (servidor SEPARADO do VPS NexON 92.113.38.164; firmware conecta sem user/pass)
        ^                    ^
        | sub/pub            | comandos / OTA / whitelist
[aupus-nexon-api (NestJS, pm2 "aupus-nexon-api", :3001, prefixo /api/v1)] ---> Postgres "aupus" (:5433)
        ^
[AupusNexOn (React/Vite SPA, nginx serve dist/)] — editor do diagrama IoT + GERADOR de firmware (roda no browser)
        | POST /iot-compile (nginx → 127.0.0.1:3211)
[aupus-firmware-compiler (pm2)] → `pio run` → .bin em artifacts/ (servido em HTTP :80 e HTTPS p/ OTA)
```

- **Repos:** frontend `/var/www/service-nexon/AupusNexOn`, backend `/var/www/service-nexon/aupus-nexon-api`,
  firmware manual/legado `/var/www/iot_nexon` (PLATFORMIO/, lib/ota_safety). Docs em `/var/www/service-nexon/docs/`.
- **Catálogo de dispositivos Modbus vive no BANCO** (`iot_device_tipos` famílias/pontos + `iot_device_modelos`
  mapas de registradores), servido como JS por `GET /api/v1/iot-catalog/device-catalog.js`. A paleta de tipos
  do diagrama (COMPONENT_TYPES/TON_CAPS/CATEGORIES) também já é servida do banco (`GET /iot-catalog/palette`,
  de `tipos_equipamentos.propriedades_schema`), com o JS embutido como fallback.
- **Isolamento de bancada:** prefixo de tópico `TESTE/` é assinado pelo backend (`TESTE/#`) sem ingerir
  telemetria de produção; o botão "Simular" do diagrama gera um firmware 🧪 que publica em `TESTE/…`, sem OTA.

---

## 2. Hardware TON — família, versões e variantes

### 2.1 Nomenclatura (três eixos que se confundem — fixar isto primeiro)

| Eixo | Valores | Onde aparece |
|---|---|---|
| **Revisão de hardware** | **V1** = esquemático `SCH-TON-v1a` (EAGLE 9.5, 2026-06) · **V2** = `SCH-TON-v1b` (EAGLE 9.7, 2026-07) | PCB físico. "TON-V2" foi o nome decidido em 21/07/2026 para a placa v1b |
| **Variante de montagem** (o que está populado) | **1** base · **2** +LoRa · **3** +relés/IO de comando · **4** LoRa + relés | Tipos do diagrama `ton1..ton4` (V1) e `ton1v2..ton4v2` (V2); nomes comerciais TON-100/200/300/400 |
| **Firmware** | gerado V1 (`iot-firmware-generator.v2.js`) · gerado V2 (`iot-firmware-generator.ton-v2.js`) · manual (PlatformIO) | ⚠️ "v2" no nome do gerador V1 é a versão 2 do GERADOR, não o hardware V2 |

⚠️ **Armadilha de nome:** "ton2" (variante com LoRa, sem relés, do hardware V1) ≠ "TON-V2" (revisão de
hardware v1b). No projeto do posto, as memórias antigas dizem "TON2" querendo dizer a placa V2; **a bomba
precisa de relés, logo exige variante 3 ou 4** (`ton3`/`ton4` ou `ton3v2`/`ton4v2`) — isso já foi corrigido
no gerador (`ton2` tem `bo_count:0`).

### 2.2 Matriz de capacidades (fonte canônica `TON_CAPS`, idêntica no front `iot-diagram.v2.js:23-34`, no backend `shared/util/ton-caps.ts` e no banco)

| Tipo | HW | LoRa | Comando (relés) | BI (entradas ópticas) | BO (relés) | PWM | AI (analógicas) | AN_C 4-20 mA | SU+ | TR (transistor) | RS485 | Ethernet | SD | USB-C |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `ton1` (TON-100) | V1 | — | — | 6 | 0 | 1 (IO46) | 2 | — | — | 4 | ✅ | ✅ | ✅ | ✅ |
| `ton2` (TON-200) | V1 | ✅ | — | 6 | 0 | 1 | 2 | — | — | 4 | ✅ | ✅ | ✅ | ✅ |
| `ton3` (TON-300) | V1 | — | ✅ | 6 | 6 | 1 | 2 | — | — | 4 | ✅ | ✅ | ✅ | ✅ |
| `ton4` (TON-400) | V1 | ✅ | ✅ | 6 | 6 | 1 | 2 | — | — | 4 | ✅ | ✅ | ✅ | ✅ |
| `ton1v2` | V2 | — | — | 8 | 0 | 8 (PCA9685) | 2 | 2 ⚠️ | ✅ | 4 | ✅ | ✅ | ✅ | ✅ |
| `ton2v2` | V2 | ✅ | — | 8 | 0 | 8 | 2 | 2 ⚠️ | ✅ | 4 | ✅ | ✅ | ✅ | ✅ |
| `ton3v2` | V2 | — | ✅ | 8 | 8 | 8 | 2 | 2 ⚠️ | ✅ | 4 | ✅ | ✅ | ✅ | ✅ |
| `ton4v2` | V2 | ✅ | ✅ | 8 | 8 | 8 | 2 | 2 ⚠️ | ✅ | 4 | ✅ | ✅ | ✅ | ✅ |

Regras derivadas dessa matriz (implementadas):
- `comando = true` ⇒ o equipamento TON nasce com `automacao = true` e aceita `ton_bo`; `bo_count` limita `bo_numero`
  (v2 = dado real; v1/legado = 6 por compatibilidade histórica mesmo em ton1/ton2 — `tonBoMax`).
- `bi_count` ⇒ o firmware publica `d1..dN` (+ `s1` = SU+ na V2 quando não há SSU); backend aceita `/^d\d{1,2}$/`.
- `lora = true` ⇒ o nó pode conectar a outra TON LoRa (topologia gateway/satélite, §4.5).
- `pwm_count` (só V2) ⇒ comando `pwm<N> <0-100>`.
- AI = 2 em todos (`tonAiCount`). AN_C existem no código da V2 (`adc_read_ma`) mas **os pinos IO39/IO40 não têm ADC** no S3 (ver §2.5).
- ⚠️ Os MCP23008 vêm montados mesmo em ton1/ton2 → **não dá para auto-detectar a variante** por I2C; o tipo é escolhido pelo humano.
- **Regra de prefixo:** todo tipo novo de TON TEM de começar com `ton` (≥ 8 filtros `startsWith('ton')` no front/backend).

### 2.3 Pinout comum (V1 e V2 — o que NÃO mudou)

| Interface | Pinos ESP32-S3 | Observações |
|---|---|---|
| MCU / board | ESP32-S3-WROOM-1-N8R2, PlatformIO `lolin_s3`, flash 8 MB `qio_qspi`, `BOARD_HAS_PSRAM=0` (**obrigatório**: PSRAM colide com W5500), USB-CDC nativo (`ARDUINO_USB_CDC_ON_BOOT=1`), partições `default_8MB.csv` (2 slots OTA) | Datasheet cita 2 MB PSRAM; o firmware não a usa |
| I2C | SDA = IO4, SCL = IO5, 100 kHz | MCP23008 entradas **0x26**, MCP23008 relés **0x27** (⚠️ esquemático diz 0x20/0x21 — real é 0x26/0x27, confirmado por scan) |
| RS485 (MAX485) | UART1 **TX = IO18, RX = IO17**, DE/RE = IO8 | 9600 8N1 fixo no gerador; labels TX1/RX1 do esquemático são "do lado do transceptor". 1 porta só (bornes A/B) |
| LoRa E220-900T30D | UART2 — **ESP TX = IO15 (net RX2 → RXD do E220), ESP RX = IO16 (net TX2 ← TXD do E220)**, AUX = IO47, 9600 8N1 | V1: M0/M1 no MCP 0x26 GP6/GP7 (configurável); V2: M0/M1 em GND (módulo vem pré-configurado). ⚠️ Os `#define UART2_TX 16 / UART2_RX 15` do firmware são nomeados pela ótica do MÓDULO; o `begin(baud, cfg, rxPin=UART2_TX, txPin=UART2_RX)` inverte de volta — eletricamente ESP TX=15/RX=16 (validado em bancada, confere com datasheet e esquemático) |
| Ethernet W5500 (módulo) | SPI2 MOSI = 11, SCLK = 12, MISO = 13, CS = 10, RST = 14, 8 MHz | Pilha TCP/IP **dentro do chip** (≠ lwIP do WiFi) → NTP/HTTP têm caminhos próprios no cabo (§4.6). Inicializar W5500 **antes** do SD |
| SD card | SPI3_HOST MOSI = 35, SCLK = 36, MISO = 37, CS = 38, 8 MHz | Workaround GPIO-matrix (zona MSPI). Buffer offline de MQTT |
| Saídas a transistor TR1-4 | IO1, IO2, IO42 (TR3), IO41 (TR4) — BC817 coletor aberto, até 30 V/300 mA por canal (datasheet) | Conector X11 (GND, TR1..TR4) |
| Analógicas AN1/AN2 | IO6, IO7, ADC 12 bits, 0-24 V | Divisor V1 8,01× / V2 7,67× (22K/3K3; ~25 kΩ de entrada). Máx ~26 V |
| RTC | 2 fios dedicados CK = IO3, DT = IO9 | ⚠️ **NÃO é I2C**; part number desconhecido; nenhum firmware lê (hora vem de NTP/gateway) |
| USB-C | D− = IO19, D+ = IO20 | Gravação por esptool, console serial |
| Botões | RESET → EN; S2 → IO0 (BOOT / entrada de usuário); LEDPROG | |
| Alimentação | 5 V CC (jack J1 + USB) → LM1117 3V3; 2 A recomendados; relés com bobina 5 V (MKB-1M-05) | |
| Mecânica | 120 × 100 mm, 4 furos, 0-60 °C (datasheet) | |

### 2.4 O que muda de V1 (v1a) para V2 (v1b)

| Recurso | V1 (SCH-TON-v1a) | V2 (SCH-TON-v1b) | Impacto |
|---|---|---|---|
| Entradas ópticas (TLP183) | **6** — MCP 0x26 **GP1-GP6** (X12-1..6; GP0 não é entrada) — **confirmado em bancada 22/09/2026**; conector X12 = GND + 6 | **8** — MCP 0x26 **GP0-GP7**; X12-1..8 | O firmware gerado V1 (`GP(i+1)`) está CERTO; o "off-by-one" registrado na memória/esquemático era falso. ⚠️ o bench `ton-teste-v2.bin` (V1) lê GP0-5 = errado |
| Relés (ULN2803) | **6** — MCP 0x27 **GP1-GP6**; X1-X6 | **8** — MCP 0x27 **GP0-GP7**; X1-X8 | ⚠️ mapa deslocado −1: firmware V1 numa placa V2 aciona o relé errado (r1 → RL2). **Nunca gravar bin V1 em placa V2** |
| PWM | 1 canal, IO46, MOSFET AOD7N65, X8 | **8 canais** via **PCA9685 @ I2C 0x42** → MOSFETs AO3400 open-drain → X88-1..8; IO46 fica livre | driver novo (`pwm.h/cpp`) só na base V2 |
| Analógicas | AN1/AN2 divisor 8,01× | divisor 7,67×; **+ AN_C1/AN_C2 4-20 mA** (polyfuse 1206L + shunt 165 R, X77-5/X77-4) em **IO40/IO39** | ⚠️ **IO39/40 não têm ADC no ESP32-S3** (ADC1 = GPIO1-10, ADC2 = 11-20). Confirmado em bancada (`Pin 40 is not ADC pin!`). Erro de design; fix futuro = trocar com IO3/IO9 do RTC ou ADS1115 |
| SU+ | — | entrada de contato seco em **IO48** (X14, pull-up 3V3/680 R + TVS) | publicado como `s1` em `/inputs`; na TON-V2 com SSU o IO48 vira RX da UART0 a 110 baud (§4.8) |
| LoRa M0/M1 | controláveis (MCP GP6/7) → `lora config/pair` funcionam | **aterrados** → E220 precisa vir configurado de fábrica (canal 18 / addr 0) | bench V2 sem `lora config` |
| RS485 | X9 | bornes A/B ("RS485-1/-2") — mesma topologia MAX485 | validado com PD666 na V2 |
| Validação | em campo há anos | placa nº 1 **APROVADA COM RESSALVA** em 21/07/2026 (10 OK / 3 atenção: SU+ jig, Ethernet sem cabo, RTC) | |

**Entradas digitais (X12) são contato seco referenciado ao GND da placa** (LED do opto alimentado
internamente por 5 V/470 R; fechar X12-n ao GND ativa). ⚠️ O datasheet diz "nível nominal 12 V CC, 23 mA
por canal, comum negativo" — divergência a esclarecer com o hardware; **não aplicar 24 V direto** sem confirmar.

### 2.5 Datasheet (`/var/www/Datasheet-TON-v1b.pdf`, "Hardware rev. v1b, Abril 2026") — leitura crítica

O datasheet descreve a família comercial **TON-100/200/300/400** com **6 relés, 6 entradas, 1 PWM, 4 TR, 2 AI**,
render do PCB com X1-X6 / X12 de 7 pinos / X8 PWM / X9 RS485 — ou seja, **o conteúdo corresponde à placa
v1a (V1)**, apesar do título "v1b". Divergências a resolver com o chefe antes de usar como referência:
1. Título "v1b" × conteúdo v1a (a v1b real tem 8 relés, 8 DIN, PCA9685, AN_C, SU+, X88/X77/X14).
2. LoRa IO15 = TX do ESP / IO16 = RX do ESP — CORRETO (confere com o esquemático: net RX2 no IO15 vai ao RXD do E220). Os `#define` do firmware usam nomes pela ótica do módulo, o que confunde; ver §2.3.
3. Entradas "12 V CC / 23 mA" × contato seco a GND (confirmado pelo dono em 21/07).
4. Mapa de GPIO marca IO39/IO40/IO48 "Livre" — na V2 são AN_C2/AN_C1/SU+.
5. Relés "5 A 250 VCA / 20 A 14 VCC" — spec do MKB-1M-05 ainda não conferida.
O que é útil e coerente: ESP32-S3 dual-core 240 MHz, 8 MB flash, WiFi b/g/n + BLE 5.0, Ethernet 10/100
RJ45, RS-485 half-duplex ±15 kV ESD, LoRa 850-930 MHz até 30 dBm (1 W) ~10 km, protocolos Modbus
RTU/TCP, MQTT, HTTP(S), NTP; alimentação 5 V/2 A; 120 × 100 mm; 0-60 °C; acessórios (antena SMA, fonte,
microSD, caixa); "placa aberta — o comprador desenvolve e grava o firmware" (Arduino/PlatformIO/ESP-IDF).

### 2.6 Gotchas de hardware (lista de bolso)

- I2C 0x26/0x27 (não 0x20/0x21). MCP montados em todas as variantes.
- V1: DIN1-6 = GP1-GP6 e RL1-6 = GP1-GP6 (bancada 22/09); V2: DIN GP0-7 e RL GP0-7. O suposto off-by-one das DIN na V1 NÃO existe.
- AN_C (4-20 mA) da V2 sem ADC. AI reais = AN1/AN2 (IO6/IO7).
- Duas pilhas de rede (lwIP WiFi × W5500). Ordem de boot: W5500 antes do SD.
- RS485 fixo 9600 8N1 → configurar o escravo (PD666 sai 8N2, P3U30 8E1, 7SR10 19200). TON no RS485 de
  inversores vira **2º mestre** e colide com o datalogger do fabricante → ler via Modbus TCP do datalogger.
- RTC sem driver/part number. LoRa V2 sem M0/M1. SD: cartão ruim parece placa ruim (testar outro cartão).
- MAC: usar o do `[BOOT] MAC:` (WiFi STA), nunca o do flasher/etiqueta (bit U/L). `equipamentos.mac_address`
  é UNIQUE e é auto-capturado pelo announce `/status`. Ler MAC em bancada só pelo comando serial `sn`
  (DTR/RTS pode cair em modo download). SN das TONs: `TIPO-VERSÃO-SEQ(5 díg)-MAC` (scanner `mac-scanner.html`).
- Bancada com tópico de produção sequestra o cadastro (announce substitui o MAC, LWT derruba o status) → sempre `TESTE/`.

---

## 3. Firmware da TON — dois caminhos

### 3.1 Gerado pelo diagrama (produção)

- **Editor:** `AupusNexOn/public/iot-diagram.v2.js` (tipos, regras de conexão, TON_CAPS) carregado por
  `src/features/supervisorio/components/iot-diagram.tsx` (cache-bust `IOT_SCRIPTS_VERSION`).
- **Geradores:** `public/iot-firmware-generator.v2.js` (V1, `FirmwareGenerator`, `analyze()` só vê `ton1..ton4`)
  e `public/iot-firmware-generator.ton-v2.js` (`FirmwareGeneratorTonV2`, só `ton*v2`). Bases de código fixo:
  `public/iot-firmware-base.v2.js` / `.ton-v2.js` (hal.h, inputs, relays, outputs, adc, ota, sd_buffer, +pwm na V2).
  Ambos os geradores são JS puro sobre `{components, connections}`; entry = `generateAll()` → 1 projeto por
  TON `{name, files, warnings, spec}`; o front concatena os dois.
- **Pipeline:** analisar grafo (o que cada TON lê e por qual meio; WiFi do roteador; broker; LoRa por
  layout) → gerar `platformio.ini`, `include/config.h`, `include/hal.h`, `src/main.cpp`, `src/mqtt.*`,
  `src/eth.*`, `src/diag.*`, + condicionais `modbus_meter.*` (RS485), `inverter_tcp.*` (TCP), `lora.*`,
  `ssu*.*` (V2) → `POST /iot-compile` → `.bin` → gravar por Web Serial (esptool-js, app@0x10000 +
  otadata@0xe000) ou OTA.
- **Sempre ligado, não opcional:** watchdog, OTA (quando há WiFi), média das leituras, buffer SD, NTP, diagnósticos.
- **Regressão:** `AupusNexOn/tools/fw-regress/` (17 projetos reais do banco, byte-idêntico) e
  `scripts/regressao-firmware-v1.mjs`, `scripts/smoke-firmware-ton-v2.mjs [--compile]`. Compilador local: `pio run`.
- **Modo Simular:** botão no diagrama → firmware 🧪 com dados plausíveis, `TESTE/<base ou nome>` como base,
  OTA bloqueado, heartbeat `sim:<nome>` para o painel "Comando 🧪" auto-casar board↔TON.

### 3.2 Manual (PlatformIO em `/var/www/iot_nexon/PLATFORMIO/`)

Usado para bancada e para lógica que o gerador não cobre. Política: **todo firmware que vai para campo
precisa de OTA** — lib `iot_nexon/lib/ota_safety/` (mesmo protocolo `<base>/ota/cmd`, checa `target_mac`).
Relevantes para o posto: `TESTES-BANCADA/TON-TESTE` (HW V1, prebuilt `ton-teste-v2.bin`),
`TESTES-BANCADA/TON-TESTE-V2` (HW V2, prebuilt `ton-teste-ton-v2.bin`, comando `teste` com jig de fábrica),
`TESTES-BANCADA/BOMBA-COMBUSTIVEL-FASE0` (console de bancada da bomba), `BOMBA-COMBUSTIVEL` (produção da
bomba, hand-written — ver §7.5). POPs em PDF: `/var/www/POP-Teste-Bancada-TON-v1.pdf`, `-V2-v2.pdf`.

---

## 4. Contratos e protocolos (o que a TON fala)

### 4.1 MQTT — tópicos e payloads do firmware gerado

Base = `PROPRIETARIO/ESTADO/PLANTA/INSTALACAO` (props `mqtt_topic_base` da TON; **códigos curtos escritos à
mão**, não deriváveis do nome, ex. `OLI/GO/CHIMARRAO/BOMBAS`). Client ID `TON-<MAC12hex>`. QoS 0 (LWT QoS1).

| Direção | Tópico | Payload | Quando |
|---|---|---|---|
| pub | `<base>/status` (retained) | `{online,version,model,mac,ip,iface[,poll:1][,sim:"nome"]}`; LWT `{"online":false}` | conexão / morte |
| pub | `<base>/<device>_<addr>/data` | pontos do catálogo + `timestamp` (epoch s) + `samples` | a cada 60 s |
| pub | `<base>/<device>_<addr>/status` | `{"error":"no_samples",...}` | falha de leitura |
| pub | `<base>/inputs` · `/outputs` · `/relays` | `{d1..dN[,s1]}` · `{tr1..tr4}` · `{r1..rN}` | edge-triggered (scan 50 ms) + boot |
| pub | `<base>/diagnostics` | heap, modbus_ok/err, wifi_rssi, uptime, reset_reason… | 60 s |
| pub | `<base>/evt` | evento SOE de relé de proteção | poll do buffer |
| pub | `<base>/ota/status` | `{state,progress,version,msg}` | durante OTA |
| pub | `<base>/pivo` · `/bomba` · `/abastecimento` · `/carregador` | telemetria/eventos dos equipamentos "cérebro" | ver §7 |
| pub | `<base>/satellite/<MAC>/…` | repasse do gateway LoRa | topologia LoRa |
| pub | `<base>/cmd/ack` | `{cmd_id,status:ok\|error\|duplicate,msg,ts}` | resposta a comando |
| sub | `<base>/cmd` | `{"cmd_id":"…","cmd":"r1 on"}` ou `{"cmd_id","cmd":{"device":"Rele","cmd":"cmd_fechar"}}` | comandos |
| sub | `<base>/cmd/wifi` | `{action:add\|remove\|list, ssid, pass}` (multi-WiFi runtime, até 4 redes em NVS) | |
| sub | `<base>/cmd/rfid_sync` (retained) | `{"uids":["AABBCCDD",…]}` | whitelist da bomba |
| sub | `<base>/ota/cmd` (retained QoS1) | `{url,version,md5[,target_mac]}` | OTA |
| sub (gateway) | `<base>/satellite/+/cmd` | roteia por MAC para o satélite LoRa | |

**Comandos aceitos em `cmd` (também pelo Serial USB):** `r<1-8> on|off` (relé; `no_relays_in_model` se
variante sem relé), `tr<1-4> on|off`, `pwm<1-8> <0-100>|off` (só V2), `{"device":X,"cmd":cmd_id}` (coil
Modbus FC05/FC15 com rearme), `card <UID>` (bomba), `habilitar|desabilitar` (carregador),
`pivot on|off|dir l|r`, `status`. Dedup por `cmd_id` (ring 32). **Não há** `reboot`/`ota` em `cmd` (OTA tem tópico próprio).

Offline: todo `mqtt_publish` cai no SD (`/mqtt_buf.txt`, `topico\tpayload`, carimbo `ts`, 5 MB), drenado
5 msgs/10 s e na reconexão.

**Backend assina por equipamento com `mqtt_habilitado`:** base, `/status`, `/diagnostics`, `/cmd/ack`,
`/inputs`, `/evt`, `/abastecimento`, `/bomba`, `/carregador` + `TESTE/#`. Ingestão → `equipamentos_dados`
(buffer 1 min), `iot_dispositivos_online` (announce/diag; liveness), `equipamento_io_estado` (BI),
`rele_eventos` (SOE), `abastecimentos`/`bomba_combustivel_config`. Reconciliação de subscriptions a cada 5 min.

### 4.2 Modbus — quatro transportes gerados

| Transporte | Nó no diagrama | Framing | Leitura | Escrita | Limites |
|---|---|---|---|---|---|
| RS485 RTU direto | ligação `rs485` TON↔device | ModbusMaster, UART1 9600 8N1 | FC01/02/03/04 (blocos do catálogo) | FC05/06/15 + SBO; rearme de coil (write 1 → 3000 ms → write 0, `hold:true` isenta) | bloco ≤ 64 words; timeout 2 s; back-off 3 falhas → 30 s |
| MBAP datalogger | `inverter_datalogger` (WiNet-S, Logger1000, SmartLogger) | Modbus TCP :502 | FC01-04 | FC05/06/15 | reconecta a cada falha |
| RTU sobre TCP | `conversor` (USR-W610/TCP232) | RTU+CRC encapsulado | FC03/04 | **não** | sem BO/BI/SOE |
| TCP direto | device com `props.ip` (ex.: 7SR5111) | MBAP | FC01-04 (mapa `por_transporte.tcp`) | FC05/06/15 | |

Round-robin 4 s/device, publicação 60 s. ⚠️ Dois devices com o mesmo `props.name` quebram o comando
(o firmware casa por `strcmp(name)`); mudar nome exige regravar firmware.

### 4.3 Entradas/saídas nativas da TON (API do firmware base)

`inputs_get_state()` (bitmask das BI), `relay_set(n, bool)`, `output_set(n, bool)` (TR), `adc_read_mv(ch)`
(AN1/AN2; V2 também `adc_read_ma` para AN_C), `pwm_set_percent(ch, pct)` (V2), `su_get_state()` (V2).
Contato seco: BI ativa em LOW (`INPUT_PULLUP`).

### 4.4 Comando via NexON (ponta a ponta)

`POST /api/v1/equipamentos/:id/pontos/:pontoId/acionar` → `acionarPonto` → resolve o vínculo
(`iot_vinculos` primário, `ton_bo` fallback) → publica em `<topico da TON>/cmd` `{cmd_id, cmd:"r<N> on"}`
(pulso: on → `pulso_ms` → off) → espera `/cmd/ack`. Exige equipamento alvo com `automacao=true` (hoje
sincronizado com `scs_comando`) e TON com `mqtt_habilitado` + `topico_mqtt`. Comando via relé Modbus:
`resolveReleBo` → `{device, cmd}`. ⚠️ Para a bomba, o backend **bloqueia** o acionamento manual em produção
(400 "bomba autônoma") — só o painel de bancada (`sim=true`) pode pulsar os relés.

### 4.5 LoRa (E220 transparente, MTU 200 B)

Papel por layout: internet + par LoRa = **gateway**; sem internet + par = **satélite**. Envelope JSON
`{to,from,cmd_id,type,subtopic,payload,ttl}`, flood controlado com TTL 4 + dedup `from|cmd_id|type`.
**Mestre-puxa:** o gateway orquestra POLL round-robin (timeout 10 s, 3 timeouts → offline, cadência 60 s);
o satélite anuncia `poll:1` no heartbeat e o gateway aprende o MAC em runtime (não precisa no diagrama).
Telemetria de M160 em frame binário `$B$` (1 salto). Gateway carimba `timestamp` (satélite não tem NTP).
Comando: backend publica em `<base>/satellite/<MAC>/cmd`. **OTA via LoRa não existe** (satélite regrava por USB).
Cadastro: satélite = equipamento com `topico_mqtt = <base do gateway>/satellite/<MAC>`.

### 4.6 OTA, NTP, multi-WiFi

- **OTA:** `POST /equipamentos/:id/ota/[compilar-e-]publicar` → compilador → `.bin` + md5 → `<topico>/ota/cmd`
  retained QoS1 `{url,version,md5,target_mac}` (auto-clear). WiFi baixa por HTTPS (`setInsecure`); Ethernet
  por **HTTP :80** (W5500 sem TLS). Rollback: confirma após 3 publicações MQTT OK. ⚠️ `target_mac` só é
  checado pela lib `ota_safety` (firmwares manuais); o gerado V1 não checa — a base V2 tem `_ota_mac_matches`.
- **NTP:** SNTP no WiFi; no cabo, query manual via `EthernetUDP` (IPs fixos NTP.br). Timestamp padrão = epoch s.
- **Multi-WiFi:** até 4 redes (campos SSID 2/3/4 no nó Roteador → NVS com hash de config) + runtime
  `POST /equipamentos/:id/cmd/wifi`. Ethernet é primária quando há cabo.

### 4.7 Diagnóstico e bancada

`<base>/diagnostics` a cada 60 s; `GET /api/v1/mqtt/diagnostico*`, `POST /mqtt/diagnostico/resync`;
`GET /api/v1/iot/sim/bench-satellites` (boards vivos em `TESTE/`); `mosquitto_sub/pub` no VPS; painel
"Comando 🧪" com remap de MAC (`testMac`) para testar comando sem tocar cadastro de produção.

### 4.8 Extensão recente (TON-V2 apenas): leitor SSU NBR 14522

Substitui o gateway A-966 para ler o medidor da concessionária pela saída serial do usuário (110 baud,
open-collector). Nó `medidor_ssu` no diagrama, UART0 no IO48, payload drop-in do A966 por bucket de 15 min.
Lib em `AupusNexOn/firmware-libs/ssu_nbr14522/`. Doc `docs/IOT-SSU-NBR14522-TON-V2-INTEGRACAO.md`.
Relevante para o posto só como exemplo de "periférico novo na TON-V2" e porque **ocupa o IO48/SU+**.

---

## 5. A TON dentro do NexON (modelo de dados)

### 5.1 Entidades

- `iot_projetos` (1:1 com `unidades`; `diagrama` JSONB = fonte da verdade
  `{pan,zoom,nextId,components[{id,type,x,y,props}],connections[{from:{componentId,port},to,style}]}`),
  projeção relacional `iot_componentes`/`iot_conexoes` (recriada a cada PUT por `syncRelational`).
- `equipamentos` (tabela única; `origem` unifilar|iot; `tipo_equipamento_id → tipos_equipamentos` com
  `codigo`, `sigla`, `disp_unifilar`, `disp_iot`, `propriedades_schema`; colunas de cadastro SCS `scs`,
  `scs_comando`, `scs_status`, `scs_medicao` nenhuma|pm|ied; `automacao`; `topico_mqtt`; `mqtt_habilitado`; `mac_address` UNIQUE; `tag`).
- `equipamento_pontos` (`tipo` comando|status|medicao, `nome` = rótulo "Abrir", `unidade`, `ordem`; UNIQUE (equipamento_id, nome)).
- Canais físicos da TON → ponto: `ton_bo` (ton_id, bo_numero, equipamento_ponto_id, pulso_ms 500),
  `ton_bi` (bi_numero, invertido), `ton_ai` (ai_numero, mv_0, mv_100 — escala linear mV → %).
- `iot_vinculos` (unificação: `fonte_tipo` ton_bo|ton_bi|ton_ai|modbus_bo|modbus_bi|modbus_ai, `canal`, `sinal`,
  `papel`, `params`) — dual-write a partir das tabelas `ton_*`; comando de relé Modbus já é 100% vínculo.
- Catálogo IoT: `iot_device_tipos` (`codigo`, `pontos` jsonb `{ai,bi,bo,publish}`) + `iot_device_modelos`.

### 5.2 O que acontece ao salvar o diagrama (`PUT /iot/projetos/:id`, `iot.service.ts updateProjeto`)

1. `ensureTonEquipamentos`: toda TON sem vínculo válido reusa por `topico_mqtt` ou **cria** o equipamento
   (categoria TON, `tipo_equipamento = TIPO.toUpperCase()`, `automacao = caps.comando`, `mqtt_habilitado = !!topico`)
   e carimba `props.equipamento_id`. Tópico pode ser preenchido depois (propaga).
2. `ensureDeviceEquipamentos`: inversores/medidores/relés/SSU viram sub-equipamentos (`topico = <base>/<nome>_<addr>/data`).
3. `ensureBombaEquipamentos` / `ensureCarregadorEquipamentos`: ver §7.4.
4. `syncRelational` + espelho de vínculos (`resyncProjetoModbus`).

### 5.3 Tela da TON (redesenho de 10/09/2026)

Sheet lateral com TAG; três botões por **capacidade** (aparecem só se a variante tem): **Comando** (BO → ponto
de comando), **Status** (BI → ponto de status), **Medições/SCS** (device Modbus ou AI → ponto de medição),
em `components/VinculosTonSheet.tsx` gravando em `ton_bo/bi/ai`. `GET /iot/ton/:id/elementos-scs` lista os
elementos da unidade que declararam SCS e seus pontos. O botão "Comandos" (input livre) foi extinto.

### 5.4 Regras de conexão do editor (resumo)

TON ↔ `wifi_router`, `inverter_datalogger`, `conversor`, devices Modbus, `pivo`, `bomba`, `carregador`,
`medidor_ssu` (V2), outra TON **só se ambas têm LoRa**. `bomba`/`carregador`/`pivo` conectam **só a uma TON**
(Rule 8b/8c; ⚠️ cardinalidade não é validada). Estilos: `rs485`, `tcp`, `lora_radio`, `wifi`, `ethernet`, `ssu`.
Regras já existem em forma de dado (`conn.targets/role` em `propriedades_schema`) em modo sombra.

---

## 6. Projetos "equipamento-cérebro" já feitos na mesma arquitetura (referência para o posto)

| Equipamento | Padrão | Estado |
|---|---|---|
| **Pivô de irrigação** (`pivo`) | TON4 satélite LoRa aciona SoftStarter por relé (pulso), lê M160; máquina de estados no firmware; publica `<base>/pivo {estado,ps,dir,falha}`; comandos `pivot on/off/dir` | em campo (Chimarrão, 1 gateway TON2 + 3 satélites TON4) |
| **Carregador EV de condomínio** (`carregador`) | espelha a bomba: tag/porteiro libera, BO Habilitar mantido, BI Conectado encerra sessão, kWh por medidor Modbus ou do carregador; tabelas `moradores`, `carregador_config`, `carregador_sessoes`; export mensal CSV | Fases 0-2 deployadas (2026-08-25) |
| **CSMS OCPP 1.6-J** | servidor WebSocket `/ocpp/:cpId`, Authorize via whitelist de moradores | validado com simulador |
| **Bomba de combustível** (`bomba`) | este documento | ver §7 |

Padrão comum: equipamento com `automacao=true` + pontos canônicos semeados do catálogo (`iot_device_tipos.pontos`
com papéis bo/bi/ai) → usuário amarra BO/BI/AI na TON → o front resolve os papéis pelo **nome do ponto**
(regex `boRole/biRole/aiRole` em `buildBombaIoMap`) e injeta `_bombaIoByEquip[equipamento_id]` no gerador →
`_processBomba/_genBomba` emitem a lógica no `main.cpp`.

---

## 7. O PROJETO DO POSTO — Bomba de Combustível

### 7.1 Objetivo e decisões travadas com o dono (2026-08-19/20)

- Postos de combustível **das fazendas administradas**; máquinas autorizadas abastecem via **RFID**; o
  operador libera a bomba apresentando o cartão/tag. Cadastro no NexON, **execução na TON, offline-first**.
- **Leitor entrega o UID real** (não "botão"); TON casa contra **whitelist local** (sincronizada por MQTT
  retido, gravada em flash) e aciona **sem internet**.
- **Fluxômetro mede litros** por abastecimento. **Contator por pulso:** BO1 pulsa LIGA, BO2 pulsa DESLIGA;
  BO3 = solenoide de bloqueio (corte independente); relé spare para sinaleiro/buzzer (opcional).
- **"Tanque cheio" = os dois casos** (boia do tanque do posto + desarme do bico/tanque da máquina) — detalhar em campo.
- **Buffer de transações** na TON, sincroniza ao reconectar. **Nível do tanque** por AI (transmissor) — o
  4-20 mA nativo da V2 (AN_C) não funciona; usar AN1/AN2 ou transmissor Modbus.
- **Interface PRIMÁRIA = RS485/Modbus** (leitor RFID + fluxômetro + nível como escravos Modbus multi-drop
  no UART1), porque a TON é mestre Modbus nativo e isso contorna: (a) Wiegand impossível nas DIN do expansor
  I2C (lento), (b) pulso de fluxômetro impossível no expansor, (c) 4-20 mA morto. Wiegand e pulso ficam como
  fallback usando **GPIO nativo** (ex.: IO15/IO16 da UART LoRa quando não há LoRa; PCNT para pulso).
- **BO/BI/AI são da TON, não da bomba** (dono rejeitou campos de BO na bomba: "adaptar ao sistema que já
  existe"). Config da bomba (nível mín, timeout, K-fator, modo do leitor) vive nas **props do nó IoT**;
  o modal do unifilar tem só **Visão + RFID**. A bomba é **autônoma**: mapear BO→papel é configurar; clicar
  e ligar na operação **não** (só bancada).
- Nomenclatura da TON: **BI** (entrada digital d1..dN), **BO** (saída/relé), **AI** (analógica) — não "DIN".
- Relatório de abastecimento por máquina = irmão do relatório de consumo de energia (mesma via tela/PDF).
- A bomba entra no **fluxo do gerador** (não firmware avulso) — o dono quer o diagrama gerando o firmware.

### 7.2 Mapa de IO decidido (TON com relés)

| Canal | Papel | Ponto canônico (`equipamento_pontos`) | Observação |
|---|---|---|---|
| BO1 (RL1) | pulso LIGA contator | comando **Ligar** | 500 ms (hard-coded no gerado; `pulso_ms` na `ton_bo` não é usado pela bomba) |
| BO2 (RL2) | pulso DESLIGA | comando **Desligar** | se não mapeado, o firmware solta BO1 |
| BO3 (RL3) | solenoide de bloqueio | comando **Solenoide** | mantido ligado enquanto bombeia |
| BO4 (spare) | sinaleiro/buzzer | — | não implementado |
| BI "Cartão" | leitor (modo híbrido: "cartão presente") | status **Cartão** | no gerado, a borda de subida injeta o **UID de teste** (mecanismo de bancada) |
| BI "Emergência" | botoeira de emergência (E-stop) | status **Emergência** | aborta com `abortado_estop` |
| BI boia posto / BI desarme da máquina | "tanque cheio" físico | — (previsto no doc original, **não implementado**) | no gerado, cheio = **AI ≥ nivel_cheio_pct**, não BI |
| AI1 (AN1/IO6) | nível do tanque | medição **Nível** (%) | `pct = (mv − mv_0)/(mv_100 − mv_0)·100` |
| RS485 UART1 | leitor RFID (ID 10) + fluxômetro (ID 11) + nível (ID 12) Modbus | — | **planejado; não lido pelo firmware gerado** |

### 7.3 Máquina de estados (idêntica no gerado e no manual)

```
OCIOSA/IDLE (bomba off, solenoide fechada)
  └─ cartão (UID) → UID ∉ whitelist → publica {uid,status:"rejeitado"} → IDLE
                 → UID ∈ whitelist → E-stop? tanque cheio? nível < mín? → bloqueia (só log) → IDLE
                                   → ok → solenoide ON, PULSO BO1, guarda t_ini/nível_ini(/fluxo_ini) → BOMBEANDO
BOMBEANDO (checa nesta ordem): E-stop → abortado_estop | tanque cheio → tanque_cheio | nível < mín → nivel_baixo | timeout → timeout
  └─ encerrar: PULSO BO2, solenoide OFF, litros, publica <base>/abastecimento {uid,litros,nivel_antes,nivel_depois,status} → IDLE
Telemetria <base>/bomba a cada 30 s: {estado:"bombeando"|"idle", nivel_pct, nivel_mv, ai0_mv, ai100_mv}
```
Status possíveis: `abortado_estop`, `tanque_cheio`, `nivel_baixo`, `timeout`, `rejeitado`.
Ausente em ambos: "cartão retirado/re-lido encerra" (previsto no doc original), sinaleiro, limite litros/dia.

### 7.4 O que EXISTE hoje (estado real, verificado 18/09/2026)

**Diagrama / editor** (`public/iot-diagram.v2.js`): componente `bomba` (categoria "Irrigação / Bomba",
`generates_firmware:false` — a lógica sai pela TON), props: `name`, `equipamento_id`, `modo_leitor`
(rs485|hibrido|wiegand), `k_fator` (450), `ai_nivel` (1-2), `ai_nivel_100_mv` (3000), `nivel_cheio_pct` (95),
`nivel_min_pct` (5), `timeout_s` (600), `vazao_lps` (0,5 — simulação), `uid_teste` (AABBCCDD). Regras: TON
↔ bomba permitido (Rule 5), bomba só com TON (Rule 8b). Modal de props em grid 2 colunas com seções.

**Geradores** (V1 `iot-firmware-generator.v2.js:619/5780`, V2 `.ton-v2.js:648/6336`): `_processBomba` (lê
BO/BI/AI de `_bombaIoByEquip`, fallback props; avisa se TON sem relés ou sem BO Ligar) e `_genBomba` inline
no `main.cpp` (defines `BOMBA_TIMEOUT_MS`, `BOMBA_VAZAO_LPS`, `BOMBA_CHEIO_PCT`, `BOMBA_MIN_PCT`,
`BOMBA_AI_0_MV`, `BOMBA_AI_100_MV`; whitelist em **RAM, máx. 64 UIDs**, alimentada por
`<base>/cmd/rfid_sync` retained; comando `card <UID>` por MQTT/Serial; publica via `mqtt_publish_sub`,
`lora_publish_data` (se satélite) ou Serial). Compila (RAM ~16 %, Flash ~30 %). Harness
`scratchpad/gen-bomba-test.mjs` e `tools/fw-regress` (projeto "IoT Posto" incluído).

**Front** (`iot-diagram.tsx`): `buildBombaIoMap()` lê `ton_bo/ton_bi/ton_ai` de todas as TONs do diagrama e
resolve papéis por nome do ponto: `boRole` /deslig/→desliga (antes de liga), /\blig|acion|partid/→liga,
/solenoid|valvul|bloque/→solenoide; `biRole` /cart|rfid|leitor|tag/→cartao, /emerg|estop|parad|seg/→estop;
`aiRole` /nivel|tanque|level|volume/→nivel. ⚠️ Renomear os pontos quebra a resolução.

**Backend** (`aupus-nexon-api`):
- `ensureBombaEquipamentos` (`iot.service.ts:757-975`): no save, reusa/cria equipamento
  `BOMBA_COMBUSTIVEL` (`automacao:true`, **`mqtt_habilitado:false`, sem tópico**), semeia os 6 pontos do
  catálogo (`iot_device_tipos.pontos` da `bomba_combustivel`: bo Ligar/Desligar/Solenoide, bi Cartão/Emergência,
  ai Nível — fallback hard-coded idêntico), espelha `nivel_min_pct/timeout_s/k_fator/rfid_mode` em `bomba_combustivel_config`.
- Módulo `bomba-combustivel` (JWT; admin = super_admin|admin|gerente): `GET /bomba-combustivel/bombas`,
  `GET|POST /rfid`, `DELETE /rfid/:id`, `GET /abastecimentos?bombaId&limite`, `GET /:id/estado`,
  `GET|PUT /:id/config`, `POST /:id/whitelist/publicar`. Whitelist = `SELECT DISTINCT uid FROM rfid_autorizados
  WHERE ativo AND (bomba_id = X OR (bomba_id IS NULL AND planta_id = planta))`, publicada retained em
  `<topico_mqtt da bomba>/cmd/rfid_sync` (⚠️ §7.8-1). Re-publica ao salvar/remover RFID.
- Ingestão (`shared/mqtt/mqtt.service.ts`): assina `<base>/abastecimento` e `<base>/bomba` de cada equipamento
  com tópico; `ingerirAbastecimento` lê `uid, litros, nivel_antes, nivel_depois, status` (+ `maquina_nome` via
  `rfid_autorizados`, `planta_id` da unidade); `atualizarBombaEstado` lê `estado, nivel_pct`. Bancada:
  `TESTE/<nome da TON>/{abastecimento,bomba}` resolvida por `resolverBombaPorNomeTon` (nome da TON → ton_bo →
  equipamento dono do ponto). `acionarPonto` bloqueia bomba em produção (bancada `sim=true` passa).
- `ton_ai` (migração `db/manual-migrations/2026-08-20_ai_inputs.sql`), módulo `ton-ai`, rotas `/equipamentos/:tonId/ais`.

**Tabelas** (⚠️ sem migração versionada para as 3 da bomba — só existem no banco):
```
abastecimentos(id, equipamento_id, uid, maquina_id, maquina_nome, planta_id, inicio, fim, litros, nivel_antes, nivel_depois, status, created_at)
rfid_autorizados(id, uid, maquina_id, maquina_nome, operador, bomba_id, planta_id, ativo, limite_litros_dia, created_at, updated_at)
bomba_combustivel_config(id, equipamento_id, nivel_min_pct 5, timeout_s 600, k_fator 450, rfid_mode 'rs485', ultimo_nivel_pct, ultimo_estado, ultima_leitura, created_at, updated_at)   -- sem UNIQUE em equipamento_id
```
`inicio`/`fim` nunca são preenchidos pela ingestão; `limite_litros_dia` não é aplicado em lugar nenhum.

**Frontend do unifilar/relatórios:** `features/bomba-combustivel/BombaModal.tsx` (abas Visão: unidade,
cartões autorizados, última leitura, barra de nível, últimos 5 abastecimentos; RFID: UID/Máquina/Operador,
Autorizar, Publicar whitelist), aberto ao clicar na bomba no unifilar (precedência sobre modais de comando);
ícone `BombaCombustivelIcon` (dispenser). `features/relatorios/AbastecimentoReport.tsx` (aba Abastecimento em
Relatórios): seletor de unidade, litros por máquina (ignora `rejeitado`), lista de transações. Sem período, sem PDF.

**Catálogo:** `iot_device_tipos.bomba_combustivel` (pontos bo/bi/ai acima); `tipos_equipamentos.BOMBA_COMBUSTIVEL`
(sigla BOMB, `disp_iot` e `disp_unifilar` = true, categoria "Bomba de Combustível"); domínio `ambos`.

**Firmware manual** `/var/www/iot_nexon/PLATFORMIO/BOMBA-COMBUSTIVEL/` (env `bomba`, compila): `config.h`
(pinos, `RFID_MODE` RS485|HIBRIDO|WIEGAND|SIM, IDs/regs Modbus placeholders RFID_ID 10/FLUXO_ID 11/NIVEL_ID 12,
`FLUXO_K 450`, `MODO_SIMULACAO 1`, `TOPIC_BASE "TESTE"`; ⚠️ SSID/senha/IP em claro), `rfid_reader.h`
(drivers plugáveis `Rs485Reader` poll Modbus, `HibridoReader` BI "cartão presente" + leitura, `WiegandReader`
ISR D0/D1 em GPIO 15/16, `SimReader` serial `card <UID>`/botão BI5), `main.cpp` (mesma máquina de estados,
whitelist em **NVS** sem limite, **buffer offline NVS ring de 50** transações, litros reais
`(fluxo_acc − fluxo_ini)/FLUXO_K` quando não simulado, `ota_safety` base `AUPUS_BOMBA`). Publica em
`TESTE/<MAC>/{bomba,abastecimento}` (⚠️ §7.8-3). Bancada Fase 0:
`TESTES-BANCADA/BOMBA-COMBUSTIVEL-FASE0` (comandos `din`, `liga/desliga`, `sol`, `rN on/off`, `an`, `scan`,
`mb/mbi` descoberta Modbus, `rfid`, `fluxo`, `nivel`, `ciclo`, `guia`).

**Estado no banco (18/09):** projeto `IoT Posto` (`iot_projetos.id = 8378232b04d1c9f7f7fd7e8e8b`, unidade
"Posto Fazenda Algodoeira", planta "Fazenda Cristalina"): nós `ton3` (equip `0a4ab4f15937dd8483715a71a2`,
**tópico base vazio**, `mqtt_habilitado=false`), `bomba` (equip BC-01 `cmt07i88j0014jqyiue0j75na`, tipo
BOMBA_COMBUSTIVEL, `topico_mqtt = TESTE/posto1/bomba1`, automação on), broker `72.60.158.163:1883`, roteador
`AUPUS-ENERGIA_2.4G`. Vínculos na TON3: BO1 Ligar, BO2 Desligar, BO3 Solenoide (500 ms), BI1 Emergência,
BI2 Cartão, AI1 Nível (mv_100 3000). Config: nivel_min 5, timeout 600, k_fator 450, rfid_mode rs485, último
estado `idle` em 11/09 (teste de bancada via MQTT). `rfid_autorizados` = 0, `abastecimentos` = 0. As props
antigas `bo_liga/bi_cartao/...` ainda estão no JSON (ignoradas; `ton_*` manda).

### 7.5 Fluxo de configuração do usuário (como está hoje)

1. Diagrama IoT: adicionar TON3/TON4 (ou v2), Tópico Base, roteador/broker; adicionar **bomba** (associa/cria o
   equipamento BC-xx), preencher props (modo do leitor, K-fator, AI do nível, limiares, timeout); conectar TON↔bomba; **Salvar**
   (cria pontos, liga automação, espelha config).
2. Sheet da TON → **Comando**: BO → Ligar/Desligar/Solenoide; **Status**: BI → Cartão/Emergência; **Medições**: AI → Nível (mv_0/mv_100).
3. **Gerar firmware** (o front injeta o mapa BO/BI/AI) → compilar → gravar por USB (ou OTA se já em campo).
4. Unifilar: colocar a bomba, clicar → BombaModal → aba RFID: cadastrar UIDs → "Publicar whitelist".
5. Relatórios → Abastecimento → unidade.

### 7.6 Bancada já validada (11/09/2026) e o que faltou

- Ingestão de `TESTE/TON3/abastecimento` e `TESTE/TON3/bomba` por `mosquitto_pub` → linhas em
  `abastecimentos` e estado em `bomba_combustivel_config` → aparecem no modal e no relatório. ✅
- Firmware SIM gerado compila e o pipeline de comando de bancada (`Comando 🧪`) passa (sem board físico). ✅
- Vínculos exibidos corretamente após fix de padding char(26). ✅
- **Não rodou:** placa real com leitor RFID/fluxômetro/nível reais; medição de litros real; whitelist chegando
  na TON pelo caminho do NexON (ver 7.8-1); ciclo completo cartão → contator → litros → transação no NexON.

### 7.7 Pendências conhecidas (antes desta varredura)

- Definir e comprar periféricos: **leitor RFID Modbus** (registrador "último UID"), **fluxômetro** (Modbus ou
  pulso), **transmissor de nível** (Modbus ou 0-10 V/4-20 mA → AN1). Preencher IDs/registradores/K-fator no firmware.
- Implementar no **firmware gerado** a leitura real: poll do leitor (RS485), litros pelo fluxômetro (delta/K),
  nível Modbus (opcional) — hoje `_genBomba` só simula litros por tempo e só aceita UID por BI/`card`.
- Buffer offline dedicado + whitelist persistente (NVS) no firmware gerado (o manual já tem os dois).
- Limite litros/dia por UID: enforcement na TON (offline) × só alerta no NexON — decidir.
- Tanque cheio por BI (boia) além do limiar de AI; sinaleiro/buzzer; "cartão retirado encerra".
- PDF do relatório (via gerador isolado, como o boletim); filtro de período; `inicio/fim` das transações.
- `criarEquipamentoRapido` (pacote compartilhado) não seta automação — o `ensure*` local cobre.
- Migração versionada das 3 tabelas.

### 7.8 ⚠️ Furos encontrados na varredura de 18/09/2026 (fatos, com localização)

1. **Whitelist nunca chega à TON pelo caminho normal.** `publicarWhitelist` (`bomba-combustivel.service.ts:121-135`)
   exige `topico_mqtt` + `mqtt_habilitado=true` **na bomba**, mas `ensureBombaEquipamentos` cria a bomba
   com `mqtt_habilitado:false` e sem tópico (por design: "telemetria sai pelo tópico da TON"). Resultado:
   `{enviado:false}` + toast "Bomba sem tópico MQTT". O firmware assina `<base da TON>/cmd/rfid_sync`; **nada
   publica lá**. Na bancada foi contornado com `mosquitto_pub -t TESTE/TON3/cmd/rfid_sync -r`. Fix óbvio:
   resolver a TON dona dos pontos da bomba (ton_bo → ton) e publicar no tópico dela (ou `TESTE/<nome>` em SIM).
   (O BC-01 tem `TESTE/posto1/bomba1` de teste manual, por isso "parecia" funcionar.)
2. **Ingestão de produção grava o equipamento errado.** `<base>/abastecimento` e `<base>/bomba` são assinados
   com o `equipId` da **TON** (`mqtt.service.ts:453-465`), então `abastecimentos.equipamento_id` recebe o id da
   TON e o `UPDATE bomba_combustivel_config WHERE equipamento_id = <TON>` não casa (`775-783`). Só o caminho
   `TESTE/` (`714-729`) resolve para a bomba. O relatório/modal filtram pelo id da **bomba** → em produção
   ficariam vazios. Fix: resolver bomba por TON (mesmo helper do item 1) também no caminho de produção.
3. **Firmware manual × backend de bancada:** o manual publica em `TESTE/<MAC>/…` (`main.cpp:110`), o backend
   resolve `TESTE/<nome da TON>/…`. Um dos dois tem que mudar (o gerado já usa `TESTE/<nome>`).
4. **Litros sempre simulados no gerado** (`tempo × BOMBA_VAZAO_LPS`), apesar de `k_fator` existir em UI/props/tabela.
5. **Whitelist volátil no gerado** (RAM, 64 UIDs) — depende do retained do broker após reboot; sem NVS.
6. `resolverBombaPorNomeTon` não filtra por tipo → TON com BOs de pivô/carregador pode devolver o equipamento errado.
7. `GET /bomba-combustivel/:id/config` e `POST /:id/whitelist/publicar` não validam escopo por dono (regra
   absoluta do projeto: proprietário/operador só vê as próprias usinas).
8. Rule 8b não impede N bombas na mesma TON (o gerador só processa a primeira).
9. Ponto "Cartão" (BI) no gerado injeta o **UID de teste** — é mecanismo de bancada, não o modo "híbrido" real.
10. Credenciais WiFi e IP de broker em claro no firmware manual (`config.h:73-76`).

---

## 8. Perguntas que o planejamento deve responder

**Hardware/campo**
1. Qual placa vai para o posto: V1 (ton3/ton4, 6 relés/6 BI, estoque/campo) ou V2 (ton3v2/ton4v2, 8/8, PWM,
   SU+; validada em bancada, ainda sem campo)? Precisa de LoRa (posto sem internet → TON4 satélite + gateway)?
2. Periféricos: modelo do leitor RFID (Modbus? Wiegand? qual frequência/tag), fluxômetro (Modbus × pulso;
   K-fator), nível (Modbus × 0-10 V × 4-20 mA com conversor externo — AN_C da V2 não funciona). Mapa de
   registradores de cada um.
3. Elétrica: contator (pulso 500 ms basta? bobina?), solenoide, boia(s), botoeira, sinaleiro; alimentação da TON e do leitor.
4. "Tanque cheio": boia (BI) e/ou limiar de AI e/ou desarme do bico? Ordem de prioridade?
5. Se Wiegand: quais GPIO nativos (IO15/16 só se sem LoRa; IO46 livre na V2; IO21/IO45 livres no datasheet).

**Regras de negócio**
6. Limite de litros/dia (por UID/máquina): na TON offline ou só no NexON? Horário permitido? Operador × máquina
   (o UID identifica a máquina, o operador, ou ambos — dois cartões?).
7. Transação: o que fecha (cartão retirado? botão? tanque cheio? timeout?) e o que é "abortada" × "concluída".
8. Rejeições devem virar registro/alarme? Sinaleiro local?
9. Múltiplas bombas por posto (uma TON por bomba? uma TON com N bombas — hoje 1:1 no gerador)?
10. Relatório: métricas (litros por máquina/período, nível ao longo do tempo, consumo do posto, rejeições),
    PDF e envio (WhatsApp/e-mail, como o boletim semanal)?

**Software**
11. Manter a bomba **no gerador** (decisão do dono) — então onde entra a leitura Modbus dos 3 periféricos:
    como devices do catálogo (`iot_device_tipos` "leitor RFID", "fluxômetro", "transmissor de nível" com
    mapas Modbus) ligados à TON, e a bomba consome os pontos deles? Isso reaproveita todo o caminho Modbus existente.
12. Corrigir os furos 7.8-1/2/3 antes da bancada (são pré-requisito do ciclo completo).
13. Whitelist e buffer: NVS no gerado (como no manual) — tamanho máximo esperado de UIDs?
14. Identidade do tópico: bomba sem tópico (telemetria sai pela TON) ficou decidido; formalizar
    `abastecimentos.equipamento_id = bomba` e o resolver TON→bomba nos dois caminhos.
15. Migração versionada das tabelas + escopo por dono nos endpoints.

---

## 9. Índice de arquivos e documentos

| O quê | Caminho |
|---|---|
| Esquemático V1 / V2 · Datasheet | `/var/www/SCH-TON-v1a (1).pdf` · `/var/www/SCH-TON-v1b.pdf` · `/var/www/Datasheet-TON-v1b.pdf` |
| Base de conhecimento TON (protocolos, diff V1×V2, riscos) | `docs/IOT-TON2-BASE-CONHECIMENTO-TESTES.md` |
| Briefing e plano TON-V2 (6 camadas, matriz de capacidades, fases) | `/var/www/IOT-TON-V2-BRIEFING.md` · `docs/IOT-TON-V2-PLANO-IMPLEMENTACAO.md` |
| Doc original da bomba (arquitetura, Fase 0) | `docs/IOT-BOMBA-COMBUSTIVEL.md` |
| TON como entidade IoT / vínculos / sheets | `docs/IOT-TON-DOMINIO-EQUIPAMENTOS.md`, `docs/IOT-REESTRUTURA-0{1,2,3}-*.md` |
| Multi-WiFi · OCPP · SSU · comando FC05 | `docs/IOT-MULTIWIFI-TON.md` · `docs/IOT-OCPP-CSMS.md` · `docs/IOT-SSU-NBR14522-TON-V2-INTEGRACAO.md` · `docs/IOT-COMANDO-FC05-REARME-E-HOLD.md` |
| POPs de bancada | `/var/www/POP-Teste-Bancada-TON-v1.pdf`, `/var/www/POP-Teste-Bancada-TON-V2-v2.pdf` |
| Editor / geradores / bases | `AupusNexOn/public/iot-diagram.v2.js`, `iot-firmware-generator.v2.js`, `iot-firmware-generator.ton-v2.js`, `iot-firmware-base.v2.js`, `iot-firmware-base.ton-v2.js` |
| Front da bomba | `AupusNexOn/src/features/bomba-combustivel/BombaModal.tsx`, `src/features/relatorios/AbastecimentoReport.tsx`, `src/features/supervisorio/components/iot-diagram.tsx` (`buildBombaIoMap`), `components/VinculosTonSheet.tsx` |
| Backend | `aupus-nexon-api/src/modules/bomba-combustivel/`, `modules/iot/iot.service.ts` (`ensureBombaEquipamentos`), `shared/mqtt/mqtt.service.ts`, `shared/util/ton-caps.ts`, `modules/ton-{bo,bi,ai}/`, `modules/equipamentos-cmd/`, `db/manual-migrations/` |
| Firmware manual | `/var/www/iot_nexon/PLATFORMIO/BOMBA-COMBUSTIVEL/`, `TESTES-BANCADA/BOMBA-COMBUSTIVEL-FASE0/`, `TESTES-BANCADA/TON-TESTE{,-V2}/`, `lib/ota_safety/` |
| Harness de regressão | `AupusNexOn/tools/fw-regress/`, `scripts/regressao-firmware-v1.mjs`, `scripts/smoke-firmware-ton-v2.mjs` |
| Projeto irmão (carregador EV) | `docs/…` + `modules/carregador-eletrico/`, `features/carregador-eletrico/`, migração `2026-08-20_carregador_eletrico.sql` |

---

## 10. Glossário

**TON** controlador IoT Aupus · **V1/V2** revisão da placa (v1a/v1b) · **ton1..4 / ton1v2..4v2** tipos no
diagrama (variante de montagem) · **BI/BO/AI** entrada digital / saída a relé / entrada analógica da TON ·
**TR** saída a transistor · **SU+** entrada de supervisão (IO48, V2) · **AN_C** entrada 4-20 mA (V2, sem ADC) ·
**MCP23008** expansor I2C (0x26 entradas, 0x27 relés) · **PCA9685** controlador PWM I2C (0x42, V2) ·
**E220** módulo LoRa · **W5500** chip Ethernet SPI · **ponto** (`equipamento_pontos`) sinal lógico de um
equipamento (comando/status/medição) · **vínculo** amarração ponto ↔ canal físico/sinal Modbus ·
**SCS** declaração no cadastro de que o elemento tem comando/status/medição · **gateway/satélite** papéis LoRa ·
**mestre-puxa** gateway orquestra o polling dos satélites · **TESTE/** prefixo de tópico de bancada ·
**Simular** firmware de laboratório gerado pelo diagrama · **OTA** atualização pelo ar via `<base>/ota/cmd` ·
**A-966 / SSU** gateway de medidor da concessionária / saída serial do usuário NBR 14522 ·
**UID** identificador do cartão/tag RFID · **whitelist** lista de UIDs autorizados sincronizada por MQTT retido ·
**K-fator** pulsos por litro do fluxômetro · **PM/IED** medição por power meter / por relé de proteção.
