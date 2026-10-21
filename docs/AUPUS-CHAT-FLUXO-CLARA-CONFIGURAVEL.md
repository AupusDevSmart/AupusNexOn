# Aupus Chat: fluxo da Clara configurável

**Para:** time do Aupus Chat · **De:** NexON · **Data:** 21/10/2026
**Contrato de referência:** `INTEGRACAO_NEXON_EQUATORIAL.md` (v1.1)

## Resumo

Testamos hoje a reclamação automática de falta de energia (NexON → Aupus Chat → Clara). O webhook funciona: aceita a chamada em menos de 1 s e não duplica com o mesmo `eventId`. Mas a conversa com a Clara **não passou do primeiro passo** nas duas tentativas.

O motivo é de desenho. O robô segue uma **sequência fixa** de mensagens, e a Clara muda de caminho conforme o histórico do número, o horário e o que recebe. Precisamos de um fluxo **configurável e guiado pelo que a Clara pergunta**, que dê para ajustar sem deploy quando ela mudar.

## O que aconteceu nos testes

| Teste | Hora | Resultado | Causa |
|---|---|---|---|
| 1 · `01M5F02S7C0SCY3V3CZBK3YAJA` | 07:28 | Ficou em `IN_PROGRESS` indefinidamente | O "Olá" ficou com um tique só (não entregue). A Clara nunca respondeu. |
| 2 · `01M5F0W3MDK41SZFC01AXZJK91` | 07:42 | `NEEDS_HUMAN` | (a) O resumo `[CONTEXTO_RECLAMACAO]` foi **enviado à Clara**, e ela respondeu "Não encontrei nenhum conteúdo sobre esse assunto". (b) Como o número já tinha conversado com ela, a Clara **pulou as boas-vindas e a LGPD** e mandou "Por enquanto posso te atender com os serviços de Falta de Energia e Religação". O robô esperava a LGPD e parou. |

As duas reclamações usaram a **mesma conversa** (`conversaId 01KT46R96YMVBZAZ024YVHZAVR`).

## Pedido 1 — Fluxo configurável (principal)

### Como deve funcionar

Em vez de "passo 1, passo 2, passo 3…", o robô **reconhece a mensagem da Clara** e responde de acordo, em qualquer ordem:

1. Chega uma mensagem da Clara.
2. O robô compara com os **gatilhos** de todos os passos configurados.
3. Achou um passo → manda a **resposta** dele (com as variáveis da reclamação preenchidas).
4. Não achou → aplica a **regra de recuperação** (abaixo).

Assim, se a Clara pular a LGPD, mudar a ordem, repetir uma pergunta ou mandar um aviso novo, o robô continua.

### Estrutura de um passo

| Campo | Exemplo | Para quê |
|---|---|---|
| `id` | `pede_uc` | identificação no log |
| `gatilhos` | `["unidade consumidora", "numero da uc"]` | trechos ou regex que identificam a mensagem da Clara; comparar **sem acento e sem maiúsculas** |
| `resposta` | `"{uc}"` | texto ou botão a enviar, com variáveis |
| `acao` | `responder` · `ignorar` · `extrair_protocolo` · `concluir` · `falhar` · `humano` | o que fazer além de responder |
| `max_vezes` | `2` | quantas vezes o passo pode repetir antes de pedir humano (evita laço) |

Variáveis disponíveis: `{uc}`, `{referencia}` (endereço formatado), `{nome}`, `{telefone}`, `{escopo}` ("Rua toda" ou "Meu imóvel"), `{evento}`.

### Fluxo inicial (com o que já vimos da Clara)

```json
[
  { "id": "lgpd",          "gatilhos": ["voce concorda em ser atendido"],                 "resposta": "Sim, Clara! 👍" },
  { "id": "menu",          "gatilhos": ["sobre o que voce gostaria de falar", "posso te atender com os servicos"], "resposta": "Falta de Energia" },
  { "id": "nao_entendeu",  "gatilhos": ["nao encontrei nenhum conteudo"],                 "acao": "ignorar" },
  { "id": "disjuntores",   "gatilhos": ["disjuntores"],                                    "resposta": "Continuar" },
  { "id": "pede_uc",       "gatilhos": ["numero da unidade consumidora"],                  "resposta": "{uc}" },
  { "id": "pede_ref",      "gatilhos": ["ponto de referencia"],                            "resposta": "{referencia}" },
  { "id": "pede_nome",     "gatilhos": ["nome completo"],                                  "resposta": "{nome}" },
  { "id": "pede_tel",      "gatilhos": ["telefone para contato"],                          "resposta": "{telefone}" },
  { "id": "confirma",      "gatilhos": ["confere se e isso mesmo"],                        "resposta": "Sim" },
  { "id": "aviso_uc",      "gatilhos": ["sua nova unidade consumidora sera"],              "acao": "ignorar" },
  { "id": "escopo",        "gatilhos": ["rua toda ou so no seu imovel"],                   "resposta": "{escopo}" },
  { "id": "protocolo",     "gatilhos": ["protocolo gerado"], "acao": "extrair_protocolo",  "regex_protocolo": "(\\d{6,})" },
  { "id": "mais_algo",     "gatilhos": ["quer falar sobre mais alguma coisa"],             "resposta": "Não", "acao": "concluir" }
]
```

