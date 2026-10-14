# TON-V2 — testes de bancada da entrada SSU (14/10/2026)

> Bancada Aupus · TON4V2 (MAC 10:51:DB:80:78:5C) + Landis+Gyr E750 (intervalo de 5 min) ·
> injeção com mala Conprove · horários em Brasília · tópico `TESTE/Medidor_1/data`.
> Antecedente: [IOT-TON-V2-SSU-R47-PULLUP.md](IOT-TON-V2-SSU-R47-PULLUP.md) ·
> Teoria e fórmulas: [IOT-SSU-QUADRANTES-FP-CALCULOS.md](IOT-SSU-QUADRANTES-FP-CALCULOS.md).

## Resultado

**Aprovado.** Depois da troca do **R47 de 680 Ω por 10 kΩ**, a TON lê a SSU do medidor; a
energia bate com o registrador do medidor (C1) e com a potência injetada, e os quatro
quadrantes são separados corretamente.

| Item | Resultado |
|---|---|
| Leitura da SSU | `ssu_ok` sobe ~1 por segundo (antes da troca: 0) |
| Erros | `ssu_err` ≤ 4 no dia, só nas partidas/reinícios da TON |
| Ke do medidor | **0,3 Wh/pulso** (ativo) e **0,3 varh/pulso** (reativo) no secundário |
| Intervalo do medidor | 5 min (`seg` = 297) |
| Quadrantes | Q1, Q2, Q3 e Q4 decodificados de acordo com a física (P e Q com o sinal certo) |
| Conferência independente | registrador C1 do E750 (Teste 1) e S constante = 6,60 kVA (Testes 2–3) |
| Parcial de 1 min | publicada a cada 60 s após regravar a TON (Teste 4) |

| Teste | Montagem | Verificação | Resultado |
|---|---|---|---|
| 1 | 220 V × 5 A, 0°, fase A | Ke pela potência + registrador C1 | ✅ 305 pulsos / 5 min = 1,1 kW; C1 bate |
| 2 | 3 fases × 220 V × 10 A, +30° | ativo + reativo, Q4 | ✅ 1589 / 916 pulsos (0,1 %) |
| 3 | ±30°, +150°/+155°, injeção negativa | quadrantes Q1–Q4 | ✅ todos coerentes (ver ângulos na seção 4) |
| 4 | firmware novo | parcial de 1 em 1 min | ✅ a cada 60 s, sem duplicar energia |

---

## 1. Montagem

- SSU do E750 no X14 da TON: vermelho no X14-2 (SU+), preto no X14-1 (GND).
- **Teste 1:** mala em **220 V e 5 A na fase A**, 0° (FP = 1).
- **Testes 2 e 3:** tensão e corrente da mala **jumpeadas nas 3 fases** do medidor (tensão em
  paralelo, corrente em série pelos 3 elementos) → o medidor soma as três fases:
  S = 3 × 220 × 10 = **6 600 VA**.

---

## 2. Teste 1 — monofásico, 0°: Ke e registrador C1 (10:40–11:00)

**Diagnóstico** (`TESTE/diagnostics`, 177 s após ligar a TON):
```json
{"uptime_sec":177, "ssu_ok":145, "ssu_err":1, "ssu_fmt":2, "ssu_degradado":false, "ssu_intervalos":1}
```

**Blocos** (firmware 2.0.0-build202610071430):
```
10:39:52 {"NSU":7,"data":{"cdo":"5","phf":0,"phr":0,"sts":1,"qhfi":0,"qhfc":0,"qhri":0,"qhrc":0,"frame":"29 51 80 00 00 00 00 b4 9d"},"ke":0.0000,"fmt":2,"q":1,"seg":297,"posto":0,"ssu_err":3}
10:44:52 {"NSU":8,"data":{"cdo":"5","phf":285,"phr":0,"sts":1,"qhfi":0,"qhfc":0,"qhri":0,"qhrc":0,"frame":"29 71 80 03 00 00 00 b3 b9"},"ke":0.0000,"fmt":2,"q":1,"seg":297,"posto":0,"ssu_err":3}
10:49:52 {"NSU":9,"data":{"cdo":"5","phf":305,"phr":0,"sts":1,"qhfi":0,"qhfc":0,"qhri":0,"qhrc":0,"frame":"29 71 80 03 00 00 00 b3 b9"},"ke":0.0000,"fmt":2,"q":1,"seg":297,"posto":0,"ssu_err":3}
10:54:53 {"NSU":10,"data":{"cdo":"5","phf":291,"phr":0,"sts":1,"qhfi":0,"qhfc":0,"qhri":0,"qhrc":0,"frame":"29 71 80 03 00 00 00 b3 b9"},"ke":0.0000,"fmt":2,"q":1,"seg":297,"posto":0,"ssu_err":3}
10:59:52 {"NSU":11,"data":{"cdo":"5","phf":305,"phr":0,"sts":1,"qhfi":0,"qhfc":0,"qhri":0,"qhrc":0,"frame":"29 71 80 03 00 00 00 b3 b9"},"ke":0.0000,"fmt":2,"q":1,"seg":297,"posto":0,"ssu_err":3}
```

