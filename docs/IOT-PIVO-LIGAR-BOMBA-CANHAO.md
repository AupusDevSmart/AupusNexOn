# Pivô: Ligar em um botão (bomba, solenoide, percentímetro, canhão)

> **Status:** plano fechado (04/11/2026). Parte do backend já está escrita e não foi publicada (seção 7).
> **Relacionados:** [IOT-PIVO-BOMBEAMENTO.md](IOT-PIVO-BOMBEAMENTO.md) · [IOT-PIVO-PERCENTIMETRO-LAMINA.md](IOT-PIVO-PERCENTIMETRO-LAMINA.md)

## 1. Ideia

O operador só clica em **Ligar** e escolhe na Irrigação: direção, com ou sem água, lâmina/%, canhão no início e parada. O NexON faz a sequência inteira.

**O painel do pivô já faz a parte da bomba:**
- **Ligar** dá a partida na bomba e fecha a solenoide, se houver.
- **Desligar** para tudo, a bomba junto.

O NexON não comanda a bomba nem a solenoide separadamente. São **6 comandos**, cada um um ponto do pivô ligado a uma BO de **qualquer TON** na Topologia IoT → Configurar I/O. A Configuração do pivô deixa de escolher TON e BO: ela só **mostra** onde cada sinal está ligado.

## 2. Pontos do pivô (cadastro → Supervisão e controle)

| Comando | Para que serve | Status (retorno) |
|---|---|---|
| **Ligar** | partida: bomba + solenoide (pulso no botão do painel) | **Ligado** |
| Girar_direita | sentido direita | Girando_direita |
| Girar_esquerda | sentido esquerda | Girando_esquerda |
| Desligar | para o pivô e a bomba | **Permissivo**: o painel juntou as condições (bomba, tensão, pressão) |
| Percentimetro | motor de movimento (ciclo na TON) | — |
| **Canhao** | botão que alterna o canhão final | **Canhao_ligado** |

Também existem Desligado, Erro e Pressostato, para painéis que tenham esses sinais. Os pontos novos (Ligar, Canhao, Ligado, Canhao_ligado e Permissivo) vêm **desmarcados**. Ponto marcado sem BO/BI ligada é ignorado.

Sem o status Desligado, "parado" = Girando_direita e Girando_esquerda em 0.

## 3. Ligar com água

| # | Passo | Sem o ponto |
|---|---|---|
| 0 | Travas: pivô parado, sem Erro, bomba livre (sistema conjugado), fora da ponta | — |
| 1 | **Ligar**: se Ligado = 1, segue; senão pulso no Ligar e espera Ligado = 1 até "Confirmação da bomba" | sem Ligar: pula · sem Ligado: segue sem confirmar |
| 2 | **Pressão**: espera o Pressostato até "Tempo para pressurizar" | espera fixa (só sem Pressostato e sem Permissivo) |
| 3 | **Permissivo** (com ou sem água): espera Permissivo = 1 até "Tempo para pressurizar"; se não vier, falha "Sem permissivo" | pula |
| 4 | **Percentímetro**: `perc` com o % da lâmina, conferido pelo ack | ajuste no painel |
| 5 | **Girar** para o lado escolhido e confirma Girando_X | sem confirmação |
| 6 | **Canhão**, se marcado no início: pulso no Canhao só se Canhao_ligado = 0, depois confirma Canhao_ligado = 1. Se falhar, a irrigação continua e a falha fica no registro | sem Canhao ou sem Canhao_ligado: pula |

**Falha nos passos 1 a 5:** o NexON manda o **Desligar**, que para o pivô e a bomba, e `perc off`.

## 4. Ligar sem água

Não aciona o Ligar. Espera o Permissivo (se houver), põe o percentímetro a **100 %**, gira e confirma. O canhão fica bloqueado.

## 5. Desligar

Pulso no Desligar → confirma a parada (Girando em 0) → `perc off` → canhão: pulso se Canhao_ligado = 1 → confirma a bomba desligada (Ligado = 0).

**Sistema conjugado** (o pivô usa o Ligar de outro pivô):
- um pivô por vez;
- ao desligar, a bomba só para se nenhum outro estiver girando, pelo Desligar do pivô dono da bomba.

## 6. Canhão na ficha (com o pivô ligado)

- Mostra o estado pelo Canhao_ligado.
- Um botão só: **Ativar canhão** quando está desligado, **Desativar canhão** quando está ligado.
- Travas, igual ao pivô: não ativa se já está ativo, não desativa se já está desativado. Com estado desconhecido, só deixa desativar.
- Confirmação pelo status, com o mesmo tempo da "Confirmação do giro".
- Sem água o canhão fica indisponível.
- As faixas do canhão por ângulo (aba "Canhão" da Irrigação) ficam para depois, porque precisam da leitura de ângulo.

## 6b. Percentímetro com o pivô girando

- Card "Percentímetro" na Operação, só com o pivô girando com água e o ponto Percentimetro ligado a uma BO.
- `POST /pivos/:id/percentimetro {percentual}` ou `{lamina}` manda um `perc` novo. A TON troca no **próximo ciclo**, sem desligar.
- Atualiza a irrigação em curso. A parada por voltas ou ângulo é recalculada: o que falta percorrer anda na velocidade nova. A parada por tempo não muda.
- Recusa com o pivô parado, sem água ou com o mesmo valor.

## 7. Implementado (04/11/2026)

