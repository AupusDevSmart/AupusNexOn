# TON — Plano de prevenção e recuperação de travamento

**Data:** 23/09/2026 (rev. 2, incorpora `TON-PLANO-ANTITRAVAMENTO-revisao.md`) · **Origem:** caso NS Aparecida (UFV parada de 01/08 03:14 até ser religada na tomada em 16/09, com a rede da fazenda funcionando) · **Escopo:** firmware gerado V1 (ton1–ton4) e V2 (ton1v2–ton4v2).

## 1. Princípio

A TON fica em campo sem ninguém por perto. Toda falha precisa terminar em uma de duas saídas, **sem visita**:

1. **Prevenção:** nenhuma operação pode segurar o laço principal por muito tempo. Toda espera tem teto, e o teto é bem menor que o watchdog de 60 s.
2. **Recuperação em camadas:** reiniciar o periférico que falhou; se não resolver, reiniciar a TON (com recuo, sem loop); registrar o motivo no NexON.

Um periférico em falha (inversor sem comunicação, cartão SD ruim, cabo Ethernet sem DHCP) **nunca** pode derrubar o resto.

## 2. O que já existe e o que foi feito hoje

| Camada | Estado |
|---|---|
| Watchdog de tarefa (60 s) no laço principal | já existia: pega laço preso, não pega "vivo mas sem rede" |
| Back-off por device Modbus (inversor em falha não trava os outros) | já existia; NSA confirma: WEG em falha, Huawei normal |
| Rollback de OTA (firmware novo que não publica volta ao anterior) | já existia |
| **Comando `reboot`** (MQTT/Serial, recusa com OTA ou posto ocupado, ignora comando retido) | **feito hoje** (`0a0bfae`) |
| **Watchdog de conectividade**: 3 min sem broker com WiFi associado → reassocia (mesma rede se só houver uma); 10/30/60 min → reinicia, com recuo | **feito hoje** |
| **Hora preservada** no reinício (sem internet, continua carimbando certo) | **feito hoje** |
| **Motivo do reinício** no `status`/`diagnostics` e evento no histórico do NexON | **feito hoje** (`a9bb230`, backend no ar) |

### Implementado em 23/09 (2ª leva, no gerador — chega às TONs via OTA)

| Item | Estado |
|---|---|
| A1–A7 Fila do SD segmentada (lib `firmware-libs/sd_queue`, 25/25 testes de host: ordem, falha de publicação, queda de energia na drenagem e na gravação, cartão cheio, cartão com defeito e remontagem, migração do arquivo antigo, contagem fatiada) | **feito** |
| B1 socket do broker 30 → 8 s · B2 recuo 5 → 60 s · B3 DHCP 10 → 4 s + recuo de 2 min · B4 reset do W5500 pelo IO14 | **feito** |
| C1 UART do RS485 reiniciada após 15 min sem nenhuma leitura boa (sem reiniciar a TON: inversor dorme à noite) | **feito** |
| C3 relé conferido pelo latch (OLAT) + recuperação do I²C · C4 posto bloqueia (`io_falha`) e reinicia | **feito** |
| D0 teto global: 4 reinícios automáticos em 6 h (fora: comando manual e o watchdog de broker, que já tem recuo) | **feito** |
| D1 `loop_max_ms` no diagnóstico (calibrar o watchdog depois de medir) | **feito** — watchdog continua 60 s |
| Diagnóstico ganhou `sd_estado`, `sd_pendentes`, `sd_descartadas`, `loop_max_ms`, `i2c_resets`, `restart_cause` | **feito** |
| **Caixa-preta** (`firmware-libs/blackbox`): 40 eventos em RTC + 16 no NVS (sobrevive a tirar da tomada), etapa do laço no momento do watchdog, publicada em `<base>/log` ao reconectar e pelo comando `log`; NexON grava em `logs_mqtt` | **feito** (3ª leva) |
| Relés preservados em reinício por **software** (exceto posto/pivô/carregador, que começam desligados) | **feito** |
| D2 reinício por memória < 40 kB por 60 s (sujeito ao teto) | **feito** |
| Revisão 2: ponteiro do SD a cada 3 lotes + gravação antes de reiniciar · teto global no **NVS** · comando `sd limpar confirmo` | **feito** (29/29 testes de host) |
| C2 teto por ciclo no Modbus TCP | dispensado por ora: cada equipamento TCP já tem recuo próprio após falhas seguidas |
| D3 reinício diário | **não fazer**: os watchdogs cobrem, e reinício diário só acrescenta risco |
| D4 botão "Reiniciar TON" · D6 histórico do diagnóstico | pendente (só NexON, não exige regravar) |
| D5 alerta de offline | **reformulado**: o e-mail já existe (NSA foi avisada 01/08 06:45 UTC) mas foram 270 e-mails desde julho → fazer anti-oscilação e resumo (só NexON) |
| Formatar o SD à distância | pendente: o core atual não tem formatação; exige FatFs direto + teste de bancada |

