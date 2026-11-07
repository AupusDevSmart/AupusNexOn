# Controle de FP pela medição da concessionária — análise da proposta e piloto Fazenda Pontal

> **Status:** proposta para discussão (27/10/2026). Nada implementado.
> **Fontes analisadas:**
> - `arquivos/nexon-controle-med-concessionaria.md` — "NexON — Algoritmos de Controle (Backend · MED Concessionária)" (aqui: **a proposta**).
> - `arquivos/rubens_fazenda_pontal_dossie.md` — dossiê da Fazenda Pontal, compilado em 27/10/2026 (aqui: **o dossiê**).
>
> **Relacionados:** [IOT-SSU-QUADRANTES-FP-CALCULOS.md](IOT-SSU-QUADRANTES-FP-CALCULOS.md) ·
> [IOT-SSU-NBR14522-TON-V2-INTEGRACAO.md](IOT-SSU-NBR14522-TON-V2-INTEGRACAO.md) ·
> [IOT-SUNGROW-LOGGER-TCP.md](IOT-SUNGROW-LOGGER-TCP.md) · [IOT-PIVO-BOMBEAMENTO.md](IOT-PIVO-BOMBEAMENTO.md)

---

## 1. Resumo

- **O objetivo do piloto é o fator de potência da fazenda inteira**, medido no E750 da subestação de 34,5 kV. Os bancos de capacitores existentes continuam; os inversores das duas UFVs passam a fornecer reativo para fechar a conta. A multa de reativo (UFER) custou **R$ 130,3 mil** em 12 meses, 57% em jun/jul.
- A **matemática da proposta está certa**: o orçamento `(limite·T − E_acumulada) / t_restante` sobre a janela de faturamento, o relógio do medidor e o modo sombra. Vamos usá-la.
- A **malha de FP no backend é adequada** para a Fazenda Pontal. O medidor fica a 12,8 km das usinas, então o dado passa pela nuvem de qualquer jeito. A janela é horária, e uma falha custa multa, não ultrapassagem.
- **Discordamos** de sete pontos (seção 6). Os mais importantes:
  - o fallback "P = 0";
  - o reenvio periódico de setpoint ao inversor (desgaste de EEPROM, seção 7);
  - o limite de injeção dependendo da nuvem, o que a proposta comercial proíbe;
  - SEP e partida de pivô no escopo.
- **Pré-requisitos que travam:**
  - TON V2 com SSU no E750, com a saída livre e a anuência da Equatorial;
  - mapa Modbus dos Canadian (9 dos 19 inversores);
  - confirmar com cada fabricante se o registrador de setpoint é volátil;
  - memória de massa para saber se a multa de reativo é **indutiva ou capacitiva**.

---

## 2. Por que o FP da fazenda piora com a UFV

O medidor da concessionária enxerga o **líquido** da fazenda. A UFV em FP 1 entrega só potência ativa (P) dentro da fazenda. Com isso, o medidor passa a ver **menos P importado e o mesmo Q** dos motores:

```
Sem UFV:  carga 1.200 kW / 500 kvar          → FP = 1200 / √(1200² + 500²) = 0,92
Com UFV:  UFV entrega 900 kW em FP 1
          medidor vê 300 kW / 500 kvar        → FP = 300 / √(300² + 500²)  = 0,51

Para FP 0,92 com 300 kW importados:  Q ≤ 300 × tan(acos 0,92) = 300 × 0,426 = 128 kvar
→ os inversores precisam fornecer ≈ 372 kvar
```

Ligar a segunda UFV (hoje parada por causa do limite de geração de 990 kW) **sem controle de reativo piora a multa**. O reativo dos inversores resolve exatamente isso. A potência dos inversores é limitada (`Q_disp = √(Smax² − P²)`): com a usina a pleno sol, cada kvar extra custa P.

---

## 3. A Fazenda Pontal no que importa para o controle

