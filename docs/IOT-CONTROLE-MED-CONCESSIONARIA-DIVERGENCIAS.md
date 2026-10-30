# Controle automático pelo MED Concessionária — divergências com a proposta

> **Status:** para discussão (27/10/2026); decisões sobre a revisão de 28/10 na seção 6 (30/10/2026). Nada implementado.
> **Proposta analisada:** `arquivos/nexon-controle-med-concessionaria.md` ("NexON — Algoritmos de Controle (Backend · MED Concessionária)"). As referências "§x" apontam para as seções dela.
> **Escopo deste documento:** só os pontos em que propomos fazer **diferente** para o controle automático funcionar no NexON. O que não aparece aqui está de acordo (seção 3).
> **Relacionados:** [IOT-SSU-QUADRANTES-FP-CALCULOS.md](IOT-SSU-QUADRANTES-FP-CALCULOS.md) · [IOT-SSU-NBR14522-TON-V2-INTEGRACAO.md](IOT-SSU-NBR14522-TON-V2-INTEGRACAO.md)

---

## 1. Resumo

| # | Tema | Proposta | Proposta para o NexON |
|---|---|---|---|
| D1 | Janela de reativo e virada da hora | Calendário tarifário do NexON; TON calcula `E_hora` | **Bits do próprio medidor** (SSU); backend acumula a hora |
| D2 | Disparo do ciclo | Timer fixo de 60 s | **Por evento** (minuto do medidor recebido) + idade máxima de cada entrada |
| D3 | Qualidade da medição | Compara acumulado TON × backend | **Trava de plausibilidade** que bloqueia a atuação |
| D4 | Heartbeat e watchdog | Backend reenvia o setpoint ao inversor a cada ciclo | Heartbeat **para a TON**; inversor só é escrito quando o valor muda |
| D5 | Modo seguro e retomada | P = 0, FP = 1; retomada manual na usina | Modo seguro **configurável**, respeitando os limites; **retomada automática** com rampa |
| D6 | BI manual | P = 100% Pn, FP = 1 | BI = modo local com o **mesmo limite do modo seguro** |
| D7 | Comando do inversor | % de Smax para todos | **Normalização por modelo** no catálogo; preferir modo Q a modo FP |
| D8 | Confirmação do comando | Valor medido dentro da tolerância | Setpoint de P é **teto**; Q depende da folga de S; **read-back não existe hoje** |
| D9 | Corte de P para gerar Q | Projeção com P̂ fixo | Projeção deve incluir o **aumento do P importado** causado pelo corte |
| D10 | Cargas no SEP | Incluídas por padrão (exclusão temporária) | **Só entra quem for habilitado** |
| D11 | Partida de pivô sob subtensão | Libera a partida logo após o alerta | **Não libera automaticamente**; e um único caminho de comando do pivô |
| D12 | Bancos de capacitores | Atuador por estágio | Só bancos com estágio **comandado e confirmado** pela TON |
| D13 | Quem altera parâmetros | "Analista de operação" | **Permissão própria** (papel não existe no NexON) |
| D14 | Hora nas notificações | "hh:mm:ss SSU" | SSU **não tem hora absoluta**; usar a hora da TON |
| D15 | Ordem das fases | Fase 1 já atua (FP + demanda + despachante) | **Observar e modo sombra** antes de qualquer atuação |

---

## 2. Divergências

### D1 — Janela de reativo e virada da hora vêm do medidor (§1.1, §1.3, §5.1)

**Proposta:** a janela indutiva/capacitiva e o posto vêm do calendário tarifário do NexON. A TON calcula `E_hora` e `t_rest_hora`; havendo divergência com o backend, vale o valor da TON.

