# Posto de combustível — kit de bancada (o que está pronto e como rodar o "Teste em bancada")

> Complementa `/var/www/Teste em bancada.md` (roteiro T0–T7) e `/var/www/Posto de Combustível na Fazenda — Como funciona (1).md`.
> Estado em 2026-09-21. Tudo abaixo já está no código (commits locais `6dc4247`/`7b4d1f6`/`8449849`); o que falta é **rodar a migração SQL** e a bancada física.

## 0. Antes de começar (uma vez)

| # | O quê | Como |
|---|---|---|
| 1 | Migração do banco (tabelas de operadores/eventos, colunas novas, catálogo de pontos, paleta do editor, renomeia os pontos da BC-01) | `psql -h localhost -p 5433 -U postgres -d aupus -f /var/www/service-nexon/aupus-nexon-api/db/manual-migrations/2026-09-21_posto_combustivel.sql` (dry-run com ROLLBACK já passou) |
| 2 | Backend novo no ar | `pm2 restart aupus-nexon-api` (o `dist/` já está buildado; **só depois** da migração) |
| 3 | Frontend | já deployado (`IOT_SCRIPTS_VERSION=20260921-posto-t8`) — Ctrl+Shift+R no navegador |
| 4 | Firmware de teste de placa (etapa 0) | V1: prebuilt `ton-teste-v2.bin` (comandos `r1..r6 on/off`, `din`, `adc`, `guia`) · V2: `ton-teste-ton-v2.bin` (`r1..r8`, `din`, `adc`, `teste`). Gravação pelo NexON (Web Serial) |

## 1. O que o firmware novo faz (resumo do que foi implementado)

Lógica em `AupusNexOn/firmware-libs/bomba_posto/` (C++ puro, **77 verificações no host** cobrindo as etapas 1–6 e 8) + glue gerado `src/bomba.cpp` nos geradores V1 e V2 (mesmo roteiro nas duas placas).

- Estados: `ociosa → aguardando_matricula → validando → partindo → abastecendo → encerrando → ociosa`, mais `bloqueada` (falha de partida / contator colado, sai por `rearme`) e `manual` (chave do painel).
- Validação: com MQTT conectado publica `<base>/auth/req {req_id, uid, matricula}` e espera `<base>/auth/resp` por até 3 s; sem resposta ou offline, valida pela lista local (NVS, com versão).
- Partida: liga **Permissão (BO2)** e **Solenoide (BO3)**, pulsa **Liga (BO1)** 500 ms, espera o **Contator (BI1)** fechar em 1 s. Sem confirmação → desliga tudo, evento `falha_partida`, estado `bloqueada`.
- Fins (qualquer um encerra): emergência (BI3 abriu), bico devolvido (BI4), fluxo parado, tempo máximo, limite de litros da autorização, nível baixo (boia BI5 ou AI1 < mínimo), chave para Manual, contator caiu.
- Encerramento: solta BO2/BO3, espera BI1 abrir em 1 s; se continuar fechado → evento `contator_colado`, estado `bloqueada` (a transação é publicada mesmo assim).
- Segurança: relés desligados no boot e nenhuma partida no 1º segundo; BI1 fechada em `ociosa` → evento `nao_autorizado`; OTA recusada fora de `ociosa`/`bloqueada` (publica `ota/status {"state":"refused"}`); sessão em andamento salva em NVS → após queda de energia publica a transação com `fim_motivo:"queda_energia"`.
- Publica: `<base>/abastecimento` (transação), `<base>/evento` (negado/falha_partida/contator_colado/nao_autorizado/manual/rearme), `<base>/bomba` (telemetria a cada 30 s e a cada mudança de estado). Todas vão pro buffer SD quando offline.
- Comandos (Serial USB e MQTT `<base>/cmd` `{"cmd":"..."}`): `card <UID>` (ou só `card` = UID de teste), `mat <n>` (ou `mat`), `fluxo <L/min>` (`fluxo 0` = parado), `status`, `rearme`, `net off` / `net on`, `lista`.

### Decisões tomadas onde o roteiro deixava margem (confirmar)

