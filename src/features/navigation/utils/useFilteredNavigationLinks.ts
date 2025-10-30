import { useUserStore } from '@/store/useUserStore';
import { NavigationLink, navigationLinks } from './navigation-links';
import { featureFlags } from '@/config/feature-flags';

export function useFilteredNavigationLinks() {
  // const { acessivel } = useUserStore();

  const filterLinks = (links: NavigationLink[]): NavigationLink[] => {
    // if (!acessivel) return [];
    return links
      .filter((link) => {
        // Verifica a feature key (permissão)
        if (!link.featureKey) return false;

        // Verifica a feature flag (se definida)
        if (link.featureFlag) {
          const isFlagEnabled = featureFlags[link.featureFlag];
          if (!isFlagEnabled) return false;
        }

        return true;
      })
      .map((link) => ({
        ...link,
        links: link.links ? filterLinks(link.links) : undefined,
      }));
  };

  return filterLinks(navigationLinks);
}