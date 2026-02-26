# Plano de Refatoração - Unidades (Design Minimalista)

## 📁 Estrutura Atual Identificada

```
src/features/unidades/
├── index.ts                                    # Exports
├── components/
│   ├── UnidadesPage.tsx                       # ✅ JÁ componentizado (328 linhas)
│   ├── unidade-modal.tsx                      # Modal atual (trocar por Sheet)
│   └── ConcessionariaSelectField.tsx          # Campo específico
├── hooks/
│   ├── useUnidades.ts                         # Hook de lógica
│   └── usePlantas.ts                          # Hook de plantas
├── config/
│   ├── table-config.tsx                       # Configuração de tabela
│   ├── filter-config.tsx                      # Configuração de filtros
│   └── form-config.tsx                        # Configuração de formulário
└── types/
    └── index.ts                               # TypeScript types
```

## ✅ O que JÁ está bem feito:

1. ✅ **Estrutura componentizada** - Usa features pattern
2. ✅ **Hooks separados** - Lógica isolada
3. ✅ **Configs separados** - table, filter, form
4. ✅ **Types definidos** - TypeScript
5. ✅ **BaseTable e BaseFilters** - Componentes reutilizáveis

## 🎯 O que precisa mudar:

### 1. **Modal → Sheet Lateral** ❌ → ✅
**Atual:** `unidade-modal.tsx`
**Novo:** Substituir por Sheet lateral (50% tela)

### 2. **Aplicar Classes Minimalistas** ❌ → ✅
**Atual:** Classes genéricas
**Novo:** Classes `.page-minimal`, `.table-minimal`, etc.

### 3. **Combobox ao invés de Select** ❌ → ✅
**Atual:** Selects simples
**Novo:** `<Combobox />` pesquisável

### 4. **Estilo de Tabela** ❌ → ✅
**Atual:** Table com bordas
**Novo:** `.table-minimal` (fundo preto, sem bordas)

---

## 📋 Plano de Ação

### Fase 1: Substituir Modal por Sheet 🔄

**Arquivo:** `src/features/unidades/components/unidade-sheet.tsx` (NOVO)

**O que fazer:**
1. Criar novo arquivo `unidade-sheet.tsx`
2. Copiar lógica do `unidade-modal.tsx`
3. Substituir Dialog por Sheet:
   ```tsx
   // ANTES
   <Dialog open={isOpen}>
     <DialogContent>...</DialogContent>
   </Dialog>

   // DEPOIS
   <Sheet open={isOpen}>
     <SheetContent size="default">  {/* 50% da tela */}
       <SheetHeader>...</SheetHeader>
       <SheetBody>...</SheetBody>
       <SheetFooter>...</SheetFooter>
     </SheetContent>
   </Sheet>
   ```

### Fase 2: Aplicar Classes Minimalistas 🎨

**Arquivo:** `src/features/unidades/components/UnidadesPage.tsx`

**Mudanças:**

#### 2.1. Substituir Layout por page-minimal
```tsx
// ANTES
<Layout>
  <Layout.Main>
    <div className="flex flex-col h-full w-full">

// DEPOIS
<div className="page-minimal">
  <header className="page-header-minimal">
    <div className="container mx-auto px-6 py-4">
```

#### 2.2. Substituir BaseTable por table-minimal
```tsx
// ANTES
<BaseTable
  columns={columns}
  data={data}
/>

// DEPOIS
<div className="card-minimal">
  <table className="table-minimal">
    <thead>...</thead>
    <tbody>...</tbody>
  </table>
</div>
```

#### 2.3. Substituir Buttons
```tsx
// ANTES
<Button variant="outline">Atualizar</Button>
<Button>Nova Instalação</Button>

// DEPOIS
<button className="btn-minimal-outline">Atualizar</button>
<button className="btn-minimal-primary">Nova Instalação</button>
```

### Fase 3: Usar Combobox Pesquisável 🔍

**Arquivo:** `src/features/unidades/config/filter-config.tsx`

**Mudanças:**
```tsx
// ANTES
{
  type: 'select',
  name: 'plantaId',
  label: 'Planta',
  options: plantas
}

// DEPOIS
import { Combobox } from '@/components/ui/combobox-minimal'

<Combobox
  options={plantas.map(p => ({ value: p.id, label: p.nome }))}
  value={filters.plantaId}
  onValueChange={(value) => handleFilterChange({ plantaId: value })}
  placeholder="Selecione uma planta"
  searchPlaceholder="Buscar planta..."
/>
```

### Fase 4: Atualizar Formulário no Sheet 📝

**Arquivo:** `src/features/unidades/components/unidade-sheet.tsx`

**Mudanças:**
```tsx
<SheetBody>
  <form className="form-minimal">
    {/* Campo simples */}
    <div className="form-group">
      <label>Nome da Instalação</label>
      <input className="input-minimal" {...register('nome')} />
    </div>

    {/* 2 campos lado a lado */}
    <div className="grid-minimal-2">
      <div className="form-group">
        <label>Planta</label>
        <Combobox options={plantas} />
      </div>
      <div className="form-group">
        <label>Tipo</label>
        <Combobox options={tipos} />
      </div>
    </div>

    {/* 3 campos lado a lado */}
    <div className="grid-minimal-3">
      <div className="form-group">
        <label>Potência (kW)</label>
        <input className="input-minimal" type="number" />
      </div>
      <div className="form-group">
        <label>Tensão (V)</label>
        <input className="input-minimal" type="number" />
      </div>
      <div className="form-group">
        <label>Corrente (A)</label>
        <input className="input-minimal" type="number" />
      </div>
    </div>
  </form>
</SheetBody>

<SheetFooter>
  <button className="btn-minimal-outline" onClick={onClose}>
    Cancelar
  </button>
  <button className="btn-minimal-primary" type="submit">
    Salvar
  </button>
</SheetFooter>
```

