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
import { Building2, Crown } from 'lucide-react';
import { useUsuarios } from '@/features/usuarios/hooks/useUsuarios';
import { Usuario } from '@/features/usuarios/types';

interface GerenteSelectProps {
  value?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function GerenteSelect({
  value,
  onValueChange,
  placeholder = "Selecione um gerente",
  className = "",
  disabled = false
}: GerenteSelectProps) {
  const { usuarios, loading, error } = useUsuarios();

  // Filtrar apenas usuários com role de gerente ou admin
  const gerentes = useMemo(() => {
    return usuarios.filter(usuario => 
      usuario.roles?.some(role => 
        role.name === 'gerente' || role.name === 'admin'
      )
    );
  }, [usuarios]);

  const selectedGerente = useMemo(() => {
    return gerentes.find(gerente => gerente.id === value);
  }, [gerentes, value]);

  if (error) {
    return (
      <div className="text-red-500 text-sm">
        Erro ao carregar gerentes: {error}
      </div>
    );
  }

  const renderGerenteItem = (gerente: Usuario) => {
    const isAdmin = gerente.roles?.some(role => role.name === 'admin');
    const roleDisplay = isAdmin ? 'Administrador' : 'Gerente';
    
    return (
      <div className="flex items-center gap-3 p-2">
        <Avatar className="h-8 w-8">
          <AvatarFallback className="bg-blue-100 text-blue-700 text-xs">
            {gerente.nome.substring(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
              {gerente.nome}
            </p>
            {isAdmin && <Crown className="h-3 w-3 text-yellow-500" />}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
              {gerente.email}
            </p>
            <Badge 
              variant="secondary" 
              className={`text-xs ${isAdmin 
                ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300' 
                : 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
              }`}
            >
              {roleDisplay}
            </Badge>
          </div>
        </div>
        
        {gerente.organizacao_atual && (
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <Building2 className="h-3 w-3" />
            <span className="max-w-[80px] truncate">
              {gerente.organizacao_atual.nome}
            </span>
          </div>
        )}
      </div>
    );
  };

  const renderSelectedValue = () => {
    if (!selectedGerente) {
      return <span className="text-muted-foreground">{placeholder}</span>;
    }

    const isAdmin = selectedGerente.roles?.some(role => role.name === 'admin');
    
    return (
      <div className="flex items-center gap-2">
        <Avatar className="h-6 w-6">
          <AvatarFallback className="bg-blue-100 text-blue-700 text-xs">
            {selectedGerente.nome.substring(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex items-center gap-1">
          <span className="text-sm font-medium">
            {selectedGerente.nome}
          </span>
          {isAdmin && <Crown className="h-3 w-3 text-yellow-500" />}
        </div>
      </div>
    );
  };

  return (
    <Select 
      value={value} 
      onValueChange={onValueChange}
      disabled={disabled || loading}
    >
      <SelectTrigger className={`min-h-[44px] ${className}`}>
        <SelectValue>
          {loading ? (
            <span className="text-muted-foreground">Carregando gerentes...</span>
          ) : (
            renderSelectedValue()
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="w-[400px]">
        {gerentes.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            Nenhum gerente encontrado
          </div>
        ) : (
          gerentes.map((gerente) => (
            <SelectItem 
              key={gerente.id} 
              value={gerente.id} 
              className="p-0 focus:bg-muted/50"
            >
              {renderGerenteItem(gerente)}
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  );
}