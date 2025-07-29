// @ts-nocheck

import { ChartColumnBig } from '@/components/icons/ChartColumnBig';
import { ChartNoAxesColumn } from '@/components/icons/ChartNoAxesColumn';
import { Permissao } from '@/types/dtos/usuarios-dto';
import {
  type LucideIcon,
  Activity,
  BookUser,
  Building2,
  Component,
  DollarSign,
  Folder,
  Handshake,
  Magnet,
  SquareActivity,
  Users,
  UtilityPole,
  Zap,
} from 'lucide-react';

import { FileUser } from '@/components/icons/FileUser';
import { HousePlugIcon } from '@/components/icons/HousePlugIcon';

export type NavigationLink = {
  key: string;
  path: string;
  featureKey?: Permissao;
  icon: LucideIcon | React.FC<React.SVGProps<SVGSVGElement>>;
  label: string;
  hint?: string;
  links?: NavigationLink[];
};

 export const navigationLinks: Array<NavigationLink> = [
  {
    key: 'admin',
    featureKey: 'Dashboard',
    path: '/dashboard',
    icon: ChartNoAxesColumn,
    label: 'Dashboard SA',
    hint: 'Dashboard SA',
  },
  // {
  //   key: 'admin',
  //   featureKey: 'ClubeAupus',
  //   path: '/clube-aupus',
  //   icon: Component,
  //   label: 'Clube Aupus',
  //   hint: 'Clube Aupus',
  // },
  // {
  //   key: 'monitoramentoConsumo',
  //   featureKey: 'MonitoramentoConsumo',
  //   path: '/monitoramento-de-consumo',
  //   icon: Activity,
  //   label: 'Monitoramento de Consumo',
  //   hint: 'Monitoramento de Consumo',
  // },
  // {
  //   key: 'areaDoAssociado',
  //   featureKey: 'AreaDoAssociado',
  //   path: 'area-do-associado',
  //   icon: Handshake,
  //   label: 'Área do Associado',
  //   hint: 'Área do Associado',
  // },
  {
    key: 'financeiro',
    featureKey: 'financeiro',
    path: '/financeiro',
    icon: Zap,
    label: 'Financeiro',
    hint: 'Financeiro',
    links: [
      {
        key: 'financeiro',
        featureKey: 'financeiro',
        path: '/financeiro/contas-a-pagar',
        icon: ChartColumnBig,
        label: 'Contas a Pagar',
        hint: 'Contas a Pagar',
      },
      {
        key: 'financeiro',
        featureKey: 'financeiro',
        path: '/financeiro/contas-a-receber',
        icon: SquareActivity,
        label: 'Contas a Receber',
        hint: 'Contas a Receber',
      },
      {
        key: 'financeiro',
        featureKey: 'financeiro',
        path: '/financeiro/fluxo-caixa',
        icon: BookUser,
        label: 'Fluxo de Caixa',
        hint: 'Fluxo de Caixa',
      },
      {
        key: 'financeiro',
        featureKey: 'financeiro',
        path: '/financeiro/centros-custo',
        icon: Magnet,
        label: 'Centros de Custo',
        hint: 'Centros de Custo',
      },
    ]
  },
  // {
  //   key: 'associados',
  //   featureKey: 'Associados',
  //   path: '/associados',
  //   icon: SquareActivity,
  //   label: 'Associados',
  //   hint: 'Associados',

  // },
  // {
  //   key: 'prospeccao',
  //   featureKey: 'Prospeccao',
  //   path: '/prospeccao',
  //   icon: FileUser,
  //   label: 'Nova Prospecção',
  //   hint: 'Nova Prospecção',
  // },
  // {
  //   key: 'prospeccao',
  //   featureKey: 'ProspeccaoListagem',
  //   path: '/prospeccao/listagem',
  //   icon: BookUser,
  //   label: 'Listagem de Prospeccao',
  //   hint: 'Listagem de Prospeccao',
  // },
  // {
  //   key: 'oportunidades',
  //   featureKey: 'Oportunidades',
  //   path: '/rastreador-de-oportunidades',
  //   icon: Magnet,
  //   label: 'Rastreador de Oportunidades',
  //   hint: 'Rastreador de Oportunidades',
  // },
  // {
  //   key: 'financeiro',
  //   featureKey: 'Financeiro',
  //   path: '/financeiro',
  //   icon: DollarSign,
  //   label: 'Financeiro',
  //   hint: 'Financeiro',
  // },
  // {
  //   key: 'documentos',
  //   featureKey: 'Documentos',
  //   path: '/documentos',
  //   icon: Folder,
  //   label: 'Documentos',
  //   hint: 'Documentos',
  // },
  // {
  //   key: 'usuarios',
  //   featureKey: 'Usuarios',
  //   path: '/usuarios',
  //   icon: Users,
  //   label: 'Usuários',
  //   hint: 'Usuários'
  // },
  // {
  //   key: 'organizacoes',
  //   featureKey: 'Organizacoes',
  //   path: '/organizacoes',
  //   icon: Building2,
  //   label: 'Organizações',
  //   hint: 'Organizações',
  // }
  // {
  //   key: 'configuracoes',
  //   featureKey: 'Configuracoes',
  //   path: '/configuracoes',
  //   icon: Settings,
  //   label: 'Configurações',
  //   hint: 'Configurações',
  //   links: [
  //     {
  //       key: 'configuracoes',
  //       featureKey: 'Configuracoes',
  //       path: '/configuracoes/perfil',
  //       icon: User,
  //       label: 'Perfil',
  //       hint: 'Perfil',
  //     },
  //     {
  //       key: 'configuracoes',
  //       featureKey: 'Configuracoes',
  //       path: '/configuracoes/aparencia',
  //       icon: Palette,
  //       label: 'Aparência',
  //       hint: 'Aparência',
  //     }
  //   ]
  // }
];