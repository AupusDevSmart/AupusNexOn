# Controle pelo MED — como funciona o despacho (estado em 20/11/2026)

> Módulo `controle-med` do aupus-nexon-api (`controle-med.calc.ts` = regras puras, `controle-med.service.ts` = ciclo, banco e TON).
> Tela: ficha do Medidor Concessionária → aba **Configuração** (cadastro) e aba **Operação** (card "Controle automático").
> Histórico da especificação e da Fase B: [IOT-CONTROLE-MED-CONCESSIONARIA-IMPLEMENTACAO.md](IOT-CONTROLE-MED-CONCESSIONARIA-IMPLEMENTACAO.md).
> Este documento descreve **como o despacho está hoje**, depois dos ajustes da bancada da Pontal (19/11) e do áudio do CEO (19/11, 18:22).

---

## 1. Visão geral

Um **ciclo por minuto do medidor**. A TON do MED lê a SSU do E750 e publica 1 minuto por minuto. O backend roda o ciclo ~3 s depois e decide **um par P/Q por inversor**. O par vai para a TON de cada UFV, que escreve no inversor.

```
E750 (SSU) → TON-MED → MQTT → backend: portão → decisões (demanda carga, demanda geração, FP) → despacho P/Q → "ctl" → TON-UFV → inversor
```

Cada controle tem um modo próprio:

| Modo | O que faz |
|---|---|
| **Desligado** | Não calcula. |
| **Sombra** | Calcula e registra o que mandaria ("enviaria"), sem mexer no inversor. |
| **Ativo** | Manda o comando. |

Prioridade entre os controles: **demanda de carga > demanda de geração > FP**.

---

## 2. Entradas de cada ciclo

| Entrada | De onde vem |
|---|---|
| Energia e potência do minuto (ativa importada/exportada, reativa indutiva/capacitiva) | SSU: pulsos × Ke × 60. Ke = 0,0003 kWh/pulso × RTC × RTP, cadastrados no nó do medidor no diagrama IoT |
| Acumulado do intervalo de demanda e segundos até fechar | SSU (`data{}` e `seg`) |
| FP da hora (energia ativa e reativa desde a hora cheia) | `ssu_minutos` da hora corrente |
| P de cada inversor | última leitura em `equipamentos_dados` (`power.active_total`). Leitura velha (> 120 s pela internet, > 300 s pelo LoRa) deixa o inversor **indisponível** |
| Cadastro | `controle_med_config`: limites, UFVs, inversores (Pn, Smax, Q máx %, sinal do Q) |

---

## 3. Portão de qualidade

Antes de decidir, o minuto precisa passar. Reprova quando:

- o medidor sinaliza enlace ruim (`sts = 0`);
- o minuto chega com mais de 120 s;
- os erros de leitura da SSU sobem demais;
- faltou minuto no intervalo;
- o **quadrante é incoerente** com o sentido da potência. Isso só é conferido quando há **reativo de verdade** no minuto (≥ 5 % da ativa). Com FP 1 o medidor alterna o quadrante na fronteira e reprovava minuto bom (corrigido 19/11).

Reprovou → **não comanda e não renova**. Depois disso precisa de **3 minutos bons seguidos** para voltar. Nesse meio-tempo a validade do comando vence e as TONs entram em modo seguro (§7).

---

## 4. Decisões

### 4.1 Demanda de geração (exportação)

1. **Projeção do intervalo** = (energia já exportada × 3600 + P do minuto × segundos restantes) ÷ duração do intervalo.
2. **Alvo** = contrato × alvo % (bancada: 100 % → 100 kW).
3. **Gatilho:** projeção ≥ contrato, ou projeção ≥ alvo e subindo.
4. Se ainda dá para esperar 1 minuto (o corte máximo ainda fecharia o intervalo abaixo do contrato), **espera 1 minuto**. Depois de esperar ou cortar uma vez no intervalo, corta direto até o fechamento.
5. **Quanto cortar** = P do minuto − P permitido. P permitido é o que ainda cabe para o intervalo fechar no alvo, contando a energia que já saiu. Não é um percentual fixo: a cada minuto recalcula o que falta.
6. **Liberar:** projeção abaixo e P permitido acima do P atual por mais que a banda (3 %) → devolve a diferença.

