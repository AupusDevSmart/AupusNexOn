-- Catálogo IoT: modelo "Landis+Gyr E750 A2E3 — SSU (NBR 14522)" no tipo Gateway Medidor (SSU).
-- Aparece no editor IoT no nó "Medidor Concessionária (SSU)" (device_type gateway_medidor).
-- Ke (kd) padrão 0,048 kWh/pulso = mesmo do backend hoje; CONFIRMAR o Ke real do medidor na
-- bancada/concessionária (spec §11) e ajustar aqui e/ou no nó do diagrama.
-- Rodar: PGPASSWORD=$PGPASSWORD psql -h localhost -p 5433 -U postgres -d aupus -f /var/www/service-nexon/docs/sql/2026-09-17_catalogo_ssu_e750.sql
BEGIN;
INSERT INTO iot_device_modelos (id, tipo_id, fabricante, modelo, protocolo, connection_note, mapeamento, created_at, updated_at)
VALUES (
  substr(md5('lg-e750-ssu'), 1, 26),
  '44ac84a41eaa22e88709ef86a0',                       -- tipo: Gateway Medidor (SSU)
  'Landis+Gyr',
  'E750 A2E3 (SSU NBR 14522)',
  'ssu',
  'Saida Serial de Usuario (ABNT NBR 14522) na entrada SU+ da TON-V2: X14-2 = SU+, X14-1 = SU- (GND). 110 baud, 8N1, bloco estendido (9 octetos) ou normal (8). Ke por medidor.',
  '{
    "catalog_id": "lg-e750-ssu",
    "kd": { "default": 0.048, "note": "kWh por pulso — confirmar Ke real (potencia conhecida x tempo); parametrizavel por no no diagrama (ke)" },
    "ssu": { "baud": 110, "formato": "auto", "intervalo_demanda_min": 15, "intervalo_reativo_min": 60 },
    "ai_map": {
      "phf":  { "unit": "kWh",   "apply_factor": "kd", "label": "Energia ativa direta (REG1)" },
      "phr":  { "unit": "kWh",   "apply_factor": "kd", "label": "Energia ativa reversa (REG2)" },
      "qhfi": { "unit": "kVArh", "apply_factor": "kd", "label": "Reativa Q1 indutiva (REG3)" },
      "qhri": { "unit": "kVArh", "apply_factor": "kd", "label": "Reativa Q2 indutiva (REG4)" },
      "qhrc": { "unit": "kVArh", "apply_factor": "kd", "label": "Reativa Q3 capacitiva (REG5)" },
      "qhfc": { "unit": "kVArh", "apply_factor": "kd", "label": "Reativa Q4 capacitiva (REG6)" }
    },
    "bi_map": { "sts": { "unit": "enum", "label": "Enlace SSU ok (1) / degradado (0)" } },
    "bo_map": {},
    "ai_blocks": []
  }'::jsonb,
  now(), now()
)
ON CONFLICT (fabricante, modelo) DO NOTHING;
COMMIT;
SELECT TRIM(id), fabricante, modelo, protocolo FROM iot_device_modelos WHERE protocolo = 'ssu';
