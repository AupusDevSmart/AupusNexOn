# Abordagem de Design: Classes Utilitárias vs @layer base

## ❌ Problema com @layer base

Usar `@layer base` para customizar o design system é **problemático**:

```css
/* ❌ RUIM - Afeta TUDO no site */
@layer base {
  .dark {
    --background: hsl(220, 30%, 8%);  /* Muda TODAS as páginas */
    --card: hsl(220, 28%, 10%);       /* Quebra sidebar */
    --primary: hsl(0, 0%, 90%);       /* Muda botões existentes */
  }
}
```

**Por que é ruim:**
- ✗ Afeta **todas** as páginas (dashboard, supervisório, cadastros, etc)
- ✗ Quebra componentes existentes (sidebar, modais, tooltips)
- ✗ Conflita com bibliotecas de terceiros
- ✗ Difícil debugar problemas
- ✗ Impossível ter variações por página

## ✅ Solução: Classes Utilitárias

Criar **classes específicas** que você aplica **onde quiser**:

```css
/* ✅ BOM - Você controla onde aplicar */
.input-minimal {
  @apply h-9 rounded border border-input bg-background;
}

.btn-minimal-primary {
  @apply h-9 rounded bg-primary text-primary-foreground;
}

.card-minimal {
  @apply rounded border border-border bg-card;
}
```

**Por que é melhor:**
- ✓ Aplica **apenas** onde você quer
- ✓ Não quebra nada existente
- ✓ Fácil testar e iterar
- ✓ Pode ter estilos diferentes por página
- ✓ Componentes isolados e reutilizáveis

## Como Usar

### 1. Importar no main.tsx (já feito)

```tsx
import '@/assets/globals.css';
import '@/styles/design-minimal-components.css';
```

### 2. Aplicar classes nos componentes

#### ❌ ANTES (sem controle):
```tsx
// Usa estilos globais - afeta tudo
<input className="h-9 rounded" />
```

#### ✅ DEPOIS (com controle):
```tsx
// Usa classe específica - só afeta este input
<input className="input-minimal" />
```

### 3. Exemplos Práticos

#### Inputs:
```tsx
<input className="input-minimal" placeholder="Nome" />
<select className="select-minimal">...</select>
<textarea className="textarea-minimal">...</textarea>
```

#### Buttons:
```tsx
<button className="btn-minimal-primary">Salvar</button>
<button className="btn-minimal-outline">Cancelar</button>
<button className="btn-minimal-ghost">Mais</button>
<button className="btn-minimal-destructive">Deletar</button>
```

#### Cards:
```tsx
<div className="card-minimal p-6">
  <h3>Título</h3>
  <p>Conteúdo</p>
</div>
```

#### Tables:
```tsx
<table className="table-minimal">
  <thead>...</thead>
  <tbody>...</tbody>
</table>
```

#### Forms:
```tsx
<form className="form-minimal">
  <div className="form-group">
    <label>Nome</label>
    <input className="input-minimal" />
    <p className="form-description">Texto de ajuda</p>
  </div>
</form>
```

#### Layouts:
```tsx
<div className="page-minimal">
  <header className="page-header-minimal">...</header>
  <main className="page-content-minimal">
    <section className="section-minimal">...</section>
  </main>
</div>
```

#### Grids Responsivos:
```tsx
<div className="grid-minimal-2">
  {/* 1 coluna mobile, 2 desktop */}
</div>

<div className="grid-minimal-3">
  {/* 1 mobile, 2 tablet, 3 desktop */}
</div>

<div className="grid-minimal-4">
  {/* 1 mobile, 2 tablet, 4 desktop */}
</div>
```

## Classes Disponíveis

### Inputs & Forms
- `.input-minimal` - Input padrão (h-9, rounded)
- `.select-minimal` - Select dropdown
- `.textarea-minimal` - Textarea
- `.form-minimal` - Container de formulário
- `.form-group` - Grupo de campos
- `.form-error` - Mensagem de erro
- `.form-description` - Texto de ajuda

### Buttons
- `.btn-minimal` - Base button
- `.btn-minimal-primary` - Botão principal
- `.btn-minimal-outline` - Botão com borda
- `.btn-minimal-ghost` - Botão transparente
- `.btn-minimal-destructive` - Botão de ação destrutiva

### Cards & Containers
- `.card-minimal` - Card com hover
- `.card-minimal-flat` - Card sem hover
- `.page-minimal` - Container de página
- `.page-header-minimal` - Header fixo
- `.page-content-minimal` - Conteúdo principal
- `.section-minimal` - Seção com espaçamento

### Tables
- `.table-minimal` - Tabela completa (aplicar no `<table>`)

### Badges & Alerts
- `.badge-minimal` - Badge base
- `.alert-minimal` - Alert base
- `.alert-info` - Alert informativo
- `.alert-success` - Alert de sucesso
- `.alert-warning` - Alert de aviso
- `.alert-destructive` - Alert de erro

