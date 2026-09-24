# Revisão de coerência — `SSU-TON-V2-Guia-v1.2.pdf` e `TON-V2-Hardware-SSU-v1.1.pdf`

> **STATUS 2026-09-21 — APLICADO.** Versões corrigidas: `SSU-TON-V2-Guia-v1.3.pdf` e `TON-V2-Hardware-SSU-v1.2.pdf`
> (mesma pasta; as v1.2/v1.1 ficam como histórico). Código: lib (máscara 15 bits, `_visto` no reinício; testes 55/55),
> `_genSsuCpp` (`setRxTimeout(1)`, `Serial0`, `qhfc/qhri/qhrc` por REG4/5/6, payload plano em satélite), field-set
> LoRa `LORA_TYPE_SSU`, simulador sem resistor em série, smoke 49/49, compile 6/6, regressão V1 16/16. §4 abaixo = feito.

> Revisado em 2026-09-21 contra: lib `AupusNexOn/firmware-libs/ssu_nbr14522/` (+ `test_ssu.cpp`), glue gerada
> `_genSsuCpp` (`public/iot-firmware-generator.ton-v2.js`), esquemático `SCH-TON-v1b.pdf` (recortes X14, LoRa,
> MAX485, W5500, PCA9685, IO14), backend `mqtt.service.ts` (`salvarDadosGateway`) e **400 buckets reais do
> A-966** em `equipamentos_dados` (UFV, 17/09/2026). Vetores de teste recalculados (CRC-16/LRC) em Python.
> Legenda: 🔴 erro que muda resultado · 🟠 erro/omissão relevante · ✅ conferido.

## 1. O achado que muda o projeto: nomes dos registradores reativos (guia §"Quadrantes", Teste 9, pendência 4)

O guia (e a nossa lib) mapeiam **Q2→qhri, Q3→qhrc, Q4→qhfc** e tratam o exemplo do doc de integração
(`frame 00 90 a2 …` com `qhfc:4`) como "inconsistente", pedindo que o `ssu.cpp` publique `qhri=4`.
**Esse exemplo é uma captura REAL do A-966** — e o A-966 é a referência que o backend consome. Cruzando 400
buckets reais com o quadrante decodificado do `frame` (tabela `{1,4,2,3}`) e igualando o contador do último
bloco às colunas do bucket:

| Quadrante (bits 5-4) | Ativa cai em | Reativa cai em (acertos exatos) |
|---|---|---|
| Q2 (`10`) | `phr` (65×) | **`qhfc`** (57×) — não `qhri` (8 casos de outro registrador no mesmo bucket) |
| Q3 (`11`) | `phr` (143×) | **`qhri`** (132×) |
| Q4 (`01`) | `phf` (7×) | **`qhrc`** (158×) |
| Q1 (`00`) | — (não ocorre numa UFV) | por simetria **`qhfi`** |

Conclusões:
- A tabela de quadrante `{1,4,2,3}` está **confirmada** por dado real (o "bits+1" cairia em `phf` no Q3 e não cai).
- 🔴 A convenção de nomes do A-966 é **f/r pelo sinal de Q** e **i/c = Q1&Q3 indutivo, Q2&Q4 capacitivo**
  (relativo ao fluxo ativo — o mesmo que ANEEL usa para geração). O backend segue isso literalmente
  (`mqtt.service.ts:1913-1916`: indutivo = `qhfi+qhri`, capacitivo = `qhfc+qhrc`). Com o mapeamento do guia,
  uma UFV exportando em Q2 apareceria no NexON como **indutiva** em vez de capacitiva.
- 🔴 O **Teste 9 e a pendência 4 do guia estão invertidos**: o correto para `00 90 a2 fc 05 04 00 c6 18` é
  `phr=1532, qhfc=4` — exatamente o que o A-966 publicou. Corrigir no guia: tabela "Quadrantes e
  registradores" (Q2 = exporta·**capacitivo** → `phr·qhfc`; Q3 = exporta·**indutivo** → `phr·qhri`;
  Q4 = importa·capacitivo → `phf·qhrc`), o parágrafo "Exemplo inconsistente" (o exemplo está certo) e o
  diagrama de quadrantes. Nos registradores NBR (REG3..REG6 = reativa Q1..Q4) nada muda — só o nome JSON.
- Na nossa lib/glue: `_publicar` deve imprimir `qhfc=_acum[4]` (REG4/Q2), `qhri=_acum[5]` (REG5/Q3),
  `qhrc=_acum[6]` (REG6/Q4); `test_ssu.cpp` e a §2.2 do doc de integração acompanham.

## 2. Guia v1.2 — demais pontos

