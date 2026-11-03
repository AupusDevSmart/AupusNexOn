# Percentímetro do pivô na TON (lâmina → %)

> **Status:** planejamento (03/11/2026; revisado com as respostas de campo no mesmo dia). Nada implementado.
> **Relacionados:** [IOT-PIVO-BOMBEAMENTO.md](IOT-PIVO-BOMBEAMENTO.md) (sequência bomba → pressão → pivô)

## 1. Objetivo

O operador informa a **lâmina d'água (mm)**. O NexON calcula o **percentual** e manda **um comando** à TON. A **própria TON** faz o ciclo do percentímetro, repetindo enquanto o pivô está ligado. Nada é enviado a cada minuto por MQTT/LoRa.

**O que a BO comanda:** o **motor de movimento** (o que faz o pivô andar). BO ligada = pivô andando; BO desligada = pivô parado no lugar, irrigando. Com 50 %, o pivô passa metade de cada minuto parado e a outra metade andando até o próximo ponto. 100 % = anda o tempo todo (velocidade máxima, lâmina mínima); **0 % = parado** o minuto inteiro.

O percentual deixa de ser de 5 em 5 % (como nos painéis/tabelas): sai com **uma casa decimal** da lâmina pedida.

## 2. A conta (validada com a tabela iCrop do Pivô 11 — Chimarrão)

Dados de 100 % já existem na configuração do pivô (`pivo_config.parametros`):
`lamina_100` (mm) e `tempo_volta_100` (h).

```
%            = lâmina_100 ÷ lâmina                 (lâmina ≥ lâmina_100)
tempo/volta  = tempo_volta_100 ÷ %
tempo/meia   = tempo/volta ÷ 2      tempo/quadrante = tempo/volta ÷ 4
ON por ciclo = % × ciclo (60 s)     OFF = ciclo − ON
```

Conferência com a tabela (lâmina_100 = 3,58 mm, tempo_volta_100 = 6,09 h):

| % da tabela | Lâmina da tabela | % calculado pela lâmina | Volta (tabela × cálculo) |
|---|---|---|---|
| 100 | 3,58 | 100,00 | 06:05 × 06:05 |
| 60 | 5,97 | 59,97 | 10:09 × 10:09 |
| 50 | 7,15 | 50,07 | 12:10 × 12:11 |
| 30 | 11,93 | 30,01 | 20:17 × 20:18 |
| 10 | 35,80 | 10,00 | 60:52 × 60:54 |
| 5 | 71,60 | 5,00 | 121:45 × 121:48 |

Nas 20 linhas: erro máximo do % = **0,09 p.p.** (arredondamento da lâmina impressa); tempo de volta ≤ 3 min de diferença (a tabela usa 6,087 h; o cadastro, 6,09 h). A lâmina de 100 % também fecha com os dados físicos: 292,8 m³/h × 6,09 h ÷ 49,79 ha ÷ 10 = **3,58 mm**.

**Limites:**
- Lâmina **menor** que `lamina_100` é impossível (exigiria passar de 100 %): recusar com "lâmina mínima deste pivô: 3,58 mm".
- **Sem % mínimo**: qualquer lâmina ≥ `lamina_100` vale. Por % direto, a faixa é 0–100 % (0 % = parado irrigando no lugar).
- Resolução: 0,1 % = 60 ms de ON por ciclo — sobra precisão (o laço da TON verifica a cada ~50 ms).

## 3. Firmware (TON V1 e V2 — percentímetro local)

**Comando (um por irrigação ou por mudança):**

| Comando | Efeito | Ack |
|---|---|---|
| `perc <permil>` | ex.: `perc 597` = 59,7 %; grava em NVS e passa a valer no próximo ciclo | `perc_597` |
| `perc off` | desliga o percentímetro (BO em OFF) | `perc_off` |

**Ciclo:**
- Período `PERC_CICLO_MS` (padrão 60 000; configurável por pivô). Cada ciclo começa pela fase **ON** (`permil × ciclo / 1000`), depois **OFF** até fechar o ciclo.
- 100 % = BO sempre ligada; 0 % = BO sempre desligada (parado). Fora de 0–1000 permil = recusa (`perc_invalido`).
- **Canhão final** (quando houver) fica ligado o tempo todo, independente do ciclo.
- Mudança de % no meio do ciclo vale **no próximo ciclo** (sem pulsos curtos estranhos).
- Implementação igual ao pulso local: `millis()` no laço, sem bloquear, sem timer em outra task (I2C).

