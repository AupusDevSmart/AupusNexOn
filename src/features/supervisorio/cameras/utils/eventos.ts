import {
  Activity,
  Camera as CameraIcon,
  Car,
  PawPrint,
  User,
  Wifi,
  WifiOff,
  type LucideIcon,
} from 'lucide-react';
import type { CameraEvento, FiltroEventos, ResumoCameras, TipoEvento } from '../types';

/** Títulos e regras de tela do contrato (`docs/cameras/API-CAMERAS.md`). */
export const TITULO_EVENTO: Record<TipoEvento, string> = {
  pessoa: 'Pessoa detectada',
  veiculo: 'Veículo detectado',
  animal: 'Animal detectado',
  movimento: 'Movimento detectado',
  sem_sinal: 'Câmera sem sinal',
  sinal_restabelecido: 'Câmera voltou',
  foto: 'Foto',
};

export const ICONE_EVENTO: Record<TipoEvento, LucideIcon> = {
  pessoa: User,
  veiculo: Car,
  animal: PawPrint,
  movimento: Activity,
  sem_sinal: WifiOff,
  sinal_restabelecido: Wifi,
  foto: CameraIcon,
};

/** Título do evento: o que a API mandou; senão o padrão do tipo. */
export function tituloEvento(ev: Pick<CameraEvento, 'tipo' | 'titulo'>): string {
  const t = ev.titulo?.trim();
  return t || TITULO_EVENTO[ev.tipo] || 'Evento';
}

export function iconeEvento(tipo: TipoEvento): LucideIcon {
  return ICONE_EVENTO[tipo] ?? Activity;
}

/** Rótulo curto do tipo, para a etiqueta colorida da lista e do player. */
export const ROTULO_TIPO: Record<TipoEvento, string> = {
  pessoa: 'Pessoa',
  veiculo: 'Veículo',
  animal: 'Animal',
  movimento: 'Movimento',
  sem_sinal: 'Sem sinal',
  sinal_restabelecido: 'Voltou',
  foto: 'Foto',
};

/**
 * Cor por tipo (texto + fundo do ícone). Paleta do Tailwind com par claro/escuro, não
 * os tokens `--warning`/`--destructive`: no tema escuro do NexON eles são claros ou
 * escuros demais para texto.
 */
export const COR_TIPO: Record<TipoEvento, string> = {
  pessoa: 'bg-red-500/10 text-red-600 dark:text-red-400',
  veiculo: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  animal: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
  movimento: 'bg-muted text-foreground/80',
  sem_sinal: 'bg-zinc-500/15 text-zinc-600 dark:text-zinc-300',
  sinal_restabelecido: 'bg-nexon-verde/10 text-nexon-verde',
  foto: 'bg-muted text-foreground/80',
};

export function rotuloTipo(tipo: TipoEvento): string {
  return ROTULO_TIPO[tipo] ?? 'Evento';
}

export function corTipo(tipo: TipoEvento): string {
  return COR_TIPO[tipo] ?? COR_TIPO.movimento;
}

export const FILTROS_EVENTOS: { valor: FiltroEventos; rotulo: string }[] = [
  { valor: 'todas', rotulo: 'Todos' },
  { valor: 'pessoas', rotulo: 'Pessoas' },
  { valor: 'veiculos', rotulo: 'Veículos' },
  { valor: 'animais', rotulo: 'Animais' },
  { valor: 'movimento', rotulo: 'Movimento' },
  { valor: 'sistema', rotulo: 'Sem sinal' },
];

const TIPOS_DO_FILTRO: Record<FiltroEventos, TipoEvento[] | undefined> = {
  todas: undefined,
  pessoas: ['pessoa'],
  veiculos: ['veiculo'],
  animais: ['animal'],
  movimento: ['movimento'],
  sistema: ['sem_sinal', 'sinal_restabelecido'],
};

/** Tipos que o chip cobre; `undefined` = sem filtro. */
export function tiposDoFiltro(filtro: FiltroEventos): TipoEvento[] | undefined {
  return TIPOS_DO_FILTRO[filtro];
}

