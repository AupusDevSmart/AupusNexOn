# Sungrow via Logger (Modbus TCP) — o sistema já está pronto?

**Pergunta:** as TONs em campo, ao ler os inversores Sungrow, inflam a geração diária
lida pelos loggers (geração falsa), o app da Sungrow identifica a TON como bateria,
multiplica inversores, etc. **O ideal seria requisitar direto pro logger. Nosso
sistema está pronto? Teria que requisitar por TCP, certo?**

**Resposta curta:** **Sim, já está pronto — e sim, é por TCP.** O gerador de firmware
já tem os dois transportes TCP implementados e separados. O que causa o problema em
campo **não é falta de recurso no sistema, é a escolha do nó no unifilar**: hoje o
Sungrow está sendo ligado por um **Conversor (USR-W610)**, que faz a TON virar um
**segundo mestre no RS485**. O certo é ligá-lo por um nó **Datalogger**, que fala
**Modbus TCP puro (MBAP)** com o logger da Sungrow — aí a TON é só um *cliente TCP*,
o logger continua sendo o único mestre do RS485, e nada é inflado.

---

## Por que o problema acontece (a raiz)

Sungrow lê os inversores **por RS485** (confirmado no manual do Logger1000/WiNet — o
logger é o mestre do barramento RS485; ver [[project_chimarrao_ubs_m160_addr_collision]]
para o padrão de colisão de mestre). Só pode haver **um mestre** no RS485.

- **Tem logger + a TON entra no MESMO RS485 (via USR-W610 transparente):** dois mestres
  no barramento → colisão. As leituras da TON "aparecem" no tráfego que o logger
  contabiliza, o firmware da Sungrow interpreta os frames estranhos como bateria /
  inversor-fantasma → geração inflada no app deles. **É o caso quebrado.**
- **A TON pede pro logger por TCP (MBAP):** a TON é *cliente*, não mestre. O logger
  segue como único mestre do RS485. Zero interferência no app da Sungrow. **É o certo.**

O detalhe é que **os dois casos são "por TCP, porta 502"** — a diferença está no *frame*
e em *o que está no outro lado do IP*.

---

## O que já existe no gerador (`iot-firmware-generator.v2.js`)

O `_processTCP` já ramifica em dois tipos de nó, com dois transportes distintos:

| Nó no unifilar | `gateway.mode` | Transporte gerado | Função de leitura | Papel da TON no RS485 |
|---|---|---|---|---|
| **`inverter_datalogger`** (Datalogger) | `'datalogger'` | **MBAP** — Modbus TCP puro | `_modbus_tcp_read` | **Cliente TCP** (não toca no RS485) ✅ |
| **`conversor`** (USR-W610) | `'rtu_tcp'` | **RTU-sobre-TCP + CRC16** (bridge transparente) | `_modbus_rtu_tcp_read` | **Mestre do RS485** ❌ |

Dispatch no firmware (linha ~1047):
```js
const _readFn = (gw.mode === 'rtu_tcp') ? '_modbus_rtu_tcp_read' : '_modbus_tcp_read';
```
Ambos vão pra `ip:port` (default **502**). O nó Datalogger monta o **cabeçalho MBAP**
(transaction id + unit id = `modbus_address` do inversor + função `0x04`); o Conversor
monta **RTU + CRC16** e joga cru no RS485.

O perfil do catálogo já reflete isso — `iot_nexon/devices/sungrow.json`:
```json
"model": "String Inverter (via Datalogger)",
"protocol": "modbus_tcp",
"modbus_function": "0x04",
"default_port": 502,
"compatible_connections": ["tcp_direct"]
```
E o sketch de referência `ARDUINO/ESP32_OTA/esp32_requisicao_inversor_sungrow.ino` já
conecta num `logger_ip:502` com frames MBAP e endereça cada inversor pelo `inverterId`
(unit id). **Ou seja: o "requisitar direto pro logger" já é o comportamento nativo do
perfil Sungrow.**

---

## As diferenças concretas (Datalogger MBAP vs Conversor USR)

| Aspecto | Datalogger — MBAP (✅ correto) | Conversor USR-W610 — RTU/TCP (❌ atual) |
|---|---|---|
| **Frame** | MBAP (7 bytes de header, sem CRC) | RTU puro + CRC16, encapsulado em TCP |
| **O que está no IP** | Logger Sungrow (Logger1000/COM100/WiNet-S) | USR-W610 fazendo bridge transparente pro RS485 |
| **Mestre do RS485** | O logger (único) | A TON passa a mandar frames no RS485 → 2º mestre |
| **Endereçamento** | unit id no MBAP = `modbus_address` do inversor (1,2,3…) | mesmo `modbus_address`, só que dentro do RTU |
| **Mapa de registradores** | **idêntico** — mapa 5000-based do `sungrow.json`, função 0x04 | idêntico (o logger é passthrough) |
| **Porta** | 502 | 502 |
| **Impacto no app Sungrow** | nenhum | infla geração, "bateria", inversor-fantasma |
| **Tempo real** | sim (o logger poda continuamente) | sim, mas quebrando a leitura oficial |

