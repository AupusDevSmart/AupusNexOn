export interface RegraLog {
  id: string;
  equipamento_id: string;
  nome: string;
  campo_json: string;
  operador: string;
  valor: number;
  mensagem: string;
  severidade: string;
  cooldown_minutos: number;
  ativo: boolean;
  created_at: string;
  updated_at: string;
  createdAt: string;
  updatedAt: string;
  equipamento?: { id: string; nome: string };
}

export interface RegrasLogsFilters {
  search: string;
  equipamentoId: string;
  severidade: string;
  ativo: string;
  page: number;
  limit: number;
}

export const SEVERIDADES = ['BAIXA', 'MEDIA', 'ALTA', 'CRITICA'] as const;
export type Severidade = (typeof SEVERIDADES)[number];

export const OPERADORES = [
  { value: '<', label: 'Menor que (<)' },
  { value: '>', label: 'Maior que (>)' },
  { value: '<=', label: 'Menor ou igual (<=)' },
  { value: '>=', label: 'Maior ou igual (>=)' },
  { value: '==', label: 'Igual (==)' },
  { value: '!=', label: 'Diferente (!=)' },
] as const;

export const SEVERIDADE_COLORS: Record<string, string> = {
  BAIXA: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  MEDIA: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  ALTA: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
  CRITICA: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
};
