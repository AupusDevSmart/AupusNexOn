# Relé Modbus TCP direto na TON — campo IP + leitura/proteções/comando via MBAP

> **Status:** ✅ IMPLEMENTADO e validado por geração (harness + compilação PIO). ⏳ Deploy pendente.
> **Data:** 2026-07-20
> **Motivação:** o usuário conectou o Siemens 7SR5111 (Modbus TCP nativo, porta 502) **direto na TON** por um link TCP no diagrama IoT — e não havia onde definir o IP do relé. Além do campo faltar na UI, o gerador descartava silenciosamente qualquer device TCP direto (gateway `null`), e o caminho TCP não tinha suporte a proteções (FC02) nem comandos (FC05).

---

## 1. O problema (3 camadas)

1. **Editor** (`iot-diagram.v2.js`): o componente Relé só tinha `name/catalog_id/modbus_address`. Campo IP existia apenas nos nós Conversor/Datalogger.
2. **Gerador — analyze** (`iot-firmware-generator.v2.js`, "Caso 2: TON ↔ Dispositivo TCP direto"): empurrava `gateway: null`, e o `_genInverterTcpCpp` filtra `d.gateway` → o relé **não gerava nenhum código de leitura**, sem aviso.
3. **Gerador — C++ TCP**: o transporte MBAP só lia registradores (FC03/04). Um relé precisa de **FC02** (discrete inputs = proteções ANSI + status DJ) e **FC05/06** (comandos trip/close/reset). O `modbus_exec_command` era exclusivo do módulo RS485.

## 2. O que foi implementado

### Fase 1 — IP no editor + gateway no Caso 2
- **`iot-diagram.v2.js`**: componente `rele_protecao` ganhou campos **`ip`** ("IP (Modbus TCP direto)") e **`tcp_port`** ("Porta TCP, vazio = 502"). Vazio = conexão RS485 (comportamento antigo intacto).
- **Gerador Caso 2**: monta `gateway: { ip: props.ip, port: props.tcp_port || catalog.default_port || 502, timeout_ms: 2000, mode: 'datalogger' }` (MBAP nativo — device TCP puro, sem CRC). **Sem IP**: warning explícito na validação (`warnings[]` + console) em vez de descarte silencioso.

### Fase 2 — Proteções/status via TCP (FC02)
- Novo helper C++ **`_modbus_tcp_read_bits`** (MBAP FC02/FC01): resposta de bits empacotados (LSB-first), validação de byteCount, dreno de excedente.
- `_genTcpInverterReader` agora emite o bloco BI quando o catálogo tem `bi_block` (ex.: 7SR5111 — 302 bits a partir do frame 101, 22-23 pontos): struct ganha `bi_[]` + `bi_valid`, leitura após o ciclo AI (falha de BI **não** invalida o AI), publicação com **guarda `bi_valid`** — nunca publica 0 "chutado" de proteção/DJ antes da 1ª leitura boa.
- Limitação registrada: BI **atrás de conversor USR (rtu_tcp)** não suportado (parse de bits RTU+CRC não implementado) — gera warning e lê só AI.

### Fase 3 — Comandos via TCP (FC05/FC06)
- Novo helper C++ **`_modbus_tcp_write`** (MBAP FC05 coil ON 0xFF00 / FC06 registrador).
- Nova função gerada **`inverter_tcp_exec_command(device, cmd)`** — espelha o `modbus_exec_command` do RS485 (match por nome+cmd, `steps[]` SBO com `delay_ms`).
- Dispatcher MQTT (`_process_command_inner` no main): tenta RS485, depois TCP; firmware só-TCP chama direto o TCP.

### Fase 4 — SOE (eventos) via TCP
- Novo `_genTcpDeviceEventPoll` — espelho do `_genDeviceEventPoll` RS485 (EVENTCOUNT FC04 qty1 + EVENT FC04 qty8, pop por leitura, teto 32/ciclo) com transporte `_modbus_tcp_read`.
- Fila vazia = exceção Modbus (tip. 2): o helper MBAP agora expõe `_tcp_last_exc` e o poll usa `_tcp_quiet_exc` pra não inundar o Serial com a exceção esperada a cada poll (~2s).
- `inverter_tcp_events_poll(publish)` + timer `last_evt_tcp` no main (período do `eventos.poll_ms` do catálogo, mín. 500ms), publicando no subtópico `evt` — mesmo formato do RS485 (ingestão do backend intocada).
- Gerado apenas quando o catálogo do device tem a chave `eventos` (o DB tem para os 7SR; o `.v2.js` estático não) e o transporte é MBAP.

### Extras
- `IOT_SCRIPTS_VERSION` → **`20260720-rele-tcp-ip`** (também corrige a pendência dos scripts editados em 14-16/jul servidos com cache velho — o bump anterior era de 03/jul).
- Fix de type-check pré-existente: `import { toast }` duplicado em `IotCatalogPage.tsx` (14/jul).

## 3. Como usar (o seu fluxo)

1. No diagrama IoT, abra o modal do relé → preencha **IP (Modbus TCP direto)** com o IP do 7SR5111 (e porta se ≠ 502). Salvar.
2. Confirme no relé (Reydisp Manager 2): Modbus TCP **habilitado** (vem OFF de fábrica), IP fixo na mesma rede da TON, Unit ID = Endereço Modbus do modal.
3. Gerar firmware → gravar na TON (OTA ou serial).
4. Validar no Serial/MQTT: log `[TCP-INV] RELE(id1) #N: va=... ia=...` + payload em `<base>/RELE_1/data` com medições e (após 1ª leitura FC02 boa) os bits de proteção.

