// src/features/financeiro/components/searchable-combobox.tsx
import { useState, useEffect } from 'react';
import { Check, ChevronsUpDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface ComboboxOption {
  value: string;
  label: string;
}

interface SearchableComboboxProps {
  options: ComboboxOption[];
  value?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  className?: string;
}

export function SearchableCombobox({
  options,
  value,
  onValueChange,
  placeholder = "Selecione uma opção...",
  searchPlaceholder = "Buscar...",
  emptyText = "Nenhuma opção encontrada.",
  disabled = false,
  className,
}: SearchableComboboxProps) {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");

  // Filtra as opções baseado na busca
  const filteredOptions = options.filter((option) =>
    option.label.toLowerCase().includes(searchValue.toLowerCase())
  );

  // Encontra a opção selecionada
  const selectedOption = options.find((option) => option.value === value);

  const handleSelect = (selectedValue: string) => {
    const newValue = selectedValue === value ? "" : selectedValue;
    onValueChange?.(newValue);
    setOpen(false);
    setSearchValue("");
  };

  // Limpa a busca quando o popover fecha
  useEffect(() => {
    if (!open) {
      setSearchValue("");
    }
  }, [open]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between font-normal",
            !selectedOption && "text-muted-foreground",
            className
          )}
          disabled={disabled}
        >
          <span className="truncate">
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <Command>
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <input
              placeholder={searchPlaceholder}
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          <CommandList>
            {filteredOptions.length === 0 && (
              <div className="py-6 text-center text-sm text-muted-foreground">
                {emptyText}
              </div>
            )}
            {filteredOptions.length > 0 && (
              <CommandGroup>
                {filteredOptions.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={option.value}
                    onSelect={() => handleSelect(option.value)}
                    className="cursor-pointer"
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === option.value ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <span className="truncate">{option.label}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// Combobox que permite entrada manual
interface SearchableComboboxWithManualProps extends SearchableComboboxProps {
  allowManualInput?: boolean;
  manualInputText?: string;
}

export function SearchableComboboxWithManual({
  options,
  value,
  onValueChange,
  placeholder = "Selecione uma opção...",
  searchPlaceholder = "Buscar...",
  emptyText = "Nenhuma opção encontrada.",
  allowManualInput = false,
  manualInputText = "Usar texto digitado",
  disabled = false,
  className,
}: SearchableComboboxWithManualProps) {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");

  const filteredOptions = options.filter((option) =>
    option.label.toLowerCase().includes(searchValue.toLowerCase())
  );

  const selectedOption = options.find((option) => option.value === value);
  const isManualValue = value && !selectedOption;

  const handleSelect = (selectedValue: string) => {
    onValueChange?.(selectedValue);
    setOpen(false);
    setSearchValue("");
  };

  const handleManualInput = () => {
    if (searchValue.trim()) {
      onValueChange?.(searchValue.trim());
      setOpen(false);
      setSearchValue("");
    }
  };

  return (
    <div className="relative">
      <Button
        variant="outline"
        role="combobox"
        aria-expanded={open}
        className={cn(
          "w-full justify-between font-normal",
          !selectedOption && !isManualValue && "text-muted-foreground",
          className
        )}
        disabled={disabled}
        onClick={() => setOpen(!open)}
      >
        <span className="truncate">
          {selectedOption ? selectedOption.label : isManualValue ? value : placeholder}
        </span>
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </Button>

      {open && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 max-h-60 overflow-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-lg">
          <div className="flex items-center border-b px-3 pb-2 mb-2">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <input
              placeholder={searchPlaceholder}
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              className="flex h-8 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              autoFocus
            />
          </div>
          
          <div className="space-y-1">
            {/* Opção para usar entrada manual */}
            {allowManualInput && searchValue.trim() && !filteredOptions.some(opt => opt.label.toLowerCase() === searchValue.toLowerCase()) && (
              <button
                className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-accent hover:text-accent-foreground flex items-center border-b mb-2"
                onClick={handleManualInput}
              >
                <span className="mr-2 h-4 w-4 flex items-center justify-center text-xs">✓</span>
                <span className="truncate font-medium">
                  {manualInputText}: "{searchValue}"
                </span>
              </button>
            )}

            {/* Opções filtradas */}
            {filteredOptions.length === 0 && (!allowManualInput || !searchValue.trim()) ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                {emptyText}
              </div>
            ) : (
              filteredOptions.map((option) => (
                <button
                  key={option.value}
                  className={cn(
                    "w-full text-left px-2 py-1.5 text-sm rounded hover:bg-accent hover:text-accent-foreground flex items-center",
                    value === option.value && "bg-accent text-accent-foreground"
                  )}
                  onClick={() => handleSelect(option.value)}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === option.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="truncate">{option.label}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {open && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setOpen(false)}
        />
      )}
    </div>
  );
}

// Versão simplificada caso você não tenha os componentes Command
export function SimpleSearchableCombobox({
  options,
  value,
  onValueChange,
  placeholder = "Selecione uma opção...",
  searchPlaceholder = "Buscar...",
  emptyText = "Nenhuma opção encontrada.",
  disabled = false,
  className,
}: SearchableComboboxProps) {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");

  const filteredOptions = options.filter((option) =>
    option.label.toLowerCase().includes(searchValue.toLowerCase())
  );

  const selectedOption = options.find((option) => option.value === value);

  const handleSelect = (selectedValue: string) => {
    onValueChange?.(selectedValue);
    setOpen(false);
    setSearchValue("");
  };

  return (
    <div className="relative">
      <Button
        variant="outline"
        role="combobox"
        aria-expanded={open}
        className={cn(
          "w-full justify-between font-normal",
          !selectedOption && "text-muted-foreground",
          className
        )}
        disabled={disabled}
        onClick={() => setOpen(!open)}
      >
        <span className="truncate">
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </Button>

      {open && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 max-h-60 overflow-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-lg">
          <div className="flex items-center border-b px-3 pb-2 mb-2">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <input
              placeholder={searchPlaceholder}
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              className="flex h-8 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              autoFocus
            />
          </div>
          
          {filteredOptions.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              {emptyText}
            </div>
          ) : (
            <div className="space-y-1">
              {filteredOptions.map((option) => (
                <button
                  key={option.value}
                  className={cn(
                    "w-full text-left px-2 py-1.5 text-sm rounded hover:bg-accent hover:text-accent-foreground flex items-center",
                    value === option.value && "bg-accent text-accent-foreground"
                  )}
                  onClick={() => handleSelect(option.value)}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === option.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="truncate">{option.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {open && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setOpen(false)}
        />
      )}
    </div>
  );
}