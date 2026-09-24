# IOT — NexON: Confiabilidade, Observabilidade e Comissionamento

> Revisão macro do NexON: por que hoje não é efetivo e o que fazer pra dado confiável
> ser **inegociável**. Documento vivo — priorização em aberto no fim.
>
> Data-base: 2026-08-25. Autor: dev.smart. Relacionados:
> [[IOT-MQTT-DESCONEXAO-INVESTIGACAO]], [[IOT-FALLBACK-NUVEM]], `project_coa_status_trip_offline`.

## 0. Propósito do NexON (o que ele TEM que entregar)

1. **Telemetria** dos equipamentos (inversor, medidor, relé) via TON→MQTT.
2. **Tempo real** no COA (o que funciona, o que não, onde).
3. **Alertas** (offline, trip, qualidade de dado).
4. **Acionamento automático** (futuro — ex.: Equatorial por falta de energia).
5. **Dado confiável** — pré-requisito de tudo acima. **Inegociável.**

Hoje: pontos instalados, **maioria não opera como deveria**. Dois sintomas recorrentes
sem causa clara: (a) estabelecimentos que "param" sem sabermos o motivo (NS Aparecida);
(b) inconsistência de dado (tensão do Power Meter 2 do M160 no Chimarrão).

---

## 1. Diagnóstico (achados desta investigação)

### 1.1 O COA não distinguia "internet caiu" de "device com defeito"
O status vinha **só do frescor do dado por equipamento** (`coa.service.ts`, janela de
frescor). "TON muda" e "TON viva mas equipamento mudo" caíam **os dois no cinza**
("sem info"). Sem essa distinção, não dá pra saber se o problema é de **campo**
(internet/energia) ou de **device/Modbus/fiação** — que é o que separa o caso NS
Aparecida (queda de conexão) do painel-2 do M160 (TON on-line, RS485 falhando).

### 1.2 O sinal de vida da TON EXISTE, mas não era consumido nem confiável
- A TON registra **Last Will (LWT)** MQTT: ao cair, o broker publica
  `<base>/status {online:false}` (retained). E um **birth** `{online:true}` ao conectar.
  Isso alimenta `iot_dispositivos_online` (`online`, `last_seen`).
- O COA **ignorava** essa tabela.
- Pior: `last_seen` só era carimbado no **birth** → a flag `online=true` ficava **presa**
  (ex.: TON2-1 @ Chimarrão com `online=true` mas `last_seen` de 3 semanas atrás). Flag
  sozinha **mente**.

### 1.3 Os diagnósticos ricos existem no schema, mas NÃO chegam
`iot_dispositivos_online` tem colunas `modbus_ok`, `modbus_err`, `wifi_rssi`,
`uptime_sec`, `mqtt_pub`, `free_heap`, `sd_writes`. O upsert do birth já **lê** esses
campos do payload — **mas o firmware só manda `{online:true}`**, então estão **todos
zerados** em todas as TONs. É o dado que pegaria o painel-2 (RS485 falhando =
`modbus_err` subindo) — e ele não flui.

### 1.4 Não há comissionamento
Nada valida, na instalação, se o dado é **coerente** (faixa, casa decimal, cruzamento com
placa). O bug do painel-2 (tensão errada por config de TP/casa decimal) passaria hoje sem
alarme. Idem sensor congelado (M160 UBS "lê 1x e trava").

---

## 2. O que já foi ENTREGUE (2026-08-25) — COA com 3 estados

Split do cinza em dois estados, **sem depender de firmware novo**:

| Estado | Cor | Significado | Ação de campo |
|---|---|---|---|
| 🟢 Online | verde | equipamento fresco | — |
| 🟡 Alerta | `#F59E0B` | tem dado, mas algum equipamento off/suspeito | verificar o device apontado |
| 🟠 **Sem dado** | `#EA580C` | **OFFLINE mas TON viva no broker** | **device/Modbus/fiação — NÃO é internet** |
| ⚫ Sem sinal | `#6B7280` | OFFLINE e **TON muda** | **internet/energia no local** |
| 🔵 Nuvem | `#3B82F6` | sem TON viva, mas com geração de nuvem recente | monitorado por nuvem |
| 🔴 Trip | `#EF4444` | proteção atuada (SOE não reconhecido) | atuação de proteção |

