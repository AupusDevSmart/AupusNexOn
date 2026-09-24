# Pextron URP6000 — Preparação de teste de bancada

> Fonte: manual **URP600X v9.68 r01** (`docs/URP 6000_Manuais/`). Bornes das saídas:
> **cap. 2 "Construção", seção 2.2.5, Tabela 2.11** (o cap. 25 só tem figuras/dimensões).
> Comandos Modbus validados contra o cap. 20 (Tabelas 20.6/20.12).
> Modelo no catálogo: `pextron-urp6000`. Gerado 2026-07-22, corrigido 2026-07-23 em bancada.

---

## 1. Comandos (BOs) — VALIDADOS contra o manual

| Comando | coil (bo_map) | No manual (cap. 20) | Tipo |
|---|---|---|---|
| **abrir** (trip) | 52 (0x34) | Comando de abre remoto | **pulso** → S TRIP |
| **fechar** | 51 (0x33) | Comando de fecha remoto | **pulso** → S CLOSE |
| **reset** | 48 (0x30) | Reset remoto | — |

Escrever o coil = **1** pulsa a **saída programada**. FC05. Os três batem com o `bo_map` do catálogo.
Extra: coils **0056–0061** = acionar as entradas lógicas XB1–XB6 por Modbus.

### 🛠️ Comando falhava 99% (timeout) enquanto a LEITURA funcionava — corrigido no gerador

Causa estrutural: no firmware, o caminho de **leitura** fazia o handshake (lê reg 136, que põe o
Serial 1 DNP3 em modo Modbus) e o caminho de **comando** NÃO fazia. Como o auto-reconhecimento
Modbus do URP6000 só vale logo após ler o reg 136, o `writeSingleCoil` do comando caía fora da
janela → timeout → FAIL. Fix em `iot-firmware-generator.v2.js` (`modbus_exec_command`): antes do
write, emitir o mesmo handshake (`readHoldingRegisters(136,2); delay(30);` + drenar eco) quando o
catálogo tem `handshake`, e **retry** na coil (2 tentativas, drenando RX). Gated por
`catalog_device.handshake` → só afeta relés com handshake (URP6000). **Regerar + regravar** a TON
pra valer. Deploy 2026-07-24.

### 🛠️ Comando obedecia só 1x por power-cycle (+ "trip fantasma" no LOCAL→REMOTO) — corrigido

Sintoma: pós-handshake o comando passou a ATUAR, mas só uma vez por religamento do URP; e ao
trocar LOCAL→REMOTO o RL1 disparava sozinho. Causa: as coils 51/52/48 são **pulso, armadas na
borda 0→1** (R/W, seguram o valor). O firmware escrevia 1 e nunca 0 → coil travava em 1 → sem
borda nova nos comandos seguintes, e um 1 pendente disparava ao entrar em REMOTO. Fix no gerador
(`modbus_exec_command`, caso func 0x05): após o write=1 (com retry), `delay(300)` + `writeSingleCoil(coil,false)`
pra **rearmar**. `hold:true` no bo_map desliga (coil de ESTADO, ex: acionar RL direto 40–44).
O pulso físico segue regido pelo T S TIME interno. Deploy 2026-07-24.

### 🎯 Acionar cada RL DIRETO (Tabela 20.6) — o jeito certo de testar BO na bancada

| coil | Saída | Bornes | Semântica |
|---|---|---|---|
| **0040** (0x28) | RL1 | 24–25 | R/W, **1 = relé acionado** |
| **0041** (0x29) | RL2 | 22–23 | idem |
| **0042** (0x2A) | RL3 | 15–19 | idem |
| **0043** (0x2B) | RL4 | 15–18 | idem |
| **0044** (0x2C) | RL5 | 15–17 | idem |
| 0047 (0x2F) | AUTO-CHECK | 15–16 | idem |

Diferente de 51/52, esses **ignoram a matriz de saídas** e são **estado, não pulso**: escreve 1 →
contato fecha e **fica** fechado; escreve 0 → abre. É o que se deve usar pra medir continuidade
(o pulso de 51/52 dura só o `T S TIME` e o multímetro mal registra).

## 2. ⚠️ O PONTO CRÍTICO — programar a saída (cap. 6, Matriz das Saídas)

