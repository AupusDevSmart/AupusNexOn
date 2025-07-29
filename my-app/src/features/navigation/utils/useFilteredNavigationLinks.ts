import { useUserStore } from '@/store/useUserStore';
import { NavigationLink, navigationLinks } from './navigation-links';

export function useFilteredNavigationLinks() {
  // const { acessivel } = useUserStore();
  
  const filterLinks = (links: NavigationLink[]): NavigationLink[] => {
    // if (!acessivel) return [];
    return links
      .filter((link) => link.featureKey)
      .map((link) => ({
        ...link,
        links: link.links ? filterLinks(link.links) : undefined, 
      }));
  };

  return filterLinks(navigationLinks);
}