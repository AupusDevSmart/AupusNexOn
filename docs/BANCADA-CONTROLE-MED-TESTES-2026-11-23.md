# Bancada — testes oficiais do controle pelo MED (23/11/2026)

> Unidade real Fazenda Pontal (`cmuhbmzan17mbjq7o8154c6vt`), projeto IoT "Controle FP - Bancada".
> Regras do despacho testadas: [IOT-CONTROLE-MED-DESPACHO.md](IOT-CONTROLE-MED-DESPACHO.md).
> Horários em Brasília (UTC−3). Evidências: `controle_med_ciclos`, `ssu_minutos`, `equipamentos_dados`, MQTT `RUBENS/GO/PONTAL/#`.

## 0. Montagem e estado inicial (10:21)

| Item | Estado |
|---|---|
| TON-MED (TON4V2, …E1:A0) | online, build 202611191432, SSU chegando a cada minuto, Ke 0,03 kWh/pulso (RTC 100) |
| TON-UFV-A (TON1V2, …DC:AC) → INV-01 | online, **sem leitura do emulador** (`modbus_ok 0`, `no_samples`); última leitura 19/11 18:18 |
| TON-UFV-B (TON1V2, …DC:98) → INV-11 | online, **sem leitura do emulador** (idem) |
| Modos | Demanda de geração **Ativo** · Demanda de carga **Ativo** · FP **Ativo** |
| Contratos | geração 100 kW (alvo 100 %) · carga 230 kW (+5 % = 241,5) |
| UFVs | A: INV-01, P estático 100, zera estágio 2 não · B: INV-11, P estático 100, zera estágio 2 sim · watchdog validado nas duas |
| Inversores | Sungrow SG110CX emulado, Pn 100 · Smax 110 · Q máx 44 % · Q fornece com **−** |
| FP | alvo 0,93 · intervalo mínimo entre ajustes 60 s · reativo prioritário ligado · janela capacitiva 00h–06h |
| Mala | 1 A ≈ 66 kW (3 × 220 V × RTC 100); exporta a 180°, indutivo com ângulo negativo |

## Resultados

