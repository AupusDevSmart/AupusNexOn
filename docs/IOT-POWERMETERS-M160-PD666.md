# IOT — Power Meters M-160 (IMS) e PD666 (Chint): coerência + enriquecimento do JSON

> Estudo dos manuais × código, e o que foi alterado. Os dois medidores preenchem o
> **mesmo contrato JSON** (`DEVICE_POINTS.medidor_energia`), então toda mudança tem que
> caber nos dois. Data-base: 2026-08-26. Relacionados: [[IOT-NEXON-CONFIABILIDADE]],
> `project_m160_decimal_register`.

## 1. Os dois medidores (formatos de fundo diferentes)

| | **M-160 (IMS)** | **PD666 (Chint)** |
|---|---|---|
| Registros | **int16** (16 bits) + casa decimal dinâmica DPT/DCT/DPQ | **float IEEE-754** (32 bits, 2 regs) |
| Bloco principal | 37..70 (`REG_START=37, COUNT=34`) | 0x2006..0x2031 (44 regs = 22 floats) |
| Ligação | RS485 9600 **8N1** | 8N2 de fábrica ⚠️ setar 8N1 (igual P3U30) |
| Energia | reg 63..70 (long), lado secundário | 0x101E.. (float), lado secundário |
| Sinal de P/Q | reg 46-53 int16 **+ registrador SIGN (reg 36)** | **nativo no float** (Pt/Qt/PFt já assinados) |

Fonte: `PowerNET_M-160_GuiaRapido_P_Rev1_4.pdf` (Tabela 2) e
`CHINT_PD666/PD666-… Manual.pdf` (§ registradores 2006H..).

## 2. Conversões (do manual)

**M-160:** `V=(R/10000)·10^DPT` · `I=(R/10000)·10^DCT` · `P=(R/10000)·10^DPQ` ·
`FP=R/1000` · `F=R/100` · `E=R·TC·TP`. DPT/DCT em reg 35, DPQ/SIGN em reg 36.

**PD666 (tudo float):** `V=raw·0.1·TP` · `I=raw·0.001·TC` · `P=raw·0.1·TP·TC` ·
`FP=raw·0.001` · `F=raw·0.01` · energia float × TP·TC.

## 3. Coerência código × manual — o que está CERTO ✅

- **Endereços** (M160 37/43/49/53/61/54-56/35/36/3-4; PD666 0x2006../0x101E..): batem.
- **Casa decimal M160** (`valor=raw·10^(exp−4)`) = idêntico à fórmula do manual.
- **×TC na corrente/potência**: o catálogo do M160 diz "Medição corrente 0,5 a 5 A" (lado
  secundário) → ×TC pra virar primário. Validado em campo (2.97A×80=238A). PD666 idem.
- **Energia lado secundário ×TP·TC** nos dois.
- **Tensão sem TC** (M160) / **×TP** (PD666) — coerente. ⇒ tensão errada (caso "painel-2")
  é **config do medidor** (TP/DPT), **não** do código.

## 4. O que foi ALTERADO (2026-08-26) — aditivo, cabe nos dois

> Só adiciona campos; **não mexe** no que já funciona. **Depende de regravar firmware**
> pra fluir (nada muda nas TONs já em campo até o reflash).

### Frequência — `Freq` (Hz)
Os dois medem (faixa 45–65 Hz). Adicionada ao contrato + aos dois catálogos:
- **M160**: reg 62, `int16`, `F=R/100`. Fica **dentro** do bloco já lido (offset 25) → leitura de graça.
- **PD666**: reg **0x2044**, `float`, `F=R/100`. Fica **fora** do bloco 0 → **bloco extra** (1 leitura Modbus a mais).

### FP Total — `FPt`
Os dois têm o FP total do próprio medidor (M160 reg 57 int16 /1000; PD666 0x202A PFt float
/1000). Adicionado; a conferência passa a usar o **FP total real** em vez do "FP médio calculado".

**Arquivos:** `AupusNexOn/public/iot-device-catalog.v2.js` (contrato `medidor_energia` +
`ims-m160` + `chint-pd666`); `aupus-nexon-api/.../comissionamento.grandezas.ts` (mostra Freq/FPt).
Gerador é **data-driven** (`DEVICE_POINTS[tipo].ai` + `ai_map`) → inclui os campos novos automaticamente.

## 5. O que foi SEGURADO (só M160) — precisa de bancada antes de flashar ⚠️

Não implementei às cegas: mudam comportamento e não dá pra compilar/flashar daqui.

### 5.1 Sinal das potências (M160)
O manual **se contradiz**: lista P/Q como `int16` (assinado) MAS diz *"o sinal é obtido pelo
registrador SIGN"* (reg 36, bits `Pa Pb Pc Ps Qa Qb Qc Qs`, 1=negativo). O firmware de
referência lê `(int16_t)Pt` (assinado) e **ignora o SIGN**. Se o registro for **magnitude**,
potência **exportada/reversa apareceria positiva**.
- **Só afeta medidor bidirecional** (net-metering/export). Os M160 do parque hoje são de
  **carga** (pivô) → sempre importa → não morde. O A-966 (net-metering) usa outro caminho.