**Proposta para o NexON:**
- O bloco SSU (NBR 14522) já informa o que a concessionária usa para faturar:

  | Campo | Conteúdo |
  |---|---|
  | `postoReativo` | 0 nenhum, 1 capacitivo, 2 indutivo, 3 ambos |
  | `fimIntervaloReativo` | Alterna a cada fim do intervalo de reativo, ou seja, marca a virada da hora |
  | `postoHorario` | Ponta, fora de ponta ou 4º posto |
  | `segundos` | Contagem regressiva até o fim do intervalo de demanda |

  A lib `ssu_nbr14522` já decodifica todos eles. Hoje a TON V2 **só publica o posto** e os `segundos`. **Implementar:** publicar `postoReativo` e `fimIntervaloReativo` no JSON do minuto.
- A janela de reativo e a virada da hora saem desses bits. O calendário do NexON vira **conferência**: se o medidor e o calendário discordarem, gera alarme (relógio do medidor desajustado, horário mudado na concessionária).
- O acumulado da hora é calculado no **backend**, a partir dos minutos e dos blocos fechados que já chegam (`ssu_minutos` e o bloco `fim:1`). A TON não precisa manter `E_hora`: seria uma segunda implementação da mesma conta, no firmware.
- A validação que importa é de **lacuna**: se faltou minuto do medidor na hora corrente, o orçamento fica incerto e o controle entra em modo conservador (D2). Escolher entre "valor da TON" e "valor do backend" não resolve o problema.

### D2 — Ciclo disparado por evento, com idade máxima das entradas (§3, §13)

**Proposta:** `a cada t_ciclo (60 s): ler entradas…`.

**Proposta para o NexON:**
- O ciclo dispara **quando chega um minuto novo do medidor**. Um timer fixo pode rodar com dado de 59 s atrás ou duas vezes sobre o mesmo dado.
- Cada entrada (medidor, cada inversor, cada PM) tem **idade máxima**. Entrada vencida → aquele controle **mantém** o último setpoint naquele ciclo e registra o motivo. Calcular com dado velho é pior que não atuar.
- Com LoRa no caminho, cada salto soma segundos. A idade máxima precisa considerar a rota de cada TON.

### D3 — Trava de plausibilidade antes de atuar (§1.1)

**Proposta:** só compara o acumulado calculado pelo backend com o da TON.

**Proposta para o NexON:** um portão de qualidade por entrada, avaliado a cada ciclo. Se reprovar, **bloqueia** a atuação daquele controle e gera alarme. Checagens:
- **Medidor:** `ssu_err` subindo, minuto faltando, quadrante incoerente com o sinal de P.
- **PMs e inversores:** P coerente com √3·V·I·FP, tensão dentro da faixa, sinal de P compatível com o fluxo esperado.
  - Caso real: um M160 de campo publicou potência 10× maior desde a instalação, com corrente correta. A comparação TON × backend não pega isso, porque os dois recebem o mesmo número errado.
- **Balanço:** medidor ≈ Σ cargas − Σ geração, dentro de uma tolerância de perdas. Um desvio grande indica escala ou sinal errado em algum ponto.

### D4 — Heartbeat para a TON; inversor escrito só na mudança (§10.1, §13)

**Proposta:** *"Backend reenvia o setpoint vigente a cada t_ciclo (heartbeat), mesmo sem mudança."* O watchdog da TON da UFV dispara se ficar `t_watchdog` sem setpoint válido.

**Proposta para o NexON:**
- O backend envia à TON o setpoint **com validade** (ex.: `{p_lim, q, valido_ate}`) e renova a validade a cada ciclo. É uma mensagem MQTT barata.
- A TON guarda o último valor **escrito em cada inversor** e só escreve de novo quando o valor muda além do `degrau_min`.
- O watchdog roda **na TON**: se a validade vencer, ela aplica o modo seguro (D5) sozinha.
- Motivo: limitar escritas no inversor por precaução. Não sabemos se os registradores de ajuste gravam em memória permanente (seção 4).
- **Implementar no firmware:** setpoint com validade, memória do último valor escrito por inversor e modo seguro local.

### D5 — Modo seguro configurável e retomada automática (§10.1)

**Proposta:** sem setpoint válido → inversores em **FP = 1 e P = 0**. *"Retomada manual: operador vai à usina e aciona a BI."*

