// src/components/ui/cnpj-input.tsx - NOVO COMPONENTE
import React, { forwardRef, useCallback } from 'react';
import { Input } from '@/core/components/ui/input';
import { cn } from '@/core/lib/utils';

export interface CNPJInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  value?: string;
  onChange?: (value: string) => void;
  onFormattedChange?: (formatted: string, raw: string) => void;
}

// ✅ FUNÇÃO: Aplicar máscara de CPF (≤11 dígitos) ou CNPJ (12-14). Muitas fazendas
// estão no CPF do produtor, não em CNPJ — o input aceita os dois.
const applyCNPJMask = (value: string): string => {
  // Remove todos os caracteres não numéricos
  const numbers = value.replace(/\D/g, '');

  // Limita a 14 dígitos
  const limited = numbers.slice(0, 14);

  // CPF (até 11 dígitos): XXX.XXX.XXX-XX
  if (limited.length <= 11) {
    if (limited.length <= 3) return limited;
    if (limited.length <= 6) return limited.replace(/(\d{3})(\d+)/, '$1.$2');
    if (limited.length <= 9) return limited.replace(/(\d{3})(\d{3})(\d+)/, '$1.$2.$3');
    return limited.replace(/(\d{3})(\d{3})(\d{3})(\d+)/, '$1.$2.$3-$4');
  }
  // CNPJ (12-14 dígitos): XX.XXX.XXX/XXXX-XX
  if (limited.length <= 12) {
    return limited.replace(/(\d{2})(\d{3})(\d{3})(\d+)/, '$1.$2.$3/$4');
  }
  return limited.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d+)/, '$1.$2.$3/$4-$5');
};

// ✅ FUNÇÃO: Remover máscara (apenas números)
const removeCNPJMask = (value: string): string => {
  return value.replace(/\D/g, '');
};

// ✅ FUNÇÃO: Validar formato — CPF (11) ou CNPJ (14) dígitos
const isValidCNPJFormat = (cnpj: string): boolean => {
  const numbers = cnpj.replace(/\D/g, '');
  return numbers.length === 11 || numbers.length === 14;
};

// ✅ FUNÇÃO: Validação de CPF (dígitos verificadores)
const isValidCPFDigits = (cpf: string): boolean => {
  const n = cpf.replace(/\D/g, '');
  if (n.length !== 11 || /^(\d)\1+$/.test(n)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(n[i]) * (10 - i);
  let d1 = 11 - (sum % 11);
  if (d1 >= 10) d1 = 0;
  if (parseInt(n[9]) !== d1) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(n[i]) * (11 - i);
  let d2 = 11 - (sum % 11);
  if (d2 >= 10) d2 = 0;
  return parseInt(n[10]) === d2;
};

// ✅ COMPONENTE: Input com máscara de CNPJ
export const CNPJInput = forwardRef<HTMLInputElement, CNPJInputProps>(
  ({ className, value = '', onChange, onFormattedChange, ...props }, ref) => {

    const handleChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
      const inputValue = event.target.value;
      const rawValue = removeCNPJMask(inputValue);
      const formattedValue = applyCNPJMask(inputValue);

      // Callback com valor sem máscara (para validações e API)
      onChange?.(rawValue);

      // Callback com ambos os valores (formatado e raw)
      onFormattedChange?.(formattedValue, rawValue);

      // Atualiza o input com o valor formatado
      if (event.target.value !== formattedValue) {
        event.target.value = formattedValue;
      }
    }, [onChange, onFormattedChange]);

    const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
      // Permitir teclas de controle
      const allowedKeys = [
        'Backspace', 'Delete', 'Tab', 'Escape', 'Enter',
        'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
        'Home', 'End'
      ];

      // Permitir Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X, Ctrl+Z
      if (event.ctrlKey || event.metaKey) {
        return;
      }

      // Permitir teclas de controle
      if (allowedKeys.includes(event.key)) {
        return;
      }

      // Bloquear se não for número e já tiver 14 dígitos
      const currentNumbers = removeCNPJMask(event.currentTarget.value);
      if (!/^\d$/.test(event.key) || currentNumbers.length >= 14) {
        event.preventDefault();
      }

      props.onKeyDown?.(event);
    }, [props]);

    // Determinar estilo baseado na validação
    const isValid = isValidCNPJFormat(value);
    const showValidation = value.length > 0;

    return (
      <div className="relative">
        <Input
          {...props}
          ref={ref}
          type="text"
          value={applyCNPJMask(value)}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="CPF ou CNPJ"
          maxLength={18} // XX.XXX.XXX/XXXX-XX (CPF cabe: XXX.XXX.XXX-XX)
          className={cn(
            className,
            // Estilo baseado na validação
            showValidation && !isValid && "border-yellow-400 focus:ring-yellow-400",
            showValidation && isValid && "border-green-500 focus:ring-green-500"
          )}
        />

        {/* ✅ Indicador visual de validação */}
        {showValidation && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            {isValid ? (
              <div className="text-green-500 text-xs font-medium">✓</div>
            ) : (
              <div className="text-yellow-500 text-xs font-medium">
                {removeCNPJMask(value).length} díg
              </div>
            )}
          </div>
        )}

        {/* ✅ Helper text */}
        {showValidation && !isValid && (
          <p className="text-xs text-yellow-600 mt-1">
            Digite um CPF (11 dígitos) ou CNPJ (14 dígitos)
          </p>
        )}
      </div>
    );
  }
);

