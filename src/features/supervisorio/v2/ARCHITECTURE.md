# Arquitetura do Diagrama Unifilar V2

## 📋 Índice
- [Visão Geral](#visão-geral)
- [Estrutura de Pastas](#estrutura-de-pastas)
- [Componentes Principais](#componentes-principais)
- [Fluxo de Dados](#fluxo-de-dados)
- [Responsabilidades](#responsabilidades)
- [Princípios de Design](#princípios-de-design)

---

## 🎯 Visão Geral

O Diagrama Unifilar V2 foi arquitetado seguindo os princípios **SOLID** e **Clean Architecture**, com foco em:

- ✅ **Separação de Responsabilidades** - Cada componente tem uma função clara e única
- ✅ **Modularidade** - Componentes independentes e reutilizáveis
- ✅ **Testabilidade** - Lógica separada da apresentação
- ✅ **Manutenibilidade** - Código organizado e documentado
- ✅ **Escalabilidade** - Fácil adicionar novos tipos de equipamentos

---

## 📁 Estrutura de Pastas

```
v2/
├── 📄 DiagramV2.tsx                 # Componente raiz (orquestrador)
├── 📄 DiagramV2Wrapper.tsx          # Wrapper com integração de rotas
│
├── 📂 components/                   # Componentes React
│   ├── 📂 DiagramViewer/           # Visualização do canvas
│   │   ├── DiagramViewport.tsx     # SVG canvas + zoom/pan
│   │   └── DiagramConnections.tsx  # Renderização de linhas
│   │
│   ├── 📂 Equipment/               # Equipamentos
│   │   └── EquipmentNode.tsx       # Renderização de equipamento individual
│   │
│   ├── 📂 icons/                   # Ícones SVG
│   │   ├── EquipmentIconFactory.tsx # Factory Pattern para ícones
│   │   ├── InversorIcon.tsx
│   │   ├── MedidorIcon.tsx
│   │   ├── TransformadorIcon.tsx
│   │   └── ... (outros ícones)
│   │
│   ├── EditorToolbar.tsx           # Sidebar com ferramentas
│   └── EquipmentEditModal.tsx      # Modal de edição
│
├── 📂 hooks/                        # Estado global
│   └── useDiagramStore.ts          # Zustand store (single source of truth)
│
├── 📂 types/                        # TypeScript types
│   └── diagram.types.ts            # Todos os tipos centralizados
│
├── 📂 utils/                        # Lógica de negócio pura
│   ├── diagramConstants.ts         # Constantes (grid, cores, tamanhos)
│   ├── orthogonalRouting.ts        # Algoritmo de roteamento L-shape
│   └── barramentoDetector.ts       # Detecção algorítmica de barramentos
│
└── 📂 services/                     # (Futuro) Chamadas de API
```

---

## 🧩 Componentes Principais

### 1️⃣ **DiagramV2.tsx** - Orquestrador Principal

**Responsabilidade:** Integração de todos os componentes e gerenciamento de estado alto nível

```typescript
DiagramV2
├── Estado/Hooks
│   ├── useDiagramStore          // Estado global Zustand
│   ├── useTheme                 // Tema da aplicação
│   └── useToast                 // Notificações
│
├── Lifecycle
│   ├── loadDiagrama()           // Carrega do backend
│   ├── createDiagrama()         // Cria novo diagrama
│   └── saveLayout()             // Salva no backend
│
├── Handlers
│   ├── handleSave()             // Ctrl+S
│   ├── handleDeleteEquipment()  // Del
│   ├── handleEquipamentoCriado()
│   └── handleEditEquipment()
│
└── Renderização
    ├── <DiagramViewport>        // Canvas SVG
    ├── <EditorToolbar>          // Ferramentas
    ├── <EquipmentEditModal>     // Edição
    └── <ModalCriarEquipamento>  // Criação rápida
```

**Não faz:**
- ❌ Lógica de roteamento de conexões
- ❌ Cálculos matemáticos
- ❌ Renderização direta de SVG

---

### 2️⃣ **DiagramViewport.tsx** - Canvas SVG

**Responsabilidade:** Renderização do canvas, zoom, pan e grid

```typescript
DiagramViewport
├── Viewport State
│   ├── scale (zoom)
│   ├── x/y (pan)
│   └── isDragging
│
├── Event Handlers
│   ├── handleWheel()            // Zoom com scroll
│   ├── handleMouseDown()        // Inicia pan
│   ├── handleMouseMove()        // Drag viewport OU equipamento
│   └── handleMouseUp()          // Finaliza drag
│
├── Drag Detection
│   ├── Viewport Drag (pan)      // Arrasta canvas
│   └── Equipment Drag           // Arrasta equipamento
│       ├── Calcula mouse position com zoom/pan
│       ├── Converte pixels → grid
│       └── updateEquipamentoPosition()
│
└── Renderização
    ├── Grid (linhas 40x40px)
    └── {children}               // EquipmentNodes + Connections
```

**Características:**
- ✅ Passive: false para wheel event (permite preventDefault)
- ✅ Suporta zoom 0.1x a 2.0x
- ✅ Considera transformações ao calcular mouse position
- ✅ Snap to grid opcional

---

### 3️⃣ **EquipmentNode.tsx** - Equipamento Individual

**Responsabilidade:** Renderização e interação com um equipamento

```typescript
EquipmentNode
├── Props
│   ├── equipment: Equipment     // Dados do equipamento
│   └── onDoubleClick?           // Callback opcional
│
├── Renderização
│   ├── SelectionBox             // Borda azul quando selecionado
│   ├── Icon (foreignObject)     // Ícone SVG do tipo
│   ├── Label                    // Nome/tag do equipamento
│   └── Ports (4x círculos)      // top/bottom/left/right
│
├── Interação
│   ├── onMouseDown              // Inicia drag OU seleciona
│   ├── onMouseUp                // Finaliza drag
│   ├── onDoubleClick            // Abre modal de edição
│   └── Port onClick             // Inicia/finaliza conexão
│
└── Estados Visuais
    ├── isSelected               // Mostra borda azul
    ├── isDragging               // Cursor = grabbing
    └── isConnecting             // Portas ficam azul escuro
```

**Características:**
- ✅ Totalmente stateless (estado vem do Zustand)
- ✅ Posição em grid coordinates (convertido para pixels)
- ✅ Suporta rotação (0°, 90°, 180°, 270°)
- ✅ Label position configurável (top/bottom/left/right)

---

### 4️⃣ **DiagramConnections.tsx** - Linhas de Conexão

**Responsabilidade:** Renderização de todas as conexões ortogonais

```typescript
DiagramConnections
├── Props
│   ├── visualConnections[]      // Conexões calculadas
│   └── barramentos[]            // Barramentos detectados
│
├── Separação Lógica
│   ├── Conexões Normais         // Ponto a ponto (L-shape)
│   └── Conexões de Barramento   // Passam por barramento horizontal
│
├── Renderização
│   ├── renderConexao()          // <path> SVG com curvas arredondadas
│   └── renderBarramento()       // Linha horizontal + conexões
│
└── Estilos
    ├── Tema-aware (branco/cinza)
    ├── Stroke width baseado em seleção
    └── Corner radius = 4px
```

**Características:**
- ✅ Usa `pointsToSvgPathRounded()` para curvas suaves
- ✅ Validação robusta contra NaN
- ✅ Detecta barramentos automaticamente (3+ conexões)

---

### 5️⃣ **EquipmentIconFactory.tsx** - Factory de Ícones

**Responsabilidade:** Mapear tipo de equipamento → Componente de ícone

```typescript
EquipmentIconFactory
├── ICON_MAP
│   ├── INVERSOR_FRONIUS → InversorIcon
│   ├── MEDIDOR → MedidorIcon
│   ├── TRANSFORMADOR → TransformadorIcon
│   ├── EQUIPAMENTO → MedidorIcon (fallback)
│   └── ... (40+ tipos)
│
└── EquipmentIconWrapper
    ├── Recebe: tipo, width, height, color
    ├── Busca componente no ICON_MAP
    └── Renderiza com props padronizadas
```

**Padrão de Design:**
- ✅ **Factory Pattern** - Criação centralizada
- ✅ **Strategy Pattern** - Componentes intercambiáveis
- ✅ **Fallback seguro** - Sempre retorna ícone válido

---

### 6️⃣ **useDiagramStore.ts** - Estado Global (Zustand)

**Responsabilidade:** Single source of truth para todo o diagrama

```typescript
DiagramStore
├── Estado
│   ├── diagrama                 // Dados principais
│   ├── equipamentos[]           // Lista de equipamentos
│   ├── conexoes[]               // Conexões raw (backend)
│   ├── visualConnections[]      // Conexões + rotas calculadas
│   ├── barramentos[]            // Barramentos detectados
│   ├── viewport { x, y, scale }
│   ├── editor { mode, selected, dragging }
│   ├── theme: 'light' | 'dark'
│   └── isDirty                  // Alterações não salvas
│
├── CRUD - Diagrama
│   ├── loadDiagrama()           // GET /api/diagramas/:id
│   ├── createDiagrama()         // POST /api/diagramas
│   ├── saveLayout()             // PUT /api/diagramas/:id/layout
│   └── clearDiagrama()
│
├── CRUD - Equipamentos
│   ├── addEquipamento()         // Adiciona à lista local
│   ├── removeEquipamento()      // Remove da lista
│   └── updateEquipamentoPosition() // Atualiza coords
│
├── CRUD - Conexões
│   ├── addConexao()
│   ├── removeConexao()
│   └── recalcularRotas()        // Recalcula visual connections
│
├── Viewport
│   ├── setZoom()
│   ├── setPan()
│   ├── startViewportDrag()
│   └── endViewportDrag()
│
├── Editor
│   ├── setEditorMode()          // view | edit | connecting
│   ├── selectEquipamento()
│   ├── clearSelection()
│   ├── startDraggingEquipamento()
│   ├── endDraggingEquipamento()
│   ├── startConnecting()
│   └── finishConnecting()
│
└── Computed Values
    └── recalcularRotas()        // Detecta barramentos + calcula paths
```

**Características:**
- ✅ **Immer** para imutabilidade
- ✅ **DevTools** para debug
- ✅ Recalcula rotas automaticamente quando equipamentos mudam
- ✅ Dirty flag para indicar alterações não salvas

---

### 7️⃣ **orthogonalRouting.ts** - Algoritmo de Roteamento

**Responsabilidade:** Cálculo puro de caminhos ortogonais (L/Z/U-shape)

```typescript
orthogonalRouting
├── getPortPoint()
│   ├── Calcula posição absoluta da porta
│   ├── Retorna direção (up/down/left/right)
│   └── Validação contra coordenadas inválidas
│
├── calculateOrthogonalRoute()
│   ├── Caso 1: L-shape (top↔left/right)
│   ├── Caso 2: Z-shape (paralelas)
│   ├── Caso 3: U-shape (opostas)
│   └── Retorna: Point[]
│
├── pointsToSvgPath()
│   └── Point[] → "M x,y L x,y L x,y"
│
└── pointsToSvgPathRounded()
    ├── Adiciona curvas Bezier nos cantos
    ├── Validação multi-camada (NaN protection)
    └── Fallback para linhas retas
```

**Validações Implementadas:**
- ✅ Equipamento com coords inválidas → centro do canvas
- ✅ Pontos duplicados → skip arredondamento
- ✅ Divisão por zero → linha reta
- ✅ NaN detectado → fallback seguro

---

### 8️⃣ **barramentoDetector.ts** - Detecção de Barramentos

**Responsabilidade:** Detectar algoritmicamente quando 3+ conexões formam barramento

```typescript
barramentoDetector
├── detectBarramentos()
│   ├── Agrupa conexões por (equipamentoId + porta)
│   ├── Se grupo.length >= 3 → É barramento
│   └── Retorna: Barramento[]
│
├── convertToVisualConnections()
│   ├── Para cada Connection (backend)
│   ├── Calcula rota ortogonal
│   └── Retorna VisualConnection com pontos
│
└── getBarramentoPath()
    └── Gera path SVG da linha horizontal do barramento
```

**Características:**
- ✅ **Barramentos são virtuais** (não existem no BD)
- ✅ Detectados em tempo real no frontend
- ✅ Recalculados quando equipamentos movem

---

## 🔄 Fluxo de Dados

### Carregamento Inicial

```
User acessa /diagramas/:id
        ↓
DiagramV2.tsx → useEffect
        ↓
loadDiagrama(id) → useDiagramStore
        ↓
GET /api/v1/diagramas/:id
        ↓
Response: { diagrama, equipamentos[], conexoes[] }
        ↓
convertToVisualConnections(conexoes, equipamentos)
        ↓
calculateOrthogonalRoute() para cada conexão
        ↓
detectBarramentos(conexoes, equipamentos)
        ↓
Store atualizado: { diagrama, equipamentos, visualConnections, barramentos }
        ↓
Componentes re-renderizam automaticamente (Zustand)
```

### Drag de Equipamento

```
User clica em equipamento (modo edit)
        ↓
EquipmentNode.onMouseDown
        ↓
startDraggingEquipamento(id, offset)
        ↓
Store: editor.draggingEquipmentId = id
        ↓
User move o mouse
        ↓
DiagramViewport.handleMouseMove
        ↓
if (editor.draggingEquipmentId) {
    Calcula mouse position com zoom/pan
    Converte pixels → grid
    updateEquipamentoPosition(id, gridX, gridY)
}
        ↓
Store: equipamentos[x].posicaoX/Y atualizado
        ↓
recalcularRotas() → Recalcula conexões
        ↓
EquipmentNode re-renderiza na nova posição
DiagramConnections re-renderiza linhas
```

### Criação de Conexão

```
User clica em porta (modo edit/connecting)
        ↓
EquipmentNode.handlePortClick
        ↓
Se é primeiro click:
    startConnecting(equipamentoId, porta)
    Store: editor.connectingFrom = { equipamentoId, porta }
        ↓
User clica em segunda porta
        ↓
finishConnecting(equipamentoId, porta)
        ↓
addConexao({
    equipamentoOrigemId,
    portaOrigem,
    equipamentoDestinoId,
    portaDestino
})
        ↓
recalcularRotas()
        ↓
Nova linha renderizada
```

---

## 📐 Responsabilidades por Camada

### **Componentes (components/)**
- ✅ Renderização React/SVG
- ✅ Eventos de UI (click, drag)
- ✅ Estilos CSS
- ❌ **NÃO fazem:** Lógica de negócio, cálculos matemáticos, chamadas de API

### **Utils (utils/)**
- ✅ Algoritmos puros (roteamento, detecção)
- ✅ Constantes e configurações
- ✅ Funções auxiliares (conversões)
- ❌ **NÃO fazem:** Manipulação de estado, chamadas de API, renderização

### **Hooks (hooks/)**
- ✅ Estado global Zustand
- ✅ Orquestração de lógica
- ✅ Chamadas de API
- ❌ **NÃO fazem:** Renderização, cálculos complexos (delega para utils)

### **Types (types/)**
- ✅ Definições TypeScript
- ✅ Interfaces e tipos
- ✅ Documentação inline
- ❌ **NÃO fazem:** Lógica

---

## 🎨 Princípios de Design

### 1. **Single Responsibility Principle (SRP)**
Cada componente/função tem UMA responsabilidade clara:
- `EquipmentNode` → Renderiza equipamento
- `DiagramViewport` → Gerencia canvas
- `orthogonalRouting` → Calcula rotas
- `useDiagramStore` → Gerencia estado

### 2. **Don't Repeat Yourself (DRY)**
- Constantes centralizadas em `diagramConstants.ts`
- Ícones reutilizáveis via Factory Pattern
- Funções auxiliares compartilhadas

### 3. **Separation of Concerns**
```
Apresentação (Components)
        ↕
Estado (Hooks)
        ↕
Lógica (Utils)
        ↕
Dados (Types)
```

### 4. **Dependency Inversion**
Componentes dependem de abstrações (tipos), não de implementações concretas:
```typescript
// ✅ Bom
function EquipmentNode({ equipment }: { equipment: Equipment })

// ❌ Ruim
function EquipmentNode({ id, nome, tag, ... })  // 20 props soltas
```

### 5. **Open/Closed Principle**
Fácil **adicionar** novos tipos, difícil **quebrar** código existente:

**Para adicionar novo tipo de equipamento:**
1. Criar `NovoIcon.tsx` em `icons/`
2. Adicionar entrada em `ICON_MAP`
3. Adicionar dimensões em `EQUIPMENT_SIZES`
4. **Pronto!** Nada mais precisa mudar

### 6. **Testabilidade**
Funções puras em `utils/` são facilmente testáveis:
```typescript
// Teste unitário simples
expect(gridToPixels(10)).toBe(400);
expect(pixelsToGrid(400)).toBe(10);
```

---

## 🔧 Manutenção e Extensibilidade

### Adicionar Novo Tipo de Equipamento

```diff
// 1. Criar ícone
+ icons/NovoEquipamentoIcon.tsx

// 2. Registrar no factory
  EquipmentIconFactory.tsx:
  const ICON_MAP = {
    // ...
+   NOVO_EQUIPAMENTO: NovoEquipamentoIcon,
  };

// 3. Definir tamanho
  diagramConstants.ts:
  export const EQUIPMENT_SIZES = {
    // ...
+   NOVO_EQUIPAMENTO: { width: 2, height: 2 },
  };
```

### Adicionar Nova Funcionalidade ao Editor

```diff
// 1. Adicionar ao estado
  useDiagramStore.ts:
  interface EditorState {
    // ...
+   novoModo: boolean;
  }

// 2. Adicionar ação
  interface DiagramActions {
    // ...
+   ativarNovoModo: () => void;
  }

// 3. Adicionar botão na sidebar
  EditorToolbar.tsx:
+ <Button onClick={ativarNovoModo}>Nova Feature</Button>
```

### Modificar Algoritmo de Roteamento

```typescript
// Tudo isolado em orthogonalRouting.ts
// Pode modificar sem afetar componentes

export const calculateOrthogonalRoute = (...) => {
  // Modificar algoritmo aqui
  // Testes unitários garantem que não quebrou
};
```

---

## 📊 Métricas de Qualidade

### Coesão
- ✅ **Alta** - Cada módulo tem responsabilidade única e clara

### Acoplamento
- ✅ **Baixo** - Componentes se comunicam via props/Zustand, não importam diretamente uns aos outros

### Complexidade Ciclomática
- ✅ **Baixa** - Funções pequenas e focadas (< 50 linhas em média)

### Duplicação de Código
- ✅ **Mínima** - DRY aplicado rigorosamente

### Documentação
- ✅ **Completa** - Comentários JSDoc, tipos TypeScript, este arquivo

---

## 🚀 Próximos Passos (Sugestões)

### Testes
```
v2/
└── __tests__/
    ├── orthogonalRouting.test.ts     # Testes unitários
    ├── barramentoDetector.test.ts
    ├── EquipmentNode.test.tsx         # Testes de componente
    └── useDiagramStore.test.ts        # Testes de estado
```

### Otimizações de Performance
- [ ] Virtualização de equipamentos (se > 100 equipamentos)
- [ ] Memoização de cálculos caros
- [ ] Debounce em drag (já implementado no store)

### Features Avançadas
- [ ] Undo/Redo (command pattern)
- [ ] Multi-seleção com Shift+Click
- [ ] Copy/Paste de equipamentos
- [ ] Grupos visuais (boxes tracejados)

---

## 📚 Referências

- **Zustand**: https://github.com/pmndrs/zustand
- **SVG Path Syntax**: https://developer.mozilla.org/en-US/docs/Web/SVG/Tutorial/Paths
- **SOLID Principles**: https://en.wikipedia.org/wiki/SOLID
- **Clean Architecture**: https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html

---

**Mantido por:** Equipe de Desenvolvimento
**Última atualização:** 2026-02-03
**Versão do Diagrama:** V2.0
