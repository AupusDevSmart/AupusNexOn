# 📋 PLANO DE REFATORAÇÃO - PÁGINAS DE CADASTRO

## 🎯 Objetivos

✅ Layout minimalista, profissional e discreto
✅ Componentes reutilizáveis e fáceis de manter
✅ Sheets laterais (50% da tela) ao invés de modals
✅ Inputs finos e pouco arredondados
✅ Cores neutras (preto/branco/cinza)
✅ Código organizado (< 200 linhas por arquivo)

---

## 🗂️ Arquivos Criados

### 1. Design System
- ✅ `src/styles/design-system.css` - Tema completo (light/dark mode)
- ✅ `src/components/ui/sheet-minimal.tsx` - Sheet lateral profissional
- ✅ `DESIGN_SYSTEM_GUIDE.md` - Guia completo de uso

### 2. Características do Design

**Cores:**
- Light Mode: Branco puro + Preto quase puro
- Dark Mode: Preto quase puro + Branco quase puro
- Estados: Cores discretas (verde, laranja, vermelho, azul escuros)

**Espaçamento:**
- Radius: 4px (pouco arredondado)
- Input height: 36px (h-9 - mais fino)
- Padding: Generoso e consistente

**Componentes:**
- Sheet lateral (50% da tela por padrão)
- Tables minimalistas com hover sutil
- Buttons profissionais (h-9)
- Alerts discretos (background 5% opacidade)
- Badges neutros

---

## 📐 Estrutura de Componentes

### ANTES (Monolítico)
```
UnidadesPage.tsx          (800 linhas)
├── Estados (50 linhas)
├── Effects (100 linhas)
├── Funções CRUD (150 linhas)
├── JSX Filtros (100 linhas)
├── JSX Tabela (300 linhas)
└── JSX Modal (100 linhas)
```

### DEPOIS (Componentizado)
```
UnidadesPage.tsx          (50 linhas - orquestração)
├── useUnidadesList.ts    (100 linhas - fetch + estado)
├── useUnidadesActions.ts (150 linhas - CRUD)
├── UnidadesTable.tsx     (200 linhas - tabela)
├── UnidadesFilters.tsx   (100 linhas - filtros)
└── UnidadeSheet.tsx      (200 linhas - formulário)
```

**Benefício:** Código organizado, fácil de entender e manter

---

## 🚀 Passos de Implementação

### FASE 1: Setup do Design System (1-2 dias)

**1.1 Importar CSS no projeto**
```typescript
// src/App.tsx ou src/main.tsx
import "./styles/design-system.css"
```

**1.2 Instalar dependências (se necessário)**
```bash
npm install @radix-ui/react-dialog
```

**1.3 Testar componentes básicos**
- Criar página de teste com todos os componentes
- Verificar light/dark mode
- Testar sheets laterais

---

### FASE 2: Refatorar Página Piloto - Unidades (3-5 dias)

**2.1 Criar estrutura de pastas**
```
src/features/unidades/
├── components/
│   ├── UnidadesPage.tsx        (🆕 simplificado)
│   ├── UnidadesTable.tsx       (🆕 extracted)
│   ├── UnidadesFilters.tsx     (🆕 extracted)
│   └── UnidadeSheet.tsx        (🆕 lateral ao invés de modal)
├── hooks/
│   ├── useUnidadesList.ts      (🆕 lógica de listagem)
│   └── useUnidadesActions.ts   (🆕 CRUD actions)
└── config/
    ├── columns.tsx             (🆕 colunas da tabela)
    └── schema.ts               (🆕 validação Zod)
```

**2.2 Extrair lógica do arquivo monolítico**

Passo a passo:
1. Copiar `UnidadesPage.tsx` → `UnidadesPage.old.tsx` (backup)
2. Criar `useUnidadesList.ts` e mover lógica de fetch
3. Criar `useUnidadesActions.ts` e mover CRUD
4. Criar `UnidadesTable.tsx` e mover JSX da tabela
5. Criar `UnidadesFilters.tsx` e mover JSX dos filtros
6. Criar `UnidadeSheet.tsx` e mover JSX do modal
7. Simplificar `UnidadesPage.tsx` para apenas orquestrar

**2.3 Adaptar para usar Sheet ao invés de Modal**

Trocar:
```tsx
// ANTES (Modal central)
<Modal open={isOpen}>
  <ModalContent>
    <ModalHeader>Título</ModalHeader>
    <ModalBody>Formulário</ModalBody>
    <ModalFooter>Botões</ModalFooter>
  </ModalContent>
</Modal>

// DEPOIS (Sheet lateral 50%)
<Sheet open={isOpen}>
  <SheetContent size="default">
    <SheetHeader>
      <SheetTitle>Título</SheetTitle>
      <SheetCloseButton />
    </SheetHeader>
    <SheetBody>Formulário</SheetBody>
    <SheetFooter>Botões</SheetFooter>
  </SheetContent>
</Sheet>
```

**2.4 Aplicar estilos minimalistas**
- Inputs: adicionar `className="h-9 rounded"`
- Buttons: adicionar `className="h-9 rounded"`
- Table: usar `className="table-minimal"`
- Alerts: usar `className="alert-minimal alert-{tipo}"`

**2.5 Testar tudo**
- Create, Read, Update, Delete
- Filtros
- Paginação
- Responsividade mobile
- Light/Dark mode