| Ponto | Decisão no firmware |
|---|---|
| Polaridade do BI4 (bico) | **fechado = bico no suporte**. O fim `concluido` é a transição *fora do suporte → no suporte* (o bico precisa ter saído). Na bancada: S2 fechada no início, **abrir S2 ao "pegar o bico"** e **fechar S2 para "devolver"** (o roteiro T1.4 diz "abrir S2 (bico devolvido)" — com esta convenção é *fechar*). |
| Falha de partida | vai para `bloqueada` (tabela de estados do roteiro), sai por `rearme` |
| OTA em `bloqueada` | permitida (relés desligados; evita ficar preso sem poder atualizar) |
| Cronômetro de fluxo parado | começa na partida (T1.3: dar `fluxo 60` em até 10 s na bancada) |
| Sem BI1 mapeada | modo "sem confirmação": parte após o pulso e encerra sem esperar o contator |
| Cadastro de matrículas vazio | **NEGA** (fail-closed) — um sync vazio ou cadastro apagado nunca abre o posto. Só a opção explícita **"Matrícula livre"** na bomba aceita qualquer matrícula digitada (ainda respeita o par tag↔matrícula). Mesma regra no NexON (`auth/resp`) |
| Limite diário | validado ONLINE pelo NexON (`limite_diario`); offline a lista traz `limite` por tag (litros por abastecimento) |
| Motivo extra | `contator_caiu` (K1 abriu sem comando durante o abastecimento, ex.: emergência que cortou a bobina antes da BI3) |
| Bico fora do suporte ao liberar (T2.9) | **nega** com `bico_fora` (alguém pode estar com o gatilho aberto). Sem BI do bico mapeada não há intertravamento |
| Comandos de simulação por MQTT (T8.2) | só em build de bancada (tópico base começando por `TESTE/` ou modo Simular). Em build de campo `card/mat/fluxo/net` por MQTT respondem `sim_cmd_recusado_build_campo`; pelo Serial USB continuam valendo (acesso físico). `status/rearme/lista` seguem por MQTT |
| `auth/resp` forjada (T8.3) | o `req_id` leva nonce aleatório (`r<seq>-<hex>`, `esp_random`) — resposta com id chutado é ignorada. **Quem consegue ler o broker ainda responde** (o broker aceita conexão anônima hoje): a proteção real é ACL no broker (usuário/senha por TON + ACL por prefixo de tópico) ou assinatura HMAC nas mensagens NexON→TON (`auth/resp` e, mais importante, `cmd/rfid_sync`, que é retida). Decisão pendente |

## 2. Montagem no NexON (diagrama IoT)

Projeto existente: **"IoT Posto"** (unidade Posto Fazenda Algodoeira) — TON3 (V1) + bomba **BC-01**.

1. Sheet da **TON3**: Tópico base `TESTE/POSTO/BANCADA` (prefixo `TESTE/` isola do campo; o backend roteia pelo tópico cadastrado). "Mapa das entradas BI" = **Padrão da placa V1 (GP1-GP6)** — a bancada de 22/09 provou que na V1 X12-1..6 = GP1..GP6 (o "off-by-one" do firmware gerado era falso; GP0 não é entrada e lê preso em 1). ⚠️ O firmware de teste `ton-teste-v2.bin` (V1) lê GP0-5 e está ERRADO nas entradas — usar o gerado para conferir BI.
2. Nó **bomba** (props): Exigir matrícula = Sim · Fluxo parado = **10** s · Tempo máximo = **30** s · Nível mínimo = **10** % · UID de teste `PC-07` · Matrícula de teste `1234`. (Campo: 30 s / 600 s.)
3. **Salvar** (cria/atualiza os pontos canônicos da bomba). Depois da migração os pontos da BC-01 são: Ligar, Permissão, Solenoide, Sinaleiro · Contator, Auto/Manual, Emergência, Bico, Boia mínimo, Boia alta · Nível.
4. Sheet da TON → **Comando**: BO1→Ligar, BO2→Permissão, BO3→Solenoide, (BO4→Sinaleiro) · **Status**: BI1→Contator, BI2→Auto/Manual, BI3→Emergência, BI4→Bico, BI5→Boia mínimo, BI6→Boia alta · **Medições**: AI1→Nível (mV0 = 0, mV100 = 3000 para 0–10 V com o divisor; calibrar no T0.3).
5. **Gerar firmware** (botão normal, **não** o "Simular" — o tópico já começa por `TESTE/`; assim a OTA fica ativa para o T6.5) → compilar → gravar por USB. Avisos do gerador listam qualquer papel não mapeado.
6. Unifilar → clicar na bomba → aba **Máquinas**: tag `PC-07` (máquina "Trator PC-07") · aba **Operadores**: matrícula `1234` → **Publicar lista na TON** (vai retida em `TESTE/POSTO/BANCADA/cmd/rfid_sync`; a TON mostra `lista vN` no `status`). Para o T2.3 cadastre uma 2ª tag com "Matrículas = 5555".
7. Para a **TON V2**: mesmo diagrama com `ton3v2` (ou um projeto irmão) — não precisa da opção din_gp0 (a base V2 já lê GP0-7).

