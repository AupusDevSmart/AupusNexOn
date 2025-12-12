interface LoginBannerProps {
  bannerSrc?: string;
  title?: string;
  subtitle?: string;
}

/**
 * Componente de banner lateral da tela de login
 * Exibe logo e mensagem de boas-vindas
 * Visível apenas em desktop (lg:)
 */
export function LoginBanner({
  bannerSrc = '/aupussmart.png',
  title,
  subtitle = 'Interligando você com o futuro. Energize-se.',
}: LoginBannerProps) {
  return (
    <div className="hidden lg:flex lg:flex-col lg:justify-center lg:items-center lg:w-1/2 h-full bg-[#0f0e1f] overflow-hidden p-8 border-r border-border/20">
      {bannerSrc ? (
        <>
          <img
            src={bannerSrc}
            alt="Aupus Smart Logo"
            className="max-w-[320px] w-full max-h-full object-contain object-center p-4"
          />
          {title && (
            <h1 className="text-white text-3xl font-semibold mt-6 text-center">
              {title}
            </h1>
          )}
          <p className="text-white/70 text-center mt-4 px-8 max-w-md text-base">
            {subtitle}
          </p>
        </>
      ) : (
        <div className="flex items-center justify-center w-full h-full text-white/50">
          <span className="text-xl">Banner Placeholder</span>
        </div>
      )}
    </div>
  );
}
