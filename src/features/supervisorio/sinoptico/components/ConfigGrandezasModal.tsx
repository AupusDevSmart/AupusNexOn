import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { usePmsUnidade, type PmInfo } from "../hooks/usePmsUnidade";
import { useSinopticoConfig } from "../hooks/useSinopticoConfig";

/** Referencia estavel para evitar loop de efeito enquanto a query carrega. */
const EMPTY_PMS: PmInfo[] = [];

interface ConfigGrandezasModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  unidadeId: string;
}

/**
 * Seleciona quais Power Meters alimentam os KPIs e o painel de grandezas (R2/R3).
 * Salva em configuracoes.grandezasPmIds do diagrama. Todos marcados = salva []
 * (auto-todos), evitando travar a config se um PM for adicionado depois.
 */
export function ConfigGrandezasModal({ open, onOpenChange, unidadeId }: ConfigGrandezasModalProps) {
  const pms = usePmsUnidade(unidadeId).data ?? EMPTY_PMS;
  const { grandezasPmIds, diagramaId, salvar } = useSinopticoConfig(unidadeId);
  const [sel, setSel] = useState<Set<string>>(new Set());

  // Ao abrir, inicia com a selecao salva; se vazia, considera todos (auto-todos).
  useEffect(() => {
    if (!open) return;
    const base = grandezasPmIds.length ? grandezasPmIds : pms.map((p) => p.id);
    setSel(new Set(base));
  }, [open, grandezasPmIds, pms]);

  const toggle = (id: string) =>
    setSel((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const onSalvar = async () => {
    try {
      // Todos marcados -> [] (auto-todos); senao, os escolhidos.
      const ids = pms.length > 0 && sel.size === pms.length ? [] : Array.from(sel);
      await salvar.mutateAsync(ids);
      toast.success("Medidores atualizados");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao salvar");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Medidores das grandezas</DialogTitle>
          <DialogDescription>
            Escolha quais Power Meters alimentam os KPIs e o painel de grandezas.
          </DialogDescription>
        </DialogHeader>

        <div className="flex max-h-[50dvh] flex-col gap-0.5 overflow-y-auto">
          {pms.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Nenhum Power Meter com MQTT nesta unidade.
            </p>
          ) : (
            pms.map((pm) => (
              <label
                key={pm.id}
                className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-muted"
              >
                <Checkbox checked={sel.has(pm.id)} onCheckedChange={() => toggle(pm.id)} />
                {pm.nome}
              </label>
            ))
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" className="rounded-sm" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button className="rounded-sm" onClick={onSalvar} disabled={!diagramaId || salvar.isPending}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
