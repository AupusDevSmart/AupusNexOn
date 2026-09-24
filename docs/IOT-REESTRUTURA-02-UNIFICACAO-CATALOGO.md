# Reestruturação IoT — Fase 3: Unificação de catálogo (caminho B)

> Objetivo: **um catálogo de tipos só** (`tipos_equipamentos`), lido tanto pelo
> **unifilar** quanto pelo **diagrama IoT**, diferenciando por `origem`. Aposenta a
> paleta estática `iot-diagram.v2.js`. **Design — nada implementado.** Data: 2026-09-08.
> Pré-req: Fases 1 (tipos 43→15) e 2 (`origem` em equipamentos) já deployadas.

## 1. Estado atual (mapa preciso do que é DB × estático)

| Peça | Onde vive hoje | Observação |
|---|---|---|
| **Catálogo de device Modbus** (contratos + modelos, register maps) | **BANCO** — `iot_device_tipos` (6 famílias, `pontos` jsonb) + `iot_device_modelos` (18) | Servido por `GET /iot-catalog/device-catalog.js` → globais `DEVICE_POINTS`/`DEVICE_MODELS`. `iot-diagram.tsx` carrega essa versão. O `public/iot-device-catalog.v2.js` (70 blocos) é **legado** (não é mais carregado). ⚠️ edits recentes ao estático (PM1200, Freq/FPt) **podem não estar no DB** — reconciliar. |
| **Instâncias do diagrama** (nós + arestas + projetos + firmwares) | **BANCO** — `iot_componentes`, `iot_conexoes`, `iot_projetos`, `iot_firmwares`, `iot_dispositivos_online` | Já persistido. |
| **Catálogo de tipos do unifilar** | **BANCO** — `tipos_equipamentos` (15, pós Fase 1) | Dirige o unifilar (DiagramV2). |
| **Paleta de node-types do diagrama IoT** (ton1-4, roteador, broker, A966, conversor, datalogger, inversor, power_meter, medidor_comum=Medidor Concessionária, relé, pivô, bomba, carregador) | **JS ESTÁTICO** — `public/iot-diagram.v2.js` (`DEVICE_TYPES` + categorias) | **É o que falta migrar.** Cada node carrega: label, icone, categoria, cor, `ports`, `generates_firmware`, `defaults`, `fields` (cadastro), link p/ família de device, e p/ TON as `capabilities` (bi/bo/pwm/lora). |
| **Regras de conexão** (allowedTargets, tipo de link rs485/tcp/lora/wifi/eth, validação de capacidade) | **JS ESTÁTICO** — `iot-diagram.v2.js` (imperativo) | Lógica, não dado. Fica em código, **parametrizada** pelos metadados do DB. |
| **Geração de firmware** | **JS ESTÁTICO** — `iot-firmware-generator.v2.js` / `.ton-v2.js` | Consome `DEVICE_POINTS` (já do DB) + a paleta. Fica em código; passa a ler a paleta do DB. |

**Conclusão:** device-catalog e instâncias já são DB. O (b) é migrar **a paleta de tipos** (metadados dos node-types) pro `tipos_equipamentos` e fazer o editor IoT + geradores lerem de lá. Regras e geração continuam código.

## 2. Alvo

- `tipos_equipamentos` vira o **catálogo único** de node-types (unifilar + IoT), cada tipo com:
  - `origem` (`unifilar` | `iot` | `ambos`) — filtra qual editor mostra o tipo.
  - `icone_svg` (já existe), `categoria_id` (já existe).
  - **`propriedades_schema`** (jsonb, já existe) → guarda os metadados de paleta: `ports`, `fields` (cadastro), `generates_firmware`, flags de regra de conexão (`allowedTargets`, tipos de link aceitos), e p/ TON as `capabilities`.
  - **`mqtt_schema`** (jsonb, já existe) OU FK → **família de device** (`iot_device_tipos`) p/ os que leem Modbus (inversor, power_meter, medidor concess, relé).
