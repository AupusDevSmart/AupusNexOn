# Comando FC05 em relés: rearme de coil de PULSO vs coil de ESTADO (`hold`)

> Contexto: bancada URP6000 (jul/2026). Comando "dava sucesso mas não batia", ou
> "batia na 1ª vez e depois parava". Diagnóstico e correção abaixo. Este doc cobre o
> mecanismo geral (vale p/ qualquer relé) e a análise de segurança/regressão.

## 1. O problema (coil de comando arma na BORDA 0→1)

No URP6000 (e vários relés) a coil de comando remoto (abre 52 / fecha 51 / reset 48)
**arma na borda 0→1**. Escrever `1` dispara; a duração do pulso físico é interna
(`T S TIME`), não a duração do `1`. Consequências de deixar a coil em `1`:

1. **O próximo comando não gera borda nova → nada acontece.** Sintoma: "bate na 1ª
   vez, depois não bate mais nenhum".
2. **Um `1` pendente dispara sozinho** quando o relé sai de **LOCAL→REMOTO** (a atuação
   estava bloqueada em LOCAL; ao liberar, o `1` acumulado atua). Sintoma: "ao passar pra
   REMOTO ele bate a BO do S TRIP". Esse trip fantasma fica ATIVO e **bloqueia o Fechar**
   (cap. 29 do manual) — encadeando os três sintomas em um só bug.

## 2. A correção — REARME (write 1 → delay → write 0)

Em `AupusNexOn/public/iot-firmware-generator.v2.js`, caminho de comando simples FC05
(`modbus_exec_command`, ~linha 4355-4375):

```
writeSingleCoil(coil, true)          // arma (com 1 retry drenando RX)
if (m.hold !== true) {
  delay(rearm_ms)                    // default 3000; override por entrada (rearm_ms)
  <re-handshake se o catálogo tiver> // a janela auto-Modbus (DNP3) pode expirar no delay
  writeSingleCoil(coil, false)       // REARMA — com retry (0 perdido = coil travada = bug de volta)
}
return rc == ku8MBSuccess             // sucesso = resultado do WRITE de arme
```

**Duração do pulso (atualização 2026-07-24, pedido em bancada): default 3000 ms.** Observado no
URP6000: a saída física segue o NÍVEL da coil até o teto `T S TIME` — então o `rearm_ms` define
na prática a duração do pulso do RL (300 ms dava um "tec" curto demais). O write(0) agora refaz
o handshake (após 3 s a janela auto-Modbus do DNP3 pode ter expirado) e tem retry próprio.
`rearm_ms` é propagado pelo `_mergeIoBo` (pode vir do io_config por instância). **Validado em
bancada: com o rearme, o Abrir/Fechar do URP6000 voltou a bater sempre.**
⚠️ Efeito colateral do 3 s: `_process_command_inner` fica bloqueado ~3 s por comando (loop
parado — leitura/LoRa/MQTT esperam). Ok para comando manual raro; se um satélite LoRa um dia
tiver comando FC05 de pulso, rever contra a janela de ACK do gateway (4 s).

## 3. Pulso vs ESTADO — o flag `hold`

O rearme é CERTO p/ coil de **pulso**, mas ERRADO p/ coil de **ESTADO** (que deve
PERMANECER setada: modo local/remoto, seleção de grupo de ajuste, saída direta que fica
ligada). Pra essas, `hold: true` no cadastro **desliga o rearme** (`if (m.hold !== true)`).

Classificação aplicada no catálogo (`iot_device_modelos.mapeamento.bo_outputs`, jul/2026):

| Modelo | PULSO (sem hold, rearma) | ESTADO (`hold:true`) |
|---|---|---|
| **URP6000** | abrir(52), fechar(51), reset(48) | — |
| **7SR5** | cb1(109), led_reset(99), reset_cb_delta(121), reset_cb_total(120), reset_energy(142), reset_thermal(143) | bo1-8(0-7), local_mode(107), remote_mode(105), out_of_service(106), test_mode(149), user_sp1-4(199-202), user_dp1-2(207-208) |
| **7SR5111** | — (abre/fecha são **FC15**, ver §5) | sg1-4(129-132), spdon1-4(564-567) |
| **7SR10** | abrir(226), fechar(108), reset(99) | — |

## 4. ⚠️ FURO DE PLUMBING — `hold` ainda NÃO chega no firmware (PENDENTE)

O firmware lê `m.hold` do **`bo_map`** já mesclado. Mas:
- **`_mergeIoBo`** (mesmo arquivo, ~linha 359) só propaga `coil/func/register/addr/count/value`
  do `io_config` — **NÃO propaga `hold`**.
- **`IoMapEntry`** do `DeviceIoConfigModal.tsx` não tem campo `hold`.

Logo, um `bo_output` de ESTADO amarrado pela tela **perde o `hold`** → o firmware rearma →
**a coil de estado seria DESLIGADA**. Ou seja, o `hold:true` que gravei no catálogo é
**INERTE até este plumbing ser feito**. Ele só vale hoje se estiver direto no `bo_map` do
catálogo (não via `bo_output` amarrado).

**✅ PASSO 2 — FEITO NO FONTE (jul/2026):**
1. `DeviceIoConfigModal.tsx`: `hold?: boolean` no `IoMapEntry`, no `Link` e no tipo dos
   `bo_outputs`; carrega do bo_output selecionado (`hold: out.hold`), do io_config salvo
   (`hold: m.hold`) e grava no `buildConfig` (`...(l.hold ? { hold:true } : {})`).
2. `_mergeIoBo` (gerador, ~L360): `if (ov.hold === true || ov.hold === 'true') entry.hold = true;`
   — **publicado em `public/` e `dist/`** (a cópia servida já propaga hold).

