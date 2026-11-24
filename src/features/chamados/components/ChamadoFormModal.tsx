import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { formatApiError } from '@/utils/api-error';
import { ChamadosService } from '../services';
import {
  MOTIVO_ROTULO,
  MOTIVOS_EXTERNO,
  MOTIVOS_INTERNO,
  PRIORIDADE_ROTULO,
  type Chamado,
  type MotivoChamado,
  type PrioridadeChamado,
  type TipoChamado,
} from '../types';
import { deInputLocal, paraInputLocal } from '../utils/datas';
import { VINCULO_VAZIO, type Vinculo } from '../utils/vinculo';
import { VinculoSelector } from './VinculoSelector';

/**
 * Abrir ou editar chamado. Reparo (INTERNO): equipamento obrigatório, depois encaminha.
 * Externo: aberto com terceiro (Equatorial, prefeitura...), com protocolo, datas e previsão.
 */
export function ChamadoFormModal({
  aberto,
  chamado,
  tipoInicial = 'EXTERNO',
  onClose,
  onSalvo,
}: {
  aberto: boolean;
  /** Com chamado = edição. */
  chamado?: Chamado | null;
  tipoInicial?: TipoChamado;
  onClose: () => void;
  onSalvo: (c: Chamado) => void;
}) {
  const editando = !!chamado;
  const [tipo, setTipo] = useState<TipoChamado>(tipoInicial);
  const [vinculo, setVinculo] = useState<Vinculo>(VINCULO_VAZIO);
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [motivo, setMotivo] = useState<MotivoChamado>('FALTA_ENERGIA');
  const [prioridade, setPrioridade] = useState<PrioridadeChamado>('MEDIA');
  const [orgao, setOrgao] = useState('Equatorial');
  const [protocolo, setProtocolo] = useState('');
  const [ocorrenciaEm, setOcorrenciaEm] = useState('');
  const [abertoEm, setAbertoEm] = useState('');
  const [previsaoEm, setPrevisaoEm] = useState('');
  const [orgaos, setOrgaos] = useState<string[]>(['Equatorial']);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    const c = chamado;
    const t = c?.tipo ?? tipoInicial;
    setTipo(t);
    setVinculo(
      c
        ? { planta_id: c.planta_id ?? '', unidade_id: c.unidade_id ?? '', equipamento_id: c.equipamento_id ?? '' }
        : VINCULO_VAZIO,
    );
    setTitulo(c?.titulo ?? '');
    setDescricao(c?.descricao ?? '');
    setMotivo(c?.motivo ?? (t === 'EXTERNO' ? 'FALTA_ENERGIA' : 'FALHA'));
    setPrioridade(c?.prioridade ?? (t === 'EXTERNO' ? 'ALTA' : 'MEDIA'));
    setOrgao(c?.orgao ?? 'Equatorial');
    setProtocolo(c?.protocolo ?? '');
    setOcorrenciaEm(paraInputLocal(c?.ocorrencia_em));
    setAbertoEm(c ? paraInputLocal(c.aberto_em) : paraInputLocal(new Date().toISOString()));
    setPrevisaoEm(paraInputLocal(c?.previsao_em));
    ChamadosService.orgaos()
      .then((l) => setOrgaos(l.length ? l : ['Equatorial']))
      .catch(() => undefined);
  }, [aberto, chamado, tipoInicial]);

  const trocarTipo = (t: TipoChamado) => {
    setTipo(t);
    setMotivo(t === 'EXTERNO' ? 'FALTA_ENERGIA' : 'FALHA');
    setPrioridade(t === 'EXTERNO' ? 'ALTA' : 'MEDIA');
  };

  const externo = tipo === 'EXTERNO';
  const motivos = externo ? MOTIVOS_EXTERNO : MOTIVOS_INTERNO;
  const tituloFinal = titulo.trim() || (externo ? `${MOTIVO_ROTULO[motivo]}${orgao.trim() ? ` — ${orgao.trim()}` : ''}` : '');
  const valido =
    (externo ? !!vinculo.planta_id && !!orgao.trim() : !!vinculo.equipamento_id) &&
    tituloFinal.length > 0 &&
    descricao.trim().length > 0;

  const salvar = async () => {
    if (!valido) return;
    setSalvando(true);
    try {
      const comuns = { titulo: tituloFinal, descricao: descricao.trim(), motivo, prioridade };
      const camposExterno = externo
        ? {
            orgao: orgao.trim(),
            protocolo: protocolo.trim(),
            ocorrencia_em: deInputLocal(ocorrenciaEm),
            aberto_em: deInputLocal(abertoEm),
            previsao_em: deInputLocal(previsaoEm),
          }
        : {};
      let c: Chamado;
      if (chamado) {
        c = await ChamadosService.editar(chamado.id, {
          ...comuns,
          ...camposExterno,
          planta_id: vinculo.planta_id || undefined,
          unidade_id: vinculo.unidade_id || null,
          equipamento_id: vinculo.equipamento_id || null,
        });
        toast.success(`Chamado #${c.numero} atualizado`);
      } else {
        c = await ChamadosService.abrir({
          tipo,
          ...comuns,
          ...camposExterno,
          ocorrencia_em: camposExterno.ocorrencia_em ?? undefined,
          aberto_em: camposExterno.aberto_em ?? undefined,
          previsao_em: camposExterno.previsao_em ?? undefined,
          planta_id: vinculo.planta_id || undefined,
          unidade_id: vinculo.unidade_id || undefined,
          equipamento_id: vinculo.equipamento_id || undefined,
        });
        toast.success(`Chamado #${c.numero} aberto`);
      }
      onSalvo(c);
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={aberto} onOpenChange={(o) => !o && !salvando && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editando ? `Editar chamado #${chamado?.numero}` : 'Abrir chamado'}</DialogTitle>
          <DialogDescription>
            {externo
              ? 'Registre o chamado aberto com a concessionária ou outro órgão: protocolo, horários e o que foi dito.'
              : 'Registre o problema do equipamento. Depois você encaminha para o Smart Service, WhatsApp ou e-mail.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!editando && (
            <div className="grid grid-cols-2 gap-2">
              {(['EXTERNO', 'INTERNO'] as TipoChamado[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => trocarTipo(t)}
                  className={cn('text-left', tipo === t ? 'btn-minimal-primary' : 'btn-minimal-outline', 'h-auto py-2')}
                >
                  <span className="flex flex-col">
                    <span className="text-sm font-medium">{t === 'EXTERNO' ? 'Externo' : 'Reparo'}</span>
                    <span className="text-xs opacity-80">
                      {t === 'EXTERNO' ? 'Equatorial, prefeitura, fornecedor' : 'Equipamento com defeito'}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}

          <VinculoSelector value={vinculo} onChange={setVinculo} equipamentoObrigatorio={!externo} />

          {externo && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-sm font-medium">Aberto com</label>
                <Input
                  value={orgao}
                  maxLength={120}
                  list="chamados-orgaos"
                  onChange={(e) => setOrgao(e.target.value)}
                  placeholder="Ex.: Equatorial"
                  className="text-base sm:text-sm"
                />
                <datalist id="chamados-orgaos">
                  {orgaos.map((o) => (
                    <option key={o} value={o} />
                  ))}
                </datalist>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Protocolo</label>
                <Input
                  value={protocolo}
                  maxLength={80}
                  onChange={(e) => setProtocolo(e.target.value)}
                  placeholder="Número dado pelo atendimento"
                  className="text-base sm:text-sm"
                />
              </div>
              <CampoData rotulo="Início do problema" valor={ocorrenciaEm} onChange={setOcorrenciaEm} />
              <CampoData rotulo="Aberto no órgão em" valor={abertoEm} onChange={setAbertoEm} />
              <CampoData rotulo="Previsão de solução" valor={previsaoEm} onChange={setPrevisaoEm} />
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-sm font-medium">Motivo</label>
              <Select value={motivo} onValueChange={(v) => setMotivo(v as MotivoChamado)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {motivos.map((v) => (
                    <SelectItem key={v} value={v}>
                      {MOTIVO_ROTULO[v]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Prioridade</label>
              <Select value={prioridade} onValueChange={(v) => setPrioridade(v as PrioridadeChamado)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PRIORIDADE_ROTULO).map(([v, l]) => (
                    <SelectItem key={v} value={v}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Título{externo ? ' (opcional)' : ''}</label>
            <Input
              value={titulo}
              maxLength={200}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder={externo ? tituloFinal || 'Ex.: Falta de energia na rua' : 'Ex.: Inversor parado desde a manhã'}
              className="text-base sm:text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">{externo ? 'Descrição' : 'O que está acontecendo'}</label>
            <Textarea
              value={descricao}
              rows={4}
              maxLength={5000}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder={
                externo
                  ? 'O que aconteceu, com quem falou, o que a concessionária respondeu'
                  : 'Descreva a falha, o alarme ou o que foi visto em campo'
              }
              className="text-base sm:text-sm"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <button className="btn-minimal-outline" onClick={onClose} disabled={salvando}>
            Cancelar
          </button>
          <button className="btn-minimal-primary" onClick={salvar} disabled={!valido || salvando}>
            {salvando ? 'Salvando…' : editando ? 'Salvar' : 'Abrir chamado'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CampoData({ rotulo, valor, onChange }: { rotulo: string; valor: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium">{rotulo}</label>
      <Input type="datetime-local" value={valor} onChange={(e) => onChange(e.target.value)} className="text-base sm:text-sm" />
    </div>
  );
}