### Como "TON viva" é decidido (confiável)
- **Carimbo por telemetria VIVA** (`MqttService.touchLiveness`): qualquer mensagem
  **não-retained** e não-`/status` carimba `last_seen=now, online=true` na base
  correspondente (match por prefixo com `starts_with`, não `LIKE` — tópicos têm `_`).
  Throttle de 30s/tópico.
- **Ignora `retained`**: mensagem retida reentregue na reconexão é dado ANTIGO, não sinal
  de vida (senão toda TON caída "reviveria" no boot do backend).
- **`/status` fica com birth/LWT** (`processStatusAnnounce`/`markDispositivoOffline`).
- **Query do COA** (`coa.service.ts`): unidade é `tonViva` se algum equipamento dela casa
  (por prefixo de tópico) com uma linha `online=true` **E** `last_seen < 15 min`.
  Os dois juntos: `online=true` sozinho fica preso; `last_seen` sozinho pega o carimbo do
  LWT (que grava `now()` com `online=false`). Juntos = confiável.

### Arquivos tocados
- `aupus-nexon-api/src/shared/mqtt/mqtt.service.ts` — `touchLiveness` + flag `retained` no
  `handleMessage` (listener passa `packet.retain`).
- `aupus-nexon-api/src/modules/coa/coa.service.ts` — query de liveness + campo `tonViva`.
- `AupusNexOn/src/features/coa/api/coa-api.ts` — tipo `tonViva`.
- `AupusNexOn/src/features/coa/components/mapa-coa.tsx` — estado `semDado`, cor, chip,
  legenda e diagnóstico no popup.

### Validação
Pós-deploy: só **San German 01** (TON publicando ao vivo) entra em `tonViva`. NSA/UFV,
NSA/BOMBAS, Chimarrão (todas `online=false` via LWT) ficam **cinza** = internet. Casos de
`online=true` preso (11h sem publicar) são excluídos pela janela de 15 min. ✅

### Limitação conhecida
TON **conectada mas sem publicar NADA** (não lê nenhum device e não há telemetria de
outra unidade que ela sirva) não tem como ser distinguida de "caída" sem o heartbeat da
§3.1 — pode aparecer cinza. É o caso raro (RS485 totalmente morto com MQTT de pé). O
heartbeat resolve.

---

## 3. Roadmap (prioridade sugerida)

### 3.1 Observabilidade real da TON — heartbeat `[DEPLOYADA 2026-08-26]`
> **Reviravolta:** o firmware **JÁ publica** diagnóstico rico a cada 60s em
> `<base>/diagnostics` (`diag_publish_periodic`): `modbus_ok/err`, `wifi_rssi`,
> `uptime_sec`, `mqtt_pub`, `sd_writes`, `silence_sec`, `reset_reason`, `tcp_connected`…
> O backend simplesmente **não escutava**. Fix **100% backend, ZERO firmware**:
> - `MqttService`: `/diagnostics` entrou no subscribe (junto do `/status`) e no `DERIVADOS`;
>   handler novo `processDiagnostics` reusa `upsertDispositivoOnline` (campos batem 1:1) →
>   popula `iot_dispositivos_online` + marca `online=true`/`last_seen` (sinal de vida →
>   **resolve a limitação da §2**: TON conectada sem telemetria agora aparece viva/âmbar).
> - **Validado ao vivo:** San German (PG/GO/SG/UFV1) → `wifi_rssi=-47`, `uptime=4d`,
>   `mqtt_pub=22850`, **`modbus_ok=0 / modbus_err=10495`** = TON viva mas **Modbus 100%
>   falhando** (RS485/device, não internet). Exatamente o caso que a §2 não distinguia.
> - Surfaça no comissionamento: check **"Saúde Modbus da TON"** (§3.2) usa esses contadores.
>
> **Falta (Fase 2):** surfaçar `rssi`/`uptime`/`modbus_err` no popup do COA e histórico p/
> §3.4 (hoje o dado chega e fica em `iot_dispositivos_online`; comissionamento já lê).

