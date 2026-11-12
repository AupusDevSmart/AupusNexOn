# Pivô controlado pela TON (sequência local, sem depender de internet)

> **Status:** 11/11/2026 · Fases 1 (lib), 2 (firmware V1/V2) e 3 (backend) prontas · Fase 4 (tela, outro dev / NEXON-98) e 5 (bancada) em andamento.
> **Substitui:** a sequência no servidor de [IOT-PIVO-LIGAR-BOMBA-CANHAO.md](IOT-PIVO-LIGAR-BOMBA-CANHAO.md) (pulsos, Ligar/Desligar do painel, pontos em qualquer TON).
> **Reaproveita:** percentímetro local ([IOT-PIVO-PERCENTIMETRO-LAMINA.md](IOT-PIVO-PERCENTIMETRO-LAMINA.md)) e encoder ([IOT-PIVO-ENCODER-POSICAO.md](IOT-PIVO-ENCODER-POSICAO.md)).

## 1. O que muda

| Hoje | Novo |
|---|---|
| O servidor executa a sequência e espera cada BI pela internet | **A TON executa tudo**: ligar, irrigar, parar e desligar. O NexON só manda o plano e mostra o estado |
| Botão **Ligar** liga direto | **Ligar** abre o modal de planejamento. O botão de ligar direto deixa de existir |
| Paradas por voltas, ângulo e tempo checadas pelo servidor a cada 30 s | A TON confere a cada leitura do encoder |
| Pontos em qualquer TON, pulsos | Uma TON por pivô. Saídas **mantidas**, I/O padrão BO01–BO06 / BI01–BI06 |
| "Sem parar" existe | Não existe. Padrão: **1 volta** |
| Abas Simples, Ângulo, Segmentos, Agenda, Canhão | **Planejamento de irrigação** (Simples, Ângulo e Segmentos na mesma aba, com o gráfico) e **Agenda** |

## 2. I/O padrão (pré-preenchido, alterável)

| BO | Comando | BI | Status |
|---|---|---|---|
| BO01 | Ligar bombeamento | BI01 | Pressão ok |
| BO02 | Válvula ON/OFF (opcional) | BI02 | Tensão ok |
| BO03 | Girar direita | BI03 | Girando direita |
| BO04 | Girar esquerda | BI04 | Girando esquerda |
| BO05 | Percentímetro | BI05 | Segurança (desalinhado) |
| BO06 | Ligar canhão | BI06 | Canhão ligado |

- **Polaridade configurável por BI.** O padrão é ativo em alto (1 = condição presente). BI05 em 1 = **desalinhado**.
- **Pontos do pivô** (cadastro): Bombeamento, Valvula, Girar_direita, Girar_esquerda, Percentimetro, Canhao / Pressao_ok, Tensao_ok, Girando_direita, Girando_esquerda, Seguranca, Canhao_ligado (migração `2026-11-11_pivo_io_padrao.sql`).
- Ao **salvar o diagrama IoT com o nó Pivô ligado a uma TON**, o NexON preenche esse mapa nas BOs e BIs livres (`ensurePivoIoPadrao` em `iot.service.ts`). Ponto que já tem BO/BI e BO/BI ocupada por outro ponto não são tocados. Dá para trocar em Configurar I/O; a polaridade é o "invertido" da BI.
- O encoder fica no RS485 **da mesma TON**. A TON calcula o ângulo com resolução, sentido e zero enviados pelo NexON.

## 3. Sequências (na TON)

**Ligar com água**

| # | Passo | Falha |
|---|---|---|
| 1 | Verifica tensão (BI02) | sem tensão → não liga |
| 2 | Liga bombeamento (BO01) e válvula (BO02, se existir) | — |
| 3 | Verifica pressão (BI01) até o tempo de pressurização | sem pressão → Desligar + Falha |
| 4 | Seleciona lado (BO03 ou BO04) | — |
| 5 | Verifica lado (BI03 ou BI04) até a confirmação de giro | não girou → Desligar + Falha |
| 6 | Ativa percentímetro (BO05, ciclo local com o %) | — |
| 7 | Ativa canhão (BO06), se pedido | — |
| 8 | Verifica canhão (BI06), se pedido | não confirmou → **segue irrigando** e registra a falha |

