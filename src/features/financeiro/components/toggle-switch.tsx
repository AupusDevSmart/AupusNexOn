// src/features/financeiro/components/toggle-switch.tsx
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils'; // Certifique-se de que esta utilidade está disponível

interface ToggleSwitchProps {
  id: string;
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

export function ToggleSwitch({ id, label, checked, onCheckedChange }: ToggleSwitchProps) {
  // Podemos estender o componente switch para customizar o estilo
  return (
    <div className="flex items-center space-x-2">
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        // Use o utilitário cn para combinar classes e sobrescrever as classes padrão
        className={cn(
          "data-[state=checked]:!bg-green-600 dark:data-[state=checked]:!bg-green-500",
          "data-[state=unchecked]:bg-gray-200 dark:data-[state=unchecked]:bg-gray-700",
          "focus:ring-2 focus:ring-green-500 dark:focus:ring-green-400"
        )}
      />
      <label
        htmlFor={id}
        className="text-sm font-medium leading-none text-gray-900 dark:text-gray-100 cursor-pointer select-none"
      >
        {label}
      </label>
    </div>
  );
}