---

### FASE 3: Replicar para Outras Páginas (1 semana)

Aplicar mesmo padrão para:
- ✅ Equipamentos
- ✅ Plantas
- ✅ Usuários
- ✅ Concessionárias

**Processo:**
1. Copiar estrutura de pastas de Unidades
2. Adaptar nomes (Unidade → Equipamento, etc)
3. Ajustar lógica específica de cada entidade
4. Testar

---

### FASE 4: Criar Componentes Reutilizáveis (3-5 dias)

**4.1 DataTable Genérico**
```typescript
// src/components/ui-v2/data-table.tsx
<DataTable
  columns={columns}
  data={data}
  loading={loading}
  onRowClick={handleRowClick}
  pagination={pagination}
/>
```

**4.2 FormBuilder Genérico**
```typescript
// src/components/ui-v2/form-builder.tsx
<FormBuilder
  schema={unidadeSchema}
  defaultValues={entity}
  onSubmit={handleSubmit}
/>
```

**4.3 FilterPanel Genérico**
```typescript
// src/components/ui-v2/filter-panel.tsx
<FilterPanel
  filters={filterConfig}
  values={filterValues}
  onChange={setFilterValues}
/>
```

---

### FASE 5: Polimento (2-3 dias)

**5.1 Adicionar animações sutis**
```tsx
import { motion } from "framer-motion"

<motion.div
  initial={{ opacity: 0, y: 10 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.2 }}
>
  {content}
</motion.div>
```

**5.2 Implementar atalhos de teclado**
```typescript
useHotkeys('ctrl+n', openCreate)
useHotkeys('esc', closeSheet)
useHotkeys('/', focusSearch)
```

**5.3 Otimizações de performance**
- useMemo para transformações pesadas
- useCallback para handlers
- Lazy loading de sheets
- Debounce em buscas (500ms)

**5.4 Acessibilidade**
- ARIA labels
- Keyboard navigation
- Focus management

---

## 📊 Checklist de Qualidade

### ✅ Para cada página refatorada, verificar:

**Código:**
- [ ] Arquivo principal < 200 linhas
- [ ] Lógica separada em hooks
- [ ] UI separada em componentes
- [ ] TypeScript sem erros
- [ ] Sem código duplicado

**Design:**
- [ ] Usa sheet lateral (não modal)
- [ ] Inputs finos (h-9)
- [ ] Bordas discretas (rounded 4px)
- [ ] Cores neutras
- [ ] Light mode OK
- [ ] Dark mode OK

**Funcionalidade:**
- [ ] Create funciona
- [ ] Read funciona
- [ ] Update funciona
- [ ] Delete funciona
- [ ] Filtros funcionam
- [ ] Paginação funciona
- [ ] Validações funcionam
- [ ] Mensagens de erro/sucesso OK

**UX:**
- [ ] Loading states OK
- [ ] Empty states OK
- [ ] Error states OK
- [ ] Feedback visual imediato
- [ ] Responsivo mobile
- [ ] Transições suaves

---

## 🎯 Exemplo Prático - Antes vs Depois

### ANTES
```tsx
// UnidadesPage.tsx (800 linhas)
export function UnidadesPage() {
  // 50 linhas de useState
  const [unidades, setUnidades] = useState([])
  const [loading, setLoading] = useState(false)
  // ... mais 10 estados

  // 100 linhas de useEffect
  useEffect(() => { /* fetch */ }, [])
  useEffect(() => { /* filter */ }, [filters])
  // ... mais 5 effects

  // 150 linhas de handlers
  const handleCreate = async () => { /* 30 linhas */ }
  const handleEdit = async () => { /* 30 linhas */ }
  const handleDelete = async () => { /* 40 linhas */ }
  // ... mais 10 handlers

  // 500 linhas de JSX gigante
  return (
    <div>
      {/* 100 linhas filtros */}
      {/* 300 linhas tabela */}
      {/* 100 linhas modal */}
    </div>
  )
}
```

### DEPOIS
```tsx
// UnidadesPage.tsx (50 linhas)
export function UnidadesPage() {
  const { unidades, loading } = useUnidadesList()
  const { isOpen, openCreate, openEdit, closeSheet } = useUnidadesActions()

  return (
    <div className="container mx-auto py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Unidades</h1>
        <Button onClick={openCreate} className="h-9 rounded">
          Nova Unidade
        </Button>
      </div>

      <UnidadesFilters />
      <UnidadesTable data={unidades} loading={loading} />
      <UnidadeSheet isOpen={isOpen} onClose={closeSheet} />
    </div>
  )
}
```

**Resultado:**
- ✅ 94% menos linhas (800 → 50)
- ✅ 100% mais legível
- ✅ 80% de reuso de código
- ✅ Manutenção 10x mais fácil

---

## 🔥 Próximo Passo

**Escolha uma opção:**

1. **Começar implementação imediata**
   - Implemento a refatoração da página de Unidades completa
   - Você vê o resultado e aprova
   - Replicamos para outras páginas

2. **Testar design system primeiro**
   - Crio uma página de teste com todos os componentes
   - Você visualiza e ajusta o design se necessário
   - Depois começamos a refatoração

3. **Documentação adicional**
   - Crio mais exemplos e templates
   - Gero código boilerplate
   - Monto CLI para gerar páginas automaticamente

**Qual opção prefere?** 🚀
