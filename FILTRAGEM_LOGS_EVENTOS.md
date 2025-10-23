# Documentação - Lógica de Filtragem de Logs de Eventos

## Visão Geral

A filtragem de logs de eventos está implementada em `src/pages/logs-eventos/index.tsx` usando React `useMemo` para otimização de performance.

## Filtros Implementados

### 1. Filtro por Data/Hora

#### Data Inicial
```typescript
if (filtros.dataInicial) {
  const dataEvento = new Date(evento.dataHora);
  const dataInicial = new Date(filtros.dataInicial);

  if (dataEvento < dataInicial) {
    return false; // Evento anterior à data inicial - excluir
  }
}
```

**Comportamento:**
- Exclui eventos com data/hora **anterior** à data inicial selecionada
- Formato esperado: `"yyyy-MM-dd'T'HH:mm"` (ex: `"2025-01-15T10:30"`)
- Comparação inclusiva: eventos **exatamente na data inicial são incluídos**

#### Data Final
```typescript
if (filtros.dataFinal) {
  const dataEvento = new Date(evento.dataHora);
  const dataFinal = new Date(filtros.dataFinal);

  if (dataEvento > dataFinal) {
    return false; // Evento posterior à data final - excluir
  }
}
```

**Comportamento:**
- Exclui eventos com data/hora **posterior** à data final selecionada
- Formato esperado: `"yyyy-MM-dd'T'HH:mm"` (ex: `"2025-01-15T23:59"`)
- Comparação inclusiva: eventos **exatamente na data final são incluídos**

### 2. Filtro por Tipo de Evento
```typescript
if (filtros.tipoEvento !== "all" && evento.tipoEvento !== filtros.tipoEvento) {
  return false;
}
```

**Valores possíveis:**
- `"ALARME"` - Alarmes do sistema
- `"TRIP"` - Trips de proteção
- `"URGENCIA"` - Eventos urgentes
- `"INFORMATIVO"` - Eventos informativos
- `"MANUTENCAO"` - Eventos de manutenção
- `"all"` - Todos os tipos

### 3. Filtro por Ativo
```typescript
if (filtros.ativo !== "all" &&
    !evento.ativo.toLowerCase().includes(filtros.ativo.toLowerCase())) {
  return false;
}
```

**Comportamento:**
- Busca case-insensitive (ignora maiúsculas/minúsculas)
- Busca parcial: `"ufv"` encontra `"UFV Solar Goiânia"`
- `"all"` mostra todos os ativos

### 4. Filtro por Severidade
```typescript
if (filtros.severidade !== "all" && evento.severidade !== filtros.severidade) {
  return false;
}
```

**Valores possíveis:**
- `"BAIXA"` - Severidade baixa
- `"MEDIA"` - Severidade média
- `"ALTA"` - Severidade alta
- `"CRITICA"` - Severidade crítica
- `"all"` - Todas as severidades

### 5. Filtro por Status de Reconhecimento
```typescript
if (filtros.reconhecido !== null && evento.reconhecido !== filtros.reconhecido) {
  return false;
}
```

**Valores possíveis:**
- `true` - Apenas eventos reconhecidos
- `false` - Apenas eventos não reconhecidos
- `null` - Todos os eventos (reconhecidos e não reconhecidos)

### 6. Filtro por Categoria de Auditoria
```typescript
if (filtros.categoriaAuditoria &&
    filtros.categoriaAuditoria !== "all" &&
    evento.categoriaAuditoria !== filtros.categoriaAuditoria) {
  return false;
}
```

**Valores possíveis:**
- `"LOGIN"` - Eventos de login
- `"LOGOUT"` - Eventos de logout
- `"COMANDO"` - Comandos executados
- `"CONFIGURACAO"` - Alterações de configuração
- `"DIAGRAMA"` - Alterações de diagramas
- `"USUARIO"` - Gestão de usuários
- `"SISTEMA"` - Eventos do sistema
- `"RELATORIO"` - Geração de relatórios
- `"all"` - Todas as categorias

## Exemplo Prático

### Cenário 1: Filtrar Eventos de Hoje

**Atalho "Hoje" define:**
```typescript
dataInicial: "2025-01-15T00:00" // Início do dia (00:00:00)
dataFinal: "2025-01-15T23:59"   // Fim do dia (23:59:59)
```

**Resultado:**
- Evento de `2025-01-15T14:30:00` ✅ Incluído
- Evento de `2025-01-14T23:59:00` ❌ Excluído (anterior)
- Evento de `2025-01-16T00:01:00` ❌ Excluído (posterior)

### Cenário 2: Últimos 7 Dias

**Atalho "Últimos 7 dias" define:**
```typescript
dataInicial: "2025-01-09T00:00" // 6 dias atrás + hoje = 7 dias
dataFinal: "2025-01-15T23:59"   // Fim do dia atual
```

