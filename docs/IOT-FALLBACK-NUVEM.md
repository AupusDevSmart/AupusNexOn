# Fallback de telemetria via APIs de nuvem (Fusion / iSolar / Deye)

> **Status: ESTUDO (design). Nada implementado.** — 2026-07-07
> Objetivo: avaliar usar as APIs de nuvem dos fabricantes de inversor como *fallback* (e, em alguns casos, fonte primária) quando a telemetria TON→MQTT do NexON falha.
> Doc de referência das APIs (auth, endpoints, gotchas, testado em campo): `/var/www/bdo-aupus-api/docs/APIS_MONITORAMENTO_INVERSORES.md`.

---

## TL;DR (conclusões)

1. **Não é 1 problema, são 2:** unidades **sem TON** (nuvem = fonte *primária*, hoje cegas) e unidades **com TON** (nuvem = *fallback* de gap).
2. **Escopo realista = só energia diária (kWh).** As APIs foram feitas pra ~1 pull/dia. Telemetria "ao vivo" (potência instantânea) **não é aplicável** por rate limit + latência de 5–15 min. Telemetria por-inversor/tempo real **fica com a TON**.
3. **Reuso do BDO = código dos conectores, NÃO os dados.** Mesmo Postgres, mas populações de unidade diferentes (0 IDs em comum). Os 3 services são standalone.
4. **Bloqueador prático:** o **de-para de unidade** (51 do NexON ≠ 12 do BDO, sem ID comum). É o que decide se o dado da nuvem "acha" a unidade certa.
5. **Growatt (12 inversores) não tem conector** em lugar nenhum.

---

## 1. Inventário: marca × telemetria × conector

Inversores cadastrados no NexON (`public.equipamentos`, categoria "Inversor PV", 44 total):

| Marca | Qtd | Já em MQTT (TON) | Sem TON hoje | Conector de nuvem |
|---|---|---|---|---|
| **Sungrow** | 29 | 14 | ~15 | iSolarCloud ✅ (Free = só dia atual) |
| **Growatt** | 12 | 10 | 2 | ❌ nenhum (exigiria ShineServer/OSS) |
| **Huawei** | 3 | 0 | 3 | Fusion Solar ✅ (funciona) |
| **Deye** | 0 | — | — | Deye Cloud ✅ (pronto, sem uso) |

**Candidatos diretos (hoje cegos, sem telemetria no NexON):** 3 Huawei + ~15 Sungrow + 2 Growatt.

---

## 2. Os 2 casos

- **Sem TON → nuvem é a ÚNICA fonte** (não é "fallback", é primário): Huawei 3 (Fusion), Sungrow ~15 (iSolar).
- **Com TON → nuvem é fallback de gap** (TON offline, Modbus falho, OTA, reboot): Sungrow 14, Growatt 10.

---

## 3. Teto de granularidade (a restrição que molda tudo)

| Dimensão | TON / MQTT (hoje) | APIs de nuvem |
|---|---|---|
| Escopo | **por inversor** | **por planta** (agregado) |
| Cadência | ~1/min tempo real | inversor→nuvem 5–15 min; rate limit impede polling denso |
| Grandezas | kW instantâneo, V, A/fase, energia | **kWh diário**; Sungrow tb `curr_power` (kW planta) |
| Série intra-dia | sim | **não** |

**Nuvem não popula os nós por-inversor do unifilar, não dá V/A por fase, não dá curva de alta resolução.**

### Rate limit → telemetria ao vivo está fora

| Uso | Chamadas/dia | Viável? |
|---|---|---|
| **Energia diária** | ~1–3/dia (iSolar traz todas as plantas numa call; Fusion aceita CSV de stations; Deye 1/station) | ✅ trivial |
| **Potência "ao vivo"** (`curr_power`) | pra parecer vivo: ~1–5 min em ~12h de sol = **150–700/dia por provedor** | ❌ throttle no Free + dado já defasado 5–15 min |

**Conclusão:** nuvem = camada de **energia diária**. Potência instantânea fica com a TON.

---

## 4. O que o BDO já tem (reuso)

Módulo `bdo-aupus-api/src/modules/integracoes/{fusion-solar,isolarcloud,deye-cloud}/`:

