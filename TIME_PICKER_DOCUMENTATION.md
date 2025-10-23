# Documentação - Time Picker Components

## Visão Geral

Componentes profissionais de seleção de hora usando o Select do shadcn/ui. Implementados com 3 variações diferentes para atender diversos casos de uso.

## Componentes Criados

### 1. TimePicker (Padrão)
**Arquivo:** `src/components/ui/time-picker.tsx`

**Descrição:** Seletor de hora simples com intervalos de 30 minutos (00:00 até 23:30).

**Quando usar:**
- Filtros rápidos
- Seleção básica de horário
- Quando precisão ao minuto não é necessária
- Interfaces compactas

### 2. TimePickerSplit (Granular)
**Arquivo:** `src/components/ui/time-picker.tsx`

**Descrição:** Horas e minutos separados com controle total (00:00 até 23:59).

**Quando usar:**
- Precisa de controle fino (minuto a minuto)
- Formulários detalhados
- Agendamento de eventos precisos
- Configurações avançadas

### 3. TimePickerPresets (Com Atalhos)
**Arquivo:** `src/components/ui/time-picker.tsx`

**Descrição:** Seletor com presets de horários comuns + todas as horas.

**Quando usar:**
- Horários de expediente
- Agendamentos recorrentes
- Horários comerciais
- Facilitar seleções comuns

### 4. DateTimePickerCustom (Integrado)
**Arquivo:** `src/components/ui/datetime-picker-custom.tsx`

**Descrição:** DateTimePicker que usa os novos TimePickers customizados.

**Quando usar:**
- Alternativa ao input nativo de hora
- Melhor controle sobre UX
- Consistência visual com o design system

## Instalação e Uso

### TimePicker (Padrão)

```tsx
import { TimePicker } from "@/components/ui/time-picker";

function MyComponent() {
  const [hora, setHora] = useState("14:00");

  return (
    <TimePicker
      value={hora}
      onChange={setHora}
      label="Horário de Início"
    />
  );
}
```

**Props:**
- `value`: string (formato "HH:mm")
- `onChange`: (value: string) => void
- `label?`: string (opcional)
- `className?`: string (opcional)

**Características:**
- ✅ 48 opções (00:00, 00:30, 01:00, ..., 23:30)
- ✅ Intervalo de 30 minutos
- ✅ Ícone de relógio
- ✅ Scrollable dropdown
- ✅ Max height 300px

### TimePickerSplit (Granular)

```tsx
import { TimePickerSplit } from "@/components/ui/time-picker";

function MyComponent() {
  const [hora, setHora] = useState("14:30");

  return (
    <TimePickerSplit
      value={hora}
      onChange={setHora}
      label="Hora Exata"
    />
  );
}
```

**Props:**
- `value`: string (formato "HH:mm")
- `onChange`: (value: string) => void
- `label?`: string (opcional)
- `className?`: string (opcional)

**Características:**
- ✅ 24 opções de hora (00 até 23)
- ✅ 60 opções de minuto (00 até 59)
- ✅ Controle independente
- ✅ Separador visual ":"
- ✅ Ícone de relógio
- ✅ Scrollable dropdowns

### TimePickerPresets (Com Atalhos)

```tsx
import { TimePickerPresets } from "@/components/ui/time-picker";

function MyComponent() {
  const [hora, setHora] = useState("08:00");

  return (
    <TimePickerPresets
      value={hora}
      onChange={setHora}
      label="Horário do Expediente"
    />
  );
}
```

**Props:**
- `value`: string (formato "HH:mm")
- `onChange`: (value: string) => void
- `label?`: string (opcional)
- `className?`: string (opcional)

**Características:**
- ✅ 12 presets comuns no topo
- ✅ Separador visual
- ✅ Todas as horas (30 min) abaixo
- ✅ Headers de seção
- ✅ Ícone de relógio

**Presets Incluídos:**
1. 00:00 - Meia-noite
2. 06:00 - Manhã
3. 08:00 - Início expediente
4. 09:00
5. 12:00 - Meio-dia
6. 13:00
7. 14:00
8. 17:00
9. 18:00 - Fim expediente
10. 19:00
11. 20:00
12. 23:59 - Fim do dia