## 3. Fiação de bancada (V1 e V2)

Entradas: contato seco **fechando contra o GND da TON** (não aplicar tensão). Convenção NF: emergência e boias **fechadas = normal**, abrir = evento.

| Papel | TON | Na bancada | V1 (mapa padrão) | V2 |
|---|---|---|---|---|
| Liga (pulso) | BO1 | mala E1 no C/NA do relé 1 | X1 | X1 |
| Permissão (mantida) | BO2 | **C do BO2 → GND, NA do BO2 → BI1** (simula o aux do K1) + mala E2 | X2 → X12-1 | X2 → X12-1 |
| Solenoide | BO3 | mala E3 | X3 | X3 |
| Sinaleiro (opcional) | BO4 | LED | X4 | X4 |
| Contator (aux K1) | BI1 | vem do jumper do BO2 | X12-1 | X12-1 |
| Auto/Manual | BI2 | jumper fechado = Automático | X12-2 | X12-2 |
| Emergência (NF) | BI3 | S3 da mala (fechada = normal) | X12-3 | X12-3 |
| Bico (fechado = no suporte) | BI4 | S2 da mala | X12-4 | X12-4 |
| Boia mínimo (NF) | BI5 | S1 da mala (fechada = normal) | X12-5 | X12-5 |
| Boia alta (NF) | BI6 | jumper fechado | X12-6 | X12-6 |
| Nível | AI1 | 0–10 V da mala (limitar em 12 V) | X7 AN1 + GND | X77 AN1 + GND |

Bancada 22/09/2026 (mapeamento com um fio no GND, borne a borne): X12-1..5 = `d1..d5` com o mapa padrão (GP1-GP6). **X12-6 (BI6) não respondeu e `d6` lê 1 fixo sem fio** nesta TON3 (pino preso em LOW — GP0/GP6); como boia alta é NF, `d6=1` = "normal" e não atrapalha o roteiro. A opção GP0-GP5 deixa `d1` preso em 1 — não usar na V1.

Bancada 22/09/2026, 2ª rodada (T1 na fonte 5 V, 1 pilha no AN2): **(a)** o firmware gravado (build 10:15) é anterior à correção do canal analógico — nele "AI1" lê o **AN2**; a partir do build seguinte "AI1" lê o **AN1** (mover a pilha). **(b)** O nível caiu de 100 % para 0–6 % exatamente quando a fonte entrou — leitura de borne aberto: conferir a pilha (medir entre AN e o GND do X7, esperado ≈1,5 V). **(c)** A chave Auto (BI2) trocou 8× em 90 s (jumper mal preso) e cada troca gerou evento + transação `manual`; o glue ganhou **anti-repique bit a bit de 100 ms** e imprime `[BOMBA] BIn -> v` a cada mudança estável — use isso para conferir a fiação. **(d)** Os atrasos de publicação (3, 24 e 50 s, chegando em rajadas, com o NexON respondendo em 1 s) são perda de pacote WiFi + retransmissão TCP com o *modem-sleep* padrão do ESP32; o firmware do posto agora sobe com `WiFi.setSleep(false)` (+~60 mA, fonte 5 V/2 A). Se persistir: medir a fonte na placa durante o pulso (relés + WiFi) e trocar de canal/AP.

Bancada 22/09/2026, 3ª rodada (build 11:31, `status` com `an1/an2` em mV): **(e)** entrada AN1 desta TON3 está boa (`an1=3388 mV` com 2 pilhas); o 0 % era **contato intermitente da pilha** — no broker o nível alternava exatamente 100/0 a cada telemetria, parado e sem relé. Com o WiFi sem power-save o `auth/resp` chegou em **77 ms** e os eventos passaram a chegar ao broker no mesmo segundo. **(f)** O T1 encerrou com `nivel_baixo` aos 9,8 s por UMA amostra em 0 → firmware blindado: nível = **mediana de 9 amostras** (1 a cada 20 ms) e, durante o abastecimento, `nivel_baixo` **só encerra se persistir 3 s** (`Config.nivel_baixo_ms`, pré-condição de partida segue imediata). **(g)** A cada boot saía um evento `manual` espúrio (o MCP lê tudo "aberto" nos primeiros 150 ms) → o glue espera 500 ms antes do 1º tick.

