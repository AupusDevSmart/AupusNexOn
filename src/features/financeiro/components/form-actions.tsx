// src/features/financeiro/components/form-actions.tsx
import { Button } from '@/components/ui/button';

interface FormActionsProps {
  onCancel: () => void;
}

export function FormActions({ onCancel }: FormActionsProps) {
  return (
    <div className="flex justify-end space-x-2">
      <Button variant="outline" type="button" onClick={onCancel}>
        Cancelar
      </Button>
      <Button type="submit" className="bg-success hover:bg-success/90">
        Salvar
      </Button>
    </div>
  );
}