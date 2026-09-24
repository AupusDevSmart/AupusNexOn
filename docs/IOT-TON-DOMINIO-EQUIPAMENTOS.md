# IoT × Unifilar — Domínio de equipamentos (TON fora do unifilar, overlap por identidade)

**Painel de I/O genérico (catálogo-driven) — DEPLOYADO:** `DeviceIoConfigModal` (novo) + botão "Configurar I/O" no modal do device IoT (mostra p/ tipos com bi/bo no catálogo, ex. `rele_protecao`, via `tipoTemIo`/`getDevicePoints(tipo)`). Seções: **BO** (comandos, Modbus) + **BI** (entradas digitais) mapeáveis a pontos (equipamento+ponto do unifilar, tipo 'comando'/'status'), **AI/AO** read-only (catálogo). Mapa guardado em `iot_componentes.props.io_config` (`{bi:{catId:{equipamento_id,ponto_id}}, bo:{...}}`), salvo com o diagrama. Decisões do usuário: I/O **funcional** (catálogo atual, não terminais físicos); print = mockup (construí novo); **genérico** (relé 1º, TON/futuros no mesmo padrão). **EXECUÇÃO do comando de relé via Modbus — DEPLOYADA (Path A + B):**
- Firmware já suporta `{"device":"<nome do relé>","cmd":"cmd_fechar"}` no `<topico>/cmd` da TON → `modbus_exec_command` escreve o coil (func 0x05, do catálogo). device_name = `strcmp` com o nome do componente.
- **Path A (frontend):** botão "Enviar" por BO no `DeviceIoConfigModal` (com confirmação) → resolve a TON gateway por BFS nas conexões do diagrama (relé→conversor→TON) → `sendCommand(tonEquipId, JSON.stringify({device,cmd}))`.
- **Path B (backend, `equipamentos-cmd.service::acionarPonto`):** ramo ANTES do ton_bo — `resolveReleBo(pontoId)`: SQL `jsonb_each(props->io_config->bo)` acha o relé cujo BO mapeia o ponto + BFS em iot_conexoes acha a TON gateway → publica `{device,cmd}` com ack (write único, sem pulso). Fluxo ton_bo (TON) intocado (só adiciona ramo). pm2 restart OK.
- ⚠️ AINDA FALTA: ingestão/exibição ao vivo dos estados BI mapeados. ton_bo/ton_bi NÃO reusados no painel (count fixo 6 ≠ counts do catálogo) → mapa vai em `props.io_config`.

Status ATUAL (2026-07-03): Fase 0 ✅ · Fase 1 ✅ (associação na criação + família + 1:1 no projeto) · **Espelhamento do modelo ✅** (`espelharModeloNoAtivo`: ao salvar props/vincular device 'ambos', `getCatalogDevice(catalog_id)` → `equipamentosApi.update(equipId, {fabricante, modelo})` → aparece no unifilar) · **shared-pages v0.8.0 ✅** (categoria TON filtrada do cadastro `EquipamentoUCModal`; Nexon bumpado, Service pendente). **Fase 2a ✅** (TON some do unifilar: filtro `equipamentoApareceNoUnifilar` no `DiagramV2Wrapper`). **Fase 2b ✅ DEPLOYADA** (backend `aupus-nexon-api`, `iot.service.ts::ensureTonEquipamentos` roda no `updateProjeto` ANTES do save do JSON: p/ cada TON sem vínculo válido, reusa equipamento com mesmo `topico_mqtt` OU cria [`classificacao='UC'`, `criticidade='3'`, `tipo_equipamento_id=cmoj2jy6w008vjqcdjeherr33`, `topico_mqtt=mqtt_topic_base`, `automacao`=ton3/4], carimba `equipamento_id` no JSON; idempotente). pm2 restart OK, Nest subiu. **FALTA: Fase 2c (painel de comando + BO/BI no modal IoT) + bump Service p/ shared-pages v0.8.0.**

---
(histórico) Fase 0 feita · Fase 1 no ar (v `20260703-associar`): ao CRIAR inversor/medidor no IoT abre "Qual X do unifilar é este?" (lista por família, não vinculados) + "Criar novo" (cria ativo genérico INVERSOR/MEDIDOR + vincula) + "Deixar sem vínculo". Picker no modal de props = fallback. Hook `onComponentAdded` no `addComponent` (só dispara no drop do palette; `fromJSON`/undo setam `components` direto → sem spam). Classificação: A966=ambos, SSW07=potencia (sem Modbus por ora). Pendente: **Fase 2 (TON: auto-create no syncRelational + esconder do unifilar + comando no modal IoT)**. Shared NÃO alterável do jeito limpo (git dep pinada, sem credencial GitHub) → `dominio` fica em código. `criar novo` usa ids semeados de tipo (INVERSOR `01JAQTE1INVERSOR000000005`, MEDIDOR `01JAQTE1MEDIDOR00000001`) — env-specific. Documento vivo.

