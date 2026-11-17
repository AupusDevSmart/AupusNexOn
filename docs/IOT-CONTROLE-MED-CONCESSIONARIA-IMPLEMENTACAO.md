# Controle automático pelo MED Concessionária — implementação

> **Status:** Fase A implementada em 05/11/2026 (backend + tela, modos desligado/sombra/ativo). Fase B (controle local na TON da UFV: validade, modo seguro, BI manual, read-back, posto reativo da SSU) implementada em 17/11/2026 — falta bancada (§5.6).
> **Base:** spec revisada `/var/www/nexon-controle-med-concessionaria (1).md` + decisões R1–R12 em [IOT-CONTROLE-MED-CONCESSIONARIA-DIVERGENCIAS.md](IOT-CONTROLE-MED-CONCESSIONARIA-DIVERGENCIAS.md) §6.

## 1. Como funciona

1. A TON-V2 com SSU publica um registro por **minuto do medidor** (`fim: 0`) e um no **fechamento do intervalo** (`fim: 1`).
2. O `mqtt.service` grava o minuto em `ssu_minutos` e emite o evento `ssu_minuto`.
3. O `ControleMedService` espera 3 s sem minuto novo. Um poll do LoRa pode trazer vários minutos juntos, e só o último dispara o ciclo (R7).
4. Para cada MED com algum controle fora de "desligado", roda o **ciclo**:
   - **portão de qualidade:** `sts = 0`, erros da SSU subindo, minuto faltando, quadrante incoerente com o sentido da potência ou minuto velho. Se reprovar, mantém o último setpoint e registra o motivo;
   - **retomada:** depois de um portão reprovado, só volta a atuar com `n_retomada` ciclos válidos seguidos;
   - **confirmação:** inversor com P medido acima do limite enviado (passado o tempo de resposta) 3 vezes sai da distribuição;
   - **demanda de carga → demanda de geração → FP** (ordem de prioridade);
   - **despachante:** um par P/Q por inversor;
   - **sombra:** registra o que mandaria. **Ativo:** manda `sp_limite_pct` e `sp_q_pct` pelo caminho de setpoint já existente (TON → Modbus);
   - grava o ciclo em `controle_med_ciclos` (retenção de 30 dias).

O MED do unifilar acha a TON da SSU pelo mesmo vínculo da ficha: o componente IoT com `disjuntor_equipamento_id` = MED.

## 2. Regras implementadas

| Regra | Onde (`controle-med.calc.ts`) |
|---|---|
| R3: média **projetada** do intervalo `(E·3600 + P·seg)/T` nunca acima do contrato. Espera 1 min só se o corte máximo ainda fechar o intervalo; senão corta no mesmo minuto | `decidirDemanda` |
| Gatilho também com projeção ≥ alvo e subindo | `decidirDemanda` |
| Liberar geração quando a projeção tem folga (menos a banda) | `decidirDemanda` + `despachar` |
| Duração do intervalo pelo `cdo` do medidor (15 min no campo; 5 min na bancada) | `grandezas` |
| FP horário (6.1): `Q_perm = (tanφ·(E_P + P̂·t_rest) − E_Q)/t_rest`, ΔQ e banda, ritmo mínimo entre ajustes, exportação mira Q importado ≈ 0, "hora perdida" | `decidirFp` |
| Janela do reativo: bit da SSU quando existir (`pr`); até lá, janela capacitiva cadastrada (padrão 00:00–06:00, hora de Brasília) | `janelaReativa` |
| Carta de capabilidade e divisão de Q pelo disponível (5.1/5.2) | `qDisponivel`, `dividirQ` |
| Corte pela UFV **mais distante** primeiro, liberação pela mais próxima | `despachar` |
| R2: UFV sem watchdog nativo validado → limite ≤ P estático | `despachar` |
| R4: teto do Σ`p_lim` pelo pior caso de perda de comunicação; cadastro que não fecha **bloqueia o ativo** | `validarCadastro` |
| Limites de P (R2/R4) só com controle de demanda ligado. Só FP ligado não mexe em P | `despachar` (`controlaP`) |
| Degrau mínimo de escrita (EEPROM); redução de P sempre vai | `despachar` |
| Ultrapassagem registrada no fechamento do intervalo | `ciclo` (`fim: 1`) |

## 3. Cadastro e permissões

- Tela: ficha do MED → **Configuração → Controle automático**:
  - modo de cada controle (Desligado / Sombra / Ativo, com confirmação para Ativo);
  - limites;
  - UFVs: ordem de distância, P estático, rota internet/LoRa, watchdog nativo validado, zera no estágio 2;
  - inversores: Pn, Smax, Q máx da carta, sinal do Q, Q à noite;
  - avançado e avisos da validação.
