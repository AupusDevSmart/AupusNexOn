# Guia Rápido de Componentes - Diagrama V2

## 🎯 Como Cada Componente Funciona

---

## 1. DiagramV2.tsx - Orquestrador

**O que faz:** Ponto de entrada principal, integra todos os componentes

**Props:**
```typescript
interface DiagramV2Props {
  diagramaId: string;      // ID do diagrama (também é unidadeId)
  mode?: 'view' | 'edit';  // Modo inicial (padrão: view)
}
```

**Estrutura:**
```tsx
<div className="diagram-v2-container">
  {/* Sidebar com ferramentas */}
  <EditorToolbar
    onCreateEquipment={() => setShowCreateModal(true)}
    onEditEquipment={handleEdit}
    onDeleteEquipment={handleDelete}
  />

  {/* Canvas principal */}
  <DiagramViewport>
    {/* Equipamentos */}
    {equipamentos.map(eq => (
      <EquipmentNode
        equipment={eq}
        onDoubleClick={() => handleEdit(eq)}
      />
    ))}

    {/* Linhas de conexão */}
    <DiagramConnections
      visualConnections={visualConnections}
      barramentos={barramentos}
    />
  </DiagramViewport>

  {/* Modais */}
  <EquipmentEditModal ... />
  <ModalCriarEquipamentoRapido ... />
  <CreateDiagramModal ... />
</div>
```

**Não renderiza diretamente:** SVG, paths, ícones (delega para componentes especializados)

---

## 2. DiagramViewport.tsx - Canvas SVG

**O que faz:** Container SVG com zoom, pan e grid

**Características:**
- Canvas fixo de 1920x1080px
- Zoom de 0.1x a 2.0x
- Pan com drag do mouse
- Grid de 40x40px

**Estrutura:**
```tsx
<div className="viewport-wrapper">
  <svg
    width={1920}
    height={1080}
    onMouseDown={handleMouseDown}  // Inicia pan OU drag de equipamento
    onMouseMove={handleMouseMove}  // Atualiza pan OU posição de equipamento
    onMouseUp={handleMouseUp}      // Finaliza drag
    style={{
      transform: `translate(${x}px, ${y}px) scale(${scale})`
    }}
  >
    {/* Grid de fundo */}
    <g className="grid">
      {renderGrid()}
    </g>

    {/* Conteúdo (equipamentos + conexões) */}
    <g className="content">
      {children}
    </g>
  </svg>
</div>
```

**Lógica de Drag:**
```typescript
handleMouseMove(e) {
  // Prioridade 1: Arrastar equipamento
  if (editor.draggingEquipmentId) {
    const mousePos = calculateMousePosition(e);  // Com zoom/pan
    const gridPos = pixelsToGrid(mousePos);
    updateEquipamentoPosition(id, gridPos.x, gridPos.y);
    return;
  }

  // Prioridade 2: Arrastar viewport (pan)
  if (isDraggingViewport) {
    const delta = { x: e.clientX - lastPos.x, y: e.clientY - lastPos.y };
    setPan(viewport.x + delta.x, viewport.y + delta.y);
  }
}
```

---

## 3. EquipmentNode.tsx - Equipamento Individual

**O que faz:** Renderiza um equipamento com ícone, label e portas

**Props:**
```typescript
interface EquipmentNodeProps {
  equipment: Equipment;      // Dados do equipamento
  onDoubleClick?: () => void; // Callback para edição
}
```

**Estrutura SVG:**
```tsx
<g
  className="equipment-node"
  transform={`translate(${gridToPixels(x)}, ${gridToPixels(y)})`}
  onMouseDown={handleMouseDown}
  onDoubleClick={onDoubleClick}
>
  {/* 1. Borda de seleção (se selecionado) */}
  {isSelected && (
    <rect
      className="selection-box"
      stroke="#3B82F6"
      strokeWidth={2}
      strokeDasharray="4 2"
    />
  )}

  {/* 2. Ícone do equipamento */}
  <foreignObject width={width} height={height}>
    <EquipmentIconWrapper
      tipo={equipment.tipo}
      color={themeColors.iconColor}
    />
  </foreignObject>

  {/* 3. Label (nome ou tag) */}
  <text
    x={labelX}
    y={labelY}
    textAnchor={textAnchor}
  >
    {equipment.tag || equipment.nome}
  </text>

  {/* 4. Portas de conexão (visível em modo edit) */}
  {editor.mode === 'edit' && (
    <g className="ports">
      <circle cx={topX} cy={topY} r={4} onClick={() => handlePortClick('top')} />
      <circle cx={bottomX} cy={bottomY} r={4} onClick={() => handlePortClick('bottom')} />
      <circle cx={leftX} cy={leftY} r={4} onClick={() => handlePortClick('left')} />
      <circle cx={rightX} cy={rightY} r={4} onClick={() => handlePortClick('right')} />
    </g>
  )}
</g>
```

