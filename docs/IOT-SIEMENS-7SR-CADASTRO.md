# Cadastro Siemens 7SR (7SR10 Reyrolle + 7SR5) no Catálogo IoT

> **Status:** ✅ IMPLEMENTADO no catálogo (`.v2.js`) + gerador. ⏳ Pendente: seed no DB de produção + validação de bancada.
> **Escopo aprovado:** ambos os modelos (7SR10 + 7SR5), completo (medições + proteções + comandos trip/close).
> **Decisões tomadas (§7):** 7SR5 funciona igual ao 7SR10 (RTU/RS485) · 7SR5 espelha o mapa do 7SR10 (1 cadastro serve os dois) · modelagem NexOn canônica (`rele_protecao`).
> **Data:** 2026-07-03
> **Manuais:** `/var/www/iot_nexon/mapa_modbus/SIEMENS/`
> - `C53000-L7040-C002-7_en_Communication_Protocol_Manual_7SR10.pdf` (Reyrolle 7SR10, Ed. 11.2025, 94 pág)
> - `7SR5_Communication_Protocol_Manual_V2.40.pdf` (7SR5, V2.40, 226 pág)

---

## Sumário

1. [Objetivo e conclusão principal](#1-objetivo-e-conclusão-principal)
2. [A família Siemens 7SR e os dois relés](#2-a-família-siemens-7sr-e-os-dois-relés)
3. [Formatos de dados Siemens ↔ NexOn (a chave técnica)](#3-formatos-de-dados-siemens--nexon-a-chave-técnica)
4. [Convenção de endereçamento Modbus](#4-convenção-de-endereçamento-modbus)
5. [7SR10 — mapa completo e mapeamento proposto](#5-7sr10--mapa-completo-e-mapeamento-proposto)
6. [7SR5 — mapa completo e mapeamento proposto](#6-7sr5--mapa-completo-e-mapeamento-proposto)
7. [Decisões pendentes (precisam da sua confirmação)](#7-decisões-pendentes)
8. [Passo a passo da implementação](#8-passo-a-passo-da-implementação)
9. [Procedimento de teste em bancada](#9-procedimento-de-teste-em-bancada)
10. [Riscos e armadilhas conhecidas](#10-riscos-e-armadilhas-conhecidas)

---

## 1. Objetivo e conclusão principal

Adicionar comunicação Modbus com os relés de proteção **Siemens 7SR10 (Reyrolle)** e **7SR5**, permitindo que a TON leia medições (V, I, P, Q, freq, PF, energia), status de proteção (funções ANSI 27/59/50/51/81/46/49…) e envie comandos (trip/close/reset) — tudo publicado via MQTT no NexOn.

**Conclusão principal — a boa notícia:**

> **O gerador de firmware NexOn já suporta 100% do que os relés Siemens precisam. Não é necessário modificar o gerador (`iot-firmware-generator.v2.js`). É apenas cadastro de catálogo**, exatamente como fizemos com o Schneider P3U30 e os WEG SIW.

Os dois formatos de dado que o Siemens usa mapeiam diretamente para tipos que o gerador já decodifica:

| Formato Siemens | Equivalente NexOn | Já suportado? |
|---|---|---|
| `FP_32BITS_3DP` (inteiro 32-bit fixed-point, 3 casas, 2's complement) | `dataType: 'S32'` + `scale: 1000` + `word_order: 'high_first'` | ✅ |
| `FLOAT_IEEE_754` (float padrão 32-bit) | `dataType: 'FLOAT'` + `word_order: 'high_first'` | ✅ |
| `UINT16` | `dataType: 'U16'` | ✅ |
| `UINT32` | `dataType: 'U32'` + `word_order: 'high_first'` | ✅ |
| Coils/Inputs (status + comando binário) | `bi_map` / `bo_map` (func 0x01/0x02/0x05) | ✅ |

---

## 2. A família Siemens 7SR e os dois relés

Ambos os relés pertencem à mesma família de protocolo Siemens. **A estrutura Modbus é essencialmente idêntica** — muda só a lista de endereços e a interface física disponível.

| Aspecto | 7SR10 (Reyrolle) | 7SR5 |
|---|---|---|
| Protocolos disponíveis | Modbus **RTU** (RS485 / USB) | Modbus **RTU (RS485) + TCP (Ethernet)** |
| Também suporta | DNP3, IEC 60870-5-103 | IEC 61850, DNP3 (serial/TCP), IEC 60870-5-103 |
| Medições | Input Registers, func `0x04`, addr **30001+** | Idem |
| Status binário / proteções | Inputs, func `0x02`, addr **10001+** | Idem |
| Comandos binários | Coils, func `0x01`/`0x05`, addr **00001+** | Idem |
| Setpoints / hora | Holding Registers, func `0x03`/`0x06`, addr **40001+** | Idem |
| Endereço de estação | 1–247 | 1–247 |
| Baud RTU | 75…38400, default **19200** | 75…230400, default **38400** |
| Mapa Modbus | **Fixo/documentado** (default de fábrica, §5) | **Configurável por dispositivo** (Reydisp Manager 2, §6.1) |
| Formatos de dado | `FP_32BITS_3DP`, `FLOAT_IEEE_754`, `UINT16/32` | Idênticos |

**Implicação prática:** como o 7SR5 tem Ethernet, ele pode ser lido por **Modbus TCP** (caminho `tcp` do gerador, igual aos inversores/medidores TCP) OU por **RTU** (RS485). O 7SR10 é só RTU. Isso é uma decisão de conexão (ver §7).

---

## 3. Formatos de dados Siemens ↔ NexOn (a chave técnica)

### 3.1 `FP_32BITS_3DP` — o formato principal

Do manual (§3.2.2 do 7SR10):

> *"O FP_32BITS_3DP é um número inteiro fixed-point de 32 bits contendo 3 casas decimais. É usado para enviar um valor real com 3 casas decimais como inteiro. Por exemplo, se o valor no dispositivo é 123.456, ele é enviado como 123456. Como é inteiro, números negativos são enviados em complemento de 2. Armazenado em dois registradores de 16 bits em formato Big-Endian."*

Exemplo do manual: `123456` (=`0x1E240`) fica:

| Registrador | Valor |
|---|---|
| 30001 (high word) | `0x0001` |
| 30002 (low word)  | `0xE240` |

→ No NexOn: **`dataType: 'S32'`, `scale: 1000`, `word_order: 'high_first'`**.
`valor_real = int32_signed / 1000`. Ex.: `220.500 V` → registrador `220500` → `220.5`.

### 3.2 `FLOAT_IEEE_754`

Float IEEE 754 padrão de 32 bits em 2 registradores, big-endian (high word primeiro).
→ **`dataType: 'FLOAT'`, `word_order: 'high_first'`**.

### 3.3 A coluna "Mult" dos manuais — definição confirmada

O manual do 7SR5 explica a coluna **Mult** (Multiplier) verbatim, no editor de comunicação (Reydisp Manager 2):

> *"Multiplier — especifica o valor pelo qual um ponto é **multiplicado antes de ser transmitido**. Ex.: um valor real 1.234 convertido para inteiro de 16 bits seria 1; então pode ser primeiro multiplicado por 1000, dando 1234, que é o que fica armazenado."*

Ou seja: **transmitido = valor_real × Mult** → decode no mestre: **valor_real = raw / Mult**.

O ponto-chave: o `÷1000` do `FP_32BITS_3DP` está **embutido no próprio formato** (`12.345 → 12345`), **não** na coluna Mult. No mapa de exemplo do 7SR5, todo ponto `FP_32BITS_3DP` vem com **Mult = 1** (identidade) → `valor = int32 / 1000`. Regra segura de catálogo:

```
valor_real = decode(raw, formato) / (Mult == 0 ? 1 : Mult)
```
onde `decode()` já aplica o `÷1000` do FP_32BITS_3DP. (`Mult = 0` aparece só em EVENTCOUNT/EVENT/TIME_METER → significa "não aplicável", nunca "multiplicar por zero".)

**⚠️ A exceção — potências/energia do 7SR10.** No mapa fixo do 7SR10, os pontos de **potência** vêm com `FP_32BITS_3DP` **e** `Mult = 0.000001` (e alguns máximos com `1e-5`) — o único caso de Mult ≠ 1 num FP_32BITS_3DP. Aqui há ambiguidade não resolvida pelo manual: o Mult **cascateia** sobre o `÷1000` do formato (`valor = raw/1000/Mult`) ou o **substitui**? Para V / I / frequência / PF (Mult = 1.0) a escala `S32 / 1000` é de **alta confiança**. Para **potências/energia do 7SR10** a escala **DEVE ser validada em bancada** comparando com o display do relé (§9). No 7SR5, como o vendor sempre usa Mult = 1, o problema não aparece no mapa default.

---

## 4. Convenção de endereçamento Modbus

Os relés usam **notação Modicon** (o prefixo do endereço indica o tipo de objeto). O endereço no frame Modbus (PDU) = endereço Modicon − base do tipo:

| Tipo Modicon | Prefixo | Função Modbus | Base | Frame PDU |
|---|---|---|---|---|
| Coils (comandos R/W) | `0xxxx` | `0x01` ler / `0x05` escrever | 1 | `Modicon − 1` |
| Inputs (status R/O) | `1xxxx` | `0x02` ler | 10001 | `Modicon − 10001` |
| Input Registers (medições R/O) | `3xxxx` | `0x04` ler | 30001 | `Modicon − 30001` |
| Holding Registers (setpoints R/W) | `4xxxx` | `0x03` ler / `0x06`/`0x10` escrever | 40001 | `Modicon − 40001` |

Ex.: `Va Primary` está no Modicon `30016` → frame PDU `15` (func `0x04`).
Ex.: `Cmd Trip` está no Modicon `00227` → frame PDU `226` (func `0x05`).

**Regra confirmada pelo manual do 7SR5 (§6.1, verbatim):** o número de registrador é `<dígito-de-espaço><4 dígitos 0001-9999>`; o dígito de espaço só seleciona o tipo (via função Modbus), e o endereço no frame = **(4 dígitos) − 1**. Exemplos do próprio manual: coil `01075` → `1075−1 = 0x0432`; input `10027` → `27−1 = 0x001A`; `30001 → 0x0000`; `40001 → 0x0000`. É a convenção Modbus 1-based padrão.

Portanto `Va` em `30016` → `0016 − 1 = 15` (idêntico a `Modicon − 30001`). No catálogo, `ai_blocks[].start` e os offsets de coil usam o **frame PDU** (não o Modicon), seguindo o padrão do P3U30.

---

## 5. 7SR10 — mapa completo e mapeamento proposto

> **Nota:** os endereços abaixo são o **mapa default documentado** do 7SR10 (§3.3 do manual). O manual avisa que ele *"mostra a configuração default; você pode modificá-la usando a Communications Configuration Editor"*. **Confirmar que o relé em campo está no mapa default** (não foi remapeado) antes de confiar nesses endereços.

### 5.1 Medições (Input Registers, func `0x04`, `S32`/`scale 1000`/`high_first`)

Endereços Modicon reais extraídos do §3.3.3 do manual. Frame PDU = Modicon − 30001.

| pid NexOn | Grandeza | Modicon | Frame PDU | Formato | Escala | Obs |
|---|---|---|---|---|---|---|
| `va` | Va Primary | 30016 | 15 | FP_32BITS_3DP | /1000 | V (primário) |
| `vb` | Vb Primary | 30018 | 17 | FP_32BITS_3DP | /1000 | V |
| `vc` | Vc Primary | 30020 | 19 | FP_32BITS_3DP | /1000 | V |
| `ia` | Ia Primary | 30064 | 63 | FP_32BITS_3DP | /1000 | A |
| `ib` | Ib Primary | 30066 | 65 | FP_32BITS_3DP | /1000 | A |
| `ic` | Ic Primary | 30068 | 67 | FP_32BITS_3DP | /1000 | A |
| `in` | In Primary | 30088 | 87 | FP_32BITS_3DP | /1000 | A (neutro) |
| `freq` | Frequency | 30060 | 59 | FP_32BITS_3DP | /1000 | Hz |
| `cosfi_a` | Power Factor A | 30136 | 135 | FP_32BITS_3DP | /1000 | — |
| `cosfi_b` | Power Factor B | 30138 | 137 | FP_32BITS_3DP | /1000 | — |
| `cosfi_c` | Power Factor C | 30140 | 139 | FP_32BITS_3DP | /1000 | — |
| `pa_total` | P (3P) Active Power | 30118 | 117 | FP_32BITS_3DP | ⚠️ Mult 1e-6 | W — validar escala |
| `pr_total` | Q (3P) Reactive Power | 30126 | 125 | FP_32BITS_3DP | ⚠️ Mult 1e-6 | VAr — validar escala |

**Medições extra disponíveis (fora dos pids canônicos — candidatas a expansão):**
Vab/Vbc/Vca (30010/12/14), tensões secundárias (30022-26), sequências Vpps/Vnps (30050/52) e Ipps/Inps (30102/04), potência por fase (30112-16 / 30120-24), S aparente (30128-34), PF 3P (30142), energia acumulada Act/React Imp/Exp (30144-50, `UINT32`), status térmico % (30152-54, `UINT16`), demanda máxima (30193-30201), correntes/tensões do último trip (30301-30317).

### 5.2 Proteções (Inputs, func `0x02`, bit R/O)

Frame PDU = Modicon − 10001. O 7SR10 organiza a sobrecorrente **por estágio (1–4)**, não por fase — diferente do modelo canônico (que espera A/B/C). Mapeamento proposto usa o estágio 1 como principal:

| pid NexOn | Função | Modicon | Frame PDU | Obs |
|---|---|---|---|---|
| `f51a`/`f51b`/`f51c` | 51 Sobrecorrente temp. (estágios 1/2/3) | 10122 / 10128 / 10134 | 121 / 127 / 133 | ⚠️ estágios, não fases |
| `f50a`/`f50b`/`f50c` | 50 Sobrecorrente inst. (estágios 1/2/3) | 10123 / 10129 / 10135 | 122 / 128 / 134 | ⚠️ estágios, não fases |
| `f51n` | 51N Terra temp. | 10124 | 123 | estágio 1 |
| `f50n` | 50N Terra inst. | 10125 | 124 | estágio 1 |
| `f27a`/`f27b`/`f27c` | 27/59 subtensão por fase | 10401 / 10402 / 10403 | 400 / 401 / 402 | ⚠️ combinado 27+59 por fase |
| `f59a`/`f59b`/`f59c` | 27/59 por fase (mesmo bit) | 10401 / 10402 / 10403 | 400 / 401 / 402 | combinado — ver §7 |
| `f59n` | 59N residual (IT/DT) | 10159 / 10160 | 158 / 159 | sobretensão residual |
| `f81` | 81 sub/sobrefrequência (estágio 1) | 10161 | 160 | estágios 2-4 em 10162-64 |
| `f46` | 46 desequilíbrio (IT/DT) | 10150 / 10151 | 149 / 150 | NPS |
| `f47` | 47 seq. inversa de tensão | 10152 | 151 | |
| `fba` | 50BF falha de disjuntor | 10146 | 145 | 50BF Stage 2 |
| `dj_aberto` | CB 1 Opened / Closed | 10219 / 10220 | 218 / 219 | status disjuntor |
| `dj_bloqueado` | Lockout | 10174 | 173 | |
| `local_remoto` | Remote / Local Mode | 10102 / 10104 | 101 / 103 | |

**Extras disponíveis:** General Trip (10110), General Start/Pickup (10115), VT Fuse Failure (10116), 60 CTS (10149), 49 Alarm/Trip térmico (10147/48), 79 AR in progress (10181), Trip Circuit Fail (10111 / 10211-13), CB wear I²t (10180/10218).

> **Sem equivalente no 7SR10:** `f67` (direcional 67), `f32` (potência reversa), `f86` (bloqueio 86), `f78` (sincronismo). O 7SR10 é um relé de sobrecorrente/tensão/frequência — não tem essas funções. Ficam como `null` no mapa.

### 5.3 Comandos (Coils, func `0x05`, escrita de bit)

Frame PDU = Modicon − 1.

| pid NexOn | Comando | Modicon | Frame PDU | Obs |
|---|---|---|---|---|
| `cmd_abrir` | Cmd Trip (abre disjuntor) | 00227 | 226 | ⚠️ trip — desliga disjuntor |
| `cmd_fechar` | CB 1 (fecha) | 00109 | 108 | ⚠️ confirmar se fecha ou é toggle |
| `cmd_reset` | LED reset | 00100 | 99 | reset de sinalização |

**Outros comandos úteis:** CB1 Trip and Lockout (00111), CB1 Trip and Reclose (00110), Reset Energy Meters (00154), Reset CB Trip Counts (00118-121), seleção de grupo de ajuste G1-G4 (00101-104), modo Remote/Local/OoS (00155-158).

> ⚠️ **Segurança:** `cmd_abrir` (Cmd Trip) **desliga o disjuntor de verdade**. O firmware deve exigir envelope com dedup/ack (igual ao P3U30 SBO) e o botão na UI deve ter confirmação dupla. Nunca cadastrar comando de trip sem essa proteção.

---

## 6. 7SR5 — mapa completo e mapeamento proposto

### 6.1 ⚠️ Diferença fundamental: o 7SR5 NÃO tem mapa fixo

O manual do 7SR5 **não contém uma tabela canônica de registradores**. Diferente do 7SR10 (que documenta um mapa default), o 7SR5 tem o mapa Modbus **totalmente configurável por dispositivo**, editado no **Reydisp Manager 2** (ferramenta Siemens). O manual afirma explicitamente e repetidamente:

> *"A lista completa de pontos para uma configuração específica de dispositivo pode ser vista e editada no Reydisp Manager 2 → arquivo de mapeamento Modbus TCP."* (§5.1.4)
> *"Cada modelo específico de relé terá um arquivo de configuração único."*

Um `grep` no PDF inteiro por `Vab`, `Frequency`, `Power Factor`, `Active Power`, `kWh` retorna **zero** ocorrências no corpo do texto. **O integrador escolhe Nome, Endereço, Formato e Multiplicador de cada ponto.** A família 7SR5/Reyrolle inteira compartilha o mesmo protocolo/formatos/endereçamento — **só a lista de pontos por modelo difere.**

**Consequência prática — 3 caminhos possíveis (ver §7):**
- **(A)** Obter o **arquivo de mapeamento exportado** do Reydisp Manager 2 do dispositivo real (autoritativo) e cadastrar a partir dele.
- **(B)** **Configurar** o mapa Modbus do 7SR5 no Reydisp Manager 2 para **espelhar os endereços do 7SR10** (30010=Vab, 30016=Va, etc.). Como o mapa é livre, isso deixa os dois relés com o **mesmo mapa** → um único cadastro serve ambos. ✅ **Recomendado.**
- **(C)** Usar o **mapa de exemplo do vendor** (§6.3) como ponto de partida e ajustar em bancada.

### 6.2 Protocolo (confirmado do manual)

| Item | 7SR5 |
|---|---|
| **Modbus TCP** | Porta #1 **502** (default), Porta #2 **504** (2ª instância). Máx. 2 mestres simultâneos. Roda junto com IEC 61850. Desabilitado por padrão (sem IP) por segurança. |
| **Unit ID (TCP)** | = slave address, **1–247**, tem que casar com o Unit Identifier do mestre. |
| **Modbus RTU** | RS485. Station address **0–247** (0 = não comunica). |
| **Baud RTU** | 75…230400. **Default 38400** (≠ 7SR10 que é 19200). |
| **Funções** | `0x01` `0x02` `0x03` `0x04` `0x05` `0x0F` `0x10` (idênticas ao 7SR10 + `0x0F`/`0x10` para escrita múltipla). |
| **Endereçamento** | PDU = (4 dígitos) − 1 (igual §4). `30001 → PDU 0`. |
| **Formato measurement** | `FP_32BITS_3DP` (default), signed int32, **big-endian high-word-first, ÷1000, Mult=1** → `S32`/`scale 1000`/`high_first`. `FLOAT_IEEE_754` também disponível no dropdown. |

> **⚠️ Caveat de escrita 32-bit:** a tabela de FC16 (escrita de tempo/contadores) do manual mostra as colunas como `Reg x+1 (MSB) | Reg x (LSB)` — aparentemente low-word-first para **escrita**. Provável quirk de layout, mas **confirmar antes de escrever** valores de 32 bits.

### 6.3 Mapa de exemplo do vendor (7SR5421 sobrecorrente — NÃO é spec fixa)

O manual traz *screenshots* do Comms-Editor com um mapa real de um `7SR5421-6AD26-1AA0`. Serve de **template inicial**, não de spec. Note o passo de 2 registradores (FP_32BITS_3DP = 2 words), idêntico ao 7SR10:

**Input Registers (FC4) — medições:**
| Modicon | Grandeza | Formato | Mult |
|---|---|---|---|
| 30001 | Event Counter | EVENTCOUNT | 0 |
| 30002 | Event | EVENT (8 regs) | 0 |
| 30010/12/14 | Vab / Vbc / Vca | FP_32BITS_3DP | 1 |
| 30016/18/20 | Va / Vb / Vc | FP_32BITS_3DP | 1 |

(o screenshot corta aqui — correntes, freq, P/Q/S, PF, energia, THD e demanda **existem** mas não estão impressos; vêm do arquivo de mapeamento do dispositivo.)

**Inputs (FC2) — status/proteção:** 10001-04 (Binary Inputs), 10700 Power On, 10701-03 A/B/C-Starter (pickup por fase), 10704 General Starter, 10705 VTS Alarm, 10706/07 Earth Fault Forward/Reverse. Os bits ANSI (27/59/50/51/81…) são pontos selecionáveis, endereçados no arquivo do dispositivo.

**Coils (FC5) — comandos:** 00001-06 (Binary Outputs / relés de saída), 00100 LED reset, 00101 Auto-reclose, 00102-05 seleção de grupo G1-G4. Trip/close do disjuntor são atribuídos como coils (Binary Output ou coils dedicados) — **confirmar o coil de controle do disjuntor no dispositivo.**

**Holding Registers (FC3/FC16):** 40001 relógio (TIME_METER, 4 regs), 40011-26 código MLFB do equipamento (ASCII, R/O), 40065/40069 sync de tempo alternativo, e podem carregar medições também.

### 6.4 Mapeamento proposto para o 7SR5

**Se seguirmos o caminho (B)** — configurar o 7SR5 para espelhar o 7SR10 — o `ai_map`/`bi_map`/`bo_map` do 7SR5 será **idêntico ao do §5**, com a diferença de protocolo (`tcp` na porta 502 ou `rtu` 38400). Nesse caso criamos `siemens-7sr5` reaproveitando os mesmos offsets, mudando só `protocolo` e `connection_note`.

**Se seguirmos (A) ou (C)** — preencher esta subseção com os endereços reais do arquivo de mapeamento exportado do dispositivo, no mesmo formato de tabela do §5.1-5.3.

---

## 7. Decisões pendentes

Antes de eu partir para o cadastro efetivo, preciso da sua confirmação em:

1. **Conexão do 7SR5 — RTU ou TCP?** Ele tem Ethernet. Se a instalação já tem cabo de rede até o relé, Modbus TCP (porta 502) é mais robusto (sem RS485, sem framing). Se não, RTU via RS485 (default 38400 baud). *(Recomendação: TCP se houver Ethernet disponível.)*

2. **Mapa do 7SR5 — como obter?** Como o 7SR5 não tem mapa fixo (§6.1), escolher: **(A)** exportar o arquivo de mapeamento do Reydisp Manager 2 do dispositivo; **(B)** configurar o 7SR5 para espelhar os endereços do 7SR10 (um cadastro serve ambos); **(C)** usar o mapa de exemplo do vendor e ajustar em bancada. *(Recomendação: (B) — deixa a frota Siemens uniforme.)* **Sem um desses, não dá para cadastrar o 7SR5 com endereços reais.**

3. **Proteções por estágio vs. por fase.** O 7SR10/7SR5 reportam 50/51 **por estágio (1-4)**, mas o modelo canônico `rele_protecao.bi` do NexOn é **por fase (A/B/C)**. Opções:
   - (a) Mapear estágios 1/2/3 nos pids a/b/c (rápido, mas o label "Fase A" fica impreciso);
   - (b) Estender o modelo canônico com pids por estágio (`f51_1`, `f51_2`…) — mais correto, exige tocar `DEVICE_POINTS`.
   *(Recomendação: (b) para relés Siemens, porque estágio ≠ fase e confundir isso atrapalha a operação.)*

4. **27 e 59 combinados.** O 7SR10 tem um único bit "27/59 PhX" (junta sub e sobretensão). Confirmar se quer os dois pids apontando pro mesmo bit ou usar os bits de estágio separados (27/59-1..4, 59 PhAB/BC/CA).

5. **Escala de potência/energia** (a coluna Mult) — resolvida no teste de bancada (§3.3 / §9), mas convém você confirmar a unidade que espera ver (W vs kW vs MW) no dashboard.

---

## 8. Passo a passo da implementação

**Fase 0 — Decisões (você):** ✅ FEITO. 7SR5 = RTU (igual 7SR10); espelhar mapa; modelagem NexOn.

**Fase 1 — Cadastro no catálogo (`.v2.js`):** ✅ FEITO.
- `siemens-7sr10` e `siemens-7sr5` criados em `AupusNexOn/public/iot-device-catalog.v2.js` (o 7SR5 espelha o 7SR10, muda só `protocolo`/`connection_note`/baud).
- `ai_blocks` (2 blocos FC04), `ai_map` (13 medições S32/1000), `bi_block`+`bi_map` (22 proteções FC02) e `bo_map` (3 comandos FC05).

**Fase 1.5 — Ajuste no gerador:** ✅ FEITO.
- As proteções Siemens estão em **Inputs (FC02)**, mas o gerador só lia `bi_block` com `readCoils` (FC01). Adicionei suporte a `bi_block.func: 0x02` → `readDiscreteInputs` em `iot-firmware-generator.v2.js`. `IOT_SCRIPTS_VERSION` bumpado para `20260703-siemens7sr`.

**Fase 2 — Validação de geração:** ✅ FEITO (harness node).
- C++ gerado confere: `readInputRegisters(15,74)` + `readInputRegisters(117,24)` (medições), `readDiscreteInputs(101,302)` (proteções), decoders `(int32_t)(...>>16|...)/1000.0` (S32/1000), 22 bits BI desempacotados. Compilação `pio run` completa deve rodar quando um diagrama real for montado (Fase 5).

**Fase 3 — Seed no DB de produção:** ⏳ PENDENTE (comando pronto, gated).
```
cd /var/www/service-nexon/aupus-service-api && pnpm ts-node scripts/db/seed-iot-catalog.ts
```
Idempotente (upsert por `unique(fabricante,modelo)`); insere só os 2 modelos novos, não sobrescreve existentes. **Recomendo rodar após a validação de bancada** — enquanto a escala de potência não é confirmada, os modelos ficam disponíveis mas com esse caveat.

**Fase 4 — Teste de bancada (você + eu):** ⏳ ver §9. Confirma offset de endereço, escala de potência, e os comandos trip/close **antes** de ir a campo.

**Fase 5 — Deploy + campo:** `deploy.sh` do `AupusNexOn`, gerar firmware pra TON real, gravar (OTA), acompanhar telemetria.

---

## 9. Procedimento de teste em bancada

Pré-requisitos: TON + conversor RS485 (ou Ethernet, para 7SR5 TCP) + relé alimentado com sinais de teste (mala de teste ou injeção).

**Pontos críticos a validar (a razão do teste existir):**

1. **Offset de endereço.** Ler `Va` (Modicon 30016 → frame 15). Se vier lixo, testar frame 16 (base 30000). Ajustar `ai_blocks[].start`.
2. **Escala FP_32BITS_3DP.** Injetar tensão conhecida (ex. 100 V secundário) e conferir se o valor decodificado como `S32/1000` bate. Repetir para corrente e frequência.
3. **⚠️ Escala de potência/energia (Mult).** Injetar carga conhecida (P, Q) e comparar o valor lido com o display do relé. Determinar o divisor real (a coluna Mult). **Este é o ponto mais incerto.**
4. **Proteções.** Forçar um pickup (ex. sobrecorrente) e ver o bit correspondente mudar no MQTT.
5. **⚠️ Comandos (por último, com disjuntor de teste).** Testar `cmd_abrir` (trip) e `cmd_fechar` num disjuntor de bancada — **nunca** num disjuntor energizado de verdade sem procedimento.

Cross-check: Serial Monitor da TON (`[MB]`/`[TCP-INV]` logs) + payload MQTT + display físico do relé.

---

## 10. Riscos e armadilhas conhecidas

- **Comando de trip é real.** `cmd_abrir` desliga o disjuntor. Exigir envelope+ack e confirmação dupla na UI. Testar só em bancada primeiro.
- **Estágio ≠ fase.** Não confundir estágio de proteção (1-4) com fase (A/B/C). Decidir a modelagem no §7.2 antes de cadastrar, senão a operação lê errado.
- **Escala de potência incerta** (coluna Mult) — não publicar potência em produção antes da validação de bancada.
- **Framing serial (RTU).** Confirmar baud/paridade do relé (default 19200) x TON (hardcoded 8N1). Se o relé estiver em paridade Even (8E1), pode haver incompatibilidade de framing — mesmo problema visto no P3U30. Para o 7SR5, TCP evita isso.
- **Blocos ≤ 125 registradores** por leitura (limite func 0x04). As medições do 7SR10 vão de 30010 a ~30150 (>125 regs) → dividir em ≥2 blocos.
- **Endereço de estação único** por barramento RS485 (1-247). Não colidir com outros dispositivos no mesmo conversor.
- **Mapa do 7SR5 não é fixo.** Não dá para cadastrar o 7SR5 só com o manual — depende do arquivo de mapeamento do dispositivo ou de configurá-lo (§6.1/§7.2). O mapa "de exemplo" do vendor é ponto de partida, não spec.
- **Baud diferente entre os dois** (7SR10 default 19200, 7SR5 default 38400) — conferir ao cadastrar cada um.
- **7SR5 Modbus vem desabilitado de fábrica** (sem IP, por segurança). Habilitar TCP e definir Unit ID no Reydisp antes de comunicar.

---

## Apêndice — referências

**Arquivos modificados nesta implementação:**
- `AupusNexOn/public/iot-device-catalog.v2.js` — modelos `siemens-7sr10` e `siemens-7sr5`.
- `AupusNexOn/public/iot-firmware-generator.v2.js` — `bi_block.func: 0x02` → `readDiscreteInputs` (antes só `readCoils`).
- `AupusNexOn/src/features/supervisorio/components/iot-diagram.tsx` — `IOT_SCRIPTS_VERSION = 20260703-siemens7sr`.
- **Pendente (gated):** seed no DB via `aupus-service-api/scripts/db/seed-iot-catalog.ts`.

**Referências:**
- Manuais: `/var/www/iot_nexon/mapa_modbus/SIEMENS/` (7SR10 e 7SR5).
- Modelos de referência no catálogo: `pextron-urp6000`, `schneider-p3u30` (em `iot-device-catalog.v2.js`).
- Pids canônicos: `DEVICE_POINTS.rele_protecao` (mesmo arquivo, linha ~23).
- Docs relacionados: `IOT-SCHNEIDER-P3U30-CADASTRO.md`, `IOT-WEG-SIW-CADASTRO.md`, `IOT-TON-DOMINIO-EQUIPAMENTOS.md`.
</content>
</invoke>
