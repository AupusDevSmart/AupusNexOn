// src/lib/utils/date-formatters.ts

/**
 * Formata uma data para o padrão brasileiro DD/MM/YYYY HH:mm:ss
 * @param dataHora - String de data no formato ISO ou objeto Date
 * @returns String formatada no padrão brasileiro
 */
export function formatarDataHoraBR(dataHora: string | Date): string {
  const data = typeof dataHora === 'string' ? new Date(dataHora) : dataHora;

  // Verifica se a data é válida
  if (isNaN(data.getTime())) {
    return 'Data inválida';
  }

  const dia = String(data.getDate()).padStart(2, '0');
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const ano = data.getFullYear();

  const horas = String(data.getHours()).padStart(2, '0');
  const minutos = String(data.getMinutes()).padStart(2, '0');
  const segundos = String(data.getSeconds()).padStart(2, '0');

  return `${dia}/${mes}/${ano} ${horas}:${minutos}:${segundos}`;
}

/**
 * Formata uma data para o padrão brasileiro apenas com data DD/MM/YYYY
 * @param data - String de data no formato ISO ou objeto Date
 * @returns String formatada no padrão brasileiro
 */
export function formatarDataBR(data: string | Date): string {
  const dataObj = typeof data === 'string' ? new Date(data) : data;

  // Verifica se a data é válida
  if (isNaN(dataObj.getTime())) {
    return 'Data inválida';
  }

  const dia = String(dataObj.getDate()).padStart(2, '0');
  const mes = String(dataObj.getMonth() + 1).padStart(2, '0');
  const ano = dataObj.getFullYear();

  return `${dia}/${mes}/${ano}`;
}

/**
 * Formata apenas a hora no formato HH:mm:ss
 * @param dataHora - String de data no formato ISO ou objeto Date
 * @returns String formatada com apenas a hora
 */
export function formatarHoraBR(dataHora: string | Date): string {
  const data = typeof dataHora === 'string' ? new Date(dataHora) : dataHora;

  // Verifica se a data é válida
  if (isNaN(data.getTime())) {
    return 'Hora inválida';
  }

  const horas = String(data.getHours()).padStart(2, '0');
  const minutos = String(data.getMinutes()).padStart(2, '0');
  const segundos = String(data.getSeconds()).padStart(2, '0');

  return `${horas}:${minutos}:${segundos}`;
}