/** Valor do parâmetro `tipo=` da API para o chip (`pessoa,veiculo`). */
export function paramTipo(filtro: FiltroEventos): string | undefined {
  return tiposDoFiltro(filtro)?.join(',');
}

/** Ponto vermelho = alerta ainda não lido. */
export function ehNaoLido(ev: Pick<CameraEvento, 'alerta' | 'lido_em'>): boolean {
  return !!ev.alerta && !ev.lido_em;
}

/** `HH:mm` local (o `formatarHoraLocal` do sinóptico dá `HH:mm:ss`). */
export function horaCurta(iso: string | null | undefined): string {
  if (!iso) return '--:--';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '--:--';
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false });
}

/** Carimbo do player: `07-11-2026 05:47:12` (hora local). */
export function carimboDataHora(instante: string | Date | null | undefined): string {
  if (!instante) return '';
  const d = instante instanceof Date ? instante : new Date(instante);
  if (Number.isNaN(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}-${mm}-${d.getFullYear()} ${d.toLocaleTimeString('pt-BR', { hour12: false })}`;
}

/** `Armado até 06:30 · 5 de 6 online` (ou `Desarmado · …`). */
export function subtituloResumo(resumo: Pick<ResumoCameras, 'armado' | 'armado_ate' | 'online' | 'total'>): string {
  let armamento = 'Desarmado';
  if (resumo.armado) armamento = resumo.armado_ate ? `Armado até ${horaCurta(resumo.armado_ate)}` : 'Armado';
  return `${armamento} · ${resumo.online} de ${resumo.total} online`;
}

/**
 * Armamento em uma frase para a faixa de status: `Armado até 06:30`, `Armado pela
 * agenda até 06:30`, `Desarmado · agenda ligada`, `Desarmado`.
 */
export function textoArmamento(resumo: Pick<ResumoCameras, 'armado' | 'armado_ate' | 'armamento_modo'>): string {
  const agenda = resumo.armamento_modo === 'agenda';
  if (resumo.armado) {
    const base = agenda ? 'Armado pela agenda' : 'Armado';
    return resumo.armado_ate ? `${base} até ${horaCurta(resumo.armado_ate)}` : base;
  }
  return agenda ? 'Desarmado · agenda ligada' : 'Desarmado';
}

/** `07/11 05:12` (hora local), para o cabeçalho do player num evento. */
export function diaHoraCurta(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm} ${horaCurta(iso)}`;
}

function plural(n: number, um: string, varios: string): string {
  return `${n} ${n === 1 ? um : varios}`;
}

/**
 * "Noite: 1 intrusão, 14 movimentos descartados. Arranjo IV3 sem sinal desde 05:30."
 * Vazio quando não há noite nem câmera sem sinal.
 */
export function textoNoite(resumo: Pick<ResumoCameras, 'noite' | 'sem_sinal'>): string {
  const partes: string[] = [];
  if (resumo.noite) {
    const { alertas, descartados } = resumo.noite;
    const itens = [
      alertas > 0 ? plural(alertas, 'intrusão', 'intrusões') : 'nenhuma intrusão',
      plural(descartados, 'movimento descartado', 'movimentos descartados'),
    ];
    partes.push(`Noite: ${itens.join(', ')}.`);
  }
  const semSinal = resumo.sem_sinal ?? [];
  if (semSinal.length === 1) {
    const c = semSinal[0];
    partes.push(`${c.camera_nome} sem sinal${c.desde ? ` desde ${horaCurta(c.desde)}` : ''}.`);
  } else if (semSinal.length > 1) {
    const nomes = semSinal.map((c) => c.camera_nome);
    partes.push(`${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]} sem sinal.`);
  }
  return partes.join(' ');
}

/** `chamado CH-0412 aberto` quando o evento abriu chamado. */
export function textoChamado(ev: Pick<CameraEvento, 'chamado_numero'>): string | null {
  if (ev.chamado_numero == null) return null;
  return `chamado CH-${String(ev.chamado_numero).padStart(4, '0')} aberto`;
}