- **Backend** (`pivo-sequencia.service.ts`):
  - bomba = Ligar/Ligado (desliga pelo Desligar do pivô);
  - sistema conjugado = "usa a bomba do Pivô X";
  - Permissivo;
  - canhão na partida, no desligar e pela ficha (`POST /pivos/:id/canhao {ligar}`);
  - os pivôs sem pontos seguem na configuração antiga;
  - testes em `pivo-pontos.spec.ts`.
- **Cadastro:** os pontos novos vêm desmarcados (`"padrao": false` no tipo).
- **Configuração do pivô:** sai o seletor de TON e saem válvula e direcionamento. Mostra onde estão Ligar e Ligado, o conjugado por pivô e a "Confirmação da bomba".
- **Ficha:** card "Canhão final" com Ativar/Desativar. Na Irrigação avançada, "Canhão final" fica indisponível sem os pontos e diz "Começa ligado/desligado".
- **Migrações:**
  - `2026-11-04_pivo_pontos_bomba_valvula.sql` (aplicada);
  - `2026-11-04b_pivo_ligar_6_comandos.sql`: tira Desligar_bomba e Valvula e renomeia Ligar_bomba → Ligar e Bomba_ligada → Ligado (também nos pontos já criados, mantendo a BO/BI ligada).
- **Firmware:** não muda. **Não precisa regravar** as TONs.

## 8. Decidido (04/11/2026)

1. **Bomba e solenoide são do painel:** o Ligar faz as duas coisas e o Desligar para tudo. Não há Desligar_bomba nem Valvula. São 6 comandos.
2. **Canhão:** **um botão que alterna**. O Canhao_ligado diz o estado. O NexON só pulsa quando o estado é diferente do pedido e confirma pelo status depois. Sem o status, não comanda.
3. **Permissivo** na BI do Desligar (BI4 na bancada): a partida espera ele antes de girar.
4. A TON da bomba fica na **mesma instalação** do pivô.

## 9. Teste de bancada (TON4v2 do lab)

Uma TON só. Cada status vai na BI de mesmo número da BO:

| BO | Ponto de comando | BI | Ponto de status |
|---|---|---|---|
| 1 | Ligar (bomba + solenoide) | 1 | Ligado |
| 2 | Girar_direita | 2 | Girando_direita |
| 3 | Girar_esquerda | 3 | Girando_esquerda |
| 4 | Desligar | 4 | **Permissivo** (não existe "Desligado": parado = Girando_direita e Girando_esquerda em 0) |
| 5 | Percentimetro | 5 | (só leitura; nenhum papel na sequência) |
| 6 | Canhao | 6 | Canhao_ligado |

**No cadastro do PIV-01, marcar:**
- Comando: Ligar, Canhao.
- Status: Ligado, Canhao_ligado, Permissivo.
- Desmarcar Desligado, Erro e Pressostato (não ligados).

Depois, em Topologia → TON4v2 → Configurar I/O, ligar BO1–BO6 e BI1–BI6 como na tabela.

**Casos:**
1. **Ligar com água, sem retorno na BI1:** pulso BO1 → falha em "Confirmação da bomba" → pulso BO4 (Desligar).
2. **Ligar com água, com BI1 e BI4:** pulso BO1 → Ligado → Permissivo → `perc` (BO5) → pulso BO2/BO3 → Girando → (canhão, se marcado: pulso BO6 → Canhao_ligado).
3. **Ligar com água, sem BI4:** falha "Sem permissivo" após o tempo de pressurização → desfaz (pulso BO4, `perc off`).
4. **Ligar sem água:** BO1 não é acionada; espera BI4; `perc` 100 %; gira.
5. **Canhão pela ficha:** com o pivô girando com água, Ativar → pulso BO6 → BI6 = 1. Ativar de novo é recusado ("já está ligado").
6. **Desligar:** pulso BO4 → Girando em 0 → `perc off` → canhão (pulso BO6 se BI6 = 1) → confirma Ligado = 0.

## Saídas mantidas (painel sem selo) — 11/11/2026

Opção por pivô em **Configuração → Bombeamento → Saídas mantidas** (`pivo_config.sequencia.comandos_mantidos`, padrão desligado = pulsos).
Serve para painel que **não faz selo**, por exemplo a TON no lugar das saídas do CLP (painel Fockink do Pivô 11: o CLP mantém O1 bombeamento, O2/O3 direita/esquerda, O4 canhão).

| Função | Pulso (padrão) | Mantidas |
|---|---|---|
| Ligar (bomba) | pulso no Ligar | `rN on` e fica em alto durante a irrigação |
| Girar dir./esq. | pulso no botão | o sentido oposto vai a `off` **antes**, depois `rN on` (nunca os dois em alto) |
| Canhão | pulso que alterna; exige o status `Canhao_ligado` | `on`/`off` direto; o status é opcional (só confirma) |
| Desligar | pulso no ponto Desligar | `off` nos dois sentidos → confirma parado → canhão `off` → Ligar `off`. Não precisa do ponto Desligar |
| Percentímetro | ciclo local na TON (igual) | igual |
| Giro não confirmado | pulso no Desligar | `off` nos dois sentidos |

- **Troca de modo só com o pivô desligado** (o servidor recusa com 409): trocar ligado deixaria saída presa em alto ou sem selo.
- **Reboot da TON derruba todas as saídas** (`RELAYS_RESTORE_ON_SW_RESET = 0` no firmware de pivô): o pivô para. É o lado seguro. O NexON vê o Girando em 0 e considera a irrigação encerrada.
- Sistema conjugado: o modo vale pelo pivô **dono** da bomba (o Ligar dele vai a `off`).
- Código: `pivo-sequencia.service.ts` (`mantido()`, `saidaMantida()`), testes em `pivo-pontos.spec.ts` ("saídas mantidas").
