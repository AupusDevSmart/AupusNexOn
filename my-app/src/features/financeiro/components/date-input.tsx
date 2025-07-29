// src/features/financeiro/components/date-input.tsx
import { Calendar } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface DateInputProps {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}

export function DateInput({ value, onChange, required = false }: DateInputProps) {
  return (
    <div className="relative">
      <Input 
        type="date" 
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pr-10"
        required={required}
      />
      <Calendar className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
    </div>
  );
}