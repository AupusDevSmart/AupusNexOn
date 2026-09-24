import { ChevronRight } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { NavigationLink } from "@/features/navigation/utils/navigation-links";
import { useFilteredNavigationLinks } from "@/features/navigation/utils/useFilteredNavigationLinks";
import { cn } from "@/lib/utils";

/**
 * Menu lateral no mesmo desenho do Smart Nexus: item ativo na cor de ação
 * da marca (verde NexON) com marcador na borda, submenus que abrem animados
 * e, com o menu recolhido, um painel flutuante com os subitens ao passar o
 * mouse no ícone.
 */
const COR_ATIVA =
  "bg-nexon-verde/15 text-nexon-link-claro hover:bg-nexon-verde/20 hover:text-nexon-link-claro dark:bg-nexon-verde/25 dark:text-nexon-verde dark:hover:bg-nexon-verde/35 dark:hover:text-nexon-verde";

// ── Qual item do menu corresponde à página aberta ─────────────────────────
//
// Antes o item só acendia com o endereço idêntico ao do menu, então qualquer
// página "de dentro" (/cadastros/plantas/123, a tela de um ativo aberta pelo
// Sinóptico) deixava o menu sem nada marcado. Agora vale o `path` do item,
// as subrotas dele e as rotas de `ativoEm`; se mais de um item servir, ganha
// o mais específico (o caminho mais longo).

function casa(rota: string, pathname: string): number {
  if (pathname === rota || pathname.startsWith(rota.endsWith("/") ? rota : `${rota}/`)) {
    return rota.length;
  }
  return -1;
}

function acharAtivo(links: NavigationLink[], pathname: string): string | null {
  let melhorKey: string | null = null;
  let melhorPeso = -1;
  const visitar = (itens: NavigationLink[]) => {
    for (const item of itens) {
      if (item.links?.length) {
        visitar(item.links);
        continue;
      }
      for (const rota of [item.path, ...(item.ativoEm ?? [])]) {
        const peso = casa(rota, pathname);
        if (peso > melhorPeso) {
          melhorPeso = peso;
          melhorKey = item.key;
        }
      }
    }
  };
  visitar(links);
  return melhorKey;
}

const AtivoContext = createContext<string | null>(null);

function useAtivo(item: NavigationLink) {
  const ativoKey = useContext(AtivoContext);
  const contem = (i: NavigationLink): boolean =>
    i.key === ativoKey || (i.links?.some(contem) ?? false);
  return {
    ativo: item.key === ativoKey,
    temFilhoAtivo: item.links?.some(contem) ?? false,
  };
}

// ── Painel flutuante (menu recolhido) ─────────────────────────────────────

