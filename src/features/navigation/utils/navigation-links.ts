import { ChartColumnBig } from "@/components/icons/ChartColumnBig";
import { ChartNoAxesColumn } from "@/components/icons/ChartNoAxesColumn";
import { Permissao } from "@/types/dtos/usuarios-dto";
import { featureFlags, type FeatureFlags } from "@/config/feature-flags";
import {
  type LucideIcon,
  Activity,
  BookUser,
  Building2,
  Cpu,
  Magnet,
  Monitor,
  ScrollText,
  SquareActivity,
  Zap,
  Users,
  Factory,
  Database,
  Boxes,
} from "lucide-react";

export type NavigationLink = {
  key: string;
  path: string;
  featureKey?: Permissao;
  featureFlag?: keyof FeatureFlags;
  icon: LucideIcon | React.FC<React.SVGProps<SVGSVGElement>>;
  label: string;
  hint?: string;
  links?: NavigationLink[];
};

export const navigationLinks: Array<NavigationLink> = [
  {
    key: "admin",
    featureKey: "Dashboard",
    featureFlag: "enableCOA",
    path: "/dashboard",
    icon: ChartNoAxesColumn,
    label: "COA - Centro de Operações de Ativos",
    hint: "COA - Centro de Operações de Ativos",
  },
  // SCADA - Adicionado
  {
    key: "scada",
    featureKey: "SCADA",
    featureFlag: "enableScada",
    path: "/scada",
    icon: Activity,
    label: "SCADA",
    hint: "Sistema SCADA",
  },
  // Seção Supervisório
  {
    key: "supervisorio",
    featureKey: "supervisorio",
    featureFlag: "enableSupervisorio",
    path: "/supervisorio",
    icon: Monitor,
    label: "Supervisório",
    hint: "Sistema de Supervisão NexON",
    links: [
      // Cadastro de Unidades - OCULTO (usar Cadastros > Unidades)
      // {
      //   key: "supervisorio-cadastro-unidades",
      //   featureKey: "supervisorio",
      //   path: "/supervisorio/cadastro-unidades",
      //   icon: Building2,
      //   label: "Cadastro de Unidades",
      //   hint: "Gerenciar unidades monitoradas",
      // },
      {
        key: "supervisorio-logs-eventos",
        featureKey: "supervisorio",
        path: "/supervisorio/logs-eventos",
        icon: ScrollText,
        label: "Logs de Eventos",
        hint: "Histórico de eventos e alarmes",
      },
      {
        key: "supervisorio-sinoptico",
        featureKey: "supervisorio",
        path: "/supervisorio/sinoptico",
        icon: Cpu,
        label: "Sinóptico do Ativo",
        hint: "Visualização detalhada dos ativos",
      },
      {
        key: "supervisorio-sinoptico-v2",
        featureKey: "supervisorio",
        path: "/supervisorio/sinoptico-v2",
        icon: Cpu,
        label: "Diagrama Unifilar V2",
        hint: "Diagrama unifilar refatorado (arquitetura modular)",
      },
    ],
  },
  // Financeiro - OCULTO
  // {
  //   key: "financeiro",
  //   featureKey: "Financeiro", // Corrigido para maiúscula
  //   featureFlag: "enableFinanceiro",
  //   path: "/financeiro",
  //   icon: Zap,
  //   label: "Financeiro",
  //   hint: "Financeiro",
  //   links: [
  //     {
  //       key: "financeiro-contas-a-pagar",
  //       featureKey: "Financeiro",
  //       path: "/financeiro/contas-a-pagar",
  //       icon: ChartColumnBig,
  //       label: "Contas a Pagar",
  //       hint: "Contas a Pagar",
  //     },
  //     {
  //       key: "financeiro-contas-a-receber",
  //       featureKey: "Financeiro",
  //       path: "/financeiro/contas-a-receber",
  //       icon: SquareActivity,
  //       label: "Contas a Receber",
  //       hint: "Contas a Receber",
  //     },
  //     {
  //       key: "financeiro-fluxo-caixa",
  //       featureKey: "Financeiro",
  //       path: "/financeiro/fluxo-caixa",
  //       icon: BookUser,
  //       label: "Fluxo de Caixa",
  //       hint: "Fluxo de Caixa",
  //     },
  //     {
  //       key: "financeiro-centros-custo",
  //       featureKey: "Financeiro",
  //       path: "/financeiro/centros-custo",
  //       icon: Magnet,
  //       label: "Centros de Custo",
  //       hint: "Centros de Custo",
  //     },
  //   ],
  // },
  // Cadastros
  {
    key: "cadastros",
    featureKey: "Usuarios", // Usando Usuarios como feature principal
    featureFlag: "enableCadastros",
    path: "/cadastros",
    icon: Database,
    label: "Cadastros",
    hint: "Gestão de Cadastros",
    links: [
      {
        key: "cadastros-usuarios",
        featureKey: "Usuarios",
        path: "/cadastros/usuarios",
        icon: Users,
        label: "Usuários",
        hint: "Gerenciar Usuários",
      },
      {
        key: "cadastros-plantas",
        featureKey: "Plantas",
        path: "/cadastros/plantas",
        icon: Factory,
        label: "Plantas",
        hint: "Gerenciar Plantas",
      },
      {
        key: "cadastros-unidades",
        featureKey: "UnidadesConsumidoras",
        path: "/cadastros/unidades",
        icon: Building2,
        label: "Unidades",
        hint: "Gerenciar Unidades Consumidoras",
      },
      {
        key: "cadastros-equipamentos",
        featureKey: "Equipamentos",
        path: "/cadastros/equipamentos",
        icon: Boxes,
        label: "Equipamentos",
        hint: "Gerenciar Equipamentos",
      },
      {
        key: "cadastros-concessionarias",
        featureKey: "Concessionarias",
        path: "/cadastros/concessionarias",
        icon: Zap,
        label: "Concessionárias",
        hint: "Gerenciar Concessionárias de Energia",
      },
    ],
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
  // },
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

/**
 * Filtra os links de navegação baseado nas feature flags
 * Links com featureFlag definida serão mostrados apenas se a flag estiver habilitada
 */
export function getFilteredNavigationLinks(): NavigationLink[] {
  return navigationLinks.filter((link) => {
    // Se não tem feature flag definida, sempre mostra
    if (!link.featureFlag) {
      return true;
    }

    // Verifica se a feature flag está habilitada
    const isEnabled = featureFlags[link.featureFlag];

    // Se o link tem sublinks, filtra os sublinks também
    if (isEnabled && link.links) {
      link.links = link.links.filter((sublink) => {
        if (!sublink.featureFlag) {
          return true;
        }
        return featureFlags[sublink.featureFlag];
      });
    }

    return isEnabled;
  });
}
