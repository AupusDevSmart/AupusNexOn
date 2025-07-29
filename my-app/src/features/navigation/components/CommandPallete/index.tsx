import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { useFilteredNavigationLinks } from '@/features/navigation/utils/useFilteredNavigationLinks';

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { nanoid } from 'nanoid';

export function CommandPallete() {
  const [open, setOpen] = React.useState(false);
  const navigate = useNavigate();
  const navigationLinks = useFilteredNavigationLinks();

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const handleSelect = (value: string): void => {
    setOpen(false);
    navigate(`${value}`);
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Digite o comando para buscar..." />
      <CommandList>
        <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>
        <CommandGroup heading="Pages">
          {navigationLinks.map((item) => (
            <CommandItem
              key={nanoid()}
              value={item.path}
              onSelect={handleSelect}
            >
              <item.icon strokeWidth={1} className="mr-2" />
              <span>{item.label}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}