### 4.2 Demanda de carga (importação)

É a mesma conta sobre a energia **importada**. O limite é **contrato × (1 + tolerância Aneel)**: com contrato 230 kW e tolerância 5 %, o limite é 241,5 kW. O alvo % vale sobre esse limite. A ação é **liberar geração** que esteja limitada.

### 4.3 Fator de potência (horário)

- **Janela pelo horário cadastrado:** capacitivo de 00h às 06h e indutivo no resto do dia. O posto reativo que a SSU informa fica só registrado. O E750 da bancada marcava capacitivo 24 h, e o controle não agia à tarde (decisão 19/11).
- Na janela, só o reativo **do tipo da janela** conta (indutivo de dia, capacitivo de madrugada).
- **Q permitido no resto da hora** = o que ainda fecha a hora no **FP alvo** (0,93), dado o que já passou na hora.
- **Correção (ΔQ)** = Q medido − Q permitido:

| Situação | Decisão |
|---|---|
| ΔQ > banda | **compensar** |
| ΔQ < −banda e as UFVs estão fornecendo Q | **devolver** |
| ΔQ < −banda e as UFVs não estão fornecendo Q | **nada** ("dentro do alvo") |
| Não dá mais para fechar a hora nem com todo o Q disponível | **hora perdida** (não corta P à toa) |

- Entre um ajuste e o próximo há no mínimo o **intervalo mínimo de ajuste** (bancada: 60 s).

---

## 5. Despacho da potência ativa (P)

**Regra atual (19/11): proporcional, com piso.**

- **Piso de cada inversor** = contrato de geração × (Pn dele ÷ Σ Pn).
  - Bancada: contrato 100 kW e 2 × 100 kW → **piso de 50 kW em cada**.
  - Motivo: exportação = geração − consumo, e consumo ≥ 0. Com a soma dos limites igual ao contrato, a exportação **nunca** passa do contrato, então cortar abaixo do piso nunca é necessário.
- **Corte:** o valor pedido é dividido entre todos os inversores disponíveis, proporcional ao que cada um ainda pode cortar acima do piso. Inversores iguais cortam igual (exemplo: 20 kW → 10 de cada).
  - A base do corte é o que o inversor está entregando: o P medido, nunca acima do limite já dado.
- **Ainda acima do contrato com todos no piso:** não corta mais e registra o alarme *"Medidor acima do contrato com a geração já no piso… verificar a medição ou os inversores"*. Com os inversores obedecendo, isso é fisicamente impossível.
- **Liberação:** proporcional à folga de cada um (Pn − limite), até 100 %.
- **Abaixo do contrato não há limite:** os inversores ficam em 100 %. O teto de segurança R4 (pior caso de queda de comunicação) virou **só aviso no cadastro** e não limita mais o despacho (decisão 19/11). Na queda de comunicação, quem protege é a TON (§7).
- **R2:** UFV sem "watchdog nativo validado" nunca passa do seu P estático.
- **Ordem da UFV:** hoje é só informativa. O corte não usa mais "a mais distante primeiro".

**Exemplo** (bancada, mala parada em 120 kW exportando, fazenda consumindo 80):

| Minuto | Medidor | Ação | INV-01 | INV-11 |
|---|---|---|---|---|
| 1 | 120 | corta ~20–25 | ~88 % | ~88 % |
| 2 | 120 (nada mudou) | corta mais | igual | igual |
| … | … | … | … | … |
| fim | 120 | alarme "no piso" | 50 % | 50 % |

---

## 6. Despacho do reativo (Q)

1. **Q total pedido** (indutivo = fornecer, capacitivo = absorver) é **dividido entre os inversores** proporcional ao Q disponível de cada um.
2. **Reativo tem prioridade** (chave no cadastro, padrão **ligada**, áudio do CEO):
   - O Q disponível é o teto do equipamento: **Smax × Q máx %** (exemplo: 110 kVA × 44 % = 48,4 kvar).
   - Se o Q não cabe na carta com o P atual, o despacho **reduz o limite de P** para **P ≤ √(Smax² − Q²)** e manda **P e Q juntos**. O inversor não faz essa troca sozinho: a 100 % de P ele trava o Q.
   - Exemplo: Smax 110, Q 48,4 → P ≤ 98,8 kW. O card mostra "limite … · reduzido p/ caber o reativo".
   - Esse P é comandado pelo FP mesmo com a demanda de geração desligada. Quando o Q deixa de ser preciso, o P volta para Pn.
   - **Chave desligada:** o Q fica limitado ao que cabe com o P atual; o P manda.
