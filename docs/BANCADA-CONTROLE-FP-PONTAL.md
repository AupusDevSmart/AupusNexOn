# Bancada de testes — controle de FP e demanda (piloto Fazenda Pontal)

> **Para quem é este arquivo:** um assistente que vai desenhar o **esquema visual** desta bancada (diagrama de blocos, ligações e fluxo de dados) e uma **linha do tempo dos testes**. Tudo o que precisa está aqui. Onde um dado não está confirmado, aparece como **(confirmar)**: desenhe com esse rótulo em vez de inventar.
>
> **Data:** 17/11/2026 · Empresa: Aupus Energia · Sistema: NexON (supervisório) + TONs (controladores ESP32 da Aupus)

---

## 1. O que a bancada precisa provar

A Fazenda Pontal (cliente: Rubens; Bonópolis/GO; média tensão 34,5 kV) paga multa por fator de potência (FP) baixo. O plano:

1. Um **medidor da concessionária (Landis+Gyr E750)** mede a fazenda inteira.
2. Uma **TON V2** lê o medidor pela **saída serial do usuário (SSU)**, minuto a minuto, e manda para a nuvem.
3. O **backend NexON** calcula, a cada minuto, quanto **reativo (Q)** os inversores das usinas solares devem fornecer para o FP da hora fechar ≥ 0,92. Também evita que a injeção passe do contrato de geração (990 kW).
4. O comando (setpoint de Q e de limite de P) desce até a **TON da usina**. A usina não tem internet, então o trecho final é por **rádio LoRa**. A TON escreve o setpoint nos **inversores via Modbus RS485**.

A bancada reproduz essa cadeia inteira, trocando o que não cabe no laboratório:
- a **carga real da fazenda** vira a **mala de testes Conprove**, que injeta tensão e corrente no E750;
- os **inversores** viram um **emulador Modbus** num PC.

---

## 2. Equivalência fazenda ↔ bancada

Sugestão visual: um painel lateral com esta tabela, ou duas colunas espelhadas.

| Na Fazenda Pontal | Na bancada |
|---|---|
| Carga da fazenda (pivôs, motores) + geração das UFVs, vistas pelo medidor | **Mala Conprove CE-6003** injetando V e I com ângulo escolhido |
| Medidor E750 na subestação (SEE) | **E750 real** (o mesmo modelo, já validado na bancada em 14/10/2026) |
| TON V2 com SSU na SEE, com internet | **TON400 "MED"** com SSU, ligada no WiFi da bancada |
| Sede com internet, que faz a ponte para o LoRa | **TON2 da casa a ~2 km**: gateway LoRa + internet |
| TON da UFV sem internet (satélite LoRa) | **TON400 "UFV"** no painel da bancada, só LoRa |
| 19 inversores (Sungrow / Canadian) no RS485 | **Emulador Modbus** no PC: 1 ou 2 inversores emulados (modelo Sungrow SG110CX do catálogo) |
| Bancos de capacitores fixos (não comandados) | Fora do teste |
| (futuro) chave Automático/Manual na UFV | **Contatoras + bornes** no painel da TON400 "UFV" |
| Backend NexON (nuvem) | O mesmo (produção, módulo `controle-med`) |

---

## 3. Componentes (nós do diagrama)

Use estes IDs como rótulos curtos dos blocos.

### Zona 1 — Bancada (laboratório)

| ID | Componente | Detalhe para o desenho |
|---|---|---|
| `REDE220` | Fonte / tomada 220 V | Alimenta a mala, o E750 (auxiliar, se precisar), as contatoras e o PC |
| `FONTE5V` | Fonte 5 V | Alimenta as TONs |
| `MALA` | Conprove **CE-6003** | Saídas de **tensão (3 fases + neutro)** e **corrente (3 fases)**, com amplitude e ângulo por fase (confirmar nº de canais e faixas na mala). Operada pelo software da Conprove no notebook dela |
| `E750` | Medidor Landis+Gyr E750 | Entradas de tensão e corrente (medição indireta: na bancada entra o "secundário" direto da mala). Saída **SSU** (serial do usuário, NBR 14522) |
| `TON_MED` | TON400 (TON V2) "MED" | Recebe a **SSU** do E750. Publica por **WiFi/MQTT**: um registro por minuto do medidor e um no fechamento do intervalo |
| `TON_UFV` | TON400 (TON V2) "UFV", **dentro do painel** | Satélite **LoRa** (sem internet). **RS485** para os inversores (emulados). **Saídas (BO)** → bobinas das contatoras. **Entradas (BI)** ← contatos auxiliares / chave |
| `CONT` | Contatoras K1, K2… + bornes | Bobinas nas BOs da TON_UFV; contato auxiliar de volta numa BI (confirmar quais BO/BI estão ligadas) |
| `PC_EMU` | PC com o **emulador Modbus** (página web do NexON) | Emula os inversores: responde leituras e **registra as escritas de setpoint** |
| `VSP` | HW Virtual Serial Port (no PC) | Porta COM virtual (COM16) → TCP |
| `USR` | Conversor USR-TCP232-304 (IP 192.168.1.111) | TCP ↔ RS485. Ligado ao roteador por RJ45. **GND comum com a TON_UFV** |
| `ROTEADOR` | Roteador/modem da bancada | WiFi da TON_MED; rede do PC e do USR; internet |

