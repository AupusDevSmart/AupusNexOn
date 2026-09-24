# Cadastro Schneider Easergy P3U30 no Catálogo IoT

**Data**: 2026-06-01 (cadastro inicial) | 2026-06-02 (expansões: status/AR/fault + comandos via VI + Object control SBO)
**Status**: **implementado e validado em bancada** — leitura dos 4 blocos confirmada via MQTT. Comandos SBO prontos, pendente teste físico de trip/close em disjuntor.
**Escopo**: cadastro do modelo Schneider Easergy P3U30 no NexOn (catálogo frontend `.v2.js` + tabela `iot_device_modelos` no PostgreSQL) + extensão do gerador para comandos compostos (SBO).
**Histórico**:
  - v1 (01/06): 1 bloco AI (medições básicas, 13 pontos) — sem bo_map
  - v2 (01/06): 4 blocos AI (medições + status/AR + fault + CBM, 46 pontos) + bo_map via Virtual Inputs (`cmd_trip/close/reset` exigindo Matrix)
  - v3 (02/06): bo_map migrado pra **Object control direto (SBO)** — 23 comandos cobrindo 8 Objects + especiais, **sem necessidade de Matrix configurada**
**Out-of-scope nesta versão**: bi_map (proteção bits 406xxx via bit-level decoding) — fica V4.

---

## Sumário

