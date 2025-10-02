// app/components/Hero.tsx
export default function Hero({
  title,
  subtitle,
  image = '/hero.jpg',      // <-- Default-Bild
  topRightLogoUrl,
  children,
}: {
  title: string
  subtitle?: string
  image?: string            // <-- optional gemacht
  topRightLogoUrl?: string | null
  children?: React.ReactNode
}) {
  return (
    <section
      className="hero-full safe-area"
      style={{
        backgroundImage: `url('${image}')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        color: '#fff'
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
        <div className="grid place-items-center gap-6 text-center">
          <h1 className="hero-text text-5xl md:text-6xl font-extrabold uppercase">
            {title}
          </h1>
          {subtitle && <p className="hero-sub text-lg md:text-xl">{subtitle}</p>}
          {children}
        </div>
      </div>
    </section>
  )
}
