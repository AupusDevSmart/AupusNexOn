# Reestruturação IoT — Fase 1: Limpeza (de-para + desvinculação)

> Base: `arquivos/nexon-modelo.md` (visão do chefe) + decisões tomadas.
> **Nada foi executado ainda** — este doc é pra aprovação antes de tocar no banco/código.
> Data: 2026-09-08.

## Decisões já fechadas
- **Tabela única** de equipamentos; campo **`origem` (unifilar | iot)** diferencia a procedência; **classificação = o tipo** do equipamento. Tratar todos igual. Simplificar o cadastro depois (fase posterior).
- **Service e Project ficam INTOCADOS** (estão em produção). Limpeza é só desvincular cruft do NexON e consolidar tipos. DBs já separados: NexON=`aupus`, Service=`aupus_service`.
- **Barramento** = recurso **visual** (linha/junção), não é tipo de elemento.
- Consolidação de tipos: **fazer tudo de uma vez**, com este de-para revisado antes.

---

## 1. De-para dos tipos (43 atuais → canônicos)

### 1a. Consolidação direta (têm equipamento — remapear e apagar o tipo antigo)
| Tipo atual | nº equip | → Tipo canônico | origem | Observação |
|---|---:|---|---|---|
| Disjuntor | 63 | **Disjuntor** | unifilar | |
| Disjuntor Fechado (Energizado) | 23 | **Disjuntor** | unifilar | aberto/fechado é **estado**, não tipo |
| Disjuntor Aberto (Desenergizado) | 14 | **Disjuntor** | unifilar | idem |
| Transformador | 33 | **Transformador** | unifilar | |
| Transformador de Serviço Auxiliar | 2 | **Transformador** | unifilar | |
| Inversor Solar Sungrow | 34 | **Inversor Fotovoltaico** | unifilar/iot | marca → atributo |
| Inversor Solar | 16 | **Inversor Fotovoltaico** | unifilar/iot | |
| Inversor Huawei | 4 | **Inversor Fotovoltaico** | unifilar/iot | marca → atributo |
| Painel Solar Fotovoltaico | 59 | **Módulo Fotovoltaico** | unifilar | |
| Motor Elétrico | 28 | **Motor Elétrico** | unifilar | |
| Pivô Central de Irrigação | 21 | **Pivô de Irrigação** | unifilar/iot | |
| Medidor M160 | 25 | **Power Meter** | iot | amostras = CHINT / Power_Meter_* → é PM |
| Equatorial | 9 | **Medidor Concess** | unifilar | amostras = "Padrão de Energia - Ramal de Entrada" |
| Relé de Proteção | 6 | **Relé de Proteção** | iot | |
| IMS A966 | 6 | **A966** | iot | |
| Gateway IoT A-966 | 1 | **A966** | iot | |
| TON | 20 | **TON** | iot | variante V1/V2 + modelo 1-4 = atributo |
| Chave Fusível | 4 | **Chave** | unifilar | |
| Chave Seccionadora Aberta | 3 | **Chave** | unifilar | estado → atributo |
| RISE ULTRAFAST CARREGADOR DC | 9 | **Carregador Elétrico** | unifilar/iot | marca → atributo |
| Carregador Elétrico Genérico | 1 | **Carregador Elétrico** | unifilar/iot | |
| Bomba de Combustível | 1 | **Bomba de Combustível** | unifilar/iot | |
| Banco de Capacitores | 0 | **Banco de Capacitor** | unifilar | (renomear; vazio) |

### 1b. Apagar direto (0 equipamento, fora das listas)
Canadian · Landis Gyr · Landis+Gyr E750 · Multimeter M300 · Medidor de Energia ·
Painel PMT · Retificador · SKID de Equipamentos · Sala de Comando · Sistema SCADA ·
Sistema de CFTV · Sistema de Telecomunicações · Botoeira de Comando · Banco de Baterias ·
Ponto de Junção · Chave Seccionadora Fechada. **(16 tipos, todos vazios → delete seguro)**

### 1c. ⚠️ Precisam da sua decisão (têm equipamento, fora das listas)
| Tipo atual | nº | amostra | Proposta |
|---|---:|---|---|
| SSW07 | 3 | SoftStarter_1/2/3 | soft-starter de motor → **Motor Elétrico**? ou apagar? |
| Conjunto de manobra | 3 | "Skid" | agrupador → apagar (vira nada) ou **Barramento visual**? |
| QGBT AUTO PORTANTE | 1 | "QGBT - AJEL" | painel BT → apagar ou **Barramento visual**? |
| Barramento Elétrico | 1 | "BARRAMENTO 1" | Barramento vira **visual** → o 1 equip. vira linha/junção (sem cadastro) |

### Tipos IoT a CRIAR (existem só na paleta JS, não em `tipos_equipamentos`)
Power Meter · Conversor · Datalogger · Broker MQTT · Roteador. (A paleta `iot-diagram.v2.js`
já tem esses; falta existirem como tipo na tabela única — parte da unificação dos catálogos.)

### Tipo a REMOVER da paleta IoT
`medidor_comum` (não está na lista nova). Referenciado em `iot-diagram.v2.js` +
`iot-firmware-generator*.js` + `iot-diagram.tsx` — remover junto.

