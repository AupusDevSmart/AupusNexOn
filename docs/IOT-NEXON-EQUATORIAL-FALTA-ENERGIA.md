# Plano: TON detecta queda de energia (função 27) → webhook Equatorial

**Data**: 2026-05-29
**Status**: **planejado, não implementado** — pronto para outro dev executar
**Escopo**: backend `aupus-nexon-api` (subscriber MQTT + serviço de webhook) e schema do PostgreSQL (1 nova tabela)
**Não-escopo**: firmware da TON (já está OK com função 27 mapeada no Pextron URP6000)
**Out-of-scope**: implementação no Aupus Chat (já existente em `https://wpp.aupusenergia.com.br`, contrato em [/var/www/INTEGRACAO_NEXON_EQUATORIAL.md](/INTEGRACAO_NEXON_EQUATORIAL.md))

---

## Sumário

1. [Visão geral do fluxo](#1-visão-geral-do-fluxo)
2. [Estado atual mapeado](#2-estado-atual-mapeado)
3. [Gaps a preencher](#3-gaps-a-preencher)
4. [Schema novo: `webhook_events_nexon`](#4-schema-novo-webhook_events_nexon)
5. [Plano de implementação em fases](#5-plano-de-implementação-em-fases)
6. [Detalhes técnicos críticos](#6-detalhes-técnicos-críticos)
7. [Variáveis de ambiente](#7-variáveis-de-ambiente)
8. [Validação e testes](#8-validação-e-testes)
9. [Operação e monitoramento](#9-operação-e-monitoramento)
10. [Riscos e dependências](#10-riscos-e-dependências)
11. [Resultado da implementação](#11-resultado-da-implementação)
12. [Discriminação de causa e modelo de confiança](#12-discriminação-de-causa-e-modelo-de-confiança)
13. [Detecção por tipo de dispositivo (matriz de capacidade)](#13-detecção-por-tipo-de-dispositivo-matriz-de-capacidade)

---

## 1. Visão geral do fluxo

```
[TON em campo]
    │
    │ relé Pextron URP6000 dispara f27 (subtensão)
    │ → coil 0/1/2 muda 0→1
    │
    │ Modbus RTU/TCP
    ▼
[Firmware TON]
    │ publica MQTT: <topic_base>/<deviceName>/status
    │ payload: { "27": {"f27a": 1, "f27b": 1, "f27c": 1}, ... }
    ▼
[Broker MQTT: 72.60.158.163:1883]
    │
    │ subscription do backend
    ▼
[aupus-nexon-api: MqttIngestionService]
    │ grava em equipamentos_dados (JSONB)
    │
    │ NOVA LÓGICA: detecta edge 0→1 em f27a/b/c
    │ → emite evento 'falta_energia.detectada'
    ▼
[NOVO: FaltaEnergiaWebhookService]
    │ 1) busca dados (UC, endereço, cliente) via joins
    │ 2) gera eventId (idempotente)
    │ 3) grava webhook_events_nexon (status='pending')
    │ 4) POST → wpp.aupusenergia.com.br/.../falta-energia
    │ 5) atualiza status='sent' + complaintId
    ▼
[Aupus Chat: conversa com Clara (~2-5 min)]
    │
    │ POST callback → nexon-api
    ▼
[NOVO: EquatorialCallbackController]
    │ atualiza webhook_events_nexon
    │ status='completed', protocoloEquatorial=NNN
```

---

## 2. Estado atual mapeado

### 2.1 Firmware — ✅ pronto

| Item | Status | Local |
|---|---|---|
| Função 27 mapeada no catálogo Pextron URP6000 | ✅ | [iot-device-catalog.v2.js:221-287](../AupusNexOn/public/iot-device-catalog.v2.js#L221) — coils 0/1/2 = f27a/b/c |
| Contrato DEVICE_POINTS `rele_protecao` define f27a/b/c | ✅ | [iot-device-catalog.v2.js:23-100](../AupusNexOn/public/iot-device-catalog.v2.js#L23) |
| Decodificação bit-level de coils | ✅ | [iot-firmware-generator.v2.js:2052](../AupusNexOn/public/iot-firmware-generator.v2.js#L2052) — `(getResponseBuffer(reg) >> bit) & 1` |
| Publicação MQTT em `/status` com agrupamento `"27": {...}` | ✅ | [iot-firmware-generator.v2.js:2126-2185](../AupusNexOn/public/iot-firmware-generator.v2.js#L2126) |
| Detecção de edge (transição 0→1) | ❌ | firmware publica **estado** (snapshot), não evento. Detecção será no backend (mais simples — não exige reflash) |

### 2.2 Backend — parcialmente pronto

| Item | Status | Local |
|---|---|---|
| MQTT subscriber recebe `<base>/<deviceName>/status` | ✅ | `aupus-nexon-api/src/shared/mqtt/mqtt.service.ts` |
| Ingestão grava em `equipamentos_dados` (JSONB + timestamp + equipamento_id) | ✅ | `aupus-nexon-api/src/modules/.../mqtt-ingestion.service.ts:40-86` |
| Engine de regras (`regras_logs_mqtt`) com cooldown | ✅ | `aupus-nexon-api/src/modules/.../regras-logs-mqtt.engine.ts:71-98` — mas só grava log, não dispara webhook |
| HttpModule / HTTP client outbound | ❌ | **falta importar** `@nestjs/axios` ou usar `fetch` nativo |
| Tabela de outbox/queue pra retry | ❌ | **precisa criar** (`webhook_events_nexon`) |
| Endpoint público pra receber callback | ❌ | **precisa criar** rota `POST /webhook/equatorial-callback` com `@Public()` |
| API key Aupus Chat configurada | ❌ | precisa `.env` ou tabela `configuracoes` |

### 2.3 Banco de dados — dados disponíveis

Cadeia confirmada via SQL (mapeamento UC → endereço → cliente → telefone):

```sql
-- Query base (vai ser reusada no service)
SELECT
  ic.id              AS componente_id,
  ic.equipamento_id,
  e.planta_id,
  p.numero_uc,                                          -- payload.uc
  p.logradouro, p.numero, p.complemento,                -- payload.endereco.*
  p.bairro, p.cidade, p.uf, p.cep,
  org.nome           AS cliente_nome,                   -- payload.cliente.nome
  org.documento      AS cliente_cpf_cnpj,               -- payload.cliente.cpfCnpj
  t.numero_telefone  AS cliente_telefone                -- payload.cliente.telefone
FROM iot_componentes ic
JOIN equipamentos e         ON ic.equipamento_id = e.id
JOIN plantas p              ON e.planta_id = p.id
JOIN organizacoes org       ON org.id = p.proprietario_id
LEFT JOIN telefones t       ON t.telefonavel_id = org.id AND t.telefonavel_type = 'organizacao'
WHERE ic.tipo = 'ton1' AND ic.id = $1
LIMIT 1;
```

> ⚠️ **Validar antes**: confirmar se `telefones` é polimórfica e qual o valor exato de `telefonavel_type` pra organização. Se não houver telefone, payload precisa de fallback (ex: rejeitar evento + log "sem telefone cadastrado").

---

## 3. Gaps a preencher

| # | Gap | Severidade | Responsável (fase) |
|---|---|---|---|
| G1 | Sem detecção de edge 0→1 em `f27a/b/c` | **Crítico** | Fase 2 |
| G2 | Sem tabela de outbox/retry (`webhook_events_nexon`) | **Crítico** | Fase 1 |
| G3 | Sem HttpService configurado pra outbound | Alto | Fase 3 |
| G4 | Sem endpoint público pra receber callback | Alto | Fase 4 |
| G5 | Sem variáveis de ambiente da API key/URL | Médio | Fase 1 |
| G6 | Sem cooldown anti-spam (evitar disparar 10x por minuto) | Médio | Fase 2 |
| G7 | Sem retry de POST com backoff | Médio | Fase 3 |
| G8 | Sem UI pra ver histórico de webhooks disparados | Baixo | Fase 5 (opcional) |

---

## 4. Schema novo: `webhook_events_nexon`

Tabela que serve simultaneamente como **outbox** (fila de envio com retry) e **histórico** (auditoria + idempotência). Aplicar via SQL surgical (DEPLOY.md §5).

```sql
CREATE TABLE IF NOT EXISTS webhook_events_nexon (
  -- ID estável (também usado como x-event-id e enviado ao Aupus Chat)
  -- Formato sugerido: 'nexon-{equipamento_id}-{ts_iso_basic}'
  -- Ex: 'nexon-cmoj2wbqc00b7jqcduxgw1ueh-20260529T130000Z'
  event_id           VARCHAR(120)  PRIMARY KEY,

  -- Origem do evento
  equipamento_id     CHAR(26)      NOT NULL REFERENCES equipamentos(id),
  componente_id      CHAR(26)      NOT NULL REFERENCES iot_componentes(id),
  tipo_evento        VARCHAR(40)   NOT NULL DEFAULT 'falta_energia',
  trigger_fields     JSONB         NOT NULL,  -- {"f27a": 1, "f27b": 1, "f27c": 0}

  -- Payload bruto enviado (auditoria)
  request_payload    JSONB         NOT NULL,
  response_payload   JSONB,                    -- 201 do Aupus Chat (complaintId, conversaId)
  callback_payload   JSONB,                    -- callback final (protocoloEquatorial)

  -- Estado do evento
  status             VARCHAR(20)   NOT NULL DEFAULT 'pending',
  -- pending | sent | completed | failed | needs_human | timeout
  complaint_id       VARCHAR(40),              -- ULID retornado pelo Aupus Chat
  protocolo_equatorial VARCHAR(40),            -- protocolo final da concessionária
  error_message      TEXT,

  -- Retry control
  send_attempts      INT           NOT NULL DEFAULT 0,
  last_attempt_at    TIMESTAMP,
  next_retry_at      TIMESTAMP,

  -- Timestamps
  occurred_at        TIMESTAMP     NOT NULL,   -- quando f27 disparou (do timestamp_dados)
  sent_at            TIMESTAMP,                -- quando o POST 201 voltou
  completed_at       TIMESTAMP,                -- quando callback chegou

  created_at         TIMESTAMP     NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMP     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_webhook_events_status_retry
  ON webhook_events_nexon(status, next_retry_at)
  WHERE status IN ('pending', 'failed');

CREATE INDEX idx_webhook_events_equipamento_occurred
  ON webhook_events_nexon(equipamento_id, occurred_at DESC);

CREATE INDEX idx_webhook_events_complaint
  ON webhook_events_nexon(complaint_id)
  WHERE complaint_id IS NOT NULL;
```

**Justificativa de cada coluna**:
- `event_id` como PK garante idempotência total — mesmo evento publicado 2x no MQTT (round-robin republish, retry de buffer SD) gera UPSERT, não duplicata
- `trigger_fields` guarda o snapshot exato que disparou (auditoria)
- `request_payload` + `response_payload` + `callback_payload` separados permitem reconstruir conversa inteira em caso de bug
- `status` segue os enum-like do contrato (alinhado a Aupus Chat: `RECEIVED`/`IN_PROGRESS`/etc, traduzidos pra lowercase)
- índice parcial em `(status, next_retry_at)` torna o varredor de retry barato (não scan full)

---

## 5. Plano de implementação em fases

### Fase 1 — Schema + config (estimativa: 30 min)

1. Atualizar `api-shared/prisma/schema.prisma` com o model `webhook_events_nexon` (ver §4)
2. Gerar SQL surgical via `prisma migrate diff --script` (DEPLOY.md §5.2)
3. Revisar o `.sql` gerado, filtrar DROPs (cuidado com `iot_*`)
4. Backup defensivo: `pg_dump --schema-only`
5. Aplicar em transação: `psql ... -v ON_ERROR_STOP=on --single-transaction -f safe.sql`
6. Adicionar variáveis ao `.env` do `aupus-nexon-api` (§7)
7. Bump `api-shared` (`v0.3.0 → v0.4.0`), push tag, atualizar `package.json` do `aupus-nexon-api`

### Fase 2 — Detecção do evento (estimativa: 2-3h)

> ⚠️ **Revisão importante (pós-análise topológica, 2026-06-01):** o pseudocódigo abaixo é o **esqueleto mínimo** ("qualquer borda 0→1 em `dados['27']` dispara"). Ele **não basta sozinho** — `f27=1` significa "sem tensão neste ponto", não "falta da concessionária". Antes de virar reclamação, a detecção precisa passar pelo classificador de causa descrito em **[§12 — Discriminação de causa e modelo de confiança](#12-discriminação-de-causa-e-modelo-de-confiança)** (cenários, sinais e roteamento: confiança alta → automático; demais → validação de operador).

**Arquivo novo**: `aupus-nexon-api/src/modules/falta-energia/falta-energia-detector.service.ts`

Responsabilidades:
- Hook no pipeline de ingestão MQTT (`@OnEvent('mqtt.payload.gravado')` ou injetar diretamente no `MqttIngestionService` após o `equipamentos_dados.create`)
- Para cada payload novo: comparar `dados['27']` atual vs o **último gravado** do mesmo equipamento (query `equipamentos_dados ORDER BY timestamp_dados DESC LIMIT 2`)
- Detectar **transição 0→1** em qualquer um dos f27a/f27b/f27c
- Cooldown: não disparar de novo nos próximos N minutos (default 5 min) por equipamento
- Quando dispara: emite `EventEmitter.emit('falta_energia.detectada', { equipamentoId, componenteId, triggerFields, occurredAt })`

Pseudocódigo:
```typescript
@OnEvent('mqtt.equipamento.dados.gravado')
async detectarFaltaEnergia({ equipamentoId, dados, timestamp }: Payload) {
  const grupo27 = dados?.['27'];
  if (!grupo27) return; // não é relé com função 27

  const algumDisparado = !!(grupo27.f27a || grupo27.f27b || grupo27.f27c);
  if (!algumDisparado) return; // ninguém disparado, nada a fazer

  // Buscar penúltima leitura pra detectar EDGE
  const anterior = await this.prisma.equipamentos_dados.findFirst({
    where: { equipamento_id: equipamentoId },
    orderBy: { timestamp_dados: 'desc' },
    skip: 1, take: 1,
  });
  const grupo27Anterior = anterior?.dados?.['27'] ?? { f27a: 0, f27b: 0, f27c: 0 };
  const eraTudoZero = !grupo27Anterior.f27a && !grupo27Anterior.f27b && !grupo27Anterior.f27c;
  if (!eraTudoZero) return; // já estava disparado, NÃO é novo evento

  // Cooldown: ignora se já tem evento aberto < 5min atrás
  const recente = await this.prisma.webhook_events_nexon.findFirst({
    where: {
      equipamento_id: equipamentoId,
      tipo_evento: 'falta_energia',
      occurred_at: { gte: new Date(Date.now() - 5 * 60 * 1000) },
    },
  });
  if (recente) {
    this.logger.warn(`Cooldown: ignorando f27 do equipamento ${equipamentoId}`);
    return;
  }

  this.eventEmitter.emit('falta_energia.detectada', {
    equipamentoId, triggerFields: grupo27, occurredAt: timestamp,
  });
}
```

### Fase 3 — Disparo do webhook + retry (estimativa: 3-4h)

**Arquivo novo**: `aupus-nexon-api/src/modules/falta-energia/falta-energia-webhook.service.ts`

```typescript
@OnEvent('falta_energia.detectada', { async: true })
async enviarFaltaEnergia(evt: DetectedEvent) {
  // 1. Buscar dados do equipamento (query §2.3)
  const dados = await this.prisma.$queryRaw`...`;
  if (!dados) { this.logger.error('Equipamento sem dados completos'); return; }

  // 2. Gerar eventId determinístico
  const ts = evt.occurredAt.toISOString().replace(/[-:.]/g, '').replace(/Z$/, 'Z');
  const eventId = `nexon-${evt.equipamentoId}-${ts}`;

  // 3. Montar payload conforme contrato (INTEGRACAO_NEXON_EQUATORIAL.md §2)
  const payload = {
    eventId,
    uc: dados.numero_uc,
    endereco: { logradouro: dados.logradouro, numero: dados.numero ?? 'S/N',
                complemento: dados.complemento, bairro: dados.bairro,
                cidade: dados.cidade, uf: dados.uf, cep: dados.cep },
    cliente: { nome: dados.cliente_nome, cpfCnpj: dados.cliente_cpf_cnpj,
               telefone: dados.cliente_telefone },
    ocorrencia: { tipo: 'falta_energia', inicio: evt.occurredAt.toISOString(),
                  descricao: `Função 27 disparada nas fases: ${formatFases(evt.triggerFields)}` },
    callbackUrl: `${process.env.PUBLIC_API_URL}/webhook/equatorial-callback/${eventId}`,
  };

  // 4. UPSERT em webhook_events_nexon (status=pending)
  await this.prisma.webhook_events_nexon.upsert({
    where: { event_id: eventId },
    create: { event_id: eventId, equipamento_id: evt.equipamentoId,
              componente_id: evt.componenteId, trigger_fields: evt.triggerFields,
              request_payload: payload, occurred_at: evt.occurredAt,
              status: 'pending' },
    update: {}, // idempotente — não sobrescreve se já existe
  });

  // 5. Tentar POST com retry
  await this.sendWithRetry(eventId, payload);
}

async sendWithRetry(eventId: string, payload: any, maxAttempts = 5) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const resp = await firstValueFrom(
        this.http.post(`${env.WEBHOOK_AUPUS_CHAT_URL}/api/v1/webhook/nexon/falta-energia`,
                       payload,
                       { headers: { 'x-api-key': env.WEBHOOK_AUPUS_CHAT_KEY },
                         timeout: 10_000 }));
      await this.prisma.webhook_events_nexon.update({
        where: { event_id: eventId },
        data: { status: 'sent', complaint_id: resp.data.complaintId,
                response_payload: resp.data, sent_at: new Date(),
                send_attempts: attempt },
      });
      return;
    } catch (err) {
      if (attempt === maxAttempts) {
        await this.prisma.webhook_events_nexon.update({
          where: { event_id: eventId },
          data: { status: 'failed', error_message: err.message,
                  send_attempts: attempt, last_attempt_at: new Date() },
        });
        throw err;
      }
      // backoff exponencial: 2s, 4s, 8s, 16s
      await sleep(2000 * Math.pow(2, attempt - 1));
    }
  }
}
```

**Detalhes importantes**:
- HTTP client: importar `HttpModule` em `falta-energia.module.ts` (configurar timeout default 10s)
- `eventId` formato `nexon-{equipamentoId}-{tsISObasic}` — determinístico, idempotente
- Cron job pra varrer `status='pending' AND next_retry_at < NOW()` (fora do escopo da Fase 3 — Fase 6 abaixo)

### Fase 4 — Endpoint pra receber callback (estimativa: 1h)

**Arquivo novo**: `aupus-nexon-api/src/modules/falta-energia/equatorial-callback.controller.ts`

```typescript
@Controller('webhook/equatorial-callback')
export class EquatorialCallbackController {
  @Post(':eventId')
  @Public() // sem auth — protegido pelo eventId no path (suficiente p/ MVP)
  async receberCallback(
    @Param('eventId') eventId: string,
    @Body() body: CallbackPayloadDto,
  ) {
    // Validar que eventId existe
    const evt = await this.prisma.webhook_events_nexon.findUnique({ where: { event_id: eventId } });
    if (!evt) throw new NotFoundException('event_id desconhecido');

    // Validar que eventId no body bate com path (defesa em profundidade)
    if (body.eventId !== eventId) throw new BadRequestException('eventId mismatch');

    const novoStatus = body.status === 'completed' ? 'completed'
                     : body.status === 'failed'    ? 'failed'
                     : body.status === 'needs_human' ? 'needs_human'
                     : evt.status;

    await this.prisma.webhook_events_nexon.update({
      where: { event_id: eventId },
      data: {
        status: novoStatus,
        protocolo_equatorial: body.protocoloEquatorial ?? null,
        callback_payload: body,
        error_message: body.errorMessage ?? null,
        completed_at: ['completed', 'failed'].includes(novoStatus) ? new Date() : null,
      },
    });

    return { ok: true };
  }
}
```

**Segurança**: o `eventId` no path serve como "token" — vide §6.4. Se preocupação com replay/leak, evolução é adicionar `callback_secret` por evento.

### Fase 5 — Cadastrar configurações (estimativa: 15 min)

Cadastrar via `.env` (vide §7) **ou** tabela `configuracoes` (preferível, hot-reload sem deploy):

```sql
INSERT INTO configuracoes (chave, valor, descricao) VALUES
  ('WEBHOOK_AUPUS_CHAT_URL', 'https://wpp.aupusenergia.com.br', 'Base URL Aupus Chat'),
  ('WEBHOOK_AUPUS_CHAT_KEY', '<chave_gerada_no_admin_aupus_chat>', 'API key x-api-key'),
  ('PUBLIC_API_URL', 'https://aupus-nexon-api.aupusenergia.com.br/api/v1', 'URL pública pro callback');
```

### Fase 6 — Job de retry / timeout (estimativa: 1h, opcional pro MVP)

Cron `@Cron('*/2 * * * *')`:
- Varrer `webhook_events_nexon` onde `status='pending'` ou `'sent'` há > 10 min
- Re-tentar POST se `pending`
- Se `sent` há > 15 min sem callback → marcar `status='timeout'` + alerta

### Fase 7 — UI no AupusNexOn (opcional, estimativa: 4h)

- Página `/integracoes/equatorial` lista `webhook_events_nexon` mais recentes
- Filtros por status, equipamento, data
- Botão "Reenviar" pra `failed`
- Link pro card do Aupus Chat (via `conversaId`)

---

## 6. Detalhes técnicos críticos

### 6.1 Onde "amarrar" no pipeline MQTT existente

**Opção A — EventEmitter** (recomendado): `MqttIngestionService` emite `mqtt.equipamento.dados.gravado` após `equipamentos_dados.create()`. `FaltaEnergiaDetectorService` consome via `@OnEvent`. Acoplamento baixo, fácil de testar isolado.

**Opção B — injeção direta**: chamar `faltaEnergiaDetector.processar(...)` no fim do método de ingestão. Mais simples, mais acoplado.

Decisão: **A** (EventEmitter), porque NestJS já tem `EventEmitterModule` ativo (mencionado pelo Agent) e fica desacoplado pra adicionar outros consumers no futuro (ex: alerta interno, dashboard tempo real).

### 6.2 Detecção de edge — onde e por quê

**Por que NÃO no firmware**:
- Exigiria reflash de cada relé Pextron em campo
- Lógica fica espalhada (cada modelo de relé teria que implementar)
- Cooldown e dedup ficam complexos sem persistência

**Por que NO backend**:
- Centralizado, fácil de evoluir (Schneider P3U30 quando vier, mesma lógica)
- Acesso ao histórico (`equipamentos_dados`) — basta query
- Cooldown via DB (simples)
- Sem deploy de firmware

### 6.3 Idempotência: por que `eventId` determinístico

O contrato pede `eventId` único e estável. Se gerássemos `uuid()` aleatório, retries do nosso lado criariam reclamações duplicadas. Solução: derivar de dados imutáveis do evento:

```
eventId = nexon-{equipamentoId}-{occurredAtISObasic}
```

Re-emitir o mesmo evento (ex: backend reiniciou, fila reprocessou MQTT) → mesmo `eventId` → Aupus Chat responde `deduped: true` (não abre 2ª reclamação).

### 6.4 Segurança do callback

Endpoint público recebendo `eventId` no path. Riscos:
- **Replay attack**: alguém posta callback fake com protocolo errado
- **Leak**: log expõe eventId

Mitigação MVP:
- `eventId` tem alta entropia (timestamp em ms + componenteId) — não é guessable em massa
- Validação extra: `body.eventId === path.eventId`
- Validação extra: `body.complaintId === evt.complaint_id` (se já tivermos um)

Mitigação futura (Fase 7+):
- Adicionar `callback_secret` (UUID v4 gerado por evento) no `callbackUrl` original
- Validar no callback que secret bate

### 6.5 O que enviar em `ocorrencia.descricao`

Útil pro atendente humano no card:
```
Função 27 (subtensão) disparada nas fases: A, B, C
Equipamento: <nome do relé> (Pextron URP6000)
Detectado às: 13:00:00 (BRT)
```

Gerado pelo backend a partir de `trigger_fields` e dados do componente.

### 6.6 O que fazer quando dados estão incompletos

| Faltando | Comportamento |
|---|---|
| `numero_uc` em `plantas` | **REJEITAR evento** (UC é mandatório no payload). Logar com nível ERROR. Atualizar `webhook_events_nexon` com `status='failed', error_message='UC não cadastrada'`. |
| `cliente.nome` ou `cliente.telefone` | **REJEITAR** — Clara pede explicitamente |
| `endereço.logradouro` | **REJEITAR** — necessário pra ponto de referência |
| `endereço.complemento` | OK (não obrigatório) |
| `cliente.cpfCnpj` | OK (informativo) |
| `endereço.cep` | OK (informativo) |

Importante: a tabela `webhook_events_nexon` registra o evento mesmo quando falha — facilita identificar cadastros incompletos pra arrumar.

---

## 7. Variáveis de ambiente

**Status (2026-05-29)**: ✅ **5 vars já configuradas** em `/var/www/service-nexon/aupus-nexon-api/.env` (gitignored, `chmod 600`, vide DEPLOY.md §8.2). Não foi necessário `pm2 reload` — ainda não há código consumindo (Fase 3 pendente).

Vars adicionadas (valores no `.env` em produção — não duplicar aqui):

```bash
WEBHOOK_AUPUS_CHAT_URL=<URL base do Aupus Chat>
WEBHOOK_AUPUS_CHAT_KEY=<API key — gerada no admin do Aupus Chat>
WEBHOOK_AUPUS_CHAT_TIMEOUT_MS=10000
PUBLIC_API_URL=<URL base pública do nexon-api pra callback>
FALTA_ENERGIA_COOLDOWN_MIN=5
```

**Quando a Fase 3 for implementada**, o dev:
1. Confirma que as vars estão lá: `grep '^WEBHOOK_AUPUS\|^PUBLIC_API_URL\|^FALTA_ENERGIA' /var/www/service-nexon/aupus-nexon-api/.env`
2. Após implementar o `FaltaEnergiaWebhookService`, executa: `pm2 reload aupus-nexon-api --update-env`

### Segurança operacional

- **NÃO logar `WEBHOOK_AUPUS_CHAT_KEY`** em nenhum lugar (logs, Sentry, telemetria). No service, redact: `headers: { 'x-api-key': '***' }` antes de qualquer `console.log`.
- **Rotação periódica recomendada** (3-6 meses) ou se houver suspeita de leak. Gerar nova chave no admin do Aupus Chat → atualizar `.env` → `pm2 reload`.
- A chave atual apareceu em transcript de sessão Claude Code (`/root/.claude/projects/...`) durante a configuração. Considerar rotação preventiva pós-implementação.

---

## 8. Validação e testes

### 8.1 Teste unitário do detector de edge

```typescript
describe('FaltaEnergiaDetectorService', () => {
  it('emite evento quando f27a vai de 0 para 1', async () => { ... });
  it('NÃO emite quando f27 já estava 1 (não é novo evento)', async () => { ... });
  it('respeita cooldown de 5min', async () => { ... });
  it('ignora payloads sem grupo "27"', async () => { ... });
});
```

### 8.2 Teste e2e do disparo do webhook (com mock do Aupus Chat)

Use `nock` ou `MSW` pra mockar `wpp.aupusenergia.com.br`. Cenários:
- 201 com `complaintId` → estado vira `sent`
- 403 (key inválida) → estado `failed` + retry esgota → mensagem correta
- timeout → retry com backoff
- Callback chega → estado vira `completed`

### 8.3 Teste manual ponta-a-ponta (staging primeiro!)

1. **Setup**: TON com Pextron URP6000 num barramento de bancada, com fonte CA controlável
2. **Cortar a tensão** (simular blackout) → f27a/b/c vão pra 1
3. Verificar nos logs:
   ```bash
   pm2 logs aupus-nexon-api --lines 50 --nostream | grep -i "falta_energia\|webhook"
   ```
4. Verificar `webhook_events_nexon`:
   ```sql
   SELECT event_id, status, sent_at, complaint_id
   FROM webhook_events_nexon
   ORDER BY created_at DESC LIMIT 5;
   ```
5. Acompanhar conversa no Aupus Chat (painel atendente) — deve aparecer "Falando com Clara"
6. Aguardar ~2-5min — verificar `protocolo_equatorial` populado
7. **Voltar tensão** (f27 → 0) — confirmar que não há novo evento espúrio

### 8.4 Teste de idempotência

Disparar mesmo evento 2x (ex: forçar reprocessamento do payload MQTT):
```sql
SELECT COUNT(*) FROM webhook_events_nexon WHERE event_id LIKE 'nexon-XXX-2026%';
-- Esperado: 1 (não duplica)
```

E confirmar no log do Aupus Chat: deve retornar `deduped: true` no 2º POST.

---

## 9. Operação e monitoramento

### 9.1 Queries úteis pós-deploy

**Eventos não enviados (precisa atenção)**:
```sql
SELECT event_id, equipamento_id, status, error_message, send_attempts, created_at
FROM webhook_events_nexon
WHERE status IN ('pending', 'failed')
ORDER BY created_at DESC;
```

**Taxa de sucesso na última hora**:
```sql
SELECT status, COUNT(*)
FROM webhook_events_nexon
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY status;
```

**Tempo médio até completar (Clara responder)**:
```sql
SELECT AVG(completed_at - sent_at)
FROM webhook_events_nexon
WHERE status = 'completed' AND completed_at IS NOT NULL;
```

**Equipamentos com mais eventos (rede precária / cadastro errado?)**:
```sql
SELECT equipamento_id, COUNT(*) AS total_eventos
FROM webhook_events_nexon
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY 1 HAVING COUNT(*) > 5
ORDER BY 2 DESC;
```

### 9.2 Alertas operacionais (Fase 7 opcional)

- Sentry: capturar exceções no `sendWithRetry` após N tentativas
- Slack/email: avisar quando `failed` persiste > 1h
- Métrica Prometheus: `webhook_events_nexon_total{status="..."}`

---

## 10. Riscos e dependências

| Risco | Mitigação |
|---|---|
| Tensão oscilando em torno do setpoint dispara/recupera rapidamente | Cooldown de 5min (§5 Fase 2) + edge detection (só dispara em 0→1) |
| Aupus Chat fora do ar quando evento ocorre | Retry com backoff (§5 Fase 3); fica em `pending` até voltar |
| Clara da Equatorial muda fluxo conversacional | Já tratado pelo Aupus Chat (`status=needs_human`); nexon recebe no callback |
| `eventId` colide entre eventos diferentes | Praticamente impossível com `{equipamento_id}-{ts_ms}` — ts em ms + ULID equipamento |
| Cadastro incompleto (sem telefone, sem UC) | §6.6 — rejeita evento com `status=failed` + log claro pra arrumar cadastro |
| Backend reiniciar no meio do envio | UPSERT em outbox antes do POST; Fase 6 cron pega `pending` órfão |
| Schneider P3U30 vier no futuro com bits diferentes (`406003.0`) | Detector já é por `dados['27']` — basta cadastrar mapeamento bit-level no catálogo (já parcialmente investigado em sessões anteriores) |
| API key vazada | Tem que rotacionar no Aupus Chat + atualizar `WEBHOOK_AUPUS_CHAT_KEY` |
| Callback chega fora de ordem (ex: tipo `needs_human` depois de `completed`) | Validar no controller que não regride status |

### Dependências externas
- Aupus Chat operacional em `wpp.aupusenergia.com.br` (responsável: time Aupus Chat)
- API key gerada no admin do Aupus Chat
- TON com Pextron URP6000 instalada e publicando f27 corretamente
- Bot Clara da Equatorial não muda interface drasticamente

---

## 11. Resultado da implementação

_A preencher após executar._

| Fase | Status | Quando | Observações |
|---|---|---|---|
| 1 — Schema + config | pendente | | |
| 2 — Detector de edge | pendente | | |
| 3 — Webhook outbound + retry | pendente | | |
| 4 — Endpoint de callback | pendente | | |
| 5 — Configurações DB | pendente | | |
| 6 — Cron de retry/timeout (opcional MVP) | pendente | | |
| 7 — UI (opcional) | pendente | | |

**Métricas pós-deploy** (preencher após primeira semana em produção):

| Métrica | Valor |
|---|---|
| Total de eventos detectados | |
| Taxa de sucesso (`completed` / total) | |
| Tempo médio até protocolo Equatorial | |
| Eventos `failed` (e motivos top) | |
| Eventos `needs_human` (% que precisou de atendente) | |

---

## 12. Discriminação de causa e modelo de confiança

**Revisão**: 2026-06-01 — refinamento após análise topológica/operacional. Esta seção **qualifica e substitui na prática** a regra ingênua da Fase 2 ("qualquer borda 0→1 em f27 dispara reclamação"). Status: **planejado, não implementado**.

### 12.1 O problema: `f27=1` ≠ "falta da concessionária"

A função 27 (subtensão) só afirma **"não há tensão neste ponto de medição"**. A causa pode ser externa (concessionária) **ou** interna (disjuntor geral aberto, falta/curto, manutenção, alguém desligou). Reclamar à Equatorial por causa interna gera **reclamação falsa** — e volume de reclamações falsas é o tipo de coisa que faz a concessionária **bloquear o canal**.

| Causa real | f27 dispara? | É problema da Equatorial? |
|---|---|---|
| Concessionária caiu | ✅ | ✅ **Sim** — reportável |
| Disjuntor geral do cliente aberto | ✅ | ❌ Não |
| Falta interna → proteção abriu o DJ | ✅ | ❌ Não |
| Religador/fusível a montante do relé | ✅ | ❌ Não |

### 12.2 Restrição operacional: por que NÃO depender do "ponto de entrega"

Cenário de instalação real: o cliente **já tem o quadro pronto**; normalmente só instalamos a TON. Exigir um relé **a montante do disjuntor geral** implicaria **desenergizar a rede** — alta complexidade e risco, fora do nosso modelo de serviço.

**Decisão arquitetural:** _não_ depender de instalação no ponto de entrega. A TON permanece onde já vai (medição do **geral do quadro** do cliente). Dessa posição o f27 já captura falta da concessionária **e** abertura do disjuntor geral; a ambiguidade residual fica restrita a esses dois. A discriminação passa a ser feita por **software + sinais já disponíveis**, com o **contato auxiliar do disjuntor** como reforço **opcional** (ideal onde existir, nunca obrigatório).

### 12.3 Inventário de sinais

| Sinal | Origem | O que indica |
|---|---|---|
| `f27a/b/c` | relé (coil) | subtensão por fase (gatilho) |
| `va/vb/vc` | relé (AI) | **magnitude** real da tensão (zero? afundamento? só 1 fase?) |
| `f50/f51` | relé (coil) | sobrecorrente → **causa interna** (curto/falta) |
| `f59`, `f46`, `f47` | relé (coil) | sobretensão, desequilíbrio, falta de fase |
| **`dj_geral_fechado`** | **contato aux → DI da TON (NOVO, ideal)** | disjuntor geral aberto vs fechado |
| **Correlação de frota** | backend | vários clientes da mesma região caindo juntos |
| **Liveness / LWT MQTT** | broker | a TON parou de publicar (apagou junto) |
| Janela de manutenção Eqtl | externo/cadastro | desligamento programado |
| Restabelecimento | relé | tensão voltou (fecha evento) |

### 12.4 Catálogo de situações

Legenda: **OC** = sobrecorrente (f50/f51) antes do f27; **AUX** = contato do DJ (fechado/aberto/ausente); **FROTA** = vizinhos da mesma região caíram na janela.

| # | Cenário | Assinatura | Confiança | Ação |
|---|---|---|---|---|
| **S1** | Falta limpa c/ AUX | V=0 (3φ) · f27 · OC=não · **AUX=fechado** | 🟢 Alta | 🚀 Auto → Equatorial |
| **S2** | Falta confirmada por frota | V=0 · f27 · **FROTA=sim** (≥K na região/janela) | 🟢 Alta | 🚀 Auto → Equatorial |
| **S3** | Provável falta, isolado, sem AUX | V=0 · f27 · OC=não · AUX=ausente · frota esparsa | 🟡 Média | 👤 Operador valida |
| **S4** | Disjuntor geral aberto | V=0 · f27 · **AUX=aberto** · FROTA=não | 🔴 Baixa | 🚫 Suprime (interno) + alerta |
| **S5** | Falta interna / curto | **OC=sim** logo antes do f27 | 🔴 Baixa | 🚫 Suprime (interno) |
| **S6** | Perda monofásica | só 1φ=0 · f27 em 1 fase · demais ok | 🟡 Média | 👤 Operador (pode ser fase do alimentador) |
| **S7** | Afundamento / brownout | f27 setado mas V≠0 (ex.: 70% nominal) | 🟡 Média / ℹ️ | 👤 Operador se profundo/persistente |
| **S8** | Oscilação (flapping) | f27 alternando em torno do setpoint | — | ⏳ Debounce/cooldown — segura |
| **S9** | TON apagou, isolado | LWT · sem corroboração | 🔴 Baixa | 👤 Operador (baixa prio — provável conectividade) |
| **S10** | TON apagou, corroborado | vários devices dark juntos na região | 🟡/🟢 | 👤 Operador → ou auto se muito forte |
| **S11** | Manutenção programada | evento dentro de janela Eqtl conhecida | — | 🚫 Suprime auto / operador |
| **S12** | Restabelecimento | V volta · f27 limpa | — | ✅ Fecha evento, sem nova reclamação |
| **S13** | Religador (recloser) | V cai e volta em segundos, repetido | — | ⏳ Agrupa como transitório, não pulsa |

### 12.5 Modelo de confiança → roteamento

```
                    ┌──────────────────────────────┐
   evento f27/V=0 → │  CLASSIFICADOR DE CAUSA       │
                    └──────────────┬───────────────┘
                                   ▼
        ┌──────────────┬───────────────────────┬──────────────┐
     🟢 ALTA        🟡 MÉDIA                🔴 BAIXA       ⏳ TRANSITÓRIO
   (S1,S2,S10+)   (S3,S6,S7,S9,S10)       (S4,S5)        (S8,S13)
        │              │                       │               │
        ▼              ▼                       ▼               ▼
   🚀 Direto      👤 Fila de              🚫 Suprime      segura na
    Equatorial     validação do            + log/alerta    janela e
   (webhook)       operador → só            interno         reavalia
                   dispara se aprovar
```

**Regra de roteamento:**
- **Confiança alta** → dispara o webhook **automaticamente** (fluxo das Fases 3-4, sem intervenção).
- **Confiança não-alta** → **não** dispara. Grava o evento com `status='aguardando_operador'`, joga numa fila/UI com **todas as evidências** (tensões, flags de proteção, AUX, vizinhos correlacionados) e só vira reclamação quando o **operador confirma**. Se rejeitar → `status='descartado'` com motivo (alimenta tuning futuro).
- **Baixa** → suprime como interno (`status='suprimido_interno'`), apenas log/alerta interno.
- **Transitório** → absorvido pela janela de debounce/cooldown (não vira evento).

### 12.6 Requisitos novos no sistema (para suportar o classificador)

**Cadastro / catálogo:**
- 🆕 ponto `dj_geral_fechado` — mapear o **contato auxiliar** do disjuntor numa entrada digital da TON (onde houver).
- 🆕 flag no `iot_componente`: este device é a **referência de medição** da UC.
- 🆕 agrupamento para correlação: `alimentador_id` (ou aproximação por CEP/bairro/geolocalização) — habilita S2/S10.

**Schema `webhook_events_nexon` (estende a Fase 1 / §4):**
- `confidence` (`alta` | `media` | `baixa`) + `confidence_reason` (JSONB com os sinais que pesaram).
- novos valores de `status`: `aguardando_operador`, `descartado`, `suprimido_interno`.
- campos de decisão do operador: `operador_id`, `decidido_em`, `motivo_decisao`.

**Config (tunável sem deploy — tabela `configuracoes` ou `.env`):**
- `K` (mín. de vizinhos para corroborar), `T` (janela de correlação em segundos), `debounce`, limiares de afundamento (% da nominal) e duração mínima.

### 12.7 Pendência em aberto (decide o escopo do MVP do classificador)

A correlação de frota (S2/S10) depende de **agrupar clientes por trecho da rede da Equatorial**. Em aberto: conseguimos `alimentador_id`/trafo, ou começamos aproximando por **bairro/CEP/geolocalização**? 
- Se houver agrupamento confiável → correlação entra já no MVP como sinal primário.
- Se não → MVP pesa em **AUX + supressão por OC + janela de corroboração**, e a correlação entra numa fase posterior conforme a frota adensa.

---

## 13. Detecção por tipo de dispositivo (matriz de capacidade)

**Revisão**: 2026-06-01. Nem todo dispositivo tem função 27. Esta seção mapeia **como detectar falta de energia com cada tipo** de equipamento do catálogo e a **qualidade** de cada caminho. O classificador de causa (§12) roda por cima: o *modo de detecção* define a **confiança de base** do evento. Status: **planejado, não implementado**.

### 13.1 Taxonomia dos modos de detecção

| Modo | Como detecta | Qualidade | Quem usa |
|---|---|---|---|
| **A — Flag dedicado** | bit de proteção (f27) memorizado no device | 🟢 Alta — evento limpo, instantâneo | Relé de proteção |
| **B — Tensão zerada** | backend infere por limiar: `Va/Vb/Vc ≈ 0` por > N s | 🟡 Média — sem setpoint no device, exige debounce | Medidor c/ fonte auxiliar; relé (fallback) |
| **C — Silêncio / LWT** | device alimentado pelo circuito **morre junto** → detecta pela ausência de publicação (Last Will) | 🟠 Baixa/ambígua — confunde com queda de WiFi/internet | Medidor/TON sem fonte aux |
| **D — Corroboração por inversor** | anti-ilhamento: inversor desliga e zera o AC ao perder a rede | 🔴 Fraca — só diurno, sensível a nuvem | Inversor (só reforço) |
| **E — Inviável** | sem grandeza instantânea de tensão/potência | ❌ — não serve p/ disparo | Gateway A-966 |

### 13.2 Matriz por modelo (catálogo atual)

| Modelo | Tipo | Sinais úteis disponíveis | Modo(s) | Dispara sozinho? |
|---|---|---|---|---|
| Pextron URP6000 | relé | `f27a/b/c`, `Va/Vb/Vc`, `f50/f51/f59` | A (+B fallback) | ✅ Sim (melhor caso) |
| Schneider P3U30 | relé | hoje só `V/I/freq/P` — `f27` **não mapeado** | B até mapear f27 | ⚠️ só Modo B hoje |
| CHINT PD666 | medidor | `Va/Vb/Vc`, `Ia/Ib/Ic`, `Pt/Qt/St` | B ou C | ⚠️ depende da fonte de alimentação |
| IMS M160 | medidor | `Va/Vb/Vc`, `Ia/Ib/Ic`, `Pt/Qt/St` | B ou C | ⚠️ depende da fonte de alimentação |
| Sungrow / Goodwe / Huawei / WEG | inversor | `work_state`, AC `V/I/P`, `freq` | D | ❌ só corroboração diurna |
| A966-SSU | gateway | só energia acumulada + `sts` | E | ❌ não |

### 13.3 Medidor de energia (M160 / PD666) — o detalhe que mais engana

O medidor **não tem flag de proteção** (`bi: []` no contrato `medidor_energia`; `bi_map: {}` nos modelos). Logo, detecção = **inferência sobre a tensão** (`Va/Vb/Vc`) feita no backend, com **limiar + debounce** (o medidor não tem setpoint como o relé).

A pegadinha decisiva é **de onde o medidor é alimentado**:

- **Fonte auxiliar / independente** → ele sobrevive à queda e **reporta `V≈0`** → **Modo B** (utilizável).
- **Alimentado pelo próprio circuito medido** (comum em medidor simples) → na falta ele **desliga junto e não consegue publicar `V=0`**; a única evidência é o **silêncio** (LWT) → **Modo C** (ambíguo com perda de WiFi/internet).

→ Implicação: para medidor, precisamos saber no cadastro **qual é a fonte de alimentação**, senão não dá pra saber se esperamos "leitura `V=0`" ou "silêncio". E o Modo C exige **LWT no firmware** + rastreio de *last-seen* no backend.

### 13.4 Inversor solar — por que é só reforço

Inversores têm **anti-ilhamento**: ao perder a rede, desconectam em ~2 s (norma) → `work_state` muda, `power.active_total → 0`, AC voltage zera. **Mas:**

- Inversor **só gera de dia** → à noite `V/P=0` é o **normal**, não falta. Detecção noturna por inversor = impossível.
- Nuvem / baixa irradiância derruba a potência → falso "parou".

→ Inversor **nunca** dispara sozinho. Serve como **corroboração diurna**: se um inversor que estava gerando cai junto com um medidor/relé da mesma planta, reforça a confiança (entra como voto em S2/S10 do §12.4), sempre com guarda de "é dia?".

### 13.5 Gateway A-966 — inviável para isto

O A966-SSU só publica **energia acumulada** (`phf/phr/q...`) + um `sts` (enum), **sem tensão/corrente/potência instantânea** (`ai_blocks: []`). Consistente com o histórico de tratá-lo como dispositivo de telemetria limitada (visual). → **Não serve** para detectar falta — no máximo silêncio/LWT, com toda a ambiguidade do Modo C.

### 13.6 Requisitos adicionais (além dos do §12.6)

- 🆕 **cadastro**: fonte de alimentação do device/TON (`circuito_medido` | `auxiliar_independente`) — decide Modo B vs C.
- 🆕 **firmware**: Last Will (LWT) + birth message; backend com **rastreio de last-seen / offline** por device (habilita Modo C).
- 🆕 **config**: limiar de tensão (% nominal) e debounce **por tipo** de dispositivo (medidor não tem setpoint).
- 🆕 **detector**: tratar `work_state`/AC do inversor **apenas como voto de corroboração**, com guarda de horário/irradiância ("é dia?").

### 13.7 Encaixe no modelo de confiança (§12.5)

O **modo de detecção vira a confiança de base**, depois ajustada pelos sinais do §12 (AUX, OC, frota):

```
Modo A (relé f27) + AUX fechado / sem OC ........ 🟢 Alta  → automático
Modo B (V=0 medidor c/ fonte aux) + frota ....... 🟢 Alta  → automático
Modo B isolado, sem AUX ......................... 🟡 Média → operador
Modo C (silêncio) isolado ....................... 🟠 Baixa → operador (provável conectividade)
Modo C corroborado por frota .................... 🟡 Média → operador
Modo D (inversor) sozinho ....................... 🔴 nunca dispara (só soma voto)
Modo E (A966) ................................... ❌ não participa
```

**Regra de ouro:** quanto mais "inferido" o modo, mais a decisão depende de **corroboração** (frota / AUX) antes de virar reclamação automática.

---

## Apêndice — referências cruzadas

- Contrato webhook: `/var/www/INTEGRACAO_NEXON_EQUATORIAL.md`
- Arquitetura deploy: [DEPLOY.md](DEPLOY.md)
- Catálogo IoT (Pextron URP6000): [AupusNexOn/public/iot-device-catalog.v2.js](../AupusNexOn/public/iot-device-catalog.v2.js)
- Gerador firmware: [AupusNexOn/public/iot-firmware-generator.v2.js](../AupusNexOn/public/iot-firmware-generator.v2.js)
- MQTT pipeline: `aupus-nexon-api/src/shared/mqtt/mqtt.service.ts`
- Engine de regras (referência pra cooldown): `aupus-nexon-api/src/modules/.../regras-logs-mqtt.engine.ts`
- Docs relacionados nesta pasta:
  - [IOT-RS485-MELHORIAS.md](IOT-RS485-MELHORIAS.md)
  - [IOT-MQTT-CLIENTID-UNICO.md](IOT-MQTT-CLIENTID-UNICO.md)
  - [IOT-MQTT-DESCONEXAO-INVESTIGACAO.md](IOT-MQTT-DESCONEXAO-INVESTIGACAO.md)
