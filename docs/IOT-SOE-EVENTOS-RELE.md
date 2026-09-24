# SOE (Sequence of Events) de relé de proteção — Modbus agora, DNP3 depois

> **Objetivo:** capturar eventos de proteção (trip/pickup/falta) **com timestamp de milissegundo carimbado na FONTE (o relé)**, sem perder evento entre polls.
> **Decisão (2026-07-14):** implementar **via Modbus primeiro** (o 7SR expõe buffer de evento); **DNP3 fica como alternativa futura** para relés que não ofereçam isso.
> **Manual:** `docs/reles/7SR5_Communication_Protocol_Manual_V2.40.pdf` §6.1 (Modbus RTU / Event Record), pág. 141-142.
> Relacionado: [IOT-SIEMENS-7SR-CADASTRO.md](./IOT-SIEMENS-7SR-CADASTRO.md).

---

## 1. Por que não dá pra fazer SOE com poll de medição

O poll de medição lê o valor **instantâneo no momento do poll**. Um pickup/trip de 50 ms entre dois polls:
- **some** (nunca foi lido), ou
- é lido com o **timestamp do poll**, não o do evento.

SOE exige que **o próprio relé** carimbe a hora e **guarde num buffer** até o mestre ler. É isso que o 7SR oferece — e (boa notícia) **por Modbus**, não só por DNP3.

## 2. O mecanismo no 7SR (Modbus)

O manual é explícito:

> *"Modbus does not define a method for extracting events; therefore **a private method has been defined based on that defined by section 5 IEC 60870-5-103**."*

| Registrador | Modicon | PDU (frame) | Função | O que é |
|---|---|---|---|---|
| **EVENTCOUNT** | 30001 | **0** | FC04, qty 1 | Quantos eventos há no buffer |
| **EVENT** | 30002 | **1** | FC04, **qty 8 (obrigatório)** | O evento **mais antigo** (16 bytes) |
| **Time** | 40001 | 0 | FC06/FC16 (write) | **Relógio do relé** (TIME_METER) — gravável |

**Regras (do manual):**
- Ler o EVENT **dá pop**: o registro lido é substituído pelo próximo.
- Tem que ler **exatamente 8 registradores**. Ler diferente → **exceção 2**.
- **Sem evento no buffer → exceção 2** (é o "fim da fila" normal, NÃO é erro).
- "The event address should be polled regularly by the master for events."

**Exemplo do manual (valida a convenção de endereço):** slave `0x01`, FC `0x04`, start `0x0001` (= 30002 − 30001), qty `0x0008`.

### 2.1 Layout do registro (16 bytes) — o byte 0 define o tipo

| Tipo | Byte 0 | 2 | 3 | 4 | 5-6 | 7-8 | 12-13 | 14 | 15 |
|---|---|---|---|---|---|---|---|---|---|
| **1** Event | `1` | FUN | INF | DPI | — | — | ms | Mi | Ho |
| **2** Event c/ Tempo Relativo | `2` | FUN | INF | DPI | RT | F# | ms | Mi | Ho |
| **4** Measurand c/ Tempo Rel. | `4` | FUN | INF | **Meas** (bytes 4-7) | RT (8-9) | F# (10-11) | ms | Mi | Ho |

| Campo | Significado |
|---|---|
| **FUN / INF** | Function Type / Information Number — **semântica IEC 60870-5-103** (qual função atuou) |
| **DPI** | 1 = OFF, 2 = ON |
| **ms L/H** | Timestamp — milissegundos |
| **Mi** | Minutos — **MSB = hora INVÁLIDA (relógio não setado)** |
| **Ho** | Horas — MSB = flag horário de verão |
| **RT** | Tempo relativo (ex.: pickup → trip) |
| **F#** | Número da falta |
| **Meas** | Medição no evento, formato **R32.23, LSB primeiro** |

### 2.2 ⚠️ O timestamp NÃO tem data
O relé manda só **hora:minuto:ms**. A TON completa a data pelo relógio dela (NTP), tratando **virada de meia-noite** (se a hora do evento > hora da TON com folga grande → é do dia anterior). Se o **MSB de `Mi`** estiver setado, o relógio do relé não está ajustado → o evento entra marcado como **hora não confiável**.

### 2.3 Sync do relógio (o que faz o SOE valer)
O único Holding Register habilitado no mapa exportado é **`Time` (40001, TIME_METER)** → **a TON escreve a hora do relé por Modbus**, periodicamente, a partir do NTP dela. Sem isso o timestamp não vale nada.

> Limite honesto: a precisão do SOE fica limitada ao relógio da TON (NTP ~dezenas de ms). Pra SOE de verdade em ms, o relé normalmente precisa de **IRIG-B/GPS**. Documentar essa limitação.

---

## 3. Arquitetura — agnóstica de protocolo (pra DNP3 entrar depois sem retrabalho)

**Regra:** o **firmware publica o evento CRU**; a **semântica vive no backend/catálogo**.

