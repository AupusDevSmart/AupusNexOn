import { ChartNoAxesColumn } from "@/components/icons/ChartNoAxesColumn";
import { featureFlags, type FeatureFlags } from "@/config/feature-flags";
import {
  type LucideIcon,
  Activity,
  Building2,
  Cpu,
  Monitor,
  ScrollText,
  Zap,
  Users,
  Factory,
  Database,
  Boxes,
  FileText,
} from "lucide-react";

/**
 * `featureKey` agora usa o ID da permission Spatie (ex: "dashboard.view", "usuarios.view").
 * Migracao em 2026-05 do vocabulario legacy ("Dashboard", "Usuarios", etc) para
 * alinhar com o `acessivel` (que carrega all_permissions do backend).
 *
 * Items sem `featureKey` sao sempre mostrados (sujeitos so a feature flag).
 */
export type NavigationLink = {
  key: string;
  path: string;
  featureKey?: string;
  featureFlag?: keyof FeatureFlags;
  icon: LucideIcon | React.FC<React.SVGProps<SVGSVGElement>>;
  label: string;
  hint?: string;
  links?: NavigationLink[];
};

export const navigationLinks: Array<NavigationLink> = [
  {
    key: "admin",
    featureKey: "dashboard.view",
    featureFlag: "enableCOA",
    path: "/dashboard",
    icon: ChartNoAxesColumn,
    label: "COA - Centro de Operações de Ativos",
    hint: "COA - Centro de Operações de Ativos",
  },
  // SCADA - sem permission Spatie correspondente; controlado so por feature flag
  {
    key: "scada",
    featureFlag: "enableScada",
    path: "/scada",
    icon: Activity,
    label: "SCADA",
    hint: "Sistema SCADA",
  },
  // Supervisorio - sem permission Spatie; controlado so por feature flag
  {
    key: "supervisorio",
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
      // {
      //   key: "supervisorio-logs-eventos",
      //   featureKey: "supervisorio",
      //   path: "/supervisorio/logs-eventos",
      //   icon: ScrollText,
      //   label: "Logs de Eventos",
      //   hint: "Histórico de eventos e alarmes",
      // },
      {
        key: "supervisorio-sinoptico",
        path: "/supervisorio/sinoptico",
        icon: Cpu,
        label: "Sinóptico do Ativo",
        hint: "Visualização detalhada dos ativos",
      },
      {
        key: "supervisorio-logs-mqtt",
        path: "/logs/logs-mqtt",
        icon: FileText,
        label: "Logs MQTT",
        hint: "Logs gerados pelas regras MQTT",
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
  // Cadastros - grupo, visivel se pelo menos um filho for visivel
  {
    key: "cadastros",
    featureFlag: "enableCadastros",
    path: "/cadastros",
    icon: Database,
    label: "Cadastros",
    hint: "Gestão de Cadastros",
    links: [
      {
        key: "cadastros-usuarios",
        featureKey: "usuarios.view",
        path: "/cadastros/usuarios",
        icon: Users,
        label: "Usuários",
        hint: "Gerenciar Usuários",
      },
      {
        key: "cadastros-plantas",
        featureKey: "plantas.view",
        path: "/cadastros/plantas",
        icon: Factory,
        label: "Plantas",
        hint: "Gerenciar Plantas",
      },
      {
        key: "cadastros-unidades",
        featureKey: "unidades.view",
        path: "/cadastros/unidades",
        icon: Building2,
        label: "Instalações",
        hint: "Gerenciar Instalações",
      },
      {
        key: "cadastros-equipamentos",
        featureKey: "equipamentos.view",
        path: "/cadastros/equipamentos",
        icon: Boxes,
        label: "Equipamentos",
        hint: "Gerenciar Equipamentos",
      },
      {
        key: "cadastros-concessionarias",
        featureKey: "equipamentos.manage",
        path: "/cadastros/concessionarias",
        icon: Zap,
        label: "Concessionárias",
        hint: "Gerenciar Concessionárias de Energia",
      },
      {
        key: "cadastros-regras-logs",
        featureKey: "equipamentos.manage",
        path: "/cadastros/regras-logs",
        icon: ScrollText,
        label: "Regras de Logs",
        hint: "Cadastrar regras de logs MQTT",
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
