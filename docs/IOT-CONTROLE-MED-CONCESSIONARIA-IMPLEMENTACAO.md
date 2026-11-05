# Controle automático pelo MED Concessionária — implementação

> **Status:** Fase A implementada em 05/11/2026 (backend + tela, modos desligado/sombra/ativo). Fase B (firmware) pendente.
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
| **Validade do setpoint na TON** (TTL + sequência, R6), **modo seguro em 2 estágios** e watchdog local | Firmware (Fase B). Hoje, no ativo, se o NexON parar o último limite fica no inversor. O diálogo de ativação avisa |
| **Read-back** do registrador de limite e resposta Modbus no ack (R5) | Firmware + catálogo (Fase B). Hoje a confirmação é só P medido ≤ limite |
| Posto reativo e virada da hora vindos da SSU (`pr`) | Firmware (Fase B). Hoje: janela cadastrada e hora pelo relógio da TON/gateway |
| BI manual (chave automático/manual) na TON da UFV | Firmware (Fase B) |
| Banco de capacitores como atuador; SEP (carga) | Não há banco/carga comandada pela TON cadastrada. A demanda de carga hoje só **libera geração**; o que faltar vira evento "SEP indisponível" |
| Corte de P para gerar Q (6.4) | Depois do FP validado em sombra |
| Partida de pivô / suporte de tensão (§9) | P&D |
| Notificações (WhatsApp/e-mail) | Nascem desligadas. Hoje os eventos ficam no ciclo e no card |
| Balanço medidor × Σ cargas − Σ geração no portão | Precisa dos PMs de carga associados |
| Sinal do `sp_q_pct` por modelo no catálogo | Hoje é por inversor no cadastro (`Q +`/`Q −`) |