```
[Relé] --Modbus(evt buffer)--> [TON: decodifica 16 bytes] --MQTT--> [Backend: FUN/INF -> evento semântico] --> [SOE no NexON]
                                                                          ^
[Relé] --DNP3 (futuro)-------> [TON: objetos g2v2/g32v3] --MQTT---------- (mesmo modelo canônico)
```

### 3.1 Modelo canônico do evento (o contrato)
Não pode nascer amarrado a Modbus:

| Campo | Origem Modbus | Origem DNP3 (futuro) |
|---|---|---|
| `ts_fonte` (ms, com data completada) | ms/Mi/Ho + data da TON | timestamp do objeto (g2v2/g32v3) |
| `estado` (on/off) | DPI (1=OFF, 2=ON) | flag do binary event |
| `codigo` (bruto) | `FUN/INF` | `group/variation/index` |
| `evento` (semântico) | mapa FUN/INF → função | mapa index → função |
| `tempo_relativo_ms` | RT | (n/d ou objeto próprio) |
| `falta_num` | F# | — |
| `valor` | Meas (R32.23) | analog event |
| `hora_confiavel` | MSB de Mi | flag de qualidade |
| `origem_protocolo` | `modbus_7sr` | `dnp3` |

**O mapa `código bruto → evento semântico` é dado (tabela), não código.** Cada protocolo traduz o seu código pro mesmo conjunto de eventos semânticos. É isso que permite plugar DNP3 depois só adicionando um tradutor.

### 3.2 Por que a tabela FUN/INF fica no backend, não no firmware
- É **dado curável** (dá pra completar aos poucos, sem reflashar TON).
- A tabela IEC-103 é grande; não faz sentido gastar flash do ESP32 com ela.
- DNP3 depois reusa os **mesmos eventos semânticos**, só com outro tradutor.

---

## 4. Fases

### Fase 1 — Firmware (o coração)
- Loop de evento no reader Modbus: ler **EVENTCOUNT (PDU 0, qty 1)**; se `> 0`, ler **EVENT (PDU 1, qty 8)**, decodificar por `byte 0`, publicar, **repetir até esvaziar** (ou exceção 2 = fim).
- **Exceção 2 é normal** (fila vazia) — não pode entrar no back-off/cooldown de falha de leitura.
- **Sync do relógio**: write no `Time` (40001) periódico (ex.: no boot + a cada hora), do NTP da TON.
- Publicar em tópico próprio (ex.: `<base>/evt`) — **separado da telemetria**, porque evento é assíncrono e não pode ser perdido/agregado.
- Não deixar o poll de evento atrapalhar a telemetria (o loop já tem back-off).

### Fase 2 — Catálogo
Config de evento por modelo (agnóstica):
```json
"eventos": {
  "protocolo": "modbus_7sr",
  "count": { "func": 4, "reg": 0, "qty": 1 },
  "record": { "func": 4, "reg": 1, "qty": 8 },
  "clock":  { "func": 6, "reg": 0 },
  "sem_evento_excecao": 2
}
```

### Fase 3 — Backend
- Ingestão do tópico `evt` → tabela de SOE (append-only, imutável).
- Tradutor `FUN/INF → evento semântico` (tabela em dado, curável).
- Completar data + tratar virada de meia-noite + flag de hora não confiável.

### Fase 4 — Frontend
- Tela de SOE por relé/planta: hora da fonte (ms), evento, on/off, nº da falta, tempo relativo, valor.
- Ordenação pela **hora da fonte**, não pela de chegada.

### Fase 5 (futuro) — DNP3
Só um **tradutor novo** + o master DNP3 no firmware. O modelo canônico, a tabela de eventos, o backend e a tela **não mudam**.

---

## 5. Riscos / armadilhas

| Risco | Mitigação |
|---|---|
| **Exceção 2 confundida com erro** de leitura → back-off/cooldown indevido | Tratar exceção 2 no poll de evento como "fila vazia", caminho separado do erro de bloco |
| Relógio do relé não setado (MSB de Mi) | Sync via 40001 + marcar evento como hora não confiável |
| Virada de meia-noite (sem data no registro) | Regra de data na TON, documentada e testada |
| Buffer estourar se a TON ficar off | Esvaziar até `count = 0` a cada ciclo; o buffer do relé é finito |
| Perder evento por ler qty ≠ 8 | qty fixo em 8, sempre |
| Precisão limitada pelo NTP da TON | Documentar; IRIG-B/GPS se precisar de ms real |

## 6. Estado

- ✅ Mecanismo Modbus confirmado no manual (§6.1, pág. 141-142) + layouts dos 3 tipos + exemplo de frame.
- ✅ RS485 do 7SR5111 comissionado e lendo medições na bancada (2026-07-14).
- ⏳ Fases 1-4 a implementar.
- 📋 Tabela FUN/INF: extrair da seção 5 (IEC-103) do manual conforme aparecerem eventos reais na bancada.
