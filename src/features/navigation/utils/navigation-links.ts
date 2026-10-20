import { featureFlags, type FeatureFlags } from "@/config/feature-flags";
import {
  type LucideIcon,
  Activity,
  Bell,
  Box,
  Briefcase,
  CalendarCheck,
  Cpu,
  Factory,
  FileChartColumn,
  Wrench,
  Gauge,
  Layers,
  ListFilter,
  MapPin,
  Monitor,
  Settings,
  SquareTerminal,
  Users,
  Workflow,
  Zap,
} from "lucide-react";

/**
 * `featureKey` agora usa o ID da permission Spatie (ex: "dashboard.view", "usuarios.view").
 * Migracao em 2026-05 do vocabulario legacy ("Dashboard", "Usuarios", etc) para
 * alinhar com o `acessivel` (que carrega all_permissions do backend).
 *
 * Items sem `featureKey` sao sempre mostrados (sujeitos so a feature flag).
 */
/** Contadores vivos que um item do menu pode mostrar. */
export type ContadorMenu = "chamados-abertos";

export type NavigationLink = {
  key: string;
  path: string;
  featureKey?: string;
  featureFlag?: keyof FeatureFlags;
  /** Oculto para o CLIENTE (proprietário) — que por ora vê só monitoramento. */
  hideForClient?: boolean;
  /** Só aparece para quem cadastra algum papel (NEXON-20: `capacidades.cadastra`). */
  requerCadastrarUsuario?: boolean;
  icon: LucideIcon | React.FC<React.SVGProps<SVGSVGElement>>;
  label: string;
  /** Selo curto à direita do nome (ex.: "COA", "Admin"). */
  badge?: string;
  /**
   * Número vivo à direita do nome, vindo da API (ex.: chamados abertos).
   * Resolvido por `useContadorMenu` em nav-main; zero não aparece.
   */
  contador?: ContadorMenu;
  hint?: string;
  /**
   * Outras rotas que contam como "estar nesta página" no menu, além do
   * `path` e das subrotas dele (ex.: a tela de um ativo aberta a partir da
   * lista do Sinóptico).
   */
  ativoEm?: string[];
  links?: NavigationLink[];
};

// NEXON-21: menu em cinco blocos — Centro de Operação, Supervisório,
// Relatórios, Ativos (o que é monitorado) e Configurações (o que é do admin).
// Os endereços das telas antigas não mudaram; só o lugar e o nome no menu.
export const navigationLinks: Array<NavigationLink> = [
  {
    key: "admin",
    featureKey: "dashboard.view",
    featureFlag: "enableCOA",
    path: "/dashboard",
    icon: Gauge,
    label: "Centro de Operação",
    badge: "COA",
    hint: "Centro de Operação de Ativos (COA)",
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
      {
        key: "supervisorio-sinoptico",
        path: "/supervisorio/sinoptico",
        ativoEm: ["/supervisorio/sinoptico-ativo"],
        icon: Workflow,
        label: "Sinóptico do Ativo",
        hint: "Visualização detalhada dos ativos",
      },
      {
        key: "supervisorio-eventos-protecao",
        featureKey: "supervisorio.iot_view",
        path: "/supervisorio/eventos-protecao",
        icon: Bell,
        label: "Alarmes e Eventos",
        hint: "SOE — trips e atuações com a hora do próprio relé",
      },
      {
        key: "supervisorio-bdo-ufvs",
        featureKey: "Monitoramento",
        path: "/supervisorio/bdo-ufvs",
        icon: CalendarCheck,
        label: "Boletim Diário (BDO)",
        hint: "Painel BDO + sync de nuvem + curadoria de geração FV",
      },
    ],
  },
  {
    key: "relatorios",
    featureKey: "Monitoramento",
    path: "/relatorios",
    icon: FileChartColumn,
    label: "Relatórios",
    hint: "Boletins de geração e consumo (PDF)",
  },
  // NEXON-24: pedido de reparo de equipamento, encaminhado ao Smart Service,
  // WhatsApp ou e-mail. O número é o de chamados ainda não fechados.
  {
    key: "chamados",
    path: "/chamados",
    icon: Wrench,
    label: "Chamados",
    contador: "chamados-abertos",
    hint: "Pedidos de reparo de equipamento",
  },
  // Ativos - grupo, visivel se pelo menos um filho for visivel
  {
    key: "ativos",
    hideForClient: true, // cliente não vê cadastros por enquanto (só monitoramento)
    path: "/ativos",
    icon: Layers,
    label: "Ativos",
    hint: "Proprietários, plantas, instalações e equipamentos",
    links: [
      {
        key: "ativos-proprietarios",
        featureKey: "plantas.view",
        path: "/ativos/proprietarios",
        icon: Briefcase,
        label: "Proprietários",
        hint: "Donos das plantas",
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
        key: "ativos-instalacoes",
        featureKey: "unidades.view",
        path: "/ativos/instalacoes",
        icon: MapPin,
        label: "Instalações",
        hint: "Instalações (unidades) de todas as plantas",
      },
      {
        key: "cadastros-equipamentos",
        featureKey: "equipamentos.view",
        path: "/cadastros/equipamentos",
        icon: Box,
        label: "Equipamentos",
        hint: "Gerenciar Equipamentos",
      },
    ],
  },
  // Configurações - grupo do admin, visivel se pelo menos um filho for visivel
  {
    key: "configuracoes",
    // Cliente (proprietário) só vê Usuários aqui (cadastra os operadores dele,
    // PER-10); os demais itens seguem escondidos um a um.
    path: "/configuracoes",
    icon: Settings,
    label: "Configurações",
    badge: "Admin",
    hint: "Usuários, cadastros de apoio e logs",
    links: [
      {
        key: "cadastros-usuarios",
        featureKey: "usuarios.view",
        requerCadastrarUsuario: true,
        path: "/cadastros/usuarios",
        icon: Users,
        label: "Usuários e Permissões",
        hint: "Gerenciar Usuários",
      },
      {
        key: "cadastros-concessionarias",
        hideForClient: true,
        featureKey: "equipamentos.manage",
        path: "/cadastros/concessionarias",
        icon: Zap,
        label: "Concessionárias",
        hint: "Gerenciar Concessionárias de Energia",
      },
      {
        key: "cadastros-iot-catalog",
        hideForClient: true,
        featureKey: "equipamentos.iot_catalog",
        path: "/cadastros/iot-catalog",
        icon: Cpu,
        label: "Drivers de Equipamento",
        hint: "Tipos e modelos de dispositivos de campo (mapa Modbus)",
      },
      {
        key: "cadastros-regras-logs",
        hideForClient: true,
        featureKey: "supervisorio.iot_view",
        path: "/cadastros/regras-logs",
        icon: ListFilter,
        label: "Regras de Logs",
        hint: "Cadastrar regras de logs MQTT",
      },
      {
        key: "supervisorio-logs-mqtt",
        hideForClient: true,
        featureKey: "supervisorio.iot_view",
        path: "/logs/logs-mqtt",
        icon: SquareTerminal,
        label: "Logs MQTT",
        hint: "Logs gerados pelas regras MQTT",
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