**Ligar sem água:** pula os passos 2, 3, 7 e 8. Percentímetro em 100 %.

**Irrigando** (checado o tempo todo, não só quando chega posição):
- Cada posição nova do encoder: confere a parada do plano (voltas percorridas, ângulo final, fim do segmento).
- Parada por tempo ou horário: o NexON converte o horário em **duração** no momento do envio. A TON conta pelo relógio interno (millis), sem precisar de hora certa nem de internet.
- **Segurança (BI05) atuou** → Desligar na hora.
- **Pressão (BI01, só com água) ou tensão (BI02) caiu** → Desligar + Falha **na hora** (tolerância 0; era 3 s, mudado em 11/11).
- **Lado (BI03/BI04) caiu** (na hora) → Desligar + Falha "parou sem comando" (código `lado_caiu`). O pivô parado com a bomba ligada encharca um ponto só.
- **Sem posição** (encoder sem leitura nova) com parada por voltas ou ângulo → depois de 5 min, Desligar + Falha "sem posição".

**Desligar**

| # | Passo |
|---|---|
| 1 | Desliga bombeamento (BO01) e válvula (BO02) |
| 2 | Verifica bombeamento (BI01 vai a 0), até o tempo de confirmação. Se não cair, registra e segue |
| 3 | Percentímetro em 0 % (BO05 desligada) |
| 4 | Desliga os lados (BO03 e BO04) e o canhão (BO06) |
| 5 | Verifica lado (BI03 e BI04 em 0). Se não cair, Falha "não parou" |

Sem água pula os passos 1 e 2.

## 4. Monitoramento (TON → NexON)

Publicado em `<base>/pivo` na mudança de estado e a cada 30 s irrigando:

| Campo | Regra |
|---|---|
| Status | **Irrigando** = BI01 · **Parado** = BI01, BI03 e BI04 em 0 · **Girando** = percentímetro ≠ 0 e ângulo mudando · **Falha** = última parada por falha |
| Sentido | BI03 = direita, BI04 = esquerda |
| Posição | ângulo do encoder (graus) e voltas percorridas no plano |
| Permissão | BI01 e BI02 |
| Alinhamento | BI05 |
| Fase | passo da sequência em curso e motivo da falha |

Eventos (início, cada passo, fim, falha) vão em `<base>/pivo/evento` e viram o histórico da irrigação no NexON.

## 5. Plano enviado pelo NexON

Um comando só, guardado na NVS da TON:

- direção, com/sem água, % (ou lâmina convertida), canhão;
- parada: **voltas** (padrão 1), **ângulo final**, **duração**;
- segmentos: até 8 faixas de ângulo, cada uma com o próprio % e canhão. A água vale para a irrigação inteira (não liga e desliga a bomba no meio).

A configuração (mapa de BI/BO, polaridades, tempos de confirmação, encoder) vai num comando separado, também guardado na NVS, e é reenviada quando muda.

## 6. Sem internet

- **Funciona sem internet:** a irrigação em curso, todas as paradas (voltas, ângulo, duração), a segurança e o Desligar.
- **O reinício por falta de broker não pode acontecer com o pivô irrigando** (hoje a TON reinicia em 10 min sem broker e as saídas caem). Vira "reinício só se seguro", como no posto.
- **Agenda:** dispara pelo NexON enquanto há internet. Sem internet a agenda não dispara, porque a TON não tem relógio próprio e perde a hora numa queda de energia. Próximo passo: relógio externo (RTC) na TON.
- **Horário de ponta:** segue pelo servidor nesta fase (mesma limitação da agenda).

## 7. Pivôs existentes

