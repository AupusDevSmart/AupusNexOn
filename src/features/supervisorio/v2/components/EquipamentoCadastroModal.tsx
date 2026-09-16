import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { equipamentosApi, type EquipamentoApiResponse } from '@/services/equipamentos.services';

/**
 * Cadastro SIMPLIFICADO do equipamento no unifilar (Fase 7). Substitui o modal de
 * criação rápida e o de edição. Proprietário/planta/unidade vêm do contexto do
 * unifilar; nome vira TAG (auto do tipo, prefixo editável); sem modelo/criticidade/
 * nº série/dados técnicos. O núcleo é a CONFIGURAÇÃO: Possui medição (monitoramento)
 * e Possui SCS (automação → comando/status) — é aqui, na criação/edição, que isso é
 * definido (não no sheet de visualização). O tipo pm/ied da medição vem da associação
 * no IoT.
 */
type PontosNativos = { comando: string[]; status: string[] };
type Tipo = { id: string; codigo: string; nome: string; sigla: string | null; pontos_nativos?: PontosNativos };

/**
 * Seletor de pontos de uma capacidade (comando ou status). Os nativos do tipo vêm
 * marcáveis um a um — ter status não significa ter todos (um DJ pode ter aberto/
 * fechado sem local/remoto) — e dá pra acrescentar pontos customizados.
 */
function PontosPicker({ nativos, selecionados, onChange }: { nativos: string[]; selecionados: string[]; onChange: (v: string[]) => void }) {
  const [novo, setNovo] = useState('');
  const customs = selecionados.filter((s) => !nativos.includes(s));
  const todos = [...nativos, ...customs];
  const alternar = (nome: string, on: boolean) =>
    onChange(on ? [...selecionados, nome] : selecionados.filter((s) => s !== nome));
  const adicionar = () => {
    const n = novo.trim();
    if (!n || selecionados.includes(n)) { setNovo(''); return; }
    onChange([...selecionados, n]);
    setNovo('');
  };
  return (
    <div className="pl-6 pt-1">
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {todos.map((p) => (
          <label key={p} className="flex items-center gap-1.5 cursor-pointer">
            <Checkbox checked={selecionados.includes(p)} onCheckedChange={(v) => alternar(p, !!v)} />
            <span className="text-[13px]">{p}</span>
            {!nativos.includes(p) && <span className="text-[10px] text-muted-foreground">(custom)</span>}
          </label>
        ))}
        {todos.length === 0 && <span className="text-[11px] text-muted-foreground">Este tipo não tem pontos nativos — adicione abaixo.</span>}
      </div>
      <div className="flex gap-1.5 mt-1.5">
        <Input
          value={novo}
          onChange={(e) => setNovo(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); adicionar(); } }}
          placeholder="adicionar ponto…"
          className="h-7 text-xs max-w-[190px]"
        />
        <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={adicionar} disabled={!novo.trim()}>Adicionar</Button>
      </div>
    </div>
  );
}

interface Props {
  open: boolean;
  onClose: () => void;
  unidadeId: string;
  mode: 'create' | 'edit';
  equipmentId?: string;      // edit
  equipmentTipoLabel?: string; // edit: rótulo do tipo (fallback)
  onCreated?: (equip: EquipamentoApiResponse) => void;
  onSaved?: (v: { tag: string; localizacao: string }) => void;
}

