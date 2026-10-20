import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { numBr } from './formato';
import { geracaoApi, type ConfigUsina, type ConfigUsinaResposta, type FonteIrradiancia } from './api';

/**
 * Grupo "Usina" da configuração da instalação (NEXON-16, seção 7). Mesmas regras dos
 * parâmetros: faixa mín/máx, valor fora bloqueia salvar, revisão antigo → novo antes de gravar.
 * A API registra o histórico campo a campo e o evento no Registro da instalação.
 */

type Campo = 'kwp_dc' | 'potencia_ac_kw' | 'inclinacao_graus' | 'azimute_graus' | 'fator_desempenho';

const ROTULOS: Record<keyof ConfigUsina, string> = {
  fonte: 'Fonte de irradiância',
  solarimetro_equipamento_id: 'Solarímetro vinculado',
  solarimetro_medicao: 'Medição do solarímetro',
  kwp_dc: 'Potência de módulos (kWp DC)',
  potencia_ac_kw: 'Potência AC nominal (kW)',
  inclinacao_graus: 'Inclinação dos módulos (°)',
  azimute_graus: 'Azimute (°)',
  fator_desempenho: 'Fator de desempenho',
  exibir_rs: 'Exibir valores em R$',
  tarifa_concessionaria_id: 'Tarifa de referência',
  atualizado_em: '',
  atualizado_por: '',
};

const FONTES: Array<{ v: FonteIrradiancia; rotulo: string; detalhe: string }> = [
  { v: 'satelite', rotulo: 'Satélite', detalhe: 'Irradiância por satélite na coordenada da instalação' },
  { v: 'solarimetro', rotulo: 'Solarímetro', detalhe: 'Equipamento de medição cadastrado na instalação' },
  { v: 'nenhuma', rotulo: 'Nenhuma', detalhe: 'Sem esperado, perdas nem previsão (use em usina com seguidor)' },
];

const txt = (v: number | null | undefined) => (v == null ? '' : String(v).replace('.', ','));

