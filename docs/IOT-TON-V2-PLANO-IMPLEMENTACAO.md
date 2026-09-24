# Plano de Implementação — TON-V2 no NexON (gerador separado)

> 2026-07-21. Insumos: `/var/www/IOT-TON-V2-BRIEFING.md` (como fazer),
> `/var/www/SCH-TON-v1b.pdf` + `docs/IOT-TON2-BASE-CONHECIMENTO-TESTES.md` §1b (o que mudou no hardware).
> Premissas do usuário: **gerador de firmware da V2 em arquivo SEPARADO** (zero toque no
> `iot-firmware-generator.v2.js`); **o sistema atual continua funcional** durante e depois de cada fase.

---

## 0. Estratégia e por que ela é segura

**Descoberta-chave (verificada no código):** o gerador V1 só enxerga TONs cuja `comp.type` está na
lista fechada `const tonTypes = ['ton1','ton2','ton3','ton4']` (`iot-firmware-generator.v2.js:40-41`).
Tipos novos `ton1v2..ton4v2` são **invisíveis para o V1** sem nenhuma alteração nele. O acesso
`TON_CAPS[c.type]` (G:83) é guardado por `&&` e `tonCaps()` tem fallback (G:23) — tipo novo não quebra nada.

Arquitetura da separação:

```
iot-firmware-base.v2.js      (V1, INTOCADO)   → global FIRMWARE_BASE
iot-firmware-generator.v2.js (V1, INTOCADO)   → global FirmwareGenerator      (só vê ton1..ton4)
iot-firmware-base.ton-v2.js      (NOVO, fork) → global FIRMWARE_BASE_TON_V2
iot-firmware-generator.ton-v2.js (NOVO, fork) → global FirmwareGeneratorTonV2 (só vê ton1v2..ton4v2)
iot-diagram.v2.js            (edits ADITIVOS) → tipos/caps/regras de conexão dos 2 mundos
iot-diagram.tsx              (edits pequenos) → carrega os 2 scripts novos + concatena generateAll()
```

Dispatch trivial em `handleGenerateFirmware` (`iot-diagram.tsx:1071-1072`):

```js
const projects = [
  ...new window.FirmwareGenerator(editorRef.current).generateAll(),        // ignora v2
  ...new window.FirmwareGeneratorTonV2(editorRef.current).generateAll(),   // ignora v1
];
```

Diagrama misto (TON v1 + TON-V2 no mesmo projeto) funciona: cada gerador produz os projetos dos
seus TONs; o modal já lista N projetos (TSX:1074-1100). Compilador, OTA, Web Serial: **inalterados**
(consomem `{files, name}`, agnósticos de versão).

**Regra de nomenclatura (briefing §3, verificada):** os tipos novos são `ton1v2`, `ton2v2`, `ton3v2`,
`ton4v2` — TODO filtro do sistema é `startsWith('ton')` (iot.service.ts:271/:373,
equipamentos-cmd.service.ts:463, iot-diagram.tsx:630/663/698/841/1545, dominioEquipamento.ts:36)
→ os v2 casam de graça em associação, comando, domínio IoT e auto-criação.

**Modelagem (briefing §2, opção B):** diferenças viram DADOS na matriz de capacidades:

```js
// TON_CAPS estendida (bi/bo/pwm/analog como dados, não if espalhado)
ton1v2: { lora:false, comando:false, versao:2, bi_count:8, bo_count:0, pwm_count:8 },
ton2v2: { lora:true,  comando:false, versao:2, bi_count:8, bo_count:0, pwm_count:8 },
ton3v2: { lora:false, comando:true,  versao:2, bi_count:8, bo_count:8, pwm_count:8 },
ton4v2: { lora:true,  comando:true,  versao:2, bi_count:8, bo_count:8, pwm_count:8 },
```

Contagens vêm do esquemático v1b real (8 DIN / 8 relés / 8 PWM) — os `bi_count:12` do briefing
eram placeholder.

---

## 1. Fase 0 — Rede de segurança de regressão (fazer ANTES de tudo)

Harness node (padrão já usado no projeto): carrega os scripts públicos, gera firmware dos
**diagramas reais atuais** (UBS, Pivôs/Chimarrão, Secador, um caso TCP-relé, um caso sim) com o
gerador V1 e grava hash SHA256 de cada arquivo gerado.

