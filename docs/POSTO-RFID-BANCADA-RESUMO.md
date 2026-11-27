# Posto de combustível — resumo dos testes do leitor RFID (bancada, nov/2026)

Resumo do que foi testado com o leitor RFID Wiegand na TON-V2 para o posto de combustível.
Detalhe técnico da montagem e do firmware: [IOT-POSTO-LEITOR-WIEGAND-AI.md](IOT-POSTO-LEITOR-WIEGAND-AI.md).
Testes anteriores da bomba (sem leitor real, 22/09): [POSTO-BANCADA-RELATORIO-2026-09-22.md](POSTO-BANCADA-RELATORIO-2026-09-22.md).

## Resultado em uma linha

**A TON-V2 lê a tag RFID do leitor real**, sem nenhum componente extra, e a tag passa por todo o fluxo do posto:
leitura → cadastro no NexON pela leitura → lista sincronizada na TON → validação tag + matrícula → acionamento das saídas.
O único passo que não fechou foi a confirmação da contatora (BI2), por causa da montagem de bancada, não do leitor.

## Montagem testada

| Item | Usado |
|---|---|
| Leitor | Garen GA-MF506 (Mifare 13,56 MHz, teclado, Wiegand 26 bits), alimentado em 12 V |
| TON | TON4v2 (TON-V2 com relés), firmware gerado pelo NexON com "Leitor RFID = Wiegand nas AI1/AI2" |
| Ligação | D0 (verde) → **AI1**, D1 (branco) → **AI2**, GND do leitor no GND da TON. Nenhum resistor, diodo ou capacitor |
| Tópico | `TESTE/WIEGAND` (bancada, isolado da produção) |
| Saídas/entradas | BO2 Permissão, BO3 Ligar (pulso), BO5 Solenoide, BO6 Sinaleiro, BI2 Contator |

## O que foi tentado e descartado

**Ligar D0 e D1 juntos no borne SU+ (IO48)**, separando os bits pela largura do pulso (proposta original,
`/var/www/documentacao/TESTE-WIEGAND-SU-TON400.md`). Não funciona nesta placa: o pull-up da própria placa no SU+ (R47)
segura a linha em nível alto. Medido: 3,2 V com o R47 original de 680 Ω e 2,8 V com 10 kΩ. O pulso do leitor nunca leva
a linha a nível baixo.

**Solução adotada:** cada linha numa entrada analógica (AI1/AI2). O divisor da própria placa (≈ 7,67:1) baixa os 5 V do
leitor para ~0,65 V no pino, e o ADC lê em modo contínuo, uma amostra a cada 25 µs por linha.

## Sequência dos testes (10/11/2026)

| # | Teste | Resultado |
|---|---|---|
| 1 | 1ª placa (MAC …E1:A0): repouso das linhas (`wg`) | **D1/AI2 ok**: ~5 V de repouso, 19 pulsos de 400–425 µs, 1 bit a cada ~2,5 ms. **D0/AI1 sem sinal**: 5 V no borne e 0 V no pino (IO6). Defeito da **entrada AI1 dessa placa** |
| 2 | Troca por outra TON-V2 (AI1 e AI2 ok) | Duas linhas com repouso normal |
| 3 | Aproximar a tag | **Tag `B9FFD8` lida de primeira**: 26 bits, paridade ok. Apareceu em "Última tag lida" no modal da bomba |
| 4 | Cadastro pela leitura (modal → "Usar esta tag") | Máquina **BYD**, matrícula **9211**, autorizada |
| 5 | Publicar a lista na TON | TON recebeu: `lista v…: 1 tags, 1 matriculas` |
| 6 | Tag de novo enquanto espera a matrícula | `negado: ocupado` (correto) |
| 7 | Tag sem matrícula | `negado: timeout_matricula` depois de 60 s (correto) |
| 8 | Tag `B9FFD8` + matrícula `9211` | **Autorizada.** Permissão, Solenoide e Sinaleiro ligaram e o Ligar deu o pulso |
| 9 | Confirmação da contatora | `falha_partida: sem_confirmacao_bi1`. A BI2 não fechou em 1 s → bomba **bloqueada** (proteção funcionando) |
| 10 | Tags com a bomba bloqueada | `negado: bloqueada` para `B9FFD8` e para uma 2ª tag (`1D6726`, também lida certo) |

Todos os eventos acima chegaram ao NexON (tabela `bomba_eventos`) e aparecem na aba de eventos da bomba.

**Por que o passo 9 falhou:** na bancada a BI2 estava lendo uma contatora que só fecha durante o pulso de 500 ms do BO3
(na bomba real o painel faz o selo). A BI2 precisa ler um contato que fica fechado a sessão inteira (auxiliar da contatora
do BO2 Permissão ou do BO5 Solenoide). O leitor e a validação não tiveram relação com essa falha.

## Melhorias feitas a partir do teste

- **Cadastro da tag pela leitura**: botão "Cadastrar tag" arma a captura, a próxima tag lida abre o formulário com o UID já
  preenchido (antes era digitar o número).
- **Rearme pelo NexON**: `POST /bomba-combustivel/:id/rearme` para tirar a bomba de "bloqueada" (a TON recusa com a
  contatora fechada).
- Modal da bomba reorganizado em abas: Operação, Máquinas, Operadores, Histórico.

## Situação

Teste **dado como aprovado pelo responsável em 11/11/2026** para a parte de leitura RFID.

Não foram feitos:
- abastecimento completo até "Abastecendo" e encerramento, com a BI2 ligada num contato que fica fechado a sessão inteira;
- critérios de aceite formais da §6 do documento técnico: 20 leituras seguidas, matrícula errada, tag não autorizada,
  tecla `*`, tag encostada sem repetir;
- leitor na TON V1 (os pinos IO6/IO7 são os mesmos, falta gerar e testar).

## Observações para quem for montar em campo

- Com o leitor nas AI1/AI2, **o nível do tanque não pode usar AI**: fica só por boias.
- O leitor manda pulsos largos (~400 µs). O firmware aceita a partir de ~40 µs, então há folga.
- A placa de MAC `98:A3:16:EB:E1:A0` tem a **AI1 com defeito**. Não usar essa placa para posto. Ela está hoje no Pivô 11,
  que não usa a AI1.
- A placa que fez o teste (MAC `10:51:DB:80:78:5C`) foi regravada depois como TON-MED do teste de controle e não está
  mais com o firmware do posto.