- Operação: card **Controle automático** com o último ciclo: projeção, decisão de cada controle, o que enviou ou enviaria e eventos.
- API: `GET /controle-med/:medId`, `GET …/ciclos`, `GET …/historico`, `PUT …/config`, `PUT …/modos`.
- Permissão (R10): alterar cadastro e modo = **configuração técnica** (admin e analistas). Escopo por dono (`assertEntityInScope`).
- Histórico de cada alteração em `controle_med_config_hist`. Contrato vazio = o da unidade consumidora.
- Migração: `aupus-nexon-api/db/manual-migrations/2026-11-05_controle_med_concessionaria.sql`. Todo controle nasce desligado.

## 4. Fora desta fase

| Item | Por quê / próximo passo |
|---|---|
| Read-back em inversor por **Modbus TCP** (datalogger) | Só RS485 confere relendo; TCP responde "escrito, sem read-back" (`w`) |
| Posto reativo da SSU na TON **satélite LoRa** (frame binário) | `pr`/`vr` só no JSON MQTT (TON da SSU com internet, caso da Pontal). Satélite segue pela janela cadastrada |
| Virada da hora pelo bit da SSU (`vr`) | Publicado; o acumulado da hora ainda usa o relógio (TON com NTP) |
| Energia injetada em MANUAL no log da BI | O backend registra início/fim (eventos do ciclo); a energia sai do histórico do inversor |
| Watchdog nativo do inversor configurado pela TON (spec §12) | Manual, por fabricante (R2). Sem ele, o limite dinâmico fica ≤ P estático |
| Banco de capacitores como atuador; SEP (carga) | Não há banco/carga comandada pela TON cadastrada. A demanda de carga hoje só **libera geração**; o que faltar vira evento "SEP indisponível" |
| Corte de P para gerar Q (6.4) | Depois do FP validado em sombra |
| Partida de pivô / suporte de tensão (§9) | P&D |
| Notificações (WhatsApp/e-mail) | Nascem desligadas. Hoje os eventos ficam no ciclo e no card |
| Balanço medidor × Σ cargas − Σ geração no portão | Precisa dos PMs de carga associados |
| Sinal do `sp_q_pct` por modelo no catálogo | Hoje é por inversor no cadastro (`Q +`/`Q −`) |

## 5. Fase B — controle local na TON da UFV (17/11/2026)

### 5.1 Onde está

| Camada | Arquivo |
|---|---|
| Lib pura (host-testável) | `firmware-libs/controle_ufv/controle_ufv.{h,cpp}` · `test_controle.cpp` (53 testes) |
| Glue (comandos, NVS, BI, hash) | `firmware-libs/controle_ufv/glue/ctl.{h,cpp}` · `glue/sim/test_ctl.cpp` |
| Empacotado para os geradores | `public/iot-firmware-controle.js` (gerado por `node tools/sync-controle-lib.mjs`) |
| Geradores V1 e TON-V2 | `spec.controle_ufv`: TON com **inversor que tem `sp_limite_pct` ou `sp_q_pct`** no catálogo leva a lib. Fica **inerte** até o backend mandar o cadastro |
| Read-back (R5) | `modbus_readback_sp()` gerado: relê o registrador do último passo `$valor` do `bo_map` (FC06 → 1 palavra; FC16 hi/lo → 2). Override no catálogo: `bo_map.<sp>.readback = {func, register, words}` ou `false` |
| SSU (TON-V2) | minuto/bloco ganham `"pr"` (posto reativo: 1 capacitivo, 2 indutivo) e `"vr"` (1 = fechou o intervalo de reativo) |
| Backend | `controle-med.ton.ts` (cadastro, hash, `ctl`, leitura do ack) + `ControleMedService.enviarTons()` |
| Emulador | `emulador-setpoints.ts`: o que a TON escreve vira read-back e muda P/Q servidos |

### 5.2 Protocolo (texto em `<BASE>/cmd`, também pelo LoRa)

```
ctl geral <n> <t2_s> <bi> <bi_inv>                   cadastro da TON (n inversores, estágio 2, BI da chave A/M)
ctl cfg <i> <addr> <p1> <p2> <pman> <rampa> <device>  inversor i: valores BRUTOS do registrador
ctl <seq> <ttl_s> [<i> <p> <q>]...                    setpoint com validade (seq = segundos do backend)
ctl off | ctl status | ctl limpar
```

