// InstrucoesInstalacaoModal — instruções de instalação POR MODELO (catálogo), abertas pelo
// botão "Instruções de instalação" no sheet de propriedades do editor IoT (Power Meter,
// Medidor Concessionária, inversores).
//
// Fonte: iot_device_modelos.mapeamento.instrucoes (servido no device-catalog.js →
// getCatalogDevice(catalog_id).instrucoes). Formato, por CONTEXTO de ligação:
//   instrucoes: {
//     padrao?:  Guia,   // vale p/ qualquer ligação
//     a966?:    Guia,   // medidor lido por um Gateway A966
//     ton_ssu?: Guia,   // medidor lido pela entrada SSU da TON v2
//     rs485?:   Guia,   // device em RS485 direto na TON
//     tcp?:     Guia,   // device por Modbus TCP (datalogger/IP)
//   }
//   Guia = { titulo?: string; resumo?: string; passos: Array<{ titulo: string; texto?: string;
//            itens?: string[]; valores?: Array<[rotulo, valor]>; imagem?: string; alerta?: string }> }
// Contexto sem guia próprio cai no `padrao`.
import React, { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export type ContextoInstalacao = 'padrao' | 'a966' | 'ton_ssu' | 'rs485' | 'tcp';

interface Passo {
  titulo: string;
  texto?: string;
  itens?: string[];
  valores?: Array<[string, string | number]>;
  imagem?: string;
  alerta?: string;
}
export interface GuiaInstalacao { titulo?: string; resumo?: string; passos: Passo[] }

const ROTULO_CONTEXTO: Record<ContextoInstalacao, string> = {
  padrao: '',
  a966: 'lido pelo Gateway A966',
  ton_ssu: 'lido pela SSU da TON v2',
  rs485: 'RS485 direto na TON',
  tcp: 'Modbus TCP',
};

/** Guia do modelo para o contexto (ou o padrão). null = modelo sem instrução cadastrada. */
export function guiaDoModelo(catalogId: string | undefined | null, contexto: ContextoInstalacao): GuiaInstalacao | null {
  const get = (window as unknown as { getCatalogDevice?: (c: string) => any }).getCatalogDevice;
  const dev = catalogId ? get?.(String(catalogId)) : null;
  const ins = dev?.instrucoes;
  if (!ins || typeof ins !== 'object') return null;
  const g = (ins[contexto] ?? ins.padrao) as GuiaInstalacao | undefined;
  return g && Array.isArray(g.passos) && g.passos.length > 0 ? g : null;
}

function CopiaValor({ rotulo, valor }: { rotulo: string; valor: string | number }) {
  const [ok, setOk] = useState(false);
  return (
    <div className="flex items-center gap-2 py-0.5">
      <span className="text-xs text-muted-foreground w-32 shrink-0">{rotulo}</span>
      <code className="flex-1 min-w-0 truncate text-xs px-2 py-1 rounded border bg-muted/40">{String(valor)}</code>
      <button
        type="button"
        className="shrink-0 p-1 rounded hover:bg-muted"
        title="Copiar"
        onClick={async () => { try { await navigator.clipboard.writeText(String(valor)); setOk(true); setTimeout(() => setOk(false), 1200); } catch { /* sem clipboard */ } }}
      >
        {ok ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>
    </div>
  );
}

export const InstrucoesInstalacaoModal: React.FC<{
  open: boolean;
  onClose: () => void;
  catalogId?: string | null;
  modeloNome?: string;
  contexto: ContextoInstalacao;
}> = ({ open, onClose, catalogId, modeloNome, contexto }) => {
  const guia = guiaDoModelo(catalogId, contexto);
  const ctx = ROTULO_CONTEXTO[contexto];
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-2xl max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {guia?.titulo || `Instruções de instalação${modeloNome ? ` — ${modeloNome}` : ''}`}
            {ctx && <span className="block text-xs font-normal text-muted-foreground mt-1">{ctx}</span>}
          </DialogTitle>
        </DialogHeader>
        {!catalogId ? (
          <p className="text-sm text-muted-foreground py-4">Escolha o modelo do equipamento para ver as instruções.</p>
        ) : !guia ? (
          <p className="text-sm text-muted-foreground py-4">Ainda não há instruções cadastradas para este modelo.</p>
        ) : (
          <div className="space-y-4">
            {guia.resumo && <p className="text-sm text-muted-foreground">{guia.resumo}</p>}
            <ol className="space-y-4">
              {guia.passos.map((p, i) => (
                <li key={i} className="flex gap-3">
                  <span className="shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-semibold grid place-items-center">{i + 1}</span>
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="text-sm font-medium">{p.titulo}</div>
                    {p.texto && <p className="text-sm text-muted-foreground whitespace-pre-line">{p.texto}</p>}
                    {p.itens && p.itens.length > 0 && (
                      <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-0.5">
                        {p.itens.map((it, k) => <li key={k}>{it}</li>)}
                      </ul>
                    )}
                    {p.valores && p.valores.length > 0 && (
                      <div className="rounded-md border p-2">{p.valores.map(([r, v], k) => <CopiaValor key={k} rotulo={r} valor={v} />)}</div>
                    )}
                    {p.imagem && <img src={p.imagem} alt={p.titulo} className="rounded-md border max-h-80 object-contain" loading="lazy" />}
                    {p.alerta && (
                      <p className="text-xs rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-200 px-2.5 py-1.5">{p.alerta}</p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default InstrucoesInstalacaoModal;
