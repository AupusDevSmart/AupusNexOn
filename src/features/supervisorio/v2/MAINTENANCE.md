# Guia de Manutenção - Diagrama V2

## 🔧 Como Fazer Modificações Comuns

Este guia mostra **exatamente onde modificar** para cada tipo de mudança comum.

---

## 📝 Sumário Rápido

| Tarefa | Arquivo(s) a Modificar | Dificuldade |
|--------|------------------------|-------------|
| [Adicionar novo tipo de equipamento](#1-adicionar-novo-tipo-de-equipamento) | `icons/`, `EquipmentIconFactory.tsx`, `diagramConstants.ts` | 🟢 Fácil |
| [Mudar cores do tema](#2-mudar-cores-do-tema) | `diagramConstants.ts` | 🟢 Fácil |
| [Adicionar novo modo de editor](#3-adicionar-novo-modo-de-editor) | `diagram.types.ts`, `useDiagramStore.ts`, `DiagramV2.tsx` | 🟡 Médio |
| [Modificar algoritmo de roteamento](#4-modificar-algoritmo-de-roteamento) | `orthogonalRouting.ts` | 🔴 Difícil |
| [Adicionar novo atalho de teclado](#5-adicionar-novo-atalho-de-teclado) | `DiagramV2.tsx` | 🟢 Fácil |
| [Mudar tamanho do grid](#6-mudar-tamanho-do-grid) | `diagramConstants.ts` | 🟢 Fácil |
| [Adicionar validação de conexão](#7-adicionar-validação-de-conexão) | `useDiagramStore.ts` | 🟡 Médio |
| [Exportar diagrama como imagem](#8-exportar-diagrama-como-imagem) | `DiagramV2.tsx` (nova feature) | 🟡 Médio |

---

## 1. Adicionar Novo Tipo de Equipamento

**Cenário:** Preciso adicionar um novo tipo "GERADOR_DIESEL" ao diagrama.

### Passo 1: Criar o Ícone SVG

**Arquivo:** `components/icons/GeradorIcon.tsx`

```typescript
import React from 'react';

interface IconProps {
  width: number;
  height: number;
  color: string;
}

export const GeradorIcon: React.FC<IconProps> = ({ width, height, color }) => {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Corpo do gerador */}
      <rect
        x="20"
        y="30"
        width="60"
        height="40"
        stroke={color}
        strokeWidth="2"
        fill="none"
      />

      {/* Motor (círculo) */}
      <circle
        cx="50"
        cy="50"
        r="15"
        stroke={color}
        strokeWidth="2"
        fill="none"
      />

      {/* Símbolo ~ (alternada) */}
      <path
        d="M 40,50 Q 45,45 50,50 Q 55,55 60,50"
        stroke={color}
        strokeWidth="2"
        fill="none"
      />

      {/* Base */}
      <line
        x1="20"
        y1="70"
        x2="80"
        y2="70"
        stroke={color}
        strokeWidth="3"
      />
    </svg>
  );
};
```

### Passo 2: Registrar no Factory

**Arquivo:** `components/icons/EquipmentIconFactory.tsx`

```diff
  import { InversorIcon } from './InversorIcon';
  import { MedidorIcon } from './MedidorIcon';
+ import { GeradorIcon } from './GeradorIcon';

  const ICON_MAP: Record<string, IconComponent> = {
    // ... ícones existentes ...

+   // Geradores
+   GERADOR: GeradorIcon,
+   GERADOR_DIESEL: GeradorIcon,
+   GERADOR_GAS: GeradorIcon,

    // Equipamento genérico (fallback)
    EQUIPAMENTO: MedidorIcon,
  };
```

### Passo 3: Definir Dimensões

**Arquivo:** `utils/diagramConstants.ts`

```diff
  export const EQUIPMENT_SIZES = {
    // ... tamanhos existentes ...

+   // Geradores
+   GERADOR: { width: 3, height: 2.5 },        // 120x100px
+   GERADOR_DIESEL: { width: 3, height: 2.5 },
+   GERADOR_GAS: { width: 3, height: 2.5 },

    // Padrão para tipos desconhecidos
    DEFAULT: { width: 2, height: 2 },
  };
```

### Passo 4: Exportar Ícone (opcional)

**Arquivo:** `components/icons/index.ts`

```diff
  export { InversorIcon } from './InversorIcon';
  export { MedidorIcon } from './MedidorIcon';
+ export { GeradorIcon } from './GeradorIcon';
  export { EquipmentIconWrapper } from './EquipmentIconFactory';
```

**Pronto!** Agora o tipo "GERADOR_DIESEL" será automaticamente reconhecido e renderizado.

---

## 2. Mudar Cores do Tema

**Cenário:** Quero mudar a cor de fundo do tema escuro para um cinza mais claro.

**Arquivo:** `utils/diagramConstants.ts`

```diff
  export const CANVAS = {
    WIDTH: 1920,
    HEIGHT: 1080,
    BACKGROUND_LIGHT: '#FFFFFF',
-   BACKGROUND_DARK: '#1A1A1A',
+   BACKGROUND_DARK: '#2A2A2A',  // Cinza mais claro
  } as const;

  export const THEMES: Record<Theme, ThemeColors> = {
    light: {
-     background: CANVAS.BACKGROUND_LIGHT,
+     background: '#F5F5F5',  // Cinza muito claro
      gridLine: GRID.COLOR_LIGHT,
      connectionLine: CONNECTION.COLOR_LIGHT,
      iconColor: '#1F2937',
      labelColor: LABEL.COLOR_LIGHT,
      // ...
    },
    dark: {
      background: CANVAS.BACKGROUND_DARK,
      gridLine: GRID.COLOR_DARK,
-     connectionLine: CONNECTION.COLOR_DARK,
+     connectionLine: '#DDDDDD',  // Mais claro para melhor contraste
      // ...
    },
  };
```

**Resultado:** Tema atualizado imediatamente (hot reload).

---

## 3. Adicionar Novo Modo de Editor

**Cenário:** Quero adicionar um modo "group" para criar grupos visuais (boxes tracejados).

### Passo 1: Atualizar Tipos

**Arquivo:** `types/diagram.types.ts`

```diff
- export type EditorMode = 'view' | 'edit' | 'connecting';
+ export type EditorMode = 'view' | 'edit' | 'connecting' | 'group';

  export interface EditorState {
    mode: EditorMode;
    selectedEquipmentIds: string[];
    selectedConnectionIds: string[];

    // Modo de conexão
    connectingFrom: {
      equipamentoId: string;
      porta: PortPosition;
    } | null;

+   // Modo de grupo (novo)
+   groupStart: Point | null;     // Ponto inicial do drag
+   groupEnd: Point | null;        // Ponto final do drag

    // ... resto
  }
```

### Passo 2: Adicionar Ações ao Store

**Arquivo:** `hooks/useDiagramStore.ts`

```diff
  interface DiagramActions {
    // ... ações existentes ...

+   // Modo de grupo
+   startCreatingGroup: (point: Point) => void;
+   updateGroupDrag: (point: Point) => void;
+   finishCreatingGroup: () => void;
+   cancelGroupCreation: () => void;
  }

  // Implementação
  export const useDiagramStore = create<DiagramState & DiagramActions>()(
    devtools((set, get) => ({
      // ... estado inicial ...

+     startCreatingGroup: (point) => {
+       set({
+         editor: {
+           ...get().editor,
+           mode: 'group',
+           groupStart: point,
+           groupEnd: null,
+         },
+       });
+     },
+
+     updateGroupDrag: (point) => {
+       const { editor } = get();
+       if (editor.mode !== 'group' || !editor.groupStart) return;
+
+       set({
+         editor: {
+           ...editor,
+           groupEnd: point,
+         },
+       });
+     },
+
+     finishCreatingGroup: () => {
+       const { editor, grupos } = get();
+       if (!editor.groupStart || !editor.groupEnd) return;
+
+       const novoGrupo: Grupo = {
+         id: uuidv4(),
+         nome: 'Novo Grupo',
+         diagramaId: get().diagrama!.id,
+         x: Math.min(editor.groupStart.x, editor.groupEnd.x),
+         y: Math.min(editor.groupStart.y, editor.groupEnd.y),
+         largura: Math.abs(editor.groupEnd.x - editor.groupStart.x),
+         altura: Math.abs(editor.groupEnd.y - editor.groupStart.y),
+         createdAt: new Date(),
+         updatedAt: new Date(),
+         deletedAt: null,
+       };
+
+       set({
+         grupos: [...grupos, novoGrupo],
+         editor: {
+           ...editor,
+           mode: 'edit',
+           groupStart: null,
+           groupEnd: null,
+         },
+         isDirty: true,
+       });
+     },
    }))
  );
```

### Passo 3: Adicionar Botão na Sidebar

**Arquivo:** `components/EditorSidebar.tsx`

```diff
+ import { Box } from 'lucide-react';

  export const EditorSidebar = ({ ... }) => {
+   const setEditorMode = useDiagramStore(state => state.setEditorMode);

    return (
      <div className="editor-sidebar">
        <div className="sidebar-section">
          <h3>Ferramentas</h3>

+         <Button
+           onClick={() => setEditorMode('group')}
+           variant={editor.mode === 'group' ? 'default' : 'outline'}
+         >
+           <Box className="mr-2 h-4 w-4" />
+           Criar Grupo
+         </Button>
        </div>
      </div>
    );
  };
```

### Passo 4: Implementar Visualização do Grupo sendo criado

**Arquivo:** `DiagramV2.tsx`

```tsx
{/* Renderizar preview do grupo sendo criado */}
{editor.mode === 'group' && editor.groupStart && editor.groupEnd && (
  <rect
    x={Math.min(editor.groupStart.x, editor.groupEnd.x)}
    y={Math.min(editor.groupStart.y, editor.groupEnd.y)}
    width={Math.abs(editor.groupEnd.x - editor.groupStart.x)}
    height={Math.abs(editor.groupEnd.y - editor.groupStart.y)}
    fill="none"
    stroke="#3B82F6"
    strokeWidth={2}
    strokeDasharray="8 4"
    opacity={0.5}
  />
)}
```

**Pronto!** Novo modo "group" implementado.

---

## 4. Modificar Algoritmo de Roteamento

**Cenário:** Quero que conexões evitem passar por cima de outros equipamentos.

**Arquivo:** `utils/orthogonalRouting.ts`

### Antes:
```typescript
export const calculateOrthogonalRoute = (
  origem: Equipment,
  portaOrigem: PortPosition,
  destino: Equipment,
  portaDestino: PortPosition
): Point[] => {
  const start = getPortPoint(origem, portaOrigem);
  const end = getPortPoint(destino, portaDestino);

  const pontos: Point[] = [start.point];

  // Lógica simples de L-shape
  pontos.push({ x: start.point.x, y: end.point.y });
  pontos.push(end.point);

  return pontos;
};
```

### Depois (com detecção de colisão):
```typescript
export const calculateOrthogonalRoute = (
  origem: Equipment,
  portaOrigem: PortPosition,
  destino: Equipment,
  portaDestino: PortPosition,
  todosEquipamentos?: Equipment[]  // Novo parâmetro opcional
): Point[] => {
  const start = getPortPoint(origem, portaOrigem);
  const end = getPortPoint(destino, portaDestino);

  const pontos: Point[] = [start.point];

  // Tentar rota direta primeiro
  const rotaDireta = calcularRotaDireta(start, end);

  // Verificar se rota passa por cima de equipamentos
  if (todosEquipamentos && temColisao(rotaDireta, todosEquipamentos, origem, destino)) {
    // Se sim, tentar rota alternativa
    const rotaAlternativa = calcularRotaAlternativa(start, end, todosEquipamentos);
    pontos.push(...rotaAlternativa);
  } else {
    // Se não, usar rota direta
    pontos.push(...rotaDireta);
  }

  pontos.push(end.point);

  return pontos;
};

// Função auxiliar para detectar colisão
function temColisao(
  pontos: Point[],
  equipamentos: Equipment[],
  origem: Equipment,
  destino: Equipment
): boolean {
  for (let i = 0; i < pontos.length - 1; i++) {
    const p1 = pontos[i];
    const p2 = pontos[i + 1];

    for (const eq of equipamentos) {
      // Ignorar origem e destino
      if (eq.id === origem.id || eq.id === destino.id) continue;

      // Verificar se linha intersecta equipamento
      if (lineIntersectsEquipment(p1, p2, eq)) {
        return true;  // Colisão detectada!
      }
    }
  }

  return false;
}
```

**Atenção:** Também é necessário atualizar a chamada em `barramentoDetector.ts` para passar os equipamentos.

---

## 5. Adicionar Novo Atalho de Teclado

**Cenário:** Quero adicionar Ctrl+Z para undo (desfazer).

**Arquivo:** `DiagramV2.tsx`

```diff
  const handleKeyDown = (e: KeyboardEvent) => {
    // Ctrl+S para salvar
    if (e.ctrlKey && e.key === 's') {
      e.preventDefault();
      handleSave();
    }

+   // Ctrl+Z para undo
+   if (e.ctrlKey && e.key === 'z') {
+     e.preventDefault();
+     handleUndo();  // Implementar função de undo
+   }
+
+   // Ctrl+Y para redo
+   if (e.ctrlKey && e.key === 'y') {
+     e.preventDefault();
+     handleRedo();  // Implementar função de redo
+   }

    // Del para deletar selecionado
    if ((e.key === 'Delete' || e.key === 'Del') && selectedIds.length > 0) {
      e.preventDefault();
      selectedIds.forEach(id => handleDeleteEquipment(id));
      clearSelection();
    }

    // ... resto dos atalhos
  };
```

**Atualizar sidebar com novo atalho:**

```diff
  <div className="shortcuts-list">
    <div className="shortcut-item">Ctrl + S → Salvar</div>
+   <div className="shortcut-item">Ctrl + Z → Desfazer</div>
+   <div className="shortcut-item">Ctrl + Y → Refazer</div>
    <div className="shortcut-item">Del → Deletar</div>
    <div className="shortcut-item">Esc → Limpar seleção</div>
  </div>
```

---

## 6. Mudar Tamanho do Grid

**Cenário:** Quero mudar o grid de 40px para 20px (mais fino).

**Arquivo:** `utils/diagramConstants.ts`

```diff
  export const GRID = {
-   SIZE: 40,  // Tamanho da célula do grid (pixels)
+   SIZE: 20,  // Tamanho da célula do grid (pixels) - GRID MAIS FINO
    COLOR_LIGHT: '#E5E5E5',
    COLOR_DARK: '#2A2A2A',
    SNAP_ENABLED: true,
  } as const;
```

**Atenção:** Isso afetará:
- Tamanho visual de todos os equipamentos (serão menores)
- Snap to grid (mais preciso)
- Cálculos de posição (pixels ↔ grid)

**Recomendação:** Se mudar o tamanho do grid, considere ajustar também os tamanhos dos equipamentos proporcionalmente.

---

## 7. Adicionar Validação de Conexão

**Cenário:** Não permitir conectar duas portas "bottom" diretamente (validação de regra de negócio).

**Arquivo:** `hooks/useDiagramStore.ts`

```diff
  finishConnecting: (equipamentoId: string, porta: PortPosition) => {
    const { editor, equipamentos, conexoes } = get();

    if (!editor.connectingFrom) return;

+   // Validação: Não permitir bottom → bottom
+   if (editor.connectingFrom.porta === 'bottom' && porta === 'bottom') {
+     toast({
+       title: 'Conexão inválida',
+       description: 'Não é possível conectar duas portas "bottom" diretamente.',
+       variant: 'destructive',
+     });
+
+     // Cancelar conexão
+     set({
+       editor: {
+         ...editor,
+         mode: 'edit',
+         connectingFrom: null,
+       },
+     });
+     return;
+   }

+   // Validação: Não permitir conexão duplicada
+   const conexaoExistente = conexoes.find(c =>
+     c.equipamentoOrigemId === editor.connectingFrom!.equipamentoId &&
+     c.equipamentoDestinoId === equipamentoId &&
+     c.portaOrigem === editor.connectingFrom!.porta &&
+     c.portaDestino === porta
+   );
+
+   if (conexaoExistente) {
+     toast({
+       title: 'Conexão já existe',
+       description: 'Essa conexão já foi criada.',
+       variant: 'destructive',
+     });
+     return;
+   }

    // Criar nova conexão
    const novaConexao: Connection = { ... };

    // ... resto da lógica
  };
```

---

## 8. Exportar Diagrama como Imagem

**Cenário:** Quero adicionar um botão "Exportar PNG" que salva o diagrama como imagem.

### Passo 1: Instalar Biblioteca (opcional)

```bash
npm install html-to-image
```

### Passo 2: Adicionar Função de Exportação

**Arquivo:** `DiagramV2.tsx`

```typescript
import { toPng } from 'html-to-image';

const handleExportPNG = async () => {
  const svgElement = document.querySelector('.diagram-viewport-container svg');

  if (!svgElement) {
    toast({
      title: 'Erro',
      description: 'Elemento SVG não encontrado',
      variant: 'destructive',
    });
    return;
  }

  try {
    // Converter SVG para PNG
    const dataUrl = await toPng(svgElement as HTMLElement, {
      cacheBust: true,
      backgroundColor: themeColors.background,
    });

    // Download automático
    const link = document.createElement('a');
    link.download = `diagrama-${diagrama?.nome || 'sem-nome'}-${Date.now()}.png`;
    link.href = dataUrl;
    link.click();

    toast({
      title: 'Sucesso',
      description: 'Diagrama exportado com sucesso!',
    });
  } catch (err) {
    console.error('Erro ao exportar:', err);
    toast({
      title: 'Erro',
      description: 'Erro ao exportar diagrama',
      variant: 'destructive',
    });
  }
};
```

### Passo 3: Adicionar Botão

**Arquivo:** `components/EditorSidebar.tsx`

```tsx
import { Download } from 'lucide-react';

<div className="sidebar-section">
  <h3>Ações</h3>

  <Button onClick={handleExportPNG} variant="outline">
    <Download className="mr-2 h-4 w-4" />
    Exportar PNG
  </Button>
</div>
```

---

## 🧪 Testando Modificações

### Desenvolvimento Local

```bash
# Iniciar servidor de desenvolvimento
npm run dev

# Em outro terminal - rodar testes (se existirem)
npm run test

# Build de produção
npm run build
```

### Checklist Antes de Commit

- [ ] Build sem erros (`npm run build`)
- [ ] Testes passando (se houver)
- [ ] Código formatado (Prettier/ESLint)
- [ ] Funcionalidade testada manualmente
- [ ] Sem console.log desnecessários
- [ ] Tipos TypeScript corretos
- [ ] Documentação atualizada (se necessário)

---

## 🐛 Debugging Comum

### Problema: Equipamento não aparece

**Checklist:**
1. ✅ Coordenadas válidas? (não NaN)
2. ✅ Tipo de equipamento tem ícone registrado?
3. ✅ Tamanho definido em EQUIPMENT_SIZES?
4. ✅ Equipamento está dentro do canvas (0-1920, 0-1080)?

**Como debug:**
```typescript
console.log('Equipment:', equipment);
console.log('Port point:', getPortPoint(equipment, 'top'));
console.log('Icon:', ICON_MAP[equipment.tipo.toUpperCase()]);
```

### Problema: Conexão com erro "NaN"

**Checklist:**
1. ✅ Ambos equipamentos têm coordenadas válidas?
2. ✅ Portas especificadas são válidas? (top/bottom/left/right)
3. ✅ Equipamentos existem no array?

**Como debug:**
```typescript
console.log('Origem:', origem);
console.log('Destino:', destino);
console.log('Pontos calculados:', calculateOrthogonalRoute(...));
```

### Problema: Drag não funciona

**Checklist:**
1. ✅ Modo do editor é 'edit'?
2. ✅ `updateEquipamentoPosition` está sendo chamado?
3. ✅ Conversão pixels → grid está correta?

**Como debug:**
```typescript
// No handleMouseMove
console.log('Dragging ID:', editor.draggingEquipmentId);
console.log('Mouse pos:', mouseX, mouseY);
console.log('Grid pos:', gridX, gridY);
```

---

## 📚 Recursos Adicionais

- **Arquitetura Completa:** Ver `ARCHITECTURE.md`
- **Guia de Componentes:** Ver `COMPONENTS.md`
- **Zustand Docs:** https://github.com/pmndrs/zustand
- **SVG Reference:** https://developer.mozilla.org/en-US/docs/Web/SVG

---

**Mantido por:** Equipe de Desenvolvimento
**Última atualização:** 2026-02-03
