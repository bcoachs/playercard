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
      className="relative" // wichtig: Referenz für absolute Mitte
      style={{
        minHeight: '100dvh',            // volle Höhe
        backgroundImage: `url('${image}')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        color: '#fff',
      }}
    >
      {/* Logo oben rechts */}
      {topRightLogoUrl && (
        <img
          src={topRightLogoUrl}
          alt="Vereinslogo"
          className="absolute right-2 top-2 md:right-4 md:top-4 h-12 md:h-16 w-auto drop-shadow-lg rounded"
        />
      )}

      {/* >>> absolut & wirklich mittig über den ganzen Bildschirm <<< */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-full max-w-6xl px-5 text-center">
          <h1 className="hero-text text-5xl md:text-6xl font-extrabold uppercase">
            {title}
          </h1>
          {subtitle && (
            <p className="hero-sub text-lg md:text-xl mt-2">{subtitle}</p>
          )}

          {/* Buttons als Gruppe mittig */}
          {children && <div className="mt-6 flex justify-center">{children}</div>}
        </div>
      </div>
    </section>
  )
}
