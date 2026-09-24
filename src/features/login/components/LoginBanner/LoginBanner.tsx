import type { ReactNode } from 'react';

interface LoginBannerProps {
  bannerSrc?: string;
  title?: string;
  subtitle?: string;
}

/**
 * Painel da marca nas telas de entrada (login, esqueci e redefinir senha).
 * Identidade visual NexON: fundo azul NexON e logo na versão negativa,
 * independente do tema. Só aparece de lg pra cima; abaixo disso a marca
 * entra reduzida no topo do formulário (ver LoginMarcaCompacta).
 */
export function LoginBanner({
  bannerSrc = '/brand/nexon-logo-negativo.svg',
  title,
  subtitle = 'Interligando você com o futuro. Energize-se.',
}: LoginBannerProps) {
  return (
    <aside className="relative hidden h-full overflow-hidden border-r border-white/10 bg-white/[0.03] p-12 lg:flex lg:w-1/2 lg:flex-col lg:justify-between">
      {/* O pulso é o grafismo divisor da marca Aupus: proporção original
          preservada e sempre crescendo da esquerda para a direita. */}
      <img
        src="/brand/pulso-verde.svg"
        alt=""
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-auto w-full"
      />

      <div className="flex flex-1 flex-col items-center justify-center gap-8 text-center">
        <img
          src={bannerSrc}
          alt="NexON"
          className="h-auto w-full max-w-[340px] object-contain"
        />
        {title && (
          <h1 className="text-center text-3xl font-medium text-white">{title}</h1>
        )}
        <p className="max-w-xs text-sm leading-relaxed text-nexon-texto-secundario">
          {subtitle}
        </p>
      </div>

      <div className="flex flex-col items-center gap-2">
        <span className="text-xs text-white/40">Uma plataforma</span>
        <img
          src="/brand/aupus-energia-negativa.png"
          alt="Aupus Energia"
          className="h-8 w-auto object-contain opacity-80"
        />
      </div>
    </aside>
  );
}

/** Marca reduzida acima do formulário, quando o painel lateral some (< lg). */
export function LoginMarcaCompacta() {
  return (
    <img
      src="/brand/nexon-logo-negativo.svg"
      alt="NexON"
      className="h-12 w-auto object-contain lg:hidden"
    />
  );
}

/**
 * Moldura das telas de entrada, igual à do Smart Nexus: fundo azul NexON fixo
 * (não segue o tema), painel da marca à esquerda e formulário à direita.
 */
export function LoginLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-nexon-azul">
      <LoginBanner />
      <main className="flex flex-1 flex-col items-center justify-center overflow-y-auto px-6 py-10">
        <div className="flex w-full max-w-sm flex-col items-center gap-8">
          <LoginMarcaCompacta />
          {children}
        </div>
      </main>
    </div>
  );
}