- Critério permanente (roda ao fim de CADA fase): **byte-idêntico** para todo diagrama sem
  componente v2. É a prova objetiva de "continua funcional como o atual".
- Guardar em `scripts/` do AupusNexOn (ex.: `scripts/regressao-firmware-v1.mjs`) + baseline em json.

## 2. Fase 1 — Tipos no editor (`iot-diagram.v2.js`, edits aditivos)

1. `TON_CAPS` (D:17-22): adicionar as 4 entradas v2 (bloco acima). Obs.: `TON_CAPS` também existe
   duplicado no G:17-22 — **não tocar o G**; D carrega por último e sobrescreve o global (ordem
   TSX:199-205), então em runtime vale o do D. Registrar esse fato em comentário no D.
2. `COMPONENT_TYPES`: novas entradas `ton1v2..ton4v2` (modelo: ton4 em D:198-238) com:
   - `label: 'TON4 v2'`, `category: 'controller'`, cores próprias (distinguir na paleta);
   - `generates_firmware: true`, `has_lora`/`has_relays` conforme variante;
   - `integrated` fiel ao SCH-TON-v1b (**não copiar o da v1, que além de tudo está desatualizado**):
     8 opto GP0-GP7 @0x26, 8 relés GP0-GP7 @0x27, PCA9685 @0x42 (8 PWM X88), AN 22K/3K3 (7,67x),
     AN_C 4-20 mA (IO39/40 — marcar pendência de ADC), SU+ IO48, LoRa M0/M1=GND, RTC IO3/IO9;
   - `integrated.opto_inputs.count: 8` — o painel de props usa isso p/ exibir o botão BI (TSX:1773);
   - mesmos `defaults`/`fields` da v1 (name, ota_hostname, mqtt_topic_base, _topic_preview, equipamento_id).
3. Listas internas do editor que definem "é TON" (verificadas): `CATEGORIES` D:443; filtros literais
   D:977 e D:2036; `const tonTypes = [...]` D:1060, D:1553, D:1646; Rule 5 `allowedTargets` D:1597
   (adicionar `'ton2v2','ton4v2'` junto de `'ton2','ton4'`). Preferir referenciar
   `Object.keys(TON_CAPS)` onde couber, para não haver 7ª lista.
4. Bump `IOT_SCRIPTS_VERSION` (TSX:198).

**Critérios de aceite:** paleta mostra os v2; conexões RS485/TCP/LoRa/WiFi respeitam as regras;
LoRa v1↔v2 conectável (malha mista); `FirmwareGenerator` V1 retorna 0 projetos para diagrama
só-v2; Fase 0 byte-idêntica.

## 3. Fase 2 — Gerador V2 (arquivos novos)

1. **`iot-firmware-base.ton-v2.js`**: fork do base v1 com global `FIRMWARE_BASE_TON_V2`. Mudanças:
   - `hal.h` V2: DIN1-8 = MCP 0x26 **GP0-GP7** (corrige na V2 o off-by-one que o base v1 tem em
     `_mcp.digitalRead(i+1)`, base v1:159 — **no V1 fica como está**, decisão à parte);
     relés RL1-8 = MCP 0x27 **GP0-GP7**; NÃO configurar GP6/GP7 como saída M0/M1 (agora são DIN7/8);
     escala AN = 7,67; `SU_PIN 48` (input, pull-up externo); driver **PCA9685 @0x42** (init +
     `pwm_set(ch, duty)`; ignorar EXTCLK, usar osc interno); demais pinos idênticos (RS485 TX=18/RX=17/
     DIR=8, LoRa 16/15/47, W5500 10-14, SD 35-38, TR 1/2/42/41).
