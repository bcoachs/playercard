// app/components/Hero.tsx
export default function Hero({
  title,
  subtitle,
  image = '/hero.jpg',
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
      className="relative" // Referenz für absolute Mitte
      style={{
        minHeight: '100dvh',        // volle Höhe
        backgroundImage: `url('${image}')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        color: '#fff',
      }}
    >
      {/* Logo oben rechts (optional) */}
      {topRightLogoUrl && (
        <img
          src={topRightLogoUrl}
          alt="Vereinslogo"
          className="absolute right-2 top-2 md:right-4 md:top-4 h-12 md:h-16 w-auto drop-shadow-lg rounded"
        />
      )}

      {/* >>> absolut & exakt MITTE/MITTE (viewport) <<< */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full px-5">
        <div className="mx-auto max-w-6xl text-center">
          <h1 className="hero-text text-5xl md:text-6xl font-extrabold uppercase">
            {title}
          </h1>
          {subtitle && (
            <p className="hero-sub text-lg md:text-xl mt-2">{subtitle}</p>
          )}
          {children && <div className="mt-6">{children}</div>}
        </div>
      </div>
    </section>
  )
}
