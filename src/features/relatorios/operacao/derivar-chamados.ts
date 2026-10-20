import type { ChamadoRelatorio } from './tipos';
import { dataCurta, dataHora, duracaoLonga } from './formatos';

export interface LinhaChamado {
  numero: number;
  equipamento: string;
  titulo: string;
  aberto: string;
  por: string;
  notificado: string;
  atendido: boolean;
  situacao: string;
  detalhe: string;
}

/** Chamado conta como atendido quando FECHADO (com ou sem hora de atendimento). */
export function chamadoAtendido(c: ChamadoRelatorio): boolean {
  return c.status === 'FECHADO';
}

/** Linhas do bloco "Chamados" (padrão §9). `fim` = fim do período do relatório. */
export function linhasChamados(chamados: ChamadoRelatorio[], fim: string): LinhaChamado[] {
  // "até" mostra o dia seguinte ao último instante do período (fim do mês 23:59 → 01 do mês seguinte).
  const ate = new Date(new Date(fim).getTime() + 1000).toISOString();
  return [...chamados]
    .sort((a, b) => a.abertoEm.localeCompare(b.abertoEm))
    .map((c) => {
      const atendido = chamadoAtendido(c);
      let situacao = 'Em aberto';
      let detalhe = '';
      if (atendido) {
        situacao = c.atendidoEm ? `Atendido ${dataHora(c.atendidoEm)}` : 'Atendido';
        detalhe = c.atendidoEm
          ? `em ${duracaoLonga(new Date(c.atendidoEm).getTime() - new Date(c.abertoEm).getTime())}`
          : '';
      } else {
        const ms = new Date(ate).getTime() - new Date(c.abertoEm).getTime();
        const dias = Math.round(ms / 86_400_000);
        const quanto = dias >= 1 ? `${dias} d` : `${Math.max(0, Math.floor(ms / 3_600_000))} h`;
        detalhe = `há ${quanto} (até ${dataCurta(ate)})`;
      }
      return {
        numero: c.numero,
        equipamento: c.equipamento || '—',
        titulo: c.titulo,
        aberto: dataHora(c.abertoEm),
        por: [c.abertoPor, c.abertoPorPapel].filter(Boolean).join(' · ') || '—',
        notificado: c.notificado.length ? c.notificado.join(' · ') : '—',
        atendido,
        situacao,
        detalhe,
      };
    });
}

/** Resumo à direita do título: "2 no período · 1 em aberto". */
export function resumoChamados(chamados: ChamadoRelatorio[]): string {
  if (!chamados.length) return 'nenhum no período';
  const abertos = chamados.filter((c) => !chamadoAtendido(c)).length;
  return `${chamados.length} no período · ${abertos ? `${abertos} em aberto` : 'nenhum em aberto'}`;
}
