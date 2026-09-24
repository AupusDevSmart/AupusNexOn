# IOT — Bomba de Combustível (abastecimento por RFID em postos de fazenda)

> Equipamento novo: controle de abastecimento autorizado por RFID em postos das fazendas,
> na **TON2** (placa SCH-TON-v1b). Máquinas autorizadas abastecem; o operador libera a bomba
> apresentando o cartão/tag. Doc de referência — arquitetura, IO, máquina de estados, dados,
> MQTT e o roteiro da **Fase 0 (bancada)**.

## 1. Arquitetura (confirmada com o dono)

**Controlador AUTÔNOMO no TON2, offline-first.** A lógica de liberar/acionar a bomba roda no
próprio TON2 (segurança + funciona sem internet). O NexON cadastra RFID/máquinas, **sincroniza a
whitelist** pro TON2, recebe telemetria/transações e gera o **relatório de abastecimento por
máquina** (irmão do relatório de consumo de energia — ver `IOT`/features `relatorios`).

Decisões travadas:
- **Autorização no TON2 (offline)**, com o leitor entregando o **UID real**.
- **Fluxômetro** mede **litros** por abastecimento.
- **Contator com pulso**: BO1 pulsa LIGA, BO2 pulsa DESLIGA.
- **"Tanque cheio" (BI1) = os dois** casos (tanque do posto + tanque da máquina) — detalhar em campo.

## 2. Achados de hardware do TON2 que MOLDAM o projeto (Fase 0)

Do firmware de bancada `PLATFORMIO/TESTES-BANCADA/TON-TESTE-V2` (placa SCH-TON-v1b):

| Recurso | Realidade na placa | Consequência |
|---|---|---|
| **DIN 1-8** | Expansor **MCP23008 @0x26** (I2C), `INPUT_PULLUP` | I2C é lento (ms) → **NÃO serve pra Wiegand nem pulso rápido**. Serve pra sinais LENTOS (boia, botoeira). |
| **Relés RL1-8** | Expansor **MCP23008 @0x27** (I2C) | OK pra acionar contator (BO1/BO2/BO3). |
| **4-20mA (AN_C1/2)** | IO39/40 — **S3 sem ADC nesses pinos** | **Nível NÃO pode vir do AN_C.** |
| **AN1/AN2** | Pinos 6/7 — **ADC nativo OK** (divisor 7.67; modos tensão e corrente) | Nível PODE vir daqui (via transmissor 0-10V ou shunt). |
| **RS485 (UART1)** | TX=18, RX=17, DIR=8 — TON2 é **mestre Modbus** | **Ponto forte.** Coloca leitor+fluxômetro+nível aqui. |
| Relés/DIN gerados | **off-by-one** conhecido (RL desloca −1 vs v1) | Cuidar no mapeamento do gerador. |

**Conclusão de arquitetura:** o caminho robusto é **tudo o que exige dado no RS485/Modbus** —
o TON2 já é mestre Modbus, e isso contorna (a) o Wiegand impossível no DIN-expansor, (b) o
fluxômetro-pulso impossível no DIN-expansor, (c) o 4-20mA morto.

## 3. Interfaces — PRIMÁRIO (RS485) e alternativas

**PRIMÁRIO — barramento RS485 multi-drop (UART1), 3 escravos Modbus:**
- **Leitor RFID Modbus** (ex.: ID 10) — expõe o "último UID lido" num registrador; o TON2 faz poll.
- **Fluxômetro Modbus** (ex.: ID 11) — volume acumulado + vazão; o TON2 lê o delta na transação.
- **Transmissor de nível Modbus** (ex.: ID 12) — nível do tanque. (Alternativa: sensor 0-10V/4-20mA→tensão no **AN1/AN2**.)

**Alternativa Wiegand (fallback, mais difícil nesta placa):** o UID por Wiegand precisa de **2 GPIO
NATIVOS do ESP32** (D0/D1) com interrupção — **não** dá no DIN-expansor. Exigiria reaproveitar
pinos nativos livres (ex.: os da UART LoRa/TR, se LoRa não for usado nesta bomba). Só se não houver
leitor Modbus disponível. Evitar conversor Wiegand→RS485.

**Fluxômetro por pulso (fallback):** se for medidor de pulso (não-Modbus), o pulso precisa ir a um
**GPIO nativo** (PCNT do ESP32), **não** ao DIN-expansor.

## 4. Mapa de IO no TON2

| Canal | Onde (placa) | Função na bomba |
|---|---|---|
| RL1 (BO1) | MCP23008 out @0x27, pino 0 | **Liga bomba** (pulso no contator) |
| RL2 (BO2) | MCP23008 out @0x27, pino 1 | **Desliga bomba** (pulso no contator) |
| RL3 (BO3) | MCP23008 out @0x27, pino 2 | **Solenoide de bloqueio** (corte independente) |
| RL4 (spare) | MCP23008 out @0x27, pino 3 | Sinaleiro/buzzer "autorizado/bombeando" (opcional) |
| DIN1 (BI1-posto) | MCP23008 in @0x26, pino 0 | Boia "tanque do posto cheio" |
| DIN2 (BI1-máquina) | MCP23008 in @0x26, pino 1 | Desarme do bico "tanque da máquina cheio" |
| DIN3 (E-stop) | MCP23008 in @0x26, pino 2 | Botoeira de emergência |
| RS485 (UART1) | TX18/RX17/DIR8 | Leitor RFID + Fluxômetro + Nível (Modbus) |
| AN1/AN2 | pinos 6/7 (ADC nativo) | Nível (alternativa ao nível-Modbus) |