Bancada 22/09/2026, 4ª rodada (T2–T4 completos, build 15:34): **(h)** T2.1–T2.9, T3.1–T3.5 e T4.1–T4.4 aprovados e ingeridos (`bomba_eventos`/`abastecimentos`); o NexON também negou `limite_diario` na 2ª tentativa do PC-09 (limite da máquina é **diário**). **(i)** FURO achado e corrigido: `bloqueada` sumia ao religar a TON (o dono saiu do bloqueio reiniciando, sem `rearme`). Agora o bloqueio fica no NVS (`bloq`), o boot restaura (`[BOMBA] BLOQUEIO restaurado do NVS`, `Maquina::bloquear`) e só `rearme` limpa — validado com queda total de energia (fonte + USB) em `bloqueada`: voltou `bloqueada`. **(j)** Um abastecimento validou `offline` mesmo com o NexON respondendo: a entrega WiFi travou ~12 s naquele minuto e o `auth_timeout` (3 s) caiu na lista local, como desenhado. As travadas ocasionais de rede continuam existindo sem power-save (menos frequentes); em campo, `auth_timeout_s` maior ou Ethernet. **(k)** Cabo USB do monitor caiu várias vezes ao mexer nos fios ("device has been lost"); a TON nunca reiniciou por isso (`t=` do log e uptime seguem). Comandos de bancada também vão por MQTT (`<base>/cmd`, §4), exceto `net on` depois de `net off`.

## 4. Como observar

```bash
# tudo que a TON publica (telemetria, eventos, transações, pedido de autorização e a resposta do NexON)
mosquitto_sub -h 72.60.158.163 -t 'TESTE/POSTO/BANCADA/#' -v
# comandos por MQTT (equivalem aos do Serial)
mosquitto_pub -h 72.60.158.163 -t 'TESTE/POSTO/BANCADA/cmd' -m '{"cmd_id":"t1","cmd":"card PC-07"}'
mosquitto_pub -h 72.60.158.163 -t 'TESTE/POSTO/BANCADA/cmd' -m '{"cmd_id":"t2","cmd":"mat 1234"}'
mosquitto_pub -h 72.60.158.163 -t 'TESTE/POSTO/BANCADA/cmd' -m '{"cmd_id":"t3","cmd":"fluxo 60"}'
# lista sem passar pelo NexON (fallback de bancada)
mosquitto_pub -h 72.60.158.163 -t 'TESTE/POSTO/BANCADA/cmd/rfid_sync' -r -m '{"versao":1,"tags":[{"uid":"PC-07","mats":[],"limite":0}],"mats":["1234"]}'
```
No NexON: modal da bomba (Visão = estado/telemetria em tempo quase real; Eventos; Máquinas; Operadores) e Relatórios → Abastecimento. Log do backend: `pm2 logs aupus-nexon-api | grep posto` (mostra cada `auth OK/NEGADO`).

## 5. Mapa do roteiro → o que fazer / o que esperar

