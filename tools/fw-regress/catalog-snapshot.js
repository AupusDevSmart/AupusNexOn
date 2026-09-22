// AUTO-GENERATED from DB (iot_device_tipos + iot_device_modelos).
// Do not edit. Substituicao do antigo /iot-device-catalog.v2.js estatico.
// version="1790013609017-26"

var DEVICE_POINTS = {
  "bomba_combustivel": {
    "label": "Bomba de Combustível",
    "ai": [
      {
        "id": "nivel",
        "unit": "%",
        "label": "Nível"
      }
    ],
    "bi": [
      {
        "id": "contator",
        "label": "Contator"
      },
      {
        "id": "auto_manual",
        "label": "Auto/Manual"
      },
      {
        "id": "emergencia",
        "label": "Emergência"
      },
      {
        "id": "bico",
        "label": "Bico"
      },
      {
        "id": "boia_min",
        "label": "Boia mínimo"
      },
      {
        "id": "boia_alta",
        "label": "Boia alta"
      }
    ],
    "bo": [
      {
        "id": "ligar",
        "label": "Ligar"
      },
      {
        "id": "permissao",
        "label": "Permissão"
      },
      {
        "id": "solenoide",
        "label": "Solenoide"
      },
      {
        "id": "sinaleiro",
        "label": "Sinaleiro"
      }
    ]
  },
  "carregador_eletrico": {
    "label": "Carregador Elétrico",
    "ai": [],
    "bi": [
      {
        "id": "conectado",
        "label": "Conectado"
      }
    ],
    "bo": [
      {
        "id": "habilitar",
        "label": "Habilitar"
      },
      {
        "id": "desabilitar",
        "label": "Desabilitar"
      }
    ]
  },
  "gateway_medidor": {
    "label": "Gateway Medidor (SSU)",
    "ai": [
      {
        "id": "phf",
        "json": "phf",
        "unit": "kWh",
        "label": "Energia Ativa Forward"
      },
      {
        "id": "phr",
        "json": "phr",
        "unit": "kWh",
        "label": "Energia Ativa Reverse"
      },
      {
        "id": "qhfi",
        "json": "qhfi",
        "unit": "kVArh",
        "label": "Energia Reativa Q1 Indutiva"
      },
      {
        "id": "qhfc",
        "json": "qhfc",
        "unit": "kVArh",
        "label": "Energia Reativa Q1 Capacitiva"
      },
      {
        "id": "qhri",
        "json": "qhri",
        "unit": "kVArh",
        "label": "Energia Reativa Q2 Indutiva"
      },
      {
        "id": "qhrc",
        "json": "qhrc",
        "unit": "kVArh",
        "label": "Energia Reativa Q2 Capacitiva"
      }
    ],
    "bi": [
      {
        "id": "sts",
        "json": "sts",
        "group": "estado",
        "label": "Status"
      }
    ],
    "bo": [],
    "publish": {
      "meta_fields": [
        "cdo",
        "frame"
      ],
      "timestamp_format": "epoch",
      "timestamp_position": "last"
    }
  },
  "inversor_solar": {
    "label": "Inversor Solar",
    "ai": [
      {
        "id": "device_type",
        "json": "info.device_type",
        "unit": "",
        "group": "info",
        "label": "Tipo de Dispositivo",
        "format": "hex"
      },
      {
        "id": "nominal_power",
        "json": "info.nominal_power",
        "unit": "kW",
        "group": "info",
        "label": "Potência Nominal"
      },
      {
        "id": "output_type",
        "json": "info.output_type",
        "unit": "",
        "group": "info",
        "label": "Tipo de Saída"
      },
      {
        "id": "daily_yield",
        "json": "energy.daily_yield",
        "unit": "kWh",
        "group": "energy",
        "label": "Geração Diária"
      },
      {
        "id": "total_yield",
        "json": "energy.total_yield",
        "unit": "kWh",
        "group": "energy",
        "label": "Geração Total"
      },
      {
        "id": "total_running_time",
        "json": "energy.total_running_time",
        "unit": "h",
        "group": "energy",
        "label": "Tempo Total Operação"
      },
      {
        "id": "daily_running_time",
        "json": "energy.daily_running_time",
        "unit": "min",
        "group": "energy",
        "label": "Tempo Diário Operação"
      },
      {
        "id": "potencia_aparente",
        "json": "energy.Potencia Aparente1",
        "unit": "VA",
        "group": "energy",
        "label": "Potência Aparente 1"
      },
      {
        "id": "potencia_aparente2",
        "json": "energy.Potencia Aparente2",
        "unit": "VA",
        "group": "energy",
        "label": "Potência Aparente 2"
      },
      {
        "id": "temp_interna",
        "json": "temperature.internal",
        "unit": "°C",
        "group": "temperature",
        "label": "Temperatura Interna"
      },
      {
        "id": "mppt_voltage",
        "unit": "V",
        "group": "dc",
        "label": "MPPT Tensão",
        "prefix": "mppt",
        "suffix": "_voltage",
        "per_instance": "num_mppts"
      },
      {
        "id": "string_current",
        "unit": "A",
        "group": "dc",
        "label": "String Corrente",
        "prefix": "string",
        "suffix": "_current",
        "per_instance": "num_strings"
      },
      {
        "id": "dc_total_power",
        "json": "dc.total_power",
        "unit": "W",
        "group": "dc",
        "label": "Potência DC Total"
      },
      {
        "id": "vab",
        "json": "voltage.phase_a-b",
        "unit": "V",
        "group": "voltage",
        "label": "Tensão A-B"
      },
      {
        "id": "vbc",
        "json": "voltage.phase_b-c",
        "unit": "V",
        "group": "voltage",
        "label": "Tensão B-C"
      },
      {
        "id": "vca",
        "json": "voltage.phase_c-a",
        "unit": "V",
        "group": "voltage",
        "label": "Tensão C-A"
      },
      {
        "id": "ia",
        "json": "current.phase_a",
        "unit": "A",
        "group": "current",
        "label": "Corrente Fase A"
      },
      {
        "id": "ib",
        "json": "current.phase_b",
        "unit": "A",
        "group": "current",
        "label": "Corrente Fase B"
      },
      {
        "id": "ic",
        "json": "current.phase_c",
        "unit": "A",
        "group": "current",
        "label": "Corrente Fase C"
      },
      {
        "id": "potencia_ativa",
        "json": "power.active_total",
        "unit": "W",
        "group": "power",
        "label": "Potência Ativa Total"
      },
      {
        "id": "potencia_reativa",
        "json": "power.reactive_total",
        "unit": "VAr",
        "group": "power",
        "label": "Potência Reativa Total"
      },
      {
        "id": "apparent_total",
        "json": "power.apparent_total",
        "unit": "VA",
        "group": "power",
        "label": "Potência Aparente Total"
      },
      {
        "id": "fp",
        "json": "power.power_factor",
        "unit": "",
        "group": "power",
        "label": "Fator de Potência"
      },
      {
        "id": "freq",
        "json": "power.frequency",
        "unit": "Hz",
        "group": "power",
        "label": "Frequência"
      },
      {
        "id": "insulation_resistance",
        "json": "protection.insulation_resistance",
        "unit": "kΩ",
        "group": "protection",
        "label": "Resistência Isolamento"
      },
      {
        "id": "bus_voltage",
        "json": "protection.bus_voltage",
        "unit": "V",
        "group": "protection",
        "label": "Tensão Barramento"
      },
      {
        "id": "nominal_reactive_power",
        "json": "regulation.nominal_reactive_power",
        "unit": "kVAr",
        "group": "regulation",
        "label": "Potência Reativa Nominal"
      },
      {
        "id": "pid_work_state",
        "json": "pid.work_state",
        "unit": "",
        "group": "pid",
        "label": "Estado PID"
      },
      {
        "id": "pid_alarm_code",
        "json": "pid.alarm_code",
        "unit": "",
        "group": "pid",
        "label": "PID Código de Alarme"
      }
    ],
    "bi": [
      {
        "id": "work_state",
        "json": "status.work_state",
        "group": "status",
        "label": "Estado de Operação"
      }
    ],
    "bo": [],
    "publish": {
      "meta_fields": [
        "inverter_id",
        "samples"
      ],
      "timestamp_format": "epoch",
      "timestamp_position": "first"
    },
    "group_order": [
      "info",
      "energy",
      "temperature",
      "dc",
      "voltage",
      "current",
      "power",
      "status",
      "protection",
      "regulation",
      "pid"
    ]
  },
  "medidor_energia": {
    "label": "Medidor de Energia",
    "ai": [
      {
        "id": "phf",
        "json": "phf",
        "unit": "kWh",
        "label": "Energia Ativa Forward (acumulada)"
      },
      {
        "id": "consumo_phf",
        "json": "consumo_phf",
        "unit": "kWh",
        "label": "Consumo Ativa Forward"
      },
      {
        "id": "consumo_phr",
        "json": "consumo_phr",
        "unit": "kWh",
        "label": "Consumo Ativa Reverse"
      },
      {
        "id": "consumo_qhf",
        "json": "consumo_qhf",
        "unit": "kvarh",
        "label": "Consumo Reativa Q1"
      },
      {
        "id": "consumo_qhr",
        "json": "consumo_qhr",
        "unit": "kvarh",
        "label": "Consumo Reativa Q2"
      },
      {
        "id": "va",
        "json": "Va",
        "unit": "V",
        "label": "Tensão Fase A"
      },
      {
        "id": "vb",
        "json": "Vb",
        "unit": "V",
        "label": "Tensão Fase B"
      },
      {
        "id": "vc",
        "json": "Vc",
        "unit": "V",
        "label": "Tensão Fase C"
      },
      {
        "id": "ia",
        "json": "Ia",
        "unit": "A",
        "label": "Corrente Fase A"
      },
      {
        "id": "ib",
        "json": "Ib",
        "unit": "A",
        "label": "Corrente Fase B"
      },
      {
        "id": "ic",
        "json": "Ic",
        "unit": "A",
        "label": "Corrente Fase C"
      },
      {
        "id": "fp_a",
        "json": "FPa",
        "unit": "",
        "label": "Fator Potência Fase A"
      },
      {
        "id": "fp_b",
        "json": "FPb",
        "unit": "",
        "label": "Fator Potência Fase B"
      },
      {
        "id": "fp_c",
        "json": "FPc",
        "unit": "",
        "label": "Fator Potência Fase C"
      },
      {
        "id": "pt",
        "json": "Pt",
        "unit": "W",
        "label": "Potência Ativa Total"
      },
      {
        "id": "qt",
        "json": "Qt",
        "unit": "var",
        "label": "Potência Reativa Total"
      },
      {
        "id": "st",
        "json": "St",
        "unit": "VA",
        "label": "Potência Aparente Total"
      },
      {
        "id": "freq",
        "json": "Freq",
        "unit": "Hz",
        "label": "Frequência"
      },
      {
        "id": "fp_t",
        "json": "FPt",
        "unit": "",
        "label": "Fator Potência Total"
      }
    ],
    "bi": [],
    "bo": [],
    "publish": {
      "meta_fields": [],
      "timestamp_format": "epoch",
      "timestamp_position": "last"
    }
  },
  "rele_protecao": {
    "label": "Relé de Proteção",
    "ai": [
      {
        "id": "va",
        "unit": "V",
        "group": "tensao",
        "label": "Tensão Fase A"
      },
      {
        "id": "vb",
        "unit": "V",
        "group": "tensao",
        "label": "Tensão Fase B"
      },
      {
        "id": "vc",
        "unit": "V",
        "group": "tensao",
        "label": "Tensão Fase C"
      },
      {
        "id": "ia",
        "unit": "A",
        "group": "corrente",
        "label": "Corrente Fase A"
      },
      {
        "id": "ib",
        "unit": "A",
        "group": "corrente",
        "label": "Corrente Fase B"
      },
      {
        "id": "ic",
        "unit": "A",
        "group": "corrente",
        "label": "Corrente Fase C"
      },
      {
        "id": "in",
        "unit": "A",
        "group": "corrente",
        "label": "Corrente Neutro"
      },
      {
        "id": "cosfi_a",
        "unit": "",
        "group": "cosfi",
        "label": "Fator Potência A"
      },
      {
        "id": "cosfi_b",
        "unit": "",
        "group": "cosfi",
        "label": "Fator Potência B"
      },
      {
        "id": "cosfi_c",
        "unit": "",
        "group": "cosfi",
        "label": "Fator Potência C"
      },
      {
        "id": "pa_total",
        "unit": "W",
        "group": "potencia",
        "label": "Potência Ativa Total"
      },
      {
        "id": "pr_total",
        "unit": "VAr",
        "group": "potencia",
        "label": "Potência Reativa Total"
      },
      {
        "id": "freq",
        "unit": "Hz",
        "group": "frequencia",
        "label": "Frequência"
      }
    ],
    "bi": [
      {
        "id": "f27a",
        "group": "27",
        "label": "27 Subtensão Fase A"
      },
      {
        "id": "f27b",
        "group": "27",
        "label": "27 Subtensão Fase B"
      },
      {
        "id": "f27c",
        "group": "27",
        "label": "27 Subtensão Fase C"
      },
      {
        "id": "f51a",
        "group": "51",
        "label": "51 Sobrecorrente Temp. Fase A"
      },
      {
        "id": "f51b",
        "group": "51",
        "label": "51 Sobrecorrente Temp. Fase B"
      },
      {
        "id": "f51c",
        "group": "51",
        "label": "51 Sobrecorrente Temp. Fase C"
      },
      {
        "id": "f50a",
        "group": "50",
        "label": "50 Sobrecorrente Inst. Fase A"
      },
      {
        "id": "f50b",
        "group": "50",
        "label": "50 Sobrecorrente Inst. Fase B"
      },
      {
        "id": "f50c",
        "group": "50",
        "label": "50 Sobrecorrente Inst. Fase C"
      },
      {
        "id": "f50n",
        "group": "50N",
        "label": "50N Sobrecorrente Inst. Neutro"
      },
      {
        "id": "f51n",
        "group": "51N",
        "label": "51N Sobrecorrente Temp. Neutro"
      },
      {
        "id": "f59a",
        "group": "59",
        "label": "59 Sobretensão Fase A"
      },
      {
        "id": "f59b",
        "group": "59",
        "label": "59 Sobretensão Fase B"
      },
      {
        "id": "f59c",
        "group": "59",
        "label": "59 Sobretensão Fase C"
      },
      {
        "id": "f59n",
        "group": "59",
        "label": "59N Sobretensão Neutro"
      },
      {
        "id": "f81",
        "group": "81",
        "label": "81 Sub/Sobrefrequência"
      },
      {
        "id": "f46",
        "group": "46",
        "label": "46 Desequilíbrio de Corrente"
      },
      {
        "id": "f47",
        "group": "47",
        "label": "47 Falta de Fase / Seq. Inversa"
      },
      {
        "id": "f67a",
        "group": "67",
        "label": "67 Direcional Fase A"
      },
      {
        "id": "f67b",
        "group": "67",
        "label": "67 Direcional Fase B"
      },
      {
        "id": "f67c",
        "group": "67",
        "label": "67 Direcional Fase C"
      },
      {
        "id": "f67n",
        "group": "67",
        "label": "67N Direcional Neutro"
      },
      {
        "id": "f32a",
        "group": "32",
        "label": "32 Potência Reversa Fase A"
      },
      {
        "id": "f32b",
        "group": "32",
        "label": "32 Potência Reversa Fase B"
      },
      {
        "id": "f32c",
        "group": "32",
        "label": "32 Potência Reversa Fase C"
      },
      {
        "id": "fba",
        "group": "50BF",
        "label": "50BF Falha de Disjuntor"
      },
      {
        "id": "f86",
        "group": "86",
        "label": "86 Bloqueio"
      },
      {
        "id": "f78",
        "group": "78",
        "label": "78 Sincronismo"
      },
      {
        "id": "local_remoto",
        "group": "estado",
        "label": "Local/Remoto"
      },
      {
        "id": "dj_aberto",
        "group": "estado",
        "label": "Disjuntor Aberto"
      },
      {
        "id": "dj_bloqueado",
        "group": "estado",
        "label": "Disjuntor Bloqueado"
      },
      {
        "id": "falha_com",
        "group": "estado",
        "label": "Falha de Comunicação"
      },
      {
        "id": "dj_fechado",
        "group": "estado",
        "label": "Disjuntor Fechado"
      }
    ],
    "bo": [
      {
        "id": "cmd_fechar",
        "group": "comando",
        "label": "Comando Fechar Disjuntor"
      },
      {
        "id": "cmd_abrir",
        "group": "comando",
        "label": "Comando Abrir Disjuntor"
      },
      {
        "id": "cmd_reset",
        "group": "comando",
        "label": "Reset Remoto"
      }
    ]
  }
};