O coil de abre/fecha **pulsa uma saída que você PRECISA programar** — senão o coil dispara e
**nenhum relé físico atua**. É o análogo do output matrix do 7SR5.

O URP6000 tem **5 relés programáveis: RL1…RL5** (+ auto-check). Na pasta **SAÍDAS** do relé:
- Marcar a coluna do **RLx** desejado na **linha `S TRIP`** → responde ao coil **0052 (abre)**.
- Marcar o **RLx** na **linha `S CLOSE`** → responde ao coil **0051 (fecha)**.
- `S 50/62BF` → saída de falha de disjuntor; linhas `S 50/51/27/59/...` → trip das proteções.

Config Modbus da saída de trip: registro **0142 (0x008E) = "S TRIP"**. Tempo do pulso do abre
remoto: `T S TIME` (área E); do fecha: `TSTIME` (0,10…10,00 s). **Não usar S86E + S TIME juntos.**

⚠️ **NÃO existe "padrão" de qual RL é abre/fecha — e o manual se contradiz.** O Anexo 4A usa
RL1=abre; o cap. 29 fala em "relé de Trip (RL2) ou relé de Close (RL1)". É 100% programável:
vale só o que está gravado no relé. **Leia a matriz, não assuma.**

Na aba SAÍDAS, quem define isso é a **área C** — "Saídas de comando de abertura (TRIP),
fechamento (CLOSE) e remoto (LOCAL)": marca-se a caixa do RLx na coluna do comando (cap. 6,
Tabela 6.1). A **área E** ajusta o tempo máximo de ativação do abre remoto **via Modbus RTU**.

> Verificado em bancada (2026-07-23): neste relé o **TRIP está no RL1** (coil 52 pulsou 24–25),
> e o **CLOSE não estava marcado em nenhum RL** — por isso o coil 51 não movia o 22–23.

### 🚩 `S INV` — lógica invertida (o gotcha que estraga o teste de continuidade)

`S INV` = **"Lógica invertida"** (cap. 0/23; registro **0110 / 0x006E** "Inversão das saídas").
A saída marcada fica **fechada em repouso** e **abre** ao acionar. No teste de bancada isso
inverte tudo: em vez de um **bip curto** no multímetro você tem um **silêncio curto** — e parece
que o comando não funcionou. **Vinha marcado de fábrica no RL2 neste relé.** Desmarcar pra
testar (ou saber que a leitura é ao contrário).

### 🔑 LOCAL × REMOTO — "comando dá sucesso mas não bate" (o gotcha que mais engana)

Cap. 22.1.2, literal: **"Em modo LOCAL o relé bloqueia a programação e ATUAÇÃO na Serial 1
(RS485)."** O write Modbus é aceito (NexON mostra **sucesso**) mas a **saída não atua** — nenhum
clique. **Conectar o app / carregar parâmetro coloca o relé em LOCAL.** Por isso o padrão é:
funciona na 1ª vez (relé em REMOTO), você vai configurar pelo app, ele cai pra LOCAL, e os
comandos seguintes "dão certo" sem bater.

**Fix:** tecla **L/R no frontal** → voltar pra **REMOTO** (o app avisa "atuação em modo local",
Fig. 22.2). **Regra: comando via NexON/Modbus só atua em REMOTO — sempre voltar pra REMOTO
depois de mexer no app.**

Se em REMOTO o *fechar* ainda não bater (mas o abrir sim) → **bloqueio 86** selado pelo trip.
Reset: tecla **R** 3s, botão na aba MEDIÇÕES do app, ou comando **Reset (coil 48)**.

### `S TIME` / `TSTIME` — teto de tempo do CLOSE

Marcar CLOSE num RL faz o app marcar `S TIME` junto: é **correto**. `S TIME` seleciona quais
saídas respeitam o `TSTIME` (0,10…10,00 s), que limita a duração da ativação do comando de
fecha. ⚠️ **`S86E` e `S TIME` são incompatíveis no mesmo relé** (cap. 6) — não marcar os dois.

## 3. Bornes (Figs 25.1 / 25.2) — 28 bornes + bloco de corrente separado

