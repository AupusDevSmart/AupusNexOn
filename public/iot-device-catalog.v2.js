/**
 * IoT NexOn - Device Catalog
 *
 * ARQUITETURA:
 *   DEVICE_POINTS[tipo]  → Lista de pontos a solicitar (FIXO por tipo de dispositivo)
 *   DEVICE_MODELS[id]    → Mapeamento Modbus de cada ponto (VARIA por modelo)
 *
 * Tipos de ponto:
 *   AI = Analog Input  (grandezas elétricas medidas)
 *   BI = Binary Input   (estados/proteções lidas)
 *   BO = Binary Output  (comandos enviados)
 */

// ============================================================
// 1. PONTOS POR TIPO DE DISPOSITIVO (o que solicitar)
// ============================================================

var DEVICE_POINTS = {

    // --------------------------------------------------------
    // RELÉ DE PROTEÇÃO
    // --------------------------------------------------------
    rele_protecao: {
        label: 'Relé de Proteção',
        ai: [
            // Tensões
            { id: 'va', label: 'Tensão Fase A', unit: 'V', group: 'tensao' },
            { id: 'vb', label: 'Tensão Fase B', unit: 'V', group: 'tensao' },
            { id: 'vc', label: 'Tensão Fase C', unit: 'V', group: 'tensao' },
            // Correntes
            { id: 'ia', label: 'Corrente Fase A', unit: 'A', group: 'corrente' },
            { id: 'ib', label: 'Corrente Fase B', unit: 'A', group: 'corrente' },
            { id: 'ic', label: 'Corrente Fase C', unit: 'A', group: 'corrente' },
            { id: 'in', label: 'Corrente Neutro', unit: 'A', group: 'corrente' },
            // Fator de potência
            { id: 'cosfi_a', label: 'Fator Potência A', unit: '', group: 'cosfi' },
            { id: 'cosfi_b', label: 'Fator Potência B', unit: '', group: 'cosfi' },
            { id: 'cosfi_c', label: 'Fator Potência C', unit: '', group: 'cosfi' },
            // Potência
            { id: 'pa_total', label: 'Potência Ativa Total', unit: 'W', group: 'potencia' },
            { id: 'pr_total', label: 'Potência Reativa Total', unit: 'VAr', group: 'potencia' },
            // Frequência
            { id: 'freq', label: 'Frequência', unit: 'Hz', group: 'frequencia' },
        ],
        bi: [
            // Subtensão (27)
            { id: 'f27a', label: '27 Subtensão Fase A', group: '27' },
            { id: 'f27b', label: '27 Subtensão Fase B', group: '27' },
            { id: 'f27c', label: '27 Subtensão Fase C', group: '27' },
            // Sobrecorrente temporizada (51)
            { id: 'f51a', label: '51 Sobrecorrente Temp. Fase A', group: '51' },
            { id: 'f51b', label: '51 Sobrecorrente Temp. Fase B', group: '51' },
            { id: 'f51c', label: '51 Sobrecorrente Temp. Fase C', group: '51' },
            // Sobrecorrente instantânea (50)
            { id: 'f50a', label: '50 Sobrecorrente Inst. Fase A', group: '50' },
            { id: 'f50b', label: '50 Sobrecorrente Inst. Fase B', group: '50' },
            { id: 'f50c', label: '50 Sobrecorrente Inst. Fase C', group: '50' },
            // Neutro
            { id: 'f50n', label: '50N Sobrecorrente Inst. Neutro', group: '50N' },
            { id: 'f51n', label: '51N Sobrecorrente Temp. Neutro', group: '51N' },
            // Sobretensão (59)
            { id: 'f59a', label: '59 Sobretensão Fase A', group: '59' },
            { id: 'f59b', label: '59 Sobretensão Fase B', group: '59' },
            { id: 'f59c', label: '59 Sobretensão Fase C', group: '59' },
            { id: 'f59n', label: '59N Sobretensão Neutro', group: '59' },
            // Frequência (81)
            { id: 'f81', label: '81 Sub/Sobrefrequência', group: '81' },
            // Desequilíbrio (46)
            { id: 'f46', label: '46 Desequilíbrio de Corrente', group: '46' },
            // Sequência inversa (47)
            { id: 'f47', label: '47 Falta de Fase / Seq. Inversa', group: '47' },
            // Direcional (67)
            { id: 'f67a', label: '67 Direcional Fase A', group: '67' },
            { id: 'f67b', label: '67 Direcional Fase B', group: '67' },
            { id: 'f67c', label: '67 Direcional Fase C', group: '67' },
            { id: 'f67n', label: '67N Direcional Neutro', group: '67' },
            // Potência reversa (32)
            { id: 'f32a', label: '32 Potência Reversa Fase A', group: '32' },
            { id: 'f32b', label: '32 Potência Reversa Fase B', group: '32' },
            { id: 'f32c', label: '32 Potência Reversa Fase C', group: '32' },
            // Falha disjuntor (50BF)
            { id: 'fba', label: '50BF Falha de Disjuntor', group: '50BF' },
            // Bloqueio (86)
            { id: 'f86', label: '86 Bloqueio', group: '86' },
            // Sincronismo (78)
            { id: 'f78', label: '78 Sincronismo', group: '78' },
            // Estado
            { id: 'local_remoto', label: 'Local/Remoto', group: 'estado' },
            // Disjuntor
            { id: 'dj_aberto', label: 'Disjuntor Aberto/Fechado', group: 'estado' },
            { id: 'dj_bloqueado', label: 'Disjuntor Bloqueado', group: 'estado' },
            // Falha comunicação
            { id: 'falha_com', label: 'Falha de Comunicação', group: 'estado' },
        ],
        bo: [
            { id: 'cmd_fechar', label: 'Comando Fechar Disjuntor', group: 'comando' },
            { id: 'cmd_abrir', label: 'Comando Abrir Disjuntor', group: 'comando' },
            { id: 'cmd_reset', label: 'Reset Remoto', group: 'comando' },
        ],
    },

    // --------------------------------------------------------
    // INVERSOR SOLAR
    // --------------------------------------------------------
    // JSON: { info, energy, temperature, dc, voltage, current, power, status, protection, regulation, pid }
    // MPPTs e strings variam por modelo (ex: SG110CX tem 12 MPPTs, 24 strings)
    inversor_solar: {
        label: 'Inversor Solar',
        // Ordem dos grupos de JSON publicado (mesma ordem do UFV-SOLAR_POWER).
        group_order: ['info', 'energy', 'temperature', 'dc', 'voltage', 'current', 'power', 'status', 'protection', 'regulation', 'pid'],
        // Formato/posicao do timestamp e quais metadados extras incluir no topo
        publish: {
            timestamp_format: 'epoch',          // 'epoch' (number) ou 'datetime' ("DD/MM/YYYY HH:MM:SS")
            timestamp_position: 'first',         // 'first' ou 'last'
            meta_fields: ['inverter_id', 'samples'],
        },
        ai: [
            // Info
            { id: 'device_type',  label: 'Tipo de Dispositivo', unit: '', group: 'info', json: 'info.device_type', format: 'hex' },
            { id: 'nominal_power', label: 'Potência Nominal', unit: 'kW', group: 'info', json: 'info.nominal_power' },
            { id: 'output_type',  label: 'Tipo de Saída', unit: '', group: 'info', json: 'info.output_type' },
            // Energy
            { id: 'daily_yield', label: 'Geração Diária', unit: 'kWh', group: 'energy', json: 'energy.daily_yield' },
            { id: 'total_yield', label: 'Geração Total', unit: 'kWh', group: 'energy', json: 'energy.total_yield' },
            { id: 'total_running_time', label: 'Tempo Total Operação', unit: 'h', group: 'energy', json: 'energy.total_running_time' },
            { id: 'daily_running_time', label: 'Tempo Diário Operação', unit: 'min', group: 'energy', json: 'energy.daily_running_time' },
            // Potencia Aparente1 e 2: chaves com espaco/maiuscula, identicas as do UFV-SOLAR_POWER.
            // Apa.1 = U32 a partir do reg 5009 (low). Apa.2 = U32 a partir do reg 5010 (campo "deslocado" do UFV).
            { id: 'potencia_aparente',  label: 'Potência Aparente 1', unit: 'VA', group: 'energy', json: 'energy.Potencia Aparente1' },
            { id: 'potencia_aparente2', label: 'Potência Aparente 2', unit: 'VA', group: 'energy', json: 'energy.Potencia Aparente2' },
            // Temperature
            { id: 'temp_interna', label: 'Temperatura Interna', unit: '°C', group: 'temperature', json: 'temperature.internal' },
            // DC - MPPTs e Strings (quantidade definida no componente do diagrama: num_mppts, num_strings)
            { id: 'mppt_voltage', label: 'MPPT Tensão', unit: 'V', group: 'dc', per_instance: 'num_mppts', prefix: 'mppt', suffix: '_voltage' },
            { id: 'string_current', label: 'String Corrente', unit: 'A', group: 'dc', per_instance: 'num_strings', prefix: 'string', suffix: '_current' },
            { id: 'dc_total_power', label: 'Potência DC Total', unit: 'W', group: 'dc', json: 'dc.total_power' },
            // Voltage AC (fase-fase)
            { id: 'vab', label: 'Tensão A-B', unit: 'V', group: 'voltage', json: 'voltage.phase_a-b' },
            { id: 'vbc', label: 'Tensão B-C', unit: 'V', group: 'voltage', json: 'voltage.phase_b-c' },
            { id: 'vca', label: 'Tensão C-A', unit: 'V', group: 'voltage', json: 'voltage.phase_c-a' },
            // Current AC
            { id: 'ia', label: 'Corrente Fase A', unit: 'A', group: 'current', json: 'current.phase_a' },
            { id: 'ib', label: 'Corrente Fase B', unit: 'A', group: 'current', json: 'current.phase_b' },
            { id: 'ic', label: 'Corrente Fase C', unit: 'A', group: 'current', json: 'current.phase_c' },
            // Power AC
            { id: 'potencia_ativa', label: 'Potência Ativa Total', unit: 'W', group: 'power', json: 'power.active_total' },
            { id: 'potencia_reativa', label: 'Potência Reativa Total', unit: 'VAr', group: 'power', json: 'power.reactive_total' },
            { id: 'apparent_total', label: 'Potência Aparente Total', unit: 'VA', group: 'power', json: 'power.apparent_total' },
            { id: 'fp', label: 'Fator de Potência', unit: '', group: 'power', json: 'power.power_factor' },
            { id: 'freq', label: 'Frequência', unit: 'Hz', group: 'power', json: 'power.frequency' },
            // Protection
            { id: 'insulation_resistance', label: 'Resistência Isolamento', unit: 'kΩ', group: 'protection', json: 'protection.insulation_resistance' },
            { id: 'bus_voltage', label: 'Tensão Barramento', unit: 'V', group: 'protection', json: 'protection.bus_voltage' },
            // Regulation
            { id: 'nominal_reactive_power', label: 'Potência Reativa Nominal', unit: 'kVAr', group: 'regulation', json: 'regulation.nominal_reactive_power' },
            // PID
            { id: 'pid_work_state', label: 'Estado PID', unit: '', group: 'pid', json: 'pid.work_state' },
            { id: 'pid_alarm_code', label: 'PID Código de Alarme', unit: '', group: 'pid', json: 'pid.alarm_code' },
        ],
        bi: [
            { id: 'work_state', label: 'Estado de Operação', group: 'status', json: 'status.work_state' },
        ],
        bo: [],
    },

    // --------------------------------------------------------
    // MEDIDOR DE ENERGIA (Power Meter)
    // --------------------------------------------------------
    // JSON publicado (mesma estrutura do EV-PD666_USR_MQTT em producao):
    //   { phf, consumo_phf, consumo_phr, consumo_qhf, consumo_qhr,
    //     Va, Vb, Vc, Ia, Ib, Ic, FPa, FPb, FPc, Pt, Qt, St,
    //     timestamp: "DD/MM/YYYY HH:MM:SS" }
    medidor_energia: {
        label: 'Medidor de Energia',
        publish: {
            timestamp_format: 'datetime',   // string "DD/MM/YYYY HH:MM:SS"
            timestamp_position: 'last',     // timestamp no fim do JSON
            meta_fields: [],                // sem inverter_id/samples
        },
        // Sem grupos aninhados — JSON flat. A ordem dos campos no JSON segue a ordem deste array.
        ai: [
            // Energia (cumulativos + deltas no intervalo)
            { id: 'phf',          label: 'Energia Ativa Forward (acumulada)', unit: 'kWh',  json: 'phf' },
            { id: 'consumo_phf',  label: 'Consumo Ativa Forward',  unit: 'kWh',   json: 'consumo_phf' },
            { id: 'consumo_phr',  label: 'Consumo Ativa Reverse',  unit: 'kWh',   json: 'consumo_phr' },
            { id: 'consumo_qhf',  label: 'Consumo Reativa Q1',     unit: 'kvarh', json: 'consumo_qhf' },
            { id: 'consumo_qhr',  label: 'Consumo Reativa Q2',     unit: 'kvarh', json: 'consumo_qhr' },
            // Tensoes fase-neutro
            { id: 'va', label: 'Tensão Fase A', unit: 'V', json: 'Va' },
            { id: 'vb', label: 'Tensão Fase B', unit: 'V', json: 'Vb' },
            { id: 'vc', label: 'Tensão Fase C', unit: 'V', json: 'Vc' },
            // Correntes
            { id: 'ia', label: 'Corrente Fase A', unit: 'A', json: 'Ia' },
            { id: 'ib', label: 'Corrente Fase B', unit: 'A', json: 'Ib' },
            { id: 'ic', label: 'Corrente Fase C', unit: 'A', json: 'Ic' },
            // Fator de potencia por fase
            { id: 'fp_a', label: 'Fator Potência Fase A', unit: '', json: 'FPa' },
            { id: 'fp_b', label: 'Fator Potência Fase B', unit: '', json: 'FPb' },
            { id: 'fp_c', label: 'Fator Potência Fase C', unit: '', json: 'FPc' },
            // Potencia total
            { id: 'pt', label: 'Potência Ativa Total',    unit: 'W',   json: 'Pt' },
            { id: 'qt', label: 'Potência Reativa Total',  unit: 'var', json: 'Qt' },
            { id: 'st', label: 'Potência Aparente Total', unit: 'VA',  json: 'St' },
        ],
        bi: [],
        bo: [],
    },
};


