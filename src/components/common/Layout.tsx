import React from 'react';
import ErrorBoundary from './ErrorBoundary';
import { useRolagemLembrada } from '@/hooks/useEstadoLembrado';

export function Layout({ children, className = '', asidePosition = 'left' }: { children: React.ReactNode, className?: string, asidePosition?: 'left' | 'right' }) {
  const hasAside = React.Children.toArray(children).some(
    (child) => React.isValidElement(child) && child.type === Layout.Aside
  );

  return (
    <ErrorBoundary>
      <div
        className={`bg-secondary h-full w-full lg:rounded-sm clearfix lg:overflow-hidden overflow-y-auto overflow-x-hidden min-w-0 flex ${hasAside ? 'lg:flex-row' : 'flex-col'} ${className} ${asidePosition === 'right' ? 'lg:flex-row-reverse' : ''}`}
      >
        {children}
      </div>
    </ErrorBoundary>
  );
}


Layout.Header = function Header({ children, className = '' }: { children: React.ReactNode, className?: string }) {
  return (
    <ErrorBoundary>
      <header
        className={`bg-secondary w-full flex flex-shrink-0 h-auto lg:h-16 justify-start items-center p-3 lg:p-6 ${className}`}
      >
        {children}
      </header>
    </ErrorBoundary>
  );
};

Layout.Aside = function Aside({ children, className = '' }: { children: React.ReactNode, className?: string }) {
  return (
    <ErrorBoundary>
      <aside
        className={`bg-primary h-full lg:w-1/6 w-full items-center justify-center hidden lg:flex ${className}`}
      >
        {children}
      </aside>
    </ErrorBoundary>
  );
};

Layout.Main = function Main({ children, className = '', withSidebar = false }: { children: React.ReactNode, className?: string, withSidebar?: boolean }) {
  const ref = React.useRef<HTMLElement>(null);
  useRolagemLembrada(ref);
  return (
    <ErrorBoundary>
      <main
        ref={ref}
        className={`bg-secondary h-full ${withSidebar ? 'w-full lg:w-5/6' : 'w-full'} min-w-0 flex flex-col items-start justify-start overflow-y-auto overflow-x-hidden [&>*]:max-w-full p-3 sm:p-6 gap-4 sm:gap-6 pt-2 lg:pt-2 ${className}`}
      >
        {children}
      </main>
    </ErrorBoundary>
  );
};

Layout.Footer = function Footer({ children, className = '' }: { children: React.ReactNode, className?: string }) {
  return (
    <ErrorBoundary>
      <footer
        className={`bg-secondary h-10vh w-full flex flex-shrink-0 p-5 items-center justify-center ${className}`}
      >
        {children}
      </footer>
    </ErrorBoundary>
  );
};