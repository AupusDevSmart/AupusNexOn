import { useEffect, useMemo, useState } from 'react';
import { Loader2, Users } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { MultiSelect } from '@/components/ui/multi-select';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { PlantasService } from '@/services/plantas.services';
import { UsuariosService } from '@/services/usuarios.services';
import {
  Destinatario,
  EventoNotificacao,
  RegraNotificacao,
  RegrasNotificacaoService,
  SalvarRegraNotificacaoDto,
} from '@/services/regras-notificacao.services';
import { CANAIS, EVENTOS, PAPEIS, rotuloPapel } from '../constants';

type Modo = 'create' | 'edit' | 'view';

interface Props {
  isOpen: boolean;
  mode: Modo;
  regra?: RegraNotificacao | null;
  onClose: () => void;
  onSuccess: () => void;
}

const vazio: SalvarRegraNotificacaoDto = {
  nome: '',
  evento: 'falha',
  limite_minutos: 30,
  antecedencia_dias: 7,
  canais: ['push'],
  papeis: [],
  planta_ids: [],
  usuario_ids: [],
  ativo: true,
};

function alternar<T>(lista: T[], item: T) {
  return lista.includes(item) ? lista.filter((i) => i !== item) : [...lista, item];
}

export function RegraNotificacaoModal({ isOpen, mode, regra, onClose, onSuccess }: Props) {
  const [form, setForm] = useState<SalvarRegraNotificacaoDto>(vazio);
  const [salvando, setSalvando] = useState(false);
  const [plantas, setPlantas] = useState<{ value: string; label: string }[]>([]);
  const [usuarios, setUsuarios] = useState<{ value: string; label: string }[]>([]);
  const [destinatarios, setDestinatarios] = useState<Destinatario[] | null>(null);
  const somenteLeitura = mode === 'view';

  useEffect(() => {
    if (!isOpen) return;
    setForm(
      regra
        ? {
            nome: regra.nome,
            evento: regra.evento,
            limite_minutos: regra.limite_minutos ?? 30,
            antecedencia_dias: regra.antecedencia_dias ?? 7,
            canais: regra.canais,
            papeis: regra.papeis,
            planta_ids: regra.planta_ids,
            usuario_ids: regra.usuario_ids,
            ativo: regra.ativo,
          }
        : vazio,
    );
    setDestinatarios(null);
    if (regra?.id) {
      RegrasNotificacaoService.destinatarios(regra.id)
        .then((r) => setDestinatarios(r.usuarios))
        .catch(() => setDestinatarios([]));
    }
  }, [isOpen, regra]);

  useEffect(() => {
    if (!isOpen || plantas.length) return;
    PlantasService.getAllPlantas({ limit: 100 })
      .then((r) => setPlantas((r.data || []).map((p) => ({ value: String(p.id).trim(), label: p.nome }))))
      .catch(() => setPlantas([]));
    UsuariosService.getUsuariosBasicos({ limit: 100 })
      .then((lista) =>
        setUsuarios(lista.map((u) => ({ value: String(u.id).trim(), label: u.email ? `${u.nome} (${u.email})` : u.nome }))),
      )
      .catch(() => setUsuarios([]));
  }, [isOpen, plantas.length]);

  // Ids já gravados que a lista não trouxe (planta removida, usuário fora do limite) continuam visíveis.
  const opcoesPlantas = useMemo(() => {
    const extras = (regra?.plantas ?? [])
      .filter((p) => !plantas.some((o) => o.value === p.id))
      .map((p) => ({ value: p.id, label: p.nome || p.id }));
    return [...plantas, ...extras];
  }, [plantas, regra]);
  const opcoesUsuarios = useMemo(() => {
    const extras = (regra?.usuarios ?? [])
      .filter((u) => !usuarios.some((o) => o.value === u.id))
      .map((u) => ({ value: u.id, label: u.nome || u.email || u.id }));
    return [...usuarios, ...extras];
  }, [usuarios, regra]);

  const set = <K extends keyof SalvarRegraNotificacaoDto>(k: K, v: SalvarRegraNotificacaoDto[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const erro = !form.nome.trim()
    ? 'Dê um nome para a regra'
    : !form.canais.length
      ? 'Escolha ao menos um canal'
      : !form.papeis.length && !form.usuario_ids.length
        ? 'Escolha quem recebe: um papel ou um usuário'
        : null;

  const salvar = async () => {
    if (erro) {
      toast({ title: erro, variant: 'destructive' });
      return;
    }
    setSalvando(true);
    try {
      const dto: SalvarRegraNotificacaoDto = {
        ...form,
        nome: form.nome.trim(),
        limite_minutos: form.evento === 'sem_comunicacao' ? Number(form.limite_minutos) || 30 : null,
        antecedencia_dias: form.evento === 'vencimento_acesso_morador' ? Number(form.antecedencia_dias) || 0 : null,
      };
      if (mode === 'edit' && regra) await RegrasNotificacaoService.update(regra.id, dto);
      else await RegrasNotificacaoService.create(dto);
      toast({ title: mode === 'edit' ? 'Regra atualizada' : 'Regra criada' });
      onSuccess();
      onClose();
    } catch (e) {
      const msg = (e as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
      toast({
        title: 'Não foi possível salvar',
        description: Array.isArray(msg) ? msg.join('; ') : msg,
        variant: 'destructive',
      });
    } finally {
      setSalvando(false);
    }
  };

  const titulo = mode === 'create' ? 'Nova regra de notificação' : mode === 'edit' ? 'Editar regra' : 'Regra de notificação';

  return (
    <Dialog open={isOpen} onOpenChange={(o) => !o && !salvando && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>
            Quem é avisado, de quê e por qual canal. Os avisos que acontecem aparecem em Alarmes e Eventos.
          </DialogDescription>
        </DialogHeader>

        <fieldset disabled={somenteLeitura} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="regra-nome">Nome</Label>
            <Input
              id="regra-nome"
              value={form.nome}
              maxLength={100}
              placeholder="Ex.: Falha nas usinas do Norte"
              onChange={(e) => set('nome', e.target.value)}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Evento</Label>
              <Select value={form.evento} onValueChange={(v) => set('evento', v as EventoNotificacao)} disabled={somenteLeitura}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EVENTOS.map((e) => (
                    <SelectItem key={e.value} value={e.value}>
                      {e.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{EVENTOS.find((e) => e.value === form.evento)?.descricao}</p>
            </div>
            {form.evento === 'sem_comunicacao' && (
              <div className="space-y-2">
                <Label htmlFor="regra-minutos">Sem comunicação há mais de (min)</Label>
                <Input
                  id="regra-minutos"
                  type="number"
                  min={1}
                  value={form.limite_minutos ?? ''}
                  onChange={(e) => set('limite_minutos', e.target.value === '' ? null : Number(e.target.value))}
                />
              </div>
            )}
            {form.evento === 'vencimento_acesso_morador' && (
              <div className="space-y-2">
                <Label htmlFor="regra-dias">Avisar quantos dias antes</Label>
                <Input
                  id="regra-dias"
                  type="number"
                  min={0}
                  max={90}
                  value={form.antecedencia_dias ?? ''}
                  onChange={(e) => set('antecedencia_dias', e.target.value === '' ? null : Number(e.target.value))}
                />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Canais</Label>
            <div className="flex flex-wrap gap-4">
              {CANAIS.map((c) => (
                <label key={c.value} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={form.canais.includes(c.value)}
                    onCheckedChange={() => set('canais', alternar(form.canais, c.value))}
                    disabled={somenteLeitura}
                  />
                  {c.label}
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Plantas</Label>
            <MultiSelect
              options={opcoesPlantas}
              selected={form.planta_ids}
              onChange={(v) => set('planta_ids', v)}
              placeholder="Todas as plantas"
              maxCount={500}
              disabled={somenteLeitura}
            />
            <p className="text-xs text-muted-foreground">Vazio = vale para todas as plantas.</p>
          </div>

          <div className="space-y-2">
            <Label>Quem recebe — por papel</Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {PAPEIS.map((p) => (
                <label key={p.value} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={form.papeis.includes(p.value)}
                    onCheckedChange={() => set('papeis', alternar(form.papeis, p.value))}
                    disabled={somenteLeitura}
                  />
                  {p.label}
                </label>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Operador e proprietário recebem só das plantas que acompanham.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Quem recebe — usuários específicos</Label>
            <MultiSelect
              options={opcoesUsuarios}
              selected={form.usuario_ids}
              onChange={(v) => set('usuario_ids', v)}
              placeholder="Nenhum usuário específico"
              maxCount={200}
              disabled={somenteLeitura}
            />
          </div>

          <label className="flex items-center gap-3 text-sm cursor-pointer">
            <Switch checked={form.ativo} onCheckedChange={(v) => set('ativo', v)} disabled={somenteLeitura} />
            Regra ativa
          </label>
        </fieldset>

        {regra?.id && (
          <div className="rounded-md border border-border p-3 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Users className="h-4 w-4" />
              Quem recebe hoje
              {destinatarios && <span className="text-muted-foreground font-normal">({destinatarios.length})</span>}
            </div>
            {destinatarios === null ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : destinatarios.length === 0 ? (
              <p className="text-xs text-muted-foreground">Ninguém se encaixa nesta regra agora.</p>
            ) : (
              <ul className="text-xs text-muted-foreground max-h-32 overflow-y-auto space-y-0.5">
                {destinatarios.map((d) => (
                  <li key={d.id}>
                    {d.nome} · {rotuloPapel(d.role)}
                    {d.email ? ` · ${d.email}` : ''}
                  </li>
                ))}
              </ul>
            )}
            {mode === 'edit' && (
              <p className="text-[11px] text-muted-foreground">Lista da regra salva; atualiza depois de salvar.</p>
            )}
          </div>
        )}

        <DialogFooter>
          <button type="button" className="btn-minimal-outline" onClick={onClose} disabled={salvando}>
            {somenteLeitura ? 'Fechar' : 'Cancelar'}
          </button>
          {!somenteLeitura && (
            <button type="button" className="btn-minimal-primary" onClick={salvar} disabled={salvando}>
              {salvando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === 'edit' ? 'Salvar' : 'Criar regra'}
            </button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
