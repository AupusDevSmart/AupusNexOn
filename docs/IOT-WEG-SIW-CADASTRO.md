# Cadastro WEG SIW400 / SIW500H no Catálogo IoT

**Data**: 2026-06-09
**Status**: **implementado e deployado** — aguardando validação dos valores em campo
**Commit**: `ab5422a` (AupusNexOn, já em origin/main)
**Escopo**: correção do `weg-siw400` (estava com endereços/escalas errados) + criação do `weg-siw500h` (novo)

---

## 1. Descoberta-chave: WEG SIW são rebrands OEM

Os inversores **WEG SIW não usam protocolo WEG**. São fabricados por terceiros e revendidos com marca WEG. Cada modelo usa o protocolo do fabricante original:

| Modelo WEG | Fabricante real | Protocolo | Manual (em `/var/www/iot_nexon/mapa_modbus/WEG/`) |
|---|---|---|---|
| **SIW400** | GoodWe | GoodWe ModBus Protocol | `SIW400/SIW400 ST075 .pdf` (capa GoodWe) |
| **SIW500H** | Huawei | Huawei SUN2000 (Interface Definitions V3.0) | `SIW500H/SIW500H ST100.pdf` (capa Huawei) |

> ⚠️ Para o desenvolvedor: **sempre abrir o PDF antes de cadastrar** um SIW novo. O nome do arquivo diz "WEG" mas o conteúdo é GoodWe ou Huawei. Não assuma protocolo pelo fabricante da etiqueta.

---

## 2. O que estava errado no cadastro anterior

O `weg-siw400` antigo produzia lixo em campo. JSON observado:
```json
{"mppt1_i":72733.34, "mppt1_v":56706.67, "freq_rede":226966.7,
 "geracao_total":7781134, "geracao_diaria":2.588056e10, ...}
```

Três erros simultâneos:

### Erro 1 — Endereços inventados
```js
ai_blocks: [{ start: 39, count: 40, func: 0x03 }]   // ❌ reg 39 não existe no GoodWe
```
O protocolo GoodWe lê em `0x0220-0x0236` (non-MT) ou `0x0300-0x036F` (MT). `start: 39` não corresponde a nada.

### Erro 2 — Escala invertida (o mais sutil)
```js
'mppt1_v': { offset: 0, scale: 0.1, ... }   // ❌
```
**No NexON, `scale` é DIVISOR**: `valor_final = raw / scale`.
O protocolo diz "0.1V" = registrador em unidades de 0.1V → para obter Volts, **divide por 10** → `scale: 10`.
Com `scale: 0.1` o gerador faz `raw / 0.1 = raw × 10` — multiplica em vez de dividir. Daí `mppt1_v = 56706`.

> 📌 **Regra de ouro pro desenvolvedor**: se o manual diz "unidade 0.1X / gain 10", o `scale` no catálogo é o **gain** (10), nunca `0.1`. `scale` sempre divide.

### Erro 3 — Pids não-canônicos
Usava `freq_rede`, `geracao_total`, `geracao_diaria` — que **não existem** no `DEVICE_POINTS['inversor_solar']`. Por isso caíam "flat" no JSON em vez de agrupar em `power.frequency`, `energy.total_yield`, etc.