**Interações:**
```typescript
// Modo VIEW: Apenas seleciona
if (editor.mode === 'view') {
  selectEquipamento(id);
  return;
}

// Modo EDIT: Inicia drag
if (editor.mode === 'edit') {
  const offset = { x: mouseX - equipmentX, y: mouseY - equipmentY };
  startDraggingEquipamento(id, offset);
}

// Modo CONNECTING: Porta já foi clicada, aguardando segunda porta
```

---

## 4. DiagramConnections.tsx - Linhas

**O que faz:** Renderiza todas as conexões ortogonais

**Props:**
```typescript
interface DiagramConnectionsProps {
  visualConnections: VisualConnection[];  // Conexões com rotas calculadas
  barramentos: Barramento[];              // Barramentos detectados
}
```

**Estrutura:**
```tsx
<g className="diagram-connections">
  {/* Conexões normais (ponto a ponto) */}
  <g className="normal-connections">
    {conexoesNormais.map(conexao => (
      <path
        key={conexao.id}
        d={pointsToSvgPathRounded(conexao.pontos, 4)}
        stroke={themeColors.connectionLine}
        strokeWidth={2}
        fill="none"
      />
    ))}
  </g>

  {/* Barramentos (linha horizontal + conexões) */}
  <g className="barramentos">
    {barramentos.map(barramento => (
      <g key={barramento.id}>
        {/* Linha horizontal do barramento */}
        <path
          d={`M ${barramento.xInicio},${barramento.y} L ${barramento.xFim},${barramento.y}`}
          stroke={themeColors.barramentoColor}
          strokeWidth={3}
        />

        {/* Conexões que saem do barramento */}
        {barramento.conexoes.map(renderConexao)}
      </g>
    ))}
  </g>
</g>
```

**Algoritmo de Renderização:**
```typescript
1. Separar conexões em dois grupos:
   - Conexões normais (não fazem parte de barramento)
   - Conexões de barramento (3+ saem do mesmo ponto)

2. Para cada conexão normal:
   - Já tem pontos calculados (Point[])
   - Converter para path SVG com cantos arredondados
   - Renderizar <path>

3. Para cada barramento:
   - Renderizar linha horizontal
   - Renderizar conexões individuais que conectam ao barramento
```

---

## 5. EquipmentIconFactory.tsx - Ícones

**O que faz:** Factory Pattern para ícones de equipamentos

**Estrutura:**
```typescript
// Mapa de tipos → componentes
const ICON_MAP: Record<string, IconComponent> = {
  INVERSOR_FRONIUS: InversorIcon,
  INVERSOR_GROWATT: InversorIcon,
  MEDIDOR: MedidorIcon,
  MEDIDOR_ENERGIA: MedidorIcon,
  TRANSFORMADOR: TransformadorIcon,
  QGBT: QGBTIcon,
  EQUIPAMENTO: MedidorIcon,  // Fallback genérico
  // ... 40+ tipos
};

// Wrapper que seleciona o ícone correto
export function EquipmentIconWrapper({ tipo, width, height, color }) {
  const tipoUpper = tipo.toUpperCase();
  const IconComponent = ICON_MAP[tipoUpper] || ICON_MAP.EQUIPAMENTO;

  return (
    <div style={{ width, height, color }}>
      <IconComponent width={width} height={height} color={color} />
    </div>
  );
}
```

**Como adicionar novo ícone:**
```typescript
// 1. Criar componente
export const NovoIcon = ({ width, height, color }) => (
  <svg width={width} height={height} viewBox="0 0 100 100">
    <path d="..." fill={color} />
  </svg>
);

// 2. Registrar no mapa
const ICON_MAP = {
  // ...
  NOVO_TIPO: NovoIcon,
};
```

---

## 6. EditorToolbar.tsx - Barra de edição

