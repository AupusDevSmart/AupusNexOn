# Posto de Combustível na TON — Relatório do teste de bancada

**Data:** 22/09/2026 · **Placa:** TON3 V1 (MAC `28:37:2F:9D:82:B8`) · **Tópico:** `TESTE/POSTO/BANCADA` · **Executor:** dev.smart (bancada) · **Suporte:** Claude (NexON/firmware)

Horários em **Brasília (UTC−3)**. Roteiro de referência: *Teste em bancada — Posto (execução)* e `docs/POSTO-BANCADA-KIT.md`.

---

## 1. Resumo

| Etapa | O que valida | Resultado |
|---|---|---|
| T0 | Mapeamento físico das entradas da V1 | **OK** (X12-1..5 = BI1..BI5; BI6 preso nesta placa) |
| T1 | Abastecimento completo, autorização online | **OK** (autorização em 99 ms, partida em 249 ms, transação `concluido`) |
| T2 | Negativas e pré-condições (9 casos) | **OK** (9/9 negados com o motivo certo, nenhum relé mexeu) |
| T3 | Fins de abastecimento (5 casos) | **OK** (5/5, litros e tempos cravados) |
| T4 | Falhas do contator, bloqueio e rearme (5 casos) | **OK** (5/5, incluindo bloqueio que sobrevive à queda de energia) |
| T5–T8 | Manual, offline/NVS/queda/OTA, cadastro, segurança | **Não executados** (cabo USB do monitor quebrou no fim do T4) |

**Veredito parcial:** a máquina de estados, a integração TON ↔ NexON (autorização, eventos, transações) e os intertravamentos de segurança funcionam como especificado. Todas as transações e eventos do dia foram ingeridos no banco (`abastecimentos`, `bomba_eventos`).

Durante o dia foram encontrados e corrigidos **8 problemas** (seção 5), dois deles sérios: o canal analógico do nível lia o borne errado, e o estado `bloqueada` era apagado por um simples desliga-liga da TON.

---

## 2. Montagem

| Item | Como ficou |
|---|---|
| Alimentação | Fonte 5 V no J1 + USB do notebook (monitor serial) |
| Entradas (contato seco contra GND) | BI1 = aux do K1 (jumper NA do BO2), BI2 = chave Auto/Manual, BI3 = emergência (NF), BI4 = bico no suporte, BI5 = boia mínimo (NF), BI6 = boia alta (NF) |
| Saídas | BO1 liga (pulso 500 ms), BO2 permissão (mantida), BO3 solenoide, BO4 sinaleiro |
| Nível | 2 pilhas AA em série (≈3,4 V) no AN1; calibração 0 mV = 0 %, 3000 mV = 100 % |
| Lista publicada | v1790015433: PC-07 (qualquer operador), PC-08 (só matrícula 5555), PC-09 (limite 10 L); operador 1234 |
| Parâmetros de bancada | fluxo parado 10 s · tempo máximo 30 s · nível mínimo 10 % · janela da matrícula 60 s · timeout de autorização 3 s |
| Firmware final | `1.8.0-build202609221534` (gerador `20260922-posto-t12`) |

Builds gravados ao longo do dia: 10:08 → 10:15 → 11:08 → 11:31 → 13:54 → 15:34 (cada um com uma correção da seção 5).

---

## 3. Resultados por etapa

### T0 — Mapeamento das entradas (manhã)

Com um fio no GND, borne a borne: **X12-1..5 = `d1..d5`** com o mapa padrão do gerador (GP1–GP6). **X12-6 (BI6) não respondeu** e `d6` lê 1 fixo nesta TON3 (o expansor tem GP6/GP7 configurados como saída para o M0/M1 do LoRa). Como a boia alta é NF, `d6 = 1` significa "normal" e não atrapalhou o roteiro. A opção "GP0–GP5" do gerador foi marcada como **não usar na V1**.

### T1 — Abastecimento completo (14:06)

