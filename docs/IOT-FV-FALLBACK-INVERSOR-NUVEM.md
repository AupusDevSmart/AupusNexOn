# IOT — Fallback por-inversor via nuvem (Fusion/Huawei)

> Quando a TON de um inversor fica obsoleta, o modal “Dados em Tempo Real” passa a
> mostrar a leitura da **nuvem** (potência, temperatura, FP, geração) em vez de
> “sem dado / há N dias”. Data: 2026-09-01.
> Relacionados: `project_iot_cloud_fallback_hourly` (fallback de PLANTA), `project_bdo_integracoes_apis`.

## 1. Descoberta — quais provedores dão dado POR INVERSOR

Probe ao vivo com as credenciais do `.env`:

| Provedor | Por inversor? | Como |
|---|---|---|
| **Fusion (Huawei)** | ✅ **Sim** | `getDevList` (inversores devTypeId=1) + `getDevRealKpi` → `dataItemMap` com `active_power`, `temperature`, `power_factor`, `reactive_power`, `elec_freq`, `run_state`, `day_cap`, `total_cap`. |
| **iSolar (Sungrow)** | ❌ Não | endpoints de device dão **E900** no plano Free. Só planta (`getPowerStationList`). |
| **Deye** | ❌ Não (hoje) | `/device/list` autentica mas retorna **total=0** (inversores não autorizados no app OpenAPI). Só planta (`station/latest`). |

Conclusão: **implementado só p/ Fusion**. iSolar/Deye seguem só no fallback de PLANTA (`geracao_horaria_plantas`).

## 2. Como funciona (sem tocar no pacote shared)

O read `/equipamentos/:id/dados/atual` (pacote `@aupus/api-shared`) retorna a
**última linha de `equipamentos_dados` sem filtro de idade**. Então o fallback só
**escreve** uma linha com `fonte='NUVEM_FUSION'`, `timestamp=now`, no **mesmo shape
JSON do MQTT** — o modal pega naturalmente. Zero mudança no shared.

Shape gravado em `dados` (igual ao inversor via MQTT):
`power.{active_total[W], reactive_total, apparent_total, power_factor, frequency}`,
`energy.{daily_yield[kWh], total_yield[kWh]}`, `temperature.internal`,
`status.{work_state(0=Run), work_state_text}`. Também popula a coluna
`potencia_ativa_kw`. `active_power` (kW) da Huawei → ×1000 (W); `run_state===1` → `work_state=0` (“Run”).

**Guarda anti-clobber:** antes de gravar, checa se há leitura MQTT (não-nuvem) nos
últimos `STALE_MIN` (=40, env `FV_INV_FALLBACK_STALE_MIN`). Se a TON está viva, **pula** —
a nuvem só preenche o buraco, nunca sobrescreve dado vivo.

## 3. Peças

- **Conector** `fusion-solar.service.ts`: `listInverters(plantCode)` + `getInvertersRealKpi(devIds, devTypeId)`.
- **Tabela** `public.fv_inversor_cloud_map` (migration `db/manual-migrations/2026-09-01_fv_inversor_cloud_map.sql`): `equipamento_id` UNIQUE → `plant_code` + `device_id`(+esn/name). Raw SQL (fora do Prisma model).
- **Serviço** `fusion-inverter-fallback.service.ts`:
  - `@Cron('0 */30 * * * *')` → `runFallback()`: agrupa mapeamentos por planta, filtra os inversores com TON obsoleta, 1 `getDevRealKpi`/planta, grava linha nuvem.
  - Config: `listarDispositivos(unidadeId)` (inversores Huawei + candidatos NexON + mapa), `salvarMapa(equipamentoId, deviceId)` (valida que o device é da planta), `removerMapa`.
- **Endpoints** (`/api/v1/monitoramento-fv`, permission `equipamentos.manage`, escopo por dono):
  `POST inversores-nuvem/sync` · `GET inversores-nuvem/dispositivos?unidadeId=` ·
  `POST inversores-nuvem/mapa {equipamentoId,deviceId}` · `DELETE inversores-nuvem/mapa?equipamentoId=`.
- **UI** `InversorNuvemConfig.tsx` (seção no fim de `ControleSyncFvPage`): escolhe usina Fusion → tabela de inversores Huawei, cada um com dropdown p/ vincular ao equipamento NexON + botão “Rodar agora”.

## 4. Validação (2026-09-01)

Vertical testado com dados reais via Prisma client (Oderich II, `NE=33904862`):
`getDevList`=4 inversores → `getDevRealKpi` (active_power 85.9 kW, temp 38.5, day_cap 75.75)
→ grava `NUVEM_FUSION` → **read-back `equipamentos_dados.findFirst` (idêntico ao `obterDadoAtual`) ACHOU** e o shape renderiza (Status “Run”, 85.90 kW, 38.5 °C, 75.75 kWh). Dados de teste limpos depois. Backend rebuildado + `pm2 restart`; front buildado.

## 5. Limitações / pendências

1. **Modelagem NexON**: as plantas Fusion (Oderich) têm 1 equipamento “Inversor PV”
   (II/III) ou “STR…”/strings (I), NÃO um equipamento limpo por inversor físico.
   Vincular o único “Inversor PV” a UM device Huawei mostra só aquele inversor. Para
   granularidade real, criar N equipamentos-inversor no unifilar e mapear cada um.
2. **Cadência**: nuvem é horária/tempo-quase-real (getDevRealKpi), não instantânea. O
   modal mostra “atualizado há X min”; a partir de 30/60 min o próprio modal marca
   desatualizado (cron roda a cada 30 min).
3. **Rate-limit Huawei**: 1 `getDevRealKpi`/planta a cada 30 min só quando há inversor
   obsoleto — carga trivial (3 Oderich). Se crescer, revisar.
4. **Deye**: reavaliar se autorizarem device-level no app OpenAPI (aí replicar o padrão).

## 6. Log
- **2026-09-01** — Fallback por-inversor Fusion: conector device-level + tabela de mapa +
  serviço (cron 30 min, guarda anti-clobber) + endpoints + UI. Deployado. iSolar/Deye
  ficam no fallback de planta. Pendências no §5.