> **2026-09-23:** o painel lateral (EditorSidebar: Ferramenta / Adicionar / Equipamentos da unidade / No Diagrama / Atalhos) foi substituído por uma **segunda linha da barra**, no mesmo formato da barra de edição do Diagrama IoT: `Modo:` Mover/Selecionar · `Adicionar:` select agrupado (Novo equipamento → abre o cadastro com o tipo; Já cadastrados na unidade → entra direto) · ações da seleção (Editar/Excluir) · contadores · popover de Atalhos. A lista "No Diagrama" deixou de existir: editar = duplo-clique no símbolo, apagar = selecionar + Del/Excluir. O texto abaixo descreve a versão antiga.

**O que faz:** Sidebar com botões, lista de equipamentos e atalhos

**Estrutura:**
```tsx
<div className="editor-sidebar">
  {/* Seção de adicionar */}
  <div className="sidebar-section">
    <h3>Adicionar Equipamento</h3>
    <Button onClick={onCreateEquipment}>
      <Zap /> Novo Equipamento
    </Button>
  </div>

  {/* Lista de equipamentos */}
  <div className="sidebar-section">
    <h3>Equipamentos ({equipamentos.length})</h3>
    <div className="equipment-list">
      {equipamentos.map(eq => (
        <div
          className={`equipment-item ${isSelected ? 'selected' : ''}`}
          onClick={() => selectEquipamento(eq.id)}
        >
          <span>{eq.nome}</span>
          <div className="actions">
            <button onClick={() => onEditEquipment(eq)}>✏️</button>
            <button onClick={() => onDeleteEquipment(eq.id)}>🗑️</button>
          </div>
        </div>
      ))}
    </div>
  </div>

  {/* Atalhos de teclado */}
  <div className="sidebar-section">
    <h3>Atalhos</h3>
    <div className="shortcuts">
      <div>Ctrl + S → Salvar</div>
      <div>Del → Deletar</div>
      <div>Esc → Limpar seleção</div>
    </div>
  </div>
</div>
```

---

## 7. useDiagramStore.ts - Estado Global

**O que faz:** Zustand store com todo o estado do diagrama

**API Pública:**
```typescript
const store = useDiagramStore();

// === CRUD Diagrama ===
store.loadDiagrama(id);           // Carrega do backend
store.createDiagrama(unidadeId, nome, descricao);
store.saveLayout();               // Salva no backend
store.clearDiagrama();

// === CRUD Equipamentos ===
store.addEquipamento(equipment);
store.removeEquipamento(id);
store.updateEquipamentoPosition(id, x, y);

// === CRUD Conexões ===
store.addConexao(conexao);
store.removeConexao(id);
store.recalcularRotas();          // Recalcula visual connections

// === Viewport ===
store.setZoom(scale);
store.setPan(x, y);
store.startViewportDrag();
store.endViewportDrag();

// === Editor ===
store.setEditorMode('view' | 'edit' | 'connecting');
store.selectEquipamento(id);
store.clearSelection();
store.startDraggingEquipamento(id, offset);
store.endDraggingEquipamento();
store.startConnecting(equipamentoId, porta);
store.finishConnecting(equipamentoId, porta);
```

**Uso em Componentes:**
```typescript
// Leitura de estado
const equipamentos = useDiagramStore(state => state.equipamentos);
const viewport = useDiagramStore(state => state.viewport);

// Chamada de ações
const addEquipamento = useDiagramStore(state => state.addEquipamento);
const setZoom = useDiagramStore(state => state.setZoom);

// Uso
addEquipamento(newEquipment);
setZoom(1.5);
```

---

## 8. orthogonalRouting.ts - Algoritmo de Roteamento

**O que faz:** Funções puras para calcular rotas ortogonais

**API:**
```typescript
// Calcula ponto absoluto de uma porta
const portPoint = getPortPoint(equipment, 'top');
// Retorna: { point: { x: 960, y: 540 }, direction: 'up' }

// Calcula rota completa entre dois equipamentos
const pontos = calculateOrthogonalRoute(
  origem, 'bottom',    // Equipamento origem + porta
  destino, 'top'       // Equipamento destino + porta
);
// Retorna: Point[] = [{ x, y }, { x, y }, ...]

// Converte pontos para path SVG
const path = pointsToSvgPathRounded(pontos, 4);
// Retorna: "M 960,540 L 960,600 Q 960,620 980,620 L 1020,620"

// Converte coordenadas
const pixels = gridToPixels(10);   // 10 grid units = 400px
const grid = pixelsToGrid(400);    // 400px = 10 grid units
```

**Tipos de Rotas:**
```
L-shape (1 curva):
  Origem
    |
    |
    +------ Destino

Z-shape (2 curvas):
  Origem
    |
    +------+
           |
         Destino

U-shape (direções opostas):
  Origem
    |
    +------+
           |
           +------ Destino
```