var DEVICE_MODELS = {
  "chint-pd666-copia": {
    "fabricante": "AS",
    "modelo": "TST",
    "tipo": "medidor_energia",
    "protocolo": "rtu",
    "connection_note": "RS485 direto ou Modbus TCP via USR. Func 0x03 (holding registers) p/ tudo.",
    "tp_tc": {
      "count": 2,
      "register": 6,
      "scale_tc": 1,
      "scale_tp": 10,
      "tc_offset": 0,
      "tp_offset": 1
    },
    "ai_map": {
      "ia": {
        "block": 0,
        "scale": 1000,
        "offset": 6,
        "dataType": "FLOAT",
        "apply_factor": "tc"
      },
      "ib": {
        "block": 0,
        "scale": 1000,
        "offset": 8,
        "dataType": "FLOAT",
        "apply_factor": "tc"
      },
      "ic": {
        "block": 0,
        "scale": 1000,
        "offset": 10,
        "dataType": "FLOAT",
        "apply_factor": "tc"
      },
      "pt": {
        "block": 0,
        "scale": 10,
        "offset": 12,
        "dataType": "FLOAT",
        "apply_factor": "tp_tc"
      },
      "qt": {
        "block": 0,
        "scale": 10,
        "offset": 20,
        "dataType": "FLOAT",
        "apply_factor": "tp_tc"
      },
      "st": {
        "block": 0,
        "scale": 10,
        "offset": 28,
        "dataType": "FLOAT",
        "apply_factor": "tp_tc"
      },
      "va": {
        "block": 0,
        "scale": 10,
        "offset": 0,
        "dataType": "FLOAT",
        "apply_factor": "tp"
      },
      "vb": {
        "block": 0,
        "scale": 10,
        "offset": 2,
        "dataType": "FLOAT",
        "apply_factor": "tp"
      },
      "vc": {
        "block": 0,
        "scale": 10,
        "offset": 4,
        "dataType": "FLOAT",
        "apply_factor": "tp"
      },
      "phf": {
        "mode": "last",
        "block": 1,
        "scale": 1,
        "offset": 0,
        "dataType": "FLOAT",
        "apply_factor": "tp_tc"
      },
      "fp_a": {
        "block": 0,
        "scale": 1000,
        "offset": 38,
        "dataType": "FLOAT"
      },
      "fp_b": {
        "block": 0,
        "scale": 1000,
        "offset": 40,
        "dataType": "FLOAT"
      },
      "fp_c": {
        "block": 0,
        "scale": 1000,
        "offset": 42,
        "dataType": "FLOAT"
      },
      "consumo_phf": {
        "mode": "delta",
        "block": 1,
        "scale": 1,
        "offset": 0,
        "dataType": "FLOAT",
        "apply_factor": "tp_tc",
        "clamp_negative": true
      },
      "consumo_phr": {
        "mode": "delta",
        "block": 2,
        "scale": 1,
        "offset": 0,
        "dataType": "FLOAT",
        "apply_factor": "tp_tc",
        "clamp_negative": true
      },
      "consumo_qhf": {
        "mode": "delta",
        "block": 3,
        "scale": 1,
        "offset": 0,
        "dataType": "FLOAT",
        "apply_factor": "tp_tc",
        "clamp_negative": true
      },
      "consumo_qhr": {
        "mode": "delta",
        "block": 4,
        "scale": 1,
        "offset": 0,
        "dataType": "FLOAT",
        "apply_factor": "tp_tc",
        "clamp_negative": true
      }
    },
    "bi_map": {},
    "bo_map": {},
    "ai_blocks": [
      {
        "func": 3,
        "count": 44,
        "label": "V, I, P, Q, S, FP (22 floats IEEE 754)",
        "start": 8198
      },
      {
        "func": 3,
        "count": 2,
        "label": "PHF - Energia Ativa Forward (kWh)",
        "start": 4126
      },
      {
        "func": 3,
        "count": 2,
        "label": "PHR - Energia Ativa Reverse (kWh)",
        "start": 4136
      },
      {
        "func": 3,
        "count": 2,
        "label": "QHF - Energia Reativa Q1 (kvarh)",
        "start": 4146
      },
      {
        "func": 3,
        "count": 2,
        "label": "QHR - Energia Reativa Q2 (kvarh)",
        "start": 4156
      }
    ]
  },
  "chint-pd666": {
    "fabricante": "CHINT",
    "modelo": "PD666",
    "tipo": "medidor_energia",
    "protocolo": "rtu",
    "connection_note": "RS485 direto ou Modbus TCP via USR. Func 0x03 (holding registers) p/ tudo.",
    "tp_tc": {
      "count": 2,
      "register": 6,
      "scale_tc": 1,
      "scale_tp": 10,
      "tc_offset": 0,
      "tp_offset": 1
    },
    "ai_map": {
      "ia": {
        "block": 0,
        "scale": 1000,
        "offset": 6,
        "dataType": "FLOAT",
        "apply_factor": "tc"
      },
      "ib": {
        "block": 0,
        "scale": 1000,
        "offset": 8,
        "dataType": "FLOAT",
        "apply_factor": "tc"
      },
      "ic": {
        "block": 0,
        "scale": 1000,
        "offset": 10,
        "dataType": "FLOAT",
        "apply_factor": "tc"
      },
      "pt": {
        "block": 0,
        "scale": 10,
        "offset": 12,
        "dataType": "FLOAT",
        "apply_factor": "tp_tc"
      },
      "qt": {
        "block": 0,
        "scale": 10,
        "offset": 20,
        "dataType": "FLOAT",
        "apply_factor": "tp_tc"
      },
      "st": {
        "block": 0,
        "scale": 10,
        "offset": 28,
        "dataType": "FLOAT",
        "apply_factor": "tp_tc"
      },
      "va": {
        "block": 0,
        "scale": 10,
        "offset": 0,
        "dataType": "FLOAT",
        "apply_factor": "tp"
      },
      "vb": {
        "block": 0,
        "scale": 10,
        "offset": 2,
        "dataType": "FLOAT",
        "apply_factor": "tp"
      },
      "vc": {
        "block": 0,
        "scale": 10,
        "offset": 4,
        "dataType": "FLOAT",
        "apply_factor": "tp"
      },
      "phf": {
        "mode": "last",
        "block": 1,
        "scale": 1,
        "offset": 0,
        "dataType": "FLOAT",
        "apply_factor": "tp_tc"
      },
      "fp_a": {
        "block": 0,
        "scale": 1000,
        "offset": 38,
        "dataType": "FLOAT"
      },
      "fp_b": {
        "block": 0,
        "scale": 1000,
        "offset": 40,
        "dataType": "FLOAT"
      },
      "fp_c": {
        "block": 0,
        "scale": 1000,
        "offset": 42,
        "dataType": "FLOAT"
      },
      "fp_t": {
        "block": 0,
        "scale": 1000,
        "offset": 36,
        "dataType": "FLOAT"
      },
      "freq": {
        "block": 5,
        "scale": 100,
        "offset": 0,
        "dataType": "FLOAT"
      },
      "consumo_phf": {
        "mode": "delta",
        "block": 1,
        "scale": 1,
        "offset": 0,
        "dataType": "FLOAT",
        "apply_factor": "tp_tc",
        "clamp_negative": true
      },
      "consumo_phr": {
        "mode": "delta",
        "block": 2,
        "scale": 1,
        "offset": 0,
        "dataType": "FLOAT",
        "apply_factor": "tp_tc",
        "clamp_negative": true
      },
      "consumo_qhf": {
        "mode": "delta",
        "block": 3,
        "scale": 1,
        "offset": 0,
        "dataType": "FLOAT",
        "apply_factor": "tp_tc",
        "clamp_negative": true
      },
      "consumo_qhr": {
        "mode": "delta",
        "block": 4,
        "scale": 1,
        "offset": 0,
        "dataType": "FLOAT",
        "apply_factor": "tp_tc",
        "clamp_negative": true
      }
    },
    "bi_map": {},
    "bo_map": {},
    "ai_blocks": [
      {
        "func": 3,
        "count": 44,
        "label": "V, I, P, Q, S, FP (22 floats IEEE 754)",
        "start": 8198
      },
      {
        "func": 3,
        "count": 2,
        "label": "PHF - Energia Ativa Forward (kWh)",
        "start": 4126
      },
      {
        "func": 3,
        "count": 2,
        "label": "PHR - Energia Ativa Reverse (kWh)",
        "start": 4136
      },
      {
        "func": 3,
        "count": 2,
        "label": "QHF - Energia Reativa Q1 (kvarh)",
        "start": 4146
      },
      {
        "func": 3,
        "count": 2,
        "label": "QHR - Energia Reativa Q2 (kvarh)",
        "start": 4156
      },
      {
        "func": 3,
        "count": 2,
        "label": "Freq — Frequência (Hz)",
        "start": 8260
      }
    ]
  },
  "goodwe-mt": {
    "fabricante": "GoodWe",
    "modelo": "GW-MT Series",
    "tipo": "inversor_solar",
    "protocolo": "rtu",
    "connection_note": "RS485 direto",
    "ai_map": {
      "va": {
        "block": 0,
        "scale": 0.1,
        "offset": 7,
        "dataType": "U16"
      },
      "mppt1_i": {
        "block": 0,
        "scale": 0.1,
        "offset": 4,
        "dataType": "U16"
      },
      "mppt1_v": {
        "block": 0,
        "scale": 0.1,
        "offset": 3,
        "dataType": "U16"
      },
      "freq_rede": {
        "block": 0,
        "scale": 0.1,
        "offset": 9,
        "dataType": "U16"
      },
      "temp_interna": {
        "block": 0,
        "scale": 0.1,
        "offset": 74,
        "dataType": "S16"
      },
      "geracao_total": {
        "block": 0,
        "scale": 0.1,
        "offset": 4,
        "dataType": "U32"
      },
      "potencia_ativa": {
        "block": 0,
        "scale": 0.1,
        "offset": 0,
        "dataType": "U32"
      }
    },
    "bi_map": {
      "estado_operacao": {
        "func": 3,
        "register": 35138
      }
    },
    "bo_map": {},
    "ai_blocks": [
      {
        "func": 3,
        "count": 40,
        "label": "Dados principais",
        "start": 35100
      }
    ]
  },
  "huawei-sun2000-100ktl": {
    "fabricante": "Huawei",
    "modelo": "SUN2000-100KTL M1",
    "tipo": "inversor_solar",
    "protocolo": "tcp",
    "connection_note": "Huawei SUN2000-100KTL M1 (100 kW). 10 MPPTs fisicos x 2 strings = 20 strings. Via SmartLogger TCP. Regs 30070-30074, 32016-32055, 32064-32090, 32106-32115.",
    "ai_map": {
      "fp": {
        "mode": "last",
        "block": 1,
        "scale": 1000,
        "offset": 20,
        "dataType": "S16"
      },
      "ia": {
        "mode": "avg",
        "block": 1,
        "scale": 1000,
        "offset": 8,
        "dataType": "S32"
      },
      "ib": {
        "mode": "avg",
        "block": 1,
        "scale": 1000,
        "offset": 10,
        "dataType": "S32"
      },
      "ic": {
        "mode": "avg",
        "block": 1,
        "scale": 1000,
        "offset": 12,
        "dataType": "S32"
      },
      "vab": {
        "mode": "avg",
        "block": 1,
        "scale": 10,
        "offset": 2,
        "dataType": "U16"
      },
      "vbc": {
        "mode": "avg",
        "block": 1,
        "scale": 10,
        "offset": 3,
        "dataType": "U16"
      },
      "vca": {
        "mode": "avg",
        "block": 1,
        "scale": 10,
        "offset": 4,
        "dataType": "U16"
      },
      "freq": {
        "mode": "last",
        "block": 1,
        "scale": 100,
        "offset": 21,
        "dataType": "U16"
      },
      "work_state": {
        "mode": "last",
        "block": 1,
        "scale": 1,
        "offset": 25,
        "dataType": "U16"
      },
      "daily_yield": {
        "mode": "last",
        "block": 2,
        "scale": 100,
        "offset": 8,
        "dataType": "U32"
      },
      "device_type": {
        "mode": "last",
        "block": 3,
        "scale": 1,
        "format": "hex",
        "offset": 0,
        "dataType": "U16"
      },
      "total_yield": {
        "mode": "last",
        "block": 2,
        "scale": 100,
        "offset": 0,
        "dataType": "U32"
      },
      "temp_interna": {
        "mode": "last",
        "block": 1,
        "scale": 10,
        "offset": 23,
        "dataType": "S16"
      },
      "mppt1_voltage": {
        "mode": "avg",
        "block": 0,
        "scale": 10,
        "offset": 0,
        "dataType": "S16"
      },
      "mppt2_voltage": {
        "mode": "avg",
        "block": 0,
        "scale": 10,
        "offset": 4,
        "dataType": "S16"
      },
      "mppt3_voltage": {
        "mode": "avg",
        "block": 0,
        "scale": 10,
        "offset": 8,
        "dataType": "S16"
      },
      "mppt4_voltage": {
        "mode": "avg",
        "block": 0,
        "scale": 10,
        "offset": 12,
        "dataType": "S16"
      },
      "mppt5_voltage": {
        "mode": "avg",
        "block": 0,
        "scale": 10,
        "offset": 16,
        "dataType": "S16"
      },
      "mppt6_voltage": {
        "mode": "avg",
        "block": 0,
        "scale": 10,
        "offset": 20,
        "dataType": "S16"
      },
      "mppt7_voltage": {
        "mode": "avg",
        "block": 0,
        "scale": 10,
        "offset": 24,
        "dataType": "S16"
      },
      "mppt8_voltage": {
        "mode": "avg",
        "block": 0,
        "scale": 10,
        "offset": 28,
        "dataType": "S16"
      },
      "mppt9_voltage": {
        "mode": "avg",
        "block": 0,
        "scale": 10,
        "offset": 32,
        "dataType": "S16"
      },
      "nominal_power": {
        "mode": "last",
        "block": 3,
        "scale": 1000,
        "offset": 3,
        "dataType": "U32"
      },
      "dc_total_power": {
        "mode": "avg",
        "block": 1,
        "scale": 1,
        "offset": 0,
        "dataType": "S32"
      },
      "mppt10_voltage": {
        "mode": "avg",
        "block": 0,
        "scale": 10,
        "offset": 36,
        "dataType": "S16"
      },
      "pid_alarm_code": {
        "mode": "last",
        "block": 1,
        "scale": 1,
        "offset": 26,
        "dataType": "U16"
      },
      "potencia_ativa": {
        "mode": "last",
        "block": 1,
        "scale": 1,
        "offset": 16,
        "dataType": "S32"
      },
      "string1_current": {
        "mode": "avg",
        "block": 0,
        "scale": 100,
        "offset": 1,
        "dataType": "S16"
      },
      "string2_current": {
        "mode": "avg",
        "block": 0,
        "scale": 100,
        "offset": 3,
        "dataType": "S16"
      },
      "string3_current": {
        "mode": "avg",
        "block": 0,
        "scale": 100,
        "offset": 5,
        "dataType": "S16"
      },
      "string4_current": {
        "mode": "avg",
        "block": 0,
        "scale": 100,
        "offset": 7,
        "dataType": "S16"
      },
      "string5_current": {
        "mode": "avg",
        "block": 0,
        "scale": 100,
        "offset": 9,
        "dataType": "S16"
      },
      "string6_current": {
        "mode": "avg",
        "block": 0,
        "scale": 100,
        "offset": 11,
        "dataType": "S16"
      },
      "string7_current": {
        "mode": "avg",
        "block": 0,
        "scale": 100,
        "offset": 13,
        "dataType": "S16"
      },
      "string8_current": {
        "mode": "avg",
        "block": 0,
        "scale": 100,
        "offset": 15,
        "dataType": "S16"
      },
      "string9_current": {
        "mode": "avg",
        "block": 0,
        "scale": 100,
        "offset": 17,
        "dataType": "S16"
      },
      "potencia_reativa": {
        "mode": "last",
        "block": 1,
        "scale": 1,
        "offset": 18,
        "dataType": "S32"
      },
      "string10_current": {
        "mode": "avg",
        "block": 0,
        "scale": 100,
        "offset": 19,
        "dataType": "S16"
      },
      "string11_current": {
        "mode": "avg",
        "block": 0,
        "scale": 100,
        "offset": 21,
        "dataType": "S16"
      },
      "string12_current": {
        "mode": "avg",
        "block": 0,
        "scale": 100,
        "offset": 23,
        "dataType": "S16"
      },
      "string13_current": {
        "mode": "avg",
        "block": 0,
        "scale": 100,
        "offset": 25,
        "dataType": "S16"
      },
      "string14_current": {
        "mode": "avg",
        "block": 0,
        "scale": 100,
        "offset": 27,
        "dataType": "S16"
      },
      "string15_current": {
        "mode": "avg",
        "block": 0,
        "scale": 100,
        "offset": 29,
        "dataType": "S16"
      },
      "string16_current": {
        "mode": "avg",
        "block": 0,
        "scale": 100,
        "offset": 31,
        "dataType": "S16"
      },
      "string17_current": {
        "mode": "avg",
        "block": 0,
        "scale": 100,
        "offset": 33,
        "dataType": "S16"
      },
      "string18_current": {
        "mode": "avg",
        "block": 0,
        "scale": 100,
        "offset": 35,
        "dataType": "S16"
      },
      "string19_current": {
        "mode": "avg",
        "block": 0,
        "scale": 100,
        "offset": 37,
        "dataType": "S16"
      },
      "string20_current": {
        "mode": "avg",
        "block": 0,
        "scale": 100,
        "offset": 39,
        "dataType": "S16"
      },
      "insulation_resistance": {
        "mode": "last",
        "block": 1,
        "scale": 1000,
        "offset": 24,
        "dataType": "U16"
      }
    },
    "bi_map": {},
    "bo_map": {},
    "ai_blocks": [
      {
        "func": 3,
        "count": 40,
        "label": "Regs 32016-32055: PV1-20 V/I (10 MPPTs x 2 strings)",
        "start": 32016
      },
      {
        "func": 3,
        "count": 27,
        "label": "Regs 32064-32090: P, V, I, freq, temp, isolamento, status, fault",
        "start": 32064
      },
      {
        "func": 3,
        "count": 10,
        "label": "Regs 32106-32115: energia total e diaria",
        "start": 32106
      },
      {
        "func": 3,
        "count": 5,
        "label": "Regs 30070-30074: Model ID + Rated Power",
        "start": 30070
      }
    ],
    "num_mppts": 10,
    "word_order": "high_first",
    "num_strings": 20
  },
  "huawei-sun2000-75ktl": {
    "fabricante": "Huawei",
    "modelo": "SUN2000-75KTL M1",
    "tipo": "inversor_solar",
    "protocolo": "tcp",
    "connection_note": "Huawei SUN2000-75KTL M1 (75 kW). Mapa Modbus identico ao 100KTL M1. Via SmartLogger TCP. Regs 30070-30074, 32016-32055, 32064-32090, 32106-32115.",
    "ai_map": {
      "fp": {
        "mode": "last",
        "block": 1,
        "scale": 1000,
        "offset": 20,
        "dataType": "S16"
      },
      "ia": {
        "mode": "avg",
        "block": 1,
        "scale": 1000,
        "offset": 8,
        "dataType": "S32"
      },
      "ib": {
        "mode": "avg",
        "block": 1,
        "scale": 1000,
        "offset": 10,
        "dataType": "S32"
      },
      "ic": {
        "mode": "avg",
        "block": 1,
        "scale": 1000,
        "offset": 12,
        "dataType": "S32"
      },
      "vab": {
        "mode": "avg",
        "block": 1,
        "scale": 10,
        "offset": 2,
        "dataType": "U16"
      },
      "vbc": {
        "mode": "avg",
        "block": 1,
        "scale": 10,
        "offset": 3,
        "dataType": "U16"
      },
      "vca": {
        "mode": "avg",
        "block": 1,
        "scale": 10,
        "offset": 4,
        "dataType": "U16"
      },
      "freq": {
        "mode": "last",
        "block": 1,
        "scale": 100,
        "offset": 21,
        "dataType": "U16"
      },
      "work_state": {
        "mode": "last",
        "block": 1,
        "scale": 1,
        "offset": 25,
        "dataType": "U16"
      },
      "daily_yield": {
        "mode": "last",
        "block": 2,
        "scale": 100,
        "offset": 8,
        "dataType": "U32"
      },
      "device_type": {
        "mode": "last",
        "block": 3,
        "scale": 1,
        "format": "hex",
        "offset": 0,
        "dataType": "U16"
      },
      "total_yield": {
        "mode": "last",
        "block": 2,
        "scale": 100,
        "offset": 0,
        "dataType": "U32"
      },
      "temp_interna": {
        "mode": "last",
        "block": 1,
        "scale": 10,
        "offset": 23,
        "dataType": "S16"
      },
      "mppt1_voltage": {
        "mode": "avg",
        "block": 0,
        "scale": 10,
        "offset": 0,
        "dataType": "S16"
      },
      "mppt2_voltage": {
        "mode": "avg",
        "block": 0,
        "scale": 10,
        "offset": 4,
        "dataType": "S16"
      },
      "mppt3_voltage": {
        "mode": "avg",
        "block": 0,
        "scale": 10,
        "offset": 8,
        "dataType": "S16"
      },
      "mppt4_voltage": {
        "mode": "avg",
        "block": 0,
        "scale": 10,
        "offset": 12,
        "dataType": "S16"
      },
      "mppt5_voltage": {
        "mode": "avg",
        "block": 0,
        "scale": 10,
        "offset": 16,
        "dataType": "S16"
      },
      "mppt6_voltage": {
        "mode": "avg",
        "block": 0,
        "scale": 10,
        "offset": 20,
        "dataType": "S16"
      },
      "mppt7_voltage": {
        "mode": "avg",
        "block": 0,
        "scale": 10,
        "offset": 24,
        "dataType": "S16"
      },
      "mppt8_voltage": {
        "mode": "avg",
        "block": 0,
        "scale": 10,
        "offset": 28,
        "dataType": "S16"
      },
      "mppt9_voltage": {
        "mode": "avg",
        "block": 0,
        "scale": 10,
        "offset": 32,
        "dataType": "S16"
      },
      "nominal_power": {
        "mode": "last",
        "block": 3,
        "scale": 1000,
        "offset": 3,
        "dataType": "U32"
      },
      "dc_total_power": {
        "mode": "avg",
        "block": 1,
        "scale": 1,
        "offset": 0,
        "dataType": "S32"
      },
      "mppt10_voltage": {
        "mode": "avg",
        "block": 0,
        "scale": 10,
        "offset": 36,
        "dataType": "S16"
      },
      "pid_alarm_code": {
        "mode": "last",
        "block": 1,
        "scale": 1,
        "offset": 26,
        "dataType": "U16"
      },
      "potencia_ativa": {
        "mode": "last",
        "block": 1,
        "scale": 1,
        "offset": 16,
        "dataType": "S32"
      },
      "string1_current": {
        "mode": "avg",
        "block": 0,
        "scale": 100,
        "offset": 1,
        "dataType": "S16"
      },
      "string2_current": {
        "mode": "avg",
        "block": 0,
        "scale": 100,
        "offset": 3,
        "dataType": "S16"
      },
      "string3_current": {
        "mode": "avg",
        "block": 0,
        "scale": 100,
        "offset": 5,
        "dataType": "S16"
      },
      "string4_current": {
        "mode": "avg",
        "block": 0,
        "scale": 100,
        "offset": 7,
        "dataType": "S16"
      },
      "string5_current": {
        "mode": "avg",
        "block": 0,
        "scale": 100,
        "offset": 9,
        "dataType": "S16"
      },
      "string6_current": {
        "mode": "avg",
        "block": 0,
        "scale": 100,
        "offset": 11,
        "dataType": "S16"
      },
      "string7_current": {
        "mode": "avg",
        "block": 0,
        "scale": 100,
        "offset": 13,
        "dataType": "S16"
      },
      "string8_current": {
        "mode": "avg",
        "block": 0,
        "scale": 100,
        "offset": 15,
        "dataType": "S16"
      },
      "string9_current": {
        "mode": "avg",
        "block": 0,
        "scale": 100,
        "offset": 17,
        "dataType": "S16"
      },
      "potencia_reativa": {
        "mode": "last",
        "block": 1,
        "scale": 1,
        "offset": 18,
        "dataType": "S32"
      },
      "string10_current": {
        "mode": "avg",
        "block": 0,
        "scale": 100,
        "offset": 19,
        "dataType": "S16"
      },
      "string11_current": {
        "mode": "avg",
        "block": 0,
        "scale": 100,
        "offset": 21,
        "dataType": "S16"
      },
      "string12_current": {
        "mode": "avg",
        "block": 0,
        "scale": 100,
        "offset": 23,
        "dataType": "S16"
      },
      "string13_current": {
        "mode": "avg",
        "block": 0,
        "scale": 100,
        "offset": 25,
        "dataType": "S16"
      },
      "string14_current": {
        "mode": "avg",
        "block": 0,
        "scale": 100,
        "offset": 27,
        "dataType": "S16"
      },
      "string15_current": {
        "mode": "avg",
        "block": 0,
        "scale": 100,
        "offset": 29,
        "dataType": "S16"
      },
      "string16_current": {
        "mode": "avg",
        "block": 0,
        "scale": 100,
        "offset": 31,
        "dataType": "S16"
      },
      "string17_current": {
        "mode": "avg",
        "block": 0,
        "scale": 100,
        "offset": 33,
        "dataType": "S16"
      },
      "string18_current": {
        "mode": "avg",
        "block": 0,
        "scale": 100,
        "offset": 35,
        "dataType": "S16"
      },
      "string19_current": {
        "mode": "avg",
        "block": 0,
        "scale": 100,
        "offset": 37,
        "dataType": "S16"
      },
      "string20_current": {
        "mode": "avg",
        "block": 0,
        "scale": 100,
        "offset": 39,
        "dataType": "S16"
      },
      "insulation_resistance": {
        "mode": "last",
        "block": 1,
        "scale": 1000,
        "offset": 24,
        "dataType": "U16"
      }
    },
    "bi_map": {},
    "bo_map": {},
    "ai_blocks": [
      {
        "func": 3,
        "count": 40,
        "label": "Regs 32016-32055: PV1-20 V/I (10 MPPTs x 2 strings)",
        "start": 32016
      },
      {
        "func": 3,
        "count": 27,
        "label": "Regs 32064-32090: P, V, I, freq, temp, isolamento, status, fault",
        "start": 32064
      },
      {
        "func": 3,
        "count": 10,
        "label": "Regs 32106-32115: energia total e diaria",
        "start": 32106
      },
      {
        "func": 3,
        "count": 5,
        "label": "Regs 30070-30074: Model ID + Rated Power",
        "start": 30070
      }
    ],
    "num_mppts": 10,
    "word_order": "high_first",
    "num_strings": 20
  },
  "a966-ssu": {
    "fabricante": "IMS",
    "modelo": "A966",
    "tipo": "gateway_medidor",
    "protocolo": "serial",
    "connection_note": "Gateway A-966 le SSU via serial proprietario e publica JSON em /SSU/state.",
    "kd": {
      "default": 0.3
    },
    "ai_map": {
      "phf": {
        "unit": "kWh",
        "apply_factor": "kd"
      },
      "phr": {
        "unit": "kWh",
        "apply_factor": "kd"
      },
      "qhfc": {
        "unit": "kVArh",
        "apply_factor": "kd"
      },
      "qhfi": {
        "unit": "kVArh",
        "apply_factor": "kd"
      },
      "qhrc": {
        "unit": "kVArh",
        "apply_factor": "kd"
      },
      "qhri": {
        "unit": "kVArh",
        "apply_factor": "kd"
      }
    },
    "bi_map": {
      "sts": {
        "unit": "enum"
      }
    },
    "bo_map": {},
    "ai_blocks": []
  },
  "ims-m160": {
    "fabricante": "IMS",
    "modelo": "M160",
    "tipo": "medidor_energia",
    "protocolo": "rtu",
    "connection_note": "IMS Kron M160 — TC/leitura primária. Currents reportados pelo Modbus em mA (scale 1000). Variante minoritária pode reportar em cA (scale 100); ajustar por excecao se necessario.",
    "tp_tc": {
      "count": 2,
      "register": 3,
      "scale_tc": 1,
      "scale_tp": 1,
      "tc_offset": 1,
      "tp_offset": 0
    },
    "ai_map": {
      "ia": {
        "block": 0,
        "scale": 1000,
        "offset": 6,
        "dataType": "U16",
        "decimal_src": "dct"
      },
      "ib": {
        "block": 0,
        "scale": 1000,
        "offset": 7,
        "dataType": "U16",
        "decimal_src": "dct"
      },
      "ic": {
        "block": 0,
        "scale": 1000,
        "offset": 8,
        "dataType": "U16",
        "decimal_src": "dct"
      },
      "pt": {
        "block": 0,
        "scale": 1,
        "offset": 12,
        "dataType": "S16",
        "decimal_src": "dpq"
      },
      "qt": {
        "block": 0,
        "scale": 1,
        "offset": 16,
        "dataType": "S16",
        "decimal_src": "dpq"
      },
      "st": {
        "block": 0,
        "scale": 1,
        "offset": 24,
        "dataType": "U16",
        "decimal_src": "dpq"
      },
      "va": {
        "block": 0,
        "scale": 10,
        "offset": 0,
        "dataType": "U16",
        "decimal_src": "dpt"
      },
      "vb": {
        "block": 0,
        "scale": 10,
        "offset": 1,
        "dataType": "U16",
        "decimal_src": "dpt"
      },
      "vc": {
        "block": 0,
        "scale": 10,
        "offset": 2,
        "dataType": "U16",
        "decimal_src": "dpt"
      },
      "phf": {
        "mode": "last",
        "block": 0,
        "scale": 1000,
        "offset": 27,
        "dataType": "U16"
      },
      "fp_a": {
        "block": 0,
        "scale": 1000,
        "offset": 17,
        "dataType": "S16"
      },
      "fp_b": {
        "block": 0,
        "scale": 1000,
        "offset": 18,
        "dataType": "S16"
      },
      "fp_c": {
        "block": 0,
        "scale": 1000,
        "offset": 19,
        "dataType": "S16"
      },
      "fp_t": {
        "block": 0,
        "scale": 1000,
        "offset": 20,
        "dataType": "S16"
      },
      "freq": {
        "block": 0,
        "scale": 100,
        "offset": 25,
        "dataType": "U16"
      },
      "consumo_phf": {
        "mode": "delta",
        "block": 0,
        "scale": 1000,
        "offset": 27,
        "dataType": "U16",
        "clamp_negative": true
      },
      "consumo_phr": {
        "mode": "delta",
        "block": 0,
        "scale": 1000,
        "offset": 29,
        "dataType": "U16",
        "clamp_negative": true
      },
      "consumo_qhf": {
        "mode": "delta",
        "block": 0,
        "scale": 1000,
        "offset": 31,
        "dataType": "U16",
        "clamp_negative": true
      },
      "consumo_qhr": {
        "mode": "delta",
        "block": 0,
        "scale": 1000,
        "offset": 33,
        "dataType": "U16",
        "clamp_negative": true
      }
    },
    "bi_map": {},
    "bo_map": {},
    "ai_blocks": [
      {
        "func": 3,
        "count": 34,
        "label": "V, I, P, Q, FP, S, Energia (37..70)",
        "start": 37
      }
    ],
    "decimal_regs": {
      "sign": {
        "byte": "lo",
        "word": 1
      },
      "count": 2,
      "layout": {
        "dct": {
          "byte": "lo",
          "word": 0,
          "baseline": 1
        },
        "dpq": {
          "byte": "hi",
          "word": 1,
          "baseline": 4
        },
        "dpt": {
          "byte": "hi",
          "word": 0,
          "baseline": 3
        }
      },
      "register": 35
    }
  },
  "lg-e750-ssu": {
    "fabricante": "Landis+Gyr",
    "modelo": "E750 A2E3 (SSU NBR 14522)",
    "tipo": "gateway_medidor",
    "protocolo": "ssu",
    "connection_note": "Saida Serial de Usuario (ABNT NBR 14522) na entrada SU+ da TON-V2: X14-2 = SU+, X14-1 = SU- (GND). 110 baud, 8N1, bloco estendido (9 octetos) ou normal (8). Ke por medidor.",
    "kd": {
      "note": "kWh por pulso — confirmar Ke real (potencia conhecida x tempo); parametrizavel por no no diagrama (ke)",
      "default": 0.048
    },
    "ssu": {
      "baud": 110,
      "formato": "auto",
      "intervalo_demanda_min": 15,
      "intervalo_reativo_min": 60
    },
    "ai_map": {
      "phf": {
        "unit": "kWh",
        "label": "Energia ativa direta (REG1)",
        "apply_factor": "kd"
      },
      "phr": {
        "unit": "kWh",
        "label": "Energia ativa reversa (REG2)",
        "apply_factor": "kd"
      },
      "qhfc": {
        "unit": "kVArh",
        "label": "Reativa Q4 capacitiva (REG6)",
        "apply_factor": "kd"
      },
      "qhfi": {
        "unit": "kVArh",
        "label": "Reativa Q1 indutiva (REG3)",
        "apply_factor": "kd"
      },
      "qhrc": {
        "unit": "kVArh",
        "label": "Reativa Q3 capacitiva (REG5)",
        "apply_factor": "kd"
      },
      "qhri": {
        "unit": "kVArh",
        "label": "Reativa Q2 indutiva (REG4)",
        "apply_factor": "kd"
      }
    },
    "bi_map": {
      "sts": {
        "unit": "enum",
        "label": "Enlace SSU ok (1) / degradado (0)"
      }
    },
    "bo_map": {},
    "ai_blocks": []
  },
  "pextron-urp6000": {
    "fabricante": "Pextron",
    "modelo": "URP6000",
    "tipo": "rele_protecao",
    "protocolo": "tcp_usr",
    "connection_note": "RS485 via conversor USR-W610 (Modbus TCP ↔ RTU)",
    "ai_map": {
      "ia": {
        "block": 0,
        "scale": "current",
        "offset": 0,
        "dataType": "U16"
      },
      "ib": {
        "block": 0,
        "scale": "current",
        "offset": 1,
        "dataType": "U16"
      },
      "ic": {
        "block": 0,
        "scale": "current",
        "offset": 2,
        "dataType": "U16"
      },
      "in": {
        "block": 0,
        "scale": "current",
        "offset": 4,
        "dataType": "U16"
      },
      "va": {
        "block": 0,
        "scale": "voltage",
        "offset": 5,
        "dataType": "U16"
      },
      "vb": {
        "block": 0,
        "scale": "voltage",
        "offset": 6,
        "dataType": "U16"
      },
      "vc": {
        "block": 0,
        "scale": "voltage",
        "offset": 7,
        "dataType": "U16"
      },
      "freq": {
        "block": 0,
        "scale": "freq",
        "offset": 11,
        "dataType": "U16"
      },
      "cosfi_a": {
        "block": 0,
        "scale": "cosfi",
        "offset": 13,
        "dataType": "COSFI"
      },
      "cosfi_b": {
        "block": 0,
        "scale": "cosfi",
        "offset": 14,
        "dataType": "COSFI"
      },
      "cosfi_c": {
        "block": 0,
        "scale": "cosfi",
        "offset": 15,
        "dataType": "COSFI"
      },
      "pa_total": {
        "block": 0,
        "count": 3,
        "scale": "power",
        "offset": 17,
        "dataType": "U32_SUM3",
        "regs_per": 2
      },
      "pr_total": {
        "block": 1,
        "scale": 4,
        "offset": 4,
        "dataType": "U16"
      }
    },
    "bi_map": {
      "f46": {
        "coil": 23
      },
      "f47": {
        "coil": 34
      },
      "f78": {
        "coil": 32
      },
      "f81": {
        "coil": 26
      },
      "f86": {
        "coil": 33
      },
      "fba": {
        "coil": 7
      },
      "f27a": {
        "coil": 2
      },
      "f27b": {
        "coil": 1
      },
      "f27c": {
        "coil": 0
      },
      "f32a": {
        "coil": 10
      },
      "f32b": {
        "coil": 9
      },
      "f32c": {
        "coil": 8
      },
      "f50a": {
        "coil": 14
      },
      "f50b": {
        "coil": 13
      },
      "f50c": {
        "coil": 12
      },
      "f50n": {
        "coil": 11
      },
      "f51a": {
        "coil": 6
      },
      "f51b": {
        "coil": 5
      },
      "f51c": {
        "coil": 4
      },
      "f51n": {
        "coil": 3
      },
      "f59a": {
        "coil": 30
      },
      "f59b": {
        "coil": 29
      },
      "f59c": {
        "coil": 28
      },
      "f59n": {
        "coil": 27
      },
      "f67a": {
        "coil": 22
      },
      "f67b": {
        "coil": 21
      },
      "f67c": {
        "coil": 20
      },
      "f67n": {
        "coil": 19
      },
      "local_remoto": {
        "func": 3,
        "register": 673,
        "value_map": {
          "0": "LOCAL",
          "256": "REMOTO"
        }
      }
    },
    "bo_map": {
      "cmd_abrir": {
        "coil": 52,
        "func": 5
      },
      "cmd_reset": {
        "coil": 48,
        "func": 5
      },
      "cmd_fechar": {
        "coil": 51,
        "func": 5
      }
    },
    "scales": {
      "freq": 256,
      "cosfi": 256,
      "power": 1280,
      "current": 256,
      "voltage": 128
    },
    "bi_block": {
      "func": 1,
      "count": 53,
      "start": 0
    },
    "ai_blocks": [
      {
        "func": 3,
        "count": 23,
        "label": "Analógicos principais",
        "start": 700
      },
      {
        "func": 3,
        "count": 10,
        "label": "DNP simplificado + energia",
        "start": 812
      },
      {
        "func": 3,
        "count": 1,
        "label": "Local/Remoto",
        "start": 673
      }
    ],
    "handshake": {
      "func": 3,
      "count": 2,
      "register": 136
    },
    "bo_outputs": [
      {
        "id": "abrir",
        "coil": 52,
        "func": 5,
        "label": "Abrir / TRIP (matriz)"
      },
      {
        "id": "fechar",
        "coil": 51,
        "func": 5,
        "label": "Fechar / CLOSE (matriz)"
      },
      {
        "id": "reset",
        "coil": 48,
        "func": 5,
        "label": "Resetar LEDs"
      }
    ]
  },
  "schneider-pm1200": {
    "fabricante": "SCHNEIDER",
    "modelo": "PM1200",
    "tipo": "medidor_energia",
    "protocolo": "rtu",
    "connection_note": "RS485 Modbus RTU 9600 8-E-1 (fn 0x03). Float 32-bit F.Seq=4321 (Big-Endian). Valores PRIMARIOS (sem TP/TC). Tb via Modbus TCP (conversor USR). Conferir off-by-one 3901 e unidade da energia na bancada.",
    "ai_map": {
      "ia": {
        "block": 0,
        "scale": 1,
        "offset": 28,
        "dataType": "FLOAT"
      },
      "ib": {
        "block": 0,
        "scale": 1,
        "offset": 42,
        "dataType": "FLOAT"
      },
      "ic": {
        "block": 0,
        "scale": 1,
        "offset": 56,
        "dataType": "FLOAT"
      },
      "pt": {
        "block": 0,
        "scale": 1,
        "offset": 2,
        "dataType": "FLOAT"
      },
      "qt": {
        "block": 0,
        "scale": 1,
        "offset": 4,
        "dataType": "FLOAT"
      },
      "st": {
        "block": 0,
        "scale": 1,
        "offset": 0,
        "dataType": "FLOAT"
      },
      "va": {
        "block": 0,
        "scale": 1,
        "offset": 26,
        "dataType": "FLOAT"
      },
      "vb": {
        "block": 0,
        "scale": 1,
        "offset": 40,
        "dataType": "FLOAT"
      },
      "vc": {
        "block": 0,
        "scale": 1,
        "offset": 54,
        "dataType": "FLOAT"
      },
      "phf": {
        "mode": "last",
        "block": 1,
        "scale": 1,
        "offset": 2,
        "dataType": "FLOAT"
      },
      "fp_a": {
        "block": 0,
        "scale": 1,
        "offset": 22,
        "dataType": "FLOAT"
      },
      "fp_b": {
        "block": 0,
        "scale": 1,
        "offset": 36,
        "dataType": "FLOAT"
      },
      "fp_c": {
        "block": 0,
        "scale": 1,
        "offset": 50,
        "dataType": "FLOAT"
      },
      "fp_t": {
        "block": 0,
        "scale": 1,
        "offset": 6,
        "dataType": "FLOAT"
      },
      "freq": {
        "block": 0,
        "scale": 1,
        "offset": 14,
        "dataType": "FLOAT"
      },
      "consumo_phf": {
        "mode": "delta",
        "block": 1,
        "scale": 1,
        "offset": 2,
        "dataType": "FLOAT",
        "clamp_negative": true
      },
      "consumo_phr": {
        "mode": "delta",
        "block": 1,
        "scale": 1,
        "offset": 10,
        "dataType": "FLOAT",
        "clamp_negative": true
      },
      "consumo_qhf": {
        "mode": "delta",
        "block": 1,
        "scale": 1,
        "offset": 4,
        "dataType": "FLOAT",
        "clamp_negative": true
      },
      "consumo_qhr": {
        "mode": "delta",
        "block": 1,
        "scale": 1,
        "offset": 12,
        "dataType": "FLOAT",
        "clamp_negative": true
      }
    },
    "bi_map": {},
    "bo_map": {},
    "ai_blocks": [
      {
        "func": 3,
        "count": 58,
        "label": "VA/W/VAR/PF/F + V/I/PF por fase (3901..3957)",
        "start": 3901
      },
      {
        "func": 3,
        "count": 16,
        "label": "Energias Fwd/Rev VAh/Wh/VARh (3959..3973)",
        "start": 3959
      }
    ]
  },
  "schneider-p3u30": {
    "fabricante": "Schneider",
    "modelo": "P3U30",
    "tipo": "rele_protecao",
    "protocolo": "rtu",
    "connection_note": "RS485 9600 (parity None=8N2 OU Even=8E1 — config eSetup). Slave 1-247.",
    "ai_map": {
      "ia": {
        "mode": "avg",
        "block": 0,
        "scale": 1,
        "offset": 0,
        "dataType": "U16"
      },
      "ib": {
        "mode": "avg",
        "block": 0,
        "scale": 1,
        "offset": 1,
        "dataType": "U16"
      },
      "ic": {
        "mode": "avg",
        "block": 0,
        "scale": 1,
        "offset": 2,
        "dataType": "U16"
      },
      "va": {
        "mode": "avg",
        "block": 0,
        "scale": 1,
        "offset": 8,
        "dataType": "U16"
      },
      "vb": {
        "mode": "avg",
        "block": 0,
        "scale": 1,
        "offset": 9,
        "dataType": "U16"
      },
      "vc": {
        "mode": "avg",
        "block": 0,
        "scale": 1,
        "offset": 10,
        "dataType": "U16"
      },
      "vab": {
        "mode": "avg",
        "block": 0,
        "scale": 1,
        "offset": 5,
        "dataType": "U16"
      },
      "vbc": {
        "mode": "avg",
        "block": 0,
        "scale": 1,
        "offset": 6,
        "dataType": "U16"
      },
      "vca": {
        "mode": "avg",
        "block": 0,
        "scale": 1,
        "offset": 7,
        "dataType": "U16"
      },
      "freq": {
        "mode": "last",
        "block": 0,
        "scale": 100,
        "offset": 12,
        "dataType": "U16"
      },
      "ar_locked": {
        "mode": "last",
        "block": 1,
        "scale": 1,
        "offset": 3,
        "dataType": "U16"
      },
      "ar_running": {
        "mode": "last",
        "block": 1,
        "scale": 1,
        "offset": 4,
        "dataType": "U16"
      },
      "final_trip": {
        "mode": "last",
        "block": 1,
        "scale": 1,
        "offset": 5,
        "dataType": "U16"
      },
      "cbw_alarm_1": {
        "mode": "last",
        "block": 1,
        "scale": 1,
        "offset": 19,
        "dataType": "U16"
      },
      "cbw_alarm_2": {
        "mode": "last",
        "block": 1,
        "scale": 1,
        "offset": 20,
        "dataType": "U16"
      },
      "total_trips": {
        "mode": "last",
        "block": 2,
        "scale": 1,
        "offset": 0,
        "dataType": "U16"
      },
      "in1_residual": {
        "mode": "avg",
        "block": 0,
        "scale": 100,
        "offset": 3,
        "dataType": "U16"
      },
      "di_validity_1": {
        "mode": "last",
        "block": 3,
        "scale": 1,
        "offset": 8,
        "dataType": "U16"
      },
      "di_validity_2": {
        "mode": "last",
        "block": 3,
        "scale": 1,
        "offset": 9,
        "dataType": "U16"
      },
      "di_validity_3": {
        "mode": "last",
        "block": 3,
        "scale": 1,
        "offset": 10,
        "dataType": "U16"
      },
      "di_validity_4": {
        "mode": "last",
        "block": 3,
        "scale": 1,
        "offset": 11,
        "dataType": "U16"
      },
      "mb_pf_scaling": {
        "mode": "last",
        "block": 2,
        "scale": 10,
        "offset": 17,
        "dataType": "U16"
      },
      "timer1_status": {
        "mode": "last",
        "block": 1,
        "scale": 1,
        "offset": 14,
        "dataType": "U16"
      },
      "timer2_status": {
        "mode": "last",
        "block": 1,
        "scale": 1,
        "offset": 15,
        "dataType": "U16"
      },
      "timer3_status": {
        "mode": "last",
        "block": 1,
        "scale": 1,
        "offset": 16,
        "dataType": "U16"
      },
      "timer4_status": {
        "mode": "last",
        "block": 1,
        "scale": 1,
        "offset": 17,
        "dataType": "U16"
      },
      "ar_shot_number": {
        "mode": "last",
        "block": 1,
        "scale": 1,
        "offset": 1,
        "dataType": "U16"
      },
      "cbm_open_count": {
        "mode": "last",
        "block": 3,
        "scale": 1,
        "offset": 0,
        "dataType": "U32"
      },
      "potencia_ativa": {
        "mode": "last",
        "block": 0,
        "scale": 1,
        "offset": 13,
        "dataType": "U16"
      },
      "voltage_status": {
        "mode": "last",
        "block": 1,
        "scale": 1,
        "offset": 13,
        "dataType": "U16"
      },
      "critical_ar_req": {
        "mode": "last",
        "block": 1,
        "scale": 1,
        "offset": 2,
        "dataType": "U16"
      },
      "auto_recloser_on": {
        "mode": "last",
        "block": 1,
        "scale": 1,
        "offset": 6,
        "dataType": "U16"
      },
      "cbm_trip_counter": {
        "mode": "last",
        "block": 3,
        "scale": 1,
        "offset": 4,
        "dataType": "U32"
      },
      "mb_power_scaling": {
        "mode": "last",
        "block": 2,
        "scale": 10,
        "offset": 16,
        "dataType": "U16"
      },
      "residual_voltage": {
        "mode": "avg",
        "block": 0,
        "scale": 10,
        "offset": 11,
        "dataType": "U16"
      },
      "il1_fault_current": {
        "mode": "last",
        "block": 2,
        "scale": 1,
        "offset": 4,
        "dataType": "U32"
      },
      "il2_fault_current": {
        "mode": "last",
        "block": 2,
        "scale": 1,
        "offset": 6,
        "dataType": "U32"
      },
      "il3_fault_current": {
        "mode": "last",
        "block": 2,
        "scale": 1,
        "offset": 8,
        "dataType": "U32"
      },
      "io1_fault_current": {
        "mode": "last",
        "block": 2,
        "scale": 100,
        "offset": 10,
        "dataType": "U32"
      },
      "io2_fault_current": {
        "mode": "last",
        "block": 2,
        "scale": 100,
        "offset": 12,
        "dataType": "U32"
      },
      "voltage_interrupt": {
        "mode": "last",
        "block": 1,
        "scale": 1,
        "offset": 12,
        "dataType": "U16"
      },
      "logic_outputs_1_10": {
        "mode": "last",
        "block": 1,
        "scale": 1,
        "offset": 18,
        "dataType": "U16"
      },
      "logic_outputs_9_16": {
        "mode": "last",
        "block": 1,
        "scale": 1,
        "offset": 21,
        "dataType": "U16"
      },
      "logic_outputs_17_20": {
        "mode": "last",
        "block": 1,
        "scale": 1,
        "offset": 22,
        "dataType": "U16"
      },
      "iocalc_fault_current": {
        "mode": "last",
        "block": 2,
        "scale": 100,
        "offset": 14,
        "dataType": "U32"
      },
      "virtual_outputs_1_16": {
        "mode": "last",
        "block": 1,
        "scale": 1,
        "offset": 25,
        "dataType": "U16"
      }
    },
    "bi_map": {},
    "bo_map": {
      "cmd_trip": {
        "steps": [
          {
            "func": 6,
            "value": 1,
            "register": 2507
          },
          {
            "func": 6,
            "value": 1,
            "register": 2509
          }
        ],
        "delay_ms": 50
      },
      "cmd_close": {
        "steps": [
          {
            "func": 6,
            "value": 1,
            "register": 2508
          },
          {
            "func": 6,
            "value": 1,
            "register": 2509
          }
        ],
        "delay_ms": 50
      },
      "cmd_reset": {
        "func": 6,
        "value": 1,
        "register": 2500
      },
      "cmd_open_obj1": {
        "steps": [
          {
            "func": 6,
            "value": 1,
            "register": 2507
          },
          {
            "func": 6,
            "value": 1,
            "register": 2509
          }
        ],
        "delay_ms": 50
      },
      "cmd_open_obj2": {
        "steps": [
          {
            "func": 6,
            "value": 1,
            "register": 2511
          },
          {
            "func": 6,
            "value": 1,
            "register": 2513
          }
        ],
        "delay_ms": 50
      },
      "cmd_open_obj3": {
        "steps": [
          {
            "func": 6,
            "value": 1,
            "register": 2516
          },
          {
            "func": 6,
            "value": 1,
            "register": 2518
          }
        ],
        "delay_ms": 50
      },
      "cmd_open_obj4": {
        "steps": [
          {
            "func": 6,
            "value": 1,
            "register": 2520
          },
          {
            "func": 6,
            "value": 1,
            "register": 2522
          }
        ],
        "delay_ms": 50
      },
      "cmd_open_obj5": {
        "steps": [
          {
            "func": 6,
            "value": 1,
            "register": 2526
          },
          {
            "func": 6,
            "value": 1,
            "register": 2528
          }
        ],
        "delay_ms": 50
      },
      "cmd_open_obj6": {
        "steps": [
          {
            "func": 6,
            "value": 1,
            "register": 2530
          },
          {
            "func": 6,
            "value": 1,
            "register": 2532
          }
        ],
        "delay_ms": 50
      },
      "cmd_open_obj7": {
        "steps": [
          {
            "func": 6,
            "value": 1,
            "register": 2537
          },
          {
            "func": 6,
            "value": 1,
            "register": 2539
          }
        ],
        "delay_ms": 50
      },
      "cmd_open_obj8": {
        "steps": [
          {
            "func": 6,
            "value": 1,
            "register": 2541
          },
          {
            "func": 6,
            "value": 1,
            "register": 2543
          }
        ],
        "delay_ms": 50
      },
      "cmd_close_obj1": {
        "steps": [
          {
            "func": 6,
            "value": 1,
            "register": 2508
          },
          {
            "func": 6,
            "value": 1,
            "register": 2509
          }
        ],
        "delay_ms": 50
      },
      "cmd_close_obj2": {
        "steps": [
          {
            "func": 6,
            "value": 1,
            "register": 2512
          },
          {
            "func": 6,
            "value": 1,
            "register": 2513
          }
        ],
        "delay_ms": 50
      },
      "cmd_close_obj3": {
        "steps": [
          {
            "func": 6,
            "value": 1,
            "register": 2517
          },
          {
            "func": 6,
            "value": 1,
            "register": 2518
          }
        ],
        "delay_ms": 50
      },
      "cmd_close_obj4": {
        "steps": [
          {
            "func": 6,
            "value": 1,
            "register": 2521
          },
          {
            "func": 6,
            "value": 1,
            "register": 2522
          }
        ],
        "delay_ms": 50
      },
      "cmd_close_obj5": {
        "steps": [
          {
            "func": 6,
            "value": 1,
            "register": 2527
          },
          {
            "func": 6,
            "value": 1,
            "register": 2528
          }
        ],
        "delay_ms": 50
      },
      "cmd_close_obj6": {
        "steps": [
          {
            "func": 6,
            "value": 1,
            "register": 2531
          },
          {
            "func": 6,
            "value": 1,
            "register": 2532
          }
        ],
        "delay_ms": 50
      },
      "cmd_close_obj7": {
        "steps": [
          {
            "func": 6,
            "value": 1,
            "register": 2538
          },
          {
            "func": 6,
            "value": 1,
            "register": 2539
          }
        ],
        "delay_ms": 50
      },
      "cmd_close_obj8": {
        "steps": [
          {
            "func": 6,
            "value": 1,
            "register": 2542
          },
          {
            "func": 6,
            "value": 1,
            "register": 2543
          }
        ],
        "delay_ms": 50
      },
      "cmd_clear_min_max": {
        "func": 6,
        "value": 1,
        "register": 2535
      },
      "cmd_release_latches": {
        "func": 6,
        "value": 1,
        "register": 2500
      },
      "cmd_cancel_operation": {
        "func": 6,
        "value": 1,
        "register": 2515
      },
      "cmd_reset_diagnostics": {
        "func": 6,
        "value": 1,
        "register": 2534
      }
    },
    "ai_blocks": [
      {
        "func": 3,
        "count": 14,
        "label": "Regs 402009-402022: I, V, freq, P",
        "start": 2008
      },
      {
        "func": 3,
        "count": 26,
        "label": "Regs 403401-403426: AR, voltage status, LOs, VOs",
        "start": 3400
      },
      {
        "func": 3,
        "count": 18,
        "label": "Regs 405501-405518: total trips, fault currents",
        "start": 5500
      },
      {
        "func": 3,
        "count": 13,
        "label": "Regs 405813-405825: CBM open/trip counters, DI validity",
        "start": 5812
      }
    ],
    "word_order": "high_first"
  },
  "siemens-7sr10": {
    "fabricante": "Siemens",
    "modelo": "7SR10",
    "tipo": "rele_protecao",
    "protocolo": "rtu",
    "connection_note": "RS485 default 19200 baud, slave 1-247. Confirmar paridade (TON=8N1). Mapa fixo de fabrica.",
    "ai_map": {
      "ia": {
        "block": 0,
        "scale": 1000,
        "offset": 48,
        "dataType": "S32"
      },
      "ib": {
        "block": 0,
        "scale": 1000,
        "offset": 50,
        "dataType": "S32"
      },
      "ic": {
        "block": 0,
        "scale": 1000,
        "offset": 52,
        "dataType": "S32"
      },
      "in": {
        "block": 0,
        "scale": 1000,
        "offset": 72,
        "dataType": "S32"
      },
      "va": {
        "block": 0,
        "scale": 1000,
        "offset": 0,
        "dataType": "S32"
      },
      "vb": {
        "block": 0,
        "scale": 1000,
        "offset": 2,
        "dataType": "S32"
      },
      "vc": {
        "block": 0,
        "scale": 1000,
        "offset": 4,
        "dataType": "S32"
      },
      "freq": {
        "block": 0,
        "scale": 1000,
        "offset": 44,
        "dataType": "S32"
      },
      "cosfi_a": {
        "block": 1,
        "scale": 1000,
        "offset": 18,
        "dataType": "S32"
      },
      "cosfi_b": {
        "block": 1,
        "scale": 1000,
        "offset": 20,
        "dataType": "S32"
      },
      "cosfi_c": {
        "block": 1,
        "scale": 1000,
        "offset": 22,
        "dataType": "S32"
      },
      "pa_total": {
        "block": 1,
        "scale": 1000,
        "offset": 0,
        "dataType": "S32"
      },
      "pr_total": {
        "block": 1,
        "scale": 1000,
        "offset": 8,
        "dataType": "S32"
      }
    },
    "bi_map": {
      "f46": {
        "coil": 48
      },
      "f47": {
        "coil": 50
      },
      "f81": {
        "coil": 59
      },
      "fba": {
        "coil": 44
      },
      "f27a": {
        "coil": 299
      },
      "f27b": {
        "coil": 300
      },
      "f27c": {
        "coil": 301
      },
      "f50a": {
        "coil": 21
      },
      "f50b": {
        "coil": 27
      },
      "f50c": {
        "coil": 33
      },
      "f50n": {
        "coil": 23
      },
      "f51a": {
        "coil": 20
      },
      "f51b": {
        "coil": 26
      },
      "f51c": {
        "coil": 32
      },
      "f51n": {
        "coil": 22
      },
      "f59a": {
        "coil": 299
      },
      "f59b": {
        "coil": 300
      },
      "f59c": {
        "coil": 301
      },
      "f59n": {
        "coil": 57
      },
      "dj_aberto": {
        "coil": 117
      },
      "dj_bloqueado": {
        "coil": 72
      },
      "local_remoto": {
        "coil": 2
      }
    },
    "bo_map": {
      "cmd_abrir": {
        "coil": 226,
        "func": 5
      },
      "cmd_reset": {
        "coil": 99,
        "func": 5
      },
      "cmd_fechar": {
        "coil": 108,
        "func": 5
      }
    },
    "bi_block": {
      "func": 2,
      "count": 302,
      "start": 101
    },
    "ai_blocks": [
      {
        "func": 4,
        "count": 74,
        "label": "V, freq, I, In (Modicon 30016-30089)",
        "start": 15
      },
      {
        "func": 4,
        "count": 24,
        "label": "P, Q, PF (Modicon 30118-30141)",
        "start": 117
      }
    ],
    "word_order": "high_first"
  },
  "siemens-7sr5": {
    "fabricante": "Siemens",
    "modelo": "7SR5",
    "tipo": "rele_protecao",
    "protocolo": "rtu",
    "connection_note": "RS485 default 38400 baud, slave 1-247. Mapa espelhado do 7SR10 via Reydisp Manager 2. TCP 502 disponivel.",
    "ai_map": {
      "ia": {
        "block": 2,
        "scale": 1000,
        "offset": 0,
        "dataType": "S32"
      },
      "ib": {
        "block": 2,
        "scale": 1000,
        "offset": 2,
        "dataType": "S32"
      },
      "ic": {
        "block": 2,
        "scale": 1000,
        "offset": 4,
        "dataType": "S32"
      },
      "in": {
        "block": 3,
        "scale": 1000,
        "offset": 0,
        "dataType": "S32"
      },
      "va": {
        "block": 0,
        "scale": 1000,
        "offset": 0,
        "dataType": "S32"
      },
      "vb": {
        "block": 0,
        "scale": 1000,
        "offset": 2,
        "dataType": "S32"
      },
      "vc": {
        "block": 0,
        "scale": 1000,
        "offset": 4,
        "dataType": "S32"
      },
      "freq": {
        "block": 1,
        "scale": 1000,
        "offset": 0,
        "dataType": "S32"
      },
      "cosfi_a": {
        "block": 6,
        "scale": 1000,
        "offset": 0,
        "dataType": "S32"
      },
      "cosfi_b": {
        "block": 6,
        "scale": 1000,
        "offset": 2,
        "dataType": "S32"
      },
      "cosfi_c": {
        "block": 6,
        "scale": 1000,
        "offset": 4,
        "dataType": "S32"
      },
      "pa_total": {
        "block": 4,
        "scale": 1000,
        "offset": 0,
        "dataType": "S32"
      },
      "pr_total": {
        "block": 5,
        "scale": 1000,
        "offset": 0,
        "dataType": "S32"
      }
    },
    "bi_map": {
      "f46": {
        "coil": 48
      },
      "f47": {
        "coil": 50
      },
      "f81": {
        "coil": 59
      },
      "fba": {
        "coil": 44
      },
      "f27a": {
        "coil": 299
      },
      "f27b": {
        "coil": 300
      },
      "f27c": {
        "coil": 301
      },
      "f50a": {
        "coil": 21
      },
      "f50b": {
        "coil": 27
      },
      "f50c": {
        "coil": 33
      },
      "f50n": {
        "coil": 23
      },
      "f51a": {
        "coil": 20
      },
      "f51b": {
        "coil": 26
      },
      "f51c": {
        "coil": 32
      },
      "f51n": {
        "coil": 22
      },
      "f59a": {
        "coil": 299
      },
      "f59b": {
        "coil": 300
      },
      "f59c": {
        "coil": 301
      },
      "f59n": {
        "coil": 57
      },
      "dj_aberto": {
        "coil": 466
      },
      "dj_fechado": {
        "coil": 460
      },
      "dj_bloqueado": {
        "coil": 72
      },
      "local_remoto": {
        "coil": 2
      }
    },
    "bo_map": {
      "cmd_abrir": {
        "func": 5
      },
      "cmd_reset": {
        "func": 5
      },
      "cmd_fechar": {
        "func": 5
      }
    },
    "eventos": {
      "nota": "Buffer de evento IEC-103-like sobre Modbus (7SR manual 6.1). Ler EVENT da pop; qty DEVE ser 8; excecao 2 = fila vazia (nao e erro). Relogio do rele: SNTP/Reydisp, nao via Modbus.",
      "count": {
        "reg": 0,
        "func": 4
      },
      "record": {
        "qty": 8,
        "reg": 1,
        "func": 4
      },
      "poll_ms": 2000,
      "protocolo": "modbus_7sr",
      "excecao_vazio": 2
    },
    "bi_block": {
      "func": 2,
      "count": 467,
      "start": 101
    },
    "ai_blocks": [
      {
        "func": 4,
        "count": 6,
        "label": "Va/Vb/Vc 30016-30021",
        "start": 15
      },
      {
        "func": 4,
        "count": 2,
        "label": "Freq 30060",
        "start": 59
      },
      {
        "func": 4,
        "count": 6,
        "label": "Ia/Ib/Ic 30064-30069",
        "start": 63
      },
      {
        "func": 4,
        "count": 2,
        "label": "In 30088",
        "start": 87
      },
      {
        "func": 4,
        "count": 2,
        "label": "P 3ph 30118",
        "start": 117
      },
      {
        "func": 4,
        "count": 2,
        "label": "Q 3ph 30126",
        "start": 125
      },
      {
        "func": 4,
        "count": 6,
        "label": "PF A/B/C 30136-30141",
        "start": 135
      }
    ],
    "bo_outputs": [
      {
        "id": "bo1",
        "coil": 0,
        "func": 5,
        "hold": true,
        "label": "Binary Output 1"
      },
      {
        "id": "bo2",
        "coil": 1,
        "func": 5,
        "hold": true,
        "label": "Binary Output 2"
      },
      {
        "id": "bo3",
        "coil": 2,
        "func": 5,
        "hold": true,
        "label": "Binary Output 3"
      },
      {
        "id": "bo4",
        "coil": 3,
        "func": 5,
        "hold": true,
        "label": "Binary Output 4"
      },
      {
        "id": "bo5",
        "coil": 4,
        "func": 5,
        "hold": true,
        "label": "Binary Output 5"
      },
      {
        "id": "bo6",
        "coil": 5,
        "func": 5,
        "hold": true,
        "label": "Binary Output 6"
      },
      {
        "id": "bo7",
        "coil": 6,
        "func": 5,
        "hold": true,
        "label": "Binary Output 7"
      },
      {
        "id": "bo8",
        "coil": 7,
        "func": 5,
        "hold": true,
        "label": "Binary Output 8"
      },
      {
        "id": "cb1",
        "coil": 109,
        "func": 5,
        "label": "CB-1 (controle do disjuntor)"
      },
      {
        "id": "led_reset",
        "coil": 99,
        "func": 5,
        "label": "LED Reset (rearme)"
      },
      {
        "id": "user_sp1",
        "coil": 199,
        "func": 5,
        "hold": true,
        "label": "User SP Command 1"
      },
      {
        "id": "user_sp2",
        "coil": 200,
        "func": 5,
        "hold": true,
        "label": "User SP Command 2"
      },
      {
        "id": "user_sp3",
        "coil": 201,
        "func": 5,
        "hold": true,
        "label": "User SP Command 3"
      },
      {
        "id": "user_sp4",
        "coil": 202,
        "func": 5,
        "hold": true,
        "label": "User SP Command 4"
      },
      {
        "id": "user_dp1",
        "coil": 207,
        "func": 5,
        "hold": true,
        "label": "User DP Command 1"
      },
      {
        "id": "user_dp2",
        "coil": 208,
        "func": 5,
        "hold": true,
        "label": "User DP Command 2"
      },
      {
        "id": "remote_mode",
        "coil": 105,
        "func": 5,
        "hold": true,
        "label": "Remote Mode"
      },
      {
        "id": "local_mode",
        "coil": 107,
        "func": 5,
        "hold": true,
        "label": "Local Mode"
      },
      {
        "id": "out_of_service",
        "coil": 106,
        "func": 5,
        "hold": true,
        "label": "Out Of Service Mode"
      },
      {
        "id": "reset_cb_total",
        "coil": 120,
        "func": 5,
        "label": "Reset CB Total Trip Count"
      },
      {
        "id": "reset_cb_delta",
        "coil": 121,
        "func": 5,
        "label": "Reset CB Delta Trip Count"
      },
      {
        "id": "reset_energy",
        "coil": 142,
        "func": 5,
        "label": "Reset Energy Meters"
      },
      {
        "id": "reset_thermal",
        "coil": 143,
        "func": 5,
        "label": "Reset Thermal Capacity"
      },
      {
        "id": "test_mode",
        "coil": 149,
        "func": 5,
        "hold": true,
        "label": "Test Mode"
      }
    ],
    "word_order": "high_first",
    "por_transporte": {
      "rtu": {
        "_fonte": "list modbus 7SR5.pdf — Input Registers FP_32BITS_3DP (=S32 scale 1000, high_first); PDU = Modicon-30001",
        "ai_map": {
          "ia": {
            "block": 2,
            "scale": 1000,
            "offset": 0,
            "dataType": "S32"
          },
          "ib": {
            "block": 2,
            "scale": 1000,
            "offset": 2,
            "dataType": "S32"
          },
          "ic": {
            "block": 2,
            "scale": 1000,
            "offset": 4,
            "dataType": "S32"
          },
          "in": {
            "block": 3,
            "scale": 1000,
            "offset": 0,
            "dataType": "S32"
          },
          "va": {
            "block": 0,
            "scale": 1000,
            "offset": 0,
            "dataType": "S32"
          },
          "vb": {
            "block": 0,
            "scale": 1000,
            "offset": 2,
            "dataType": "S32"
          },
          "vc": {
            "block": 0,
            "scale": 1000,
            "offset": 4,
            "dataType": "S32"
          },
          "freq": {
            "block": 1,
            "scale": 1000,
            "offset": 0,
            "dataType": "S32"
          },
          "cosfi_a": {
            "block": 6,
            "scale": 1000,
            "offset": 0,
            "dataType": "S32"
          },
          "cosfi_b": {
            "block": 6,
            "scale": 1000,
            "offset": 2,
            "dataType": "S32"
          },
          "cosfi_c": {
            "block": 6,
            "scale": 1000,
            "offset": 4,
            "dataType": "S32"
          },
          "pa_total": {
            "_nota": "PDF traz Mult=1E-06 alem do 3DP — escala NAO validada com o rele energizado",
            "block": 4,
            "scale": 1000,
            "offset": 0,
            "dataType": "S32"
          },
          "pr_total": {
            "_nota": "idem pa_total: Mult=1E-06 pendente de validacao",
            "block": 5,
            "scale": 1000,
            "offset": 0,
            "dataType": "S32"
          }
        },
        "bi_map": {
          "f27a": {
            "bit": 1,
            "block": 2
          },
          "f27b": {
            "bit": 2,
            "block": 2
          },
          "f27c": {
            "bit": 3,
            "block": 2
          },
          "f59a": {
            "bit": 1,
            "block": 1
          },
          "f59b": {
            "bit": 2,
            "block": 1
          },
          "f59c": {
            "bit": 3,
            "block": 1
          },
          "dj_aberto": {
            "bit": 6,
            "block": 0
          },
          "dj_fechado": {
            "bit": 0,
            "block": 0
          },
          "local_remoto": {
            "bit": 1,
            "block": 3
          }
        },
        "ai_blocks": [
          {
            "func": 4,
            "count": 6,
            "label": "RTU 30016-30021: Va/Vb/Vc Primary",
            "start": 15
          },
          {
            "func": 4,
            "count": 2,
            "label": "RTU 30060: Frequency Hz",
            "start": 59
          },
          {
            "func": 4,
            "count": 6,
            "label": "RTU 30064-30069: Ia/Ib/Ic Primary",
            "start": 63
          },
          {
            "func": 4,
            "count": 2,
            "label": "RTU 30088: In Primary",
            "start": 87
          },
          {
            "func": 4,
            "count": 2,
            "label": "RTU 30118: P 3Ph Primary",
            "start": 117
          },
          {
            "func": 4,
            "count": 2,
            "label": "RTU 30126: Q 3Ph Primary",
            "start": 125
          },
          {
            "func": 4,
            "count": 6,
            "label": "RTU 30136-30141: PF PhA/B/C",
            "start": 135
          }
        ],
        "bi_blocks": [
          {
            "func": 2,
            "count": 8,
            "label": "RTU 10562 CB Closed / 10568 CB Open",
            "start": 561
          },
          {
            "func": 2,
            "count": 4,
            "label": "RTU 10295-10297: 59 PhA/B/C",
            "start": 294
          },
          {
            "func": 2,
            "count": 4,
            "label": "RTU 10113-10115: 27 PhA/B/C",
            "start": 112
          },
          {
            "func": 2,
            "count": 2,
            "label": "RTU 10604: Local Or Remote Mode",
            "start": 603
          }
        ],
        "word_order": "high_first"
      },
      "tcp": {
        "_fonte": "prints Reydisp Edit Modbus TCP — Input Registers INT32 + coluna Multiplier; PDU = Modicon-30001",
        "ai_map": {
          "ia": {
            "block": 0,
            "scale": 1,
            "offset": 0,
            "dataType": "S32"
          },
          "ib": {
            "block": 0,
            "scale": 1,
            "offset": 4,
            "dataType": "S32"
          },
          "ic": {
            "block": 0,
            "scale": 1,
            "offset": 8,
            "dataType": "S32"
          },
          "in": {
            "block": 0,
            "scale": 1,
            "offset": 12,
            "dataType": "S32"
          },
          "va": {
            "block": 0,
            "scale": 1,
            "offset": 20,
            "dataType": "S32"
          },
          "vb": {
            "block": 0,
            "scale": 1,
            "offset": 24,
            "dataType": "S32"
          },
          "vc": {
            "block": 0,
            "scale": 1,
            "offset": 28,
            "dataType": "S32"
          },
          "freq": {
            "block": 1,
            "scale": 100,
            "offset": 14,
            "dataType": "S32"
          },
          "cosfi_a": {
            "block": 1,
            "scale": 1000,
            "offset": 34,
            "dataType": "S32"
          },
          "cosfi_b": {
            "block": 1,
            "scale": 1000,
            "offset": 36,
            "dataType": "S32"
          },
          "cosfi_c": {
            "block": 1,
            "scale": 1000,
            "offset": 38,
            "dataType": "S32"
          },
          "pa_total": {
            "block": 1,
            "scale": 1,
            "offset": 6,
            "dataType": "S32"
          },
          "pr_total": {
            "block": 1,
            "scale": 1,
            "offset": 8,
            "dataType": "S32"
          }
        },
        "bi_map": {
          "f27a": {
            "bit": 0,
            "block": 1
          },
          "f50a": {
            "bit": 0,
            "block": 3
          },
          "f51a": {
            "bit": 0,
            "block": 4
          },
          "f59a": {
            "bit": 0,
            "block": 2
          },
          "dj_aberto": {
            "bit": 0,
            "block": 0
          },
          "dj_fechado": {
            "bit": 1,
            "block": 0
          }
        },
        "_sem_soe": "A aba Holding Registers do TCP NAO expoe Event Counter/Event: o buffer de eventos (SOE) nao existe neste transporte.",
        "ai_blocks": [
          {
            "func": 4,
            "count": 40,
            "label": "TCP 30160-30199: correntes + tensoes",
            "start": 159
          },
          {
            "func": 4,
            "count": 40,
            "label": "TCP 30200-30239: P/Q/S, PF, freq",
            "start": 199
          }
        ],
        "bi_blocks": [
          {
            "func": 2,
            "count": 2,
            "label": "TCP 10013 CB-1 Status (DOUBLE_BIT)",
            "start": 12
          },
          {
            "func": 2,
            "count": 1,
            "label": "TCP 10100: 27-1 Operated",
            "start": 99
          },
          {
            "func": 2,
            "count": 1,
            "label": "TCP 10221: 59-1 Operated",
            "start": 220
          },
          {
            "func": 2,
            "count": 1,
            "label": "TCP 10153: 50-1 Operated",
            "start": 152
          },
          {
            "func": 2,
            "count": 1,
            "label": "TCP 10195: 51-1 Operated",
            "start": 194
          }
        ],
        "word_order": "high_first",
        "_opcoes_rele": "Slave=1, portas 502/504, Time Sync OFF, 'Force Single Coil for Double Commands' DESMARCADO => comando do CB exige FC15 (nao FC05).",
        "default_port": 502
      },
      "_nota": "Overlay por transporte. RTU e TCP sao ESPACOS DE ENDERECO DIFERENTES que se sobrepoem numericamente — ler com o mapa errado devolve outro sinal, SEM erro. Fontes: RTU='docs/reles/list modbus 7SR5.pdf'; TCP=prints Reydisp 'Edit Modbus TCP - UFV Sirius Norte/UC 1' (Coils/Inputs/InputRegs/HoldingRegs/Options). So' entram sinais conferidos; ambiguo fica SEM mapear de proposito."
    }
  },
  "siemens-7sr5111": {
    "fabricante": "Siemens",
    "modelo": "7SR5111",
    "tipo": "rele_protecao",
    "protocolo": "tcp/rtu",
    "connection_note": "TCP porta 502 OU RS485 — escolha e a CONEXAO no diagrama (link TCP com IP no modal, ou link RS485 com endereco). Mapa DEFAULT de fabrica 30160+ nos dois.",
    "ai_map": {
      "ia": {
        "block": 2,
        "scale": 1000,
        "offset": 0,
        "dataType": "S32"
      },
      "ib": {
        "block": 2,
        "scale": 1000,
        "offset": 2,
        "dataType": "S32"
      },
      "ic": {
        "block": 2,
        "scale": 1000,
        "offset": 4,
        "dataType": "S32"
      },
      "in": {
        "block": 3,
        "scale": 1000,
        "offset": 0,
        "dataType": "S32"
      },
      "va": {
        "block": 0,
        "scale": 1000,
        "offset": 0,
        "dataType": "S32"
      },
      "vb": {
        "block": 0,
        "scale": 1000,
        "offset": 2,
        "dataType": "S32"
      },
      "vc": {
        "block": 0,
        "scale": 1000,
        "offset": 4,
        "dataType": "S32"
      },
      "freq": {
        "block": 1,
        "scale": 1000,
        "offset": 0,
        "dataType": "S32"
      },
      "cosfi_a": {
        "block": 6,
        "scale": 1000,
        "offset": 0,
        "dataType": "S32"
      },
      "cosfi_b": {
        "block": 6,
        "scale": 1000,
        "offset": 2,
        "dataType": "S32"
      },
      "cosfi_c": {
        "block": 6,
        "scale": 1000,
        "offset": 4,
        "dataType": "S32"
      },
      "pa_total": {
        "block": 4,
        "scale": 1000,
        "offset": 0,
        "dataType": "S32"
      },
      "pr_total": {
        "block": 5,
        "scale": 1000,
        "offset": 0,
        "dataType": "S32"
      }
    },
    "bi_map": {
      "f46": {
        "coil": 48
      },
      "f47": {
        "coil": 50
      },
      "f81": {
        "coil": 59
      },
      "fba": {
        "coil": 44
      },
      "f27a": {
        "coil": 299
      },
      "f27b": {
        "coil": 300
      },
      "f27c": {
        "coil": 301
      },
      "f50a": {
        "coil": 21
      },
      "f50b": {
        "coil": 27
      },
      "f50c": {
        "coil": 33
      },
      "f50n": {
        "coil": 23
      },
      "f51a": {
        "coil": 20
      },
      "f51b": {
        "coil": 26
      },
      "f51c": {
        "coil": 32
      },
      "f51n": {
        "coil": 22
      },
      "f59a": {
        "coil": 299
      },
      "f59b": {
        "coil": 300
      },
      "f59c": {
        "coil": 301
      },
      "f59n": {
        "coil": 57
      },
      "dj_aberto": {
        "coil": 466
      },
      "dj_fechado": {
        "coil": 460
      },
      "dj_bloqueado": {
        "coil": 72
      },
      "local_remoto": {
        "coil": 2
      }
    },
    "bo_map": {
      "cmd_abrir": {
        "addr": 12,
        "func": 15,
        "count": 2,
        "value": 1
      },
      "cmd_fechar": {
        "addr": 12,
        "func": 15,
        "count": 2,
        "value": 2
      }
    },
    "eventos": {
      "nota": "Buffer de evento IEC-103-like sobre Modbus (7SR manual 6.1). Ler EVENT da pop; qty DEVE ser 8; excecao 2 = fila vazia (nao e erro). Relogio do rele: SNTP/Reydisp, nao via Modbus.",
      "count": {
        "reg": 0,
        "func": 4
      },
      "record": {
        "qty": 8,
        "reg": 1,
        "func": 4
      },
      "poll_ms": 2000,
      "protocolo": "modbus_7sr",
      "excecao_vazio": 2
    },
    "bi_block": {
      "func": 2,
      "count": 467,
      "start": 101
    },
    "ai_blocks": [
      {
        "func": 4,
        "count": 6,
        "label": "Va/Vb/Vc 30016-30021",
        "start": 15
      },
      {
        "func": 4,
        "count": 2,
        "label": "Freq 30060",
        "start": 59
      },
      {
        "func": 4,
        "count": 6,
        "label": "Ia/Ib/Ic 30064-30069",
        "start": 63
      },
      {
        "func": 4,
        "count": 2,
        "label": "In 30088",
        "start": 87
      },
      {
        "func": 4,
        "count": 2,
        "label": "P 3ph 30118",
        "start": 117
      },
      {
        "func": 4,
        "count": 2,
        "label": "Q 3ph 30126",
        "start": 125
      },
      {
        "func": 4,
        "count": 6,
        "label": "PF A/B/C 30136-30141",
        "start": 135
      }
    ],
    "bo_outputs": [
      {
        "id": "cb1_abre",
        "addr": 12,
        "func": 15,
        "count": 2,
        "label": "CB-1 Abrir (DPC)",
        "value": 1
      },
      {
        "id": "cb1_fecha",
        "addr": 12,
        "func": 15,
        "count": 2,
        "label": "CB-1 Fechar (DPC)",
        "value": 2
      },
      {
        "id": "spdon1",
        "coil": 564,
        "func": 5,
        "hold": true,
        "label": "SPDOns1"
      },
      {
        "id": "spdon2",
        "coil": 565,
        "func": 5,
        "hold": true,
        "label": "SPDOns2"
      },
      {
        "id": "spdon3",
        "coil": 566,
        "func": 5,
        "hold": true,
        "label": "SPDOns3"
      },
      {
        "id": "spdon4",
        "coil": 567,
        "func": 5,
        "hold": true,
        "label": "SPDOns4"
      },
      {
        "id": "dpdon1_on",
        "addr": 632,
        "func": 15,
        "count": 2,
        "label": "DPDOns1 On",
        "value": 2
      },
      {
        "id": "dpdon1_off",
        "addr": 632,
        "func": 15,
        "count": 2,
        "label": "DPDOns1 Off",
        "value": 1
      },
      {
        "id": "dpdon2_on",
        "addr": 634,
        "func": 15,
        "count": 2,
        "label": "DPDOns2 On",
        "value": 2
      },
      {
        "id": "dpdon2_off",
        "addr": 634,
        "func": 15,
        "count": 2,
        "label": "DPDOns2 Off",
        "value": 1
      },
      {
        "id": "dpdon3_on",
        "addr": 636,
        "func": 15,
        "count": 2,
        "label": "DPDOns3 On",
        "value": 2
      },
      {
        "id": "dpdon3_off",
        "addr": 636,
        "func": 15,
        "count": 2,
        "label": "DPDOns3 Off",
        "value": 1
      },
      {
        "id": "dpdon4_on",
        "addr": 638,
        "func": 15,
        "count": 2,
        "label": "DPDOns4 On",
        "value": 2
      },
      {
        "id": "dpdon4_off",
        "addr": 638,
        "func": 15,
        "count": 2,
        "label": "DPDOns4 Off",
        "value": 1
      },
      {
        "id": "sg1",
        "coil": 129,
        "func": 5,
        "hold": true,
        "label": "Setting Group 1"
      },
      {
        "id": "sg2",
        "coil": 130,
        "func": 5,
        "hold": true,
        "label": "Setting Group 2"
      },
      {
        "id": "sg3",
        "coil": 131,
        "func": 5,
        "hold": true,
        "label": "Setting Group 3"
      },
      {
        "id": "sg4",
        "coil": 132,
        "func": 5,
        "hold": true,
        "label": "Setting Group 4"
      }
    ],
    "word_order": "high_first",
    "por_transporte": {
      "rtu": {
        "_fonte": "list modbus 7SR5.pdf — Input Registers FP_32BITS_3DP (=S32 scale 1000, high_first); PDU = Modicon-30001",
        "ai_map": {
          "ia": {
            "block": 2,
            "scale": 1000,
            "offset": 0,
            "dataType": "S32"
          },
          "ib": {
            "block": 2,
            "scale": 1000,
            "offset": 2,
            "dataType": "S32"
          },
          "ic": {
            "block": 2,
            "scale": 1000,
            "offset": 4,
            "dataType": "S32"
          },
          "in": {
            "block": 3,
            "scale": 1000,
            "offset": 0,
            "dataType": "S32"
          },
          "va": {
            "block": 0,
            "scale": 1000,
            "offset": 0,
            "dataType": "S32"
          },
          "vb": {
            "block": 0,
            "scale": 1000,
            "offset": 2,
            "dataType": "S32"
          },
          "vc": {
            "block": 0,
            "scale": 1000,
            "offset": 4,
            "dataType": "S32"
          },
          "freq": {
            "block": 1,
            "scale": 1000,
            "offset": 0,
            "dataType": "S32"
          },
          "cosfi_a": {
            "block": 6,
            "scale": 1000,
            "offset": 0,
            "dataType": "S32"
          },
          "cosfi_b": {
            "block": 6,
            "scale": 1000,
            "offset": 2,
            "dataType": "S32"
          },
          "cosfi_c": {
            "block": 6,
            "scale": 1000,
            "offset": 4,
            "dataType": "S32"
          },
          "pa_total": {
            "_nota": "PDF traz Mult=1E-06 alem do 3DP — escala NAO validada com o rele energizado",
            "block": 4,
            "scale": 1000,
            "offset": 0,
            "dataType": "S32"
          },
          "pr_total": {
            "_nota": "idem pa_total: Mult=1E-06 pendente de validacao",
            "block": 5,
            "scale": 1000,
            "offset": 0,
            "dataType": "S32"
          }
        },
        "bi_map": {
          "f27a": {
            "bit": 1,
            "block": 2
          },
          "f27b": {
            "bit": 2,
            "block": 2
          },
          "f27c": {
            "bit": 3,
            "block": 2
          },
          "f59a": {
            "bit": 1,
            "block": 1
          },
          "f59b": {
            "bit": 2,
            "block": 1
          },
          "f59c": {
            "bit": 3,
            "block": 1
          },
          "dj_aberto": {
            "bit": 6,
            "block": 0
          },
          "dj_fechado": {
            "bit": 0,
            "block": 0
          },
          "local_remoto": {
            "bit": 1,
            "block": 3
          }
        },
        "ai_blocks": [
          {
            "func": 4,
            "count": 6,
            "label": "RTU 30016-30021: Va/Vb/Vc Primary",
            "start": 15
          },
          {
            "func": 4,
            "count": 2,
            "label": "RTU 30060: Frequency Hz",
            "start": 59
          },
          {
            "func": 4,
            "count": 6,
            "label": "RTU 30064-30069: Ia/Ib/Ic Primary",
            "start": 63
          },
          {
            "func": 4,
            "count": 2,
            "label": "RTU 30088: In Primary",
            "start": 87
          },
          {
            "func": 4,
            "count": 2,
            "label": "RTU 30118: P 3Ph Primary",
            "start": 117
          },
          {
            "func": 4,
            "count": 2,
            "label": "RTU 30126: Q 3Ph Primary",
            "start": 125
          },
          {
            "func": 4,
            "count": 6,
            "label": "RTU 30136-30141: PF PhA/B/C",
            "start": 135
          }
        ],
        "bi_blocks": [
          {
            "func": 2,
            "count": 8,
            "label": "RTU 10562 CB Closed / 10568 CB Open",
            "start": 561
          },
          {
            "func": 2,
            "count": 4,
            "label": "RTU 10295-10297: 59 PhA/B/C",
            "start": 294
          },
          {
            "func": 2,
            "count": 4,
            "label": "RTU 10113-10115: 27 PhA/B/C",
            "start": 112
          },
          {
            "func": 2,
            "count": 2,
            "label": "RTU 10604: Local Or Remote Mode",
            "start": 603
          }
        ],
        "word_order": "high_first"
      },
      "tcp": {
        "_fonte": "prints Reydisp Edit Modbus TCP — Input Registers INT32 + coluna Multiplier; PDU = Modicon-30001",
        "ai_map": {
          "ia": {
            "block": 0,
            "scale": 1,
            "offset": 0,
            "dataType": "S32"
          },
          "ib": {
            "block": 0,
            "scale": 1,
            "offset": 4,
            "dataType": "S32"
          },
          "ic": {
            "block": 0,
            "scale": 1,
            "offset": 8,
            "dataType": "S32"
          },
          "in": {
            "block": 0,
            "scale": 1,
            "offset": 12,
            "dataType": "S32"
          },
          "va": {
            "block": 0,
            "scale": 1,
            "offset": 20,
            "dataType": "S32"
          },
          "vb": {
            "block": 0,
            "scale": 1,
            "offset": 24,
            "dataType": "S32"
          },
          "vc": {
            "block": 0,
            "scale": 1,
            "offset": 28,
            "dataType": "S32"
          },
          "freq": {
            "block": 1,
            "scale": 100,
            "offset": 14,
            "dataType": "S32"
          },
          "cosfi_a": {
            "block": 1,
            "scale": 1000,
            "offset": 34,
            "dataType": "S32"
          },
          "cosfi_b": {
            "block": 1,
            "scale": 1000,
            "offset": 36,
            "dataType": "S32"
          },
          "cosfi_c": {
            "block": 1,
            "scale": 1000,
            "offset": 38,
            "dataType": "S32"
          },
          "pa_total": {
            "block": 1,
            "scale": 1,
            "offset": 6,
            "dataType": "S32"
          },
          "pr_total": {
            "block": 1,
            "scale": 1,
            "offset": 8,
            "dataType": "S32"
          }
        },
        "bi_map": {
          "f27a": {
            "bit": 0,
            "block": 1
          },
          "f50a": {
            "bit": 0,
            "block": 3
          },
          "f51a": {
            "bit": 0,
            "block": 4
          },
          "f59a": {
            "bit": 0,
            "block": 2
          },
          "dj_aberto": {
            "bit": 0,
            "block": 0
          },
          "dj_fechado": {
            "bit": 1,
            "block": 0
          }
        },
        "_sem_soe": "A aba Holding Registers do TCP NAO expoe Event Counter/Event: o buffer de eventos (SOE) nao existe neste transporte.",
        "ai_blocks": [
          {
            "func": 4,
            "count": 40,
            "label": "TCP 30160-30199: correntes + tensoes",
            "start": 159
          },
          {
            "func": 4,
            "count": 40,
            "label": "TCP 30200-30239: P/Q/S, PF, freq",
            "start": 199
          }
        ],
        "bi_blocks": [
          {
            "func": 2,
            "count": 2,
            "label": "TCP 10013 CB-1 Status (DOUBLE_BIT)",
            "start": 12
          },
          {
            "func": 2,
            "count": 1,
            "label": "TCP 10100: 27-1 Operated",
            "start": 99
          },
          {
            "func": 2,
            "count": 1,
            "label": "TCP 10221: 59-1 Operated",
            "start": 220
          },
          {
            "func": 2,
            "count": 1,
            "label": "TCP 10153: 50-1 Operated",
            "start": 152
          },
          {
            "func": 2,
            "count": 1,
            "label": "TCP 10195: 51-1 Operated",
            "start": 194
          }
        ],
        "word_order": "high_first",
        "_opcoes_rele": "Slave=1, portas 502/504, Time Sync OFF, 'Force Single Coil for Double Commands' DESMARCADO => comando do CB exige FC15 (nao FC05).",
        "default_port": 502
      },
      "_nota": "Overlay por transporte. RTU e TCP sao ESPACOS DE ENDERECO DIFERENTES que se sobrepoem numericamente — ler com o mapa errado devolve outro sinal, SEM erro. Fontes: RTU='docs/reles/list modbus 7SR5.pdf'; TCP=prints Reydisp 'Edit Modbus TCP - UFV Sirius Norte/UC 1' (Coils/Inputs/InputRegs/HoldingRegs/Options). So' entram sinais conferidos; ambiguo fica SEM mapear de proposito."
    }
  },
  "sungrow-sg110cx": {
    "fabricante": "Sungrow",
    "modelo": "SG110CX",
    "tipo": "inversor_solar",
    "protocolo": "rtu",
    "connection_note": "RS485 direto (9600 8N1) ou TCP via WiNet-S",
    "ai_map": {
      "fp": {
        "mode": "last",
        "block": 0,
        "scale": 1000,
        "offset": 35,
        "dataType": "S16"
      },
      "ia": {
        "mode": "avg",
        "block": 0,
        "scale": 10,
        "offset": 22,
        "dataType": "U16"
      },
      "ib": {
        "mode": "avg",
        "block": 0,
        "scale": 10,
        "offset": 23,
        "dataType": "U16"
      },
      "ic": {
        "mode": "avg",
        "block": 0,
        "scale": 10,
        "offset": 24,
        "dataType": "U16"
      },
      "vab": {
        "mode": "avg",
        "block": 0,
        "scale": 10,
        "offset": 19,
        "dataType": "U16"
      },
      "vbc": {
        "mode": "avg",
        "block": 0,
        "scale": 10,
        "offset": 20,
        "dataType": "U16"
      },
      "vca": {
        "mode": "avg",
        "block": 0,
        "scale": 10,
        "offset": 21,
        "dataType": "U16"
      },
      "freq": {
        "mode": "last",
        "block": 0,
        "scale": 10,
        "offset": 36,
        "dataType": "U16"
      },
      "work_state": {
        "mode": "last",
        "block": 0,
        "scale": 1,
        "offset": 38,
        "dataType": "U16"
      },
      "bus_voltage": {
        "mode": "last",
        "block": 3,
        "scale": 10,
        "offset": 27,
        "dataType": "U16"
      },
      "daily_yield": {
        "mode": "last",
        "block": 0,
        "scale": 10,
        "offset": 3,
        "dataType": "U16"
      },
      "device_type": {
        "mode": "last",
        "block": 0,
        "scale": 1,
        "format": "hex",
        "offset": 0,
        "dataType": "U16"
      },
      "output_type": {
        "mode": "last",
        "block": 0,
        "scale": 1,
        "offset": 2,
        "dataType": "U16"
      },
      "total_yield": {
        "mode": "last",
        "block": 0,
        "scale": 1,
        "offset": 4,
        "dataType": "U32"
      },
      "temp_interna": {
        "mode": "last",
        "block": 0,
        "scale": 10,
        "offset": 8,
        "dataType": "S16"
      },
      "mppt1_voltage": {
        "mode": "avg",
        "block": 0,
        "scale": 10,
        "offset": 11,
        "dataType": "U16"
      },
      "mppt2_voltage": {
        "mode": "avg",
        "block": 0,
        "scale": 10,
        "offset": 13,
        "dataType": "U16"
      },
      "mppt3_voltage": {
        "mode": "avg",
        "block": 0,
        "scale": 10,
        "offset": 15,
        "dataType": "U16"
      },
      "mppt4_voltage": {
        "mode": "avg",
        "block": 2,
        "scale": 10,
        "offset": 25,
        "dataType": "U16"
      },
      "mppt5_voltage": {
        "mode": "avg",
        "block": 2,
        "scale": 10,
        "offset": 27,
        "dataType": "U16"
      },
      "mppt6_voltage": {
        "mode": "avg",
        "block": 2,
        "scale": 10,
        "offset": 29,
        "dataType": "U16"
      },
      "mppt7_voltage": {
        "mode": "avg",
        "block": 3,
        "scale": 10,
        "offset": 1,
        "dataType": "U16"
      },
      "mppt8_voltage": {
        "mode": "avg",
        "block": 3,
        "scale": 10,
        "offset": 3,
        "dataType": "U16"
      },
      "mppt9_voltage": {
        "mode": "avg",
        "block": 3,
        "scale": 10,
        "offset": 10,
        "dataType": "U16"
      },
      "nominal_power": {
        "mode": "last",
        "block": 0,
        "scale": 10,
        "offset": 1,
        "dataType": "U16"
      },
      "apparent_total": {
        "mode": "last",
        "block": 0,
        "scale": 1,
        "offset": 9,
        "dataType": "U32"
      },
      "dc_total_power": {
        "mode": "avg",
        "block": 0,
        "scale": 1,
        "offset": 17,
        "dataType": "U32"
      },
      "pid_alarm_code": {
        "mode": "last",
        "block": 3,
        "scale": 1,
        "offset": 31,
        "dataType": "U16"
      },
      "pid_work_state": {
        "mode": "last",
        "block": 3,
        "scale": 1,
        "offset": 30,
        "dataType": "U16"
      },
      "potencia_ativa": {
        "mode": "last",
        "block": 0,
        "scale": 1,
        "offset": 31,
        "dataType": "U32"
      },
      "string1_current": {
        "mode": "avg",
        "block": 4,
        "scale": 100,
        "offset": 0,
        "dataType": "U16"
      },
      "string2_current": {
        "mode": "avg",
        "block": 4,
        "scale": 100,
        "offset": 1,
        "dataType": "U16"
      },
      "string3_current": {
        "mode": "avg",
        "block": 4,
        "scale": 100,
        "offset": 2,
        "dataType": "U16"
      },
      "string4_current": {
        "mode": "avg",
        "block": 4,
        "scale": 100,
        "offset": 3,
        "dataType": "U16"
      },
      "string5_current": {
        "mode": "avg",
        "block": 4,
        "scale": 100,
        "offset": 4,
        "dataType": "U16"
      },
      "string6_current": {
        "mode": "avg",
        "block": 4,
        "scale": 100,
        "offset": 5,
        "dataType": "U16"
      },
      "string7_current": {
        "mode": "avg",
        "block": 4,
        "scale": 100,
        "offset": 6,
        "dataType": "U16"
      },
      "string8_current": {
        "mode": "avg",
        "block": 4,
        "scale": 100,
        "offset": 7,
        "dataType": "U16"
      },
      "string9_current": {
        "mode": "avg",
        "block": 4,
        "scale": 100,
        "offset": 8,
        "dataType": "U16"
      },
      "potencia_reativa": {
        "mode": "last",
        "block": 0,
        "scale": 1,
        "offset": 33,
        "dataType": "S32"
      },
      "string10_current": {
        "mode": "avg",
        "block": 4,
        "scale": 100,
        "offset": 9,
        "dataType": "U16"
      },
      "string11_current": {
        "mode": "avg",
        "block": 4,
        "scale": 100,
        "offset": 10,
        "dataType": "U16"
      },
      "string12_current": {
        "mode": "avg",
        "block": 4,
        "scale": 100,
        "offset": 11,
        "dataType": "U16"
      },
      "string13_current": {
        "mode": "avg",
        "block": 4,
        "scale": 100,
        "offset": 12,
        "dataType": "U16"
      },
      "string14_current": {
        "mode": "avg",
        "block": 4,
        "scale": 100,
        "offset": 13,
        "dataType": "U16"
      },
      "string15_current": {
        "mode": "avg",
        "block": 4,
        "scale": 100,
        "offset": 14,
        "dataType": "U16"
      },
      "string16_current": {
        "mode": "avg",
        "block": 4,
        "scale": 100,
        "offset": 15,
        "dataType": "U16"
      },
      "string17_current": {
        "mode": "avg",
        "block": 4,
        "scale": 100,
        "offset": 16,
        "dataType": "U16"
      },
      "string18_current": {
        "mode": "avg",
        "block": 4,
        "scale": 100,
        "offset": 17,
        "dataType": "U16"
      },
      "potencia_aparente": {
        "mode": "last",
        "block": 0,
        "scale": 1,
        "offset": 9,
        "dataType": "U32"
      },
      "daily_running_time": {
        "mode": "last",
        "block": 2,
        "scale": 1,
        "offset": 23,
        "dataType": "U16"
      },
      "potencia_aparente2": {
        "mode": "last",
        "block": 0,
        "scale": 1,
        "offset": 10,
        "dataType": "U32"
      },
      "total_running_time": {
        "mode": "last",
        "block": 0,
        "scale": 1,
        "offset": 6,
        "dataType": "U32"
      },
      "insulation_resistance": {
        "mode": "last",
        "block": 1,
        "scale": 1,
        "offset": 21,
        "dataType": "U16"
      },
      "nominal_reactive_power": {
        "mode": "last",
        "block": 0,
        "scale": 10,
        "offset": 49,
        "dataType": "U16"
      }
    },
    "bi_map": {
      "work_state": {
        "func": 4,
        "register": 5038
      }
    },
    "bo_map": {},
    "ai_blocks": [
      {
        "func": 4,
        "count": 50,
        "label": "Regs 5000-5049: info, yields, MPPT 1-3, V/I AC, potencias, status",
        "start": 4999
      },
      {
        "func": 4,
        "count": 40,
        "label": "Regs 5050-5089: regulation, insulation",
        "start": 5049
      },
      {
        "func": 4,
        "count": 30,
        "label": "Regs 5090-5119: tempo diario, MPPT 4-6",
        "start": 5089
      },
      {
        "func": 4,
        "count": 35,
        "label": "Regs 5120-5154: MPPT 7-9, bus voltage, PID",
        "start": 5119
      },
      {
        "func": 4,
        "count": 18,
        "label": "Regs 7013-7030: strings 1-18",
        "start": 7012
      }
    ],
    "num_mppts": 9,
    "word_order": "low_first",
    "num_strings": 18
  },
  "sungrow-sg250cx": {
    "fabricante": "Sungrow",
    "modelo": "SG250CX",
    "tipo": "inversor_solar",
    "protocolo": "rtu",
    "connection_note": "RS485 direto (9600 8N1) ou TCP via WiNet-S",
    "ai_map": {
      "fp": {
        "mode": "last",
        "block": 0,
        "scale": 1000,
        "offset": 35,
        "dataType": "S16"
      },
      "ia": {
        "mode": "avg",
        "block": 0,
        "scale": 10,
        "offset": 22,
        "dataType": "U16"
      },
      "ib": {
        "mode": "avg",
        "block": 0,
        "scale": 10,
        "offset": 23,
        "dataType": "U16"
      },
      "ic": {
        "mode": "avg",
        "block": 0,
        "scale": 10,
        "offset": 24,
        "dataType": "U16"
      },
      "vab": {
        "mode": "avg",
        "block": 0,
        "scale": 10,
        "offset": 19,
        "dataType": "U16"
      },
      "vbc": {
        "mode": "avg",
        "block": 0,
        "scale": 10,
        "offset": 20,
        "dataType": "U16"
      },
      "vca": {
        "mode": "avg",
        "block": 0,
        "scale": 10,
        "offset": 21,
        "dataType": "U16"
      },
      "freq": {
        "mode": "last",
        "block": 0,
        "scale": 10,
        "offset": 36,
        "dataType": "U16"
      },
      "work_state": {
        "mode": "last",
        "block": 0,
        "scale": 1,
        "offset": 38,
        "dataType": "U16"
      },
      "bus_voltage": {
        "mode": "last",
        "block": 3,
        "scale": 10,
        "offset": 27,
        "dataType": "U16"
      },
      "daily_yield": {
        "mode": "last",
        "block": 0,
        "scale": 10,
        "offset": 3,
        "dataType": "U16"
      },
      "device_type": {
        "mode": "last",
        "block": 0,
        "scale": 1,
        "format": "hex",
        "offset": 0,
        "dataType": "U16"
      },
      "output_type": {
        "mode": "last",
        "block": 0,
        "scale": 1,
        "offset": 2,
        "dataType": "U16"
      },
      "total_yield": {
        "mode": "last",
        "block": 0,
        "scale": 1,
        "offset": 4,
        "dataType": "U32"
      },
      "temp_interna": {
        "mode": "last",
        "block": 0,
        "scale": 10,
        "offset": 8,
        "dataType": "S16"
      },
      "mppt1_voltage": {
        "mode": "avg",
        "block": 0,
        "scale": 10,
        "offset": 11,
        "dataType": "U16"
      },
      "mppt2_voltage": {
        "mode": "avg",
        "block": 0,
        "scale": 10,
        "offset": 13,
        "dataType": "U16"
      },
      "mppt3_voltage": {
        "mode": "avg",
        "block": 0,
        "scale": 10,
        "offset": 15,
        "dataType": "U16"
      },
      "mppt4_voltage": {
        "mode": "avg",
        "block": 2,
        "scale": 10,
        "offset": 25,
        "dataType": "U16"
      },
      "mppt5_voltage": {
        "mode": "avg",
        "block": 2,
        "scale": 10,
        "offset": 27,
        "dataType": "U16"
      },
      "mppt6_voltage": {
        "mode": "avg",
        "block": 2,
        "scale": 10,
        "offset": 29,
        "dataType": "U16"
      },
      "mppt7_voltage": {
        "mode": "avg",
        "block": 3,
        "scale": 10,
        "offset": 1,
        "dataType": "U16"
      },
      "mppt8_voltage": {
        "mode": "avg",
        "block": 3,
        "scale": 10,
        "offset": 3,
        "dataType": "U16"
      },
      "mppt9_voltage": {
        "mode": "avg",
        "block": 3,
        "scale": 10,
        "offset": 10,
        "dataType": "U16"
      },
      "nominal_power": {
        "mode": "last",
        "block": 0,
        "scale": 10,
        "offset": 1,
        "dataType": "U16"
      },
      "apparent_total": {
        "mode": "last",
        "block": 0,
        "scale": 1,
        "offset": 9,
        "dataType": "U32"
      },
      "dc_total_power": {
        "mode": "avg",
        "block": 0,
        "scale": 1,
        "offset": 17,
        "dataType": "U32"
      },
      "pid_alarm_code": {
        "mode": "last",
        "block": 3,
        "scale": 1,
        "offset": 31,
        "dataType": "U16"
      },
      "pid_work_state": {
        "mode": "last",
        "block": 3,
        "scale": 1,
        "offset": 30,
        "dataType": "U16"
      },
      "potencia_ativa": {
        "mode": "last",
        "block": 0,
        "scale": 1,
        "offset": 31,
        "dataType": "U32"
      },
      "string1_current": {
        "mode": "avg",
        "block": 4,
        "scale": 100,
        "offset": 0,
        "dataType": "U16"
      },
      "string2_current": {
        "mode": "avg",
        "block": 4,
        "scale": 100,
        "offset": 1,
        "dataType": "U16"
      },
      "string3_current": {
        "mode": "avg",
        "block": 4,
        "scale": 100,
        "offset": 2,
        "dataType": "U16"
      },
      "string4_current": {
        "mode": "avg",
        "block": 4,
        "scale": 100,
        "offset": 3,
        "dataType": "U16"
      },
      "string5_current": {
        "mode": "avg",
        "block": 4,
        "scale": 100,
        "offset": 4,
        "dataType": "U16"
      },
      "string6_current": {
        "mode": "avg",
        "block": 4,
        "scale": 100,
        "offset": 5,
        "dataType": "U16"
      },
      "string7_current": {
        "mode": "avg",
        "block": 4,
        "scale": 100,
        "offset": 6,
        "dataType": "U16"
      },
      "string8_current": {
        "mode": "avg",
        "block": 4,
        "scale": 100,
        "offset": 7,
        "dataType": "U16"
      },
      "string9_current": {
        "mode": "avg",
        "block": 4,
        "scale": 100,
        "offset": 8,
        "dataType": "U16"
      },
      "potencia_reativa": {
        "mode": "last",
        "block": 0,
        "scale": 1,
        "offset": 33,
        "dataType": "S32"
      },
      "string10_current": {
        "mode": "avg",
        "block": 4,
        "scale": 100,
        "offset": 9,
        "dataType": "U16"
      },
      "string11_current": {
        "mode": "avg",
        "block": 4,
        "scale": 100,
        "offset": 10,
        "dataType": "U16"
      },
      "string12_current": {
        "mode": "avg",
        "block": 4,
        "scale": 100,
        "offset": 11,
        "dataType": "U16"
      },
      "string13_current": {
        "mode": "avg",
        "block": 4,
        "scale": 100,
        "offset": 12,
        "dataType": "U16"
      },
      "string14_current": {
        "mode": "avg",
        "block": 4,
        "scale": 100,
        "offset": 13,
        "dataType": "U16"
      },
      "string15_current": {
        "mode": "avg",
        "block": 4,
        "scale": 100,
        "offset": 14,
        "dataType": "U16"
      },
      "string16_current": {
        "mode": "avg",
        "block": 4,
        "scale": 100,
        "offset": 15,
        "dataType": "U16"
      },
      "string17_current": {
        "mode": "avg",
        "block": 4,
        "scale": 100,
        "offset": 16,
        "dataType": "U16"
      },
      "string18_current": {
        "mode": "avg",
        "block": 4,
        "scale": 100,
        "offset": 17,
        "dataType": "U16"
      },
      "potencia_aparente": {
        "mode": "last",
        "block": 0,
        "scale": 1,
        "offset": 9,
        "dataType": "U32"
      },
      "daily_running_time": {
        "mode": "last",
        "block": 2,
        "scale": 1,
        "offset": 23,
        "dataType": "U16"
      },
      "potencia_aparente2": {
        "mode": "last",
        "block": 0,
        "scale": 1,
        "offset": 10,
        "dataType": "U32"
      },
      "total_running_time": {
        "mode": "last",
        "block": 0,
        "scale": 1,
        "offset": 6,
        "dataType": "U32"
      },
      "insulation_resistance": {
        "mode": "last",
        "block": 1,
        "scale": 1,
        "offset": 21,
        "dataType": "U16"
      },
      "nominal_reactive_power": {
        "mode": "last",
        "block": 0,
        "scale": 10,
        "offset": 49,
        "dataType": "U16"
      }
    },
    "bi_map": {
      "work_state": {
        "func": 4,
        "register": 5038
      }
    },
    "bo_map": {},
    "ai_blocks": [
      {
        "func": 4,
        "count": 50,
        "label": "Regs 5000-5049: info, yields, MPPT 1-3, V/I AC, potencias, status",
        "start": 4999
      },
      {
        "func": 4,
        "count": 40,
        "label": "Regs 5050-5089: regulation, insulation",
        "start": 5049
      },
      {
        "func": 4,
        "count": 30,
        "label": "Regs 5090-5119: tempo diario, MPPT 4-6",
        "start": 5089
      },
      {
        "func": 4,
        "count": 35,
        "label": "Regs 5120-5154: MPPT 7-9, bus voltage, PID",
        "start": 5119
      },
      {
        "func": 4,
        "count": 18,
        "label": "Regs 7013-7030: strings 1-18",
        "start": 7012
      }
    ],
    "num_mppts": 12,
    "word_order": "low_first",
    "num_strings": 24
  },
  "sungrow-sg333hx": {
    "fabricante": "Sungrow",
    "modelo": "SG333HX",
    "tipo": "inversor_solar",
    "protocolo": "rtu",
    "connection_note": "RS485 direto (9600 8N1) ou TCP via WiNet-S. 12 MPPTs / 24 strings.",
    "ai_map": {
      "fp": {
        "mode": "last",
        "block": 0,
        "scale": 1000,
        "offset": 35,
        "dataType": "S16"
      },
      "ia": {
        "mode": "avg",
        "block": 0,
        "scale": 10,
        "offset": 22,
        "dataType": "U16"
      },
      "ib": {
        "mode": "avg",
        "block": 0,
        "scale": 10,
        "offset": 23,
        "dataType": "U16"
      },
      "ic": {
        "mode": "avg",
        "block": 0,
        "scale": 10,
        "offset": 24,
        "dataType": "U16"
      },
      "vab": {
        "mode": "avg",
        "block": 0,
        "scale": 10,
        "offset": 19,
        "dataType": "U16"
      },
      "vbc": {
        "mode": "avg",
        "block": 0,
        "scale": 10,
        "offset": 20,
        "dataType": "U16"
      },
      "vca": {
        "mode": "avg",
        "block": 0,
        "scale": 10,
        "offset": 21,
        "dataType": "U16"
      },
      "freq": {
        "mode": "last",
        "block": 0,
        "scale": 10,
        "offset": 36,
        "dataType": "U16"
      },
      "work_state": {
        "mode": "last",
        "block": 0,
        "scale": 1,
        "offset": 38,
        "dataType": "U16"
      },
      "bus_voltage": {
        "mode": "last",
        "block": 3,
        "scale": 10,
        "offset": 27,
        "dataType": "U16"
      },
      "daily_yield": {
        "mode": "last",
        "block": 0,
        "scale": 10,
        "offset": 3,
        "dataType": "U16"
      },
      "device_type": {
        "mode": "last",
        "block": 0,
        "scale": 1,
        "format": "hex",
        "offset": 0,
        "dataType": "U16"
      },
      "output_type": {
        "mode": "last",
        "block": 0,
        "scale": 1,
        "offset": 2,
        "dataType": "U16"
      },
      "total_yield": {
        "mode": "last",
        "block": 0,
        "scale": 1,
        "offset": 4,
        "dataType": "U32"
      },
      "temp_interna": {
        "mode": "last",
        "block": 0,
        "scale": 10,
        "offset": 8,
        "dataType": "S16"
      },
      "mppt1_voltage": {
        "mode": "avg",
        "block": 0,
        "scale": 10,
        "offset": 11,
        "dataType": "U16"
      },
      "mppt2_voltage": {
        "mode": "avg",
        "block": 0,
        "scale": 10,
        "offset": 13,
        "dataType": "U16"
      },
      "mppt3_voltage": {
        "mode": "avg",
        "block": 0,
        "scale": 10,
        "offset": 15,
        "dataType": "U16"
      },
      "mppt4_voltage": {
        "mode": "avg",
        "block": 2,
        "scale": 10,
        "offset": 25,
        "dataType": "U16"
      },
      "mppt5_voltage": {
        "mode": "avg",
        "block": 2,
        "scale": 10,
        "offset": 27,
        "dataType": "U16"
      },
      "mppt6_voltage": {
        "mode": "avg",
        "block": 2,
        "scale": 10,
        "offset": 29,
        "dataType": "U16"
      },
      "mppt7_voltage": {
        "mode": "avg",
        "block": 3,
        "scale": 10,
        "offset": 1,
        "dataType": "U16"
      },
      "mppt8_voltage": {
        "mode": "avg",
        "block": 3,
        "scale": 10,
        "offset": 3,
        "dataType": "U16"
      },
      "mppt9_voltage": {
        "mode": "avg",
        "block": 3,
        "scale": 10,
        "offset": 10,
        "dataType": "U16"
      },
      "nominal_power": {
        "mode": "last",
        "block": 0,
        "scale": 10,
        "offset": 1,
        "dataType": "U16"
      },
      "apparent_total": {
        "mode": "last",
        "block": 0,
        "scale": 1,
        "offset": 9,
        "dataType": "U32"
      },
      "dc_total_power": {
        "mode": "avg",
        "block": 0,
        "scale": 1,
        "offset": 17,
        "dataType": "U32"
      },
      "mppt10_voltage": {
        "mode": "avg",
        "block": 3,
        "scale": 10,
        "offset": 12,
        "dataType": "U16"
      },
      "mppt11_voltage": {
        "mode": "avg",
        "block": 3,
        "scale": 10,
        "offset": 14,
        "dataType": "U16"
      },
      "mppt12_voltage": {
        "mode": "avg",
        "block": 3,
        "scale": 10,
        "offset": 16,
        "dataType": "U16"
      },
      "pid_alarm_code": {
        "mode": "last",
        "block": 3,
        "scale": 1,
        "offset": 31,
        "dataType": "U16"
      },
      "pid_work_state": {
        "mode": "last",
        "block": 3,
        "scale": 1,
        "offset": 30,
        "dataType": "U16"
      },
      "potencia_ativa": {
        "mode": "last",
        "block": 0,
        "scale": 1,
        "offset": 31,
        "dataType": "U32"
      },
      "string1_current": {
        "mode": "avg",
        "block": 4,
        "scale": 100,
        "offset": 0,
        "dataType": "U16"
      },
      "string2_current": {
        "mode": "avg",
        "block": 4,
        "scale": 100,
        "offset": 1,
        "dataType": "U16"
      },
      "string3_current": {
        "mode": "avg",
        "block": 4,
        "scale": 100,
        "offset": 2,
        "dataType": "U16"
      },
      "string4_current": {
        "mode": "avg",
        "block": 4,
        "scale": 100,
        "offset": 3,
        "dataType": "U16"
      },
      "string5_current": {
        "mode": "avg",
        "block": 4,
        "scale": 100,
        "offset": 4,
        "dataType": "U16"
      },
      "string6_current": {
        "mode": "avg",
        "block": 4,
        "scale": 100,
        "offset": 5,
        "dataType": "U16"
      },
      "string7_current": {
        "mode": "avg",
        "block": 4,
        "scale": 100,
        "offset": 6,
        "dataType": "U16"
      },
      "string8_current": {
        "mode": "avg",
        "block": 4,
        "scale": 100,
        "offset": 7,
        "dataType": "U16"
      },
      "string9_current": {
        "mode": "avg",
        "block": 4,
        "scale": 100,
        "offset": 8,
        "dataType": "U16"
      },
      "potencia_reativa": {
        "mode": "last",
        "block": 0,
        "scale": 1,
        "offset": 33,
        "dataType": "S32"
      },
      "string10_current": {
        "mode": "avg",
        "block": 4,
        "scale": 100,
        "offset": 9,
        "dataType": "U16"
      },
      "string11_current": {
        "mode": "avg",
        "block": 4,
        "scale": 100,
        "offset": 10,
        "dataType": "U16"
      },
      "string12_current": {
        "mode": "avg",
        "block": 4,
        "scale": 100,
        "offset": 11,
        "dataType": "U16"
      },
      "string13_current": {
        "mode": "avg",
        "block": 4,
        "scale": 100,
        "offset": 12,
        "dataType": "U16"
      },
      "string14_current": {
        "mode": "avg",
        "block": 4,
        "scale": 100,
        "offset": 13,
        "dataType": "U16"
      },
      "string15_current": {
        "mode": "avg",
        "block": 4,
        "scale": 100,
        "offset": 14,
        "dataType": "U16"
      },
      "string16_current": {
        "mode": "avg",
        "block": 4,
        "scale": 100,
        "offset": 15,
        "dataType": "U16"
      },
      "string17_current": {
        "mode": "avg",
        "block": 4,
        "scale": 100,
        "offset": 16,
        "dataType": "U16"
      },
      "string18_current": {
        "mode": "avg",
        "block": 4,
        "scale": 100,
        "offset": 17,
        "dataType": "U16"
      },
      "string19_current": {
        "mode": "avg",
        "block": 4,
        "scale": 100,
        "offset": 18,
        "dataType": "U16"
      },
      "string20_current": {
        "mode": "avg",
        "block": 4,
        "scale": 100,
        "offset": 19,
        "dataType": "U16"
      },
      "string21_current": {
        "mode": "avg",
        "block": 4,
        "scale": 100,
        "offset": 20,
        "dataType": "U16"
      },
      "string22_current": {
        "mode": "avg",
        "block": 4,
        "scale": 100,
        "offset": 21,
        "dataType": "U16"
      },
      "string23_current": {
        "mode": "avg",
        "block": 4,
        "scale": 100,
        "offset": 22,
        "dataType": "U16"
      },
      "string24_current": {
        "mode": "avg",
        "block": 4,
        "scale": 100,
        "offset": 23,
        "dataType": "U16"
      },
      "potencia_aparente": {
        "mode": "last",
        "block": 0,
        "scale": 1,
        "offset": 9,
        "dataType": "U32"
      },
      "daily_running_time": {
        "mode": "last",
        "block": 2,
        "scale": 1,
        "offset": 23,
        "dataType": "U16"
      },
      "potencia_aparente2": {
        "mode": "last",
        "block": 0,
        "scale": 1,
        "offset": 10,
        "dataType": "U32"
      },
      "total_running_time": {
        "mode": "last",
        "block": 0,
        "scale": 1,
        "offset": 6,
        "dataType": "U32"
      },
      "insulation_resistance": {
        "mode": "last",
        "block": 1,
        "scale": 1,
        "offset": 21,
        "dataType": "U16"
      },
      "nominal_reactive_power": {
        "mode": "last",
        "block": 0,
        "scale": 10,
        "offset": 49,
        "dataType": "U16"
      }
    },
    "bi_map": {
      "work_state": {
        "func": 4,
        "register": 5038
      }
    },
    "bo_map": {},
    "ai_blocks": [
      {
        "func": 4,
        "count": 50,
        "label": "Regs 5000-5049: info, yields, MPPT 1-3, V/I AC, potencias, status",
        "start": 4999
      },
      {
        "func": 4,
        "count": 40,
        "label": "Regs 5050-5089: regulation, insulation",
        "start": 5049
      },
      {
        "func": 4,
        "count": 30,
        "label": "Regs 5090-5119: tempo diario, MPPT 4-6",
        "start": 5089
      },
      {
        "func": 4,
        "count": 35,
        "label": "Regs 5120-5154: MPPT 7-12, bus voltage, PID",
        "start": 5119
      },
      {
        "func": 4,
        "count": 24,
        "label": "Regs 7013-7036: strings 1-24",
        "start": 7012
      }
    ],
    "num_mppts": 12,
    "word_order": "low_first",
    "num_strings": 24
  },
  "sungrow-sg75cx": {
    "fabricante": "Sungrow",
    "modelo": "SG75CX",
    "tipo": "inversor_solar",
    "protocolo": "rtu",
    "connection_note": "RS485 direto (9600 8N1) ou TCP via WiNet-S. Mesmo mapa Modbus da serie CX.",
    "ai_map": {
      "fp": {
        "mode": "last",
        "block": 0,
        "scale": 1000,
        "offset": 35,
        "dataType": "S16"
      },
      "ia": {
        "mode": "avg",
        "block": 0,
        "scale": 10,
        "offset": 22,
        "dataType": "U16"
      },
      "ib": {
        "mode": "avg",
        "block": 0,
        "scale": 10,
        "offset": 23,
        "dataType": "U16"
      },
      "ic": {
        "mode": "avg",
        "block": 0,
        "scale": 10,
        "offset": 24,
        "dataType": "U16"
      },
      "vab": {
        "mode": "avg",
        "block": 0,
        "scale": 10,
        "offset": 19,
        "dataType": "U16"
      },
      "vbc": {
        "mode": "avg",
        "block": 0,
        "scale": 10,
        "offset": 20,
        "dataType": "U16"
      },
      "vca": {
        "mode": "avg",
        "block": 0,
        "scale": 10,
        "offset": 21,
        "dataType": "U16"
      },
      "freq": {
        "mode": "last",
        "block": 0,
        "scale": 10,
        "offset": 36,
        "dataType": "U16"
      },
      "work_state": {
        "mode": "last",
        "block": 0,
        "scale": 1,
        "offset": 38,
        "dataType": "U16"
      },
      "bus_voltage": {
        "mode": "last",
        "block": 3,
        "scale": 10,
        "offset": 27,
        "dataType": "U16"
      },
      "daily_yield": {
        "mode": "last",
        "block": 0,
        "scale": 10,
        "offset": 3,
        "dataType": "U16"
      },
      "device_type": {
        "mode": "last",
        "block": 0,
        "scale": 1,
        "format": "hex",
        "offset": 0,
        "dataType": "U16"
      },
      "output_type": {
        "mode": "last",
        "block": 0,
        "scale": 1,
        "offset": 2,
        "dataType": "U16"
      },
      "total_yield": {
        "mode": "last",
        "block": 0,
        "scale": 1,
        "offset": 4,
        "dataType": "U32"
      },
      "temp_interna": {
        "mode": "last",
        "block": 0,
        "scale": 10,
        "offset": 8,
        "dataType": "S16"
      },
      "mppt1_voltage": {
        "mode": "avg",
        "block": 0,
        "scale": 10,
        "offset": 11,
        "dataType": "U16"
      },
      "mppt2_voltage": {
        "mode": "avg",
        "block": 0,
        "scale": 10,
        "offset": 13,
        "dataType": "U16"
      },
      "mppt3_voltage": {
        "mode": "avg",
        "block": 0,
        "scale": 10,
        "offset": 15,
        "dataType": "U16"
      },
      "mppt4_voltage": {
        "mode": "avg",
        "block": 2,
        "scale": 10,
        "offset": 25,
        "dataType": "U16"
      },
      "mppt5_voltage": {
        "mode": "avg",
        "block": 2,
        "scale": 10,
        "offset": 27,
        "dataType": "U16"
      },
      "mppt6_voltage": {
        "mode": "avg",
        "block": 2,
        "scale": 10,
        "offset": 29,
        "dataType": "U16"
      },
      "mppt7_voltage": {
        "mode": "avg",
        "block": 3,
        "scale": 10,
        "offset": 1,
        "dataType": "U16"
      },
      "mppt8_voltage": {
        "mode": "avg",
        "block": 3,
        "scale": 10,
        "offset": 3,
        "dataType": "U16"
      },
      "mppt9_voltage": {
        "mode": "avg",
        "block": 3,
        "scale": 10,
        "offset": 10,
        "dataType": "U16"
      },
      "nominal_power": {
        "mode": "last",
        "block": 0,
        "scale": 10,
        "offset": 1,
        "dataType": "U16"
      },
      "apparent_total": {
        "mode": "last",
        "block": 0,
        "scale": 1,
        "offset": 9,
        "dataType": "U32"
      },
      "dc_total_power": {
        "mode": "avg",
        "block": 0,
        "scale": 1,
        "offset": 17,
        "dataType": "U32"
      },
      "pid_alarm_code": {
        "mode": "last",
        "block": 3,
        "scale": 1,
        "offset": 31,
        "dataType": "U16"
      },
      "pid_work_state": {
        "mode": "last",
        "block": 3,
        "scale": 1,
        "offset": 30,
        "dataType": "U16"
      },
      "potencia_ativa": {
        "mode": "last",
        "block": 0,
        "scale": 1,
        "offset": 31,
        "dataType": "U32"
      },
      "string1_current": {
        "mode": "avg",
        "block": 4,
        "scale": 100,
        "offset": 0,
        "dataType": "U16"
      },
      "string2_current": {
        "mode": "avg",
        "block": 4,
        "scale": 100,
        "offset": 1,
        "dataType": "U16"
      },
      "string3_current": {
        "mode": "avg",
        "block": 4,
        "scale": 100,
        "offset": 2,
        "dataType": "U16"
      },
      "string4_current": {
        "mode": "avg",
        "block": 4,
        "scale": 100,
        "offset": 3,
        "dataType": "U16"
      },
      "string5_current": {
        "mode": "avg",
        "block": 4,
        "scale": 100,
        "offset": 4,
        "dataType": "U16"
      },
      "string6_current": {
        "mode": "avg",
        "block": 4,
        "scale": 100,
        "offset": 5,
        "dataType": "U16"
      },
      "string7_current": {
        "mode": "avg",
        "block": 4,
        "scale": 100,
        "offset": 6,
        "dataType": "U16"
      },
      "string8_current": {
        "mode": "avg",
        "block": 4,
        "scale": 100,
        "offset": 7,
        "dataType": "U16"
      },
      "string9_current": {
        "mode": "avg",
        "block": 4,
        "scale": 100,
        "offset": 8,
        "dataType": "U16"
      },
      "potencia_reativa": {
        "mode": "last",
        "block": 0,
        "scale": 1,
        "offset": 33,
        "dataType": "S32"
      },
      "string10_current": {
        "mode": "avg",
        "block": 4,
        "scale": 100,
        "offset": 9,
        "dataType": "U16"
      },
      "string11_current": {
        "mode": "avg",
        "block": 4,
        "scale": 100,
        "offset": 10,
        "dataType": "U16"
      },
      "string12_current": {
        "mode": "avg",
        "block": 4,
        "scale": 100,
        "offset": 11,
        "dataType": "U16"
      },
      "string13_current": {
        "mode": "avg",
        "block": 4,
        "scale": 100,
        "offset": 12,
        "dataType": "U16"
      },
      "string14_current": {
        "mode": "avg",
        "block": 4,
        "scale": 100,
        "offset": 13,
        "dataType": "U16"
      },
      "string15_current": {
        "mode": "avg",
        "block": 4,
        "scale": 100,
        "offset": 14,
        "dataType": "U16"
      },
      "string16_current": {
        "mode": "avg",
        "block": 4,
        "scale": 100,
        "offset": 15,
        "dataType": "U16"
      },
      "string17_current": {
        "mode": "avg",
        "block": 4,
        "scale": 100,
        "offset": 16,
        "dataType": "U16"
      },
      "string18_current": {
        "mode": "avg",
        "block": 4,
        "scale": 100,
        "offset": 17,
        "dataType": "U16"
      },
      "potencia_aparente": {
        "mode": "last",
        "block": 0,
        "scale": 1,
        "offset": 9,
        "dataType": "U32"
      },
      "daily_running_time": {
        "mode": "last",
        "block": 2,
        "scale": 1,
        "offset": 23,
        "dataType": "U16"
      },
      "potencia_aparente2": {
        "mode": "last",
        "block": 0,
        "scale": 1,
        "offset": 10,
        "dataType": "U32"
      },
      "total_running_time": {
        "mode": "last",
        "block": 0,
        "scale": 1,
        "offset": 6,
        "dataType": "U32"
      },
      "insulation_resistance": {
        "mode": "last",
        "block": 1,
        "scale": 1,
        "offset": 21,
        "dataType": "U16"
      },
      "nominal_reactive_power": {
        "mode": "last",
        "block": 0,
        "scale": 10,
        "offset": 49,
        "dataType": "U16"
      }
    },
    "bi_map": {
      "work_state": {
        "func": 4,
        "register": 5038
      }
    },
    "bo_map": {},
    "ai_blocks": [
      {
        "func": 4,
        "count": 50,
        "label": "Regs 5000-5049: info, yields, MPPT 1-3, V/I AC, potencias, status",
        "start": 4999
      },
      {
        "func": 4,
        "count": 40,
        "label": "Regs 5050-5089: regulation, insulation",
        "start": 5049
      },
      {
        "func": 4,
        "count": 30,
        "label": "Regs 5090-5119: tempo diario, MPPT 4-6",
        "start": 5089
      },
      {
        "func": 4,
        "count": 35,
        "label": "Regs 5120-5154: MPPT 7-9, bus voltage, PID",
        "start": 5119
      },
      {
        "func": 4,
        "count": 18,
        "label": "Regs 7013-7030: strings 1-18",
        "start": 7012
      }
    ],
    "num_mppts": 9,
    "word_order": "low_first",
    "num_strings": 18
  },
  "weg-siw400-st075": {
    "fabricante": "WEG",
    "modelo": "SIW400 ST075",
    "tipo": "inversor_solar",
    "protocolo": "tcp",
    "connection_note": "WEG SIW400 ST075 (75 kW, rebrand GoodWe MT series). 4 MPPTs x 4 strings = 16 strings. Range MT 0x0300-0x036A + 0x03F6-0x03F9. Manual oficial: 4 MPPTs (Tabela 7.1).",
    "ai_map": {
      "fp": {
        "mode": "last",
        "block": 4,
        "scale": 1000,
        "offset": 2,
        "dataType": "S32"
      },
      "ia": {
        "mode": "avg",
        "block": 1,
        "scale": 10,
        "offset": 3,
        "dataType": "U16"
      },
      "ib": {
        "mode": "avg",
        "block": 1,
        "scale": 10,
        "offset": 4,
        "dataType": "U16"
      },
      "ic": {
        "mode": "avg",
        "block": 1,
        "scale": 10,
        "offset": 5,
        "dataType": "U16"
      },
      "vab": {
        "mode": "avg",
        "block": 1,
        "scale": 10,
        "offset": 0,
        "dataType": "U16"
      },
      "vbc": {
        "mode": "avg",
        "block": 1,
        "scale": 10,
        "offset": 1,
        "dataType": "U16"
      },
      "vca": {
        "mode": "avg",
        "block": 1,
        "scale": 10,
        "offset": 2,
        "dataType": "U16"
      },
      "freq": {
        "mode": "last",
        "block": 1,
        "scale": 100,
        "offset": 6,
        "dataType": "U16"
      },
      "work_state": {
        "mode": "last",
        "block": 1,
        "scale": 1,
        "offset": 10,
        "dataType": "U16"
      },
      "daily_yield": {
        "mode": "last",
        "block": 2,
        "scale": 10,
        "offset": 14,
        "dataType": "U16"
      },
      "total_yield": {
        "mode": "last",
        "block": 2,
        "scale": 10,
        "offset": 0,
        "dataType": "U32"
      },
      "temp_interna": {
        "mode": "last",
        "block": 1,
        "scale": 10,
        "offset": 11,
        "dataType": "S16"
      },
      "warning_code": {
        "mode": "last",
        "block": 2,
        "scale": 1,
        "offset": 5,
        "dataType": "U16"
      },
      "mppt1_voltage": {
        "mode": "avg",
        "block": 0,
        "scale": 10,
        "offset": 0,
        "dataType": "U16"
      },
      "mppt2_voltage": {
        "mode": "avg",
        "block": 0,
        "scale": 10,
        "offset": 1,
        "dataType": "U16"
      },
      "mppt3_voltage": {
        "mode": "avg",
        "block": 3,
        "scale": 10,
        "offset": 5,
        "dataType": "U16"
      },
      "mppt4_voltage": {
        "mode": "avg",
        "block": 3,
        "scale": 10,
        "offset": 6,
        "dataType": "U16"
      },
      "potencia_ativa": {
        "mode": "last",
        "block": 3,
        "scale": 1,
        "offset": 0,
        "dataType": "U32"
      },
      "string1_current": {
        "mode": "avg",
        "block": 3,
        "scale": 10,
        "offset": 9,
        "dataType": "U16"
      },
      "string2_current": {
        "mode": "avg",
        "block": 3,
        "scale": 10,
        "offset": 10,
        "dataType": "U16"
      },
      "string3_current": {
        "mode": "avg",
        "block": 3,
        "scale": 10,
        "offset": 11,
        "dataType": "U16"
      },
      "string4_current": {
        "mode": "avg",
        "block": 3,
        "scale": 10,
        "offset": 12,
        "dataType": "U16"
      },
      "string5_current": {
        "mode": "avg",
        "block": 3,
        "scale": 10,
        "offset": 13,
        "dataType": "U16"
      },
      "string6_current": {
        "mode": "avg",
        "block": 3,
        "scale": 10,
        "offset": 14,
        "dataType": "U16"
      },
      "string7_current": {
        "mode": "avg",
        "block": 3,
        "scale": 10,
        "offset": 15,
        "dataType": "U16"
      },
      "string8_current": {
        "mode": "avg",
        "block": 3,
        "scale": 10,
        "offset": 16,
        "dataType": "U16"
      },
      "string9_current": {
        "mode": "avg",
        "block": 3,
        "scale": 10,
        "offset": 17,
        "dataType": "U16"
      },
      "firmware_version": {
        "mode": "last",
        "block": 2,
        "scale": 1,
        "offset": 4,
        "dataType": "U16"
      },
      "potencia_reativa": {
        "mode": "last",
        "block": 4,
        "scale": 1,
        "offset": 0,
        "dataType": "S32"
      },
      "string10_current": {
        "mode": "avg",
        "block": 3,
        "scale": 10,
        "offset": 18,
        "dataType": "U16"
      },
      "string11_current": {
        "mode": "avg",
        "block": 3,
        "scale": 10,
        "offset": 19,
        "dataType": "U16"
      },
      "string12_current": {
        "mode": "avg",
        "block": 3,
        "scale": 10,
        "offset": 20,
        "dataType": "U16"
      },
      "string13_current": {
        "mode": "avg",
        "block": 3,
        "scale": 10,
        "offset": 21,
        "dataType": "U16"
      },
      "string14_current": {
        "mode": "avg",
        "block": 3,
        "scale": 10,
        "offset": 22,
        "dataType": "U16"
      },
      "string15_current": {
        "mode": "avg",
        "block": 3,
        "scale": 10,
        "offset": 23,
        "dataType": "U16"
      },
      "string16_current": {
        "mode": "avg",
        "block": 3,
        "scale": 10,
        "offset": 24,
        "dataType": "U16"
      }
    },
    "bi_map": {},
    "bo_map": {},
    "ai_blocks": [
      {
        "func": 3,
        "count": 4,
        "label": "Regs 0x0300-0x0303: PV1-2 V/I",
        "start": 768
      },
      {
        "func": 3,
        "count": 12,
        "label": "Regs 0x0304-0x030F: AC, freq, work_mode, temp",
        "start": 772
      },
      {
        "func": 3,
        "count": 15,
        "label": "Regs 0x0312-0x0320: E-Total, FW ver, warning, E-Day",
        "start": 786
      },
      {
        "func": 3,
        "count": 25,
        "label": "Regs 0x0352-0x036A: Pac U32 + PV3-4 V/I + Istr1-16",
        "start": 850
      },
      {
        "func": 3,
        "count": 4,
        "label": "Regs 0x03F6-0x03F9: Q + PF INT32",
        "start": 1014
      }
    ],
    "num_mppts": 4,
    "word_order": "high_first",
    "num_strings": 16
  },
  "weg-siw500h": {
    "fabricante": "WEG",
    "modelo": "SIW500H ST060",
    "tipo": "inversor_solar",
    "protocolo": "tcp",
    "connection_note": "WEG SIW500H ST060 (rebrand Huawei). 6 MPPTs fisicos x 2 strings = 12 strings. TCP via datalogger. Regs 30070-30074, 32016-32039, 32064-32090, 32106-32115.",
    "ai_map": {
      "fp": {
        "mode": "last",
        "block": 1,
        "scale": 1000,
        "offset": 20,
        "dataType": "S16"
      },
      "ia": {
        "mode": "avg",
        "block": 1,
        "scale": 1000,
        "offset": 8,
        "dataType": "S32"
      },
      "ib": {
        "mode": "avg",
        "block": 1,
        "scale": 1000,
        "offset": 10,
        "dataType": "S32"
      },
      "ic": {
        "mode": "avg",
        "block": 1,
        "scale": 1000,
        "offset": 12,
        "dataType": "S32"
      },
      "vab": {
        "mode": "avg",
        "block": 1,
        "scale": 10,
        "offset": 2,
        "dataType": "U16"
      },
      "vbc": {
        "mode": "avg",
        "block": 1,
        "scale": 10,
        "offset": 3,
        "dataType": "U16"
      },
      "vca": {
        "mode": "avg",
        "block": 1,
        "scale": 10,
        "offset": 4,
        "dataType": "U16"
      },
      "freq": {
        "mode": "last",
        "block": 1,
        "scale": 100,
        "offset": 21,
        "dataType": "U16"
      },
      "work_state": {
        "mode": "last",
        "block": 1,
        "scale": 1,
        "offset": 25,
        "dataType": "U16"
      },
      "daily_yield": {
        "mode": "last",
        "block": 2,
        "scale": 100,
        "offset": 8,
        "dataType": "U32"
      },
      "device_type": {
        "mode": "last",
        "block": 3,
        "scale": 1,
        "format": "hex",
        "offset": 0,
        "dataType": "U16"
      },
      "total_yield": {
        "mode": "last",
        "block": 2,
        "scale": 100,
        "offset": 0,
        "dataType": "U32"
      },
      "temp_interna": {
        "mode": "last",
        "block": 1,
        "scale": 10,
        "offset": 23,
        "dataType": "S16"
      },
      "mppt1_voltage": {
        "mode": "avg",
        "block": 0,
        "scale": 10,
        "offset": 0,
        "dataType": "S16"
      },
      "mppt2_voltage": {
        "mode": "avg",
        "block": 0,
        "scale": 10,
        "offset": 4,
        "dataType": "S16"
      },
      "mppt3_voltage": {
        "mode": "avg",
        "block": 0,
        "scale": 10,
        "offset": 8,
        "dataType": "S16"
      },
      "mppt4_voltage": {
        "mode": "avg",
        "block": 0,
        "scale": 10,
        "offset": 12,
        "dataType": "S16"
      },
      "mppt5_voltage": {
        "mode": "avg",
        "block": 0,
        "scale": 10,
        "offset": 16,
        "dataType": "S16"
      },
      "mppt6_voltage": {
        "mode": "avg",
        "block": 0,
        "scale": 10,
        "offset": 20,
        "dataType": "S16"
      },
      "nominal_power": {
        "mode": "last",
        "block": 3,
        "scale": 1000,
        "offset": 3,
        "dataType": "U32"
      },
      "dc_total_power": {
        "mode": "avg",
        "block": 1,
        "scale": 1,
        "offset": 0,
        "dataType": "S32"
      },
      "pid_alarm_code": {
        "mode": "last",
        "block": 1,
        "scale": 1,
        "offset": 26,
        "dataType": "U16"
      },
      "potencia_ativa": {
        "mode": "last",
        "block": 1,
        "scale": 1,
        "offset": 16,
        "dataType": "S32"
      },
      "string1_current": {
        "mode": "avg",
        "block": 0,
        "scale": 100,
        "offset": 1,
        "dataType": "S16"
      },
      "string2_current": {
        "mode": "avg",
        "block": 0,
        "scale": 100,
        "offset": 3,
        "dataType": "S16"
      },
      "string3_current": {
        "mode": "avg",
        "block": 0,
        "scale": 100,
        "offset": 5,
        "dataType": "S16"
      },
      "string4_current": {
        "mode": "avg",
        "block": 0,
        "scale": 100,
        "offset": 7,
        "dataType": "S16"
      },
      "string5_current": {
        "mode": "avg",
        "block": 0,
        "scale": 100,
        "offset": 9,
        "dataType": "S16"
      },
      "string6_current": {
        "mode": "avg",
        "block": 0,
        "scale": 100,
        "offset": 11,
        "dataType": "S16"
      },
      "string7_current": {
        "mode": "avg",
        "block": 0,
        "scale": 100,
        "offset": 13,
        "dataType": "S16"
      },
      "string8_current": {
        "mode": "avg",
        "block": 0,
        "scale": 100,
        "offset": 15,
        "dataType": "S16"
      },
      "string9_current": {
        "mode": "avg",
        "block": 0,
        "scale": 100,
        "offset": 17,
        "dataType": "S16"
      },
      "potencia_reativa": {
        "mode": "last",
        "block": 1,
        "scale": 1,
        "offset": 18,
        "dataType": "S32"
      },
      "string10_current": {
        "mode": "avg",
        "block": 0,
        "scale": 100,
        "offset": 19,
        "dataType": "S16"
      },
      "string11_current": {
        "mode": "avg",
        "block": 0,
        "scale": 100,
        "offset": 21,
        "dataType": "S16"
      },
      "string12_current": {
        "mode": "avg",
        "block": 0,
        "scale": 100,
        "offset": 23,
        "dataType": "S16"
      },
      "insulation_resistance": {
        "mode": "last",
        "block": 1,
        "scale": 1000,
        "offset": 24,
        "dataType": "U16"
      }
    },
    "bi_map": {},
    "bo_map": {},
    "ai_blocks": [
      {
        "func": 3,
        "count": 24,
        "label": "Regs 32016-32039: PV1-12 V/I (6 MPPTs x 2 strings)",
        "start": 32016
      },
      {
        "func": 3,
        "count": 27,
        "label": "Regs 32064-32090: P, V, I, freq, temp, isolamento, status, fault",
        "start": 32064
      },
      {
        "func": 3,
        "count": 10,
        "label": "Regs 32106-32115: energia total e diaria",
        "start": 32106
      },
      {
        "func": 3,
        "count": 5,
        "label": "Regs 30070-30074: Model ID + Rated Power",
        "start": 30070
      }
    ],
    "num_mppts": 6,
    "word_order": "high_first",
    "num_strings": 12
  }
};

function getCatalogByType(tipo) {
  return Object.entries(DEVICE_MODELS)
    .filter(function(e) { return e[1].tipo === tipo; })
    .map(function(e) { var m = e[1]; var o = { id: e[0] }; for (var k in m) { o[k] = m[k]; } return o; });
}

function getCatalogDevice(catalogId) {
  return DEVICE_MODELS[catalogId] || null;
}

function getDevicePoints(tipo) {
  return DEVICE_POINTS[tipo] || null;
}

function getResolvedPoints(catalogId) {
  var model = DEVICE_MODELS[catalogId]; if (!model) return null;
  var points = DEVICE_POINTS[model.tipo]; if (!points) return null;
  var resolve = function(arr, mapName) {
    return (arr || []).map(function(p) {
      var mapping = (model[mapName] && model[mapName][p.id]) || null;
      var out = { mapping: mapping, mapped: !!mapping };
      for (var k in p) { out[k] = p[k]; }
      out.mapping = mapping; out.mapped = !!mapping;
      return out;
    });
  };
  return {
    ai: resolve(points.ai, 'ai_map'),
    bi: resolve(points.bi, 'bi_map'),
    bo: resolve(points.bo, 'bo_map'),
  };
}
