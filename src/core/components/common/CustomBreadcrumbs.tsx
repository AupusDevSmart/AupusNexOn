import React, { useEffect, useRef, useState, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronDownIcon } from 'lucide-react';
import { useHttpClient } from '@/core/context/hooks';

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

export function CustomBreadcrumbs({ className = '' }: { className?: string }) {
  const navigate = useNavigate();
  const location = useLocation();
  const breadcrumbRef = useRef<HTMLDivElement>(null);
  const [unidadeNomes, setUnidadeNomes] = useState<Record<string, string>>({});
  const unidadeNomesRef = useRef<Record<string, string>>({});
  const [openDropdownIndex, setOpenDropdownIndex] = useState<number | null>(null);
  const httpClient = useHttpClient();

  const handleClick = (href: string) => {
    navigate(href);
    setOpenDropdownIndex(null);
  };

  const breadcrumbConfig: BreadcrumbConfigItem[] = [
    {
      label: 'Aupus Energia',
      path: null,
    },
    { path: '/dashboard', label: 'Dashboard' },
    { path: '/usuarios', label: 'Usuarios' },
    { path: '/plantas', label: 'Plantas' },
    { path: '/equipamentos', label: 'Equipamentos' },
    {
      path: '/planos-manutencao',
      label: 'Planos de Manutencao',
      isDropdown: true,
      dropdownItems: [
        { label: 'Gerenciar Planos', href: '/planos-manutencao' },
        { label: 'Associar Equipamentos', href: '/planos-manutencao/associar' },
      ],
    },
    { path: '/planos-manutencao/associar', label: 'Associar Equipamentos' },
    { path: '/tarefas', label: 'Tarefas' },
    { path: '/programacao-os', label: 'Programacao OS' },
    { path: '/execucao-os', label: 'Execucao OS' },
    { path: '/anomalias', label: 'Anomalias' },
    { path: '/veiculos', label: 'Veiculos' },
    { path: '/ferramentas', label: 'Ferramentas' },
    { path: '/reservas', label: 'Reservas' },
    { path: '/fornecedores', label: 'Fornecedores' },
    {
      path: '/agenda/feriados',
      label: 'Agenda',
      isDropdown: true,
      dropdownItems: [
        { label: 'Feriados', href: '/agenda/feriados' },
        { label: 'Configuracoes de Dias Uteis', href: '/agenda/configuracoes-dias-uteis' },
      ],
    },
    {
      path: '/agenda/configuracoes-dias-uteis',
      label: 'Agenda',
      isDropdown: true,
      dropdownItems: [
        { label: 'Feriados', href: '/agenda/feriados' },
        { label: 'Configuracoes de Dias Uteis', href: '/agenda/configuracoes-dias-uteis' },
      ],
    },
    {
      path: '/configuracoes',
      label: 'Configuracoes',
      isDropdown: true,
      dropdownItems: [
        { label: 'Perfil', href: '/configuracoes/perfil' },
        { label: 'Aparencia', href: '/configuracoes/aparencia' },
      ],
    },
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
    { path: '/area-do-proprietario', label: 'Area do Proprietario' },
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

  // Sync ref with state
  useEffect(() => {
    unidadeNomesRef.current = unidadeNomes;
  }, [unidadeNomes]);

  // Load unit name when URL changes
  useEffect(() => {
    const pathname = location.pathname;
    const match = pathname.match(/\/supervisorio\/sinoptico-ativo\/([a-z0-9%]+)/);

    if (match) {
      const unidadeIdOriginal = match[1];
      const unidadeId = decodeURIComponent(unidadeIdOriginal).trim();

      const stateFromNavigation = location.state as { unidade?: { nome?: string } } | undefined;
      if (stateFromNavigation?.unidade?.nome) {
        const nome = stateFromNavigation.unidade.nome;
        setUnidadeNomes(prev => ({ ...prev, [unidadeId]: nome }));
        unidadeNomesRef.current[unidadeId] = nome;
        return;
      }

      if (unidadeNomesRef.current[unidadeId]) {
        return;
      }

      httpClient.get(`/unidades/${unidadeId}`)
        .then(response => {
          const nome = response.data?.data?.nome || response.data?.nome;
          if (nome) {
            setUnidadeNomes(prev => ({ ...prev, [unidadeId]: nome }));
            unidadeNomesRef.current[unidadeId] = nome;
          }
        })
        .catch(() => {
          // Failed to load unit name
        });
    }
  }, [location.pathname, location.state, httpClient]);

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
        const prevSegment = pathSegments[index - 1];
        const decodedSegment = decodeURIComponent(segment).trim();
        let label = formatLabel(decodedSegment);

        if (prevSegment === 'sinoptico-ativo' && unidadeNomesRef.current[decodedSegment]) {
          label = unidadeNomesRef.current[decodedSegment];
        }

        breadcrumbItems.push({
          path: currentPath,
          label,
        });
      }

      return currentPath;
    }, '');

    breadcrumbItems.unshift(breadcrumbConfig[0]);

    return breadcrumbItems;
  };

  const breadcrumbItems = getBreadcrumbItems();

  // Scroll to end on render
  useEffect(() => {
    if (breadcrumbRef.current) {
      breadcrumbRef.current.scrollLeft = breadcrumbRef.current.scrollWidth;
    }
  }, [breadcrumbItems]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setOpenDropdownIndex(null);
    if (openDropdownIndex !== null) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [openDropdownIndex]);

  return (
    <div
      ref={breadcrumbRef}
      className={`breadcrumb-scrollable ${className}`}
    >
      <nav aria-label="breadcrumb">
        <ol className="flex items-center gap-1.5 text-sm">
          {breadcrumbItems.map((item, index) => (
            <React.Fragment key={`${item.path ?? 'root'}-${index}`}>
              <li className="inline-flex items-center">
                {index === 0 ? (
                  <span className="text-secondary-foreground font-semibold">
                    {item.label}
                  </span>
                ) : item.isDropdown ? (
                  <div className="relative">
                    <button
                      className="flex items-center gap-1 text-secondary-foreground hover:text-foreground transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenDropdownIndex(openDropdownIndex === index ? null : index);
                      }}
                    >
                      {item.label}
                      <ChevronDownIcon className="h-4 w-4" />
                    </button>
                    {openDropdownIndex === index && (
                      <div className="absolute top-full left-0 mt-1 bg-popover border rounded-md shadow-md z-50 min-w-[180px]">
                        {item.dropdownItems?.map((dropdownItem) => (
                          <a
                            key={dropdownItem.href}
                            href={dropdownItem.href}
                            className="block px-3 py-2 text-sm text-secondary-foreground hover:bg-muted transition-colors"
                            onClick={(e) => {
                              e.preventDefault();
                              handleClick(dropdownItem.href);
                            }}
                          >
                            {dropdownItem.label}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                ) : item.path ? (
                  <a
                    href={item.path}
                    className="text-secondary-foreground hover:text-foreground transition-colors"
                    onClick={(e) => {
                      e.preventDefault();
                      if (item.path) handleClick(item.path);
                    }}
                  >
                    {item.label}
                  </a>
                ) : (
                  <span className="text-secondary-foreground font-semibold">
                    {item.label}
                  </span>
                )}
              </li>
              {index < breadcrumbItems.length - 1 && (
                <li aria-hidden="true" className="text-secondary-foreground">
                  /
                </li>
              )}
            </React.Fragment>
          ))}
        </ol>
      </nav>
    </div>
  );
}