---

## 9. barramentoDetector.ts - Detecção de Barramentos

**O que faz:** Detecta quando 3+ conexões formam barramento

**API:**
```typescript
// Converte conexões raw para visual connections
const visualConnections = convertToVisualConnections(
  conexoes,      // Connection[] do backend
  equipamentos   // Equipment[] do backend
);
// Retorna: VisualConnection[] com pontos calculados

// Detecta barramentos
const barramentos = detectBarramentos(conexoes, equipamentos);
// Retorna: Barramento[] com linha horizontal calculada

// Gera path SVG do barramento
const path = getBarramentoPath(barramento);
// Retorna: "M 800,340 L 1200,340"
```

**Algoritmo:**
```
1. Agrupar conexões por (equipamentoOrigemId + portaOrigem)
2. Para cada grupo:
   - Se grupo.length >= 3:
     - É um barramento!
     - Calcular Y da linha horizontal
     - Calcular X mínimo e máximo
     - Recalcular rotas das conexões para passarem pelo barramento
3. Retornar lista de barramentos detectados
```

---

## 10. diagramConstants.ts - Constantes

**O que contém:** Todos os valores fixos do sistema

```typescript
// Canvas
export const CANVAS = {
  WIDTH: 1920,
  HEIGHT: 1080,
};

// Grid
export const GRID = {
  SIZE: 40,  // pixels
};

// Viewport
export const VIEWPORT = {
  MIN_SCALE: 0.1,
  MAX_SCALE: 2.0,
  ZOOM_STEP: 0.1,
};

// Dimensões de equipamentos (em grid units)
export const EQUIPMENT_SIZES = {
  INVERSOR: { width: 2, height: 2 },      // 80x80px
  MEDIDOR: { width: 1.5, height: 1.5 },   // 60x60px
  TRANSFORMADOR: { width: 3, height: 3 }, // 120x120px
  DEFAULT: { width: 2, height: 2 },
};

// Conexões
export const CONNECTION = {
  STROKE_WIDTH: 2,
  CORNER_RADIUS: 4,
  BARRAMENTO_OFFSET: 40,
  BARRAMENTO_MIN_CONNECTIONS: 3,
};

// Temas
export const THEMES = {
  light: {
    background: '#FFFFFF',
    iconColor: '#1F2937',
    connectionLine: '#FFFFFF',
  },
  dark: {
    background: '#1A1A1A',
    iconColor: '#F3F4F6',
    connectionLine: '#CCCCCC',
  },
};
```

---

## 📊 Resumo de Responsabilidades

| Componente | Responsabilidade | Renderiza | Gerencia Estado |
|------------|------------------|-----------|-----------------|
| DiagramV2 | Orquestração | ✅ Container | ❌ Delega ao Zustand |
| DiagramViewport | Canvas SVG | ✅ SVG + Grid | ✅ Viewport local |
| EquipmentNode | Equipamento | ✅ Ícone + Label | ❌ Lê do Zustand |
| DiagramConnections | Linhas | ✅ Paths SVG | ❌ Recebe props |
| EditorToolbar | Ferramentas | ✅ Botões + Lista | ❌ Lê do Zustand |
| EquipmentIconFactory | Ícones | ✅ SVG icons | ❌ Stateless |
| useDiagramStore | Estado global | ❌ Não renderiza | ✅ Single source of truth |
| orthogonalRouting | Algoritmos | ❌ Funções puras | ❌ Stateless |
| barramentoDetector | Detecção | ❌ Funções puras | ❌ Stateless |
| diagramConstants | Configuração | ❌ Apenas dados | ❌ Readonly |

---

## 🎯 Fluxo de Dados Simplificado

```
User Action
    ↓
Component Event Handler
    ↓
Zustand Action (useDiagramStore)
    ↓
Utils (cálculos puros)
    ↓
Store State Updated
    ↓
Components Re-render (automático)
```

**Exemplo - Arrastar Equipamento:**
```
User arrasta equipamento
    ↓
DiagramViewport.handleMouseMove
    ↓
store.updateEquipamentoPosition(id, x, y)
    ↓
store.recalcularRotas() (recalcula conexões)
    ↓
State atualizado: equipamentos[x].posicaoX/Y
    ↓
EquipmentNode re-renderiza
DiagramConnections re-renderiza
```

---

**Mantido por:** Equipe de Desenvolvimento
**Versão:** V2.0
**Data:** 2026-02-03