function SidebarFlyout({
  item,
  isVisible,
  triggerRect,
  onMouseEnter,
  onMouseLeave,
  onNavigate,
}: {
  item: NavigationLink;
  isVisible: boolean;
  triggerRect: DOMRect | null;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onNavigate: (path: string) => void;
}) {
  if (!isVisible || !triggerRect) return null;

  const subitens = item.links ?? [];
  const hasLinks = subitens.length > 0;

  // Estima a altura para o painel não sair da tela
  const estimatedHeight = hasLinks ? 40 + subitens.length * 36 : 40;
  const top = Math.min(triggerRect.top, window.innerHeight - estimatedHeight - 8);

  return (
    <div
      className="fixed z-[99999]"
      style={{ top, left: triggerRect.right + 6 }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div
        className={cn(
          "min-w-[200px] max-w-[280px] rounded-lg border border-border/50",
          "bg-card shadow-xl shadow-black/10 dark:shadow-black/30",
          "animate-in fade-in-0 slide-in-from-left-2 duration-150 ease-out",
          "overflow-hidden"
        )}
      >
        {/* Cabeçalho: o próprio item pai */}
        {hasLinks ? (
          <div
            className="px-3 py-2.5 border-b border-border/40 cursor-pointer hover:bg-accent/50 transition-colors duration-150"
            onClick={() => onNavigate(item.path)}
          >
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {item.label}
            </span>
          </div>
        ) : (
          <div
            className="px-3 py-2.5 cursor-pointer hover:bg-accent/50 transition-colors duration-150"
            onClick={() => onNavigate(item.path)}
          >
            <span className="text-sm font-medium text-card-foreground">{item.label}</span>
          </div>
        )}

        {hasLinks && (
          <div className="py-1">
            {subitens.map((subItem) => (
              <FlyoutSubItem key={subItem.key + subItem.path} item={subItem} onNavigate={onNavigate} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function FlyoutSubItem({
  item,
  onNavigate,
  depth = 0,
}: {
  item: NavigationLink;
  onNavigate: (path: string) => void;
  depth?: number;
}) {
  const { ativo } = useAtivo(item);
  const hasNestedLinks = (item.links?.length ?? 0) > 0;
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div>
      <button
        className={cn(
          "w-full flex items-center gap-2.5 px-3 py-2 text-sm",
          "transition-all duration-150 text-left",
          ativo
            ? cn(COR_ATIVA, "font-medium")
            : "text-card-foreground/80 hover:bg-accent/60 hover:text-accent-foreground",
          depth > 0 && "pl-6 text-xs"
        )}
        onClick={() => (hasNestedLinks ? setIsExpanded(!isExpanded) : onNavigate(item.path))}
      >
        {item.icon && <item.icon className={cn("w-4 h-4 shrink-0", !ativo && "text-muted-foreground")} />}
        <span className="flex-1 truncate">{item.label}</span>
        {hasNestedLinks && (
          <ChevronRight
            className={cn(
              "w-3.5 h-3.5 shrink-0 transition-transform duration-200 text-muted-foreground",
              isExpanded && "rotate-90"
            )}
          />
        )}
        {ativo && <div className="w-1.5 h-1.5 rounded-full bg-nexon-verde shrink-0" />}
      </button>
      {hasNestedLinks && isExpanded && (
        <div className="border-l border-border/30 ml-5">
          {item.links!.map((nested) => (
            <FlyoutSubItem key={nested.key + nested.path} item={nested} onNavigate={onNavigate} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Item do menu ──────────────────────────────────────────────────────────

function NavMenuItem({ item }: { item: NavigationLink }) {
  const navigate = useNavigate();
  const { isMobile, state, setOpenMobile, setOpen } = useSidebar();
  const isCollapsed = state === "collapsed" && !isMobile;

  const { ativo, temFilhoAtivo } = useAtivo(item);
  const isSelected = item.links ? temFilhoAtivo : ativo;

  // Abre sozinho quando a página aberta é de um dos subitens
  const [isExpanded, setIsExpanded] = useState(() => temFilhoAtivo);
  useEffect(() => {
    if (temFilhoAtivo) setIsExpanded(true);
  }, [temFilhoAtivo]);

  const [flyoutVisible, setFlyoutVisible] = useState(false);
  const [triggerRect, setTriggerRect] = useState<DOMRect | null>(null);
  const itemRef = useRef<HTMLLIElement>(null);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelHide = useCallback(() => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
  }, []);

  const showFlyout = useCallback(() => {
    if (!isCollapsed) return;
    cancelHide();
    if (itemRef.current) setTriggerRect(itemRef.current.getBoundingClientRect());
    setFlyoutVisible(true);
  }, [isCollapsed, cancelHide]);

  const hideFlyout = useCallback(() => {
    hideTimeoutRef.current = setTimeout(() => setFlyoutVisible(false), 150);
  }, []);

  useEffect(() => cancelHide, [cancelHide]);

  const handleNavigate = useCallback(
    (path: string) => {
      navigate(path);
      if (isMobile) setOpenMobile(false);
      setFlyoutVisible(false);
    },
    [navigate, isMobile, setOpenMobile]
  );

  // Recolhido: item com subitens usa o painel flutuante, não o tooltip
  const tooltipProp = isCollapsed && item.links ? undefined : item.label;

  return (
    <>
      <Collapsible asChild className="group/collapsible" open={isExpanded} onOpenChange={setIsExpanded}>
        <SidebarMenuItem ref={itemRef} className="my-1" onMouseEnter={showFlyout} onMouseLeave={hideFlyout}>
          {/* Marcador na borda do menu: mostra o ativo mesmo de canto de olho. */}
          {isSelected && (
            <span
              aria-hidden
              className="absolute -left-2 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-nexon-verde"
            />
          )}
          <CollapsibleTrigger asChild>
            <SidebarMenuButton
              tooltip={tooltipProp}
              onClick={() => {
                if (isCollapsed) {
                  if (!item.links) handleNavigate(item.path);
                  return;
                }
                if (!item.links) {
                  handleNavigate(item.path);
                } else if (!isMobile) {
                  setOpen(true);
                }
              }}
              className={cn(
                "relative h-10 px-3 rounded-lg select-none flex items-center gap-3",
                "transition-colors duration-200",
                // Trilho recolhido: só o ícone, no centro.
                isCollapsed && "justify-center gap-0 rounded-xl",
                isSelected
                  ? cn(COR_ATIVA, "font-semibold")
                  : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
              )}
            >
              {item.icon && <item.icon className={cn("shrink-0", isCollapsed ? "!size-[22px]" : "!size-5")} />}
              {!isCollapsed && <span className="text-sm flex-1">{item.label}</span>}
              {!isCollapsed && item.links && (
                <ChevronRight
                  className={cn(
                    "w-4 h-4 shrink-0 opacity-60 transition-transform duration-200",
                    "group-data-[state=open]/collapsible:rotate-90"
                  )}
                />
              )}
            </SidebarMenuButton>
          </CollapsibleTrigger>

          {/* Menu aberto: subitens no próprio menu, abrindo animados */}
          {item.links && !isCollapsed && (
            <CollapsibleContent>
              <SidebarMenuSub className="pl-4 mt-1">
                {item.links.map((subItem) => (
                  <NavSubMenuItem key={subItem.key} item={subItem} onNavigate={handleNavigate} />
                ))}
              </SidebarMenuSub>
            </CollapsibleContent>
          )}
        </SidebarMenuItem>
      </Collapsible>

      {/* Menu recolhido: painel flutuante ao lado do ícone */}
      {isCollapsed &&
        createPortal(
          <SidebarFlyout
            item={item}
            isVisible={flyoutVisible}
            triggerRect={triggerRect}
            onMouseEnter={cancelHide}
            onMouseLeave={hideFlyout}
            onNavigate={handleNavigate}
          />,
          document.body
        )}
    </>
  );
}

function NavSubMenuItem({
  item,
  onNavigate,
}: {
  item: NavigationLink;
  onNavigate: (path: string) => void;
}) {
  const { ativo, temFilhoAtivo } = useAtivo(item);
  const isActive = ativo || temFilhoAtivo;

  const [isExpanded, setIsExpanded] = useState(() => temFilhoAtivo);
  useEffect(() => {
    if (temFilhoAtivo) setIsExpanded(true);
  }, [temFilhoAtivo]);

  return (
    <Collapsible asChild className="group/nested-collapsible" open={isExpanded} onOpenChange={setIsExpanded}>
      <SidebarMenuSubItem className="rounded-sm">
        <CollapsibleTrigger asChild>
          <SidebarMenuSubButton
            onClick={() => {
              if (!item.links) onNavigate(item.path);
            }}
            className={cn(
              "cursor-pointer h-9 rounded-lg select-none flex items-center gap-3",
              "transition-colors duration-200",
              isActive
                ? cn(COR_ATIVA, "font-medium")
                : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
            )}
          >
            {item.icon && <item.icon className="w-4 h-4 shrink-0" />}
            <span className="text-sm flex-1">{item.label}</span>
            {item.links && (
              <ChevronRight
                className={cn(
                  "w-4 h-4 shrink-0 opacity-60 transition-transform duration-200",
                  "group-data-[state=open]/nested-collapsible:rotate-90"
                )}
              />
            )}
          </SidebarMenuSubButton>
        </CollapsibleTrigger>

        {item.links && (
          <CollapsibleContent>
            <SidebarMenuSub className="pl-4 mt-1">
              {item.links.map((nestedItem) => (
                <NavSubMenuItem key={nestedItem.key} item={nestedItem} onNavigate={onNavigate} />
              ))}
            </SidebarMenuSub>
          </CollapsibleContent>
        )}
      </SidebarMenuSubItem>
    </Collapsible>
  );
}

export function NavMain() {
  const navigationLinks = useFilteredNavigationLinks();
  const { pathname } = useLocation();
  const ativoKey = useMemo(() => acharAtivo(navigationLinks, pathname), [navigationLinks, pathname]);

  return (
    <AtivoContext.Provider value={ativoKey}>
      <SidebarGroup>
        <SidebarMenu>
          {navigationLinks.map((item) => (
            <NavMenuItem key={item.key} item={item} />
          ))}
        </SidebarMenu>
      </SidebarGroup>
    </AtivoContext.Provider>
  );
}
