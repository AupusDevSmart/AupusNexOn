# Posição do pivô por encoder absoluto (Hohner Série 67)

> **Status:** implementado em 09/11/2026 (catálogo + diagrama + gerador V1/V2 + backend + tela). Falta validar em bancada.
> Migração: `aupus-nexon-api/db/manual-migrations/2026-11-09_encoder_pivo.sql`.

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
2. **Barramento:** a TON lê o RS485 em 8N1 com a velocidade do barramento. O encoder tem de ter sido comprado na mesma velocidade e **sem paridade**; com paridade ímpar ele não conversa.
3. **Endereço:** o encoder não pode ter o mesmo endereço de outro dispositivo no mesmo RS485.
4. Diagrama IoT: adicionar o nó Encoder, ligar à TON, escolher o modelo e o endereço, salvar e gravar o firmware (ou fazer OTA).
5. Pivô → **Configuração → Posição do pivô**: escolher o encoder, a resolução do código de compra e salvar.
6. Com o pivô parado numa posição conhecida (ex.: alinhado ao norte do mapa), clicar **Zerar aqui** e salvar.
7. Girar em **Avanço**: o ângulo tem de **aumentar**. Se diminuir, ligar **Sentido invertido** e zerar de novo.

## 4. Conferir na bancada

- **Registrador base.** O catálogo lê a partir do endereço 0, pela convenção do catálogo: endereço do manual − 1. Se a posição vier sempre 0, travada, ou saltando de 65536 em 65536 ao girar o eixo, o encoder usa a base 1: trocar `ai_blocks[0].start` para 1 no modelo HOHNER Série 67 e regerar o firmware.
- **Exceção 2** (`rc=0x02` no Serial) = registrador inexistente → mesmo ajuste acima.
- **Timeout** (`rc=0xE2`) = velocidade ou paridade diferentes, A/B invertidos ou endereço errado.
- Encoder multivolta funciona (o backend usa só a parte de uma volta), desde que a contagem total fique abaixo de 2^24 (limite do float na TON).

## 5. Onde está no código

| Parte | Arquivo |
|---|---|
| Catálogo, modelo e nó da paleta | `aupus-nexon-api/db/manual-migrations/2026-11-09_encoder_pivo.sql` |
| Tipo `encoder` nas listas de dispositivo Modbus | `public/iot-firmware-generator.v2.js`, `public/iot-firmware-generator.ton-v2.js`, `public/iot-diagram.v2.js` |
| Equipamento auto-criado (tipo ENCODER) | `aupus-nexon-api/src/modules/iot/iot.service.ts` (`ensureDeviceEquipamentos`) |
| Conta do ângulo (testada) | `aupus-nexon-api/src/modules/pivos/pivo-posicao.util.ts` |
| Posição no estado e na parada por ângulo | `pivo-sequencia.service.ts` (`posicao`, `anguloAtual`) |
| Parâmetros (técnicos) e lista de encoders | `pivos.service.ts` (`opcoesEncoder`), `GET /pivos/:id/encoder/opcoes` |
| Tela | `src/features/supervisorio/v2/components/sheets/PivoSheet.tsx` (`SecaoEncoder`, `MapaPivo`) |
