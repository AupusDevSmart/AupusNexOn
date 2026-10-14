# Pivô + bombeamento — um equipamento, duas TONs, partida em sequência

> 14/10/2026 · desenho aprovado em conversa · status: **Fases 1–2 entregues (14/10)**; Chimarrão configurada (pivôs 1+2 e 3+11 com bomba compartilhada).
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
No unifilar aparece **um** símbolo (Pivô); o bombeamento é uma **funcionalidade do pivô**
(configuração dele), não um equipamento à parte.

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
| Bloqueio de comando "BOMBA" | `equipamentos-cmd` bloqueia todo tipo com `BOMBA` no código (feito para bomba de combustível) — ajustado na Fase 0 para valer só para combustível. |

## 3. Decisões

1. **Bombeamento é uma funcionalidade do pivô — não é outro equipamento.** Fica na
   configuração do próprio pivô: `pivo_config.bombeamento` (jsonb):
   ```json
   { "ativo": true, "ton_id": "<TON da casa de bombas>", "modo": "pulso" | "mantido",
     "bo_liga": 1, "bo_desliga": 2, "bi_confirma": 1, "confirma_s": 30 }
   ```
   - **Por que não pontos em `ton_bo`:** `ton_bo` é UNIQUE(ton_id, bo_numero) — um BO só
     pode pertencer a um ponto. Dois pivôs com a mesma bomba não caberiam. Na config do
     pivô, cada um aponta livremente para a TON/BO da bomba.
   - **Bomba compartilhada (sistema conjugado) é automática:** pivôs cujo bombeamento
     aponta para a **mesma TON + mesmo `bo_liga`** dividem a bomba. Ninguém precisa
     cadastrar "conjugado" — no IoT basta, ao configurar o pivô, escolher a mesma TON/BO
     (com atalho "usar o bombeamento do Pivô X", que só copia os campos).
   - A sequência consulta os outros pivôs da mesma bomba antes de desligá-la.
   - `pivo_config.motobomba_equipamento_id` (da migration de 28/09) fica sem uso.
   - O bloqueio de comando manual vale só para `BOMBA_COMBUSTIVEL` (feito na Fase 0).
2. **Modo de acionamento da bomba** (campo `modo` do bombeamento), porque muda como desligar e
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
| **1 — Modelo** | Coluna `pivo_config.bombeamento` (jsonb). IoT: nó Pivô ganha a seção **Bombeamento** (TON, modo, BO liga, BO desliga se pulso, BI de confirmação) com atalho "usar o do Pivô X"; grava em `pivo_config`. Aviso no IoT quando a TON da bomba tem a BO ocupada por outro ponto. | Não |
| **2 — Sequência** | Serviço de sequência no backend (estado persistido, timeouts, abort seguro, trilha); endpoint `POST /pivos/:id/irrigar|parar`; ficha do pivô ligada. | Sim — após teste em bancada com 2 TONs |
| **3 — Firmware** | Backend passa a mandar `pivot on/off/dir` (não mais `rN` soltos) para a TON do pivô; BO de bomba em modo mantido nos geradores V1/V2. | Sim — regravar TONs |
| **4 — Ficha + agenda** | Bombeamento e pivô no mesmo cartão; programações executadas pelo agendador; bloqueio de ponta valendo também para "Irrigar". | Sim |

## 6. Em aberto

- MACs reais das TON4 dos pivôs da Chimarrão (TON4-PIVO1/2/3) para corrigir os tópicos.
- Qual BI da TON A é o retorno "bomba ligada" em cada instalação (entra no cadastro).
- Pivôs da NS Aparecida (Pivôs 4–6) estão só com monitoramento (M160) — entram depois.

## 7. Entregue em 14/10/2026 (bancada)

- **Backend:** `PivoSequenciaService` (`aupus-nexon-api/src/modules/pivos/pivo-sequencia.service.ts`).
  - `GET /pivos/:id/estado` · `POST /pivos/:id/acionar {acao: girar_direita|girar_esquerda|desligar}`
  - `GET /pivos/:id/bombeamento/opcoes` (TONs da planta + bombeamentos de outros pivôs)
  - `PUT /pivos/:id/bombeamento {bombeamento, sequencia}`
  - BO da bomba: `EquipamentosCmdService.acionarBoDireto` (pulso / liga / desliga, mesmas
    restrições e trilha do acionar). BI: `lerEntradaTon` (`equipamento_io_estado`).
  - Papéis dos pontos do pivô achados pelo nome (direita / esquerda / desligar; status
    girando direita/esquerda, desligado, erro). Tipo PIVO ganhou esses **pontos nativos**.
  - Sequência persistida em `pivo_sequencias`; restart do servidor marca `interrompida`.
  - Simulado com TONs falsas: partida, desligar, bomba compartilhada (2º pivô não religa,
    1º desligar mantém bomba), bomba sem confirmação (aborta e desliga), Desligar durante a
    pressurização (interrompe e desliga tudo).
- **Front:** ficha do pivô (unifilar) — Operação: ↺ Esquerda / Desligar / Direita ↻ +
  passos da última sequência; Configuração: bombeamento + tempos.
- **Migrations:** `2026-10-14_pivo_bombeamento_sequencia.sql` (aplicada),
  `2026-10-14d_pivo_pontos_nativos.sql` (aplicada), `2026-10-14c_chimarrao_bombeamento_pivos.sql` (aplicada).
- **Motor continua existindo** como equipamento do unifilar (serve para outros casos); a ideia
  de fundir motor→pivô foi descartada.
- **Chimarrão:** pivôs 1 e 2 dividem a bomba (dois motores que trabalham juntos; a escolha de
  qual pivô recebe água é manual no pé do pivô) → os dois mandam "ligar bomba" na TON4-1
  (…8C:5C). Pivôs 3 e 11 dividem a TON4-3 (…82:C0); a chave que direciona a água entre eles
  é automação futura. BO1 ligar, BO2 desligar (pulso), BI1 ligado.
- **TONs da Chimarrão restauradas:** os ativos TON2-1 (gateway) e TON4-1/TON4-3 (satélites)
  estavam soft-deletados desde 04/08, embora o projeto IoT apontasse para eles. Restaurados e
  corrigido o save do IoT: satélite LoRa (`lora_mode` tx) não recebe mais o tópico da gateway
  (`<base>/satellite/<MAC>` quando houver MAC; sem MAC, mantém o tópico do ativo).

### Roteiro de bancada (2 TONs)
1. Duas TONs com **Tópico Base diferentes** (ex.: `TESTE/BOMBA` e `TESTE/PIVO`) no Lab.
2. Unifilar do Lab: criar **Pivô de Irrigação** com SCS Comando + Status (cria Girar_direita,
   Girar_esquerda, Desligar, Girando_direita, Girando_esquerda, Desligado, Erro).
3. IoT do Lab → TON do pivô → Configurar BOs: BO1 Girar_direita, BO2 Girar_esquerda,
   BO3 Desligar; Configurar BIs: BI1 Girando_direita, BI2 Girando_esquerda, BI3 Desligado, BI4 Erro.
4. Ficha do pivô → Configuração → Bombeamento: TON da bomba, Pulso, BO ligar 1, BO desligar 2,
   BI confirmação 1; Pressurização 10 s para o teste.
5. Na TON da bomba, simular o retorno "bomba ligada" na BI1 (jumper) quando o relé fechar.
