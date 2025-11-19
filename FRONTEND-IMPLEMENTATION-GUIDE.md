# Frontend Implementation Guide - Energy Costs V2.0

## Overview
Complete guide for implementing custom timestamp filters and updated time schedules in the M-160 energy costs modal.

---

## ✅ Completed Tasks

### 1. DateTimeInput Component
**File:** `src/components/ui/datetime-input.tsx`

**Status:** ✅ Created

**Features:**
- Native HTML5 datetime-local input
- ISO 8601 format support
- Min/max validation
- Dark mode compatible
- Display formatted date in pt-BR

**Usage:**
```tsx
<DateTimeInput
  label="Início"
  value={timestampInicio}
  onChange={setTimestampInicio}
  max={timestampFim}
/>
```

---

### 2. DTOs Updated
**File:** `src/types/dtos/custos-energia-dto.ts`

**Changes:** ✅ Complete
- Added `'custom'` to `PeriodoTipo`
- Made `periodo` optional
- Added `timestamp_inicio?: string`
- Added `timestamp_fim?: string`

---

### 3. useCustosEnergia Hook Updated
**File:** `src/hooks/useCustosEnergia.ts`

**Changes:** ✅ Complete
- Accepts `timestamp_inicio` and `timestamp_fim` parameters
- Dependency array updated
- Documentation updated with 3 usage modes

**Usage Examples:**
```tsx
// Mode 1: Day
const { data, loading, error } = useCustosEnergia({
  equipamentoId,
  periodo: 'dia',
  data: '2025-11-13',
});

// Mode 2: Month
const { data, loading, error } = useCustosEnergia({
  equipamentoId,
  periodo: 'mes',
  data: '2025-11',
});

// Mode 3: Custom
const { data, loading, error } = useCustosEnergia({
  equipamentoId,
  periodo: 'custom',
  timestamp_inicio: '2025-11-01T00:00:00Z',
  timestamp_fim: '2025-11-15T23:59:59Z',
});
```

---

## 🔨 Remaining Tasks

### 4. Update M160Modal
**File:** `src/features/supervisorio/components/m160-modal.tsx`

**What to do:**

#### Step 1: Add State Variables (after line 38)
```tsx
// ✅ NOVO: Estados para período customizado
const [timestampInicio, setTimestampInicio] = useState<string>(() => {
  const now = new Date();
  now.setDate(now.getDate() - 7); // 7 dias atrás
  now.setHours(0, 0, 0, 0);
  return now.toISOString();
});

const [timestampFim, setTimestampFim] = useState<string>(() => {
  const now = new Date();
  now.setHours(23, 59, 59, 999);
  return now.toISOString();
});
```

#### Step 2: Update useCustosEnergia Hook Call (lines 59-68)
```tsx
const {
  data: custosData,
  loading: custosLoading,
  error: custosError,
  refetch: refetchCustos,
} = useCustosEnergia({
  equipamentoId,
  periodo: periodoCustos,
  timestamp_inicio: periodoCustos === 'custom' ? timestampInicio : undefined,
  timestamp_fim: periodoCustos === 'custom' ? timestampFim : undefined,
  enabled: activeTab === 'custos' && !!equipamentoId,
});
```

#### Step 3: Update Period Filter UI (replace lines 210-228)
```tsx
{/* Filtros */}
<div className="space-y-4 p-4 bg-muted/30 rounded-lg">
  <div className="flex items-center justify-between gap-4">
    <div className="flex items-center gap-2">
      <Calendar className="h-4 w-4 text-muted-foreground" />
      <span className="text-sm font-medium">Período:</span>
    </div>
    <Select value={periodoCustos} onValueChange={(v) => setPeriodoCustos(v as PeriodoTipo)}>
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder="Selecione o período" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="dia">Dia Atual</SelectItem>
        <SelectItem value="mes">Mês Atual</SelectItem>
        <SelectItem value="custom">Período Customizado</SelectItem>
      </SelectContent>
    </Select>
    <Button size="sm" variant="outline" onClick={refetchCustos} disabled={custosLoading}>
      {custosLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Atualizar'}
    </Button>
  </div>

  {/* ✅ NOVO: DateTimePickers para período customizado */}
  {periodoCustos === 'custom' && (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <DateTimeInput
        label="Data/Hora Início"
        value={timestampInicio}
        onChange={setTimestampInicio}
        max={timestampFim}
      />
      <DateTimeInput
        label="Data/Hora Fim"
        value={timestampFim}
        onChange={setTimestampFim}
        min={timestampInicio}
      />
    </div>
  )}
</div>
```

