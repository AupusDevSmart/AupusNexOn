// src/features/usuarios/config/form-config.tsx - ATUALIZADO PARA DTO
import { useEffect, useMemo, useRef } from 'react';
import { FormField } from '@/core/types/base';
import {  Permissao } from '../types';
import { Checkbox } from '@/core/components/ui/checkbox';
import { Button } from '@/core/components/ui/button';
import { Badge } from '@/core/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/core/components/ui/select';
import { EstadoSelect } from '@/core/components/common/EstadoSelect';
import { CidadeSelect } from '@/core/components/common/CidadeSelect';
import { CEPInput } from '@/core/components/common/CEPInput';
import { GerenteSelect } from '@/core/components/common/GerenteSelect';
import { ConcessionariaSelect } from '@/core/components/common/ConcessionariaSelect';
import { OrganizacaoSelect } from '@/core/components/common/OrganizacaoSelect';
import { useRoles, usePermissoesGrouped, useUserStore } from '@/core/context/hooks';

// Normaliza o valor recebido pelo selector de permissoes para sempre ser string[]
const normalizePermissionValue = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item: any) => {
      if (typeof item === 'string') return item;
      if (item && typeof item === 'object') {
        return item.name || item.value || item.permission || '';
      }
      return '';
    })
    .filter((v): v is string => typeof v === 'string' && v.length > 0);
};

// Mapeia nomes tecnicos `recurso.acao` para nomes humanizados em portugues.
// Ex.: `anomalias.create` -> "Criar anomalia"; `dashboard.view` -> "Visualizar dashboard".
// Quando o backend ja entrega um display_name diferente do name, ele eh respeitado.
const RESOURCE_LABELS: Record<string, string> = {
  anomalias: 'anomalia',
  usuarios: 'usuário',
  plantas: 'planta',
  unidades: 'unidade',
  equipamentos: 'equipamento',
  organizacoes: 'organização',
  ugs: 'UG',
  concessionarias: 'concessionária',
  dashboard: 'dashboard',
  monitoramento: 'monitoramento',
  scada: 'SCADA',
  supervisorio: 'supervisório',
  controle: 'controle',
  prospeccao: 'prospecção',
  prospec: 'prospecção',
  oportunidades: 'oportunidade',
  financeiro: 'financeiro',
  clube: 'clube',
  configuracoes: 'configuração',
  documentos: 'documento',
  relatorios: 'relatório',
  admin: 'administração',
  equipe: 'equipe',
  permissions: 'permissão',
  roles: 'role',
  agenda: 'agenda',
  feriados: 'feriado',
  veiculos: 'veículo',
  planos: 'plano',
  tarefas: 'tarefa',
  manutencao: 'manutenção',
  diagramas: 'diagrama',
  iot: 'IoT',
  ota: 'OTA',
  mqtt: 'MQTT',
  logs: 'log',
};

const ACTION_LABELS: Record<string, string> = {
  view: 'Visualizar',
  list: 'Listar',
  create: 'Criar',
  update: 'Editar',
  edit: 'Editar',
  delete: 'Excluir',
  remove: 'Remover',
  manage: 'Gerenciar',
  export: 'Exportar',
  import: 'Importar',
  approve: 'Aprovar',
  reject: 'Rejeitar',
  assign: 'Atribuir',
  read: 'Visualizar',
  write: 'Editar',
  admin: 'Administrar',
  all: 'Acesso total',
};

const titleCase = (s: string) =>
  s ? s.charAt(0).toUpperCase() + s.slice(1) : s;

const humanizePermissionName = (name: string): string => {
  if (!name) return '';
  const [resource, action, ...rest] = name.split('.');
  const resourceLabel = RESOURCE_LABELS[resource] ?? resource.replace(/_/g, ' ');
  if (!action) return titleCase(resourceLabel);
  const actionLabel = ACTION_LABELS[action] ?? titleCase(action);
  const suffix = rest.length ? ' (' + rest.join('.') + ')' : '';
  return `${actionLabel} ${resourceLabel}${suffix}`;
};

// Decide qual texto usar no checkbox: prioriza display_name do backend
// (apenas se diferente do nome tecnico) e cai no humanizador caso contrario.
const getPermissionLabel = (permissao: { value: string; label?: string }): string => {
  if (permissao.label && permissao.label !== permissao.value) {
    return permissao.label;
  }
  return humanizePermissionName(permissao.value);
};

