# TON-V2 — por que a entrada SSU não lê o medidor (R47 = 680 Ω)

> Bancada Aupus, 07/10/2026 · TON4V2 + Landis+Gyr E750 A2E3 (o mesmo medidor que o gateway A-966 lê).
> Base: esquemático SCH-TON-v1b · `TON-V2-Hardware-SSU-v1.2` · medição com multímetro no X14.

## Resumo

| | |
|---|---|
| **Sintoma** | TON ligada há mais de 30 min, medidor ligado e transmitindo: `ssu_ok = 0` e `ssu_err` parado em 1 no `<base>/diagnostics`. Nenhum bloco publicado. |
| **Ligação** | correta: X14-2 = SU+ (vermelho), X14-1 = GND (preto). Igual à do A-966. |
| **Firmware** | correto. Não recebe nenhum byte: a linha nunca chega ao nível "0" que o ESP32 reconhece. |
| **Causa** | o pull-up **R47 = 680 Ω** pede ~4,9 mA da saída do medidor. Ela não aguenta essa corrente, e o "0" fica entre ~1,5 e 2,6 V, acima do limite de 0,8 V do ESP32. |
| **Correção nesta placa** | trocar o **R47 por 10 kΩ** (mínimo 4,7 kΩ). |
| **Próxima revisão** | R47 = 10 kΩ ou, melhor, um estágio de entrada próprio para a SSU (transistor, opto ou Schmitt-trigger). |

## 1. A ideia em uma frase

A TON "empurra" a linha para cima com força demais, e o medidor não consegue "puxar" para baixo o suficiente para o ESP32 entender que é um **0**.

## 2. O circuito

```
               +3,3 V
                 │
                [R47]  680 Ω   ← pull-up da TON (empurra a linha para cima)
                 │
 X14-2 (SU+) ────┼──────────► IO48 do ESP32 (UART0 RX)
                 │
                 ├── D4 TVS LESD5D5.0 ──► GND   (só proteção ESD)
                 │
      Saída SSU do medidor = "interruptor" para o GND
      aberto  → bit 1
      fechado → bit 0
                 │
 X14-1 (GND) ────┴──── GND
```

- **Na TON, a SU+ não passa por optoacoplador.** Ela vai direto ao IO48, com o R47 de pull-up e o D4 de proteção. Os optoacopladores da TON são só das 8 entradas digitais (X12).
- **No medidor, a saída SSU é coletor aberto** (opto/transistor): ela só sabe puxar a linha para o GND e depende do pull-up de quem lê.
- **Interruptor aberto (bit 1):** não passa corrente e a linha fica em **3,3 V**.
- **Interruptor fechado (bit 0):** passa corrente pelo R47 e pelo interruptor. A linha cai, **mas não até 0 V**, porque o interruptor do medidor não é perfeito.

## 3. A regra do ESP32

O ESP32 alimentado em 3,3 V só entende:

| Tensão no pino | O ESP32 entende |
|---|---|
| **≤ 0,8 V** (0,25 × 3,3) | **0** |
| **≥ 2,5 V** (0,75 × 3,3) | **1** |
| entre 0,8 e 2,5 V | zona proibida (vira 1 ou nada) |

Para a UART receber os dados, o **0 do medidor tem de chegar abaixo de 0,8 V**.

## 4. As equações

Fechado, o interruptor do medidor se comporta como um resistor pequeno, **R_med**. Com o R47 ele forma um **divisor de tensão**:

```
I  = 3,3 V / (R47 + R_med)                 corrente que o medidor precisa drenar
V0 = 3,3 V × R_med / (R47 + R_med)         tensão na linha quando o medidor manda um 0
```

Quanto **maior o R47**, menor a corrente e **menor o V0**, ou seja, melhor.

Condição para funcionar: V0 ≤ 0,8 V. Isolando o R47:

```
R47 ≥ R_med × (3,3 − 0,8) / 0,8  ≈  3,1 × R_med
```

→ **O pull-up precisa ser pelo menos ~3 vezes a resistência do interruptor do medidor** (com margem: 4–5 vezes).

## 5. Estimando o medidor a partir da medição

Com o medidor transmitindo, o multímetro entre X14-2 e X14-1 mostrou **2,5 a 3,0 V**. Isso é a **média**: a linha passa parte do tempo em 1 (3,3 V) e parte em 0 (V0).

A cada segundo, o medidor transmite um bloco de 8–9 bytes a 110 baud, ~0,9 s de transmissão. Considerando bits de partida, de parada e dados, a linha fica em 0 cerca de **45 %** do tempo:

```
V_média ≈ 0,55 × 3,3 + 0,45 × V0     →     V0 ≈ (V_média − 1,82) / 0,45
R_med   = R47 × V0 / (3,3 − V0)
```

