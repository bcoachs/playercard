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
      // Grid zentriert Tracks (nicht nur Items) und füllt sicher den Viewport
      className="relative grid vh place-content-center text-center"
      style={{
        backgroundImage: `url('${image}')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        color: '#fff',
      }}
    >
      {/* Optionales Logo oben rechts */}
      {topRightLogoUrl && (
        <img
          src={topRightLogoUrl}
          alt="Vereinslogo"
          className="absolute right-2 top-2 md:right-4 md:top-4 h-12 md:h-16 w-auto drop-shadow-lg rounded"
        />
      )}

      {/* Inhalt wirklich Mitte/Mitte */}
      <div className="w-full max-w-6xl px-5">
        <h1 className="hero-text text-5xl md:text-6xl font-extrabold uppercase">
          {title}
        </h1>
        {subtitle && (
          <p className="hero-sub text-lg md:text-xl mt-2">{subtitle}</p>
        )}
        {children && (
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            {children}
          </div>
        )}
      </div>
    </section>
  )
}