### Alimentação e serial
| Borne | Função |
|---|---|
| **28** | **+A1** alimentação auxiliar |
| **27** | **−A2** alimentação auxiliar |
| **26** | **PE / terra** |
| **12** | **Q / Tx** — RS485 A |
| **13** | **Q̄ / Rx** — RS485 B (invertido) |
| **14** | **M** — malha/shield |

> RS485: par trançado blindado. ⚠️ Fonte capacitiva interna — **aguardar descarga** antes de manusear (cap. 2.2.1).

### Saídas a relé (os BOs a testar)
| Borne | Relé | Obs |
|---|---|---|
| 24–25 | **RL1** | contato seco isolado (2 bornes) |
| 22–23 | **RL2** | contato seco isolado (2 bornes) |
| 15 (comum) + 19 | **RL3** | comum borne 15 |
| 15 (comum) + 18 | **RL4** | comum borne 15 |
| 15 (comum) + 17 | **RL5** | comum borne 15 |
| 15 (comum) + 16 | **AUTO-CHECK** | sinalização (NA por padrão) |

### Entradas lógicas (status do DJ, XB)
| Borne | Função |
|---|---|
| **1** | XB COMUM (comum de XB1–XB5) |
| **2–6** | **XB1, XB2, XB3, XB4, XB5** |
| **20** | **XB6 / BA** (sense da bobina de abertura) |
| **21** | **XBc / V+** (comum do XB6) |

> Níveis (cap. 5): nível 1 = **80–250 Vca / 353 Vcc** (faixa 72–250 V). É entrada **operada por tensão** (como o 7SR5) — não é contato seco.

### Tensões (TPs) e Correntes (TCs)
- **Tensão:** VAs→**7** (referência de sincronismo 25), VA→**8**, VB→**9**, VC→**10**, comum→**11**.
- **Corrente (bloco separado, com lâminas de curto):** IA=X1A/X2A · IB=X1B/X2B · IC=X1C/X2C · ID(neutro/residual)=X1D/X2D. **Polaridade (●) no borne X2x.**

## 4. Status do disjuntor (52a) — para "DJ aberto/fechado" no NexON

- Ligar o contato **52a** do disjuntor numa entrada **XB** e configurá-la como **`E 52`** na
  Matriz das Entradas (cap. 5). Registro Modbus **0162 (0x00A2) = "E 52"** define qual XB.
- No exemplo do manual está no **XB5**, mas é programável — **ler do relé, não assumir**.
- Leitura do estado em tempo real: ponto DNP 6 = "Estado do disjuntor 52" (1 = fechado).

## 5. Trip / supervisão

- **Trip:** mandar `abrir` (coil 0052) OU disparar uma proteção real (a proteção marcada na
  matriz fecha o RLx → BA do disjuntor).
- **Bobina de abertura (BA, ANSI 74, cap. 15):** entrada XB6/XBc (20/21) como `E BA OK`;
  `T B.A. = 0,10…1,00 s`. Falha → IHM "BAopen" + auto-check.
- **Falha de disjuntor (62BF, cap. 16):** linha `S 50/62BF` na matriz; `T62-BF = 0,13…1,00 s`.
- **❗ SEM SOE:** o URP6000 **não tem** buffer de eventos com carimbo de ms (diferente do
  7SR5). Trip é visto pelas flags de proteção (tópico `protecao` no MQTT), sem hora da fonte.

## 5.1 FECHAR (RL2) não bate — árvore de diagnóstico (pesquisa completa 24/jul)

**Descartados quando o ABRIR funciona** (bloqueariam os dois): HLT (cap 18.2 bloqueia trip E
close seriais), modo LOCAL (cap 22.1.2), DIP CH-1, auto-check (bloqueia TODAS as saídas).
**Sincronismo 25 NÃO é gate interno do close** (cap 13.2: a função 25 atua só na saída S25;
a supervisão de fechamento é EXTERNA por fiação — Anexo 4A põe o contato S25 em série com a
bobina, coisa que a bancada não tem). Check Barra Morta idem (só sinalização S CBM).

