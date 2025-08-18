export interface OrganizacaoDTO {
  id: string;
  nome: string;
  email: string;
  documento: string;
  status: string;
  preferencias?: object;
  usuarios_count: number;
}