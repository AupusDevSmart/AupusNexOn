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

export const PAPEIS: { value: string; label: string }[] = [
  { value: 'super_admin', label: 'Super admin' },
  { value: 'admin', label: 'Administrador' },
  { value: 'gerente', label: 'Gerente' },
  { value: 'analista', label: 'Analista' },
  { value: 'operador', label: 'Operador' },
  { value: 'proprietario', label: 'Proprietário' },
];

export const rotuloEvento = (v: string) => EVENTOS.find((e) => e.value === v)?.label ?? v;
export const rotuloCanal = (v: string) => CANAIS.find((c) => c.value === v)?.label ?? v;
export const rotuloPapel = (v: string) => PAPEIS.find((p) => p.value === v)?.label ?? v;