| Item | Dado (dossiê) | Consequência |
|---|---|---|
| Fornecimento | 34,5 kV, A3a rural, horária verde, **medição única** | Um só ponto de controle: o E750 da SEE |
| Medidor | Landis+Gyr **E750** (A2E3), medição indireta | É o mesmo modelo validado na bancada com a TON V2 via SSU (14/10). Ke = 0,3 Wh/pulso × RTC × RTP |
| Contrato | 2.000 kW carga · **990 kW geração** | Limite de injeção é trava de segurança |
| Geração | UFV Rio Crixás: 8 Canadian CSI-110K + 1 Sungrow SG110CX · UFV Caranhas: 10 Sungrow (SG110CX, SG110CX-P2, SG75CX-P2) | ~2,1 MVA em inversores; reativo de até ~1.300 kvar em FP 0,8 |
| Trafo Caranhas | **750 kVA** (doc) para ~1.030 kVA de inversores | Limita P **e** Q da Caranhas; confirmar placa |
| Cargas | 20 pivôs, 49 motores (6.270 cv), confinamento. Partida por SSW07 (sem módulo de comunicação) e CFW11 | Cargas não são atuador no piloto |
| Bancos de capacitores | 20 kvar 380 V por painel SSW07; 35 kvar no pivô 13 | **Não manobráveis** pelo NexON. Precisamos saber se entram e saem com o motor ou se ficam ligados direto (seção 8) |
| Distâncias | SEE a 12,8 km da sede; UFVs a 2,3–2,9 km; 5 pontos sem internet | Medidor → usinas só pela nuvem; LoRa multi-salto (já existe no gerador TON V2) leva o dado dos pontos sem internet |
| Diagnóstico da fatura | Demanda R$ 787 mil · UFER R$ 130 mil · ultrapassagem R$ 42 mil | UFER é o alvo deste controle; demanda contratada é renegociação (fora do NexON) |

---

## 4. Arquitetura proposta

```
                                     NUVEM (backend NexON) — lento, otimiza
  E750 ──SSU──> TON V2 (SEE) ──MQTT──>  ┌──────────────────────────────────────────┐
  (minuto a minuto: E por quadrante,    │ orçamento da hora (FP) e dos 15 min (P)  │
   t_restante do intervalo)             │ → Q pedido por usina (divisão por Q_disp)│
                                        │ → cota de injeção por usina (Σ ≤ 990 kW) │
                                        └───────────────┬──────────────────────────┘
                                setpoint com validade   │   (só envia quando muda)
                         ┌──────────────────────────────┴───────────────┐
                         ▼                                              ▼
          TON V2 UFV Rio Crixás  — rápido, garante       TON V2 UFV Caranhas
          · aplica Q pedido nos inversores               · idem
          · injeção líquida do local ≤ cota              · idem
            (geração − bombas do QGBT, PMs locais)
          · watchdog: setpoint vencido → modo seguro
```

- **FP:** malha no backend, como na proposta. O ciclo de 60 s sobra para uma janela de 1 h.
- **Injeção:** **cota por usina, garantida localmente pela TON**. Como Σ cotas ≤ 990 kW, a injeção nunca ultrapassa, mesmo sem internet. A nuvem só realoca as cotas, por exemplo quando as bombas de um local param. Isso atende a exigência da proposta comercial: *"o controle de injeção não pode depender da nuvem"*.
- **Watchdog na TON, não no backend.** O setpoint chega com validade. Se vencer, a própria TON leva os inversores ao modo seguro (seção 6, item 3). O inversor só recebe escrita quando o valor muda.

---

## 5. Onde concordamos com a proposta

| Ponto | Comentário |
|---|---|
| Orçamento `X_perm = (limite·T − E_acum) / t_rest` | Correto: a concessionária fatura a média integrada, não o instantâneo |
| Relógio = medidor (SSU) | Já é assim na TON V2 (`seg`, `fim`) |
| Grandezas de faturamento por quadrante configuráveis | Necessário: o A-966 já mostrou convenção de reativo diferente da suposta |
| Divisão de Q proporcional ao Q disponível (4.2) e curva de capabilidade (4.1) | Ok |
| Horas de exportação mirando Q importado ≈ 0 (5.3) | Ok, é o caso dia de sol + bomba parada |
| "Hora perdida" sem cortar P (5.5) | Ok |
| Confirmação do comando com releitura, redistribuição e alarme (9) | Ok |
| Modo sombra antes de atuar (12) | Ok, e **obrigatório por semanas** |
| Formato único de notificação, agrupamento, escalonamento (11) | Ok, reaproveitando as regras de notificação existentes |
| Histórico de versões dos parâmetros | Ok; já temos o padrão de auditoria de configuração |

---

## 6. Pontos de discordância