// ============================================================
// 2. MODELOS - MAPEAMENTO MODBUS (onde cada ponto está)
// ============================================================

var DEVICE_MODELS = {

    // --------------------------------------------------------
    // RELÉS DE PROTEÇÃO
    // --------------------------------------------------------

    'pextron-urp6000': {
        fabricante: 'Pextron',
        modelo: 'URP6000',
        tipo: 'rele_protecao',
        protocolo: 'tcp_usr',  // Modbus TCP via conversor USR
        connection_note: 'RS485 via conversor USR-W610 (Modbus TCP ↔ RTU)',
        // Escalas (RTP=1, RTC=1)
        scales: {
            voltage: 128.0,
            current: 256.0,
            power: 1280.0,
            cosfi: 256.0,
            freq: 256.0,
        },
        // Leitura em bloco: reg 700-722 (23 regs de uma vez, func 0x03)
        ai_blocks: [
            { start: 700, count: 23, func: 0x03, label: 'Analógicos principais' },
            { start: 812, count: 10, func: 0x03, label: 'DNP simplificado + energia' },
            { start: 673, count: 1, func: 0x03, label: 'Local/Remoto' },
        ],
        // Mapeamento AI: ponto → posição no bloco
        ai_map: {
            // Bloco 700-722 (offset relativo a 700)
            'ia':       { block: 0, offset: 0, scale: 'current', dataType: 'U16' },
            'ib':       { block: 0, offset: 1, scale: 'current', dataType: 'U16' },
            'ic':       { block: 0, offset: 2, scale: 'current', dataType: 'U16' },
            'in':       { block: 0, offset: 4, scale: 'current', dataType: 'U16' },
            'va':       { block: 0, offset: 5, scale: 'voltage', dataType: 'U16' },
            'vb':       { block: 0, offset: 6, scale: 'voltage', dataType: 'U16' },
            'vc':       { block: 0, offset: 7, scale: 'voltage', dataType: 'U16' },
            'freq':     { block: 0, offset: 11, scale: 'freq', dataType: 'U16' },
            'cosfi_a':  { block: 0, offset: 13, scale: 'cosfi', dataType: 'COSFI' },
            'cosfi_b':  { block: 0, offset: 14, scale: 'cosfi', dataType: 'COSFI' },
            'cosfi_c':  { block: 0, offset: 15, scale: 'cosfi', dataType: 'COSFI' },
            // Potência 32-bit (2 regs por fase) → soma = total
            'pa_total': { block: 0, offset: 17, scale: 'power', dataType: 'U32_SUM3', regs_per: 2, count: 3 },
            // Bloco 812-821
            'pr_total': { block: 1, offset: 4, scale: 4.0, dataType: 'U16' },
        },
        // Coils: leitura em bloco (func 0x01, start 0, count 53)
        bi_block: { start: 0, count: 53, func: 0x01 },
        bi_map: {
            'f27a': { coil: 2 },  'f27b': { coil: 1 },  'f27c': { coil: 0 },
            'f51a': { coil: 6 },  'f51b': { coil: 5 },  'f51c': { coil: 4 },
            'f50a': { coil: 14 }, 'f50b': { coil: 13 }, 'f50c': { coil: 12 },
            'f50n': { coil: 11 }, 'f51n': { coil: 3 },
            'f59a': { coil: 30 }, 'f59b': { coil: 29 }, 'f59c': { coil: 28 }, 'f59n': { coil: 27 },
            'f81':  { coil: 26 },
            'f46':  { coil: 23 },
            'f47':  { coil: 34 },
            'f67a': { coil: 22 }, 'f67b': { coil: 21 }, 'f67c': { coil: 20 }, 'f67n': { coil: 19 },
            'f32a': { coil: 10 }, 'f32b': { coil: 9 },  'f32c': { coil: 8 },
            'fba':  { coil: 7 },
            'f86':  { coil: 33 },
            'f78':  { coil: 32 },
            // Local/Remoto vem do registro 673 (tratado separado)
            'local_remoto': { register: 673, func: 0x03, value_map: { 0: 'LOCAL', 256: 'REMOTO' } },
        },
        // Comandos (func 0x05)
        bo_map: {
            'cmd_fechar': { coil: 0x0033, func: 0x05 },  // 51
            'cmd_abrir':  { coil: 0x0034, func: 0x05 },  // 52
            'cmd_reset':  { coil: 0x0030, func: 0x05 },  // 48
        },
        // Handshake no boot (ativa reconhecimento Modbus)
        handshake: { register: 0x0088, count: 2, func: 0x03 },
    },

    // --------------------------------------------------------
    // INVERSORES SOLARES
    // --------------------------------------------------------

    // Sungrow serie CX (SG33CX, SG40CX, SG50CX, SG75CX, SG100CX, SG110CX, etc)
    // Protocolo: Modbus RTU (RS485, 9600 8N1) ou TCP opcional
    // Datasheet: TI_20240311_Communication Protocol V1.1.66
    // NOTA: "Visit all registers by subtracting 1 from the register address"
    //       (mas ModbusMaster e ModbusRTU no ESP32 ja fazem isso automaticamente)
    // Funcao 0x04 (Input/Read-only register 3X)
    // Padronizado para bater com UFV-SOLAR_POWER (producao, em campo):
    //   - Blocos: 4999/50, 5049/40, 5089/30, 5119/35, 7012/24  (PDU = reg - 1)
    //   - Campos: mesmos que UFV (nominal_power, daily_yield, total_yield, mppt1-12_voltage, string1-24_current, etc.)
    //   - Modo avg nas leituras que variam (MPPT V, string I, DC power, tensoes/correntes AC)
    //   - Modo last nos contadores/estados (yields, tempo, potencia ativa/reativa, FP, freq, work_state)
    'sungrow-sg110cx': {
        fabricante: 'Sungrow',
        modelo: 'SG110CX',
        tipo: 'inversor_solar',
        protocolo: 'rtu',
        connection_note: 'RS485 direto (9600 8N1) ou TCP via WiNet-S',
        num_mppts: 9,
        num_strings: 18,
        // Sungrow armazena U32/S32 com WORD ORDER LITTLE-ENDIAN (low word primeiro).
        // Ou seja: para um U32 que ocupa regs N e N+1, o valor = (reg[N+1] << 16) | reg[N].
        // O default do gerador eh 'high_first' (big-endian word). Sungrow precisa override.
        word_order: 'low_first',
        // Blocos identicos aos usados em producao no UFV (arquivo UFV-SOLAR_POWER/src/main.cpp).
        // Offset em cada bloco = (registrador_datasheet - primeiro_registrador_do_bloco).
        // block 0 cobre 5000-5049 -> offset = reg - 5000
        // block 1 cobre 5050-5089 -> offset = reg - 5050
        // block 2 cobre 5090-5119 -> offset = reg - 5090
        // block 3 cobre 5120-5154 -> offset = reg - 5120
        // block 4 cobre 7013-7036 -> offset = reg - 7013  (correntes de string)
        ai_blocks: [
            { start: 4999, count: 50, func: 0x04, label: 'Regs 5000-5049: info, yields, MPPT 1-3, V/I AC, potencias, status' },
            { start: 5049, count: 40, func: 0x04, label: 'Regs 5050-5089: regulation, insulation' },
            { start: 5089, count: 30, func: 0x04, label: 'Regs 5090-5119: tempo diario, MPPT 4-6' },
            { start: 5119, count: 35, func: 0x04, label: 'Regs 5120-5154: MPPT 7-9, bus voltage, PID' },
            { start: 7012, count: 18, func: 0x04, label: 'Regs 7013-7030: strings 1-18' },
        ],
        // IMPORTANTE: scale e DIVISOR (valor_final = registrador / scale)
        // mode (opcional): 'avg'=media das N amostras | 'last'=ultima leitura | 'delta'=ultima-primeira
        ai_map: {
            // --- Bloco 0: 5000-5049 ---
            'device_type':        { block: 0, offset: 0,  scale: 1,    dataType: 'U16', mode: 'last', format: 'hex' }, // 5000 codigo
            'nominal_power':      { block: 0, offset: 1,  scale: 10,   dataType: 'U16', mode: 'last' }, // 5001 kW
            'output_type':        { block: 0, offset: 2,  scale: 1,    dataType: 'U16', mode: 'last' }, // 5002 tipo saida
            'daily_yield':        { block: 0, offset: 3,  scale: 10,   dataType: 'U16', mode: 'last' }, // 5003 kWh
            'total_yield':        { block: 0, offset: 4,  scale: 1,    dataType: 'U32', mode: 'last' }, // 5004-5005 kWh
            'total_running_time': { block: 0, offset: 6,  scale: 1,    dataType: 'U32', mode: 'last' }, // 5006-5007 h
            'temp_interna':       { block: 0, offset: 8,  scale: 10,   dataType: 'S16', mode: 'last' }, // 5008 degC
            // reg 5009-5010 publicado em DOIS lugares (igual UFV): energy.apparent_power_1 e power.apparent_total
            'potencia_aparente':  { block: 0, offset: 9,  scale: 1,    dataType: 'U32', mode: 'last' }, // energy.Potencia Aparente1 (5009-5010)
            'potencia_aparente2': { block: 0, offset: 10, scale: 1,    dataType: 'U32', mode: 'last' }, // energy.Potencia Aparente2 (5010-5011, deslocado igual UFV)
            'apparent_total':     { block: 0, offset: 9,  scale: 1,    dataType: 'U32', mode: 'last' }, // power.apparent_total
            'mppt1_voltage':      { block: 0, offset: 11, scale: 10,   dataType: 'U16', mode: 'avg'  }, // 5011
            'mppt2_voltage':      { block: 0, offset: 13, scale: 10,   dataType: 'U16', mode: 'avg'  }, // 5013
            'mppt3_voltage':      { block: 0, offset: 15, scale: 10,   dataType: 'U16', mode: 'avg'  }, // 5015
            'dc_total_power':     { block: 0, offset: 17, scale: 1,    dataType: 'U32', mode: 'avg'  }, // 5017-5018 W
            'vab':                { block: 0, offset: 19, scale: 10,   dataType: 'U16', mode: 'avg'  }, // 5019
            'vbc':                { block: 0, offset: 20, scale: 10,   dataType: 'U16', mode: 'avg'  }, // 5020
            'vca':                { block: 0, offset: 21, scale: 10,   dataType: 'U16', mode: 'avg'  }, // 5021
            'ia':                 { block: 0, offset: 22, scale: 10,   dataType: 'U16', mode: 'avg'  }, // 5022
            'ib':                 { block: 0, offset: 23, scale: 10,   dataType: 'U16', mode: 'avg'  }, // 5023
            'ic':                 { block: 0, offset: 24, scale: 10,   dataType: 'U16', mode: 'avg'  }, // 5024
            'potencia_ativa':     { block: 0, offset: 31, scale: 1,    dataType: 'U32', mode: 'last' }, // 5031-5032 W
            'potencia_reativa':   { block: 0, offset: 33, scale: 1,    dataType: 'S32', mode: 'last' }, // 5033-5034 VAr
            'fp':                 { block: 0, offset: 35, scale: 1000, dataType: 'S16', mode: 'last' }, // 5035
            'freq':               { block: 0, offset: 36, scale: 10,   dataType: 'U16', mode: 'last' }, // 5036 Hz
            'work_state':         { block: 0, offset: 38, scale: 1,    dataType: 'U16', mode: 'last' }, // 5038 codigo
            'nominal_reactive_power': { block: 0, offset: 49, scale: 10, dataType: 'U16', mode: 'last' }, // 5049 kVAr

            // --- Bloco 1: 5050-5089 ---
            'insulation_resistance': { block: 1, offset: 21, scale: 1, dataType: 'U16', mode: 'last' }, // 5071 kOhm

            // --- Bloco 2: 5090-5119 ---
            'daily_running_time': { block: 2, offset: 23, scale: 1,    dataType: 'U16', mode: 'last' }, // 5113 min
            'mppt4_voltage':      { block: 2, offset: 25, scale: 10,   dataType: 'U16', mode: 'avg'  }, // 5115
            'mppt5_voltage':      { block: 2, offset: 27, scale: 10,   dataType: 'U16', mode: 'avg'  }, // 5117
            'mppt6_voltage':      { block: 2, offset: 29, scale: 10,   dataType: 'U16', mode: 'avg'  }, // 5119

            // --- Bloco 3: 5120-5154 --- (SG110CX tem 9 MPPTs, so vai ate mppt9)
            'mppt7_voltage':      { block: 3, offset: 1,  scale: 10,   dataType: 'U16', mode: 'avg'  }, // 5121
            'mppt8_voltage':      { block: 3, offset: 3,  scale: 10,   dataType: 'U16', mode: 'avg'  }, // 5123
            'mppt9_voltage':      { block: 3, offset: 10, scale: 10,   dataType: 'U16', mode: 'avg'  }, // 5130
            'bus_voltage':        { block: 3, offset: 27, scale: 10,   dataType: 'U16', mode: 'last' }, // 5147 V
            'pid_work_state':     { block: 3, offset: 30, scale: 1,    dataType: 'U16', mode: 'last' }, // 5150
            'pid_alarm_code':     { block: 3, offset: 31, scale: 1,    dataType: 'U16', mode: 'last' }, // 5151

            // --- Bloco 4: 7013-7030 (SG110CX tem 18 strings = 9 MPPTs x 2 strings) ---
            'string1_current':  { block: 4, offset: 0,  scale: 100, dataType: 'U16', mode: 'avg' }, // 7013
            'string2_current':  { block: 4, offset: 1,  scale: 100, dataType: 'U16', mode: 'avg' },
            'string3_current':  { block: 4, offset: 2,  scale: 100, dataType: 'U16', mode: 'avg' },
            'string4_current':  { block: 4, offset: 3,  scale: 100, dataType: 'U16', mode: 'avg' },
            'string5_current':  { block: 4, offset: 4,  scale: 100, dataType: 'U16', mode: 'avg' },
            'string6_current':  { block: 4, offset: 5,  scale: 100, dataType: 'U16', mode: 'avg' },
            'string7_current':  { block: 4, offset: 6,  scale: 100, dataType: 'U16', mode: 'avg' },
            'string8_current':  { block: 4, offset: 7,  scale: 100, dataType: 'U16', mode: 'avg' },
            'string9_current':  { block: 4, offset: 8,  scale: 100, dataType: 'U16', mode: 'avg' },
            'string10_current': { block: 4, offset: 9,  scale: 100, dataType: 'U16', mode: 'avg' },
            'string11_current': { block: 4, offset: 10, scale: 100, dataType: 'U16', mode: 'avg' },
            'string12_current': { block: 4, offset: 11, scale: 100, dataType: 'U16', mode: 'avg' },
            'string13_current': { block: 4, offset: 12, scale: 100, dataType: 'U16', mode: 'avg' },
            'string14_current': { block: 4, offset: 13, scale: 100, dataType: 'U16', mode: 'avg' },
            'string15_current': { block: 4, offset: 14, scale: 100, dataType: 'U16', mode: 'avg' },
            'string16_current': { block: 4, offset: 15, scale: 100, dataType: 'U16', mode: 'avg' },
            'string17_current': { block: 4, offset: 16, scale: 100, dataType: 'U16', mode: 'avg' },
            'string18_current': { block: 4, offset: 17, scale: 100, dataType: 'U16', mode: 'avg' }, // 7030
        },
        bi_map: {
            'work_state': { register: 5038, func: 0x04 },
        },
        bo_map: {},
    },

    // SG75CX - mesmo mapa Modbus da serie CX (datasheet unico), mesmos blocos, mesmos offsets.
    // Nota: SG75CX fisicamente tem 7 MPPTs; MPPT 8/9 retornarao 0xFFFF (nao conectado).
    'sungrow-sg75cx': {
        fabricante: 'Sungrow',
        modelo: 'SG75CX',
        tipo: 'inversor_solar',
        protocolo: 'rtu',
        connection_note: 'RS485 direto (9600 8N1) ou TCP via WiNet-S. Mesmo mapa Modbus da serie CX.',
        num_mppts: 9,
        num_strings: 18,
        word_order: 'low_first',
        ai_blocks: [
            { start: 4999, count: 50, func: 0x04, label: 'Regs 5000-5049: info, yields, MPPT 1-3, V/I AC, potencias, status' },
            { start: 5049, count: 40, func: 0x04, label: 'Regs 5050-5089: regulation, insulation' },
            { start: 5089, count: 30, func: 0x04, label: 'Regs 5090-5119: tempo diario, MPPT 4-6' },
            { start: 5119, count: 35, func: 0x04, label: 'Regs 5120-5154: MPPT 7-9, bus voltage, PID' },
            { start: 7012, count: 18, func: 0x04, label: 'Regs 7013-7030: strings 1-18' },
        ],
        ai_map: {
            // --- Bloco 0: 5000-5049 ---
            'device_type':        { block: 0, offset: 0,  scale: 1,    dataType: 'U16', mode: 'last', format: 'hex' },
            'nominal_power':      { block: 0, offset: 1,  scale: 10,   dataType: 'U16', mode: 'last' },
            'output_type':        { block: 0, offset: 2,  scale: 1,    dataType: 'U16', mode: 'last' },
            'daily_yield':        { block: 0, offset: 3,  scale: 10,   dataType: 'U16', mode: 'last' },
            'total_yield':        { block: 0, offset: 4,  scale: 1,    dataType: 'U32', mode: 'last' },
            'total_running_time': { block: 0, offset: 6,  scale: 1,    dataType: 'U32', mode: 'last' },
            'temp_interna':       { block: 0, offset: 8,  scale: 10,   dataType: 'S16', mode: 'last' },
            'potencia_aparente':  { block: 0, offset: 9,  scale: 1,    dataType: 'U32', mode: 'last' },
            'potencia_aparente2': { block: 0, offset: 10, scale: 1,    dataType: 'U32', mode: 'last' },
            'apparent_total':     { block: 0, offset: 9,  scale: 1,    dataType: 'U32', mode: 'last' },
            'mppt1_voltage':      { block: 0, offset: 11, scale: 10,   dataType: 'U16', mode: 'avg'  },
            'mppt2_voltage':      { block: 0, offset: 13, scale: 10,   dataType: 'U16', mode: 'avg'  },
            'mppt3_voltage':      { block: 0, offset: 15, scale: 10,   dataType: 'U16', mode: 'avg'  },
            'dc_total_power':     { block: 0, offset: 17, scale: 1,    dataType: 'U32', mode: 'avg'  },
            'vab':                { block: 0, offset: 19, scale: 10,   dataType: 'U16', mode: 'avg'  },
            'vbc':                { block: 0, offset: 20, scale: 10,   dataType: 'U16', mode: 'avg'  },
            'vca':                { block: 0, offset: 21, scale: 10,   dataType: 'U16', mode: 'avg'  },
            'ia':                 { block: 0, offset: 22, scale: 10,   dataType: 'U16', mode: 'avg'  },
            'ib':                 { block: 0, offset: 23, scale: 10,   dataType: 'U16', mode: 'avg'  },
            'ic':                 { block: 0, offset: 24, scale: 10,   dataType: 'U16', mode: 'avg'  },
            'potencia_ativa':     { block: 0, offset: 31, scale: 1,    dataType: 'U32', mode: 'last' },
            'potencia_reativa':   { block: 0, offset: 33, scale: 1,    dataType: 'S32', mode: 'last' },
            'fp':                 { block: 0, offset: 35, scale: 1000, dataType: 'S16', mode: 'last' },
            'freq':               { block: 0, offset: 36, scale: 10,   dataType: 'U16', mode: 'last' },
            'work_state':         { block: 0, offset: 38, scale: 1,    dataType: 'U16', mode: 'last' },
            'nominal_reactive_power': { block: 0, offset: 49, scale: 10, dataType: 'U16', mode: 'last' },

            // --- Bloco 1: 5050-5089 ---
            'insulation_resistance': { block: 1, offset: 21, scale: 1, dataType: 'U16', mode: 'last' },

            // --- Bloco 2: 5090-5119 ---
            'daily_running_time': { block: 2, offset: 23, scale: 1,  dataType: 'U16', mode: 'last' },
            'mppt4_voltage':      { block: 2, offset: 25, scale: 10, dataType: 'U16', mode: 'avg'  },
            'mppt5_voltage':      { block: 2, offset: 27, scale: 10, dataType: 'U16', mode: 'avg'  },
            'mppt6_voltage':      { block: 2, offset: 29, scale: 10, dataType: 'U16', mode: 'avg'  },

            // --- Bloco 3: 5120-5154 --- (SG75CX fisicamente tem 7 MPPTs; mppt8/9 retornam 0xFFFF)
            'mppt7_voltage':      { block: 3, offset: 1,  scale: 10, dataType: 'U16', mode: 'avg'  },
            'mppt8_voltage':      { block: 3, offset: 3,  scale: 10, dataType: 'U16', mode: 'avg'  },
            'mppt9_voltage':      { block: 3, offset: 10, scale: 10, dataType: 'U16', mode: 'avg'  },
            'bus_voltage':        { block: 3, offset: 27, scale: 10, dataType: 'U16', mode: 'last' },
            'pid_work_state':     { block: 3, offset: 30, scale: 1,  dataType: 'U16', mode: 'last' },
            'pid_alarm_code':     { block: 3, offset: 31, scale: 1,  dataType: 'U16', mode: 'last' },

            // --- Bloco 4: 7013-7030 ---
            'string1_current':  { block: 4, offset: 0,  scale: 100, dataType: 'U16', mode: 'avg' },
            'string2_current':  { block: 4, offset: 1,  scale: 100, dataType: 'U16', mode: 'avg' },
            'string3_current':  { block: 4, offset: 2,  scale: 100, dataType: 'U16', mode: 'avg' },
            'string4_current':  { block: 4, offset: 3,  scale: 100, dataType: 'U16', mode: 'avg' },
            'string5_current':  { block: 4, offset: 4,  scale: 100, dataType: 'U16', mode: 'avg' },
            'string6_current':  { block: 4, offset: 5,  scale: 100, dataType: 'U16', mode: 'avg' },
            'string7_current':  { block: 4, offset: 6,  scale: 100, dataType: 'U16', mode: 'avg' },
            'string8_current':  { block: 4, offset: 7,  scale: 100, dataType: 'U16', mode: 'avg' },
            'string9_current':  { block: 4, offset: 8,  scale: 100, dataType: 'U16', mode: 'avg' },
            'string10_current': { block: 4, offset: 9,  scale: 100, dataType: 'U16', mode: 'avg' },
            'string11_current': { block: 4, offset: 10, scale: 100, dataType: 'U16', mode: 'avg' },
            'string12_current': { block: 4, offset: 11, scale: 100, dataType: 'U16', mode: 'avg' },
            'string13_current': { block: 4, offset: 12, scale: 100, dataType: 'U16', mode: 'avg' },
            'string14_current': { block: 4, offset: 13, scale: 100, dataType: 'U16', mode: 'avg' },
            'string15_current': { block: 4, offset: 14, scale: 100, dataType: 'U16', mode: 'avg' },
            'string16_current': { block: 4, offset: 15, scale: 100, dataType: 'U16', mode: 'avg' },
            'string17_current': { block: 4, offset: 16, scale: 100, dataType: 'U16', mode: 'avg' },
            'string18_current': { block: 4, offset: 17, scale: 100, dataType: 'U16', mode: 'avg' },
        },
        bi_map: {
            'work_state': { register: 5038, func: 0x04 },
        },
        bo_map: {},
    },

    'goodwe-mt': {
        fabricante: 'GoodWe',
        modelo: 'GW-MT Series',
        tipo: 'inversor_solar',
        protocolo: 'rtu',
        connection_note: 'RS485 direto',
        ai_blocks: [
            { start: 35100, count: 40, func: 0x03, label: 'Dados principais' },
        ],
        ai_map: {
            'potencia_ativa':   { block: 0, offset: 0, scale: 0.1, dataType: 'U32' },
            'geracao_total':    { block: 0, offset: 4, scale: 0.1, dataType: 'U32' },
            'freq_rede':        { block: 0, offset: 9, scale: 0.1, dataType: 'U16' },
            'va':               { block: 0, offset: 7, scale: 0.1, dataType: 'U16' },
            'mppt1_v':          { block: 0, offset: 3, scale: 0.1, dataType: 'U16' },
            'mppt1_i':          { block: 0, offset: 4, scale: 0.1, dataType: 'U16' },
            'temp_interna':     { block: 0, offset: 74, scale: 0.1, dataType: 'S16' },
        },
        bi_map: {
            'estado_operacao': { register: 35138, func: 0x03 },
        },
        bo_map: {},
    },

    'huawei-sun2000': {
        fabricante: 'Huawei',
        modelo: 'SUN2000',
        tipo: 'inversor_solar',
        protocolo: 'tcp',
        connection_note: 'Via SmartLogger TCP',
        ai_blocks: [
            { start: 32016, count: 60, func: 0x03, label: 'Dados principais' },
        ],
        ai_map: {
            'potencia_ativa':   { block: 0, offset: 62, scale: 0.001, dataType: 'S32' },
            'geracao_total':    { block: 0, offset: 48, scale: 0.01, dataType: 'U32' },
            'geracao_diaria':   { block: 0, offset: 50, scale: 0.01, dataType: 'U32' },
            'freq_rede':        { block: 0, offset: 53, scale: 0.01, dataType: 'U16' },
            'mppt1_v':          { block: 0, offset: 0, scale: 0.1, dataType: 'S16' },
            'mppt1_i':          { block: 0, offset: 1, scale: 0.01, dataType: 'S16' },
            'temp_interna':     { block: 0, offset: 71, scale: 0.1, dataType: 'S16' },
        },
        bi_map: {
            'estado_operacao': { register: 32089, func: 0x03 },
        },
        bo_map: {},
    },

    'weg-siw400': {
        fabricante: 'WEG',
        modelo: 'SIW400',
        tipo: 'inversor_solar',
        protocolo: 'tcp',
        connection_note: 'Via conversor WiFi/TCP',
        ai_blocks: [
            { start: 39, count: 40, func: 0x03, label: 'Dados principais' },
        ],
        ai_map: {
            'potencia_ativa':  { block: 0, offset: 29, scale: 0.1, dataType: 'U32' },
            'geracao_total':   { block: 0, offset: 33, scale: 0.01, dataType: 'U32' },
            'geracao_diaria':  { block: 0, offset: 31, scale: 0.01, dataType: 'U32' },
            'freq_rede':       { block: 0, offset: 37, scale: 0.01, dataType: 'U16' },
            'mppt1_v':         { block: 0, offset: 0, scale: 0.1, dataType: 'U16' },
            'mppt1_i':         { block: 0, offset: 1, scale: 0.1, dataType: 'U16' },
        },
        bi_map: {
            'estado_operacao': { register: 0, func: 0x03 },
        },
        bo_map: {},
    },

    // --------------------------------------------------------
    // MEDIDORES DE ENERGIA
    // --------------------------------------------------------

    // CHINT PD666 - referencia de producao em /var/www/iot_nexon/PLATFORMIO/SUP_PRIME/EV-PD666_USR_MQTT
    // Todos os campos sao IEEE 754 floats em 2 regs cada, big-endian word order (HIGH primeiro).
    // Escalas conforme PD666: V/=10, I/=1000, P/Q/S/=10, FP/=1000, energia=raw.
    'chint-pd666': {
        fabricante: 'CHINT',
        modelo: 'PD666',
        tipo: 'medidor_energia',
        protocolo: 'rtu',
        connection_note: 'RS485 direto ou Modbus TCP via USR. Func 0x03 (holding registers) p/ tudo.',
        ai_blocks: [
            // Bloco 0: V/I/P/Q/S/FP (regs 0x2006..0x2031, 22 floats = 44 regs)
            { start: 0x2006, count: 44, func: 0x03, label: 'V, I, P, Q, S, FP (22 floats IEEE 754)' },
            // Energias (cumulativos): cada um e' lido isolado (registradores nao contiguos)
            { start: 0x101E, count: 2, func: 0x03, label: 'PHF - Energia Ativa Forward (kWh)'  },
            { start: 0x1028, count: 2, func: 0x03, label: 'PHR - Energia Ativa Reverse (kWh)'  },
            { start: 0x1032, count: 2, func: 0x03, label: 'QHF - Energia Reativa Q1 (kvarh)'   },
            { start: 0x103C, count: 2, func: 0x03, label: 'QHR - Energia Reativa Q2 (kvarh)'   },
        ],
        ai_map: {
            // --- Bloco 0 (V/I/P/Q/S/FP) ---
            // Tensoes (offset = (reg - 0x2006))
            'va':   { block: 0, offset: 0,  scale: 10,   dataType: 'FLOAT' }, // 0x2006
            'vb':   { block: 0, offset: 2,  scale: 10,   dataType: 'FLOAT' }, // 0x2008
            'vc':   { block: 0, offset: 4,  scale: 10,   dataType: 'FLOAT' }, // 0x200A
            // Correntes
            'ia':   { block: 0, offset: 6,  scale: 1000, dataType: 'FLOAT' }, // 0x200C
            'ib':   { block: 0, offset: 8,  scale: 1000, dataType: 'FLOAT' }, // 0x200E
            'ic':   { block: 0, offset: 10, scale: 1000, dataType: 'FLOAT' }, // 0x2010
            // Potencias totais
            'pt':   { block: 0, offset: 12, scale: 10,   dataType: 'FLOAT' }, // 0x2012
            'qt':   { block: 0, offset: 20, scale: 10,   dataType: 'FLOAT' }, // 0x201A
            'st':   { block: 0, offset: 28, scale: 10,   dataType: 'FLOAT' }, // 0x2022
            // Fator de potencia por fase
            'fp_a': { block: 0, offset: 38, scale: 1000, dataType: 'FLOAT' }, // 0x202C
            'fp_b': { block: 0, offset: 40, scale: 1000, dataType: 'FLOAT' }, // 0x202E
            'fp_c': { block: 0, offset: 42, scale: 1000, dataType: 'FLOAT' }, // 0x2030

            // --- Energias (mode 'last' p/ acumulado, mode 'delta' p/ consumo no intervalo) ---
            'phf':          { block: 1, offset: 0, scale: 1, dataType: 'FLOAT', mode: 'last'  }, // PHF cumulativo
            'consumo_phf':  { block: 1, offset: 0, scale: 1, dataType: 'FLOAT', mode: 'delta', clamp_negative: true },
            'consumo_phr':  { block: 2, offset: 0, scale: 1, dataType: 'FLOAT', mode: 'delta', clamp_negative: true },
            'consumo_qhf':  { block: 3, offset: 0, scale: 1, dataType: 'FLOAT', mode: 'delta', clamp_negative: true },
            'consumo_qhr':  { block: 4, offset: 0, scale: 1, dataType: 'FLOAT', mode: 'delta', clamp_negative: true },
        },
        bi_map: {},
        bo_map: {},
    },

    // IMS M-160: registers 16-bit (uint16/int16) — NÃO IEEE 754 float.
    // Referência: /var/www/iot_nexon/PLATFORMIO/TESTES-BANCADA/M160/LORA_TX_MODBUS
    // Bloco único 37..70 (REG_START=37, REG_COUNT=34) cobre V/I/P/Q/FP/S/Energia.
    // Scales: V/=10, I/=100, FP/=1000, Energia/=1000 (sem fator TP*TC ainda).
    'ims-m160': {
        fabricante: 'IMS',
        modelo: 'M160',
        tipo: 'medidor_energia',
        protocolo: 'rtu',
        connection_note: 'RS485 direto, 9600 8N1. Registers 16-bit, não IEEE float.',
        ai_blocks: [
            { start: 37, count: 34, func: 0x03, label: 'V, I, P, Q, FP, S, Energia (37..70)' },
        ],
        ai_map: {
            // Tensões (regs 37, 38, 39 — uint16, /10)
            'va': { block: 0, offset: 0, scale: 10, dataType: 'U16' },
            'vb': { block: 0, offset: 1, scale: 10, dataType: 'U16' },
            'vc': { block: 0, offset: 2, scale: 10, dataType: 'U16' },
            // Correntes (regs 43, 44, 45 — uint16, /100)
            'ia': { block: 0, offset: 6, scale: 100, dataType: 'U16' },
            'ib': { block: 0, offset: 7, scale: 100, dataType: 'U16' },
            'ic': { block: 0, offset: 8, scale: 100, dataType: 'U16' },
            // Potência ativa (regs 46-49 — int16, pode ser negativa)
            'pa':       { block: 0, offset: 9,  scale: 1, dataType: 'S16' },
            'pb':       { block: 0, offset: 10, scale: 1, dataType: 'S16' },
            'pc':       { block: 0, offset: 11, scale: 1, dataType: 'S16' },
            'pa_total': { block: 0, offset: 12, scale: 1, dataType: 'S16' },
            // Potência reativa (regs 50-53 — int16)
            'qa':       { block: 0, offset: 13, scale: 1, dataType: 'S16' },
            'qb':       { block: 0, offset: 14, scale: 1, dataType: 'S16' },
            'qc':       { block: 0, offset: 15, scale: 1, dataType: 'S16' },
            'pr_total': { block: 0, offset: 16, scale: 1, dataType: 'S16' },
            // FP (regs 54-57 — int16, /1000)
            'fp_a':     { block: 0, offset: 17, scale: 1000, dataType: 'S16' },
            'fp_b':     { block: 0, offset: 18, scale: 1000, dataType: 'S16' },
            'fp_c':     { block: 0, offset: 19, scale: 1000, dataType: 'S16' },
            'fp_total': { block: 0, offset: 20, scale: 1000, dataType: 'S16' },
            // Potência aparente (regs 58-61 — uint16)
            'sa':       { block: 0, offset: 21, scale: 1, dataType: 'U16' },
            'sb':       { block: 0, offset: 22, scale: 1, dataType: 'U16' },
            'sc':       { block: 0, offset: 23, scale: 1, dataType: 'U16' },
            'ps_total': { block: 0, offset: 24, scale: 1, dataType: 'U16' },
            // Energias acumuladas (regs 64, 66, 68, 70 — uint16, /1000)
            // Nota: M-160 real multiplica por TP*TC. Aqui assume TP=TC=1 (medição direta).
            'energia_ativa_imp': { block: 0, offset: 27, scale: 1000, dataType: 'U16', mode: 'last' },
            'energia_ativa_exp': { block: 0, offset: 29, scale: 1000, dataType: 'U16', mode: 'last' },
            'consumo_ativa_imp': { block: 0, offset: 27, scale: 1000, dataType: 'U16', mode: 'delta', clamp_negative: true },
            'consumo_ativa_exp': { block: 0, offset: 29, scale: 1000, dataType: 'U16', mode: 'delta', clamp_negative: true },
        },
        bi_map: {},
        bo_map: {},
    },
};