### DateTimePickerCustom (Integrado)

```tsx
import { DateTimePickerCustom } from "@/components/ui/datetime-picker-custom";

function MyComponent() {
  const [dataHora, setDataHora] = useState<Date | undefined>(new Date());

  return (
    <DateTimePickerCustom
      date={dataHora}
      setDate={setDataHora}
      placeholder="Selecione data e hora"
      timePickerVariant="presets"
    />
  );
}
```

**Props:**
- `date?`: Date | undefined
- `setDate`: (date: Date | undefined) => void
- `placeholder?`: string
- `className?`: string
- `timePickerVariant?`: "default" | "split" | "presets"

**Variantes:**
- `"default"`: Usa TimePicker padrão (30 min)
- `"split"`: Usa TimePickerSplit (granular)
- `"presets"`: Usa TimePickerPresets (com atalhos)

## Exemplos Práticos

### Exemplo 1: Filtro de Horário Simples

```tsx
import { TimePicker } from "@/components/ui/time-picker";

function HorarioFiltro() {
  const [horaInicio, setHoraInicio] = useState("08:00");
  const [horaFim, setHoraFim] = useState("18:00");

  return (
    <div className="flex gap-4">
      <TimePicker
        value={horaInicio}
        onChange={setHoraInicio}
        label="Das"
      />
      <TimePicker
        value={horaFim}
        onChange={setHoraFim}
        label="Até"
      />
    </div>
  );
}
```

### Exemplo 2: Agendamento Preciso

```tsx
import { TimePickerSplit } from "@/components/ui/time-picker";

function AgendamentoForm() {
  const [horario, setHorario] = useState("14:30");

  const handleSubmit = () => {
    console.log("Agendado para:", horario);
    // API call...
  };

  return (
    <div>
      <TimePickerSplit
        value={horario}
        onChange={setHorario}
        label="Horário do Compromisso"
      />
      <Button onClick={handleSubmit}>Agendar</Button>
    </div>
  );
}
```

### Exemplo 3: Horário de Trabalho

```tsx
import { TimePickerPresets } from "@/components/ui/time-picker";

function ConfiguracaoExpediente() {
  const [entrada, setEntrada] = useState("08:00");
  const [saida, setSaida] = useState("18:00");

  return (
    <div className="space-y-4">
      <TimePickerPresets
        value={entrada}
        onChange={setEntrada}
        label="Horário de Entrada"
      />
      <TimePickerPresets
        value={saida}
        onChange={setSaida}
        label="Horário de Saída"
      />
    </div>
  );
}
```

### Exemplo 4: DateTimePicker com Variações

```tsx
import { DateTimePickerCustom } from "@/components/ui/datetime-picker-custom";

function EventoForm() {
  const [dataEvento, setDataEvento] = useState<Date>();
  const [varianteSelecionada, setVarianteSelecionada] = useState<"default" | "split" | "presets">("default");

  return (
    <div className="space-y-4">
      {/* Seletor de Variante */}
      <div className="flex gap-2">
        <Button
          variant={varianteSelecionada === "default" ? "default" : "outline"}
          onClick={() => setVarianteSelecionada("default")}
        >
          Padrão
        </Button>
        <Button
          variant={varianteSelecionada === "split" ? "default" : "outline"}
          onClick={() => setVarianteSelecionada("split")}
        >
          Granular
        </Button>
        <Button
          variant={varianteSelecionada === "presets" ? "default" : "outline"}
          onClick={() => setVarianteSelecionada("presets")}
        >
          Presets
        </Button>
      </div>

      {/* DateTimePicker */}
      <DateTimePickerCustom
        date={dataEvento}
        setDate={setDataEvento}
        timePickerVariant={varianteSelecionada}
      />
    </div>
  );
}
```

### Exemplo 5: Integração com Formulário

