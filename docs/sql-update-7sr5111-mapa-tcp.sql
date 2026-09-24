-- Atualiza o cadastro do Siemens 7SR5111 para o mapa Modbus TCP DEFAULT de fabrica
-- (prints Reydisp "Edit Modbus TCP" de 20/jul — Input Registers + Inputs + Coils).
-- Substitui o espelho do 7SR10 que o rele NAO tem. PDU = addr - 30001 / - 10001 / - 1.
-- Backup do estado anterior: scratchpad backup-7sr5111-20260720-1533.json
-- Aplicar com: psql "$DBURL" -f docs/sql-update-7sr5111-mapa-tcp.sql
--   (DBURL = DATABASE_URL de aupus-nexon-api/.env sem o sufixo ?schema=...)
--
-- TRANSPORTE DUAL (tcp/rtu): a escolha e a CONEXAO no diagrama (link TCP com IP,
-- ou link RS485 com endereco Modbus). Mesmo mapa nos dois — blocos AI de 40 regs
-- (nao 80) porque o ModbusMaster do RS485 tem buffer de 64.
-- AI: 2 blocos contiguos 30160-30199 + 30200-30239 (I, V, P/Q, PF por fase, freq), INT32.
-- BI: bits ESPARSOS -> 12 blocos FC02 (endereco nao-mapeado da excecao 2).
--     CB-1 Status 10013 DOUBLE_BIT (PDU 12-13) -> dj_aberto/dj_fechado (⚠️ polaridade
--     a confirmar em bancada). Protecoes por ELEMENTO (27-1, 50-1...), nao por fase.
-- BO: CB-1 (coil 00013, PDU 12) DOUBLE_BIT -> DPC via FC15: value 1=Off/ABRE,
--     2=On/FECHA (⚠️ confirmar). Sem LED reset no mapa -> cmd_reset removido.

UPDATE iot_device_modelos SET
  mapeamento = (mapeamento - 'bi_block') || '{
    "ai_blocks": [
      { "func": 4, "start": 159, "count": 40, "label": "SIRIUS 30160-30199: correntes + tensoes" },
      { "func": 4, "start": 199, "count": 40, "label": "SIRIUS 30200-30239: P/Q/S, PF, freq" }
    ],
    "ai_map": {
      "ia":       { "block": 0, "offset": 0,  "scale": 1,    "dataType": "S32" },
      "ib":       { "block": 0, "offset": 4,  "scale": 1,    "dataType": "S32" },
      "ic":       { "block": 0, "offset": 8,  "scale": 1,    "dataType": "S32" },
      "in":       { "block": 0, "offset": 12, "scale": 1,    "dataType": "S32" },
      "va":       { "block": 0, "offset": 20, "scale": 1,    "dataType": "S32" },
      "vb":       { "block": 0, "offset": 24, "scale": 1,    "dataType": "S32" },
      "vc":       { "block": 0, "offset": 28, "scale": 1,    "dataType": "S32" },
      "pa_total": { "block": 1, "offset": 6,  "scale": 1,    "dataType": "S32" },
      "pr_total": { "block": 1, "offset": 8,  "scale": 1,    "dataType": "S32" },
      "freq":     { "block": 1, "offset": 14, "scale": 100,  "dataType": "S32" },
      "cosfi_a":  { "block": 1, "offset": 34, "scale": 1000, "dataType": "S32" },
      "cosfi_b":  { "block": 1, "offset": 36, "scale": 1000, "dataType": "S32" },
      "cosfi_c":  { "block": 1, "offset": 38, "scale": 1000, "dataType": "S32" }
    },
    "bi_blocks": [
      { "func": 2, "start": 12,  "count": 2, "label": "CB-1 Status (double-bit)" },
      { "func": 2, "start": 99,  "count": 1, "label": "27-1" },
      { "func": 2, "start": 111, "count": 1, "label": "32-1" },
      { "func": 2, "start": 126, "count": 1, "label": "46DT-1" },
      { "func": 2, "start": 144, "count": 1, "label": "47-1" },
      { "func": 2, "start": 152, "count": 1, "label": "50-1" },
      { "func": 2, "start": 178, "count": 1, "label": "50N-1" },
      { "func": 2, "start": 194, "count": 1, "label": "51-1" },
      { "func": 2, "start": 212, "count": 1, "label": "51N-1" },
      { "func": 2, "start": 220, "count": 1, "label": "59-1" },
      { "func": 2, "start": 233, "count": 1, "label": "59NIT-1" },
      { "func": 2, "start": 240, "count": 1, "label": "81-1" }
    ],
    "bi_map": {
      "dj_aberto":  { "block": 0, "bit": 0 },
      "dj_fechado": { "block": 0, "bit": 1 },
      "f27a": { "block": 1,  "bit": 0 },
      "f32a": { "block": 2,  "bit": 0 },
      "f46":  { "block": 3,  "bit": 0 },
      "f47":  { "block": 4,  "bit": 0 },
      "f50a": { "block": 5,  "bit": 0 },
      "f50n": { "block": 6,  "bit": 0 },
      "f51a": { "block": 7,  "bit": 0 },
      "f51n": { "block": 8,  "bit": 0 },
      "f59a": { "block": 9,  "bit": 0 },
      "f59n": { "block": 10, "bit": 0 },
      "f81":  { "block": 11, "bit": 0 }
    },
    "bo_map": {
      "cmd_abrir":  { "func": 15, "addr": 12, "count": 2, "value": 1 },
      "cmd_fechar": { "func": 15, "addr": 12, "count": 2, "value": 2 }
    },
    "nota_mapa": "Mapa = default de fabrica (prints Reydisp 20/jul). V/I em unidades PRIMARIAS inteiras (Scaling Primary, Mult 1); freq Mult 100; PF por fase Mult 1000. Protecoes por ELEMENTO (x-1 Operated) em bits esparsos -> 12 blocos FC02. CB-1 DOUBLE_BIT: status PDU12-13, comando DPC FC15 (1=abre/2=fecha, polaridade a confirmar). SOE: falta 30001/30002 no mapa do rele — adicionar Event Counter + Event no Reydisp p/ ativar. RTU: setar porta serial do rele p/ 9600 (bus TON) e conferir que o mapa RTU do Reydisp = mapa TCP."
  }'::jsonb,
  protocolo = 'tcp/rtu',
  connection_note = 'TCP porta 502 OU RS485 — escolha e a CONEXAO no diagrama (link TCP com IP no modal, ou link RS485 com endereco). Mapa DEFAULT de fabrica 30160+ nos dois.',
  updated_at = now()
WHERE fabricante = 'Siemens' AND modelo = '7SR5111';

-- Conferencia:
SELECT modelo, updated_at,
       mapeamento->'ai_blocks'->0->>'label' AS ai,
       jsonb_array_length(mapeamento->'bi_blocks') AS bi_blocos,
       mapeamento->'bo_map'->'cmd_fechar' AS cmd_fechar
FROM iot_device_modelos WHERE modelo = '7SR5111';