3. **Sinal do percentual** (`sinal_q` por inversor, "fornece com Q+ / Q−" no cadastro):
   - **Sungrow fornece reativo com percentual NEGATIVO** (áudio do CEO). No período indutivo, com FP 0,86 ind., o comando sai como **"−X %"**.
   - Com o sinal errado, o inversor **consome** reativo e piora o FP.
   - Ao adicionar um inversor Sungrow, o cadastro já vem com **Q−**. Outros modelos: pelo campo `sinal_fornece` do `sp_q_pct` no catálogo; sem ele, Q+.
   - Conta: `Q% = Q_kvar ÷ Pn × 100 × sinal_q`.
4. **Degrau mínimo:** só escreve quando P ou Q mudam mais que 3 % de Smax, para poupar a EEPROM do inversor. Redução de P sempre escreve.

---

## 7. Envio e proteção local na TON (Fase B)

- **Um `ctl` por TON por ciclo:** `ctl <seq> <validade s> <idx> <P‰> <Q‰>`. Ele renova a validade mesmo sem mudança.
  - Exemplo: `ctl … 90 1 1000 0` = 100 % de P, Q 0, válido por 90 s.
- A TON confirma com hash do cadastro e resultado por inversor: `1:f` = falhou ao escrever no inversor.
- **Sem renovação** (internet, TON-MED ou portão reprovando):
  - vencida a validade → **estágio 1: P estático** da UFV (cadastro);
  - \+ tempo do estágio 2 → **estágio 2: P = 0** nas UFVs marcadas "zera no estágio 2".
- **Volta:** sobe pela **rampa** (10 %/min) até o pedido do backend.
- **Chave A/M:** em manual, a TON solta o inversor (100 %, Q 0) e avisa.

---

## 8. O que mudou em 19–20/11 (bancada Pontal + áudio do CEO)

| # | Mudança | Por quê |
|---|---|---|
| 1 | Lê o minuto da TON-V2 direta (acumulado em `data{}`) | o ciclo nunca rodava com a TON-MED no WiFi |
| 2 | Corte proporcional + **piso = parte do contrato** + alarme no piso | pedido do usuário; o corte "mais distante primeiro" zerava uma UFV |
| 3 | Sem teto R4 no despacho | abaixo do contrato os inversores ficavam travados em 50–72 % |
| 4 | Sem nova espera de 1 min depois de cortar | alternava "aguardando" e "cortando" |
| 5 | Janela do reativo pelo horário cadastrado | o E750 da bancada dizia capacitivo 24 h |
| 6 | Tolerância Aneel (5 %) no contrato de carga | multa só acima de contrato + 5 % |
| 7 | Portão ignora o quadrante sem reativo | falso alarme → modo seguro à toa |
| 8 | **Reativo prioritário** (reduz P para caber Q) | áudio do CEO |
| 9 | **Sinal do Q% Sungrow = negativo** para fornecer | áudio do CEO: estava consumindo reativo |
| 10 | Card de operação: normal / corrigindo / normalizado + últimos 30 min | ver na tela a condição adversa e a correção |

---

## 9. Pendências

- **Validar em campo o sinal do Sungrow.** Com FP indutivo e o comando negativo, o FP no medidor tem que **subir**. Se descer, inverter para Q+ no cadastro do inversor.
- **R4 como aviso:** decidir se, no campo (intervalo de 15 min), o teto volta a limitar ou fica só no P estático da TON.
- **TON-MED caindo** (4 quedas em 19/11, boot 122): pegar o Serial na próxima.
- **Bancada da Pontal ativa:** projeto IoT, contrato de geração 100 e de carga 230 kW, RTC 100 no nó da SSU. Zerar tudo ao final (backup em `bkp_20261119_pontal_contrato`).