**Chave:** o **mapa Modbus e o unit id são os mesmos** nos dois casos — não muda nada
no catálogo nem no cadastro do inversor. **A única diferença é por qual nó ele passa**
(Datalogger vs Conversor) → o gerador escolhe MBAP vs RTU-sobre-TCP.

---

## O que precisa mudar (nada de código)

Não há mudança de firmware nem de backend. É **cadastro/unifilar**:

1. No unifilar da planta Sungrow, ligar os inversores a um nó **Datalogger**
   (`inverter_datalogger`), **não** a um **Conversor (USR-W610)**.
2. No nó Datalogger, `ip` = IP do **logger da Sungrow** (Logger1000/COM100 por
   Ethernet, ou WiNet-S por Wi-Fi com **DHCP reservado**), `port` = 502.
   - Habilitar **Modbus TCP** no logger (Logger1000: *Modbus* → *TCP server*;
     WiNet-S: *Modbus* habilitado).
3. Manter as conexões inversor→datalogger com `style: 'rs485'` no diagrama (é só a
   representação visual do encadeamento físico que o **logger** mestra — a TON não
   entra nesse RS485).
4. `modbus_address` de cada inversor = o endereço RS485 configurado no logger (1,2,3…),
   igual já é hoje.
5. Regerar o firmware e OTA (política de OTA obrigatório — [[feedback_ota_safety_required]]).

**Sites sem logger:** a solução real é **instalar um logger Sungrow** (Logger1000/COM100
p/ vários inversores, ou WiNet-S p/ 1) e a TON lê dele por TCP. Continuar via USR no
RS485 sempre vai reintroduzir o 2º mestre — não é questão de firmware, é topologia.

---

## Resumo

- **Pronto? Sim.** MBAP/datalogger já implementado, testado no perfil Sungrow e no
  sketch de referência.
- **Por TCP? Sim** — mas o TCP "certo" é **MBAP via nó Datalogger**, não RTU-sobre-TCP
  via Conversor/USR.
- **Correção:** trocar o nó no unifilar (Conversor → Datalogger apontando pro logger) +
  habilitar Modbus TCP no logger. Zero mudança de código; mapa e unit id inalterados.
- **Onde não há logger:** instalar um. É o único jeito de a TON ler sem virar 2º mestre.

---

# O problema é só da Sungrow, ou de qualquer marca?

**Não é da Sungrow — é físico do RS485.** Um barramento RS485 admite **um único mestre**.
O conflito aparece em **qualquer marca** sempre que a TON entra como **2º mestre** no
mesmo RS485 que o equipamento de monitoramento do fabricante já está mestreando. O que
muda entre marcas é *onde* o monitoramento do fabricante fica.

| Marca (perfil no catálogo) | Monitoramento do fabricante | Mestra o RS485? | Tap RS485 = conflito? | Leitura correta |
|---|---|---|---|---|
| **Sungrow** (`sungrow.json`, SG75CX/110CX) | WiNet-S (1 inv.) · Logger1000/COM100 (até 30) | **Sim** | **Sim** | Modbus TCP no logger (502, MBAP) |
| **Huawei** (`huawei_sun2000.json`) | SmartDongle (WLAN/4G) · SmartLogger | **Sim** — mestra o cascateamento RS485_1/2 | **Sim** | Modbus TCP no SmartLogger/Dongle (502, MBAP — §6.2.2 do protocolo) |
| **GoodWe / WEG SIW400** (`goodwe_mt.json`) | Wi-Fi (SEMS) **ou** EzLogger Pro | **Depende:** Wi-Fi = porta dedicada (NÃO mestra) · EzLogger Pro = via RS485 (mestra) | **Só se houver EzLogger Pro** | 1 inv. c/ Wi-Fi → TON pode ser único mestre no RS485 ✅ · multi c/ EzLogger → TCP no EzLogger |

## Prova documental

- **Huawei** — *Solar Inverter Modbus Interface Definitions V3.0*, §6.2, descreve os **dois
  modos idênticos aos da Sungrow**:
  - **§6.2.1 Modbus-RTU** — serial, 1 mestre, escravos 1–247. "A parte que inicia a
    requisição é o *master node*." → se o SmartDongle/SmartLogger está no barramento, ELE
    é o mestre.
  - **§6.2.2 Modbus-TCP** — §6.2.2.3: *"unit 0 acessa o escravo diretamente conectado, e os
    demais endereços acessam os equipamentos **a jusante** do escravo"* (o SmartLogger é o
    host TCP; inversores cascateados endereçados por unit id). §6.2.2.4: **porta 502**,
    MBAP. **É exatamente o modelo "logger-TCP" do `sungrow.json`.**
- **WEG SIW400 = GoodWe OEM** (Portal SEMS, `br.goodwe.com`, EzLogger Pro — manual §4.4.7/4.4.5).
  O RS485 é **daisy-chain de vários inversores** (pinos 1/2 e 5/6 = mesmo par in/out,
  terminação 120 Ω — Fig 4.18/4.19). O **módulo Wi-Fi** (SEMS) pluga numa **porta dedicada**
  e lê o inversor **internamente** (Fig 4.20) → **não** entra no RS485. O **EzLogger Pro**
  conecta *"por meio da porta RS485"* (§4.4.5) → **mestra** o RS485.