## 3. Inventário: o que pode travar

Severidade: **Alta** = pode parar a TON ou causar reinício em loop; **Média** = degrada (dados atrasam, laço lento); **Baixa** = raro ou já contido.

| # | Ponto | Como trava | Sev. | Hoje |
|---|---|---|---|---|
| S1 | **SD: contagem de pendentes** | `sd_buffer_pending()` lê o arquivo **byte a byte** (até 5 MB) para contar linhas, a cada 10 s com MQTT conectado e a cada reconexão. Com backlog grande pode passar de 60 s → **watchdog → reinicia → na volta conta de novo → loop** | **Alta** | sem proteção |
| S2 | **SD: drenagem regrava o arquivo inteiro** | para mandar 5 mensagens, copia todo o resto para um arquivo novo. Com 5 MB: lento, desgasta o cartão, e **queda de energia no meio corrompe** (renomeou e não terminou) | **Alta** | sem proteção |
| S3 | **SD: cartão ruim/removido depois do boot** | `_sdReady` continua verdadeiro; cada publicação offline tenta abrir o cartão e pode esperar o SPI/FAT falhar (centenas de ms por tentativa) | Média | sem proteção |
| S4 | **SD: sistema de arquivos corrompido** | `SD.begin` falha no boot → a TON segue sem buffer (correto), mas **perde dados offline em silêncio** | Média | só aparece no `diagnostics` |
| N1 | Rede "viva" sem broker (caso NSA) | WiFi associado, TCP morto, nada reinicia | Alta | **resolvido hoje** |
| N2 | **Conexão ao broker que não responde** | `connect()` espera o CONNACK até 30 s (socket timeout) e tenta de novo a cada 5 s: laço preso ~85% do tempo; somado a uma leitura Modbus lenta, estoura os 60 s → **watchdog** (provável causa do reset de 21/09 na NSA) | **Alta** | sem proteção |
| N3 | Ethernet com link e sem DHCP | `Ethernet.begin` bloqueia até 10 s a cada 30 s | Média | limitado, mas bloqueante |
| N4 | W5500 travado (chip SPI) | link aparece, nada trafega; só reset do chip resolve | Média | sem reset do W5500 |
| M1 | Modbus RTU com device mudo | 2 s por transação (fixo na lib), vários blocos por device | Baixa | back-off por device já contém |
| M2 | Modbus TCP (datalogger/USR) que aceita e não responde | `connect`/leitura com timeout de 2 s por bloco; socket "meio aberto" (caso Chimarrão/UBS) | Média | reconexão forçada existe; sem teto por ciclo |
| M3 | Barramento RS485 inteiro mudo (conversor queimado, UART travada) | todos os devices em falha para sempre | Média | sem reinício da UART |
| I1 | I²C (expansores MCP das entradas **e dos relés**, mesmo barramento) com SDA preso | a lib tem timeout e não trava o laço, mas: **relé fica no último estado** (atuador preso ligado) e as entradas ficam congeladas. `relay_set()` **ignora falha de escrita** e anota o relé como desligado. No posto: permissão/bomba pode ficar energizada com a TON cega para o aux do K1 | **Alta** (posto, pivô, qualquer comando) | sem recuperação e sem verificação |
| O1 | OTA com download parado | timeout HTTP de 60 s = igual ao watchdog | Baixa | rollback cobre |
| H1 | Memória fragmentada após semanas (uso de `String`) | falha de alocação → panic/reinício | Baixa | `min_free_heap` no diagnóstico (NSA: 239 kB, folgado) |
| L1 | LoRa (E220) sem AUX | esperas de até 2 s, já alimentam o watchdog | Baixa | contido |
| P1 | Alimentação fraca (brownout) | reinícios repetidos | Média | agora aparece como evento "queda de tensão" |

## 4. Plano

### Fase A — Cartão SD (prioridade 1)

