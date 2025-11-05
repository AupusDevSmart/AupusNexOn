import { ConcessionariaDTO } from "./concessionaria-dto";
import { OrganizacaoDTO } from "./organizacao-dto";

export interface UsuarioDTO {
  id: string;
  status: UsuarioStatus;

  concessionarias?: ConcessionariaDTO[];
  concessionaria_atual_id?: string;
  concessionaria_atual?: ConcessionariaDTO;
  organizacao_atual: OrganizacaoDTO;

  nome: string;
  email: string;

  all_permissions: Permissao[];

  roles: Role[];

  created_at: Date;
  updated_at: Date;
}

export enum UsuarioStatus {
  ATIVO = "Ativo",
  INATIVO = "Inativo",
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
