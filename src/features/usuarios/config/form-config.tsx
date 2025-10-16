// src/features/usuarios/config/form-config.tsx - ATUALIZADO PARA DTO
import { FormField } from '@/types/base';
import {  Permissao } from '../types';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { EstadoSelect } from '@/components/common/EstadoSelect';
import { CidadeSelect } from '@/components/common/CidadeSelect';
import { CEPInput } from '@/components/common/CEPInput';
import { GerenteSelect } from '@/components/common/GerenteSelect';
import { ConcessionariaSelect } from '@/components/common/ConcessionariaSelect';
import { OrganizacaoSelect } from '@/components/common/OrganizacaoSelect';
import { useRoles } from '@/hooks/useRoles';
import { usePermissoes, usePermissoesGrouped } from '@/hooks/usePermissoes';

// ✅ COMPONENTE PARA SELEÇÃO DE ROLES DINÂMICO - USANDO DADOS DA TABELA
const RoleSelector = ({ value, onChange, disabled }: any) => {
  const { roles, loading, error } = useRoles();
  
  console.log('🔍 [RoleSelector] Debug:', { value, roles, loading, error });
  
  if (loading) {
    return (
      <Select disabled>
        <SelectTrigger>
          <SelectValue placeholder="Carregando tipos de usuário..." />
        </SelectTrigger>
      </Select>
    );
  }

  if (error && roles.length === 0) {
    return (
      <div className="flex items-center p-3 border border-red-200 rounded-md bg-red-50">
        <div className="text-sm text-red-600">
          ❌ Erro ao carregar tipos de usuário: {error}
        </div>
      </div>
    );
  }

  // Encontrar o role atual para mostrar o label correto
  const currentRole = roles.find(role => role.value === value);
  console.log('🔍 [RoleSelector] Role atual encontrado:', currentRole);

  return (
    <Select
      value={value || ''}
      onValueChange={onChange}
      disabled={disabled}
    >
      <SelectTrigger>
        <SelectValue placeholder="Selecione um tipo de usuário">
          {currentRole ? currentRole.label : value || ''}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {roles.map(role => (
          <SelectItem key={role.value} value={role.value}>
            <div className="flex flex-col">
              <span className="font-medium">{role.label}</span>
              <span className="text-xs text-muted-foreground">Valor: {role.value}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

// ✅ COMPONENTE DINÂMICO PARA SELEÇÃO DE PERMISSÕES
const PermissoesSelector = ({ value, onChange, disabled }: any) => {
  // ✅ USAR ENDPOINT OTIMIZADO (dados já vêm agrupados do backend)
  const { permissoesPorCategoria, loading, error } = usePermissoesGrouped();
  
  // Fallback para hook normal se necessário
  // const { permissoesPorCategoria, loading, error } = usePermissoes();
  
  const permissoesSelecionadas = value || [];
  
  console.log('🔍 [PermissoesSelector] Debug:', { 
    value, 
    permissoesSelecionadas, 
    loading, 
    error,
    categorias: Object.keys(permissoesPorCategoria)
  });
  
  if (error) {
    console.warn('Erro ao carregar permissões:', error);
  }
  
  const handlePermissaoChange = (permissao: Permissao, checked: boolean) => {
    let novasPermissoes;
    if (checked) {
      novasPermissoes = [...permissoesSelecionadas, permissao];
    } else {
      novasPermissoes = permissoesSelecionadas.filter((p: Permissao) => p !== permissao);
    }
    onChange(novasPermissoes);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8 border rounded-lg">
        <div className="text-sm text-muted-foreground">
          Carregando permissões...
        </div>
      </div>
    );
  }

  if (error && Object.keys(permissoesPorCategoria).length === 0) {
    return (
      <div className="flex items-center justify-center p-8 border border-red-200 rounded-lg bg-red-50">
        <div className="text-center">
          <div className="text-sm text-red-600 mb-2">
            ❌ Não foi possível carregar as permissões
          </div>
          <div className="text-xs text-red-500">
            {error}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">   
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-64 overflow-y-auto border rounded-lg p-4">
        {Object.entries(permissoesPorCategoria).map(([categoria, permissoes]) => (
          <div key={categoria} className="space-y-2">
            <h4 className="font-medium text-sm text-muted-foreground border-b pb-1">
              {categoria}
            </h4>
            {permissoes.map((permissao) => (
              <div key={permissao.value} className="flex items-center space-x-2">
                <Checkbox
                  id={permissao.value}
                  checked={permissoesSelecionadas.includes(permissao.value)}
                  onCheckedChange={(checked) => handlePermissaoChange(permissao.value, !!checked)}
                  disabled={disabled}
                />
                <label 
                  htmlFor={permissao.value}
                  className="text-sm cursor-pointer"
                  title={permissao.description} // Tooltip com descrição se disponível
                >
                  {permissao.label}
                </label>
              </div>
            ))}
          </div>
        ))}
      </div>
      
      <div className="text-xs text-muted-foreground">
        {permissoesSelecionadas.length} permissão(ões) selecionada(s)
        {error && (
          <span className="text-orange-600 ml-2">
            ⚠️ {error}
          </span>
        )}
        {!error && Object.keys(permissoesPorCategoria).length > 0 && (
          <span className="text-green-600 ml-2">
            ✅ Usando categorização do backend
          </span>
        )}
      </div>
    </div>
  );
};

// Componente para seleção de estado com IBGE
const EstadoSelector = ({ value, onChange, disabled }: any) => {
  return (
    <EstadoSelect
      value={value}
      onValueChange={onChange}
      disabled={disabled}
      placeholder="Selecione um estado"
    />
  );
};

// Componente para seleção de cidade com IBGE
const CidadeSelector = ({ value, onChange, disabled, estadoId }: any) => {
  return (
    <CidadeSelect
      value={value}
      onValueChange={onChange}
      estadoId={estadoId ? parseInt(estadoId) : null}
      disabled={disabled}
      placeholder="Selecione uma cidade"
    />
  );
};

// Componente para CEP com busca automática
const CEPSelector = ({ value, onChange, disabled, onMultipleChange }: any) => {
  const handleEnderecoChange = (endereco: any) => {
    // Atualizar outros campos do formulário quando CEP for encontrado
    if (onMultipleChange) {
      onMultipleChange({
        endereco: endereco.endereco,
        bairro: endereco.bairro,
        // Nota: cidade e estado ficam nos selects IBGE separados
      });
    }
  };

  return (
    <CEPInput
      value={value}
      onChange={onChange}
      onEnderecoChange={handleEnderecoChange}
      disabled={disabled}
      placeholder="Digite o CEP (ex: 01234-567)"
      autoSearch={true}
    />
  );
};

// Componente para seleção de gerente responsável
const GerenteSelector = ({ value, onChange, disabled }: any) => {
  return (
    <GerenteSelect
      value={value}
      onValueChange={onChange}
      disabled={disabled}
      placeholder="Selecione o gerente responsável"
    />
  );
};

// Componente para seleção de concessionária
const ConcessionariaSelector = ({ value, onChange, disabled }: any) => {
  return (
    <ConcessionariaSelect
      value={value}
      onValueChange={onChange}
      disabled={disabled}
      placeholder="Selecione a concessionária"
    />
  );
};

// Componente para seleção de organização
const OrganizacaoSelector = ({ value, onChange, disabled }: any) => {
  return (
    <OrganizacaoSelect
      value={value}
      onValueChange={onChange}
      disabled={disabled}
      placeholder="Selecione a organização"
    />
  );
};

export const usuariosFormFields: FormField[] = [
  // ✅ INFORMAÇÕES BÁSICAS
  {
    key: 'nome',
    label: 'Nome Completo',
    type: 'text',
    required: true,
    placeholder: 'Ex: João Silva Santos',
    group: 'informacoes_basicas'
  },
  {
    key: 'email',
    label: 'E-mail',
    type: 'email',
    required: true,
    placeholder: 'joao@email.com',
    group: 'informacoes_basicas',
    validation: (value) => {
      if (!value) return null;
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(String(value))) {
        return 'E-mail deve ter um formato válido';
      }
      return null;
    },
  },
  {
    key: 'telefone',
    label: 'Telefone',
    type: 'text',
    placeholder: '(11) 99999-9999',
    group: 'informacoes_basicas'
  },
  {
    key: 'instagram',
    label: 'Instagram',
    type: 'text',
    placeholder: '@usuario',
    group: 'informacoes_basicas'
  },
  {
    key: 'cpfCnpj',
    label: 'CPF/CNPJ',
    type: 'text',
    placeholder: '123.456.789-10',
    group: 'informacoes_basicas'
  },
  
  // ✅ LOCALIZAÇÃO
  {
    key: 'cep',
    label: 'CEP',
    type: 'custom',
    required: false,
    render: CEPSelector,
    group: 'localizacao'
  },
  {
    key: 'estadoId',
    label: 'Estado',
    type: 'custom',
    required: false,
    render: EstadoSelector,
    group: 'localizacao'
  },
  {
    key: 'cidadeId',
    label: 'Cidade',
    type: 'custom',
    required: false,
    render: CidadeSelector,
    group: 'localizacao',
    dependencies: ['estadoId']
  },
  {
    key: 'endereco',
    label: 'Endereço',
    type: 'text',
    placeholder: 'Rua das Flores, 123',
    group: 'localizacao'
  },
  {
    key: 'bairro',
    label: 'Bairro',
    type: 'text',
    placeholder: 'Centro',
    group: 'localizacao'
  },
  {
    key: 'complemento',
    label: 'Complemento',
    type: 'text',
    placeholder: 'Apto 101, Bloco A',
    group: 'localizacao'
  },
  
  // ✅ CONFIGURAÇÕES DO SISTEMA
  {
    key: 'roleNames',
    label: 'Tipo de Usuário',
    type: 'custom',
    required: true,
    render: RoleSelector,
    group: 'configuracoes',
    help: 'Role atual do usuário no sistema'
  },
  {
    key: 'status',
    label: 'Status',
    type: 'select',
    required: true,
    defaultValue: 'Ativo',
    options: [
      { value: 'Ativo', label: 'Ativo' },
      { value: 'Inativo', label: 'Inativo' }
    ],
    group: 'configuracoes'
  },
  
  // ✅ PERMISSÕES
  {
    key: 'permissions',
    label: 'Permissões',
    type: 'custom',
    required: false,
    render: PermissoesSelector,
    group: 'permissoes'
  },
  
  // ✅ ORGANIZACIONAL (OPCIONAL)
  {
    key: 'managerId',
    label: 'Gerente Responsável',
    type: 'custom',
    required: false,
    render: GerenteSelector,
    group: 'organizacional'
  },
  {
    key: 'concessionariaAtualId',
    label: 'Concessionária Atual',
    type: 'custom',
    required: false,
    render: ConcessionariaSelector,
    group: 'organizacional'
  },
  {
    key: 'organizacaoAtualId',
    label: 'Organização Atual',
    type: 'custom',
    required: false,
    render: OrganizacaoSelector,
    group: 'organizacional'
  }
];