---

## 🚀 Implementação Passo a Passo

### Passo 1: Criar novo arquivo unidade-sheet.tsx

```bash
# Criar arquivo
touch src/features/unidades/components/unidade-sheet.tsx
```

### Passo 2: Implementar Sheet

Copiar lógica do `unidade-modal.tsx` e adaptar para Sheet.

### Passo 3: Atualizar UnidadesPage.tsx

Substituir:
- `<UnidadeModal />` → `<UnidadeSheet />`
- Aplicar classes minimalistas
- Trocar selects por Combobox

### Passo 4: Atualizar table-config.tsx

Adaptar colunas para usar classes minimalistas.

### Passo 5: Testar

- [ ] CRUD completo funciona
- [ ] Sheet abre da direita (50% tela)
- [ ] Combobox com pesquisa funciona
- [ ] Tabela preta sem bordas (dark mode)
- [ ] Botões minimalistas
- [ ] Responsivo (mobile, tablet, desktop)
- [ ] Dark mode funciona

---

## 📝 Checklist de Qualidade

### Design Minimalista
- [ ] Usa `.page-minimal`, `.page-header-minimal`, `.page-content-minimal`
- [ ] Tabela usa `.table-minimal` (fundo preto, sem bordas)
- [ ] Inputs usam `.input-minimal` (h-9, rounded 4px)
- [ ] Buttons usam `.btn-minimal-*`
- [ ] Cards usam `.card-minimal`
- [ ] Forms usam `.form-minimal`

### Componentes
- [ ] Sheet lateral ao invés de modal
- [ ] Combobox ao invés de select simples
- [ ] Grids responsivos (`.grid-minimal-2/3/4`)

### Funcionalidade
- [ ] Create funciona
- [ ] Read funciona
- [ ] Update funciona
- [ ] Delete funciona
- [ ] Filtros funcionam
- [ ] Paginação funciona
- [ ] Busca funciona

### Responsividade
- [ ] Mobile (< 640px)
- [ ] Tablet (640px - 1024px)
- [ ] Desktop (> 1024px)

### Acessibilidade
- [ ] Labels corretos
- [ ] Focus visible
- [ ] Keyboard navigation

---

## 🎯 Ordem de Implementação Recomendada

### 1️⃣ Primeiro: Sheet (trocar modal)
**Por quê:** É a mudança mais visual e impactante

**Arquivos:**
- Criar: `unidade-sheet.tsx`
- Atualizar: `UnidadesPage.tsx` (linha 318)
- Atualizar: `index.ts` (export)

### 2️⃣ Segundo: Classes Minimalistas
**Por quê:** Aplicar o design em toda a página

**Arquivo:** `UnidadesPage.tsx`
- Substituir `<Layout>` por `<div className="page-minimal">`
- Substituir `<BaseTable>` por `<table className="table-minimal">`
- Substituir buttons por `.btn-minimal-*`

### 3️⃣ Terceiro: Combobox
**Por quê:** Melhorar UX dos selects

**Arquivos:**
- Atualizar: `filter-config.tsx`
- Atualizar: `unidade-sheet.tsx` (form fields)

### 4️⃣ Quarto: Grids no Formulário
**Por quê:** Otimizar espaço do Sheet

**Arquivo:** `unidade-sheet.tsx`
- Aplicar `.grid-minimal-2` para campos relacionados
- Aplicar `.grid-minimal-3` para valores numéricos

---

## 💡 Dicas

### Manter Lógica Existente
- ✅ **NÃO mude** hooks (useUnidades, usePlantas)
- ✅ **NÃO mude** services (API calls)
- ✅ **NÃO mude** types
- ✅ **APENAS mude** UI/componentes visuais

### Reutilizar Componentes Comuns
- Se `BaseTable` já funciona bem, adapte-o para usar `.table-minimal`
- Se `BaseFilters` já funciona, apenas troque selects por Combobox

### Testar Incrementalmente
1. Faça uma mudança
2. Teste no navegador
3. Confirme que funciona
4. Próxima mudança

---

## 🎨 Resultado Esperado

### Antes vs Depois

**ANTES:**
- Modal centralizado (popup)
- Selects simples (sem busca)
- Tabela com bordas
- Buttons coloridos
- Layout genérico

**DEPOIS:**
- Sheet lateral (50% da tela, direita → esquerda)
- Combobox pesquisável
- Tabela preta sem bordas (dark mode)
- Buttons minimalistas (cinza/preto)
- Layout profissional e discreto

---

## 🚦 Status Atual

### ✅ Pronto para começar:
- [x] Estrutura analisada
- [x] Design system criado
- [x] Classes disponíveis
- [x] Componentes (Sheet, Combobox) criados
- [x] Documentação completa

### ⏳ Próximo passo:
**Você decide:**

**A) Implementar tudo de uma vez** (1-2 horas)
- Eu crio todos os arquivos
- Aplico todas as mudanças
- Você testa o resultado final

**B) Implementar passo a passo** (validar cada etapa)
- Passo 1: Criar Sheet → você testa
- Passo 2: Aplicar classes → você testa
- Passo 3: Combobox → você testa
- Passo 4: Grids → você testa

**C) Fazer apenas uma parte** (ex: só o Sheet)
- Implemento apenas o Sheet
- Você valida
- Depois fazemos o resto

**Qual prefere?** 🎯
