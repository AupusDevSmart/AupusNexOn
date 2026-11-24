# Etiquetagem das TONs — sugestão

> Proposta para identificar fisicamente cada TON (V1 e V2), da produção/estoque até o campo.
> Base: esquema de SN já decidido (TIPO-VERSÃO-SEQ-MAC), scanner `mac-scanner.html`,
> [IOT-TON-V2-BRIEFING.md](IOT-TON-V2-BRIEFING.md), [IOT-TON2-BASE-CONHECIMENTO-TESTES.md](IOT-TON2-BASE-CONHECIMENTO-TESTES.md)
> e [IOT-TON-DOMINIO-EQUIPAMENTOS.md](IOT-TON-DOMINIO-EQUIPAMENTOS.md).
> Status: **proposta** — itens marcados com ❓ dependem de decisão.

## 1. Objetivo

1. Saber **qual TON é qual** olhando para ela (estoque, bancada, quadro em campo), sem abrir o NexON.
2. Ligar a placa física ao cadastro **sem erro de digitação**: o MAC é a identidade real (tópico MQTT, `client_id`, LoRa, OTA `target_mac`).
3. Evitar os erros que já aconteceram: placa V1 tratada como V2 (bornes com o mesmo nome e função diferente), variante errada (TON2 detectada como TON4), MAC do flasher ≠ MAC do `[BOOT]`, TON trocada em campo ficando com o vínculo antigo.

## 2. Duas etiquetas, dois momentos

| Etiqueta | Quando | Muda? | Onde |
|---|---|---|---|
| **A · Identidade da placa** | na produção/recebimento (scanner USB) | **nunca** | na placa/caixa da TON |
| **B · Instalação** | no comissionamento em campo | sim, se a TON for realocada | na porta do quadro ou ao lado da TON |

A separação evita reetiquetar a placa quando ela muda de cliente: a **A** é do hardware, a **B** é do uso.

## 3. Etiqueta A — identidade da placa

### 3.1 Conteúdo

```
┌──────────────────────────────────────────────┐
│ AUPUS · TON                     ▌TON4 · V2▐  │  ← faixa colorida da variante
│                                              │
│   SN 00042                    ┌────────┐     │
│   4-V2-00042                  │ QR     │     │
│   MAC 98:A3:16:EB:E1:A0       │        │     │
│                               └────────┘     │
│ LoRa ✔  Relés 8  BI 8  SSU ✔        11/2026 │
│ ⚡ ALIM. 5 V CC  ·  NÃO ligar 12/24 V        │  ← tarja de alimentação
└──────────────────────────────────────────────┘
```

| Campo | Exemplo | Regra |
|---|---|---|
| **SN (sequencial)** | `00042` | 5 dígitos, **global** (não reinicia por tipo/versão). É o número "falado" — grande e legível. |
| **Código completo** | `4-V2-00042` | `TIPO-VERSÃO-SEQ`. O SN completo do cadastro é `4-V2-00042-98:A3:16:EB:E1:A0`. |
| **MAC** | `98:A3:16:EB:E1:A0` | **MAC do WiFi** (o do `[BOOT]` / `[SN] mac=` / `client_id TON-…`), **não** o do W5500 nem o que o flasher mostra. Maiúsculas, com `:`. |
| **Variante + versão** | `TON4 · V2` | Lido do lote no scanner (manual — a auto-detecção de variante não é confiável). |
| **Capacidades** | `LoRa ✔ · Relés 8 · BI 8 · SSU ✔` | Resumo do que a placa tem montado (ver §3.3). Evita abrir o NexON para saber se dá para comandar. |
| **Alimentação** | `⚡ ALIM. 5 V CC · NÃO ligar 12/24 V` | Nível de tensão da fonte (ver §3.4). Linha inteira em **negrito, com contorno/tarja**, legível sem óculos. |
| **Mês/ano** | `11/2026` | Data de cadastro/teste de fábrica. |
| **QR code** | ver §3.2 | Para leitura no celular/scanner. |

### 3.2 QR code

**Recomendado agora (funciona offline):** texto simples, fácil de colar em qualquer cadastro:

```
AUPUS-TON;SN=00042;T=4;V=V2;MAC=98:A3:16:EB:E1:A0
```