- Unifilar (DiagramV2) lê tipos com `origem in (unifilar, ambos)`; diagrama IoT lê `origem in (iot, ambos)`.
- Um endpoint só: `GET /tipos-equipamentos` (ou estende o `/iot-catalog`) devolve a paleta com os metadados.

## 3. O que MOVE vs o que FICA
- **Move p/ DB:** a lista de node-types + metadados (símbolo, categoria, ports, fields, generates_firmware, capabilities TON, link device, flags de regra).
- **Fica em código (parametrizado):** o algoritmo das regras de conexão e a geração de firmware. Eles passam a **ler** os metadados do DB em vez do objeto `DEVICE_TYPES` embutido.

## 4. Fases (incremental, com gate de validação — editor IoT/gerador não dá pra testar aqui)

1. **Schema + seed:** `origem` em `tipos_equipamentos`; semear os 15 + inserir os IoT que faltam (Roteador, Broker MQTT, Conversor, Datalogger, e TON/A966/Power Meter/Relé já existem). Popular `propriedades_schema` de cada um com os metadados hoje no `iot-diagram.v2.js` (extraí do JS → jsonb). Endpoint devolve a paleta.
2. **Editor IoT lê o DB:** `iot-diagram.v2.js` deixa de ter `DEVICE_TYPES` embutido e monta a paleta do endpoint. **Validar no app** (abrir diagrama, criar cada tipo, conectar) antes de seguir.
3. **Regras de conexão parametrizadas:** mover `allowedTargets`/tipos de link pros metadados; a função de validação lê do DB. Validar no app.
4. **Geradores lêem a paleta do DB.** Regressão **byte-idêntica** num diagrama de referência (mesmo padrão do TON-V2) + bancada.
5. **Aposentar** `iot-diagram.v2.js` estático + reconciliar edits órfãos do device-catalog (PM1200/Freq-FPt) no DB.
6. Relabel `medidor_comum` → **"Medidor Concessionária"** (chave interna mantida; A966 continua ligando nela).

## 5. Riscos
- **Geração de firmware** é produção e não testa aqui → gate byte-idêntico + bancada obrigatórios (fases 4).
- **Regras de conexão** viram dado: risco de perder um caso de borda → cobrir com o diagrama de referência.
- `medidor_comum` está em ~28 pontos (regras + geradores) — mexer só na fase 3/4, com o A966 no teste.
- Edits recentes ao catálogo estático (PM1200) podem não estar live no DB — verificar cedo.

## LOG

**2026-09-08 — Fase 1 (schema + seed base) FEITA** (`db/manual-migrations/2026-09-08_catalogo-unificacao-fase1.sql`, dry-run validado, backups em db/backups/):
- Decisões: (1)=FK `device_tipo_id` (não jsonb); (2)=categoria própria por IoT novo; (3)=`equipamentos.origem` binário (`unifilar|iot`), sem "ambos" — se está nos dois mundos são 2 linhas associadas. No TIPO, disponibilidade = **duas flags** `disp_unifilar`/`disp_iot` (um tipo pode ser oferecido nos dois pickers).
- Categorias 25→19 (apagou 10 órfãs incl. QGBT; criou Conversor/Datalogger/Broker MQTT/Roteador).
- tipos_equipamentos 15→19 (criou os 4 IoT), FK `device_tipo_id→iot_device_tipos` (7 linkados), flags semeadas.
- `equipamentos.origem` re-semeado binário (iot 66 / unifilar 369 ativos); Medidor Concessionária (ex-Equatorial) linkado.

