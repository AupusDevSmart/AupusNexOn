# Pivô + bombeamento — um equipamento, duas TONs, partida em sequência

> 14/10/2026 · desenho aprovado em conversa · status: **Fase 0 quase concluída** (falta MAC das TON4 dos pivôs).
> Vale para TON V1 e V2 (a diferença entre elas é SSU e quantidade de BI/BO; os dois
> geradores já têm a máquina de estados do pivô, `_genPivot`).

## 1. O problema

O pivô e o bombeamento ficam longe um do outro, então cada um tem a sua TON:

```
  TON A (casa de bombas)                         TON B (centro do pivô)
  BO: liga/desliga bomba                          BO: movimento, sentido dir/esq, desliga
  BI: "bomba ligada" (retorno)                    BI: pressostato, emergência, desalinhamento, status
        │                                                 │
        └──────────── internet / LoRa ──── NexON ─────────┘
```

Para irrigar, a ordem é obrigatória: **liga a bomba → espera pressão → gira o pivô**.
No unifilar aparece **um** símbolo (Pivô); o bombeamento é parte dele.

## 2. O que existe hoje (13/10/2026)

| Peça | Situação |
|---|---|
| Vínculo comando → TON/BO | **Por ponto** (`equipamento_pontos` → `ton_bo`/`iot_vinculos`): um equipamento já pode ter pontos em TONs diferentes. |
| Sequência bomba → pivô | **Não existe.** Cada botão é um pulso isolado (`rN on` → `pulso_ms` → `rN off`). |
| Trava de pressão no firmware | Existe nos dois geradores (`_genPivot`: espera pressostato até `tempo_pressao_s`=120 s, para se a pressão cair). **O backend nunca usa** (só manda `rN`, nunca `pivot on/off`). |
| `pivo_config` / `pivo_programacoes` | Migration `2026-09-28_5-pivos.sql` escrita, **não aplicada** (aplicada na Fase 0). |
| TONs dos pivôs na Chimarrão | Tópico `OLI/GO/CHIMARRAO/BOMBAS/satellite/MAC` — "MAC" literal, comando não chega. |
| Ficha do pivô (PivoSheet) | Mockup: botões desabilitados, "Girar sem água"/"Bloquear na ponta" só visuais. |
| Programações | Salvas, nunca executadas (não há agendador). |
| Bloqueio de comando "BOMBA" | `equipamentos-cmd` bloqueia todo tipo com `BOMBA` no código (feito para bomba de combustível) — pegaria a motobomba. |

## 3. Decisões

1. **Bombeamento = equipamento próprio, fora do unifilar.** Tipo novo `MOTOBOMBA`
   (`disp_unifilar=false`, `disp_iot=true`). O pivô aponta para ele em
   `pivo_config.motobomba_equipamento_id`. Motivo: uma bomba pode servir **vários pivôs**
   (sistema conjugado) — se cada pivô repetisse "a mesma BO da mesma TON" como ponto
   próprio, desligar um pivô desligaria a bomba dos outros. Com a bomba como entidade
   única, a sequência sabe quem ainda está usando.
   - No IoT, ao configurar o pivô: **"Bombeamento: novo | usar o do Pivô X"**.
   - O bloqueio de comando manual passa a valer só para `BOMBA_COMBUSTIVEL`.
2. **Modo de acionamento da bomba** (config da motobomba), porque muda como desligar e
   o que acontece se a TON reiniciar:
   - `pulso` — soft-starter/contator com selo: um pulso liga, outro pulso (outra BO) desliga.
     Se a TON A reiniciar, a bomba **continua** ligada.
   - `mantido` — a TON segura o relé: soltar desliga. Se a TON A reiniciar ou perder energia,
     a bomba **desliga** (relés partem desligados — ver plano anti-travamento).
3. **Confirmação por BI.** Bomba: BI "bomba ligada" na TON A. Pivô: pressostato na TON B.
   Tempo de pressurização padrão 120 s (configurável por pivô).
4. **Orquestração no NexON + segurança local na TON.** O NexON coordena as duas TONs
   (a única peça que enxerga as duas); cada TON se protege sozinha: a do pivô só gira
   com pressão e para se ela cair, mesmo sem internet/LoRa.
5. **Desligar (padrão, configurável):** para o pivô → desliga a bomba **se nenhum outro
   pivô dela estiver girando**.

## 4. Sequências

**Irrigar (sentido D/E):**

| # | Passo | Confirma por | Falhou → |
|---|---|---|---|
| 1 | Bomba já ligada (outro pivô usando)? pula p/ 3 | BI "bomba ligada" | — |
| 2 | Liga a bomba (pulso ou mantido) | BI "bomba ligada" em até 30 s | aborta, alarme "bomba não partiu" |
| 3 | Pivô: `pivot dir l|r` + `pivot on` (TON B espera pressão) | estado `rodando` em `<base>/pivo` em até `tempo_pressao_s` | desliga bomba (se ninguém mais usa), alarme "sem pressão" |

**Parar:** `pivot off` → confirma `parado` → desliga a bomba se nenhum pivô dela estiver
`rodando`.

**Girar sem água** (opção existente no modal): pula 1–2 e manda o pivô girar sem exigir
pressão (firmware com `tempo_pressao_s = 0` para esse comando).

Cada sequência vira **uma** linha na trilha de comandos com os passos e o resultado, e a
ficha mostra o progresso ("ligando bomba… aguardando pressão… girando").

## 5. Fases

| Fase | Entrega | Muda algo em campo? |
|---|---|---|
| **0 — Base** | ✅ `pivo_config`/`pivo_programacoes` aplicadas (14/10); ✅ bloqueio de comando manual só p/ `BOMBA_COMBUSTIVEL`; ⏳ corrigir tópicos `satellite/MAC` (precisa dos MACs reais). | Não |
| **1 — Modelo** | Tipo `MOTOBOMBA` (junto com o nó do IoT, para não aparecer na paleta sem configuração). IoT: nó Pivô com seção Bombeamento (TON A, BO liga, BO desliga se pulso, BI confirmação, modo) e "usar o do Pivô X"; cadastro grava pontos nos dois equipamentos. | Não |
| **2 — Sequência** | Serviço de sequência no backend (estado persistido, timeouts, abort seguro, trilha); endpoint `POST /pivos/:id/irrigar|parar`; ficha do pivô ligada. | Sim — após teste em bancada com 2 TONs |
| **3 — Firmware** | Backend passa a mandar `pivot on/off/dir` (não mais `rN` soltos) para a TON do pivô; BO de bomba em modo mantido nos geradores V1/V2. | Sim — regravar TONs |
| **4 — Ficha + agenda** | Bombeamento e pivô no mesmo cartão; programações executadas pelo agendador; bloqueio de ponta valendo também para "Irrigar". | Sim |

## 6. Em aberto

- MACs reais das TON4 dos pivôs da Chimarrão (TON4-PIVO1/2/3) para corrigir os tópicos.
- Qual BI da TON A é o retorno "bomba ligada" em cada instalação (entra no cadastro).
- Pivôs da NS Aparecida (Pivôs 4–6) estão só com monitoramento (M160) — entram depois.