1. [Motivação e contexto](#1-motivação-e-contexto)
2. [Estado anterior vs. novo](#2-estado-anterior-vs-novo)
3. [Mapeamento Modbus](#3-mapeamento-modbus)
4. [Configuração obrigatória no relé](#4-configuração-obrigatória-no-relé-via-esetup-easergy-pro)
5. [Cabeamento físico recomendado](#5-cabeamento-físico-recomendado)
6. [Procedimento de teste em bancada](#6-procedimento-de-teste-em-bancada)
7. [Importação para outras plantas](#7-importação-para-outras-plantas)
8. [Expansões futuras (V2)](#8-expansões-futuras-v2)
9. [Riscos e armadilhas conhecidas](#9-riscos-e-armadilhas-conhecidas)
10. [Resultado e métricas](#10-resultado-e-métricas)

---

## 1. Motivação e contexto

O sistema NexOn precisa monitorar **medições elétricas e proteções ANSI** em UCs que usam relés Schneider (especialmente para a integração de **falta de energia → Equatorial** — vide [IOT-NEXON-EQUATORIAL-FALTA-ENERGIA.md](IOT-NEXON-EQUATORIAL-FALTA-ENERGIA.md), que depende da função 27 mapeada em algum relé).

Até esta sessão, o único relé cadastrado era o **Pextron URP6000** (já com função 27 mapeada). O Schneider P3U30 estava pendente — manuais já extraídos em `/var/www/iot_nexon/mapa_modbus/SCHNEIDER/`, mas sem cadastro.

Esta documentação cobre o **primeiro cadastro do P3U30**, focado em **medições básicas** para validar a comunicação Modbus RTU em bancada. Proteções (bi_map) e comandos (bo_map) ficam pra V2.

### Por que começar com medições e não com proteções

- Mapeamento de medições é **bem documentado** no manual de comunicação `P3_EN_CM_30-208A_web.pdf`
- Validação visual é simples: comparar leitura Modbus vs. display físico
- Não exige bit-level decoding (que apesar de implementado no gerador, adiciona complexidade)
- Permite confirmar timing/parity/cabeamento isoladamente antes de evoluir

---

## 2. Estado anterior vs. novo

### Antes (2026-05-31)

| Camada | Estado |
|---|---|
| Manual Modbus do P3U30 (`P3_EN_CM_30-208A_web.pdf`) | ✅ disponível em `/var/www/iot_nexon/mapa_modbus/SCHNEIDER/` |
| 6 PDFs "Relatório de configurações" do relé | ✅ disponíveis (não consumidos ainda) |
| Modelo no `iot_device_modelos` (PostgreSQL) | ❌ ausente |
| Modelo no `iot-device-catalog.v2.js` | ❌ ausente |
| Endpoint `device-catalog.js` servindo P3U30 | ❌ ausente |
| Bit-level decoding no gerador | ✅ já implementado em sessão anterior (não bloqueia) |

### Depois (2026-06-01)

| Camada | Estado |
|---|---|
| Modelo no `iot_device_modelos` (PostgreSQL) | ✅ id `1be232e710bd379bd7b454ecd6`, 13 pontos AI, 1 bloco |
| Modelo no `iot-device-catalog.v2.js` | ✅ bloco `'schneider-p3u30'` após Pextron URP6000 (linha ~289) |
| Endpoint `device-catalog.js` servindo P3U30 | ✅ confirmado via `curl https://aupus-nexon-api.aupusenergia.com.br/api/v1/iot-catalog/device-catalog.js` |
| Deploy `AupusNexOn` (cache buster bump) | ✅ commit `617405b`, `IOT_SCRIPTS_VERSION=20260529-p3u30` |
| Pronto para uso na UI do diagrama IoT | ✅ qualquer planta nova pode adicionar componente `Schneider P3U30` |

---

## 3. Mapeamento Modbus

### Características gerais

| Aspecto | Valor |
|---|---|
| Protocolo nativo | Modbus RTU (RS485) — opcional Modbus TCP via Ethernet |
| Tipo de registrador | **Holding registers** (`4xxxxx`, function code `0x03`) |
| Endereçamento | Modicon `40xxxx`. **Frame Modbus = endereço Modicon − 1** |
| Bit rate default | 9600 bps |
| Parity default fábrica | **Even** ⚠️ (mude para None — ver §4) |
| Stop bits | 1 |
| Word order | high_first (default Schneider) |
| Range slave address | 1-247 |

### Bloco AI único

Todos os 13 pontos cabem em **um bloco contíguo** de 14 registradores (com 1 gap normal):

```js
ai_blocks: [
  {
    start: 2008,        // Modicon 402009 - 1 (zero-based no frame Modbus)
    count: 14,          // 402009 a 402022 = 14 registradores
    func: 0x03,         // Read Holding Registers
    label: 'Regs 402009-402022: I, V, freq, P'
  }
]
```

**Justificativa de bloco único**: leitura em rajada é mais eficiente que múltiplas requisições. 14 regs cabem com folga em uma resposta Modbus (limite ~125 regs).

### Mapeamento `ai_map` completo

| PID | Modicon | Offset | Scale | DataType | Mode | Unidade | Origem |
|---|---|---|---|---|---|---|---|
| `ia` | 402009 | 0 | 1 | U16 | avg | A | Phase current IA |
| `ib` | 402010 | 1 | 1 | U16 | avg | A | Phase current IB |
| `ic` | 402011 | 2 | 1 | U16 | avg | A | Phase current IC |
| `in1_residual` | 402012 | 3 | 100 | U16 | avg | A | IN-1 residual current |
| (gap) | 402013 | 4 | — | — | — | — | não mapeado pelo manual |
| `vab` | 402014 | 5 | 1 | U16 | avg | V | Line-to-line VAB |
| `vbc` | 402015 | 6 | 1 | U16 | avg | V | Line-to-line VBC |
| `vca` | 402016 | 7 | 1 | U16 | avg | V | Line-to-line VCA |
| `va` | 402017 | 8 | 1 | U16 | avg | V | Phase-to-earth VA |
| `vb` | 402018 | 9 | 1 | U16 | avg | V | Phase-to-earth VB |
| `vc` | 402019 | 10 | 1 | U16 | avg | V | Phase-to-earth VC |
| `residual_voltage` | 402020 | 11 | 10 | U16 | avg | % Uo | Residual voltage |
| `freq` | 402021 | 12 | 100 | U16 | last | Hz | Frequency |
| `potencia_ativa` | 402022 | 13 | 1 | U16 | last | kW | Active power |

### Como os scalings foram derivados

O manual `P3_EN_CM_30-208A_web.pdf` (página 12, Figura 7) lista os defaults Schneider:
- "1 A = 1" → corrente direto em A → **scale: 1**
- "1.00 A = 100" → raw 100 = 1.00 A → **scale: 100**
- "1000 V = 1000" → raw 1000 = 1000 V → **scale: 1**
- "1.0% = 10" → raw 10 = 1.0% → **scale: 10**
- "50.000 Hz = 5000" → raw 5000 = 50.00 Hz → **scale: 100**
- "1000 kW = 1000" → raw 1000 = 1000 kW → **scale: 1**

Lembrando: no catálogo NexOn, `scale` é **divisor** (valor_humano = raw / scale).

### Block diagram do payload MQTT gerado

A TON publica em `<topic_base>/<deviceName>/status` a cada 60s. Para um diagrama com `topic_base=TESTE/BANCADA/P3U30` e `deviceName=Rele-P3U30-01`:

```
TESTE/BANCADA/P3U30/Rele-P3U30-01/status
```

Payload aproximado:
```json
{
  "timestamp": "01/06/2026 16:30:00",
  "device": "Rele-P3U30-01",
  "ac": {
    "ia": 12.3, "ib": 12.5, "ic": 12.4,
    "vab": 380.2, "vbc": 379.8, "vca": 380.5,
    "va": 219.5, "vb": 220.8, "vc": 220.1,
    "residual_voltage": 0.2
  },
  "in1_residual": 0.05,
  "freq": 60.00,
  "potencia_ativa": 8.20,
  "samples": 15
}
```

> O agrupamento exato (`ac`, etc) depende do `DEVICE_POINTS['rele_protecao']` no catálogo, que define o `json` path de cada pid. Verificar a estrutura efetiva via `mosquitto_sub` no teste.

---

## 4. Configuração obrigatória no relé (via eSetup Easergy Pro)

**⚠️ Crítico**: o P3U30 sai de fábrica em **9600 8E1** (Even parity). A TON está hardcoded em **9600 8N1** (None parity). Se não for ajustado no relé, **toda comunicação dará `0xE3` (CRC error)**.

### Passo a passo

1. Instalar **eSetup Easergy Pro** (software gratuito Schneider, disponível em `se.com`)
2. Conectar PC → P3U30 via USB
3. Abrir projeto e ler config atual do relé
4. **COMMUNICATION → Protocol configuration**:
   - **Remote port** → Protocol: `ModBusSlv` ✓
5. **COMMUNICATION → MODBUS main configuration**:
   - **Slave number**: `1` (ou outro 1-247, mas tem que casar com cadastro)
   - **Modbus bit rate**: `9600`
   - **Parity**: `None` ⚠️ (default vem `Even`, **mudar obrigatoriamente**)
6. **Write configuration** para o relé
7. **Reboot** do relé pra aplicar (alguns parâmetros exigem reboot — eSetup avisa)

### Alternativa (futuro)

Tornar `RS485_CONFIG` configurável por device no catálogo NexOn (campo `serial_config: 'SERIAL_8E1'` ou similar). Demanda refator do gerador. Custo: ~1-2h. Fica pra versão futura se aparecer demanda de equipamentos que não permitem mudar parity.

---

## 5. Cabeamento físico recomendado

### Para bancada de teste (cabo ≤ 5m)

Mínimo viável:
```
[P3U30 A+] ──── par trançado ──── [TON A]
[P3U30 B-] ──── par trançado ──── [TON B]
[P3U30 GND] ──── (terra comum) ──── [TON GND]
```

Terminação e bias podem ser dispensados em cabo curto (vide [IOT-RS485-MELHORIAS.md](IOT-RS485-MELHORIAS.md) §6).

### Para instalação real (cabo > 10m ou ambiente industrial)

Adicionar:
- **Cabo par trançado blindado** (Belden 9841 ou equiv., impedância 120Ω)
- **Terminação 120Ω** nas DUAS pontas (resistor entre A e B no relé + na TON)
- **Polarização (bias)** 680Ω num único ponto (preferência: perto da TON)
- **Malha do cabo aterrada em UMA extremidade só** (geralmente na TON)
- **Roteamento longe de cabos de força** (mínimo 30cm de distância)

Detalhamento completo em [IOT-RS485-MELHORIAS.md](IOT-RS485-MELHORIAS.md).

---

## 6. Procedimento de teste em bancada

### 6.1 Pré-requisitos

- TON ESP32-S3 com firmware ≥ `v1.3.0-clientid`
- Relé Schneider Easergy P3U30 alimentado (24-230 VDC, vide datasheet)
- Cabo RS485 entre os dois (par trançado, ≤ 5m)
- PC com browser autenticado em `https://nexon.aupusenergia.com.br`
- (Opcional) PC com eSetup Easergy Pro pra configurar o relé

### 6.2 Criar diagrama de teste na UI

`Sinóptico` → criar planta `BANCADA-P3U30` (ou usar existente):

| Componente | Configuração |
|---|---|
| TON | hostname: `TON-BANCADA-P3U30` (único! não usar `TON1`) |
| WiFi/Ethernet | conexão à rede com saída p/ internet |
| MQTT Broker | `72.60.158.163:1883` (já existente) |
| Relé de Proteção | modelo: `schneider-p3u30`, nome: `Rele-P3U30-01`, slave: `1`, conexão: RS485 |
| Topic Base | `TESTE/BANCADA/P3U30` |

### 6.3 Gerar e gravar firmware

1. **Hard refresh** no browser (`Ctrl+Shift+R`) — força reload do `.v2.js` v20260529-p3u30
2. Abrir o diagrama IoT → **Firmware → Compilar** (~50-60s)
3. Plugar TON via USB → **Gravar via USB**
4. Aguardar conclusão do flash + reboot automático

### 6.4 Validar no Serial Monitor

Esperar o boot completo. Padrão esperado:
```
TON-XX v1.3.0-clientid - TON1
[BOOT] ClientID v1.3.0: MQTT_CLIENT_ID derivado do MAC
[MQTT] client_id (do MAC): TON-AABBCCDDEEFF
[RS485] TX=18 RX=17 DIR=8 9600 baud
[WIFI] IP: 192.168.x.x
[MQTT] Conectado!
[MB] Rele-P3U30-01_1 #1: ia=12.30 ib=12.50 ic=12.40 va=219.50 vb=220.80 vc=220.10 freq=60.00 potencia_ativa=8.20
```

**Diagnóstico de problemas pelo log:**

| Sintoma | Causa provável |
|---|---|
| `[MB] Rele-P3U30-01_1 bloco 0 FAIL ... rc=0xE3` constante | Parity não foi mudada (relé ainda em Even). Voltar ao §4 |
| `[MB] ... rc=0xE2` (timeout) | Cabo desconectado, slave ID errado (não bate com o configurado), relé desligado |
| `[MB] ... rc=0xE0` esporádico | Cross-talk / eco — adicionar terminação 120Ω e bias 680Ω |
| Valores absurdos (ex: va=65000) | Scaling errado — revisar `scale` no catálogo |
| Tudo zero | Relé funcionando mas sem entrada elétrica (TPs/TCs sem alimentação) |

### 6.5 Cross-check via MQTT (em outra janela)

```bash
mosquitto_sub -h 72.60.158.163 -p 1883 \
  -t 'TESTE/BANCADA/P3U30/+/status' -v
```

A cada 60s deve chegar 1 mensagem com os 13 pontos populados.

### 6.6 Comparação com display físico

Comparar leituras MQTT vs. valores mostrados no LCD do P3U30:
- `MEASUREMENTS > Voltages` → VA, VB, VC, VAB, VBC, VCA
- `MEASUREMENTS > Currents` → IA, IB, IC, IN1
- `MEASUREMENTS > Frequency` → freq
- `MEASUREMENTS > Power` → potencia_ativa

**Tolerância aceitável**: ±1% (devido a arredondamentos no scaling).

---

## 7. Importação para outras plantas

Quando o teste de bancada validar, replicar é trivial:

1. Em qualquer planta real na UI (ex: CF Investments, San German), abrir o diagrama IoT
2. **Adicionar componente "Relé de Proteção"**
3. **Modelo**: selecionar `Schneider Easergy P3U30` no dropdown (já disponível desde o cadastro)
4. **Slave ID**: configurar conforme o relé físico daquela instalação (1-247)
5. **Nome**: único naquela TON (ex: `Rele-Geral-CF01`)
6. **Conexão**: RS485 da TON (se a TON for compartilhar barramento com outros devices, vide §9)
7. **Regenerar firmware** da TON → Gravar via USB OU OTA (se já estiver em campo com firmware compatível)

**Zero retrabalho** de mapeamento Modbus — o catálogo é central.

---

## 8. Expansões futuras (V2)

### V2.1 — Proteções (bi_map com bit-level decoding)

O P3U30 expõe protection bits em registradores `406001-406008` (vide manuais "Relatório de configurações" extraídos no eSetup). Funções típicas:
- **ANSI 27** (subtensão): `406003.0` — chave pra detecção de falta de energia
- **ANSI 50** (sobrecorrente instantâneo): `406001.1`, `406001.2`, `406001.3` (uma por fase)
- **ANSI 59** (sobretensão): `406002.14`
- **ANSI 46BC** (sequência negativa): `406001.5`
- **ANSI 81U/O** (sub/sobre frequência): bits em 406004
- **ANSI 49** (térmico): bits em 406005

Pra cadastrar, esperar nova sessão com:
- Leitura completa dos manuais (especialmente os 6 PDFs "Relatório de configurações")
- Decisão sobre quais funções mapear primeiro (recomendado: 27, 50, 59)
- Validação física: forçar disparo da proteção via injetora secundária + ver bit virar no log

Quando bi_map estiver pronto, o **detector de falta de energia** ([IOT-NEXON-EQUATORIAL-FALTA-ENERGIA.md](IOT-NEXON-EQUATORIAL-FALTA-ENERGIA.md) Fase 2) passa a poder usar P3U30 como fonte do evento `f27`.

### V2.2 — Comandos remotos (bo_map) ✅ ATIVO (firmware ≥ v1.5.0-sbo)

**Status (2026-06-02)**: implementado via **Object control direto (Select-Before-Operate, SBO)** — caminho industrial padrão Schneider, **sem necessidade de Matrix configurada**. Cadastro tem **23 comandos** cobrindo os 8 Objects do P3U30 + comandos especiais.

#### Histórico de implementação

| Versão | Quando | O que mudou |
|---|---|---|
| v1.4.0-cmd-hr | 01/06 | Gerador suporta `func 0x06` (writeSingleRegister). bo_map via 3 Virtual Inputs (VI1/2/3) — exige Matrix configurada |
| v1.4.1-cmdenv-fix | 02/06 | Fix bug envelope `cmd_id` com objeto `cmd` aninhado (ArduinoJson 7) |
| **v1.5.0-sbo** | **02/06** | **Gerador suporta comandos compostos via `steps[]`**. Cadastro migrado pra Object control direto — 8 Objects × Open/Close + 4 especiais + 3 aliases legados |

#### Padrão SBO (Select-Before-Operate)

Schneider P3U30 usa segurança industrial padrão: cada comando de controle de disjuntor exige **2 writes sequenciais**:

```
1. Open select Obj1 (402508)  ← seleciona operação
2. Execute operation Obj1 (402510)  ← confirma e dispara
```

Se Execute não chegar em ~30s após Select, o relé **cancela a seleção sozinho** (timeout). Isso protege contra trip acidental por frame corrompido ou comando duplicado.

#### Tabela completa de Objects (Modicon → frame)

| Object | Open Select | Close Select | Execute |
|---|---|---|---|
| Obj1 | 402508 → 2507 | 402509 → 2508 | 402510 → 2509 |
| Obj2 | 402512 → 2511 | 402513 → 2512 | 402514 → 2513 |
| Obj3 | 402517 → 2516 | 402518 → 2517 | 402519 → 2518 |
| Obj4 | 402521 → 2520 | 402522 → 2521 | 402523 → 2522 |
| Obj5 | 402527 → 2526 | 402528 → 2527 | 402529 → 2528 |
| Obj6 | 402531 → 2530 | 402532 → 2531 | 402533 → 2532 |
| Obj7 | 402538 → 2537 | 402539 → 2538 | 402540 → 2539 |
| Obj8 | 402542 → 2541 | 402543 → 2542 | 402544 → 2543 |

#### Comandos cadastrados no bo_map (23 total)

**Por Object (8 × 2 = 16 comandos)**:
- `cmd_open_obj1`...`cmd_open_obj8` — SBO Open
- `cmd_close_obj1`...`cmd_close_obj8` — SBO Close

**Especiais single-write (4 comandos)**:
- `cmd_release_latches` — Modicon 402501 (reset alarmes)
- `cmd_cancel_operation` — Modicon 402516 (desfaz seleção SBO pendente)
- `cmd_reset_diagnostics` — Modicon 402535 (reseta contadores diag)
- `cmd_clear_min_max` — Modicon 402536 (limpa máx/mín de medições)

**Aliases legados (3 comandos, apontam pra Obj1)**:
- `cmd_trip` → equivale a `cmd_open_obj1` (compat v1.4.x)
- `cmd_close` → equivale a `cmd_close_obj1`
- `cmd_reset` → equivale a `cmd_release_latches`

#### Formato do bo_map no catálogo

Comandos SBO usam o campo novo `steps` (suportado desde v1.5.0):

```js
'cmd_open_obj1': {
    steps: [
        { register: 2507, value: 1, func: 0x06 },   // Open select Obj1
        { register: 2509, value: 1, func: 0x06 },   // Execute operation Obj1
    ],
    delay_ms: 50,   // espaçamento entre writes (opcional, default 0)
}
```

Comandos simples (1 write) continuam usando formato legado:

```js
'cmd_release_latches': { register: 2500, value: 1, func: 0x06 }
```

#### Código C++ gerado (exemplo)

```cpp
if (strcmp(cmd_id, "cmd_open_obj1") == 0) {
    if (_mb.writeSingleRegister(2507, 1) != _mb.ku8MBSuccess) return false;
    delay(50);
    if (_mb.writeSingleRegister(2509, 1) != _mb.ku8MBSuccess) return false;
    return true;
}
```

#### Pré-requisito único no relé

**CONTROLE → Object N → Control mode = `Remote`** (uma vez por Object usado).

**Não exige Matrix configurada** — o Object control é o caminho nativo. Comparação:

| Aspecto | Via VI/Matrix (v1.4.x) | Via Object control SBO (v1.5.0) |
|---|---|---|
| Pré-requisito | Matrix mapeada (`VI1 × Object Open`) | Apenas Control mode = Remote |
| Writes por cmd | 1 | 2 (Select + Execute) |
| Risco trip acidental | Maior (1 write basta) | Menor (SBO requer 2 writes) |
| Cancelamento | Não tem | Sim (timeout 30s ou cancel explícito) |
| Plug-and-play | Não | Sim |

#### Como disparar via MQTT

```bash
# Formato simples (sem ack)
mosquitto_pub -h 72.60.158.163 -p 1883 \
  -t '<topic_base>/cmd' \
  -m '{"device":"Rele-P3U30-01","cmd":"cmd_open_obj1"}'

# Formato com envelope (dedup + ack em <topic_base>/cmd/ack)
mosquitto_pub -h 72.60.158.163 -p 1883 \
  -t '<topic_base>/cmd' \
  -m '{"cmd_id":"trip-001","cmd":{"device":"Rele-P3U30-01","cmd":"cmd_open_obj1"}}'
```

Resposta no `/cmd/ack`:
```json
{"cmd_id":"trip-001","status":"ok","msg":"Rele-P3U30-01/cmd_open_obj1:OK"}
```

#### Como confirmar que disparou (feedback)

No próximo round de leitura (60s), o JSON em `<topic_base>/<device>/data` deve mostrar:
- `final_trip: 1` (era 0)
- `cbm_trip_counter` incrementou
- `logic_outputs_1_10` com bit do LO associado ao trip ativado

#### Cuidados de segurança operacionais

- Backend deve exigir **auth + permissão específica** antes de aceitar `cmd_open_obj*` (pode desligar disjuntor sob carga). Vide DEPLOY.md §6 RBAC.
- Considerar **dupla confirmação na UI** antes de comandos remotos críticos.
- **Logar todo comando enviado** (auditoria — quando, quem, qual relé, qual cmd).
- Usar **`cmd_id` único e estável** pra idempotência (formato sugerido: `<acao>-<timestamp>-<usuario>`).
- Monitorar `cbm_trip_counter` e `cbm_open_count` no histórico — anomalia (trip não comandado) é alerta.

### V2.3 — Energia acumulada

Energia ativa/reativa/aparente em kWh, kvarh — provavelmente em registradores na faixa `405xxx` ou `406xxx`. Tipo U32 (precisa 2 regs). Modo `delta` no catálogo (calcula consumo entre publishes).

### V2.4 — THD, sequência de fases, demanda

Pontos adicionais úteis pra qualidade de energia. Endereços a confirmar via "Relatório de configurações".

### V2.5 — Suporte a Modbus TCP via módulo P3M Ethernet

P3U30 tem módulo Ethernet opcional. Quando presente, comunicação via TCP é mais robusta que RS485. Cadastrar variante `schneider-p3u30-tcp` ou adicionar suporte multi-protocolo no mesmo catalog_id.

---

## 9. Riscos e armadilhas conhecidas

| # | Risco | Mitigação |
|---|---|---|
| 1 | **Parity Even default** quebra comunicação | Documentado §4. Sempre conferir antes de ligar à TON |
| 2 | Slave ID duplicado se compartilhar RS485 com outros devices | Verificar no display de cada device antes de cascatear. P3U30 + Pextron URP6000 no mesmo barramento exigem IDs diferentes (ex: P3U30=1, Pextron=2) |
| 3 | Scaling Schneider configurável no eSetup — pode variar entre relés | Cadastro atual assume defaults Schneider (vide §3.3). Se um operador mudou no eSetup, o cadastro do nosso lado fica errado pra aquele relé. **Verificar via Communication > MODBUS & PROFIBUS scalings** no eSetup |
| 4 | `RS485_CONFIG` é hardcoded na TON pra 8N1 — outros relés que só falam 8E1 ficam impossíveis | V2: tornar parametrizável (vide §4 alternativa) |
| 5 | Manuais "Relatório de configurações" são exports do eSetup do relé do **cliente A** — podem refletir setup customizado | Ao expandir mapeamento, validar contra manual de comunicação oficial (`P3_EN_CM_30-208A_web.pdf`), não contra os Relatórios |
| 6 | Reg 402013 é gap no manual (não documentado) | Lemos mas ignoramos no ai_map. Se um dia preencher (firmware Schneider mais novo), revisar |
| 7 | `dataType: U16` assumido — alguns pontos podem ser S16 (sinalizados) | Potência ativa pode ser negativa em gerador. Se aparecer valor > 32768 quando esperado negativo, mudar para S16 |
| 8 | Compartilhamento de RS485 entre relé Schneider + relé Pextron + medidores | Pode causar cross-talk se cabeamento ruim. Considerar 2º barramento RS485 (vide [IOT-RS485-MELHORIAS.md](IOT-RS485-MELHORIAS.md)) |

---

## 10. Resultado e métricas

### 10.1 Implementação

| Item | Estado | Local |
|---|---|---|
| Cadastro DB `iot_device_modelos` | ✅ | id `1be232e710bd379bd7b454ecd6` |
| Cadastro `.v2.js` em paridade | ✅ | [iot-device-catalog.v2.js:~289](../AupusNexOn/public/iot-device-catalog.v2.js#L289) |
| Endpoint público serve P3U30 | ✅ | `GET /api/v1/iot-catalog/device-catalog.js` |
| Cache buster bumpado | ✅ | `IOT_SCRIPTS_VERSION = '20260529-p3u30'` |
| Commit | ✅ | `617405b` (push pendente — token GitHub expirado) |
| Deploy `AupusNexOn` via `deploy.sh` | ✅ | `dist` swappado, nginx servindo |
| Documentação | ✅ | este arquivo |

### 10.2 Mapeamento (resumo numérico)

| Métrica | Valor |
|---|---|
| Pontos AI mapeados | 13 (3 correntes + 1 IN1 + 3 V_LL + 3 V_LN + 1 Uo + 1 freq + 1 P) |
| Blocos Modbus | 1 (contíguo) |
| Pontos BI (proteções) | 0 (V2) |
| Pontos BO (comandos) | 0 (V2) |
| Tempo de leitura estimado | ~50 ms (1 transação Modbus pequena) |
| Cabe junto com outros devices? | Sim, slave ID único + RS485 OK |

### 10.3 Teste de bancada — pendente

| Etapa | Status |
|---|---|
| 1. Configurar parity None no eSetup | ⏳ pendente |
| 2. Criar diagrama BANCADA-P3U30 na UI | ⏳ pendente |
| 3. Gerar + gravar firmware via USB | ⏳ pendente |
| 4. Validar leituras vs display | ⏳ pendente |
| 5. Cross-check via mosquitto_sub | ⏳ pendente |
| 6. Documentar valores observados aqui | ⏳ pendente |

### 10.4 Métricas pós-teste (preencher após bancada)

| Métrica | Esperado | Real |
|---|---|---|
| Latência sample-publish | ~60s | ? |
| Taxa de erros Modbus | < 1% | ? |
| Diferença leitura MQTT vs display físico | ≤ 1% | ? |
| Valores estáveis com TPs/TCs alimentados | sim | ? |

---

## Apêndice — referências cruzadas

### Arquivos modificados nesta sessão

- [AupusNexOn/public/iot-device-catalog.v2.js](../AupusNexOn/public/iot-device-catalog.v2.js) — bloco `'schneider-p3u30'` adicionado
- [AupusNexOn/src/features/supervisorio/components/iot-diagram.tsx](../AupusNexOn/src/features/supervisorio/components/iot-diagram.tsx) — bump `IOT_SCRIPTS_VERSION`

### Arquivos de referência (sem modificação)

- `/var/www/iot_nexon/mapa_modbus/SCHNEIDER/P3_EN_CM_30-208A_web.pdf` — manual de comunicação (25 páginas)
- `/var/www/iot_nexon/mapa_modbus/SCHNEIDER/P3U_en_Q_A003.pdf` — manual técnico geral (42 páginas)
- `/var/www/iot_nexon/mapa_modbus/SCHNEIDER/P3U30 Relatório de configurações *.pdf` — 6 exports do eSetup (potencial fonte de pontos pra V2)

### Schema do banco

```sql
SELECT id, fabricante, modelo, protocolo,
       mapeamento->>'catalog_id' AS catalog_id,
       jsonb_array_length(mapeamento->'ai_blocks') AS blocos,
       (SELECT count(*) FROM jsonb_object_keys(mapeamento->'ai_map')) AS ai_pontos
FROM iot_device_modelos
WHERE fabricante='Schneider' AND modelo='P3U30';

-- Resultado: id=1be232e710bd379bd7b454ecd6, catalog_id=schneider-p3u30, blocos=1, ai_pontos=13
```

### Documentos relacionados nesta pasta

- [IOT-RS485-MELHORIAS.md](IOT-RS485-MELHORIAS.md) — melhorias gerais RS485 (cabeamento, drain, retry)
- [IOT-MQTT-CLIENTID-UNICO.md](IOT-MQTT-CLIENTID-UNICO.md) — client_id MAC (relevante pra TON da bancada)
- [IOT-NEXON-EQUATORIAL-FALTA-ENERGIA.md](IOT-NEXON-EQUATORIAL-FALTA-ENERGIA.md) — integração futura usando f27 do P3U30 (V2)
- [DEPLOY.md](DEPLOY.md) — processo de deploy usado nesta sessão

### Commit desta sessão

```
617405b feat(iot-catalog): cadastra Schneider P3U30 (rele de protecao)
```

Push pendente (token GitHub expirado, vide DEPLOY.md Apêndice B).