Todos são de teste, então o modelo novo **substitui** o atual:
- PIV-01 (Lab - NexON, TON4): remapear para o padrão e regravar.
- PIVO 1, 2 e 3 (Fazenda Chimarrão, TON4-PIVO1…): têm 3 BOs (direita, esquerda, Desligar) e 4 BIs no modelo antigo. Precisam ser remapeados para o padrão e regravados antes de comandar de novo.
- Os demais só têm cadastro.

## 8. Fases

| Fase | Entrega |
|---|---|
| 1 | Lib `firmware-libs/pivo_local` (máquina de estados em C++ puro) com testes no host |
| 2 | Glue nos geradores V1 e V2: I/O por papel, encoder → ângulo, comandos `pivo cfg/plano/desligar`, status/evento, NVS, reinício seguro, saídas caem no reinício |
| 3 | Backend: monta o plano e a config, publica, lê status/evento para estado e histórico, agenda e ponta disparam pelo comando novo; pontos novos e I/O padrão |
| 4 | Tela: Ligar abre o planejamento (Simples/Ângulo/Segmentos + gráfico) e Agenda; status com Irrigando/Parado/Girando/Falha, sentido, posição, permissão e alinhamento; polaridade das BIs na configuração |
| 5 | Bancada no TON4v2 do lab e remapeamento dos pivôs existentes |

## 9. Protocolo TON ↔ NexON (Fase 2, implementado)

Código: lib `firmware-libs/pivo_local/` (testes: `g++ -std=c++17 -o t test_pivo.cpp pivo_local.cpp && ./t`) e glue `firmware-libs/pivo_local/glue/pivo.cpp`.
`node tools/sync-pivo-lib.mjs` gera `public/iot-firmware-pivo.js`, que os dois geradores (V1 e V2) embutem quando há um **nó Pivô ligado à TON** no diagrama IoT. `--check` confere se a cópia está igual à fonte.

**Comandos** (texto curto para caber no LoRa; por `<base>/cmd` com envelope `cmd_id`, ou Serial):

| Comando | Quando |
|---|---|
| `pivo io <bo1..bo6> <bi1..bi6> <inv>` | Mapa por papel. BO: bomba, válvula, dir, esq, percentímetro, canhão. BI: pressão, tensão, gir. dir, gir. esq, segurança, canhão. `0` = não ligado. `inv` = 6 dígitos (1 = BI ativa em baixo). Recusa BO repetida. A TON já sai da gravação com o I/O padrão ativo (BO01–06 / BI01–06, ativo em alto); o NexON reenvia se o mapa for outro. |
| `pivo tempos <tensão> <pressurização> <giro> <canhão> <bomba> <parada> <tolerância> <sem_posição> <janela_giro> <ciclo_perc>` | Segundos. Padrão `2 120 30 30 30 60 0 300 600 60` (tolerância 0 = queda desliga na hora; firmware anterior a 11/11 aceita só 1–60, e o backend manda 1 nesse caso). |
| `pivo enc <resolução> <inv 0/1> <zero°>` | `0` = sem encoder (só parada por tempo). É também como a calibração do ângulo chega à placa (NEXON-103): sem calibração ativa o NexON manda `0`. |
| `pivo encler` | Calibração: 5 leituras Modbus seguidas do encoder, só parado. Ack `pivo_el <v1> … <v5>` ou `pivo_el_erro <n>` (falhou depois de n leituras boas); `pivo_sem_encoder` se o firmware não tem encoder no RS485. |
| `pivo ligar <id> <d/e> <água 0/1> <permil> <canhão 0/1> <v/a/t> <valor> [s <ini°>:<permil>:<canhão> …]` | `v` voltas, `a` ângulo final, `t` duração em s (o horário de parada vira duração no envio). Até 8 segmentos em ordem crescente. |
| `pivo desligar [motivo]`, `pivo perc <permil>`, `pivo canhao <0/1>`, `pivo status`, `pivo cfg` | |

io/tempos/enc ficam na NVS e só são aceitos com o pivô parado. Recusas voltam no ack (`pivo_io_incompleto`, `pivo_sem_encoder`, `pivo_ja_ligado`, `pivo_pivo_girando`, `pivo_desalinhado`…).