| # | Teste | Mala | Esperado | Resultado | Evidência |
|---|---|---|---|---|---|
| 0 | Religar emuladores (HW VSP reconectado, porta reaberta) | 0 A | TONs leem e escrevem no emulador | ✅ 10:24 emulador recebe `ctl` (5006=170, 5007=1000, 5035=162, 5036=0 + read-back); 10:25 INV-01 e INV-11 publicando 100 kW. Obs.: rajada de escritas repetidas às 10:24:12 = fila acumulada no HW VSP despejada de uma vez (inofensivo) | `equipamentos_dados` 10:24:23 / 10:25:24 |
| 0b | Ajuste do cadastro para o SG110CX real (11:15) | 1,2 A a 180° | — | Contrato de geração 100 → **110 kW** (controle + unidade); inversores **Pn 110 / Smax 110**; **P estático 50 + 50** (Σ 100 < 110); validade internet **60 s**; emuladores nominal 110 kW / P 110 kW. Primeira tentativa de T1 (11:03–11:05) descartada: o 45 foi digitado no Pn em vez do P estático | `controle_med_config_hist` 23/11 |
| T1 | Exportação abaixo do contrato (11:28–11:31) | **1,2 A a 180°** → 77–81 kW exportando | "Dentro do contrato", sem corte; FP dentro do alvo | ✅ Projeção 76,6–80,7 kW < 110: nenhum corte por demanda; FP "ΔQ 0 dentro da banda", Q 0. O **teto p/ queda de comunicação** (R4 olhando o medidor) limitou a soma: 202 kW (92 %) no início do intervalo, 171 kW (77,6 %) no meio, efeito do intervalo de 5 min da bancada (no campo, 15 min, passa de 400 kW). ⚠️ **Achado:** com validade 60 s, a cada fechamento do intervalo o ciclo vem em 62 s e as TONs ficavam **1 s em modo seguro** (P estático 50 → rampa). Validade voltou a **90 s** (11:31) | ciclos 11:28:46–11:30:46 |
| T2 | Exportação acima do contrato, mala parada (11:33–11:36) | **1,9 A a 180°** → 113–128 kW exportando | espera 1 min, depois corte **proporcional** igual nos dois | ✅ 11:34:48 "Projeção 121,2 kW ≥ contrato: aguardando o próximo minuto"; 11:35:46 "Projeção 127,4 kW: reduzir 21,8 kW" → **−10,9 kW em cada** (INV-01 e INV-11 iguais, 52,7 %), comandos `ok` nas duas TONs. O teto p/ queda (R4) acompanhou a energia exportada: 200 → 152 → 116 → 99 kW | ciclos 11:33:46–11:35:46 |
| T3 | Mala não obedece (malha aberta) → piso + alarme (11:36) | 1,9 A mantido | para no piso (contrato × Pn/ΣPn = 55 kW cada) e alarma | ✅ 11:36:46 os dois em **55 kW (50 %)** "no piso (55,0 kW = parte do contrato)"; evento *"Medidor acima do contrato com a geração já no piso (Σ limites = contrato 110,0 kW): … verificar a medição ou os inversores"*. Não cortou abaixo do piso | ciclo 11:36:46 |
| T4 | Volta abaixo do contrato → liberação (11:38–11:42) | **0,25 A a 180°** → 16 kW exportando | libera proporcional até 100 % | ✅ 11:38:46 "liberar 44,8 kW" → +22,4 em cada (70,4 %); 11:39:48 intervalo novo, teto p/ queda 152 kW → 68,9 %; 11:40:46 → 86,5 %; 11:41:47 → **100 % nos dois**. Sempre iguais. Obs.: o intervalo 11:34:48–11:39:48 fechou em ≈ 104 kW (< 110) porque a mala baixou no último minuto → corretamente **sem** evento de ultrapassagem | ciclos 11:38:46–11:42:46 |
| T5 | FP indutivo ruim, dia (11:45–11:48) | **3,0 A a −45,6°** → 139 kW importando + 142 kvar ind. (FP 0,70) | "corrigindo"; Q com % **negativo** (Sungrow); P reduzido p/ caber Q (reativo prioritário) | ✅ 11:45:46 "Janela indutiva: compensar 79,3 kvar" → **+39,6 kvar em cada, enviado como −36 %** (`ok`); emulador INV-11 passou a −39,6 kvar. 11:46:46 "aguardando o efeito da última correção — próximo ajuste em 4 s" (intervalo mínimo 60 s). 11:47:46 "compensar 129,2 kvar" → **48,4 kvar (teto Q máx 44 %) = −44 %** e **"reativo prioritário: P ≤ 98,8 kW para caber 48,4 kvar (Smax 110 kVA)"** → limite 89,8 % nos dois. Demanda de carga: projeção 127 kW < 241,5, nada | ciclos 11:45:46–11:47:46 |
| T6 | Fecha a malha do reativo (11:49–11:52) | **2,21 A a −17,8°** → 139 kW + ~45 kvar ind. (FP 0,95 no minuto) | minuto bom, mas a hora já comprometida → não fecha 0,92; não corta P à toa | ✅ parcial. 11:49:48 "Falta 13,8 kvar e não há Q disponível nas UFVs" (`sem_atuador`); 11:50:46 e 11:51:46 "**Hora perdida**: a compensação máxima não fecha o FP da hora", com o FP da hora subindo 0,73 → 0,78 → 0,81. Q mantido no máximo (48,4 kvar = −44 % cada), P só pela prioridade do reativo (89,8 %). **Pendente:** virada da hora (12:00) com a mala mantida → esperado "FP dentro do alvo · normalizado" e devolução parcial do Q. A mala desliga sozinha depois de 10 min → refazer depois do almoço | ciclos 11:49:48–11:51:46 |
| T6c | Mala desligada (11:54) e virada da hora (12:00) | 0 A | hora perdida até 12:00; depois "dentro do alvo" e Q devolvido | ⚠️ 11:54–11:59 "Hora perdida" com o "falta X kvar" crescendo (29 → 245 kvar): com P e Q zerados a conta do resto da hora diverge. O texto engana, mas não muda a ação. 12:00:48 em diante "ΔQ 0,0 kvar dentro da banda" ✅, **porém o Q ficou no máximo (48,4 kvar = −44 %) e o P em 89,8 %**: o ciclo só via o reativo indutivo, e o excesso das UFVs (que no campo apareceria como capacitivo) era invisível → nunca devolvia. **Corrigido 12:1x (bf1081e):** o FP usa o **Q líquido** do minuto no sentido da janela; compensação demais fica negativa → "devolver". Na bancada (malha aberta) o devolver só aparece se a mala mostrar o capacitivo correspondente | ciclos 11:52:46–12:03:46 |

## Pendentes (depois do almoço)

| # | Teste | Mala | Esperado |
|---|---|---|---|
| T6b | Normalização do FP na virada da hora | ligar ~5 min antes da hora cheia em 2,21 A a −17,8° (FP 0,95) | depois da hora cheia: verde, "normalizado às HH:MM"; Q devolvido até o necessário |
| T6d | Devolução do reativo (correção do Q líquido) | com Q 48,4 × 2 aplicado: mala em 2,1 A a +45° (≈ 98 kW + 98 kvar **cap.**, como se a carga indutiva tivesse sumido) | "Compensação além do necessário — devolvendo": Q volta a 0 e o P a 100 % |
| T7 | FP capacitivo de dia | 1,2 A a +30° | janela indutiva: capacitivo não é cobrado → "dentro do alvo" |
| T8 | Ultrapassagem no fechamento | 1,9 A a 180° por um intervalo inteiro (5 min) | evento "Ultrapassagem de geração: intervalo fechou em … / 110" |
| T9 | Demanda de carga acima do limite (241,5) | 3,8 A a 0° (≈ 250 kW importando), com inversores limitados antes | "liberando geração" |
| T10 | Queda da TON-UFV-B (tirar da rede) | 1,2 A a 180° | B: 90 s → P estático 50; +180 s → 0 (estágio 2); A segue normal; ao voltar, evento de modo seguro + rampa |
| T11 | Queda da TON-MED | qualquer | as duas UFVs vão sozinhas ao P estático (50) |
| T12 | Modo Sombra / Desligado | qualquer | Sombra: "enviaria"; Desligado: `ctl off` → 100 % e Q 0 |