| Item | Veredito | Detalhe |
|---|---|---|
| Camada física (110 baud, 8N1, 8×11 bits ≈ 800 ms / 9×10 ≈ 818 ms, silêncio 182–200 ms, bit 9,09 ms) | ✅ | |
| **RX-timeout em símbolos; `setRxTimeout(1)`; com 4 (≈364 ms) o bloco nunca fecha** | ✅ 🔴 **bug real no nosso código** | `_genSsuCpp` usa `setRxTimeout(4)` com comentário "~36 ms" (conta errada: 4 símbolos × 10 bits × 9,09 ms = 364 ms). Com `onReceive(cb, true)` o callback só dispara no timeout ⇒ com gaps de 182–200 ms **nunca dispara**. Pendência 1 procede. |
| Formatos normal/estendido, bits do octeto 2/3, máscara 0x7F, LRC `~XOR`, CRC-16 0xA001 init 0 lo-first | ✅ | Bate com `decodificarNormal/Estendido`. |
| Exemplo `3E 80 81 C0 2B 8E 12 55 B8` e os 5 vetores (LRC 0x13/0xF0, CRC B855/6398/18C6, segundos, contadores, posto) | ✅ | Recalculados: todos batem. |
| Regra "Troca de quadrante: Δ contra o último valor do REG2 (0 se o intervalo foi visto desde o início); baseline só se não visto desde o boot" + `reinicioIntervalo()` marcando `visto=true` | ✅ 🟠 **a lib não faz isso** | `_registrar` zera `_ultimo[]` no reinício mas não seta `_visto[]` ⇒ registrador visto pela 1ª vez após o reinício vira baseline e **perde os pulsos** (o caso 2 do `test_ssu.cpp` hoje ASSERTA a perda: "baseline do REG2"). Pendência 2 procede. |
| Wrap 15 bits no normal (32 700→40 = 108) | ✅ 🔴 **bug real** | Lib usa `(uint16_t)(atual − ultimo)` nos dois formatos ⇒ no normal daria 32 836. Pendência 3 procede. |
| Fechamento 3× = 1 evento; bits 4/5 por transição | ✅ | Lib compara seg+PA+PR idênticos; toggles por mudança. |
| "30 blocos inválidos → `sts=0` e volta à autodetecção" | ✅ | `ERROS_PARA_DEGRADAR`, `_erro()` reseta formato; `sts` = 0 se degradado/alarme de formato. |
| NVS a cada publicação e 60 s | ✅ | `SSU_NVS_SAVE_MS 60000`, `_salvarNvs()` em `_publicar`. |
| Diagnóstico `ssu_ok/ssu_err/ssu_fmt` | ✅ (parcial) | Também saem `ssu_degradado`, `ssu_intervalos`. |
| Nó "Medidor Concessionária (SSU)", IO48 sai do `/inputs`, `ssu.cpp` gerado, lib em `firmware-libs/` | ✅ | |
| `HardwareSerial ssu(0)` "ou `Serial0` — não usar os dois" (pendência 5) | 🟠 cosmético | Com `ARDUINO_USB_CDC_ON_BOOT=1` o core instancia `Serial0(0)`; nosso `_ssu(0)` é 2ª instância, mas só ela chama `begin()` — funciona. Trocar por `Serial0` evita a dupla. |
| **LoRa (TON4v2): "bucket ≈ 120 B pelo mesmo caminho"** | 🔴 errado | O payload real tem **~236 B** (JSON A-966 + `frame` + `ke/fmt/q/seg/posto/ssu_err`). MTU do E220 = 200 B e `_lora_safe_send` **descarta** acima disso ⇒ em satélite o bucket some. Precisa payload compacto/binário no caminho LoRa (ou o guia deixa claro que SSU exige TON com internet). |
| Payload/contas (Ke 0,048 default; 1 532 × 0,048 = 73,5 kWh → 294 kW) | ✅ | Só os nomes `qhfc/qhri` do exemplo estão certos e o texto ao redor errado (ver §1). |
| Bancada: ângulos dos 4 quadrantes (φ = ∠V − ∠I; Q1 +25°, Q4 −25°, Q2 +155°, Q3 −155°), FP 0,92 = 23,07°, Ke de bancada (66,4 V × 5 A × 3 ≈ 996 W → 0,249 kWh/15 min) | ✅ | Bornes do E750 (1,2,3/5; 8,9,10→15,14,13) não verificáveis aqui — manter "conferir na tampa". Depois da correção do §1, os rótulos i/c da tabela de alvos passam a ser: Q2 capacitivo, Q3 indutivo (a SSU esperada REG2+REG4 / REG2+REG5 não muda). |
| Pendência 6 (spec com `Serial2`, "bits+1 erra 2 de 4", ângulos 155/205) | ✅ | Correto: UART0 decidida; "bits+1" acerta só Q1 (erra 3 de 4). |

## 3. Hardware v1.1 — conferido no esquemático v1b