2. **`iot-firmware-generator.ton-v2.js`**: fork do G com global `FirmwareGeneratorTonV2`. Mudanças:
   - `analyze()`: `tonTypes = ['ton1v2','ton2v2','ton3v2','ton4v2']`;
   - consumir `FIRMWARE_BASE_TON_V2` (ponto único G:622 no fork);
   - larguras por dados de `TON_CAPS` (bi_count/bo_count/pwm_count): `inputs` publica `d1..d8`,
     `relays` publica `r1..r8`, cmd `r7/r8` aceitos, scan de entradas 8 bits;
   - comandos novos de PWM via MQTT: `{"cmd":"pwm<N> <0-4095>"}` (contrato a fechar) + eco em
     `<base>/outputs` ou tópico novo `pwm` — DECISÃO #3 abaixo;
   - SU+ publicado como `s1` no `/inputs` (edge-triggered igual d1..d8) — DECISÃO #4;
   - **melhoria permitida (arquivo novo, sem risco à V1): checagem de `target_mac` no OTA**
     (mesma semântica `_ota_mac_matches` da lib ota_safety);
   - `FIRMWARE_VERSION` prefixo `2.` e `model` do announce = `ton4v2` etc. (o backend grava
     `firmware_versao`/`modelo` em `iot_dispositivos_online` — distingue frota);
   - **protocolo LoRa INALTERADO** (envelope, mestre-puxa, dedup, `$B$`) — interop v1↔v2 é requisito;
   - modo Simular (`window.IOT_SIMULATE`) e `IOT_LORA_AUTONOMOUS` mantidos.
3. **`iot-diagram.tsx`**: adicionar os 2 scripts ao `ensureIoTScripts` (TSX:199-205, antes do
   iot-diagram.v2.js), `declare global` dos globals novos (TSX:155-175), dispatch concatenado no
   `handleGenerateFirmware` (TSX:1071-1072), bump `IOT_SCRIPTS_VERSION`.

**Critérios de aceite:** `pio run` SUCCESS para as 4 variantes v2 × casos (RS485 device, TCP
datalogger, relé TCP direto, LoRa gateway, LoRa satellite, sim TESTE/); diagrama misto gera N+M
projetos; Fase 0 byte-idêntica; `npx tsc --noEmit` limpo.

## 4. Fase 3 — Backend (`aupus-nexon-api`) — tirar os "6" e a igualdade exata

Âncoras verificadas hoje:

| Item | Onde | Mudança |
|---|---|---|
| `automacao` | `iot.service.ts:306` `tipo === 'ton3' \|\| tipo === 'ton4'` | mapa de capacidade no backend (ex.: const `TON_COMANDO = new Set(['ton3','ton4','ton3v2','ton4v2'])`) — nunca lista solta em expressão |
| Ingestão BI | `mqtt.service.ts:700-707` `for i<=6` descarta `d7+` | copiar toda chave `/^d\d+$/` (e `s1`) do payload — aditivo, v1 continua mandando d1..d6 |
| ton-bi | `ton-bi.service.ts:70` (loop 6), `ton-bi.controller.ts:53` (doc "sempre 6"), `dto:12-13` `BI_MAX=6` | contagem por modelo: `tipo_equipamento` da TON (gravado como `TON4V2` via `iot.service.ts:326 tipo.toUpperCase()`) → 6 ou 8; `BI_MAX=8` no DTO |
| ton-bo | `dto/ton-bo.dto.ts:13-14` `BO_MAX=6` (service não revalida) | `BO_MAX=8` + validação no service por modelo (v1=6, v2=8) — hoje nem ton1/ton2 é checado, aproveitar e fechar |
| Banco | `ton_bo` `@@unique(ton_id,bo_numero)` sem CHECK; `ton_bi` idem (migração manual) | **nenhuma migração necessária** — ranges são só de aplicação |
| `calcularAgregacoes` | `mqtt.service.ts:2208+` copia só formas conhecidas no ramo inversor; ramo simples (2475-2482) preserva tudo | telemetria nova da V2 (AN_C/PWM/SU) só persiste se cair no ramo simples — validar com o contrato da DECISÃO #3/#4; campo novo em payload shape-inversor É DESCARTADO (armadilha 4.4 do briefing) |

**Critérios:** save de diagrama com `ton3v2` auto-cria equipamento com `automacao=true` e
`tipo_equipamento='TON3V2'`; `/inputs` com `d7/d8` persiste em `equipamento_io_estado` + WS;
BO 7/8 configurável só em v2; regressão: TONs v1 intactas (criar/comando/pulso).

## 5. Fase 4 — Frontend (contagens dinâmicas)

- `src/services/ton-bi.services.ts:8` `BI_NUMERO_MAX=6` e `ton-bo.services.ts:8` `BO_NUMERO_MAX=6`
  → parametrizar (prop `count` vinda do componente: `_def.integrated.opto_inputs.count` /
  `tonCaps(type).bo_count`), default 6.
