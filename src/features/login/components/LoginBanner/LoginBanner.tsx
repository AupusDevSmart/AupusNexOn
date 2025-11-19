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
    <div className="hidden lg:flex lg:flex-col lg:justify-center lg:items-center lg:w-1/2 h-full bg-[#161534] overflow-hidden p-8">
      {bannerSrc ? (
        <>
          <img
            src={bannerSrc}
            alt="Aupus Smart Logo"
            className="max-w-[320px] w-full max-h-full object-contain object-center p-4"
          />
          {title && (
            <h1 className="text-white text-3xl font-bold mt-6 text-center">
              {title}
            </h1>
          )}
          <p className="text-white text-center mt-4 px-8 max-w-md text-lg opacity-90">
            {subtitle}
          </p>
        </>
      ) : (
        <div className="flex items-center justify-center w-full h-full text-card-foreground">
          <span className="text-xl">Banner Placeholder</span>
        </div>
      )}
    </div>
  );
}
