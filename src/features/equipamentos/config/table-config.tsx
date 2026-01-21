// src/features/equipamentos/config/table-config.tsx - ESTRUTURA SIMPLIFICADA
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Wrench, Building2, Factory, AlertTriangle, AlertCircle, CheckCircle, Component, MapPin } from 'lucide-react';
import { TableColumn } from '@/types/base';
import { Equipamento } from '../types';

// Definir o tipo para as props de ações customizadas
interface TableActionsProps {
  onGerenciarComponentes?: (equipamento: Equipamento) => void;
  isAdmin?: boolean;
}

export const getEquipamentosTableColumns = (actions?: TableActionsProps): TableColumn<Equipamento>[] => [
  {
    key: 'nome',
    label: 'Equipamento / Componente',
    sortable: true,
    render: (equipamento) => (
      <div className="flex items-center gap-3">
        {equipamento.classificacao === 'UC' ? (
          <Wrench className="h-4 w-4 text-muted-foreground" />
        ) : (
          <Component className="h-4 w-4 text-muted-foreground" />
        )}
        <div className="flex flex-col gap-1">
          <span className="font-medium text-sm">{equipamento.nome}</span>
          <Badge
            variant="outline"
            className="bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600 text-xs w-fit"
          >
            {equipamento.classificacao}
          </Badge>
        </div>
      </div>
    )
  },

  {
    key: 'hierarquia',
    label: 'Hierarquia',
    render: (equipamento) => (
      <div className="flex flex-col text-sm gap-1">
        {/* Planta */}
        <div className="flex items-center gap-1.5">
          <Factory className="h-3 w-3 text-muted-foreground/60" />
          <span className="font-medium text-xs text-foreground">
            {equipamento.unidade?.planta?.nome || equipamento.planta?.nome || '-'}
          </span>
        </div>

        {/* Unidade */}
        {equipamento.unidade && (
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <MapPin className="h-3 w-3 text-muted-foreground/60" />
            <span className="text-xs">
              {equipamento.unidade.nome}
            </span>
          </div>
        )}

        {/* Proprietário */}
        <div className="flex items-center gap-1.5 text-muted-foreground/70">
          <Building2 className="h-3 w-3 text-muted-foreground/50" />
          <span className="text-xs">
            {equipamento.unidade?.planta?.proprietario?.nome || equipamento.proprietario?.razaoSocial || '-'}
          </span>
        </div>

        {/* Se for UAR, mostrar o UC pai */}
        {equipamento.classificacao === 'UAR' && equipamento.equipamentoPai && (
          <div className="flex items-center gap-1.5 mt-0.5 text-muted-foreground">
            <Wrench className="h-3 w-3 text-muted-foreground/60" />
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
      <div className="flex items-center gap-1.5 text-sm">
        <MapPin className="h-3 w-3 text-muted-foreground/60" />
        <span className="truncate max-w-32 text-xs text-muted-foreground" title={equipamento.localizacao}>
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
          color: "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600",
          label: "5"
        },
        '4': {
          icon: <AlertTriangle className="h-3 w-3" />,
          color: "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600",
          label: "4"
        },
        '3': {
          icon: <AlertCircle className="h-3 w-3" />,
          color: "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600",
          label: "3"
        },
        '2': {
          icon: <CheckCircle className="h-3 w-3" />,
          color: "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600",
          label: "2"
        },
        '1': {
          icon: <CheckCircle className="h-3 w-3" />,
          color: "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600",
          label: "1"
        }
      };

      const currentConfig = config[equipamento.criticidade] || config['3'];

      return (
        <Badge variant="outline" className={`${currentConfig.color} text-xs`}>
          {currentConfig.icon}
          <span className="ml-1">Crit. {currentConfig.label}</span>
        </Badge>
      );
    }
  },

  {
    key: 'componentes_uar',
    label: 'Componentes UAR',
    render: (equipamento) => (
      <div className="flex items-center gap-2">
        {equipamento.classificacao === 'UC' ? (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <Component className="h-3 w-3 text-muted-foreground" />
              <Badge variant="secondary" className="text-xs">
                {equipamento.totalComponentes || 0}
              </Badge>
            </div>
            {actions?.onGerenciarComponentes && actions?.isAdmin && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => actions.onGerenciarComponentes!(equipamento)}
                className="text-xs h-7"
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
  }
];

// Manter a exportação antiga para compatibilidade
export const equipamentosTableColumns = getEquipamentosTableColumns();