**⚠️ FALTA: deploy do frontend.** As mudanças do modal estão no **fonte, type-check limpo**,
mas **ainda NÃO buildadas/deployadas** — não rodei `vite build` porque isso embarcaria o
`iot-diagram.tsx` em edição por outra sessão. **Sobem no próximo `vite build` coordenado.**
Depois do build + **regerar/regravar** a TON, a blindagem fica 100% ativa.

**Até o frontend subir: NÃO amarrar/usar coil de ESTADO** (modos, sg, spdon, user_*, bo1-8) —
seriam desligadas pelo rearme. Nenhuma está amarrada hoje (ver §6), então sem risco atual.

## 5. Por que NÃO quebra os relés em produção (análise de regressão)

- **Único FC05 amarrado em diagrama hoje:** URP6000 abre/fecha/reset (pulso) → o rearme
  **AJUDA** (é o que consertou). Confirmado por query em `iot_componentes.props->io_config->bo`.
- **Disjuntor do 7SR5/7SR5111 usa FC15** (`writeMultipleCoils`, double-bit 01=abre/10=fecha),
  caminho SEPARADO no gerador (`emitStep` func 0x0F) — **intocado** pelo rearme.
- **Nenhuma coil de ESTADO está amarrada** em diagrama nenhum → o rearme não toca nelas.

**Conclusão: zero regressão no que roda hoje.**

## 6. Mudança acessória (minha) — `value` no FC05 multi-step

No `emitStep` (caminho de `steps`, ~linha 4305) e no `emitTcpStep` (~1199), o FC05 passou a
aceitar `value:0` → escreve `false` (desliga). Default `true` (compat byte-idêntica). Serve
p/ futuros comandos LIGA/DESLIGA de coil de estado. **NÃO afeta** o caminho de comando simples
(onde está o rearme). Publicado em `public/` e `dist/` (nginx serve o `dist`).

## 7. RL diretos do URP6000 (coils 40-44) — REMOVIDOS por ora

Cheguei a cadastrar `rl1-5 LIGA/DESLIGA` (coils 40-44, estado). **Removidos** porque:
(a) dependem do `hold` (§4) pra ficarem ligados sem rearme, e (b) o DESLIGA (value 0) cai no
caminho de comando simples que ignora `value`. **Re-adicionar só depois do PASSO 2** + suporte
a `value` no comando simples. Como o rearme fez o Abrir/Fechar lógico voltar a funcionar, os
RL diretos viraram opcional (teste isolado de cada RL).

## 8. Verificação multi-agente (24/jul) — resultado

Revisão independente (gerador simulado em harness Node + C++ emitido compilado com
`g++ -fsyntax-only`, modal, catálogo no banco, análise de risco). **Confirmado:** estrutura do
código OK, catálogo bate 100% com a §3 p/ URP6000/7SR5/7SR5111, "único FC05 amarrado =
URP6000" verdadeiro no banco, caminho de leitura byte-intacto, sem risco de WDT (pior caso
~13 s ≪ 60 s) nem de desconexão MQTT (keepalive 60 s). **Correções/ressalvas encontradas:**

1. **CORRIGIDO no fonte** — modal: trocar equipamento/ponto não limpava `boId/addr/count/value/hold`
   do link → BO FC15/hold escolhido antes vazava pro novo ponto (`patchLink` das linhas ~181/195).
2. **Erro na §3:** a linha do 7SR10 diz `bo_outputs`, mas o 7SR10 **não tem** `bo_outputs` no
   banco — só `bo_map` (coils 226/108/99, pulso correto). Consequência: saídas dele não são
   amarráveis pelo modal até criar os `bo_outputs`.
3. **Imprecisão na §5:** "7SR5/7SR5111 usa FC15" só vale pro **7SR5111**. No 7SR5 (RTU) o cb1 é
   FC05 coil 109; e o `bo_map` do 7SR5 tem `cmd_abrir/fechar/reset = {func:5}` **sem coil** —
   se amarrado, gera comando quebrado (limpar ou completar esse bo_map).
4. Gap futuro: FC05 simples via **TCP nativo não tem rearme** (coil de pulso travaria como no
   RS485 pré-fix); e no RS485 o FC05 simples **ignora `value`** (sempre ON — desligar coil de
   estado exige `steps[]`). Nada em produção usa hoje.
5. Gap futuro: satélite **LoRa** + rearme 3 s estoura a janela de ACK de 4 s do gateway
   (retransmissão garantida). URP é WiFi de bancada — sem impacto atual.
6. San German 01 tem `cmd_abrir/cmd_fechar` amarrados **sem func/coil e com catalog_id vazio**
   (vínculo órfão inofensivo, mas irresolúvel — limpar quando mexer nesse projeto).

## Checklist do que falta
- [x] **PASSO 2 — código**: plumbing do `hold` no modal (`IoMapEntry`/`Link`/bo_outputs/load/select/save)
      + `_mergeIoBo`. Gerador **deployado** (public+dist). tsc limpo (o erro `fotoUrl` em
      `useEquipamentos.ts` é pré-existente e não relacionado).
- [ ] **Deploy do frontend**: `vite build` + deploy do `DeviceIoConfigModal.tsx` (staged no fonte).
      Coordenar com a sessão que edita `iot-diagram.tsx` p/ subir tudo num build só. Rodar
      `tsc --noEmit` antes. Depois, **regerar+regravar** a TON que usar coil de estado.
- [ ] Revisar se `bo1-8` do 7SR5 são mesmo estado (assumido) — confirmar no manual Siemens.
- [ ] (Opcional) Re-adicionar RL diretos do URP6000 com `hold` + `value` no comando simples.
