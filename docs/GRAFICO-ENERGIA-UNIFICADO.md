# Gráfico de energia unificado e strings do inversor

Duas pendências. **Web** = NexON no navegador (este repositório, `AupusNexOn`). **Backend** = `aupus-nexon-api`. **App** = aplicativo mobile, que consome o mesmo backend.

| | Web | Backend | App |
|---|---|---|---|
| **[1. Gráfico de energia unificado](#parte-1--gráfico-de-energia-unificado-visão-geral)** | ✅ feito (NEXON-37, 21/10) | ✅ feito (NEXON-37, 21/10) | ✅ selo de fonte (NEXON-37, 21/10; sai na próxima versão das lojas) |
| **[2. Strings não conectadas](#parte-2--strings-do-inversor-entradas-não-conectadas)** | ✅ feito (19/10) | ✅ feito (19/10) | ✅ feito (NEXON-37, 21/10; sai na próxima versão das lojas) |

---

# Parte 1 — Gráfico de energia unificado (Visão Geral)

Status: **implementado no NEXON-37 (21/10/2026)**, as três fases. Contrato da API em `aupus-nexon-api/docs/GERACAO-ANALISE.md` (seção da fonte da geração).

## Problema

Hoje a Visão Geral mostra até três gráficos de energia, com fontes e regras diferentes:

| Componente | Fonte | Resolução | O que só ele tem |
|---|---|---|---|
| Análise de geração (`features/geracao`, NEXON-16) | TON (inversores da unidade, todos) | 15 min | Curva esperada (irradiância), Perdas, Previsão, Fechamento, Semana |
| Demanda (`GraficoConfiguravelPanel` → `SinopticoGraficosV2`) | TON (equipamentos marcados na config) | 5 min | Carga, linhas de contratado, filtro Carga/Geração, Tensão/FP |
| Histórico de geração (`GeracaoHistoricoChart`) | Nuvem do fabricante (`geracao_horaria_plantas` / `geracao_diaria_plantas`) | 1 h / dia | Funciona sem TON, Total |

Na geração, os três mostram a mesma coisa com números ligeiramente diferentes: a Demanda desconta 3% de perdas, e a análise faz média de 15 min.

## Proposta: um cartão "Energia"

Um único gráfico com:

- **Período:** Dia · Semana · Mês · Ano · Total, com navegação ‹ data ›.
- **Séries (botões):** Carga · Geração · Esperado. Esperado só aparece quando a unidade tem fonte de irradiância.
  - Carga e Geração marcadas: gráfico espelhado (consumo para cima, geração para baixo).
  - Só uma marcada: essa série para cima.
- **Dia:** curva de potência (kW). Linhas de contratado com tolerância (carga +5%, geração +1%). Esperado tracejado.
- **Semana/Mês/Ano/Total:** barras de energia (kWh) de geração e consumo, com o esperado por dia ou mês.
- **Tensão e FP:** continuam como abas do mesmo cartão (só com medidor).
- **Cartões abaixo:** Geração no período, Fechamento do mês, Previsão de amanhã, Perdas. São os da análise, sem mudança de regra.
- **Selo de fonte** no cartão: "Fonte: TON", "Fonte: nuvem" ou "Fontes divergem — usando TON".

Saem da tela: o gráfico de cima da análise e o `GeracaoHistoricoChart`. A lógica dos dois é reaproveitada.

O layout acima é do **web**. Para o app, ver [No app](#no-app-parte-1).

## Fonte da geração: TON ou nuvem

A carga só existe pela TON (medidores). A escolha vale para a **geração**.

### Configuração por unidade

`fonte_geracao`: `automatico` (padrão) · `ton` · `nuvem`. Fica na engrenagem do cartão e só aparece para super_admin/admin.

### Regra do automático (por dia)

1. Só uma fonte tem dado no dia → usa essa.
2. As duas têm dado:
   - divergência de até **5%** → **TON** (resolução melhor).
   - TON **incompleta** no dia (algum inversor configurado sem leitura em mais de 30% do período solar) e nuvem completa → **nuvem**.
   - nuvem = 0 com TON > 0 → **TON** (integração quebrada, caso UFV Aupus II).
   - divergência acima de 5% sem explicação acima → **TON**, com selo "Fontes divergem" e o número das duas no tooltip. O admin decide e fixa a fonte na configuração.

A regra é por **dia**, então um mês pode misturar dias de TON e dias de nuvem. O tooltip da barra diz a fonte de cada dia.

### Casos reais (12–19/10/2026)

| Unidade | TON × nuvem | Automático escolheria |
|---|---|---|
| UFV SOLAR POWER | 0% | TON |
| San German 02 | ±0,5% | TON |
| San German 01 | **TON +50%** todo dia | TON + selo "divergem" → admin fixa **nuvem** (ou corrige o cadastro: a TON parece somar um inversor da SG02) |
| UFV Aupus II | nuvem = 0 | TON |

## Onde fica a regra (backend)

- Um serviço `FonteGeracaoService` devolve, por unidade e dia: `kwh_ton`, `kwh_nuvem`, `fonte_escolhida`, `motivo`.
- A análise de geração (`geracao-analise`) passa a usar esse kWh do dia em vez de só a TON. As curvas de 15 min continuam da TON quando ela for a escolhida; com a nuvem, a curva do Dia é a horária da nuvem.
- O COA ("Energia hoje") e o boletim usam o mesmo serviço, para os números baterem em toda parte.
- `geracao_diaria_plantas.origem` já tem prioridade `manual > ton > nuvem` (Geração FV manual). O manual continua vencendo tudo.

## Fases

1. **Serviço de fonte + selo:** `FonteGeracaoService`, config `fonte_geracao`, selo e divergência no cartão atual. Sem trocar o layout.
2. **Cartão único:** junta a Demanda e a análise num componente; tira o gráfico de cima da análise e o histórico da nuvem.
3. **COA e boletim** passam a usar a mesma fonte.

## No app (parte 1)

- A regra de fonte fica **só no backend** (`FonteGeracaoService`). O app não decide a fonte: usa o que o backend devolver, para o número bater com o web, o COA e o boletim.
- Quando a fase 1 sair, o app deve mostrar o **selo de fonte** ("TON", "nuvem" ou "fontes divergem") onde exibir a geração.
- O cartão único (fase 2) é desenho do web. O app adapta à tela dele; o que precisa ser igual são os números e a fonte.
- Configurar a fonte (`fonte_geracao`) fica só no web, para admin.

## Decidido

- **Limite de divergência: 5%.**
- **Fonte preferida: TON.** A nuvem entra quando a TON não tem dado ou está incompleta, ou quando o admin fixa.
- Quem fixa a fonte: só super_admin/admin.
- Implementação dentro do NEXON-16, que já é dono da análise de geração e dos arquivos da Demanda.

## O que já existe e pode ser reaproveitado

- Filtro Carga/Geração e o gráfico espelhado: `sinoptico-graficos-v2.tsx` (`verCarga`/`verGeracao`, `modoFluxo`, `soCarga`), `GraficoDemanda.tsx` (`fluxo`, `serie`), `dados.ts` (`mesclarFluxo`, `mesclarEnergia`).
- Área com base no zero quando há valores negativos: `components/charts/area.tsx`.
- Energia de medidor sem contador (só `Pt`): potência média × horas, em `equipamentos-dados.service.ts` (`getGraficoDiaAgregado` e os agregados de mês e ano).
- Comparação TON × nuvem por dia: TON = soma de `MAX(energy.daily_yield)` por inversor no dia em BRT; nuvem = `MAX(kwh_acumulado)` do dia em `geracao_horaria_plantas`.

---

# Parte 2 — Strings do inversor: entradas não conectadas

Status: **web ✅ e backend ✅ (19/10/2026). App ✅ (NEXON-37, 21/10/2026).**

O que o app precisa fazer: chamar o `GET` abaixo e aplicar a mesma [regra de exibição](#regra-de-exibição-replicar-no-app). O backend não muda nada para o app; a classificação é feita na tela, igual ao web.

## O problema

A ficha do inversor marcava a string em alerta ou falha quando a corrente dela ficava muito abaixo da **mediana das strings no mesmo instante**. Isso dava alerta falso em dois casos:

1. **Entrada sem string pelo projeto.** O Huawei SUN2000-100KTL do Prevest (INV-02) tem 20 entradas e só 13 são usadas. As entradas 2, 6, 8, 10, 14, 16 e 18 ficam sempre em 0 A e apareciam como falha.
2. **String que naturalmente gera menos**, por orientação ou comprimento diferente. Uma string que sempre gera cerca de 55% da mediana ficava em "abaixo do esperado" o dia todo.

## O que mudou

- Entrada que **nunca tem corrente** no histórico passa a ser **"não conectada"**: cinza, com o texto "não conectada", e **fora dos alertas**.
- As demais strings são comparadas com o **esperado dela**, e não com a mediana crua: `esperado = razão típica da string (histórico) × mediana das strings ativas agora`.
- O admin pode **forçar** cada entrada como "usada", "não usada" ou "automático". A escolha manual sobrepõe a detecção.

## API

Base `/api/v1`, autenticação Bearer (a mesma do app). Escopada por dono: o proprietário só acessa os próprios equipamentos.

### `GET /equipamentos/:id/strings`

Perfil dos **últimos 14 dias**, só com o inversor gerando. Cache de 30 minutos no servidor. Exemplo (valores ilustrativos):

```json
{
  "strings": [
    { "n": 1, "presenca": 0.98, "razao": 1.62, "amostras": 3120 },
    { "n": 2, "presenca": 0.00, "razao": 0.0,  "amostras": 3120 },
    { "n": 12, "presenca": 0.97, "razao": 0.64, "amostras": 3120 }
  ],
  "leituras": 3120,
  "desde": "2026-10-05T11:02:00.000Z",
  "modos": { "2": "nao_usada" },
  "janela_dias": 14
}
```

| Campo | Significado |
|---|---|
| `strings[].n` | Número da entrada (= `dc.string<n>_current` do dado em tempo real) |
| `strings[].presenca` | Fração das leituras (0 a 1) com mais de 0,5 A nessa entrada |
| `strings[].razao` | Mediana de `corrente da string ÷ mediana das strings ativas`; `null` sem amostras |
| `strings[].amostras` | Leituras usadas para essa entrada |
| `leituras` | Total de leituras válidas (com sol: mediana das strings ≥ 2 A) |
| `modos` | Ajuste manual: `"usada"` ou `"nao_usada"`. Ausente = automático |

> A resposta pode vir no envelope padrão (`{ data: { data: … } }`). O web lê `r.data.data.data ?? r.data.data ?? r.data`.

### `PUT /equipamentos/:id/strings`

Exige `equipamentos.manage`. Corpo: `{ "modos": { "2": "nao_usada", "12": "usada" } }`.

- Mande o **mapa completo**: ele substitui o anterior.
- Para voltar uma entrada ao automático, **tire a chave** do mapa.
- Entradas válidas: 1 a 48. A resposta é igual à do `GET`.

## Regra de exibição (replicar no app)

A mesma do web ([InversorSheet.tsx](../src/features/supervisorio/v2/components/sheets/InversorSheet.tsx)):

```ts
// 1) Entrada não conectada?
function naoConectada(perfil, n): boolean {
  const m = perfil?.modos?.[String(n)];
  if (m === 'nao_usada') return true;
  if (m === 'usada') return false;
  const p = perfil?.strings.find((x) => x.n === n);
  return !!perfil && perfil.leituras >= 100 && !!p && p.presenca < 0.02;
}

// 2) Mediana AGORA, só das entradas em uso com corrente > 0,5 A
const emUso = strings.filter((s) => !naoConectada(perfil, s.n));
const med = mediana(emUso.map((s) => s.a).filter((a) => a > 0.5));

// 3) Esperado da string (cai na mediana crua se o perfil ainda é fraco)
function esperado(n) {
  const p = perfil?.strings.find((x) => x.n === n);
  return p && p.amostras >= 100 && p.razao != null && p.razao > 0.05 ? p.razao * med : med;
}

// 4) Classificação (só com o inversor online E gerando)
function estado(n, a): 'nao_conectada' | 'falha' | 'alerta' | 'ok' {
  if (naoConectada(perfil, n)) return 'nao_conectada';
  const e = esperado(n);
  if (e > 2 && a < 0.2) return 'falha';        // vermelho
  if (e > 1 && a < 0.7 * e) return 'alerta';   // amarelo
  return 'ok';
}
```

Status do card do inversor:

- Falha ativa do inversor (`status.fault_1..5` ≠ 0) → **Falha**.
- Senão, alguma string em `falha` ou `alerta` → **Alerta** ("String N abaixo do esperado" / "N strings abaixo do esperado").
- Senão → **Normal**.
- Entradas `nao_conectada` **nunca** entram nessa contagem.

Na lista de strings, a entrada não conectada mostra valor e texto "não conectada" em cinza. O resumo do topo fica "N em alerta" (opcional: "N não conectadas").

Se o `GET` falhar ou o perfil ainda não existir (inversor novo, com menos de 100 leituras), vale o comportamento antigo: comparação com a mediana, sem entrada marcada como não conectada.

## Configuração manual (só web)

No web, fica na aba **Configuração** da ficha do inversor (Automático / Usada / Não usada por entrada + Salvar, que faz o `PUT`). O app não precisa ter essa tela: basta **respeitar** os `modos` do `GET`.

## Como conferir no app (depois da correção)

Prevest INV-02 (Huawei SUN2000-100KTL M2): as entradas 2, 6, 8, 10, 14, 16 e 18 têm de aparecer como **"não conectada"** e o card tem de ficar **Normal** (sem falha do inversor). Antes eram 9 alertas falsos; no web hoje são 0.

Referência completa: [APP-ATUALIZACAO-STRINGS-INVERSOR-2026-10-19.md](APP-ATUALIZACAO-STRINGS-INVERSOR-2026-10-19.md).
