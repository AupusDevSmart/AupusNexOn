# IOT — Central OCPP 1.6-J (carregadores de VE)

> Central System OCPP 1.6-J no NexON: qualquer carregador OCPP comercial conecta e é
> gerenciado, sem depender do hardware próprio (TON).

**Este documento foi substituído (NEXON-130, 18/11/2026).** A versão atual está na raiz da
pasta Aupus:

- Contrato da API, conexão do carregador, permissões e auditoria:
  `NexON/docs/carregador/API-CARREGADOR-OCPP.md`
- Decisão de arquitetura: `NexON/docs/adr/0006-carregador-de-veiculo-eletrico-nexon-como-central-ocpp-16j.md`
- Funções do carregador Chint Wallbox, com a página do manual:
  `NexON/docs/carregador/LEVANTAMENTO-CHINT-WALLBOX.md`

## O que mudou em relação ao MVP de 28/08/2026

| Pendência do MVP | Situação |
| --- | --- |
| Segurança da conexão (aceitava qualquer `chargePointId`) | Só conecta carregador cadastrado e com chave (na URL ou HTTP Basic). |
| Vincular a estação à planta e ao equipamento | A estação é ligada a um carregador do NexON; a recarga é a mesma do condomínio. |
| Smart Charging (limite de corrente) | Corrente máxima por `SetChargingProfile`; a tela mostra quando o carregador recusa. |
| Billing por morador | Recarga OCPP entra em `carregador_sessoes`, com o valor do kWh gravado e a exportação mensal. |
| UI | `src/features/carregador-eletrico/`: estado real, leitura, limites, comandos, conexão e parâmetros. |
| OCPP 2.0.1 | Não feito: o manual do carregador comprado declara 1.6. |

As rotas `POST /ocpp/:cp/remote-start|remote-stop|reset` deixaram de existir: comando a
carregador passa por `/carregador-eletrico/:id/*`, com papel, escopo e audit log.

## Log

- **2026-08-28** — central OCPP 1.6-J, perfil Core, validada por simulador.
- **2026-11-18** — NEXON-130: ligada ao carregador do condomínio, com chave de conexão, limites,
  comandos, auditoria e tela.
