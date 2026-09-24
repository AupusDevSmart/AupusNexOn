# Revisão — Plano de prevenção e recuperação de travamento (TON)

**Referente a:** `IOT-TON-PLANO-ANTITRAVAMENTO.md` (23/09/2026)

## Pontos fortes do plano

- Separação clara entre prevenção (não travar o laço) e recuperação em camadas (periférico → TON → log).
- Inventário com severidade ajuda a priorizar — SD (S1/S2) e broker (N2) corretamente como prioridade 1, dado que geram loop.
- Caso NSA como motivador concreto justifica a ordem das fases.
- Testes de bancada cobrem os casos certos: queda de energia no meio da gravação, SD arrancado em operação, broker que aceita TCP e não responde.

## Lacunas e riscos a endereçar

| Item do plano | Risco não coberto | Sugestão |
|---|---|---|
| A1 — contador de pendentes em NVS/RAM | Após reset abrupto (queda de energia, watchdog), o contador pode divergir do que está de fato no SD | Rotina de reconciliação no boot (recontar 1x, não a cada ciclo) ou validar contador vs. nº de segmentos existentes |
| A2 — ponteiro de leitura por segmento | Se a gravação do próprio ponteiro não for atômica, queda de energia no meio pode reenviar ou perder linhas do segmento em drenagem | Escrever o ponteiro com padrão write-temp-then-rename (ou CRC), igual ao tratamento dado aos segmentos |
| B4 — reset do W5500 após 5 min sem tráfego | "Sem tráfego" pode ser falso positivo em rede legitimamente ociosa | Keepalive/ping ativo periódico para distinguir "ocioso" de "travado" |
| C1 — reinício 1x a cada 6h por RS485 mudo | Se o contador não for persistido em NVS, zera a cada reboot e o limite vira letra morta | Persistir o timestamp do último reinício por essa causa |
| D1 — watchdog 60s → 30s | Reduzir antes de somar o pior caso real (várias transações Modbus de 2s + esperas legítimas) pode gerar falso watchdog em barramentos com muitos devices | Calcular o orçamento de pior caso do laço (nº de devices × timeout) antes de baixar o teto — não só "esperar A e B estarem no ar" |
| Reinícios concorrentes | Watchdog de conectividade, reset de RS485 e `reboot` manual podem competir; nada centraliza a decisão | Um único "gestor de reinício" que aplique teto global (ex.: máx. N reinícios/hora, não por causa isolada) |
| I1 — I²C travado (severidade hoje: Média) | Os dois MCP23008 não são só as entradas — um deles aciona os 6 relés. SDA preso pode travar um **atuador** (relé não desliga), não só atrasar leitura. Relevante especificamente para o projeto do posto de combustível, onde o relé controla a bomba | Reavaliar severidade para Alta nesse cenário; definir e documentar o fail-safe físico do relé quando o I2C trava (não há watchdog de hardware nos MCP23008) |

## Questionamentos objetivos

1. O reset do W5500 (B4) vai usar o pino físico dedicado (IO14, mapeado como "Ethernet — reset") ou apenas reinit via SPI? O esquemático mostra pino dedicado — reset físico é mais confiável que reinit por software.
2. Falta, na seção de testes, um caso de **falha simultânea** (SD cheio + broker fora ao mesmo tempo) para confirmar que as camadas de recuperação não competem pelo mesmo teto de 60s/30s do watchdog.
