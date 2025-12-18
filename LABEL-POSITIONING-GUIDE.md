# Guia de Posicionamento de Labels de Equipamentos

## 📍 Visão Geral

Sistema que permite configurar visualmente a posição do nome (label) dos equipamentos no diagrama SCADA.

---

## 🎯 Funcionalidades

### **Posições Disponíveis**:
- **TOP** (Acima) - Padrão
- **BOTTOM** (Abaixo)
- **LEFT** (À esquerda)
- **RIGHT** (À direita)

---

## 🖱️ Como Usar

### **1. Editor de Diagramas**

1. Selecione um equipamento no canvas
2. No painel de propriedades (direita), encontre a seção "Posição do Nome"
3. Clique em um dos 4 botões de seta para escolher a posição:

```
      [↑]
  [←] [■] [→]
      [↓]
```

4. O nome do equipamento será reposicionado instantaneamente
5. A posição é salva automaticamente

---

## 💾 Estrutura de Dados

### **Tipo TypeScript**:

```typescript
export type LabelPosition = 'top' | 'bottom' | 'left' | 'right';

export interface Equipment {
  id: string;
  type: "m300" | "m160" | "landisE750" | "a966";
  position: { x: number; y: number };
  data: EquipmentData;
  labelPosition?: LabelPosition; // Opcional - padrão: 'top'
}
```

### **Armazenamento**:

O campo `labelPosition` deve ser salvo no banco de dados junto com os outros dados do equipamento.

**Exemplo JSON**:
```json
{
  "id": "eq-001",
  "type": "m300",
  "position": { "x": 100, "y": 200 },
  "labelPosition": "right",
  "data": {
    "name": "Medidor Principal",
    "status": "online"
  }
}
```

---

## 🔧 Arquitetura

### **Componentes Criados**:

#### **1. EquipmentLabel** (`components/equipment/EquipmentLabel.tsx`)

Componente wrapper que posiciona o label ao redor do equipamento.

**Props**:
```typescript
interface EquipmentLabelProps {
  name: string;              // Nome do equipamento
  position?: LabelPosition;  // Posição do label (padrão: 'top')
  children: React.ReactNode; // Componente do equipamento
}
```

**Uso**:
```tsx
<EquipmentLabel name="Medidor 01" position="right">
  <M300Multimeter {...props} />
</EquipmentLabel>
```

**Renderização**:
- **TOP/BOTTOM**: Flexbox vertical (`flex-col`)
- **LEFT/RIGHT**: Flexbox horizontal (`flex-row`)

---

#### **2. Seletor Visual** (PropertiesPanel)

Interface visual com 4 botões em cruz para seleção intuitiva da posição.

**Comportamento**:
- Botão selecionado: `bg-blue-600` (azul)
- Botões não selecionados: `bg-gray-700` (cinza)
- Hover: `hover:bg-gray-600`
- Texto de feedback abaixo mostra posição atual

---

#### **3. Integração no DiagramCanvas**

Método `renderEquipment` atualizado para envolver todos os equipamentos com `EquipmentLabel`:

```tsx
const renderEquipment = (eq: Equipment) => {
  let equipmentComponent = /* ... renderizar equipamento específico ... */;

  return (
    <EquipmentLabel name={eq.data.name} position={eq.labelPosition}>
      {equipmentComponent}
    </EquipmentLabel>
  );
};
```

---

## 🎨 Layout Visual

### **Top (Padrão)**:
```
  ┌──────────────┐
  │ Nome do Equip│
  └──────────────┘
  ┌──────────────┐
  │              │
  │ Equipamento  │
  │              │
  └──────────────┘
```

### **Bottom**:
```
  ┌──────────────┐
  │              │
  │ Equipamento  │
  │              │
  └──────────────┘
  ┌──────────────┐
  │ Nome do Equip│
  └──────────────┘
```

### **Left**:
```
  ┌──────────────┐   ┌──────────────┐
  │ Nome do Equip│   │              │
  └──────────────┘   │ Equipamento  │
                     │              │
                     └──────────────┘
```

### **Right**:
```
  ┌──────────────┐   ┌──────────────┐
  │              │   │ Nome do Equip│
  │ Equipamento  │   └──────────────┘
  │              │
  └──────────────┘
```

