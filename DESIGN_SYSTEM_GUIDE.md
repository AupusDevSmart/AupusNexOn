# 🎨 DESIGN SYSTEM AUPUS NEXON - GUIA COMPLETO

## 📐 Filosofia de Design

**Minimalista • Profissional • Discreto**

- ✅ Cores neutras (preto/branco/cinza)
- ✅ Bordas pouco arredondadas (4px)
- ✅ Inputs finos e elegantes
- ✅ Sheets laterais (não modais)
- ✅ Avisos discretos
- ✅ Transições suaves

---

## 🎨 Paleta de Cores

### Light Mode
```
Background: Branco puro (#FFFFFF)
Foreground: Preto quase puro (#0D0D0D)
Primary: Cinza escuro (#262626)
Border: Cinza claro (#E5E5E5)
Muted: Cinza muito claro (#F5F5F5)
```

### Dark Mode
```
Background: Preto quase puro (#141414)
Foreground: Branco quase puro (#F2F2F2)
Primary: Cinza claro (#E5E5E5)
Border: Cinza escuro (#333333)
Muted: Cinza escuro (#262626)
```

### Estados (Discretos)
```
Success: Verde escuro (#059669)
Warning: Laranja escuro (#D97706)
Error: Vermelho escuro (#DC2626)
Info: Azul escuro (#2563EB)
```

---

## 🧱 Componentes Base

### 1. Input Minimal

```tsx
import { Input } from "@/components/ui/input"

<Input
  className="h-9 rounded"  // Mais fino e pouco arredondado
  placeholder="Digite aqui..."
/>
```

**Características:**
- Altura: 36px (h-9)
- Borda: 4px de radius
- Border sutil: 1px solid
- Focus: Ring discreto de 1px

---

### 2. Sheet Lateral (Substitui Modals)

```tsx
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetBody,
  SheetFooter,
  SheetTitle,
  SheetCloseButton,
} from "@/components/ui/sheet-minimal"

<Sheet open={isOpen} onOpenChange={setIsOpen}>
  <SheetContent size="default">  {/* 50% da tela */}
    <SheetHeader>
      <SheetTitle>Nova Unidade</SheetTitle>
      <SheetCloseButton />
    </SheetHeader>

    <SheetBody>
      {/* Formulário aqui */}
    </SheetBody>

    <SheetFooter>
      <Button variant="outline" onClick={onCancel}>
        Cancelar
      </Button>
      <Button onClick={onSave}>
        Salvar
      </Button>
    </SheetFooter>
  </SheetContent>
</Sheet>
```

**Características:**
- Abre da direita para esquerda
- Overlay sutil (20% opacidade + blur 2px)
- Tamanhos: sm (400px), default (50vw), lg (70vw), full (100vw)
- Animação suave (300ms)
- Header/Footer fixos, Body com scroll

---

### 3. Button Minimal

```tsx
import { Button } from "@/components/ui/button"

{/* Primary */}
<Button className="h-9 rounded">
  Salvar
</Button>

{/* Outline */}
<Button variant="outline" className="h-9 rounded">
  Cancelar
</Button>

{/* Ghost */}
<Button variant="ghost" className="h-9 rounded">
  Editar
</Button>

{/* Destructive (discreto) */}
<Button variant="destructive" className="h-9 rounded">
  Excluir
</Button>
```

**Características:**
- Altura: 36px (h-9)
- Padding horizontal: 16px (px-4)
- Hover: Transição de 200ms
- Estados visuais sutis

---

### 4. Table Minimal

```tsx
<div className="border border-border rounded">
  <table className="table-minimal">
    <thead>
      <tr>
        <th>Nome</th>
        <th>Status</th>
        <th className="text-right">Ações</th>
      </tr>
    </thead>
    <tbody>
      {data.map(item => (
        <tr key={item.id}>
          <td>{item.nome}</td>
          <td>
            <Badge variant="outline" className="badge-minimal">
              {item.status}
            </Badge>
          </td>
          <td className="text-right">
            <Button variant="ghost" size="sm">
              Editar
            </Button>
          </td>
        </tr>
      ))}
    </tbody>
  </table>
</div>
```

**Características:**
- Borders sutis entre rows
- Hover discreto (muted/50)
- Header com texto muted
- Altura de row: 48px (h-12)

---

### 5. Alert Discreto

```tsx
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Info, AlertTriangle, CheckCircle, XCircle } from "lucide-react"

{/* Info */}
<Alert className="alert-minimal alert-info">
  <Info className="h-4 w-4" />
  <AlertDescription>
    Informação importante
  </AlertDescription>
</Alert>

{/* Warning */}
<Alert className="alert-minimal alert-warning">
  <AlertTriangle className="h-4 w-4" />
  <AlertDescription>
    Atenção: verifique os dados
  </AlertDescription>
</Alert>

{/* Success */}
<Alert className="alert-minimal alert-success">
  <CheckCircle className="h-4 w-4" />
  <AlertDescription>
    Operação concluída com sucesso
  </AlertDescription>
</Alert>

{/* Error */}
<Alert className="alert-minimal alert-destructive">
  <XCircle className="h-4 w-4" />
  <AlertDescription>
    Erro ao processar requisição
  </AlertDescription>
</Alert>
```

**Características:**
- Background com 5% opacidade da cor
- Border com 20% opacidade da cor
- Ícones pequenos (16px)
- Texto em tom da cor do alerta

---

### 6. Badge Discreto

