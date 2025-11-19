import { UsuarioDTO } from './usuarios-dto';

/**
 * DTO para requisição de login
 */
export interface LoginDto {
  email: string;
  senha: string;
}

/**
 * DTO de resposta de autenticação
 * Retornado pelo backend após login bem-sucedido
 */
export interface AuthResponseDto {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  user: UsuarioDTO;
}

/**
 * DTO para renovação de token
 */
export interface RefreshTokenDto {
  refresh_token: string;
}

/**
 * Resposta de renovação de token
 */
export interface RefreshTokenResponseDto {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}
