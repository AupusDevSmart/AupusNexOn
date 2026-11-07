import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, RefreshCw } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { chavesCameras } from '../../hooks/chaves';
import { useConfigCameras } from '../../hooks/useConfigCameras';
import { useEquipamentosUnidade, usePontosEquipamento, type EquipamentoResumido } from '../../hooks/useEquipamentosPontos';
import { CamerasService } from '../../services/cameras.service';
import type { ArmamentoModo, ConfigCameras, ConfigCamerasPayload, PontoComando } from '../../types';
import { mensagemErro } from '../../utils/erros';
import { Campo, NENHUM, TituloBloco } from './Campo';

const MODOS: { valor: ArmamentoModo; rotulo: string; dica: string }[] = [
  { valor: 'agenda', rotulo: 'Por agenda', dica: 'Arma todo dia no horário abaixo.' },
  { valor: 'manual', rotulo: 'Manual', dica: 'Só arma pelo botão da tela ou do app.' },
  { valor: 'desarmado', rotulo: 'Sempre desarmado', dica: 'Detecções não geram alerta.' },
];

const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface Estado {
  modo: ArmamentoModo;
  inicio: string;
  fim: string;
  refletor: PontoComando | null;
  sirene: PontoComando | null;
  abrir_chamado: boolean;
  emails: string;
}

function deConfig(c: ConfigCameras): Estado {
  return {
    modo: c.armamento?.modo ?? 'manual',
    inicio: c.armamento?.agenda?.inicio ?? '18:00',
    fim: c.armamento?.agenda?.fim ?? '06:30',
    refletor: c.refletor ?? null,
    sirene: c.sirene ?? null,
    abrir_chamado: !!c.abrir_chamado,
    emails: (c.notificar_emails ?? []).join(', '),
  };
}