### 3.2 Comissionamento — conferência na instalação `[DEPLOYADA 2026-08-26]`
> **Conceito (corrigido com o dono):** o NÚCLEO é **conferência humana** — o instalador
> compara os **principais dados do JSON** que o NexON recebeu de cada dispositivo com o que
> o **equipamento mostra de verdade** (display) e confirma. Comissionado ⇒ dado confiável.
> A validação automática de plausibilidade é **apoio secundário**, não o núcleo.
>
> - **Grandezas** `comissionamento.grandezas.ts`: extrai os principais campos por família
>   (medidor flat: Va/Vb/Vc, Ia/Ib/Ic, Pt→kW, Qt, FP; inversor: power.active_total→kW,
>   power_factor, frequency, energy.daily_yield/total_yield; A966: P_direto/P_rev/Q/FP).
>   UI = tabela **Grandeza | NexON recebeu | Real (equipamento) | ✓ confere**; comissionar
>   grava as confirmações (real + confere por grandeza) em `iot_comissionamento.resultado`.
> - **Motor de plausibilidade** `comissionamento.checks.ts` (apoio, recolhível na UI): roda
>   sobre as últimas ~20 leituras → pass/warn/fail. Foco em MEDIDORES flat. Faixas são
>   DEFAULTS canônicos (§4). Inclui "Saúde Modbus da TON" (via /diagnostics, §3.1).
> - **Verificações:** liveness (recência), não-congelado (valor idêntico N leituras),
>   qualidade (SUSPEITO), tensão em [90,500]V + desbalanceamento, corrente ≥0, |FP|≤1 +
>   FP baixo, frequência 58–62Hz.
> - **Endpoints** (`modules/comissionamento`, owner-scoped): `GET /comissionamento`
>   (lista pontos + status; `?unidadeId`/`?plantaId`), `GET /comissionamento/:id`
>   (preview ao vivo + registro), `POST /comissionamento/:id/comissionar` (sign-off,
>   **admin**, bloqueia em 'falha' sem `forcar`). Tabela `iot_comissionamento` (1/ponto).
> - **UI:** aba **Comissionamento** no sinóptico (`ComissionamentoTab.tsx`), ao lado de
>   Unifilar/IoT (gate `supervisorio.iot_view`). Lista pontos da unidade → checklist ao
>   vivo → botão Comissionar (admin).
> - **Validado** contra dados reais: pegou NSA offline (liveness) e FP anômalo (0.04) num
>   Power Meter.
>
> **Falta (Fase 2+):** faixas por tipo no catálogo `iot_device_tipos` (hoje `pontos`
> vazio); cruzamento com placa (kWp/fases); **gate** (ponto não-comissionado não conta no
> COA / vira alerta próprio); checks completos p/ inversor (shape aninhado).

Checklist-alvo completo por ponto (referência):
- **Liveness**: chega leitura da TON (birth + telemetria).
- **Faixa plausível** por campo: V 100–480, I ≥ 0, FP 0–1, freq 58–62, sinal de P coerente
  (geração vs consumo).
- **Casa decimal / escala** (o bug do painel-2): a magnitude bate com o esperado — V
  ~127/220/380, não 22 nem 2200 — **cruzando com a resposta do próprio medidor**
  (DPT/DCT/DPQ do M160), como já resolvido em `project_m160_decimal_register`.
- **Cruzamento com placa**: inversor ≤ kWp instalado; nº de fases bate; TC/TP conferem.
- **Snapshot assinado** → baseline do ponto (referência pra detecção de drift, §3.3).

Entregável: registro de comissionamento por equipamento (quem, quando, valores aceitos) +
selo "comissionado" que habilita o ponto no COA.

### 3.3 Guardrails contínuos de qualidade `[MÉDIA]`
Na ingestão (`mqtt.service`/pipeline), marcar `qualidade` e alertar:
- **Fora de faixa** → `SUSPEITO` (parcialmente já existe) + alerta.
- **Congelado**: mesmo valor N leituras seguidas → sensor travado (sintoma do M160 UBS
  "lê 1x e trava"). Ver `project_chimarrao_ubs_m160_addr_collision`.
- **Drift**: desvio persistente vs baseline do comissionamento.
- **Salto físico impossível**: ΔV/Δt ou ΔP/Δt absurdo entre leituras (glitch/overflow —
  já há detector de overflow UINT; generalizar).

