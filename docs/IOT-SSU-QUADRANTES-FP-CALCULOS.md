# SSU (NBR 14522) — quadrantes, fator de potência e cálculos

> Referência para quem lê os dados do medidor de concessionária pela SSU — **TON-V2**
> (entrada SU+) ou **gateway A-966** — no NexON. Inclui as contas de seno e cosseno, o
> significado de cada campo do JSON e os resultados da bancada de 14/10/2026
> (TON4V2 + Landis+Gyr E750 + mala Conprove).
> Relacionados: [IOT-TON-V2-SSU-TESTE-BANCADA-2026-10-14.md](IOT-TON-V2-SSU-TESTE-BANCADA-2026-10-14.md) ·
> [IOT-TON-V2-SSU-R47-PULLUP.md](IOT-TON-V2-SSU-R47-PULLUP.md) ·
> [IOT-SSU-NBR14522-TON-V2-INTEGRACAO.md](IOT-SSU-NBR14522-TON-V2-INTEGRACAO.md)

---

## 1. Grandezas básicas

O medidor compara a **corrente** com a **tensão** e mede o ângulo **φ** entre elas.
Neste documento a tensão é a referência (0°) e **φ é o ângulo da corrente**, como se ajusta
na mala de teste.

```
S  = V × I                    potência aparente (VA)
P  = V × I × cos φ            potência ativa    (W)   — faz trabalho
Q  = −V × I × sen φ           potência reativa  (var) — vai e volta, não faz trabalho
FP = |P| ÷ S = |cos φ|        fator de potência
S² = P² + Q²                  (triângulo de potências)
```

O sinal de menos em Q vem da convenção usada pelos medidores: **corrente atrasada (φ < 0)
dá Q positivo (indutivo)** e **corrente adiantada (φ > 0) dá Q negativo (capacitivo)**.
(É o mesmo que Q = V·I·sen(θ_tensão − θ_corrente).)

### Valores de seno e cosseno usados

| φ | cos φ | sen φ | Observação |
|---|---|---|---|
| 0° | 1,000 | 0,000 | corrente em fase |
| ±25° | 0,906 | ±0,423 | |
| ±30° | **0,866** | **±0,500** | ângulo dos testes |
| ±60° | 0,500 | ±0,866 | |
| ±90° | 0,000 | ±1,000 | só reativo |
| ±150° | **−0,866** | **±0,500** | injeção com reativo |
| 180° | −1,000 | 0,000 | injeção pura |

Identidades úteis: cos(−φ) = cos φ · sen(−φ) = −sen φ · cos(180° − 30°) = −cos 30° ·
sen(180° − 30°) = sen 30° · tg φ = sen φ ÷ cos φ (tg 30° = 0,577).

---

## 2. O que cada sinal significa

### Sinal de P → consumindo ou injetando

| P | Fluxo | Ângulo da corrente | Campo de energia ativa |
|---|---|---|---|
| **P > 0** | a instalação **consome** da rede | −90° < φ < +90° | **`phf`** |
| **P < 0** | a instalação **injeta** na rede (geração) | 90° < \|φ\| ≤ 180° | **`phr`** |

Girar a corrente além de 90° na mala equivale a inverter o fluxo: o medidor passa a ver
geração.

### Sinal de Q → indutivo ou capacitivo

| Corrente (em relação à tensão) | Q | Comportamento | Exemplos |
|---|---|---|---|
| **atrasada** | **Q > 0** | **indutivo** | motores, transformadores, reatores |
| **adiantada** | **Q < 0** | **capacitivo** | banco de capacitor, cabos longos, alguns inversores |

### Na injeção (|φ| > 90°): olhe a corrente que SAI

Acima de 90° a energia está saindo. É mais intuitivo olhar a **corrente invertida**
(a que sai da instalação, 180° de diferença):

| Ângulo na mala | Em relação à tensão | Corrente que sai (φ − 180°) |
|---|---|---|
| **+150°** | adiantada 150° | **−30° → atrasada 30°** |
| **−150°** | atrasada 150° | **+30° → adiantada 30°** |

---

## 3. Os 4 quadrantes

```
                         Q > 0
                           ▲
     Q2  INJETA            │            Q1  CONSOME
     φ = −90° … −180°      │            φ = 0° … −90°
     P < 0, Q > 0          │            P > 0, Q > 0  (indutivo)
     phr + qhfc            │            phf + qhfi
 ◄─────────────────────────┼─────────────────────────►  P
   P < 0                   │                   P > 0
     Q3  INJETA            │            Q4  CONSOME
     φ = +90° … +180°      │            φ = 0° … +90°
     P < 0, Q < 0          │            P > 0, Q < 0  (capacitivo)
     phr + qhri            │            phf + qhrc
                           ▼
                         Q < 0
```