#### Step 4: Update Hardcoded Time Values (lines 272-273 and more)
**Search for all instances of `horario_inicio="17:00"` and `horario_fim="20:00"`**

Change from 17:00-20:00 to 18:00-21:00:
```tsx
// BEFORE:
<CardCusto
  tipo="PONTA"
  energia_kwh={custosData.consumo.energia_ponta_kwh}
  custo={custosData.custos.custo_ponta}
  tarifa={custosData.tarifas_aplicadas.find((t) => t.tipo_horario === 'PONTA')?.tarifa_total || undefined}
  horario_inicio="17:00"  // ❌ OLD
  horario_fim="20:00"     // ❌ OLD
/>

// AFTER:
<CardCusto
  tipo="PONTA"
  energia_kwh={custosData.consumo.energia_ponta_kwh}
  custo={custosData.custos.custo_ponta}
  tarifa={custosData.tarifas_aplicadas.find((t) => t.tipo_horario === 'PONTA')?.tarifa_total || undefined}
  horario_inicio={
    custosData.tarifas_aplicadas.find((t) => t.tipo_horario === 'PONTA')?.horario_inicio || '18:00'  // ✅ NEW
  }
  horario_fim={
    custosData.tarifas_aplicadas.find((t) => t.tipo_horario === 'PONTA')?.horario_fim || '21:00'  // ✅ NEW
  }
/>
```

**This change should be applied to all CardCusto components to use data from backend instead of hardcoded values.**

---

### 5. Update CardCusto Component (if needed)
**File:** `src/features/supervisorio/components/custos-energia.tsx`

**Check if hardcoded time values exist**, and if so, update them:
- Ponta: 18:00-21:00 (was 17:00-20:00)
- Fora Ponta: 06:00-18:00 + 21:00-21:30
- Reservado: 21:30-06:00

---

### 6. Update IndicadorIrrigante Component
**File:** `src/features/supervisorio/components/custos-energia.tsx`

**Check the discount display:**
The discount should show **80% on TE (Tarifa de Energia)**, not on the total tariff.

**Verify text displays:**
- "Desconto de 80% na TE (Tarifa de Energia)"
- "0% de desconto na TUSD"
- "Horário: 21:30-06:00"
- "Feriados e fins de semana: 24h com desconto"

---

## 📋 Testing Checklist

### Backend Testing
- [ ] Send MQTT message with PHF value
- [ ] Verify PHF delta calculation
- [ ] Verify time classification (06:00, 18:00, 21:00, 21:30)
- [ ] Verify holiday detection
- [ ] Verify irrigante discount calculation
- [ ] Test duplicate prevention

### Frontend Testing
- [ ] Select "Dia Atual" - verify query sent correctly
- [ ] Select "Mês Atual" - verify query sent correctly
- [ ] Select "Período Customizado" - verify DateTimePickers appear
- [ ] Select custom timestamps - verify query sent with ISO 8601 format
- [ ] Verify timestamp validation (início < fim)
- [ ] Verify time labels show 18:00-21:00 for Ponta
- [ ] Verify Reservado shows 21:30-06:00
- [ ] Verify irrigante discount shows 80%
- [ ] Verify dark mode compatibility

### End-to-End Testing
- [ ] Create MQTT simulation with various PHF values
- [ ] Verify energia_kwh calculation is correct
- [ ] Verify cost calculation matches expected values
- [ ] Verify irrigante unit shows correct savings
- [ ] Verify weekend/holiday shows 24h discount for irrigantes
- [ ] Verify demanda calculation (Pa+Pb+Pc)

