import { NavigationLink, navigationLinks } from './navigation-links';
import { featureFlags } from '@/config/feature-flags';
import { useUserStore } from '@/store/useUserStore';

/**
 * Filtra os itens de navegacao baseado em (1) feature flags e (2) permissions Spatie.
 *
 * Regras:
 * - Sem `featureKey`: sempre mostra (sujeito so a feature flag).
 * - Com `featureKey`: usuario precisa ter a permission em `acessivel`.
 * - Grupos (com `links`): mostram se sobrar pelo menos um filho visivel.
 *
 * `featureKey` no `navigation-links.ts` foi migrado em 2026-05 de strings legacy
 * (PascalCase: "Dashboard", "Usuarios") para permissions Spatie ("dashboard.view",
 * "usuarios.view"). Items sem permission Spatie correspondente (SCADA, Supervisorio)
 * nao tem `featureKey` e ficam abertos sujeitos so a feature flag.
 */
export function useFilteredNavigationLinks() {
  const { acessivel } = useUserStore();

  const isAllowed = (link: NavigationLink): boolean => {
    if (link.featureFlag) {
      const isFlagEnabled = featureFlags[link.featureFlag];
      if (!isFlagEnabled) return false;
    }
    if (!link.featureKey) return true;
    return Array.isArray(acessivel) && acessivel.includes(link.featureKey);
  };

  const filterLinks = (links: NavigationLink[]): NavigationLink[] => {
    return links
      .map((link) => {
        const children = link.links ? filterLinks(link.links) : undefined;
        return { ...link, links: children };
      })
      .filter((link) => {
        if (Array.isArray(link.links)) return link.links.length > 0;
        return isAllowed(link);
      });
  };

  return filterLinks(navigationLinks);
}