**Proposta para o NexON:**
- O modo seguro é um **parâmetro por UFV** (P máximo estático, Q ou FP estático), com validação no cadastro: **Σ P estático das UFVs ≤ `D_lim_g`**. Assim a restrição de injeção continua garantida sem comunicação, e P = 0 passa a ser só um dos valores possíveis.
- **Retomada automática:** quando a comunicação volta, o controle só reassume depois de N ciclos com entradas válidas (D2, D3) e com rampa. Assim a perda de comunicação não exige ida ao local.

### D6 — BI manual respeita o limite de injeção (§10.2)

**Proposta:** BI acionada → bypass da malha, **P = 100% Pn**, FP = 1, prioridade máxima.

**Proposta para o NexON:** BI = **modo local**, que tira o controle remoto e aplica os **mesmos limites estáticos do modo seguro** (D5). Com P = 100% Pn, a chave manual pode levar a injeção acima de `D_lim_g`, justamente a restrição que o controle existe para garantir. Se for preciso um modo "sem limite nenhum", ele deve ser uma segunda posição, explícita, registrada como tal.

### D7 — Comando normalizado por modelo; preferir modo Q (§2.3, §4.2)

**Proposta:** `cmd_i = sinal_injecao · (Q_i / Smax_i) · 100 [% de Smax]` para todos os inversores.

**Proposta para o NexON:**
- Cada fabricante usa uma base diferente para o mesmo comando:
  - **Limite de P:** Huawei 40125 é % de Pmax (que pode ser 110% de Pn); WEG SunSpec 40301 é % de WMax; Sungrow 5008 é % ×0,1.
  - **Reativo:** Huawei 40123 é fração de Smax; Sungrow 5037 é % ×0,1 com modo em 5036; SunSpec 40303 é S32 em %×0,1.
- O catálogo (`mapeamento.setpoints`) já tem `escala` e faixa. **Implementar:** a **base** (Pn, Pmax, Smax), o **sinal** (injetar/absorver) e o **modo** (Q, FP, curva) por modelo. O despachante calcula em kvar/kW, e a conversão para o registrador fica no catálogo.
- **Preferir modo Q** a modo FP: com FP fixo, o Q entregue muda sozinho quando P muda (nuvem passando), e o controle precisaria reescrever a cada variação de irradiância.

### D8 — Confirmação do comando: teto de P, folga de S e read-back (§9)

**Proposta:** após `t_resposta`, ler o registrador (read-back) e a grandeza medida; fora da tolerância → repetir, marcar indisponível, redistribuir, alarme.

**Proposta para o NexON:**
- **P limite é teto:** P medido **abaixo** do limite é normal (irradiância). A verificação é `P ≤ limite + tolerância`, não `P ≈ limite`. Do contrário, todo inversor seria marcado indisponível ao entardecer.
- **Q depende de folga:** com o inversor em Smax, o Q pedido pode não caber. A verificação é contra `min(Q_pedido, Q_disp)`.
- **Read-back não existe hoje:** os registradores de ajuste (holding) não estão nos blocos de leitura do catálogo (ex.: Sungrow lê 4999–5130 por função 4; Huawei lê 30070/32016…). **Implementar:** leitura dos registradores de ajuste por modelo, ao menos após cada escrita. O ack MQTT já existe, mas só confirma que a TON escreveu, não que o inversor aceitou.

### D9 — Corte de P para gerar Q: incluir o efeito no P importado (§5.4)

**Proposta:**
```
E_Q_exced   = E_Q + Q_med · t_rest − tan_lim · (E_P + P̂ · t_rest)
Q_max_corte = Σ (Qmax_pct · Smax) − Σ Q_disp
```
com `P̂` fixo.

**Proposta para o NexON:** quando a unidade está **importando**, cortar ΔP na UFV **aumenta o P importado** na mesma quantidade. Isso eleva o Q permitido em `tan_lim · ΔP · t_rest`. O corte tem dois efeitos (mais Q disponível no inversor e mais E_P no denominador), e a projeção só considera o primeiro. Resultado: o algoritmo corta mais P do que o necessário. O cálculo do corte mínimo deve resolver os dois efeitos juntos. Quando a unidade está exportando, o segundo efeito não existe.