Pids canônicos corretos (vide [iot-device-catalog.v2.js:107-164](../AupusNexOn/public/iot-device-catalog.v2.js#L107)):
`total_yield`, `daily_yield`, `mppt<N>_voltage`, `string<N>_current`, `vab/vbc/vca`, `ia/ib/ic`, `freq`, `potencia_ativa`, `potencia_reativa`, `fp`, `temp_interna`, `dc_total_power`, `work_state` (bi).

---

## 3. Cadastro SIW400 (GoodWe non-MT)

**Range**: `0x0220-0x0236` (35 regs, 1 bloco). Função `0x03` (holding registers).
**Endereçamento**: direto (GoodWe **não** usa convenção Modicon `-1`). `start: 0x0220`.
**Word order**: `high_first` (manual: "2 words, high word first and low word follow").

| pid | Reg | offset | dataType | scale | Unidade origem |
|---|---|---|---|---|---|
| `total_yield` | 0x0222 | 2 | U32 | 10 | ETotal 0.1kWh |
| `mppt1_voltage` | 0x0226 | 6 | U16 | 10 | PV tracker1 0.1V |
| `mppt2_voltage` | 0x0227 | 7 | U16 | 10 | PV tracker2 0.1V |
| `string1_current` | 0x0228 | 8 | U16 | 10 | PV tracker1 0.1A |
| `string2_current` | 0x0229 | 9 | U16 | 10 | PV tracker2 0.1A |
| `vab/vbc/vca` | 0x022A-C | 10-12 | U16 | 10 | grid voltage 0.1V |
| `ia/ib/ic` | 0x022D-F | 13-15 | U16 | 10 | grid current 0.1A |
| `freq` | 0x0230 | 16 | U16 | 100 | 0.01Hz |
| `potencia_ativa` | 0x0233 | 19 | U16 | 1 | feeding power **1W (já em W)** |
| `temp_interna` | 0x0235 | 21 | **S16** | 10 | heatsink 0.1°C (signed!) |
| `daily_yield` | 0x0236 | 22 | U16 | 10 | EDay 0.1kWh |

`bi_map.work_state` → reg `0x0234` func `0x03` (0=wait, 1=normal, 2=fault).

### ⚠️ Limitação conhecida — saturação de potência
`potencia_ativa` (0x0233) é **U16 em W** → satura em **65.535 W (~65kW)**. Se o SIW400 em campo for >65kW, o valor satura/zera. Nesse caso o inversor é provavelmente **MT series** — trocar para os endereços MT (`0x0300+`: Vpv1=0x0300, Pac em 0x030D/0x0352-0353, E-Total 0x0312, E-Day 0x0320). O range MT tem Pac como I32, sem saturação.

---

## 4. Cadastro SIW500H (Huawei SUN2000)

**3 blocos**, função `0x03`. Endereçamento direto (decimal). Word order `high_first`.

| Bloco | Range | Conteúdo |
|---|---|---|
| 0 | 32016-32023 (8 regs) | PV1-PV4 voltage/current |
| 1 | 32064-32089 (26 regs) | input power, V/I AC, potências, freq, temp, status |
| 2 | 32106-32115 (10 regs) | energia acumulada + diária |

Pontos principais (22 AI):

| pid | Reg | dataType | scale | Observação |
|---|---|---|---|---|
| `mppt1-4_voltage` | 32016/18/20/22 | S16 | 10 | V gain10 |
| `string1-4_current` | 32017/19/21/23 | S16 | 100 | A gain100 |
| `dc_total_power` | 32064 | S32 | **1** | input power kW→W (vide nota) |
| `vab/vbc/vca` | 32066-68 | U16 | 10 | line voltage |
| `ia/ib/ic` | 32072/74/76 | S32 | 1000 | A gain1000 |
| `potencia_ativa` | 32080 | S32 | **1** | active power kW→W |
| `potencia_reativa` | 32082 | S32 | **1** | reactive kVar→VAr |
| `fp` | 32084 | S16 | 1000 | power factor |
| `freq` | 32085 | U16 | 100 | Hz gain100 |
| `temp_interna` | 32087 | S16 | 10 | °C gain10 (signed) |
| `total_yield` | 32106 | U32 | 100 | kWh gain100 |
| `daily_yield` | 32114 | U32 | 100 | kWh gain100 |

`bi_map.work_state` → reg `32089` func `0x03` (enum status: 0x0200 On-grid, 0x0300+ shutdown, etc — manual pág 11-12).

### 📌 Truque das potências kW→W (scale 1)
O tipo `inversor_solar` espera potência em **W**. Huawei dá Active power em **kW com gain 1000**:
```
valor_W = valor_kW × 1000 = (raw / gain) × 1000 = (raw / 1000) × 1000 = raw
→ scale = 1 (o gain 1000 cancela exatamente com a conversão kW→W)
```
Por isso `potencia_ativa`, `potencia_reativa` e `dc_total_power` usam `scale: 1`. **Não é erro** — é a álgebra do gain×conversão.

### Expansão de MPPTs
SIW500H suporta até **24 PV strings**. Cadastrado só PV1-4 (`num_mppts: 4`). Fórmula do manual: `PVn voltage = 32014+2n`, `PVn current = 32015+2n`, n=1..24. Para expandir: aumentar o bloco 0 (`count`) e adicionar `mppt5_voltage`...`mppt24_voltage` no ai_map + bump `num_mppts`/`num_strings`.

---

## 5. Como o desenvolvedor valida em campo

1. **Hard refresh** na UI (`Ctrl+Shift+R`) — pega cache buster `20260609-weg`
2. **Sinóptico → planta** → IoT → confirma que o inversor usa modelo `weg-siw400` ou `weg-siw500h`
3. **Compilar → Gravar/OTA** na TON
4. **Comparar JSON MQTT vs display físico do inversor**:
   - tensão (vab/vbc/vca) ≈ 220/380V
   - freq ≈ 60Hz
   - mppt voltage ≈ 300-800V (depende do arranjo PV)
   - potência ativa em W (ex: 50kW → `potencia_ativa: 50000`)
   - total_yield/daily_yield em kWh
5. **Se valores ainda errados**:
   - **SIW400 saturando/zero em potência** → é MT series, trocar pra range 0x0300+
   - **Valores ~10× errados** → revisar scale (lembrar: scale é DIVISOR = gain)
   - **Valores negativos onde deveria ser positivo** → trocar U16↔S16 ou U32↔S32
   - **U32 trocado (byte order)** → trocar `word_order` high_first↔low_first

---

## 6. Estado no banco / paridade

```sql
SELECT fabricante, modelo, mapeamento->>'catalog_id' AS cid,
       jsonb_array_length(mapeamento->'ai_blocks') AS blocos,
       (SELECT count(*) FROM jsonb_object_keys(mapeamento->'ai_map')) AS pts
FROM iot_device_modelos WHERE fabricante='WEG' ORDER BY modelo;
-- WEG | SIW400  | weg-siw400  | 1 | 15
-- WEG | SIW500H | weg-siw500h | 3 | 22
```

Cadastro em **paridade** DB ↔ `iot-device-catalog.v2.js`. O endpoint `GET /api/v1/iot-catalog/device-catalog.js` (backend, lê do DB) já serve ambos — a UI consome de lá, não do `.v2.js` estático.

---

## 7. Validação técnica feita nesta sessão

- `test-gen` (TCP, 2 modelos via datalogger): gerou código correto
  - SIW400: `_modbus_tcp_read(1, 0x03, 544, 23)` (544 = 0x0220) ✓
  - SIW500H: 3 blocos `32016`/`32064`/`32106` ✓
  - Decode: `mppt1_voltage = buf[6]/10`, `freq = buf[16]/100`, `total_yield` U32 high_first ✓
- `pio run -e ton`: **SUCCESS** (59s), firmware compila com ambos os modelos

---

## 8. Referências

- Manuais: `/var/www/iot_nexon/mapa_modbus/WEG/SIW400/` (GoodWe), `/SIW500H/` (Huawei)
- Catálogo: [AupusNexOn/public/iot-device-catalog.v2.js](../AupusNexOn/public/iot-device-catalog.v2.js) (busca `weg-siw400`, `weg-siw500h`)
- Contrato DEVICE_POINTS inversor_solar: mesmo arquivo, linha ~107
- Gerador TCP (refatorado p/ ai_blocks dinâmico): [iot-firmware-generator.v2.js](../AupusNexOn/public/iot-firmware-generator.v2.js) (`_genTcpInverterReader`)
- Docs relacionados: [DEPLOY.md](DEPLOY.md), demais `IOT-*.md` nesta pasta
