// src/features/financeiro/components/money-input.tsx
import { Input } from '@/components/ui/input';

interface MoneyInputProps {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}

export function MoneyInput({ value, onChange, required = false }: MoneyInputProps) {
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 transform -translate-y-1/2">R$</span>
      <Input 
        type="text" 
        placeholder="0,00" 
        className="pl-10"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
      />
    </div>
  );
}