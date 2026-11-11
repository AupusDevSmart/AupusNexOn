# Posição do pivô por encoder absoluto (Hohner Série 67)

> **Status:** implementado em 09/11/2026 (catálogo + diagrama + gerador V1/V2 + backend + tela). Falta validar em bancada.
> Migração: `aupus-nexon-api/db/manual-migrations/2026-11-09_encoder_pivo.sql`.
> **11/11/2026 (NEXON-103):** o zero e o sentido passam a vir da **Calibração** (seção 5); velocidade e stop bits do
> RS485 ficam no nó Encoder do diagrama. Migração: `2026-11-11c_calibracao_angulo.sql`.

## 1. O encoder

Datasheet: `/var/www/documentacao/Data Sheet serie 67 (1).pdf`.

| Item | Valor |
|---|---|
| Alimentação | 24 Vdc (12 a 28 V), 100 mA |
| Interface | RS485 **não isolada**, Modbus RTU |
| Velocidade e paridade | 9600 ou 19200, sem paridade ou ímpar, conforme o **código de compra** |
| Endereço | 1 a 7, por jumper no conector (pinos 5 a 8 ligados ao comum), ou fixo de fábrica |
| Leitura | FC03. Registro 01H = 16 bits baixos, 02H = bits altos |
| Resolução de uma volta | 360, 2048, 4096 ou 8192 posições (código de compra) |
| Fios (versão com cabo) | preto 0 V · vermelho +24 V · azul RS485− (B) · branco RS485+ (A) |

O encoder vai no **centro do pivô**, com o eixo acoplado à parte que gira: uma volta do eixo = uma volta do pivô.

## 2. Como o dado chega

```
Encoder ──RS485──▶ TON ──MQTT/LoRa──▶ <base>/Encoder_<end>/data  {"timestamp","samples","posicao"}
                                            │
                       equipamento ENCODER (criado ao salvar o diagrama)
                                            │
     Configuração do pivô: encoder + resolução + sentido + zero ──▶ ângulo do pivô
```

1. No diagrama IoT, o nó **Encoder** (grupo Irrigação / Bomba) é ligado à TON por RS485, com o modelo **HOHNER Série 67** e o endereço Modbus.
2. O gerador lê o encoder como qualquer dispositivo do catálogo (`encoder_posicao`): FC03, 2 registradores, palavra baixa primeiro, modo `last` (média de ângulo não faz sentido). Pelo LoRa vai em JSON curto (cerca de 50 bytes).
3. Ao salvar o diagrama, o backend cria o equipamento ENCODER com o tópico (`ensureDeviceEquipamentos`).
4. O backend converte a contagem em ângulo (`pivo-posicao.util.ts`):
   `ângulo = ((bruto mod resolução) × 360 / resolução)`, espelhado se invertido, `+ correção do zero`, normalizado em 0 a 360°.
5. O ângulo vai no `GET /pivos/:id/estado` (`posicao`), aparece no mapa da tela do pivô e alimenta a parada por ângulo e a previsão de término. Leitura com mais de 15 min **não vale**: o ângulo fica vazio e o mapa mostra o motivo.

## 3. Comissionamento

1. Rodar a migração (uma vez) e reiniciar a API.
2. **Barramento:** no nó Encoder do diagrama escolha a **velocidade** (9600 ou 19200) e os **stop bits** (1 ou 2) do código de compra — o firmware sai com o RS485 **inteiro** da TON nessa configuração (os outros dispositivos do mesmo barramento têm de acompanhar; o gerador avisa). Sempre 8 bits, **sem paridade**; com paridade ímpar o encoder não conversa. Sem resposta com 1 stop bit, testar 2.
3. **Endereço:** o encoder não pode ter o mesmo endereço de outro dispositivo no mesmo RS485.
4. Diagrama IoT: adicionar o nó Encoder, ligar à TON, escolher o modelo e o endereço, salvar e gravar o firmware (ou fazer OTA).
5. Pivô → **Configuração → Posição do pivô**: escolher o encoder, a resolução do código de compra e salvar.
6. Abrir a aba **Calibração** do pivô e seguir a seção 5 abaixo. (O "Zerar aqui" da Configuração só vale para pivô sem calibração; com calibração ativa o zero e o sentido ficam travados ali.)
7. Girar em **Direita**: o ângulo tem de **aumentar**. Se diminuir, o NexON abre o alarme "Sentido invertido — recalibrar": refazer a calibração com o outro sentido.

## 4. Conferir na bancada