## Conclusão multi-marca

- **Sungrow e Huawei:** mesma história, mesma solução — há sempre um logger/dongle
  mestreando o RS485; ler por **Modbus TCP no logger (502, MBAP, unit id a jusante)**.
  Ambos documentam isso no próprio protocolo.
- **GoodWe/WEG:** é a **exceção** no caso de **1 inversor com Wi-Fi** — o RS485 fica **livre**
  (porta escrava dedicada), a TON pode ser **único mestre** sem conflito. Só vira conflito
  com **EzLogger Pro** (multi-inversor) mestreando o RS485.
- **O sintoma varia por marca** (Sungrow: "vira bateria" / infla geração; Huawei/GoodWe:
  erros de comunicação, inversor sumindo, totais errados), mas a **raiz é a mesma**:
  contenção de barramento por 2 mestres.

---

# Todos os casos já estão prontos pra TCP?

**Sim — a capacidade é universal e já existe.** Confirmado direto na fonte-da-verdade
(o **banco**, não os JSON estáticos):

- O **catálogo vive no DB** (`iot_device_tipos` + `iot_device_modelos`); o
  `device-catalog.js` que o gerador carrega é **auto-gerado do DB**. Os arquivos
  `iot_nexon/devices/*.json` são **legado/ignorados** pelo sistema rodando.
- **Todo inversor no DB já tem `ai_blocks` com a função Modbus explícita por bloco:**
  Sungrow (func **4**, base 5000) · Huawei SUN2000 (func **3**, base 32016) · GoodWe GW-MT
  (func **3**, base 35100) · WEG SIW400 (func **3**, base 768 = mapa GoodWe).
- O **gerador emite MBAP com a função de cada bloco** (`_modbus_tcp_read(..., b.func, ...)`,
  linha ~1059) — não há função hardcoded. Então um Sungrow (func 4) e um GoodWe (func 3) lidos
  por TCP saem com a função certa automaticamente.
- **O gerador escolhe RS485 vs TCP pelo *estilo da conexão no diagrama* (`conn.style`), NÃO
  pelo `protocolo` do device.** O campo `protocolo` (rtu/tcp) do catálogo é **só um rótulo de
  exibição** na tela de admin — não controla o firmware nem a conexão.

**Conclusão:** para ler qualquer inversor por TCP, basta **desenhar o inversor através de um
nó Datalogger com link `tcp`** no unifilar, apontando pro IP do logger:502. O firmware gerado
já fica correto (MBAP + função do device + unit id do inversor a jusante). **Nada a mudar em
código ou catálogo.**

## Estado por marca (do DB, `iot_device_modelos`)

| Marca / modelo | `protocolo` (rótulo) | Nota | Pronto p/ TCP? |
|---|---|---|---|
| Sungrow SG75/110/250CX, SG333HX | `rtu` | "RS485 direto (9600 8N1) **ou TCP via WiNet-S**" | ✅ (blocos func 4) — via WiNet-S/Logger1000 |
| Huawei SUN2000-75/100KTL M1 | `tcp` | "Via SmartLogger TCP" | ✅ (blocos func 3) |
| GoodWe GW-MT Series | `rtu` | "RS485 direto" | ✅ (blocos func 3) — **se** o logger expuser Modbus TCP (EzLogger Pro sim; kit WiFi básico não) |
| **WEG SIW400 ST075** | `tcp` | "**rebrand GoodWe MT**" (mapa 0x0300) | ✅ |
| **WEG SIW500H ST060** | `tcp` | "**rebrand Huawei**" (regs 30070/32016) | ✅ |

> **Sobre "WEG é Huawei":** o DB já distingue — **SIW500H = Huawei**, **SIW400 = GoodWe**.
> Cada um com o mapa Modbus certo. (O antigo `devices/weg_siw400.json` estático tinha o mapa
> Huawei por engano, mas esse arquivo é ignorado — o DB está correto.)

## Único caveat real (não é do nosso sistema)

O que varia por site é se o **logger expõe Modbus TCP**:
- **Sungrow** WiNet-S e Logger1000/COM100 → expõem (porta 502). ✅
- **Huawei** SmartLogger/SmartDongle → expõem (§6.2.2). ✅
- **GoodWe/WEG-SIW400** → só o **EzLogger Pro** (ou logger equivalente com Modbus TCP); o
  módulo Wi-Fi básico (SEMS) **não** expõe Modbus TCP local. Sem logger e sem EzLogger,
  o jeito é RS485 direto mesmo (aceitando o comportamento do §"onde não há logger").

**Alinhamento cosmético opcional:** enriquecer a nota do GoodWe GW-MT no DB pra citar
"ou TCP via EzLogger Pro" (hoje só diz "RS485 direto"), pra quem configura no admin saber
que a opção existe. Zero impacto funcional.
