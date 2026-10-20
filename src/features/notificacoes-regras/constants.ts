import { PAPEIS as PAPEIS_DO_NEXON, ROTULO_PAPEL, papelCanonico } from '@/store/papeis';
import type { CanalNotificacao, EventoNotificacao } from '@/services/regras-notificacao.services';

export const EVENTOS: { value: EventoNotificacao; label: string; descricao: string }[] = [
  { value: 'falha', label: 'Falha', descricao: 'Alarme de falha em equipamento' },
  { value: 'sem_comunicacao', label: 'Sem comunicação', descricao: 'Equipamento sem enviar dados há mais de X minutos' },
  { value: 'vencimento_acesso_morador', label: 'Vencimento de acesso', descricao: 'Acesso de morador perto de vencer' },
];

export const CANAIS: { value: CanalNotificacao; label: string }[] = [
  { value: 'push', label: 'Push no app' },
  { value: 'email', label: 'E-mail' },
  { value: 'whatsapp', label: 'WhatsApp' },
];

/** Papéis da spec de permissões (NEXON-20): mesma lista e rótulos do store. */
export const PAPEIS: { value: string; label: string }[] = PAPEIS_DO_NEXON.map((p) => ({ value: p, label: ROTULO_PAPEL[p] }));

export const rotuloEvento = (v: string) => EVENTOS.find((e) => e.value === v)?.label ?? v;
export const rotuloCanal = (v: string) => CANAIS.find((c) => c.value === v)?.label ?? v;
export const rotuloPapel = (v: string) => PAPEIS.find((p) => p.value === v)?.label ?? ROTULO_PAPEL[papelCanonico(v)] ?? v;
