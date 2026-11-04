# Pivô: Ligar em um botão (bomba, solenoide, percentímetro, canhão)

> **Status:** plano fechado (04/11/2026). Parte do backend já está escrita e não foi publicada (seção 7).
> **Relacionados:** [IOT-PIVO-BOMBEAMENTO.md](IOT-PIVO-BOMBEAMENTO.md) · [IOT-PIVO-PERCENTIMETRO-LAMINA.md](IOT-PIVO-PERCENTIMETRO-LAMINA.md)

## 1. Ideia

O operador só clica em **Ligar** e escolhe na Irrigação: direção, com ou sem água, lâmina/%, canhão no início e parada. O NexON faz a sequência inteira.

Cada sinal (bomba, solenoide, canhão…) é um **ponto do pivô** ligado a uma BO/BI de **qualquer TON** na Topologia IoT → Configurar I/O. A Configuração do pivô deixa de escolher TON e BO: ela só **mostra** onde cada sinal está ligado.

## 2. Pontos do pivô (cadastro → Supervisão e controle)

| Tipo | Ponto | Para que serve | Hoje |
|---|---|---|---|
| Comando | Girar_direita / Girar_esquerda / Desligar | painel do pivô | existe |
| Comando | Percentimetro | motor de movimento (ciclo na TON) | existe |
| Comando | **Ligar_bomba** | liga a bomba (sem Desligar_bomba: a BO fica mantida) | novo |
| Comando | **Desligar_bomba** | botoeira de desligar (pulso) | novo |
| Comando | **Valvula** | solenoide da adutora | novo (antes: TON+BO na Configuração) |
| Comando | **Canhao** | ativa/desativa o canhão final | novo |
| Status | Girando_direita / Girando_esquerda / Desligado / Erro | painel do pivô | existe |
| Status | Pressostato | água chegou | existe |
| Status | **Bomba_ligada** | confirmação do contator da bomba | novo |
| Status | **Canhao_ligado** | estado do canhão | novo |
| Status | **Permissivo** | painel liberou a partida (bomba, tensão, pressão…), juntado numa BI | novo |

Os pontos novos vêm **desmarcados**: cada pivô marca só o que tem. Ponto marcado sem BO/BI ligada é ignorado (o passo é pulado).

O NexON acha o papel de cada ponto pelo nome (os da bomba são testados antes, então "Desligar_bomba" não é confundido com o "Desligar" do pivô).

## 3. Ligar com água

| # | Passo | Sem o ponto |
|---|---|---|
| 0 | Travas: pivô parado, sem Erro, bomba livre (sistema conjugado), fora da ponta | — |
| 1 | **Solenoide** (só no conjugado): Valvula ON = fecha | pula |
| 2 | **Bomba**: se Bomba_ligada = 1, segue; senão Ligar_bomba e espera Bomba_ligada até "Confirmação da bomba" | sem Ligar_bomba: pula · sem Bomba_ligada: segue sem confirmar |
| 3 | **Pressão**: espera o Pressostato até "Tempo para pressurizar" | espera fixa (sem Pressostato e sem Permissivo) |
| 3b | **Permissivo** (com ou sem água): espera Permissivo = 1 até "Tempo para pressurizar"; sem ele, falha "Sem permissivo" | pula |
| 4 | **Percentímetro**: `perc` com o % da lâmina, conferido pelo ack | ajuste no painel |
| 5 | **Girar** para o lado escolhido e confirma Girando_X | sem confirmação |
| 6 | **Canhão**, se marcado no início: pulso no Canhao só se Canhao_ligado = 0, depois confirma Canhao_ligado = 1. Se falhar, a irrigação continua e a falha fica no registro | sem Canhao ou sem Canhao_ligado: pula |

**Falha nos passos 1 a 5:** desfaz o que já foi feito (pivô desligado, `perc off`, bomba se ninguém mais usa, solenoide). O canhão (passo 6) não derruba a irrigação.

## 4. Ligar sem água

Não mexe em solenoide, bomba nem pressão. Espera o Permissivo (se houver), põe o percentímetro a **100 %**, gira e confirma. O canhão fica bloqueado (sem água não faz sentido).

## 5. Desligar

Desligar o pivô e confirmar a parada → `perc off` → **canhão**: desativa se Canhao_ligado = 1 → bomba: desliga se nenhum outro pivô do conjugado estiver usando → solenoide OFF.

## 6. Canhão na ficha (com o pivô ligado)

