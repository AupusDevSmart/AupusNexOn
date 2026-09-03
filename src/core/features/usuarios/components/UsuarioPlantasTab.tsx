import { useEffect, useState } from 'react';
import { AlertCircle, Loader2, Factory } from 'lucide-react';
import { useHttpClient } from '@/core/context/hooks';

interface UsuarioPlantasTabProps {
  usuarioId: string;
}

interface VinculoPlanta {
  id: string;
  planta_id: string;
  created_at: string;
  planta: {
    id: string;
    nome: string;
    cnpj: string | null;
    cidade: string | null;
    uf: string | null;
  };
}

export function UsuarioPlantasTab({ usuarioId }: UsuarioPlantasTabProps) {
  const httpClient = useHttpClient();
  const [vinculos, setVinculos] = useState<VinculoPlanta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    const carregar = async () => {
      setLoading(true);
      setError(null);
      try {
        const resp = await httpClient.get(`/usuarios/${usuarioId.trim()}/plantas-operadas`);
        if (cancel) return;
        const data = Array.isArray(resp.data) ? resp.data : resp.data?.data ?? [];
        setVinculos(data);
      } catch (err: any) {
        if (cancel) return;
        setError(err?.response?.data?.message || err?.message || 'Erro ao carregar plantas atribuidas');
      } finally {
        if (!cancel) setLoading(false);
      }
    };
    if (usuarioId) carregar();
    return () => {
      cancel = true;
    };
  }, [usuarioId]);

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold mb-1">Plantas atribuidas</h3>
        <p className="text-xs text-muted-foreground">
          Espelho dos vinculos `planta_operadores`. Apenas estas plantas (e dados ligados a elas) sao visiveis para este operador.
        </p>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md dark:bg-red-950 dark:border-red-800 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
          <p className="text-xs text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando...
        </div>
      ) : vinculos.length === 0 ? (
        <div className="text-sm text-muted-foreground italic py-2">
          Este operador nao tem plantas vinculadas — ele nao vera dados no app ate ser vinculado.
        </div>
      ) : (
        <ul className="border rounded-md divide-y">
          {vinculos.map((v) => (
            <li key={v.id} className="px-3 py-2 flex items-center gap-3">
              <Factory className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{v.planta.nome}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {[v.planta.cidade, v.planta.uf].filter(Boolean).join(' / ') || v.planta.cnpj || '—'}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