### Utilities
- `.separator-minimal` - Linha horizontal
- `.separator-minimal-vertical` - Linha vertical
- `.skeleton-minimal` - Loading skeleton
- `.scrollbar-minimal` - Scrollbar customizada
- `.focus-minimal` - Focus ring

### Grids Responsivos
- `.grid-minimal-2` - Grid 2 colunas
- `.grid-minimal-3` - Grid 3 colunas
- `.grid-minimal-4` - Grid 4 colunas

## Vantagens da Abordagem

### 1. Isolamento
Cada página pode ter seu próprio estilo sem afetar outras:

```tsx
// Página de teste: usa classes minimalistas
<div className="page-minimal">
  <input className="input-minimal" />
</div>

// Dashboard: mantém estilos existentes
<div className="dashboard">
  <input className="custom-input" />
</div>
```

### 2. Flexibilidade
Pode combinar com outras classes:

```tsx
<input className="input-minimal w-full max-w-md" />
<button className="btn-minimal-primary ml-auto">Salvar</button>
```

### 3. Manutenibilidade
Fácil encontrar e modificar:

```css
/* Quer mudar todos os inputs minimalistas? */
.input-minimal {
  @apply h-10;  /* Mude de h-9 para h-10 */
}
```

### 4. Testes
Pode testar em uma página sem quebrar outras:

```tsx
// Teste na página de design system
<DesignSystemTest /> // Usa .input-minimal

// Produção continua normal
<Dashboard /> // Não é afetado
```

## Migração de Páginas Existentes

### Passo 1: Escolha uma página piloto
```tsx
// pages/cadastros/Unidades.tsx
```

### Passo 2: Substitua classes gradualmente
```tsx
// ❌ ANTES
<input className="h-9 rounded border" />

// ✅ DEPOIS
<input className="input-minimal" />
```

### Passo 3: Teste e ajuste
- Verifique visualmente
- Teste dark mode
- Confirme responsividade
- Valide acessibilidade

### Passo 4: Replique para outras páginas
Só depois de validar a página piloto!

## Exemplo Completo: CRUD Page

```tsx
import { useState } from "react"
import { Combobox } from "@/components/ui/combobox-minimal"
import { Sheet, SheetContent } from "@/components/ui/sheet-minimal"

export function UnidadesPage() {
  const [isSheetOpen, setIsSheetOpen] = useState(false)

  return (
    <div className="page-minimal">
      {/* Header */}
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

      {/* Content */}
      <main className="page-content-minimal">
        {/* Filtros */}
        <section className="section-minimal">
          <div className="card-minimal p-4">
            <div className="grid-minimal-3">
              <div>
                <label className="text-sm font-medium">Buscar</label>
                <input
                  className="input-minimal mt-2"
                  placeholder="Nome da unidade..."
                />
              </div>
              <div>
                <label className="text-sm font-medium">Planta</label>
                <Combobox
                  className="mt-2"
                  options={plantas}
                  placeholder="Selecione..."
                />
              </div>
              <div>
                <label className="text-sm font-medium">Status</label>
                <select className="select-minimal mt-2">
                  <option>Todos</option>
                  <option>Ativo</option>
                  <option>Inativo</option>
                </select>
              </div>
            </div>
          </div>
        </section>

        {/* Tabela */}
        <section className="section-minimal">
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
                {unidades.map(u => (
                  <tr key={u.id}>
                    <td>{u.nome}</td>
                    <td>{u.planta}</td>
                    <td>
                      <span className="badge-minimal text-success">
                        {u.status}
                      </span>
                    </td>
                    <td className="text-right">
                      <button className="btn-minimal-ghost">
                        Editar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {/* Sheet Lateral */}
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent>
          <form className="form-minimal">
            <div className="form-group">
              <label>Nome</label>
              <input className="input-minimal" />
            </div>

            <div className="form-group">
              <label>Planta</label>
              <Combobox options={plantas} />
            </div>

            <div className="flex gap-3 mt-6">
              <button type="button" className="btn-minimal-outline">
                Cancelar
              </button>
              <button type="submit" className="btn-minimal-primary">
                Salvar
              </button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  )
}
```

## Conclusão

**Use classes utilitárias específicas ao invés de sobrescrever variáveis globais!**

✅ **Faça:**
- Crie classes `.input-minimal`, `.btn-minimal`, etc
- Aplique onde quiser
- Mantenha sistema existente funcionando

❌ **Não faça:**
- Sobrescrever `@layer base`
- Modificar variáveis CSS globais
- Aplicar estilos que afetam tudo

---

**Arquivos criados:**
- `design-minimal-components.css` - Classes utilitárias
- `combobox-minimal.tsx` - Select pesquisável
- `sheet-minimal.tsx` - Sheet lateral

**Próximos passos:**
1. Testar classes na página de teste
2. Aplicar em página piloto (Unidades)
3. Validar e iterar
4. Replicar para outras páginas
