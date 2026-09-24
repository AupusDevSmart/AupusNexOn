-- bo_outputs do mapa DEFAULT (aba Coils do Reydisp, 20/jul): substitui a lista do
-- espelho antigo (LED reset coil 99 etc. NAO existem no rele real).
-- DOUBLE_BIT (CB-1/DPDOns) via FC15 {addr,count,value 1=Off/2=On}; BIT via FC05 {coil}.
UPDATE iot_device_modelos SET
  mapeamento = mapeamento || '{
    "bo_outputs": [
      { "id": "cb1_abre",  "label": "CB-1 Abrir (DPC)",  "func": 15, "addr": 12, "count": 2, "value": 1 },
      { "id": "cb1_fecha", "label": "CB-1 Fechar (DPC)", "func": 15, "addr": 12, "count": 2, "value": 2 },
      { "id": "spdon1", "label": "SPDOns1", "coil": 564, "func": 5 },
      { "id": "spdon2", "label": "SPDOns2", "coil": 565, "func": 5 },
      { "id": "spdon3", "label": "SPDOns3", "coil": 566, "func": 5 },
      { "id": "spdon4", "label": "SPDOns4", "coil": 567, "func": 5 },
      { "id": "dpdon1_on",  "label": "DPDOns1 On",  "func": 15, "addr": 632, "count": 2, "value": 2 },
      { "id": "dpdon1_off", "label": "DPDOns1 Off", "func": 15, "addr": 632, "count": 2, "value": 1 },
      { "id": "dpdon2_on",  "label": "DPDOns2 On",  "func": 15, "addr": 634, "count": 2, "value": 2 },
      { "id": "dpdon2_off", "label": "DPDOns2 Off", "func": 15, "addr": 634, "count": 2, "value": 1 },
      { "id": "dpdon3_on",  "label": "DPDOns3 On",  "func": 15, "addr": 636, "count": 2, "value": 2 },
      { "id": "dpdon3_off", "label": "DPDOns3 Off", "func": 15, "addr": 636, "count": 2, "value": 1 },
      { "id": "dpdon4_on",  "label": "DPDOns4 On",  "func": 15, "addr": 638, "count": 2, "value": 2 },
      { "id": "dpdon4_off", "label": "DPDOns4 Off", "func": 15, "addr": 638, "count": 2, "value": 1 },
      { "id": "sg1", "label": "Setting Group 1", "coil": 129, "func": 5 },
      { "id": "sg2", "label": "Setting Group 2", "coil": 130, "func": 5 },
      { "id": "sg3", "label": "Setting Group 3", "coil": 131, "func": 5 },
      { "id": "sg4", "label": "Setting Group 4", "coil": 132, "func": 5 }
    ]
  }'::jsonb,
  updated_at = now()
WHERE fabricante = 'Siemens' AND modelo = '7SR5111';
SELECT modelo, jsonb_array_length(mapeamento->'bo_outputs') AS n_outputs FROM iot_device_modelos WHERE modelo='7SR5111';