| Item | Veredito | Detalhe |
|---|---|---|
| X14-2 = SU+, X14-1 = GND; R47 680 Ω → +3V3; D4 LESD5D5.0CT1G; IO48 = pino 25 do WROOM | ✅ | Recorte do esquemático confere. |
| Números (4,9 mA; VIL 0,825 V; VIH 2,5 V; 1,6 µs/10 m; 16 mW) | ✅ | |
| **Checklist passo 3: "simulador TX → 1 kΩ → SU+"** | 🔴 | Com o pull-up de 680 Ω, o nível baixo no IO48 fica 3,3 × 1000/1680 ≈ **1,96 V > VIL** — o ESP nunca lê 0. Ligar o TX **direto** (push-pull 3,3 V drena os 4,9 mA sem problema) ou ≤ 100 Ω; ou NPN em coletor aberto. O mesmo erro está no cabeçalho do nosso `simulador_ssu.ino`. |
| Pendência 1 (série ~1 kΩ **no IO48**, depois do pull-up) | ✅ | Aí não forma divisor — ok. |
| Pendência 2 (reset do W5500) | ✅ e dá pra fechar | Esquemático: IO14 está no net **`RESET`**; NRESET do módulo W5500 está no net **`RESET2`** — nets diferentes ⇒ **não ligados**. O firmware toggla IO14 à toa; o módulo se vira com o POR próprio (bancada validou). |
| Pendência 3 (MAX485 em +5 V, RO ≈ 5 V no IO17) | ✅ real | VCC do MAX485CSA++ vai a +5V no esquemático; pin RO (rotulado "RX") → net TX1 = IO17. Ressalva de longo prazo procede (funciona hoje). |
| Pendência 4 (IO47/IO48 no domínio VDD_SPI; N8R2 = 3,3 V) | ✅ | Correto e importante para a BOM. |
| Pendência 5 (EXTCLK do PCA9685 no net CLK25MH sem outra ponta) | ✅ | Net só aparece no pino 25 do PCA. Firmware usa oscilador interno (validado). |
| **Pendência 6 (4–20 mA: 165 Ω satura o ADC; shunt 130 Ω)** e mapa "IO39/IO40 AN_C2/AN_C1 4–20 mA" | 🔴 omissão | **IO39/IO40 não têm ADC no ESP32-S3** (ADC1 = GPIO1-10, ADC2 = 11-20; confirmado em bancada: `Pin 40 is not ADC pin!`). Não é questão de saturação — o canal é inoperante nesta revisão. O doc precisa dizer isso e apontar o fix (trocar com IO3/IO9 do RTC ou ADS1115). |
| **Pendência 7 ("LoRa M0/M1 sem ligação")** | 🔴 | M0 e M1 estão **em GND** no esquemático v1b (recorte confere) — modo normal fixo; por isso `lora config/pair` não funcionam na V2 e o E220 vem pré-configurado. |
| Mapa: IO15 = ESP TX / IO16 = ESP RX (LoRa); IO18 = ESP TX / IO17 = ESP RX (RS485); "as nets têm o nome do pino do periférico" | ✅ | Confere com o esquemático (net RX2 → RXD do E220; net RX1 → DI do MAX485). Nota interna: os `#define UART2_TX 16 / UART2_RX 15` do gerador são pela ótica do MÓDULO e o `begin(baud, cfg, UART2_TX, UART2_RX)` = `begin(rx=16, tx=15)` — eletricamente igual ao doc. |
| MCP23008 0x26 | ✅ | v1b: MUX1 A0 = GND, A1 = A2 = +3V3 ⇒ 0x26 (a nota antiga "esquemático dizia 0x20" era da v1a). |
| Pendência 8 (IO46 strap sem carga) | ✅ | |

## 4. O que fazer (ordem sugerida)

1. **Guia:** corrigir §1 (nomes reativos, Teste 9, pendência 4, diagrama e rótulos i/c da bancada); trocar
   "≈120 B" por "~236 B — não cabe no LoRa; SSU exige TON com internet até existir frame compacto";
   checklist do simulador sem 1 kΩ em série.
2. **Hardware doc:** AN_C sem ADC (não "satura"); M0/M1 em GND; fechar pendência 2 (nets `RESET` ≠ `RESET2`).
3. **Nosso código (após o OK):** `setRxTimeout(1)`; `_publicar` com `qhfc=REG4, qhri=REG5, qhrc=REG6`;
   máscara 0x7FFF no delta do formato normal; `_visto[]=true` no reinício do intervalo; caso 2 e vetor Q2 do
   `test_ssu.cpp` ajustados; `simulador_ssu.ino` sem resistor série; decidir o caminho LoRa (frame binário
   `$B$` ou bloquear SSU em satélite no editor). Re-rodar smoke + compile + regressão V1.
