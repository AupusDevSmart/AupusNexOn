import {
  Breadcrumb,
  BreadcrumbItem as BItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { nanoid } from 'nanoid';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronDownIcon } from 'lucide-react';

interface DropdownItem {
  label: string;
  href: string;
}

interface BreadcrumbConfigItem {
  path: string | null;
  label: string;
  isDropdown?: boolean;
  dropdownItems?: DropdownItem[];
}

import React, { useEffect, useRef, useState } from 'react';
import { api } from '@/config/api';

export function CustomBreadcrumbs({ className = '' }: { className?: string }) {
  const navigate = useNavigate();
  const location = useLocation();
  const breadcrumbRef = useRef<HTMLDivElement>(null);
  const [unidadeNomes, setUnidadeNomes] = useState<Record<string, string>>({});

  const handleClick = (href: string) => {
    navigate(href);
  };

  const breadcrumbConfig: BreadcrumbConfigItem[] = [
    {
      label: 'Aupus Energia',
      path: null,
    },
    // 📊 DASHBOARD
    {
      path: '/dashboard',
      label: 'Dashboard',
    },
    // 👥 GESTÃO DE PESSOAS
    {
      path: '/usuarios',
      label: 'Usuários',
    },
    // 🏭 INFRAESTRUTURA
    {
      path: '/plantas',
      label: 'Plantas',
    },
    {
      path: '/equipamentos',
      label: 'Equipamentos',
    },
    // 🔧 MANUTENÇÃO
    {
      path: '/planos-manutencao',
      label: 'Planos de Manutenção',
      isDropdown: true,
      dropdownItems: [
        { label: 'Gerenciar Planos', href: '/planos-manutencao' },
        { label: 'Associar Equipamentos', href: '/planos-manutencao/associar' },
      ],
    },
    {
      path: '/planos-manutencao/associar',
      label: 'Associar Equipamentos',
    },
    {
      path: '/tarefas',
      label: 'Tarefas',
    },
    {
      path: '/programacao-os',
      label: 'Programação OS',
    },
    {
      path: '/execucao-os',
      label: 'Execução OS',
    },
    {
      path: '/anomalias',
      label: 'Anomalias',
    },
    // 📦 RECURSOS
    {
      path: '/veiculos',
      label: 'Veículos',
    },
    {
      path: '/ferramentas',
      label: 'Ferramentas',
    },
    {
      path: '/reservas',
      label: 'Reservas',
    },
    // 🤝 FORNECEDORES
    {
      path: '/fornecedores',
      label: 'Fornecedores',
    },
    // 📅 AGENDA
    {
      path: '/agenda/feriados',
      label: 'Agenda',
      isDropdown: true,
      dropdownItems: [
        { label: 'Feriados', href: '/agenda/feriados' },
        { label: 'Configurações de Dias Úteis', href: '/agenda/configuracoes-dias-uteis' },
      ],
    },
    {
      path: '/agenda/configuracoes-dias-uteis',
      label: 'Agenda',
      isDropdown: true,
      dropdownItems: [
        { label: 'Feriados', href: '/agenda/feriados' },
        { label: 'Configurações de Dias Úteis', href: '/agenda/configuracoes-dias-uteis' },
      ],
    },
    // ⚙️ CONFIGURAÇÕES
    {
      path: '/configuracoes',
      label: 'Configurações',
      isDropdown: true,
      dropdownItems: [
        { label: 'Perfil', href: '/configuracoes/perfil' },
        { label: 'Aparência', href: '/configuracoes/aparencia' },
      ],
    },
    // Configurações antigas (manter compatibilidade)
    {
      path: '/financeiro',
      label: 'Financeiro',
      isDropdown: true,
      dropdownItems: [
        { label: 'Contas a Pagar', href: '/financeiro/contas-a-pagar' },
        { label: 'Contas a Receber', href: '/financeiro/contas-a-receber' },
        { label: 'Fluxo de Caixa', href: '/financeiro/fluxo-caixa' },
        { label: 'Centros de Custo', href: '/financeiro/centros-custo' },
      ],
    },
    {
      path: '/area-do-proprietario',
      label: 'Área do Proprietário',
    },
    {
      path: '/administrador',
      label: 'Administrador',
      isDropdown: true,
      dropdownItems: [
        { label: 'Monitoramento de Clientes', href: '/administrador/monitoramento-de-clientes' },
        { label: 'Clube Aupus', href: '/administrador/clube-aupus' },
      ],
    },
  ];

  const formatLabel = (label: string) => {
    return label
      .split('-')
      .map((word, index) => {
        const lowercaseWords = ['de', 'do', 'da', 'e'];
        if (index > 0 && lowercaseWords.includes(word.toLowerCase())) {
          return word.toLowerCase();
        }
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      })
      .join(' ');
  };

  // Carregar nome da unidade quando a URL mudar
  useEffect(() => {
    const pathname = location.pathname;
    const match = pathname.match(/\/supervisorio\/sinoptico-ativo\/([a-z0-9]+)/);

    if (match) {
      const unidadeId = match[1];

      // Se já temos o nome em cache, não buscar novamente
      if (unidadeNomes[unidadeId]) return;

      // Buscar nome da unidade
      api.get(`/unidades/${unidadeId}`)
        .then(response => {
          const unidadeData = response.data?.data || response.data;
          const nome = unidadeData?.nome || unidadeData?.name;

          if (nome) {
            setUnidadeNomes(prev => ({
              ...prev,
              [unidadeId]: nome
            }));
          }
        })
        .catch(err => {
          console.error('Erro ao carregar nome da unidade:', err);
        });
    }
  }, [location.pathname, unidadeNomes]);

  const getBreadcrumbItems = () => {
    const pathname = location.pathname.replace(/\/$/, '');
    const pathSegments = pathname.split('/').filter(Boolean);
    const breadcrumbItems: BreadcrumbConfigItem[] = [];

    pathSegments.reduce((acc, segment, index) => {
      const currentPath = `${acc}/${segment}`;
      const configItem = breadcrumbConfig.find((item) => item.path === currentPath);

      if (configItem) {
        breadcrumbItems.push(configItem);
      } else {
        // Verificar se é um ID de unidade (segmento após sinoptico-ativo)
        const prevSegment = pathSegments[index - 1];
        let label = formatLabel(segment);

        if (prevSegment === 'sinoptico-ativo' && unidadeNomes[segment]) {
          label = unidadeNomes[segment];
        }

        breadcrumbItems.push({
          path: currentPath,
          label: label,
        });
      }

      return currentPath;
    }, '');

    breadcrumbItems.unshift(breadcrumbConfig[0]);

    return breadcrumbItems;
  };

  const breadcrumbItems = getBreadcrumbItems();

  // Scroll to the end on render
  useEffect(() => {
    if (breadcrumbRef.current) {
      breadcrumbRef.current.scrollLeft = breadcrumbRef.current.scrollWidth;
    }
  }, [breadcrumbItems]);

  return (
    <div
      ref={breadcrumbRef}
      className={`breadcrumb-scrollable ${className}`}
    >
      <Breadcrumb>
        <BreadcrumbList>
          {breadcrumbItems.map((item, index) => (
            <React.Fragment key={nanoid()}>
              <BItem>
                {index === 0 ? (
                  <div className="flex items-center gap-2">
                    <BreadcrumbPage className="text-secondary-foreground font-semibold">
                      {item.label}
                    </BreadcrumbPage>
                  </div>
                ) : item.isDropdown ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger className="flex items-center gap-1 text-secondary-foreground">
                      {item.label}
                      <ChevronDownIcon className="h-4 w-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      {item.dropdownItems?.map((dropdownItem) => (
                        <DropdownMenuItem key={nanoid()} asChild>
                          <a
                            href={dropdownItem.href}
                            className="text-secondary-foreground"
                            onClick={(e) => {
                              e.preventDefault();
                              handleClick(dropdownItem.href);
                            }}
                          >
                            {dropdownItem.label}
                          </a>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : item.path ? (
                  <BreadcrumbLink
                    href={item.path}
                    className="text-secondary-foreground"
                    onClick={(e) => {
                      e.preventDefault();
                      if (item.path) handleClick(item.path);
                    }}
                  >
                    {item.label}
                  </BreadcrumbLink>
                ) : (
                  <BreadcrumbPage className="text-secondary-foreground font-semibold">
                    {item.label}
                  </BreadcrumbPage>
                )}
              </BItem>
              {index < breadcrumbItems.length - 1 && (
                <BreadcrumbSeparator className="text-secondary-foreground">
                  {/* Separador */}
                </BreadcrumbSeparator>
              )}
            </React.Fragment>
          ))}
        </BreadcrumbList>
      </Breadcrumb>
    </div>
  );
}