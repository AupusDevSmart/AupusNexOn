# Briefing — adicionar TON v2 (TON1–4 v2) ao NexON

> Documento de **como** fazer a alteração. O **o quê** (BIs/BOs a mais, leitor óptico, etc.)
> vem da especificação de hardware.
> Gerado em 2026-07-20.

---

## 1. Onde o "TON" vive (6 camadas)

Alterar só uma camada gera falha **silenciosa** — sem erro, com comportamento errado.

| # | Camada | Arquivo / lugar |
|---|---|---|
| 1 | Tipos do diagrama | `AupusNexOn/public/iot-diagram.v2.js` (estático, `COMPONENT_TYPES`) |
| 2 | Gerador de firmware | `AupusNexOn/public/iot-firmware-generator.v2.js` (estático, self-contained) |
| 3 | Catálogo de dispositivos | **No banco** (`iot_device_tipos` / `iot_device_modelos`), servido por `GET /api/v1/iot-catalog/device-catalog.js`. **Não é arquivo JS.** |
| 4 | Backend | `aupus-nexon-api` (auto-criação de equipamento, ingestão MQTT, BI/BO da TON) |
| 5 | Frontend | modais de BI/BO, ícones, domínio de equipamento |
| 6 | Binários + OTA | pré-compilados por modelo |

---

## 1.1 Delta de hardware v1 → v2 (lido dos esquemáticos)

Fontes: `/var/www/SCH-TON-v1a (1).pdf` (atual) e `/var/www/SCH-TON-v1b.pdf` (**v2**).

| Bloco | v1a (atual) | **v1b (v2)** |
|---|---|---|
| Entradas digitais (BI) | 6 — OPT1-6, `X12-1…X12-7` (6+COMUM) | **8** — OPT1-8, `X12-1…X12-8` |
| Relés (BO) | 6 — RL1-6, `X1…X6` | **8** — RL1-8, `X1…X8` |
| Analógicas | 2 de tensão — `X7-1/2/3` | **4** — AN1/AN2 tensão + **AN_C1/AN_C2 corrente 4-20 mA** (shunt 165 Ω + polyfuse), em `X77` |
| PWM | 1 saída — `X8-1/X8-2` | **8 canais** — PWM1-8 em `X88`, via PCA9685 + AO3400 |
| Transistores (TR) | 4 — `X11-1…X11-5` | 4 — igual |
| Novo | — | `X14-1/X14-2` |

⚠️ **Colisão de designador entre versões:** analógicas `X7` → **`X77`** e PWM `X8` → **`X88`**;
e o designador **`X8` passa a ser o relé 8** na v2. O mesmo nome significa **coisas diferentes**
entre versões — cuidado em qualquer código/doc que referencie borne por nome.

⚠️ **As entradas de corrente 4-20 mA são funcionalidade NOVA** — precisam de tipo de ponto,
escala e mapeamento próprios (não dá para reaproveitar o de tensão).

**Entradas digitais são contato seco:** `+5 V → resistor → LED do opto (TLP183) → borne`.
A placa fornece a excitação; o borne é o **retorno**. Fechar contra GND ativa. Vale nas duas
versões — ver `docs/POP-Teste-Bancada-TON.md`.

## 2. Decisão de modelagem (definir ANTES de codar)

As variantes hoje **não são tipos arbitrários** — são uma **matriz de capacidades**
(`iot-diagram.v2.js:16-21`):

```js
ton1: { lora: false, comando: false }
ton2: { lora: true,  comando: false }
ton3: { lora: false, comando: true  }
ton4: { lora: true,  comando: true  }
```

**(A) Novos tipos** (`ton1v2`…`ton4v2`) — isola a v1, mas duplica a matriz e espalha `if`.

**(B) Estender a matriz com `versao` + contagens** — **recomendado**:
```js
ton1: { lora: false, comando: false, versao: 1, bi_count: 6,  bo_count: N }
ton1v2: { lora: false, comando: false, versao: 2, bi_count: 12, bo_count: M, optico: true }
```
Mantém a lógica única e as diferenças viram **dados**, não ramificação.
Regra prática: **o que muda é quantidade e periférico, não conceito** → deve ser dado.

---

## 3. ⚠️ Regra de nomenclatura (quebra silenciosa)

Existem **8+ filtros por prefixo `ton`**:

- `aupus-nexon-api/src/modules/iot/iot.service.ts:271` e `:373`
- `aupus-nexon-api/src/modules/equipamentos-cmd/equipamentos-cmd.service.ts:463`
- `AupusNexOn/src/features/supervisorio/components/iot-diagram.tsx:630, 663, 698, 841, 1545`

**Todo tipo novo TEM que começar com `ton`.**
`ton1v2` ✅ · `v2_ton1` ❌ — este último some do unifilar, não auto-cria equipamento e não
recebe comando, **tudo sem erro**.

---

## 4. 🔴 Armadilhas já mapeadas

**4.1 "6 entradas" está hard-coded em 3 lugares.** Se a v2 tiver mais BIs:
- `aupus-nexon-api/src/shared/mqtt/mqtt.service.ts:702` → `for (let i = 1; i <= 6; i++)`
  — **descarta em silêncio** os `d7+` que o firmware publicar