- **Teste de bancada:** medidor exportando (ou fonte com sentido invertido) → `Pt` fica
  negativo no JSON? Se **não**, aplicar o SIGN: `Pt·(Ps?−1:1)`, `Qt·(Qs?−1:1)` (Ps=bit4,
  Qs=bit0 do reg 36). PD666 **não precisa** (float nativo).

### 5.2 Energia 32-bit (M160)
Manual: energia é `long` de 4 bytes (MSB+LSB) × TC × TP. O firmware lê **só a word baixa
(16 bits)** → o acumulado (`phf`) estoura em 65535 antes do fator. O `consumo_*` (delta)
quase não sofre; o `phf` bruto sim.
- **Fix:** `dataType U16→U32`, offset −1 (lê o MSB), `high_first` (o gerador suporta U32).
- **⚠️ Migração:** no reflash o `phf` **salta** do valor truncado pro real → cuidar de spike
  de delta no backend na virada. PD666 **não precisa** (float, precisão cheia).

## 6. PM1200 (Schneider EasyLogic) — 3º power meter `[CATÁLOGO ADICIONADO 2026-08-26]`

Manual oficial: `manuais_dispositivos/SCHNEIDER_PM1200/EasyLogic_PM1000-PM1200_UserManual_NHA1696401-02_OFICIAL.pdf` (baixado do CDN Schneider). Catálogo: `schneider-pm1200`. Preenche o **mesmo contrato** `medidor_energia` (com Freq/FPt).

**Comunicação:** RS485 Modbus RTU (D1/D0), **fn 0x03**, **9600 8-E-1** default, ID configurável. Float 32-bit, 2 regs/grandeza. Tudo em `manuais...` Tabela 6-8 (individual) e 6-9 (bloco).

**Registradores (absolutos) mapeados:**
| Contrato | PM1200 | Reg | | Contrato | PM1200 | Reg |
|---|---|---|---|---|---|---|
| st | VA total | 3901 | | fp_a/b/c | PF1/2/3 | 3923/3937/3951 |
| pt | W total | 3903 | | va/vb/vc | V1/V2/V3 | 3927/3941/3955 |
| qt | VAR total | 3905 | | ia/ib/ic | A1/A2/A3 | 3929/3943/3957 |
| fp_t | PF médio | 3907 | | phf/consumo_phf | FwdWh | 3961 |
| freq | F | 3915 | | consumo_phr | RevWh | 3969 |
| | | | | consumo_qhf/qhr | Fwd/RevVARh | 3963/3971 |

Bloco 0 = 3901..3957 (58 regs contíguos, uma leitura); Bloco 1 = 3959..3973 (energias). Alternativa rápida: Total RMS block em 3001 (VA/W/VAR/PF/VLL/VLN/A/F).

**PARTICULARIDADES (estudo profundo — o que tratamos diferente):**
1. **Valores JÁ PRIMÁRIOS** — o medidor aplica CT/PT internamente (A.pri/A.sec, V.pri/V.sec). **NÃO multiplicar por TP/TC** → catálogo SEM `tp_tc`, nenhum campo com `apply_factor`. É a única exceção vs M160/PD666.
2. **Byte order configurável** no medidor: `F.Seq` no menu PROG = **4321 (Big-Endian, DEFAULT)** ou 2143 (Swapped). 4321 = `high_first` do gerador (bate sem swap). Reg **0306** reporta a ordem. → **setar F.Seq=4321** no comissionamento.
3. **Sinal nativo no float**: W<0 = corrente reversa/**exportação**; VAR<0 & PF<0 = capacitivo (lead). Sem registrador SIGN (≠ M160). FWD=import, REV=export.
4. **St (VA) é medição 3D** (√(W²+VAR²+D²), inclui distorção) — NÃO √(P²+Q²). Lemos VA direto (3901), então é o valor do medidor. (Há opção ARTH no menu.)
5. **Energia reseta no overflow** (9999k/M/G conforme power ratio; valores vão pro "OLD register") → `consumo_*` com `clamp_negative` (já usamos).

**⚠️ CONFERIR NA BANCADA (2 itens):** (a) **off-by-one do endereço** — o manual manda ler em 3901 direto (Modscan), mas o firmware pode ser 0-based (3900); se a leitura vier deslocada meia-palavra, é isso. (b) **unidade da energia** (Wh vs kWh) na 1ª leitura. Gerador é data-driven → catálogo pronto, só gerar firmware.

## 7. Log
- **2026-08-26** — Estudo dos dois manuais + coerência. Adicionados `Freq` e `FPt` ao
  contrato e aos catálogos M160/PD666 (aditivo, pendente reflash). Sinal e energia-32bit do
  M160 documentados com plano de bancada (não alterados).
- **2026-08-26** — **3º power meter: Schneider PM1200** adicionado ao catálogo
  (`schneider-pm1200`, mesmo contrato `medidor_energia`). Estudo profundo do manual oficial
  (NHA1696401): float, primário (sem TP/TC), sinal nativo, byte-order F.Seq=4321, energia
  reseta no overflow. 2 itens de bancada: off-by-one do endereço e unidade da energia.
