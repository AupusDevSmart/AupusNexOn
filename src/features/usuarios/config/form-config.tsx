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
import { useUserStore } from '@/store/useUserStore';

// ✅ COMPONENTE PARA SELEÇÃO DE ROLES DINÂMICO - USANDO DADOS DA TABELA
const RoleSelector = ({ value, onChange, disabled }: any) => {
  const { roles, loading, error } = useRoles();

  // ✅ IMPORTAR useUserStore para verificar role do usuário logado
  const { user, getUserRole } = useUserStore();
  const currentUserRole = getUserRole();

  // ✅ FILTRAR ROLES: Se usuário logado é proprietário, mostrar apenas "operador"
  let availableRoles = roles;
  if (currentUserRole === 'propietario' || currentUserRole === 'proprietario') {
    availableRoles = roles.filter(role =>
      role.value === 'operador' ||
      role.value.toLowerCase() === 'operador'
    );

    // Se não encontrou "operador", mostrar mensagem de erro
    if (availableRoles.length === 0) {
      console.warn('⚠️ Role "operador" não encontrado na lista de roles disponíveis:', roles);
    }
  }

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

  // ✅ Verificar se proprietário não tem roles disponíveis (quando operador não existe)
  if ((currentUserRole === 'propietario' || currentUserRole === 'proprietario') && availableRoles.length === 0) {
    return (
      <div className="flex items-center p-3 border border-amber-200 rounded-md bg-amber-50 dark:bg-amber-950 dark:border-amber-800">
        <div className="text-sm text-amber-700 dark:text-amber-300">
          ⚠️ Você só pode cadastrar usuários com o tipo "Operador". Entre em contato com o administrador para configurar este tipo de usuário no sistema.
        </div>
      </div>
    );
  }

  // Encontrar o role atual para mostrar o label correto
  const currentRole = roles.find(role => role.value === value);

  // ✅ MODO VIEW (DISABLED): Mostrar como texto estilizado ao invés de Select desabilitado
  if (disabled) {
    return (
      <div className="flex items-center p-3 border rounded-md bg-muted/30">
        <div className="flex flex-col">
          <span className="font-medium text-sm">
            {currentRole ? currentRole.label : value || 'Não definido'}
          </span>
          <span className="text-xs text-muted-foreground">
            Role: {value || 'N/A'}
          </span>
        </div>
      </div>
    );
  }

  // ✅ MODO EDIT: Select normal para edição
  // Garantir que value seja uma string válida ou undefined (NUNCA string vazia para Select controlado)
  const selectValue = value && String(value).trim() !== '' ? String(value) : undefined;

  return (
    <Select
      key={`role-select-${selectValue || 'empty'}`}
      value={selectValue}
      onValueChange={onChange}
      disabled={disabled}
    >
      <SelectTrigger>
        <SelectValue placeholder="Selecione um tipo de usuário" />
      </SelectTrigger>
      <SelectContent>
        {availableRoles.map(role => (
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
                  onCheckedChange={(checked) => handlePermissaoChange(permissao.value as Permissao, !!checked)}
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
const EstadoSelector = ({ value, onChange, disabled, onMultipleChange }: any) => {
  const handleEstadoChange = (estado: { id: string; nome: string; sigla: string }) => {

    // Atualizar estadoId (para o CidadeSelect depender)
    if (onChange) {
      onChange(estado.id);
    }

    // ✅ Atualizar campo de estado (nome) para enviar ao backend
    if (onMultipleChange) {
      onMultipleChange({
        estadoId: estado.id,
        estado: estado.sigla // Backend espera a sigla (ex: "GO", "SP")
      });
    }
  };

  return (
    <EstadoSelect
      value={value}
      onEstadoChange={handleEstadoChange}
      disabled={disabled}
      placeholder="Selecione um estado"
    />
  );
};

// Componente para seleção de cidade com IBGE
const CidadeSelector = ({ value, onChange, disabled, estadoId, onMultipleChange }: any) => {
  const handleCidadeChange = (cidade: { id: string; nome: string }) => {

    // Atualizar cidadeId
    if (onChange) {
      onChange(cidade.id);
    }

    // ✅ Atualizar campo de cidade (nome) para enviar ao backend
    if (onMultipleChange) {
      onMultipleChange({
        cidadeId: cidade.id,
        cidade: cidade.nome // Backend espera o nome da cidade
      });
    }
  };

  return (
    <CidadeSelect
      value={value}
      onCidadeChange={handleCidadeChange}
      estadoId={estadoId ? parseInt(estadoId) : null}
      disabled={disabled}
      placeholder="Selecione uma cidade"
    />
  );
};

// Componente para CEP com busca automática
const CEPSelector = ({ value, onChange, disabled, onMultipleChange }: any) => {
  const handleEnderecoChange = (endereco: any) => {
    // Atualizar campo de endereço completo quando CEP for encontrado
    if (onMultipleChange && endereco) {
      // Concatenar endereço e bairro em um único campo
      const enderecoCompleto = [
        endereco.endereco,
        endereco.bairro
      ].filter(Boolean).join(' - ');

      // ✅ Incluir TODOS os dados do endereço + IDs do IBGE
      const dataToSend = {
        cep: endereco.cep || value, // Priorizar o CEP que veio da busca
        endereco: enderecoCompleto || endereco.endereco,
        // ✅ Incluir dados de estado e cidade do ViaCEP + IDs do IBGE
        estado: endereco.estado, // Sigla (ex: "GO")
        estadoId: endereco.estadoId, // ID do IBGE (ex: "52")
        cidade: endereco.cidade, // Nome (ex: "Goiânia")
        cidadeId: endereco.cidadeId, // ID do IBGE (ex: "5208707")
      };

      onMultipleChange(dataToSend);
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
    label: 'Endereço Completo',
    type: 'text',
    placeholder: 'Rua das Flores, 123 - Centro - Apto 101',
    group: 'localizacao',
    help: 'Inclua rua, número, bairro e complemento'
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
    group: 'permissoes',
    colSpan: 2 // Ocupa largura total
  }
];