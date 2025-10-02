// app/components/Hero.tsx
export default function Hero({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children?: React.ReactNode
}) {
  return (
    <section className="hero-photo hero-full safe-area">
      <div className="mx-auto w-full max-w-6xl px-5">
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