### Zona 2 — Casa a ~2 km

| ID | Componente | Detalhe |
|---|---|---|
| `TON_GW` | TON2 (gateway) | **LoRa** (fala com a TON_UFV) + **internet/MQTT**. Pergunta o status do satélite periodicamente e repassa os comandos da nuvem |

### Zona 3 — Nuvem

| ID | Componente | Detalhe |
|---|---|---|
| `BROKER` | Broker MQTT | Por onde passam os dados das TONs e os comandos |
| `NEXON` | Backend NexON, módulo **controle-med** | Ciclo por minuto: confere a qualidade da medição, projeta o FP da hora e a demanda do intervalo, decide P/Q por inversor. Modos: **Desligado / Sombra** (só registra) / **Ativo** (manda) |
| `TELA` | NexON web | Ficha do MED → Configuração → Controle automático; card "Controle automático" na Operação |

---

## 4. Ligações (arestas do diagrama)

Sugestão de legenda por tipo de ligação; cada tipo com cor e traço próprios.

| Tipo | Sugestão visual |
|---|---|
| Potência 220 V | linha grossa, preta |
| Sinal de medição (V e I da mala) | linha grossa, laranja; tensão e corrente diferenciadas |
| SSU (serial do medidor) | linha fina, roxa |
| RS485 (A/B + GND) | linha dupla, azul |
| Ethernet/WiFi (IP local) | tracejada, cinza |
| Internet / MQTT | tracejada, verde |
| LoRa (rádio ~2 km) | **raio/zig-zag**, vermelho, com "≈ 2 km" escrito |
| Fio de comando/estado (BO → bobina, auxiliar → BI) | linha fina, marrom |

| De | Para | Tipo | Rótulo na seta |
|---|---|---|---|
| `REDE220` | `MALA`, `CONT`, `PC_EMU`, `E750` (aux.) | Potência | 220 V |
| `FONTE5V` | `TON_MED`, `TON_UFV` | Potência | 5 V |
| `MALA` | `E750` | Medição | V (3F+N) e I (3F) — "carga simulada" |
| `E750` | `TON_MED` | SSU | 1 registro/min: energia por quadrante + tempo até fechar o intervalo |
| `TON_MED` | `ROTEADOR` → `BROKER` | WiFi → MQTT | minuto do medidor |
| `BROKER` | `NEXON` | MQTT | evento "minuto novo" → ciclo de controle |
| `NEXON` | `BROKER` → `TON_GW` | MQTT | setpoint: limite de P (%) e Q (%) por inversor |
| `TON_GW` | `TON_UFV` | LoRa ≈ 2 km | comando de setpoint ⇄ confirmação; pergunta de status a cada 30–60 s |
| `TON_UFV` | `USR` | RS485 | escrita Modbus (FC06/FC16) nos registradores de setpoint; leitura de P/Q |
| `USR` | `ROTEADOR` → `VSP` → `PC_EMU` | Ethernet → COM virtual | o PC "é" o inversor |
| `TON_UFV` | `CONT` | Fio de comando | BO → bobina K1/K2 |
| `CONT` | `TON_UFV` | Fio de estado | contato auxiliar / chave A-M → BI |
| `NEXON` | `TELA` | IP | ficha do MED: projeção, decisão, setpoint enviado |

**Laço que o desenho deve deixar claro:** a mala gera o "problema" (FP ruim) → o E750 mede → TON_MED → nuvem decide → LoRa → TON_UFV → inversor emulado recebe o Q. No teste **D**, o operador fecha o laço **à mão**: ajusta o ângulo da corrente na mala como se os inversores tivessem obedecido. Desenhe essa volta como uma seta pontilhada do `PC_EMU` até a `MALA`, rotulada "operador ajusta a mala".

---

## 5. Os testes (linha do tempo / raias)

Sugestão visual: uma faixa por bloco, de A a F, com o que se faz e o resultado esperado. Os blocos são sequenciais: cada um depende do anterior.

