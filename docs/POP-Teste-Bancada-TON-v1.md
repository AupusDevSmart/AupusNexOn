![Aupus Energia](logo-aupus.png){#logo}

# POP — Teste de Bancada da Placa TON v1

Procedimento Operacional Padrão para conferir uma placa **TON v1** recém-montada, antes de ir a campo.
Esquemático de referência: `SCH-TON-v1a`.

<!-- ================= NOTAS DE MANUTENÇÃO (não saem no PDF) =================
  * Este .md e' a FONTE OFICIAL. O PDF e' gerado a partir dele:
    corrija aqui e regere - NAO edite o PDF.
  * A numeracao do POP acompanha a VERSAO DA PLACA, nao a revisao do texto.
    Este e' o da TON v1; as placas novas terao o seu proprio (...-v2).
  * Ponto-chave do procedimento: BIs, BOs e saidas a transistor NAO usam tensao
    externa (contato seco / loopback TR->BI). Tensao externa so' nas analogicas.
    Confirmado contra o esquematico: +5V -> resistor -> LED do TLP183 -> borne
    (o borne e' o RETORNO, por isso fechar contra GND ativa).

  * COMO GERAR O PDF (a partir de /var/www/service-nexon/docs):
      pandoc -f markdown-implicit_figures POP-Teste-Bancada-TON-v1.md \
        -o /tmp/pop.html --standalone --embed-resources --css=pop-style.css
      wkhtmltopdf --enable-local-file-access \
        --margin-top 16mm --margin-bottom 18mm --margin-left 14mm --margin-right 15mm \
        --footer-left "POP Teste de Bancada - TON v1 . Aupus Energia" \
        --footer-right "[page]/[topage]" --footer-font-size 7 --footer-spacing 5 \
        /tmp/pop.html /var/www/POP-Teste-Bancada-TON-v1.pdf
========================================================================= -->

---

## 1. Objetivo

Validar, em bancada, todos os blocos funcionais da placa TON (alimentação, RTC, entradas
analógicas, SD, Ethernet, relés, entradas digitais, saídas a transistor, PWM, RS485 e LoRa),
com um assistente guiado no firmware de teste — sem precisar abrir a placa nem conhecer o
esquema elétrico.

## 2. O que cada modelo possui

| Bloco | TON1 | TON2 | TON3 | TON4 |
|---|:--:|:--:|:--:|:--:|
| Alimentação, RTC, SD, Ethernet, Analógicas, Transistores, PWM, RS485 | Sim | Sim | Sim | Sim |
| **Entradas digitais (BI)** | Sim | Sim | Sim | Sim |
| **Relés (BO)** | — | — | Sim | Sim |
| Rádio LoRa | — | Sim | — | Sim |

## 3. Materiais e ferramentas

| Item | Para que serve | Obrigatório? |
|---|---|---|
| Cabo USB-C | Gravar o firmware e ver o Serial | Sim |
| Computador com Serial Monitor | Ler o assistente e responder | Sim |
| ~10 fios (jumpers) com ponta | Ligações de loopback | Sim |
| **Mala de teste CONPROVE** (ou fonte regulável) | **Só** para as entradas analógicas (~5 V) | Recomendado |
| Multímetro | Conferência pontual (método alternativo) | Opcional |
| Osciloscópio | Conferir o sinal PWM | Recomendado |
| Resistor de 1 kΩ (ou carga 12 V) | Pull-up do PWM — ver Passo 10 | Opcional |
| Cartão microSD | Teste de gravação | Opcional |
| Cabo de rede (RJ45) + switch | Teste de Ethernet | Opcional |
| **Medidor Modbus (ex.: M160) + fios A/B** | Teste de RS485 | **Sim** |
| 2ª placa TON com LoRa | Teste de rádio (precisa de par) | TON2/TON4 |

## 4. Segurança

- Os testes de relés, entradas e saídas a transistor são a **contato seco / baixíssima tensão** —
  o risco elétrico é baixo, mas **curto-circuito ainda queima trilha**. Confira cada ligação.
- Faça as ligações com a placa **desalimentada** (USB desconectado) e só então ligue o USB.
- Ao usar a **CONPROVE** nas analógicas, ajuste a tensão **antes** de encostar nas pontas e
  **não ultrapasse a faixa da entrada** (confirme a faixa na especificação da placa).
- Não encoste nos bornes com a placa energizada.

## 5. Conectores da placa

Os bornes têm o nome impresso (serigrafia). **Sempre confira o nome impresso antes de ligar.**

> **Terminologia:** neste POP as entradas digitais são chamadas de **BI** (*Binary Input*) e as
> saídas a relé de **BO** (*Binary Output*) — é como o sistema as identifica. Na **serigrafia da
> placa** as entradas podem aparecer como **DIN**: **BI 1 = DIN1 = borne X12-1**, BI 2 = X12-2,
> e assim por diante.

| Conector | O que é | Bornes |
|---|---|---|
| J1 | Alimentação da placa (+5 V) | + e – |
| X1…X6 | Relés 1 a 6 (BO) — TON3/TON4 | COMUM (C), NA, NF |
| X12 | Entradas digitais BI1…BI6 — **todos os modelos** | 6 entradas + 1 COMUM |
| X11 | Saídas a transistor TR1…TR4 (coletor aberto) | TR1…TR4 + GND |
| X8 | Saída PWM (MOSFET) | X8-1, X8-2 |
| X7 | Entradas analógicas AN1 e AN2 | AN1, AN2 + GND |
| X9 | RS485 | A (X9-1), B (X9-2) |
| RJ45 / SD / Antena | Ethernet / cartão SD / LoRa | — |

> Para o loopback do Passo 5 **não é preciso nenhum ponto de tensão**: as entradas são
> testadas por **contato seco**, ou seja, o relé apenas fecha o circuito entre a entrada e o
> comum dela.

## 6. Preparação

Deixe tudo conectado antes de digitar `guia`:

- [ ] Placa **desalimentada** (USB fora) durante as ligações
- [ ] (TON3/TON4) Loopback **relés ↔ entradas** montado (esquema no Passo 5) — **sem fonte externa**
- [ ] Loopback **transistores ↔ entradas** montado (Passo 6) — vale em **todos** os modelos
- [ ] Cartão microSD inserido (se houver)
- [ ] Cabo de rede conectado (se for testar Ethernet)
- [ ] **Medidor Modbus** ligado em A/B, endereço **1**, 9600 — **obrigatório**
- [ ] 2ª placa em `lora eco` (TON2/TON4)
- [ ] CONPROVE **desligada**, ajustada para ~5 V (só para o Passo 3)

Depois:
1. Conecte o USB-C e grave o firmware de teste (**TON-TESTE**).
2. Abra o Serial Monitor em **115200**, final de linha **Nova linha (LF)**.
3. Digite `guia` + ENTER e informe o modelo (1 a 4).
4. A cada passo, confirme com `s`. Use `pular` para pular e `sair` para abortar.

---

## 7. Procedimento passo a passo

### Passo 1 — Alimentação e expansores I2C *(automático)*
**Testa:** se a placa liga (confirma 3,3 V/5 V) e se os expansores de I/O respondem no I2C.
**Ligações:** nenhuma — basta a placa alimentada pelo USB.

### Passo 2 — Relógio de tempo real (RTC) *(automático)*
**Testa:** leitura/escrita do RTC e a sincronização.

### Passo 3 — Cartão SD *(automático, se houver cartão)*

**Testa:** se a placa reconhece o cartão e consegue gravar nele — é onde fica o **log do teste**.
**Você vai precisar:** 1 cartão **microSD**.

**Como fazer:** basta **inserir o cartão microSD no slot da TON**. Não há fiação nem ajuste —
o assistente testa sozinho.

**Esperado:** OK, com a gravação confirmada.
**Sem cartão?** Digite `pular`. O teste continua normalmente, mas o **log final não será gravado**.

### Passo 4 — Ethernet *(rede com fio)*

**Testa:** a interface de rede cabeada — se a placa consegue *link* físico e **obtém um IP**.
**Você vai precisar:** 1 cabo de rede **RJ45** e um **modem/roteador (ou switch)** com DHCP ativo.

**Como ligar:**

1. Encaixe uma ponta do cabo RJ45 no **conector de rede da TON**, até ouvir o clique da trava.
2. Encaixe a outra ponta numa **porta LAN livre do modem/roteador**.
   - Use uma porta **LAN** — **não** a porta **WAN/Internet** do modem.
   - O modem precisa estar **ligado** e entregando IP por **DHCP** (padrão na maioria).
3. Olhe os **LEDs do conector RJ45**: devem acender/piscar **dos dois lados** (placa e modem).
   É o sinal de que existe *link* físico.
4. No assistente, digite `s` + ENTER.

```
   TON (RJ45) ----[ cabo de rede ]---- MODEM / ROTEADOR (porta LAN)
     LED aceso/piscando                  LED da porta aceso/piscando
```

**Esperado:** OK, exibindo o **IP obtido**.
**Se der errado:**
- **LEDs apagados** → cabo mal encaixado, cabo com defeito, ou porta do modem morta.
  Teste outra porta e outro cabo.
- **LED aceso mas sem IP** → o modem pode estar sem DHCP (ou a porta é WAN).
  Confirme que usou uma porta LAN e teste com outro modem/roteador.

### Passo 5 — Relés e Entradas (teste casado BO → BI) — só TON3/TON4
> **Só os relés são exclusivos da TON3/TON4.** As **entradas digitais existem em todos os
> modelos** — na TON1/TON2 teste-as pelo **Passo 5b**.

**Testa:** de uma vez, os 6 relés, as 6 entradas digitais e a fiação.
**Você vai precisar:** ~7–13 fios. **Nenhuma tensão** — é **contato seco** puro.

**A ideia:** o relé apenas **fecha o circuito** entre a entrada e o comum dela (continuidade).
Quando o relé fecha, a BI enxerga. Não há fonte, nem interna nem externa.

**Como ligar (placa desalimentada):**
1. Junte todos os **COMUM dos relés** entre si (uma "corrente" de fios curtos: COM1→COM2→…→COM6).
2. Leve um fio desse conjunto de COMUM até o **COMUM das entradas (X12)**.
3. Ligue a saída **NA** de cada relé na entrada de mesmo número:
   `Relé 1 (NA) → BI1` … `Relé 6 (NA) → BI6`
4. Confira tudo, alimente pelo USB e digite `s` + ENTER.

```
  COM1=COM2=...=COM6 (todos juntos) ---------> COMUM das entradas (X12)
                    rele1 (NA) ---------------> BI1
                    rele2 (NA) ---------------> BI2
                    rele3 (NA) ---------------> BI3
                    rele4 (NA) ---------------> BI4
                    rele5 (NA) ---------------> BI5
                    rele6 (NA) ---------------> BI6

  (contato seco: o rele so' fecha o circuito BI <-> COMUM)
```

**Como roda:** o assistente liga/desliga cada relé e lê a entrada de mesmo número,
automaticamente.
**Esperado:** OK nos 6 pares (relé ligado → entrada = 1; desligado → 0).
**Se um par falhar** (ex.: `RL4 -> BI4 ON:0`): reaperte os fios do par e use `repetir`. Se
persistir, faça o **teste cruzado**: passe o fio do relé 4 para uma entrada que passou (ex.:
BI5). Se a BI5 responder, o problema é a **BI4**; se não, é o **relé 4**.

### Passo 5b — Entradas digitais sem relé — TON1/TON2
**Testa:** as 6 entradas digitais em modelos que não têm relé para acioná-las.
**Você vai precisar:** 1 fio. **Nenhuma tensão** — contato seco.

1. Ligue uma ponta do fio no **COMUM das entradas (X12)**.
2. Encoste a outra ponta em **BI1** e confirme no assistente que a entrada foi a **1**.
3. Solte o fio e confirme que voltou a **0**.
4. Repita para BI2…BI6.

```
  COMUM (X12) ----[ fio ]---- BIn      encostou -> 1   soltou -> 0
```

**Esperado:** cada entrada alterna 1/0 ao encostar e soltar o fio.
**Dica:** o **Passo 6** já exercita 4 entradas via loopback TR→BI; este passo cobre as demais.

### Passo 6 — Saídas a transistor TR1 a TR4
**Testa:** as 4 saídas a transistor (coletor aberto — puxam para o negativo quando ligadas).
**Nenhuma fonte externa.**

**Método principal — loopback TR → BI (automático):**
Ligue cada **TRn** (no X11) na entrada **BIn** (no X12). Diferente do relé (que é contato
seco), a saída a transistor **entrega corrente de base** suficiente para excitar a entrada —
não precisa de resistor nem de fonte. O firmware confere sozinho, igual ao Passo 6.

```
  TR1 (X11) -------------------> BI1 (X12)
  TR2 (X11) -------------------> BI2
  TR3 (X11) -------------------> BI3
  TR4 (X11) -------------------> BI4
```

**Alternativa — multímetro em continuidade** (se não quiser montar o loopback):
1. Multímetro em **continuidade** (bipe).
2. Ponta A em **TRn** (X11), ponta B no **GND**.
3. O assistente liga/desliga: **ligado → bipa** (~0 Ω); **desligado → sem bipe**.

**Esperado:** OK — as 4 saídas alternam.

### Passo 7 — RS485 / Modbus *(endereço 1)*
**Ligações:** `A → X9-1`, `B → X9-2`, GND comum, medidor no **endereço 1**, 9600.
**Esperado:** OK com leituras (tensão, corrente, potência).
**Se der errado:** A/B podem estar invertidos; confira endereço (=1) e velocidade (9600).

### Passo 8 — Rádio LoRa — só TON2/TON4
Precisa de uma 2ª placa TON com LoRa em modo `lora eco`.
**Esperado:** OK com o eco das 5 mensagens e o RSSI.

### Passo 9 — Entradas analógicas AN1 e AN2 — *última etapa, única com fonte externa*

**Testa:** as duas entradas que medem tensão. Faixa de entrada ≈ **0–25 V** (divisor 22 kΩ / 3,3 kΩ).
**Você vai precisar:** mala **CONPROVE** e 2 cabos.

#### Qual saída da CONPROVE usar

Use a **FONTE AUXILIAR DC (VAux / "Fonte DC")** — **não** as saídas V1/V2/V3.

- **V1 / V2 / V3** são canais **geradores de tensão alternada**, feitos para ensaio de proteção
  (amplitude, ângulo, frequência). Não são a via para uma tensão **contínua estável**.
- A **fonte auxiliar DC** é uma saída **contínua e ajustável**, feita para alimentar circuitos —
  é exatamente o que a entrada analógica espera.

#### Como ligar

1. Ajuste a **fonte auxiliar DC em 5,0 V**, mantendo a saída **desabilitada**.
2. Cabo **vermelho (+)** da VAux → borne **AN1** do **X7**.
3. Cabo **preto (–)** da VAux → borne **GND** do **X7**.
4. **Habilite a saída** da fonte auxiliar.
5. No assistente, digite `s` + ENTER. **Anote a leitura.**
6. Quando pedir, passe **só o cabo vermelho** de **AN1** para **AN2** (o preto continua no GND)
   e tecle ENTER.

```
  CONPROVE - FONTE AUXILIAR DC (5,0 V)        PLACA (X7)
      [ + ] vermelho ---------------------> AN1   (depois AN2)
      [ - ] preto -------------------------> GND

  (o cabo preto NAO muda de lugar entre AN1 e AN2)
```

**Esperado:** leitura próxima de **5,0 V** nas duas entradas.
**Se der errado:** confira a polaridade, se a saída da fonte está **habilitada** e se a VAux
está mesmo em 5 V (meça com o multímetro nas pontas antes de encostar na placa).

#### Ajustes no software da CONPROVE (CE-6003 · *Conprove Test Center*)

1. **Conecte o software à mala.** Se não estiver *online*, estabeleça a conexão pelo ícone de
   conexão do CTC.
2. Clique no botão **"Direc Canais"** — abre a janela **"Direcionamento de Canais"**.
3. Nessa janela, clique em **"Configurar"** — é a área de **configuração do hardware e
   controle da fonte auxiliar DC**.
4. No campo **"Fonte Auxiliar"**, ajuste para **5 V**.
5. **Confirme** as solicitações e **retorne** para "Direcionamento de Canais".
6. Só então habilite a saída e faça a leitura.

> A saída fica identificada como **"Aux Vdc"** no painel da mala: terminal **positivo =
> vermelho**, **negativo = preto**.

### Passo 10 — Saída PWM *(osciloscópio)*
**Testa:** a saída PWM (MOSFET de potência).
**Você vai precisar:** osciloscópio + resistor de 1 kΩ — **ou** uma carga de 12 V.

1. Resistor de **1 kΩ** entre **X8-2** e **+12 V** (pull-up).
2. Ponta do osciloscópio em **X8-2**, terra no **GND**.
3. ENTER. O firmware varre: 10% → 25% → 50% → 75% → 90% (2 s cada), ~1 kHz.

**Sem osciloscópio?** Use carga real: LED/lâmpada/buzzer/cooler de 12 V entre o **+12 V** e
**X8-2** (GND no GND). Conforme o duty sobe, o brilho/rotação aumenta — validação a olho.

**Esperado:** onda quadrada de ~1 kHz com largura crescente, ou brilho/rotação subindo.

### Passo 11 — Resumo e aprovação
O assistente mostra o resumo de cada bloco e grava um log no cartão SD (se houver).

---

## 8. Ficha de aprovação

**Nº de série:** ____________  **Modelo:** TON___  **Data:** ____/____/______
**Técnico:** ________________________

| Bloco | OK | Atenção | Falha |
|---|:--:|:--:|:--:|
| 1. Alimentação + I2C | ( ) | ( ) | ( ) |
| 2. Relógio (RTC) | ( ) | ( ) | ( ) |
| 3. Cartão SD | ( ) | ( ) | ( ) |
| 4. Ethernet | ( ) | ( ) | ( ) |
| 5. Relés + Entradas (BO→BI) [TON3/4] | ( ) | ( ) | ( ) |
| 5b. Entradas digitais [TON1/2] | ( ) | ( ) | ( ) |
| 6. Saídas a transistor TR1-4 | ( ) | ( ) | ( ) |
| 7. RS485 (ID 1) — obrigatório | ( ) | ( ) | ( ) |
| 8. LoRa [TON2/4] | ( ) | ( ) | ( ) |
| 9. Entradas analógicas AN1/AN2 | ( ) | ( ) | ( ) |
| 10. PWM | ( ) | ( ) | ( ) |

**Resultado:** ( ) APROVADA ( ) APROVADA COM RESSALVA ( ) REPROVADA

**Assinatura:** ____________________________