### D10 — SEP: só entra carga habilitada (§2.6, §7.3)

**Proposta:** `excluida_SEP` é uma exclusão **temporária**, ou seja, toda carga cadastrada participa do SEP por padrão.

**Proposta para o NexON:** inverter o padrão. Uma carga só participa do SEP se for **habilitada explicitamente**, por quem tem permissão, com registro. Uma carga cadastrada sem essa marca **não** é desligada. Segue a regra já adotada no NexON para autorizações: lista vazia ou cadastro incompleto **nega**, nunca libera. `religamento_auto` desligado por padrão, como na proposta.

### D11 — Partida de pivô: não liberar sob subtensão; um só comandante (§8)

**Proposta, passo 9:** limite atingido e V insuficiente → alerta e *"liberar partida imediatamente após o alerta"*.

**Proposta para o NexON:**
- Abaixo de `V_min_partida`, a partida **não é liberada automaticamente**: vai para decisão do operador. Liberar logo após o alerta torna o próprio parâmetro `V_min_partida` sem efeito.
- O NexON já tem a sequência do pivô (`PivoSequenciaService`: bomba → pressão → pivô). A fila de partida da proposta deve ser **uma etapa dessa sequência**, não um segundo caminho de comando para o mesmo pivô.
- A matriz de sensibilidade (§12) é **pré-requisito** desta função, não refinamento: sem ela, "elevar V por degraus" não sabe qual fonte mexe em qual pivô.

### D12 — Banco de capacitores só como atuador quando comandado e confirmado (§2.5, §5.2)

**Proposta:** banco como base da compensação, por estágios, com religamento, manobras/dia e histerese.

**Proposta para o NexON:** o despachante só usa como atuador o banco cujos estágios são **comandados por saída da TON** e têm **confirmação** (estado do contator ou ΔQ medido, como a própria §9 sugere). Banco fixo ou com controlador próprio sem comunicação entra no cálculo só como parte da carga medida.

### D13 — Permissão própria para os parâmetros (§2)

**Proposta:** *"Alteração: analista de operação."*

**Proposta para o NexON:** o papel "analista" não existe no NexON. Criar uma **permissão** (ex.: `controle.configurar`) atribuível aos papéis existentes, com histórico pelo padrão de auditoria de configuração já usado (`configuracao_demanda`). Separar de quem pode **ligar/desligar** o controle (`controle.operar`), que é uma ação de operação.

### D14 — Hora das notificações (§11)

**Proposta:** formato `… — [hh:mm:ss SSU]`.

**Proposta para o NexON:** a SSU não transmite hora absoluta, só os segundos até o fim do intervalo e os bits de posto/reativo (D1). O carimbo vem da **TON (NTP/RTC)**, com o intervalo do medidor como referência (ex.: "intervalo 14:15–14:30, faltando 120 s"). Como toda notificação nova no NexON, o **envio nasce desligado** e só é ativado depois de testado.

### D15 — Observar antes de atuar (§0, §12)

**Proposta:** a fase 1 já inclui FP, demanda de geração, despachante, fallback/BI e feedback. O modo sombra aparece como item de comissionamento (§12).

**Proposta para o NexON:**

| Fase | Conteúdo |
|---|---|
| 0 | Medidor publicando minuto a minuto com os bits de D1; orçamento da hora e dos 15 min **projetado** na tela; alertas de risco. Sem atuação. |
| 1 | Leitura dos atuadores com read-back (D8); portão de qualidade (D3); **modo sombra**: o despachante calcula e registra o que mandaria. |
| 2 | Firmware com setpoint com validade e modo seguro local (D4, D5); atuação de **um** controle por vez, com o modo sombra comparando previsto × efeito. |

O modo sombra deixa de ser comissionamento pontual e vira **etapa obrigatória** antes de cada controle novo.

---

## 3. Onde estamos de acordo