| Quadrante | Ângulo φ | P | Q | Natureza (IEC, visão do consumidor) |
|---|---|---|---|---|
| **Q1** | 0° a −90° | + | + | **indutivo** |
| **Q2** | −90° a −180° | − | + | **capacitivo** |
| **Q3** | +90° a +180° | − | − | **indutivo** |
| **Q4** | 0° a +90° | + | − | **capacitivo** |

**Quem decide o quadrante é o medidor**, não a TON: ele informa no bloco da SSU
(bits 4-5 do octeto 3), e a TON só traduz e soma os pulsos no campo certo.

---

## 4. O bloco da SSU (formato estendido, 9 octetos)

O medidor envia um bloco por segundo. A tradução do quadrante **não é sequencial**
(spec §7 — calcular "valor + 1" erra dois casos em silêncio):

| Bits 4-5 do octeto 3 | Quadrante |
|---|---|
| 00 | Q1 |
| 01 | **Q4** |
| 10 | Q2 |
| 11 | Q3 |

| Octetos | Conteúdo | No JSON |
|---|---|---|
| 1 + bits 0-3 do 2 | segundos que faltam para fechar o intervalo de demanda (contagem regressiva) | `seg` |
| 2, bit 4 | reposição de fatura (alterna a cada fatura) | — (uso interno) |
| 2, bit 5 | fim do intervalo de reativo (alterna) | — (alarme de sanidade) |
| 2, bits 6-7 | posto reativo (nenhum / capacitivo / indutivo / ambos) | — |
| 3, bits 0-1 | posto horário (ponta / fora de ponta / reservado) | `posto` |
| 3, bits 4-5 | **quadrante** (tabela acima) | `q` |
| 3, bit 7 | tarifação de reativo ativa | — |
| 4-5 | contador de pulsos de energia **ativa** (16 bits) | somado em `phf` ou `phr` |
| 6-7 | contador de pulsos de energia **reativa** (16 bits) | somado em `qhfi`/`qhfc`/`qhri`/`qhrc` |
| 8-9 | CRC16 (X¹⁶+X¹⁵+X²+1) | conferido; bloco inválido conta em `ssu_err` |

Os 9 bytes crus do último bloco vão em `frame` (ex.: `29 61 90 10 00 09 00 72 3e` →
octeto 3 = `0x90` → bits 4-5 = `01` → **Q4**).

---

## 5. Campos de energia no JSON

Valores em **pulsos** (não em kWh). Convenção de nomes herdada do gateway A-966, usada
igual pela TON para o NexON tratar os dois da mesma forma.

| Campo | Grandeza | Quando incrementa |
|---|---|---|
| `phf` | energia **ativa consumida** | Q1 e Q4 (P > 0) |
| `phr` | energia **ativa injetada** | Q2 e Q3 (P < 0) |
| `qhfi` | reativo do **Q1** (consome, indutivo) | Q1 |
| `qhfc` | reativo do **Q2** (injeta, capacitivo) | Q2 |
| `qhri` | reativo do **Q3** (injeta, indutivo) | Q3 |
| `qhrc` | reativo do **Q4** (consome, capacitivo) | Q4 |

Somas usadas pelo NexON:
```
reativo indutivo   = qhfi + qhri     (Q1 + Q3)
reativo capacitivo = qhfc + qhrc     (Q2 + Q4)
```

`q` no bloco é o quadrante do **último** segundo do intervalo. A energia de cada quadrante
já vem separada nos campos acima — é ela que vale para a conta.

> **Nomenclatura em aberto:** outra referência associa Q4→`qhfc`, Q2→`qhri`, Q3→`qhrc`.
> Para Q4 dá no mesmo (os dois nomes são capacitivos). Para Q2/Q3 ela trocaria indutivo com
> capacitivo na injeção. A confirmação definitiva vem dos testes de ±150° (seção 10).

---

## 6. Do pulso à energia: o Ke

```
Ke (kWh/pulso) = 0,3 Wh/pulso × RTC × RTP = 0,0003 × RTC × RTP
```

- **0,3 Wh/pulso** é a constante do medidor no secundário — **validada em bancada**
  (seção 9). Vale também para o reativo: **0,3 varh/pulso**.
- **RTC** = relação do TC (ex.: 80/5 → 16; medição direta → 1).
- **RTP** = relação do TP (sem TP → 1).

| Ligação | Ke |
|---|---|
| Medição direta (bancada) | 0,0003 kWh/pulso |
| TC 80/5, sem TP | 0,0003 × 16 = **0,0048** kWh/pulso |

No IoT do NexON o nó do medidor tem os campos **Relação do TC** e **Relação do TP**; a TON
calcula o Ke e publica no bloco (`ke`). Sem `ke` (TON antiga), o backend usa 0,0003; o
A-966 continua com o padrão histórico 0,048.

