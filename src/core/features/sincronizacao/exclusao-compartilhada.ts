/** O que a exclusão alcança de compartilhado (GET /sincronizacao/vinculos/:recurso/:id/cascata) */
export interface CompartilhadosNaCascata {
  total: number;
  plantas: number;
  unidades: number;
  equipamentos: number;
  usuarios: number;
  nomesDasInstalacoes: string[];
}

/** O que "apagar aqui também" leva junto (GET /sincronizacao/exclusoes/:id/alcance) */
export interface AlcanceDoAviso {
  /** Vivos aqui, debaixo do registro */
  unidades: number;
  equipamentos: number;
  /** Destes, os que não foram apagados no outro produto (existem só aqui, ou continuam lá) */
  naoApagadosLa: { unidades: number; equipamentos: number; nomesDasInstalacoes: string[] };
}

type Quantos = Partial<Record<'plantas' | 'unidades' | 'equipamentos' | 'usuarios', number>>;

/** "1 planta, 3 instalações e 12 equipamentos" (a mesma frase da recusa da API) */
export function descreverCompartilhados(c: Quantos): string {
  const partes = [
    c.plantas && `${c.plantas} ${c.plantas === 1 ? 'planta' : 'plantas'}`,
    c.unidades && `${c.unidades} ${c.unidades === 1 ? 'instalação' : 'instalações'}`,
    c.equipamentos && `${c.equipamentos} ${c.equipamentos === 1 ? 'equipamento' : 'equipamentos'}`,
    c.usuarios && `${c.usuarios} ${c.usuarios === 1 ? 'usuário' : 'usuários'}`,
  ].filter(Boolean) as string[];
  return partes.length <= 1 ? (partes[0] ?? '') : `${partes.slice(0, -1).join(', ')} e ${partes[partes.length - 1]}`;
}

const normalizar = (texto: string) => texto.normalize('NFC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR');

/** O nome digitado confere com o do registro: sem caixa e sem espaço sobrando (o acento conta) */
export const nomeConfere = (digitado: string, nome: string) => normalizar(digitado) !== '' && normalizar(digitado) === normalizar(nome);