❓ **Depois (quando existir a página):** URL `https://nexon.aupusenergia.com.br/ton/98A316EBE1A0`
abrindo a ficha da TON (status, última comunicação, firmware, instalação). Só trocar o conteúdo
do QR quando a rota existir — QR impresso não se atualiza.

### 3.3 Cor da variante (faixa)

Cor como **apoio**, sempre com o texto `TON1…TON4` ao lado (não depender só da cor):

| Variante | Montagem | Cor sugerida |
|---|---|---|
| **TON1** | base (RS485, Ethernet, SD, BI, TR, AN) — sem LoRa, sem relés | cinza |
| **TON2** | + LoRa | azul |
| **TON3** | + relés (comando) | laranja |
| **TON4** | + LoRa + relés | verde Aupus `#3fe04f` |

**Versão da placa** (V1 × V2) em **texto grande e com contorno** (`V2` em caixa preta, por exemplo),
porque é a informação que mais causa erro em campo:

- **V2 desloca os relés** (V1: RL1-6 = GP1-GP6; V2: RL1-8 = GP0-GP7) → firmware errado aciona o relé errado.
- **Designadores de borne colidem**: na V1 `X7` = analógicas e `X8` = PWM; na V2 `X77` = analógicas, `X88` = PWM e **`X8` = relé 8**.
- V2 tem **SU+ (`X14`)** para o SSU e **M0/M1 do LoRa aterrados** (`lora config` não funciona).

### 3.4 Alimentação (nível de tensão da fonte)

Pelos esquemáticos (V1 `SCH-TON-v1a` e V2 `SCH-TON-v1b`), a TON é alimentada em **5 V CC**
(jack J1 `+`/`–` ou USB-C, via diodo) → regulador LM1117 → 3,3 V. Os relés também têm bobina de 5 V.
**Não há conversor de 12/24 V na placa**: ligar a fonte do quadro (12 ou 24 V CC) direto no J1
queima o regulador e o ESP32.

| Item | Na etiqueta A | Observação |
|---|---|---|
| Tensão de entrada | **`5 V CC`** | Igual na V1 e na V2 |
| Aviso | **`NÃO ligar 12/24 V`** | O erro mais provável em quadro, onde a fonte disponível costuma ser 24 V CC |
| Borne | `J1 (+ / –)` | Indicar polaridade também junto ao borne (ver §5) |
| Consumo | ❓ `≤ x A` | Medir em bancada com TON4 V2 (8 relés ligados + LoRa transmitindo + Ethernet) para dimensionar a fonte; até lá, especificar fonte **5 V / 2 A** |

Na **etiqueta B** (instalação) registrar **qual fonte alimenta a TON** (ex.: `Fonte 24→5 V CC 2 A, disjuntor F3`),
para quem for trocar a placa saber de onde vem a alimentação. Se a fonte for **nobreak/bateria** (TON do controle MED,
falta de energia), indicar também.

> Se uma revisão futura da placa ganhar entrada 12–24 V (conversor buck), a etiqueta muda para a
> faixa aceita (ex.: `ALIM. 9–30 V CC`) — por isso o campo é impresso a partir da **versão** da placa, não fixo no modelo.

### 3.5 Formato e material

- **Tamanho:** 50 × 25 mm (cabe na lateral da caixa da TON). QR com no mínimo 12 × 12 mm.
- **Material:** poliéster/vinil branco fosco com **ribbon resina** (térmica-transferência) — resiste a calor de quadro, umidade e álcool. Evitar papel térmico direto (apaga com o calor do quadro em meses).
- **Fonte:** sem serifa, SN em ≥ 14 pt, MAC em fonte monoespaçada ≥ 8 pt.
- **Posição:** na **caixa/tampa** (visível com a TON montada no trilho) **e** uma mini-etiqueta só com o SN (`00042`, 15 × 8 mm) **na própria placa**, perto do USB-C — para não perder a identidade se a placa sair da caixa.

## 4. Etiqueta B — instalação (campo)

Colada na porta interna do quadro, ao lado da TON. Pode ser impressa pelo NexON a partir do cadastro (❓ futuro: botão "Imprimir etiqueta" na ficha da TON).