CNPJInput.displayName = 'CNPJInput';

// ✅ HOOKS UTILITÁRIOS
export const useCNPJMask = (initialValue: string = '') => {
  const [value, setValue] = React.useState(initialValue);
  const [formatted, setFormatted] = React.useState(applyCNPJMask(initialValue));

  const handleChange = useCallback((rawValue: string) => {
    setValue(rawValue);
    setFormatted(applyCNPJMask(rawValue));
  }, []);

  const isValid = isValidCNPJFormat(value);

  return {
    value,           // Valor sem máscara (para API)
    formatted,       // Valor com máscara (para exibição)
    setValue,        // Setter para valor sem máscara
    handleChange,    // Handler para mudanças
    isValid,         // Se o CNPJ está válido (14 dígitos)
    reset: () => {
      setValue('');
      setFormatted('');
    }
  };
};

// ✅ UTILITÁRIOS EXPORTADOS
export const CNPJUtils = {
  mask: applyCNPJMask,
  unmask: removeCNPJMask,
  isValid: isValidCNPJFormat,

  // Validação completa de CPF (11) ou CNPJ (14) — algoritmo oficial
  isValidCNPJ: (cnpj: string): boolean => {
    const numbers = removeCNPJMask(cnpj);

    if (numbers.length === 11) return isValidCPFDigits(numbers); // CPF do produtor
    if (numbers.length !== 14) return false;

    // Verifica se todos os dígitos são iguais
    if (/^(\d)\1+$/.test(numbers)) return false;

    // Validação do primeiro dígito verificador
    let sum = 0;
    let weight = 5;

    for (let i = 0; i < 12; i++) {
      sum += parseInt(numbers[i]) * weight;
      weight = weight === 2 ? 9 : weight - 1;
    }

    const firstDigit = sum % 11 < 2 ? 0 : 11 - (sum % 11);
    if (parseInt(numbers[12]) !== firstDigit) return false;

    // Validação do segundo dígito verificador
    sum = 0;
    weight = 6;

    for (let i = 0; i < 13; i++) {
      sum += parseInt(numbers[i]) * weight;
      weight = weight === 2 ? 9 : weight - 1;
    }

    const secondDigit = sum % 11 < 2 ? 0 : 11 - (sum % 11);
    return parseInt(numbers[13]) === secondDigit;
  }
};