| # | Tema | Proposta | Nossa posição | Motivo |
|---|---|---|---|---|
| 1 | **Fase 1** | FP + demanda de geração + despachante completo + fallback/BI | Fase 1 = **observar** (sem atuar); depois FP; injeção como trava local | Ainda não há medição em tempo real no campo. O despachante só vale depois de validada a leitura |
| 2 | **Onde roda o limite de injeção** | Backend | **TON local**, por cota | A proposta comercial exige independência da nuvem; o medidor fica a 12,8 km |
| 3 | **Fallback sem comunicação** | Inversores → **P = 0** e FP = 1; retomada manual na usina | **Manter a cota de P** (segura por construção) e voltar **Q a um valor seguro** (FP 1 ou o último Q válido, a decidir) | P = 0 desliga a usina por uma queda de internet de 3 min, exigindo ida ao local |
| 4 | **Heartbeat** | Backend **reenvia o setpoint a cada ciclo** (60 s) mesmo sem mudança | Heartbeat é **MQTT para a TON**; o **inversor só é escrito quando o valor muda** além da faixa morta | Escrita periódica pode destruir a EEPROM dos inversores (seção 7) |
| 5 | **Registradores** | Supõe "registradores voláteis" | **Confirmar com cada fabricante** e testar persistência | Os manuais Sungrow, Huawei e WEG que temos não dizem; o Canadian nem tem mapa |
| 6 | **Validação da medição** | Compara o acumulado da TON com o do backend | Isso **mais plausibilidade cruzada**: SSU × soma dos 15 PMs × inversores; P × √3·V·I; dado recente | Um PM com escala errada (caso real: Pivô 2 da Chimarrão, 10× desde julho) levaria a malha a atuar errado. Medição implausível **bloqueia** a atuação |
| 7 | **Banco de capacitores** | Atuador por estágio (manobras, religamento, histerese) | **Fora como atuador** no piloto; primeiro **levantar** como estão ligados | São fixos por painel, sem manobra pelo NexON |
| 8 | **Corte de P para gerar Q** (5.4) | Pelo prazo da hora | Pelo prazo **e** pelo custo: energia perdida × UFER evitada | Tarifas jul/26: UFER R$ 0,3966/kvarh × energia HFP R$ 0,5548/kWh. Nem sempre compensa |
| 9 | **Demanda de carga + SEP** (fase 2) | Desliga cargas por prioridade | **Fora do piloto**; se um dia entrar, só com **ativação explícita por carga** | Maior medição 1.830 de 2.000 kW contratados; SSW07 sem comunicação; parar irrigação tem custo agronômico |
| 10 | **Partida de pivô / suporte de tensão** (fase 3) | Eleva V pela UFV antes da partida | **Fora**; é P&D | Já usam SSW07 e CFW11; exige matriz de sensibilidade medida e mesmo alimentador |
| 11 | **Janela capacitiva** | "Vem das configurações do NexON" | **Não existe hoje**; precisa ser criada | A classificação horária atual tem ponta, fora ponta e reservado, não a janela capacitiva |
| 12 | **Hierarquia do despachante** | 5 níveis (BI, carga, geração, pivô, FP) | No piloto: **BI > trava de injeção (local) > FP** | Os níveis 2 e 4 saem do escopo |

---

## 7. EEPROM do inversor — por que a escrita importa

O inversor guarda as configurações (limite de potência, FP, modo de reativo, endereço Modbus) em **memória não volátil** (EEPROM ou flash), para não perdê-las ao desligar à noite. **Cada célula aguenta um número limitado de gravações**, tipicamente de 10 mil a 1 milhão, conforme o chip. Quando se esgota, aparecem configuração corrompida, alarme ("abnormal device: EEPROM", bit previsto no próprio manual Modbus da Sungrow) ou troca da placa de controle. A garantia é discutível, porque foi uso fora do previsto.

| Estratégia de escrita | Gravações/dia por inversor | 100 mil gravações acabam em |
|---|---|---|
| Reenvio a cada 60 s (proposta, item 13) | 1.440 | ~70 dias |
| Mínimo de 180 s entre ajustes, valor sempre mudando | até 480 | ~7 meses |
| Só quando muda além da faixa morta (degrau ≥ 3% Smax) | dezenas | anos |

Multiplicar por 19 inversores.

**O que não sabemos:** muitos fabricantes têm dois tipos de registrador, de **despacho** (RAM, feito para controlador de usina escrever toda hora) e de **configuração** (EEPROM). Os manuais que temos não dizem qual é qual:
- **Sungrow** (TI_20240311 V1.1.66): limite 5007/5008, reativo 5036/5037, Night SVG 5035;
- **Huawei** (Modbus Interface Definitions V3.0): 40122/40123/40125;
- **WEG SIW400G** (SunSpec V1.07): 40300/40301 e 40302/40303. O SunSpec prevê tempo de reversão no próprio inversor, um watchdog nativo, mas o mapa da WEG não traz o campo.