- **Registrador base.** O catálogo lê a partir do endereço 0, pela convenção do catálogo: endereço do manual − 1. Se a posição vier sempre 0, travada, ou saltando de 65536 em 65536 ao girar o eixo, o encoder usa a base 1: trocar `ai_blocks[0].start` para 1 no modelo HOHNER Série 67 e regerar o firmware.
- **Exceção 2** (`rc=0x02` no Serial) = registrador inexistente → mesmo ajuste acima.
- **Timeout** (`rc=0xE2`) = velocidade ou paridade diferentes, A/B invertidos ou endereço errado.
- Encoder multivolta funciona (o backend usa só a parte de uma volta), desde que a contagem total fique abaixo de 2^24 (limite do float na TON).

## 5. Calibração do ângulo (NEXON-103)

A contagem do encoder não é o azimute. A calibração associa **uma leitura** (`bruto_cal`) ao **azimute real** do braço
(`az_cal`, do centro até a ponta, 0° = norte verdadeiro, horário), medido em campo:

```
ângulo = ( az_cal + s · (bruto − bruto_cal) · 360/resolução ) mod 360      s = +1 Horário · −1 Anti-horário
```

Com o encoder de 360 posições o fator é 1. Na TON a mesma conta fica guardada como resolução + sentido + zero
(`pivo enc <res> <inv> <zero>`, com `zero = az_cal − s·bruto_cal·360/res`): a placa calcula sozinha, sem internet.

**Na tela (pivô → Calibração), só Admin e analistas:**
1. **Ler encoder** — a TON faz 5 leituras Modbus seguidas (`pivo encler`); só vale se todas vierem, iguais ou variando ±1.
2. **Sentido** — Horário se a contagem aumenta com o pivô andando no horário (visto de cima); Anti-horário se diminui.
3. **Centro** e **ponta** (a última torre), em graus decimais, digitados ou pela localização do aparelho. Distância mínima 50 m.
4. **Salvar calibração** só libera com o pivô **parado** e a chave em **modo TON** (ponto de status `Modo_TON` ligado a uma BI
   na Topologia; pivô sem esse ponto não exige). O NexON manda para a TON, **espera a placa confirmar** e só então grava
   (`calibracao_angulo`; a anterior é desativada, nunca apagada). **Restaurar calibração anterior** reativa a última inativa.

**Sem calibração** o pivô com encoder mostra só o valor bruto, com aviso, e a parada por ângulo não usa o encoder.
Trocar o encoder ou a resolução na Configuração desativa a calibração.

**Alarmes** (lista de alarmes, `dados_snapshot.kind = 'pivo_angulo'`):

| Alarme | Regra |
|---|---|
| Encoder sem resposta | A TON pausa o encoder depois de 3 leituras seguidas com erro/timeout e para de publicar; o NexON abre o alarme com 5 min sem leitura nova e a TON online. Fecha sozinho quando a leitura volta. |
| Sentido invertido — recalibrar | Comando Direita ativo e o ângulo andando mais de 2° ao contrário (ou Esquerda e aumentando). Fecha ao recalibrar. |
| Pivô travado | Girando e o ângulo parado por X min (`travado_min` na Configuração, padrão 10). O prazo nunca é menor que o dobro do tempo de um passo do encoder na velocidade atual (a 10 % um encoder de 360 posições leva 35 min por grau). |

## 6. Onde está no código

| Parte | Arquivo |
|---|---|
| Catálogo, modelo e nó da paleta | `aupus-nexon-api/db/manual-migrations/2026-11-09_encoder_pivo.sql` |
| Tipo `encoder` nas listas de dispositivo Modbus | `public/iot-firmware-generator.v2.js`, `public/iot-firmware-generator.ton-v2.js`, `public/iot-diagram.v2.js` |
| Equipamento auto-criado (tipo ENCODER) | `aupus-nexon-api/src/modules/iot/iot.service.ts` (`ensureDeviceEquipamentos`) |
| Conta do ângulo (testada) | `aupus-nexon-api/src/modules/pivos/pivo-posicao.util.ts` |
| Posição no estado e na parada por ângulo | `pivo-sequencia.service.ts` (`posicao`, `anguloAtual`) |
| Parâmetros (técnicos) e lista de encoders | `pivos.service.ts` (`opcoesEncoder`), `GET /pivos/:id/encoder/opcoes` |
| Tela | `src/features/supervisorio/v2/components/sheets/PivoSheet.tsx` (`SecaoEncoder`, `MapaPivo`) |
| Calibração: conta, serviço e rotas | `aupus-nexon-api/src/modules/pivos/pivo-calibracao.util.ts`, `pivo-calibracao.service.ts`, `GET/POST /pivos/:id/calibracao[/ler-encoder|/restaurar]` |
| Alarmes do ângulo | `aupus-nexon-api/src/modules/pivos/pivo-angulo-alarme.service.ts` |
| Leitura sob demanda na TON (`pivo encler`) | `firmware-libs/pivo_local/glue/pivo.cpp` + `pivo_encoder_amostrar()` gerado no `modbus_meter.cpp` |
| Tela de calibração | `src/features/supervisorio/v2/components/sheets/PivoCalibracao.tsx` |
