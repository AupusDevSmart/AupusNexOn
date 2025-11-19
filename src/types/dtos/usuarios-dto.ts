import { ConcessionariaDTO } from "./concessionaria-dto";
import { OrganizacaoDTO } from "./organizacao-dto";

export interface UsuarioDTO {
  id: string;
  status: UsuarioStatus;

  concessionarias?: ConcessionariaDTO[];
  concessionaria_atual_id?: string;
  concessionaria_atual?: ConcessionariaDTO;
  organizacao_atual?: OrganizacaoDTO | string;

  nome: string;
  email: string;
  telefone?: string;
  instagram?: string;
  cpf_cnpj?: string;
  cidade?: string;
  estado?: string;
  endereco?: string;
  cep?: string;
  manager_id?: string;
  organizacao_atual_id?: string;
  avatar_url?: string;

  all_permissions?: Permissao[] | any[];

  roles?: Role[] | string[];
  role_details?: {
    id: number;
    name: string;
    guard_name: string;
  };

  created_at?: Date | string;
  updated_at?: Date | string;
}

export enum UsuarioStatus {
  ATIVO = "Ativo",
  INATIVO = "Inativo",
  PENDENTE = "Pendente",
  BLOQUEADO = "Bloqueado",
}

export enum UsuarioRole {
  SUPER_ADMIN = "super-admin",
  ADMIN = "admin",
  CATIVO = "cativo",
  PROPIETARIO = "propietario",
  LOCATARIO = "associado",
  AUPUS = "aupus",
}

interface Role {
  id: string;
  name: string;
  description: string;
  created_at: Date;
  updated_at: Date;
}

export type Permissao =
  | "MonitoramentoConsumo"
  | "GeracaoEnergia"
  | "GestaoOportunidades"
  | "Financeiro"
  | "Oportunidades"
  | "Prospeccao"
  | "ProspeccaoListagem"
  | "MonitoramentoClientes"
  | "ClubeAupus"
  | "Usuarios"
  | "Organizacoes"
  | "AreaDoProprietario"
  | "UnidadesConsumidoras"
  | "Configuracoes"
  | "AreaDoAssociado"
  | "Documentos"
  | "Associados"
  | "MinhasUsinas"
  | "Dashboard"
  | "SCADA"
  | "supervisorio"
  | "Plantas"
  | "Equipamentos"
  | "Concessionarias";

// DTOs para atualização de perfil
export interface UpdateUsuarioDto {
  nome?: string;
  email?: string;
  telefone?: string;
  instagram?: string;
  cpfCnpj?: string;
  cidade?: string;
  estado?: string;
  endereco?: string;
  cep?: string;
  status?: UsuarioStatus;
  managerId?: string;
  concessionariaAtualId?: string;
  organizacaoAtualId?: string;
  roleId?: number;
  permissionIds?: number[];
  clearDirectPermissions?: boolean;
  clearRole?: boolean;
}

export interface ChangePasswordDto {
  senhaAtual: string;
  novaSenha: string;
}