| Média medida | V0 estimado | R_med estimado |
|---|---|---|
| 2,5 V | **≈ 1,5 V** | ≈ 570 Ω |
| 3,0 V | **≈ 2,6 V** | ≈ 2,5 kΩ |

O "0" do medidor chega na TON entre **1,5 e 2,6 V**, bem acima dos 0,8 V exigidos. O interruptor do medidor equivale a algo entre **~0,6 e ~2,5 kΩ**.

> São estimativas a partir de uma média de multímetro. O valor exato do V0 sai com osciloscópio no X14-2 (bit = 9,09 ms).

## 6. Simulação: o que acontece com cada R47

| R47 | Corrente pedida (3,3 / R47) | V0 se R_med = 570 Ω | V0 se R_med = 2,5 kΩ | Resultado |
|---|---|---|---|---|
| **680 Ω (hoje)** | 4,9 mA | 1,50 V ❌ | 2,60 V ❌ | não lê |
| 2,2 kΩ | 1,5 mA | 0,68 V ✅ | 1,76 V ❌ | depende do medidor |
| **4,7 kΩ** | 0,7 mA | 0,36 V ✅ | 1,15 V ⚠️ | quase sempre |
| **10 kΩ** | 0,33 mA | 0,18 V ✅ | 0,66 V ✅ | lê nos dois casos |

Exemplo da conta (R47 = 4,7 kΩ e R_med = 570 Ω):

```
V0 = 3,3 × 570 / (4700 + 570) = 3,3 × 0,108 = 0,36 V    ✅ (< 0,8 V)
```

### E o nível 1, piora com R47 maior?

Não. Com o interruptor aberto não passa corrente pelo R47; a entrada do ESP32 consome microampères. Com qualquer valor da tabela, a linha fica em **~3,3 V**, bem acima de 2,5 V.

### E a velocidade?

A SSU é muito lenta: 110 baud, ou seja, **9,09 ms por bit**. O tempo de subida é τ = R × C:

```
τ = 10 kΩ × 1 nF (≈ 10 m de cabo) = 10 µs     → ~900 vezes menor que um bit
```

Não atrapalha. O pull-up se escolhe por **capacidade de dreno do medidor × imunidade a ruído**, não por velocidade.

## 7. Por que o A-966 lê e a TON não

Não temos o esquemático do A-966, mas a conta explica a diferença. Suponha um pull-up fraco, por exemplo **10 kΩ em 5 V** (0,5 mA):

```
V0 = 5 × 570 / (10000 + 570) ≈ 0,27 V      ✅
```

Ele também pode ter um estágio de entrada (opto, transistor ou comparador) com limiar próprio. Seja qual for o circuito, o A-966 **pede pouca corrente do medidor**. A TON-V2 pede **4,9 mA**, de 10 a 15 vezes mais, e liga a linha direto no pino do ESP32, sem folga.

O próprio guia de hardware da V2 (`TON-V2-Hardware-SSU-v1.2`, checklist de bancada, passo 4) já previa isso: *"E750 + CE-6003: medir VOL real no SU+. Se ≥ 0,8 V, aumentar R47."*

## 8. Ações

| Onde | Ação |
|---|---|
| **Placa da bancada** | Trocar o R47 (SMD, junto da entrada X14 / IO48) por **10 kΩ** (mínimo 4,7 kΩ). |
| **Validação** | Depois da troca, o `ssu_ok` no `TESTE/diagnostics` tem de subir ~1 por segundo. Na virada do intervalo de 15 min do medidor sai o 1º bloco em `TESTE/Medidor_1/data`, com `phf = 0` enquanto não houver carga. Com osciloscópio: V0 < 0,8 V. |
| **Próxima revisão da TON-V2** | R47 = 10 kΩ ou um estágio de entrada próprio para a SSU (transistor, opto ou Schmitt-trigger), para não depender da força de saída de cada modelo de medidor. |
| **Firmware** | Nada a mudar. |

## 9. O que não resolve

- **Resistor em série** entre o medidor e o X14-2: forma outro divisor com o R47 e **sobe** o nível do 0.
- **Resistor externo em paralelo com o R47**: diminui o pull-up total, o contrário do necessário.
- **Firmware**: o limiar de 0,8 V é do próprio chip, não é configurável.

---
Relacionados: `TON-V2-Hardware-SSU-v1.2.pdf` · `SSU-TON-V2-Guia-v1.3.pdf` · `IOT-SSU-NBR14522-TON-V2-INTEGRACAO.md` · `IOT-TON-V2-PLANO-IMPLEMENTACAO.md` (bancada 07/10).