export function ConfigUsinaDialog({ unidadeId, open, onOpenChange, onSalvo }: {
  unidadeId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSalvo?: () => void;
}) {
  const [dados, setDados] = useState<ConfigUsinaResposta | null>(null);
  const [form, setForm] = useState<ConfigUsina | null>(null);
  const [numeros, setNumeros] = useState<Record<Campo, string>>({ kwp_dc: '', potencia_ac_kw: '', inclinacao_graus: '', azimute_graus: '', fator_desempenho: '' });
  const [revisando, setRevisando] = useState(false);
  const [gravando, setGravando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setRevisando(false);
    setErro(null);
    setDados(null);
    setForm(null);
    geracaoApi.config(unidadeId).then((r) => {
      setDados(r);
      setForm(r.config);
      setNumeros({
        kwp_dc: txt(r.config.kwp_dc ?? r.sugestoes.kwp_dc),
        potencia_ac_kw: txt(r.config.potencia_ac_kw),
        inclinacao_graus: txt(r.config.inclinacao_graus ?? r.sugestoes.inclinacao_graus),
        azimute_graus: txt(r.config.azimute_graus ?? r.sugestoes.azimute_graus),
        fator_desempenho: txt(r.config.fator_desempenho ?? 0.8),
      });
    }).catch(() => setErro('Não foi possível carregar a configuração.'));
  }, [open, unidadeId]);

  const valores = useMemo(() => {
    const out = {} as Record<Campo, number | null>;
    (Object.keys(numeros) as Campo[]).forEach((k) => { out[k] = numBr(numeros[k]); });
    return out;
  }, [numeros]);

  const problema = (k: Campo): string | null => {
    if (!dados) return null;
    const v = valores[k];
    if (v == null) {
      if (k === 'kwp_dc') return 'Obrigatório';
      if ((k === 'inclinacao_graus' || k === 'azimute_graus') && form?.fonte !== 'nenhuma') return 'Obrigatório com fonte de irradiância';
      return null;
    }
    const [min, max] = dados.faixas[k];
    if (Number.isNaN(v) || v < min || v > max) return `Faixa ${txt(min)} a ${txt(max)}`;
    return null;
  };

  if (!open) return null;

  const campos: Campo[] = ['kwp_dc', 'potencia_ac_kw', 'inclinacao_graus', 'azimute_graus', 'fator_desempenho'];
  const errosCampos = campos.map(problema).filter(Boolean);
  const erroSolarimetro = form?.fonte === 'solarimetro' && (!form.solarimetro_equipamento_id || !form.solarimetro_medicao);
  const bloqueado = !form || errosCampos.length > 0 || erroSolarimetro;

  const novo: ConfigUsina | null = form && {
    ...form,
    kwp_dc: valores.kwp_dc,
    potencia_ac_kw: valores.potencia_ac_kw,
    inclinacao_graus: valores.inclinacao_graus,
    azimute_graus: valores.azimute_graus,
    fator_desempenho: valores.fator_desempenho ?? 0.8,
    solarimetro_equipamento_id: form.fonte === 'solarimetro' ? form.solarimetro_equipamento_id : null,
    solarimetro_medicao: form.fonte === 'solarimetro' ? form.solarimetro_medicao : null,
    tarifa_concessionaria_id: form.exibir_rs ? form.tarifa_concessionaria_id : null,
  };

  const mostrar = (k: keyof ConfigUsina, v: unknown): string => {
    if (v == null || v === '') return k === 'potencia_ac_kw' ? 'soma dos inversores' : '—';
    if (typeof v === 'boolean') return v ? 'sim' : 'não';
    if (k === 'fonte') return FONTES.find((f) => f.v === v)?.rotulo ?? String(v);
    if (k === 'solarimetro_equipamento_id') return dados?.solarimetros.find((s) => s.id === v)?.nome ?? String(v);
    if (k === 'tarifa_concessionaria_id') return dados?.concessionarias.find((c) => c.id === v)?.nome ?? String(v);
    if (typeof v === 'number') return v.toLocaleString('pt-BR', { maximumFractionDigits: 3 });
    return String(v);
  };

  const mudancas = dados && novo
    ? (Object.keys(ROTULOS) as Array<keyof ConfigUsina>)
        .filter((k) => ROTULOS[k] && k !== 'atualizado_em' && k !== 'atualizado_por')
        .filter((k) => (dados.config[k] ?? null) !== (novo[k] ?? null))
        .map((k) => ({ label: ROTULOS[k], de: mostrar(k, dados.config[k]), para: mostrar(k, novo[k]) }))
    : [];

  const gravar = async () => {
    if (!novo) return;
    setGravando(true);
    setErro(null);
    try {
      const { atualizado_em: _a, atualizado_por: _b, ...corpo } = novo;
      await geracaoApi.salvarConfig(unidadeId, corpo);
      onOpenChange(false);
      onSalvo?.();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: unknown } } } | null)?.response?.data?.message;
      setErro(typeof msg === 'string' ? msg : 'Não foi possível gravar.');
      setRevisando(false);
    } finally {
      setGravando(false);
    }
  };

  const set = <K extends keyof ConfigUsina>(k: K, v: ConfigUsina[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));
  const selectCls = 'h-9 w-full rounded-md border bg-background px-2 text-sm';

  // Função de render (não componente): componente criado dentro do render remonta o input e perde o foco.
  const campoNumero = (k: Campo, dica?: string) => {
    const p = problema(k);
    const [min, max] = dados?.faixas[k] ?? [0, 0];
    return (
      <label key={k} className="block">
        <span className="text-xs font-medium">{ROTULOS[k]}</span>
        <Input
          inputMode="decimal"
          value={numeros[k]}
          onChange={(e) => setNumeros((n) => ({ ...n, [k]: e.target.value }))}
          className={`mt-1 ${p ? 'border-red-500' : ''}`}
          placeholder={k === 'potencia_ac_kw' && dados?.sugestoes.potencia_ac_kw ? `soma dos inversores: ${txt(dados.sugestoes.potencia_ac_kw)}` : undefined}
        />
        <span className={`mt-0.5 block text-[11px] ${p ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}>
          {p ?? dica ?? `faixa ${txt(min)} a ${txt(max)}`}
        </span>
      </label>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{revisando ? 'Confirmar alterações' : 'Configuração da usina'}</DialogTitle>
          <DialogDescription>
            {revisando
              ? 'Confira antes de gravar. A alteração fica no histórico da instalação.'
              : dados?.config.atualizado_em
                ? `Última alteração ${new Date(dados.config.atualizado_em).toLocaleString('pt-BR')}${dados.config.atualizado_por ? ` por ${dados.config.atualizado_por}` : ''}.`
                : 'Usada no esperado, nas perdas, na previsão e nos valores em R$ da análise de geração.'}
          </DialogDescription>
        </DialogHeader>

        {!form || !dados ? (
          <div className="grid h-40 place-items-center">
            {erro ? <span className="text-sm text-red-600">{erro}</span> : <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
          </div>
        ) : revisando ? (
          <div className="divide-y text-sm">
            {mudancas.length === 0 && <p className="py-3 text-muted-foreground">Nada mudou.</p>}
            {mudancas.map((m) => (
              <div key={m.label} className="flex justify-between gap-3 py-2">
                <span>{m.label}</span>
                <span className="text-right"><span className="text-muted-foreground">{m.de}</span> → <b>{m.para}</b></span>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            <fieldset>
              <legend className="text-xs font-medium">{ROTULOS.fonte}</legend>
              <div className="mt-1 grid gap-2 sm:grid-cols-3">
                {FONTES.map((f) => (
                  <button
                    key={f.v}
                    type="button"
                    onClick={() => set('fonte', f.v)}
                    aria-pressed={form.fonte === f.v}
                    className={`rounded-md border p-2 text-left text-sm ${form.fonte === f.v ? 'border-emerald-600 ring-1 ring-emerald-600' : 'hover:bg-muted'}`}
                  >
                    <div className="font-medium">{f.rotulo}</div>
                    <div className="text-[11px] text-muted-foreground">{f.detalhe}</div>
                  </button>
                ))}
              </div>
            </fieldset>

            {form.fonte === 'solarimetro' && (
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="text-xs font-medium">{ROTULOS.solarimetro_equipamento_id}</span>
                  <select className={`mt-1 ${selectCls}`} value={form.solarimetro_equipamento_id ?? ''} onChange={(e) => set('solarimetro_equipamento_id', e.target.value || null)}>
                    <option value="">{dados.solarimetros.length ? 'Escolha…' : 'Nenhum solarímetro cadastrado'}</option>
                    {dados.solarimetros.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="text-xs font-medium">{ROTULOS.solarimetro_medicao}</span>
                  <select className={`mt-1 ${selectCls}`} value={form.solarimetro_medicao ?? ''} onChange={(e) => set('solarimetro_medicao', (e.target.value || null) as ConfigUsina['solarimetro_medicao'])}>
                    <option value="">Escolha…</option>
                    <option value="GHI">GHI — plano horizontal</option>
                    <option value="POA">POA — plano dos módulos</option>
                  </select>
                </label>
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              {campoNumero('kwp_dc')}
              {campoNumero('potencia_ac_kw', 'Vazio = soma dos inversores')}
              {campoNumero('inclinacao_graus')}
              {campoNumero('azimute_graus', '0 = norte, 90 = leste, 180 = sul')}
              {campoNumero('fator_desempenho', 'Calibração do esperado, padrão 0,80')}
            </div>

            <div className="rounded-md border p-3">
              <label className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium">{ROTULOS.exibir_rs}</span>
                <Switch checked={form.exibir_rs} onCheckedChange={(v) => set('exibir_rs', v)} />
              </label>
              {form.exibir_rs && (
                <label className="mt-3 block">
                  <span className="text-xs font-medium">{ROTULOS.tarifa_concessionaria_id}</span>
                  <select className={`mt-1 ${selectCls}`} value={form.tarifa_concessionaria_id ?? ''} onChange={(e) => set('tarifa_concessionaria_id', e.target.value || null)}>
                    <option value="">Da instalação</option>
                    {dados.concessionarias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                  <span className="mt-0.5 block text-[11px] text-muted-foreground">
                    {dados.tarifa_preview_rs_kwh != null
                      ? `Tarifa com impostos hoje: R$ ${dados.tarifa_preview_rs_kwh.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}/kWh. Valores sempre "estimados".`
                      : 'Concessionária sem tarifa cadastrada.'}
                  </span>
                </label>
              )}
            </div>
            {erro && <p className="text-sm text-red-600 dark:text-red-400">{erro}</p>}
          </div>
        )}

        <DialogFooter className="gap-2">
          {revisando ? (
            <>
              <button type="button" className="btn-minimal-outline" onClick={() => setRevisando(false)} disabled={gravando}>Voltar</button>
              <button type="button" className="btn-minimal-primary" onClick={gravar} disabled={gravando || mudancas.length === 0}>
                {gravando ? 'Gravando…' : 'Gravar'}
              </button>
            </>
          ) : (
            <>
              <button type="button" className="btn-minimal-outline" onClick={() => onOpenChange(false)}>Cancelar</button>
              <button type="button" className="btn-minimal-primary" disabled={!!bloqueado || !dados?.pode_editar} onClick={() => setRevisando(true)}>
                Revisar alterações
              </button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ConfigUsinaDialog;