**Status** `<base>/pivo` (na mudança, a cada 30 s ligado e 60 s parado; ≤ 120 B para o LoRa):
`{"e":2,"p":0,"f":"","d":"D","a":1,"pm":1000,"an":123.4,"pc":95,"al":360,"sg":-1,"bi":15,"bo":95,"c":1}`
- `e` 0 parado · 1 ligando · 2 irrigando · 3 desligando. `p` passo (1 tensão, 2 pressão, 3 lado, 4 bomba off, 5 lado off).
- `f` falha da última parada: `sem_tensao`, `sem_pressao`, `nao_girou`, `seguranca`, `lado_caiu`, `sem_posicao`, `nao_parou`, `reinicio` (desligou irrigando: queda de energia ou reset).
- `pm` percentímetro em permil (−1 desligado). `an` ângulo (null sem encoder). `pc`/`al` graus percorridos/alvo (−1 sem alvo). `sg` segmento (−1 sem).
- `bi` bit0 pressão, 1 tensão, 2 gir. dir, 3 gir. esq, 4 desalinhado, 5 canhão (já com a polaridade). `bo` bit0 bomba, 1 válvula, 2 dir, 3 esq, 4 percentímetro na fase ON, 5 canhão, **6 girando**. `c` = config recebida.

**Eventos** `<base>/pivo/evento`: `{"t":"passo","x":"bomba_ligada","e":"ligando","id":"<id>"}`. `t`: ligar, passo, irrigando, segmento, aviso (`canhao_nao_ligou`, `pressao_nao_caiu`, `salto_posicao`), desligar, falha, parado.

**Segurança do firmware**
- Reinício por falta de broker, memória baixa, comando `reboot` e OTA são **recusados com o pivô ligado**.
- Num reinício as saídas caem (`RELAYS_RESTORE_ON_SW_RESET = 0`) e a TON publica a falha `reinicio`.
- **Pendente:** os comandos manuais `rN on/off/pulse` ainda atuam nas BOs do pivô durante a irrigação.

## 10. Backend (Fase 3, implementado 11/11/2026)

`aupus-nexon-api/src/modules/pivos/pivo-ton.service.ts` (testes em `pivo-ton.service.spec.ts`). A API `/pivos/:id/acionar`, `/percentimetro` e `/canhao` **não muda**: por dentro, `executar()` desvia para a TON quando ela é o alvo.

**Quando a sequência vai para a TON** (`alvo()`):
- Girar direita, girar esquerda e percentímetro ligados a BOs. Todas as BOs do pivô numa TON só.
- A TON tem o firmware novo: já publicou `<base>/pivo`, ou responde `pivo status`. O resultado fica em cache por 30 min; firmware antigo, por 10 min.
- Fora disso, a sequência antiga do servidor segue como antes.

**Ligar:**
1. Manda `pivo io/tempos/enc` só quando a configuração mudou. O mapa sai dos pontos por papel e o `invertido` da BI vira a polaridade. O encoder só vai se o tópico dele estiver debaixo do tópico da TON.
2. Manda `pivo ligar <id8> …`. O id8 são os 8 últimos caracteres da sequência, para o comando caber no LoRa (menos de 60 caracteres).
3. **Parada:**
   - Por tempo: vai em segundos.
   - Sem parada: 7 dias.
   - Voltas ou ângulo **com encoder na TON**: a própria TON confere.
   - Voltas ou ângulo **sem encoder**: tempo estimado (tempo de volta a 100 % ÷ percentímetro).
   - Segmentos ainda não vão (não cabem no LoRa).
4. Acompanha até a TON reportar **irrigando** (`e=2`), com três fontes:
   - os eventos viram passos da sequência na ficha;
   - a falha encerra com o motivo;
   - a cada 8 s pergunta `pivo status` em silêncio (o ack traz o estado), porque o satélite só manda status no POLL.