---

## 7. Fórmulas do NexON

### Energia
```
kWh   = pulsos de ativa  × Ke          (phf → consumida · phr → injetada)
kvarh = pulsos de reativa × Ke         (somas indutiva / capacitiva da seção 5)
```
Energia do dia/mês = soma dos pulsos de **todos os blocos** do período × Ke.

### Potência média
```
kW   = kWh ÷ horas do período
kvar = kvarh ÷ horas do período
```

| Período | Horas | Multiplicador | Origem |
|---|---|---|---|
| Agora (último minuto) | 1/60 | × 60 | parcial de 1 em 1 min da TON-V2 (`min`) |
| Bloco de 5 min (medidor da bancada) | 1/12 | × 12 | bloco oficial (`seg` ≈ 297) |
| Bloco de 15 min (medidor da concessionária) | 1/4 | × 4 | bloco oficial (`seg` ≈ 897) |

A duração do bloco sai do `seg` (arredondado ao minuto): 297 s → 5 min; 897 s → 15 min.

### Demanda (como a concessionária fatura)
```
Demanda da janela = (Σ pulsos dos blocos que fecharam na janela) × Ke × 4
Demanda máxima    = maior janela do dia (ou do mês)
Janelas fixas     = :00–:15, :15–:30, :30–:45, :45–:00
```
Com medidor de 5 min, cada janela soma 3 blocos (um pico curto não infla a demanda). Com
medidor de 15 min, 1 bloco por janela, sincronizado com o relógio do medidor.

### Fator de potência
```
FP = P ÷ √(P² + Q²)        natureza: indutivo se o reativo veio em qhfi/qhri,
                                     capacitivo se veio em qhfc/qhrc
```

### Minuto do medidor (TON-V2): `fim`, `min` e `data.*`

A TON publica **uma mensagem por minuto do intervalo do medidor**, no mesmo formato do bloco:

| Campo | Significado |
|---|---|
| `fim` | `0` = minuto do medidor (só "agora") · `1` = **fechamento do intervalo** (bloco oficial) |
| `min` | pulsos do **último minuto** → potência "agora" (× Ke × 60) |
| `data.phf`… | pulsos **acumulados no intervalo até aqui** (no `fim:1`, o total do intervalo) |
| `q` · `posto` · `seg` | quadrante, posto horário e segundos que faltam, do último segundo |

- **Sincronização com a concessionária:** o minuto é contado pelo `seg` regressivo **do
  medidor** (publica quando `seg ÷ 60` diminui), não pelo relógio da TON. Intervalo de 15 min
  → 14 mensagens `fim:0` + 1 `fim:1`, alinhadas ao intervalo da Equatorial; Σ `min` = bloco.
- **Energia e demanda** vêm **só** das mensagens `fim:1`; as `fim:0` vão para `ssu_minutos`
  (curva e "agora"), nunca para o histórico.
- Satélite LoRa continua mandando só o bloco (tempo de rádio).
- Formato anterior (`"parcial":1` com `acum`, firmware de 14/10 manhã) ainda é aceito.

---

## 8. Exemplos calculados (220 V × 10 A)

### Monofásico (uma fase), S = 220 × 10 = 2 200 VA

| φ | cos φ | sen φ | P = 2200·cos φ | Q = −2200·sen φ | Quadrante | Campos | FP |
|---|---|---|---|---|---|---|---|
| 0° | 1,000 | 0,000 | **+2 200 W** | 0 | — | `phf` | 1,000 |
| −30° | 0,866 | −0,500 | **+1 905 W** | **+1 100 var** | Q1 | `phf` + `qhfi` | 0,866 ind. |
| +30° | 0,866 | +0,500 | **+1 905 W** | **−1 100 var** | Q4 | `phf` + `qhrc` | 0,866 cap. |
| ±90° | 0,000 | ±1,000 | 0 | ∓2 200 var | — | só reativo | 0 |
| −150° | −0,866 | −0,500 | **−1 905 W** | **+1 100 var** | Q2 | `phr` + `qhfc` | 0,866 cap. |
| +150° | −0,866 | +0,500 | **−1 905 W** | **−1 100 var** | Q3 | `phr` + `qhri` | 0,866 ind. |
| 180° | −1,000 | 0,000 | **−2 200 W** | 0 | — | `phr` | 1,000 |

Pulsos esperados num bloco de 5 min (Ke = 0,0003):
```
Ativa:   1 905 W × (5/60) h = 158,75 Wh  ÷ 0,3 Wh = ~529 pulsos
Reativa: 1 100 var × (5/60) h = 91,67 varh ÷ 0,3 varh = ~306 pulsos
Q/P = 306 / 529 = 0,577 = tg 30°
```