```tsx
import { useForm } from "react-hook-form";
import { TimePicker } from "@/components/ui/time-picker";

interface FormData {
  horarioInicio: string;
  horarioFim: string;
}

function FormularioHorario() {
  const { register, handleSubmit, watch, setValue } = useForm<FormData>({
    defaultValues: {
      horarioInicio: "09:00",
      horarioFim: "17:00",
    },
  });

  const horarioInicio = watch("horarioInicio");
  const horarioFim = watch("horarioFim");

  const onSubmit = (data: FormData) => {
    console.log("Dados:", data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <TimePicker
        value={horarioInicio}
        onChange={(value) => setValue("horarioInicio", value)}
        label="Horário de Início"
      />
      <TimePicker
        value={horarioFim}
        onChange={(value) => setValue("horarioFim", value)}
        label="Horário de Término"
      />
      <Button type="submit">Salvar</Button>
    </form>
  );
}
```

## Comparação das Variações

| Característica | TimePicker | TimePickerSplit | TimePickerPresets |
|---------------|------------|-----------------|-------------------|
| Intervalos | 30 minutos | 1 minuto | 30 minutos + presets |
| Opções | 48 | 24h + 60m | 12 presets + 48 |
| Precisão | Básica | Total | Básica com atalhos |
| UX | Simples | Granular | Rápido |
| Uso comum | Filtros | Agendamentos | Expediente |
| Largura | ~140px | ~200px | ~140px |

## Customização

### Alterar Intervalos do TimePicker

```tsx
// Modificar função gerarOpcoesHora() em time-picker.tsx
const gerarOpcoesHora = (): string[] => {
  const opcoes: string[] = [];
  for (let h = 0; h < 24; h++) {
    opcoes.push(`${h.toString().padStart(2, "0")}:00`);
    opcoes.push(`${h.toString().padStart(2, "0")}:15`); // 15 minutos
    opcoes.push(`${h.toString().padStart(2, "0")}:30`); // 30 minutos
    opcoes.push(`${h.toString().padStart(2, "0")}:45`); // 45 minutos
  }
  return opcoes;
};
```

### Customizar Presets

```tsx
// Modificar PRESETS_COMUNS em time-picker.tsx
const PRESETS_COMUNS = [
  { label: "06:00 - Manhã", value: "06:00" },
  { label: "12:00 - Almoço", value: "12:00" },
  { label: "18:00 - Noite", value: "18:00" },
  // Adicionar mais conforme necessário
];
```

### Estilos Customizados

```tsx
<TimePicker
  value={hora}
  onChange={setHora}
  className="w-full"
/>

<TimePickerSplit
  value={hora}
  onChange={setHora}
  className="max-w-sm"
/>
```

## Acessibilidade

✅ **Navegação por teclado:**
- Tab: Navega entre componentes
- Enter/Space: Abre dropdown
- Arrow Up/Down: Navega pelas opções
- Enter: Seleciona opção

✅ **Screen readers:**
- Labels semânticos
- ARIA attributes do Select
- Feedback de mudança de valor

✅ **Contraste:**
- Cores acessíveis (WCAG AA)
- Suporte a dark mode
- Indicadores visuais claros

## Performance

### Geração de Opções

**TimePicker:**
- 48 opções geradas uma vez
- Memoizado automaticamente

**TimePickerSplit:**
- 24 + 60 = 84 opções
- Geradas sob demanda

**TimePickerPresets:**
- 12 presets + 48 opções
- Total: 60 itens

### Otimizações

✅ **Arrays gerados fora do componente:**
```tsx
// Gerado uma vez no module scope
const gerarHoras = (): string[] => { ... }
const HORAS = gerarHoras(); // Reutilizado
```

✅ **Select do shadcn/ui:**
- Virtualização nativa
- Performance em listas longas
- Scroll suave

## Integração com APIs

### Formato de Envio

```tsx
function enviarHorario(hora: string) {
  // Formato HH:mm para API
  const payload = {
    horario: hora, // "14:30"
  };

  fetch("/api/agendamento", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
```

### Conversão para Date

```tsx
function horaParaDate(hora: string, data?: Date): Date {
  const [hours, minutes] = hora.split(":").map(Number);
  const date = data || new Date();
  date.setHours(hours, minutes, 0, 0);
  return date;
}

// Uso
const horaString = "14:30";
const dataCompleta = horaParaDate(horaString, new Date());
```