## 1. Objetivo (pedido do chefe)
- **TON não é equipamento de unifilar** — não deve ser cadastrado junto com os ativos de potência nem aparecer no unifilar.
- Tudo do TON passa pelo **IoT**; automação (BO/BI/LoRa) é derivada do **modelo** (TON2/4 = LoRa, TON3/4 = relés/BI).
- Devices que existem nos **dois mundos** (hoje só **inversor** e **power_meter**) precisam ser **relacionados** — mudar o modelo em um lado reflete no outro.

## 2. Descobertas que restringem a solução (verificadas no código/DB)
1. **Tudo do TON ancora em `equipamentos.id`.** Comando (`<topico_mqtt>/cmd`), OTA (`<topico_mqtt>/ota/cmd`), BO/BI (`ton_bo.ton_id`/`ton_bi.ton_id` FK→equipamentos, CASCADE), pontos, estado (`equipamento_io_estado`), ingestão MQTT (mapa de subscrição vem de `equipamentos` com `topico_mqtt`) e permissões. As tabelas de IoT são **espelho/telemetria**, não entidade de controle. → Um TON **não funciona** sem uma linha em `equipamentos`.
2. **`equipamentos` e `tipos_equipamentos` são do pacote compartilhado `@aupus/api-shared`** (mesmo `PrismaService`), e a **tela de cadastro** vem de `@aupus/shared-pages`. Mexer em schema/tela desses = território compartilhado/CRM. **Não alterar unilateralmente.** Migração de schema aqui é SQL manual em `aupus-nexon-api/db/manual-migrations/`.
3. **Criar algo no IoT NÃO cria linha em `equipamentos`.** Componentes IoT vivem só em `iot_projetos.diagrama` (JSONB) + `iot_componentes`/`iot_conexoes` (projeção relacional, reescrita por `syncRelational` na mesma transação — bom padrão "documento + read-model"). Prova: inversor=23, power_meter=10, conversor/router/broker → **0** vinculados a `equipamentos`. Só o **TON** tem vínculo (`iot_componentes.equipamento_id`, FK→equipamentos **ON DELETE SET NULL**), e é **manual** (um `<select>` no modal).
4. Números: 16 TONs como equipamento (só **6 no unifilar**); 20 componentes TON no IoT (18 vinculados). A maioria já é "IoT-only".

## 3. Modelo escolhido
Três **domínios**, derivados do **tipo** do equipamento:

| Domínio | Aparece unifilar | Aparece IoT | Linha em `equipamentos` |
|---|---|---|---|
| `potencia` | ✅ | ❌ | ✅ (única) |
| `ambos` | ✅ | ✅ (nó IoT aponta pro ativo) | ✅ **uma só**, referenciada |
| `iot` | ❌ | ✅ | TON: sim (oculta); conversor/router/broker: nem precisa |

**Chave do overlap:** o device "ambos" é **uma linha só**, referenciada pelos dois lados via `iot_componentes.equipamento_id`. Não há "sincronizar duas cópias" — é **identidade**. Mudou o modelo → os dois enxergam.

**TON:** continua sendo uma linha (necessário p/ comando/OTA), com `dominio='iot'` → **escondido** do unifilar e da tela de equipamentos por **filtro/view**, sem tabela separada. A separação física (`iot_tons` dedicada) foi descartada: obrigaria re-apontar comando/OTA/BO-BI/ingestão/permissão — refatoração grande e arriscada, sem payoff.

## 4. Classificação dos tipos — ⚠️ REVISAR (decisão de negócio)
Proposta inicial (default seguro = `potencia` = comportamento atual). **Confirmar/ajustar antes de ligar comportamento.**

| dominio | tipos (codigo) |
|---|---|
| **iot** | `TON1` (e qualquer `TON*`) |
| **ambos** | `INVERSOR`, `INVERSOR_SUNGROW`, `Sun2000-250KTL-H1`, `METER_M160`, `MEDIDOR`, `METER_LANDIS`, `LANDIS_E750`, `M300`, `RELE` |
| **potencia** | `DISJUNTOR*`, `TRANSFORMADOR`, `PAINEL_SOLAR`, `PIVO`, `MOTOR`, `CHAVE*`, `BARRAMENTO`, `CAPACITOR`, `CARREGADOR_ELETRICO`, `TSA`, `SKID/Skid`, `PONTO`, `TELECOM`, `CFTV`, `SCADA`, `SALA_COMANDO`, `BANCO_BATERIAS`, `RETIFICADOR`, `BOTOEIRA`, `PAINEL_PMT`, `PAINEL_SOLAR` |
| **REVISAR** | `A966`/`IMS_A966` ("Gateway IoT A-966" — iot ou ambos?), `SSW070255T5SH2Z` (SSW07 soft-starter — lê Modbus? então ambos) |