---

## 🐛 Known Issues & Solutions

### Issue 1: DateTimePicker shows wrong timezone
**Solution:** The DateTimeInput component converts between local time and ISO 8601. Ensure the backend accepts ISO 8601 with timezone.

### Issue 2: First PHF reading shows energia_kwh = 0
**Expected Behavior:** First reading should have `energia_kwh = NULL` and `qualidade = 'PRIMEIRA_LEITURA'`. This is filtered out in cost calculations.

### Issue 3: Duplicate data from multiple backends
**Solution:** Database UNIQUE constraint + silent P2002 error handling prevents duplicates.

### Issue 4: Wrong time classification
**Debug:** Check `ClassificacaoHorariosService` priority order:
1. Holiday/Weekend + Irrigante → 24h HR
2. 21:30-06:00 → HR
3. 18:00-21:00 → P
4. Rest → FP

---

## 📊 New Time Schedules Reference

| Período | Horário | Dias | Observação |
|---------|---------|------|------------|
| **Fora Ponta** | 06:00-18:00 | Todos | Período principal |
| **Ponta** | 18:00-21:00 | Todos | **NOVO: era 17:00-20:00** |
| **Fora Ponta** | 21:00-21:30 | Todos | Pequeno período FP |
| **Horário Reservado** | 21:30-06:00 | Todos | **NOVO: era indefinido** |
| **Irrigante (HR)** | 21:30-06:00 | Dias úteis | 80% desconto TE |
| **Irrigante (Feriados)** | 00:00-24:00 | Feriados/Fins de semana | 80% desconto TE por 24h |

---

## 🚀 Deployment Checklist

### Before Go-Live
- [ ] Delete old M-160 test data from database
- [ ] Run migration to add new fields
- [ ] Remove duplicates with script
- [ ] Verify backend is running
- [ ] Verify MQTT is connected
- [ ] Test with real M-160 equipment

### Database Cleanup
```bash
# Connect to database
psql "postgresql://admin:password@45.55.122.87:5432/aupus?schema=public"

# Check for old test data
SELECT COUNT(*) FROM equipamentos_dados
WHERE equipamento_id = 'YOUR_M160_ID'
AND phf_atual IS NULL;

# Delete old test data (CAREFUL!)
DELETE FROM equipamentos_dados
WHERE equipamento_id = 'YOUR_M160_ID'
AND timestamp_dados < '2025-11-13T00:00:00Z'
AND phf_atual IS NULL;
```

### Post-Deployment
- [ ] Monitor logs for errors
- [ ] Verify PHF calculations are working
- [ ] Verify costs match expected values
- [ ] Check for duplicate entries (should be 0)
- [ ] Validate holiday detection for next holiday
- [ ] Test irrigante discount calculation

---

## 📚 Additional Resources

- **Backend Summary:** `aupus-service-api/BACKEND-IMPLEMENTATION-SUMMARY.md`
- **GDD:** `aupus-service-api/GDD-CUSTOS-ENERGIA-M160-V2.md`
- **Migration:** `aupus-service-api/prisma/migrations/20251113_add_phf_and_energy_tracking/`
- **Prisma Schema:** `aupus-service-api/prisma/schema.prisma`

---

## ✅ Summary

**Frontend Tasks:**
- ✅ DTOs updated
- ✅ Hook updated
- ✅ DateTimeInput component created
- ⏳ M160Modal needs updating (4 steps)
- ⏳ Time values need updating (18:00-21:00)
- ⏳ Testing needed

**Status:** 75% Complete

**Next Steps:**
1. Update M160Modal with custom timestamp UI
2. Update hardcoded time values (17:00→18:00, 20:00→21:00)
3. Test with backend
4. Clean old test data
5. Deploy!

**Generated:** 2025-11-13
**Version:** Frontend v2.0
**Status:** Ready for Final Updates