// ============================================================
// 3. HELPERS
// ============================================================

/**
 * Get all models for a device type (e.g., 'rele_protecao' → [{id, fabricante, modelo, ...}])
 */
function getCatalogByType(tipo) {
    return Object.entries(DEVICE_MODELS)
        .filter(([_, m]) => m.tipo === tipo)
        .map(([id, m]) => ({ id, ...m }));
}

/**
 * Get a specific model by catalog ID
 */
function getCatalogDevice(catalogId) {
    return DEVICE_MODELS[catalogId] || null;
}

/**
 * Get the point list for a device type
 */
function getDevicePoints(tipo) {
    return DEVICE_POINTS[tipo] || null;
}

/**
 * Get all points with their Modbus mapping resolved for a specific model
 */
function getResolvedPoints(catalogId) {
    const model = DEVICE_MODELS[catalogId];
    if (!model) return null;
    const points = DEVICE_POINTS[model.tipo];
    if (!points) return null;

    return {
        ai: points.ai.map(p => ({
            ...p,
            mapping: model.ai_map?.[p.id] || null,
            mapped: !!model.ai_map?.[p.id],
        })),
        bi: points.bi.map(p => ({
            ...p,
            mapping: model.bi_map?.[p.id] || null,
            mapped: !!model.bi_map?.[p.id],
        })),
        bo: points.bo.map(p => ({
            ...p,
            mapping: model.bo_map?.[p.id] || null,
            mapped: !!model.bo_map?.[p.id],
        })),
    };
}