**Resultado:**
- Evento de `2025-01-09T08:00:00` ✅ Incluído
- Evento de `2025-01-15T20:00:00` ✅ Incluído
- Evento de `2025-01-08T23:59:00` ❌ Excluído (antes dos 7 dias)

### Cenário 3: Eventos Críticos Não Reconhecidos

**Filtros combinados:**
```typescript
{
  severidade: "CRITICA",
  reconhecido: false,
  // outras propriedades...
}
```

**Resultado:**
- Apenas eventos com severidade CRÍTICA E não reconhecidos

### Cenário 4: Alarmes de um Ativo Específico

**Filtros combinados:**
```typescript
{
  tipoEvento: "ALARME",
  ativo: "ufv-goiania",
  dataInicial: "2025-01-15T00:00",
  dataFinal: "2025-01-15T23:59",
  // outras propriedades...
}
```

**Resultado:**
- Apenas alarmes da UFV Solar Goiânia ocorridos hoje

## Otimização de Performance

### useMemo
```typescript
const eventosFiltrados = useMemo(() => {
  return mockEventos.filter((evento) => {
    // Lógica de filtragem...
  });
}, [filtros]);
```

**Benefícios:**
- ✅ Recalcula apenas quando `filtros` muda
- ✅ Evita recálculos desnecessários em re-renders
- ✅ Melhora performance com grandes volumes de dados

### Try-Catch nas Comparações de Data

```typescript
try {
  const dataEvento = new Date(evento.dataHora);
  const dataInicial = new Date(filtros.dataInicial);
  if (dataEvento < dataInicial) return false;
} catch (error) {
  console.warn('Erro ao comparar data inicial:', error);
}
```

**Benefícios:**
- ✅ Previne crashes por datas inválidas
- ✅ Loga erros para debug
- ✅ Continua filtragem mesmo com dados corrompidos

## Resumo Automático

O resumo dos eventos é calculado automaticamente baseado nos eventos filtrados:

```typescript
const resumo: ResumoEventos = useMemo(() => {
  return {
    totalEventos: eventosFiltrados.length,
    eventosCriticos: eventosFiltrados.filter((e) => e.severidade === "CRITICA").length,
    eventosEmAberto: eventosFiltrados.filter((e) => !e.reconhecido).length,
    eventosReconhecidos: eventosFiltrados.filter((e) => e.reconhecido).length,
  };
}, [eventosFiltrados]);
```

**Métricas calculadas:**
- Total de eventos (após filtragem)
- Total de eventos críticos
- Total de eventos em aberto (não reconhecidos)
- Total de eventos reconhecidos

## Fluxo de Dados

```
Usuário interage com filtros
         ↓
setFiltros atualiza estado
         ↓
useMemo detecta mudança em [filtros]
         ↓
Recalcula eventosFiltrados
         ↓
useMemo detecta mudança em [eventosFiltrados]
         ↓
Recalcula resumo
         ↓
UI atualiza automaticamente
```

## Tratamento de Erros

### Datas Inválidas
- Envolvido em try-catch
- Log de aviso no console
- Evento é incluído se houver erro na comparação de data

### Valores Nulos/Undefined
- Verificações explícitas antes de comparações
- Valores `null` ou `undefined` são tratados como "sem filtro"

## Extensibilidade

Para adicionar novos filtros:

1. Adicionar propriedade em `FiltrosLogsEventos` (types)
2. Adicionar campo no formulário de filtros
3. Adicionar lógica no `useMemo` de `eventosFiltrados`

**Exemplo - Adicionar filtro por usuário:**

```typescript
// 1. No tipo
interface FiltrosLogsEventos {
  // ... outros filtros
  usuario?: string;
}

// 2. No formulário
<Input
  value={filtros.usuario || ""}
  onChange={(e) => setFiltros({ ...filtros, usuario: e.target.value })}
  placeholder="Filtrar por usuário..."
/>

// 3. Na lógica de filtragem
if (filtros.usuario && !evento.usuario.toLowerCase().includes(filtros.usuario.toLowerCase())) {
  return false;
}
```

## Testes Recomendados

### Testes Unitários
- [ ] Filtro por data inicial funciona corretamente
- [ ] Filtro por data final funciona corretamente
- [ ] Combinação de filtros funciona (AND lógico)
- [ ] Valores "all" não filtram
- [ ] Valores `null` não filtram
- [ ] Datas inválidas não quebram a aplicação

### Testes de Performance
- [ ] 1.000 eventos filtram em < 100ms
- [ ] 10.000 eventos filtram em < 500ms
- [ ] useMemo evita recálculos desnecessários

### Testes de UX
- [ ] Filtros respondem imediatamente
- [ ] Resumo atualiza automaticamente
- [ ] Contador de eventos exibe valor correto
- [ ] Atalhos rápidos definem datas corretas
