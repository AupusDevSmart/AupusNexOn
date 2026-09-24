"use client";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
import { useFilteredNavigationLinks } from "@/features/navigation/utils/useFilteredNavigationLinks";
import { ChevronRight } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

// Mesmo desenho do menu do Smart Nexus: item ativo na cor de ação da marca
// (verde NexON) com marcador na borda; texto sobre verde claro é o link claro.
const COR_ATIVA =
  "bg-nexon-verde/15 text-nexon-link-claro hover:bg-nexon-verde/20 hover:text-nexon-link-claro dark:bg-nexon-verde/25 dark:text-nexon-verde dark:hover:bg-nexon-verde/35 dark:hover:text-nexon-verde";

export function NavMain() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isMobile, setOpenMobile, setOpen, state } = useSidebar();
  const isCollapsed = state === "collapsed" && !isMobile;
  const navigationLinks = useFilteredNavigationLinks();

// console.log(navigationLinks);

  return (
    <SidebarGroup>
      <SidebarMenu>
        {navigationLinks.map((item) => {
          const hasActiveChild = item.links?.some(
            (subItem) => location.pathname === subItem.path
          );
          const isSelected = item.links
            ? hasActiveChild
            : location.pathname === item.path;

          return (
            <Collapsible key={item.key} asChild className="group/collapsible">
              <SidebarMenuItem className="my-1">
                {/* Marcador na borda do menu: mostra o ativo mesmo de canto de olho. */}
                {isSelected && (
                  <span
                    aria-hidden
                    className="absolute -left-2 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-nexon-verde"
                  />
                )}
                <CollapsibleTrigger asChild>
                  <SidebarMenuButton
                    tooltip={item.label}
                    onClick={() => {
                      if (!item.links) {
                        navigate(item.path);
                        if (isMobile) setOpenMobile(false);
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
                    {item.icon && (
                      <item.icon
                        className={cn("shrink-0", isCollapsed ? "!size-[22px]" : "!size-5")}
                      />
                    )}
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
                {item.links && (
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {item.links.map((subItem) => {
                        const isSubItemActive =
                          location.pathname === subItem.path;

                        return (
                          <SidebarMenuSubItem key={subItem.key}>
                            <SidebarMenuSubButton
                              asChild
                              className={`
                                flex items-center relative
                                ${
                                  isSubItemActive
                                    ? `${COR_ATIVA} font-medium`
                                    : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                                }
                              `}
                            >
                              <a
                                onClick={(e) => {
                                  e.preventDefault();
                                  navigate(subItem.path);
                                  if (isMobile) setOpenMobile(false);
                                }}
                                className="cursor-pointer flex items-center gap-3 w-full"
                              >
                                {subItem.icon && (
                                  <subItem.icon
                                    className="w-4 h-4 shrink-0"
                                  />
                                )}
                                <span className="flex-1">{subItem.label}</span>
                              </a>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        );
                      })}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                )}
              </SidebarMenuItem>
            </Collapsible>
          );
        })}
      </SidebarMenu>
    </SidebarGroup>
  );
}
