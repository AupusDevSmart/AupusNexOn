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
import { Building2, Users, Mail, FileText } from 'lucide-react';
import { useOrganizacoes } from '@/hooks/useOrganizacoes';
import { OrganizacaoDTO } from '@/types/dtos/organizacao-dto';

interface OrganizacaoSelectProps {
  value?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function OrganizacaoSelect({
  value,
  onValueChange,
  placeholder = "Selecione uma organização",
  className = "",
  disabled = false
}: OrganizacaoSelectProps) {
  const { organizacoes, loading, error } = useOrganizacoes();

  // Filtrar apenas organizações ativas
  const organizacoesAtivas = useMemo(() => {
    return organizacoes.filter(org => org.status === 'Ativo');
  }, [organizacoes]);

  const selectedOrganizacao = useMemo(() => {
    return organizacoes.find(org => org.id === value);
  }, [organizacoes, value]);

  if (error) {
    return (
      <div className="text-red-500 text-sm">
        Erro ao carregar organizações: {error}
      </div>
    );
  }

  const renderOrganizacaoItem = (organizacao: OrganizacaoDTO) => {
    const isInativa = organizacao.status !== 'Ativo';
    
    return (
      <div className={`flex items-center gap-3 p-2 ${isInativa ? 'opacity-60' : ''}`}>
        <Avatar className="h-10 w-10">
          <AvatarFallback className="bg-purple-100 text-purple-700 text-sm">
            <Building2 className="h-5 w-5" />
          </AvatarFallback>
        </Avatar>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
              {organizacao.nome}
            </p>
            {isInativa && (
              <Badge variant="secondary" className="text-xs bg-gray-100 text-gray-600">
                Inativa
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1">
            <div className="flex items-center gap-1">
              <Mail className="h-3 w-3 text-gray-400" />
              <span className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[120px]">
                {organizacao.email}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <FileText className="h-3 w-3 text-gray-400" />
              <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                {organizacao.documento}
              </span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-1 text-xs text-gray-500">
          <Users className="h-3 w-3" />
          <span>{organizacao.usuarios_count}</span>
        </div>
      </div>
    );
  };

  const renderSelectedValue = () => {
    if (!selectedOrganizacao) {
      return <span className="text-muted-foreground">{placeholder}</span>;
    }

    const isInativa = selectedOrganizacao.status !== 'Ativo';
    
    return (
      <div className="flex items-center gap-2">
        <Avatar className="h-6 w-6">
          <AvatarFallback className="bg-purple-100 text-purple-700 text-xs">
            <Building2 className="h-3 w-3" />
          </AvatarFallback>
        </Avatar>
        <div className="flex items-center gap-2">
          <span className={`text-sm font-medium truncate ${isInativa ? 'opacity-60' : ''}`}>
            {selectedOrganizacao.nome}
          </span>
          {isInativa && (
            <Badge variant="secondary" className="text-xs bg-gray-100 text-gray-600">
              Inativa
            </Badge>
          )}
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
            <span className="text-muted-foreground">Carregando organizações...</span>
          ) : (
            renderSelectedValue()
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="w-[500px]">
        {organizacoesAtivas.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            {organizacoes.length === 0 
              ? 'Nenhuma organização encontrada'
              : 'Nenhuma organização ativa encontrada'
            }
          </div>
        ) : (
          organizacoesAtivas.map((organizacao) => (
            <SelectItem 
              key={organizacao.id} 
              value={organizacao.id} 
              className="p-0 focus:bg-muted/50"
            >
              {renderOrganizacaoItem(organizacao)}
            </SelectItem>
          ))
        )}
        
        {/* Mostrar organizações inativas separadamente */}
        {organizacoes.some(org => org.status !== 'Ativo') && (
          <>
            <div className="px-2 py-1 text-xs font-medium text-muted-foreground border-t mt-1">
              Organizações Inativas
            </div>
            {organizacoes
              .filter(org => org.status !== 'Ativo')
              .map((organizacao) => (
                <SelectItem 
                  key={organizacao.id} 
                  value={organizacao.id} 
                  className="p-0 focus:bg-muted/50"
                >
                  {renderOrganizacaoItem(organizacao)}
                </SelectItem>
              ))
            }
          </>
        )}
      </SelectContent>
    </Select>
  );
}