### Trifásico (tensão e corrente jumpeadas nas 3 fases)

O medidor soma as três fases → **3×** o monofásico:
```
P = 3 × 220 × 10 × cos 30° = 5 716 W   → 5 716 × (5/60) ÷ 0,3 = ~1 588 pulsos / 5 min
Q = 3 × 220 × 10 × sen 30° = 3 300 var → 3 300 × (5/60) ÷ 0,3 = ~917 pulsos / 5 min
```

---

## 9. Resultados da bancada (14/10/2026)

| Teste | Esperado | Recebido (bloco cheio de 5 min) | Desvio |
|---|---|---|---|
| 220 V × 5 A, 0°, fase A | P = 1 100 W → 305,6 pulsos | `phf` **305** | 0,2 % |
| Conferência pelo registrador C1 do E750 | 15,421 → 15,600 kWh = 0,179 kWh em ~9,8 min | ~597 pulsos × 0,0003 = 0,179 kWh | ✅ |
| 3 fases × 220 V × 10 A, **+30°** | 1 588 / 917 (Q4) | `q=4` · `phf` **1589** · `qhrc` **916** | 0,1 % |
| **−30°** (parcial de 1 min) | Q1 · Q/P = 0,577 | `phf` 65 · `qhfi` **37** · `qhrc` 0 → Q/P = 0,569 | ✅ |
| Demanda 15 min (11:45–12:00) | — | 781 + 0 + 1367 = 2148 pulsos × 0,0003 × 4 = **2,578 kW** | — |

Contas do teste de +30° (3 fases):
```
P = 1589 × 0,0003 × 12 = 5,72 kW        Q = 916 × 0,0003 × 12 = 3,30 kvar (capacitivo, qhrc)
S = √(5,72² + 3,30²) = 6,60 kVA          FP = 5,72 ÷ 6,60 = 0,866 cap.  → cos 30° ✅
```

Contas do teste de −30° (minuto):
```
P = 65 × 0,0003 × 60 = 1,17 kW          Q = 37 × 0,0003 × 60 = 0,67 kvar (indutivo, qhfi)
Q/P = 0,569 ≈ tg 30° (0,577)  ✅
```

Blocos com valor "estranho" no meio do teste (ex.: 781, 1367) foram **parciais** — a mala
foi ligada ou mudada no meio do intervalo de 5 min.

---

## 10. Q2 e Q3 (injeção) — testados em 14/10

| Medido | Quadrante (medidor) | Campos | Ângulo calculado |
|---|---|---|---|
| `phr` 332 · `qhri` 155 por minuto | **Q3** (`q=3`, octeto 3 = `0xb0`) | `phr` + `qhri` | 180° − atan(155/332) = **155°** |
| `phr` 317 · `qhri` 183 por minuto | **Q3** | `phr` + `qhri` | **150°** |
| `phr` 184 · `qhfc` 317 por minuto | **Q2** | `phr` + `qhfc` | 180° − atan(317/184) = **120°** (era para ser −150°) |

Decodificação coerente com a física (detalhes em
[IOT-TON-V2-SSU-TESTE-BANCADA-2026-10-14.md](IOT-TON-V2-SSU-TESTE-BANCADA-2026-10-14.md), seção 4).
O **nome** do campo de cada quadrante continua sendo convenção — para casar com o A-966,
repetir +150° com o A-966 no mesmo medidor.

## 11. Sinal do FP no display do medidor

Há duas convenções comuns; o teste com a mala mostra qual o E750 usa:

| Convenção | O sinal muda quando | Teste |
|---|---|---|
| **Pelo sentido do ativo** (FP = cos φ com sinal) | passa de 90° (consumo → injeção) | +30° → +150°: + → − |
| **Pelo tipo de reativo** (comum: + indutivo, − capacitivo) | cruza 0° (atrasada ↔ adiantada) | −30° → +30°: + → − |

O NexON não depende disso: mostra o FP em **módulo** com **"ind."/"cap."** e o sentido do
ativo separado (`phf` consumo / `phr` injeção).

---

## 12. Por que isso importa na conta de energia

- A concessionária cobra excedente de reativo (**UFER**) quando o FP fica **abaixo de 0,92**:
  - **indutivo** no período de carga pesada (dia);
  - **capacitivo** no período de carga leve (madrugada).
- Por isso o medidor separa o reativo por quadrante e a TON publica os quatro campos.
- Numa **UFV**: de dia a instalação **injeta** (`phr`, FP ≈ 1 se o inversor estiver em FP 1);
  à noite **consome** (`phf`, reativo indutivo dos transformadores — Q1). Inversor ajustado
  com FP ≠ 1 gera reativo junto com a injeção (Q2 ou Q3).
