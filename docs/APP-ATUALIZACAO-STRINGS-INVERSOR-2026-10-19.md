# Strings do inversor: entradas não conectadas e alerta por perfil (19/10/2026)

Mudança feita no NexON web que o app precisa acompanhar.

## O problema

A ficha do inversor marcava string em alerta ou falha quando a corrente dela ficava muito abaixo da **mediana das strings no mesmo instante**. Isso gerava alerta falso em dois casos:

1. **Entrada sem string pelo projeto.** Exemplo: o Huawei SUN2000-100KTL tem 20 entradas, mas no Prevest INV-02 só 13 são usadas. As entradas 2, 6, 8, 10, 14, 16 e 18 ficam sempre em 0 A e apareciam como "falha".
2. **String que naturalmente gera menos que as outras**, por ter orientação ou comprimento diferente. Exemplo: uma string que sempre gera cerca de 55% da mediana caía em "abaixo do esperado" o dia todo.

## O que mudou

- A entrada que **nunca tem corrente** no histórico passa a ser **"não conectada"**. Ela aparece em cinza, com o texto "não conectada", e fica **fora dos alertas**.
- As demais strings são comparadas com o **esperado dela**, e não mais com a mediana crua:
  `esperado = razão típica da string (histórico) × mediana das strings ativas agora`
- O usuário pode **forçar manualmente** se cada entrada é "usada", "não usada" ou "automático". Essa escolha sobrepõe a detecção.

## API

Base: `/api/v1`. Autenticação Bearer, a mesma do app. O endpoint respeita o escopo do usuário: o proprietário só acessa os próprios equipamentos.

### `GET /equipamentos/:id/strings`

Perfil aprendido dos **últimos 14 dias**, usando só as leituras com o inversor gerando. O servidor mantém o resultado em cache por 30 minutos. Exemplo de resposta (valores ilustrativos):

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
| `strings[].n` | Número da entrada (corresponde a `dc.string<n>_current` do dado em tempo real) |
| `strings[].presenca` | Fração das leituras (0 a 1) em que a entrada teve mais de 0,5 A |
| `strings[].razao` | Mediana de `corrente da string ÷ mediana das strings ativas`. Vale `null` quando não há amostras |
| `strings[].amostras` | Quantidade de leituras usadas para essa entrada |
| `leituras` | Total de leituras válidas (com sol: mediana das strings ≥ 2 A) |
| `modos` | Ajuste manual: `"usada"` ou `"nao_usada"`. Entrada ausente aqui = automático |

> A resposta pode chegar dentro do envelope padrão da API (`{ data: { data: … } }`). O web lê `r.data.data.data ?? r.data.data ?? r.data`.

### `PUT /equipamentos/:id/strings`

Exige a permissão `equipamentos.manage` (no app, só faz sentido para perfis de administração).

```json
{ "modos": { "2": "nao_usada", "6": "nao_usada", "12": "usada" } }
```

- Envie o **mapa completo** de ajustes. Ele substitui o mapa anterior.
- Para voltar uma entrada ao automático, **remova a chave** do mapa.
- Entradas válidas: de 1 a 48.
- A resposta é igual à do `GET`, já atualizada.

## Regra de exibição (replicar no app)

Copie esta lógica exatamente como está no web ([InversorSheet.tsx](../src/features/supervisorio/v2/components/sheets/InversorSheet.tsx)).

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

// 4) Classificação (só avaliar com o inversor online E gerando)
function estado(n, a): 'nao_conectada' | 'falha' | 'alerta' | 'ok' {
  if (naoConectada(perfil, n)) return 'nao_conectada';
  const e = esperado(n);
  if (e > 2 && a < 0.2) return 'falha';        // vermelho
  if (e > 1 && a < 0.7 * e) return 'alerta';   // amarelo
  return 'ok';
}
```

Status do card do inversor:

- Há falha ativa do inversor (`status.fault_1..5` diferente de 0) → **Falha**.
- Senão, há string em `falha` ou `alerta` → **Alerta**: "String N abaixo do esperado" ou "N strings abaixo do esperado".
- Senão → **Normal**.
- Entradas `nao_conectada` **nunca** entram nessa contagem.

Na lista de strings:

- Entrada não conectada: valor e texto "não conectada" em cinza.
- Resumo do topo: "N em alerta". Se quiser, o app pode mostrar também "N não conectadas".

Se o `GET` falhar ou o perfil ainda não existir (equipamento novo, com menos de 100 leituras), o comportamento é o antigo: comparação com a mediana e nenhuma entrada marcada como não conectada.

## Configuração manual (opcional no app)

No web isso fica na aba **Configuração** da ficha do inversor: uma lista de entradas, cada uma com "Automático", "Usada" ou "Não usada", e um botão Salvar que faz o `PUT`.

Se o app não tiver tela de configuração, basta **respeitar** os `modos` vindos do `GET`. O ajuste pode continuar sendo feito pelo web.

## Caso real que motivou a mudança: Prevest INV-02 (Huawei SUN2000-100KTL M2)

- Entradas 2, 6, 8, 10, 14, 16 e 18: **0 A em 13 dias de histórico** (cerca de 16 mil leituras, máximo de 0,06 A).
- As entradas vizinhas 1, 5, 7 e 9 marcam cerca de 24 A, contra cerca de 14 A de uma string sozinha. Isso indica duas strings ligadas numa entrada só, ou projeto sem a segunda entrada.
- Antes: 9 alertas falsos. Depois: 7 entradas "não conectada" e 0 alertas.

---

## Outra correção (sem mudança no app)

**Visão Geral, cartões dos elementos SCS** (`GET /iot/unidade/:id/elementos-scs`): o cartão de um DJ aparecia como "Sem comunicação" porque a data da última leitura era buscada no próprio DJ, que não publica nada. Agora o backend usa a leitura de quem mede aquele elemento:

- **Power Meter** associado ao DJ;
- **medidor SSU** (A966 ou TON V2) associado ao Medidor Concessionária;
- **relé (IED)**, quando é ele que mede o DJ.

O formato da resposta não mudou. Se o app consome esse endpoint, a correção já vale para ele.