/** Armamento (modo + agenda), refletor e sirene, chamado automático e e-mails (`configOperacional`). */
export function SecaoUnidade({ unidadeId }: { unidadeId: string }) {
  const config = useConfigCameras(unidadeId);
  const equipamentos = useEquipamentosUnidade(unidadeId);
  const queryClient = useQueryClient();
  const [f, setF] = useState<Estado | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  // Preenche o formulário quando a configuração chega (uma vez; edição local depois).
  useEffect(() => {
    if (config.data && !f) setF(deConfig(config.data));
  }, [config.data, f]);

  const salvar = useMutation({
    mutationFn: (payload: ConfigCamerasPayload) => CamerasService.salvarConfig(unidadeId, payload),
    onSuccess: (r) => {
      toast.success('Configuração salva');
      queryClient.setQueryData(chavesCameras.config(unidadeId), r);
      setF(deConfig(r));
      void queryClient.invalidateQueries({ queryKey: chavesCameras.resumo(unidadeId) });
    },
    onError: (e) => setErro(mensagemErro(e, 'Não foi possível salvar a configuração')),
  });

  if (config.isError) {
    return (
      <div className="flex flex-col items-start gap-2 text-[13px] text-muted-foreground">
        {mensagemErro(config.error, 'Não foi possível carregar a configuração.')}
        <Button type="button" variant="outline" size="sm" onClick={() => void config.refetch()}>
          <RefreshCw aria-hidden />
          Tentar de novo
        </Button>
      </div>
    );
  }

  if (!f || !config.data) {
    return (
      <div role="status" aria-label="Carregando configuração" className="flex flex-col gap-3">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-10 w-full rounded-md" />
        ))}
      </div>
    );
  }

  const atual = config.data;
  const enviar = (e: FormEvent) => {
    e.preventDefault();
    const emails = f.emails
      .split(/[\s,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const invalido = emails.find((m) => !RE_EMAIL.test(m));
    if (invalido) {
      setErro(`E-mail inválido: ${invalido}`);
      return;
    }
    if (f.modo === 'agenda' && (!f.inicio || !f.fim)) {
      setErro('Informe início e fim da agenda.');
      return;
    }
    setErro(null);
    salvar.mutate({
      armamento: {
        modo: f.modo,
        armado_manual: atual.armamento?.armado_manual ?? false,
        armado_manual_ate: atual.armamento?.armado_manual_ate ?? null,
        agenda: f.inicio && f.fim ? { inicio: f.inicio, fim: f.fim } : null,
      },
      refletor: f.refletor,
      sirene: f.sirene,
      abrir_chamado: f.abrir_chamado,
      notificar_emails: emails,
    });
  };

  const modoAtual = MODOS.find((m) => m.valor === f.modo);

  return (
    <form onSubmit={enviar} className="flex flex-col gap-5" aria-label="Configuração da unidade">
      <div className="flex flex-col gap-3">
        <TituloBloco>Armamento</TituloBloco>
        <Campo rotulo="Modo" dica={modoAtual?.dica}>
          <Select value={f.modo} onValueChange={(v) => setF({ ...f, modo: v as ArmamentoModo })}>
            <SelectTrigger aria-label="Modo de armamento">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MODOS.map((m) => (
                <SelectItem key={m.valor} value={m.valor}>
                  {m.rotulo}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Campo>
        {f.modo === 'agenda' && (
          <div className="grid grid-cols-2 gap-3">
            <Campo rotulo="Arma às" htmlFor="agenda-inicio">
              <Input id="agenda-inicio" type="time" value={f.inicio} onChange={(e) => setF({ ...f, inicio: e.target.value })} />
            </Campo>
            <Campo rotulo="Desarma às" htmlFor="agenda-fim">
              <Input id="agenda-fim" type="time" value={f.fim} onChange={(e) => setF({ ...f, fim: e.target.value })} />
            </Campo>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <TituloBloco>Comandos</TituloBloco>
        <SeletorPonto
          rotulo="Refletor"
          valor={f.refletor}
          onChange={(v) => setF({ ...f, refletor: v })}
          equipamentos={equipamentos.data ?? []}
        />
        <SeletorPonto rotulo="Sirene" valor={f.sirene} onChange={(v) => setF({ ...f, sirene: v })} equipamentos={equipamentos.data ?? []} />
      </div>

      <div className="flex flex-col gap-3">
        <TituloBloco>Avisos</TituloBloco>
        <label className="flex items-center justify-between gap-3 text-sm">
          <span>
            Abrir chamado automaticamente
            <span className="block text-[11px] text-muted-foreground">Alerta de pessoa ou veículo com a usina armada abre chamado no equipamento CFTV da câmera.</span>
          </span>
          <Switch checked={f.abrir_chamado} onCheckedChange={(v) => setF({ ...f, abrir_chamado: v })} aria-label="Abrir chamado automaticamente" />
        </label>
        <Campo rotulo="E-mails de aviso" htmlFor="emails-aviso" dica="Separe por vírgula. Recebem cada alerta com a foto.">
          <Textarea
            id="emails-aviso"
            rows={2}
            value={f.emails}
            onChange={(e) => setF({ ...f, emails: e.target.value })}
            placeholder="coa@aupusenergia.com.br, plantao@aupusenergia.com.br"
          />
        </Campo>
      </div>

      {erro && (
        <p role="alert" className="text-xs text-destructive">
          {erro}
        </p>
      )}

      <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
        <span className="text-[11px] text-muted-foreground">
          {atual.updated_at ? `Salva em ${new Date(atual.updated_at).toLocaleString('pt-BR')}` : ''}
        </span>
        <Button type="submit" disabled={salvar.isPending}>
          {salvar.isPending && <Loader2 className="animate-spin" aria-hidden />}
          Salvar
        </Button>
      </div>
    </form>
  );
}

/**
 * Equipamento + ponto de comando. Busca os pontos em `GET /equipamentos/:id/pontos`;
 * se não houver (ou a rota falhar), aceita o id do ponto digitado.
 */
function SeletorPonto({
  rotulo,
  valor,
  onChange,
  equipamentos,
}: {
  rotulo: string;
  valor: PontoComando | null;
  onChange: (v: PontoComando | null) => void;
  equipamentos: EquipamentoResumido[];
}) {
  const equipamentoId = valor?.equipamento_id ?? null;
  const pontos = usePontosEquipamento(equipamentoId);
  const listaPontos = pontos.data ?? [];
  const campoLivre = !!equipamentoId && !pontos.isPending && (pontos.isError || listaPontos.length === 0);
  const pontoFora = !!valor?.ponto_id && listaPontos.length > 0 && !listaPontos.some((p) => p.id === valor.ponto_id);

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <Campo rotulo={`${rotulo} — equipamento`}>
        <Select
          value={equipamentoId ?? NENHUM}
          onValueChange={(v) => onChange(v === NENHUM ? null : { equipamento_id: v, ponto_id: '' })}
        >
          <SelectTrigger aria-label={`${rotulo}: equipamento`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NENHUM}>Não configurado</SelectItem>
            {equipamentos.map((eq) => (
              <SelectItem key={eq.id} value={eq.id}>
                {eq.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Campo>
      <Campo
        rotulo={`${rotulo} — ponto de comando`}
        htmlFor={`${rotulo}-ponto`}
        dica={campoLivre ? 'Equipamento sem pontos cadastrados: informe o id do ponto.' : pontoFora ? 'Ponto salvo não está na lista; escolha outro.' : undefined}
      >
        {!equipamentoId ? (
          <Input id={`${rotulo}-ponto`} disabled value="" placeholder="Escolha o equipamento" />
        ) : pontos.isPending ? (
          <Skeleton className="h-9 w-full rounded-md" />
        ) : campoLivre ? (
          <Input
            id={`${rotulo}-ponto`}
            value={valor?.ponto_id ?? ''}
            onChange={(e) => onChange({ equipamento_id: equipamentoId, ponto_id: e.target.value.trim() })}
            placeholder="Id do ponto"
          />
        ) : (
          <Select
            value={valor?.ponto_id && !pontoFora ? valor.ponto_id : NENHUM}
            onValueChange={(v) => onChange({ equipamento_id: equipamentoId, ponto_id: v === NENHUM ? '' : v })}
          >
            <SelectTrigger id={`${rotulo}-ponto`} aria-label={`${rotulo}: ponto de comando`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NENHUM}>Escolha o ponto</SelectItem>
              {listaPontos.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </Campo>
    </div>
  );
}