## 5. Fonte da verdade (device ambos)
| Campo | Dono | Unifilar | IoT |
|---|---|---|---|
| nome, nº série | ativo | edita | lê |
| **fabricante/modelo** | **catálogo IoT (`catalog_id`)** | lê (read-only) | edita (troca catálogo) |
| modbus_address, posição no diagrama IoT | nó IoT | — | edita |
| dados de ativo (TUC, valor, manutenção) | ativo | edita | — |

O `fabricante/modelo` do ativo é **espelho** do catálogo IoT (preenchido ao vincular/criar, atualizado ao trocar). Sem coluna nova em `equipamentos` (evita mexer no schema compartilhado).

## 6. Fluxo "vincular / criar" (IoT, tipos ambos)
Ao soltar inversor/medidor no IoT:
1. Lista ativos **disponíveis** = `findByUnidade` filtrado por `dominio=ambos`, mesma unidade, **não vinculados a nenhum nó IoT** (regra 1:1).
2. **Vincular** → grava `equipamento_id` + carimba fabricante/modelo do catálogo no ativo.
3. **Criar novo** (nenhum sobrando) → cria em `equipamentos` só o básico (nome, tipo, tipo_equipamento_id, unidade_id, fabricante/modelo do catálogo, `diagrama_id` nulo) e vincula. Reusa `criarEquipamentoRapido`.

**Inverso (de graça):** criou no unifilar → aparece na lista do passo 1; criou no IoT → aparece no `equipamentosDisponiveis` do unifilar (não posicionado). Mesmo pool, mesma query `findByUnidade`.

## 7. Decisões fechadas
- **Cardinalidade 1:1** — um device = um ativo = ≤1 nó IoT + ≤1 posição no unifilar. Reforço: índice único parcial em `iot_componentes.equipamento_id` (where not null / not deleted).
- **Modelo IoT-owned p/ ambos** — `catalog_id` (nó IoT) é fonte única (dirige o mapa Modbus + o rótulo). Ativo espelha. Unifilar mostra read-only p/ ambos.
- **Dedup: pick-first + aviso de nome** — sem MAC único p/ inversor/medidor, não dá dedup automático. Mostrar existentes primeiro + avisar nome repetido. Sem bloqueio.
- **Delete/unlink já seguro** — FK `ON DELETE SET NULL`: apagar de um lado nunca destrói o outro.

## 8. Fases
- **Fase 0 — fundação (LOCAL, sem schema):** `dominio` como **classificação em código** (`AupusNexOn/.../v2/utils/dominioEquipamento.ts`), espelhando o padrão de `commandRegistry`/`TON_CAPS`. Nada de coluna no schema compartilhado. Inerte até a Fase 1 consumir.
- **Fase 1 — overlap ambos bidirecional (LOCAL):** modal IoT ganha vincular/criar p/ inversor/medidor; nó IoT lê fabricante/modelo do catálogo; índice único 1:1 (SQL manual em `iot_componentes`, tabela local). Filtro `dominio` no picker do unifilar e no do IoT.
- **Fase 2 — TON (LOCAL):** `syncRelational` **auto-cria** a linha oculta do TON (`dominio=iot`) no save do projeto IoT (idempotente: só se o componente TON não tem `equipamento_id`); esconde TON do unifilar; move painel de comando + BO/BI pro modal IoT (guiado pelo modelo). Comando/OTA seguem intactos (mesma linha).
- **Fora de escopo local (precisa coordenação com pacote compartilhado / CRM):** tirar "TON" da tela de cadastro `@aupus/shared-pages`; qualquer coluna nova em `equipamentos`/`tipos_equipamentos`. Contornado por filtro em código no nexon.

## 9. Riscos / o que NÃO tocar
- **Não** alterar schema de `equipamentos`/`tipos_equipamentos` nem a tela `@aupus/shared-pages` (compartilhado/CRM). Tudo resolvido por classificação em código + APIs existentes.
- **Auto-create do TON (Fase 2)** escreve em produção → precisa ser **idempotente** e testado (não criar linha duplicada a cada save).
- A classificação dos 38 tipos (§4) é decisão de negócio — confirmar antes de ligar comportamento.