**Desligar:**
- Manda `pivo desligar` e espera `e=0`.
- Com a sequência local já parada, a TON desliga na hora todas as BOs do pivô (`pivo_ja_parado`). Isso vale também para saídas ligadas pelo fluxo antigo ou por `rN on`.

**Reinício:** desliga, espera parar e liga com o plano novo.

**Com o pivô ligado pela TON:**
- Percentímetro e canhão viram `pivo perc` e `pivo canhao`.
- O `naTon` gravado na irrigação faz a automação do servidor **não** mandar parada; quem para é a TON. O `parar_em` fica só para a ficha.
- Parada feita pela TON sozinha (programada, segurança, falha, reinício) vai para a trilha do pivô.
- `GET /pivos/:id/estado` traz `pivo.ton_local`: estado, passo, falha, ângulo, percorrido e alvo, como a TON reportou.

**MQTT:** `<base>/pivo` e `<base>/pivo/evento` são assinados e roteados antes do posto (`/pivo/evento` também termina em `/evento`).

## 11. Tempo de resposta (11/11/2026, bancada)

- O controle roda em `pivo_tick()`, chamado logo depois de ler as entradas (a cada 50 ms) e antes de qualquer envio pelo rádio. A BI muda e a BO bate no mesmo ciclo.
- **No satélite LoRa, a TON não manda eventos.** Cada pacote travava o loop por 0,5–0,8 s esperando o rádio, e enquanto transmitia ela perdia comandos (`lora_no_ack`). O backend monta os passos pelo código de passo do status e pergunta `pivo status` a cada 5 s durante a sequência.
- Continua passando pelo LoRa só o que vai e volta do NexON: o comando chegar à TON e o estado chegar à ficha (alguns segundos). A sequência em si não depende disso.

## 12. Regras a partir de 12/11/2026 (spec "Automação do pivô" + decisões do usuário)

Fonte: `arquivos/Spec NexON - Automacao do pivo (protocolo e firmware).md`. **Valem sobre as seções 3 a 5 e 9.**

| Regra | Como ficou |
|---|---|
| Segurança (BI5) | Normal = **1**. Em 0 ou sem sinal, desliga na hora (`seguranca`) |
| Condição de partida | Tensão (BI2) **e** segurança (BI5) em 1. Senão não executa (`condicao_partida`) |
| Partida com água | BO1+BO2 → pressão (BI1) em até `espera_pressao` (padrão **60 s**, senão `pressao_nao_subiu`) → sentido → **giro confirmado (BI3/BI4) segue na hora** (30 s é só o limite, `nao_girou`) → percentímetro e canhão na hora |
| Partida sem água | Sem BO1/BO2 e sem esperar pressão; 100 %; BO6 em LOW |
| Canhão | Não espera a BI6. Ligado sem BI6 por 5 s gera o alerta `falha_canhao` no status |
| Canhão por faixa | Dentro de [desliga_em, liga_em] (bruto 0–359, inclusive pelo zero) fica OFF |
| Quedas | Pressão e tensão com tolerâncias **separadas**, configuráveis (`tol_pressao_s`/`tol_tensao_s` na sequência do pivô); padrão **0 = na hora**. O giro cair também desliga (`lado_caiu`) |
| Desligar | **Tudo LOW de uma vez**, motivo gravado, confirmação no ack (`pivo_parada_executada`) |
| Parada | A TON só entende **graus** (voltas = 360 × n no NexON; ângulo final vira graus no sentido). Não existe "sem parada" nem "por tempo". Sem encoder (provisório): tempo estimado |
| Ângulo e graus | A TON usa o **valor bruto** do encoder (`pivo enc 360 0 0`); a calibração fica no NexON. Graus percorridos = deslocamento líquido em módulo (o vai-e-volta de 1° não soma) |
| Encoder sem leitura | Continua girando e marca o alerta `erro_posicao` |
| Ajuste em operação | Percentímetro e canhão (liga/desliga/faixa). Sentido, água e parada exigem Desligar e nova ordem; o NexON recusa "reiniciar com novas opções" quando quem executa é a TON |

