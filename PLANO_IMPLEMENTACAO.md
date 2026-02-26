# Plano de Implementação - Design System Minimalista

## ✅ Status Atual

### O que já está pronto:
1. ✅ **Design System CSS** - [design-minimal-components.css](src/styles/design-minimal-components.css)
2. ✅ **Componentes criados**:
   - [combobox-minimal.tsx](src/components/ui/combobox-minimal.tsx) - Select pesquisável
   - [sheet-minimal.tsx](src/components/ui/sheet-minimal.tsx) - Sheet lateral (50% tela)
3. ✅ **Página de teste** - [DesignSystemTest.tsx](src/pages/DesignSystemTest.tsx)
4. ✅ **Documentação**:
   - [DESIGN_APPROACH.md](DESIGN_APPROACH.md) - Por que classes utilitárias
   - [DESIGN_SYSTEM_TEST_README.md](DESIGN_SYSTEM_TEST_README.md) - Como testar

### Classes disponíveis:
- `.input-minimal`, `.select-minimal`, `.textarea-minimal`
- `.btn-minimal-primary`, `.btn-minimal-outline`, `.btn-minimal-ghost`
- `.card-minimal`, `.table-minimal`, `.form-minimal`
- `.alert-info`, `.alert-success`, `.alert-warning`, `.alert-destructive`
- `.page-minimal`, `.page-header-minimal`, `.page-content-minimal`
- `.grid-minimal-2`, `.grid-minimal-3`, `.grid-minimal-4`

---

## 📋 Plano de Implementação

### Fase 1: Identificar Páginas CRUD 🔍

**Objetivo:** Mapear todas as páginas que precisam de refatoração

**Ações:**
1. Listar todas as páginas de cadastro/CRUD
2. Priorizar por complexidade (começar pelas mais simples)
3. Identificar componentes comuns que podem ser reutilizados

**Páginas candidatas:**
```
src/pages/
├── cadastros/
│   ├── unidades/          # ✅ PILOTO (começar aqui)
│   ├── equipamentos/      # 2ª prioridade
│   ├── plantas/           # 3ª prioridade
│   ├── usuarios/          # 4ª prioridade
│   └── concessionarias/   # 5ª prioridade
```

**Por que começar com Unidades:**
- ✓ CRUD simples (Create, Read, Update, Delete)
- ✓ Poucos campos
- ✓ Sem relacionamentos muito complexos
- ✓ Pode servir de template para outras páginas

---

### Fase 2: Refatorar Página Piloto (Unidades) 🎯

**Objetivo:** Criar template de referência para outras páginas

#### 2.1. Análise da Página Atual

**Ações:**
1. Ler arquivo atual de Unidades
2. Identificar:
   - Quantos campos tem o formulário
   - Quais são os filtros
   - Como é a tabela
   - Quais ações existem (novo, editar, deletar)
   - Se usa modal ou outro tipo de overlay

#### 2.2. Estrutura de Arquivos Nova

**Antes (monolítico):**
```
pages/cadastros/unidades/
└── index.tsx  (800+ linhas)
```

**Depois (componentizado):**
```
pages/cadastros/unidades/
├── index.tsx                    # 50 linhas - apenas orquestração
├── components/
│   ├── UnidadesTable.tsx        # Tabela de dados
│   ├── UnidadesFilters.tsx      # Filtros de busca
│   ├── UnidadeSheet.tsx         # Sheet lateral (form)
│   └── UnidadeActions.tsx       # Botões de ação
├── hooks/
│   ├── useUnidadesList.tsx      # Lógica de listagem
│   ├── useUnidadeForm.tsx       # Lógica do formulário
│   └── useUnidadeActions.tsx    # Lógica de ações (delete, etc)
└── types.ts                     # TypeScript types
```

#### 2.3. Implementação Passo a Passo

**Passo 1: Criar estrutura de pastas**
```bash
mkdir -p src/pages/cadastros/unidades/components
mkdir -p src/pages/cadastros/unidades/hooks
```

**Passo 2: Extrair lógica para hooks**

