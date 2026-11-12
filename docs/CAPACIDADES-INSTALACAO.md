# Capacidades da instalação: mostrar só Geração | Carga | Rede onde existem

> Status: **proposta, não implementado** (12/11/2026). Vale para a web (AupusNexOn) e para o app mobile.
> Origem: CF Investments 01 só tem geração e a Visão Geral mostra Carga, Rede, Tensão/FP/Corrente e
> Grandezas elétricas, tudo com "--".

## 1. O problema

A CF tem uma TON1 lendo 4 inversores por RS485. O MED-01 está desenhado no unifilar, mas **nenhuma fonte
de dados** lê esse medidor. Mesmo assim, a Visão Geral mostra:

- KPIs de Tensão / FP / Corrente;
- o painel "Grandezas elétricas" (Van/Vbn/Vcn, IA/IB/IC, desequilíbrios);
- os medidores "Carga" e "Rede" no painel Demanda;
- o chip "Rede" e as abas Tensão/FP no gráfico.

O operador não sabe distinguir "não existe" de "existe e está sem leitura".

## 2. Como funciona hoje

| Onde | Regra atual | Por que falha |
|---|---|---|
| `components/visao-geral/VisaoGeralUsina.tsx` | `temTon = fonteDados === 'ton'` liga **o quadro inteiro**: `KpiRow`, `GrandezasEletricasPanel`, `DemandaFluxoPanel`, `CartaoEnergia` | Ter TON não quer dizer ter medidor. A CF tem TON só com inversores |
| `sinoptico/hooks/useDemandaFluxo.ts` | Grupos Geração / Consumo / Rede saem da **categoria** dos equipamentos da config (`resolverFluxoEquipamento`); se nada está selecionado, usa **todos** | O MED-01 desenhado entra como Consumo/Rede sem nunca ter leitura |
| `KpiRow`, `GrandezasEletricasPanel` | Sempre renderizam; campo vazio vira "--" | Não há "esconder" |
| App mobile | Lê a mesma API e repete a mesma lógica por conta própria | Cada tela decide diferente |

## 3. A regra (decidida)

1. **"Existe" = há uma fonte de dados configurada**, não "há um símbolo no unifilar".
2. **Existe mas sem leitura recente continua na tela**, com "sem comunicação · última leitura há X".
   Esconder um medidor offline esconderia o defeito.
3. **Sem Power Meter, a carga é desconhecida**, não zero.
4. **A regra é calculada uma vez no backend.** Web e app só leem o resultado.
5. **Quem fala de quê não muda**: segue a prática de hoje, que já exibe certo. Inversores → Geração,
   Power Meter → Carga, medidor da concessionária → Rede, pela categoria do equipamento (a mesma que
   `useDemandaFluxo` usa). A mudança é só **esconder o que não tem fonte de dados**.

| Capacidade | Existe quando |
|---|---|
| `geracao` | inversor(es) com ponto/tópico IoT **ou** fallback de nuvem configurado (Fusion, iSolar, Deye) |
| `medicao_entrada` | Power Meter ou medidor da concessionária (M160, PD666, A966/SSU…) ligado a uma TON/tópico |
| `carga` | Power Meter com fonte de dados |
| `rede` | medidor da concessionária com fonte de dados |
| `grandezas_eletricas` | medidor (PM ou concessionária) cujo catálogo tem tensões/correntes |
| `demanda_contratada` | unidade com `demanda_carga` ou `demanda_geracao` preenchida |

Não usar a tensão/corrente dos inversores para preencher Grandezas elétricas: não é o ponto de conexão
e seria lida como medição da rede.

## 4. Contrato da API

`GET /api/v1/unidades/:id/capacidades`. Também pode ser um campo `capacidades` num endpoint que a
Visão Geral já chama; o importante é ser **uma** fonte.