export function EquipamentoCadastroModal({ open, onClose, unidadeId, mode, equipmentId, equipmentTipoLabel, onCreated, onSaved }: Props) {
  const [tipos, setTipos] = useState<Tipo[]>([]);
  const [tipoId, setTipoId] = useState('');
  const [tipoLabel, setTipoLabel] = useState(equipmentTipoLabel ?? '');
  const [tag, setTag] = useState('');
  const [localizacao, setLocalizacao] = useState('');
  const [possuiMedicao, setPossuiMedicao] = useState(false);
  const [possuiScs, setPossuiScs] = useState(false);
  const [scsComando, setScsComando] = useState(false);
  const [scsStatus, setScsStatus] = useState(false);
  const [nativos, setNativos] = useState<PontosNativos>({ comando: [], status: [] });
  const [pontosComando, setPontosComando] = useState<string[]>([]);
  const [pontosStatus, setPontosStatus] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Reset + carga inicial
  useEffect(() => {
    if (!open) return;
    setErro(null);
    if (mode === 'create') {
      setTipoId(''); setTag(''); setLocalizacao('');
      setPossuiMedicao(false); setPossuiScs(false); setScsComando(false); setScsStatus(false);
      setNativos({ comando: [], status: [] }); setPontosComando([]); setPontosStatus([]);
      setLoading(true);
      equipamentosApi.tiposUnifilar()
        .then((t) => setTipos(Array.isArray(t) ? t : []))
        .catch(() => setTipos([]))
        .finally(() => setLoading(false));
    } else if (mode === 'edit' && equipmentId) {
      setLoading(true);
      equipamentosApi.getCadastroUnifilar(equipmentId)
        .then((c) => {
          setTag(c?.tag ?? '');
          setLocalizacao(c?.localizacao_especifica ?? '');
          setPossuiMedicao(!!c?.possui_medicao);
          // Migração de conceito: medição agora vive DENTRO do SCS. Equipamento antigo
          // que só tinha medição passa a ser "Possui SCS" (com só Medição marcada).
          setPossuiScs(!!c?.possui_scs || !!c?.possui_medicao);
          setScsComando(!!c?.scs_comando);
          setScsStatus(!!c?.scs_status);
          setTipoLabel(c?.tipo_nome ?? equipmentTipoLabel ?? '');
          setNativos(c?.pontos_nativos ?? { comando: [], status: [] });
          setPontosComando(Array.isArray(c?.pontos_comando) ? c.pontos_comando : []);
          setPontosStatus(Array.isArray(c?.pontos_status) ? c.pontos_status : []);
        })
        .catch(() => setErro('Falha ao carregar o equipamento'))
        .finally(() => setLoading(false));
    }
  }, [open, mode, equipmentId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Ao escolher o tipo (create), sugere a TAG (sigla + sequencial).
  const escolherTipo = async (id: string) => {
    setTipoId(id);
    const t = tipos.find((x) => x.id === id);
    setTipoLabel(t?.nome ?? '');
    const nat = t?.pontos_nativos ?? { comando: [], status: [] };
    setNativos(nat);
    // Os nativos já vêm marcados (o padrão do tipo); desmarca-se o que não se aplica.
    setPontosComando(scsComando ? nat.comando : []);
    setPontosStatus(scsStatus ? nat.status : []);
    try {
      const { tag: prox } = await equipamentosApi.proximaTag(id, unidadeId);
      setTag(prox ?? '');
    } catch { /* mantém o que estiver */ }
  };

  const podeSalvar = mode === 'create' ? !!tipoId && !saving : !saving;

  const salvar = async () => {
    setErro(null); setSaving(true);
    try {
      if (mode === 'create') {
        const resp = await equipamentosApi.criarEquipamentoRapido(unidadeId, tipoId, undefined, tag || undefined, {
          localizacao_especifica: localizacao || undefined,
          possui_medicao: possuiScs && possuiMedicao,
          possui_scs: possuiScs,
          scs_comando: possuiScs && scsComando,
          scs_status: possuiScs && scsStatus,
          pontos_comando: possuiScs && scsComando ? pontosComando : [],
          pontos_status: possuiScs && scsStatus ? pontosStatus : [],
        });
        onCreated?.(resp.data);
      } else if (equipmentId) {
        await equipamentosApi.editarCadastroUnifilar(equipmentId, {
          tag: tag,
          localizacao_especifica: localizacao,
          possui_medicao: possuiScs && possuiMedicao,
          possui_scs: possuiScs,
          scs_comando: possuiScs && scsComando,
          scs_status: possuiScs && scsStatus,
          pontos_comando: possuiScs && scsComando ? pontosComando : [],
          pontos_status: possuiScs && scsStatus ? pontosStatus : [],
        });
        onSaved?.({ tag, localizacao });
      }
      onClose();
    } catch (e: any) {
      setErro(e?.response?.data?.message || e?.message || 'Erro ao salvar');
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'Novo equipamento' : 'Editar equipamento'}</DialogTitle>
          <DialogDescription className="text-xs">
            Cadastro do unifilar — proprietário, planta e unidade vêm da instalação.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-8 flex items-center justify-center text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin mr-2" />Carregando…</div>
        ) : (
          <div className="space-y-4">
            {erro && <div className="text-xs px-2 py-1 rounded bg-red-500/15 text-red-600 dark:text-red-400">{erro}</div>}

            {/* Tipo */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Tipo <span className="text-red-500">*</span></Label>
              {mode === 'create' ? (
                <Select value={tipoId} onValueChange={escolherTipo}>
                  <SelectTrigger><SelectValue placeholder="Selecione o tipo" /></SelectTrigger>
                  <SelectContent>
                    {tipos.map((t) => <SelectItem key={t.id} value={t.id}>{t.nome}{t.sigla ? ` (${t.sigla})` : ''}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                <div className="px-3 py-2 bg-muted/50 rounded-md text-sm">{tipoLabel || '—'}</div>
              )}
            </div>

            {/* TAG */}
            <div className="space-y-1.5">
              <Label htmlFor="tag" className="text-sm font-medium">TAG</Label>
              <Input id="tag" value={tag} onChange={(e) => setTag(e.target.value)} placeholder="Ex: DJ-01" />
              <p className="text-[11px] text-muted-foreground">Gerada pelo tipo (prefixo editável, número sequencial por unidade).</p>
            </div>

            {/* Localização */}
            <div className="space-y-1.5">
              <Label htmlFor="loc" className="text-sm font-medium">Localização específica</Label>
              <Input id="loc" value={localizacao} onChange={(e) => setLocalizacao(e.target.value)} placeholder="Ex: Sala de controle, Painel A" />
            </div>

            {/* Supervisão e controle (SCS) — SCS é o guarda-chuva: ao marcá-lo,
                perguntamos as capacidades: Medição, Comando e/ou Status. */}
            <div className="pt-1 border-t">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold pt-3 pb-1">Supervisão e controle</div>
              <label className="flex items-center gap-2 py-1.5 cursor-pointer">
                <Checkbox checked={possuiScs} onCheckedChange={(v) => { const b = !!v; setPossuiScs(b); if (!b) { setPossuiMedicao(false); setScsComando(false); setScsStatus(false); } }} />
                <span className="text-sm">Possui SCS</span>
                <span className="text-[11px] text-muted-foreground">(supervisão e controle: medição, comando e/ou status)</span>
              </label>
              {possuiScs && (
                <div className="pl-6 space-y-1">
                  <label className="flex items-center gap-2 py-1 cursor-pointer">
                    <Checkbox checked={possuiMedicao} onCheckedChange={(v) => setPossuiMedicao(!!v)} />
                    <span className="text-sm">Medição</span>
                    <span className="text-[11px] text-muted-foreground">(monitoramento; PM/IED definido na associação no IoT)</span>
                  </label>
                  <label className="flex items-center gap-2 py-1 cursor-pointer">
                    <Checkbox
                      checked={scsComando}
                      onCheckedChange={(v) => {
                        const b = !!v; setScsComando(b);
                        setPontosComando(b ? (pontosComando.length ? pontosComando : nativos.comando) : []);
                      }}
                    />
                    <span className="text-sm">Comando</span>
                    <span className="text-[11px] text-muted-foreground">(abrir/fechar, ligar/desligar)</span>
                  </label>
                  {scsComando && <PontosPicker nativos={nativos.comando} selecionados={pontosComando} onChange={setPontosComando} />}

                  <label className="flex items-center gap-2 py-1 cursor-pointer">
                    <Checkbox
                      checked={scsStatus}
                      onCheckedChange={(v) => {
                        const b = !!v; setScsStatus(b);
                        setPontosStatus(b ? (pontosStatus.length ? pontosStatus : nativos.status) : []);
                      }}
                    />
                    <span className="text-sm">Status</span>
                    <span className="text-[11px] text-muted-foreground">(aberto/fechado, estados)</span>
                  </label>
                  {scsStatus && <PontosPicker nativos={nativos.status} selecionados={pontosStatus} onChange={setPontosStatus} />}
                </div>
              )}
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button type="button" onClick={salvar} disabled={!podeSalvar} className="bg-green-600 hover:bg-green-700">
            {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Salvando…</> : (mode === 'create' ? 'Criar e adicionar' : 'Salvar')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default EquipamentoCadastroModal;