**Prioridade:** quando mais de um passo bate na mesma mensagem, vale o **primeiro da lista**. Exemplo: as boas-vindas da Clara trazem "posso te atender com os serviços" **e** a pergunta da LGPD; `lgpd` vem antes de `menu`, então o robô responde "Sim, Clara!".

Os gatilhos acima saíram das conversas reais de hoje. Os casos ainda não vistos (UC inválida, UC com ocorrência já aberta, tempo esgotado) entram quando terminarmos o roteiro de testes no fim deste documento.

### Regras globais

- **Mensagem não reconhecida:** manda **"Início"** para voltar ao menu (no máximo 2 vezes por reclamação). Se continuar sem reconhecer → `NEEDS_HUMAN`.
- **Sem resposta da Clara** por X minutos (configurável, ex.: 3): reenvia "Início" uma vez. Depois → `NEEDS_HUMAN`.
- **Duração máxima** da reclamação (ex.: 20 min) → `NEEDS_HUMAN`.
- **Mensagens em sequência:** a Clara manda várias mensagens seguidas (ex.: "Não encontrei…" + "Posso te atender…"). Aguardar uns 3 s de silêncio e avaliar todas antes de responder, para não responder duas vezes.

### Editar sem deploy

- Fluxo guardado como dado (JSON ou tabela), editável no **admin do Aupus Chat**.
- **Versionado:** cada reclamação grava a versão do fluxo usada. Dá para voltar à anterior.
- **Modo de teste:** colar uma sequência de mensagens da Clara e ver o que o robô responderia, antes de publicar.
- O passo em que a reclamação está e a última mensagem não reconhecida aparecem no painel do atendente.

## Pedido 2 — O resumo não vai para a Clara

O `[CONTEXTO_RECLAMACAO]` deve ser **nota interna** do painel (só o atendente vê), e **nunca** mensagem de WhatsApp. A **primeira** mensagem para a Clara é sempre **"Olá"**.

## Pedido 3 — Uma conversa limpa por reclamação

As duas reclamações de hoje caíram na mesma conversa e herdaram o estado da anterior. O robô deve:

- tratar cada reclamação como começo de fluxo, sem depender do que sobrou da anterior;
- começar com **"Início"** quando a última conversa com a Clara não terminou (como hoje), para sair de qualquer menu pendente;
- não processar duas reclamações ao mesmo tempo no mesmo número: **fila**, uma por vez.

## Pedido 4 — Itens da v1.1 do contrato

- **UC com 8 a 15 dígitos**, zeros à esquerda preservados (Equatorial GO usa 15: `000333067801228`).
- **`ocorrencia.escopo`**: `"rua_toda"` | `"meu_imovel"`. O NexON vai mandar `"rua_toda"`.

## Pedido 5 — Retorno para o NexON

- **Retry do callback**, com recuo (ex.: 1, 5, 15, 60 min) até o NexON responder 2xx.
- **Consulta de status por `eventId` com a mesma `x-api-key`** (hoje só por JWT de atendente). Exemplo: `GET /api/v1/webhook/nexon/falta-energia/:eventId` → `status`, `protocoloEquatorial`, `errorMessage`, `passoAtual`.
- No callback de `failed` e `needs_human`: incluir **`passoAtual`** e a **última mensagem da Clara**, para o NexON mostrar ao operador por que parou.

## Roteiro de testes (para fechar os gatilhos)

Feito manualmente na conversa, a partir do estado atual. Cada resposta da Clara vira gatilho.

| # | Enviar | Descobrir |
|---|---|---|
| 1 | "Falta de Energia" (texto) | se o nome do serviço funciona e a próxima pergunta |
| 2 | "Início" | o menu para quem já conversou |
| 3 | "4" no menu | se o número também funciona |
| 4 | UC "123" | mensagem de UC inválida |
| 5 | UC "000333067801228" | mensagem de UC **com ocorrência já aberta hoje** (protocolo 507932688) |
| 6 | "Não" na confirmação | caminho de correção |
| 7 | "Rua toda" | se a resposta muda em relação a "Meu imóvel" |
| 8 | "Não" em "mais alguma coisa?" | mensagem de encerramento |
| 9 | Ficar sem responder de 10 a 15 min | mensagem de tempo esgotado |

**Atenção:** depois do "Sim" na confirmação, a Clara registra de verdade na Equatorial.

## Status dos testes de hoje

Os dois testes podem ser fechados no painel com **"Marcar como falha"** (motivo: teste de integração). A UC já tem a reclamação real de hoje (protocolo 507932688).
