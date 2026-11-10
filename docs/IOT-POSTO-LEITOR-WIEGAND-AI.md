# Posto de combustível — leitor RFID Wiegand nas AI1/AI2 (TON-V2)

> **Status:** implementado em 10/11/2026 (lib + gerador TON-V2 + diagrama + modal). Falta validar em bancada.
> Migração da paleta: `aupus-nexon-api/db/manual-migrations/2026-11-10_posto_leitor_wiegand.sql`.
> Origem: `/var/www/documentacao/TESTE-WIEGAND-SU-TON400.md`. Lá a proposta era juntar D0 e D1 no SU+, separando os bits pela largura do pulso. Esta montagem é outra: cada linha vai numa AI e não precisa de componente nenhum.

## 1. Por que AI1/AI2

- A AI1 (IO6) e a AI2 (IO7) são pinos nativos do ADC1 e passam por um divisor 22k/3k3 (≈ 7,67:1). Os 5 V de repouso do leitor chegam a ~0,65 V no pino. A entrada aguenta até ~26 V, sem resistor, diodo nem capacitor.
- Cada linha tem a sua entrada: pulso na AI1 = bit 0, pulso na AI2 = bit 1.
- O ADC1 roda em **modo contínuo (DMA)**, a 80 mil conversões por segundo no total (uma amostra a cada 25 µs por canal), com atenuação de 0 dB. O repouso lê ~2800 de 4095 e o pulso lê ~0.
- Custo: AI1 e AI2 ficam com o leitor, então o nível do tanque vem só das boias. O gerador avisa e desliga o nível na AI.
- Limite: pulso de pelo menos ~40 µs. Se o `wg` mostrar bits faltando, o pulso deste leitor é curto demais: a saída é o SU+ com diodos.

## 2. Ligação (Garen GA-MF506)

| Fio do leitor | Vai em |
|---|---|
| Vermelho (VCC) | +12 V da fonte |
| Preto (GND) | GND da fonte **e** GND da TON (X77-2 ou X14-1) |
| Verde (D0) | **AI1** (X77-3) |
| Branco (D1) | **AI2** (X77-1) |
| Cinza (26/34) | solto (26 bits) |

## 3. No NexON

1. Rodar a migração da paleta (uma vez) e recarregar o editor (Ctrl+F5).
2. Diagrama IoT: TON-V2 com relés (ton3v2/ton4v2) + nó **Bomba de Combustível** → seção *Leitor & fluxômetro* → **Leitor RFID = "Wiegand nas AI1/AI2"**. "Ignorar a mesma tag por (s)": padrão 2.
3. Salvar e mapear os BO/BI do posto na TON, como sempre. Depois gerar o firmware e gravar.
4. Aproximar a tag. Na aba **RFID** do modal da bomba aparece **"Última tag lida: A1B2C3"**. **Usar esta tag** preenche o UID, e aí é só pôr a máquina e **Autorizar**.

## 4. Comandos na TON (Serial ou `<base>/cmd`)

| Comando | O que faz |
|---|---|
| `wg` | Mostra o repouso de cada linha (bruto e mV), os pulsos e as larguras mínima e máxima, os contadores (quadros, tags, teclas, inválidos e motivo, repetidos), o overflow do DMA e o último quadro: bits, larguras e intervalos em µs |
| `wg bruto on` / `off` | Imprime cada quadro assim que chega (é a Etapa A do teste) |
| `wg limpar` (ou `limpar`) | Zera os contadores |
| `card <UID>` / `mat <n>` | Simulação, como antes (o leitor real convive com ela) |

Log de uma leitura: `[WIEGAND] uid=A1B2C3 bits=26 paridade=ok`. Teclas: `[WIEGAND] tecla 4` … `[WIEGAND] matricula=1234`.

## 5. Regras do decodificador (lib `firmware-libs/wiegand`, 31 testes no host)

- **Quadro:** fecha após 25 ms de silêncio.
- **26 bits:** paridade par (bits 0–12) + 24 dados + paridade ímpar (13–25). **UID = hexa dos 24 bits**, 6 dígitos.
- **34 bits:** 8 dígitos hexa.
- **Teclado:** 4 bits por tecla (0–9, `*` = 10, `#` = 11) ou 8 bits (nibble alto = complemento). Dígitos acumulam, `#` envia a matrícula, `*` apaga, 15 s sem tecla apaga.
  - Se o leitor juntar a matrícula num quadro de 26 bits ao apertar `#`, ela chega como **tag**. O `wg` mostra isso, e aí se ajusta.
- **Descartados e só logados, nunca entregues como UID:** paridade errada, número de bits diferente de 4, 8, 26 ou 34, e tecla inválida.
- **Mesma tag dentro da janela:** ignorada. A janela anda enquanto a tag fica encostada.
- **Repouso:** calibrado sozinho (média lenta).
  - Linha sem repouso (leitor desligado) não gera pulso.
  - Pulso com mais de 3 ms (fio solto) não vira bit.

## 6. Critérios de aceite (do documento de teste)

| Item | Como conferir |
|---|---|
| 26 pulsos em 20 apresentações | `wg`: `tags` sobe 1 por apresentação, `invalidos` não sobe |
| Larguras | `wg`: largura mín./máx. de D0 e D1; o último quadro mostra cada uma |
| 20 leituras → 20 UIDs iguais | `wg bruto on` + afastar e reaproximar após a janela |
| 3 tags → 3 UIDs | Modal: "Última tag lida" muda |
| Paridade | `invalidos` + `[WIEGAND] quadro descartado: paridade` |
| Teclado | `[WIEGAND] tecla …` na ordem digitada + `matricula=` no `#` |
| Repetição | Tag encostada: `repetidos` sobe, `tags` não |

## 7. Onde está no código

| Parte | Arquivo |
|---|---|
| Decodificador (puro, testado) | `firmware-libs/wiegand/wiegand.{h,cpp}`, `test_wiegand.cpp` |
| Captura ADC contínuo + comandos | gerador `public/iot-firmware-generator.ton-v2.js` (`_genWiegandAi*`, `_genBombaCpp` com `wg`) |
| Campo no diagrama | paleta no banco (SQL acima) + fallback `public/iot-diagram.v2.js` |
| Última tag lida | `src/features/bomba-combustivel/BombaModal.tsx` (telemetria `ultima_tag`/`ultima_tag_s`) |
| Smoke | `scripts/smoke-firmware-ton-v2.mjs` caso W (+ `--compile`) |

A V1 (ton3/ton4) tem os mesmos IO6/IO7 e pode receber o leitor depois da bancada.