- **3 conectores implementados e standalone** (só dependem de env/`ConfigService`). Credenciais reais dos 3 no `.env` (chmod 600).
- **Mesmo Postgres do NexON**: `127.0.0.1:5433/aupus` — BDO no schema `bdo`, NexON no `public`. (NÃO é Supabase; isso é só frontend/import.)
- Mapa planta→nuvem em `bdo.unidades`: `provedor_monitoramento` (`fusion_solar`/`isolarcloud`/`deye`/`manual`) + `provedor_planta_id` (`NE=…` / `ps_id` / Deye `id`).
- Destino: `bdo.geracao_diaria(unidade_id, data)` UNIQUE, `kwh_realizado`/`kwh_previsto`. Upsert idempotente.
- **Cron `@Cron("0 0 21 * * *", America/Sao_Paulo)`** — os 3 em paralelo. **Implementado hoje (2026-07-07)**; a partir de agora preenche o dia. (O corte em 30/jun era só o limite do backfill, não bug.)
- Fusion/Deye têm histórico (backfill mês / 31 dias); **iSolar Free só o dia atual** (resto = `E900`).
- Sungrow `curr_power` **é buscado mas descartado** hoje (só `today_energy` é gravado).

### ⚠️ Atrito do reuso
- `public.unidades` (51) vs `bdo.unidades` (12) → **0 IDs em comum**. Sem `JOIN` direto; vínculo teria que ser por nome/UC.
- BDO só mapeou 7 das 12 unidades dele.
- **Recomendação:** portar/compartilhar os 3 services pro NexON, com o mapa provedor/planta vivendo em **`public.unidades`** (novas colunas), cobrindo as 51 unidades reais. Não depender de `bdo.geracao_diaria`.

---

## 5. Onde plugar no NexON

Ingestão real: `MqttService` (`service-nexon/aupus-nexon-api/src/shared/mqtt/mqtt.service.ts`). Inversores → buffer → flush 60s → upsert em `equipamentos_dados` com `fonte:'MQTT'`, `potencia_ativa_kw = power.active_total/1000`, `energia_kwh = energy.period_energy_kwh`.

**Coluna `fonte`** = `VarChar(20)` LIVRE (hoje `MQTT`, `MQTT_REDIS_BUFFER`, `TESTE`). **Nenhum consumidor filtra por `fonte='MQTT'`** → gravar fallback com `fonte='API_FUSION'`/`'API_ISOLAR'` flui **automático** pra gráfico/gauge/custos/COA/sinóptico.
- ⚠️ Tem que respeitar o **shape do JSON** esperado (inversor: `power.active_total` em W, `energy.period_energy_kwh`).
- ⚠️ Respeitar a unique `(equipamento_id, timestamp_dados)` — alinhar o timestamp pra não colidir com o MQTT.
- ⚠️ **Planta→inversor:** 6 unidades têm 1 inversor (mapeia 1:1 limpo); 10 unidades têm 2+ (precisa **ratear** por capacidade = estimativa). CF Investments tem 4.

**Alternativa (apresentação):** buscar a nuvem só na hora de exibir, com selo "via nuvem (defasado)" — não polui o histórico. Bom pro `curr_power`, mas ver rate limit acima.

---

## 6. Detecção de gap — não existe hoje

Só sinais read-time, nenhum AGE:
- `findLatest` (janela 15 min) → `null` = TON muda.
- COA `TEMPO_OFFLINE` = 10 min; `getGaps()` flag > 15 min.
- `iot_dispositivos_online` (online da TON via `/status` + LWT) — independente da telemetria.

Um fallback de energia diária **não precisa** de gatilho de gap (é fim-de-dia). Só o de apresentação precisaria — e esse está fora por rate limit.

> Nota relacionada: o gráfico de demanda usa `getGraficoDiaAgregado` (coluna `potencia_ativa_kw` + forward-fill; energia via `daily_yield`). O forward-fill da borda foi corrigido nesta mesma sessão (ver histórico).

---

## 7. Roteiro faseado (se/quando seguir)

- **Fase 0** — mapear as 51 unidades do NexON → provedor + planta_id (resolver o de-para, o bloqueador). Validar credencial iSolar em runtime. Decidir porte vs HTTP.
- **Fase 1 (maior valor, aplicável agora)** — energia diária de nuvem pras **3 Huawei + ~15 Sungrow sem TON** (hoje cegas) e pra tapar dias que a TON perdeu. `fonte='API_*'`, nível unidade, idempotente por `(unidade, dia)`. TON sempre tem prioridade.
- **Fase 2 (adiada)** — potência ao vivo via nuvem: **fora por ora** (rate limit + latência).
- **Fase 3 (opcional)** — conector Growatt (12 inversores) + por-inversor via endpoints pagos, se justificar.

---

## Riscos / princípios

- **Dado real da TON sempre ganha** do estimado da nuvem. Nuvem só quando não há TON.
- **Sem double-count:** `fonte` separada + idempotência + prioridade TON.
- **Sungrow é o elo fraco:** Free = só o dia atual, sem histórico/por-device.
- **Growatt sem conector** — gap não coberto sem construir um.
