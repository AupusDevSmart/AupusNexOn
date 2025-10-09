# Junction Nodes - Nós de Junção

## Visão Geral

Os Junction Nodes permitem conectar múltiplos equipamentos a uma mesma linha/barramento, similar ao comportamento de diagramas unifilares reais. Em vez de conectar equipamentos diretamente uns aos outros, você pode criar pontos de junção em linhas existentes.

## Como Usar

### 1. Criar um Junction Node

Para adicionar um junction node a uma linha existente:

1. Entre no **Modo de Edição**
2. Passe o mouse sobre uma linha (edge) existente
3. Pressione **Ctrl + Click** na linha onde deseja criar o junction
4. Um pequeno círculo azul aparecerá no ponto clicado

### 2. Conectar Equipamentos ao Junction Node

Após criar um junction node:

1. Selecione a ferramenta **Conectar** (ícone de link)
2. Clique em uma das portas (pontos verdes) do **equipamento** que deseja conectar
3. Passe o mouse sobre o junction node - as portas disponíveis aparecerão
4. Clique em uma das portas do junction node para completar a conexão

### 3. Mover Junction Nodes

Junction nodes podem ser movidos como qualquer outro componente:

1. No modo de edição, clique e arraste o junction node
2. As conexões se ajustam automaticamente

### 4. Remover Junction Nodes

Para remover um junction node:

1. Simplesmente delete-o como qualquer outro componente
2. As conexões serão automaticamente refeitas entre os componentes originais

## Exemplo de Uso

**Cenário**: Conectar A966 e M300 à linha entre Chave Fusível e Disjuntor

1. Conecte inicialmente: `Chave Fusível → Disjuntor`
2. **Ctrl + Click** na linha entre eles para criar um junction
3. Conecte: `A966 → Junction Node`
4. Conecte: `M300 → Junction Node`

Resultado: Ambos equipamentos estão conectados ao mesmo ponto da linha principal.

## Arquitetura Técnica

### Componentes Criados

1. **JunctionNode.tsx** (`src/features/supervisorio/components/JunctionNode.tsx`)
   - Componente visual do nó de junção
   - Círculo pequeno (5px de raio) com handles para conexão
   - Suporta drag & drop
   - Mostra portas quando em modo de conexão

2. **junctionHelpers.ts** (`src/features/supervisorio/utils/junctionHelpers.ts`)
   - Funções auxiliares para gerenciar junctions
   - `createJunctionNode()`: Cria um novo junction
   - `splitConnectionWithJunction()`: Divide uma conexão em duas
   - `detectEdgeClick()`: Detecta cliques próximos a linhas
   - `calculateJunctionPositionOnLine()`: Calcula posição exata na linha
   - `removeJunctionAndReconnect()`: Remove junction e reconecta

### Estrutura de Dados

```typescript
interface JunctionNodeData {
  id: string;              // ID único: "junction-{timestamp}-{count}"
  tipo: "JUNCTION";        // Tipo identificador
  nome: string;            // Nome display: "Junction {N}"
  posicao: { x: number; y: number }; // Posição em % (0-100)
  status: "NORMAL";
  dados: {
    isJunction: true;      // Flag para identificação rápida
  };
}
```

### Fluxo de Criação

1. **Detecção de Clique**
   - Usuário pressiona Ctrl + Click em uma edge
   - `handleEdgeClick()` é chamado com evento e conexão

2. **Validação**
   - `detectEdgeClick()` verifica se o clique está próximo à linha (threshold: 10px)
   - Se não estiver próximo, ignora o clique

3. **Cálculo de Posição**
   - `calculateJunctionPositionOnLine()` calcula a posição exata na linha
   - Usa interpolação linear entre os dois pontos da conexão
   - Retorna posição em porcentagem (0-100)

4. **Criação do Junction**
   - `createJunctionNode()` cria o objeto do junction com ID único
   - Junction é adicionado ao array de componentes

5. **Divisão da Conexão**
   - `splitConnectionWithJunction()` divide a conexão original em duas:
     - Conexão 1: `ComponenteA → Junction`
     - Conexão 2: `Junction → ComponenteB`
   - Conexão original é removida
   - Novas conexões são adicionadas

6. **Atualização do Diagrama**
   - `updateDiagram()` atualiza componentes e conexões
   - Auto-save persiste as mudanças

### Interação com Sistema Existente

- Junction nodes são tratados como componentes normais
- Aparecem no array `componentes[]` junto com equipamentos
- Suportam todas as operações: mover, conectar, deletar
- Persistem no localStorage junto com o diagrama
- Compatíveis com sistema de undo/redo (quando implementado)

## Características Visuais

### Estados do Junction Node

1. **Normal**: Círculo azul pequeno (5px)
2. **Hover**: Aumenta levemente + mostra label "Junction"
3. **Conectando**: Mostra 4 handles (top, bottom, left, right)
4. **Arrastando**: Segue o cursor + conexões se atualizam

### Portas (Handles)

- 4 portas em todas as direções
- Aparecem apenas quando `isConnecting === true`
- Cor verde para indicar disponibilidade
- Opacity 0 por padrão, aparecem no hover

## Limitações Conhecidas

1. **Número de Conexões**: Não há limite técnico, mas visualmente fica confuso com muitas conexões
2. **Overlapping**: Junctions muito próximos podem sobrepor visualmente
3. **Remoção Automática**: Ao deletar, não há confirmação (comportamento padrão de componentes)

## Melhorias Futuras

- [ ] Snap to grid para posicionamento preciso
- [ ] Atalho de teclado dedicado (ex: 'J' para modo junction)
- [ ] Converter conexões existentes em junctions automaticamente
- [ ] Estilo diferenciado para junctions com muitas conexões
- [ ] Opção de remover junction e manter todas as conexões
- [ ] Visualização de "barramento" quando há 3+ conexões no mesmo junction

## Compatibilidade

- ✅ React 18+
- ✅ TypeScript
- ✅ Tailwind CSS
- ✅ Modo escuro
- ✅ Responsive (adapta ao container)

## Troubleshooting

### Junction não aparece ao clicar
- Verifique se está no modo de edição
- Certifique-se de pressionar Ctrl + Click (não apenas Click)
- Clique mais próximo da linha (threshold: 10px)

### Conexões não se reconectam ao mover
- Verifique se `onJunctionNodeMove` está sendo passado corretamente
- Confira se o junction está sendo atualizado no estado

### Junction não mostra portas
- Verifique se `isConnecting` está true
- Confirme que a ferramenta "Conectar" está ativa
- Passe o mouse sobre o junction para revelar as portas

## Código de Referência

### Exemplo de Uso Programático

```typescript
import {
  createJunctionNode,
  splitConnectionWithJunction
} from '@/features/supervisorio/utils/junctionHelpers';

// Criar junction manualmente
const junctionPosition = { x: 50, y: 50 }; // 50% da largura/altura
const junction = createJunctionNode(junctionPosition, componentes);

// Dividir conexão
const originalConnection = {
  id: 'conn-1',
  from: 'device-1',
  to: 'device-2',
  fromPort: 'right',
  toPort: 'left'
};

const { connection1, connection2 } = splitConnectionWithJunction(
  originalConnection,
  junction.id
);

// Atualizar estado
setComponentes([...componentes, junction]);
setConnections([
  ...connections.filter(c => c.id !== originalConnection.id),
  connection1,
  connection2
]);
```

## Suporte

Para questões ou problemas, consulte:
- Código fonte em `src/features/supervisorio/`
- Logs no console do browser (busque por "Junction")
- Issues no repositório do projeto