Criar `useUnidadesList.tsx`:
```tsx
export function useUnidadesList() {
  const [unidades, setUnidades] = useState([])
  const [loading, setLoading] = useState(false)
  const [filters, setFilters] = useState({})

  const fetchUnidades = async () => {
    // Lógica existente de busca
  }

  return {
    unidades,
    loading,
    filters,
    setFilters,
    fetchUnidades,
    refetch: fetchUnidades
  }
}
```

**Passo 3: Criar componentes UI**

Criar `UnidadesTable.tsx`:
```tsx
interface Props {
  data: Unidade[]
  loading: boolean
  onEdit: (id: string) => void
  onDelete: (id: string) => void
}

export function UnidadesTable({ data, loading, onEdit, onDelete }: Props) {
  if (loading) return <div>Carregando...</div>

  return (
    <div className="card-minimal">
      <table className="table-minimal">
        <thead>
          <tr>
            <th>Nome</th>
            <th>Planta</th>
            <th>Status</th>
            <th className="text-right">Ações</th>
          </tr>
        </thead>
        <tbody>
          {data.map(unidade => (
            <tr key={unidade.id}>
              <td>{unidade.nome}</td>
              <td>{unidade.planta?.nome}</td>
              <td>
                <span className="badge-minimal text-success">
                  {unidade.status}
                </span>
              </td>
              <td className="text-right">
                <button
                  className="btn-minimal-ghost"
                  onClick={() => onEdit(unidade.id)}
                >
                  Editar
                </button>
                <button
                  className="btn-minimal-ghost"
                  onClick={() => onDelete(unidade.id)}
                >
                  Deletar
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

Criar `UnidadeSheet.tsx`:
```tsx
interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  unidadeId?: string
  onSave: () => void
}