- **Fórmula do orçamento** `X_perm = (limite · T − E_acum) / t_rest` sobre a janela de faturamento (§4.3).
- **Relógio do medidor** como referência de intervalo (§1.1), reforçado por D1.
- **Grandezas de faturamento** por quadrante configuráveis (§1.2).
- **Divisão de Q** proporcional ao Q disponível e curva de capabilidade (§4.1, §4.2).
- **Exportação** mirando Q importado ≈ 0, com margem (§5.3); "hora perdida" sem cortar P (§5.5).
- **Hierarquia** de prioridades com restrições sempre ativas (§3). D6 só ajusta o que a BI faz.
- **Ritmo de escrita:** `degrau_min` e `t_min_ajuste` (§13), que também atendem D4.
- **Registro por hora e log** de atuação (§5.6, §11).

---

## 4. Escrita nos registradores do inversor: o que sabemos

O motivo de D4 é **precaução, não um fato documentado** para esses modelos:

- Ajustes que sobrevivem ao desligamento ficam em memória **não volátil** (EEPROM ou flash), e esse tipo de memória tem **número limitado de gravações** por célula. É uma característica do componente, não de um fabricante.
- Muitos inversores separam registradores de **despacho** (RAM, para escrita frequente) de registradores de **configuração** (memória permanente). Quando o fabricante não diz qual é qual, reescrever a cada minuto é um risco desnecessário.
- Os manuais que temos **não dizem** se os registradores de ajuste gravam em memória permanente:
  - Sungrow, *Communication Protocol of PV Grid-Connected String Inverters* V1.1.66;
  - Huawei, *Solar Inverter Modbus Interface Definitions* V3.0;
  - WEG SIW400G, *SunSpec Modbus* V1.07.

  O manual Sungrow só traz um bit de alarme "abnormal device: EEPROM", que mostra que o inversor tem essa memória, não que o ajuste grava nela.

**Para fechar a questão:**
1. Perguntar a cada fabricante: o registrador X grava em memória permanente? Existe registrador de despacho volátil? Qual o limite de escritas recomendado?
2. Teste de persistência em campo: escrever o ajuste, deixar o inversor desligar à noite e ler pela manhã. Se o valor sumiu, é volátil.

Mesmo que todos sejam voláteis, D4 continua valendo, porque o watchdog local não depende de reescrever o inversor.

---

## 5. O que precisa existir no NexON (derivado das divergências)

| Camada | Item | Origem |
|---|---|---|
| Firmware TON V2 | Publicar `postoReativo` e `fimIntervaloReativo` no minuto da SSU | D1 |
| Firmware TON V2 | Setpoint com validade, último valor escrito por inversor, modo seguro local, retomada com rampa | D4, D5, D6 |
| Firmware TON V2 | Leitura dos registradores de ajuste (read-back) | D8 |
| Catálogo | Base, sinal e modo de cada setpoint por modelo; registradores de read-back | D7, D8 |
| Backend | Motor de controle disparado por evento, com idade máxima por entrada | D2 |
| Backend | Portão de qualidade da medição (por entrada e balanço) | D3 |
| Backend | Acumulado da hora a partir dos minutos e blocos; detecção de lacuna | D1 |
| Backend | Modo sombra com registro de "comando que enviaria" e comparação com o efeito | D15 |
| Backend | Cadastro dos parâmetros com permissão própria e auditoria | D13 |
| Backend | Habilitação explícita de carga no SEP | D10 |
| Backend | Fila de partida integrada à sequência do pivô; bloqueio sob subtensão | D11 |

---

## 6. Revisão de 28/10 — decisões (30/10/2026)

A revisão da proposta incorporou D1–D5, D7 e D9–D15. Abaixo, o que ficou decidido sobre os pontos que restaram. As referências "§x" apontam para as seções da **proposta revisada**.

