// src/features/equipamentos/config/table-config.tsx - ESTRUTURA SIMPLIFICADA
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Wrench, Building2, Factory, AlertTriangle, AlertCircle, CheckCircle, Component, MapPin } from 'lucide-react';
import { TableColumn } from '@/types/base';
import { Equipamento } from '../types';

// Definir o tipo para as props de ações customizadas
interface TableActionsProps {
  onGerenciarComponentes?: (equipamento: Equipamento) => void;
}

export const getEquipamentosTableColumns = (actions?: TableActionsProps): TableColumn<Equipamento>[] => [
  {
    key: 'nome',
    label: 'Equipamento / Componente',
    sortable: true,
    render: (equipamento) => (
      <div className="flex items-center gap-2">
        {equipamento.classificacao === 'UC' ? (
          <Wrench className="h-4 w-4 text-orange-600" />
        ) : (
          <Component className="h-4 w-4 text-blue-600" />
        )}
        <div className="flex flex-col">
          <span className="font-medium">{equipamento.nome}</span>
          <div className="flex items-center gap-2 mt-1">
            <Badge 
              variant="outline" 
              className={equipamento.classificacao === 'UC' 
                ? "bg-orange-50 text-orange-700 border-orange-200 text-xs" 
                : "bg-blue-50 text-blue-700 border-blue-200 text-xs"
              }
            >
              {equipamento.classificacao}
            </Badge>
            {equipamento.tipo && (
              <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200 text-xs">
                {equipamento.tipo}
              </Badge>
            )}
          </div>
        </div>
      </div>
    )
  },
  
  {
    key: 'hierarquia',
    label: 'Hierarquia',
    render: (equipamento) => (
      <div className="flex flex-col text-sm gap-0.5">
        {/* Planta */}
        <div className="flex items-center gap-1">
          <Factory className="h-3 w-3 text-blue-500" />
          <span className="font-medium text-xs">
            {equipamento.unidade?.planta?.nome || equipamento.planta?.nome || '-'}
          </span>
        </div>

        {/* Unidade */}
        {equipamento.unidade && (
          <div className="flex items-center gap-1 text-primary">
            <MapPin className="h-3 w-3" />
            <span className="text-xs">
              → {equipamento.unidade.nome}
            </span>
          </div>
        )}

        {/* Proprietário */}
        <div className="flex items-center gap-1 text-muted-foreground">
          <Building2 className="h-3 w-3" />
          <span className="text-xs">
            {equipamento.unidade?.planta?.proprietario?.nome || equipamento.proprietario?.razaoSocial || '-'}
          </span>
        </div>

        {/* Se for UAR, mostrar o UC pai */}
        {equipamento.classificacao === 'UAR' && equipamento.equipamentoPai && (
          <div className="flex items-center gap-1 mt-1 text-orange-600">
            <Wrench className="h-3 w-3" />
            <span className="text-xs">
              ↳ {equipamento.equipamentoPai.nome}
            </span>
          </div>
        )}
      </div>
    )
  },
  
  {
    key: 'localizacao',
    label: 'Localização (Área)',
    render: (equipamento) => (
      <div className="flex items-center gap-1 text-sm">
        <MapPin className="h-3 w-3 text-gray-500" />
        <span className="truncate max-w-32" title={equipamento.localizacao}>
          {equipamento.localizacao || '-'}
        </span>
      </div>
    )
  },
  
  {
    key: 'criticidade',
    label: 'Criticidade',
    render: (equipamento) => {
      const config = {
        '5': {
          icon: <AlertTriangle className="h-3 w-3" />,
          color: "bg-red-50 text-red-700 border-red-200",
          label: "Muito Alta (5)"
        },
        '4': {
          icon: <AlertTriangle className="h-3 w-3" />,
          color: "bg-orange-50 text-orange-700 border-orange-200",
          label: "Alta (4)"
        },
        '3': {
          icon: <AlertCircle className="h-3 w-3" />,
          color: "bg-yellow-50 text-yellow-700 border-yellow-200",
          label: "Média (3)"
        },
        '2': {
          icon: <CheckCircle className="h-3 w-3" />,
          color: "bg-blue-50 text-blue-700 border-blue-200",
          label: "Baixa (2)"
        },
        '1': {
          icon: <CheckCircle className="h-3 w-3" />,
          color: "bg-green-50 text-green-700 border-green-200",
          label: "Muito Baixa (1)"
        }
      };
      
      const currentConfig = config[equipamento.criticidade] || config['3'];
      
      return (
        <Badge variant="outline" className={`${currentConfig.color} text-xs`}>
          {currentConfig.icon}
          <span className="ml-1">{equipamento.criticidade}</span>
        </Badge>
      );
    }
  },
  
  {
    key: 'fabricante',
    label: 'Fabricante',
    hideOnTablet: true,
    render: (equipamento) => (
      <div className="flex flex-col">
        <span className="text-sm font-medium">{equipamento.fabricante}</span>
        <span className="text-xs text-muted-foreground">{equipamento.modelo}</span>
      </div>
    )
  },
  
  {
    key: 'componentes_uar',
    label: 'Componentes UAR',
    render: (equipamento) => (
      <div className="flex items-center gap-2">
        {equipamento.classificacao === 'UC' ? (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <Component className="h-3 w-3 text-blue-600" />
              <Badge variant="secondary" className="text-xs">
                {equipamento.totalComponentes || 0}
              </Badge>
            </div>
            {actions?.onGerenciarComponentes && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => actions.onGerenciarComponentes!(equipamento)}
                className="text-blue-600 border-blue-200 hover:bg-blue-50 text-xs h-7"
              >
                <Component className="h-3 w-3 mr-1" />
                Gerenciar
              </Button>
            )}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Component className="h-3 w-3" />
            Componente UAR
          </span>
        )}
      </div>
    )
  },
  
  {
    key: 'valorContabil',
    label: 'Valor',
    hideOnMobile: true,
    render: (equipamento) => (
      <div className="text-right">
        {equipamento.valorContabil ? (
          <span className="font-mono text-sm">
            R$ {equipamento.valorContabil.toLocaleString('pt-BR', { 
              minimumFractionDigits: 0,
              maximumFractionDigits: 0 
            })}
          </span>
        ) : (
          <span className="text-muted-foreground text-sm">-</span>
        )}
      </div>
    )
  }
];

// Manter a exportação antiga para compatibilidade
export const equipamentosTableColumns = getEquipamentosTableColumns();