import React from 'react';

interface TitleCardProps {
  title: string;
  description?: string;
  /** Ações à direita do título no desktop (botões, abas). No celular descem para baixo do título. */
  actions?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

/**
 * Cabeçalho padrão de toda tela do NexON: título `text-2xl font-bold`, descrição opcional e
 * `mb-6` (24px) até o conteúdo. Use dentro de um wrapper sem gap (`flex flex-col w-full`) para o
 * espaçamento ficar igual em todas as telas.
 */
export function TitleCard({ title, description, actions, children, className = '' }: TitleCardProps) {
  return (
    <div className={`w-full mb-6 ${className}`}>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-foreground">{title}</h1>
          {description && (
            <p className="text-sm text-muted-foreground mt-1">{description}</p>
          )}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2 md:justify-end">{actions}</div>}
      </div>
      {children}
    </div>
  );
}