| ID | Fazer | Esperar (Serial `[BOMBA]` e MQTT) |
|---|---|---|
| T0.x | firmware de TESTE (`r1 on`, `din`, `adc`, 20 ciclos de energia) | LEDs/mala; `din` = estado das 6/8 entradas; AN1 linear (anotar mV por tensão para os mV0/mV100 do passo 2.4) |
| T1.1 | `card PC-07` → `mat 1234` | `ociosa → aguardando_matricula → validando → partindo`; BO2+BO3 ligam, BO1 pulsa ~500 ms (mala mede) |
| T1.2 | (jumper BO2→BI1 fecha a BI1) | `partindo → abastecendo` em < 1 s |
| T1.3 | abrir S2 (pegou o bico) · `fluxo 60` por 20 s · `status` | litros ≈ 20 |
| T1.4 | fechar S2 (devolveu) | BO2/BO3 caem; `encerrando → ociosa`; `abastecimento {fim_motivo:"concluido", validacao:"online"}` (ou `offline` se sem NexON) |
| T2.1–T2.3 | tag/matrícula/par inválidos | `evento negado` motivo `tag` / `matricula` / `par`; nenhum relé mexe. Online: motivo vem do NexON; offline: da lista |
| T2.4 | `card` e esperar 60 s | `negado timeout_matricula` → `ociosa` |
| T2.5–T2.8 | S3 aberta · BI2 aberta · S1 aberta · AI1 < 10 % | `negado emergencia` / `manual` (estado `manual`) / `nivel_baixo` / `nivel_baixo` |
| T2.9 | S2 aberta (bico fora) → `card`/`mat` | `negado bico_fora` |
| T3.1 | abastecendo → abrir S3 | BO2 abre no mesmo ciclo (< 50 ms); `fim_motivo:"emergencia"` |
| T3.2 | `fluxo 0` | encerra após 10 s: `fluxo_parado` |
| T3.3 | deixar correr | 30 s: `timeout` |
| T3.4 | tag com limite 10 L (online: `limite_litros` do NexON; offline: `limite` da lista) + `fluxo 60` | encerra em ~10 L: `limite` |
| T3.5 | abrir S1 ou baixar AI1 | `nivel_baixo` |
| T4.1 | tirar o jumper NA do BO2→BI1 e iniciar | após 1 s desliga tudo; `evento falha_partida`; estado `bloqueada`; novo `card` → `negado bloqueada` |
| T4.2 | jumper fixo BI1→GND durante o abastecimento e encerrar | `evento contator_colado`; transação publicada; `bloqueada` |
| T4.3 | `rearme` com jumper → `rearme_negado`; tirar jumper → `rearme` | `rearme` → `ociosa` |
| T4.4 | fechar BI1 com a TON ociosa | `evento nao_autorizado` (um por fechamento) |
| T5.1–T5.3 | abrir BI2 · fechar BI1 + `fluxo 60` por 20 s · fechar BI2 | `evento manual`; ao abrir BI1: `abastecimento {validacao:"manual", litros≈20}`; volta a `ociosa` |
| T6.1 | `net off` (ou tirar rede) e abastecer | `validacao:"offline"` |
| T6.2 | 3 abastecimentos offline, `net on`/reconectar | as 3 transações chegam do buffer SD com `inicio/fim` (epoch) |
| T6.6 | religar SEM rede (sem NTP) · abastecer · `net on` | a TON não tem hora: publica `inicio:0, fim:0` → no NexON ficam **nulos** e `created_at` = hora de chegada (marcado como não confiável, não inventado) |
| T6.3 | reiniciar sem rede, `lista` | `lista vN` preservada (NVS) |
| T6.4 | cortar energia abastecendo | relés caem; no boot nada religa; ao reconectar publica `abastecimento {fim_motivo:"queda_energia"}` |
| T6.5 | Implantar OTA durante o abastecimento | `[OTA] RECUSADA` + `ota/status {"state":"refused"}`; em `ociosa` a OTA passa |
| T7.1 | cadastrar máquina/matrícula → Publicar | `lista_versao` novo no `status`/telemetria e no modal ("Lista na TON vN") |
| T7.2 | abastecer | transação no modal e no relatório com máquina, matrícula, litros, fim, validação |
| T7.3 | remover a máquina → Publicar → `card` | online: `negado tag` na hora; offline: só depois da lista sincronizar |
| T8.1 | apagar operadores → Publicar → `card PC-07` / `mat 7777` | `negado matricula` (fail-closed) — online e offline; Serial avisa "lista sem matriculas" no sync |
| T8.2 | build de campo (tópico sem `TESTE/`): `card` por MQTT | `cmd/ack {msg:"sim_cmd_recusado_build_campo"}`; pelo Serial funciona |
| T8.3 | publicar `auth/resp {"req_id":"r1","ok":true}` durante `validando` | ignorada (id não casa: `r<seq>-<nonce>`). Com o `req_id` copiado do `auth/req` real a TON ACEITA → registrar e decidir ACL/HMAC |

## 6. Depois do teste — limpar a bancada (SQL, rodar você)

```sql
-- transações/eventos de bancada da BC-01 (mantém cadastro de tags/operadores)
DELETE FROM abastecimentos WHERE TRIM(equipamento_id) = 'cmt07i88j0014jqyiue0j75na';
DELETE FROM bomba_eventos   WHERE TRIM(equipamento_id) = 'cmt07i88j0014jqyiue0j75na';
UPDATE bomba_combustivel_config SET ultimo_estado = NULL, ultimo_nivel_pct = NULL, ultimo_json = NULL WHERE TRIM(equipamento_id) = 'cmt07i88j0014jqyiue0j75na';
```
Também: mV0/mV100 reais no AI1 (T0.3) → regerar o firmware; e, antes do campo, tópico base real (sem `TESTE/`) — isso desliga os comandos de simulação por MQTT automaticamente.

## 7. O que ainda NÃO está coberto

- Leitor RFID, IHM (matrícula) e fluxômetro **reais** no RS485: os drivers Modbus entram quando os modelos forem escolhidos (hoje `card`, `mat` e `fluxo` simulam; o `k_fator` já está nas props).
- Limite de litros por dia aplicado **offline** (a lista leva `limite` por tag = teto por abastecimento; o diário é validado online).
- Envio/PDF do relatório de abastecimento; "quem pode dar `rearme`" (hoje: Serial/MQTT `cmd`).
- Firmware manual antigo `/var/www/iot_nexon/PLATFORMIO/BOMBA-COMBUSTIVEL/` ficou obsoleto (lógica antiga, tópico `TESTE/<MAC>`): o caminho é o gerador.