## 5. Máquina de estados (firmware TON2)

```
IDLE (bomba desligada, solenoide fechada)
  └─ poll leitor RFID → UID lido
       ├─ UID ∉ whitelist        → REJEITADO (log, sinaleiro vermelho) → IDLE
       └─ UID ∈ whitelist
            ├─ tanque cheio (DIN) ou nível(Modbus/AN) < mínimo ou E-stop → BLOQUEADO (log motivo) → IDLE
            └─ ok → abre solenoide (BO3) + PULSO BO1 (liga) + lê volume inicial do fluxômetro → BOMBEANDO
BOMBEANDO
  ├─ tanque cheio (DIN)          → PULSO BO2 + fecha solenoide → FECHA transação → IDLE
  ├─ nível < mínimo              → PULSO BO2 + fecha solenoide → FECHA → IDLE
  ├─ E-stop                      → PULSO BO2 + fecha solenoide → FECHA (status abortado) → IDLE
  ├─ timeout N min (segurança)   → PULSO BO2 + fecha solenoide → FECHA → IDLE
  ├─ cartão retirado/re-lido     → PULSO BO2 + fecha solenoide → FECHA → IDLE
  └─ (poll do fluxômetro acumula litros durante a transação)
FECHA transação → grava local (offline) + publica MQTT: {uid, máquina, início, fim, litros, nível_antes, nível_depois, status}
```

Intertravamentos de segurança (não dependem de internet): E-stop, nível mínimo (protege a bomba de
funcionar seca), timeout, tanque cheio.

## 6. Sincronização da whitelist + buffer offline

- **Whitelist**: o NexON publica a lista de UIDs autorizados (por bomba) num **tópico MQTT retido**
  `<topic_base>/<MAC>/cmd/rfid_sync`; o TON2 grava em **NVS/flash** e passa a casar **offline**.
  Payload: lista de `{uid, maquina_id, limites?}`. Atualiza no boot e a cada mudança do cadastro.
- **Buffer de transações**: cada abastecimento é gravado **localmente** (SD/NVS) e publicado quando
  online; ao reconectar, faz **flush** dos pendentes (mesma filosofia do buffer da API). Nada se perde.
- **Limite litros/dia** (se for exigido offline): o TON2 precisa acumular o total diário por UID em
  flash. Decidir se é enforcement no device (offline) ou só controle/alerta no NexON (mais simples).

## 7. Modelo de dados (NexON) + tópicos MQTT

Tabelas:
- `bomba_combustivel_config` — por bomba: nível_min, timeout_s, k_fator_fluxo, ids Modbus (leitor/fluxo/nível), qual DIN é cada tanque.
- `rfid_autorizados` — `uid` → `maquina_id`/equipamento → operador → ativo → limites (litros/dia, horário, bombas permitidas).
- `abastecimentos` — posto/bomba, `uid`, maquina, início/fim, **litros**, nível_antes/depois, status (ok/abortado/bloqueado).

Tópicos (segue o padrão OTA `<topic_base>/<MAC>/cmd/ota`):
- `<topic_base>/<MAC>/cmd/rfid_sync` (retido) — whitelist NexON→TON2.
- `<topic_base>/<MAC>/data` — telemetria periódica (nível, estado, vazão).
- `<topic_base>/<MAC>/abastecimento` — evento de transação fechada (vira linha em `abastecimentos`).

## 8. Relatório de abastecimento por máquina

Reusa a via do **relatório de consumo de energia** (`service-nexon` features/relatorios): componente
React → tela + PDF pelo gerador isolado. Métricas: litros por máquina/período, nº de abastecimentos,
horários, rejeições/bloqueios, nível do tanque ao longo do tempo, consumo do posto.

## 9. FASE 0 — Roteiro de bancada (validar ANTES de qualquer campo)

Firmware de teste dedicado: `PLATFORMIO/TESTES-BANCADA/BOMBA-COMBUSTIVEL-FASE0` (reusa pinout e
padrões RS485/MCP do `TON-TESTE-V2`). Checklist:

1. **Relés/contator** — pulsar RL1 (liga) e RL2 (desliga) e ver o contator selar/abrir; RL3 solenoide.
2. **DIN lentos** — acionar boia (DIN1/DIN2) e botoeira (DIN3), confirmar leitura via MCP @0x26.
3. **RS485/Modbus** — pingar os 3 escravos (leitor ID10, fluxo ID11, nível ID12); ler UID do leitor,
   volume acumulado do fluxômetro, nível do transmissor.
4. **Nível** — confirmar leitura (Modbus **ou** AN1/AN2 nativo); **confirmar que AN_C está morto**.
5. **Ciclo completo** — apresentar cartão → autorizar (lista teste) → pulso liga → acumular litros →
   pulso desliga → imprimir a "transação" no Serial.
6. **(fallback) Wiegand** — só se for testar o plano B: D0/D1 em GPIO nativo, decodificar UID.

**Saída da Fase 0:** confirmar leitor/fluxo/nível Modbus reais (modelo, mapa de registradores),
K-fator do fluxômetro, e o comportamento do contator. Com isso, Fase 1 (firmware de produção) começa.

## 10. Faseamento

- **Fase 0** — bancada (este doc §9). Firmware de teste + POP.
- **Fase 1** — firmware de produção TON2: máquina de estados, whitelist local (NVS), buffer offline; tipo no catálogo IoT.
- **Fase 2** — NexON: cadastro `rfid_autorizados` + `bomba_combustivel_config`, sync MQTT da whitelist, ingestão de `abastecimentos`.
- **Fase 3** — relatório de abastecimento por máquina (via dos relatórios).
