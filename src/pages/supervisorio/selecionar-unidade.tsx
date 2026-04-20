import { Layout } from "@/components/common/Layout";
import { TitleCard } from "@/components/common/title-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import {
  ChevronRight, ChevronDown, MapPin, Zap, Factory, Building2,
  Search, Loader2, ArrowRight, RefreshCw
} from "lucide-react";
import { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { PlantasService, type PlantaResponse } from "@/services/plantas.services";
import { type Unidade } from "@/services/unidades.services";
import { api } from "@/config/api";

export function SelecionarUnidadePage() {
  const navigate = useNavigate();
  const [plantas, setPlantas] = useState<PlantaResponse[]>([]);
  const [unidadesByPlanta, setUnidadesByPlanta] = useState<Record<string, Unidade[]>>({});
  const [expandedPlantaId, setExpandedPlantaId] = useState<string | null>(null);
  const [loadingPlantas, setLoadingPlantas] = useState(true);
  const [search, setSearch] = useState("");

  const loadPlantas = useCallback(async () => {
    try {
      setLoadingPlantas(true);
      const response = await PlantasService.getAllPlantas({ limit: 100 });
      const data = response.data || [];
      setPlantas(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Erro ao carregar plantas:", err);
    } finally {
      setLoadingPlantas(false);
    }
  }, []);

  useEffect(() => { loadPlantas(); }, [loadPlantas]);

  useEffect(() => {
    if (plantas.length === 0) return;
    plantas.forEach(async (p) => {
      if (unidadesByPlanta[p.id]) return;
      try {
        const response = await api.get(`/plantas/${p.id}/unidades`);
        const data = response.data?.data?.data || response.data?.data || response.data || [];
        setUnidadesByPlanta(prev => ({ ...prev, [p.id]: Array.isArray(data) ? data : [] }));
      } catch { /* ignore */ }
    });
  }, [plantas]);

  const handlePlantaClick = (plantaId: string) => {
    setExpandedPlantaId(expandedPlantaId === plantaId ? null : plantaId);
  };

  // Auto-expand plantas that match search by unidade name
  useEffect(() => {
    if (!search.trim()) return;
    const s = search.toLowerCase();
    for (const p of plantas) {
      const unidades = unidadesByPlanta[p.id] || [];
      const matchesUnidade = unidades.some(u =>
        u.nome?.toLowerCase().includes(s) ||
        (u as any).cidade?.toLowerCase().includes(s) ||
        (u as any).tipo?.toLowerCase().includes(s)
      );
      if (matchesUnidade) {
        setExpandedPlantaId(p.id);
        break;
      }
    }
  }, [search, plantas, unidadesByPlanta]);

  const handleUnidadeClick = (unidadeId: string) => {
    navigate(`/supervisorio/sinoptico-ativo/${unidadeId.trim()}`);
  };

  const filteredPlantas = useMemo(() => {
    if (!search.trim()) return plantas;
    const s = search.toLowerCase();
    return plantas.filter(p => {
      // Match on planta fields
      if (
        p.nome?.toLowerCase().includes(s) ||
        p.endereco?.cidade?.toLowerCase().includes(s) ||
        p.endereco?.uf?.toLowerCase().includes(s) ||
        p.cnpj?.includes(s) ||
        p.localizacao?.toLowerCase().includes(s)
      ) return true;
      // Match on unidade names within planta
      const unidades = unidadesByPlanta[p.id] || [];
      return unidades.some(u =>
        u.nome?.toLowerCase().includes(s) ||
        (u as any).cidade?.toLowerCase().includes(s) ||
        (u as any).tipo?.toLowerCase().includes(s)
      );
    });
  }, [plantas, search, unidadesByPlanta]);

  const getStatusBadge = (status: string) => {
    const s = status?.toLowerCase();
    if (s === "ativo") return <Badge className="bg-emerald-500/15 text-emerald-500 border-emerald-500/30 text-[11px]">Ativo</Badge>;
    if (s === "inativo") return <Badge className="bg-zinc-500/15 text-zinc-400 border-zinc-500/30 text-[11px]">Inativo</Badge>;
    return <Badge variant="outline" className="text-[11px]">{status || "—"}</Badge>;
  };

  const getTipoLabel = (tipo: string) => {
    const t: Record<string, string> = { UFV: "Usina Fotovoltaica", OUTRO: "Outro", Carga: "Carga" };
    return t[tipo] || tipo || "—";
  };

  return (
    <Layout>
      <Layout.Main>
        <div className="flex flex-col h-full w-full">
          <TitleCard
            title="Sinóptico"
            description="Selecione uma unidade para visualizar o diagrama sinóptico"
          />

          {/* Filters */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[280px] max-w-lg">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar planta, unidade, CNPJ ou localização..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex-1" />
            <Button variant="outline" onClick={loadPlantas} className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              Atualizar
            </Button>
          </div>

          {/* Table */}
          <div className="border rounded-md bg-card flex flex-col flex-1 min-h-0">
            <div className="overflow-auto flex-1">
              <Table className="table-minimal min-w-full">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead>Planta</TableHead>
                    <TableHead>Proprietário</TableHead>
                    <TableHead>Localização</TableHead>
                    <TableHead className="w-28 text-center">Unidades</TableHead>
                    <TableHead className="w-16"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingPlantas && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-16">
                        <div className="flex items-center justify-center gap-3">
                          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                          <span className="text-muted-foreground">Carregando plantas...</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}

                  {!loadingPlantas && filteredPlantas.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-16">
                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                          <Factory className="h-8 w-8 opacity-30" />
                          <p>{search ? "Nenhuma planta encontrada" : "Nenhuma planta cadastrada"}</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}

                  {!loadingPlantas && filteredPlantas.map((planta) => {
                    const isExpanded = expandedPlantaId === planta.id;
                    const unidades = unidadesByPlanta[planta.id] || [];

                    return (
                      <>
                        <TableRow
                          key={planta.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => handlePlantaClick(planta.id)}
                        >
                          <TableCell className="w-10">
                            {isExpanded
                              ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              : <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            }
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <Factory className="h-4 w-4 text-blue-500" />
                                <span className="font-medium">{planta.nome}</span>
                              </div>
                              {planta.cnpj && (
                                <div className="text-xs font-mono text-muted-foreground">
                                  CNPJ: {planta.cnpj}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Building2 className="h-4 w-4 text-gray-500" />
                              <div>
                                <span className="text-sm">{(planta as any).proprietario?.nome || "—"}</span>
                                {(planta as any).proprietario?.cpf_cnpj && (
                                  <div className="text-xs text-muted-foreground">
                                    {(planta as any).proprietario.tipo === 'pessoa_fisica' ? 'CPF' : 'CNPJ'}: {(planta as any).proprietario.cpf_cnpj}
                                  </div>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5">
                                <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className="text-sm">{planta.endereco?.cidade || "—"}/{planta.endereco?.uf || "—"}</span>
                              </div>
                              {planta.localizacao && (
                                <div className="text-xs text-muted-foreground truncate max-w-[200px]">{planta.localizacao}</div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            {unidadesByPlanta[planta.id]
                              ? <span className="font-semibold">{unidades.length}</span>
                              : <Loader2 className="h-3.5 w-3.5 animate-spin mx-auto text-muted-foreground" />
                            }
                          </TableCell>
                          <TableCell></TableCell>
                        </TableRow>

                        {isExpanded && (
                          !unidadesByPlanta[planta.id] ? (
                            <TableRow key={`${planta.id}-loading`}>
                              <TableCell colSpan={6} className="py-4">
                                <div className="flex items-center gap-2 pl-12 text-sm text-muted-foreground">
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                  Carregando unidades...
                                </div>
                              </TableCell>
                            </TableRow>
                          ) : unidades.length === 0 ? (
                            <TableRow key={`${planta.id}-empty`}>
                              <TableCell colSpan={6} className="py-4">
                                <div className="pl-12 text-sm text-muted-foreground">
                                  Nenhuma unidade cadastrada nesta planta
                                </div>
                              </TableCell>
                            </TableRow>
                          ) : (
                            unidades.map(unidade => (
                              <TableRow
                                key={unidade.id}
                                className="cursor-pointer hover:bg-primary/5 bg-muted/20"
                                onClick={() => handleUnidadeClick(unidade.id)}
                              >
                                <TableCell></TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-2 pl-6">
                                    <Zap className="h-4 w-4 text-amber-500" />
                                    <span className="text-sm font-medium">{unidade.nome}</span>
                                    {getStatusBadge((unidade as any).status)}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <span className="text-sm text-muted-foreground">
                                    {getTipoLabel((unidade as any).tipo)}
                                  </span>
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                    <MapPin className="h-3.5 w-3.5" />
                                    {(unidade as any).cidade || planta.endereco?.cidade || ""}/{(unidade as any).estado || planta.endereco?.uf || ""}
                                  </div>
                                </TableCell>
                                <TableCell className="text-center text-sm text-muted-foreground">
                                  {(unidade as any).potencia ? `${(unidade as any).potencia} kW` : "—"}
                                </TableCell>
                                <TableCell>
                                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                                </TableCell>
                              </TableRow>
                            ))
                          )
                        )}
                      </>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      </Layout.Main>
    </Layout>
  );
}

export default SelecionarUnidadePage;