**Suspeitos em ordem, com verificação:**
1. **S CLOSE não está GRAVADO no relé** (nº 1 disparado). Checkbox no app ≠ relé: "Após
   definição da pasta SAÍDAS, **carregar a programação no relé**" (cap 6 p6.2). A carga falha
   silenciosa por: diálogo de confirmação cancelado, **senha** (área O da CONFIG: "BLOQUEADO:
   não permite programação... bloqueia acesso após 10 minutos"), ou SET não-ativo. O coil 51
   "pulsa saída **programada**" → máscara vazia = sucesso sem nada bater (sem erro!).
   ✔ Confirmar: **"Ler Relé"** e conferir a pasta SAÍDAS LIDA; ou ler reg **0143** (S CLOSE
   efetivo; RL2 = bit valor 2) e comparar com **0142** (S TRIP, tem RL1=1 pois o abrir bate).
2. **Teste direto do RL2** (separa lógica de hardware em 1 min): pasta **MEDIÇÕES** →
   desmarcar "Cíclico" → botão **[Q]** → coluna **ON** do RL2 (a coluna "Saída" mostra o
   estado) — ou coil **0041**=1 via Modbus. Não clicou nem assim → S INV invertendo o repouso
   ou RL2 queimado (medir 22–23).
3. **Trip ativo bloqueia SCLOSE** (cap 29 v6.41: "se uma das proteções que aciona saída S TRIP
   estiver gerando trip o comando SCLOSE é bloqueado" + "prolongador de impulso em STRIP").
   Inclui **27 (subtensão) vendo 0 V na bancada morta** = trip contínuo = close bloqueado
   sempre. ✔ MEDIÇÕES → bandeirolas acesas; reset = **tecla R 3 s** (cap 19 NÃO lista o coil
   48 como reset do 86!). Teste de sequência: power-cycle → FECHAR como 1º comando.
4. **S INV bit RL2** (reg 0110) — fábrica. RL2 energizado em repouso; close DESenergiza.
5. **E 52** (reg 0162): se alguma XB estiver configurada como estado do DJ, XB flutuante =
   "DJ fechado" (convenção 52b dos Anexos) e o relé pode recusar o fecha (documentado p/ tecla
   L, cap 3.1.9 fig 3.11). Reg 0162=0 → sem gate.
6. **S 86E × S TIME incompatíveis** (cap 6 p6.3) — app marca S TIME com o CLOSE; conferir reg
   0111 (S 86E) = 0.

Registros úteis (FC03): 0142 S TRIP · **0143 S CLOSE** · 0144 S TIME · 0110 S INV · 0111 S 86E
· 0162 E 52 · 0779 = E/S físicas num registro (D8=RL1, D9=RL2) · coil 0033 bandeirola 86 ·
coil 0015 senha errada · coils 0040-44 RL direto.

## 6. Roteiro sugerido de bancada

1. **Alimentar** (+A1/−A2 nos bornes 28/27) e ligar o RS485 (12/13/14) no conversor/TON.
2. **Confirmar leitura** — o URP6000 já publica `grandezas` + `protecao` (leitura validada).
3. **Programar a saída** no relé: `S TRIP`→RLx, `S CLOSE`→RLy (senão o comando não atua).
4. **Testar BO** pelo NexON: comando `abrir` → o RLx programado deve pulsar (medir continuidade
   no borne do RLx, ou ver o DJ/carga da bancada atuar).
5. **Testar trip real:** injetar corrente/tensão acima do pickup de uma proteção marcada na
   matriz → o RLx de trip pulsa.
6. **Status do DJ:** fiar 52a numa XB, configurar `E 52`, e ver mudar no NexON.

## 7. Incertos (confirmar no relé físico)

- Bornes 12/13/14 têm rótulos alt. "VM/VD/PR" (provável cor do cabo) — o manual não define.
- Qual XB monitora o 52 depende da parametrização carregada (reg 0162) — não assumir XB5.
- Auto-check NA×NF depende do código de encomenda (etiqueta interna).

## 8. Pendente pro cadastro/gerador

- **Transporte:** definir RS485 direto na TON **ou** via conversor USR (RS485→TCP, como o
  projeto `Teste URP6000 USR` antigo). Isso escolhe o caminho no gerador.
- **bo_outputs:** o URP6000 usa o `bo_map` antigo (coils fixos no catálogo), não o `bo_outputs`
  por-ponto do 7SR5 — verificar se o painel "Configurar I/O" atual envia os comandos dele.
- **Status do DJ:** se quiser aberto/fechado no unifilar, cadastrar o ponto que lê o "Estado do
  disjuntor 52" (via a XB configurada como E 52).
