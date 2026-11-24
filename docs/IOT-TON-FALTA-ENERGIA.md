# TON avisa falta e retorno de energia da rede (NEXON-146)

A TON publica `<topic_base>/energia` quando a rede da concessionária cai e quando volta. A API
(NEXON-145, `aupus-nexon-api/docs/FALTA-ENERGIA.md`) espera `FALTA_ENERGIA_CONFIRMAR_MIN` (3 min),
abre o chamado externo e pede o protocolo na Equatorial pelo robô do WhatsAupus.

Vale para a **TON v2** (`ton1v2`..`ton4v2`, `public/iot-firmware-generator.ton-v2.js`) com internet
própria (Ethernet/WiFi). TON v1 e satélite LoRa não geram o aviso.

## Hardware

A TON não sente a rede sozinha e apaga junto com ela. Precisa de duas peças:

1. **Alimentação que segura a falta** — fonte nobreak DC (12 V ou 24 V, trilho DIN, com bateria
   selada 12 V 7 Ah) ou um nobreak pequeno (600 VA). Ligar nela **a TON e o roteador/modem 4G**: sem
   o roteador o aviso fica guardado na TON e só sai quando a internet voltar (aí a API recebe falta
   e retorno juntos e não abre chamado). Autonomia mínima: 15 min.
2. **Sensor de rede numa entrada DIN** — contato seco que muda quando a rede some, ligado
   **antes** do nobreak, na entrada geral:
   - **Recomendado: relé de falta de fase / monitor de tensão trifásico** (ex.: relé supervisor
     de fase, alimentado pelas próprias fases). Pega queda total e perda de uma fase. Contato NA
     (fecha com a rede boa) → DIN da TON.
   - Monofásico ou sem verba: **relé auxiliar com bobina 220 Vca** ligado na rede; contato NA →
     DIN da TON.
   - Ligação: borne do contato no DINx e o outro no GND (comum) da TON. Fechado ao GND = 1.

Contato NA "fechado = rede presente" é o padrão: com o relé sem tensão o contato abre, então
qualquer queda (inclusive do próprio relé) vira falta. Fio solto também vira falta — a API só abre
o chamado depois de 3 min, e o `retorno` nunca chega; conferir a fiação na instalação.

Medidor Modbus e relé de proteção (f27/Pextron) **não** servem como sensor sozinhos: também apagam
com a rede, e a TON só veria "parou de responder". Ver `IOT-NEXON-EQUATORIAL-FALTA-ENERGIA.md` §12
para a discriminação de causa (disjuntor do cliente aberto também é "sem tensão").

## Configuração

Na TON do diagrama IoT (uma das duas, a primeira tem prioridade):

1. **Configurar BIs** da TON: ponto com nome de rede/energia (`Rede concessionária`, `Presença de
   rede`, `Energia da rede`, `Falta de fase`…) na DIN usada. Nome com "falta/queda/sem rede"
   significa ponto **ativo = falta**; o campo "invertido" (NF) inverte a leitura.
2. Campos da TON: **Aviso de falta de energia (entrada)** = DIN1..DIN8 e **Contato do relé de
   rede** = "Fechado = rede presente (NA)" ou "Aberto = rede presente (NF)".

Gerar o firmware e gravar (OTA ou cabo). Com a entrada vazia nada muda no firmware.

## Firmware

- Lê a DIN a cada ~50 ms; só aceita mudança que dure **2 s** (filtra piscada do religador).
- Mudou: grava o estado e o evento no NVS, registra `energia falta|retorno` na caixa-preta e
  publica `{"evento":"falta"|"retorno","ts":<epoch>}` em `<topic_base>/energia`, **não retido**.
- Sem broker: fila de 4 eventos (RAM + NVS) reenviada a cada 5 s até sair, na ordem, com o `ts` de
  quando aconteceu. Relógio ainda sem NTP no evento: o `ts` é calculado pelo `millis()` quando o
  relógio sincroniza; sem como saber, sai sem `ts` (a API usa a hora de chegada).
- Bateria acabou e a TON apagou: no boot compara a DIN com o último estado do NVS e publica o que
  mudou (ex.: `retorno`).
- QoS: a lib MQTT da TON (PubSubClient) só publica QoS 0. A garantia vem da fila: o evento só sai
  da fila depois do `publish` aceito com o broker conectado.

## Teste de bancada

1. API com `FALTA_ENERGIA_CONFIRMAR_MIN=1` (ou o padrão 3) e a TON de bancada vinculada a uma
   planta com UC e proprietário cadastrados (senão o chamado abre como `SEM_DADOS`).
2. TON + roteador na fonte nobreak; relé de rede numa tomada comum, contato na DIN configurada.
3. Acompanhar: `mosquitto_sub -h <broker> -t '<topic_base>/energia' -v` e o serial (`[ENERGIA]`).
4. Tirar o relé da tomada: em ~2 s sai `{"evento":"falta",...}`; depois do tempo de confirmação
   aparece o chamado externo no NexON (Chamados).
5. Religar: sai `{"evento":"retorno",...}` e o chamado fica resolvido.
6. Piscada (desligar e religar antes do tempo de confirmação): evento `CANCELADO`, sem chamado.
