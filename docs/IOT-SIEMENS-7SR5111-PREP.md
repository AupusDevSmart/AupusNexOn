# Preparo de Implementação — Siemens 7SR5111 (Modbus TCP)

> **Contexto:** implementação do relé **Siemens 7SR5111** (7SR51 sobrecorrente, família 7SR5) na TON/NexOn.
> Base: [IOT-SIEMENS-7SR-CADASTRO.md](./IOT-SIEMENS-7SR-CADASTRO.md) (plano completo 7SR10+7SR5). Este doc é o **preparo específico do 7SR5111**.
> **Data:** 2026-07-13 · **Manual:** `/var/www/iot_nexon/mapa_modbus/SIEMENS/7SR5_Communication_Protocol_Manual_V2.40.pdf` (Ed. 04.2023)

## Decisões travadas

| # | Decisão | Escolha |
|---|---|---|
| Conexão | RTU (RS485) vs TCP (Ethernet) | **Modbus TCP, porta 502** — nó **Datalogger** no unifilar, link `tcp` |
| Mapa Modbus | export vs configurar | **Configurar no Reydisp Manager 2 p/ espelhar o 7SR10** (planilha abaixo) |
| Grandezas | só-corrente vs completo | **Completo (I + V + P/Q/FP)** — exige **entradas de TV ligadas** no relé |

## Estado do que já está pronto

- ✅ Catálogo: modelo **`siemens-7sr5111`** adicionado em `AupusNexOn/public/iot-device-catalog.v2.js` (protocolo `tcp`, porta 502, mapa espelhado do 7SR10).
- ✅ Gerador: suporte a proteção em Discrete Inputs (`bi_block.func 0x02 → readDiscreteInputs`) já existe.
- ⏳ Falta (sessão conjunta): configurar o relé no Reydisp · seed no DB · montar unifilar · gerar/gravar firmware · **validar em bancada**.

---

## 1. Planilha de configuração do Reydisp Manager 2

Configure o **arquivo de mapeamento Modbus TCP** do 7SR5111 com **exatamente** estes endereços/formatos, para o device casar com o cadastro `siemens-7sr5111`. Todos os pontos de medição são **`FP_32BITS_3DP`, Mult = 1, 2 registradores (big-endian, high word primeiro)**.

### 1.1 Medições — Input Registers (FC04)
Bloco de leitura da TON: **30016–30089** e **30118–30141** (contíguos).

| Grandeza | Endereço Modicon | Frame PDU | Formato | Mult |
|---|---|---|---|---|
| Va Primary | 30016 | 15 | FP_32BITS_3DP | 1 |
| Vb Primary | 30018 | 17 | FP_32BITS_3DP | 1 |
| Vc Primary | 30020 | 19 | FP_32BITS_3DP | 1 |
| Frequency | 30060 | 59 | FP_32BITS_3DP | 1 |
| Ia Primary | 30064 | 63 | FP_32BITS_3DP | 1 |
| Ib Primary | 30066 | 65 | FP_32BITS_3DP | 1 |
| Ic Primary | 30068 | 67 | FP_32BITS_3DP | 1 |
| In Primary | 30088 | 87 | FP_32BITS_3DP | 1 |
| P 3-fase (ativa) | 30118 | 117 | FP_32BITS_3DP | ⚠️ ver §3 |
| Q 3-fase (reativa) | 30126 | 125 | FP_32BITS_3DP | ⚠️ ver §3 |
| Power Factor A | 30136 | 135 | FP_32BITS_3DP | 1 |
| Power Factor B | 30138 | 137 | FP_32BITS_3DP | 1 |
| Power Factor C | 30140 | 139 | FP_32BITS_3DP | 1 |

> ⚠️ **Contiguidade dos blocos:** a TON lê os blocos inteiros (30016→30089 e 30118→30141), não ponto a ponto. **Todos os registradores dentro dessas faixas precisam existir/ser válidos no mapa** — se houver "buraco" (registrador não mapeado), a leitura de bloco pode retornar exceção Modbus. Opções: (a) preencher a faixa como no default do 7SR10, ou (b) me avisar quais pontos ficaram de fora que eu **encolho os `ai_blocks`** para spans mínimos ao redor dos pontos reais.

### 1.2 Proteções — Discrete Inputs (FC02)
Bloco de leitura da TON: **10102–10403**.