- `aupus-nexon-api/src/modules/ton-bi/ton-bi.service.ts:70` → `for (let n = 1; n <= 6; n++)`
- `ton-bi.controller.ts:53` → contrato documentado como "sempre 6"
- Conferir `UNIQUE(ton_id, bi_numero)` e eventual CHECK no banco

**4.2 `automacao` usa igualdade exata** — `iot.service.ts:306`:
```js
const automacao = tipo === 'ton3' || tipo === 'ton4';
```
As v2 **não entram** → equipamento nasce sem `automacao` e **some** da lista de equipamentos
com pontos (perde o vínculo de comando). Trocar por capacidade (`CAPS[tipo].comando`),
nunca por lista de nomes.

**4.3 Auto-criação de equipamento.** `ensureTonEquipamentos` roda no save do diagrama e exige
`props.mqtt_topic_base`; reusa por tópico, senão cria. Se a v2 mudar como o tópico é formado,
revisar — senão duplica equipamento.
(Existe também `ensureDeviceEquipamentos`, para devices Modbus.)

**4.4 Leitor óptico — cuidado com a persistência.** Campos novos de telemetria passam por
`calcularAgregacoes` (`mqtt.service.ts:~2181`), que **só copia formas conhecidas**
(`power/voltage/current/energy/...`). **Campo de topo desconhecido é descartado ao gravar**
(chega ao vivo pelo WebSocket, mas não persiste). Já aconteceu com o status do disjuntor.

---

## 5. Projetos compartilhados (NexON × Service) — leia se for mexer em cadastro

Dois pacotes são **consumidos pelo NexON E pelo Service**. Alteração neles afeta **os dois
produtos** — coordenar antes.

| Pacote | O que é | Repo | Pinado hoje |
|---|---|---|---|
| `@aupus/api-shared` | Backend/NestJS: `PrismaService`, models `equipamentos` / `tipos_equipamentos` / `categorias`, CRUD | `AupusDevSmart/api-shared` | `#v0.11.1` |
| `@aupus/shared-pages` | Frontend/React: telas de cadastro (`src/features/equipamentos/`) | `AupusDevSmart/shared-pages` | `#v0.9.0` |

**Instalação = git dep pinada por TAG** (não npm registry). A "release" é um **git tag**.
Editar `node_modules` direto é patch frágil — some no próximo `npm install`.

**Fluxo correto:**
1. Repos clonados em `/var/www/_shared-src/{api-shared,shared-pages}`
2. Branch → alterar → commit → push → **taggar** nova versão → push da tag
3. Bump no `package.json` do consumidor → `npm install` → rebuild/deploy
4. **Testar no NexON primeiro, depois no Service** — não bumpar os dois de uma vez

**🚨 Gotcha do npm (custou horas):** `npm` resolve git-dep por SSH, e **SSH não está
configurado**. Bumpar só a tag no `package.json` **não propaga** (o lockfile mantém o
`resolved` antigo; `--prefer-online`, `cache clean`, `insteadOf` — nada força re-resolução).
**Solução durável:** editar o `resolved` do lockfile à mão para
`git+https://github.com/<repo>.git#<SHA-do-commit-da-tag>` (o **SHA**, não a tag, e `https`,
não `ssh`), `rm -rf node_modules/@aupus/<pkg>`, `npm install --legacy-peer-deps`.

⚠️ **`api-shared` já está em `v0.12.0` no repo, mas o NexON usa `v0.11.1`.** Bumpar puxa o
diff `feat(veiculo)` e **exige migração** — não bumpar "de passagem".

**Para TON v2 provavelmente NÃO é preciso mexer no shared:** o `dominio` (potência/IoT) foi
mantido em código no NexON justamente para evitar tocar no pacote compartilhado. Só entra
shared-pages se a **tela de cadastro compartilhada** precisar oferecer os tipos novos.

---

## 6. Ordem sugerida

1. Matriz de capacidades + tipos (`iot-diagram.v2.js`)
2. Gerador: pinout/expander por modelo, largura de `inputs_get_state()`, nº de relés, driver do óptico
3. Backend: remover os "6" fixos; trocar igualdade `ton3/ton4` por capacidade
4. Frontend: `TonBiConfigModal` / `TonBoConfigModal` lendo a contagem do tipo (não constante)
5. Binários pré-compilados + OTA
6. Firmware de bancada / POP

---

## 7. Regras de qualidade (aprendidas na marra)

- **`vite build` NÃO faz type-check.** Rodar `npx tsc --noEmit` antes do deploy — referência
  órfã passa no build e só quebra em runtime.
- **Não inventar pinout/endereço.** Se não estiver no documento de hardware, **medir na
  bancada**. Mapa errado de Modbus/IO **não dá erro** — dá valor plausível e errado.
- **Idempotência:** o que roda no save do diagrama precisa ser re-executável sem duplicar.
- **Ler antes de escrever** em tabela/arquivo que outra pessoa possa estar editando em
  paralelo (já houve sobrescrita de mapeamento entre dois chats).
- **Política:** toda TON de campo precisa de **OTA** funcional.

**Deploy:**
```bash
# frontend
cd /var/www/service-nexon/AupusNexOn
npx tsc --noEmit && npx vite build --outDir dist-new
rm -rf dist-bak && mv dist dist-bak && mv dist-new dist

# backend
cd /var/www/service-nexon/aupus-nexon-api
npx nest build && pm2 restart aupus-nexon-api --update-env
```