**Conjunto canônico final (~20 tipos):** Disjuntor, Transformador, Inversor Fotovoltaico,
Módulo Fotovoltaico, Motor Elétrico, Pivô de Irrigação, Medidor Concess, Chave,
Banco de Capacitor, Carregador Elétrico, Bomba de Combustível · (IoT) Power Meter,
Relé de Proteção, TON, A966, Conversor, Datalogger, Broker MQTT, Roteador. Barramento = visual.

---

## 2. Desvincular cruft de service do NexON (sem tocar em Service/Project)

| Item | O que é | Estado | Proposta |
|---|---|---|---|
| Módulo `core/modules/sincronizacao` | outbox/worker que entrega eventos de cadastro pra outro serviço (`/sincronizacao/eventos`) | **ATIVO** (registrado no app.module) | ⚠️ **decisão sua**: se o Service ainda consome, MANTER; se morreu, desregistrar |
| UI "plano de manutenção" no `EquipamentoUCModal` / `EquipamentosPage` | seções que só existem pro AupusService | morto no NexON | remover as seções/campos service-only |
| `@aupus/api-shared` em 3 arquivos | resíduo do pacote compartilhado (backend já migrou p/ `@/core`) | `app.module.ts`, `AppRoutes.tsx`, `dominioEquipamento.ts` | migrar os 3 p/ `@/core` / local |
| Comentários "AupusService usa X" | só comentários | inócuo | limpar ao mexer nos arquivos |

---

## 3. Ordem de execução proposta (após aprovação)
1. **Migração de tipos** (uma transação, com contagem de sanidade): criar/renomear os canônicos, remapear `equipamentos.tipo_equipamento_id`, apagar os 16 vazios + os consolidados, resolver os 4 do §1c. Backup do `tipos_equipamentos` + `equipamentos(id,tipo_equipamento_id)` antes.
2. **Adicionar `origem`** em equipamentos e semear (unifilar vs iot) pela procedência atual.
3. **Desvincular cruft** (§2), conforme suas decisões.
4. Remover `medidor_comum` da paleta + geradores.

Cadastro simplificado, unificação dos 2 catálogos (DB + paleta JS) e sheets = fases seguintes.

---

## 4. Log de execução (2026-09-08)

**FEITO:**
- **Migração de tipos 43 → 15** executada e commitada (`db/manual-migrations/2026-09-08_reestrutura-tipos.sql`). Dry-run (ROLLBACK) validou antes: 15 tipos, consolidação certa, 0 órfão novo (os 53 ativos sem tipo são pré-existentes — IoT/visuais). Backup em `db/backups/2026-09-08_pre-reestrutura/` (`tipos_equipamentos.sql` + `equipamentos_tipo.csv`).
  - Decisões §1c aplicadas: SSW07/Conjunto de manobra(Skid)/QGBT/Barramento → equip **soft-deletados** + tipos apagados (Barramento vira visual).
  - Catálogo final (15): Disjuntor, Transformador, Inversor Fotovoltaico, Módulo Fotovoltaico, Motor Elétrico, Pivô de Irrigação, Power Meter, Medidor Concess, Relé de Proteção, A966, TON, Chave, Carregador Elétrico, Bomba de Combustível, Banco de Capacitor.
- **`SincronizacaoModule` desregistrado** do `app.module` (Service não consome). Boot limpo, `/sincronizacao/eventos` → 404. Arquivos do módulo mantidos (apagar em passada futura).
- **Desvinculação de código já estava feita** (backend em `@/core`, 0 import real de `@aupus/api-shared`; front com 1 referência só, comentário). Corrigido o comentário obsoleto em `dominioEquipamento.ts` ("não alterar schema unilateralmente" não vale mais).

**FEITO (2026-09-08, parte 2):**
- **Coluna `origem` em equipamentos** (`db/manual-migrations/2026-09-08_origem-equipamentos.sql`, commitada, dry-run validado): `unifilar | iot | ambos`, NOT NULL default 'unifilar'. Semeada pelas listas do usuário: iot = Power Meter/Relé/TON/A966 (66 ativos); ambos = Inversor/Carregador/Bomba/Pivô (86); resto unifilar (283); órfãos com MQTT → iot. Nada lê a coluna ainda (sem regressão); `dominioEquipamento.ts` continua computando por ora — trocar por ler a coluna é passo seguinte.

**PENDENTE — Unificação de catálogos (NÃO fazer cego, é workstream próprio):**
- ⚠️ `medidor_comum` **não é lixo morto**: é o "medidor atrás do A966". Está nas **regras de conexão** do diagrama IoT (A966 só liga em medidor_comum, e vice-versa) e nos **geradores de firmware** (~28 pontos em iot-diagram.v2.js + os 2 geradores). 0 diagrama salvo usa hoje, mas remover exige **merge `medidor_comum` → `power_meter`** (repontar a regra do A966) + validar no app/gerador. Deixado p/ a fase de unificação.
- Criar Conversor/Datalogger/Broker MQTT/Roteador como **tipo** exige `origem`/`dominio` no `tipos_equipamentos` (senão poluem o picker do unifilar) + `categoria_id` (NOT NULL — a tabela `categorias_equipamentos` também é cruft a limpar). Fazer junto com o merge acima, quando o picker filtrar por origem.
- Simplificar cadastro; motor de sheets (mockups em `arquivos/`).
- Apagar arquivos mortos do módulo `sincronizacao`.
