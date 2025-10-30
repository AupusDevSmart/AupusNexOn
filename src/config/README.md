# Feature Flags

Este diretório contém a configuração de feature flags da aplicação.

## O que são Feature Flags?

Feature flags (ou feature toggles) são mecanismos que permitem habilitar ou desabilitar funcionalidades da aplicação sem precisar modificar o código ou fazer deploy. São úteis para:

- Ocultar funcionalidades em desenvolvimento
- Fazer lançamentos graduais de features
- A/B testing
- Controle fino sobre o que está disponível em produção

## Como usar

### 1. Configurar uma feature flag

Edite o arquivo `feature-flags.ts` e modifique o objeto `featureFlags`:

```typescript
export const featureFlags: FeatureFlags = {
  enableScada: false,         // SCADA desabilitado
  enableFinanceiro: true,      // Financeiro habilitado
  enableCadastros: true,       // Cadastros habilitado
  enableSupervisorio: true,    // Supervisório habilitado
  enableCOA: true,             // COA habilitado
};
```

### 2. Adicionar uma nova feature flag

1. Adicione a nova propriedade na interface `FeatureFlags`:

```typescript
export interface FeatureFlags {
  enableScada: boolean;
  enableMinhaNovaFeature: boolean; // Nova feature
}
```

2. Configure o valor padrão no objeto `featureFlags`:

```typescript
export const featureFlags: FeatureFlags = {
  enableScada: false,
  enableMinhaNovaFeature: true, // Habilitada por padrão
};
```

### 3. Usar feature flags nos links de navegação

No arquivo `navigation-links.ts`, adicione a propriedade `featureFlag` ao link:

```typescript
{
  key: "minha-feature",
  featureKey: "MinhaFeature",
  featureFlag: "enableMinhaNovaFeature", // Vincula à feature flag
  path: "/minha-feature",
  icon: Activity,
  label: "Minha Nova Feature",
  hint: "Descrição da feature",
}
```

### 4. Usar feature flags no código

```typescript
import { isFeatureEnabled } from '@/config/feature-flags';

// Verificar se uma feature está habilitada
if (isFeatureEnabled('enableMinhaNovaFeature')) {
  // Código executado apenas se a feature estiver habilitada
}
```

## Exemplo prático

Para ocultar a página SCADA:

1. Abra `src/config/feature-flags.ts`
2. Mude `enableScada: false`
3. A página SCADA não aparecerá mais no sidebar

Para exibir novamente:

1. Mude para `enableScada: true`
2. A página SCADA voltará a aparecer no sidebar

## Importante

- ⚠️ **Não commitar flags temporárias**: Se uma feature está em desenvolvimento, certifique-se de que a flag está desabilitada antes de fazer commit
- ✅ **Remover flags antigas**: Quando uma feature estiver consolidada, remova a flag e o código condicional
- 📝 **Documentar**: Mantenha este README atualizado com as flags disponíveis

## Feature Flags Disponíveis

| Flag | Descrição | Padrão |
|------|-----------|--------|
| `enableScada` | Sistema SCADA | `false` |
| `enableFinanceiro` | Módulo Financeiro | `true` |
| `enableCadastros` | Módulo de Cadastros | `true` |
| `enableSupervisorio` | Sistema de Supervisório | `true` |
| `enableCOA` | Centro de Operação de Ativos | `true` |