```
┌────────────────────────────────────────────────────┐
│ TON-UFV-A · SN 00041 · TON1 V2                     │
│ Cliente: RUBENS · Planta: PONTAL · Inst.: UFV A    │
│ Função: leitura INV-01 (RS485) · comando limite/Q  │
│ Tópico: RUBENS/GO/PONTAL/UFV_A                     │
│ Rede: WiFi "xxxx" · IP 192.168.1.101 (DHCP)        │
│ Alim.: fonte 24→5 V CC 2 A · disjuntor F3          │
│ Comissionada: 18/11/2026 · Suporte: (xx) xxxx-xxxx │
└────────────────────────────────────────────────────┘
```

| Campo | Fonte |
|---|---|
| Nome da TON | nome no diagrama IoT (`TON-UFV-A`, `TON-MED`) |
| Cliente / Planta / Instalação | hierarquia do tópico (`PROPRIETARIO/ESTADO/PLANTA/INSTALACAO`) |
| Função | o que ela lê/comanda (ex.: "medidor SSU da concessionária", "pivô 1") |
| Tópico MQTT | tópico base do equipamento TON |
| Rede | SSID e modo (WiFi/cabo); **nunca a senha** |
| Alimentação | fonte que alimenta a TON (ex.: `Fonte 24→5 V CC 2 A · disjuntor F3 · nobreak`) |
| Data e contato | comissionamento e telefone do suporte Aupus |

**Itens de segurança que valem na etiqueta B quando aplicável:**
- TON com relés comandando carga: `⚠ COMANDO REMOTO — pode ligar/desligar sem aviso`.
- TON do controle MED (UFV): `Sem comunicação → vai a P estático em 90 s`.
- Entradas digitais: `BI = contato seco ao GND da placa (não aplicar tensão)`.

## 5. Bornes (V2) — etiqueta de régua opcional

Para quem faz a fiação, uma tira junto aos bornes evita confundir V1 × V2:

| Borne | Função V2 |
|---|---|
| `J1 (+ / –)` | **Alimentação 5 V CC** — não ligar 12/24 V |
| `X1…X8` | Relés RL1–RL8 |
| `X12-1…X12-8` | Entradas BI1–BI8 (contato seco ao GND) |
| `X77` | Analógicas AN1/AN2 (tensão) · AN_C1/AN_C2 (4-20 mA — ⚠ sem ADC nesta revisão) |
| `X88-1…8` | PWM1–PWM8 (open-drain) |
| `X11` | Transistores TR1–TR4 |
| `X14` | SU+ (saída serial do usuário / SSU) |
| RS485 A/B | Modbus RTU (1 porta) |

## 6. Processo

1. **Recebimento/produção:** scanner `mac-scanner.html` (Chrome, USB) → setar tipo + versão do lote → ler MAC pelo comando `sn` → o scanner dá o SN sequencial.
2. **Imprimir a etiqueta A** com o que o scanner gerou (exportar CSV → impressora de etiquetas, ex.: modelo com campos SN/Código/MAC/QR).
3. **Teste de fábrica** (`fabrica` no firmware de teste) → marcar ✔ na planilha do lote; placa reprovada **não** recebe etiqueta A (ou recebe com tarja vermelha "REPROVADA").
4. **Comissionamento:** cadastrar a TON no diagrama **pelo MAC da etiqueta** (ou QR), gravar, conferir o `[BOOT]` no Serial → colar a etiqueta B.
5. **Troca em campo:** a etiqueta A vai junto com a placa; a B fica no quadro e é atualizada com o novo SN. No NexON, seguir o procedimento de troca (desvincular a TON antiga para não ficar ponto em duas TONs).

## 7. Decisões em aberto ❓

| # | Pergunta | Sugestão |
|---|---|---|
| 1 | QR com texto ou URL? | Texto agora; URL quando existir a ficha `/ton/<MAC>` |
| 2 | Registro central do SN (hoje fica no `localStorage` do PC do scanner) | Tabela no banco (`ton_inventario`: sn, tipo, versão, mac, lote, teste_fabrica, status) — habilita a etiqueta B impressa pelo NexON |
| 3 | Cores da faixa por variante | Tabela §3.3 |
| 4 | Impressora/modelo de etiqueta | Térmica-transferência 50 × 25 mm com ribbon resina |
| 5 | Consumo máximo da TON (para dimensionar a fonte) | Medir em bancada com TON4 V2 a plena carga; até lá, fonte 5 V / 2 A |
| 6 | TONs V1 já em campo | Etiquetar na próxima visita (só etiqueta A com SN + MAC lido do NexON) |
