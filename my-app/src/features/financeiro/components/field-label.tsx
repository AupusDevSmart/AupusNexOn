// src/features/financeiro/components/field-label.tsx
import { ReactNode } from 'react';

interface FieldLabelProps {
  children: ReactNode;
  required?: boolean;
  tooltip?: boolean;
}

export function FieldLabel({ children, required = false, tooltip = false }: FieldLabelProps) {
  return (
    <div className="flex items-center">
      <label className="block text-sm font-medium">
        {children}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {tooltip && (
        <span className="ml-1 text-muted-foreground">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
            <path d="M12 16V12M12 8H12.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </span>
      )}
    </div>
  );
}