**Como resolver:**
1. Perguntar a cada fabricante (seção 10).
2. Testar a persistência: gravar, esperar o inversor desligar à noite e ler de manhã. Se o valor sumiu, é volátil. Esse teste já estava pendente com o Huawei da UBS (26/10).
3. Por desenho: faixa morta, tempo mínimo entre escritas, watchdog na TON e **nunca** reescrita periódica no inversor.
4. Avaliar o **Sungrow Logger1000/COM100** como interface de despacho da Caranhas: ele é feito para controle de usina e escreve nos inversores do jeito previsto pelo fabricante.

---

## 8. O que decide a estratégia de reativo: indutivo ou capacitivo

A multa de reativo é cobrada por hora, com FP de referência 0,92:
- **indutivo** no período diurno e noturno de carga;
- **capacitivo** nas 6 h de carga leve definidas pela distribuidora (tipicamente a madrugada).

Os capacitores de 20 kvar ficam dentro dos painéis das SSW07:

| Se os capacitores... | Então na madrugada... | Atuação dos inversores |
|---|---|---|
| entram e saem **com o motor** | só há Q quando a bomba roda | **Injetar Q** de dia (UFV gerando) e com bomba ligada |
| ficam **ligados direto** | sobra **capacitivo** com bomba parada | **Absorver Q à noite** (Night SVG: SG110CX, SG75CX, -P2; Canadian, desconhecido) |

O horário reservado (21h30–06h, ~40% do consumo) concentra bombeamento na madrugada. A **memória de massa de 12 meses** (15 min, por quadrante) responde qual é o caso; sem ela, não dá para fechar a estratégia.

---

## 9. Fases do piloto

| Fase | Entrega | Atua? | Depende de |
|---|---|---|---|
| **0 · Observar** | TON V2 + SSU no E750. Painel: FP da hora e demanda de 15 min **projetados**, orçamento restante, alertas "hora em risco" / "hora perdida". Validar contra fatura e memória de massa | Não | E750 (saída SSU livre, RTC/RTP, anuência) · janela capacitiva no NexON |
| **1 · Inversores observados** | Leitura dos 19 inversores e dos 15 PMs; plausibilidade cruzada; malha de FP **em modo sombra** (calcula e registra o Q que mandaria) | Não | Mapa Canadian · forma de leitura sem 2º mestre no RS485 (sticks WiNet-S/Canadian) |
| **2 · Trava de injeção local** | Cota por usina na TON, fixa em 990/0 (igual a hoje) | Sim (P) | Fase 1 · registrador de limite confirmado volátil, ou escrita mínima |
| **3 · FP via Q dos inversores** | Malha de FP atuando: injeção diurna e, se o diagnóstico pedir, absorção noturna | Sim (Q) | Diagnóstico da seção 8 · semanas de sombra sem divergência |
| **4 · Cota dinâmica** | Nuvem realoca as cotas pelo E750; as duas UFVs operam | Sim (P) | Fase 2 estável |

Funcionalidades novas de firmware (gerador TON V2):
- setpoint com validade e watchdog local;
- malha local de injeção (PM do local → limite % dos inversores);
- faixa morta e tempo mínimo de escrita por inversor.

Hoje a TON só executa comandos pontuais vindos da nuvem.

---

## 10. Pendências

**Campo (fotos e medições)**
- E750: tampa de bornes aberta (a saída SSU está livre?), RTC e RTP da medição indireta, equipamento de terceiro na porta óptica.
- Painéis SSW07: o capacitor está antes ou depois do contator (entra com o motor?).
- Placa do trafo da Caranhas (750 kVA?) e dos trafos do QGBT Rio Crixás.
- Bornes RS485 de um inversor de cada modelo; o que os sticks WiNet-S e Canadian fazem no barramento.

**Cliente**
- Memória de massa de 12 meses pela Equatorial (15 min, quatro quadrantes).
- Anuência da Equatorial para ligar na saída SSU.
- Decisão sobre o horário reservado: a mudança para 06h–16h30 muda o perfil de reativo.

**Fabricantes**
- **Sungrow** (SG110CX, SG110CX-P2, SG75CX-P2):
  - os registradores 5007/5008 (limite) e 5036/5037 (reativo) gravam em memória não volátil?
  - há registradores de despacho voláteis?
  - qual o limite de escritas recomendado?
  - o Night SVG (5035) funciona com o Q percentual em 5037 ou exige outra configuração?
  - o Logger1000/COM100 é a interface recomendada para despacho frequente?
- **Canadian** (CSI-110K-T400GL02-E e CSI-110K-T4001B-E): mapa Modbus completo, mais as mesmas perguntas de memória e de Q noturno.

**NexON**
- Janela capacitiva por concessionária na classificação horária.
- Cadastro de parâmetros do controle (seção 2 da proposta, reduzida ao escopo do piloto) com auditoria.
- Painel de orçamento (fase 0).