Resposta (ack, ≤ 63 caracteres): `<modo> c=<hash> [s=<s em seguro>] [m=<s em manual>] [p=S1|S2] 1:ok 2:= ...`
- modo: `D` desligado · `A` automático · `S1`/`S2` modo seguro · `M` chave em manual.
- por inversor: `ok` confirmado pelo read-back · `w` escrito sem read-back · `=` já estava · `f` falhou (a TON tenta de novo a cada 15 s) · `rb<n>`/`rq<n>` read-back divergente · sufixo `r` = limitado pela rampa.
- `c=` = FNV-1a (24 bits) das linhas do cadastro. O backend compara com o dele e reenvia `geral`/`cfg` quando difere (TON trocada, NVS apagado, cadastro alterado).

### 5.3 Comportamento na TON

| Situação | O que a TON faz |
|---|---|
| Setpoint novo | Escreve só o que mudou (P primeiro), relê e responde |
| Mesmo valor (heartbeat) | Só renova a validade; **não escreve** (EEPROM) |
| `seq` menor que o último | Descarta (`seq_velho`): mensagem atrasada na malha LoRa |
| Validade vence | **Estágio 1**: P = P estático da UFV (mesmo % da Pn em cada inversor), Q = 0 |
| + `t_estagio2_s` | **Estágio 2**: P = 0 nas UFVs "zera no estágio 2" |
| Comunicação volta | Reduções na hora; subida de P limitada a `rampa_pct_min` % Pn por setpoint (≈ por minuto) |
| Chave A/M em **manual** (debounce 1 s) | P = 100 % Pn, Q = 0; pedidos do backend guardados e não escritos (R1) |
| Volta para automático | Pedido vigente se a validade não venceu; senão estágio 1 |
| `ctl off` | P = 100 %, Q = 0, watchdog desarmado |
| Reinício com o controle ativo | Validade corre a partir do boot com o último ttl (NVS); sem setpoint, vence → estágio 1 |

### 5.4 Backend

- Um `ctl` **por TON por ciclo** com todos os inversores dela (até 8; 3 por mensagem por causa do LoRa). Renova a validade mesmo sem mudança.
- `ttl` = `t_validade_lora_s` ou `t_validade_internet_s` pela rota da UFV (o menor entre as UFVs da TON).
- **Portão reprovado e retomada não renovam**: se a medição continuar ruim, a validade vence e a UFV vai sozinha ao modo seguro (R9).
- Firmware sem `ctl` (`unknown_cmd`): cai no setpoint por inversor de antes e avisa "regrave a TON".
- Nenhum controle ativo: `ctl off` nas TONs armadas (ao trocar o modo, na hora). Depois de um restart do backend, pergunta `ctl status` uma vez e desliga se alguma ficou armada.
- Eventos do ciclo: cadastro enviado, tempo em modo seguro (e se chegou ao estágio 2), chave em MANUAL e a volta, falha de escrita/read-back por inversor.
- Cadastro novo por UFV: **Chave A/M na entrada** (BI 1–8, 0 = sem) e **Contato fechado = automático**. Parâmetro novo: **Rampa da retomada** (%/min).

### 5.5 Testes

| Teste | Comando |
|---|---|
| Lib | `cd firmware-libs/controle_ufv && g++ -std=c++17 -Wall -o /tmp/tc test_controle.cpp controle_ufv.cpp && /tmp/tc` |
| Glue | `cd firmware-libs/controle_ufv/glue && g++ -std=c++17 -w -I../../pivo_local/glue/sim/stub -I. -I.. -o /tmp/tctl sim/test_ctl.cpp ctl.cpp ../controle_ufv.cpp && /tmp/tctl` |
| Bundle em dia | `node tools/sync-controle-lib.mjs --check` |
| Backend | `npx jest src/modules/controle-med` (hash do backend = hash do firmware no mesmo caso) |
| Emulador | `npx vitest run src/features/supervisorio/components/emulador` |
| Compilação | V1 (TON1 com Sungrow) e TON-V2 (satélite com pivô + inversor; e com SSU + WiFi) compilados com `pio run` |

fw-regress: os 22 firmwares de hoje são iguais byte a byte, **exceto** as TONs V1 com inversor Sungrow/Huawei/WEG, que ganham a lib (4 arquivos novos + hooks). A lib fica parada sem `ctl geral`.

### 5.6 Falta

- Bancada: ver [BANCADA-CONTROLE-FP-PONTAL.md](BANCADA-CONTROLE-FP-PONTAL.md) §8 (roteiro Fazenda Pontal com 2 UFVs).
- Confirmar em campo que o registrador de limite do Sungrow (5007) é legível por FC03 (read-back). Se não for, `bo_map.sp_limite_pct.readback = false` no catálogo.