| Passo | Esperado | Observado |
|---|---|---|
| `card PC-07` | `aguardando_matricula` | OK |
| `mat 1234` | `auth/req` → NexON `ok:true` → `partindo` | resposta em **99 ms** |
| Pulso BO1 + aux K1 no BI1 | `abastecendo` em < 1 s | **249 ms** |
| `fluxo 60`, bico fora | litros acumulando | 60 L/min |
| Bico devolvido | `encerrando` → `ociosa`, transação `concluido` | K1 abriu em 250 ms; **11,15 L**, `concluido`, `online` |
| NexON | transação no modal/relatório | gravada com máquina "Trator PC-07" e operador "Teste" |

Deu 11 L e não 20 porque o fio do BI4 encostou de novo 150 ms depois de solto e a TON entendeu "bico devolvido" — comportamento correto para o sinal recebido.

Tentativas anteriores do T1 (10:37, 11:39, 13:59) terminaram em `fluxo_parado`/`nivel_baixo` por causa dos problemas descritos na seção 5 (atraso de entrega MQTT, canal analógico, contato da pilha), não por falha da lógica.

### T2 — Negativas e pré-condições (14:09–14:22)

| Item | Estímulo | Motivo esperado | Observado | Quem negou |
|---|---|---|---|---|
| T2.1 | `card XX-99` · `mat 1234` | `tag` | `tag` | NexON (`ok:false`) |
| T2.2 | `card PC-07` · `mat 9999` | `matricula` | `matricula` | NexON |
| T2.3 | `card PC-08` · `mat 1234` | `par` | `par` | NexON |
| T2.4 | `card` e esperar 60 s | `timeout_matricula` | `timeout_matricula` aos 60,0 s | TON |
| T2.5 | emergência aberta (BI3) | `emergencia` | `emergencia` | TON, mesmo com NexON `ok:true` |
| T2.6 | chave em Manual (BI2) | `manual` | estado `manual`; `card` → `negado manual` | TON |
| T2.7 | boia de mínimo aberta (BI5) | `nivel_baixo` | `nivel_baixo` | TON |
| T2.8 | AI1 abaixo de 10 % | `nivel_baixo` | `nivel_baixo` | TON |
| T2.9 | bico fora do suporte (BI4) | `bico_fora` | `bico_fora` | TON |

Nenhum relé foi acionado em nenhum caso. Todos os 9 eventos `negado` chegaram ao NexON.

### T3 — Fins de abastecimento (14:43–14:47)

| Item | Estímulo | Esperado | Observado |
|---|---|---|---|
| T3.1 | emergência durante o abastecimento | BO2/BO3 caem no mesmo ciclo; `emergencia` | encerrou **1 ms** após o BI3; 7,01 L; `emergencia` |
| T3.2 | `fluxo 0` | `fluxo_parado` após 10 s | 10,0 s; 19,20 L; `fluxo_parado` |
| T3.3 | deixar correr | `timeout` aos 30 s | **30,000 s**; 30,00 L; `timeout` |
| T3.4 | máquina com limite 10 L (PC-09) | NexON manda `limite_litros:10`; `limite` em ~10 L | `limite_litros:10` no `auth/resp`; parou em **10,00 L** |
| T3.5 | nível abaixo do mínimo | `nivel_baixo` | `nivel_baixo` pela AI (3 vezes, após 3 s abaixo) |

Bônus observado: a segunda tentativa do PC-09 no mesmo dia foi negada pelo NexON com `limite_diario` — o limite da máquina no cadastro é **diário**; a TON só corta o abastecimento em curso no valor que o NexON envia.

### T4 — Contator, bloqueio e rearme (14:51–15:55)