### Validação

```tsx
function validarHorario(horaInicio: string, horaFim: string): boolean {
  const [hi, mi] = horaInicio.split(":").map(Number);
  const [hf, mf] = horaFim.split(":").map(Number);

  const inicio = hi * 60 + mi;
  const fim = hf * 60 + mf;

  return fim > inicio;
}

// Uso
if (!validarHorario("14:00", "15:00")) {
  toast.error("Horário de fim deve ser maior que início");
}
```

## Migração do Input Nativo

### Antes (Input Nativo)

```tsx
<Input
  type="time"
  value={timeValue}
  onChange={(e) => handleTimeChange(e.target.value)}
  className="pl-9 w-[140px]"
/>
```

### Depois (TimePicker)

```tsx
<TimePicker
  value={timeValue}
  onChange={handleTimeChange}
  className="w-[140px]"
/>
```

**Benefícios da migração:**
- ✅ UI consistente em todos os browsers
- ✅ Melhor controle sobre UX
- ✅ Design integrado ao sistema
- ✅ Sem dependência de browser nativo
- ✅ Suporte a presets e atalhos

## Troubleshooting

### Problema: Valor não atualiza

**Causa:** Estado não sincronizado

**Solução:**
```tsx
// ❌ Errado
<TimePicker value="14:00" onChange={setHora} />

// ✅ Correto
const [hora, setHora] = useState("14:00");
<TimePicker value={hora} onChange={setHora} />
```

### Problema: Valor inválido

**Causa:** Formato incorreto

**Solução:**
```tsx
// Sempre usar formato HH:mm
const horaValida = "14:30";   // ✅
const horaInvalida = "14:30:00"; // ❌
const horaInvalida2 = "14";   // ❌
```

### Problema: Dropdown não abre

**Causa:** z-index ou overflow

**Solução:**
```tsx
<div className="relative z-10"> {/* ou z-50 */}
  <TimePicker value={hora} onChange={setHora} />
</div>
```

## Testes Recomendados

### Testes Unitários

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { TimePicker } from "@/components/ui/time-picker";

test("deve renderizar com valor inicial", () => {
  render(<TimePicker value="14:00" onChange={() => {}} />);
  expect(screen.getByText("14:00")).toBeInTheDocument();
});

test("deve chamar onChange ao selecionar hora", () => {
  const handleChange = jest.fn();
  render(<TimePicker value="14:00" onChange={handleChange} />);

  fireEvent.click(screen.getByRole("combobox"));
  fireEvent.click(screen.getByText("15:00"));

  expect(handleChange).toHaveBeenCalledWith("15:00");
});
```

### Testes de Integração

- [ ] TimePicker renderiza todas as 48 opções
- [ ] TimePickerSplit controla horas e minutos independentemente
- [ ] TimePickerPresets mostra presets e todas as horas
- [ ] DateTimePickerCustom integra com cada variante
- [ ] Mudança de hora atualiza DateTimePicker
- [ ] Dark mode funciona corretamente

## Suporte a Internacionalização

### Formato 12h/24h

```tsx
// Para suportar formato 12h (AM/PM)
function formatarHora12h(hora24: string): string {
  const [h, m] = hora24.split(":").map(Number);
  const periodo = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${m.toString().padStart(2, "0")} ${periodo}`;
}

// Uso nos presets
const PRESETS_12H = [
  { label: formatarHora12h("06:00"), value: "06:00" },
  { label: formatarHora12h("12:00"), value: "12:00" },
  // ...
];
```

## Conclusão

Os componentes TimePicker oferecem uma solução profissional e flexível para seleção de horários, com 3 variações que atendem diferentes necessidades:

1. **TimePicker** - Rápido e simples
2. **TimePickerSplit** - Preciso e granular
3. **TimePickerPresets** - Conveniente com atalhos

Use **DateTimePickerCustom** quando precisar integrar data e hora com controle total sobre a UX.

Todos os componentes são:
- ✅ Acessíveis
- ✅ Responsivos
- ✅ Performáticos
- ✅ Customizáveis
- ✅ Type-safe