```jsonc
{
  "geracao":             { "existe": true,  "fonte": "ton",  "comunicando": true,  "ultima_leitura": "2026-11-12T14:02:10Z" },
  "medicao_entrada":     { "existe": false, "fonte": null,   "comunicando": null,  "ultima_leitura": null },
  "carga":               { "existe": false, "fonte": null,   "comunicando": null,  "ultima_leitura": null },
  "rede":                { "existe": false, "fonte": null,   "comunicando": null,  "ultima_leitura": null },
  "grandezas_eletricas": { "existe": false, "fonte": null,   "comunicando": null,  "ultima_leitura": null },
  "demanda_contratada":  { "existe": true,  "fonte": "manual", "comunicando": null, "ultima_leitura": null }
}
```

- `fonte`: `'ton' | 'nuvem' | 'manual' | null`.
- `comunicando`: `false` = existe e está sem leitura recente (a tela mostra o estado, não esconde).
  Para a janela de "recente", usar a mesma do status do COA.
- **Escopo por dono obrigatório**: `PermissionScopeService.getScope` / `assertEntityInScope`, como todo
  endpoint por unidade. Proprietário/operador só consulta as próprias unidades.

Exemplos:

| Instalação | geracao | medicao_entrada / carga / rede | grandezas |
|---|---|---|---|
| CF (TON só com inversores) | existe, ton | não existem | não existe |
| Instalação completa, medidor offline | existe | existem, `comunicando:false` | existe, `comunicando:false` |
| Só nuvem (sem TON) | existe, nuvem | não existem | não existe |

## 5. Web: o que muda na tela

Arquivos: `src/features/supervisorio/components/visao-geral/VisaoGeralUsina.tsx`,
`sinoptico/components/{KpiRow,GrandezasEletricasPanel,DemandaFluxoPanel,GraficoConfiguravelPanel}.tsx`,
`components/sinoptico-graficos-v2/GraficoDemanda.tsx`, `sinoptico/hooks/useDemandaFluxo.ts`.

1. **`VisaoGeralUsina`**: trocar o `temTon` único por capacidades, bloco a bloco.
2. **Faixa de KPIs (Pot. | Tensão | FP | Corr.)**: some inteira sem `medicao_entrada`.
3. **Grandezas elétricas**: somem sem `grandezas_eletricas`.
4. **Painel Demanda**: só os medidores que existem (CF → só "Geração"). O layout se ajusta a 1, 2 ou 3
   medidores, sem buraco.
5. **Gráfico**: só as séries e abas que existem. Sem medidor: sem chip "Rede" e sem abas Tensão/FP.
6. **Existe mas não comunica**: o card aparece com "sem comunicação · última leitura há X", não com "--".
7. **Carregando**: skeleton. Nada de mostrar cards que somem um segundo depois.
8. **Não mexer no unifilar**: o desenho continua mostrando o MED-01.

## 6. App mobile

Aplicar as mesmas regras da seção 5, lendo o mesmo endpoint. Nada de recalcular "tem medidor" no app.

## 7. Testes da regra (backend)

- CF: só `geracao` existe.
- Medidor configurado e offline: `carga`/`rede`/`grandezas` existem com `comunicando:false`.
- Só nuvem: `geracao` com `fonte:'nuvem'`, o resto não existe.
- Medidor desenhado no unifilar sem vínculo IoT: **não** existe.
- Usuário de outro dono: 403/404 (isolamento por dono).

## 8. Decisões (12/11/2026)

1. **Grandezas sem medidor: some.** Não usar tensão/corrente de inversor.
2. **Faixa de KPIs (Pot. | Tensão | FP | Corr.) sem medidor: some inteira.** Os 4 cards vêm dos medidores
   (`KpiRow.tsx`, "Potência líquida = soma dos medidores"); a potência de geração já está nos KPIs de resumo.
3. **Quem fala de quê:**
   - **Inversores → Geração.**
   - **Power Meter → Carga.**
   - **Medidor da concessionária → Rede.**

   Mantém a prática atual (categoria do equipamento), que já exibia certo. Nada de campo novo no cadastro.
