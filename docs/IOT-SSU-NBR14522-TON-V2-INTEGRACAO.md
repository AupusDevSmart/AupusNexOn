# Leitor SSU (NBR 14522) na TON-V2 — revisão da especificação e plano de integração no gerador

**Referência revisada:** `/var/www/SSU-NBR14522-TON-v2 (1).md` (spec da função de leitura, alvo E750 A2E3)
**Contexto:** a SSU na TON-V2 substitui o **gateway A-966** (que hoje lê a saída serial do medidor da
concessionária e publica sozinho em MQTT). Data: 2026-09-17.

---

## 1. Veredito

A especificação está **correta e bem delimitada**: descreve só a função *octetos → struct* (camada física a
110 baud, enquadramento por silêncio, autodetecção normal/estendido, LRC/CRC, decodificação, rastreio por
registrador com wrap, idempotência do bloco de fechamento, vetores de teste). Nada nela conflita com a
arquitetura do gerador. Ela **deve virar uma biblioteca da base V2** (`lib/ssu_nbr14522/`, como `pwm.h` e
`ota_safety`), testável no host com os vetores da §10.

O que a spec **deliberadamente deixa de fora** (§1: "nao publica em MQTT, nao grava em SD, nao conhece RTC,
RTP ou Ke") é exatamente o trabalho do **gerador + integração NexON**. Este documento fecha essas pontas com
base no código real, e aponta 6 ajustes pequenos na spec.

## 2. Três decisões que a spec deixa em aberto — fechadas pelo código

### 2.1 Pino e UART: IO48 deixa de ser `s1` e vira UART0
- Hoje na base V2, **IO48/SU+ é entrada de contato seco com debounce, publicada como `s1` no `/inputs`**
  (decisão #4 do plano TON-V2). Com medidor SSU ligado, o **gerador troca o papel do pino**: IO48 vira RX
  serial e `s1` some do `/inputs` daquele firmware (é o mesmo pino físico X14 — não dá pra ter os dois).
- **UART disponível:** o console é USB-CDC (`ARDUINO_USB_CDC_ON_BOOT=1`), RS485 usa a UART1 (TX18/RX17)
  e o E220 a UART2 (TX16/RX15). A **UART0 fica livre** em todos os modelos e o ESP32-S3 roteia qualquer
  UART para qualquer GPIO → `HardwareSerial ssu(0); ssu.begin(110, SERIAL_8N1, /*rx*/48, /*tx*/-1)`.
  Não precisa de bit-bang nem de trocar de UART entre modelos.
- **Enquadramento (§4):** usar a **opção 2 da spec** (RX-timeout em hardware): `ssu.setRxTimeout(n)` +
  `ssu.onReceive(cb)` entregam o bloco inteiro num callback, independente do loop principal — que no
  firmware gerado **bloqueia mesmo** (Modbus TCP, SD, LoRa). Fallback: leitura por interrupção de GPIO
  (9,09 ms/bit) se o core não fechar 110 baud (ver risco 6.1).

### 2.2 Formato de publicação: drop-in do A-966
O A-966 real publica hoje (tópico `<base>/A966/SSU/state`):
```json
{"NSU":32,"ver":"1.2.8.2509",
 "data":{"cdo":"15","phf":0,"phr":1532,"sts":1,"qhfc":4,"qhfi":0,"qhrc":0,"qhri":0,
         "frame":"00 90 a2 fc 05 04 00 c6 18"},
 "time":"1789661700"}
```
e o backend ingere isso pela **categoria "Gateway"** (`salvarDadosGateway`: pulsos do bucket × KD →
`energia_kwh`/`potencia_ativa_kw`, glitch de phf, P_direto/P_rev/Q), o dashboard do gateway, o COA e a
demanda leem `phf/phr/qhf*/qhr*` por **bucket de 15 min**. Logo a TON-V2 publica **exatamente este JSON**:
- `phf/phr/qhfi/qhfc/qhri/qhrc` = **pulsos crus acumulados no bucket**, 1:1 com os seis registradores da
  §9 (batem com o catálogo `gateway_medidor` do banco). **Ordem/nomes na convenção do A-966** (verificada
  em 400 buckets reais, 21/09/2026): REG3 (Q1) → `qhfi`, **REG4 (Q2) → `qhfc`**, **REG5 (Q3) → `qhri`**,
  REG6 (Q4) → `qhrc` — i/c = Q1&Q3 indutivo, Q2&Q4 capacitivo (relativo ao fluxo ativo); f/r = sinal de Q.
  O exemplo acima (frame Q2 → `phr:1532, qhfc:4`) é captura real e é o caso de teste de referência;
- `frame` = último bloco cru (`raw[9]` da struct — auditoria, já previsto na §1);
- `sts` = enlace ok/degradado; `cdo` = intervalo (min); `NSU` = sequência; `time` = epoch do fechamento.
- **Fechamento do bucket alinhado ao medidor:** publicar no `fimIntervaloDemanda` (o bloco de fechamento
  repetido 3×, §9) — melhor que o relógio interno do A-966, porque coincide com o intervalo de demanda
  faturado pela concessionária. Zero mudança de backend para o caminho de dados.

### 2.3 Pulso cru × Ke
Manter **pulso cru no payload** (spec §1 e A-966 fazem isso). Ke fica no **cadastro**: parâmetro do modelo no
catálogo (`iot_device_modelos.mapeamento.kd`) com override por nó no diagrama. Achado: o backend usa
**KD = 0,048 fixo** (`KD_A966_SSU`, comentário "quando houver mais de uma unidade com Kd diferente, ler do
cadastro") e o catálogo diz **`kd.default = 0.3`** — já está inconsistente. Com SSU em várias TONs isso
vira obrigatório: backend lê Ke por equipamento (e a TON publica `ke` como metadado no JSON, para conferência).

## 3. Onde a SSU entra nas 6 camadas da TON-V2

| Camada | O que muda |
|---|---|
| **Editor** (`iot-diagram.v2.js`) | Novo nó `medidor_ssu` ("Medidor Concessionária — SSU", `generates_firmware: false`, props: nome, modelo do catálogo, **Ke**, formato esperado (auto/normal/estendido), **instalação com geração** (s/n), intervalo reativo (min, default 60)). Regra nova: `medidor_ssu` ↔ **TON v2** (estilo de conexão `ssu`, porta SU+), **1 por TON**. Hoje a Regra 4 prende `medidor_comum` ao A-966 — o nó novo não mexe nisso (A-966 continua existindo onde já está). |
| **Gerador** (`iot-firmware-generator.ton-v2.js` + base) | Lib `ssu_nbr14522` incluída **só** quando há `medidor_ssu` ligado à TON; `ssu.cpp` gerado: UART0@IO48, callback de bloco, `processaRegistrador` nos 6 acumuladores, bucket 15 min alinhado ao medidor, payload §2.2, persistência (`ultimo[]`/`visto[]`/acumuladores em NVS — reboot no meio do intervalo não perde), alarmes (§4). Remove `s1` do `/inputs`. Regressão byte-idêntica dos diagramas **sem** SSU (harness existente). |
| **Catálogo** (banco) | Modelo novo no tipo `gateway_medidor` (id `44ac…`): "Landis+Gyr E750 A2E3 — SSU NBR 14522", `protocolo: 'ssu'` (valor novo; hoje: rtu/serial/tcp/tcp_usr), `mapeamento.kd` real, formato, notas de campo da §11. Pontos `phf/phr/qhf*/qhr*` + `sts` já existem no tipo. |
| **Backend** (`aupus-nexon-api`) | (a) `ensureDeviceEquipamentos` cria o equipamento do device só com `tipo_equipamento = comp.type` (string) → para o SSU precisa gravar **`tipo_equipamento_id` de categoria Gateway** (hoje só `tipo-ims-a966-001` tem essa categoria; criar "Medidor SSU — NBR 14522" na mesma categoria); (b) `salvarDadosGateway`: KD por equipamento (2.3); (c) tópico do device já sai derivado da TON (`<base>/<nome>_<addr>/data`) — o backend assina por igualdade exata, funciona. |
| **Frontend** | Painel do gateway (`a966-modal`, `useGatewayDashboard`) e ícone são roteados por **strings "A966"** em 5 lugares (`EquipmentIconFactory`, `dominioEquipamento`, `sinoptico-diagrama`, palette do sinóptico, demo). Trocar para **categoria "Gateway"** (refactor pequeno) — ou, no MVP, reusar o tipo A966 e só renomear o rótulo. |
| **Binários / OTA / bancada** | Só base V2 (`pio` env `ton`). Bancada: **2º ESP simulando frames a 110 baud** com os vetores da §10 (7 casos obrigatórios) antes de encostar no E750; depois E750 real com fonte de ângulo ajustável (tabela dos 4 quadrantes da spec). |

## 4. Alarmes e diagnóstico (o que o gerador faz com os estados da spec)
- **Enlace degradado** (30 erros consecutivos, §5) → `sts=0` no payload + evento em `logs_mqtt` (aba Alarmes).
- **Formato incoerente com o cadastro** (§5 "Coerência"): instalação marcada *com geração* recebendo bloco
  **normal** (sem quadrante) → alarme "solicitar saída estendida à concessionária"; o firmware **não infere**
  sentido de fluxo — publica só o que o bloco carrega.
- **Sanidade bit 5 × viradas** (§7): contador configurável (props `intervalo_reativo_min`), alarme se fugir.
- **Taxa de frames inválidos** (§6): publicada no `<base>/diagnostics` (já ingerido em `iot_dispositivos_online`).

## 5. Ajustes sugeridos na spec (pequenos)
1. **§1 struct** — expor também `erros_consecutivos` e contadores de frames válidos/inválidos na API da lib
   (a §6 manda *publicar* a taxa; quem publica é o gerador, então a lib precisa expor).
2. **§2 hardware** — registrar a lição da bancada: SU+ dividindo nó com uma OPTO cria caminho parasita
   (pull-up 5 V/470 Ω × 3V3/680 Ω) — no jig usa-se diodo Schottky; no campo o opto do medidor isola.
3. **§5 autodetecção** — além do auto, aceitar **formato esperado do cadastro** como *validação* (nunca como
   substituto da detecção): divergência vira alarme, não troca de parser.
4. **§9 acumuladores** — dizer explicitamente que `acumula(reg, delta)` é o **bucket de 15 min do gerador**,
   fechado no `fimIntervaloDemanda`, e que os 6 registradores mapeiam 1:1 em `phf, phr, qhfi, qhfc, qhri, qhrc`
   (REG1..REG6, convenção do A-966).
5. **§11 Ke** — Ke é dado de cadastro por medidor (catálogo + override no nó), não constante de firmware.
6. **§12 LoRa** — faixa já é configuração do E220 pré-configurado. O JSON aninhado do A-966 tem **~236 B**
   e NÃO cabe no MTU de 200 do E220: no satélite (`SSU_LORA_BIN=1`) o bucket sai em JSON plano e vira o
   frame binário `LORA_TYPE_SSU` (0x11, ≈90 B no ar); o gateway carimba a hora e republica plano; o backend
   lê `phf/phr/qh*` no topo ou em `data.{}` (COALESCE já existente). Gateway precisa ser regravado com a
   tabela nova.

## 6. Riscos e como tratar
- **6.1 110 baud no core Arduino/ESP32-S3:** divisor APB 80 MHz/110 ≈ 727 k — cabe nos registradores
  (clkdiv 12 bits × sclk_div 8 bits ≈ 1,05 M). **Validar no dia 1** com o simulador de frames; fixar fonte
  APB e desligar power management (spec §3). Plano B: RX por interrupção de GPIO.
- **6.2 Bloco normal em usina com geração:** energia injetada somada ao consumo com checksum válido — só
  alarme (item 4), nunca inferência.
- **6.3 Ke errado = energia faturada errada:** bancada com potência conhecida (spec §11) antes do campo.
- **6.4 Reboot no meio do intervalo:** NVS dos registradores/acumuladores (item da camada gerador).
- **6.5 Dois `s1`:** quem já usa SU+ como contato seco não pode ligar SSU na mesma TON — o editor bloqueia.

## 7. Fases propostas
| Fase | Entrega | Critério |
|---|---|---|
| F0 | Lib `ssu_nbr14522` (C++ puro) + testes no host | 7 casos da §10 passando; 4 vetores decodificam |
| F1 | Editor: nó `medidor_ssu`, regra TON v2 ↔ SSU (1 por TON), props | diagrama salva/carrega; V1 intocada |
| F2 | Gerador V2: UART0@IO48, bucket, payload A-966, NVS, alarmes, remove `s1` | regressão byte-idêntica sem SSU; `pio` compila com SSU |
| F3 | Catálogo (modelo E750, `protocolo ssu`) + backend (tipo Gateway p/ SSU, KD por equipamento) | dashboard/COA/demanda iguais ao A-966 |
| F4 | Bancada: 2º ESP simulador 110 baud + E750 com fonte de ângulo | 4 quadrantes, wrap, fechamento 3×, bloco corrompido |
| F5 | Campo: UFV Aupus II com A-966 e TON-V2 em paralelo por 1 semana | pulsos idênticos bucket a bucket |

Referências de código: `public/iot-firmware-base.ton-v2.js` (pinos 84-89, SU+ 113-160, build_flags 48-52),
`public/iot-firmware-generator.ton-v2.js` (LoRa `Serial2` ~3076, RS485 `HardwareSerial(RS485_UART_NUM)` ~4330),
`public/iot-diagram.v2.js` (regras 3/4 ~1824-1838, `medidor_comum` 395, `meter_gateway` 273),
`aupus-nexon-api/src/shared/mqtt/mqtt.service.ts` (`salvarDadosGateway` 1837, categoria Gateway 1477),
`src/modules/iot/iot.service.ts` (`ensureDeviceEquipamentos` ~1160-1276).

## 8. O que precisamos para implementar e depois testar

### 8.1 Insumos
- Norma **NBR 14522:2008** com licença própria (conferir mapas de bits das §7/§8 na fonte).
- **Placa TON-V2** com SU+ (X14, R47 680 Ω, TVS) — a da bancada serve.
- **2º ESP32** (devkit) como **simulador de SSU a 110 baud** (coletor aberto / resistor série no IO48) — cobre ~90 % dos testes sem medidor.
- **E750 A2E3 com SSU liberada** + **fonte com ângulo de fase ajustável** (4 quadrantes). Plano B: campo (UFV Aupus II tem E750 + A-966).
- Da concessionária (§11 da spec): formato liberado, **Ke**, constante parametrizável?, intervalo reativo real.
- Gabarito: histórico MQTT do A-966 (`…/A966/SSU/state`, já no banco).

### 8.2 Implementação (ordem = dependência)
| Fase | Entrega | Dono sugerido | Esforço |
|---|---|---|---|
| F0 | Lib `ssu_nbr14522` (C++ puro) + testes no host (vetores §10) | autor da spec | 1–2 d |
| F1 | Editor: nó `medidor_ssu`, regra TON v2 ↔ SSU (1/TON), props Ke/formato/geração/intervalo reativo | NexON | ½ d |
| F2 | Gerador V2: lib só com SSU; UART0@IO48 (`s1` sai); bucket 15 min no `fimIntervaloDemanda`; payload = A-966; NVS; alarmes; regressão byte-idêntica sem SSU | NexON | 2–3 d |
| F3 | Catálogo (modelo E750, `protocolo ssu`, Ke) + backend (device SSU na categoria Gateway; Ke por equipamento) + front (painel por categoria) | NexON | 1–2 d |
| F4 | Bancada: sketch simulador + modo `ssu` no TON-TESTE-V2 + POP | NexON + bancada | 1–2 d |
| F5 | Campo: TON-V2 em paralelo com A-966 | operação | 1 semana |

### 8.3 Testes e critérios de aceite (cada nível bloqueia o seguinte)
1. **Unitário (host):** 7 casos obrigatórios + 4 vetores da §10 — 100 %; "bloco normal no parser estendido" rejeitado.
2. **Bancada A (simulador):** 110 baud real na UART0 (bit de 9,09 ms medido); normal/estendido; Q1→Q3 sem pico; Q1→Q4 mantém REG1; fechamento 3× = 1 evento; wrap 65 500→40 = 76; CRC com 1 bit errado rejeitado; blocos fundidos sob carga (SD + Modbus TCP + LoRa). Aceite: 0 frame inválido com simulador limpo, nenhum delta fantasma, payload por bucket no MQTT.
3. **Bancada B (E750 + fonte):** −25°/+25°/155°/205° (Q1/Q4/Q2/Q3), fronteira FP 0,92, Ke por potência × tempo, virada 899→0. Aceite: quadrante = mostrador do E750; energia do bucket = P × 0,25 h ± 1 pulso.
4. **Integração NexON:** equipamento auto-criado na categoria Gateway; dashboard/COA/demanda iguais ao A-966; alarmes; reboot no meio do intervalo (NVS); buffer SD offline; OTA; SSU via LoRa satélite (MTU 200) em TON2v2/4v2.
5. **Campo:** A-966 e TON-V2 no mesmo medidor por 1 semana — 100 % dos buckets e phf/phr iguais bucket a bucket (± 1 pulso); só então desligar o A-966.

Risco a matar no 1º dia de bancada: 110 baud no core Arduino (teste 2).

## 9. Estado da implementação (2026-09-17) e como testar

| Fase | Estado | Onde |
|---|---|---|
| F0 lib `ssu_nbr14522` + testes no host | **feita** — 48/48 (4 vetores da spec + 7 casos obrigatórios + autodetecção/degradação/gap) | `AupusNexOn/firmware-libs/ssu_nbr14522/` (`ssu_nbr14522.h/.cpp`, `test_ssu.cpp`; `g++ … && ./test_ssu`) |
| F1 editor | **feita** — nó `medidor_ssu` ("Medidor Concessionária (SSU)", props Ke/formato/geração/intervalo reativo), estilo de conexão `ssu`, Regra 4b (só TON v2, 1 por TON), categoria Dispositivos, TSX (associação/DJ) | `public/iot-diagram.v2.js`, `src/features/supervisorio/components/iot-diagram.tsx` (`IOT_SCRIPTS_VERSION=20260917-ssu-nbr14522`) |
| F2 gerador V2 | **feita** — `spec.ssu` (`_processSsu`), lib embutida byte-idêntica (smoke confere), `ssu.h/ssu.cpp` (UART0@IO48 110 baud, `setRxTimeout`+`onReceive`, fila FreeRTOS, acumuladores por registrador, bucket no `fimIntervaloDemanda`, JSON do A-966, NVS, alarmes), `config.h` `SSU_*`, `s1` sai do `/inputs`, `diagnostics` com `ssu_*`. Smoke 100 %; **V1 byte-idêntico 16/16**; compilação real `pio` SUCCESS (`ton1v2-ssu-mqtt`, `ton4v2-ssu-satellite` via LoRa) | `public/iot-firmware-generator.ton-v2.js`, `scripts/smoke-firmware-ton-v2.mjs` (casos D/E + `--compile`) |
| F3 catálogo + backend | **feita (backend)**; catálogo = SQL pronto | `docs/sql/2026-09-17_catalogo_ssu_e750.sql` (modelo E750, `protocolo 'ssu'`); `iot.service.ts` (`ensureDeviceEquipamentos`: `medidor_ssu` sempre vira equipamento, `tipo_equipamento_id` da categoria **Gateway**; SCS família `gateway_medidor`); `mqtt.service.ts` e `gateway-dashboard.service.ts`: **Ke por equipamento** (`ke` do envelope; A-966 cai no 0,048) |
| F4 bancada | simulador pronto; **placa pendente** | `firmware-libs/ssu_nbr14522/simulador_ssu/simulador_ssu.ino` (2º ESP32: 110 baud no GPIO 17, comandos `n/e/q1..q4/w/c/f/x`) |
| F5 campo | pendente | UFV Aupus II em paralelo com o A-966 |

### 9.1 Roteiro de bancada (F4)
1. Grave o simulador num ESP32 comum; ligue **TX (GPIO 17) → resistor 1 kΩ → X14-2 (SU+)** da TON-V2 e **GND comum**. (Saída real do medidor é coletor aberto; com o resistor série o repouso em nível 1 é o mesmo.)
2. No NexON: aba IoT → adicione **Medidor Concessionária (SSU)** ligado a uma **TON v2** (estilo SSU), Ke `0.048`, formato *Autodetectar*, "instalação com geração" ligado → Salvar → Gerar firmware → gravar/OTA.
3. Monitor serial da TON: `[OK] SSU "…" em SU+/IO48 (UART0 @ 110 baud)`; após ~10 s (10 blocos coerentes) o formato trava; `[SSU] bucket publicado: phf=… phr=…` a cada fechamento (com `x` no simulador o intervalo é 15 min; use `f` pra fechar já).
4. Casos: `n` (bloco normal → alarme "incoerente com o cadastro" pois geração=sim), `q1`→`q3` (sem pico), `w` (wrap 65 500→…), `c` (bloco corrompido → `ssu_err` sobe, nada acumula), 3 fechamentos idênticos → 1 bucket.
5. NexON: o equipamento aparece auto-criado (categoria Gateway) com o mesmo dashboard do A-966; `…/diagnostics` traz `ssu_ok/ssu_err/ssu_fmt/ssu_degradado`.
6. Risco a fechar no 1º dia: **110 baud real** — medir 9,09 ms/bit no RX (osciloscópio/analisador lógico) ou conferir que o formato trava (se não travar com o simulador limpo, o clock da UART não fechou → plano B: RX por interrupção de GPIO).

### 9.2 Pendências conhecidas
- Painel/ícone do gateway no front ainda roteiam por strings "A966" (o SSU usa o tipo A966 → funciona; refactor por categoria fica pra depois).
- `s1` (contato seco na SU+) e SSU são mutuamente exclusivos na mesma TON — o editor bloqueia via Regra 4b; documentar no cadastro.
- Ke: confirmar valor real do E750 (§11 da spec) antes de faturar; hoje padrão 0,048 (catálogo e backend alinhados).


## 12. Revisão 2026-09-21 (coerência com o guia v1.3 e o hardware v1.2)

Aplicado no código (lib 55/55 no host; smoke V2 49/49; compile 6/6 incl. `ton1v2-ssu-mqtt` e
`ton4v2-ssu-satellite`; regressão V1 16/16 byte-idêntica; fw-regress 17 projetos sem diferença):
- `_genSsuCpp`: `setRxTimeout(1)` (era 4 = 364 ms a 110 baud, nunca fechava o bloco); UART0 pelo objeto
  `Serial0` do core (uma instância); `_publicar` com `qhfc=REG4, qhri=REG5, qhrc=REG6` (convenção do A-966);
  variante de payload PLANO quando satélite LoRa (`SSU_LORA_BIN`).
- lib `ssu_nbr14522`: delta modular com máscara 0x7FFF no formato normal (15 bits); reinício de intervalo marca
  todos os registradores como vistos (Q1→Q3 no meio do intervalo conta desde 0). Testes 2b e 8 novos.
- LoRa: field-set `LORA_FIELDS_SSU_V1` / `LORA_TYPE_SSU` na tabela compartilhada (gateway e satélite) + caso de
  subtopic no satélite.
- Simulador: ligação TX direto no SU+ (sem 1 kΩ em série — com o pull-up de 680 Ω o nível baixo ficaria em 1,96 V).
Docs: `docs/SSU-TON-V2-Guia-v1.3.pdf`, `docs/TON-V2-Hardware-SSU-v1.2.pdf`, `docs/REVISAO-SSU-GUIA-v1.2-HW-v1.1.md`.
Pendente de bancada: 110 baud real (bit 9,09 ms), V_OL do opto do E750, virada 899→0, bit 5, bucket via LoRa.