export function UnidadeSheet({ open, onOpenChange, unidadeId, onSave }: Props) {
  const { form, loading, handleSubmit } = useUnidadeForm(unidadeId)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent size="default">
        <SheetHeader>
          <SheetTitle>
            {unidadeId ? 'Editar Unidade' : 'Nova Unidade'}
          </SheetTitle>
          <SheetCloseButton />
        </SheetHeader>

        <SheetBody>
          <form className="form-minimal" onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Nome</label>
              <input className="input-minimal" {...form.register('nome')} />
            </div>

            <div className="grid-minimal-2">
              <div className="form-group">
                <label>Planta</label>
                <Combobox options={plantas} {...form.register('planta_id')} />
              </div>
              <div className="form-group">
                <label>Tipo</label>
                <Combobox options={tipos} {...form.register('tipo')} />
              </div>
            </div>

            {/* Mais campos... */}
          </form>
        </SheetBody>

        <SheetFooter>
          <button
            type="button"
            className="btn-minimal-outline"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="btn-minimal-primary"
            disabled={loading}
          >
            {loading ? 'Salvando...' : 'Salvar'}
          </button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
```

**Passo 4: Página principal orquestradora**

Criar `index.tsx` limpo:
```tsx
export function UnidadesPage() {
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string>()

  const {
    unidades,
    loading,
    filters,
    setFilters,
    refetch
  } = useUnidadesList()

  const { deleteUnidade } = useUnidadeActions()

  const handleEdit = (id: string) => {
    setSelectedId(id)
    setIsSheetOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (confirm('Confirma exclusão?')) {
      await deleteUnidade(id)
      refetch()
    }
  }

  const handleSave = () => {
    setIsSheetOpen(false)
    setSelectedId(undefined)
    refetch()
  }

  return (
    <div className="page-minimal">
      <header className="page-header-minimal">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold">Unidades</h1>
            <button
              className="btn-minimal-primary"
              onClick={() => setIsSheetOpen(true)}
            >
              Nova Unidade
            </button>
          </div>
        </div>
      </header>

      <main className="page-content-minimal">
        <section className="section-minimal">
          <UnidadesFilters
            filters={filters}
            onChange={setFilters}
          />
        </section>

        <section className="section-minimal">
          <UnidadesTable
            data={unidades}
            loading={loading}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        </section>
      </main>

      <UnidadeSheet
        open={isSheetOpen}
        onOpenChange={setIsSheetOpen}
        unidadeId={selectedId}
        onSave={handleSave}
      />
    </div>
  )
}
```

#### 2.4. Checklist de Qualidade

- [ ] Código componentizado (< 100 linhas por arquivo)
- [ ] Lógica separada em hooks
- [ ] UI usando classes minimalistas
- [ ] Sheet lateral ao invés de modal
- [ ] Combobox ao invés de select simples
- [ ] Table sem bordas, fundo preto (dark mode)
- [ ] Responsivo (mobile, tablet, desktop)
- [ ] TypeScript sem erros
- [ ] Dark mode funcionando
- [ ] Testes manuais (create, read, update, delete)

---

### Fase 3: Replicar para Outras Páginas 🔄

**Objetivo:** Aplicar o padrão da página piloto em outras páginas

**Ações:**
1. Copiar estrutura de Unidades
2. Adaptar para cada contexto (campos diferentes)
3. Reutilizar componentes comuns
4. Manter mesma organização de pastas

**Ordem sugerida:**
1. ✅ Unidades (piloto)
2. Equipamentos
3. Plantas
4. Usuários
5. Concessionárias

**Por página, fazer:**
- Criar estrutura de pastas
- Extrair hooks
- Criar componentes
- Aplicar classes minimalistas
- Testar CRUD completo

---

### Fase 4: Componentes Comuns (Opcional) 🧩

**Objetivo:** Criar componentes reutilizáveis entre páginas

**Candidatos:**
```tsx
components/common/
├── DataTable.tsx          # Tabela genérica
├── FilterPanel.tsx        # Painel de filtros genérico
├── ConfirmDialog.tsx      # Dialog de confirmação
├── EmptyState.tsx         # Estado vazio
└── LoadingState.tsx       # Estado carregando
```

**Exemplo de DataTable genérica:**
```tsx
interface Column<T> {
  key: keyof T
  header: string
  render?: (value: any, row: T) => React.ReactNode
}

interface Props<T> {
  data: T[]
  columns: Column<T>[]
  loading?: boolean
  onEdit?: (row: T) => void
  onDelete?: (row: T) => void
}

export function DataTable<T extends { id: string }>({
  data,
  columns,
  loading,
  onEdit,
  onDelete
}: Props<T>) {
  // Implementação genérica
}
```

---

## 🎯 Começando Agora

### Opção 1: Refatorar Unidades (recomendado)
```bash
# Etapas:
1. Ler página atual de Unidades
2. Criar estrutura de pastas
3. Extrair lógica para hooks
4. Criar componentes UI
5. Montar página orquestradora
6. Testar CRUD completo
```

### Opção 2: Criar página nova do zero
```bash
# Se preferir começar com página nova:
1. Escolher uma página simples
2. Criar já com estrutura componentizada
3. Usar como referência para refatorar as outras
```

### Opção 3: Melhorar página de teste
```bash
# Se quiser mais exemplos antes:
1. Adicionar mais cenários na página de teste
2. Testar validações de formulário
3. Testar estados de loading/erro
4. Criar mais variações de layout
```

---

## 📝 Próximos Passos Imediatos

**Passo 1:** Você escolhe:
- A) Refatorar página de Unidades (começar implementação real)
- B) Criar componentes comuns primeiro (DataTable genérica)
- C) Expandir página de teste com mais exemplos

**Passo 2:** Após escolher, eu:
- Leio o código atual da página escolhida
- Crio a estrutura de pastas
- Extraio os hooks necessários
- Implemento os componentes UI
- Monto a página orquestradora

**Passo 3:** Você testa e valida:
- CRUD funcionando
- Design minimalista aplicado
- Responsividade OK
- Dark mode OK

**Passo 4:** Replicamos para outras páginas seguindo o mesmo padrão!

---

## 🚀 Recomendação

**Começar com Unidades** porque:
1. ✓ É uma página real do sistema
2. ✓ Relativamente simples
3. ✓ Vai servir de template para as outras
4. ✓ Você vê resultado prático imediato
5. ✓ Menos risco que refatorar algo complexo

**O que você prefere?** 🎯
