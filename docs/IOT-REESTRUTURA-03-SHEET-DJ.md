# Reestruturação IoT — Fase 6: Sheet do DJ + Config SCS

> Modelo do chefe (arquivos/nexon-modelo.md §3-6) aplicado ao Disjuntor.
> Mockups: `arquivos/nexon-web-dj.html` + `nexon-sheet-dj.html` (5 configs).
> Data: 2026-09-09.

## 1. Regra de montagem da tela (do mockup, literal)
> "A tela é montada pelo que foi **declarado no cadastro** e **vinculado no arqIoT**."

| Bloco | Aparece quando |
|---|---|
| **Cadastro** (corrente nominal, alimentado por, alimenta) | sempre |
| **Estado** (hero: Fechado/Aberto + L/R) | `scs_status` + vínculo → senão "Sem supervisão" |
| **Controles** (Abrir/Fechar) | `scs_comando` + vínculo |
| **Status** (aberto/fechado/mola/L-R) | `scs_status` |
| **Medição** (potência, carregamento, V/I fase, energia por posto, gráfico) | `scs_medicao` ∈ {pm, ied} + PM associado |
| **Registros** (manobras) / **Eventos** (só IED) | conforme |

3 estados do ponto: declarado+vínculo (operante) · declarado-sem-vínculo (inerte, traço) · não-declarado (some).

## 2. Modelo de dados (decisões fechadas com o usuário)
- **Declaração SCS = colunas em `equipamentos`** (não jsonb): `scs` (bool), `scs_comando` (bool), `scs_status` (bool), `scs_medicao` (`nenhuma`|`pm`|`ied`). ✅ criadas.
- **Pontos nativos = no TIPO** (`tipos_equipamentos.propriedades_schema.pontos_nativos`): Disjuntor → comando `abrir`/`fechar`; status `aberto`/`fechado`/`mola_carregada`/`local`/`remoto`; `medicao_perfis:[pm,ied]`. ✅ gravado. (Cadastro não cria comando do nada — herda do tipo; custom opcional depois.)
- **Vínculos (arqIoT) — JÁ EXISTEM, só reorganizar no "Configurações SCS" da TON:**
  - PM↔DJ: `iot_componentes.props.disjuntor_equipamento_id` → `iot.service.powerMeterByDisjuntor()`.
  - Status aberto/fechado: relé (52a/52b) publica `dj_aberto`/`dj_fechado`; link em `io_config.bi` do relé → `iot.service.statusFonteDoDisjuntor()`.
  - Comando abrir/fechar: `ton_bo` (BO por ponto do DJ).
- **Correspondência (título exibido ↔ campo JSON)**: pré-preenchida do catálogo (`iot_device_tipos.medidor_energia.pontos.ai` já tem `label`+`json`: "Tensão Fase A"↔`Va`). Override por-DJ (raro) = mapa opcional guardado no vínculo PM↔DJ.

## 3. "Configurações SCS" da TON (a UI de vínculo)
Botão no modal da TON → lista os **dispositivos conectados à TON** (do diagrama IoT). Para cada:
- Associar a um **elemento do unifilar com SCS habilitado** (ex.: o PM → um DJ; o relé → um DJ p/ status).
- Mostrar/editar a **correspondência de pontos** (título ↔ json), já pronta do catálogo.
- Validar capacidade (DJ com comando exige BO/BI livres — reusa validação do ton_bo).

## 4. Fase de execução (o que o usuário pediu: sheet + config SCS juntos)
1. **Backend — endpoint agregador** `GET /iot/disjuntor/:id/scs-bundle`: junta cadastro (nome, corrente nominal, alimentado por/alimenta do diagrama) + declaração SCS + `powerMeterByDisjuntor` + `statusFonteDoDisjuntor` + comandos (`ton_bo`) + correspondência (catálogo). Escopo por dono.
2. **Sheet do DJ** (componente novo, data-driven): renderiza os blocos do §1 lendo o bundle + assina telemetria ao vivo (PM `equipamentos_dados`; relé p/ status). Substitui o callback legado ao clicar um DJ no unifilar.
3. **Config SCS na TON** ✅: botão "Configurações SCS" no painel de props da TON (guardado por tipo `ton*` + exige `equipamento_id`) → `ConfigScsTonModal.tsx`. Lista os devices conectados à TON (`GET /iot/ton/:id/scs-config`) e associa **PM/medidor/relé/inversor** a um elemento do unifilar com `scs=true` da mesma unidade (`POST /iot/scs/vinculo` grava `iot_componentes.props.disjuntor_equipamento_id`). Cada device mostra a **correspondência de pontos** (título ↔ campo JSON), pré-preenchida do catálogo `iot_device_tipos.pontos` (ai=Medições, bi=Estados, bo=Comandos; `json` cai no `id` quando o catálogo não define — ex.: relé só tem `label`). Relé associável (mede tensão/corrente/estados 52a-52b). Modal **mestre-detalhe** (grande, rolável): lista de dispositivos à esquerda; ao selecionar um, à direita aparece a associação + a correspondência **EDITÁVEL** (input por campo JSON). Cada ponto traz `json_default` (catálogo) + `json` (efetivo); editar sobrescreve (âmbar), "Restaurar catálogo" volta. Salva só os que divergem via `POST /iot/scs/pontos` → `iot_componentes.props.pontos_override` (mapa {ponto_id:json_key}); `tonScsConfig` reaplica o override na leitura. Round-trip validado (save/reflete/reset). Pendente: pintar status do DJ via io_config.bi. Deployado (build OK).

## 5. O que muda no cadastro (geral, depois)
Some "habilitar comando / criar comando do nada": DJ vem com pontos padrão do tipo; cadastro só liga SCS + escolhe comando/status/medição. Simplificação geral do cadastro = fase própria (usuário vai detalhar).

**Habilitar SCS (interino) ✅**: enquanto a simplificação do cadastro não chega, o toggle de SCS vive no próprio sheet do DJ — botão "Configurar SCS" no header abre um painel (Switch SCS habilitado + checkboxes Comando/Status + select Medição nenhuma/pm/ied). Grava via `PATCH /iot/disjuntor/:id/scs` (`setDisjuntorScs`, `$executeRaw` nas colunas scs_*; desligar zera comando/status/medição; escopado por dono). Quando SCS off, o corpo mostra um aviso tracejado "Habilitar SCS". É o que coloca o DJ na lista de elementos SCS do modal da TON.

## 6. Pendências
- Onde ler "corrente nominal / alimentado por / alimenta" (cadastro do DJ) — provável `equipamentos_dados_tecnicos` + conexões do diagrama unifilar.
- IED (perfil de medição com eventos) — depois do PM.
- Custom points (add manual) — depois.
