# Design System Test Page - README

## O que foi implementado

### 1. Importação do Design System
- ✅ [main.tsx:4](src/main.tsx#L4) - Importado `design-system.css` no app principal
- O CSS minimalista agora está ativo em todo o projeto

### 2. Página de Teste Criada
- ✅ [DesignSystemTest.tsx](src/pages/DesignSystemTest.tsx) - Página completa com showcase de todos os componentes
- ✅ [AppRoutes.tsx:347-353](src/AppRoutes.tsx#L347-L353) - Rota configurada

### 3. Como Acessar

**URL para testar:**
```
http://localhost:PORTA/design-system-test
```

Substitua `PORTA` pela porta do seu servidor de desenvolvimento (geralmente 5173 para Vite ou 3000 para CRA).

### 4. Componentes Testados na Página

A página de teste inclui showcases completos de:

#### 🎨 Seção 1: Buttons
- **ID:** `#section-buttons`
- **Container:** `#buttons-container`
- Variantes: Primary, Outline, Ghost, Destructive, Disabled
- Todos com altura h-9 (36px) e border-radius 4px

#### 📝 Seção 2: Inputs
- **ID:** `#section-inputs`
- **Container:** `#inputs-grid`
- Input text simples
- **Combobox pesquisável** (select com busca integrada)
- Input com ícone de busca
- Input disabled
- Todos os inputs com `h-9 rounded` (finos e pouco arredondados)
- **NOVO:** Combobox com pesquisa em tempo real!

#### 🏷️ Seção 3: Badges
- **ID:** `#section-badges`
- **Container:** `#badges-container`
- Estados: Padrão, Sucesso, Warning, Erro, Info
- Todos com classe `badge-minimal`

#### 🔔 Seção 4: Alerts
- **ID:** `#section-alerts`
- **Container:** `#alerts-container`
- Tipos: Info, Success, Warning, Destructive
- Backgrounds discretos (5% opacidade)
- Borders sutis (20% opacidade)

#### 📊 Seção 5: Table
- **ID:** `#section-table`
- **Table:** `#demo-table`
- Tabela minimalista com hover sutil
- 4 linhas de dados mockados
- Colunas: Nome, Planta, Status, Energia, Ações

#### 🎴 Seção 6: Cards
- **ID:** `#section-cards`
- **Cards:** `#card-unidades`, `#card-energia`, `#card-economia`
- 3 cards com métricas
- Estilo minimalista com classe `card-minimal`

#### 📄 Seção 7: Sheet Lateral
- **ID:** `#section-sheet`
- **Botão:** `#open-sheet-btn`
- **Formulário:** `#sheet-form`
- Sheet que abre da direita para esquerda
- Ocupa 50% da tela por padrão
- Formulário completo com 4 campos
- Botões de ação no footer

#### 📖 Seção 8: Typography
- **ID:** `#section-typography`
- **Container:** `#typography-container`
- Heading 1-3
- Body text
- Small text
- Muted text

#### 🎨 Seção 9: Color Palette
- **ID:** `#section-colors`
- **Container:** `#colors-grid`
- Visualização das cores principais:
  - background
  - foreground
  - muted
  - primary

### 5. Funcionalidades

#### Toggle Dark/Light Mode
- **ID:** `#theme-toggle-btn`
- Botão no header que alterna entre modo claro e escuro
- Ícone muda dinamicamente (Sol/Lua)

### 6. Identificação dos Elementos

Todos os elementos principais têm IDs e classes descritivas para facilitar:
- Testes automatizados
- Inspeção no DevTools
- Desenvolvimento e debugging

**Exemplo de hierarquia:**
```html
<div id="design-test-page">
  <div id="page-header">
    <div id="header-container">
      <div id="header-content">
        <div id="header-title-section">
          <button id="theme-toggle-btn">

  <div id="main-content">
    <section id="section-buttons" class="component-section">
      <div id="buttons-container">
        <!-- Buttons aqui -->
```

### 7. Classes TailwindCSS Utilizadas

Todas as divs usam classes semânticas do Tailwind:
- `container` - Container centralizado
- `mx-auto` - Margin auto horizontal
- `px-6 py-4` - Padding
- `flex`, `grid` - Layout systems
- `space-y-12` - Espaçamento vertical entre seções
- `border border-border` - Borders sutis
- `rounded` - Border radius 4px
- `h-9` - Altura de 36px para inputs/buttons

### 8. Próximos Passos

Após testar a página e aprovar o design:

1. **Aplicar o design nas páginas existentes:**
   - Começar com página de Unidades (piloto)
   - Extrair componentes (hooks + UI)
   - Substituir modals por sheets laterais

2. **Replicar para outras páginas:**
   - Equipamentos
   - Plantas
   - Usuários
   - Concessionárias

3. **Criar componentes reutilizáveis:**
   - DataTable genérica
   - FormBuilder
   - FilterPanel

## Comandos Úteis

### Iniciar o servidor de desenvolvimento:
```bash
cd AupusNexOn
npm run dev
```

### Acessar a página de teste:
```
http://localhost:[PORTA]/design-system-test
```

### Inspecionar elementos:
1. Abra DevTools (F12)
2. Use o seletor de elementos
3. Todos os IDs estão nomeados de forma descritiva

## Componentes Criados

### 1. Combobox Pesquisável
**Arquivo:** [combobox-minimal.tsx](src/components/ui/combobox-minimal.tsx)

Select com busca integrada, estilo minimalista:
- ✅ Altura h-9 (36px)
- ✅ Border radius 4px
- ✅ Backgrounds respeitam tema (light/dark)
- ✅ Pesquisa em tempo real
- ✅ Ícone de check para item selecionado
- ✅ Scrollbar customizada

**Exemplo de uso:**
```tsx
import { Combobox } from "@/components/ui/combobox-minimal"

const options = [
  { value: "planta-a", label: "Planta A" },
  { value: "planta-b", label: "Planta B" },
]

<Combobox
  options={options}
  value={selectedValue}
  onValueChange={setSelectedValue}
  placeholder="Selecione uma opção"
  searchPlaceholder="Buscar..."
  emptyText="Nenhum resultado encontrado"
/>
```

## Estrutura de Arquivos

```
AupusNexOn/
├── src/
│   ├── main.tsx                          # ✅ Design system importado
│   ├── AppRoutes.tsx                     # ✅ Rota configurada
│   ├── pages/
│   │   └── DesignSystemTest.tsx          # ✅ Página de teste
│   ├── components/
│   │   └── ui/
│   │       ├── sheet-minimal.tsx         # ✅ Componente sheet lateral
│   │       └── combobox-minimal.tsx      # ✅ Select pesquisável
│   └── styles/
│       └── design-system.css             # ✅ Tema minimalista
├── DESIGN_SYSTEM_GUIDE.md                # 📖 Guia de uso
├── PLANO_REFATORACAO.md                  # 📋 Plano de implementação
└── DESIGN_SYSTEM_TEST_README.md          # 📄 Este arquivo
```

## Checklist de Testes

Antes de começar a refatoração das páginas reais, verifique:

- [ ] Página carrega sem erros
- [ ] Todos os botões renderizam corretamente
- [ ] Inputs têm altura correta (36px)
- [ ] Borders pouco arredondadas (4px)
- [ ] Cores neutras (preto/branco/cinza)
- [ ] Sheet abre da direita pra esquerda
- [ ] Sheet ocupa 50% da tela
- [ ] Toggle dark/light mode funciona
- [ ] Table com hover sutil
- [ ] Alerts discretos (backgrounds 5% opacidade)
- [ ] Badges minimalistas
- [ ] Typography consistente

## Suporte

Se encontrar algum problema:
1. Verifique o console do navegador (F12)
2. Confirme que `design-system.css` está sendo importado
3. Verifique se a rota está acessível
4. Confirme que todos os componentes shadcn estão instalados

---

**Criado em:** 2026-02-23
**Objetivo:** Visualizar e testar o design system minimalista antes de refatorar páginas reais
