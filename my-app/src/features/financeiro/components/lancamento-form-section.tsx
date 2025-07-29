// src/features/financeiro/components/lancamento-form-section.tsx
import { ReactNode } from 'react';
import { Card } from '@/components/ui/card';

interface LancamentoFormSectionProps {
  title?: string;
  children: ReactNode;
}

export function LancamentoFormSection({ title, children }: LancamentoFormSectionProps) {
  return (
    <Card className="p-6">
      <div className="space-y-4">
        {title && (
          <h3 className="text-base font-medium border-b pb-2">{title}</h3>
        )}
        {children}
      </div>
    </Card>
  );
}