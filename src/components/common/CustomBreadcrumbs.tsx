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
  path: string;
  label: string;
  isDropdown?: boolean;
  dropdownItems?: DropdownItem[];
}

import React, { useEffect, useRef } from 'react';

export function CustomBreadcrumbs({ className = '' }: { className?: string }) {
  const navigate = useNavigate();
  const location = useLocation();
  const breadcrumbRef = useRef<HTMLDivElement>(null);

  const handleClick = (href: string) => {
    navigate(href);
  };

  const breadcrumbConfig: BreadcrumbConfigItem[] = [
    {
      label: 'Aupus Energia',
      path: null,
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
    {
      path: '/configuracoes',
      label: 'Configurações',
      isDropdown: true,
      dropdownItems: [
        { label: 'Perfil', href: '/configuracoes/perfil' },
        { label: 'Aparência', href: '/configuracoes/aparencia' },
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

  const getBreadcrumbItems = () => {
    const pathname = location.pathname.replace(/\/$/, '');
    const pathSegments = pathname.split('/').filter(Boolean);
    const breadcrumbItems: BreadcrumbConfigItem[] = [];

    pathSegments.reduce((acc, segment) => {
      const currentPath = `${acc}/${segment}`;
      const configItem = breadcrumbConfig.find((item) => item.path === currentPath);

      if (configItem) {
        breadcrumbItems.push(configItem);
      } else {
        breadcrumbItems.push({
          path: currentPath,
          label: formatLabel(segment),
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
                      handleClick(item.path);
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