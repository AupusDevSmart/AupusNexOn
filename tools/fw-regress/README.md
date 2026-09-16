# fw-regress — regressão byte-idêntica do gerador de firmware

Rede de segurança da **Fase 6** do refactor IoT (aposentar `ton_bo`/`ton_bi`/`ton_ai`/
`io_config` fazendo o gerador ler de `iot_vinculos`). Prova que a mudança no gerador
produz o **mesmo código-fonte** de firmware — arquivo por arquivo, byte por byte — pra
**todo projeto TON real** do banco. Se um byte mudar, a Fase 6 introduziu regressão.

## Por que dá pra rodar em Node (sem browser)

O gerador (`public/iot-firmware-generator.v2.js` + `.ton-v2.js`) é **JS puro** sobre
`{ components, connections }`. Ele só toca o browser em 3 flags opcionais
(`IOT_SIMULATE` / `IOT_LORA_AUTONOMOUS` / `IOT_DISABLE_TP_TC`), todas guardadas por
`typeof window !== 'undefined'` -> com `window` ausente caem em `false`, o default de
produção. Carregamos os arquivos num sandbox `vm` (`load-generators.mjs`), na **ordem
exata do browser**: catálogo -> base+gerador V1 -> base+gerador TON-V2 ->
`iot-diagram.v2.js` (define `COMPONENT_TYPES`).

## Os 2 inputs congelados (senão o diff dá falso-positivo)

1. **`Date`** — a única não-determinação do gerador é o `#define FIRMWARE_VERSION
   "..build<YYYYMMDDHHmm>"`. Congelamos `Date` num instante fixo (`2020-01-01`), igual no
   capture e no check, pra isolar a **lógica** diagrama->firmware.
2. **Catálogo de devices** (`DEVICE_POINTS`/`DEVICE_MODELS`, servido por
   `/api/v1/iot-catalog/device-catalog.js`) — é **input** do firmware. No `capture`
   baixamos e salvamos `catalog-snapshot.js`; no `check` reusamos o snapshot. Assim
   mudança de catálogo entre as rodadas não vira falso-diff.

Os demais inputs (diagrama + `_bombaIoByEquip`) vêm do banco como o browser os monta:
`iot_projetos.diagrama` (o mesmo cache que `editor.fromJSON()` consome — que só **clona**,
então `{components,connections}` é byte-fiel) e uma **réplica fiel** de `buildBombaIoMap()`
do `iot-diagram.tsx` (mesmos regexes de papel), em `db.mjs`.

## Uso

    # 1) Congelar o baseline "ouro" no ponto que funciona HOJE (ANTES de mexer no gerador):
    node run.mjs capture

    # 2) Depois de cada mudança na Fase 6, provar que nada mudou no fonte:
    node run.mjs check          # exit 0 = byte-idêntico; exit 1 = divergiu (mostra 1a linha)

    # Fidelidade ao browser real (rodar 1x pra confiar no baseline; precisa Chrome/puppeteer):
    node browser-crosscheck.mjs

`capture` grava em `golden/`; `check` grava em `current/` e faz diff contra `golden/`.

## O que é versionado

- **`golden/`** e **`catalog-snapshot.js`** -> SIM (ponto-de-retorno da regressão).
- **`current/`** -> não (saída transitória; ver `.gitignore`).

## Fluxo da Fase 6 (recomendado)

1. No commit **bom** (hoje): `node run.mjs capture` + `browser-crosscheck.mjs` (deve dar
   fiel) -> commitar `golden/` + `catalog-snapshot.js`.
2. Mudar o gerador pra ler de `iot_vinculos` (um pedaço por vez).
3. `node run.mjs check` a cada passo. **Objetivo: sempre byte-idêntico.**
4. Quando um diff for ESPERADO e correto (você mudou a saída de propósito), re-capture o
   baseline conscientemente.

## Arquivos

| arquivo | papel |
|---|---|
| `run.mjs` | CLI `capture`/`check` — gera e faz diff |
| `load-generators.mjs` | carrega os geradores no sandbox `vm` (Date congelado) |
| `db.mjs` | lê `iot_projetos.diagrama` via psql + réplica de `buildBombaIoMap` |
| `browser-crosscheck.mjs` | prova que Node == browser (Puppeteer) |
| `golden/` | baseline "ouro" (475 arquivos, ~19 firmwares de 17 projetos) |
| `catalog-snapshot.js` | catálogo de devices congelado |