| Item | Estímulo | Esperado | Observado |
|---|---|---|---|
| T4.1 | partir sem o aux do K1 (jumper retirado) | 1 s depois desliga tudo; `falha_partida`; `bloqueada`; `card` → `negado bloqueada` | OK (`sem_confirmacao_bi1`; dois `card` negados) |
| T4.2 | fio BI1→GND (contator colado) e encerrar | `contator_colado`; transação publicada; `bloqueada` | OK: `contator_colado`, transação `emergencia` 10,40 L, `bloqueada` |
| T4.3 | `rearme` com o fio · `rearme` sem o fio | `rearme_negado` · `rearme` → `ociosa` | OK (`rearme_negado (contator_colado)`, depois `rearme` → `ociosa`) |
| T4.4 | fechar BI1 com a TON ociosa | `nao_autorizado` por fechamento; nada liga | OK (5 eventos no dia, um por fechamento) |
| T4.5 | queda **total** de energia com a TON `bloqueada` | volta `bloqueada`; só `rearme` destrava | OK no build 15:34: subiu `bloqueada`, `rearme` (via MQTT) → `ociosa` |

O T4.5 foi criado durante o teste, depois de constatar que o bloqueio sumia ao religar a TON (item 5.h).

---

## 4. Evidências no NexON

### Transações do dia (`abastecimentos`)

| Hora | Litros | Fim | Validação | Máquina | Etapa |
|---|---|---|---|---|---|
| 10:37 | 0,00 | `fluxo_parado` | online | PC-07 | T1 (1ª tentativa; atraso MQTT) |
| 11:39 | 0,00 | `nivel_baixo` | online | PC-07 | T1 (contato da pilha) |
| 13:59 | 0,00 | `fluxo_parado` | online | PC-07 | T1 (`fluxo` fora do prazo) |
| **14:06** | **11,15** | **`concluido`** | online | PC-07 | **T1** |
| 14:26 | 8,18 | `nivel_baixo` | online | PC-07 | T3 (pilha > 3 s fora) |
| 14:28 | 16,95 | `nivel_baixo` | online | PC-07 | T3 (pilha > 3 s fora) |
| 14:43 | 7,01 | `emergencia` | online | PC-07 | T3.1 |
| 14:44 | 19,20 | `fluxo_parado` | online | PC-07 | T3.2 |
| 14:45 | 30,00 | `timeout` | online | PC-07 | T3.3 |
| 14:46 | 10,00 | `limite` | online | PC-09 | T3.4 |
| 14:47 | 6,13 | `nivel_baixo` | online | PC-07 | T3.5 |
| 15:06 | 30,00 | `timeout` | **offline** | PC-07 | rede travou 12 s; caiu na lista local (item 5.j) |
| 15:25 | 10,40 | `emergencia` | online | PC-07 | T4.2 (contator colado) |
| 15:34 | 30,00 | `timeout` | online | PC-07 | T4 |
| 15:53 | 16,61 | `emergencia` | online | PC-07 | T4.5 (contator colado) |

### Eventos do dia (`bomba_eventos`)

| Tipo | Motivo | Qtde |
|---|---|---|
| negado | tag · matricula · par · timeout_matricula · emergencia · manual · nivel_baixo · bico_fora · bloqueada · ocupado · limite_diario | 1 · 1 · 1 · 2 · 1 · 2 · 7 · 1 · 3 · 1 · 1 |
| falha_partida | sem_confirmacao_bi1 | 1 |
| contator_colado | emergencia | 2 |
| rearme_negado / rearme | contator_colado | 1 / 2 |
| nao_autorizado | contator_fechou_sem_comando | 5 |
| manual | chave | 55 (a maioria por repique do jumper do BI2 antes do anti-repique) |

---

## 5. Problemas encontrados e correções (todas commitadas localmente)

