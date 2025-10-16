import React, { useMemo } from 'react';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Building, MapPin, FileText } from 'lucide-react';
import { useConcessionariasStore } from '@/store/useConcessionariasStore';
import { ConcessionariaDTO } from '@/types/dtos/concessionaria-dto';

interface ConcessionariaSelectProps {
  value?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function ConcessionariaSelect({
  value,
  onValueChange,
  placeholder = "Selecione uma concessionária",
  className = "",
  disabled = false
}: ConcessionariaSelectProps) {
  const { concessionarias } = useConcessionariasStore();

  const selectedConcessionaria = useMemo(() => {
    return concessionarias?.find(conc => conc.id === value);
  }, [concessionarias, value]);

  if (!concessionarias) {
    return (
      <div className="text-muted-foreground text-sm">
        Carregando concessionárias...
      </div>
    );
  }

  const renderConcessionariaItem = (concessionaria: ConcessionariaDTO) => {
    return (
      <div className="flex items-center gap-3 p-2">
        <Avatar className="h-10 w-10">
          <AvatarFallback className="bg-green-100 text-green-700 text-sm">
            {concessionaria.logo_url ? (
              <img 
                src={concessionaria.logo_url} 
                alt={concessionaria.nome}
                className="h-10 w-10 object-cover rounded-full"
              />
            ) : (
              <Building className="h-5 w-5" />
            )}
          </AvatarFallback>
        </Avatar>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
              {concessionaria.nome}
            </p>
          </div>
          <div className="flex items-center gap-3 mt-1">
            <div className="flex items-center gap-1">
              <MapPin className="h-3 w-3 text-gray-400" />
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {concessionaria.estado}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <FileText className="h-3 w-3 text-gray-400" />
              <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                {concessionaria.documento}
              </span>
            </div>
          </div>
        </div>
        
        <Badge variant="outline" className="text-xs">
          {concessionaria.ano}
        </Badge>
      </div>
    );
  };

  const renderSelectedValue = () => {
    if (!selectedConcessionaria) {
      return <span className="text-muted-foreground">{placeholder}</span>;
    }
    
    return (
      <div className="flex items-center gap-2">
        <Avatar className="h-6 w-6">
          <AvatarFallback className="bg-green-100 text-green-700 text-xs">
            {selectedConcessionaria.logo_url ? (
              <img 
                src={selectedConcessionaria.logo_url} 
                alt={selectedConcessionaria.nome}
                className="h-6 w-6 object-cover rounded-full"
              />
            ) : (
              <Building className="h-3 w-3" />
            )}
          </AvatarFallback>
        </Avatar>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">
            {selectedConcessionaria.nome}
          </span>
          <span className="text-xs text-muted-foreground">
            ({selectedConcessionaria.estado})
          </span>
        </div>
      </div>
    );
  };

  return (
    <Select 
      value={value} 
      onValueChange={onValueChange}
      disabled={disabled}
    >
      <SelectTrigger className={`min-h-[44px] ${className}`}>
        <SelectValue>
          {renderSelectedValue()}
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="w-[450px]">
        {concessionarias.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            Nenhuma concessionária encontrada
          </div>
        ) : (
          concessionarias.map((concessionaria) => (
            <SelectItem 
              key={concessionaria.id} 
              value={concessionaria.id} 
              className="p-0 focus:bg-muted/50"
            >
              {renderConcessionariaItem(concessionaria)}
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  );
}