**Comandos:** `pivo tempos <espera_pressao> <confirma_giro> <confirma_canhao> <tol_pressao> <tol_tensao> <tol_lado> <sem_posicao> <janela_giro> <ciclo_perc>` · `pivo ligar <id8> <d|e> <agua> <permil> <canhao> <g|t> <valor> [f <desliga_em> <liga_em>]` · `pivo canhao <0|1> [f <desliga_em> <liga_em>]` · `pivo desligar`.

**Status** (`<base>/pivo`, ≤ 120 B): `{"o":id,"i":entradas,"et":etapa,"p":passo,"an":bruto,"gp":graus,"al":parada,"pm":permil,"mo":motivo,"at":alertas,"d","a","bo"}`. Etapa 0 parado · 1 aguardando pressão/giro · 2 girando. Motivo: 0 nenhuma · 1 concluída · 2 comando do operador · 3 queda de pressão · 4 pressão não subiu · 5 tensão · 6 segurança · 7 reinício da slave · 8 condição de partida · 9 não girou · 10 giro caiu · 11 falha de relés. Alertas: bit0 erro de posição · bit1 falha no canhão · bit2 reinícios repetidos.

**Ainda não feito (próxima etapa):** log por ordem no NexON (linha do tempo por `id_ordem`, situação final e resumo), janela de 5 min do agendamento ("OI não iniciada"), protocolo master/slave da spec (NVS na master, quadros binários, consulta a cada 1 min configurável) — a estudar junto — (watchdog e retomada: seção 13).

## 13. Watchdog e retomada (decidido 12/11/2026)

| Item | Como ficou |
|---|---|
| Prazo do watchdog | **TON de pivô sem internet:** 30 s no loop. Uma operação longa no meio do ciclo (rádio, Modbus) pode estender **uma vez** por mais 30 s; travou além disso, reinicia. TONs com internet: 60 s, como antes. O `setup()` continua com 60 s |
| Reinício por watchdog | Saídas começam em LOW e a TON **retoma a ordem**: refaz a partida inteira (condição de partida, pressão, sentido) com o que falta (graus restantes; tempo restante no provisório sem encoder) |
| Outras causas (energia, queda de tensão, reset manual) | Não retoma. Motivo "reinício da slave"; espera nova ordem |
| Andamento | Ordem inteira na NVS ao ligar; graus percorridos a cada 10°; tempo girado a cada 60 s (provisório) |
| Reinícios seguidos (só pivô) | 3 watchdogs em 1 h: não retoma, tudo desligado, alerta "reinícios repetidos". A hora conta o tempo ligado acumulado na RTC (sobrevive a reinício por software, zera em queda de energia), sem depender de relógio |
| Reinício por falta de internet | Não se aplica: TON de pivô normalmente não tem internet configurada |

Implementação: `config.h` (só pivô sem internet) define `PIVO_WDT_S 30` e transforma toda chamada `esp_task_wdt_reset()` em `wdt_meio()`; o início do `loop()` faz a alimentação real com `(esp_task_wdt_reset)()` e libera uma nova extensão. Retomada e contagem em `glue/pivo.cpp` (`pivo_init`, `pivo_tick`, `_salvarAndamento`).

## 14. Configuração num comando só (12/11/2026)

`pivo cfg <BOs 6 díg> <BIs 6 díg> <inv 6 díg> <9 tempos> <resolução>` substitui `pivo io` + `pivo tempos` + `pivo enc` (que continuam aceitos). A TON guarda o CRC16 (Modbus) do texto dos argumentos e o devolve no ack do `pivo status` (`k<CRC>`). O NexON calcula o mesmo CRC e **só manda a configuração se for diferente** — depois de um restart da API, a 1ª partida pergunta o status (que já era feito para conferir o firmware) e, se a TON já tem a config, vai direto para o `pivo ligar`. Primeira partida: 5 viagens pelo LoRa → 2 (ou 3 se a config mudou). O antigo `pivo cfg` (imprimir na Serial) virou `pivo mostrar`.