### 3.4 Saúde do site — prevê queda antes de acontecer `[MÉDIA]`
Histórico de `wifi_rssi`/`uptime_sec`/`reboot_count` por TON → detectar link instável /
reboots repetidos (NS Aparecida caindo). Alerta preventivo "TON reiniciou X vezes hoje" /
"RSSI degradando". Depende do heartbeat (§3.1).

### 3.5 Alertas diferenciados por causa `[MÉDIA]`
Hoje o alerta de offline é genérico. Separar por **dono da ação**:
- **Sem sinal** (cinza) → alerta de **conectividade** (internet/energia) → equipe de campo.
- **Sem dado / device** (laranja) → alerta de **device/Modbus** → config/manutenção.
- **Qualidade** (suspeito/congelado/drift) → alerta de **dado** → revisar comissionamento.
Encaixa no motor de regras existente (`RegrasOfflineService`,
`EquipmentMonitorService`) — ver `project_coa_status_trip_offline`,
`project_equipamento_offline_email`.

---

- **2026-08-26** — **Fotos de prova** no comissionamento: coluna `iot_comissionamento.fotos`
  (jsonb), endpoints `POST/DELETE /comissionamento/:id/foto` (admin, base64 downscale no
  cliente → `uploads/comissionamento/`, servido `@Public` em `/api/v1/uploads/comissionamento/`).
  UI: seção "Fotos de prova" com câmera (`capture=environment`) + miniaturas + remover.
- **2026-08-26** — Conferência AO VIVO: o valor do NexON na tabela de comissionamento
  atualiza a cada 15s (o instalador varia a carga e vê o NexON acompanhar = "bate com o
  que ta acontecendo"). Achado: **o JSON do Power Meter/M160 NÃO tem frequência** (só
  Va/Vb/Vc, Ia/Ib/Ic, Pt/Qt/St, FPa/FPb/FPc, phf, consumo_*) — o medidor mede, mas o mapa
  de registradores do firmware não lê. Adicionar freq = mudança no mapa Modbus (firmware).

## 4. Decisões em aberto

- **§3.1 heartbeat**: intervalo (30s? 60s?) e tópico (`/status` vs `/health`). Custo de
  banda LoRa nos satélites (heartbeat compacto no caminho LoRa — ver
  `project_iot_lora_master_pull`).
- **§3.2 comissionamento**: faixas por tipo de equipamento (tabela de faixas no catálogo
  `iot_device_tipos`?) e quem pode assinar (super_admin/admin?).
- **Janela de 15 min** do `tonViva`: revisar por tipo (M160 publica 1/min; satélite LoRa
  pode ser mais lento).

---

## 5. Log de mudanças
- **2026-08-25** — COA 3 estados (TON viva vs sem sinal) implementado, deployado e
  validado. Este documento criado.
- **2026-08-26** — Comissionamento Fase 0+1 deployado: motor de checks
  (`comissionamento.checks.ts`), módulo/endpoints owner-scoped, tabela
  `iot_comissionamento` e aba **Comissionamento** no sinóptico. Preview + aceite, sem
  gate ainda. tsc a zero.
- **2026-08-26** — **Gate (suave)**: COA sinaliza pontos **não comissionados** por unidade
  (`coa.service` `naoComissionados` + `totalNaoComissionados`; popup + chip roxo no mapa).
  Não esconde/exclui — só sinaliza dado não validado.
- **2026-08-26** — **Heartbeat (§3.1)**: backend passou a ingerir `<base>/diagnostics`
  (firmware já publicava) → `iot_dispositivos_online` + liveness. Check "Saúde Modbus da
  TON" no comissionamento. Achado: San German com Modbus 100% falhando (mb_err 10k, mb_ok 0).
- **2026-08-26** — **Comissionamento redesenhado** pro conceito certo (conferência humana
  NexON × real): `comissionamento.grandezas.ts` extrai os principais dados do JSON;
  aba vira tabela de conferência (NexON | Real | ✓) com plausibilidade como apoio.
  Fix: `listar` dava 0 pontos (INNER JOIN em `equipamentos.planta_id` NULL) → LEFT JOIN
  por `unidades.planta_id`.