```tsx
<Badge variant="outline" className="badge-minimal">
  Ativo
</Badge>

<Badge variant="outline" className="badge-minimal text-success">
  Aprovado
</Badge>

<Badge variant="outline" className="badge-minimal text-warning">
  Pendente
</Badge>

<Badge variant="outline" className="badge-minimal text-destructive">
  Rejeitado
</Badge>
```

**Características:**
- Tamanho pequeno (text-xs)
- Border sutil
- Background muted
- Padding mínimo (px-2 py-0.5)

---

### 7. Card Discreto

```tsx
<div className="card-minimal p-6">
  <h3 className="text-lg font-semibold mb-2">
    Título do Card
  </h3>
  <p className="text-sm text-muted-foreground">
    Descrição do conteúdo
  </p>
</div>
```

**Características:**
- Border sutil (1px)
- Radius pequeno (4px)
- Background card
- Sem shadow (ou shadow muito sutil)

---

## 📋 Exemplo Completo: Página CRUD

```tsx
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetBody,
  SheetFooter,
  SheetTitle,
  SheetCloseButton,
} from "@/components/ui/sheet-minimal"
import { useUnidadesList } from "../hooks/useUnidadesList"
import { useUnidadesActions } from "../hooks/useUnidadesActions"

export function UnidadesPage() {
  const { unidades, loading } = useUnidadesList()
  const { isOpen, mode, entity, openCreate, openEdit, closeSheet } = useUnidadesActions()

  return (
    <div className="container mx-auto py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Unidades</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {unidades.length} instalações cadastradas
          </p>
        </div>
        <Button onClick={openCreate} className="h-9 rounded">
          Nova Unidade
        </Button>
      </div>

      {/* Table */}
      <div className="border border-border rounded">
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
            {unidades.map((unidade) => (
              <tr key={unidade.id}>
                <td className="font-medium">{unidade.nome}</td>
                <td className="text-muted-foreground">{unidade.planta}</td>
                <td>
                  <Badge variant="outline" className="badge-minimal">
                    {unidade.status}
                  </Badge>
                </td>
                <td className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openEdit(unidade)}
                  >
                    Editar
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Sheet Lateral (50% da tela) */}
      <Sheet open={isOpen} onOpenChange={closeSheet}>
        <SheetContent size="default">
          <SheetHeader>
            <SheetTitle>
              {mode === 'create' ? 'Nova Unidade' : 'Editar Unidade'}
            </SheetTitle>
            <SheetCloseButton />
          </SheetHeader>

          <SheetBody>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome da Instalação</Label>
                <Input
                  id="nome"
                  className="h-9 rounded"
                  placeholder="Ex: Unidade Solar 01"
                  defaultValue={entity?.nome}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="planta">Planta</Label>
                <select className="select-minimal w-full">
                  <option>Selecione uma planta</option>
                  <option>Planta A</option>
                  <option>Planta B</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="tipo">Tipo</Label>
                <select className="select-minimal w-full">
                  <option>UFV</option>
                  <option>Carga</option>
                  <option>Híbrida</option>
                </select>
              </div>
            </div>
          </SheetBody>

          <SheetFooter>
            <Button
              variant="outline"
              className="h-9 rounded"
              onClick={closeSheet}
            >
              Cancelar
            </Button>
            <Button className="h-9 rounded">
              Salvar
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  )
}
```

---

## 🎯 Regras de Ouro

### ✅ FAZER

1. **Usar sheets laterais** ao invés de modals centrais
2. **Manter cores neutras** (preto, branco, cinza)
3. **Bordas de 4px** (rounded, não rounded-lg)
4. **Inputs altura h-9** (36px - mais finos)
5. **Animações sutis** (200-300ms)
6. **Textos descritivos em muted-foreground**
7. **Espaçamento generoso** entre elementos
8. **Bordas sutis** (border-border)

### ❌ NÃO FAZER

1. ❌ Usar modais centrais
2. ❌ Cores vibrantes ou gradientes
3. ❌ Bordas muito arredondadas (rounded-xl)
4. ❌ Inputs grossos (h-10, h-11)
5. ❌ Animações exageradas
6. ❌ Muitas cores diferentes
7. ❌ Elementos muito juntos
8. ❌ Bordas grossas ou coloridas

---

## 📱 Responsividade

### Mobile First
```tsx
{/* Sheet ocupa 100% em mobile, 50% em desktop */}
<SheetContent size="default" className="max-w-full md:max-w-[50vw]">
  ...
</SheetContent>

{/* Tabela com scroll horizontal em mobile */}
<div className="overflow-x-auto">
  <table className="table-minimal min-w-[640px]">
    ...
  </table>
</div>

{/* Botões stack em mobile, inline em desktop */}
<div className="flex flex-col sm:flex-row gap-2">
  <Button>Cancelar</Button>
  <Button>Salvar</Button>
</div>
```

---

## 🌗 Dark Mode

O tema já está configurado para alternar automaticamente entre light/dark mode baseado na preferência do sistema ou toggle manual.

```tsx
import { useTheme } from "next-themes"

function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
    >
      {theme === "dark" ? "☀️" : "🌙"}
    </Button>
  )
}
```

---

## 🚀 Próximos Passos

1. Importar `design-system.css` no arquivo principal de estilos
2. Substituir componentes atuais pelos componentes minimalistas
3. Refatorar páginas existentes para usar sheets ao invés de modals
4. Aplicar classes de estilo consistentes (`h-9`, `rounded`, etc)
5. Testar em light e dark mode

---

## 💡 Dica Final

**Menos é mais.** Sempre que tiver dúvida, escolha a opção mais discreta:
- Cor mais neutra
- Border mais sutil
- Animação mais suave
- Espaçamento mais generoso

**Profissionalismo = Simplicidade + Consistência**