## 4. Verificação realizada (sem relé físico)

Harness node (`analyze()` + `generateProject()` reais, catálogo real):
- **Caso A** (rele + IP): gateway correto; `_modbus_tcp_read(FC04)` nos 2 blocos AI; `_modbus_tcp_read_bits(FC02, 101, 302)` com 22 unpacks; 22 guardas `bi_valid` na publicação; comandos FC05 coils 226/108/99; dispatcher com fallback TCP. ✅
- **Caso B** (rele sem IP): warning na validação, reader não gerado (stub), sem crash. ✅
- **Caso C** (regressão datalogger+inversor Sungrow): byte-a-byte no caminho antigo, sem BI indevido. ✅
- **Compilação PIO** do projeto do Caso A (ESP32-S3). ✅ (ver resultado no fim)

## 5. Deploy

```bash
# 1. Type-check (política: vite build não checa tipos)
cd /var/www/service-nexon/AupusNexOn && npx tsc --noEmit

# 2. Deploy padrão (build + swap atômico do dist)
./deploy.sh
```
Arquivos tocados: `public/iot-diagram.v2.js`, `public/iot-firmware-generator.v2.js` (estáticos — chegam pelo bump do cache-buster) e `src/features/supervisorio/components/iot-diagram.tsx` (entra no build).
⚠️ A working tree tem MUITO trabalho não commitado de outras sessões (SOE, monitoramento-fv, planilha xlsx…) que **já está no dist de produção de 17/jul** — o deploy re-publica tudo do estado atual, que é o esperado.

## 5.1 Atualização 20/jul (tarde) — 7SR5111 dual-transporte com mapa default de fábrica

A bancada revelou que o 7SR5111 **não tem o espelho do 7SR10** — tem um **mapa default de fábrica** (30160+, INT32). Decisão do usuário: abandonar o espelho; **um cadastro só, servindo TCP e RTU, com a escolha automática pela conexão do diagrama** (link TCP + IP no modal → MBAP; link RS485 + endereço → RTU).

O que mudou:
- **Cadastro `siemens-7sr5111`** (protocolo `tcp/rtu`): mapa default completo — AI em **2 blocos de 40 regs** (30160-30199 + 30200-30239; 40 e não 80 porque o ModbusMaster do RS485 tem buffer de 64), 13 medições incl. **PF por fase** (30234-38 ÷1000, freq ÷100, demais em unidades primárias inteiras); **BI em 12 blocos esparsos** FC02 (bits não-mapeados dão exceção 2) com proteções por ELEMENTO (27-1, 50-1, 51-1…) + **CB-1 Status double-bit** (10013, PDU 12-13 → dj_aberto/dj_fechado, polaridade a confirmar); **comando DPC via FC15** no par de coils 00013 (value 1=abre / 2=fecha, a confirmar), sem cmd_reset (não há LED reset no mapa).
- **Gerador**: `bi_blocks[]` + `bi_map {block,bit}` agora também no **RS485** (legado `bi_block/coil` intacto — Pextron/7SR10 byte-idêntico), com guarda `bi_valid`; **FC15** nos dois executores (TCP `_modbus_tcp_write_coils`, RS485 `setTransmitBuffer`+`writeMultipleCoils`); warning se `ai_block.count > 64` (limite RS485).
- **RTU na prática**: configurar a porta serial do relé para **9600** (baud do barramento TON) e conferir no Reydisp que o **mapa RTU** (aba própria) tem os mesmos endereços do mapa TCP.

## 6. Pendências / próximos passos

- ~~SOE (eventos) via TCP~~ → **implementado na Fase 4** (20/jul). O 7SR5111 via TCP drena eventos e alimenta a página Eventos de Proteção, desde que o cadastro no DB tenha a chave `eventos`.
- **BI atrás de conversor USR (rtu_tcp)**: parse de bits RTU+CRC não implementado (leitura AI funciona; proteções não).
- **Validação física** (relé em bancada): offset, escala de P/Q (Mult), coil 108 fecha ou toggle — os mesmos itens do `IOT-SIEMENS-7SR5111-PREP.md` §3.
- **Paridade catálogo JS↔DB**: o DB (fonte da verdade) tem os ai_blocks do 7SR5/7SR5111 em 7 blocos (revisão 17/jul pós-bancada) e o Método B do DJ; o `.v2.js` estático segue com o layout de 03-13/jul. Não bloqueia (a UI usa o DB), mas convém sincronizar o fallback.

## Apêndice — arquivos modificados

- `AupusNexOn/public/iot-diagram.v2.js` — campos `ip`/`tcp_port` no `rele_protecao`.
- `AupusNexOn/public/iot-firmware-generator.v2.js` — Caso 2 com gateway direto + warning; helpers `_modbus_tcp_read_bits`/`_modbus_tcp_write`; BI no reader TCP (struct/leitura/publicação guardada); `inverter_tcp_exec_command` + declaração no header + stub; dispatcher com fallback TCP.
- `AupusNexOn/src/features/supervisorio/components/iot-diagram.tsx` — `IOT_SCRIPTS_VERSION = '20260720-rele-tcp-ip'`.
- Docs relacionados: `IOT-SIEMENS-7SR5111-PREP.md`, `IOT-SIEMENS-7SR-CADASTRO.md`, `IOT-SOE-EVENTOS-RELE.md`.