**Quando roda (segurança):**
- Só com o pivô **girando**: BI "Girando direita/esquerda" = 1 (quando mapeadas); sem BI de giro, entre o comando de ligar e o de desligar.
- Pivô parado, **Erro** = 1 ou **falta de pressão** (pressostato, quando houver) → BO em OFF na hora e ciclo zerado.
- **Reboot da TON** no meio da irrigação: lê o `perc` do NVS e retoma **só se** o pivô estiver girando. Evita o pior caso: última torre parada (água concentrada num ponto) ou a 100 % (lâmina menor que a pedida).

**Retorno ao NexON:** o status do pivô (`<base>/…/pivo`, já vai na resposta ao POLL do LoRa) ganha `"pc":597` (aplicado) — o NexON confere com o que mandou.

## 4. Hardware e fiação (decisão de campo)

- **Qual BO:** um ponto de comando novo do pivô, papel **"Percentímetro"**, mapeado em BO como os outros (Topologia → Configurar I/O). O gerador recebe a BO pelo mapeamento do pivô.
- **Onde liga no painel:** no circuito da **última torre** (o mesmo que o percentímetro do painel comanda), com o percentímetro do painel em 100 % ou em "externo". Precisa ser levantado painel a painel.
- **Relé:** 1 manobra por minuto = **1 440 por dia**. O relé da TON deve comandar só a **bobina** de um contator/relé de interface (carga pequena — vida elétrica muito maior que chaveando motor) e esse relé de interface deve ser fácil de trocar. Não chavear o motor da torre direto pela TON.

## 5. Backend

- `ConfigIrrigacao` ganha `lamina_mm`; `percentual` passa a aceitar 1 casa decimal (hoje é inteiro 1–100). `duracaoParadaMs` já usa o percentual — só muda o arredondamento.
- Parâmetro novo do pivô: `percentimetro_ciclo_s` (s, padrão 60) — técnico.
- **Sequência de ligar:** antes do comando de girar, manda `perc <permil>` à TON e só segue com o ack. O passo "Percentímetro 60 % (ajuste do painel do pivô)" (hoje só informativo) vira "Percentímetro 59,7 % (lâmina 6,00 mm) aplicado na TON".
- **Alterar a lâmina com o pivô girando:** `PUT /pivos/:id/percentimetro` → um comando; recalcula a parada prevista.
- **Desligar:** sem BI de giro, manda `perc off`; com BI, a TON já para sozinha (o comando vai como redundância barata).
- **Programações:** além de "velocidade (%)", aceitam lâmina.
- **Validação:** lâmina < `lamina_100` → 400 com a lâmina mínima do pivô. Sem `lamina_100` cadastrado → só aceita %.

## 6. Tela

- **Irrigação avançada:** campo **Lâmina (mm)** como entrada principal, mostrando ao lado o resultado: `= 59,7 % · volta 10h11 · quadrante 2h33`. Alternativa: digitar o % e ver a lâmina.
- Lâmina mínima do pivô sob o campo ("mínimo 3,58 mm = 100 %").
- Ficha do pivô: status mostra o % **aplicado pela TON** (do `pc`), não só o pedido; divergência vira alerta.
- Opcional: tabela no estilo da iCrop gerada a partir do cadastro (útil para conferir com o painel).

## 7. Fases

| Fase | Entrega | Teste |
|---|---|---|
| 1 | Firmware: `perc`, ciclo local, NVS, segurança, `pc` no status | Bancada: medir ON/OFF no Serial e no relé (ex.: 59,7 % → 35,8 s ON / 24,2 s OFF); mudar o % no meio do ciclo; reboot no meio; pivô parado → BO OFF |
| 2 | Backend + tela (lâmina → %, comando no ligar, alteração em curso) | Bancada com a sequência completa (ligar → `perc` → girar) |
| 3 | Campo (Pivô 11 Chimarrão) | Fiação no circuito da última torre; conferir tempo de volta real × previsto |

## 8. Decidido (03/11/2026)

- Sem % mínimo; 0 % = parado.
- A BO liga/desliga o **motor de movimento** (ON = anda, OFF = parado irrigando).
- Canhão final ligado o tempo todo (se houver).

## 9. Perguntas em aberto

1. No painel do Pivô 11 (iCrop), qual borne comanda o motor de movimento, e o percentímetro do painel fica em 100 % / "externo" ou sai do circuito?
2. O ciclo é sempre 60 s, ou algum painel usa outro período?
3. Com o pivô girando **sem água** (seco), o percentímetro vale (controla a velocidade) ou fica em 100 %?