| # | Problema | Efeito na bancada | Correção | Commit |
|---|---|---|---|---|
| a | Backend desinscrevia dos tópicos do posto a cada 5 min (`reconcileSubscriptions`) | eventos/transações sumiam | tópicos derivados incluídos | `523b7c5` |
| b | Mapa de entradas da V1: a opção GP0–GP5 deixava `d1` preso | leitura errada das BI | padrão GP1–GP6 confirmado, opção marcada "não usar" | `ee93680` |
| c | **AI do nível lia o AN2** (`adc_read_mv` é 1-based, o glue passava `canal−1`) | "AI1" mostrava a pilha do AN2 | canal correto | `41f6f59` |
| d | Chave/jumper com repique gerava 8 trocas `ociosa↔manual` em 90 s | evento + transação a cada troca | anti-repique bit a bit de 100 ms nas BI, log `[BOMBA] BIn -> v` | `c593d8f` |
| e | Entrega MQTT chegava em rajadas 3–50 s atrasadas (perda WiFi + retransmissão TCP com *modem-sleep*) | `auth/resp` chegava depois do timeout | `WiFi.setSleep(false)` no firmware do posto → autorização em 65–169 ms | `c593d8f` |
| f | Sem visibilidade do analógico | horas caçando a pilha | `status` mostra `an1/an2` em mV | `222be38` |
| g | **Uma amostra ruim de nível cortava o abastecimento** (contato da pilha) | `nivel_baixo` espúrio | mediana de 9 amostras + `nivel_baixo` só se persistir 3 s (pré-condição segue imediata) | `fc5dc2f` |
| g' | Evento `manual` espúrio a cada boot (expansor lê "aberto" nos primeiros 150 ms) | ruído no histórico | espera de 500 ms antes do 1º tick | `fc5dc2f` |
| h | **`bloqueada` sumia ao religar a TON** (contator colado "resolvido" na tomada) | furo de segurança | bloqueio no NVS; boot restaura; só `rearme` limpa | `1e832b8` |

Testes de host da lib: **83/83**. Smoke do gerador V2 e regressão V1 (16 diagramas) byte-idênticos. Firmwares V1 e V2 compilam.

Outros achados (sem correção de código):

- **i.** Contato da pilha (fita) abriu dezenas de vezes; explica todos os `nivel_baixo` fora do roteiro. Recomendação para a próxima bancada: alimentar o AN1 com o +5 V da fonte.
- **j.** Uma travada de rede de ~12 s às 15:06 fez um abastecimento validar **offline** (lista local) apesar de o NexON ter respondido. É o fallback desenhado; em campo, considerar `auth_timeout_s` maior ou Ethernet.
- **k.** O cabo USB do monitor caiu várias vezes ao mexer nos fios ("device has been lost") e quebrou no fim. A TON **nunca reiniciou** por isso (uptime contínuo). Comandos de bancada também funcionam por MQTT (`<base>/cmd`), exceto `net on` depois de `net off`.

---

## 6. Pendências

**Roteiro**

- T5 (modo manual), T6 (offline, buffer, NVS, queda de energia abastecendo, OTA recusada), T7 (cadastro → lista → efeito), T8 (segurança: comandos de simulação por MQTT no build de campo, forjar `auth/resp`, ACL/HMAC).
- Repetir T2.7 e T3.5 pela **boia** com a pilha estável, para isolar do caminho da AI (hoje os dois motivos se confundem).
- Limpeza da bancada ao final (SQL do kit §6) e calibração real de mV0/mV100 do transmissor de nível.

**Decisões de produto**

- Quem pode dar `rearme` (só no local, ou também pelo NexON?).
- ACL/HMAC no broker para `auth/resp` e `cmd` (T8.3).
- "Fluxo parado" contado a partir da saída do bico, não do início.
- Validade da lista offline (por quanto tempo a TON aceita abastecer sem NexON).

**Hardware / infra**

- BI6 preso em LOW nesta TON3 (GP6 do expansor é saída do LoRa): verificar em outra placa V1 e na V2.
- Travadas ocasionais de WiFi mesmo sem *power-save*.
- Push dos commits para o GitHub (token pendente).

---

## 7. Arquivos

- Kit e achados detalhados: `docs/POSTO-BANCADA-KIT.md`
- Handoff do projeto: `docs/HANDOFF-POSTO-COMBUSTIVEL-E-TON.md`
- Lib da máquina de estados: `AupusNexOn/firmware-libs/bomba_posto/` (`test_bomba.cpp`)
- Registro bruto do broker do dia: `scratchpad/posto/mqtt_bancada.log` (sessão)