| # | Tema | Decisão |
|---|---|---|
| R1 | BI manual | **Mantém** P = 100% Pn, FP = 1 (D6 descartada) |
| R2 | Inversor sem watchdog nativo validado | Limite dinâmico **≤ `P_estatico`** |
| R3 | Critério de atuação da demanda | **Média projetada do intervalo de 15 min**, nunca acima do contrato |
| R4 | Perda de comunicação com limite dinâmico alto | Validação no cadastro: `t_validade` e teto de `p_lim` |
| R5 | Confirmação do limite de P | **Resposta Modbus no ack + read-back** do registrador de limite |
| R6 | Validade do setpoint | **TTL relativo** + número de sequência |
| R7 | Minutos reenviados pelo buffer | Só completam o acumulado; **não disparam** o ciclo |
| R8 | `t_validade` | **Por rota** (internet / LoRa) |
| R9 | Medidor sem comunicação | Ciclo para → validade vence → modo seguro (comportamento desejado) |
| R10 | "Analistas" | Permissões atribuídas a papéis existentes |
| R11 | Q no estágio 1 | Q = 0 por padrão; `Q_estatico` **opcional** por UFV |
| R12 | Matriz de sensibilidade | Plano B por degraus aceito |

### R1 — BI manual (§11.3)
Fica como na proposta: manual = bypass da malha, P = 100% Pn, FP = 1. O log da BI (posição, início, fim, energia injetada sem controle) é obrigatório, porque nessa posição a injeção pode passar do contrato.

### R2 — Watchdog nativo do inversor (§11.1, §12)
O estágio 2 do modo seguro roda **na TON**. Se a própria TON morrer, sobra só o watchdog nativo do inversor, que faz um único estágio. Regra: **UFV cujo inversor não tem watchdog nativo configurado e testado nunca recebe limite dinâmico acima de `P_estatico`.**

O que existe hoje por fabricante:

| Fabricante | Watchdog nativo | Observação |
|---|---|---|
| Huawei | No inversor: 42075 habilita, 42072 tempo de detecção (s), 42076/42077 P na falha (kW ×10 ou %), 42079/42083 Q na falha, 42064 religa ao voltar | Manual fala do link com SmartLogger/Dongle. Testar se o polling da TON conta como comunicação e se um dongle presente mantém o link vivo |
| Sungrow (string) | **Não tem no inversor.** Existe no Logger1000/3000 ("Communication Interrupted Protection": IP vigiado, tempo, saída em %) | Só P. Exige que a TON comande pelo Logger (Modbus TCP) |
| SunSpec 704 (padrão) | `WMaxLimPctRvrt`/`RvrtTms`, `VarSetRvrt`/`RvrtTms` | Tipo "renovação": exige reescrita periódica, e o registrador é feito para isso |
| WEG SIW400G | Desconhecido | Declara o modelo 704, mas o layout documentado não segue os offsets padrão. Perguntar ao fabricante |
| Canadian | Desconhecido | Sem mapa Modbus no catálogo |

Teste de comissionamento: desligar a TON de propósito e verificar se o inversor vai ao limite configurado dentro do tempo.

### R3 — Critério de atuação da demanda (§7, §8)
**O valor no medidor da concessionária nunca passa do contrato**, nem de geração nem de carga. O limite de atuação é o **contrato**; a tolerância regulatória não é usada como folga.

O critério é a **média projetada do intervalo**, não o minuto isolado:
```
D_proj [kW] = (E_int · 3600 + P_med · segundos) / 900
              E_int em kWh (acumulado do intervalo); P_med em kW; segundos = tempo até fechar
```
A cada minuto da SSU:
```
se D_proj < contrato: nada a fazer
se D_proj ≥ contrato (ou subindo em direção a ele):
    se ainda dá para esperar 1 minuto:
        esperar o próximo minuto
        se D_proj continuar ≥ contrato ou subindo: solicitação de controle
    senão:
        solicitação de controle no mesmo minuto
solicitação de controle = reduzir geração (demanda de geração) ou SEP (demanda de carga)
```
"Ainda dá para esperar" = mantendo `P_med` por mais `60 s + t_resposta`, o corte máximo disponível ainda fecha o intervalo ≤ contrato:
```
E_int·3600 + P_med·(60 + t_resposta) + P_pos·(segundos − 60 − t_resposta) ≤ contrato · 900
    P_pos = P na fronteira depois do corte máximo disponível
```
Perto do fechamento do intervalo essa condição falha, e o controle atua no mesmo minuto.
`t_resposta` = nuvem → TON → inversor + rampa do inversor (SEP: tempo de parada do motor).

