import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Building2, Check, Wrench } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
import { RodapeFixo } from './RodapeFixo';
import { Secao } from './Secao';

const TIPOS: { tipo: TipoChamado; titulo: string; texto: string; Icone: typeof Wrench }[] = [
  { tipo: 'EXTERNO', titulo: 'Externo', texto: 'Equatorial, prefeitura, fornecedor', Icone: Building2 },
  { tipo: 'INTERNO', titulo: 'Reparo', texto: 'Equipamento com defeito', Icone: Wrench },
];

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

  const faltando = [
    externo ? (!vinculo.planta_id ? 'planta' : null) : !vinculo.equipamento_id ? 'equipamento' : null,
    externo && !orgao.trim() ? 'com quem foi aberto' : null,
    !externo && !tituloFinal ? 'título' : null,
    !descricao.trim() ? 'descrição' : null,
  ].filter(Boolean);

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
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader className="pr-8 text-left">
          <DialogTitle>{editando ? `Editar chamado #${chamado?.numero}` : 'Abrir chamado'}</DialogTitle>
          <DialogDescription>
            {externo
              ? 'Chamado aberto com a concessionária ou outro órgão: protocolo, horários e o que foi dito.'
              : 'Problema num equipamento. Depois você encaminha para o Smart Service, WhatsApp ou e-mail.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {!editando && (
            <div role="radiogroup" aria-label="Tipo de chamado" className="grid grid-cols-2 gap-2">
              {TIPOS.map(({ tipo: t, titulo: nome, texto, Icone }) => {
                const ativo = tipo === t;
                return (
                  <button
                    key={t}
                    type="button"
                    role="radio"
                    aria-checked={ativo}
                    onClick={() => trocarTipo(t)}
                    className={cn(
                      'relative flex min-h-[4.5rem] flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors',
                      'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                      ativo ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50',
                    )}
                  >
                    <span className="flex items-center gap-2 text-sm font-semibold">
                      <Icone className={cn('h-4 w-4', ativo ? 'text-primary' : 'text-muted-foreground')} />
                      {nome}
                    </span>
                    <span className="text-xs text-muted-foreground">{texto}</span>
                    {ativo && (
                      <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <Check className="h-3 w-3" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          <Secao titulo="Onde">
            <VinculoSelector value={vinculo} onChange={setVinculo} equipamentoObrigatorio={!externo} />
          </Secao>

          {externo && (
            <Secao titulo="Atendimento">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label htmlFor="chamado-orgao" className="text-sm font-medium">Aberto com</label>
                  <Input
                    id="chamado-orgao"
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
                <div className="space-y-1.5">
                  <label htmlFor="chamado-protocolo" className="text-sm font-medium">
                    Protocolo <span className="font-normal text-muted-foreground">(opcional)</span>
                  </label>
                  <Input
                    id="chamado-protocolo"
                    value={protocolo}
                    maxLength={80}
                    onChange={(e) => setProtocolo(e.target.value)}
                    placeholder="Número dado pelo atendimento"
                    className="text-base sm:text-sm"
                  />
                </div>
                <CampoData id="chamado-ocorrencia" rotulo="Início do problema" valor={ocorrenciaEm} onChange={setOcorrenciaEm} />
                <CampoData id="chamado-aberto" rotulo="Aberto no órgão em" valor={abertoEm} onChange={setAbertoEm} />
                <CampoData id="chamado-previsao" rotulo="Previsão de solução" opcional valor={previsaoEm} onChange={setPrevisaoEm} />
              </div>
            </Secao>
          )}

          <Secao titulo="Problema">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Motivo</label>
                <Select value={motivo} onValueChange={(v) => setMotivo(v as MotivoChamado)}>
                  <SelectTrigger aria-label="Motivo">
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
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Prioridade</label>
                <Select value={prioridade} onValueChange={(v) => setPrioridade(v as PrioridadeChamado)}>
                  <SelectTrigger aria-label="Prioridade">
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

            <div className="space-y-1.5">
              <label htmlFor="chamado-titulo" className="text-sm font-medium">
                Título{externo && <span className="font-normal text-muted-foreground"> (opcional)</span>}
              </label>
              <Input
                id="chamado-titulo"
                value={titulo}
                maxLength={200}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder={externo ? tituloFinal || 'Ex.: Falta de energia na rua' : 'Ex.: Inversor parado desde a manhã'}
                className="text-base sm:text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="chamado-descricao" className="text-sm font-medium">
                {externo ? 'Descrição' : 'O que está acontecendo'}
              </label>
              <Textarea
                id="chamado-descricao"
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
          </Secao>
        </div>

        <RodapeFixo className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {faltando.length > 0 && (
            <p className="text-xs text-muted-foreground sm:mr-auto">Falta: {faltando.join(', ')}</p>
          )}
          <div className="flex gap-2 sm:ml-auto">
            <button className="btn-minimal-outline flex-1 touch:h-11 sm:flex-none" onClick={onClose} disabled={salvando}>
              Cancelar
            </button>
            <button className="btn-minimal-primary flex-1 touch:h-11 sm:flex-none" onClick={salvar} disabled={!valido || salvando}>
              {salvando ? 'Salvando…' : editando ? 'Salvar' : 'Abrir chamado'}
            </button>
          </div>
        </RodapeFixo>
      </DialogContent>
    </Dialog>
  );
}

function CampoData({
  id,
  rotulo,
  valor,
  opcional,
  onChange,
}: {
  id: string;
  rotulo: string;
  valor: string;
  opcional?: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <div className="min-w-0 space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {rotulo}
        {opcional && <span className="font-normal text-muted-foreground"> (opcional)</span>}
      </label>
      <Input
        id={id}
        type="datetime-local"
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        className="min-w-0 text-base sm:text-sm"
      />
    </div>
  );
}