| Bloco | `phf` | Situação |
|---|---|---|
| 10:39:52 | 0 | antes da injeção |
| 10:44:52 | 285 | parcial (injeção começou ~10:40:15) |
| 10:49:52 | **305** | bloco cheio |
| 10:54:53 | 291 | com carga |
| 10:59:52 | **305** | bloco cheio |

**Ke pela potência injetada:**
```
Energia = 220 V × 5 A × cos 0° × (5 min ÷ 60) = 1,1 kW × 0,0833 h = 0,0917 kWh
Ke      = 0,0917 kWh ÷ 305 pulsos = 0,000300 kWh/pulso = 0,3 Wh/pulso
```

**Conferência pelo registrador C1 do E750:**
```
C1 às ~10:51 = 15,421 kWh  ·  C1 às ~11:00 = 15,600 kWh  →  Δ = 0,179 kWh
A 1,1 kW, 0,179 kWh = 9,8 min (o intervalo entre as leituras)
Pela TON: ~61 pulsos/min × 9,8 min ≈ 597 pulsos × 0,0003 = 0,179 kWh   ✅
```

**Período inteiro** (10:40:15 → 10:59:52): 285 + 305 + 291 + 305 = 1186 pulsos × 0,0003 =
**0,356 kWh**; pela potência, 1,1 kW × 19,6 min = **0,359 kWh** (diferença < 1 %).

---

## 3. Teste 2 — trifásico, +30° (11:45–12:10)

Esperado (3 × 220 V × 10 A, +30° = corrente adiantada → **Q4**, consome + capacitivo):
```
P = 6 600 × cos 30° = 6 600 × 0,866 = 5 716 W   → 5 716 × (5/60) ÷ 0,3 = ~1 588 pulsos / 5 min
Q = 6 600 × sen 30° = 6 600 × 0,500 = 3 300 var → 3 300 × (5/60) ÷ 0,3 = ~917 pulsos / 5 min
```

Blocos (como gravados no NexON; `P_direto`/`Q_liquido`/`FP_calc` são calculados pelo backend):
```
11:49:53 {"q":4,"NSU":22,"seg":297,"data":{"phf":1330,"phr":0,"qhfi":0,"qhfc":0,"qhri":0,"qhrc":767,"frame":"29 61 90 10 00 09 00 72 3e"},"P_direto":4.788,"Q_liquido":-2.761,"FP_calc":0.866}
11:54:52 {"q":4,"NSU":23,"seg":297,"data":{"phf":1589,"phr":0,"qhfi":0,"qhfc":0,"qhri":0,"qhrc":916,"frame":"29 61 90 10 00 0a 00 72 ce"},"P_direto":5.72,"Q_liquido":-3.298,"FP_calc":0.866}
12:04:52 {"q":4,"NSU":25,"seg":297,"data":{"phf":1526,"phr":0,"qhfi":0,"qhfc":0,"qhri":0,"qhrc":880,"frame":"29 41 90 10 00 09 00 75 5e"},"P_direto":5.494,"Q_liquido":-3.168,"FP_calc":0.866}
12:09:51 {"q":4,"NSU":26,"seg":297,"data":{"phf":1589,"phr":0,"qhfi":0,"qhfc":0,"qhri":0,"qhrc":916,"frame":"29 41 90 10 00 0a 00 75 ae"},"P_direto":5.72,"Q_liquido":-3.298,"FP_calc":0.866}
```

| | Esperado | Recebido (bloco cheio 11:54:52 e 12:09:51) | Desvio |
|---|---|---|---|
| Ativo `phf` | 1 588 | **1 589** | 0,1 % |
| Reativo `qhrc` | 917 | **916** | 0,1 % |
| Quadrante | Q4 | `q=4` · frame octeto 3 = `0x90` → bits 4-5 = `01` → Q4 | ✅ |

```
P = 1589 × 0,0003 × 12 = 5,72 kW     Q = 916 × 0,0003 × 12 = 3,30 kvar (capacitivo)
S = √(5,72² + 3,30²) = 6,60 kVA       FP = 5,72 ÷ 6,60 = 0,866 cap. = cos 30°   ✅
```

Os blocos 11:49:53 (1330) e 12:04:52 (1526) foram **parciais** (mala ligada no meio do
intervalo).

**Demanda em janela de 15 min** (soma dos blocos da janela × Ke × 4):
```
Janela 11:45–12:00: 781 + 0 + 1367 = 2 148 pulsos × 0,0003 × 4 = 2,578 kW
```

