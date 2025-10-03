import { Layout } from "@/components/common/Layout";
import { TitleCard } from "@/components/common/title-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, Zap, ArrowRight, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

interface Unidade {
  id: string;
  nome: string;
  tipo: string;
  localizacao: {
    estado: string;
    cidade: string;
    latitude: number;
    longitude: number;
  };
  potencia: number;
  status: string;
  pontosMedicao: string[];
}

export function SelecionarUnidadePage() {
  const navigate = useNavigate();
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchUnidades();
  }, []);

  const fetchUnidades = async () => {
    try {
      setLoading(true);
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      const response = await fetch(`${API_URL.replace('/api', '')}/unidades`);

      if (!response.ok) {
        throw new Error('Erro ao buscar unidades');
      }

      const result = await response.json();
      setUnidades(result.data || []);
      setError(null);
    } catch (err) {
      console.error('Erro ao buscar unidades:', err);
      setError(err instanceof Error ? err.message : 'Erro ao carregar unidades');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectUnidade = (unidadeId: string) => {
    // Remover espaços em branco do ID
    const cleanId = unidadeId.trim();
    navigate(`/supervisorio/sinoptico-ativo/${cleanId}`);
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'ativo':
        return 'bg-green-500';
      case 'inativo':
        return 'bg-gray-500';
      case 'manutencao':
        return 'bg-yellow-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getTipoLabel = (tipo: string) => {
    const tipos: Record<string, string> = {
      'UFV': 'Usina Fotovoltaica',
      'UTE': 'Usina Termelétrica',
      'PCH': 'Pequena Central Hidrelétrica',
      'EOL': 'Usina Eólica',
      'Motor': 'Motor Elétrico',
      'Inversor': 'Inversor Solar',
    };
    return tipos[tipo] || tipo;
  };

  return (
    <Layout title="Selecionar Unidade" breadcrumbs={[{ label: "Supervisório" }, { label: "Selecionar Unidade" }]}>
      <div className="space-y-6">
        <TitleCard
          title="Selecionar Unidade"
          subtitle="Escolha uma unidade para visualizar o diagrama sinóptico em tempo real"
        />

        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-3 text-lg">Carregando unidades...</span>
          </div>
        )}

        {error && (
          <Card className="border-red-500 bg-red-500/10">
            <CardContent className="pt-6">
              <p className="text-red-500 text-center">{error}</p>
              <Button onClick={fetchUnidades} className="mt-4 mx-auto block">
                Tentar Novamente
              </Button>
            </CardContent>
          </Card>
        )}

        {!loading && !error && unidades.length === 0 && (
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-muted-foreground">
                Nenhuma unidade cadastrada. Por favor, cadastre uma unidade primeiro.
              </p>
            </CardContent>
          </Card>
        )}

        {!loading && !error && unidades.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {unidades.map((unidade) => (
              <Card
                key={unidade.id}
                className="hover:shadow-lg transition-shadow cursor-pointer group"
                onClick={() => handleSelectUnidade(unidade.id)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg group-hover:text-primary transition-colors">
                        {unidade.nome}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        {getTipoLabel(unidade.tipo)}
                      </CardDescription>
                    </div>
                    <Badge className={getStatusColor(unidade.status)}>
                      {unidade.status}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* Localização */}
                  <div className="flex items-center text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4 mr-2" />
                    {unidade.localizacao.cidade} - {unidade.localizacao.estado}
                  </div>

                  {/* Potência */}
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Zap className="h-4 w-4 mr-2" />
                    {unidade.potencia} kW
                  </div>

                  {/* Pontos de Medição */}
                  <div className="pt-2 border-t">
                    <p className="text-xs text-muted-foreground mb-2">
                      {unidade.pontosMedicao.length} ponto(s) de medição
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {unidade.pontosMedicao.slice(0, 3).map((ponto, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs">
                          {ponto.length > 20 ? ponto.substring(0, 20) + '...' : ponto}
                        </Badge>
                      ))}
                      {unidade.pontosMedicao.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{unidade.pontosMedicao.length - 3}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Botão */}
                  <Button
                    className="w-full mt-4"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelectUnidade(unidade.id);
                    }}
                  >
                    Ver Diagrama
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}

export default SelecionarUnidadePage;
