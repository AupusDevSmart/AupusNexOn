# Ícones de Equipamentos - Guia de Padronização

## 📋 Visão Geral

Todos os ícones de equipamentos **DEVEM** usar o `IconWrapper` para garantir que qualquer imagem (SVG ou PNG) sempre se ajuste automaticamente ao espaço disponível no diagrama.

## ✅ Como Criar um Novo Ícone

### Template Padrão

```tsx
import React from 'react';
import { IconWrapper } from './IconWrapper';
import meuIcone from '@/assets/images/meu-icone.svg'; // ou .png

interface MeuIconeProps {
  width?: number;
  height?: number;
  color?: string;
  strokeWidth?: number;
  className?: string;
}

export const MeuIcone: React.FC<MeuIconeProps> = ({
  width = 80,
  height = 80,
  className = '',
}) => {
  return (
    <IconWrapper
      src={meuIcone}
      alt="Descrição do ícone"
      width={width}
      height={height}
      className={className}
    />
  );
};
```

## 🎯 Benefícios do IconWrapper

1. **Ajuste Automático**: Qualquer imagem se ajusta ao tamanho configurado (ex: 2x4, 3x3, etc.)
2. **Sem Cortes**: Usa `objectFit: 'contain'` para mostrar a imagem completa
3. **Centralizado**: Imagem sempre centralizada no espaço disponível
4. **Sem Edição de Imagens**: Não precisa editar SVG/PNG para ajustar tamanhos
5. **Consistência**: Todos os ícones funcionam da mesma forma

## 📐 Configurando Tamanho no Diagrama

Os tamanhos são configurados em `diagramConstants.ts`:

```typescript
export const EQUIPMENT_SIZES = {
  // Quadrado
  MEU_EQUIPAMENTO: { width: 2, height: 2 }, // 80x80px

  // Vertical
  CHAVE: { width: 2, height: 4 }, // 80x160px

  // Horizontal
  BARRAMENTO: { width: 4, height: 2 }, // 160x80px
};
```

**O IconWrapper garante que a imagem SEMPRE se ajusta a esses tamanhos automaticamente!**

## ✅ Exemplos Atualizados

- ✅ `ChaveIcon.tsx` - Usa IconWrapper
- ✅ `TransformadorIcon.tsx` - Usa IconWrapper
- ✅ `PivoIcon.tsx` - Usa IconWrapper

## ⚠️ Ícones que Precisam Ser Atualizados

Todos os outros ícones que ainda usam `<img>` diretamente devem ser migrados para usar `IconWrapper`.

## 🚫 NÃO Faça

❌ Não use `<img>` diretamente sem IconWrapper
❌ Não edite SVGs para ajustar tamanhos manualmente
❌ Não use tamanhos fixos hardcoded
❌ Não se preocupe com proporções da imagem original

## ✅ Faça

✅ Sempre use IconWrapper
✅ Configure tamanho apenas em diagramConstants.ts
✅ Use qualquer SVG/PNG sem modificações
✅ Confie no ajuste automático