---

## 4. Teste 3 — quadrantes (12:10–13:00)

Fonte: parciais de 1 min (`ssu_minutos`) e blocos de 5 min. Minutos **cheios** (sem troca de
ângulo no meio), em pulsos/minuto:

| Horário | Ângulo (pela leitura) | `phf` | `phr` | Reativo | Quadrante do medidor |
|---|---|---|---|---|---|
| 11:47–11:56 | +30° | 318 | 0 | `qhrc` 183 | **Q4** |
| 12:01–12:10 | +30° | 318 | 0 | `qhrc` 183 | **Q4** |
| 12:14 | −30° | 318 | 0 | `qhfi` 184 | **Q1** |
| 12:18–12:22 | **+155°** | 0 | 332 | `qhri` 155 | **Q3** (bloco `q=3`) |
| 12:48–12:52 | +30° | 318 | 0 | `qhrc` 183 | Q4 |
| 12:54 | −30° | 318 | 0 | `qhfi` 184 | Q1 |
| 12:56 | +150° | 0 | 317 | `qhri` 183 | **Q3** |
| 12:58 | **−120°** (ver nota) | 0 | 184 | `qhfc` 317 | **Q2** |

Conversão: potência = pulsos/min × 0,0003 × 60 · ângulo = atan(Q ÷ P):

| Teste | P | Q | S = √(P² + Q²) | Ângulo calculado | Coerente? |
|---|---|---|---|---|---|
| +30° | +5,72 kW | 3,29 kvar cap. | 6,60 kVA | atan(183/318) = **29,9°** | ✅ Q4 |
| −30° | +5,72 kW | 3,31 kvar ind. | 6,61 kVA | atan(184/318) = **30,1°** | ✅ Q1 |
| 12:56 | −5,71 kW | 3,29 kvar | 6,59 kVA | 180° − atan(183/317) = **150,0°** | ✅ Q3 |
| 12:18–12:22 | −5,98 kW | 2,79 kvar | 6,60 kVA | 180° − atan(155/332) = **155,0°** | ✅ Q3 |
| 12:58 | −3,31 kW | 5,71 kvar | 6,60 kVA | 180° − atan(317/184) = **120,1°** | ✅ Q2 |

Contas de referência (S = 6 600 VA):
```
+155°: P = 6600 × cos 155° = 6600 × (−0,906) = −5 982 W → 332 pulsos/min
       Q = 6600 × sen 25°  = 6600 × 0,423   =  2 789 var → 155 pulsos/min
+150°: P = 6600 × (−0,866) = −5 716 W → 317/min · Q = 6600 × 0,500 = 3 300 var → 183/min
−120°: P = 6600 × cos 120° = 6600 × (−0,500) = −3 300 W → 183/min
       Q = 6600 × sen 120° = 6600 × 0,866    =  5 716 var → 317/min
```

Bloco do Q3 (5 min cheios a +155°):
```
12:19:51 {"q":3,"NSU":28,"data":{"phf":0,"phr":1662,"qhfi":0,"qhfc":0,"qhri":776,"qhrc":0,"frame":"29 41 b0 11 00 07 00 f1 05"},"P_rev":5.983,"Q_liquido":2.794,"FP_calc":0.906}
```
`0xb0` → bits 4-5 = `11` → **Q3**. FP = 5,983 ÷ √(5,983² + 2,794²) = 0,906 = cos 25°.

**Conclusões do Teste 3:**
- **S = 6,60 kVA em todos os ângulos** — a mala manteve 3 × 220 V × 10 A; só o ângulo mudou.
- A decodificação do quadrante bate com a física: +30° → Q4, −30° → Q1, +150°/+155° → Q3,
  ângulo negativo de injeção → Q2, com P e Q nos sinais certos.
- Quando o ângulo muda dentro de um minuto ou bloco, cada parte cai no campo do seu quadrante
  (ex.: bloco 12:59:51 com `phr` 998, `qhfc` 630 e `qhri` 365).
- **Nota sobre os ângulos:** o "150°" de 12:18–12:22 foi na verdade **155°** (Q/P = 0,467 =
  tg 25°), e o teste do Q2 às 12:58 corresponde a **−120°**, não −150° (ativo e reativo vieram
  com os tamanhos trocados: cos 120° = 0,5 e sen 120° = 0,866). Conferir o ângulo digitado na mala.
- O que estes testes **não** decidem é o **nome** do campo de cada quadrante (ex.: reativo do
  Q3 em `qhri` ou `qhrc`) — o medidor informa só o número do quadrante; o nome é convenção.
  A TON segue Q1 `qhfi`, Q2 `qhfc`, Q3 `qhri`, Q4 `qhrc` (soma indutivo/capacitivo coerente
  com a IEC). Para casar com o A-966, repetir +150° com o A-966 no mesmo medidor.

---