// ✅ COMPONENTE PARA SELEÇÃO DE ROLES DINÂMICO - USANDO DADOS DA TABELA
const RoleSelector = ({ value, onChange, disabled }: any) => {
  const { roles, loading, error } = useRoles();

  // ✅ IMPORTAR useUserStore para verificar role do usuário logado
  const { user, getUserRole } = useUserStore();
  const currentUserRole = getUserRole();

  // Roles permitidas no sistema
  const allowedRoles = ['super_admin', 'admin', 'gerente', 'analista', 'proprietario', 'operador'];

  // Filtrar apenas roles permitidas
  let availableRoles = roles.filter(role =>
    allowedRoles.includes(role.value.toLowerCase())
  );

  // Se usuário logado é proprietário, mostrar apenas "operador"
  if (currentUserRole === 'propietario' || currentUserRole === 'proprietario') {
    availableRoles = availableRoles.filter(role =>
      role.value.toLowerCase() === 'operador'
    );
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
        <span className="font-medium text-sm">
          {currentRole ? currentRole.label : value || 'Não definido'}
        </span>
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
            <span className="font-medium">{role.label}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

// COMPONENTE DINAMICO PARA SELECAO DE PERMISSOES
// - Marca corretamente as permissoes do usuario em modo edit/view (normaliza value)
// - Em modo create, preenche permissoes padrao quando o usuario escolhe um tipo
// - Permite marcar/desmarcar permissoes individuais alem das herdadas pela role
const PermissoesSelector = ({ value, onChange, disabled, formData, mode }: any) => {
  const { permissoesPorCategoria, loading, error } = usePermissoesGrouped();
  const { roles } = useRoles();

  // Sempre trabalha com strings na UI; o pai recebe array de strings via onChange
  const permissoesSelecionadas = useMemo(() => normalizePermissionValue(value), [value]);

  // Role atualmente selecionada no form (campo roleNames pode ser string ou string[])
  const currentRoleName: string | undefined = (() => {
    const raw = formData?.roleNames;
    if (Array.isArray(raw)) return raw[0];
    if (typeof raw === 'string' && raw.trim()) return raw;
    return undefined;
  })();

  const currentRole = roles.find((r: any) => r.value === currentRoleName);
  const rolePermissions: string[] = useMemo(
    () => (Array.isArray(currentRole?.permissions) ? currentRole.permissions : []),
    [currentRole]
  );

  // Auto-marcar permissoes padrao quando o usuario muda a role em modo CREATE.
  // Em edit/view, mantem o set existente para preservar overrides; o botao
  // "Aplicar permissoes padrao da role" abaixo permite reset manual.
  const lastAppliedRoleRef = useRef<string | null>(null);
  useEffect(() => {
    if (mode !== 'create') return;
    if (!currentRoleName) return;
    if (rolePermissions.length === 0) return;
    if (lastAppliedRoleRef.current === currentRoleName) return;

    lastAppliedRoleRef.current = currentRoleName;
    onChange(rolePermissions);
  }, [mode, currentRoleName, rolePermissions, onChange]);

  const handlePermissaoChange = (permissaoValue: string, checked: boolean) => {
    const setAtual = new Set(permissoesSelecionadas);
    if (checked) setAtual.add(permissaoValue);
    else setAtual.delete(permissaoValue);
    onChange(Array.from(setAtual));
  };

  const handleAplicarRoleDefaults = () => {
    if (rolePermissions.length === 0) return;
    onChange([...rolePermissions]);
  };

  const handleLimparTodas = () => {
    onChange([]);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8 border rounded-lg">
        <div className="text-sm text-muted-foreground">
          Carregando permissoes...
        </div>
      </div>
    );
  }

  if (error && Object.keys(permissoesPorCategoria).length === 0) {
    return (
      <div className="flex items-center justify-center p-8 border border-destructive/30 rounded-lg bg-destructive/5">
        <div className="text-center">
          <div className="text-sm text-destructive mb-2">
            Nao foi possivel carregar as permissoes
          </div>
          <div className="text-xs text-muted-foreground">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {!disabled && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAplicarRoleDefaults}
            disabled={!currentRoleName || rolePermissions.length === 0}
            title={
              currentRoleName
                ? `Marca as permissoes padrao da role ${currentRoleName}`
                : 'Selecione um tipo de usuario primeiro'
            }
          >
            Aplicar padrao da role
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleLimparTodas}
            disabled={permissoesSelecionadas.length === 0}
          >
            Desmarcar todas
          </Button>
          {currentRoleName && rolePermissions.length > 0 && (
            <span className="text-muted-foreground">
              Role <span className="font-medium">{currentRoleName}</span> traz {rolePermissions.length} permissoes padrao.
            </span>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-72 overflow-y-auto border rounded-lg p-4">
        {Object.entries(permissoesPorCategoria).map(([categoria, permissoes]) => (
          <div key={categoria} className="space-y-2">
            <h4 className="font-medium text-sm text-muted-foreground border-b pb-1">
              {categoria}
            </h4>
            {permissoes.map((permissao: any) => {
              const checked = permissoesSelecionadas.includes(permissao.value);
              const isFromRole = rolePermissions.includes(permissao.value);
              const isExtra = checked && !isFromRole;
              return (
                <div key={permissao.value} className="flex items-center gap-2">
                  <Checkbox
                    id={permissao.value}
                    checked={checked}
                    onCheckedChange={(c) =>
                      handlePermissaoChange(permissao.value as Permissao, !!c)
                    }
                    disabled={disabled}
                  />
                  <label
                    htmlFor={permissao.value}
                    className="text-sm cursor-pointer flex-1"
                    title={permissao.description || permissao.value}
                  >
                    {getPermissionLabel(permissao)}
                  </label>
                  {isFromRole && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                      padrao
                    </Badge>
                  )}
                  {isExtra && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      extra
                    </Badge>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div className="text-xs text-muted-foreground">
        {permissoesSelecionadas.length} permissao(oes) selecionada(s)
        {error && <span className="text-amber-600 ml-2">{error}</span>}
      </div>
    </div>
  );
};

// Componente para seleção de estado com IBGE
const EstadoSelector = ({ value, onChange, disabled, onMultipleChange, formData }: any) => {
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
      displayValue={formData?.estado}
      onEstadoChange={handleEstadoChange}
      disabled={disabled}
      placeholder="Selecione um estado"
    />
  );
};

// Componente para seleção de cidade com IBGE
const CidadeSelector = ({ value, onChange, disabled, estadoId, onMultipleChange, formData }: any) => {
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
      displayValue={formData?.cidade}
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