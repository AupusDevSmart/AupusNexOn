// src/features/financeiro/components/centros-custo-view-modal.tsx
import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { 
  Building2, 
  User, 
  Mail, 
  Calendar, 
  DollarSign, 
  TrendingUp,
  Edit,
  Copy,
  ExternalLink
} from 'lucide-react';
import { CentroCusto } from '@/types/dtos/financeiro';

interface CentrosCustoViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  centro: CentroCusto | null;
  allCentros: CentroCusto[];
}

export function CentrosCustoViewModal({
  isOpen,
  onClose,
  centro,
  allCentros
}: CentrosCustoViewModalProps): JSX.Element {
  if (!centro) return <></>;

  // Encontrar centro pai
  const centroPai = centro.centroPai 
    ? allCentros.find(c => c.id === centro.centroPai)
    : null;

  // Encontrar sub-centros
  const subCentros = allCentros.filter(c => c.centroPai === centro.id);

  // Calcular utilização do orçamento
  const utilizacao = centro.orcamentoMensal > 0 
    ? (centro.gastoAcumulado / centro.orcamentoMensal) * 100 
    : 0;

  // Renderização do status
  const renderStatus = (status: CentroCusto['status']): JSX.Element => {
    switch (status) {
      case 'ativo':
        return (
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
            Ativo
          </Badge>
        );
      case 'inativo':
        return (
          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
            Inativo
          </Badge>
        );
      default:
        return <Badge variant="outline">Desconhecido</Badge>;
    }
  };

  // Renderização do tipo
  const renderTipo = (tipo: CentroCusto['tipo']): JSX.Element => {
    const config = {
      administrativo: { label: 'Administrativo', color: 'bg-blue-50 text-blue-700 border-blue-200' },
      operacional: { label: 'Operacional', color: 'bg-purple-50 text-purple-700 border-purple-200' },
      comercial: { label: 'Comercial', color: 'bg-green-50 text-green-700 border-green-200' },
      projeto: { label: 'Projeto', color: 'bg-orange-50 text-orange-700 border-orange-200' }
    };

    const tipoConfig = config[tipo];
    
    return (
      <Badge variant="outline" className={tipoConfig.color}>
        {tipoConfig.label}
      </Badge>
    );
  };

  // Formatação de data
  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              {centro.nome}
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm">
                <Copy className="h-4 w-4 mr-1" />
                Duplicar
              </Button>
              <Button variant="outline" size="sm">
                <Edit className="h-4 w-4 mr-1" />
                Editar
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Informações Básicas */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Informações Básicas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Código</label>
                  <p className="font-mono text-lg font-semibold">{centro.codigo}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Status</label>
                  <div className="mt-1">
                    {renderStatus(centro.status)}
                  </div>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground">Nome Completo</label>
                <p className="text-lg">{centro.nome}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Tipo</label>
                  <div className="mt-1">
                    {renderTipo(centro.tipo)}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Centro Pai</label>
                  <p className="text-sm">
                    {centroPai ? (
                      <span className="flex items-center gap-1">
                        <ExternalLink className="h-3 w-3" />
                        {centroPai.codigo} - {centroPai.nome}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Centro Principal</span>
                    )}
                  </p>
                </div>
              </div>

              {centro.descricao && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Descrição</label>
                  <p className="text-sm mt-1 text-muted-foreground">{centro.descricao}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Responsável */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <User className="h-5 w-5" />
                Responsável
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center">
                  <User className="h-6 w-6 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <p className="font-medium">{centro.responsavel}</p>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Mail className="h-3 w-3" />
                    {centro.email}
                  </div>
                </div>
                <Button variant="outline" size="sm">
                  <Mail className="h-4 w-4 mr-1" />
                  Contatar
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Orçamento e Gastos */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Orçamento e Utilização
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Orçamento Mensal</label>
                  <p className="text-xl font-semibold text-blue-600">
                    R$ {centro.orcamentoMensal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Gasto Acumulado</label>
                  <p className="text-xl font-semibold text-orange-600">
                    R$ {centro.gastoAcumulado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm font-medium text-muted-foreground">Utilização do Orçamento</label>
                  <span className="text-sm font-medium">
                    {utilizacao.toFixed(1)}%
                  </span>
                </div>
                <Progress value={utilizacao} className="h-3" />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>R$ 0</span>
                  <span>
                    Saldo: R$ {(centro.orcamentoMensal - centro.gastoAcumulado).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Sub-centros */}
          {subCentros.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Sub-centros de Custo ({subCentros.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {subCentros.map((sub) => (
                    <div key={sub.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-muted rounded flex items-center justify-center">
                          <Building2 className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="font-medium">{sub.nome}</p>
                          <p className="text-sm text-muted-foreground">{sub.codigo}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">
                          R$ {sub.orcamentoMensal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                        <p className="text-xs text-muted-foreground">Orçamento</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Metadados */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Informações do Sistema
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <label className="font-medium text-muted-foreground">Data de Criação</label>
                  <p>{formatDate(centro.dataCreacao)}</p>
                </div>
                <div>
                  <label className="font-medium text-muted-foreground">Última Atualização</label>
                  <p>{formatDate(centro.ultimaAtualizacao)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}