## 5. Teste 4 — parcial de 1 em 1 minuto (firmware 2.0.0-build202610141431)

Após regravar a TON, ela publica a cada 60 s no mesmo tópico, com `"parcial":1`:
```
14:35:05 {"parcial":1,"NSU":20,"ts":1791999305,"seg":284,"ke":0.000300,"min":{"phf":0,"phr":0,"qhfi":0,"qhfc":0,"qhri":0,"qhrc":0},"acum":{"phf":0,...}}
14:36:05 {"parcial":1,"NSU":20,"ts":1791999365,"seg":224,"ke":0.000300, ...}
14:37:05 {"parcial":1,"NSU":20,"ts":1791999425,"seg":164,"ke":0.000300, ...}
```
- `min` = pulsos do último minuto (potência "agora"); `acum` = pulsos desde o início do
  intervalo do medidor (zera quando o bloco fecha — logo após o fechamento pode ficar menor
  que `min`).
- `ke` agora vem calculado (0,0003 × TC 1 × TP 1).
- O NexON grava as parciais em `ssu_minutos` (retenção 7 dias); **nenhuma** entra no
  histórico, na energia ou na demanda (conferido: 0 parciais em `equipamentos_dados`).

---

## 6. Achados no NexON durante os testes

| Achado | Onde apareceu | Situação |
|---|---|---|
| Ke 0,048 (A-966) aplicado à TON-V2 → 176 kW num bloco de 1,1 kW | Teste 1 | ✅ corrigido: TON-V2 sem `ke` usa 0,0003 |
| Bloco convertido em kW como se fosse de 15 min (medidor de 5 min → 3× menor) | Teste 1 | ✅ corrigido: duração pelo `seg` |
| Demanda = maior bloco (5 min) | Teste 2 | ✅ corrigido: janela fixa de 15 min somando blocos |
| **Filtro de "glitch" do A-966 zerou consumo real**: bloco 12:14:52 com `phf` 529 e `phr` 156 (troca de consumo → injeção no meio do bloco) marcado `_aupus_glitch_phf` e `P_direto` = 0 | Teste 3 | ⚠️ pendente: não aplicar o filtro à TON-V2 (ela separa por quadrante) |
| **FP de bloco misto**: 12:54:51 com `qhfi` 450 + `qhrc` 452 (−30° e +30° no mesmo bloco) → reativo líquido ≈ 0 → `FP_calc` = 1,0 | Teste 3 | ℹ️ a energia indutiva/capacitiva fica correta e separada; só o FP "líquido" do bloco engana |

```
12:14:52 {"q":3,"NSU":27,"data":{"phf":529,"phr":156,"qhfi":269,"qhfc":0,"qhri":73,"qhrc":38,"frame":"29 41 b0 11 00 07 00 f1 05"},"P_rev":0.562,"P_direto":0,"FP_calc":0.457,"_aupus_glitch_phf":true}
12:54:51 {"q":1,"NSU":35,"data":{"phf":1564,"phr":0,"qhfi":450,"qhfc":0,"qhri":0,"qhrc":452,"frame":"29 41 80 10 00 0a 00 b4 6d"},"P_direto":5.63,"Q_liquido":-0.007,"FP_calc":1}
```

---

## 7. Ajustes feitos no NexON (14/10)

| Onde | Antes | Agora |
|---|---|---|
| Ke quando a TON manda `ke: 0` | 0,048 (padrão do A-966) | **0,0003 kWh/pulso** |
| Duração do bloco (pulsos → kW) | fixa em 15 min | pelo `seg` do bloco |
| Demanda (ficha do medidor) | maior bloco | **maior janela fixa de 15 min** (:00/:15/:30/:45) |
| Nó do medidor SSU no IoT | "Ke em kWh/pulso" digitado | **Relação do TC** e **do TP**; Ke = 0,0003 × TC × TP |
| Firmware TON-V2 | só bloco do medidor | + **parcial de 1 em 1 min** (`"parcial":1`), Ke com 6 casas |
| Unifilar | medidor da SSU sem lugar | associação ao **Medidor Concessionária**; ficha com agora, demanda 15 min, energia do dia e último bloco |
| A-966 | — | inalterado (0,048 e 15 min) |

Em campo: TC 80/5 → Ke = 0,0003 × 16 = **0,0048 kWh/pulso**.

---

## 8. Pendências

- Trocar o **R47 para 10 kΩ** nas demais placas TON-V2 e na próxima revisão do projeto.
- **Filtro de glitch:** não aplicar à TON-V2 (seção 6).
- **Nomenclatura dos reativos do Q2/Q3:** repetir +150° com o A-966 no mesmo medidor e alinhar.
- Refazer o Q2 com **−150°** exato (o teste ficou em −120°).
- Cálculo de custos: demanda ainda pelo maior bloco (falta a janela de 15 min).