### A · Medição (o controle não atua)
- **Faz:** a mala injeta valores conhecidos nos **4 quadrantes**. Exemplos com tensão nominal V, mesma em fase/ângulo nas 3 fases:
  - FP 1: ângulo 0°;
  - indutivo FP 0,70: corrente atrasada 45,6°;
  - capacitivo FP 0,92: corrente adiantada 23,1°;
  - exportação: ângulo 180°.
- **Confere:** no NexON, por minuto, P, Q, quadrante e FP batem com a conta `P = 3·V·I·cos φ × RTC × RTP`. RTC e RTP são cadastráveis, para a bancada "parecer" a fazenda em kW.
- **Ajuste de bancada:** intervalo do medidor de **5 min** em vez de 15.

### B · Controle em **Sombra** (calcula, registra, não manda)
- Cenários na mala:
  1. FP indutivo ruim (0,70) → o NexON calcula o Q que **pediria**.
  2. Exportação → mira Q importado ≈ 0.
  3. Capacitivo dentro da janela da madrugada (padrão 00h–06h, cadastrável).
  4. Corrente subindo até a **projeção** da demanda de geração passar do contrato → corte de P.
  5. "Hora perdida" (não há mais como fechar FP 0,92) → **não** corta P à toa.
- **Confere:** o card "Controle automático" mostra a decisão de cada ciclo.

### C · Controle **Ativo** pelo LoRa
- O setpoint percorre NEXON → TON_GW → LoRa 2 km → TON_UFV → RS485 → emulador.
- **Confere no log do emulador:**
  - registrador e valor certos, inclusive o **sinal do Q**;
  - tempo do comando até chegar (latência LoRa);
  - **nº de escritas por hora**: só pode escrever quando o valor muda além da faixa morta. Reescrever toda hora gasta a memória EEPROM do inversor real.

### D · Malha fechada manual
- A cada Q enviado, o operador ajusta o ângulo e a corrente na mala como se os inversores tivessem obedecido.
- **Esperado:** o FP converge para ≥ 0,92 e as escritas param, sem oscilar.

### E · Falhas
| Provoca | Esperado (hoje) |
|---|---|
| Corta a internet da casa / desliga a TON_GW / tira a antena | Comando não chega; NexON registra a falha. **O último setpoint fica no inversor** |
| Desliga a TON_MED (sem medição) | Portão de qualidade reprova: o controle **não atua** e mantém o último setpoint |
| Medição absurda (corrente 10× na mala) | Portão reprova ou a decisão fica registrada para análise |
| Volta tudo | Retoma só depois de N ciclos válidos seguidos |

Este bloco se repete depois da **Fase B do firmware**: setpoint com validade e modo seguro na própria TON, que ainda não existem. Vale desenhar como "E (hoje)" e "E (depois da Fase B)".

### F · Contatoras (apoio)
- Comandos de saída pelo LoRa batem as contatoras (BO) e o auxiliar volta na BI: prova o caminho de comando físico.
- Futuro (Fase B): uma contatora ou chave como **Automático/Manual** da UFV. Em Manual, o controle não manda nada para aquela usina.

---

## 6. Pré-requisitos (quadro "antes de começar")

1. Rodar a migração do banco do controle (`2026-11-05_controle_med_concessionaria.sql`) e reiniciar a API.
2. Gravar a TON_MED com SSU (WiFi), a TON_UFV como satélite LoRa com o inversor emulado no RS485, e a TON_GW como gateway.
3. Cadastrar no NexON: o MED (contrato, RTC, RTP, intervalo 5 min), a "UFV" e os inversores (Pn, Smax, Q máximo, sinal do Q).
4. Emulador: abrir no PC com o modelo de inversor e a COM16. Limitação conhecida: ele **registra** as escritas, mas **não muda a leitura** depois delas.
5. GND comum entre o USR e a TON_UFV.

---

## 7. Sugestões para o esquema visual

- **Três zonas** com fundo próprio: Bancada (esquerda), Casa a 2 km (centro, separada por um "≈ 2 km" bem visível), Nuvem (direita ou topo).
- Destaque o **caminho do dado** (mala → E750 → TON_MED → nuvem) e o **caminho do comando** (nuvem → TON_GW → LoRa → TON_UFV → inversor emulado) com duas cores fortes. São os dois sentidos do laço de controle.
- O painel da **tabela de equivalência** (seção 2) ajuda quem não conhece a fazenda.
- Uma segunda figura, opcional: a **linha do tempo A → F** com o "esperado" de cada bloco.
- Identidade Aupus, se quiser: azul-marinho `#16213e` primário, verde `#3fe04f` só como detalhe.
