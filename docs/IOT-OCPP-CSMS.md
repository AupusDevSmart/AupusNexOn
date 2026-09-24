# IOT — CSMS OCPP 1.6-J (carregadores de VE)

> Central System OCPP 1.6-J no NexON — qualquer carregador OCPP comercial conecta e é
> gerenciado, **desacoplando do hardware custom (TON)**. Caminho "A" da análise de VE.
> Data: 2026-08-28. Relacionados: `project_iot_carregador_eletrico`.

## 1. O que é / o que foi feito (MVP — perfil Core)

CSMS = o backend central com que o carregador (Charge Point) fala via **WebSocket + OCPP 1.6-J**
(JSON). Implementado o **perfil Core** inteiro:

- **Inbound (carregador → CSMS):** `BootNotification` (Accepted+interval 240s), `Heartbeat`,
  `StatusNotification`, `Authorize`, `StartTransaction`, `StopTransaction`, `MeterValues`,
  `DataTransfer` (Rejected), Firmware/Diagnostics status.
- **Outbound (CSMS → carregador):** `RemoteStartTransaction`, `RemoteStopTransaction`,
  `Reset` (Soft/Hard), `ChangeAvailability`.
- **Authorize** casa a tag (`idTag`) contra o **whitelist de `moradores`** (`tag_uid`,
  `ativo`) — reusa o domínio do carregador de condomínio. Escopa pela planta do CP se atribuída.

## 2. Arquitetura

- `OcppService` (`modules/ocpp/ocpp.service.ts`) sobe um servidor **`ws`** em `noServer`
  anexado ao **mesmo HTTP server do Nest** via `HttpAdapterHost` (em `onApplicationBootstrap`).
  Handler de `upgrade` filtra por path `startsWith('/ocpp/')` → **coexiste** com o socket.io
  de `/ws/diagramas` (cada um trata o seu path).
- Endpoint do carregador: **`wss://aupus-nexon-api.aupusenergia.com.br/ocpp/<chargePointId>`**,
  subprotocolo `ocpp1.6`.
- Framing OCPP-J: `[2,uid,action,payload]` (CALL) · `[3,uid,payload]` (CALLRESULT) ·
  `[4,uid,code,desc,details]` (CALLERROR). CALLs de saída casam a resposta por `uid`
  (Promise com timeout 30s).
- Persistência (raw SQL, migration `db/manual-migrations/2026-08-28_ocpp.sql`):
  `ocpp_charge_points`, `ocpp_transactions` (id via `ocpp_transaction_seq`), `ocpp_meter_values`.
- **API** (`/ocpp`, owner-scoped): `GET charge-points` (+ao_vivo), `GET transactions`,
  `POST :cp/remote-start|remote-stop|reset` (admin).

## 3. Deploy — já funciona em produção

O nginx ativo (`nexon-api`) tem `location /` proxando tudo pro `:3001` **com headers de
Upgrade** (WebSocket) e `proxy_read_timeout 300s`. Então `/ocpp/` **já é roteado** — um
carregador real conecta em `wss://.../ocpp/<id>` sem mexer em infra. (Heartbeat 240s < 300s
do nginx → conexão ociosa não expira.)

## 4. Validação (simulador)

Testado end-to-end com um cliente `ws` simulando um carregador (não temos hardware ainda):
Boot→Accepted, Heartbeat, Status, **Authorize→Accepted** (tag de morador), **Start→txId=1**,
MeterValues (2500 Wh / 7200 W gravados), **Stop** (1000→8500 Wh = **7,5 kWh**, encerrada). ✅
Dados de teste limpos depois.

## 5. Roadmap (o que falta — não bloqueia)

1. **Segurança da conexão** — MVP aceita qualquer `chargePointId`. Produção: **HTTP Basic
   Auth** no upgrade (OCPP Security Profile 1/2) e/ou TLS mútuo; registrar o CP antes de aceitar.
2. **Smart Charging** (`SetChargingProfile`) — limitar corrente total por site (não estourar
   o trafo do condomínio). É o maior valor operacional; perfil Smart Charging do 1.6.
3. **Vincular CP → planta/equipamento** — hoje o CP nasce sem planta (só admin vê). Atribuir
   pra escopar por dono e escopar o whitelist de moradores.
4. **Billing** — R$/mês por morador a partir das transações (reusar o export do carregador custom).
5. **UI** — tela de estações (ao vivo), sessões, e botões remote start/stop/reset.
6. **OCPP 2.0.1** — segurança nativa, Plug&Charge (ISO 15118), Device Model — quando o mercado pedir.

## 6. Log
- **2026-08-28** — CSMS OCPP 1.6-J perfil Core implementado, deployado e validado por
  simulador. nginx já roteia `/ocpp/`. Pendências no §5.