| Item | O que muda |
|---|---|
| A1 | **Contador de pendentes em memória**, atualizado no gravar e no drenar. Nunca mais varrer o arquivo a cada ciclo. **Reconciliação 1× no boot**: conta segmentos existentes × linhas por segmento, em fatias de 50 ms alimentando o watchdog (fora do laço crítico); o contador é só indicador, a fonte da verdade são os segmentos. |
| A2 | **Fila em segmentos**: arquivos de 64 kB (`q000001.txt`, ...). Drenar lê o segmento mais antigo a partir de um **ponteiro de leitura** (segmento + deslocamento) gravado no **NVS** — a escrita de uma chave NVS é atômica (entrada com CRC; queda no meio mantém o valor anterior). O ponteiro só avança **depois** do lote publicado: queda de energia pode **reenviar** até 5 mensagens (entrega "pelo menos uma vez"), nunca perder. Segmento esvaziado é apagado só depois do ponteiro avançar. Nada de regravar arquivo. |
| A3 | **Teto por operação**: drenar para em 5 mensagens **ou 300 ms**, o que vier primeiro; alimenta o watchdog. |
| A4 | **Detecção de cartão doente**: 3 falhas seguidas de abrir/escrever → marca SD indisponível, tenta remontar a cada 10 min; publica `sd_estado` no diagnóstico. |
| A5 | **Cartão cheio**: descarta o segmento **mais antigo** (não o mais novo) e conta `sd_descartadas`. |
| A6 | **Boot com FAT corrompido**: tenta montar 2×; se falhar, segue sem SD e gera evento "cartão com defeito" no NexON (não formata sozinho: pode ter dado recuperável). |
| A7 | Migração: no primeiro boot com o firmware novo, o `mqtt_buf.txt` antigo vira segmentos em partes, sem bloquear. |

### Fase B — Rede e broker

| Item | O que muda |
|---|---|
| B1 | Socket timeout do MQTT 30 s → **8 s**; conexão TCP ao broker com teto de 5 s. Laço nunca mais fica 30 s parado esperando CONNACK. |
| B2 | Tentativa de reconexão com recuo (5 → 10 → 20 → 60 s) em vez de a cada 5 s. |
| B3 | DHCP do Ethernet em etapas não-bloqueantes (ou teto de 3 s e recuo de 2 min quando falha seguido). |
| B4 | **Reset do W5500 pelo pino físico** (IO14, `W5500_RST`, já pulsado no boot) + reinit SPI. Critério **ativo**, não "sem tráfego": Ethernet é a interface ativa, link UP e (a) o `PINGREQ` do MQTT não tem resposta ou (b) 3 conexões TCP seguidas ao broker falham, por 5 min. Rede ociosa não dispara: o keepalive do MQTT (60 s) é tráfego obrigatório. |
| B5 | Já feito: watchdog de conectividade (reassocia / reinicia com recuo). |

### Fase C — Periféricos

| Item | O que muda |
|---|---|
| C1 | **RS485**: todos os devices do barramento em falha por 15 min → reinicia a UART e o driver; 60 min com broker OK → **pede** reinício ao gestor (item D0), que aplica o limite de 1× a cada 6 h por essa causa com a hora do último reinício **persistida** (NVS). |
| C2 | **Modbus TCP**: teto de tempo por ciclo de amostragem (um datalogger mudo não consome o ciclo dos outros). |
| C3 | **I²C**: toda escrita de relé é **verificada por leitura de volta** (registrador OLAT do MCP); falha ou 3 leituras inválidas → libera o barramento (9 pulsos de clock + STOP) e reinicializa os dois MCP; publica `i2c_resets`. `relay_set()` passa a retornar sucesso/falha e o estado anotado é o **lido**, não o pedido. |
| C4 | **I²C com atuador (posto/pivô/comandos)**: I²C sem recuperação em 5 s com algum relé ligado → a máquina entra em **falha segura** (posto → `bloqueada` motivo `io_falha`, evento no NexON) e pede reinício **imediato** ao gestor (reboot reinicializa o MCP com tudo desligado). Não existe watchdog de hardware no MCP23008: **o fail-safe definitivo é físico** — botão de emergência NF **em série com a bobina do K1** (corta a bomba sem depender da TON) e permissão do painel em série. Documentar no projeto elétrico do posto; a TON é camada de conveniência, não a única proteção. |

### Fase D — Rede de segurança e visibilidade