### R4 — Perda de comunicação com limite dinâmico alto (§2.4, §11.1)
O controle pode deixar a UFV gerar **acima** do contrato quando há carga local consumindo. Se a comunicação cai, o inversor fica com o último `p_lim` até a validade vencer. Se nesse período a carga sai, a exportação vai a Σ `p_lim`, e ninguém atua.

Validação no cadastro (pior caso: carga zero logo após a perda):
```
(Σp_lim − alvo)·t_validade + (ΣP_estatico − alvo)·t_estagio2 ≤ (contrato − alvo)·900
    alvo = taxa em que o intervalo vinha (alvo_g / alvo_c)
    o termo do estágio 1 só pesa se ΣP_estatico > alvo
```
A folga vem de `alvo < contrato`. O cadastro calcula o **teto de Σ `p_lim`** para o `t_validade` da rota (R8) ou, ao contrário, o maior `t_validade` para o teto escolhido. A mesma conta, com `t_validade` trocado por `60 s + t_resposta`, cobre a saída de carga com a comunicação normal (R3). Como `t_validade` é maior, a validação da perda de comunicação cobre os dois casos.

### R5 — Confirmação do limite de P (§10)
Com irradiância baixa, `P ≤ p_lim` é verdadeiro mesmo que o inversor tenha recusado o comando. Por isso:
1. O **ack da TON** traz a resposta Modbus da escrita (eco normal ou código de exceção).
2. Depois de cada escrita, a TON **lê de volta o registrador de limite de P** e informa o valor lido. Confirmado = valor lido igual ao escrito.
3. Só então vale a checagem medida `P ≤ p_lim + tolerância`.

Catálogo: cadastrar o registrador de read-back (holding, função 3) do limite de P por modelo. Hoje os blocos de leitura não incluem os registradores de ajuste.

### R6 — Validade do setpoint (§4, §12)
Trocar `valido_ate` (hora absoluta) por **`ttl_s`** contado a partir do recebimento, mais um **número de sequência**. Satélite LoRa não tem NTP (quem carimba a hora é o gateway). O número de sequência descarta mensagem atrasada ou duplicada na malha LoRa.

### R7 — Buffer e reenvio dos minutos da SSU (§1.1, §4)
O minuto reenviado só **completa o acumulado** da hora e do intervalo; **não dispara** o ciclo. Só o minuto corrente dispara. Para isso, cada minuto precisa de identificação (hora da TON + intervalo).

### R8 — `t_validade` por rota (§1.4, §15)
`t_validade` é definido **por rota** (internet ou LoRa, com o número de saltos). Ele precisa ser maior que o atraso de renovação daquela rota e respeitar o teto de R4. Uma UFV atrás de LoRa (validade maior) fica, pela conta de R4, com **teto de `p_lim` menor**.

### R9 — Medidor sem comunicação (§4)
Sem minuto do medidor, o ciclo não roda, a validade não é renovada e as UFVs entram em modo seguro. É o comportamento desejado: sem medidor, o controle está cego. Escrever isso explicitamente na proposta.

### R10 — Permissões (§2, §2.6)
Trocar "analistas de automação e de operação" por permissões (`controle.configurar`, `controle.operar`) atribuídas a papéis existentes. Habilitar carga no SEP usa permissão, com registro.

### R11 — Q no estágio 1 (§11.1)
Padrão Q = 0 (FP = 1). Opcionalmente, um `Q_estatico` por UFV para segurar o FP durante a queda, aplicado só com o inversor gerando e dentro da carta de capabilidade.

### R12 — Matriz de sensibilidade (§9)
Aceito o plano B "por degraus com feedback de V" quando não houver matriz, porque sob subtensão a decisão de partir fica com o operador (§9 passo 9).

