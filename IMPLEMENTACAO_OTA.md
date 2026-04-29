# Implementação OTA — parte frontend (2026-04-28)

Resumo das alterações neste repositório (`AupusNexOn`) para habilitar **deploy
de firmware via OTA** disparado pelo modal "Firmware - Compilar e Gravar"
do diagrama IoT.

> **Documentação completa** (frontend + backend + firmware + DB) em
> [`/var/www/staging-nexon/aupus-service-api/IMPLEMENTACAO_OTA.md`](../aupus-service-api/IMPLEMENTACAO_OTA.md).
> Este arquivo é um índice da parte frontend.

---

## Arquivos alterados

> ⚠️ Os scripts em `public/iot-*.v2.js` e o componente `iot-diagram.tsx`
> estão como **untracked** no git da branch `main`. As mudanças descritas
> aqui estão no estado em disco; backup pré-mudança em
> `dist.bak-pre-iot-ota-20260428-131623/`.

### `src/features/supervisorio/components/iot-diagram.tsx`

- **`firmwareDeployOta()`** (~110 linhas novas): chama
  `POST /api/v1/equipamentos/{id}/ota/compilar-e-publicar` com `{files, name, version}`.
  Trata o envelope de erro do NexOn (`{success:false, error:{code, message}}`).
- **Novos estados** `'deploying' | 'deployed'` no tipo do `firmwareModal`.
- **Botão "Implantar OTA"** no rodapé do modal, estado `idle`. Ao lado do
  "Compilar" (que continua sendo o caminho USB Web Serial).
- **Spinner "Implantando OTA..."** durante a operação.
- **Fix `getHeaders()`**: lia `auth_token`/`token` do localStorage; a convenção
  do NexOn é `authToken`/`service_authToken` (vide `auth.service.ts`).
  Sem isso, todas as chamadas autenticadas eram rejeitadas com 401.

### `public/iot-diagram.v2.js`

Cada um dos 4 controladores TON (`ton1` a `ton4`) ganhou:

- **prop** `equipamento_id` (string, default `''`)
- **field** no modal de propriedades: `'Equipamento NexOn (ID)'`, type `text`,
  placeholder `CUID 26 chars — necessário para Implantar OTA`

Esse ID liga o TON do diagrama ao registro `equipamentos` no banco — o backend
usa pra resolver o `topico_mqtt` que vai receber o comando OTA.

### `public/iot-firmware-generator.v2.js`

- `_genMainCpp` agora inclui `<WiFi.h>` (necessário para `WiFi.macAddress()` no boot)
- Banner do `setup()` ganha linha: `Serial.printf("  [BOOT] MAC: %s\n", ...)`
- Payload retained de `<topic>/status` agora inclui `mac` e `ip`
  (auto-discovery pelo backend MqttService)
- Buffer `hello[]` aumentado de 96 → 224 bytes
- `setup()` chama `ota_check_pending_verify()` (rollback automático)
- `mqtt_publish()` chama `ota_confirm_valid_if_needed()` após cada sucesso
- Spec do generator inclui `equipamentoId` (lido por `firmwareDeployOta`)

### `public/iot-firmware-base.v2.js`

- `include/ota.h`: novas declarações `ota_check_pending_verify()` e
  `ota_confirm_valid_if_needed()`
- `src/ota.cpp`: implementação do **rollback automático** usando
  `esp_ota_get_state_partition` + `esp_ota_mark_app_valid_cancel_rollback`
- `src/ota.cpp`: 4 chamadas adicionais de `esp_task_wdt_reset()` durante
  etapas síncronas longas do download (HTTP begin, GET, Update.begin)
- Constante `OTA_VALIDATION_PUBS = 3` — após N publicações MQTT OK pós-boot,
  firmware é declarado válido.

---

## Fluxo no modal Firmware (UX)

```
[clica Firmware]
      ↓
[modal abre, status=idle]
      ↓
   ┌──────────┐  ┌────────────────┐  ┌──────────┐
   │ Codigo   │  │ Implantar OTA  │  │ Compilar │
   │  Fonte   │  └───────┬────────┘  └────┬─────┘
   └──────────┘          │                 │
                         ▼                 ▼
              status=deploying    status=compiling
              (~60s, spinner)     (~60s, spinner)
                         ▼                 ▼
              status=deployed     status=compiled
              (sucesso!)            ┌────────────┐
                                    │ Gravar USB │
                                    └────────────┘
                                          ▼
                                    status=done
```

---

## Como rodar localmente após mudanças

1. Editar arquivos
2. `npm run build` (Vite, ~30s)
3. Hard refresh no navegador (Ctrl+Shift+R)

> Mudanças apenas em `public/iot-*.v2.js` (sem TSX) também aparecem após
> hard refresh — Vite copia `public/ → dist/` no build.

---

## Pré-requisitos para o botão "Implantar OTA" funcionar

1. Backend NestJS (`staging-nexon-api`) deve ter o `IoTModule` registrado e
   `OtaController` exposto. **Sessão 2026-04-28 corrigiu uma bomba-relógio**
   onde o módulo era órfão — vide doc principal.
2. O `equipamento.id` informado no campo "Equipamento NexOn (ID)" precisa:
   - Existir em `equipamentos` no banco
   - Ter `mqtt_habilitado = TRUE`
   - Ter `topico_mqtt` preenchido
3. O TON em campo precisa estar online no broker MQTT para receber o comando
   (publicação não é retained).
4. Usuário precisa estar logado no NexOn (token JWT no localStorage).

---

## Histórico de validação em hardware

Validado em 2026-04-28 com TON ESP32-S3, MAC `80:B5:4E:D2:DD:2C`,
tópico `AUPUS_TESTE`. Ciclo completo: clicou "Implantar OTA" → backend compilou
e publicou em `AUPUS_TESTE/ota/cmd` → TON recebeu, baixou (.bin de 981.5 KB)
e validou MD5.
