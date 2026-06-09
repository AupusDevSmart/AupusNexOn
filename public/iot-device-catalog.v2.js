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

    // Schneider PowerLogic Easergy P3U30 - rele de protecao multifuncao.
    // Protocolo: Modbus RTU (RS485). Default fabrica 9600/8N2 (parity=None com 2 stop bits)
    // ou 9600/8E1 (Even parity). TON do gerador NexOn esta hardcoded em 8N1.
    // Manual de comunicacao: /var/www/iot_nexon/mapa_modbus/SCHNEIDER/P3_EN_CM_30-208A_web.pdf
    // Cadastro descoberto via leitura dos PDFs "Relatorio de configuracoes" do eSetup.
    //
    // ATENCAO FRAMING: P3U30 usa "11 bits sempre" (8E1, 8O1 ou 8N2). Se o relé estiver
    // em 8N2 (default com parity=None) e a TON em 8N1, framing e' incompativel —
    // o relé descarta frames silenciosamente (timeout 0xE2). Em validacao isolada
    // (TESTES-BANCADA/TESTE-SCHNEIDER-P3U30) ja se observou que comunica de qualquer
    // forma; alguns rev de firmware Schneider sao tolerantes. Confirmar empiricamente
    // se houver problema, e considerar mudar TON pra SERIAL_8N2.
    //
    // Endereco Modicon 40xxxx (holding register, func 0x03). Frame Modbus = Modicon - 400001.
    // 4 blocos cobrindo: medicoes, status/control feedback, fault data, CBM counters.
    'schneider-p3u30': {
        fabricante: 'Schneider',
        modelo: 'P3U30',
        tipo: 'rele_protecao',
        protocolo: 'rtu',
        connection_note: 'RS485 9600 (parity None=8N2 OU Even=8E1 — config eSetup). Slave 1-247.',
        word_order: 'high_first',  // default Schneider para U32
        ai_blocks: [
            // B0: medicoes basicas (correntes, tensoes, freq, P ativa)
            { start: 2008, count: 14, func: 0x03, label: 'Regs 402009-402022: I, V, freq, P' },
            // B1: status & control feedback (AR, voltage interrupt, logic/virtual outputs)
            { start: 3400, count: 26, func: 0x03, label: 'Regs 403401-403426: AR, voltage status, LOs, VOs' },
            // B2: fault data (total trips, fault currents da ultima ocorrencia, scalings)
            { start: 5500, count: 18, func: 0x03, label: 'Regs 405501-405518: total trips, fault currents' },
            // B3: CBM (circuit breaker monitoring) + DI validity
            { start: 5812, count: 13, func: 0x03, label: 'Regs 405813-405825: CBM open/trip counters, DI validity' },
        ],
        ai_map: {
            // ================================================================
            // BLOCO 0 (start=2008): MEDICOES BASICAS — regs 402009..402022
            // Scalings default Schneider (vide pag.12 do manual):
            //   - Voltage: "1000V = 1000" -> raw direto em V (scale=1)
            //   - Current: "1A = 1" -> raw direto em A (scale=1)
            //   - IN-1 residual: "1.00A = 100" -> scale=100
            //   - Uo residual: "1.0% = 10" -> scale=10
            //   - Frequency: "50.000Hz = 5000" -> scale=100
            //   - Active power: "1000kW = 1000" -> raw em kW (scale=1)
            // ================================================================
            'ia':                 { block: 0, offset: 0,  scale: 1,   dataType: 'U16', mode: 'avg' },   // 402009
            'ib':                 { block: 0, offset: 1,  scale: 1,   dataType: 'U16', mode: 'avg' },   // 402010
            'ic':                 { block: 0, offset: 2,  scale: 1,   dataType: 'U16', mode: 'avg' },   // 402011
            'in1_residual':       { block: 0, offset: 3,  scale: 100, dataType: 'U16', mode: 'avg' },   // 402012
            // offset 4 = reg 402013 (gap no manual, nao mapeado)
            'vab':                { block: 0, offset: 5,  scale: 1,   dataType: 'U16', mode: 'avg' },   // 402014
            'vbc':                { block: 0, offset: 6,  scale: 1,   dataType: 'U16', mode: 'avg' },   // 402015
            'vca':                { block: 0, offset: 7,  scale: 1,   dataType: 'U16', mode: 'avg' },   // 402016
            'va':                 { block: 0, offset: 8,  scale: 1,   dataType: 'U16', mode: 'avg' },   // 402017
            'vb':                 { block: 0, offset: 9,  scale: 1,   dataType: 'U16', mode: 'avg' },   // 402018
            'vc':                 { block: 0, offset: 10, scale: 1,   dataType: 'U16', mode: 'avg' },   // 402019
            'residual_voltage':   { block: 0, offset: 11, scale: 10,  dataType: 'U16', mode: 'avg' },   // 402020
            'freq':               { block: 0, offset: 12, scale: 100, dataType: 'U16', mode: 'last' },  // 402021
            'potencia_ativa':     { block: 0, offset: 13, scale: 1,   dataType: 'U16', mode: 'last' },  // 402022

            // ================================================================
            // BLOCO 1 (start=3400): STATUS & CONTROL FEEDBACK — regs 403401..403426
            // Todos U16. Inteiros sem scaling (raw e' o codigo/contador/bitmap).
            // ================================================================
            // offset 0 = 403401 (reserved/gap)
            'ar_shot_number':         { block: 1, offset: 1,  scale: 1, dataType: 'U16', mode: 'last' },  // 403402 (1..5, 6=END)
            'critical_ar_req':        { block: 1, offset: 2,  scale: 1, dataType: 'U16', mode: 'last' },  // 403403
            'ar_locked':              { block: 1, offset: 3,  scale: 1, dataType: 'U16', mode: 'last' },  // 403404
            'ar_running':             { block: 1, offset: 4,  scale: 1, dataType: 'U16', mode: 'last' },  // 403405
            'final_trip':             { block: 1, offset: 5,  scale: 1, dataType: 'U16', mode: 'last' },  // 403406
            'auto_recloser_on':       { block: 1, offset: 6,  scale: 1, dataType: 'U16', mode: 'last' },  // 403407
            // offset 7..11 = 403408..403412 (reserved/gap)
            // FONTE ALTERNATIVA pra deteccao de "falta de energia" alem dos bits de protecao:
            //   voltage_interrupt = 0 (LOW = sem energia) | 1 (OK = com energia)
            //   pode ser usado pelo detector da integracao Equatorial sem precisar
            //   mapear f27 nos bits de protecao do bloco 406xxx.
            'voltage_interrupt':      { block: 1, offset: 12, scale: 1, dataType: 'U16', mode: 'last' },  // 403413
            // voltage_status: codigos 0..7 (OK=0, LOW=1, HIGH=2, LOW/HIGH=3, ...)
            'voltage_status':         { block: 1, offset: 13, scale: 1, dataType: 'U16', mode: 'last' },  // 403414
            'timer1_status':          { block: 1, offset: 14, scale: 1, dataType: 'U16', mode: 'last' },  // 403415
            'timer2_status':          { block: 1, offset: 15, scale: 1, dataType: 'U16', mode: 'last' },  // 403416
            'timer3_status':          { block: 1, offset: 16, scale: 1, dataType: 'U16', mode: 'last' },  // 403417
            'timer4_status':          { block: 1, offset: 17, scale: 1, dataType: 'U16', mode: 'last' },  // 403418
            // bitmap dos LO (Logic Outputs) configurados no rele — bits mudam quando
            // VI->LO mapeado na MATRIX dispara. Util pra feedback dos comandos.
            'logic_outputs_1_10':     { block: 1, offset: 18, scale: 1, dataType: 'U16', mode: 'last' },  // 403419
            'cbw_alarm_1':            { block: 1, offset: 19, scale: 1, dataType: 'U16', mode: 'last' },  // 403420
            'cbw_alarm_2':            { block: 1, offset: 20, scale: 1, dataType: 'U16', mode: 'last' },  // 403421
            'logic_outputs_9_16':     { block: 1, offset: 21, scale: 1, dataType: 'U16', mode: 'last' },  // 403422
            'logic_outputs_17_20':    { block: 1, offset: 22, scale: 1, dataType: 'U16', mode: 'last' },  // 403423
            // offset 23..24 = 403424..403425 (reserved)
            // Virtual outputs: bitmap dos VOs (controlados via logica programada).
            'virtual_outputs_1_16':   { block: 1, offset: 25, scale: 1, dataType: 'U16', mode: 'last' },  // 403426

            // ================================================================
            // BLOCO 2 (start=5500): FAULT DATA — regs 405501..405518
            // Memoria da ultima falta (zera so com novo evento).
            // ================================================================
            'total_trips':            { block: 2, offset: 0,  scale: 1,   dataType: 'U16', mode: 'last' },  // 405501
            // offset 1..3 = 405502..405504 (reserved no manual)
            // Fault currents sao U32 (2 regs cada). Manual: "1A = 1" -> scale=1.
            'il1_fault_current':      { block: 2, offset: 4,  scale: 1,   dataType: 'U32', mode: 'last' },  // 405505-505506
            'il2_fault_current':      { block: 2, offset: 6,  scale: 1,   dataType: 'U32', mode: 'last' },  // 405507-505508
            'il3_fault_current':      { block: 2, offset: 8,  scale: 1,   dataType: 'U32', mode: 'last' },  // 405509-505510
            // Io fault currents: "1.00A = 100" -> scale=100
            'io1_fault_current':      { block: 2, offset: 10, scale: 100, dataType: 'U32', mode: 'last' },  // 405511-405512
            'io2_fault_current':      { block: 2, offset: 12, scale: 100, dataType: 'U32', mode: 'last' },  // 405513-405514
            'iocalc_fault_current':   { block: 2, offset: 14, scale: 100, dataType: 'U32', mode: 'last' },  // 405515-405516
            // Modbus scalings configurados no proprio rele (informativos pro nosso decoder
            // saber se operador mudou os defaults).
            'mb_power_scaling':       { block: 2, offset: 16, scale: 10,  dataType: 'U16', mode: 'last' },  // 405517
            'mb_pf_scaling':          { block: 2, offset: 17, scale: 10,  dataType: 'U16', mode: 'last' },  // 405518

            // ================================================================
            // BLOCO 3 (start=5812): CBM (Circuit Breaker Monitoring) + DI VALIDITY
            // ================================================================
            // CBM counters: U32 (2 regs cada). Crescem com operacoes do disjuntor.
            'cbm_open_count':         { block: 3, offset: 0,  scale: 1, dataType: 'U32', mode: 'last' },  // 405813-405814
            // offset 2..3 = 405815..405816 (reserved/gap)
            'cbm_trip_counter':       { block: 3, offset: 4,  scale: 1, dataType: 'U32', mode: 'last' },  // 405817-405818
            // offset 6..7 = 405819..405820 (reserved/gap)
            // DI validity (4 regs = 64 bits) indica quais DIs estao "OK" (validade fisica).
            // Mapeado como 4 U16 separados pra simplicidade.
            'di_validity_1':          { block: 3, offset: 8,  scale: 1, dataType: 'U16', mode: 'last' },  // 405821
            'di_validity_2':          { block: 3, offset: 9,  scale: 1, dataType: 'U16', mode: 'last' },  // 405822
            'di_validity_3':          { block: 3, offset: 10, scale: 1, dataType: 'U16', mode: 'last' },  // 405823
            'di_validity_4':          { block: 3, offset: 11, scale: 1, dataType: 'U16', mode: 'last' },  // 405824
            // offset 12 = 405825 (CBM1 cnt ph A bin 1 — start dos CBM bins, nao mapeados aqui)
        },
        // bi_map (protecoes via bit-level) a cadastrar em V2.
        // Quando vier, precisara' usar bit-level decoding (ja' suportado pelo gerador).
        // Bits ANSI 27/50/59 etc estao em 406xxx (slave 406001->).
        bi_map: {},
        // ================================================================
        // COMANDOS REMOTOS — Object control direto (SBO: Select-Before-Operate)
        // ================================================================
        // Schneider P3U30 suporta ate 8 Objects (disjuntores controlaveis). Padrao
        // industrial de protecao: 2 writes sequenciais por comando ("Open select"
        // seguido de "Execute operation"), pra evitar trip acidental por frame
        // corrompido. Se Execute nao chegar em ~30s, rele cancela a selecao sozinho.
        //
        // Endereco (Modicon -> frame):
        //   Obj1: Open=402508(2507) Close=402509(2508) Execute=402510(2509)
        //   Obj2: Open=402512(2511) Close=402513(2512) Execute=402514(2513)
        //   Obj3: Open=402517(2516) Close=402518(2517) Execute=402519(2518)
        //   Obj4: Open=402521(2520) Close=402522(2521) Execute=402523(2522)
        //   Obj5: Open=402527(2526) Close=402528(2527) Execute=402529(2528)
        //   Obj6: Open=402531(2530) Close=402532(2531) Execute=402533(2532)
        //   Obj7: Open=402538(2537) Close=402539(2538) Execute=402540(2539)
        //   Obj8: Open=402542(2541) Close=402543(2542) Execute=402544(2543)
        //
        // Especiais (single-write):
        //   Release latches:        402501 (2500) — reset alarmes
        //   Cancel selected op:     402516 (2515) — desfaz selecao pendente
        //   Reset diagnostics:      402535 (2534)
        //   Clear min&max:          402536 (2535)
        //
        // Pre-requisito unico no rele: CONTROLE > Object N > Control mode = Remote.
        // NAO exige Matrix configurada — vai direto pro Object control.
        //
        // Gerador suporta multi-write via campo `steps` desde v1.5.0-sbo (delay_ms
        // opcional entre steps, default 0). Backward compat: cmds simples sem `steps`
        // continuam funcionando (single-write 0x05 ou 0x06).
        bo_map: {
            // ----- Obj1 -----
            'cmd_open_obj1':  { steps: [
                { register: 2507, value: 1, func: 0x06 },   // Open select Obj1
                { register: 2509, value: 1, func: 0x06 },   // Execute operation Obj1
            ], delay_ms: 50 },
            'cmd_close_obj1': { steps: [
                { register: 2508, value: 1, func: 0x06 },   // Close select Obj1
                { register: 2509, value: 1, func: 0x06 },   // Execute operation Obj1
            ], delay_ms: 50 },

            // ----- Obj2 -----
            'cmd_open_obj2':  { steps: [
                { register: 2511, value: 1, func: 0x06 },
                { register: 2513, value: 1, func: 0x06 },
            ], delay_ms: 50 },
            'cmd_close_obj2': { steps: [
                { register: 2512, value: 1, func: 0x06 },
                { register: 2513, value: 1, func: 0x06 },
            ], delay_ms: 50 },

            // ----- Obj3 -----
            'cmd_open_obj3':  { steps: [
                { register: 2516, value: 1, func: 0x06 },
                { register: 2518, value: 1, func: 0x06 },
            ], delay_ms: 50 },
            'cmd_close_obj3': { steps: [
                { register: 2517, value: 1, func: 0x06 },
                { register: 2518, value: 1, func: 0x06 },
            ], delay_ms: 50 },

            // ----- Obj4 -----
            'cmd_open_obj4':  { steps: [
                { register: 2520, value: 1, func: 0x06 },
                { register: 2522, value: 1, func: 0x06 },
            ], delay_ms: 50 },
            'cmd_close_obj4': { steps: [
                { register: 2521, value: 1, func: 0x06 },
                { register: 2522, value: 1, func: 0x06 },
            ], delay_ms: 50 },

            // ----- Obj5 -----
            'cmd_open_obj5':  { steps: [
                { register: 2526, value: 1, func: 0x06 },
                { register: 2528, value: 1, func: 0x06 },
            ], delay_ms: 50 },
            'cmd_close_obj5': { steps: [
                { register: 2527, value: 1, func: 0x06 },
                { register: 2528, value: 1, func: 0x06 },
            ], delay_ms: 50 },

            // ----- Obj6 -----
            'cmd_open_obj6':  { steps: [
                { register: 2530, value: 1, func: 0x06 },
                { register: 2532, value: 1, func: 0x06 },
            ], delay_ms: 50 },
            'cmd_close_obj6': { steps: [
                { register: 2531, value: 1, func: 0x06 },
                { register: 2532, value: 1, func: 0x06 },
            ], delay_ms: 50 },

            // ----- Obj7 -----
            'cmd_open_obj7':  { steps: [
                { register: 2537, value: 1, func: 0x06 },
                { register: 2539, value: 1, func: 0x06 },
            ], delay_ms: 50 },
            'cmd_close_obj7': { steps: [
                { register: 2538, value: 1, func: 0x06 },
                { register: 2539, value: 1, func: 0x06 },
            ], delay_ms: 50 },

            // ----- Obj8 -----
            'cmd_open_obj8':  { steps: [
                { register: 2541, value: 1, func: 0x06 },
                { register: 2543, value: 1, func: 0x06 },
            ], delay_ms: 50 },
            'cmd_close_obj8': { steps: [
                { register: 2542, value: 1, func: 0x06 },
                { register: 2543, value: 1, func: 0x06 },
            ], delay_ms: 50 },

            // ----- Comandos especiais (single-write) -----
            'cmd_release_latches':   { register: 2500, value: 1, func: 0x06 },  // 402501
            'cmd_cancel_operation':  { register: 2515, value: 1, func: 0x06 },  // 402516
            'cmd_reset_diagnostics': { register: 2534, value: 1, func: 0x06 },  // 402535
            'cmd_clear_min_max':     { register: 2535, value: 1, func: 0x06 },  // 402536

            // ----- Aliases legados (apontam pra Obj1, p/ compat com integradores que
            // ja usavam cmd_trip/cmd_close do v1.4.x) -----
            'cmd_trip':  { steps: [
                { register: 2507, value: 1, func: 0x06 },   // alias de cmd_open_obj1
                { register: 2509, value: 1, func: 0x06 },
            ], delay_ms: 50 },
            'cmd_close': { steps: [
                { register: 2508, value: 1, func: 0x06 },   // alias de cmd_close_obj1
                { register: 2509, value: 1, func: 0x06 },
            ], delay_ms: 50 },
            'cmd_reset': { register: 2500, value: 1, func: 0x06 },  // alias de cmd_release_latches
        },
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

    'sungrow-sg250cx': {
        fabricante: 'Sungrow',
        modelo: 'SG250CX',
        tipo: 'inversor_solar',
        protocolo: 'rtu',
        connection_note: 'RS485 direto (9600 8N1) ou TCP via WiNet-S',
        num_mppts: 12,
        num_strings: 24,
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

    // SG333HX - serie HX (1500V). Mesmo mapa Modbus da serie CX nos blocos 0-3, mas tem
    // 12 MPPTs e 24 strings (vs 9 MPPTs / 18 strings do SG250CX). Block 4 estende ate 7036.
    'sungrow-sg333hx': {
        fabricante: 'Sungrow',
        modelo: 'SG333HX',
        tipo: 'inversor_solar',
        protocolo: 'rtu',
        connection_note: 'RS485 direto (9600 8N1) ou TCP via WiNet-S. 12 MPPTs / 24 strings.',
        num_mppts: 12,
        num_strings: 24,
        word_order: 'low_first',
        ai_blocks: [
            { start: 4999, count: 50, func: 0x04, label: 'Regs 5000-5049: info, yields, MPPT 1-3, V/I AC, potencias, status' },
            { start: 5049, count: 40, func: 0x04, label: 'Regs 5050-5089: regulation, insulation' },
            { start: 5089, count: 30, func: 0x04, label: 'Regs 5090-5119: tempo diario, MPPT 4-6' },
            { start: 5119, count: 35, func: 0x04, label: 'Regs 5120-5154: MPPT 7-12, bus voltage, PID' },
            { start: 7012, count: 24, func: 0x04, label: 'Regs 7013-7036: strings 1-24' },
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

            // --- Bloco 3: 5120-5154 --- (SG333HX tem 12 MPPTs)
            'mppt7_voltage':      { block: 3, offset: 1,  scale: 10, dataType: 'U16', mode: 'avg'  },
            'mppt8_voltage':      { block: 3, offset: 3,  scale: 10, dataType: 'U16', mode: 'avg'  },
            'mppt9_voltage':      { block: 3, offset: 10, scale: 10, dataType: 'U16', mode: 'avg'  },
            'mppt10_voltage':     { block: 3, offset: 12, scale: 10, dataType: 'U16', mode: 'avg'  },
            'mppt11_voltage':     { block: 3, offset: 14, scale: 10, dataType: 'U16', mode: 'avg'  },
            'mppt12_voltage':     { block: 3, offset: 16, scale: 10, dataType: 'U16', mode: 'avg'  },
            'bus_voltage':        { block: 3, offset: 27, scale: 10, dataType: 'U16', mode: 'last' },
            'pid_work_state':     { block: 3, offset: 30, scale: 1,  dataType: 'U16', mode: 'last' },
            'pid_alarm_code':     { block: 3, offset: 31, scale: 1,  dataType: 'U16', mode: 'last' },

            // --- Bloco 4: 7013-7036 (24 strings) ---
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
            'string19_current': { block: 4, offset: 18, scale: 100, dataType: 'U16', mode: 'avg' },
            'string20_current': { block: 4, offset: 19, scale: 100, dataType: 'U16', mode: 'avg' },
            'string21_current': { block: 4, offset: 20, scale: 100, dataType: 'U16', mode: 'avg' },
            'string22_current': { block: 4, offset: 21, scale: 100, dataType: 'U16', mode: 'avg' },
            'string23_current': { block: 4, offset: 22, scale: 100, dataType: 'U16', mode: 'avg' },
            'string24_current': { block: 4, offset: 23, scale: 100, dataType: 'U16', mode: 'avg' },
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

    // Huawei SUN2000-100KTL M1 - protocolo Huawei "Solar Inverter Modbus Interface
    // Definitions V3.0" (mesmo manual do WEG SIW500H, que e' rebrand Huawei).
    // Manual: /var/www/iot_nexon/mapa_modbus/WEG/SIW500H/SIW500H ST100.pdf
    // Endereco direto (Huawei nao usa convencao Modicon; frame addr = register addr decimal).
    // word_order high_first (padrao Huawei SUN2000 para U32/I32).
    // "Gain" Huawei = divisor (valor_real = raw / gain). Ex: V gain 10 -> raw/10.
    // Potencias em kW/kVar: convertidas pra W/VAr (scale=1 ja' que gain1000 cancela com x1000).
    // SUN2000-100KTL M1: 10 MPPTs (PV1-PV10) com 2 strings cada (20 strings totais).
    'huawei-sun2000': {
        fabricante: 'Huawei',
        modelo: 'SUN2000-100KTL M1',
        tipo: 'inversor_solar',
        protocolo: 'tcp',
        connection_note: 'Via SmartLogger TCP. Regs 32016+, 32064+, 32106+.',
        word_order: 'high_first',
        num_mppts: 10,
        num_strings: 20,
        ai_blocks: [
            // Bloco 0: PV1-PV10 voltage/current (32016-32035, 20 regs)
            { start: 32016, count: 20, func: 0x03, label: 'Regs 32016-32035: PV1-10 V/I' },
            // Bloco 1: input power -> device status (32064-32089, 26 regs)
            { start: 32064, count: 26, func: 0x03, label: 'Regs 32064-32089: P, V, I, freq, temp, status' },
            // Bloco 2: energia acumulada e diaria (32106-32115, 10 regs)
            { start: 32106, count: 10, func: 0x03, label: 'Regs 32106-32115: energia total e diaria' },
        ],
        ai_map: {
            // --- Bloco 0: PV1-PV10 (offset 0 = 32016) ---
            // PVn voltage I16 V gain10; PVn current I16 A gain100.
            // Nota: Huawei expoe um par V/I por entrada. SUN2000-100KTL M1 tem 10 MPPTs
            // com 2 strings cada — Modbus expoe a corrente combinada da string monitorada.
            'mppt1_voltage':    { block: 0, offset: 0,  scale: 10,  dataType: 'S16', mode: 'avg' }, // 32016
            'string1_current':  { block: 0, offset: 1,  scale: 100, dataType: 'S16', mode: 'avg' }, // 32017
            'mppt2_voltage':    { block: 0, offset: 2,  scale: 10,  dataType: 'S16', mode: 'avg' }, // 32018
            'string2_current':  { block: 0, offset: 3,  scale: 100, dataType: 'S16', mode: 'avg' }, // 32019
            'mppt3_voltage':    { block: 0, offset: 4,  scale: 10,  dataType: 'S16', mode: 'avg' }, // 32020
            'string3_current':  { block: 0, offset: 5,  scale: 100, dataType: 'S16', mode: 'avg' }, // 32021
            'mppt4_voltage':    { block: 0, offset: 6,  scale: 10,  dataType: 'S16', mode: 'avg' }, // 32022
            'string4_current':  { block: 0, offset: 7,  scale: 100, dataType: 'S16', mode: 'avg' }, // 32023
            'mppt5_voltage':    { block: 0, offset: 8,  scale: 10,  dataType: 'S16', mode: 'avg' }, // 32024
            'string5_current':  { block: 0, offset: 9,  scale: 100, dataType: 'S16', mode: 'avg' }, // 32025
            'mppt6_voltage':    { block: 0, offset: 10, scale: 10,  dataType: 'S16', mode: 'avg' }, // 32026
            'string6_current':  { block: 0, offset: 11, scale: 100, dataType: 'S16', mode: 'avg' }, // 32027
            'mppt7_voltage':    { block: 0, offset: 12, scale: 10,  dataType: 'S16', mode: 'avg' }, // 32028
            'string7_current':  { block: 0, offset: 13, scale: 100, dataType: 'S16', mode: 'avg' }, // 32029
            'mppt8_voltage':    { block: 0, offset: 14, scale: 10,  dataType: 'S16', mode: 'avg' }, // 32030
            'string8_current':  { block: 0, offset: 15, scale: 100, dataType: 'S16', mode: 'avg' }, // 32031
            'mppt9_voltage':    { block: 0, offset: 16, scale: 10,  dataType: 'S16', mode: 'avg' }, // 32032
            'string9_current':  { block: 0, offset: 17, scale: 100, dataType: 'S16', mode: 'avg' }, // 32033
            'mppt10_voltage':   { block: 0, offset: 18, scale: 10,  dataType: 'S16', mode: 'avg' }, // 32034
            'string10_current': { block: 0, offset: 19, scale: 100, dataType: 'S16', mode: 'avg' }, // 32035

            // --- Bloco 1: principais (offset 0 = 32064) ---
            // 32064 Input power I32 kW gain1000 -> dc_total_power em W (scale 1)
            'dc_total_power':   { block: 1, offset: 0,  scale: 1,    dataType: 'S32', mode: 'avg'  }, // 32064-32065
            // 32066-32068 Line voltage A-B/B-C/C-A U16 V gain10 -> vab/vbc/vca
            'vab':              { block: 1, offset: 2,  scale: 10,   dataType: 'U16', mode: 'avg'  }, // 32066
            'vbc':              { block: 1, offset: 3,  scale: 10,   dataType: 'U16', mode: 'avg'  }, // 32067
            'vca':              { block: 1, offset: 4,  scale: 10,   dataType: 'U16', mode: 'avg'  }, // 32068
            // 32072/32074/32076 Phase A/B/C current I32 A gain1000 -> ia/ib/ic
            'ia':               { block: 1, offset: 8,  scale: 1000, dataType: 'S32', mode: 'avg'  }, // 32072-32073
            'ib':               { block: 1, offset: 10, scale: 1000, dataType: 'S32', mode: 'avg'  }, // 32074-32075
            'ic':               { block: 1, offset: 12, scale: 1000, dataType: 'S32', mode: 'avg'  }, // 32076-32077
            // 32080 Active power I32 kW gain1000 -> potencia_ativa em W (scale 1)
            'potencia_ativa':   { block: 1, offset: 16, scale: 1,    dataType: 'S32', mode: 'last' }, // 32080-32081
            // 32082 Reactive power I32 kVar gain1000 -> potencia_reativa em VAr (scale 1)
            'potencia_reativa': { block: 1, offset: 18, scale: 1,    dataType: 'S32', mode: 'last' }, // 32082-32083
            // 32084 Power factor I16 gain1000 -> fp
            'fp':               { block: 1, offset: 20, scale: 1000, dataType: 'S16', mode: 'last' }, // 32084
            // 32085 Grid frequency U16 Hz gain100 -> freq
            'freq':             { block: 1, offset: 21, scale: 100,  dataType: 'U16', mode: 'last' }, // 32085
            // 32087 Internal temperature I16 C gain10 -> temp_interna
            'temp_interna':     { block: 1, offset: 23, scale: 10,   dataType: 'S16', mode: 'last' }, // 32087

            // --- Bloco 2: energia (offset 0 = 32106) ---
            // 32106 Accumulated energy yield U32 kWh gain100 -> total_yield
            'total_yield':      { block: 2, offset: 0, scale: 100, dataType: 'U32', mode: 'last' }, // 32106-32107
            // 32114 Daily energy yield U32 kWh gain100 -> daily_yield
            'daily_yield':      { block: 2, offset: 8, scale: 100, dataType: 'U32', mode: 'last' }, // 32114-32115
        },
        bi_map: {
            // 32089 Device status (enum 0x0000..0x0A00, vide manual pag 11-12)
            'work_state': { register: 32089, func: 0x03 },
        },
        bo_map: {},
    },

    // WEG SIW400 - inversor rebrand GoodWe (protocolo GoodWe ModBus).
    // Manual: /var/www/iot_nexon/mapa_modbus/WEG/SIW400/SIW400 ST075 .pdf (= GoodWe protocol)
    // ATENCAO: cadastro anterior (start=39, scale 0.1) estava TOTALMENTE errado —
    // enderecos inventados + escala invertida (no NexON scale e' DIVISOR, nao multiplicador).
    // Corrigido em 2026-06-09 com base no protocolo GoodWe real.
    //
    // Endereco direto (GoodWe nao usa convencao Modicon -1; frame addr = register addr).
    // Range de leitura non-MT series: 0x0220-0x0236 (modelos menores, 2 trackers).
    // Se valores vierem errados/saturados, o inversor pode ser MT series (range 0x0300+) —
    // nesse caso trocar para os enderecos MT (Vpv1=0x0300, etc).
    // word_order high_first ("2 words, high word first and low word follow" - manual).
    // "Gain" do GoodWe = divisor (valor_real = raw / gain). Ex: 0.1V -> raw/10.
    'weg-siw400': {
        fabricante: 'WEG',
        modelo: 'SIW400',
        tipo: 'inversor_solar',
        protocolo: 'tcp',
        connection_note: 'Rebrand GoodWe. TCP via datalogger/WiFi. Range non-MT 0x0220-0x0236.',
        word_order: 'high_first',
        num_mppts: 4,
        num_strings: 16,
        ai_blocks: [
            // Bloco unico: 0x0220-0x0236 (35 regs) cobre error, energia, PV, grid, freq,
            // power, status, temp. GoodWe non-MT public read range.
            { start: 0x0220, count: 0x17, func: 0x03, label: 'Regs 0x0220-0x0236: energia, PV, grid, power, temp' },
        ],
        ai_map: {
            // offset 0 = 0x0220 (Error code H). offsets relativos ao start.
            // 0x0222-0x0223 ETotal (0.1kWh) -> total_yield em kWh, scale 10
            'total_yield':      { block: 0, offset: 2,  scale: 10,  dataType: 'U32', mode: 'last' }, // 0x0222
            // 0x0226 PV voltage tracker 1 (0.1V) -> mppt1_voltage, scale 10
            'mppt1_voltage':    { block: 0, offset: 6,  scale: 10,  dataType: 'U16', mode: 'avg'  }, // 0x0226
            'mppt2_voltage':    { block: 0, offset: 7,  scale: 10,  dataType: 'U16', mode: 'avg'  }, // 0x0227
            // 0x0228 PV current tracker 1 (0.1A) -> string1_current, scale 10
            'string1_current':  { block: 0, offset: 8,  scale: 10,  dataType: 'U16', mode: 'avg'  }, // 0x0228
            'string2_current':  { block: 0, offset: 9,  scale: 10,  dataType: 'U16', mode: 'avg'  }, // 0x0229
            // 0x022A-0x022C Grid voltage phase 1/2/3 (0.1V). Mapeado em vab/vbc/vca (fase-fase
            // aproximado; GoodWe non-MT expoe tensao por fase, nao line-to-line direta).
            'vab':              { block: 0, offset: 10, scale: 10,  dataType: 'U16', mode: 'avg'  }, // 0x022A
            'vbc':              { block: 0, offset: 11, scale: 10,  dataType: 'U16', mode: 'avg'  }, // 0x022B
            'vca':              { block: 0, offset: 12, scale: 10,  dataType: 'U16', mode: 'avg'  }, // 0x022C
            // 0x022D-0x022F Grid current phase 1/2/3 (0.1A)
            'ia':               { block: 0, offset: 13, scale: 10,  dataType: 'U16', mode: 'avg'  }, // 0x022D
            'ib':               { block: 0, offset: 14, scale: 10,  dataType: 'U16', mode: 'avg'  }, // 0x022E
            'ic':               { block: 0, offset: 15, scale: 10,  dataType: 'U16', mode: 'avg'  }, // 0x022F
            // 0x0230 Grid frequency phase 1 (0.01Hz) -> freq, scale 100
            'freq':             { block: 0, offset: 16, scale: 100, dataType: 'U16', mode: 'last' }, // 0x0230
            // 0x0233 Feeding power to grid (1W, ja em W) -> potencia_ativa, scale 1.
            // NOTA: U16 satura em 65535W (~65kW). Inversores >65kW devem usar MT series.
            'potencia_ativa':   { block: 0, offset: 19, scale: 1,   dataType: 'U16', mode: 'last' }, // 0x0233
            // 0x0235 Temperature of Heatsink (0.1C, signed) -> temp_interna, scale 10
            'temp_interna':     { block: 0, offset: 21, scale: 10,  dataType: 'S16', mode: 'last' }, // 0x0235
            // 0x0236 EDay (0.1kWh) -> daily_yield, scale 10
            'daily_yield':      { block: 0, offset: 22, scale: 10,  dataType: 'U16', mode: 'last' }, // 0x0236
        },
        bi_map: {
            // 0x0234 Running status: 0=cWaitMode, 1=cNormalMode, 2=cFaultMode
            'work_state': { register: 0x0234, func: 0x03 },
        },
        bo_map: {},
    },

    // WEG SIW500H - inversor rebrand Huawei SUN2000 (protocolo Huawei).
    // Manual: /var/www/iot_nexon/mapa_modbus/WEG/SIW500H/SIW500H ST100.pdf
    //         (= Huawei "Solar Inverter Modbus Interface Definitions V3.0")
    // Endereco direto (Huawei nao usa convencao Modicon; frame addr = register addr decimal).
    // word_order high_first (padrao Huawei SUN2000 para U32/I32).
    // "Gain" Huawei = divisor (valor_real = raw / gain). Ex: V gain 10 -> raw/10.
    // Potencias em kW/kVar: convertidas pra W/VAr (scale=1 ja' que gain1000 cancela com x1000).
    'weg-siw500h': {
        fabricante: 'WEG',
        modelo: 'SIW500H',
        tipo: 'inversor_solar',
        protocolo: 'tcp',
        connection_note: 'Rebrand Huawei SUN2000. TCP via datalogger. Regs 32016+, 32064+, 32106+.',
        word_order: 'high_first',
        num_mppts: 4,
        num_strings: 4,
        ai_blocks: [
            // Bloco 0: PV1-PV4 voltage/current (32016-32023, 8 regs)
            { start: 32016, count: 8,  func: 0x03, label: 'Regs 32016-32023: PV1-4 V/I' },
            // Bloco 1: input power -> device status (32064-32089, 26 regs)
            { start: 32064, count: 26, func: 0x03, label: 'Regs 32064-32089: P, V, I, freq, temp, status' },
            // Bloco 2: energia acumulada e diaria (32106-32115, 10 regs)
            { start: 32106, count: 10, func: 0x03, label: 'Regs 32106-32115: energia total e diaria' },
        ],
        ai_map: {
            // --- Bloco 0: PV1-PV4 (offset 0 = 32016) ---
            // PVn voltage I16 V gain10; PVn current I16 A gain100
            'mppt1_voltage':    { block: 0, offset: 0, scale: 10,  dataType: 'S16', mode: 'avg' }, // 32016
            'string1_current':  { block: 0, offset: 1, scale: 100, dataType: 'S16', mode: 'avg' }, // 32017
            'mppt2_voltage':    { block: 0, offset: 2, scale: 10,  dataType: 'S16', mode: 'avg' }, // 32018
            'string2_current':  { block: 0, offset: 3, scale: 100, dataType: 'S16', mode: 'avg' }, // 32019
            'mppt3_voltage':    { block: 0, offset: 4, scale: 10,  dataType: 'S16', mode: 'avg' }, // 32020
            'string3_current':  { block: 0, offset: 5, scale: 100, dataType: 'S16', mode: 'avg' }, // 32021
            'mppt4_voltage':    { block: 0, offset: 6, scale: 10,  dataType: 'S16', mode: 'avg' }, // 32022
            'string4_current':  { block: 0, offset: 7, scale: 100, dataType: 'S16', mode: 'avg' }, // 32023

            // --- Bloco 1: principais (offset 0 = 32064) ---
            // 32064 Input power I32 kW gain1000 -> dc_total_power em W (scale 1)
            'dc_total_power':   { block: 1, offset: 0,  scale: 1,    dataType: 'S32', mode: 'avg'  }, // 32064-32065
            // 32066-32068 Line voltage A-B/B-C/C-A U16 V gain10 -> vab/vbc/vca
            'vab':              { block: 1, offset: 2,  scale: 10,   dataType: 'U16', mode: 'avg'  }, // 32066
            'vbc':              { block: 1, offset: 3,  scale: 10,   dataType: 'U16', mode: 'avg'  }, // 32067
            'vca':              { block: 1, offset: 4,  scale: 10,   dataType: 'U16', mode: 'avg'  }, // 32068
            // 32072/32074/32076 Phase A/B/C current I32 A gain1000 -> ia/ib/ic
            'ia':               { block: 1, offset: 8,  scale: 1000, dataType: 'S32', mode: 'avg'  }, // 32072-32073
            'ib':               { block: 1, offset: 10, scale: 1000, dataType: 'S32', mode: 'avg'  }, // 32074-32075
            'ic':               { block: 1, offset: 12, scale: 1000, dataType: 'S32', mode: 'avg'  }, // 32076-32077
            // 32080 Active power I32 kW gain1000 -> potencia_ativa em W (scale 1)
            'potencia_ativa':   { block: 1, offset: 16, scale: 1,    dataType: 'S32', mode: 'last' }, // 32080-32081
            // 32082 Reactive power I32 kVar gain1000 -> potencia_reativa em VAr (scale 1)
            'potencia_reativa': { block: 1, offset: 18, scale: 1,    dataType: 'S32', mode: 'last' }, // 32082-32083
            // 32084 Power factor I16 gain1000 -> fp
            'fp':               { block: 1, offset: 20, scale: 1000, dataType: 'S16', mode: 'last' }, // 32084
            // 32085 Grid frequency U16 Hz gain100 -> freq
            'freq':             { block: 1, offset: 21, scale: 100,  dataType: 'U16', mode: 'last' }, // 32085
            // 32087 Internal temperature I16 C gain10 -> temp_interna
            'temp_interna':     { block: 1, offset: 23, scale: 10,   dataType: 'S16', mode: 'last' }, // 32087

            // --- Bloco 2: energia (offset 0 = 32106) ---
            // 32106 Accumulated energy yield U32 kWh gain100 -> total_yield
            'total_yield':      { block: 2, offset: 0, scale: 100, dataType: 'U32', mode: 'last' }, // 32106-32107
            // 32114 Daily energy yield U32 kWh gain100 -> daily_yield
            'daily_yield':      { block: 2, offset: 8, scale: 100, dataType: 'U32', mode: 'last' }, // 32114-32115
        },
        bi_map: {
            // 32089 Device status (enum 0x0000..0x0A00, vide manual pag 11-12)
            'work_state': { register: 32089, func: 0x03 },
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
        // TP/TC lido a cada ciclo (refs PlatformIO EV-PD666_USR_MQTT/main.cpp:587-595)
        // 0x0006=IrAt(TC), 0x0007=UrAt(TP). Ambos uint16. Scale TP=/10, TC=/1.
        tp_tc: {
            register: 0x0006,
            count: 2,
            tc_offset: 0,    // primeira metade da resposta = TC
            tp_offset: 1,    // segunda metade = TP
            scale_tp: 10,
            scale_tc: 1,
        },
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
            // Tensoes — multiplicadas por fTP (ref: main.cpp:612-614)
            'va':   { block: 0, offset: 0,  scale: 10,   dataType: 'FLOAT', apply_factor: 'tp' }, // 0x2006
            'vb':   { block: 0, offset: 2,  scale: 10,   dataType: 'FLOAT', apply_factor: 'tp' }, // 0x2008
            'vc':   { block: 0, offset: 4,  scale: 10,   dataType: 'FLOAT', apply_factor: 'tp' }, // 0x200A
            // Correntes — multiplicadas por fTC (ref: main.cpp:617-619)
            'ia':   { block: 0, offset: 6,  scale: 1000, dataType: 'FLOAT', apply_factor: 'tc' }, // 0x200C
            'ib':   { block: 0, offset: 8,  scale: 1000, dataType: 'FLOAT', apply_factor: 'tc' }, // 0x200E
            'ic':   { block: 0, offset: 10, scale: 1000, dataType: 'FLOAT', apply_factor: 'tc' }, // 0x2010
            // Potencias totais — multiplicadas por fatorEnergia=fTP*fTC (ref: main.cpp:625,631,643)
            'pt':   { block: 0, offset: 12, scale: 10,   dataType: 'FLOAT', apply_factor: 'tp_tc' }, // 0x2012
            'qt':   { block: 0, offset: 20, scale: 10,   dataType: 'FLOAT', apply_factor: 'tp_tc' }, // 0x201A
            'st':   { block: 0, offset: 28, scale: 10,   dataType: 'FLOAT', apply_factor: 'tp_tc' }, // 0x2022
            // Fator de potencia por fase — sem fator (ratio puro)
            'fp_a': { block: 0, offset: 38, scale: 1000, dataType: 'FLOAT' }, // 0x202C
            'fp_b': { block: 0, offset: 40, scale: 1000, dataType: 'FLOAT' }, // 0x202E
            'fp_c': { block: 0, offset: 42, scale: 1000, dataType: 'FLOAT' }, // 0x2030

            // --- Energias — multiplicadas por fatorEnergia (ref: main.cpp:658,667,676,685) ---
            'phf':          { block: 1, offset: 0, scale: 1, dataType: 'FLOAT', mode: 'last',  apply_factor: 'tp_tc' },
            'consumo_phf':  { block: 1, offset: 0, scale: 1, dataType: 'FLOAT', mode: 'delta', apply_factor: 'tp_tc', clamp_negative: true },
            'consumo_phr':  { block: 2, offset: 0, scale: 1, dataType: 'FLOAT', mode: 'delta', apply_factor: 'tp_tc', clamp_negative: true },
            'consumo_qhf':  { block: 3, offset: 0, scale: 1, dataType: 'FLOAT', mode: 'delta', apply_factor: 'tp_tc', clamp_negative: true },
            'consumo_qhr':  { block: 4, offset: 0, scale: 1, dataType: 'FLOAT', mode: 'delta', apply_factor: 'tp_tc', clamp_negative: true },
        },
        bi_map: {},
        bo_map: {},
    },

    // IMS M-160: registers 16-bit (uint16/int16) — NÃO IEEE 754 float.
    // Referência: /var/www/iot_nexon/PLATFORMIO/TESTES-BANCADA/M160/LORA_TX_MODBUS
    // Bloco único 37..70 (REG_START=37, REG_COUNT=34) cobre V/I/P/Q/FP/S/Energia.
    // Scales: V/=10, I/=100, FP/=1000, Energia/=1000 (sem fator TP*TC ainda).
    //
    // Catálogo expõe SOMENTE os 17 pontos do contrato canônico
    // DEVICE_POINTS.medidor_energia (mesmo conjunto que chint-pd666). M-160 tem
    // mais registers (per-phase P/Q/S etc.) mas não são publicados pra manter
    // JSON uniforme entre modelos.
    'ims-m160': {
        fabricante: 'IMS',
        modelo: 'M160',
        tipo: 'medidor_energia',
        protocolo: 'rtu',
        connection_note: 'RS485 direto, 9600 8N1. Registers 16-bit, não IEEE float.',
        // TP/TC lido a cada ciclo (refs PlatformIO LORA_TX_MODBUS/main.cpp:135-141)
        // reg 3 = TP (PT ratio), reg 4 = TC (CT ratio). Ambos uint16, scale=1.
        // No M-160 só ENERGIAS precisam do fator (V/I/P/Q/S já vêm calculados).
        tp_tc: {
            register: 3,
            count: 2,
            tp_offset: 0,
            tc_offset: 1,
            scale_tp: 1,
            scale_tc: 1,
        },
        ai_blocks: [
            { start: 37, count: 34, func: 0x03, label: 'V, I, P, Q, FP, S, Energia (37..70)' },
        ],
        ai_map: {
            // Energias (regs 64, 66, 68, 70) — multiplicadas por TP*TC
            // (ref: main.cpp:187-192 → phf = (regs[REG_PHF]/1000) * fatorEnergia)
            'phf':         { block: 0, offset: 27, scale: 1000, dataType: 'U16', mode: 'last',  apply_factor: 'tp_tc' },
            'consumo_phf': { block: 0, offset: 27, scale: 1000, dataType: 'U16', mode: 'delta', apply_factor: 'tp_tc', clamp_negative: true },
            'consumo_phr': { block: 0, offset: 29, scale: 1000, dataType: 'U16', mode: 'delta', apply_factor: 'tp_tc', clamp_negative: true },
            'consumo_qhf': { block: 0, offset: 31, scale: 1000, dataType: 'U16', mode: 'delta', apply_factor: 'tp_tc', clamp_negative: true },
            'consumo_qhr': { block: 0, offset: 33, scale: 1000, dataType: 'U16', mode: 'delta', apply_factor: 'tp_tc', clamp_negative: true },
            // Tensões (regs 37, 38, 39 — uint16, /10)
            'va': { block: 0, offset: 0, scale: 10, dataType: 'U16' },
            'vb': { block: 0, offset: 1, scale: 10, dataType: 'U16' },
            'vc': { block: 0, offset: 2, scale: 10, dataType: 'U16' },
            // Correntes (regs 43, 44, 45 — uint16, /100)
            'ia': { block: 0, offset: 6, scale: 100, dataType: 'U16' },
            'ib': { block: 0, offset: 7, scale: 100, dataType: 'U16' },
            'ic': { block: 0, offset: 8, scale: 100, dataType: 'U16' },
            // FP por fase (regs 54-56 — int16, /1000)
            'fp_a': { block: 0, offset: 17, scale: 1000, dataType: 'S16' },
            'fp_b': { block: 0, offset: 18, scale: 1000, dataType: 'S16' },
            'fp_c': { block: 0, offset: 19, scale: 1000, dataType: 'S16' },
            // Potências totais (regs 49=PA total, 53=QT, 61=ST)
            'pt': { block: 0, offset: 12, scale: 1, dataType: 'S16' },
            'qt': { block: 0, offset: 16, scale: 1, dataType: 'S16' },
            'st': { block: 0, offset: 24, scale: 1, dataType: 'U16' },
        },
        bi_map: {},
        bo_map: {},
    },

    // SSU acoplado ao Gateway A-966. Tipico: protocolo proprietario serial,
    // payload publica em AUPUS/.../A966/SSU/state como JSON com phf/phr/qhfi/qhfc/qhri/qhrc + cdo + sts + frame.
    // Energia em kWh = leitura_bruta * Kd. Kd default 0.3 (constante de divisao do medidor).
    // Override por equipamento: linha em equipamentos_dados_tecnicos com campo='kd'.
    'a966-ssu': {
        fabricante: 'AUPUS',
        modelo: 'A966-SSU',
        tipo: 'gateway_medidor',
        protocolo: 'serial',
        connection_note: 'Gateway A-966 le SSU via serial proprietario e publica JSON em /SSU/state.',
        kd: { default: 0.3 },
        ai_blocks: [],
        ai_map: {
            'phf':  { apply_factor: 'kd', unit: 'kWh' },
            'phr':  { apply_factor: 'kd', unit: 'kWh' },
            'qhfi': { apply_factor: 'kd', unit: 'kVArh' },
            'qhfc': { apply_factor: 'kd', unit: 'kVArh' },
            'qhri': { apply_factor: 'kd', unit: 'kVArh' },
            'qhrc': { apply_factor: 'kd', unit: 'kVArh' },
        },
        bi_map: {
            'sts': { unit: 'enum' },
        },
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
