// app/components/Hero.tsx
export default function Hero({
  title,
  subtitle,
  image = '/hero.jpg',      // Fallback
  topRightLogoUrl,
  children,
}: {
  title: string
  subtitle?: string
  image?: string
  topRightLogoUrl?: string | null
  children?: React.ReactNode
}) {
  return (
    <section
      className="hero-full"  // volle Höhe
      style={{
        backgroundImage: `url('${image}')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        color: '#fff',
      }}
    >
      <div className="relative mx-auto w-full max-w-6xl px-5">
        {topRightLogoUrl && (
          <img
            src={topRightLogoUrl}
            alt="Vereinslogo"
            className="absolute right-2 top-2 md:right-4 md:top-4 h-12 md:h-16 w-auto drop-shadow-lg rounded"
          />
        )}

        {/* <<< NEU: echtes Mid-Screen Centering >>> */}
        <div className="hero-center">
          <h1 className="hero-text text-5xl md:text-6xl font-extrabold uppercase text-center">
            {title}
          </h1>
          {subtitle && (
            <p className="hero-sub text-lg md:text-xl mt-2 text-center">{subtitle}</p>
          )}
          {children && <div className="mt-6">{children}</div>}
        </div>
      </div>
    </section>
  )
}