---

## ✅ Backend - Salvamento

### **Schema do Banco de Dados**:

Se estiver usando Prisma, adicione o campo opcional:

```prisma
model DiagramEquipment {
  id            String   @id @default(cuid())
  type          String
  positionX     Float
  positionY     Float
  labelPosition String?  @default("top") // NOVO CAMPO
  data          Json
  // ... outros campos
}
```

### **Endpoint de Atualização** (exemplo):

```typescript
// PUT /api/diagrams/:id/equipment/:equipmentId
async updateEquipment(id: string, updates: Partial<Equipment>) {
  return await prisma.diagramEquipment.update({
    where: { id },
    data: {
      labelPosition: updates.labelPosition,
      // ... outros campos
    }
  });
}
```

---

## 🚀 Próximos Passos

### **Para Implementar Salvamento Backend**:

1. Adicionar campo `labelPosition` à tabela de equipamentos do diagrama
2. Atualizar endpoint de atualização de equipamento
3. No `DiagramEditor.tsx`, adicionar handler para salvar mudanças:

```tsx
const handleUpdateEquipment = async (id: string, updates: Partial<Equipment>) => {
  // Atualizar estado local
  setEquipment(prev =>
    prev.map(eq => eq.id === id ? { ...eq, ...updates } : eq)
  );

  // Salvar no backend
  await api.updateEquipmentPosition(diagramId, id, updates);
};
```

---

## 📝 Exemplos de Uso

### **Exemplo 1: Diagrama com múltiplos equipamentos**

```tsx
// Medidor principal no topo
<EquipmentLabel name="Medidor Principal" position="top">
  <M300Multimeter />
</EquipmentLabel>

// Medidor lateral à esquerda
<EquipmentLabel name="Medidor Auxiliar" position="left">
  <M160Multimeter />
</EquipmentLabel>

// Gateway abaixo
<EquipmentLabel name="Gateway IoT" position="bottom">
  <A966Gateway />
</EquipmentLabel>
```

### **Exemplo 2: Mudando posição programaticamente**

```tsx
const changeLabel Position = (equipmentId: string, newPosition: LabelPosition) => {
  onUpdateEquipment(equipmentId, {
    labelPosition: newPosition
  });
};

// Uso
changeLabelPosition("eq-001", "right");
```

---

## 🔍 Debugging

### **Verificar posição atual**:

```tsx
console.log('Label Position:', equipment.labelPosition || 'top (default)');
```

### **Resetar para padrão**:

```tsx
onUpdateEquipment(equipmentId, {
  labelPosition: undefined // ou 'top'
});
```

---

## 📌 Notas Importantes

1. **Padrão**: Se `labelPosition` não estiver definido, usa 'top'
2. **Compatibilidade**: Equipamentos antigos sem labelPosition funcionarão normalmente (padrão top)
3. **Responsividade**: O `EquipmentLabel` se adapta automaticamente ao tamanho do equipamento
4. **Performance**: Não há impacto no desempenho - apenas CSS flexbox
5. **Acessibilidade**: Todos os botões têm `title` com descrição

---

## 🎯 Casos de Uso

### **Quando usar cada posição**:

- **TOP**: Equipamentos isolados, medidores principais
- **BOTTOM**: Equipamentos embaixo de outros, legendas
- **LEFT**: Diagramas com fluxo da direita para esquerda
- **RIGHT**: Diagramas com fluxo da esquerda para direita, labels longos

---

## 🆘 Troubleshooting

### **Label não aparece**:
- Verificar se `name` não está vazio
- Verificar se `EquipmentLabel` está sendo usado
- Checar console para erros de TypeScript

### **Posição não muda**:
- Verificar se `labelPosition` está sendo passado corretamente
- Verificar se `onUpdateEquipment` está sendo chamado
- Checar estado do equipamento com React DevTools

### **Label sobrepõe equipamento**:
- Ajustar `gap` no `EquipmentLabel.tsx` (atualmente `gap-2` e `gap-3`)
- Verificar escala do equipamento (`scale` prop)

---

**Versão**: 1.0
**Data**: 2025-12-17
**Autor**: Sistema de Diagrama SCADA