| pid NexOn | Função | Modicon | Frame PDU |
|---|---|---|---|
| local_remoto | Local/Remote Mode | 10104 | 103 |
| f51a / f51b / f51c | 51 temporizada (estágios 1/2/3) | 10122 / 10128 / 10134 | 121 / 127 / 133 |
| f50a / f50b / f50c | 50 instantânea (estágios 1/2/3) | 10123 / 10129 / 10135 | 122 / 128 / 134 |
| f51n / f50n | 51N / 50N terra (estágio 1) | 10124 / 10125 | 123 / 124 |
| fba | 50BF falha de disjuntor | 10146 | 145 |
| f46 / f47 | 46 desequilíbrio / 47 seq. inversa | 10150 / 10152 | 149 / 151 |
| f59n | 59N sobretensão residual | 10159 | 158 |
| f81 | 81 sub/sobrefrequência | 10161 | 160 |
| dj_bloqueado | Lockout | 10174 | 173 |
| dj_aberto | CB1 Opened | 10219 | 218 |
| f27a=f59a / f27b=f59b / f27c=f59c | 27/59 por fase (bit combinado) | 10401 / 10402 / 10403 | 400 / 401 / 402 |

> ⚠️ **Estágio ≠ fase / 27 e 59 combinados:** o 7SR5 reporta 50/51 **por estágio (1–4)** e junta 27+59 num único bit por fase. Os labels "Fase A/B/C" no NexOn ficam imprecisos — decisão herdada do §7 do doc base. Se quiser separar por estágio, dá pra estender os pids (`f51_1`…) mais tarde.

### 1.3 Comandos — Coils (FC05)
| pid NexOn | Comando | Modicon | Frame PDU |
|---|---|---|---|
| cmd_abrir | Cmd Trip (**desliga disjuntor**) | 00227 | 226 |
| cmd_fechar | CB1 Close (confirmar) | 00109 | 108 |
| cmd_reset | LED reset | 00100 | 99 |

> ⚠️ **`cmd_abrir` desliga o disjuntor de verdade.** Só cadastrar com envelope+ack e confirmação dupla na UI. Testar só em bancada com disjuntor de teste. Confirmar se `cmd_fechar` (00109) fecha ou é toggle.

---

## 2. Habilitar Modbus TCP no 7SR5111 (Reydisp)

Vem **desabilitado de fábrica, sem IP** (por segurança). No Reydisp Manager 2:

1. Selecionar o device → **Ethernet Interface** → aba **Services** → habilitar **Modbus TCP** (§5.2 do manual).
2. Configurar **IP / máscara / gateway** conforme a rede (o mesmo LAN que a TON alcança).
3. **Unit ID = station address (1–247)** — anotar; tem que casar com o cadastro do relé no unifilar.
4. Porta **#1 = 502** (default). Pode rodar junto com IEC 61850 na mesma interface.
5. Gerar/baixar o mapa; exportar uma cópia do arquivo de mapeamento pra guardarmos como fonte-da-verdade.

---

## 3. Pontos a validar em bancada (antes de campo)

1. **Offset de endereço** — ler `Va` (Modicon 30016 → frame 15). Se vier lixo, testar base 30000 (frame 16) e ajustar `ai_blocks[].start`.
2. **Escala FP_32BITS_3DP** — injetar V/I/freq conhecidos e conferir `S32/1000`. Alta confiança.
3. **⚠️ Escala de P e Q (Mult)** — ponto mais incerto. Injetar carga conhecida e comparar com o display do relé para achar o divisor real. **Não publicar potência em produção antes disso.**
4. **TV realmente ligada** — se não houver TV, V/P/Q/FP voltam `-2147483648` ("inválido", nota 5 do manual). Confirmar a fiação de TV e a MLFB completa (`7SR5111-…`).
5. **Contiguidade dos blocos** (§1.1) — confirmar que a leitura de bloco não dá exceção.
6. **Proteções** — forçar um pickup e ver o bit no MQTT.
7. **Comandos por último** — `cmd_abrir`/`cmd_fechar` em disjuntor de bancada.

---

## 4. Checklist da sessão conjunta

- [ ] **Você:** configurar o mapa Modbus do 7SR5111 no Reydisp (§1) + habilitar TCP/IP/Unit ID (§2) + exportar o arquivo.
- [ ] **Você:** confirmar MLFB completa e fiação de TV (§3.4).
- [ ] **Eu:** seed do catálogo no DB — `aupus-service-api` → `scripts/db/seed-iot-catalog.ts` (idempotente; roda após bancada ok).
- [ ] **Eu:** montar o nó no unifilar da planta — **Datalogger** (`tcp`, IP do relé:502, Unit ID) → relé `siemens-7sr5111`.
- [ ] **Nós:** gerar firmware, gravar na TON (OTA), rodar §3 na bancada.
- [ ] **Nós:** validar escala de P/Q (§3.3) → só então liberar potência no dashboard.

---

## Apêndice — origem dos endereços

Os endereços Modicon acima derivam do cadastro `siemens-7sr5111` (espelho do 7SR10) pela convenção Modbus 1-based do manual (§6.1 do doc base): FC04 `Modicon = frame + 30001`; FC02 `Modicon = frame + 10001` (com `frame = bi_block.start(101) + coil`); FC05 `Modicon = frame + 1`. Mesma convenção do P3U30.