| Item | O que muda |
|---|---|
| D0 | **Gestor único de reinício**: toda causa (conectividade, RS485, memória, I²C, preventivo, comando) chama o mesmo `pedir_reinicio(causa)`. Ele aplica as guardas (OTA/posto), o recuo por causa **e um teto global**: no máximo 4 reinícios automáticos em 6 h; passou disso, só o reinício de 1× por hora do watchdog de conectividade e o comando manual. Contadores em RTC (sobrevive a reset) e hora do último reinício por causa em NVS (sobrevive a queda de energia). |
| D1 | Watchdog: **não baixar às cegas**. Primeiro medir: novo campo `loop_max_ms` (maior volta do laço na última hora) no `diagnostics`, e calcular o orçamento de pior caso por projeto no gerador (nº de blocos RTU × 2 s + blocos TCP × timeout + conexão MQTT 8 s + drenagem 300 ms), exibido no log de geração. Teto = 2× o pior caso medido, mínimo 30 s, máximo 60 s. |
| D2 | Memória: `min_free_heap` abaixo de 40 kB → reinício programado no próximo momento seguro. |
| D3 | **Reinício preventivo diário** (03:00, configurável por projeto, pulado com OTA/abastecimento em curso). |
| D4 | NexON: botão **"Reiniciar TON"** na tela da TON (o endpoint de comando já aceita `reboot`). |
| D5 | NexON: regra **"sem comunicação"** criada por padrão para toda TON e inversor (a NSA não tinha nenhuma e ninguém foi avisado em 47 dias). |
| D6 | NexON: histórico do `diagnostics` (1 linha a cada 5 min) e alerta de "reiniciou X vezes hoje". |

## 5. Como vamos testar antes de ir para campo

| Teste de bancada | Esperado |
|---|---|
| Broker bloqueado no firewall por 15 min (WiFi ok) | reassocia aos 3 min, reinicia aos 10 min, evento `sem_broker` no NexON ao voltar |
| Broker que aceita TCP e não responde | laço segue lendo Modbus; nenhum reset por watchdog |
| SD com 5 MB de backlog, reconectar | drena aos poucos, sem watchdog, pendentes corretos |
| Arrancar o SD com a TON gravando offline | marca SD indisponível em < 1 min, TON segue normal |
| Desligar a energia durante a drenagem | nenhuma mensagem duplicada em massa, arquivo íntegro |
| Cabo Ethernet em switch sem DHCP | laço não bloqueia; WiFi assume |
| RS485 desconectado 20 min | UART reiniciada, volta sozinho ao reconectar |
| SDA do I²C curto ao GND por 5 s | barramento recuperado, entradas voltam a ler certo |
| `reboot` retido no broker | TON ignora e não entra em loop |
| **Falha simultânea**: SD com 5 MB + broker fora + um inversor mudo, por 2 h | nenhum reset por watchdog; `loop_max_ms` abaixo do teto; reinícios só pelo gestor, dentro do teto global |
| I²C: SDA ao GND com o posto **abastecendo** | posto vai a `bloqueada` (`io_falha`), TON reinicia, relés voltam desligados; com a emergência física, a bomba para mesmo se a TON não reagir |
| Queda de energia **durante** a drenagem, 10× seguidas | nenhuma mensagem perdida; no máximo 5 reenviadas por queda |

## 6. Implantação

1. Cada fase passa pela regressão (`tools/fw-regress`, 17 projetos reais) e compila V1 e V2.
2. OTA **primeiro na NSA/UFV** (pior caso conhecido), 72 h de observação pelo `diagnostics`.
3. Depois as demais TONs, uma por site, confirmando `status` com a versão nova.
4. Nenhuma TON recebe OTA com o posto abastecendo (o firmware recusa).

## 7. Respostas à revisão

| Ponto | Decisão |
|---|---|
| A1 contador diverge após reset | aceito: reconciliação 1× no boot, fatiada; segmentos são a fonte da verdade |
| A2 ponteiro não atômico | aceito com NVS (escrita atômica por chave) em vez de temp+rename; ponteiro avança só após publicar |
| B4 falso positivo em rede ociosa | aceito: critério ativo (PINGREQ/conexão ao broker) |
| B4 pino físico ou SPI? | **pino físico IO14** (`W5500_RST`, já usado no boot) + reinit SPI |
| C1 limite vira letra morta | aceito: hora do último reinício por causa em NVS |
| D1 baixar para 30 s | aceito: medir `loop_max_ms` e orçamento de pior caso antes |
| Reinícios concorrentes | aceito: gestor único (D0) com teto global |
| I1 severidade | aceito e ampliado: Alta; `relay_set` ignora falha; itens C3/C4 + fail-safe físico no posto |
| Teste de falha simultânea | incluído na seção 5 |

## 8. Riscos das mudanças de hoje (e contenção)

| Risco | Contenção |
|---|---|
| Site **sem internet de propósito** (fazenda offline) reiniciar em ciclo | recuo 10 → 30 → 60 min: no máximo 1 reinício por hora; hora e dados do SD preservados; posto só reinicia ocioso |
| Broker da Aupus fora do ar derrubar todas as TONs juntas | mesmo recuo; ao voltar o broker todas reconectam sozinhas (antes ficariam presas) |
| Reinício no meio de OTA/abastecimento | bloqueado pelas guardas |
| `reboot` retido em loop | ignorado nos 20 s após conectar |