**2026-09-08 — Passo 2 (propriedades_schema + endpoint da paleta) FEITO:**
- Extraí `COMPONENT_TYPES` (20) + `TON_CAPS` (8) + `CATEGORIES` do `iot-diagram.v2.js` via eval-com-shim (`scratchpad/extract-palette.cjs`), sem transcrever à mão.
- Populei `tipos_equipamentos.propriedades_schema` em **13 tipos** (12 simples: label/category/color/icon/ports/generates_firmware/defaults/fields; **TON agrega as 8 variantes** com `caps`). Mapa paleta→tipo: wifi_router→Roteador, meter_gateway→A966, mqtt_broker→Broker MQTT, inverter_datalogger→Datalogger, conversor→Conversor, inversor→Inversor FV, power_meter→Power Meter, medidor_comum→Medidor Concessionária, rele_protecao→Relé, pivo→Pivô, bomba→Bomba, carregador→Carregador.
- Endpoint **`GET /iot-catalog/palette`** (Public) reconstrói do DB o equivalente de COMPONENT_TYPES (20 chaves) + TON_CAPS (8) + CATEGORIES. Validado (retorna as 20). Usa `$queryRaw` (as colunas disp_iot/device_tipo_id são SQL-cru, fora do schema Prisma).

**2026-09-09 — Fase 2 (editor lê a paleta do DB) FEITA — VALIDAR NO APP:**
- `getPalette` + o seed re-feitos **sem perda** (spread completo): as TONs agora trazem antennaIcon/relayIcon/has_lora/has_relays/description/integrado. Endpoint = byte-a-byte o COMPONENT_TYPES embutido.
- `iot-diagram.tsx`: faz `fetch(BASE_URL/iot-catalog/palette)` e injeta em `window.__IOT_PALETTE__` ANTES de carregar o `iot-diagram.v2.js` (try/catch → fallback).
- `iot-diagram.v2.js`: após CATEGORIES, sobrescreve COMPONENT_TYPES/TON_CAPS/CATEGORIES com a paleta do DB SE presente; senão usa a embutida (nunca abre quebrado). Cache-bust `IOT_SCRIPTS_VERSION='20260909-palette-db'`. tsc+build OK, dist atualizado.
- ⚠️ Só afeta a PALETA do editor. Geração de firmware usa cópias próprias + DEVICE_POINTS (Fase 4, intacta). **Validar no app:** abrir diagrama → paleta aparece (console '[IoT] Paleta do DB aplicada (20 tipos)') → criar 1 TON + 1 device + 1 infra → conectar.

**Pendente da unificação:** ~~Fase 2~~ (feita) → regras de conexão viram dado (Fase 3)

**Pendente da unificação (continuação):** regras de conexão viram dado (Fase 3) → regras de conexão viram dado (Fase 3) → geradores lêem do DB + regressão byte-idêntica + bancada (Fase 4) → aposentar estático + reconciliar PM1200/Freq-FPt (Fase 5).

## 6. Decisões pendentes (fechadas em 2026-09-08 — ver LOG)
- **Família de device**: link por FK nova (`tipos_equipamentos.device_tipo_id → iot_device_tipos`) ou por dentro do `mqtt_schema` jsonb? (FK é mais limpo.)
- **Categorias**: limpar as 10 `categorias_equipamentos` cruft agora ou depois? (Os 4 IoT novos precisam de categoria — placeholder "Gateway" ou categoria limpa.)
- **`origem` nos tipos** com 3 valores (`unifilar|iot|ambos`) — confirmar (espelha o de equipamentos).


**2026-09-09 — Fase 3 (regras de conexão → dado) FEITA em MODO SOMBRA — VALIDAR:**
- `conn:{targets,hint}` em propriedades_schema (13 tipos). Modelo MÚTUO (B∈A.targets E A∈B.targets; 'ton'=qualquer TON; TON↔TON exige LoRa) reproduz as 8 regras.
- `_validateConnection` = wrapper: roda legacy (renomeado `_validateConnectionLegacy`) + data (`_validateConnectionData`), loga `[IoT][conn-shadow] divergencia`, **retorna legacy**. Zero divergência no uso → flip pro data + remove legacy.
- FALTA: `_getAllowedStyles` (estilo do link) ainda imperativo — sub-passo.