- `TonBiConfigModal.tsx:166` loop `n<=6` (parse WS d1..d6) → usar a contagem.
- `commandRegistry.ts:88+` chave `TON`: adicionar `r7/r8` (e PWM se virar comando de usuário);
  descrição "6 saídas" → por modelo. Codigos `TON1V2..TON4V2` caem na chave `TON` pelo fallback
  modelo→categoria (:147-155) — verificar com o codigo real gravado.
- Botões BI/BO no painel de props já são data-driven (TSX:1747 `has_relays`, TSX:1773
  `opto_inputs.count`) — herdam da def v2 sem código novo.
- `npx tsc --noEmit` antes de todo deploy (regra do briefing §7).

## 6. Fase 5 — Bancada TON-V2

- Fork `PLATFORMIO/TESTES-BANCADA/TON-TESTE-V2/` com pinout v1b: loopback 8 relés×8 DIN,
  passo PCA9685/X88 (medir gate/dreno), passo AN_C 4-20 mA (conforme DECISÃO #1), passo SU+,
  **remover `lora config`/`lora pair`** (M0/M1 em GND) — `lora eco` mantém (par com uma v1 serve);
  `detectVariant()` v2 (PCA9685 presente = placa v2; relés/LoRa distinguem variante).
- Compilar → `prebuilt/ton-teste-v2b.bin` nos DOIS firmware-compiler (iot_nexon e
  aupus-nexon-api) + entrada em `iot-bench-tests.v2.js` (`BENCH_TESTS`, targets `ton1v2..ton4v2`).
- POP v3 (identidade Aupus, base no v2).
- ⚠️ NUNCA gravar o `ton-teste-v2.bin` (v1) numa placa V2: mapa de relés deslocado (r1→RL2) e
  GP6/7 viram saída — o loopback com +24 V nas entradas novas é risco físico.

## 7. Fase 6 — Binários/OTA e campo

- Fluxo OTA inalterado (`/publish-artifact` → `<topico>/ota/cmd`); V2 ganha checagem de
  `target_mac` no firmware (fase 2). Política: toda V2 de campo com OTA (como sempre).
- Cadastro: MACs novos (unique em `equipamentos.mac_address`); bancada sempre com `TESTE/` +
  `testMac` — o announce `/status` SUBSTITUI o MAC do equipamento, não apontar topic base de
  produção em bancada.

---

## 8. Decisões — FECHADAS com o usuário (2026-07-21)

1. **AN_C1/AN_C2: tratar como AN1/AN2** — mesmas semânticas/contrato das analógicas (campos
   próprios, leitura ADC). ⚠️ Nota técnica mantida: no SCH-TON-v1b elas estão em IO40/IO39,
   que NÃO têm ADC no ESP32-S3 — o firmware terá o caminho pronto, mas a leitura nesta revisão
   da placa será inválida até o sinal ir a um pino ADC (bodge ou próxima revisão). Bancada valida.
2. Nomes `ton1v2..ton4v2` / labels "TON1 v2" etc. — **aprovado**.
3. PWM: comando em **0-100%** (`pwm<N> <0-100>`; firmware converte p/ 0-4095 do PCA9685).
4. SU+ publicado como **`s1` no `/inputs`** — aprovado.
5. E220 da V2: **vem pré-configurado**; M0/M1 em GND confirmado — firmware não configura rádio
   (remover `lora config`/`lora pair` do bench V2).
6. Ranges BO no backend: default adotado = **validação por modelo** (v1=6 / v2=8) — não só teto.

## 8b. Status de execução

- **Fase 0 CONCLUÍDA (2026-07-21):** harness `AupusNexOn/scripts/regressao-firmware-v1.mjs`
  (`--baseline`/`--check`), corpus congelado `regressao-corpus.json` (16 diagramas reais do
  `iot_projetos`) + `regressao-catalog.snapshot.js` (catálogo do DB congelado); `Date` congelado
  no sandbox (FIRMWARE_VERSION embute timestamp). Baseline: 16 diagramas / 17 firmwares / 0 erros.
- **Fase 1 CONCLUÍDA (2026-07-21):** `iot-diagram.v2.js` — TON_CAPS estendida (v1+v2 com
  versao/bi_count/bo_count/pwm_count), tipos `ton1v2..ton4v2` via fábrica única com `integrated`
  do SCH-TON-v1b, CATEGORIES, e as 6 listas internas trocadas por derivação de `TON_CAPS`
  (`Object.keys(TON_CAPS)` / `!!TON_CAPS[c.type]` / `filter(isLoraNode)`). Validado:
  `node --check` OK; regressão **16/16 byte-idêntica**; smoke test: gerador V1 retorna 0 projetos
  p/ diagrama só-v2 e só o TON v1 em diagrama misto. SEM deploy ainda (deploy junto com Fase 2,
  com bump de IOT_SCRIPTS_VERSION).
- **Fase 2 CONCLUÍDA E DEPLOYADA (2026-07-21):**
  - `public/iot-firmware-base.ton-v2.js` (global `FIRMWARE_BASE_TON_V2`) — fork com hal v1b:
    8 DIN GP0-GP7 (corrige o off-by-one na V2), 8 relés GP0-GP7, ADC 7.67, AN_C1/AN_C2
    (canais 3/4 do adc, `adc_read_ma`), SU+ (IO48, debounce em inputs.cpp), módulo novo
    pwm.h/pwm.cpp (PCA9685@0x42, `pwm_set_percent` 0-100%→0-4095, EXTCLK não habilitado),
    OTA com `_ota_mac_matches` (target_mac), lib Adafruit PWM Servo Driver no platformio.ini.
  - `public/iot-firmware-generator.ton-v2.js` (global `FirmwareGeneratorTonV2`) — fork:
    analyze só ton1v2..ton4v2, consome FIRMWARE_BASE_TON_V2, TON_CAPS/tonCaps NÃO redeclarados
    (canônicos no iot-diagram.v2.js), versão `2.0.0-build*`, DEVICE_MODEL TON*V2, publish
    `inputs` d1..d8+s1 / `relays` r1..r8 (bit n-1), cmd `r1..r8` e `pwm<N> <0-100>`/`pwm<N> off`.
  - `iot-diagram.tsx`: carga dos 2 scripts novos, `FirmwareGeneratorTonV2` no declare global,
    dispatch concatenado no handleGenerateFirmware, `IOT_SCRIPTS_VERSION='20260721-tonv2-fase2'`.
  - Fork por script com asserção de match único (35/35 ok) — `scratchpad/build_forks.py` da sessão.
  - **Validação:** regressão V1 16/16 byte-idêntica; smoke `scripts/smoke-firmware-ton-v2.mjs`
    (27 checks de geração OK: isolamento V1↔V2, misto, marcadores V2, papéis LoRa gw/sat);
    **compilação real 4/4 SUCCESS** (ton1v2-rs485, ton3v2-rele-tcp, ton2v2-gateway,
    ton4v2-satellite) via firmware-compiler :3211. `tsc --noEmit`: só o erro pré-existente
    `fotoUrl` (useEquipamentos.ts, alheio). Deploy `vite build` + swap dist (dist-bak guardado);
    scripts confirmados servidos em produção (HTTP 200).
- **Fase 3 CONCLUÍDA E DEPLOYADA (2026-07-21):** módulo novo
  `aupus-nexon-api/src/shared/util/ton-caps.ts` (espelho backend do TON_CAPS +
  `tonCapsForTipo`/`tonBiCount`/`tonBoMax`; legado/desconhecido = 6). Patches:
  `iot.service.ts` automacao = `tonCapsForTipo(tipo)?.comando` (fim da igualdade exata);
  `mqtt.service.ts` processInputs aceita todo `/^d\d{1,2}$/` + `s1`;
  ton-bi/ton-bo DTOs com teto sintático 8 + validação REAL por modelo no service
  (v1=6 sem mudança de comportamento; ton3v2/ton4v2=8; ton1v2/ton2v2 BO=0 → 400);
  `list()` retorna 6/8/0 linhas conforme `tipo_equipamento`; `assertTonExists` agora
  seleciona `tipo_equipamento`. `send-command.dto` doc r1-r8/pwm. Validação: helpers
  testados no dist compilado; `nest build` limpo; pm2 restart OK (reconcile 61 tópicos,
  ingestão fluindo, health verde). GOTCHA corrigido no caminho: os DOIS services
  (ton-bi E ton-bo) têm `assertTonExists` próprio — os dois precisaram do select.
- **Fase 4 CONCLUÍDA E DEPLOYADA (2026-07-21):** grids dos modais BI/BO já renderizam
  da RESPOSTA da API (as constantes BI/BO_NUMERO_MAX eram declaradas e não usadas —
  viraram teto sintático 8 documentado); `TonBiConfigModal` WS parse d1..d8;
  `commandRegistry` ganhou `tonV2Commands()` (8 relés p/ ton3v2/ton4v2, TR, grupo PWM
  com presets 100%/Off por canal, diagnóstico) registrado por MODELO
  (TON1V2..TON4V2) + lookup reordenado: **tipo exato ANTES da categoria** (v1 continua
  caindo na chave 'TON' genérica). tsc só com o `fotoUrl` pré-existente; vite build +
  swap; regressão V1 16/16 e smoke V2 re-rodados OK pós-deploy.
- **Fase 5 (firmware de bancada) CONCLUÍDA E DEPLOYADA (2026-07-21):** fork
  `PLATFORMIO/TESTES-BANCADA/TON-TESTE-V2/` (env `ton-v2-teste`, 48 patches assertivos):
  8 DIN GP0-7 + S1 no `din`, relés r1-r8 GP(n-1), PCA9685@0x42 (`pwm N P` 0-100%,
  `pwmtest`), `adc` com AN_C1/2 (mA no shunt 165R, com aviso "sem ADC nesta rev"),
  `lora config`/`lora pair` REMOVIDOS (M0/M1 em GND — E220 deve vir pré-configurado
  canal 18/addr 0), variantes TON1v2..TON4v2, **guia de 13 passos** (novos: 4 = AN_C
  registra ATENÇÃO sem reprovar; 9 = PWM em 2 partes osciloscópio X88-1 + varredura
  8 canais; 10 = SU+ aberto/fechado no X14; passo 1 exige 0x42 — ausência reprova).
  Compilado `pio run` SUCCESS (RAM 15,2%/Flash 15,6%) → prebuilt
  **`ton-teste-ton-v2.bin`** nos DOIS firmware-compiler (listado no `/prebuilt` ativo).
  `BENCH_TESTS` ganhou `ton-v2-teste-completo` (targets ton*v2, instruções/checklist
  completos + alerta de NUNCA gravar o bin v1 na placa V2);
  `IOT_SCRIPTS_VERSION='20260721-tonv2-bench'`; frontend rebuild+swap, entrada
  confirmada servida em produção.
- **POP TON-V2 PUBLICADO (2026-07-21):** `/var/www/POP-Teste-Bancada-TON-V2-v1.pdf`
  (4 págs A4, identidade Aupus navy/verde, fonte HTML no scratchpad da sessão via
  wkhtmltopdf): regra nº 1 (nunca gravar o bin da v1 — como identificar pelo banner),
  tabela v1×V2, materiais, preparação, 13 passos com diagramas ASCII (loopback 8×8,
  PWM X88, SU+ X14), ficha de aprovação e glossário.
- ⚠️ OCORRIDO EM BANCADA (21/jul): o usuário conectou a placa V2 rodando o firmware
  de teste DA V1 (banner "TON4 (completo)", sem PCA9685 no boot) — alertado para
  regravar com `ton-teste-ton-v2.bin` antes de acionar relés.
- **VALIDAÇÃO FÍSICA PARCIAL OK (21/jul, `all` do TON-V2-TESTE v1.1 na placa real):**
  confirmados em hardware: MCPs 0x26/0x27, **PCA9685 0x42 vivo e varrendo os 8 canais**,
  RL1-RL8, TR1-4, DIN1-8+S1, W5500, E220 presente. **AN_C comprovado sem ADC**
  (log `Pin 40/39 is not ADC pin!` — erro de design confirmado; firmware degrada com
  aviso). Em aberto: **SD falhou 2× (CMD0 mudo — conferir cartão)**, RS485 (sem
  medidor ainda), LoRa eco (sem par), RTC/loopback/PWM-scope/SU+ via `guia`+POP.
- Restante: fechar os itens em aberto acima na bancada e **Fase 6** (OTA/campo).

## 9. Ordem de execução e deploy

Fase 0 → 1 → 2 (front juntas num deploy) → 3 (backend) → 4 (front) → 5 (bancada) → 6.
Cada deploy: `npx tsc --noEmit && npx vite build` (front) / `npx nest build && pm2 restart
aupus-nexon-api` (backend), bump `IOT_SCRIPTS_VERSION`, rodar harness da Fase 0.
Shared packages (@aupus/*): **fora do escopo** (briefing §5 — domínio ficou em código no NexON;
não bumpar api-shared "de passagem").