- Mostra o estado pelo Canhao_ligado.
- Um botão só: **Ativar canhão** quando está desligado, **Desativar canhão** quando está ligado.
- Travas, igual ao pivô: não ativa se já está ativo, não desativa se já está desativado. Com estado desconhecido, só deixa desativar.
- Confirmação pelo status, com o mesmo tempo da "Confirmação do giro".
- Sem água o canhão fica indisponível.
- As faixas do canhão por ângulo (aba "Canhão" da Irrigação) ficam para depois, porque precisam da leitura de ângulo.

## 7. Implementado (04/11/2026)

- **Backend** (`pivo-sequencia.service.ts`):
  - a bomba vem dos pontos, cada sinal na sua TON;
  - sistema conjugado = "usa a bomba do Pivô X";
  - solenoide só no conjugado;
  - Permissivo;
  - canhão na partida, no desligar e pela ficha (`POST /pivos/:id/canhao {ligar}`);
  - os pivôs sem pontos seguem na configuração antiga;
  - testes em `pivo-pontos.spec.ts`.
- **Cadastro:** os pontos novos vêm desmarcados (`"padrao": false` no tipo).
- **Configuração do pivô:** sai o seletor de TON. Mostra onde cada sinal está ligado, o conjugado por pivô e a "Confirmação da bomba".
- **Ficha:** card "Canhão final" com Ativar/Desativar. Na Irrigação avançada, "Canhão final" fica indisponível sem os pontos e diz "Começa ligado/desligado".
- **Migração** `2026-11-04_pivo_pontos_bomba_valvula.sql`: Ligar_bomba, Desligar_bomba, Valvula, Canhao, Bomba_ligada, Canhao_ligado e Permissivo.
- **Firmware:** não muda. **Não precisa regravar** as TONs.

## 8. Decidido (04/11/2026)

1. **Solenoide:** ao ligar com água, a BO vai a **ON = fecha**. Ao desligar (ou numa falha), volta a **OFF**. Vale **só em pivô de sistema conjugado** (usa a bomba de outro pivô ou divide a dele) com "Válvula pelo NexON". Em pivô sozinho, o ponto Valvula é ignorado.
2. **Canhão:** **um botão que alterna**. O ponto Canhao é pulsado, e o Canhao_ligado diz o estado. O NexON só pulsa quando o estado é diferente do pedido e confirma pelo status depois. Sem o status Canhao_ligado, o NexON não comanda o canhão, porque às cegas o pulso poderia desligar em vez de ligar.
3. **Bomba:** a TON da bomba fica na **mesma instalação** do pivô. O Configurar I/O já lista os pontos dela.

## 9. Teste de bancada (TON4v2 do lab)

Uma TON só. Cada status vai na BI de mesmo número da BO:

| BO | Ponto de comando | BI | Ponto de status |
|---|---|---|---|
| 1 | Ligar_bomba (a mesma saída liga a solenoide; sem Desligar_bomba → BO mantida) | 1 | Bomba_ligada |
| 2 | Girar_direita | 2 | Girando_direita |
| 3 | Girar_esquerda | 3 | Girando_esquerda |
| 4 | Desligar | 4 | **Permissivo** (não existe "Desligado": parado = Girando_direita e Girando_esquerda em 0) |
| 5 | Percentimetro | 5 | (só leitura; nenhum papel na sequência) |
| 6 | Canhao | 6 | Canhao_ligado |

**No cadastro do PIV-01, marcar:**
- Comando: Ligar_bomba, Canhao.
- Status: Bomba_ligada, Canhao_ligado, Permissivo.
- Desmarcar Desligado, Erro e Pressostato (não ligados).

Depois, em Topologia → TON4v2 → Configurar I/O, ligar BO1–BO6 e BI1–BI6 como na tabela.

**Casos:**
1. **Ligar com água, sem retorno na BI1:** BO1 liga → falha em "Confirmação da bomba" → BO1 desliga.
2. **Ligar com água, com BI1 e BI4:** BO1 ON → Bomba_ligada → Permissivo → `perc` (BO5) → pulso BO2/BO3 → Girando → (canhão, se marcado: pulso BO6 → Canhao_ligado).
3. **Ligar com água, sem BI4:** falha "Sem permissivo" após o tempo de pressurização → desfaz (BO1 OFF, `perc off`).
4. **Ligar sem água:** BO1 não liga; espera BI4; `perc` 100 %; gira.
5. **Canhão pela ficha:** com o pivô girando com água, Ativar → pulso BO6 → BI6 = 1. Ativar de novo é recusado ("já está ligado").
6. **Desligar:** pulso BO4 → Girando em 0 → `perc off` → canhão (pulso BO6 se BI6 = 1) → BO1 OFF.
